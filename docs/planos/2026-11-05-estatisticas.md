# Estatísticas e calendário de eventos (v92)

Pedido do Eduardo, 05/11/2026: "Uma das coisas mais importantes do Eterna é eu ter estatística de tudo." Quer saber qual fotógrafo vende mais, qual clica mais, quem falta, quem é lento ou rápido, qual produto vende melhor, quais dias são bons ou ruins e quantas pessoas por minuto passam na bilheteria. Quer um painel no Admin só de estatísticas e um calendário de jogos e eventos do Maracanã, para comparar os dias: jogo do Flamengo ou do Fluminense, fim de semana ou dia útil, turista ou local.

## Decisões do Eduardo (05/11)
- **Presença**:
  - O login no posto marca que o fotógrafo veio.
  - Ele tinha escala no dia e não fez login: falta.
  - O Eduardo disse que o fotógrafo "nunca vai fotografar sem login, porque a câmera já sobe as fotos com a identificação dele". Por isso as fotos da câmera dele também contam como presença. A presença é o primeiro login no posto ou a primeira foto dele chegando ao servidor, o que vier antes. A tela mostra de onde veio a marca: "login" ou "fotos".
  - Atraso é a primeira marca depois do início do turno somado à tolerância.
- **D2**: a sessão de usuário com `key` vence na virada do dia (`venueToday`). Ao abrir o app no dia seguinte, ele faz `logout()` e pede login de novo.
- **D3**: o calendário de eventos pode ser editado pelo Admin e pela Supervisora. Fica fora do Painel de controle, que é só do Admin: entra no módulo `escala`, com a ação `escala.u`. Proposta: uma view nova `calendario` ("Calendário de eventos", grupo Fotógrafo ou Dashboard) dentro do módulo `escala`. O Admin vê também um atalho no Painel de controle.
- **Turno**: 09:00, com 10 min de tolerância, como valor inicial. O Admin ajusta no Painel de controle, também por ponto.
- **Catracas ainda não existem**: estão previstas até o fim do ano. Hoje a equipe faz um bip por convidado na chegada. O número não é 100% fiel, mas é confiável. O formato do bip vem do Ronaldo depois. Até lá, a seção Movimento fica pronta, com importação por CSV e o aviso de que ainda não há dados.

## O que já existe e será reaproveitado
- **Resumo do dia no agente**: `metricas_dia()` grava `~/Eterna/ponto/metricas/AAAA-MM-DD.json`, que nunca é apagado. Traz fotos, sessões, vendas, faturamento, totais por fotógrafo, vendedor, posto e meio de pagamento, e as vendas online. O app lê esse resumo em `GET /metricas/dia`, com `srvMetPull` e `srvMetSoma` (index.html, perto da linha 3368). As Estatísticas usam a mesma rota, com mais campos.
- **`vendas.db`**: a tabela `evento` guarda criar, pagar e cancelar, e nunca é apagada. Dá para calcular o tempo entre criar e pagar também no passado.
- **Sessões**: ficam em `ponto/sessoes/AAAA-MM-DD.json` por 60 dias, com `cap0`, `cap1`, a última chegada, `fechada_em`, fotógrafo, ponto e trilha.
- **Painel**: reaproveitar `painelDados`, `kpiCard`, `dayBars`, `rankList`, `donut`, `rangeBar`, `venueToday` e `dateField`.
- **Função do dia**: `setFunc` grava `funcao/<dia>` no `estado.db` desde a v90.
- **Movimento antigo**: `DATA.paxSource` e `pax` por dia (catracas, 07 a 15/10) continuam como histórico importado.

