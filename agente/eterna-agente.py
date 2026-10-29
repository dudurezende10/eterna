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
   apagadas depois de 60 dias (validade da galeria online).

Para outros computadores da rede (checkout, quiosque) usarem este agente:
     ETERNA_REDE=1 python3 eterna-agente.py
Para receber de um servidor FTP que já existe na máquina, vigiando a pasta dele:
     ETERNA_PASTA="C:/FTP/fotos" python3 eterna-agente.py
"""
import hashlib, json, os, shutil, subprocess, sys, threading, time, glob, socket, random, string, sqlite3, base64, queue
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import urllib.request, urllib.error, mimetypes, re, base64

# imagem pequena em bytes mas enorme em pixels não pode fazer o OpenCV reservar gigas de memória
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "40000000")


def _ler_nuvem_env():
    """~/Eterna/nuvem.env (CHAVE=valor por linha, # comenta): liga a nuvem sem mexer no iniciador.
    Só aceita variáveis ETERNA_*; a variável já definida no ambiente vale mais que o arquivo."""
    try:
        with open(os.path.join(os.path.expanduser("~/Eterna"), "nuvem.env"), encoding="utf-8-sig") as f:
            for linha in f:
                k, _, v = linha.strip().partition("=")
                k, v = k.strip(), v.strip().strip('"')
                if k.startswith("ETERNA_") and v and not linha.lstrip().startswith("#"):
                    os.environ.setdefault(k, v)
    except FileNotFoundError:
        pass


_ler_nuvem_env()
MAX_PIXELS = 40_000_000
PORT = int(os.environ.get("ETERNA_PORTA") or 8765)
APP_ORIGIN = os.environ.get("ETERNA_APP_ORIGIN", "https://eterna.photo")
app_cache = {}
HOME = os.path.expanduser("~/Eterna")
# ETERNA_IMPRESSORA: nome da impressora 10x15 ligada neste computador (ex.: DS-RX1). Com ela, o botão Imprimir de
# qualquer posto manda a foto para cá e ela sai aqui, em vez de sair na impressora do navegador de quem clicou.
IMPRESSORA = os.environ.get("ETERNA_IMPRESSORA", "").strip()
# várias DNPs no mesmo servidor: ETERNA_IMPRESSORA="DS-RX1,DS-RX1 (2)". Cada venda sai inteira na primeira livre.
IMPRESSORAS = [x.strip() for x in IMPRESSORA.split(",") if x.strip()]
# Qual terminal imprime em qual DNP (qualquer combinação: 1 para 1, várias para 1 terminal, 1 dividida por vários terminais):
# ETERNA_IMPRESSORA_POSTOS="Caixa 1=DS-RX1|DS-RX1 (2);Caixa 2=DS-RX1 (3);Caixa 3=DS-RX1 (3)". Terminal fora da lista usa
# qualquer impressora livre. Cada venda sai inteira numa impressora só.
# "Caixa 4=local": esse terminal imprime na DNP ligada nele mesmo (o navegador imprime, o servidor não entra).
IMP_POSTOS, IMP_LOCAIS = {}, []
for _x in os.environ.get("ETERNA_IMPRESSORA_POSTOS", "").split(";"):
    _k, _, _v = _x.partition("=")
    if _k.strip() and _v.strip().lower() == "local":
        IMP_LOCAIS.append(_k.strip().lower())
        continue
    _ps = [p.strip() for p in _v.split("|") if p.strip() in IMPRESSORAS]
    if _k.strip() and _ps:
        IMP_POSTOS[_k.strip().lower()] = _ps


def imp_destinos(j):
    return IMP_POSTOS.get((j.get("posto") or "").strip().lower()) or IMPRESSORAS
# ETERNA_ORIGENS: endereços pelos quais os postos abrem este Eterna na rede (ex.: http://192.168.10.218:8765).
# Só eles ganham as rotas que antes eram só do próprio computador (busca de rosto, publicar galeria, vendas).
ORIGENS_REDE = {x.strip().rstrip("/").lower() for x in os.environ.get("ETERNA_ORIGENS", "").split(",") if x.strip()}
ORIGENS_REDE_HOSTS = {urlparse(x).netloc for x in ORIGENS_REDE}
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
        if 0x9003 in ex:
            try:
                tt = time.strptime(txt(ex[0x9003])[:19], "%Y:%m:%d %H:%M:%S")
                out["cap"] = time.mktime(tt)
            except Exception:
                pass
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
METRICAS_ARQ = os.path.join(HOME, "metricas.jsonl")


def metrica_grava(linha):
    try:
        with open(METRICAS_ARQ, "a", encoding="utf8") as f:
            f.write(json.dumps(linha) + "\n")
    except Exception:
        pass


def metricas_carrega(dias=3):
    """Relê as métricas dos últimos dias (para o relatório não perder as fotos de antes de um reinício)."""
    if not os.path.exists(METRICAS_ARQ):
        return
    lim = time.time() - dias * 86400
    try:
        for l in open(METRICAS_ARQ, encoding="utf8"):
            try:
                x = json.loads(l)
            except Exception:
                continue
            if "chegada" in x:
                if x["chegada"] >= lim:
                    metricas.append(x)
                    if not x.get("dup"):
                        metricas_por_pid[x["pid"]] = x
            elif x.get("pid") in metricas_por_pid:
                metricas_por_pid[x["pid"]].update(x)
    except Exception as ex:
        print("métricas antigas não lidas:", ex)
        return
    # v80 (I6): poda o arquivo para os últimos dias, senão cresce sem limite
    try:
        guardar = set(metricas_por_pid)
        tmp = METRICAS_ARQ + ".tmp"
        with open(METRICAS_ARQ, encoding="utf8") as src, open(tmp, "w", encoding="utf8") as out:
            for l in src:
                try:
                    x = json.loads(l)
                except Exception:
                    continue
                if ("chegada" in x and x["chegada"] >= lim) or ("chegada" not in x and x.get("pid") in guardar):
                    out.write(l if l.endswith("\n") else l + "\n")
        os.replace(tmp, METRICAS_ARQ)
    except Exception:
        pass


metricas_carrega()
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


def jpeg_completo(path, size):
    """Foto inteira? JPEG termina no marcador FFD9 (algumas câmeras deixam uns bytes depois dele); PNG no bloco IEND.
    Há fotos PNG com nome .jpeg (exportações do Roverpix). v80 (segurança I2): arquivo que não começa como JPEG nem PNG é recusado."""
    try:
        with open(path, "rb") as f:
            ini = f.read(8)
            f.seek(max(0, size - 4096))
            fim = f.read()
    except OSError:
        return False
    if ini[:2] == b"\xff\xd8":
        return b"\xff\xd9" in fim
    if ini == b"\x89PNG\r\n\x1a\n":
        return b"IEND" in fim[-16:]
    return False


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
RETENCAO_DIAS = 60     # D10: a selfie da galeria online precisa achar as fotos até o dia 60
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


def img_dims(raw):
    """Largura e altura de um JPEG ou PNG lendo só o cabeçalho (None se não reconhecer)."""
    try:
        if raw[:8] == b"\x89PNG\r\n\x1a\n":
            return int.from_bytes(raw[16:20], "big"), int.from_bytes(raw[20:24], "big")
        if raw[:2] == b"\xff\xd8":
            i = 2
            while i + 9 < len(raw):
                if raw[i] != 0xFF:
                    i += 1; continue
                mk = raw[i + 1]
                if mk in (0xD8, 0x01) or 0xD0 <= mk <= 0xD7:
                    i += 2; continue
                ln = int.from_bytes(raw[i + 2:i + 4], "big")
                if mk in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    return int.from_bytes(raw[i + 7:i + 9], "big"), int.from_bytes(raw[i + 5:i + 7], "big")
                i += 2 + ln
    except Exception:
        pass
    return None


def img_aceita(raw):
    """Só JPEG/PNG com até MAX_PIXELS. Outros formatos o OpenCV ainda limita por OPENCV_IO_MAX_IMAGE_PIXELS."""
    d = img_dims(raw)
    return d is None or (d[0] * d[1] <= MAX_PIXELS)


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


def limpar_rostos(db=None):
    """Apaga as leituras de rosto com mais de RETENCAO_DIAS (no início e uma vez por dia, pelo galeria_loop)."""
    db = db or rostos_db()
    lim = time.strftime("%Y-%m-%d", time.localtime(time.time() - RETENCAO_DIAS * 86400))
    db.execute("delete from rosto where dia < ?", (lim,)); db.execute("delete from foto where dia < ?", (lim,)); db.commit()
    with _mat_lock:
        for d in [d for d in _mat if d < lim]:
            _mat.pop(d, None)


def rostos_thread():
    try:
        if os.environ.get("ETERNA_SEM_OPENCV"):
            raise ImportError("ETERNA_SEM_OPENCV")
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
    limpar_rostos(db)
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
                metrica_grava({"pid": pid, "lida": m["lida"], "leitura_ms": m["leitura_ms"], "rostos": m["rostos"], "espera_ms": m["espera_ms"]})
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
        if not img_aceita(raw):
            continue
        try:
            img = cv2.imdecode(np.frombuffer(raw, "uint8"), cv2.IMREAD_COLOR)
        except Exception:
            img = None
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
        nucleos = psutil.cpu_percent(interval=None, percpu=True)
        io = psutil.disk_io_counters(); rede = psutil.net_io_counters(); eu = psutil.Process()
        return {"cpu": round(sum(nucleos) / max(1, len(nucleos)), 1), "cpu_nucleo_max": max(nucleos or [0]), "nucleos": len(nucleos),
                "memoria": psutil.virtual_memory().percent, "memoria_eterna_mb": round(eu.memory_info().rss / 1e6),
                "threads": eu.num_threads(), "disco_livre_gb": round(psutil.disk_usage(HOME).free / 1e9, 1),
                "disco_escrita_b": io.write_bytes if io else None, "disco_leitura_b": io.read_bytes if io else None,
                "disco_ocupado_ms": getattr(io, "busy_time", None) if io else None,
                "rede_rx_b": rede.bytes_recv, "rede_tx_b": rede.bytes_sent, **uso_eterna()}
    except Exception:
        return {"disco_livre_gb": round(shutil.disk_usage(HOME).free / 1e9, 1), **uso_eterna()}


def uso_eterna():
    tam = lambda p: os.path.getsize(p) if os.path.exists(p) else 0
    return {"banco_rostos_mb": round((tam(ROSTOS_DB) + tam(ROSTOS_DB + "-wal")) / 1e6, 1), "iniciado": state["started"],
            "ftp_incompletas": state["ftp"].get("incompletas", 0) + rftp.get("incompletas", 0), "leitores": rostos.get("leitores"),
            **({"nuvem_fila": nuvem["fila"], "nuvem_enviadas": nuvem["enviadas"], "nuvem_bytes": nuvem["bytes"],
                "nuvem_erros": nuvem["erros"], "nuvem_pausada": nuvem["pausada"],
                "nuvem_s3_ok": nuvem.get("s3_ok"), "nuvem_cdn_ok": nuvem.get("cdn_ok")} if nuvem["ligada"] else {})}


PROJECAO_MAX = 200_000   # v80 (segurança I4): a medição aloca n × 512 bytes; acima disso a máquina do ponto engasga


def projecao_busca(n):
    """Mede, nesta máquina, quanto tempo a busca leva com n rostos no índice (ex.: 60 dias de operação).
    v80: só com ETERNA_TESTE_CARGA=1, por POST e no máximo 200 mil rostos (o teste de carga extrapola acima disso)."""
    np = _cv["np"]
    n = max(1000, min(int(n), PROJECAO_MAX))
    M = np.random.default_rng(1).standard_normal((n, 128), dtype="float32")
    M /= np.linalg.norm(M, axis=1, keepdims=True)
    v = M[0].copy(); ts = []
    for _ in range(5):
        t0 = time.time(); s_ = M @ v; np.nonzero(s_ >= LIMITE_TALVEZ); ts.append((time.time() - t0) * 1000)
    del M
    return {"rostos": n, "busca_ms": round(sorted(ts)[2], 1), "memoria_mb": round(n * 512 / 1e6)}


# ---------- Nuvem (plano v85, parte E): vitrine e alta de cada foto num bucket S3 ----------
# Liga com ETERNA_NUVEM=s3 + ETERNA_BUCKET. A credencial vem de um perfil da AWS CLI (ETERNA_AWS_PERFIL), nunca do código.
# O original não sobe (D2). A fila fica em ~/Eterna/nuvem.db: queda de internet ou reinício não perdem nada.
NUVEM = os.environ.get("ETERNA_NUVEM", "")
NUVEM_BUCKET = os.environ.get("ETERNA_BUCKET", "")
NUVEM_PERFIL = os.environ.get("ETERNA_AWS_PERFIL") or None
NUVEM_REGIAO = os.environ.get("ETERNA_AWS_REGIAO", "us-east-2")
NUVEM_ENVIADORES = int(os.environ.get("ETERNA_NUVEM_ENVIADORES") or 4)
NUVEM_DB = os.path.join(HOME, "nuvem.db")
NUVEM_PAUSA = os.path.join(HOME, "nuvem-pausa")   # teste de queda de internet: com este arquivo, nada sobe
ALTA_LADO = 3000
nuvem = {"ligada": False, "motivo": None, "bucket": NUVEM_BUCKET, "regiao": NUVEM_REGIAO, "fila": 0, "enviadas": 0,
         "bytes": 0, "erros": 0, "ultimo_erro": None, "pausada": False, "atraso_s": None}
nuvem_lock = threading.Lock()


def nuvem_db():
    db = sqlite3.connect(NUVEM_DB, timeout=30, check_same_thread=False)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS fila (pid TEXT PRIMARY KEY, arquivo TEXT, entrou REAL, tentativas INTEGER DEFAULT 0,
                  prox REAL DEFAULT 0, feito REAL, bytes INTEGER, md5_alta TEXT, md5_vitrine TEXT, erro TEXT)""")
    return db


def nuvem_enfileira(pid, arquivo):
    if not nuvem["ligada"]:
        return
    with nuvem_lock:
        db = nuvem_db()
        db.execute("INSERT OR IGNORE INTO fila (pid, arquivo, entrou) VALUES (?,?,?)", (pid, arquivo, time.time()))
        db.commit(); db.close()


def nuvem_reenviar():
    """Manda para a nuvem o que chegou antes de ela ser ligada: todas as fotos da biblioteca e as galerias ainda abertas.
    A fila ignora o que já foi (INSERT OR IGNORE), então rodar de novo não duplica."""
    with lock:
        itens = [(pid, e.get("file") or "") for pid, e in lib.items()]
    fotos = 0
    for pid, f in itens:
        if f and os.path.exists(f):
            nuvem_enfileira(pid, f)
            fotos += 1
    gals = 0
    base = getattr(REPO, "base", None)
    for t in (os.listdir(base) if base and os.path.isdir(base) else []):
        m = REPO.ler_manifesto(t) if token_ok(t) else None
        if m and not m.get("encerrada"):
            nuvem_galeria_enfileira(t)
            gals += 1
    return {"ok": True, "fotos": fotos, "galerias": gals}


