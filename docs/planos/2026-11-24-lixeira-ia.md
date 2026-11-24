# Plano: Lixeira da IA (24/11/2026)

Ramo `feat/lixeira-ia` (HEAD 0c3a12d, integração v99.43.0). Pedido do Eduardo de 24/11 (11:14 e 11:38), proposta aprovada. Em paralelo: `feat/alertas-fotografo` (Zerar fase de teste) e `feat/treino-claro` (Configurações › IA automática).

## Objetivo
O servidor do ponto separa sozinho as fotos sem salvação (muito escura, muito estourada, tremida ou desfocada demais, sem ninguém) numa "Lixeira da IA", como a pasta de spam do e-mail. Admin e Supervisora conferem e devolvem com "Não é ruim"; nada é apagado.

## Corte para caber hoje

| Parte | O que entra | Quando |
|---|---|---|
| **A (hoje, obrigatória)** | Medida na chegada, tabela no servidor, tela Curadoria › Lixeira da IA (miniatura, motivo, fotógrafo, filtro por dia, "Não é ruim"), contagem no menu, régua contra o Treino, chave em IA automática com **Teste** valendo e **Ligado** visível mas travado ("chega na próxima versão") | programar até ~17h30, revisão, teste e segurança até ~21h; publica junto com a v99.43 das 22h30 ou amanhã antes das 9h |
| **B (amanhã, 25/11)** | Ligado de verdade: some do Checkout, da Venda manual e das bases de IA; recuperar devolve ao Checkout e reabre as bases da leva; aviso em Alertas | publicar até 27/11, antes da operação de 01/12 |

Por que esse corte não custa nada à operação: o Ligado só vale para os motivos que passam na régua (D5). Escura e estourada podem passar logo, com as medidas de luz que já existem; desfocada e sem ninguém precisam de alguns dias de marcações novas no Treino. Até lá, o Ligado não esconderia quase nada.

Tempo estimado: Parte A cerca de 4h30 de programação + 45 min de revisão + 1h de teste + 45 min de segurança (7h no total). Parte B cerca de 3h de programação + 2h entre revisão, teste e segurança.

## Escopo desta entrega (A)
- Agente: medida por foto no leitor de rostos, veredito, tabela `lixeira` no `treino.db`, rotas de leitura, de recuperar, da régua e da chave, `/status.lixeira`, LGPD e limpeza.
- App: tela nova `lixeira` (Curadoria, depois de Alertas), contagem no item do menu, bloco da chave em Configurações › IA automática, textos nas 5 línguas.
- Testes Python com agente real e Playwright em 390 e 1280 px.

## Fora do escopo
- Parte B inteira (lista acima).
- Botão "Ruim mesmo" (confirmar) na lixeira. Ver pontos para o Eduardo.
- Modo "lixeira" no Treino › Marcar (amostra só com as fotos da lixeira, para a régua andar mais rápido).
- Tela para mexer nos limites. Eles ficam no `config/lixeira` e só mudam pela rota (o Admin pede ao Ronaldo ou ao programador).
- Medir tremida/desfocada nas 10 mil fotos marcadas antes de hoje. Às 23h a zeragem leva os originais para `inbox/.arquivo/`; um script de linha de comando poderia medir de lá depois (só números no `treino.db`).
- Fila do fotógrafo (`ff_json`) e Minhas fotos continuam contando todas as fotos.
- Qualquer coisa na nuvem. Nada sai do servidor.

## Decisões assumidas
- **D1 Tela em Curadoria › Lixeira da IA**, logo depois de Alertas (definido pelo coordenador). Módulo `qualidade` (Ver = abrir a lista; Alterar = "Não é ruim"), sem módulo novo: não mexe em `AUTH_MODULOS`, em Permissões nem na matriz de perfis. A tela entra no menu do Admin (automático) e da Supervisora (perfil pronto e migração `migraLixeira24`, marca `mlx24`). O Validador tem a letra `qualidade` mas não ganha a tela no menu.
- **D2 Chave só do Admin** com dois estados: `medir` (na tela "Teste", padrão) e `ligada` ("Ligado"). Mora em `estado.db` `config/lixeira`, muda só por `POST /lixeira/config`, com o perfil Admin conferido pela sessão (403 `so_admin`), como o `/poses/config`. Rota própria, separada do `/treino/config`, para não mexer no `treino_cfg_gravar` que o Treino mais claro está mudando.
- **D3 O veredito é dado uma vez, na chegada**, e não muda depois, nem quando os limites mudam (limite novo vale para as fotos que chegam depois). Assim uma foto que o cliente está olhando nunca some por causa de uma regra nova.
- **D4 Falha aberta:** sem OpenCV, sem medida, erro de leitura, agente fora do ar ou primeira carga do Checkout ainda sem a lista = a foto aparece. A lixeira nunca esconde por engano de sistema. `ETERNA_LIXEIRA=0` desliga a medida e qualquer efeito.
- **D5 Ligado só vale para os motivos que passam na régua** (LX_CRIT: pelo menos 20 fotos marcadas no Treino que a regra mandaria para a lixeira, com 95% ou mais delas marcadas "Não pode"). A lista dos motivos que valem é congelada no momento em que o Admin liga (`valendo`, `desde`), como no "ligar de novo" do reconhecimento do ponto. Nenhum motivo passando = 409 `criterio`. Motivo que passa depois só vale quando o Admin liga de novo.
- **D6 Ligado não esconde foto vendida, de cortesia, nem foto que chegou antes do `desde`.** Bases de IA já escolhidas numa leva fechada não mudam (Parte B).
- **D7 Contagem no menu = fotos dos últimos 7 dias na lixeira, ainda não recuperadas** (decisão do Eduardo, 24/11; `LX_MENU_DIAS` no agente, `/status.lixeira.n7`). Some quando é zero. 7 dias em vez de 30 porque o número dos 30 dias só cresce e deixa de chamar atenção.
- **D8 "Não é ruim" não grava marcação no Treino.** "Não é ruim" não quer dizer "boa"; fica na própria lixeira (`rec_por`, `rec_em`) e conta como erro na régua. Sem desfazer: o erro de clicar só devolve uma foto ruim à venda.
- **D9 Dado no `treino.db`** (tabelas `lixeira` e `lixeira_log`): já vai para o backup, já tem o gancho da LGPD (`treino_lgpd`) e a zeragem das 23h não mexe nele.

