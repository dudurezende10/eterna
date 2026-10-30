# Plano v90: sessões separadas por tempo e por rosto, agrupadas no Upload automático

Arquivo para salvar: `/home/claude/eterna/docs/planos/2026-10-30-sessoes-por-rosto-e-tempo.md`

## Objetivo
O agente separa as sessões de cada fotógrafo por **1 minuto sem foto** e por **rostos novos**, usando a hora do clique. O Upload automático mostra as fotos agrupadas por sessão, com a sessão aberta em destaque. A Fila do fotógrafo passa a usar a mesma separação.

## Escopo desta entrega
- **Agente:** regra nova em `sess_*` (pausa de 60 s, hora do clique, rostos). A decisão espera a leitura do rosto e tem prazo máximo. Fusão de sessões ainda não fechadas. Fotos atrasadas têm grupo separado.
- **Agente:** fila de rostos com prioridade para a foto nova. `/sessoes` com campos novos. A Fila (`ff_json`) passa a ser montada a partir das sessões.
- **App:** painel "Sessões de hoje" no Upload automático (view `importar`), lendo de `SRV.sess`. Pausa de 60 s no app e no Guia.
- **Correções no código `sess_*` do Ronaldo:** lista na seção "Revisão do código sess_*".
- **Testes:** sintéticos com vetores de rosto falsos, sem OpenCV e sem foto de convidado.

## Fora do escopo
- Juntar sessões de fotógrafos diferentes (a mesma família com dois fotógrafos continua em duas sessões; o Checkout já lista as várias sessões achadas pela selfie em `faceFind`).
- Juntar a foto atrasada a uma sessão já fechada e talvez vendida. Aqui ela forma sessão própria.
- Ferramenta de calibração do limiar com fotos reais. Fica como passo seguinte, usando `/rostos/medir`.
- Partes C a F da v85: `POST /sessoes/legado`, ETag/304, `?dia=`, feed só em memória (D4).
- Rekognition: a separação é só local (YuNet + SFace).

## Decisões assumidas

