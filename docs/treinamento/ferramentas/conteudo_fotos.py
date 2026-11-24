# -*- coding: utf-8 -*-
"""Conteúdo do treinamento "Fotos do Tour: da foto à venda online" (uma vez só; o Word e o PowerPoint leem daqui).
   Cada bloco: (chave do print ou None, título, legenda, passos). O número de cada passo é o da seta no print."""

VERSAO, DATA = "1.0", "23/11/2026"
TITULO = "Fotos do Tour"
SUB = "Da foto à venda online"
ARQUIVO = "Fotos do Tour - da foto a venda online"
TESTE = "http://192.168.10.178:8799"

ETAPAS = [("Foto", "Fotógrafo", "Pontos do Tour", "Fotografa o grupo. As fotos chegam sozinhas ao Eterna, já separadas por sessão e com o nome do fotógrafo."),
          ("Checkout", "O próprio cliente", "Monitor do balcão", "Olha para a câmera (ou digita o código da sessão), vê as fotos dele e marca as que quer levar."),
          ("Posto de venda", "Vendedor", "Notebook com a DNP", "Escolhe o pacote e o pagamento, confirma, imprime as fotos 10×15 e mostra o QR da galeria."),
          ("Galeria online", "O próprio cliente", "Celular", "Lê o QR, baixa as fotos compradas e pode encontrar e comprar mais fotos dele.")]

REGRAS = [
    "**Abra o Eterna sempre pelo atalho Eterna da Área de Trabalho.** Só por ele o posto vende mesmo sem internet e imprime direto na DNP.",
    "**O Checkout e o Posto de venda ficam no mesmo notebook.** O Checkout abre pelo botão Abrir Checkout e vai para o monitor do cliente; o vendedor fica no Posto de venda.",
    "**O cliente só escolhe as fotos.** Pacote, forma de pagamento e confirmação são do vendedor, no Posto. O pacote **Ideal** (o mais barato para as fotos escolhidas) já vem marcado.",
    "**Confirme só depois de receber.** Cartão e PIX: depois que a maquininha aprovar. Dinheiro: depois de receber o valor. Nunca digite o número do cartão no Eterna.",
    "**A câmera do Checkout procura as fotos dos últimos 90 minutos.** Cliente que fotografou antes disso usa o código da sessão (começa com LP) ou o código da galeria.",
    "**Impressão em papel 10×15 na DNP.** O rolo faz cerca de 700 fotos e só baixa quando você toca em **Saiu certo**.",
    "**A galeria online** abre pelo QR ou pelo código. As fotos compradas ficam para baixar; pela selfie, o cliente encontra as outras fotos dele e compra pelo celular (Foto digital avulsa, R$ 39 cada).",
    "**Cancelar:** antes de pagar, **Cancelar compra** no pedido (não vira venda). Venda paga: em **Minhas vendas de hoje**, só quem vendeu, no mesmo dia, ou o Admin.",
]

# tabela da seção 1 (título, cabeçalho, linhas, larguras em cm)
TABELA = ("Pacotes", ["Produto", "O que leva", "Preço"], [
    ("Pacote Maracanã Mais", "todas as fotos, só digitais", "R$ 250"),
    ("Pacote Tribuna de Honra", "12 fotos, digitais e impressas", "R$ 220"),
    ("Pacote Maracanã", "9 fotos, digitais e impressas", "R$ 190"),
    ("Pacote Gramado", "6 fotos, digitais e impressas", "R$ 150"),
    ("Pacote Zona Mista", "3 fotos, só digitais", "R$ 110"),
    ("Pacote Arquibancada", "1 foto, digital e impressa", "R$ 70"),
    ("Foto adicional", "1 foto a mais, digital e impressa", "R$ 35"),
    ("Foto digital avulsa", "1 foto em alta, comprada na galeria online", "R$ 39")], [5.6, 8.0, 2.8])

