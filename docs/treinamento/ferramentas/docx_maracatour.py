# -*- coding: utf-8 -*-
"""Base comum dos manuais em .docx dos processos do Comercial (B2B, gratuidade).

Cada projeto tem o seu gerar-tutoriais.py com o conteúdo; aqui ficam só a
classe Doc (capa, títulos numerados, passos que recomeçam, links clicáveis,
tabelas, prints) e o gerador de QR Code. Os caminhos (prints/, entregaveis/)
são relativos à pasta de onde o script do projeto é executado.
"""
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

AZUL = RGBColor(0x1F, 0x4E, 0x79)
CINZA = RGBColor(0x59, 0x59, 0x59)

PASTA_PRINTS = "prints"


def gerar_qrcode(url, titulo, destino):
    """QR Code com título e link embaixo, pronto para impressão."""
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=12, border=3)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color=(0x1F, 0x4E, 0x79), back_color="white").convert("RGB")
    w, h = img.size
    try:
        f_tit = ImageFont.truetype("calibrib.ttf", 34)
        f_url = ImageFont.truetype("calibri.ttf", 24)
    except OSError:
        f_tit = f_url = ImageFont.load_default()
    tela = Image.new("RGB", (w, h + 110), "white")
    tela.paste(img, (0, 0))
    d = ImageDraw.Draw(tela)
    for txt, fonte, y, cor in ((titulo, f_tit, h + 8, (0x1F, 0x4E, 0x79)),
                               (url.replace("https://", ""), f_url, h + 58, (0x59, 0x59, 0x59))):
        largura = d.textlength(txt, font=fonte)
        d.text(((w - largura) / 2, y), txt, font=fonte, fill=cor)
    os.makedirs(os.path.dirname(destino) or ".", exist_ok=True)
    tela.save(destino)


