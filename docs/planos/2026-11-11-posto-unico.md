# Posto único: Posto de venda, Caixa como filtro, Venda manual dentro do Posto (v97-ux)

Branch `feat/posto-unico`, a partir de `a9b4028` (`feat/ondas-ux`, v96-ux). Item 4 da análise de telas.
Pedido do Eduardo (11/11): "Pode resolver para ficar limpo e fácil de operar com apenas o necessário."

## Objetivo

O vendedor trabalha numa tela só, o Posto de venda: Checkout, pagamentos, impressão e, quando o Checkout está fora, a venda manual.
O botão amarelo "Caixa" continua no topo, conta só o dinheiro esperando confirmação e abre o mesmo Posto filtrado em dinheiro, com o título "Caixa".

## Antes de começar (obrigatório)

1. A branch `fix/checkout-espera` (botão "Recomeçar o Checkout" no cartão do pedido ligado ao Checkout, dentro do Posto) entra antes. Hoje ela ainda aponta para `a9b4028`, sem commits.
2. O programador do Posto espera essa branch ser aprovada e faz `git merge fix/checkout-espera` em `feat/posto-unico` antes da primeira linha de código. Sem esse merge, não começa.
3. Zonas de conflito esperadas: `pendEscolhaItem`, `pendAcoes`, `ecoBody`, CSS `.pend-*` e `.eco-*`. Regra: o botão "Recomeçar o Checkout" fica onde a outra branch pôs; este plano não move nem reescreve o HTML do bloco `#eco` nem do cartão do pedido, só os envolve.
4. Rodar `bash testes/rodar.sh` depois do merge e antes de mexer (linha de base com `FALHAS: 0`).

## Escopo desta entrega

- Some a tela Fila do balcão (`vFila`). O link `#fila` abre o Posto.
- Some a tela Caixa antiga (`vCaixa`). `#caixa` e o botão amarelo abrem o Posto filtrado em dinheiro, título "Caixa".
- Venda manual (`vCheckout`) vira um bloco dentro do Posto, aberto pelo link "Venda manual (quando o Checkout está fora)". `#checkout` abre o Posto com esse bloco aberto.
- Contador do botão amarelo "Caixa": só dinheiro esperando confirmação.
- O botão "Cliente pediu: apagar as fotos" (LGPD), que só existia na Fila do balcão, passa para a Venda manual.
- Textos: Início, Permissões, `MODULE_INFO.venda`, descrição do perfil Atendimento e venda, Lista de vendas, Guia da equipe.

## Fora do escopo

- Nenhuma regra de pagamento, caixa, impressão, registro de venda, virada do dia ou permissão muda: `pendConfirmar`, `dinConfirmar`, `dinCancelar`, `dinPegar`, `dinFechar`, `pendEscolher`, `caixaConfirm`, `impIniciar`, `pvEvento`, `lojaPedido` ficam iguais.
- Checkout do cliente (`vQuiosque`, `lj-*`, `I18N`): nada muda. Por isso não há chave nova no `I18N`.
- Redesenho do bloco "Agora no Checkout" e do cartão do pedido (fica com a v96 e com `fix/checkout-espera`).
- Tirar `fila` de `MODULES` e dos menus gravados (fica para uma versão depois que nenhum cadastro antigo usar).
- Multiterminal, TEF, servidor: nada.

## Decisões assumidas