PREPARAR = [
    (None, "Impressora DNP: papel 10×15", "", [
        "No notebook, abra **Configurações › Bluetooth e dispositivos › Impressoras e scanners**.",
        "Desligue **Permitir que o Windows gerencie minha impressora padrão** (senão o Windows troca a impressora sozinho).",
        "Clique na **DNP DS-RX1HS** e em **Definir como padrão**.",
        "Clique em **Preferências de impressão** e escolha o papel **PR 4×6 (10×15)** (o mesmo que 6×4). Clique em **OK**."]),
    (None, "Abrir o Eterna pelo atalho", "", [
        "Na Área de Trabalho, dê dois cliques no atalho **Eterna** (o ícone do Chrome com o nome Eterna). Ele abre o Eterna no endereço do posto, https://posto.eterna.photo/#posto.",
        "Não abra o Eterna por outro Chrome nem digitando o endereço: só pelo atalho a impressão sai direto na DNP, sem janela de impressão.",
        "O atalho também abre sozinho quando o Windows liga. Se ele sumiu da Área de Trabalho, chame a TI."]),
    ("f01-entrar", "Entrar no Eterna", "Tela de entrada", [
        "Digite o seu **usuário**.", "Digite a sua **senha**.", "Clique em **Entrar**. O Eterna abre no **Posto de venda**."]),
    ("f02-posto", "Abrir o Checkout", "Posto de venda", [
        "Clique em **Abrir Checkout**. O Checkout abre em tela cheia no monitor do cliente; você continua no Posto de venda, no notebook."]),
]
CHECKOUT = [
    ("f03-iniciar", "O cliente começa", "Checkout: tela inicial", [
        "O cliente toca em **Iniciar** e olha para a câmera. O Checkout acha as fotos em que ele aparece e a câmera desliga.",
        "Se a câmera não achar (ou se as fotos têm mais de 90 minutos), ele toca em **Digite sua sessão**."]),
    ("f04-codigo", "Código da sessão", "Checkout: código", [
        "O cliente digita o **código da sessão** (começa com LP, está no recibo do fotógrafo) ou o código da galeria.",
        "Toca em **Ver minhas fotos**. Se aparecer \"Buscando suas fotos…\", é só esperar alguns segundos."]),
    ("f05-escolha", "Escolher as fotos", "Checkout: foto ampliada", [
        "Em cada foto, ele toca em **✓** para levar.", "Ou em **✗** para não levar. As setas (ou arrastar o dedo) passam as fotos.",
        "**Ver todas** mostra todas as fotos em grade."]),
    ("f06-continuar", "Continuar", "Checkout: fotos marcadas", [
        "Com as fotos marcadas, ele toca em **Continuar · N fotos**. É o único botão que faz o pedido."]),
    ("f07-pronto", "Pronto", "Checkout: pedido feito", [
        "O cliente vê **Pronto! O atendente vai finalizar sua compra**, com o código do pedido e quantas fotos escolheu. Daqui em diante é com você, no Posto."]),
]
POSTO = [
    ("f08-pacote", "Abrir o pedido e escolher o pacote", "Posto de venda: passo 1, Pacote", [
        "O pedido aparece em **Aguardando pagamento**. Clique nele para abrir ao lado, com as fotos escolhidas.",
        "O pacote **Ideal** vem marcado. Confirme com o cliente ou clique em outro pacote."]),
    ("f09-pagamento", "Forma de pagamento", "Posto de venda: passo 2, Pagamento", [
        "Pergunte como o cliente vai pagar e clique em **Cartão**, **PIX** ou **Dinheiro**."]),
    ("f10-valor", "O que o cliente vê", "Checkout: valor a pagar", [
        "No monitor, o cliente vê o **valor a pagar**, quantas fotos são e onde pagar (\"Pague na maquininha\", \"Pague com PIX na maquininha\" ou \"Pague em dinheiro ao atendente\"). Se você trocar o pacote, o valor muda na hora."]),
    ("f11-confirmar", "Confirmar o pagamento", "Posto de venda: passo 3, Confirmar", [
        "Digite o valor na maquininha e espere aprovar. Depois clique em **Pago na maquininha**. No dinheiro, receba e clique em **Recebi R$ X**.",
        "Se o cliente desistir, use **Cancelar compra** (seção 6)."]),
    ("f12-final", "QR da galeria", "Checkout: compra concluída", [
        "O monitor mostra o **QR** e o código da galeria, com o valor pago. Peça para o cliente fotografar o QR com o celular. A tela volta sozinha ao início em 40 segundos."]),
    (None, "Dinheiro com o caixa", "", [
        "Se outra pessoa recebe o dinheiro, clique no botão amarelo **Caixa**, no alto do menu: ele mostra só os pagamentos em dinheiro esperando.",
        "Digite o código que o cliente mostra, confira o valor e as fotos, receba e clique em **Recebi R$ X**: a venda fica paga e vai para a impressão."]),
]
IMPRIMIR = [
    ("f13-imprimir", "Imprimir", "Impressão 10×15", [
        "A venda paga aparece em **Imprimir**, com as fotos já marcadas (até o número de impressas do pacote). Para trocar, clique nas fotos. Clique em **Imprimir N fotos (10×15)**."]),
    ("f14-saiu", "Conferir a impressão", "Impressão enviada", [
        "Pegue as fotos na DNP e confira. Saíram boas: clique em **Saiu certo** (só aqui o rolo baixa).",
        "Não saíram (papel, cor, travou): clique em **Não saiu** e imprima de novo."]),
    (None, "Reimprimir e trocar o rolo", "", [
        "Para imprimir de novo uma venda já impressa, clique em **Reimprimir**, marque as fotos, escolha o motivo e clique em **Reimprimir N fotos**.",
        "O contador **Rolo: X de 700** fica no alto do Posto. Com 100 ou menos ele fica amarelo; abaixo de 40, vermelho. Troque o rolo e a fita na DNP antes do pico.",
        "Sem o programa de impressão, registre a troca: clique no selo do rolo e em **Sim, troquei**. O contador volta a 700."]),
    ("f15-minhas", "Recibo e Minhas vendas de hoje", "Minhas vendas de hoje", [
        "Em **Minhas vendas de hoje** ficam as suas vendas deste notebook. **Recibo** abre o recibo com o QR, para reimprimir ou mostrar ao cliente que saiu sem fotografar o QR.",
        "**Cancelar venda** cancela uma venda paga (seção 6)."]),
]
CANCELAR = [
    ("f17-cancelar-compra", "Antes de pagar: Cancelar compra", "Pedido aberto, cancelando", [
        "No pedido aberto, clique no link vermelho **Cancelar compra** e depois em **Sim, cancelar**. A compra não vira venda e o Checkout do cliente volta ao início."]),
    ("f16-cancelar-venda", "Venda paga: Cancelar venda", "Minhas vendas de hoje, cancelando", [
        "Em **Minhas vendas de hoje**, clique em **Cancelar venda** na linha da venda e escreva o **motivo** (opcional).",
        "Clique em **Confirmar cancelamento**. Só quem vendeu, no mesmo dia, ou o Admin cancela; os outros veem \"Só quem vendeu, no mesmo dia, ou o Admin cancela esta venda\"."]),
]
GALERIA = [
    ("g01-abrir", "Abrir a galeria", "Celular: fotos compradas", [
        "O cliente lê o QR com a câmera do celular. As fotos compradas aparecem em alta: **Baixar** salva uma foto.",
        "**Baixar todas** salva todas de uma vez."]),
    ("g01b-mais", "Encontrar mais fotos", "Celular: fim da galeria", [
        "No fim da galeria, **Encontrar mais fotos suas** procura as outras fotos em que ele aparece no dia."]),
    ("g01c-aceite", "Autorizar a selfie", "Celular: autorização", [
        "O cliente marca a **autorização** do uso da selfie (ela é comparada na hora e descartada).", "Toca em **Concordar e continuar**."]),
    ("g02-selfie", "Selfie", "Celular: selfie", [
        "Ele encaixa o rosto no círculo: a foto sai sozinha."]),
    ("g03-comprar", "Escolher as fotos", "Celular: mais fotos da visita", [
        "Em **Mais fotos da sua visita** aparecem as fotos dele, com a marca d'água. Ele toca em **✓** nas que quer levar."]),
    ("g03b-levar", "Levar as fotos", "Celular: fotos escolhidas", [
        "Toca no botão com o número de fotos e o valor, no fim da tela."]),
    ("g04-pagar", "Pagar online", "Celular: pagamento", [
        "Preenche nome, e-mail e CPF e toca em **Comprar**. O pagamento é feito pela Imply, a bilheteria do Tour. Depois de pagar, as fotos ficam liberadas para baixar na mesma galeria."]),
]

