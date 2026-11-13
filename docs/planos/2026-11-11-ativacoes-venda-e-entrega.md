# Ativações no Eterna: Drone, Chute a Gol e Snap Pop (venda e entrega)

**Situação (11/11/2026):** plano aprovado em conversa com o Ronaldo, ainda sem código. O foco é **venda e entrega**.

**Por quê:** o Eterna deixa de vender só fotos. Passa a vender também as ativações do tour: Drone, Chute a Gol e Snap Pop (vídeo com IA). O sistema que faz isso hoje vai ser desligado. Até lá, o histórico dele entra no Eterna todo dia.

**Nomes:** os produtos se chamam Drone, Chute a Gol e Snap Pop. O sistema que sai de uso é o "sistema antigo".

Este plano substitui as opções do plano de 30/10 (`2026-10-30-maracafly-no-eterna.md`) nos pontos que o Ronaldo decidiu em 11/11. O levantamento tela a tela do sistema antigo está em `maracatour/maracafly-doc/docs`, fora deste repositório.

## 1. Decisões do Ronaldo (11/11)

1. O Eterna vende Drone, Chute a Gol e Snap Pop, além das fotos.
2. **A venda é no tablet, com tela pensada primeiro para tela pequena.** É o mesmo aparelho do Posto de venda.
3. **A venda não pede dado do cliente**, para ser rápida. Não há nome, WhatsApp nem país.
4. **A entrega é por QR, ligado no campo, na hora da entrega.** Quando o cartão de memória sai do drone, a equipe lê o QR de um cartão, liga esse QR ao vídeo e entrega o cartão ao cliente. O cliente abre a galeria pelo QR, informa o e-mail, faz a selfie e baixa o vídeo, como já acontece com as fotos. A venda não lê QR. **Não há entrega por WhatsApp.**
5. **O vídeo fica na nuvem da AWS**, no mesmo lugar da galeria.
6. **O Drone também tem fotos.** Elas ficam com as outras fotos do tour, na sessão do cliente, e são vendidas no checkout das fotos. O QR do vídeo serve só para o vídeo.
7. **Cortesia vale para as ativações**, com a mesma regra da Cortesia SAC: motivo, nota e quem deu.
8. **O admin troca preço** e pode desligar um produto no dia ("hoje não vendo").
9. **Por enquanto, vídeo do Drone e Chute a Gol só se compram no local.** A compra online (Imply, plano `2026-11-11-compra-online-pela-imply.md`) continua só para fotos. As ativações entram nela depois.
10. **O histórico do sistema antigo entra no Eterna.** Primeiro, as planilhas exportadas de 01/10 a 11/11. Depois, **a partir de 12/11, as vendas novas entram todo dia, à noite, depois das 19h, quando o tour termina**, até o Ronaldo avisar que o sistema antigo foi desligado.
11. **A venda é local first (12/11):** o vendedor vende com tudo na mão, sem depender de internet nem do servidor. Nada de vídeo carregando ou baixando na hora da venda: os vídeos de demonstração ficam guardados no tablet (seção 3, item 2).
12. **Fora deste plano:**
    - escala da equipe;
    - central de WhatsApp;
    - voos e telemetria;
    - comissão interna.

## 2. Catálogo

Produtos e preços praticados hoje, conferidos no levantamento do sistema antigo (docs 02 e 17) e nas vendas de 01/10 a 11/11. Esses são os valores da carga inicial. Depois disso, quem muda preço é o admin. **Nenhum preço fica fixo no código.**

| Produto | Local | Preço |
|---|---|---|
| Drone, Asteroid | Campo ou Arquibancada | R$ 180 |
| Drone, Boomerang | Campo ou Arquibancada | R$ 120 |
| Drone, Boomerang com chuva | No modo chuva, só o Boomerang é vendido | R$ 180 |
| Drone, Inside Out | Campo ou Arquibancada | R$ 220 |
| Drone, Inside Out | Banco de Suplentes | R$ 250 |

Adicionais do Drone:

- **4K:** + R$ 70.
- **Pessoas no vídeo:** de 1 a 4 na demonstração. Nas vendas de outubro, o preço não mudou até 8 pessoas, então a cobrança por pessoa extra começa desligada.

| Chute a Gol | Preço |
|---|---|
| 3 Chutes | R$ 110 |
| 5 Chutes | R$ 140 |
| 3 Chutes + Medalha + Vídeo | R$ 149 |
| 5 Chutes + Medalha + Vídeo | R$ 169 |
| 5 Chutes + Mini bola + Medalha + Vídeo | R$ 229 |
| 5 Chutes + Bola Semi-Pro + Medalha + Vídeo | R$ 259 |
| 5 Chutes + Bola Pro + Medalha + Vídeo | R$ 279 |
| Avulsos: Medalha R$ 60 · Mini bola R$ 115 · Bola Semi-Pro R$ 170 · Bola Pro R$ 195 | |

| Snap Pop (vídeo com IA; tema Brasil, Flamengo ou Fluminense) | Preço |
|---|---|
| 1 vídeo | R$ 110 |
| 2 vídeos | R$ 190 |
| 3 vídeos | R$ 290 |
| A partir do 4º | + R$ 90 cada |

Cada produto do catálogo tem:

- **Categoria:** Drone, Chute a Gol ou Snap Pop.
- **Tipo de entrega:** vídeo, foto ou item físico. Medalha e bola são itens físicos.
- **Variações** por local, cada uma com preço próprio.
- **Regras de preço:**
  - valor por pessoa extra e limite de pessoas;
  - adicional 4K;
  - vale com chuva;
  - restrição de local.
