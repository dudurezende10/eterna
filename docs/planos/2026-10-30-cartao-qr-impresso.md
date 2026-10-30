# Cartão com QR impresso

30/10/2026. Pedido do Ronaldo: o cliente leva para casa um cartão impresso com o QR da galeria. Na mesa do caixa fica uma pilha de cartões já impressos. Dentro da venda, o vendedor lê o QR de um cartão com o leitor (pistola). Esse QR passa a ser o da galeria da venda, no lugar do QR digital, e a tela do Checkout do cliente mostra o mesmo QR na hora.

## Como funciona

- **O que vai impresso:** o QR é `https://eterna.photo/#g/<token>`, com token aleatório de 22 caracteres (16 bytes, o mesmo formato das galerias). Embaixo vai o código de 8 letras (`XXXX-XXXX`) para quem prefere digitar.
- **O código sai do token:** `cartaoCodigo(token)` calcula o código a partir do token, com o mesmo cálculo na geração do lote e na venda. Por isso o cartão não precisa estar cadastrado antes.
- **Lote para a gráfica:** em Painel de controle › Cartões com QR impresso › Gerar lote (CSV). Cada linha tem `token;codigo;qr`, e a gráfica imprime com dados variáveis.
- **Na venda:** no recibo (Caixa e Checkout do vendedor), o campo "Cartão com QR impresso" recebe a leitura da pistola, que digita o texto e dá Enter. `cartaoAtrelar(sessão, texto)`:
  1. aceita a URL inteira ou só o token; qualquer outra coisa é recusada;
  2. se o cartão já é desta venda, só mostra de novo;
  3. se o cartão já está em outra venda, recusa e pede outro cartão;
  4. a galeria da sessão passa a usar o token e o código do cartão (`m.cartao` guarda quando e quem);
  5. a galeria antiga com QR digital fica marcada `substituida`; se já tinha subido para a nuvem, é encerrada lá;
  6. publica a galeria (venda paga) e manda `mostrar-qr` para a tela do cliente.
- **Na nuvem:** se um token já existe com fotos de outra sessão, a publicação é recusada com 409. Assim um cartão não troca de dono. Essa trava entra no próximo `sam deploy`.
- **Cartão não usado:** não abre nada. A galeria não existe na nuvem até a venda.

## Pendências

- Fazer o `sam deploy` da trava 409.
- Definir o layout do cartão com a gráfica: QR, código, marca Viva Maracanã e o texto "Suas fotos do Tour".
- Teste com a pistola real: confirmar que ela manda Enter no fim. A maioria vem assim de fábrica.