## Como medir cada motivo (tudo no servidor, sem modelo novo)

Momento: no `leitor_loop`, logo depois da medida de luz, com a imagem que o leitor já decodificou (`IMREAD_REDUCED_COLOR_2`) e as caixas dos rostos que o `ler_rostos` já achou. Mesmo lugar e mesma regra da luz: depois de a foto entrar na matriz da selfie, na fila do fotógrafo e na sessão, então a selfie não espera.

Custo: 6 a 10 ms de processador por foto (um `resize`, dois `Laplacian`, a luz quando ela está desligada). Com 3.000 fotos por dia, menos de 30 s de processador no dia. Não usa a placa de vídeo, então não disputa com o recorte nem com as poses. Sem varredura de fotos antigas nesta entrega.

| Motivo | Medida | Limite inicial (conservador) | De onde vem |
|---|---|---|---|
| `escura` | luz do maior rosto (`r.med`); sem rosto, o quadro central (`q.med`, `q.baixo`) | com rosto: `r.med < 22`; sem rosto: `q.med < 18` e `q.baixo >= 60` | `luz_medir` (o alerta usa 50; o Ajuste automático clareia no máximo 1,4 vez, então 22 vira ~31, ainda sem salvação) |
| `estourada` | `r.p95`, `r.alto`; sem rosto `q.med`, `q.alto` | com rosto: `r.p95 >= 254` e `r.alto >= 40`; sem rosto: `q.med >= 235` e `q.alto >= 50` | `luz_medir` (o alerta usa 250 e 8%; branco estourado não volta com ajuste) |
| `desfocada` | variância do Laplaciano: `nq` = 60% centrais reduzidos a 1024 px no lado maior, cinza, `cv2.Laplacian(CV_32F, ksize=3).var()`; `nr` = maior rosto (caixa 10% maior) na mesma escala do quadro (24/11: a 160 px o valor do rosto borrado variava de 11 a 88 com o tamanho; `resize` INTER_LINEAR) | com rosto: `nr < 25` **e** `nq < 25`; sem rosto: `nq < 20` | novo, só OpenCV e numpy (já no servidor). Nas imagens do repositório, nítida dá 10.000 a 40.000; desfoque gaussiano de sigma 4 dá 15 a 40; sigma 8 dá 9 a 15. Exigir rosto e quadro juntos evita mandar para a lixeira o fundo desfocado de propósito |
| `sem_ninguem` | rostos achados pelo YuNet em qualquer tamanho (`nb`, antes do filtro `ROSTO_MIN`) e os de tamanho normal (`n`) | `nb == 0` | `ler_rostos` ganha o parâmetro opcional `brutos` (lista que recebe a contagem antes do filtro); nada muda para quem não passa o parâmetro |

Uma foto pode ter mais de um motivo; a tela mostra o primeiro nesta ordem: escura, estourada, desfocada, sem ninguém. Os limites ficam em `LX_LIM_PADRAO` e em `config/lixeira.lim` (faixas em `LX_FAIXAS`). Os números de desfoque são ponto de partida: as imagens do repositório são pequenas, e as fotos do estádio só dão o valor real a partir de amanhã. Por isso o padrão é Teste.

O CLIP do `cena.db` não entra: só temos a torre de imagem (sem texto), e ele foi treinado para reconhecer o ponto, não a qualidade. A contagem do `rostos.db` não entra porque o leitor já tem as caixas na mão; ler o banco depois seria mais lento e a zeragem de hoje leva o `rostos.db` para o arquivo.

## A régua contra o Treino

- Verdade = marcação do Treino (`rotulo.dados.qual.nivel`). Certa = `fraca` ou `nao_vai` ("Não pode"), com qualquer motivo. Errada = `boa` ou `ajustar` (foto que o ajuste salva não pode ir para a lixeira), ou foto recuperada com "Não é ruim". `duvida` e sem nível ficam de fora.
- **Servem como verdade?** Para medir a **precisão** (a lixeira pegou foto boa?), sim, e é o que importa aqui. Para medir o quanto a lixeira pega das ruins, não: "Não pode" inclui olho fechado, repetida, expressão, coisas que a lixeira nem tenta. Os motivos `escura`, `estourada`, `desfocada` e `semrosto` das marcações aparecem na tela da régua só como informação (quantas das certas tinham o mesmo motivo).
- Medida usada por foto: a linha da `lixeira` quando existe. Sem ela, para escura e estourada, a medida de luz do `treino.db` (`medida` tipo `luz`, só `src` original), que fica depois da zeragem e já cobre parte das 10 mil marcações. Desfocada e sem ninguém só contam com fotos medidas pela lixeira (de amanhã em diante).
- `lx_medida(lim)` calcula por motivo: `n` (marcadas que a regra mandaria), `certas`, `erradas`, `precisao`, `passa`, `falta`. Cache de 10 min; passando `lim`, sem cache.