- **O que a venda pede:** participantes (chutes), pessoas no vídeo, ou nenhum dos dois.
- **Ativo** e **ativo hoje**. "Ativo hoje" desliga o produto só naquele dia e volta sozinho no dia seguinte.

A tela de admin é uma aba nova em **Preços e Checkout**, com a mesma permissão `catalogo`. Desligar no dia fica liberado também para o supervisor.

## 3. Venda no tablet

Uma tela nova no menu Venda, com o título **Drone, Chute a Gol e Snap Pop** (sem a palavra "Ativações", Ronaldo, 12/11). Ela segue o padrão visual do Posto de venda. Feita na v99.17.3 e refeita na v99.17.4, sem o recibo impresso, que fica para depois.

No topo, o nome de quem está logado e a situação do envio. Duas abas: **Nova venda** e **Minhas vendas**.

A Nova venda segue esta ordem (12/11):

1. **Serviço:** Drone, Chute a Gol, Snap Pop. Aparecem só os produtos ativos hoje. O Snap Pop é vídeo com IA, não voo: conta "Vídeos com IA".
2. **Pessoas no vídeo e vídeo de demonstração (Drone):** o vendedor escolhe de 1 a 5 pessoas. Cada produto tem um botão **Ver vídeo com N pessoas**, que abre em tela cheia o vídeo daquele produto, local e número de pessoas, para convencer o cliente.
   - Os vídeos ficam no servidor do ponto, em `~/Eterna/ativ-demo/<produto>_<campo|arquibancada|banco>_<pessoas>.mp4` (35 vídeos em 720p sem áudio, 199 MB; os originais em 1080p estão fora do repositório).
   - O tablet copia os vídeos em segundo plano para o IndexedDB (`eterna-ativ`, store `demo`), sem barra e sem espera, e só baixa de novo quando o arquivo muda no servidor. Na venda, o vídeo toca do tablet.
   - Vídeo que ainda não está no tablet toca do servidor do ponto, se houver rede. Sem os dois, a tela diz que o vídeo ainda não está no tablet e a venda segue.
   - Rotas: `GET /ativ/demo/lista` e `GET /ativ/demo/<nome>` (com `ativvenda.r` ou `catalogo.r`).
3. **Venda (carrinho, v99.18.3):** tudo se escolhe no card antes de **Adicionar**: local, 4K, chuva e o número de pessoas (no Chute a Gol, participantes), de 1 a 5. O preço do card já mostra o valor com essas escolhas.
   - A linha da venda não se edita: tem só a **lixeira**. Para mudar, tira e coloca de novo. O mesmo produto com a mesma escolha soma na linha ("2×").
   - O número de pessoas não muda o preço do drone; acréscimo por pessoa só se o admin configurar em Preços.
   - **Preço fixo (decidido 12/11):** vale o preço do catálogo, com os adicionais somados sozinhos. O vendedor não digita valor, diferente do sistema antigo, que aceitava desconto ou acréscimo.
4. **Cliente:** país numa lista com bandeira, com os principais no topo e todos os países do mundo em ordem alfabética; idioma numa lista com Português, Espanhol, Inglês, Francês, Alemão, Italiano e Outro. O nome fica gravado em português. O idioma serve para o recibo e a galeria abrirem no idioma dele. O país alimenta o resumo por país. Nenhum dos dois identifica a pessoa.
   - **Nome e foto do cliente (v99.19.0, Ronaldo, 12/11):** o nome é obrigatório e a foto, tirada pela câmera do tablet, é opcional. A câmera abre dentro da própria tela, com o botão **Tirar foto** (v99.19.1), quando a página é segura (https ou o próprio computador do servidor); em http pela rede (tablet em `http://192.168.x.x:8799`) o navegador não deixa, e o botão usa o seletor do aparelho, que no Android abre a câmera direto. Para a câmera na tela e a leitura do QR funcionarem no tablet, o servidor do ponto precisa de https (seção 8). Servem só para quem entrega o vídeo reconhecer a pessoa no campo, a quase 1 km do foyer onde ela comprou. A foto é reduzida no tablet (480 px, JPEG) e vai junto com a venda. No servidor do ponto ela fica em arquivo (`~/Eterna/ativ-clientes/<venda>.jpg`), fora do banco e fora da nuvem, e só a tela de entrega a abre (`GET /ativ/cliente-foto`, `ativentrega.r`). **LGPD:** o nome e a foto saem sozinhos um dia depois da entrega ou dois dias depois da venda, o que vier primeiro (limpeza de hora em hora). No tablet, a foto sai da caixa de saída assim que o servidor recebe a venda.
**Resumo da venda** (v99.18.3): logo antes de Registrar, como na compra de passagem: os itens descritos, o cliente (nome, país e idioma, com a foto), o pagamento e o total.
5. **Pagamento:** PIX, Dinheiro, Débito, Crédito ou **Cortesia**. Na Cortesia, o motivo e o relato são obrigatórios: o vendedor conta o que aconteceu num campo de texto grande (até 1000 caracteres). O motivo "Falha na operação" não diz qual foi a falha; quem conta é o vendedor (12/11).
6. **Registrar** (botão fixo embaixo): grava a venda no próprio tablet na hora, com número próprio e quem vendeu, e envia ao servidor do estádio. Imprime o recibo no idioma do cliente, se houver impressora no posto.
   - Uma venda igual registrada em até 2 minutos pelo mesmo vendedor pede confirmação.

