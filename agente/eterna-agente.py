#!/usr/bin/env python3
"""Eterna · agente do ponto.

1) Vigia cartões de memória inseridos no computador e baixa as fotos novas.
2) Recebe fotos por FTP (Canon Content Transfer Professional no celular, ou a
   câmera direto por Wi-Fi) na mesma pasta.
Tudo cai em ~/Eterna/inbox e aparece sozinho na tela Ingestão de eterna.photo.

Uso: python3 eterna-agente.py        (deixe rodando; Ctrl+C para parar)
     sudo python3 eterna-agente.py   (para o FTP usar a porta 21 padrão)

Credenciais do FTP ficam em ~/Eterna/ftp.json (criadas na primeira vez) e são
mostradas na tela ao iniciar.

Só biblioteca padrão. Miniaturas via `sips` no Mac e via Pillow se instalado;
sem nenhum dos dois, serve o JPG original.

3) Reconhecimento facial (opcional): cada foto que chega tem os rostos lidos
   (YuNet + SFace, OpenCV, licenças MIT e Apache 2.0) e entra no índice do dia.
   O checkout, o quiosque e a selfie do convidado buscam aqui. Liga sozinho se
   houver OpenCV:  python3 -m pip install opencv-python-headless numpy
   A selfie usada na busca não é gravada. Leituras de rosto: ~/Eterna/rostos.db,
   apagadas depois de 30 dias.

Para outros computadores da rede (checkout, quiosque) usarem este agente:
     ETERNA_REDE=1 python3 eterna-agente.py
Para receber de um servidor FTP que já existe na máquina, vigiando a pasta dele:
     ETERNA_PASTA="C:/FTP/fotos" python3 eterna-agente.py
"""
import hashlib, json, os, shutil, subprocess, sys, threading, time, glob, socket, random, string, sqlite3, base64, queue
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import urllib.request, urllib.error, mimetypes, re, base64

PORT = int(os.environ.get("ETERNA_PORTA") or 8765)
APP_ORIGIN = os.environ.get("ETERNA_APP_ORIGIN", "https://eterna.photo")
app_cache = {}
HOME = os.path.expanduser("~/Eterna")
INBOX = os.path.join(HOME, "inbox")
THUMBS = os.path.join(HOME, "thumbs")
INDEX = os.path.join(HOME, "index.json")
FTPCFG = os.path.join(HOME, "ftp.json")
FTPTMP = os.path.join(HOME, "ftp-tmp")
EXT = (".jpg", ".jpeg", ".JPG", ".JPEG")
POLL = 2.0

os.makedirs(INBOX, exist_ok=True)
os.makedirs(THUMBS, exist_ok=True)
os.makedirs(FTPTMP, exist_ok=True)

lock = threading.Lock()
events = []            # [{type, id, name, size, t, card}]
seen = {}              # hash -> id
BOOT = "%x" % int(time.time())   # muda a cada vez que o agente abre
META = os.path.join(os.path.expanduser("~/Eterna"), "meta.json")   # de onde veio cada foto e quando chegou
meta = {}
meta_dirty = [False]
try:
    meta.update(json.load(open(META)))
except Exception:
    pass


# ---------- EXIF: de qual câmera e de quem é a foto ----------
# Lê o número de série do corpo (automático na R6 Mark II), o nome do autor (Artist, "Informações de copyright"
# no menu da câmera) e o dono (Canon "Owner's name"). Só biblioteca padrão.
def exif_info(path):
    try:
        with open(path, "rb") as f:
            data = f.read(256 * 1024)
        if data[:2] != b"\xff\xd8":
            return {}
        i = 2
        while i + 4 < len(data):
            if data[i] != 0xFF:
                break
            marker = data[i + 1]
            ln = int.from_bytes(data[i + 2:i + 4], "big")
            if marker == 0xE1 and data[i + 4:i + 10] == b"Exif\x00\x00":
                return _exif_tiff(data[i + 10:i + 2 + ln])
            if marker == 0xDA:
                break
            i += 2 + ln
    except Exception:
        pass
    return {}


def _exif_tiff(t):
    if len(t) < 8:
        return {}
    E = "little" if t[:2] == b"II" else "big"
    u16 = lambda o: int.from_bytes(t[o:o + 2], E)
    u32 = lambda o: int.from_bytes(t[o:o + 4], E)

    def ifd(off):
        r = {}
        if off <= 0 or off + 2 > len(t):
            return r
        for k in range(u16(off)):
            e = off + 2 + 12 * k
            if e + 12 > len(t):
                break
            tag, typ, cnt = u16(e), u16(e + 2), u32(e + 4)
            size = {1: 1, 2: 1, 3: 2, 4: 4, 7: 1}.get(typ, 8) * cnt
            r[tag] = (typ, cnt, e + 8 if size <= 4 else u32(e + 8))
        return r

    def txt(ent):
        typ, cnt, vo = ent
        return t[vo:vo + cnt].split(b"\x00")[0].decode("utf-8", "ignore").strip()

    def num(ent):
        typ, cnt, vo = ent
        return u32(vo) if typ == 4 else u16(vo)

    out = {}
    i0 = ifd(u32(4))
    if 0x0110 in i0:
        out["modelo"] = txt(i0[0x0110])
    if 0x013B in i0:
        out["autor"] = txt(i0[0x013B])
    if 0x8769 in i0:
        ex = ifd(num(i0[0x8769]))
        if 0xA431 in ex:
            out["serie"] = txt(ex[0xA431])
        if 0xA430 in ex and not out.get("dono"):
            out["dono"] = txt(ex[0xA430])
        if 0x927C in ex:
            mn = ifd(ex[0x927C][2])
            if 0x0009 in mn:
                out["dono"] = txt(mn[0x0009]) or out.get("dono", "")
            if 0x000C in mn and not out.get("serie"):
                out["serie"] = str(num(mn[0x000C]))
    return {k: v for k, v in out.items() if v}


def save_meta():
    try:
        tmp = META + ".tmp"
        json.dump(meta, open(tmp, "w"))
        os.replace(tmp, META)
    except Exception:
        pass
lib = {}               # id -> {file, thumb}  (tudo que já está na inbox)
cards = {}             # volume path -> hashes já tratados nesta inserção
metricas = []           # uma linha por foto recebida (teste de carga e operação): ver /metricas
metricas_por_pid = {}
state = {"started": time.time(), "card": None, "copied": 0, "dups": 0, "ftp": {"port": None, "ip": None, "users": [], "received": 0, "last_user": None}}

if os.path.exists(INDEX):
    try:
        seen.update(json.load(open(INDEX)))
    except Exception:
        pass


def load_lib():
    for root, _, files in os.walk(INBOX):
        for fn in files:
            if "_" in fn and fn.endswith(EXT):
                pid = fn.split("_", 1)[0]
                th = os.path.join(THUMBS, pid + ".jpg")
                lib[pid] = {"file": os.path.join(root, fn), "thumb": th if os.path.exists(th) else os.path.join(root, fn)}
    # fotos de hoje que já estão na inbox voltam para a tela Ingestão quando o agente reinicia
    today = time.strftime("%Y-%m-%d")
    ddir = os.path.join(INBOX, today)
    if os.path.isdir(ddir):
        files = []
        for fn in os.listdir(ddir):
            if "_" in fn and fn.endswith(EXT):
                p = os.path.join(ddir, fn)
                files.append((os.path.getmtime(p), fn, p))
        for mt, fn, p in sorted(files):
            pid, name = fn.split("_", 1)
            events.append({"type": "photo", "id": pid, "name": name, "size": os.path.getsize(p), "t": mt,
                           "card": "inbox", "src": "inbox", "file": p, "thumb": lib.get(pid, {}).get("thumb", p)})


