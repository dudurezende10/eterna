# Proposta: o cliente escolhe quais fotos vão para o papel (barra lateral das escolhidas)

Situação: proposta do Ronaldo em 16/11/2026, para o Eduardo conduzir. Nada implementado.

## O problema

Um pacote misto (exemplo: 9 impressas + 6 digitais) não tem um momento em que o cliente diga quais das 15 fotos escolhidas vão para o papel. O Roverpix também não tem. Na prática, imprime-se tudo, e o que o cliente compra impresso ele também leva no digital.

No Eterna essa escolha já existe, mas só do lado de quem vende:

- `impFotos`/`impSel` (index.html) montam a lista de impressão com as favoritas primeiro e cortam no `prints` do pacote. O vendedor pode trocar quais imprimir antes de mandar para a DNP (D11 do plano v80; FLUXOS, "Lista de fotos").
- O pedido guarda `fav`, e o eco do Posto mostra "Favorita". Porém o Checkout em tela cheia não tem mais um botão para o cliente marcar favorita, e o dado só chega preenchido por caminhos antigos.

## A demanda que se junta a esta

A tira de miniaturas das escolhidas no Checkout entrou na v67 (commit b37a9d5, "tira de miniaturas com as escolhidas") e se perdeu no Checkout em tela cheia (v96). Hoje sobra só o CSS `.lj-strip`, sem desenho. A ideia é que essa barra volte e, quando o pacote é escolhido, passe a ser também a escolha da impressão.

## Proposta (dentro do fluxo que já existe, sem etapa nova)

1. **Barra lateral durante a escolha.** À direita da foto grande do Checkout, uma coluna fina com as miniaturas das fotos marcadas.
   - A miniatura aparece na hora do "Quero essa" e some quando o cliente desmarca a foto.
   - Tocar numa miniatura volta àquela foto.
   - Contador "N escolhidas".
   - No tablet em pé ou em tela estreita, a barra vira tira embaixo, como era a `.lj-strip`.

2. **Quando o caixa escolhe o pacote no Posto,** a tela do valor, que o cliente já acompanha ao vivo (`lojaPendCheck`), mostra a mesma barra com `prints` fotos marcadas como "Impressa".
   - O padrão é o de `impFotos`: favoritas primeiro, depois a ordem da escolha.
   - Frase: "Toque para trocar quais vão para o papel".
   - Contador "9 de 9 para imprimir".
   - Tocar numa foto não marcada troca com a última marcada, sem passar do limite.
   - Ninguém é obrigado a mexer: sem toque, vale o padrão e o fluxo segue igual a hoje.
   - Se o caixa trocar o pacote, a marcação se ajusta ao novo `prints`, mantendo primeiro as que o cliente escolheu.

3. **No Posto.**
   - O eco da tela do cliente (`ecoPainel`) mostra quais estão marcadas para imprimir.
   - A lista de impressão (`impSel`) parte da escolha do cliente.
   - O vendedor continua podendo ajustar antes de mandar para a DNP.

4. **Dado no servidor.**
   - A escolha vai no pedido junto de `selected`/`aiSel`/`fav`, como um campo próprio (sugestão: `imprimir`, lista de chaves no mesmo formato de `fav`).
   - O campo segue para o `pvEvento('criar')` e para o servidor. Não fica no localStorage.
   - Isso permite que a auditoria compare as folhas cortadas na DNP com as fotos escolhidas. Em 15/11 o contador do Posto 11 marcou 20 folhas para 12 impressões registradas.

5. **Textos** nos 5 idiomas (I18N do cliente).

## Decisão de negócio em aberto (Ronaldo)

Quem leva a foto impressa também leva a digital?

- **Se sim (como é hoje):** a escolha decide só o papel, e todas as fotos escolhidas vão para a galeria do QR.
- **Se não:** o pacote 9+6 vira 15 fotos distintas. A barra precisa separar "no papel" de "no celular", e a galeria do QR precisa receber só as digitais (afeta `direito` das fotos na galeria e a contagem do pacote em `vendaCalc`).

A implementação dos itens 1 a 3 serve para os dois casos. Só o item 4 e a galeria mudam conforme a decisão.

## Pontos de atenção

- Montagem com fundo de IA (Edição Maracanã) hoje só chega ao cliente se for impressa (GUIA-DA-EQUIPE, aviso da Edição Maracanã). Se o cliente desmarcar a montagem da impressão, o Checkout precisa avisar ou não permitir.
- `LOJA_ESCOLHA_MS` e `lojaProntoOcioso`: a troca na tela do valor conta como toque.
- Pedido em `estado:'escolha'` vindo de janela antiga (`pendJanelaAntiga`) não teria o campo novo, e o Posto deve cair no padrão de `impFotos`.
- Testes: `testes/checkout-tela-cheia.js` ganha os casos da barra, da troca dentro do limite e da troca de pacote.
