# Plano: AF, Alertas do fotógrafo e aba Estatísticas em Fotógrafos (ramo `feat/alertas-fotografo`, a partir de dce60c9)

Fatia própria, independente do modelo de visão das poses; pode sair antes da P2 do plano `2026-11-23-poses-estatistica.md`. Os números que aparecem nos exemplos deste plano são inventados e servem só para mostrar o formato; nenhum vem de venda real.

## Objetivo
Avisar na tela Alertas, só para Admin e Supervisora, quando um fotógrafo fica abaixo de 20 ou acima de 40 cliques por família, quando a conversão dele fica abaixo da média da equipe, e quando muitas fotos saem da câmera escuras ou estouradas. Tudo é calculado no servidor, com o número completo: "Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras" (exemplo do Eduardo).
Junto, tudo o que é por fotógrafo fica em Curadoria › Fotógrafos: a seção `b` "Fotógrafos" sai da Estatísticas e vira a aba "Estatísticas" da view Fotógrafos.

## Pedido do Eduardo (23/11)
"Na seção de alertas, eu quero que você me avise quando um fotógrafo está fazendo ou muita foto, eu digo acima de 40, ou pouca foto, que é abaixo de 20, taxa de conversão deles, foto escura ou foto estourada... Por exemplo, Márcio, de 100 fotos, 20 estão fora da exposição, estão muito estouradas ou estão muito escuras. Eu preciso ter esses avisos."
E (23/11 11:55): "a seção fotógrafos pode sair do dashboard e ficar só em Curadoria, incluindo todas as análises e gráficos".

## Escopo / fora do escopo
**Entra:**
- Medida de luz por foto no servidor, na chegada e numa varredura dos últimos 30 dias.
- Calibração da medida contra as marcações do Treino.
- Agregado diário e mensal por fotógrafo.
- Rotas novas, cartões na view Alertas e abas na view Fotógrafos: Índice (o que existe hoje), Estatísticas (a antiga seção `b`) e "Cliques, conversão e exposição" (nova).
- Limites editáveis.

**Fica fora:**
- Vendas online (`vendas-online.jsonl`) na conversão. A tela avisa.
- Comparação por set (entra quando o reconhecimento do ponto estiver Ligado, numa fatia seguinte).
- A aba "Poses e roteiro" (P4 do plano de poses).
- O fotógrafo ver os próprios números.
- A tabela "Por fotógrafo" do Painel continua onde está (ver AF-D9).

## Decisões
- **AF-D1. Unidade:** família por fotógrafo = **leva** (sessão), como no D5 do plano de poses; cada leva é de um fotógrafo só. Fotógrafo sem chave ("sem fotógrafo") fica fora.
- **AF-D2. Cliques:**
  - Com o reconhecimento do ponto **Ligado**, a conta usa `cena.rotulo` com confiança de 0,70 ou mais: soma gramado, troféu e arquibancada. O chute aparece à parte. "outro" e foto sem leitura aparecem como "não contadas".
  - Com o reconhecimento desligado ou em Só medir, conta **todas** as fotos da leva, e a tela diz isso.
  - As bases dos fundos de IA contam, porque são cliques do fotógrafo.
- **AF-D3. Conversão:** a atribuição é **por foto**, e substitui a regra da sessão âncora do `metricas_dia`. Motivo: a venda pela selfie junta levas de mais de um fotógrafo e hoje tudo vai para o dono da âncora.
  - Uma leva "comprou" quando alguma foto dela está no `selected` de uma venda com `pagar` e sem `cancelar`, ou é base de um `aiSel` dessa venda.
  - Fotos vendidas do fotógrafo = pids dele no `selected`.
  - **Eduardo, 23/11:** a conversão é comparada com a **equipe toda**; por set quando o reconhecimento estiver Ligado (fatia seguinte).
- **AF-D4. Exposição medida na foto como saiu da câmera:** no leitor de rostos, que já decodifica o original (`cv2.IMREAD_REDUCED_COLOR_2`), e no fallback sobre a miniatura, que o `make_thumb` gera do original só com a rotação do EXIF.
  - O Ajuste automático (`mf_aj`, `phStyle --flt`, documentos `sim/edits|`) é filtro de tela e nunca altera o arquivo. Por isso não esconde o problema. Isso vira um teste (critério 9).