**Fora da tela (12/11):** o guia não é escolhido na venda; a escolha dele fica no projeto de guias que já existe. Não há agendamento de voo.

**Local first:** a venda nunca espera a rede.
- O catálogo fica guardado no tablet. A tela de venda abre e vende sem internet e sem o servidor.
- A venda é gravada no tablet na hora, numa caixa de saída, com um código gerado no próprio tablet. O envio ao servidor do estádio, pela rede local, acontece em seguida.
- Sem rede, a venda fica na caixa de saída com a situação "Aguardando envio" e é reenviada sozinha. O servidor reconhece o código, então reenviar nunca duplica.
- O dono do dado continua sendo o servidor (`2026-11-10-dado-no-banco.md`): a caixa de saída só guarda o que ainda não chegou lá. A venda acontece só dentro do estádio e nunca depende da nuvem.

**Nenhuma venda se perde no tablet (12/11):**
- A venda é gravada em duas cópias no tablet: `localStorage` (`eterna.ativ.saida.v1`) e IndexedDB (`eterna-ativ`). A tela só diz "registrada" depois que pelo menos uma das duas gravou. Se nenhuma gravar, o carrinho continua na tela com o aviso.
- Ao abrir o app, as duas cópias são juntadas. Se uma sumir, a outra a devolve.
- A venda só sai da caixa de saída com o ok do servidor (`POST /ativ/venda`, que devolve as recebidas). Sem rede, o tablet tenta de novo a cada 5 s e quando o aparelho volta à rede. Venda que o servidor já tem conta como recebida, sem duplicar.
- Venda recusada pelo servidor nunca é apagada. Ela fica no tablet com a situação "Recusada pelo servidor", e o botão **Salvar cópia das vendas não enviadas** baixa um arquivo com elas.
- Sair da conta, trocar de vendedor ou atualizar o app não mexem na caixa de saída. O app pede ao navegador armazenamento persistente.
- O servidor confere só o formato. Produto e preço diferentes do catálogo do servidor não são recusados, porque o tablet pode ter vendido com o catálogo que tinha.
- O cancelamento precisa do servidor. **O vendedor não cancela** (12/11): só o administrador e quem tem `ativvenda.d` ou `financeiro.u`, e só enquanto o vídeo não foi entregue (venda com entrega ou QR ligado devolve 409). O botão Cancelar só aparece para quem tem a permissão. A venda cancelada continua no banco, com motivo, quem e quando, e sai do Resumo.
- Um carrinho com mais de um serviço vira uma venda por serviço, com o mesmo número. Assim o resumo por serviço fica certo.

Todo texto novo entra nos idiomas: `EQ`/`TE` nas telas da equipe e `I18N`/`T` no recibo e na galeria. O teste `testes/idiomas.js` cobra as chaves.

## 3b. Vendedores

Cada vendedor tem cadastro próprio no Eterna, com nome e login. Hoje são 12 tablets, cada um com o seu vendedor. A lista de tablets e logins fica com o Ronaldo e entra direto no cadastro do servidor, fora deste repositório.

- **Módulo próprio, `ativvenda` (12/11):** Criar = registrar venda; Ver = abrir a tela e ver as próprias vendas; Excluir = cancelar venda com o vídeo não entregue. A tela saiu do módulo Posto de venda.
- **Perfil pronto "Vendedor Drone, Chute a Gol e Snap Pop":** só `ativvenda` Criar e Ver, menu só com a tela de venda, que abre direto ao entrar. O vendedor não vê o resto do sistema e não cancela. O Supervisor tem o módulo inteiro; o Admin, como sempre, tudo.
- **Login:** o admin cadastra a pessoa em Usuários, escolhe o perfil acima e gera a senha provisória em Senhas de acesso. No tablet, o vendedor entra com o e-mail e a senha e troca a senha no primeiro acesso.
- **Quem está logado:** o tablet chama o servidor a cada 30 s com a tela aberta. No Resumo, o painel **Equipe agora** mostra cada vendedor visto nas últimas 16 h: "Conectado" (visto há menos de 2 min) ou "Visto há N min". Rota `GET /ativ/equipe` (com `estatisticas.r`, `financeiro.r` ou `ativvenda.d`). Fica só na memória do servidor.
- A venda grava quem vendeu, e o resumo mostra o vendedor pelo nome.
- As vendas importadas do sistema antigo são ligadas ao vendedor pelo nome. Um nome que não estiver no cadastro aparece como veio.

## 4. Entrega

**O QR é ligado no campo, na entrega.** A venda fica na fila do produto sem QR. Na hora de entregar:

1. a equipe abre a venda na fila (Drone, Chute a Gol ou Snap Pop);
2. a câmera do tablet lê o QR de um cartão novo;
3. o vídeo é enviado e fica ligado à venda e a esse QR;
4. o cartão vai para o cliente.

Regras:

- Uma venda pode ter um QR por vídeo. Um QR já usado é recusado.
- Só aceita arquivo de produto que entrega vídeo.

**Envio:** o vídeo sai do cartão de memória do drone e é enviado pela tela da fila, ou pela pasta vigiada do agente no servidor do estádio, que já faz isso com as fotos.

- O arquivo sobe para o S3 em partes, mostrando progresso e velocidade.
- Tamanho, duração, resolução e miniatura saem do próprio arquivo.
- O cliente pode ler o QR enquanto o envio termina. A galeria mostra "seu vídeo está chegando" até o arquivo ficar pronto.