1. **Duas views, uma tela.** `posto` (vista completa) e `caixa` (o mesmo `vPosto` com o filtro dinheiro) continuam como views. Assim `#caixa`, o item do menu e o botão amarelo funcionam sem estado escondido. `checkout` e `fila` deixam de ser telas: viram apelidos que caem em `posto`.
2. **O filtro só existe no Caixa.** No Posto não há chips Todos/Dinheiro (o botão amarelo já é o filtro). No Caixa aparece um chip "Dinheiro ✕"; tocar nele vai para o Posto completo. Sai `state.posto.filtro` e `state.posto.filtroCaixa`.
3. **"Dinheiro esperando confirmação"** = pendência aberta, com pacote e valor, cujo meio é dinheiro: `aberta(r) && !pendSemMeio(r) && meioDe(r)==='dinheiro'`. Pedido do Checkout sem pacote ou sem meio NÃO conta e NÃO aparece no Caixa (hoje `meioDe` devolve 'dinheiro' para ele e o filtro atual o mostra como dinheiro: é bug, corrigido aqui). Cartão e PIX nunca contam.
4. **O item "Posto de venda" do menu** continua com o número de todas as pendências abertas (`#rail-din`, como hoje). O número do Caixa é outro, só dinheiro.
5. **Cabeçalho.** Posto: eyebrow `postoNome()` ("Caixa 1"), `h1` "Posto de venda". Caixa: eyebrow "Posto de venda · Caixa 1", `h1` "Caixa" (sem parênteses). Um selo de rolo só no cabeçalho, nos dois.
6. **Caixa e Posto se comportam igual depois de confirmar.** Hoje, no `#caixa`, confirmar abre o recibo sozinho; no Posto não. Fica como no Posto (o cliente vê o QR no Checkout; o recibo abre por "Recibo" em Minhas vendas de hoje).
7. **Venda manual dentro do Posto.** Bloco em largura cheia logo abaixo do cabeçalho; os blocos Agora no Checkout, Aguardando pagamento e Imprimir continuam abaixo dele (o vendedor não perde um pagamento chegando). Abre e fecha pelo link; não é tela nova.
8. **Venda manual e Recibo não convivem.** Abrir a Venda manual fecha o recibo aberto; com a Venda manual aberta numa sessão, os botões "Recibo" e os cartões "Vindas da Fila do balcão" ficam desabilitados (eles trocam `state.caixa.session`, que é a sessão que a Venda manual cobra). Assim nenhuma função de pagamento muda.
9. **Recarregar mantém a Venda manual.** Com o bloco aberto, o endereço fica `#checkout`; recarregar abre o Posto com a Venda manual (etapa 1, como hoje).
10. **Permissões iguais.** Mesmo módulo `venda`, mesmas letras. Quem via a Venda manual é quem tem `checkout` no menu; quem via o Caixa é quem tem `caixa` no menu. Quem tinha só `caixa`, `checkout` ou `fila` no menu (cadastro personalizado) passa a ver também o item Posto de venda, porque é a mesma tela, no mesmo módulo, sem letra nova.
11. **Fila do balcão no Permissões.** O `fila` fica em `MODULES` e nos menus gravados (compatibilidade com `permValidate` e com os cadastros), mas some da lista de checkboxes do Permissões.

## Mudanças por arquivo

### `index.html`

**Estado**
- Linha ~1961: troca `state.posto.filtro='todos';state.posto.filtroCaixa='dinheiro';` por `state.posto.manual=false;` (fica `state.posto.recibo=null`). Nada disso vai para o `SIM`.

**Novas funções puras (perto de `dinAbertas`, ~1514)**
- `const dinEspera=r=>aberta(r)&&!pendSemMeio(r)&&meioDe(r)==='dinheiro';`
- `const caixaAbertas=()=>dinAbertas().filter(dinEspera);`
- `const caixaAtrasada=()=>caixaAbertas().some(r=>dinMin(r)>CAIXA_ALERTA_MIN);`
- `const VENDA_VIEWS=['posto','caixa','checkout','fila'];`
- `function postoAlias(v)`: devolve `{v:'posto',manual:true}` para `checkout` (só se `canView('checkout')`; sem isso, `manual:false`), `{v:'posto',manual:false}` para `fila`, e `{v}` para o resto.

**Navegação**
- `canView(v)` (~4895): para `v==='posto'`, o `menuOk` vale se qualquer de `VENDA_VIEWS` estiver no menu da pessoa (`VENDA_VIEWS.some(menuOk)`). O `base` (`can('venda','r')`) não muda. As outras views não mudam.
- `go(v)` (~5393): no começo, `const al=postoAlias(v);` checa `canView(v)` (a view pedida, para manter quem pode o quê); depois usa `al.v` como view e, se `al.manual`, liga `state.posto.manual=true` e zera `state.posto.recibo` e `state.caixa.session`. Grava `eterna.view` com `al.v`.
- `readHash()` (~5396): depois do `canView(v)`, aplica `postoAlias(v)` do mesmo jeito.
- `render()` (~5346): antes de escolher `fn`, normaliza `state.view` por `postoAlias` (cobre `eterna.view` antigo no `localStorage`, `inicio` de cadastro personalizado e testes que põem `state.view='checkout'` direto).
- `syncHash()` (~5394): com `state.view==='posto'&&state.posto.manual`, escreve `#checkout`; senão, como hoje.
- `LEGACY_HASH.venda` continua `'checkout'` (cai no apelido).
- `VIEWFN` (~5315): `posto:()=>vPosto({filtro:'todos'})`, `caixa:()=>vPosto({filtro:'dinheiro'})`, `checkout` e `fila` apontam para o mesmo `VIEWFN.posto` (o `readHash` exige a chave). Sai `vCaixa` e `vFila` do mapa.
- `VIEWS_EXTRA` (~1342): `{checkout:'Venda manual',fila:'Fila do balcão',caixa:'Caixa'}` (igual; o rótulo de `caixa` já é "Caixa").
- `render()` (~5332 e ~5352): as listas `['posto','caixa','checkout']` continuam valendo (`checkout` nunca chega lá depois da normalização; pode sair).
- `AGENT_VIEWS` (~3407): sem mudança (`posto` e `caixa`).

