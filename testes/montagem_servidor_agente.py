# Montagem no servidor, E1 (plano docs/planos/2026-11-11-montagem-no-servidor.md): fila, banco, arquivos, gatilho,
# recuperação, retenção, LGPD, /status.montagem, config/fundos e config/montagem. Modo sombra: ninguém lê.
# Roda com HOME temporário:  HOME=$(mktemp -d) python3 -I testes/montagem_servidor_agente.py agente/eterna-agente.py
# O agente é carregado neste processo; o processo de montagem é o de verdade (agente/eterna-montagem.py) e, para o filho
# morto no meio, o testes/_montagem_filho_falso.py. Os fundos vêm de um servidor local com a raiz do repositório (portas
# 48200 a 48699). Só figuras geradas aqui (nunca foto de cliente).
import hashlib, http.client, http.server, importlib.util, io, json, os, re, shutil, socket, stat, sys, tempfile, threading, time
import numpy as np
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, "agente", "eterna-agente.py"))
falhas, notas = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def porta_livre():
    for p in range(48200 + os.getpid() % 400, 48700):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            pass
        finally:
            s.close()
    raise SystemExit("sem porta livre entre 48200 e 48699")


class Quieto(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def log_message(self, *a):
        pass


PORTA = porta_livre()
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), Quieto)
threading.Thread(target=srv.serve_forever, daemon=True).start()
os.environ["ETERNA_APP_ORIGIN"] = "http://127.0.0.1:%d" % PORTA
PORTA_AG = porta_livre()
os.environ["ETERNA_PORTA"] = str(PORTA_AG)
REDE = "192.168.50.9:%d" % PORTA_AG                 # o Posto em outro computador abre o Eterna por este endereço
os.environ["ETERNA_ORIGENS"] = "http://" + REDE
os.environ.pop("ETERNA_REDE", None)
for k in ("ETERNA_MONTAGEM", "ETERNA_MONTAGEM_CONC", "ETERNA_SEM_OPENCV", "ETERNA_MONTAGENS_GB", "ETERNA_MONTAGENS_PISO_GB", "ETERNA_PASTA"):
    os.environ.pop(k, None)


class Tee(io.TextIOBase):
    def __init__(self, real):
        self.real, self.linhas = real, []

    def write(self, s):
        self.linhas.append(s)
        return self.real.write(s)

    def flush(self):
        self.real.flush()


console = Tee(sys.stdout)
sys.stdout = console
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
ok(m.HOME.startswith(tempfile.gettempdir()) or "/tmp" in m.HOME, "o teste precisa de HOME temporário: %s" % m.HOME)
if falhas:
    print("FALHA montagem_servidor_agente: " + falhas[0])
    sys.exit(1)
HOJE = m._ff_hoje()
os.makedirs(m.INBOX, exist_ok=True)
os.makedirs(m.RECORTES, exist_ok=True)
_n = [0]


