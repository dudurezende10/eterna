# Plano v79: dinheiro aguardando caixa, interruptor do ajuste automático, saída da equipe no Checkout e valor do pacote

Sugestão de arquivo para o documentador: `/home/claude/eterna/docs/planos/2026-10-28-v79-checkout-caixa-ajuste.md`. Não editei nenhum arquivo.

## Objetivo
No Checkout, pagamento em Dinheiro passa a ficar "aguardando caixa" e só a equipe libera, no Caixa. O Fotógrafo liga e desliga o ajuste automático no Upload. A equipe ganha uma saída visível no Checkout. O carrinho passa a mostrar o total linha a linha, com o "Ideal" e a economia calculados certo.

## Escopo desta entrega
1. **Dinheiro aguardando caixa.** Tela final do cliente nos 5 idiomas, lista "Aguardando caixa" na view `caixa`, botões Confirmar e Cancelar, status nas listas, CSV, galeria, estoque, Alertas, fim do dia e auditoria.
2. **Interruptor do ajuste automático** no topo do Upload automático, com registro de quem mexeu.
3. **Botão "Início"** no `#loja` quando quem abriu o Checkout foi alguém da equipe, com mitigação de risco.
4. **Carrinho do Checkout:** resumo linha a linha, Ideal pela combinação mais barata, impressas limitadas ao número de fotos e economia coerente.

## Fora do escopo
- **Checkout e Caixa em computadores diferentes.** Na v79 os dois funcionam no mesmo computador e no mesmo navegador (duas janelas: `#loja` na tela do cliente e Caixa na tela da equipe). Entre computadores, só com o servidor (contrato futuro no fim do item 1).
- Confirmar no agente, impressora real, TEF.
- Tempo do alerta configurável (fica fixo em 15 min).
- Aviso de "aguardando" na administração de Galerias online.
- Ajuste automático separado por fotógrafo.

## Decisões assumidas (padrão mais seguro; o Eduardo pode trocar)
| # | Decisão |
|---|---|
| D1 | A venda em dinheiro pendente vira um registro próprio em `SIM.caixaDin`, e a sessão fica com `status:'aguardando'`. Como quase tudo hoje olha `status==='paga'`, receita, galeria, "vendida" na biblioteca e Semana já ficam de fora sem mudança. |
| D2 | **Código que o cliente mostra no caixa = código da galeria (`XXXX-XXXX`).** O token da galeria nasce na hora (o QR aparece), mas **não é publicado** antes da confirmação. |
| D3 | Confirmar e Cancelar exigem `venda.c` ("registrar pagamento"), com módulo fixo em `ACT_MOD`. Os perfis Atendimento e venda, Supervisor e Admin podem. Fotógrafo, Validador e o perfil Checkout não podem. |
| D4 | **Uma pendência aberta por sessão.** Se o cliente volta ao Checkout e escolhe Dinheiro de novo, a anterior vira `substituida` e nasce outra. Se paga com Cartão ou PIX, no Checkout ou no balcão, a pendência vira `substituida` (motivo `pago_de_outro_jeito`). |
| D5 | Cancelar devolve a sessão para `pronta`: o cliente pode voltar e comprar de outro jeito. O registro fica como "não paga". |
| D6 | Fim do dia = virada do dia local (00:00). Pendência de dia anterior vira `nao_paga`, com `por:'sistema'` e motivo `fim_do_dia`. |
| D7 | **Sair do `#loja` por qualquer caminho** (Esc, painel, mudar o endereço, voltar do navegador, ir para `#g`) passa por `lojaSair` e encerra a sessão. A única exceção é o botão Início do item 3. |
| D8 | Retenção: registros fechados ficam 30 dias, com no máximo 1000. Auditoria grava o e-mail do operador em `por`. CSV e telas mostram só o nome. Nenhum dado do cliente (sem nome, e-mail, rosto ou IP). |
| D9 | **Ajuste automático vale para o computador do ponto inteiro**, como hoje (`SIM.autoAj`). Por fotógrafo exigiria separar a fila `ajQueue` por autor: mais código e mais chance de foto sem ajuste. |
| D10 | O botão Início (item 3) só aparece no "modo equipe": aberto pelo botão "Abrir Checkout" nesta aba, por um usuário que não é do perfil Checkout, nos primeiros 10 min e antes da primeira compra concluída. Pede dois toques (o primeiro arma por 3 s). |
| D11 | **Ideal = menor custo de (pacote + extras)** para as fotos do campo. Empate: mais impressas; persistindo, o pacote menor. O pacote selecionado por padrão passa a ser o Ideal. |
| D12 | Economia = (fotos efetivamente incluídas × preço avulso) − (pacote + extras), mostrada só quando > 0. Preço avulso: `arq` (R$ 69) nos pacotes com impressa; `dig` (R$ 39) × fotos da sessão no "Todas". Fundos de IA ficam fora da conta. |