## Mudanças por arquivo

### Passo 0 (antes de programar)
`git merge feat/treino-claro` na `feat/lixeira-ia` (HEAD 84702e1 traz `vIaAuto`, `trCfgPanel` e o item `ia-auto`). Sem isso não há onde pôr a chave. Se o Treino mais claro mudar de novo, repetir o merge no fim. Não juntar a `feat/alertas-fotografo` aqui: ela publica antes e entra pela integração.

### `agente/eterna-agente.py`
Bloco novo **"Lixeira da IA"** logo depois de `luz_medida` (antes de "Alertas do fotógrafo"), longe dos trechos mexidos pela zeragem.

Constantes: `LX_V = 1`, `LX_MOTIVOS = ("escura", "estourada", "desfocada", "sem_ninguem")`, `LX_LIM_PADRAO` (tabela acima), `LX_FAIXAS`, `LX_CRIT = {"n": 20, "precisao": 0.95}`, `LX_CFG_PADRAO = {"v": 1, "modo": "medir", "valendo": [], "desde": None, "por": None, "lim": LX_LIM_PADRAO}`, `LX_FILA_MAX = 20000`, `LX_GRAVA_SEG = 5`, `LX_ON = os.environ.get("ETERNA_LIXEIRA") != "0"`, `LX_ITENS_MAX = 3000`. Estado: `lx_lock`, `lx_novas` (OrderedDict pid -> linha), `lx_mem` (pid -> `{dia, mot, em, rec}` de hoje e ontem), `lx_st` (contadores), `_lx_med` (cache da régua), `_lx_cfg` (cache de 3 s).

Funções:
- `treino_db()`: cria `lixeira (pid text primary key, dia text, v integer, mot text, dados text, em text, rec_por text, rec_em text)` com índice em `dia`, e `lixeira_log (pid text, acao text, por text, em text)`.
- `lx_medir(img, caixas, n, nb, luz=None)` -> `dados` = `{v, nq, nr, n, nb, luz:{q:{med,alto,baixo,p95}, r:{med,p95,alto}|null}}`. Sem `luz`, chama `luz_medir(img, caixas)`. Números arredondados (1 casa). Função pura, testável com imagem gerada.
- `lx_classe(dados, lim)` -> lista de motivos na ordem fixa (vazia = ok). Pura.
- `lx_acrescenta(pid, dia, dados, ms)`: aplica `lx_classe` com os limites de agora, lidos só da memória (`lx_cfg_mem`; revisão 24/11: o leitor de rostos nunca abre o `estado.db` nem espera o `estado_lock`; o `lx_grava_loop` relê a chave), põe em `lx_novas`, em `lx_vistos` (já medida) e, com motivo, em `lx_mem`; acima de `LX_FILA_MAX` sai o mais antigo. `ms` = tempo da medida (`/status.lixeira.ms_med`).
- `lx_grava()` / `lx_grava_loop()`: como `luz_grava` (lote, só pid ainda em `lib`, apaga o que saiu pela LGPD no meio). `insert ... on conflict(pid) do nothing`: o veredito não muda (D3).
- `lx_mem_carregar()` na partida: linhas dos últimos 7 dias com pid em `lib` (`lx_mem` só com as que têm motivo; `lx_vistos` com todas).
- `lx_cfg()` / `lx_cfg_valida(j, base)` / `lx_cfg_gravar(body, sessao)`: formato fechado. `modo` só `medir` ou `ligada`. **Parte A:** `ligada` responde 409 `{"error": "em_breve"}`. **Parte B:** `ligada` chama `lx_medida()`, `valendo` = motivos com `passa`; vazio = 409 `{"error": "criterio", "falta": [...]}`; senão grava `valendo`, `desde` (agora), `por`. `lim` aceito só dentro de `LX_FAIXAS` (400 `lim`). Igual ao que já está = 200 `igual`. Cada gravação aceita entra em `lixeira_log` (`acao` `cfg_medir` ou `cfg_ligada`, pid vazio).
- `lx_lista(dia)`: linhas do dia com motivo e pid em `lib`, juntando `treino_fotos_dia(dia)["idx"]` (fotógrafo, código da leva, ordem) e o nível do Treino (`rotulo`), da mais nova para a mais antiga, até `LX_ITENS_MAX`; e `dias`: os últimos `RETENCAO_DIAS` com contagem (sem as recuperadas).
- `lx_recuperar(pid, quem)`: 404 `pid` se não está na lixeira com motivo; já recuperada = 200 `igual`; senão grava `rec_por`, `rec_em`, linha em `lixeira_log` (`recuperar`), atualiza `lx_mem`, sobe `lx_st["rev"]`. **Parte B:** se a leva de hoje está fechada, sem venda, com `ia` vazia e `ia_regra.motivo == "sem_gramado"`, volta para `cena_pend` com `motivo "cena_pendente"` (o `cena_completa` escolhe as bases de novo, nunca com base vendida).
- `lx_medida(lim=None)`: régua (seção acima).
- `lx_ids()`: **Parte B.** Com `ligada`: pids de hoje e ontem com motivo em `valendo`, `em >= desde`, sem `rec`. Com `medir`: `[]`.
- `lx_fora(pid)`: **Parte B.** Só memória: o pid estaria em `lx_ids()`. Usada no `_sess_ia_base_de` (devolve `"fora"`), então foto da lixeira nunca vira base de IA nem montagem.
- `lx_status()` -> `{v:1, on, modo, rev, hoje, valendo, hoje_fora}` só com números e códigos (`hoje` = de hoje na lixeira sem recuperar; `hoje_fora` = de hoje escondidas pelo Ligado, 0 em Teste).
- `lx_limpa()`: uma vez por madrugada (janela `LUZ_NOITE`, cede ao `_luz_ocupado()`), num laço próprio `lx_loop`. Apaga a linha da foto que não está mais na `lib` e foi medida há mais de 24 h (pela hora da medida, `em`), menos as recuperadas e as das fotos marcadas no Treino (são a régua). O `lixeira_log` fica.
- `treino_lgpd`: `"lixeira"` e `"lixeira_log"` entram na tupla das tabelas apagadas por pid; tira o pid de `lx_mem` e de `lx_novas`.
- `ler_rostos(..., brutos=None)`: se receber lista, acrescenta `len(f)` antes do filtro `ROSTO_MIN`. Avisar o Ronaldo (função dele).
- `leitor_loop`: depois do bloco da luz e antes de `img = img_l = fs_l = None`: `if img_l is not None and LX_ON: lx_acrescenta(pid, dia, lx_medir(img_l, caixas, len(fs_l), nb[0], v_l))` dentro de `try/except` próprio (erro = linha no console com o nome da exceção, sem caminho). `v_l` vem da luz quando ela mediu; senão `None`.
- `estado_gravar`: recusa `config/lixeira` (linha no console, como `config/poses`).
- `/status`: `lixeira=lx_` no mesmo `dict` de `treino`, `poses`, `luz`, calculado fora do `lock`.
- `main()`: duas threads ao lado das da luz: `lx_grava_loop` e `lx_loop`; `lx_mem_carregar()` antes delas.
- `ROTAS` (linhas novas no fim da tupla, longe das da zeragem e do treino):
  - `("GET", "/lixeira", "sessao", ("qualidade.r",))`
  - `("GET", "/lixeira/medida", "sessao", ("qualidade.r",))`
  - `("POST", "/lixeira/recuperar", "sessao", ("qualidade.u",))`
  - `("POST", "/lixeira/config", "sessao", ("configuracao.u",))`
  - **Parte B:** `("GET", "/lixeira/ids", "posto_ou_sessao", FOTOS_LER)`
