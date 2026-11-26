# 25/11 (plano docs/planos/2026-11-25-fotos-vizinhas-checkout.md): fotos vizinhas na selfie do Checkout, lado do agente.
# Critérios 1 a 10: sess_vizinhas (mesma sessão, sessão vizinha, distância, rosto de outra pessoa, rosto do grupo, o que
# nunca entra, teto, custo, erro, busca em grupo), a rota POST /rostos/buscar (com e sem todo), a chave (config/vizinhas, ETERNA_VIZINHAS=0,
# POST /vizinhas/config só Admin, sincronização recusada) e /status.sessoes.vizinhas.
# Rostos sintéticos (vetor unitário aleatório de 128, semente fixa), como no testes/visitas_agente.py. Nunca foto de convidado.
# Roda sozinho:  USER=teste HOME=$(mktemp -d) python3 -I testes/vizinhas_agente.py agente/eterna-agente.py
import array, http.client, importlib.util, json, os, random, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer

AG = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
falhas, num = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1")
for k in ("ETERNA_SESSAO_PAUSA", "ETERNA_SESS_LIMITES", "ETERNA_VIZINHAS", "ETERNA_ORIGENS", "ETERNA_BUSCA_DIAS", "ETERNA_VIZ_GAP", "ETERNA_VIZ_ALCANCE", "ETERNA_VIZ_MAX"):
    os.environ.pop(k, None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {n: "x" * 12 for n in ("carlos", "samuel", "marinara")}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
sys.path.insert(0, AQUI)
import _agente_sessao as S

ok((m.VIZ_GAP, m.VIZ_ALCANCE, m.VIZ_MAX) == (180, 1500, 80) and m.VIZ_LIM == m.SESS_LIM_FICA and m.VIZ_ENV is True, "constantes")
ok(m.viz_cfg() == {"ligada": True} and m.viz_ligada() is True, "sem documento: ligada")
rnd = random.Random(2511)
HOJE = m._ff_hoje()
ONTEM = m._ff_hoje(time.time() - 86400)
T0 = time.mktime(time.strptime(HOJE + " 10:00:00", "%Y-%m-%d %H:%M:%S"))
_seq = [0]


def unit():
    v = [rnd.gauss(0, 1) for _ in range(128)]
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def rosto(base, larg=200, q=True, ruido=0.6):
    """(largura, vetor, qualidade): a mesma pessoa com ruído (semelhança perto de 0,7 entre duas leituras)."""
    v = [b + ruido * x for b, x in zip(base, unit())]
    n = sum(a * a for a in v) ** 0.5
    return (larg, [a / n for a in v], q)


def reset():
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info):
            d.clear()
        m.vis_prot.clear()
    db = m.rostos_db()
    for tb in ("foto", "rosto", "rosto_q"):
        db.execute("delete from " + tb)
    db.commit()
    db.close()


def sessao(o, t, fotos, passo=5, status="fechada", atrasada=False, dia=None, ia=(), sem_t=False):
    """Sessão do fotógrafo o com o primeiro clique em t. fotos = lista; cada item é a lista de rostos da foto, ou None para
    foto ainda sem leitura de rosto. Devolve (card, pids)."""
    dia = dia or HOJE
    k = dia + "|" + o + ("|t" if atrasada else "")
    pids, lf, lr, lq = [], [], [], []
    for fs in fotos:
        _seq[0] += 1
        p = "%012x" % (0xd00000000000 + _seq[0])
        pids.append(p)
        if fs is None:
            continue
        lf.append((p, dia, len(fs), time.time()))
        for larg, v, q in fs:
            e = array.array("f", v).tobytes()
            lr.append((p, dia, float(larg), e))
            if q:
                lq.append((p, dia, e))
    with m.sess_lock:
        x = m._sess_nova(k, t, t, "inicio", {}, o, "ftp", "cap", atrasada)
        x.update(fotos=list(pids), cap0=t, cap1=t + passo * max(0, len(pids) - 1), ultima_chegada=t + passo * len(pids), status=status,
                 ia=[pids[i] for i in ia])
        if not sem_t:                          # hora do clique de cada foto (só em memória; some quando o agente reinicia)
            x["_t"] = {p: (t + i * passo, t + i * passo + 1) for i, p in enumerate(pids)}
        if status == "fechada":
            x["fechada_em"] = x["ultima_chegada"] + 60
        for p in pids:
            m.sess_pid[p] = x["card"]
        card, fim = x["card"], x["cap1"]
    db = m.rostos_db()
    db.executemany("insert or replace into foto values (?,?,?,?)", lf)
    db.executemany("insert into rosto values (?,?,?,?)", lr)
    db.executemany("insert into rosto_q values (?,?,?)", lq)
    db.commit()
    db.close()
    return card, pids, fim