| # | Decisão |
|---|---|
| S1 | **Pausa = 60 s** (`SESS_PAUSA`), uma constante só para sessões, Fila e app. `ETERNA_SESSAO_PAUSA` (2 a 600) continua existindo só para os testes. `FF_PAUSA` vira apelido de `SESS_PAUSA`. `SESSAO_PAUSA_S` no app = 60. Efeito: o "Já no Checkout" da Fila passa de ~20 s para ~60 s depois da última foto. |
| S2 | **Relógio da sessão = hora do clique corrigida.** `t = cap + desvio_min(série)` (o mesmo desvio de `ff_ultimo_clique`). Sem `cap`, vale a data do arquivo de origem (`mt`, campo novo no meta). Sem as duas, vale a chegada `u`. Clique fora de `[u − 48 h, u + 10 min]` é tratado como inválido e cai na chegada (EXIF forjado não manda). |
| S3 | **Duas trilhas por fotógrafo.** Trilha "ao vivo" (`k`): foto com `u − t ≤ 600 s`. Trilha "atrasada" (`k|t`): o resto, ou seja, cartão de emergência e modo cartão. As duas usam a mesma regra e não se misturam. A sessão da trilha atrasada leva `atrasada:true`. |
| S4 | **Quem é o fotógrafo:** `ff_quem` (D2 da v85), sem mudança. |
| S5 | **Regra do rosto,** para uma foto P numa trilha com sessão aberta S e pausa ≤ 60 s:<br>- Faces de P que contam: rosto principal (largura ≥ 0,5 × o maior rosto da foto e ≥ `ROSTO_MIN`). Para votar por "sessão nova", o rosto ainda precisa ser de qualidade: score ≥ 0,80, largura ≥ 60 px na foto reduzida a 1600 px e frontal (deslocamento do nariz em relação ao meio dos olhos ≤ 0,35 × a distância entre os olhos).<br>- `sim` = maior cosseno entre os rostos principais de P e os rostos guardados de S.<br>- `sim ≥ 0,38` (`SESS_LIM_FICA`, igual a `LIMITE_TALVEZ`): P fica em S.<br>- P tem ao menos um rosto de qualidade e todos ficam com `sim < 0,25` (`SESS_LIM_NOVO`): P abre sessão nova, motivo `rostos_novos`, e S vira `separada`.<br>- Entre 0,25 e 0,38 (dúvida), foto sem rosto, só de perfil, criança com leitura fraca ou rosto pequeno: P fica em S.<br>- Motivo: o erro que junta famílias vaza foto de estranho no Checkout; o erro que separa é recuperado pela selfie. Na dúvida, o padrão é o de hoje (fica). |
| S6 | **A decisão espera o rosto.** Foto que passa no teste de tempo entra como pendente na sessão aberta e só é decidida depois da leitura, na ordem do clique, por trilha (uma pendente não passa à frente da anterior). Prazo `SESS_ROSTO_ESPERA = 20 s` desde a chegada: depois disso, vale só o tempo (motivo `t`). Com os rostos desligados (sem OpenCV ou com `ETERNA_SEM_OPENCV`), a decisão é imediata, só por tempo. Foto que abre sessão por pausa é decidida na hora, e os rostos dela entram em S quando forem lidos. |
| S7 | **Fusão das "individuais primeiro, grupo depois".** Candidatas: a sessão aberta e as `separada` da mesma trilha que ainda não fecharam de vez, até 3. P vai para a candidata de maior `sim`. Se P bate com duas ou mais candidatas com `sim ≥ 0,45` (`SESS_LIM_FUNDE` = `LIMITE`), elas se fundem na mais antiga. A outra vira `removida:true` com `fundida_em`. Quando a foto bate com uma `separada` e não com a aberta, essa `separada` volta a ser a aberta. |
| S8 | **Fechamento definitivo** (`status:'fechada'`), o que acontecer primeiro:<br>- 60 s sem chegada naquela sessão (relógio do agente);<br>- outra sessão da trilha aberta por pausa de clique (no despejo do cartão, as sessões fecham durante a leitura);<br>- virada do dia;<br>- reinício do agente (`fechada_por:'reinicio'`).<br>Só sessão `fechada` vai para o SIM (como hoje). Sessão `fechada` nunca muda de foto, exceto pela LGPD. Assim, fusão e reabertura nunca mexem em sessão que já pode ter venda. |
| S9 | **Vetores só em memória** e só das sessões não fechadas: no máximo 40 por sessão, sem guardar repetido (o vetor que tem sim ≥ 0,7 com um já guardado não entra), separados por pid. Somem quando a sessão fecha. Nada de vetor em `/sessoes`, em `~/Eterna/ponto/sessoes/*.json` ou em log. `rostos.db` fica igual (mesma tabela, 60 dias, D10). |
| S10 | **Cálculo em Python puro** (`array('f')`, produto interno de 128): o teste roda sem numpy e o custo é desprezível (menos de 0,2 ms por foto com 120 vetores candidatos). |
| S11 | **Fila de rostos com prioridade:** `fila_rostos` vira `PriorityQueue` (0 = foto nova, 1 = atraso do boot). Hoje, depois de reiniciar com atraso, a foto nova espera atrás de todas as antigas, e o S6 cairia sempre no prazo. |
| S12 | **Fila do fotógrafo = sessões.** O `id` do grupo passa a ser o código LP. Estados:<br>- `fotografando`: sessão aberta e último clique há ≤ 60 s;<br>- `subindo`: trilha atrasada em andamento, foto pendente de rosto, ou `separada`/aberta sem clique recente;<br>- `pronta`: `fechada` e nenhuma foto na fila de rostos.<br>O contrato do `GET /fila-fotografo` continua o mesmo. |
| S13 | **Upload automático é tela da equipe:** textos só em português, sem `I18N`. |
| S14 | **Arquivos de sessão:** retenção de 60 dias (D8 da v85). A LGPD também limpa o pid nos arquivos de dias anteriores. |

## Revisão do código sess_* do Ronaldo (commit 5fe4e5c)