**`vPosto(o)` (~1962)**
- `filtro = o.filtro==='dinheiro'?'dinheiro':'todos'`; `const cx = filtro==='dinheiro'`.
- Cabeçalho: eyebrow `cx ? 'Posto de venda · '+postoNome() : postoNome()`; `h1` `cx ? 'Caixa' : 'Posto de venda'` (por `viewLabel(state.view)`). À direita, um `roloSelo('neutral')` e "Abrir Checkout" (como hoje).
- Recibo: `rc` só por `state.posto.recibo===state.caixa.session` (sai o `||state.view==='caixa'`). Com `state.posto.manual` ligado, não desenha recibo.
- Logo abaixo de `conn` e do recibo: se `state.posto.manual && canView('checkout')`, `<section class="panel posto-manual" id="posto-manual">` com `h2` "Venda manual", nota "Para quando o Checkout está fora", o corpo de `vCheckoutCorpo()` e, à direita do `h2`, `<button class="link-quiet" data-act="posto-manual-fechar">Fechar venda manual</button>`.
- Coluna direita: `pendPainel({filtro,semId})`, `impPainel(null)`, `filaBalcao`. `filaBalcao` e os botões "Recibo" de `minhasVendas()` ficam `disabled` com `state.posto.manual && state.checkout.session`.
- Rodapé: o link vira `<button class="link-quiet" data-act="posto-manual">Venda manual (quando o Checkout está fora)</button>`, só com `canView('checkout')` e com o bloco fechado.

**`pendPainel(o)` (~1607)**
- `L = din ? caixaAbertas() : dinAbertas()`.
- Chips: no Posto, nenhum. No Caixa (`din`), um só: `<button class="chip pend-filtro-on" data-act="posto-filtro" data-f="todos" aria-pressed="true" title="Ver tudo no Posto de venda" aria-label="Tirar o filtro Dinheiro">Dinheiro ${CROSS}</button>`.
- Vazio: Posto "Nenhum pagamento esperando."; Caixa "Nenhum dinheiro esperando confirmação."
- O número no cabeçalho do bloco continua `L.length` (no Caixa é o mesmo número do botão amarelo); cor por `caixaAtrasada()` no Caixa e `dinAtrasada()` no Posto.
- `pendEscolhaItem`: o "Cancelar" (hoje `btn ghost` ao lado da nota) passa a `<div class="pend-cancel"><button class="link-danger" data-act="din-cancel" ...>Cancelar compra</button></div>`, igual a `pendAcoes`. Mesmo `data-act`, mesmo segundo toque. Só se não conflitar com `fix/checkout-espera`; se conflitar, fica como está e anota na revisão.

**Venda manual (`vCheckout`, ~1986)**
- Renomear para `vCheckoutCorpo()` e devolver só o corpo (sem `div.head` com `h1`, sem `roloPill()`): barra de etapas, câmera e código (etapa 1), escolha (etapa 2), pagamento (etapa 3), recibo (paga).
- Etapa 2 e 3: a linha que hoje é `head` vira uma linha `.posto-manual-sess` com `<button class="chip" data-act="checkout-back">← Outra sessão</button>`, o vendedor (`checkout-seller`), o código da sessão em `b` e a nota de fotógrafo, ponto e hora. Sem `h1`.
- Etapa 2: o botão LGPD que estava na Fila (linha ~1416, mesmo HTML, mesma condição `sim.status!=='paga'&&can('galerias','u')`) e o modal `state.lgpdAsk===s.card` (linhas ~1417 a 1421) passam para cá, perto de "Não quis comprar".
- Etapa 1: o `input.code` ganha `id="ck-code" data-keep="1"` (o Posto redesenha com o Checkout e o storage; sem isso o foco some enquanto o vendedor digita).
- Paga: "Próximo convidado" (`checkout-next-guest`) mantém o bloco aberto na etapa 1.

