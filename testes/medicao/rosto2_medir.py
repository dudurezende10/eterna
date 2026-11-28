# Medição SFace x AuraFace nas fotos reais (só leitura). Saída: só números e, em crops/, as folhas de conferência (apagar depois).
#   sudo -u eterna /opt/eterna/venv/bin/python -I /tmp/aura/medir.py
import os, sys, time, random, glob
import cv2, numpy as np, onnxruntime as ort
import ctypes
_sp = os.path.dirname(os.path.dirname(ort.__file__))
for _ in (1, 2):                      # bibliotecas da placa (duas passadas por causa da ordem de dependência)
    for _f in sorted(glob.glob(_sp + "/nvidia/*/lib/*.so*")):
        try: ctypes.CDLL(_f, mode=ctypes.RTLD_GLOBAL)
        except OSError: pass
B = "/tmp/aura"; HOME = "/srv/eterna/Eterna"
DIA_A, DIA_B, MAX_B = "2026-11-25", "2026-11-26", 6000
out = open(B + "/resultado.txt", "w")
def P(*a):
    s = " ".join(str(x) for x in a); print(s, flush=True); out.write(s + "\n"); out.flush()
det = cv2.FaceDetectorYN.create(HOME + "/modelos/face_detection_yunet_2023mar.onnx", "", (320, 320), 0.7, 0.3, 5000)
sf = cv2.FaceRecognizerSF.create(HOME + "/modelos/face_recognition_sface_2021dec.onnx", "")
au = ort.InferenceSession(B + "/glintr100.onnx", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
P("AuraFace em:", au.get_providers()[0])
if au.get_providers()[0] != "CUDAExecutionProvider": P("sem placa: parando (na CPU levaria horas)"); sys.exit(1)
AIN = au.get_inputs()[0].name
TPL = np.array([[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]], dtype="float32")
def rostos(img, minimo=40):
    h, w = img.shape[:2]; k = min(1.0, 1600 / max(h, w))
    if k < 1: img = cv2.resize(img, (int(w * k), int(h * k)), interpolation=cv2.INTER_AREA)
    det.setInputSize((img.shape[1], img.shape[0])); _, f = det.detect(img)
    f = [r for r in (f if f is not None else []) if r[2] >= minimo]
    if not f: return []
    crops, res = [], []
    for r in f:
        e = sf.feature(sf.alignCrop(img, r)).flatten().astype("float32"); e /= (np.linalg.norm(e) or 1)
        M, _ = cv2.estimateAffinePartial2D(r[4:14].reshape(5, 2).astype("float32"), TPL, method=cv2.LMEDS)
        c = cv2.warpAffine(img, M, (112, 112)); crops.append(c); res.append([float(r[2]), e, None, c])
    b = np.stack([(cv2.cvtColor(c, cv2.COLOR_BGR2RGB).astype("float32") - 127.5) / 127.5 for c in crops]).transpose(0, 3, 1, 2)
    v = au.run(None, {AIN: b})[0]; v /= np.linalg.norm(v, axis=1, keepdims=True)
    for i, x in enumerate(res): x[2] = v[i]
    return sorted(res, key=lambda x: -x[0])
# arquivos por dia: data no caminho ou data de modificação
raiz = os.path.realpath(HOME + "/inbox"); por = {DIA_A: [], DIA_B: []}; tot = 0
for d, _, fs in os.walk(raiz):
    for n in fs:
        if not n.lower().endswith((".jpg", ".jpeg")): continue
        p = os.path.join(d, n); tot += 1
        for dia in por:
            if dia in p or dia.replace("-", "") in p: por[dia].append(p); break
        else:
            try: dm = time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(p)))
            except OSError: continue
            if dm in por: por[dm].append(p)
P("raiz", raiz, "jpg no total", tot, {k: len(v) for k, v in por.items()})
random.seed(1); random.shuffle(por[DIA_B]); por[DIA_B] = por[DIA_B][:MAX_B]
def ler(lista, nome):
    S, A, C, F, L, t0 = [], [], [], [], [], time.time()
    for i, p in enumerate(lista):
        img = cv2.imread(p, cv2.IMREAD_REDUCED_COLOR_2)
        if img is None: continue
        fs = rostos(img)
        for r in fs:
            if r[0] >= 0.5 * fs[0][0]: S.append(r[1]); A.append(r[2]); F.append(i); L.append(r[0])
        if i % 2000 == 0: P(nome, i, "/", len(lista), "rostos principais", len(S), "%.0fs" % (time.time() - t0))
    return np.array(S, "float32"), np.array(A, "float32"), np.array(F, "int32"), np.array(L, "float32")
SA, AA, FA, LA = ler(por[DIA_A], DIA_A); SB, AB, FB, LB = ler(por[DIA_B], DIA_B)
P("rostos principais:", DIA_A, len(SA), DIA_B, len(SB))
np.savez(B + "/emb.npz", SA=SA, AA=AA, FA=FA, LA=LA, SB=SB, AB=AB, FB=FB, LB=LB)
os.chmod(B + "/emb.npz", 0o644)
P("fim")