**Reaproveitar**
- `_sess_codigo` (secrets, alfabeto D3).
- A estrutura `sess`, `sess_pid`, `sess_aberta`, `sess_rev`, `sess_sujo`.
- A gravação por dia com tmp + `os.replace`.
- `sess_feed` com `gen`/`rev` e `/status.sessoes`.
- O gancho em `ingest_file` (fora do `lock`) e em `lgpd_excluir`.
- No app: `srvPull`, o corte "com `st.sessoes` a foto real não vai para `ingPush`" e `ingClose(how, srv)`.

**Corrigir**
1. **Regra:** usa a chegada `u` e `FF_PAUSA` 20 s. No despejo do cartão, tudo chega em segundos e vira uma sessão só (o "bolo"). Corrigir com S1, S2, S3 e S5.
2. **Duas montagens de grupo** (`_ff_add` e `_sess_add`) com a mesma regra copiada: vão divergir. Passa a ser uma só (S12).
3. **`_sess_fechar` com `x["dia"] != hoje`:** a sessão aberta às 23:59:50 fecha por virada mesmo com foto chegando à 00:00:05. Isso é aceitável, mas precisa constar do motivo, e o `dia` deve vir do clique `t`, não da chegada.
4. **Arquivos de sessão nunca são apagados.** O D8 pedia 60 dias. `sess_esquecer` só limpa hoje e ontem (em memória), e o pid de 10 dias atrás continua no JSON daquele dia. Corrigir com S14.
5. **App, `srvPull`:** ignora atualização de sessão que já está no SIM (`SIM.sessions[x.card]` existe → `continue`). Com S8, a sessão `fechada` não muda, então basta tratar `removida` (LGPD): tirar as fotos da sessão no SIM se ela não tem venda paga, ou registrar no `log` se tem.
6. **App, `ingClose(srv)`:**
   - `point`/`pdv` vêm do seletor do navegador (`state.imp.point`), não do agente. Usar `x.ponto`, que vem da função do dia gravada por `_ff_func_snapshot`.
   - `closedAt` = `now()` do navegador. Usar `x.fechada_em`.
   - `source` = `state.imp.mode`. Usar `x.atrasada ? 'cartao' : x.fonte`.
   - `key`: usar `x.fotografo` quando ele for chave de `P`; senão, `impWho`.
7. **App:** cada navegador roda `validateReal` e `log` para a mesma sessão. Manter nesta entrega, registrado como risco de escala (cada posto valida de novo). Vai para o servidor depois.
8. **`/sessoes` aberto a `ETERNA_ORIGENS`** (desvio do D9) sem passar pela revisão de segurança. A exposição é a mesma do `/biblioteca` (pids → `/thumb/`). O revisor precisa aceitar ou recusar. Ver o Risco 3.
9. **`sess_feed` completo** (`desde=0`) devolve ontem inteiro também. Filtrar em `dia ∈ {hoje}` por padrão; ontem só com `?ontem=1` (barato e reduz o tráfego da TV da Fila).
10. **Sem teste automático e sem linha no `VERSOES.md`** para a v85 A. Os testes desta entrega cobrem as duas coisas.
11. **`ff_cadastrados()`** lê o `ftp.json` do disco a cada foto, duas vezes (ff e sess). Com S12 passa a ler uma vez. Vale um cache de 30 s.

## Mudanças por arquivo

### `/home/claude/eterna/agente/eterna-agente.py`

**Constantes** (perto de `FF_PAUSA`):
- `SESS_PAUSA` (= `_ff_pausa()` com padrão 60); `FF_PAUSA = SESS_PAUSA`.
- `SESS_ATRASO = 600`, `SESS_ROSTO_ESPERA = 20`.
- `SESS_LIM_FICA = 0.38`, `SESS_LIM_NOVO = 0.25`, `SESS_LIM_FUNDE = 0.45`.
- `SESS_ROSTOS_MAX = 40`, `SESS_CAND_MAX = 3`, `SESS_RET_DIAS = 60`.
- `ETERNA_SESS_LIMITES` só nos testes, para trocar os limiares.