def recorte_png(i):
    """Uma figura de meio corpo (encosta embaixo) em 1200x800, RGB zerado fora."""
    im = Image.new("RGBA", (1200, 800), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = 450 + 60 * (i % 5)
    d.ellipse([cx - 90, 120, cx + 90, 340], fill=(226, 190, 160, 255))
    d.rounded_rectangle([cx - 230, 330, cx + 230, 900], radius=70, fill=(30 + 40 * (i % 5), 70, 140, 255))
    return im


def nova_base(com_recorte=True):
    _n[0] += 1
    pid = "ba5e%08x" % _n[0]
    f = os.path.join(m.INBOX, pid + "_F%04d.JPG" % _n[0])
    Image.new("RGB", (320, 240), (40, 90, 30 + _n[0] % 200)).save(f, "JPEG")
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
    if com_recorte:
        recorte_png(_n[0]).save(m.rec_arquivo(pid), "PNG")
    return pid


def nova_leva(card, n_bases=2, com_recorte=True, ia=True):
    bases = [nova_base(com_recorte) for _ in range(n_bases)]
    fotos = bases + [nova_base(False) for _ in range(3)]
    with m.sess_lock:
        m.sess[card] = {"card": card, "dia": HOJE, "status": "fechada", "fotos": list(fotos), "pend": [], "removida": False,
                        "ia": list(bases) if ia else [], "ia_regra": {"n": n_bases, "motivo": None if ia else "visita_ja_tem"}, "_t": {}}
        for p in fotos:
            m.sess_pid[p] = card
    return bases


def linhas(onde="", args=()):
    return m.mont_ler(onde, args)


def de_base(pid, so_atual=True):
    rs = linhas("where base = ?", (pid,))
    return [r for r in rs if not so_atual or r["versao"] == m.mont_versao(r["fundo"])]


def espera(fn, seg=90, passo=0.1):
    t0 = time.time()
    while time.time() - t0 < seg:
        if fn():
            return True
        time.sleep(passo)
    return False


def prontas(pids, n_fundos):
    return lambda: all(len([r for r in de_base(p) if r["estado"] == "pronta"]) == n_fundos for p in pids)


def cfg(doc, valor):
    return m.estado_gravar({"docs": [{"col": "config", "id": doc, "valor": valor}]}, quem="teste")


def arquivos_no_disco():
    out = []
    for raiz, _, nomes in os.walk(m.MONTAGENS):
        out += [os.path.join(raiz, n) for n in nomes]
    return out


m.MONT_LOOP_SEG = 3600          # a recuperação é chamada à mão (m.mont_recuperar) para o teste ser previsível
m.MONT_ERRO_SEG = 0.3
m.MONT_MEM_MIN_GB = 0.2        # máquina de teste dividida com outras sessões
m.mont_livre_gb = lambda: 100.0   # a máquina de teste pode ter menos que o piso de 15 GB (o critério 15 troca de novo)
ATIVOS = list(m.MONT_FUNDOS_PADRAO)

# ---------- 22: desligada por padrão: nenhum trabalho, nenhum arquivo ----------
st = m.mont_status()
ok(st["v"] == 1 and st["ligada"] is False and st["checkout"] is False and st["fundos"] == ATIVOS, "22: sem config/montagem a montagem nasce desligada: %r" % st)
b0 = nova_leva("LPMONT000")
m.mont_partida()
ok(m.mont_base_pronta(b0[0], 1) == 0 and m.mont_recuperar() == 0, "22: desligada, o gatilho e a recuperação não pedem nada")
time.sleep(0.5)
ok(not linhas() and not arquivos_no_disco(), "22: desligada, nenhuma linha e nenhum arquivo")
# config/montagem: só o formato conhecido; apagar recusado
ok(cfg("montagem", {"ligada": "sim"})["gravados"] == 0 and cfg("montagem", None)["gravados"] == 0, "22: config/montagem inválida ou apagada é recusada")
ok(cfg("montagem", {"ligada": True, "por": "admin@teste"})["gravados"] == 1, "config/montagem ligada gravada")
st = m.mont_status()
ok(st["ligada"] is True and st["checkout"] is False, "config/montagem ligada: /status.montagem.ligada, com o Checkout ainda fora (D5): %r" % st)

# ---------- 10 e 11: leva com 2 bases: 10 montagens, preferidas antes das reservas, 2 arquivos por linha ----------
t0 = time.time()
ok(m.mont_recuperar() == 10, "a recuperação pega a leva que já tinha os recortes (10 pedidos)")
ok(espera(prontas(b0, 5), 120), "10: 10 linhas prontas (2 bases x 5 fundos): %r" % [(r["fundo"], r["estado"], r["motivo"]) for p in b0 for r in de_base(p)])
notas["s_10_montagens_recuperacao"] = round(time.time() - t0, 1)
# o gatilho de verdade: o recorte (falso dos testes: copia a foto) termina e chama mont_base_pronta
m.REC_FALSO_SEG = 0
bases = []
_n[0] += 100
for i in range(2):
    _n[0] += 1
    pid = "ba5e%08x" % _n[0]
    f = os.path.join(m.INBOX, pid + "_G%04d.PNG" % _n[0])
    recorte_png(i).save(f, "PNG")
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
    bases.append(pid)
with m.sess_lock:
    m.sess["LPMONT001"] = {"card": "LPMONT001", "dia": HOJE, "status": "fechada", "fotos": list(bases), "pend": [], "removida": False,
                           "ia": list(bases), "ia_regra": {"n": 2, "motivo": None}, "_t": {}}
    for p in bases:
        m.sess_pid[p] = "LPMONT001"
t0 = time.time()
for p in bases:
    job, erro = m.rec_enfileirar(p, m.lib[p]["file"], 2400, m.REC_PRIO_IA, ia=True, u=time.time())
    ok(job is not None, "recorte da base enfileirado: %r" % erro)
ok(espera(prontas(bases, 5), 120), "10: o fim do recorte dispara as 10 montagens: %r" % [(r["fundo"], r["estado"], r["motivo"]) for p in bases for r in de_base(p)])
notas["s_10_montagens_gatilho"] = round(time.time() - t0, 1)
m.REC_FALSO_SEG = None
rs = [r for p in bases for r in de_base(p)]
base_de = m.mont_regras()["base"]
pref = [r for r in rs if base_de.get(r["fundo"], 1) == bases.index(r["base"])]
res = [r for r in rs if r not in pref]
ok(len(pref) == 5 and len(res) == 5 and sorted(r["fundo"] for r in pref) == sorted(ATIVOS), "10: 5 preferidas (uma por fundo) e 5 de reserva: %r" % [(r["fundo"], bases.index(r["base"])) for r in pref])
ok(pref and res and max(r["pronta"] for r in pref) <= min(r["pronta"] for r in res), "10: as 5 preferidas ficam prontas antes das reservas")
ok(all(r["prio"] == 1 for r in pref) and all(r["prio"] == 3 for r in res), "10: prioridade 1 nas preferidas ao vivo e 3 nas reservas")
ok(all(r["origem"] == "auto" and r["dia"] == HOJE and r["sha"] and r["bytes"] > 10000 and r["ms"] is not None for r in rs), "10: linha com dia, sha, bytes e ms")
for r in rs:
    final, previa, imp = m.mont_arquivos(r["dia"], r["mid"])
    for f in (final, previa):
        ok(os.path.isfile(f) and stat.S_IMODE(os.stat(f).st_mode) == 0o600, "10: arquivo 600: %s" % oct(stat.S_IMODE(os.stat(f).st_mode)) if os.path.exists(f) else "10: falta arquivo")
    ok(not os.path.exists(imp), "o corte de impressão só nasce no primeiro pedido de impressão (E3)")
    with Image.open(final) as im:
        tam = im.size
        ok(im.format == "JPEG" and not im.getexif(), "10: final em JPEG sem EXIF")
    ok(tam == (r["w"], r["h"]) and (tam == (2576, 1840) if r["fundo"] == "telao" else tam[0] == 5000), "D3/D4: final no tamanho do fundo de impressão (5000 px; Telão 2576x1840): %s %r" % (r["fundo"], tam))
    with Image.open(previa) as im:
        ok(max(im.size) == 1600, "prévia com 1600 px no maior lado: %r" % (im.size,))
    ok(hashlib.sha256(open(final, "rb").read()).hexdigest() == r["sha"], "sha da linha = SHA-256 do final")
ok(stat.S_IMODE(os.stat(os.path.join(m.MONTAGENS, HOJE)).st_mode) == 0o700, "10: pasta do dia 700")
nomes = [os.path.basename(f) for f in arquivos_no_disco()]
ok(len(nomes) == 40 and all(re.match(r"^[0-9a-f]{32}(_p)?\.jpg$", n) for n in nomes), "10/11: 2 arquivos por linha, nome só com o mid, sem .tmp: %d · %r" % (len(nomes), [n for n in nomes if not re.match(r"^[0-9a-f]{32}(_p)?\.jpg$", n)][:3]))
todos_pids = set(m.lib)
ok(not any(p in n for n in nomes for p in todos_pids) and not any(x in " ".join(nomes) for x in ATIVOS + ["LPMONT"]), "11: nenhum pid, fundo ou código LP em nome de arquivo")
txt = "".join(console.linhas)
mids = [r["mid"] for r in linhas()]
ok(not any(x in txt for x in mids) and not any(p in txt for p in bases + b0) and "LPMONT" not in txt, "11: nenhum pid, mid ou código LP no console")
# 21: sem o YuNet em ~/Eterna/modelos, o corte passa pelo grupo sem rostos e a linha grava rostos nulo
ok(all(r["rostos"] is None for r in rs), "21: sem o YuNet, rostos nulo: %r" % [(r["fundo"], r["rostos"]) for r in rs if r["rostos"] is not None])

# ---------- 12: idempotência: repetir o gatilho, reiniciar e pedir de novo ----------
antes = {(r["base"], r["fundo"]): r["mid"] for r in linhas()}
for p in bases + b0:
    m.mont_base_pronta(p, 1)
m.mont_recuperar()
r1, mot = m.mont_enfileirar(bases[0], "tunel", 0, "pedido")
ok(r1 and r1["estado"] == "pronta" and r1["mid"] == antes[(bases[0], "tunel")] and mot is None, "12: pedir de novo devolve a mesma linha pronta e o mesmo mid")
with m.mont_lock:                                   # "reinício no meio": uma linha fica 'fazendo'
    db = m.mont_db(); db.execute("update montagem set estado = 'fazendo' where mid = ?", (antes[(bases[1], "mirante")],)); db.commit(); db.close()
ok(m.mont_reabrir() == 1, "12: na partida a linha 'fazendo' volta para a fila")
m.mont_ev.set()
ok(espera(prontas(bases, 5), 60), "12: a linha reaberta é refeita")
depois = {(r["base"], r["fundo"]): r["mid"] for r in linhas()}
ok(depois == antes and len(arquivos_no_disco()) == 40, "12: nenhuma linha nem arquivo duplicado e os mids são os mesmos (%d linhas, %d arquivos)" % (len(depois), len(arquivos_no_disco())))

# ---------- 13: o agente não espera a montagem (o /status não toca a fila do filho) ----------
novas = nova_leva("LPMONT002")
m.mont_recuperar()
ts = []
while not prontas(novas, 5)() and len(ts) < 400:
    t = time.time(); m.mont_status(); m.rec_status(); ts.append(time.time() - t); time.sleep(0.05)
ok(espera(prontas(novas, 5), 90), "13: a leva seguinte fica pronta")
notas["status_ms_max_com_fila"] = round(max(ts) * 1000, 1) if ts else None
ok(not ts or max(ts) < 1.0, "13: /status.montagem e /status.recorte respondem com a fila de montagem cheia (máx %.0f ms)" % (max(ts) * 1000 if ts else 0))
st = m.mont_status()
ok(st["fila"] == 0 and st["feitas_hoje"] == 30 and st["erros_hoje"] == 0 and st["ms_medio"] and st["filho"]["vivo"] and st["guardado_gb"] > 0 and st["fundos_faltando"] == [] and st["pico_mb"],
   "/status.montagem com fila, feitas, média, filho, guardado e fundos: %r" % st)
notas["ms_medio"], notas["pico_mb"] = st["ms_medio"], st["pico_mb"]
notas["mb_por_montagem"] = round(sum(r["bytes"] for r in linhas()) / len(linhas()) / 1e6, 2)

# ---------- E2 (critérios 28, 33 e 34): as rotas /montagens ----------
ag_srv = m.ThreadingHTTPServer(("127.0.0.1", PORTA_AG), m.H)
threading.Thread(target=ag_srv.serve_forever, daemon=True).start()


def pede(metodo, caminho, corpo=None, host=None, origin=None, x=True, cru=None):
    h = {"Host": host or "127.0.0.1:%d" % PORTA_AG}
    if origin:
        h["Origin"] = origin
    if x and metodo == "POST":
        h["X-Eterna"] = "1"
    data = cru if cru is not None else (json.dumps(corpo).encode() if corpo is not None else None)
    if data is not None:
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", PORTA_AG, timeout=30)
    try:
        c.request(metodo, caminho, body=data, headers=h)
        r = c.getresponse()
        b = r.read()
        try:
            j = json.loads(b)
        except Exception:
            j = None
        return r.status, j, b, {k.lower(): v for k, v in r.getheaders()}
    finally:
        c.close()


respostas = []


def H(*a, **k):
    r = pede(*a, **k)
    if a[1].startswith("/montagens"):
        respostas.append(r)
    return r


st_, j_, _, hd = H("POST", "/montagens/lista", {"bases": bases})
ok(st_ == 200 and j_["versao"] == 1 and len(j_["itens"]) == 10 and all(i["estado"] == "pronta" and re.match(r"^[0-9a-f]{32}$", i["mid"] or "") and i["w"] and i["h"] for i in j_["itens"]),
   "E2: lista devolve as 10 montagens prontas da visita com o mid: %r %r" % (st_, j_))
ok(set(j_["itens"][0]) == {"base", "fundo", "mid", "estado", "motivo", "w", "h"} and "no-store" in (hd.get("cache-control") or ""), "E2: item só com os campos do contrato, sem cache")
it = {(i["base"], i["fundo"]): i for i in j_["itens"]}
mid1 = it[(bases[1], "tunel")]["mid"]
ok(mid1 == [r for r in de_base(bases[1]) if r["fundo"] == "tunel"][0]["mid"], "E2: o mid da lista é o da linha")
st_, _, corpo_, hd = H("GET", "/montagens/%s/previa.jpg" % mid1)
ok(st_ == 200 and hd.get("content-type") == "image/jpeg" and corpo_[:2] == b"\xff\xd8" and hd.get("x-content-type-options") == "nosniff" and hd.get("cache-control") == "private, max-age=3600",
   "E2: prévia em JPEG, private, nosniff: %r %r" % (st_, hd))
ok(corpo_ == open(m.mont_arquivos(HOJE, mid1)[1], "rb").read(), "E2: a prévia servida é o arquivo guardado")
st_, j_, _, _ = H("POST", "/montagens/lista", {"bases": ["ag_" + bases[0]], "fundos": ["tunel", "telao"]})
ok(st_ == 200 and [(i["base"], i["fundo"]) for i in j_["itens"]] == [(bases[0], "tunel"), (bases[0], "telao")], "E2: aceita o id com ag_ e a lista de fundos pedida")
# 34: o Posto em outro computador (Host e Origin de ETERNA_ORIGENS)
st_, j_, _, hd = H("POST", "/montagens/lista", {"bases": bases[:1]}, host=REDE, origin="http://" + REDE)
ok(st_ == 200 and len(j_["itens"]) == 5 and hd.get("access-control-allow-origin") == "http://" + REDE, "34: lista pelo endereço de ETERNA_ORIGENS: %r" % st_)
ok(H("GET", "/montagens/%s/previa.jpg" % mid1, host=REDE)[0] == 200, "34: prévia pelo endereço de ETERNA_ORIGENS")
# 33: origem, Host, X-Eterna
ok(H("POST", "/montagens/lista", {"bases": bases}, x=False)[0] == 403, "33: POST sem X-Eterna = 403")
ok(H("POST", "/montagens/lista", {"bases": bases}, origin="https://exemplo.invalid")[0] == 403, "33: outra origem = 403")
ok(H("POST", "/montagens/lista", {"bases": bases}, host="evil.invalid:%d" % PORTA_AG)[0] == 403, "33: Host fora da lista = 403")
ok(H("GET", "/montagens/%s/previa.jpg" % mid1, host="evil.invalid")[0] == 403 and H("GET", "/montagens/%s/previa.jpg" % mid1, origin="https://exemplo.invalid")[0] == 403, "33: prévia com Host ou origem de fora = 403")
# 33: caminhos
for cam in ("/montagens", "/montagens/", "/montagens/lista", "/montagens/%s" % mid1, "/montagens/%s/final.jpg" % mid1, "/montagens/%s/previa.jpg/x" % mid1,
            "/montagens/%s/previa.png" % mid1, "/montagens/../%s/previa.jpg" % mid1, "/montagens/%s/../previa.jpg" % mid1, "/montagens/%s/previa.jpg" % mid1.upper(),
            "/montagens/%s/previa.jpg" % (mid1[:-1]), "/montagens/%s/previa.jpg" % ("0" * 32), "/montagens/%2e%2e/previa.jpg", "/montagens/%s/impressao.jpg" % ("0" * 32),
            "/montagens/%s/impressao.jpg/x" % mid1, "/montagens/%s/impressao" % mid1):
    ok(H("GET", cam)[0] == 404, "33: GET %s = 404" % cam.replace(mid1, "<mid>"))
ok(H("POST", "/montagens/outra", {"bases": bases})[0] == 404 and H("POST", "/montagens/%s/previa.jpg" % mid1, {})[0] == 404, "33: POST fora da tabela = 404")
# 33: validação
for corpo in ({"bases": bases, "caminho": "/etc/passwd"}, {"bases": []}, {"bases": ["x"] * 13}, {"bases": ["../../x"]}, {"bases": bases, "fundos": ["naoexiste"]},
              {"bases": bases, "fundos": ["../x"]}, {"bases": bases, "fundos": []}, {"bases": bases, "pedir": "sim"}, {"bases": "abc"}, {"bases": [1, 2]}, {"bases": bases, "fundos": ["tunel"] * 9}):
    ok(H("POST", "/montagens/lista", corpo)[0] == 400, "33: corpo %r = 400" % (corpo,))
ok(H("POST", "/montagens/lista", cru=b"[1,2]")[0] == 400 and H("POST", "/montagens/lista", cru=b"x" * 5000)[0] in (400, 413), "33: corpo que não é objeto ou passa de 4 KB")
fora_sessao = nova_base(True)
ok(H("POST", "/montagens/lista", {"bases": ["ffffffffffff"]})[0] == 404 and H("POST", "/montagens/lista", {"bases": [bases[0], fora_sessao], "pedir": True})[0] == 404,
   "33: base desconhecida ou fora das sessões = 404")
ok(not de_base(fora_sessao), "33: foto fora das sessões não ganha montagem por pedido")
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'fila' where mid = ?", (mid1,)); db.commit(); db.close()
ok(H("GET", "/montagens/%s/previa.jpg" % mid1)[0] == 404, "33: prévia de montagem que não está pronta = 404")
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'pronta' where mid = ?", (mid1,)); db.commit(); db.close()
# 28: leva sem bases (jeito antigo): o Checkout pede a montagem de uma foto comum; o servidor recorta e monta
m.REC_FALSO_SEG = 0
comum = [p for p in m.sess["LPMONT000"]["fotos"] if p not in b0][0]
st_, j_, _, _ = H("POST", "/montagens/lista", {"bases": [comum], "fundos": ["tunel"]})
ok(st_ == 200 and j_["itens"][0]["estado"] == "indisponivel" and not de_base(comum), "28: sem pedir, a foto comum fica indisponível e nada é feito: %r" % j_)
st_, j_, _, _ = H("POST", "/montagens/lista", {"bases": [comum], "fundos": ["tunel"], "pedir": True})
ok(st_ == 200 and j_["itens"][0]["estado"] in ("fila", "fazendo", "pronta"), "28: pedir põe na fila: %r" % j_)
ok(espera(lambda: H("POST", "/montagens/lista", {"bases": [comum], "fundos": ["tunel"]})[1]["itens"][0]["estado"] == "pronta", 60, 0.5), "28: a montagem pedida fica pronta")
rp = de_base(comum)
ok(len(rp) == 1 and rp[0]["prio"] == 0 and rp[0]["origem"] == "pedido", "28: linha com prioridade 0 e origem pedido: %r" % [(r["prio"], r["origem"]) for r in rp])
m.REC_FALSO_SEG = None
# pedir sobe a prioridade do que está na fila
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'fila', prio = 3 where mid = ?", (mid1,)); db.commit(); db.close()
    m.mont["parado"] = "teste"                      # segura o trabalhador para ver a linha na fila
st_, j_, _, _ = H("POST", "/montagens/lista", {"bases": [bases[1]], "fundos": ["tunel"], "pedir": True})
ok(st_ == 503, "E2: com a montagem parada a lista responde 503: %r" % st_)
with m.mont_lock:
    m.mont["parado"] = None
st_, j_, _, _ = H("POST", "/montagens/lista", {"bases": [bases[1]], "fundos": ["tunel"], "pedir": True})
ok(st_ == 200 and j_["itens"][0]["mid"] in (None, mid1), "E2: pedir com a linha na fila")
ok(espera(lambda: [r for r in de_base(bases[1]) if r["fundo"] == "tunel"][0]["estado"] == "pronta", 60), "E2: a linha pedida volta a ficar pronta com o mesmo mid")
ok([r for r in de_base(bases[1]) if r["fundo"] == "tunel"][0]["prio"] == 0, "E2: pedir sobe a prioridade para 0")
# ---------- E3 (critérios 36 a 40): impressão pelo arquivo do servidor ----------
ok(m.mont_status()["imprime"] is True, "E3: /status.montagem.imprime")
st_, j_, _, _ = H("GET", "/montagens/%s/impressao.jpg" % mid1)
ok(st_ == 409 and j_ == {"error": "nao_vendida"}, "37: corte de impressão de montagem não vendida = 409: %r %r" % (st_, j_))
ok(not os.path.exists(m.mont_arquivos(HOJE, mid1)[2]), "37: e nada é gerado")
mid_t = it[(bases[1], "telao")]["mid"]
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set vendida = ?, venda = 'V-IMP', expira = ? where mid in (?, ?)", (time.time(), time.time() + 60 * 86400, mid1, mid_t)); db.commit(); db.close()
st_, _, c1, hd = H("GET", "/montagens/%s/impressao.jpg" % mid1)
arq_i = m.mont_arquivos(HOJE, mid1)[2]
ok(st_ == 200 and hd.get("content-type") == "image/jpeg" and os.path.isfile(arq_i) and stat.S_IMODE(os.stat(arq_i).st_mode) == 0o600, "36: corte de impressão da montagem vendida, guardado como <mid>_i.jpg 600: %r" % st_)
with Image.open(io.BytesIO(c1)) as im:
    ok(im.size == (1844, 1240) and im.format == "JPEG" and not im.getexif(), "36: 1844x1240, JPEG sem EXIF: %r" % (im.size,))
    corte = np.asarray(im.convert("RGB")).astype(int)
# 38: é o corte do fiaMontar hi (centro na horizontal, preso embaixo) feito do final guardado
with Image.open(m.mont_arquivos(HOJE, mid1)[0]) as fim:
    W_, H_ = fim.size
    k_ = max(1844 / W_, 1240 / H_)
    sw_, sh_ = 1844 / k_, 1240 / k_
    ref = np.asarray(fim.convert("RGB").resize((1844, 1240), Image.LANCZOS, box=((W_ - sw_) / 2, H_ - sh_, (W_ - sw_) / 2 + sw_, H_))).astype(int)
ok(float(np.abs(corte - ref).mean()) < 2.0, "38/39: o corte bate com o final (preso embaixo), sem nada escrito por cima: erro médio %.2f" % float(np.abs(corte - ref).mean()))
st_, _, ct, _ = H("GET", "/montagens/%s/impressao.jpg" % mid_t)
with Image.open(io.BytesIO(ct)) as im, Image.open(m.mont_arquivos(HOJE, mid_t)[0]) as fim:
    W_, H_ = fim.size
    k_ = max(1844 / W_, 1240 / H_)
    sw_, sh_ = 1844 / k_, 1240 / k_
    ref = np.asarray(fim.convert("RGB").resize((1844, 1240), Image.LANCZOS, box=((W_ - sw_) / 2, (H_ - sh_) / 2, (W_ - sw_) / 2 + sw_, (H_ - sh_) / 2 + sh_))).astype(int)
    embaixo = np.asarray(fim.convert("RGB").resize((1844, 1240), Image.LANCZOS, box=((W_ - sw_) / 2, H_ - sh_, (W_ - sw_) / 2 + sw_, H_))).astype(int)
    tel = np.asarray(im.convert("RGB")).astype(int)
    e_meio, e_baixo = float(np.abs(tel - ref).mean()), float(np.abs(tel - embaixo).mean())
    ok(st_ == 200 and im.size == (1844, 1240) and e_meio < 4.0 and e_baixo > 3 * e_meio, "38: Telão cortado no meio da altura (erro %.2f contra o corte do meio, %.2f contra o de baixo; o resto é do JPEG)" % (e_meio, e_baixo))
t_i = os.stat(arq_i).st_mtime_ns
st_, _, c2, _ = H("GET", "/montagens/%s/impressao.jpg" % mid1)
ok(st_ == 200 and c2 == c1 and os.stat(arq_i).st_mtime_ns == t_i, "40: a reimpressão usa o mesmo arquivo (mesmo SHA, sem refazer)")
ok(H("GET", "/montagens/%s/impressao.jpg" % mid1, host="evil.invalid")[0] == 403, "33: corte de impressão com Host de fora = 403")
# 37: POST /imprimir com {mont}: o arquivo do servidor; não vendida ou inexistente recusada; base64 continua valendo
_imp = (m.IMPRESSORA, m.imp_ps1, m.imprimir_fila, m.imp_pedido)
m.IMPRESSORA, m.imp_ps1, m.imprimir_fila = "teste", (lambda: None), (lambda *a, **k: None)
m.imp_pedido = lambda *a, **k: {"id": 1}
jb = io.BytesIO(); Image.new("RGB", (60, 40), (9, 9, 9)).save(jb, "JPEG")
b64 = "data:image/jpeg;base64," + __import__("base64").b64encode(jb.getvalue()).decode()
r37 = m.imprimir([{"mont": mid1}, b64], "V-IMP")
gravados = sorted(os.path.join(m.IMP_DIR, n) for n in os.listdir(m.IMP_DIR)) if os.path.isdir(m.IMP_DIR) else []
ok(r37.get("ok") and r37.get("fotos") == 2 and len(gravados) == 2 and open(gravados[0], "rb").read() == c1 and open(gravados[1], "rb").read() == jb.getvalue(),
   "37: {mont} imprime o arquivo do servidor e o base64 continua valendo: %r" % r37)
nao_vendida = it[(bases[0], "mirante")]["mid"]
for item, nome in (({"mont": nao_vendida}, "não vendida"), ({"mont": "0" * 32}, "inexistente"), ({"mont": "../../etc/passwd"}, "fora do formato"), ({"mont": mid1, "arquivo": "/etc/passwd"}, "com campo a mais"), ({"arquivo": "/etc/passwd"}, "sem mont")):
    r_ = m.imprimir([item], "V-IMP")
    ok(r_.get("ok") is False, "37: item %s recusado: %r" % (nome, r_))
ok(len(os.listdir(m.IMP_DIR)) == 2, "37: item recusado não deixa arquivo na pasta de impressão")
m.IMPRESSORA, m.imp_ps1, m.imprimir_fila, m.imp_pedido = _imp
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set vendida = null, venda = null, expira = null where mid in (?, ?)", (mid1, mid_t)); db.commit(); db.close()
for mm_ in (mid1, mid_t):
    try:
        os.remove(m.mont_arquivos(HOJE, mm_)[2])
    except OSError:
        pass

# ---------- E4 (critérios 41 a 48): venda com montagem, galeria local ----------
TOK, COD = "tokMontagemTeste000001", "ABCD-EFGH"
ph = [p for p in m.sess["LPMONT001"]["fotos"]]      # a leva do gatilho só tem as 2 bases; as fotos comuns vêm da LPMONT000
comuns = [p for p in m.sess["LPMONT000"]["fotos"] if p not in b0][:2]
card_g = "LPMONT000"
mid_v = [r for r in de_base(b0[1]) if r["fundo"] == "tunel"][0]["mid"]          # a montagem que o cliente viu e comprou
mid_outra = [r for r in de_base(b0[0]) if r["fundo"] == "mirante"][0]["mid"]     # pronta, não comprada
exp_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 60 * 86400))