- `H.lixeira_get(u, q)` / `H.lixeira_post(path)`: despachados ao lado de `/fotografos/...` no `do_GET` e no `do_POST`. Todos com `origem_local()`, `nostore`. GET: `dia` só `^\d{4}-\d{2}-\d{2}$` (padrão = hoje), 30 por minuto por pessoa (`/lixeira`), 10 (`/medida`), 120 (`/ids`, por posto ou pessoa). POST: corpo até 1 KB, JSON objeto, `pid_ok`, 120 por minuto por pessoa (`recuperar`), 6 (`config`); `config` confere `cadastro.preset == "admin"` e sem `assumido_por` (403 `so_admin`). O "ver como" já cai no 403 `so_ver` do `do_POST`. Console nunca imprime pid nem corpo.

### `index.html`
- `VIEWS`: `['lixeira','Lixeira da IA','fotos sem salvação','Curadoria']` logo depois de `alertas`.
- `MODULES`: `qualidade` passa a `['revisao','treino','lixeira']`. `MODULE_INFO.qualidade.u` acrescenta "e tirar foto da Lixeira da IA" (e o `modi_qualidade_u` nas 5 línguas).
- `VIEWFN.lixeira=vLixeira;` e `Object.assign(WRITE_OPS,{'lx-rec':'u','lx-cfg':'u'});Object.assign(ACT_MOD,{'lx-rec':'qualidade','lx-cfg':'configuracao'});` em **linhas próprias**, logo depois das definições (a zeragem acrescenta chaves na mesma linha do `WRITE_OPS` e do `ACT_MOD`; assim o merge não briga).
- `migraLixeira24(x)`: marca `mlx24`; só perfil pronto `supervisor` com `menu` em lista e sem `lixeira`: põe `lixeira` depois de `alertas`, `auditLog('migracao_lixeira24', ...)` e grava de volta (padrão do `migraTreino16`). Chamada ao lado do `migraTreino16`.
- Estado só na memória: `state.lx = {dia:null, mot:'todos', j:null, busy:false, err:null, med:null, voo:{}}`; o Sair zera. Parte B: `state.lixo = {modo:'medir', rev:-1, ids:new Set()}`.
- `agentPoll`: `a.lixeira = st.lixeira || null`. Parte B: se `st.lixeira.rev` mudou, `lxIdsPull()`.
- `vLixeira()`:
  - cabeçalho: eyebrow Curadoria, `h1` `viewLabel('lixeira')`, nota `lx_nota`; pílula do modo (`lx_modo_teste` ou `lx_modo_ligado` com os motivos que valem);
  - filtros: `<select data-act="lx-dia">` com os `dias` (dd/mm/aaaa e a contagem) e chips de motivo `data-act="lx-mot"` (Todos e os 4);
  - grade: `photoBtn({id:'ag_'+pid},{tag: motivo})` com `UP['ag_'+pid]` registrado como no `trCarregar`; embaixo, fotógrafo (nome por `P`/`keyByName`, senão `lx_sem_fot`), hora, selo do Treino quando houver (`lx_treino_pode`/`lx_treino_nao`), e o botão `data-act="lx-rec" data-pid` "Não é ruim" (só com `can('qualidade','u')`; no "ver como" o clique dá `vc_so_ver`; em voo fica `disabled`). Recuperada: sem botão, pílula `lx_recuperada` (quem e hora), no fim da lista;
  - lupa: `case 'zoom'` ganha o ramo `state.view==='lixeira'`, com `openGallery` sobre a lista filtrada;
  - régua: `<details>` com o que vem de `/lixeira/medida` (pedido só ao abrir): por motivo `lx_regua_linha` ou `lx_regua_falta`;
  - vazio `lx_vazio`; sem agente `lx_sem_servidor`; erro `lx_erro`.