**Cliques (switch, ~5420 a 5700)**
- `posto-manual` (novo, não grava, fora do `WRITE_OPS`): recusa com toast "Sem acesso à Venda manual" se `!canView('checkout')`; liga `state.posto.manual=true`, zera `state.posto.recibo`, `state.caixa.session`, `state.caixa.reprint`; se a view é `caixa`, vai para `posto` (`go('posto')`), senão `render()`; rola até `#posto-manual`.
- `posto-manual-fechar` (novo, não grava): faz o mesmo que `checkout-back` (devolve a sessão `no checkout` ao estado anterior) e desliga `state.posto.manual`; `render()`.
- `posto-filtro`: `d.f==='todos'` → `go('posto')`; `d.f==='dinheiro'` → `go('caixa')`. Sem estado.
- `caixa-open`: com `state.posto.manual&&state.checkout.session`, toast "Feche a venda manual antes de abrir outro recibo" e para.
- `sales-receipt` (~5565): passa a `state.caixa.session=d.card;state.posto.recibo=d.card;state.posto.manual=false;go('posto')`.
- Saem `fila-open`, `fila-back`, `fila-send` (e `'fila-send'` do `WRITE_OPS`). Ficam `fila-sel`, `fila-add`, `fila-bg` (a Venda manual usa).
- `closeModal()` (~5730): troca `state.view==='fila'` por `state.posto.manual`.

**Câmera da Venda manual**
- `camWanted()` (~5121): `(state.view==='posto'||state.view==='caixa')&&state.posto.manual&&(!state.checkout.session||state.checkout.step===1)` no lugar de `state.view==='checkout'&&...`.
- `camFound` (~5167): `else if(state.posto.manual&&(state.view==='posto'||state.view==='caixa'))`.
- `caixaConfirm` (~1488): `state.view==='checkout'` vira `state.posto.manual`.
- `pendConfirmar` (~1571): sai `if(state.view==='caixa')state.caixa.session=r.card;` (decisão 6).
- `zoom` (~5510): `state.view==='fila'||state.view==='caixa'` vira `state.posto.manual`.

**Botão amarelo e contadores**
- `railCk()` (~5378): o `cx` ganha o número: `const n=caixaAbertas().length;` e, com `n`, `<span class="pill ${caixaAtrasada()?'warn':'neutral'}" id="rail-cx">${n}</span>` depois do texto; `aria-label` "Caixa, N em dinheiro para confirmar" (sem número: "Caixa"). Mesma condição de hoje (`canView('caixa')&&can('venda','c')`). Com `state.view==='caixa'`, o botão ganha `aria-current="page"`.
- `postoPill()` (~5373): sem mudança (todas as pendências, no item do menu).
- `vPerfis()` (~1374 a 1377): `ops` "N aguardando caixa" vira "N aguardando pagamento" (todas); `cxCard` usa `caixaAbertas().length`: "Caixa · N em dinheiro para confirmar", descrição "o Posto só com o dinheiro do Checkout".
- Lista de vendas (~2144): o chip das pendências abertas vira "Caixa" (`data-v="caixa"`) quando o registro é `dinEspera`, e "Posto" (`data-v="posto"`) nos outros, cada um só com `canView` da view.
- Intervalo de 60 s (~5883): `state.view==='caixa'` vira `state.view==='caixa'||state.view==='posto'` só se não houver campo com foco (a regra de foco que já existe ali continua).

**Permissões e textos**
- `MODULE_INFO.venda.desc`: "Posto de venda (no menu Venda), Caixa (botão amarelo: o Posto só com o dinheiro) e Venda manual (dentro do Posto)". Letras iguais.
- `PRESETS.venda.desc`: "as telas de venda no balcão" vira "a Venda manual (quando o Checkout está fora)". `menu` e `perms` iguais.
- `vPermissoes` (~5021): na lista "Aparece no menu", pula `fila`; o texto extra passa a ser: `caixa` " (botão amarelo Caixa)", `checkout` " (link dentro do Posto)", `quiosque` igual.
- Comentários: tirar os de "v94-ux: substituída pelo Posto" e o de `vCaixa` sem uso.