def manifesto(extra=()):
    return {"token": TOK, "tipo": "sessao", "codigo": COD, "venue": "maracana", "sessoes": [card_g], "criada": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "expira": exp_iso, "precos": {"dig": 39, "todas": 250},
            "fotos": [{"id": "ag_" + p, "sessao": card_g, "direito": "comprada", "canal": "loja"} for p in comuns] + list(extra)}


def evento(venda, tipo, seq, dados=None):
    return {"idem": "%s-%s-%d" % (venda, tipo, seq), "venda": venda, "seq": seq, "tipo": tipo, "em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "dados": dados or {}}


# 43: manifesto do navegador com t:'ai' inventado (ou com o id de uma montagem não vendida): o item não entra
st_, j_, _, _ = H("POST", "/galerias/publicar", {"manifesto": manifesto([{"id": mid_outra, "t": "ai", "bg": "mirante", "sessao": card_g, "direito": "comprada", "canal": "loja"},
                                                                         {"id": mid_v, "sessao": card_g, "direito": "comprada", "canal": "loja"}])})
mg_ = m.REPO.ler_manifesto(TOK)
ok(st_ == 200 and j_.get("ignoradas", 0) >= 2 and [f["id"] for f in mg_["fotos"]] == ["ag_" + p for p in comuns], "43: montagem inventada pelo navegador não entra (ignoradas %r): %r" % (j_.get("ignoradas"), [f["id"][:10] for f in mg_["fotos"]]))
# 41: venda paga (Zona Mista, só digital) com 1 montagem + 2 fotos: a galeria tem as 3 e a montagem baixa
dados_v = {"saleNo": "L0-041", "card": card_g, "sessoes": [card_g], "meio": "pix", "total": 110, "prints": 0, "nPh": 2, "nAI": 1, "selected": ["ag_" + p for p in comuns],
           "aiSel": ["ag_%s|tunel" % b0[1]], "aiMont": {"ag_%s|tunel" % b0[1]: mid_v}, "galeria": {"token": TOK, "codigo": COD}, "cart": [{"id": "zonamista", "v": 110}], "canal": "checkout"}
st_, j_, _, _ = H("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [evento("V-E4-1", "criar", 1, dados_v)]})
ok(st_ == 200 and j_["resultados"][0]["s"] == "ok", "41: evento criar aceito")
ok(not linhas("where vendida is not null"), "41: só com o criar (sem o pagar) nada é marcado como vendido")
st_, j_, _, _ = H("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [evento("V-E4-1", "pagar", 2, {"meio": "pix"})]})
rv = linhas("where mid = ?", (mid_v,))[0]
ok(rv["vendida"] and rv["venda"] == "V-E4-1" and rv["galeria"] == COD and rv["expira"] > time.time() + 59 * 86400, "41: a venda paga marca a montagem como vendida, com a venda, a galeria e o prazo: %r" % {k: rv[k] for k in ("vendida", "venda", "galeria")})
ok(len(linhas("where vendida is not null")) == 1, "41/47: só a montagem comprada é marcada")
m.gal_processar(TOK)
mg_ = m.REPO.ler_manifesto(TOK)
ai_ = [f for f in mg_["fotos"] if f.get("t") == "ai"]
ok(len(mg_["fotos"]) == 3 and len(ai_) == 1 and ai_[0] == {"id": mid_v, "t": "ai", "base": b0[1], "bg": "tunel", "sessao": card_g, "direito": "comprada", "canal": "loja"},
   "41: a galeria tem as 2 fotos e a montagem, no formato do contrato: %r" % ai_)
ok(m.REPO.existe(TOK, mid_v, "original") and m.REPO.existe(TOK, mid_v, "vitrine") and mg_["envio"]["compradas"] == "ok", "41: original e vitrine da montagem na galeria")
with Image.open(m.REPO.abrir(TOK, mid_v, "original")) as im:
    ok(max(im.size) == 3000 and im.format == "JPEG" and not im.getexif(), "46/D3: download em JPEG de 3000 px, sem EXIF: %r" % (im.size,))
with Image.open(m.mont_arquivos(HOJE, mid_v)[0]) as im:
    ok(max(im.size) == 5000, "D3: o arquivo de 5000 px continua guardado no servidor para a impressão")
# 45: a montagem comprada aparece com qualquer acesso dado, mesmo sem o rosto bater nela. Desde a v96.1 (release/v97) as
# outras compradas da venda também aparecem quando a selfie bateu em pelo menos uma foto (aqui as 2 fotos são compradas).
go = m.galeria_obj(TOK, mg_, {"ag_" + comuns[0]})
fa = [f for f in go["fotos"] if f.get("t") == "ai"]
ok(len(go["fotos"]) == 3 and all(f.get("direito") == "comprada" for f in go["fotos"]) and len(fa) == 1 and fa[0]["pid"] == mid_v and fa[0]["bg"] == "tunel" and fa[0]["direito"] == "comprada" and fa[0]["original"] and fa[0]["chegando"] is False,
   "45: galeria_obj devolve a montagem comprada (t, bg, original) sem depender do rosto: %r" % [(f["pid"][:8], f.get("t")) for f in go["fotos"]])
st_, _, corpo_, hd = H("GET", fa[0]["original"])
ok(st_ == 200 and corpo_[:2] == b"\xff\xd8", "41: a montagem baixa pelo link assinado da galeria: %r" % st_)
# 36/E3 com a venda de verdade: agora o corte de impressão sai (montagem vendida)
ok(H("GET", "/montagens/%s/impressao.jpg" % mid_v)[0] == 200 and H("GET", "/montagens/%s/impressao.jpg" % mid_outra)[0] == 409, "42: a vendida imprime e a não vendida não")
# republicar pelo navegador (sem a montagem) não a tira; 47: a não comprada nunca aparece
st_, j_, _, _ = H("POST", "/galerias/publicar", {"manifesto": manifesto()})
mg_ = m.REPO.ler_manifesto(TOK)
ok(st_ == 200 and [f["id"] for f in mg_["fotos"] if f.get("t") == "ai"] == [mid_v] and mid_outra not in [f["id"] for f in mg_["fotos"]], "47: republicação mantém só a montagem comprada")
# 47: galeria de grupo de escola nunca tem montagem
TOKE = "tokMontagemEscola00001"
H("POST", "/galerias/publicar", {"manifesto": {**manifesto(), "token": TOKE, "tipo": "evento", "codigo": COD, "nome": "Escola"}})
m.gal_processar(TOKE)
ok(not [f for f in (m.REPO.ler_manifesto(TOKE) or {"fotos": []})["fotos"] if f.get("t") == "ai"], "47: galeria de escola nunca tem montagem")
with m.gal_lock:
    m.codigos[COD] = TOK
# 44: venda paga antes de a montagem existir (app antigo ou Venda manual, sem aiMont, foto comum): "chegando" e completa sozinha
m.REC_FALSO_SEG = 0
with m.mont_lock:
    m.mont["parado"] = "teste"                      # segura a montagem para ver o "chegando"
dados_2 = {"saleNo": "L0-044", "card": card_g, "sessoes": [card_g], "meio": "dinheiro", "total": 110, "selected": [], "aiSel": ["ag_%s|mirante" % comuns[1], "ag_%s|naoexiste" % comuns[1], "../x|tunel"],
           "galeria": {"token": TOK, "codigo": COD}, "canal": "balcao",
           "cart": [{"id": "arq", "v": 70}, {"id": "fundo", "v": 40}]}   # v98: venda antiga com o item "Fundo de IA" segue valendo (a V-E4-1, sem o item, é a venda nova)
H("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [evento("V-E4-2", "criar", 1, dados_2), evento("V-E4-2", "pagar", 2, {"meio": "dinheiro"})]})
with m.mont_lock:
    m.mont["parado"] = None
r44 = de_base(comuns[1])
r44 = [r for r in r44 if r["fundo"] == "mirante"]
ok(len(r44) == 1 and r44[0]["venda"] == "V-E4-2" and r44[0]["vendida"] and r44[0]["origem"] in ("venda", "pedido") and len(linhas("where venda = 'V-E4-2'")) == 1,
   "44: sem aiMont o servidor resolve a montagem da venda sozinho (e fundo fora do mapa não entra): %r" % [(r["fundo"], r["estado"], r["origem"]) for r in linhas("where venda = 'V-E4-2'")])
mid44 = r44[0]["mid"]
m.gal_processar(TOK)
mg_ = m.REPO.ler_manifesto(TOK)
go = m.galeria_obj(TOK, mg_, set())
f44 = [f for f in go["fotos"] if f["pid"] == mid44]
if not (f44 and f44[0]["original"]):                # (se a montagem já ficou pronta antes de olhar, o "chegando" não é observável)
    ok(f44 and f44[0]["chegando"] is True and f44[0]["original"] is None and mg_["envio"]["compradas"] == "pendente", "44: montagem vendida ainda não pronta aparece como chegando: %r" % f44)
ok(espera(lambda: linhas("where mid = ?", (mid44,))[0]["estado"] == "pronta", 60), "44: o servidor recorta e monta a foto vendida: %r" % [(r["estado"], r["motivo"]) for r in linhas("where mid = ?", (mid44,))])
tk_fila = []
while not m.gal_fila.empty():
    tk_fila.append(m.gal_fila.get())
ok(TOK in tk_fila, "44: a montagem pronta põe a galeria da venda na fila para completar sozinha")
m.gal_processar(TOK)
go = m.galeria_obj(TOK, m.REPO.ler_manifesto(TOK), set())
ok([f for f in go["fotos"] if f["pid"] == mid44 and f["original"] and not f["chegando"]], "44: e a galeria completa")
m.REC_FALSO_SEG = None
# D7: venda paga com montagem que não sai em 5 min: alerta no /status (só venda e fundo)
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'erro', motivo = 'interno', vendida = ? where mid = ?", (time.time() - 400, mid44)); db.commit(); db.close()
    m.mont["st"] = (0.0, None)
al = m.mont_status()["alertas"]
ok(al == [{"venda": "V-E4-2", "fundo": "mirante", "estado": "erro"}], "D7: /status.montagem.alertas com a venda e o fundo, sem pid nem mid: %r" % al)
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'pronta', motivo = null where mid = ?", (mid44,)); db.commit(); db.close()
    m.mont["st"] = (0.0, None)
ok(m.mont_status()["alertas"] == [], "D7: montagem pronta, alerta some")
# 16 com venda de verdade: a vendida não sai por idade nem por teto
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set criada = ? where mid = ?", (time.time() - 10 * 86400, mid_v)); db.commit(); db.close()
teto_ = m.MONT_TETO_GB
m.limpar_montagens()
ok(linhas("where mid = ?", (mid_v,))[0]["estado"] == "pronta" and os.path.isfile(m.mont_arquivos(HOJE, mid_v)[0]), "48/16: a montagem vendida não sai na limpeza antes do prazo da galeria")
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set criada = ? where mid = ?", (time.time(), mid_v)); db.commit(); db.close()
# 48: venda cancelada: desmarca e sai da galeria
H("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [evento("V-E4-2", "cancelar", 3, {"motivo": "teste"})]})
ok(not linhas("where venda = 'V-E4-2'") and linhas("where mid = ?", (mid44,))[0]["vendida"] is None, "48: venda cancelada desmarca a montagem")
m.gal_processar(TOK)
ok(mid44 not in [f["id"] for f in m.REPO.ler_manifesto(TOK)["fotos"]] and mid_v in [f["id"] for f in m.REPO.ler_manifesto(TOK)["fotos"]], "48: a montagem da venda cancelada sai da galeria; a outra fica")
# evento repetido (idem igual) não muda nada; venda sem montagem não toca o índice
H("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [evento("V-E4-1", "pagar", 2, {"meio": "pix"}), evento("V-E4-3", "criar", 1, {"card": card_g, "selected": ["ag_" + comuns[0]]}), evento("V-E4-3", "pagar", 2, {})]})
ok(len(linhas("where vendida is not null")) == 1, "evento repetido e venda sem montagem não mexem nas vendidas")
# LGPD (regra da release v97): a base de montagem PAGA fica com o cliente. A montagem vendida fica (índice, arquivo e galeria);
# as montagens não vendidas da mesma base saem do servidor na hora e a recuperação não as refaz.
base_v = b0[1]
nv_ = [r for r in linhas("where base = ? and vendida is null and estado = 'pronta'", (base_v,))]
rl_ = m.lgpd_excluir([base_v], [], quem="teste")
mg_ = m.REPO.ler_manifesto(TOK)
ok(rl_["preservadas"] == 1 and rl_["fotos"] == 0 and base_v in m.lib and linhas("where mid = ?", (mid_v,))[0]["estado"] == "pronta"
   and os.path.isfile(m.mont_arquivos(HOJE, mid_v)[0]) and mid_v in [f["id"] for f in mg_["fotos"]],
   "LGPD: a montagem paga fica no servidor e na galeria: %r" % rl_)
m.mont_recuperar()
ok(nv_ and all(linhas("where mid = ?", (r["mid"],))[0]["estado"] == "apagada" and not any(os.path.exists(f) for f in m.mont_arquivos(r["dia"], r["mid"])) for r in nv_),
   "LGPD: as montagens não vendidas da base preservada saem (arquivo apagado, linha apagada) e não voltam na recuperação: %r" % [(r["fundo"], linhas("where mid = ?", (r["mid"],))[0]["estado"]) for r in nv_])
ok(m.mont_bases_vendidas() >= {base_v}, "LGPD: a base com montagem vendida no servidor conta como do cliente")
# a foto que sai de verdade (mont_apagar_base, chamado pelo lgpd_excluir para cada foto apagada): tudo dela some, também da galeria
m.mont_apagar_base(base_v)
mg_ = m.REPO.ler_manifesto(TOK)
ok(not linhas("where base = ?", (base_v,)) and mid_v not in [f["id"] for f in mg_["fotos"]] and not m.REPO.existe(TOK, mid_v, "original") and not m.REPO.existe(TOK, mid_v, "vitrine"),
   "19/E4: LGPD da base tira a montagem vendida do índice, do manifesto e dos arquivos da galeria")
ok(H("GET", "/montagens/%s/impressao.jpg" % mid_v)[0] == 404 and H("GET", "/montagens/%s/previa.jpg" % mid_v)[0] == 404, "19/E4: e as rotas respondem 404")
while not m.gal_fila.empty():
    m.gal_fila.get()

# 22/E2: desligada = 503
cfg("montagem", {"ligada": False})
ok(H("POST", "/montagens/lista", {"bases": bases})[0] == 503 and H("POST", "/montagens/lista", {"bases": bases})[1] == {"error": "montagem_desligada"}, "E2: montagem desligada = 503 montagem_desligada")
cfg("montagem", {"ligada": True, "checkout": True})
st = m.mont_status()
ok(st["ligada"] is True and st["checkout"] is True, "D5: config/montagem com checkout liga /status.montagem.checkout: %r" % st["checkout"])
cfg("montagem", {"ligada": True})
ok(m.mont_status()["checkout"] is False, "D5: sem o campo, checkout volta a desligado")
# 33: nenhuma resposta com Access-Control-Allow-Origin: *
ok(len(respostas) > 60 and all(r[3].get("access-control-allow-origin") != "*" for r in respostas), "33: nenhuma resposta de /montagens com Access-Control-Allow-Origin: *")
ok(not any(mid1 in l for l in console.linhas), "E2: o mid nunca vai para o console")
# 28: a 121ª chamada no minuto do mesmo IP recebe 429
with m.gal_lock:
    m._janelas.pop(("127.0.0.1", "mont"), None)
cods = [pede("POST", "/montagens/lista", {"bases": bases[:1], "fundos": ["tunel"]})[0] for _ in range(121)]
ok(cods[:120] == [200] * 120 and cods[120] == 429, "28: 120 chamadas por minuto por IP; a 121ª recebe 429: %r" % cods[118:])
ok(pede("GET", "/montagens/%s/previa.jpg" % mid1)[0] == 429, "28: a prévia também entra no limite")
with m.gal_lock:
    m._janelas.pop(("127.0.0.1", "mont"), None)
# aiMont no evento da venda: par inválido sai, a venda fica
ev = m._ev_limpo({"idem": "t-aimont-1", "venda": "V-AIMONT", "tipo": "criar", "dados": {"aiSel": ["ag_%s|tunel" % bases[1]], "aiMont": {"ag_%s|tunel" % bases[1]: mid1, "x|y": "nao", "ag_%s|telao" % bases[1]: "../../etc", "__proto__": mid1}}})
ok(ev and ev["dados"].get("aiMont") == {"ag_%s|tunel" % bases[1]: mid1}, "32: aiMont validado no evento (par inválido sai): %r" % (ev and ev["dados"].get("aiMont")))
ev = m._ev_limpo({"idem": "t-aimont-2", "venda": "V-AIMONT", "tipo": "criar", "dados": {"aiSel": ["a|b"], "aiMont": "x"}})
ok(ev and "aiMont" not in ev["dados"], "32: aiMont que não é objeto sai e a venda fica")

# ---------- 21: com o YuNet e o OpenCV, os rostos são lidos (linha com número) ----------
try:
    import cv2  # noqa: F401
    os.makedirs(m.MODELOS, exist_ok=True)
    shutil.copyfile(os.path.join(RAIZ, "vendor", "rostos", m.MONT_YUNET), os.path.join(m.MODELOS, m.MONT_YUNET))
    by = nova_leva("LPMONT003", n_bases=1)
    m.mont_recuperar()
    ok(espera(prontas(by, 5), 90), "21: leva com o YuNet instalado fica pronta")
    com = [r for r in de_base(by[0]) if isinstance(r["rostos"], int)]
    ok(len(com) >= 1, "21: com o YuNet, a linha de fundo com corte grava o número de rostos: %r" % [(r["fundo"], r["rostos"]) for r in de_base(by[0])])
    ok(all(min(base_de.get(r["fundo"], 1), 0) == 0 and r["prio"] == 3 for r in de_base(by[0])), "leva com 1 base: a base serve a todos os fundos")
    os.remove(os.path.join(m.MODELOS, m.MONT_YUNET))
except ImportError:
    notas["sem_cv2"] = True
# sem numpy ou Pillow: ligada falso com motivo, agente normal
_find = importlib.util.find_spec
importlib.util.find_spec = lambda n, *a, **k: None if n == "numpy" else _find(n, *a, **k)
st = m.mont_status()
ok(st["ligada"] is False and "numpy" in (st["motivo"] or "") and m.mont_base_pronta(bases[0], 1) == 0, "21: sem numpy, ligada falso com o motivo: %r" % st.get("motivo"))
importlib.util.find_spec = _find
ok(m.mont_status()["ligada"] is True, "21: com o numpy de volta, ligada")

# ---------- 17: fundo novo em config/fundos; fundo fora do mapa e apagar recusados ----------
ok(cfg("fundos", {"ativos": ATIVOS + ["naoexiste"]})["gravados"] == 0 and cfg("fundos", {"ativos": ["../x"]})["gravados"] == 0
   and cfg("fundos", {"ativos": ATIVOS * 2})["gravados"] == 0 and cfg("fundos", None)["gravados"] == 0, "17: fundo fora do mapa aprovado, lista repetida e apagar são recusados")
ok(m.mont_fundos() == ATIVOS, "17: a lista recusada não muda os fundos ativos")
r_, mot = m.mont_enfileirar(bases[0], "naoexiste", 0, "pedido")
ok(r_ is None and mot == "fundo", "17: pedir montagem de fundo fora do mapa é recusado")
ok(cfg("fundos", {"ativos": ATIVOS + ["podio"], "por": "admin@teste"})["gravados"] == 1 and m.mont_fundos() == ATIVOS + ["podio"], "17: config/fundos com o Pódio gravada")
# ---------- 23: offline: sem o arquivo do fundo, motivo "fundo" e nova tentativa; com os fundos baixados, monta sem internet ----------
origem = m.APP_ORIGIN
m.APP_ORIGIN = "http://127.0.0.1:9"
n17 = m.mont_recuperar()
hoje_bases = sorted(m.sess_ia_hoje())
ok(n17 == len(hoje_bases), "17: as bases de hoje ganham a montagem do fundo novo (%d pedidos para %d bases)" % (n17, len(hoje_bases)))
ok(espera(lambda: all(r["estado"] == "erro" and r["motivo"] == "fundo" for r in linhas("where fundo = 'podio'")), 30), "23: sem internet e sem o arquivo do fundo, a linha fica com erro e motivo fundo: %r" % [(r["estado"], r["motivo"]) for r in linhas("where fundo = 'podio'")][:3])
ok("podio" in m.mont_status()["fundos_faltando"], "23: /status.montagem.fundos_faltando traz o Pódio")
boff = nova_leva("LPMONT004", n_bases=1)
m.mont_recuperar()
ok(espera(lambda: len([r for r in de_base(boff[0]) if r["estado"] == "pronta"]) == 5, 90), "23: com os fundos já baixados, monta sem internet")
# SHA: arquivo de fundo trocado é recusado e não fica no disco
rel = m.bg_arquivo("podio", hi=True)
certo = m.FUNDOS_SHA[rel]
m.APP_ORIGIN = origem
m.FUNDOS_SHA[rel] = "0" * 64
ok(m.mont_fundo_arquivo("podio") is None and "podio" in m.mont["fundo_invalido"] and not os.path.exists(os.path.join(m.BG_DIR, "v83-" + rel.replace("/", "_"))),
   "8: arquivo de fundo com SHA diferente do aprovado é recusado e não fica no disco")
m.FUNDOS_SHA[rel] = certo
time.sleep(0.4)
m.mont_recuperar()
ok(espera(lambda: all(r["estado"] == "pronta" for r in linhas("where fundo = 'podio'")), 120), "23/17: com a internet de volta as montagens do fundo novo ficam prontas: %r" % [(r["estado"], r["motivo"]) for r in linhas("where fundo = 'podio' and estado != 'pronta'")][:3])
ok("podio" not in m.mont["fundo_invalido"] and m.mont_status()["fundos_faltando"] == [], "8: com o SHA certo o fundo volta a valer")
# arquivo local adulterado depois de baixado: apagado e baixado de novo
arq = m.mont_fundo_arquivo("tunel")
with open(arq, "ab") as f:
    f.write(b"x")
ok(m.mont_fundo_arquivo("tunel", baixar=False) is None and not os.path.exists(arq), "8: fundo adulterado no disco é apagado")
ok(m.mont_fundo_arquivo("tunel") == arq, "8: e baixado de novo com o SHA certo")
ok(cfg("fundos", {"ativos": ATIVOS})["gravados"] == 1, "volta aos 5 fundos")

# ---------- 15: disco abaixo do piso ----------
livre_real = m.mont_livre_gb
m.mont_livre_gb = lambda: 5.0
bd = nova_leva("LPMONT005", n_bases=1)
ok(m.mont_recuperar() == 0 and not de_base(bd[0]), "15: abaixo do piso nada novo com prioridade 1 a 3")
r_, mot = m.mont_enfileirar(bd[0], "mirante", 2, "auto")
ok(r_ is None and mot == "disco", "15: motivo disco")
ok(m.mont_status()["pausa_disco"] is True, "15: /status.montagem.pausa_disco")
r_, mot = m.mont_enfileirar(bd[0], "mirante", 0, "pedido")
m.mont_ev.set()
ok(r_ is not None and espera(lambda: [r["estado"] for r in de_base(bd[0])] == ["pronta"], 60), "15: o pedido do Checkout (prioridade 0) ainda é feito")
m.mont_livre_gb = lambda: 1.0
r_, mot = m.mont_enfileirar(bd[0], "tunel", 0, "pedido")
ok(r_ is None and mot == "disco", "15: abaixo de 2 GB nem a prioridade 0")
m.mont_livre_gb = livre_real
ok(m.mont_recuperar() == 4 and espera(prontas(bd, 5), 90) and m.mont_status()["pausa_disco"] is False, "15: com espaço de volta, retoma sozinho")

# ---------- 14: filho morto no meio ----------
trava = os.path.join(tempfile.gettempdir(), "mont-trava-%d" % os.getpid())
os.environ["MONTAGEM_FALSO_TRAVA"] = trava
m.MONT_ENV_PREFIXOS = ("MONTAGEM_FALSO",)
m.MONT_FILHO = os.path.join(AQUI, "_montagem_filho_falso.py")
with m.mont_filhos_lock:
    f0 = m.mont_filhos.get(0)
if f0 and f0["p"] is not None:                      # troca o filho de verdade pelo dos testes
    with f0["lock"]:
        m._rec_filho_matar(f0)
bk = nova_leva("LPMONT006", n_bases=1)
open(trava, "w").close()
m.mont_enfileirar(bk[0], "tunel", 0, "pedido")
m.mont_ev.set()


def filho_vivo():
    with m.mont_filhos_lock:
        f = m.mont_filhos.get(0)
    return f["p"] if f and f["p"] is not None and f["p"].poll() is None else None


def fazendo():
    return [r for r in de_base(bk[0]) if r["estado"] == "fazendo"]


mortes = 0
for k in range(3):
    if not ok(espera(lambda: filho_vivo() is not None and fazendo(), 30), "14: a montagem começou (%dª vez): %r" % (k + 1, [(r["estado"], r["motivo"]) for r in de_base(bk[0])])):
        break
    time.sleep(0.2)
    filho_vivo().kill()
    mortes += 1
    if k < 2:
        ok(espera(lambda: [r["estado"] for r in de_base(bk[0])] in (["fila"], ["fazendo"]) and m.mont["mortes_mem"] == mortes, 20), "14: filho morto, a linha volta para a fila (%dª morte): %r" % (mortes, [(r["estado"], r["motivo"]) for r in de_base(bk[0])]))
        t = time.time(); st = m.mont_status(); m.rec_status()
        ok(time.time() - t < 1 and st["parado"] is False and st["filho"]["mortes_memoria"] == mortes, "14: o agente segue respondendo o /status com o filho morto: %r" % st["filho"])
ok(espera(lambda: m.mont_status()["parado"] is True, 20), "14: 3 mortes por memória seguidas param a montagem (/status.montagem.parado)")
st = m.mont_status()
ok(st["ligada"] is False and "memória" in (st["motivo"] or ""), "14: parada, ligada falso com o motivo: %r" % st.get("motivo"))
ok([(r["estado"], r["motivo"]) for r in de_base(bk[0])] == [("erro", "interno")], "14: a montagem que derrubou o filho 3 vezes vira erro: %r" % [(r["estado"], r["motivo"]) for r in de_base(bk[0])])
os.remove(trava)
with m.mont_lock:                                   # "reiniciar o agente": a parada sai
    m.mont.update(parado=None, mortes_mem=0, erro=None, espera_s=m.MONT_ERRO_SEG)
    m.mont["tent"].clear()
m.MONT_FILHO = m.MONT_REGRAS_ARQ
time.sleep(0.4)
ok(m.mont_recuperar() >= 5 and espera(prontas(bk, 5), 90), "14: depois de reiniciar, a montagem com erro interno é refeita e a leva completa: %r" % [(r["fundo"], r["estado"], r["motivo"]) for r in de_base(bk[0])])

# ---------- 20: Separar (_vis_ia_reabre): as bases devolvidas ganham montagem ----------
bs = nova_leva("LPMONT007", ia=False)
ok(m.mont_recuperar() == 0, "20: leva sem bases (a visita já tinha) não ganha montagem")
with m.sess_lock:
    reab = m._vis_ia_reabre(["LPMONT007"], "separar")
ok(reab == ["LPMONT007"], "20: a leva separada volta a ter bases: %r" % reab)
ok(m.mont_recuperar() == 10 and espera(prontas(bs, 5), 120), "20: as bases devolvidas ganham as montagens na recuperação")

# ---------- 18: versão nova: não vendidas refeitas, vendida intacta ----------
vend = [r for r in de_base(bases[1]) if r["fundo"] == "tunel"][0]
fv = m.mont_arquivos(vend["dia"], vend["mid"])[0]
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set vendida = ?, venda = 'V-TESTE', expira = ? where mid = ?", (time.time(), time.time() + 60 * 86400, vend["mid"])); db.commit(); db.close()
n_antes = len(linhas("where estado = 'pronta'"))
v_antiga = m.mont_versao("tunel")
m.MONT_VERSAO = "m2"
ok(m.mont_versao("tunel") != v_antiga, "18: MONT_VERSAO novo muda a versão de cada fundo")
n18 = m.mont_recuperar()
ok(n18 == len(m.sess_ia_hoje()) * 5, "18: as bases de hoje entram de novo na fila com a versão nova (%d)" % n18)
ok(espera(lambda: len(linhas("where estado = 'pronta' and versao = ?", (m.mont_versao("tunel"),))) == len(m.sess_ia_hoje()), 300), "18: refeitas na versão nova")
ok(espera(lambda: m.mont_status()["fila"] == 0, 300), "18: fila da versão nova zerada")
apag = m.limpar_montagens()
velhas = linhas("where versao = ?", (v_antiga,))
ok(apag >= n_antes - 1 and all(r["estado"] == "apagada" or r["vendida"] for r in linhas() if r["versao"] != m.mont_versao(r["fundo"])), "18: a limpeza leva as não vendidas da versão antiga (%d)" % apag)
vr = linhas("where mid = ?", (vend["mid"],))[0]
ok(vr["estado"] == "pronta" and os.path.isfile(fv) and hashlib.sha256(open(fv, "rb").read()).hexdigest() == vend["sha"], "18: a vendida fica intacta, com o mesmo SHA")
ok(all(not os.path.exists(m.mont_arquivos(r["dia"], r["mid"])[0]) for r in linhas("where estado = 'apagada'")), "18: linha apagada fica sem arquivo")
notas["linhas_apagadas_auditoria"] = len(linhas("where estado = 'apagada'"))

# ---------- 16: limpeza por idade, expira, teto e link simbólico ----------
atual = [r for r in linhas("where estado = 'pronta'") if not r["vendida"]]
velha, nova_ = atual[0], atual[1]
with m.mont_lock:
    db = m.mont_db()
    db.execute("update montagem set criada = ? where mid = ?", (time.time() - 4 * 86400, velha["mid"]))
    db.execute("update montagem set criada = ? where mid = ?", (time.time() - 2.5 * 86400, nova_["mid"]))
    db.execute("update montagem set criada = ? where mid = ?", (time.time() - 30 * 86400, vend["mid"]))
    db.commit(); db.close()
fora = tempfile.mkdtemp(prefix="mont-fora-")
alvo = os.path.join(fora, "a" * 32 + ".jpg")
open(alvo, "wb").write(b"nao apagar")
os.symlink(fora, os.path.join(m.MONTAGENS, "2026-01-01"))
os.symlink(alvo, os.path.join(m.MONTAGENS, HOJE, "b" * 32 + ".jpg"))
orfa = os.path.join(m.MONTAGENS, HOJE, "c" * 32 + ".jpg")
open(orfa, "wb").write(b"x")
os.utime(orfa, (time.time() - 7200, time.time() - 7200))
m.limpar_montagens()
est = {r["mid"]: r["estado"] for r in linhas()}
ok(est[velha["mid"]] == "apagada" and not os.path.exists(m.mont_arquivos(velha["dia"], velha["mid"])[0]), "16/D1: não vendida com mais de 3 dias sai")
ok(est[nova_["mid"]] == "pronta" and est[vend["mid"]] == "pronta" and os.path.isfile(fv), "16: a de 2,5 dias fica e a vendida de 30 dias fica até expirar")
ok(os.path.isfile(alvo) and not os.path.lexists(os.path.join(m.MONTAGENS, "2026-01-01")) and not os.path.lexists(os.path.join(m.MONTAGENS, HOJE, "b" * 32 + ".jpg")),
   "16: link simbólico não é seguido (o link sai, o alvo fica)")
ok(not os.path.exists(orfa), "16: arquivo sem linha sai")
teto = m.MONT_TETO_GB
m.MONT_TETO_GB = 0.000001
m.limpar_montagens()
sobra = [r for r in linhas("where estado = 'pronta'")]
ok([r["mid"] for r in sobra] == [vend["mid"]], "16: acima do teto saem as não vendidas; a vendida nunca sai por teto (%d ficaram)" % len(sobra))
m.MONT_TETO_GB = teto
ok(m.mont_recuperar() == 0, "16: montagem apagada por teto ou idade não volta sozinha na recuperação")
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set expira = ? where mid = ?", (time.time() - 10, vend["mid"])); db.commit(); db.close()
m.limpar_montagens()
ok(linhas("where mid = ?", (vend["mid"],))[0]["estado"] == "apagada" and not os.path.exists(fv), "16: vendida com expira vencido sai")
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set apagada = ? where mid = ?", (time.time() - 61 * 86400, vend["mid"])); db.commit(); db.close()
m.limpar_montagens()
ok(not linhas("where mid = ?", (vend["mid"],)), "16: a linha apagada some depois de 60 dias")
shutil.rmtree(fora, ignore_errors=True)

# ---------- 19: LGPD da base ----------
bl = nova_leva("LPMONT008")
m.mont_recuperar()
ok(espera(prontas(bl, 5), 120), "19: leva pronta antes da LGPD")
arqs = [f for r in de_base(bl[0]) for f in m.mont_arquivos(r["dia"], r["mid"])[:2]]
ok(len(arqs) == 10 and all(os.path.isfile(f) for f in arqs), "19: 10 arquivos da base")
# uma montagem ainda na fila no momento da LGPD
with m.mont_lock:
    db = m.mont_db(); db.execute("update montagem set estado = 'fila', prio = 3 where base = ? and fundo = 'telao'", (bl[1],)); db.commit(); db.close()
m.lgpd_excluir([bl[0], bl[1]], [], quem="teste")
ok(not linhas("where base in (?, ?)", (bl[0], bl[1])) and not any(os.path.exists(f) for f in arqs), "19: LGPD apaga os arquivos e as linhas da base")
m.mont_ev.set()
time.sleep(1.0)
ok(m.mont_recuperar() == 0 and not linhas("where base in (?, ?)", (bl[0], bl[1])), "19: nada volta na recuperação")
ok(m.mont_enfileirar(bl[0], "tunel", 0, "pedido") == (None, "base"), "19: pedir montagem de base apagada é recusado")

# ---------- backup e fim ----------
src = open(AG, encoding="utf8").read()
ok("OPERACAO_DB, MONT_DB)" in src, "o montagens.db entra no backup")
ok(not [f for f in arquivos_no_disco() if f.endswith(".tmp")], "nenhum temporário esquecido")
txt = "".join(console.linhas)
ok(not any(r["mid"] in txt for r in linhas()) and "LPMONT" not in txt and not any(p in txt for p in bases), "11: console sem pid, mid ou código LP até o fim")
notas["status"] = {k: m.mont_status()[k] for k in ("fila", "feitas_hoje", "ms_medio", "pico_mb", "guardado_gb")}
srv.shutdown()
sys.stdout = console.real
if falhas:
    print("FALHA montagem_servidor_agente: %d · %s · %s" % (len(falhas), " · ".join(falhas[:10]), json.dumps(notas)))
    sys.exit(1)
print("OK montagem_servidor_agente (E1: 10 por visita com as preferidas primeiro, arquivos 600 só com o mid, idempotência, filho morto, disco, limpeza, fundo novo, versão nova, LGPD, Separar, offline, SHA do fundo · E2: rotas /montagens · E3: corte de impressão e {mont} · E4: venda, galeria, alerta) " + json.dumps(notas))
sys.stdout.flush()
os._exit(0)
