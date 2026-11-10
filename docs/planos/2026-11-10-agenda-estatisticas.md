# Calendário que se preenche sozinho e série diária para estatística (v97)

Pedido do Eduardo, 10/11/2026: "No calendário de eventos é importante os dados ficarem guardados no banco para eu ter estatísticas quando eu precisar. Por exemplo, quanto vendemos em dia de jogos em 2026. Visitação melhora? Diminui? [...] pelo que vi essa ferramenta ainda não funciona, não tem nada no calendário."

Base: `main` v96 (`0596b50`). Branch: `feat/agenda-estatisticas`.

## Objetivo
O Calendário de eventos passa a se preencher sozinho (feriados e jogos no Maracanã, 2026 inteiro para trás) e o servidor do ponto guarda uma linha por dia com tipo do dia, vendas, fotos, conversão e visitação.
Nas Estatísticas, o Admin compara dia de jogo com dia normal, mês a mês e ano a ano, e vê se a visitação sobe ou cai.

## 1. Diagnóstico: por que o calendário está vazio

O que existe (v92) funciona, mas depende de alguém digitar:

1. **Nada preenche sozinho.** `vCalendario` só mostra o que está em `AGENDA`. Entra evento por três caminhos, todos manuais: Novo evento (`agSalvarForm`), Importar CSV (`agImportar`) e o botão "Adicionar feriados de AAAA" (`agFeriados`), que só roda quando alguém clica, um ano por vez. A "agenda automática de jogos" prevista para a v94 (CONTEXTO §5, DOCUMENTACAO-TECNICA "Próximo passo (v94)") nunca foi feita: a v94 virou a selfie da galeria. O pedido da chave da API-Football ao Ronaldo não teve resposta.
2. **Fora do servidor do ponto, o calendário é só do aparelho.** `dbLigar` só liga o banco do servidor (`agenteDb`, `state.db.agente`) quando o agente responde. Aberto direto em https://eterna.photo (Miami, sem Tailscale), o Chrome não alcança `http://127.0.0.1:8765`; `AGENDA` vem só do `localStorage` `eterna.agenda.v1` daquele navegador. O que a Supervisora cadastrou no estádio não aparece, e o que o Eduardo cadastrasse ficaria só no Mac dele até abrir pelo servidor. A tela não avisa isso.
3. **Permissão não é a causa.** Admin e Supervisor têm `calendario` no menu (migração `mst92`) e `escala.u`. Quem não tem `escala.u` vê o calendário sem botões, o que está certo.
4. **Onde os eventos ficam (confirmado no código):** coleção `agenda` do `~/Eterna/ponto/estado.db` (`ESTADO_COLS`, validada por `agenda_valida`, teto `AGENDA_DOCS_MAX` 5000). Apagar grava `valor = null` (a linha fica, serve de lápide). O `backup_loop` copia `estado.db`, `vendas.db` e `operacao.db` para `backup/<pc>/` e `backup/<pc>/dia/AAAA-MM-DD/` no S3, a cada 2 min quando muda, **só se `NUVEM_BUCKET` estiver configurado**. Conferir no servidor de produção: `/status.backup.ok` verdadeiro.
5. **O histórico também tem buracos:** a Roverpix só é sincronizada nos últimos 30 dias (`ROVER_DAYS`), os dias brutos (`~/Eterna/roverpix/`) não vão para o backup, e as Estatísticas leem no máximo 366 dias pelo `rangeBar` (comparar 2026 com 2027 não cabe numa tela). Visitação só existe para dias com CSV do bip importado (`operacao.db`, tabela `entrada`); não há lugar para o total diário oficial da bilheteria.

## Escopo desta entrega (v97)
- A. Feriados automáticos no agente (nacionais e do Rio, móveis pela Páscoa), de 2026 até o ano que vem, sem clique.
- B. Jogos no Maracanã: adaptador API-Football no agente (busca toda segunda às 06:00 e "Atualizar jogos agora"), ligado só quando a chave existir. Sem chave: "Colar lista" no Calendário (aceita colar do Google Sheets) e um arquivo de 2026 montado de fontes públicas para a Supervisora conferir e colar.
- C. Aviso no Calendário quando o aparelho não está ligado ao servidor, e linha de situação das fontes.
- D. Tabela `dia` no `operacao.db` (uma linha por dia, a partir de 01/01/2026), recalculada pelo agente, com rota de leitura e exportação CSV.
- E. Histórico anterior ao Eterna: Roverpix de 2026 pela API (só agregados) e total diário de visitantes por CSV (bilheteria).
- F. Estatísticas: seção nova "Jogos e ano a ano".

## Fora do escopo (depois)
- Clima (próximo passo sugerido: Open-Meteo, arquivo histórico gratuito e sem chave, chuva e temperatura por dia).
- Shows e eventos automáticos (seguem manuais ou colados).
- Catraca ao vivo (entra quando existir; a precedência já fica pronta).
- Importação da Roverpix por planilha exportada (só se a API não devolver dias antigos; ver decisão D4).
- Consulta na nuvem de vários venues juntos (cada venue tem o seu servidor; consolidação é fase SaaS).
- Calendário com números por dia dentro da grade.

