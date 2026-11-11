#!/usr/bin/env python3
# Eterna · processo de montagem dos fundos de IA (plano docs/planos/2026-11-11-montagem-no-servidor.md). Roda como FILHO
# do agente do ponto (eterna-agente.py), nunca sozinho na operação. REGRA DO PROJETO: recorte e montagem são feitos e
# guardados no servidor do ponto; o Checkout só mostra.
#
# É a porta em Python, função por função, do fiaMontar do app (index.html): medir, layout, rostos, desenhar, homog, warp,
# telao, montar, imprimir_corte (os mesmos nomes do canvas, sem o prefixo fia). O canvas do navegador é a referência: o
# teste testes/montagem-paridade.js compara as duas saídas ponto a ponto e a tabela de regras daqui com a do app (regras
# em dois lugares até a E6: mudar um número num dos lados quebra o teste).
#
# Armadilhas tratadas (cada uma tem critério no plano):
#   1) preto e branco pela matriz do CSS grayscale(1) em sRGB (0,2126 / 0,7152 / 0,0722), nunca Image.convert("L")
#   2) filtros do Telão na ordem do canvas: brightness, contrast, saturate (matrizes do CSS) e blur gaussiano
#   3) halo escuro: o recorte tem RGB zerado fora da pessoa; todo redimensionamento é com alfa pré-multiplicado (RGBa)
#   4) homografia: o fiaWarp amostra em coordenada inteira (sem +0,5), bilinear, com a regra dos 2,5 px de borda; portado
#      em numpy, igual (cv2.warpPerspective usa outra convenção)
#   5) medida do grupo: alfa reduzido a 600 px por bilinear sem antialias (como o drawImage padrão) e corte em 128
#   6) rostos: a mesma leitura do ynDetect (640x640, foto inteira + 4 quadrantes de 60%, limiar 0,6, NMS 0,3)
#
# Contrato (uma linha JSON por mensagem; stdout é só do protocolo):
#   -> {"pronto":true,"versao":"m1","carga_ms":N}
#   <- {"op":"montar","id":"<mid>","recorte":"<caminho>","fundo":"<caminho>","bg":"arq1950","final":"<caminho>",
#       "previa":"<caminho>","yunet":"<caminho|null>"}
#   -> {"id":"<mid>","ok":true,"w":5000,"h":3571,"bytes":{"final":N,"previa":N},"sha":"<sha256 do final>",
#       "layout":{"modo":"meio","corteFinal":0.72,"rostos":2},"ms":{...},"pico_mb":N}
#   -> {"id":"<mid>","ok":false,"erro":"sem_pessoa|fundo|recorte|imagem_grande|caminho_recusado|interno"}
#   <- {"op":"imprimir","id":"<mid>","final":"<caminho>","bg":"telao","destino":"<caminho>"}
# Caminhos: origem só dentro de --recortes e --fundos, destino só dentro de --montagens (realpath; o resto é recusado).
# Nunca abre porta, nunca baixa nada. Só numpy, Pillow, OpenCV (opcional: só os rostos) e a biblioteca padrão; nada do agente.
import os
import sys
import json
import math
import time
import re
import hashlib
import tempfile
import threading

VERSAO = "m1"
MAX_PIXELS = 40_000_000  # igual ao do agente: acima disso a imagem é recusada antes de decodificar
LADO_MEDIDA = 600        # fiaMedir: maior lado da cópia do alfa
ALFA_CORTE = 128
PREVIA_LADO = 1600       # maior lado da prévia (reduzida do final)
Q_FINAL, Q_PREVIA, Q_IMPRESSAO = 92, 85, 92
IMP_PX = (1844, 1240)    # 10x15 a 300 dpi (IMP_PX do app)
FUNDOS_MEM = 3           # fundos abertos guardados na memória (~50 MB cada um de 5000 px)

# ---- regras (iguais a FIA_REGRAS, FIA_PADRAO, FIA_BASE e DATA.backgrounds do index.html; conferidas pelo teste) ----
# corte = fração da altura do recorte mantida a partir do topo; alt e larg = teto da altura e da largura do grupo no
# quadro; cx = centro do grupo. O grupo sempre encosta na borda de baixo (docs/fundos-ia-regras.md).
REGRAS = {
    "campeao2": {"meio": {"corte": 1, "alt": .88, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .85, "larg": .95, "cx": .5}},
    "mirante": {"meio": {"corte": 1, "alt": .80, "larg": .92, "cx": .45}, "inteiro": {"corte": .62, "alt": .80, "larg": .92, "cx": .45}},
    "arq1950": {"mono": {"contraste": 1.10}, "meio": {"corte": .72, "alt": .85, "larg": 1, "cx": .5},
                "inteiro": {"corte": .60, "alt": .78, "larg": .92, "cx": .5},
                "largo": {"corte": .55, "alt": .85, "larg": 1.05, "cx": .5, "zoom": .8}},
    "tunel": {"meio": {"corte": 1, "alt": .75, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .75, "larg": .92, "cx": .5}},
    "podio": {"meio": {"corte": 1, "alt": .80, "larg": .62, "cx": .45}, "inteiro": {"corte": .62, "alt": .80, "larg": .62, "cx": .45}},
    "telao": {"meio": {"corte": .80, "alt": .90, "larg": .90, "cx": .5}, "inteiro": {"corte": .50, "alt": .90, "larg": .90, "cx": .5}},
}
PADRAO = {"meio": {"corte": 1, "alt": .80, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .80, "larg": .92, "cx": .5}}
# qual base de IA (0 = 1ª, corpo inteiro; 1 = 2ª, fechada) cada fundo prefere
BASE = {"arq1950": 0, "podio": 0, "telao": 1, "campeao2": 1, "campeaoarg": 1, "campeaocol": 1, "mirante": 1, "tunel": 1}
# fundo em que a família aparece DENTRO da tela (regra 17): cantos da área de imagem em px do arquivo de w x h
TELAO = {"telao": {"w": 2576, "h": 1840, "quad": [[559, 118], [2192, 330], [2249, 1213], [537, 1057]]}}
# fundos em que a foto inteira sai em preto e branco (bg.mono do app)
MONO = ["alto1950", "arq1950", "escanteio1950", "gramado1950"]
# acabamento de tela do Telão (fiaTelao), na ordem do canvas
TELAO_FILTRO = {"brilho": 1.04, "contraste": 1.05, "saturacao": 1.06, "blur_min": .3, "blur_div": 2400}