- `case 'lx-rec'`: POST; 200 atualiza o item e a contagem; 200 `igual` só atualiza; 404 toast `lx_sumiu` e recarrega; outro erro `lx_erro`. Toast `lx_rec_ok_teste` (Teste) ou `lx_rec_ok` (Ligado).
- `lxPill()`: como o `postoPill`: `<span class="pill neutral" id="rail-lx" aria-label="lx_pill(n)">n</span>` no item `lixeira` quando `canView('lixeira')` e `st.lixeira.n7 > 0`. Atualizado no mesmo lugar em que o `postoPill` é refeito sem `render`.
- `lxCfgPanel()`: bloco no padrão `.tr-an-b` com título `lx_cfg_k`, nota `lx_cfg_nota`, chips Teste e Ligado (`data-act="lx-cfg" data-v="medir|ligada"`) só para `isAdminUser(state.user) && !state.assumido`; os outros veem a pílula. Parte A: Ligado `disabled` com `lx_cfg_em_breve`. Parte B: 409 `criterio` mostra o que falta em texto puro; ligado mostra `lx_cfg_valendo` e, quando outro motivo passou depois, o botão `lx_cfg_religar`. Chamado com **uma linha** no `vIaAuto`, depois do `trCfgPanel()`.
- **Parte B no Checkout:** `lxFora(id)` = Ligado, id `ag_`, pid em `state.lixo.ids` e fora de `vendidasTodas()`. Entra ao lado do `SIM.discarded` em `lojaFotos`, `lojaMaisIds`, `ljSessSemFoto`, `fiaBaseBoa`, `barrada` e `aiCands`. Não entra em `revSessions`, Qualidade, Minhas fotos nem Ajuste (a equipe continua vendo tudo).
- **Parte B em Alertas:** no `alerts()`, com `canView('lixeira')` e `hoje_fora > 0`, um item `warn` `al_lx_t`/`al_lx_d`.
- CSS: prefixo `lx-` (grade igual à da Qualidade; em 390 px duas colunas; botão com 44 px de altura).

### Testes
- `testes/lixeira_agente.py` (novo, no `rodar.sh`).
- `testes/lixeira.js` (novo, Playwright).
- `testes/seguranca_rotas_agente.py`: as rotas novas na matriz.
- `testes/permissoes.js` e regressões de menu: conferir com a tela nova.

### Documentação (documentador)
`docs/CONTEXTO-ETERNA.md` (item "Lixeira da IA (24/11)"), `docs/GUIA-DA-EQUIPE.md` (como usar), `VERSOES.md`.

## Contratos

`config/lixeira` (estado.db, só pela rota):
```json
{"v":1,"modo":"medir","valendo":[],"desde":null,"por":null,
 "lim":{"esc_rosto_med":22,"esc_quadro_med":18,"esc_quadro_baixo":60,
        "est_rosto_p95":254,"est_rosto_alto":40,"est_quadro_med":235,"est_quadro_alto":50,
        "nit_rosto":25,"nit_quadro_com_rosto":25,"nit_quadro":20,"sem_brutos":0}}
```

Linha `lixeira.dados`: `{"v":1,"nq":812.4,"nr":95.1,"n":2,"nb":3,"luz":{"q":{"med":120,"alto":1.2,"baixo":3.4,"p95":231},"r":{"med":131,"p95":214,"alto":0.4}}}`; `mot` = `"escura,desfocada"` ou null.

`GET /lixeira?dia=2026-11-25` -> 200
```json
{"v":1,"dia":"2026-11-25","modo":"medir","valendo":[],"n":3,"recuperadas":1,
 "itens":[{"pid":"…","mot":["desfocada"],"em":"2026-11-25T10:31:02","fotografo":"marcio","card":"LP…","ordem":4,
           "treino":"fraca","rec":null,"m":{"nq":12.1,"nr":6.3,"n":1,"nb":1}}],
 "dias":[{"dia":"2026-11-25","n":3}],"mais":false}
```
`rec` = `{"por":"<e-mail>","nome":"<nome>","em":"<ISO>"}`. 400 `dia`, 401, 403 `origem`/`sem_permissao`, 429.