## Decisões assumidas (o Eduardo pode trocar)
- **D1. Fonte dos jogos:** API-Football, filtrando pelo estádio (`fixtures?venue=<id>&season=AAAA`: 1 pedido devolve o ano inteiro, de todas as competições). O plano grátis deve não cobrir a temporada atual (um relato de abril/2026 diz que o grátis só cobre a temporada anterior; conferir na conta). Assumido: plano pago mais barato, contratado pela Maracatour, chave com o Ronaldo. Enquanto não houver chave, colagem e arquivo de 2026. Descartadas: APIs não oficiais (ESPN e parecidas) e raspagem de sites (sem contrato, quebram sem aviso).
- **D2. O que conta como jogo:** toda partida de futebol no Maracanã, de qualquer clube e competição, inclusive amistoso e feminino, com a competição registrada (dá para filtrar depois). Jogo adiado ou cancelado sai do calendário.
- **D3. Tipo do dia** (um só, por precedência): `fechado` > `jogo` > `show` > `evento` > `feriado` > `vespera` (dia antes de um jogo) > `normal`. As marcas (jogo, véspera, feriado, show, fechado, fim de semana) ficam guardadas separadas, para cruzar (ex.: jogo em feriado).
- **D4. Histórico de vendas antes do Eterna:** API da Roverpix, dia a dia, desde 01/01/2026. Dia antes da primeira venda registrada na Roverpix = "sem operação", nunca zero.
- **D5. Visitação:** catraca > total da bilheteria (CSV `dia;total`) > bip. O total da bilheteria entra numa tabela própria, não mistura com as entradas por segundo.
- **D6. Vendas no mesmo dia nas duas fontes:** vale o servidor do ponto (mesma regra do `esDados`).
- **D7. R$:** só para Admin (`isAdminUser(state.user)`), mesmo se um dia a seção abrir para a Supervisora. Contagens (vendas, fotos, visitantes, conversão) aparecem para quem vê a tela.
- **D8. Feriados:** Confraternização (01/01), São Sebastião (20/01, Rio), Carnaval segunda e terça, Sexta-feira Santa, Tiradentes, São Jorge (23/04, RJ), Trabalho, Corpus Christi, Independência, Aparecida, Finados, Proclamação, Consciência Negra (20/11, nacional desde 2024), Natal. Quarta-feira de Cinzas fica de fora. É a mesma lista do `feriadosDe` do app.
- **D9.** Evento automático editado ou apagado por uma pessoa nunca é sobrescrito nem recriado pelo agente.

## Mudanças por arquivo

### agente/eterna-agente.py

**Agenda**
- `AGENDA_ORIGENS` ganha `"api"`. `agenda_valida` aceita o campo `ext` (opcional, `^af:\d{1,12}$`, id da partida na fonte) e devolve `ext` só quando válido.
- `agenda_id(chave)`: id determinístico `"ag_" + sha1(chave).hexdigest()[:12]`. Chaves: `"feriado|AAAA-MM-DD"` e `"af|<fixture_id>"`. Dois aparelhos ou dois boots nunca duplicam.
- `feriados_de(ano)`: Páscoa (mesmo algoritmo do `pascoa` do app) e a lista da D8; devolve `[(data, nome)]` ordenado.
- `agenda_semear_feriados()`: para cada ano de `AGENDA_DESDE = 2026` até o ano atual + 1, grava pelo `estado_gravar(..., quem="agente")` os feriados cujo id ainda não existe na tabela (nem como lápide `valor null`) e cuja data não tem outro registro `tipo:"feriado"`. Registro: `tipo "feriado"`, `obs` = nome, `origem "feriados"`, `por "Eterna"`, `em` = agora. Roda no boot e no `agenda_loop` uma vez por dia (pega a virada do ano sem ninguém).
- `af_cfg()` / `af_salvar(chave, venue_id)`: `~/Eterna/api-football.json`, chmod 600, como `rover_cfg`/`rover_save_cfg`. `venue_id` padrão vazio; `af_venue()` descobre uma vez por `GET /venues?search=Maracan` (cidade Rio de Janeiro) e grava o id no arquivo.
- `af_buscar(temporada)`: `GET https://v3.football.api-sports.io/fixtures?venue=<id>&season=<ano>`, cabeçalho `x-apisports-key`, timeout 20 s, resposta até 2 MB, host fixo. Devolve lista de `{fixture_id, data (no fuso do venue), hora, status, mandante, visitante, competicao}`.
- `agenda_jogos_sync(motivo)`: temporadas de 2026 até a atual (e a próxima a partir de 01/12). Para cada partida: id `agenda_id("af|<id>")`; status `PST`, `CANC`, `ABD` ou `SUSP` → apaga (null), só se o registro atual for do agente; existe com `por != "Eterna"` ou é lápide → não mexe (D9); mesma data já tem `tipo:"jogo"` criado por pessoa → não cria (conta em `ja_no_calendario`); senão grava `tipo "jogo"`, `origem "api"`, `por "Eterna"`, `ext "af:<id>"`. Guarda em memória e em `~/Eterna/ponto/agenda-fonte.json` (600): `{ultima, ok, erro, pedidos_hoje, n_por_ano, ja_no_calendario}`. Nunca grava a chave nem a URL com chave em log.
- `agenda_loop()` (thread no `main`): semeia feriados; se houver chave, sincroniza no boot quando a última passou de 7 dias, toda segunda às 06:00 (fuso do venue) e quando `agenda_wake` é acordado. Sem internet: registra o erro e tenta na próxima vez; nada é apagado por falha.
- `estado_gravar`: depois de gravar algo na coleção `agenda`, marca as datas afetadas em `dia_sujos` (set com lock) para a tabela `dia`.