def regras_json():
    return {"versao": VERSAO, "regras": REGRAS, "padrao": PADRAO, "base": BASE, "telao": TELAO, "mono": MONO,
            "telao_filtro": TELAO_FILTRO, "imp": list(IMP_PX), "medida": LADO_MEDIDA, "alfa": ALFA_CORTE}


def regra_do_fundo(bg):
    """O que decide a montagem deste fundo (entra na versão da montagem: regra nova = montagem nova)."""
    return {"r": REGRAS.get(bg) or PADRAO, "t": TELAO.get(bg), "m": bg in MONO, "f": TELAO_FILTRO if bg in TELAO else None}


def jsround(v):
    """Math.round do JavaScript (meio para cima)."""
    return int(math.floor(v + 0.5))


# ---------------------------------------------------------------- medir (fiaMedir)
def _reduz_bilinear(a, w, h):
    """Redução bilinear SEM antialias (amostra no centro do ponto, como o drawImage com a qualidade padrão do canvas)."""
    import numpy as np
    H0, W0 = a.shape[:2]
    if (W0, H0) == (w, h):
        return a.astype(np.float32)
    xs = np.clip((np.arange(w, dtype=np.float64) + .5) * W0 / w - .5, 0, W0 - 1)
    ys = np.clip((np.arange(h, dtype=np.float64) + .5) * H0 / h - .5, 0, H0 - 1)
    x0 = np.floor(xs).astype(np.intp)
    y0 = np.floor(ys).astype(np.intp)
    x1 = np.minimum(x0 + 1, W0 - 1)
    y1 = np.minimum(y0 + 1, H0 - 1)
    fx = (xs - x0).astype(np.float32)
    fy = (ys - y0).astype(np.float32)
    if a.ndim == 3:
        fx = fx[:, None]
    lin0 = a[y0].astype(np.float32)
    lin1 = a[y1].astype(np.float32)
    topo = lin0[:, x0] * (1 - fx) + lin0[:, x1] * fx
    base = lin1[:, x0] * (1 - fx) + lin1[:, x1] * fx
    fy = fy[:, None, None] if a.ndim == 3 else fy[:, None]
    return topo * (1 - fy) + base * fy


def medir(alfa):
    """alfa: matriz uint8 (H0 x W0) do recorte. Devolve a medida do grupo (como o fiaMedir) ou None (sem pessoa)."""
    import numpy as np
    H0, W0 = alfa.shape
    k = min(1.0, LADO_MEDIDA / max(W0, H0))
    w, h = max(1, jsround(W0 * k)), max(1, jsround(H0 * k))
    red = np.floor(_reduz_bilinear(alfa, w, h) + .5)
    cheio = red >= ALFA_CORTE
    tem = cheio.any(axis=1)
    if not tem.any():
        return None
    a = cheio.argmax(axis=1)
    b = w - 1 - cheio[:, ::-1].argmax(axis=1)
    rows = [[int(a[y]), int(b[y])] if tem[y] else None for y in range(h)]
    ys = np.nonzero(tem)[0]
    y0, y1 = int(ys[0]), int(ys[-1])
    x0, x1 = int(a[tem].min()), int(b[tem].max())
    area = int((b[tem] - a[tem] + 1).sum())
    if area < w * h * .005:
        return None
    nb = max(1, jsround(h * .01))
    base = 0
    for y in range(h - nb, h):
        if rows[y]:
            base = max(base, rows[y][1] - rows[y][0] + 1)
    return {"W": W0, "H": H0, "w": w, "h": h, "k": k, "rows": rows,
            "box": {"x": x0, "y": y0, "w": x1 - x0 + 1, "h": y1 - y0 + 1}, "trunc": base > w * .005}


# ---------------------------------------------------------------- layout (fiaLayout)
def layout(m, bg, W, H, rostos=None):
    """Função pura: onde o grupo entra no quadro W x H do fundo bg (coordenadas do recorte em px originais).
    rostos (opcional, frações da altura do recorte): a linha de corte desce até a base do rosto mais baixo + 15% dele."""
    R = REGRAS.get(bg) or PADRAO
    modo = "meio" if m["trunc"] else "inteiro"
    box, k = m["box"], m["k"]

    def parte(r):
        yc = min(m["h"], box["y"] + box["h"] * r["corte"])
        if r["corte"] < 1 and rostos:
            hm = max(f["h"] for f in rostos)
            for f in rostos:
                if f["h"] >= hm * .3:
                    yc = max(yc, min(m["h"], (f["bot"] + .15 * f["h"]) * m["h"]))
        yc = jsround(yc)
        a, b = m["w"], -1
        for y in range(box["y"], yc):
            q = m["rows"][y]
            if q:
                a, b = min(a, q[0]), max(b, q[1])
        return {"x": a / k, "y": box["y"] / k, "w": (b - a + 1) / k, "h": (yc - box["y"]) / k, "corteFinal": (yc - box["y"]) / box["h"]}

    r = R[modo]
    src = parte(r)
    if modo == "inteiro" and R.get("largo") and src["w"] > src["h"]:   # regra 10: grupo largo de corpo inteiro no 1950
        modo, r = "largo", R["largo"]
        src = parte(r)
    s = min(r["alt"] * H / src["h"], r["larg"] * W / src["w"])
    dw, dh = src["w"] * s, src["h"] * s
    x = r["cx"] * W - dw / 2
    x = max(0, min(W - dw, x)) if dw <= W else (W - dw) / 2
    return {"modo": modo, "corte": r["corte"], "corteFinal": min(1, src["corteFinal"]), "zoom": r.get("zoom") or 1,
            "mono": R.get("mono") or None, "sombra": False, "src": src, "dst": {"x": x, "y": H - dh, "w": dw, "h": dh}, "s": s}


