# -*- coding: utf-8 -*-
"""Fotos fictícias para os prints dos manuais: as sprites de demonstração do app são fotos de clientes de verdade e não podem
aparecer em material de treinamento. Gera folhas do mesmo tamanho e grade (360x240 por foto, 6 colunas), com o estádio vazio
dos fundos do app (img/bg-*.jpg) e silhuetas no lugar das pessoas.
   python ferramentas/sprites_ficticias.py <pasta de saída>     (rodar de docs/treinamento)"""
import json, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..")
SAIDA = sys.argv[1]
os.makedirs(SAIDA, exist_ok=True)
html = open(os.path.join(RAIZ, "index.html"), encoding="utf-8").read()
i = html.index("const DATA=")
DATA = json.loads(html[i + 11:html.index("\n", i)].rstrip(";"))
FUNDOS = [os.path.join(RAIZ, "img", f) for f in ("bg-mirante.jpg", "bg-telao.jpg", "bg-gramado1950.jpg", "bg-maracana1950.jpg",
                                                 "bg-terraco.jpg", "bg-mirantedia.jpg", "bg-arq1950.jpg", "bg-escanteio1950.jpg")]
FUNDOS = [Image.open(f).convert("RGB") for f in FUNDOS if os.path.exists(f)]
CAMISAS = [(200, 30, 40), (240, 240, 240), (30, 60, 150), (250, 200, 30), (20, 20, 20), (30, 130, 70)]
rnd = random.Random(42)


def pessoa(d, x, base, alt, cor):
    cab = alt * 0.13
    d.ellipse((x - cab, base - alt, x + cab, base - alt + 2 * cab), fill=(120, 132, 150))
    d.rounded_rectangle((x - alt * 0.2, base - alt + 2.1 * cab, x + alt * 0.2, base - alt * 0.38), radius=int(alt * 0.06), fill=cor)
    d.rectangle((x - alt * 0.16, base - alt * 0.38, x + alt * 0.16, base), fill=(40, 44, 56))


def foto(n):
    f = rnd.choice(FUNDOS)
    w, h = f.size
    k = min(w / 360, h / 240) * rnd.uniform(0.55, 0.9)
    cw, ch = int(360 * k), int(240 * k)
    x0, y0 = rnd.randint(0, w - cw), rnd.randint(0, h - ch)
    im = f.crop((x0, y0, x0 + cw, y0 + ch)).resize((360, 240)).filter(ImageFilter.GaussianBlur(0.6))
    d = ImageDraw.Draw(im)
    gente = rnd.choice([1, 2, 2, 3, 4])
    xs = [180 + (j - (gente - 1) / 2) * 62 for j in range(gente)]
    for j, x in enumerate(xs):
        pessoa(d, x + rnd.uniform(-8, 8), 236, rnd.uniform(150, 190) * (0.85 if j % 2 else 1), rnd.choice(CAMISAS))
    return im


for c in DATA["chunks"]:
    linhas = -(-len(c["items"]) // c["cols"])
    folha = Image.new("RGB", (360 * c["cols"], 240 * linhas), (28, 28, 30))
    for n, _ in enumerate(c["items"]):
        folha.paste(foto(n), ((n % c["cols"]) * 360, (n // c["cols"]) * 240))
    folha.save(os.path.join(SAIDA, c["file"]), "WEBP", quality=82)
    print("ok", c["file"], folha.size)
