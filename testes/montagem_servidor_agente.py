# Montagem no servidor, E1 (plano docs/planos/2026-11-11-montagem-no-servidor.md): fila, banco, arquivos, gatilho,
# recuperação, retenção, LGPD, /status.montagem, config/fundos e config/montagem. Modo sombra: ninguém lê.
# Roda com HOME temporário:  HOME=$(mktemp -d) python3 -I testes/montagem_servidor_agente.py agente/eterna-agente.py
# O agente é carregado neste processo; o processo de montagem é o de verdade (agente/eterna-montagem.py) e, para o filho
# morto no meio, o testes/_montagem_filho_falso.py. Os fundos vêm de um servidor local com a raiz do repositório (portas
# 48200 a 48699). Só figuras geradas aqui (nunca foto de cliente).
import hashlib, http.server, importlib.util, io, json, os, re, shutil, socket, stat, sys, tempfile, threading, time
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
ok(st["ligada"] is True and st["checkout"] is False and st["imprime"] is False, "config/montagem ligada: /status.montagem.ligada, com o Checkout ainda fora (D5): %r" % st)

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
print("OK montagem_servidor_agente (E1: 10 por visita com as preferidas primeiro, arquivos 600 só com o mid, idempotência, filho morto, disco, limpeza, fundo novo, versão nova, LGPD, Separar, offline, SHA do fundo) " + json.dumps(notas))
sys.stdout.flush()
os._exit(0)
