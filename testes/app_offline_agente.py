# v97: o agente guarda o app em disco (~/Eterna/app-cache/) e continua servindo o app e as fontes depois de reiniciar sem
# internet. Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/app_offline_agente.py agente/eterna-agente.py [porta]
# a. origem falsa com index.html e uma fonte: o agente serve os dois.
# b. origem derrubada e agente reiniciado: os dois continuam vindo do disco.
# c. travessia de caminho e extensão fora da lista: 404 e nada gravado (nem pedido à origem).
# d. poda acima do teto (módulo importado).
import importlib.util, os, random, shutil, subprocess, sys, tempfile, time, threading, http.client, http.server, json, functools

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
import socket


def livre(p):
    with socket.socket() as k:
        try:
            k.bind(("127.0.0.1", p))
            return True
        except OSError:
            return False


# portas 46000 a 46599 (o app-offline.js usa 46600 a 46899); outras sessões de teste podem estar na mesma máquina
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 0
while not PORTA or not all(livre(x) for x in (PORTA, PORTA + 200, PORTA + 400)):
    PORTA = 46000 + random.randint(0, 199)
ORIGP = PORTA + 200
FTPP = PORTA + 400
RAIZ = os.path.join(os.path.dirname(os.path.abspath(AG)), "..")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


H = tempfile.mkdtemp(prefix="app-off-")
SITE = tempfile.mkdtemp(prefix="app-off-site-")
CACHE = os.path.join(H, "Eterna", "app-cache")
INDEX = b"<!doctype html><title>teste</title><p>app de teste v97</p>"
FONTE = "vendor/fonts/inter-latin-400-normal.woff2"
FONTE_B = open(os.path.join(RAIZ, FONTE), "rb").read()
ESSENCIAIS = ["vendor/qrcode/qrcode.min.js", "img/brand/viva-maracana-white.png", "img/brand/viva-maracana-azul.png", "img/bg-noite.jpg",
              "vendor/ort/ort.min.js", "vendor/ort/ort-wasm-simd.wasm", "vendor/ort/ort-wasm.wasm",
              "vendor/rostos/face_detection_yunet_2023mar.onnx", "vendor/rostos/face_recognition_sface_2021dec.onnx",
              "vendor/faceapi/indice-exemplos.json"] + ["vendor/fonts/%s.woff2" % n for n in (
              "big-shoulders-display-latin-600-normal", "big-shoulders-display-latin-700-normal", "big-shoulders-display-latin-800-normal",
              "inter-latin-500-normal", "inter-latin-600-normal", "inter-latin-700-normal")]


def pôr(rel, data):
    p = os.path.join(SITE, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(data)


pôr("index.html", INDEX)
pôr(FONTE, FONTE_B)
pôr("vendor/segredo.exe", b"nao")
pôr("README.md", b"nao")
for rel in ESSENCIAIS:
    pôr(rel, b"x" * 64)                     # conteúdo falso: só conta o arquivo existir

pedidos = []


class Origem(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        pedidos.append(self.path)
        return super().do_GET()


orig = http.server.ThreadingHTTPServer(("127.0.0.1", ORIGP), functools.partial(Origem, directory=SITE))
threading.Thread(target=orig.serve_forever, daemon=True).start()

env = {**os.environ, "HOME": H, "USERPROFILE": H, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP),
       "ETERNA_APP_ORIGIN": "http://127.0.0.1:%d" % ORIGP, "ETERNA_SEM_OPENCV": "1", "USER": "eterna-teste-sem-cartao",
       "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"}
for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_BUCKET"):
    env.pop(k, None)


def get(path):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=30)
    try:
        c.putrequest("GET", path, skip_host=True, skip_accept_encoding=True)   # caminho cru, sem normalizar
        c.putheader("Host", "127.0.0.1:%d" % PORTA)
        c.endheaders()
        r = c.getresponse()
        return r.status, r.getheader("Content-Type") or "", r.read()
    except Exception:
        return 0, "", b""
    finally:
        c.close()


def subir():
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        time.sleep(0.25)
        if get("/status")[0] == 200:
            break
    return p


def parar(p):
    p.terminate()
    try:
        p.wait(5)
    except Exception:
        p.kill()


def status():
    s, _, b = get("/status")
    try:
        return json.loads(b) if s == 200 else {}
    except Exception:
        return {}


def esperar_pronto(seg=15):
    for _ in range(int(seg * 4)):
        if status().get("app_offline_pronto") is True:
            return True
        time.sleep(0.25)
    return False