- **AF-D5. Liga e desliga da exposição:** reaproveita a chave que já existe, `config/treino.exposicao`:
  - `desligada`: não mede nada.
  - `medir`: mede e mostra na Medição e na aba de Fotógrafos com "Em teste", sem alerta.
  - `ligada`: gera alertas. Só passa no critério de calibração; isso substitui o 409 fixo `exposicao_sem_modelo`.
- **AF-D6. "Fora da exposição" (Eduardo, 23/11):** só a foto que **não serve**. Na calibração, positivo = marcação do Treino com `qual.nivel` `fraca` ou `nao_vai` e motivo `escura` ou `estourada`. Foto "ajustar" não é positiva.
- **AF-D7. Limites:** ficam numa config própria, `config/fotografos`, no `estado.db`, gravada só por rota com `configuracao.u`.
  - Justificativa: a AF sai antes da P4, e o guia de poses ainda não existe.
  - Na P4, as metas do guia **leem** `cliques_min` e `cliques_max` daqui, sem copiar. Fica uma fonte só.
  - **Eduardo, 23/11:** começam nos padrões abaixo ("os mais seguros").
- **AF-D8. Período da tela Alertas:** Hoje / 7 dias / 30 dias, padrão 7 dias, no fuso do venue. Os alertas antigos por fotógrafo, que vêm da Roverpix (`al_ppc`, `al_conv`, `al_idx`, `al_caiu`, `al_lidera`), passam a exigir `desempenho.r` e somem quando os dados do servidor existem.
- **AF-D9. Números por fotógrafo só com `desempenho.r`, no servidor:**
  - A aba Estatísticas da view Fotógrafos não precisa de `estatisticas.r`.
  - Sem migração de permissão: quem tem `desempenho.r` hoje já é Admin ou Supervisora.
  - `/metricas/dia` e `/metricas` passam a tirar `por_fotografo` da resposta de quem não tem `desempenho.r`. A tabela "Por fotógrafo" do Painel some sem a letra.
  - Hoje Admin e Supervisora têm as duas letras, então nada muda para elas.

## Limites padrão (`config/fotografos`, v1)
```json
{"v":1,"cliques_min":20,"cliques_max":40,"fam_min":5,
 "conv_fam_pp":10,"conv_fotos_pp":5,"conv_fam_min":15,"conv_equipe_min":3,
 "luz_pct":15,"luz_grave_pct":25,"luz_fotos_min":50,
 "luz":{"v":1,"rosto_p95_alto":250,"rosto_alto_pct":8,"rosto_med_baixo":50,
        "quadro_alto_pct":12,"quadro_med_alto":170,"quadro_med_baixo":45,"quadro_baixo_pct":30}}
```
Os valores de `luz` são o ponto de partida. A calibração (Treino › Medição) sugere outros e o Admin aplica pelo mesmo POST.

## Regras dos alertas (todos com `sev` e só com dados suficientes)

| Tipo | Quando | Texto (exemplo, números inventados) |
|---|---|---|
| `af_poucos` | média abaixo de `cliques_min`, com `fam_min` famílias ou mais | "Márcio: 16 cliques por família (9 de 14 famílias abaixo de 20)" |
| `af_muitos` | média acima de `cliques_max` | "... (5 de 12 famílias acima de 40)" |
| `af_conv_fam` | % de famílias que compraram, menor ou igual à média da equipe menos `conv_fam_pp`, com `conv_fam_min` famílias e `conv_equipe_min` fotógrafos ou mais | "Yago: 41% das famílias compraram (equipe 55%) · 18 de 44" |
| `af_conv_fotos` | fotos vendidas ÷ feitas, menor ou igual à média da equipe menos `conv_fotos_pp` | "x de n fotos vendidas" |
| `af_luz` | fora da exposição em `luz_pct` ou mais (grave a partir de `luz_grave_pct`), com `luz_fotos_min` fotos | "Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras" |

- A média da equipe é ponderada por família (ou por foto), no mesmo período, com a equipe toda.
- O rodapé de cada cartão diz o período e a fonte: "conta gramado, troféu e arquibancada; chute à parte" ou "conta todas as fotos da leva (reconhecimento do ponto desligado)". A conversão também avisa "vendas online fora".
- Nenhum texto fala em hora, presença ou falta.

## Mudanças por arquivo