**Reconhecimento facial:**
- `ler_rostos(img, det, rec, minimo, detalhe=False)`: com `detalhe=True` devolve `[(larg, vetor, score, frontal)]`. Os chamadores atuais (`_buscar`, medir) não mudam.
- `leitor_loop`: usa `detalhe=True`, grava no banco como hoje e, depois do `commit`, chama `sess_rostos_lidos(pid, [(larg, list(vetor), score, frontal)...])` (fora de `_mat_lock`). No `except`, chama `sess_rostos_lidos(pid, None)` (conta como lida sem rosto). Continua chamando `ff_rosto_lido`.
- `fila_rostos`: `PriorityQueue` com itens `(prio, seq, pid, path, t_fila)`. Ajustar o `put` em `ingest_file` (prio 0) e em `rostos_thread` (prio 1), e o `get` em `leitor_loop`.

**`ingest_file`:**
- Gravar `mt` (o `st.st_mtime` de origem) no `meta[pid]`.
- Trocar `ff_add` + `sess_add` por um único `sess_add(pid, mm)`; a Fila deriva das sessões.

**Sessões** (substituem o bloco do Ronaldo, com os mesmos nomes onde der):
- `sess_clique(m, serie) -> (t, fonte_t)`: aplica S2. `fonte_t ∈ {cap, mt, u}`.
- `sess_trilha(m, t)`: devolve `k` ou `k|t` (S3).
- `_sess_nova(trilha, t, u, motivo, m)`: cria o objeto do contrato, com `ponto` de `_ff_func_snapshot(chave)`.
- `_sess_add(pid, m, cad, agora)`:
  - teste de tempo contra a aberta da trilha (`t − cap1 > SESS_PAUSA` ou `t < cap0 − SESS_PAUSA` → nova com motivo `pausa`; a aberta anterior fecha de vez por S8);
  - sem aberta → nova, motivo `inicio`;
  - passou no tempo e com rostos ligados → `x["pend"].append(pid)` e `sess_espera[trilha].append(pid)`;
  - sem rostos → `_sess_confirma(pid, x, "t")`.
- `sess_rostos_lidos(pid, faces)`: guarda as faces em `sess_faces_pid[pid]` e chama `_sess_drenar(trilha)`.
- `_sess_drenar(trilha, agora)`: enquanto a cabeça de `sess_espera[trilha]` tem faces lidas ou passou do prazo, aplica S5 e S7. Marca na sessão o código de decisão por foto em `dec[pid]`:
  - `r` = rosto bateu;
  - `n` = rostos novos;
  - `d` = dúvida;
  - `s` = sem rosto ou só perfil;
  - `t` = só tempo ou prazo;
  - `f` = fundiu.
- `_sess_sim(faces_p, card)`: maior cosseno (Python puro).
- `_sess_guarda_rostos(card, pid, faces)`: S9.
- `_sess_fundir(destino, origem)`: move fotos, pend e faces. A origem vira `removida`, `fundida_em`. Faz `_sess_toca` nas duas.
- `_sess_fechar(agora)`: S8. Ao fechar, apaga as faces da sessão da memória. O prazo do S6 também roda aqui: `sess_loop` chama `_sess_drenar` para cada trilha a cada 2 s.
- `sess_esquecer(pid)`: também tira o pid de `pend`, de `sess_espera` e de `sess_faces_pid`.
- `sess_esquecer_disco(pids)`: chamada em `lgpd_excluir`. Reescreve os `AAAA-MM-DD.json` dos últimos 60 dias que contêm algum pid apagado.
- `sess_limpar()`: uma vez por dia em `sess_loop`. Apaga arquivos com mais de `SESS_RET_DIAS`.
- `sess_carregar()`:
  - toda sessão não `fechada` que estava no arquivo fecha com `reinicio`;
  - as órfãs de hoje e ontem são agrupadas pela mesma regra, em ordem de `t`, com as faces lidas de `rostos.db` por pid quando existem (sem esperar).