`GET /lixeira/medida` -> `{"v":1,"lim":{…},"crit":{"n":20,"precisao":0.95},"motivos":{"escura":{"n":0,"certas":0,"erradas":0,"precisao":null,"passa":false,"falta":[{"k":"n","tem":0,"precisa":20}],"mesmo_motivo":0},…},"sem_medida":0,"recuperadas":0}`

`POST /lixeira/recuperar` `{"pid":"…"}` -> 200 `{"ok":true,"rec":{…}}` | 200 `{"ok":true,"igual":true}` | 400 `pid`/`corpo` | 404 `pid` | 403 `so_ver` | 429.

`POST /lixeira/config` `{"modo":"medir"|"ligada","lim":{…}?}` -> 200 `{"ok":true,"cfg":{…}}` | 200 `igual` | 400 `modo`/`lim` | 403 `so_admin` | 409 `em_breve` (A) | 409 `{"error":"criterio","falta":[…]}` (B) | 429.

`GET /lixeira/ids` (B) -> `{"v":1,"modo":"ligada","rev":12,"ids":["…"]}` (só pids; em Teste `ids: []`).

`/status.lixeira` -> `{"v":1,"on":true,"modo":"medir","rev":12,"hoje":4,"n7":9,"dias":7,"valendo":[],"hoje_fora":0,"ms_med":4.1}`.

Chaves do `EQ` (equipe, 5 línguas pt, en, es, fr, de), com o texto em português:
- `v_lixeira` "Lixeira da IA"; `vd_lixeira` "fotos sem salvação"
- `lx_nota` "Fotos que a IA achou sem salvação. Nada é apagado: a foto fica 30 dias na biblioteca, como as outras."
- `lx_modo_teste` "Em teste: estas fotos continuam à venda"; `lx_modo_ligado` (motivos) "Ligado: estas fotos não aparecem no Checkout (${motivos})"
- `lx_dia` "Dia"; `lx_mot_todos` "Todos os motivos"
- `lx_mot_escura` "Muito escura"; `lx_mot_estourada` "Muito estourada"; `lx_mot_desfocada` "Tremida ou desfocada"; `lx_mot_sem_ninguem` "Sem ninguém na foto"
- `lx_rec` "Não é ruim"; `lx_rec_ok_teste` "Anotado. A foto já estava à venda."; `lx_rec_ok` "A foto voltou para a venda."
- `lx_recuperada` (nome, hora) "Recuperada por ${nome} às ${hora}"
- `lx_sem_fot` "Sem fotógrafo"; `lx_treino_pode` "Treino: pode"; `lx_treino_nao` "Treino: não pode"
- `lx_vazio` "Nenhuma foto na lixeira neste dia."; `lx_sem_servidor` "A lixeira fica no servidor do ponto. Abra o Eterna pelo servidor para ver."; `lx_erro` "Não deu para falar com o servidor. Tente de novo."; `lx_sumiu` "Esta foto já saiu da lixeira."
- `lx_regua_h` "Quanto a IA acerta"; `lx_regua_linha` (n, pct) "${n} fotos marcadas no Treino, ${pct}% eram mesmo ruins"; `lx_regua_falta` (n) "Faltam ${n} fotos marcadas no Treino para medir"; `lx_regua_nota` "A conta usa as marcações do Treino e cada \"Não é ruim\"."
- `lx_pill` (n, dias) "${n} fotos na lixeira nos últimos ${dias} dias"
- `lx_cfg_k` "Lixeira da IA"; `lx_cfg_nota` "Em Teste, a IA só separa as fotos para conferir. Ligado, elas saem do Checkout."; `lx_cfg_teste` "Teste"; `lx_cfg_ligado` "Ligado"; `lx_cfg_em_breve` "O Ligado chega na próxima versão."; `lx_cfg_criterio` "Ainda nenhum motivo acerta o bastante para ligar."; `lx_cfg_valendo` (motivos) "Valendo para: ${motivos}"; `lx_cfg_religar` "Ligar de novo com a conta de agora"; `lx_cfg_so_admin` "Só o Admin muda a Lixeira da IA."
- `al_lx_t` (n) "${n} fotos saíram do Checkout hoje pela Lixeira da IA"; `al_lx_d` "Confira em Curadoria › Lixeira da IA. \"Não é ruim\" devolve a foto."
- `modi_qualidade_u` atualizado.

Sem texto novo no `I18N` do cliente: o Checkout não ganha nenhuma frase (a foto simplesmente não aparece).

## Critérios de aceite