**`agente/eterna-agente.py`**
- **Medida de luz:**
  - `luz_medir(img_bgr, caixas)` (numpy/cv2) devolve `{v:1, src, q:{med,p5,p95,alto,baixo}, r:{med,p95,alto,n}|null}`.
    - `q` vem dos 60% centrais do quadro (o céu fica de fora).
    - `r` vem do maior rosto, com a caixa aumentada em 10%.
    - `alto` = % de pixels com 250 ou mais. `baixo` = % de pixels com 8 ou menos.
  - `luz_classe(v, lim)` devolve `estourada`, `escura`, `ok` ou `sem_dado`, nessa ordem:
    - Com rosto: estourada se `r.p95 >= rosto_p95_alto` e `r.alto >= rosto_alto_pct`; escura se `r.med < rosto_med_baixo`.
    - Sem rosto: estourada se `q.alto >= quadro_alto_pct` e `q.med >= quadro_med_alto`; escura se `q.med < quadro_med_baixo` e `q.baixo >= quadro_baixo_pct`.
- **No `leitor_loop`:**
  - `ler_rostos(..., detalhe=True)` passa a devolver a caixa como `f[4]`. Os chamadores atuais usam `f[0..3]` e não mudam.
  - Depois da gravação dos rostos, se a exposição não está desligada: `luz_medir(img, [f[4] ...])` vai para a fila em memória `luz_novas`.
  - `luz_grava_loop` grava em lote, a cada 5 s, em `treino.db` `medida(pid, tipo='luz', valor, em)`. A tabela já existe, já vai para o backup e o `treino_lgpd` já apaga as linhas dela.
- **`luz_varre()`** (uma thread, prioridade baixa):
  - Mede o que ficou sem medida nos últimos 30 dias, **primeiro as fotos com rótulo no Treino**.
  - Lê a miniatura com cv2 e roda só o detector YuNet, com `src:"thumb"`.
  - Sem OpenCV: Pillow, só o quadro, `r:null`.
  - Roda quando a chave muda para `medir` e de hora em hora.
- **Agregado por dia:**
  - `af_dia(dia)` é uma função pura sobre o arquivo de sessões, o `cena.db`, a `medida` e o `vendas.db` (conexão só de leitura, como o `_mtg_pagas_ler`).
  - Grava em `operacao.db` `fotografo_dia(dia, fotografo, dados, em, primary key(dia, fotografo))`.
  - `dados` só leva somas:
    - `familias`, `cliques_soma`, `chute_soma`, `nao_contadas`
    - histograma `[<20, 20-40, >40]`
    - `fonte: "ponto"|"todas"`
    - `fam_compraram`, `fotos`, `fotos_vendidas`
    - `luz: {n, escuras, estouradas, sem_dado}`
  - Roda dentro do `dia_loop`: hoje a cada 10 min, ontem na virada, e os últimos 35 dias de madrugada (por causa da LGPD e de venda atrasada).
- **Fechamento do mês:** `af_mes(mes)` soma os dias. No dia 1 (e até o dia 5 se faltar dia), o mês é congelado em `operacao.db` `fotografo_mes(mes, dados, fechado_em)`. A P5 das poses lê daqui.
- **Calibração:** `luz_medida()`.
  - Positivos como no AF-D6. Negativos: fotos marcadas com nível `boa`.
  - Por classe: n, precisão, revocação e matriz. Mais uma grade de 5 valores para cada limite principal, com precisão e revocação, para o Eduardo escolher.
  - Critério de `ligada` (`LUZ_CRIT`): 30 ou mais escuras, 30 ou mais estouradas, 150 ou mais boas, precisão de 0,85 ou mais e revocação de 0,70 ou mais nas duas classes.
- **Mudanças em funções que já existem:**
  - `treino_cfg_gravar`: `exposicao:"ligada"` passa a conferir o `LUZ_CRIT` (409 `criterio` com `falta`), no lugar do `exposicao_sem_modelo`.
  - A migração que rebaixa a exposição Ligada fica como está.
  - `fotografos_cfg()` e `fotografos_cfg_gravar()` com validação fechada (inteiros dentro de faixas; `cliques_min < cliques_max`). O `estado_gravar` recusa `config/fotografos`.
- **Aba Estatísticas (AF-D9):**
  - Rota nova `GET /fotografos/dias?de=&ate=` (sessão com `desempenho.r`, `origem_local`, até 366 dias). Usa o mesmo `metricas_periodo` do `/metricas/dia`, mas devolve só `{"ok":true,"dias":[{"dia","por_fotografo":{...}}]}`, com `clique_checkout_s` incluído.
  - `/metricas/dia` e `/metricas` tiram `por_fotografo` quando a pessoa da sessão não tem `desempenho.r`. A conferência é feita no servidor, pela sessão, e nunca por parâmetro.