# ---------------------------------------------------------------- rostos (fiaRostos + ynDetect)
_yn = {}


def _yn_rede(modelo):
    import cv2
    r = _yn.get(modelo)
    if r is None:
        r = cv2.dnn.readNet(modelo)
        _yn.clear()
        _yn[modelo] = r
    return r


def _yn_regiao(rede, pm, sx, sy, sw, sh, thr):
    """Uma leitura do YuNet (entrada fixa 640x640, BGR 0 a 255) sobre a região sx, sy, sw, sh do recorte pré-multiplicado."""
    import numpy as np
    import cv2
    k = 640 / max(sw, sh)
    dw, dh = max(1, min(640, jsround(sw * k))), max(1, min(640, jsround(sh * k)))
    M = np.array([[1 / k, 0, sx + .5 / k - .5], [0, 1 / k, sy + .5 / k - .5]], dtype=np.float64)
    reg = cv2.warpAffine(pm, M, (dw, dh), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
    a = reg[:, :, 3:4].astype(np.float32)
    rgb = np.where(a > 0, reg[:, :, :3].astype(np.float32) * 255 / np.maximum(a, 1), 0)   # getImageData devolve a cor sem o alfa
    tela = np.zeros((640, 640, 3), np.float32)
    tela[:dh, :dw] = np.clip(np.floor(rgb + .5), 0, 255)[:, :, ::-1]                      # BGR
    rede.setInput(tela.transpose(2, 0, 1)[None].copy())
    nomes = ["%s_%d" % (n, st) for st in (8, 16, 32) for n in ("cls", "obj", "bbox", "kps")]
    saida = dict(zip(nomes, rede.forward(nomes)))
    out = []
    for st in (8, 16, 32):
        cols = 640 // st
        cl = np.clip(saida["cls_%d" % st].reshape(-1), 0, 1)
        ob = np.clip(saida["obj_%d" % st].reshape(-1), 0, 1)
        bb = saida["bbox_%d" % st].reshape(-1, 4)
        sc = np.sqrt(cl * ob)
        for i in np.nonzero(sc >= thr)[0]:
            r, cc = divmod(int(i), cols)
            cx, cy = (cc + bb[i, 0]) * st, (r + bb[i, 1]) * st
            w, h = math.exp(bb[i, 2]) * st, math.exp(bb[i, 3]) * st
            out.append({"x": sx + (cx - w / 2) / k, "y": sy + (cy - h / 2) / k, "w": w / k, "h": h / k, "score": float(sc[i])})
    return out


def rostos(cut, modelo, thr=.6):
    """Rostos no recorte (YuNet), em frações da altura: [{"top","bot","h"}]. A mesma leitura do ynDetect do app. Sem o
    modelo ou sem o OpenCV: None (a montagem segue sem rostos, como o catch do fiaRostos)."""
    if not modelo or not os.path.isfile(modelo):
        return None
    try:
        import numpy as np
        rede = _yn_rede(modelo)
        pm = np.asarray(cut.convert("RGBa"))
        H, W = pm.shape[:2]
        todos = _yn_regiao(rede, pm, 0, 0, W, H, thr)
        if max(W, H) > 1000:
            tw, th = W * .6, H * .6
            for sx, sy in ((0, 0), (W - tw, 0), (0, H - th), (W - tw, H - th)):
                todos += _yn_regiao(rede, pm, sx, sy, tw, th, thr)
    except Exception:
        return None
    todos.sort(key=lambda f: -f["score"])

    def iou(a, b):
        x1, y1 = max(a["x"], b["x"]), max(a["y"], b["y"])
        x2, y2 = min(a["x"] + a["w"], b["x"] + b["w"]), min(a["y"] + a["h"], b["y"] + b["h"])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        return inter / (a["w"] * a["h"] + b["w"] * b["h"] - inter or 1)
    fica = []
    for b in todos:
        if all(iou(q, b) < .3 for q in fica):
            fica.append(b)
    return [{"top": f["y"] / H, "bot": (f["y"] + f["h"]) / H, "h": f["h"] / H} for f in fica]


# ---------------------------------------------------------------- desenhar (fiaDesenhar)
def _grupo(cut, src, gw, gh):
    """A parte do recorte (src, px originais) no tamanho gw x gh, em RGBa (uint8, alfa PRÉ-MULTIPLICADO), como o canvas:
    redimensionar com o alfa comum escurece a borda (o recorte tem RGB zerado fora da pessoa)."""
    import numpy as np
    from PIL import Image
    g = cut.convert("RGBa").resize((gw, gh), Image.LANCZOS, box=(src["x"], src["y"], src["x"] + src["w"], src["y"] + src["h"]))
    return np.asarray(g)


def _cola(quadro, g, x, y, contraste=None):
    """source-over do grupo pré-multiplicado g (uint8 RGBa) em quadro (uint8, alterado no lugar) na posição inteira x, y
    (pode sair do quadro). contraste: CSS contrast() na cor sem o alfa, c' = c*k + (0,5 - 0,5k). Em faixas de 256 linhas
    (um grupo de 5000 px em float não cabe na memória pedida ao servidor)."""
    import numpy as np
    H, W = quadro.shape[:2]
    gh, gw = g.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + gw), min(H, y + gh)
    if x1 <= x0 or y1 <= y0:
        return
    for a in range(y0, y1, 256):
        b = min(y1, a + 256)
        f = g[a - y:b - y, x0 - x:x1 - x].astype(np.float32)
        rgb, al = f[:, :, :3], f[:, :, 3:4]
        if contraste:
            cor = np.where(al > 0, rgb * 255 / np.maximum(al, 1), 0)
            rgb = np.clip(cor * contraste + 255 * (.5 - .5 * contraste), 0, 255) * al / 255
        reg = quadro[a:b, x0:x1].astype(np.float32)
        quadro[a:b, x0:x1] = np.clip(np.floor(rgb + reg * (255 - al) / 255 + .5), 0, 255).astype(np.uint8)