- **Fila (S12):** `ff_json` monta os grupos a partir de `sess` (hoje, não `removida`), mantendo as chaves do contrato atual:
  - `id` = card, `inicio` = `aberta_em`;
  - `ultimo_clique` = `cap1`, `n` = `len(fotos) + len(pend)`;
  - `pids` = as 6 mais novas nas abertas, `pronta_em`.

  `_ff_add`/`ff_grupos`/`ff_aberto` saem. Ficam `ff_quem`, `ff_cadastrados` (com cache), `ff_desvio`, `rostos_pendentes`, `ff_rosto_fila`/`ff_rosto_lido` (estes passam a contar `pend` na sessão), a função do dia e a poda de 15 min.
- **Travas:** `sess_lock` nunca com `lock` ou `_mat_lock` na mão. `ff_lock` deixa de ser preciso para os grupos (a Fila lê sob `sess_lock`).

**Rotas:** o `GET /sessoes` continua igual nas travas. O `/status.sessoes` ganha:
- `"rostos": true|false` (se a separação por rosto está ativa);
- `"pausa": 60`.

### `/home/claude/eterna/index.html`

- `SESSAO_PAUSA_S = 60` e o comentário.
- `SRV`: ganha `sess: {}` (card → objeto do feed, só hoje, inclusive aberta, separada e removida).
- `srvPull`:
  - atualiza `SRV.sess` com tudo o que vier (`removida` → apaga do mapa);
  - continua materializando no SIM só a `fechada`;
  - trata `removida` de sessão que já está no SIM (item 5 da revisão);
  - redesenha só com `state.view === 'importar'` ou `'fotofila'`.
- `ingClose(how, srv)`: correções do item 6. Novo campo `motivo: x.motivo` na sessão do SIM.
- `upSessoes()` (nova), chamada em `vImportarCore` quando `state.agent.sessoes` existe. Ela substitui o painel "Sessão em formação" e "Sessões criadas nesta leva" (que continuam no modo simulado e sem agente).
  - Fonte: `SRV.sess`, filtrado por `state.imp.key` (fotógrafo) e `state.imp.point`, do mais novo para o mais antigo. Até 30 sessões, com o botão "Ver mais 30" (`data-act="up-sess-mais"`, `state.upSessN`).
  - Cabeçalho por sessão, numa linha:
    - código LP;
    - nome do fotógrafo (`P[k].name` ou `fonte`);
    - ponto;
    - `hh:mm:ss–hh:mm:ss` (`cap0`/`cap1`, com "chegada" quando `fonte_t === 'u'`);
    - `N fotos`;
    - pill de motivo: `rostos_novos` → "rostos novos", `pausa` → "pausa de 1 min", `inicio` → "primeira do dia", `reinicio` → "agente reiniciado", `reagrupada` → "reagrupada";
    - pill "atrasada" quando `atrasada`;
    - `fechada_por`, se fechada.
  - Estado: a aberta tem a classe `up-sess on` (borda amarela `#FFB800`, pill "aberta · recebendo"). A `separada` mostra a pill "fechando" (fica mergulhável). A `fechada` fica neutra e tem o botão "Abrir sessão" (`data-act="up-sess-abrir" data-card`) quando já está no SIM.
  - Miniaturas: `photoBtn({id:'ag_'+pid},{act:'zoom',label:...})` em grade `photos small`, `loading="lazy"`, até 48 por sessão, com "+N" (`data-act="up-sess-tudo" data-card`, `state.upSessAll[card]`). Pendentes aparecem com a tag "lendo rostos" e opacidade .6. As setas do modal percorrem a sessão (passar a lista de ids da sessão ao `zoom`, como em `g.done`).
  - Aviso fixo quando `!a.sessoes.rostos`: "Rostos desligados neste computador: as sessões estão sendo separadas só por tempo (1 minuto)."
- `data-act` novos no `switch`: `up-sess-mais`, `up-sess-tudo`, `up-sess-abrir` (só leitura: não entram em `WRITE_OPS`; `up-sess-abrir` respeita `canView` da tela de sessão).
- CSS: `.up-sess`, `.up-sess.on`, `.up-sess-h` (cabeçalho em linha, quebra no celular), `.up-sess .ph[data-pend="1"]`.
- Carimbo de versão v90 nas duas ocorrências.

