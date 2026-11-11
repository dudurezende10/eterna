# Simulação v97 (montagem no servidor): DUAS CÂMERAS AO MESMO TEMPO, com o agente de verdade em outro processo (FTP embutido,
# threads de sessão, fila de recorte e fila de montagem) e ETERNA_MONTAGEM=1 (liga a montagem e a exibição no Checkout sem
# documento de configuração). Dois fotógrafos mandam as fotos intercaladas, cada um na sua conexão:
#   1. ETERNA_MONTAGEM=1: /status.montagem.ligada e .checkout verdadeiros sem config/montagem gravada
#   2. cada fotógrafo fica com a sua sessão (nenhuma foto de um na sessão do outro) e as bases são os 2 primeiros cliques dele
#   3. a fila anda até o fim: 2 bases x 5 fundos por sessão, todas prontas, nenhuma com erro, fila de recorte e de montagem zeradas
#   4. nenhuma montagem entra na fila antes de o recorte daquela foto existir (criada >= hora do recorte)
#   5. /montagens/lista devolve as montagens de cada sessão só com as bases dela
# Recorte falso (testes/_cliques_ia_lanca.py); o processo de montagem é o de verdade. Só figuras desenhadas aqui.
# Roda sozinho:  HOME=$(mktemp -d) python3 -I testes/montagem_duas_cameras_agente.py agente/eterna-agente.py
import ftplib, http.client, http.server, io, json, os, shutil, socket, sqlite3, subprocess, sys, tempfile, threading, time
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "agente", "eterna-agente.py"))
LANCA = os.path.join(AQUI, "_cliques_ia_lanca.py")
falhas, notas = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def porta_livre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


class Quieto(http.server.SimpleHTTPRequestHandler):      # os fundos vêm da raiz do repositório (como o app publicado)
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def log_message(self, *a):
        pass


PORTA_APP = porta_livre()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORTA_APP), Quieto)
threading.Thread(target=srv.serve_forever, daemon=True).start()
PORTA, FTPP = porta_livre(), porta_livre()
HB = tempfile.mkdtemp(prefix="eterna-sim-2cam-")
env = {**os.environ, "HOME": HB, "USERPROFILE": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP),
       "ETERNA_APP_ORIGIN": "http://127.0.0.1:%d" % PORTA_APP, "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": "6", "ETERNA_LEITORES": "1",
       "ETERNA_MONTAGEM": "1", "ETERNA_MONTAGENS_PISO_GB": "1", "ETERNA_RECORTES_PISO_GB": "1", "ETERNA_TESTE_MONT_MEM_GB": "0.2",
       "USER": "eternasim%d" % os.getpid(), "PYTHONUNBUFFERED": "1"}
for k in ("ETERNA_PASTA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS", "ETERNA_PRE_RECORTE", "ETERNA_MONTAGEM_CONC"):
    env.pop(k, None)
REC = os.path.join(HB, "Eterna", "recortes")
MDB = os.path.join(HB, "Eterna", "ponto", "montagens.db")
FUNDOS = ["campeao2", "mirante", "arq1950", "tunel", "telao"]


def req(method, path, body=None, headers=None, timeout=60):
    h = {"Host": "127.0.0.1:%d" % PORTA, **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=timeout)
    try:
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        b = r.read()
        try:
            return r.status, json.loads(b)
        except Exception:
            return r.status, None
    except Exception as ex:
        return 0, {"erro": str(ex)}
    finally:
        c.close()


def espera(fn, seg, passo=0.25):
    t0 = time.time()
    while time.time() - t0 < seg:
        v = fn()
        if v:
            return v
        time.sleep(passo)
    return fn()


_cor = [0]
_cor_lock = threading.Lock()


