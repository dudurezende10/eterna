# Montagem no servidor, E1 e E2 (plano docs/planos/2026-11-16-montagem-no-servidor.md): chave desligada | sombra, fila com
# prioridade, arquivos com versão, as duas rotas, /status.montagem, linhas do journal, limpeza, disco, LGPD, processo que
# morre e reinício. Critérios 1, 2, 13 a 18 e 20. Desde a regra 19 as bases são só as do servidor (x["ia"], fotos de
# gramado): sessão sem bases não é montada (sem plano B) e foto de sessão que não é base não vira montagem nova (E2).
# Roda com HOME temporário:  HOME=$(mktemp -d) python3 -I testes/montagem_servidor_agente.py agente/eterna-agente.py
# O agente é carregado neste processo (sem main: o teste dá as voltas do mtg_loop à mão); o processo de montagem é o de
# verdade (agente/eterna-montagem.py) e, para segurar uma montagem no meio, o testes/_montagem_filho_falso.py. Os fundos
# são copiados do repositório para o app-cache do HOME do teste (nenhuma rede, nenhuma porta fixa). Só figuras desenhadas
# aqui (nunca foto de cliente).
import http.client, importlib.util, io, json, os, re, shutil, stat, subprocess, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "agente", "eterna-agente.py"))
falhas, notas = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


for k in ("ETERNA_MONTAGEM", "ETERNA_MONTAGENS_GB", "ETERNA_PASTA", "ETERNA_TESTE_CARGA"):
    os.environ.pop(k, None)
os.environ["ETERNA_SEM_OPENCV"] = "1"               # os rostos do agente não entram aqui (o motor lê os dele no próprio processo)


class Tee(io.TextIOBase):
    def __init__(self, real):
        self.real, self.linhas = real, []

    def write(self, s):
        self.linhas.append(s)
        return len(s)

    def flush(self):
        pass


console = Tee(sys.stdout)
sys.stdout = console
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"                  # nada é baixado: os fundos já estão no app-cache
m.REC_PISO_GB = 0.2                                  # a máquina de teste pode ter pouco disco; o caso do piso troca de novo
HOJE = m._ff_hoje()
for d in (m.INBOX, m.RECORTES, m.APP_CACHE_DIR, os.path.join(m.HOME, "ponto")):
    os.makedirs(d, exist_ok=True)
for f in m.MTG_ATIVOS:
    for t in ("previa", "hi"):
        rel = m.MTG_FUNDOS[f][t]
        if not os.path.isfile(m.app_disco(rel)):
            shutil.copyfile(os.path.join(RAIZ, rel), m.app_disco(rel))
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT
_n = [0]


def pede(metodo, rota, corpo=None, cookie=None, xeterna=True, cru=False):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    h = {"Host": HOST}
    if metodo == "POST":
        h["Content-Type"] = "application/json"
        if xeterna:
            h["X-Eterna"] = "1"
    if cookie:
        h["Cookie"] = cookie
    c.request(metodo, rota, json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None, h)
    r = c.getresponse()
    b = r.read()
    hs = {k.lower(): v for k, v in r.getheaders()}
    c.close()
    if cru:
        return r.status, b, hs
    try:
        return r.status, json.loads(b or b"{}"), hs
    except ValueError:
        return r.status, None, hs


def recorte_png(i, vazio=False):
    """Uma figura de meio corpo (encosta embaixo) em 1200x800, RGB zerado fora; vazio = recorte sem ninguém."""
    im = Image.new("RGBA", (1200, 800), (0, 0, 0, 0))
    if not vazio:
        d = ImageDraw.Draw(im)
        cx = 450 + 60 * (i % 5)
        d.ellipse([cx - 90, 120, cx + 90, 340], fill=(226, 190, 160, 255))
        d.rounded_rectangle([cx - 230, 330, cx + 230, 900], radius=70, fill=(30 + 40 * (i % 5), 70, 140, 255))
    return im


def nova_foto(com_recorte=True, vazio=False):
    _n[0] += 1
    pid = "ba5e%08x" % _n[0]
    f = os.path.join(m.INBOX, pid + "_F%04d.JPG" % _n[0])
    Image.new("RGB", (320, 240), (40, 90, 30 + _n[0] % 200)).save(f, "JPEG")
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"u": time.time()}
    if com_recorte:
        recorte_png(_n[0], vazio).save(m.rec_arquivo(pid), "PNG")
    return pid


def nova_sessao(card, n_bases=2, extras=1, ia=True):
    """Leva fechada; ia=True: as n_bases primeiras são as bases de IA que o servidor reconheceu (regra 19, x["ia"])."""
    fotos = [nova_foto() for _ in range(n_bases)] + [nova_foto(False) for _ in range(extras)]
    with m.sess_lock:
        m.sess[card] = {"card": card, "dia": HOJE, "status": "fechada", "fotos": list(fotos), "pend": [], "dec": {}, "removida": False,
                        "ia": list(fotos[:n_bases]) if ia else [], "ia_regra": {"n": 2, "motivo": None} if ia else {"n": 2, "motivo": "sem_gramado"},
                        "_t": {}, "ultima_chegada": time.time(), "fechada_em": time.time()}
        for p in fotos:
            m.sess_pid[p] = card
    return fotos[:n_bases]


def vendida(pid, fundos, n=[0]):
    """Uma venda paga no vendas.db com as montagens da base pid nos fundos (a reimpressão de venda antiga)."""
    n[0] += 1
    v = "vmtg%04d" % n[0]
    em = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    m.ev_receber({"posto": "Caixa 1", "eventos": [
        {"tipo": "criar", "idem": v + ":1", "venda": v, "seq": 1, "em": em, "por": {"nome": "Vendedor Teste"},
         "dados": {"card": "LPMTGV%04d" % n[0], "saleNo": "P1-%03d" % n[0], "total": 90, "nPh": 0, "meio": "pix", "aiSel": ["ag_%s|%s" % (pid, f) for f in fundos]}},
        {"tipo": "pagar", "idem": v + ":2", "venda": v, "seq": 2, "em": em, "dados": {}}]})


def espera(fn, seg=120, passo=0.05):
    t0 = time.time()
    while time.time() - t0 < seg:
        if fn():
            return True
        time.sleep(passo)
    return False


def cfg(valor):
    r = m.estado_gravar({"docs": [{"col": "config", "id": "montagem", "valor": valor}]}, quem="teste")
    m._mtg_cfg["t"] = 0.0
    return r


VISTO = {"modo": None, "versoes": None, "limpeza": 0.0}


def volta():
    m._mtg_cfg["t"] = 0.0
    m.mtg_volta(VISTO)


def fila_vazia():
    with m.mtg_lock:
        return not m.mtg_jobs


def roda(seg=150):
    """Dá voltas do laço até não haver o que montar (cada volta enfileira o que falta; a impressão entra depois da prévia)."""
    t0 = time.time()
    quieto = 0
    while time.time() - t0 < seg:
        volta()
        espera(fila_vazia, seg)
        with m.mtg_lock:
            antes = m.mtg["feitas"]
        volta()
        time.sleep(0.05)
        with m.mtg_lock:
            parado = not m.mtg_jobs and m.mtg["feitas"] == antes
        quieto = quieto + 1 if parado else 0
        if quieto >= 2:
            return True
    return False


def arqs(pid):
    try:
        return sorted(x for x in os.listdir(os.path.join(m.MONTAGENS, pid)) if x.endswith(".jpg"))
    except OSError:
        return []


def arq(pid, fundo, t):
    return m.mtg_arquivo(pid, fundo, t)