def _cinza(quadro):
    """CSS grayscale(1) em sRGB, no lugar (em faixas: a imagem de 5000 px não cabe duas vezes em float)."""
    import numpy as np
    for y in range(0, quadro.shape[0], 256):
        f = quadro[y:y + 256].astype(np.float32)
        g = np.clip(np.floor(f[:, :, 0] * .2126 + f[:, :, 1] * .7152 + f[:, :, 2] * .0722 + .5), 0, 255).astype(np.uint8)
        quadro[y:y + 256] = g[:, :, None]


def _mitchell(x):
    import numpy as np
    x = np.abs(x)
    B = C = 1 / 3
    return np.where(x < 1, ((12 - 9 * B - 6 * C) * x ** 3 + (-18 + 12 * B + 6 * C) * x ** 2 + (6 - 2 * B)) / 6,
                    np.where(x < 2, ((-B - 6 * C) * x ** 3 + (6 * B + 30 * C) * x ** 2 + (-12 * B - 48 * C) * x + (8 * B + 24 * C)) / 6, 0))


def ampliar(src, W, H, box=None):
    """Ampliação cúbica (Mitchell, B = C = 1/3, 4 pontos por eixo, borda repetida) da região box = (x0, y0, x1, y1) de src
    (uint8 h x w x 3) para W x H, como o drawImage do canvas com imageSmoothingQuality "high" quando amplia. O resultado é
    truncado para 8 bits (medido contra o Chromium: arredondar deixa a imagem 0,4 nível mais clara). Em faixas de 256 linhas."""
    import numpy as np
    sh, sw = src.shape[:2]
    x0, y0, x1, y1 = box or (0, 0, sw, sh)

    def eixo(n_out, o0, vao, n):
        c = o0 + (np.arange(n_out, dtype=np.float64) + .5) * vao / n_out - .5
        i0 = np.floor(c).astype(np.intp)
        idx = np.stack([np.clip(i0 + t, 0, n - 1) for t in range(-1, 3)])
        w = np.stack([_mitchell(c - (i0 + t)) for t in range(-1, 3)]).astype(np.float32)
        return idx, w
    ix, wx = eixo(W, x0, x1 - x0, sw)
    iy, wy = eixo(H, y0, y1 - y0, sh)
    out = np.empty((H, W, 3), np.uint8)
    for a in range(0, H, 256):
        b = min(H, a + 256)
        r0, r1 = int(iy[:, a:b].min()), int(iy[:, a:b].max()) + 1
        faixa = src[r0:r1].astype(np.float32)
        hor = sum(faixa[:, ix[t]] * wx[t][None, :, None] for t in range(4))
        ver = sum(hor[iy[t, a:b] - r0] * wy[t, a:b][:, None, None] for t in range(4))
        out[a:b] = np.clip(np.floor(ver), 0, 255).astype(np.uint8)
    return out


def desenhar(plate, cut, L, W, H, bg):
    """plate: imagem RGB do fundo (Pillow); cut: recorte RGBA; L: layout. Devolve a matriz uint8 H x W x 3."""
    import numpy as np
    from PIL import Image
    pw, ph = plate.size
    if L["zoom"] < 1:                               # regra 10: o fundo aproxima (o alto e o centro dele, ampliados)
        z = L["zoom"]
        quadro = ampliar(np.asarray(plate.convert("RGB")), W, H, (pw * (1 - z) / 2, 0, pw * (1 - z) / 2 + pw * z, ph * z))
    else:
        quadro = np.array((plate if (pw, ph) == (W, H) else plate.resize((W, H), Image.BICUBIC)).convert("RGB"))
    gw, gh = max(1, jsround(max(1, L["dst"]["w"]))), max(1, jsround(max(1, L["dst"]["h"])))
    _cola(quadro, _grupo(cut, L["src"], gw, gh), jsround(L["dst"]["x"]), jsround(L["dst"]["y"]), (L.get("mono") or {}).get("contraste"))
    if L.get("mono") or bg in MONO:
        _cinza(quadro)
    return quadro