**Remoções**
- `vFila()` (~1410 a 1445) e `vCaixa()` (~1470 a 1482). `caixaDetalhe` fica (o Posto usa para sessões antigas `no caixa`).

**CSS**
- `.posto-manual{margin-bottom:14px}` e `.posto-manual>.head{display:flex;justify-content:space-between;align-items:center}`.
- `.posto-manual-sess{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:10px}`.
- `.pend-filtro-on{display:inline-flex;gap:6px;align-items:center;min-height:44px}`.
- `#rail-cx` usa o `.railck .pill{margin-left:auto}` que já existe.

**Carimbo**: `v97-ux · 11/11 hh:mm` nas duas ocorrências.

### `docs/`
- `GUIA-DA-EQUIPE.md`: seção do Caixa (~309): "toque em Caixa: o número mostra quantos pagamentos em dinheiro esperam confirmação; abre o Posto só com o dinheiro; toque em Dinheiro ✕ para ver tudo". Tirar "Fila do balcão" e "venda no balcão" (~503); Venda manual dentro do Posto; LGPD na Venda manual; rolo (~579) sem "no alto do Caixa" separado.
- `CONTEXTO-ETERNA.md` seção 3: linha de Navegação (`VIEWS_EXTRA` "abertas por botões" → `checkout` e `fila` são apelidos do Posto; `caixa` = Posto com filtro dinheiro); seção 5, linha da branch `feat/ondas-ux`, acrescentar o Posto único.
- `DOCUMENTACAO-TECNICA.md`: seção do Posto (v83/v94).
- `VERSOES.md`: linha `v97-ux`.

## Contratos

- Estado (memória da tela, nunca no `SIM` nem no servidor): `state.posto.manual: boolean`, `state.posto.recibo: card|null`. Saem `state.posto.filtro` e `state.posto.filtroCaixa`.
- Views: `posto` (completa), `caixa` (filtro dinheiro). Apelidos: `checkout` → `posto` com Venda manual aberta; `fila` → `posto`.
- Hash: `#posto`, `#caixa`, `#checkout` (Posto com Venda manual), `#fila` → `#posto`, `#venda` → `#checkout`.
- `data-act` novos (não gravam, fora do `WRITE_OPS`): `posto-manual`, `posto-manual-fechar`. Muda o efeito de `posto-filtro` (navega). Saem `fila-open`, `fila-back`, `fila-send`.
- Ids novos: `#posto-manual`, `#rail-cx`, `#ck-code`.
- Agente: nenhum endpoint muda. `SIM`: nenhum campo muda. `I18N`: nenhuma chave.

## Critérios de aceite

Perfis de teste: Admin (Eduardo), Supervisora (Sandessa), Atendimento e venda, Fotógrafo, Checkout. SIM com 1 dinheiro pronto (`L00-teste0din01`), 1 PIX pronto, 1 cartão pronto, 1 pedido do Checkout sem pacote e 1 com pacote e meio dinheiro.

