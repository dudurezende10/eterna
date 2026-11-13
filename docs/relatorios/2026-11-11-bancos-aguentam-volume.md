# Os bancos do servidor aguentam o volume? (11/11/2026)

Pergunta do Ronaldo: o Eterna vai ter muitas fotos; o banco aguenta, e os índices certos existem?

## Onde mora cada coisa

| Banco / arquivo | O que guarda | Volume por dia (15 a 30 mil fotos) | Retenção |
|---|---|---|---|
| Fotos (disco, `inbox/AAAA-MM-DD`) | os JPEG | 15 a 30 mil arquivos | política de disco |
| `rostos.db` · `foto`, `rosto` | uma linha por foto e uma por rosto (vetor de 512 bytes) | 30 mil + ~60 mil linhas (~35 MB) | 60 dias (`RETENCAO_DIAS`): ~3,6 milhões de rostos, ~2 GB |
| `ponto/sessoes/AAAA-MM-DD.json` | sessões do dia | ~1.500 sessões, poucos MB | 60 dias |
| `ponto/vendas.db` · `evento`, `selfie` | vendas, impressões, rolo, selfies | ~3 mil eventos (~2 MB) | sem prazo (histórico) |
| `ponto/estado.db` · `doc`, login, postos | cadastro, configuração, SIM | pequeno | sem prazo |
| `ponto/operacao.db` · `entrada` | entradas da bilheteria | pequeno | sem prazo |

As fotos ficam fora do banco (certo: banco guarda registro, disco guarda arquivo). O SQLite está em WAL em todos os bancos.

## Índices: conferidos contra todas as consultas do agente

Todas as consultas por chave usam chave primária ou índice (`evento_venda`, `evento_dia`, `selfie_dia_i`, `doc_rev`, `rosto_dia`, `entrada_dia`), **menos uma**:

- **`rosto` por `pid` não tinha índice.** Cada foto lida faz `delete from rosto where pid=?` antes de gravar os rostos dela, e o reaproveitamento faz `where pid in (...)`. Sem índice, cada foto varre a tabela inteira. Medido com 1,2 milhão de rostos (20 dias): **4,5 s por foto sem índice, 3 ms com índice**. Com 60 dias seria ~13 s por foto: a leitura de rostos nunca alcançaria o movimento. Corrigido: `rosto_pid on rosto(pid)`, criado sozinho na próxima vez que o agente abrir o `rostos.db`.

## O que ainda não escala bem (próximos passos, nesta ordem)

1. **Backup completo a cada 2 min.** `backup_loop` sobe o `vendas.db` e o `estado.db` inteiros (duas cópias) sempre que mudam. Hoje são KB; com um ano de vendas, o `vendas.db` passa de 0,5 GB e isso vira centenas de GB por dia de upload. Trocar por: cópia completa uma vez por dia e, no intervalo, só os eventos novos (o `evento` já tem `idem` e `recebido`).
2. **Arquivo de sessões regravado inteiro a cada 2 s.** `sess_gravar` reescreve o JSON do dia todo a cada mudança. Funciona com alguns MB, mas são GB de escrita por dia e o dado de operação fica fora do banco (regra "Onde mora o dado"). Levar as sessões para uma tabela com uma linha por sessão, gravando só a que mudou.
3. **Relatórios por dia que leem o histórico todo.** A visão `venda_dia` agrupa o `evento` inteiro; para o BI de um ano basta filtrar por dia antes de agrupar.
4. **Sem prazo para `login_log` e `selfie`.** Crescem pouco; definir retenção junto com a LGPD.

Em produção o servidor é um só (Linux); SQLite com WAL dá conta desse volume de escrita (dezenas de gravações por segundo) desde que toda consulta frequente use índice. Banco cliente-servidor (PostgreSQL) só passa a valer a pena com vários servidores escrevendo no mesmo lugar.