# ---------------------------------------------------------------- homog, warp, telao (fiaHomog, fiaWarp, fiaTelao)
def homog(de, para):
    """Homografia (9 números, h[8] = 1) que leva os 4 pontos de `de` aos de `para`. Eliminação de Gauss-Jordan, como no app."""
    A, b = [], []
    for i in range(4):
        (x, y), (u, v) = de[i], para[i]
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        b.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b.append(v)
    for c in range(8):
        p = c
        for r in range(c + 1, 8):
            if abs(A[r][c]) > abs(A[p][c]):
                p = r
        A[c], A[p] = A[p], A[c]
        b[c], b[p] = b[p], b[c]
        for r in range(8):
            if r == c:
                continue
            f = A[r][c] / A[c][c]
            if not f:
                continue
            for k in range(c, 8):
                A[r][k] -= f * A[c][k]
            b[r] -= f * b[c]
    return [b[i] / A[i][i] for i in range(8)] + [1]


def warp(src, dst, h, ox, oy):
    """Amostra src (sh x sw x 3) nos pontos de dst (dh x dw x 3 uint8, com a origem em ox, oy da imagem final) pela
    homografia h (ponto final -> src), bilinear em coordenada inteira (sem +0,5). Ponto a mais de 2,5 px fora de src não é
    escrito; até 2,5 px vale a última linha ou coluna. Igual ao fiaWarp (que grava em Uint8ClampedArray: meio para o par)."""
    import numpy as np
    sh, sw = src.shape[:2]
    dh, dw = dst.shape[:2]
    s = src.astype(np.float32)
    X = ox + np.arange(dw, dtype=np.float64)[None, :]
    for y0 in range(0, dh, 256):
        Y = (oy + np.arange(y0, min(dh, y0 + 256), dtype=np.float64))[:, None]
        z = h[6] * X + h[7] * Y + h[8]
        u = (h[0] * X + h[1] * Y + h[2]) / z
        v = (h[3] * X + h[4] * Y + h[5]) / z
        fora = (u < -2.5) | (v < -2.5) | (u > sw + 1.5) | (v > sh + 1.5)
        u = np.clip(u, 0, sw - 1.001)
        v = np.clip(v, 0, sh - 1.001)
        ix, iy = u.astype(np.intp), v.astype(np.intp)
        fx, fy = (u - ix).astype(np.float32)[:, :, None], (v - iy).astype(np.float32)[:, :, None]
        ix1, iy1 = np.minimum(ix + 1, sw - 1), np.minimum(iy + 1, sh - 1)
        val = (s[iy, ix] * (1 - fx) + s[iy, ix1] * fx) * (1 - fy) + (s[iy1, ix] * (1 - fx) + s[iy1, ix1] * fx) * fy
        val = np.clip(np.rint(val), 0, 255).astype(np.uint8)
        reg = dst[y0:y0 + 256]
        reg[~fora] = val[~fora]


def _matriz_cor(f, m):
    import numpy as np
    return np.clip(f @ np.asarray(m, dtype=np.float32).T, 0, 255)


def _gauss(f, sigma):
    """Desfoque gaussiano separável; fora do quadro é transparente e o resultado é dividido pelo alfa desfocado (o
    getImageData do canvas devolve a cor sem o alfa), então a borda não escurece."""
    import numpy as np
    if sigma < .03:
        return f
    r = max(1, int(math.ceil(sigma * 3)))
    k = np.exp(-(np.arange(-r, r + 1, dtype=np.float64) ** 2) / (2 * sigma * sigma))
    k = (k / k.sum()).astype(np.float32)

    def passa(a, eixo):
        n = a.shape[eixo]
        out = np.zeros_like(a)
        peso = np.zeros(n, np.float32)
        for i, kv in enumerate(k):
            d = i - r
            lo, hi = max(0, -d), min(n, n - d)
            if hi <= lo:
                continue
            de, para = [slice(None)] * a.ndim, [slice(None)] * a.ndim
            de[eixo], para[eixo] = slice(lo + d, hi + d), slice(lo, hi)
            out[tuple(para)] += a[tuple(de)] * kv
            peso[lo:hi] += kv
        forma = [1] * a.ndim
        forma[eixo] = n
        return out / peso.reshape(forma)
    return passa(passa(f, 1), 0)


def tela_de(bg, W):
    """Os 4 cantos da tela no fundo de largura W e o tamanho cw x ch do quadro retangular dela."""
    T = TELAO[bg]
    k = W / T["w"]
    q = [[x * k, y * k] for x, y in T["quad"]]

    def dist(a, b):
        return math.hypot(a[0] - b[0], a[1] - b[1])
    cw = jsround((dist(q[0], q[1]) + dist(q[3], q[2])) / 2)
    ch = jsround((dist(q[0], q[3]) + dist(q[1], q[2])) / 2)
    return q, cw, ch


