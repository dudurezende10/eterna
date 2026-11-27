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
        rows.append((pid, 20, rosto(999)))            # a mesma pessoa bem ao fundo em todas: conta uma vez
sess = {"f%d_%d" % (f, k): "S%d" % f for f in range(100) for k in range(3)}
t0 = time.time()
P, sem = m._pessoas_agrupa(rows, np, set(), sess, None)
seg = time.time() - t0
ok(len(P) == 401, "401 rostos distintos em 300 fotos (100 famílias de 4 e a mesma pessoa ao fundo em todas), sem exigir rosto bom nem tamanho (%d)" % len(P))
ok(sorted(len(p["pids"]) for p in P) == [3] * 400 + [300], "cada pessoa reaparece nas 3 fotos dela, sem duplicar")
ok(all(len({rows[k][0] for k in p["m"]}) == len(p["m"]) for p in P), "dois rostos da mesma foto nunca viram a mesma pessoa")
ok(seg < 20, "rápido (%.1f s para %d rostos)" % (seg, len(rows)))
# rosto de perfil (assinatura fraca, ~0,3 de semelhança) da mesma pessoa: na mesma sessão é ela; em outra sessão, não junta
v = rng.normal(size=128).astype("float32"); v /= np.linalg.norm(v)
w = rng.normal(size=128).astype("float32"); w -= (w @ v) * v; w /= np.linalg.norm(w)
perfil = (0.3 * v + (1 - 0.09) ** 0.5 * w).astype("float32")
u = rng.normal(size=128).astype("float32"); u -= (u @ v) * v + (u @ w) * w; u /= np.linalg.norm(u)
outro = (0.3 * v + (1 - 0.09) ** 0.5 * u).astype("float32")   # outra pessoa, de perfil, com a mesma semelhança fraca
r2 = [("p1", 150, v.tobytes()), ("p2", 60, perfil.tobytes()), ("p3", 60, outro.tobytes())]
P2, _ = m._pessoas_agrupa(r2, np, {v.tobytes()}, {"p1": "S1", "p2": "S1", "p3": "S9"}, None)
ok(len(P2) == 2 and any(p["pids"] == {"p1", "p2"} for p in P2), "perfil na mesma sessão é a mesma pessoa; em outra sessão conta à parte (%d)" % len(P2))
# a mesma pessoa com a Marinara (sessão S1, rosto bom) e com o Yago (sessão S2, só de perfil, ~0,35): a venda liga as sessões
r3 = [("m1", 150, v.tobytes()), ("y1", 60, (0.35 * v + (1 - 0.35 ** 2) ** 0.5 * w).astype("float32").tobytes())]
s3 = {"m1": "S1", "y1": "S2"}
ok(len(m._pessoas_agrupa(r3, np, {v.tobytes()}, s3, None, [["S1", "S2"]])[0]) == 1, "mesma pessoa em duas sessões da mesma venda conta 1")
ok(len(m._pessoas_agrupa(r3, np, {v.tobytes()}, s3, None, [])[0]) == 2, "sem nada ligando as sessões, perfil fraco conta à parte")
# ligadas pelo rosto bom de outra pessoa da família nas duas sessões
irmao = rng.normal(size=128).astype("float32"); irmao /= np.linalg.norm(irmao)
r4 = r3 + [("m1", 140, irmao.tobytes()), ("y1", 140, irmao.tobytes())]
ok(len(m._pessoas_agrupa(r4, np, {v.tobytes(), irmao.tobytes()}, s3, None, [])[0]) == 2, "o irmão reconhecido nas duas sessões liga a visita: 2 pessoas, não 3")
# selfies: a do grupo conta cada rosto
t = time.time()
m.selfie_registra("checkout", {"rosto": True, "pessoas": 3, "fotos": [{"id": "x"}]}, t)
m.selfie_registra("checkout", {"rosto": True, "fotos": []}, t)
m.selfie_registra("checkout", {"rosto": False, "fotos": []}, t)
x = m.selfies_dia(m._ff_hoje())["por_origem"]["checkout"]
ok(x["selfies"] == 3 and x["pessoas"] == 4 and x["pessoas_achou"] == 3, "selfie do grupo de 3 + uma sozinha = 4 pessoas, 3 acharam (%s)" % x)
print("\n" + ("tudo certo" if not falhas else "%d falhas" % falhas))
sys.exit(1 if falhas else 0)
