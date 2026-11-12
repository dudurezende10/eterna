# -*- coding: utf-8 -*-
"""Manual (Word) e apresentação (PowerPoint) do treinamento "Da venda à entrega do vídeo".
   Rodar de docs/treinamento:  python ferramentas/gerar.py
   Usa os prints marcados em prints/ (capturar.js + marcar.py). Gera entregaveis/*.docx e *.pptx."""
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

VERSAO, DATA = "1.1", "12/11/2026"
TITULO = "Drone, Chute a Gol e Snap Pop"
SUB = "Da venda à entrega do vídeo"
TESTE = "http://192.168.10.178:8799"

# ---------------------------------------------------------------- conteúdo (uma vez só; o Word e o PowerPoint leem daqui)
ETAPAS = [("Venda", "Vendedor", "Tablet, no foyer", "Escolhe o serviço, registra o cliente (nome e foto) e o pagamento."),
          ("Voo ou gravação", "Piloto / operador", "Campo", "Marca a decolagem (Drone) ou o começo (Chute a Gol, Snap Pop)."),
          ("Entrega", "Equipe de entrega", "Computador do campo", "Solta o vídeo, escolhe a venda, lê o cartão com QR e entrega."),
          ("Cliente", "O próprio cliente", "Celular", "Lê o QR do cartão, aceita o uso de imagem, assiste e baixa o vídeo.")]

REGRAS = [
    "**Preço é o do catálogo.** O vendedor não digita valor; 4K e chuva entram marcando a caixa do produto.",
    "**Sem internet, a venda não se perde.** Ela fica guardada no tablet e segue sozinha quando a rede voltar (aparece \"Aguardando envio\" em Minhas vendas).",
    "**Uma venda por serviço.** Drone e Chute a Gol na mesma compra viram duas vendas com o mesmo número; cada uma vai para a sua fila.",
    "**Nome e foto do cliente** servem para a equipe do campo reconhecer a pessoa na entrega. Os dois são apagados sozinhos um dia depois da entrega (ou dois dias depois da venda).",
    "**Fotos do Tour:** só marque a caixa de autorização se o cliente concordar. Com ela, o cliente recebe junto com o vídeo as fotos dele do Tour e compra se quiser.",
    "**O cartão com QR é a chave do vídeo.** Um cartão por vídeo; cartão já usado, de lote cancelado ou que não veio da gráfica é recusado na hora. Entregue o cartão na mão do cliente. O código de 12 letras impresso no cartão serve para o cliente digitar se o QR não ler.",
    "**O vídeo fica 30 dias** disponível para o cliente assistir e baixar.",
    "**Venda errada:** chame o supervisor antes da entrega. O vendedor não cancela; depois de entregue, a venda não é mais cancelada.",
]

COLUNAS = [("Próximo a voar", "Próximo a gravar", "Venda feita; o cliente ainda não foi atendido no campo."),
           ("Voando", "Gravando", "Decolou (ou começou); esperando o vídeo."),
           ("Entrega do vídeo", "Entrega do vídeo", "Vídeo ligado ao cartão; falta algum item físico (ex.: medalha) ou o envio."),
           ("Entregue", "Entregue", "Tudo entregue. Mostra quando o cliente abriu, assistiu e baixou.")]