def telao(plate, cut, m, bg, rostos_fn=None):
    """A família DENTRO da tela do telão (regra 17). Devolve (matriz uint8 H x W x 3, layout com "tela")."""
    import numpy as np
    from PIL import Image
    W, H = plate.size
    base = np.array(plate.convert("RGB"))
    q, cw, ch = tela_de(bg, W)
    xs, ys = [p[0] for p in q], [p[1] for p in q]
    X0, Y0 = max(0, math.floor(min(xs))), max(0, math.floor(min(ys)))
    X1, Y1 = min(W, math.ceil(max(xs)) + 1), min(H, math.ceil(max(ys)) + 1)
    pd = base[Y0:Y1, X0:X1]                         # só a caixa da tela (vista: grava direto no fundo)
    qL = [[x - X0, y - Y0] for x, y in q]
    # 1) o conteúdo atual do telão desentortado, em meia resolução, e ampliado para cw x ch
    hw, hh = jsround(cw / 2), jsround(ch / 2)
    meia = np.zeros((hh, hw, 3), np.uint8)
    warp(pd, meia, homog([[0, 0], [hw, 0], [hw, hh], [0, hh]], qL), 0, 0)
    tela = np.array(Image.fromarray(meia).resize((cw, ch), Image.BICUBIC))   # medido: mais perto do canvas que o Mitchell aqui
    # 2) a pessoa (do peito ou da cintura para cima) grande, embaixo e no centro da tela
    L = layout(m, bg, cw, ch)
    if L["corte"] < 1 and rostos_fn:
        ro = rostos_fn()
        if ro:
            L = layout(m, bg, cw, ch, ro)
        L["rostos"] = len(ro) if ro is not None else None
    gw, gh = max(1, jsround(L["dst"]["w"])), max(1, jsround(L["dst"]["h"]))
    _cola(tela, _grupo(cut, L["src"], gw, gh), jsround(L["dst"]["x"]), jsround(L["dst"]["y"]))
    # 3) acabamento de tela, na ordem do canvas: brightness, contrast, saturate (matrizes do CSS) e blur
    F = TELAO_FILTRO
    f = tela.astype(np.float32)
    # entre um filtro de cor e o seguinte o canvas volta a 8 bits truncando (medido contra o Chromium: sem isto a tela
    # sai 1 nível mais clara)
    f = np.floor(np.clip(f * F["brilho"], 0, 255))
    f = np.floor(np.clip(f * F["contraste"] + 255 * (.5 - .5 * F["contraste"]), 0, 255))
    s = F["saturacao"]
    f = _matriz_cor(f, [[.213 + .787 * s, .715 - .715 * s, .072 - .072 * s],
                        [.213 - .213 * s, .715 + .285 * s, .072 - .072 * s],
                        [.213 - .213 * s, .715 - .715 * s, .072 + .928 * s]])
    f = _gauss(f, float("%.2f" % max(F["blur_min"], cw / F["blur_div"])))
    fin = np.clip(np.floor(f + .5), 0, 255).astype(np.uint8)
    # 4) de volta em perspectiva nos 4 cantos; fora da tela, o fundo como está
    warp(fin, pd, homog(q, [[0, 0], [cw, 0], [cw, ch], [0, ch]]), X0, Y0)
    L.update(bg=bg, tela={"w": cw, "h": ch})
    return base, L


# ---------------------------------------------------------------- montar (fiaMontar) e imprimir_corte
def abrir_recorte(caminho):
    from PIL import Image
    with Image.open(caminho) as im:
        if im.size[0] * im.size[1] > MAX_PIXELS:
            raise ValueError("imagem_grande")
        return im.convert("RGBA")


_fundos = {}                                        # caminho -> (mtime, tamanho, imagem RGB)


def abrir_fundo(caminho):
    from PIL import Image
    st = os.stat(caminho)
    v = _fundos.pop(caminho, None)
    if v is None or v[0] != st.st_mtime or v[1] != st.st_size:
        with Image.open(caminho) as im:
            if im.size[0] * im.size[1] > MAX_PIXELS:
                raise ValueError("imagem_grande")
            v = (st.st_mtime, st.st_size, im.convert("RGB"))
    _fundos[caminho] = v
    while len(_fundos) > FUNDOS_MEM:
        _fundos.pop(next(iter(_fundos)))
    return v[2]


def montar(cut, plate, bg, yunet=None, m=None, rostos_dados=None, ms=None):
    """A montagem do recorte `cut` (RGBA) no fundo `plate` (RGB) com as regras de `bg`. Devolve (matriz uint8, layout).
    m e rostos_dados só nos testes (medida e rostos vindos do navegador). ValueError("sem_pessoa") sem grupo."""
    import numpy as np
    ms = ms if ms is not None else {}
    t = time.time()
    if m is None:
        m = medir(np.asarray(cut.getchannel("A")))
    ms["medir"] = int((time.time() - t) * 1000)
    if not m:
        raise ValueError("sem_pessoa")
    W, H = plate.size
    ms["rostos"] = 0

    def ro():
        t0 = time.time()
        r = rostos_dados if rostos_dados is not None else rostos(cut, yunet)
        ms["rostos"] += int((time.time() - t0) * 1000)
        return r
    t = time.time()
    if bg in TELAO:
        img, L = telao(plate, cut, m, bg, ro)
    else:
        L = layout(m, bg, W, H)
        if L["corte"] < 1:
            r = ro()
            if r:
                L = layout(m, bg, W, H, r)
            L["rostos"] = len(r) if r is not None else None
        L["bg"] = bg
        img = desenhar(plate, cut, L, W, H, bg)
    ms["montar"] = int((time.time() - t) * 1000) - ms["rostos"]
    return img, L


def imprimir_corte(img, bg):
    """Do final para o 10x15 (1844x1240 deitado; em pé invertido), o corte do fiaMontar hi: centro na horizontal, preso
    embaixo (o grupo encosta na borda); Telão no meio da altura (o grupo está na tela, no alto)."""
    from PIL import Image
    im = img if isinstance(img, Image.Image) else Image.fromarray(img)
    W, H = im.size
    ow, oh = IMP_PX if W >= H else (IMP_PX[1], IMP_PX[0])
    k = max(ow / W, oh / H)
    sw, sh = ow / k, oh / k
    x, y = (W - sw) / 2, ((H - sh) / 2 if bg in TELAO else H - sh)
    return im.resize((ow, oh), Image.LANCZOS, box=(x, y, x + sw, y + sh))