def achou(*pids, sim=0.7, principal=True):
    return [{"id": p, "sim": sim, "principal": principal} for p in pids]


INFO = {}


def viz(fotos):
    INFO.clear()
    return m.sess_vizinhas(fotos, info=INFO)


def ids(r):
    return [x["id"] for x in r]


def cenarios(tag):
    A, B, C = unit(), unit(), unit()            # A e B: a família reconhecida; C: outra pessoa
    # ---------- 1: mesma sessão ----------
    reset()
    S1, p, _ = sessao("carlos", T0, [[rosto(A)], [rosto(A), rosto(B)], []])
    r = viz(achou(p[0], p[1]))
    ok(r == [{"id": p[2], "card": S1, "mesma": True}], "%s 1: a foto sem rosto da mesma sessão entra: %r" % (tag, r))
    ok(viz(achou(p[0], p[1], sim=0.40)) == [] and viz(achou(p[0], principal=False)) == [] and viz([]) == [],
       "%s 1: sem reconhecida clara e principal, nada" % tag)
    # o "talvez" que a busca já devolveu não se repete nas vizinhas
    r = viz(achou(p[0], p[1]) + achou(p[2], sim=0.40))
    ok(r == [], "%s 1: foto que a busca já devolveu não se repete: %r" % (tag, r))
    # antes das reconhecidas também, em ordem de clique
    reset()
    S1, p, _ = sessao("carlos", T0, [[], [], [rosto(A)], [], [rosto(A)], []])
    r = viz(achou(p[4], p[2]))
    ok(ids(r) == [p[0], p[1], p[3], p[5]] and all(x["mesma"] and x["card"] == S1 for x in r), "%s 1: antes, no meio e depois, na ordem do clique: %r" % (tag, r))

    # ---------- 2: sessão vizinha a 150 s entra; a 200 s não ----------
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)], [rosto(A)]])
    S2, q, f2 = sessao("carlos", f1 + 150, [[], [], []])
    S3, w, _ = sessao("carlos", f2 + 200, [[], []])
    S0, z, _ = sessao("carlos", T0 - 150 - 5, [[], []])           # antes: último clique 150 s antes do primeiro da reconhecida
    SA, y, _ = sessao("carlos", T0 - 150 - 5 - 200 - 5, [[], []])  # 200 s antes da S0
    r = viz(achou(p[0], p[1]))
    ok(ids(r) == z + q and [x["card"] for x in r] == [S0, S0, S2, S2, S2] and not any(x["mesma"] for x in r),
       "%s 2: vizinha a 150 s entra (antes e depois), a 200 s não: %r" % (tag, r))
    ok(INFO.get("corte") is None, "%s 2: parar pelo intervalo não é corte de teto: %r" % (tag, INFO))
    # ensaio longo: 6 sessões seguidas a 2 min 30 s uma da outra entram inteiras, com e sem a hora de cada foto
    for sem_t in (False, True):
        reset()
        S1, p, fim = sessao("carlos", T0, [[rosto(A)], []], sem_t=sem_t)
        cadeia = []
        for _ in range(6):
            c_, q_, fim = sessao("carlos", fim + 150, [[], [rosto(A)], []], sem_t=sem_t)
            cadeia += q_
        r = viz(achou(p[0]))
        ok(ids(r) == [p[1]] + cadeia and INFO.get("corte") is None, "%s 2: cadeia de 6 sessões a 2 min 30 s entra inteira (sem_t=%s): %d de %d %r" % (tag, sem_t, len(r), 1 + len(cadeia), INFO))
    # o intervalo vale entre uma foto e a seguinte: 200 s depois da última aceita não entra, mesmo dentro do alcance
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)]])
    N1, a, g1 = sessao("carlos", f1 + 150, [[], []])
    N2, b, g2 = sessao("carlos", g1 + 200, [[]])
    ok(ids(viz(achou(p[0]))) == a, "%s 2: 200 s depois da última aceita não entra: %r" % (tag, ids(viz(achou(p[0])))))
    # alcance: 25 min para cada lado da reconhecida; a caminhada para ali e registra o corte (sem pid)
    reset()
    S1, p, fim = sessao("carlos", T0, [[rosto(A)]])
    dentro, fora = [], []
    for i in range(12):
        c_, q_, fim = sessao("carlos", fim + 150, [[]])
        (dentro if fim - T0 <= m.VIZ_ALCANCE else fora).extend(q_)
    r = viz(achou(p[0]))
    ok(len(dentro) == 10 and len(fora) == 2 and ids(r) == dentro and INFO == {"corte": "alcance"}, "%s 9: alcance de 1500 s com corte registrado: %d %r" % (tag, len(r), INFO))
    # para no primeiro rosto de qualidade de fora do grupo, mesmo a 10 s
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)], [rosto(C)], [], []], passo=10)
    r = viz(achou(p[0]))
    ok(r == [] and INFO.get("corte") is None, "%s 3: rosto de fora a 10 s para a caminhada: %r" % (tag, r))

    # ---------- 3: rosto de qualidade de outra pessoa para a caminhada naquele sentido ----------
    reset()
    S1, p, f1 = sessao("carlos", T0, [[], [rosto(C)], [], [rosto(A)], [], [rosto(C)], []])
    r = viz(achou(p[3]))
    ok(ids(r) == [p[2], p[4]], "%s 3: para no rosto de outra pessoa, antes e depois: %r" % (tag, r))
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)], []])
    S2, q, f2 = sessao("carlos", f1 + 100, [[], [rosto(A), rosto(C)], []])
    S3, w, _ = sessao("carlos", f2 + 100, [[], []])
    r = viz(achou(p[0]))
    ok(ids(r) == [p[1], q[0]], "%s 3: vizinha com rosto de fora: nem ela nem nada depois: %r" % (tag, r))

    # ---------- 4: rosto de qualidade que bate com o grupo entra ----------
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A), rosto(B)]])
    S2, q, _ = sessao("carlos", f1 + 120, [[rosto(B)], [], [rosto(C, q=False)], [rosto(A), rosto(B)]])
    r = viz(achou(p[0]))
    ok(ids(r) == q, "%s 4: rosto do grupo entra; rosto sem qualidade (perfil) não barra: %r" % (tag, r))
    # B só aparece pequeno, no fundo da foto reconhecida: não é do grupo
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A, 300), rosto(B, 100)], [rosto(B)], []])
    r = viz(achou(p[0]))
    ok(r == [], "%s 4: quem só aparece no fundo da reconhecida não entra no grupo: %r" % (tag, r))

    # ---------- 5: o que nunca entra ----------
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)], []])
    X1, a, _ = sessao("samuel", T0 + 3, [[], []])                           # outro fotógrafo
    X2, b, _ = sessao("carlos", T0 + 4, [[], []], atrasada=True)            # outra trilha (cartão)
    X3, c, _ = sessao("carlos", T0 + 30, [[], []], dia=ONTEM)               # outro dia
    X4, d, f4 = sessao("carlos", f1 + 60, [[], []], status="aberta")        # sessão aberta
    X5, e, _ = sessao("carlos", f4 + 60, [[]])                              # depois da aberta: a caminhada já parou
    r = viz(achou(p[0]))
    ok(ids(r) == [p[1]], "%s 5: outro fotógrafo, outra trilha, outro dia e sessão aberta ficam fora: %r" % (tag, r))
    reset()
    S1, p, f1 = sessao("carlos", T0, [[rosto(A)], []])
    X1, a, g = sessao("carlos", f1 + 60, [[], []])
    X2, b, _ = sessao("carlos", g + 60, [[]])
    with m.sess_lock:
        m.vis_prot.add(X1)
    r = viz(achou(p[0]))
    ok(ids(r) == [p[1]], "%s 5: sessão protegida (escola) fica fora e barra: %r" % (tag, r))
    with m.sess_lock:
        m.vis_prot.clear()
        m.sess[X1]["menor"] = True
    ok(ids(viz(achou(p[0]))) == [p[1]], "%s 5: sessão de menor fica fora" % tag)
    with m.sess_lock:
        m.sess[X1]["menor"] = False
        m.sess[S1]["menor"] = True
    ok(viz(achou(p[0])) == [], "%s 5: reconhecida em sessão protegida não puxa vizinha" % tag)
    with m.sess_lock:
        m.sess[S1]["menor"] = False
        m.sess[X1]["removida"] = True
    ok(ids(viz(achou(p[0]))) == [p[1]] + b, "%s 5: sessão removida não entra: %r" % (tag, viz(achou(p[0]))))
    # base de IA nunca entra; foto ainda sem leitura de rosto não entra e barra
    reset()
    S1, p, f1 = sessao("carlos", T0, [[], [], [rosto(A)], [], None, []], ia=(0,))
    r = viz(achou(p[2]))
    ok(ids(r) == [p[1], p[3]], "%s 5: base de IA e foto sem leitura ficam fora: %r" % (tag, r))
    # reconhecida de sessão aberta ou de ontem: nada
    reset()
    S1, p, _ = sessao("carlos", T0, [[rosto(A)], []], status="aberta")
    S2, q, _ = sessao("samuel", T0, [[rosto(A)], []], dia=ONTEM)
    ok(viz(achou(p[0], q[0])) == [], "%s 5: reconhecida em sessão aberta ou de outro dia não puxa vizinha" % tag)
    # duas trilhas com reconhecida: cada uma com as suas vizinhas
    reset()
    S1, p, _ = sessao("carlos", T0, [[rosto(A)], []])
    S2, q, _ = sessao("samuel", T0 + 900, [[], [rosto(A)]])
    r = viz(achou(p[0], q[1]))
    ok(sorted(ids(r)) == sorted([p[1], q[0]]) and all(x["mesma"] for x in r), "%s 5: duas trilhas: %r" % (tag, r))

    # ---------- 9: teto de 80 fotos, as mais próximas, na ordem do clique, com o corte registrado ----------
    reset()
    S1, p, _ = sessao("carlos", T0, [[] for _ in range(100)] + [[rosto(A)]] + [[] for _ in range(100)], passo=1)
    r = viz(achou(p[100]))
    ok(len(r) == m.VIZ_MAX == 80 and ids(r) == p[60:100] + p[101:141] and INFO == {"corte": "max"}, "%s 9: teto de 80, as mais próximas: %d %r" % (tag, len(r), INFO))
    r = viz(achou(p[100], p[10]))
    ok(len(r) == 80 and INFO == {"corte": "max"}, "%s 9: teto por busca, não por foto reconhecida: %d" % (tag, len(r)))

    # ---------- grupo: selfie com duas pessoas que aparecem em fotos diferentes traz as vizinhas das duas ----------
    reset()
    S1, p, _ = sessao("carlos", T0, [[rosto(A)], [], [rosto(B)], []])
    S2, q, _ = sessao("samuel", T0 + 700, [[], [rosto(B)], [rosto(A), rosto(B)], [rosto(C)], []])
    r = viz(achou(p[0]))
    ok(ids(r) == [p[1]], "%s grupo: só a pessoa A: para no rosto de B: %r" % (tag, ids(r)))
    r = viz(m.grupo_juntar([{"fotos": achou(p[0])}, {"fotos": achou(q[1], sim=0.6)}]))
    ok(sorted(ids(r)) == sorted([p[1], p[2], p[3], q[0], q[2]]) and all(x["mesma"] for x in r),
       "%s grupo: A e B reconhecidos em fotos diferentes: vizinhas das duas trilhas, B não barra, C barra: %r" % (tag, ids(r)))

    # ---------- 10: erro lá dentro devolve [] ----------
    orig = m._viz_calc
    m._viz_calc = lambda *a, **k: 1 / 0
    ok(viz(achou(p[0])) == [], "%s 10: erro devolve lista vazia" % tag)
    m._viz_calc = orig
    orig = m.rostos_db
    m.rostos_db = lambda: (_ for _ in ()).throw(OSError("banco"))
    ok(viz(achou(p[0])) == [], "%s 10: banco fora devolve lista vazia" % tag)
    m.rostos_db = orig
    ok(ids(viz(achou(p[0]))) == [p[1]], "%s 10: e volta ao normal na busca seguinte" % tag)
    m.rostos_db = orig