def lgpd_excluir(pids, tokens, quem="", posto="", sessao=""):
    """O cliente pediu para apagar as fotos dele (LGPD, art. 18): some do disco (foto, miniatura, recorte), do índice,
    dos rostos lidos, da fila e do bucket da nuvem; as galerias são encerradas aqui e na nuvem (que apaga os rostos
    da AWS). A venda continua no registro financeiro, sem as fotos. Fica uma linha em lgpd.log sem dado pessoal."""
    fotos, nuvem_apagadas, falhas = 0, 0, []
    dias, linhas_foto = set(), []
    for pid in pids:
        pid = pid_lib(pid) if pid_ok(pid) else None
        if not pid:
            continue
        with lock:
            e = lib.pop(pid, None)
            hs = [h for h, v in seen.items() if v == pid]
            for h in hs:
                seen.pop(h, None)
                lgpd_excluidas.add(h)
        # o original que a câmera mandou para a pasta vigiada (FTP do servidor) também sai: mesmo nome e mesmo hash
        orig = os.path.basename((e or {}).get("file") or "")[len(pid) + 1:]
        pasta = os.environ.get("ETERNA_PASTA")
        if orig and pasta and os.path.isdir(pasta):
            for raiz, _, nomes in os.walk(pasta):
                if orig in nomes:
                    cand = os.path.join(raiz, orig)
                    try:
                        if quick_hash(cand, os.path.getsize(cand)) in hs:
                            os.remove(cand)
                    except OSError as ex:
                        falhas.append("original: " + str(ex)[:80])
        for f in ((e or {}).get("file"), (e or {}).get("thumb"), os.path.join(RECORTES, pid + ".png")):
            if f and os.path.exists(f):
                try:
                    os.remove(f)
                except OSError as ex:
                    falhas.append(str(ex)[:80])
        try:
            db = rostos_db()
            r = db.execute("select dia from foto where pid=?", (pid,)).fetchone()
            if r:
                dias.add(r[0])
            db.execute("delete from rosto where pid=?", (pid,)); db.execute("delete from foto where pid=?", (pid,)); db.commit(); db.close()
        except Exception as ex:
            falhas.append("rostos: " + str(ex)[:80])
        if nuvem["ligada"]:
            try:
                with nuvem_lock:
                    db = nuvem_db(); db.execute("delete from fila where pid=?", (pid,)); db.commit(); db.close()
                c = _s3_cliente()
                for k in ("alta/%s.jpg" % pid, "vitrine/%s.jpg" % pid):
                    c.delete_object(Bucket=NUVEM_BUCKET, Key=k)
                nuvem_apagadas += 1
            except Exception as ex:
                falhas.append("nuvem: " + str(ex)[:80])
        if e:
            fotos += 1
            nome = os.path.basename(e.get("file") or "")[len(pid) + 1:]
            linhas_foto.append("%s foto apagada a pedido do cliente: %s · pid %s · sessão %s · posto %s · por %s" % (
                time.strftime("%Y-%m-%d %H:%M:%S"), nome or "-", pid, sessao or "-", posto or "-", quem or "-"))
            md = {"pid": pid, "nome": nome, "apagada": time.time(), "motivo": "lgpd", "sessao": sessao or None, "posto": posto or None, "por": quem or None}
            metricas.append(md); metrica_grava(md)
    with _mat_lock:
        for d in dias:
            _mat.pop(d, None)                # a busca por rosto relê o dia sem as fotos apagadas
    with lock:
        save_index()
        try:
            _grava_privado(LGPD_EXCLUIDAS, json.dumps(sorted(lgpd_excluidas)))
        except Exception as ex:
            falhas.append(str(ex)[:80])
    galerias = 0
    for t in tokens:
        if not token_ok(t):
            continue
        with gal_lock:
            m = REPO.ler_manifesto(t)
            if m:
                m["expira"], m["encerrada"], m["lgpd"] = _iso(), True, True
                REPO.salvar_manifesto(t, m)
                galerias += 1
        nuvem_galeria_enfileira(t)            # na nuvem: sai do ar, código curto e rostos apagados
    with open(LGPD_LOG, "a", encoding="utf8") as fh:
        for ln in linhas_foto:
            fh.write(ln + "\n")
        fh.write("%s exclusão a pedido do cliente: %d foto(s), %d na nuvem, %d galeria(s), por %s%s\n" % (
            time.strftime("%Y-%m-%d %H:%M:%S"), fotos, nuvem_apagadas, galerias, quem or "-", (" · falhas: " + "; ".join(falhas)) if falhas else ""))
    print(f"  LGPD: {fotos} foto(s) e {galerias} galeria(s) apagadas a pedido do cliente")
    return {"ok": not falhas, "fotos": fotos, "nuvem": nuvem_apagadas, "galerias": galerias, "falhas": falhas[:5]}


