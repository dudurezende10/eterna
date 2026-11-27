# Unir sessões e vender a partir do Procurar fotos (26/11/2026)

## Objetivo

Pedido do Eduardo (26/11): quando a selfie do cliente não traz todas as sessões dele (a foto com a taça, de lado ou de boné), o vendedor acha as sessões no Procurar fotos, confirma na tela dele quais são do cliente e abre a escolha de fotos no Checkout só com essas, já unidas. A venda segue o fluxo de sempre: pedido no Checkout, pacote e pagamento no Posto.

Regra do Eduardo (26/11): **a seleção de sessões é só do vendedor.** O cliente nunca vê a lista, as sessões não marcadas nem a marcação.

## Fases

| Fase | O que entra | Situação |
|---|---|---|
| 1 | Marcar sessões pelos filtros, "Iniciar venda com N sessões", "Vender esta sessão", origem da venda no evento e na métrica do dia | Esta entrega |
| 2 | "Procurar por selfie" na tela do vendedor, com a lista de sessões achadas para ele conferir | Depois da revisão de segurança e de LGPD |
| 3 | Ajustes do que abre nas sessões achadas por selfie | Depois |

Fora do escopo: mudar a selfie do cliente, mudar os limites do Checkout, fechar sessão à força, mexer na Venda manual.

## Decisões assumidas (o Eduardo ainda pode mudar)

- A sessão marcada abre inteira no Checkout.
- Quem escolhe as fotos é o cliente, no monitor do Checkout, vendo só as sessões marcadas.
- Teto de 8 sessões por venda.
- Tudo ou nada: se uma marcada não puder entrar, nada abre e o vendedor vê o motivo.
- Sessão ainda aberta aparece com a caixa desligada e o texto "entra quando fechar (até N min)". O prazo vem da pausa de sessão do servidor (`sessPausaTxt`), não é fixo. Não há fechar à força.
- Sessão de menor ou de escola nunca entra por aqui. Ela continua na lista do vendedor, com a caixa desligada.
- Checkout com a câmera ligada (cliente no meio da selfie) conta como ocupado.
- A sessão que não é a âncora de uma venda unida aparece como vendida quando o servidor devolve as vendas do dia.
- Na tela do vendedor, as sessões marcadas aparecem com o número da sessão (`sessRot`); o canal e o evento levam só o código LP.

## Onde cada passo acontece

| Passo | Tela e aparelho | Quem vê |
|---|---|---|
| 1. Filtros e lista de sessões | Procurar fotos, janela logada do vendedor | Vendedor |
| 2. Marcar as sessões | Procurar fotos, janela do vendedor | Vendedor |
| 3. "Iniciar venda com N sessões" | Barra do Procurar fotos, janela do vendedor | Vendedor |
| 4. Escolha das fotos | Checkout (`#loja`), monitor do cliente | Cliente, só as sessões marcadas |
| 5. Pacote e pagamento | Posto, janela do vendedor | Vendedor |

O que mantém a seleção só com o vendedor:

- As marcadas moram em `state.procurar.sel`, memória da janela logada. Não vão para o SIM, para o `localStorage`, para o `sessionStorage` nem para o canal.
- O Checkout recebe uma mensagem só com os códigos marcados.
- O Checkout abre direto na foto ampliada, com as sessões unidas e o rótulo ponto e hora de sempre.
- A abertura não usa a visita (`so.visita=false`): sessão ligada por visita e não marcada não entra.
- A tela Procurar fotos não existe para a aba `#loja` nem para o perfil Checkout.
- O software não enxerga monitor espelhado ou virado para o cliente. Isso é montagem do posto e treinamento: tela estendida, nunca duplicada (está no Guia da equipe).

## O que mudou

### `index.html`

- Chave `PROCURAR_VENDER_ON` (ao lado de `PROCURA_SESSAO_ON`). Em `false`, a tela volta a ser a de antes e o Checkout ignora o pedido.
- `bfPodeVender()`: venda em Criar, fora do "ver como", fora do fotógrafo que só vê as próprias sessões, com o servidor do ponto ligado e fora da demonstração.
- `bfEstado(x)`: `aberta`, `protegida`, `paga`, `pedido`, `carregando` ou `livre`. Usa a situação da sessão no servidor, `psEstado` e as vendas de hoje de todos os postos (`MVS`, `GET /ponto/vendas-dia`, pedidas ao entrar na tela).
- `bfMk` (caixa Marcar em cada cartão, botão irmão do cabeçalho e das miniaturas), `bfSessaoVenda` ("Vender esta sessão" e Marcar na sessão aberta), `bfBarra`/`bfBarraUpd` (barra `#bf-barra` no pé da tela: contador, miniaturas das marcadas, aviso de que abrem inteiras, Limpar e Iniciar venda).
- `bfMarca(card)` não chama `render()`: troca só o botão e a barra, e a lista fica como estava. `bfEstUpd` troca só a caixa de uma sessão à vista quando a situação dela muda (fechou, foi vendida).
- A seleção sobrevive a filtro e a Atualizar; zera ao sair da tela, ao sair da conta e ao trocar de pessoa.
- `bfVender(cards, origem)`: revalida cada sessão; sem Checkout aberto, uma sessão segue pela Venda manual do Posto e mais de uma pede para abrir o Checkout; com cliente no Checkout, avisa; senão manda o pedido pelo canal e espera a resposta por 6 s.
- `lojaAbrirMsg` e `lojaAbrirPedido` (janela do Checkout): conferem formato, destinatário, idade da mensagem (4 s, menor que a espera de 6 s do vendedor) e cada sessão; abrem com `lojaAbrirSo` sem `base`; gravam só `so.origem`.
- `lojaPedido` grava `origem` no pedido e `pvDados` repassa ao evento `criar`.
- `bf-vender` e `bf-vender-uma` em `WRITE_OPS` (Criar) e `ACT_MOD` (Posto de venda).
- Textos `bf_*` no `EQ`, nas 5 línguas. Nenhum texto novo para o cliente.

