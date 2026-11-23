# 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md): alertas do fotógrafo no servidor. Critérios 1 a 4, 6 a 8, 10 a
# 13 e a parte do servidor dos 16 e 18, com sessões, cena.db, vendas.db e medidas sintéticas (nenhuma foto real, nenhum número
# de venda real), as rotas com sessões de teste e o leitor de rostos com um detector falso (a medida sai na imagem decodificada).
#   HOME=$(mktemp -d) python3 -I testes/af_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA"):
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


from PIL import Image
os.makedirs(m.THUMBS, exist_ok=True)
_n = [0]


def foto(cor=128):
    _n[0] += 1
    pid = "%012x" % (0xaf0000000000 + _n[0])
    f = os.path.join(m.THUMBS, pid + ".jpg")
    Image.new("RGB", (120, 80), (cor, cor, cor)).save(f, "JPEG", quality=90)
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"o": "x", "s": "ftp", "u": time.time()}
    return pid


SESS = {}


def leva(dia, fotografo, n, status="fechada", cor=128):
    ps = [foto(cor) for _ in range(n)]
    SESS.setdefault(dia, []).append({"card": "LP%04d" % (sum(len(v) for v in SESS.values()) + 1), "status": status, "fotos": ps, "fotografo": fotografo, "ia": []})
    json.dump({"sessoes": SESS[dia]}, open(os.path.join(m.SESS_DIR, dia + ".json"), "w"))
    return ps


def cena(rotulos):
    with m.cena_db_lock:
        db = m.cena_db()
        db.executemany("insert or replace into cena (pid, dia, rotulo, conf, g, em) values (?,?,?,?,0,'x')", [(p, D1, r, c) for p, (r, c) in rotulos.items()])
        db.commit()
        db.close()


_ev = [0]


def venda(dia, selected=(), aiSel=(), paga=True, cancelada=False):
    _ev[0] += 1
    vid = "v-teste-%d" % _ev[0]
    db = m.vendas_db()
    linhas = [("%s-c" % vid, vid, 1, "criar", dia + "T15:00:00Z", dia, "Caixa 1", None,
               json.dumps({"saleNo": "T-%03d" % _ev[0], "total": 10, "nPh": len(selected), "selected": list(selected), "aiSel": list(aiSel)}), "x")]
    if paga:
        linhas.append(("%s-p" % vid, vid, 2, "pagar", dia + "T15:01:00Z", dia, "Caixa 1", None, "{}", "x"))
    if cancelada:
        linhas.append(("%s-x" % vid, vid, 3, "cancelar", dia + "T15:02:00Z", dia, "Caixa 1", None, "{}", "x"))
    db.executemany("insert into evento values (?,?,?,?,?,?,?,?,?,?)", linhas)
    db.commit()
    db.close()


CFG_REAL = m.treino_cfg


def treino(ponto="desligada", exposicao="desligada"):
    v = dict(m.TREINO_CFG_PADRAO, ponto=ponto, exposicao=exposicao, ponto_versao=None, por=None, em=None, abaixo=None, exposicao_ok=exposicao == "ligada")
    m._treino_cfg.update(t=time.time() + 1e6, v=v)       # treino_cfg_mem e treino_cfg leem daqui (sem banco)


def fd_grava(dia, f, d):
    base = {"v": 1, "familias": 0, "cliques_soma": 0, "chute_soma": 0, "nao_contadas": 0, "hist": [0, 0, 0], "por_n": {}, "lim": [20, 40],
            "fonte": "todas", "fam_compraram": 0, "fotos": 0, "fotos_vendidas": 0, "luz": {"n": 0, "escuras": 0, "estouradas": 0, "sem_dado": 0}}
    base.update(d)
    with m.op_lock:
        db = m.operacao_db()
        db.execute("insert or replace into fotografo_dia values (?,?,?,?)", (dia, f, json.dumps(base), "x"))
        db.commit()
        db.close()


def fd_limpa():
    with m.op_lock:
        db = m.operacao_db()
        db.execute("delete from fotografo_dia")
        db.commit()
        db.close()


def tipos(r, k=None):
    return [a["tipo"] for a in r["alertas"] if k is None or a["k"] == k]