**Série diária**
- `operacao_db()`: cria
  - `dia (dia text primary key, tipo text, jogo int, vespera int, feriado int, show int, fechado int, fds int, eventos text, fonte_vendas text, vendas int, receita real, fotos int, sessoes int, sessoes_com_venda int, entradas int, entradas_fonte text, clima text, calc_em text, v int)`;
  - `entrada_dia (dia text, origem text, total int, importacao text, primary key (dia, origem))`.
- `dia_linha(dia, eventos_do_dia, eventos_do_dia_seguinte)`: tipo e marcas pela D3; `eventos` = até 5 resumos curtos (`"Jogo · Flamengo × Palmeiras · Brasileirão"`), sem `por`; vendas pela D6: resumo do dia (`MET_DIR/<dia>.json`, campos da v1) com `vendas` ou `sessoes` > 0 → `fonte_vendas "eterna"`; senão `ROVER_DIR/agg/<dia>.json` (`daily.sales`, `daily.revenue`, `daily.photos`, `daily.approaches`, `daily.converted`) → `"roverpix"`; senão `null` (sem operação, não zero). Visitação pela D5: `entrada` origem catraca, senão `entrada_dia` origem bilheteria, senão `entrada` origem bip; `entradas_fonte` diz qual. `clima` sempre null nesta entrega.
- `dia_consolidar(dias)`: recalcula e faz upsert. Regra de não perder: se o arquivo da Roverpix de um dia sumiu, a linha mantém os números antigos com `fonte_vendas "roverpix"` (nunca zera uma fonte que desapareceu).
- `dia_loop()` (thread): a cada 10 min recalcula hoje, ontem e `dia_sujos`; uma vez por dia (e no boot) de 01/01/2026 até hoje, no máximo 800 dias por rodada, com uma pausa curta a cada 50 dias para não travar o agente.
- `dias_periodo(ano)`: linhas do ano, ordenadas; `ano` entre 2026 e o ano atual.
- Rotas novas, todas em `rota_privada`, com `origem_local`, respostas `no-store` e erro em JSON:
  - `GET /estatisticas/dias?ano=AAAA` → contrato abaixo.
  - `GET /agenda/status` → situação das fontes (sem chave nem URL).
  - `POST /agenda/atualizar` (posto + origem + `X-Eterna: 1` + `limite_ok(ip, rota, 1, 60)`) → acorda o `agenda_loop`; responde `{ok, ja_rodando}`. Sem chave: 409 `sem_chave`.
  - `POST /agenda/fonte {chave, venue_id?}` → só `loopback()` e origem local (regra das chaves); chave de 20 a 64 caracteres `[A-Za-z0-9]`; grava `af_salvar` e acorda o loop. Resposta nunca ecoa a chave.
  - `POST /ponto/entradas/totais {origem:"bilheteria", arquivo, por, dias:[{dia,total}]}` → posto + origem + `X-Eterna: 1` + 30/min, até 1000 dias e 256 KB, `total` inteiro de 0 a 100.000, dia entre 2026-01-01 e hoje; substitui dia e origem; registra em `importacao` (mesma tabela da v92, `origem "bilheteria"`); marca os dias em `dia_sujos`.
- `/status`: bloco `agenda: {feriados_ate, jogos: {fonte: "api-football"|"nenhuma", chave: bool, ultima, ok, erro}}` e `roverpix.historico: {feitos, total, primeiro_dia}`.

**Roverpix de 2026**
- `rover_sync_day(cfg, day, bruto=True)`: com `bruto=False` não grava `raw/` (um ano de fotos brutas passaria de 1 GB), só `agg/`.
- `rover_hist_loop()` (thread, só com chave da Roverpix): de ontem − 30 até `ROVER_HIST_DESDE` (2026-01-01), do mais novo para o mais velho, um dia a cada 10 s, pula dia com `agg` já gravado; 3 erros seguidos param o histórico até o próximo boot (status com o erro). `primeiro_dia` = primeiro dia com pedido. Ao terminar cada dia, marca em `dia_sujos`.

### index.html

