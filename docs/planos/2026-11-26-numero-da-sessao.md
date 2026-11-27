# Número da sessão (26/11/2026)

## Objetivo

Pedido do Eduardo (26/11): o código da sessão (LP + 7 caracteres) é grande demais para falar e digitar com pressa. Cada sessão passa a ter um número do dia, fácil de falar. O nome completo da sessão é a data e o número, na ordem em que as sessões nascem: `2026-11-26-147`. No dia, basta o `147`.

## O que entra

### Servidor do ponto (`agente/eterna-agente.py`)

- Cada sessão ganha o campo `num`: 1, 2, 3... por dia, dado quando a sessão nasce (`_sess_nova`, `_sess_num_prox`) e guardado no arquivo do dia. Vai em `GET /sessoes` e em cada grupo de `GET /fila-fotografo`.
- O número nunca muda e nunca é dado de novo. Sessão fundida em outra ou removida (LGPD) fica com o número dela; a sequência pode ter buraco. O arquivo do dia guarda no topo (`"num"`) o último número dado.
- O nome completo `AAAA-MM-DD-N` é só `dia` + `num`. Nada além do `num` é gravado.
- Ao ligar (`sess_carregar`), sessão antiga sem número, ou com número repetido ou inválido, recebe o próximo, na ordem do arquivo. As fotos sem sessão reagrupadas na partida recebem os seguintes.
- Os arquivos dos dias anteriores são numerados uma vez pela mesma regra (`sess_num_migrar`). Arquivo já numerado não é tocado. Depois de uma passada sem erro fica a marca `.num-migrado` na pasta e as partidas seguintes não releem nada.
- O servidor não põe teto no número. O limite de 5 dígitos é só da busca da tela.
- Cartão de ontem descarregado hoje vira sessão de hoje e recebe número de hoje.
- Arquivo do dia que não pôde ser lido na partida é guardado ao lado como `AAAA-MM-DD.json.ilegivel-<hora>` (nada é sobrescrito), com aviso no registro do servidor. Se o começo do arquivo ainda mostra o `num` do topo, a numeração do dia continua dele; senão recomeça do 1 e o aviso diz isso.
- Falha ao gravar não deixa `.json.tmp` pela metade. A limpeza de 60 dias também tira `.tmp` e arquivo ilegível antigos. A marca `.num-migrado` não vai para o backup.

### Tela (`index.html`)

- A tela lê o número do servidor (`SRV.num`, só memória). Nada no `localStorage`.
- Onde aparecia o LP, aparece a data pequena, o número em destaque e o LP apagado (`sessCodHtml`): Procurar sessão do Posto, Procurar fotos, Minhas fotos, cabeçalho da venda e recibo na tela do Posto, lista de vendas, Sessões esperando do Checkout, Fila de impressão, lista de sessões, Galerias e cortesias.
- Em texto corrido (`sessRot`): "Sessão 147" quando é de hoje; "Sessão 2026-11-25-147" quando é de outro dia. Sessão que o servidor não mandou com `dia` e `num` segue com o LP.
- Busca (`sessBusca`) em Procurar sessão, Procurar fotos e Juntar leva:
  - só dígitos (1 a 5): número de hoje, pelo começo, com o igual em primeiro ("14" mostra 14 e 140 a 149);
  - nome completo, com ou sem traços (`2026-11-26-147`, `20261126147`): aquele número; se a data não é hoje, a lista fica vazia;
  - com letra: pedaço do LP, como antes;
  - com número ou código digitado, o filtro de horário é ignorado.
- Juntar leva pelo número: antes de enviar, a confirmação mostra a sessão achada (nome completo, LP, fotógrafo, hora e fotos). Sessão sem foto não é achada pelo número.
- Servidor antigo (nenhuma sessão com `num`): tudo como antes.

## O que não muda

- O LP continua sendo a chave interna (vendas, eventos, registros) e o código do cliente.
- Nada muda para o cliente: recibo, galeria e código de acesso. O Checkout do cliente não aceita o número nem o nome com data.
- Regras de sessão, fusão, visitas, permissões e rotas.

## Fora deste plano

- Procurar sessão de outro dia pelo nome completo.
- Busca por número na Lista de vendas e em Galerias.
- Pendência para vários venues: a tela decide o que é "hoje" pelo relógio do navegador (`localDay`). Com o servidor e o navegador em fusos diferentes, o dia do número precisa vir do servidor.
- Mostrar o número no cartão da Fila do fotógrafo (o cartão não mostra código; o dado já vai na rota).

## Testes

`testes/sessao_numero_agente.py` (servidor) e `testes/sessao-numero.js` (tela, com servidor falso).