1. Merge feito: `git log feat/posto-unico` contém os commits de `fix/checkout-espera`; o botão "Recomeçar o Checkout" aparece no cartão do pedido ligado ao Checkout, no Posto e no Caixa, com o mesmo comportamento da branch dele.
2. Vendedor entra e cai no Posto: eyebrow "Caixa 1", `h1` "Posto de venda", 1 selo de rolo em `#main` (contar `.pill` com "Rolo:"), blocos "Agora no Checkout", "Aguardando pagamento" e "Imprimir". Não existe chip `posto-filtro` no Posto.
3. Botão amarelo "Caixa" mostra `#rail-cx` = 2 (o dinheiro pronto e o pedido do Checkout com dinheiro escolhido e pacote). PIX, cartão e pedido sem pacote não contam. Sem dinheiro esperando, o botão aparece sem número.
4. Tocar no "Caixa": `state.view==='caixa'`, `location.hash==='#caixa'`, `h1` exatamente "Caixa" (sem parênteses, sem "Posto"), eyebrow "Posto de venda · Caixa 1"; "Aguardando pagamento" lista só os 2 itens do critério 3 e o número do bloco é 2.
5. No Caixa, o chip "Dinheiro ✕" leva ao Posto completo (`state.view==='posto'`, `h1` "Posto de venda", 5 itens na lista). Em nenhum momento o vendedor passa por outra tela.
6. Pedido do Checkout sem pacote e sem meio nunca aparece no Caixa; aparece no Posto.
7. Confirmar "Recebi R$ X" no Caixa grava igual a hoje (comparar `SIM.caixaDin`, sessão e fila `eterna.ponto.fila.v1` com o mesmo roteiro na `a9b4028`, menos datas e ids), o número do botão cai para 1 e nenhum recibo abre sozinho.
8. `#fila` (digitado ou no `localStorage` `eterna.view`) abre o Posto completo, com o endereço trocado para `#posto`. Não existe mais "Sessões prontas" nem "Enviar ao caixa" em nenhuma tela.
9. `#checkout` e `#venda` abrem o Posto com o bloco "Venda manual" aberto (`#posto-manual`), câmera do balcão ligada, e o endereço fica `#checkout`. Recarregar mantém o bloco aberto na etapa 1.
10. No Posto, o link "Venda manual (quando o Checkout está fora)" abre o bloco sem trocar de view; "Fechar venda manual" fecha e a sessão escolhida volta ao estado anterior (como `checkout-back`).
11. Venda manual de ponta a ponta dentro do Posto (sessão, fotos, pacote, Fundo de IA, pagamento PIX, recibo com QR, Próximo convidado) grava igual à v96-ux na tela Venda manual (comparar campo a campo, menos datas e ids). O Fundo de IA continua só aqui.
12. Com a Venda manual aberta numa sessão, os botões "Recibo" de Minhas vendas e os cartões "Vindas da Fila do balcão" estão `disabled`; forçando `caixa-open` pelo console, aparece o toast e `state.caixa.session` não muda.
13. Digitar o código na etapa 1 da Venda manual enquanto o Checkout (outra janela) muda de etapa: o texto e o foco ficam no `#ck-code`.
14. Admin e Supervisora: item "Posto de venda" no menu (grupo Venda), botões amarelos "Abrir Checkout" e "Caixa" no topo, link Venda manual no Posto, botão "Cliente pediu: apagar as fotos" na etapa 2 da Venda manual. Vendedor: o mesmo, menos o botão LGPD (não tem `galerias.u`). Fotógrafo e Checkout: nenhum desses.
15. Permissões: `PRESETS` com `perms` e `menu` iguais aos da `a9b4028` (comparar JSON). Em Permissões, a lista do módulo Posto de venda mostra Posto de venda, Caixa (botão amarelo Caixa) e Venda manual (link dentro do Posto), sem Fila do balcão. Salvar um cadastro que tinha `fila` no menu não dá erro e mantém `fila` gravado.
16. Cadastro personalizado com `venda` RW e menu só `['caixa']`: vê o botão amarelo e o item Posto de venda; não vê o link Venda manual; `#checkout` abre o Posto sem o bloco. Cadastro sem `venda.r`: `#posto`, `#caixa`, `#checkout`, `#fila` caem em "Sem acesso a esta tela".
17. Quem tem `venda.r` sem `venda.c` (só ver): no Caixa e no Posto não há botões de confirmar nem de cancelar, e o botão amarelo não aparece (como hoje).
18. Início (Admin): "Caixa · N em dinheiro para confirmar" com o mesmo N do botão amarelo; pílula "N aguardando pagamento" com todas.
19. Lista de vendas: pendência em dinheiro mostra o chip "Caixa" e abre o Caixa; pendência PIX ou cartão mostra "Posto" e abre o Posto; "Recibo" de venda paga abre o recibo em cima do Posto.
20. Agente desligado: Posto e Caixa mostram a faixa vermelha de conexão, nenhum `pill good` no cabeçalho, e o número do Caixa continua vindo do `SIM` local.
21. `testes/todas-as-telas.js` abre `perfis`, `posto`, `caixa`, `checkout` e `fila` sem erro (os dois últimos renderizam o Posto). `bash testes/rodar.sh` termina com `FALHAS: 0`.
22. 390 px (celular) e 1920 px: Posto, Caixa e Venda manual sem rolagem horizontal; o chip "Dinheiro ✕" e os links têm alvo de toque de 44 px.

## Testes que mudam