m._cv.pop("np", None)
cenarios("sem numpy")
try:
    import numpy as np
except Exception:
    np = None
if np is not None:
    m._cv["np"] = np
    cenarios("numpy")

# ---------- 9: custo com 5.000 fotos no dia (8 fotógrafos, sessões de 10 fotos, 2 rostos por foto com rosto) ----------
if np is not None:
    reset()
    A = unit()
    nomes = ["f%d" % i for i in range(8)]
    alvo = None
    for i in range(500):
        fs = [[rosto(unit()), rosto(unit())] if j % 3 else [] for j in range(10)]
        if i == 250:
            fs = [[], [], [rosto(A)], [], [rosto(A), rosto(A)], [], [], [rosto(A)], [], []]
        c_, p_, _ = sessao(nomes[i % 8], T0 + (i // 8) * 90, fs, passo=4)
        if i == 250:
            alvo = p_
    rec = achou(alvo[2], alvo[4], alvo[7])
    r = viz(rec)
    ok(len(r) >= 7, "9: achou as vizinhas no dia cheio: %d" % len(r))
    ts = []
    for _ in range(30):
        t = time.perf_counter()
        viz(rec)
        ts.append((time.perf_counter() - t) * 1000)
    num["viz_5000_ms"] = round(sorted(ts)[len(ts) // 2], 2)
    num["viz_5000_max_ms"] = round(max(ts), 2)
    ok(num["viz_5000_ms"] < 50, "9: custo abaixo de 50 ms com 5.000 fotos: %r" % num)
    # pior caso dos tetos: um fotógrafo com 25 min de fotos sem rosto de fora para cada lado (caminhada até o alcance e o teto)
    ex, fim = [], T0 + 40000
    for i in range(60):
        c_, p_, fim = sessao("longo", fim + 30, [[rosto(A)] if j % 4 == 0 else [] for j in range(12)], passo=4)
        ex.append(p_)
    rec = achou(ex[30][0], ex[30][4])
    r = viz(rec)
    ok(len(r) == m.VIZ_MAX and INFO.get("corte") == "max", "9: pior caso chega ao teto: %d %r" % (len(r), INFO))
    ts = []
    for _ in range(30):
        t = time.perf_counter()
        viz(rec)
        ts.append((time.perf_counter() - t) * 1000)
    num["viz_pior_ms"] = round(sorted(ts)[len(ts) // 2], 2)
    num["viz_pior_max_ms"] = round(max(ts), 2)
    ok(num["viz_pior_max_ms"] < 50, "9: pior caso abaixo de 50 ms: %r" % num)

# ---------- 6, 7, 8 e 10 pela rota ----------
reset()
A, C = unit(), unit()
S1, p, f1 = sessao("carlos", T0, [[rosto(A)], [rosto(A)], []])
S2, q, _ = sessao("carlos", f1 + 150, [[], [rosto(C)], []])
RESP = {"rosto": True, "fotos": achou(p[0], p[1]), "limite": m.LIMITE, "janela_min": 150, "fila": 0}
chamadas = []


def buscar_falso(imagens, dias=1, janela=None, grupo=False):
    chamadas.append(janela)
    return json.loads(json.dumps(RESP))


m.buscar = buscar_falso
m.rostos["ligado"] = True
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT
adm = S.cookie_sessao(m, "admin-viz")


def pede(metodo, rota, corpo=None, cookie=None, extra=None, xe=True):
    m._janelas.clear()
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST}
    if metodo == "POST":
        h["Content-Type"] = "application/json"
        if xe:
            h["X-Eterna"] = "1"
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    c.request(metodo, rota, json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None, h)
    r = c.getresponse()
    b = r.read()
    c.close()
    try:
        return r.status, json.loads(b or b"{}")
    except ValueError:
        return r.status, b


st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(st == 200 and r.get("fotos") == RESP["fotos"] and r.get("vizinhas") == [{"id": p[2], "card": S1, "mesma": True}, {"id": q[0], "card": S2, "mesma": False}]
   and r.get("viz", {}).get("ligada") is True and r["viz"].get("n") == 2 and isinstance(r["viz"].get("ms"), int)
   and set(r["viz"]) == {"ligada", "n", "ms", "corte"} and r["viz"]["corte"] is None, "rota: vizinhas e viz na resposta: %s %r" % (st, r))
ok(chamadas[-1] is None, "rota: a janela da busca não muda")
# a contagem da selfie continua só com as reconhecidas
db = m.vendas_db()
try:
    lin = db.execute("select * from selfie").fetchall()
finally:
    db.close()
ok(len(lin) == 1 and lin[0][4] == "achou" and lin[0][5] == 2, "rota: a selfie registra só as reconhecidas: %r" % (lin,))
# busca em grupo (grupo:true): as vizinhas valem do mesmo jeito
st, r = pede("POST", "/rostos/buscar", {"imagens": [], "grupo": True}, cookie=adm)
ok(st == 200 and r.get("grupo") is True and len(r.get("vizinhas") or []) == 2, "rota: busca em grupo traz as vizinhas: %r" % (r,))
# 6: galeria por QR (todo:true) nunca tem vizinhas
st, r = pede("POST", "/rostos/buscar", {"imagens": [], "todo": True}, cookie=adm)
ok(st == 200 and r.get("fotos") == RESP["fotos"] and "vizinhas" not in r and "viz" not in r and chamadas[-1] == 0, "6: todo:true sem vizinhas: %r" % (r,))
# sem foto achada, várias pessoas ou sem rosto: resposta igual à de hoje
for resp in ({"rosto": False, "fotos": []}, {"rosto": True, "varias": True, "fotos": []}, {"rosto": True, "fotos": [], "limite": 0.45, "janela_min": 150, "fila": 0}):
    RESP_ = RESP
    RESP = resp
    st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
    ok(st == 200 and r == resp, "rota: resposta sem foto fica igual: %r" % (r,))
    RESP = RESP_
# 10: erro dentro do cálculo: a busca responde normal
orig = m._viz_calc
m._viz_calc = lambda *a, **k: 1 / 0
st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(st == 200 and r.get("fotos") == RESP["fotos"] and r.get("vizinhas") == [], "10: erro no cálculo: busca normal: %s %r" % (st, r))
m._viz_calc = orig
orig = m.sess_vizinhas
m.sess_vizinhas = lambda *a, **k: 1 / 0
st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(st == 200 and r.get("fotos") == RESP["fotos"] and "vizinhas" not in r and "viz" not in r, "10: erro fora do cálculo: busca normal: %s %r" % (st, r))
m.sess_vizinhas = orig

# /status.sessoes.vizinhas
st, r = pede("GET", "/status", cookie=adm)
vz = ((r or {}).get("sessoes") or {}).get("vizinhas") if isinstance(r, dict) else None
ok(st == 200 and vz == {"ligada": True, "forcada": False, "em": None}, "/status.sessoes.vizinhas: %r" % (vz,))

# 8: POST /vizinhas/config só Admin
ok(m.rota_regra("POST", "/vizinhas/config") == ("sessao", ("configuracao.u",)) and m.rota_regra("GET", "/vizinhas/config") is None, "8: regra da rota")
ok(pede("POST", "/vizinhas/config", {"ligada": False})[0] == 401, "8: sem sessão 401")
semcfg = S.cookie_sessao(m, "so-ver-viz", {"configuracao": {"r": True}})
ok(pede("POST", "/vizinhas/config", {"ligada": False}, cookie=semcfg)[0] == 403, "8: sem configuracao.u 403")
m.estado_gravar({"docs": [{"col": "usuarios", "id": "sup-viz", "valor": {"v": 2, "email": "sup-viz", "name": "sup-viz", "active": True, "preset": "supervisor",
                                                                        "perms": {"configuracao": {"r": True, "u": True}}}}]})
sup = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("sup-viz"))
st, r = pede("POST", "/vizinhas/config", {"ligada": False}, cookie=sup)
m._viz_cfg["t"] = 0.0
ok(st == 403 and r.get("error") == "so_admin" and m.viz_cfg()["ligada"] is True, "8: Supervisora com configuracao.u: 403 so_admin: %s %r" % (st, r))
st, r = pede("POST", "/vizinhas/config", {"ligada": False, "preset": "admin"}, cookie=sup)
ok(st == 403, "8: preset no pedido não vale: %s" % st)
vc = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("sup-viz", por="admin-viz"))
st, r = pede("POST", "/vizinhas/config", {"ligada": False}, cookie=vc)
ok(st == 403, "8: ver como: 403: %s %r" % (st, r))
ok(pede("POST", "/vizinhas/config", {"ligada": False}, cookie=adm, xe=False)[0] == 403, "8: sem X-Eterna: 403")
ok(pede("POST", "/vizinhas/config", {"ligada": False}, cookie=adm, extra={"Origin": "https://exemplo.com"})[0] == 403, "8: outra origem: 403")
for c_ in ({"ligada": "nao"}, {"ligada": 0}, {}, {"rosto": False}):
    ok(pede("POST", "/vizinhas/config", c_, cookie=adm)[0] == 400, "8: recusa %r" % (c_,))
m._viz_cfg["t"] = 0.0
ok(m.viz_cfg()["ligada"] is True, "8: nada mudou com os pedidos recusados")
# a sincronização genérica recusa o documento (pela função e pela rota)
m.estado_gravar({"docs": [{"col": "config", "id": "vizinhas", "valor": {"ligada": False}}]}, "teste")
pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "vizinhas", "valor": {"ligada": False}}]}, cookie=adm)
m._viz_cfg["t"] = 0.0
ok(m.viz_cfg()["ligada"] is True, "8: a sincronização não desliga as vizinhas")