### Outros
- `/home/claude/eterna/docs/GUIA-DA-EQUIPE.md`:
  - linha 534, "20 segundos" vira "1 minuto";
  - seção do Upload automático: como ler o painel de sessões e o que quer dizer cada motivo.
- `/home/claude/eterna/docs/DOCUMENTACAO-TECNICA.md`: seção "Sessões por tempo e rosto (v90)" com a regra S1 a S9.
- `/home/claude/eterna/docs/CONTEXTO-ETERNA.md`, seção 4:
  - trocar a linha da Fila ("pausa `FF_PAUSA` 20 s");
  - acrescentar `sess_*`, `SESS_PAUSA` 60 e os limiares.
- `VERSOES.md`: v90 (registrar a v85 A do Ronaldo junto).
- Testes novos:
  - `/home/claude/eterna/testes/sessoes_agente.py` (módulo importado, relógio controlado, `ETERNA_SEM_OPENCV=1`, faces injetadas por `sess_rostos_lidos`);
  - `/home/claude/eterna/testes/sessoes-upload.js` (Playwright, agente falso servindo `/status` e `/sessoes`);
  - os dois entram em `rodar.sh`. Ajustar `testes/fila_fotografo_agente.py` para o `id` = LP e a pausa nova.

## Contratos

`GET /sessoes?desde=<rev>` (mesmas travas de hoje):
```json
{"ok":true,"gen":"<BOOT>","rev":812,"pausa":60,"rostos":true,"completo":false,
 "sessoes":[{"card":"LPK7Q2M9X","dia":"2026-10-30","fotografo":"carlos","fonte":"ftp","ponto":"campo2",
   "trilha":"vivo","atrasada":false,"status":"aberta","motivo":"rostos_novos",
   "aberta_em":1761843780.2,"ultima_chegada":1761843901.0,"cap0":1761843775.0,"cap1":1761843897.0,"fonte_t":"cap",
   "fechada_em":null,"fechada_por":null,"fotos":["a1b2c3d4e5f6"],"pend":["0f9e8d7c6b5a"],
   "dec":{"a1b2c3d4e5f6":"r"},"sim_abertura":0.12,"fundida_em":null,"removida":false,"rev":811}]}
```
- `status`: `aberta | separada | fechada`.
- `motivo`: `inicio | pausa | rostos_novos | reinicio | reagrupada`.
- `fechada_por`: `pausa | pausa_clique | virada_do_dia | reinicio`.
- `sim_abertura`: o maior `sim` contra a sessão anterior quando o motivo é `rostos_novos` (número, para calibrar; não é vetor).
- `/status.sessoes`: `{"v":2,"pausa":60,"rostos":true,"rev":812,"gen":"…","hoje":38,"abertas":2}`.
- `/fila-fotografo`: o contrato da v87 não muda; `grupos[].id` passa a ser o código LP e `pausa` = 60.
- `SIM.sessions[card]` ganha `motivo` e `srv:true` (já existe). Nada de rosto.
- I18N: nenhuma chave nova (tela da equipe).

## Critérios de aceite

Os testes de agente usam faces sintéticas, montadas assim: pessoa = vetor unitário aleatório de 128 com semente fixa; rosto na foto = normaliza(base + ruído σ=0,6), com sim ~0,6 a 0,8 com a própria pessoa e ~0 com outras; "perfil" = `frontal:false`; "criança fraca" = sim ~0,30 com a própria base. Clique por EXIF `cap`, relógio injetado em `_sess_add(..., agora)` e `sess_tick(agora)`.