def previa_de(img):
    from PIL import Image
    im = img if isinstance(img, Image.Image) else Image.fromarray(img)
    W, H = im.size
    k = min(1.0, PREVIA_LADO / max(W, H))
    return im if k >= 1 else im.resize((max(1, jsround(W * k)), max(1, jsround(H * k))), Image.LANCZOS)


# ---------------------------------------------------------------- processo: caminhos, gravação, protocolo
_re_arquivo = re.compile(r"^[0-9a-f]{32}(_p|_i)?\.jpg$")
_re_bg = re.compile(r"^[a-z0-9]{2,40}$")


def dentro(caminho, pasta):
    try:
        c, p = os.path.realpath(caminho), os.path.realpath(pasta)
        return os.path.commonpath([c, p]) == p and c != p
    except (OSError, ValueError):
        return False


def destino_ok(caminho, montagens):
    """Destino só <montagens>/<pasta>/<32 hex>[_p|_i].jpg, com a pasta de verdade dentro de montagens (sem link para fora)."""
    return bool(caminho and _re_arquivo.match(os.path.basename(caminho)) and dentro(os.path.dirname(caminho), montagens)
                and not os.path.islink(caminho))


def gravar_jpeg(im, destino, q):
    """JPEG sem EXIF, por arquivo temporário na mesma pasta + os.replace; pasta 700, arquivo 600. Devolve (bytes, sha256)."""
    pasta = os.path.dirname(destino)
    os.makedirs(pasta, mode=0o700, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".mont-", suffix=".tmp", dir=pasta)
    try:
        with os.fdopen(fd, "wb") as f:
            im.save(f, "JPEG", quality=q, optimize=False)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        h = hashlib.sha256()
        with open(tmp, "rb") as f:
            for b in iter(lambda: f.read(1 << 20), b""):
                h.update(b)
        n = os.path.getsize(tmp)
        os.replace(tmp, destino)
        return n, h.hexdigest()
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def pico_mb():
    """Pico de memória deste processo em MB (resource no Mac e no Linux; no Windows, a API do sistema por ctypes)."""
    try:
        import resource
        r = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(r / (1024 * 1024) if sys.platform == "darwin" else r / 1024)
    except Exception:
        pass
    try:
        import ctypes
        from ctypes import wintypes

        class PMC(ctypes.Structure):
            _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + \
                       [(n, ctypes.c_size_t) for n in ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                                                       "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage",
                                                       "QuotaNonPagedPoolUsage", "PagefileUsage", "PeakPagefileUsage")]
        c = PMC()
        c.cb = ctypes.sizeof(PMC)
        k32 = ctypes.WinDLL("kernel32")
        k32.GetCurrentProcess.restype = wintypes.HANDLE
        fn = ctypes.WinDLL("psapi").GetProcessMemoryInfo
        fn.argtypes = [wintypes.HANDLE, ctypes.POINTER(PMC), wintypes.DWORD]
        if fn(k32.GetCurrentProcess(), ctypes.byref(c), c.cb):
            return int(c.PeakWorkingSetSize / (1024 * 1024))
    except Exception:
        pass
    return None


def op_montar(j, pastas):
    from PIL import Image
    t0 = time.time()
    bg = str(j.get("bg") or "")
    rec, fundo, final, previa = (str(j.get(k) or "") for k in ("recorte", "fundo", "final", "previa"))
    yunet = j.get("yunet")
    if not _re_bg.match(bg) or not dentro(rec, pastas["recortes"]) or not dentro(fundo, pastas["fundos"]) \
            or not destino_ok(final, pastas["montagens"]) or not destino_ok(previa, pastas["montagens"]) \
            or (yunet and not (pastas.get("modelos") and dentro(str(yunet), pastas["modelos"]))):
        raise ValueError("caminho_recusado")
    ms = {}
    try:
        cut = abrir_recorte(rec)
    except ValueError:
        raise
    except Exception:
        raise ValueError("recorte")
    try:
        plate = abrir_fundo(fundo)
    except ValueError:
        raise
    except Exception:
        raise ValueError("fundo")
    ms["abrir"] = int((time.time() - t0) * 1000)
    img, L = montar(cut, plate, bg, str(yunet) if yunet else None, ms=ms)
    t = time.time()
    im = Image.fromarray(img)
    nf, sha = gravar_jpeg(im, final, Q_FINAL)
    npv, _ = gravar_jpeg(previa_de(im), previa, Q_PREVIA)
    ms["gravar"] = int((time.time() - t) * 1000)
    ms["total"] = int((time.time() - t0) * 1000)
    return {"ok": True, "w": im.size[0], "h": im.size[1], "bytes": {"final": nf, "previa": npv}, "sha": sha,
            "layout": {"modo": L["modo"], "corteFinal": round(L["corteFinal"], 4), "rostos": L.get("rostos")},
            "ms": ms, "pico_mb": pico_mb()}


def op_imprimir(j, pastas):
    from PIL import Image
    t0 = time.time()
    bg, final, destino = str(j.get("bg") or ""), str(j.get("final") or ""), str(j.get("destino") or "")
    if not _re_bg.match(bg) or not dentro(final, pastas["montagens"]) or not _re_arquivo.match(os.path.basename(final)) \
            or not destino_ok(destino, pastas["montagens"]):
        raise ValueError("caminho_recusado")
    try:
        with Image.open(final) as im:
            if im.size[0] * im.size[1] > MAX_PIXELS:
                raise ValueError("imagem_grande")
            im = im.convert("RGB")
    except ValueError:
        raise
    except Exception:
        raise ValueError("final")
    out = imprimir_corte(im, bg)
    n, sha = gravar_jpeg(out, destino, Q_IMPRESSAO)
    return {"ok": True, "w": out.size[0], "h": out.size[1], "bytes": {"impressao": n}, "sha": sha,
            "ms": {"total": int((time.time() - t0) * 1000)}, "pico_mb": pico_mb()}


