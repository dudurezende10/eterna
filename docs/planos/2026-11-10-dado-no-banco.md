# Dado no banco, não no navegador (10/11/2026)

Regra do projeto em `CLAUDE.md` ("Onde mora o dado"). Motivo: a P3-001 mostrou 1 reimpressão na tela e 2 no banco. Duas abas do Eterna no mesmo posto gravaram o SIM do `localStorage` uma por cima da outra. A correção certa foi ler o histórico do banco (`GET /ponto/impressoes`, commit a27997e), não juntar as abas.

## Já segue a regra

| Dado | Onde mora | Como a tela lê |
|---|---|---|
| Venda (pedido confirmado, pagamento, cancelamento) | `vendas.db`, eventos `criar`, `pagar`, `cancelar` | métricas do dia, BI (`venda_tempos`, `venda_dia`) |
| Impressão, reimpressão, "não saiu" | `vendas.db`, evento `impressao` (com fotos, motivo, leitura da DNP) | `GET /ponto/impressoes` (`impRefaz`) |
| Rolo (leitura da DNP, troca) | `vendas.db`, evento `rolo`; métricas do dia → `rolo` por posto | métricas do dia |
| Fila de impressão do servidor | `vendas.db`, evento `fila` | BI |
| Sessões e fotos | agente (sessões, manifesto) | `GET /sessoes` |
| Galerias e vendas online | agente (`galerias/`) | rotas de galeria |
| Estoque, preços, edições, descartes, inválidas, bandeiras, fundos de IA | `estado.db` (`/ponto/docs`, `SIM_MAPA`) | `simAplica` |
| Auditoria de usuários e permissões | `estado.db`, coleção `usuarios_log` | Perfis |
| Diário | `estado.db`, coleção `diario` | Diário |
| Selfies do Checkout (contagem) | `vendas.db`, tabela `selfie` | BI |

## Ainda só no navegador (corrigir nesta ordem)

1. **Cortesias** (`SIM.cortesiaLog`, `sim.cort`, em `galCortesia`). Quem deu ou retirou cortesia, em qual foto e com que motivo fica só no navegador de quem clicou. É o principal ponto de auditoria ("cortesia" contra fotos impressas e vendidas). Correção: evento `cortesia` (deu/retirou, foto, motivo, nota, quem) no `vendas.db`; a tela e a métrica do dia (cortesias por motivo e por pessoa) leem dali.
2. **Pedidos do Checkout aguardando o Caixa** (`SIM.caixaDin`). O pedido só chega ao banco quando o Caixa confirma (`criar` com a hora do pedido). Pedido desistido, expirado ou perdido ao fechar o navegador não deixa rastro, então não existe estatística de desistência. Correção: evento ao pedir e a cada mudança de estado (pedido, voltou às fotos, saiu, cancelado, expirado, confirmado). O Caixa lê a lista do servidor.
3. **Registro de operação** (`SIM.log`, até 80 linhas no navegador; `simPodar` corta para 20 quando falta espaço). Observabilidade: o que aconteceu em cada posto. Correção: as linhas viram eventos `log` (ou entram nos eventos de cada fato) e a tela de registro lê do servidor.
4. **Estado da sessão no posto** (`status` paga/fechada/perdida, `lost` e `postvisit` do "cliente foi embora" em `checkout-lost`). A venda está no banco, mas "sessão perdida no Checkout" não está. Correção: evento `sessao_perdida`, que entra na métrica do dia.
5. **Última leitura da DNP por posto** (`eterna.dnp.v1`). Só serve para comparar com a leitura anterior; toda mudança já sobe como evento `rolo`. Pode ficar local. Revisar quando o servidor ler a DNP direto.

Pode ficar no navegador: fila de envio (`eterna.ponto.fila.v1`, `galFila`), preferências do aparelho, o que está na tela no momento (rascunhos, seleção em andamento) e caches de imagem.

## Como cada correção é feita

- O evento sobe pela fila que já existe (`pvEvento`, com `idem`, sem perda sem rede).
- O contrato do servidor (`_ev_limpo`) e `EV_TIPOS` ganham o tipo novo, com cada campo conferido.
- Rota `GET` para a tela, com a mesma permissão de quem grava.
- Métrica do dia (`metricas_dia`) já com o número novo.
- Teste do agente: grava, lê, e uma aba sobrescrevendo o `localStorage` não muda o que aparece.
