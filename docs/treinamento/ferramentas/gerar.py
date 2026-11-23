# -*- coding: utf-8 -*-
"""Manuais (Word) e apresentações (PowerPoint) dos treinamentos, no mesmo padrão:
   conteudo_video.py (Drone, Chute a Gol e Snap Pop) e conteudo_fotos.py (Fotos do Tour).
   Rodar de docs/treinamento:  python ferramentas/gerar.py
   Usa os prints marcados em prints/ (capturar.js, capturar-fotos.js + marcar.py). Gera entregaveis/*.docx e *.pptx."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from docx.shared import Pt, Cm
from docx_maracatour import Manual, AZUL
from pptx import Presentation
from pptx.util import Cm as PCm, Pt as PPt
from pptx.dml.color import RGBColor as PRGB
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

import re
import conteudo_video, conteudo_fotos


def larg(chave, cheia=15.5, alta=7.5):
    w, h = Image.open(os.path.join("prints", chave + ".jpg")).size
    return alta if h / w > 1.3 else (11.0 if h / w > 0.75 else cheia)


# ---------------------------------------------------------------- manual (Word)
def manual(C):
    d = Manual()
    d.capa(C.TITULO, C.SUB + "\nManual da equipe", "Versão %s · %s" % (C.VERSAO, C.DATA))
    d.h1("Como funciona")
    d.h2("O caminho de cada venda")
    d.tabela(["Etapa", "Quem", "Onde", "O que acontece"], C.ETAPAS, [2.8, 3.2, 3.4, 7.0])
    d.h2("Regras")
    for i, r in enumerate(C.REGRAS, 1):
        d.acao(str(i), r)
    d.d.add_paragraph()
    if getattr(C, "COLUNAS", None):
        d.h2("As colunas da fila de entrega")
        d.tabela(["Drone", "Chute a Gol / Snap Pop", "O que significa"], C.COLUNAS, [3.6, 4.0, 8.8])
    if getattr(C, "TABELA", None):
        t, cab, linhas, larg_ = C.TABELA
        d.h2(t)
        d.tabela(cab, linhas, larg_)
    d.quebra()
    for titulo, blocos in C.SECOES:
        d.h1(titulo)
        for chave, t, leg, passos in blocos:
            d.h2(t)
            if chave:
                d.fig(chave, leg, larg(chave))
            for n, p in enumerate(passos, 1):
                d.acao(str(n), p)
            d.d.add_paragraph()
        d.quebra()
    d.h1("Treino: simulando o dia")
    d.para("O treino usa o servidor de teste, com vendas de mentira, do começo ao fim.")
    for papel, itens in C.TREINO:
        d.h2(papel)
        for n, x in enumerate(itens, 1):
            d.acao(str(n), x)
        d.d.add_paragraph()
    d.h1("Problemas comuns")
    d.tabela(["Situação", "O que fazer"], C.PROBLEMAS, [5.0, 11.4])
    d.salvar("Manual - %s.docx" % C.ARQUIVO)


# ---------------------------------------------------------------- apresentação (PowerPoint)
NAVY, AMAR, BRANCO, CINZA, CLARO = PRGB(0x12, 0x3A, 0x73), PRGB(0xFF, 0xB8, 0x00), PRGB(255, 255, 255), PRGB(0x55, 0x5F, 0x6D), PRGB(0xF3, 0xF5, 0xF8)
W, H = PCm(33.867), PCm(19.05)


def caixa(sl, x, y, w, h, cor, forma=MSO_SHAPE.RECTANGLE):
    s = sl.shapes.add_shape(forma, x, y, w, h)
    s.fill.solid(); s.fill.fore_color.rgb = cor; s.line.fill.background(); s.shadow.inherit = False
    return s


def texto(sl, x, y, w, h, linhas, tam=20, cor=NAVY, negrito=False, alin=PP_ALIGN.LEFT, ancora=MSO_ANCHOR.TOP, fonte="Segoe UI"):
    tb = sl.shapes.add_textbox(x, y, w, h); tf = tb.text_frame; tf.word_wrap = True; tf.vertical_anchor = ancora
    tf.margin_left = tf.margin_right = PCm(0.1)
    for i, l in enumerate(linhas if isinstance(linhas, list) else [linhas]):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph(); p.alignment = alin
        for j, tr in enumerate(l.split("**")):
            r = p.add_run(); r.text = tr; r.font.size = PPt(tam); r.font.color.rgb = cor; r.font.name = fonte; r.font.bold = negrito or j % 2 == 1
        p.space_after = PPt(tam * 0.5)
    return tb


def topo(sl, t, sub=None):
    caixa(sl, 0, 0, W, PCm(2.6), NAVY); caixa(sl, 0, PCm(2.6), W, PCm(0.18), AMAR)
    texto(sl, PCm(1.2), PCm(0.35), PCm(28), PCm(1.4), t.upper(), 30, BRANCO, True, fonte="Segoe UI Black")
    if sub:
        texto(sl, PCm(1.2), PCm(1.65), PCm(28), PCm(0.9), sub, 13, AMAR)


def num(sl, x, y, n, d=PCm(1.0)):
    c = caixa(sl, x, y, d, d, PRGB(0xD7, 0x19, 0x19), MSO_SHAPE.OVAL)
    tf = c.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER; r = p.add_run(); r.text = str(n); r.font.size = PPt(14); r.font.bold = True; r.font.color.rgb = BRANCO
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE


def tela(prs, secao, chave, t, passos):
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, t, secao)
    caixa(sl, 0, PCm(2.78), W, H - PCm(2.78), CLARO)
    if not chave:  # passo sem print (ex.: configurar o Windows): texto na largura toda
        y = PCm(4.0)
        for n, p in enumerate(passos, 1):
            num(sl, PCm(1.2), y, n)
            texto(sl, PCm(2.6), y - PCm(0.1), PCm(29.5), PCm(3.0), p, 19, NAVY)
            y += PCm(0.5 + 0.9 * -(-len(p.replace('**', '')) // 95))
        return sl
    img = os.path.join("prints", chave + ".jpg"); iw, ih = Image.open(img).size
    bx, by, bw, bh = PCm(15.2), PCm(3.4), PCm(17.6), PCm(15.0)
    esc = min(bw / iw, bh / ih); w, h = int(iw * esc), int(ih * esc)
    pic = sl.shapes.add_picture(img, bx + (bw - w) // 2, by + (bh - h) // 2, w, h); pic.line.color.rgb = PRGB(0xD0, 0xD6, 0xDE)
    y = PCm(3.8)
    for n, p in enumerate(passos, 1):
        num(sl, PCm(1.2), y, n)
        tb = texto(sl, PCm(2.6), y - PCm(0.1), PCm(11.8), PCm(3.2), p, 17, NAVY)
        linhas = -(-len(p.replace('**', '')) // 40)
        y += PCm(0.35 + 0.78 * linhas)
    return sl


def tabela_slide(sl, cab, linhas, larguras, tam=13):
    t = sl.shapes.add_table(len(linhas) + 1, len(cab), PCm(1.2), PCm(3.6), PCm(sum(larguras)), PCm(14)).table
    for j, w in enumerate(larguras):
        t.columns[j].width = PCm(w)
    for j, c0 in enumerate(cab):
        c = t.cell(0, j); c.text = c0; c.fill.solid(); c.fill.fore_color.rgb = NAVY
        r = c.text_frame.paragraphs[0].runs[0]; r.font.size = PPt(15); r.font.bold = True; r.font.color.rgb = BRANCO
    for i, lin in enumerate(linhas, 1):
        for j, v in enumerate(lin):
            c = t.cell(i, j); c.text = v; c.fill.solid(); c.fill.fore_color.rgb = CLARO if i % 2 else BRANCO
            r = c.text_frame.paragraphs[0].runs[0]; r.font.size = PPt(tam); r.font.color.rgb = NAVY; r.font.bold = j == 0


def apresentacao(C):
    prs = Presentation(); prs.slide_width, prs.slide_height = W, H
    # capa
    sl = prs.slides.add_slide(prs.slide_layouts[6]); caixa(sl, 0, 0, W, H, NAVY); caixa(sl, 0, PCm(12.2), W, PCm(0.25), AMAR)
    texto(sl, PCm(2), PCm(4.2), PCm(30), PCm(3), C.TITULO.upper(), 46, BRANCO, True, fonte="Segoe UI Black")
    texto(sl, PCm(2), PCm(7.6), PCm(30), PCm(2), C.SUB, 28, AMAR)
    texto(sl, PCm(2), PCm(13.2), PCm(30), PCm(2), ["Treinamento da equipe", "Versão %s · %s" % (C.VERSAO, C.DATA)], 16, BRANCO)
    # o caminho
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "O caminho de cada venda", "Quatro etapas, quatro telas")
    for i, (et, quem, onde, oque) in enumerate(C.ETAPAS):
        x = PCm(1.2 + i * 8.15)
        c = caixa(sl, x, PCm(4.0), PCm(7.4), PCm(12.6), CLARO, MSO_SHAPE.ROUNDED_RECTANGLE); c.adjustments[0] = 0.06
        caixa(sl, x, PCm(4.0), PCm(7.4), PCm(0.35), AMAR)
        num(sl, x + PCm(0.5), PCm(4.9), i + 1, PCm(1.3))
        texto(sl, x + PCm(0.5), PCm(6.6), PCm(6.5), PCm(1.4), et, 22, NAVY, True)
        texto(sl, x + PCm(0.5), PCm(8.1), PCm(6.5), PCm(2), ["**" + quem + "**", onde], 14, CINZA)
        texto(sl, x + PCm(0.5), PCm(10.6), PCm(6.5), PCm(5.5), oque, 15, NAVY)
        if i < 3:
            a = caixa(sl, x + PCm(7.45), PCm(9.8), PCm(0.65), PCm(1.0), AMAR, MSO_SHAPE.RIGHT_ARROW)
    # regras
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "Regras", "Valem para todo mundo")
    # altura de cada linha de regras pelo texto mais longo das duas colunas; letra menor se não couber
    for tam, cpl, alt in ((13.5, 64, 0.62), (12, 72, 0.55), (11, 80, 0.5), (10, 88, 0.46)):
        lin_ = [max(-(-len(r.replace("**", "")) // cpl) for r in C.REGRAS[k:k + 2]) for k in range(0, len(C.REGRAS), 2)]
        if sum(n * alt + 0.45 for n in lin_) <= 14.8:
            break
    y = 3.7
    for k, n in enumerate(lin_):
        for col, r in enumerate(C.REGRAS[2 * k:2 * k + 2]):
            x = PCm(1.2 + col * 16.2)
            num(sl, x, PCm(y), 2 * k + col + 1)
            texto(sl, x + PCm(1.4), PCm(y - 0.15), PCm(14.3), PCm(n * alt + 0.3), r, tam, NAVY)
        y += n * alt + 0.45
    # colunas da fila (vídeo) ou tabela da seção 1 (fotos: pacotes)
    if getattr(C, "TABELA", None):
        tt, cab, linhas, _ = C.TABELA
        sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, tt)
        tabela_slide(sl, cab, linhas, [10.4, 15.0, 6.0])
    cores = [PRGB(0xE8, 0xEE, 0xF7), PRGB(0xE3, 0xEC, 0xFA), PRGB(0xFF, 0xF4, 0xD6), PRGB(0xE4, 0xF4, 0xE6)]
    if getattr(C, "COLUNAS", None):
        sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "A fila de entrega", "Uma fila por serviço, como a fila das fotos")
    for i, (dr, cs, oq) in enumerate(getattr(C, "COLUNAS", None) or []):
        x = PCm(1.2 + i * 8.15)
        caixa(sl, x, PCm(4.0), PCm(7.4), PCm(12.6), cores[i], MSO_SHAPE.ROUNDED_RECTANGLE).adjustments[0] = 0.06
        texto(sl, x + PCm(0.5), PCm(4.6), PCm(6.5), PCm(2.2), dr.upper(), 20, NAVY, True, fonte="Segoe UI Black")
        texto(sl, x + PCm(0.5), PCm(6.9), PCm(6.5), PCm(1.4), "Chute a Gol / Snap Pop: " + cs, 12, CINZA)
        texto(sl, x + PCm(0.5), PCm(9.0), PCm(6.5), PCm(7), oq, 16, NAVY)
    for secao, blocos in C.SECOES:
        sl = prs.slides.add_slide(prs.slide_layouts[6]); caixa(sl, 0, 0, W, H, NAVY); caixa(sl, PCm(2), PCm(10.6), PCm(6), PCm(0.25), AMAR)
        texto(sl, PCm(2), PCm(6.5), PCm(30), PCm(4), secao.upper(), 44, BRANCO, True, fonte="Segoe UI Black")
        for chave, t, leg, passos in blocos:
            tela(prs, secao, chave, t, [re.sub(r" \(seção \d+\)", "", p) for p in passos])
    # treino
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "Treino: simulando o dia", "No servidor de teste, com vendas de mentira")
    for i, (papel, itens) in enumerate(C.TREINO):
        x = PCm(1.2 + i * 8.15)
        caixa(sl, x, PCm(3.6), PCm(7.4), PCm(14.6), CLARO, MSO_SHAPE.ROUNDED_RECTANGLE).adjustments[0] = 0.05
        texto(sl, x + PCm(0.4), PCm(4.0), PCm(6.6), PCm(1.3), papel.upper(), 18, NAVY, True, fonte="Segoe UI Black")
        texto(sl, x + PCm(0.4), PCm(5.6), PCm(6.6), PCm(12.4), ["• " + t for t in itens], 13.5, NAVY)
    # problemas
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "Problemas comuns", "O que fazer quando")
    tabela_slide(sl, ("Situação", "O que fazer"), C.PROBLEMAS, [10.4, 21.0], 13 if len(C.PROBLEMAS) <= 10 else 12)
    os.makedirs("entregaveis", exist_ok=True)
    nome = os.path.join("entregaveis", "Treinamento - %s.pptx" % C.ARQUIVO)
    prs.save(nome); print("gerado:", nome)


if __name__ == "__main__":
    for C in (conteudo_video, conteudo_fotos):
        manual(C)
        apresentacao(C)