# 7: desligar pelo Admin vale na busca seguinte, sem reiniciar
t7 = time.time()
st, r = pede("POST", "/vizinhas/config", {"ligada": False, "por": "outro", "posto": "Painel"}, cookie=adm)
ok(st == 200 and r.get("ok") is True and r.get("ligada") is False and r.get("por") == "admin-viz", "7: desliga: %s %r" % (st, r))
st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(st == 200 and r == RESP and time.time() - t7 < 3, "7: desligada: resposta igual à de hoje, na hora: %r" % (r,))
st, r = pede("GET", "/status", cookie=adm)
ok(r["sessoes"]["vizinhas"]["ligada"] is False and r["sessoes"]["vizinhas"]["forcada"] is False and r["sessoes"]["vizinhas"]["em"], "7: /status mostra desligada: %r" % (r["sessoes"]["vizinhas"],))
log = [json.loads(l) for l in open(m.VIS_LOG, encoding="utf8")]
ok(log and log[-1].get("acao") == "vizinhas_config" and log[-1].get("ligada") is False and log[-1].get("por") == "admin-viz", "7: mudança registrada: %r" % log[-1:])
st, r = pede("POST", "/vizinhas/config", {"ligada": True}, cookie=adm)
ok(st == 200 and r.get("ligada") is True, "7: religa: %s %r" % (st, r))
st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(len(r.get("vizinhas") or []) == 2, "7: religada: vizinhas de volta")
cods = [pede("POST", "/vizinhas/config", {"ligada": True}, cookie=adm)[0]]
m._janelas.clear()
c7 = []
for _ in range(7):
    cx = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    cx.request("POST", "/vizinhas/config", json.dumps({"ligada": True}).encode(), {"Host": HOST, "Content-Type": "application/json", "X-Eterna": "1", "Cookie": adm})
    c7.append(cx.getresponse().status)
    cx.close()