## O que falta nos dados
1. **`_ev_limpo` descarta `cart` e `lang`** (agente, linha 5099). Além disso, a venda no balcão manda o `lang()` da equipe e não existe campo `canal`.
2. **Não há histórico de login.** `loginMark` guarda só o último login, e com a hora do navegador. A sessão também fica aberta de um dia para o outro.
3. **A escala não tem horário nem folgas fixas.**
4. **O tempo de atendimento aparece como `avgTime:'–'`**, e não existe a hora em que o cliente começou no Checkout.
5. **Não há calendário nem lugar para guardar entradas.**
6. **Telas internas não usam `T()`.** Esta entrega não cria chave nova no I18N.

## Escopo da v92
- **Parte A (agente e captura)**:
  - passar a guardar `cart`, `lang`, `canal` e `t0`;
  - presença com a hora do servidor;
  - `operacao.db`;
  - resumo v2;
  - migração;
  - backup.
- **Parte B (telas)**:
  - menu Estatísticas, seções a até f;
  - Calendário de eventos (módulo escala);
  - Horário dos turnos no Painel de controle;
  - Folgas fixas na Escala.

## Fora desta versão (v93 em diante)
- tempo da fila de impressão;
- idioma de quem foi ao Checkout e não comprou;
- alertas de falta e atraso;
- exportar as estatísticas em CSV;
- conector do bip ou da catraca;
- importação automática da agenda de jogos;
- estatísticas de vários venues pela nuvem.

## Regras assumidas
- **S1**: a presença usa a hora do servidor. Um login que não chega ao agente do ponto não conta.
- **S2**: a tela diz "Presença pelo login e pelas fotos no Eterna. Não substitui o ponto oficial."
- **S3**: o idioma conta só vendas com `canal:'checkout'`. Rótulos: "Português" e "Outras línguas (provável estrangeiro)".
- **S4**: os tempos aparecem como mediana e p90, calculados por faixas fixas (histograma), nunca como média de médias.
- **S5**: escala e turnos guardam histórico (`historico:[{desde,...}]`). Mudar hoje não reescreve o passado.
- **S6**: importar entradas substitui o que existia no mesmo dia e na mesma origem. Quando houver catraca e bip no mesmo dia, o total usa a catraca.
- **S7**: hora do dia, presença, rapidez e idioma só existem na Eterna, a partir da v92. Os números por dia podem incluir o histórico da Roverpix, que vem ligado por padrão.
- **S8**:
  - a tela pede `estatisticas.r`;
  - importar entradas pede `estatisticas.c`;
  - calendário e folgas fixas pedem `escala.u`;
  - horário dos turnos pede `catalogo.u`.
- **S9**: o fotógrafo está escalado no dia D se `funcao/<D>` tiver uma função diferente de `folga`. Sem função gravada, vale a folga fixa que valia em D. Só entram fotógrafos ativos.
- **S10**: o horário do turno é o do ponto da função do dia. O volante usa o horário padrão.

## Mudanças no agente (`agente/eterna-agente.py`)
1. **`_ev_limpo` aceita quatro campos novos.** Um campo inválido é descartado e a venda continua aceita.
   - `cart`: até 30 itens `{id:^[a-z0-9_-]{1,20}$, v:0..1e6}`.
   - `lang`: pt, en, es, fr ou de.
   - `canal`: checkout ou balcao.
   - `t0`: ISO, entre `em` − 2 h e `em`.
2. **`operacao_db()`**: `~/Eterna/ponto/operacao.db`, com WAL e `synchronous=full`.
   - `presenca(dia, chave, primeiro, ultimo, n, postos, fonte)`: `fonte` é login ou fotos; o primeiro login fica gravado mesmo que as fotos tenham vindo antes.
   - `entrada(dia, origem, seg)`.
   - `importacao(id, em, por, arquivo, origem, dias, aceitas, recusadas)`.
3. **`POST /ponto/presenca {chave, posto}`**:
   - exige `posto()`, `origem_local()`, `X-Eterna: 1` e `limite_ok(ip, 'presenca', 30)`;
   - a chave precisa estar no cadastro;
   - grava com `time.time()` (upsert);
   - até 5 postos, com 40 caracteres cada e sem `<>`.