Parte A
1. Foto gerada muito escura (rosto com mediana < 22) entra na lixeira com `escura`; a mesma foto 40% mais escura que o normal (rosto com mediana entre 40 e 60) **não** entra.
2. Foto com o rosto estourado (p95 254, 40% ou mais acima de 250) entra com `estourada`; foto clara mas com o rosto bom não entra.
3. Foto com desfoque gaussiano de sigma 8 (na escala de 1024 px) entra com `desfocada`; a mesma foto nítida não entra; foto com rosto nítido e fundo desfocado não entra.
4. Imagem com textura e sem rosto entra com `sem_ninguem`; com um rosto pequeno (abaixo de `ROSTO_MIN`) não entra.
5. A medida acontece no leitor de rostos, depois de `mat_acrescenta`, `ff_rosto_lido` e `sess_rostos_lidos`; erro na medida não derruba o leitor nem muda a leitura de rostos (teste injeta exceção em `lx_medir`).
6. O veredito não muda depois de gravado: limite novo vale só para foto nova.
7. `ETERNA_LIXEIRA=0`: nenhuma linha gravada, `/status.lixeira.on` false.
8. Curadoria › Lixeira da IA aparece depois de Alertas para o Admin e a Supervisora (perfil pronto, também a já gravada, pela migração). Não aparece para Validador, Fotógrafo, Atendimento e venda, Checkout.
9. O item do menu mostra o número de fotos dos últimos 7 dias na lixeira sem recuperar; sem nenhuma, não mostra nada; recuperar uma diminui o número sem recarregar a página.
10. A tela mostra miniatura, motivo, fotógrafo e hora; o filtro de dia lista os últimos 30 dias com contagem; os chips de motivo filtram; a lupa percorre a lista filtrada.
11. "Não é ruim" grava quem e quando no servidor (`lixeira` e `lixeira_log`), a foto fica como recuperada na tela, sai da contagem; segundo clique responde `igual`.
12. Em Teste, nenhuma foto sai do Checkout, das sessões, das bases de IA nem das galerias (o Checkout de uma leva com foto na lixeira mostra todas as fotos).
13. Supervisora em IA automática vê a chave e o estado, sem poder mudar; `POST /lixeira/config` dela dá 403 `so_admin`. Admin em "ver como" não grava (403 `so_ver` e toast). Admin troca para Teste e o `config/lixeira` muda; Ligado está travado (A) e o POST dá 409 `em_breve`.
14. `config/lixeira` mandado pela sincronização (`/ponto/docs`) é recusado.
15. A régua mostra, por motivo, as fotos marcadas no Treino, a precisão e o que falta; marcações `boa`/`ajustar` e recuperadas contam como erro; `duvida` fica fora.
16. Exclusão LGPD de uma foto da lixeira apaga as linhas dela em `lixeira` e `lixeira_log`; ela some da tela e da contagem.
17. Foto que saiu da biblioteca (zeragem ou fim dos 30 dias) some da tela e da contagem; a limpeza da madrugada apaga a linha, menos recuperada ou marcada no Treino.
18. Rotas: sem sessão 401; sem `qualidade.r` 403; POST sem `X-Eterna` ou de outra origem 403; `dia` inválido 400; corpo acima de 1 KB 413/400; pid fora do formato 400; acima do limite por minuto 429. Console e respostas de erro sem pid, caminho ou nome de cliente.
19. Textos da tela e da chave nas 5 línguas, sem chave crua, sem travessão; em 390 px sem rolagem lateral e botões com 44 px; em 1280 px a grade como a da Qualidade.
20. `testes/rodar.sh` passa inteiro.

Parte B
21. Admin liga com pelo menos um motivo passando: `valendo` e `desde` gravados; nenhum passando: 409 `criterio` com o que falta, na tela em texto.
22. Ligado: foto de hoje da lixeira, com motivo em `valendo` e chegada depois do `desde`, não aparece no Checkout (código e selfie), na Venda manual nem em "comprar mais"; leva com todas as fotos assim responde na hora como "sem foto".
23. Ligado: foto vendida ou de cortesia continua; foto que chegou antes do `desde` continua; motivo fora de `valendo` continua.
24. Ligado: foto da lixeira nunca vira base de IA nem montagem; bases já escolhidas não mudam.
25. "Não é ruim" no Ligado: a foto volta ao Checkout no próximo `/status` (até 10 s) sem recarregar; leva de hoje fechada como `sem_gramado` por causa dela volta a procurar bases.
26. Checkout sem resposta do `/lixeira/ids` (ou antes da primeira) mostra todas as fotos.
27. Alertas: com Ligado e fotos escondidas hoje, um aviso para Admin e Supervisora; em Teste, nenhum.

## Testes

`testes/lixeira_agente.py` (agente real em subprocesso, `ETERNA_MODO_TESTE=1`, HOME temporário, cookies por `_agente_sessao.py`):
- Parte de módulo (como `fot_luz.py`): `lx_medir`/`lx_classe` com imagens geradas e caixas de rosto informadas (critérios 1 a 4, 6); exceção injetada no `leitor_loop` (5).
- Parte de rotas: semeia `treino.db` (`rotulo`, `medida` luz, `lixeira`) e a biblioteca; critérios 7, 11, 13 a 18; Parte B: 21 a 25 pelo `/lixeira/ids` e pelo `_sess_ia_bases`.
- Uma foto real de rosto passando pelo leitor, se o OpenCV e o modelo estiverem no ambiente (senão o teste avisa e pula só esse caso).

`testes/lixeira.js` (Playwright, agente real, 390 e 1280 px): 8, 9, 10, 11, 12, 13 (tela), 19; Parte B: 22, 25, 26, 27 com `#loja` numa segunda página.

## Merge: o que este plano toca