- `ondas-ux-e.js`: E5 (sem chips no Posto; `#caixa` com `h1` "Caixa", só dinheiro, chip "Dinheiro ✕" volta ao Posto), E6 (Venda manual dentro do Posto: 1 selo de rolo só), E9 (`state.view==='posto'`, `#posto-manual` visível, `h2` "Venda manual"), E10 (botão amarelo com `#rail-cx`, só dinheiro).
- `ondas-ux-h.js`: casos de `#checkout` e `#fila` esperam `posto` (linha ~43).
- `v78-regressao.js`: `#venda` espera `posto` com Venda manual (linha ~78); bloco G sem a tela Fila (linhas ~137 a 145: "Venda manual" no Posto; "Fila do balcão" não aparece mais).
- `v79-regressao.js`: 1.6 (barra com o botão Caixa e o número só de dinheiro), 1.8 (segunda janela `#caixa` continua `caixa`), I1 (aba do Checkout com `#caixa` continua no Checkout sem login: não muda).
- `v77-regressao.js`: R1 (reload depois do Recibo cai em `posto`), linha ~284 (lista de telas sem `fila`/`checkout` como telas próprias), linha ~305 (Caixa pelo Posto).
- `v83.js` (~300): o detalhe com `caixa.tef` é do `caixaDetalhe`, abrir pelo recibo no Posto.
- `rolo-posto.js` (~77): selo e "Troquei o rolo" no Caixa vêm do `vPosto` (classe `neutral`).
- `todas-as-telas.js`, `permissoes.js` (~68, views fora de `VIEWS`), `galeria-qr.js` (~199, `eterna.view='checkout'` cai no Posto), `_v79-testador.js` (~71), `v81.js` (~109), `estatisticas.js` e `v92-testador.js` (sessões `no caixa` cobradas pelo Posto).
- Novo `testes/posto-unico.js` com os critérios 2 a 19.

## Riscos de segurança e escala (para o revisor)

1. **Ações de venda desenhadas no Posto.** `checkout-*`, `fila-add`, `fila-sel`, `fila-bg`, `caixa-pay`, `caixa-confirm` passam a ser clicadas na view `posto`/`caixa`. O `guardAct` usa `MODULE_OF[state.view]`, que é `venda` nas três: a letra exigida não muda. Conferir que nenhuma dessas entrou no `ACT_MOD` com outro módulo.
2. **Esconder o link não é proteger.** Quem tem Posto sem `checkout` no menu pode chamar `posto-manual` pelo console: o `case` precisa recusar sem `canView('checkout')`. As ações de venda continuam exigindo `venda.u`/`venda.c` de verdade (a proteção real).
3. **Sessão cobrada errada.** Venda manual e Recibo usam o mesmo `state.caixa.session`. A trava do critério 12 (Recibo e "Vindas da Fila" desabilitados e `caixa-open` recusado com a Venda manual numa sessão) é obrigatória; sem ela, "Receber e imprimir" pode cobrar a sessão do recibo aberto.
4. **Contagem de dinheiro.** `meioDe` devolve 'dinheiro' para registro sem meio. O `dinEspera` precisa do `!pendSemMeio(r)`; senão um pedido do Checkout sem pacote vira "dinheiro esperando" (R$ 0) no botão e no Caixa.
5. **Apelidos e permissão.** `go`, `readHash` e `render` checam `canView` da view pedida antes de trocar pelo Posto. `#checkout` sem `canView('checkout')` não abre a Venda manual. O `canView('posto')` estendido só aceita quem já tem `venda.r`: confirmar que nenhum perfil sem `venda.r` passa.
6. **Janela do Checkout.** `#caixa`, `#checkout` e `#fila` digitados na aba do Checkout (`sessionStorage['eterna.lojaTab']`) continuam voltando ao `#loja` sem login (testes I1 da v79 e v81 continuam valendo).
7. **LGPD.** O botão de apagar fotos muda de tela, não de regra: continua com `can('galerias','u')`, só sessão não paga, modal de confirmação e `lgpd-excluir` como hoje.
8. **Redesenho e câmera.** O Posto redesenha a cada mudança do Checkout (storage e `BroadcastChannel`). Com a Venda manual aberta, conferir que `camMount` não reinicia a câmera a cada render e que nenhum campo perde o foco (`#ck-code`, `#pend-ref`, `#din-q`).
9. **Escala.** Tudo é local por ponto: com 1 venue ou 100, cada Posto filtra o seu `SIM.caixaDin` (até 1000 fechadas + abertas do dia, já limitado pelo `dinVirada`). `caixaAbertas()` roda em cada `railCk` (render e 60 s): é um filtro sobre as abertas do dia, barato. Sem internet nada muda: o Posto e o Caixa funcionam só com o `SIM` e o agente local, e a faixa vermelha avisa.
10. **Deploy.** Depois do deploy, fechar e reabrir Checkout e Posto em todos os caixas (regra da v96). Uma janela antiga com a tela Fila do balcão aberta ainda consegue "Enviar ao caixa"; a sessão `no caixa` aparece no Posto novo em "Vindas da Fila do balcão" e é cobrada pelo `caixaDetalhe`, então nada se perde.

