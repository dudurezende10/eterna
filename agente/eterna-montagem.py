#!/usr/bin/env python3
# Eterna · processo de montagem dos fundos de IA (plano docs/planos/2026-11-16-montagem-no-servidor.md, E1). Roda como
# FILHO do agente do ponto (eterna-agente.py), nunca sozinho na operação. REGRA DO PROJETO: recorte e montagem são feitos
# e guardados no servidor do ponto; o Checkout só mostra.
#
# É a porta em Python, função por função, do fiaMontar do app (index.html): medir, estreito, layout, rostos, desenhar,
# homog, warp, telao, montar, imprimir_corte (os mesmos nomes do canvas, sem o prefixo fia). O canvas do navegador é a
# referência: o teste testes/montagem-paridade.js compara as duas saídas ponto a ponto e a tabela de regras daqui com a do
# app (regras em dois lugares: mudar um número num dos lados quebra o teste). Paridade, não melhoria: borda, luz e nitidez
# ficam como o navegador faz.
#
# Armadilhas tratadas (cada uma tem critério no plano):
#   1) preto e branco pela matriz do CSS grayscale(1) em sRGB (0,2126 / 0,7152 / 0,0722), nunca Image.convert("L")
#   2) filtros do Telão na ordem do canvas: brightness, contrast, saturate (matrizes do CSS) e blur gaussiano
#   3) halo escuro: o recorte tem RGB zerado fora da pessoa; todo redimensionamento é com alfa pré-multiplicado (RGBa)
#   4) homografia: o fiaWarp amostra em coordenada inteira (sem +0,5), bilinear, com a regra dos 2,5 px de borda; portado
#      em numpy, igual (cv2.warpPerspective usa outra convenção)
#   5) medida do grupo: alfa reduzido a 600 px como o drawImage padrão do Chromium (nível de mip + bilinear de ponto
#      fixo, ver _reduz_canvas) e corte em 128
#   6) rostos: a mesma leitura do ynDetect (640x640, foto inteira + 4 quadrantes de 60%, limiar 0,6, NMS 0,3)
#   8) redução de imagem: o canvas do Chromium diminui por nível de mip (média de 2x2) + bilinear de ponto fixo, não por
#      um filtro largo: a pessoa menor que o recorte e o corte 10x15 seguem essa conta (reduzir); ampliação é cúbica
#   7) prévia: o recorte de 3000 px é reduzido a 2400 em memória pelo mesmo thumbnail(LANCZOS) do agente (rec_fazer), que
#      é o PNG que o navegador recebe em lado:2400; a impressão usa o de 3000 e o fundo de 5000 px
#
# Contrato (uma linha JSON por mensagem; stdout é só do protocolo):
#   -> {"pronto":true,"versao":"m2","carga_ms":N}
#   <- {"id":"<n>","op":"montar","recorte":"<recortes/pid.png>","fundo":"telao","previa_fundo":"<arq>","hi_fundo":"<arq>",
#       "yunet":"<arq|null>","p":"<destino|null>","i":"<destino|null>"}
#   -> {"id":"<n>","ok":true,"w":2576,"h":1839,"layout":{"modo":"meio","estreito":1,"corteFinal":0.47,"rostos":2},
#       "frente":{"rostos":2,"frontais":2,"ok":true},"medida":{"trunc":true,"q":0.6},"bytes":{"p":N,"i":N},
#       "ms":{"abrir":N,"medir":N,"rostos":N,"montar":N,"gravar":N,"total":N},"pico_mb":N}
#   -> {"id":"<n>","ok":false,"erro":"sem_pessoa|fundo|recorte|imagem_grande|caminho_recusado|interno"}
# Caminhos: origem só dentro de --recortes e --fundos, destino só dentro de --montagens (realpath; o resto é recusado),
# nome <fundo>-<8 hex>-<p|i|f>.jpg. Nunca abre porta, nunca baixa nada. Só numpy, Pillow, OpenCV (opcional: só os rostos)
# e a biblioteca padrão; nada do agente. As mensagens de erro nunca levam caminho nem id de foto.
import os
import sys
import json
import math
import time
import re
import tempfile
import threading

VERSAO = "m2"
MAX_PIXELS = 40_000_000  # igual ao do agente: acima disso a imagem é recusada antes de decodificar
LADO_MEDIDA = 600        # fiaMedir: maior lado da cópia do alfa
ALFA_CORTE = 128
LADO_PREVIA = 2400       # FIA_LADO_PREVIA do app: o recorte da prévia (cópia reduzida do de 3000)
Q_PREVIA, Q_IMPRESSAO = 90, 92
IMP_PX = (1844, 1240)    # 10x15 a 300 dpi (IMP_PX do app)
FUNDOS_MEM = 3           # fundos abertos guardados na memória (~50 MB cada um de 5000 px)
RECORTES_MEM = 2         # últimos recortes abertos, com a medida e os rostos (os 3 fundos da mesma base não reabrem o PNG)
Q_FRONTAL = 0.35         # SESS_Q_FRONTAL do agente: nariz a até 0,35 da distância entre os olhos
FRENTE_RAZAO = 0.5       # rosto principal = largura >= 50% do maior (VARIAS_RAZAO do agente)