**Decisões em aberto para o Eduardo (padrão aplicado entre parênteses):**
- (a) **Fotos com fundo de IA** contam dentro do pacote ou continuam adicionais de R$ 40 cada? (Padrão: continuam adicionais.)
- (b) Pela D11, com 9 ou mais fotos o Ideal vira "Todas" (R$ 250, só digital, sem impressas) contra R$ 254 do Pacote Maracanã + 3 extras com 9 impressas. Manter só preço? (Padrão: só preço, como ele pediu.)
- (c) Checkout e Caixa em computadores separados: precisa do servidor. Confirmar com Eduardo e Ronaldo se a v79 entra no ponto com os dois no mesmo computador.

---

## ITEM 1. Dinheiro aguardando caixa

### Achados no código que mudam o desenho
- **`SIM` é um bloco único no `localStorage` e não existe sincronização entre abas.** A janela do Caixa regravaria o `SIM` antigo (o `ajQueue` chama `saveSim` a cada poucos segundos) e apagaria a pendência criada pelo `#loja`. Por isso a v79 precisa sincronizar as abas.
- **Brecha que já existe hoje.** O `#loja` aberto num navegador com sessão salva carrega o usuário (`sessionLoad` no boot). Trocar o hash para `#caixa` cai em `readHash` e abre o Caixa logado (`hashchange`, linha ~3177). Com a confirmação de dinheiro, isso permitiria ao cliente confirmar a própria venda. Corrigido pela D7.
- **`aj-autotoggle` não está em `WRITE_OPS`.** Hoje o Supervisor, que só tem `set` para ler, consegue ligar e desligar o ajuste.

### Contrato `SIM.caixaDin` (lista, mais novo primeiro; entra em `SIM0` como `[]`)
```json
{"id":"D<ts36><rand4>","venue":"maracana","card":"LP...","token":"<galeria>","codigo":"ABCD-2345",
 "criada":"ISO","total":304,"prints":4,"n":8,"nPh":4,"nAI":4,
 "cart":[{"id":"zona"},{"id":"extra"},{"id":"fundo","ai":"ph|bg"}],
 "selected":["..."],"aiSel":["ph|bg"],
 "estado":"aguardando|confirmada|cancelada|nao_paga|substituida",
 "fechada":"ISO|null","por":"email|sistema|null","porNome":"Thainá|null",
 "motivo":"null|cancelada_no_caixa|fim_do_dia|novo_pedido|pago_de_outro_jeito","saleNo":"E012|null"}
```
Na sessão (`SIM.sessions[card]`): `status:'aguardando'` e `din:<id>`. Na confirmação: `status:'paga'`, `payment:'Dinheiro'`, `paidAt` (hora da confirmação), `saleNo`, `caixaPor` (nome), `caixaEm`, `prints`.

### Mudanças em `/home/claude/eterna/index.html`

**Estado e sincronização**
- `SIM0`: adicionar `caixaDin:[]`.
- **Novo `simFresh()`:** relê `eterna.sim.v1` para dentro do `SIM`. É chamado no começo de toda ação de caixa, antes de mudar qualquer coisa.
- **Novo ouvinte `storage` para `eterna.sim.v1`:** adota o `SIM` novo (`Object.assign(SIM0(),JSON.parse(newValue))`), roda `dinVirada()` e chama `render()`. Exceções: se `state.pub` estiver ativo, não faz nada; se um `INPUT` estiver com foco, só atualiza a barra.
- **Novo `dinTick`** em `setInterval` de 60 s: roda `dinVirada()` e, se `state.view==='caixa'` e nenhum campo estiver com foco, chama `render()` (atualiza o "há N min"). Também rodar `dinVirada()` no boot, depois de carregar o `SIM`.

**Checkout do cliente**
- **`lojaPay(m)`:** se `m==='cash'`, chama `lojaDinheiro(card)` e sai. Nos outros meios, segue igual e, se a sessão tiver `din` aberta, chama `dinFechar(id,'substituida','pago_de_outro_jeito',null)`. Grava `s.prints=c.prints` (ver item 4).
- **Novo `lojaDinheiro(card)`:**
  1. `simFresh()` e `lojaSync(card)`.
  2. Se a sessão já tiver `din` aberta, fecha como `substituida`/`novo_pedido`.
  3. `tok=galDaSessao(card,true)`, sem `galPublicar` e sem `galDaVenda`.
  4. Cria o registro com cópia de `cart`, `selected` e `aiSel`; `s.status='aguardando'`; `s.din=id`.
  5. **Não** baixa estoque, **não** grava `aiOf().bought` e **não** gera `saleNo`.
  6. `log("Checkout: <card> pediu pagar R$ X em dinheiro no caixa (código ...)")`, depois `saveSim()`.
  7. `k.step='done'`, `k.paid={cash:true,total,prints,n,token,codigo}`, liga o mesmo `lojaTick` e chama `drawLojaQR`.