HOJE = m._ff_hoje()
D1 = m._ff_hoje(time.time() - 3 * 86400)
D2 = m._ff_hoje(time.time() - 4 * 86400)
try:
    # ---------- 1: três levas de 10, 25 e 45 cliques com o ponto Ligado; chute à parte, "outro" e sem leitura não contadas ----------
    a = leva(D1, "marcio", 15)
    b = leva(D1, "marcio", 27)
    c = leva(D1, "marcio", 48)
    rot = {}
    for p in a[:10]:
        rot[p] = ("gramado", 0.9)
    for p in a[10:13]:
        rot[p] = ("chute", 0.95)
    for p in a[13:]:
        rot[p] = ("outro", 0.9)
    for i, p in enumerate(b[:25]):
        rot[p] = (("gramado", "trofeu", "arquibancada")[i % 3], 0.8)
    rot[b[25]] = ("chute", 0.8)
    rot[b[26]] = ("trofeu", 0.5)                    # confiança abaixo de 0,70: não contada
    for p in c[:45]:
        rot[p] = ("gramado", 0.99)                  # c[45:] sem leitura
    cena(rot)
    treino(ponto="ligada")
    d1 = m.af_dia(D1)["marcio"]
    ok(d1["familias"] == 3 and d1["cliques_soma"] == 80 and round(d1["cliques_soma"] / d1["familias"], 1) == 26.7, "1: média 26,7: %r" % d1)
    ok(d1["hist"] == [1, 1, 1] and d1["por_n"] == {"10": 1, "25": 1, "45": 1}, "1: 1 abaixo de 20 e 1 acima de 40: %r" % d1)
    ok(d1["chute_soma"] == 4 and d1["nao_contadas"] == 2 + 1 + 3 and d1["fonte"] == "ponto" and d1["fotos"] == 90, "1: chute à parte, outro e sem leitura em nao_contadas: %r" % d1)
    ok(not any(k in json.dumps(d1) for k in a + b + c), "1: o agregado não tem pid")
    # ---------- 2: ponto desligado: conta todas as fotos da leva ----------
    treino(ponto="desligada")
    d2 = m.af_dia(D1)["marcio"]
    ok(d2["fonte"] == "todas" and d2["cliques_soma"] == 90 and d2["por_n"] == {"15": 1, "27": 1, "48": 1} and d2["chute_soma"] == 0, "2: todas as fotos: %r" % d2)
    m.af_gravar(D1)
    r2 = m.af_alertas(D1, D1, agora_hoje=False)
    ok(r2["fonte_cliques"] == "todas", "2: fonte_cliques todas: %r" % r2["fonte_cliques"])
    treino(ponto="ligada")
    m.af_gravar(D1)
    ok(m.af_alertas(D1, D1, agora_hoje=False)["fonte_cliques"] == "ponto", "2: com o ponto Ligado, fonte ponto")
    # cobertura: dia com o ponto Ligado mas sem leitura (antes de ligar) conta todas as fotos
    sem = leva(D2, "yago", 22)
    ok(m.af_dia(D2)["yago"]["fonte"] == "todas" and m.af_dia(D2)["yago"]["cliques_soma"] == 22, "2: dia sem leitura do ponto conta todas")
    treino()

    # ---------- 3: venda pela selfie com fotos das levas de A e de B; cancelada não conta; base de IA conta a leva ----------
    D3 = m._ff_hoje(time.time() - 6 * 86400)
    la = leva(D3, "marcio", 20)
    lb = leva(D3, "yago", 20)
    lc = leva(D3, "yago", 20)
    ld = leva(D3, "carlos", 20)
    le = leva(D3, "carlos", 20)
    venda(D3, selected=["ag_" + la[0], "ag_" + lb[0], lb[1]])                     # selfie juntou as levas de A e de B
    venda(D3, selected=["ag_" + lc[0], "ag_" + lc[1]], cancelada=True)           # paga e cancelada
    venda(D3, selected=["ag_" + le[0]], paga=False)                              # não paga
    venda(m._dia_mais(D3, 1), aiSel=["ai:ag_%s|telao" % ld[2]])                  # montagem do dia seguinte com a base da leva D
    d3 = m.af_dia(D3)
    ok(d3["marcio"]["fam_compraram"] == 1 and d3["marcio"]["fotos_vendidas"] == 1, "3: A comprou, 1 foto dele: %r" % d3["marcio"])
    ok(d3["yago"]["fam_compraram"] == 1 and d3["yago"]["fotos_vendidas"] == 2 and d3["yago"]["familias"] == 2, "3: B comprou (2 fotos dele), a cancelada não conta: %r" % d3["yago"])
    ok(d3["carlos"]["fam_compraram"] == 1 and d3["carlos"]["fotos_vendidas"] == 0, "3: a base do aiSel conta a leva, sem foto vendida: %r" % d3["carlos"])

    # ---------- 4: af_conv_fam: 15 famílias, 3 fotógrafos e 10 pontos abaixo da média ponderada da equipe toda ----------
    D4 = "2026-01-10"
    fd_limpa()
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 6, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "b", {"familias": 20, "fam_compraram": 10, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "c", {"familias": 20, "fam_compraram": 8, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    r4 = m.af_alertas(D4, D4, agora_hoje=False)
    al = [x for x in r4["alertas"] if x["tipo"] == "af_conv_fam"]
    ok(len(al) == 1 and al[0]["k"] == "a" and al[0]["args"] == [30, 40, 6, 20], "4: exatamente 10 pontos abaixo (30%% x 40%%) sai: %r" % r4["alertas"])
    ok(r4["equipe"] == {"familias": 60, "fam_compraram": 24, "fotos": 1500, "fotos_vendidas": 150}, "4: equipe toda: %r" % r4["equipe"])
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 7, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok("af_conv_fam" not in tipos(m.af_alertas(D4, D4, agora_hoje=False)), "4: 35%% contra 41,7%% (menos de 10 pontos) não sai")
    fd_grava(D4, "a", {"familias": 14, "fam_compraram": 1, "cliques_soma": 350, "fotos": 350, "fotos_vendidas": 35})
    ok("af_conv_fam" not in tipos(m.af_alertas(D4, D4, agora_hoje=False)), "4: 14 famílias não bastam")
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 2, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok(tipos(m.af_alertas(D4, D4, agora_hoje=False), "a").count("af_conv_fam") == 1, "4: com 3 fotógrafos sai")
    fd_limpa()
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 2, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "b", {"familias": 20, "fam_compraram": 10, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok("af_conv_fam" not in tipos(m.af_alertas(D4, D4, agora_hoje=False)), "4: só 2 fotógrafos: não sai")
    # cliques: poucos e muitos
    fd_limpa()
    fd_grava(D4, "a", {"familias": 14, "cliques_soma": 224, "por_n": {"10": 9, "40": 5}})
    fd_grava(D4, "b", {"familias": 12, "cliques_soma": 12 * 45, "por_n": {"45": 5, "44": 7}})
    fd_grava(D4, "c", {"familias": 4, "cliques_soma": 40, "por_n": {"10": 4}})
    r4b = m.af_alertas(D4, D4, agora_hoje=False)
    pk = {(x["tipo"], x["k"]): x["args"] for x in r4b["alertas"]}
    ok(pk.get(("af_poucos", "a")) == [16.0, 9, 14, 20] and pk.get(("af_muitos", "b")) == [45.0, 12, 12, 40] and ("af_poucos", "c") not in pk,
       "cliques: poucos (média 16, 9 de 14 abaixo de 20), muitos e o mínimo de famílias: %r" % r4b["alertas"])

    # ---------- 7: "Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras" ----------
    D7 = "2026-01-12"
    fd_grava(D7, "marcio", {"familias": 5, "cliques_soma": 150, "fotos": 100, "luz": {"n": 100, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    treino(exposicao="ligada")
    r7 = m.af_alertas(D7, D7, agora_hoje=False)
    l7 = [x for x in r7["alertas"] if x["tipo"] == "af_luz"]
    ok(l7 == [{"tipo": "af_luz", "k": "marcio", "sev": "warn", "args": [20, 100, 12, 8]}], "7: o cartão de 20 de 100: %r" % r7["alertas"])
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 49, "luz": {"n": 49, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    ok("af_luz" not in tipos(m.af_alertas(D7, D7, agora_hoje=False)), "7: com 49 fotos não sai")
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 10, "estouradas": 15, "sem_dado": 0}})
    l7 = [x for x in m.af_alertas(D7, D7, agora_hoje=False)["alertas"] if x["tipo"] == "af_luz"]
    ok(len(l7) == 1 and l7[0]["sev"] == "bad" and l7[0]["args"] == [25, 100, 15, 10], "7: 25%% é grave: %r" % l7)
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 7, "estouradas": 7, "sem_dado": 0}})
    ok("af_luz" not in tipos(m.af_alertas(D7, D7, agora_hoje=False)), "7: 14%% (abaixo de 15) não sai")
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    # ---------- 6: em medir, os números aparecem e nenhum af_luz sai; desligada, nada ----------
    treino(exposicao="medir")
    r6 = m.af_alertas(D7, D7, agora_hoje=False)
    ok(r6["exposicao"] == "medir" and r6["fotografos"][0]["luz"]["n"] == 100 and "af_luz" not in tipos(r6), "6: medir mostra e não alerta: %r" % r6["fotografos"])
    treino(exposicao="desligada")
    ok(m.af_alertas(D7, D7, agora_hoje=False)["fotografos"][0]["luz"] is None, "6: desligada: sem números de luz")
    fd_limpa()
    # desligada: nem o leitor nem a varredura medem
    m.luz_varre()
    m.luz_grava()
    ok(not m.luz_ler(), "6: desligada: nenhuma linha tipo luz nasce")
    # leitor de rostos com detector falso: a medida sai na imagem decodificada, com a caixa do rosto na escala dela
    import numpy as np, cv2, queue
    m._cv.update(cv2=cv2, np=np)
    orig = os.path.join(HOME, "orig.jpg")
    im = np.full((1200, 1800, 3), 5, np.uint8)
    im[400:640, 800:1000] = 255                     # rosto estourado com fundo escuro
    cv2.imwrite(orig, im)
    pl = foto()

    class Det:
        def setInputSize(self, s):
            self.s = s

        def detect(self, img):
            # na imagem reduzida (900 x 600, já metade pelo IMREAD_REDUCED_COLOR_2): caixa 400, 200, 100, 120
            return 1, np.array([[400, 200, 100, 120, 420, 240, 470, 240, 445, 260, 425, 290, 465, 290, 0, 0.95]], np.float32)

    class Rec:
        def alignCrop(self, img, r):
            return img[:10, :10]

        def feature(self, x):
            return np.ones((1, 128), np.float32)

    treino(exposicao="medir")
    fila_ = m.fila_rostos
    fila_.put((0, 0, pl, orig, time.time()))
    th = threading.Thread(target=m.leitor_loop, args=(Det(), Rec(), m.rostos_db()), daemon=True)
    th.start()
    t0 = time.time()
    while time.time() - t0 < 10 and pl not in m.luz_novas:
        time.sleep(0.05)
    v_l = m.luz_novas.get(pl)
    ok(v_l and v_l["src"] == "original" and v_l["r"] and v_l["r"]["p95"] >= 250 and m.luz_classe(v_l) == "estourada", "AF-D4: o leitor mede o original com o rosto: %r" % v_l)
    m.luz_grava()
    ok(m.luz_ler([pl]).get(pl) == v_l, "AF-D4: gravada em lote no treino.db")
    m._cv.clear()
    # ---------- 9: o ajuste (automático ou à mão) não muda a medida nem a contagem ----------
    D9 = m._ff_hoje(time.time() - 8 * 86400)
    l9 = leva(D9, "klassius", 6, cor=4)
    treino(exposicao="medir")
    n_v = m.luz_varre()
    m.luz_grava()
    med9 = {p: v for p, v in m.luz_ler(l9).items()}
    ok(n_v >= 6 and len(med9) == 6 and all(v["src"] == "thumb" and v["r"] is None for v in med9.values()), "6: medir: a varredura mede pela miniatura (Pillow): %r" % n_v)
    a9 = m.af_dia(D9)["klassius"]["luz"]
    m.estado_gravar({"docs": [{"col": "sim", "id": "edits|ag_" + l9[0], "valor": {"b": 60, "c": 20, "s": 0, "auto": True}},
                              {"col": "sim", "id": "edits|ag_" + l9[1], "valor": {"b": 30, "c": 0, "s": 0}}]})
    m.luz_varre()
    m.luz_grava()
    ok(m.luz_ler(l9) == med9 and m.af_dia(D9)["klassius"]["luz"] == a9 and a9["escuras"] == 6, "9: ajuste não muda medida nem contagem: %r" % a9)
    # ---------- 10: LGPD apaga a medida; o agregado da noite seguinte não conta a foto ----------
    m.af_gravar(D9)
    m.lgpd_excluir([l9[0]], [], quem="teste")
    ok(l9[0] not in m.luz_ler(), "10: LGPD apagou a medida")
    d10 = m.af_gravar(D9)["klassius"]
    ok(d10["fotos"] == 5 and d10["luz"]["n"] == 5, "10: o af_dia seguinte não conta a foto: %r" % d10)

    # ---------- 13: calibração: positiva só fraca ou nao_vai com escura ou estourada; "ajustar" fora ----------
    def rotulo(p, nivel, motivos):
        with m.treino_lock:
            db = m.treino_db()
            db.execute("insert or replace into rotulo (pid, v, dia, dados, por, em) values (?, 1, ?, ?, 't', 'x')",
                       (p, D9, json.dumps({"qual": {"nivel": nivel, "motivos": motivos, "ajuste": []}})))
            db.commit()
            db.close()

    def medida(p, cor):
        arr = np.full((60, 90, 3), cor, np.uint8)
        m.luz_acrescenta(p, m.luz_medir(arr))

    with m.treino_lock:
        db = m.treino_db()
        db.execute("delete from medida")
        db.commit()
        db.close()
    pos_e = [foto() for _ in range(30)]
    pos_s = [foto() for _ in range(30)]
    boas = [foto() for _ in range(150)]
    ajus = [foto() for _ in range(5)]
    for p in pos_e:
        rotulo(p, "fraca", ["escura"]); medida(p, 3)
    for p in pos_s:
        rotulo(p, "nao_vai", ["estourada"]); medida(p, 255)
    for p in boas:
        rotulo(p, "boa", []); medida(p, 128)
    for p in ajus:
        rotulo(p, "ajustar", ["escura"]); medida(p, 3)
    m.luz_grava()
    md = m.luz_medida(forcar=True)
    ok(md["classes"]["escura"]["n"] == 30 and md["classes"]["estourada"]["n"] == 30 and md["boas_n"] == 150, "13: ajustar não é positiva: %r" % md["classes"])
    ok(md["classes"]["escura"]["precisao"] == 1.0 and md["classes"]["escura"]["revocacao"] == 1.0 and md["criterio"]["passa"] is True, "13: precisão e revocação: %r" % md)
    ok(set(md["grade"]) == set(m.LUZ_GRADE) and all(len(v) == 5 for v in md["grade"].values()), "13: grade de 5 valores: %r" % md["grade"])

    # ---------- rotas ----------
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    adm = S.cookie_sessao(m, "admin-af")
    R, RU = {"r": True}, {"r": True, "u": True}
    sup = S.cookie_sessao(m, "supervisora-af", {"desempenho": R, "estatisticas": R, "financeiro": R, "configuracao": RU, "qualidade": RU})
    so_est = S.cookie_sessao(m, "so-estatisticas", {"estatisticas": R, "financeiro": R})
    so_des = S.cookie_sessao(m, "so-desempenho", {"desempenho": R})
    fot = S.cookie_sessao(m, "fotografo-af", {"set": {"r": True, "c": True}})

    def pede(metodo, rota, corpo=None, cookie=None, limpa=True):
        if limpa:
            m._janelas.clear()
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        c.request(metodo, rota, json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None, h)
        r = c.getresponse()
        b_ = r.read()
        c.close()
        try:
            return r.status, json.loads(b_ or b"{}")
        except ValueError:
            return r.status, b_

    treino()
    # ---------- 6: ligada sem o critério: 409 criterio com falta; com o critério: 200 e a migração não rebaixa ----------
    m._treino_cfg.update(t=0.0, v=None)
    m.treino_cfg = CFG_REAL
    m.treino_cfg_gravar({"exposicao": "medir"}, "adm")
    with m.treino_lock:
        db = m.treino_db()
        db.execute("delete from rotulo where pid in (%s)" % ",".join("?" * 20), boas[:20])
        db.commit()
        db.close()
    st, r = pede("POST", "/treino/config", {"exposicao": "ligada"}, cookie=sup)
    ok(st == 409 and r.get("error") == "criterio" and any(x["k"] == "boas" and x["tem"] == 130 for x in r.get("falta") or []), "6: ligada sem o critério: 409 com falta: %s %r" % (st, r))
    for p in boas[:20]:
        rotulo(p, "boa", [])
    st, r = pede("POST", "/treino/config", {"exposicao": "ligada"}, cookie=sup)
    ok(st == 200 and r["analise"]["exposicao"] == "ligada", "6: com o critério, liga: %s %r" % (st, r))
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["exposicao"] == "ligada", "6: a migração não rebaixa a Ligada que passou no critério")
    st, r = pede("POST", "/treino/config", {"ponto": "medir"}, cookie=sup)
    m._treino_cfg["t"] = 0.0
    ok(st == 200 and m.treino_cfg()["exposicao"] == "ligada", "6: mudar o ponto não derruba a exposição Ligada")
    m.estado_gravar({"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "desligada", "exposicao": "ligada", "exposicao_ok": True}}]})
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["ponto"] == "medir", "6: config/treino pela sincronização segue recusada")
    st, r = pede("GET", "/fotografos/luz/medida", cookie=sup)
    ok(st == 200 and r["criterio"]["passa"] is True and r["v"] == 1, "calibração pela rota: %s" % st)
    ok(pede("GET", "/fotografos/luz/medida", cookie=so_des)[0] == 403, "calibração sem qualidade.r: 403")
    m._janelas.clear()
    cods = [pede("GET", "/fotografos/luz/medida", cookie=sup, limpa=False)[0] for _ in range(11)]
    ok(cods[:10] == [200] * 10 and cods[10] == 429, "calibração: 10 por minuto: %r" % cods)
    m.treino_cfg_gravar({"exposicao": "desligada"}, "adm")

    # ---------- 8 e 16: permissões no servidor ----------
    for rota in ("/fotografos/alertas?de=%s&ate=%s" % (D3, D3), "/fotografos/dias?de=%s&ate=%s" % (D3, D3)):
        ok(pede("GET", rota)[0] == 401, "8: %s sem sessão: 401" % rota)
        ok(pede("GET", rota, cookie=so_est)[0] == 403, "8: %s sem desempenho.r: 403" % rota)
        ok(pede("GET", rota, cookie=fot)[0] == 403, "8: %s Fotógrafo: 403" % rota)
        ok(pede("GET", rota, cookie=sup)[0] == 200, "8: %s Supervisora: 200" % rota)
    m.af_gravar(D3)
    st, r8 = pede("GET", "/fotografos/alertas?de=%s&ate=%s" % (D3, D3), cookie=sup)
    ok(st == 200 and {x["k"] for x in r8["fotografos"]} == {"marcio", "yago", "carlos"} and r8["limites"]["cliques_min"] == 20, "8: contrato: %r" % r8)
    ok(set(r8) >= {"v", "de", "ate", "limites", "exposicao", "fonte_cliques", "equipe", "fotografos", "alertas"}, "contrato do /fotografos/alertas: %r" % sorted(r8))
    ok(pede("GET", "/fotografos/alertas?de=%s&ate=%s" % (m._dia_mais(D3, -92), D3), cookie=sup)[0] == 400, "alertas: até 92 dias")
    ok(pede("GET", "/fotografos/alertas?de=x&ate=%s" % D3, cookie=sup)[0] == 400, "alertas: data inválida")
    m._janelas.clear()
    cods = [pede("GET", "/fotografos/alertas?de=%s&ate=%s" % (D3, D3), cookie=sup, limpa=False)[0] for _ in range(31)]
    ok(cods[:30] == [200] * 30 and cods[30] == 429, "alertas: 30 por minuto por pessoa: %r" % cods[-3:])
    ok(pede("GET", "/fotografos/dias?de=%s&ate=%s" % (m._dia_mais(D3, -366), D3), cookie=sup)[0] == 400, "dias: até 366 dias")
    # 16: com desempenho.r e sem estatisticas.r, a aba tem dados; com estatisticas.r sem desempenho.r, /metricas/dia sem por_fotografo
    m.metricas_gravar(D3)
    st, rd = pede("GET", "/fotografos/dias?de=%s&ate=%s" % (D3, D3), cookie=so_des)
    pf = (rd.get("dias") or [{}])[0].get("por_fotografo") or {}
    ok(st == 200 and rd["ok"] and pf.get("marcio", {}).get("sessoes") == 1 and set(rd["dias"][0]) == {"dia", "por_fotografo"}, "16: /fotografos/dias com só desempenho.r: %s %r" % (st, rd))
    ok(pede("GET", "/metricas/dia?de=%s&ate=%s" % (D3, D3), cookie=so_des)[0] == 403, "16: só desempenho.r não lê /metricas/dia")
    st, re_ = pede("GET", "/metricas/dia?de=%s&ate=%s" % (D3, D3), cookie=so_est)
    ok(st == 200 and re_["dias"] and "por_fotografo" not in re_["dias"][0] and "sessoes" in re_["dias"][0], "16 e 18: /metricas/dia sem desempenho.r vem sem por_fotografo")
    for ck in (adm, sup):
        st, rr = pede("GET", "/metricas/dia?de=%s&ate=%s" % (D3, D3), cookie=ck)
        ok(st == 200 and "marcio" in (rr["dias"][0].get("por_fotografo") or {}), "16 e 18: Admin e Supervisora seguem com por_fotografo")
    m.metricas.append({"pid": "ab" * 6, "chegada": time.time(), "quem": "marcio", "por": "x"})
    st, rm_ = pede("GET", "/metricas", cookie=so_est)
    ok(st == 200 and rm_["fotos"] and all("quem" not in x and "por" not in x for x in rm_["fotos"]), "AF-D9: /metricas sem o fotógrafo da foto sem desempenho.r")
    st, rm_ = pede("GET", "/metricas", cookie=sup)
    ok(any(x.get("quem") == "marcio" for x in rm_["fotos"]), "AF-D9: /metricas com o fotógrafo da foto para a Supervisora")

    # ---------- 11: POST /fotografos/config ----------
    ok(pede("POST", "/fotografos/config", {"cliques_min": 25})[0] == 401, "11: sem sessão 401")
    ok(pede("POST", "/fotografos/config", {"cliques_min": 25}, cookie=so_des)[0] == 403, "11: sem configuracao.u 403")
    for c_, campo in (({"cliques_min": 40}, "cliques_min"), ({"cliques_min": 45, "cliques_max": 40}, "cliques_min"), ({"x": 1}, "x"),
                      ({"cliques_min": 0}, "cliques_min"), ({"cliques_max": 401}, "cliques_max"), ({"luz_pct": 30}, "luz_pct"),
                      ({"fam_min": 5.5}, "fam_min"), ({"fam_min": True}, "fam_min"), ({"luz": {"rosto_med_baixo": 500}}, "luz.rosto_med_baixo"),
                      ({"luz": {"novo": 1}}, "luz.novo"), ({"v": 2}, "v"), ({}, "corpo")):
        st, r = pede("POST", "/fotografos/config", c_, cookie=sup)
        ok(st == 400 and r.get("error") == "campo" and r.get("campo") == campo, "11: recusa %r: %s %r" % (c_, st, r))
    ok(m.fotografos_cfg()["cliques_min"] == 20, "11: nada mudou")
    pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "fotografos", "valor": dict(m.FOTOGRAFOS_CFG_PADRAO, cliques_min=1)}]}, cookie=adm)
    m._fot_cfg["t"] = 0.0
    ok(m.fotografos_cfg()["cliques_min"] == 20, "11: config/fotografos pelo /ponto/docs é recusada")
    st, r = pede("POST", "/fotografos/config", {"cliques_min": 18, "luz": {"quadro_med_baixo": 50}}, cookie=sup)
    ok(st == 200 and r["limites"]["cliques_min"] == 18 and r["antes"]["cliques_min"] == 20 and set(r["mudou"]) == {"cliques_min", "luz.quadro_med_baixo"}
       and r["por"] == "supervisora-af", "11: mudança válida com antes e depois (auditLog da tela): %s %r" % (st, r))
    m._fot_cfg["t"] = 0.0
    ok(m.fotografos_cfg()["cliques_min"] == 18 and m.luz_limites()["quadro_med_baixo"] == 50 and m.af_st["sujo"] is True, "11: gravado e os 35 dias marcados para refazer")
    m._janelas.clear()
    cods = [pede("POST", "/fotografos/config", {"cliques_min": 20}, cookie=sup, limpa=False)[0] for _ in range(7)]
    ok(cods[:6] == [200] * 6 and cods[6] == 429, "11: 6 por minuto por pessoa: %r" % cods)

    # ---------- 12: o mês congelado é a soma dos dias e não muda depois ----------
    fd_limpa()
    for d_, f_, fam in (("2026-10-03", "marcio", 4), ("2026-10-04", "marcio", 6), ("2026-10-04", "yago", 3), ("2026-11-01", "marcio", 99)):
        fd_grava(d_, f_, {"familias": fam, "cliques_soma": fam * 25, "por_n": {"25": fam}, "fotos": fam * 25, "luz": {"n": fam, "escuras": 1, "estouradas": 0, "sem_dado": 0}})
    soma = m.af_mes("2026-10")
    ok(soma["marcio"]["familias"] == 10 and soma["marcio"]["por_n"] == {"25": 10} and soma["yago"]["familias"] == 3 and soma["marcio"]["luz"]["escuras"] == 2, "12: soma do mês: %r" % soma)
    with open(os.path.join(m.SESS_DIR, "2026-10-05.json"), "w") as f_:
        json.dump({"sessoes": []}, f_)
    ok(m.af_mes_fechar("2026-11-02") == "espera", "12: faltando dia calculado, espera até o dia 5")
    ok(m.af_mes_fechar("2026-11-05") == "fechado", "12: no dia 5 fecha mesmo assim")
    lin = m.op_ler("select dados from fotografo_mes where mes = '2026-10'")
    ok(lin and json.loads(lin[0][0]) == soma, "12: congelado = soma dos fotografo_dia")
    fd_grava("2026-10-03", "marcio", {"familias": 50})
    ok(m.af_mes_fechar("2026-11-05") == "ja" and json.loads(m.op_ler("select dados from fotografo_mes where mes = '2026-10'")[0][0]) == soma, "12: não muda depois")
    ok(m.af_mes_fechar("2026-11-06") == "fora", "12: depois do dia 5 nada")

    # /status: luz e estatisticas.af só com números
    st, s_ = pede("GET", "/status", cookie=sup)
    lz = s_.get("luz") or {}
    ok(st == 200 and set(lz) == {"v", "medidas_hoje", "fila", "ms_med", "varredura", "opencv"} and "af" in (s_.get("estatisticas") or {}), "/status.luz e estatisticas.af: %r" % lz)
    txt = json.dumps(lz) + json.dumps(s_["estatisticas"]["af"])
    ok(not any(p in txt for p in list(m.lib)[:300]) and HOME not in txt, "/status sem pid nem caminho")
    # nenhum texto de hora, presença ou falta nas respostas novas
    rr = json.dumps(m.af_alertas(D3, D3, agora_hoje=False), ensure_ascii=False).lower()
    ok(not any(x in rr for x in ("presen", "falta", "atraso", "turno", "hora")), "sem hora, presença ou falta: %s" % rr[:200])
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1800:])
m.luz_parar.set()
print(("OK" if not falhas else "FALHA") + " af_agente: alertas do fotógrafo no servidor (critérios 1 a 4, 6 a 13, servidor dos 16 e 18) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:14])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