| Arquivo | Trecho | Quem mais mexe perto | Como evitar briga |
|---|---|---|---|
| index.html | `VIEWS` (linha depois de `alertas`), `VIEWFN`, `vIaAuto` | treino-claro | Passo 0 (merge do treino-claro antes); `VIEWFN.lixeira=` em linha própria |
| index.html | `WRITE_OPS`, `ACT_MOD` | zeragem | `Object.assign` em linha própria |
| index.html | `MODULES`/`MODULE_INFO.qualidade`, migração ao lado do `migraTreino16`, `agentPoll` (uma linha), item do menu (`postoPill`), `alerts()`, `case 'zoom'`, `switch` de cliques (cases novos no fim) | treino-claro mexe no `agentPoll` e no `EQ` | chaves `lx_*` num bloco só, no fim do `EQ` |
| index.html | `lojaFotos`, `lojaMaisIds`, `ljSessSemFoto`, `fiaBaseBoa`, `aiCands` (Parte B) | ninguém hoje | |
| agente | bloco novo depois de `luz_medida`; `leitor_loop`; `ler_rostos` (parâmetro opcional); `treino_db` (2 tabelas); `treino_lgpd` (tupla); `estado_gravar`; `/status` (`lixeira=lx_`); `main()` (2 threads); fim da tupla `ROTAS`; despacho ao lado de `/fotografos` | zeragem: `ROTAS` (perto do treino), `/status` mínimo, `load_lib`, `cena_limpa`, `__main__` | rotas no **fim** da tupla; `lixeira=` no `dict` de baixo, não no `minimo` |
| testes | `rodar.sh` (dois nomes na lista), `seguranca_rotas_agente.py` | zeragem mexe nos dois | linhas novas separadas |

## Zeragem das 23h, LGPD e retenção
- A zeragem não toca o `treino.db` (D6 do plano dela), então as linhas da lixeira das fotos de teste ficam, mas a tela e a contagem só mostram foto que está na `lib`: depois da zeragem a lixeira aparece vazia, e a limpeza da madrugada apaga essas linhas (ficam as recuperadas e as marcadas, só números). O `config/lixeira` fica (a zeragem mantém o `doc`).
- O `lx_mem` nasce de novo no `os.execv` da zeragem.
- Publicar a Parte A junto com a v99.43 das 22h30 ou depois das 23h15. Nunca entre 22h30 e 23h15 fora do pacote: a publicação reinicia o agente e não pode cair no meio da zeragem.
- LGPD: pelo `treino_lgpd`, que o `lgpd_excluir` já chama. Foto da lixeira segue a retenção de 30 dias da biblioteca como qualquer outra; a lixeira nunca apaga arquivo.
- Nada sai do servidor: a tela usa o `/thumb/` de sempre; a régua e o `/status` só levam números.

## Riscos para o revisor de segurança
- **Esconder foto que vende (Parte B).** Falha aberta (D4), só motivos que passaram na régua (D5), só fotos depois do `desde`, nunca vendida ou cortesia (D6), veredito que não muda (D3), chave só do Admin pela sessão, registro de cada mudança no `lixeira_log`. Olhar se algum caminho do Checkout escapa do `lxFora` ou se algum esconde demais.
- **Rotas novas:** todas na `ROTAS` com módulo; `origem_local`, `X-Eterna`, limites por minuto e corpo pequeno; o `/lixeira/ids` entrega ao posto só pids, que o `/sessoes` já entrega. O Validador tem `qualidade.r/u` e consegue chamar `/lixeira` e `/lixeira/recuperar` pela API, embora não tenha a tela; o pior caso é devolver uma foto ruim à venda. Se o revisor preferir, a rota confere também o perfil (Admin ou Supervisor) como o `so_admin`.
- **Entrada maliciosa:** a lixeira não decodifica nada novo, trabalha na imagem que o leitor já abriu (com o limite de 40 MP). `dia` por regex; `pid_ok`; `lim` só dentro de `LX_FAIXAS`.
- **Privacidade:** a tabela guarda só números por pid; LGPD apaga; console sem pid; nada vai para a nuvem fora do backup do `treino.db`, que já sobe hoje.
- **Escala:** custo fixo por foto (6 a 10 ms de processador, sem placa de vídeo), gravação em lote, memória de 2 dias. Num venue com 20 mil fotos no dia são cerca de 3 min de processador espalhados. Para 100 venues, cada servidor cuida do seu; a régua é por venue (a câmera e a luz mudam de lugar para lugar). Sem internet funciona igual.
- **Concorrência:** `lx_lock` nunca dentro do `lock` nem do `sess_lock`; o `_sess_ia_base_de` só lê `lx_mem` (Parte B); `treino_lock` como a luz.

## Pontos para o Eduardo decidir
1. **Régua para ligar (D5):** o Ligado só vale para motivos que acertam 95% em pelo menos 20 fotos marcadas no Treino. Escura e estourada devem passar logo; desfocada e sem ninguém levam alguns dias. Quer um "ligar mesmo assim", como no reconhecimento do ponto?
2. **Botão "Ruim mesmo"** ao lado do "Não é ruim": faria a régua andar muito mais rápido (cada confirmação conta como acerto). Fica para a próxima ou entra amanhã com a Parte B?
3. **Contagem do menu** (decidido em 24/11: últimos 7 dias).
4. **Validador:** fica sem a tela (escolha deste plano) ou também vê e recupera?
5. **Limites iniciais de desfoque:** são estimativas; depois de 2 ou 3 dias em Teste, olhar a tela juntos e ajustar antes de ligar.