**Galeria:** o QR abre a galeria no eterna.photo. O caminho é o mesmo das fotos:

1. o cliente informa o e-mail;
2. faz a selfie e dá o aceite de imagem;
3. baixa o vídeo.

A galeria conta os downloads de cada arquivo.

**Fotos do Drone:** ficam com as outras fotos do tour, na sessão do cliente, e são vendidas no checkout das fotos com os pacotes de sempre. Não passam pelo QR do vídeo.

**Itens físicos:** medalha e bola recebem baixa de "entregue" um a um. A venda fica **entregue**, com data e hora, quando todos os itens estiverem entregues.

**Fila do Drone:** lista as vendas de Drone ainda não voadas, por horário de execução. Para cada venda, o host marca:

- **recebido**;
- **voo feito**, com piloto, drone e bateria;
- **entregue**, quando o QR é ligado ao vídeo (passos acima).

Pilotos, drones e baterias têm cadastro simples, com ativo e inativo.

**Prazo da galeria e LGPD:**

- **O vídeo fica 30 dias na nuvem** e depois é apagado. Cada vídeo tem no máximo 30 segundos.
- O vídeo de venda cancelada é apagado.
- A venda não guarda dado pessoal. E-mail e selfie seguem as regras atuais da galeria.

### 4a. Feito na v99.18.0: entrega no servidor do ponto e no tablet

Tela **Entrega dos vídeos** (menu Venda), módulo `ativentrega` (Criar = ligar o QR e mandar o vídeo; Ver = a fila; Alterar = recebido, voo, itens e o cadastro) e perfil pronto **Equipe de campo** (só esta tela). O Supervisor tem o módulo inteiro.

- **Fila do dia** por serviço (Drone, Chute a Gol, Snap Pop), com Pendentes e Entregues, na ordem da venda (não há agendamento de voo, 12/11). Situação em palavras: "Aguardando o cliente", "Aguardando voo", "Aguardando vídeo", "Entrega pendente", "Entregue".
- **Cliente chegou** e **Voo feito** (Drone): o voo pede piloto, drone e bateria, escolhidos do cadastro ativo. O cadastro fica no fim da tela: inclui e liga ou desliga, nunca apaga.
- **Entregar o vídeo (v99.18.4, fluxo do computador do ponto, decisão do Ronaldo em 12/11):** o drone pousa, alguém abre o cartão de memória no computador e:
  1. **arrasta o vídeo para a tela** (ou toca para escolher o arquivo). O vídeo já começa a subir para o servidor do ponto, com barra de progresso e velocidade, enquanto a pessoa segue;
  2. **confere o vídeo**, que toca ali mesmo (do próprio arquivo, sem esperar o envio); "Descartar" desiste;
  3. **escolhe a venda** na lista das vendas do dia que esperam vídeo, de todos os serviços. A **lixeira** cancela a venda, com motivo, para quem pode cancelar (seção 5) e só enquanto nenhum vídeo dela foi entregue. Drone sem voo marcado pede piloto, drone e bateria ali mesmo;
  4. **lê o QR de um cartão novo** pela câmera (`BarcodeDetector`, Chrome do Android) ou pelo leitor, que digita o link; colar o link também vale. Cartão já usado é recusado na hora;
  5. **Entregar vídeo** liga o vídeo à venda e ao cartão. A partir daí o QR é a chave do cliente.
- **Servidor do ponto:** `POST /ativ/video` (um vídeo por vez, até 1 GB) recebe o arquivo, confere que é mp4/mov, lê a duração do próprio arquivo e guarda como rascunho (`~/Eterna/ativ-videos/rascunho-<id>.mp4`). `POST /ativ/video/liga {rascunho, venda, qr}` confere a venda (ativa e ainda sem todos os vídeos que comprou) e o QR (formato, nunca usado numa entrega nem numa galeria de fotos), passa o arquivo para `~/Eterna/ativ-videos/<qr>.mp4`, grava a linha em `ativ_entrega` e o QR na venda. Rascunho que não virou entrega sai em um dia.
- **Itens físicos** (medalha, bola, do catálogo do pacote): baixa um a um. A venda fica **entregue**, com data e hora, quando todos os vídeos têm QR e todos os itens tiveram baixa. Entregue não cancela.
- **Nuvem:** o vídeo entra numa fila própria (`nuvem.db`, tabela `videos`) e sobe para `video/<qr>.mp4` no bucket em partes de 8 MB, conferindo o tamanho no fim. Sem internet, tenta de novo com espera crescente. A tela mostra "Aguardando internet", "Subindo N%" ou "Na nuvem".
- **Galeria do vídeo:** o QR vira o token de uma galeria `tipo: "video"` (manifesto com o vídeo, o idioma da venda e validade de 30 dias), publicada pela fila de galerias de sempre.
- **Prazo:** o arquivo sai do servidor do ponto depois de 30 dias (limpeza diária); a linha da entrega fica como registro.
- Rotas: `GET /ativ/fila?dia=`, `POST /ativ/etapa`, `POST /ativ/video`, `POST /ativ/video/liga`, `GET|POST /ativ/cadastros`. Testes: `testes/ativacoes_entrega_agente.py` e `testes/ativacoes_entrega.js`.

### 4a.1 Fila por ativação (v99.21.0, Ronaldo, 12/11)

Igual à Fila de fotos: em cada serviço (Drone, Chute a Gol, Snap Pop) quatro colunas no lugar de Pendentes/Entregues.