### `agente/eterna-agente.py`

- `EV_ORIGENS = ("procurar", "procurar_selfie")`. `_ev_limpo` só guarda `origem` dessa lista; origem inválida sai e a venda fica.
- `met_v2` soma `por_origem` (venda sem origem cai em `sem_origem`), pela mesma regra do `por_canal`.
- `vendas_do_dia` devolve `origem`.

## Contratos

Canal `eterna-loja`:

```
{tipo:'abrir', id:'<12 a-z0-9>', para:'<janela do Checkout>', cards:['LP…'] (1 a 8), origem:'procurar'|'procurar_selfie', em:<ms>}
{tipo:'abriu', id, ok:true|false, motivo:null|'ocupado'|'carregando'|'paga'|'pedido'|'protegida'|'invalido'|'expirado'}
```

Evento `criar` (`POST /ponto/eventos`): `dados.origem` opcional; `dados.sessoes` como antes.

Métrica do dia: `por_origem: {procurar:{vendas,faturamento}, procurar_selfie:{…}, sem_origem:{…}}`.

Auditoria `procurar_vender`, em duas linhas ligadas pelo campo `pedido`: no envio, `[{campo:'sessoes',de:null,para:'…'}]` com `{posto,porNome,origem,n,via,pedido,resultado:'enviado'}`; na resposta do Checkout, `[{campo:'resultado',de:'enviado',para:'aberto'|'recusado: <motivo>'}]`. Cada linha é gravada uma vez; sem resposta em 1 min fica só a do envio. `via` = `checkout` ou `venda_manual` (esta com uma linha só).

## Testes

- `testes/procurar-vender.js`: quem vê Marcar, marcar sem redesenhar, barra, estados em palavras, abertura só das marcadas (unidas, inteiras, sem visita), recusas do Checkout, Checkout ocupado ou fechado, origem no pedido e no evento, auditoria, chave desligada.
- `testes/procurar-sem-vazar.js`: vendedor e Checkout em duas páginas do mesmo navegador; confere o DOM e o estado do Checkout, o canal, o `localStorage` e o `sessionStorage` do início ao fim.
- `testes/procurar_origem_agente.py`: lista de origens, `por_origem` e `vendas_do_dia`.
- Apoio: `testes/_procurar_vender.js` (agente falso, sessões e cadastros de teste).

## Ajustes da revisão de código (26/11)

- A mensagem ao Checkout vale 4 s e o vendedor espera 6 s. Resposta que chega depois do prazo, ou com o vendedor já em outra tela, ainda grava a auditoria e limpa a seleção.
- Sem Checkout aberto, a venda de uma sessão nunca nasce como Cortesia.
- Caixa Marcar com 44 px. Barra das marcadas só com miniatura e número; em tela estreita, uma linha com rolagem lateral.
- Vendedor recém-recarregado espera o Checkout se anunciar (até 5,5 s) antes de cair na Venda manual.
- O selo do cartão acompanha a sessão que fecha ou é vendida; a marcada que não pode mais entrar fica riscada na barra.
- Avisos com "Sessão 147".
- Agente: `_ev_origem(d)` no lugar da expressão repetida.
- A auditoria é gravada no envio e de novo no desfecho; os prazos não são alteráveis pela página (os testes servem o `index.html` com o prazo trocado); mensagem vencida no Checkout mostra ao vendedor o texto de "não respondeu".

## O que ficou para depois

- Fase 2 (busca por selfie do vendedor).
- A Venda manual não leva `origem` (a venda aberta por ela, sem o Checkout, entra em `sem_origem`).
- As sessões do dia continuam no SIM de todo navegador do ponto, como antes desta entrega. O que esta entrega garante é que a lista e a marcação do vendedor não são gravadas em lugar nenhum.