# (chave do print, título, legenda, passos) — o número de cada passo é o da seta no print
VENDA = [
    ("v01-entrar", "Entrar no Eterna", "Tela de entrada", [
        "Digite o seu **usuário**.", "Digite a sua **senha**.", "Toque em **Entrar**."]),
    ("v02-menu", "Abrir a venda", "Menu lateral", [
        "Toque em **Drone, Chute a Gol e Snap Pop**."]),
    ("v03-servico", "Escolher o serviço e as pessoas", "Serviço e pessoas no vídeo", [
        "Toque no serviço: **Drone**, **Chute a Gol** ou **Snap Pop**.", "Toque em quantas **pessoas** vão aparecer no vídeo."]),
    ("v04-produto", "Escolher o produto", "Cartão do produto (Drone)", [
        "Escolha o **local** (Campo, Arquibancada…).", "Marque **4K** se o cliente quiser o vídeo em 4K.",
        "Toque no vídeo para mostrar a **demonstração** ao cliente (com o número de pessoas escolhido).", "Toque em **Adicionar**."]),
    ("v05-chute", "Chute a Gol: chutes e produtos", "Abas do Chute a Gol", [
        "Escolha a aba do pacote (**3 Chutes**, **5 Chutes**) e toque em **Adicionar** no produto.",
        "Na aba **Produtos** ficam a medalha e as bolas avulsas."]),
    ("v06-snap", "Snap Pop", "Serviço Snap Pop", [
        "Toque em **Snap Pop**, escolha o tema e toque em **Adicionar**."]),
    ("v07-cliente-nome", "Nome e foto do cliente", "Cliente", [
        "Digite o **nome do cliente**.", "Toque em **Tirar foto do cliente** e fotografe o rosto, de frente. **Sem a foto a venda não é registrada.**"]),
    ("v08-cliente-foto", "Autorização, país e idioma", "Cliente com foto", [
        "Confira a **foto**. Se ficou ruim, toque em **Tirar outra foto**.",
        "Pergunte se o cliente quer receber as fotos dele do Tour. Só se ele concordar, marque a **autorização** (seção 1.2).",
        "Escolha o **país** do cliente.", "Escolha o **idioma** do cliente (é o idioma da página do vídeo)."]),
    ("v09-resumo", "Conferir o resumo", "Resumo da venda", [
        "Confira cada **linha** com o cliente.", "Errou? Toque na **lixeira** da linha e adicione de novo.", "Confira o **total**."]),
    ("v10-pagamento", "Pagamento e registro", "Pagamento", [
        "Toque na forma de **pagamento** (PIX, Dinheiro, Débito, Crédito ou Cortesia).",
        "Toque em **Registrar venda**."]),
    ("v11-registrada", "Venda registrada", "Aviso de venda registrada", [
        "Aparece **Venda nº … registrada**. Diga o número ao cliente e encaminhe-o para o campo."]),
    ("v12-minhas", "Minhas vendas", "Minhas vendas de hoje", [
        "Toque em **Minhas vendas**: as suas vendas do dia, o total e se cada uma já foi **enviada ao servidor**.",
        "Para achar uma venda, digite no campo de **busca** o número, o nome do cliente, o produto ou o pagamento.",
        "Cada linha é uma venda: número, hora, cliente, produtos, pagamento, situação e valor."]),
]
ENTREGA = [
    ("e01-menu", "Abrir a entrega", "Menu lateral", [
        "Clique em **Entrega dos vídeos**."]),
    ("e02-fila", "A fila do Drone", "Fila por serviço", [
        "Escolha o serviço (**Drone**, **Chute a Gol**, **Snap Pop**). O número ao lado é quantos clientes esperam.",
        "Quando o cliente for voar, clique em **Decolar** no cartão dele."]),
    ("e03-decolar", "Decolar", "Piloto, drone e bateria", [
        "Escolha o **piloto**.", "Escolha o **drone**.", "Escolha a **bateria**.", "Clique em **Confirmar decolagem**."]),
    ("e04-voando", "Voando", "Coluna Voando", [
        "O cartão passa para **Voando** e fica **Aguardando vídeo**."]),
    ("e05-soltar", "Soltar o vídeo", "Área do vídeo", [
        "Tire o cartão de memória do drone, abra a pasta do vídeo e **arraste o arquivo** para esta área (ou clique nela e escolha o arquivo). Use o arquivo **.MP4** (ou .MOV); o .LRF do drone não é vídeo e é recusado."]),
    ("e06-conferir", "Conferir e escolher a venda", "Confira o vídeo", [
        "Assista ao **vídeo** e confira se é o do cliente.", "Clique na **venda** do cliente (nome, número e produto)."]),
    ("e07-cartao", "Ler o cartão", "Cartão com QR", [
        "Clique em **Ler o QR do cartão com a câmera** e mostre o QR do cartão.",
        "Ou use o **leitor de QR**: com o cursor neste campo, passe o cartão no leitor."]),
    ("e08-entregar", "Entregar", "Cartão lido", [
        "Confira o código do cartão e clique em **Entregar vídeo**. Entregue o cartão ao cliente."]),
    ("e09-entregue", "Entregue", "Coluna Entregue", [
        "O cartão vai para **Entregue**, com o código do cartão e o horário. **Na nuvem** aparece quando a página do cliente já está no ar; enquanto isso, **Publicando a página do cliente**.",
        "Quando o cliente abre, assiste e baixa, aparece aqui (**Cliente abriu… assistiu… baixou…**)."]),
]
CHUTE_SNAP = [
    ("e10-medalha", "Chute a Gol: itens físicos", "Medalha pendente", [
        "Ao entregar a medalha (ou a bola), marque o **item**. Com tudo entregue, a venda vai para **Entregue**."]),
    ("e11-snap", "Snap Pop: começar", "Fila do Snap Pop", [
        "Quando o cliente começar, clique em **Começar**. O resto é igual ao Drone: soltar o vídeo, escolher a venda, ler o cartão e entregar (seção 3)."]),
]
ADMIN = [
    ("a01-gerar", "Gerar o lote para a gráfica", "Configurações › Preços e Checkout › Avançado › Cartões com QR impresso", [
        "Digite a **quantidade** de cartões (até 10.000).", "Clique em **Gerar lote para a gráfica (CSV)** e mande o arquivo para a gráfica por um canal seguro."]),
    ("a02-na-grafica", "Lote na gráfica", "Lista dos lotes", [
        "Enquanto o lote está **Na gráfica**, o botão só **baixa o mesmo arquivo de novo**; não cria cartões novos.",
        "Quando os cartões chegarem, clique em **Marcar recebido**. Só então dá para gerar outro lote.",
        "Se o lote não for impresso ou os cartões se perderem, clique em **Cancelar lote**: nenhum cartão dele é aceito na entrega. Não dá para desfazer."]),
]
CLIENTE = [
    ("c01-aceite", "Abrir o vídeo", "Página do vídeo no celular", [
        "O cliente lê o QR do cartão com a câmera do celular e marca a **autorização de uso de imagem**.",
        "Digita o **e-mail**.", "Toca em **Ver meu vídeo**."]),
    ("c02-video", "Assistir e baixar", "Vídeo pronto", [
        "O **vídeo** toca na própria página.", "**Baixar vídeo** salva no celular."]),
    ("c03-fotos-tour", "Fotos do Tour", "Fotos do Tour na página do vídeo", [
        "Se ele autorizou na venda e foi encontrado nas fotos do Tour, as fotos aparecem logo abaixo do vídeo. As que ele já comprou têm **Baixar**.",
        "As outras aparecem com a marca d'água; tocar numa delas abre a compra com ela já escolhida.",
        "**Comprar minhas fotos** abre a compra das que faltam. Depois de pagar, ele volta ao vídeo e baixa as fotos ali mesmo."]),
]

