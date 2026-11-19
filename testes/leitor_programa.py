# 18/11: leitor de cartão do gramado (agente/eterna-leitor.py) com o agente DE VERDADE em outro processo, atrás de um servidor
# HTTPS de teste (certificado próprio, nome posto.eterna.photo) que repassa para o agente. Critérios 1, 2, 15 a 24 e 31 do plano
# docs/planos/2026-11-18-leitor-cartao-gramado.md (o 14 também do lado do programa).
# Roda sozinho (testes/rodar.sh):  HOME=<temporário> python3 -I testes/leitor_programa.py agente/eterna-agente.py
# HOME temporário, portas livres, ETERNA_SEM_OPENCV=1. Só JPEGs lisos gerados aqui (nunca foto de cliente). Como root (container),
# o leitor roda como "nobody" para o cartão sem permissão de escrita valer de verdade.
import ast, hashlib, http.client, importlib.util, io, json, os, random, select, shutil, socket, ssl, subprocess, sys, tempfile, threading, time
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "..", "agente", "eterna-agente.py"))
LT = os.path.join(os.path.dirname(AG), "eterna-leitor.py")
CMD = os.path.join(os.path.dirname(AG), "..", "servidor", "leitor", "instalar-leitor.cmd")
sys.path.insert(0, AQUI)
import _agente_sessao as S
falhas = []
SAIDA = os.environ.get("ETERNA_LEITOR_SAIDA")        # pasta para guardar a saída do console do leitor (captura para o relatório)


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def livre_porta():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def jpeg_grande(lado=(1600, 1200)):
    """JPEG de ruído (alguns MB): o corpo não cabe num pedaço só da conexão."""
    b = io.BytesIO()
    Image.frombytes("RGB", lado, os.urandom(lado[0] * lado[1] * 3)).save(b, "JPEG", quality=95)
    return b.getvalue()


def jpeg(lado=(320, 240)):
    im = Image.new("RGB", lado, tuple(random.randint(30, 220) for _ in range(3)))
    for _ in range(60):
        r = os.urandom(5)
        im.putpixel((int.from_bytes(r[:2], "big") % lado[0], int.from_bytes(r[2:4], "big") % lado[1]), (r[0], r[1], r[4]))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=85)
    return b.getvalue()


BASE = tempfile.mkdtemp(prefix="eterna-leitor-")
os.chmod(BASE, 0o755)
COMO_NOBODY = hasattr(os, "geteuid") and os.geteuid() == 0


def cartao(nome, n):
    """Cartão de teste: <BASE>/vols/<nome>/DCIM/100CANON/IMG_xxxx.JPG, só leitura, datas no passado."""
    raiz = os.path.join(BASE, "fora", nome)
    d = os.path.join(raiz, "DCIM", "100CANON")
    os.makedirs(d)
    for i in range(n):
        p = os.path.join(d, "IMG_%04d.JPG" % (i + 1))
        with open(p, "wb") as f:
            f.write(jpeg())
        os.utime(p, (time.time() - 3600, time.time() - 3600 + i))
    for base, pastas, arqs in os.walk(raiz):
        for a in arqs:
            os.chmod(os.path.join(base, a), 0o444)
        os.chmod(base, 0o555)
    return raiz


def arvore(raiz):
    out = {}
    for base, _, arqs in os.walk(raiz):
        for a in arqs:
            p = os.path.join(base, a)
            st = os.stat(p)
            try:
                sha = hashlib.sha256(open(p, "rb").read()).hexdigest()
            except OSError:                       # arquivo sem permissão de leitura (fora do root)
                sha = None
            out[os.path.relpath(p, raiz)] = (st.st_size, st.st_mode, st.st_mtime_ns, sha)
        out[os.path.relpath(base, raiz) + "/"] = (os.stat(base).st_mtime_ns,)
    return out


VOLS = os.path.join(BASE, "vols")
os.makedirs(os.path.join(BASE, "fora"))
os.makedirs(VOLS)
os.chmod(VOLS, 0o755)


def mover(de, para):
    """Pôr e tirar o cartão = mover a pasta dele para dentro e para fora da pasta de volumes (o conteúdo não muda; a permissão da
    própria pasta abre só durante o movimento, que no Mac exige escrita nela)."""
    os.chmod(de, 0o755)
    os.rename(de, para)
    os.chmod(para, 0o555)
    return para


def pôr(raiz):
    return mover(raiz, os.path.join(VOLS, os.path.basename(raiz)))


def tirar(raiz_vol):
    return mover(raiz_vol, os.path.join(BASE, "fora", os.path.basename(raiz_vol)))