4. **Presença pelas fotos**: a primeira foto do dia atribuída ao fotógrafo (pela câmera ou série) grava ou atualiza a presença com `fonte` = fotos, se ainda não houver presença no dia ou se a foto for anterior.
5. **`POST /ponto/entradas {origem, dia, seg:[...], arquivo, por}`**:
   - corpo de até 1 MB e até 50.000 entradas;
   - `origem` é bip ou catraca;
   - o dia vai de hoje − 400 até hoje;
   - cada `seg` vai de 0 a 86399;
   - grava numa transação (apaga o dia e a origem, depois insere) e regrava as métricas daquele dia numa thread.
6. **`GET /ponto/entradas/importacoes`**: as 20 últimas importações.
7. **`metricas_dia` versão 2**: acrescenta campos sem mudar os da v1. O contrato está abaixo.
8. **`metricas_migra_v2()`**:
   - roda uma vez, numa thread;
   - **só acrescenta**: horas e `tempos.pagamento_s` a partir do `vendas.db`; sessões, `clique_checkout_s` e `transferencia_s` a partir do arquivo de sessões, se ele ainda existir;
   - nunca sobrescreve a v1;
   - marca `v:2` e `migrado:true`;
   - espera 0,2 s entre um dia e outro.
9. **`backup_loop`**: passa a incluir o `operacao.db`.
10. **`/status`**: mostra `estatisticas:{v:2, migracao}`.
11. **Coleção `agenda` no `estado_gravar`**: aceita só os campos permitidos, até 2 KB por registro.

## Mudanças no app (`index.html`)
- **Menu e permissões**:
  - `VIEWS` ganha `['estatisticas','Estatísticas','vendas, fotógrafos, dias e movimento','Dashboard']`, logo depois de `painel`, e a view `calendario`.
  - `MODULES` ganha `['estatisticas','Estatísticas',['estatisticas']]`, e o módulo `escala` passa a incluir `calendario`.
  - `MODULE_INFO.estatisticas`: r = ver as estatísticas; c = importar entradas da bilheteria (bip ou catraca) por CSV.
  - A descrição de `escala.u` passa a citar o calendário e as folgas fixas.
  - O Admin recebe o módulo novo pela `migrateUser`. O Supervisor não recebe Estatísticas.
- **`WRITE_OPS` e `ACT_MOD`**:
  - `es-importar` pede `estatisticas.c`;
  - `ag-salvar`, `ag-apagar`, `ag-importar`, `ag-feriados` e `folga-fixa` pedem `escala.u`;
  - `turno-salvar` pede `catalogo.u`.
- **Captura da venda**:
  - `pvDados` recebe `canal` e `t0`;
  - o Checkout manda `canal:'checkout'` e `t0`, que é `state.kiosk.t0`, gravado quando a pessoa sai da etapa `code` e zerado em `lojaReset`;
  - o balcão manda `canal:'balcao'` e não manda `lang`.
- **Presença**:
  - `presencaMarcar()` roda no `login()`, ao abrir o app com sessão aberta e quando o agente volta, se `eterna.presenca.v1[key]` for diferente de `venueToday()`;
  - só marca o dia depois do `ok` do agente;
  - nunca manda um dia anterior;
  - a sessão com `key` vence na virada do dia (D2).