**Calendário (`vCalendario`, módulo `escala`)**
- `agLimpo`: origens com `'api'`; aceita `ext` com a mesma regra do agente.
- `AG_ORIGEM_NOME = {manual:'Manual', csv:'Importado', feriados:'Automático · feriados', api:'Automático · jogos'}`; a coluna Origem da lista usa esse nome.
- `agConexao()`: sem `state.db` ou com `state.db` que não é `agente`, alerta `warn` `#ag-sem-servidor`: "Este aparelho não está ligado ao servidor do ponto. Você está vendo só o que foi salvo neste navegador; o que criar aqui sobe quando abrir o Eterna pelo servidor (no estádio ou pelo Tailscale)." Os botões continuam (sobe depois, pelo `dbMigra` que já existe).
- `agStatusPull()` lê `GET /agenda/status` (cache 60 s, só com `esOn()`); `agFontes()` mostra uma linha: "Feriados automáticos até 2027 · Jogos: atualizados em dd/mm hh:mm (34 em 2026)", ou "Jogos: sem chave da API. Cole a lista ou importe o CSV", ou o erro curto.
- Botões novos (só com `escala.u`): `data-act="ag-atualizar"` "Atualizar jogos agora" (só com chave; `POST /agenda/atualizar` com `X-Eterna: 1`; toast; relê o status em 5 s) e `data-act="ag-colar"` "Colar lista" (abre `#ag-colar` com `textarea#ag-colar-txt` e `ag-colar-ok`/`ag-colar-nao`; `ag-colar-ok` chama `agImportar(txt)` e mostra o resultado em `state.cal.res`, como o CSV).
- `agImportar`: aceita também TAB como separador (colagem do Google Sheets): escolhe entre `;`, `,` e TAB o que mais aparece na linha.
- `ACT_MOD`: `ag-atualizar`, `ag-colar`, `ag-colar-ok` → `escala`. `ag-colar-ok` e `ag-atualizar` entram em `WRITE_OPS` com `u`.
- Nota de rodapé do calendário: tirar "Não existe uma agenda oficial única..." e dizer de onde vêm os automáticos.

**Estatísticas, seção nova `g` "Jogos e ano a ano"**
- `ES_SECOES` ganha `['g','Jogos e ano a ano']`. A seção não usa o `rangeBar`: tem chips de ano (`data-act="es-ano"`, `state.es.ano`, padrão o ano atual) e compara com o ano anterior.
- `esDiasPull(ano)`: `GET /estatisticas/dias?ano=` para `ano` e `ano-1`, cache por ano (5 min para o ano atual, 1 h para anos fechados), erro como o `esPull`.
- Funções puras (exportadas em `window.ETERNA` para os testes):
  - `esPorTipo(linhas)` → por tipo do dia: dias, médias por dia de visitantes, vendas, fotos, conversão (sessões com venda ÷ sessões), vendas por 100 visitantes e R$ por dia; só dias com operação (`fonte_vendas` não nulo) entram nas médias de venda; só dias com `entradas` entram na de visitantes; `poucos` quando n < 3.
  - `esPareado(linhas)` → "dia de jogo contra o mesmo dia da semana": para cada dia de jogo, a média dos dias `normal` do mesmo dia da semana nas 4 semanas antes e 4 depois; devolve a diferença média em % de visitantes e de vendas e quantos jogos tiveram par.
  - `esMesAMes(atual, anterior)` → 12 linhas: visitantes, vendas, fotos, conversão e R$ de cada ano, variação em %; mês sem dado = "—", nunca 0%.
  - `esTendencia(linhas, hoje)` → últimos 28 dias com dado de visitantes contra os mesmos 28 dias do ano anterior; sem ano anterior, contra os 28 dias antes. Devolve `{sobe|cai|igual, pct, base:'ano'|'periodo', n}`; "igual" quando |pct| < 3; menos de 14 dias com dado → `poucos`.
