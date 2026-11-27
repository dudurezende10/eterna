# Selfie sem código na galeria pública (27/11/2026)

## Objetivo

Pedido do Ronaldo (27/11): clientes não acham as fotos em eterna.photo/#g porque não têm o código. Na mesma tela do código entra uma alternativa: **encontrar pela selfie, sem código**. O cliente escolhe o dia da visita (só os últimos 30 dias, o tempo que o servidor do estádio guarda), dá o aceite e tira a selfie. Achou: abre a galeria dele no fluxo normal (as mesmas telas de quem entra pelo código), com as compradas liberadas para baixar e as outras à venda pela compra online. Em nenhum momento pede código.

Não achou: a tela só informa, como a galeria já informa hoje, para escrever para contato@vivamaracana.com.br (lá abre chamado no Zendesk) com a selfie e o dia da visita. A selfie não fica guardada para a equipe e o Procurar fotos não muda (decisão do Ronaldo, 27/11).

## Desenho

A nuvem não alcança o estádio; o agente puxa. Por isso o pedido é assíncrono:

1. Tela do código: o botão "Encontrar pela selfie" só aparece quando a nuvem responde `POST /g/selfie/dias` com `ligada: true` (a nuvem diz que tem a rota e que o servidor do estádio buscou pedidos nos últimos 2 min). Nuvem antiga (404) ou estádio fora do ar: o botão não aparece.
2. Tela nova "dia + aceite": escolher o dia (lista dos últimos 30 dias), aceite do uso da selfie, e-mail (obrigatório, como no aceite de hoje) e novidades (já marcado). Depois, a câmera de selfie de sempre.
3. `POST /g/selfie/pedido` guarda o pedido na nuvem: a selfie fica num item da fila do DynamoDB (`SFQ`), nunca no Rekognition. O cliente recebe o número do pedido e consulta `POST /g/selfie/estado` a cada 3 s ("Procurando suas fotos…").
4. O agente busca a fila a cada 10 s (`GET /ponto/selfies`, segredo do estádio). Ao entregar, a nuvem apaga a selfie da fila. O agente lê o rosto (uma pessoa por vez), procura só nas fotos do dia escolhido, com rosto principal e semelhança de "mesma pessoa", fora bases de IA e sessões removidas. Galeria de escola e sessão de menor não separam (v99.108.2, Ronaldo 27/11: "foto é foto"; a selfie é o delimitador, e as sessões seguem a regra de rosto e minutagem). A escola continua abrindo a dela pelo voucher.
5. Achou: monta uma galeria `sessao` com origem `selfie` (como a das fotos do Tour pela foto da venda), preços e catálogo da galeria de venda mais recente. A foto já comprada ou dada de cortesia numa venda (manifesto de outra galeria) entra liberada; as outras à venda. Publica na nuvem na hora e responde `POST /ponto/selfies` com o token. A nuvem cria o acesso de 1 h à galeria inteira.
6. O celular recebe `achou` com token e acesso e entra em `#g/<token>` pelo mesmo caminho do atalho do vídeo (acesso guardado na sessão do navegador): galeria normal, comprar online, baixar as compradas. Acesso vencido: a selfie da própria galeria, como em qualquer galeria.

## Busca em 2 passos (v99.108.1)

Ronaldo (27/11): "tem que encontrar TODAS as fotos do cliente, independente da sessão, com fidedignidade pra não dar problema de LGPD".

1. Passo 1: a selfie no dia escolhido; entra a foto com semelhança >= LIMITE (0,45) e o cliente como rosto principal.
2. Passo 2: o rosto do cliente nas melhores fotos do passo 1 vira referência: até 6, só das fotos com semelhança >= 0,55 com a selfie, primeiro uma por fotógrafo, depois uma por sessão. Cada referência é procurada de novo no dia. A foto nova entra só se o rosto que bateu com a referência tem >= LIMITE, é o principal e também bate com a própria selfie com >= 0,38 (LIMITE_TALVEZ).
3. Sem teto de 60: até 400 fotos (a nuvem lê os rostos de até 600 por galeria).
4. Log por pedido só com números: passo 1, passo 2 e sessões distintas.

Cortes: 0,55 para a referência deixa só fotos em que o cliente é reconhecido com folga (bem acima de 0,45), para a referência não ser ela mesma uma foto duvidosa. 0,38 na trava é o "talvez" já calibrado nas fotos do Tour: abaixo disso nem o Checkout oferece a foto. O perfil e a outra luz costumam cair entre 0,38 e 0,45 com a selfie de frente, e um parente parecido com a referência fica abaixo, porque não se parece com a selfie.

## Estados do pedido (nuvem, `SFP#<pedido>`)

esperando → buscando → achou | nao | varias | sem_rosto | erro. Sem resposta do estádio em 10 min: indisponivel. O registro some em 1 h (TTL).

## Prazos da selfie (LGPD)

- Na nuvem: só no item da fila; apagada quando o agente busca, ou em 10 min sem busca (o item também tem TTL de 15 min).
- No agente: só em memória durante a busca; nada é gravado.
- Não achou: nada fica guardado.
- Registros sem dado pessoal: o agente guarda só o resumo (hash do pedido, dia, estado, quantas fotos) em `nuvem.db`; a nuvem guarda o aceite (com o e-mail, como o aceite da galeria) e os eventos com IP em hash.

## Limites

6 pedidos por IP por hora, 3 mil por dia no total, 40 consultas por minuto por IP, selfie até 350 mil caracteres (o celular reduz para 640 px), 400 fotos por galeria.

## Dependência

`sam deploy` da nuvem (rotas `/ponto/selfies` no template). Até lá o botão não aparece.

## Teste

`servidor/galeria-nuvem/teste_local.py` (rotas da nuvem), `testes/selfie_dia_agente.py` (busca no dia e galeria) e `testes/galeria-selfie-dia.js` (tela).