def nuvem_versoes(arquivo, pid):
    """(alta, vitrine) em JPEG na memória. A alta sai sem EXIF de câmera e sem GPS (o OpenCV não grava metadados)."""
    import cv2
    img = cv2.imread(arquivo, cv2.IMREAD_COLOR)            # aplica a orientação do EXIF
    if img is None:
        raise ValueError("não abriu a foto")
    h, w = img.shape[:2]
    k = ALTA_LADO / max(h, w)
    alta = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA) if k < 1 else img
    ok, alta_jpg = cv2.imencode(".jpg", alta, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    vit = os.path.join(HOME, "nuvem-tmp", pid + ".jpg")
    if not ok or not _vitrine(arquivo, None, vit):
        raise ValueError("não gerou as versões")
    with open(vit, "rb") as f:
        vit_jpg = f.read()
    os.remove(vit)
    return alta_jpg.tobytes(), vit_jpg


def nuvem_envia(s3, pid, arquivo):
    alta, vit = nuvem_versoes(arquivo, pid)
    md5s = []
    for chave, corpo in (("alta/%s.jpg" % pid, alta), ("vitrine/%s.jpg" % pid, vit)):
        md5 = hashlib.md5(corpo)
        # Content-MD5: o S3 recusa o envio se o arquivo chegar diferente; o ETag devolvido confirma a integridade
        r = s3.put_object(Bucket=NUVEM_BUCKET, Key=chave, Body=corpo, ContentType="image/jpeg",
                          ContentMD5=base64.b64encode(md5.digest()).decode())
        if r.get("ETag", "").strip('"') != md5.hexdigest():
            raise ValueError("ETag diferente em " + chave)
        md5s.append(md5.hexdigest())
    return len(alta) + len(vit), md5s[0], md5s[1]


def nuvem_loop():
    if NUVEM != "s3":
        nuvem["motivo"] = "desligada (ETERNA_NUVEM)"
        return
    if not NUVEM_BUCKET:
        nuvem["motivo"] = "falta ETERNA_BUCKET"
        return
    try:
        import boto3
        from botocore.config import Config
        sessao = boto3.session.Session(profile_name=NUVEM_PERFIL, region_name=NUVEM_REGIAO)
        s3 = sessao.client("s3", config=Config(retries={"max_attempts": 3, "mode": "standard"},
                                               max_pool_connections=NUVEM_ENVIADORES * 2, connect_timeout=10, read_timeout=60))
        s3.head_bucket(Bucket=NUVEM_BUCKET)
    except Exception as ex:
        nuvem["motivo"] = "não conectou: %s" % str(ex)[:160]
        print("nuvem:", nuvem["motivo"])
        return
    os.makedirs(os.path.join(HOME, "nuvem-tmp"), exist_ok=True)
    nuvem.update(ligada=True, motivo=None)
    db = nuvem_db()
    nuvem["enviadas"], nuvem["bytes"] = db.execute("SELECT COUNT(*), COALESCE(SUM(bytes),0) FROM fila WHERE feito IS NOT NULL").fetchone()
    print(f"  Nuvem:             S3 {NUVEM_BUCKET} ({NUVEM_REGIAO}), {NUVEM_ENVIADORES} envios em paralelo")
    trabalho = queue.Queue()
    em_voo = set()

    def enviador():
        dbw = nuvem_db()
        while True:
            pid, arquivo, entrou, tent = trabalho.get()
            t0 = time.time()
            try:
                n, md5a, md5v = nuvem_envia(s3, pid, arquivo)
                agora = time.time()
                with nuvem_lock:
                    dbw.execute("UPDATE fila SET feito=?, bytes=?, md5_alta=?, md5_vitrine=?, erro=NULL WHERE pid=?", (agora, n, md5a, md5v, pid))
                    dbw.commit()
                nuvem["enviadas"] += 1; nuvem["bytes"] += n; nuvem["atraso_s"] = round(agora - entrou, 1)
                metrica_grava({"pid": pid, "nuvem": agora, "nuvem_ms": round((agora - t0) * 1000, 1), "nuvem_bytes": n,
                               "nuvem_md5": md5a, "nuvem_tentativas": tent + 1})
                m = metricas_por_pid.get(pid)
                if m:
                    m.update(nuvem=agora, nuvem_bytes=n, nuvem_md5=md5a)
            except Exception as ex:
                espera = min(300, 5 * 2 ** min(tent, 6))
                with nuvem_lock:
                    dbw.execute("UPDATE fila SET tentativas=tentativas+1, prox=?, erro=? WHERE pid=?", (time.time() + espera, str(ex)[:200], pid))
                    dbw.commit()
                nuvem["erros"] += 1; nuvem["ultimo_erro"] = time.strftime("%H:%M:%S ") + str(ex)[:160]
            finally:
                em_voo.discard(pid)

    for _ in range(NUVEM_ENVIADORES):
        threading.Thread(target=enviador, daemon=True).start()
    threading.Thread(target=nuvem_saude, daemon=True).start()
    while True:
        try:
            pausada = os.path.exists(NUVEM_PAUSA)
            nuvem["pausada"] = pausada
            nuvem["fila"] = db.execute("SELECT COUNT(*) FROM fila WHERE feito IS NULL").fetchone()[0]
            if not pausada and trabalho.qsize() < NUVEM_ENVIADORES * 2:
                for pid, arquivo, entrou, tent in db.execute(
                        "SELECT pid, arquivo, entrou, tentativas FROM fila WHERE feito IS NULL AND prox <= ? ORDER BY entrou LIMIT 40", (time.time(),)):
                    if pid in em_voo:
                        continue
                    em_voo.add(pid)
                    trabalho.put((pid, arquivo, entrou, tent))
        except Exception as ex:
            nuvem["ultimo_erro"] = time.strftime("%H:%M:%S ") + str(ex)[:160]
        time.sleep(1)


# CloudFront (fotos.eterna.photo): só entrega com link assinado pela chave privada que fica no ponto.
# Se o CloudFront cair, o link de reserva vai direto ao S3 (serviço separado): a galeria troca sozinha.
NUVEM_CDN = os.environ.get("ETERNA_CDN", "")
NUVEM_CDN_CHAVE_ID = os.environ.get("ETERNA_CDN_CHAVE_ID", "")
NUVEM_CDN_PEM = os.path.join(HOME, "cloudfront-privada.pem")
LINK_TTL = 300
_assina = {}


def _s3_cliente():
    if "c" not in _assina:
        import boto3
        from botocore.config import Config
        # endereço regional: o link assinado pelo endereço global (s3.amazonaws.com) é recusado fora da us-east-1
        _assina["c"] = boto3.session.Session(profile_name=NUVEM_PERFIL, region_name=NUVEM_REGIAO).client(
            "s3", endpoint_url="https://s3.%s.amazonaws.com" % NUVEM_REGIAO,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
    return _assina["c"]


def _s3_assinado(chave, ttl=LINK_TTL):
    return _s3_cliente().generate_presigned_url("get_object", Params={"Bucket": NUVEM_BUCKET, "Key": chave}, ExpiresIn=ttl)


def _cdn_assinado(chave, ttl=LINK_TTL):
    if not (NUVEM_CDN and NUVEM_CDN_CHAVE_ID and os.path.exists(NUVEM_CDN_PEM)):
        return None
    if "s" not in _assina:
        from botocore.signers import CloudFrontSigner
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        priv = serialization.load_pem_private_key(open(NUVEM_CDN_PEM, "rb").read(), password=None)
        _assina["s"] = CloudFrontSigner(NUVEM_CDN_CHAVE_ID, lambda msg: priv.sign(msg, padding.PKCS1v15(), hashes.SHA1()))
    from datetime import datetime, timedelta, timezone
    return _assina["s"].generate_presigned_url("https://%s/%s" % (NUVEM_CDN, chave), date_less_than=datetime.now(timezone.utc) + timedelta(seconds=ttl))


# Galeria na nuvem (v85 F): cada galeria publicada aqui também vai para a API da nuvem, que atende o celular do cliente.
# Fila persistente no nuvem.db; o segredo do ponto fica em ~/Eterna/nuvem-segredo.txt (na nuvem só o SHA-256 dele).
NUVEM_API = os.environ.get("ETERNA_GALERIA_API", "").rstrip("/")
NUVEM_SEGREDO = os.path.join(HOME, "nuvem-segredo.txt")


def nuvem_segredo():
    if not os.path.exists(NUVEM_SEGREDO):
        _grava_privado(NUVEM_SEGREDO, secrets.token_urlsafe(32))
    return open(NUVEM_SEGREDO, encoding="utf8").read().strip()


def nuvem_galeria_enfileira(token):
    if not NUVEM_API:
        return
    with nuvem_lock:
        db = nuvem_db()
        db.execute("CREATE TABLE IF NOT EXISTS galerias (token TEXT PRIMARY KEY, prox REAL, tentativas INTEGER, feito REAL, erro TEXT)")
        db.execute("INSERT OR REPLACE INTO galerias (token, prox, tentativas, feito) VALUES (?, 0, 0, NULL)", (token,))
        db.commit(); db.close()
    nuvem_gal_acorda.set()


nuvem_gal_acorda = threading.Event()


def nuvem_galerias_loop():
    """Publica na API da nuvem as galerias da fila; sem internet, tenta de novo com espera crescente."""
    if not NUVEM_API:
        return
    seg = nuvem_segredo()
    print(f"  Galeria na nuvem:  {NUVEM_API}")
    while True:
        try:
            with nuvem_lock:
                db = nuvem_db()
                db.execute("CREATE TABLE IF NOT EXISTS galerias (token TEXT PRIMARY KEY, prox REAL, tentativas INTEGER, feito REAL, erro TEXT)")
                fila = db.execute("SELECT token, tentativas FROM galerias WHERE feito IS NULL AND prox <= ? LIMIT 20", (time.time(),)).fetchall()
                db.close()
            for token, tent in fila:
                m = REPO.ler_manifesto(token)
                erro = None
                if m:
                    try:
                        rq = urllib.request.Request(NUVEM_API + "/ponto/galerias", data=json.dumps({"manifesto": m}).encode(), method="POST",
                                                    headers={"Content-Type": "application/json", "X-Eterna-Ponto": seg, "User-Agent": "eterna-agente"})
                        with urllib.request.urlopen(rq, timeout=20) as r:
                            r.read()
                    except Exception as ex:
                        erro = str(ex)[:200]
                with nuvem_lock:
                    db = nuvem_db()
                    if erro:
                        db.execute("UPDATE galerias SET tentativas=tentativas+1, prox=?, erro=? WHERE token=?",
                                   (time.time() + min(300, 5 * 2 ** min(tent, 6)), erro, token))
                        nuvem["galeria_erro"] = time.strftime("%H:%M:%S ") + erro
                    else:
                        db.execute("UPDATE galerias SET feito=?, erro=NULL WHERE token=?", (time.time(), token))
                        nuvem["galerias_publicadas"] = nuvem.get("galerias_publicadas", 0) + 1
                    db.commit(); db.close()
        except Exception as ex:
            nuvem["galeria_erro"] = time.strftime("%H:%M:%S ") + str(ex)[:160]
        nuvem_gal_acorda.wait(5)
        nuvem_gal_acorda.clear()


def nuvem_tem(pid):
    """A foto já subiu (vitrine e alta conferidas pelo MD5)?"""
    try:
        db = nuvem_db()
        r = db.execute("SELECT feito FROM fila WHERE pid=?", (pid,)).fetchone()
        db.close()
        return bool(r and r[0])
    except Exception:
        return False


def nuvem_link(pid, v):
    """Link temporário (5 min) de uma versão na nuvem: pelo CloudFront quando ligado, com a reserva direto no S3."""
    chave = "%s/%s.jpg" % (v, pid)
    s3 = _s3_assinado(chave)
    return {"url": _cdn_assinado(chave) or s3, "reserva": s3}


def nuvem_saude():
    """Sentinela: a cada 2 min abre um arquivo de teste pelo S3 e pelo CloudFront. Falhou: aviso no console e no status."""
    chave = "saude/ok.txt"
    try:
        _s3_cliente().put_object(Bucket=NUVEM_BUCKET, Key=chave, Body=b"ok", ContentType="text/plain")
    except Exception as ex:
        nuvem["ultimo_erro"] = time.strftime("%H:%M:%S ") + "saúde: " + str(ex)[:120]
    while True:
        for nome, url in (("s3", _s3_assinado(chave, 60)), ("cdn", _cdn_assinado(chave, 60))):
            if not url:
                continue
            try:
                with urllib.request.urlopen(url, timeout=10) as r:
                    ok = r.read() == b"ok"
            except Exception:
                ok = False
            if not ok and nuvem.get(nome + "_ok") is not False:
                print(f"nuvem: {nome.upper()} não respondeu às {time.strftime('%H:%M:%S')}" + (" (a galeria usa o S3)" if nome == "cdn" else ""))
            nuvem[nome + "_ok"] = ok
            nuvem[nome + "_falhas"] = nuvem.get(nome + "_falhas", 0) + (0 if ok else 1)
        nuvem["saude_em"] = time.strftime("%H:%M:%S")
        time.sleep(120)


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


LGPD_EXCLUIDAS = os.path.join(HOME, "lgpd-excluidas.json")   # hashes das fotos apagadas a pedido do cliente
LGPD_LOG = os.path.join(HOME, "lgpd.log")                   # registro de cada exclusão, sem dado pessoal
try:
    lgpd_excluidas = set(json.load(open(LGPD_EXCLUIDAS)))
except Exception:
    lgpd_excluidas = set()


def ingest_file(src, fn, st, origin, src_kind, move=False, dedupe_set=None):
    """Leva um arquivo para a inbox. Devolve 'new', 'dup' ou None."""
    t_ini = time.time()
    h = quick_hash(src, st.st_size)
    if h in lgpd_excluidas:                 # o cliente pediu para apagar: não entra de novo
        if move:
            try:
                os.remove(src)
            except OSError:
                pass
        return None
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
            md = {"pid": pid, "nome": fn, "bytes": st.st_size, "origem": src_kind, "quem": origin, "chegada": time.time(), "dup": True}
            metricas.append(md); metrica_grava(md)
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
    sha = hashlib.sha256()                    # assinatura do arquivo gravado: o teste confere foto a foto se chegou íntegra
    with open(dst, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            sha.update(bloco)
    sha = sha.hexdigest()
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
                       "cap": meta[pid].get("cap", 0), "serie": meta[pid].get("serie", ""), "autor": meta[pid].get("autor", ""), "dono": meta[pid].get("dono", "")})
        state["copied"] += 1
        m = {"pid": pid, "nome": fn, "bytes": st.st_size, "origem": src_kind, "quem": origin, "chegada": time.time(),
             "copia_ms": round((time.time() - t_ini) * 1000, 1), "sha": sha}
        metricas.append(m); metricas_por_pid[pid] = m
    metrica_grava(m)
    fila_rostos.put((pid, dst, time.time()))
    nuvem_enfileira(pid, dst)
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
        # v80 (segurança I7): secrets e 12 caracteres. "compartilhado": logins que podem usar subpasta = fotógrafo
        cfg = {"users": {u: "".join(secrets.choice(alphabet) for _ in range(12)) for u in PHOTOGRAPHERS}, "compartilhado": []}
        with open(FTPCFG, "w") as f:
            json.dump(cfg, f, indent=2)
    try:
        os.chmod(FTPCFG, 0o600)
    except OSError:
        pass
    curtas = [u for u, pw in cfg["users"].items() if len(str(pw)) < 12]
    if curtas:
        print(f"  FTP: {len(curtas)} senha(s) com menos de 12 caracteres em ~/Eterna/ftp.json; troque quando der")
    return cfg


# v80 (segurança I7): 5 senhas erradas seguidas bloqueiam o IP por 15 min
FTP_FALHAS = {}          # ip -> [erros, bloqueado_até]
FTP_MAX_FALHAS, FTP_BLOQUEIO_S = 5, 900


def ftp_bloqueado(ip):
    with lock:
        f = FTP_FALHAS.get(ip)
        return bool(f and f[1] > time.time())


def ftp_falhou(ip):
    with lock:
        f = FTP_FALHAS.setdefault(ip, [0, 0])
        if f[1] and f[1] <= time.time():
            f[0], f[1] = 0, 0
        f[0] += 1
        if f[0] >= FTP_MAX_FALHAS:
            f[1] = time.time() + FTP_BLOQUEIO_S


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
    # O que chegou nas últimas ETERNA_PASTA_RETOMAR horas (padrão 12) entra de novo: foto que a câmera mandou com o
    # Eterna desligado (queda de luz, reinício) não se perde. A que já estava no Eterna cai como repetida (mesmo SHA).
    janela = float(os.environ.get("ETERNA_PASTA_RETOMAR") or 12) * 3600
    for root, _, files in os.walk(pasta):
        for fn in files:
            p = os.path.join(root, fn)
            try:
                st = os.stat(p)
                if time.time() - st.st_mtime > janela or (fn.endswith(EXT) and quick_hash(p, st.st_size) in seen):
                    vistos[p] = (st.st_size, st.st_mtime)          # antiga, ou já está no Eterna: não entra de novo
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
                if not jpeg_completo(p, st.st_size):
                    if time.time() - st.st_mtime < 600:
                        continue                                  # cortada (conexão caiu): espera a câmera mandar de novo
                    print(f"pasta: {fn} continua incompleto depois de 10 min; ignorado")
                    vistos[p] = chave; continue
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
    def __init__(self, conn, addr, users, compartilhado=()):
        super().__init__(daemon=True)
        self.conn, self.addr, self.users = conn, addr, users
        self.compartilhado = {str(x).lower() for x in (compartilhado or ())}
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
            if ftp_bloqueado(self.addr[0]):
                self.ok = False
                self.send("421 Muitas tentativas erradas; tente de novo em 15 minutos")
                return
            if self.user in self.users and hmac.compare_digest(str(self.users[self.user]), arg):
                with lock:
                    FTP_FALHAS.pop(self.addr[0], None)
                self.ok = True
                with lock:
                    state["ftp"]["last_user"] = self.user
                print(f"ftp: {self.user} conectado de {self.addr[0]}")
                self.send("230 Bem-vindo ao Eterna, " + self.user)
            else:
                ftp_falhou(self.addr[0])
                print(f"ftp: login recusado para '{self.user}' de {self.addr[0]}")
                self.send("530 Usuário ou senha incorretos")
            return
        if cmd == "SYST":
            self.send("215 UNIX Type: L8"); return
        if cmd == "FEAT":
            for l in ("211-Recursos", " UTF8", " PASV", " EPSV", "211 Fim"):   # v80 (I2): sem REST STREAM
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
            # v80 (segurança I2): sem retomada; um pedaço solto nunca é emendado em outro arquivo. A câmera manda a foto inteira de novo.
            try:
                n = int(arg)
            except Exception:
                n = -1
            self.rest = 0
            if n == 0:
                self.send("350 OK"); return
            self.send("550 Retomada não suportada; envie o arquivo inteiro"); return
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
            tmp = os.path.join(tmpdir, "%d_%s" % (self.ident, name))
            size = 0
            caiu = False
            try:
                with open(tmp, "wb") as out:
                    while True:
                        chunk = d.recv(256 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        size += len(chunk)
            except OSError:
                caiu = True
            finally:
                d.close()
            self.rest = 0
            st = os.stat(tmp)
            jpg = name.lower().endswith((".jpg", ".jpeg"))
            if jpg and (caiu or not jpeg_completo(tmp, st.st_size)):
                with lock:
                    state["ftp"]["incompletas"] = state["ftp"].get("incompletas", 0) + 1
                print(f"ftp: {name} chegou incompleto ({size/1e6:.1f} MB), recusado; a câmera manda de novo")
                try:
                    os.remove(tmp)
                except OSError:
                    pass
                self.send("426 Transferência incompleta, envie de novo")
                return
            if jpg:
                # v80 (segurança B1): o dono é sempre o login. Subpasta = fotógrafo só para login marcado como "compartilhado"
                # em ~/Eterna/ftp.json e só se a subpasta for um fotógrafo cadastrado (CWD /outro não troca o dono da foto).
                quem = self.user
                sub = self.cwd.strip("/").split("/")[-1].lower()
                if self.user in self.compartilhado and sub and (sub in self.users or sub in PHOTOGRAPHERS):
                    quem = sub
                r = ingest_file(tmp, name, st, quem, "ftp", move=True)
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
    portas = (int(os.environ["ETERNA_FTP_PORTA"]),) if os.environ.get("ETERNA_FTP_PORTA") else (21, 2121)   # ETERNA_FTP_PORTA: testes
    for p in portas:
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
    # v80 (segurança I7): senhas nunca no console nem no log; ficam só em ~/Eterna/ftp.json (chmod 600)
    print("  usuários do FTP: " + ", ".join(sorted(users)) + "  (senhas em ~/Eterna/ftp.json)")
    print()
    while True:
        try:
            conn, addr = srv.accept()
            FTPSession(conn, addr, users, cfg.get("compartilhado") or ()).start()
        except Exception as ex:
            print("ftp:", ex)


# ---------- Servidor FTP do estádio (receptor externo) ----------
# Quando o CTP manda as fotos para um servidor FTP da rede (e não para o FTP embutido neste agente),
# o agente busca ali as fotos novas a cada poucos segundos e coloca na biblioteca. Nada é apagado no servidor.
import ftplib
import unicodedata
RFTP_CFG = os.path.join(HOME, "ftp-remoto.json")
RFTP_SEEN = os.path.join(HOME, "ftp-remoto-vistos.json")
rftp = {"ok": False, "erro": None, "aviso": None, "ultima": None, "baixadas": 0, "na_fila": 0, "checado": None}
rftp_wake = threading.Event()


def rftp_cfg():
    try:
        c = json.load(open(RFTP_CFG))
        return c if c.get("host") and c.get("user") else None
    except Exception:
        return None


def rftp_save(c):
    with open(RFTP_CFG, "w") as f:
        json.dump(c, f)
    try:
        os.chmod(RFTP_CFG, 0o600)
    except Exception:
        pass
    rftp["erro"] = None
    rftp_wake.set()


def rftp_connect(c):
    cls = ftplib.FTP_TLS if c.get("tls") else ftplib.FTP
    f = cls()
    f.connect(c["host"], int(c.get("port") or 21), timeout=20)
    f.login(c["user"], c.get("password") or "")
    if c.get("tls"):
        f.prot_p()
    f.set_pasv(True)
    f.encoding = "utf-8"
    return f


def rftp_list(f, path, depth=0):
    """Lista JPGs (caminho, tamanho) a partir de path, até 3 níveis de pasta."""
    out = []
    try:
        items = list(f.mlsd(path or "/", facts=["type", "size", "modify"]))
        for name, fa in items:
            if name in (".", "..") or "/" in name or "\\" in name:
                continue
            full = (path.rstrip("/") + "/" + name) if path else name
            if fa.get("type") == "dir" and depth < 3:
                out += rftp_list(f, full, depth + 1)
            elif fa.get("type") == "file" and name.lower().endswith((".jpg", ".jpeg")):
                out.append((full, int(fa.get("size") or 0)))
    except ftplib.error_temp:
        return out   # v81: 450 (pasta vazia ou ocupada) = nada nesta volta
    except ftplib.error_perm:
        # servidor sem MLSD (ex.: IIS): NLST; o que não é JPG e não tem extensão é tratado como subpasta (fotógrafo)
        try:
            nomes = f.nlst(path or ".")
        except (ftplib.error_perm, ftplib.error_temp):
            return out   # v81: alguns servidores respondem 450 no NLST de pasta vazia

        for nome in nomes:
            nome = nome.replace("\\", "/")
            full = nome if (not path or nome.startswith(path.rstrip("/") + "/")) else path.rstrip("/") + "/" + nome
            base = full.rsplit("/", 1)[-1]
            if base in (".", "..") or ".." in full.split("/"):
                continue   # v81: nome com /../ vindo do servidor não é seguido nem baixado
            if base.lower().endswith((".jpg", ".jpeg")):
                try:
                    out.append((full, f.size(full) or 0))
                except Exception:
                    out.append((full, 0))   # tamanho desconhecido: rftp_loop não baixa (espera o tamanho real)
            elif "." not in base and depth < 3 and full != path:
                out += rftp_list(f, full, depth + 1)
    return out


def ftp_cadastrados():
    """Fotógrafos cadastrados (PHOTOGRAPHERS + logins do ~/Eterna/ftp.json), em minúsculas. Não cria o arquivo."""
    nomes = set(PHOTOGRAPHERS)
    try:
        nomes |= {str(u).lower() for u in (json.load(open(FTPCFG)).get("users") or {})}
    except Exception:
        pass
    return nomes


def sem_acento(t):
    """minúsculas, sem acento (Márcio = marcio)"""
    return "".join(ch for ch in unicodedata.normalize("NFD", str(t)) if not unicodedata.combining(ch)).lower()


def rftp_origem(path, pasta):
    """v81 (segurança B1): dono da foto do FTP do estádio. A subpasta logo abaixo da pasta configurada (prefixo de
    c["dir"]) só vira o fotógrafo se estiver cadastrada; qualquer outro caso (pasta fora do prefixo, /outro, /../) é "ftp-estadio"."""
    parts = [x for x in str(path).replace("\\", "/").split("/") if x]
    base = [x for x in str(pasta or "").replace("\\", "/").split("/") if x]
    if ".." in parts or "." in parts or parts[:len(base)] != base or len(parts) < len(base) + 2:
        return "ftp-estadio"
    sub = sem_acento(parts[len(base)])
    return sub if sub in {sem_acento(x) for x in ftp_cadastrados()} else "ftp-estadio"


rftp_cortadas = {}      # caminho -> vezes que chegou cortado


def rftp_loop():
    try:
        seen_r = set(json.load(open(RFTP_SEEN)))
    except Exception:
        seen_r = set()
    pend = {}          # caminho -> tamanho visto na volta anterior (espera parar de crescer)
    conn = None
    while True:
        c = rftp_cfg()
        if not c:
            rftp.update(ok=False)
            rftp_wake.wait(10)
            rftp_wake.clear()
            continue
        try:
            if conn is None:
                conn = rftp_connect(c)
            files = rftp_list(conn, c.get("dir") or "")
            rftp.update(ok=True, erro=None, checado=time.strftime("%H:%M:%S"))
            novos = [(p, sz) for p, sz in files if p + "|" + str(sz) not in seen_r]
            rftp["na_fila"] = len(novos)
            got = False
            sem_tam = 0
            for path, sz in novos:
                if not sz:                        # v81: tamanho 0 ou desconhecido (SIZE falhou) não baixa: espera o tamanho real
                    pend.pop(path, None)
                    sem_tam += 1
                    continue
                if pend.get(path) != sz:          # ainda chegando
                    pend[path] = sz
                    continue
                os.makedirs(FTPTMP, exist_ok=True)
                name = os.path.basename(path)
                tmp = os.path.join(FTPTMP, "r_%d_%s" % (int(time.time() * 1000), name))
                with open(tmp, "wb") as out:
                    conn.retrbinary("RETR " + path, out.write)
                st = os.stat(tmp)
                if not jpeg_completo(tmp, st.st_size):    # foto cortada no servidor (câmera caiu no meio): espera o reenvio
                    os.remove(tmp)
                    pend.pop(path, None)
                    rftp["incompletas"] = rftp.get("incompletas", 0) + 1
                    rftp_cortadas[path] = rftp_cortadas.get(path, 0) + 1
                    if rftp_cortadas[path] >= 5:          # continua cortada depois de 5 voltas: não fica baixando para sempre
                        seen_r.add(path + "|" + str(sz))
                        print(f"ftp do estádio: {name} continua incompleta no servidor; ignorada")
                    continue
                origem = rftp_origem(path, c.get("dir") or "")   # subpasta = fotógrafo só se cadastrado (B1)
                r = ingest_file(tmp, name, st, origem, "ftp", move=True)
                if os.path.exists(tmp):
                    os.remove(tmp)
                seen_r.add(path + "|" + str(sz))
                pend.pop(path, None)
                got = True
                if r == "new":
                    rftp["baixadas"] += 1
                    rftp["ultima"] = time.strftime("%H:%M:%S") + " · " + name
                json.dump(sorted(seen_r), open(RFTP_SEEN, "w"))
            # v81: aviso legível no painel do FTP quando o servidor não informa o tamanho (essas fotos esperam)
            rftp["aviso"] = ("servidor não informa o tamanho dos arquivos; %d foto%s aguardando" % (sem_tam, "" if sem_tam == 1 else "s")) if sem_tam else None
            if got:
                save_index()
        except Exception as ex:
            rftp.update(ok=False, erro=str(ex)[:200])
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            conn = None
            rftp_wake.wait(8)
            rftp_wake.clear()
            continue
        rftp_wake.wait(2.5)
        rftp_wake.clear()


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
    # sessões (um cartão = uma sessão): hora da primeira e da última foto, quantas, quantas vendidas
    ses = {}
    for p in photos:
        c = p.get("card") or ""
        if not c:
            continue
        k = card_key.get(c)
        x = ses.setdefault(c, {"card": c, "key": k, "pdv": (p.get("pdv_name") or "").strip(), "n": 0, "sold": 0, "t0": None, "t1": None})
        x["n"] += 1
        if int(rv_num(p.get("order_count"))) > 0:
            x["sold"] += 1
        ts = rv_epoch(p.get("date"))
        if ts:
            x["t0"] = ts if x["t0"] is None or ts < x["t0"] else x["t0"]
            x["t1"] = ts if x["t1"] is None or ts > x["t1"] else x["t1"]
    agg["sessions"] = sorted(ses.values(), key=lambda x: x["t0"] or 0)
    agg["sv"] = 2  # versão do cálculo das sessões; muda → dias antigos são refeitos
    for d in (agg["sellers"], agg["payments"], agg["products"], agg["rows"]):
        for v in d.values():
            for f in ("revenue", "amount"):
                if f in v:
                    v[f] = round(v[f], 2)
    return agg


def rv_epoch(v):
    try:
        t = _dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if not t.tzinfo:
            # a Roverpix grava em UTC sem fuso (fotos de 08h em Brasília chegam como 11h)
            t = t.replace(tzinfo=_dt.timezone.utc)
        return t.timestamp()
    except Exception:
        return None


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
    # grafias da Roverpix que diferem do cadastro do Eterna
    first = {"klacius": "klassius", "classius": "klassius", "clacius": "klassius"}.get(first, first)
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
                            if json.load(open(path)).get("sv") != 2:
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


# v83 (revisão R1): o arquivo de cada fundo vem de um mapa fixo, com os fundos aprovados. Nunca "img/bg-<id>.jpg" direto:
# para o campeao2 esse arquivo é o fundo antigo, com a taça. Prévia (2400 px) e impressão (5000 px, img/fundos-5k/).
# Todos os fundos de DATA.backgrounds (os 5 ativos, com o Pódio de campeão da v86, e os do Laboratório, que podem ser ativados), com o mesmo arquivo do app.
FUNDOS_PREVIA = {"campeao2": "img/bg-campeao-v81.jpg", "mirante": "img/bg-mirantesol.jpg",
                 "arq1950": "img/bg-pb1950.jpg", "tunel": "img/bg-tunel.jpg", "podio": "img/bg-podio.jpg",
                 "imprensa": "img/bg-imprensa.jpg", "noite": "img/bg-noite.jpg", "terraco": "img/bg-terraco.jpg",
                 "campeaoarg": "img/bg-campeaoarg.jpg", "campeaocol": "img/bg-campeaocol.jpg",
                 "gramado1950": "img/bg-gramado1950.jpg", "alto1950": "img/bg-alto1950.jpg",
                 "escanteio1950": "img/bg-escanteio1950.jpg", "asadelta": "img/bg-asadelta.jpg"}
FUNDOS_IMPRESSAO = {"campeao2": "img/fundos-5k/campeao.jpg", "mirante": "img/fundos-5k/mirantesol.jpg",
                    "arq1950": "img/fundos-5k/pb1950.jpg", "tunel": "img/fundos-5k/tunel.jpg",
                    "podio": "img/fundos-5k/podio.jpg"}
PR_LADO_MAX = 5000  # teto de W e H no /photoroom/compose


def bg_arquivo(bg, hi=False):
    """Caminho (relativo ao app) do fundo aprovado; fundo fora do mapa é recusado."""
    if not re.match(r"^[a-z0-9]{2,40}$", bg or ""):
        raise ValueError("fundo inválido")
    # impressão sem arquivo de 5000 px: usa o da prévia (o app registra o aviso fundo_2400)
    rel = (FUNDOS_IMPRESSAO.get(bg) if hi else None) or FUNDOS_PREVIA.get(bg)
    if not rel:
        raise ValueError("fundo não aprovado")
    return rel


def bg_bytes(bg, hi=False):
    rel = bg_arquivo(bg, hi)
    os.makedirs(BG_DIR, exist_ok=True)
    # cache com o nome do arquivo aprovado (o cache antigo "bg-<id>.jpg" pode ser o fundo errado e não é lido)
    path = os.path.join(BG_DIR, "v83-" + rel.replace("/", "_"))
    if not os.path.exists(path):
        req = urllib.request.Request(APP_ORIGIN + "/" + rel, headers={"User-Agent": "eterna-agente"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(path + ".tmp", "wb") as f:
            f.write(data)
        os.replace(path + ".tmp", path)
    return open(path, "rb").read()


def pr_compose(photo, bg, W, H, pad, hi=False, recorte=False):
    """recorte=True: só a pessoa recortada (PNG transparente, sem fundo), posicionada em W×H; o app monta sobre o fundo de 5000 px."""
    if not (0 < W <= PR_LADO_MAX and 0 < H <= PR_LADO_MAX):
        raise ValueError("tamanho acima de %d px" % PR_LADO_MAX)
    rel = bg_arquivo(bg, hi)
    cfg = pr_cfg()
    if not cfg:
        raise RuntimeError("Photoroom não conectado")
    h = hashlib.sha1(photo).hexdigest()[:16]
    # o arquivo do fundo e o modo entram na chave do cache: montagem antiga com o fundo errado não é reaproveitada
    tag = hashlib.sha1(json.dumps([W, H, pad, rel, bool(recorte), "v83"], sort_keys=True).encode()).hexdigest()[:6]
    base = "%s_%s_%s" % (h, bg, tag)
    os.makedirs(PR_DIR, exist_ok=True)
    for ext in (".png", ".jpg"):
        if os.path.exists(os.path.join(PR_DIR, base + ext)):
            with pr_lock:
                pr["cached"] += 1
            return base + ext
    fields = {
        "shadow.mode": "ai.soft",
        "outputSize": "%dx%d" % (W, H),
        "horizontalAlignment": "center",
        "verticalAlignment": "bottom",
        "export.format": "png",
    }
    for side in ("Top", "Bottom", "Left", "Right"):
        v = int(max(0, pad.get(side.lower(), 0)))
        fields["padding" + side] = "%dpx" % v
    files = {"imageFile": ("foto.jpg", photo, "image/jpeg")}
    if recorte:
        fields["background.color"] = "transparent"
    else:
        fields["lighting.mode"] = "ai.auto"
        files["background.imageFile"] = ("fundo.jpg", bg_bytes(bg, hi), "image/jpeg")
    body, ctype = multipart(fields, files)
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


# ---------- v84: recorte local da pessoa (sem Photoroom, sem custo) ----------
# rembg com duas sessões, ISNet (cabelo e bordas finas) e u2net_human_seg (pessoa inteira, com óculos e acessórios);
# a máscara final é o maior valor das duas em cada ponto (docs/fundos-ia-regras.md, regra 12), depois limpa: níveis
# (abaixo de 0,3 some, acima de 0,9 fica cheio), sólida por dentro (taça, bandeira e boné nunca semitransparentes, regra 13),
# só sai mancha pequena e solta, longe do grupo (na dúvida, mantém), e 1 px de borda a menos (sem halo). O PNG leva só a pessoa:
# o RGB fora da máscara é zerado (nada do fundo nem de quem estava ao redor). Lado maior até 3000 px (impressão 10×15) e
# uma cópia de 2400 px para a prévia. Cache em ~/Eterna/recortes/ por até 2 dias (limpar_recortes). A montagem com as
# regras de cada fundo é do app (canvas). Nada é importado no topo: sem rembg o agente segue e a rota responde 503.
RECORTES = os.path.join(HOME, "recortes")
REC_MODELOS = ("isnet-general-use", "u2net_human_seg")
REC_VERSOES = "rembg==2.0.86 onnxruntime==1.29.0"
REC_COMO = "rode agente/instalar-recorte (Mac: instalar-recorte.command; Windows: instalar-recorte.bat): cria ~/Eterna/venv com %s e baixa %s" % (REC_VERSOES, " e ".join(REC_MODELOS))
REC_LADO_MAX = 3000      # maior lado do PNG da impressão
REC_LADOS = (2400, 3000) # 2400 = prévia (cópia reduzida do de 3000, sem rodar os modelos de novo)
REC_TRAB = 1600          # maior lado da imagem entregue aos modelos (eles trabalham em 1024 e 320 px); a máscara volta ao tamanho final
REC_CONC = 2 if os.environ.get("ETERNA_RECORTE_CONC") == "2" else 1   # recortes ao mesmo tempo (1 ou 2): cada um ocupa memória
REC_FILA_MAX = 24
REC_TAXA = 60            # recortes novos por minuto por IP (o cache não conta)
REC_DIAS = 2             # prazo do cache de recortes
REC_TETO_GB = float(os.environ.get("ETERNA_RECORTES_GB") or 5)   # teto do cache: apaga os mais antigos acima disso
REC_ERRO_SEG = 60        # depois de um erro ao abrir os modelos, tenta de novo passado este tempo
rec = {"carregado": False, "erro": None, "erro_em": 0, "feitos": 0, "ms_total": 0, "ms_ultimo": None}
rec_fila = queue.Queue(maxsize=REC_FILA_MAX)
rec_lock = threading.Lock()        # só contadores e estado (o /status nunca espera a carga dos modelos)
rec_carga = threading.Lock()       # abrir os modelos (só as threads de trabalho)
rec_sess = []
rec_threads = []
_re_rec = re.compile(r"^(ag_)?([0-9a-f]{6,40})\.png$")


def rec_modelo(nome):
    """Arquivo do modelo já baixado (rembg 2.0.6x+ em ~/.rembg/models/<nome>/; versões antigas em ~/.u2net/), ou None.
    O agente nunca baixa modelo sozinho: quem baixa é o instalador (instalar-recorte)."""
    novos = os.path.expanduser(os.environ.get("REMBG_HOME") or "~/.rembg")
    antigos = os.path.expanduser(os.environ.get("U2NET_HOME") or "~/.u2net")
    for c in (os.path.join(novos, "models", nome, nome + ".onnx"), os.path.join(antigos, nome + ".onnx")):
        if os.path.isfile(c) and os.path.getsize(c) > 1_000_000:
            return c
    return None


def rec_estado():
    """(ok, motivo): rembg, onnxruntime, Pillow, numpy e scipy instalados, os dois modelos baixados e sem erro recente."""
    if os.environ.get("ETERNA_SEM_RECORTE"):
        return False, "recorte desligado (ETERNA_SEM_RECORTE)"
    import importlib.util
    falta = [m for m in ("rembg", "onnxruntime", "PIL", "numpy", "scipy") if importlib.util.find_spec(m) is None]
    if falta:
        return False, "não instalado: faltam pacotes (" + ", ".join(falta) + ")"
    sem = [n for n in REC_MODELOS if not rec_modelo(n)]
    if sem:
        return False, "não instalado: modelos não baixados (" + ", ".join(sem) + ")"
    with rec_lock:
        if rec["erro"]:
            if time.time() - rec["erro_em"] < REC_ERRO_SEG:
                return False, rec["erro"]
            rec["erro"] = None         # passou o tempo: a próxima foto tenta abrir os modelos de novo
    return True, None


def rec_status():
    ok, motivo = rec_estado()
    with rec_lock:
        n = rec["feitos"]
        return {"ok": ok, "motivo": motivo, "carregado": rec["carregado"], "modelos": list(REC_MODELOS), "fila": rec_fila.qsize(),
                "feitos": n, "ms_medio": int(rec["ms_total"] / n) if n else None, "ms_ultimo": rec["ms_ultimo"], "simultaneos": REC_CONC}


def rec_carregar():
    """Abre as duas sessões uma vez (na thread de trabalho, na primeira foto), fora do rec_lock."""
    if rec_sess:
        return rec_sess
    with rec_carga:
        if rec_sess:
            return rec_sess
        try:
            import onnxruntime as ort
            from rembg import new_session
            so = ort.SessionOptions()
            so.intra_op_num_threads = max(1, (os.cpu_count() or 2) - 1)   # deixa um núcleo para o FTP, os rostos e a tela
            so.enable_cpu_mem_arena = False                                # menos memória presa entre um recorte e outro
            novas = [new_session(n, sess_opts=so, providers=["CPUExecutionProvider"]) for n in REC_MODELOS]
        except Exception as ex:
            with rec_lock:
                rec["erro"] = "erro ao abrir os modelos: %s" % str(ex)[:160]
                rec["erro_em"] = time.time()
            raise
        rec_sess[:] = novas
        with rec_lock:
            rec["carregado"] = True
            rec["erro"] = None
        return rec_sess


def rec_limpa_mascara(masks):
    """Regras 12 e 13: máximo das máscaras (0-255, PIL L do mesmo tamanho) -> níveis 0,3-0,9 -> sólido por dentro -> só sai
    mancha pequena e solta, longe do grupo. Tudo o que está com o convidado (bandeira, boné, óculos, taça) fica sólido."""
    import numpy as np
    from scipy import ndimage
    bruta = np.maximum.reduce([np.asarray(x, dtype=np.float32) / 255.0 for x in masks])   # se uma das duas pega com alfa alto, fica
    m = np.clip((bruta - 0.3) / 0.6, 0.0, 1.0)                 # abaixo de 0,3 vira 0; acima de 0,9 vira 1
    lado = max(m.shape)
    # o que pertence ao grupo: tudo o que tem algum sinal (>= 0,12) e está ligado a um ponto que uma das máscaras pega com
    # alfa alto (>= 0,6). Assim a taça translúcida ou a ponta da bandeira entram inteiras; o que não tem sinal forte, não.
    rot0, n0 = ndimage.label(bruta >= 0.12, structure=np.ones((3, 3), dtype=bool))
    semente = np.zeros(n0 + 1, dtype=bool)
    semente[np.unique(rot0[bruta >= 0.6])] = True
    semente[0] = False
    dentro = semente[rot0]
    m = m * dentro
    buracos = ndimage.binary_fill_holes(dentro) & ~dentro & (bruta >= 0.1)   # furo dentro de objeto (taça translúcida), não o fundo entre braço e corpo
    dentro |= buracos
    # sólido por dentro: só a borda (até 0,2% do lado) fica macia; objeto translúcido (taça, bandeira fina) não fica fantasma
    funda = ndimage.distance_transform_edt(dentro) > max(2.0, 0.002 * lado)
    m[funda | buracos] = 1.0
    rot, n = ndimage.label(dentro, structure=np.ones((3, 3), dtype=bool))
    if n > 1:
        areas = ndimage.sum(np.ones_like(m), rot, index=np.arange(1, n + 1))
        grandes = np.zeros(n + 1, dtype=bool)
        grandes[1:] = areas >= 0.03 * areas.max()             # pedaço grande fica sempre (na dúvida, mantém)
        perto = ndimage.distance_transform_edt(~grandes[rot]) <= max(4.0, 0.015 * lado)
        manter = grandes.copy()
        for k in np.flatnonzero(~grandes[1:]) + 1:            # pequeno só fica se encosta (ou quase) no grupo
            manter[k] = bool(perto[rot == k].any())
        m = m * manter[rot]
    return (m * 255.0 + 0.5).astype(np.uint8)


def rec_arquivo(pid, lado=REC_LADO_MAX):
    return os.path.join(RECORTES, pid + (".png" if lado >= REC_LADO_MAX else "_%d.png" % lado))


def _grava_png(im, destino):
    os.makedirs(RECORTES, exist_ok=True)
    tmp = destino + ".%d.tmp" % threading.get_ident()
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        im.save(f, "PNG", compress_level=3)
    os.replace(tmp, destino)


def rec_fazer(pid, origem, lado=REC_LADO_MAX):
    """Recorta a foto `origem` e grava ~/Eterna/recortes/<pid>.png (3000 px) e, se pedido, <pid>_2400.png. Devolve o caminho."""
    from PIL import Image, ImageOps, ImageFilter
    lado = REC_LADO_MAX if lado not in REC_LADOS else lado
    destino = rec_arquivo(pid, lado)
    if os.path.exists(destino):
        return destino
    cheio = rec_arquivo(pid)
    if not os.path.exists(cheio):
        t0 = time.time()
        sess = rec_carregar()
        with Image.open(origem) as im0:
            if im0.size[0] * im0.size[1] > MAX_PIXELS:
                raise ValueError("imagem acima de %d MP" % (MAX_PIXELS // 1_000_000))
            im = ImageOps.exif_transpose(im0).convert("RGB")   # o navegador mostra a foto já girada pelo EXIF; o PNG não tem EXIF
        if max(im.size) > REC_LADO_MAX:
            im.thumbnail((REC_LADO_MAX, REC_LADO_MAX), Image.LANCZOS)
        trab = im.copy()
        trab.thumbnail((REC_TRAB, REC_TRAB), Image.LANCZOS)
        masks = [s.predict(trab)[0].convert("L") for s in sess]
        del trab
        mascara = Image.fromarray(rec_limpa_mascara(masks), "L")
        if mascara.size != im.size:
            mascara = mascara.resize(im.size, Image.LANCZOS)
        mascara = mascara.filter(ImageFilter.MinFilter(3))       # 1 px de borda a menos: sem halo do fundo
        im = Image.composite(im, Image.new("RGB", im.size), mascara.point(lambda v: 255 if v else 0))   # fora da pessoa, RGB zerado
        im.putalpha(mascara)
        _grava_png(im, cheio)
        ms = int((time.time() - t0) * 1000)
        with rec_lock:
            rec["feitos"] += 1
            rec["ms_total"] += ms
            rec["ms_ultimo"] = ms
    if destino != cheio:
        with Image.open(cheio) as im:
            im = im.copy()
        im.thumbnail((lado, lado), Image.LANCZOS)
        _grava_png(im, destino)
    return destino


def limpar_recortes(agora=None):
    """Uma vez por dia (galeria_loop): apaga recortes com mais de REC_DIAS dias, os de foto que saiu da biblioteca e,
    acima de REC_TETO_GB, os mais antigos. Devolve quantos apagou."""
    agora = agora or time.time()
    try:
        nomes = os.listdir(RECORTES)
    except OSError:
        return 0
    with lock:
        vivas = {pid: e.get("file") for pid, e in lib.items()}
    itens, n = [], 0
    for nome in nomes:
        p = os.path.join(RECORTES, nome)
        try:
            st = os.stat(p)
        except OSError:
            continue
        pid = nome.split(".")[0].split("_")[0]
        fonte = vivas.get(pid)
        if agora - st.st_mtime > REC_DIAS * 86400 or nome.endswith(".tmp") and agora - st.st_mtime > 3600 \
                or not fonte or not os.path.exists(fonte):
            try:
                os.remove(p)
                n += 1
            except OSError:
                pass
        else:
            itens.append((st.st_mtime, st.st_size, p))
    total = sum(x[1] for x in itens)
    for _, tam, p in sorted(itens):
        if total <= REC_TETO_GB * 1024 ** 3:
            break
        try:
            os.remove(p)
            total -= tam
            n += 1
        except OSError:
            pass
    return n


def rec_trabalho():
    while True:
        job = rec_fila.get()
        try:
            job["res"] = rec_fazer(job["pid"], job["file"], job["lado"])
        except Exception as ex:
            job["err"] = str(ex)[:200]
        finally:
            job["ev"].set()


def rec_pedir(pid, origem, lado=REC_LADO_MAX, espera=180):
    """Põe o recorte na fila (1 ou 2 de cada vez) e espera. Devolve (caminho, erro)."""
    with rec_lock:
        while len(rec_threads) < REC_CONC:
            t = threading.Thread(target=rec_trabalho, daemon=True)
            t.start()
            rec_threads.append(t)
    job = {"pid": pid, "file": origem, "lado": lado, "ev": threading.Event()}
    try:
        rec_fila.put_nowait(job)
    except queue.Full:
        return None, "fila_cheia"
    if not job["ev"].wait(espera):
        return None, "tempo"
    return job.get("res"), job.get("err")


# v84 (segurança): o Photoroom só monta quando o interruptor do Painel de controle estiver em "Photoroom" também aqui.
# O app grava o modo pelo loopback (POST /fundos/modo); sem o arquivo, vale "local" e o /photoroom/compose dá 409.
FUNDOS_MODO_CFG = os.path.join(HOME, "fundos-modo.json")


def fundos_modo():
    try:
        with open(FUNDOS_MODO_CFG) as f:
            return "photoroom" if json.load(f).get("modo") == "photoroom" else "local"
    except Exception:
        return "local"


# ---------- Galeria online por QR (fase 1) ----------
# O app cria o token (16 bytes aleatórios, base64url) e publica aqui o manifesto `sessao.json`. O agente faz o
# papel do bucket: guarda originais (só compradas e cortesias) e vitrines (900 px, com marca d'água se houver
# OpenCV), assina os links (HMAC + validade), compara a selfie só com as fotos do token e registra a venda online.
# Armazenamento e pagamento ficam atrás de adaptadores neutros (Repositorio, Pagamento): trocar por S3/Azure e por
# um adquirente real não muda as rotas. A selfie nunca vai para disco nem para log.
import hmac, secrets
GALERIAS = os.path.join(HOME, "galerias")
GAL_SEGREDO = os.path.join(HOME, "galeria-segredo.json")
PAG_CFG = os.path.join(HOME, "pagamento.json")      # chaves do adquirente (fase 2), chmod 600
LIMITE_MENOR = 0.50     # grupo de escola: só as fotos em que o rosto da criança bate (calibrar com fotos de escola)
URL_TTL = 900           # link assinado de foto: 15 min
ACESSO_TTL = 3600       # acesso depois da selfie: 1 h
GAL_MAX_CORPO = 2 * 1024 * 1024
GAL_FALHAS, GAL_BLOQUEIO = 5, 15 * 60
GAL_EVENTO_DISTINTOS, GAL_EVENTO_JANELA = 2, 24 * 3600   # grupo de escola: crianças diferentes por (ip, token) em 24 h
GAL_EVENTO_HORA = 60                                     # acessos por galeria de grupo por hora (todos os IPs)
SEM_OPENCV = bool(os.environ.get("ETERNA_SEM_OPENCV"))
os.makedirs(GALERIAS, exist_ok=True)
_re_token = re.compile(r"^[A-Za-z0-9_-]{22}$")
_re_pid = re.compile(r"^(ag_)?[0-9a-f]{6,40}$")
_re_codigo = re.compile(r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")
_re_sig = re.compile(r"^[0-9a-f]{64}$")
gal_lock = threading.RLock()
gal_fila = queue.Queue()
gal_info = {"vitrine_marca": False}


def token_ok(t):
    return isinstance(t, str) and bool(_re_token.match(t))


def pid_ok(p):
    return isinstance(p, str) and bool(_re_pid.match(p))


def pid_lib(p):
    """id do manifesto (ag_<hex>) -> id da biblioteca do agente (<hex>)."""
    return p[3:] if p.startswith("ag_") else p


def _grava_privado(path, data):
    fd = os.open(path + ".tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(data)
    os.replace(path + ".tmp", path)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


def gal_segredo():
    try:
        s = bytes.fromhex(json.load(open(GAL_SEGREDO))["segredo"])
        if len(s) >= 32:
            return s
    except Exception:
        pass
    s = secrets.token_bytes(32)
    _grava_privado(GAL_SEGREDO, json.dumps({"segredo": s.hex()}))
    return s


SEGREDO = gal_segredo()


def assinar(token, pid, v, exp):
    return hmac.new(SEGREDO, ("%s|%s|%s|%d" % (token, pid, v, exp)).encode(), hashlib.sha256).hexdigest()


class Repositorio:
    """Interface neutra de armazenamento. Fase 1: RepositorioLocal (o agente é o bucket).
    S3:    salvar/subir = put_object; url = generate_presigned_url('get_object', ExpiresIn=ttl); apagar = delete_objects no prefixo.
    Azure: salvar/subir = upload_blob(overwrite=True); url = generate_blob_sas(permission=read, expiry=ttl); apagar = delete_blobs."""
    def salvar_manifesto(self, token, m): raise NotImplementedError
    def ler_manifesto(self, token): raise NotImplementedError
    def subir(self, token, pid, variante, caminho): raise NotImplementedError
    def existe(self, token, pid, variante): raise NotImplementedError
    def url(self, token, pid, variante, ttl): raise NotImplementedError
    def abrir(self, token, pid, variante): raise NotImplementedError
    def apagar(self, token): raise NotImplementedError
    def listar_expiradas(self, agora): raise NotImplementedError


class RepositorioLocal(Repositorio):
    def __init__(self, base):
        self.base = base

    def _dir(self, token):
        if not token_ok(token):
            raise ValueError("token inválido")
        return os.path.join(self.base, token)

    def _arq(self, token, pid, variante):
        if variante not in ("original", "vitrine") or not pid_ok(pid):
            raise ValueError("arquivo inválido")
        return os.path.join(self._dir(token), variante, pid_lib(pid) + ".jpg")

    def salvar_manifesto(self, token, m):
        d = self._dir(token)
        os.makedirs(d, exist_ok=True)
        tmp = os.path.join(d, "sessao.json.tmp")
        with open(tmp, "w") as f:
            json.dump(m, f)
        os.replace(tmp, os.path.join(d, "sessao.json"))

    def ler_manifesto(self, token):
        try:
            with open(os.path.join(self._dir(token), "sessao.json")) as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def subir(self, token, pid, variante, caminho):
        dst = self._arq(token, pid, variante)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(caminho, dst + ".tmp")
        os.replace(dst + ".tmp", dst)

    def existe(self, token, pid, variante):
        try:
            return os.path.exists(self._arq(token, pid, variante))
        except ValueError:
            return False

    def url(self, token, pid, variante, ttl):
        exp = int(time.time()) + int(ttl)
        p = pid_lib(pid)
        return "/g/%s/foto/%s?v=%s&exp=%d&sig=%s" % (token, p, variante, exp, assinar(token, p, variante, exp))

    def abrir(self, token, pid, variante):
        return self._arq(token, pid, variante)

    def apagar(self, token):
        shutil.rmtree(self._dir(token), ignore_errors=True)

    def listar_expiradas(self, agora):
        out = []
        for t in os.listdir(self.base):
            if not token_ok(t):
                continue
            m = self.ler_manifesto(t)
            if m and gal_expirou(m, agora):
                out.append(t)
        return out


def repo_escolhido():
    tipo = (os.environ.get("ETERNA_REPO") or "local").lower()
    if tipo == "local":
        return RepositorioLocal(GALERIAS)
    if tipo in ("s3", "azure"):
        raise NotImplementedError("ETERNA_REPO=%s ainda não implementado (fase 2)" % tipo)
    raise ValueError("ETERNA_REPO desconhecido: %s" % tipo)


REPO = repo_escolhido()


class Pagamento:
    """Interface neutra de pagamento. Fase 1: PagamentoSimulado. Com adquirente real (Mercado Pago, Asaas), a foto só é
    liberada pelo webhook com assinatura validada ou pela consulta, nunca pelo retorno do navegador."""
    def criar(self, pedido): raise NotImplementedError      # -> {id,status,checkout_url,pix_copia_cola,expira}
    def consultar(self, id): raise NotImplementedError
    def webhook(self, corpo, cabecalhos): raise NotImplementedError   # -> {id,status}


class PagamentoSimulado(Pagamento):
    def criar(self, pedido):
        # fase 1: nada é cobrado; a venda fica marcada como teste e o app a tira da receita
        return {"id": "SIM-" + secrets.token_hex(6), "status": "aprovado", "checkout_url": None, "pix_copia_cola": None, "expira": None, "teste": True}

    def consultar(self, id):
        return {"id": id, "status": "aprovado"}

    def webhook(self, corpo, cabecalhos):
        raise NotImplementedError


def pagamento_escolhido():
    tipo = (os.environ.get("ETERNA_PAGAMENTO") or "simulado").lower()
    if tipo == "simulado":
        return PagamentoSimulado()
    raise NotImplementedError("ETERNA_PAGAMENTO=%s ainda não implementado (fase 2; chaves em ~/Eterna/pagamento.json)" % tipo)


PAGAMENTO = pagamento_escolhido()


def _iso(t=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t if t is not None else time.time()))


def _epoch(s):
    try:
        return _dt.datetime.fromisoformat(str(s).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def gal_expirou(m, agora=None):
    return bool(m.get("encerrada")) or _epoch(m.get("expira")) <= (agora if agora is not None else time.time())


def gal_validar(m):
    """Manifesto vindo do app: só os campos conhecidos, com tipos e tamanhos checados."""
    if not isinstance(m, dict) or not token_ok(m.get("token")) or m.get("tipo") not in ("sessao", "evento"):
        raise ValueError("manifesto inválido")
    fotos = []
    for f in (m.get("fotos") or [])[:2000]:
        if not isinstance(f, dict) or not pid_ok(f.get("id")):
            raise ValueError("foto inválida")
        d = f.get("direito") if f.get("direito") in ("comprada", "cortesia", "venda") else "venda"
        x = {"id": f["id"], "sessao": str(f.get("sessao") or "")[:40], "direito": d,
             "canal": f.get("canal") if f.get("canal") in ("loja", "online") else None}
        if d == "cortesia" and isinstance(f.get("cortesia"), dict):
            c = f["cortesia"]
            x["cortesia"] = {"motivo": str(c.get("motivo") or "")[:20], "por": str(c.get("por") or "")[:120], "em": str(c.get("em") or "")[:40]}
        fotos.append(x)
    pr = m.get("precos") or {}
    try:
        precos = {"dig": max(0.0, float(pr.get("dig"))), "todas": max(0.0, float(pr.get("todas")))}
    except Exception:
        raise ValueError("preços inválidos")
    codigo = m.get("codigo") if isinstance(m.get("codigo"), str) and _re_codigo.match(m.get("codigo")) else None
    return {"v": 1, "token": m["token"], "codigo": codigo, "tipo": m["tipo"], "venue": str(m.get("venue") or "")[:40],
            "nome": (str(m["nome"])[:120] if m.get("nome") else None), "sessoes": [str(s)[:40] for s in (m.get("sessoes") or [])[:200]],
            "menor": bool(m.get("menor")), "criada": str(m.get("criada") or _iso())[:40], "expira": str(m.get("expira") or "")[:40],
            "precos": precos, "moeda": "BRL", "fotos": fotos, "envio": {"compradas": "pendente", "vitrine": "pendente"}}


def gal_mesclar(novo, velho):
    """Republicação: comprada nunca regride (nem a da Loja nem a online); a cortesia só sai se a foto não estiver comprada."""
    if not velho:
        return novo
    antes = {f["id"]: f for f in velho.get("fotos") or []}
    for f in novo["fotos"]:
        a = antes.get(f["id"])
        if a and a.get("direito") == "comprada" and f["direito"] != "comprada":
            f["direito"] = "comprada"
            f["canal"] = a.get("canal") or "online"
            f.pop("cortesia", None)
    novo["envio"] = velho.get("envio") or novo["envio"]
    # a validade nunca aumenta por republicação, e "encerrada" só sai por uma ação explícita (que não existe na fase 1)
    if velho.get("expira") and _epoch(velho["expira"]) < _epoch(novo.get("expira")):
        novo["expira"] = velho["expira"]
    if velho.get("encerrada"):
        novo["encerrada"] = True
    return novo


codigos = {}           # código curto -> token (para quem digita o código quando o QR falha)
# Lápides: galerias encerradas ou expiradas que a limpeza diária apagou. Republicar um manifesto antigo desse
# token (outro aparelho, validade original) não pode ressuscitá-la: info dá 410 e o código curto dá 404.
LAPIDES = os.path.join(GALERIAS, "encerradas.json")
lapides = {}


def lapides_ler():
    try:
        d = json.load(open(LAPIDES))
        lapides.update({t: v for t, v in d.items() if token_ok(t) and isinstance(v, dict)})
    except Exception:
        pass


def lapide_gravar(token, m):
    with gal_lock:
        lapides[token] = {"encerrada": True, "motivo": "encerrada" if (m or {}).get("encerrada") else "expirada",
                          "em": _iso(), "codigo": (m or {}).get("codigo")}
        tmp = LAPIDES + ".tmp"
        with open(tmp, "w") as f:
            json.dump(lapides, f)
        os.replace(tmp, LAPIDES)


def gal_indexar():
    lapides_ler()
    for t in os.listdir(GALERIAS):
        if token_ok(t):
            m = REPO.ler_manifesto(t)
            if m and m.get("codigo"):
                codigos[m["codigo"]] = t
            if m and (m.get("envio") or {}).get("vitrine") != "ok" and not gal_expirou(m):
                gal_fila.put(t)


def _vitrine(src_file, src_thumb, dst):
    """Miniatura de 900 px. Com OpenCV, grava a marca d'água; sem ele, a tela põe a sobreposição (.wm).
    Nunca usa o original como vitrine: sem como reduzir, a foto fica 'chegando'."""
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not SEM_OPENCV:
        try:
            import cv2
            img = cv2.imread(src_file, cv2.IMREAD_REDUCED_COLOR_2)
            if img is not None:
                h, w = img.shape[:2]
                k = 900.0 / max(h, w)
                if k < 1:
                    img = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
                h, w = img.shape[:2]
                over = img.copy()
                esc_ = max(0.6, w / 900.0 * 1.1)
                for i, y in enumerate(range(int(h * 0.18), h, max(60, int(h * 0.22)))):
                    x0 = -int(w * 0.15) + (i % 2) * int(w * 0.18)
                    cv2.putText(over, "VIVA MARACANA   VIVA MARACANA", (x0, y), cv2.FONT_HERSHEY_DUPLEX, esc_, (255, 255, 255), max(1, int(esc_ * 2)), cv2.LINE_AA)
                img = cv2.addWeighted(over, 0.35, img, 0.65, 0)
                cv2.imwrite(dst + ".tmp.jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                os.replace(dst + ".tmp.jpg", dst)
                gal_info["vitrine_marca"] = True
                return True
        except Exception:
            pass
    if src_thumb and src_thumb != src_file and os.path.exists(src_thumb):
        shutil.copyfile(src_thumb, dst)
        return True
    if make_thumb(src_file, dst + ".tmp.jpg"):
        os.replace(dst + ".tmp.jpg", dst)
        return True
    return False


def gal_processar(token):
    """Primeiro os originais das compradas e cortesias, depois as vitrines de todas."""
    with gal_lock:
        m = REPO.ler_manifesto(token)
    if not m:
        return
    falta_orig = falta_vit = 0
    for f in m["fotos"]:
        if f["direito"] in ("comprada", "cortesia") and not REPO.existe(token, f["id"], "original"):
            with lock:
                e = lib.get(pid_lib(f["id"]))
            if e and os.path.exists(e["file"]):
                REPO.subir(token, f["id"], "original", e["file"])
            else:
                falta_orig += 1
    for f in m["fotos"]:
        if not REPO.existe(token, f["id"], "vitrine"):
            with lock:
                e = lib.get(pid_lib(f["id"]))
            if not (e and os.path.exists(e["file"]) and _vitrine(e["file"], e.get("thumb"), REPO.abrir(token, f["id"], "vitrine"))):
                falta_vit += 1
    with gal_lock:
        m = REPO.ler_manifesto(token) or m
        m["envio"] = {"compradas": "ok" if not falta_orig else "pendente", "vitrine": "ok" if not falta_vit else "pendente"}
        REPO.salvar_manifesto(token, m)


def galeria_loop():
    ultima_limpeza = 0
    while True:
        try:
            token = gal_fila.get(timeout=600)
            try:
                gal_processar(token)
            except Exception as ex:
                print("  galeria: erro ao preparar", token[:8], ex)
        except queue.Empty:
            pass
        if time.time() - ultima_limpeza > 86400:
            ultima_limpeza = time.time()
            if rostos["ligado"]:
                try:
                    limpar_rostos()
                except Exception as ex:
                    print("  rostos: erro na limpeza", ex)
            try:
                limpar_recortes()
            except Exception as ex:
                print("  recortes: erro na limpeza", ex)
            try:
                for t in REPO.listar_expiradas(time.time()):
                    lapide_gravar(t, REPO.ler_manifesto(t))   # antes de apagar: o token nunca mais reabre
                    REPO.apagar(t)          # os originais em ~/Eterna/inbox continuam guardados
                    for c, tk in list(codigos.items()):
                        if tk == t:
                            codigos.pop(c, None)
            except Exception as ex:
                print("  galeria: erro na limpeza", ex)


def buscar_em(imagens, pids):
    """Como buscar(), mas só compara com as fotos do token: {rosto, sims:{pid:max}} ou {processando:True}."""
    np = _cv["np"]; cv2 = _cv["cv2"]
    db = rostos_db()
    ps = [pid_lib(p) for p in pids]
    lidas = set()
    for i in range(0, len(ps), 500):
        q = ps[i:i + 500]
        lidas |= {r[0] for r in db.execute("select pid from foto where pid in (%s)" % ",".join("?" * len(q)), q)}
    if not lidas:
        return {"processando": True}
    with _busca_lock:
        if not _busca["m"]:
            _busca["m"] = leitor()
        det, rec = _busca["m"]
        vs = []
        for b in imagens[:1]:
            raw = base64.b64decode(b.split(",", 1)[-1])
            if not img_aceita(raw):
                continue
            try:
                img = cv2.imdecode(np.frombuffer(raw, "uint8"), cv2.IMREAD_COLOR)
            except Exception:
                img = None
            del raw
            if img is None:
                continue
            fs = ler_rostos(img, det, rec, minimo=60)
            del img
            if fs:
                vs.append(fs[0][1])
    del imagens
    if not vs:
        return {"rosto": False, "sims": {}}
    me = vs[0]
    sims = {}
    for i in range(0, len(ps), 500):
        q = ps[i:i + 500]
        for pid, emb in db.execute("select pid, emb from rosto where pid in (%s)" % ",".join("?" * len(q)), q):
            s_ = float(np.frombuffer(emb, "float32") @ me)
            if s_ > sims.get(pid, -1):
                sims[pid] = s_
    return {"rosto": True, "sims": sims}


acessos = {}           # acesso -> {token, pids, exp}   (só em memória)
_evento_acertos = {}   # (ip, token) -> [(conjunto de pids, instante)]
_evento_hora = {}      # token -> [instantes dos acessos]
_falhas = {}           # (ip, token) -> [n, bloqueado_ate]
_janelas = {}          # (ip, rota) -> [instantes]
vendas_lock = threading.Lock()
VENDAS = os.path.join(GALERIAS, "vendas-online.jsonl")
CONSENT = os.path.join(GALERIAS, "consentimentos.jsonl")


def limite_ok(ip, rota, n, janela=60):
    agora = time.time()
    with gal_lock:
        l = [t for t in _janelas.get((ip, rota), []) if agora - t < janela]
        ok = len(l) < n
        if ok:
            l.append(agora)
        _janelas[(ip, rota)] = l
        if len(_janelas) > 5000:
            for k in [k for k, v in _janelas.items() if not v or agora - v[-1] > janela]:
                _janelas.pop(k, None)
    return ok


def bloqueio(ip, token):
    with gal_lock:
        f = _falhas.get((ip, token))
        return f[1] if f and f[1] > time.time() else 0


def falhou(ip, token):
    with gal_lock:
        f = _falhas.setdefault((ip, token), [0, 0])
        f[0] += 1
        if f[0] >= GAL_FALHAS:
            f[0], f[1] = 0, time.time() + GAL_BLOQUEIO
            return 0
        return GAL_FALHAS - f[0]


def evento_permite(ip, token, pids):
    """Grupo de escola: o mesmo IP abre no máximo GAL_EVENTO_DISTINTOS crianças diferentes por galeria em 24 h
    (quem já abriu as fotos de uma criança pode tentar o rosto de outra recortado da vitrine), e cada galeria aceita
    no máximo GAL_EVENTO_HORA acessos por hora. Devolve 0 (pode) ou o instante em que libera."""
    agora = time.time()
    with gal_lock:
        hs = [t for t in _evento_hora.get(token, []) if agora - t < 3600]
        _evento_hora[token] = hs
        if len(hs) >= GAL_EVENTO_HORA:
            return hs[0] + 3600
        l = [(s, t) for s, t in _evento_acertos.get((ip, token), []) if agora - t < GAL_EVENTO_JANELA]
        _evento_acertos[(ip, token)] = l
        mesma = any(s & pids for s, _ in l)
        if not mesma and len(l) >= GAL_EVENTO_DISTINTOS:
            return min(t for _, t in l) + GAL_EVENTO_JANELA
        l.append((frozenset(pids), agora))
        hs.append(agora)
        return 0


def galeria_obj(token, m, pids):
    fotos = []
    for f in m["fotos"]:
        if f["id"] not in pids:
            continue
        tem = REPO.existe(token, f["id"], "vitrine")
        livre = f["direito"] in ("comprada", "cortesia")
        fotos.append({"pid": f["id"], "direito": f["direito"],
                      "vitrine": REPO.url(token, f["id"], "vitrine", URL_TTL) if tem else None,
                      "original": REPO.url(token, f["id"], "original", URL_TTL) if livre and REPO.existe(token, f["id"], "original") else None,
                      "chegando": not tem})
    return {"tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"], "estado": gal_estado(token, m),
            "precos": m["precos"], "fotos": fotos}


def gal_estado(token, m):
    return "pronta" if any(REPO.existe(token, f["id"], "vitrine") for f in m["fotos"]) else "chegando"


def acesso_de(token, acesso):
    a = acessos.get(acesso) if isinstance(acesso, str) else None
    if not a or a["token"] != token or a["exp"] < time.time():
        return None
    return a


def vendas_ler():
    out = []
    try:
        with open(VENDAS) as f:
            for l in f:
                try:
                    out.append(json.loads(l))
                except ValueError:
                    pass
    except OSError:
        pass
    return out


def anexar(path, obj):
    with vendas_lock:
        with open(path, "a") as f:
            f.write(json.dumps(obj) + "\n")


HOSTS_OK = {"127.0.0.1:%d" % PORT, "localhost:%d" % PORT}
if os.environ.get("ETERNA_REDE"):
    HOSTS_OK.add("%s:%d" % (lan_ip(), PORT))


IMP_MAX_CORPO = 60 * 1024 * 1024
IMP_DIR = os.path.join(HOME, "impressao")
# Imprime cada JPEG numa folha 10x15 da impressora do servidor, sem margem e preenchendo a folha (corta o excesso,
# como a DNP faz). Usa o .NET do próprio Windows (System.Drawing), sem programa extra.
IMP_PS1 = r"""
param([string]$Impressora, [string[]]$Arquivos)
Add-Type -AssemblyName System.Drawing
# Uma foto por trabalho, e a próxima só depois que a anterior saiu da fila e a impressora voltou a ficar livre:
# a DS-RX1 descartava o que chegava enquanto imprimia (vários trabalhos seguidos ou várias páginas no mesmo trabalho).
function Espera-Livre {
  $fim = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $fim) {
    $fila = @(Get-PrintJob -PrinterName $Impressora -ErrorAction SilentlyContinue).Count
    $st = (Get-CimInstance Win32_Printer -Filter ("Name='" + $Impressora + "'")).PrinterStatus
    if ($fila -eq 0 -and $st -ne 4) { return }
    Start-Sleep -Milliseconds 500
  }
}
$erros = @()
foreach ($f in $Arquivos) {
  try {
    Espera-Livre
    $img = [System.Drawing.Image]::FromFile($f)
    if ($img.Width -gt $img.Height) { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $Impressora
    if (-not $doc.PrinterSettings.IsValid) { throw "impressora '$Impressora' não encontrada" }
    $doc.DocumentName = "Eterna " + [IO.Path]::GetFileNameWithoutExtension($f)
    $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $a=[Math]::Min($_.Width,$_.Height); $b=[Math]::Max($_.Width,$_.Height); $a -ge 395 -and $a -le 420 -and $b -ge 595 -and $b -le 625 } | Select-Object -First 1
    if ($ps) { $doc.DefaultPageSettings.PaperSize = $ps }
    $doc.DefaultPageSettings.Landscape = $false
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
    $doc.OriginAtMargins = $false
    $doc.add_PrintPage({ param($s, $e)
      $g = $e.Graphics
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $pb = $e.PageBounds
      $hx = $e.PageSettings.HardMarginX; $hy = $e.PageSettings.HardMarginY
      $r = [Math]::Max($pb.Width / $img.Width, $pb.Height / $img.Height)
      $w = $img.Width * $r; $h = $img.Height * $r
      $g.DrawImage($img, [single](($pb.Width - $w) / 2 - $hx), [single](($pb.Height - $h) / 2 - $hy), [single]$w, [single]$h)
      $e.HasMorePages = $false })
    $doc.Print()
    $img.Dispose()
    Write-Output ("FOTO " + [IO.Path]::GetFileName($f) + " " + (Get-Date -Format HH:mm:ss))
  } catch { $erros += ([IO.Path]::GetFileName($f) + ": " + $_.Exception.Message) }
}
Espera-Livre
if ($erros.Count) { Write-Output ("ERRO " + ($erros -join " | ")); exit 1 }
Write-Output "OK"
"""


imp_fila = []            # pedidos de impressão (memória): o painel da fila lê daqui
imp_seq = [0]


IMP_FILA = os.path.join(HOME, "impressao", "fila.json")


def imp_salvar():
    """Grava a fila em disco (chamada com `lock`): se o servidor reiniciar, o que faltava imprimir continua."""
    try:
        os.makedirs(os.path.dirname(IMP_FILA), exist_ok=True)
        tmp = IMP_FILA + ".tmp"
        with open(tmp, "w", encoding="utf8") as fh:
            json.dump({"seq": imp_seq[0], "pedidos": imp_fila}, fh)
        os.replace(tmp, IMP_FILA)
    except Exception as ex:
        print("  fila de impressão: não gravou:", ex)


def imp_pedido(venda, vendedor, posto, arqs):
    with lock:
        imp_seq[0] += 1
        j = {"id": imp_seq[0], "venda": venda or "-", "vendedor": vendedor or "", "posto": posto or "", "fotos": len(arqs), "feitas": 0,
             "estado": "na_fila", "criado": time.time(), "inicio": None, "fim": None, "erro": None, "arquivos": arqs}
        imp_fila.append(j)
        del imp_fila[:-200]
        imp_salvar()
    return j


def imp_retomar():
    """Na partida: pedidos que estavam na fila ou imprimindo quando o servidor caiu voltam para a fila,
    a partir da foto que ainda não tinha ido para a impressora."""
    try:
        d = json.load(open(IMP_FILA, encoding="utf8"))
    except Exception:
        return
    ps1 = imp_ps1()
    voltam = []
    with lock:
        imp_seq[0] = max(imp_seq[0], int(d.get("seq") or 0))
        for j in d.get("pedidos") or []:
            if j.get("estado") in ("na_fila", "imprimindo"):
                j["estado"], j["retomado"] = "na_fila", True
                voltam.append(j)
            imp_fila.append(j)
        imp_salvar()
    for j in sorted(voltam, key=lambda x: x["id"]):
        threading.Thread(target=imprimir_fila, args=(ps1, j.get("arquivos") or [], j["venda"], {"kb": 0}, j), daemon=True).start()
    if voltam:
        print(f"  Fila de impressão: {len(voltam)} pedido(s) retomado(s) depois do reinício")


def imp_ps1():
    os.makedirs(IMP_DIR, exist_ok=True)
    ps1 = os.path.join(IMP_DIR, "imprimir.ps1")
    with open(ps1, "w", encoding="utf-8-sig") as fh:
        fh.write(IMP_PS1)
    return ps1


def imp_fila_json():
    agora = time.time()
    with lock:
        jobs = [{k: v for k, v in j.items() if k != "arquivos"} for j in imp_fila
                if j["estado"] in ("na_fila", "imprimindo") or agora - (j["fim"] or agora) < 3 * 3600]
    return {"ok": True, "impressora": IMPRESSORA or None, "impressoras": IMPRESSORAS,
            "postos": {k: v for k, v in IMP_POSTOS.items()}, "agora": agora, "pedidos": jobs}


def imprimir(imagens, venda, vendedor="", posto=""):
    """Recebe as fotos já montadas pelo app (JPEG em base64) e manda cada uma para a impressora deste servidor."""
    if not isinstance(imagens, list) or not imagens or len(imagens) > 20:
        return {"ok": False, "error": "nenhuma foto (ou mais de 20)"}
    t0 = time.time()
    os.makedirs(IMP_DIR, exist_ok=True)
    tag = time.strftime("%Y%m%d-%H%M%S") + "_" + re.sub(r"[^A-Za-z0-9-]", "", venda)[:20]
    arqs = []
    for i, im in enumerate(imagens):
        try:
            b = base64.b64decode(str(im).split(",", 1)[-1])
        except Exception:
            return {"ok": False, "error": "foto %d inválida" % (i + 1)}
        if b[:3] != b"\xff\xd8\xff":
            return {"ok": False, "error": "foto %d não é JPEG" % (i + 1)}
        f = os.path.join(IMP_DIR, "%s_%d.jpg" % (tag, i + 1))
        with open(f, "wb") as fh:
            fh.write(b)
        arqs.append(f)
    ps1 = imp_ps1()
    ms = {"gravar_ms": round((time.time() - t0) * 1000), "spooler_ms": 0, "kb": round(sum(os.path.getsize(a) for a in arqs) / 1024)}
    job = imp_pedido(venda, vendedor, posto, arqs)
    threading.Thread(target=imprimir_fila, args=(ps1, arqs, venda, ms, job), daemon=True).start()
    with lock:
        frente = sum(1 for j in imp_fila if j["estado"] in ("na_fila", "imprimindo") and j["id"] < job["id"])
    return {"ok": True, "fotos": len(arqs), "impressora": IMPRESSORA, "pedido": job["id"], "na_frente": frente, **ms}


imp_ocupadas = set()       # impressoras imprimindo agora


def imprimir_fila(ps1, arqs, venda, ms, job):
    """Em segundo plano, na ordem de chegada: cada venda vai inteira para a primeira impressora livre (as fotos do cliente
    saem juntas, na mesma DNP), e cada DNP imprime uma foto de cada vez (12 a 15 s cada). O PowerShell avisa cada foto
    entregue (linha FOTO), e o painel da fila acompanha."""
    while True:            # vez deste pedido: nenhum anterior esperando, e uma impressora livre
        with lock:
            meus = imp_destinos(job)                       # impressoras deste terminal (ou todas)
            # ordem de chegada: só espera os pedidos anteriores que disputam alguma das mesmas impressoras
            antes = [j for j in imp_fila if j["id"] < job["id"] and j["estado"] == "na_fila" and set(imp_destinos(j)) & set(meus)]
            livres = [p for p in meus if p not in imp_ocupadas]
            if not antes and livres:
                imp = livres[0]
                imp_ocupadas.add(imp)
                t1 = time.time()
                job["estado"], job["inicio"], job["impressora"] = "imprimindo", t1, imp
                arqs = [a for a in (job.get("arquivos") or arqs)[job["feitas"]:] if os.path.exists(a)]   # retomado: só o que faltava
                imp_salvar()
                break
        time.sleep(0.5)
    try:
        if os.environ.get("ETERNA_IMPRESSORA_TESTE"):       # sem impressora: simula a DNP (6 s por foto) para ver a fila andar
            for _ in arqs:
                time.sleep(6)
                with lock:
                    job["feitas"] += 1
                    imp_salvar()
            ok, saida = True, "teste, sem DNP"
        else:
            linhas = []
            try:
                pr = subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Impressora", imp,
                                       "-Arquivos"] + arqs, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                for ln in pr.stdout:
                    ln = ln.strip()
                    if not ln:
                        continue
                    linhas.append(ln)
                    if ln.startswith("FOTO"):
                        with lock:
                            job["feitas"] += 1
                            imp_salvar()
                pr.wait(timeout=120 + 90 * len(arqs))
                saida = " ".join(" ".join(linhas).split())
                ok = pr.returncode == 0 and linhas and linhas[-1].startswith("OK")
            except Exception as ex:
                saida, ok = "ERRO " + str(ex), False
        with lock:
            job["estado"], job["fim"] = ("impresso" if ok else "erro"), time.time()
            if not ok:
                job["erro"] = saida[-200:]
            imp_salvar()
        print(f"  impressão {venda or '-'}: {len(arqs)} foto(s) em {imp}, {ms.get('kb', 0)} KB, "
              f"{time.time() - t1:.0f} s até a DNP terminar -> {saida[:300]}")
    finally:
        with lock:
            imp_ocupadas.discard(imp)


def rota_privada(path):
    """Rotas que expõem fotos, o índice de rostos ou o faturamento da Roverpix: sem CORS aberto.
    v80: /roverpix/* (vendas, vendedores, códigos de cartão), /metricas, /ftp-remoto/* e /photoroom/status só para a origem
    do agente e ETERNA_APP_ORIGIN."""
    return path in ("/biblioteca", "/metricas", "/photoroom/status", "/recorte") or path.startswith(("/thumb/", "/file/", "/rostos/", "/roverpix/", "/ftp-remoto/", "/nuvem/", "/recorte/"))


class H(BaseHTTPRequestHandler):
    timeout = 20            # conexão que declara corpo e não manda não prende uma thread para sempre

    def log_message(self, *a):
        pass

    def origens_ok(self, path):
        locais = ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)
        if path.startswith("/rostos/"):
            return locais
        return locais + (APP_ORIGIN.rstrip("/"),)   # o app publicado (https://eterna.photo) lê a biblioteca do agente

    def origem_privada_ok(self, path):
        o = self.headers.get("Origin")
        if path.startswith(("/rostos/", "/nuvem/")):
            return self.origem_local()
        # contra DNS rebinding: o Host precisa ser o do agente (127.0.0.1, localhost ou o IP da rede com ETERNA_REDE)
        if (self.headers.get("Host") or "").lower() not in HOSTS_OK:
            return False
        return not o or o in self.origens_ok(path)

    def cors(self):
        path = urlparse(self.path).path
        if rota_privada(path):
            o = self.headers.get("Origin") or ""
            if o and o in self.origens_ok(path):
                self.send_header("Access-Control-Allow-Origin", o)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            return
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

    def loopback(self):
        return self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def posto(self):
        """Este computador ou um posto que abriu o Eterna pelo endereço da rede declarado em ETERNA_ORIGENS."""
        return self.loopback() or (self.headers.get("Host") or "").lower() in ORIGENS_REDE_HOSTS

    def png_bytes(self, path):
        try:
            with open(path, "rb") as f:
                data = f.read()
        except OSError:
            return self.js({"error": "not found"}, 404)
        self.send_response(200)
        self.cors()
        self.send_header("Content-Type", "image/png")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        self.wfile.write(data)

    def recorte_post(self):
        """v84: POST /recorte {pid}: a pessoa recortada (PNG transparente). Só este computador (loopback, Host e Origin do
        agente; os postos pareados entram na etapa 2 com a mesma regra do /photoroom/compose) e só fotos da biblioteca."""
        if not self.posto() or not self.origem_local():
            return self.js({"error": "origem não autorizada"}, 403)
        body, err = self.corpo(4096)
        if err:
            return self.js({"error": "corpo inválido"}, err)
        pid = body.get("pid")
        if not pid_ok(pid):
            return self.js({"error": "pid inválido"}, 400)
        pid = pid_lib(pid)
        try:
            lado = int(body.get("lado") or REC_LADO_MAX)
        except (TypeError, ValueError):
            lado = 0
        if lado not in REC_LADOS:
            return self.js({"error": "lado inválido"}, 400)
        with lock:
            e = lib.get(pid)
        if not e or not e.get("file") or not os.path.exists(e["file"]):
            for lx in REC_LADOS:                       # a foto saiu da biblioteca: o recorte dela sai também
                try:
                    os.remove(rec_arquivo(pid, lx))
                except OSError:
                    pass
            return self.js({"error": "foto não encontrada no agente"}, 404)
        pronto = rec_arquivo(pid, lado)
        if os.path.exists(pronto):
            return self.png_bytes(pronto)
        ok, motivo = rec_estado()
        if not ok:
            return self.js({"error": "recorte_indisponivel", "motivo": motivo, "como": REC_COMO}, 503)
        if not limite_ok(self.client_address[0], "recorte", REC_TAXA):
            return self.js({"error": "muitos pedidos"}, 429)
        path, erro = rec_pedir(pid, e["file"], lado)
        if erro == "fila_cheia":
            return self.js({"error": "fila_cheia"}, 429)
        if erro == "tempo":
            return self.js({"error": "recorte demorou demais"}, 504)
        if erro or not path:
            ok, motivo = rec_estado()
            if not ok:
                return self.js({"error": "recorte_indisponivel", "motivo": motivo, "como": REC_COMO}, 503)
            return self.js({"error": "não deu para recortar"}, 500)
        return self.png_bytes(path)

    # ---------- galeria online por QR ----------
    def origem_local(self):
        o = self.headers.get("Origin") or ""
        host = (self.headers.get("Host") or "").lower()
        if host in ORIGENS_REDE_HOSTS:                 # servidor do estádio aberto pela rede (ETERNA_ORIGENS)
            return not o or o in ORIGENS_REDE
        if host not in ("127.0.0.1:%d" % PORT, "localhost:%d" % PORT):
            return False
        return not o or o in ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)

    def corpo(self, limite):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n > limite:
            # descarta o corpo (até 8 MB) para o cliente receber o 413 em vez de conexão cortada; acima disso, só fecha
            if n <= 8 * 1024 * 1024:
                resto = n
                while resto > 0:
                    ch = self.rfile.read(min(65536, resto))
                    if not ch:
                        break
                    resto -= len(ch)
            self.close_connection = True
            return None, 413
        if n < 0:
            return None, 400
        try:
            b = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            return (b, None) if isinstance(b, dict) else (None, 400)
        except Exception:
            return None, 400

    def gal_get(self, u, q):
        p = u.path
        ip = self.client_address[0]
        if p.startswith("/galerias/"):
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            if p == "/galerias/vendas":
                try:
                    desde = max(0, int(q.get("desde", ["0"])[0] or 0))
                except ValueError:
                    desde = 0
                vs = vendas_ler()
                return self.js({"vendas": [{k: v.get(k) for k in ("id", "token", "sessoes", "pids", "n", "total", "metodo", "em", "canal", "todas", "teste")} for v in vs[desde:desde + 500]],
                                "next": min(len(vs), desde + 500)})
            if p == "/galerias/status":
                gs = []
                for t in sorted(os.listdir(GALERIAS))[:2000]:
                    if token_ok(t):
                        m = REPO.ler_manifesto(t) or {}
                        gs.append({"token8": t[:8], "estado": "expirada" if m and gal_expirou(m) else gal_estado(t, m) if m else "?", "envio": m.get("envio")})
                return self.js({"fila": gal_fila.qsize(), "galerias": gs})
            return self.js({"error": "not found"}, 404)
        partes = p.split("/")          # ['', 'g', token, ação, ...]
        if len(partes) == 4 and partes[2] == "codigo":
            if not limite_ok(ip, "codigo", 30):
                return self.js({"motivo": "bloqueado"}, 429)
            c = partes[3].upper()
            t = codigos.get(c) if _re_codigo.match(c) else None
            m = REPO.ler_manifesto(t) if t and t not in lapides else None
            if not m or gal_expirou(m) or any(v.get("codigo") == c for v in lapides.values()):
                return self.js({"error": "not found"}, 404)
            return self.js({"token": t})
        if len(partes) < 4 or not token_ok(partes[2]):
            return self.js({"error": "not found"}, 404)       # antes de qualquer caminho em disco
        token, acao = partes[2], partes[3]
        if acao == "info" and len(partes) == 4:
            if token in lapides:
                return self.js({"error": "expirada"}, 410)
            m = REPO.ler_manifesto(token)
            if not m:
                return self.js({"error": "not found"}, 404)
            if gal_expirou(m):
                return self.js({"error": "expirada"}, 410)
            return self.js({"ok": True, "tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"],
                            "estado": gal_estado(token, m), "venue": m.get("venue")})
        if acao == "foto" and len(partes) == 5:
            pid = partes[4]
            v = q.get("v", [""])[0]
            sig = q.get("sig", [""])[0]
            try:
                exp = int(q.get("exp", ["0"])[0])
            except ValueError:
                exp = 0
            if not pid_ok(pid) or v not in ("vitrine", "original") or exp < time.time() or not _re_sig.match(sig) \
                    or not hmac.compare_digest(sig, assinar(token, pid_lib(pid), v, exp)):
                return self.js({"error": "proibido"}, 403)
            m = REPO.ler_manifesto(token)
            f = next((x for x in (m or {}).get("fotos", []) if pid_lib(x["id"]) == pid_lib(pid)), None)
            if not m or not f or gal_expirou(m) or (v == "original" and f["direito"] not in ("comprada", "cortesia")):
                return self.js({"error": "proibido"}, 403)
            # v85 E: foto já na nuvem sai de lá (CloudFront, ou S3 direto): o ponto só autoriza, não serve os bytes.
            # Original da galeria = a alta de 3000 px (o original da câmera não sobe, D2).
            if nuvem["ligada"] and nuvem_tem(pid_lib(f["id"])):
                try:
                    url = nuvem_link(pid_lib(f["id"]), "alta" if v == "original" else "vitrine")["url"]
                    self.send_response(302)
                    self.cors()
                    self.send_header("Location", url)
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    return None
                except Exception:
                    pass                                   # nuvem indisponível: entrega do disco do ponto
            path = REPO.abrir(token, f["id"], v)
            try:
                with open(path, "rb") as fh:
                    data = fh.read()
            except OSError:
                return self.js({"error": "not found"}, 404)
            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "private, max-age=600")
            self.end_headers()
            self.wfile.write(data)
            return None
        return self.js({"error": "not found"}, 404)

    def gal_post(self, u):
        p = u.path
        ip = self.client_address[0]
        if p.startswith("/pagamento/webhook/"):
            return self.js({"error": "webhook reservado para o adquirente real (fase 2)"}, 501)
        if p == "/lgpd/excluir":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(256 * 1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            pids = [str(x) for x in (body.get("pids") or [])][:500]
            tokens = [str(x) for x in (body.get("tokens") or [])][:20]
            if not pids and not tokens:
                return self.js({"error": "nada para apagar"}, 400)
            return self.js(lgpd_excluir(pids, tokens, str(body.get("quem") or "")[:80], str(body.get("posto") or "")[:40],
                                        str(body.get("sessao") or "")[:40]))
        if p == "/nuvem/reenviar":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            if not nuvem["ligada"]:
                return self.js({"error": "nuvem desligada"}, 503)
            return self.js(nuvem_reenviar())
        if p == "/imprimir":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            if not IMPRESSORA:
                return self.js({"error": "sem impressora neste servidor (ETERNA_IMPRESSORA)"}, 503)
            body, err = self.corpo(IMP_MAX_CORPO)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            try:
                return self.js(imprimir(body.get("imagens") or [], str(body.get("venda") or "")[:40],
                                        str(body.get("vendedor") or "")[:60], str(body.get("posto") or "")[:40]))
            except Exception as ex:
                return self.js({"ok": False, "error": str(ex)[:300]}, 500)
        if p in ("/galerias/publicar", "/galerias/encerrar"):
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(GAL_MAX_CORPO)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            if p == "/galerias/encerrar":
                t = body.get("token")
                if not token_ok(t):
                    return self.js({"error": "not found"}, 404)
                with gal_lock:
                    m = REPO.ler_manifesto(t)
                    if not m:
                        return self.js({"error": "not found"}, 404)
                    m["expira"] = _iso()
                    m["encerrada"] = True
                    REPO.salvar_manifesto(t, m)
                nuvem_galeria_enfileira(t)                 # a nuvem tira do ar e apaga os rostos da galeria
                return self.js({"ok": True})
            try:
                novo = gal_validar(body.get("manifesto"))
            except ValueError as ex:
                return self.js({"error": str(ex)}, 400)
            t = novo["token"]
            if t in lapides:
                return self.js({"ok": False, "error": "galeria encerrada", "estado": "encerrada"}, 410)
            with gal_lock:
                m = gal_mesclar(novo, REPO.ler_manifesto(t))
                REPO.salvar_manifesto(t, m)
                if m.get("codigo"):
                    codigos[m["codigo"]] = t
            gal_fila.put(t)
            nuvem_galeria_enfileira(t)
            return self.js({"ok": True, "token": t, "estado": gal_estado(t, m)})
        partes = p.split("/")
        if len(partes) != 4 or partes[1] != "g" or not token_ok(partes[2]):
            return self.js({"error": "not found"}, 404)
        token, acao = partes[2], partes[3]
        if acao == "rosto":
            if not limite_ok(ip, "rosto", 10):
                return self.js({"motivo": "bloqueado", "ate": _iso(time.time() + 60)}, 429)
            body, err = self.corpo(GAL_MAX_CORPO)
            if err == 413:
                return self.js({"error": "imagem grande demais"}, 413)
            if err:
                return self.js({"error": "corpo inválido"}, 400)
            if body.get("consentimento") is not True:
                return self.js({"error": "consentimento obrigatório"}, 400)
            img = body.pop("imagem", None)
            m = REPO.ler_manifesto(token)
            if not m:
                return self.js({"error": "not found"}, 404)
            if gal_expirou(m):
                return self.js({"error": "expirada"}, 410)
            ate = bloqueio(ip, token)
            if ate:
                return self.js({"motivo": "bloqueado", "ate": _iso(ate)}, 429)
            if not rostos["ligado"]:
                return self.js({"motivo": "processando"}, 503)
            if not isinstance(img, str) or not img:
                return self.js({"error": "sem imagem"}, 400)
            kid = m["tipo"] == "evento" or bool(m.get("menor"))
            idioma = body.get("idioma") if body.get("idioma") in ("pt", "en", "es", "fr", "de") else "pt"
            versao = str(body.get("versao") or "")[:20]
            anexar(CONSENT, {"token": token, "tipo": "responsavel" if kid else "titular", "versao": versao, "idioma": idioma, "em": _iso()})
            try:
                r = buscar_em([img], [f["id"] for f in m["fotos"]])
            except Exception:
                return self.js({"motivo": "processando"}, 503)
            finally:
                img = None
            if r.get("processando"):
                return self.js({"motivo": "processando"}, 503)
            if not r.get("rosto"):
                return self.js({"ok": False, "motivo": "sem_rosto", "restam": falhou(ip, token)})
            sims = r["sims"]
            if m["tipo"] == "evento":
                pids = {f["id"] for f in m["fotos"] if sims.get(pid_lib(f["id"]), -1) >= LIMITE_MENOR}
            else:
                pids = {f["id"] for f in m["fotos"]} if any(s >= LIMITE for s in sims.values()) else set()
            if not pids:
                restam = falhou(ip, token)
                if not restam:
                    return self.js({"motivo": "bloqueado", "ate": _iso(bloqueio(ip, token))}, 429)
                return self.js({"ok": False, "motivo": "nao_encontrado", "restam": restam})
            if m["tipo"] == "evento":
                ate = evento_permite(ip, token, pids)
                if ate:
                    return self.js({"motivo": "bloqueado", "ate": _iso(ate)}, 429)
            with gal_lock:                      # o acerto não zera as falhas anteriores
                agora = time.time()
                for k in [k for k, v in acessos.items() if v["exp"] < agora]:
                    acessos.pop(k, None)
                acesso = secrets.token_urlsafe(24)
                acessos[acesso] = {"token": token, "pids": pids, "exp": agora + ACESSO_TTL}
            return self.js({"ok": True, "acesso": acesso, "exp": _iso(acessos[acesso]["exp"]), "galeria": galeria_obj(token, m, pids)})
        if acao in ("galeria", "pagamento"):
            body, err = self.corpo(64 * 1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            a = acesso_de(token, body.get("acesso"))
            if not a:
                return self.js({"error": "acesso inválido ou vencido"}, 401)
            m = REPO.ler_manifesto(token)
            if not m or gal_expirou(m):
                return self.js({"error": "expirada"}, 410)
            if acao == "galeria":
                return self.js({"galeria": galeria_obj(token, m, a["pids"])})
            pids = body.get("pids")
            metodo = body.get("metodo")
            idem = body.get("idem")
            if not isinstance(idem, str) or not re.match(r"^[A-Za-z0-9-]{8,80}$", idem) or metodo not in ("pix", "cartao"):
                return self.js({"error": "pedido inválido"}, 400)
            with gal_lock:
                ja = next((v for v in vendas_ler() if v.get("token") == token and v.get("idem") == idem), None)
                if ja:
                    m = REPO.ler_manifesto(token)
                    return self.js({"ok": True, "pedido": {"id": ja["id"], "status": "aprovado", "total": ja["total"], "canal": "online", "teste": bool(ja.get("teste")),
                                                           "checkout_url": None, "pix_copia_cola": None}, "galeria": galeria_obj(token, m, a["pids"])})
                dire = {f["id"]: f["direito"] for f in m["fotos"]}
                if not isinstance(pids, list) or not pids or len(pids) > 2000 or len(set(map(str, pids))) != len(pids) \
                        or any(x not in a["pids"] or dire.get(x) != "venda" for x in pids):
                    return self.js({"error": "foto fora do acesso ou não está à venda"}, 400)
                n = len(pids)
                dig, todas = float(m["precos"]["dig"]), float(m["precos"]["todas"])
                total = round(min(n * dig, todas), 2)          # o total que o navegador mandar é ignorado
                ped = PAGAMENTO.criar({"token": token, "pids": pids, "total": total, "metodo": metodo, "idem": idem})
                if ped["status"] == "aprovado":
                    for f in m["fotos"]:
                        if f["id"] in pids:
                            f["direito"], f["canal"] = "comprada", "online"
                            f.pop("cortesia", None)
                    REPO.salvar_manifesto(token, m)
                    vid = "O%04d" % (len(vendas_ler()) + 1)
                    anexar(VENDAS, {"id": vid, "token": token, "sessoes": sorted({f["sessao"] for f in m["fotos"] if f["id"] in pids}), "pids": pids,
                                    "n": n, "total": total, "metodo": metodo, "em": _iso(), "canal": "online", "idem": idem, "todas": total < n * dig,
                                    "pagamento": ped["id"], "teste": bool(ped.get("teste"))})
                else:
                    vid = ped["id"]
            if ped["status"] == "aprovado":
                try:
                    gal_processar(token)      # originais das recém-compradas antes de devolver os links
                except Exception:
                    gal_fila.put(token)
            m = REPO.ler_manifesto(token)
            return self.js({"ok": True, "pedido": {"id": vid, "status": ped["status"], "total": total, "canal": "online", "teste": bool(ped.get("teste")),
                                                   "checkout_url": ped.get("checkout_url"), "pix_copia_cola": ped.get("pix_copia_cola")},
                            "galeria": galeria_obj(token, m, a["pids"])})
        return self.js({"error": "not found"}, 404)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path.startswith(("/g/", "/galerias/")):
            return self.gal_get(u, q)
        if rota_privada(u.path) and not self.origem_privada_ok(u.path):
            return self.js({"error": "origem não autorizada"}, 403)
        if u.path == "/status":
            with lock:
                return self.js({"ok": True, "agent": "eterna-agente", "version": 3, "boot": BOOT, "card": state["card"],
                                "copied": state["copied"], "dups": state["dups"], "events": len(events),
                                "inbox": INBOX, "platform": sys.platform, "ftp": state["ftp"],
                                "rostos": {**rostos, "fila": fila_rostos.qsize()}, "nuvem": nuvem, "recorte": rec_status(), "fundos_modo": fundos_modo(),
                                "galeria_publica": os.environ.get("ETERNA_GALERIA_PUBLICA") or None,
                                "impressora": IMPRESSORA or None,
                                "impressora_locais": IMP_LOCAIS,
                                "galerias": {"fila": gal_fila.qsize(), "total": len(codigos), "vitrine_marca": gal_info["vitrine_marca"] or (not SEM_OPENCV and bool(_cv.get("cv2")))}})
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
        if u.path == "/nuvem/link":              # teste de estanque: link de 5 min para abrir a foto da nuvem no celular
            if not os.environ.get("ETERNA_TESTE_CARGA") or not nuvem["ligada"]:
                return self.js({"error": "not found"}, 404)
            pid, v = q.get("pid", [""])[0], q.get("v", ["vitrine"])[0]
            if not pid_ok(pid) or v not in ("vitrine", "alta"):
                return self.js({"error": "pid ou versão inválida"}, 400)
            return self.js({"pid": pid, "v": v, **nuvem_link(pid, v)})
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
        if u.path == "/impressao/fila":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            return self.js(imp_fila_json())
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
                if ("serie" not in m and "x" not in m) or "cap" not in m:
                    m = meta.setdefault(pid, {})
                    m.update(exif_info(f))
                    m["x"] = 1          # já lido, mesmo sem EXIF
                    meta_dirty[0] = True
                out.append({"id": pid, "name": name, "day": day, "t": u, "size": st.st_size,
                            "origem": m.get("o") or "", "via": m.get("s") or "",
                            "cap": m.get("cap") or 0, "serie": m.get("serie") or "", "autor": m.get("autor") or "",
                            "dono": m.get("dono") or "", "modelo": m.get("modelo") or ""})
            out.sort(key=lambda x: x["t"])
            if meta_dirty[0]:
                meta_dirty[0] = False
                save_meta()
            return self.js({"fotos": out, "total": len(out), "boot": BOOT})
        if u.path == "/ftp-remoto/status":
            c = rftp_cfg()
            return self.js({**rftp, "configurado": bool(c), "host": c and c.get("host"), "port": c and c.get("port"),
                            "user": c and c.get("user"), "dir": c and c.get("dir"), "tls": bool(c and c.get("tls"))})
        if u.path == "/photoroom/status":
            c = pr_cfg()
            with pr_lock:
                return self.js({**pr, "configured": bool(c), "sandbox": bool(c and c["api_key"].startswith("sandbox_"))})
        if u.path.startswith("/photoroom/result/"):
            name = u.path.rsplit("/", 1)[1]
            if not re.match(r"^[0-9a-f]{16}_[a-z0-9]{2,40}_[0-9a-f]{6}\.(jpg|png)$", name):
                return self.js({"error": "not found"}, 404)
            return self.file(os.path.join(PR_DIR, name))
        if u.path.startswith("/recorte/"):
            m = _re_rec.match(u.path[len("/recorte/"):])
            if not self.posto() or not m:
                return self.js({"error": "not found"}, 404)
            return self.png_bytes(os.path.join(RECORTES, m.group(2) + ".png"))
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
        if u.path.startswith(("/g/", "/galerias/", "/pagamento/")) or u.path in ("/imprimir", "/nuvem/reenviar", "/lgpd/excluir"):
            return self.gal_post(u)
        if u.path == "/recorte":
            return self.recorte_post()
        if u.path == "/fundos/modo":
            # o interruptor do Painel de controle grava aqui o modo da montagem; só deste computador
            if not self.loopback() or not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            modo = body.get("modo")
            if modo not in ("local", "photoroom"):
                return self.js({"error": "modo inválido"}, 400)
            _grava_privado(FUNDOS_MODO_CFG, json.dumps({"modo": modo, "em": time.strftime("%Y-%m-%dT%H:%M:%S")}))
            return self.js({"ok": True, "modo": modo})
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
        if u.path == "/ftp-remoto/config":
            if origin and not origin.startswith(("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)):
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            except Exception:
                return self.js({"error": "corpo inválido"}, 400)
            old = rftp_cfg() or {}
            try:
                porta_n = int(body.get("port") or 21)
            except Exception:
                return self.js({"error": "porta inválida"}, 400)
            c = {"host": (body.get("host") or "").strip(), "port": porta_n,
                 "user": (body.get("user") or "").strip(), "password": body.get("password") or "",
                 "dir": (body.get("dir") or "").strip(), "tls": bool(body.get("tls"))}
            if not c["host"] or not c["user"]:
                return self.js({"error": "informe servidor e usuário"}, 400)
            # v80 (segurança I5): a senha salva só vale para o mesmo servidor, porta e usuário (não manda a senha para outro host)
            mesmo = old and old.get("host") == c["host"] and int(old.get("port") or 21) == c["port"] and old.get("user") == c["user"]
            if not c["password"]:
                if not mesmo or not old.get("password"):
                    return self.js({"error": "servidor, porta ou usuário mudou: digite a senha de novo"}, 400)
                c["password"] = old["password"]
            try:
                t = rftp_connect(c)
                t.quit()
            except Exception as ex:
                return self.js({"error": "não conectou: %s" % ex}, 502)
            rftp_save(c)
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
            if fundos_modo() != "photoroom":           # v84: montagem local é o padrão; o Photoroom só com o interruptor ligado
                return self.js({"ok": False, "error": "photoroom_desligado"}, 409)
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
                name = pr_compose(photo, body.get("bg"), int(body.get("W") or 2000), int(body.get("H") or 1429), body.get("pad") or {},
                                  hi=bool(body.get("hi")), recorte=bool(body.get("recorte")))
                return self.js({"ok": True, "url": "/photoroom/result/" + name})
            except Exception as ex:
                return self.js({"error": str(ex)}, 502)
        if u.path == "/roverpix/sync":
            rover_wake.set()
            return self.js({"ok": True})
        if u.path == "/rostos/projecao":
            if not os.environ.get("ETERNA_TESTE_CARGA"):
                return self.js({"error": "not found"}, 404)
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            if not _cv.get("np"):
                return self.js({"erro": "reconhecimento desligado"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(min(n, 4096)).decode("utf-8") or "{}")
                pedido = int(body.get("n") or 100000)
            except Exception:
                return self.js({"error": "corpo inválido"}, 400)
            return self.js(projecao_busca(pedido))
        if u.path in ("/rostos/buscar", "/rostos/medir"):
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
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
    threading.Thread(target=rftp_loop, daemon=True).start()
    threading.Thread(target=nuvem_loop, daemon=True).start()
    threading.Thread(target=nuvem_galerias_loop, daemon=True).start()
    if IMPRESSORA and not os.environ.get("ETERNA_IMPRESSORA_TESTE"):
        imp_retomar()
    threading.Thread(target=rostos_thread, daemon=True).start()
    threading.Thread(target=pasta_vigiada, daemon=True).start()
    gal_indexar()
    threading.Thread(target=galeria_loop, daemon=True).start()
    print("  Galerias online:   %d publicadas · repositório %s · pagamento %s" % (len(codigos), type(REPO).__name__, type(PAGAMENTO).__name__))
    print("  FTP do estádio:    " + (("buscando em %s@%s" % ((rftp_cfg() or {}).get("user"), (rftp_cfg() or {}).get("host"))) if rftp_cfg() else "não configurado (Eterna: Upload)"))
    print("  Photoroom:         " + ("conectado" + (" (modo de testes)" if (pr_cfg() or {}).get("api_key", "").startswith("sandbox_") else "") if pr_cfg() else "sem chave (configure no Eterna: Fundos de IA)"))
    _rok, _rmot = rec_estado()
    print("  Recorte local:     " + ("pronto (ISNet + u2net_human_seg, carrega na primeira foto)" if _rok else "indisponível: %s (rode instalar-recorte)" % _rmot))
    print("  Roverpix:          " + ("chave configurada, sincronizando a cada 5 min" if rover_cfg() else "sem chave (configure no Eterna: Repositório)"))
    time.sleep(0.4)
    print("  insira o cartão ou mande pelo CTP. Ctrl+C para parar.\n")
    try:
        ThreadingHTTPServer(("0.0.0.0" if os.environ.get("ETERNA_REDE") else "127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
