# 24/11 (plano docs/planos/2026-11-24-lixeira-ia.md, Parte A): Lixeira da IA no servidor do ponto.
# Parte de módulo: lx_medir e lx_classe com imagens geradas a partir dos fundos do repositório (nenhuma foto de visitante) e
# caixas de rosto informadas (critérios 1 a 4 e 6); ler_rostos com o parâmetro novo "brutos" e SEM ele dá o mesmo resultado de
# antes; o leitor de rostos com detector falso mede depois da selfie, da fila do fotógrafo e da sessão, e um erro na medida não
# derruba o leitor (5); ETERNA_LIXEIRA=0 (7).
# Parte de rotas (agente de verdade num servidor local): 8 (permissões pela rota), 11, 13, 14, 15, 16, 17 e 18.
#   HOME=$(mktemp -d) ETERNA_RECORTES_PISO_GB=0.5 python3 -I testes/lixeira_agente.py agente/eterna-agente.py
import http.client, importlib.util, io, json, os, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_LIXEIRA"):
    os.environ.pop(k, None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
falhas, num = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)


import numpy as np
try:
    import cv2
except Exception:
    cv2 = None
from PIL import Image
os.makedirs(m.THUMBS, exist_ok=True)
_n = [0]


def foto(cor=128):
    _n[0] += 1
    pid = "%012x" % (0x1a0000000000 + _n[0])
    f = os.path.join(m.THUMBS, pid + ".jpg")
    Image.new("RGB", (120, 80), (cor, cor, cor)).save(f, "JPEG", quality=90)
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"o": "x", "s": "ftp", "u": time.time()}
    return pid


def leva(dia, fotografo, ps, status="aberta"):
    a = os.path.join(m.SESS_DIR, dia + ".json")
    try:
        ss = json.load(open(a)).get("sessoes") or []
    except Exception:
        ss = []
    ss.append({"card": "LP%04d" % (len(ss) + 1), "status": status, "fotos": list(ps), "fotografo": fotografo, "ia": []})
    json.dump({"sessoes": ss}, open(a, "w"))


def linhas(tab, pid):
    with m.treino_lock:
        db = m.treino_db()
        try:
            return db.execute("select * from %s where pid = ?" % tab, (pid,)).fetchall()
        finally:
            db.close()


def base(nome="ativ-chute.jpg", lado=1706):
    """Um fundo do repositório no tamanho de uma foto já reduzida pelo leitor (o quadro central fica perto de 1024 px)."""
    im = cv2.imread(os.path.join(RAIZ, "img", nome))
    h, w = im.shape[:2]
    k = lado / max(h, w)
    return cv2.resize(im, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)


ROSTO = (760, 300, 180, 220)                       # x, y, l, a (coordenadas da imagem acima)


def rosto(im, valor=None, ruido=12, fator=None):
    """Pinta o rosto: valor fixo com um pouco de textura, ou a própria imagem multiplicada por fator."""
    x, y, l, a = ROSTO
    out = im.copy()
    if fator is not None:
        out[y:y + a, x:x + l] = np.clip(out[y:y + a, x:x + l].astype(np.float32) * fator, 0, 255).astype(np.uint8)
    elif valor is not None:
        rg = np.random.default_rng(3)
        out[y:y + a, x:x + l] = np.clip(valor + rg.integers(-ruido, ruido + 1, (a, l, 3)), 0, 255).astype(np.uint8)
    return out


L = dict(m.LX_LIM_PADRAO)
cl = lambda im, caixas=(ROSTO,), n=1, nb=1: m.lx_classe(m.lx_medir(im, list(caixas), n, nb), L)

