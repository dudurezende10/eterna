# 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md, critério 5): luz_medir e luz_classe com imagens geradas em
# numpy (nenhuma foto real): quadro preto = escura; branco = estourada; cinza médio = ok; rosto estourado com fundo escuro =
# estourada; céu estourado com rosto bom = ok. Também: a mesma conta sem o OpenCV (numpy puro), a miniatura pelo Pillow
# (só o quadro, r = None) e o formato da medida (só números).
#   HOME=$(mktemp -d) python3 -I testes/af_luz.py agente/eterna-agente.py
import importlib.util, json, os, sys, time
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S  # noqa: F401  (exige HOME temporário)

os.environ["ETERNA_SEM_OPENCV"] = "1"
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
import numpy as np
falhas, num = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)


def img(cor, h=600, w=900):
    return np.full((h, w, 3), cor, dtype=np.uint8)


try:
    L = dict(m.LUZ_LIM_PADRAO)
    cl = lambda v: m.luz_classe(v, L)
    for usa_cv in (False, True):
        m._cv.clear()
        if usa_cv:
            try:
                import cv2
                m._cv.update(cv2=cv2, np=np)
            except Exception:
                continue
        tag = "cv2" if usa_cv else "numpy"
        preto, branco, cinza = m.luz_medir(img(0)), m.luz_medir(img(255)), m.luz_medir(img(128))
        ok(cl(preto) == "escura", "5 (%s): quadro preto = escura: %r" % (tag, preto))
        ok(cl(branco) == "estourada", "5 (%s): branco = estourada: %r" % (tag, branco))
        ok(cl(cinza) == "ok", "5 (%s): cinza médio = ok: %r" % (tag, cinza))
        # rosto estourado com fundo escuro
        a = img(5)
        a[200:320, 400:500] = 255
        v = m.luz_medir(a, [(400, 200, 100, 120)])
        ok(v["r"] and v["r"]["p95"] >= 250 and cl(v) == "estourada", "5 (%s): rosto estourado com fundo escuro = estourada: %r" % (tag, v))
        ok(cl(m.luz_medir(a)) == "escura", "5 (%s): o mesmo quadro sem o rosto é escuro (o rosto decide)" % tag)
        # céu estourado com rosto bom
        b = img(115)
        b[:260] = 255
        b[300:420, 400:500] = 150
        v = m.luz_medir(b, [(400, 300, 100, 120), (10, 10, 20, 20)])
        ok(v["r"] and v["r"]["med"] == 150 and cl(v) == "ok", "5 (%s): céu estourado com rosto bom = ok: %r" % (tag, v))
        # o maior rosto vale; caixa 10% maior; formato só de números
        ok(v["r"]["n"] >= 100 * 120 and set(v) == {"v", "src", "q", "r"} and v["src"] == "original" and set(v["q"]) == {"med", "p5", "p95", "alto", "baixo"}
           and all(isinstance(x, (int, float)) for x in list(v["q"].values()) + list(v["r"].values())), "formato (%s): %r" % (tag, v))
        # foto escura de verdade: o rosto escuro (med abaixo de 50) é escura mesmo com fundo claro
        c = img(200)
        c[200:320, 400:500] = 30
        ok(cl(m.luz_medir(c, [(400, 200, 100, 120)])) == "escura", "5 (%s): rosto escuro = escura" % tag)
        ok(m.luz_classe(None, L) == "sem_dado" and m.luz_classe({"v": 1}, L) == "sem_dado", "sem medida = sem_dado")
        # tempo: uma foto de ~3 MP (a do leitor, reduzida pela metade)
        g = np.random.default_rng(1).integers(0, 255, (1500, 2000, 3), dtype=np.uint8)
        t0 = time.time()
        for _ in range(5):
            m.luz_medir(g, [(800, 500, 200, 240)])
        num["ms_" + tag] = round((time.time() - t0) * 200, 1)
    # Pillow (sem OpenCV): miniatura, só o quadro
    from PIL import Image
    for cor, esp in ((0, "escura"), (255, "estourada"), (128, "ok")):
        f = os.path.join(os.environ["HOME"], "mini-%d.jpg" % cor)
        Image.new("RGB", (300, 200), (cor, cor, cor)).save(f, "JPEG", quality=90)
        v = m.luz_medir_pil(f)
        ok(v["src"] == "thumb" and v["r"] is None and cl(v) == esp, "Pillow %d = %s: %r" % (cor, esp, v))
    # os limites da config valem: subir quadro_med_baixo põe o cinza escuro em escura
    d = img(60)
    v = m.luz_medir(d)
    ok(cl(v) == "ok" and m.luz_classe(v, dict(L, quadro_med_baixo=70, quadro_baixo_pct=0)) == "escura", "limites da calibração mudam a classe")
    ok(json.loads(json.dumps(v)) == v, "a medida é JSON puro")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1500:])
print(("OK" if not falhas else "FALHA") + " af_luz: luz_medir e luz_classe com imagens geradas (critério 5) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
