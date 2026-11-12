# -*- coding: utf-8 -*-
"""Marcação dos prints dos manuais: caixa vermelha no alvo + seta com o número do passo.

Cada marca é ((x0, y0, x1, y1), direção de onde vem a seta, número). Direção vazia = só a caixa.
Áreas em "borrar" escondem dados que não devem aparecer (outros clientes, e-mails de teste).
Coordenadas sempre na imagem original; o recorte é aplicado no fim.
"""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

VERMELHO = (215, 25, 25)
SETA = 95  # comprimento da seta, em px da imagem original
DIRECOES = {"esquerda": (-1, 0), "direita": (1, 0), "cima": (0, -1), "baixo": (0, 1)}


def _seta(d, ponta, cauda, largura=6):
    d.line([cauda, ponta], fill=VERMELHO, width=largura)
    ang = math.atan2(ponta[1] - cauda[1], ponta[0] - cauda[0])
    tam = 22
    p1 = (ponta[0] - tam * math.cos(ang - 0.45), ponta[1] - tam * math.sin(ang - 0.45))
    p2 = (ponta[0] - tam * math.cos(ang + 0.45), ponta[1] - tam * math.sin(ang + 0.45))
    d.polygon([ponta, p1, p2], fill=VERMELHO)


def marcar(origem, destino, recorte, marcas, borrar=()):
    im = Image.open(origem).convert("RGB")
    for area in borrar:
        im.paste(im.crop(area).filter(ImageFilter.GaussianBlur(9)), area[:2])
    d = ImageDraw.Draw(im)
    fonte = ImageFont.truetype("arialbd.ttf", 24)
    for (x0, y0, x1, y1), direcao, numero in marcas:
        d.rectangle((x0 - 4, y0 - 4, x1 + 4, y1 + 4), outline=VERMELHO, width=4)
        if not direcao:
            continue
        dx, dy = DIRECOES[direcao]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # ponta na borda da caixa, do lado de onde vem a seta
        ponta = (cx + dx * ((x1 - x0) / 2 + 8), cy + dy * ((y1 - y0) / 2 + 8))
        cauda = (ponta[0] + dx * SETA, ponta[1] + dy * SETA)
        # mantém a seta dentro do recorte
        cauda = (min(max(cauda[0], recorte[0] + 22), recorte[2] - 22),
                 min(max(cauda[1], recorte[1] + 22), recorte[3] - 22))
        _seta(d, ponta, cauda)
        if numero:
            r = 19
            d.ellipse((cauda[0] - r, cauda[1] - r, cauda[0] + r, cauda[1] + r), fill=VERMELHO,
                      outline="white", width=3)
            w = d.textlength(numero, font=fonte)
            d.text((cauda[0] - w / 2, cauda[1] - 14), numero, font=fonte, fill="white")
    im.crop(recorte).save(destino, quality=92)