ERROS = ("sem_pessoa", "fundo", "recorte", "final", "imagem_grande", "caminho_recusado", "interno")


def _arg(nome, padrao=None):
    a = sys.argv
    return a[a.index(nome) + 1] if nome in a and a.index(nome) + 1 < len(a) else padrao


def main():
    # stdout fica só para o protocolo: o fd 1 do processo passa a ser o stderr (print de biblioteca vai para lá)
    proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
    os.dup2(2, 1)
    sys.stdout = sys.stderr

    def manda(o):
        proto.write(json.dumps(o) + "\n")
        proto.flush()

    if "--regras" in sys.argv:
        manda(regras_json())
        return 0
    if "--teste" in sys.argv:
        return teste(manda)
    pastas = {"recortes": _arg("--recortes"), "fundos": _arg("--fundos"), "montagens": _arg("--montagens"), "modelos": _arg("--modelos")}
    if not pastas["recortes"] or not pastas["fundos"] or not pastas["montagens"]:
        manda({"pronto": False, "erro": "faltam --recortes, --fundos e --montagens"})
        return 2
    t0 = time.time()
    try:
        import numpy  # noqa: F401
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        try:
            import cv2
            cv2.setNumThreads(2)
        except Exception:
            pass                                   # sem o OpenCV: monta sem rostos
        try:
            os.nice(10)                            # prioridade baixa (no Windows quem baixa é o Popen do agente)
        except (AttributeError, OSError):
            pass
    except Exception as ex:
        manda({"pronto": False, "erro": ("%s: %s" % (type(ex).__name__, ex))[:200]})
        return 3
    pai = os.getppid()

    def vigia_pai():                               # o agente caiu: a montagem não fica segurando memória
        while True:
            time.sleep(2)
            if os.getppid() != pai:
                os._exit(0)
    if os.name != "nt":
        threading.Thread(target=vigia_pai, daemon=True).start()
    manda({"pronto": True, "versao": VERSAO, "carga_ms": int((time.time() - t0) * 1000)})
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        rid = None
        try:
            j = json.loads(linha)
            rid = str(j.get("id") or "")[:60]
            op = j.get("op")
            if op == "montar":
                r = op_montar(j, pastas)
            elif op == "imprimir":
                r = op_imprimir(j, pastas)
            else:
                raise ValueError("interno")
            r["id"] = rid
            manda(r)
        except ValueError as ex:
            manda({"id": rid, "ok": False, "erro": str(ex) if str(ex) in ERROS else "interno"})
        except MemoryError:
            manda({"id": rid, "ok": False, "erro": "interno", "memoria": True})
        except Exception as ex:
            print("montagem: %s" % type(ex).__name__, file=sys.stderr)   # nunca o caminho nem o id
            manda({"id": rid, "ok": False, "erro": "interno"})
    return 0


def teste(manda):
    """Só para os testes de paridade (testes/montagem-paridade.js): lê do stdin uma lista JSON de pedidos e grava PNG sem
    perdas; uma linha de resposta por pedido.
    {"recorte","fundo","bg","saida"?,"impressao"?,"reduzida"?:[caminho,w,h],"m"?,"rostos"?,"yunet"?,"so_medir"?,"so_rostos"?,"so_layout"?}"""
    import numpy as np
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    pedidos = json.loads(sys.stdin.read())
    for j in pedidos if isinstance(pedidos, list) else [pedidos]:
        try:
            cut = abrir_recorte(j["recorte"])
            if j.get("so_rostos"):
                manda({"ok": True, "rostos": rostos(cut, j.get("yunet"))})
                continue
            m = medir(np.asarray(cut.getchannel("A")))
            if j.get("so_medir"):
                manda({"ok": True, "m": m and {k: m[k] for k in ("W", "H", "w", "h", "k", "box", "trunc")}})
                continue
            plate = abrir_fundo(j["fundo"])
            if j.get("so_layout"):                 # P1: a função pura com a medida e os rostos do navegador
                W, H = plate.size
                tela = None
                if j["bg"] in TELAO:
                    _, W, H = tela_de(j["bg"], W)
                    tela = {"w": W, "h": H}
                L = layout(j["m"], j["bg"], W, H)
                if L["corte"] < 1 and j.get("rostos"):
                    L = layout(j["m"], j["bg"], W, H, j["rostos"])
                if tela:
                    L["tela"] = tela
                manda({"ok": True, "layout": L})
                continue
            ms = {}
            t0 = time.time()
            img, L = montar(cut, plate, j["bg"], j.get("yunet"), m=j.get("m"), rostos_dados=j.get("rostos"), ms=ms)
            ms["total"] = int((time.time() - t0) * 1000)
            im = Image.fromarray(img)
            if j.get("saida"):
                im.save(j["saida"], "PNG", compress_level=1)
            if j.get("impressao"):
                imprimir_corte(im, j["bg"]).save(j["impressao"], "PNG", compress_level=1)
            if j.get("reduzida"):
                cam, rw, rh = j["reduzida"]
                im.resize((int(rw), int(rh)), Image.LANCZOS).save(cam, "PNG", compress_level=1)
            manda({"ok": True, "w": img.shape[1], "h": img.shape[0], "layout": L, "ms": ms, "pico_mb": pico_mb()})
        except ValueError as ex:
            manda({"ok": False, "erro": str(ex)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