- **Rotas em `ROTAS`:** ver Contratos.

**`index.html`**
- **View Fotógrafos (Curadoria, módulo `desempenho`) ganha abas** (`fg-aba`, `state.fg.aba`: `indice` | `estatisticas` | `af`; guardada em `eterna.fg.v1`, só a aba):
  - **Índice:** o conteúdo de hoje do `vFotografos`, sem mudança.
  - **Estatísticas:** a antiga seção `b`.
    - `esSecB`, `esFotoOrd`, `esFotoLinhas` e `ES_FOTO_COL` mudam de lugar sem mudar o desenho, as colunas, a ordenação (`es-ord`) e os gráficos.
    - Dados de `fgEstPull()` (`GET /fotografos/dias`, cache de 5 min, em `state.fg.est`) e período próprio por `rangeBar`, com os mesmos atalhos da Estatísticas.
    - A soma por fotógrafo que hoje está no `esDados` (linhas `soma(fot, d.por_fotografo)` e `clique_checkout_s`) vira a função pura `fgFotoAgrega(dias)`, usada pela aba.
  - **Cliques, conversão e exposição (AF):**
    - Tabela por fotógrafo: famílias, cliques por família (com "x abaixo de 20 / y acima de 40"), chute por família, % de famílias que compraram (x de n), % de fotos vendidas (x de n), fora da exposição (x de n: estouradas, escuras).
    - Linha da equipe no fim.
    - Selo "Em teste" para a exposição em `medir`.
    - Cartão `afLimites` editável com `configuracao.u` (`data-act="af-cfg-salvar"`, `WRITE_OPS`, `ACT_MOD` configuracao, `auditLog('fotografos_limites')`).
  - A aba "Poses e roteiro" entra depois, na P4.
- **Estatísticas sem a seção `b`:**
  - `ES_SECOES` perde `['b','Fotógrafos']`.
  - `case 'es-sec'` com `b`, `state.es.sec==='b'` e `eterna.es.v1` gravado com `sec:'b'` redirecionam: com `canView('fotografos')` e `can('desempenho','r')`, vão para `go('fotografos')` com `state.fg.aba='estatisticas'`; sem isso, a seção vira `a`. O `eterna.es.v1` é regravado com `a`.
  - `relPode` da Estatísticas passa de `['a','b','e']` para `['a','e']`. Sai o ramo `M.sec==='b'` do `relEstatisticas`.
- **Exportar:** `relFotografos` segue a aba aberta. `indice` = o arquivo de hoje. `estatisticas` = as colunas que o `relEstatisticas` exportava na seção `b`, com os dados de `esFotoOrd`. `af` = a tabela da AF com o período. O nome do arquivo leva a aba (`relNovo('fotografos-'+aba, ...)`). O `relAudita` segue como hoje.
- **Alertas:**
  - `state.af = {per:'7d', j, em, busy, erro}`, cache de 5 min, nada em SIM nem `localStorage`.
  - `afPull()` (`agFetch`) chama a rota com o período.
  - `afAlertas()` traduz `j.alertas` em `{sev, t, d}` pelas chaves `af_al_*`.
  - `alerts()` acrescenta `afAlertas()` só com `can('desempenho','r')`. Os alertas antigos por fotógrafo passam a exigir o mesmo e somem quando há `state.af.j`.
  - Em `vAlertas`, chips de período `af-per` (Hoje, 7 dias, 30 dias) e a linha "Dados do servidor do ponto · atualizado hh:mm".
- **Painel:** a tabela "Por fotógrafo" (`pn_por_fotografo`) só aparece com `can('desempenho','r')`.
- **Treino › Medição:** bloco "Exposição" (`trLuzMedida`) com precisão e revocação por classe, a grade e o botão "Usar estes limites" (`configuracao.u`), que grava pelo mesmo POST.
- **I18N nas 5 línguas** (tela da equipe): `af_al_poucos_t|d`, `af_al_muitos_t|d`, `af_al_conv_fam_t|d`, `af_al_conv_fotos_t|d`, `af_al_luz_t|d`, `af_fonte_ponto`, `af_fonte_todas`, `af_online_fora`, `af_per_*`, `fg_aba_indice`, `fg_aba_estatisticas`, `fg_aba_af`, `af_col_*`, `af_equipe`, `af_teste`, `af_lim_*`, `tr_luz_*`.