- **Estatísticas (`vEstatisticas`, classes `es-`)**:
  - Funções puras: `esDados`, `esGrupoDia`, `esPresenca`, `esFaixas`.
  - `esPull` lê `/metricas/dia`, guarda em cache por 5 min e aceita até 366 dias.
  - No topo: `rangeBar`, os chips das seções e o interruptor "Com histórico Roverpix".
  - **a) Vendas e produtos**:
    - KPIs;
    - ranking de produtos, com a nota "N vendas sem detalhe de produto (antes da v92)";
    - meio de pagamento e posto;
    - vendas por hora, das 8 às 20 h;
    - vendas por dia da semana, como média por dia;
    - tabela hora × dia da semana.
  - **b) Fotógrafos**:
    - tabela ordenável: escalado, presenças, faltas, atrasos, sessões, fotos, fotos por sessão, vendas, conversão, R$ por sessão, faturamento e mediana do clique até o Checkout;
    - o dia a dia mostra a marca (login às hh:mm ou fotos às hh:mm), o início do turno, o atraso, a 1ª foto, as sessões e as vendas.
  - **c) Rapidez**:
    - cliente no Checkout (`t0` até criar);
    - confirmação pelo vendedor (criar até pagar);
    - clique até o Checkout;
    - câmera até o servidor;
    - cada um com mediana, p90 e n, mais uma tabela por vendedor;
    - impressão aparece como "sem dado ainda".
  - **d) Dias e eventos**:
    - grupos: com jogo ou sem, por mandante, por competição, por tipo, fim de semana ou dia útil, feriado;
    - cada grupo mostra n de dias e, por dia: faturamento, vendas, sessões, ticket, conversão, % de outras línguas e entradas;
    - a pílula "poucos dias" aparece quando n < 3;
    - embaixo, a tabela dia a dia com o evento.
  - **e) Visitantes**: rosca por idioma e ticket por idioma.
  - **f) Movimento**:
    - sem dados, mostra "Sem dados de entrada ainda. Quando chegar o arquivo do bip ou das catracas, importe aqui." e o botão de importar;
    - com dados, mostra o total, as pessoas por hora, o pico do minuto e dos 15 min, a média por minuto aberto e o funil entradas → sessões → vendas → R$ por visitante;
    - o retrato de outubro aparece separado;
    - embaixo, as últimas importações.
- **`esImportar`**:
  - lê o CSV no navegador, até 5 MB, com `;` ou `,`;
  - colunas: `data_hora` e `origem`;
  - descarta as outras colunas antes de enviar;
  - faz um POST por dia;
  - mostra o resumo, com as 5 primeiras linhas recusadas.
- **Calendário de eventos (view `calendario`, módulo escala)**:
  - mostra o mês;
  - formulário com data, hora, tipo (jogo, show, feriado, fechado, evento, outro), mandante, visitante, competição e observação;
  - editar e apagar, com confirmação;
  - importar CSV (`data;hora;tipo;mandante;visitante;competicao;obs`): até 2000 linhas, atualiza em vez de duplicar;
  - "Adicionar feriados de AAAA": nacionais, móveis pela Páscoa, 20/11, 20/01 e 23/04 do Rio;
  - `datalist` de clubes, normalizado por `agClube()`;
  - o Admin vê também um atalho no Painel de controle.
- **Horário dos turnos**: painel no Painel de controle com o início padrão, a tolerância e o início por ponto.
- **Escala**: painel "Folgas fixas (5×2)", com 7 chips por fotógrafo.
- **Dados**:
  - `ESTADO_COLS` ganha `agenda`;
  - o app assina `agenda`, `config/escala` e `config/turnos`;
  - guarda uma cópia local (`eterna.agenda.v1`) quando o servidor não está.
- **Testes e versão**:
  - `window.ETERNA` expõe `esDados`, `esGrupoDia`, `esPresenca`, `esFaixas` e `agClube`;
  - a versão vai para v92 nos dois carimbos e em VERSOES.md.