class Doc(object):
    """Envelope fino sobre python-docx com os helpers do projeto."""

    def __init__(self):
        self.d = Document()
        self.d.styles["Normal"].font.name = "Calibri"
        self.d.styles["Normal"].font.size = Pt(11)
        self.d.styles["Normal"].paragraph_format.space_after = Pt(6)
        self._n1 = 0
        self._n2 = 0
        self._lista = None  # numeração da lista numerada em andamento

    def _nova_lista(self):
        """Cria uma numeração nova que recomeça em 1, sobre o estilo List Number."""
        numbering = self.d.part.numbering_part.element
        num_estilo = self.d.styles["List Number"].element.pPr.numPr.numId.val
        abstrato = numbering.num_having_numId(num_estilo).abstractNumId.val
        num = numbering.add_num(abstrato)
        num.add_lvlOverride(ilvl=0).add_startOverride(1)
        return num.numId

    def __getattribute__(self, nome):
        # qualquer elemento que não seja passo encerra a lista numerada atual
        if nome in ("h1", "h2", "para", "bullet", "quebra", "figura", "print_aqui", "tabela", "link"):
            object.__setattr__(self, "_lista", None)
        return object.__getattribute__(self, nome)

    def h1(self, texto):
        self._n1 += 1
        self._n2 = 0
        p = self.d.add_heading("%d. %s" % (self._n1, texto), level=1)
        for r in p.runs:
            r.font.color.rgb = AZUL

    def h2(self, texto):
        self._n2 += 1
        p = self.d.add_heading("%d.%d %s" % (self._n1, self._n2, texto), level=2)
        for r in p.runs:
            r.font.color.rgb = AZUL

    def para(self, texto, negrito=False, italico=False, cor=None):
        p = self.d.add_paragraph()
        r = p.add_run(texto)
        r.bold = negrito
        r.italic = italico
        if cor:
            r.font.color.rgb = cor

    def bullet(self, texto, url=None):
        p = self.d.add_paragraph(texto, style="List Bullet")
        if url:
            self._hiperlink(p, url)

    def link(self, url, texto=None):
        """Parágrafo com um link clicável."""
        self._hiperlink(self.d.add_paragraph(), url, texto)

    def _hiperlink(self, p, url, texto=None):
        r_id = p.part.relate_to(url, RT.HYPERLINK, is_external=True)
        h = OxmlElement("w:hyperlink")
        h.set(qn("r:id"), r_id)
        r = OxmlElement("w:r")
        rpr = OxmlElement("w:rPr")
        estilo = OxmlElement("w:rStyle")
        estilo.set(qn("w:val"), "Hyperlink")
        cor = OxmlElement("w:color")
        cor.set(qn("w:val"), "0563C1")
        sub = OxmlElement("w:u")
        sub.set(qn("w:val"), "single")
        for e in (estilo, cor, sub):
            rpr.append(e)
        r.append(rpr)
        t = OxmlElement("w:t")
        t.text = texto or url
        t.set(qn("xml:space"), "preserve")
        r.append(t)
        h.append(r)
        p._p.append(h)

    def passo(self, texto):
        if self._lista is None:
            self._lista = self._nova_lista()
        p = self.d.add_paragraph(texto, style="List Number")
        num_pr = p._p.get_or_add_pPr().get_or_add_numPr()
        num_pr.get_or_add_ilvl().val = 0
        num_pr.get_or_add_numId().val = self._lista

    def quebra(self):
        self.d.add_page_break()

    def figura(self, arquivo, legenda, largura=14.0):
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = True  # legenda não fica em outra página
        p.add_run().add_picture(arquivo, width=Cm(largura))
        p2 = self.d.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.keep_with_next = True  # os passos ficam na mesma página do print
        r = p2.add_run(legenda)
        r.italic = True
        r.font.size = Pt(9)
        r.font.color.rgb = CINZA

    def print_aqui(self, chave, o_que, onde, largura=14.0):
        """Insere prints/<chave>.(jpg|png) se existir; senão, a caixa vazia."""
        for ext in (".jpg", ".png"):
            caminho = os.path.join(PASTA_PRINTS, chave + ext)
            if os.path.exists(caminho):
                self.figura(caminho, o_que, largura)
                self.d.add_paragraph()
                return
        t = self.d.add_table(rows=1, cols=1)
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        c = t.cell(0, 0)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("[ PRINT ]  " + o_que)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = CINZA
        p2 = c.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r2 = p2.add_run("Capturar em: " + onde + "   ·   salvar como prints/" + chave + ".png")
        r2.italic = True
        r2.font.size = Pt(9)
        r2.font.color.rgb = CINZA
        self.d.add_paragraph()

    def tabela(self, cabecalho, linhas, larguras=None):
        t = self.d.add_table(rows=1, cols=len(cabecalho))
        t.style = "Light Grid Accent 1"
        for i, txt in enumerate(cabecalho):
            cel = t.rows[0].cells[i]
            cel.text = ""
            r = cel.paragraphs[0].add_run(txt)
            r.bold = True
            r.font.size = Pt(10)
        for linha in linhas:
            cells = t.add_row().cells
            for i, txt in enumerate(linha):
                cells[i].text = ""
                r = cells[i].paragraphs[0].add_run(str(txt))
                r.font.size = Pt(10)
        if larguras:
            for row in t.rows:
                for i, w in enumerate(larguras):
                    row.cells[i].width = Cm(w)
        # a tabela não se divide entre páginas (todas as linhas presas à seguinte)
        for row in t.rows[:-1]:
            for cel in row.cells:
                for p in cel.paragraphs:
                    p.paragraph_format.keep_with_next = True
        self.d.add_paragraph()

    def capa(self, titulo, subtitulo, rodape):
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("\n\n" + titulo)
        r.bold = True
        r.font.size = Pt(30)
        r.font.color.rgb = AZUL
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(subtitulo)
        r.font.size = Pt(16)
        r.font.color.rgb = CINZA
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("\n" + rodape)
        r.font.size = Pt(11)
        r.font.color.rgb = CINZA
        self.quebra()

    def fecho(self, texto):
        p = self.d.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run("\n\n" + texto)
        r.italic = True
        r.font.size = Pt(9)
        r.font.color.rgb = CINZA

    def salvar(self, nome):
        os.makedirs("entregaveis", exist_ok=True)
        caminho = os.path.join("entregaveis", nome)
        self.d.save(caminho)
        print("gerado:", caminho)


class Manual(Doc):
    """Doc com figuras numeradas e passos com número fixo (casam com as setas dos prints em prints/)."""

    def __init__(self):
        Doc.__init__(self)
        self._fig = 0

    def fig(self, chave, legenda, largura=16.0):
        self._fig += 1
        self.figura(os.path.join("prints", chave + ".jpg"), "Figura %d – %s" % (self._fig, legenda), largura)

    def acao(self, numero, texto, nivel=0):
        p = self.d.add_paragraph()
        recuo = 0.9 + nivel * 0.8
        p.paragraph_format.left_indent = Cm(recuo)
        p.paragraph_format.first_line_indent = Cm(-0.8)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True   # o bloco de passos não se divide entre páginas
        r = p.add_run("%s\t" % numero)
        r.bold = True
        r.font.color.rgb = AZUL
        p.paragraph_format.tab_stops.add_tab_stop(Cm(recuo))
        # trechos entre ** viram negrito (nome de botão/campo)
        for i, trecho in enumerate(texto.split("**")):
            run = p.add_run(trecho)
            run.bold = i % 2 == 1