- **`vQuiosque`, passo `done`:** se `p.cash`, mostrar a variante:
  - classe `lj-wait`, ícone `ICO.cash` no lugar de `lj-okbig` (`lj-pendbig`, fundo amarelo #FFB800);
  - eyebrow `ljCashEyebrow`, título `ljCashH`, `ljCashSub(total,prints)`;
  - cartão do QR com o código em destaque (`gq_codeIs`) e `ljCashQR` no lugar de `download`;
  - contagem regressiva e "Voltar ao início" iguais aos de hoje.
- **`vQuiosque`, passo `cart`:** com Dinheiro escolhido, o botão usa `payBtnCash(total)` e aparece a linha `lj-fine` `cashNote`.
- **`hashchange` (D7):** se `wasLoja && !state.lojaRota` e a saída não veio de `lojaVoltarApp` (item 3), chamar `lojaSair()` e, se o destino for `#g`, seguir para ele já sem usuário.
- **`lojaSair`:** sempre remove `eterna.session` e zera `state.user`, mesmo se `state.user` for null no momento.

**Caixa, para a equipe**
- **`vCaixa`:** novo painel no topo da coluna esquerda, "Aguardando caixa · dinheiro do Checkout". Mostrar sempre; vazio, exibe "Nenhum pagamento em dinheiro esperando."
  - Busca `<input id="din-q" data-keep data-act="din-q">`, que ignora hífen e maiúsculas e compara com `codigo` e `card`.
  - Cada item mostra: código grande, sessão, `fmtR(total)`, hora `hh:mm` + pill "há N min" (`warn` acima de 15 min), "N fotos · M impressas" e até 4 miniaturas de `selected` (`photoBtn`, pequenas, com lupa).
  - Botões só se `can('venda','c')`: `din-confirm` ("Recebi R$ X", primário) e `din-cancel` ("Cancelar"). Sem a permissão, aparece a nota "Só quem registra pagamento confirma."
  - `din-cancel` abre a confirmação no próprio item: "Cancelar esta compra? Ela não vira venda." com `din-cancel-ok` e `din-cancel-no`.
  - **Não renderizar nada disso dentro de `vQuiosque` nem de `lojaEquipe`.**
- **Novo `dinConfirmar(id)`:**
  1. Se `state.lojaRota` ou `state.pub`: toast "Confirme no Caixa da equipe" e sai.
  2. `simFresh()`. Registro inexistente: toast "Pagamento não encontrado". Estado diferente de `aguardando`: toast `Já ${rótulo} por ${porNome} às ${hh:mm}`, `render` e sai (idempotência).
  3. Se a sessão já estiver `paga` (pagou de outro jeito), fecha como `substituida` e avisa.
  4. Senão, aplica a cópia do registro em `s.cart`, `s.selected` e `s.aiSel`; `status:'paga'`; `payment:'Dinheiro'`; `paidAt`, `caixaEm`, `caixaPor=state.user.name`; `saleNo` (mesma regra de hoje); `seller=LOJA_VENDEDOR`; `s.prints=rec.prints`.
  5. Grava `aiOf(card).bought` com `where:'loja'` e baixa `SIM.stock['Caixa 1']` em `rec.prints`.
  6. Registro: `estado='confirmada'`, `fechada`, `por=email`, `porNome`, `saleNo`.
  7. `log("Dinheiro confirmado: <card> R$ X por <nome>")`, depois `saveSim()` (síncrono, antes de qualquer `await`), depois `galDaVenda(card)`.
  8. `state.caixa.session=card`, para o detalhe mostrar o recibo com o QR (fluxo de hoje).
- **Novo `dinCancelar(id)`:** mesmas travas. `estado='cancelada'`, `motivo='cancelada_no_caixa'`, `por` e `porNome`. Se a sessão ainda estiver `aguardando`, volta para `pronta` e apaga `din`. A galeria fica como está (não publicada; o token é reaproveitado numa compra futura).
- **Novo `dinFechar(id,estado,motivo,por)`:** ajudante comum.
- **Novo `dinVirada()`:** pendências com dia de `criada` anterior a `todayISO()` viram `nao_paga`, com `sistema` e `fim_do_dia`, e a sessão volta para `pronta`. Também poda os registros fechados com mais de 30 dias e limita a 1000.
- **`caixaConfirm` (balcão):** se a sessão tiver `din` aberta, chama `dinFechar(...,'substituida','pago_de_outro_jeito')`.
- **`receiptPanel` e recibo do `vCaixa`:** se `sim.caixaPor`, linha "Recebido por <nome> às hh:mm". Impressões usam `sim.prints`, com o catálogo como reserva.

**Pontos de entrada para o caixa ver a fila**
- `render()`, `#rail-ck`: se `canView('caixa') && can('venda','c')`, mostrar o botão `data-act="view" data-v="caixa"` "Caixa" com pill do número de pendências (`warn` se alguma passou de 15 min).
- `vPerfis`: no bloco "Área do cliente", cartão "Caixa · N aguardando dinheiro" quando `canView('caixa')`, e pill `N aguardando caixa` junto de "na fila".

**Rótulos de status**
- Novo `statusLabel(st)` (`aguardando` vira "aguardando caixa", `nao_paga` vira "não paga"), usado nas pills de `vFila`, `vCheckout` e `vVendasLista`.

**Lista de vendas e CSV**
- **`allSalesSim`:** acrescentar linhas vindas de `caixaDin` com estado `aguardando`, `cancelada` ou `nao_paga`:
  - `no=id`, data e hora de `criada`, `pay:'Dinheiro'`, `canal:'loja'`, `prints`, `photos=nPh+nAI`;
  - `status:'aguardando'` ou `'nao_paga'` (com `title` dizendo o motivo e quem);
  - `confirmada` e `substituida` não viram linha (a venda paga já aparece pela sessão).
- **`allSales`, com `LIVE`:** incluir o simulado também quando `caixaDin` tiver linhas.
- **Vendas da sessão** (`allSalesSim`): `prints` usa `s.prints` quando existir.
- **`vVendasLista`:**
  - novo filtro `state.sales.status` (Todos, Pagas, Aguardando caixa, Não pagas, Canceladas, com `data-act="sales-status"`);
  - novo bloco "Aguardando caixa" com N e R$ (só leitura);
  - pill `warn` para `aguardando` e `neutral` para `nao_paga`;
  - a receita continua só com `paga`.
- **`salesCSV`:** acrescentar no fim as colunas `caixa` (nome) e `caixa_em` (ISO). O `status` sai `aguardando` ou `nao_paga`.

**Galeria e Alertas**
- **`pubLoad`, modo `sim`:** se `m.tipo==='sessao'` e a sessão estiver `aguardando`, `p.step='aguarda_caixa'`.
- **`vGaleriaQR`:** novo passo que chama `box(T('gq_waitCash'),T('gq_waitCashD'),help)`. Não há compra online nesse passo. No celular continua "Suas fotos estão chegando" (fase 1).
- **`alerts()`:** para cada pendência com mais de 15 min (`CAIXA_ALERTA_MIN=15`), `{sev:'bad', t:'Dinheiro esperando no caixa há N min · código X', d:'R$ X, N fotos. Confirme o recebimento ou cancele em Caixa.'}`.

**Permissões**
- `WRITE_OPS`: `'din-confirm':'c'`, `'din-cancel':'c'`, `'din-cancel-ok':'c'`.
- `ACT_MOD`: as três apontam para `'venda'`.
- `MODULE_INFO.venda.c`: "registrar pagamento, reimprimir, confirmar ou cancelar dinheiro do Checkout".
- `din-q`, `din-cancel-no` e `sales-status` não gravam.
- Novos `case` no switch: `din-q`, `din-confirm`, `din-cancel`, `din-cancel-ok`, `din-cancel-no`, `sales-status`.

**CSS:** `.lj-wait .lj-pendbig` (círculo amarelo com `ICO.cash`), `.din-list`, `.din-item`, `.din-cod` (Big Shoulders, tracking .1em).

### Chaves I18N novas, item 1 (pt / en; o programador faz es/fr/de)
| chave | pt | en |
|---|---|---|
| `ljCashEyebrow` | Falta só pagar no caixa | One last step: pay at the counter |
| `ljCashH` | Pague no caixa<br>em dinheiro | Pay cash<br>at the counter |
| `ljCashSub(total,n)` | Mostre este código no caixa e pague ${total}. Suas fotos digitais e ${n} impressas saem assim que o pagamento for confirmado. (n=0: sem a parte das impressas) | Show this code at the counter and pay ${total}. Your digital photos and ${n} prints are released as soon as payment is confirmed. |
| `ljCashQR` | Depois de pagar, aponte a câmera do celular para baixar as digitais. | After paying, scan with your phone to download your digital photos. |
| `payBtnCash(x)` | Finalizar e pagar ${x} no caixa | Finish and pay ${x} at the counter |
| `cashNote` | Em dinheiro, a compra é confirmada no caixa. | Cash purchases are confirmed at the counter. |
| `gq_waitCash` | Seu pagamento em dinheiro está esperando o caixa | Your cash payment is waiting at the counter |
| `gq_waitCashD` | Assim que a equipe confirmar, suas fotos aparecem aqui. | As soon as the team confirms it, your photos will appear here. |

### Critérios de aceite, item 1
1.1 No `#loja`, escolher Dinheiro mostra o botão "Finalizar e pagar R$ X no caixa" e a nota `cashNote`. Cartão e PIX seguem com o botão e o resultado de hoje (venda `paga` na hora).
1.2 Ao finalizar em Dinheiro, a tela final mostra ícone de dinheiro, "Pague no caixa em dinheiro", o valor, o código `XXXX-XXXX` e o QR. Não aparece "Obrigado" com check nem "impressas saem em 2 minutos". Funciona nos 5 idiomas, sem chave crua.
1.3 A tela final em Dinheiro volta sozinha à câmera em `SIM.lojaFimSeg` segundos (teste com 5 s).
1.4 Depois do pedido em Dinheiro, a sessão fica `aguardando`, `SIM.caixaDin[0].estado==='aguardando'`, o estoque do Caixa 1 não muda, `aiOf(card).bought` não muda, não há `saleNo` e a galeria não entra em `SIM.galFila`.
1.5 Abrir `#g/<token>` no mesmo computador mostra "Seu pagamento em dinheiro está esperando o caixa", sem foto liberada e sem botão de compra.
1.6 Numa segunda janela logada como Atendimento e venda, em `#caixa`, a pendência aparece sem recarregar, em até 2 s. Mostra código, sessão, valor, hora, "há N min", número de fotos e impressas, e miniaturas. A busca pelo código, com ou sem hífen, filtra.
1.7 "Recebi R$ X" deixa a sessão `paga` com pagamento "Dinheiro", `paidAt` igual à hora da confirmação e `saleNo` novo. Baixa exatamente `prints` do Caixa 1, publica a galeria (compradas = `selected`) e mostra o recibo com "Recebido por <nome>". A janela do `#loja` adota o `SIM` novo sem apagar nada.
1.8 Idempotência: com duas janelas de Caixa, confirmar na primeira e depois na segunda mostra "Já confirmada por <nome> às hh:mm". Estoque, `saleNo` e receita mudam uma vez só.
1.9 Cancelar pede a segunda confirmação. Depois dela a sessão volta a `pronta`, o registro fica `cancelada` com operador e hora, e na Lista de vendas aparece como "não paga", fora da receita.
1.10 Lista de vendas: a pendência aparece com status "aguardando caixa" e o filtro Status funciona. Receita, Vendas e Ticket não mudam até a confirmação; depois, somam uma vez só. O CSV traz `aguardando` / `nao_paga` e as colunas `caixa` e `caixa_em` (nome, nunca e-mail).
1.11 Alertas mostra "Dinheiro esperando no caixa há N min" para pendência com mais de 15 min (testar adiantando `now()` ou `criada`).
1.12 Uma pendência com `criada` de ontem vira `nao_paga` (`por:'sistema'`, `fim_do_dia`) no boot e no `dinTick`, e a sessão volta para `pronta`.
1.13 Voltar ao Checkout com a mesma sessão e pagar com PIX deixa a pendência `substituida`, ela some do Caixa e a venda aparece uma vez só.
1.14 Fotógrafo, Validador e o perfil Checkout não veem os botões. Chamar `din-confirm` pelo console ou pelo clique cai no `guardAct` com "Sem permissão". Supervisor e Admin conseguem.
1.15 Segurança: no `#loja` aberto num navegador com sessão de equipe salva, trocar o endereço para `#caixa`, voltar com o botão do navegador ou ir para `#g/...` leva ao login. `eterna.session` é removido e nenhuma tela da equipe abre.
1.16 `testes/permissoes.js` (critério 19) e `testes/todas-as-telas.js` passam, e `bash testes/rodar.sh` termina com `FALHAS: 0`. O novo `testes/v79-regressao.js` cobre de 1.1 a 1.15.

### Contrato futuro (servidor; documentar, não implementar)
- `POST /caixa/pendentes`, com o corpo do registro sem `por`.
- `GET /caixa/pendentes?venue=&estado=aguardando`.
- `POST /caixa/pendentes/<id>/confirmar` e `/cancelar`, com `{"esperado":"aguardando"}`. Resposta 409 com `{estado,porNome,fechada}` se já estiver fechada. `por` vem do token, nunca do corpo.

---

## ITEM 2. Fotógrafo liga e desliga o ajuste automático

### Mudanças em `/home/claude/eterna/index.html`
- **Novo `ajAutoSet(on)`:**
  1. Grava `SIM.autoAj=on` e `SIM.autoAjPor={on,por:state.user.email,nome:state.user.name,em:ISO}`.
  2. `log("Ajuste automático ligado|desligado por <nome>")`, depois `saveSim()`, `render()` e o toast de hoje.
  3. Ao religar, o `ajQueue` ajusta também as fotos que chegaram enquanto estava desligado (comportamento de hoje, agora dito em texto).
- **Novo `ajAutoPanel()`:** painel compacto com:
  - título "Ajuste automático da IA";
  - nota curta: "Clareia a foto escura, segura a estourada e acerta a cor de toda foto que chega neste computador. Vale para o ponto inteiro.";
  - botão `data-act="aj-autotoggle"` "Ligado" / "Desligado", desabilitado sem `can('set','u')`;
  - linha "Desligado por Carlos às 14:02" vinda de `autoAjPor`.
- **`vImportarCore`:** inserir `ajAutoPanel()` logo depois do `head`, antes do `camPanel`.
- **`vAjustes`:** trocar o painel atual por `ajAutoPanel()`.
- **Switch:** `case 'aj-autotoggle'` chama `ajAutoSet(SIM.autoAj===false)`.
- **Permissões:**
  - `WRITE_OPS['aj-autotoggle']='u'` e `ACT_MOD['aj-autotoggle']='set'` (fecha a brecha do Supervisor).
  - `MODULE_INFO.set.u`: "check-in da câmera, parar o recebimento, ligar e desligar o ajuste automático, ajustar fotos".
- **Menu não muda:** `PRESETS.foto.menu` continua `['diario','importar','escala']`, e Ajuste automático segue fora do menu do Fotógrafo.

### Chaves I18N
Nenhuma (tela da equipe, em português).

### Critérios de aceite, item 2
2.1 Logado como Fotógrafo (ex.: carlos@), o Upload automático mostra no topo "Ajuste automático da IA" com o estado atual e o texto curto.
2.2 O Fotógrafo desliga: `SIM.autoAj===false`, o toast aparece e o painel mostra "Desligado por Carlos às hh:mm". Uma foto nova do agente não ganha `SIM.edits` enquanto estiver desligado.
2.3 Religar: as fotos sem ajuste passam a ganhar `SIM.edits` com `auto:true` em até ~10 s.
2.4 O Registro (Alertas, para quem vê) traz "Ajuste automático desligado por Carlos".
2.5 O estado vale para quem entrar no mesmo computador: trocar de fotógrafo mantém Desligado. Admin em Configurações › Ajuste automático vê o mesmo estado e o mesmo "por".
2.6 O Fotógrafo continua sem o item Ajuste automático no menu, e `#ajustes` digitado não abre para ele.
2.7 O Supervisor (`set` só leitura) vê o estado com o botão desabilitado. Forçar o clique dá "Sem permissão para alterar em Upload, câmeras e ajustes".
2.8 O critério 19 de `testes/permissoes.js` passa.

---

## ITEM 3. Saída visível para a equipe no Checkout

### Mudanças em `/home/claude/eterna/index.html`
- **`lojaAbrir`:** se `state.user && !isBare()`, gravar `state.lojaEquipeAte=Date.now()+10*60e3` e `state.lojaDe=state.view` (antes de virar `quiosque`). Senão, `0`. Fica fora de `state.kiosk`, para o `lojaReset` não apagar.
- **Novo `lojaEquipeOn()`:** `state.lojaRota && state.user && !isBare() && Date.now()<state.lojaEquipeAte`.
- **`lojaPay` e `lojaDinheiro`:** zerar `state.lojaEquipeAte` (a primeira compra concluída encerra o modo equipe). Recarregar a página também zera, porque não passa por `lojaAbrir`.
- **`vQuiosque`:** nos passos `code`, `review` e `cart` (não no `done`), se `lojaEquipeOn()`, colocar no `lj-topr` o botão `lj-ghost sm lj-staffhome` com `data-act="loja-inicio"`, `ICO.home` e `T('ljStaffHome')`. Se `state.kiosk.inicioArmado` estiver no prazo de 3 s, o texto vira `T('ljStaffHomeSure')` com destaque.
- **`case 'loja-inicio'`:**
  - Se `!lojaEquipeOn()`: zerar, `render` e sair (o perfil Checkout ou o `#loja` sem login nunca passa daqui).
  - Primeiro toque: arma por 3 s e chama `render`.
  - Segundo toque dentro do prazo: `lojaVoltarApp()`.
- **Novo `lojaVoltarApp()`:**
  1. `lojaTimerOff()`, `lojaReset()`, `camStop()`.
  2. Marcar `state.lojaSaidaEquipe=true`, `state.lojaRota=false`, `state.lojaEquipeAte=0`.
  3. `history.replaceState(null,'','#')`, que não dispara `hashchange`; mesmo assim, o handler da D7 respeita a marca.
  4. `go(canView(state.lojaDe)?state.lojaDe:homeView())`.
  5. O usuário **continua logado** só por esse caminho.
- **CSS:** `.lj-staffhome` discreto (contorno branco 60%) e `.lj-staffhome.armed` (amarelo).

### Chaves I18N novas, item 3
| chave | pt | en |
|---|---|---|
| `ljStaffHome` | Início | Home |
| `ljStaffHomeSure` | Toque de novo para sair | Tap again to exit |

### Critérios de aceite, item 3
3.1 Admin clica em "Abrir Checkout": o botão "Início" aparece no cabeçalho na câmera, na escolha e no carrinho. Dois toques em até 3 s voltam à tela de onde ele veio, logado, sem pedir código.
3.2 Um toque só, ou dois com mais de 3 s entre eles, não sai.
3.3 Depois da primeira compra concluída (qualquer meio), o botão some até a próxima vez que o Checkout for aberto pelo botão.
3.4 Depois de 10 min do "Abrir Checkout", o botão some na próxima renderização e, se ainda estiver na tela, o clique não faz nada.
3.5 Logado com o perfil Checkout (quiosque@), ou abrindo `/#loja` direto (com ou sem sessão salva) e recarregando, o botão não aparece. Valem Esc e 3 toques no logo, que levam ao login.
3.6 Esc e o painel escondido seguem levando ao login, como na v78.

---

## ITEM 4. Valor do pacote no Checkout

### Mudanças em `/home/claude/eterna/index.html`
- **Trocar `lojaPkgAuto(n)` por `lojaIdeal(n)`:** para cada pacote do catálogo (`kind:'pacote'`):
  - `extra = digital==='todas' ? 0 : max(0, n − digital)`;
  - `custo = priceOf(pkg) + extra × priceOf('extra')`.
  - Escolhe o menor custo; empate, mais impressas (`min(n,prints)+extra`); persistindo, o pacote menor.
  - Devolve `{pkg,extra,custo}`. Os preços vêm sempre de `priceOf`, então funcionam com os preços editados no Catálogo.
- **`lojaCart`:**
  - `pkg = k.pkg` válido, ou `lojaIdeal(nPh).pkg`;
  - `extra` calculado para o pacote em uso;
  - `prints = P0 ? min(nPh, P0.prints) + extra : 0` (o "Todas" tem 0);
  - `incl = P0 ? (P0.digital==='todas' ? nSessão : min(nPh, P0.digital)) : 0`;
  - `sobra = P0 && typeof P0.digital==='number' ? max(0, P0.digital − nPh) : 0`;
  - `save`:
    - com impressa: `nPh × priceOf('arq') − (priceOf(pkg) + extra × priceOf('extra'))`;
    - no "Todas": `nSessão × priceOf('dig') − priceOf('mais')`;
    - mostrado só quando > 0 (D12);
  - devolve também `lines`: `[{t:'pkg',id,n:digital|'todas',v}, {t:'extra',n,un,v}, {t:'ai',n,un,v}]`, só as linhas com quantidade.
- **`vQuiosque`, passo `cart`:**
  - o badge Ideal usa `lojaIdeal(c.nPh).pkg`;
  - em cada pacote com extras para as fotos escolhidas, linha pequena `T('pkgPlusExtra',n,fmtR(un))`;
  - antes do Total, novo bloco `.lj-sum` com uma linha por item de `c.lines` (`sumPkg` / `sumPkgAll`, `sumExtra`, `sumAI`, valor à direita);
  - se `c.sobra>0`, `lj-fine` com `T('roomFor',c.sobra)`;
  - remover a linha `lj-fine` com `T('extra',...)` (fica no resumo);
  - "O que você leva" usa o `c.prints` novo;
  - `save` vem de `c.save`.
- **Efeito nas vendas:** `lojaPay` e `lojaDinheiro` gravam `s.prints=c.prints`. Lista de vendas, CSV e recibo usam `s.prints` (ver item 1), para não mostrar 6 impressas numa venda de 4.

### Chaves I18N novas, item 4
| chave | pt | en |
|---|---|---|
| `sumPkg(n)` | Pacote ${n} fotos | ${n}-photo package |
| `sumPkgAll` | Pacote todas as fotos | All-photos package |
| `sumExtra(n,x)` | ${n} ${PL(n,'foto extra','fotos extras')} × ${x} | ${n} extra ${PL(n,'photo','photos')} × ${x} |
| `sumAI(n,x)` | ${n} ${PL(n,'foto com fundo de IA','fotos com fundo de IA')} × ${x} | ${n} AI background ${PL(n,'photo','photos')} × ${x} |
| `pkgPlusExtra(n,x)` | + ${n} ${PL(n,'extra','extras')} de ${x} | + ${n} ${PL(n,'extra','extras')} at ${x} |
| `roomFor(n)` | Cabem mais ${n} ${PL(n,'foto','fotos')} neste pacote sem pagar mais. | You can add ${n} more ${PL(n,'photo','photos')} to this package at no extra cost. |

### Critérios de aceite, item 4 (preços padrão do catálogo; caso do print: 4 fotos do campo + 4 com fundo de IA)
4.1 Ao chegar no carrinho, o pacote marcado e com o selo Ideal é **3 fotos (R$ 109)**, com a linha "+ 1 extra de R$ 35".
4.2 O resumo mostra, nesta ordem: "Pacote 3 fotos R$ 109", "1 foto extra × R$ 35 R$ 35", "4 fotos com fundo de IA × R$ 40 R$ 160", **Total R$ 304**.
4.3 "O que você leva": **4 impressas**, **4 digitais**, 4 com fundo de IA. Economia: **R$ 132** (4 × 69 − 144).
4.4 Tocando em "6 fotos": "Pacote 6 fotos R$ 149", "4 fotos com fundo de IA × R$ 40 R$ 160", **Total R$ 309**, **4 impressas** (não 6), economia **R$ 127**, e "Cabem mais 2 fotos neste pacote sem pagar mais". O Ideal continua no 3 fotos.
4.5 Tocando em "Todas": impressas 0, "Pacote todas as fotos R$ 250" + fundos R$ 160 = R$ 410. A economia só aparece se (fotos da sessão × R$ 39) for maior que R$ 250.
4.6 Ideal por número de fotos do campo (sem IA): 1 → 1 foto R$ 69; 2 → 1 foto + 1 extra R$ 104; 3 → 3 fotos R$ 109; 4 → 3 fotos + 1 extra R$ 144; 5 → 6 fotos R$ 149; 6 → 6 fotos R$ 149; 7 → 6 fotos + 1 extra R$ 184; 9 → Todas R$ 250 (decisão em aberto b). Com 1 foto, não aparece economia.
4.7 Mudando o preço do extra para R$ 45 em Catálogo e preços, com 4 fotos o Ideal passa a ser 6 fotos (R$ 149 < R$ 154).
4.8 Pagar com PIX o caso do print baixa **4** do Caixa 1, e a Lista de vendas e o recibo mostram 4 impressões e R$ 304.
4.9 Resumo, selos e avisos aparecem nos 5 idiomas, sem chave crua, e cabem sem rolagem horizontal em 390 px, 768 px e 1366 px.

---

## Outros arquivos
- `/home/claude/eterna/testes/v79-regressao.js` (novo): critérios 1.1 a 1.15, 2.1 a 2.7, 3.1 a 3.6 e 4.1 a 4.8.
- `/home/claude/eterna/testes/loja.js`, `/home/claude/eterna/testes/galeria-qr.js`, `/home/claude/eterna/testes/v77-regressao.js`: usam PIX e não devem quebrar. Se algum conferir total ou "6 impressas", ajustar para a regra nova.
- `/home/claude/eterna/docs/DOCUMENTACAO-TECNICA.md`: `caixaDin`, estados, sincronização entre abas, D7, `lojaIdeal`.
- `/home/claude/eterna/docs/GUIA-DA-EQUIPE.md`: Caixa › Aguardando caixa, interruptor no Upload, botão Início.
- `/home/claude/eterna/docs/CONTEXTO-ETERNA.md`: seção 3 (Checkout com dinheiro pendente, `lojaVoltarApp`, `lojaIdeal`) e seção 5 (D2, D9, D11, D12).
- `VERSOES.md` e o carimbo de versão em `index.html`.
- **Agente: sem mudança.**

## Riscos de segurança e escala (para o revisor)
1. **Tudo é verificado só no navegador (protótipo).** `por`, a permissão e a idempotência valem dentro do mesmo navegador. Quem mexe no `localStorage` forja uma confirmação. Correção: o contrato do servidor acima, com `por` vindo do token e 409 para estado já fechado.
2. **Cliente confirmar a própria venda.** Fechado em três camadas: (a) a interface de confirmação não existe em `vQuiosque` nem em `lojaEquipe`; (b) `dinConfirmar` recusa com `state.lojaRota` ou `state.pub`, e o `guardAct` exige `venda.c`; (c) D7, sair do `#loja` encerra a sessão. **O revisor deve testar** troca de hash, voltar do navegador, ir para `#g` e depois `#caixa`, e recarregar.
3. **Botão Início (item 3).** É o único caminho do `#loja` ao app logado. Fica limitado a modo equipe, 10 min e antes da primeira compra, com dois toques, e a ação confere tudo de novo. Risco que sobra: um cliente nos primeiros 10 min de um Checkout aberto pela equipe e ainda sem venda. Recomendação: o ponto do cliente usa o perfil Checkout ou `#loja` direto.
4. **Sessão compartilhada entre janelas.** Esc no `#loja` remove `eterna.session`. A janela do Caixa continua logada na memória, mas pede login se recarregar. É aceitável, mas precisa constar no Guia.
5. **Gravação perdida entre abas.** A adoção pelo evento `storage` reduz a janela a milissegundos, e `simFresh()` antes de confirmar ou cancelar evita confirmar com dado velho. Ainda é "último que grava ganha" no `SIM` inteiro; o servidor resolve.
6. **Fraude no caixa.** Confirmar sem receber aparece como sobra de Dinheiro no fechamento; cancelar depois de receber deixa um cliente sem fotos, que reclama na hora. Os dois ficam auditados com nome e hora. Sugestão para depois: relatório "canceladas no caixa por operador".
7. **Poluição da fila.** O campo "código do recibo" do `#loja` aceita qualquer sessão e permite criar pendências. Fica limitado a uma por sessão (D4), com fim do dia e nada liberado; não há dano além do ruído.
8. **Compra em dobro.** Se a galeria da sessão já tinha sido publicada antes (ex.: "Não quis comprar: galeria web"), o cliente consegue comprar online enquanto o dinheiro espera. Risco baixo na fase 1 (o celular não alcança o agente); anotar para a fase 2.
9. **LGPD.** Os registros não têm dado do cliente. O e-mail do operador fica no `SIM` local e não vai para o CSV. A retenção é de 30 dias (D8).
10. **Escala.** Com 1 venue, `caixaDin` fica pequeno (no máximo 1000 registros, ~400 KB no limite). Com 100 venues, cada ponto é isolado, e a fila precisa ir para o servidor, filtrada por `venue`, paginada, com bloqueio otimista. Internet caída: tudo funciona, porque é local. Entre computadores do mesmo ponto, não funciona até o servidor existir (decisão em aberto c).
11. **Ajuste automático.** Por computador: um fotógrafo desliga para o ponto todo, de propósito, e fica registrado. Sem dano de segurança, além da brecha atual do Supervisor, que este plano fecha.

**Para guardar na memória do projeto:** os itens 3 e 4 entraram na v79 por pedido do Eduardo. Ficaram em aberto para ele as decisões (a) fundo de IA dentro do pacote ou adicional, (b) Ideal só por preço a partir de 9 fotos e (c) Checkout e Caixa no mesmo computador na v79.