SECOES = [("Preparar e abrir o posto", PREPARAR), ("Checkout: o cliente escolhe", CHECKOUT), ("Posto de venda: cobrar", POSTO),
          ("Imprimir e recibo", IMPRIMIR), ("Cancelar", CANCELAR), ("Galeria online: o que o cliente vê", GALERIA)]

TREINO = [
    ("Antes", ["Cada pessoa com o seu usuário e senha do Eterna.",
               "Notebook abrindo o servidor de teste: " + TESTE + ", com um monitor para o Checkout e a DNP com papel.",
               "Uma sessão de fotos de treino (fotografe os colegas) e o código dela (LP…).",
               "Tudo o que for feito no servidor de teste não vai para o caixa."]),
    ("Vendedor", ["Abra o Checkout pelo botão Abrir Checkout.",
                  "Como cliente, abra a sessão pelo código, marque 6 fotos e toque em Continuar.",
                  "No Posto, confira o Ideal, escolha Cartão e confirme. Imprima e clique em Saiu certo.",
                  "Faça uma segunda compra em Dinheiro e confirme pelo Caixa."]),
    ("Cancelar", ["Faça um pedido e cancele antes de pagar (Cancelar compra).",
                  "Cancele uma das vendas pagas em Minhas vendas de hoje, com o motivo.",
                  "Entre com outro vendedor e veja que ele não cancela a sua venda."]),
    ("Cliente", ["Com o celular, leia o QR da venda e baixe uma foto.",
                 "Toque em Encontrar mais fotos suas, faça a selfie e veja as outras fotos.",
                 "Escolha uma e vá até a tela de pagamento (no servidor de teste nada é cobrado)."]),
]