## Contratos
- `GET /fotografos/alertas?de=&ate=`: sessão com `desempenho.r`, 30 por minuto por pessoa, até 92 dias. Exemplo (todos os números são inventados):
```json
{"v":1,"de":"2026-11-17","ate":"2026-11-23","limites":{...},"exposicao":"medir","fonte_cliques":"ponto",
 "equipe":{"familias":310,"fam_compraram":160,"fotos":7400,"fotos_vendidas":1600},
 "fotografos":[{"k":"marcio","familias":14,"cliques":{"media":16.2,"abaixo":9,"acima":0,"chute_media":3.1,"nao_contadas":12},
   "conv":{"fam":[6,14],"fotos":[40,260]},"luz":{"n":100,"escuras":8,"estouradas":12,"sem_dado":0}}],
 "alertas":[{"tipo":"af_luz","k":"marcio","sev":"warn","args":[20,100,12,8]}]}
```
- `GET /fotografos/dias?de=&ate=`: `desempenho.r`, até 366 dias. Devolve `{"ok":true,"dias":[{"dia","por_fotografo":{"<chave>":{fotos,sessoes,sessoes_com_venda,vendas,faturamento,fotos_vendidas,clique_checkout_s}}}]}`.
- `GET /fotografos/luz/medida`: `qualidade.r`, 10 por minuto. Devolve `{v:1, limites, classes:{escura:{n,precisao,revocacao}, estourada:{...}}, boas_n, grade:{...}, criterio:{passa, falta}}`.
- `POST /fotografos/config`: `configuracao.u`, 6 por minuto, 4 KB, formato fechado acima. 400 `campo` com o nome do campo recusado.
- `/status`: ganha `luz: {v:1, medidas_hoje, fila, ms_med, varredura:{pendentes}, opencv:bool}`, e `estatisticas.af: {ultimo_dia, em}`. `treino.analise.exposicao` mantém o significado, mas `ligada` agora é possível. Nada disso traz pid ou nome.

## Critérios de aceite
1. Com 3 levas sintéticas de 10, 25 e 45 cliques (reconhecimento do ponto ligado, com chute e "outro" misturados), `af_dia` dá média 26,7, 1 abaixo de 20, 1 acima de 40, chute à parte e "outro" em `nao_contadas`.
2. Com o reconhecimento do ponto desligado, a mesma leva conta todas as fotos e `fonte_cliques` vira `"todas"`; a tela mostra `af_fonte_todas`.
3. Venda pela selfie com fotos das levas de A e de B: as duas levas contam como compradoras e cada fotógrafo recebe só as fotos dele em `fotos_vendidas`. Venda cancelada não conta.
4. O alerta `af_conv_fam` só sai com 15 famílias ou mais e 3 fotógrafos ou mais no período, e com o fotógrafo pelo menos 10 pontos abaixo da média ponderada da equipe toda.
5. Com imagens sintéticas, `luz_medir` e `luz_classe` classificam certo: quadro preto = escura; branco = estourada; cinza médio = ok; rosto estourado com fundo escuro = estourada; céu estourado com rosto bom = ok.
6. Com a exposição em `desligada`, nenhuma linha `tipo='luz'` nasce. Em `medir`, os números aparecem com "Em teste" e nenhum `af_luz` sai. `ligada` sem o critério responde 409 `criterio` com `falta`.
7. "Márcio, 20 de 100 fora" (12 estouradas e 8 escuras, limite 15%) gera exatamente o cartão "Márcio: 20 de 100 fora da exposição: 12 estouradas, 8 escuras". Com 49 fotos no período, não gera cartão. Com 25% ou mais, o cartão é grave.
8. `/fotografos/alertas` e `/fotografos/dias` sem `desempenho.r` respondem 403. O Fotógrafo não vê nenhum cartão `af_*` nem os alertas antigos por fotógrafo. A Supervisora vê.
9. Aplicar o Ajuste automático e um ajuste à mão numa foto escura não muda a `medida` dela nem a contagem.
10. A exclusão LGPD apaga a `medida` da foto. O `af_dia` da noite seguinte não conta mais essa foto.
11. `POST /fotografos/config` com `cliques_min >= cliques_max`, campo a mais ou valor fora da faixa dá 400. Gravar pelo `/ponto/docs` é recusado. Mudança válida vai para o `auditLog`.
12. O mês congelado em `fotografo_mes` é igual à soma dos `fotografo_dia` e não muda depois.
13. A calibração conta como positiva só a foto `fraca` ou `nao_vai` com motivo `escura` ou `estourada`. Uma foto "ajustar" com o mesmo motivo não entra como positiva.
14. A Estatísticas não tem mais o chip Fotógrafos. Clicar num `es-sec` `b` antigo, abrir com `state.es.sec='b'` ou com `eterna.es.v1` `{sec:'b'}` leva a Fotógrafos › Estatísticas para quem tem `desempenho.r`. Para quem não tem, abre a seção `a`, e o `eterna.es.v1` fica com `a`.
15. A aba Estatísticas mostra as mesmas linhas, colunas, ordem e totais que a seção `b` mostrava para o mesmo período e os mesmos dias sintéticos. Ordenar por coluna funciona igual.
16. Uma pessoa com `desempenho.r` e sem `estatisticas.r` abre a aba Estatísticas com dados. Com `estatisticas.r` e sem `desempenho.r`, não vê a view Fotógrafos, e o `/metricas/dia` dela vem sem `por_fotografo`.
17. O Exportar da view Fotógrafos gera o arquivo da aba aberta. Na aba Estatísticas, as colunas são as que a seção `b` exportava. O Exportar da Estatísticas só aparece nas seções `a` e `e`.
18. A tabela "Por fotógrafo" do Painel some para quem não tem `desempenho.r`. Admin e Supervisora continuam vendo.
19. As três abas e os cartões abrem nas 5 línguas sem chave faltando. `testes/todas-as-telas.js` e o critério 19 de `testes/permissoes.js` passam.