## Contratos
Resumo do dia v2 (`GET /metricas/dia`):
```json
{"v":2,
 "por_hora":{"10":{"vendas":3,"faturamento":570,"sessoes":12,"fotos":180}},
 "por_produto":{"tribuna":{"n":2,"receita":440},"sem_detalhe":{"n":1,"receita":190}},
 "por_canal":{"checkout":{"vendas":4,"faturamento":800},"balcao":{"vendas":1,"faturamento":70}},
 "por_idioma":{"pt":{"vendas":3,"faturamento":600},"es":{"vendas":1,"faturamento":200}},
 "tempos":{"cliente_s":H,"pagamento_s":H,"clique_checkout_s":H,"transferencia_s":H},
 "por_confirmador":{"Ana":{"pagamento_s":H}},
 "por_fotografo":{"carlos":{"primeira_foto":1762340000,"clique_checkout_s":H}},
 "presenca":{"carlos":{"primeiro":1762339800,"ultimo":1762360000,"n":2,"fonte":"login"}},
 "entradas":{"fonte":"catraca","total":812,"por_origem":{"bip":790,"catraca":812},"por_hora":{"09":95},
             "pico_min":{"hhmm":"10:41","n":9},"pico_15":{"hhmm":"10:30","n":88},"primeira":"09:01","ultima":"16:58"}}
```
- `H = {"n","soma","f":[c0..c6]}`, com faixas de 0–30 s, 30–60 s, 1–2 min, 2–5 min, 5–10 min, 10–20 min e mais de 20 min.
- `clique_checkout = fechada_em − cap1` e `transferencia = ultima_chegada − cap1`, só da trilha `vivo`.
- `entradas` vem `null` quando não houver entrada.
- Revisão (R3 e R4): `tempos.pagamento_s` conta só vendas com `canal:'checkout'` (no balcão criar e pagar saem juntos; venda sem canal, de antes da v92, fica fora, então a migração do critério 26 só ganha `pagamento_s` em dia com venda do Checkout gravada com canal). Quem confirmou vai para `por_confirmador`, nunca para o `por_vendedor` da v1 (vendas e faturamento de quem vendeu); o Painel só mostra linha com contagem da v1.

Agenda (coleção `agenda`):
```json
{"id":"ag_<12hex>","data":"2026-11-08","hora":"16:00","tipo":"jogo","mandante":"Flamengo","visitante":"Palmeiras","competicao":"Brasileirão","obs":"","origem":"manual|csv|feriados","por":"nome","em":"ISO"}
```
Textos de até 60 caracteres (a observação, até 200), sem `<` nem `>`.

`config/escala` e `config/turnos`:
```json
{"historico":[{"desde":"2026-11-05","folgas":{"carlos":[1,2]}}],"por":"nome","em":"ISO"}
{"historico":[{"desde":"…","padrao":"09:00","tolerancia":10,"por_ponto":{"campo1":"09:00"}}],"por":"nome","em":"ISO"}
```

## Critérios de aceite
1. **Menu Estatísticas**: aparece para o Admin no Dashboard, logo abaixo de Painel. Supervisor, Fotógrafo, Atendimento e venda, Validador e Checkout não veem o item, e `#estatisticas` mostra "sem acesso".
2. **Telas e permissões**:
   - `todas-as-telas.js` abre Estatísticas e Calendário sem erro;
   - o critério 19 de `permissoes.js` passa com o módulo novo e as ações novas;
   - o Supervisor vê e edita o Calendário.
3. **Venda pelo Checkout em espanhol**: chega com `lang:'es'`, `canal:'checkout'`, `cart` e `t0` anterior a `em`. A venda no balcão chega com `canal:'balcao'` e sem `lang`.
4. **Campos inválidos**: `cart` com 31 itens, `lang:'xx'` ou `t0` de três horas antes são descartados, e a venda não é recusada.
5. **Presença pelo login**:
   - grava com a hora do servidor;
   - um segundo login mantém `primeiro` e soma 1 em `n`;
   - o servidor nunca aceita hora mandada pelo navegador.