TREINO = [
    ("Antes", ["Cada pessoa com o seu usuário e senha do Eterna.",
               "Tablet e computador abrindo o servidor de teste: " + TESTE + ".",
               "Alguns cartões com QR de treino e um vídeo curto qualquer (.mp4) no computador do campo.",
               "Tudo o que for feito no servidor de teste não vai para o caixa nem para o cliente."]),
    ("Vendedor", ["Faça 3 vendas: um Drone com 2 pessoas e 4K, um Chute a Gol com medalha e um Snap Pop.",
                  "Em todas, cliente com nome começando por TREINO e foto de um colega.",
                  "Numa delas, desligue o Wi-Fi do tablet, registre e veja \"Aguardando envio\"; ligue de novo e veja a venda seguir.",
                  "Confira tudo em Minhas vendas."]),
    ("Entrega", ["Ache as vendas de treino na fila de cada serviço.",
                 "Drone: Decolar com piloto, drone e bateria.",
                 "Solte o vídeo de exemplo, escolha a venda, leia um cartão de treino e entregue.",
                 "Tente ler o mesmo cartão de novo numa outra venda: o Eterna recusa.",
                 "Chute a Gol: marque a medalha. Snap Pop: Começar e entregar."]),
    ("Cliente", ["Com o celular, leia o QR do cartão entregue.",
                 "Marque a autorização, digite um e-mail e veja o vídeo; toque em Baixar vídeo.",
                 "Volte à Entrega e veja aparecer \"Cliente abriu… assistiu… baixou…\"."]),
]

