# 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md): alertas do fotógrafo no servidor. Critérios 1 a 4, 6 a 8, 10 a
# 13 e a parte do servidor dos 16 e 18, com sessões, cena.db, vendas.db e medidas sintéticas (nenhuma foto real, nenhum número
# de venda real), as rotas com sessões de teste e o leitor de rostos com um detector falso (a medida sai na imagem decodificada).
# Revisão de 23/11 (R1 a R4 e a decisão 3): varredura de dia só nas marcadas e com teto por hora, o resto de madrugada, espera
# pelo leitor e pela selfie, pula a foto que o leitor ainda não leu, OpenCV com 1 thread só durante a varredura; limite de luz
# novo refaz só os 7 dias recentes na hora; o mês congela do dia 4 em diante, depois da madrugada, e fecha o mês atrasado; com a
# exposição Ligada, limite de luz novo confere o critério (409); o dia conta pelo ponto pelo estado daquele dia.
#   HOME=$(mktemp -d) python3 -I testes/fot_agente.py agente/eterna-agente.py
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
    base = {"v": 1, "familias": 0, "cliques_soma": 0, "chute_soma": 0, "nao_contadas": 0, "por_n": {},
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


def liga_log(em):
    with m.treino_lock:
        db = m.treino_db()
        db.execute("insert into liga_log values (?,?,?,?,?)", (em, "t", 0, "c1-teste", "{}"))
        db.commit()
        db.close()


def calc_em(dia):
    r = m.op_ler("select em, ponto from fotografo_dia_calc where dia = ?", (dia,))
    return r[0] if r else (None, None)


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
    # decisão 3: dia passado sem registro e sem nenhum Ligar no liga_log até ele: não conta pelo ponto, mesmo Ligado agora
    ok(m.fot_dia(D1)["marcio"]["fonte"] == "todas", "decisão 3: sem Ligar no liga_log até o dia, conta todas")
    liga_log(m._iso(time.time() - 10 * 86400))      # o ponto foi ligado 10 dias atrás (e continua Ligado)
    d1 = m.fot_dia(D1)["marcio"]
    ok(d1["familias"] == 3 and d1["cliques_soma"] == 80 and round(d1["cliques_soma"] / d1["familias"], 1) == 26.7, "1: média 26,7: %r" % d1)
    ok(d1["por_n"] == {"10": 1, "25": 1, "45": 1} and "hist" not in d1 and "lim" not in d1, "1: 1 abaixo de 20 e 1 acima de 40 (por_n; sem hist nem lim): %r" % d1)
    ok(d1["chute_soma"] == 4 and d1["nao_contadas"] == 2 + 1 + 3 and d1["fonte"] == "ponto" and d1["fotos"] == 90, "1: chute à parte, outro e sem leitura em nao_contadas: %r" % d1)
    ok(not any(k in json.dumps(d1) for k in a + b + c), "1: o agregado não tem pid")
    # ---------- 2: ponto desligado: conta todas as fotos da leva ----------
    treino(ponto="desligada")
    d2 = m.fot_dia(D1)["marcio"]
    ok(d2["fonte"] == "todas" and d2["cliques_soma"] == 90 and d2["por_n"] == {"15": 1, "27": 1, "48": 1} and d2["chute_soma"] == 0, "2: todas as fotos: %r" % d2)
    m.fot_gravar(D1)
    r2 = m.fot_alertas(D1, D1, agora_hoje=False)
    ok(r2["fonte_cliques"] == "todas", "2: fonte_cliques todas: %r" % r2["fonte_cliques"])
    treino(ponto="ligada")
    m.fot_gravar(D1)
    ok(m.fot_alertas(D1, D1, agora_hoje=False)["fonte_cliques"] == "ponto", "2: com o ponto Ligado, fonte ponto")
    # cobertura: dia com o ponto Ligado mas sem leitura (antes de ligar) conta todas as fotos
    sem = leva(D2, "yago", 22)
    ok(m.fot_dia(D2)["yago"]["fonte"] == "todas" and m.fot_dia(D2)["yago"]["cliques_soma"] == 22, "2: dia sem leitura do ponto conta todas")
    # decisão 3: hoje grava o estado do reconhecimento; o dia passado usa o que ficou gravado, não o interruptor de agora
    m.fot_gravar(HOJE)
    ok(calc_em(HOJE)[1] == 1 and calc_em(D1)[1] is None, "decisão 3: hoje grava ponto=1; dia passado não grava estado: %r %r" % (calc_em(HOJE), calc_em(D1)))
    AMANHA = m._dia_mais(HOJE, 1)
    treino(ponto="desligada")
    ok(m._fot_ponto_no_dia(HOJE, hoje=AMANHA) is True and m._fot_ponto_no_dia(HOJE) is False, "decisão 3: o dia vale pelo estado gravado nele")
    m.fot_gravar(HOJE)
    treino(ponto="ligada")
    ok(calc_em(HOJE)[1] == 0 and m._fot_ponto_no_dia(HOJE, hoje=AMANHA) is False, "decisão 3: desligado no dia, não conta pelo ponto depois")
    ok(m._fot_ponto_no_dia(m._dia_mais(HOJE, -11)) is False and m._fot_ponto_no_dia(D1) is True, "decisão 3: liga_log antes e depois do Ligar")
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
    d3 = m.fot_dia(D3)
    ok(d3["marcio"]["fam_compraram"] == 1 and d3["marcio"]["fotos_vendidas"] == 1, "3: A comprou, 1 foto dele: %r" % d3["marcio"])
    ok(d3["yago"]["fam_compraram"] == 1 and d3["yago"]["fotos_vendidas"] == 2 and d3["yago"]["familias"] == 2, "3: B comprou (2 fotos dele), a cancelada não conta: %r" % d3["yago"])
    ok(d3["carlos"]["fam_compraram"] == 1 and d3["carlos"]["fotos_vendidas"] == 0, "3: a base do aiSel conta a leva, sem foto vendida: %r" % d3["carlos"])

    # ---------- 4: fot_conv_fam: 15 famílias, 3 fotógrafos e 10 pontos abaixo da média ponderada da equipe toda ----------
    D4 = "2026-01-10"
    fd_limpa()
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 6, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "b", {"familias": 20, "fam_compraram": 10, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "c", {"familias": 20, "fam_compraram": 8, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    r4 = m.fot_alertas(D4, D4, agora_hoje=False)
    al = [x for x in r4["alertas"] if x["tipo"] == "fot_conv_fam"]
    ok(len(al) == 1 and al[0]["k"] == "a" and al[0]["args"] == [30, 40, 6, 20], "4: exatamente 10 pontos abaixo (30%% x 40%%) sai: %r" % r4["alertas"])
    ok({k: r4["equipe"][k] for k in ("familias", "fam_compraram", "fotos", "fotos_vendidas", "cliques_soma")} == {"familias": 60, "fam_compraram": 24, "fotos": 1500, "fotos_vendidas": 150, "cliques_soma": 1500},
       "4: equipe toda: %r" % r4["equipe"])
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 7, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok("fot_conv_fam" not in tipos(m.fot_alertas(D4, D4, agora_hoje=False)), "4: 35%% contra 41,7%% (menos de 10 pontos) não sai")
    fd_grava(D4, "a", {"familias": 14, "fam_compraram": 1, "cliques_soma": 350, "fotos": 350, "fotos_vendidas": 35})
    ok("fot_conv_fam" not in tipos(m.fot_alertas(D4, D4, agora_hoje=False)), "4: 14 famílias não bastam")
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 2, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok(tipos(m.fot_alertas(D4, D4, agora_hoje=False), "a").count("fot_conv_fam") == 1, "4: com 3 fotógrafos sai")
    fd_limpa()
    fd_grava(D4, "a", {"familias": 20, "fam_compraram": 2, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    fd_grava(D4, "b", {"familias": 20, "fam_compraram": 10, "cliques_soma": 500, "fotos": 500, "fotos_vendidas": 50})
    ok("fot_conv_fam" not in tipos(m.fot_alertas(D4, D4, agora_hoje=False)), "4: só 2 fotógrafos: não sai")
    # cliques: poucos e muitos
    fd_limpa()
    fd_grava(D4, "a", {"familias": 14, "cliques_soma": 224, "por_n": {"10": 9, "40": 5}})
    fd_grava(D4, "b", {"familias": 12, "cliques_soma": 12 * 45, "por_n": {"45": 5, "44": 7}})
    fd_grava(D4, "c", {"familias": 4, "cliques_soma": 40, "por_n": {"10": 4}})
    r4b = m.fot_alertas(D4, D4, agora_hoje=False)
    pk = {(x["tipo"], x["k"]): x["args"] for x in r4b["alertas"]}
    ok(pk.get(("fot_poucos", "a")) == [16.0, 9, 14, 20] and pk.get(("fot_muitos", "b")) == [45.0, 12, 12, 40] and ("fot_poucos", "c") not in pk,
       "cliques: poucos (média 16, 9 de 14 abaixo de 20), muitos e o mínimo de famílias: %r" % r4b["alertas"])

    # ---------- 7: "Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras" ----------
    D7 = "2026-01-12"
    fd_grava(D7, "marcio", {"familias": 5, "cliques_soma": 150, "fotos": 100, "luz": {"n": 100, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    treino(exposicao="ligada")
    r7 = m.fot_alertas(D7, D7, agora_hoje=False)
    l7 = [x for x in r7["alertas"] if x["tipo"] == "fot_luz"]
    ok(l7 == [{"tipo": "fot_luz", "k": "marcio", "sev": "warn", "args": [20, 100, 12, 8]}], "7: o cartão de 20 de 100: %r" % r7["alertas"])
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 49, "luz": {"n": 49, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    ok("fot_luz" not in tipos(m.fot_alertas(D7, D7, agora_hoje=False)), "7: com 49 fotos não sai")
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 10, "estouradas": 15, "sem_dado": 0}})
    l7 = [x for x in m.fot_alertas(D7, D7, agora_hoje=False)["alertas"] if x["tipo"] == "fot_luz"]
    ok(len(l7) == 1 and l7[0]["sev"] == "bad" and l7[0]["args"] == [25, 100, 15, 10], "7: 25%% é grave: %r" % l7)
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 7, "estouradas": 7, "sem_dado": 0}})
    ok("fot_luz" not in tipos(m.fot_alertas(D7, D7, agora_hoje=False)), "7: 14%% (abaixo de 15) não sai")
    fd_grava(D7, "marcio", {"familias": 5, "fotos": 100, "luz": {"n": 100, "escuras": 8, "estouradas": 12, "sem_dado": 0}})
    # ---------- 6: em medir, os números aparecem e nenhum fot_luz sai; desligada, nada ----------
    treino(exposicao="medir")
    r6 = m.fot_alertas(D7, D7, agora_hoje=False)
    ok(r6["exposicao"] == "medir" and r6["fotografos"][0]["luz"]["n"] == 100 and "fot_luz" not in tipos(r6), "6: medir mostra e não alerta: %r" % r6["fotografos"])
    treino(exposicao="desligada")
    ok(m.fot_alertas(D7, D7, agora_hoje=False)["fotografos"][0]["luz"] is None, "6: desligada: sem números de luz")
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
    ok(m.luz_varre(noite=False) == 0, "R1: de dia, sem foto marcada no Treino, a varredura não mede nada")
    n_v = m.luz_varre(noite=True)
    m.luz_grava()
    med9 = {p: v for p, v in m.luz_ler(l9).items()}
    ok(n_v >= 6 and len(med9) == 6 and all(v["src"] == "original" and v["r"] is None for v in med9.values()), "6: medir: de madrugada a varredura mede pelo original (Pillow): %r" % n_v)
    a9 = m.fot_dia(D9)["klassius"]["luz"]
    m.estado_gravar({"docs": [{"col": "sim", "id": "edits|ag_" + l9[0], "valor": {"b": 60, "c": 20, "s": 0, "auto": True}},
                              {"col": "sim", "id": "edits|ag_" + l9[1], "valor": {"b": 30, "c": 0, "s": 0}}]})
    m.luz_varre(noite=True)
    m.luz_grava()
    ok(m.luz_ler(l9) == med9 and m.fot_dia(D9)["klassius"]["luz"] == a9 and a9["escuras"] == 6, "9: ajuste não muda medida nem contagem: %r" % a9)
    # ---------- 10: LGPD apaga a medida; o agregado da noite seguinte não conta a foto ----------
    m.fot_gravar(D9)
    m.lgpd_excluir([l9[0]], [], quem="teste")
    ok(l9[0] not in m.luz_ler(), "10: LGPD apagou a medida")
    d10 = m.fot_gravar(D9)["klassius"]
    ok(d10["fotos"] == 5 and d10["luz"]["n"] == 5, "10: o fot_dia seguinte não conta a foto: %r" % d10)

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
    # medida de outra fonte (miniatura, de antes da revisão) não entra na calibração
    th_ = pos_e[0]
    m.luz_acrescenta(th_, dict(m.luz_medir(np.full((60, 90, 3), 128, np.uint8)), src="thumb"))
    m.luz_grava()
    ok(m.luz_medida(forcar=True)["classes"]["escura"]["n"] == 29, "R: a calibração só usa medidas do original")
    m.luz_acrescenta(th_, m.luz_medir(np.full((60, 90, 3), 3, np.uint8)))
    m.luz_grava()

    # ---------- R1: varredura: de dia só as marcadas e até LUZ_HORA_MAX por hora; o resto de madrugada; pula a não lida ----------
    D_R = m._ff_hoje(time.time() - 2 * 86400)
    rv = leva(D_R, "samuel", 8, cor=250)
    for p in rv[:5]:
        rotulo(p, "ajustar", ["escura"])            # marcada no Treino (não entra na calibração)
    treino(exposicao="medir")
    m.luz_varre(noite=True)                          # o que ficou de antes, de madrugada
    m.luz_grava()
    with m.treino_lock:
        db = m.treino_db()
        db.execute("delete from medida where pid in (%s)" % ",".join("?" * 8), rv)
        db.commit()
        db.close()
    teto = m.LUZ_HORA_MAX
    m.LUZ_HORA_MAX = 3
    m.luz_st.update(hora="", hora_n=0)
    n1 = m.luz_varre(noite=False)
    n2 = m.luz_varre(noite=False)
    m.luz_grava()
    feitas_r = set(m.luz_ler(rv))
    ok(n1 == 3 and n2 == 0 and feitas_r <= set(rv[:5]) and len(feitas_r) == 3, "R1: de dia, só marcadas e no máximo 3 por hora: %r %r %r" % (n1, n2, len(feitas_r)))
    m.luz_st.update(hora="2000-01-01 00")            # outra hora: mais 2 marcadas e nenhuma do resto
    ok(m.luz_varre(noite=False) == 2 and m.luz_st["pendentes"] == 3, "R1: na hora seguinte, as 2 marcadas que faltavam: %r" % m.luz_st)
    m.luz_grava()
    ok(set(m.luz_ler(rv)) == set(rv[:5]), "R1: o resto espera a madrugada")
    m.LUZ_HORA_MAX = teto
    # pula a foto que o leitor ainda não leu (ele mesmo mede): com o leitor ligado, só as que estão em rostos.db foto
    m.rostos["ligado"] = True
    rdb = m.rostos_db()
    rdb.execute("insert or replace into foto values (?,?,?,?)", (rv[5], D_R, 0, time.time()))
    rdb.commit()
    rdb.close()
    pr_, resto_ = m.luz_pendentes()
    ok(rv[5] in resto_ and rv[6] not in resto_ and rv[7] not in resto_, "R1: a foto ainda não lida pelo leitor fica de fora")
    ok(m.luz_varre(noite=True) >= 1 and not m.luz_pendentes()[1], "R1: de madrugada mede o resto (só a já lida)")
    m.luz_grava()
    ok(rv[5] in m.luz_ler(rv) and rv[6] not in m.luz_ler(rv), "R1: não mede duas vezes a foto que o leitor vai ler")
    m.rostos["ligado"] = False
    # espera o leitor e a selfie; o OpenCV fica com 1 thread só durante a varredura e volta antes de esperar e no fim
    class Q1:
        def qsize(self):
            return 1
    fila_real = m.fila_rostos
    m.fila_rostos = Q1()
    ok(m._luz_ocupado() is True, "R1: fila do leitor com foto: ocupado")
    m.fila_rostos = fila_real
    ok(m._luz_ocupado() is False, "R1: fila vazia: livre")
    m._lendo[0] += 1
    ok(m._luz_ocupado() is True, "R1: leitor lendo: ocupado")
    m._lendo[0] -= 1
    with m._busca_lock:
        ok(m._luz_ocupado() is True, "R1: selfie buscando: ocupado")
    import cv2 as cv2_
    registro, nth = [], [8]

    class CvEspia:
        def __getattr__(self, k):
            return getattr(cv2_, k)

        def getNumThreads(self):
            return nth[0]

        def setNumThreads(self, n):
            registro.append(("set", n))
            nth[0] = n

        def imread(self, f, fl=None):
            registro.append(("le", nth[0]))
            return cv2_.imread(f, fl)

    rw = leva(D_R, "samuel", 3, cor=60)
    m._cv.update(cv2=CvEspia(), np=np)
    # livre na 1ª foto (antes e depois do uma); na 2ª, o leitor pegou uma foto antes: espera; na 3ª (S4), o leitor começa entre a
    # espera e o uma(): a conferência depois do uma() volta o OpenCV, espera e só então mede
    ocup = iter([False, False, True, True, False, False, False, True, False, False])
    luz_ocupado_real = m._luz_ocupado
    m._luz_ocupado = lambda: next(ocup, False)
    t_w = time.time()
    n_w = m.luz_varre(noite=True)
    m._luz_ocupado = luz_ocupado_real
    m._cv.clear()
    ok(n_w >= 3 and time.time() - t_w >= 3.9, "R1: esperou o leitor antes de medir: %r" % n_w)
    ok(registro[4:8] == [("le", 1), ("set", 8), ("set", 1), ("le", 1)], "S4: leitor começou depois do uma(): volta o OpenCV e espera antes de medir: %r" % registro)
    # junção com as poses: a luz cede à classificação de poses (as poses não olham a luz: sem espera circular)
    livre = m._luz_ocupado()
    m.poses_st["rodando"] = True
    ocupado_poses = m._luz_ocupado()
    m.poses_st["rodando"] = False
    ok(not livre and ocupado_poses and m._luz_ocupado() is False, "luz e poses: a varredura espera a classificação de poses: %r" % [livre, ocupado_poses])
    sets = [x for x in registro if x[0] == "set"]
    ok(registro[:4] == [("set", 1), ("le", 1), ("set", 8), ("set", 1)] and sets[-1] == ("set", 8) and all(x == ("le", 1) for x in registro if x[0] == "le"),
       "R1: OpenCV com 1 thread só durante a varredura e de volta no fim: %r" % registro)
    m.luz_grava()
    ok(set(rw) <= set(m.luz_ler(rw)) and nth[0] == 8, "R1: a varredura com OpenCV mediu as fotos novas")

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
    m.fot_gravar(D3)
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
    so_cfg = S.cookie_sessao(m, "so-config", {"configuracao": RU})
    ok(pede("POST", "/fotografos/config", {"cliques_min": 25}, cookie=so_cfg)[0] == 403, "R: configuracao.u sem desempenho.r: 403")
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
    D_V = m._dia_mais(HOJE, -10)
    m.fot_gravar(D_V)
    em_v = calc_em(D_V)[0]
    m.fot_st["sujo"] = False
    time.sleep(1.1)
    t_r = m._iso()
    st, r = pede("POST", "/fotografos/config", {"cliques_min": 18, "luz": {"quadro_med_baixo": 50}}, cookie=sup)
    ok(st == 200 and r.get("refeitos") == 7 and r.get("noite") is True, "R2: limite de luz novo refaz 7 dias na hora: %r" % r)
    ok(all((calc_em(m._dia_mais(HOJE, -i))[0] or "") >= t_r for i in range(7)) and calc_em(D_V)[0] == em_v,
       "R2: hoje e os 6 dias antes refeitos; o dia 10 não: %r" % ([calc_em(m._dia_mais(HOJE, -i))[0] for i in range(8)] + [em_v, t_r],))
    m.fot_rodada(HOJE, False, hora=12)
    ok(calc_em(D_V)[0] == em_v and m.fot_st["sujo"] is True, "R2: fora da madrugada o resto não é refeito")
    ok(m.fot_alertas(HOJE, HOJE, agora_hoje=False)["sujo"] is True, "R2: a resposta avisa que os dias antigos esperam a madrugada")
    m.fot_st["noite"] = None
    m.fot_rodada(HOJE, False, hora=3)
    ok(calc_em(D_V)[0] > em_v and m.fot_st["sujo"] is False and m.fot_st["noite"] == HOJE, "R2: a madrugada refaz o resto e limpa o sujo")
    ok(st == 200 and r["limites"]["cliques_min"] == 18 and r["antes"]["cliques_min"] == 20 and set(r["mudou"]) == {"cliques_min", "luz.quadro_med_baixo"}
       and r["por"] == "supervisora-af", "11: mudança válida com antes e depois (auditLog da tela): %s %r" % (st, r))
    m._fot_cfg["t"] = 0.0
    ok(m.fotografos_cfg()["cliques_min"] == 18 and m.luz_limites()["quadro_med_baixo"] == 50, "11: gravado")
    def rev_cfg():
        with m.estado_lock:
            db = m.estado_db()
            try:
                return db.execute("select rev, valor from doc where col = 'config' and id = 'fotografos'").fetchone()
            finally:
                db.close()
    rv0 = rev_cfg()
    st, r = pede("POST", "/fotografos/config", {"cliques_min": 18, "luz": {"quadro_med_baixo": 50}}, cookie=sup)
    ok(st == 200 and r.get("igual") is True and r["mudou"] == [] and rev_cfg() == rv0, "R: sem mudança não regrava nem sobe o rev: %r" % r)
    # R4: com a exposição Ligada, limite de luz novo confere o critério com os limites novos; sem passar, 409 e nada gravado
    m._treino_cfg.update(t=0.0, v=None)
    st, r = pede("POST", "/treino/config", {"exposicao": "ligada"}, cookie=sup)
    ok(st == 200 and r["analise"]["exposicao"] == "ligada", "R4: a exposição liga (critério ok): %s %r" % (st, r))
    st, r = pede("POST", "/fotografos/config", {"luz": {"quadro_med_baixo": 1, "quadro_baixo_pct": 100}}, cookie=sup)
    m._fot_cfg["t"] = 0.0
    ok(st == 409 and r.get("error") == "criterio" and any(x["k"] == "revocacao_escura" for x in r.get("falta") or []) and m.luz_limites()["quadro_med_baixo"] == 50,
       "R4: limite de luz que derruba o critério com a exposição Ligada: 409 e nada gravado: %s %r" % (st, r))
    st, r = pede("POST", "/fotografos/config", {"luz": {"quadro_med_baixo": 40}}, cookie=sup)
    m._fot_cfg["t"] = 0.0
    ok(st == 200 and m.luz_limites()["quadro_med_baixo"] == 40, "R4: limite que passa no critério grava: %s %r" % (st, r))
    st, r = pede("POST", "/fotografos/config", {"cliques_min": 19}, cookie=sup)
    ok(st == 200, "R4: com a exposição Ligada, mudar só os outros limites não confere a luz")
    pede("POST", "/treino/config", {"exposicao": "desligada"}, cookie=sup)
    m._janelas.clear()
    cods = [pede("POST", "/fotografos/config", {"cliques_min": 20}, cookie=sup, limpa=False)[0] for _ in range(7)]
    ok(cods[:6] == [200] * 6 and cods[6] == 429, "11: 6 por minuto por pessoa: %r" % cods)
    # S3 (revisão): POST de limite de luz no meio da rodada da madrugada. A rodada grava cada dia com o fot_lock; o POST refaz os
    # dias recentes entre um dia e outro; no fim, os dias já feitos ficaram com o limite antigo: o sujo fica e a noite não conta
    D_MEIO = m._dia_mais(HOJE, -20)
    orig_gravar, sem_lock, post = m.fot_gravar, [], {}

    def gravar_espia(dia):
        if threading.current_thread() is threading.main_thread() and not m.fot_lock.locked():
            sem_lock.append(dia)
        r_ = orig_gravar(dia)
        if dia == D_MEIO and "t" not in post and threading.current_thread() is threading.main_thread():
            rev = m.fot_st["luz_rev"]
            post["t"] = threading.Thread(target=lambda: post.update(r=m.fotografos_cfg_gravar({"luz": {"quadro_med_baixo": 45}}, "supervisora-af")))
            post["t"].start()
            fim = time.time() + 10
            while m.fot_st["luz_rev"] == rev and time.time() < fim:   # o POST gravou o limite; o refazer espera o fot_lock da rodada
                time.sleep(0.01)
        return r_
    m.fot_gravar = gravar_espia
    try:
        m.fot_st.update(noite=None, sujo=False)
        m.fot_rodada(HOJE, True, hora=3)
        post["t"].join(20)
    finally:
        m.fot_gravar = orig_gravar
    st_p, r_p = post.get("r") or (None, {})
    m._fot_cfg["t"] = 0.0
    ok(st_p == 200 and r_p.get("refeitos") == 7 and m.luz_limites()["quadro_med_baixo"] == 45, "S3: o POST no meio da rodada grava e refaz 7 dias: %s %r" % (st_p, r_p))
    ok(not sem_lock, "S3: a rodada grava cada dia com o fot_lock: %r" % sem_lock)
    ok(m.fot_st["sujo"] is True and m.fot_st["noite"] != HOJE, "S3: limite mudou durante a rodada: o sujo fica e a noite não conta: %r" % m.fot_st)
    ok(m.fot_alertas(HOJE, HOJE, agora_hoje=False)["refeitos"] == 7, "S3: a resposta dos alertas traz quantos dias foram refeitos")
    em_meio = calc_em(D_MEIO)[0]
    time.sleep(1.1)
    m.fot_rodada(HOJE, False, hora=3)
    ok(m.fot_st["sujo"] is False and m.fot_st["noite"] == HOJE and calc_em(D_MEIO)[0] > em_meio,
       "S3: a próxima volta na janela refaz com o limite novo e limpa o sujo: %r" % m.fot_st)
    orig_refaz = m.fot_dia
    m.fot_dia = lambda d: (_ for _ in ()).throw(RuntimeError("teste"))
    try:
        ok(m.fot_refaz_recentes() == 0 and m.fot_st["refeitos"] == 0, "S5: refazer que falha devolve 0 (a tela não diz que refez)")
    finally:
        m.fot_dia = orig_refaz

    # ---------- 12 e R3: o mês congelado é a soma dos dias, não muda depois; só do dia 4 em diante e depois da madrugada ----------
    fd_limpa()
    for d_, f_, fam in (("2025-02-03", "marcio", 4), ("2025-02-04", "marcio", 6), ("2025-02-04", "yago", 3), ("2025-03-01", "marcio", 99)):
        fd_grava(d_, f_, {"familias": fam, "cliques_soma": fam * 25, "por_n": {"25": fam}, "fotos": fam * 25, "luz": {"n": fam, "escuras": 1, "estouradas": 0, "sem_dado": 0}})
    soma = m.fot_mes("2025-02")
    ok(soma["marcio"]["familias"] == 10 and soma["marcio"]["por_n"] == {"25": 10} and soma["yago"]["familias"] == 3 and soma["marcio"]["luz"]["escuras"] == 2, "12: soma do mês: %r" % soma)
    with open(os.path.join(m.SESS_DIR, "2025-02-05.json"), "w") as f_:
        json.dump({"sessoes": []}, f_)
    ok(m.fot_mes_fechar("2025-03-01", noite=True) == "cedo" and m.fot_mes_fechar("2025-03-03", noite=True) == "cedo", "R3: antes do dia 4 não congela")
    ok(m.fot_mes_fechar("2025-03-04", noite=False) == "noite", "R3: no dia 4, só depois da rodada da madrugada")
    m.fot_st["noite"] = "2025-03-04"
    ok(m.fot_mes_fechar("2025-03-04") == "espera", "12: faltando dia calculado, espera até o dia 5 (madrugada já feita)")
    ok(not m.op_ler("select 1 from fotografo_mes where mes = '2025-02'"), "R3: nada congelado ainda")
    ok(m.fot_mes_fechar("2025-03-05", noite=True) == "fechado", "12: no dia 5 fecha (calcula o dia que faltava)")
    ok(calc_em("2025-02-05")[0] is not None, "R3: o dia que faltava foi calculado antes de congelar")
    lin = m.op_ler("select dados from fotografo_mes where mes = '2025-02'")
    ok(lin and json.loads(lin[0][0]) == soma == m.fot_mes("2025-02"), "12: congelado = soma dos fotografo_dia")
    fd_grava("2025-02-03", "marcio", {"familias": 50})
    ok(m.fot_mes_fechar("2025-03-05", noite=True) == "ja" and json.loads(m.op_ler("select dados from fotografo_mes where mes = '2025-02'")[0][0]) == soma, "12: não muda depois")
    # mês que ficou para trás (agente parado entre os dias 1 e 5) e mês mais antigo sem fechamento: fecham depois da madrugada
    fd_grava("2025-04-10", "carlos", {"familias": 7, "cliques_soma": 175, "por_n": {"25": 7}, "fotos": 175})
    fd_grava("2025-01-15", "carlos", {"familias": 2, "cliques_soma": 50, "por_n": {"25": 2}, "fotos": 50})
    ok(m.fot_mes_fechar("2025-05-20", noite=False) == "noite", "R3: atrasado também espera a madrugada")
    ok(m.fot_mes_fechar("2025-05-20", noite=True) == "fechado", "R3: fecha o mês atrasado")
    meses = {r[0]: json.loads(r[1]) for r in m.op_ler("select mes, dados from fotografo_mes")}
    ok(meses.get("2025-04", {}).get("carlos", {}).get("familias") == 7 and meses.get("2025-01", {}).get("carlos", {}).get("familias") == 2,
       "R3: o mês atrasado e o mais antigo congelados: %r" % sorted(meses))
    ok(m.fot_mes_fechar("2025-05-21", noite=True) == "ja", "R3: nada mais a fechar")

    # /status: luz e estatisticas.fot só com números
    st, s_ = pede("GET", "/status", cookie=sup)
    lz = s_.get("luz") or {}
    ok(st == 200 and set(lz) == {"v", "medidas_hoje", "fila", "ms_med", "varredura", "opencv"} and "fot" in (s_.get("estatisticas") or {})
       and "af" not in (s_.get("estatisticas") or {}), "/status.luz e estatisticas.fot: %r" % lz)
    txt = json.dumps(lz) + json.dumps(s_["estatisticas"]["fot"])
    ok(not any(p in txt for p in list(m.lib)[:300]) and HOME not in txt, "/status sem pid nem caminho")
    # nenhum texto de hora, presença ou falta nas respostas novas
    rr = json.dumps(m.fot_alertas(D3, D3, agora_hoje=False), ensure_ascii=False).lower()
    ok(not any(x in rr for x in ("presen", "falta", "atraso", "turno", "hora")), "sem hora, presença ou falta: %s" % rr[:200])
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1800:])
m.luz_parar.set()
print(("OK" if not falhas else "FALHA") + " fot_agente: alertas do fotógrafo no servidor (critérios 1 a 4, 6 a 13, servidor dos 16 e 18) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:14])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
