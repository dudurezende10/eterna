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
# foto nova lida pelo leitor: acréscimo na matriz (mat_acrescenta, a mesma função do leitor)
t = time.perf_counter()
for i in range(20):
    v = rnd.normal(size=128).astype("float32"); v /= np.linalg.norm(v)
    m.mat_acrescenta(dia, "%012x" % (0xe10000000000 + i), [(100.0, v)])
num["acrescimo_por_foto_ms"] = (time.perf_counter() - t) * 1000 / 20


def grava(pid, faces):
    """faces = [(largura, vetor)]: grava no rostos.db e na matriz, como o leitor de rostos."""
    db_ = m.rostos_db()
    db_.execute("insert or replace into foto values (?,?,?,?)", (pid, dia, len(faces), time.time()))
    db_.execute("delete from rosto where pid=?", (pid,))
    db_.executemany("insert into rosto values (?,?,?,?)", [(pid, dia, float(l), v.astype("float32").tobytes()) for l, v in faces])
    db_.commit(); db_.close()
    m.mat_acrescenta(dia, pid, faces)


def perto(k=0.3):
    v = rnd.normal(size=128).astype("float32"); v = alvo + k * v / np.linalg.norm(v); return v / np.linalg.norm(v)


def longe():
    v = rnd.normal(size=128).astype("float32"); return v / np.linalg.norm(v)


# B5 (segurança): a pessoa a 70 px numa foto cujo principal tem 200 px não é "principal" (não abre a sessão inteira no app);
# a 200 px numa foto com outro rosto de 150 px é
grava("b5fundo00001", [(200.0, longe()), (70.0, perto())])
grava("b5frente0001", [(200.0, perto()), (150.0, longe())])
r = m.buscar_vetor(alvo, 1)
por = {f["id"]: f for f in r["fotos"]}
if not (por.get("b5fundo00001") and por["b5fundo00001"]["sim"] >= m.LIMITE and por["b5fundo00001"]["principal"] is False):
    falhas.append("B5: rosto de 70 px ao lado de um de 200 px veio como principal: %r" % por.get("b5fundo00001"))
if not (por.get("b5frente0001") and por["b5frente0001"]["principal"] is True):
    falhas.append("B5: rosto de 200 px (outro de 150 px) não veio como principal: %r" % por.get("b5frente0001"))
# o fundo deixa de ser fundo quando a foto é relida sem o rosto grande (mat_acrescenta troca as linhas da foto)
grava("b5fundo00001", [(70.0, perto())])
r = m.buscar_vetor(alvo, 1)
if not any(f["id"] == "b5fundo00001" and f["principal"] for f in r["fotos"]):
    falhas.append("B5: foto relida não trocou as linhas da matriz")
# corrida (revisão): leitura gravada enquanto a matriz do dia é relida do banco. A releitura velha não pode ficar.
with m._mat_lock:
    m._mat.pop(dia, None)
le0 = m._mat_le
chamadas = [0]


def le_com_corrida(db_, d):
    out = le0(db_, d)
    chamadas[0] += 1
    if chamadas[0] == 1:
        grava("corrida00001", [(180.0, perto())])     # o leitor grava no meio da releitura
    return out


m._mat_le = le_com_corrida
r = m.buscar_vetor(alvo, 1)
m._mat_le = le0
if chamadas[0] < 2 or "corrida00001" not in m._mat[dia][1]:
    falhas.append("corrida da matriz: a foto lida durante a releitura sumiu (%d leituras)" % chamadas[0])
if not any(f["id"] == "corrida00001" for f in m.buscar_vetor(alvo, 1)["fotos"]):
    falhas.append("corrida da matriz: a busca não acha a foto lida durante a releitura")
# janela da selfie (Eduardo, 01/11 16:46): sessão de 2 h atrás não aparece; de 80 min aparece; 0 = dia todo
agora = time.time()
ids = ["%012x" % (0xf00000000000 + i) for i in range(12)]
m.sess["LPVELHA01"] = {"card": "LPVELHA01", "dia": dia, "cap1": agora - 7200, "ultima_chegada": agora - 7100, "fotos": ids[:6], "pend": [], "status": "fechada"}
m.sess["LPNOVA001"] = {"card": "LPNOVA001", "dia": dia, "cap1": agora - 80 * 60, "ultima_chegada": agora - 79 * 60, "fotos": ids[6:], "pend": [], "status": "fechada"}
achou = lambda r_: {f["id"] for f in r_["fotos"] if f["sim"] >= m.LIMITE}
r = m.buscar_vetor(alvo, 1, 90)
if achou(r) != set(ids[6:]) or r["janela_min"] != 90:
    falhas.append("janela 90 min: esperava só as 6 fotos de 80 min atrás: %d %r" % (len(achou(r)), r.get("janela_min")))
if not set(ids) <= achou(m.buscar_vetor(alvo, 1, 0)):
    falhas.append("janela 0 (dia todo): esperava as 12 fotos")
ts = []
for _ in range(20):
    t = time.perf_counter(); m.buscar_vetor(alvo, 1, 90); ts.append((time.perf_counter() - t) * 1000)
num["busca_quente_janela_ms"] = sorted(ts)[len(ts) // 2]
# Painel de controle: config/busca no estado.db manda na busca (outro navegador grava, o agente lê); a variável é o padrão
if m.busca_janela_efetiva() != m.BUSCA_JANELA_MIN or m.BUSCA_JANELA_MIN != 90:
    falhas.append("janela padrão sem o Painel: %r" % m.busca_janela_efetiva())
m.estado_gravar({"docs": [{"col": "config", "id": "busca", "valor": {"janela_min": 150, "por": "teste"}}]})
if m.busca_janela_efetiva() != 150 or set(ids) - achou(m.buscar_vetor(alvo, 1)):
    falhas.append("Painel 150 min: a busca não usou o valor gravado (%r)" % m.busca_janela_efetiva())
m.estado_gravar({"docs": [{"col": "config", "id": "busca", "valor": {"janela_min": 0}}]})
if m.busca_janela_efetiva() != 0:
    falhas.append("Painel dia todo: %r" % m.busca_janela_efetiva())
m.estado_gravar({"docs": [{"col": "config", "id": "busca", "valor": {"janela_min": 5}}]})
if m.busca_janela_efetiva() != 15:
    falhas.append("Painel 5 min devia virar 15: %r" % m.busca_janela_efetiva())
if achou(m.buscar_vetor(alvo, 1)):
    falhas.append("Painel 15 min: sessão de 80 min atrás apareceu")
m.estado_gravar({"docs": [{"col": "config", "id": "busca", "valor": None}]})
if m.busca_janela_efetiva() != 90 or m._busca_janela("abc") != 90 or m._busca_janela("1000") != 480:
    falhas.append("janela: valores inválidos")
m.sess.clear()
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