6. **Presença pelas fotos**: a 1ª foto atribuída a um fotógrafo sem login grava a presença com `fonte` = fotos. Um login depois mantém `primeiro` como a hora mais cedo.
7. **`POST /ponto/presenca` inválido**: sem `X-Eterna`, de origem fora da lista, com chave fora do cadastro ou mais de 30 vezes por minuto, responde 403, 403, 400 e 429.
8. **Sessão vencida**: uma sessão aberta ontem leva a um novo login ao abrir o app hoje, e o dia de ontem nunca é marcado.
9. **Folgas fixas**: com folga na segunda e na terça e nenhuma função gravada, numa segunda sem marca o fotógrafo aparece "folga". Numa quarta sem marca, aparece "falta".
10. **Atraso**: com turno às 09:00 e tolerância de 10 min, uma marca às 09:08 não é atraso. Às 09:25, é atraso de 25 min.
11. **Histórico da escala**: mudar a folga fixa hoje não muda as faltas antes de `desde`.
12. **Soma conferida**: com a Roverpix desligada, o faturamento da seção a é igual à soma do "Servidor do ponto · todos os caixas" no mesmo período.
13. **Hora e dia da semana**: uma venda paga às 10:40 de um sábado entra na barra das 10 h e em "Sáb".
14. **Produtos antigos**: vendas de antes da v92 aparecem como "sem detalhe de produto", nunca somadas a um pacote.
15. **Rapidez**: com tempos de 20 s, 50 s e 400 s, a mediana fica na faixa de 30–60 s, o p90 na de 5–10 min, e n = 3.
16. **Trilha**: o clique até o Checkout e a transferência usam só a trilha `vivo`.
17. **Calendário, permissões**: criar, editar e apagar pede `escala.u` e vai para o `auditLog`.
18. **Calendário, CSV**:
    - importar o mesmo arquivo duas vezes não duplica;
    - uma data inválida aparece na lista de recusadas;
    - `<script>` aparece como texto.
19. **Feriados de 2026**: incluem 03/04 (Sexta-feira Santa) e 04/06 (Corpus Christi), sem duplicar.
20. **Grupos de dias**: com 2 dias de jogo do Flamengo e 3 dias sem jogo, os grupos mostram n = 2 (com a pílula "poucos dias") e n = 3, e as médias estão certas.
21. **Idioma**: entram só as vendas do Checkout, com o rótulo de S3.
22. **Movimento sem dados**: mostra o aviso, e o botão de importar só aparece para quem tem `estatisticas.c`. O retrato de outubro aparece separado.
23. **CSV de entradas com colunas extras** (ingresso, CPF): só `origem`, `dia` e `seg` saem do navegador, conferido pela rede.
24. **Importar entradas**: o mesmo arquivo duas vezes dá o mesmo total. Com bip e catraca no mesmo dia, o total usa a catraca.
25. **Pico**: com 9 entradas às 10:41, a tela mostra "pico 10:41, 9 pessoas".
26. **Migração**: um dia antigo sem arquivo de sessões mantém os campos v1 e ganha as horas de venda e `pagamento_s`.
27. **Desempenho**: com 366 dias, `/metricas/dia` responde em menos de 2 s e a tela desenha em menos de 300 ms. O agente continua atendendo durante a migração.
28. **Sem servidor do ponto**: aparece o aviso "Sem conexão com o servidor do ponto" e nenhum erro de JS.
29. **Backup e privacidade**: o `operacao.db` vai para o backup. Nenhuma estatística traz foto, rosto, e-mail, CPF ou número de ingresso.
30. **Testes**: `bash testes/rodar.sh` termina com `FALHAS: 0`, contando `testes/estatisticas.js` e `testes/estatisticas_agente.py`. As falhas antigas do pedido 7 do Ronaldo ficam listadas à parte.