def jpeg(cap, serie):
    """Uma silhueta sobre verde puro (o lançador torna o verde transparente no recorte falso), com a hora do clique e a série."""
    with _cor_lock:
        _cor[0] += 1
        c = _cor[0]
    im = Image.new("RGB", (900, 600), (0, 200, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([390, 60, 510, 190], fill=(230, 180, 160))
    d.rectangle([330, 195, 570, 600], fill=(40 + c * 23 % 200, 40 + c * 57 % 60, 120 + c * 31 % 120))
    for k in range(16):
        v = int.from_bytes(os.urandom(3), "big")
        d.rectangle([340 + k * 12, 300, 350 + k * 12, 330], fill=(v >> 16 | 100, (v >> 8 & 255) // 3, v & 255 | 100))
    ex = Image.Exif()
    sub = ex.get_ifd(0x8769)
    sub[0x9003] = time.strftime("%Y:%m:%d %H:%M:%S", time.localtime(cap))
    sub[0xA431] = serie
    b = io.BytesIO()
    im.save(b, "JPEG", quality=85, exif=ex.tobytes())
    return b.getvalue()


SENHAS, NOMES, ERROS = {}, {}, []
SERIE = {"carlos": "97000001", "yago": "97000002"}


def camera(user, n, t0):
    """Uma câmera: uma conexão FTP, n fotos, uma a cada 0,4 s (as duas câmeras se intercalam)."""
    try:
        f = ftplib.FTP()
        f.connect("127.0.0.1", FTPP, timeout=20)
        f.login(user, SENHAS[user])
        for i in range(n):
            nome = "%s_%03d.JPG" % (user[:2].upper(), i)
            f.storbinary("STOR " + nome, io.BytesIO(jpeg(t0 + i * 2 - 20, SERIE[user])))
            NOMES.setdefault(user, []).append(nome)
            time.sleep(0.4)
        f.quit()
    except Exception as ex:
        ERROS.append("%s: %s" % (user, str(ex)[:120]))


def linhas():
    if not os.path.exists(MDB):
        return []
    db = sqlite3.connect("file:%s?mode=ro" % MDB, uri=True, timeout=10)
    try:
        return [dict(zip(("mid", "base", "fundo", "estado", "motivo", "criada", "pronta", "prio"), r))
                for r in db.execute("select mid, base, fundo, estado, motivo, criada, pronta, prio from montagem")]
    except sqlite3.Error:
        return []
    finally:
        db.close()


proc = None
LOG = []
try:
    proc = subprocess.Popen([sys.executable, "-I", "-u", LANCA, AG, "1.0"], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    threading.Thread(target=lambda: [LOG.append(l.decode(errors="replace")) for l in iter(proc.stdout.readline, b"")], daemon=True).start()
    if not espera(lambda: req("GET", "/status", timeout=3)[0] == 200, 40):
        raise SystemExit("agente não subiu: " + "".join(LOG)[-600:])
    SENHAS.update(json.load(open(os.path.join(HB, "Eterna", "ftp.json")))["users"])
    # 1. ETERNA_MONTAGEM=1, sem documento de configuração
    mo = (req("GET", "/status")[1] or {}).get("montagem") or {}
    ok(mo.get("ligada") is True and mo.get("checkout") is True and mo.get("fundos") == FUNDOS,
       "1: ETERNA_MONTAGEM=1 liga a montagem e a exibição no Checkout sem config gravada: %r" % {k: mo.get(k) for k in ("ligada", "checkout", "motivo", "fundos")})
    s, j = req("POST", "/fila-fotografo/funcao", {"dia": time.strftime("%Y-%m-%d"), "map": {
        "carlos": {"tipo": "campo", "point": "campo2"}, "yago": {"tipo": "campo", "point": "campo3"}}}, {"X-Eterna": "1"})
    ok(s == 200, "função do dia: %r %r" % (s, j))

    # 2. as duas câmeras ao mesmo tempo
    t0 = time.time()
    ths = [threading.Thread(target=camera, args=(u, 5, t0)) for u in ("carlos", "yago")]
    for t in ths:
        t.start()
    for t in ths:
        t.join(60)
    ok(not ERROS, "as duas câmeras mandaram sem erro: %r" % ERROS)

    def pids():
        fs = {x["name"]: x["id"] for x in ((req("GET", "/biblioteca")[1] or {}).get("fotos") or [])}
        return {u: [fs.get(n) for n in NOMES.get(u, [])] for u in SERIE}
    P = espera(lambda: (lambda p: p if all(len(v) == 5 and all(v) for v in p.values()) else None)(pids()), 20)
    ok(P, "as 10 fotos chegaram à biblioteca: %r" % pids())
    P = P or pids()

    def sess():
        return (req("GET", "/sessoes")[1] or {}).get("sessoes") or []

    def fechadas():
        ss = [x for x in sess() if not x.get("removida")]
        return ss if ss and all(x["status"] == "fechada" for x in ss) else None
    SS = espera(fechadas, 40) or sess()
    ok(len(SS) == 2 and all(x["status"] == "fechada" for x in SS), "2: duas sessões fechadas, uma por fotógrafo: %r" % [(x.get("fotografo"), x["status"], len(x.get("fotos") or [])) for x in SS])
    de = {x.get("fotografo"): x for x in SS}
    bases = {}
    for u in SERIE:
        x = de.get(u) or {}
        ok(sorted(x.get("fotos") or []) == sorted(P[u]), "2: a sessão de %s tem as 5 fotos dele e nenhuma do outro: %r" % (u, x.get("fotos")))
        ok(x.get("ia") == P[u][:2], "2: as bases de %s são os 2 primeiros cliques dele: %r" % (u, x.get("ia")))
        bases[u] = list(x.get("ia") or [])
    todas = [p for u in SERIE for p in bases[u]]

    # 3. a fila anda até o fim
    def prontas():
        ls = [r for r in linhas() if r["base"] in todas]
        return ls if len(ls) == 20 and all(r["estado"] == "pronta" for r in ls) else None
    L = espera(prontas, 240, 0.5)
    notas["s_20_montagens"] = round(time.time() - t0, 1)
    ls = [r for r in linhas() if r["base"] in todas]
    ok(L, "3: 20 montagens prontas (2 fotógrafos x 2 bases x 5 fundos): %r" % sorted((r["base"][:4], r["fundo"], r["estado"], r["motivo"]) for r in ls))
    ok(all(sorted(r["fundo"] for r in ls if r["base"] == b) == sorted(FUNDOS) for b in todas), "3: cada base com os 5 fundos, uma vez cada")
    ok(not [r for r in linhas() if r["base"] not in todas], "3: nenhuma montagem de foto que não é base")
    st = req("GET", "/status")[1] or {}
    mo, rc = st.get("montagem") or {}, st.get("recorte") or {}
    ok(mo.get("fila") == 0 and mo.get("erros_hoje") == 0 and not mo.get("parado"), "3: fila de montagem zerada, sem erro: %r" % {k: mo.get(k) for k in ("fila", "erros_hoje", "parado", "motivo")})
    ok(((rc.get("ia") or {}).get("fila")) == 0, "3: fila de recorte das bases zerada: %r" % rc.get("ia"))

    # 4. a montagem só entra na fila depois de o recorte daquela foto existir
    for r in ls:
        arq = os.path.join(REC, r["base"] + ".png")
        ok(os.path.exists(arq) and r["criada"] is not None and r["criada"] >= os.path.getmtime(arq) - 0.05 and (r["pronta"] or 0) >= r["criada"],
           "4: montagem pedida antes do fim do recorte da foto: %r" % {"fundo": r["fundo"], "criada": r["criada"], "recorte": os.path.exists(arq) and os.path.getmtime(arq)})
    # as duas câmeras andam juntas na fila: a 1ª montagem de cada fotógrafo sai antes da última do outro
    pr = {u: sorted(r["pronta"] for r in ls if r["base"] in bases[u] and r["pronta"]) for u in SERIE}
    ok(all(pr[u] for u in SERIE) and pr["carlos"][0] < pr["yago"][-1] and pr["yago"][0] < pr["carlos"][-1], "3: nenhum fotógrafo espera o outro terminar tudo: %r" % {u: [round(x - t0, 1) for x in v[:1] + v[-1:]] for u, v in pr.items()})

    # 5. /montagens/lista por sessão
    for u in SERIE:
        s, j = req("POST", "/montagens/lista", {"bases": bases[u]}, {"X-Eterna": "1"})
        its = (j or {}).get("itens") or []
        ok(s == 200 and len(its) == 10 and all(i["estado"] == "pronta" and i["mid"] and i["base"] in bases[u] for i in its),
           "5: a lista de %s traz as 10 montagens prontas só das bases dele: %r %r" % (u, s, [(i.get("fundo"), i.get("estado")) for i in its][:10]))
finally:
    if proc is not None:
        try:
            proc.terminate(); proc.wait(8)
        except Exception:
            proc.kill()
    srv.shutdown()
    shutil.rmtree(HB, ignore_errors=True)

print(("OK montagem_duas_cameras_agente: ETERNA_MONTAGEM=1, 2 fotógrafos ao mesmo tempo, sessões separadas, 20 montagens, montagem só depois do recorte · " + json.dumps(notas)) if not falhas
      else "FALHA montagem_duas_cameras_agente: " + " | ".join(falhas[:8]) + " · " + "".join(LOG)[-400:].replace("\n", " / "))
sys.exit(0 if not falhas else 1)
