# -*- coding: utf-8 -*-
"""Conteúdo do treinamento "Drone, Chute a Gol e Snap Pop: da venda à entrega do vídeo" (uma vez só; o Word e o PowerPoint leem daqui).
   Cada bloco: (chave do print, título, legenda, passos). O número de cada passo é o da seta no print."""

VERSAO, DATA = "2.0", "23/11/2026"
TITULO = "Drone, Chute a Gol e Snap Pop"
SUB = "Da venda à entrega do vídeo"
ARQUIVO = "Drone, Chute a Gol e Snap Pop - da venda a entrega"
TESTE = "http://192.168.10.178:8799"

ETAPAS = [("Venda", "Vendedor", "Tablet, no foyer", "Escolhe o serviço, registra o ingresso e o nome do cliente, coloca uma pulseira por item e registra o pagamento."),
          ("Voo ou gravação", "Piloto / operador", "Campo", "Marca a decolagem (Drone) ou o começo (Chute a Gol, Snap Pop)."),
          ("Entrega", "Equipe de entrega", "Computador do campo", "Lê a pulseira, solta o vídeo, lê o cartão com QR, tira a foto do cliente e entrega."),
          ("Cliente", "O próprio cliente", "Celular", "Lê o QR do cartão, aceita o uso de imagem, assiste e baixa o vídeo.")]

REGRAS = [
    "**Preço é o do catálogo.** O vendedor não digita valor; 4K e chuva entram marcando a caixa do produto.",
    "**Sem internet, a venda não se perde.** Ela fica guardada no tablet e segue sozinha quando a rede voltar (aparece \"Aguardando envio\" em Minhas vendas).",
    "**Uma venda por serviço.** Drone e Chute a Gol na mesma compra viram duas vendas com o mesmo número; cada uma vai para a sua fila.",
    "**Ingresso e nome do cliente são obrigatórios na venda.** O ingresso é o localizador de 12 caracteres do QR do ingresso do Tour (lido com a câmera ou digitado). País e idioma são opcionais; o idioma é o da página do vídeo.",
    "**A foto do cliente é tirada na entrega**, pela câmera do computador do campo, não mais na venda. No Drone e no Snap Pop ela é obrigatória: sem ela o vídeo não é entregue. No Chute a Gol é opcional. Com a foto, o Eterna procura o cliente nas fotos do Tour do dia e mostra as que achar na página do vídeo. Nome e foto são apagados sozinhos um dia depois da entrega (ou dois dias depois da venda).",
    "**Uma pulseira por item.** Cada linha do resumo pede a sua pulseira numerada, colocada no cliente na hora da venda. Na entrega, é a pulseira que diz de quem é o vídeo. Pulseira já usada é recusada.",
    "**O cartão com QR é a chave do vídeo.** Um cartão por vídeo; cartão já usado ou que não veio da gráfica é recusado na hora. Entregue o cartão na mão do cliente. O código de 12 letras impresso no cartão serve para o cliente digitar se o QR não ler.",
    "**O vídeo fica 30 dias** disponível para o cliente assistir e baixar.",
    "**Só o supervisor cancela uma venda**, em Minhas vendas, com o motivo, e só antes da entrega. O vendedor não cancela: chame o supervisor. Depois de entregue, a venda não é mais cancelada.",
]