# ---- regras (iguais a FIA_REGRAS, FIA_PADRAO, FIA_ESTREITO_DE/ATE, FIA_BASE e DATA.backgrounds do index.html; o teste
# testes/montagem-paridade.js confere campo a campo) ----
# corte = fração da altura do recorte mantida a partir do topo; alt e larg = teto da altura e da largura do grupo no
# quadro; cx = centro do grupo. O grupo sempre encosta na borda de baixo (docs/fundos-ia-regras.md).
REGRAS = {
    "campeao2": {"meio": {"corte": 1, "alt": .88, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .85, "larg": .95, "cx": .5}},
    "mirante": {"meio": {"corte": 1, "alt": .80, "larg": .92, "cx": .45}, "inteiro": {"corte": .62, "alt": .80, "larg": .92, "cx": .45}},
    "mirantedia": {"meio": {"corte": 1, "alt": .80, "larg": .92, "cx": .45}, "inteiro": {"corte": .62, "alt": .80, "larg": .92, "cx": .45},
                   "estreito": {"corte": .74, "alt": .80, "larg": .92, "cx": .45}},
    "arq1950": {"mono": {"contraste": 1.10}, "meio": {"corte": 1, "alt": .66, "larg": .92, "cx": .5},
                "inteiro": {"corte": .62, "alt": .66, "larg": .92, "cx": .5},
                "estreito": {"corte": .74, "alt": .66, "larg": .92, "cx": .5}},
    "tunel": {"meio": {"corte": 1, "alt": .75, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .75, "larg": .92, "cx": .5}},
    "podio": {"meio": {"corte": 1, "alt": .80, "larg": .62, "cx": .45}, "inteiro": {"corte": .62, "alt": .80, "larg": .62, "cx": .45}},
    "telao": {"meio": {"corte": .80, "alt": .90, "larg": .90, "cx": .5}, "inteiro": {"corte": .50, "alt": .90, "larg": .90, "cx": .5},
              "estreito": {"corte": .47, "alt": .90, "larg": .90, "cx": .5}},
}
PADRAO = {"meio": {"corte": 1, "alt": .80, "larg": .92, "cx": .5}, "inteiro": {"corte": .62, "alt": .80, "larg": .92, "cx": .5}}
# regra 20 (fiaEstreito): razão largura/altura do recorte medido; até DE é estreito, de ATE em diante é a regra de sempre
ESTREITO_DE, ESTREITO_ATE = .70, 1.20
# qual base de IA (0 = 1ª, corpo inteiro; 1 = 2ª, fechada) cada fundo prefere
BASE = {"arq1950": 0, "podio": 0, "telao": 1, "mirantedia": 1, "campeao2": 1, "campeaoarg": 1, "campeaocol": 1, "mirante": 1, "tunel": 1}
# fundos com montagem local: arquivo da prévia e da impressão (caminhos do app), preto e branco na foto inteira (bg.mono),
# corte 10x15 preso no alto (impAlto) e a tela do Telão (regra 17: cantos da área de imagem em px do arquivo de w x h)
FUNDOS = {
    "mirantedia": {"previa": "img/bg-mirantedia.jpg", "hi": "img/fundos-5k/mirantedia.jpg", "mono": False, "impAlto": False, "telao": None},
    "arq1950": {"previa": "img/bg-maracana1950.jpg", "hi": "img/fundos-5k/maracana1950.jpg", "mono": True, "impAlto": True, "telao": None},
    "telao": {"previa": "img/bg-telao-v2.jpg", "hi": "img/bg-telao-v2.jpg", "mono": False, "impAlto": False,
              "telao": {"w": 4096, "h": 2924, "quad": [[884, 181], [3485, 525], [3582, 1931], [848, 1681]]}},
    "campeao2": {"previa": "img/bg-campeao-v81.jpg", "hi": "img/fundos-5k/campeao.jpg", "mono": False, "impAlto": False, "telao": None},
    "mirante": {"previa": "img/bg-mirantesol.jpg", "hi": "img/fundos-5k/mirantesol.jpg", "mono": False, "impAlto": False, "telao": None},
    "tunel": {"previa": "img/bg-tunel.jpg", "hi": "img/fundos-5k/tunel.jpg", "mono": False, "impAlto": False, "telao": None},
    "podio": {"previa": "img/bg-podio.jpg", "hi": "img/fundos-5k/podio.jpg", "mono": False, "impAlto": False, "telao": None},
}
# acabamento de tela do Telão (fiaTelao), na ordem do canvas
TELAO_FILTRO = {"brilho": 1.04, "contraste": 1.05, "saturacao": 1.06, "blur_min": .3, "blur_div": 2400}


def regras_json():
    return {"versao": VERSAO, "regras": REGRAS, "padrao": PADRAO, "estreito": [ESTREITO_DE, ESTREITO_ATE], "base": BASE,
            "fundos": FUNDOS, "telao_filtro": TELAO_FILTRO, "imp": list(IMP_PX), "medida": LADO_MEDIDA, "alfa": ALFA_CORTE,
            "lado_previa": LADO_PREVIA}


