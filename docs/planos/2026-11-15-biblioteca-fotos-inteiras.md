# Fotos inteiras na Biblioteca e no zoom (correção de 15/11/2026)

Pedido do Eduardo, olhando Fotógrafo › Minhas fotos no servidor do estádio. Teste: `testes/biblioteca-fotos-inteiras.js`.

## Como era

- Toda miniatura era uma caixa 3:2 com a foto em `cover`: foto vertical aparecia deitada, cortada em cima e embaixo (cabeça fora).
- O zoom (lupa) também era uma caixa 3:2 com `cover`, e mostrava a miniatura esticada, não o original.
- O zoom aberto em Minhas fotos listava só as fotos da sessão da foto clicada, mesmo quando o clique vinha da Biblioteca, e as setas davam a volta (da última para a primeira).
- A foto mais nova da Biblioteca costuma estar sozinha na sessão dela (a sessão acabou de abrir). Lista de uma foto só não tem setas: por isso a primeira miniatura abria sem a seta da direita.
- Os arquivos nunca estiveram cortados: a miniatura do agente (até 900 px) e o original guardam a proporção. O corte era só de desenho.

## Como fica

1. Miniatura de foto real (enviada ou do agente, `data-real` no `.ph`): célula quadrada com a foto inteira dentro (`contain`), centralizada. Vertical aparece em pé, horizontal deitada, as duas com o mesmo lado maior, e a grade segue alinhada. Vale para a Biblioteca, Minhas fotos de hoje, Sessões de hoje, Qualidade (sessão aberta), Posto e Venda manual, Ajustes e a escolha de cortesia nas Galerias. Na Fila do fotógrafo e nas miniaturas do pedido no Posto a caixa segue do mesmo tamanho, com a foto inteira dentro. As fotos de exemplo (sprites) seguem 3:2.
2. Zoom: a caixa toma a proporção da própria foto (`--arn`, medida pela miniatura) e o maior tamanho que cabe na tela, sem cortar. Mostra o original (`/file/`) por cima da miniatura, que já está no navegador e aparece na hora. Avaliar, ajustar, descartar e arrastar o recorte seguem iguais.
3. Setas: param nas pontas, em todo zoom de fotos. A primeira foto só tem a seta da direita, a última só a da esquerda; teclado (← →) e deslizar seguem a mesma regra.
4. Zoom aberto pela Biblioteca (ou por Minhas fotos de hoje, do fotógrafo): as setas percorrem todas as fotos que a tela mostra, na mesma ordem, atravessando sessões (`libOrdem`). Aberto por um bloco de Sessões de hoje: continua dentro da sessão.
5. Título do zoom: nome da lista, "foto 12 de 50" e a hora da foto (`zm_pos`, 5 idiomas).

Não muda: Checkout do cliente, galeria online, agente.

## Critérios de aceite

- Miniatura vertical e horizontal sem corte na Biblioteca, em Sessões de hoje e na Qualidade (a moldura da foto de teste aparece nos 4 lados, na proporção natural), em 390 px, tablet e 1920.
- Zoom sem corte nas duas orientações, dentro da tela, usando o original.
- A primeira foto tem a seta da direita; a última tem a da esquerda e não tem a da direita; → na última não volta ao começo.
- Pela Biblioteca, as setas seguem a ordem da tela e atravessam sessões; com filtro, só as fotos do filtro. Pelo bloco da sessão, só a sessão.
- Título com posição e hora. 390 px sem rolagem lateral, com e sem o zoom aberto.
- Avaliar (Boa, Ruim) no zoom da Qualidade continua funcionando, com os botões visíveis sem rolar.

## Ficou de fora (decisão do Eduardo)

Ainda cortam por desenho (`cover`): Checkout do cliente (grade e tela cheia, `lj-`), espelho do Checkout no Posto (`eco`), galeria online (`gq-`), "É você?" da selfie (`facecand`), capa da sessão em Ajustes, miniaturas pequenas das Galerias (lista de cortesias e sessões do grupo). Em 390 px as setas do zoom ficam por cima da beirada da foto horizontal (já era assim).
