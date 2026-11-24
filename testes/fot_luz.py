# 23/11 (plano docs/planos/2026-11-23-alertas-fotografo.md, critério 5): luz_medir e luz_classe com imagens geradas em
# numpy (nenhuma foto real): quadro preto = escura; branco = estourada; cinza médio = ok; rosto estourado com fundo escuro =
# estourada; céu estourado com rosto bom = ok. Também: a mesma conta sem o OpenCV (numpy puro), o original pelo Pillow
# (só o quadro, r = None) e o formato da medida (só números). Revisão 23/11: só os recortes (60% centrais e rosto) são
# convertidos para cinza, com o mesmo resultado da foto inteira convertida; a varredura (luz_medir_arquivo) mede o original
# do mesmo jeito que o leitor (uma fonte só, src "original").
#   HOME=$(mktemp -d) python3 -I testes/fot_luz.py agente/eterna-agente.py
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
        ok(v["r"]["n"] >= 100 * 120 and set(v) == {"v", "src", "q", "r"} and v["src"] == "original" and set(v["q"]) == {"med", "p5", "p95", "alto", "baixo", "c_med"}
           and all(isinstance(x, (int, float)) for x in list(v["q"].values()) + list(v["r"].values())), "formato (%s): %r" % (tag, v))
        # foto escura de verdade: o rosto escuro (med abaixo de 50) é escura mesmo com fundo claro
        c = img(200)
        c[200:320, 400:500] = 30
        ok(cl(m.luz_medir(c, [(400, 200, 100, 120)])) == "escura", "5 (%s): rosto escuro = escura" % tag)
        ok(m.luz_classe(None, L) == "sem_dado" and m.luz_classe({"v": 1}, L) == "sem_dado", "sem medida = sem_dado")
        # revisão: converter só os recortes dá o mesmo que converter a foto inteira e recortar depois
        rg = np.random.default_rng(7)
        for (hh, ww, cx) in ((600, 900, (400, 200, 100, 120)), (1500, 2000, (700, 300, 300, 360)), (3000, 4000, (100, 2500, 80, 90))):
            im = rg.integers(0, 256, (hh, ww, 3), dtype=np.uint8)
            full = im.copy()
            if usa_cv:
                g = cv2.cvtColor(full, cv2.COLOR_BGR2GRAY)
            else:
                g = ((full[..., 0].astype(np.uint32) * 29 + full[..., 1].astype(np.uint32) * 150 + full[..., 2].astype(np.uint32) * 77) >> 8).astype(np.uint8)
            y0, y1, x0, x1 = int(hh * 0.2), int(hh * 0.8), int(ww * 0.2), int(ww * 0.8)
            c = g[y0:y1, x0:x1]
            if c.size > 2_000_000:
                c = c[::2, ::2]
            qref = m._luz_hist(np.bincount(c.ravel(), minlength=256).tolist())
            cc = g[int(hh * 0.25):int(hh * 0.9), int(ww * 0.3):int(ww * 0.7)]      # 24/11: região central (média), no mesmo passo
            qref["c_med"] = round(float((cc[::2, ::2] if (y1 - y0) * (x1 - x0) > 2_000_000 else cc).mean()), 1)
            x, y, l, a_ = cx
            fx0, fy0, fx1, fy1 = max(0, int(x - l * 0.05)), max(0, int(y - a_ * 0.05)), min(ww, int(x + l * 1.05) + 1), min(hh, int(y + a_ * 1.05) + 1)
            hr = np.bincount(g[fy0:fy1, fx0:fx1].ravel(), minlength=256).tolist()
            v = m.luz_medir(im, [cx])
            ok(v["q"] == qref and v["r"]["med"] == m._luz_hist(hr)["med"] and v["r"]["n"] == sum(hr) and (im == full).all(),
               "revisão (%s, %dx%d): recorte antes do cinza = foto inteira: %r x %r" % (tag, ww, hh, v["q"], qref))
        if usa_cv:
            f = os.path.join(os.environ["HOME"], "orig-cv.jpg")
            cv2.imwrite(f, rg.integers(0, 256, (800, 1200, 3), dtype=np.uint8))
            ref = m.luz_medir(cv2.imread(f, cv2.IMREAD_REDUCED_COLOR_2), [])
            ok(m.luz_medir_arquivo(f) == ref and ref["src"] == "original", "revisão: a varredura mede o original como o leitor: %r" % ref)
        # tempo: uma foto de ~3 MP (a do leitor, reduzida pela metade)
        g = np.random.default_rng(1).integers(0, 255, (1500, 2000, 3), dtype=np.uint8)
        t0 = time.time()
        for _ in range(5):
            m.luz_medir(g, [(800, 500, 200, 240)])
        num["ms_" + tag] = round((time.time() - t0) * 200, 1)
    # Pillow (sem OpenCV): o original reduzido pela metade, só o quadro
    from PIL import Image
    for cor, esp in ((0, "escura"), (255, "estourada"), (128, "ok")):
        f = os.path.join(os.environ["HOME"], "mini-%d.jpg" % cor)
        Image.new("RGB", (300, 200), (cor, cor, cor)).save(f, "JPEG", quality=90)
        v = m.luz_medir_pil(f)
        ok(v["src"] == "original" and v["r"] is None and cl(v) == esp, "Pillow %d = %s: %r" % (cor, esp, v))
        ok(abs(v["q"]["c_med"] - cor) <= 2, "Pillow %d: c_med (média da região central): %r" % (cor, v["q"]))
    # 24/11: a região central não é simétrica na altura; foto deitada no arquivo com EXIF 6 (em pé) mede como a já girada
    em_pe = Image.new("L", (200, 300), 10)
    em_pe.paste(240, (0, 0, 200, 75))                 # céu claro nos 25% de cima, o resto escuro
    f1, f2 = os.path.join(os.environ["HOME"], "pe.jpg"), os.path.join(os.environ["HOME"], "pe-exif.jpg")
    em_pe.convert("RGB").save(f1, "JPEG", quality=95)
    ex = Image.Exif()
    ex[0x0112] = 6
    em_pe.convert("RGB").transpose(Image.ROTATE_90).save(f2, "JPEG", quality=95, exif=ex)
    c1, c2 = m.luz_medir_pil(f1)["q"]["c_med"], m.luz_medir_pil(f2)["q"]["c_med"]
    ok(c1 < 20 and abs(c1 - c2) <= 2, "Pillow: c_med respeita a rotação do EXIF: %r x %r" % (c1, c2))
    # os limites da config valem: subir quadro_med_baixo põe o cinza escuro em escura
    d = img(60)
    v = m.luz_medir(d)
    ok(cl(v) == "ok" and m.luz_classe(v, dict(L, quadro_med_baixo=70, quadro_baixo_pct=0)) == "escura", "limites da calibração mudam a classe")
    ok(json.loads(json.dumps(v)) == v, "a medida é JSON puro")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1500:])
print(("OK" if not falhas else "FALHA") + " fot_luz: luz_medir e luz_classe com imagens geradas (critério 5) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