## Testes
- `testes/af_agente.py`: critérios 1 a 4, 6 a 8, 10 a 13 e a parte do servidor dos 16 e 18, com sessões, `cena.db`, `vendas.db` e medidas sintéticas, e as rotas com sessão de teste.
- `testes/af_luz.py`: critério 5, com imagens geradas em numpy; nenhuma foto real.
- `testes/af-alertas.js`: critérios 7 a 9 e 19 na tela.
- `testes/fotografos-abas.js`: critérios 14 a 18.
- Acertar os testes que existem:
  - `testes/estatisticas.js`: as listas de seções sem `b`, e o critério da seção `b` passa para a aba.
  - `testes/relatorios.js`: o Exportar da Estatísticas só em `a` e `e`, e a comparação da tela `b` com o arquivo passa para a aba Estatísticas de Fotógrafos (`relatorio/fotografos-estatisticas` no `auditText`).
  - `testes/v92-testador.js`: tirar `b` das voltas pelas seções.
  - `testes/seguranca_rotas_agente.py` e a matriz de permissões da `idiomas-base`, com as rotas novas e o `por_fotografo` tirado do `/metricas/dia` sem `desempenho.r`.

## Custo e escala
- **Medida na chegada:** de 3 a 6 ms por foto, porque a imagem já está decodificada no leitor de rostos (histograma em cerca de 3 MP). Isso dá menos de 20 s de processador por dia com 3.000 fotos. Não usa a placa de vídeo.
- **Varredura de 30 dias:** cerca de 90.000 miniaturas, com detector, a ~15 ms cada, em uma thread de prioridade baixa: perto de 25 min, uma vez só.
- **Agregação:** menos de 1 s por dia. Os 35 dias da madrugada levam menos de 30 s.
- **Com 100 venues:** cada um calcula no próprio servidor. Os limites são por venue (`config/fotografos`). Sem internet, nada muda.

## Riscos para o revisor de segurança
- **Dado de funcionário:** a permissão (`desempenho.r`) é conferida no servidor, nas rotas novas, no `/metricas/dia` e no Exportar. O cartão nunca é montado no navegador com dado de quem não tem a letra.
  - Nenhum texto, coluna ou campo de hora, presença, falta ou turno. A conta é por família, nunca por hora (decisão "sem controle de ponto").
- **LGPD:** nenhuma foto sai do servidor. A `medida` é só número por pid e é apagada com a foto. `fotografo_dia` e `fotografo_mes` só têm somas, sem pid nem cliente.
- **Comparação injusta entre pontos:** o fotógrafo da arquibancada converte diferente do fotógrafo do gramado, e a Escala está desligada. As defesas são o mínimo de famílias e a média da equipe toda. O set entra na comparação quando o reconhecimento estiver Ligado.
- **Limites editáveis pela Supervisora** (ela tem `configuracao.u`): toda mudança fica no `auditLog`, com o valor anterior e o novo.
- **Tirar `por_fotografo` do `/metricas/dia`** muda uma resposta que o Painel e a Estatísticas usam. O teste do critério 16 confere que Admin e Supervisora não perdem nada.