| Coluna | Drone | Chute a Gol | Snap Pop | Entra quando |
|---|---|---|---|---|
| 1 | Próximo a voar | Próximo a chutar | Próximo a gravar | a venda chega do tablet |
| 2 | Voando | Chutando | Gravando | Drone: **Decolar** (piloto, drone e bateria). Chute e Snap: **Começar** |
| 3 | Delivery do vídeo | Delivery do vídeo | Delivery do vídeo | o primeiro vídeo ligado a um cartão (ou, sem vídeo, só faltam itens) |
| 4 | Entregue | Entregue | Entregue | todos os vídeos com cartão e todos os itens com baixa |

- O card de Voando lembra de arrastar o vídeo do cartão de memória no topo da tela. No fluxo do vídeo, as vendas que já voaram ou começaram aparecem primeiro.
- O cadastro de pilotos, drones e baterias só aparece no Drone e diz para que serve.
- O aviso de erro da fila separa "sem permissão", "erro do servidor" e "sem conexão".

**Cadastro de pilotos, drones e baterias (v99.21.1):** botão **Carga inicial** com a frota do sistema antigo: drones 006, 007, 141, 228, 999, LARANJA e ROSA e baterias 1 a 20 (`POST /ativ/cadastros {carga: [...]}` inclui só o que falta e não religa quem foi desligado). Pilotos são pessoas: entram pelo cadastro na tela (ou direto no banco do servidor do ponto), nunca pelo código.

**Fora de venda no dia (v99.21.1, como "Configuração de experiências" do sistema antigo):** em Catálogo › Ativações, além do "Hoje não vendo" do produto, cada local (ou tema) de um produto com mais de um tem o seu: por exemplo, o Banco de Suplentes sai e Campo e Arquibancada seguem. Produto sem nenhum local à venda sai; serviço sem nenhum produto à venda some da tela de venda. Tudo volta sozinho no dia seguinte. Gravado em `ativ/hoje|<produto>.<local>`.

### 4b. Feito na v99.20.0: o vídeo na galeria da nuvem

Decidido em 12/11: o QR abre o vídeo direto, com o aceite de uso de imagem e o e-mail, **sem selfie** (o reconhecimento de rosto não compara com vídeo, e o cartão físico já prova a compra). Fica registrado, com data e hora, quando o cliente abriu o QR, aceitou, deu play e baixou.

- **Nuvem** (`servidor/galeria-nuvem/app.py`): aceita o manifesto `tipo: "video"` (os vídeos em `video/<qr>.mp4`; cartão de vídeo não vira galeria de fotos e vice-versa). Rotas:
  - `GET /g/<token>/info`: tipo, serviço e "chegando" enquanto o arquivo não está no bucket;
  - `POST /g/<token>/video {consentimento, email, marketing, idioma, versao}`: grava o aceite (`CON#`, tipo `video`) e o e-mail como lead; devolve um acesso que vale até a galeria vencer e o link do vídeo (1 h);
  - `POST /g/<token>/galeria {acesso}`: renova os links;
  - `POST /g/<token>/evento {acesso, tipo: "video_play", v}`: o play;
  - `GET /g/<token>/baixar?v=&a=`: registra o download e redireciona (302) para o arquivo com `attachment` (`viva-maracana-<serviço>.mp4`); o vídeo não passa pela memória do celular;
  - `GET /ponto/eventos?tokens=` (segredo do ponto): abriu, aceite, play e baixou de até 50 cartões, sem IP nem e-mail.
- **Página do cliente** (`#g/<token>`): título do serviço, aceite e e-mail (novidades opcionais), depois o player e o botão **Baixar vídeo**. "Seu vídeo está chegando" confere de 15 em 15 s. O aceite vale para o aparelho até a galeria vencer; sem rede o acesso guardado não se perde, só a recusa da nuvem o apaga.
- **Servidor do ponto:** de 2 em 2 minutos busca esses registros dos vídeos já na nuvem (31 dias) e guarda em `ativ_entrega.cliente_eventos`. A tela de entrega mostra em cada vídeo "Cliente abriu 13:01 · assistiu 13:03 · baixou 13:06 (2×)", ou "Cliente ainda não abriu o vídeo".
- Testes: `servidor/galeria-nuvem/teste_local.py` (parte do vídeo), `testes/galeria_video.js`, `testes/ativacoes_entrega_agente.py`.

**Para ir ao ar (Ronaldo, nunca a partir de `idiomas-base`):** `sam deploy` da nuvem (rotas novas `GET /g/{token}/baixar` e `GET /ponto/eventos` no `template.yaml`); no bucket, regra de prazo para o prefixo `video/` (apagar em 30 dias); na política do usuário do agente, `s3:AbortMultipartUpload`.

**Ainda falta:** versão leve (1080p) para tocar no celular antes do original e quadros do vídeo como fotos no Checkout. Os dois pedem o ffmpeg no servidor do ponto (download a autorizar).

### 4c. Feito na v99.22.0: fotos do Tour pela foto da venda

Pedido do Ronaldo (12/11): aproveitar a entrega do vídeo para vender as fotos do Tour que o cliente não comprou no estádio (ticket médio). LGPD: aviso e aceite do cliente.

