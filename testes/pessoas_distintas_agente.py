# 27/11: pessoas = rostos distintos nas fotos do dia (_pessoas_agrupa). Rodar: python testes/pessoas_distintas_agente.py
import importlib.util, os, sys, tempfile, time

HA = tempfile.mkdtemp(prefix="eterna-distintas-")
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PESSOAS_DIR=os.path.join(HA, "hd", "contagens", "pessoas"))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ag", os.path.join(RAIZ, "agente", "eterna-agente.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
import numpy as np

falhas = 0


def ok(c, t):
    global falhas
    print(("ok   " if c else "FALHA ") + t)
    falhas += 0 if c else 1


rng = np.random.default_rng(7)
base = {n: rng.normal(size=128).astype("float32") for n in range(1000)}


def rosto(n):
    """vetor da pessoa n com variação de foto (perfil, luz): parecido com ela, diferente das outras."""
    return (base[n] + rng.normal(scale=0.5, size=128)).astype("float32").tobytes()


rows = []
# 100 famílias de 4, cada uma em 3 fotos, nenhum rosto precisa ser "bom" (frontal e nítido): todos contam
for f in range(100):
    for foto in range(3):
        pid = "f%d_%d" % (f, foto)
        for j in range(4):
            rows.append((pid, 120 - 10 * j, rosto(4 * f + j)))
        rows.append((pid, 20, rosto(999)))            # alguém bem ao fundo, na fila: não conta
sess = {"f%d_%d" % (f, k): "S%d" % f for f in range(100) for k in range(3)}
t0 = time.time()
P, sem = m._pessoas_agrupa(rows, np, set(), sess, None)
seg = time.time() - t0
ok(len(P) == 400, "400 rostos distintos em 300 fotos (100 famílias de 4), sem exigir rosto bom (%d)" % len(P))
ok(all(len(p["pids"]) == 3 for p in P), "cada pessoa reaparece nas 3 fotos dela, sem duplicar")
ok(all(len({rows[k][0] for k in p["m"]}) == len(p["m"]) for p in P), "dois rostos da mesma foto nunca viram a mesma pessoa")
ok(seg < 20, "rápido (%.1f s para %d rostos)" % (seg, len(rows)))
print("\n" + ("tudo certo" if not falhas else "%d falhas" % falhas))
sys.exit(1 if falhas else 0)
