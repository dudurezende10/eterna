# v91 parte B (Eduardo, 01/11): "a pessoa chega, faz o reconhecimento facial e já aparece tudo". Mede o lado do servidor
# do ponto na busca da selfie, com um dia de 3.000 fotos indexadas (vetores sintéticos, nunca rosto de convidado):
#   - matriz do dia lida do rostos.db (busca fria) e já em memória (quente);
#   - foto nova lida pelo leitor sem reler o dia inteiro (acréscimo na matriz);
#   - detecção + reconhecimento (YuNet + SFace) em 3 quadros de 1280x720, se os modelos estiverem em vendor/rostos.
# Roda sozinho (testes/rodar.sh):  python3 -I testes/selfie_rapidez.py agente/eterna-agente.py
# Meta do lado do servidor: busca quente < 50 ms, fria < 400 ms; detecção dos 3 quadros < 600 ms (CPU do teste).
import importlib.util, json, os, random, shutil, sys, tempfile, time

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
H = tempfile.mkdtemp()
os.environ["HOME"] = H
os.environ["ETERNA_SEM_OPENCV"] = "1"          # o módulo não sobe o leitor sozinho; a medição liga o que precisa
os.makedirs(os.path.join(H, "Eterna"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas, num = [], {}
try:
    import numpy as np
except Exception:
    print("OK selfie_rapidez: numpy ausente, medição pulada")
    sys.exit(0)
m._cv["np"] = np
rnd = np.random.default_rng(91)
dia = m._ff_hoje()
db = m.rostos_db()
N, rostos = 3000, 0
alvo = rnd.normal(size=128).astype("float32"); alvo /= np.linalg.norm(alvo)
linhas_f, linhas_r = [], []
for i in range(N):
    pid = "%012x" % (0xf00000000000 + i)
    k = int(rnd.integers(1, 5))
    linhas_f.append((pid, dia, k, time.time()))
    for j in range(k):
        v = rnd.normal(size=128).astype("float32")
        if i < 12 and j == 0:                       # 12 fotos da pessoa procurada (duas sessões)
            v = alvo + 0.35 * v / np.linalg.norm(v)
        v /= np.linalg.norm(v)
        linhas_r.append((pid, dia, float(rnd.integers(60, 400)), v.tobytes()))
        rostos += 1
db.executemany("insert or replace into foto values (?,?,?,?)", linhas_f)
db.executemany("insert into rosto values (?,?,?,?)", linhas_r)
db.commit(); db.close()

t = time.perf_counter(); r = m.buscar_vetor(alvo, 1); num["busca_fria_ms"] = (time.perf_counter() - t) * 1000
achou = {f["id"] for f in r["fotos"] if f["sim"] >= m.LIMITE}
if len([p for p in achou if int(p, 16) - 0xf00000000000 < 12]) != 12:
    falhas.append("a busca não achou as 12 fotos da pessoa: %d" % len(achou))
ts = []
for _ in range(20):
    t = time.perf_counter(); m.buscar_vetor(alvo, 1); ts.append((time.perf_counter() - t) * 1000)
num["busca_quente_ms"] = sorted(ts)[len(ts) // 2]
# foto nova lida pelo leitor: acréscimo na matriz (o leitor_loop faz o mesmo sob o _mat_lock)
M0, ps0 = m._mat[dia]
t = time.perf_counter()
for i in range(20):
    v = rnd.normal(size=(1, 128)).astype("float32")
    M0 = np.vstack([M0, v]); ps0 = ps0 + ["%012x" % (0xe10000000000 + i)]
num["acrescimo_por_foto_ms"] = (time.perf_counter() - t) * 1000 / 20
num["fotos"], num["rostos"] = N, rostos
# detecção e reconhecimento nos 3 quadros da câmera (se os modelos estiverem no repositório)
mods = os.path.join(os.path.dirname(os.path.abspath(AG)), "..", "vendor", "rostos")
try:
    import cv2
    if os.path.exists(os.path.join(mods, m.MOD_DET)):
        _cv = m._cv; _cv["cv2"] = cv2
        os.makedirs(m.MODELOS, exist_ok=True)
        for f in (m.MOD_DET, m.MOD_REC):
            shutil.copy(os.path.join(mods, f), os.path.join(m.MODELOS, f))
        det, rec = m.leitor()
        quadros = []
        for k in range(3):
            img = (rnd.random((720, 1280, 3)) * 255).astype("uint8")
            ok_, b = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
            import base64
            quadros.append("data:image/jpeg;base64," + base64.b64encode(b.tobytes()).decode())
        m._buscar(quadros, 1, det, rec)                 # aquece o modelo (no ponto ele já abre na partida)
        t = time.perf_counter(); m._buscar(quadros, 1, det, rec); num["deteccao_3_quadros_ms"] = (time.perf_counter() - t) * 1000
except ImportError:
    pass
num = {k: (round(v, 1) if isinstance(v, float) else v) for k, v in num.items()}
if num["busca_quente_ms"] > 50:
    falhas.append("busca quente acima de 50 ms")
if num["busca_fria_ms"] > 400:
    falhas.append("busca fria acima de 400 ms")
if num.get("deteccao_3_quadros_ms", 0) > 600:
    falhas.append("detecção dos 3 quadros acima de 600 ms")
print(json.dumps(num))
print(("OK selfie_rapidez: " if not falhas else "FALHA selfie_rapidez: " + " | ".join(falhas) + " · ") + json.dumps(num))
sys.exit(1 if falhas else 0)