## Riscos (para a revisão de segurança)
1. **O agente não sabe quem está logado.** `/metricas/dia` é lido por qualquer posto da lista de origens, e agora traz presença. Isso vai para a fila do login no servidor.
2. **A presença pode ser falsificada** (código de login visível na tela, POST na rede). A mitigação é parcial: hora do servidor, posto, 1ª foto e o texto de que não é o ponto oficial. Há peso trabalhista (Portaria 671/2021).
3. **O CSV de entradas pode trazer dado pessoal.** O descarte das colunas extras acontece no navegador, e o agente aceita só números inteiros.
4. **XSS pelo calendário**: usar `esc()` em todo texto. A coleção `agenda` é validada no agente.
5. **Excesso de dados**: limites de tamanho, de vezes por minuto e de datas. Cada importação fica registrada.
6. **A migração pode apagar histórico.** A regra é só acrescentar (critério 26).
7. **Fuso**: o fuso do servidor precisa ser igual a `VENUE_TZ`.
8. **Custo**: o resumo de hoje é recalculado a cada pedido, e a tela busca de novo só depois de 5 min.

## Agenda pública do Maracanã
Não existe uma fonte oficial única. CBF, Ferj e Conmebol publicam cada uma a sua, e o estádio fecha por períodos para cuidar do gramado. O mínimo é o cadastro manual e a importação por CSV. Uma API de dados esportivos fica para depois.

## Revisão e segurança (05/11, aplicadas)
- **S1**: o resumo do dia só é gravado por `met_escreve` (lock por dia, `mkstemp` em `MET_DIR`), pelo `metricas_loop`, pela importação de entradas e pela migração; ler, mudar e gravar ficam dentro do lock. Resumo que existe e não abre fica como está (log). Dia sem resumo ganha registro mínimo `{dia, gerado, so_entradas, entradas}`, sem `v:2`.
- **R1/R2**: `presencaMarcar` começa com `sessaoVirada()`; 400 não repete até o próximo login; 429 ou falha espera 60 s; a chave é normalizada como no agente (`presChave`).
- **R3/R4**: veja Contratos (`pagamento_s` só do Checkout; `por_confirmador`).
- **Presença**: o 1º login guarda `ip` e `acesso` (`loopback`, `rede` ou `remota` para 100.64.0.0/10); o dia a dia mostra a origem e marca "remota". Tabela `servico(inicio, ultimo)` no `operacao.db` com um pulso por minuto; o resumo traz `servidor_fora:[[ini,fim]]` e o turno com o servidor fora vira "sem dado (servidor fora)", nunca falta nem atraso. Abono pela Supervisora ou Admin (`escala.u`, painel Abonos na Escala, coleção `abono` com id `<dia>|<chave>`, `auditLog`). Dia com evento `fechado` no calendário fica fora das faltas.
- **Fuso**: `fuso_ajusta()` no `main()` (TZ = `ETERNA_TZ` ou `America/Sao_Paulo` com `tzset`, fora do Windows); `/status.fuso {tz, offset_min}`; a tela avisa quando difere de `VENUE_TZ` (CHECKLIST-SERVIDOR.md, seção 1).
- **Entrada de dados**: `__proto__`, `constructor` e `prototype` recusados no agente (cart.id, posto, por, vendedor) e acumulados com `Object.create(null)` no app; `cfg_valida` para `config/escala` e `config/turnos`; teto de 5000 eventos na agenda; rotas novas com 500 em JSON e `X-Eterna` no CORS; a importação espera e tenta de novo no 429.

## Falhas antigas fora da v92
Cinco testes já falham em `origin/main` (conferido em `e7833a6`, 05/11) e continuam falhando na `feat/estatisticas` do mesmo jeito. Não vêm desta entrega; ficam ligados ao pedido 7 do Ronaldo:
- `testes/galeria-qr.js`: critério 6 (galeria depois da selfie fica em `step:"nao"`) e critério 13 (o inglês não troca os textos).
- `testes/v77-regressao.js`: B, galeria no modo agente (`motivo:"varias"`).
- `testes/v79-regressao.js`: 1.6 (Caixa vazio deveria dizer "Nenhum pagamento esperando.") e as notas de pacote da v83.
- `testes/v81.js`: 3, Esc na janela do Checkout.
- `testes/v83.js`: espera pelo `[data-act="kiosk-next"]`, que não aparece.
