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
import hashlib, json, os, shutil, subprocess, sys, threading, time, glob, socket, random, string, sqlite3, base64, queue, collections, tempfile
import array, itertools, operator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, quote
import unicodedata
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
APP_ORIGIN = os.environ.get("ETERNA_APP_ORIGIN", "https://eterna.photo")  # no servidor de teste, a cópia local (docs/SERVIDOR-DE-TESTE.md)
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
# "*=local": todo posto que não está na lista imprime na DNP ligada nele (o computador do servidor segue na ETERNA_IMPRESSORA).
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
ORIGENS_REDE_HOSTS = {urlparse(x).netloc for x in ORIGENS_REDE} - {""}   # v87 (segurança I1): entrada sem esquema não vira Host vazio
ORIGENS_SEM_ESQUEMA = sorted(x for x in ORIGENS_REDE if not urlparse(x).netloc)
INBOX = os.path.join(HOME, "inbox")
THUMBS = os.path.join(HOME, "thumbs")
INDEX = os.path.join(HOME, "index.json")
FTPCFG = os.path.join(HOME, "ftp.json")
FTPTMP = os.path.join(HOME, "ftp-tmp")
EXT = (".jpg", ".jpeg", ".JPG", ".JPEG")
FOTO_ENVIO_MAX = 60 * 1024 * 1024          # uma foto enviada pela tela de Upload
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
# ETERNA_BUSCA_DIAS: a selfie do Checkout procura em hoje e nos N-1 dias anteriores (padrão 1, só hoje). Teste com fotos de ontem: 2
BUSCA_DIAS = max(1, int(os.environ.get("ETERNA_BUSCA_DIAS") or 1))
BUSCA_DIAS_EXPLICITA = bool((os.environ.get("ETERNA_BUSCA_DIAS") or "").strip())


BUSCA_JANELA_PADRAO, BUSCA_JANELA_MIN_OK, BUSCA_JANELA_MAX_OK = 90, 15, 480


def _busca_janela(v=None, padrao=BUSCA_JANELA_PADRAO):
    """Minutos da janela da selfie: 0 (dia todo) ou de 15 a 480 (fora disso, o mais perto); inválido = padrao."""
    if v is None:
        v = os.environ.get("ETERNA_BUSCA_JANELA_MIN", str(padrao))
    try:
        v = int(float(str(v).strip() or padrao))
    except (TypeError, ValueError):
        return padrao
    if v <= 0:
        return 0
    return max(BUSCA_JANELA_MIN_OK, min(v, BUSCA_JANELA_MAX_OK))


# v91 (Eduardo, 01/11 16:46): a selfie do Checkout procura só nas sessões cuja ÚLTIMA foto (hora do clique corrigida, cap1;
# sem clique, a chegada) foi nos últimos ETERNA_BUSCA_JANELA_MIN minutos (padrão 90; 0 = dia todo): depois disso a família já
# foi embora. O valor de verdade é o do Painel de controle (Eduardo, 16:51), gravado no estado.db (col "config", id "busca",
# {"janela_min": N}) e lido aqui na busca; a variável é só o padrão inicial. Com ETERNA_BUSCA_DIAS definida (teste do
# Ronaldo com fotos de ontem) a janela não vale: procura o dia todo dos dias da busca. Código do recibo e da galeria não passam
# por aqui (abrem qualquer sessão do dia).
BUSCA_JANELA_MIN = _busca_janela()
ROSTO_PRINCIPAL = 0.5  # v91 (segurança B5): rosto com largura >= metade do maior rosto da foto = primeiro plano
rostos = {"ligado": False, "motivo": "iniciando", "lidas": 0, "rostos": 0, "fila": 0, "modelo": "YuNet + SFace (OpenCV)", "limite": LIMITE}
fila_rostos = queue.PriorityQueue()   # v91 (S11): itens (prio, seq, pid, caminho, t_fila); 0 = foto nova, 1 = atraso do boot
_fila_seq = itertools.count()


def rostos_enfileira(pid, path, prio=0, t_fila=None):
    fila_rostos.put((prio, next(_fila_seq), pid, path, t_fila))
_cv = {}               # cv2, np, det, rec (um par por thread de leitura)
_mat = {}              # dia -> (matriz N x 128, [pid...], larguras N, {pid: maior largura da foto}) para busca
_mat_ver = {}          # dia -> versão; muda a cada leitura gravada ou limpeza (a releitura do dia só fica se não mudou no meio)
_mat_lock = threading.Lock()


def rostos_db():
    c = sqlite3.connect(ROSTOS_DB, timeout=30, check_same_thread=False)
    c.execute("pragma journal_mode=wal")
    c.execute("create table if not exists foto (pid text primary key, dia text, n int, lida real)")
    c.execute("create table if not exists rosto (pid text, dia text, larg real, emb blob)")
    c.execute("create index if not exists rosto_dia on rosto(dia)")
    c.execute("create index if not exists rosto_pid on rosto(pid)")   # cada foto lida apaga e regrava os rostos dela; sem isto, varre a tabela inteira (1,2 milhão de linhas: 4,5 s por foto)
    # B1 (segurança, 10/11): os rostos com score e pose de qualidade (score >= SESS_Q_SCORE e frontal), para o anel das
    # visitas refeito no boot (vis_idx_boot) só com o que passaria em _sess_qualidade. Tabela à parte: a "rosto" não muda.
    c.execute("create table if not exists rosto_q (pid text, dia text, emb blob)")
    c.execute("create index if not exists rosto_q_pid on rosto_q(pid)")
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


# Uma pessoa por vez (antifraude): dois rostos de tamanho parecido na selfie (o segundo com pelo menos metade da largura
# do maior) e a busca não roda: são duas pessoas tentando abrir as fotos uma da outra. Rosto bem menor ao fundo (a fila
# do Checkout) não conta. A mesma regra vale no navegador (pessoas() no app) e na nuvem (servidor/galeria-nuvem).
VARIAS_RAZAO = 0.5


def varias_pessoas(fs):
    """fs = ler_rostos(...) (do maior para o menor)."""
    return len(fs) >= 2 and fs[1][0] >= VARIAS_RAZAO * fs[0][0]


def ler_rostos(img, det, rec, minimo=ROSTO_MIN, detalhe=False):
    """img BGR -> [(largura, vetor 128 normalizado)] do maior para o menor rosto. detalhe=True (v91, sessões):
    [(largura, vetor, score, frontal)]; frontal = nariz a até SESS_Q_FRONTAL x a distância entre os olhos do meio deles."""
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
        v = e / (np.linalg.norm(e) or 1)
        if detalhe:
            rx, ry, lx, ly, nx = float(r[4]), float(r[5]), float(r[6]), float(r[7]), float(r[8])
            dist = ((lx - rx) ** 2 + (ly - ry) ** 2) ** 0.5
            frontal = dist > 0 and abs(nx - (rx + lx) / 2) <= SESS_Q_FRONTAL * dist
            out.append((float(r[2]), v, float(r[14]), bool(frontal)))
        else:
            out.append((float(r[2]), v))
    return sorted(out, key=lambda x: -x[0])


def limpar_rostos(db=None):
    """Apaga as leituras de rosto com mais de RETENCAO_DIAS (no início e uma vez por dia, pelo galeria_loop)."""
    db = db or rostos_db()
    lim = time.strftime("%Y-%m-%d", time.localtime(time.time() - RETENCAO_DIAS * 86400))
    db.execute("delete from rosto where dia < ?", (lim,)); db.execute("delete from foto where dia < ?", (lim,))
    db.execute("delete from rosto_q where dia < ?", (lim,)); db.commit()
    with _mat_lock:
        for d in [d for d in _mat if d < lim]:
            _mat.pop(d, None)
            _mat_ver[d] = _mat_ver.get(d, 0) + 1


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
        ff_rosto_fila(x[0])
        rostos_enfileira(x[0], x[1], 1)             # S11: atraso do boot atrás das fotos novas
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
        _prio, _seq, pid, path, t_fila = fila_rostos.get()
        rostos["fila"] = fila_rostos.qsize()
        t_ini = time.time()
        lidos = None
        try:
            img = cv2.imread(path, cv2.IMREAD_REDUCED_COLOR_2)
            if img is None:
                continue
            fs = ler_rostos(img, det, rec, detalhe=True)
            dia = os.path.basename(os.path.dirname(path))
            db.execute("insert or replace into foto values (?,?,?,?)", (pid, dia, len(fs), time.time()))
            db.execute("delete from rosto where pid=?", (pid,))
            db.executemany("insert into rosto values (?,?,?,?)", [(pid, dia, f[0], f[1].tobytes()) for f in fs])
            db.execute("delete from rosto_q where pid=?", (pid,))
            db.executemany("insert into rosto_q values (?,?,?)", [(pid, dia, f[1].tobytes()) for f in fs
                                                                  if len(f) > 3 and f[2] >= SESS_Q_SCORE and f[3]])
            db.commit()
            lidos = [(f[0], f[1].tolist(), f[2], f[3]) for f in fs]
            with _cont_lock:
                rostos["lidas"] += 1; rostos["rostos"] += len(fs)
            m = metricas_por_pid.get(pid)
            if m is not None:
                agora = time.time()
                m.update(lida=agora, leitura_ms=round((agora - t_ini) * 1000, 1), rostos=len(fs),
                         espera_ms=round((t_ini - t_fila) * 1000, 1) if t_fila else None)
                metrica_grava({"pid": pid, "lida": m["lida"], "leitura_ms": m["leitura_ms"], "rostos": m["rostos"], "espera_ms": m["espera_ms"]})
            mat_acrescenta(dia, pid, [(f[0], f[1]) for f in fs])   # v91 (rapidez da selfie): sem reler o dia inteiro
        except Exception as ex:
            print("  erro ao ler rostos", path, ex)
        finally:
            ff_rosto_lido(pid)          # v87: a fila do fotógrafo só mostra "Já no Checkout" depois da leitura
            try:                        # v91 (S6): a sessão decide a foto pendente (erro = lida sem rosto); fora do _mat_lock
                sess_rostos_lidos(pid, lidos)
            except Exception as ex:
                print("  sessões (rostos): %s" % str(ex)[:80])


def mat_acrescenta(dia, pid, fs):
    """Foto lida (já gravada no rostos.db): troca as linhas dela na matriz do dia em memória. fs = [(largura, vetor 128)].
    Sempre sobe a versão do dia (revisão: corrida com a releitura do dia em matriz())."""
    np_ = _cv["np"]
    with _mat_lock:
        _mat_ver[dia] = _mat_ver.get(dia, 0) + 1
        mt = _mat.get(dia)
        if mt is None:
            return
        M0, ps0, L0, mx = mt
        if pid in mx or pid in ps0:
            k = [i for i, p_ in enumerate(ps0) if p_ != pid]
            M0, ps0, L0 = M0[k], [ps0[i] for i in k], L0[k]
        mx = dict(mx)
        mx.pop(pid, None)
        if fs:
            M0 = np_.vstack([M0] + [np_.asarray(f[1], "float32").reshape(1, 128) for f in fs])
            ps0 = ps0 + [pid] * len(fs)
            L0 = np_.concatenate([L0, np_.array([float(f[0] or 0) for f in fs], "float32")])
            mx[pid] = max(float(f[0] or 0) for f in fs)
        _mat[dia] = (M0, ps0, L0, mx)


def _mat_le(db, d):
    np = _cv["np"]
    rows = db.execute("select pid, larg, emb from rosto where dia=?", (d,)).fetchall()
    M = np.frombuffer(b"".join(r[2] for r in rows), dtype="float32").reshape(-1, 128) if rows else np.zeros((0, 128), "float32")
    L = np.array([float(r[1] or 0) for r in rows], "float32")
    mx = {}
    for r in rows:
        mx[r[0]] = max(mx.get(r[0], 0.0), float(r[1] or 0))
    return (M, [r[0] for r in rows], L, mx)


def matriz(dias):
    """(M, pids, larguras, {pid: maior largura}) dos dias. A releitura de um dia só fica em memória se nenhuma leitura nova
    foi gravada no meio (versão do dia igual); senão tenta de novo (até 3 vezes) e, na última, usa sem guardar."""
    np = _cv["np"]
    vs, ps, ls, mx = [], [], [], {}
    db = rostos_db()
    for d in dias:
        with _mat_lock:
            m = _mat.get(d)
        tent = 0
        while m is None:
            with _mat_lock:
                ver = _mat_ver.get(d, 0)
            m0 = _mat_le(db, d)
            tent += 1
            with _mat_lock:
                if _mat_ver.get(d, 0) == ver:
                    _mat[d] = m0
                    m = m0
                elif tent >= 3:
                    m = m0
        vs.append(m[0]); ps += m[1]; ls.append(m[2]); mx.update(m[3])
    return ((np.vstack(vs) if vs else np.zeros((0, 128), "float32")), ps,
            (np.concatenate(ls) if ls else np.zeros((0,), "float32")), mx)


_busca = {"m": None}
_busca_lock = threading.Lock()


def buscar(imagens, dias=1, janela=None):
    """Lê o maior rosto de cada imagem (dataURL/base64), faz a média e devolve as fotos com o rosto."""
    np = _cv["np"]; cv2 = _cv["cv2"]
    dias = max(int(dias or 1), BUSCA_DIAS)
    with _busca_lock:
        if not _busca["m"]:
            _busca["m"] = leitor()
        return _buscar(imagens, dias, *_busca["m"], janela=janela)


def _buscar(imagens, dias, det, rec, janela=None):
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
        if varias_pessoas(fs):
            return {"rosto": True, "varias": True, "fotos": []}
        if fs:
            vs.append(fs[0][1])
    del imagens
    if not vs:
        return {"rosto": False, "fotos": []}
    me = np.mean(vs, axis=0); me /= np.linalg.norm(me) or 1
    return buscar_vetor(me, dias, janela)


_busca_cfg = {"t": 0.0, "v": None}


def busca_janela_cfg():
    """Janela gravada pelo Painel de controle no estado.db (config/busca), relida a cada 3 s; None sem valor gravado."""
    agora = time.time()
    if agora - _busca_cfg["t"] < 3:
        return _busca_cfg["v"]
    v = None
    try:
        if os.path.exists(ESTADO_DB):
            with estado_lock:
                db = estado_db()
                try:
                    r = db.execute("select valor from doc where col = 'config' and id = 'busca' and valor is not null").fetchone()
                finally:
                    db.close()
            if r:
                j = json.loads(r[0])
                if isinstance(j, dict) and j.get("janela_min") is not None:
                    v = _busca_janela(j.get("janela_min"), BUSCA_JANELA_MIN)
    except Exception:
        v = None
    _busca_cfg.update(t=agora, v=v)
    return v


# v93 (Eduardo, 06/11 07:54; plano docs/planos/2026-11-06-dois-cliques-ia.md): os N primeiros cliques de cada sessão
# de ponto de campo são só base dos fundos de IA (nunca vendidos como foto normal). Regra no Painel de controle, gravada em
# estado.db col config id ia; sem valor válido, vale o padrão (ligada, 2 cliques, os 4 pontos de campo, sem o volante).
IA_CLIQUES_PADRAO = 2
IA_CLIQUES_MAX = 3
IA_PONTOS_PADRAO = ("terminal", "campo2", "campo3", "campo4")
IA_FILA_ALVO = 2                 # trabalhos de IA na fila de recorte ao mesmo tempo (o Checkout passa na frente)
IA_NOVOS_MAX = 2000              # teto da fila de pids novos de IA (acima disso o rec_pre_loop recupera depois)
_ia_cfg = {"t": 0.0, "v": None}


def ia_padrao():
    return {"ligada": True, "cliques": IA_CLIQUES_PADRAO, "pontos": list(IA_PONTOS_PADRAO), "volante": False}


def ia_valida(j):
    """Configuração gravada pelo Painel: só o formato conhecido; qualquer outra coisa = None (vale o padrão)."""
    if not isinstance(j, dict):
        return None
    lig, n, pts, vol = j.get("ligada", True), j.get("cliques", IA_CLIQUES_PADRAO), j.get("pontos", list(IA_PONTOS_PADRAO)), j.get("volante", False)
    if not isinstance(lig, bool) or not isinstance(vol, bool) or isinstance(n, bool) or not isinstance(n, int) \
            or not 1 <= n <= IA_CLIQUES_MAX or not isinstance(pts, list) or len(pts) > 20 \
            or not all(isinstance(p, str) and _re_ff_point.match(p) for p in pts):
        return None
    return {"ligada": lig, "cliques": n, "pontos": list(dict.fromkeys(pts)), "volante": vol}


def ia_cfg():
    """Regra dos cliques de IA (estado.db config/ia), relida a cada 3 s. Nunca chamar com o sess_lock na mão."""
    agora = time.time()
    if agora - _ia_cfg["t"] < 3 and _ia_cfg["v"] is not None:
        return _ia_cfg["v"]
    v = None
    try:
        if os.path.exists(ESTADO_DB):
            with estado_lock:
                db = estado_db()
                try:
                    r = db.execute("select valor from doc where col = 'config' and id = 'ia' and valor is not null").fetchone()
                finally:
                    db.close()
            if r:
                v = ia_valida(json.loads(r[0]))
                if v is None:                        # gravado mas ilegível: fica o último valor válido
                    v = _ia_cfg["v"] or ia_padrao()
    except Exception:                                # erro de leitura (banco ocupado): fica o último valor válido
        v = _ia_cfg["v"] or ia_padrao()
    v = v or ia_padrao()                             # o padrão só sem documento gravado
    _ia_cfg.update(t=agora, v=v)
    return v


def ia_cfg_mem():
    """O último valor lido (sem abrir o banco): para quem está com o sess_lock na mão."""
    return _ia_cfg["v"] or ia_padrao()


def busca_janela_efetiva(janela=None):
    """Minutos da janela desta busca: o parâmetro (testes), o Painel de controle (estado.db) ou ETERNA_BUSCA_JANELA_MIN;
    0 com ETERNA_BUSCA_DIAS definida (dia todo dos dias da busca)."""
    if BUSCA_DIAS_EXPLICITA:
        return 0
    if janela is not None:
        return _busca_janela(janela)
    v = busca_janela_cfg()
    return BUSCA_JANELA_MIN if v is None else v


def buscar_vetor(me, dias=1, janela=None, agora=None):
    """Fotos com o rosto do vetor me (128, normalizado), nos dias da busca. Separada de _buscar para medir (v91 parte B:
    selfie até a primeira foto ampliada em menos de 2 s; testes/selfie_rapidez.py). Cada foto vem com principal: o rosto que
    bateu tem largura >= ROSTO_PRINCIPAL x a do maior rosto daquela foto (B5: quem só aparece no fundo não abre a sessão
    inteira no Checkout). Com janela (minutos) > 0, só as fotos de sessões com a última foto dentro da janela."""
    np = _cv["np"]
    hoje = time.time() if agora is None else agora
    M, ps, L, mx = matriz([time.strftime("%Y-%m-%d", time.localtime(hoje - i * 86400)) for i in range(max(1, min(int(dias), RETENCAO_DIAS)))])
    jan = busca_janela_efetiva(janela)
    if jan and len(ps):
        ok = sess_pids_janela(hoje - jan * 60)
        if ok is not None:                   # None = nenhuma sessão em memória (agente sem sessões): sem filtro
            idx = np.array([i for i, p in enumerate(ps) if p in ok], dtype="int64")
            M, ps, L = M[idx] if len(idx) else M[:0], [ps[i] for i in idx], L[idx] if len(idx) else L[:0]
    melhor = {}
    if len(ps):
        sims = M @ me
        for i in np.nonzero(sims >= LIMITE_TALVEZ)[0]:
            pid = ps[i]; s_ = float(sims[i])
            if s_ > melhor.get(pid, (0, 0))[0]:
                melhor[pid] = (s_, float(L[i]))
    fotos = sorted(({"id": k, "sim": round(v[0], 3), "principal": bool(v[1] >= ROSTO_PRINCIPAL * (mx.get(k) or 0))}
                    for k, v in melhor.items()), key=lambda x: -x["sim"])[:500]
    return {"rosto": True, "fotos": fotos, "limite": LIMITE, "janela_min": jan}


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
    dias, linhas_foto, apagados_sess = set(), [], []
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
        try:
            ff_esquecer(pid)                    # v87: sai da fila de rostos pendentes (fora do lock)
            sess_esquecer(pid)                  # v91: sai da sessão, das pendentes e dos rostos em memória
            apagados_sess.append(pid)
        except Exception:
            pass
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
            db.execute("delete from rosto where pid=?", (pid,)); db.execute("delete from foto where pid=?", (pid,))
            db.execute("delete from rosto_q where pid=?", (pid,)); db.commit(); db.close()
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
    try:
        sess_esquecer_disco(apagados_sess)   # v91 (S14): o pid sai também dos arquivos de sessão dos dias anteriores
    except Exception as ex:
        falhas.append("sessões: " + str(ex)[:80])
    with _mat_lock:
        for d in dias:
            _mat.pop(d, None)                # a busca por rosto relê o dia sem as fotos apagadas
            _mat_ver[d] = _mat_ver.get(d, 0) + 1
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
        if time.time() - nuvem.get("vendas_online_em", 0) > 60:
            nuvem["vendas_online_em"] = time.time()
            try:
                nuvem_vendas_online(seg)
            except Exception as ex:
                nuvem["vendas_online_erro"] = time.strftime("%H:%M:%S ") + str(ex)[:160]
        nuvem_gal_acorda.wait(5)
        nuvem_gal_acorda.clear()


def nuvem_vendas_online(seg):
    """v99: compra online paga na Imply (conferida pela Nuvem). Junta às vendas do ponto (vendas-online.jsonl, que o app lê em
    /galerias/vendas) e marca as fotos como compradas no manifesto local. O cursor fica no nuvem.db; o id é o código do pedido."""
    with nuvem_lock:
        db = nuvem_db()
        db.execute("CREATE TABLE IF NOT EXISTS cursor (nome TEXT PRIMARY KEY, valor TEXT)")
        r = db.execute("SELECT valor FROM cursor WHERE nome='vendas_online'").fetchone()
        db.close()
    desde = r[0] if r else ""
    rq = urllib.request.Request(NUVEM_API + "/ponto/vendas-online?" + urllib.parse.urlencode({"desde": desde}),
                                headers={"X-Eterna-Ponto": seg, "User-Agent": "eterna-agente"})
    with urllib.request.urlopen(rq, timeout=20) as resp_:
        j = json.loads(resp_.read().decode("utf8"))
    with gal_lock:
        ja = {v.get("id") for v in vendas_ler()}
        for v in j.get("vendas") or []:
            if not isinstance(v, dict) or not re.match(r"^ON-[A-Z0-9]{10}$", str(v.get("id") or "")) or v["id"] in ja:
                continue
            pids = [str(x) for x in (v.get("pids") or [])][:2000]
            m = REPO.ler_manifesto(v.get("token")) if token_ok(v.get("token")) else None
            if m:
                for f in m["fotos"]:
                    if f["id"] in pids and f["direito"] != "comprada":
                        f["direito"], f["canal"] = "comprada", "online"
                        f.pop("cortesia", None)
                REPO.salvar_manifesto(v["token"], m)
                gal_fila.put(v["token"])
            anexar(VENDAS, {"id": v["id"], "token": v.get("token"), "sessoes": v.get("sessoes") or [], "pids": pids, "n": len(pids),
                            "total": float(v.get("total") or 0), "esperado": float(v.get("esperado") or 0), "itens": v.get("itens") or [],
                            "metodo": "imply", "idpedido": v.get("idpedido"), "meio": v.get("meio"), "em": v.get("em") or _iso(),
                            "canal": "online", "todas": bool(v.get("todas")), "teste": False})
            ja.add(v["id"])
            nuvem["vendas_online"] = nuvem.get("vendas_online", 0) + 1
    if j.get("next") and j["next"] != desde:
        with nuvem_lock:
            db = nuvem_db()
            db.execute("CREATE TABLE IF NOT EXISTS cursor (nome TEXT PRIMARY KEY, valor TEXT)")
            db.execute("INSERT OR REPLACE INTO cursor (nome, valor) VALUES ('vendas_online', ?)", (j["next"],))
            db.commit(); db.close()


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
    """Leva um arquivo para a inbox. Devolve 'new', 'dup', 'excluida' (apagada a pedido do cliente) ou None (falhou)."""
    t_ini = time.time()
    h = quick_hash(src, st.st_size)
    if h in lgpd_excluidas:                 # o cliente pediu para apagar: não entra de novo (a câmera recebe "ok" e não reenvia)
        if move:
            try:
                os.remove(src)
            except OSError:
                pass
        return "excluida"
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
        meta[pid] = {"o": origin, "s": src_kind, "u": time.time(), "mt": st.st_mtime, **exif_info(dst)}
        mm = dict(meta[pid])
        save_meta()
        events.append({"type": "photo", "id": pid, "name": fn, "size": st.st_size,
                       "t": st.st_mtime, "card": origin, "src": src_kind, "file": dst, "thumb": thumb,
                       "cap": meta[pid].get("cap", 0), "serie": meta[pid].get("serie", ""), "autor": meta[pid].get("autor", ""), "dono": meta[pid].get("dono", "")})
        state["copied"] += 1
        m = {"pid": pid, "nome": fn, "bytes": st.st_size, "origem": src_kind, "quem": origin, "chegada": time.time(),
             "copia_ms": round((time.time() - t_ini) * 1000, 1), "sha": sha}
        metricas.append(m); metricas_por_pid[pid] = m
    metrica_grava(m)
    try:                                # v91: sessão montada aqui (fora do lock); a Fila do fotógrafo deriva dela (S12)
        sess_add(pid, mm)
    except Exception as ex:
        print("  sessões: %s" % str(ex)[:80])
    try:
        ff_rosto_fila(pid)              # antes do put: a leitura não pode terminar antes de a foto contar como pendente
    except Exception as ex:
        print("  fila do fotógrafo (rostos): %s" % str(ex)[:80])
    rostos_enfileira(pid, dst, 0, time.time())   # S11: foto nova na frente do atraso do boot
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
# Professional e para câmeras com FTP embutido. Só modo passivo, STOR,
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
    # servidor com duas redes (câmeras num roteador sem internet, internet pelo Wi-Fi): vale o primeiro IP de
    # ETERNA_ORIGENS que é desta máquina; sem isso, o IP da rota de internet
    try:
        meus = {i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)}
        for o in os.environ.get("ETERNA_ORIGENS", "").split(","):
            h = urlparse(o.strip()).hostname or ""
            if h in meus and not h.startswith("100."):
                return h
    except Exception:
        pass
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


# FTP embutido: só modo passivo, numa faixa fixa de portas (firewall), conexão de dados só do mesmo IP do controle, só JPEG,
# até FOTO_ENVIO_MAX por arquivo, no máximo FTP_POR_IP sessões por IP e FTP_TOTAL no total. ETERNA_FTP=0 desliga (servidor com IIS).
# Sem login: no máximo FTP_SEM_LOGIN_IP por IP, FTP_TOTAL - FTP_RESERVA no total, FTP_LOGIN_S para entrar e linha de até
# FTP_LINHA bytes: quem só abre conexões não ocupa o lugar da câmera nem a memória do servidor.
FTP_POR_IP, FTP_TOTAL, FTP_RESERVA, FTP_SEM_LOGIN_IP = 8, 64, 16, 2
FTP_OCIOSO_S, FTP_LOGIN_S, FTP_DADOS_S, FTP_LINHA, FTP_TENTATIVAS = 300, 25, 30, 4096, 3
ftp_conexoes = {}          # ip -> sessões abertas
ftp_sem_login = {}         # ip -> sessões abertas ainda sem login
FTP_RAW_EXT = (".cr3", ".cr2", ".nef", ".arw", ".raf", ".dng", ".orf", ".rw2")   # ETERNA_FTP_RAW=descartar: recebe e descarta (sem 553)


def ftp_faixa_pasv():
    try:
        a, b = (int(x) for x in (os.environ.get("ETERNA_FTP_PASV") or "50000-50050").split("-", 1))
        if 1024 <= a <= b <= 65535:
            return a, b
    except ValueError:
        pass
    return 50000, 50050


def ftp_ip(a):
    return a[4:] if a.startswith("::ffff:") else a


class FTPSession(threading.Thread):
    def __init__(self, conn, addr, users, compartilhado=()):
        super().__init__(daemon=True)
        self.conn, self.addr, self.users = conn, addr, users
        self.compartilhado = {str(x).lower() for x in (compartilhado or ())}
        self.user = None
        self.login_ok = None   # o usuário cuja senha foi aceita: só ele vira dono das fotos (USER depois do login zera)
        self.ok = False
        self.cwd = "/"
        self.pasv = None       # socket de escuta (modo passivo)
        self.rest = 0
        self.tmpdir = None     # pasta temporária desta sessão (mkdtemp), nunca derivada do nome de usuário
        self.n = 0
        self.anonima = True    # conta em ftp_sem_login até a senha ser aceita (o ftp_server já contou na entrada)
        self.prazo = time.time() + FTP_LOGIN_S   # prazo ABSOLUTO para entrar: NOOP, FEAT e afins antes do login não renovam
        self.tentativas = 0    # USER e PASS sem login nesta conexão (até FTP_TENTATIVAS pares); acima disso a conexão fecha
        self.fechar = False

    def marca_login(self, logado):
        """Passa a sessão de "sem login" para "logada" (ou volta, num USER depois do login) e ajusta o tempo de espera."""
        ip = ftp_ip(self.addr[0])
        with lock:
            if logado and self.anonima:
                ftp_sem_login[ip] = ftp_sem_login.get(ip, 1) - 1
                if ftp_sem_login[ip] <= 0:
                    ftp_sem_login.pop(ip, None)
            elif not logado and not self.anonima:
                ftp_sem_login[ip] = ftp_sem_login.get(ip, 0) + 1
            self.anonima = not logado
        if not logado:
            self.prazo = time.time() + FTP_LOGIN_S       # voltou a ficar sem login: prazo novo (as tentativas continuam contando)
        try:
            self.conn.settimeout(FTP_OCIOSO_S if logado else FTP_LOGIN_S)
        except OSError:
            pass

    def send(self, line):
        try:
            self.conn.sendall((line + "\r\n").encode("utf-8", "replace"))
        except Exception:
            pass

    def data_conn(self):
        """A conexão de dados do modo passivo, só do mesmo IP do controle (outro IP é fechado e a espera continua); None se não veio."""
        if not self.pasv:
            return None
        fim = time.time() + 20
        try:
            while True:
                resto = fim - time.time()
                if resto <= 0:
                    return None
                self.pasv.settimeout(resto)
                try:
                    d, a = self.pasv.accept()
                except (socket.timeout, OSError):
                    return None
                if ftp_ip(a[0]) == ftp_ip(self.addr[0]):
                    d.settimeout(FTP_DADOS_S)
                    return d
                print("ftp: conexão de dados de %s recusada (controle em %s)" % (a[0], self.addr[0]))
                try:
                    d.close()
                except OSError:
                    pass
        finally:
            try:
                self.pasv.close()
            except OSError:
                pass
            self.pasv = None

    def run(self):
        try:
            self._run()
        finally:
            with lock:
                ip = ftp_ip(self.addr[0])
                ftp_conexoes[ip] = ftp_conexoes.get(ip, 1) - 1
                if ftp_conexoes[ip] <= 0:
                    ftp_conexoes.pop(ip, None)
                if self.anonima:
                    ftp_sem_login[ip] = ftp_sem_login.get(ip, 1) - 1
                    if ftp_sem_login[ip] <= 0:
                        ftp_sem_login.pop(ip, None)
            if self.pasv:
                try:
                    self.pasv.close()
                except OSError:
                    pass
            if self.tmpdir:
                shutil.rmtree(self.tmpdir, ignore_errors=True)

    def _run(self):
        self.conn.settimeout(FTP_LOGIN_S)         # sem login: 25 s; depois do 230, 5 min parado encerra
        self.send("220 Eterna FTP pronto")
        f = self.conn.makefile("rb")
        try:
            while True:
                if self.anonima:                     # sem login: só o tempo que resta do prazo, conte o que for mandado
                    resto = self.prazo - time.time()
                    if resto <= 0:
                        self.send("421 Tempo para entrar esgotado")
                        break
                    self.conn.settimeout(resto)
                try:
                    raw = f.readline(FTP_LINHA + 1)
                except socket.timeout:
                    if self.anonima:
                        self.send("421 Tempo para entrar esgotado")
                    break
                if not raw:
                    break
                if self.anonima and time.time() > self.prazo:
                    self.send("421 Tempo para entrar esgotado")
                    break
                if len(raw) > FTP_LINHA or not raw.endswith(b"\n"):
                    self.send("500 Linha longa demais")   # linha sem fim ou gigante: fecha sem guardar o resto
                    break
                line = raw.decode("utf-8", "replace").strip()
                if not line:
                    continue
                parts = line.split(" ", 1)
                cmd = parts[0].upper()
                arg = parts[1] if len(parts) > 1 else ""
                self.handle(cmd, arg)
                if cmd == "QUIT" or self.fechar:
                    break
        except Exception as ex:
            print("ftp sessão:", ex)
        finally:
            try:
                self.conn.close()
            except Exception:
                pass

    def handle(self, cmd, arg):
        if cmd in ("USER", "PASS") and self.anonima:
            self.tentativas += 1                       # cada USER e cada PASS sem login: 3 tentativas = 3 pares
            if self.tentativas > 2 * FTP_TENTATIVAS:
                self.send("421 Muitas tentativas nesta conexão")
                self.fechar = True
                return
        if cmd == "USER":
            self.ok, self.login_ok = False, None      # trocar de usuário pede a senha de novo
            self.marca_login(False)
            self.user = arg.strip().lower()[:64]
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
                self.ok, self.login_ok = True, self.user
                self.marca_login(True)
                with lock:
                    state["ftp"]["last_user"] = self.user
                print(f"ftp: {self.user} conectado de {self.addr[0]}")
                self.send("230 Bem-vindo ao Eterna, " + self.user)
            else:
                self.ok, self.login_ok = False, None
                ftp_falhou(self.addr[0])
                print("ftp: login recusado para %r de %s" % (re.sub(r"[^\w.@-]", "?", self.user or "")[:40], self.addr[0]))
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
        if not self.ok or not self.login_ok:
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
                self.pasv = None
            a, b = ftp_faixa_pasv()
            for pp in random.sample(range(a, b + 1), b - a + 1):
                sk = socket.socket()
                if os.name != "nt":                # porta em TIME_WAIT volta a servir (no Windows o REUSEADDR deixaria dividir a porta)
                    sk.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                try:
                    sk.bind(("0.0.0.0", pp))
                    sk.listen(1)
                    self.pasv = sk
                    break
                except OSError:
                    sk.close()
            if not self.pasv:
                self.send("425 Sem porta livre para o modo passivo"); return
            port = self.pasv.getsockname()[1]
            if cmd == "EPSV":
                self.send(f"229 Modo passivo (|||{port}|)")
            else:
                ip = self.conn.getsockname()[0].replace(".", ",")
                self.send(f"227 Modo passivo ({ip},{port // 256},{port % 256})")
            return
        if cmd in ("PORT", "EPRT"):
            self.send("502 Use o modo passivo (PASV)"); return
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
            name = re.sub(r"[^\w.\- ]", "_", os.path.basename(arg.strip().replace("\\", "/")))[-120:].lstrip(".") or "foto_%d.jpg" % int(time.time())
            if name.lower().endswith(FTP_RAW_EXT) and os.environ.get("ETERNA_FTP_RAW") == "descartar":
                d = self.data_conn()               # câmera em RAW+JPEG que trava com 553: recebe e joga fora, sem gravar
                if not d:
                    self.send("425 Abra a conexão de dados (modo passivo)"); return
                self.send("150 Pode enviar")
                total = 0
                try:
                    while total <= 2 * FOTO_ENVIO_MAX:
                        ch = d.recv(256 * 1024)
                        if not ch:
                            break
                        total += len(ch)
                except OSError:
                    pass
                finally:
                    d.close()
                self.send("226 Recebido (RAW descartado)"); return
            if not name.lower().endswith((".jpg", ".jpeg")):
                if self.pasv:                      # nada é gravado: a conexão de dados nem é aceita
                    self.pasv.close()
                    self.pasv = None
                self.send("553 Só fotos JPEG"); return
            d = self.data_conn()
            if not d:
                self.send("425 Abra a conexão de dados (modo passivo)"); return
            self.send("150 Pode enviar")
            if not self.tmpdir:
                os.makedirs(FTPTMP, exist_ok=True)
                self.tmpdir = tempfile.mkdtemp(prefix="s-", dir=FTPTMP)
            self.n += 1
            tmp = os.path.join(self.tmpdir, "%d_%s" % (self.n, name))
            size = 0
            caiu = grande = False
            try:
                with open(tmp, "wb") as out:
                    while True:
                        chunk = d.recv(256 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > FOTO_ENVIO_MAX:
                            grande = True
                            break
                        out.write(chunk)
            except OSError:
                caiu = True
            finally:
                d.close()
            self.rest = 0
            if grande:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
                print("ftp: %s passou de %d MB; recusado" % (name, FOTO_ENVIO_MAX // (1024 * 1024)))
                self.send("552 Arquivo grande demais"); return
            st = os.stat(tmp)
            if caiu or not jpeg_completo(tmp, st.st_size):
                with lock:
                    state["ftp"]["incompletas"] = state["ftp"].get("incompletas", 0) + 1
                print(f"ftp: {name} chegou incompleto ({size/1e6:.1f} MB), recusado; a câmera manda de novo")
                try:
                    os.remove(tmp)
                except OSError:
                    pass
                self.send("426 Transferência incompleta, envie de novo")
                return
            # v80 (segurança B1): o dono é sempre o login aceito. Subpasta = fotógrafo só para login marcado como "compartilhado"
            # em ~/Eterna/ftp.json e só se a subpasta for um fotógrafo cadastrado (CWD /outro não troca o dono da foto).
            quem = self.login_ok
            sub = self.cwd.strip("/").split("/")[-1].lower()
            if self.login_ok in self.compartilhado and sub and (sub in self.users or sub in PHOTOGRAPHERS):
                quem = sub
            r = ingest_file(tmp, name, st, quem, "ftp", move=True)
            if os.path.exists(tmp):
                try:
                    os.remove(tmp)
                except OSError:
                    pass
            if r is None:                          # não gravou: a câmera manda de novo
                self.send("451 Não deu para gravar; envie de novo"); return
            if r == "new":
                save_index()
            with lock:
                state["ftp"]["received"] += 1
            self.send("226 Recebido " + name)
            return
        self.send("502 Comando não suportado: " + cmd)


def ftp_server():
    if os.environ.get("ETERNA_FTP") == "0":
        print("  FTP embutido:      desligado (ETERNA_FTP=0)")
        return
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
            ip = ftp_ip(addr[0])
            with lock:
                demais = ftp_conexoes.get(ip, 0) >= FTP_POR_IP or sum(ftp_conexoes.values()) >= FTP_TOTAL \
                    or ftp_sem_login.get(ip, 0) >= FTP_SEM_LOGIN_IP or sum(ftp_sem_login.values()) >= FTP_TOTAL - FTP_RESERVA
                if not demais:
                    ftp_conexoes[ip] = ftp_conexoes.get(ip, 0) + 1
                    ftp_sem_login[ip] = ftp_sem_login.get(ip, 0) + 1
            if demais:
                try:
                    conn.sendall(b"421 Muitas conexoes; tente de novo\r\n")
                    conn.close()
                except OSError:
                    pass
                continue
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
        if not (c.get("host") and c.get("user")):
            return None
        if not rftp_host_ok(str(c["host"])) or int(c.get("port") or 21) not in (21, 990):
            rftp["erro"] = "servidor fora da rede do ponto (ftp-remoto-hosts.txt) ou porta diferente de 21/990"
            return None
        return c
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


RFTP_HOSTS = os.path.join(HOME, "ftp-remoto-hosts.txt")     # nomes (ou IPs fora da rede interna) aceitos para o FTP do estádio


def rftp_host_ok(host):
    """O FTP do estádio fica na rede do ponto: IP privado (10/8, 172.16/12, 192.168/16) ou um nome listado no servidor."""
    import ipaddress
    try:
        ip = ipaddress.ip_address(host)
        if ip.version == 4 and any(ip in ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")):
            return True
    except ValueError:
        pass
    try:
        with open(RFTP_HOSTS, encoding="utf-8") as f:
            return host.lower() in {x.strip().lower() for x in f if x.strip() and not x.lstrip().startswith("#")}
    except OSError:
        return False


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
            b = str(c["base_url"]).rstrip("/")
            if (b[:-len("/api/v1")] if b.endswith("/api/v1") else b) not in ROVER_BASES:
                print("  Roverpix: endereço em roverpix.json não é um dos oficiais; configuração ignorada")
                return None
            return c
    except Exception:
        pass
    return None


ROVER_BASES = ("https://beta.api.roverpix.com", "https://api.roverpix.com")    # os únicos destinos da chave da Roverpix
PR_COMPOSE_HORA = 300                                                           # montagens do Photoroom por posto ou pessoa, por hora


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
        nm = re.sub(r"[<>\"'`&]", "", str(p.get("photographer_name") or "")).strip()[:60]   # nome vem de fora: nunca vira HTML
        pdv = re.sub(r"[<>\"'`&]", "", str(p.get("pdv_name") or "")).strip()[:60]
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


# ---------- v84/v97: recorte local da pessoa (sem Photoroom, sem custo) ----------
# v97 (plano docs/planos/2026-11-10-recorte-birefnet-sessoes.md): um recorte só, BiRefNet-general + a regra do Eduardo
# (docs/fundos-ia-regras.md, regra 16: fica o que é da pessoa e encosta nela; sai o que está solto). u2net_human_seg,
# isnet-general-use e MoveNet são auxiliares da regra, nunca opção de recorte; sem o BiRefNet não há fundos de IA (A1).
# Os modelos rodam num PROCESSO FILHO (agente/eterna-recorte.py): o BiRefNet em CPU passa de 4,7 GB e, se o sistema o matar
# por falta de memória, só o recorte cai (FTP, vendas e Checkout seguem). O PNG leva só a pessoa (RGB zerado fora), lado
# até 3000 px, e uma cópia de 2400 px para a prévia. Cache em ~/Eterna/recortes/ por até 2 dias (limpar_recortes), com a
# marca da versão do recorte (.versao): recorte de versão antiga é apagado na partida. A montagem com as regras de cada
# fundo é do app (canvas). Nada é importado no topo: sem rembg o agente segue e a rota responde 503.
RECORTES = os.path.join(HOME, "recortes")
REC_MODELOS = ("birefnet-general", "u2net_human_seg", "isnet-general-use")
REC_POSE = "movenet_multipose_lightning_1.onnx"          # em ~/Eterna/modelos (MODELOS); baixado pelo instalador
REC_POSE_SHA = "61c25a6fc887b0e8d14517c3d66fdaf36c0e7a7ec0d50f74ed41a32ca1485184"
REC_VERSAO = "birefnet-1"
REC_VERSOES = "rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2"
REC_COMO = ("rode agente/instalar-recorte (Mac: instalar-recorte.command; Windows: instalar-recorte.bat; servidor com placa NVIDIA: "
            "instalar-recorte.bat gpu): cria ~/Eterna/venv com %s e baixa %s e %s (cerca de 1,3 GB)"
            % (REC_VERSOES, ", ".join(REC_MODELOS), REC_POSE[:-5]))
REC_FILHO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eterna-recorte.py")   # testes podem trocar (m.REC_FILHO)
REC_ESPERA_FILHO = 300   # s: uma foto em CPU lenta (45 a 75 s na máquina de teste); acima disso o filho é reiniciado
REC_CARGA_SEG = 300      # s: abrir os 4 modelos
REC_LADO_MAX = 3000      # maior lado do PNG da impressão
REC_LADOS = (2400, 3000) # 2400 = prévia (cópia reduzida do de 3000, sem rodar os modelos de novo)
REC_TRAB = 1600          # maior lado da imagem entregue aos modelos; a máscara volta ao tamanho final
REC_CONC = 2 if os.environ.get("ETERNA_RECORTE_CONC") == "2" else 1   # 2 só vale com a placa de vídeo (CUDA): cada filho ocupa memória
REC_FILA_MAX = 24
REC_TAXA = 60            # recortes novos por minuto por IP (o cache não conta)
REC_DIAS = 2             # prazo do cache de recortes
REC_TETO_GB = float(os.environ.get("ETERNA_RECORTES_GB") or 5)   # teto do cache: apaga os mais antigos acima disso
try:
    REC_PISO_GB = float(os.environ.get("ETERNA_RECORTES_PISO_GB") or 10)   # v93: abaixo disto de espaço livre, as bases de IA esperam
except ValueError:
    REC_PISO_GB = 10.0
REC_ERRO_SEG = 60        # depois de um erro ao abrir os modelos (ou do filho morto), tenta de novo passado este tempo
# Segurança (10/11, item 1): o filho morto por falta de memória (-9/137) espera mais a cada vez (60, 120, 240 s) e, na 3ª
# morte seguida, o recorte para até o agente ser reiniciado (aviso em /status.recorte.parado). Antes de abrir o filho, a
# memória livre é conferida (psutil; no Linux sem psutil, /proc/meminfo): abaixo de REC_MEM_MIN_GB, recusa com o motivo.
REC_MORTES_MAX = 3
REC_MEM_MIN_GB = 6.0     # os testes trocam o atributo do módulo
REC_MSG_MEM = "memória insuficiente"
# o processo de recorte recebe só estas variáveis (nada de MODEL_CHECKSUM_DISABLED, PYTHONPATH, AWS_* ou outro segredo)
REC_ENV_PASSA = ("PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "TEMP", "TMP",
                 "TMPDIR", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PROGRAMFILES", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE",
                 "LANG", "LC_ALL", "LC_CTYPE", "REMBG_HOME", "U2NET_HOME", "ETERNA_RECORTE_GPU", "OMP_NUM_THREADS",
                 "CUDA_VISIBLE_DEVICES", "CUDA_PATH", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH")
REC_ENV_PREFIXOS = ()    # os testes acrescentam o prefixo das variáveis do filho falso
REC_PIDS = os.path.join(HOME, "ponto", "recorte-filhos.json")   # processos de recorte abertos (o agente novo encerra os antigos)
rec = {"carregado": False, "erro": None, "erro_em": 0, "espera_s": 60, "mortes_mem": 0, "parado": None, "mem_livre_gb": None, "feitos": 0, "ms_total": 0, "ms_ultimo": None, "pre_feitos": 0, "pre_falta": 0,
       "fila0": 0, "provedor": None, "carga_ms": None, "etapas_ms": None, "pico_mb": None, "reinicios": 0,
       "ia": {"feitos": 0, "erros": 0, "fila": 0, "atrasos": collections.deque(maxlen=200)}}
# Recorte antecipado: o cliente nunca espera o "Preparando sua foto especial". Os modelos abrem quando o Eterna liga, e cada
# sessão fechada é recortada em segundo plano (da mais nova para a mais velha); pedido ao vivo do Checkout passa na frente.
# ETERNA_PRE_RECORTE=0 desliga (servidor fraco): volta a recortar só quando o cliente pede.
REC_PRE = os.environ.get("ETERNA_PRE_RECORTE", "1") != "0"
# v93: fila com prioridade, itens (prio, seq, job). 0 = Checkout ao vivo (/recorte), 1 = IA da trilha ao vivo, 2 = IA da
# trilha atrasada (cartão), 3 = recorte antecipado. Um pid tem um trabalho só (rec_jobs): o segundo pedido espera o mesmo
# Event; o pedido mais urgente põe o mesmo trabalho de novo na fila (o trabalhador pula o que já pegou). REC_FILA_MAX
# conta só os pedidos de prioridade 0: a IA nunca dá fila_cheia ao cliente.
REC_PRIO_CHECKOUT, REC_PRIO_IA, REC_PRIO_IA_ATRASADA, REC_PRIO_ANTECIPADO = 0, 1, 2, 3
rec_fila = queue.PriorityQueue()
rec_jobs = {}                      # pid -> trabalho na fila ou em andamento (sob o rec_lock)
_rec_seq = itertools.count()
rec_lock = threading.Lock()        # só contadores e estado (o /status nunca espera a carga dos modelos)
rec_filhos = {}                    # índice do trabalhador -> {"p", "fila", "lock", "seq"} (o processo de recorte de cada um)
rec_filhos_lock = threading.Lock()
rec_threads = []
_rec_tl = threading.local()        # índice do trabalhador (o processo de recorte dele)
_rec_pose_ok = {}                  # (caminho, tamanho, mtime) -> sha confere (o /status não lê 19 MB a cada chamada)
_re_rec = re.compile(r"^(ag_)?([0-9a-f]{6,40})\.png$")


def rec_modelo(nome):
    """Arquivo do modelo já baixado (rembg 2.0.6x+ em ~/.rembg/models/<nome>/; com U2NET_HOME, em <U2NET_HOME>/models/<nome>/
    ou na pasta antiga), ou None. O agente nunca baixa modelo sozinho: quem baixa é o instalador (instalar-recorte)."""
    novos = os.path.expanduser(os.environ.get("REMBG_HOME") or "~/.rembg")
    antigos = os.path.expanduser(os.environ.get("U2NET_HOME") or "~/.u2net")
    for c in (os.path.join(novos, "models", nome, nome + ".onnx"), os.path.join(antigos, "models", nome, nome + ".onnx"),
              os.path.join(antigos, nome + ".onnx")):
        if os.path.isfile(c) and os.path.getsize(c) > 1_000_000:
            return c
    return None


def rec_pose_ok():
    """(ok, motivo) do MoveNet em ~/Eterna/modelos: arquivo presente e SHA-256 igual ao fixado no código (cache por
    tamanho e data do arquivo)."""
    p = os.path.join(MODELOS, REC_POSE)
    try:
        st = os.stat(p)
    except OSError:
        return False, "não instalado: modelo de pose ausente (%s)" % REC_POSE
    k = (p, st.st_size, st.st_mtime)
    v = _rec_pose_ok.get(k)
    if v is None:
        try:
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for b in iter(lambda: f.read(1 << 20), b""):
                    h.update(b)
            v = h.hexdigest() == REC_POSE_SHA
        except OSError:
            v = False
        _rec_pose_ok.clear()
        _rec_pose_ok[k] = v
    return (True, None) if v else (False, "não instalado: modelo de pose diferente do esperado (%s): rode instalar-recorte de novo" % REC_POSE)


REC_FALSO_SEG = None     # v93 (segurança S2): só os testes ligam (m.REC_FALSO_SEG = s): o "recorte" copia a foto e demora s


def _rec_falso():
    """Segundos do recorte falso dos testes, ou None (sempre None em produção: não há variável de ambiente para isto)."""
    v = REC_FALSO_SEG
    if v is None or isinstance(v, bool):
        return None
    try:
        return min(max(float(v), 0.0), 30.0)
    except (TypeError, ValueError):
        return None


def rec_estado():
    """(ok, motivo): rembg, onnxruntime, Pillow, numpy e OpenCV instalados, os 3 modelos do rembg e o MoveNet (com o SHA
    certo) baixados e sem erro recente."""
    if os.environ.get("ETERNA_SEM_RECORTE"):
        return False, "recorte desligado (ETERNA_SEM_RECORTE)"
    if _rec_falso() is not None:
        return True, None
    if not os.path.isfile(REC_FILHO):
        return False, "não instalado: falta o eterna-recorte.py na pasta do agente (%s)" % os.path.dirname(REC_FILHO)
    import importlib.util
    falta = [m for m in ("rembg", "onnxruntime", "PIL", "numpy", "cv2") if importlib.util.find_spec(m) is None]
    if falta:
        return False, "não instalado: faltam pacotes (" + ", ".join(falta) + ")"
    sem = [n for n in REC_MODELOS if not rec_modelo(n)]
    if sem:
        return False, "não instalado: modelos não baixados (" + ", ".join(sem) + ")"
    ok, motivo = rec_pose_ok()
    if not ok:
        return False, motivo
    return rec_espera()


def rec_espera():
    """(ok, motivo) do último erro do recorte: parado depois de REC_MORTES_MAX mortes por memória (até reiniciar o agente),
    ou esperando o prazo crescente (rec["espera_s"]) antes de tentar abrir o processo de novo."""
    with rec_lock:
        if rec["parado"]:
            return False, rec["parado"]
        if rec["erro"]:
            if time.time() - rec["erro_em"] < rec["espera_s"]:
                return False, rec["erro"]
            rec["erro"] = None         # passou o tempo: a próxima foto tenta abrir os modelos de novo
    return True, None


def rec_mem_livre_gb():
    """Memória livre (GB) para o processo de recorte: psutil (no venv do recorte) ou /proc/meminfo; None se não dá para medir."""
    try:
        import psutil
        return psutil.virtual_memory().available / 1024 ** 3
    except Exception:
        pass
    try:
        with open("/proc/meminfo", encoding="ascii") as f:
            for linha in f:
                if linha.startswith("MemAvailable:"):
                    return int(linha.split()[1]) / 1024 ** 2
    except (OSError, ValueError, IndexError):
        pass
    return None


def rec_env():
    """Ambiente limpo do processo de recorte: só a lista REC_ENV_PASSA (e os prefixos dos testes)."""
    passa = {k.upper() for k in REC_ENV_PASSA}
    return {k: v for k, v in os.environ.items() if k.upper() in passa or (REC_ENV_PREFIXOS and k.upper().startswith(REC_ENV_PREFIXOS))}


def _rec_pids_ler():
    try:
        with open(REC_PIDS, encoding="utf8") as f:
            j = json.load(f)
        return [x for x in j if isinstance(x, dict) and isinstance(x.get("pid"), int)] if isinstance(j, list) else []
    except (OSError, ValueError):
        return []


def _rec_pids_gravar():
    with rec_filhos_lock:
        lst = [{"pid": f["p"].pid, "agente": os.getpid(), "criado": f.get("criado")} for f in rec_filhos.values()
               if f.get("p") is not None and f["p"].poll() is None]
    try:
        os.makedirs(os.path.dirname(REC_PIDS), exist_ok=True)
        _grava_privado(REC_PIDS, json.dumps(lst))
    except OSError:
        pass


def _rec_e_filho(pid, criado=None):
    """True se o processo pid é um eterna-recorte.py (psutil; sem psutil, /proc no Linux). Nunca mata processo de outro tipo."""
    try:
        import psutil
        p = psutil.Process(pid)
        if criado and abs(p.create_time() - criado) > 2:
            return False                                 # o número foi reaproveitado por outro processo
        return any(os.path.basename(c) == os.path.basename(REC_FILHO) for c in p.cmdline())
    except ImportError:
        pass
    except Exception:
        return False
    try:
        with open("/proc/%d/cmdline" % pid, "rb") as f:
            return any(os.path.basename(c.decode("utf8", "replace")) == os.path.basename(REC_FILHO) for c in f.read().split(b"\0") if c)
    except OSError:
        return False


def rec_orfaos_encerrar():
    """Na partida: o processo de recorte deixado por um agente que caiu (gravado em REC_PIDS) é encerrado, para não segurar
    a memória do novo. Devolve quantos foram encerrados."""
    import signal
    n = 0
    for x in _rec_pids_ler():
        pid = x["pid"]
        if pid == os.getpid() or not _rec_e_filho(pid, x.get("criado")):
            continue
        try:
            os.kill(pid, signal.SIGTERM if hasattr(signal, "SIGTERM") else 9)
            n += 1
            print("  recorte: processo antigo %d encerrado (de uma partida anterior)" % pid)
        except OSError:
            pass
    try:
        os.remove(REC_PIDS)
    except OSError:
        pass
    return n


def _pct(v, q):
    if not v:
        return None
    v = sorted(v)
    return round(v[min(len(v) - 1, int(q * len(v)))], 1)


def rec_livre_gb():
    """Espaço livre (GB) no disco dos recortes, ou None se não deu para medir."""
    try:
        return shutil.disk_usage(RECORTES if os.path.isdir(RECORTES) else HOME).free / 1024 ** 3
    except OSError:
        return None


def rec_status():
    ok, motivo = rec_estado()
    livre = rec_livre_gb()
    lig = bool(ia_cfg().get("ligada"))     # fora do sess_lock (lê o estado.db)
    with rec_filhos_lock:
        vivo = any(f["p"] is not None and f["p"].poll() is None for f in rec_filhos.values())
    with rec_lock:
        n = rec["feitos"]
        ia = rec["ia"]
        return {"ok": ok, "motivo": motivo, "carregado": rec["carregado"], "modelos": list(REC_MODELOS),
                "modelo": REC_MODELOS[0], "auxiliares": list(REC_MODELOS[1:]) + [REC_POSE[:-5]], "versao": REC_VERSAO,
                "provedor": rec["provedor"], "carga_ms": rec["carga_ms"], "etapas_ms": rec["etapas_ms"], "pico_mb": rec["pico_mb"],
                "filho": {"vivo": vivo, "reinicios": rec["reinicios"], "mortes_memoria": rec["mortes_mem"], "espera_s": rec["espera_s"]},
                "parado": rec["parado"], "mem_livre_gb": rec["mem_livre_gb"], "mem_min_gb": REC_MEM_MIN_GB,
                "fila": sum(1 for j in rec_jobs.values() if not j["pego"]),
                "antecipado": {"ligado": REC_PRE, "escolhidas": rec.get("pre_escolhidas", 0), "feitos": rec["pre_feitos"], "faltam": rec["pre_falta"]},
                "feitos": n, "ms_medio": int(rec["ms_total"] / n) if n else None, "ms_ultimo": rec["ms_ultimo"],
                "simultaneos": 2 if REC_CONC == 2 and rec.get("provedor") == "cuda" else 1,
                **({"falso": True} if _rec_falso() is not None else {}),
                "ia": {"ligada": lig, "fila": ia["fila"], "feitos": ia["feitos"], "erros": ia["erros"],
                       "pausa_disco": bool(rec.get("ia_pausa_disco")), "livre_gb": round(livre, 1) if livre is not None else None,
                       "piso_gb": REC_PISO_GB,
                       "atraso_p50_s": _pct(ia["atrasos"], 0.5), "atraso_p90_s": _pct(ia["atrasos"], 0.9)}}


def _rec_filho_leitor(p, fila):
    """Lê as linhas do stdout do filho (só JSON) para a fila; None no fim (o filho morreu ou fechou)."""
    try:
        for linha in p.stdout:
            linha = linha.strip()
            if not linha:
                continue
            try:
                j = json.loads(linha)
            except ValueError:
                continue                                # stdout do filho é só protocolo; linha estranha é ignorada
            if isinstance(j, dict):
                fila.put(j)
    except Exception:
        pass
    fila.put(None)


def _rec_filho_erro(p, padrao):
    """Motivo do filho que terminou: "memória insuficiente" quando o sistema o matou (-9 / 137)."""
    try:
        rc = p.wait(timeout=5)
    except Exception:
        rc = None
    if rc in (-9, 137, 9):
        return "recorte parou: memória insuficiente (código %s)" % rc
    return "%s (código %s)" % (padrao, rc)


def _rec_filho_matar(f):
    p = f.get("p")
    f["p"] = None
    if p is not None:
        try:
            p.kill()
        except Exception:
            pass
        try:
            p.wait(timeout=5)
        except Exception:
            pass


def _rec_erro(motivo):
    """Erro do recorte: espera REC_ERRO_SEG; morte por memória dobra a espera a cada vez e para na REC_MORTES_MAX-ésima."""
    with rec_lock:
        rec["erro"] = motivo[:200]
        rec["erro_em"] = time.time()
        rec["carregado"] = False
        if REC_MSG_MEM + " (código" in motivo:
            rec["mortes_mem"] += 1
            rec["espera_s"] = REC_ERRO_SEG * 2 ** (rec["mortes_mem"] - 1)
            if rec["mortes_mem"] >= REC_MORTES_MAX:
                rec["parado"] = ("recorte parado: o processo foi encerrado por falta de memória %d vezes seguidas. Feche programas "
                                 "ou use um computador com 16 GB e reinicie o agente" % rec["mortes_mem"])
                print("  " + rec["parado"])
        else:
            rec["espera_s"] = REC_ERRO_SEG


def rec_carregar(i=0):
    """Abre o processo de recorte do trabalhador i (uma vez; de novo se morreu), fora do rec_lock, e espera o "pronto".
    Devolve o registro do filho. Erro: rec["erro"] com o motivo e exceção (nova tentativa depois de REC_ERRO_SEG)."""
    if _rec_falso() is not None:
        return None
    with rec_filhos_lock:
        f = rec_filhos.setdefault(i, {"p": None, "fila": None, "lock": threading.Lock(), "seq": 0})
    with f["lock"]:
        return _rec_abrir(f)


def _rec_abrir(f):
    """Com o f["lock"]: o filho vivo, ou abre um novo."""
    if f["p"] is not None and f["p"].poll() is None:
        return f
    if f["p"] is not None:                             # morreu entre uma foto e outra
        motivo = _rec_filho_erro(f["p"], "o recorte parou")
        f["p"] = None
        _rec_erro(motivo)
        raise RuntimeError(motivo)
    okp, mot = rec_espera()                            # parado (3 mortes por memória) ou dentro do prazo: não abre
    if not okp:
        raise RuntimeError(mot)
    livre = rec_mem_livre_gb()
    with rec_lock:
        rec["mem_livre_gb"] = round(livre, 1) if livre is not None else None
    if livre is not None and livre < REC_MEM_MIN_GB:
        motivo = ("memória livre insuficiente para abrir o recorte: %.1f GB livres, precisa de %.0f GB (feche programas; o "
                  "recorte é do servidor do ponto)" % (livre, REC_MEM_MIN_GB))
        _rec_erro(motivo)
        raise RuntimeError(motivo)
    env = rec_env()
    try:
        p = subprocess.Popen([sys.executable, REC_FILHO, "--inbox", INBOX, "--recortes", RECORTES, "--modelos", MODELOS],
                             stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None, text=True, bufsize=1,
                             encoding="utf-8", env=env, close_fds=True)
    except Exception as ex:
        _rec_erro("erro ao abrir o recorte: %s" % str(ex)[:160])
        raise
    fila = queue.Queue()
    threading.Thread(target=_rec_filho_leitor, args=(p, fila), daemon=True).start()
    f.update(p=p, fila=fila, criado=time.time())
    _rec_pids_gravar()
    try:
        j = fila.get(timeout=REC_CARGA_SEG)
    except queue.Empty:
        j = {"pronto": False, "erro": "os modelos demoraram mais de %d s para abrir" % REC_CARGA_SEG}
    if j is None:
        motivo = _rec_filho_erro(p, "o recorte parou ao abrir os modelos")
        _rec_filho_matar(f)
        _rec_erro(motivo)
        raise RuntimeError(motivo)
    if not j.get("pronto"):
        _rec_filho_matar(f)
        _rec_erro("erro ao abrir os modelos: %s" % str(j.get("erro") or "")[:160])
        raise RuntimeError(rec["erro"])
    prov = j.get("provedor") if j.get("provedor") in ("cuda", "cpu", "directml") else "cpu"
    with rec_lock:
        if rec["carregado"] is False and rec.get("_abriu"):
            rec["reinicios"] += 1
        rec.update(carregado=True, erro=None, provedor=prov, carga_ms=j.get("carga_ms"), _abriu=True)
    if REC_CONC == 2 and prov != "cuda":
        print("  recorte: ETERNA_RECORTE_CONC=2 ignorado (só com a placa de vídeo; aqui é %s)" % prov)
    print("  recorte: modelos abertos em %.1f s (%s)" % ((j.get("carga_ms") or 0) / 1000.0, "placa de vídeo" if prov == "cuda" else prov))
    return f


def rec_filho_recortar(pid, origem, destino, i=0):
    """Manda a foto ao processo de recorte e espera (até REC_ESPERA_FILHO). Devolve a resposta {"ok", "ms", "pico_mb"}.
    Filho que morre no meio: rec["erro"] com o motivo e exceção (o próximo pedido, passado REC_ERRO_SEG, reabre)."""
    with rec_filhos_lock:
        f = rec_filhos.setdefault(i, {"p": None, "fila": None, "lock": threading.Lock(), "seq": 0})
    with f["lock"]:
        _rec_abrir(f)
        f["seq"] += 1
        rid = "%s.%d" % (pid, f["seq"])
        try:
            f["p"].stdin.write(json.dumps({"id": rid, "origem": origem, "destino": destino, "trab": REC_TRAB}) + "\n")
            f["p"].stdin.flush()
        except Exception:
            motivo = _rec_filho_erro(f["p"], "o recorte parou")
            _rec_filho_matar(f)
            _rec_erro(motivo)
            raise RuntimeError(motivo)
        fim = time.time() + REC_ESPERA_FILHO
        while True:
            try:
                j = f["fila"].get(timeout=max(0.1, fim - time.time()))
            except queue.Empty:
                _rec_filho_matar(f)
                _rec_erro("recorte demorou mais de %d s numa foto: reiniciado" % REC_ESPERA_FILHO)
                raise RuntimeError("tempo")
            if j is None:
                motivo = _rec_filho_erro(f["p"], "o recorte parou no meio de uma foto")
                f["p"] = None
                _rec_erro(motivo)
                raise RuntimeError(motivo)
            if j.get("id") == rid:
                break
    if not j.get("ok"):
        raise ValueError(str(j.get("erro") or "não deu para recortar")[:200])
    with rec_lock:
        rec["mortes_mem"] = 0                      # foto feita: as mortes por memória deixam de ser seguidas
        rec["espera_s"] = REC_ERRO_SEG
        rec["etapas_ms"] = {k: int(v) for k, v in (j.get("ms") or {}).items() if isinstance(v, (int, float))}
        if isinstance(j.get("pico_mb"), (int, float)):
            rec["pico_mb"] = int(j["pico_mb"])
    return j


def rec_versao_cache():
    """Na partida (antes do rec_pre_loop): recorte feito por outra versão do recorte não serve. Se ~/Eterna/recortes/.versao
    não é REC_VERSAO, apaga só os *.png e *.tmp da pasta (link simbólico é desfeito, nunca seguido) e grava a marca."""
    marca = os.path.join(RECORTES, ".versao")
    try:
        with open(marca, encoding="utf8") as f:
            if f.read().strip() == REC_VERSAO:
                return 0
    except OSError:
        pass
    n = 0
    try:
        os.makedirs(RECORTES, exist_ok=True)
        with os.scandir(RECORTES) as it:
            for e in it:
                if not e.name.endswith((".png", ".tmp")):
                    continue
                try:
                    if e.is_symlink() or e.is_file(follow_symlinks=False):
                        os.remove(e.path)              # num link, apaga o link (o alvo fica)
                        n += 1
                except OSError:
                    pass
        _grava_privado(marca, REC_VERSAO)
    except OSError as ex:
        print("  recortes: não troquei a versão do cache (%s)" % str(ex)[:80])
    if n:
        print("  recortes: %d recorte(s) da versão anterior apagado(s) (agora %s)" % (n, REC_VERSAO))
    return n


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
    """Recorta a foto `origem` e grava ~/Eterna/recortes/<pid>.png (3000 px) e, se pedido, <pid>_2400.png. Devolve o caminho.
    v97: o de 3000 sai do processo de recorte (rec_filho_recortar, BiRefNet + regra); o de 2400 é cópia reduzida dele."""
    from PIL import Image
    lado = REC_LADO_MAX if lado not in REC_LADOS else lado
    destino = rec_arquivo(pid, lado)
    if os.path.exists(destino):
        return destino
    cheio = rec_arquivo(pid)
    falso = _rec_falso()
    if falso is not None:                           # só nos testes (ETERNA_RECORTE_FALSO): cópia da foto, sem modelos
        os.makedirs(RECORTES, exist_ok=True)
        if not os.path.exists(cheio):
            time.sleep(falso)
            shutil.copyfile(origem, cheio + ".f.tmp")
            os.chmod(cheio + ".f.tmp", 0o600)
            os.replace(cheio + ".f.tmp", cheio)
            with rec_lock:
                rec["feitos"] += 1
        if destino != cheio:
            shutil.copyfile(cheio, destino + ".f.tmp")
            os.chmod(destino + ".f.tmp", 0o600)
            os.replace(destino + ".f.tmp", destino)
        return destino
    if not os.path.exists(cheio):
        t0 = time.time()
        os.makedirs(RECORTES, exist_ok=True)
        rec_filho_recortar(pid, origem, cheio, getattr(_rec_tl, "i", 0))   # MAX_PIXELS, EXIF, 3000 px, RGB zerado fora, 600: no filho
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


def limpar_recortes(agora=None, guardar=None):
    """Uma vez por dia (galeria_loop): apaga recortes com mais de REC_DIAS dias, os de foto que saiu da biblioteca e,
    acima de REC_TETO_GB, os mais antigos. Devolve quantos apagou. v93: o recorte de foto de IA de sessão de hoje, fechada
    ou ainda aberta (guardar = sess_ia_hoje, calculado antes e fora dos locks) fica, nem por idade nem pelo teto, enquanto a foto está na biblioteca."""
    agora = agora or time.time()
    try:
        nomes = os.listdir(RECORTES)
    except OSError:
        return 0
    if guardar is None:
        guardar = sess_ia_hoje(agora)
    with lock:
        vivas = {pid: e.get("file") for pid, e in lib.items()}
    itens, n = [], 0
    for nome in nomes:
        p = os.path.join(RECORTES, nome)
        try:
            st = os.stat(p)
        except OSError:
            continue
        if nome.startswith("."):
            # v97: a marca .versao fica sempre (sem ela a próxima partida apagaria o cache todo); o .rec-*.tmp do processo de
            # recorte, só passada 1 h (em andamento ele é trocado pelo PNG)
            if nome.endswith(".tmp") and agora - st.st_mtime > 3600:
                try:
                    os.remove(p)
                    n += 1
                except OSError:
                    pass
            continue
        pid = nome.split(".")[0].split("_")[0]
        fonte = vivas.get(pid)
        if pid in guardar and fonte and os.path.exists(fonte) and not nome.endswith(".tmp"):
            continue                                 # v93: base de IA de hoje (critério 17)
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


def rec_trabalho(i=0):
    """Trabalhador i da fila de recorte (cada um com o seu processo de recorte: _rec_tl.i)."""
    _rec_tl.i = i
    while True:
        _, _, job = rec_fila.get()
        with rec_lock:
            if job["pego"]:
                continue                             # o mesmo trabalho entrou de novo com prioridade maior: já foi
            job["pego"] = True
            if job["p0"]:
                rec["fila0"] = max(0, rec["fila0"] - 1)
        try:
            if job.get("cancel"):                    # v93: LGPD com o trabalho ainda na fila
                job["err"] = "cancelado"
            else:
                job["res"] = rec_fazer(job["pid"], job["file"], job["lado"])
                with lock:
                    viva = job["pid"] in lib
                if (job.get("na_lib") and not viva) or job.get("cancel"):   # LGPD durante o recorte: nada do recorte fica
                    rec_apagar(job["pid"])
                    job["err"], job["res"] = "cancelado", None
        except Exception as ex:
            job["err"] = str(ex)[:200]
        finally:
            with rec_lock:
                if rec_jobs.get(job["pid"]) is job:
                    del rec_jobs[job["pid"]]
                if job["ia"]:
                    ia = rec["ia"]
                    ia["fila"] = max(0, ia["fila"] - 1)
                    if job.get("err"):
                        ia["erros"] += 1
                    else:
                        ia["feitos"] += 1
                        if job.get("u"):
                            ia["atrasos"].append(max(0.0, time.time() - job["u"]))
            job["ev"].set()


def rec_apagar(pid):
    """Apaga os recortes de 3000 e 2400 e os temporários do pid (LGPD)."""
    for f in [rec_arquivo(pid, lx) for lx in REC_LADOS] + glob.glob(os.path.join(RECORTES, glob.escape(pid) + "*.tmp")):
        try:
            os.remove(f)
        except OSError:
            pass


def rec_cancelar(pid):
    """LGPD: o trabalho de recorte do pid (na fila ou em andamento) não deixa arquivo."""
    with rec_lock:
        j = rec_jobs.get(pid)
        if j is not None:
            j["cancel"] = True


def rec_enfileirar(pid, origem, lado=REC_LADO_MAX, prio=REC_PRIO_CHECKOUT, ia=False, u=None):
    """Põe o recorte na fila sem esperar e devolve (trabalho, erro). Pedido da mesma foto reaproveita o trabalho que já
    existe (um recorte só); o mais urgente sobe a prioridade dele. Só a prioridade 0 conta para o REC_FILA_MAX."""
    lado = lado if lado in REC_LADOS else REC_LADO_MAX
    with lock:
        na_lib = pid in lib                          # foto que sai da biblioteca durante o recorte não deixa arquivo
    with rec_lock:
        while len(rec_threads) < (2 if REC_CONC == 2 and rec.get("provedor") == "cuda" else 1):
            t = threading.Thread(target=rec_trabalho, args=(len(rec_threads),), daemon=True)
            t.start()
            rec_threads.append(t)
        job = rec_jobs.get(pid)
        if job is None:
            if prio == REC_PRIO_CHECKOUT and rec["fila0"] >= REC_FILA_MAX:
                return None, "fila_cheia"
            job = {"pid": pid, "file": origem, "lado": lado, "ev": threading.Event(), "pego": False, "prio": prio,
                   "p0": prio == REC_PRIO_CHECKOUT, "ia": bool(ia), "u": u, "na_lib": na_lib}
            rec_jobs[pid] = job
            if job["p0"]:
                rec["fila0"] += 1
            if ia:
                rec["ia"]["fila"] += 1
            rec_fila.put((prio, next(_rec_seq), job))
            return job, None
        if ia and not job["ia"]:
            job["ia"], job["u"] = True, u
            rec["ia"]["fila"] += 1
        if not job["pego"]:
            job["lado"] = min(job["lado"], lado)     # v93 (revisão R1): o de 2400 sai junto do de 3000 (rec_fazer)
        if not job["pego"] and prio < job["prio"]:
            if prio == REC_PRIO_CHECKOUT and not job["p0"]:
                if rec["fila0"] >= REC_FILA_MAX:
                    return job, None                 # segue na fila com a prioridade que tinha (nunca fila_cheia por dedup)
                job["p0"] = True
                rec["fila0"] += 1
            job["prio"] = prio
            rec_fila.put((prio, next(_rec_seq), job))
        return job, None


def rec_pedir(pid, origem, lado=REC_LADO_MAX, espera=180, prio=REC_PRIO_CHECKOUT):
    """Põe o recorte na fila (1 de cada vez; 2 só com CUDA e ETERNA_RECORTE_CONC=2) e espera. Devolve (caminho, erro)."""
    lado = lado if lado in REC_LADOS else REC_LADO_MAX
    job, erro = rec_enfileirar(pid, origem, lado, prio)
    if erro:
        return None, erro
    if not job["ev"].wait(espera):
        return None, "tempo"
    if job.get("err"):
        return None, job["err"]
    p = rec_arquivo(pid, lado)
    if os.path.exists(p):
        return p, None
    try:                                             # o trabalho era do outro tamanho: a cópia sai do de 3000 já pronto
        return rec_fazer(pid, origem, lado), None
    except Exception as ex:
        return None, str(ex)[:200]


def rec_pre_escolha(fotos, x=None):
    """Só as fotos que o Checkout vai mostrar com fundo de IA. v93 (plano dos cliques de IA, A14): as bases de IA da
    sessão (x["ia"]) quando ela tem; senão as 2 primeiras da sessão. O extra por pessoa (até 10 recortes por sessão) saiu:
    desde a v91 B a selfie mostra a sessão inteira; menor ou escola pede o recorte na hora, com prioridade.
    v97: com o recorte na CPU (lento: 45 a 75 s por foto), só as bases; sem as 2 normais do plano B (a fila não cresce
    sem fim). Leva cuja visita já tem as bases (D4): nada (o Checkout monta com as bases da visita). Leva sem bases por
    outro motivo (poucas fotos, volante): as 2 primeiras, como antes."""
    if x is not None and (x.get("ia_regra") or {}).get("motivo") == "visita_ja_tem":
        return []
    with rec_lock:
        cpu = rec.get("provedor") == "cpu"
    if x is not None and x.get("ia") and cpu:
        return list(x["ia"])
    if x is not None and x.get("ia"):
        # revisão (A14): as bases e, com a prioridade mais baixa, as 2 primeiras fotos normais, o plano B do Checkout quando as
        # duas bases são ruins (lojaAIAntigo); só usa a máquina livre
        ia = list(x["ia"])
        return ia + [p for p in fotos if p not in ia][:2]
    return list(fotos[:2])


def rec_pre_loop():
    """Recorte antecipado (ver REC_PRE): abre os modelos já na partida e recorta, das sessões fechadas dos dias da busca
    (ETERNA_BUSCA_DIAS), só as fotos de rec_pre_escolha, da sessão mais nova para a mais velha. Uma de cada vez, com a
    prioridade mais baixa da fila (o Checkout e as bases de IA passam na frente)."""
    if not REC_PRE:
        return
    time.sleep(15)                                  # deixa a biblioteca e as sessões carregarem
    vistos = set()
    while True:
        try:
            ok, _ = rec_estado()
            if ok:
                rec_carregar()                          # modelos na memória antes do primeiro cliente
                dias = {time.strftime("%Y-%m-%d", time.localtime(time.time() - i * 86400)) for i in range(BUSCA_DIAS)}
                with sess_lock:
                    ss = sorted((x for x in sess.values() if x["status"] == "fechada" and not x.get("removida") and x["dia"] in dias),
                                key=lambda x: -(x.get("fechada_em") or 0))
                    fotos_ss = [(list(x["fotos"]), {"ia": list(x.get("ia") or []), "ia_regra": dict(x.get("ia_regra") or {})}) for x in ss]
                pids = []
                for fs, xx in fotos_ss:
                    pids += rec_pre_escolha(fs, xx)
                falta = [p for p in pids if p not in vistos and not os.path.exists(rec_arquivo(p))]
                with rec_lock:
                    rec["pre_falta"] = len(falta)
                    rec["pre_escolhidas"] = len(pids)
                for pid in falta:
                    with lock:
                        e = lib.get(pid)
                    vistos.add(pid)
                    if not e or not e.get("file") or not os.path.exists(e["file"]):
                        continue
                    path, erro = rec_pedir(pid, e["file"], REC_LADO_MAX, espera=600, prio=REC_PRIO_ANTECIPADO)
                    with rec_lock:
                        rec["pre_falta"] = max(0, rec["pre_falta"] - 1)
                        if path:
                            rec["pre_feitos"] += 1
                    if not path:
                        print("  recorte antecipado %s: %s" % (pid, erro))
        except Exception as ex:
            print("  recorte antecipado:", str(ex)[:160])
        time.sleep(15)


def _ia_ocupadas(pr):
    """v93 (critério 11): vagas de IA que a prioridade pr enxerga. Conta o trabalho de IA já pego e o que espera na fila
    com prioridade igual ou melhor; o de prioridade pior ainda não pego não conta (a melhor passa na frente dele na fila).
    No pior caso há IA_FILA_ALVO de cada prioridade esperando. Com o rec_lock."""
    return sum(1 for j in rec_jobs.values() if j["ia"] and (j["pego"] or j["prio"] <= pr))


def rec_ia_loop():
    """v93: as bases de IA (os N primeiros cliques da sessão ainda aberta) vão para a fila assim que chegam, com
    prioridade 1 (ao vivo) ou 2 (cartão), no máximo IA_FILA_ALVO de cada vez para o Checkout passar na frente de verdade.
    As vagas são por prioridade (_ia_ocupadas): base pior ainda não pega não toma a vaga da melhor (critério 11).
    Gera o de 3000 e o de 2400 de uma vez. Nada com o recorte indisponível ou no modo Photoroom (o rec_pre_loop recupera)."""
    pend = {}                                       # pid -> prioridade (ordem de chegada)
    andando = {}                                    # pid -> (trabalho, prioridade, tentativas): confere o 2400 no fim (R1)
    andando_n = {}
    while True:
        time.sleep(0.5)
        try:
            with sess_lock:
                novos = list(sess_ia_novos)
                sess_ia_novos.clear()
            for pid, pr in novos:
                pend[pid] = min(pr, pend.get(pid, 9))
            for pid, (job, pr, n) in list(andando.items()):
                if not job["ev"].is_set():
                    continue
                del andando[pid]
                # o trabalho reaproveitado já estava em andamento só com o de 3000: pede de novo (a cópia de 2400 é barata)
                if not job.get("err") and not job.get("cancel") and n < 2 and not os.path.exists(rec_arquivo(pid, 2400)):
                    pend[pid] = min(pr, pend.get(pid, 9))
                    andando_n[pid] = n + 1
            while len(pend) > IA_NOVOS_MAX:
                pend.pop(next(iter(pend)))
            if not pend:
                continue
            ok, _ = rec_estado()
            if not ok or fundos_modo() == "photoroom":
                pend.clear()
                andando_n.clear()
                time.sleep(5)
                continue
            livre = rec_livre_gb()
            pausa = livre is not None and livre < REC_PISO_GB
            with rec_lock:
                if pausa and not rec.get("ia_pausa_disco"):
                    print("  recorte das bases de IA em pausa: %.1f GB livres (piso %.0f GB, ETERNA_RECORTES_PISO_GB)" % (livre, REC_PISO_GB))
                rec["ia_pausa_disco"] = pausa
            if pausa:
                time.sleep(5)
                continue
            for pid in sorted(pend, key=lambda p: pend[p]):
                pr = pend[pid]
                with rec_lock:
                    livres = IA_FILA_ALVO - _ia_ocupadas(pr)
                if livres <= 0:
                    break                                # em ordem de prioridade: as seguintes não têm vaga também
                del pend[pid]
                if os.path.exists(rec_arquivo(pid)) and os.path.exists(rec_arquivo(pid, 2400)):
                    continue
                with lock:
                    e = lib.get(pid)
                    u = _num((meta.get(pid) or {}).get("u")) if isinstance(meta.get(pid), dict) else 0.0
                if not e or not e.get("file") or not os.path.exists(e["file"]):
                    continue
                job, erro = rec_enfileirar(pid, e["file"], 2400, pr, ia=True, u=u or None)
                if job is not None:
                    andando[pid] = (job, pr, andando_n.pop(pid, 0))
        except Exception as ex:
            print("  recorte das bases de IA:", str(ex)[:160])


# v84 (segurança): o Photoroom só monta quando o interruptor do Painel de controle estiver em "Photoroom" também aqui.
# O app grava o modo pelo loopback (POST /fundos/modo); sem o arquivo, vale "local" e o /photoroom/compose dá 409.
FUNDOS_MODO_CFG = os.path.join(HOME, "fundos-modo.json")


def fundos_modo():
    """v97 (Eduardo, 10/11, D6): sempre "local" (BiRefNet neste servidor). O Photoroom fica guardado e inativo: a chave em
    ~/Eterna/photoroom.json continua (nada é apagado), o fundos-modo.json é ignorado e o /photoroom/compose responde 409."""
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
GAL_DIAS = 60                                            # validade máxima de uma galeria (a mesma do app)
GAL_FALHAS, GAL_BLOQUEIO = 5, 15 * 60
GAL_TETO_DIA = 20       # v96.1: selfies sem acerto por galeria de venda por dia, somando todos os IPs; depois, galeria parada até amanhã
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


class PagamentoDesligado(Pagamento):
    """Sem adquirente real: a galeria não vende pelo celular (POST /g/<t>/pagamento responde 501, "compra": false)."""
    def criar(self, pedido):
        raise NotImplementedError("compra_indisponivel")

    def consultar(self, id):
        return {"id": id, "status": "desconhecido"}

    def webhook(self, corpo, cabecalhos):
        raise NotImplementedError


def pagamento_escolhido():
    """O pagamento simulado (aprova tudo, venda marcada como teste) só existe com ETERNA_PAGAMENTO=simulado E ETERNA_MODO_TESTE=1."""
    tipo = (os.environ.get("ETERNA_PAGAMENTO") or "desligado").lower()
    if tipo == "simulado" and os.environ.get("ETERNA_MODO_TESTE") == "1":
        return PagamentoSimulado()
    if tipo in ("simulado", "desligado"):
        return PagamentoDesligado()
    raise NotImplementedError("ETERNA_PAGAMENTO=%s ainda não implementado (fase 2; chaves em ~/Eterna/pagamento.json)" % tipo)


PAGAMENTO = pagamento_escolhido()


def compra_online():
    return not isinstance(PAGAMENTO, PagamentoDesligado)


def _iso(t=None):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t if t is not None else time.time()))


def _epoch(s):
    try:
        return _dt.datetime.fromisoformat(str(s).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0


def gal_expirou(m, agora=None):
    return bool(m.get("encerrada")) or _epoch(m.get("expira")) <= (agora if agora is not None else time.time())


def _gal_confere_sessoes(m, fotos, compradas=()):
    """v91 (segurança 5): na galeria de sessões que o agente montou (hoje e ontem em memória), toda foto precisa ser de uma
    sessão do manifesto: foto de outra sessão do agente (outra família) é recusada. Na galeria da venda que juntou sessões
    pela selfie, a foto também precisa estar em m.so[sessão]. Manifesto só com sessões que o agente não conhece (amostra,
    sessão montada só no navegador) passa sem esta conferência.
    v93 (segurança S1): base de IA nunca é publicada como foto (navegador antigo): sai de `fotos` (a lista é alterada aqui)
    sem recusar o manifesto, menos a que já foi comprada (nesta publicação ou na gravada, `compradas`). Devolve quantas saíram."""
    ses = [str(x)[:40] for x in (m.get("sessoes") or [])[:200]]
    so = m.get("so") if isinstance(m.get("so"), dict) else {}
    with sess_lock:
        conhecidas = {c: set(sess[c]["fotos"]) | set(sess[c]["pend"]) for c in ses if c in sess}
        dono = {pid_lib(f["id"]): sess_pid.get(pid_lib(f["id"])) for f in fotos} if conhecidas else {}
        ia = set()                                   # v93: base de IA nunca é publicada como foto (navegador antigo)
        for f in fotos:
            p = pid_lib(f["id"])
            x = sess.get(sess_pid.get(p) or "")
            if x is not None and p in (x.get("ia") or ()):
                ia.add(p)
    n = 0
    if ia:
        manter = [f for f in fotos if pid_lib(f["id"]) not in ia or f.get("direito") == "comprada" or f["id"] in compradas]
        n = len(fotos) - len(manter)
        fotos[:] = manter
    if not conhecidas:
        return n
    for f in fotos:
        pid = pid_lib(f["id"])
        de = [c for c, ps in conhecidas.items() if pid in ps]
        if not de and dono.get(pid) and dono[pid] not in ses:
            raise ValueError("foto de outra sessão")
        c = de[0] if de else f["sessao"]
        if c in so and isinstance(so[c], list) and f["id"] not in so[c] and pid not in so[c]:
            raise ValueError("foto fora da escolha da venda")
    return n


def gal_expira_ok(v):
    """Validade pedida pelo navegador, nunca além de agora + GAL_DIAS (sem data ou inválida: agora + GAL_DIAS)."""
    teto = time.time() + GAL_DIAS * 86400
    try:
        t = _epoch(str(v)[:40]) if v else None
    except Exception:
        t = None
    return _iso(min(t, teto) if t else teto)


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
        precos = {"dig": max(0.0, float(pr.get("dig") or 0)), "todas": max(0.0, float(pr.get("todas")))}
    except Exception:
        raise ValueError("preços inválidos")
    catalogo = []
    for c in (m.get("catalogo") if isinstance(m.get("catalogo"), list) else [])[:20]:
        if isinstance(c, dict) and re.match(r"^[a-z0-9_]{1,20}$", str(c.get("id") or "")) and re.match(r"^[0-9a-f]{40}$", str(c.get("sku") or "")):
            try:
                catalogo.append({"id": c["id"], "sku": c["sku"], "nome": str(c.get("nome") or "")[:80], "preco": round(max(0.0, float(c.get("preco"))), 2),
                                 "digital": "todas" if c.get("digital") == "todas" else max(0, int(c.get("digital") or 0)),
                                 "kind": "pacote" if c.get("kind") == "pacote" else "adicional"})
            except (TypeError, ValueError):
                pass
    codigo = m.get("codigo") if isinstance(m.get("codigo"), str) and _re_codigo.match(m.get("codigo")) else None
    return {"v": 1, "token": m["token"], "codigo": codigo, "tipo": m["tipo"], "venue": str(m.get("venue") or "")[:40],
            "nome": (str(m["nome"])[:120] if m.get("nome") else None), "sessoes": [str(s)[:40] for s in (m.get("sessoes") or [])[:200]],
            "menor": bool(m.get("menor")), "criada": str(m.get("criada") or _iso())[:40], "expira": gal_expira_ok(m.get("expira")),
            "precos": precos, "catalogo": catalogo, "moeda": "BRL", "fotos": fotos, "envio": {"compradas": "pendente", "vitrine": "pendente"}}


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
    if velho.get("menor"):
        novo["menor"] = True                     # grupo de menor marcado no servidor não é desmarcado pelo navegador
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
            if m and not gal_expirou(m):
                vis_protege_manifesto(m)            # v97: leva de escola ou de menor só entra em visita por Juntar
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
    ultima_rec = 0
    while True:
        try:
            token = gal_fila.get(timeout=600)
            try:
                gal_processar(token)
            except Exception as ex:
                print("  galeria: erro ao preparar", token[:8], ex)
        except queue.Empty:
            pass
        if time.time() - ultima_rec > 3600:         # v93: recortes de hora em hora (as bases de IA enchem o disco mais rápido)
            ultima_rec = time.time()
            try:
                limpar_recortes()
            except Exception as ex:
                print("  recortes: erro na limpeza", ex)
        if time.time() - ultima_limpeza > 86400:
            ultima_limpeza = time.time()
            if rostos["ligado"]:
                try:
                    limpar_rostos()
                except Exception as ex:
                    print("  rostos: erro na limpeza", ex)
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
            if varias_pessoas(fs):
                return {"rosto": True, "varias": True, "sims": {}}
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


FILE_TAXA = 120                 # v91: /file/ por IP da rede por minuto (o loopback não conta)


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


_falhas_gal = {}       # token -> [dia, selfies sem acerto no dia]  (v96.1, todos os IPs, só em memória)
GAL_ALERTAS = os.path.join(GALERIAS, "alertas.jsonl")


def _amanha():
    lt = time.localtime()
    return time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday + 1, 0, 0, 0, 0, 0, -1))


def gal_teto(token):
    """v96.1: galeria de venda com GAL_TETO_DIA selfies sem acerto hoje (todos os IPs) fica parada até amanhã.
    Devolve 0 (pode) ou o instante em que libera."""
    with gal_lock:
        f = _falhas_gal.get(token)
        return _amanha() if f and f[0] == time.strftime("%Y-%m-%d") and f[1] >= GAL_TETO_DIA else 0


def gal_teto_soma(token):
    """Soma uma selfie sem acerto na galeria; na que chega ao teto, grava o alerta (sem token, só um resumo dele)."""
    dia = time.strftime("%Y-%m-%d")
    with gal_lock:
        for k in [k for k, v in _falhas_gal.items() if v[0] != dia]:
            _falhas_gal.pop(k, None)
        f = _falhas_gal.setdefault(token, [dia, 0])
        f[1] += 1
        n = f[1]
    if n == GAL_TETO_DIA:
        g = hashlib.sha256(token.encode()).hexdigest()[:12]
        print("  ALERTA galeria %s: %d selfies sem acerto hoje, parada até amanhã" % (g, n))
        try:
            anexar(GAL_ALERTAS, {"tipo": "galeria_teto_selfie", "galeria": g, "n": n, "dia": dia, "em": _iso()})
        except Exception:
            pass
    return n


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


def gal_livres(m):
    """v96.1 (decisão do Eduardo, 10/11): na galeria de uma venda (tipo sessao) o QR sozinho abre as compradas e as cortesias
    daquela venda, sem selfie (o pai que pagou e não aparece nas fotos). A selfie só acrescenta as à venda em que a pessoa
    aparece (regra da v95). Grupo de escola (evento): só pelo rosto (v77)."""
    if m["tipo"] != "sessao":
        return set()
    return {f["id"] for f in m["fotos"] if f["direito"] in ("comprada", "cortesia")}


def galeria_obj(token, m, pids=()):
    """pids = acerto da selfie (as à venda em que a pessoa aparece). Na venda (sessao), as compradas e cortesias entram sempre:
    o QR sozinho já as abre (decisão do Eduardo, 10/11), e seguem o manifesto de agora."""
    pids = set(pids) | gal_livres(m)
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
            "precos": m["precos"], "fotos": fotos, "compra": compra_online()}


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


# ---------- Fila do fotógrafo (v87) e sessões (v91) ----------
# Painel de senhas das fotos chegando, por fotógrafo: Clicando agora (fotografando), Chegando (subindo) e Já no Checkout
# (pronta). v91: a Fila é montada a partir das sessões do agente (uma regra só, S12 do plano
# docs/planos/2026-10-30-sessoes-por-rosto-e-tempo.md). Regra: ff_lock e sess_lock nunca são pegos com o lock na mão
# (o meta é copiado antes, com o lock, e solto) e nunca um dentro do outro.
def _sess_pausa():
    try:
        v = int(os.environ.get("ETERNA_SESSAO_PAUSA") or 0)
    except ValueError:
        v = 0
    return v if 2 <= v <= 600 else 60


def _sess_limites():
    """(fica, novo, funde). ETERNA_SESS_LIMITES="0.38,0.25,0.45" só nos testes."""
    try:
        x = tuple(float(a) for a in os.environ.get("ETERNA_SESS_LIMITES", "").split(","))
        if len(x) == 3 and all(0 < a < 1 for a in x):
            return x
    except ValueError:
        pass
    return (LIMITE_TALVEZ, 0.25, LIMITE)


SESS_PAUSA = _sess_pausa()      # S1: 60 s sem clique fecha a sessão; igual ao SESSAO_PAUSA_S do app. ETERNA_SESSAO_PAUSA (2 a 600) só nos testes
FF_PAUSA = SESS_PAUSA           # apelido (v87)
SESS_ATRASO = 600               # S3: foto com chegada − clique acima disto vai para a trilha atrasada (cartão)
SESS_ROSTO_ESPERA = 20          # S6: prazo para a leitura do rosto, desde a chegada; depois vale só o tempo
SESS_LIM_FICA, SESS_LIM_NOVO, SESS_LIM_FUNDE = _sess_limites()   # S5/S7: 0,38 / 0,25 / 0,45
SESS_ROSTOS_MAX = 40            # S9: vetores guardados por sessão (só memória, só sessões não fechadas)
SESS_REPETIDO = 0.7             # S9: vetor com sim >= isto com um já guardado não entra
SESS_CAND_MAX = 3               # S7: sessões candidatas por trilha (a aberta + as separadas)
SESS_RET_DIAS = 60              # S14: arquivos de sessão
SESS_Q_SCORE, SESS_Q_LARG, SESS_Q_FRONTAL = 0.80, 60, 0.35   # S5: rosto de qualidade (vota por sessão nova)
SESS_CLIQUE_ANTES, SESS_CLIQUE_DEPOIS = 48 * 3600, 600       # S2: clique válido em [u − 48 h, u + 10 min]
FF_PRONTA_MIN = 15              # D1 (Eduardo, 30/10): sai da coluna final 15 min depois de ficar pronto
FF_PIDS = 6                     # miniaturas por grupo aberto (risco 2: o pid abre o original)
FF_PRONTAS_MAX = 24             # cartões na coluna final
FF_FUNCAO = os.path.join(HOME, "ponto", "funcao.json")
FF_TIPOS = ("campo", "volante", "folga")
FF_MODOS = ("grupo", "chute", "livre")
_re_ff_point = re.compile(r"^[a-z0-9_-]{1,24}$")
ff_lock = threading.Lock()      # rostos_pendentes e a função do dia
ff_desvio = {}                  # série (ou chave) -> deque das últimas 50 diferenças chegada − clique (sob o sess_lock)
rostos_pendentes = set()        # pids na fila de rostos (só conta com os rostos ligados)
ff_funcao = {"dia": "", "map": {}}
_ff_cad = {"t": 0.0, "v": None}


def _ff_hoje(t=None):
    return time.strftime("%Y-%m-%d", time.localtime(t if t is not None else time.time()))


def ff_quem(o, autor, dono, serie, s="", cad=None):
    """(fotógrafo|None, fonte). Regra D2 da v85: 1) a origem, se cadastrada; 2) o autor ou o dono gravado na câmera, se
    cadastrado; 3) nenhum, e a fonte diz de onde veio (nunca o nome de subpasta não cadastrada nem a série completa)."""
    cad = cad if cad is not None else ff_cadastrados()
    via = "cartão" if s == "cartao" else "ftp"
    k = sem_acento(o or "").strip()
    if k and k in cad:
        return k, via
    for nome in (autor, dono):
        k = sem_acento(nome or "").strip()
        if k and (k in cad or k.split()[0] in cad):
            return (k if k in cad else k.split()[0]), via
    serie = re.sub(r"\D", "", str(serie or ""))
    if serie:
        return None, "câmera ···" + serie[-4:]
    if o == "ftp-estadio":
        return None, "ftp-estadio"
    return None, ("cartão" if s == "cartao" else "pasta")


def ff_cadastrados():
    """Fotógrafos que a fila aceita como nome (sem acento): os cadastrados, menos os logins "compartilhado" do ftp.json
    (L3: login compartilhado sem subpasta não é um fotógrafo). v91 (revisão 11): cache de 30 s."""
    c = _ff_cad
    agora = time.time()
    if c["v"] is not None and 0 <= agora - c["t"] < 30:
        return set(c["v"])
    cad = {sem_acento(x) for x in ftp_cadastrados()}
    try:
        cad -= {sem_acento(x) for x in (json.load(open(FTPCFG)).get("compartilhado") or [])}
    except Exception:
        pass
    c.update(t=agora, v=frozenset(cad))
    return set(cad)


def _ff_func_snapshot(chave):
    if not chave or ff_funcao.get("dia") not in (_ff_hoje(), time.strftime("%Y-%m-%d", time.gmtime())):
        return None
    f = (ff_funcao.get("map") or {}).get(chave)
    return dict(f) if isinstance(f, dict) else None


def ff_rostos_ligados():
    """Rostos ligados, ou ainda iniciando (o leitor abre depois do boot): nos dois casos a foto espera a leitura."""
    return bool(rostos.get("ligado") or rostos.get("motivo") == "iniciando")


def sess_rostos_on():
    """S6: a separação por rosto está ativa (OpenCV disponível e leitor ligado ou iniciando)."""
    return not os.environ.get("ETERNA_SEM_OPENCV") and ff_rostos_ligados()


def ff_rosto_fila(pid):
    """A foto entrou na fila de rostos (só registra enquanto os rostos estão ligados ou iniciando)."""
    if not ff_rostos_ligados():
        return
    with ff_lock:
        rostos_pendentes.add(pid)


def ff_rosto_lido(pid):
    """A leitura dos rostos da foto terminou (com erro também)."""
    with ff_lock:
        rostos_pendentes.discard(pid)


def ff_esquecer(pid):
    """LGPD: a foto apagada sai da contagem de rostos pendentes (a sessão é limpa por sess_esquecer)."""
    with ff_lock:
        rostos_pendentes.discard(pid)


def ff_json(agora=None):
    """S12: os grupos da Fila são as sessões de hoje (id = código LP). Contrato da v87 sem mudança."""
    agora = time.time() if agora is None else agora
    hoje = _ff_hoje(agora)
    lig = ff_rostos_ligados()
    with ff_lock:
        rp = set(rostos_pendentes) if lig else set()
    out = []
    with sess_lock:
        _sess_tick(agora)
        for x in sess.values():
            if x["dia"] != hoje or x.get("removida"):
                continue
            todos = x["fotos"] + x["pend"]
            if not todos:
                continue
            pe = None
            if x["status"] == "fechada":
                if any(p in rp for p in todos):
                    e = "subindo"            # ainda na fila de rostos: a selfie do Checkout não acharia
                else:
                    pe = x.get("_pronta")
                    if pe is None:
                        pe = x["_pronta"] = max(float(x.get("fechada_em") or 0), float(x.get("_rfim") or 0) if lig else 0.0)
                    if agora - pe > FF_PRONTA_MIN * 60:
                        continue             # sai da coluna final (a sessão continua em /sessoes)
                    e = "pronta"
            elif x["status"] == "aberta" and not x.get("atrasada") and agora - float(x.get("cap1") or 0) <= SESS_PAUSA:
                e = "fotografando"
            else:
                e = "subindo"                # cartão em andamento, separada fechando ou aberta sem clique recente
            ts = x.get("_t") or {}
            novas = sorted(todos, key=lambda p: -(ts.get(p) or (0, 0))[0])[:FF_PIDS] if e != "pronta" else []
            # v93: bases de IA. Aberta: os N primeiros cliques até agora (pids só no grupo aberto, risco 5); fechada: x["ia"]
            if x["status"] == "fechada":
                rg = x.get("ia_regra") or {}
                ian, iam, iab = int(rg.get("n") or 0), rg.get("motivo"), list(x.get("ia") or [])
            else:
                ian, iam = _sess_ia_regra(x)
                iab = sorted(todos, key=lambda p: (ts.get(p) or (0, 0)))[:ian] if ian else []
            out.append({"id": x["card"], "estado": e, "fotografo": x.get("fotografo"), "fonte": x.get("fonte"),
                        "funcao": dict(x["funcao"]) if isinstance(x.get("funcao"), dict) else None,
                        "inicio": x.get("aberta_em"), "ultima_chegada": x.get("ultima_chegada"),
                        "ultimo_clique": x.get("cap1") or x.get("ultima_chegada"), "pronta_em": pe, "n": len(todos),
                        "pids": novas, "ia": {"n": ian, "motivo": iam, "pids": iab if e != "pronta" else [], "_b": iab}})
        rev = sess_rev[0]
    for g in out:                                    # fora do sess_lock: o disco
        b = g["ia"].pop("_b")
        g["ia"]["prontas"] = sum(1 for p in b if os.path.exists(rec_arquivo(p, 2400)))
    prontas = sorted([g for g in out if g["estado"] == "pronta"], key=lambda g: -g["pronta_em"])[:FF_PRONTAS_MAX]
    mostrar = {g["id"] for g in prontas}
    grupos = sorted([g for g in out if g["estado"] != "pronta" or g["id"] in mostrar], key=lambda g: g["inicio"] or 0)
    return {"ok": True, "agora": agora, "rev": rev, "pausa": SESS_PAUSA, "pronta_min": FF_PRONTA_MIN, "grupos": grupos}


def ff_funcao_carregar():
    try:
        j = json.load(open(FF_FUNCAO))
        if isinstance(j, dict) and isinstance(j.get("map"), dict):
            with ff_lock:
                ff_funcao.update(dia=str(j.get("dia") or ""), map=j["map"])
    except Exception:
        pass


def ff_carregar():
    """No boot: só a função do dia (os grupos vêm das sessões, refeitas por sess_carregar)."""
    ff_funcao_carregar()
    return 0


# ---------- Sessões montadas no agente (v85 parte A do Ronaldo, regra nova da v90) ----------
# A sessão nasce aqui, igual em todos os navegadores. Regra (plano v91, S1 a S14): por fotógrafo e trilha (ao vivo ou
# atrasada), 60 s sem clique (hora do clique corrigida) abrem sessão nova; sem pausa, a foto espera a leitura do rosto
# (até 20 s) e abre sessão nova só quando todos os rostos principais são novos (sim < 0,25, rosto de qualidade). Sessão
# separada fica "fechando" até 60 s sem chegada e ainda pode se fundir (individuais antes do grupo). Só sessão
# "fechada" vai para o SIM e nunca muda (exceto LGPD). Vetores de rosto só em memória, só das sessões não fechadas.
# Gravadas em ~/Eterna/ponto/sessoes/AAAA-MM-DD.json (60 dias); em memória ficam hoje e ontem.
SESS_DIR = os.path.join(HOME, "ponto", "sessoes")
SESS_ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
sess_lock = threading.Lock()     # nunca pego com o lock, o ff_lock ou o _mat_lock na mão
sess = {}                        # card -> sessão (hoje e ontem)
sess_pid = {}                    # pid -> card (fotos e pendentes)
sess_aberta = {}                 # trilha -> card da sessão aberta
sess_cand = {}                   # trilha -> [cards "separada" ainda não fechadas], a mais nova no fim
sess_ultima = {}                 # trilha -> card da última sessão (motivo "pausa" em vez de "inicio")
sess_espera = {}                 # trilha -> [pids pendentes de rosto, na ordem do clique]
sess_info = {}                   # pid pendente -> {"t", "u", "trilha", "card"}
sess_faces_pid = {}              # pid pendente -> rostos lidos (só memória)
sess_rostos_mem = {}             # card não fechada -> [(pid, vetor)] (S9, só memória)
sess_rev = [0]
sess_seq = [0]
sess_sujo = set()                # dias com mudança ainda não gravada
sess_limpo = [""]                # dia da última limpeza de arquivos (S14)
sess_ia_novos = collections.deque(maxlen=IA_NOVOS_MAX)   # v93: (pid, prioridade) das bases de IA novas, para o rec_ia_loop
_SESS_DIA = re.compile(r"^(\d{4}-\d\d-\d\d)\.json$")


def _sess_codigo():
    while True:
        c = "LP" + "".join(secrets.choice(SESS_ALFA) for _ in range(7))
        if c not in sess:
            return c


def _sess_toca(x):
    sess_rev[0] += 1
    x["rev"] = sess_rev[0]
    sess_sujo.add(x["dia"])


def _sess_publico(x, disco=False):
    """Cópia para /sessoes (sem "k") ou para o arquivo (com "k"). Campos internos começam com "_" e nunca saem."""
    o = {}
    for kk, v in x.items():
        if kk.startswith("_") or (kk == "k" and not disco):
            continue
        o[kk] = list(v) if isinstance(v, list) else (dict(v) if isinstance(v, dict) else v)
    return o


def sess_pids_janela(desde):
    """pids das sessões (hoje e ontem em memória) cuja última foto (cap1, hora do clique corrigida; sem ela, a última
    chegada) é de desde em diante, com as pendentes. None se não há sessão nenhuma em memória (agente sem sessões)."""
    with sess_lock:
        if not sess:
            return None
        ok = set()
        for x in sess.values():
            if x.get("removida"):
                continue
            fim = _num(x.get("cap1")) or _num(x.get("ultima_chegada"))
            if fim >= desde:
                ok.update(x.get("fotos") or ())
                ok.update(x.get("pend") or ())
        return ok


def _num(v):
    try:
        v = float(v or 0)
        return v if v == v and v not in (float("inf"), float("-inf")) else 0.0
    except (TypeError, ValueError):
        return 0.0


def _dot(a, b):
    return sum(map(operator.mul, a, b))


def sess_clique(m, dk):
    """S2: (t, fonte_t). t = cap + menor desvio chegada − clique da série; sem cap, a data do arquivo de origem (mt); sem as
    duas, a chegada u. Clique corrigido fora de [u − 48 h, u + 10 min] é inválido (EXIF forjado não manda). v91 (revisão C1):
    o cap cru entra no desvio em ±48 h (câmera com o relógio adiantado também se corrige); a janela vale para o t. Com o sess_lock."""
    u = _num(m.get("u"))
    cap = _num(m.get("cap"))
    if cap and abs(u - cap) <= SESS_CLIQUE_ANTES:
        if (m.get("s") or "") != "cartao":   # a foto do cartão chega atrasada de propósito: não entra no desvio
            ff_desvio.setdefault(dk, collections.deque(maxlen=50)).append(u - cap)
        d = ff_desvio.get(dk)
        t = cap + (sess_desvio(d) if d else 0.0)
        if u - SESS_CLIQUE_ANTES <= t <= u + SESS_CLIQUE_DEPOIS:
            return t, "cap"
    mt = _num(m.get("mt"))
    if mt and u - SESS_CLIQUE_ANTES <= mt <= u + SESS_CLIQUE_DEPOIS:
        return mt, "mt"
    return u, "u"


def sess_desvio(d):
    """Desvio chegada − clique da série (revisão, 01/11): o menor valor depois de descartar os fora da curva (mais de
    max(3 x desvio absoluto mediano, 30 s) longe da mediana). Um EXIF forjado ou uma foto que chegou estranha não puxa a hora de
    todas as outras; o menor dos que sobram é o atraso de rede mais curto (o relógio da câmera)."""
    v = sorted(d)
    if len(v) < 3:
        return v[0]
    med = v[len(v) // 2]
    mad = sorted(abs(x - med) for x in v)[len(v) // 2]
    lim = max(3 * mad, 30.0)
    ok = [x for x in v if abs(x - med) <= lim]
    return ok[0] if ok else med


def sess_trilha(m, t, base=None):
    """S3: "dia|fotógrafo" (ao vivo) ou "dia|fotógrafo|t" (atrasada: cartão, ou clique há mais de 10 min da chegada)."""
    u = _num(m.get("u"))
    atrasada = (m.get("s") or "") == "cartao" or u - t > SESS_ATRASO
    # v91 (revisão S2): a trilha atrasada ganha o dia da CHEGADA (cartão de ontem descarregado hoje aparece hoje, no Upload e
    # no Checkout); a ao vivo, o dia do clique
    return _ff_hoje(u if atrasada else t) + "|" + (base or "?") + ("|t" if atrasada else ""), atrasada


def _sess_nova(trilha, t, u, motivo, m, chave, fonte, fonte_t, atrasada):
    """Cria a sessão do contrato (sem foto ainda). Com o sess_lock."""
    card = _sess_codigo()
    f = _ff_func_snapshot(chave)
    sess_seq[0] += 1
    x = {"card": card, "dia": trilha.split("|", 1)[0], "k": trilha, "fotografo": chave, "fonte": fonte,
         "ponto": f.get("point") if f and f.get("tipo") == "campo" else None, "funcao": f,
         "trilha": "atrasada" if atrasada else "vivo", "atrasada": bool(atrasada), "status": "aberta", "motivo": motivo,
         "origem": "agente", "aberta_em": u, "ultima_chegada": u, "cap0": t, "cap1": t, "fonte_t": fonte_t,
         "fechada_em": None, "fechada_por": None, "fotos": [], "pend": [], "dec": {}, "sim_abertura": None,
         "fundida_em": None, "removida": False, "rev": 0, "ia": [], "ia_regra": None,
         "_t": {}, "_guardar": set(), "_rfim": 0.0, "_n": sess_seq[0], "_fonte": {}, "_ia_vistos": set()}
    sess[card] = x
    return x


def _sess_ia_regra(x, cfg=None):
    """v93: (n, motivo) da regra dos cliques de IA para a sessão x. motivo None ou 'desligada' | 'volante' |
    'sem_funcao' | 'ponto_fora'. Usa a configuração já lida (ia_cfg_mem): nunca abre o banco com o sess_lock."""
    cfg = cfg or ia_cfg_mem()
    if not cfg.get("ligada"):
        return 0, "desligada"
    f = x.get("funcao")
    if not x.get("fotografo") or not isinstance(f, dict):
        return 0, "sem_funcao"                       # A4: sem função do dia ou sem cadastro, nada some da venda
    if f.get("tipo") == "volante":
        return (int(cfg["cliques"]), None) if cfg.get("volante") else (0, "volante")
    if f.get("tipo") != "campo":
        return 0, "sem_funcao"
    if f.get("point") not in (cfg.get("pontos") or ()):
        return 0, "ponto_fora"
    return int(cfg["cliques"]), None


def _sess_ia_cand(x):
    """v93: com a sessão ainda não fechada, os N primeiros cliques (fotos + pendentes, pela hora do clique corrigida) que
    ainda não foram pedidos vão para a fila de recorte de IA. Com o sess_lock."""
    if x.get("status") == "fechada" or x.get("removida"):
        return
    n, _ = _sess_ia_regra(x)
    if not n:
        return
    ts = x["_t"]
    vistos = x.setdefault("_ia_vistos", set())
    pr = 2 if x.get("atrasada") else 1
    for p in sorted(x["fotos"] + x["pend"], key=lambda p: ts.get(p, (0, 0)))[:n]:
        if p not in vistos:
            vistos.add(p)
            sess_ia_novos.append((p, pr))


def _sess_ia_fecha(x):
    """v93: no fechamento, ia = os N primeiros cliques; com N fotos ou menos, a regra não vale (poucas_fotos).
    v97 (D4, Eduardo 10/11: bases POR VISITA, as 2 primeiras fotos da família): se a visita da leva já tem outra leva
    fechada com bases, esta fecha sem bases (visita_ja_tem) e as fotos dela voltam todas para a venda."""
    n, mot = _sess_ia_regra(x)
    fs = x["fotos"]
    if n and not mot and len(fs) > n and _vis_ja_tem_ia(x["card"]):
        x["ia"] = []
        x["ia_regra"] = {"n": n, "motivo": "visita_ja_tem"}
        return
    x["ia"] = list(fs[:n]) if n and len(fs) > n else []
    x["ia_regra"] = {"n": n, "motivo": mot or ("poucas_fotos" if n and len(fs) <= n else None)}


def sess_ia_de(pids):
    """Quais destes pids são base de IA de alguma sessão em memória (hoje e ontem)."""
    with sess_lock:
        out = set()
        for p in pids:
            x = sess.get(sess_pid.get(p) or "")
            if x is not None and p in (x.get("ia") or ()):
                out.add(p)
        return out


def sess_ia_hoje(agora=None):
    """pids de IA das sessões de hoje (não removidas), para a limpeza dos recortes: das fechadas, x["ia"]; das ainda
    abertas (ou separadas, fechando), as bases já pedidas na chegada (_ia_vistos) e os N primeiros cliques de agora."""
    hoje = _ff_hoje(agora)
    out = set()
    with sess_lock:
        for x in sess.values():
            if x["dia"] != hoje or x.get("removida"):
                continue
            out.update(x.get("ia") or ())
            if x.get("status") != "fechada":
                out.update(x.get("_ia_vistos") or ())
                n, _ = _sess_ia_regra(x)
                if n:
                    ts = x.get("_t") or {}
                    out.update(sorted(x["fotos"] + x["pend"], key=lambda p: ts.get(p, (0, 0)))[:n])
    return out


def _sess_recalc(x):
    ts = x["_t"]
    todos = [p for p in x["fotos"] + x["pend"] if p in ts]
    if todos:
        x["cap0"] = min(ts[p][0] for p in todos)
        x["cap1"] = max(ts[p][0] for p in todos)
        x["ultima_chegada"] = max(ts[p][1] for p in todos)
        x["aberta_em"] = min(ts[p][1] for p in todos)
    x["fotos"].sort(key=lambda p: ts.get(p, (0, 0)))


def _sess_entra(x, pid, t, u, dec):
    if pid not in x["fotos"]:
        x["fotos"].append(pid)
    x["_t"][pid] = (t, u)
    x["dec"][pid] = dec
    sess_pid[pid] = x["card"]


def _sess_cands(trilha):
    """S7: a aberta e as separadas da trilha, das mais novas para as mais antigas, até SESS_CAND_MAX."""
    out = []
    a = sess_aberta.get(trilha)
    if a and a in sess:
        out.append(a)
    for c in reversed(sess_cand.get(trilha) or []):
        if c in sess and c not in out:
            out.append(c)
    return out[:SESS_CAND_MAX]


def _sess_vira_aberta(trilha, card, agora):
    """A sessão card passa a ser a aberta da trilha; a aberta anterior vira "separada" (fechando)."""
    old = sess_aberta.get(trilha)
    lst = sess_cand.setdefault(trilha, [])
    if card in lst:
        lst.remove(card)
    if old and old != card and old in sess and sess[old]["status"] != "fechada":
        sess[old]["status"] = "separada"
        lst.append(old)
        _sess_toca(sess[old])
    sess_aberta[trilha] = card
    sess[card]["status"] = "aberta"
    while len(lst) > SESS_CAND_MAX - 1:              # passou do limite de candidatas: a separada mais antiga fecha de vez
        _sess_fecha_uma(sess[lst[0]], agora, "pausa")
    if not lst:
        sess_cand.pop(trilha, None)


def _sess_fecha_uma(x, agora, por):
    """S8: fechamento definitivo. As fotos ainda pendentes de rosto ficam nesta sessão (só tempo)."""
    if x["status"] == "fechada":
        return
    tr = x["k"]
    for pid in list(x["pend"]):
        info = sess_info.pop(pid, None)
        sess_faces_pid.pop(pid, None)
        lst = sess_espera.get(tr)
        if lst and pid in lst:
            lst.remove(pid)
        t, u = (info["t"], info["u"]) if info else x["_t"].get(pid, (agora, agora))
        x["pend"].remove(pid)
        _sess_entra(x, pid, t, u, "t")
    if not sess_espera.get(tr):
        sess_espera.pop(tr, None)
    _sess_recalc(x)
    _sess_ia_fecha(x)
    fim = min(x["ultima_chegada"] + SESS_PAUSA, agora) if por == "pausa" else agora
    x.update(status="fechada", fechada_em=fim, fechada_por=por)
    x["_guardar"] = set()
    sess_rostos_mem.pop(x["card"], None)              # S9: os vetores somem quando a sessão fecha
    if sess_aberta.get(tr) == x["card"]:
        sess_aberta.pop(tr, None)
    lst = sess_cand.get(tr)
    if lst and x["card"] in lst:
        lst.remove(x["card"])
        if not lst:
            sess_cand.pop(tr, None)
    if not x["removida"]:
        sess_ultima[tr] = x["card"]
    _sess_toca(x)


def _sess_fundir(dest, orig, agora):
    """S7: as fotos, as pendentes e os rostos da origem vão para o destino (a mais antiga); a origem vira removida."""
    for pid in orig["fotos"]:
        t, u = orig["_t"].get(pid, (agora, agora))
        _sess_entra(dest, pid, t, u, orig["dec"].get(pid, "t"))
    for pid in orig["pend"]:
        if pid not in dest["pend"]:
            dest["pend"].append(pid)
        dest["_t"][pid] = orig["_t"].get(pid, (agora, agora))
        sess_pid[pid] = dest["card"]
        if pid in sess_info:
            sess_info[pid]["card"] = dest["card"]
    dest["_guardar"] |= orig["_guardar"]
    mem = sess_rostos_mem.setdefault(dest["card"], [])
    for pid, v in sess_rostos_mem.pop(orig["card"], []):
        if len(mem) < SESS_ROSTOS_MAX and not any(_dot(v, w) >= SESS_REPETIDO for _, w in mem):
            mem.append((pid, v))
    tr = orig["k"]
    if sess_aberta.get(tr) == orig["card"]:
        sess_aberta.pop(tr, None)
    lst = sess_cand.get(tr)
    if lst and orig["card"] in lst:
        lst.remove(orig["card"])
    orig.update(fotos=[], pend=[], dec={}, removida=True, fundida_em=dest["card"], status="fechada", fechada_em=agora,
                fechada_por=None, ia=[], ia_regra=None)
    orig["_t"], orig["_guardar"] = {}, set()
    dest.setdefault("_ia_vistos", set()).update(orig.get("_ia_vistos") or ())
    _sess_recalc(dest)
    _sess_ia_cand(dest)                              # A6: valem os N primeiros cliques da sessão fundida
    _sess_toca(orig)
    _sess_toca(dest)


def _sess_faces(faces):
    """[(larg, vetor, score, frontal)] -> [{"l","v","s","f"}] com o vetor normalizado em array('f') (Python puro, S10)."""
    out = []
    for f in faces or []:
        try:
            if isinstance(f, dict):
                larg, vet, sc, fr = f.get("l"), f.get("v"), f.get("s"), f.get("f")
            else:
                larg, vet, sc, fr = (list(f) + [None, None])[:4]
            v = array.array("f", [float(a) for a in vet])
            if len(v) != 128:
                continue
            n = _dot(v, v) ** 0.5 or 1.0
            v = array.array("f", [a / n for a in v])
            out.append({"l": float(larg or 0), "v": v, "s": float(sc) if sc is not None else 0.0, "f": bool(fr)})
        except (TypeError, ValueError):
            continue
    return out


def _sess_principais(fs):
    """S5: rosto principal = largura >= metade do maior rosto da foto e >= ROSTO_MIN (o fundo não conta)."""
    if not fs:
        return []
    mx = max(f["l"] for f in fs)
    return [f for f in fs if f["l"] >= 0.5 * mx and f["l"] >= ROSTO_MIN]


def _sess_qualidade(f):
    return f["s"] >= SESS_Q_SCORE and f["l"] >= SESS_Q_LARG and f["f"]


def _sess_sim(princ, card):
    """Maior cosseno entre os rostos principais da foto e os rostos guardados da sessão (None sem rosto guardado)."""
    mem = sess_rostos_mem.get(card)
    if not mem or not princ:
        return None
    return max(_dot(f["v"], v) for f in princ for _, v in mem)


def _sess_guarda_rostos(card, pid, princ):
    """S9: até SESS_ROSTOS_MAX vetores por sessão, sem repetido, por pid. Só sessão não fechada."""
    x = sess.get(card)
    if not x or x["status"] == "fechada" or not princ:
        return
    mem = sess_rostos_mem.setdefault(card, [])
    for f in princ:
        if len(mem) >= SESS_ROSTOS_MAX:
            break
        if any(_dot(f["v"], v) >= SESS_REPETIDO for _, v in mem):
            continue
        mem.append((pid, f["v"]))


def _sess_add(pid, m, cad, agora=None, faces_boot=None, boot=False):
    """Com o sess_lock na mão. m = cópia do meta[pid]. Devolve o card (ou None)."""
    agora = time.time() if agora is None else agora
    u = _num(m.get("u"))
    if not u or pid in sess_pid:
        return None
    s = m.get("s") or ""
    chave, fonte = ff_quem(m.get("o"), m.get("autor"), m.get("dono"), m.get("serie"), s, cad)
    serie = str(m.get("serie") or "")
    base = chave or ("cam:" + serie if serie else "src:" + fonte)
    t, fonte_t = sess_clique(m, serie or base)
    tr, atrasada = sess_trilha(m, t, base)
    x = sess.get(sess_aberta.get(tr) or "")
    if x is not None and x["status"] == "fechada":
        sess_aberta.pop(tr, None)
        x = None
    motivo = None
    if x is not None and (t - x["cap1"] > SESS_PAUSA or t < x["cap0"] - SESS_PAUSA):
        for c in [x["card"]] + list(sess_cand.get(tr) or []):   # S8: pausa de clique fecha de vez a trilha
            if c in sess:
                _sess_fecha_uma(sess[c], agora, "pausa_clique")
        x, motivo = None, "pausa"
    elif x is None:
        motivo = "pausa" if tr in sess_ultima else "inicio"
    if x is None:                                    # abre por tempo: decidida na hora; os rostos entram quando lidos
        x = _sess_nova(tr, t, u, "reagrupada" if boot else motivo, m, chave, fonte, fonte_t, atrasada)
        _sess_vira_aberta(tr, x["card"], agora)
        _sess_entra(x, pid, t, u, "t")
        if boot:
            _sess_guarda_rostos(x["card"], pid, _sess_principais(_sess_faces_ok(faces_boot or [])))
        elif sess_rostos_on():
            x["_guardar"].add(pid)
        _sess_recalc(x)
        _sess_ia_cand(x)
        _sess_toca(x)
        return x["card"]
    espera = (faces_boot is not None) if boot else sess_rostos_on()
    if espera:                                       # S6: passou no tempo; espera o rosto na ordem do clique
        x["pend"].append(pid)
        x["_t"][pid] = (t, u)
        sess_pid[pid] = x["card"]
        sess_info[pid] = {"t": t, "u": u, "trilha": tr, "card": x["card"]}
        lst = sess_espera.setdefault(tr, [])
        i = len(lst)
        while i > 0 and sess_info.get(lst[i - 1], {}).get("t", 0) > t:
            i -= 1
        lst.insert(i, pid)
        if boot:
            sess_faces_pid[pid] = _sess_faces_ok(faces_boot)
            _sess_drenar(tr, agora)
    else:
        _sess_entra(x, pid, t, u, "t")
    _sess_recalc(x)
    y = sess.get(sess_pid.get(pid) or "")
    if y is not None:
        _sess_ia_cand(y)
    _sess_toca(x)
    return sess_pid.get(pid)


def _sess_faces_ok(fs):
    return fs if fs and isinstance(fs[0], dict) else _sess_faces(fs)


def _sess_decide(pid, fs, agora):
    """S5 e S7 para a foto pendente pid (fs = rostos lidos, ou None = prazo vencido / rostos desligados)."""
    info = sess_info.pop(pid, None)
    sess_faces_pid.pop(pid, None)
    if not info:
        return
    tr = info["trilha"]
    lst = sess_espera.get(tr)
    if lst and pid in lst:
        lst.remove(pid)
    x = sess.get(info["card"])
    if x is None or x["status"] == "fechada":
        return
    if pid in x["pend"]:
        x["pend"].remove(pid)
    aberta = sess.get(sess_aberta.get(tr) or "") or x
    dest, dec, princ = aberta, "t", []
    if fs is not None:
        princ = _sess_principais(fs)
        if not princ:
            dec = "s"                                # sem rosto (ou só fundo): fica
        else:
            sims = [(c, _sess_sim(princ, c)) for c in _sess_cands(tr)]
            com = [(c, v) for c, v in sims if v is not None]
            fortes = [c for c, v in com if v >= SESS_LIM_FUNDE]
            melhor = max(com, key=lambda cv: cv[1]) if com else None
            qual = [f for f in princ if _sess_qualidade(f)]
            if len(fortes) >= 2:                     # individuais antes do grupo: funde na mais antiga
                dest = sess[min(fortes, key=lambda c: sess[c]["_n"])]
                for c in fortes:
                    if c != dest["card"]:
                        _sess_fundir(dest, sess[c], agora)
                dec = "f"
            elif melhor and melhor[1] >= SESS_LIM_FICA:
                dest, dec = sess[melhor[0]], "r"
            elif qual and melhor and melhor[1] < SESS_LIM_NOVO:
                t, u = info["t"], info["u"]
                dest = _sess_nova(tr, t, u, "rostos_novos", {}, x.get("fotografo"), x.get("fonte"), x.get("fonte_t"), x.get("atrasada"))
                dest["sim_abertura"] = round(melhor[1], 3)
                dec = "n"
            else:
                dec = "d" if qual else "s"           # dúvida, perfil, criança com leitura fraca, rosto pequeno: fica
    _sess_entra(dest, pid, info["t"], info["u"], dec)
    if dec in ("r", "f", "n"):
        _sess_guarda_rostos(dest["card"], pid, princ)
    if princ:
        _vis_ligar(dest["card"], pid, info["t"], princ)   # v97: a leva liga à visita pelos rostos de qualidade
    if sess_aberta.get(tr) != dest["card"]:
        _sess_vira_aberta(tr, dest["card"], agora)
    for y in {id(x): x, id(dest): dest}.values():
        _sess_recalc(y)
        _sess_ia_cand(y)
        _sess_toca(y)


def _sess_drenar(trilha, agora):
    """S6: decide as pendentes da trilha na ordem do clique; a cabeça espera o rosto (e o rosto de quem abriu a sessão)
    até SESS_ROSTO_ESPERA desde a chegada."""
    lst = sess_espera.get(trilha)
    on = sess_rostos_on()
    while lst:
        pid = lst[0]
        info = sess_info.get(pid)
        if info is None:
            lst.pop(0)
            continue
        vencido = agora - info["u"] > SESS_ROSTO_ESPERA
        fs = sess_faces_pid.get(pid)
        if fs is None:
            if on and not vencido:
                break
            _sess_decide(pid, None, agora)
            continue
        if on and not vencido and any(sess[c]["_guardar"] for c in _sess_cands(trilha)):
            break                                    # o rosto de quem abriu a sessão ainda não foi lido
        _sess_decide(pid, fs, agora)
    if not sess_espera.get(trilha):
        sess_espera.pop(trilha, None)


def sess_rostos_lidos(pid, faces, agora=None):
    """Chamada pelo leitor de rostos depois de gravar no rostos.db (fora do _mat_lock). faces = [(larg, vetor, score,
    frontal)] ou None (erro: conta como lida sem rosto). Os vetores ficam só na memória (S9)."""
    agora = time.time() if agora is None else agora
    fs = _sess_faces(faces)
    vis_cfg()                                        # B1: fora do sess_lock (cache de 3 s)
    with sess_lock:
        x = sess.get(sess_pid.get(pid) or "")
        if x is not None:
            x["_rfim"] = agora
        if pid in sess_info:
            sess_faces_pid[pid] = fs
            _sess_drenar(sess_info[pid]["trilha"], agora)
        elif x is not None and x["status"] != "fechada" and pid in x["_guardar"]:
            x["_guardar"].discard(pid)
            princ = _sess_principais(fs)
            _sess_guarda_rostos(x["card"], pid, princ)
            _vis_ligar(x["card"], pid, x["_t"].get(pid, (agora, agora))[0], princ)   # v97
            _sess_drenar(x["k"], agora)
        elif x is not None and fs:
            # v97: foto já decidida só pelo tempo (rosto lido depois do prazo, ou leva já fechada): liga a visita mesmo assim
            _vis_ligar(x["card"], pid, x["_t"].get(pid, (_num(x.get("cap1")), 0))[0], _sess_principais(fs))


def sess_add(pid, m):
    """Chamada no fim do ingest_file, fora do lock, com a cópia do meta da foto."""
    cad = ff_cadastrados()
    ia_cfg()                                         # v93: a regra dos cliques de IA lida antes, fora do sess_lock
    vis_cfg()                                        # B1: o interruptor da ligação por rosto, idem
    with sess_lock:
        return _sess_add(pid, m, cad, time.time())


def sess_esquecer(pid):
    """LGPD: a foto apagada sai da sessão, das pendentes e dos rostos em memória; sessão sem foto vira removida.
    v93: sai também das bases de IA, e os recortes dela são apagados na hora (o trabalho na fila é cancelado)."""
    rec_cancelar(pid)
    rec_apagar(pid)
    _sess_esquecer(pid)


def _sess_esquecer(pid):
    with sess_lock:
        card = sess_pid.pop(pid, None)
        info = sess_info.pop(pid, None)
        sess_faces_pid.pop(pid, None)
        if info:
            lst = sess_espera.get(info["trilha"])
            if lst and pid in lst:
                lst.remove(pid)
        for c, mem in list(sess_rostos_mem.items()):
            sess_rostos_mem[c] = [(p, v) for p, v in mem if p != pid]
        x = sess.get(card or "")
        if not x:
            return
        x["fotos"] = [p for p in x["fotos"] if p != pid]
        x["pend"] = [p for p in x["pend"] if p != pid]
        x["ia"] = [p for p in (x.get("ia") or []) if p != pid]
        x.get("_ia_vistos", set()).discard(pid)
        x["dec"].pop(pid, None)
        x.get("_t", {}).pop(pid, None)
        x.get("_guardar", set()).discard(pid)
        if not x["fotos"] and not x["pend"]:
            if x["status"] != "fechada":
                _sess_fecha_uma(x, time.time(), "pausa")
            x["removida"] = True
            x["status"] = "fechada"
        _sess_toca(x)
        _vis_esquecer(pid, x["card"], x["removida"])        # v97: sai das arestas; leva removida sai da visita


def sess_esquecer_disco(pids):
    """S14 (revisão 4): a LGPD também limpa o pid nos arquivos de sessão dos últimos 60 dias. Os dias em memória são
    regravados a partir da memória (já limpa); os outros, reescritos a partir do arquivo."""
    pids = {p for p in pids if p}
    if not pids or not os.path.isdir(SESS_DIR):
        return 0
    lim = _ff_hoje(time.time() - SESS_RET_DIAS * 86400)
    with sess_lock:
        em_mem = {x["dia"] for x in sess.values()}
    n = 0
    for nome in sorted(os.listdir(SESS_DIR)):
        mm = _SESS_DIA.match(nome)
        if not mm or mm.group(1) < lim:
            continue
        d = mm.group(1)
        if d in em_mem:
            with sess_lock:
                sess_sujo.add(d)
            continue
        f = os.path.join(SESS_DIR, nome)
        try:
            with open(f, encoding="utf8") as fh:
                j = json.load(fh)
            mudou = False
            for x in j.get("sessoes") or []:
                if not isinstance(x, dict):
                    continue
                for campo in ("fotos", "pend", "ia"):
                    v = x.get(campo) or []
                    w = [p for p in v if p not in pids]
                    if len(w) != len(v):
                        x[campo] = w
                        mudou = True
                dec = x.get("dec")
                if isinstance(dec, dict):
                    for p in list(dec):
                        if p in pids:
                            dec.pop(p)
                            mudou = True
                if not x.get("fotos") and not x.get("pend") and mudou:
                    x["removida"] = True
            if mudou:
                tmp = f + ".tmp"
                with open(tmp, "w", encoding="utf8") as fh:
                    json.dump(j, fh)
                os.replace(tmp, f)
                n += 1
        except Exception as ex:
            print("  sessões (LGPD): não limpei %s (%s)" % (nome, str(ex)[:80]))
    # v97: as arestas das visitas dos dias fora da memória perdem os pids (as de hoje e ontem já saíram em _vis_esquecer)
    try:
        nomes = sorted(os.listdir(VIS_DIR))
    except OSError:
        nomes = []
    for nome in nomes:
        mm = _SESS_DIA.match(nome)
        if not mm or mm.group(1) < lim or mm.group(1) in em_mem:
            continue
        f = os.path.join(VIS_DIR, nome)
        try:
            with open(f, encoding="utf8") as fh:
                j = json.load(fh)
            mudou = False
            for e in j.get("arestas") or []:
                for k in ("pa", "pb"):
                    if isinstance(e, dict) and e.get(k) in pids:
                        e[k] = None
                        mudou = True
            if mudou:
                fd, tmp = tempfile.mkstemp(prefix=".vis-", suffix=".tmp", dir=VIS_DIR)
                with os.fdopen(fd, "w", encoding="utf8") as fh:
                    json.dump(j, fh)
                os.chmod(tmp, 0o600)
                os.replace(tmp, f)
                n += 1
        except Exception as ex:
            print("  visitas (LGPD): não limpei %s (%s)" % (nome, str(ex)[:80]))
    sess_gravar()
    return n


def sess_limpar(agora=None):
    """S14: apaga os arquivos de sessão com mais de SESS_RET_DIAS (uma vez por dia, pelo sess_loop). v97: e os das visitas,
    e as linhas com mais de 60 dias do visitas-log.jsonl e do registro de calibração (vis_logs_poda)."""
    agora = time.time() if agora is None else agora
    lim = _ff_hoje(agora - SESS_RET_DIAS * 86400)
    n = 0
    for pasta in (SESS_DIR, VIS_DIR):
        try:
            nomes = os.listdir(pasta)
        except OSError:
            continue
        for nome in nomes:
            mm = _SESS_DIA.match(nome)
            if mm and mm.group(1) < lim:
                try:
                    os.remove(os.path.join(pasta, nome))
                    n += 1
                except OSError:
                    pass
    vis_logs_poda(agora)
    return n


def _sess_fechar(agora):
    """Com o sess_lock na mão (S8): fecha de vez as sessões sem chegada há mais que a pausa e as abertas antes da virada
    do dia (sessão aberta às 23:59:50 fecha por virada mesmo com foto chegando às 00:00:05)."""
    hoje = _ff_hoje(agora)
    for x in list(sess.values()):
        if x["status"] == "fechada":
            continue
        if _ff_hoje(x["aberta_em"]) != hoje and x["aberta_em"] < agora:
            _sess_fecha_uma(x, agora, "virada_do_dia")
        elif agora - x["ultima_chegada"] > SESS_PAUSA:
            _sess_fecha_uma(x, agora, "pausa")


def _sess_tick(agora):
    for tr in list(sess_espera):
        _sess_drenar(tr, agora)
    _sess_fechar(agora)


def sess_tick(agora=None):
    """Prazo do rosto (S6) e fechamento (S8). O sess_loop chama a cada 2 s; os testes passam o relógio."""
    with sess_lock:
        _sess_tick(time.time() if agora is None else agora)


def sess_gravar():
    vis_gravar()                                     # v97: as arestas das visitas junto das sessões
    with sess_lock:
        dias = list(sess_sujo)
        sess_sujo.clear()
        lotes = {d: [_sess_publico(x, disco=True) for x in sess.values() if x["dia"] == d] for d in dias}
    for d, lista in lotes.items():
        try:
            os.makedirs(SESS_DIR, exist_ok=True)
            f = os.path.join(SESS_DIR, d + ".json")
            tmp = f + ".tmp"
            with open(tmp, "w", encoding="utf8") as fh:
                json.dump({"dia": d, "sessoes": lista}, fh)
            os.replace(tmp, f)
        except Exception as ex:
            with sess_lock:
                sess_sujo.add(d)
            print("  sessões: não gravei %s (%s)" % (d, str(ex)[:80]))


def sess_loop():
    while True:
        time.sleep(2)
        try:
            agora = time.time()
            ia_cfg()                                 # v93: fora do sess_lock; o fechamento usa o valor guardado
            vis_cfg()                                # B1: idem para a ligação por rosto
            with sess_lock:
                _sess_tick(agora)
                ontem = _ff_hoje(agora - 86400)
                for card in [c for c, x in sess.items() if x["dia"] < ontem and x["status"] == "fechada"]:
                    x = sess.pop(card)                   # só hoje e ontem na memória
                    for p in x["fotos"]:
                        if sess_pid.get(p) == card:
                            sess_pid.pop(p, None)
                    if sess_ultima.get(x["k"]) == card:
                        sess_ultima.pop(x["k"], None)
                    vis_rostos.pop(card, None)
                    vis_de.pop(card, None)
                for d in [d for d in vis_arestas if d < ontem]:   # v97: visitas também só de hoje e ontem na memória
                    vis_arestas.pop(d, None)
                for vid in [k for k, v in vis_info.items() if v["dia"] < ontem]:
                    vis_info.pop(vid, None)
            sess_gravar()
            if sess_limpo[0] != _ff_hoje(agora):
                sess_limpo[0] = _ff_hoje(agora)
                sess_limpar(agora)
        except Exception as ex:
            print("  sessões: %s" % str(ex)[:120])


def _sess_normaliza(x):
    """Sessão lida do arquivo (v85 A ou v91) com os campos da v91."""
    x["fotos"] = [p for p in (x.get("fotos") or []) if isinstance(p, str)]
    x["pend"] = [p for p in (x.get("pend") or []) if isinstance(p, str)]
    x["dec"] = {p: v for p, v in (x.get("dec") or {}).items() if isinstance(p, str)} if isinstance(x.get("dec"), dict) else {}
    for kk, v in (("trilha", "vivo"), ("atrasada", False), ("motivo", None), ("ponto", None), ("funcao", None),
                  ("cap0", None), ("cap1", None), ("fonte_t", "u"), ("sim_abertura", None), ("fundida_em", None),
                  ("removida", False), ("fechada_em", None), ("fechada_por", None), ("origem", "agente"),
                  ("ia_regra", None)):
        x.setdefault(kk, v)
    x["ia"] = [p for p in (x.get("ia") or []) if isinstance(p, str)] if isinstance(x.get("ia"), list) else []   # v93: nada retroativo
    x["aberta_em"] = _num(x.get("aberta_em"))
    x["ultima_chegada"] = _num(x.get("ultima_chegada")) or x["aberta_em"]
    sess_seq[0] += 1
    x.update(_t={}, _guardar=set(), _rfim=0.0, _n=sess_seq[0], _fonte={}, _ia_vistos=set())
    return x


def _sess_faces_db(pids):
    """Rostos já lidos (rostos.db) das fotos sem sessão, para o reagrupamento do boot. O banco não guarda o score nem a
    pose: esses rostos nunca votam por "sessão nova" (só ajudam a ficar e a fundir)."""
    out = {}
    if not pids or not os.path.exists(ROSTOS_DB):
        return out
    try:
        db = rostos_db()
        lidas = set()
        lista = list(pids)
        for i in range(0, len(lista), 500):
            parte = lista[i:i + 500]
            q = ",".join("?" * len(parte))
            for (p,) in db.execute("select pid from foto where pid in (%s)" % q, parte):
                lidas.add(p)
            for p, larg, emb in db.execute("select pid, larg, emb from rosto where pid in (%s)" % q, parte):
                v = array.array("f")
                v.frombytes(emb)
                out.setdefault(p, []).append((larg, list(v), 0.0, False))
        db.close()
        for p in lidas:
            out.setdefault(p, [])
    except Exception as ex:
        print("  sessões: rostos do boot indisponíveis (%s)" % str(ex)[:80])
    return out


def sess_carregar(agora=None):
    """No boot: lê as sessões gravadas de ontem e hoje; a que não estava fechada fecha com "reinicio" (S8). As fotos que
    chegaram sem sessão (queda entre a chegada e a gravação) são reagrupadas pela mesma regra, com os rostos do
    rostos.db quando existem, sem esperar, e também fecham com "reinicio"."""
    agora = time.time() if agora is None else agora
    dias = [_ff_hoje(agora - 86400), _ff_hoje(agora)]
    n_lidas = 0
    ia_cfg()                                         # v93: fora do sess_lock
    vis_cfg()                                        # B1: as visitas do boot já respeitam o interruptor
    with sess_lock:
        for d in dias:
            try:
                j = json.load(open(os.path.join(SESS_DIR, d + ".json"), encoding="utf8"))
            except Exception:
                continue
            for x in j.get("sessoes") or []:
                if not isinstance(x, dict) or not x.get("card") or not x.get("k") or not x.get("dia"):
                    continue
                x = _sess_normaliza(x)
                sess[x["card"]] = x
                for p in x["fotos"] + x["pend"]:
                    sess_pid[p] = x["card"]
                sess_rev[0] = max(sess_rev[0], int(x.get("rev") or 0))
                if x.get("status") != "fechada":
                    for p in x["pend"]:
                        x["dec"][p] = "t"
                    x["fotos"] += [p for p in x["pend"] if p not in x["fotos"]]
                    x["pend"] = []
                    _sess_ia_fecha(x)                # v93 (critério 16): a aberta que fecha no boot também tem ia
                    x.update(status="fechada", fechada_em=agora, fechada_por="reinicio")
                    _sess_toca(x)
                if not x.get("removida"):
                    sess_ultima[x["k"]] = x["card"]
                n_lidas += 1
    ini = time.mktime(time.strptime(dias[0], "%Y-%m-%d"))
    itens = []
    with lock:
        for pid, m in meta.items():
            try:
                if isinstance(m, dict) and pid in lib and float(m.get("u") or 0) >= ini:
                    itens.append((pid, dict(m)))
            except (TypeError, ValueError):
                continue
    with sess_lock:
        itens = [(p, m) for p, m in itens if p not in sess_pid]
    itens.sort(key=lambda x: float(x[1]["u"]))
    faces = _sess_faces_db([p for p, _ in itens])
    cad = ff_cadastrados()
    novas = 0
    with sess_lock:
        for pid, m in itens:
            try:
                _sess_add(pid, m, cad, agora=float(m["u"]), faces_boot=faces.get(pid), boot=True)
                novas += 1
            except Exception as ex:
                print("  sessões: foto ignorada no boot (%s)" % str(ex)[:60])
        for x in list(sess.values()):
            if x["status"] != "fechada":
                _sess_fecha_uma(x, agora, "reinicio")
        hoje = sum(1 for x in sess.values() if x["dia"] == dias[1] and not x.get("removida"))
        _vis_carregar(dias, agora)                   # v97: arestas relidas, visitas refeitas (critério 31)
        for d in dias:
            _vis_recalc(d)
    try:
        vis_idx_boot(agora)
    except Exception as ex:
        print("  visitas: rostos do boot indisponíveis (%s)" % str(ex)[:80])
    sess_gravar()
    return n_lidas, novas, hoje


def sess_feed(desde=0, ontem=False):
    """GET /sessoes?desde=<rev>: só as de hoje (revisão 9); ontem só com ?ontem=1 ou com ETERNA_BUSCA_DIAS >= 2 (v90: a
    selfie procura nos dias anteriores e o Checkout precisa dessas sessões). Nada de rosto."""
    agora = time.time()
    dias = {_ff_hoje(agora - i * 86400) for i in range(max(BUSCA_DIAS, 2 if ontem else 1))}
    with sess_lock:
        _sess_tick(agora)
        lista = [_sess_publico(x) for x in sess.values() if x.get("rev", 0) > desde and x["dia"] in dias]
        rev = sess_rev[0]
    lista.sort(key=lambda x: x.get("rev", 0))
    return {"ok": True, "gen": BOOT, "rev": rev, "pausa": SESS_PAUSA, "rostos": bool(sess_rostos_on()),
            "completo": not desde, "sessoes": lista}


def sess_status():
    jan = busca_janela_efetiva()         # fora do sess_lock (lê o estado.db com o estado_lock)
    with sess_lock:
        hoje = _ff_hoje()
        return {"v": 2, "pausa": SESS_PAUSA, "rostos": bool(sess_rostos_on()), "rev": sess_rev[0], "gen": BOOT, "dias": BUSCA_DIAS,
                "janela_min": jan, "janela_padrao": BUSCA_JANELA_MIN, "janela_fixa": BUSCA_DIAS_EXPLICITA,
                "hoje": sum(1 for x in sess.values() if x["dia"] == hoje and not x.get("removida")),
                "abertas": sum(1 for x in sess.values() if x["status"] != "fechada"), "visitas": _vis_status_mem()}


# ---------- v97: visitas (as levas da mesma família, ligadas por rosto) ----------
# Leva = a sessão de hoje (por fotógrafo ou câmera, 60 s sem disparo fecham, rostos novos separam; código LP). Visita = as
# levas da mesma família no dia: duas levas ligam quando um rosto de qualidade (principal, >= 60 px, frontal, score >= 0,80)
# de uma bate (sim >= VIS_LIM) com um rosto de qualidade da outra, em corrente (união), com o 1º e o último clique da visita
# a até 50 min. Teto: 12 levas ou 15 rostos diferentes (acima disso a ligação automática para e a visita fica "grande":
# excursão ou escola encadeariam todo mundo). Leva de escola ou de menor só liga por Juntar. Separar (Posto) vira "não
# ligar" entre a leva e o resto da visita e vence a ligação por rosto; Juntar liga mesmo sem rosto e desfaz o Separar.
# Tudo sob o sess_lock (nunca com o lock). Vetores só em memória (vis_idx, 50 min); as arestas vão para
# ~/Eterna/ponto/visitas/AAAA-MM-DD.json (60 dias) sem vetor; o Checkout abre a visita inteira (decisão do Eduardo, 10/11).
# Segurança (10/11, B1): a ligação AUTOMÁTICA por rosto fica desligada até a calibração com fotos reais do Tour (interruptor
# em estado.db config/visitas {"rosto": false}, só pela rota POST /visitas/config, Admin no Painel de controle). Desligada,
# _vis_ligar não cria aresta "rosto" e as que já existem não contam no _vis_recalc; a similaridade entre levas vai para
# ~/Eterna/ponto/visitas-calibracao.jsonl (só ids de leva e de foto e o score, 60 dias). Juntar e Separar continuam.
VIS_LIM = 0.50               # limiar fixo; os testes trocam o atributo do módulo (m.VIS_LIM), como o REC_FALSO_SEG
VIS_CALIB_PISO = 0.35        # pares de levas a partir desta similaridade vão para o registro de calibração
VIS_CFG_PADRAO = {"rosto": False}
_vis_cfg = {"t": 0.0, "v": None}


def vis_valida(j):
    """config/visitas: só {"rosto": bool} (por e em são de auditoria). Outro formato = None (vale o padrão: desligada)."""
    if not isinstance(j, dict) or not isinstance(j.get("rosto"), bool):
        return None
    return {"rosto": j["rosto"]}


def vis_cfg():
    """Interruptor da ligação por rosto (estado.db config/visitas), relido a cada 3 s. Nunca chamar com o sess_lock na mão
    (como o ia_cfg). Sem documento ou ilegível: desligada."""
    agora = time.time()
    if agora - _vis_cfg["t"] < 3 and _vis_cfg["v"] is not None:
        return _vis_cfg["v"]
    v = None
    try:
        if os.path.exists(ESTADO_DB):
            with estado_lock:
                db = estado_db()
                try:
                    r = db.execute("select valor from doc where col = 'config' and id = 'visitas' and valor is not null").fetchone()
                finally:
                    db.close()
            if r:
                j = json.loads(r[0])
                v = vis_valida(j)
                if v is not None:
                    v = {**v, "por": j.get("por"), "em": j.get("em")}
    except Exception:                                # banco ocupado: fica o último valor lido (ou desligada)
        v = _vis_cfg["v"]
    v = v or dict(VIS_CFG_PADRAO)
    _vis_cfg.update(t=agora, v=v)
    return v


def vis_cfg_mem():
    """O último valor lido (sem abrir o banco): para quem está com o sess_lock na mão."""
    return _vis_cfg["v"] or VIS_CFG_PADRAO


def vis_rosto_ligado():
    return vis_cfg_mem().get("rosto") is True
VIS_JANELA = 3000            # s entre o 1º e o último clique da visita
VIS_LEVAS_MAX = 12
VIS_ROSTOS_MAX = 15
VIS_IDX_MAX = 4000           # vetores na janela (todas as trilhas)
VIS_ROSTOS_LEVA = 20         # rostos diferentes guardados por leva (para o teto de rostos da visita)
VIS_DIR = os.path.join(HOME, "ponto", "visitas")
VIS_LOG = os.path.join(HOME, "ponto", "visitas-log.jsonl")
VIS_CALIB = os.path.join(HOME, "ponto", "visitas-calibracao.jsonl")
VIS_LOG_MAX = 5 * 1024 * 1024
VIS_LOG_DIAS = 60            # retenção do visitas-log.jsonl e do registro de calibração (como as sessões)
vis_calib = collections.deque(maxlen=5000)   # linhas de calibração a gravar (sob o sess_lock; gravadas no vis_gravar)
vis_calib_n = [0]
vis_calib_tira = set()       # pids da LGPD a tirar do registro de calibração (no vis_gravar, fora do sess_lock)
vis_idx = {"M": None, "T": None, "C": None, "meta": [], "w": 0, "n": 0, "cid": {}, "tmax": 0.0}   # anel de vetores (sob o sess_lock)
vis_arestas = {}             # dia -> [aresta {a, b, tipo, sim, pa, pb, por, posto, em, seq, barrada?, desfeita?}]
vis_de = {}                  # card -> id da visita (só visitas com 2 levas ou mais)
vis_info = {}                # id -> visita pública (sem vetor, sem pid)
vis_rostos = {}              # card -> [(pid, vetor)] distintos (só memória)
vis_rev = [0]
vis_seq = [0]
vis_sujo = set()
vis_prot = set()             # levas de escola ou de menor (galerias publicadas): só ligam por Juntar
vis_med = {"lig": collections.deque(maxlen=500), "recalc": collections.deque(maxlen=200), "ms_ultimo": None}
_VIS_NP = []


def _vis_np():
    if not _VIS_NP:
        try:
            import numpy
            _VIS_NP.append(numpy)
        except Exception:
            _VIS_NP.append(None)
    return _VIS_NP[0]


def _vis_idx_add(t, card, pid, v):
    """Põe o vetor no anel (sobrescreve o mais velho acima de VIS_IDX_MAX). Com o sess_lock."""
    I = vis_idx
    np = _vis_np()
    if I["meta"] == []:
        I["meta"] = [None] * VIS_IDX_MAX
        if np is not None:
            I["M"] = np.zeros((VIS_IDX_MAX, 128), np.float32)
            I["T"] = np.full(VIS_IDX_MAX, np.nan)
            I["C"] = np.full(VIS_IDX_MAX, -1, np.int64)
    w = I["w"]
    cid = I["cid"].setdefault(card, len(I["cid"]) + 1)
    I["meta"][w] = (float(t), card, pid, v)
    if np is not None:
        I["M"][w] = np.frombuffer(v, dtype=np.float32) if isinstance(v, array.array) else np.asarray(v, np.float32)
        I["T"][w] = float(t)
        I["C"][w] = cid
    I["w"] = (w + 1) % VIS_IDX_MAX
    I["n"] = min(VIS_IDX_MAX, I["n"] + 1)
    I["tmax"] = max(I["tmax"], float(t))


def _vis_idx_tira(pids=None, cards=None):
    """LGPD ou leva removida: os vetores saem do anel. Com o sess_lock."""
    I = vis_idx
    for i, mm in enumerate(I["meta"]):
        if mm and ((pids and mm[2] in pids) or (cards and mm[1] in cards)):
            I["meta"][i] = None
            if I["T"] is not None:
                I["T"][i] = float("nan")
                I["C"][i] = -1


def _vis_busca(v, card, t, piso=None):
    """{outro card: (sim, pid)} dos rostos da janela (|t − t_outro| <= 50 min) de OUTRAS levas, o melhor por leva, com
    sim >= piso (padrão VIS_LIM; a calibração pede um piso mais baixo)."""
    lim = VIS_LIM if piso is None else piso
    I = vis_idx
    out = {}
    if not I["n"]:
        return out
    np = _vis_np()
    mine = I["cid"].get(card, -2)
    if np is not None and I["M"] is not None:
        vv = np.frombuffer(v, dtype=np.float32) if isinstance(v, array.array) else np.asarray(v, np.float32)
        with np.errstate(invalid="ignore"):
            ok = (np.abs(I["T"] - float(t)) <= VIS_JANELA) & (I["C"] != mine) & (I["C"] >= 0)
        idx = np.nonzero(ok)[0]
        if not len(idx):
            return out
        sims = I["M"][idx] @ vv
        for j in np.nonzero(sims >= lim - 1e-6)[0]:         # 1e-6: o float32 não tira o 0,50 exato do limiar
            mm = I["meta"][int(idx[j])]
            if mm is None:
                continue
            s = float(sims[j])
            if mm[1] not in out or s > out[mm[1]][0]:
                out[mm[1]] = (s, mm[2])
        return out
    for mm in I["meta"]:
        if not mm or mm[1] == card or abs(mm[0] - t) > VIS_JANELA:
            continue
        s = _dot(v, mm[3])
        if s >= lim - 1e-6 and (mm[1] not in out or s > out[mm[1]][0]):
            out[mm[1]] = (s, mm[2])
    return out


def _vis_distintos(vs):
    """Quantos rostos diferentes (sim < VIS_LIM entre eles) há na lista de vetores."""
    if len(vs) < 2:
        return len(vs)
    np = _vis_np()
    if np is not None:
        A = np.stack([np.frombuffer(v, dtype=np.float32) if isinstance(v, array.array) else np.asarray(v, np.float32) for v in vs])
        S = A @ A.T
        rep = []
        for i in range(len(vs)):
            if not any(S[i, j] >= VIS_LIM for j in rep):
                rep.append(i)
        return len(rep)
    rep = []
    for v in vs:
        if not any(_dot(v, w) >= VIS_LIM for w in rep):
            rep.append(v)
    return len(rep)


def _vis_rostos_add(card, pid, v):
    mem = vis_rostos.setdefault(card, [])
    if len(mem) < VIS_ROSTOS_LEVA and not any(_dot(v, w) >= VIS_LIM for _, w in mem):
        mem.append((pid, v))


def _vis_ligar(card, pid, t, princ):
    """Com o sess_lock: os rostos de qualidade da foto pid (leva card, clique t) procuram rostos de OUTRAS levas na janela;
    sim >= VIS_LIM cria a aresta "rosto" entre as duas levas (uma por par: a maior sim e os 2 pids), só com o interruptor
    config/visitas ligado (B1). Todo par com sim >= VIS_CALIB_PISO vai para o registro de calibração (ids e score). Depois
    os vetores entram no anel. Devolve True se a visita mudou."""
    x = sess.get(card)
    if x is None or x.get("removida") or not princ:
        return False
    qual = [f for f in princ if _sess_qualidade(f)]
    if not qual:
        return False
    t0 = time.perf_counter()
    lig = vis_rosto_ligado()
    melhor = {}
    for f in qual:
        for oc, (s, op) in _vis_busca(f["v"], card, t, min(VIS_LIM, VIS_CALIB_PISO)).items():
            if oc not in melhor or s > melhor[oc][0]:
                melhor[oc] = (s, op)
    for f in qual:
        _vis_idx_add(t, card, pid, f["v"])
        _vis_rostos_add(card, pid, f["v"])
    nova = False
    dia = x["dia"]
    for oc, (s, op) in melhor.items():
        y = sess.get(oc)
        if y is None or y.get("removida") or y["dia"] != dia:
            continue
        vis_calib.append({"em": time.strftime("%Y-%m-%dT%H:%M:%S"), "dia": dia, "a": card, "b": oc, "pa": pid, "pb": op,
                          "sim": round(s, 4), "ligada": lig})
        vis_calib_n[0] += 1
        if lig and s >= VIS_LIM - 1e-6:
            nova = _vis_aresta(dia, "rosto", card, oc, sim=s, pa=pid, pb=op) or nova
    mudou = _vis_recalc(dia, set(melhor) | {card}) if nova else False
    vis_med["lig"].append((time.perf_counter() - t0) * 1000)
    return mudou


def _vis_aresta(dia, tipo, a, b, sim=None, pa=None, pb=None, por=None, posto=None):
    """Aresta nova (True) ou a de rosto que já existe com sim maior (False: a ligação não muda). Com o sess_lock."""
    lst = vis_arestas.setdefault(dia, [])
    par = {a, b}
    if tipo == "rosto":
        for e in lst:
            if e["tipo"] == "rosto" and {e["a"], e["b"]} == par:
                if sim is not None and sim > (e.get("sim") or 0):
                    e.update(sim=round(sim, 4), pa=pa if e["a"] == a else pb, pb=pb if e["a"] == a else pa)
                    vis_sujo.add(dia)
                return False
    vis_seq[0] += 1
    e = {"a": a, "b": b, "tipo": tipo, "sim": round(sim, 4) if sim is not None else None, "pa": pa, "pb": pb,
         "por": por, "posto": posto, "em": round(time.time(), 1), "seq": vis_seq[0]}
    lst.append(e)
    vis_sujo.add(dia)
    return True


def _vis_protegida(x):
    return x["card"] in vis_prot or bool(x.get("menor"))


def _vis_recalc(dia, toque=None):
    """Com o sess_lock: refaz as visitas do dia (união-busca) só com as arestas permitidas. Juntar primeiro (decisão da
    equipe, sem teto), depois as de rosto na ordem em que nasceram; aresta que deixaria a visita com mais de 50 min, mais de
    12 levas ou mais de 15 rostos, entre levas separadas, ou de leva de escola ou menor, fica registrada com "barrada".
    toque = levas que mudaram: refaz só o pedaço do dia ligado a elas por alguma aresta (critério 33). Devolve True se
    alguma visita mudou."""
    t0 = time.perf_counter()
    lst = vis_arestas.get(dia) or []
    if toque is not None:
        viz = {}
        for e in lst:
            viz.setdefault(e["a"], []).append(e["b"])
            viz.setdefault(e["b"], []).append(e["a"])
        alc, pilha = set(), [c for c in toque if c]
        for v in vis_info.values():              # as levas das visitas atuais das tocadas também (uma pode sair)
            if v["dia"] == dia and set(v["levas"]) & set(pilha):
                pilha += v["levas"]
        while pilha:
            c = pilha.pop()
            if c in alc:
                continue
            alc.add(c)
            pilha += viz.get(c, [])
        levas = {c: sess[c] for c in alc if c in sess and sess[c]["dia"] == dia and not sess[c].get("removida")}
        lst = [e for e in lst if e["a"] in alc or e["b"] in alc]
    else:
        alc = None
        levas = {c: x for c, x in sess.items() if x["dia"] == dia and not x.get("removida")}
    pai = {c: c for c in levas}
    ag = {c: {"ini": _num(x.get("cap0")) or _num(x.get("aberta_em")), "fim": _num(x.get("cap1")) or _num(x.get("ultima_chegada")),
              "n": 1, "rostos": [v for _, v in vis_rostos.get(c, [])], "grande": False, "membros": [c]} for c, x in levas.items()}

    def raiz(c):
        while pai[c] != c:
            pai[c] = pai[pai[c]]
            c = pai[c]
        return c

    sep = [e for e in lst if e["tipo"] == "separar" and not e.get("desfeita")]
    nao = {frozenset((e["a"], e["b"])) for e in sep}
    ordem = sorted((e for e in lst if e["tipo"] == "juntar" and not e.get("desfeita")), key=lambda e: e["seq"]) + \
        (sorted((e for e in lst if e["tipo"] == "rosto"), key=lambda e: e["seq"]) if vis_rosto_ligado() else [])   # B1
    for e in lst:
        if e["tipo"] == "rosto" and e.get("barrada") and not vis_rosto_ligado():
            e.pop("barrada", None)                  # desligada: a aresta antiga não conta (nem como barrada)
    for e in ordem:
        e.pop("barrada", None)
        a, b = e["a"], e["b"]
        if a not in pai or b not in pai:
            continue
        ra, rb = raiz(a), raiz(b)
        if ra == rb:
            continue
        A, B = ag[ra], ag[rb]
        if nao and any(frozenset((u, w)) in nao for u in A["membros"] for w in B["membros"]):
            e["barrada"] = "separada"
            continue
        rostos = A["rostos"] + B["rostos"]
        if e["tipo"] == "rosto":
            if _vis_protegida(levas[a]) or _vis_protegida(levas[b]):
                e["barrada"] = "escola_menor"
                continue
            if max(A["fim"], B["fim"]) - min(A["ini"], B["ini"]) > VIS_JANELA:
                e["barrada"] = "janela"
                continue
            if A["n"] + B["n"] > VIS_LEVAS_MAX:
                e["barrada"] = "levas"
                A["grande"] = B["grande"] = True
                continue
            if _vis_distintos(rostos) > VIS_ROSTOS_MAX:
                e["barrada"] = "rostos"
                A["grande"] = B["grande"] = True
                continue
        pai[rb] = ra
        A.update(ini=min(A["ini"], B["ini"]), fim=max(A["fim"], B["fim"]), n=A["n"] + B["n"], rostos=rostos,
                 grande=A["grande"] or B["grande"] or A["n"] + B["n"] > VIS_LEVAS_MAX, membros=A["membros"] + B["membros"])
        if e["tipo"] == "juntar" and _vis_distintos(rostos) > VIS_ROSTOS_MAX:
            A["grande"] = True
    novas = {}
    for c in levas:
        r = raiz(c)
        A = ag[r]
        sep_de = sorted({(e["b"] if e["a"] in A["membros"] else e["a"]) for e in sep
                         if (e["a"] in A["membros"]) != (e["b"] in A["membros"])})
        if len(A["membros"]) < 2 and not A["grande"] and not sep_de:
            continue
        if r in novas:
            continue
        ms = sorted(A["membros"], key=lambda k: (_num(levas[k].get("cap0")) or _num(levas[k].get("aberta_em")), levas[k].get("_n", 0)))
        vid = "V" + ms[0][2:]
        novas[r] = {"id": vid, "dia": dia, "levas": ms, "inicio": round(A["ini"], 1), "fim": round(A["fim"], 1),
                    "grande": bool(A["grande"]), "separadas": sep_de}
    mudou = False
    vistos = set()
    for v in novas.values():
        vistos.add(v["id"])
        velho = vis_info.get(v["id"])
        chave = lambda o: (o["levas"], o["grande"], o["separadas"])
        if velho is None or chave(velho) != chave(v):
            vis_rev[0] += 1
            v["rev"] = vis_rev[0]
            mudou = True
        else:
            v["rev"] = velho["rev"]
        vis_info[v["id"]] = v
    for vid in [k for k, v in vis_info.items() if v["dia"] == dia and k not in vistos and (alc is None or set(v["levas"]) & alc)]:
        vis_info.pop(vid)
        vis_rev[0] += 1
        mudou = True
    for c in levas:
        vis_de.pop(c, None)
    for v in novas.values():
        if len(v["levas"]) > 1:
            for c in v["levas"]:
                vis_de[c] = v["id"]
    vis_sujo.add(dia)
    ms_ = (time.perf_counter() - t0) * 1000
    vis_med["recalc"].append(ms_)
    vis_med["ms_ultimo"] = round(ms_, 2)
    return mudou


def _vis_ja_tem_ia(card):
    """D4 (Eduardo, 10/11): a visita da leva já tem outra leva fechada com as bases de IA. Com o sess_lock."""
    v = vis_info.get(vis_de.get(card) or "")
    if not v:
        return False
    for c in v["levas"]:
        y = sess.get(c)
        if c != card and y is not None and y["status"] == "fechada" and y.get("ia"):
            return True
    return False


def _vis_ia_reabre(cards, motivo):
    """Com o sess_lock (Segurança, 10/11, item 6): leva fechada sem bases porque a visita já tinha (visita_ja_tem) e que
    deixou de ter visita com bases (Separar, escola ou menor protegida, ligação por rosto desligada) volta a ter as N
    primeiras fotos como bases de IA, e elas vão para a fila de recorte. Devolve as levas reabertas."""
    out = []
    for c in sorted(set(cards)):
        x = sess.get(c)
        if x is None or x.get("removida") or x["status"] != "fechada":
            continue
        r = x.get("ia_regra") or {}
        if r.get("motivo") != "visita_ja_tem" or x.get("ia") or _vis_ja_tem_ia(c):
            continue
        n = r.get("n") or 0
        fs = x["fotos"]
        if not n or len(fs) <= n:
            continue
        x["ia"] = list(fs[:n])
        x["ia_regra"] = {"n": n, "motivo": None, "reaberta": motivo}
        for p in x["ia"]:
            sess_ia_novos.append((p, REC_PRIO_IA))
        _sess_toca(x)
        out.append(c)
    return out


def vis_levas_de(card):
    """As levas da visita do card (só ele, se não está em visita). Com o sess_lock."""
    v = vis_info.get(vis_de.get(card) or "")
    return list(v["levas"]) if v else [card]


def _vis_publico(v):
    return {k: (list(v[k]) if isinstance(v[k], list) else v[k]) for k in ("id", "levas", "rev", "inicio", "fim", "grande", "separadas")}


def _vis_sozinha(card):
    x = sess.get(card) or {}
    return {"id": "V" + card[2:], "levas": [card], "rev": vis_rev[0], "inicio": _num(x.get("cap0")), "fim": _num(x.get("cap1")),
            "grande": False, "separadas": []}


def vis_feed(desde=0, ontem=False):
    """GET /visitas?desde=<rev>: as visitas de hoje (e ontem com ontem=1), sem vetor e sem pid. Nada mudou desde o rev
    pedido: lista vazia com "igual"; mudou: a lista inteira ("completo")."""
    agora = time.time()
    dias = {_ff_hoje(agora)} | ({_ff_hoje(agora - 86400)} if ontem else set())
    with sess_lock:
        rev = vis_rev[0]
        if desde and desde >= rev:
            return {"ok": True, "rev": rev, "igual": True, "visitas": []}
        lista = [_vis_publico(v) for v in vis_info.values() if v["dia"] in dias]
    lista.sort(key=lambda v: v["inicio"] or 0)
    return {"ok": True, "rev": rev, "completo": True, "visitas": lista}


def _vis_status_mem():
    """/status.sessoes.visitas (com o sess_lock)."""
    hoje = _ff_hoje()
    arestas = vis_arestas.get(hoje) or []
    lig = sorted(vis_med["lig"])
    return {"n": sum(1 for v in vis_info.values() if v["dia"] == hoje and len(v["levas"]) > 1), "rev": vis_rev[0],
            "ligacoes_rosto": sum(1 for e in arestas if e["tipo"] == "rosto" and not e.get("barrada")),
            "barradas": sum(1 for e in arestas if e.get("barrada")), "ms_ultimo": vis_med["ms_ultimo"],
            "ligar_p90_ms": round(lig[int(0.9 * (len(lig) - 1))], 2) if lig else None, "limiar": VIS_LIM,
            "rosto": vis_rosto_ligado(), "rosto_em": vis_cfg_mem().get("em"), "calibracao": vis_calib_n[0]}


def _vis_txt(v, n):
    x = _txt_chave(v, n)
    return x or None


def vis_acao(acao, body, quem_ip):
    """POST /visitas/juntar {a, b, por, posto} e /visitas/separar {card, por, posto}. Só levas de hoje que existem.
    Devolve (resposta, código)."""
    if not isinstance(body, dict):
        return {"error": "corpo inválido"}, 400
    por, posto = _vis_txt(body.get("por"), 60), _vis_txt(body.get("posto"), 40)
    hoje = _ff_hoje()
    re_lp = re.compile(r"^LP[A-Z0-9]{5,10}$")
    with sess_lock:
        def leva_ok(c):
            x = sess.get(c) if isinstance(c, str) and re_lp.match(c) else None
            return x is not None and x["dia"] == hoje and not x.get("removida")
        if acao == "juntar":
            a, b = body.get("a"), body.get("b")
            if not leva_ok(a) or not leva_ok(b) or a == b:
                return {"error": "leva inválida (só levas de hoje)"}, 400
            de = vis_levas_de(a)
            Va, Vb = set(vis_levas_de(a)), set(vis_levas_de(b))
            for e in vis_arestas.get(hoje) or []:      # Juntar desfaz o Separar entre as duas visitas
                if e["tipo"] == "separar" and not e.get("desfeita") and ({e["a"], e["b"]} & Va) and ({e["a"], e["b"]} & Vb):
                    e["desfeita"] = round(time.time(), 1)
            _vis_aresta(hoje, "juntar", a, b, por=por, posto=posto)
            _vis_recalc(hoje)
            para = vis_levas_de(a)
            resp = {"ok": True, "visita": _vis_publico(vis_info[vis_de[a]]) if a in vis_de else _vis_sozinha(a)}
            log = {"acao": "juntar", "a": a, "b": b, "de": sorted(de), "para": para}
        elif acao == "separar":
            card = body.get("card")
            if not leva_ok(card):
                return {"error": "leva inválida (só levas de hoje)"}, 400
            de = vis_levas_de(card)
            outros = [c for c in de if c != card]
            for e in vis_arestas.get(hoje) or []:      # Separar desfaz o Juntar entre a leva e o resto da visita
                if e["tipo"] == "juntar" and not e.get("desfeita") and card in (e["a"], e["b"]) and ({e["a"], e["b"]} - {card}) & set(outros):
                    e["desfeita"] = round(time.time(), 1)
            for c in outros:
                _vis_aresta(hoje, "separar", card, c, por=por, posto=posto)
            _vis_recalc(hoje)
            reab = _vis_ia_reabre(de, "separar")       # item 6: a leva que ficou sem visita com bases ganha as dela
            resto = outros[0] if outros else None
            resp = {"ok": True, "visita": (_vis_publico(vis_info[vis_de[resto]]) if resto in vis_de else _vis_sozinha(resto)) if resto else None,
                    "nova": _vis_publico(vis_info[vis_de[card]]) if card in vis_de else _vis_sozinha(card)}
            log = {"acao": "separar", "card": card, "de": sorted(de), "para": vis_levas_de(card), "bases_reabertas": reab}
            resp["bases_reabertas"] = reab
        else:
            return {"error": "not found"}, 404
    log.update(por=por, posto=posto, ip=None if quem_ip in ("127.0.0.1", "::1") else quem_ip, em=time.strftime("%Y-%m-%dT%H:%M:%S"))
    vis_log(log)
    sess_gravar()
    return resp, 200


def vis_cfg_gravar(rosto, por=None, posto=None, quem_ip=None):
    """B1: POST /visitas/config {rosto, por, posto} (Painel de controle, só Admin no app). Grava config/visitas no estado.db
    (rev novo), registra no console e no visitas-log.jsonl e refaz as visitas dos dias em memória com o valor novo
    (desligar desfaz na hora as ligações automáticas; Juntar e Separar ficam). Fora do sess_lock."""
    de = vis_cfg().get("rosto") is True
    v = {"rosto": bool(rosto), "por": _vis_txt(por, 60), "em": _iso()}
    with estado_lock:
        db = estado_db()
        try:
            rev = db.execute("select coalesce(max(rev), 0) from doc").fetchone()[0] + 1
            db.execute("insert into doc values (?,?,?,?,?) on conflict(col, id) do update set valor = excluded.valor, rev = excluded.rev, em = excluded.em",
                       ("config", "visitas", json.dumps(v, ensure_ascii=False), rev, _iso()))
            db.commit()
        finally:
            db.close()
    _vis_cfg.update(t=time.time(), v=dict(v))
    with sess_lock:
        for d in sorted({x["dia"] for x in sess.values()} | set(vis_arestas)):
            _vis_recalc(d)
        _vis_ia_reabre(list(sess), "rosto_desligado")
    print("  visitas: ligação por rosto %s -> %s · por %s" % ("ligada" if de else "desligada", "ligada" if v["rosto"] else "desligada", v["por"] or "?"))
    vis_log({"acao": "config", "rosto": v["rosto"], "de": de, "por": v["por"], "posto": _vis_txt(posto, 40),
             "ip": None if quem_ip in (None, "127.0.0.1", "::1") else quem_ip, "em": time.strftime("%Y-%m-%dT%H:%M:%S")})
    sess_gravar()
    return {"ok": True, "rosto": v["rosto"], "em": v["em"], "por": v["por"]}


def vis_log(obj):
    """~/Eterna/ponto/visitas-log.jsonl (600): quem, posto, quando, de e para. Sem rosto, sem foto."""
    try:
        os.makedirs(os.path.dirname(VIS_LOG), exist_ok=True)
        if os.path.exists(VIS_LOG) and os.path.getsize(VIS_LOG) > VIS_LOG_MAX:
            os.replace(VIS_LOG, VIS_LOG + ".1")
        fd = os.open(VIS_LOG, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, "a", encoding="utf8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")
    except OSError as ex:
        print("  visitas: não gravei o registro (%s)" % str(ex)[:80])


def vis_calib_gravar(linhas, tira=None):
    """B1: registro de calibração (~/Eterna/ponto/visitas-calibracao.jsonl, 600): só ids de leva e de foto, score e se a
    ligação estava ligada. tira = pids da LGPD (a linha perde o pid). Fora do sess_lock."""
    try:
        os.makedirs(os.path.dirname(VIS_CALIB), exist_ok=True)
        if tira and os.path.exists(VIS_CALIB):
            _jsonl_reescreve(VIS_CALIB, lambda o: {**o, **{k: None for k in ("pa", "pb") if o.get(k) in tira}})
        if not linhas:
            return
        if os.path.exists(VIS_CALIB) and os.path.getsize(VIS_CALIB) > VIS_LOG_MAX:
            os.replace(VIS_CALIB, VIS_CALIB + ".1")
        fd = os.open(VIS_CALIB, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(fd, "a", encoding="utf8") as f:
            for o in linhas:
                if tira:
                    o = {**o, **{k: None for k in ("pa", "pb") if o.get(k) in tira}}
                f.write(json.dumps(o, ensure_ascii=False) + "\n")
    except OSError as ex:
        print("  visitas: não gravei a calibração (%s)" % str(ex)[:80])


def _jsonl_reescreve(f, fn):
    """Reescreve um .jsonl linha a linha (fn(obj) -> obj, ou None para tirar a linha), 600, mkstemp + replace."""
    fd, tmp = tempfile.mkstemp(prefix=".vlog-", suffix=".tmp", dir=os.path.dirname(f))
    try:
        with os.fdopen(fd, "w", encoding="utf8") as out, open(f, encoding="utf8") as fh:
            for linha in fh:
                try:
                    o = json.loads(linha)
                except ValueError:
                    continue
                o = fn(o) if isinstance(o, dict) else None
                if o is not None:
                    out.write(json.dumps(o, ensure_ascii=False) + "\n")
        os.chmod(tmp, 0o600)
        os.replace(tmp, f)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def vis_logs_poda(agora=None):
    """Retenção de VIS_LOG_DIAS (60) do visitas-log.jsonl e do registro de calibração (e das cópias .1). Uma vez por dia,
    pelo sess_limpar. Devolve as linhas tiradas."""
    agora = time.time() if agora is None else agora
    lim = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(agora - VIS_LOG_DIAS * 86400))
    n = [0]

    def fica(o):
        if str(o.get("em") or "") < lim:
            n[0] += 1
            return None
        return o
    for f in (VIS_LOG, VIS_CALIB):
        for g in (f, f + ".1"):
            try:
                if not os.path.exists(g):
                    continue
                if os.path.getmtime(g) < agora - VIS_LOG_DIAS * 86400:
                    os.remove(g)                         # nada mais novo que o prazo: sai o arquivo
                    continue
                _jsonl_reescreve(g, fica)
            except Exception as ex:
                print("  visitas: não podei %s (%s)" % (os.path.basename(g), str(ex)[:80]))
    return n[0]


def vis_gravar():
    """Grava as arestas dos dias com mudança (~/Eterna/ponto/visitas/AAAA-MM-DD.json, 600, mkstemp). Fora do sess_lock.
    B1: e as linhas novas do registro de calibração."""
    with sess_lock:
        dias = list(vis_sujo)
        vis_sujo.clear()
        lotes = {d: [dict(e) for e in vis_arestas.get(d) or []] for d in dias}
        calib = list(vis_calib)
        vis_calib.clear()
        tira = set(vis_calib_tira)
        vis_calib_tira.clear()
    if calib or tira:
        vis_calib_gravar(calib, tira)
    for d, lst in lotes.items():
        try:
            os.makedirs(VIS_DIR, exist_ok=True)
            fd, tmp = tempfile.mkstemp(prefix=".vis-", suffix=".tmp", dir=VIS_DIR)
            with os.fdopen(fd, "w", encoding="utf8") as fh:
                json.dump({"dia": d, "arestas": lst}, fh)
            os.chmod(tmp, 0o600)
            os.replace(tmp, os.path.join(VIS_DIR, d + ".json"))
        except Exception as ex:
            with sess_lock:
                vis_sujo.add(d)
            print("  visitas: não gravei %s (%s)" % (d, str(ex)[:80]))


def _vis_carregar(dias, agora):
    """No boot (sess_carregar, com o sess_lock): arestas de ontem e hoje e as visitas refeitas."""
    for d in dias:
        try:
            with open(os.path.join(VIS_DIR, d + ".json"), encoding="utf8") as fh:
                j = json.load(fh)
        except Exception:
            continue
        lst = []
        for e in j.get("arestas") or []:
            if isinstance(e, dict) and e.get("tipo") in ("rosto", "juntar", "separar") and isinstance(e.get("a"), str) and isinstance(e.get("b"), str):
                lst.append(e)
                vis_seq[0] = max(vis_seq[0], int(e.get("seq") or 0))
        vis_arestas[d] = lst


def vis_idx_boot(agora=None):
    """No boot, fora do sess_lock: o anel refeito do rostos.db para as fotos das levas das últimas 50 min. B1 (segurança):
    só o rosto que passa em _sess_qualidade (principal, >= 60 px e, pela tabela rosto_q, score >= 0,80 e frontal); rosto
    lido antes da tabela existir fica fora (sem score conhecido)."""
    agora = time.time() if agora is None else agora
    with sess_lock:
        pids = {}
        for x in sess.values():
            if x.get("removida") or _num(x.get("cap1")) < agora - VIS_JANELA:
                continue
            for p in x["fotos"]:
                pids[p] = (x["card"], _num(x.get("cap1")))
    if not pids:
        return 0
    faces = _sess_faces_db(list(pids))
    boas = _rosto_q_db(list(faces))
    n = 0
    with sess_lock:
        for p, fs in faces.items():
            card, t = pids.get(p, (None, 0))
            if card is None:
                continue
            q = boas.get(p) or set()
            fs = [(f[0], f[1], 1.0, True) if array.array("f", f[1]).tobytes() in q else (f[0], f[1], 0.0, False) for f in fs]
            for f in _sess_principais(_sess_faces(fs)):
                if _sess_qualidade(f):
                    _vis_idx_add(t, card, p, f["v"])
                    _vis_rostos_add(card, p, f["v"])
                    n += 1
    return n


def _rosto_q_db(pids):
    """{pid: {emb}} dos rostos de qualidade gravados (tabela rosto_q)."""
    out = {}
    if not pids or not os.path.exists(ROSTOS_DB):
        return out
    try:
        db = rostos_db()
        lista = list(pids)
        for i in range(0, len(lista), 500):
            parte = lista[i:i + 500]
            for p, emb in db.execute("select pid, emb from rosto_q where pid in (%s)" % ",".join("?" * len(parte)), parte):
                out.setdefault(p, set()).add(bytes(emb))
        db.close()
    except Exception as ex:
        print("  visitas: rostos de qualidade do boot indisponíveis (%s)" % str(ex)[:80])
    return out


def vis_protege(cards):
    """Levas de galeria de escola ou de menor: nunca ligam por rosto (só por Juntar). Refaz os dias afetados."""
    cards = {c for c in cards if isinstance(c, str) and c}
    novos = cards - vis_prot
    if not novos:
        return
    with sess_lock:
        antes = {c2 for c in novos for c2 in vis_levas_de(c)}   # as levas que estavam na visita da leva protegida
        vis_prot.update(novos)
        for d in {sess[c]["dia"] for c in novos if c in sess}:
            _vis_recalc(d)
        reab = _vis_ia_reabre(antes, "protegida")   # item 5: escola ou menor publicada depois da ligação
    if reab:
        print("  visitas: %d leva(s) voltaram a ter bases de IA (escola ou menor separada da visita)" % len(reab))
    sess_gravar()


def vis_protege_manifesto(m):
    if isinstance(m, dict) and (m.get("tipo") == "evento" or m.get("menor")):
        vis_protege({str(f.get("sessao") or "") for f in (m.get("fotos") or []) if isinstance(f, dict)} | set(m.get("sessoes") or []))


def _vis_esquecer(pid, card, removida):
    """LGPD (com o sess_lock): o pid sai do anel, das arestas e do registro de calibração; leva removida sai da visita."""
    _vis_idx_tira(pids={pid})
    vis_calib_tira.add(pid)                              # B1: o vis_gravar tira do arquivo (fora do sess_lock)
    for o in vis_calib:
        for k in ("pa", "pb"):
            if o.get(k) == pid:
                o[k] = None
    for c in [card] if card else []:
        if c in vis_rostos:
            vis_rostos[c] = [(p, v) for p, v in vis_rostos[c] if p != pid]
    for d, lst in vis_arestas.items():
        for e in lst:
            for k in ("pa", "pb"):
                if e.get(k) == pid:
                    e[k] = None
                    vis_sujo.add(d)
    if removida and card:
        _vis_idx_tira(cards={card})
        vis_rostos.pop(card, None)
        x = sess.get(card)
        if x is not None:
            _vis_recalc(x["dia"])


def ff_funcao_validar(body):
    """Devolve (dia, map limpo, ignoradas) ou None. Só tipo, point e modo. Chave fora do cadastro é ignorada (conta em
    "ignoradas"); dia errado, map que não é objeto, mais de 40 chaves ou campo inválido numa chave cadastrada = None (400)."""
    dia = body.get("dia")
    if dia not in (_ff_hoje(), time.strftime("%Y-%m-%d", time.gmtime())):
        return None
    mp = body.get("map")
    if not isinstance(mp, dict) or len(mp) > 40:
        return None
    cad = ff_cadastrados()
    limpo = {}
    ignoradas = 0
    for k, f in mp.items():
        kk = sem_acento(k)
        if kk not in cad:
            ignoradas += 1
            continue
        if not isinstance(f, dict):
            return None
        tipo = f.get("tipo")
        if tipo not in FF_TIPOS:
            return None
        x = {"tipo": tipo}
        if tipo == "campo":
            p = f.get("point")
            if not isinstance(p, str) or not _re_ff_point.match(p):
                return None
            x["point"] = p
        elif tipo == "volante":
            md = f.get("modo") or "livre"
            if md not in FF_MODOS:
                return None
            x["modo"] = md
        limpo[kk] = x
    return dia, limpo, ignoradas


HOSTS_OK = {"127.0.0.1:%d" % PORT, "localhost:%d" % PORT}
if os.environ.get("ETERNA_REDE"):
    HOSTS_OK.add("%s:%d" % (lan_ip(), PORT))
# Endereços de ETERNA_ORIGENS (IP da rede do ponto, nome e IP do Tailscale): configurados no próprio servidor, então
# valem como Host do agente. Sem isso, quem abre pelo nome do Tailscale (curadoria remota) não vê as fotos (403).
HOSTS_OK |= ORIGENS_REDE_HOSTS


def host_ok(host):
    """Host de um pedido que não é público: o do agente (contra DNS rebinding)."""
    return host in HOSTS_OK or host in ("127.0.0.1:%d" % PORT, "localhost:%d" % PORT)


IMP_MAX_CORPO = 60 * 1024 * 1024
IMP_DIR = os.path.join(HOME, "impressao")
# Imprime cada JPEG numa folha 10x15 da impressora do servidor, sem margem e preenchendo a folha (corta o excesso,
# como a DNP faz). Usa o .NET do próprio Windows (System.Drawing), sem programa extra.
IMP_PS1 = r"""
param([string]$Impressora, [string[]]$Arquivos, [string]$Lista, [string]$Cancelar)
[Console]::OutputEncoding = [Text.Encoding]::UTF8          # o agente lê a saída em UTF-8 (avisos com acento)
Add-Type -AssemblyName System.Drawing
# a lista vem num arquivo (uma foto por linha): com -File, o PowerShell só põe em -Arquivos o primeiro de vários argumentos
if ($Lista) { $Arquivos = @(Get-Content -LiteralPath $Lista -Encoding UTF8 | Where-Object { $_ }) }
function Diz($t) { [Console]::Out.WriteLine($t); [Console]::Out.Flush() }
function Cancelado { return ($Cancelar -and (Test-Path -LiteralPath $Cancelar)) }
$motivos = @{3='pouco papel'; 4='sem papel'; 5='ribbon acabando'; 6='sem ribbon'; 7='tampa aberta'; 8='papel preso';
             9='desligada ou sem cabo'; 10='pede manutenção'; 11='bandeja de saída cheia'}
# Uma foto por trabalho, e a próxima só depois que a anterior SAIU (fila do Windows vazia e a impressora parada): a DS-RX1
# descartava o que chegava enquanto imprimia. Sem papel, sem ribbon ou desligada, espera (avisando o motivo) em vez de
# mandar a próxima e perder a foto. Trabalho "Printed, Retained" (Windows guardando o impresso) não conta como pendente.
# Com a impressora parada, fila vazia não libera nada: nada é enviado e, se o trabalho da foto sumiu do Windows, ela não saiu.
$param = @(4, 6, 7, 8, 9, 11)
# ETERNA_IMP_SEM_ESTADO: impressora cujo estado no Windows fica preso depois de um aviso (a laser do teste, por USB): não confia nele
if ($env:ETERNA_IMP_SEM_ESTADO) { $param = @(); $motivos = @{} }
$script:perdida = $false
function Espera-Livre([switch]$Foto) {
  $ini = Get-Date; $ultimo = $null
  while ($true) {
    if (Cancelado) { return $false }
    $fila = @(Get-PrintJob -PrinterName $Impressora -ErrorAction SilentlyContinue | Where-Object { "$($_.JobStatus)" -notmatch 'Printed|Complete|Deleted' })
    $p = Get-CimInstance Win32_Printer -Filter ("Name='" + $Impressora + "'")
    $aviso = ''
    if (-not $p) { $aviso = 'impressora não encontrada no Windows' }
    elseif ($p.WorkOffline) { $aviso = 'desligada ou sem cabo' }
    elseif ($motivos.ContainsKey([int]$p.DetectedErrorState)) { $aviso = $motivos[[int]$p.DetectedErrorState] }
    elseif (@($fila | Where-Object { "$($_.JobStatus)" -match 'Error|Offline|PaperOut|Blocked|UserIntervention' }).Count) { $aviso = 'a impressora parou (' + $fila[0].JobStatus + ')' }
    elseif (((Get-Date) - $ini).TotalSeconds -gt 120) { $aviso = 'a impressora não termina há mais de 2 minutos' }
    if ($aviso -ne $ultimo) { Diz ("AVISO " + $aviso); $ultimo = $aviso }
    $parada = $p -and ($p.WorkOffline -or ($param -contains [int]$p.DetectedErrorState))
    if ($p -and $fila.Count -eq 0 -and $p.PrinterStatus -ne 4) {
      if (-not $parada) { return $true }
      if ($Foto) { $script:perdida = $true; return $true }
    }
    Start-Sleep -Milliseconds 500
  }
}
$erros = @()
foreach ($f in $Arquivos) {
  if (Cancelado) { break }
  try {
    if (-not (Espera-Livre)) { break }
    $img = [System.Drawing.Image]::FromFile($f)
    if ($img.Width -gt $img.Height) { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $Impressora
    if (-not $doc.PrinterSettings.IsValid) { throw "impressora '$Impressora' não encontrada" }
    $doc.DocumentName = "Eterna " + [IO.Path]::GetFileNameWithoutExtension($f)
    $ps = $doc.PrinterSettings.PaperSizes | Where-Object { $a=[Math]::Min($_.Width,$_.Height); $b=[Math]::Max($_.Width,$_.Height); $a -ge 395 -and $a -le 420 -and $b -ge 595 -and $b -le 625 } | Select-Object -First 1
    if ($ps -and -not $env:ETERNA_IMP_PAPEL_PADRAO) { $doc.DefaultPageSettings.PaperSize = $ps }   # ETERNA_IMP_PAPEL_PADRAO: teste em impressora comum, usa o papel que já está nela
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
    Start-Sleep -Seconds 2                          # o trabalho aparece na fila do Windows
    if (-not (Espera-Livre -Foto)) { break }        # FOTO = saiu da impressora, não só entregue ao Windows
    if ($script:perdida) { $erros += ([IO.Path]::GetFileName($f) + ": saiu da fila do Windows com a impressora parada, sem imprimir"); break }
    Diz ("FOTO " + [IO.Path]::GetFileName($f) + " " + (Get-Date -Format HH:mm:ss))
  } catch { $erros += ([IO.Path]::GetFileName($f) + ": " + $_.Exception.Message) }
}
if (Cancelado) { Diz "CANCELADO"; exit 0 }
if ($erros.Count) { Diz ("ERRO " + ($erros -join " | ")); exit 1 }
Diz "OK"
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


def imp_miniatura(pedido, n):
    """Miniatura (200 px) da foto n do pedido, para o painel da fila. Gerada uma vez ao lado do arquivo de impressão."""
    with lock:
        j = next((x for x in imp_fila if x["id"] == pedido), None)
        arqs = list((j or {}).get("arquivos") or [])
    if not (0 <= n < len(arqs)):
        return None
    src = arqs[n]
    mini = src[:-4] + "_m.jpg"
    if not os.path.exists(mini):
        if not os.path.exists(src):
            return None
        try:
            from PIL import Image
            with Image.open(src) as im:
                im = im.convert("RGB")
                im.thumbnail((200, 200))
                im.save(mini, "JPEG", quality=70)
        except Exception:
            return None
    return mini


def imp_flag_cancelar(pid):
    return os.path.join(IMP_DIR, "cancelar_%s" % pid)


def imp_acao(body):
    """Painel da fila: cancelar (na fila sai na hora; imprimindo para antes da próxima foto), reimprimir tudo ou só o que
    faltou (vira um pedido novo no fim da fila, com as mesmas fotos, já gravadas no servidor)."""
    acao = body.get("acao")
    try:
        pid = int(body.get("id"))
    except (TypeError, ValueError):
        return {"ok": False, "error": "pedido inválido"}
    with lock:
        j = next((x for x in imp_fila if x["id"] == pid), None)
        if not j:
            return {"ok": False, "error": "pedido não encontrado"}
        if acao == "cancelar":
            if j["estado"] == "na_fila":
                j["estado"], j["fim"] = "cancelado", time.time()
            elif j["estado"] == "imprimindo":
                os.makedirs(IMP_DIR, exist_ok=True)
                open(imp_flag_cancelar(pid), "w").close()
                j["aviso"] = "cancelando: para antes da próxima foto"
            else:
                return {"ok": False, "error": "esse pedido já terminou"}
            j["cancelado_por"] = str(body.get("por") or "")[:60]
            imp_salvar()
            return {"ok": True}
        if acao not in ("reimprimir", "faltantes"):
            return {"ok": False, "error": "ação inválida"}
        if j["estado"] in ("na_fila", "imprimindo"):
            return {"ok": False, "error": "esse pedido ainda está na fila"}
        if any(x["venda"] == j["venda"] and x["estado"] in ("na_fila", "imprimindo") for x in imp_fila):
            return {"ok": False, "error": "essa venda já está na fila"}
        arqs = list(j.get("arquivos") or [])
        if acao == "faltantes":
            arqs = arqs[j.get("feitas") or 0:]
        arqs = [a for a in arqs if os.path.exists(a)]
        venda, vendedor, posto = j["venda"], j.get("vendedor") or "", j.get("posto") or ""
    if not arqs:
        return {"ok": False, "error": "nenhuma foto para reimprimir"}
    novo = imp_pedido(venda, vendedor, posto, arqs)
    with lock:
        novo["reimpressao_de"] = pid
        novo["venda_id"] = j.get("venda_id") or ""
        imp_salvar()
    threading.Thread(target=imprimir_fila, args=(imp_ps1(), arqs, venda, {"kb": 0}, novo), daemon=True).start()
    return {"ok": True, "pedido": novo["id"]}


imp_estado = {}           # impressora -> {estado, motivo, pendentes, em}: lido do Windows a cada 10 s
IMP_ESTADO_PS1 = r"""
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$motivos = @{3='pouco papel'; 4='sem papel'; 5='ribbon acabando'; 6='sem ribbon'; 7='tampa aberta'; 8='papel preso';
             9='desligada ou sem cabo'; 10='pede manutenção'; 11='bandeja de saída cheia'}
$out = @{}
foreach ($n in $args) {
  $p = Get-CimInstance Win32_Printer -Filter ("Name='" + $n.Replace("'", "''") + "'")
  if (-not $p) { $out[$n] = @{estado='erro'; motivo='não encontrada no Windows'; pendentes=0}; continue }
  $pend = @(Get-PrintJob -PrinterName $n -ErrorAction SilentlyContinue | Where-Object { "$($_.JobStatus)" -notmatch 'Printed|Complete|Deleted' }).Count
  $m = $null
  if ($p.WorkOffline) { $m = 'desligada ou sem cabo' } elseif ($motivos.ContainsKey([int]$p.DetectedErrorState)) { $m = $motivos[[int]$p.DetectedErrorState] }
  $e = if ($m) { 'erro' } elseif ($p.PrinterStatus -eq 4 -or $pend) { 'imprimindo' } else { 'livre' }
  $out[$n] = @{estado=$e; motivo=$m; pendentes=$pend}
}
$out | ConvertTo-Json -Compress
"""


def imp_monitor():
    """Estado real de cada DNP no Windows (livre, imprimindo, sem papel, desligada...), a cada 10 s, para o painel."""
    if not IMPRESSORAS or os.environ.get("ETERNA_IMPRESSORA_TESTE") or sys.platform != "win32":
        return
    ps1 = os.path.join(IMP_DIR, "estado.ps1")
    os.makedirs(IMP_DIR, exist_ok=True)
    with open(ps1, "w", encoding="utf-8-sig") as fh:
        fh.write(IMP_ESTADO_PS1)
    while True:
        try:
            r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1] + IMPRESSORAS,
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30)
            d = json.loads(r.stdout or "{}")
            agora = time.time()
            with lock:
                for n in IMPRESSORAS:
                    x = d.get(n) or {"estado": "erro", "motivo": "sem leitura do Windows", "pendentes": 0}
                    imp_estado[n] = {"estado": x.get("estado"), "motivo": x.get("motivo"), "pendentes": x.get("pendentes") or 0, "em": agora}
        except Exception as ex:
            print("  estado das impressoras: não leu:", str(ex)[:120])
        time.sleep(10)


def imp_fila_json():
    agora = time.time()
    with lock:
        jobs = [{k: v for k, v in j.items() if k != "arquivos"} for j in imp_fila
                if j["estado"] in ("na_fila", "imprimindo") or agora - (j["fim"] or agora) < 3 * 3600]
        estados = {k: dict(v) for k, v in imp_estado.items()}
    return {"ok": True, "impressora": IMPRESSORA or None, "impressoras": IMPRESSORAS, "estados": estados,
            "postos": {k: v for k, v in IMP_POSTOS.items()}, "agora": agora, "pedidos": jobs}


def imprimir(imagens, venda, vendedor="", posto="", venda_id=""):
    """Recebe as fotos já montadas pelo app (JPEG em base64) e manda cada uma para a impressora deste servidor."""
    if not isinstance(imagens, list) or not imagens or len(imagens) > 20:
        return {"ok": False, "error": "nenhuma foto (ou mais de 20)"}
    with lock:                 # a mesma venda ainda na fila: não entra de novo (novo clique, outra aba, tela recarregada)
        ativo = next((j for j in imp_fila if venda and j["venda"] == venda and j["estado"] in ("na_fila", "imprimindo")), None)
        if ativo:
            frente = sum(1 for j in imp_fila if j["estado"] in ("na_fila", "imprimindo") and j["id"] < ativo["id"])
            return {"ok": True, "ja_na_fila": True, "fotos": ativo["fotos"], "impressora": IMPRESSORA, "pedido": ativo["id"], "na_frente": frente,
                    "gravar_ms": 0, "spooler_ms": 0, "kb": 0}
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
    job["venda_id"] = venda_id
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
            if job["estado"] == "cancelado":               # cancelado no painel enquanto esperava a vez
                return
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
                lista = os.path.join(IMP_DIR, "lista_%s.txt" % job["id"])
                with open(lista, "w", encoding="utf-8") as fh:
                    fh.write("\n".join(arqs) + "\n")
                pr = subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Impressora", imp,
                                       "-Lista", lista, "-Cancelar", imp_flag_cancelar(job["id"])],
                                      stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
                for ln in pr.stdout:
                    ln = ln.strip()
                    if not ln:
                        continue
                    if ln.startswith("AVISO"):                  # a DNP parou (sem papel, ribbon, desligada): o painel mostra
                        with lock:
                            job["aviso"] = ln[5:].strip() or None
                            imp_salvar()
                        continue
                    linhas.append(ln)
                    if ln.startswith("FOTO"):
                        with lock:
                            job["feitas"] += 1
                            job["aviso"] = None
                            imp_salvar()
                pr.wait(timeout=120 + 90 * len(arqs))
                saida = " ".join(" ".join(linhas).split())
                entregues = sum(1 for x in linhas if x.startswith("FOTO"))
                # só é "impresso" com todas as fotos entregues à DNP: faltou uma, é erro (nunca um OK com foto a menos)
                ok = pr.returncode == 0 and linhas and linhas[-1].startswith("OK") and entregues == len(arqs)
                if pr.returncode == 0 and entregues != len(arqs):
                    linhas.append("ERRO %d de %d fotos entregues à impressora" % (entregues, len(arqs)))
            except Exception as ex:
                saida, ok = "ERRO " + str(ex), False
        cancelado = os.path.exists(imp_flag_cancelar(job["id"]))
        with lock:
            job["estado"], job["fim"] = ("cancelado" if cancelado else "impresso" if ok else "erro"), time.time()
            job["aviso"] = None
            if not ok and not cancelado:
                job["erro"] = saida[-200:]
            imp_salvar()
        try:
            ev_fila(job)
        except Exception as ex:
            print("  tempos da fila não gravados:", str(ex)[:200])
        try:
            os.remove(imp_flag_cancelar(job["id"]))
        except OSError:
            pass
        print(f"  impressão {venda or '-'}: {len(arqs)} foto(s) em {imp}, {ms.get('kb', 0)} KB, "
              f"{time.time() - t1:.0f} s até a DNP terminar -> {saida[:300]}")
    finally:
        with lock:
            imp_ocupadas.discard(imp)


# ---------- Estado da equipe no servidor (v90) ----------
# Tudo o que antes morava só no navegador de cada computador (usuários e permissões, registro de quem mudou o quê, diário,
# treino da IA, venue, revisões, bandeiras, função do dia e, pela coleção "sim", preços, estoque, descartes, ajustes de
# foto, cortesias...) mora aqui: ~/Eterna/ponto/estado.db, um registro por item (col, id), com rev crescente. O app liga o
# seu banco plugável (state.db, a mesma interface de coleção/doc/onSnapshot) a estas rotas:
#   GET  /ponto/docs/revs                 -> {revs:{col: rev}}        (um pedido só para saber o que mudou)
#   GET  /ponto/docs?col=<col>            -> {rev, docs:[{id, valor}]} (a coleção inteira, sem os apagados)
#   POST /ponto/docs {docs:[{col,id,valor}]}  valor null apaga.        -> {ok, rev}
# O navegador guarda uma cópia e uma fila do que ainda não subiu (sem rede); o servidor é o dono. Backup no S3 com as vendas.
ESTADO_DB = os.path.join(HOME, "ponto", "estado.db")
ESTADO_COLS = ("usuarios", "usuarios_login", "usuarios_log", "diario", "treino", "config", "reviews", "bandeiras", "funcao", "sim", "agenda")
ESTADO_MAX = 512 * 1024              # um registro (um usuário, um ajuste de foto) nunca passa disto
estado_lock = threading.Lock()


def estado_db():
    os.makedirs(os.path.dirname(ESTADO_DB), exist_ok=True)
    c = sqlite3.connect(ESTADO_DB, timeout=30, check_same_thread=False)
    c.execute("pragma journal_mode=wal")
    c.execute("pragma synchronous=full")
    c.execute("create table if not exists doc (col text, id text, valor text, rev integer, em text, primary key (col, id))")
    c.execute("create index if not exists doc_rev on doc(col, rev)")
    return c


# Entrada da equipe: usuário e senha conferidos aqui, no servidor, para funcionar sem internet e sem e-mail. Mora no estado.db,
# em tabelas próprias, fora de /ponto/docs e dos feeds: credencial guarda só o hash scrypt com sal, sessao_login só o hash do token
# (o navegador fica com o token em cookie HttpOnly). O admin cadastra; a senha que ele gera é provisória e a pessoa troca na entrada.
AUTH_ID = re.compile(r"^[a-z0-9][a-z0-9._@+-]{1,99}$")
AUTH_N, AUTH_SESSAO, AUTH_ERROS, AUTH_BLOQUEIO, AUTH_SENHA_MIN = 2 ** 17, 12 * 3600, 5, 900, 10
AUTH_PROVISORIA_S, AUTH_ERROS_IP = 72 * 3600, 30
AUTH_RESET_S, AUTH_RESET_INTERVALO, AUTH_RESET_IP = 30 * 60, 15 * 60, 10   # esqueci a senha: vale 30 min, 1 pedido a cada 15 min por usuário, 10 por hora por endereço
AUTH_COOKIE = "eterna_sessao"
auth_cpu = threading.BoundedSemaphore(2)      # scrypt usa 128 MB por conta: várias tentativas juntas não derrubam o servidor
auth_ip_erros = {}                            # erros recentes por endereço, contra quem testa uma senha em muitos usuários
auth_reset_ip = {}                            # pedidos de "esqueci a senha" por endereço


def auth_db():
    c = estado_db()
    c.execute("create table if not exists credencial (usuario text primary key, hash text, sal text, n integer,"
              " provisoria integer, erros integer default 0, bloqueado_ate real default 0, atualizada real)")
    c.execute("create table if not exists sessao_login (token text primary key, usuario text, expira real)")
    c.execute("create table if not exists login_log (em real, usuario text, acao text, por text, ip text)")
    c.execute("create table if not exists reset_senha (usuario text primary key, hash text, sal text, n integer, expira real, pedido real)")
    # posto pareado: cada aparelho (Checkout, caixa, TV) recebe um cookie próprio; aqui fica só o SHA-256 do token
    c.execute("create table if not exists posto (id text primary key, nome text, num integer, hash text unique, criado_por text, criado_em real,"
              " ultimo_uso real, ip_ultimo text, revogado_em real)")
    c.execute("create table if not exists posto_convite (hash text primary key, nome text, expira real, usado real)")
    return c


def auth_hash(senha, sal, n):
    with auth_cpu:
        return hashlib.scrypt(senha.encode("utf-8"), salt=bytes.fromhex(sal), n=n, r=8, p=1, maxmem=256 * 1024 * 1024, dklen=32).hex()


# Regra da senha nova, sempre conferida aqui: tamanho, e nada que um atacante tente primeiro. Não exige maiúscula nem símbolo: isso só
# gera Senha@2026. Uma frase longa passa; o que sobra depois de tirar sequências e palavras óbvias é que precisa ter tamanho.
AUTH_SEQUENCIAS = ("abcdefghijklmnopqrstuvwxyz", "0123456789", "1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "1qaz2wsx", "1q2w3e4r5t", "q1w2e3r4t5", "a1b2c3d4")
AUTH_OBVIAS = ("senha", "password", "pass", "admin", "administrador", "usuario", "teste", "test", "mudar", "trocar", "acesso", "login", "entrar",
               "welcome", "bemvindo", "iloveyou", "teamo", "amor", "deus", "jesus", "mae", "pai", "familia", "brasil", "riodejaneiro", "rio",
               "flamengo", "fluminense", "vasco", "botafogo", "corinthians", "palmeiras", "santos", "saopaulo", "gremio", "cruzeiro",
               "maracana", "vivamaracana", "viva", "maracatour", "eterna", "futebol", "estadio", "tour", "fotografo", "fotos", "foto", "vendedor",
               "caixa", "supervisor", "checkout", "roverpix", "qwerty", "letmein", "dragon", "monkey")
AUTH_LEET = str.maketrans("@4310$57", "aaeiosst")


def auth_norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]", "", s.translate(AUTH_LEET))


def auth_senha_fraca(usuario, nome, senha):
    """O código do motivo de recusar esta senha nova, ou None se ela serve. Quem escreve a mensagem é a tela, no idioma da pessoa."""
    if len(senha) < AUTH_SENHA_MIN:
        return "curta"
    if not re.search(r"[^\W\d_]", senha):
        return "so_numeros"
    cru = senha.lower()
    if len(set(cru)) < 5:
        return "repetida"
    for base in AUTH_SEQUENCIAS:
        for seq in (base, base[::-1]):
            for tam in range(len(seq), 3, -1):
                for i in range(len(seq) - tam + 1):
                    cru = cru.replace(seq[i:i + tam], "")
    resto = auth_norm(cru)
    proprias = [p for p in re.split(r"[^a-z0-9]+", auth_norm_nome(usuario + " " + (nome or ""))) if len(p) >= 3]
    for p in sorted(set(AUTH_OBVIAS) | {auth_norm(x) for x in proprias}, key=len, reverse=True):
        resto = resto.replace(p, "")
    if len(resto) < 6:
        return "obvia"
    return None


def auth_norm_nome(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def auth_log(db, usuario, acao, por="", ip=""):
    db.execute("insert into login_log values (?, ?, ?, ?, ?)", (time.time(), usuario, acao, por, ip))


def auth_provisoria():
    return "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(12))


def auth_criar(usuario, por="", ip=""):
    """Gera a senha provisória, mostrada uma única vez, para quem já está no cadastro."""
    senha = auth_provisoria()
    sal = secrets.token_hex(16)
    h = auth_hash(senha, sal, AUTH_N)
    with estado_lock:
        db = auth_db()
        try:
            db.execute("insert into credencial (usuario, hash, sal, n, provisoria, erros, bloqueado_ate, atualizada) values (?, ?, ?, ?, 1, 0, 0, ?)"
                       " on conflict(usuario) do update set hash=excluded.hash, sal=excluded.sal, n=excluded.n, provisoria=1, erros=0, bloqueado_ate=0,"
                       " atualizada=excluded.atualizada", (usuario, h, sal, AUTH_N, time.time()))
            db.execute("delete from sessao_login where usuario=?", (usuario,))
            db.execute("delete from reset_senha where usuario=?", (usuario,))
            auth_log(db, usuario, "senha_provisoria", por, ip)
            db.commit()
        finally:
            db.close()
    return senha


def auth_enviar_reset(destino, senha, idioma=None):
    """A nuvem manda o e-mail pelo SES, com o segredo do ponto. Sem internet ou sem nuvem configurada, levanta erro."""
    if not NUVEM_API:
        raise RuntimeError("nuvem não configurada")
    rq = urllib.request.Request(NUVEM_API + "/auth/senha-email", data=json.dumps({"email": destino, "senha": senha, "idioma": idioma or "pt"}).encode(), method="POST",
                                headers={"Content-Type": "application/json", "X-Eterna-Ponto": nuvem_segredo(), "User-Agent": "eterna-agente"})
    with urllib.request.urlopen(rq, timeout=20) as r:
        r.read()


def auth_destino(usuario, cad):
    d = str((cad or {}).get("contato") or (usuario if "@" in usuario else "")).strip().lower()
    return d if AUTH_EMAIL.match(d) else ""


def auth_esqueci(usuario, ip=""):
    """Senha provisória por e-mail. Fica ao lado da senha atual, que continua valendo: pedir em nome de outra pessoa não a tira do ar.
    Só para quem está ativo, já tem senha e tem e-mail; quem pede nunca fica sabendo qual foi o caso."""
    agora = time.time()
    pedidos = [t for t in auth_reset_ip.get(ip, []) if t > agora - 3600]
    if len(pedidos) >= AUTH_RESET_IP:
        return False
    auth_reset_ip[ip] = pedidos + [agora]
    with estado_lock:
        db = auth_db()
        try:
            tem = db.execute("select 1 from credencial where usuario=?", (usuario,)).fetchone()
            cad = auth_cadastro(db, usuario)
            ant = db.execute("select pedido from reset_senha where usuario=?", (usuario,)).fetchone()
        finally:
            db.close()
    destino = auth_destino(usuario, cad)
    if not tem or not auth_ativo(cad) or not destino or (ant and ant[0] > agora - AUTH_RESET_INTERVALO):
        return False
    senha, sal = auth_provisoria(), secrets.token_hex(16)
    h = auth_hash(senha, sal, AUTH_N)
    with estado_lock:
        db = auth_db()
        try:
            db.execute("insert or replace into reset_senha values (?, ?, ?, ?, ?, ?)", (usuario, h, sal, AUTH_N, agora + AUTH_RESET_S, agora))
            auth_log(db, usuario, "reset_pedido", "", ip)
            db.commit()
        finally:
            db.close()
    try:
        auth_enviar_reset(destino, senha, (cad or {}).get("idioma"))
        return True
    except Exception as ex:
        print("  esqueci a senha: envio falhou: %s" % str(ex)[:160])
        with estado_lock:
            db = auth_db()
            try:
                db.execute("delete from reset_senha where usuario=?", (usuario,))
                auth_log(db, usuario, "reset_falhou", "", ip)
                db.commit()
            finally:
                db.close()
        return False


def auth_cadastro(db, usuario):
    r = db.execute("select valor from doc where col='usuarios' and id=? and valor is not null", (quote(usuario, safe="-_.!~*'()"),)).fetchone()
    return json.loads(r[0]) if r else None


def auth_ativo(cad):
    return bool(cad) and cad.get("active") is not False


def auth_pode(cad, modulo, letra):
    """A permissão do módulo no cadastro: a mesma de Permissões. É ela que decide, não o nome do perfil."""
    p = ((cad or {}).get("perms") or {}).get(modulo) or {}
    return auth_ativo(cad) and p.get(letra) is True


def auth_acessos(cad):
    return {(m, k) for m, p in ((cad or {}).get("perms") or {}).items() if isinstance(p, dict) for k, v in p.items() if v is True}


def auth_conferir(usuario, senha, ip=""):
    """-> (situação, dados): ok, provisoria, nao ou bloqueado. Usuário inexistente custa o mesmo tempo que senha errada."""
    with estado_lock:
        db = auth_db()
        try:
            c = db.execute("select usuario, hash, sal, n, provisoria, bloqueado_ate, atualizada from credencial where usuario=?", (usuario,)).fetchone()
            cad = auth_cadastro(db, usuario) if c else None
            rs = db.execute("select hash, sal, n, expira from reset_senha where usuario=?", (usuario,)).fetchone() if c else None
        finally:
            db.close()
    agora = time.time()
    falhas = [t for t in auth_ip_erros.get(ip, []) if t > agora - AUTH_BLOQUEIO]
    if len(falhas) >= AUTH_ERROS_IP:
        return "bloqueado", None
    if not c:
        auth_hash(senha, "00" * 16, AUTH_N)
        auth_ip_erros[ip] = falhas + [agora]
        return "nao", None
    por_reset = bool(rs) and rs[3] > agora and hmac.compare_digest(auth_hash(senha, rs[1], rs[2]), rs[0])
    if c[5] > agora and not por_reset:                  # o bloqueio segura a senha digitada, não a que chegou no e-mail da pessoa
        return "bloqueado", None
    certa = por_reset or hmac.compare_digest(auth_hash(senha, c[2], c[3]), c[1])
    if c[4] and c[6] < agora - AUTH_PROVISORIA_S and not por_reset:       # senha provisória vencida: quem pode gera outra
        certa = False
    if not certa:
        auth_ip_erros[ip] = falhas + [agora]
    with estado_lock:
        db = auth_db()
        try:
            if certa and auth_ativo(cad):
                db.execute("update credencial set erros=0, bloqueado_ate=0 where usuario=?", (usuario,))
                auth_log(db, usuario, "entrou", "", ip)
                db.commit()
                return ("provisoria" if c[4] or por_reset else "ok"), {"usuario": c[0], "cadastro": cad}
            db.execute("update credencial set erros=erros+1 where usuario=?", (usuario,))
            erros = db.execute("select erros from credencial where usuario=?", (usuario,)).fetchone()[0]
            if erros >= AUTH_ERROS:
                db.execute("update credencial set erros=0, bloqueado_ate=? where usuario=?", (time.time() + AUTH_BLOQUEIO, usuario))
                auth_log(db, usuario, "bloqueado", "", ip)
            else:
                auth_log(db, usuario, "erro", "", ip)
            db.commit()
        finally:
            db.close()
    return "nao", None


def auth_trocar(usuario, nova, ip=""):
    sal = secrets.token_hex(16)
    h = auth_hash(nova, sal, AUTH_N)
    with estado_lock:
        db = auth_db()
        try:
            db.execute("update credencial set hash=?, sal=?, n=?, provisoria=0, erros=0, bloqueado_ate=0, atualizada=? where usuario=?",
                       (h, sal, AUTH_N, time.time(), usuario))
            db.execute("delete from sessao_login where usuario=?", (usuario,))
            db.execute("delete from reset_senha where usuario=?", (usuario,))
            auth_log(db, usuario, "trocou_senha", usuario, ip)
            db.commit()
        finally:
            db.close()


def auth_sessao_nova(usuario):
    token = secrets.token_urlsafe(32)
    with estado_lock:
        db = auth_db()
        try:
            db.execute("delete from sessao_login where expira < ?", (time.time(),))
            db.execute("insert into sessao_login values (?, ?, ?)", (hashlib.sha256(token.encode()).hexdigest(), usuario, time.time() + AUTH_SESSAO))
            db.commit()
        finally:
            db.close()
    return token


def auth_quem(token):
    """A pessoa dona deste token, se a sessão vale e o cadastro segue ativo; senão None."""
    if not token:
        return None
    with estado_lock:
        db = auth_db()
        try:
            r = db.execute("select usuario from sessao_login where token=? and expira > ?", (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
            if not r:
                return None
            cad = auth_cadastro(db, r[0])
        finally:
            db.close()
    return {"usuario": r[0], "cadastro": cad} if auth_ativo(cad) else None


def auth_ler_cadastro(usuario):
    with estado_lock:
        db = auth_db()
        try:
            cad = auth_cadastro(db, usuario)
            tem = bool(db.execute("select 1 from credencial where usuario=?", (usuario,)).fetchone())
        finally:
            db.close()
    return cad, tem


def auth_senhas():
    """Quem tem senha e quando trocou, para quem pode Ver em Senhas de acesso. Nunca o hash."""
    with estado_lock:
        db = auth_db()
        try:
            return {r[0]: {"provisoria": bool(r[1]), "atualizada": r[2]} for r in db.execute("select usuario, provisoria, atualizada from credencial")}
        finally:
            db.close()


# Os mesmos limites de permValidate na tela, agora também no servidor: sem isto, quem chama /ponto/docs se daria qualquer acesso, inclusive o de gerar senhas.
AUTH_MODULOS = ("estoque", "relatorios", "desempenho", "financeiro", "galerias", "qualidade", "diario", "set", "escala", "filafoto", "configuracao",
                "catalogo", "usuarios", "senhas", "permissoes", "laboratorio", "venda", "quiosque", "estatisticas")     # os mesmos de MODULES no app
AUTH_CAMPOS_CADASTRO, AUTH_CAMPOS_ACESSO = ("name", "email", "contato", "key", "active"), ("perms", "menu", "preset", "inicio")
AUTH_IDIOMAS = (None, "", "pt", "en", "es", "fr")
AUTH_EMAIL = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$")


def auth_cadastro_recusa(quem, id_doc, antes, depois):
    """O motivo de recusar esta gravação em usuarios, ou None. quem é a sessão de quem grava."""
    if not quem:
        return "sem_sessao"
    ed = quem["cadastro"]
    if antes is None and depois is None:
        return None
    if antes is None:
        if not auth_pode(ed, "usuarios", "c"):
            return "sem_permissao"
    elif depois is None:
        if not auth_pode(ed, "usuarios", "d"):
            return "sem_permissao"
    else:
        if any(antes.get(c) != depois.get(c) for c in AUTH_CAMPOS_CADASTRO) and not auth_pode(ed, "usuarios", "u"):
            return "sem_permissao"
        if any(antes.get(c) != depois.get(c) for c in AUTH_CAMPOS_ACESSO) and not auth_pode(ed, "permissoes", "u"):
            return "sem_permissao"
        if antes.get("contato") != depois.get("contato") and not auth_pode(ed, "senhas", "u"):
            return "sem_permissao"                      # é para onde a senha provisória vai: mudar o e-mail vale tanto quanto gerar outra senha
    if depois is not None and depois.get("idioma") not in AUTH_IDIOMAS:
        return "sem_permissao"
    if antes is not None and depois is not None and antes.get("idioma") != depois.get("idioma") and antes.get("email") != ed.get("email") and not auth_pode(ed, "usuarios", "u"):
        return "sem_permissao"                          # o próprio idioma cada um troca; o de outra pessoa pede Alterar em Cadastro de usuários
    novos = auth_acessos(depois) - auth_acessos(antes)
    if novos - auth_acessos(ed):
        return "sem_poder"                              # não dá um acesso que não tem
    if antes is not None and antes.get("email") != ed.get("email") and auth_acessos(antes) - auth_acessos(ed):
        return "alvo_maior"                             # não mexe em quem tem mais acesso
    return None


# Quem grava cada coleção de /ponto/docs (fora usuarios, que tem a regra acima): o módulo, com Criar ou Alterar para gravar
# e Excluir ou Alterar para apagar. Na coleção "sim", pelo começo do id; id desconhecido é recusado.
DOC_COL_MOD = {"diario": "diario", "treino": "qualidade", "reviews": "qualidade", "bandeiras": "estoque", "funcao": "escala",
               "agenda": "escala", "config": "configuracao"}
DOC_SIM = (("prices|", ("catalogo",)), ("catalogoV", ("catalogo",)),
           ("stock|", ("estoque", "venda")),          # o rolo de papel do posto baixa na impressão, feita no caixa
           ("flags|", ("estoque",)), ("flagList", ("estoque",)),
           # gravados ao montar as sessões e no Upload (fotógrafo), no caixa e na Curadoria
           ("flagUse|", ("set", "estoque", "venda")), ("invalid|", ("set", "qualidade", "venda", "estoque")),
           ("edits|", ("set", "qualidade")), ("discarded|", ("set", "qualidade")), ("ai|", ("venda", "qualidade")),
           ("autoAj", ("set",)), ("autoAjPor", ("set",)), ("camDia|", ("set",)),
           ("bgAtivo|", ("configuracao",)), ("bgOn", ("configuracao",)), ("fundosModo", ("configuracao",)),
           ("fundosModoPor", ("configuracao",)), ("lojaFimSeg", ("catalogo",)), ("repo", ("configuracao",)),
           ("bgPodioV86", ("configuracao",)), ("pagProv", ("financeiro",)), ("cortesiaLog|", ("galerias",)), ("funcao", ("escala",)))


def doc_modulos(col, id_doc):
    if col == "sim":
        for k, mods in DOC_SIM:
            if (id_doc.startswith(k) if k.endswith("|") else id_doc == k):
                return mods
        return None
    m = DOC_COL_MOD.get(col)
    return (m,) if m else None


def doc_recusa(db, quem, d):
    """O motivo de recusar esta gravação (fora de usuarios), ou None."""
    if not quem:
        return "sem_sessao"
    col, id_doc, apaga = d.get("col"), str(d.get("id") or ""), d.get("valor") is None
    if col not in ESTADO_COLS:
        return "colecao"
    existe = db.execute("select 1 from doc where col=? and id=? and valor is not null", (col, id_doc)).fetchone() is not None
    if col == "usuarios_login":
        return None if id_doc == quote(quem["usuario"], safe="-_.!~*'()") else "sem_permissao"
    if col == "usuarios_log" or (col == "sim" and id_doc.startswith("cortesiaLog|")):
        if apaga or existe:
            return "so_acrescenta"
        if col == "usuarios_log":
            return None
    mods = doc_modulos(col, id_doc)
    if not mods:
        return "desconhecido"
    letras = ("d", "u") if apaga else ("u",) if existe else ("c", "u")
    return None if any(auth_pode(quem["cadastro"], mo, le) for mo in mods for le in letras) else "sem_permissao"


def auth_filtrar_docs(body, quem, ip="", posto=None):
    """/ponto/docs: cada gravação passa pela regra da sua coleção (usuarios: auth_cadastro_recusa; outras: doc_recusa).
    Aparelho pareado sem pessoa conectada não grava. O recusado sai da resposta como "recusados" (o app não reenvia)."""
    docs = body.get("docs") if isinstance(body.get("docs"), list) else []
    fica, recusados, apagados, motivos = [], max(0, len(docs) - 500), [], {}       # acima de 500 por pedido: recusado, não some calado
    if recusados:
        motivos["excesso"] = recusados
    with estado_lock:
        db = auth_db()
        try:
            for d in docs[:500]:
                if not isinstance(d, dict):
                    continue
                if d.get("col") != "usuarios":
                    motivo = doc_recusa(db, quem, d)
                    if motivo:
                        recusados += 1
                        motivos[motivo] = motivos.get(motivo, 0) + 1
                    else:
                        fica.append(d)
                    continue
                r = db.execute("select valor from doc where col='usuarios' and id=? and valor is not null", (str(d.get("id")),)).fetchone()
                antes = json.loads(r[0]) if r else None
                depois = d.get("valor") if isinstance(d.get("valor"), dict) else None
                motivo = auth_cadastro_recusa(quem, d.get("id"), antes, depois)
                if motivo:
                    recusados += 1
                    auth_log(db, str((antes or depois or {}).get("email") or d.get("id"))[:120], "cadastro_recusado:" + motivo, (quem or {}).get("usuario", ""), ip)
                    continue
                fica.append(d)
                if antes and depois is None and antes.get("email"):
                    apagados.append(antes["email"])
            if motivos:
                auth_log(db, ("posto:" + posto["id"]) if posto and not quem else (quem or {}).get("usuario", "?"),
                         "docs_recusados:" + ",".join("%s=%d" % kv for kv in sorted(motivos.items())), (quem or {}).get("usuario", ""), ip)
            db.commit()
        finally:
            db.close()
    for email in apagados:
        auth_remover(str(email), (quem or {}).get("usuario", ""), ip)     # sem cadastro, a senha não fica para trás
    return dict(body, docs=fica), recusados


def auth_remover(usuario, por="", ip=""):
    with estado_lock:
        db = auth_db()
        try:
            db.execute("delete from credencial where usuario=?", (usuario,))
            db.execute("delete from sessao_login where usuario=?", (usuario,))
            db.execute("delete from reset_senha where usuario=?", (usuario,))
            # os postos que a pessoa criou caem junto (pareados por ela ou automáticos)
            for (pid,) in db.execute("select id from posto where revogado_em is null and criado_por in (?, ?)", (usuario, "auto:" + usuario)).fetchall():
                db.execute("update posto set revogado_em=? where id=?", (time.time(), pid))
                auth_log(db, "posto:" + pid, "posto_revogado", por, ip)
            auth_log(db, usuario, "removido", por, ip)
            db.commit()
        finally:
            db.close()


def auth_criar_admin(usuario, nome):
    """python eterna-agente.py --criar-admin <usuário> "<nome>": no próprio servidor; a senha provisória aparece só nesta tela.
    Também recupera o acesso de quem ficou sem nenhum administrador."""
    usuario = usuario.strip().lower()
    if not AUTH_ID.match(usuario):
        print("Usuário inválido: use letras minúsculas, números, ponto ou hífen.")
        return 1
    tudo = {"c": True, "r": True, "u": True, "d": True}
    id_doc = quote(usuario, safe="-_.!~*'()")
    atual, _ = auth_ler_cadastro(usuario)
    cad = dict(atual or {}, v=1, email=usuario, name=(atual or {}).get("name") or nome or usuario, preset="admin", active=True,
               perms={m: dict(tudo) for m in AUTH_MODULOS}, createdBy=(atual or {}).get("createdBy") or "servidor")
    estado_gravar({"docs": [{"col": "usuarios", "id": id_doc, "valor": cad}]})
    print("Administrador %s. Senha provisória, troque na primeira entrada: %s" % (usuario, auth_criar(usuario, "servidor")))
    return 0


# ---------- Postos pareados ----------
# O Admin pareia cada aparelho uma vez (Painel de controle, ou o link de uso único do comando --parear-posto). O aparelho guarda
# o cookie eterna_posto (HttpOnly, 400 dias, revogável); o servidor guarda só o hash. O posto abre o Checkout sem pessoa logada.
POSTO_COOKIE = "eterna_posto"
POSTO_IDADE = 400 * 86400
POSTO_CONVITE_S = 600
posto_uso = {}                       # id -> última gravação de ultimo_uso (no máximo uma por minuto)
POSTO_REPETIDO_S = 15
posto_recentes = {}                  # (pessoa, hash do login, nome) -> (hora, token, posto) dos últimos pareamentos, contra clique repetido
posto_par_lock = threading.Lock()
POSTO_AUTO_IDADE = 30 * 86400        # posto automático: cai depois de 30 dias sem uso; cada uso renova (revisão do Eduardo, 10/11)
POSTO_AUTO_DIA = 3                   # no máximo 3 postos automáticos por pessoa e IP em 24 h
posto_auto_feitos = {}               # (pessoa, ip) -> horas das criações nas últimas 24 h


def posto_redes():
    """ETERNA_POSTO_REDE: faixa(s) da rede do ponto, ex.: 192.168.10.0/24 (várias separadas por vírgula). Vazia desliga o posto automático."""
    import ipaddress
    redes = []
    for x in os.environ.get("ETERNA_POSTO_REDE", "").split(","):
        try:
            if x.strip():
                redes.append(ipaddress.ip_network(x.strip(), strict=False))
        except ValueError:
            pass
    return redes


def _sha(t):
    return hashlib.sha256(t.encode()).hexdigest()


def posto_auto_ok(ip, ip_servidor="", redes=None):
    """Aparelho da rede do ponto (ETERNA_POSTO_REDE), que vira posto quando um Admin entra nele. Tailscale/VPN (100.64.0.0/10),
    o próprio servidor e endereços fora da faixa não viram posto: quem acessa de fora (Ronaldo e Eduardo) usa o sistema sem criar posto.
    Atrás de proxy o IP visto é o do proxy: não ligar o automático lá sem tratar X-Forwarded-For (só vindo de ETERNA_PROXY_IP)."""
    import ipaddress
    redes = posto_redes() if redes is None else redes
    if not redes:
        return False
    try:
        a = ipaddress.ip_address(str(ip).split("%")[0])
        if a.version == 6 and a.ipv4_mapped:
            a = a.ipv4_mapped
    except ValueError:
        return False
    if a.is_loopback or str(a) == str(ip_servidor) or a in ipaddress.ip_network("100.64.0.0/10"):
        return False
    return a.is_private and any(a in r for r in redes)


def posto_auto_cota(usuario, ip):
    """True e conta mais um, se esta pessoa ainda pode criar posto automático deste IP hoje."""
    agora = time.time()
    k = (usuario, str(ip))
    feitos = [t for t in posto_auto_feitos.get(k, []) if agora - t < 86400]
    if len(feitos) >= POSTO_AUTO_DIA:
        posto_auto_feitos[k] = feitos
        return False
    posto_auto_feitos[k] = feitos + [agora]
    return True


def posto_nome_ok(nome):
    n = re.sub(r"[<>\"'`&\x00-\x1f]", "", str(nome or "")).strip()[:40]
    return n or None


def posto_criar(nome, por="", ip="", aparelho=""):
    """-> (token, {id, nome, num}). O token sai só aqui, para o cookie deste aparelho.
    Posto automático: por = "auto:<pessoa>" e aparelho = User-Agent, gravados na auditoria para o Admin reconhecer o aparelho."""
    token, pid = secrets.token_urlsafe(32), "p_" + secrets.token_hex(4)
    with estado_lock:
        db = auth_db()
        try:
            num = (db.execute("select coalesce(max(num), 0) from posto").fetchone()[0] or 0) + 1
            nome = nome or "Posto %d" % num     # posto automático: nome pelo número
            db.execute("insert into posto values (?, ?, ?, ?, ?, ?, ?, ?, ?)", (pid, nome, num, _sha(token), por, time.time(), None, ip, None))
            auth_log(db, "posto:" + pid, ("posto_auto " + re.sub(r"[\x00-\x1f]", "", str(aparelho))[:200]).strip() if aparelho else "posto_pareado", por, ip)
            db.commit()
        finally:
            db.close()
    return token, {"id": pid, "nome": nome, "num": num}


def posto_quem(token, ip=""):
    """O posto deste cookie, se não foi revogado; senão None."""
    if not token or len(token) > 100:
        return None
    with estado_lock:
        db = auth_db()
        try:
            r = db.execute("select id, nome, num, criado_por, ultimo_uso, criado_em from posto where hash=? and revogado_em is null", (_sha(token),)).fetchone()
            if r and str(r[3] or "").startswith("auto:") and time.time() - (r[4] or r[5] or 0) > POSTO_AUTO_IDADE:
                r = None                     # posto automático parado há mais de 30 dias: não vale mais
            if r and time.time() - posto_uso.get(r[0], 0) > 60:
                posto_uso[r[0]] = time.time()
                db.execute("update posto set ultimo_uso=?, ip_ultimo=? where id=?", (time.time(), ip, r[0]))
                db.commit()
        finally:
            db.close()
    return {"id": r[0], "nome": r[1], "num": r[2], "auto": str(r[3] or "").startswith("auto:")} if r else None


def posto_lista():
    with estado_lock:
        db = auth_db()
        try:
            cols = ("id", "nome", "num", "criado_por", "criado_em", "ultimo_uso", "ip_ultimo", "revogado_em")
            return [dict(zip(cols, r)) for r in db.execute("select %s from posto order by num" % ", ".join(cols))]
        finally:
            db.close()


def posto_revogar(pid, por="", ip=""):
    with estado_lock:
        db = auth_db()
        try:
            n = db.execute("update posto set revogado_em=? where id=? and revogado_em is null", (time.time(), str(pid))).rowcount
            if n:
                auth_log(db, "posto:" + str(pid), "posto_revogado", por, ip)
            db.commit()
        finally:
            db.close()
    # Limpeza de cortesia: quem garante que o pareamento repetido não devolve posto revogado é o posto_ativo em postos_post.
    with posto_par_lock:
        for k in [k for k, v in posto_recentes.items() if v[2]["id"] == str(pid)]:
            posto_recentes.pop(k, None)
    return bool(n)


def posto_ativo(pid):
    """True se o posto existe e não foi revogado."""
    with estado_lock:
        db = auth_db()
        try:
            return bool(db.execute("select 1 from posto where id=? and revogado_em is null", (str(pid),)).fetchone())
        finally:
            db.close()


def posto_convite_novo(nome):
    codigo = secrets.token_urlsafe(18)
    with estado_lock:
        db = auth_db()
        try:
            db.execute("delete from posto_convite where expira < ?", (time.time() - 86400,))
            db.execute("insert into posto_convite values (?, ?, ?, ?)", (_sha(codigo), nome, time.time() + POSTO_CONVITE_S, None))
            db.commit()
        finally:
            db.close()
    return codigo


def posto_convite_ver(codigo):
    """O nome do posto do convite, se ainda vale, sem gastar o código."""
    if not codigo or len(codigo) > 100:
        return None
    with estado_lock:
        db = auth_db()
        try:
            r = db.execute("select nome from posto_convite where hash=? and usado is null and expira >= ?", (_sha(codigo), time.time())).fetchone()
        finally:
            db.close()
    return r[0] if r else None


def posto_convite_usar(codigo):
    """O nome do posto do convite, uma única vez e dentro de 10 min; senão None."""
    if not codigo or len(codigo) > 100:
        return None
    with estado_lock:
        db = auth_db()
        try:
            r = db.execute("select nome, expira from posto_convite where hash=? and usado is null", (_sha(codigo),)).fetchone()
            if not r or r[1] < time.time():
                return None
            db.execute("update posto_convite set usado=? where hash=?", (time.time(), _sha(codigo)))
            db.commit()
        finally:
            db.close()
    return r[0]


def posto_parear_cli(nome):
    """python eterna-agente.py --parear-posto "<nome>": link de uso único (10 min) para parear um aparelho sem entrar no app."""
    n = posto_nome_ok(nome)
    if not n:
        print("Nome do posto inválido.")
        return 1
    codigo = posto_convite_novo(n)
    print("Abra no aparelho \"%s\" em até 10 minutos (vale uma vez), trocando 127.0.0.1 pelo endereço do servidor na rede se for outro aparelho:" % n)
    print("  http://127.0.0.1:%d/postos/aceitar?c=%s" % (PORT, codigo))
    return 0


def estado_revs():
    with estado_lock:
        db = estado_db()
        try:
            return {r[0]: r[1] for r in db.execute("select col, max(rev) from doc group by col")}
        finally:
            db.close()


def estado_col(col):
    with estado_lock:
        db = estado_db()
        try:
            rev = db.execute("select max(rev) from doc where col = ?", (col,)).fetchone()[0] or 0
            docs = [{"id": r[0], "valor": json.loads(r[1])} for r in db.execute("select id, valor from doc where col = ? and valor is not null", (col,))]
        finally:
            db.close()
    return {"ok": True, "rev": rev, "docs": docs}


def estado_gravar(body, quem=""):
    docs = body.get("docs") if isinstance(body.get("docs"), list) else []
    auditoria = []
    ag_datas = []                        # v97: dias da agenda que mudaram (série diária)
    with estado_lock:
        db = estado_db()
        try:
            rev = db.execute("select coalesce(max(rev), 0) from doc").fetchone()[0]
            n = 0
            for d in docs[:500]:
                if not isinstance(d, dict) or d.get("col") not in ESTADO_COLS or not isinstance(d.get("id"), str) or not 0 < len(d["id"]) <= 300:
                    continue
                v = d.get("valor")
                if d["col"] == "agenda" and v is not None:      # v92: calendário de eventos, campos fechados (risco 4)
                    v = agenda_valida(d["id"], v)
                    if v is None:
                        continue
                    novo = db.execute("select 1 from doc where col = 'agenda' and id = ? and valor is not null", (d["id"],)).fetchone() is None
                    if novo and db.execute("select count(*) from doc where col = 'agenda' and valor is not null").fetchone()[0] >= AGENDA_DOCS_MAX:
                        continue                                # teto da agenda (revisão)
                if d["col"] == "config" and d["id"] == "visitas":   # B1: o interruptor só muda pela rota /visitas/config
                    print("  config/visitas recusada pela sincronização (só POST /visitas/config) · de %s" % (quem or "?"))
                    continue
                if d["col"] == "config" and d["id"] == "ia":    # v93 (segurança): regra dos cliques de IA, só o formato conhecido
                    if v is None:                               # apagar religaria a regra pelo padrão: recusado (desliga pelo Painel)
                        print("  config/ia: apagar recusado · de %s" % (quem or "?"))
                        continue
                    if v is not None:
                        ok_ = ia_valida(v)
                        if ok_ is None:
                            print("  config/ia recusada (formato inválido) · de %s" % (quem or "?"))
                            continue
                        v = {**ok_, "por": str(v.get("por") or "")[:120] or None, "em": str(v.get("em") or "")[:40] or None}
                    r_ = db.execute("select valor from doc where col = 'config' and id = 'ia'").fetchone()
                    auditoria.append((r_[0] if r_ else None, v))
                txt = None if v is None else json.dumps(v, ensure_ascii=False)
                if txt is not None and len(txt) > ESTADO_MAX:
                    continue
                if d["col"] == "agenda":                        # v97: o dia de antes e o de depois da mudança
                    r_ = db.execute("select valor from doc where col = 'agenda' and id = ?", (d["id"],)).fetchone()
                    try:
                        velho = json.loads(r_[0]) if r_ and r_[0] else None
                    except ValueError:
                        velho = None
                    for x in (velho, v):
                        if isinstance(x, dict) and isinstance(x.get("data"), str):
                            ag_datas.append(x["data"])
                rev += 1
                db.execute("insert into doc values (?,?,?,?,?) on conflict(col, id) do update set valor = excluded.valor, rev = excluded.rev, em = excluded.em",
                           (d["col"], d["id"], txt, rev, _iso()))
                n += 1
            db.commit()
        finally:
            db.close()
    if any(isinstance(d, dict) and d.get("col") == "config" for d in docs[:500]):
        _busca_cfg["t"] = 0.0            # janela da selfie mudada no Painel vale na próxima busca
        _ia_cfg["t"] = 0.0               # v93: regra dos cliques de IA vale na próxima sessão que fechar
    if ag_datas:
        dia_marcar(ag_datas)
    for de_, para in auditoria:          # v93 (segurança): quem mudou a regra dos cliques de IA, no console
        try:
            de_ = ia_valida(json.loads(de_)) if de_ else None
        except Exception:
            de_ = None
        print("  config/ia: de %s para %s · por %s · host %s" % (json.dumps(de_), json.dumps(ia_valida(para) if para else None),
                                                               (para or {}).get("por") or "?", quem or "?"))
    return {"ok": True, "gravados": n, "rev": rev}


# ---------- Vendas dos postos e métricas do dia (v90) ----------
# A venda mora no SERVIDOR, num banco (SQLite, ~/Eterna/ponto/vendas.db, tabela evento com idem único), não no navegador:
# cada caixa manda o evento da venda (criar, pagar, cancelar, impressao, rolo; contrato no plano v83, seção G) por
# POST /ponto/eventos na hora em que acontece; o navegador só segura o que o servidor ainda não confirmou (sem rede).
# Daqui sai o resumo do dia em ~/Eterna/ponto/metricas/AAAA-MM-DD.json, refeito a cada 10 min para hoje e ontem e NUNCA
# apagado: os rostos e as fotos saem por prazo (LGPD), os números ficam. GET /metricas/dia?de=AAAA-MM-DD&ate=AAAA-MM-DD.
VENDAS_DB = os.path.join(HOME, "ponto", "vendas.db")
MET_DIR = os.path.join(HOME, "ponto", "metricas")
EV_TIPOS = ("criar", "pagar", "cancelar", "impressao", "rolo")   # "fila" só o próprio servidor grava (ev_fila)
_re_ev_id = re.compile(r"^[A-Za-z0-9][A-Za-z0-9:_-]{2,80}$")
ev_lock = threading.Lock()


def vendas_db():
    os.makedirs(os.path.dirname(VENDAS_DB), exist_ok=True)
    c = sqlite3.connect(VENDAS_DB, timeout=30, check_same_thread=False)
    c.execute("pragma journal_mode=wal")
    c.execute("pragma synchronous=full")                # venda gravada é venda que sobrevive a queda de energia
    c.execute("create table if not exists evento (idem text primary key, venda text, seq int, tipo text, em text, dia text,"
              " posto text, por text, dados text, recebido text)")
    c.execute("create index if not exists evento_dia on evento(dia)")
    c.execute("create index if not exists evento_venda on evento(venda)")
    # BI: uma linha por venda com os tempos (início do Checkout, escolha, pedido, pagamento, fila e saída da impressão)
    c.execute("create view if not exists venda_tempos as select venda, max(case when tipo = 'criar' then json_extract(dados, '$.saleNo') end) as numero,"
              " max(posto) as posto, max(case when tipo = 'criar' then json_extract(dados, '$.vendedor') end) as vendedor,"
              " max(case when tipo = 'criar' then json_extract(dados, '$.tempos.inicio') end) as inicio_checkout,"
              " max(case when tipo = 'criar' then json_extract(dados, '$.tempos.escolha') end) as escolha_fotos,"
              " max(case when tipo = 'criar' then em end) as pedido, max(case when tipo = 'pagar' then em end) as pagamento,"
              " min(case when tipo = 'fila' then json_extract(dados, '$.entrou') end) as entrou_na_fila,"
              " min(case when tipo = 'fila' then json_extract(dados, '$.comecou') end) as comecou_impressao,"
              " max(case when tipo = 'fila' then json_extract(dados, '$.terminou') end) as terminou_impressao,"
              " max(case when tipo = 'impressao' and json_extract(dados, '$.resultado') = 'ok' then em end) as saiu_certo"
              " from evento group by venda")
    # BI: resumo por dia. Hoje conta pagamento, fotos que saíram na fila e os tempos em segundos
    c.execute("create view if not exists venda_dia as select c.dia as dia, count(*) as pedidos, sum(t.pagamento is not null) as pagas,"
              " sum(t.pagamento is not null and json_extract(c.dados, '$.meio') = 'cartao') as cartao,"
              " sum(t.pagamento is not null and json_extract(c.dados, '$.meio') = 'pix') as pix,"
              " sum(t.pagamento is not null and json_extract(c.dados, '$.meio') = 'dinheiro') as dinheiro,"
              " sum(case when t.pagamento is not null then json_extract(c.dados, '$.total') end) as receita,"
              " sum((select coalesce(sum(json_extract(f.dados, '$.feitas')), 0) from evento f where f.venda = c.venda and f.tipo = 'fila')) as fotos_impressas,"
              " avg((julianday(t.escolha_fotos) - julianday(t.inicio_checkout)) * 86400) as seg_escolha,"
              " avg((julianday(t.pagamento) - julianday(t.pedido)) * 86400) as seg_aguardando_pagamento,"
              " avg((julianday(t.pagamento) - julianday(t.inicio_checkout)) * 86400) as seg_checkout,"
              " avg((julianday(t.terminou_impressao) - julianday(t.entrou_na_fila)) * 86400) as seg_impressao"
              " from evento c join venda_tempos t on t.venda = c.venda where c.tipo = 'criar' group by c.dia")
    # BI: cada selfie do Checkout. Só contagem e horário: nunca imagem, vetor do rosto, sessão ou venda (não identifica ninguém)
    c.execute("create table if not exists selfie (em text, dia text, hora int, origem text, resultado text, fotos int, ms int)")
    c.execute("create index if not exists selfie_dia_i on selfie(dia)")
    c.execute("create view if not exists selfie_dia as select dia, origem, count(*) as selfies, sum(resultado = 'achou') as achou,"
              " sum(resultado = 'nao_achou') as nao_achou, sum(resultado = 'sem_rosto') as sem_rosto, sum(resultado = 'varias_pessoas') as varias_pessoas,"
              " sum(resultado = 'erro') as erro, avg(ms) as ms_medio from selfie group by dia, origem")
    c.execute("create view if not exists selfie_hora as select dia, hora, count(*) as selfies, sum(resultado = 'achou') as achou from selfie group by dia, hora")
    return c


def selfie_registra(origem, r, t0):
    """Conta uma selfie para o BI. Falha aqui nunca atrapalha a busca do cliente."""
    try:
        r = r or {}
        res = "erro" if r.get("error") else "varias_pessoas" if r.get("varias") else "sem_rosto" if not r.get("rosto") else "achou" if r.get("fotos") else "nao_achou"
        agora = time.time()
        with ev_lock:
            db = vendas_db()
            try:
                db.execute("insert into selfie values (?, ?, ?, ?, ?, ?, ?)", (time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(agora)), _ff_hoje(agora),
                           time.localtime(agora).tm_hour, origem, res, len(r.get("fotos") or []), int((agora - t0) * 1000)))
                db.commit()
            finally:
                db.close()
    except Exception as ex:
        print("  selfie: não registrou:", str(ex)[:120])


def _ev_dia(em):
    try:
        from datetime import datetime
        return _ff_hoje(datetime.fromisoformat(str(em).replace("Z", "+00:00")).timestamp())
    except Exception:
        return _ff_hoje()


def _ev_ler(dia):
    """Eventos das vendas que têm algum evento no dia (a venda inteira, mesmo o pagar que caiu depois da meia-noite)."""
    with ev_lock:
        db = vendas_db()
        try:
            rs = db.execute("select idem, venda, seq, tipo, em, posto, por, dados from evento where venda in"
                            " (select venda from evento where dia = ?) order by venda, seq", (dia,)).fetchall()
        finally:
            db.close()
    return [{"idem": r[0], "venda": r[1], "seq": r[2], "tipo": r[3], "em": r[4], "posto": r[5], "por": r[6],
             "dados": json.loads(r[7] or "{}")} for r in rs]


EV_LANGS = ("pt", "en", "es", "fr", "de")
EV_CANAIS = ("checkout", "balcao")
EV_CART_MAX = 30
_re_cart_id = re.compile(r"^[a-z0-9_-]{1,20}$")


CHAVES_PROIBIDAS = ("__proto__", "constructor", "prototype")   # nunca viram nome de linha (o app monta objetos com elas)


def _txt_chave(v, n):
    """Texto que vira chave de objeto no resumo (posto, por): sem < >, e nunca __proto__/constructor/prototype."""
    if v is None:
        return None
    x = re.sub(r"[<>\x00-\x1f]", "", str(v)).strip()[:n]
    return None if x in CHAVES_PROIBIDAS else x


def _ev_cart(v):
    """v92: itens do carrinho {id, v}; lista com mais de 30 itens ou item inválido descarta o carrinho inteiro."""
    if not isinstance(v, list) or not v or len(v) > EV_CART_MAX:
        return None
    out = []
    for it in v:
        if not isinstance(it, dict) or not isinstance(it.get("id"), str) or not _re_cart_id.match(it["id"]) or it["id"] in CHAVES_PROIBIDAS:
            return None
        x = it.get("v")
        if isinstance(x, bool) or not isinstance(x, (int, float)) or not 0 <= x <= 1e6:
            return None
        out.append({"id": it["id"], "v": float(x)})
    return out


def _ev_t0(v, em):
    """v92: hora em que o cliente saiu da tela inicial do Checkout; vale só entre em − 2 h e em."""
    if not isinstance(v, str) or len(v) > 30:
        return None
    t, e = _epoch(v), _epoch(em)
    if not t or not e or not e - 7200 <= t <= e:
        return None
    return v


def _ev_dnp(v):
    """Leitura do firmware da DNP (eterna-impressao.ps1): contadores inteiros, status e de onde veio. Outro formato: descarta."""
    if not isinstance(v, dict):
        return None
    i = lambda k: int(v[k]) if isinstance(v.get(k), (int, float)) and not isinstance(v.get(k), bool) and 0 <= v[k] <= 10 ** 7 else None
    o = {k: i(k) for k in ("mqty", "antes", "saiu", "restantes", "vida", "vida_antes", "status")}
    o["conferido"] = v.get("conferido") is True
    o["texto"] = re.sub(r"[<>]", "", str(v.get("texto") or ""))[:40] or None
    o["origem"] = v.get("origem") if v.get("origem") in ("impressao", "leitura", "troca") else None
    o = {k: x for k, x in o.items() if x is not None and x is not False}
    return o if ("mqty" in o or "vida" in o) else None


def _ev_limpo(e):
    """Só os campos do contrato, com tipo e tamanho conferidos (o resto do evento é descartado)."""
    if not isinstance(e, dict) or e.get("tipo") not in EV_TIPOS:
        return None
    if not all(isinstance(e.get(k), str) and _re_ev_id.match(e[k]) for k in ("idem", "venda")):
        return None
    d = e.get("dados") if isinstance(e.get("dados"), dict) else {}
    num = lambda v: float(v) if isinstance(v, (int, float)) and 0 <= v <= 1e6 else 0
    txt = lambda v, n=60: re.sub(r"[<>]", "", str(v))[:n] if v is not None else None
    lista = lambda v: [str(x)[:60] for x in v[:200]] if isinstance(v, list) else []
    dd = {"saleNo": txt(d.get("saleNo"), 20), "card": txt(d.get("card"), 20), "meio": txt(d.get("meio"), 12), "prov": txt(d.get("prov"), 20),
          "total": num(d.get("total")), "prints": num(d.get("prints")), "nPh": num(d.get("nPh")), "nAI": num(d.get("nAI")),
          "selected": lista(d.get("selected")), "aiSel": lista(d.get("aiSel")),
          # v91 parte B: a venda achada pela selfie pode juntar várias sessões do dia (card = a sessão onde a venda fica)
          "sessoes": [x for x in lista(d.get("sessoes"))[:20] if re.match(r"^[A-Z0-9]{4,20}$", x)],
          "vendedor": txt((d.get("vendedor") or {}).get("nome") if isinstance(d.get("vendedor"), dict) else None),
          "resultado": txt(d.get("resultado"), 12), "n": num(d.get("n")), "reimpressao": bool(d.get("reimpressao")),
          "tempos": {k: txt(v, 30) for k, v in (d.get("tempos") if isinstance(d.get("tempos"), dict) else {}).items() if k in ("inicio", "escolha") and v} or None,
          "motivo": txt(d.get("motivo"), 40), "semFoto": num(d.get("semFoto")), "ref": txt(d.get("ref"), 12), "capacidade": num(d.get("capacidade")),
          # impressão: as fotos impressas; impressão e rolo: a leitura da DNP pelo programa de impressão do posto (auditoria do rolo)
          "fotos": lista(d.get("fotos")) if e.get("tipo") == "impressao" else [], "dnp": _ev_dnp(d.get("dnp")),
          "galeria": (txt((d.get("galeria") or {}).get("codigo"), 12) if isinstance(d.get("galeria"), dict) else None)}
    # v92 (estatísticas): produtos, idioma, canal e a hora em que o cliente começou no Checkout. Campo inválido sai; a venda fica.
    em = txt(e.get("em"), 30) or _iso()
    dd.update(cart=_ev_cart(d.get("cart")), lang=d.get("lang") if d.get("lang") in EV_LANGS else None,
              canal=d.get("canal") if d.get("canal") in EV_CANAIS else None, t0=_ev_t0(d.get("t0"), em))
    if dd.get("vendedor") in CHAVES_PROIBIDAS:
        dd["vendedor"] = None
    return {"idem": e["idem"], "venda": e["venda"], "seq": int(num(e.get("seq"))), "tipo": e["tipo"], "em": em,
            "por": _txt_chave((e.get("por") or {}).get("nome") if isinstance(e.get("por"), dict) else None, 60),
            "posto": _txt_chave(e.get("posto"), 40), "dados": {k: v for k, v in dd.items() if v not in (None, "", [], 0, False)}}


def ev_impressoes(ids):
    """Histórico de impressão das vendas pedidas, direto do banco (eventos "impressao"): o que a tela do Posto mostra
    (impressa, por quem, reimpressões, "não saiu") vem daqui, não do navegador. Até 100 vendas por pedido."""
    ids = [x for x in ids if isinstance(x, str) and _re_ev_id.match(x)][:100]
    out = {v: [] for v in ids}
    if not ids:
        return out
    with ev_lock:
        db = vendas_db()
        try:
            rows = db.execute("select idem, venda, em, posto, por, dados from evento where tipo = 'impressao' and venda in (%s) order by em, seq"
                              % ",".join("?" * len(ids)), ids).fetchall()
        finally:
            db.close()
    for idem, venda, em, posto, por, dados in rows:
        try:
            d = json.loads(dados or "{}")
        except Exception:
            d = {}
        out[venda].append({"idem": idem, "em": em, "posto": posto, "por": por, "resultado": d.get("resultado"), "n": int(d.get("n") or 0),
                           "reimpressao": bool(d.get("reimpressao")), "motivo": d.get("motivo"), "fotos": d.get("fotos") or [],
                           "semFoto": int(d.get("semFoto") or 0), "dnp": d.get("dnp")})
    return out


def ev_fila(job):
    """Pedido terminado na fila: grava os tempos na venda (evento "fila"), para o BI."""
    vid = job.get("venda_id") or ""
    if not _re_ev_id.match(vid):
        return
    em = _iso(job.get("fim"))
    dados = {"pedido": job["id"], "estado": job["estado"], "fotos": job["fotos"], "feitas": job["feitas"], "entrou": _iso(job["criado"]),
             "comecou": _iso(job["inicio"]) if job.get("inicio") else None, "terminou": em, "impressora": job.get("impressora")}
    with ev_lock:
        db = vendas_db()
        try:
            db.execute("insert or ignore into evento values (?,?,?,?,?,?,?,?,?,?)", ("%s:fila:%d" % (vid, job["id"]), vid, 100000 + job["id"], "fila", em, _ev_dia(em),
                                                                                       job.get("posto") or "", job.get("vendedor") or None, json.dumps(dados, ensure_ascii=False), _iso()))
            db.commit()
        finally:
            db.close()


def ev_receber(body):
    evs = body.get("eventos") if isinstance(body.get("eventos"), list) else []
    posto = _txt_chave(body.get("posto") or "", 40) or ""
    res = []
    # v93 (segurança): navegador antigo pode vender a base de IA como foto. A venda já foi paga e fica; o evento ganha
    # "ia_vendidas" e uma linha no console (sess_lock antes do ev_lock, nunca junto)
    sel = set()
    for e in evs[:50]:
        d = e.get("dados") if isinstance(e, dict) and isinstance(e.get("dados"), dict) else {}
        if isinstance(d.get("selected"), list):
            sel.update(pid_lib(str(p)[:60]) for p in d["selected"][:200])
    ia_sel = sess_ia_de(sel) if sel else set()
    with ev_lock:
        db = vendas_db()
        try:
            for e in evs[:50]:
                x = _ev_limpo(e)
                if not x:
                    res.append({"idem": (e or {}).get("idem") if isinstance(e, dict) else None, "s": "recusado"})
                    continue
                vi = [p for p in x["dados"].get("selected") or [] if pid_lib(p) in ia_sel]
                if vi:
                    x["dados"]["ia_vendidas"] = vi
                    print("  venda %s: %d base(s) de IA vendida(s) como foto (navegador antigo)" % (x["venda"], len(vi)))
                cur = db.execute("insert or ignore into evento values (?,?,?,?,?,?,?,?,?,?)",
                                 (x["idem"], x["venda"], x["seq"], x["tipo"], x["em"], _ev_dia(x["em"]), x["posto"] or posto,
                                  x["por"], json.dumps(x["dados"], ensure_ascii=False), _iso()))
                res.append({"idem": x["idem"], "s": "ok" if cur.rowcount else "ja"})
            db.commit()                                      # só confirma ao caixa depois de gravado no disco
        finally:
            db.close()
    return {"ok": True, "resultados": res}


def metricas_dia(dia):
    """Resumo do dia a partir do que o servidor tem: fotos e rostos (rostos.db), sessões (ponto/sessoes), vendas dos postos
    (ponto/eventos) e vendas online (galerias/vendas-online.jsonl). Por fotógrafo, vendedor, posto e meio de pagamento."""
    m = {"dia": dia, "gerado": _iso(), "fotos": 0, "fotos_com_rosto": 0, "rostos": 0, "sessoes": 0, "sessoes_com_venda": 0,
         "vendas": 0, "faturamento": 0.0, "fotos_vendidas": 0, "fotos_ia_vendidas": 0, "impressoes": 0, "impressoes_falhas": 0,
         "canceladas": 0, "online": {"vendas": 0, "faturamento": 0.0, "fotos": 0}, "rolo": {},
         "por_fotografo": {}, "por_vendedor": {}, "por_posto": {}, "por_meio": {}}
    try:
        db = rostos_db()
        r = db.execute("select count(*), sum(n > 0), sum(n) from foto where dia = ?", (dia,)).fetchone()
        m["fotos"], m["fotos_com_rosto"], m["rostos"] = int(r[0] or 0), int(r[1] or 0), int(r[2] or 0)
        db.close()
    except Exception:
        pass
    quem = {}
    ss_dia = lambda d: (json.load(open(os.path.join(SESS_DIR, d + ".json"), encoding="utf8")).get("sessoes") or []) if os.path.exists(os.path.join(SESS_DIR, d + ".json")) else []
    try:
        ontem = _ff_hoje(time.mktime(time.strptime(dia, "%Y-%m-%d")) - 43200)
        for x in ss_dia(ontem):                      # venda hoje de sessão de ontem: conta para o fotógrafo, não como sessão de hoje
            if isinstance(x, dict) and x.get("card"):
                quem[x["card"]] = str(x.get("fotografo") or "sem fotógrafo")
        ss = ss_dia(dia)
    except Exception:
        ss = []
    for x in ss:
        if not isinstance(x, dict) or x.get("removida"):
            continue
        f = str(x.get("fotografo") or "sem fotógrafo")
        quem[x.get("card")] = f
        pf = m["por_fotografo"].setdefault(f, {"fotos": 0, "sessoes": 0, "sessoes_com_venda": 0, "vendas": 0, "faturamento": 0.0, "fotos_vendidas": 0})
        pf["sessoes"] += 1
        pf["fotos"] += len(x.get("fotos") or []) + len(x.get("pend") or [])   # v91: a sessão aberta tem fotos esperando o rosto
        m["sessoes"] += 1
    if not m["fotos"]:
        m["fotos"] = sum(v["fotos"] for v in m["por_fotografo"].values())
    vendas = {}
    evs = _ev_ler(dia)
    for e in evs:
        v = vendas.setdefault(e["venda"], {"criar": None, "paga": False, "cancelada": False, "posto": e.get("posto")})
        d = e.get("dados") or {}
        if e["tipo"] == "criar":
            v["criar"] = d
        elif e["tipo"] == "pagar":
            v["paga"] = True
        elif e["tipo"] == "cancelar":
            v["cancelada"] = True
        elif e["tipo"] == "impressao":
            if d.get("resultado") == "ok":
                m["impressoes"] += int(d.get("n") or 0)
            else:
                m["impressoes_falhas"] += int(d.get("n") or 0)
        # auditoria do rolo por posto: o contador de vida da DNP (folhas que a impressora cortou) contra as fotos que o Eterna
        # registrou como impressas. folhas_dnp - folhas_eterna > 0 = folha saída sem registro (fora do Eterna, erro, teste)
        if e["tipo"] in ("impressao", "rolo") and isinstance(d.get("dnp"), dict):
            dn = d["dnp"]
            r = m["rolo"].setdefault(e.get("posto") or "sem posto", {"vida_ini": None, "vida_fim": None, "folhas_dnp": 0, "folhas_eterna": 0,
                                                                       "reimpressoes": 0, "trocas": 0, "restantes": None, "leituras": 0})
            r["leituras"] += 1
            # o contador de vida só cresce: menor e maior do dia, sem depender da ordem dos eventos
            for x in (dn.get("vida_antes"), dn.get("vida")):
                if x is not None:
                    r["vida_ini"] = x if r["vida_ini"] is None else min(r["vida_ini"], x)
                    r["vida_fim"] = x if r["vida_fim"] is None else max(r["vida_fim"], x)
            if dn.get("restantes") is not None and (dn.get("vida") or 0) >= r.get("_vr", -1):
                r["restantes"], r["_vr"] = dn["restantes"], dn.get("vida") or 0
            if dn.get("origem") == "troca":
                r["trocas"] += 1
            if e["tipo"] == "impressao" and d.get("resultado") == "ok":
                r["folhas_eterna"] += int(d.get("n") or 0)
                if d.get("reimpressao"):
                    r["reimpressoes"] += int(d.get("n") or 0)
    for r in m["rolo"].values():
        if r["vida_ini"] is not None and r["vida_fim"] is not None:
            r["folhas_dnp"] = max(0, r["vida_fim"] - r["vida_ini"])
        r["diferenca"] = r["folhas_dnp"] - r["folhas_eterna"]
        r.pop("_vr", None)
    com_venda = set()
    for v in vendas.values():
        c = v["criar"]
        if not c:
            continue
        if v["cancelada"] and not v["paga"]:
            m["canceladas"] += 1
            continue
        if not v["paga"]:
            continue
        tot, nph, nai = float(c.get("total") or 0), int(c.get("nPh") or 0), int(c.get("nAI") or 0)
        m["vendas"] += 1
        m["faturamento"] += tot
        m["fotos_vendidas"] += nph
        m["fotos_ia_vendidas"] += nai
        card = c.get("card")
        if card:
            com_venda.add(card)
        com_venda.update(c.get("sessoes") or [])     # v91: as outras sessões juntadas pela selfie também converteram
        for chave, nome in (("por_vendedor", c.get("vendedor") or "sem vendedor"), ("por_posto", v.get("posto") or "sem posto"), ("por_meio", c.get("meio") or "?")):
            g = m[chave].setdefault(nome, {"vendas": 0, "faturamento": 0.0, "fotos_vendidas": 0})
            g["vendas"] += 1
            g["faturamento"] += tot
            g["fotos_vendidas"] += nph
        f = quem.get(card)
        if f:
            pf = m["por_fotografo"].setdefault(f, {"fotos": 0, "sessoes": 0, "sessoes_com_venda": 0, "vendas": 0, "faturamento": 0.0, "fotos_vendidas": 0})
            pf["vendas"] += 1
            pf["faturamento"] += tot
            pf["fotos_vendidas"] += nph
    do_dia = {x.get("card") for x in ss if isinstance(x, dict) and not x.get("removida")}
    m["sessoes_com_venda"] = len(com_venda & do_dia)
    for card in com_venda & do_dia:
        m["por_fotografo"][quem[card]]["sessoes_com_venda"] += 1
    for v in vendas_ler():
        if v.get("em") and _ev_dia(v["em"]) == dia and not v.get("teste"):
            m["online"]["vendas"] += 1
            m["online"]["faturamento"] += float(v.get("total") or 0)
            m["online"]["fotos"] += int(v.get("n") or 0)
    m["conversao_sessoes"] = round(m["sessoes_com_venda"] / m["sessoes"], 4) if m["sessoes"] else None
    m["conversao_fotos"] = round(m["fotos_vendidas"] / m["fotos"], 4) if m["fotos"] else None
    m["ticket_medio"] = round(m["faturamento"] / m["vendas"], 2) if m["vendas"] else None
    for pf in m["por_fotografo"].values():
        pf["conversao"] = round(pf["sessoes_com_venda"] / pf["sessoes"], 4) if pf["sessoes"] else None
    return met_v2_junta(m, met_v2(dia, ss, evs))


# v92 (revisão S1): toda gravação do resumo do dia passa por met_escreve, com um lock por dia (ler, mudar e gravar dentro
# dele) e um arquivo temporário único (mkstemp), para o metricas_loop, a importação de entradas e a migração nunca se
# atropelarem nem apagarem um resumo antigo.
_met_locks = {}
_met_locks_lock = threading.Lock()


def met_lock(dia):
    with _met_locks_lock:
        lk = _met_locks.get(dia)
        if lk is None:
            lk = _met_locks[dia] = threading.RLock()
        return lk


def met_escreve(dia, m):
    import tempfile
    with met_lock(dia):
        os.makedirs(MET_DIR, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix="." + dia + ".", suffix=".tmp", dir=MET_DIR)
        try:
            with os.fdopen(fd, "w", encoding="utf8") as f:
                json.dump(m, f, ensure_ascii=False, indent=1)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, os.path.join(MET_DIR, dia + ".json"))
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise


def metricas_gravar(dia):
    m = metricas_dia(dia)
    met_escreve(dia, m)
    return m


def metricas_loop():
    """Hoje e ontem a cada 10 min (ontem fecha com as vendas que chegaram atrasadas); dias antigos ficam como estão."""
    while True:
        for i in (1, 0):
            try:
                metricas_gravar(_ff_hoje(time.time() - i * 86400))
            except Exception as ex:
                print("  métricas do dia:", str(ex)[:160])
        time.sleep(600)


# Backup na nuvem (o mesmo bucket das fotos, prefixo backup/<computador>/): a cada 2 min, se mudou, uma cópia consistente
# dos bancos de vendas e de estado da equipe (API de backup do SQLite, nunca o arquivo aberto) em backup/<pc>/<banco>.db, e
# uma por dia em backup/<pc>/dia/AAAA-MM-DD/<banco>.db (o histórico; o servidor pode morrer sem perder um dia). Junto, o resumo do dia e as
# sessões de hoje e ontem. Rosto nenhum vai para o backup: só números, códigos e nomes de vendedor e fotógrafo.
backup = {"em": None, "ok": None, "erro": None}


def backup_loop():
    if not NUVEM_BUCKET:
        return
    pc = re.sub(r"[^a-z0-9-]", "", socket.gethostname().lower()) or "servidor"
    ultimo = None
    while True:
        time.sleep(120)
        try:
            bancos = [b for b in (VENDAS_DB, ESTADO_DB, OPERACAO_DB) if os.path.exists(b)]   # v92: entradas da bilheteria
            if not bancos:
                continue
            marca = max(os.path.getmtime(x) for b in bancos for x in (b, b + "-wal") if os.path.exists(x))
            if marca == ultimo:
                continue
            s3 = _s3_cliente()
            hoje = _ff_hoje()
            for banco in bancos:
                tmp = banco + ".backup"
                src, dst = sqlite3.connect(banco, timeout=30), sqlite3.connect(tmp)
                try:
                    src.backup(dst)
                finally:
                    dst.close()
                    src.close()
                corpo = open(tmp, "rb").read()
                os.remove(tmp)
                nome = os.path.basename(banco)
                for chave in ("backup/%s/%s" % (pc, nome), "backup/%s/dia/%s/%s" % (pc, hoje, nome)):
                    s3.put_object(Bucket=NUVEM_BUCKET, Key=chave, Body=corpo, ContentType="application/x-sqlite3",
                                  ContentMD5=base64.b64encode(hashlib.md5(corpo).digest()).decode())
            for d in (_ff_hoje(time.time() - 86400), hoje):
                for pasta, nome in ((MET_DIR, "metricas"), (SESS_DIR, "sessoes")):
                    a = os.path.join(pasta, d + ".json")
                    if os.path.exists(a):
                        s3.put_object(Bucket=NUVEM_BUCKET, Key="backup/%s/%s/%s.json" % (pc, nome, d), Body=open(a, "rb").read(),
                                      ContentType="application/json")
            ultimo = marca
            backup.update(em=_iso(), ok=True, erro=None)
        except Exception as ex:
            backup.update(em=_iso(), ok=False, erro=str(ex)[:160])
            print("  backup na nuvem:", str(ex)[:160])


def metricas_periodo(de, ate):
    out = []
    try:
        t = time.mktime(time.strptime(de, "%Y-%m-%d"))
        fim = time.mktime(time.strptime(ate, "%Y-%m-%d"))
    except Exception:
        return None
    hoje = _ff_hoje()
    while t <= fim and len(out) < 400:
        d = _ff_hoje(t)
        arq = os.path.join(MET_DIR, d + ".json")
        if d == hoje:
            out.append(metricas_gravar(d))
        elif os.path.exists(arq):
            try:
                out.append(json.load(open(arq, encoding="utf8")))
            except Exception:
                pass
        t += 86400
    return out


# ---------- Estatísticas (v92; plano docs/planos/2026-11-05-estatisticas.md) ----------
# O resumo do dia ganha campos novos (v:2) sem mudar os da v1: por hora, produto, canal e idioma, tempos em faixas fixas
# (histograma: mediana e p90 saem das faixas, nunca média de médias) e entradas da bilheteria (bip ou catraca, importadas
# por CSV). Sem presença, faltas ou atrasos (Eduardo, 05/11 noite: isso é do RH). Entradas e importações moram em
# ~/Eterna/ponto/operacao.db (vai para o backup). Só números, chaves de fotógrafo e nomes de vendedor: nada de foto, rosto,
# e-mail, CPF ou número de ingresso.
EST_FAIXAS = (30, 60, 120, 300, 600, 1200)   # limites (s) das faixas 0–30 s, 30–60 s, 1–2, 2–5, 5–10, 10–20 min e > 20 min
OPERACAO_DB = os.path.join(HOME, "ponto", "operacao.db")
op_lock = threading.Lock()
ENTRADAS_MAX = 50000
ENTRADAS_ORIGENS = ("bip", "catraca")
est_migra = {"estado": "parado", "feitos": 0, "total": 0, "erro": None}


def h_novo():
    return {"n": 0, "soma": 0.0, "f": [0] * (len(EST_FAIXAS) + 1)}


def h_add(h, s):
    """Uma medida (segundos) na faixa certa; negativa ou acima de 1 dia é descartada (relógio errado)."""
    try:
        s = float(s)
    except (TypeError, ValueError):
        return
    if s != s or s < 0 or s > 86400:
        return
    i = next((k for k, lim in enumerate(EST_FAIXAS) if s < lim), len(EST_FAIXAS))
    h["n"] += 1
    h["soma"] = round(h["soma"] + s, 1)
    h["f"][i] += 1


def _hora_local(ts):
    return time.strftime("%H", time.localtime(ts))


def met_v2(dia, ss, evs):
    """Campos v2 do resumo do dia. ss = sessões do arquivo do dia (None se o arquivo não existe mais); evs = eventos de
    _ev_ler(dia). As vendas entram pela mesma regra da v1 (paga = tem "pagar"), para as somas baterem."""
    tempos = {k: h_novo() for k in ("cliente_s", "pagamento_s", "clique_checkout_s", "transferencia_s")}
    out = {"v": 2, "por_hora": {}, "por_produto": {}, "por_canal": {}, "por_idioma": {}, "tempos": tempos,
           "por_confirmador": {}, "por_fotografo": {}}
    ph = lambda h: out["por_hora"].setdefault(h, {"vendas": 0, "faturamento": 0.0, "sessoes": 0, "fotos": 0})
    for x in ss or []:
        if not isinstance(x, dict) or x.get("removida"):
            continue
        ini = _num(x.get("aberta_em")) or _num(x.get("cap0"))
        if ini:
            g = ph(_hora_local(ini))
            g["sessoes"] += 1
            g["fotos"] += len(x.get("fotos") or []) + len(x.get("pend") or [])
        if x.get("trilha", "vivo") != "vivo" or x.get("atrasada"):
            continue                                  # critério 16: clique e transferência só da trilha ao vivo
        # sem primeira_foto: funcionaria como hora de chegada do fotógrafo (Eduardo, 05/11 noite: sem presença)
        pf = out["por_fotografo"].setdefault(str(x.get("fotografo") or "sem fotógrafo"), {})
        cap1 = _num(x.get("cap1"))
        if not cap1:
            continue
        fe = _num(x.get("fechada_em"))
        if x.get("status") == "fechada" and fe and x.get("fechada_por") != "reinicio":   # reinício não é o tempo real
            h_add(tempos["clique_checkout_s"], fe - cap1)
            h_add(pf.setdefault("clique_checkout_s", h_novo()), fe - cap1)
        uc = _num(x.get("ultima_chegada"))
        if uc:
            h_add(tempos["transferencia_s"], uc - cap1)
    vs = {}
    for e in evs or []:
        v = vs.setdefault(e["venda"], {"criar": None, "criar_em": 0, "pagar_em": 0, "pagar_por": None})
        if e["tipo"] == "criar":
            v["criar"], v["criar_em"] = e.get("dados") or {}, _epoch(e.get("em"))
        elif e["tipo"] == "pagar" and not v["pagar_em"]:
            v["pagar_em"], v["pagar_por"] = _epoch(e.get("em")) or 1, e.get("por")
    for v in vs.values():
        c = v["criar"]
        if not c or not v["pagar_em"]:
            continue
        tot = float(c.get("total") or 0)
        quando = v["pagar_em"] if v["pagar_em"] > 1 else v["criar_em"]
        if quando:
            g = ph(_hora_local(quando))
            g["vendas"] += 1
            g["faturamento"] = round(g["faturamento"] + tot, 2)
        cart = c.get("cart") if isinstance(c.get("cart"), list) else None
        if cart:
            for it in cart:
                p = out["por_produto"].setdefault(str(it.get("id"))[:20], {"n": 0, "receita": 0.0})
                p["n"] += 1
                p["receita"] = round(p["receita"] + float(it.get("v") or 0), 2)
        else:                                         # critério 14: venda antiga nunca vira pacote
            p = out["por_produto"].setdefault("sem_detalhe", {"n": 0, "receita": 0.0})
            p["n"] += 1
            p["receita"] = round(p["receita"] + tot, 2)
        canal = c.get("canal") if c.get("canal") in EV_CANAIS else "sem_canal"
        g = out["por_canal"].setdefault(canal, {"vendas": 0, "faturamento": 0.0})
        g["vendas"] += 1
        g["faturamento"] = round(g["faturamento"] + tot, 2)
        if canal == "checkout" and c.get("lang") in EV_LANGS:   # S3: idioma só do Checkout
            g = out["por_idioma"].setdefault(c["lang"], {"vendas": 0, "faturamento": 0.0})
            g["vendas"] += 1
            g["faturamento"] = round(g["faturamento"] + tot, 2)
        if c.get("t0") and v["criar_em"]:
            h_add(tempos["cliente_s"], v["criar_em"] - _epoch(c["t0"]))
        if canal == "checkout" and v["criar_em"] and v["pagar_em"] > 1:   # R3: só o Checkout (no balcão criar e pagar saem juntos)
            d = v["pagar_em"] - v["criar_em"]
            h_add(tempos["pagamento_s"], d)
            # R4: quem confirmou fica em por_confirmador, nunca misturado com o por_vendedor da v1 (vendas e faturamento)
            nome = _nome_pessoa(v["pagar_por"]) or _nome_pessoa(c.get("vendedor")) or "sem nome"
            h_add(out["por_confirmador"].setdefault(nome, {}).setdefault("pagamento_s", h_novo()), d)
    out["entradas"] = entradas_dia(dia)
    return out


def _nome_pessoa(x):
    """Nome de quem vendeu ou confirmou ({nome} ou texto), limpo; nunca uma chave especial de objeto."""
    if isinstance(x, dict):
        x = x.get("nome")
    if not isinstance(x, str):
        return None
    x = re.sub(r"[<>\x00-\x1f]", "", x).strip()[:60]
    return None if not x or x in ("__proto__", "constructor", "prototype") else x


def met_v2_junta(m, v2, so_acrescenta=False):
    """Põe os campos v2 no resumo. so_acrescenta (migração, critério 26): nunca troca um valor que já existe."""
    for k, v in v2.items():
        if k in ("por_fotografo", "por_confirmador"):
            dst = m.setdefault(k, {})
            for nome, extra in v.items():
                alvo = dst.setdefault(nome, {})
                for kk, vv in extra.items():
                    if not so_acrescenta or kk not in alvo:
                        alvo[kk] = vv
        elif k == "v":
            m["v"] = 2
        elif not so_acrescenta or k not in m:
            m[k] = v
    return m


_op_criado = {"arq": None}


def operacao_db():
    """Conexão ao operacao.db (chamar com op_lock). As tabelas são criadas uma vez por arquivo (revisão)."""
    os.makedirs(os.path.dirname(OPERACAO_DB), exist_ok=True)
    c = sqlite3.connect(OPERACAO_DB, timeout=30, check_same_thread=False)
    c.execute("pragma synchronous=full")
    if _op_criado["arq"] != OPERACAO_DB or not os.path.exists(OPERACAO_DB):
        c.execute("pragma journal_mode=wal")
        # Eduardo, 05/11 noite: o Eterna não é controle de ponto (é do RH). Presença saiu da v92; as tabelas de testes antigos
        # somem de verdade (secure_delete zera as páginas, VACUUM e checkpoint tiram o resto do arquivo e do WAL). Só uma vez:
        # depois do drop as tabelas não existem mais.
        velhas = [r[0] for r in c.execute("select name from sqlite_master where type = 'table' and name in ('presenca', 'servico')")]
        if velhas:
            c.execute("pragma secure_delete=on")
            for t in velhas:
                c.execute("drop table if exists %s" % t)
            c.commit()
            c.execute("vacuum")
            c.execute("pragma wal_checkpoint(truncate)")
        c.execute("create table if not exists entrada (dia text, origem text, seg int)")
        c.execute("create index if not exists entrada_dia on entrada(dia, origem)")
        c.execute("create table if not exists importacao (id text primary key, em text, por text, arquivo text, origem text,"
                  " dias text, aceitas int, recusadas int)")
        # v97: série diária (uma linha por dia) e total diário de visitantes (bilheteria; "entrada_dia" já é nome de índice)
        c.execute("create table if not exists dia (dia text primary key, tipo text, jogo int, vespera int, feriado int, show int, fechado int,"
                  " fds int, eventos text, fonte_vendas text, vendas int, receita real, fotos int, sessoes int, sessoes_com_venda int,"
                  " entradas int, entradas_fonte text, clima text, calc_em text, v int)")
        c.execute("create table if not exists entrada_total (dia text, origem text, total int, importacao text, primary key (dia, origem))")
        c.commit()
        _op_criado["arq"] = OPERACAO_DB
    return c


def op_ler(sql, args=()):
    """Consulta de leitura no operacao.db (com op_lock); lista de linhas."""
    with op_lock:
        db = operacao_db()
        try:
            return db.execute(sql, args).fetchall()
        finally:
            db.close()









def estado_db_ler(col):
    with estado_lock:
        db = estado_db()
        try:
            return db.execute("select valor from doc where col = ? and valor is not null", (col,)).fetchall()
        finally:
            db.close()






def _hhmm(seg):
    return "%02d:%02d" % (seg // 3600, (seg % 3600) // 60)


def entradas_dia(dia):
    """Resumo das entradas do dia, ou None sem entrada. Com catraca e bip no mesmo dia, o total usa a catraca (S6)."""
    try:
        rs = op_ler("select origem, seg from entrada where dia = ?", (dia,))
    except Exception:
        return None
    if not rs:
        return None
    por = {}
    for o, s in rs:
        por.setdefault(o, []).append(int(s))
    fonte = "catraca" if por.get("catraca") else "bip"
    segs = sorted(por.get(fonte) or [])
    if not segs:
        return None
    ph, pm, p15 = {}, {}, {}
    for s in segs:
        h = "%02d" % (s // 3600)
        ph[h] = ph.get(h, 0) + 1
        pm[s // 60] = pm.get(s // 60, 0) + 1
        p15[s // 900] = p15.get(s // 900, 0) + 1
    bm = min(pm, key=lambda k: (-pm[k], k))
    b15 = min(p15, key=lambda k: (-p15[k], k))
    minutos = segs[-1] // 60 - segs[0] // 60 + 1
    return {"fonte": fonte, "total": len(segs), "por_origem": {o: len(v) for o, v in por.items()}, "por_hora": ph,
            "pico_min": {"hhmm": _hhmm(bm * 60), "n": pm[bm]}, "pico_15": {"hhmm": _hhmm(b15 * 900), "n": p15[b15]},
            "primeira": _hhmm(segs[0]), "ultima": _hhmm(segs[-1]), "minutos": minutos,
            "media_min": round(len(segs) / minutos, 2)}


def entradas_validar(body):
    """(origem, dia, segs válidos, recusadas, arquivo, por) ou (None, motivo)."""
    origem = body.get("origem")
    if origem not in ENTRADAS_ORIGENS:
        return None, "origem inválida"
    dia = body.get("dia")
    hoje = _ff_hoje()
    if not isinstance(dia, str) or not re.match(r"^\d{4}-\d\d-\d\d$", dia):
        return None, "dia inválido"
    try:
        t = time.mktime(time.strptime(dia, "%Y-%m-%d"))
    except ValueError:
        return None, "dia inválido"
    if dia > hoje or dia < _ff_hoje(time.time() - 400 * 86400) or _ff_hoje(t + 43200) != dia:
        return None, "dia fora do intervalo"
    seg = body.get("seg")
    if not isinstance(seg, list) or not seg or len(seg) > ENTRADAS_MAX:
        return None, "entradas inválidas"
    ok = [s for s in seg if isinstance(s, int) and not isinstance(s, bool) and 0 <= s <= 86399]
    if not ok:
        return None, "nenhuma entrada válida"
    limpa = lambda v, n: re.sub(r"[<>\\/\x00-\x1f]", "", str(v or ""))[:n]
    return (origem, dia, ok, len(seg) - len(ok), limpa(body.get("arquivo"), 80), limpa(body.get("por"), 60)), None


def entradas_gravar(origem, dia, segs, recusadas, arquivo, por):
    """S6: importar de novo substitui o mesmo dia e a mesma origem (numa transação). Registra a importação."""
    iid = "imp_" + secrets.token_hex(6)
    with op_lock:
        db = operacao_db()
        try:
            with db:
                db.execute("delete from entrada where dia = ? and origem = ?", (dia, origem))
                db.executemany("insert into entrada values (?,?,?)", [(dia, origem, s) for s in segs])
                db.execute("insert into importacao values (?,?,?,?,?,?,?,?)",
                           (iid, _iso(), por, arquivo, origem, json.dumps([dia]), len(segs), recusadas))
        finally:
            db.close()
    threading.Thread(target=lambda: _met_regrava(dia), daemon=True).start()
    return {"ok": True, "id": iid, "dia": dia, "origem": origem, "aceitas": len(segs), "recusadas": recusadas}


def _met_regrava(dia):
    """Depois de importar entradas: hoje e ontem são refeitos inteiros; dia antigo só troca o campo "entradas" (o resto do
    resumo antigo nunca é recalculado: as sessões de lá podem já ter saído pelo prazo)."""
    try:
        if dia >= _ff_hoje(time.time() - 86400):
            metricas_gravar(dia)
            return
        arq = os.path.join(MET_DIR, dia + ".json")
        with met_lock(dia):
            if os.path.exists(arq):
                try:
                    with open(arq, encoding="utf8") as f:
                        m = json.load(f)
                    if not isinstance(m, dict):
                        raise ValueError("não é um objeto")
                except Exception as ex:          # S1: resumo que existe e não abre nunca é trocado por um registro vazio
                    print("  métricas (entradas): %s não abre, ficou como está (%s)" % (dia, str(ex)[:80]))
                    return
            else:                                # dia sem resumo: registro mínimo, sem v:2 (a migração ainda preenche)
                m = {"dia": dia, "gerado": _iso(), "so_entradas": True}
            m["entradas"] = entradas_dia(dia)
            met_escreve(dia, m)
    except Exception as ex:
        print("  métricas (entradas): %s" % str(ex)[:120])


def entradas_importacoes():
    rs = op_ler("select id, em, por, arquivo, origem, dias, aceitas, recusadas from importacao order by em desc, rowid desc limit 20")
    out = []
    for r in rs:
        try:
            dias = json.loads(r[5] or "[]")
        except Exception:
            dias = []
        out.append({"id": r[0], "em": r[1], "por": r[2], "arquivo": r[3], "origem": r[4], "dias": dias, "aceitas": r[6], "recusadas": r[7]})
    return {"ok": True, "importacoes": out}


def _migra_dia(dia, arq):
    """Migra um resumo (chamado com o lock do dia). True = já era v2 (nada gravado). Arquivo que não abre: exceção."""
    with open(arq, encoding="utf8") as f:
        m = json.load(f)
    if not isinstance(m, dict) or m.get("v") == 2:
        return True
    sf = os.path.join(SESS_DIR, dia + ".json")
    ss = None
    if os.path.exists(sf):
        try:
            with open(sf, encoding="utf8") as f:
                ss = json.load(f).get("sessoes") or []
        except Exception:
            ss = None
    v2 = met_v2(dia, ss, _ev_ler(dia))
    if ss is None:                                   # sem arquivo de sessões: não inventa tempos de clique nem de câmera
        for k in ("clique_checkout_s", "transferencia_s"):
            v2["tempos"].pop(k, None)
        v2.pop("por_fotografo", None)
    met_v2_junta(m, v2, so_acrescenta=True)
    m["migrado"] = True
    met_escreve(dia, m)
    return False


def metricas_migra_v2(pausa=0.2):
    """Uma vez, numa thread: os resumos antigos (v1) ganham os campos v2 que dá para refazer (horas, produtos, canal e
    pagamento_s do vendas.db; sessões, clique e transferência do arquivo de sessões, se ainda existir). SÓ ACRESCENTA:
    nenhum campo da v1 é trocado (critério 26). Hoje e ontem ficam com o metricas_loop, que já grava v2."""
    try:
        nomes = sorted(n for n in os.listdir(MET_DIR) if re.match(r"^\d{4}-\d\d-\d\d\.json$", n)) if os.path.isdir(MET_DIR) else []
    except OSError:
        nomes = []
    ontem = _ff_hoje(time.time() - 86400)
    est_migra.update(estado="rodando", feitos=0, total=len(nomes), erro=None)
    for n in nomes:
        dia = n[:10]
        if dia >= ontem:
            est_migra["feitos"] += 1
            continue
        try:
            with met_lock(dia):                      # S1: ler, mudar e gravar dentro do lock do dia
                pulou = _migra_dia(dia, os.path.join(MET_DIR, n))
        except Exception as ex:
            est_migra["erro"] = "%s: %s" % (dia, str(ex)[:120])
            pulou = False
        est_migra["feitos"] += 1
        if pulou:
            continue
        time.sleep(pausa)                            # o agente continua atendendo (critério 27)
    est_migra["estado"] = "feita"


# Coleção "agenda" (calendário de eventos): só os campos do contrato, textos sem < e >, até 2 KB por registro.
AGENDA_TIPOS = ("jogo", "show", "feriado", "fechado", "evento", "outro")
AGENDA_ORIGENS = ("manual", "csv", "feriados", "api")   # v97: api = jogos da API-Football
AGENDA_MAX = 2048
_re_agenda_id = re.compile(r"^ag_[0-9a-f]{12}$")


AGENDA_DOCS_MAX = 5000






def agenda_valida(doc_id, v):
    """Registro limpo da agenda, ou None (recusado)."""
    if not isinstance(v, dict) or not _re_agenda_id.match(doc_id) or v.get("id") not in (None, doc_id):
        return None
    data = v.get("data")
    if not isinstance(data, str) or not re.match(r"^\d{4}-\d\d-\d\d$", data):
        return None
    hora = v.get("hora") or ""
    if not isinstance(hora, str) or (hora and not re.match(r"^([01]\d|2[0-3]):[0-5]\d$", hora)):
        return None
    if v.get("tipo") not in AGENDA_TIPOS:
        return None
    txt = lambda x, n: re.sub(r"[<>\x00-\x1f]", "", str(x or ""))[:n]
    out = {"id": doc_id, "data": data, "hora": hora, "tipo": v["tipo"], "mandante": txt(v.get("mandante"), 60),
           "visitante": txt(v.get("visitante"), 60), "competicao": txt(v.get("competicao"), 60), "obs": txt(v.get("obs"), 200),
           "origem": v.get("origem") if v.get("origem") in AGENDA_ORIGENS else "manual", "por": txt(v.get("por"), 60),
           "em": txt(v.get("em"), 30)}
    if isinstance(v.get("ext"), str) and re.match(r"^af:\d{1,12}$", v["ext"]):   # v97: id da partida na fonte
        out["ext"] = v["ext"]
    if len(json.dumps(out, ensure_ascii=False).encode("utf8")) > AGENDA_MAX:
        return None
    return out


# Quem pode cada rota do agente. Nada abre sem estar aqui: rota fora da tabela responde 404 sem tocar o disco.
#   publica          qualquer um: o app, o /status mínimo, a galeria do cliente (/g/) e o webhook do adquirente
#   posto_ou_sessao  aparelho pareado (cookie eterna_posto) ou pessoa conectada com um dos módulos (vazio = qualquer pessoa)
#   sessao           pessoa conectada com um dos módulos (vazio = qualquer pessoa conectada; a rota confere o resto)
#   teste            só com ETERNA_TESTE_CARGA=1 e pessoa com Painel de controle (Alterar)
# Caminho terminado em "/" vale como prefixo. Fora das públicas: Host do agente, Origin conhecida e, em POST, X-Eterna: 1.
FOTOS_LER = ("venda.r", "quiosque.r", "set.r", "estoque.r", "galerias.r", "qualidade.r")        # ver fotos e sessões
VENDER = ("venda.c", "quiosque.c", "galerias.c")                                          # o que o Checkout faz numa venda
ROTAS = (
    ("GET", "/", "publica", ()), ("GET", "/index.html", "publica", ()),
    ("GET", "/img/", "publica", ()), ("GET", "/vendor/", "publica", ()), ("GET", "/sprites/", "publica", ()),
    ("GET", "/status", "publica", ()),                          # sem credencial, só {ok, agent, version, boot}
    ("GET", "/g/", "publica", ()), ("POST", "/g/", "publica", ()), ("POST", "/pagamento/webhook/", "publica", ()),
    ("GET", "/postos/aceitar", "publica", ()), ("POST", "/postos/aceitar", "publica", ()),   # o código de uso único (10 min) é a credencial
    ("POST", "/auth/entrar", "publica", ()), ("POST", "/auth/trocar", "publica", ()), ("POST", "/auth/sair", "publica", ()),
    ("POST", "/auth/esqueci", "publica", ()),
    ("GET", "/auth/eu", "sessao", ()), ("GET", "/auth/senhas", "sessao", ()),
    ("POST", "/auth/senha/gerar", "sessao", ()), ("POST", "/auth/senha/cancelar", "sessao", ()),
    ("GET", "/postos/eu", "publica", ()),                       # a rota confere Host e responde 401 sem_posto
    ("GET", "/ftp/contas", "sessao", ("configuracao.r",)),
    ("GET", "/postos", "sessao", ("configuracao.r",)),
    ("POST", "/postos/parear", "sessao", ("configuracao.u",)), ("POST", "/postos/revogar", "sessao", ("configuracao.u",)),
    # o que o Checkout usa: posto pareado ou pessoa conectada com o módulo
    ("GET", "/thumb/", "posto_ou_sessao", FOTOS_LER), ("GET", "/file/", "posto_ou_sessao", FOTOS_LER),
    ("GET", "/sessoes", "posto_ou_sessao", FOTOS_LER),
    ("GET", "/ponto/docs", "posto_ou_sessao", ()),              # posto: só sim, config e agenda
    ("GET", "/ponto/docs/revs", "posto_ou_sessao", ()),
    ("POST", "/ponto/docs", "posto_ou_sessao", ()),             # permissão por documento (auth_filtrar_docs); o posto não grava
    ("POST", "/ponto/eventos", "posto_ou_sessao", VENDER),
    ("GET", "/ponto/impressoes", "posto_ou_sessao", VENDER),     # histórico de impressão das vendas (ev_impressoes)
    ("POST", "/rostos/buscar", "posto_ou_sessao", VENDER),
    ("POST", "/galerias/publicar", "posto_ou_sessao", VENDER),  # cortesia nova só com galerias.u (a rota confere)
    ("POST", "/recorte", "posto_ou_sessao", VENDER), ("GET", "/recorte/", "posto_ou_sessao", VENDER),
    ("GET", "/photoroom/status", "posto_ou_sessao", VENDER + ("configuracao.r",)),    # sem Painel de controle: só {configured, fundos_modo}
    ("GET", "/photoroom/result/", "posto_ou_sessao", VENDER), ("POST", "/photoroom/compose", "posto_ou_sessao", VENDER),
    ("GET", "/fila-fotografo", "posto_ou_sessao", ("filafoto.r",)),
    # só a equipe, pelo módulo
    ("GET", "/biblioteca", "sessao", ("set.r", "estoque.r")), ("GET", "/events", "sessao", ("set.r", "estoque.r")),
    ("POST", "/fotos/enviar", "sessao", ("set.c",)),
    ("GET", "/metricas", "sessao", ("estatisticas.r", "financeiro.r")), ("GET", "/metricas/dia", "sessao", ("estatisticas.r", "financeiro.r")),
    ("GET", "/roverpix/status", "sessao", ("financeiro.r",)), ("GET", "/roverpix/data", "sessao", ("financeiro.r",)),
    ("POST", "/roverpix/sync", "sessao", ("configuracao.u",)), ("POST", "/roverpix/config", "sessao", ("configuracao.u",)),
    ("GET", "/ftp-remoto/status", "sessao", ("configuracao.r",)), ("POST", "/ftp-remoto/config", "sessao", ("configuracao.u",)),
    ("POST", "/photoroom/config", "sessao", ("configuracao.u",)), ("POST", "/fundos/modo", "sessao", ("configuracao.u",)),
    ("POST", "/nuvem/reenviar", "sessao", ("configuracao.u",)),
    ("POST", "/fila-fotografo/funcao", "sessao", ("escala.u",)),
    ("POST", "/ponto/entradas", "sessao", ("estatisticas.c",)), ("GET", "/ponto/entradas/importacoes", "sessao", ("estatisticas.r",)),
    ("GET", "/estatisticas/dias", "sessao", ("estatisticas.r",)), ("GET", "/agenda/status", "sessao", ()),   # v97-agenda (Eduardo); a rota confere o resto (agenda_rota)
    ("POST", "/agenda/atualizar", "sessao", ("escala.u", "configuracao.u")), ("POST", "/ponto/entradas/totais", "sessao", ("estatisticas.c",)),
    ("POST", "/agenda/fonte", "sessao", ("configuracao.u",)), ("POST", "/agenda/testar", "sessao", ("configuracao.u",)),
    ("GET", "/visitas", "posto_ou_sessao", FOTOS_LER), ("POST", "/visitas/juntar", "posto_ou_sessao", ("venda.u",)),   # v97-recorte (Eduardo); a rota confere o resto
    ("POST", "/visitas/separar", "posto_ou_sessao", ("venda.u",)), ("POST", "/visitas/config", "sessao", ("configuracao.u",)),
    ("GET", "/impressao/fila", "sessao", ("venda.r",)), ("GET", "/impressao/miniatura", "sessao", ("venda.r",)),
    ("POST", "/imprimir", "sessao", ("venda.c", "venda.u")), ("POST", "/impressao/acao", "sessao", ("venda.u",)),
    ("GET", "/galerias/vendas", "sessao", ("galerias.r",)), ("GET", "/galerias/status", "sessao", ("galerias.r",)),
    ("POST", "/galerias/encerrar", "sessao", ("galerias.d",)),
    ("POST", "/lgpd/excluir", "sessao", ("galerias.d",)),
    ("POST", "/rostos/medir", "sessao", ("qualidade.r",)),
    ("POST", "/rostos/projecao", "teste", ()), ("GET", "/nuvem/link", "teste", ()),
)


def rota_regra(metodo, path):
    """-> (tipo, módulos) da rota, ou None se ela não existe."""
    for m, c, tipo, mods in ROTAS:
        if m == metodo and (path == c or (c.endswith("/") and c != "/" and path.startswith(c))):
            return tipo, mods
    return None


# ---------- Agenda automática e série diária (v97; plano docs/planos/2026-11-10-agenda-estatisticas.md) ----------
# Feriados nacionais e do Rio calculados aqui, sem internet e sem clique. Jogos no Maracanã pela API-Football, só com a
# chave colada em Configurações › Painel de controle (~/Eterna/api-football.json, 600): a chave nunca volta ao navegador (só os 4
# últimos caracteres), nunca vai para log, status, URL ou backup. Evento automático editado ou apagado por uma pessoa
# nunca é sobrescrito nem recriado (D9). Série diária: tabela "dia" do operacao.db, uma linha por dia a partir de
# 10/11/2026 (Eduardo, 10/11: sem retroativo da Roverpix), com tipo do dia, vendas, fotos, conversão e visitação.
AGENDA_DESDE = 2026
DIA_DESDE = "2026-11-10"
DIA_MAX_RODADA = 800
AF_CFG = os.path.join(HOME, "api-football.json")
AF_FONTE = os.path.join(HOME, "ponto", "agenda-fonte.json")
AF_URL = "https://v3.football.api-sports.io"     # host fixo (risco 2); só os testes trocam, pelo módulo (m.AF_URL)
AF_ENV = "ETERNA_API_FOOTBALL"                    # chave definida no servidor: vale por cima da tela
AF_RESP_MAX = 2 * 1024 * 1024
AF_FORA = ("PST", "CANC", "ABD", "SUSP")          # adiado, cancelado, abandonado, suspenso: sai do calendário (D2)
AF_TZ = "America/Sao_Paulo"
AF_NOMES = {"vasco da gama": "Vasco da Gama", "vasco da gama rj": "Vasco da Gama", "brazil": "Seleção Brasileira",
            "brasil": "Seleção Brasileira", "botafogo rj": "Botafogo", "botafogo fr": "Botafogo"}
_re_af_chave = re.compile(r"^[A-Za-z0-9]{20,64}$")
_re_dia_iso = re.compile(r"^\d{4}-\d\d-\d\d$")
agenda_lock = threading.Lock()                    # uma sincronização de jogos por vez
agenda_wake = threading.Event()
dia_wake = threading.Event()
agenda_fonte = {"feriados_ate": None, "ultima": None, "tentativa": None, "ok": None, "erro": None, "pedidos_hoje": 0,
                "pedidos_dia": None, "restantes": None, "n_por_ano": {}, "ja_no_calendario": 0, "venue_id": None,
                "apagados_api": [], "teste": None, "rodando": False}
AF_FONTE_CAMPOS = ("ultima", "tentativa", "ok", "erro", "pedidos_hoje", "pedidos_dia", "restantes", "n_por_ano",
                   "ja_no_calendario", "venue_id", "apagados_api", "teste")
_af_carregado = [False]
dia_sujos = set()
dia_sujos_lock = threading.Lock()
dia_estado = {"ultima": None, "erro": None, "completa": None}


def agenda_id(chave):
    """Id determinístico: o mesmo feriado ou a mesma partida nunca duplica (dois aparelhos, vários boots)."""
    return "ag_" + hashlib.sha1(chave.encode("utf8")).hexdigest()[:12]


def pascoa(y):
    """Domingo de Páscoa (mesmo cálculo do pascoa do app)."""
    a, b, c = y % 19, y // 100, y % 100
    d, e, f = b // 4, b % 4, (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    return _dt.date(y, (h + l - 7 * m + 114) // 31, ((h + l - 7 * m + 114) % 31) + 1)


def feriados_de(ano):
    """D8: feriados nacionais e do Rio, os móveis pela Páscoa. Mesma lista do feriadosDe do app. [(AAAA-MM-DD, nome)]."""
    F = [("01-01", "Confraternização Universal"), ("01-20", "São Sebastião (Rio)"), ("04-21", "Tiradentes"),
         ("04-23", "São Jorge (Rio)"), ("05-01", "Dia do Trabalho"), ("09-07", "Independência do Brasil"),
         ("10-12", "Nossa Senhora Aparecida"), ("11-02", "Finados"), ("11-15", "Proclamação da República"),
         ("11-20", "Consciência Negra"), ("12-25", "Natal")]
    out = [("%d-%s" % (ano, md), n) for md, n in F]
    p = pascoa(ano)
    for dd, n in ((-48, "Carnaval (segunda)"), (-47, "Carnaval"), (-2, "Sexta-feira Santa"), (60, "Corpus Christi")):
        out.append(((p + _dt.timedelta(days=dd)).isoformat(), n))
    return sorted(out)


def _agenda_todos():
    """Coleção agenda inteira: id -> registro, ou None para a lápide (apagado)."""
    with estado_lock:
        db = estado_db()
        try:
            rs = db.execute("select id, valor from doc where col = 'agenda'").fetchall()
        finally:
            db.close()
    out = {}
    for i, v in rs:
        try:
            x = json.loads(v) if v is not None else None
        except Exception:
            x = None
        out[i] = x if isinstance(x, dict) else None
    return out


def _agenda_grava(docs):
    for i in range(0, len(docs), 500):            # estado_gravar aceita 500 por vez
        estado_gravar({"docs": docs[i:i + 500]}, quem="agente")


def agenda_semear_feriados(ano_atual=None):
    """Feriados de AGENDA_DESDE até o ano que vem. Não grava se o id já existe (inclusive apagado: a pessoa apagou, não
    volta) nem se a data já tem um feriado (os criados antes pelo botão "Adicionar feriados", de id aleatório)."""
    ano_atual = ano_atual or int(_ff_hoje()[:4])
    todos = _agenda_todos()
    datas = {v.get("data") for v in todos.values() if v and v.get("tipo") == "feriado"}
    em, novos = _iso(), []
    for ano in range(AGENDA_DESDE, ano_atual + 2):
        for data, nome in feriados_de(ano):
            i = agenda_id("feriado|" + data)
            if i in todos or data in datas:
                continue
            datas.add(data)
            novos.append({"col": "agenda", "id": i, "valor": {"id": i, "data": data, "hora": "", "tipo": "feriado", "mandante": "",
                          "visitante": "", "competicao": "", "obs": nome, "origem": "feriados", "por": "Eterna", "em": em}})
    if novos:
        _agenda_grava(novos)
    agenda_fonte["feriados_ate"] = ano_atual + 1
    return len(novos)


def _af_fonte_carrega():
    if _af_carregado[0]:
        return
    _af_carregado[0] = True
    try:
        with open(AF_FONTE, encoding="utf8") as f:
            j = json.load(f)
        if isinstance(j, dict):
            for k in AF_FONTE_CAMPOS:
                if k in j:
                    agenda_fonte[k] = j[k]
    except Exception:
        pass


def _af_fonte_grava():
    """Situação da fonte (sem a chave e sem URL), 600."""
    try:
        os.makedirs(os.path.dirname(AF_FONTE), exist_ok=True)
        _grava_privado(AF_FONTE, json.dumps({k: agenda_fonte.get(k) for k in AF_FONTE_CAMPOS}, ensure_ascii=False))
    except Exception as ex:
        print("  agenda: não gravei a situação da fonte (%s)" % type(ex).__name__)


def af_cfg():
    """Chave da API-Football: a variável de ambiente do servidor vale por cima do arquivo colado pela tela."""
    env = (os.environ.get(AF_ENV) or "").strip()
    if env:
        return {"chave": env, "env": True, "em": None, "por": None}
    try:
        with open(AF_CFG, encoding="utf8") as f:
            c = json.load(f)
        if isinstance(c, dict) and isinstance(c.get("chave"), str) and _re_af_chave.match(c["chave"]):
            return {"chave": c["chave"], "env": False, "em": c.get("em"), "por": c.get("por")}
    except Exception:
        pass
    return None


def af_salvar(chave, por):
    _grava_privado(AF_CFG, json.dumps({"chave": chave, "em": _iso(), "por": str(por or "")[:60]}))
    agenda_fonte.update(teste=None, erro=None, ok=None, tentativa=None)
    _af_fonte_grava()


def af_remover():
    try:
        os.remove(AF_CFG)
    except FileNotFoundError:
        pass
    agenda_fonte.update(teste=None, erro=None, ok=None, tentativa=None)
    _af_fonte_grava()


class _AfSemRedir(urllib.request.HTTPRedirectHandler):
    """A chave vai num cabeçalho: redirecionamento para outro host nunca é seguido (risco 2)."""
    def redirect_request(self, *a, **k):
        return None


def _af_msg(ex, cfg):
    t = re.sub(r"[\x00-\x1f<>]", "", str(ex))[:160]
    return t.replace(cfg["chave"], "····") if cfg and cfg.get("chave") else t


def af_get(cfg, rota, params):
    """GET na API-Football (host fixo, timeout 20 s, resposta até 2 MB). Erro vira RuntimeError sem a chave."""
    hoje = _ff_hoje()
    if agenda_fonte.get("pedidos_dia") != hoje:
        agenda_fonte.update(pedidos_dia=hoje, pedidos_hoje=0)
    agenda_fonte["pedidos_hoje"] = int(agenda_fonte.get("pedidos_hoje") or 0) + 1
    req = urllib.request.Request(AF_URL.rstrip("/") + rota + "?" + urlencode(params),
                                 headers={"x-apisports-key": cfg["chave"], "Accept": "application/json", "User-Agent": "eterna-agente"})
    try:
        with urllib.request.build_opener(_AfSemRedir).open(req, timeout=20) as r:
            corpo = r.read(AF_RESP_MAX + 1)
            resto = r.headers.get("x-ratelimit-requests-remaining")
    except urllib.error.HTTPError as ex:
        raise RuntimeError("API-Football respondeu HTTP %d%s" % (ex.code, " (chave recusada)" if ex.code in (401, 403) else ""))
    except Exception as ex:
        raise RuntimeError("sem conexão com a API-Football (%s)" % type(ex).__name__)
    if len(corpo) > AF_RESP_MAX:
        raise RuntimeError("resposta da API-Football grande demais")
    try:
        j = json.loads(corpo.decode("utf8"))
    except Exception:
        raise RuntimeError("resposta da API-Football inválida")
    try:
        agenda_fonte["restantes"] = int(resto) if resto is not None else agenda_fonte.get("restantes")
    except ValueError:
        pass
    erros = j.get("errors") if isinstance(j, dict) else None
    if erros:
        vals = list(erros.values()) if isinstance(erros, dict) else list(erros) if isinstance(erros, list) else [erros]
        raise RuntimeError("API-Football: " + (str(vals[0]) if vals else "erro"))
    resp = j.get("response") if isinstance(j, dict) else None
    if not isinstance(resp, list):
        raise RuntimeError("resposta da API-Football sem lista")
    return resp


def af_venue(cfg):
    """Id do Maracanã na API-Football: descoberto uma vez e guardado na situação da fonte."""
    v = agenda_fonte.get("venue_id")
    if isinstance(v, int) and not isinstance(v, bool) and v > 0:
        return v
    for x in af_get(cfg, "/venues", {"search": "Maracan"}):
        if not isinstance(x, dict):
            continue
        nome, cidade = str(x.get("name") or "").lower(), str(x.get("city") or "").lower()
        if "maracan" in nome and "rio de janeiro" in cidade and isinstance(x.get("id"), int) and x["id"] > 0:
            agenda_fonte["venue_id"] = x["id"]
            _af_fonte_grava()
            return x["id"]
    raise RuntimeError("o Maracanã não apareceu na busca de estádios da API-Football")


def _af_local(ts):
    """Hora UTC da API no fuso do venue (critério 21), com ou sem zoneinfo."""
    try:
        from zoneinfo import ZoneInfo
        t = _dt.datetime.fromtimestamp(ts, ZoneInfo(os.environ.get("ETERNA_TZ") or AF_TZ))
    except Exception:
        t = _dt.datetime.fromtimestamp(ts)      # o agente já roda no fuso do venue (fuso_ajusta)
    return t.strftime("%Y-%m-%d"), t.strftime("%H:%M")


def _af_nome(x):
    n = re.sub(r"[<>\x00-\x1f]", "", str((x or {}).get("name") or "")).strip()[:60]
    return AF_NOMES.get(n.lower(), n)


def af_partidas(cfg, venue, temporada):
    out = []
    for x in af_get(cfg, "/fixtures", {"venue": venue, "season": temporada}):
        if not isinstance(x, dict):
            continue
        fx, tm, lg = x.get("fixture") or {}, x.get("teams") or {}, x.get("league") or {}
        fid, ts = fx.get("id"), fx.get("timestamp")
        if not isinstance(fid, int) or isinstance(fid, bool) or not 0 < fid < 10 ** 12:
            continue
        if not isinstance(ts, (int, float)) or isinstance(ts, bool):
            try:
                ts = _dt.datetime.fromisoformat(str(fx.get("date")).replace("Z", "+00:00")).timestamp()
            except Exception:
                continue
        data, hora = _af_local(ts)
        st = str((fx.get("status") or {}).get("short") or "")[:6]
        out.append({"fixture_id": fid, "data": data, "hora": "" if st == "TBD" else hora, "status": st,
                    "mandante": _af_nome(tm.get("home")), "visitante": _af_nome(tm.get("away")),
                    "competicao": re.sub(r"[<>\x00-\x1f]", "", str(lg.get("name") or ""))[:60]})
    return out


def _ag_do_agente(v, ext):
    """Registro ainda como o agente gravou (risco 4: não basta o "por", que alguém pode digitar)."""
    return isinstance(v, dict) and v.get("por") == "Eterna" and v.get("origem") == "api" and v.get("ext") == ext


def agenda_aplica_jogos(partidas):
    """Grava as partidas na agenda pela regra D9. Devolve {gravados, apagados, ja_no_calendario, n_por_ano}."""
    todos = _agenda_todos()
    humanos = {v["data"] for v in todos.values() if v and v.get("tipo") == "jogo" and not (v.get("origem") == "api" and v.get("por") == "Eterna")}
    apagados = set(agenda_fonte.get("apagados_api") or [])
    docs, ja, n_por_ano, em, n_apag = [], 0, {}, _iso(), 0
    for p in partidas:
        ext = "af:%d" % p["fixture_id"]
        i = agenda_id("af|%d" % p["fixture_id"])
        atual = todos.get(i, False)              # False = nunca existiu; None = lápide
        if p["status"] in AF_FORA:
            if _ag_do_agente(atual, ext):
                docs.append({"col": "agenda", "id": i, "valor": None})
                apagados.add(i)
                n_apag += 1
            continue
        n_por_ano[p["data"][:4]] = n_por_ano.get(p["data"][:4], 0) + 1
        if atual is None and i not in apagados:  # apagado por uma pessoa: não volta
            continue
        if atual and not _ag_do_agente(atual, ext):   # editado por uma pessoa: não muda
            continue
        if not atual and p["data"] in humanos:   # jogo cadastrado à mão na mesma data
            ja += 1
            continue
        novo = {"id": i, "data": p["data"], "hora": p["hora"], "tipo": "jogo", "mandante": p["mandante"], "visitante": p["visitante"],
                "competicao": p["competicao"], "obs": "", "origem": "api", "ext": ext, "por": "Eterna", "em": em}
        if atual and all(atual.get(k) == novo[k] for k in ("data", "hora", "mandante", "visitante", "competicao")):
            continue
        apagados.discard(i)
        docs.append({"col": "agenda", "id": i, "valor": novo})
    if docs:
        _agenda_grava(docs)
    agenda_fonte["apagados_api"] = sorted(apagados)[-2000:]
    return {"gravados": len(docs) - n_apag, "apagados": n_apag, "ja_no_calendario": ja, "n_por_ano": n_por_ano}


def agenda_jogos_sync(motivo=""):
    """Temporadas de AGENDA_DESDE até a atual (e a próxima a partir de dezembro). Falha não apaga nada."""
    if not agenda_lock.acquire(blocking=False):
        return {"ok": False, "ja_rodando": True}
    try:
        _af_fonte_carrega()
        cfg = af_cfg()
        if not cfg:
            return {"ok": False, "erro": "sem_chave"}
        agenda_fonte["rodando"] = True
        hoje = _ff_hoje()
        ano = int(hoje[:4])
        temporadas = list(range(AGENDA_DESDE, ano + 1)) + ([ano + 1] if hoje[5:7] == "12" else [])
        partidas, erros = {}, []
        try:
            venue = af_venue(cfg)
            for t in temporadas:
                try:
                    for p in af_partidas(cfg, venue, t):
                        partidas[p["fixture_id"]] = p
                except RuntimeError as ex:
                    erros.append("%d: %s" % (t, _af_msg(ex, cfg)))
        except RuntimeError as ex:
            erros.append(_af_msg(ex, cfg))
            venue = None
        r = agenda_aplica_jogos(list(partidas.values())) if partidas else {"gravados": 0, "apagados": 0, "ja_no_calendario": 0, "n_por_ano": {}}
        ok = not erros
        agenda_fonte.update(tentativa=_iso(), ok=ok, erro="; ".join(erros)[:300] or None,
                            ja_no_calendario=r["ja_no_calendario"], n_por_ano=r["n_por_ano"] if partidas else agenda_fonte.get("n_por_ano") or {})
        if ok:
            agenda_fonte["ultima"] = agenda_fonte["tentativa"]
        _af_fonte_grava()
        print("  agenda (jogos, %s): %d gravados, %d apagados, %d já no calendário%s" % (motivo or "agenda", r["gravados"], r["apagados"],
              r["ja_no_calendario"], "" if ok else " · erro: " + agenda_fonte["erro"]))
        return {"ok": ok, **r, "erro": agenda_fonte["erro"]}
    finally:
        agenda_fonte["rodando"] = False
        agenda_lock.release()


def agenda_testar():
    """"Testar agora" do Painel de controle: uma consulta da temporada atual (mais a busca do estádio na primeira vez)."""
    _af_fonte_carrega()
    cfg = af_cfg()
    if not cfg:
        return {"ok": False, "erro": "sem_chave"}
    ano = int(_ff_hoje()[:4])
    try:
        n = len(af_partidas(cfg, af_venue(cfg), ano))
        t = {"em": _iso(), "ok": True, "temporada": ano, "n": n, "erro": None}
    except RuntimeError as ex:
        t = {"em": _iso(), "ok": False, "temporada": ano, "n": 0, "erro": _af_msg(ex, cfg)}
    agenda_fonte["teste"] = t
    _af_fonte_grava()
    return t


def _agenda_vencida(agora=None):
    """Sincroniza toda segunda às 06:00 (fuso do venue), no boot se a última passou de 7 dias, e de novo 6 h depois de uma falha."""
    agora = agora or time.time()
    ult, tent = _epoch(agenda_fonte.get("ultima") or ""), _epoch(agenda_fonte.get("tentativa") or "")
    if tent and not agenda_fonte.get("ok") and agora - tent < 6 * 3600:
        return False
    if not ult or agora - ult > 7 * 86400:
        return True
    lt = time.localtime(agora)
    seis = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 6, 0, 0, 0, 0, -1))
    return lt.tm_wday == 0 and agora >= seis and ult < seis


def agenda_loop():
    _af_fonte_carrega()
    dia_feito = None
    while True:
        hoje = _ff_hoje()
        if hoje != dia_feito:                    # no boot e na virada do dia (pega a virada do ano sem ninguém)
            try:
                n = agenda_semear_feriados()
                if n:
                    print("  agenda: %d feriados adicionados (até %d)" % (n, agenda_fonte["feriados_ate"]))
                dia_feito = hoje
            except Exception as ex:
                print("  agenda (feriados): %s" % str(ex)[:120])
        acordado = agenda_wake.is_set()
        agenda_wake.clear()
        try:
            if af_cfg() and (acordado or _agenda_vencida()):
                agenda_jogos_sync("pedido na tela" if acordado else "agenda")
        except Exception as ex:
            print("  agenda (jogos): %s" % type(ex).__name__)
        agenda_wake.wait(60)


def agenda_status(publico=False):
    """Situação das fontes. publico=True é o bloco do /status (CORS aberto): sem os 4 últimos, sem quem salvou."""
    _af_fonte_carrega()
    cfg = af_cfg()
    j = {"fonte": "api-football" if cfg else "nenhuma", "chave": bool(cfg), "ultima": agenda_fonte.get("ultima"),
         "ok": agenda_fonte.get("ok"), "erro": agenda_fonte.get("erro")}
    if publico:
        return {"feriados_ate": agenda_fonte.get("feriados_ate"), "jogos": j}
    j.update(env=bool(cfg and cfg["env"]), final=cfg["chave"][-4:] if cfg else None, salva_em=cfg and cfg.get("em"),
             salva_por=cfg and cfg.get("por"), tentativa=agenda_fonte.get("tentativa"), n_por_ano=agenda_fonte.get("n_por_ano") or {},
             ja_no_calendario=agenda_fonte.get("ja_no_calendario") or 0, teste=agenda_fonte.get("teste"),
             rodando=bool(agenda_fonte.get("rodando")), pedidos_hoje=agenda_fonte.get("pedidos_hoje") if agenda_fonte.get("pedidos_dia") == _ff_hoje() else 0,
             restantes=agenda_fonte.get("restantes"))
    return {"ok": True, "feriados_ate": agenda_fonte.get("feriados_ate"), "jogos": j,
            "dias": {"desde": DIA_DESDE, **dia_estado}}


# --- série diária (tabela dia do operacao.db) ---
def _dia_mais(d, n):
    return (_dt.date.fromisoformat(d) + _dt.timedelta(days=n)).isoformat()


def dia_marcar(datas):
    """Dias que mudaram (agenda, entradas): o dia_loop recalcula. A véspera também muda com o jogo do dia seguinte."""
    n = 0
    with dia_sujos_lock:
        for d in datas:
            if isinstance(d, str) and _re_dia_iso.match(d):
                try:
                    dia_sujos.update((d, _dia_mais(d, -1)))
                    n += 1
                except ValueError:
                    pass
    if n:
        dia_wake.set()


def _agenda_por_dia():
    por = {}
    for v in _agenda_todos().values():
        if v and isinstance(v.get("data"), str):
            por.setdefault(v["data"], []).append(v)
    return por


def _ag_curto(e):
    nome = {"jogo": "Jogo", "show": "Show", "feriado": "Feriado", "fechado": "Estádio fechado", "evento": "Evento"}.get(e.get("tipo"), "Outro")
    if e.get("tipo") == "jogo":
        partes = [nome, "%s × %s" % (e.get("mandante") or "?", e.get("visitante") or "?") if (e.get("mandante") or e.get("visitante")) else "", e.get("competicao") or ""]
    else:
        partes = [nome, e.get("obs") or e.get("mandante") or ""]
    return " · ".join(str(p)[:80] for p in partes if p)[:160]


def dia_linha(dia, evs, evs_seguinte):
    """Tipo e marcas do dia (D3): fechado > jogo > show > evento > feriado > véspera > normal. Marcas guardadas separadas."""
    tipos = {e.get("tipo") for e in evs}
    wd = _dt.date.fromisoformat(dia).weekday()
    mk = {"jogo": int("jogo" in tipos), "vespera": int(any(e.get("tipo") == "jogo" for e in evs_seguinte)), "feriado": int("feriado" in tipos),
          "show": int("show" in tipos), "fechado": int("fechado" in tipos), "fds": int(wd >= 5)}
    tipo = ("fechado" if mk["fechado"] else "jogo" if mk["jogo"] else "show" if mk["show"] else "evento" if tipos & {"evento", "outro"}
            else "feriado" if mk["feriado"] else "vespera" if mk["vespera"] else "normal")
    evs = sorted(evs, key=lambda e: (str(e.get("hora") or ""), str(e.get("tipo"))))
    return {"dia": dia, "tipo": tipo, "marcas": mk, "eventos": [_ag_curto(e) for e in evs][:5]}


def _dia_vendas(dia):
    """D6: vale o servidor do ponto (resumo do dia com vendas ou sessões); senão a Roverpix do dia; senão None (sem operação)."""
    def ler(p):
        try:
            with open(p, encoding="utf8") as f:
                j = json.load(f)
            return j if isinstance(j, dict) else None
        except Exception:
            return None
    n = lambda v: int(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0
    r = lambda v: float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0
    m = ler(os.path.join(MET_DIR, dia + ".json"))
    if m and (n(m.get("vendas")) > 0 or n(m.get("sessoes")) > 0):
        on = m.get("online") if isinstance(m.get("online"), dict) else {}
        return {"fonte_vendas": "eterna", "vendas": n(m.get("vendas")) + n(on.get("vendas")), "receita": round(r(m.get("faturamento")) + r(on.get("faturamento")), 2),
                "fotos": n(m.get("fotos")), "sessoes": n(m.get("sessoes")), "sessoes_com_venda": n(m.get("sessoes_com_venda"))}
    rv = ler(os.path.join(ROVER_DIR, "agg", dia + ".json"))
    d = rv.get("daily") if rv and isinstance(rv.get("daily"), dict) else None
    if d:
        return {"fonte_vendas": "roverpix", "vendas": n(d.get("sales")), "receita": round(r(d.get("revenue")), 2), "fotos": n(d.get("photos")),
                "sessoes": n(d.get("approaches")), "sessoes_com_venda": n(d.get("converted"))}
    return {"fonte_vendas": None, "vendas": None, "receita": None, "fotos": None, "sessoes": None, "sessoes_com_venda": None}


def _dia_entradas(de, ate):
    """D5: catraca > total da bilheteria > bip. {dia: (total, fonte)}."""
    por = {}
    for d, o, n in op_ler("select dia, origem, count(*) from entrada where dia >= ? and dia <= ? group by dia, origem", (de, ate)):
        por.setdefault(d, {})[o] = int(n)
    for d, o, n in op_ler("select dia, origem, total from entrada_total where dia >= ? and dia <= ?", (de, ate)):
        por.setdefault(d, {})[o] = int(n)
    out = {}
    for d, x in por.items():
        for f in ("catraca", "bilheteria", "bip"):
            if x.get(f) is not None:
                out[d] = (x[f], f)
                break
    return out


DIA_COLS = ("dia", "tipo", "jogo", "vespera", "feriado", "show", "fechado", "fds", "eventos", "fonte_vendas", "vendas", "receita", "fotos",
            "sessoes", "sessoes_com_venda", "entradas", "entradas_fonte", "clima", "calc_em", "v")
DIA_VENDAS = ("fonte_vendas", "vendas", "receita", "fotos", "sessoes", "sessoes_com_venda")


def dia_consolidar(dias):
    """Recalcula e grava as linhas (upsert). Nunca zera uma fonte que sumiu: sem arquivo de vendas, a linha mantém os
    números que já tinha (critério 15)."""
    hoje = _ff_hoje()
    dias = sorted({d for d in dias if isinstance(d, str) and _re_dia_iso.match(d) and DIA_DESDE <= d <= hoje})
    if not dias:
        return 0
    por = _agenda_por_dia()
    ent = _dia_entradas(dias[0], dias[-1])
    em = _iso()
    linhas = []
    for d in dias:
        l = dia_linha(d, por.get(d, []), por.get(_dia_mais(d, 1), []))
        l.update(_dia_vendas(d))
        l["entradas"], l["entradas_fonte"] = ent.get(d, (None, None))
        linhas.append(l)
    with op_lock:
        db = operacao_db()
        try:
            with db:
                for l in linhas:
                    old = db.execute("select fonte_vendas, vendas, receita, fotos, sessoes, sessoes_com_venda from dia where dia = ?", (l["dia"],)).fetchone()
                    if old and old[0] and not l["fonte_vendas"]:
                        l.update(dict(zip(DIA_VENDAS, old)))
                    mk = l["marcas"]
                    db.execute("insert or replace into dia (%s) values (%s)" % (", ".join(DIA_COLS), ", ".join("?" * len(DIA_COLS))),
                               (l["dia"], l["tipo"], mk["jogo"], mk["vespera"], mk["feriado"], mk["show"], mk["fechado"], mk["fds"],
                                json.dumps(l["eventos"], ensure_ascii=False), l["fonte_vendas"], l["vendas"], l["receita"], l["fotos"],
                                l["sessoes"], l["sessoes_com_venda"], l["entradas"], l["entradas_fonte"], None, em, 1))
        finally:
            db.close()
    return len(linhas)


def dia_completo(pausa=0.2):
    """De DIA_DESDE até hoje (no máximo DIA_MAX_RODADA dias), de 50 em 50 com pausa curta (risco 6)."""
    hoje = _ff_hoje()
    if hoje < DIA_DESDE:
        return 0
    dias, d = [], DIA_DESDE
    while d <= hoje:
        dias.append(d)
        d = _dia_mais(d, 1)
    dias = dias[-DIA_MAX_RODADA:]
    for i in range(0, len(dias), 50):
        dia_consolidar(dias[i:i + 50])
        if i + 50 < len(dias):
            time.sleep(pausa)
    dia_estado["completa"] = _iso()
    return len(dias)


def dia_loop():
    feito = None
    while True:
        hoje = _ff_hoje()
        try:
            if feito != hoje:
                dia_completo()
                feito = hoje
            with dia_sujos_lock:
                sujos = set(dia_sujos)
                dia_sujos.clear()
            dia_consolidar(sujos | {hoje, _dia_mais(hoje, -1)})
            dia_estado.update(ultima=_iso(), erro=None)
        except Exception as ex:
            dia_estado.update(erro=str(ex)[:160])
            print("  série diária: %s" % str(ex)[:160])
        if dia_wake.wait(600):
            time.sleep(3)                         # junta várias mudanças seguidas numa rodada
        dia_wake.clear()


def dias_periodo(ano):
    rs = op_ler("select %s from dia where dia >= ? and dia <= ? order by dia" % ", ".join(DIA_COLS), ("%d-01-01" % ano, "%d-12-31" % ano))
    out, calc = [], None
    for r in rs:
        x = dict(zip(DIA_COLS, r))
        try:
            ev = json.loads(x["eventos"] or "[]")
        except Exception:
            ev = []
        calc = max(calc or "", x["calc_em"] or "") or None
        out.append({"dia": x["dia"], "tipo": x["tipo"], "marcas": {k: int(x[k] or 0) for k in ("jogo", "vespera", "feriado", "show", "fechado", "fds")},
                    "eventos": ev if isinstance(ev, list) else [], **{k: x[k] for k in DIA_VENDAS}, "entradas": x["entradas"],
                    "entradas_fonte": x["entradas_fonte"], "clima": None})
    return {"ok": True, "ano": ano, "desde": DIA_DESDE, "calc_em": calc, "dias": out}


TOTAIS_MAX_DIAS = 1000


def totais_validar(body):
    """POST /ponto/entradas/totais: (origem, [(dia, total)], recusados, arquivo, por) ou (None, motivo)."""
    if not isinstance(body, dict) or body.get("origem") != "bilheteria":
        return None, "origem inválida"
    dias = body.get("dias")
    if not isinstance(dias, list) or not dias or len(dias) > TOTAIS_MAX_DIAS:
        return None, "dias inválidos (de 1 a %d)" % TOTAIS_MAX_DIAS
    hoje, bons, rec = _ff_hoje(), {}, []
    for i, x in enumerate(dias):
        d = x.get("dia") if isinstance(x, dict) else None
        t = x.get("total") if isinstance(x, dict) else None
        if not isinstance(d, str) or not _re_dia_iso.match(d):
            rec.append({"i": i, "motivo": "dia inválido"})
            continue
        try:
            _dt.date.fromisoformat(d)
        except ValueError:
            rec.append({"i": i, "motivo": "dia inválido"})
            continue
        if d < "%d-01-01" % AGENDA_DESDE or d > hoje:
            rec.append({"i": i, "motivo": "dia fora do intervalo"})
            continue
        if not isinstance(t, int) or isinstance(t, bool) or not 0 <= t <= 100000:
            rec.append({"i": i, "motivo": "total inválido (inteiro de 0 a 100.000)"})
            continue
        bons[d] = t
    limpa = lambda v, n: re.sub(r"[<>\\/\x00-\x1f]", "", str(v or ""))[:n]
    return ("bilheteria", sorted(bons.items()), rec, limpa(body.get("arquivo"), 80), limpa(body.get("por"), 60)), None


def totais_gravar(origem, itens, rec, arquivo, por):
    """Substitui dia e origem; registra a importação (mesma tabela da v92)."""
    iid = "imp_" + secrets.token_hex(6)
    with op_lock:
        db = operacao_db()
        try:
            with db:
                db.executemany("insert or replace into entrada_total values (?,?,?,?)", [(d, origem, t, iid) for d, t in itens])
                db.execute("insert into importacao values (?,?,?,?,?,?,?,?)",
                           (iid, _iso(), por, arquivo, origem, json.dumps([d for d, _ in itens][:1000]), len(itens), len(rec)))
        finally:
            db.close()
    dia_marcar([d for d, _ in itens])
    return {"ok": True, "aceitos": len(itens), "recusados": rec[:200], "importacao": iid}


def config_do_cadastro(email):
    """O servidor ainda não confere quem está logado (pendência desde a v78; login real no plano de 04/11). Até lá, a
    chave da API-Football só é aceita com o e-mail de alguém que o cadastro do servidor marca como ativo e com
    Configurações em Alterar (Eduardo, 10/11: o painel fica em Configurações). Barreira, não autenticação.
    Devolve o nome (para a situação da fonte) ou None."""
    e = str(email or "").strip().lower()
    if not e or len(e) > 200:
        return None
    for (v,) in estado_db_ler("usuarios"):
        try:
            u = json.loads(v)
        except Exception:
            continue
        if not isinstance(u, dict) or str(u.get("email") or "").strip().lower() != e or u.get("active") is False or u.get("deleted"):
            continue
        p = u.get("perms") if isinstance(u.get("perms"), dict) else {}
        if isinstance(p.get("configuracao"), dict) and p["configuracao"].get("u") is True:
            return re.sub(r"[<>\x00-\x1f]", "", str(u.get("name") or e))[:60]
    return None


# Rotas da v97 (deny-by-default): toda rota declara a guarda; guarda desconhecida = 403. Todas em rota_privada (sem CORS
# aberto), com o Host e a origem do agente (posto + origem_local) e no-store. "gravar" exige X-Eterna: 1 e limite por
# minuto; "config" exige também o e-mail de alguém com Configurações em Alterar no cadastro do servidor (config_do_cadastro).
#   (método, caminho): (guarda, método do H, pedidos por minuto por IP, corpo máximo)
AGENDA_ROTAS = {
    ("GET", "/estatisticas/dias"): ("ler", "r_estatisticas_dias", 0, 0),
    ("GET", "/agenda/status"): ("ler", "r_agenda_status", 0, 0),
    ("POST", "/agenda/atualizar"): ("gravar", "r_agenda_atualizar", 1, 1024),
    ("POST", "/ponto/entradas/totais"): ("gravar", "r_entradas_totais", 30, 256 * 1024),
    ("POST", "/agenda/fonte"): ("config", "r_agenda_fonte", 10, 4096),
    ("POST", "/agenda/testar"): ("config", "r_agenda_testar", 1, 1024),
}
AGENDA_ROTAS_PATHS = frozenset(p for _, p in AGENDA_ROTAS)


def rota_privada(path):
    """Rotas que expõem fotos, o índice de rostos ou o faturamento da Roverpix: sem CORS aberto.
    v80: /roverpix/* (vendas, vendedores, códigos de cartão), /metricas, /ftp-remoto/* e /photoroom/status só para a origem
    do agente e ETERNA_APP_ORIGIN."""
    return path.startswith("/auth/") or path in ("/biblioteca", "/metricas", "/metricas/dia", "/ponto/docs", "/ponto/docs/revs", "/ponto/impressoes", "/ponto/entradas", "/ponto/entradas/importacoes", "/photoroom/status", "/recorte", "/impressao/miniatura", "/sessoes") or path.startswith(("/thumb/", "/file/", "/rostos/", "/roverpix/", "/ftp-remoto/", "/nuvem/", "/recorte/")) or path in AGENDA_ROTAS_PATHS


class H(BaseHTTPRequestHandler):
    timeout = 20            # conexão que declara corpo e não manda não prende uma thread para sempre

    def log_message(self, *a):
        pass

    def origens_ok(self, path):
        locais = ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT)
        if path.startswith("/rostos/"):
            return locais
        # o app publicado (https://eterna.photo) lê a biblioteca do agente; os endereços de ETERNA_ORIGENS (postos e
        # Tailscale, configurados no próprio servidor) usam as telas da equipe, inclusive Biblioteca e FTP do estádio
        return locais + (APP_ORIGIN.rstrip("/"),) + tuple(ORIGENS_REDE)

    def origem_privada_ok(self, path):
        o = self.headers.get("Origin")
        if path.startswith(("/rostos/", "/nuvem/")):
            return self.origem_local()
        host = (self.headers.get("Host") or "").lower()
        if path.startswith("/thumb/") and host in ORIGENS_REDE_HOSTS:
            # v87 (risco 4): a TV aberta pelo endereço de ETERNA_ORIGENS vê as miniaturas (só /thumb/, não o original)
            return not o or o in ORIGENS_REDE
        # contra DNS rebinding: o Host precisa ser o do agente (127.0.0.1, localhost ou o IP da rede com ETERNA_REDE)
        if not host_ok(host):
            return False
        return not o or o in self.origens_ok(path)

    def origens_aceitas(self):
        """Origin aceita fora das rotas públicas: a do próprio agente (pelo Host pedido), ETERNA_ORIGENS e ETERNA_APP_ORIGIN."""
        host = (self.headers.get("Host") or "").lower()
        return {"http://" + host, "https://" + host, "http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT} | ORIGENS_REDE | {APP_ORIGIN.rstrip("/").lower()}

    def cors(self):
        """CORS aberto (*) só na galeria do cliente (/g/); as outras rotas só para as origens aceitas, sem cabeçalho livre."""
        path = urlparse(self.path).path
        if path.startswith("/g/"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            return
        o = (self.headers.get("Origin") or "").rstrip("/").lower()
        if o and o in self.origens_aceitas() and (o in ORIGENS_REDE or not path.startswith(("/fila-fotografo", "/visitas"))):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Eterna")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def autoriza(self, metodo):
        """Primeira coisa de do_GET e do_POST: aplica ROTAS. True = o pedido segue; False = a resposta já foi dada."""
        self.__dict__.pop("_eu", None)
        self.__dict__.pop("_posto", None)
        regra = rota_regra(metodo, urlparse(self.path).path)
        if regra is None:
            self.js({"error": "not found"}, 404)
            return False
        tipo, mods = regra
        if tipo == "publica":
            return True
        if tipo == "teste" and not os.environ.get("ETERNA_TESTE_CARGA"):
            self.js({"error": "not found"}, 404)       # fora do teste de carga, a rota não existe
            return False
        o = (self.headers.get("Origin") or "").rstrip("/").lower()
        if not host_ok((self.headers.get("Host") or "").lower()) or (o and o not in self.origens_aceitas()) \
                or (metodo == "POST" and self.headers.get("X-Eterna") != "1"):
            self.js({"erro": "origem"}, 403, True)
            return False
        eu = self.sessao()
        if tipo == "teste":
            pode = bool(eu) and auth_pode(eu["cadastro"], "configuracao", "u")
        else:
            pode = bool(eu) and (not mods or any(auth_pode(eu["cadastro"], *x.split(".")) for x in mods))
        if pode or (tipo == "posto_ou_sessao" and self.posto_atual()):
            return True
        if eu:
            self.js({"erro": "sem_permissao"}, 403, True)
        else:
            self.js({"erro": "sem_sessao"}, 401, True)
        return False

    def do_OPTIONS(self):
        p = urlparse(self.path).path
        self.send_response(204 if rota_regra("GET", p) or rota_regra("POST", p) else 404)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def js(self, obj, code=200, nostore=False):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if nostore:
            self.send_header("Cache-Control", "no-store")
        cookie = self.__dict__.pop("cookie_novo", None)
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def cookie_val(self, nome):
        for parte in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = parte.strip().partition("=")
            if k == nome:
                return v
        return None

    def auth_token(self):
        return self.cookie_val(AUTH_COOKIE)

    def auth_cookie(self, token, idade, nome=AUTH_COOKIE):
        https = (self.headers.get("X-Forwarded-Proto") or "").lower() == "https"
        self.cookie_novo = "%s=%s; Path=/; HttpOnly; SameSite=Strict; Max-Age=%d%s" % (nome, token, idade, "; Secure" if https else "")

    def sessao(self):
        """A pessoa conectada neste pedido (cookie eterna_sessao), lida uma vez por pedido."""
        if "_eu" not in self.__dict__:
            self._eu = auth_quem(self.auth_token())
        return self._eu

    def posto_atual(self):
        """O posto pareado deste aparelho (cookie eterna_posto), lido uma vez por pedido."""
        if "_posto" not in self.__dict__:
            self._posto = posto_quem(self.cookie_val(POSTO_COOKIE), self.client_address[0])
        return self._posto

    def html(self, texto, code=200):
        body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Eterna</title>"
                "<body style='font-family:system-ui;padding:32px;max-width:520px'>%s</body>" % texto).encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        cookie = self.__dict__.pop("cookie_novo", None)
        if cookie is not None:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def postos_get(self, u, q):
        """GET /postos/eu (o posto deste aparelho), GET /postos (lista, configuracao.r), GET /postos/aceitar?c= (link de uso único)."""
        if not host_ok((self.headers.get("Host") or "").lower()):
            return self.js({"erro": "origem"}, 403)
        if u.path == "/postos/eu":
            p = self.posto_atual()
            if not p:
                # aparelho da rede do ponto com um Admin conectado: vira posto sozinho, sem parear (Ronaldo, 10/11).
                # Só Admin (configuracao.u): o cookie de posto abre rotas da venda; fotógrafo no celular pela Wi-Fi não vira posto (Eduardo, 10/11).
                eu = self.sessao()
                if not eu:
                    return self.js({"erro": "sem_posto"}, 401, True)
                try:
                    ip_srv = self.connection.getsockname()[0]
                except OSError:
                    ip_srv = ""
                ip = self.client_address[0]
                if not posto_auto_ok(ip, ip_srv):
                    return self.js({"ok": True, "posto": None, "remoto": True}, 200, True)   # acesso remoto: sem posto, sem bloquear
                if not auth_pode(eu["cadastro"], "configuracao", "u"):
                    return self.js({"erro": "sem_posto"}, 401, True)
                chave, agora = (eu["usuario"], _sha(self.auth_token() or ""), "auto"), time.time()
                with posto_par_lock:             # várias janelas do mesmo navegador ao mesmo tempo: um posto só
                    for k in [k for k, v in posto_recentes.items() if agora - v[0] > POSTO_REPETIDO_S]:
                        posto_recentes.pop(k, None)
                    if chave in posto_recentes and posto_ativo(posto_recentes[chave][2]["id"]):
                        _, token, p = posto_recentes[chave]
                    elif not posto_auto_cota(eu["usuario"], ip):
                        return self.js({"erro": "limite_postos"}, 429, True)
                    else:
                        token, p = posto_criar(None, "auto:" + eu["usuario"], ip, self.headers.get("User-Agent") or "?")
                        p = dict(p, auto=True)
                        posto_recentes[chave] = (agora, token, p)
                self.auth_cookie(token, POSTO_AUTO_IDADE, POSTO_COOKIE)
            elif p.get("auto"):
                self.auth_cookie(self.cookie_val(POSTO_COOKIE), POSTO_AUTO_IDADE, POSTO_COOKIE)   # cada uso renova os 30 dias
            return self.js({"ok": True, "posto": p}, 200, True)
        if u.path == "/postos/aceitar":
            # abrir o link (ou a prévia do WhatsApp) só mostra o botão; o código é gasto no POST do botão
            c = (q.get("c") or [""])[0]
            nome = posto_convite_ver(c)
            if not nome:
                return self.html("<h2>Link vencido ou já usado</h2><p>Gere outro no servidor do ponto.</p>", 410)
            return self.html("<h2>Parear este aparelho</h2><p>Este aparelho vai virar o posto <b>%s</b>.</p><form method='post' action='/postos/aceitar'>"
                             "<input type='hidden' name='c' value='%s'><button type='submit' style='font-size:18px;padding:10px 18px'>Parear este aparelho</button></form>"
                             % (nome, re.sub(r"[^A-Za-z0-9_-]", "", c)))
        if u.path == "/postos":
            eu = self.sessao()
            if not eu:
                return self.js({"erro": "sem_sessao"}, 401, True)
            if not auth_pode(eu["cadastro"], "configuracao", "r"):
                return self.js({"erro": "sem_permissao"}, 403, True)
            return self.js({"ok": True, "postos": posto_lista()}, 200, True)
        return self.js({"error": "not found"}, 404)

    def postos_aceitar_post(self):
        """POST /postos/aceitar (botão da página do link): gasta o código de uso único e grava o cookie do posto."""
        o = (self.headers.get("Origin") or "").rstrip("/").lower()
        if not host_ok((self.headers.get("Host") or "").lower()) or (o and o not in self.origens_aceitas()):
            return self.js({"erro": "origem"}, 403)
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if not 0 < n <= 512:
            return self.html("<h2>Pedido inválido</h2>", 400)
        c = (parse_qs(self.rfile.read(n).decode("utf-8", "replace")).get("c") or [""])[0]
        nome = posto_convite_usar(c)
        if not nome:
            return self.html("<h2>Link vencido ou já usado</h2><p>Gere outro no servidor do ponto.</p>", 410)
        token, p = posto_criar(nome, "convite", self.client_address[0])
        self.auth_cookie(token, POSTO_IDADE, POSTO_COOKIE)
        return self.html("<h2>Aparelho pareado</h2><p>Este aparelho agora é o posto <b>%s</b> (P%d).</p><p><a href='/#loja'>Abrir o Checkout</a> · <a href='/'>Abrir o Eterna</a></p>"
                         % (p["nome"], p["num"]))

    def postos_post(self, u):
        """POST /postos/parear {nome} (grava o cookie deste aparelho) e POST /postos/revogar {id}: sessão com configuracao.u."""
        if not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"erro": "origem"}, 403)
        eu = self.sessao()
        if not eu:
            return self.js({"erro": "sem_sessao"}, 401, True)
        if not auth_pode(eu["cadastro"], "configuracao", "u"):
            return self.js({"erro": "sem_permissao"}, 403, True)
        b, err = self.corpo(4096)
        if err:
            return self.js({"erro": "pedido"}, err, True)
        if u.path == "/postos/parear":
            nome = posto_nome_ok(b.get("nome"))
            if not nome:
                return self.js({"erro": "nome"}, 400, True)
            chave, agora = (eu["usuario"], _sha(self.auth_token() or ""), nome), time.time()
            with posto_par_lock:                 # clique repetido (mesmo login deste navegador e mesmo nome em 15 s): o mesmo posto, sem criar outro
                for k in [k for k, v in posto_recentes.items() if agora - v[0] > POSTO_REPETIDO_S]:
                    posto_recentes.pop(k, None)
                if chave in posto_recentes and not posto_ativo(posto_recentes[chave][2]["id"]):
                    posto_recentes.pop(chave, None)
                if chave in posto_recentes:
                    _, token, p = posto_recentes[chave]
                else:
                    token, p = posto_criar(nome, eu["usuario"], self.client_address[0])
                    posto_recentes[chave] = (agora, token, p)
            self.auth_cookie(token, POSTO_IDADE, POSTO_COOKIE)
            return self.js({"ok": True, "posto": p}, 200, True)
        if u.path == "/postos/revogar":
            if not posto_revogar(b.get("id"), eu["usuario"], self.client_address[0]):
                return self.js({"erro": "not found"}, 404, True)
            return self.js({"ok": True}, 200, True)
        return self.js({"error": "not found"}, 404)

    def auth_get(self):
        """GET /auth/eu: quem está conectado neste navegador. GET /auth/senhas: quem tem senha, para quem pode Ver em Senhas de acesso."""
        if not self.posto() or not self.origem_local():
            return self.js({"error": "origem não autorizada"}, 403)
        eu = auth_quem(self.auth_token())
        if not eu:
            return self.js({"erro": "sem_sessao"}, 401, True)
        if urlparse(self.path).path == "/auth/senhas":
            if not auth_pode(eu["cadastro"], "senhas", "r"):
                return self.js({"erro": "sem_permissao"}, 403, True)
            return self.js({"ok": True, "senhas": auth_senhas()}, 200, True)
        return self.js(dict(eu, ok=True), 200, True)

    def auth_post(self, u):
        """POST /auth/entrar, /auth/trocar, /auth/sair, /auth/esqueci, /auth/senha/gerar, /auth/senha/cancelar. Respostas sem cache; a senha nunca vai para log."""
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"error": "origem não autorizada"}, 403)
        b, err = self.corpo(4096)
        if err:
            return self.js({"erro": "pedido"}, err, True)
        ip = self.client_address[0]
        usuario = str(b.get("usuario") or "").strip().lower()
        if u.path == "/auth/sair":
            token = self.auth_token()
            if token:
                with estado_lock:
                    db = auth_db()
                    try:
                        db.execute("delete from sessao_login where token=?", (hashlib.sha256(token.encode()).hexdigest(),))
                        db.commit()
                    finally:
                        db.close()
            self.auth_cookie("", 0)
            return self.js({"ok": True}, 200, True)
        if u.path == "/auth/esqueci":
            if AUTH_ID.match(usuario):                  # em segundo plano: a resposta e o tempo são os mesmos para qualquer usuário
                threading.Thread(target=auth_esqueci, args=(usuario, ip), daemon=True).start()
            return self.js({"ok": True}, 200, True)
        if u.path in ("/auth/senha/gerar", "/auth/senha/cancelar"):
            eu = auth_quem(self.auth_token())
            if not eu:
                return self.js({"erro": "sem_sessao"}, 401, True)
            if not AUTH_ID.match(usuario) or usuario == eu["usuario"]:
                return self.js({"erro": "usuario"}, 400, True)
            cad, tem = auth_ler_cadastro(usuario)
            if auth_acessos(cad) - auth_acessos(eu["cadastro"]):
                return self.js({"erro": "alvo_maior"}, 403, True)    # senão, quem gera senha entraria como alguém com mais acesso
            if u.path == "/auth/senha/gerar":
                if not auth_pode(eu["cadastro"], "senhas", "u" if tem else "c"):
                    return self.js({"erro": "sem_permissao"}, 403, True)
                if not cad:
                    return self.js({"erro": "sem_cadastro"}, 404, True)
                return self.js({"ok": True, "usuario": usuario, "senha": auth_criar(usuario, eu["usuario"], ip)}, 200, True)
            if u.path == "/auth/senha/cancelar":
                if not auth_pode(eu["cadastro"], "senhas", "d"):
                    return self.js({"erro": "sem_permissao"}, 403, True)
                auth_remover(usuario, eu["usuario"], ip)
                return self.js({"ok": True}, 200, True)
            return self.js({"erro": "pedido"}, 400, True)
        senha = str(b.get("senha") or "")
        if not AUTH_ID.match(usuario) or not 0 < len(senha) <= 200:
            return self.js({"erro": "incorreto"}, 401, True)
        situacao, dados = auth_conferir(usuario, senha, ip)
        if situacao == "bloqueado":
            return self.js({"erro": "bloqueado"}, 429, True)
        if situacao == "nao":
            return self.js({"erro": "incorreto"}, 401, True)
        if u.path == "/auth/trocar":
            nova = str(b.get("nova") or "")
            motivo = "repete_atual" if nova == senha else "longa" if len(nova) > 200 else auth_senha_fraca(usuario, (dados["cadastro"] or {}).get("name"), nova)
            if motivo:
                return self.js({"erro": "fraca", "motivo": motivo}, 400, True)
            auth_trocar(usuario, nova, ip)
            situacao = "ok"
        elif situacao == "provisoria":
            return self.js({"ok": False, "troca": True}, 200, True)
        self.auth_cookie(auth_sessao_nova(usuario), AUTH_SESSAO)
        return self.js(dict(dados, ok=True), 200, True)

    def ff_funcao_post(self):
        """v87: POST /fila-fotografo/funcao {dia, map}: a função do dia vinda da Escala. Posto + origem + X-Eterna: 1,
        limite por minuto, chaves cadastradas e campos fechados. Grava ~/Eterna/ponto/funcao.json (600)."""
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"error": "origem não autorizada"}, 403)
        if not limite_ok(self.client_address[0], "ff-funcao", 30):
            return self.js({"error": "muitos pedidos"}, 429)
        body, err = self.corpo(4096)
        if err:
            return self.js({"error": "corpo inválido"}, err)
        v = ff_funcao_validar(body)
        if not v:
            return self.js({"error": "função inválida"}, 400)
        dia, mp, ignoradas = v
        os.makedirs(os.path.dirname(FF_FUNCAO), exist_ok=True)
        with ff_lock:                    # N2: dois POSTs ao mesmo tempo não disputam o mesmo .tmp (o lock não é pego aqui)
            _grava_privado(FF_FUNCAO, json.dumps({"dia": dia, "map": mp, "em": time.strftime("%Y-%m-%dT%H:%M:%S")}))
            ff_funcao.update(dia=dia, map=mp)
        print("  função do dia atualizada por %s" % ("este computador" if self.loopback() else "posto " + self.client_address[0]))
        return self.js({"ok": True, "ignoradas": ignoradas})


    def visitas_post(self, acao):
        """v97: POST /visitas/juntar {a, b, por, posto} e /visitas/separar {card, por, posto} do Posto de venda. Posto +
        origem + X-Eterna: 1 + 30 por minuto; só levas de hoje; registro em ~/Eterna/ponto/visitas-log.jsonl."""
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"error": "origem não autorizada"}, 403)
        if not limite_ok(self.client_address[0], "visitas", 30):
            return self.js({"error": "muitos pedidos"}, 429)
        body, err = self.corpo(4096)
        if err:
            return self.js({"error": "corpo inválido"}, err)
        try:
            r, cod = vis_acao(acao, body, self.client_address[0])
        except Exception as ex:
            print("  visitas: %s" % str(ex)[:120])
            return self.js({"error": "erro no servidor"}, 500)
        return self.js(r, cod, nostore=True)

    def visitas_config_post(self):
        """B1: POST /visitas/config {rosto: bool, por, posto}: liga ou desliga a ligação automática por rosto. Posto +
        origem + X-Eterna: 1 + 10 por minuto, corpo só com rosto booleano. O app só mostra o interruptor ao Admin."""
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"error": "origem não autorizada"}, 403)
        if not limite_ok(self.client_address[0], "visitas-config", 10):
            return self.js({"error": "muitos pedidos"}, 429)
        body, err = self.corpo(1024)
        if err:
            return self.js({"error": "corpo inválido"}, err)
        if not isinstance(body, dict) or not isinstance(body.get("rosto"), bool):
            return self.js({"error": "rosto deve ser true ou false"}, 400)
        try:
            r = vis_cfg_gravar(body["rosto"], body.get("por"), body.get("posto"), self.client_address[0])
        except Exception as ex:
            print("  visitas: config %s" % str(ex)[:120])
            return self.js({"error": "erro no servidor"}, 500)
        return self.js(r, 200, nostore=True)

    def entradas_post(self):
        try:
            return self._entradas_post()
        except Exception as ex:
            print("  entradas: %s" % str(ex)[:120])
            return self.js({"error": "erro no servidor"}, 500)


    def _entradas_post(self):
        """v92: POST /ponto/entradas {origem, dia, seg:[...], arquivo, por}: entradas da bilheteria (bip ou catraca) de um dia,
        só segundos do dia (o CSV fica no navegador). Substitui o mesmo dia e origem. Até 1 MB e 50.000 entradas."""
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            return self.js({"error": "origem não autorizada"}, 403)
        if not limite_ok(self.client_address[0], "entradas", 30):
            return self.js({"error": "muitos pedidos"}, 429)
        body, err = self.corpo(1024 * 1024)
        if err:
            return self.js({"error": "corpo inválido"}, err)
        v, motivo = entradas_validar(body)
        if v is None:
            return self.js({"error": motivo}, 400)
        return self.js(entradas_gravar(*v), nostore=True)

    # ---------- v97: agenda automática e série diária (rotas em AGENDA_ROTAS, deny-by-default) ----------
    def agenda_rota(self, metodo, path):
        guarda, nome, por_min, corpo_max = AGENDA_ROTAS[(metodo, path)]
        try:
            if guarda not in ("ler", "gravar", "config") or not self.posto() or not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403, nostore=True)
            body, quem = None, None
            if guarda != "ler":
                if self.headers.get("X-Eterna") != "1":
                    return self.js({"error": "origem não autorizada"}, 403, nostore=True)
                if not limite_ok(self.client_address[0], nome, por_min):
                    return self.js({"error": "muitos pedidos"}, 429, nostore=True)
                body, err = self.corpo(corpo_max)
                if err:
                    return self.js({"error": "corpo inválido"}, err, nostore=True)
            if guarda == "config":
                quem = config_do_cadastro(body.get("quem"))
                if not quem:
                    return self.js({"error": "sem_permissao"}, 403, nostore=True)
            return getattr(self, nome)(body, quem)
        except Exception as ex:
            print("  %s: %s" % (path, type(ex).__name__))
            return self.js({"error": "erro no servidor"}, 500, nostore=True)

    def r_estatisticas_dias(self, body, quem):
        try:
            ano = int((parse_qs(urlparse(self.path).query).get("ano") or [""])[0])
        except ValueError:
            ano = 0
        if not 2000 <= ano <= int(_ff_hoje()[:4]):
            return self.js({"error": "ano inválido"}, 400, nostore=True)
        return self.js(dias_periodo(ano), nostore=True)

    def r_agenda_status(self, body, quem):
        return self.js(agenda_status(), nostore=True)

    def r_agenda_atualizar(self, body, quem):
        if not af_cfg():
            return self.js({"ok": False, "error": "sem_chave"}, 409, nostore=True)
        ja = bool(agenda_fonte.get("rodando"))
        agenda_wake.set()
        return self.js({"ok": True, "ja_rodando": ja}, nostore=True)

    def r_entradas_totais(self, body, quem):
        v, motivo = totais_validar(body)
        if v is None:
            return self.js({"error": motivo}, 400, nostore=True)
        return self.js(totais_gravar(*v), nostore=True)

    def r_agenda_fonte(self, body, quem):
        """{acao: "salvar", chave} ou {acao: "remover"}. A resposta nunca traz a chave; o console registra quem, sem a chave."""
        de = "este computador" if self.loopback() else "posto " + self.client_address[0]
        if os.environ.get(AF_ENV, "").strip():
            return self.js({"ok": False, "error": "chave_no_servidor"}, 409, nostore=True)
        acao = body.get("acao")
        if acao == "remover":
            af_remover()
            print("  agenda: chave da API-Football removida por %s (%s)" % (quem, de))
            return self.js({"ok": True, "chave": False}, nostore=True)
        chave = body.get("chave")
        if acao != "salvar" or not isinstance(chave, str) or not _re_af_chave.match(chave.strip()):
            return self.js({"ok": False, "error": "chave_invalida"}, 400, nostore=True)
        troca = bool(af_cfg())
        af_salvar(chave.strip(), quem)
        print("  agenda: chave da API-Football %s por %s (%s)" % ("trocada" if troca else "salva", quem, de))
        agenda_wake.set()
        return self.js({"ok": True, "chave": True, "final": chave.strip()[-4:]}, nostore=True)

    def r_agenda_testar(self, body, quem):
        if not af_cfg():
            return self.js({"ok": False, "error": "sem_chave"}, 409, nostore=True)
        return self.js(agenda_testar(), nostore=True)

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

    def fotos_enviar_post(self):
        """POST /fotos/enviar?nome=&quem=: uma foto (o JPEG é o corpo) vinda da tela de Upload. Vale o módulo de Upload da
        pessoa conectada. O dono é sempre o fotógrafo do login; só quem não é fotógrafo escolhe de quem é a leva."""
        tam = self.headers.get("Content-Length") or ""
        n = int(tam) if tam.isdigit() else -1
        erro = None
        if not self.posto() or not self.origem_local() or self.headers.get("X-Eterna") != "1":
            erro = ({"error": "origem não autorizada"}, 403)
        else:
            eu = auth_quem(self.auth_token())
            if not eu:
                erro = ({"erro": "sem_sessao"}, 401)
            elif not auth_pode(eu["cadastro"], "set", "c"):
                erro = ({"erro": "sem_permissao"}, 403)
            elif n <= 0 or n > FOTO_ENVIO_MAX:
                erro = ({"erro": "tamanho"}, 413)
        q = parse_qs(urlparse(self.path).query)
        nome = re.sub(r"[^\w.\- ]", "_", os.path.basename((q.get("nome") or [""])[0].replace("\\", "/")))[-120:]
        if not erro and (not nome.endswith(EXT) or nome.startswith(".")):
            erro = ({"erro": "formato"}, 415)
        if erro:
            self.close_connection = True           # o corpo não foi lido: esta conexão não serve para o próximo pedido
            return self.js(erro[0], erro[1], True)
        cad = eu["cadastro"]
        quem = (q.get("quem") or [""])[0]
        quem = cad.get("key") or (quem if quem in PHOTOGRAPHERS else "") or cad.get("email") or "upload"
        os.makedirs(FTPTMP, exist_ok=True)
        tmp = os.path.join(FTPTMP, "envio-%s.tmp" % secrets.token_hex(8))
        try:
            with open(tmp, "wb") as f:
                resto = n
                while resto > 0:
                    ch = self.rfile.read(min(1 << 20, resto))
                    if not ch:
                        break
                    f.write(ch)
                    resto -= len(ch)
            inteira = not resto and jpeg_completo(tmp, n)
            r = ingest_file(tmp, nome, os.stat(tmp), quem, "ftp", move=True) if inteira else None   # entra como a foto do FTP: mesma sessão e mesmo dono
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
        if not inteira:
            return self.js({"erro": "incompleta"}, 400, True)
        return self.js({"ok": r in ("new", "dup", "excluida"), "resultado": r or "recusada"}, 200, True)

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
        if p in ("/galerias/vendas", "/galerias/status"):
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            if p == "/galerias/vendas":
                try:
                    desde = max(0, int(q.get("desde", ["0"])[0] or 0))
                except ValueError:
                    desde = 0
                vs = vendas_ler()
                return self.js({"vendas": [{k: v.get(k) for k in ("id", "token", "sessoes", "pids", "n", "total", "metodo", "em", "canal", "todas", "teste", "itens", "meio", "idpedido")} for v in vs[desde:desde + 500]],
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
                            "estado": gal_estado(token, m), "venue": m.get("venue"), "compra": compra_online()})
        if acao == "livres" and len(partes) == 4:       # v96.1: compradas e cortesias da venda só pelo QR (sem selfie)
            if not limite_ok(ip, "livres", 30):
                return self.js({"motivo": "bloqueado"}, 429)
            if token in lapides:
                return self.js({"error": "expirada"}, 410)
            m = REPO.ler_manifesto(token)
            if not m:
                return self.js({"error": "not found"}, 404)
            if gal_expirou(m):
                return self.js({"error": "expirada"}, 410)
            return self.js({"galeria": galeria_obj(token, m)})
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
        if p == "/ponto/docs":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(8 * 1024 * 1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            body, recusados = auth_filtrar_docs(body, self.sessao(), self.client_address[0], self.posto_atual())
            return self.js(dict(estado_gravar(body, quem=self.client_address[0]), recusados=recusados))
        if p == "/ponto/eventos":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(2 * 1024 * 1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            return self.js(ev_receber(body))
        if p == "/impressao/acao":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(4096)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            return self.js(imp_acao(body))
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
                                        str(body.get("vendedor") or "")[:60], str(body.get("posto") or "")[:40], str(body.get("venda_id") or "")[:80]))
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
            velho = REPO.ler_manifesto(t) or {}
            comp = {f.get("id") for f in (velho.get("fotos") or []) if isinstance(f, dict) and f.get("direito") == "comprada"}
            try:                                       # v91 (segurança 5): depois da lápide (galeria encerrada responde 410 como antes)
                ignoradas = _gal_confere_sessoes(body.get("manifesto"), novo["fotos"], comp)
            except ValueError as ex:
                return self.js({"error": str(ex)}, 400)
            if ignoradas:
                print("  galeria: %d base(s) de IA fora do manifesto (navegador antigo)" % ignoradas)
            eu = self.sessao()
            if not (eu and auth_pode(eu["cadastro"], "galerias", "u")):
                # cortesia nova só com galerias.u; a que já está no servidor fica (republicação do Checkout)
                ja = {f["id"] for f in (REPO.ler_manifesto(t) or {}).get("fotos") or [] if f.get("direito") == "cortesia"}
                for f in novo["fotos"]:
                    if f["direito"] == "cortesia" and f["id"] not in ja:
                        f["direito"] = "venda"
                        f.pop("cortesia", None)
            with gal_lock:
                m = gal_mesclar(novo, REPO.ler_manifesto(t))
                REPO.salvar_manifesto(t, m)
                if m.get("codigo"):
                    codigos[m["codigo"]] = t
            gal_fila.put(t)
            nuvem_galeria_enfileira(t)
            vis_protege_manifesto(m)                   # v97: fora do gal_lock (pega o sess_lock)
            return self.js({"ok": True, "token": t, "estado": gal_estado(t, m), "ignoradas": ignoradas})
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
            ate = bloqueio(ip, token) or (gal_teto(token) if m["tipo"] == "sessao" else 0)
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
            if r.get("varias"):                     # não conta como tentativa: a família tenta de novo, um de cada vez
                return self.js({"ok": False, "motivo": "varias_pessoas"})
            if not r.get("rosto"):
                return self.js({"ok": False, "motivo": "sem_rosto", "restam": falhou(ip, token)})
            sims = r["sims"]
            lim = LIMITE_MENOR if m["tipo"] == "evento" or m.get("menor") else LIMITE   # v96.1: sessão de menor com o limiar de criança (como a nuvem)
            pids = {f["id"] for f in m["fotos"] if sims.get(pid_lib(f["id"]), -1) >= lim}   # as fotos em que quem fez a selfie aparece
            if not pids:                           # as compradas e cortesias da venda continuam abertas pelo QR (rota livres)
                if m["tipo"] == "sessao":
                    gal_teto_soma(token)
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
        if acao == "pagamento" and not compra_online():
            self.corpo(64 * 1024)
            return self.js({"error": "compra_indisponivel"}, 501)      # sem adquirente: compra só no balcão
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
                todas = float(m["precos"]["todas"])
                dig = float(m["precos"].get("dig") or 0) or todas
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
        if not self.autoriza("GET"):
            return
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path.startswith("/g/") or u.path in ("/galerias/vendas", "/galerias/status"):
            return self.gal_get(u, q)
        if u.path in ("/auth/eu", "/auth/senhas"):
            return self.auth_get()
        if u.path in ("/postos", "/postos/eu", "/postos/aceitar"):
            return self.postos_get(u, q)
        if ("GET", u.path) in AGENDA_ROTAS:          # v97
            return self.agenda_rota("GET", u.path)
        if rota_privada(u.path) and not self.origem_privada_ok(u.path):
            return self.js({"error": "origem não autorizada"}, 403)
        if u.path == "/status":
            minimo = {"ok": True, "agent": "eterna-agente", "version": 3, "boot": BOOT}
            o = (self.headers.get("Origin") or "").rstrip("/").lower()
            confiavel = host_ok((self.headers.get("Host") or "").lower()) and (not o or o in self.origens_aceitas())
            eu = self.sessao() if confiavel else None
            if not eu and not (confiavel and self.posto_atual()):
                return self.js(minimo, nostore=True)     # sem pessoa conectada nem aparelho pareado: só que o agente está no ar
            ss_, rs_ = sess_status(), rec_status()     # v91 (revisão C5): sess_lock e o recorte nunca dentro do lock
            ag_ = agenda_status(publico=True)          # v97: sem os 4 últimos da chave e sem quem salvou (CORS aberto)
            with lock:
                ftp_ = {k: v for k, v in state["ftp"].items() if k != "users"}
                st_ = dict(minimo, card=state["card"], copied=state["copied"], dups=state["dups"], events=len(events),
                           platform=sys.platform, ftp=ftp_,
                           rostos={**rostos, "fila": fila_rostos.qsize()}, nuvem=nuvem, backup=backup, recorte=rs_, fundos_modo=fundos_modo(),
                           galeria_publica=os.environ.get("ETERNA_GALERIA_PUBLICA") or None,
                           impressora=IMPRESSORA or None, sessoes=ss_,
                           estatisticas={"v": 2, "migracao": dict(est_migra)}, fuso=fuso_info(), agenda=ag_,
                           pagamento="teste" if compra_online() else "desligado",
                           galerias={"fila": gal_fila.qsize(), "total": len(codigos), "vitrine_marca": gal_info["vitrine_marca"] or (not SEM_OPENCV and bool(_cv.get("cv2")))})
            if eu:
                st_["impressora_locais"] = IMP_LOCAIS
            return self.js(st_, nostore=True)
        if u.path == "/sessoes":
            if not self.origem_privada_ok(u.path):
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                desde = max(0, int(q.get("desde", ["0"])[0]))
            except ValueError:
                desde = 0
            return self.js(sess_feed(desde, ontem=q.get("ontem", [""])[0] == "1"))
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
        if u.path == "/visitas":
            # v97: as visitas de hoje (levas ligadas). Este computador ou um posto pelo endereço de ETERNA_ORIGENS; sem vetor e sem pid.
            if not self.posto() or not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                desde = max(0, int(q.get("desde", ["0"])[0]))
            except ValueError:
                desde = 0
            return self.js(vis_feed(desde, ontem=q.get("ontem", [""])[0] == "1"), nostore=True)
        if u.path == "/fila-fotografo":
            # v87: painel da fila do fotógrafo (só leitura). Este computador ou um posto pelo endereço de ETERNA_ORIGENS.
            if not self.posto() or not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            return self.js(ff_json(), nostore=True)
        if u.path == "/ponto/impressoes":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            ids = ",".join(parse_qs(u.query).get("vendas") or []).split(",")
            return self.js({"ok": True, "vendas": ev_impressoes(ids)}, nostore=True)
        if u.path == "/ponto/docs/revs":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            return self.js({"ok": True, "revs": estado_revs()})
        if u.path == "/ponto/docs":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            col = (parse_qs(u.query).get("col") or [""])[0]
            if col not in ESTADO_COLS:
                return self.js({"error": "coleção inválida"}, 400)
            eu = self.sessao()
            if not eu and col not in ("sim", "config", "agenda"):
                return self.js({"erro": "sem_permissao"}, 403, True)     # aparelho pareado sem pessoa: só o que o Checkout lê
            cad = (eu or {}).get("cadastro")
            if col in ("usuarios_log", "usuarios_login") and not any(auth_pode(cad, *x.split(".")) for x in FOTOS_LER + ("usuarios.r", "permissoes.r")):
                return self.js({"erro": "sem_permissao"}, 403, True)
            r = estado_col(col)
            if col == "usuarios" and not auth_pode(cad, "usuarios", "r"):
                # sem Cadastro de usuários: o próprio cadastro inteiro; dos outros, só o nome (e o fotógrafo vinculado)
                proprio = quote(eu["usuario"], safe="-_.!~*'()")
                r["docs"] = [d if d["id"] == proprio else {"id": d["id"], "valor": {k: d["valor"].get(k) for k in ("email", "name", "key", "active") if isinstance(d["valor"], dict)}}
                             for d in r["docs"]]
            return self.js(r)
        if u.path == "/metricas/dia":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            q = parse_qs(u.query)
            hoje = _ff_hoje()
            r = metricas_periodo((q.get("de") or [hoje])[0], (q.get("ate") or [hoje])[0])
            return self.js({"ok": True, "dias": r} if r is not None else {"error": "datas inválidas"}, 200 if r is not None else 400)
        if u.path == "/ponto/entradas/importacoes":
            if not self.posto() or not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            try:
                r = entradas_importacoes()
            except Exception as ex:      # operacao.db que não abre: responde JSON (o app mostra sem conexão)
                print("  importações: %s" % str(ex)[:120])
                return self.js({"error": "erro no servidor"}, 500)
            return self.js(r, nostore=True)
        if u.path == "/impressao/fila":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            return self.js(imp_fila_json())
        if u.path == "/impressao/miniatura":
            if not self.origem_local():
                return self.js({"error": "origem não autorizada"}, 403)
            q = parse_qs(u.query)
            try:
                f = imp_miniatura(int((q.get("id") or ["0"])[0]), int((q.get("n") or ["0"])[0]))
            except ValueError:
                f = None
            return self.file(f) if f else self.js({"error": "not found"}, 404)
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
        if u.path == "/ftp/contas":
            with lock:                                   # os logins do FTP embutido (sem senha), para o cartão do Upload
                return self.js({"ok": True, "port": state["ftp"].get("port"), "ip": state["ftp"].get("ip"), "users": list(state["ftp"].get("users") or [])}, nostore=True)
        if u.path == "/ftp-remoto/status":
            c = rftp_cfg()
            return self.js({**rftp, "configurado": bool(c), "host": c and c.get("host"), "port": c and c.get("port"),
                            "user": c and c.get("user"), "dir": c and c.get("dir"), "tls": bool(c and c.get("tls"))})
        if u.path == "/photoroom/status":
            c = pr_cfg()
            eu = self.sessao()
            if not (eu and auth_pode(eu["cadastro"], "configuracao", "r")):
                return self.js({"configured": bool(c), "fundos_modo": fundos_modo()})   # Checkout e quem não configura: só se está ligado
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
            # v91 (segurança, 01/11): o /file/ (original) pela rede (ETERNA_ORIGENS) fica aceito até o pareamento da v83 etapa 2,
            # com limite por IP: FILE_TAXA por minuto. O computador do ponto (loopback) não tem limite (Checkout e pré-carga).
            if u.path.startswith("/file/") and not self.loopback() and not limite_ok(self.client_address[0], "file", FILE_TAXA):
                return self.js({"error": "muitas fotos seguidas; espere um minuto"}, 429)
            pid = u.path.rsplit("/", 1)[1]
            with lock:
                e = lib.get(pid)
            if not e:
                return self.js({"error": "not found"}, 404)
            return self.file(e["thumb"] if u.path.startswith("/thumb/") else e["file"])
        return self.app(u.path)

    def do_POST(self):
        if not self.autoriza("POST"):
            return
        u = urlparse(self.path)
        origin = self.headers.get("Origin") or ""
        if u.path in ("/auth/entrar", "/auth/trocar", "/auth/sair", "/auth/esqueci", "/auth/senha/gerar", "/auth/senha/cancelar"):
            return self.auth_post(u)
        if u.path in ("/postos/parear", "/postos/revogar"):
            return self.postos_post(u)
        if u.path == "/postos/aceitar":
            return self.postos_aceitar_post()
        if u.path.startswith(("/g/", "/pagamento/webhook/")) or u.path in ("/galerias/publicar", "/galerias/encerrar", "/imprimir", "/impressao/acao", "/ponto/eventos", "/ponto/docs", "/nuvem/reenviar", "/lgpd/excluir"):
            return self.gal_post(u)
        if u.path == "/recorte":
            return self.recorte_post()
        if u.path == "/fotos/enviar":
            return self.fotos_enviar_post()
        if ("POST", u.path) in AGENDA_ROTAS:         # v97
            return self.agenda_rota("POST", u.path)
        if u.path == "/fila-fotografo/funcao":
            return self.ff_funcao_post()
        if u.path in ("/visitas/juntar", "/visitas/separar"):
            return self.visitas_post(u.path.rsplit("/", 1)[1])
        if u.path == "/visitas/config":
            return self.visitas_config_post()
        if u.path == "/ponto/entradas":
            return self.entradas_post()
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
            # só o app aberto pelo próprio agente pode trocar a chave; o endereço da Roverpix é um dos oficiais
            if origin and origin.rstrip("/").lower() not in self.origens_aceitas():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(4096)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            key = str(body.get("api_key") or "").strip()
            if not key or len(key) > 400:
                return self.js({"error": "informe a chave"}, 400)
            base = str(body.get("base_url") or ROVER_BASES[0]).strip().rstrip("/")
            base = base[:-len("/api/v1")] if base.endswith("/api/v1") else base
            if base not in ROVER_BASES:
                return self.js({"error": "endereço da Roverpix não reconhecido"}, 400)
            rover_save_cfg(base, key)
            return self.js({"ok": True})
        if u.path == "/ftp-remoto/config":
            if origin and origin.rstrip("/").lower() not in self.origens_aceitas():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(4096)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            old = rftp_cfg() or {}
            try:
                porta_n = int(body.get("port") or 21)
            except Exception:
                return self.js({"error": "porta inválida"}, 400)
            c = {"host": str(body.get("host") or "").strip()[:200], "port": porta_n,
                 "user": str(body.get("user") or "").strip()[:200], "password": str(body.get("password") or "")[:200],
                 "dir": str(body.get("dir") or "").strip()[:300], "tls": bool(body.get("tls"))}
            if not c["host"] or not c["user"]:
                return self.js({"error": "informe servidor e usuário"}, 400)
            if porta_n not in (21, 990):
                return self.js({"error": "porta inválida: use 21 (FTP) ou 990 (FTP com TLS)"}, 400)
            if not rftp_host_ok(c["host"]):
                return self.js({"error": "servidor fora da rede do ponto: use o IP da rede interna ou cadastre o nome em ftp-remoto-hosts.txt no servidor"}, 400)
            if not limite_ok(self.client_address[0], "rftp-config", 5):
                return self.js({"error": "muitos testes seguidos; espere um minuto"}, 429)
            # v80 (segurança I5): a senha salva só vale para o mesmo servidor, porta e usuário (não manda a senha para outro host)
            mesmo = old and old.get("host") == c["host"] and int(old.get("port") or 21) == c["port"] and old.get("user") == c["user"]
            if not c["password"]:
                if not mesmo or not old.get("password"):
                    return self.js({"error": "servidor, porta ou usuário mudou: digite a senha de novo"}, 400)
                c["password"] = old["password"]
            try:
                t = rftp_connect(c)
                t.quit()
            except Exception:
                return self.js({"error": "não conectou: confira servidor, porta, usuário e senha"}, 502)
            rftp_save(c)
            return self.js({"ok": True})
        if u.path in ("/photoroom/config", "/photoroom/compose"):
            # só o app aberto pelo próprio agente usa a chave (ninguém de fora gasta os créditos)
            if origin and origin.rstrip("/").lower() not in self.origens_aceitas():
                return self.js({"error": "origem não autorizada"}, 403)
            body, err = self.corpo(4096 if u.path == "/photoroom/config" else 32 * 1024 * 1024)
            if err:
                return self.js({"error": "corpo inválido"}, err)
            if u.path == "/photoroom/config":
                key = str(body.get("api_key") or "").strip()
                if not key or len(key) > 400:
                    return self.js({"error": "informe a chave"}, 400)
                pr_save(key)
                return self.js({"ok": True, "sandbox": key.startswith("sandbox_")})
            if fundos_modo() != "photoroom":           # v84: montagem local é o padrão; o Photoroom só com o interruptor ligado
                return self.js({"ok": False, "error": "photoroom_desligado"}, 409)
            quem = (self.sessao() or {}).get("usuario") or ("posto:" + (self.posto_atual() or {}).get("id", "?"))
            if not limite_ok(quem, "photoroom-compose", PR_COMPOSE_HORA, 3600):
                return self.js({"error": "muitas montagens nesta hora; use a montagem local"}, 429)
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
                print("  photoroom: %s" % str(ex)[:160])
                return self.js({"error": "Photoroom não respondeu"}, 502)
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
                    # janela: a do Painel (estado.db); a galeria por QR manda todo:true (dia todo)
                    todo, t0 = body.get("todo") is True, time.time()
                    try:
                        r = buscar(body.get("imagens") or [], body.get("dias") or 1, 0 if todo else None)
                    except Exception as ex:
                        selfie_registra("qr" if todo else "checkout", {"error": str(ex)}, t0)
                        raise
                    selfie_registra("qr" if todo else "checkout", r, t0)
                    return self.js(r)
                return self.js(medir(body.get("sessoes") or {}))
            except Exception as ex:
                return self.js({"error": str(ex)}, 500)
        return self.js({"error": "not found"}, 404)

    # O app servido pelo próprio agente: o navegador abre http://127.0.0.1:8765 e
    # conversa com o agente na mesma origem (sem bloqueio de rede local do Chrome).
    def app(self, path):
        if path in ("", "/"):
            path = "/index.html"
        if ".." in path or (path != "/index.html" and not APP_ARQUIVO.match(path)):
            return self.js({"error": "not found"}, 404)     # só arquivos do pacote do app (pasta, nome e tipo conhecidos)
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


APP_ARQUIVO = re.compile(r"^/(img|vendor|sprites)/[A-Za-z0-9_-][A-Za-z0-9_./-]{0,150}\.(png|jpe?g|svg|webp|gif|ico|js|css|json|woff2?|wasm|onnx|txt)$")


def fuso_info():
    """Fuso do servidor: nome (TZ ou ETERNA_TZ) e deslocamento atual em minutos (−180 no Rio)."""
    lt = time.localtime()
    off = lt.tm_gmtoff if getattr(lt, "tm_gmtoff", None) is not None else -(time.altzone if lt.tm_isdst > 0 else time.timezone)
    return {"tz": os.environ.get("TZ") or "", "offset_min": int(off // 60)}


def fuso_ajusta():
    """Revisão (risco 7): o agente roda no fuso do venue. TZ = ETERNA_TZ ou America/Sao_Paulo (tzset só existe fora do
    Windows; lá vale o fuso do sistema, e o /status mostra o deslocamento para o app avisar)."""
    if hasattr(time, "tzset"):          # no Windows o TZ no formato IANA não vale (e passaria para os subprocessos)
        os.environ["TZ"] = os.environ.get("ETERNA_TZ") or "America/Sao_Paulo"
        time.tzset()


def main():
    fuso_ajusta()
    print("Eterna · agente do ponto")
    if os.environ.get("ETERNA_RECORTE_FALSO"):
        print("  ETERNA_RECORTE_FALSO ignorado: o recorte falso é só dos testes (v93, segurança S2)")
    for x in ORIGENS_SEM_ESQUEMA:
        print("  ETERNA_ORIGENS: \"%s\" ignorado (falta http:// ou https://, ex.: http://192.168.10.218:%d)" % (x, PORT))
    ff_carregar()                       # v87: grupos de hoje da fila do fotógrafo, refeitos do meta
    try:
        lidas, novas, hoje = sess_carregar()
        print(f"  Sessões: {hoje} hoje (montadas aqui, pausa de {SESS_PAUSA} s e rostos; {novas} fotos agrupadas agora)")
    except Exception as ex:
        print("  sessões: não carreguei (%s)" % str(ex)[:120])
    threading.Thread(target=sess_loop, daemon=True).start()
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
        threading.Thread(target=imp_monitor, daemon=True).start()
    threading.Thread(target=rostos_thread, daemon=True).start()
    rec_orfaos_encerrar()               # processo de recorte de uma partida anterior (agente que caiu) não segura memória
    rec_versao_cache()                  # v97: recorte de versão anterior sai antes do recorte antecipado
    threading.Thread(target=rec_pre_loop, daemon=True).start()
    threading.Thread(target=rec_ia_loop, daemon=True).start()      # v93: bases de IA recortadas na chegada
    threading.Thread(target=metricas_loop, daemon=True).start()
    threading.Thread(target=metricas_migra_v2, daemon=True).start()   # v92: resumos antigos ganham os campos v2 (só acrescenta)
    threading.Thread(target=backup_loop, daemon=True).start()
    threading.Thread(target=agenda_loop, daemon=True).start()      # v97: feriados sem clique e jogos da API-Football
    threading.Thread(target=dia_loop, daemon=True).start()         # v97: série diária (tabela dia do operacao.db)
    threading.Thread(target=pasta_vigiada, daemon=True).start()
    gal_indexar()
    threading.Thread(target=galeria_loop, daemon=True).start()
    print("  Galerias online:   %d publicadas · repositório %s · pagamento %s" % (len(codigos), type(REPO).__name__,
          "de TESTE (aprova sem cobrar)" if compra_online() else "desligado (compra só no balcão)"))
    print("  FTP do estádio:    " + (("buscando em %s@%s" % ((rftp_cfg() or {}).get("user"), (rftp_cfg() or {}).get("host"))) if rftp_cfg() else "não configurado (Eterna: Upload)"))
    _rok, _rmot = rec_estado()
    print("  Recorte local:     " + ("pronto (BiRefNet + a regra do que encosta na pessoa, num processo à parte; abre na partida)" if _rok else "indisponível: %s (rode instalar-recorte)" % _rmot))
    print("  Agenda:            feriados automáticos; jogos " + ("pela API-Football" if af_cfg() else "sem chave (Configurações › Painel de controle)"))
    print("  Roverpix:          " + ("chave configurada, sincronizando a cada 5 min" if rover_cfg() else "sem chave (configure no Eterna: Repositório)"))
    time.sleep(0.4)
    print("  insira o cartão ou mande pelo CTP. Ctrl+C para parar.\n")
    try:
        ThreadingHTTPServer(("0.0.0.0" if os.environ.get("ETERNA_REDE") else "127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--criar-admin":
        sys.exit(auth_criar_admin(sys.argv[2], " ".join(sys.argv[3:])))
    if len(sys.argv) >= 3 and sys.argv[1] == "--parear-posto":
        sys.exit(posto_parear_cli(" ".join(sys.argv[2:])))
    main()