COLUNAS = [("Próximo a voar", "Próximo a gravar", "Venda feita; o cliente ainda não foi atendido no campo."),
           ("Voando", "Gravando", "Decolou (ou começou); esperando o vídeo."),
           ("Entrega do vídeo", "Entrega do vídeo", "Vídeo ligado ao cartão; falta algum item físico (ex.: medalha) ou o envio."),
           ("Entregue", "Entregue", "Tudo entregue. Mostra quando o cliente abriu, assistiu e baixou.")]

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
    ("v07-cliente", "Ingresso e nome do cliente", "Cliente", [
        "Peça o ingresso do Tour e digite o **localizador** (12 caracteres) neste campo.",
        "Ou toque em **Ler QR do ingresso** e mostre o QR do ingresso para a câmera: o localizador entra sozinho.",
        "Digite o **nome do cliente**.",
        "Se quiser, escolha o **país** do cliente.", "Se quiser, escolha o **idioma** do cliente (é o idioma da página do vídeo)."]),
    ("v09-pulseira", "Pulseira de cada item", "Pulseiras no resumo", [
        "Passe a **pulseira** no leitor (ou digite o número). O leitor já pula para o campo seguinte.",
        "Sem leitor, toque na **câmera** ao lado do campo e mostre o QR da pulseira. Cada linha do resumo tem o seu campo e a sua pulseira; coloque no pulso do cliente."]),
    ("v09-resumo", "Conferir o resumo", "Resumo da venda", [
        "Confira cada **linha** com o cliente.", "Errou? Toque na **lixeira** da linha e adicione de novo.", "Confira o **total**."]),
    ("v10-pagamento", "Pagamento e registro", "Pagamento", [
        "Toque na forma de **pagamento** (PIX, Dinheiro, Débito, Crédito ou Cortesia). Cortesia pede o motivo e uma nota.",
        "Toque em **Registrar venda**. Se faltar o ingresso, o nome ou alguma pulseira, o Eterna avisa o que falta e não registra."]),
    ("v11-registrada", "Venda registrada", "Aviso de venda registrada", [
        "Aparece **Venda nº … registrada**. Diga o número ao cliente e encaminhe-o para o campo."]),
    ("v12-minhas", "Minhas vendas", "Minhas vendas de hoje", [
        "Toque em **Minhas vendas**: as suas vendas do dia, o total e a situação de cada uma.",
        "Para achar uma venda, digite no campo de **busca** o número, o nome do cliente, o produto ou o pagamento.",
        "Cada linha é uma venda: número, hora, cliente, produtos, pulseiras, pagamento, situação e valor."]),
]
CANCELAR = [
    ("v13-cancelar", "Achar a venda", "Minhas vendas, entrando como supervisor", [
        "No tablet, o **supervisor** entra com o usuário dele e abre **Minhas vendas**. Ele vê as vendas de todos os vendedores. Na linha da venda, toque em **Cancelar**. O botão só aparece enquanto o cliente ainda não foi atendido."]),
    ("v14-motivo", "Motivo e confirmação", "Cancelamento da venda", [
        "Escreva o **motivo do cancelamento** (obrigatório).",
        "Toque em **Confirmar cancelamento**. Para desistir, toque em **Voltar**."]),
    ("v15-cancelada", "Venda cancelada", "Venda cancelada", [
        "Aparece **Venda cancelada** e a linha fica como **Cancelada**. O valor sai do total do dia. Se aparecer \"O vídeo já foi entregue\", a venda não pode mais ser cancelada."]),
]
ENTREGA = [
    ("e01-menu", "Abrir a entrega", "Menu lateral", [
        "Clique em **Entrega dos vídeos**."]),
    ("e02-pulseira", "Ler a pulseira", "Começo da entrega", [
        "Passe a **pulseira** do cliente no leitor (o campo já fica pronto) ou digite o número e tecle Enter.",
        "Sem leitor, clique em **Câmera** e mostre o QR da pulseira.",
        "Em **Agora** estão todos que estão voando, gravando ou com item faltando. Clique em um para abrir."]),
    ("e03-decolar", "Decolar", "Atendimento do cliente", [
        "Confira o **nome** e a **pulseira**.", "Escolha o **piloto** e o **drone**.", "Escolha a **bateria**.", "Clique em **Decolar**."]),
    ("e04-soltar", "Soltar o vídeo", "Área do vídeo", [
        "Tire o cartão de memória do drone e **arraste o vídeo** para esta área (ou clique nela e escolha o arquivo). Use o **.MP4** (ou .MOV); o .LRF não é vídeo. O vídeo já é deste cliente: não precisa escolher a venda."]),
    ("e05-conferir", "Conferir o vídeo", "Vídeo do cliente", [
        "Assista ao **vídeo** e confira se é o do cliente. Errado? Clique em **Descartar** e solte o certo.",
        "O vídeo já começa a ir para a internet: **Enviando à nuvem** e depois **Já na nuvem**."]),
    ("e06-cartao", "Ler o cartão", "Cartão com QR", [
        "Clique em **Ler o QR do cartão com a câmera** e mostre o QR do cartão.",
        "Ou use o **leitor de QR**: com o cursor neste campo, passe o cartão no leitor."]),
    ("e06b-foto", "Foto do cliente", "Passo 4: foto do cliente", [
        "Com o cliente na frente do computador, clique em **Tirar foto do cliente**. Enquanto não houver foto, aparece em vermelho \"Sem a foto do cliente o vídeo não é entregue\" e o **Entregar** fica apagado."]),
    ("e06c-camera", "Tirar a foto", "Câmera do computador", [
        "Peça para o cliente olhar para a **câmera**, de frente e sem boné ou óculos escuros.",
        "Clique em **Tirar foto**. Para desistir, **Cancelar**."]),
    ("e07-entregar", "Entregar", "Cartão lido e foto salva", [
        "Aparece **Foto do cliente salva**, com a foto. Ficou ruim? **Tirar outra foto**. Confira o código do cartão e clique em **Entregar**. Entregue o cartão ao cliente."]),
    ("e08-entregue", "Entregue", "Vídeo entregue", [
        "Aparece **Vídeo entregue**, com o cartão e a hora. **Na nuvem** quer dizer que o cliente já pode abrir; enquanto isso, **Publicando a página do cliente**.",
        "Clique em **Próximo cliente** e leia a próxima pulseira."]),
]
CHUTE_SNAP = [
    ("e10-medalha", "Chute a Gol: itens físicos", "Atendimento do Chute a Gol", [
        "Leia a pulseira e clique em **Chutou** quando o cliente chutar. Ao entregar a medalha (ou a bola), marque o **item**. A foto do cliente e o vídeo são opcionais no Chute a Gol."]),
    ("e11-snap", "Snap Pop: começar", "Atendimento do Snap Pop", [
        "Leia a pulseira e clique em **Começar**. O resto é igual ao Drone: soltar o vídeo, ler o cartão, tirar a foto do cliente (obrigatória) e entregar."]),
]
CLIENTE = [
    ("c01-aceite", "Abrir o vídeo", "Página do vídeo no celular", [
        "O cliente lê o QR do cartão com a câmera do celular e marca a **autorização de uso de imagem**.",
        "Digita o **e-mail**.", "Toca em **Ver meu vídeo**."]),
    ("c02-video", "Assistir e baixar", "Vídeo pronto", [
        "O **vídeo** toca na própria página.", "**Baixar vídeo** salva no celular."]),
    ("c03-fotos-tour", "Fotos do Tour", "Fotos do Tour na página do vídeo", [
        "Se o Eterna achou o cliente nas fotos do Tour (pela foto tirada na entrega), elas aparecem logo abaixo do vídeo. As que ele já comprou têm **Baixar**.",
        "As outras aparecem com a marca d'água; tocar numa delas abre a compra com ela já escolhida.",
        "**Comprar minhas fotos** abre a compra das que faltam. Depois de pagar, ele volta ao vídeo e baixa as fotos ali mesmo."]),
]