PROBLEMAS = [("Tablet sem internet", "Registre normalmente. A venda fica no tablet e segue sozinha quando a rede voltar."),
             ("\"Este cartão já foi usado\"", "Pegue outro cartão. Cada cartão serve para um vídeo só."),
             ("\"Este cartão é de um lote cancelado\" ou \"não é de nenhum lote\"", "Pegue outro cartão e separe este para o supervisor."),
             ("Cliente não está na fila", "Confira com o vendedor o número da venda; ela pode estar aguardando envio no tablet."),
             ("Vídeo errado", "Antes de entregar: clique em Descartar e solte o vídeo certo."),
             ("Venda errada ou desistência", "Chame o supervisor para cancelar, antes da entrega."),
             ("Cliente vê \"Seu vídeo está chegando\"", "O vídeo ainda está subindo para a internet. A página atualiza sozinha; peça para aguardar alguns minutos."),
             ("Cliente não achou as fotos do Tour", "Só aparecem se ele autorizou na venda e se foi encontrado nas fotos do dia. Ele pode comprar no balcão de fotos.")]


def larg(chave, cheia=15.5, alta=7.5):
    w, h = Image.open(os.path.join("prints", chave + ".jpg")).size
    return alta if h / w > 1.3 else (11.0 if h / w > 0.75 else cheia)


# ---------------------------------------------------------------- manual (Word)
def manual():
    d = Manual()
    d.capa(TITULO, SUB + "\nManual da equipe", "Versão %s · %s" % (VERSAO, DATA))
    d.h1("Como funciona")
    d.h2("O caminho de cada venda")
    d.tabela(["Etapa", "Quem", "Onde", "O que acontece"], ETAPAS, [2.8, 3.2, 3.4, 7.0])
    d.h2("Regras")
    for i, r in enumerate(REGRAS, 1):
        d.acao(str(i), r)
    d.d.add_paragraph()
    d.h2("As colunas da fila de entrega")
    d.tabela(["Drone", "Chute a Gol / Snap Pop", "O que significa"], COLUNAS, [3.6, 4.0, 8.8])
    d.quebra()
    for titulo, blocos in (("Venda no tablet", VENDA), ("Entrega do Drone", ENTREGA), ("Entrega do Chute a Gol e do Snap Pop", CHUTE_SNAP),
                           ("O que o cliente vê", CLIENTE), ("Administrador: lotes de cartões", ADMIN)):
        d.h1(titulo)
        for chave, t, leg, passos in blocos:
            d.h2(t)
            d.fig(chave, leg, larg(chave))
            for n, p in enumerate(passos, 1):
                d.acao(str(n), p)
            d.d.add_paragraph()
        d.quebra()
    d.h1("Treino: simulando o dia")
    d.para("O treino usa o servidor de teste, com vendas de mentira, do começo ao fim.")
    for papel, itens in TREINO:
        d.h2(papel)
        for n, x in enumerate(itens, 1):
            d.acao(str(n), x)
        d.d.add_paragraph()
    d.h1("Problemas comuns")
    d.tabela(["Situação", "O que fazer"], PROBLEMAS, [5.0, 11.4])
    d.salvar("Manual - Drone, Chute a Gol e Snap Pop - da venda a entrega.docx")


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