- **Venda (tablet):** com a foto do cliente tirada, aparece a caixa "O cliente autoriza usar esta foto para encontrar as fotos dele do Tour", desmarcada. Marcada, a venda leva `cliente_foto_busca: true`. Sem foto, a caixa não aparece, e o servidor só aceita o aceite junto com a foto (`ativ_venda.foto_busca`).
- **Servidor do ponto:** a foto da venda é procurada nas fotos do dia com o mesmo reconhecimento das selfies (`buscar`, dia todo, sem janela), localmente; a foto nunca vai à nuvem e continua saindo sozinha no prazo de sempre (seção 4a). Entram só as fotos com semelhança ≥ `LIMITE` em que ele é o **rosto principal**; base de IA nunca entra. Até 60 fotos.
  - As fotos formam uma **galeria de venda própria** (`tipo: "sessao"`, `origem: "ativ"`, token novo guardado em `ativ_venda.tour_token`/`tour_n`), com os preços e o catálogo online da galeria de venda mais recente. Sem nenhuma galeria de venda para copiar preço, nada é criado (tenta de novo depois).
  - Quando roda: ao gravar o vídeo da venda e de hora em hora (antes da limpeza da foto), para quem aceitou e ainda tem a foto: o Tour pode acontecer depois do voo. A galeria **só cresce**: foto que entrou não sai, e a comprada nunca volta a "à venda".
  - O manifesto do vídeo ganha `tour: {token, n}`, e os vídeos já entregues da venda são republicados com ele.
- **Nuvem:** o vídeo guarda `tour` (token válido e diferente do cartão) e só o mostra se a galeria do Tour existe, é de venda, não venceu e não foi encerrada.
- **Página do vídeo (v99.22.0):** abaixo do vídeo, "Encontramos N fotos suas do Tour" e **Ver minhas fotos**, que abria a galeria das fotos com a selfie de sempre.
- **Mudança da v99.23.0 (pedido do Ronaldo, 12/11):** o cliente desistia no botão e na selfie, e a venda se perdia. Agora as fotos aparecem na própria página do vídeo, sem selfie:
  - **Por que pode ser sem selfie:** a galeria do Tour de uma ativação só tem as fotos em que o cliente é o rosto principal, achadas pela foto da venda com o aceite dele. A selfie confirmaria o que a foto da venda já confirmou.
  - **Nuvem:** a galeria do Tour guarda `origem: "ativ"`. Ao abrir o vídeo (acesso do vídeo válido), `video_obj` devolve `tour.acesso` e `tour.galeria`. O acesso é próprio da galeria do Tour: `"t"` + HMAC(`SEGREDO_PONTO_SHA256`, `tour:<acesso do vídeo>:<token>`)[:31], gravado como `ACE#` com todas as fotos de agora e validade igual à menor entre o acesso do vídeo e a galeria. Galeria do Tour sem `origem: "ativ"` continua pela selfie.
  - **Página:** até 8 miniaturas, compradas primeiro, sem marca d'água e com **Baixar** (o original); à venda com marca d'água. Tocar numa foto à venda, ou em **Comprar minhas fotos**, guarda o acesso no `sessionStorage` (`eterna.gq.tour`, 12 h) e abre `#g/<token do Tour>` direto na galeria, com aquela foto marcada. A galeria mostra **Voltar ao vídeo**, e a compra é a online de sempre.
  - Até o `sam deploy`, a nuvem não manda o acesso e a página mostra o botão antigo.

### 4d. Cartões com QR: lotes no servidor (v99.23.7 a v99.24.0, Ronaldo, 12/11)

Os cartões são impressos por gráfica e ficam no Maracanã. Preocupação do Ronaldo: gerar uma lista, não imprimir, gerar outra, e perder o controle (ou repetir número).

- **Onde:** Configurações › Preços e Checkout › Avançado › Cartões com QR impresso. Precisa do servidor do ponto e de `catalogo.u`.
- **O servidor gera e guarda** cada cartão (tabelas `cartao` e `cartao_lote` no `vendas.db`; `cartao_lote` no agente). Token (QR) com 22 caracteres aleatórios e código digitável de **12 letras** `XXXX-XXXX-XXXX` (antes 8). Os dois são chave única no banco: **não repetem entre lotes**, nunca.
- **Um lote "na gráfica" por vez**, até 10.000 cartões. Enquanto ele está na gráfica, o botão só **baixa o mesmo arquivo de novo** (cada download fica contado). Lote novo só depois de **Marcar recebido** ou **Cancelar lote**. A tabela mostra quem gerou, quando, quantos já foram usados e quem mudou a situação.
- **Lote cancelado** (não foi impresso, ou os cartões se perderam): na entrega, os cartões dele são recusados (`cartao_cancelado`). Cartão que não veio de lote nenhum também (`cartao_desconhecido`), a partir do primeiro lote gerado no servidor.
- **Na nuvem** o código digitável nunca troca de dono (`codigo_liga`/`codigo_solta` em `servidor/galeria-nuvem/app.py`): se dois tokens dessem o mesmo código, o código fica com o primeiro; o outro abre só pelo QR. A nuvem e a página do cliente aceitam 8 letras (galerias de fotos) e 12 (cartão). **Precisa de `sam deploy`.**
- Testes: `testes/cartoes_lote_agente.py`, `testes/cartoes_lote.js`, `servidor/galeria-nuvem/teste_local.py`.

### 4e. Atendimentos ao mesmo tempo, como pedidos de delivery (v99.29.0, Ronaldo, 13/11)