def regra_do_fundo(bg):
    """O que decide a montagem deste fundo (entra na versão da montagem: regra nova = montagem nova)."""
    F = FUNDOS.get(bg) or {}
    return {"r": REGRAS.get(bg) or PADRAO, "e": [ESTREITO_DE, ESTREITO_ATE], "g": F, "f": TELAO_FILTRO if F.get("telao") else None,
            "imp": list(IMP_PX), "q": [Q_PREVIA, Q_IMPRESSAO], "lado": LADO_PREVIA}


def jsround(v):
    """Math.round do JavaScript (meio para cima)."""
    return int(math.floor(v + 0.5))


# ---------------------------------------------------------------- medir (fiaMedir)
# O fiaMedir desenha o recorte num canvas de até 600 px (drawImage com a qualidade padrão) e lê o alfa. Medido contra o
# Chromium com alfa de ruído (16 tamanhos; iguais ponto a ponto nos tamanhos pares, mais de 99% nos ímpares): a redução não
# é um bilinear direto. São duas etapas: 1) a imagem é reduzida ao nível de mip que ainda cobre o destino (lado dividido
# por 2 a cada nível, arredondado para cima): níveis inteiros por média de 2x2 truncada (3 pontos 1-2-1 no lado ímpar) e
# o resto por bilinear em ponto flutuante, arredondado; 2) desse nível para o destino, bilinear de ponto fixo com peso de
# 4 bits, truncado. Com foto de verdade a borda do alfa muda de coluna entre este caminho e um bilinear direto (até 4 px
# no recorte de 2400), por isso a conta é refeita aqui passo a passo.
def _mip_meio(a):
    """Um nível de mip (metade, arredondada para baixo): média truncada de 2x2; no lado ímpar, 3 pontos com pesos 1-2-1."""
    import numpy as np

    def eixo(v, ax):
        n = v.shape[ax]
        m = max(1, n // 2)
        v = np.moveaxis(v, ax, 0)
        if n == 1:
            r, sh = v * 2, 1
        elif n % 2 == 0:
            r, sh = v[0:2 * m:2] + v[1:2 * m:2], 1
        else:
            r, sh = v[0:2 * m:2] + 2 * v[1:2 * m:2] + v[2:2 * m + 1:2], 2
        return np.moveaxis(r, 0, ax), sh
    r, s1 = eixo(a.astype(np.uint16), 0)               # a soma de até 16 pontos de 8 bits cabe em 16 bits
    r, s2 = eixo(r, 1)
    return (r >> (s1 + s2)).astype(np.uint8)


def _bil_flutuante(a, w, h):
    """Bilinear em float32, amostra no centro do ponto, borda repetida, arredondado (a redução até o nível de mip)."""
    import numpy as np
    H0, W0 = a.shape
    if (W0, H0) == (w, h):
        return a.astype(np.int32)
    F = np.float32

    def eixo(n0, n):
        p = (np.arange(n, dtype=np.float32) + F(.5)) * (F(n0) / F(n)) - F(.5)
        i0 = np.floor(p)
        return np.clip(i0.astype(np.intp), 0, n0 - 1), np.clip(i0.astype(np.intp) + 1, 0, n0 - 1), (p - i0).astype(np.float32)
    x0, x1, fx = eixo(W0, w)
    y0, y1, fy = eixo(H0, h)
    v = a.astype(np.float32) / F(255)
    fx, fy = fx[None, :], fy[:, None]
    lin0, lin1 = v[y0], v[y1]
    r = (lin0[:, x0] * (1 - fx) + lin0[:, x1] * fx) * (1 - fy) + (lin1[:, x0] * (1 - fx) + lin1[:, x1] * fx) * fy
    return np.floor(r * F(255) + F(.5)).astype(np.int32)


def _bil_fixo(a, w, h, box=None):
    """Bilinear de ponto fixo (posição em 16.16 com meio ponto de viés, peso de 4 bits, soma dividida por 256 e truncada):
    o desenho no canvas na qualidade padrão. a: H0 x W0 ou H0 x W0 x C; box = (x0, y0, x1, y1) da origem (padrão: tudo).
    Na horizontal a posição anda somando o passo, como a linha do desenho. Em faixas de 256 linhas."""
    import numpy as np
    H0, W0 = a.shape[:2]
    if box is None and (W0, H0) == (w, h):
        return a.astype(np.int32)
    bx0, by0, bx1, by1 = box or (0, 0, W0, H0)
    F = np.float32

    def monta(fx, n0):
        fx = np.clip(fx, 0, None)
        i0 = np.minimum(fx >> 16, n0 - 1)
        return i0.astype(np.intp), np.minimum(i0 + 1, n0 - 1).astype(np.intp), ((fx >> 12) & 15).astype(np.int32)
    inv = F(bx1 - bx0) / F(w)
    f0 = int(float(F(bx0) + F(.5) * inv) * 4294967296.0) - (1 << 31)
    dx = int(float(inv) * 4294967296.0)
    x0, x1, wx = monta((f0 + np.arange(w, dtype=np.int64) * dx) >> 16, W0)
    inv = F(by1 - by0) / F(h)
    pt = F(by0) + (np.arange(h, dtype=np.float32) + F(.5)) * inv
    y0, y1, wy = monta(np.floor(pt.astype(np.float64) * 65536.0).astype(np.int64) - 32768, H0)
    if a.ndim == 3:
        wx = wx[:, None]
    wx = wx[None]
    out = np.empty((h, w) + a.shape[2:], np.int32)
    for i in range(0, h, 256):
        f = slice(i, min(h, i + 256))
        vy = wy[f][:, None, None] if a.ndim == 3 else wy[f][:, None]
        lin0, lin1 = a[y0[f]].astype(np.int32), a[y1[f]].astype(np.int32)
        out[f] = (lin0[:, x0] * (16 - wx) * (16 - vy) + lin0[:, x1] * wx * (16 - vy) + lin1[:, x0] * (16 - wx) * vy + lin1[:, x1] * wx * vy) >> 8
    return out


def reduzir(a, w, h, box=None):
    """A região box de `a` (uint8, H0 x W0 x C) reduzida a w x h como o drawImage do canvas quando diminui (medido contra o
    Chromium: com imageSmoothingQuality "high" a redução usa o nível de mip inteiro abaixo da escala e bilinear, não um
    filtro largo). Devolve uint8."""
    import numpy as np
    H0, W0 = a.shape[:2]
    x0, y0, x1, y1 = box or (0, 0, W0, H0)
    k = math.sqrt((w / (x1 - x0)) * (h / (y1 - y0)))
    m, q = a, 1
    for _ in range(max(0, int(math.floor(-math.log2(k)))) if k < 1 else 0):
        if min(m.shape[:2]) < 2:
            break
        m, q = _mip_meio(m), q * 2
    fx, fy = m.shape[1] / W0, m.shape[0] / H0
    return np.clip(_bil_fixo(m, w, h, (x0 * fx, y0 * fy, x1 * fx, y1 * fy)), 0, 255).astype(np.uint8)


def _reduz_canvas(a, w, h):
    """O alfa `a` (uint8, H0 x W0) reduzido a w x h como o drawImage do canvas na qualidade padrão (ver o comentário acima)."""
    H0, W0 = a.shape
    if (W0, H0) == (w, h):
        return a

    def lado(n, L):
        return max(1, -(-n // (1 << L)))
    L = 0
    while lado(W0, L + 1) >= w and lado(H0, L + 1) >= h:
        L += 1
    m = a
    if L > 0:
        tw, th = lado(W0, L), lado(H0, L)
        esc = math.sqrt((tw / W0) * (th / H0))
        for _ in range(max(0, int(math.floor(-math.log2(esc)))) if esc < 1 else 0):
            m = _mip_meio(m)
        m = _bil_flutuante(m, tw, th)
    return _bil_fixo(m, w, h)


def medir(alfa):
    """alfa: matriz uint8 (H0 x W0) do recorte. Devolve a medida do grupo (como o fiaMedir) ou None (sem pessoa)."""
    import numpy as np
    H0, W0 = alfa.shape
    k = min(1.0, LADO_MEDIDA / max(W0, H0))
    w, h = max(1, jsround(W0 * k)), max(1, jsround(H0 * k))
    cheio = _reduz_canvas(alfa, w, h) >= ALFA_CORTE
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


# ---------------------------------------------------------------- estreito e layout (fiaEstreito, fiaLayout)
def estreito(R, m):
    """Regra 20 (fiaEstreito): recorte estreito de meio corpo usa a entrada "estreito" do fundo; entre ESTREITO_DE e
    ESTREITO_ATE os números andam em linha reta até a regra "meio". None quando não se aplica."""
    e, b = R.get("estreito"), R.get("meio")
    if not e or not b or not m["trunc"]:
        return None
    q = m["box"]["w"] / m["box"]["h"]
    if not q < ESTREITO_ATE:
        return None
    t = 0 if q <= ESTREITO_DE else (q - ESTREITO_DE) / (ESTREITO_ATE - ESTREITO_DE)

    def mix(x, y):
        return x + (y - x) * t
    return {"corte": mix(e["corte"], b["corte"]), "alt": mix(e["alt"], b["alt"]), "larg": min(b["larg"], mix(e["larg"], b["larg"])),
            "cx": mix(e["cx"], b["cx"]), "estreito": 1 - t}


def layout(m, bg, W, H, rostos=None):
    """Função pura: onde o grupo entra no quadro W x H do fundo bg (coordenadas do recorte em px originais).
    rostos (opcional, frações da altura do recorte): a linha de corte desce até a base de todo rosto com pelo menos 30%
    da altura do maior + 15% dele."""
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
    if modo == "meio":
        r = estreito(R, m) or r
    src = parte(r)
    if modo == "inteiro" and R.get("largo") and src["w"] > src["h"]:   # regra 10 (fundo antigo): hoje nenhuma regra tem "largo"
        modo, r = "largo", R["largo"]
        src = parte(r)
    s = min(r["alt"] * H / src["h"], r["larg"] * W / src["w"])
    dw, dh = src["w"] * s, src["h"] * s
    x = r["cx"] * W - dw / 2
    x = max(0, min(W - dw, x)) if dw <= W else (W - dw) / 2
    return {"modo": modo, "estreito": r.get("estreito") or 0, "corte": r["corte"], "corteFinal": min(1, src["corteFinal"]),
            "zoom": r.get("zoom") or 1, "mono": R.get("mono") or None, "sombra": False, "src": src,
            "dst": {"x": x, "y": H - dh, "w": dw, "h": dh}, "s": s}


# ---------------------------------------------------------------- rostos (fiaRostos + ynDetect) e frente
_yn = {}


def _yn_rede(modelo):
    import cv2
    r = _yn.get(modelo)
    if r is None:
        r = cv2.dnn.readNet(modelo)
        _yn.clear()
        _yn[modelo] = r
    return r


def _yn_nivel(pm, k, niveis):
    """O recorte pré-multiplicado no nível de mip que o canvas usa para desenhar na escala k (como no _reduz_canvas: o
    maior nível que ainda cobre o destino; média de 2x2 truncada). Devolve (matriz uint8, fator x, fator y)."""
    import numpy as np
    H, W = pm.shape[:2]

    def lado(n, L):
        return max(1, -(-n // (1 << L)))
    L = 0
    while L < 8 and lado(W, L + 1) >= W * k - 1e-6 and lado(H, L + 1) >= H * k - 1e-6:
        L += 1
    if L not in niveis:
        m = niveis[max(x for x in niveis if x < L)] if any(x < L for x in niveis) else pm
        for _ in range(L - max([x for x in niveis if x < L] or [0])):
            m = _mip_meio(m).astype(np.uint8)
        niveis[L] = m
    m = niveis[L]
    return m, m.shape[1] / W, m.shape[0] / H


def _yn_regiao(rede, pm, sx, sy, sw, sh, thr, niveis=None):
    """Uma leitura do YuNet (entrada fixa 640x640, BGR 0 a 255) sobre a região sx, sy, sw, sh do recorte pré-multiplicado."""
    import numpy as np
    import cv2
    k = 640 / max(sw, sh)
    dw, dh = max(1, min(640, jsround(sw * k))), max(1, min(640, jsround(sh * k)))
    niv, qx, qy = _yn_nivel(pm, k, niveis if niveis is not None else {0: pm})
    M = np.array([[qx / k, 0, (sx + .5 / k) * qx - .5], [0, qy / k, (sy + .5 / k) * qy - .5]], dtype=np.float64)
    reg = cv2.warpAffine(niv, M, (dw, dh), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
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
        kp = saida["kps_%d" % st].reshape(-1, 10)
        sc = np.sqrt(cl * ob)
        for i in np.nonzero(sc >= thr)[0]:
            r, cc = divmod(int(i), cols)
            b0, b1, b2, b3 = (float(v) for v in bb[i])   # float do Python (o JS faz a conta em double)
            cx, cy = (cc + b0) * st, (r + b1) * st
            w, h = math.exp(b2) * st, math.exp(b3) * st
            pts = [[sx + (float(kp[i, 2 * j]) + cc) * st / k, sy + (float(kp[i, 2 * j + 1]) + r) * st / k] for j in range(5)]
            out.append({"x": sx + (cx - w / 2) / k, "y": sy + (cy - h / 2) / k, "w": w / k, "h": h / k, "score": float(sc[i]), "pts": pts})
    return out


def detectar(cut, modelo, thr=.6):
    """Rostos no recorte em px (YuNet), com os 5 pontos: a mesma leitura do ynDetect do app. Sem o modelo ou sem o
    OpenCV: None (a montagem segue sem rostos, como o catch do fiaRostos)."""
    if not modelo or not os.path.isfile(modelo):
        return None
    try:
        import numpy as np
        rede = _yn_rede(modelo)
        pm = np.asarray(cut if cut.mode == "RGBa" else cut.convert("RGBa"))
        H, W = pm.shape[:2]
        niveis = {0: pm}
        todos = _yn_regiao(rede, pm, 0, 0, W, H, thr, niveis)
        if max(W, H) > 1000:
            tw, th = W * .6, H * .6
            for sx, sy in ((0, 0), (W - tw, 0), (0, H - th), (W - tw, H - th)):
                todos += _yn_regiao(rede, pm, sx, sy, tw, th, thr, niveis)
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
    return fica


def em_fracao(fs, H):
    """Os rostos como o fiaRostos os entrega ao layout: frações da altura do recorte."""
    return None if fs is None else [{"top": f["y"] / H, "bot": (f["y"] + f["h"]) / H, "h": f["h"] / H} for f in fs]


def rostos(cut, modelo, thr=.6):
    """Rostos no recorte (YuNet), em frações da altura: [{"top","bot","h"}]; None sem o modelo."""
    return em_fracao(detectar(cut, modelo, thr), cut.size[1])


def frente(fs):
    """Foto de frente (critério do agente, ler_rostos detalhe=True): rosto principal = largura >= 50% do maior; de frente =
    nariz a até Q_FRONTAL da distância entre os olhos, medido do meio deles. ok = há rosto principal e todos estão de frente.
    fs = detectar(...); None (sem modelo) devolve None. Na E1 só mede: ninguém decide com isso."""
    if fs is None:
        return None
    if not fs:
        return {"rostos": 0, "frontais": 0, "ok": False}
    maior = max(f["w"] for f in fs)
    n = fr = 0
    for f in fs:
        if f["w"] < FRENTE_RAZAO * maior:
            continue
        n += 1
        (rx, ry), (lx, ly), (nx, _) = f["pts"][0], f["pts"][1], f["pts"][2]
        dist = math.hypot(lx - rx, ly - ry)
        if dist > 0 and abs(nx - (rx + lx) / 2) <= Q_FRONTAL * dist:
            fr += 1
    return {"rostos": n, "frontais": fr, "ok": n >= 1 and fr == n}


# ---------------------------------------------------------------- desenhar (fiaDesenhar)
def _grupo(cut, src, gw, gh):
    """A parte do recorte (src, px originais) no tamanho gw x gh, em RGBa (uint8, alfa PRÉ-MULTIPLICADO), como o canvas:
    redimensionar com o alfa comum escurece a borda (o recorte tem RGB zerado fora da pessoa). Medido contra o Chromium
    (drawImage com imageSmoothingQuality "high"): quando diminui, nível de mip + bilinear (reduzir); quando amplia, cúbica."""
    import numpy as np
    from PIL import Image
    pm = cut if cut.mode == "RGBa" else cut.convert("RGBa")
    box = (src["x"], src["y"], src["x"] + src["w"], src["y"] + src["h"])
    if gw < src["w"] or gh < src["h"]:
        return reduzir(np.asarray(pm), gw, gh, box)
    return np.asarray(pm.resize((gw, gh), Image.BICUBIC, box=box))


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
    out = np.empty((H, W, src.shape[2]), np.uint8)
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
    if L["zoom"] < 1:                               # regra 10 (fundo antigo; hoje nenhuma regra tem zoom): o fundo aproxima
        z = L["zoom"]
        quadro = ampliar(np.asarray(plate.convert("RGB")), W, H, (pw * (1 - z) / 2, 0, pw * (1 - z) / 2 + pw * z, ph * z))
    else:
        quadro = np.array((plate if (pw, ph) == (W, H) else plate.resize((W, H), Image.BICUBIC)).convert("RGB"))
    gw, gh = max(1, jsround(max(1, L["dst"]["w"]))), max(1, jsround(max(1, L["dst"]["h"])))
    _cola(quadro, _grupo(cut, L["src"], gw, gh), jsround(L["dst"]["x"]), jsround(L["dst"]["y"]), (L.get("mono") or {}).get("contraste"))
    if L.get("mono") or (FUNDOS.get(bg) or {}).get("mono"):
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
    T = FUNDOS[bg]["telao"]
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


def previa_de(cut):
    """O recorte da prévia: a cópia de até 2400 px que o agente entrega em lado:2400 (rec_fazer: thumbnail com LANCZOS)."""
    from PIL import Image
    if max(cut.size) <= LADO_PREVIA:
        return cut
    pv = cut.copy()
    pv.thumbnail((LADO_PREVIA, LADO_PREVIA), Image.LANCZOS)
    return pv


class Recorte:
    """Um recorte aberto, nos dois tamanhos (3000 = impressão, 2400 = prévia), com o que é caro de refazer guardado:
    a cópia pré-multiplicada, a medida de cada tamanho e os rostos (lidos uma vez, na cópia da prévia, como o app faz:
    FIA_ROSTOS guarda por foto, em fração da altura)."""

    def __init__(self, cut):
        self.im = {"hi": cut}
        self.pm, self.m, self._det, self._lido = {}, {}, None, False

    def cut(self, t):
        if t not in self.im:
            self.im[t] = previa_de(self.im["hi"])
        return self.im[t]

    def pre(self, t):
        if t not in self.pm:
            self.pm[t] = self.cut(t).convert("RGBa")
        return self.pm[t]

    def medida(self, t):
        import numpy as np
        if t not in self.m:
            self.m[t] = medir(np.asarray(self.cut(t).getchannel("A")))
        return self.m[t]

    def detectados(self, yunet):
        if not self._lido:
            self._det, self._lido = detectar(self.pre("pv"), yunet), True
        return self._det

    def rostos(self, yunet):
        return em_fracao(self.detectados(yunet), self.cut("pv").size[1])


_recortes = {}                                      # caminho -> (mtime, tamanho, Recorte)
_fundos = {}                                        # caminho -> (mtime, tamanho, imagem RGB)


def recorte_mem(caminho):
    st = os.stat(caminho)
    v = _recortes.pop(caminho, None)
    if v is None or v[0] != st.st_mtime or v[1] != st.st_size:
        v = (st.st_mtime, st.st_size, Recorte(abrir_recorte(caminho)))
    _recortes[caminho] = v
    while len(_recortes) > RECORTES_MEM:
        _recortes.pop(next(iter(_recortes)))
    return v[2]


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


def montar(cut, plate, bg, yunet=None, m=None, rostos_dados=None, ms=None, rostos_fn=None, pm=None):
    """A montagem do recorte `cut` (RGBA) no fundo `plate` (RGB) com as regras de `bg`. Devolve (matriz uint8, layout).
    m e rostos_dados só nos testes (medida e rostos vindos do navegador); rostos_fn e pm vêm do Recorte guardado.
    ValueError("sem_pessoa") sem grupo."""
    import numpy as np
    ms = ms if ms is not None else {}
    t = time.time()
    if m is None:
        m = medir(np.asarray(cut.getchannel("A")))
    ms["medir"] = ms.get("medir", 0) + int((time.time() - t) * 1000)
    if not m:
        raise ValueError("sem_pessoa")
    W, H = plate.size
    r0 = ms.get("rostos", 0)
    ms["rostos"] = r0

    def ro():
        t0 = time.time()
        r = rostos_dados if rostos_dados is not None else rostos_fn() if rostos_fn else rostos(cut, yunet)
        ms["rostos"] += int((time.time() - t0) * 1000)
        return r
    t = time.time()
    g = pm if pm is not None else cut
    if (FUNDOS.get(bg) or {}).get("telao"):
        img, L = telao(plate, g, m, bg, ro)
    else:
        L = layout(m, bg, W, H)
        if L["corte"] < 1:
            r = ro()
            if r:
                L = layout(m, bg, W, H, r)
            L["rostos"] = len(r) if r is not None else None
        L["bg"] = bg
        img = desenhar(plate, g, L, W, H, bg)
    ms["montar"] = ms.get("montar", 0) + int((time.time() - t) * 1000) - (ms["rostos"] - r0)
    return img, L


def imprimir_corte(img, bg):
    """Do quadro montado para o 10x15 (1844x1240 deitado; em pé invertido), o corte do fiaMontar hi: centro na horizontal;
    na vertical, Telão no meio (o grupo está na tela, no alto), impAlto preso no alto (Maracanã 1950: o título fica inteiro e
    a sobra sai de baixo) e os outros presos embaixo (o grupo encosta na borda)."""
    from PIL import Image
    im = img if isinstance(img, Image.Image) else Image.fromarray(img)
    W, H = im.size
    ow, oh = IMP_PX if W >= H else (IMP_PX[1], IMP_PX[0])
    k = max(ow / W, oh / H)
    sw, sh = ow / k, oh / k
    F = FUNDOS.get(bg) or {}
    x, y = (W - sw) / 2, ((H - sh) / 2 if F.get("telao") else 0 if F.get("impAlto") else H - sh)
    import numpy as np
    return Image.fromarray(reduzir(np.asarray(im), ow, oh, (x, y, x + sw, y + sh)))   # como o canvas reduz (nível de mip + bilinear)


# ---------------------------------------------------------------- processo: caminhos, gravação, protocolo
_re_arquivo = re.compile(r"^[a-z0-9]{2,40}-[0-9a-f]{8}-[pif]\.jpg$")
_re_bg = re.compile(r"^[a-z0-9]{2,40}$")


def dentro(caminho, pasta):
    try:
        c, p = os.path.realpath(caminho), os.path.realpath(pasta)
        return os.path.commonpath([c, p]) == p and c != p
    except (OSError, ValueError):
        return False


def destino_ok(caminho, montagens, bg):
    """Destino só <montagens>/<pasta da foto>/<fundo>-<8 hex>-<p|i|f>.jpg, com a pasta de verdade logo abaixo de montagens
    (sem link para fora) e o nome do fundo pedido."""
    if not caminho or not _re_arquivo.match(os.path.basename(caminho)) or not os.path.basename(caminho).startswith(bg + "-"):
        return False
    pasta = os.path.dirname(caminho)
    try:
        if os.path.dirname(os.path.realpath(pasta)) != os.path.realpath(montagens):
            return False
    except (OSError, ValueError):
        return False
    return not os.path.islink(caminho) and not os.path.islink(pasta)


def gravar_jpeg(im, destino, q):
    """JPEG sem EXIF, por arquivo temporário na mesma pasta (mkstemp) + os.replace; pasta da foto 750, arquivo 600.
    Devolve o tamanho em bytes."""
    pasta = os.path.dirname(destino)
    os.makedirs(pasta, mode=0o750, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".mtg-", suffix=".tmp", dir=pasta)
    try:
        with os.fdopen(fd, "wb") as f:
            im.save(f, "JPEG", quality=q, optimize=False)
        try:
            os.chmod(tmp, 0o600)
        except OSError:
            pass
        n = os.path.getsize(tmp)
        os.replace(tmp, destino)
        return n
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


def _abre(fn, caminho, erro):
    try:
        return fn(caminho)
    except ValueError as ex:
        raise ValueError(str(ex) if str(ex) == "imagem_grande" else erro)
    except MemoryError:
        raise
    except Exception:
        raise ValueError(erro)


def op_montar(j, pastas):
    """Uma base num fundo: a prévia (p: recorte de 2400 no fundo de prévia, tamanho natural dele, JPEG 90) e/ou a
    impressão (i: recorte de 3000 no fundo de 5000 px, cortada em 10x15, JPEG 92). Devolve também a medida de frente."""
    from PIL import Image
    t0 = time.time()
    bg = str(j.get("fundo") or "")
    rec = str(j.get("recorte") or "")
    fp, fh = str(j.get("previa_fundo") or ""), str(j.get("hi_fundo") or "")
    dp, di = j.get("p") or None, j.get("i") or None
    yunet = j.get("yunet") or None
    if not _re_bg.match(bg) or bg not in FUNDOS or not dentro(rec, pastas["recortes"]) or (not dp and not di) \
            or (dp and not (dentro(fp, pastas["fundos"]) and destino_ok(str(dp), pastas["montagens"], bg))) \
            or (di and not (dentro(fh, pastas["fundos"]) and destino_ok(str(di), pastas["montagens"], bg))) \
            or (yunet and not (pastas.get("modelos") and dentro(str(yunet), pastas["modelos"]))):
        raise ValueError("caminho_recusado")
    yunet = str(yunet) if yunet else None
    ms = {"medir": 0, "rostos": 0, "montar": 0, "gravar": 0}
    R = _abre(recorte_mem, rec, "recorte")
    plates = {}
    if dp:
        plates["pv"] = _abre(abrir_fundo, fp, "fundo")
    if di:
        plates["hi"] = _abre(abrir_fundo, fh, "fundo")
    ms["abrir"] = int((time.time() - t0) * 1000)
    out = {"ok": True, "bytes": {}}
    L = None
    for t, destino in (("pv", dp), ("hi", di)):
        if not destino:
            continue
        ta = time.time()
        m = R.medida(t)
        ms["medir"] += int((time.time() - ta) * 1000)
        if not m:
            raise ValueError("sem_pessoa")
        img, Lt = montar(R.cut(t), plates[t], bg, m=m, ms=ms, rostos_fn=lambda: R.rostos(yunet), pm=R.pre(t))
        tg = time.time()
        im = Image.fromarray(img)
        if t == "pv":
            out["w"], out["h"] = im.size
            out["bytes"]["p"] = gravar_jpeg(im, str(destino), Q_PREVIA)
            L = Lt
        else:
            im = imprimir_corte(im, bg)
            out["bytes"]["i"] = gravar_jpeg(im, str(destino), Q_IMPRESSAO)
            L = L or Lt
        ms["gravar"] += int((time.time() - tg) * 1000)
    tr = time.time()
    fr = frente(R.detectados(yunet))                # lido uma vez por recorte (fica guardado para os outros fundos)
    ms["rostos"] += int((time.time() - tr) * 1000)
    mp = R.medida("pv")
    ms["total"] = int((time.time() - t0) * 1000)
    out.update(layout={"modo": L["modo"], "estreito": round(L.get("estreito") or 0, 4), "corteFinal": round(L["corteFinal"], 4),
                       "rostos": L.get("rostos")},
               frente=fr, medida={"trunc": bool(mp["trunc"]), "q": round(mp["box"]["w"] / mp["box"]["h"], 4)} if mp else None,
               ms=ms, pico_mb=pico_mb())
    return out


ERROS = ("sem_pessoa", "fundo", "recorte", "imagem_grande", "caminho_recusado", "interno")


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
            os.nice(10)                            # prioridade baixa: a placa e o processador ficam com o recorte e a chegada
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
            if j.get("op") != "montar":
                raise ValueError("interno")
            r = op_montar(j, pastas)
            r["id"] = rid
            manda(r)
        except ValueError as ex:
            manda({"id": rid, "ok": False, "erro": str(ex) if str(ex) in ERROS else "interno"})
        except MemoryError:
            _recortes.clear()
            _fundos.clear()
            manda({"id": rid, "ok": False, "erro": "interno", "memoria": True})
        except Exception as ex:
            print("montagem: %s" % type(ex).__name__, file=sys.stderr)   # nunca o caminho nem o id
            manda({"id": rid, "ok": False, "erro": "interno"})
    return 0


def teste(manda):
    """Só para os testes de paridade (testes/montagem-paridade.js): lê do stdin uma lista JSON de pedidos e grava PNG sem
    perdas; uma linha de resposta por pedido.
    {"recorte","fundo","bg","saida"?,"impressao"?,"reduzir"?,"m"?,"rostos"?,"yunet"?,"so_medir"?,"so_rostos"?,"so_frente"?,"so_layout"?}
    reduzir = o caminho do servidor para a prévia: o recorte de 3000 vira o de 2400 em memória antes de medir e montar."""
    import numpy as np
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    pedidos = json.loads(sys.stdin.read())
    for j in pedidos if isinstance(pedidos, list) else [pedidos]:
        try:
            cut = abrir_recorte(j["recorte"])
            if j.get("reduzir"):
                cut = previa_de(cut)
            if j.get("so_rostos"):
                manda({"ok": True, "rostos": rostos(cut, j.get("yunet"))})
                continue
            if j.get("so_frente"):
                manda({"ok": True, "frente": frente(detectar(cut, j.get("yunet")) if "detectados" not in j else j["detectados"])})
                continue
            m = medir(np.asarray(cut.getchannel("A")))
            if j.get("so_medir"):
                manda({"ok": True, "m": m and {k: m[k] for k in ("W", "H", "w", "h", "k", "box", "trunc") + (("rows",) if j.get("linhas") else ())}})
                continue
            plate = abrir_fundo(j["fundo"])
            if j.get("so_layout"):                 # P1: a função pura com a medida e os rostos do navegador
                W, H = plate.size
                tela = None
                if FUNDOS.get(j["bg"], {}).get("telao"):
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
            manda({"ok": True, "w": img.shape[1], "h": img.shape[0], "layout": L, "ms": ms, "pico_mb": pico_mb()})
        except ValueError as ex:
            manda({"ok": False, "erro": str(ex)})
    return 0


if __name__ == "__main__":
    sys.exit(main())