A = None
try:
    # a. com a origem no ar
    A = subir()
    s, ct, b = get("/")
    ok(s == 200 and b == INDEX and ct.startswith("text/html"), "a: / deveria servir o index.html: %r %r" % (s, ct))
    s, ct, b = get("/" + FONTE)
    ok(s == 200 and b == FONTE_B and ct == "font/woff2", "a: fonte: %r %r %d" % (s, ct, len(b)))
    ok(esperar_pronto(), "a: /status.app_offline_pronto deveria virar true com os essenciais baixados: %r" % status().get("app_offline_pronto"))
    ok(os.path.isfile(os.path.join(CACHE, "index.html")) and os.path.isfile(os.path.join(CACHE, FONTE.replace("/", "%2F"))),
       "a: cópia em disco: %r" % (os.listdir(CACHE) if os.path.isdir(CACHE) else None))
    ok(not [n for n in os.listdir(CACHE) if n.endswith(".tmp")], "a: sobrou .tmp no cache")

    # c. travessia de caminho e extensão fora da lista (com a origem no ar: nada pode ser pedido nem gravado)
    antes = sorted(os.listdir(CACHE))
    n0 = len(pedidos)
    for ruim in ("/vendor/../README.md", "/vendor/fonts/../../README.md", "/vendor/%2e%2e/README.md", "/vendor/..%2fREADME.md",
                 "/vendor\\..\\README.md", "//etc/passwd.json", "/vendor/segredo.exe", "/README.md", "/agente/eterna-agente.py",
                 "/vendor/.hidden.js", "/vendor/fonts/./inter-latin-400-normal.woff2", "/%2fetc%2fpasswd.json"):
        s, _, _ = get(ruim)
        ok(s == 404, "c: %s deveria dar 404, deu %r" % (ruim, s))
    ok(sorted(os.listdir(CACHE)) == antes, "c: o cache mudou: %r" % sorted(set(os.listdir(CACHE)) ^ set(antes)))
    ok(len(pedidos) == n0, "c: o agente pediu à origem: %r" % pedidos[n0:])
    ok(os.path.dirname(os.path.realpath(os.path.join(CACHE, "x"))) == os.path.realpath(CACHE), "c: pasta do cache")

    # b. origem derrubada, agente reiniciado
    parar(A)
    A = None
    orig.shutdown()
    orig.server_close()
    A = subir()
    s, ct, b = get("/")
    ok(s == 200 and b == INDEX, "b: sem origem, / deveria vir do disco: %r %d" % (s, len(b)))
    s, ct, b = get("/index.html")
    ok(s == 200 and b == INDEX, "b: sem origem, /index.html do disco: %r" % s)
    s, ct, b = get("/" + FONTE)
    ok(s == 200 and b == FONTE_B and ct == "font/woff2", "b: sem origem, fonte do disco: %r %r %d" % (s, ct, len(b)))
    ok(status().get("app_offline_pronto") is True, "b: app_offline_pronto sem origem deveria seguir true")
    s, _, _ = get("/sprites/c00.webp")
    ok(s == 502, "b: arquivo que nunca foi baixado, sem origem, deveria dar 502: %r" % s)
finally:
    if A:
        parar(A)
    try:
        orig.server_close()
    except Exception:
        pass

# d. poda: acima do teto apaga o mais antigo, nunca o que acabou de gravar
HD = tempfile.mkdtemp(prefix="app-off-d-")
os.environ["HOME"] = HD
os.environ["USERPROFILE"] = HD
os.environ["ETERNA_SEM_OPENCV"] = "1"
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_CACHE_TETO = 2500
t = time.time()
for i, rel in enumerate(("img/a.jpg", "img/b.jpg")):
    ok(m.app_disco_gravar(rel, b"z" * 1000), "d: gravar " + rel)
    os.utime(m.app_disco(rel), (t - 100 + i, t - 100 + i))
ok(m.app_disco_gravar("img/c.jpg", b"z" * 1000), "d: gravar c")
ok(m.app_disco_ler("img/a.jpg") is None and m.app_disco_ler("img/b.jpg") and m.app_disco_ler("img/c.jpg"),
   "d: a poda deveria apagar só o mais antigo: %r" % os.listdir(m.APP_CACHE_DIR))
ok(m.app_rel("/") == "index.html" and m.app_rel("/vendor/x.js") == "vendor/x.js" and m.app_rel("/vendor/x.py") is None
   and m.app_rel("/docs/x.json") is None and m.app_rel("/vendor/a/../b.js") is None, "d: app_rel")

for d in (H, SITE, HD):
    shutil.rmtree(d, ignore_errors=True)
if falhas:
    print("FALHA app_offline_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK app_offline_agente: app e fontes servidos do disco depois de reiniciar sem origem; travessia e extensão recusadas; poda")