load_lib()


def save_index():
    tmp = INDEX + ".tmp"
    json.dump(seen, open(tmp, "w"))
    os.replace(tmp, INDEX)


def quick_hash(path, size):
    h = hashlib.sha256()
    h.update(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(2 * 1024 * 1024))
    return h.hexdigest()


def has_pillow():
    try:
        import PIL  # noqa
        return True
    except Exception:
        return False


def make_thumb(src, dst):
    try:
        if sys.platform == "darwin":
            subprocess.run(["sips", "-Z", "900", src, "--out", dst], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if has_pillow():
            from PIL import Image, ImageOps
            im = Image.open(src)
            im = ImageOps.exif_transpose(im)
            im.thumbnail((900, 900))
            im.convert("RGB").save(dst, "JPEG", quality=82)
            return True
    except Exception:
        pass
    return False


# ---------- reconhecimento facial ----------
ROSTOS_DB = os.path.join(HOME, "rostos.db")
MODELOS = os.path.join(HOME, "modelos")
MOD_DET = "face_detection_yunet_2023mar.onnx"
MOD_REC = "face_recognition_sface_2021dec.onnx"
LIMITE = 0.45          # semelhança mínima (cosseno SFace) para dizer "é a mesma pessoa"; calibrado nas fotos do Tour
LIMITE_TALVEZ = 0.38   # entre este e LIMITE a busca devolve como "talvez": o app pergunta "é uma destas?"
ROSTO_MIN = 40         # rostos menores que isso (px, foto reduzida a 1600) são fundo/arquibancada: ignorados
LADO = 1600
RETENCAO_DIAS = 30
rostos = {"ligado": False, "motivo": "iniciando", "lidas": 0, "rostos": 0, "fila": 0, "modelo": "YuNet + SFace (OpenCV)", "limite": LIMITE}
fila_rostos = queue.Queue()
_cv = {}               # cv2, np, det, rec (um par por thread de leitura)
_mat = {}              # dia -> (matriz N x 128, [pid...]) para busca
_mat_lock = threading.Lock()


def rostos_db():
    c = sqlite3.connect(ROSTOS_DB, timeout=30, check_same_thread=False)
    c.execute("pragma journal_mode=wal")
    c.execute("create table if not exists foto (pid text primary key, dia text, n int, lida real)")
    c.execute("create table if not exists rosto (pid text, dia text, larg real, emb blob)")
    c.execute("create index if not exists rosto_dia on rosto(dia)")
    return c


def modelos_ok():
    os.makedirs(MODELOS, exist_ok=True)
    for m in (MOD_DET, MOD_REC):
        dst = os.path.join(MODELOS, m)
        if not os.path.exists(dst) or os.path.getsize(dst) < 100000:
            print(f"  baixando modelo {m}...")
            urllib.request.urlretrieve(APP_ORIGIN + "/vendor/rostos/" + m, dst + ".tmp")
            os.replace(dst + ".tmp", dst)


def leitor():
    """Um detector e um reconhecedor por thread (os objetos do OpenCV não são compartilháveis)."""
    import cv2
    det = cv2.FaceDetectorYN.create(os.path.join(MODELOS, MOD_DET), "", (320, 320), 0.7, 0.3, 5000)
    rec = cv2.FaceRecognizerSF.create(os.path.join(MODELOS, MOD_REC), "")
    return det, rec


def ler_rostos(img, det, rec, minimo=ROSTO_MIN):
    """img BGR -> [(largura, vetor 128 normalizado)] do maior para o menor rosto."""
    np = _cv["np"]; cv2 = _cv["cv2"]
    h, w = img.shape[:2]
    k = min(1.0, LADO / max(h, w))
    if k < 1:
        img = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    det.setInputSize((img.shape[1], img.shape[0]))
    _, f = det.detect(img)
    out = []
    for r in (f if f is not None else []):
        if r[2] < minimo:
            continue
        e = rec.feature(rec.alignCrop(img, r)).flatten().astype("float32")
        out.append((float(r[2]), e / (np.linalg.norm(e) or 1)))
    return sorted(out, key=lambda x: -x[0])


def rostos_thread():
    try:
        import cv2, numpy as np
        _cv.update(cv2=cv2, np=np)
    except Exception:
        rostos["motivo"] = "sem OpenCV: python3 -m pip install opencv-python-headless numpy"
        print("  Rostos:            desligado (" + rostos["motivo"] + ")")
        return
    try:
        modelos_ok()
        det, rec = leitor()
    except Exception as ex:
        rostos["motivo"] = "modelos indisponíveis: %s" % ex
        print("  Rostos:            desligado (" + rostos["motivo"] + ")")
        return
    db = rostos_db()
    lim = time.strftime("%Y-%m-%d", time.localtime(time.time() - RETENCAO_DIAS * 86400))
    db.execute("delete from rosto where dia < ?", (lim,)); db.execute("delete from foto where dia < ?", (lim,)); db.commit()
    feitas = {r[0] for r in db.execute("select pid from foto")}
    rostos["lidas"] = len(feitas)
    rostos["rostos"] = db.execute("select count(*) from rosto").fetchone()[0]
    with lock:
        pend = [(pid, e["file"]) for pid, e in lib.items() if pid not in feitas]
    for x in sorted(pend, key=lambda t: t[1], reverse=True):     # mais recentes primeiro
        fila_rostos.put((x[0], x[1], None))
    rostos["ligado"] = True; rostos["motivo"] = None
    n = max(1, int(os.environ.get("ETERNA_LEITORES") or max(1, (os.cpu_count() or 2) // 2)))
    rostos["leitores"] = n
    print(f"  Rostos:            ligado · {rostos['lidas']} fotos lidas · {len(pend)} na fila · {n} leitores em paralelo")
    for k in range(1, n):
        threading.Thread(target=leitor_loop, args=leitor() + (rostos_db(),), daemon=True).start()
    leitor_loop(det, rec, db)


_cont_lock = threading.Lock()


def leitor_loop(det, rec, db):
    """Um leitor: tira da fila, lê os rostos e grava. Vários rodam em paralelo (ETERNA_LEITORES)."""
    cv2 = _cv["cv2"]
    while True:
        pid, path, t_fila = fila_rostos.get()
        rostos["fila"] = fila_rostos.qsize()
        t_ini = time.time()
        try:
            img = cv2.imread(path, cv2.IMREAD_REDUCED_COLOR_2)
            if img is None:
                continue
            fs = ler_rostos(img, det, rec)
            dia = os.path.basename(os.path.dirname(path))
            db.execute("insert or replace into foto values (?,?,?,?)", (pid, dia, len(fs), time.time()))
            db.execute("delete from rosto where pid=?", (pid,))
            db.executemany("insert into rosto values (?,?,?,?)", [(pid, dia, w, e.tobytes()) for w, e in fs])
            db.commit()
            with _cont_lock:
                rostos["lidas"] += 1; rostos["rostos"] += len(fs)
            m = metricas_por_pid.get(pid)
            if m is not None:
                agora = time.time()
                m.update(lida=agora, leitura_ms=round((agora - t_ini) * 1000, 1), rostos=len(fs),
                         espera_ms=round((t_ini - t_fila) * 1000, 1) if t_fila else None)
            with _mat_lock:
                _mat.pop(dia, None)
        except Exception as ex:
            print("  erro ao ler rostos", path, ex)


def matriz(dias):
    np = _cv["np"]
    vs, ps = [], []
    db = rostos_db()
    for d in dias:
        with _mat_lock:
            m = _mat.get(d)
        if m is None:
            rows = db.execute("select pid, emb from rosto where dia=?", (d,)).fetchall()
            m = (np.frombuffer(b"".join(r[1] for r in rows), dtype="float32").reshape(-1, 128) if rows else np.zeros((0, 128), "float32"), [r[0] for r in rows])
            with _mat_lock:
                _mat[d] = m
        vs.append(m[0]); ps += m[1]
    return (np.vstack(vs) if vs else np.zeros((0, 128), "float32")), ps


_busca = {"m": None}
_busca_lock = threading.Lock()


def buscar(imagens, dias=1):
    """Lê o maior rosto de cada imagem (dataURL/base64), faz a média e devolve as fotos com o rosto."""
    np = _cv["np"]; cv2 = _cv["cv2"]
    with _busca_lock:
        if not _busca["m"]:
            _busca["m"] = leitor()
        return _buscar(imagens, dias, *_busca["m"])


def _buscar(imagens, dias, det, rec):
    np = _cv["np"]; cv2 = _cv["cv2"]
    vs = []
    for b in imagens[:5]:
        raw = base64.b64decode(b.split(",", 1)[-1])
        img = cv2.imdecode(np.frombuffer(raw, "uint8"), cv2.IMREAD_COLOR)
        if img is None:
            continue
        fs = ler_rostos(img, det, rec, minimo=60)
        if fs:
            vs.append(fs[0][1])
    del imagens
    if not vs:
        return {"rosto": False, "fotos": []}
    me = np.mean(vs, axis=0); me /= np.linalg.norm(me) or 1
    hoje = time.time()
    M, ps = matriz([time.strftime("%Y-%m-%d", time.localtime(hoje - i * 86400)) for i in range(max(1, min(int(dias), RETENCAO_DIAS)))])
    melhor = {}
    if len(ps):
        sims = M @ me
        for i in np.nonzero(sims >= LIMITE_TALVEZ)[0]:
            pid = ps[i]; s_ = float(sims[i])
            if s_ > melhor.get(pid, 0):
                melhor[pid] = s_
    fotos = sorted(({"id": k, "sim": round(v, 3)} for k, v in melhor.items()), key=lambda x: -x["sim"])[:500]
    return {"rosto": True, "fotos": fotos, "limite": LIMITE}


def medir(sessoes):
    """Medição: o maior rosto de cada foto procurado nas outras fotos; acerto = a sessão dela vem em primeiro."""
    np = _cv["np"]
    db = rostos_db()
    dono = {}
    for card, pids in sessoes.items():
        for pid in pids:
            dono[pid] = card
    if not dono:
        return {"fotos": 0, "rostos": 0, "certo": 0, "errado": 0, "duvida": 0, "nada": 0, "acerto": 0}
    q = ",".join("?" * len(dono))
    rows = db.execute(f"select pid, emb from rosto where pid in ({q})", list(dono)).fetchall()
    fotos = {}
    for pid, emb in rows:
        fotos.setdefault(pid, []).append(np.frombuffer(emb, "float32"))
    per = {}
    for pid in fotos:
        per[dono[pid]] = per.get(dono[pid], 0) + 1
    certo = errado = duvida = nada = n = 0
    pids = list(fotos)
    for pid in pids:
        if per[dono[pid]] < 2:
            continue
        for me in fotos[pid]:
            n += 1; res = {}
            for o in pids:
                if o == pid:
                    continue
                b = max(float(e @ me) for e in fotos[o])
                if b >= LIMITE:
                    r = res.setdefault(dono[o], [0, 0.0]); r[0] += 1; r[1] = max(r[1], b)
            L = sorted(res.items(), key=lambda kv: (-kv[1][0], -kv[1][1]))
            if not L:
                nada += 1; continue
            if len(L) > 1 and L[0][1][0] == L[1][1][0] and L[0][1][1] - L[1][1][1] < 0.05:
                duvida += 1; continue
            if L[0][0] == dono[pid]:
                certo += 1
            else:
                errado += 1
    return {"fotos": len(fotos), "rostos": n, "certo": certo, "errado": errado, "duvida": duvida, "nada": nada,
            "acerto": certo / max(1, certo + errado), "modelo": rostos["modelo"]}


def uso_maquina():
    try:
        import psutil
        return {"cpu": psutil.cpu_percent(interval=None), "memoria": psutil.virtual_memory().percent,
                "disco_livre_gb": round(psutil.disk_usage(HOME).free / 1e9, 1)}
    except Exception:
        return {"disco_livre_gb": round(shutil.disk_usage(HOME).free / 1e9, 1)}


def list_volumes():
    vols = []
    if sys.platform == "darwin":
        vols = [p for p in glob.glob("/Volumes/*") if os.path.isdir(p)]
    elif sys.platform.startswith("win"):
        vols = [f"{d}:\\" for d in "DEFGHIJKLMNOPQRSTUVWXYZ" if os.path.exists(f"{d}:\\")]
    else:
        user = os.environ.get("USER", "")
        vols = glob.glob(f"/media/{user}/*") + glob.glob("/run/media/*/*")
    return [v for v in vols if os.path.isdir(os.path.join(v, "DCIM"))]


def ingest_file(src, fn, st, origin, src_kind, move=False, dedupe_set=None):
    """Leva um arquivo para a inbox. Devolve 'new', 'dup' ou None."""
    t_ini = time.time()
    h = quick_hash(src, st.st_size)
    with lock:
        if dedupe_set is not None:
            if h in dedupe_set:
                return None             # já tratado nesta inserção
            dedupe_set.add(h)
        if h in seen:
            pid = seen[h]               # repetida: ignorada, mas avisada
            events.append({"type": "dup", "id": pid, "name": fn, "size": st.st_size,
                           "t": st.st_mtime, "card": origin, "src": src_kind})
            state["dups"] += 1
            metricas.append({"pid": pid, "nome": fn, "bytes": st.st_size, "origem": src_kind, "quem": origin, "chegada": time.time(), "dup": True})
            return "dup"
    pid = h[:12]
    day = time.strftime("%Y-%m-%d", time.localtime(st.st_mtime))
    ddir = os.path.join(INBOX, day)
    os.makedirs(ddir, exist_ok=True)
    dst = os.path.join(ddir, f"{pid}_{fn}")
    try:
        if move:
            shutil.move(src, dst)
        else:
            shutil.copy2(src, dst)
    except Exception as ex:
        print("erro ao copiar", fn, ex)
        return None
    thumb = os.path.join(THUMBS, pid + ".jpg")
    if not make_thumb(dst, thumb):
        thumb = dst
    with lock:
        seen[h] = pid
        lib[pid] = {"file": dst, "thumb": thumb}
        meta[pid] = {"o": origin, "s": src_kind, "u": time.time(), **exif_info(dst)}
        save_meta()
        events.append({"type": "photo", "id": pid, "name": fn, "size": st.st_size,
                       "t": st.st_mtime, "card": origin, "src": src_kind, "file": dst, "thumb": thumb,
                       "serie": meta[pid].get("serie", ""), "autor": meta[pid].get("autor", ""), "dono": meta[pid].get("dono", "")})
        state["copied"] += 1
        m = {"pid": pid, "nome": fn, "bytes": st.st_size, "origem": src_kind, "quem": origin, "chegada": time.time(),
             "copia_ms": round((time.time() - t_ini) * 1000, 1)}
        metricas.append(m); metricas_por_pid[pid] = m
    fila_rostos.put((pid, dst, time.time()))
    print(f"  + {fn}  ({st.st_size/1e6:.1f} MB)  via {src_kind} {origin}")
    return "new"


def scan_card(vol):
    name = os.path.basename(vol.rstrip("/\\")) or vol
    state["card"] = name
    new = dup = 0
    for root, _, files in os.walk(os.path.join(vol, "DCIM")):
        for fn in sorted(files):
            if not fn.endswith(EXT) or fn.startswith("._"):
                continue
            src = os.path.join(root, fn)
            try:
                st = os.stat(src)
            except OSError:
                continue
            # espera o arquivo parar de crescer (câmera ainda gravando)
            if time.time() - st.st_mtime < 2:
                continue
            r = ingest_file(src, fn, st, name, "cartao", move=False, dedupe_set=cards.setdefault(vol, set()))
            if r == "new":
                new += 1
            elif r == "dup":
                dup += 1
    if new or dup:
        save_index()
        print(f"cartão {name}: {new} novas, {dup} repetidas ignoradas")


# ---------------------------------------------------------------- FTP --------
# Receptor FTP mínimo (só biblioteca padrão) para o Canon Content Transfer
# Professional e para câmeras com FTP embutido. Modo passivo e ativo, STOR,
# pastas aceitas e ignoradas (tudo cai na inbox por data).

PHOTOGRAPHERS = ["carlos", "marinara", "samuel", "yago", "marcio", "klassius", "sandessa", "dudu"]


def load_ftp_cfg():
    cfg = None
    if os.path.exists(FTPCFG):
        try:
            cfg = json.load(open(FTPCFG))
        except Exception:
            cfg = None
    if not cfg or not cfg.get("users"):
        alphabet = string.ascii_lowercase + string.digits
        for c in "lo01":
            alphabet = alphabet.replace(c, "")
        cfg = {"users": {u: "".join(random.choice(alphabet) for _ in range(8)) for u in PHOTOGRAPHERS}}
        json.dump(cfg, open(FTPCFG, "w"), indent=2)
    return cfg


def pasta_vigiada():
    """ETERNA_PASTA: pasta de um servidor FTP que já existe (ex.: FileZilla Server). Cada foto que termina de chegar
    entra no Eterna como se viesse do próprio FTP do agente. O arquivo original fica onde está."""
    pasta = os.environ.get("ETERNA_PASTA")
    if not pasta:
        return
    if not os.path.isdir(pasta):
        print(f"  Pasta vigiada:     {pasta} não existe"); return
    print(f"  Pasta vigiada:     {pasta}")
    state["pasta"] = pasta
    vistos = {}                                   # caminho -> (tamanho, mtime) já tratado
    tamanhos = {}                                 # caminho -> tamanho da última volta (espera o arquivo parar de crescer)
    for root, _, files in os.walk(pasta):         # o que já estava lá antes de ligar não entra
        for fn in files:
            p = os.path.join(root, fn)
            try:
                st = os.stat(p); vistos[p] = (st.st_size, st.st_mtime)
            except OSError:
                pass
    while True:
        for root, _, files in os.walk(pasta):
            for fn in files:
                if not fn.endswith(EXT):
                    continue
                p = os.path.join(root, fn)
                try:
                    st = os.stat(p)
                except OSError:
                    continue
                chave = (st.st_size, st.st_mtime)
                if vistos.get(p) == chave:
                    continue
                if tamanhos.get(p) != st.st_size or time.time() - st.st_mtime < 0.5:
                    tamanhos[p] = st.st_size; continue           # ainda chegando
                vistos[p] = chave; tamanhos.pop(p, None)
                quem = os.path.basename(root) if root != pasta else "pasta"
                ingest_file(p, fn, st, quem, "ftp")
        time.sleep(0.5)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


class FTPSession(threading.Thread):
    def __init__(self, conn, addr, users):
        super().__init__(daemon=True)
        self.conn, self.addr, self.users = conn, addr, users
        self.user = None
        self.ok = False
        self.cwd = "/"
        self.pasv = None       # socket de escuta (modo passivo)
        self.port_addr = None  # (ip, porta) do modo ativo
        self.rest = 0

    def send(self, line):
        try:
            self.conn.sendall((line + "\r\n").encode("utf-8", "replace"))
        except Exception:
            pass

    def data_conn(self):
        if self.pasv:
            self.pasv.settimeout(20)
            d, _ = self.pasv.accept()
            self.pasv.close()
            self.pasv = None
            return d
        if self.port_addr:
            d = socket.create_connection(self.port_addr, timeout=20)
            self.port_addr = None
            return d
        return None

    def run(self):
        self.send("220 Eterna FTP pronto")
        f = self.conn.makefile("rb")
        try:
            while True:
                raw = f.readline()
                if not raw:
                    break
                line = raw.decode("utf-8", "replace").strip()
                if not line:
                    continue
                parts = line.split(" ", 1)
                cmd = parts[0].upper()
                arg = parts[1] if len(parts) > 1 else ""
                self.handle(cmd, arg)
                if cmd == "QUIT":
                    break
        except Exception as ex:
            print("ftp sessão:", ex)
        finally:
            try:
                self.conn.close()
            except Exception:
                pass

    def handle(self, cmd, arg):
        if cmd == "USER":
            self.user = arg.strip().lower()
            self.send("331 Senha")
            return
        if cmd == "PASS":
            if self.user in self.users and self.users[self.user] == arg:
                self.ok = True
                with lock:
                    state["ftp"]["last_user"] = self.user
                print(f"ftp: {self.user} conectado de {self.addr[0]}")
                self.send("230 Bem-vindo ao Eterna, " + self.user)
            else:
                print(f"ftp: login recusado para '{self.user}' de {self.addr[0]}")
                self.send("530 Usuário ou senha incorretos")
            return
        if cmd == "SYST":
            self.send("215 UNIX Type: L8"); return
        if cmd == "FEAT":
            for l in ("211-Recursos", " UTF8", " PASV", " EPSV", " REST STREAM", "211 Fim"):
                self.send(l)
            return
        if cmd in ("OPTS", "NOOP"):
            self.send("200 OK"); return
        if cmd == "QUIT":
            self.send("221 Até logo"); return
        if not self.ok:
            self.send("530 Faça login"); return
        if cmd in ("PWD", "XPWD"):
            self.send(f'257 "{self.cwd}"'); return
        if cmd in ("CWD", "XCWD"):
            a = arg.strip() or "/"
            self.cwd = a if a.startswith("/") else (self.cwd.rstrip("/") + "/" + a)
            self.send("250 OK"); return
        if cmd in ("CDUP", "XCUP"):
            self.cwd = "/" + "/".join(self.cwd.strip("/").split("/")[:-1])
            self.send("250 OK"); return
        if cmd in ("MKD", "XMKD"):
            self.send(f'257 "{arg}" criada'); return
        if cmd == "TYPE":
            self.send("200 OK"); return
        if cmd == "REST":
            try:
                self.rest = int(arg)
            except Exception:
                self.rest = 0
            self.send("350 OK"); return
        if cmd in ("PASV", "EPSV"):
            if self.pasv:
                self.pasv.close()
            self.pasv = socket.socket()
            self.pasv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.pasv.bind(("0.0.0.0", 0))
            self.pasv.listen(1)
            port = self.pasv.getsockname()[1]
            if cmd == "EPSV":
                self.send(f"229 Modo passivo (|||{port}|)")
            else:
                ip = self.conn.getsockname()[0].replace(".", ",")
                self.send(f"227 Modo passivo ({ip},{port // 256},{port % 256})")
            return
        if cmd == "PORT":
            p = arg.split(",")
            self.port_addr = (".".join(p[:4]), int(p[4]) * 256 + int(p[5]))
            self.send("200 OK"); return
        if cmd == "EPRT":
            p = arg.split("|")
            self.port_addr = (p[2], int(p[3]))
            self.send("200 OK"); return
        if cmd in ("LIST", "NLST", "MLSD"):
            d = self.data_conn()
            self.send("150 Lista")
            if d:
                d.close()
            self.send("226 OK"); return
        if cmd == "SIZE":
            self.send("550 Sem tamanho"); return
        if cmd in ("DELE", "RMD", "RNFR", "RNTO", "RETR"):
            self.send("550 Não permitido"); return
        if cmd == "STOR":
            name = os.path.basename(arg.strip().replace("\\", "/")) or f"foto_{int(time.time())}.jpg"
            d = self.data_conn()
            if not d:
                self.send("425 Abra a conexão de dados (modo passivo)"); return
            self.send("150 Pode enviar")
            tmpdir = os.path.join(FTPTMP, self.user)
            os.makedirs(tmpdir, exist_ok=True)
            tmp = os.path.join(tmpdir, name)
            size = 0
            try:
                with open(tmp, "ab" if self.rest else "wb") as out:
                    while True:
                        chunk = d.recv(256 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        size += len(chunk)
            finally:
                d.close()
            self.rest = 0
            st = os.stat(tmp)
            if name.lower().endswith((".jpg", ".jpeg")):
                r = ingest_file(tmp, name, st, self.user, "ftp", move=True)
                if r:
                    save_index()
                with lock:
                    state["ftp"]["received"] += 1
            else:
                print(f"ftp: {name} recebido ({size/1e6:.1f} MB), não é JPG; guardado em {tmp}")
            self.send(f"226 Recebido {name}")
            return
        self.send("502 Comando não suportado: " + cmd)


def ftp_server():
    cfg = load_ftp_cfg()
    users = cfg["users"]
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    port = None
    for p in (21, 2121):
        try:
            srv.bind(("0.0.0.0", p))
            port = p
            break
        except Exception:
            continue
    if port is None:
        print("FTP: não consegui abrir as portas 21 nem 2121")
        return
    srv.listen(8)
    ip = lan_ip()
    with lock:
        state["ftp"].update({"port": port, "ip": ip, "users": sorted(users)})
    print(f"  FTP ligado em:     {ip}  porta {port}" + ("" if port == 21 else "  (porta 21 pede sudo; use 2121 no app)"))
    print("  usuários do FTP (senhas em ~/Eterna/ftp.json):")
    for u, pw in users.items():
        print(f"     {u:10s} senha {pw}")
    print()
    while True:
        try:
            conn, addr = srv.accept()
            FTPSession(conn, addr, users).start()
        except Exception as ex:
            print("ftp:", ex)


def watcher():
    while True:
        try:
            vols = list_volumes()
            if not vols:
                state["card"] = None
            for v in vols:
                if v not in cards:
                    cards[v] = set()
                    print(f"cartão inserido: {v}")
                scan_card(v)
            for v in list(cards):
                if v not in vols:
                    print(f"cartão removido: {v}")
                    del cards[v]
        except Exception as ex:
            print("watcher:", ex)
        time.sleep(POLL)


# ------------------------------------------------------------ Roverpix -------
# Sincroniza os relatórios da API Roverpix (vendas, pagamentos, fotos) enquanto o
# Eterna não opera sozinho. A chave fica só em ~/Eterna/roverpix.json (nunca vai
# para o site nem para o GitHub). Os dados brutos, que têm dados de clientes,
# ficam em ~/Eterna/roverpix/raw. O app recebe só totais agregados, sem cliente.
import datetime as _dt
from urllib.parse import urlencode

ROVER_CFG = os.path.join(HOME, "roverpix.json")
ROVER_DIR = os.path.join(HOME, "roverpix")
os.makedirs(os.path.join(ROVER_DIR, "raw"), exist_ok=True)
os.makedirs(os.path.join(ROVER_DIR, "agg"), exist_ok=True)
ROVER_DAYS = 30          # janela mantida
ROVER_EVERY = 300        # segundos entre sincronizações
rover = {"status": "sem chave", "last": None, "error": None, "days": 0, "syncing": False}
rover_wake = threading.Event()


def rover_cfg():
    try:
        c = json.load(open(ROVER_CFG))
        if c.get("api_key"):
            c.setdefault("base_url", "https://beta.api.roverpix.com/api/v1")
            return c
    except Exception:
        pass
    return None


def rover_save_cfg(base_url, api_key):
    base_url = (base_url or "https://beta.api.roverpix.com").rstrip("/")
    if not base_url.endswith("/api/v1"):
        base_url += "/api/v1"
    with open(ROVER_CFG, "w") as f:
        json.dump({"base_url": base_url, "api_key": api_key.strip()}, f)
    try:
        os.chmod(ROVER_CFG, 0o600)
    except Exception:
        pass
    rover_wake.set()


def rv_num(v):
    try:
        return float(str(v).replace(",", ".")) if v not in (None, "") else 0.0
    except Exception:
        return 0.0


def rv_get(cfg, route, params):
    q = urlencode(params)
    req = urllib.request.Request(f"{cfg['base_url']}/reports/{route}?{q}",
                                 headers={"ApiKey": cfg["api_key"], "Accept": "application/json",
                                          "User-Agent": "eterna-agente"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def rv_all(cfg, route, day):
    out, page = [], 1
    while True:
        j = rv_get(cfg, route, {"from_date": day, "to_date": day, "per_page": 2000, "page": page})
        if not j.get("success", True):
            raise RuntimeError(f"{route}: resposta sem sucesso")
        out += j.get(route, [])
        pg = j.get("pagination") or {}
        if not pg.get("has_more"):
            return out
        page = pg.get("next_page") or page + 1


def rv_aggregate(day, orders, payments, photos):
    ok = [o for o in orders if str(o.get("status")) != "3" and not o.get("deleted")]
    sold = [o for o in ok if str(o.get("status")) == "1"]
    agg = {"daily": {"approaches": len(ok), "viewed": len(ok), "converted": len(sold), "sales": len(sold),
                     "revenue": round(sum(rv_num(o.get("total")) for o in sold), 2),
                     "prints": sum(int(rv_num(o.get("print_count"))) for o in sold),
                     "reprints": sum(int(rv_num(o.get("re_print_count"))) for o in sold),
                     "photos": len(photos), "photosSold": sum(1 for p in photos if int(rv_num(p.get("order_count"))) > 0),
                     "pax": None},
           "sellers": {}, "payments": {}, "products": {}, "rows": {}, "people": {}}
    for o in ok:
        n = (o.get("vendor_name") or "Site").strip()
        s = agg["sellers"].setdefault(n, {"total": 0, "done": 0, "pending": 0, "discarded": 0, "canceled": 0,
                                          "revenue": 0.0, "photosSold": 0, "prints": 0, "reprints": 0})
        st = str(o.get("status"))
        s["total"] += 1
        if st == "1":
            s["done"] += 1
            s["revenue"] += rv_num(o.get("total"))
            s["photosSold"] += int(rv_num(o.get("sold_photos")))
            s["prints"] += int(rv_num(o.get("print_count")))
            s["reprints"] += int(rv_num(o.get("re_print_count")))
        elif st == "4":
            s["discarded"] += 1
        elif st == "2":
            s["canceled"] += 1
        else:
            s["pending"] += 1
    for o in sold:
        prods = [x.strip() for x in str(o.get("products_in_order") or "").split(";") if x.strip()]
        for pn in prods:
            pr = agg["products"].setdefault(pn, {"units": 0, "revenue": 0.0})
            pr["units"] += 1
            pr["revenue"] += rv_num(o.get("total")) / len(prods)
    for p in payments:
        if str(p.get("status")) not in ("1", "2"):
            continue
        m = (p.get("modality") or "outro").strip()
        pm = agg["payments"].setdefault(m, {"count": 0, "amount": 0.0})
        pm["count"] += 1
        pm["amount"] += rv_num(p.get("value"))
    # fotos por fotógrafo (ou estação de chroma); receita pelo cartão vendido
    card_key, cards, sold_cards = {}, {}, {}
    for p in photos:
        nm = (p.get("photographer_name") or "").strip()
        pdv = (p.get("pdv_name") or "").strip()
        if nm:
            key, human, name = rv_key(nm), True, nm
        else:
            key, human, name = rv_key(pdv or "sem fotógrafo"), False, pdv or "Sem fotógrafo"
        agg["people"].setdefault(key, {"name": name, "human": human, "pdv": pdv})
        r = agg["rows"].setdefault(key, {"photos": 0, "cards": 0, "cardsSold": 0, "photosSold": 0, "revenue": 0.0})
        r["photos"] += 1
        c = p.get("card") or ""
        if c:
            card_key[c] = key
            cards.setdefault(key, set()).add(c)
        if int(rv_num(p.get("order_count"))) > 0:
            r["photosSold"] += 1
            if c:
                sold_cards.setdefault(key, set()).add(c)
    for k, r in agg["rows"].items():
        r["cards"] = len(cards.get(k, ()))
        r["cardsSold"] = len(sold_cards.get(k, ()))
    for o in sold:
        k = card_key.get(o.get("card_code") or "")
        if k:
            agg["rows"][k]["revenue"] += rv_num(o.get("total"))
    # lista de vendas sem dados de cliente (para a tela Lista de vendas)
    pay_by_order = {}
    for p in payments:
        if str(p.get("status")) in ("1", "2"):
            pay_by_order.setdefault(p.get("order_id"), []).append(p.get("modality") or "")
    agg["orders"] = []
    for o in ok:
        st = str(o.get("status"))
        if st not in ("1", "2"):
            continue
        k = card_key.get(o.get("card_code") or "")
        agg["orders"].append({"id": o.get("id"), "time": rv_hhmm(o.get("order_created_at")), "card": o.get("card_code") or "",
                              "vendor": (o.get("vendor_name") or "Site").strip(), "total": round(rv_num(o.get("total")), 2),
                              "status": "paga" if st == "1" else "cancelada", "prints": int(rv_num(o.get("print_count"))),
                              "photos": int(rv_num(o.get("sold_photos"))),
                              "products": [x.strip() for x in str(o.get("products_in_order") or "").split(";") if x.strip()],
                              "pay": sorted(set(pay_by_order.get(o.get("id"), []))) or [m.strip() for m in str(o.get("modality") or "").split(",") if m.strip()][:1],
                              "key": k, "pdv": agg["people"].get(k, {}).get("pdv", "") if k else ""})
    for d in (agg["sellers"], agg["payments"], agg["products"], agg["rows"]):
        for v in d.values():
            for f in ("revenue", "amount"):
                if f in v:
                    v[f] = round(v[f], 2)
    return agg


def rv_hhmm(v):
    try:
        t = _dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if t.tzinfo:
            t = t.astimezone(_dt.timezone(_dt.timedelta(hours=-3)))
        return t.strftime("%H:%M")
    except Exception:
        return ""


def rv_key(name):
    import unicodedata
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    first = "".join(ch for ch in n.split()[0] if ch.isalnum()) if n.split() else "x"
    if "chroma" in n:
        return "chroma" + "".join(ch for ch in n if ch.isdigit())[:2]
    return first or "x"


def rover_sync_day(cfg, day):
    orders = rv_all(cfg, "orders", day)
    payments = rv_all(cfg, "payments", day)
    photos = rv_all(cfg, "photos", day)
    with open(os.path.join(ROVER_DIR, "raw", day + ".json"), "w") as f:
        json.dump({"orders": orders, "payments": payments, "photos": photos}, f)
    agg = rv_aggregate(day, orders, payments, photos)
    with open(os.path.join(ROVER_DIR, "agg", day + ".json"), "w") as f:
        json.dump(agg, f)
    return agg


def rover_loop():
    while True:
        cfg = rover_cfg()
        if not cfg:
            rover["status"] = "sem chave"
        else:
            rover["syncing"] = True
            rover["status"] = "sincronizando"
            try:
                today = _dt.date.today()
                for i in range(ROVER_DAYS - 1, -1, -1):
                    day = (today - _dt.timedelta(days=i)).isoformat()
                    path = os.path.join(ROVER_DIR, "agg", day + ".json")
                    if os.path.exists(path) and i > 1:
                        try:
                            if "orders" not in json.load(open(path)):
                                raw = json.load(open(os.path.join(ROVER_DIR, "raw", day + ".json")))
                                with open(path, "w") as f:
                                    json.dump(rv_aggregate(day, raw["orders"], raw["payments"], raw["photos"]), f)
                        except Exception:
                            pass
                        continue          # dias fechados não mudam
                    rover_sync_day(cfg, day)
                rover["status"] = "ok"
                rover["error"] = None
                rover["last"] = _dt.datetime.now().isoformat(timespec="seconds")
                print(f"roverpix: sincronizado às {rover['last'][11:16]}")
            except urllib.error.HTTPError as ex:
                rover["status"] = "erro"
                rover["error"] = f"HTTP {ex.code}" + (" (chave recusada)" if ex.code in (401, 403) else "")
                print("roverpix:", rover["error"])
            except Exception as ex:
                rover["status"] = "erro"
                rover["error"] = str(ex)[:200]
                print("roverpix:", rover["error"])
            rover["syncing"] = False
        rover["days"] = len([f for f in os.listdir(os.path.join(ROVER_DIR, "agg")) if f.endswith(".json")])
        rover_wake.wait(ROVER_EVERY)
        rover_wake.clear()


def rover_data():
    days = {}
    for fn in sorted(os.listdir(os.path.join(ROVER_DIR, "agg"))):
        if fn.endswith(".json"):
            try:
                days[fn[:-5]] = json.load(open(os.path.join(ROVER_DIR, "agg", fn)))
            except Exception:
                pass
    return {"ok": True, "updated": rover["last"], "status": rover["status"], "error": rover["error"], "days": days}



# ---------- Photoroom: recorte da pessoa e montagem nos fundos de IA ----------
# A chave fica só neste Mac (~/Eterna/photoroom.json, permissão 600). O app pede a montagem,
# o agente chama a API do Photoroom e guarda o resultado em ~/Eterna/fundos-ia.
PR_CFG = os.path.join(HOME, "photoroom.json")
PR_DIR = os.path.join(HOME, "fundos-ia")
BG_DIR = os.path.join(HOME, "fundos")
PR_URL = os.environ.get("ETERNA_PR_URL", "https://image-api.photoroom.com/v2/edit")
pr = {"calls": 0, "cached": 0, "last_error": None, "last_ok": None}
pr_lock = threading.Lock()


def pr_cfg():
    try:
        c = json.load(open(PR_CFG))
        return c if c.get("api_key") else None
    except Exception:
        return None


def pr_save(key):
    with pr_lock:
        pr["last_error"] = None
    with open(PR_CFG, "w") as f:
        json.dump({"api_key": key.strip()}, f)
    try:
        os.chmod(PR_CFG, 0o600)
    except Exception:
        pass


def multipart(fields, files):
    b = "----eterna%d" % int(time.time() * 1000)
    out = []
    for k, v in fields.items():
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n" % (b, k, v)).encode())
    for k, (fn, data, ct) in files.items():
        out.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n" % (b, k, fn, ct)).encode())
        out.append(data)
        out.append(b"\r\n")
    out.append(("--%s--\r\n" % b).encode())
    return b"".join(out), "multipart/form-data; boundary=" + b


def bg_bytes(bg):
    if not re.match(r"^[a-z0-9]{2,40}$", bg or ""):
        raise ValueError("fundo inválido")
    os.makedirs(BG_DIR, exist_ok=True)
    path = os.path.join(BG_DIR, "bg-%s.jpg" % bg)
    if not os.path.exists(path):
        req = urllib.request.Request(APP_ORIGIN + "/img/bg-%s.jpg" % bg, headers={"User-Agent": "eterna-agente"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    return open(path, "rb").read()


def pr_compose(photo, bg, W, H, pad):
    cfg = pr_cfg()
    if not cfg:
        raise RuntimeError("Photoroom não conectado")
    h = hashlib.sha1(photo).hexdigest()[:16]
    tag = hashlib.sha1(json.dumps([W, H, pad], sort_keys=True).encode()).hexdigest()[:6]
    base = "%s_%s_%s" % (h, bg, tag)
    os.makedirs(PR_DIR, exist_ok=True)
    for ext in (".png", ".jpg"):
        if os.path.exists(os.path.join(PR_DIR, base + ext)):
            with pr_lock:
                pr["cached"] += 1
            return base + ext
    fields = {
        "lighting.mode": "ai.auto",
        "shadow.mode": "ai.soft",
        "outputSize": "%dx%d" % (W, H),
        "horizontalAlignment": "center",
        "verticalAlignment": "bottom",
        "export.format": "png",
    }
    for side in ("Top", "Bottom", "Left", "Right"):
        v = int(max(0, pad.get(side.lower(), 0)))
        fields["padding" + side] = "%dpx" % v
    body, ctype = multipart(fields, {"imageFile": ("foto.jpg", photo, "image/jpeg"),
                                     "background.imageFile": ("fundo.jpg", bg_bytes(bg), "image/jpeg")})
    req = urllib.request.Request(PR_URL, data=body, method="POST",
                                 headers={"x-api-key": cfg["api_key"], "Content-Type": ctype,
                                          "Accept": "image/jpeg, application/json", "User-Agent": "eterna-agente"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
            ctype_out = r.headers.get("Content-Type") or ""
    except urllib.error.HTTPError as ex:
        msg = ex.read().decode("utf-8", "ignore")[:300]
        try:
            j = json.loads(msg)
            msg = j.get("detail") or j.get("message") or j.get("error", {}).get("message") or msg
        except Exception:
            pass
        with pr_lock:
            pr["last_error"] = "HTTP %s: %s" % (ex.code, msg)
        raise RuntimeError(pr["last_error"])
    # PNG pode vir com transparência (só o grupo recortado); o app põe o fundo por baixo
    name = base + (".png" if (data[:8] == b"\x89PNG\r\n\x1a\n" or "png" in ctype_out) else ".jpg")
    with open(os.path.join(PR_DIR, name), "wb") as f:
        f.write(data)
    with pr_lock:
        pr["calls"] += 1
        pr["last_ok"] = time.strftime("%H:%M:%S")
        pr["last_error"] = None
    return name


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def js(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def file(self, path):
        try:
            with open(path, "rb") as f:
                data = f.read()
        except Exception:
            return self.js({"error": "not found"}, 404)
        self.send_response(200)
        self.cors()
        self.send_header("Content-Type", "image/png" if path.endswith(".png") else "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/status":
            with lock:
                return self.js({"ok": True, "agent": "eterna-agente", "version": 3, "boot": BOOT, "card": state["card"],
                                "copied": state["copied"], "dups": state["dups"], "events": len(events),
                                "inbox": INBOX, "platform": sys.platform, "ftp": state["ftp"],
                                "rostos": {**rostos, "fila": fila_rostos.qsize()}})
        if u.path == "/events":
            since = int(q.get("since", ["0"])[0])
            with lock:
                evs = events[since:since + 200]
                out = [{k: v for k, v in e.items() if k not in ("file", "thumb")} for e in evs]
                for e, o in zip(evs, out):
                    if e["type"] == "photo":
                        o["thumb"] = f"/thumb/{e['id']}"
                        o["url"] = f"/file/{e['id']}"
                return self.js({"events": out, "next": since + len(evs), "total": len(events)})
        if u.path == "/metricas":
            desde = float(q.get("desde", ["0"])[0] or 0)
            with lock:
                linhas = [dict(m) for m in metricas if m["chegada"] >= desde]
            return self.js({"agora": time.time(), "fila_rostos": fila_rostos.qsize(), "maquina": uso_maquina(), "fotos": linhas})
        if u.path == "/roverpix/status":
            c = rover_cfg()
            return self.js({**{k: v for k, v in rover.items()}, "configured": bool(c), "base_url": c["base_url"] if c else None})
        if u.path == "/roverpix/data":
            return self.js(rover_data())
        if u.path == "/biblioteca":
            # tudo o que já está guardado neste Mac, por dia (o app mostra sem baixar de novo)
            out = []
            with lock:
                items = list(lib.items())
            hoje = time.strftime("%Y-%m-%d")
            ontem = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
            for pid, e in items:
                f = e.get("file") or ""
                try:
                    st = os.stat(f)
                except OSError:
                    continue
                m = meta.get(pid) or {}
                u = m.get("u") or st.st_mtime          # hora em que chegou ao computador
                day = time.strftime("%Y-%m-%d", time.localtime(u))
                if day not in (hoje, ontem):
                    continue                            # a biblioteca mostra só hoje e ontem
                name = os.path.basename(f).split("_", 1)[-1]
                if "serie" not in m and "x" not in m:
                    m = meta.setdefault(pid, {})
                    m.update(exif_info(f))
                    m["x"] = 1          # já lido, mesmo sem EXIF
                    meta_dirty[0] = True
                out.append({"id": pid, "name": name, "day": day, "t": u, "size": st.st_size,
                            "origem": m.get("o") or "", "via": m.get("s") or "",
                            "serie": m.get("serie") or "", "autor": m.get("autor") or "",
                            "dono": m.get("dono") or "", "modelo": m.get("modelo") or ""})
            out.sort(key=lambda x: x["t"])
            if meta_dirty[0]:
                meta_dirty[0] = False
                save_meta()
            return self.js({"fotos": out, "total": len(out), "boot": BOOT})
        if u.path == "/photoroom/status":
            c = pr_cfg()
            with pr_lock:
                return self.js({**pr, "configured": bool(c), "sandbox": bool(c and c["api_key"].startswith("sandbox_"))})
        if u.path.startswith("/photoroom/result/"):
            name = u.path.rsplit("/", 1)[1]
            if not re.match(r"^[0-9a-f]{16}_[a-z0-9]{2,40}_[0-9a-f]{6}\.(jpg|png)$", name):
                return self.js({"error": "not found"}, 404)
            return self.file(os.path.join(PR_DIR, name))
        if u.path.startswith("/thumb/") or u.path.startswith("/file/"):
            pid = u.path.rsplit("/", 1)[1]
            with lock:
                e = lib.get(pid)
            if not e:
                return self.js({"error": "not found"}, 404)
            return self.file(e["thumb"] if u.path.startswith("/thumb/") else e["file"])
        return self.app(u.path)

    def do_POST(self):
        u = urlparse(self.path)
        origin = self.headers.get("Origin") or ""
        if u.path == "/roverpix/config":
            # só o app aberto pelo próprio agente pode trocar a chave
            if origin and not origin.startswith(("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)):
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            except Exception:
                return self.js({"error": "corpo inválido"}, 400)
            key = (body.get("api_key") or "").strip()
            if not key:
                return self.js({"error": "informe a chave"}, 400)
            rover_save_cfg(body.get("base_url"), key)
            return self.js({"ok": True})
        if u.path in ("/photoroom/config", "/photoroom/compose"):
            # só o app aberto pelo próprio agente usa a chave (ninguém de fora gasta os créditos)
            if origin and not origin.startswith(("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)):
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            except Exception:
                return self.js({"error": "corpo inválido"}, 400)
            if u.path == "/photoroom/config":
                key = (body.get("api_key") or "").strip()
                if not key:
                    return self.js({"error": "informe a chave"}, 400)
                pr_save(key)
                return self.js({"ok": True, "sandbox": key.startswith("sandbox_")})
            try:
                if body.get("pid"):
                    with lock:
                        e = lib.get(str(body["pid"]))
                    if not e:
                        return self.js({"error": "foto não encontrada no agente"}, 404)
                    photo = open(e["file"], "rb").read()
                else:
                    b64 = (body.get("image_b64") or "").split(",")[-1]
                    photo = base64.b64decode(b64)
                if not photo or len(photo) > 30 * 1024 * 1024:
                    return self.js({"error": "foto inválida"}, 400)
                name = pr_compose(photo, body.get("bg"), int(body.get("W") or 2000), int(body.get("H") or 1429), body.get("pad") or {})
                return self.js({"ok": True, "url": "/photoroom/result/" + name})
            except Exception as ex:
                return self.js({"error": str(ex)}, 502)
        if u.path == "/roverpix/sync":
            rover_wake.set()
            return self.js({"ok": True})
        if u.path in ("/rostos/buscar", "/rostos/medir"):
            if not rostos["ligado"]:
                return self.js({"error": rostos["motivo"] or "reconhecimento desligado"}, 503)
            try:
                n = int(self.headers.get("Content-Length") or 0)
                if n > 12 * 1024 * 1024:
                    return self.js({"error": "imagem grande demais"}, 413)
                body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            except Exception:
                return self.js({"error": "corpo inválido"}, 400)
            try:
                if u.path == "/rostos/buscar":
                    return self.js(buscar(body.get("imagens") or [], body.get("dias") or 1))
                return self.js(medir(body.get("sessoes") or {}))
            except Exception as ex:
                return self.js({"error": str(ex)}, 500)
        return self.js({"error": "not found"}, 404)

    # O app servido pelo próprio agente: o navegador abre http://127.0.0.1:8765 e
    # conversa com o agente na mesma origem (sem bloqueio de rede local do Chrome).
    def app(self, path):
        if path in ("", "/"):
            path = "/index.html"
        if ".." in path:
            return self.js({"error": "not found"}, 404)
        key = path
        hit = app_cache.get(key)
        if not hit or (path == "/index.html" and time.time() - hit[2] > 60):
            try:
                req = urllib.request.Request(APP_ORIGIN + path + ("?t=%d" % int(time.time()) if path == "/index.html" else ""),
                                             headers={"User-Agent": "eterna-agente"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    data = r.read()
                    ctype = r.headers.get("Content-Type") or mimetypes.guess_type(path)[0] or "application/octet-stream"
                hit = (data, ctype, time.time())
                app_cache[key] = hit
            except Exception as ex:
                if not hit:
                    return self.js({"error": "app indisponível: %s" % ex}, 502)
        data, ctype, _ = hit
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if path == "/index.html" else "max-age=3600")
        self.end_headers()
        self.wfile.write(data)


def main():
    print("Eterna · agente do ponto")
    print(f"  fotos baixadas em: {INBOX}")
    print(f"  abra o Eterna em:  http://127.0.0.1:{PORT}   (mesmo Mac)")
    threading.Thread(target=watcher, daemon=True).start()
    threading.Thread(target=ftp_server, daemon=True).start()
    threading.Thread(target=rover_loop, daemon=True).start()
    threading.Thread(target=rostos_thread, daemon=True).start()
    threading.Thread(target=pasta_vigiada, daemon=True).start()
    print("  Photoroom:         " + ("conectado" + (" (modo de testes)" if (pr_cfg() or {}).get("api_key", "").startswith("sandbox_") else "") if pr_cfg() else "sem chave (configure no Eterna: Fundos de IA)"))
    print("  Roverpix:          " + ("chave configurada, sincronizando a cada 5 min" if rover_cfg() else "sem chave (configure no Eterna: Repositório)"))
    time.sleep(0.4)
    print("  insira o cartão ou mande pelo CTP. Ctrl+C para parar.\n")
    try:
        ThreadingHTTPServer(("0.0.0.0" if os.environ.get("ETERNA_REDE") else "127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