- `esSecG()`:
  1. Faixa no topo: "Visitação **subindo 12%**" (verde luz #43B02A) / "**caindo 8%**" (amarelo #FFB800, nunca vermelho) / "estável", com a base ("contra nov/2026" ou "contra os 28 dias anteriores").
  2. Cartões "Dia de jogo" e "Dia normal" lado a lado (azul #134078 e cinza museu #D9D9D6): visitantes por dia, vendas por dia, conversão, R$ por dia (só Admin). Embaixo: "No mesmo dia da semana, dia de jogo tem X% mais (menos) visitantes e Y% mais (menos) vendas", com n de jogos.
  3. Tabela por tipo do dia (`esPorTipo`), com a pílula "poucos dias".
  4. Mês a mês, ano escolhido contra o anterior (`esMesAMes`), barras duplas por mês (`esBars` com `hi` no ano atual).
  5. Botão "Baixar dias (CSV)" `data-act="es-dias-csv"`: `dia;tipo;eventos;visitantes;fonte_visitantes;vendas;fotos;sessoes;sessoes_com_venda;fonte_vendas` + `receita` só para Admin; células que começam com `= + - @` ganham `'` na frente.
  6. Sem servidor: o mesmo alerta da seção a. Ano sem nenhum dia: "Ainda não há dias guardados em AAAA".
- Textos em português, linguagem do Tour ("visitantes", "dia de jogo", nunca "pax"). Títulos Big Shoulders como as outras seções. Tela interna: sem I18N.
- `ACT_MOD`: `es-ano`, `es-dias-csv` → `estatisticas`.

**Importação do total de visitantes (seção f)**
- Ao lado do CSV de entradas: "Importar total por dia (bilheteria)" `data-act="es-importar-totais"` (só `estatisticas.c`): lê `dia;total` (dd/mm/aaaa ou aaaa-mm-dd), mostra recusadas por linha e manda `POST /ponto/entradas/totais` em blocos de 1000.

**Carimbo** `v97` nas duas ocorrências.

### Dados e documentação
- `docs/dados/jogos-maracana-2026.tsv` (só se a chave não chegar até a programação): partidas de 2026 no Maracanã montadas de fontes públicas, no formato do CSV da agenda (`data;hora;tipo;mandante;visitante;competicao;obs`, com a fonte em `obs`), marcado "a conferir". A Supervisora confere e cola.
- `docs/CHECKLIST-SERVIDOR.md`: passo "Chave da API-Football" (Painel de controle no próprio servidor, http://127.0.0.1:8765) e conferir `/status.backup.ok`.
- CONTEXTO §3/§4/§5, DOCUMENTACAO-TECNICA, GUIA-DA-EQUIPE (Calendário: o que é automático, Colar lista) e VERSOES.

## Contratos

Agenda (coleção `agenda`, só os campos novos marcados):
```json
{"id":"ag_<12hex>","data":"2026-11-08","hora":"16:00","tipo":"jogo","mandante":"Flamengo","visitante":"Palmeiras",
 "competicao":"Brasileirão Série A","obs":"","origem":"manual|csv|feriados|api","ext":"af:1234567","por":"Eterna","em":"ISO"}
```

`GET /estatisticas/dias?ano=2026`:
```json
{"ok":true,"ano":2026,"calc_em":"ISO","dias":[
 {"dia":"2026-11-08","tipo":"jogo","marcas":{"jogo":1,"vespera":0,"feriado":0,"show":0,"fechado":0,"fds":1},
  "eventos":["Jogo · Flamengo × Palmeiras · Brasileirão Série A"],
  "fonte_vendas":"eterna|roverpix|null","vendas":41,"receita":7310.0,"fotos":2890,"sessoes":388,"sessoes_com_venda":41,
  "entradas":1650,"entradas_fonte":"catraca|bilheteria|bip|null","clima":null}]}
```

`GET /agenda/status`:
```json
{"ok":true,"feriados_ate":2027,"jogos":{"fonte":"api-football|nenhuma","chave":true,"ultima":"ISO|null","ok":true,"erro":null,"n_por_ano":{"2026":34},"ja_no_calendario":2},
 "roverpix_historico":{"feitos":120,"total":283,"primeiro_dia":"2026-10-01"}}
```

`POST /ponto/entradas/totais`: `{"origem":"bilheteria","arquivo":"visitantes-2026.csv","por":"Nome","dias":[{"dia":"2026-01-02","total":1830}]}` → `{"ok":true,"aceitos":N,"recusados":[{"i":3,"motivo":"..."}],"importacao":"imp_..."}`.

`~/Eterna/api-football.json` (600): `{"chave":"...","venue_id":204}`.

## Critérios de aceite
1. Agente novo num `estado.db` vazio: depois do boot, a coleção `agenda` tem os 15 feriados de 2026 e os de 2027 (`origem "feriados"`, `por "Eterna"`), com Carnaval em 16 e 17/02/2026, Sexta-feira Santa 03/04/2026, Corpus Christi 04/06/2026 e Carnaval 08 e 09/02/2027, sem internet.
2. `feriados_de(a)` do agente e `feriadosDe(a)` do app devolvem as mesmas datas de 2026 a 2035.
3. Reiniciar o agente 3 vezes não duplica feriado. Apagar um feriado no app e reiniciar: ele não volta. Um feriado criado antes pelo botão "Adicionar feriados" (id aleatório) não ganha um gêmeo.
4. Com fonte falsa da API-Football (servidor de teste devolvendo 3 partidas, uma `PST`): 2 jogos entram com `origem "api"` e `ext`; o adiado não entra; rodar de novo não duplica.
5. Jogo automático editado no app (outra hora) não muda na sincronização seguinte; jogo automático apagado no app não volta. Jogo manual na mesma data impede o automático e conta em `ja_no_calendario`.
6. Sem chave: `/agenda/status.jogos.fonte = "nenhuma"`, o Calendário mostra "sem chave da API" e o botão "Atualizar jogos agora" não aparece; `POST /agenda/atualizar` dá 409.
7. `POST /agenda/atualizar` sem `X-Eterna`, de outra origem ou 2 vezes no mesmo minuto: 403/403/429. `POST /agenda/fonte` de fora do loopback: 403. A chave não aparece em `/status`, `/agenda/status`, no console nem em `agenda-fonte.json`.
8. Calendário aberto sem servidor (`state.db` nulo): aparece `#ag-sem-servidor`. Com o servidor: não aparece e a linha de fontes mostra feriados e jogos.
9. "Colar lista" com 3 linhas copiadas de uma planilha (separadas por TAB) cria 3 eventos; colar de novo dá "3 iguais". Linha com data inválida é listada como recusada.
10. Supervisor vê e usa Colar lista e Atualizar jogos; Atendimento e venda não vê os botões; `ag-colar-ok` sem `escala.u` é barrado pelo `guardAct`.
11. Tabela `dia`: com um resumo da Eterna em 08/11, um arquivo Roverpix em 07/11 e nada em 06/11, `/estatisticas/dias?ano=2026` traz `fonte_vendas` `eterna`, `roverpix` e `null`; o dia 06/11 tem `vendas` null, não 0.
12. Tipo do dia: jogo em feriado → `tipo "jogo"` com `marcas.feriado = 1`; dia antes de jogo → `vespera`; estádio fechado e jogo no mesmo dia → `fechado`.
13. Visitação: mesmo dia com bip 900 e bilheteria 1000 → 1000 `bilheteria`; com catraca 1100 também → 1100 `catraca`.
14. Criar um jogo no Calendário para um dia passado: em até 10 min a linha desse dia em `/estatisticas/dias` muda para `tipo "jogo"` (e a véspera para `vespera`).
15. Apagar o resumo da Roverpix de um dia já consolidado e recalcular: a linha mantém os números (não zera).
16. `POST /ponto/entradas/totais` com 1001 dias, total negativo, dia no futuro ou `__proto__` como dia: recusado (400 ou linha recusada), nada gravado do inválido; importação registrada em `importacao`.
17. Histórico Roverpix (fonte falsa com 5 dias antigos): o agente grava os 5 `agg/` sem `raw/`, um a cada 10 s, e `/status.roverpix.historico.feitos` chega a 5; o agente segue respondendo `/status` durante a carga.
18. Estatísticas › Jogos e ano a ano, com dados de teste (3 jogos e 10 dias normais em 2026, mês de nov/2025 e nov/2026): os cartões mostram as médias certas de cada grupo, `esPareado` dá a diferença esperada, mês a mês mostra variação só onde os dois anos têm dado, e a faixa diz "subindo" ou "caindo" com o % certo.
19. R$: Admin vê R$ nos cartões, tabela, mês a mês e coluna `receita` do CSV; um usuário com `estatisticas.r` que não é Admin não vê nenhum "R$" na seção nem a coluna no CSV.
20. CSV baixado abre com uma linha por dia do ano, separador `;`, e um evento chamado `=1+1` sai como `'=1+1`.
21. Fuso: um jogo às 21:30 de Brasília gravado pela API em UTC (00:30 do dia seguinte) cai no dia certo do Calendário.
22. `testes/todas-as-telas.js` abre Calendário e a seção `g` sem erro; `bash testes/rodar.sh` termina com as mesmas falhas preexistentes de `main` v96 (3) e nenhuma nova. Testes novos: `testes/agenda_agente.py` (1 a 7, 11 a 17, 21) e `testes/agenda-estatisticas.js` (8 a 10, 18 a 20).

## Riscos de segurança e escala (para o revisor)
1. **R$ protegido só na tela.** `/estatisticas/dias` e `/metricas/dia` devolvem `receita` para qualquer navegador de origem local; o agente não sabe quem está logado (pendência desde a v78). Esconder R$ do não Admin é cosmético até o login real no servidor. Não piorar: rota em `rota_privada`, sem CORS aberto.
2. **Chave da API-Football:** só em arquivo 600, gravada só pelo loopback, nunca em log, status, URL ou navegador. Saída só para o host fixo `v3.football.api-sports.io`, com timeout e teto de 2 MB.
3. **Dados de fora entram no banco:** tudo da API passa por `agenda_valida` (sem `<`, `>` e controles, 60/200 caracteres) e o app usa `esc()` em tudo. Nome de time vira texto, nunca chave de objeto (`ES_PROIBIDO`).
4. **Sobrescrever trabalho humano:** a regra D9 depende de `por == "Eterna"`; alguém pode digitar "Eterna" como nome. Preferir comparar também `origem` e `ext`, e o `agSalvarForm` grava sempre `origem "manual"` quando a pessoa muda data, tipo ou times de um automático.
5. **Teto da agenda:** 5000 registros; feriados (~16/ano) e jogos (~80/ano) cabem por décadas. As lápides (`valor null`) não contam no teto (como hoje).
6. **Carga no agente:** consolidar 800 dias lê ~1.600 arquivos pequenos; pausas a cada 50 dias e nunca dentro do `estado_lock`/`op_lock` por muito tempo. Histórico Roverpix devagar (um dia a cada 10 s) para não atrapalhar a sincronização normal nem a Roverpix.
7. **Disco:** sem `raw/` no histórico (fotos brutas de um ano passariam de 1 GB).
8. **Internet caída:** feriados e tabela `dia` são locais; a sincronização de jogos falha sem apagar nada e mostra o erro e a data da última que deu certo.
9. **Fuso:** datas da API em UTC convertidas para `America/Sao_Paulo` antes de gravar; servidor em outro fuso já tem aviso (`/status.fuso`).
10. **Backup:** a série diária vai para a nuvem pelo `operacao.db` só com `NUVEM_BUCKET`; sem ele, um disco perdido leva o histórico. Conferir `/status.backup.ok` no servidor de produção é passo do deploy.
11. **CSV exportado:** proteção contra fórmula (`'` na frente); o arquivo tem faturamento: só baixa quem é Admin vê a coluna.
12. **Escala para 100 venues:** feriados hoje são do Rio; a lista vira `FERIADOS_POR_LOCAL` (UF e município do `config/venue`) quando entrar o segundo venue. O `venue_id` da API fica por servidor. Cada venue tem o seu `operacao.db`; a visão de vários venues juntos lê os backups na nuvem (fase SaaS).

## Decisões para o Eduardo (curtas)
1. **Fonte dos jogos:** pagar o plano da API-Football (o grátis parece não cobrir 2026) e cobrar a chave do Ronaldo? Ou pedir ao Maracanã/Bruno o calendário oficial de operação do estádio (jogos e shows) em planilha, que seria a fonte mais certa? (Assumido: API paga + colagem enquanto isso.)
2. **O que conta como jogo:** todo jogo no Maracanã, de qualquer clube, inclusive amistoso e feminino? (Assumido: sim, com a competição registrada.)
3. **Histórico de vendas da Roverpix:** confirmar com o Ronaldo que a API devolve dias antigos de 2026. Se não devolver, quem exporta a planilha do painel da Roverpix? Desde quando a operação de fotos vendeu em 2026?
4. **Visitação de 2026:** quem manda o total de visitantes por dia (bilheteria da Viva) de 01/01/2026 até hoje, em `dia;total`?
5. **Quarta-feira de Cinzas e véspera de feriado** entram como tipo de dia? (Assumido: não.)
6. **Supervisora:** a seção "Jogos e ano a ano" fica só para o Admin, ou abre para a Supervisora sem R$? (Assumido: só Admin, como as Estatísticas hoje.)

## Decisões do Eduardo (10/11)
1. Fonte dos jogos: API-Football. A chave ainda não existe; o Eduardo cria a conta (plano grátis primeiro, 100 pedidos por dia, sem cartão) e a chave vai para a configuração do servidor do ponto pelo Ronaldo. Até lá, colar a lista.
2. Conta como evento: todo jogo e todo evento no Maracanã (inclusive amistoso, feminino e shows). Shows e eventos que não são futebol entram por cadastro manual ou colagem.
3. Histórico: a base diária começa hoje (10/11/2026). Sem importação retroativa da Roverpix.
4. Visitação: não há histórico (a Viva começou a operar em 01/10/2026). A visitação entra a partir de agora pelas fontes do próprio ponto (catraca, bip ou total diário quando existir).
5. A seção nova das Estatísticas é só para o Admin.

## Decisão do Eduardo (10/11, 16h54): chave da API-Football pela tela
A chave é colada pelo Admin no próprio Calendário de eventos (bloco "Fontes"), sem depender do Ronaldo:
- Campo só para quem pode alterar Configurações (Admin). Quem não é Admin não vê o bloco.
- Ao salvar, o app manda a chave só para o servidor do ponto (POST com login de Admin e X-Eterna: 1), que grava em ~/Eterna/api-football.json com permissão restrita (mesmo padrão do ftp-remoto.json/roverpix.json). A chave nunca vai para o SIM, para o localStorage, para o backup da nuvem em texto aberto, para logs nem para o Firestore.
- O servidor nunca devolve a chave: a tela mostra só "Chave configurada ····<4 últimos>", a data, quem salvou e o resultado do último teste. Botões: "Testar agora" (1 consulta, mostra se a temporada atual veio), "Trocar chave" e "Remover".
- Auditoria: salvar, trocar e remover entram no auditLog (sem a chave).
- Variável de ambiente, se existir, continua valendo e aparece como "definida no servidor" (a tela não sobrescreve).
- Critérios de aceite novos: Admin salva e testa; Supervisora/Caixa não veem o bloco nem conseguem o POST (403); GET de configuração nunca contém a chave; a chave não aparece em nenhum arquivo do repo, SIM, log ou resposta HTTP.

## Implementação (Programador, 10/11)

Branch `feat/agenda-estatisticas`, carimbo `v97-agenda`. Feito conforme o plano e as decisões do Eduardo de 10/11, com estes ajustes:

- **Sem retroativo** (decisão 3): saíram `rover_hist_loop`, o `bruto=False` do `rover_sync_day` e o `/status.roverpix.historico`; o critério 17 não se aplica. A série diária começa em `DIA_DESDE = "2026-11-10"`. A Roverpix ainda vale para um dia sem vendas do servidor (D6), pelo `agg/` que a sincronização normal de 30 dias já grava.
- **Tabela do total diário** chama `entrada_total`, não `entrada_dia` (esse nome já é de um índice do `operacao.db`). `POST /ponto/entradas/totais` e o botão "Importar total por dia (bilheteria)" na seção f entraram ("total diário quando existir").
- **Id do estádio** fica em `~/Eterna/ponto/agenda-fonte.json` (`venue_id`), não no `api-football.json`: o arquivo da chave tem só `{chave, em, por}` e some inteiro no Remover. O POST não aceita `venue_id`.
- **"POST com login de Admin"**: o agente ainda não confere quem está logado. As rotas `/agenda/fonte` e `/agenda/testar` exigem posto + origem do agente + `X-Eterna: 1` + limite + o e-mail em `quem` de alguém ativo com Configurações, Usuários e Permissões em Alterar no cadastro do servidor (`admin_do_cadastro`). Isso barra a Supervisora pela tela e por engano, mas quem souber o e-mail de um Admin e estiver num posto consegue trocar a chave (não ler). Fecha com o login no servidor (plano de 04/11). Aceita pelo endereço do Tailscale (`ETERNA_ORIGENS`), não só pelo loopback, para o Eduardo colar de fora.
- **Atualizar jogos agora** acorda o `agenda_loop` (a busca roda em segundo plano); a tela relê a situação em 5 s. **Testar agora** roda na hora (até 2 consultas na primeira vez: estádio e temporada).
- **Jogo cancelado depois de gravado** sai do calendário e volta se a fonte remarcar, só quando quem tirou foi o próprio agente (`apagados_api`). Lápide de pessoa nunca volta.
- **Falha da API** tenta de novo 6 h depois (não a cada minuto) e nunca apaga nada; `ultima` é a última que deu certo, `tentativa` a última tentativa.
- **Seção g só para o Admin**: o chip não aparece para quem não é Admin (`esSecoes`) e o R$ também é conferido dentro da seção (D7). O botão "Adicionar feriados de AAAA" só aparece sem o servidor do ponto.
- **Fora desta entrega**: `docs/dados/jogos-maracana-2026.tsv` (montar a lista de fontes públicas sem conferir seria arriscado; com a chave a API preenche, e até lá Colar lista); clima; histórico da Roverpix.

### Pontos de contato com as outras branches (para a junção)

- `agente/eterna-agente.py`:
  - bloco novo inteiro antes de `def rota_privada` ("Agenda automática e série diária (v97)"), com `AGENDA_ROTAS` e `AGENDA_ROTAS_PATHS`;
  - `rota_privada`: `or path in AGENDA_ROTAS_PATHS` no fim da expressão;
  - `H.cors`: `X-Eterna` também para `AGENDA_ROTAS_PATHS`;
  - `H.do_GET` (logo depois do `gal_get`) e `H.do_POST` (logo depois do `/recorte`): despacho `("GET"|"POST", path) in AGENDA_ROTAS` → `self.agenda_rota`; métodos novos `agenda_rota` e `r_*` agrupados antes de `H.file`;
  - `/status`: `ag_ = agenda_status(publico=True)` junto do `ss_, rs_` e a chave `"agenda": ag_` depois de `"fuso"`;
  - `AGENDA_ORIGENS` com `"api"` e `agenda_valida` com `ext`;
  - `operacao_db`: duas tabelas novas (`dia`, `entrada_total`) depois de `importacao`;
  - `estado_gravar`: `ag_datas` (datas da agenda antes e depois) e `dia_marcar(ag_datas)` antes do laço da auditoria da v93; `ESTADO_COLS` não mudou;
  - `main`: threads `agenda_loop` e `dia_loop` depois do `backup_loop`, e uma linha "Agenda:" no console.
- `index.html`:
  - `VIEWFN`/`VIEWS`/`MODULES` não mudaram (sem tela nova);
  - Estatísticas: `ES_SECOES` com `g`, `esSecoes`, `esChips` (o chip das seções saiu de dentro do `vEstatisticas`), início do `vEstatisticas` com o desvio para `g`, bloco "Jogos e ano a ano" antes de "Calendário de eventos", botão do total na `esSecF`, cases `es-ano` e `es-dias-csv` antes de `es-sec`, `es-importar-totais` no ouvinte `change`;
  - Calendário: `agLimpo` (`api`, `ext`), `agSalvarForm`, `agImportar` (TAB), `vCalendario` (cabeçalho, linha das fontes, Colar lista, origem, nota e `agBlocoFontes`), bloco v97 do calendário logo depois do `vCalendario`, cases `ag-colar*`, `ag-atualizar`, `ag-chave-*` antes de `ag-feriados`;
  - `WRITE_OPS` e `ACT_MOD`: chaves novas no começo dos objetos; `window.ETERNA`: nomes novos no começo; CSS novo depois de `.es-vazio`; carimbo `v97-agenda`.
- `testes/rodar.sh`: `testes/agenda_agente.py` no fim da lista dos testes de agente; `testes/todas-as-telas.js`: seção `g` e o bloco Fontes.