1. **Pausa:** A1, A2 e A3 com cliques a 10 s, depois A4 70 s depois (sem rosto) → 2 sessões; a segunda tem `motivo:'pausa'`. A 59 s → 1 sessão.
2. **Rostos novos sem pausa:** família F (pais P1, P2) em 3 fotos, depois família G (G1, G2) 5 s depois → 2 sessões; a segunda com `motivo:'rostos_novos'` e `sim_abertura < 0,25`; a primeira vira `separada` e depois `fechada`.
3. **Individual fica na família:** F em grupo, depois foto só de P2 → mesma sessão, `dec='r'`.
4. **Individuais antes do grupo (fusão):** foto só de P1, foto só de P2 (abre S2 por rostos novos), depois foto de grupo P1+P2 → uma sessão só (a mais antiga), S2 `removida` com `fundida_em`.
5. **Sem rosto fica:** foto sem rosto no meio da sessão → fica, `dec='s'`.
6. **Perfil e criança não separam:** foto só com rosto `frontal:false`, ou só com a "criança fraca" (sim 0,30) → fica (`s` ou `d`).
7. **Fundo não separa:** foto com P1 (largura 200) e estranho (largura 70) → fica, e o estranho não entra nos rostos guardados (a foto seguinte, só com o estranho em 200 px, abre sessão nova).
8. **Espera pelo rosto:** com rostos ligados, a foto fica em `pend` até `sess_rostos_lidos`; leituras na ordem inversa (B3 antes de B2) produzem o mesmo resultado da ordem certa.
9. **Prazo:** sem leitura em 20 s, a foto é confirmada só por tempo (`dec='t'`) e a fila da trilha anda.
10. **Rostos desligados:** com `ETERNA_SEM_OPENCV=1`, nenhuma foto fica pendente; vale só a pausa; `/status.sessoes.rostos === false`.
11. **Hora do clique, cartão:** 30 fotos chegando em 5 s com cliques em 3 blocos separados por 2 min → 3 sessões, todas `atrasada:true`, fechadas durante a leitura (`pausa_clique`) e a última 60 s depois.
12. **Ao vivo e cartão juntos:** fotos ao vivo do mesmo fotógrafo chegando durante o despejo do cartão não entram em sessão `atrasada`, e vice-versa.
13. **EXIF forjado:** `cap` de 2001 ou de amanhã → `fonte_t:'u'`, sem quebrar a regra.
14. **Vários fotógrafos:** Carlos e Samuel intercalados em segundos, com a mesma família → sessões separadas por fotógrafo.
15. **Fechada não muda:** foto que bateria com uma sessão `fechada` abre sessão nova; a `fechada` mantém `fotos` e `rev`.
16. **LGPD:**
    - `lgpd_excluir(pid)` tira o pid da sessão em memória, de `pend`, das faces guardadas e do JSON de um dia de 10 dias atrás;
    - `grep` no diretório `~/Eterna/ponto/sessoes/` não acha o pid;
    - nenhum JSON de sessão nem a resposta de `/sessoes` contém array de 128 números (teste procura qualquer lista numérica com mais de 16 itens).
17. **Retenção:** arquivo de sessão com 61 dias é apagado por `sess_limpar`; o de 59 fica.
18. **Reinício:** agente reiniciado com sessão aberta → ela vem `fechada_por:'reinicio'`; a foto nova abre sessão com `motivo:'inicio'` ou `'pausa'`.
19. **Prioridade:** com 200 fotos antigas na fila de rostos, a foto nova é lida antes delas (ordem de `get`).
20. **Fila = sessões:** no cenário do critério 2, `/fila-fotografo` mostra 2 grupos com os mesmos códigos LP do `/sessoes`; `pronta` só depois de fechada e com os rostos lidos. O `testes/fila-fotografo.js` atualizado passa.
21. **Upload, agrupado:** com o agente falso devolvendo 3 sessões (1 aberta, 1 separada, 1 fechada), a view `importar` mostra 3 blocos, cada um com o cabeçalho completo (LP, fotógrafo, ponto, início–fim, nº de fotos, motivo "rostos novos" ou "pausa de 1 min"). Só o bloco aberto tem a classe `on`.
22. **Miniaturas:** toda miniatura do painel tem `naturalWidth > 0`; clicar abre o modal grande; as setas percorrem só as fotos da mesma sessão.
23. **Filtros:** o seletor Fotógrafo e o seletor Ponto do Upload filtram os blocos.
24. **Volume:** com 120 sessões e 3.000 fotos no feed, o render do Upload leva menos de 150 ms e mostra 30 blocos com no máximo 48 miniaturas cada.
25. **Compatibilidade:** sem `st.sessoes` (agente antigo) ou sem agente, o Upload continua com "Sessão em formação" e "Sessões criadas nesta leva" como hoje (v79 a v89 sem regressão).
26. `bash testes/rodar.sh` termina com `FALHAS: 0`, e `todas-as-telas.js` abre `importar` e `fotofila` sem erro.

