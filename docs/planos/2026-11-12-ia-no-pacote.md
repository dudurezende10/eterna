# Montagem de IA dentro do pacote (v98-sim)

Regra do Eduardo (12/11): "as fotos de IA não pertencem a uma lista de produtos separada, elas fazem parte de um todo onde o cliente pode escolher elas junto com as outras fotos no checkout". Sobre o Fundo de IA na Venda manual: "tirar". O Ronaldo já tirou "Fundo de IA" do catálogo no ramo dele (produto que não existe na Imply não é cadastrado).

Base: `sim/v97-montagem` (`c81c999`). Branch `feat/ia-no-pacote`.

## Como é hoje

- **Catálogo** (`DATA.catalog`): item `fundo`, "Fundo de IA", R$ 40, `kind:'adicional'`, `prints:0`. Aparece no Painel de controle (com a nota "só na Venda manual") e tem preço editável (`SIM.prices.fundo`).
- **Checkout (`#loja`)**: desde a v79 a montagem já conta dentro do pacote. `lojaItems` = montagens + fotos na mesma grade; `lojaCart` soma `nPh + nAI`; `vendaCalc(n, nSes, pkg)` cobra pacote + adicionais de R$ 35 e nunca põe `fundo` no carrinho. O pedido leva `selected`, `aiSel` (`"<base>|<fundo>"`) e, com a montagem do servidor, `aiMont` (o `mid` que o cliente viu).
- **Venda manual (Posto)**: bloco "Fundo de IA" com `compGrid` (um fundo por venda, `s.bg`), que põe `{id:'fundo'}` no carrinho (`fila-bg`) e cobra R$ 40. Linha "Fundo: X · incluso" no resumo e no recibo em aberto.
- **Decisão de ontem (11/11, v97-sim)**: em `caixaConfirm`, com a montagem do servidor ligada, o `s.bg` virava `aiSel` de uma montagem, contava **uma impressão a mais** (`printsVenda(...)+1`) e ia para a frente da fila de impressão (como favorita).
- **Posto**: `pendEscolhaItem` mostra fotos e montagens do pedido; `pendMontAviso`/`pendMontSemImp` avisam o caixa quando a montagem não sai impressa e não vai para a galeria. Com `montEntregaDigital()` (montagem do servidor ligada e exibida) o aviso some. A Venda manual tinha um aviso próprio (`montAviso`) para o `s.bg`.
- **Impressão**: `impFotos` = favoritas, fotos, montagens, até `s.prints`. `printsVenda(cart, n)` = min(n, impressas do pacote) + adicionais.
- **Galeria**: no modo v97 (montagem só na tela) a montagem não vai para a galeria. Com a montagem do servidor, `mont_vender` marca cada `aiSel` da venda paga como vendida e `_gal_montagens` põe na galeria do ponto. Nenhum dos dois olha o item `fundo` do carrinho.
- **Números**: `fotos_ia_vendidas` (soma de `nAI`) no Painel; "montagens compradas" das Estatísticas só contava o canal Checkout; a tela Fundos de IA mostrava "Escolhidas no balcão" com a receita do item `fundo`.

## Como fica

1. **Uma foto como as outras.** Montagem e foto normal ficam na mesma grade e cada uma ocupa uma vaga do pacote. Sem preço próprio e sem linha "Fundo de IA" em carrinho, recibo, Posto ou listas. Passou do pacote: a regra de sempre (adicional de R$ 35 ou pacote maior), igual para as duas. No Maracanã Mais não há adicional: as montagens escolhidas entram.
2. **Catálogo.** `fundo` sai do `DATA.catalog`. Fica em `CAT_ANTIGO` (nome e preço de R$ 40) só para ler venda antiga: `catName`, `priceOf` e `itemV` seguem respondendo, então recibo, Lista de vendas, CSV, Painel e Estatísticas não mudam para o histórico. Migração `catMigraFundo()` na abertura, no `simFresh` e no ouvinte `storage` (pode rodar sempre): só nas vendas em aberto (nem paga nem cancelada) tira o item `fundo` do carrinho e o `bg`. O preço editado (`SIM.prices.fundo`) fica, para a venda muito antiga sem total.
3. **Venda manual.** Sai o bloco "Fundo de IA", o `fila-bg`, o `s.bg` e a linha "Fundo: X". Com `montEntregaDigital()` e montagens da sessão (`lojaAI`), elas aparecem na mesma grade das fotos, com o selo, marcadas por `fila-ai` em `s.aiSel`. `n` = fotos + montagens em todo lugar (impressas, `nFotos`, texto). Nota para o vendedor quando a escolha passa do que o carrinho cobre (a Venda manual continua com o carrinho montado à mão, como já era para foto normal). Com a montagem do servidor desligada a Venda manual não tem montagem.
4. **Entrega.** A montagem segue o pacote: galeria sempre que o servidor entrega; impressa se houver vaga de impressão. Sai o "+1 impressão" e a ida para a frente da fila. Com a montagem do servidor desligada, o aviso do Posto (`pendMontAviso`) continua igual.
5. **Selo e destaque** ("Edição Maracanã", "Suas fotos especiais") continuam. Textos que falavam em compra à parte, R$ 40 ou "só na Venda manual" saem.
6. **Números.** Mantém a contagem de montagens vendidas (montagens escolhidas em pedidos pagos, Checkout e balcão), sem receita própria. Linhas antigas do produto `fundo` continuam nos relatórios quando existirem.
7. **Agente.** `mont_vender`, `_gal_montagens`, impressão e LGPD já trabalham pelo `aiSel`; confirmar por teste que a venda sem `fundo` no carrinho e a venda antiga com `fundo` dão o mesmo resultado. "Compradas" das Estatísticas (vistas × compradas) **segue só do Checkout**, porque as "vistas" só existem lá; o total de todos os canais é `fotos_ia_vendidas`. **Decisão a confirmar com o Eduardo.**

## Revisão (12/11)

- Agente fora na confirmação da Venda manual com montagem marcada: a venda não fecha, as marcas ficam e o caixa é avisado (`vmAiPresa`, `VM_AI_FORA`); a saída é tentar de novo ou "Vender sem as fotos Edição Maracanã" (`fila-ai-limpa`, por escolha do caixa, com registro no log).
- Recibo de venda paga conta pelo que a venda gravou (`s.nGal`), não pelo estado do agente na hora.
- Não entrou: montagens de outras levas da visita na Venda manual. A venda manual é de uma sessão e a galeria dela só tem essa sessão; o servidor (`_gal_montagens`) recusa montagem de base de outra leva, então ela seria vendida sem chegar à galeria. Precisa da venda manual por visita (galeria da venda com as levas) antes.

## Fora

- Maracanã Mais continua entregando as fotos marcadas (como já é para foto normal); não passa a marcar tudo sozinho.
- Montagem na nuvem (E5) e na galeria no modo v97.
- Preço automático na Venda manual.

## Testes

`testes/ia-no-pacote.js` (novo): escolha mista dentro do pacote, estouro, pacote só digital, Maracanã Mais, Venda manual sem Fundo de IA, catálogo antigo migrado, venda antiga legível. Ajustar `posto-unico`, `posto-montagem`, `montagem-checkout`, `montagem_servidor_agente`.
