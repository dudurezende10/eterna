# Qualidade (Curadoria): período por atalhos e data específica

Branch `feat/curadoria-datas`, a partir de `865af05` (v97).
Pedido do Eduardo (11/11): "Em qualidade, na área de curadoria, eu queria que a data tivesse a opção hoje, ontem, últimos 7 dias e últimos 30 dias. Ou uma data específica."

## O que existe hoje

Tela Qualidade (view `revisao`, grupo Curadoria, `vRevisao`):

- Filtro de data em `state.revFilter.date`: um campo de data (`dateField('rev-date')`) e o chip "Todas". Padrão `all` (todas as datas). Só um dia ou tudo.
- A lista vem de `revSessions()`: amostra importada (`DATA.sampled`, 12 e 13/10), sessões deste computador (`SIM.sessions`) e sessões da Roverpix ao vivo (`LIVE.days`, já em memória). A tela não busca nada no agente por dia.
- `revSessions()` monta sempre todos os dias: casa as fotos da biblioteca com as sessões da Roverpix dia por dia (`liveMatch`) e recalcula `vendidasTodas()` para cada sessão.
- Os cartões por fotógrafo no topo (`quality(k)`) somam todas as revisões, sem olhar a data.
- O filtro é repetido em `vRevisao` e no `case 'next'`. Os `case 'fkey'` e `case 'fdate'` não têm botão (código morto).
- `sales-open-session` (Lista de vendas) troca o filtro por `{key:'all',date:'all'}` e perde `venda` e `foto`.

## O que muda

1. `state.revFilter` passa a `{key, per, date, venda, foto}`. `per` = `hoje` (padrão), `ontem`, `7d`, `30d` ou `data`; `date` só vale com `per:'data'`. Sai o "Todas".
2. Seletor em chips, igual aos atalhos do `rangeBar` das outras telas: Hoje, Ontem, Últimos 7 dias, Últimos 30 dias, Data específica. Com "Data específica" aparece o `dateField` (dd/mm/aaaa, máximo hoje) e o calendário abre, como o "Personalizado" do `rangeBar`. O `rangeBar` em si não é reusado porque ele mexe no `state.range`, que é o período comum do Painel, Lista de vendas e Estatísticas e tem De e Até.
3. `revPeriodo()` devolve `{de, ate}` com `todayISO()` e `addDays()`: dia local, o mesmo de `localDay`, que data as sessões. 7 e 30 dias incluem hoje (`hoje-6` e `hoje-29`).
4. `revSessions(p)` aceita o período e deixa de fora, antes de qualquer trabalho, o que não é do período (não casa fotos de dia fora dele); `vendidasTodas()` passa a ser calculada uma vez por chamada. `revLista()` junta período, fotógrafo e venda e serve a tela e o "Próxima sessão".
5. Cartões por fotógrafo, contagem de sessões, cartões e tabela respeitam o período. `quality(key, p)` ganha o período opcional (a tela Fotógrafos continua sem ele).
6. Resumo abaixo dos filtros com o período, sessões, fotos e vendidas; título da tabela com o período. Sem sessão no período, mensagem simples (na amostra, lembra que os exemplos são de 12 e 13/10).
7. A escolha fica em `state.revFilter` (memória da tela, como os outros filtros da Qualidade): vale enquanto a pessoa navega e volta a Hoje quando a página é recarregada.
8. `sales-open-session` passa a pôr o filtro na data da sessão aberta. Saem `fkey`, `fdate` e `rev-date-all`.
9. Alvos de toque do filtro com 44 px (chips, campo de data e seletores).

## Fora do escopo

- Agente: nada muda.
- `rangeBar`, Painel, Lista de vendas, Estatísticas, Treino da IA e Alertas.
- Carimbo de versão e `VERSOES.md` (ficam para o deploy).

## Critérios de aceite

1. Ao abrir a Qualidade, "Hoje" está marcado e só aparecem sessões de hoje.
2. "Ontem" mostra só as de ontem.
3. "Últimos 7 dias" mostra de hoje-6 a hoje; a sessão de hoje-7 fica fora.
4. "Últimos 30 dias" mostra de hoje-29 a hoje; a de hoje-30 fica fora.
5. "Data específica" mostra o campo de data; escolhida uma data, só as sessões daquele dia.
6. Contagem de sessões, resumo, cartões, tabela e cartões por fotógrafo batem com o período.
7. O período aparece no resumo e no título da tabela.
8. Sair da tela e voltar mantém a escolha.
9. "Próxima sessão" anda só pelas sessões do período.
10. 30 dias com milhares de sessões desenha em menos de 1 s.
11. Chips, campo de data e seletores do filtro com 44 px ou mais de altura.
12. `testes/curadoria-datas.js` cobre os itens acima; `bash testes/rodar.sh` termina com `FALHAS: 0`.
