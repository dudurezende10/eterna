# 18/11 (plano "bases dos fundos de IA só com foto do gramado", regra 19): reconhecer o ponto pela imagem no agente.
# Fatia B (critérios 7 a 21 e 25): filho de cena (falso: testes/_cena_filho_falso.py, o CLIP trocado por um vetor pela cor
# média; o resto do eterna-recorte.py é o de verdade), cena.db, Só medir, versão, medida sem a própria sessão, piso de
# semelhança, critério e congelamento do Ligada, LGPD, limpeza, filho morto, teto da fila, modo "duvidas" e a migração do
# Ligada antigo. Fatia C (26 a 38): as bases de cada leva só com gramado que passa na regra (recorte com gente, sem corte na
# lateral nem no alto, luz boa), cena_pendente/cena_indisponivel, Separar, motivos, CPU, limpeza e versão.
# Miniaturas desenhadas na hora (fundo de uma cor por ponto e uma "pessoa" no meio); nenhuma foto de convidado.
#   python3 -I testes/cena_agente.py agente/eterna-agente.py      (HOME temporário, como o testes/rodar.sh chama)
import http.client, importlib.util, json, os, random, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS"):
    os.environ.pop(k, None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
json.dump({"users": {n: "x" * 12 for n in ("carlos", "yago", "samuel")}}, open(os.path.join(HOME, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
m.FUNCAO_DIA_ON = False
m.REC_PISO_GB = 0.0
m.CENA_ERRO_SEG = 1
m.CENA_MEDIDA_SEG = 0
m.REC_ENV_PREFIXOS = ("CENA_FALSO",)
FALSO = os.path.join(AQUI, "_cena_filho_falso.py")
falhas = []
num = {}


def ok(c, msg):
    if not c:
        falhas.append(msg)


def espera(fn, seg=8.0):
    t0 = time.time()
    while time.time() - t0 < seg:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(0.1)
    return False


from PIL import Image, ImageDraw
COR = {"gramado": (40, 140, 50), "arquibancada": (40, 60, 160), "trofeu": (200, 170, 40), "chute": (25, 85, 35), "outro": (128, 128, 128)}
rnd = random.Random(19)
os.makedirs(m.THUMBS, exist_ok=True)
_n = [0]


def thumb(classe=None, cor=None, pid=None):
    """Miniatura sintética: fundo da classe (com uma variação pequena) e uma pessoa no meio (com flash no gramado)."""
    _n[0] += 1
    pid = pid or "%012x" % (0xce0000000000 + _n[0])
    c = cor or tuple(max(0, min(255, v + rnd.randint(-6, 6))) for v in COR[classe])
    im = Image.new("RGB", (300, 200), c)
    d = ImageDraw.Draw(im)
    pessoa = (235, 200, 180) if classe in ("gramado", "trofeu", "arquibancada", "outro") else (90, 70, 60)
    d.rectangle([130, 50, 170, 190], fill=pessoa)
    f = os.path.join(m.THUMBS, pid + ".jpg")
    im.save(f, "JPEG", quality=85)
    return pid, f


def biblioteca(pid, f, dia, u=None):
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"o": "carlos", "s": "ftp", "u": u or time.time()}


def rotula(pid, ponto, card, dia, quem="carlos", em=None):
    with m.treino_lock:
        db = m.treino_db()
        try:
            doc = {"v": 1, "pid": pid, "dia": dia, "fotografo": quem, "card": card, "ordem": 1, "ponto": ponto,
                   "ia": {"serve": None, "motivos": [], "frente": None}, "qual": {"nivel": None, "motivos": [], "ajuste": []},
                   "duvida": False, "obs": "", "por": "teste", "em": em or m._treino_em(), "origem": "mao", "lote": None}
            db.execute("insert or replace into rotulo values (?,?,?,?,?,?,?,?,?,?,?)",
                       (pid, 1, dia, quem, card, 1, json.dumps(doc), "teste", doc["em"], "mao", None))
            db.commit()
        finally:
            db.close()
    m._cena_base_t[0] = time.time()


def linha(pid):
    db = sqlite3.connect(m.CENA_DB)
    try:
        r = db.execute("select rotulo, conf, versao, prev0, vet is not null, rec from cena where pid = ?", (pid,)).fetchone()
    finally:
        db.close()
    return r


HOJE = m._ff_hoje()
DIAS = [m._ff_hoje(time.time() - i * 86400) for i in (2, 1, 0)]
try:
    # ---------- 7: sem o arquivo do modelo (SHA vazio): sem_modelo; o recorte segue ----------
    m.CENA_FALSO = None
    m.treino_cfg_gravar({"ponto": "medir"}, "adm")
    st7 = m.cena_status()
    ok(st7["pronto"] is False and st7["erro"] == "sem_modelo", "7: sem modelo: %r" % st7)
    m.CENA_SHA = "ab" * 32
    ok(m.cena_modelo_ok() == (False, "sem_modelo"), "7: SHA fixado e arquivo ausente: sem_modelo")
    os.makedirs(m.MODELOS, exist_ok=True)
    open(os.path.join(m.MODELOS, m.CENA_ARQ), "wb").write(b"outro arquivo")
    ok(m.cena_modelo_ok() == (False, "sem_modelo"), "7: SHA diferente: sem_modelo")
    m.CENA_SHA = ""
    ok(m.rec["erro"] is None, "7: o recorte não é tocado")

    # ---------- 8: desligada não enfileira ----------
    m.treino_cfg_gravar({"ponto": "desligada"}, "adm")
    p8, f8 = thumb("gramado")
    ok(m.cena_enfileira(p8, f8, 0) is False and not m.cena_q, "8: desligada: nada na fila")

    # ---------- 21: teto da fila (antes de a thread rodar) e varredura ----------
    m.treino_cfg_gravar({"ponto": "medir"}, "adm")
    m.CENA_FILA_MAX = 5
    ps21 = []
    for i in range(8):
        p, f = thumb("outro")
        biblioteca(p, f, HOJE)
        ps21.append((p, f))
        m.cena_enfileira(p, f, 1)
    ok(list(m.cena_q) == [p for p, _ in ps21[3:]], "21: acima do teto sai a mais antiga: %d" % len(m.cena_q))
    m.cena_q.clear()
    m.CENA_FILA_MAX = 5000
    n21 = m.cena_varre()
    ok(n21 >= 8 and all(p in m.cena_q for p, _ in ps21), "21: a varredura recoloca as de hoje sem resultado: %d" % n21)
    with m.lock:
        m.lib.pop(p8, None)

    # ---------- 8 (thread): desligada, o filho não abre ----------
    m.CENA_FALSO = FALSO
    m.treino_cfg_gravar({"ponto": "desligada"}, "adm")
    threading.Thread(target=m.cena_loop, daemon=True).start()
    time.sleep(1.5)
    ok(m.cena_filho["p"] is None, "8: desligada: o filho de cena não abriu")

    # ---------- rótulos de 3 dias, 3 fotógrafos ----------
    m.treino_cfg_gravar({"ponto": "medir"}, "adm")
    ROT = {}
    for di, dia in enumerate(DIAS):
        for ci, classe in enumerate(m.CENA_CLASSES):
            for k in range(4):
                p, f = thumb(classe)
                biblioteca(p, f, dia)
                card = "LP%d%d%dX" % (di, ci, k)
                rotula(p, classe, card, dia, ("carlos", "yago", "samuel")[k % 3])
                ROT[p] = classe
    # sessão "isolada": 3 fotos de cor única, marcadas troféu (13: nunca usam o vizinho da própria sessão)
    ISO = []
    for k in range(3):
        p, f = thumb(cor=(170, 40, 170))
        biblioteca(p, f, HOJE)
        rotula(p, "trofeu", "LPISOLADA", HOJE)
        ISO.append(p)
    m._cena_base_t[0] = time.time()
    b0 = m.cena_base("medir")
    ok(b0["sem_vetor"] > 0, "rótulos sem vetor vão para a fila: %r" % b0["sem_vetor"])
    ok(espera(lambda: m.cena_base("medir")["sem_vetor"] == 0 or (m._cena_base_t.__setitem__(0, time.time()) and False), 25),
       "os rótulos ganharam vetor: %r" % m.cena_base("medir")["sem_vetor"])
    m._cena_base_t[0] = time.time()
    base = m.cena_base("medir")
    num["rotulos_com_vetor"] = len(base["y"])

    # ---------- 9: foto nova em Só medir: rotulo, conf, versao e prev0 em até 5 s ----------
    p9, f9 = thumb("gramado")
    biblioteca(p9, f9, HOJE)
    t9 = time.time()
    m.cena_enfileira(p9, f9, 0)
    ok(espera(lambda: (linha(p9) or [None])[0] is not None, 5), "9: classificada em até 5 s: %r" % (linha(p9),))
    num["cena_s"] = round(time.time() - t9, 2)
    l9 = linha(p9)
    ok(l9 and l9[0] == "gramado" and l9[1] >= 0.7 and l9[2] == base["versao"] and json.loads(l9[3])["r"] == "gramado" and l9[4],
       "9: gramado com conf, versão e prev0: %r" % (l9[:4] if l9 else None,))
    st9 = m.cena_status()
    ok(st9["feitas_hoje"] >= 1 and isinstance(st9["fila"], int) and st9["pronto"] is True and st9["versao"] == base["versao"], "9: /status.treino.modelo_ponto: %r" % st9)
    ok(m.cena_mem.get(p9, {}).get("r") == "gramado", "9: cena_mem")

    # ---------- 15: escritório (outro) e foto de outro lugar (fora) ----------
    p15, f15 = thumb("outro")
    biblioteca(p15, f15, HOJE)
    pf, ff = thumb(cor=(0, 230, 230))
    biblioteca(pf, ff, HOJE)
    m.cena_enfileira(p15, f15, 0)
    m.cena_enfileira(pf, ff, 0)
    ok(espera(lambda: linha(p15) and linha(p15)[0] and linha(pf) and linha(pf)[0], 5), "15: classificadas")
    ok(linha(p15)[0] == "outro", "15: foto parecida com o escritório marcado: outro: %r" % (linha(p15),))
    ok(linha(pf)[0] == "fora" and not m.cena_mem[pf]["g"], "15: vizinho abaixo do piso: fora, nunca gramado: %r" % (linha(pf),))

    # ---------- 11: rótulo novo muda a versão e reclassifica as de hoje; prev0 fica ----------
    v_ant, prev_ant = base["versao"], linha(p9)[3]
    pn, fn_ = thumb("chute")
    biblioteca(pn, fn_, HOJE)
    rotula(pn, "chute", "LPNOVO1", HOJE)
    ok(espera(lambda: linha(p9)[2] != v_ant and linha(p9)[2] is not None, 8), "11: a foto de hoje foi reclassificada com a versão nova: %r" % (linha(p9)[2],))
    ok(linha(p9)[3] == prev_ant, "11: prev0 não muda")

    # ---------- HTTP: 12 (permissão, contrato, 429), 13, 14, 16 ----------
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    adm = S.cookie_sessao(m, "admin-cena")
    ver = S.cookie_sessao(m, "ver-cena", {"qualidade": {"r": True}})
    nada = S.cookie_sessao(m, "nada-cena", {"set": {"r": True, "u": True}})
    cfg = S.cookie_sessao(m, "cfg-cena", {"qualidade": {"r": True}, "configuracao": {"c": True, "r": True, "u": True}})

    def pede(metodo, rota, corpo=None, cookie=None):
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        c.request(metodo, rota, json.dumps(corpo or {}).encode() if metodo == "POST" else None, h)
        r = c.getresponse()
        b = r.read()
        c.close()
        try:
            return r.status, json.loads(b or b"{}")
        except ValueError:
            return r.status, b

    ok(pede("GET", "/treino/medida")[0] == 401 and pede("GET", "/treino/medida", cookie=nada)[0] == 403, "12: sem sessão 401, sem qualidade.r 403")
    st, md = pede("GET", "/treino/medida?metodo=sessao", cookie=ver)
    txt = json.dumps(md)
    ok(st == 200 and md.get("v") == 1 and md["classes"] == list(m.CENA_CLASSES) and "matriz" in md and "criterio" in md and "sinais" in md,
       "12: contrato: %s %r" % (st, sorted(md) if isinstance(md, dict) else md))
    ok('"vet"' not in txt and m.HOME not in txt and "/thumbs/" not in txt, "12: sem vetor nem caminho")
    ok(pede("GET", "/treino/medida?metodo=x", cookie=ver)[0] == 400, "12: método inválido 400")
    n429 = 0
    for i in range(12):
        if pede("GET", "/treino/medida", cookie=ver)[0] == 429:
            n429 = i + 3
            break
    ok(n429 == 11, "12: a 11ª chamada no minuto é 429: %d" % n429)
    # 13: a sessão isolada (cor única) nunca usa o vizinho dela mesma
    md = m.cena_medida("sessao")
    iso_err = {e["pid"]: e["previsto"] for e in md["erros"] if e["pid"] in ISO}
    ok(len(iso_err) == 3 and set(iso_err.values()) == {"fora"}, "13: validação sem a própria sessão (a isolada vira fora): %r" % iso_err)
    # 14: soma da matriz e precisão/cobertura batem com ela
    soma = sum(sum(v.values()) for v in md["matriz"].values())
    ok(soma == md["n"] == sum(md["rotulos"].values()) - md["sem_vetor"] * 0 and soma == len(m.cena_base("medir")["y"]), "14: soma da matriz = rótulos com vetor: %r" % soma)
    ok(all(md["classe"][c]["cobertura"] == (round(md["matriz"][c][c] / md["classe"][c]["n"], 4) if md["classe"][c]["n"] else None) for c in m.CENA_CLASSES),
       "14: cobertura = diagonal / linha")
    ok(all(md["classe"][c]["precisao"] in (None, round(md["matriz"][c][c] / max(1, sum(md["matriz"][a][c] for a in m.CENA_CLASSES)), 4)) for c in m.CENA_CLASSES),
       "14: precisão = diagonal / coluna")
    ok(md["faltam"]["gramado"] == 150 - md["rotulos"]["gramado"] and md["metas"]["chute"] == 60, "medida: quantos faltam por classe: %r" % md["faltam"])
    ok(set(md["sinais"]) == {"verde", "flash", "cadeiras", "dourado"} and md["sinais"]["verde"]["auc"] is not None, "medida: o que cada sinal ajuda: %r" % md["sinais"].get("verde"))
    num["auc"] = {k: v["auc"] for k, v in md["sinais"].items()}
    # 16: abaixo do critério: 409 e nada muda
    antes = m.treino_cfg()
    st, r16 = pede("POST", "/treino/config", {"ponto": "ligada"}, cookie=cfg)
    m._treino_cfg["t"] = 0.0
    ok(st == 409 and r16.get("error") == "criterio" and any(f.get("k") == "n" for f in r16.get("falta") or []) and m.treino_cfg()["ponto"] == "medir",
       "16: 409 criterio com falta e o config/treino não muda: %s %r" % (st, r16))
    ok(antes["ponto"] == "medir", "16: estava em medir")
    st, r16b = pede("POST", "/treino/config", {"ponto": "ligada", "ponto_versao": "c1-x"}, cookie=cfg)
    ok(st == 400, "16: ponto_versao vindo do navegador é recusado: %s" % st)
    m.estado_gravar({"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "ligada", "exposicao": "desligada", "ponto_versao": "c1-x"}}]})
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["ponto"] == "medir", "16: nem pela sincronização (estado_gravar)")
    st, r16c = pede("POST", "/treino/config", {"exposicao": "ligada"}, cookie=cfg)
    ok(st == 409 and r16c.get("error") == "criterio", "exposição ainda sem medida: Ligada recusada: %s %r" % (st, r16c))

    # ---------- 25: modo dúvidas ----------
    sessoes = [{"card": "LPDUV%03d" % i, "dia": HOJE, "fotografo": "carlos", "status": "fechada", "fotos": [p], "removida": False}
               for i, p in enumerate([p9, p15, pf, pn] + [p for p, c in ROT.items() if c in ("gramado", "chute")][:6])]
    json.dump({"dia": HOJE, "sessoes": sessoes}, open(os.path.join(m.SESS_DIR, HOJE + ".json"), "w"))
    m._treino_cache.clear()
    a25 = m.treino_amostra(HOJE, None, "duvidas", 50)
    db = sqlite3.connect(m.CENA_DB)
    cl = {p: (r, c) for p, r, c in db.execute("select pid, rotulo, conf from cena where rotulo is not null")}
    db.close()
    gc = [p for p in (x["pid"] for x in a25["itens"]) if cl.get(p, ("",))[0] in ("gramado", "chute")]
    melhor = min((abs(cl[p][1] - 0.7), p) for p in gc)[1] if gc else None
    ok(a25["itens"] and a25["itens"][0]["pid"] == melhor, "25: a primeira é a de conf mais perto de 0,70 (gramado ou chute): %r" % [(x["pid"], cl.get(x["pid"])) for x in a25["itens"][:3]])
    st, r = pede("GET", "/treino/amostra?dia=%s&modo=duvidas" % HOJE, cookie=ver)
    ok(st == 200, "25: rota aceita duvidas em medir: %s" % st)

    # ---------- 17: acima do critério: congela; rótulo depois não muda o Ligada ----------
    m.CENA_META = {c: 2 for c in m.CENA_CLASSES}
    m.CENA_CRIT = dict(m.CENA_CRIT, prosp_n=0, prosp_precisao=0.0)
    st, r17 = pede("POST", "/treino/config", {"ponto": "ligada"}, cookie=cfg)
    m._treino_cfg["t"] = 0.0
    LV = (r17 or {}).get("ponto_versao")
    ok(st == 200 and LV and m.treino_cfg()["ponto"] == "ligada" and m.treino_cfg()["ponto_versao"] == LV, "17: Ligada acima do critério: %s %r" % (st, r17))
    db = sqlite3.connect(m.CENA_DB)
    mod = db.execute("select versao, por from modelo").fetchall()
    db.close()
    ok(mod == [(LV, "cfg-cena")], "17: uma linha em modelo com quem ligou: %r" % mod)
    ok(m.cena_status()["ligada_versao"] == LV, "17: /status ligada_versao")
    x17, fx = thumb("gramado")
    biblioteca(x17, fx, HOJE)
    rotula(x17, "arquibancada", "LPDEPOIS", HOJE)
    m._cena_base_t[0] = time.time()
    ok(m.cena_base("ligada")["versao"] == LV and x17 not in m.cena_base("ligada")["pids"], "17: rótulo gravado depois não entra no Ligada")
    ok(espera(lambda: m.cena_mem.get(p9, {}).get("v") == LV, 8), "38: as de hoje reclassificadas com a versão ligada")

    # ---------- 18: LGPD ----------
    alvo = next(p for p, c in ROT.items() if c == "gramado")
    nb = len(m.cena_base("ligada")["pids"])
    m.lgpd_excluir([alvo], [], quem="teste")
    ok(linha(alvo) is None and alvo not in m.cena_mem and alvo not in m.cena_base("ligada")["pids"] and len(m.cena_base("ligada")["pids"]) == nb - 1,
       "18: LGPD tira a linha, a memória e o vizinho do modelo congelado")

    # ---------- C: as bases de cada leva ----------
    m.REC_FALSO_SEG = 0.02
    INFO = {}
    m.REC_FALSO_INFO = lambda pid: INFO.get(pid)
    threading.Thread(target=m.rec_ia_loop, daemon=True).start()
    T = time.time() - 600
    _s = [0]

    def reset():
        with m.sess_lock:
            for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info, m.sess_faces_pid, m.sess_rostos_mem):
                d.clear()
            m.cena_pend.clear()

    def leva(classes, quem="carlos", info=None, sem_thumb=()):
        out = []
        for i, c in enumerate(classes):
            _s[0] += 1
            p, f = thumb(c)
            if i in sem_thumb:
                os.remove(f)                     # a miniatura sumiu: nunca é classificada
            md = {"o": quem, "s": "ftp", "u": T + _s[0] * 3 + 1, "cap": T + _s[0] * 3}
            with m.lock:
                m.lib[p] = {"file": f, "thumb": f}
                m.meta[p] = dict(md)
            if info and info.get(i):
                INFO[p] = info[i]
            with m.sess_lock:
                m._sess_add(p, md, m.ff_cadastrados(), agora=md["u"])
            m.cena_enfileira(p, f, 0)
            out.append(p)
        return out

    def x_de(p):
        return m.sess.get(m.sess_pid.get(p) or "")

    def fecha(ps):
        ok(espera(lambda: all(m.cena_mem.get(p, {}).get("v") == LV for p in ps), 10), "classificadas antes de fechar")
        espera(lambda: all(base_ok(p) is not None for p in ps if m.cena_mem.get(p, {}).get("g")), 10)
        m.sess_tick(T + _s[0] * 3 + 500)
        return x_de(ps[0])

    def base_ok(p):
        return m.base_rec_ok((m.cena_mem.get(p) or {}).get("rec"))

    # 26: arquibancada, 3 gramados, chute, troféu -> a 2ª e a 3ª
    reset()
    p26 = leva(["arquibancada", "gramado", "gramado", "gramado", "chute", "trofeu"])
    x26 = fecha(p26)
    ok(x26["ia"] == p26[1:3] and x26["ia_regra"]["motivo"] is None, "26: ia = a 2ª e a 3ª (gramado): %r %r" % (x26["ia"], x26["ia_regra"]))
    ok(p26[3] in x26["fotos"] and p26[0] in x26["fotos"], "26: a 4ª (gramado) e as outras ficam à venda")
    ok(m.rec_pre_escolha(x26["fotos"], x26) == p26[1:3], "36: recorte antecipado na CPU = só as bases")
    # 27: só escritório
    reset()
    p27 = leva(["outro"] * 4)
    x27 = fecha(p27)
    ok(x27["ia"] == [] and x27["ia_regra"]["motivo"] == "sem_gramado", "27: só outro: sem_gramado: %r" % x27["ia_regra"])
    ok(m.rec_pre_escolha(x27["fotos"], x27) == [], "36: sem bases, nada para recortar (sem plano B)")
    # 28: gramado cortado na lateral, sem pessoa e escuro são pulados; corpo inteiro (trunc falso) serve (D8 novo)
    reset()
    p28 = leva(["gramado"] * 5, info={0: {"trunc": True, "borda": ["esq"], "luz": {"med": 120, "p95": 200}},
                                      1: {"sem_pessoa": True}, 2: {"trunc": True, "borda": [], "luz": {"med": 20, "p95": 90}},
                                      3: {"trunc": False, "borda": [], "luz": {"med": 130, "p95": 210}, "joelho": 0.7, "pernas": True}})
    x28 = fecha(p28)
    ok(x28["ia"] == p28[3:5], "28: cortada, sem pessoa e escura pulam; corpo inteiro serve: %r %r" % (x28["ia"], [base_ok(p) for p in p28]))
    # D9: só 1 serve
    reset()
    p9b = leva(["gramado", "arquibancada", "outro", "chute"])
    x9b = fecha(p9b)
    ok(x9b["ia"] == p9b[:1] and x9b["ia_regra"]["motivo"] is None, "D9: só 1 gramado: 1 base: %r" % x9b["ia"])
    # 30: pendente -> preenchida com reaberta cena; base vendida não preenche
    reset()
    with m.cena_filho_lock:                     # segura o filho: a leva fecha antes de ser classificada
        p30 = leva(["gramado", "gramado", "chute", "outro"])
        m.sess_tick(T + _s[0] * 3 + 500)
        x30 = x_de(p30[0])
        ok(x30["ia"] == [] and x30["ia_regra"]["motivo"] == "cena_pendente" and x30["card"] in m.cena_pend, "30: fechou pendente: %r" % x30["ia_regra"])
    ok(espera(lambda: m.cena_mem.get(p30[1], {}).get("v") == LV and base_ok(p30[1]), 10), "30: classificou e recortou depois")
    ok(espera(lambda: x30["ia"] == p30[:2], 10) and x30["ia_regra"].get("reaberta") == "cena", "30: ia preenchida com reaberta cena: %r %r" % (x30["ia"], x30["ia_regra"]))
    reset()
    real_pagas = m.lgpd_vendas_pagas
    with m.cena_filho_lock:
        p30b = leva(["gramado", "gramado", "chute", "outro"])
        m.sess_tick(T + _s[0] * 3 + 500)
    m.lgpd_vendas_pagas = lambda: {p30b[0]}
    x30b = x_de(p30b[0])
    ok(espera(lambda: x30b["ia_regra"]["motivo"] != "cena_pendente", 12), "30: a pendente terminou")
    ok(x30b["ia"] == [] and x30b["ia_regra"]["motivo"] == "cena_indisponivel", "30: base já vendida: o agente não preenche: %r" % x30b["ia_regra"])
    m.lgpd_vendas_pagas = real_pagas
    # 31: pendente por mais de 15 min: cena_indisponivel
    reset()
    ps31 = leva(["gramado", "gramado", "chute"], sem_thumb=(0,))
    p31 = ps31[0]
    m.sess_tick(T + _s[0] * 3 + 500)
    x31 = x_de(p31)
    ok(x31["ia_regra"]["motivo"] == "cena_pendente", "31: pendente: %r" % x31["ia_regra"])
    m.cena_completa(time.time() + m.CENA_PEND_MAX + 5)
    ok(x31["ia"] == [] and x31["ia_regra"]["motivo"] == "cena_indisponivel" and x31["card"] not in m.cena_pend, "31: passou do prazo: cena_indisponivel: %r" % x31["ia_regra"])
    # 32: Separar reabre só com gramado
    reset()
    p32 = leva(["chute", "outro", "gramado", "gramado"])
    x32 = fecha(p32)
    with m.sess_lock:
        x32["ia"], x32["ia_regra"] = [], {"n": 2, "motivo": "visita_ja_tem"}
        r32 = m._vis_ia_reabre([x32["card"]], "separar")
    ok(r32 == [x32["card"]] and x32["ia"] == p32[2:4] and x32["ia_regra"]["reaberta"] == "separar", "32: Separar reabre com o gramado, não com as 2 primeiras: %r" % x32["ia"])
    # 29: gramado ainda esperando o rosto (pend) já é candidata
    reset()
    p29 = leva(["gramado", "chute", "chute"])
    x29 = x_de(p29[0])
    with m.sess_lock:
        x29["fotos"].remove(p29[0])
        x29["pend"].append(p29[0])
        x29["_ia_vistos"] = set()
        m.sess_ia_novos.clear()
    espera(lambda: m.cena_mem.get(p29[0], {}).get("v") == LV, 8)
    m.cena_chegou([p29[0]])
    ok(p29[0] in x29["_ia_vistos"] and p29[0] in m.sess_ia_hoje(), "29 e 37: gramado em pend vai para o recorte e fica guardado na limpeza")
    # 38: classificação de outra versão não vale
    with m.sess_lock:
        c = m.cena_mem[p29[1]]
        m.cena_mem[p26[1]] = dict(m.cena_mem[p26[1]], v="c1-outra")
        b38 = m._sess_ia_bases(x26, 2)
    ok(b38[1] == "pendente", "38: versão diferente da ligada = pendente: %r" % (b38,))
    # 33: desligada e medir
    for modo, mot in (("medir", "cena_medir"), ("desligada", "cena_desligada")):
        m.treino_cfg_gravar({"ponto": modo}, "adm")
        reset()
        ps = leva(["gramado", "gramado", "gramado"])
        m.sess_tick(T + _s[0] * 3 + 500)
        x = x_de(ps[0])
        ok(x["ia"] == [] and x["ia_regra"]["motivo"] == mot, "33: %s: %r" % (modo, x["ia_regra"]))
    m.FUNCAO_DIA_ON = True
    with m.sess_lock:
        ok(m._sess_ia_regra({"fotografo": None, "funcao": None})[1] == "sem_funcao", "33: com a Escala religada vale a regra 15 (D11)")
    m.FUNCAO_DIA_ON = False

    # ---------- migração do Ligada antigo ----------
    with m.estado_lock:
        db = m.estado_db()
        db.execute("update doc set valor = ? where col = 'config' and id = 'treino'", (json.dumps({"ponto": "ligada", "exposicao": "ligada"}),))
        db.commit()
        db.close()
    m._treino_cfg["t"] = 0.0
    mg = m.treino_cfg()
    ok(mg["ponto"] == "medir" and mg["exposicao"] == "medir" and mg["por"] == "servidor", "Ligada gravado antes vira Só medir sozinho: %r" % mg)

    # ---------- 19: limpeza e backup ----------
    pl, fl = thumb("outro")
    biblioteca(pl, fl, HOJE)
    m.cena_enfileira(pl, fl, 0)
    ok(espera(lambda: linha(pl) and linha(pl)[4], 6), "19: vetor gravado")
    m.cena_limpa(time.time() + 3 * 86400)
    ok(linha(pl) and not linha(pl)[4] and linha(next(iter(ISO)))[4], "19: vetor sem rótulo some em 2 dias; o rotulado fica")
    m.cena_limpa(time.time() + 61 * 86400)
    ok(linha(pl) is None and linha(ISO[0]) is not None, "19: a linha some com 60 dias (a rotulada fica)")
    fonte = open(sys.argv[1], encoding="utf8").read()
    ok("CENA_DB" not in fonte.split("bancos = [b for b in (")[1].split(")")[0], "19: cena.db fora do backup")

    # ---------- 20: filho morto reabre e para na 3ª morte, sem tocar no recorte ----------
    m.treino_cfg_gravar({"ponto": "medir"}, "adm")
    os.environ["CENA_FALSO_MORRE"] = "1"
    m.cena_fechar()
    rec_erro = m.rec["erro"]
    pm, fm = thumb("outro")
    biblioteca(pm, fm, HOJE)
    m.cena_enfileira(pm, fm, 0)
    ok(espera(lambda: m.cena["mortes"] >= 1, 8), "20: primeira morte")
    ok(espera(lambda: m.cena["parado"] == "parado", 15) and m.cena_status()["erro"] == "parado", "20: parado na 3ª morte: %r" % m.cena["mortes"])
    ok(m.rec["erro"] == rec_erro, "20: o erro do recorte não muda")
    del os.environ["CENA_FALSO_MORRE"]
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1200:])
print(("OK" if not falhas else "FALHA") + " cena_agente: reconhecer o ponto (fatia B: 7 a 21, 25; fatia C: 26 a 38) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