PROBLEMAS = [("A câmera do Checkout não acha o cliente", "Peça o código da sessão (LP…) do recibo do fotógrafo ou o código da galeria."),
             ("\"Buscando suas fotos…\"", "As fotos estão chegando: espere alguns segundos, sem tocar de novo."),
             ("O pedido não aparece no Posto", "O Checkout tem que ter sido aberto pelo Abrir Checkout deste notebook. Feche e abra de novo pelo botão."),
             ("A impressão não saiu", "Clique em Não saiu, confira papel e fita na DNP e imprima de novo."),
             ("Saiu numa impressora errada ou abriu janela de impressão", "O Eterna não foi aberto pelo atalho, ou a DNP não é a padrão: veja a seção 2."),
             ("Faixa \"Rolo acabando\"", "Troque o rolo e a fita da DNP e registre a troca."),
             ("Cliente saiu sem fotografar o QR", "Minhas vendas de hoje › Recibo: o mesmo QR e o mesmo código."),
             ("\"Só quem vendeu, no mesmo dia, ou o Admin cancela esta venda\"", "Chame quem vendeu ou o Admin."),
             ("Faixa vermelha \"O computador do ponto não está respondendo\"", "Chame a TI."),
             ("Cliente não achou mais fotos na galeria", "A selfie só mostra fotos do mesmo dia em que ele aparece. Ele pode comprar no balcão.")]
