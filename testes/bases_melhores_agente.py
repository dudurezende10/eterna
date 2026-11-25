# 24/11 (plano docs/planos/2026-11-24-bases-melhores.md): as bases dos fundos de IA são as duas fotos de gramado de MAIOR
# NOTA entre as 8 primeiras candidatas. Critérios de aceite 1 a 10 no agente: modo "primeiras" (pela chave e por
# ETERNA_BASES) igual à regra de antes; sem sinal, igual; troca por margem; vetos; candidata sem recorte no fechamento;
# escolha congelada (nota nova, rótulo novo, chave e reinício); cena_pendente e Separar; LGPD e teto dos caches; só o Admin
# troca a chave; aba antiga não zera o valor; nada de pid, card ou caminho no /status nem no console.
# A classificação (cena_mem) e as medidas do recorte entram direto na memória: nenhum processo de recorte ou de cena roda aqui
# (o caminho de verdade até o cena_mem é do testes/cena_agente.py). Nenhuma foto de convidado.
#   USER=claude HOME=$(mktemp -d) python3 -I testes/bases_melhores_agente.py agente/eterna-agente.py
import contextlib, http.client, importlib.util, io, json, os, re, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S              # para aqui se o HOME não for temporário

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS", "ETERNA_BASES"):
    os.environ.pop(k, None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
json.dump({"users": {n: "x" * 12 for n in ("carlos", "yago")}}, open(os.path.join(HOME, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
m.FUNCAO_DIA_ON = False
falhas = []
console = io.StringIO()                 # tudo o que o agente imprime durante o teste (conferido no fim: sem pid nem card)


def ok(c, msg):
    if not c:
        falhas.append(msg)


LV = "c1-teste-bases"
HOJE = m._ff_hoje()
PASTA = os.path.join(m.INBOX if hasattr(m, "INBOX") else os.path.join(HOME, "Eterna", "inbox"), HOJE)
os.makedirs(PASTA, exist_ok=True)


def chave(modo, ponto="ligada"):
    """O interruptor na memória, sem relógio (o teste não liga o treino_cfg_loop)."""
    m._treino_cfg.update(t=time.time() + 10 ** 9, v={"ponto": ponto, "exposicao": "desligada", "bases": modo, "ponto_versao": LV if ponto == "ligada" else None,
                                                    "por": "teste", "em": None, "abaixo": None, "exposicao_ok": False})


chave("melhores")
ok(m.ia_cfg_mem().get("ligada") and m.ia_cfg_mem().get("cliques") == 2, "preparo: regra dos cliques ligada com 2")
ok(m.BASE_POOL_MAX == 8 and m.BASE_NOTA_MARGEM == 10, "constantes: 8 primeiras e margem de 10")

T = time.time() - 900
_s = [0]
_n = [0]
TODOS = []
# medidas do recorte
JOELHO = {"trunc": True, "borda": [], "luz": {"med": 120.0, "p95": 200.0}, "joelho": None, "pernas": False}    # corpo 30
PERNAS = {"trunc": True, "borda": [], "luz": {"med": 120.0, "p95": 200.0}, "joelho": 0.8, "pernas": True}      # corpo 20
CHAO = {"trunc": False, "borda": [], "luz": {"med": 120.0, "p95": 200.0}, "joelho": 0.7, "pernas": True}       # corpo 0
G = lambda rec=JOELHO, **k: dict(g=True, rec=rec, **k)
FORA = dict(g=False, rec=None)


def reset():
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info, m.sess_faces_pid, m.sess_rostos_mem):
            d.clear()
        m.cena_pend.clear()
        m.sess_ia_novos.clear()


def leva(specs, quem="carlos", classifica=True):
    """Uma leva aberta com as fotos de specs, em ordem de clique. spec: g (gramado), rec (medidas do recorte ou None =
    esperando o recorte), sin (sinais do lx_medir), serve (marcação do Treino), sem_cena (ainda sem classificação)."""
    out = []
    for sp_ in specs:
        _s[0] += 1
        _n[0] += 1
        p = "%012x" % (0xba0000000000 + _n[0])
        f = os.path.join(PASTA, p + ".jpg")
        open(f, "wb").write(b"\xff\xd8\xff\xd9")
        md = {"o": quem, "s": "ftp", "u": T + _s[0] * 3 + 1, "cap": T + _s[0] * 3}
        with m.lock:
            m.lib[p] = {"file": f, "thumb": f}
            m.meta[p] = dict(md)
        with m.sess_lock:
            m._sess_add(p, md, m.ff_cadastrados(), agora=md["u"])
        out.append(p)
        TODOS.append(p)
    if classifica:
        classifica_(out, specs)
    return out


def classifica_(ps, specs):
    for p, sp_ in zip(ps, specs):
        if sp_.get("sem_cena"):
            continue
        m.cena_mem[p] = {"r": "gramado" if sp_["g"] else "outro", "c": 0.9, "v": LV, "g": bool(sp_["g"]),
                         "rec": dict(sp_["rec"]) if sp_.get("rec") else None, "dia": HOJE}
        if sp_.get("sin"):
            m.base_sinais_poe(p, sp_["sin"])
        if "serve" in sp_:
            m.base_humano_poe(p, sp_["serve"])


def x_de(p):
    return m.sess.get(m.sess_pid.get(p) or "")


def fecha(ps):
    m.sess_tick(T + _s[0] * 3 + 500)
    x = x_de(ps[0])
    ok(x is not None and x["status"] == "fechada", "preparo: a leva fechou")
    return x


def de_antes(ps, n=2):
    """A regra de antes, escrita de novo aqui: as N primeiras de gramado que passam nos vetos, em ordem de clique."""
    out = []
    for p in ps:
        c = m.cena_mem.get(p)
        if c is None or c.get("v") != LV:
            return out, "pendente"
        if not c.get("g"):
            continue
        r = m.base_rec_ok(c.get("rec"))
        if r is None:
            return out, "pendente"
        if r:
            out.append(p)
            if len(out) >= n:
                break
    return out, ("ok" if out else "sem_gramado")


SIN_BOM = {"nq": 300.0, "nr": 400.0, "n": 2, "nb": 2}
SIN_RUIM = {"nq": 10.0, "nr": 12.0, "n": 0, "nb": 3}
CASOS = [
    [FORA, G(), G(), G(), FORA, FORA],                                              # o 26 do cena_agente
    [FORA] * 4,                                                                     # 27: sem gramado
    [G({"trunc": True, "borda": ["esq"], "luz": {"med": 120, "p95": 200}}), G({"sem_pessoa": True}),
     G({"trunc": True, "borda": [], "luz": {"med": 20, "p95": 90}}), G(CHAO), G()],  # 28: vetos
    [G(), FORA, FORA, FORA],                                                        # D9: só 1
    [G(CHAO), G(PERNAS), G(PERNAS), G(JOELHO), G(PERNAS)],                          # o critério 3: aqui o "melhores" troca
    [G(CHAO, sin=SIN_RUIM), G(CHAO, sin=SIN_RUIM), G(JOELHO, sin=SIN_BOM), G(JOELHO, sin=SIN_BOM), FORA],
    [G(CHAO), G(CHAO), G(JOELHO, serve=True), G(JOELHO), G(JOELHO)],
    [G(serve=False), G(), G(), G()],                                                # o Treino só conta no "melhores"
]


def roda_casos(nome):
    for i, caso in enumerate(CASOS):
        reset()
        ps = leva(caso)
        esperado, est = de_antes(ps)
        x = fecha(ps)
        ok(x["ia"] == (esperado if est == "ok" else []), "1 (%s): caso %d: ia igual à regra de antes: %r x %r" % (nome, i, [ps.index(p) for p in x["ia"]], [ps.index(p) for p in esperado]))
        ok(x["ia_regra"] == {"n": 2, "motivo": None if est == "ok" else "sem_gramado"}, "1 (%s): caso %d: ia_regra igual à de antes, sem esc: %r" % (nome, i, x["ia_regra"]))


with contextlib.redirect_stdout(console):
    # ---------- 1: modo "primeiras" (pela chave e à força) = a regra de antes, em todos os casos ----------
    st0 = dict(m.base_st)
    chave("primeiras")
    roda_casos("chave")
    chave("melhores")
    m.BASES_FORCA = "primeiras"
    ok(m.bases_modo() == "primeiras" and m.treino_status()["bases"].get("forcada") is True and m.treino_status()["bases"]["modo"] == "primeiras",
       "1: ETERNA_BASES=primeiras vence a chave e aparece no /status")
    roda_casos("ETERNA_BASES")
    m.BASES_FORCA = ""
    ok(m.base_st == st0, "1: no modo primeiras nada é contado como escolha por nota: %r" % m.base_st)
    ok(m.bases_modo() == "melhores", "chave de volta em melhores")

    # ---------- 2: melhores, sem sinal de nitidez ou rosto e medidas iguais: as mesmas de antes ----------
    reset()
    p2 = leva([FORA, G(), G(), G(), G(), G(), FORA])
    x2 = fecha(p2)
    ok(x2["ia"] == p2[1:3] == de_antes(p2)[0], "2: sem sinal e com medidas iguais, as duas primeiras de gramado: %r" % [p2.index(p) for p in x2["ia"]])
    ok(x2["ia_regra"].get("esc") == {"v": 1, "modo": "melhores", "pool": 5, "trocas": 0} and x2["ia_regra"]["motivo"] is None,
       "2: ia_regra.esc {v, modo, pool, trocas}: %r" % x2["ia_regra"])
    ok(m.base_st["levas"] == st0["levas"] + 1 and m.base_st["trocadas"] == st0["trocadas"], "2: uma leva contada, nenhuma troca: %r" % m.base_st)
    # sinais iguais em todas também não trocam
    reset()
    p2b = leva([G(sin=SIN_BOM)] * 5)
    ok(fecha(p2b)["ia"] == p2b[:2], "2: sinais iguais em todas: as duas primeiras")

    # ---------- 3: a 1ª com chão sob os pés e a 4ª do joelho para cima: [2ª, 4ª], em ordem de clique ----------
    for nome, meio in (("pernas inteiras", PERNAS), ("sem medida de corpo", {"borda": [], "luz": {"med": 120.0, "p95": 200.0}})):
        reset()
        p3 = leva([G(CHAO), G(meio), G(meio), G(JOELHO), G(meio)])
        t3 = m.base_st["trocadas"]
        x3 = fecha(p3)
        ok(x3["ia"] == [p3[1], p3[3]], "3 (%s): ia = [2ª, 4ª]: %r" % (nome, [p3.index(p) for p in x3["ia"]]))
        ok(x3["ia_regra"]["esc"]["trocas"] == 1 and x3["ia_regra"]["esc"]["pool"] == 5 and m.base_st["trocadas"] == t3 + 1, "3 (%s): uma troca contada: %r" % (nome, x3["ia_regra"]))
    # a ordem de clique das escolhidas não muda, mesmo com a melhor nota vindo antes
    reset()
    p3c = leva([G(CHAO), G(CHAO), G(PERNAS), G(JOELHO, serve=True), G(JOELHO)])
    x3c = fecha(p3c)
    ok(x3c["ia"] == p3c[3:5], "3: as escolhidas saem em ordem de clique (marcada como serve e a seguinte): %r" % [p3c.index(p) for p in x3c["ia"]])
    # só entra quem está entre as 8 primeiras de gramado
    reset()
    p3d = leva([G(CHAO)] * 8 + [G(JOELHO), G(JOELHO)])
    x3d = fecha(p3d)
    ok(x3d["ia"] == p3d[:2] and x3d["ia_regra"]["esc"]["pool"] == 8, "3: a 9ª e a 10ª de gramado ficam fora da procura: %r %r" % ([p3d.index(p) for p in x3d["ia"]], x3d["ia_regra"]))
    reset()
    p3e = leva([G(CHAO)] * 7 + [FORA, G(JOELHO), G(JOELHO)])
    x3e = fecha(p3e)
    ok(x3e["ia"] == [p3e[0], p3e[8]], "3: a 8ª de gramado ainda entra (foto de outro ponto não conta): %r" % [p3e.index(p) for p in x3e["ia"]])

    # ---------- nota: pesos do plano ----------
    def nota(rec=None, sin=None, serve=None):
        p = "%012x" % (0xbb0000000000 + len(TODOS) + _n[0])
        _n[0] += 1
        m.cena_mem[p] = {"r": "gramado", "c": 0.9, "v": LV, "g": True, "rec": rec, "dia": HOJE}
        if sin:
            m.base_sinais_poe(p, sin)
        if serve is not None:
            m.base_humano_poe(p, serve)
        v = m.base_nota(p)
        m.cena_mem.pop(p, None)
        m.base_lgpd([p])
        return v
    L = lambda med, p95=200.0: {"trunc": True, "borda": [], "luz": {"med": med, "p95": p95}, "pernas": False}
    ok(nota() == 50.0, "nota: sem sinal nenhum, metade de cada peso (50): %r" % nota())
    ok(nota(JOELHO, SIN_BOM) == 100.0, "nota: tudo bom = 100: %r" % nota(JOELHO, SIN_BOM))
    ok(nota(JOELHO) - nota(PERNAS) == 10 and nota(PERNAS) - nota(CHAO) == 20, "nota: corpo 30 / 20 / 0")
    ok(nota(L(90)) == nota(L(170)) == nota(L(120)) and nota(L(120)) - nota(L(40)) == 25 and nota(L(230)) == nota(L(40)) and nota(L(65)) - nota(L(40)) == 12.5
       and nota(L(200)) - nota(L(230)) == 12.5, "nota: luz 25, reta até 0 em 40 e em 230")
    ok(nota(L(120)) - nota(L(120, 245.0)) == 10 and nota(L(45, 250.0)) == nota(L(40)), "nota: p95 de 245 para cima perde 10 (sem passar de zero)")
    S_ = lambda **k: dict({"nq": None, "nr": None, "n": 1, "nb": 1}, **k)
    ok(nota(JOELHO, S_(nr=150)) - nota(JOELHO, S_(nr=25)) == 20 and nota(JOELHO, S_(nr=400)) == nota(JOELHO, S_(nr=150)) and nota(JOELHO, S_(nr=87.5)) - nota(JOELHO, S_(nr=25)) == 10
       and nota(JOELHO, S_(nq=150)) == nota(JOELHO, S_(nr=150)) and nota(JOELHO, S_(nr=25, nq=900)) == nota(JOELHO, S_(nr=25)), "nota: nitidez 20 pelo rosto; sem ele, o quadro")
    ok(nota(JOELHO, S_(n=1, nb=1)) - nota(JOELHO, S_(n=1, nb=2)) == 7 and nota(JOELHO, S_(n=1, nb=2)) - nota(JOELHO, S_(n=1, nb=3)) == 8
       and nota(JOELHO, S_(n=1, nb=9)) == nota(JOELHO, S_(n=1, nb=3)), "nota: gente atrás 15 / 8 / 0")
    ok(nota(JOELHO, S_(n=1, nb=1)) - nota(JOELHO, S_(n=0, nb=0)) == 10, "nota: rosto lido 10")
    ok(nota(JOELHO, serve=True) == nota(JOELHO) + 100 and nota(JOELHO, SIN_BOM, serve=False) is None, "nota: o Treino soma 100 ou tira a foto")

    # ---------- 4: diferença menor que a margem não troca; a margem exata troca ----------
    reset()
    p4 = leva([G(L(84)), G(L(84)), G(L(120)), G(L(120)), FORA])       # 25 * 0,88 = 22 contra 25: 3 pontos
    x4 = fecha(p4)
    ok(x4["ia"] == p4[:2] and x4["ia_regra"]["esc"]["trocas"] == 0, "4: 3 pontos de diferença: não troca: %r" % [p4.index(p) for p in x4["ia"]])
    reset()
    p4b = leva([G(PERNAS, sin=S_(nr=100)), G(PERNAS, sin=S_(nr=100)), G(JOELHO, sin=S_(nr=99)), FORA])   # 10 de corpo menos 0,2 de nitidez
    ok(fecha(p4b)["ia"] == p4b[:2], "4: 9,8 pontos de diferença: não troca")
    reset()
    p4c = leva([G(PERNAS), G(PERNAS), G(JOELHO), FORA])               # exatamente 10
    ok(fecha(p4c)["ia"] == [p4c[0], p4c[2]], "4: com 10 pontos troca, e sai a mais tarde das duas iguais")

    # ---------- 5: borda, sem pessoa e luz fora nunca entram, com qualquer nota ----------
    reset()
    VETOS = [dict(JOELHO, borda=["dir"]), {"sem_pessoa": True}, dict(JOELHO, luz={"med": 30.0, "p95": 100.0}), dict(JOELHO, luz={"med": 150.0, "p95": 255.0}),
             dict(JOELHO, borda=["cima"])]
    p5 = leva([G(CHAO, sin=SIN_RUIM), G(CHAO, sin=SIN_RUIM)] + [G(v, sin=SIN_BOM, serve=True) for v in VETOS])
    x5 = fecha(p5)
    ok(x5["ia"] == p5[:2] and x5["ia_regra"]["esc"]["pool"] == 2, "5: vetadas com nota alta e marcadas como serve nunca entram: %r %r" % ([p5.index(p) for p in x5["ia"]], x5["ia_regra"]))
    reset()
    p5b = leva([G(v, sin=SIN_BOM, serve=True) for v in VETOS] + [FORA])
    x5b = fecha(p5b)
    ok(x5b["ia"] == [] and x5b["ia_regra"]["motivo"] == "sem_gramado", "5: só vetadas: sem base (sem_gramado): %r" % x5b["ia_regra"])
    # o Treino marcou "não serve": a foto fica fora e a seguinte entra
    reset()
    p5c = leva([G(serve=False), G(), G(), FORA])
    ok(fecha(p5c)["ia"] == p5c[1:3], "5: marcada como não serve fica fora no modo melhores")
    reset()
    p5d = leva([G(serve=False), G(serve=False), FORA])
    x5d = fecha(p5d)
    # revisão de 24/11: a marcação do Treino nunca deixa a leva com menos bases que a regra de antes
    ok(x5d["ia"] == p5d[:2] and "esc" not in x5d["ia_regra"], "5: todas marcadas como não serve: valem as bases da regra de antes: %r %r" % ([p5d.index(p) for p in x5d["ia"]], x5d["ia_regra"]))
    reset()
    p5e = leva([G(serve=False), G(), FORA])
    ok(fecha(p5e)["ia"] == p5e[:2], "5: uma de duas marcada como não serve: continuam as duas")
    # as 8 primeiras de gramado vetadas e a 9ª e a 10ª boas: igual à regra de antes
    reset()
    VET = dict(JOELHO, borda=["cima"])
    p5f = leva([G(VET) for _ in range(8)] + [G(), G(), FORA])
    ok(fecha(p5f)["ia"] == p5f[8:10], "5: boas depois das 8 primeiras de gramado continuam entrando")
    reset()
    p5g = leva([G(VET) for _ in range(7)] + [G(), G(), FORA])
    ok(fecha(p5g)["ia"] == p5g[7:9], "5: 7 vetadas, 8ª e 9ª boas: duas bases, como antes")
    # erro no cálculo da nota: a leva fecha com as bases da regra de antes e o erro é contado
    reset()
    antes_err = m.base_st["erros"]
    nota_boa = m.base_nota
    def _quebra(pid):
        raise OverflowError("teste")
    m.base_nota = _quebra
    try:
        p5h = leva([G(CHAO), G(CHAO), G(), G(), FORA])
        x5h = fecha(p5h)
    finally:
        m.base_nota = nota_boa
    ok(x5h["ia"] == p5h[:2] and "esc" not in x5h["ia_regra"] and m.base_st["erros"] == antes_err + 1, "5: erro na nota: fecha com as primeiras e conta o erro: %r %r" % ([p5h.index(p) for p in x5h["ia"]], m.base_st))

    # ---------- 6: candidata sem recorte no fechamento: fecha na mesma hora com o que há; sem_medida soma 1 ----------
    reset()
    sm = m.base_st["sem_medida"]
    p6 = leva([G(CHAO), G(CHAO), G(None), G(JOELHO), FORA])
    with m.sess_lock:
        est_antes = m._sess_ia_bases_ordem(x_de(p6[0]), 2)[1]
    x6 = fecha(p6)
    ok(est_antes == "ok" and x6["ia_regra"]["motivo"] is None and x6["card"] not in m.cena_pend, "6: a leva fecha na hora, como antes (nada de cena_pendente): %r" % x6["ia_regra"])
    ok(x6["ia"] == [p6[0], p6[3]] and x6["ia_regra"]["esc"]["pool"] == 3, "6: escolhe com as medidas que há: %r %r" % ([p6.index(p) for p in x6["ia"]], x6["ia_regra"]))
    ok(m.base_st["sem_medida"] == sm + 1, "6: sem_medida soma 1: %r" % m.base_st)
    m.cena_mem[p6[2]]["rec"] = dict(JOELHO)                          # o recorte chega depois: nada muda (7)
    m.sess_tick(T + _s[0] * 3 + 900)
    m.cena_completa()
    ok(x6["ia"] == [p6[0], p6[3]], "6 e 7: recorte que chega depois do fechamento não muda a escolha")
    # antes das N boas, a foto sem recorte segue travando como antes (cena_pendente), nos dois modos
    for modo in ("melhores", "primeiras"):
        chave(modo)
        reset()
        p6b = leva([G(), G(None), G(), G()])
        m.sess_tick(T + _s[0] * 3 + 500)
        x6b = x_de(p6b[0])
        ok(x6b["ia"] == [] and x6b["ia_regra"] == {"n": 2, "motivo": "cena_pendente"} and x6b["card"] in m.cena_pend, "6 (%s): sem recorte antes das N boas = cena_pendente, igual a antes: %r" % (modo, x6b["ia_regra"]))
    chave("melhores")

    # ---------- a nota nunca abre banco (roda com o sess_lock) ----------
    reset()
    pP = leva([G(CHAO, sin=SIN_RUIM), G(PERNAS, sin=SIN_BOM), G(JOELHO, sin=SIN_BOM, serve=True), G(JOELHO), FORA])
    reais = {k: getattr(m, k) for k in ("treino_db", "estado_db", "cena_db", "treino_cfg", "ia_cfg")}

    def proibido(*a, **k):
        raise AssertionError("abriu banco na escolha das bases")
    for k in reais:
        setattr(m, k, proibido)
    try:
        with m.sess_lock:
            rP = m._sess_ia_bases(x_de(pP[0]), 2)
            nP = [m.base_nota(p) for p in pP]
        ok(rP == ([pP[1], pP[2]], "ok") and all(v is not None for v in nP), "pura: escolhe sem abrir banco nem reler a chave: %r" % (rP,))
    except AssertionError as ex:
        ok(False, "pura: %s" % ex)
    finally:
        for k, v in reais.items():
            setattr(m, k, v)

    # ---------- 7: leva fechada com bases nunca muda (nota nova, rótulo novo, chave, reinício) ----------
    reset()
    p7 = leva([G(CHAO), G(PERNAS), G(PERNAS), G(JOELHO), G(PERNAS), FORA])
    x7 = fecha(p7)
    ia7, rg7 = list(x7["ia"]), json.loads(json.dumps(x7["ia_regra"]))
    ok(ia7 == [p7[1], p7[3]], "7: preparo: [2ª, 4ª]")
    card7 = x7["card"]

    def igual7(quando):
        x = m.sess.get(card7)
        ok(x is not None and x["ia"] == ia7 and x["ia_regra"] == rg7, "7: %s: a escolha não muda: %r %r" % (quando, x and [p7.index(p) for p in x["ia"]], x and x["ia_regra"]))

    def mexe():
        m.sess_tick(T + _s[0] * 3 + 2000)
        m.cena_completa()
        with m.sess_lock:
            m._vis_ia_reabre([card7], "separar")
            m.cena_pend[card7] = time.time()                         # mesmo posta de novo na espera, leva com bases não é revista
        m.cena_completa()
    m.base_sinais_poe(p7[4], SIN_BOM)                                # nota nova: a 5ª passa a ser a melhor
    m.base_sinais_poe(p7[1], SIN_RUIM)
    m.cena_mem[p7[0]]["rec"] = dict(JOELHO)
    mexe()
    igual7("nota nova")
    m.base_humano_poe(p7[1], False)                                  # rótulo novo: o Treino recusa uma base e aprova outra foto
    m.base_humano_poe(p7[2], True)
    mexe()
    igual7("rótulo novo")
    chave("primeiras")
    mexe()
    igual7("chave em primeiras")
    chave("melhores")
    mexe()
    igual7("chave de volta em melhores")
    m.sess_gravar()                                                  # reinício: o arquivo do dia guarda ia e ia_regra.esc
    arq = json.load(open(os.path.join(m.SESS_DIR, HOJE + ".json"), encoding="utf8"))
    s7 = [s for s in arq["sessoes"] if s["card"] == card7][0]
    ok(s7["ia"] == ia7 and s7["ia_regra"] == rg7 and not any(k.startswith("_") for k in s7), "7: o arquivo guarda ia e ia_regra.esc, sem campo interno: %r" % s7.get("ia_regra"))
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima):
            d.clear()
        m.cena_pend.clear()
    m.sess_carregar()
    igual7("depois de reiniciar o agente")
    mexe()
    igual7("depois de reiniciar e rodar os laços")
    # 12: recorte antecipado e montagem seguem só com x["ia"]
    ok(m.rec_pre_escolha(m.sess[card7]["fotos"], m.sess[card7]) == ia7, "12: rec_pre_escolha só com x[ia]: %r" % (m.rec_pre_escolha(m.sess[card7]["fotos"], m.sess[card7]),))
    ok(list(m.mtg_candidatas(m.sess[card7])) == ia7, "12: mtg_candidatas só com x[ia]")
    m.base_lgpd(p7)

    # ---------- 8: cena_pendente e Separar usam a mesma escolha e seguem recusando base vendida ----------
    CASO8 = [G(CHAO, sem_cena=True), G(PERNAS), G(PERNAS), G(JOELHO), FORA]
    reais_pagas = m.cena_vendas_pagas
    reset()
    p8 = leva(CASO8)
    m.sess_tick(T + _s[0] * 3 + 500)
    x8 = x_de(p8[0])
    ok(x8["status"] == "fechada" and x8["ia"] == [] and x8["ia_regra"] == {"n": 2, "motivo": "cena_pendente"} and x8["card"] in m.cena_pend, "8: fechou em cena_pendente: %r" % x8["ia_regra"])
    m.cena_mem[p8[0]] = {"r": "gramado", "c": 0.9, "v": LV, "g": True, "rec": dict(CHAO), "dia": HOJE}
    m.cena_vendas_pagas = lambda: frozenset()
    l8 = m.base_st["levas"]
    m.cena_completa()
    ok(x8["ia"] == [p8[1], p8[3]] and x8["ia_regra"].get("reaberta") == "cena" and x8["ia_regra"].get("esc", {}).get("trocas") == 1 and m.base_st["levas"] == l8 + 1,
       "8: cena_pendente termina com as duas melhores (reaberta cena): %r %r" % ([p8.index(p) for p in x8["ia"]], x8["ia_regra"]))
    reset()
    p8b = leva(CASO8)
    m.sess_tick(T + _s[0] * 3 + 500)
    x8b = x_de(p8b[0])
    m.cena_mem[p8b[0]] = {"r": "gramado", "c": 0.9, "v": LV, "g": True, "rec": dict(CHAO), "dia": HOJE}
    m.cena_vendas_pagas = lambda: frozenset([p8b[3]])                # a base escolhida pela nota já foi vendida como foto
    l8 = m.base_st["levas"]
    m.cena_completa()
    ok(x8b["ia"] == [] and x8b["ia_regra"] == {"n": 2, "motivo": "cena_indisponivel"} and m.base_st["levas"] == l8, "8: base vendida: não preenche (cena_indisponivel) e não conta: %r" % x8b["ia_regra"])
    m.cena_vendas_pagas = reais_pagas
    chave("primeiras")                                               # no modo primeiras, o cena_pendente termina com a regra de antes
    reset()
    p8c = leva(CASO8)
    m.sess_tick(T + _s[0] * 3 + 500)
    x8c = x_de(p8c[0])
    m.cena_mem[p8c[0]] = {"r": "gramado", "c": 0.9, "v": LV, "g": True, "rec": dict(CHAO), "dia": HOJE}
    m.cena_completa()
    ok(x8c["ia"] == p8c[:2] and x8c["ia_regra"] == {"n": 2, "motivo": None, "reaberta": "cena"}, "8 e 1: primeiras no cena_pendente = a regra de antes: %r" % x8c["ia_regra"])
    chave("melhores")
    # Separar
    reset()
    p8d = leva([FORA, G(CHAO), G(PERNAS), G(JOELHO), G(PERNAS)])
    x8d = fecha(p8d)
    with m.sess_lock:
        x8d["ia"], x8d["ia_regra"] = [], {"n": 2, "motivo": "visita_ja_tem"}
        r8d = m._vis_ia_reabre([x8d["card"]], "separar")
    ok(r8d == [x8d["card"]] and x8d["ia"] == [p8d[2], p8d[3]] and x8d["ia_regra"].get("reaberta") == "separar" and x8d["ia_regra"].get("esc", {}).get("modo") == "melhores",
       "8: Separar reabre com as duas melhores: %r %r" % ([p8d.index(p) for p in x8d["ia"]], x8d["ia_regra"]))
    chave("primeiras")
    with m.sess_lock:
        x8d["ia"], x8d["ia_regra"] = [], {"n": 2, "motivo": "visita_ja_tem"}
        m._vis_ia_reabre([x8d["card"]], "separar")
    ok(x8d["ia"] == p8d[1:3] and x8d["ia_regra"] == {"n": 2, "motivo": None, "reaberta": "separar"}, "8 e 1: Separar no modo primeiras = a regra de antes: %r" % x8d["ia_regra"])
    chave("melhores")

    # ---------- candidatas ao recorte: a fila só cresce com a placa de vídeo e no modo melhores ----------
    def cand(provedor, modo):
        chave(modo)
        reset()
        ps = leva([FORA] + [G(None)] * 3 + [G(JOELHO)] * 2 + [FORA] + [G(None)] * 5, classifica=False)
        prov0 = m.rec.get("provedor")
        m.rec["provedor"] = provedor
        try:
            classifica_(ps, [FORA] + [G(None)] * 3 + [G(JOELHO)] * 2 + [FORA] + [G(None)] * 5)
            x = x_de(ps[0])
            with m.sess_lock:
                x["_ia_vistos"] = set()
                m.sess_ia_novos.clear()
                m._sess_ia_cand(x)
                fila = [p for p, pr in m.sess_ia_novos]
            guardadas = m.sess_ia_hoje()
        finally:
            m.rec["provedor"] = prov0
        chave("melhores")
        return ps, fila, x, guardadas
    psA, filaA, xA, gA = cand("cuda", "melhores")
    ok(filaA == psA[1:6] + psA[7:10] and len(filaA) == 8, "fila: com a placa, as 8 primeiras de gramado vão ao recorte: %r" % [psA.index(p) for p in filaA])
    ok(set(filaA) <= gA, "fila: a limpeza dos recortes guarda as candidatas da leva aberta")
    psB, filaB, _, _ = cand("cpu", "melhores")
    ok(filaB == psB[1:6], "fila: na CPU a lista é a de antes (até as 2 boas): %r" % [psB.index(p) for p in filaB])
    psC, filaC, _, _ = cand("cuda", "primeiras")
    ok(filaC == psC[1:6], "fila: no modo primeiras a lista é a de antes, mesmo com a placa: %r" % [psC.index(p) for p in filaC])
    psD, filaD, _, _ = cand(None, "melhores")
    ok(filaD == psD[1:6], "fila: sem saber o provedor, a lista é a de antes")

    # ---------- 9: LGPD tira dos dois caches; teto; recarga na partida ----------
    reset()
    p9 = leva([G(sin=SIN_BOM, serve=True), G(sin=SIN_BOM, serve=False), G(sin=SIN_BOM), FORA])
    x9 = fecha(p9)
    ok(p9[0] in m.base_sinais and p9[0] in m.base_humano and p9[1] in m.base_humano, "9: preparo: nos caches")
    m.lx_acrescenta(p9[2], HOJE, {"v": 1, "nq": 77.0, "nr": 88.0, "n": 1, "nb": 2, "luz": {"q": None, "r": None}})
    ok(m.base_sinais.get(p9[2]) == {"nq": 77.0, "nr": 88.0, "n": 1, "nb": 2}, "9: o lx_acrescenta preenche o cache só com os 4 números: %r" % m.base_sinais.get(p9[2]))
    m.sess_gravar()
    st9, r9 = m.treino_gravar("carlos", {"pid": p9[2], "v": 1, "ponto": "gramado", "ia": {"serve": True, "motivos": [], "frente": None}})
    ok(st9 == 200 and m.base_humano.get(p9[2]) is True, "9: o treino_gravar preenche o cache: %s %r" % (st9, r9 if st9 != 200 else None))
    st9, r9 = m.treino_gravar("carlos", {"pid": p9[2], "v": 1, "ponto": "gramado", "ia": {"serve": None, "motivos": [], "frente": None}, "base_em": (r9.get("doc") or {}).get("em")})
    ok(st9 == 200 and p9[2] not in m.base_humano, "9: marcação desfeita sai do cache")
    m.treino_gravar("carlos", {"pid": p9[2], "v": 1, "ponto": "gramado", "ia": {"serve": False, "motivos": [], "frente": None}})
    m.lx_grava()
    # recarga na partida (hoje e ontem, do treino.db)
    with m.base_lock:
        m.base_sinais.clear()
        m.base_humano.clear()
    nrec = m.base_mem_carregar()
    ok(nrec >= 1 and m.base_sinais.get(p9[2]) == {"nq": 77.0, "nr": 88.0, "n": 1, "nb": 2} and m.base_humano.get(p9[2]) is False, "9: a partida recarrega sinais e marcações de hoje: %r %r" % (nrec, m.base_humano.get(p9[2])))
    m.base_humano_poe(p9[0], True)
    m.base_sinais_poe(p9[0], SIN_BOM)
    m.lx_lgpd_mem([p9[0]])
    ok(p9[0] not in m.base_sinais and p9[0] not in m.base_humano, "9: lx_lgpd_mem tira dos dois caches")
    f9 = m.treino_lgpd([p9[2]])
    ok(p9[2] not in m.base_sinais and p9[2] not in m.base_humano and not f9, "9: treino_lgpd tira dos dois caches: %r" % f9)
    with m.base_lock:
        m.base_sinais.clear()
        m.base_humano.clear()
    m.base_mem_carregar()
    ok(p9[2] not in m.base_sinais and p9[2] not in m.base_humano, "9: depois da LGPD a recarga não traz a foto de volta")
    m.base_sinais_poe(p9[1], SIN_BOM)
    m.base_humano_poe(p9[1], True)
    m.lgpd_excluir([p9[1]], [], quem="teste")
    ok(p9[1] not in m.base_sinais and p9[1] not in m.base_humano and p9[1] not in m.cena_mem, "9: a exclusão LGPD inteira tira a foto dos caches da nota")
    max_s, max_h = m.BASE_SINAIS_MAX, m.BASE_HUMANO_MAX
    m.BASE_SINAIS_MAX = m.BASE_HUMANO_MAX = 50
    for i in range(120):
        m.base_sinais_poe("%012x" % (0xbc0000000000 + i), SIN_BOM)
        m.base_humano_poe("%012x" % (0xbc0000000000 + i), bool(i % 2))
    ok(len(m.base_sinais) == 50 and len(m.base_humano) == 50 and "%012x" % (0xbc0000000000 + 119) in m.base_sinais and "%012x" % 0xbc0000000000 not in m.base_sinais,
       "9: os dois caches têm teto e soltam os mais antigos: %d %d" % (len(m.base_sinais), len(m.base_humano)))
    m.BASE_SINAIS_MAX, m.BASE_HUMANO_MAX = max_s, max_h
    ok(max_s == 20000 and max_h == 20000, "9: teto de 20.000")
    with m.base_lock:
        m.base_sinais.clear()
        m.base_humano.clear()

    # ---------- 10: só o Admin troca a chave; aba antiga não zera; estado_gravar segue recusando ----------
    m._treino_cfg.update(t=0.0, v=None)                              # daqui em diante a chave é a do estado.db
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    TUDO = {"c": True, "r": True, "u": True, "d": True}

    def pede(rota, corpo=None, cookies=None, extra=None):
        if rota == "/treino/config" and not (extra or {}).get("limite"):
            with m.gal_lock:                                         # o limite de 6 por minuto tem o caso dele no fim
                m._janelas.clear()
        extra = {k: v for k, v in (extra or {}).items() if k != "limite"}
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
        h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
        h.update(extra or {})
        if cookies:
            h["Cookie"] = "; ".join("%s=%s" % kv for kv in cookies.items() if kv[1])
        c.request("POST" if corpo is not None else "GET", rota, json.dumps(corpo) if corpo is not None else None, h)
        r = c.getresponse()
        txt = r.read()
        try:
            j = json.loads(txt or b"{}")
        except ValueError:
            j = {}
        novos = {}
        for ck in r.msg.get_all("Set-Cookie") or []:
            k, _, v = ck.split(";")[0].partition("=")
            novos[k] = v
        c.close()
        return r.status, j, novos

    def doc(usuario, preset, perms):
        v = {"v": 2, "email": usuario, "name": usuario.title(), "active": True, "preset": preset, "perms": perms}
        m.estado_gravar({"docs": [{"col": "usuarios", "id": m.quote(usuario, safe="-_.!~*'()"), "valor": v}]})

    def entra(usuario):
        prov = m.auth_criar(usuario, "teste")
        st, j, ck = pede("/auth/trocar", {"usuario": usuario, "senha": prov, "nova": "Pi-ano-Verde-%s-77" % usuario})
        ok(st == 200 and ck.get("eterna_sessao"), "%s deveria entrar: %s" % (usuario, st))
        return {"eterna_sessao": ck.get("eterna_sessao")}

    def gravado():
        with m.estado_lock:
            db = m.estado_db()
            try:
                r = db.execute("select valor from doc where col = 'config' and id = 'treino' and valor is not null").fetchone()
            finally:
                db.close()
        return json.loads(r[0]) if r else None

    doc("ronaldo", "admin", {mod: dict(TUDO) for mod in m.AUTH_MODULOS})
    doc("sup", "supervisor", {"configuracao": dict(TUDO), "qualidade": dict(TUDO), "set": dict(TUDO)})
    doc("carlos.foto", "foto", {"set": dict(TUDO)})
    adm, sup, fot = entra("ronaldo"), entra("sup"), entra("carlos.foto")
    st, j, _ = pede("/treino/config", {"exposicao": "medir"}, adm)   # documento gravado sem o campo, como o de antes desta versão
    with m.estado_lock:
        db = m.estado_db()
        db.execute("update doc set valor = ? where col = 'config' and id = 'treino'", (json.dumps({"ponto": "medir", "exposicao": "medir"}),))
        db.commit()
        db.close()
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg().get("bases") == "melhores" and m.bases_modo() == "melhores", "10: documento sem o campo vale melhores")
    st, j, _ = pede("/treino/config", {"bases": "primeiras"}, sup)
    ok(st == 403 and j.get("error") == "so_admin" and m.treino_cfg().get("bases") == "melhores", "10: Supervisora com configuracao.u recebe 403: %s %s" % (st, j))
    st, j, _ = pede("/treino/config", {"bases": "primeiras"}, fot)
    ok(st == 403 and m.treino_cfg().get("bases") == "melhores", "10: Fotógrafo recebe 403: %s" % st)
    st, j, _ = pede("/treino/config", {"bases": "primeiras"}, None)
    ok(st in (401, 403) and m.treino_cfg().get("bases") == "melhores", "10: sem sessão não troca: %s" % st)
    st, j, ckc = pede("/auth/assumir", {"usuario": "sup"}, adm)
    como = {"eterna_sessao": ckc.get("eterna_sessao"), "eterna_sessao_adm": ckc.get("eterna_sessao_adm")}
    st, j, _ = pede("/treino/config", {"bases": "primeiras"}, como)
    ok(st == 403 and m.treino_cfg().get("bases") == "melhores", "10: ver como não troca: %s %s" % (st, j))
    for ruim in ("todas", "", None, 1, True, ["primeiras"], "Primeiras"):
        st, j, _ = pede("/treino/config", {"bases": ruim}, adm)
        ok(st == 400 and m.treino_cfg().get("bases") == "melhores", "10: valor %r recusado com 400: %s %s" % (ruim, st, j))
    st, j, _ = pede("/treino/config", {"bases": "primeiras"}, adm)
    ok(st == 200 and j.get("bases") == "primeiras" and j.get("analise") == {"ponto": "medir", "exposicao": "medir"}, "10: o Admin troca para primeiras: %s %s" % (st, j))
    g = gravado()
    ok(g and g.get("bases") == "primeiras" and g.get("por") == "ronaldo" and m.treino_cfg_mem().get("bases") == "primeiras" and m.bases_modo() == "primeiras",
       "10: gravado no config/treino e valendo sem reiniciar: %r" % g)
    ok(m.treino_status()["bases"]["modo"] == "primeiras", "10: /status.treino.bases.modo = primeiras")
    # aba antiga do app: POST sem o campo mantém o valor gravado
    time.sleep(0.1)
    for corpo in ({"exposicao": "desligada"}, {"ponto": "medir"}, {"ponto": "desligada", "exposicao": "medir"}):
        st, j, _ = pede("/treino/config", corpo, adm)
        m._treino_cfg["t"] = 0.0
        ok(st == 200 and (gravado() or {}).get("bases") == "primeiras" and m.treino_cfg().get("bases") == "primeiras", "10: POST sem bases (aba antiga) não zera o valor: %s %r %r" % (st, corpo, gravado()))
    # a sincronização do estado segue recusando config/treino
    r_sync = m.estado_gravar({"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "medir", "exposicao": "medir", "bases": "melhores"}}]}, quem="127.0.0.1") \
        if "quem" in m.estado_gravar.__code__.co_varnames else m.estado_gravar({"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "medir", "exposicao": "medir", "bases": "melhores"}}]})
    ok((gravado() or {}).get("bases") == "primeiras", "10: o estado_gravar segue recusando config/treino: %r" % (r_sync,))
    st, j, _ = pede("/ponto/docs", {"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "medir", "exposicao": "medir", "bases": "melhores"}}]}, adm)
    ok((gravado() or {}).get("bases") == "primeiras", "10: nem o Admin troca pela sincronização (só pela rota): %s %s" % (st, j))
    # documento com valor estranho no banco: formato fechado (tudo desligado), nunca um modo inventado
    ok(m.treino_cfg_valida({"ponto": "medir", "exposicao": "medir", "bases": "x"}) is None and m.treino_cfg_valida({"ponto": "medir", "exposicao": "medir"})["bases"] == "melhores",
       "10: treino_cfg_valida: formato fechado e ausente = melhores")
    # /status: só o modo e números
    st, js, _ = pede("/status", None, adm)
    bs = (js.get("treino") or {}).get("bases")
    ok(st == 200 and isinstance(bs, dict) and set(bs) == {"modo", "levas", "trocadas", "sem_medida", "erros"} and bs["modo"] == "primeiras"
       and all(isinstance(bs[k], int) and not isinstance(bs[k], bool) for k in ("levas", "trocadas", "sem_medida", "erros")) and bs["levas"] >= 5 and bs["trocadas"] >= 3 and bs["sem_medida"] >= 1,
       "/status.treino.bases = {modo, levas, trocadas, sem_medida}, só números: %s %r" % (st, bs))
    pids_cards = set(TODOS) | {c for c in list(m.sess)}
    ok(not any(t in json.dumps(bs) for t in pids_cards), "/status.treino.bases sem pid nem card")
    st, j, _ = pede("/treino/config", {"bases": "melhores"}, adm)
    ok(st == 200 and j.get("bases") == "melhores" and m.bases_modo() == "melhores", "10: o Admin volta para melhores: %s %s" % (st, j))
    sts = [pede("/treino/config", {"bases": "primeiras" if i % 2 else "melhores"}, adm, extra={"limite": 1})[0] for i in range(8)]
    ok(sts[:5] == [200] * 5 and sts[-1] == 429, "10: o mesmo limite de 6 por minuto vale para a chave: %r" % sts)
    srv.shutdown()

saida = console.getvalue()
sys.stdout.write(saida)
linhas_bases = [l for l in saida.splitlines() if "bases" in l]
ok(any("bases melhores -> primeiras" in l for l in linhas_bases), "console: a troca da chave fica registrada (de -> para, quem)")
vaz = [t for t in set(TODOS) | set(m.sess) if t in saida and "LGPD" not in "".join(l for l in saida.splitlines() if t in l)]
ok(not vaz, "console: nenhum pid nem card impresso pela escolha das bases (%d)" % len(vaz))
ok(PASTA not in "\n".join(linhas_bases), "console: nenhum caminho nas linhas das bases")
fonte = open(sys.argv[1], encoding="utf8").read()
corpo_nota = fonte.split("def base_nota(pid):")[1].split("\ndef ")[0]
ok(not re.search(r"_db\(|sqlite|open\(|with \w*lock|print\(", corpo_nota), "base_nota: sem banco, arquivo, lock ou print no corpo da função")
corpo_esc = fonte.split("def _sess_ia_bases(x, n):")[1].split("\ndef _sess_ia_pede_rec")[0]
ok(not re.search(r"_db\(|sqlite|open\(|treino_cfg\(\)|ia_cfg\(\)", corpo_esc) and corpo_esc.count("print(") == 1, "_sess_ia_bases e _sess_ia_esc: sem banco nem arquivo; um só print, o do erro, sem pid")

if falhas:
    print("FALHA bases_melhores_agente: " + " | ".join(f for f in falhas if f))
    sys.exit(1)
print("OK bases_melhores_agente: primeiras = regra de antes (chave e ETERNA_BASES), sem sinal igual, troca por margem de 10 em ordem de clique, vetos, "
      "sem recorte no fechamento, escolha congelada (nota, rótulo, chave, reinício), cena_pendente e Separar, LGPD e teto dos caches, só o Admin, aba antiga, /status só números")