try:
    if cv2 is None:
        print("AVISO lixeira_agente: sem OpenCV no ambiente; só as rotas")
    else:
        m._cv.update(cv2=cv2, np=np)
        img0 = base()
        # ---------- 1: muito escura entra; 40% mais escura que o normal não ----------
        d = m.lx_medir(rosto(img0, 14, 6), [ROSTO], 1, 1)
        ok(d["luz"]["r"]["med"] < 22 and "escura" in m.lx_classe(d, L), "1: rosto com mediana abaixo de 22 = escura: %r" % d["luz"])
        normal = rosto(img0, 85, 20)
        d40 = m.lx_medir(rosto(normal, fator=0.6), [ROSTO], 1, 1)
        ok(40 <= d40["luz"]["r"]["med"] <= 60 and "escura" not in m.lx_classe(d40, L), "1: 40%% mais escura (mediana %r) não entra" % d40["luz"]["r"])
        ok(m.lx_classe(m.lx_medir(normal, [ROSTO], 1, 1), L) == [], "1: a mesma foto normal fica fora: %r" % m.lx_classe(m.lx_medir(normal, [ROSTO], 1, 1), L))
        escq = (img0.astype(np.float32) * 0.04).astype(np.uint8)
        ok(cl(escq, (), 0, 0)[:1] == ["escura"], "1: quadro quase preto sem rosto = escura primeiro: %r" % cl(escq, (), 0, 0))
        # ---------- 2: rosto estourado entra; foto clara com o rosto bom não ----------
        d = m.lx_medir(rosto(img0, 255, 0), [ROSTO], 1, 1)
        ok(d["luz"]["r"]["p95"] >= 254 and d["luz"]["r"]["alto"] >= 40 and "estourada" in m.lx_classe(d, L), "2: rosto estourado = estourada: %r" % d["luz"])
        clara = rosto(np.clip(img0.astype(np.int16) + 90, 0, 255).astype(np.uint8), 150, 20)
        ok("estourada" not in cl(clara), "2: foto clara com o rosto bom não entra: %r" % cl(clara))
        # ---------- 3: desfoque gaussiano sigma 8 entra; nítida não; rosto nítido e fundo desfocado não ----------
        borr = cv2.GaussianBlur(img0, (0, 0), 8)
        d = m.lx_medir(borr, [ROSTO], 1, 1)
        num["nq_nitida"] = m.lx_medir(img0, [ROSTO], 1, 1)["nq"]
        num["nq_sigma8"], num["nr_sigma8"] = d["nq"], d["nr"]
        ok("desfocada" in m.lx_classe(d, L), "3: sigma 8 com rosto = desfocada: %r" % d)
        ok("desfocada" in cl(borr, (), 0, 0), "3: sigma 8 sem rosto = desfocada")
        ok(cl(img0) == [] and cl(img0, (), 0, 2) == [], "3: a mesma foto nítida não entra: %r" % cl(img0))
        x, y, l_, a_ = ROSTO
        fundo = borr.copy()
        fundo[y:y + a_, x:x + l_] = img0[y:y + a_, x:x + l_]
        dfd = m.lx_medir(fundo, [ROSTO], 1, 1)
        ok("desfocada" not in m.lx_classe(dfd, L), "3: rosto nítido e fundo desfocado não entra: %r" % dfd)
        # ---------- 4: sem ninguém (nenhum rosto em tamanho nenhum) entra; com um rosto pequeno não ----------
        ok(cl(img0, (), 0, 0) == ["sem_ninguem"], "4: textura sem rosto = sem_ninguem: %r" % cl(img0, (), 0, 0))
        ok(cl(img0, (), 0, 1) == [], "4: rosto pequeno (abaixo de ROSTO_MIN) não entra")

        class Det:
            def __init__(self, fs):
                self.fs = fs

            def setInputSize(self, s):
                self.s = s

            def detect(self, im):
                return 1, (np.array(self.fs, np.float32) if self.fs else None)

        class Rec:
            def alignCrop(self, im, r):
                return im[:10, :10]

            def feature(self, x):
                return np.ones((1, 128), np.float32)

        def caixa(xx, yy, ll):
            return [xx, yy, ll, ll, xx + 5, yy + 5, xx + 15, yy + 5, xx + 10, yy + 10, xx + 5, yy + 15, xx + 15, yy + 15, 0, 0.9]

        pequeno = Det([caixa(100, 100, 20)])
        br = []
        ok(m.ler_rostos(img0, pequeno, Rec(), detalhe=True, brutos=br) == [] and br == [1], "4: o rosto pequeno conta em brutos e sai do filtro: %r" % br)
        # quem chama sem o parâmetro continua igual (mesma lista, mesmos valores)
        dois = Det([caixa(400, 200, 120), caixa(100, 100, 60), caixa(10, 10, 20)])
        a1, a2 = m.ler_rostos(img0, dois, Rec()), m.ler_rostos(img0, dois, Rec(), brutos=[])
        b1, b2 = m.ler_rostos(img0, dois, Rec(), detalhe=True), m.ler_rostos(img0, dois, Rec(), detalhe=True, brutos=[])
        ok(len(a1) == 2 and [x[0] for x in a1] == [x[0] for x in a2] and all((x[1] == y[1]).all() for x, y in zip(a1, a2)),
           "ler_rostos sem brutos = com brutos (simples): %r" % [x[0] for x in a1])
        ok(len(b1) == 2 and [(x[0], x[2], x[3], x[4]) for x in b1] == [(x[0], x[2], x[3], x[4]) for x in b2],
           "ler_rostos sem brutos = com brutos (detalhe)")
        nada = []
        ok(m.ler_rostos(img0, Det([]), Rec(), brutos=nada) == [] and nada == [0], "brutos = 0 sem nenhum rosto")
        ok(set(m.lx_medir(img0, [ROSTO], 1, 1)) == {"v", "nq", "nr", "n", "nb", "luz"}, "formato da medida (só números)")
        # sem OpenCV: sem veredito de desfoque (falha aberta)
        m._cv.clear()
        d = m.lx_medir(borr, [ROSTO], 1, 1)
        ok(d["nq"] is None and d["nr"] is None and "desfocada" not in m.lx_classe(d, L), "D4: sem OpenCV, sem desfocada: %r" % d)
        m._cv.update(cv2=cv2, np=np)

        # ---------- 6: o veredito não muda depois de gravado; limite novo vale só para foto nova ----------
        hoje = m._ff_hoje()
        esc = rosto(img0, 15, 3)
        p6 = foto()
        ok(m.lx_acrescenta(p6, hoje, m.lx_medir(esc, [ROSTO], 1, 1)) == ["escura"], "6: a foto entra como escura")
        m.lx_grava()
        st6, r6 = m.lx_cfg_gravar({"lim": {"esc_rosto_med": 10}}, "admin-teste")
        ok(st6 == 200 and m.lx_cfg()["lim"]["esc_rosto_med"] == 10, "6: limite novo gravado: %s %r" % (st6, r6))
        with m.lx_lock:
            m.lx_mem.pop(p6, None)                  # como se o agente reabrisse e o leitor lesse de novo
        m.lx_acrescenta(p6, hoje, m.lx_medir(esc, [ROSTO], 1, 1))
        m.lx_grava()
        ok((linhas("lixeira", p6) or [[0, 0, 0, None]])[0][3] == "escura", "6: o veredito gravado não muda: %r" % linhas("lixeira", p6))
        p6b = foto()
        ok(m.lx_acrescenta(p6b, hoje, m.lx_medir(esc, [ROSTO], 1, 1)) == [], "6: a foto nova usa o limite novo")
        m.lx_grava()
        ok(linhas("lixeira", p6b) and linhas("lixeira", p6b)[0][3] is None, "6: a foto nova fica gravada sem motivo")
        m.lx_cfg_gravar({"lim": dict(m.LX_LIM_PADRAO)}, "admin-teste")

        # ---------- 5: no leitor, depois da selfie, da fila do fotógrafo e da sessão; erro na medida não derruba ----------
        ordem = []
        reais = {k: getattr(m, k) for k in ("mat_acrescenta", "ff_rosto_lido", "sess_rostos_lidos", "lx_medir")}

        def espia(nome):
            def f(*a, **k):
                ordem.append((nome, a[1] if nome == "mat_acrescenta" else a[0] if nome != "lx_medir" else None))
                if nome == "lx_medir" and len([x for x in ordem if x[0] == "lx_medir"]) == 1:
                    raise RuntimeError("falha de teste")
                return reais[nome](*a, **k)
            return f
        for k in reais:
            setattr(m, k, espia(k))
        arq = os.path.join(HOME, "leitor.jpg")
        cv2.imwrite(arq, cv2.resize(borr, (borr.shape[1] * 2, borr.shape[0] * 2)))
        p5a, p5b = foto(), foto()
        det5 = Det([caixa(380, 150, 90)])
        m.fila_rostos.put((0, 0, p5a, arq, time.time()))
        m.fila_rostos.put((0, 1, p5b, arq, time.time()))
        threading.Thread(target=m.leitor_loop, args=(det5, Rec(), m.rostos_db()), daemon=True).start()
        t0 = time.time()
        while time.time() - t0 < 15 and p5b not in m.lx_mem:
            time.sleep(0.05)
        nomes = [x[0] for x in ordem]
        ok(nomes[:4] == ["mat_acrescenta", "ff_rosto_lido", "sess_rostos_lidos", "lx_medir"], "5: ordem no leitor: %r" % nomes[:8])
        ok(p5a not in m.lx_mem and p5b in m.lx_mem and "desfocada" in m.lx_mem[p5b]["mot"], "5: erro na 1ª medida não derruba o leitor; a 2ª mede: %r" % m.lx_mem.get(p5b))
        rdb = m.rostos_db()
        ok(rdb.execute("select count(*) from foto where pid in (?, ?)", (p5a, p5b)).fetchone()[0] == 2, "5: a leitura de rostos das duas fotos foi gravada")
        rdb.close()
        for k, v in reais.items():
            setattr(m, k, v)
        # ---------- 7: ETERNA_LIXEIRA=0: nada medido nem gravado ----------
        m.LX_ON = False
        p7 = foto()
        m.fila_rostos.put((0, 2, p7, arq, time.time()))
        t0 = time.time()
        rdb = m.rostos_db()
        while time.time() - t0 < 10 and not rdb.execute("select 1 from foto where pid = ?", (p7,)).fetchone():
            time.sleep(0.05)
        rdb.close()
        time.sleep(0.2)
        m.lx_grava()
        ok(p7 not in m.lx_mem and not linhas("lixeira", p7) and m.lx_status()["on"] is False and m.lx_acrescenta(p7, hoje, {"nb": 0}) == [],
           "7: ETERNA_LIXEIRA=0: nenhuma linha e /status.lixeira.on false")
        m.LX_ON = True
        m._cv.clear()

    # ---------- rotas ----------
    with m.lock:                                   # as fotos da parte de módulo saem da biblioteca (não entram na lista)
        for p in [p for p in m.lib if p in m.lx_mem]:
            m.lib.pop(p, None)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    adm = S.cookie_sessao(m, "admin-lx")
    R, RU = {"r": True}, {"r": True, "u": True}
    sup = S.cookie_sessao(m, "supervisora-lx", {"qualidade": RU, "configuracao": RU, "desempenho": R})
    m.estado_gravar({"docs": [{"col": "usuarios", "id": "supervisora-lx", "valor": {"v": 2, "email": "supervisora-lx", "name": "Sandra Teste", "active": True,
                                                                               "preset": "supervisor", "perms": {"qualidade": RU, "configuracao": RU, "desempenho": R}}}]})
    val = S.cookie_sessao(m, "validador-lx", {"qualidade": {"c": True, "r": True, "u": True, "d": True}})
    fot = S.cookie_sessao(m, "fotografo-lx", {"set": {"r": True, "c": True}})
    so_ver = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("supervisora-lx", por="admin-lx"))

    def pede(metodo, rota, corpo=None, cookie=None, limpa=True, extra=None, bruto=None):
        if limpa:
            m._janelas.clear()
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        h.update(extra or {})
        h = {k: v for k, v in h.items() if v is not None}
        corpo_b = bruto if bruto is not None else (json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None)
        c.request(metodo, rota, corpo_b, h)
        r = c.getresponse()
        b_ = r.read()
        c.close()
        try:
            return r.status, json.loads(b_ or b"{}")
        except ValueError:
            return r.status, b_

    hoje = m._ff_hoje()
    ontem = m._ff_hoje(time.time() - 86400)
    LUZ_OK = {"q": {"med": 120, "alto": 1, "baixo": 1, "p95": 220}, "r": {"med": 120, "p95": 210, "alto": 0}}

    def dados(**k):
        x = {"v": 1, "nq": 900.0, "nr": 300.0, "n": 1, "nb": 1, "luz": json.loads(json.dumps(LUZ_OK))}
        x.update(k)
        return x
    ESC = dados(luz={"q": {"med": 10, "alto": 0, "baixo": 80, "p95": 30}, "r": {"med": 9, "p95": 20, "alto": 0}})
    DESF = dados(nq=8.0, nr=5.0)
    SEM = dados(n=0, nb=0, nr=None, luz={"q": LUZ_OK["q"], "r": None})
    pe, pd, ps_, pok = foto(), foto(), foto(), foto()
    leva(hoje, "marcio", [pe, pd, ps_, pok])
    for p, dd in ((pe, ESC), (pd, DESF), (ps_, SEM), (pok, dados())):
        m.lx_acrescenta(p, hoje, dd)
    po = foto()
    m.lx_acrescenta(po, ontem, ESC)
    m.lx_grava()
    base_hoje = m.lx_status()["hoje"]
    num["hoje"] = base_hoje
    # ---------- 8 e 18: quem pode ----------
    st, r = pede("GET", "/lixeira")
    ok(st == 401, "18: sem sessão = 401: %s" % st)
    st, r = pede("GET", "/lixeira", cookie=fot)
    ok(st == 403, "18: sem qualidade.r = 403: %s" % st)
    st, r = pede("GET", "/lixeira?dia=24-11-2026", cookie=adm)
    ok(st == 400 and r.get("error") == "dia", "18: dia inválido = 400: %s %r" % (st, r))
    st, r = pede("GET", "/lixeira", cookie=adm, extra={"Origin": "https://outro.exemplo"})
    ok(st == 403, "18: outra origem = 403: %s" % st)
    # ---------- 10 e 11: a lista ----------
    st, j = pede("GET", "/lixeira", cookie=sup)
    its = {x["pid"]: x for x in (j.get("itens") or [])}
    ok(st == 200 and j.get("dia") == hoje and j.get("modo") == "medir" and set(its) == {pe, pd, ps_} and j.get("n") == 3,
       "10: lista de hoje com os motivos: %s %r" % (st, j))
    ok(its.get(pe, {}).get("mot") == ["escura"] and its.get(pd, {}).get("mot") == ["desfocada"] and its.get(ps_, {}).get("mot") == ["sem_ninguem"]
       and its.get(pe, {}).get("fotografo") == "marcio" and its.get(pe, {}).get("card") == "LP0001" and its.get(pe, {}).get("rec") is None,
       "10: motivo, fotógrafo e leva: %r" % its.get(pe))
    ok({x["dia"]: x["n"] for x in j.get("dias") or []} == {hoje: 3, ontem: 1}, "10: os dias com a contagem: %r" % j.get("dias"))
    st, j2 = pede("GET", "/lixeira?dia=" + ontem, cookie=val)
    ok(st == 200 and [x["pid"] for x in j2.get("itens") or []] == [po], "10: outro dia pelo filtro (o Validador tem a letra na API): %s" % st)
    # ---------- 11: "Não é ruim" ----------
    st, r = pede("POST", "/lixeira/recuperar", {"pid": pe}, cookie=fot)
    ok(st == 403, "18: sem qualidade.u = 403: %s" % st)
    st, r = pede("POST", "/lixeira/recuperar", {"pid": pe}, cookie=sup, extra={"X-Eterna": None})
    ok(st == 403, "18: POST sem X-Eterna = 403: %s" % st)
    st, r = pede("POST", "/lixeira/recuperar", {"pid": pe}, cookie=so_ver)
    ok(st == 403 and r.get("erro") == "so_ver", "13: ver como não grava: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/recuperar", {"pid": "../x"}, cookie=sup)
    ok(st == 400 and r.get("error") == "pid", "18: pid fora do formato = 400: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/recuperar", bruto=json.dumps({"pid": pe, "x": "a" * 1100}).encode(), cookie=sup)
    ok(st in (400, 413), "18: corpo acima de 1 KB: %s" % st)
    st, r = pede("POST", "/lixeira/recuperar", {"pid": pok}, cookie=sup)
    ok(st == 404 and r.get("error") == "pid", "11: foto fora da lixeira = 404: %s %r" % (st, r))
    out = io.StringIO()
    velho, sys.stdout = sys.stdout, out
    try:
        st, r = pede("POST", "/lixeira/recuperar", {"pid": pe}, cookie=sup)
        st2, r2 = pede("POST", "/lixeira/recuperar", {"pid": "ag_" + pe}, cookie=sup)
    finally:
        sys.stdout = velho
    ok(st == 200 and r.get("ok") and (r.get("rec") or {}).get("por") == "supervisora-lx" and (r.get("rec") or {}).get("nome") == "Sandra Teste",
       "11: recuperada com quem e quando: %s %r" % (st, r))
    ok(st2 == 200 and r2.get("igual"), "11: segundo clique = igual: %s %r" % (st2, r2))
    lx_row = linhas("lixeira", pe)[0]
    ok(lx_row[6] == "supervisora-lx" and lx_row[7], "11: lixeira com rec_por e rec_em")
    ok([x[1] for x in linhas("lixeira_log", pe)] == ["recuperar"], "11: uma linha no lixeira_log: %r" % linhas("lixeira_log", pe))
    ok(m.lx_status()["hoje"] == base_hoje - 1, "9/11: a contagem de hoje diminui: %r" % m.lx_status())
    ok(pe not in out.getvalue(), "18: o console não imprime o pid")
    st, j = pede("GET", "/lixeira", cookie=adm)
    ok(j["itens"][-1]["pid"] == pe and j["itens"][-1]["rec"]["nome"] == "Sandra Teste" and j.get("n") == 2 and j.get("recuperadas") == 1,
       "11: a recuperada vai para o fim da lista: %r" % [x["pid"] for x in j["itens"]])
    # 12 (servidor): em Teste nada some: /status.lixeira.hoje_fora = 0 e o modo é medir
    st, s_ = pede("GET", "/status", cookie=adm)
    lx = s_.get("lixeira") or {}
    ok(st == 200 and set(lx) == {"v", "on", "modo", "rev", "hoje", "n7", "dias", "valendo", "hoje_fora"} and lx["on"] is True and lx["modo"] == "medir"
       and lx["hoje_fora"] == 0 and lx["hoje"] == base_hoje - 1 and lx["n7"] == base_hoje and lx["dias"] == 7, "12: /status.lixeira só números e códigos: %r" % lx)
    # 9 (Eduardo, 24/11): o menu conta os últimos 7 dias; a de 8 dias atrás fica fora
    p8 = foto()
    m.lx_acrescenta(p8, m._ff_hoje(time.time() - 8 * 86400), ESC)
    p6d = foto()
    m.lx_acrescenta(p6d, m._ff_hoje(time.time() - 6 * 86400), ESC)
    ok(m.lx_status()["n7"] == base_hoje + 1, "9: n7 = hoje, ontem e 6 dias atrás; 8 dias fora: %r" % m.lx_status())
    with m.lx_lock:
        m.lx_mem.pop(p8, None); m.lx_mem.pop(p6d, None)
    with m.lock:
        m.lib.pop(p8, None); m.lib.pop(p6d, None)
    ok(not any(p in json.dumps(lx) for p in (pe, pd, ps_)), "/status.lixeira sem pid")
    # ---------- 13: a chave ----------
    st, r = pede("POST", "/lixeira/config", {"modo": "medir"}, cookie=sup)
    ok(st == 403 and r.get("error") == "so_admin", "13: Supervisora = 403 so_admin: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"modo": "ligada"}, cookie=adm)
    ok(st == 409 and r.get("error") == "em_breve", "13: Ligado travado (Parte A) = 409 em_breve: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"modo": "medir"}, cookie=adm)
    ok(st == 200 and r.get("igual"), "13: Teste de novo = igual: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"modo": "desligada"}, cookie=adm)
    ok(st == 400 and r.get("error") == "modo", "13: modo fora da lista = 400: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"lim": {"nit_quadro": 5000}}, cookie=adm)
    ok(st == 400 and r.get("error") == "lim", "13: limite fora da faixa = 400 lim: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"lim": {"outro": 1}}, cookie=adm)
    ok(st == 400 and r.get("error") == "lim", "13: limite desconhecido = 400 lim: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"modo": "medir", "x": 1}, cookie=adm)
    ok(st == 400 and r.get("error") == "campo", "13: campo a mais = 400: %s %r" % (st, r))
    st, r = pede("POST", "/lixeira/config", {"lim": {"nit_quadro": 30}}, cookie=adm)
    m._lx_cfg["t"] = 0.0
    ok(st == 200 and m.lx_cfg()["lim"]["nit_quadro"] == 30 and m.lx_cfg()["por"] == "admin-lx", "13: o Admin muda e o config/lixeira grava: %s %r" % (st, r))
    ok([x[1] for x in linhas("lixeira_log", "")][-1:] == ["cfg_medir"], "13: a mudança da chave vai para o lixeira_log")
    m._janelas.clear()
    sts = [pede("POST", "/lixeira/config", {"modo": "medir"}, cookie=adm, limpa=False)[0] for _ in range(7)]
    ok(sts[-1] == 429, "18: chave acima de 6 por minuto = 429: %r" % sts)
    m._janelas.clear()
    sts = [pede("GET", "/lixeira", cookie=adm, limpa=False)[0] for _ in range(31)]
    ok(sts[-1] == 429 and sts[0] == 200, "18: lista acima de 30 por minuto = 429")
    m._janelas.clear()
    # ---------- 14: config/lixeira pela sincronização é recusado ----------
    antes = m.lx_cfg()
    m.estado_gravar({"docs": [{"col": "config", "id": "lixeira", "valor": {"v": 1, "modo": "ligada", "valendo": ["escura"], "lim": {}}}]})
    m._lx_cfg["t"] = 0.0
    ok(m.lx_cfg()["lim"] == antes["lim"] and m.lx_cfg()["modo"] == "medir", "14: /ponto/docs não muda o config/lixeira")
    st, r = pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "lixeira", "valor": {"v": 1, "modo": "ligada"}}]}, cookie=adm)
    m._lx_cfg["t"] = 0.0
    ok(m.lx_cfg()["modo"] == "medir", "14: nem pela rota da sincronização: %s" % st)
    # ---------- 15: a régua contra o Treino ----------
    def rotulo(p, nivel, motivos=(), duvida=False):
        with m.treino_lock:
            db = m.treino_db()
            db.execute("insert or replace into rotulo (pid, v, dia, dados, por, em) values (?,?,?,?,?,?)",
                       (p, 1, hoje, json.dumps({"qual": {"nivel": nivel, "motivos": list(motivos)}, "duvida": duvida}), "t", "x"))
            db.commit()
            db.close()
    certas = [foto() for _ in range(20)]
    for i, p in enumerate(certas):
        m.lx_acrescenta(p, ontem, ESC)
        rotulo(p, "nao_vai" if i % 2 else "fraca", ["escura"] if i < 15 else ["olhos"])
    pa, pdv = foto(), foto()
    m.lx_acrescenta(pa, ontem, ESC)
    rotulo(pa, "ajustar", ["escura"])
    m.lx_acrescenta(pdv, ontem, ESC)
    rotulo(pdv, "fraca", ["escura"], duvida=True)
    pl = foto()                                   # medida só de luz (de antes da lixeira): conta para escura
    with m.treino_lock:
        db = m.treino_db()
        db.execute("insert into medida (pid, tipo, valor, em) values (?, 'luz', ?, 'x')", (pl, json.dumps({"v": 1, "src": "original", **ESC["luz"]})))
        db.commit()
        db.close()
    rotulo(pl, "fraca", ["escura"])
    m.lx_grava()
    st, md = pede("GET", "/lixeira/medida", cookie=sup)
    e = (md.get("motivos") or {}).get("escura") or {}
    # escura: 20 certas + pl (luz) = 21 certas; pa (ajustar) e pe (recuperada, sem marcação) = 2 erradas; pdv (dúvida) fora
    ok(st == 200 and e.get("n") == 23 and e.get("certas") == 21 and e.get("erradas") == 2 and e.get("mesmo_motivo") == 16
       and abs((e.get("precisao") or 0) - 21 / 23) < 1e-3 and e.get("passa") is False and any(f["k"] == "precisao" for f in e.get("falta") or [])
       and md.get("recuperadas") == 1, "15: régua da escura: %s %r" % (st, e))
    dsf = md["motivos"]["desfocada"]
    ok(dsf["n"] == 0 and dsf["passa"] is False and dsf["falta"][0] == {"k": "n", "tem": 0, "precisa": 20}, "15: desfocada sem marcação: falta n: %r" % dsf)
    ok(set(md) == {"v", "lim", "crit", "motivos", "sem_medida", "recuperadas"}, "15: formato da régua")
    sts = [pede("GET", "/lixeira/medida", cookie=sup, limpa=(i == 0))[0] for i in range(11)]
    ok(sts[-1] == 429, "18: régua acima de 10 por minuto = 429")
    # ---------- 16: LGPD ----------
    m.lx_recuperar(pd, "admin-lx")
    n0 = m.lx_status()["hoje"]
    m.lx_acrescenta(ps_, hoje, SEM)
    m.lgpd_excluir([ps_, pd], [], quem="teste")
    ok(not linhas("lixeira", ps_) and not linhas("lixeira", pd) and not linhas("lixeira_log", pd), "16: LGPD apagou lixeira e lixeira_log")
    ok(ps_ not in m.lx_mem and m.lx_status()["hoje"] == n0 - 1, "16: some da contagem: %r" % m.lx_status())
    st, j = pede("GET", "/lixeira", cookie=adm)
    ok(not any(x["pid"] in (ps_, pd) for x in j["itens"]), "16: some da tela")
    # ---------- 17: saiu da biblioteca: some; a limpeza apaga, menos recuperada ou marcada no Treino ----------
    with m.lock:
        for p in (po, certas[0], pe):
            m.lib.pop(p, None)
    st, j = pede("GET", "/lixeira?dia=" + ontem, cookie=adm)
    ok(st == 200 and not any(x["pid"] in (po, certas[0]) for x in j["itens"]) and all(x["dia"] != ontem or x["n"] == len(j["itens"]) - j["recuperadas"] for x in j["dias"]),
       "17: foto fora da biblioteca some da tela: %r" % [x["pid"] for x in j["itens"]][:3])
    n_ap = m.lx_limpa(time.time() + 3 * 86400)
    ok(not linhas("lixeira", po) and linhas("lixeira", certas[0]) and linhas("lixeira", pe), "17: a limpeza apaga só a que não é régua (%r)" % n_ap)
    ok(m.lx_limpa_noite(time.mktime(time.strptime(hoje + " 12:00", "%Y-%m-%d %H:%M"))) is None, "17: de dia a limpeza não roda")
    # ---------- 18: erro sem pid nem caminho ----------
    real_lista = m.lx_lista
    m.lx_lista = lambda d: (_ for _ in ()).throw(OSError(HOME + "/" + pd))
    out = io.StringIO()
    velho, sys.stdout = sys.stdout, out
    try:
        st, r = pede("GET", "/lixeira", cookie=adm)
    finally:
        sys.stdout = velho
        m.lx_lista = real_lista
    ok(st == 500 and HOME not in json.dumps(r) and pd not in out.getvalue() and HOME not in out.getvalue(), "18: erro sem pid nem caminho: %r" % out.getvalue())
    # /status com ETERNA_LIXEIRA=0
    m.LX_ON = False
    st, s_ = pede("GET", "/status", cookie=adm)
    ok((s_.get("lixeira") or {}).get("on") is False and s_["lixeira"]["hoje"] == 0, "7: /status.lixeira.on false")
    m.LX_ON = True
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1800:])
m.lx_parar.set()
m.luz_parar.set()
print(("OK" if not falhas else "FALHA") + " lixeira_agente: Lixeira da IA no servidor (critérios 1 a 7, 11, 13 a 18 e a parte do servidor de 8, 9, 10 e 12) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:14])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