def apresentacao():
    prs = Presentation(); prs.slide_width, prs.slide_height = W, H
    # capa
    sl = prs.slides.add_slide(prs.slide_layouts[6]); caixa(sl, 0, 0, W, H, NAVY); caixa(sl, 0, PCm(12.2), W, PCm(0.25), AMAR)
    texto(sl, PCm(2), PCm(4.2), PCm(30), PCm(3), TITULO.upper(), 46, BRANCO, True, fonte="Segoe UI Black")
    texto(sl, PCm(2), PCm(7.6), PCm(30), PCm(2), SUB, 28, AMAR)
    texto(sl, PCm(2), PCm(13.2), PCm(30), PCm(2), ["Treinamento da equipe", "Versão %s · %s" % (VERSAO, DATA)], 16, BRANCO)
    # o caminho
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "O caminho de cada venda", "Quatro etapas, quatro telas")
    for i, (et, quem, onde, oque) in enumerate(ETAPAS):
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
    for i, r in enumerate(REGRAS):
        col, lin = i % 2, i // 2
        x, y = PCm(1.2 + col * 16.2), PCm(3.7 + lin * 3.75)
        num(sl, x, y, i + 1)
        texto(sl, x + PCm(1.4), y - PCm(0.15), PCm(14.3), PCm(3.6), r, 13.5, NAVY)
    # colunas
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "A fila de entrega", "Uma fila por serviço, como a fila das fotos")
    cores = [PRGB(0xE8, 0xEE, 0xF7), PRGB(0xE3, 0xEC, 0xFA), PRGB(0xFF, 0xF4, 0xD6), PRGB(0xE4, 0xF4, 0xE6)]
    for i, (dr, cs, oq) in enumerate(COLUNAS):
        x = PCm(1.2 + i * 8.15)
        caixa(sl, x, PCm(4.0), PCm(7.4), PCm(12.6), cores[i], MSO_SHAPE.ROUNDED_RECTANGLE).adjustments[0] = 0.06
        texto(sl, x + PCm(0.5), PCm(4.6), PCm(6.5), PCm(2.2), dr.upper(), 20, NAVY, True, fonte="Segoe UI Black")
        texto(sl, x + PCm(0.5), PCm(6.9), PCm(6.5), PCm(1.4), "Chute a Gol / Snap Pop: " + cs, 12, CINZA)
        texto(sl, x + PCm(0.5), PCm(9.0), PCm(6.5), PCm(7), oq, 16, NAVY)
    for secao, blocos in (("Venda no tablet", VENDA), ("Entrega do Drone", ENTREGA), ("Chute a Gol e Snap Pop", CHUTE_SNAP), ("O que o cliente vê", CLIENTE), ("Lotes de cartões", ADMIN)):
        sl = prs.slides.add_slide(prs.slide_layouts[6]); caixa(sl, 0, 0, W, H, NAVY); caixa(sl, PCm(2), PCm(10.6), PCm(6), PCm(0.25), AMAR)
        texto(sl, PCm(2), PCm(6.5), PCm(30), PCm(4), secao.upper(), 44, BRANCO, True, fonte="Segoe UI Black")
        for chave, t, leg, passos in blocos:
            tela(prs, secao, chave, t, [p.replace("(seção 1.2)", "(regra 5)").replace(" (seção 3)", "") for p in passos])
    # treino
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "Treino: simulando o dia", "No servidor de teste, com vendas de mentira")
    for i, (papel, itens) in enumerate(TREINO):
        x = PCm(1.2 + i * 8.15)
        caixa(sl, x, PCm(3.6), PCm(7.4), PCm(14.6), CLARO, MSO_SHAPE.ROUNDED_RECTANGLE).adjustments[0] = 0.05
        texto(sl, x + PCm(0.4), PCm(4.0), PCm(6.6), PCm(1.3), papel.upper(), 18, NAVY, True, fonte="Segoe UI Black")
        texto(sl, x + PCm(0.4), PCm(5.6), PCm(6.6), PCm(12.4), ["• " + t for t in itens], 13.5, NAVY)
    # problemas
    sl = prs.slides.add_slide(prs.slide_layouts[6]); topo(sl, "Problemas comuns", "O que fazer quando")
    t = sl.shapes.add_table(len(PROBLEMAS) + 1, 2, PCm(1.2), PCm(3.6), PCm(31.4), PCm(14)).table
    t.columns[0].width, t.columns[1].width = PCm(10.4), PCm(21.0)
    for j, cab in enumerate(("Situação", "O que fazer")):
        c = t.cell(0, j); c.text = cab; c.fill.solid(); c.fill.fore_color.rgb = NAVY
        r = c.text_frame.paragraphs[0].runs[0]; r.font.size = PPt(15); r.font.bold = True; r.font.color.rgb = BRANCO
    for i, (a, b) in enumerate(PROBLEMAS, 1):
        for j, v in enumerate((a, b)):
            c = t.cell(i, j); c.text = v; c.fill.solid(); c.fill.fore_color.rgb = CLARO if i % 2 else BRANCO
            r = c.text_frame.paragraphs[0].runs[0]; r.font.size = PPt(13); r.font.color.rgb = NAVY; r.font.bold = j == 0
    os.makedirs("entregaveis", exist_ok=True)
    nome = os.path.join("entregaveis", "Treinamento - Drone, Chute a Gol e Snap Pop - da venda a entrega.pptx")
    prs.save(nome); print("gerado:", nome)


if __name__ == "__main__":
    manual()
    apresentacao()