- A entrega só se abre pela pulseira (lida pela câmera ou digitada). Cada pulseira é um pedido, e a área de soltar o vídeo fica dentro dele, já identificada: não há escolher venda nem conferir rosto.
- Vários pedidos andam juntos. A lista "Agora" mostra cada um com o estado (voando, vídeo subindo, falta o cartão, entrega marcada). Em tela larga, a lista e a leitura da próxima pulseira ficam à esquerda e o pedido aberto à direita; em tela estreita, o pedido aberto fica em cima.
- O vídeo solto num pedido continua subindo quando se abre outro pedido ou se toca em Próximo cliente.
- Com o cartão lido e o vídeo ainda subindo, o botão vira "Entregar quando o vídeo terminar de subir". Tocou, a entrega fica marcada e conclui sozinha no cartão daquele pedido quando o vídeo chega ao servidor.
- Exemplo com dois voos: lê a pulseira A e decola; lê a B e decola. A pousou: toca no pedido A, solta o vídeo, lê o cartão, Entregar. Sem esperar, toca no pedido B e faz o mesmo.

## 5. Vendas: listar, editar, cancelar

- **Minhas vendas (vendedor):** as vendas do dia com número, hora, QR, itens, pagamento e valor, e os totais por forma de pagamento.
  - O vendedor cancela ou reagenda a própria venda, com confirmação.
- **Vendas das ativações (supervisor e gestor):** todas as vendas, atualizando sem recarregar.
  - **Situação em palavras:** "Aguardando arquivo", "Entrega pendente", "Entregue", "Cancelada".
  - **Filtros:** produto, data e drone. **Busca:** número ou QR.
  - **Totais do filtro:** vendas, arquivos, pessoas e valor.
  - **Edição:** feita por formulário. Cada mudança grava quem mudou, quando, o valor anterior e o novo. Ao trocar itens, dá para manter o valor negociado.
  - **Cancelamento:** pede motivo. Venda cancelada não some; aparece separada.
- **Resumo no celular** (tela **Resumo das ativações**, no Dashboard, feita na v99.17.2): para o gestor acompanhar de qualquer lugar, como o resumo do sistema antigo, que o Ronaldo usa hoje. Fica no módulo Números de vendas, e quem já via a Lista de vendas ganha a tela no menu.
  - **Filtros:** produto (Drone, Chute a Gol, Snap Pop); dia, semana ou mês, com setas e arrastar para mudar o dia.
  - **Totais:** total vendido, número de vendas e de vídeos.
  - **Por pagamento:** vendas e valor de PIX, Crédito, Dinheiro, Débito e Cortesia.
  - **Por vendedor:** vendas e valor, do maior para o menor, pelo nome.
  - **Serviços vendidos:** quantidade por produto e local.
  - **Por país:** vendas e valor.
  - Atualiza sozinho a cada minuto; quando a venda no tablet entrar, a cada venda nova, com som opcional.
  - Filtro extra "Todos os serviços" e escolha de data, com o botão Hoje.
  - **Tempo de cada etapa** (v99.27): das vendas do tablet no período, quantas chegaram a cada etapa (vendido, chegou ao campo, decolou ou começou, vídeo entregue, vídeo na nuvem, cliente abriu, cliente baixou), em quantidade e porcentagem, e a mediana do tempo desde a etapa anterior que a venda tem. Embaixo, a velocidade real do envio dos vídeos à nuvem no período (vídeos, MB, tempo por vídeo e Mbit/s, medianas), medida pelo próprio servidor a cada envio. Rota `GET /ativ/vendas` devolve `etapas` (segundos) em cada venda do tablet e `envio`.
- **Painel e Estatísticas:** as ativações entram com as fotos:
  - receita por produto, por vendedor e por forma de pagamento;
  - valor da Cortesia (o preço do catálogo que foi dado);
  - arquivos entregues e baixados.

As vendas importadas do sistema antigo aparecem nas mesmas telas, com a origem "Sistema antigo", e só para leitura.

## 6. Histórico do sistema antigo

**Como funciona (feito na v99.17.2):**

- O importador é `agente/ativacoes-importar.py`. Ele roda no servidor do ponto, com o mesmo HOME do agente, e grava na tabela `ativ_venda` do `vendas.db`.
- Ele aceita dois tipos de arquivo:
  - a planilha exportada do sistema antigo (`.csv` com separador `;`; Chute a Gol e Snap Pop vêm em seções `##chute_gol` e `##snap_pop`);
  - a extração diária das telas de venda (`.json`), descrita abaixo.
- Nome, WhatsApp e foto do cliente são lidos e descartados no importador. O agente também recusa qualquer venda que traga um campo fora da lista (`ATIV_VENDA_CAMPOS`).
- O que é gravado: dia e hora, itens (produto, local ou tema, quantidade), valor em reais, pagamento, vendedor, pessoas ou participantes, vídeos, resolução, país, idioma, guia, piloto, drone, bateria, entrega e QR.
- Ajustes na leitura:
  - venda de R$ 0 vira **Cortesia**;
  - "asteroid_campo" vira produto Asteroid com local Campo;
  - FLA, FLU e BRA viram Vídeo com IA com o tema;
  - o idioma é gravado em português;
  - o país é gravado sem o DDI.
- **Vendedor:** a extração diária mostra "VendedorNN". A opção `--vendedores` aponta para a lista dos 12 tablets, que fica fora do repositório, e troca o número pelo nome.
- **Chave:** a origem mais o ID antigo. Rodar duas vezes não duplica nada, e uma venda corrigida no sistema antigo é atualizada.
- **Leitura:** a rota `GET /ativ/vendas?de=&ate=` exige Estatísticas, Financeiro ou Relatórios. Ela alimenta o Resumo das ativações (seção 5).