## Decisões que dependem do Eduardo

1. **Chips no Posto.** O plano tira os chips Todos/Dinheiro do Posto (o botão amarelo já filtra) e deixa só o "Dinheiro ✕" no Caixa. Se ele quiser o chip Dinheiro também no Posto, é uma linha.
2. **Eyebrow do Caixa.** "Posto de venda · Caixa 1" em cima de "Caixa", para não ficar "Caixa 1" em cima de "Caixa". Ele pode preferir só "Caixa 1".
3. **Recibo depois do dinheiro.** O plano tira o recibo que abria sozinho no Caixa depois de confirmar (fica igual ao Posto). Se ele quiser o recibo automático no dinheiro, volta nos dois.
4. **Número no item do menu.** O item "Posto de venda" continua com todas as pendências e o botão amarelo com só o dinheiro. Ele pode preferir tirar o número do item do menu para não ter dois números.

## Decisões

Respostas do Eduardo (11/11) às 4 dúvidas da seção anterior:

1. **Chips no Posto.** Sem os chips Todos/Dinheiro no Posto. O filtro de dinheiro é o botão amarelo Caixa; na vista Caixa, o chip "Dinheiro ✕" volta ao Posto completo.
2. **Rótulo do Caixa.** Na vista Caixa, o rótulo em cima do título é "Posto de venda · Caixa 1" (nome do ponto).
3. **Recibo depois do dinheiro.** Confirmar dinheiro não abre recibo sozinho, em nenhuma das duas vistas.
4. **Dois números.** Ficam os dois: todas as pendências no item do menu e só o dinheiro no botão amarelo.

Também do Eduardo (item de nomes):

- O título "Computador do ponto" deixa de existir em texto visível: `postoTitulo()` devolve "Posto de venda · " + nome do ponto ("Posto de venda · Caixa 1").
- Fica o padrão da Onda 1: botão principal grande e "Cancelar compra" como link vermelho afastado (agora também no pedido do Checkout sem pacote).
- Os botões amarelos do topo continuam.

Decisões do programador na implementação:

- **Apelidos e permissão (critério 16 contra o texto de `go`).** O plano pedia `canView` da view pedida em `go` e `readHash`, mas o critério 16 pede que `#checkout` sem `checkout` no menu abra o Posto sem o bloco. Ficou: `go`, `readHash` e `render` conferem `canView` da view de destino (`posto`, que exige `venda.r` e alguma tela de venda no menu) e a Venda manual só abre com `canView('checkout')`.
- **Selo do rolo.** Um selo só, no cabeçalho (critério 2): o painel Imprimir do Posto deixa de repetir o selo que a v96 tinha posto ali. O painel Impressão 10×15 do Dashboard e o painel de reimpressão do recibo continuam com o selo. `testes/rolo-posto.js` ajustado.
- **Carimbo.** `v97-ux` (o merge da `fix/checkout-espera` trouxe `v97`; esta branch segue a série `-ux`, só local).
- **Venda manual com sessão LGPD.** Sessão já apagada por LGPD escolhida na Venda manual mostra só o selo da exclusão (como a Fila do balcão fazia).
- **Recibo com a Venda manual aberta sem sessão.** O botão Recibo fecha o bloco e abre o recibo (os dois não convivem); com sessão escolhida, fica desabilitado.
- **Testes fora de linha na base.** `ondas-ux-e.js` (E5, E10), `ondas-ux-h.js` (H4, H1), `permissoes.js` (menus e gaveta) e `v79-regressao.js` (1.6) já falhavam na `a9b4028`: os commits `cace1c4` (botões amarelos no alto do menu), `cdcf4b5` (Caixa de volta à tela antiga) e `a9b4028` (pasta Laboratório) mudaram a tela sem ajustar esses testes.