ok(c7[:6] == [200] * 6 and c7[6] == 429, "8: o 7º pedido no minuto dá 429: %r" % c7)
m._janelas.clear()
# documento ilegível gravado por fora: fica o último valor lido
with m.estado_lock:
    db = m.estado_db()
    db.execute("update doc set valor = ? where col = 'config' and id = 'vizinhas'", (json.dumps({"ligada": "talvez"}),))
    db.commit()
    db.close()
m._viz_cfg["t"] = 0.0
ok(m.viz_cfg()["ligada"] is True, "7: documento ilegível: fica o último valor")
# ETERNA_VIZINHAS=0 vence o documento ligado
m.viz_cfg_gravar(True, "teste")
os.environ["ETERNA_VIZINHAS"] = "0"
sp2 = importlib.util.spec_from_file_location("ag2", AG)
m2 = importlib.util.module_from_spec(sp2)
sp2.loader.exec_module(m2)
ok(m2.VIZ_ENV is False and m2.viz_cfg()["ligada"] is True and m2.viz_ligada() is False, "7: ETERNA_VIZINHAS=0 vence o Painel")
ok(m2.sess_status()["vizinhas"] == {"ligada": False, "forcada": True, "em": m2.viz_cfg().get("em")}, "7: /status com a variável: %r" % (m2.sess_status()["vizinhas"],))
del os.environ["ETERNA_VIZINHAS"]
del m2
# os limites aceitam variável de ambiente, dentro de piso e teto
for env, esperado in (({"ETERNA_VIZ_GAP": "120", "ETERNA_VIZ_ALCANCE": "900", "ETERNA_VIZ_MAX": "40"}, (120, 900, 40)),
                      ({"ETERNA_VIZ_GAP": "5", "ETERNA_VIZ_ALCANCE": "99999", "ETERNA_VIZ_MAX": "0"}, (30, 3600, 1)),
                      ({"ETERNA_VIZ_GAP": "abc", "ETERNA_VIZ_ALCANCE": "", "ETERNA_VIZ_MAX": "1e3"}, (180, 1500, 80))):
    os.environ.update(env)
    sp3 = importlib.util.spec_from_file_location("ag3", AG)
    m3 = importlib.util.module_from_spec(sp3)
    sp3.loader.exec_module(m3)
    ok((m3.VIZ_GAP, m3.VIZ_ALCANCE, m3.VIZ_MAX) == esperado, "variáveis dos limites %r: %r" % (env, (m3.VIZ_GAP, m3.VIZ_ALCANCE, m3.VIZ_MAX)))
    for k_ in env:
        del os.environ[k_]
    del m3
m.VIZ_ENV = False
st, r = pede("POST", "/rostos/buscar", {"imagens": []}, cookie=adm)
ok(st == 200 and r == RESP, "7: com a variável, a resposta é a de hoje: %r" % (r,))
m.VIZ_ENV = True
srv.shutdown()

print(("OK" if not falhas else "FALHA") + " vizinhas_agente: mesma sessão, vizinha, distância, rosto de fora, grupo, proteções, teto, custo, rota, chave · %s" % json.dumps(num))
for f in falhas:
    print("  -", f)
sys.exit(1 if falhas else 0)