**Carga inicial (de 01/10 a 11/11):** as duas planilhas exportadas pelo Ronaldo e as extrações diárias da auditoria de vendas. As planilhas ficam no computador do Ronaldo e **não entram no repositório**.

**Vendas novas, todo dia, até o desligamento:**

- **Horário:** 19h30, depois que o tour termina.
- **Fonte:** o extrator de vendas da auditoria diária, que lê as telas de venda do sistema antigo pelo Chrome do Ronaldo, só para leitura. Ele gera o mesmo `.json` que o importador já lê, sem dado de cliente.
- O robô da VM do portal de parceiros não é usado nesta etapa.
- A auditoria das 07:30 continua como está. Se a puxada da noite falhar, a do dia seguinte cobre o dia que faltou, porque reimportar não duplica.
- Quando o Ronaldo avisar o desligamento, a tarefa da noite é desligada, e as vendas antigas ficam no Eterna como histórico.

## 7. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1. Catálogo e admin | Produtos, variações, regras de preço, ativo hoje | O admin cadastra os produtos da seção 2 e desliga um deles no dia |
| 2. Venda no tablet | Tela Ativações, carrinho, cortesia, recibo, Minhas vendas | Venda completa em menos de 60 s no tablet, com teste automático |
| 3. Histórico | Importador das planilhas e passo diário na tarefa da auditoria | Totais por dia no Eterna iguais aos do sistema antigo |
| 4. Entrega | QR lido no campo e ligado ao vídeo, S3 em partes, vídeo na galeria, fila do Drone, itens físicos | O cliente baixa o vídeo pelo QR, com e-mail e selfie |
| 5. Gestão | Vendas das ativações com edição registrada, Painel e Estatísticas | Fechamento do dia por produto, vendedor e pagamento |

A fase 3 pode correr junto com as fases 1 e 2, porque não depende de tela nova.

Cada fase vira uma versão em `VERSOES.md` e tem teste em `testes/`.

## 8. Em aberto

- **https no servidor do ponto (12/11):** o navegador só abre a câmera dentro da página (leitura do QR do cartão e foto do cliente com Tirar foto) em página segura. Caminho definitivo: um endereço próprio (por exemplo `ponto.eterna.photo`) apontando para o IP do servidor na rede do estádio, com certificado Let's Encrypt renovado sozinho por desafio de DNS. Precisa do acesso ao DNS do domínio. Enquanto isso, nos tablets de teste: no Chrome, `chrome://flags/#unsafely-treat-insecure-origin-as-secure` com o endereço do servidor.
  - **Decisão da TI (12/11):** o servidor definitivo fica só por IP, sem nome de DNS. Então a página continua em http e a câmera dentro dela depende do navegador tratar o IP como seguro. Caminhos, do melhor para o pior:
    1. **Política do Chrome pelo Intune** (tablets gerenciados): `OverrideSecurityRestrictionsOnInsecureOrigin` com `http://<IP do servidor>:8799`. Vale para todos os tablets de uma vez, sem mexer em cada um.
    2. **Flag no Chrome de cada tablet**, a mesma acima. Feita uma vez por aparelho; fica salva.
    3. **Sem nada:** a foto do cliente abre a câmera nativa do Android pelo botão (já funciona, v99.19.1). A leitura do QR na entrega roda no computador do campo: se ele for o próprio servidor (`127.0.0.1`) a câmera abre; senão, um leitor de QR USB (funciona como teclado) resolve.
  - O IP definitivo do servidor vem com a máquina definitiva (Ronaldo, 13/11).

1. **Cartão com QR (decidido 11/11):** cartão próprio do vídeo, ligado no campo na entrega; as fotos do Drone ficam com as outras fotos.
2. **Fotos do Drone (decidido 11/11):** quadros tirados do próprio vídeo, no ângulo aberto que pega o campo. Entram na sessão de fotos do cliente, junto com as do tour. Falta definir como cada quadro chega à sessão certa: pela venda do Drone, pela hora do voo ou por reconhecimento facial.
3. **Snap Pop (decidido 11/11):** o vídeo é gerado depois, por uma integração a fazer. Até lá, o Eterna vende e registra o Snap Pop, e a entrega segue a regra do QR quando o arquivo existir.
4. **Preços (decidido 11/11):** ficam os da seção 2, tirados da documentação e das vendas.
5. **Prazo do vídeo (decidido 11/11):** 30 dias na nuvem; cada vídeo tem no máximo 30 segundos.
6. **Compra online das ativações:** entra no checkout da Imply depois, quando a compra online das fotos estiver no ar.
7. **Venda só nos horários da Imply (12/11):** o Ronaldo quer estudar consumir a Imply para vender somente nos horários com vaga (allotment). Ele passa a chave depois. **Por ora a venda é livre.**
8. **Drone preenchido pelo arquivo do cartão (12/11, a fazer quando houver drone):** na operação o vídeo sai direto do cartão do drone (sem WhatsApp), então o arquivo chega com os metadados originais (modelo e, em geral, número de série). Ideia: o servidor aprende cada drone (na primeira entrega alguém escolhe o drone, o servidor guarda o número de série lido do arquivo, e dali em diante o drone já vem marcado). A bateria não vem no vídeo e segue escolhida à mão; o piloto pode vir de quem está logado. Falta um vídeo original de cada drone para confirmar em que campo o número vem.