## Riscos para o revisor de segurança e escala

1. **Biometria (LGPD art. 11 e art. 14 para menores).** O vetor facial continua só no computador do ponto. A entrega acrescenta cópias em memória (S9), só das sessões não fechadas, por minutos. Conferir:
   - nada de vetor em `/sessoes`, em arquivo de sessão ou em log;
   - `sess_esquecer` limpa as faces;
   - a retenção do `rostos.db` não mudou (60 dias).

   O agrupamento por rosto de criança é tratamento interno, sem busca aberta, igual ao que a leitura de hoje já faz. Isso precisa constar do RIPD.
2. **Vazamento entre famílias.** O erro que junta duas famílias mostra foto de estranho no Checkout. Mitigações: S5 com zona de dúvida, rosto principal, fusão só com 0,45 e só antes do fechamento. O que continua possível: a família seguinte visível em tamanho grande no fundo das fotos da anterior. Antes do go-live (01/12), calibrar com um dia real por `/rostos/medir`.
3. **`/sessoes` para `ETERNA_ORIGENS`** (desvio do D9 pelo Ronaldo). Dá a lista de pids do dia a qualquer posto ou Tailscale listado, e com `Origin` ausente (curl) basta o `Host` estar em `HOSTS_OK`. É a mesma exposição de `/biblioteca`. O revisor decide se aceita até o pareamento (v83 etapa 2). `/file/` continua só local.
4. **EXIF não é confiável.** `cap`, `Artist` e série vêm da câmera ou do FTP. O S2 limita a janela do clique. A identidade continua pelo login do FTP primeiro (`ff_quem`). Uma foto com EXIF forjado não consegue entrar em sessão de outro fotógrafo.
5. **Leitura de rosto atrasada.** Com CPU fraca ou atraso no boot, o S6 cai no prazo e a regra volta a ser só tempo (o comportamento de hoje, nunca pior). O S11 evita o pior caso. Monitorar `espera_ms` em `/metricas`.
6. **Escala no ponto:**
   - o arquivo do dia é regravado inteiro a cada 2 s quando muda (~300 KB com 15 mil fotos): aceitável num ponto, mas passar para JSONL com compactação quando houver 3 ou mais postos lendo;
   - `validateReal` roda em cada navegador (item 7 da revisão);
   - `SIM.sessions` com a lista de fotos no `localStorage` (D4 da v85 não cumprido) estoura os ~5 MB em poucos dias de 3.000 fotos. Precisa de poda, ou do D4, antes do go-live.
7. **Muitos venues.** A regra é por agente e não tem estado global. Na nuvem, o mesmo algoritmo roda por venue e fotógrafo. Os limiares ficam por provedor (o Rekognition não usa 0,38).
8. **Internet caída:** nada muda. Tudo é local; os modelos já estão em `~/Eterna/modelos`.

## Decisões pendentes para o Eduardo (com recomendação)

1. **Sessão separada por rostos novos:**
   - Opção A (recomendada): fica 1 minuto "fechando" antes de ir para o Checkout, para juntar "individuais antes do grupo". Custo: a família espera 1 min depois da última foto.
   - Opção B: fecha na hora, sem fusão. O Checkout mostra as duas sessões e a pessoa escolhe.
2. **Foto atrasada de uma sessão já fechada:**
   - Opção A (recomendada nesta entrega): sessão própria, marcada "atrasada".
   - Opção B, depois: juntar à sessão antiga, somando fotos sem tirar nada.
3. **Mesma família com dois fotógrafos:**
   - Recomendação: continuar separado (o Checkout já junta pela selfie).
   - Juntar entre fotógrafos é a próxima etapa, se ele quiser.
4. **"Já no Checkout" da Fila mais lento** (20 s → 60 s):
   - Recomendação: aceitar, porque é a mesma regra de 1 minuto.
   - Alternativa: a Fila avisa "pronta em breve" aos 20 s.