SECOES = [("Venda no tablet", VENDA), ("Cancelar uma venda (supervisor)", CANCELAR), ("Entrega do Drone", ENTREGA),
          ("Entrega do Chute a Gol e do Snap Pop", CHUTE_SNAP), ("O que o cliente vê", CLIENTE)]

TREINO = [
    ("Antes", ["Cada pessoa com o seu usuário e senha do Eterna.",
               "Tablet e computador abrindo o servidor de teste: " + TESTE + ".",
               "Alguns cartões com QR e pulseiras de treino, um ingresso de treino e um vídeo curto qualquer (.mp4) no computador do campo.",
               "Tudo o que for feito no servidor de teste não vai para o caixa nem para o cliente."]),
    ("Vendedor", ["Faça 3 vendas: um Drone com 2 pessoas e 4K, um Chute a Gol com medalha e um Snap Pop.",
                  "Em todas, o ingresso de treino, cliente com nome começando por TREINO e uma pulseira de treino por item.",
                  "Numa delas, desligue o Wi-Fi do tablet, registre e veja \"Aguardando envio\"; ligue de novo e veja a venda seguir.",
                  "O supervisor cancela uma das vendas em Minhas vendas, com o motivo."]),
    ("Entrega", ["Leia a pulseira de uma venda de treino.",
                 "Drone: Decolar com piloto, drone e bateria.",
                 "Solte o vídeo de exemplo, leia um cartão de treino, tire a foto de um colega e entregue; depois Próximo cliente.",
                 "Tente ler o mesmo cartão de novo numa outra venda: o Eterna recusa.",
                 "Chute a Gol: Chutou e marque a medalha. Snap Pop: Começar, foto e entregar."]),
    ("Cliente", ["Com o celular, leia o QR do cartão entregue.",
                 "Marque a autorização, digite um e-mail e veja o vídeo; toque em Baixar vídeo.",
                 "Volte à Entrega e veja aparecer \"Cliente abriu… assistiu… baixou…\"."]),
]

PROBLEMAS = [("Tablet sem internet", "Registre normalmente. A venda fica no tablet e segue sozinha quando a rede voltar."),
             ("O QR do ingresso não lê", "Digite o localizador de 12 caracteres impresso no ingresso."),
             ("\"Este cartão já foi usado\" ou cartão recusado", "Pegue outro cartão e separe este para o supervisor."),
             ("\"Nenhuma venda com a pulseira\"", "Confira o número. A venda pode estar aguardando envio no tablet: confira com o vendedor."),
             ("Pulseira em duas vendas", "O Eterna mostra as duas: escolha pelo nome e avise o supervisor."),
             ("\"Pulseira já usada\" no tablet", "Pegue outra pulseira e separe esta para o supervisor."),
             ("Entregar apagado no Drone ou no Snap Pop", "Falta a foto do cliente: clique em Tirar foto do cliente."),
             ("A câmera do computador não abre", "Confira se a câmera está ligada ao notebook e chame a TI."),
             ("Vídeo errado", "Antes de entregar: clique em Descartar e solte o vídeo certo."),
             ("Venda errada ou desistência", "Chame o supervisor para cancelar, antes da entrega."),
             ("Cliente vê \"Seu vídeo está chegando\"", "O vídeo ainda está subindo para a internet. A página atualiza sozinha; peça para aguardar alguns minutos."),
             ("Cliente não achou as fotos do Tour", "Só aparecem se ele foi encontrado nas fotos do dia pela foto da entrega. Ele pode comprar no balcão de fotos.")]
