# Estatísticas até a alma (24/11)

Pedido do Ronaldo, 24/11: funil de vendas, relatório de selfies (pessoas abordadas por dia), tempos e movimentos de tudo,
cada métrica e dimensão que ajude a entender, precificar e melhorar o produto; no mínimo o que o painel do Maraca Acessos
tem de fotografia e ativações, cruzado com as catracas; tempo de atendimento e de fotografia; vendas online; quantos cliques
são precisos para vender, meta de cliques para a receita, evolução diária de cliques, vendas e receita, por fotógrafo e vendedor.

Regra: **acrescentar, nunca substituir**. Tudo que existe nas Estatísticas continua igual.

## Boas práticas que valem para todas as telas

- Taxa sempre com o denominador à vista e intervalo de confiança de 95% (Wilson); abaixo de 30 casos, "amostra pequena".
- Comparar o dia com o mesmo dia da semana (não com o dia anterior) e com a média móvel de 7 dias.
- Média e mediana juntas quando a distribuição é torta (tempos, ticket); percentis 50/90 nos tempos.
- Conversão pelas somas do período, nunca média de taxas diárias.
- Nada de nota explicando o óbvio na tela; o significado de cada métrica fica neste documento.
- Dado pessoal de cliente nunca aparece: só contagens.

## Dicionário das métricas

| Métrica | Conta | Fonte |
|---|---|---|
| Visitantes | entradas do dia (catraca; sem catraca, bip) | `entradas_dia` |
| Pessoas fotografadas | rostos diferentes de clientes nas fotos do dia (equipe fora) | `pessoas.pessoas` |
| Em primeiro plano | pessoas com rosto grande o bastante (`PESSOA_PERTO`) | `pessoas.pessoas_perto` |
| Abordagem | pessoas fotografadas ÷ visitantes | |
| Selfies no Checkout / na galeria | selfies feitas no balcão / pelo QR | tabela `selfie`, `origem` |
| Acharam | selfies com resultado `achou` ÷ selfies | |
| Pediram as fotos | selfies do Checkout ÷ pessoas fotografadas | |
| Tempo da busca | média de `ms` da selfie | |
| Cliques por venda | fotos tiradas ÷ vendas | `fotos`, `vendas` |
| Receita por clique | faturamento ÷ fotos tiradas | |
| Meta de cliques | meta de receita ÷ receita por clique do período escolhido | `sim/metaDia` |
| Tempo de atendimento | da abertura da sessão no Checkout ao pagamento | `tempos.cliente_s`, `pagamento_s` |
| Tempo de fotografia, escolha, fila, impressão | `tempos.fotografia_s`, `escolha_s`, `fila_s`, `impressao_s` | `met_t3` |

## Leva 1: mostrar o que já é gravado (vale para os dias passados)

1. **Selfies e pessoas** (v99.49.0, feita): pessoas abordadas por dia e por hora, resultado das selfies, tempo da busca.
2. **Cliques e metas** (v99.50.0, feita; meta em `sim/metaDia`): cliques por venda, receita por clique, meta diária de receita e cliques que faltam, evolução diária
   (média móvel de 7 dias e mesmo dia da semana), por fotógrafo e por vendedor, histograma de cliques por sessão.
3. **Tempos** (v99.51.0, feita, na aba Rapidez): fotografia, escolha, fila e impressão, com mediana e percentil 90; sessões por número de cliques.
4. Fotos e sessões por hora contra visitantes por hora; vendas por canal; desfecho dos pedidos (não pagos, substituídos).

## Leva 2: medir o que ainda não é gravado

- Checkout: abandono e tempo em cada passo, fotos vistas × escolhidas, troca de idioma.
- Funil online da galeria: galeria vista, selfie, achou, foto baixada, compra tentada, pedido pago (eventos da nuvem puxados pelo servidor do ponto).
- Sessões perdidas no envio ao servidor.

## Leva 3: cruzar e precificar

- Equivalentes do painel do Maraca Acessos para fotografia e ativações (Drone, Chute a Gol, Snap Pop): ingressos vendidos × catraca, conferência das ativações.
- Catraca por canal e hora × fotos e vendas (rota só de contagem, só leitura, no Maraca Acessos).
- Preço: pacote ideal × escolhido, fotos escolhidas × pagas, sensibilidade da venda ao preço.
- Relatório (exportação) com todas as abas.