def linhas_srv():
    return [x for x in "".join(console.linhas).splitlines() if "montagem-srv:" in x]


try:
    adm = S.cookie_sessao(m, "admin-mtg")
    nada = S.cookie_sessao(m, "sem-modulo-mtg", {})
    semvenda = S.cookie_sessao(m, "fotografo-mtg", {"set": {"r": True, "c": True}})
    posto = S.cookie_posto(m, "Checkout de teste")

    # ---- critério 1: chave desligada (padrão): nada roda, nenhuma pasta, as duas rotas 503
    A0, B0 = nova_sessao("LP-MTG-0")
    ok(m.mtg_cfg() == {"modo": "desligada"}, "1: sem documento a chave é desligada: %r" % (m.mtg_cfg(),))
    for _ in range(3):
        volta()
    m.mtg_recorte_pronto(A0)
    volta()
    st = m.mtg_status()
    ok(st["v"] == 1 and st["modo"] == "desligada" and st["ok"] is False and st["fundos"] == {} and st["filho"]["vivo"] is False and st["fila"] == 0,
       "1: /status.montagem desligada: %r" % st)
    ok(not os.path.exists(m.MONTAGENS) and m.mtg_filho["p"] is None and not m.mtg_threads, "1: desligada não cria pasta, processo nem trabalhador")
    ok(m.mtg_enfileirar(A0, "telao", ("p",), 0) == (None, "desligada"), "1: fila recusa com a chave desligada")
    s1, j1, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % A0, cookie=posto)
    s2, j2, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + A0], "fundos": ["telao"], "tipos": ["p"]}, cookie=posto)
    ok(s1 == 503 and s2 == 503 and j1 == {"error": "montagem_desligada"} and j2 == {"error": "montagem_desligada"}, "1: rotas 503 desligadas: %s %s %r %r" % (s1, s2, j1, j2))
    s, j, _ = pede("GET", "/status", cookie=posto)
    ok(s == 200 and (j.get("montagem") or {}).get("modo") == "desligada", "1: /status do posto traz montagem.modo desligada")
    ok(not os.path.exists(m.MONTAGENS), "1: as rotas desligadas não criam a pasta")
    # a chave só aceita o formato conhecido
    for ruim in ({"modo": "x"}, {"modo": "sombra", "outra": 1}, {"ligada": True}, "sombra", {"modo": ["sombra"]}):
        cfg(ruim)
        ok(m.mtg_cfg()["modo"] == "desligada", "1: config/montagem inválida é recusada: %r" % (ruim,))
    r = cfg({"modo": "sombra", "por": "admin-mtg", "em": "2026-11-16T10:00:00Z"})
    ok(r.get("gravados") == 1 and m.mtg_cfg()["modo"] == "sombra", "chave em sombra: %r %r" % (r, m.mtg_cfg()))
    os.environ["ETERNA_MONTAGEM"] = "0"
    ok(m.mtg_cfg()["modo"] == "desligada" and m.mtg_status()["motivo"].startswith("desligada no servidor"), "1: ETERNA_MONTAGEM=0 vence a chave")
    os.environ.pop("ETERNA_MONTAGEM")
    # quem grava a chave: só configuracao.u (a regra dos documentos de config)
    s, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "montagem", "valor": {"modo": "ligada"}}]}, cookie=semvenda)
    ok(s == 200 and j.get("recusados") == 1, "1: sem configuracao.u não muda a chave: %s %r" % (s, j))
    s, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "montagem", "valor": {"modo": "ligada"}}]}, cookie=posto)
    ok(s == 200 and j.get("recusados") == 1 and m.mtg_cfg()["modo"] == "sombra", "1: o posto não muda a chave: %s %r" % (s, j))

    # D8: a cópia de 2400 do recorte (a prévia do navegador) leva o joelho (tEXt "eterna") como a de 3000
    from PIL.PngImagePlugin import PngInfo
    J1 = nova_foto(False)
    pi = PngInfo()
    pi.add_text("eterna", json.dumps({"v": 1, "joelho": .74, "pernas": True}))
    Image.new("RGBA", (3000, 2000), (0, 0, 0, 0)).save(m.rec_arquivo(J1), "PNG", pnginfo=pi)
    p24 = m.rec_fazer(J1, m.lib[J1]["file"], 2400)
    with Image.open(p24) as im:
        ok(im.size == (2400, 1600) and json.loads(im.info.get("eterna") or "{}") == {"v": 1, "joelho": .74, "pernas": True},
           "D8: a cópia de 2400 mantém o joelho do recorte: %r %r" % (im.size, im.info.get("eterna")))
    with m.lock:
        m.lib.pop(J1, None)

    # ---- critério 2: sombra. A volta da partida (prioridade 4) pega a sessão que já existia; a sessão nova entra por 1, 2 e 3
    ok(roda(), "2: a sessão que já existia é montada na partida")
    NF = len(m.MTG_ATIVOS)
    ok(NF == 4 and m.MTG_ATIVOS == ("mirantedia", "arq1950", "telao", "tunel"), "2: os 4 fundos ativos de hoje, com o túnel: %r" % (m.MTG_ATIVOS,))
    ok(len(arqs(A0)) + len(arqs(B0)) == 3 * NF, "2: sessão anterior com %d arquivos: %r %r" % (3 * NF, arqs(A0), arqs(B0)))
    # regra 19, sem plano B: leva sem bases do servidor não é montada (nunca as 2 primeiras fotos de qualquer ponto)
    SB = nova_sessao("LP-MTG-SB", ia=False)
    ok(m.mtg_candidatas({"fotos": SB, "ia": [], "ia_regra": {"motivo": "sem_gramado"}}) == [] and m.mtg_candidatas({"fotos": SB, "ia": SB[:1], "ia_regra": {}}) == SB[:1]
       and m.mtg_candidatas({"fotos": SB, "ia": SB, "ia_regra": {"motivo": "visita_ja_tem"}}) == [], "regra 19: as candidatas são só x[\"ia\"]")
    ordem = []                                         # ordem em que o trabalhador terminou cada trabalho (não o mtime dos arquivos)
    _faz0 = m._mtg_fazer

    def _faz(job):
        r = _faz0(job)
        ordem.append((job["pid"], job["fundo"], tuple(sorted(job["tipos"])), r))
        return r
    m._mtg_fazer = _faz
    A, B = nova_sessao("LP-MTG-1")
    feitas0 = m.mtg_status()["feitas"]
    ok(roda(), "2: a sessão nova fica toda montada")
    m._mtg_fazer = _faz0
    V = {f: m.mtg_versao(f) for f in m.MTG_ATIVOS}
    ok(all(v and re.match(r"^[0-9a-f]{8}$", v) for v in V.values()) and len(set(V.values())) == NF, "2: uma versão de 8 hex por fundo: %r" % V)
    pref = {"arq1950": A, "mirantedia": B, "telao": B, "tunel": A}   # FIA_BASE: 1950 e túnel = 1ª base; Mirante e Telão = 2ª
    outra = {f: (B if p == A else A) for f, p in pref.items()}
    esperado = sorted([arq(pref[f], f, "p") for f in pref] + [arq(outra[f], f, "p") for f in pref] + [arq(pref[f], f, "i") for f in pref])
    tem = sorted(os.path.join(m.MONTAGENS, p, x) for p in (A, B) for x in arqs(p))
    ok(tem == esperado, "2: 4 prévias preferidas + 4 da outra base + 4 impressões das preferidas: %r" % [os.path.relpath(x, m.MONTAGENS) for x in tem])
    if tem == esperado:
        cls = [(1 if pref[f] == pid else 2) if tipos == ("p",) else 3 for pid, f, tipos, r in ordem if pid in (A, B) and r is None]
        ok(len(cls) == 3 * NF and cls == sorted(cls), "2: ordem: preferidas, depois a outra base, depois as impressões: %r" % cls)
        for f in pref:
            with Image.open(arq(pref[f], f, "p")) as im:
                ok(im.size == tuple(m.mtg_dims(f)) and im.format == "JPEG", "2: prévia de %s no tamanho do fundo: %r x %r" % (f, im.size, m.mtg_dims(f)))
            with Image.open(arq(pref[f], f, "i")) as im:
                ok(im.size == (1844, 1240), "2: impressão de %s em 1844x1240: %r" % (f, im.size))
        ok(m.mtg_dims("telao") == (2576, 1839) and m.mtg_dims("mirantedia")[0] == 2400, "2: tamanhos das prévias: %r %r" % (m.mtg_dims("telao"), m.mtg_dims("mirantedia")))
        ok(all(stat.S_IMODE(os.stat(x).st_mode) == 0o600 for x in tem) and stat.S_IMODE(os.stat(os.path.join(m.MONTAGENS, A)).st_mode) == 0o750,
           "2: arquivos 600 e pasta da foto 750")
    try:
        info = json.load(open(m.mtg_info(B)))
    except (OSError, ValueError):
        info = {}
    ok(info.get("v") == "m2" and info.get("trunc") is True and isinstance(info.get("q"), float) and "frente" in info and isinstance(info.get("em"), int)
       and set(info) == {"v", "frente", "trunc", "q", "em"}, "2: info-m2.json da foto: %r" % info)
    st = m.mtg_status()
    ok(st["modo"] == "sombra" and st["ok"] is True and st["fundos"] == V and st["filho"]["vivo"] and st["feitas"] - feitas0 == 3 * NF and st["fila"] == 0 and st["erros"] == 0
       and st["ms_medio"] and st["atraso_p50_s"] is not None and st["atraso_p90_s"] is not None and st["guardado_gb"] >= 0 and st["piso_gb"] == m.REC_PISO_GB
       and st["pausa_disco"] is False and st["no_hd"] is False and st["versao"] == "m2" and st["parado"] is None
       and st["imprime"] is True and st["montaveis"] == sorted(m.MTG_FUNDOS) and st["ativos"] == list(m.MTG_ATIVOS), "2: /status.montagem em sombra: %r" % st)
    ok(not arqs(SB[0]) and not arqs(SB[1]), "regra 19: a leva sem bases do servidor não tem montagem: %r" % (arqs(SB[0]) + arqs(SB[1])))
    notas["ms_medio"] = st["ms_medio"]
    ls = linhas_srv()
    ok(any("modo=sombra versao=m2" in x and "no_hd=nao" in x and all("%s:%s" % (f, V[f]) in x for f in V) for x in ls), "2: linha de partida no registro: %r" % ls[:3])
    ok(any(re.search(r"processo aberto em \d+ ms", x) for x in ls), "2: linha do processo aberto")
    ok(not any(p in x for x in ls for p in (A, B, A0, B0)) and not any("ba5e" in x or ".png" in x or ".JPG" in x for x in ls), "2: nenhuma linha montagem-srv com id ou arquivo de foto")
    # a linha dos 5 minutos sai quando houve movimento
    with m.mtg_lock:
        m.mtg["log_em"] = 0.0
    m._mtg_linha_5min(time.time())
    ok(any(re.search(r"feitas=\d+ fila=\d+ erros=0 ms_medio=\d+ atraso p50/p90=", x) for x in linhas_srv()), "2: linha de movimento no registro: %r" % linhas_srv()[-1:])
    # E2: o app só lê a montagem do servidor com a chave em "ligada"; em sombra e desligada o compose segue no fiaMontar
    html = open(os.path.join(RAIZ, "index.html"), encoding="utf8").read()
    comp = html[html.index("async function compose(photoId,bgId)"):]
    ok("if(mtgSrv())return mtgCompose(photoId,bgId);" in comp[:900] and "fiaMontar(photoId,bgId)" in comp[:1100] and "m.modo==='ligada'&&m.imprime===true" in html
       and "if(mtgSrv())return mtgHi(photoId,bgId);" in html, "2: compose e compHi leem o servidor só com a chave ligada")
    # sessão com uma base só: os 3 fundos usam essa; recorte sem ninguém: sem_pessoa, sem tentar de novo
    (U1,) = nova_sessao("LP-MTG-2", n_bases=1, extras=0)
    SP = nova_foto(vazio=True)
    with m.sess_lock:
        m.sess["LP-MTG-3"] = {"card": "LP-MTG-3", "dia": HOJE, "status": "fechada", "fotos": [SP], "pend": [], "dec": {}, "removida": False, "ia": [SP], "ia_regra": {}, "_t": {}}
        m.sess_pid[SP] = "LP-MTG-3"
    ok(roda(), "2: sessões de uma base e sem pessoa terminam")
    ok(len(arqs(U1)) == 2 * NF and not arqs(SP) and SP in m.mtg_sem_pessoa and m.mtg_status()["erros"] == 0, "2: uma base = 4 prévias e 4 impressões; sem pessoa não conta erro: %r %r" % (arqs(U1), arqs(SP)))

    # ---- critério 15: as duas rotas
    rota_p = "/montagem/ag_%s/telao.jpg?t=p" % B
    s, j, _ = pede("GET", rota_p)
    ok(s == 401 and j == {"erro": "sem_sessao"}, "15: sem posto e sem sessão a rota não abre (a mesma resposta de toda rota fechada): %s %r" % (s, j))
    s2, j2, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % ("f" * 12))
    ok((s2, j2) == (s, j), "15: sem credencial, foto que existe e foto que não existe respondem igual")
    ok(pede("GET", rota_p, cookie=nada)[0] == 403 and pede("GET", rota_p, cookie=semvenda)[0] == 403, "15: sessão sem módulo de venda: 403")
    corpo = {"pids": ["ag_" + B], "fundos": ["telao"], "tipos": ["p"]}
    ok(pede("POST", "/montagens/pedir", corpo)[0] == 401 and pede("POST", "/montagens/pedir", corpo, cookie=semvenda)[0] == 403
       and pede("POST", "/montagens/pedir", corpo, cookie=posto, xeterna=False)[0] == 403, "15: pedir sem credencial, sem módulo e sem X-Eterna")
    s, b, hs = pede("GET", rota_p, cookie=posto, cru=True)
    ok(s == 200 and b[:2] == b"\xff\xd8" and hs.get("content-type") == "image/jpeg" and hs.get("cache-control") == "private, no-store"
       and hs.get("x-content-type-options") == "nosniff" and hs.get("x-eterna-montagem") == V["telao"] and "access-control-allow-origin" not in hs,
       "15: GET entrega o JPEG sem cache: %s %r" % (s, {k: hs.get(k) for k in ("content-type", "cache-control", "x-content-type-options", "x-eterna-montagem")}))
    ok(b == open(arq(B, "telao", "p"), "rb").read(), "15: o arquivo servido é o guardado")
    ok(pede("GET", rota_p + "&v=" + V["telao"], cookie=adm, cru=True)[0] == 200 and pede("GET", "/montagem/%s/telao.jpg?t=i" % B, cookie=posto, cru=True)[0] == 200,
       "15: com a versão atual, sem o prefixo ag_ e a impressão")
    s, j, _ = pede("GET", rota_p + "&v=00000000", cookie=posto)
    ok(s == 409 and j == {"error": "versao"}, "15: versão que não é a atual: 409: %s %r" % (s, j))
    antes = sorted(os.listdir(m.MONTAGENS))
    for ruim in ("/montagem/ag_%s/telao.jpg?t=x" % B, "/montagem/ag_%s/telao.jpg" % B, "/montagem/ag_%s/naoexiste.jpg?t=p" % B, "/montagem/ag_%s/TELAO.jpg?t=p" % B,
                 "/montagem/../recortes/%s.png?t=p" % B, "/montagem/ag_%s/..%%2Ftelao.jpg?t=p" % B, "/montagem/ag_zz/telao.jpg?t=p", "/montagem/ag_%s/telao.png?t=p" % B,
                 "/montagem/ag_%s/telao.jpg?t=p&v=../x" % B, "/montagem/ag_%s/a/telao.jpg?t=p" % B, "/montagem/ag_%s/telao.jpg?t=p" % ("a" * 12),
                 "/montagem/ag_%s/noite.jpg?t=p" % B, "/montagem/ag_%s/telao.jpg?t=f" % B, "/montagem/ag_%s/telao.jpg?t=p" % SP):
        s, j, _ = pede("GET", ruim, cookie=posto)
        ok(s == 404 and j == {"error": "not found"}, "15: %s deveria dar o mesmo 404: %s %r" % (ruim, s, j))
    ok(sorted(os.listdir(m.MONTAGENS)) == antes, "15: pedido recusado não toca o disco")
    for ruim, cod in (({"pids": ["ag_" + B] * 5, "fundos": ["telao"]}, 400), ({"pids": ["ag_" + B], "fundos": ["naoexiste"]}, 400), ({"pids": ["../x"], "fundos": ["telao"]}, 400),
                      ({"pids": ["ag_" + B], "fundos": ["telao"], "tipos": ["i"]}, 400), ({"pids": ["ag_" + B], "fundos": ["telao"], "tipos": ["p"], "x": 1}, 400),
                      ({"pids": [], "fundos": ["telao"]}, 400), ({"pids": "ag_" + B, "fundos": ["telao"]}, 400), ({"pids": ["ag_" + B], "fundos": ["telao"] * 6}, 400),
                      ({"pids": ["ag_" + "a" * 12], "fundos": ["telao"]}, 404), ({"pids": ["ag_" + B, "ag_" + "a" * 12], "fundos": ["telao"]}, 404)):
        s, j, _ = pede("POST", "/montagens/pedir", ruim, cookie=posto)
        ok(s == cod, "15: pedir %r deveria dar %s: %s %r" % (ruim, cod, s, j))
    ok(pede("POST", "/montagens/pedir", {"pids": ["ag_" + B], "fundos": ["telao"], "x": "y" * 3000}, cookie=posto)[0] == 413, "15: corpo acima de 2 KB")
    s, j, hs = pede("POST", "/montagens/pedir", {"pids": ["ag_" + A, "ag_" + B, "ag_" + SP], "fundos": ["mirantedia", "arq1950", "telao"], "tipos": ["p", "i"]}, cookie=posto)
    it = {(x["pid"], x["fundo"]): x for x in (j or {}).get("itens", [])}
    ok(s == 200 and j.get("ok") and j.get("v") == 1 and len(it) == 9 and hs.get("cache-control") == "no-store", "15: pedir responde os 9 itens: %s %r" % (s, j))
    if len(it) == 9:
        x = it[("ag_" + B, "telao")]
        ok(x == {"pid": "ag_" + B, "fundo": "telao", "versao": V["telao"], "estado": "pronta", "p": True, "i": True, "w": 2576, "h": 1839}, "15: item pronto: %r" % x)
        x = it[("ag_" + A, "telao")]
        ok(x["estado"] == "fila" and x["p"] is True and x["i"] is False, "15: a impressão que faltava vai para a fila: %r" % x)
        ok(all(it[("ag_" + SP, f)]["estado"] == "sem_pessoa" for f in ("mirantedia", "arq1950", "telao")), "15: foto sem pessoa: %r" % it[("ag_" + SP, "telao")])
    ok(espera(lambda: os.path.isfile(arq(A, "telao", "i")) and os.path.isfile(arq(B, "arq1950", "i")) and fila_vazia()), "15: o pedido é montado (impressão da outra base)")
    # E2 (regra 19): foto de uma leva de hoje que não é base não vira montagem nova (404 igual, pedir diz nao_base)
    NB = SB[0]
    s, j, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % NB, cookie=posto)
    s2, j2, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + NB], "fundos": ["mirantedia"], "tipos": ["p"]}, cookie=posto)
    ok(s == 404 and j == {"error": "not found"} and s2 == 200 and j2["itens"][0]["estado"] == "nao_base" and fila_vazia() and not arqs(NB),
       "E2: foto que não é base não é montada: %s %r %s %r" % (s, j, s2, j2))
    # foto fora das levas carregadas sem venda paga: não é montada (nao_base); com a montagem vendida naquele fundo, sim
    Y = nova_foto()
    vendida(Y, ["telao"])
    s, j, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % Y, cookie=posto)
    s2, j2, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + Y], "fundos": ["mirantedia"], "tipos": ["p"]}, cookie=posto)
    ok(s == 404 and s2 == 200 and j2["itens"][0]["estado"] == "nao_base" and fila_vazia(), "8: foto fora das levas sem a montagem vendida naquele fundo: nao_base: %s %r" % (s, j2))
    # 422: a montagem desta versão acabou de falhar no motor: estado final, sem fila
    (Q,) = nova_sessao("LP-MTG-Q", n_bases=1, extras=0)
    m.mtg_ruins[(Q, "telao")] = (m.mtg_versao("telao"), "interno", time.time())
    s, j, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % Q, cookie=posto)
    ok(s == 422 and j == {"estado": "erro"} and fila_vazia(), "2 (revisão): GET com erro recente da versão atual: 422 e nada na fila: %s %r" % (s, j))
    # com trabalho já na fila para a foto e o fundo, o GET responde 202 (a mesma janela de erro do pedir), e depois da janela tenta de novo
    with m.mtg_lock:
        m.mtg_jobs[(Q, "telao")] = {"pid": Q, "fundo": "telao", "tipos": {"p"}, "prio": 0, "p0": False, "pego": True, "ev": threading.Event(), "u": None, "pref": False, "grupo": (), "err": None}
    s, j, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % Q, cookie=posto)
    with m.mtg_lock:
        m.mtg_jobs.pop((Q, "telao"), None)
    ok(s == 202, "6 (revisão): erro recente mas já na fila: 202: %s %r" % (s, j))
    m.mtg_ruins[(Q, "telao")] = (m.mtg_versao("telao"), "interno", time.time() - m.MTG_ERRO_RECENTE - 1)
    s, j, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=i" % Q, cookie=posto)
    ok(s == 202, "6 (revisão): passada a janela de %d s o erro passageiro não segura a impressão: %s %r" % (m.MTG_ERRO_RECENTE, s, j))
    espera(fila_vazia, 60)
    # a leitura das vendas pagas não espera o ev_lock (o registro de vendas não trava)
    m._mtg_pagas["chave"] = None
    res = {}
    with m.ev_lock:
        th2 = threading.Thread(target=lambda: res.update(v=m.mtg_pagas()), daemon=True)
        th2.start()
        th2.join(5)
    ok(not th2.is_alive() and (X0 := res.get("v")) is not None and any(p == Y for p, f in X0), "7 (revisão): mtg_pagas lê com o ev_lock ocupado: %r" % (res,))
    # venda cancelada não vale para a reimpressão; durante uma leitura, quem chega usa o último valor; sem valor e sem ler: 503
    Z = nova_foto()
    vendida(Z, ["telao"])
    ok(m.mtg_base_ok(Z, "telao") is True, "6 (segurança): venda paga vale")
    vz = "vmtg%04d" % vendida.__defaults__[0][0]
    m.ev_receber({"posto": "Caixa 1", "eventos": [{"tipo": "cancelar", "idem": vz + ":3", "venda": vz, "seq": 3,
                                                    "em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "dados": {"motivo": "teste"}}]})
    ok(m.mtg_base_ok(Z, "telao") is False, "6 (segurança): venda cancelada não vale para a reimpressão")
    with m._mtg_pagas_lock:
        antes_v = m.mtg_pagas()
        m._mtg_pagas.update(chave=None, v=frozenset())
        ok(m.mtg_base_ok(Z, "telao") is None, "1 (segurança): sem valor lido e com a leitura ocupada: None (as rotas respondem 503)")
        s, j, _ = pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % Y, cookie=posto)
        ok(s == 503 and j == {"error": "vendas_indisponivel"}, "6 (segurança): sem ler as vendas o GET responde 503 (o item não sai da venda): %s %r" % (s, j))
        m._mtg_pagas.update(chave=("velha",), v=antes_v)
        ok(m.mtg_pagas() == antes_v, "1 (segurança): com a leitura ocupada vale o último valor lido")
    m._mtg_pagas.update(chave=None)
    m.mtg_ruins.pop((Q, "telao"), None)
    with m.sess_lock:                                  # a leva de teste sai (as voltas seguintes não a montam)
        m.sess.pop("LP-MTG-Q", None)
        m.sess_pid.pop(Q, None)
    with m.lock:
        m.lib.pop(Q, None)
    # LGPD: mtg_apagar com o laço anotando ao mesmo tempo não para no meio
    para = threading.Event()

    def anota():
        i = 0
        while not para.is_set():
            m.mtg_completas.add(("ffff%08x" % i, "telao", "x", True))
            i += 1
            if i % 5000 == 0:
                m.mtg_completas.clear()
    th = threading.Thread(target=anota, daemon=True)
    th.start()
    erros_lgpd = []
    for _ in range(200):
        try:
            m.mtg_apagar(Q)
        except Exception as ex:
            erros_lgpd.append(type(ex).__name__)
    para.set()
    th.join(5)
    m.mtg_completas.clear()
    lim = {}
    for i in range(30000):
        lim[i] = 1
    m._mtg_limita(lim, 100)
    m.mtg_sem_pessoa[Q] = time.time()
    m.mtg_ruins[(Q, "arq1950")] = ("x", "interno", time.time())
    m.mtg_apagar(Q)
    ok(Q not in m.mtg_sem_pessoa and (Q, "arq1950") not in m.mtg_ruins, "7 (segurança): mtg_apagar limpa a foto do sem_pessoa e do mtg_ruins")
    ok(not erros_lgpd and len(lim) == 100, "4 (revisão): mtg_apagar e _mtg_limita sem erro com outra linha mexendo: %r %d" % (erros_lgpd[:3], len(lim)))
    # foto fora das levas carregadas com a montagem vendida (reimpressão de venda antiga): 202, sobe para a prioridade 0 e aparece
    X = nova_foto()
    vendida(X, ["mirantedia"])
    s, j, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % X, cookie=posto)
    ok(s == 202 and j == {"estado": "fila"}, "15: montagem ainda não feita: 202: %s %r" % (s, j))
    ok(espera(lambda: pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % X, cookie=posto, cru=True)[0] == 200, 60, 0.2), "15: depois do 202 a montagem aparece")
    # um link no lugar do arquivo não é seguido para fora da pasta
    fora = os.path.join(m.HOME, "fora.jpg")
    shutil.copyfile(arq(X, "mirantedia", "p"), fora)
    os.remove(arq(X, "mirantedia", "p"))
    os.symlink(fora, arq(X, "mirantedia", "p"))
    ok(pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % X, cookie=posto)[0] == 404, "15: link para fora da pasta das montagens não é servido")
    os.remove(arq(X, "mirantedia", "p"))
    # limite por IP: 240 por minuto em cada rota
    with m.gal_lock:
        m._janelas.clear()
    cods = [pede("POST", "/montagens/pedir", corpo, cookie=posto)[0] for _ in range(241)]
    ok(cods[:240] == [200] * 240 and cods[240] == 429, "15: 240 pedidos por minuto e o seguinte 429: %r" % (sorted(set(cods)), ))
    with m.gal_lock:
        m._janelas.clear()

    # ---- critério 20: reinício não refaz o que existe na versão atual; processo órfão é encerrado
    with m.mtg_lock:
        f0 = m.mtg["feitas"]
    m.mtg_completas.clear()
    m.mtg_refeitas.clear()
    marca = {x: os.stat(x).st_mtime_ns for x in tem}
    n = m.mtg_passada(refazer=True)
    espera(fila_vazia)
    ok(n == 0 and m.mtg["feitas"] == f0 and all(os.stat(x).st_mtime_ns == marca[x] for x in tem), "20: reinício com sombra não refaz nada: %s enfileiradas" % n)
    orf = subprocess.Popen([sys.executable, "-I", m.MTG_FILHO, "--recortes", m.RECORTES, "--fundos", m.APP_CACHE_DIR, "--montagens", m.MONTAGENS],
                           stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    outro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    orf.stdout.readline()
    m._grava_privado(m.MTG_PIDS, json.dumps([{"pid": orf.pid, "agente": 1, "criado": None}, {"pid": outro.pid, "agente": 1, "criado": None}]))
    ok(m.mtg_orfaos_encerrar() == 1, "20: um processo órfão de montagem encerrado")
    try:
        orf.wait(timeout=10)
    except Exception:
        pass
    ok(orf.poll() is not None and outro.poll() is None and not os.path.exists(m.MTG_PIDS), "20: só o processo de montagem é encerrado")
    outro.kill()
    orf.stdin.close()
    orf.stdout.close()
    m._mtg_pids_gravar()
    try:
        pj = json.load(open(m.MTG_PIDS))
    except (OSError, ValueError):
        pj = None
    ok(isinstance(pj, list) and len(pj) == 1 and pj[0]["pid"] == m.mtg_filho["p"].pid, "20: o processo aberto fica anotado em ponto/montagem-filhos.json: %r" % pj)

    # ---- a partir daqui o processo é o dos testes (o motor de verdade com uma trava antes de montar)
    TRAVA = os.path.join(m.HOME, "trava-montagem")
    os.environ["MONTAGEM_FALSO_TRAVA"] = TRAVA
    m.REC_ENV_PREFIXOS = ("MONTAGEM_FALSO_",)
    m.mtg_fechar_filho()
    m.MTG_FILHO = os.path.join(AQUI, "_montagem_filho_falso.py")
    ok(m.mtg_versao("telao") == V["telao"], "a versão vem do motor de verdade, mesmo com o processo dos testes")

    def pego(pid, fundo):
        with m.mtg_lock:
            j = m.mtg_jobs.get((pid, fundo))
            return bool(j and j["pego"])

    # ---- critério 14: com 30 trabalhos de prioridade 3 e 4 na fila, o pedido do Checkout passa na frente
    lote = [nova_foto() for _ in range(11)]
    open(TRAVA, "w").close()
    j0, _ = m.mtg_enfileirar(lote[0], "mirantedia", ("p",), m.MTG_P_IMPRESSAO)
    ok(espera(lambda: pego(lote[0], "mirantedia"), 60), "14: o primeiro trabalho fica preso na trava")
    k = 0
    for pid in lote[1:]:
        for f in m.MTG_ATIVOS[:3]:
            m.mtg_enfileirar(pid, f, ("p",), m.MTG_P_IMPRESSAO if k % 2 else m.MTG_P_REFAZER)
            k += 1
    PED = nova_foto()
    vendida(PED, ["telao"])
    ok(m.mtg_status()["fila"] == 30, "14: 30 trabalhos esperando: %s" % m.mtg_status()["fila"])
    s, j, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + PED], "fundos": ["telao"], "tipos": ["p"]}, cookie=posto)
    ok(s == 200 and j["itens"][0]["estado"] == "fila", "14: pedido aceito: %s %r" % (s, j))
    os.remove(TRAVA)
    ok(espera(lambda: os.path.isfile(arq(PED, "telao", "p")), 90, 0.01), "14: o pedido do Checkout fica pronto")
    outros = sum(len(arqs(p)) for p in lote[1:])
    ok(outros == 0, "14: o pedido passou na frente dos 30 que ainda não tinham sido pegos (prontos antes dele: %s)" % outros)
    # pedido repetido só sobe a prioridade (um trabalho por base e fundo)
    with m.mtg_lock:
        ult = max((x for x in m.mtg_jobs.values() if not x["pego"]), key=lambda x: x["prio"], default=None)
    if ult is not None:
        ja, _ = m.mtg_enfileirar(ult["pid"], ult["fundo"], ("p", "i"), m.MTG_P_PEDIDO)
        ok(ja is ult and ult["prio"] == 0 and ult["tipos"] == {"p", "i"}, "14: pedido repetido reaproveita o trabalho, sobe a prioridade e soma os tipos")
    ok(espera(fila_vazia, 150), "14: a fila esvazia")

    # ---- critério 13: versão. Regra, arquivo do fundo ou REC_VERSAO mudam os 8 hex; o antigo deixa de ser servido
    motor = m.mtg_motor()
    v_rec = m.REC_VERSAO
    m.REC_VERSAO = "outra-versao"
    ok(all(m.mtg_versao(f) != V[f] for f in V), "13: REC_VERSAO muda a versão de todos os fundos")
    m.REC_VERSAO = v_rec
    ok({f: m.mtg_versao(f) for f in V} == V, "13: a versão é estável")
    cache_mir = m.app_disco(m.MTG_FUNDOS["mirantedia"]["previa"])
    orig = open(cache_mir, "rb").read()
    open(cache_mir, "ab").write(b"\x00")
    ok(m.mtg_versao("mirantedia") != V["mirantedia"] and m.mtg_versao("telao") == V["telao"], "13: o arquivo do fundo muda só a versão dele")
    open(cache_mir, "wb").write(orig)
    ok(m.mtg_versao("mirantedia") == V["mirantedia"], "13: arquivo de volta, versão de volta")
    alt = motor.REGRAS["telao"]["meio"]["alt"]
    motor.REGRAS["telao"]["meio"]["alt"] = alt - .01
    V2 = m.mtg_versao("telao")
    ok(V2 != V["telao"] and m.mtg_versao("arq1950") == V["arq1950"], "13: um número de regra muda só a versão daquele fundo: %s x %s" % (V2, V["telao"]))
    velho_p = os.path.join(m.MONTAGENS, B, "telao-%s-p.jpg" % V["telao"])
    ok(os.path.isfile(velho_p), "13: a montagem da versão antiga ainda está no disco")
    s, j, _ = pede("GET", rota_p + "&v=" + V["telao"], cookie=posto)
    ok(s == 409, "13: a versão antiga pedida pelo número: 409: %s" % s)
    open(TRAVA, "w").close()
    s, j, _ = pede("GET", rota_p, cookie=posto)
    ok(s == 202, "13: sem o número, a montagem antiga não é servida (202 até a nova ficar pronta): %s" % s)
    volta()
    with m.mtg_lock:
        p4 = [x["prio"] for (p, f), x in m.mtg_jobs.items() if f == "telao" and p in (A, A0, B0, U1) and not x["pego"]]
        outros_f = [f for (p, f) in m.mtg_jobs if f != "telao"]
    ok(p4 and set(p4) == {m.MTG_P_REFAZER} and not outros_f and (B, "telao", V2) in m.mtg_refeitas, "13: as bases de hoje voltam para a fila com a prioridade 4, só no fundo que mudou: %r %r" % (p4, outros_f))
    volta()
    with m.mtg_lock:
        p4b = [x["prio"] for (p, f), x in m.mtg_jobs.items() if f == "telao" and p in (A, A0, B0, U1) and not x["pego"]]
    ok(set(p4b) <= {m.MTG_P_REFAZER}, "13: a volta seguinte não sobe a prioridade do que é de refazer: %r" % p4b)
    os.remove(TRAVA)
    ok(roda(), "13: as montagens da versão nova ficam prontas")
    ok(os.path.isfile(os.path.join(m.MONTAGENS, B, "telao-%s-p.jpg" % V2)) and os.path.isfile(os.path.join(m.MONTAGENS, B, "telao-%s-i.jpg" % V2)), "13: arquivos da versão nova")
    ok(any("telao:%s" % V2 in x for x in linhas_srv()), "13: a troca de versão aparece no registro")
    n_rec = sorted(os.listdir(m.RECORTES))
    m.limpar_montagens()
    sobras = [x for p in os.listdir(m.MONTAGENS) for x in arqs(p) if x.startswith("telao-" + V["telao"])]
    ok(not sobras and os.path.isfile(os.path.join(m.MONTAGENS, B, "telao-%s-p.jpg" % V2)) and os.path.isfile(arq(B, "mirantedia", "p")), "13: a limpeza apaga os arquivos da versão antiga e só eles: %r" % sobras)
    ok(pede("GET", rota_p + "&v=" + V2, cookie=posto, cru=True)[0] == 200, "13: a versão nova é servida")
    V = {f: m.mtg_versao(f) for f in m.MTG_ATIVOS}

    # ---- critério 17: disco. Abaixo do piso só a prioridade 0 monta; acima do teto os mais antigos saem; recortes intactos
    D1, D2 = nova_foto(), nova_foto()
    piso = m.REC_PISO_GB
    livre = m.mtg_livre_gb()
    m.REC_PISO_GB = livre * 1.5                        # abaixo do piso, acima do piso duro (metade do piso)
    ok(m.mtg_enfileirar(D1, "mirantedia", ("p",), m.MTG_P_VIVO) == (None, "disco") and m.mtg_enfileirar(D1, "mirantedia", ("p",), m.MTG_P_REFAZER)[1] == "disco",
       "17: abaixo do piso o que o servidor monta sozinho espera")
    ok(m.mtg_status()["pausa_disco"] is True and any("em pausa" in x for x in linhas_srv()), "17: pausa_disco no status e no registro")
    jd, e = m.mtg_enfileirar(D2, "mirantedia", ("p",), m.MTG_P_PEDIDO)
    ok(jd is not None and e is None and espera(lambda: os.path.isfile(arq(D2, "mirantedia", "p")), 60), "17: o pedido do Checkout monta mesmo abaixo do piso")
    ok(not arqs(D1), "17: nada do que esperava foi montado")
    # abaixo do piso duro nem o pedido do Checkout grava: 503 disco
    D3 = nova_foto()
    vendida(D3, ["mirantedia"])
    m.REC_PISO_GB = livre * 3
    s1, j1, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % D3, cookie=posto)
    s2, j2, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + D3], "fundos": ["mirantedia"], "tipos": ["p"]}, cookie=posto)
    ok(s1 == 503 and j1 == {"error": "disco"} and s2 == 503 and j2 == {"error": "disco"} and m.mtg_enfileirar(D3, "mirantedia", ("p",), m.MTG_P_PEDIDO) == (None, "disco")
       and fila_vazia() and not arqs(D3), "3 (segurança): abaixo do piso duro nada é montado, nem o pedido do Checkout: %s %r %s %r" % (s1, j1, s2, j2))
    m.REC_PISO_GB = piso
    m.mtg_enfileirar(D1, "mirantedia", ("p",), m.MTG_P_VIVO)
    ok(m.mtg_status()["pausa_disco"] is False and espera(lambda: os.path.isfile(arq(D1, "mirantedia", "p")), 60), "17: com disco de novo, volta a montar")
    espera(fila_vazia)
    velho = arq(D2, "mirantedia", "p")
    os.utime(velho, (time.time() - 3600, time.time() - 3600))
    todos = [os.path.join(m.MONTAGENS, p, x) for p in os.listdir(m.MONTAGENS) for x in arqs(p)]
    total = sum(os.path.getsize(x) for x in todos)
    mais_novo = max(todos, key=lambda x: os.stat(x).st_mtime_ns)
    teto = m.MTG_TETO_GB
    m.MTG_TETO_GB = (total - 1) / 1024 ** 3                     # 1 byte acima do teto: sai só o mais antigo
    m.limpar_montagens()
    ok(not os.path.exists(velho) and os.path.exists(mais_novo), "17: acima do teto sai o mais antigo")
    m.MTG_TETO_GB = teto
    ok(all(x in os.listdir(m.RECORTES) for x in n_rec), "17: a limpeza das montagens não toca nos recortes")
    ok(abs(m.mtg_status()["guardado_gb"] - round(sum(os.path.getsize(os.path.join(m.MONTAGENS, p, x)) for p in os.listdir(m.MONTAGENS) for x in arqs(p)) / 1024 ** 3, 2)) <= 0.011,
       "17: guardado_gb confere com o disco")
    # limpeza: arquivo com mais de 2 dias, .tmp com mais de 1 h, pasta de foto que saiu da biblioteca
    antigo = arq(D1, "mirantedia", "p")
    os.utime(antigo, (time.time() - 3 * 86400, time.time() - 3 * 86400))
    tmp_velho, tmp_novo = os.path.join(m.MONTAGENS, A, ".mtg-velho.tmp"), os.path.join(m.MONTAGENS, A, ".mtg-novo.tmp")
    for x in (tmp_velho, tmp_novo):
        open(x, "wb").write(b"x")
    os.utime(tmp_velho, (time.time() - 2 * 3600, time.time() - 2 * 3600))
    os.makedirs(os.path.join(m.MONTAGENS, "vendidas"), exist_ok=True)
    open(os.path.join(m.MONTAGENS, "vendidas", "x.jpg"), "wb").write(b"x")
    os.utime(os.path.join(m.MONTAGENS, "vendidas", "x.jpg"), (1, 1))
    SAIU = nova_foto()
    m.mtg_enfileirar(SAIU, "mirantedia", ("p",), 0)
    ok(espera(lambda: os.path.isfile(arq(SAIU, "mirantedia", "p")), 60), "limpeza: montagem da foto que vai sair")
    with m.lock:
        m.lib.pop(SAIU)
    m.limpar_montagens()
    ok(not os.path.exists(antigo) and not os.path.exists(tmp_velho) and os.path.exists(tmp_novo) and not os.path.exists(os.path.join(m.MONTAGENS, SAIU))
       and os.path.isfile(os.path.join(m.MONTAGENS, "vendidas", "x.jpg")) and not os.path.exists(os.path.join(m.MONTAGENS, D1)),
       "limpeza: mais de 2 dias, .tmp de mais de 1 h e foto fora da biblioteca saem; vendidas/ fica")
    os.remove(tmp_novo)

    # ---- critério 18: LGPD. A pasta some, o trabalho na fila e o em andamento são cancelados, nada reaparece
    L1, L2 = nova_sessao("LP-MTG-L")
    ok(roda(), "18: sessão montada antes da exclusão")
    ok(len(arqs(L1)) >= 4 and len(arqs(L2)) >= 4, "18: as duas bases têm montagens: %r %r" % (arqs(L1), arqs(L2)))
    # um link dentro da pasta não é seguido
    alvo = os.path.join(m.HOME, "alvo-fora")
    os.makedirs(alvo, exist_ok=True)
    open(os.path.join(alvo, "fica.txt"), "w").write("fica")
    os.symlink(alvo, os.path.join(m.MONTAGENS, L1, "link"))
    open(TRAVA, "w").close()
    for x in arqs(L2):
        os.remove(os.path.join(m.MONTAGENS, L2, x))
    m.mtg_completas.clear()
    ja, _ = m.mtg_enfileirar(L2, "mirantedia", ("p",), 0)
    ok(espera(lambda: pego(L2, "mirantedia"), 60), "18: montagem de L2 em andamento (presa na trava)")
    jb, _ = m.mtg_enfileirar(L2, "telao", ("p",), 0)
    jc, _ = m.mtg_enfileirar(L1, "telao", ("p", "i"), 0)
    for pid in (L1, L2):                                          # o que o lgpd_excluir faz com cada foto
        with m.lock:
            m.lib.pop(pid, None)
        m.sess_esquecer(pid)
    ok(not os.path.exists(os.path.join(m.MONTAGENS, L1)) and not os.path.exists(os.path.join(m.MONTAGENS, L2)), "18: apagar a foto apaga a pasta das montagens dela")
    ok(os.path.isfile(os.path.join(alvo, "fica.txt")), "18: a exclusão não segue link para fora")
    os.remove(TRAVA)
    ok(espera(lambda: ja["ev"].is_set() and jb["ev"].is_set() and jc["ev"].is_set(), 60), "18: os trabalhos terminam")
    ok(ja["err"] == "cancelado" and jb["err"] == "cancelado" and jc["err"] == "cancelado", "18: em andamento e na fila: cancelados: %r %r %r" % (ja["err"], jb["err"], jc["err"]))
    roda(20)
    ok(not os.path.exists(os.path.join(m.MONTAGENS, L1)) and not os.path.exists(os.path.join(m.MONTAGENS, L2)), "18: nenhum arquivo da foto apagada reaparece")
    ok(pede("GET", "/montagem/ag_%s/telao.jpg?t=p" % L1, cookie=posto)[0] == 404, "18: a rota da foto apagada responde 404")
    ok(m.mtg_apagar("../recortes") is False and m.mtg_apagar("vendidas") is False and os.path.isdir(m.RECORTES), "18: mtg_apagar só aceita id de foto")
    lk = "ab" * 8
    os.symlink(alvo, os.path.join(m.MONTAGENS, lk))
    ok(m.mtg_apagar(lk) and not os.path.lexists(os.path.join(m.MONTAGENS, lk)) and os.path.isfile(os.path.join(alvo, "fica.txt")), "18: link no lugar da pasta é desfeito, o alvo fica")

    # ---- critério 16: processo morto no meio. O trabalho dá erro, o status avisa, reabre com espera; recorte segue
    K1, K2 = nova_foto(), nova_foto()
    vendida(K1, ["mirantedia"])
    with m.mtg_lock:
        m.mtg.update(mortes_mem=0, morte_chave=None, erro=None, espera_s=m.MTG_ERRO_SEG)
    open(TRAVA, "w").close()
    jk, _ = m.mtg_enfileirar(K1, "mirantedia", ("p",), 0)
    ok(espera(lambda: pego(K1, "mirantedia") and m.mtg_filho["p"] is not None, 60), "16: montagem em andamento")
    time.sleep(0.3)
    reinicios0 = m.mtg_status()["filho"]["reinicios"]
    m.mtg_filho["p"].terminate()                       # SIGTERM: o encerramento do próprio teste não conta como falta de memória
    ok(espera(lambda: jk["ev"].is_set(), 30) and jk["err"] == "processo", "16: o trabalho do processo morto dá erro: %r" % jk.get("err"))
    os.remove(TRAVA)
    ok(m.mtg["mortes_mem"] == 0 and (m.mtg_ruins.get((K1, "mirantedia")) or (0, ""))[1] == "processo" and m.mtg["espera_s"] <= m.MTG_ERRO_FOTO_SEG,
       "2 (segurança): a foto em que o processo parou espera fora da fila e a espera para as outras é curta: %r %r" % (m.mtg_ruins.get((K1, "mirantedia")), m.mtg["espera_s"]))
    st = m.mtg_status()
    ok(st["ok"] is False and st["motivo"] and "parou" in st["motivo"] and st["filho"]["vivo"] is False and st["erros"] >= 1 and st["parado"] is None,
       "16: /status.montagem avisa: %r" % {k: st[k] for k in ("ok", "motivo", "filho", "erros")})
    ok(any("processo parou" in x for x in linhas_srv()), "16: morte do processo no registro")
    ok(m.rec_estado()[1] != st["motivo"] and pede("GET", "/status", cookie=posto)[0] == 200, "16: o resto do agente segue respondendo")
    s, j, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=p" % K1, cookie=posto)
    ok(s == 422 and j == {"estado": "erro"} and not ((K1, "mirantedia") in m.mtg_jobs), "2 (segurança): a foto em que o processo parou não volta à fila pelo Checkout: %s %r" % (s, j))
    jk2, _ = m.mtg_enfileirar(K2, "mirantedia", ("p",), 0)
    ok(espera(lambda: jk2["ev"].is_set(), 60) and jk2["err"] is None and os.path.isfile(arq(K2, "mirantedia", "p")),
       "2 (segurança): a outra foto espera o processo reabrir e é montada (não falha): %r" % jk2.get("err"))
    st = m.mtg_status()
    ok(st["ok"] is True and st["filho"]["vivo"] and st["filho"]["reinicios"] == reinicios0 + 1, "16: reaberto: %r" % st["filho"])
    ok(not [x for p in os.listdir(m.MONTAGENS) if os.path.isdir(os.path.join(m.MONTAGENS, p)) for x in os.listdir(os.path.join(m.MONTAGENS, p)) if x.endswith(".tmp")],
       "16: nenhum .tmp sobrou")
    # morte por memória repetida na mesma foto não conta de novo para a parada; em outra foto, conta
    with m.mtg_lock:
        m.mtg.update(mortes_mem=0, morte_chave=None)
    for ch in (("aa11", "telao"), ("aa11", "telao"), ("aa11", "telao")):
        m._mtg_erro("a montagem parou: memória insuficiente (código -9)", ch)
    n_mesma = m.mtg["mortes_mem"]
    m._mtg_erro("a montagem parou: memória insuficiente (código -9)", ("bb22", "telao"))
    ok(n_mesma == 1 and m.mtg["mortes_mem"] == 2 and not m.mtg["parado"], "2 (segurança): morte repetida na mesma foto conta uma vez: %r %r" % (n_mesma, m.mtg["mortes_mem"]))
    with m.mtg_lock:
        m.mtg.update(parado=None, erro=None, mortes_mem=0, morte_chave=None, espera_s=m.MTG_ERRO_SEG)
    # morte por memória: a espera dobra e, na 3ª seguida, a montagem para até reiniciar o agente
    esperas = []
    for _ in range(3):
        m._mtg_erro("montagem parou: memória insuficiente (código -9)")
        esperas.append(m.mtg["espera_s"])
    st = m.mtg_status()
    ok(esperas == [60, 120, 240] and st["parado"] and st["ok"] is False, "16: espera crescente e parada na 3ª morte por memória: %r %r" % (esperas, st["parado"]))
    s1, j1, _ = pede("GET", "/montagem/ag_%s/mirantedia.jpg?t=i" % K2, cookie=posto)
    s2, j2, _ = pede("POST", "/montagens/pedir", {"pids": ["ag_" + K2], "fundos": ["telao"]}, cookie=posto)
    ok(s1 == 503 and s2 == 503 and j1 == {"error": "montagem_parada"} and j2 == {"error": "montagem_parada"}, "16: parada: rotas 503 montagem_parada: %s %s" % (s1, s2))
    with m.mtg_lock:
        m.mtg.update(parado=None, erro=None, mortes_mem=0, espera_s=m.MTG_ERRO_SEG)

    # ---- 7 (revisão): fundo que a origem não entrega não é baixado a cada volta (espera crescente até 5 min)
    chamadas = []
    baixar0 = m.app_baixar
    m.app_baixar = lambda rel: chamadas.append(rel)
    try:
        for _ in range(3):
            try:
                m.mtg_fundo_arquivo("podio", True)
            except ValueError:
                pass
        esp1 = m._mtg_baixa_falhou.get(m.MTG_FUNDOS["podio"]["hi"])
        m._mtg_baixa_falhou[m.MTG_FUNDOS["podio"]["hi"]] = (0, esp1[1])
        try:
            m.mtg_fundo_arquivo("podio", True)
        except ValueError:
            pass
        esp2 = m._mtg_baixa_falhou.get(m.MTG_FUNDOS["podio"]["hi"])
    finally:
        m.app_baixar = baixar0
    ok(len(chamadas) == 2 and esp1 and esp1[1] == m.MTG_BAIXA_ESPERA and esp2[1] == 2 * m.MTG_BAIXA_ESPERA, "7 (revisão): download do fundo com espera crescente: %r %r %r" % (chamadas, esp1, esp2))

    # ---- de volta a desligada: o processo sai da memória e nada mais é montado
    cfg({"modo": "desligada"})
    volta()
    ok(m.mtg_filho["p"] is None and m.mtg_status()["modo"] == "desligada" and any("modo=desligada" in x for x in linhas_srv()), "desligar fecha o processo de montagem")
    Z1, Z2 = nova_sessao("LP-MTG-Z")
    for _ in range(2):
        volta()
    ok(not arqs(Z1) and not arqs(Z2) and fila_vazia(), "desligada: sessão nova não é montada")
    ok(not any(p in x for x in linhas_srv() for p in ("ba5e", ".png", ".JPG", m.INBOX)), "nenhuma linha montagem-srv com id ou caminho de foto")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-900:])
finally:
    try:
        m.mtg_fechar_filho()
    except Exception:
        pass
sys.stdout = console.real
if os.environ.get("MTG_TESTE_REGISTRO"):
    print("\n".join(linhas_srv()))
print(("OK" if not falhas else "FALHA") + " montagem_servidor_agente: chave, sombra (ordem e arquivos), rotas, versão, prioridade, disco, limpeza, LGPD, processo morto, reinício "
      + json.dumps(notas) + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.exit(1 if falhas else 0)