# ---------- certificado de teste (CA própria + posto.eterna.photo) ----------
def certificados():
    d = os.path.join(BASE, "tls")
    os.makedirs(d)
    run = lambda *a: subprocess.run(["openssl", *a], cwd=d, check=True, capture_output=True)
    run("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-subj", "/CN=Eterna teste CA",
        "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign")
    run("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "srv.key", "-out", "srv.csr", "-subj", "/CN=posto.eterna.photo")
    with open(os.path.join(d, "ext.cnf"), "w") as f:
        f.write("subjectAltName=DNS:posto.eterna.photo\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n"
                "basicConstraints=CA:FALSE\nauthorityKeyIdentifier=keyid\nsubjectKeyIdentifier=hash\n")
    run("x509", "-req", "-in", "srv.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "srv.pem", "-days", "2", "-extfile", "ext.cnf")
    os.chmod(d, 0o755)
    os.chmod(os.path.join(d, "ca.pem"), 0o644)
    return os.path.join(d, "ca.pem"), os.path.join(d, "srv.pem"), os.path.join(d, "srv.key")


class Proxy:
    """HTTPS de teste na frente do agente (como o nginx do servidor): conta os pedidos /leitor/foto e pode atrasá-los."""

    def __init__(self, cert, chave, alvo):
        self.ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.ctx.load_cert_chain(cert, chave)
        self.alvo = alvo
        self.atraso = 0.0
        self.atraso_corpo = 0.0              # segura o resto do corpo da foto (a vaga fica ocupada no agente)
        self.fotos = 0
        self.s = socket.socket()
        self.s.bind(("127.0.0.1", 0))
        self.s.listen(64)
        self.porta = self.s.getsockname()[1]
        threading.Thread(target=self._aceita, daemon=True).start()

    def _aceita(self):
        while True:
            try:
                c, _ = self.s.accept()
            except OSError:
                return
            threading.Thread(target=self._conn, args=(c,), daemon=True).start()

    def _conn(self, c):
        try:
            c.settimeout(30)
            s = self.ctx.wrap_socket(c, server_side=True)
            ini = s.recv(65536)
            if ini.startswith(b"POST /leitor/foto"):
                self.fotos += 1
                if self.atraso:
                    time.sleep(self.atraso)
            try:
                u = socket.create_connection(("127.0.0.1", self.alvo), 5)
            except OSError:
                s.close()
                return
            u.sendall(ini)
            if ini.startswith(b"POST /leitor/foto") and self.atraso_corpo:
                time.sleep(self.atraso_corpo)
            while True:
                if not s.pending():
                    r, _, _ = select.select([s, u], [], [], 60)
                    if not r:
                        break
                else:
                    r = [s]
                if s in r:
                    d = s.recv(65536)
                    if not d:
                        break
                    u.sendall(d)
                if u in r:
                    d = u.recv(65536)
                    if not d:
                        break
                    s.sendall(d)
            u.close()
            s.close()
        except (OSError, ssl.SSLError):
            try:
                c.close()
            except OSError:
                pass


# ---------- agente ----------
HOME_AG = os.path.join(BASE, "home")
os.makedirs(os.path.join(HOME_AG, "Eterna"))
PORTA = livre_porta()
AG_PROC = [None]
AG_LOG = []


def agente_subir(pp, extra=None):
    env = {**os.environ, "HOME": HOME_AG, "USERPROFILE": HOME_AG, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP": "0", "ETERNA_SEM_OPENCV": "1",
           "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_ORIGENS": "https://posto.eterna.photo:%d" % pp, "ETERNA_RECORTES_PISO_GB": "0.2",
           "ETERNA_SESSAO_PAUSA": "6", "PYTHONUNBUFFERED": "1",
           "USER": "eterna-teste-sem-cartao"}          # o agente não lê cartão nenhum deste computador
    env.update(extra or {})
    for k in ("ETERNA_PASTA", "ETERNA_REDE", "ETERNA_LEITOR_REDES", "ETERNA_POSTO_REDE", "ETERNA_PROXY_IP"):
        env.pop(k, None)
    p = subprocess.Popen([sys.executable, "-I", "-u", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    threading.Thread(target=lambda: [AG_LOG.append(l.decode(errors="replace")) for l in iter(p.stdout.readline, b"")], daemon=True).start()
    AG_PROC[0] = p
    for _ in range(200):
        time.sleep(0.25)
        if req("GET", "/status")[0] == 200:
            return p
    p.kill()
    raise SystemExit("FALHA leitor_programa: agente não subiu: " + "".join(AG_LOG)[-600:])


def agente_parar():
    p = AG_PROC[0]
    if p:
        p.terminate()
        try:
            p.wait(15)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
    AG_PROC[0] = None


COOK = {}


def req(metodo, caminho, corpo=None, cab=None, host=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=30)
    h = {"Host": host or "127.0.0.1:%d" % PORTA, "X-Eterna": "1"}
    if COOK.get("adm") and not host:
        h["Cookie"] = COOK["adm"]
    if isinstance(corpo, (dict, list)):
        corpo = json.dumps(corpo).encode()
        h["Content-Type"] = "application/json"
    h.update(cab or {})
    try:
        c.request(metodo, caminho, corpo, h)
        r = c.getresponse()
        b = r.read()
        try:
            return r.status, json.loads(b)
        except ValueError:
            return r.status, None
    except OSError as ex:
        return 0, {"erro": str(ex)}
    finally:
        c.close()


def eventos():
    st, j = req("GET", "/events?since=0")
    out, desde = [], 0
    while st == 200 and j.get("events"):
        out += j["events"]
        desde = j["next"]
        if desde >= j.get("total", 0):
            break
        st, j = req("GET", "/events?since=%d" % desde)
    return out


# ---------- leitor ----------
DADOS = os.path.join(BASE, "leitor")
os.makedirs(DADOS)
os.chmod(DADOS, 0o777)
TRAVA = livre_porta()
LT_PROCS = []


def lt_env(extra=None):
    e = {k: v for k, v in os.environ.items() if not k.startswith("ETERNA_")}
    e.update({"ETERNA_LEITOR_TESTE": "1", "ETERNA_LEITOR_DADOS": DADOS, "ETERNA_LEITOR_VOLUMES": VOLS, "ETERNA_LEITOR_CA": CA,
              "ETERNA_LEITOR_TRAVA": str(TRAVA), "ETERNA_LEITOR_ESPERA": "1,3", "LANG": "pt_BR.UTF-8", "LC_ALL": "", "PYTHONUNBUFFERED": "1",
              "HOME": BASE})
    e.update(extra or {})
    return e


def lt_rodar(args, extra=None, entrada=None, timeout=60):
    kw = dict(user=65534, group=65534, extra_groups=[]) if COMO_NOBODY else {}
    return subprocess.run([sys.executable, "-I", LT, *args], env=lt_env(extra), input=entrada, capture_output=True, text=True, timeout=timeout, **kw)


SAIDA_LT = []


def lt_abrir(extra=None):
    kw = dict(user=65534, group=65534, extra_groups=[]) if COMO_NOBODY else {}
    p = subprocess.Popen([sys.executable, "-I", "-u", LT, "--sem-janela"], env=lt_env(extra), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, **kw)
    threading.Thread(target=lambda: [SAIDA_LT.append(l.decode(errors="replace")) for l in iter(p.stdout.readline, b"")], daemon=True).start()
    LT_PROCS.append(p)
    time.sleep(1.0)
    return p


def lt_fechar(p, matar=False):
    if p.poll() is None:
        (p.kill if matar else p.terminate)()
        try:
            p.wait(10)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()


def estado():
    try:
        with open(os.path.join(DADOS, "estado.json"), encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def espera(fn, s=60, passo=0.25):
    t0 = time.time()
    while time.time() - t0 < s:
        try:
            v = fn()
            if v:
                return v
        except Exception:
            pass
        time.sleep(passo)
    return None


def fila_arqs():
    try:
        return sorted(os.listdir(os.path.join(DADOS, "fila")))
    except OSError:
        return []


def fila_vazia():
    return estado().get("fila", {}).get("n") == 0 and not [x for x in fila_arqs() if x.endswith(".jpg")]


def leitor_info():
    st, j = req("GET", "/leitores")
    return (j or {}).get("leitores", [{}])[0] if st == 200 else {}


CA = None
try:
    # ---------- critérios 1, 2, 24 e 31: estáticos e no mesmo processo ----------
    r = subprocess.run([sys.executable, "-m", "py_compile", LT], capture_output=True)
    ok(r.returncode == 0, "1: py_compile do leitor: %s" % r.stderr[-200:])
    arvore_src = ast.parse(open(LT, encoding="utf-8").read())
    mods = set()
    for n in ast.walk(arvore_src):
        if isinstance(n, ast.Import):
            mods |= {a.name.split(".")[0] for a in n.names}
        elif isinstance(n, ast.ImportFrom):
            mods.add((n.module or "").split(".")[0])
    fora = sorted(m for m in mods if m not in sys.stdlib_module_names)
    ok(not fora, "1: o leitor só importa a biblioteca padrão; fora dela: %s" % fora)
    os.environ["HOME"] = os.path.join(BASE, "home-import")
    os.environ["USERPROFILE"] = os.environ["HOME"]
    os.environ["ETERNA_SEM_OPENCV"] = "1"
    sp = importlib.util.spec_from_file_location("ag_leitor_teste", AG)
    agm = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(agm)
    os.environ.update({"ETERNA_LEITOR_TESTE": "1", "ETERNA_LEITOR_DADOS": os.path.join(BASE, "dados-import")})
    sp = importlib.util.spec_from_file_location("lt_teste", LT)
    L = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(L)
    orig_pedir = L.pedir
    tams = [1024, 50 * 1024, 700 * 1024, 2 * 1024 * 1024 + 7, 5 * 1024 * 1024]
    iguais = 0
    for tam in tams:
        p = os.path.join(BASE, "qh.bin")
        with open(p, "wb") as f:
            f.write(os.urandom(tam))
        iguais += L.quick_hash(p, tam) == agm.quick_hash(p, tam)
        os.remove(p)
    ok(iguais == 5, "2: quick_hash do leitor e do agente iguais em %d de 5 tamanhos" % iguais)
    ok(open(CMD, "rb").read().count(open(LT, "rb").read()) == 1 if os.path.exists(CMD) else False, "31: o instalar-leitor.cmd não traz a cópia exata do eterna-leitor.py")
    # 24: configuração recusada
    ok(L.config_erro({"servidor": "https://posto.eterna.photo", "ip": "8.8.8.8", "token": "x" * 43}) is not None, "24: IP público aceito")
    ok(L.config_erro({"servidor": "http://posto.eterna.photo", "ip": "192.168.10.10", "token": "x" * 43}) is not None, "24: servidor http aceito")
    ok(L.config_erro({"servidor": "https://posto.eterna.photo/x", "ip": "192.168.10.10", "token": "x" * 43}) is not None, "24: servidor com caminho aceito")
    ok(L.config_erro({"servidor": "https://posto.eterna.photo", "ip": "192.168.10.10", "token": "x" * 43}) is None, "24: configuração padrão recusada")
    # 24: só conecta no IP da configuração (o nome nunca vai para o DNS)
    alvos = []
    orig = L.socket.create_connection

    def falso(end, *a, **k):
        alvos.append(end)
        raise OSError("teste")
    L.socket.create_connection = falso
    try:
        L.pedir({"servidor": "https://posto.eterna.photo", "ip": "192.168.10.10", "token": "x" * 43}, "POST", "/leitor/pulso", {"v": 1})
    except L.ErroRede:
        pass
    L.socket.create_connection = orig
    ok(alvos == [("192.168.10.10", 443)], "24: o leitor conectou em %s" % alvos)
    # no mesmo processo: tela de erro com o cartão presente, 401 pelo /leitor/tem, servidor ocupado e fila de leitor desativado
    L.preparar_pastas()
    cfg0 = {"servidor": "https://posto.eterna.photo", "ip": "192.168.10.10", "token": "x" * 43, "livre_min_gb": 0, "fila_max_gb": 1}
    lt0 = L.Leitor(cfg0, L.Fila())
    lt0.cartao_id, lt0.estado_cartao, lt0.erro_copia, lt0.presente = None, "erro", "cartao", True
    tl = lt0.tela()
    ok(tl[1] == "Erro ao ler o cartão" and "Coloque" not in tl[1] and "Tudo enviado" not in tl[2], "1 (revisão): erro com o cartão presente: %s" % (tl,))
    cx = os.path.join(BASE, "cx", "CARTAO_X", "DCIM", "100CANON")
    os.makedirs(cx)
    for i in range(3):
        with open(os.path.join(cx, "IMG_%04d.JPG" % i), "wb") as f:
            f.write(jpeg())
        os.utime(os.path.join(cx, "IMG_%04d.JPG" % i), (time.time() - 60, time.time() - 60))
    pedidos = []

    def pedir_401(cfg, metodo, caminho, *a, **k):
        pedidos.append(caminho)
        return 401, {"erro": "sem_leitor"}
    L.pedir = pedir_401
    lt0.estado_cartao, lt0.erro_copia = "sem", None
    r = lt0.cartao_ler({"raiz": os.path.dirname(os.path.dirname(cx)), "rotulo": "CARTAO_X", "serial": ""})
    lido = lt0.fila.q("select lido from cartao where rotulo='CARTAO_X'", um=True)
    ok(r == "revogado" and lt0.revogado and pedidos == ["/leitor/tem"] and not [x for x in os.listdir(L.FILA) if x.endswith((".jpg", ".tmp"))]
       and lido == (None,) and lt0.tela()[1] == "Leitor desativado no Eterna", "2 (revisão): 401 no /leitor/tem: %s %s %s %s" % (r, pedidos, lido, lt0.tela()))
    # servidor ocupado (503/429): espera curta, sem "Sem conexão"
    lt1 = L.Leitor(cfg0, lt0.fila)
    hf = "c" * 64
    with open(lt0.fila.arquivo(hf), "wb") as f:
        f.write(b"x" * 2000)
    lt0.fila.q("insert or replace into foto (h, sha, tam, nome, rotulo, cartao, estado, em) values (?, ?, 2000, 'IMG_1.JPG', 'X', 0, 'copiada', ?)", (hf, "d" * 64, time.time()))
    for cod in (503, 429):
        L.pedir = lambda *a, **k: (cod, {"erro": "ocupado"})
        t0 = time.time()
        lt1.enviar_um(hf, "d" * 64, 2000, "IMG_1.JPG", "X", 0)
        ok(lt1.ocupado and lt1.erro_rede is None and 4.9 <= lt1.pausa_ate - t0 <= 15.1 and "Sem conexão" not in " ".join(lt1.tela())
           and os.path.exists(lt0.fila.arquivo(hf)), "4 (revisão): %s vira ocupado: %s %s %s" % (cod, lt1.erro_rede, round(lt1.pausa_ate - t0, 1), lt1.tela()))
    L.pedir = orig_pedir
    # desativado há 7 dias: a fila deste computador é apagada sozinha e fica no log
    L.grava_privado(L.REVOGADO, json.dumps({"desde": time.time() - 6 * 86400}))
    ok(lt1.limpar_revogado() == 0 and os.path.exists(lt0.fila.arquivo(hf)), "6 (revisão): apagou antes de 7 dias")
    L.grava_privado(L.REVOGADO, json.dumps({"desde": time.time() - 7 * 86400 - 60}))
    ok(lt1.limpar_revogado() >= 1 and not os.path.exists(lt0.fila.arquivo(hf)) and lt0.fila.resumo()["n"] == 0
       and "fila apagada" in open(L.LOG_ARQ, encoding="utf-8").read(), "6 (revisão): fila de leitor desativado há 7 dias")
    # Windows: só unidade removível com DCIM (GetLogicalDrives e GetDriveTypeW trocados no módulo)
    try:
        import ctypes

        class K32:
            def GetLogicalDrives(self):
                return (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5)      # C, D, E, F

            def GetDriveTypeW(self, raiz):
                return {"C": 3, "D": 2, "E": 2, "F": 3}[raiz.value[0]]   # D e E removíveis; F é HD externo

            def GetVolumeInformationW(self, raiz, nome, n, serie, *a):
                nome.value = {"D": "EOS_DIGITAL", "E": "<script>"}.get(raiz.value[0], "")
                serie.contents.value = 0x1A2B3C4D
                return 1
        L._k32 = K32()
        vs = L.win_cartoes(existe=lambda p: p[0] in "CDEF")
        ok([(v["raiz"], v["rotulo"], v["serial"]) for v in vs] == [("D:\\", "EOS_DIGITAL", "1A2B3C4D"), ("E:\\", "cartao", "1A2B3C4D")],
           "Windows: unidades do leitor: %s" % vs)
    except Exception as ex:
        falhas.append("Windows: unidades: %s" % ex)

    # ---------- agente + HTTPS de teste + leitor ativado ----------
    CA, CRT, KEY = certificados()
    PX = Proxy(CRT, KEY, PORTA)
    SERV = "https://posto.eterna.photo:%d" % PX.porta
    COOK["adm"] = S.cookie_sub(AG, HOME_AG)
    agente_subir(PX.porta)
    st, j = req("POST", "/leitores/criar", {"nome": "Gramado 1"})
    ok(st == 200 and j.get("codigo"), "cadastro do leitor: %s %s" % (st, j))
    r = lt_rodar(["--ativar", j["codigo"], "--servidor", SERV, "--ip", "8.8.8.8"])
    ok(r.returncode != 0 and "rede interna" in r.stdout, "24: --ip público: %s %s" % (r.returncode, r.stdout))
    r = lt_rodar(["--ativar", j["codigo"], "--servidor", "http://posto.eterna.photo:%d" % PX.porta, "--ip", "127.0.0.1"])
    ok(r.returncode != 0 and "https" in r.stdout, "24: servidor http: %s %s" % (r.returncode, r.stdout))
    r = lt_rodar(["--ativar", j["codigo"], "--servidor", SERV, "--ip", "127.0.0.1"])
    ok(r.returncode == 0 and "Gramado 1" in r.stdout, "ativação pelo programa: %s %s %s" % (r.returncode, r.stdout, r.stderr[-300:]))
    cfg = json.load(open(os.path.join(DADOS, "leitor.json")))
    TOKEN = cfg["token"]
    ok(cfg.get("fila_max_gb") == 50 and cfg.get("livre_min_gb") == 5, "padrões da fila: %s" % {k: cfg.get(k) for k in ("fila_max_gb", "livre_min_gb")})
    cfg["livre_min_gb"] = 0.05                     # o disco do teste pode ter menos de 5 GB livres
    with open(os.path.join(DADOS, "leitor.json"), "w") as f:
        json.dump(cfg, f)
    ok(TOKEN not in r.stdout + r.stderr, "o token apareceu no console da ativação")
    r = lt_rodar(["--testar"])
    ok(r.returncode == 0 and "Conectado" in r.stdout, "--testar: %s %s" % (r.stdout, r.stderr[-200:]))

    # ---------- 15, 16, 17: 20 fotos, 12 já no servidor ----------
    c1 = cartao("EOS_DIGITAL", 20)
    antes = arvore(c1)
    fotos = sorted(os.listdir(os.path.join(c1, "DCIM", "100CANON")))
    for fn in fotos[:12]:
        p = os.path.join(c1, "DCIM", "100CANON", fn)
        b = open(p, "rb").read()
        st, j = req("POST", "/leitor/foto?nome=%s&rotulo=WIFI" % fn, b, {"Authorization": "Bearer " + TOKEN, "Content-Type": "image/jpeg",
                    "X-Eterna-Hash": agm.quick_hash(p, len(b)), "X-Eterna-Sha256": hashlib.sha256(b).hexdigest()}, host="posto.eterna.photo:%d" % PX.porta)
        ok(st == 200 and j.get("resultado") == "new", "foto prévia no servidor: %s %s" % (st, j))
    PX.atraso = 4.0
    lt = lt_abrir()
    c1v = pôr(c1)
    e = espera(lambda: estado().get("cartao", {}).get("estado") == "pronto" and estado(), 60)
    ok(e and e["cartao"]["copiadas"] == 8 and e["cartao"]["ja_tinha"] == 12, "15: copiou 8 e 12 já estavam: %s" % (e or {}).get("cartao"))
    ok(e and e["cartao"]["enviadas"] < 8 and e["tela"]["titulo"] == "Pode tirar o cartão", "16: 'pode tirar' antes do fim do envio: %s" % (e or {}).get("tela"))
    li = espera(lambda: (lambda x: x if (x.get("cartao") or {}).get("estado") == "pronto" else None)(leitor_info()), 30)
    ok(li and li["cartao"]["enviadas"] < 8 and li["situacao"] == "ligado", "16: o pulso trouxe 'pronto' antes do fim do envio: %s" % (li or {}).get("cartao"))
    ok(espera(fila_vazia, 90), "15: a fila não esvaziou: %s" % estado().get("fila"))
    ok(PX.fotos == 8, "15: pedidos /leitor/foto do leitor: %d (esperado 8)" % PX.fotos)
    ok(not [x for x in fila_arqs() if x.endswith((".jpg", ".tmp"))], "15: sobrou arquivo na fila: %s" % fila_arqs())
    ev = [x for x in eventos() if x.get("type") == "photo"]
    ok(len(ev) == 20 and len({x["id"] for x in ev}) == 20, "15: fotos no servidor: %d" % len(ev))
    do_leitor = [x for x in ev if x.get("card") == "EOS_DIGITAL"]
    ok(len(do_leitor) == 8 and all(x.get("ap") == "Gramado 1" and x.get("src") == "cartao" for x in do_leitor), "15: as 8 do leitor: %s" % do_leitor[:1])
    ok(arvore(c1v) == antes, "17: o cartão mudou depois da leitura")

    # ---------- 20: o mesmo cartão de novo: nenhum envio ----------
    PX.atraso = 0
    n0 = PX.fotos
    c1 = tirar(c1v)
    ok(espera(lambda: estado().get("presente") is False, 10), "cartão tirado não percebido")
    c1v = pôr(c1)
    ok(espera(lambda: estado().get("presente") and estado().get("cartao", {}).get("estado") == "pronto" and estado()["cartao"]["ja_tinha"] == 20, 20),
       "20: releitura do mesmo cartão: %s" % estado().get("cartao"))
    time.sleep(3)
    ok(PX.fotos == n0, "20: o mesmo cartão gerou %d envios" % (PX.fotos - n0))
    ok(arvore(c1v) == antes, "17: o cartão mudou na releitura")
    c1 = tirar(c1v)
    lt_fechar(lt)

    # ---------- 23: uma cópia por vez ----------
    lt = lt_abrir({"ETERNA_LEITOR_COPIA_ATRASO": "0.3"})
    t0 = time.time()
    r = lt_rodar(["--sem-janela"], timeout=20)
    ok(r.returncode == 3 and "já está aberto" in r.stdout and time.time() - t0 < 10, "23: segunda cópia: %s %s" % (r.returncode, r.stdout))

    # ---------- 21: cartão tirado no meio da cópia ----------
    c2 = cartao("CARTAO_B", 20)
    antes2 = arvore(c2)
    c2v = pôr(c2)
    ok(espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_B" and estado()["cartao"]["estado"] == "lendo", 20), "21: não começou a ler")
    time.sleep(2.0)
    c2 = tirar(c2v)
    e = espera(lambda: estado().get("cartao", {}).get("estado") == "erro" and estado(), 20)
    ok(e and e.get("erro") == "cartao" and e["tela"]["titulo"] == "Coloque o cartão de novo", "21: estado depois de tirar: %s" % (e or {}).get("tela"))
    ok(e and 0 < e["cartao"]["copiadas"] < 20, "21: tirou no meio? %s" % (e or {}).get("cartao"))
    ok(not [x for x in fila_arqs() if x.endswith(".tmp")], "21: sobrou .tmp: %s" % fila_arqs())
    c2v = pôr(c2)
    ok(espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_B" and estado()["cartao"]["estado"] == "pronto", 40), "21: não completou ao recolocar")
    ok(espera(fila_vazia, 60), "21: fila não esvaziou")
    ev = [x for x in eventos() if x.get("type") == "photo"]
    ok(len(ev) == 40 and len({x["id"] for x in ev}) == 40, "21: fotos no servidor depois do cartão B: %d" % len(ev))
    ok(arvore(c2v) == antes2, "17: o cartão B mudou")
    c2 = tirar(c2v)
    lt_fechar(lt)

    # ---------- 19: matar no meio do envio e abrir de novo ----------
    PX.atraso = 1.5
    lt = lt_abrir()
    c3 = cartao("CARTAO_C", 10)
    c3v = pôr(c3)
    ok(espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_C" and estado()["cartao"]["estado"] == "pronto", 30), "19: não leu o cartão C")
    time.sleep(2.5)
    lt_fechar(lt, matar=True)
    restam = len([x for x in fila_arqs() if x.endswith(".jpg")])
    ok(0 < restam < 10, "19: matou no meio? restavam %d na fila" % restam)
    c3 = tirar(c3v)
    PX.atraso = 0
    lt = lt_abrir()
    ok(espera(fila_vazia, 60), "19: a fila não foi retomada: %s" % estado().get("fila"))
    ev = [x for x in eventos() if x.get("type") == "photo"]
    ok(len(ev) == 50 and len({x["id"] for x in ev}) == 50, "19: cada foto uma vez só: %d eventos, %d distintas" % (len(ev), len({x["id"] for x in ev})))

    # ---------- 18: agente parado: copia tudo, avisa, e envia quando ele volta ----------
    agente_parar()
    c4 = cartao("CARTAO_D", 6)
    c4v = pôr(c4)
    e = espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_D" and estado()["cartao"]["estado"] == "pronto" and estado(), 30)
    ok(e and e["cartao"]["copiadas"] == 6, "18: sem servidor copiou %s" % (e or {}).get("cartao"))
    c4 = tirar(c4v)
    e = espera(lambda: "Sem conexão" in estado().get("tela", {}).get("titulo", "") and estado(), 20)
    ok(e and e["tela"]["cor"] == "amarelo", "18: a tela não mostrou 'Sem conexão': %s" % estado().get("tela"))
    agente_subir(PX.porta)
    ok(espera(fila_vazia, 60), "18: não enviou sozinho quando o agente voltou: %s" % estado().get("fila"))
    ev = [x for x in eventos() if x.get("type") == "photo"]
    ok(len(ev) == 56, "18: fotos no servidor: %d" % len(ev))

    # ---------- 1 (revisão): um arquivo que não abre não trava o cartão ----------
    c6 = cartao("CARTAO_F", 5)
    ruim = os.path.join(c6, "DCIM", "100CANON", "IMG_0099.JPG")
    os.chmod(os.path.join(c6, "DCIM", "100CANON"), 0o755)
    with open(ruim, "wb") as f:
        f.write(jpeg())
    os.utime(ruim, (time.time() - 3600, time.time() - 3600))
    os.chmod(ruim, 0o000)
    os.chmod(os.path.join(c6, "DCIM", "100CANON"), 0o555)
    antes6 = arvore(c6)
    c6v = pôr(c6)
    e = espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_F" and estado()["cartao"]["estado"] in ("pronto", "erro") and estado(), 30)
    if COMO_NOBODY or os.geteuid() != 0:
        ok(e and e["cartao"]["estado"] == "pronto" and e["cartao"]["copiadas"] == 5 and e["cartao"]["puladas"] == 1 and e["erro"] is None
           and e["tela"]["titulo"] == "Pode tirar o cartão" and e["tela"]["sub"] == "1 foto do cartão não abriu. Avise a TI.", "1 (revisão): arquivo que não abre: %s %s" % ((e or {}).get("cartao"), (e or {}).get("tela")))
        ok("um arquivo não abriu" in open(os.path.join(DADOS, "leitor.log"), encoding="utf-8").read(), "1 (revisão): o arquivo pulado não foi para o log")
    ok(espera(fila_vazia, 60), "1 (revisão): a fila não esvaziou")
    ok(arvore(c6v) == antes6, "17: o cartão F mudou")
    c6 = tirar(c6v)
    lt_fechar(lt)

    # ---------- 22: fila cheia: para de copiar, "Não tire o cartão", nada apagado ----------
    agente_parar()
    cfg2 = dict(cfg, fila_max_gb=0.0000065)        # 6,5 KB: cabem 2 fotos de teste
    with open(os.path.join(DADOS, "leitor.json"), "w") as f:
        json.dump(cfg2, f)
    lt = lt_abrir()
    c5 = cartao("CARTAO_E", 8)
    antes5 = arvore(c5)
    c5v = pôr(c5)
    e = espera(lambda: estado().get("erro") == "disco" and estado(), 30)
    ok(e and e["tela"]["titulo"] == "Não tire o cartão" and e["tela"]["cor"] == "vermelho", "22: tela com a fila cheia: %s" % (e or {}).get("tela"))
    n1 = fila_arqs()
    time.sleep(3)
    ok(fila_arqs() == n1 and 0 < len(n1) < 8, "22: a fila mudou ou apagou: %s -> %s" % (n1, fila_arqs()))
    ok(arvore(c5v) == antes5, "22: o cartão mudou")
    c5 = tirar(c5v)
    lt_fechar(lt)
    with open(os.path.join(DADOS, "leitor.json"), "w") as f:
        json.dump(cfg, f)

    # ---------- 1 (segurança): 429 e 503 do servidor de verdade chegam ao leitor como "ocupado" ----------
    agente_subir(PX.porta, {"ETERNA_LEITOR_TETO_DIA": "1"})     # o teto do dia dos leitores já passou: toda foto nova dá 429
    log_ini = len(open(os.path.join(DADOS, "leitor.log"), encoding="utf-8").read())
    lt = lt_abrir()
    c7 = cartao("CARTAO_G", 0)
    d7 = os.path.join(c7, "DCIM", "100CANON")
    os.chmod(d7, 0o755)
    for i in range(2):
        with open(os.path.join(d7, "IMG_%04d.JPG" % (i + 1)), "wb") as f:
            f.write(jpeg_grande())
        os.utime(os.path.join(d7, "IMG_%04d.JPG" % (i + 1)), (time.time() - 3600, time.time() - 3600))
    os.chmod(d7, 0o555)
    c7v = pôr(c7)
    ok(espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_G" and estado()["cartao"]["estado"] == "pronto", 30), "429: não leu o cartão G")
    lg = lambda: open(os.path.join(DADOS, "leitor.log"), encoding="utf-8").read()[log_ini:]
    ok(espera(lambda: "servidor ocupado (429)" in lg(), 30), "1 (segurança): 429 do agente não chegou como ocupado: %s" % lg()[-300:])
    e = estado()
    ok("sem conexão" not in lg() and e.get("erro") is None and e.get("ocupado") and "Sem conexão" not in json.dumps(e.get("tela"), ensure_ascii=False)
       and len([x for x in fila_arqs() if x.endswith(".jpg")]) >= 2, "1 (segurança): 429 virou rede ou perdeu a fila: %s %s %s" % (e.get("ocupado"), e.get("tela"), lg()[-300:]))
    c7 = tirar(c7v)
    lt_fechar(lt)
    agente_parar()
    agente_subir(PX.porta, {"ETERNA_LEITOR_VAGAS": "1"})          # uma vaga para todos os leitores: a 2ª foto ao mesmo tempo dá 503
    PX.atraso_corpo = 4.0
    log_ini = len(open(os.path.join(DADOS, "leitor.log"), encoding="utf-8").read())
    lt = lt_abrir()
    ok(espera(lambda: "servidor ocupado (503)" in lg(), 40), "1 (segurança): 503 do agente não chegou como ocupado: %s" % lg()[-300:])
    PX.atraso_corpo = 0
    ok(espera(fila_vazia, 90) and "sem conexão" not in lg(), "1 (segurança): depois do 503 a fila não esvaziou ou virou rede: %s" % lg()[-300:])
    lt_fechar(lt)
    agente_parar()
    agente_subir(PX.porta)

    # ---------- 14 (programa): desativado no Eterna: para de enviar e não apaga a fila ----------
    PX.atraso = 20
    lt = lt_abrir()
    c5v = pôr(c5)
    ok(espera(lambda: estado().get("cartao", {}).get("rotulo") == "CARTAO_E" and estado()["cartao"]["estado"] == "pronto", 30), "14: não leu o cartão E")
    lid = leitor_info().get("id")
    st, _ = req("POST", "/leitores/revogar", {"id": lid})
    ok(st == 200, "14: revogar: %s" % st)
    e = espera(lambda: estado().get("revogado") and estado(), 40)
    ok(e and e["tela"]["titulo"] == "Leitor desativado no Eterna", "14: a tela não mostrou 'Leitor desativado': %s" % estado().get("tela"))
    PX.atraso = 0
    time.sleep(2)
    ok(len([x for x in fila_arqs() if x.endswith(".jpg")]) >= 1, "14: a fila foi apagada depois de desativar: %s" % fila_arqs())
    r = lt_rodar(["--testar"])
    ok(r.returncode == 1 and "desativado" in r.stdout, "14: --testar depois de desativar: %s" % r.stdout)
    ok(TOKEN not in "".join(SAIDA_LT) and TOKEN not in open(os.path.join(DADOS, "leitor.log"), encoding="utf-8").read(), "o token apareceu no console ou no log do leitor")
    c5 = tirar(c5v)
    lt_fechar(lt)
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-900:])
finally:
    for p in LT_PROCS:
        try:
            lt_fechar(p, matar=True)
        except Exception:
            pass
    agente_parar()
    if SAIDA:
        try:
            with open(os.path.join(SAIDA, "leitor-console.txt"), "w", encoding="utf-8") as f:
                f.write("".join(SAIDA_LT))
            shutil.copy(os.path.join(DADOS, "leitor.log"), os.path.join(SAIDA, "leitor-log.txt"))
        except OSError:
            pass
    for base, pastas, arqs in os.walk(BASE):
        for x in pastas:
            try:
                os.chmod(os.path.join(base, x), 0o755)
            except OSError:
                pass
    shutil.rmtree(BASE, ignore_errors=True)
print(("OK" if not falhas else "FALHA") + " leitor_programa: biblioteca padrão, quick_hash igual, só o que falta, pode tirar antes do envio, cartão intacto,"
      " sem rede, retomada, cartão tirado, fila cheia, uma cópia, só IP privado, instalador igual (critérios 1, 2, 14 a 24 e 31)"
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.exit(1 if falhas else 0)
