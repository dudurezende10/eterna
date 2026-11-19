# 19/11 (Ronaldo, inegociável): com ETERNA_RECORTE_GPU=obrigatoria o recorte nunca roda no processador. O modelo que abre
# fora da placa de vídeo fecha o processo, o recorte fica indisponível com o motivo (o Checkout não oferece fundo de IA) e
# tenta a placa de novo; abrindo na placa, recorta normal. Filho falso (testes/_recorte_filho_falso.py, RECORTE_FALSO_PROVEDOR).
# Roda:  python -I testes/recorte_placa_obrigatoria_agente.py agente/eterna-agente.py
import importlib.util, os, sys, tempfile, time
os.environ["HOME"] = os.environ["USERPROFILE"] = tempfile.mkdtemp()
os.environ["ETERNA_RECORTE_GPU"] = "obrigatoria"
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


ok(m.REC_GPU_OBRIG, "ETERNA_RECORTE_GPU=obrigatoria liga a trava")
m.rec_estado = lambda: (True, None)
m.REC_FILHO = os.path.join(AQUI, "_recorte_filho_falso.py")
m.REC_MEM_MIN_GB = 0
m.REC_ENV_PREFIXOS = ("RECORTE_FALSO_",)
ib = os.path.join(m.INBOX, time.strftime("%Y-%m-%d"))
os.makedirs(ib, exist_ok=True)
f1 = os.path.join(ib, "a19110000001_IMG.jpg")
im = Image.new("RGB", (900, 600), (20, 90, 30))
im.paste((220, 60, 60), (300, 120, 450, 600))
im.save(f1, quality=85)
with m.lock:
    m.lib["a19110000001"] = {"file": f1, "thumb": f1}

# 1) o modelo abre no processador: nada de recorte, motivo em /status, Checkout sem fundo de IA
os.environ["RECORTE_FALSO_PROVEDOR"] = "cpu"
try:
    p = m.rec_fazer("a19110000001", f1)
except Exception as ex:
    p = None
st = m.rec_status()
ok(p is None or not os.path.exists(p), "fora da placa não recorta: %r" % p)
ok(st["ok"] is False and m.REC_MSG_PLACA in (st["motivo"] or "") and st["placa_obrigatoria"] is True,
   "status mostra o recorte indisponível pela placa: %r" % {k: st[k] for k in ("ok", "motivo", "placa_obrigatoria")})
ok(not st["carregado"] and not st["filho"]["vivo"], "o processo do recorte no processador é fechado: %r" % st["filho"])

# 2) a placa volta (passado o prazo do erro): recorta normal e o status volta a ok
os.environ["RECORTE_FALSO_PROVEDOR"] = "cuda"
with m.rec_lock:
    m.rec["erro_em"] = 0
p = m.rec_fazer("a19110000001", f1)
st = m.rec_status()
ok(p and os.path.exists(p) and st["ok"] and st["provedor"] == "cuda", "na placa recorta e o status volta: %r" % ((p, st["ok"], st["provedor"]),))
m.rec_filhos_parar() if hasattr(m, "rec_filhos_parar") else None

if falhas:
    print("FALHA recorte_placa_obrigatoria: " + " || ".join(falhas), flush=True)
    os._exit(1)
print("OK recorte_placa_obrigatoria: fora da placa não recorta e avisa; na placa recorta", flush=True)
os._exit(0)
