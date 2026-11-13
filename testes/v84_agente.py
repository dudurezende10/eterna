# v84: testes Python do recorte local no agente (sem rede e sem os modelos de verdade). v97: a regra nova fica em
# testes/recorte_birefnet_agente.py; aqui, o 503 sem modelos, o cache, o erro que passa e a limpeza.
# Rodado por testes/v84.js com HOME temporário:  python3 -I testes/v84_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, tempfile
from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao               # para aqui se o HOME não for temporário
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# 1. sem modelos: indisponível, com o motivo; sem import de rembg no topo do agente
vazio = tempfile.mkdtemp()
os.environ["REMBG_HOME"] = vazio
os.environ["U2NET_HOME"] = vazio
st, mot = m.rec_estado()
ok(not st and "modelos" in (mot or ""), "sem modelos deveria ficar indisponível: %r" % mot)
src = open(sys.argv[1], encoding="utf-8").read()
topo = src.split("# ---------- reconhecimento facial", 1)[0]
ok("import rembg" not in topo and "from rembg" not in topo and "import onnxruntime" not in topo, "rembg/onnxruntime não podem ser importados no topo")
s = m.rec_status()
ok(s["ok"] is False and s["motivo"] and "ms_medio" in s, "rec_status sem modelos: %r" % s)
os.environ["ETERNA_SEM_RECORTE"] = "1"
ok(m.rec_estado()[0] is False, "ETERNA_SEM_RECORTE deveria desligar")
del os.environ["ETERNA_SEM_RECORTE"]
ok("instalar-recorte" in m.REC_COMO and "rembg==2.0.86" in m.REC_COMO and "onnxruntime==1.29.0" in m.REC_COMO and "[cli]" not in m.REC_COMO and "birefnet-general" in m.REC_COMO, "texto do como: " + m.REC_COMO)

# 2. v97: a regra do recorte (BiRefNet + o que encosta na pessoa) e o processo filho são testados em
# testes/recorte_birefnet_agente.py (máscaras sintéticas e modelos falsos); aqui ficam as rotas, o 503, o cache e a limpeza.
# Os recortes deste teste são feitos pelo recorte falso dos testes (m.REC_FALSO_SEG: cópia da foto, sem modelos).
d = tempfile.mkdtemp()
foto = os.path.join(d, "f.jpg")
Image.new("RGB", (900, 600), (10, 120, 30)).save(foto, quality=80)
foto2 = os.path.join(d, "g.jpg")
Image.new("RGB", (900, 600), (200, 30, 30)).save(foto2, quality=80)
m.REC_FALSO_SEG = 0.01
p = m.rec_fazer("abc123", foto)
ok(p == os.path.join(m.RECORTES, "abc123.png") and oct(os.stat(p).st_mode & 0o777) == "0o600", "recorte (falso) gravado com 600: %s" % p)
p24 = m.rec_fazer("abc123", foto, 2400)
ok(p24.endswith("abc123_2400.png") and m.rec_status()["feitos"] == 1, "cópia de 2400 sem recortar de novo")
ok(m.rec_fazer("abc123", foto) == p, "cache em disco deveria ser reaproveitado")
m.rec_fazer("abc124", foto2)
r, e = m.rec_pedir("abc125", foto2)
ok(r and not e and len(m.rec_threads) == m.REC_CONC == 1, "fila com 1 trabalhador: %r %r %r" % (r, e, len(m.rec_threads)))
ok(m.rec_status()["feitos"] >= 3, "contagem de recortes")
m.REC_FALSO_SEG = None

# erro ao abrir os modelos: limpa depois de 60 s
_rm, _rp = m.rec_modelo, m.rec_pose_ok
m.rec_modelo, m.rec_pose_ok = (lambda n: "/x/" + n), (lambda: (True, None))   # v97: como se os 4 modelos estivessem baixados
import time as _t
with m.rec_lock:
    m.rec["erro"], m.rec["erro_em"] = "erro ao abrir os modelos: x", _t.time()
e1 = m.rec_estado()
with m.rec_lock:
    m.rec["erro_em"] = _t.time() - 61
e2 = m.rec_estado()
ok(e1[1] and "erro ao abrir" in e1[1] and m.rec["erro"] is None, "erro deveria sair depois de 60 s: %r" % [e1, e2])
m.rec_modelo, m.rec_pose_ok = _rm, _rp
# limpeza: mais de 2 dias, foto fora da biblioteca, teto em GB
with m.lock:
    m.lib.clear()
    m.lib["abc123"] = {"file": foto, "thumb": foto}
    m.lib["abc124"] = {"file": foto2, "thumb": foto2}
velho = m.rec_arquivo("abc124")
os.utime(velho, (_t.time() - 3 * 86400,) * 2)
n = m.limpar_recortes()
rest = sorted(os.listdir(m.RECORTES))
ok(n == 2 and rest == ["abc123.png", "abc123_2400.png"], "limpeza (velho e fora da biblioteca): %r %r" % (n, rest))
m.REC_TETO_GB = 0
ok(m.limpar_recortes() == 2 and not os.listdir(m.RECORTES), "teto em GB")
print(json.dumps({"ok": not falhas, "falhas": falhas}))
