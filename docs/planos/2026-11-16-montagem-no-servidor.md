# Plano final: montagem de IA feita no servidor (16/11/2026)

Base lida: commit `2191342` (index.html, agente, docs, servidor/). Tempos e tamanhos abaixo são alvo ou estimativa, não medida, salvo quando digo de onde vêm. O que foi entregue na E1 e na E2 e as diferenças em relação a este texto estão no fim ("E1: como ficou" e "E2: como ficou"). Desde 18/11 vale a regra do Eduardo sem exceção: com a chave em Ligada o navegador nunca monta (a "reserva no navegador" da E2 abaixo saiu).

## Achados que mudam o plano (ler antes)

1. **Já existe uma implementação antiga, nunca unida.** Ramos `feat/montagem-servidor` (até `aa6a336`, 11/11) e `origin/sim/v97-montagem`: `agente/eterna-montagem.py` (841 linhas, porta função por função do `fiaMontar`), `testes/montagem-paridade.js`, `testes/_montagem_paridade.py`, `testes/_montagem_filho_falso.py`, `testes/montagem_servidor_agente.py`, plano `docs/planos/2026-11-11-montagem-no-servidor.md`. Está 435 commits atrás de `2191342`: regras do 1950 antigo (com zoom e modo `largo`), Telão antigo (cantos de 2576×1840), sem `mirantedia`, sem `estreito`, sem `impAlto`, rotas na guarda antiga (sem a tabela `ROTAS`). **Recomendo aproveitar o motor e os testes de paridade como ponto de partida (copiar os arquivos, não fazer merge) e reescrever a integração no agente.** Não conferi se os testes daquele ramo passavam.
2. **Hoje não há base de IA de verdade.** `FUNCAO_DIA_ON` está desligado, `_sess_ia_regra` devolve `sem_funcao`, `x["ia"]` fica vazio e o Checkout cai no `lojaAIAntigo`: as 2 primeiras fotos com gente do cliente, de qualquer ponto. Vale para E1 a E3 até a fatia 2 entrar; pesa na E3 (ver risco).
3. **A nuvem não precisa mudar.** A Lambda (`servidor/galeria-nuvem/app.py`, `publicar`) aceita qualquer id no formato `^(ag_)?[0-9a-f]{6,40}$`, guarda só `id, sessao, direito, canal` e entrega `alta/<id>.jpg` e `vitrine/<id>.jpg` do S3. A montagem vendida entra como uma foto comum com um id próprio de 32 hex. Zero deploy de nuvem na E4.
4. **O navegador substitui o manifesto a cada republicação** (`/galerias/publicar` → `gal_mesclar(novo, velho)` parte das fotos que o navegador mandou). Item de montagem posto pelo servidor some se o servidor não o repuser a cada vez. Por isso quem põe a montagem na galeria é o agente, a partir da venda paga.
5. **`FUNDOS_PREVIA`/`FUNDOS_IMPRESSAO` do agente não têm o `telao`** (são o mapa do Photoroom). A montagem precisa de mapa próprio.
6. **Nomes já usados no agente:** `MONT_TERMINAIS_MAX`, `mont_recusadas`, `montagens_dia/validar/gravar`, rota `POST /ponto/montagens`, teste `testes/montagens_agente.py` (contagem de montagens vistas, selo). O código novo usa o prefixo `mtg_`/`MTG_` e as rotas `/montagem/` e `/montagens/pedir`.
7. **Pacotes: nada novo.** `servidor/linux/requisitos.txt` já fixa `numpy==2.5.4`, `opencv-python-headless==4.10.0.84`, `pillow==13.0.0` (e `scipy`, `pymatting`, `numba`, fora de uso aqui). O YuNet já está em `~/Eterna/modelos/face_detection_yunet_2023mar.onnx` (`MOD_DET`).
8. **Servidor:** `HOME=/srv/eterna`, então `~/Eterna/montagens` nasce no NVMe, onde só o usuário do serviço lê. `recortes` é link para o HD (`/srv/eterna-midia/recortes`, `MIDIA_PASTAS` do `instalar.sh`). O instalador PARA se a pasta já tiver arquivo no NVMe. Processador com só 6 núcleos visíveis, sem SMT (`2026-11-14-servidor-definitivo.md`).
9. **`/status` completo exige sessão ou posto pareado.** Por SSH o Eduardo só vê o mínimo. A conferência de leitura tem de sair do journal e do `ls`: o agente imprime linhas `montagem-srv:` no registro.
10. O agente já mede "rosto de frente" (`ler_rostos(detalhe=True)`: nariz a até `SESS_Q_FRONTAL` = 0,35 da distância entre os olhos). A E3 usa o mesmo critério.

## Perguntas

**Eduardo (4)**
1. Na galeria o cliente baixa a montagem no quadro inteiro, como viu no Checkout (proporção do fundo, até 3000 px), ou no corte 10×15? Recomendo quadro inteiro. Assumi isso.
2. E3: como hoje as bases são as 2 primeiras fotos com gente (achado 2), sem foto de frente o cliente fica só com o Mirante do Rio. Recomendo a E3 rodar primeiro em modo sombra (só conta quantas sessões perderiam o 1950 e o Telão) e você ligar depois de ver o número de um dia real. Assumi isso.
3. "Todos olhando para a câmera": de costas não há rosto para medir. Proposta: foto de frente = há pelo menos 1 rosto principal e todos os rostos principais achados estão de frente; se as duas servem, a com mais rostos de frente; empate, a primeira. Aceita a aproximação? Assumi sim.
4. Montagem vendida fica congelada: se o fundo ou a regra mudar depois, a galeria e a reimpressão daquela venda saem como foram vendidas. Isso troca a decisão 4 do plano dos três fundos (reimpressão do Telão saía com a imagem nova). Recomendo congelar a partir da E4. Assumi isso.

**Ronaldo (4)**
1. Antes de ligar: rodar o `instalar.sh` já com `montagens` em `MIDIA_PASTAS` (vai no commit da E1), para a pasta nascer no HD. Quanto há livre em `/srv/eterna-midia` e no NVMe? Enquanto isso não for feito a chave fica em "desligada" e nada é criado.
2. Sessões por dia e pico de fotos por minuto num dia cheio; `ETERNA_RECORTE_CONC=2` está ligado? Os outros 6 núcleos vão ser ligados na BIOS? (A montagem é processador.)
3. Nuvem: as orientações do repositório sobre de qual ramo publicar a nuvem não batem entre si (o `servidor/galeria-nuvem/README.md` manda clonar `idiomas-base`). Este plano não mexe na nuvem. Qual vale? E o bucket tem regra de expiração para `alta/` e `vitrine/`? (A montagem vendida entra lá.)
4. Pode deixar combinado `ETERNA_MONTAGEM=0` no `nuvem.env` como desligamento à força (precisa de `sudo` e reinício), e incluir `agente/eterna-montagem.py` na lista do `compila()` do vigia na próxima vez que rodar o instalador? (O vigia não se atualiza pelo git.)

## Objetivo

O servidor monta os 3 fundos assim que o recorte da base fica pronto, com o mesmo enquadramento do navegador, e guarda prévia e arquivo de impressão. Checkout e Posto passam a exibir e imprimir esse arquivo; a montagem comprada vai para a galeria como qualquer foto.

## Decisões assumidas (valem para todas as entregas)

- D1. M1 = paridade com o navegador. Borda, luz, recorte 2048 e matting ficam fora.
- D2. Processo à parte `agente/eterna-montagem.py`, só processador (numpy, Pillow, OpenCV), prioridade baixa do sistema, 1 montagem por vez. A placa fica com o recorte.
- D3. Regras em dois lugares (app e Python) com teste que compara as tabelas. Arquivo único carregado em tempo de execução foi descartado: o `index.html` é um arquivo só e precisa abrir sem rede.
- D4. O navegador continua sabendo montar. Nada é apagado. Janela antiga segue montando no canvas.
- D5. Chave única `config/montagem.modo`: `desligada` (padrão), `sombra` (monta e guarda, ninguém lê), `ligada` (Checkout e Posto leem). Mudar no Painel de controle vale em todos os postos no próximo `/status`. `ETERNA_MONTAGEM=0` no servidor vence tudo.
- D6. Chaves de item e de venda não mudam: `ai:<foto>|<fundo>`.
- D7. Base de cada fundo continua sendo escolhida como hoje (`lojaAIBase`, `lojaAIAntigo`, `FIA_BASE`) até a E3. Ponto de encaixe da fatia 2: uma função só no agente, `mtg_candidatas(x)`.
- D8. Sem banco para o que não foi vendido (é cache, refaz do recorte, como `recortes/`). Montagem vendida ganha registro no banco (E4), pela regra "dado de operação mora no servidor".

---

# E1. Motor em paridade, fila, disco, rotas, status, limpeza, LGPD (modo sombra)

**É a primeira entrega que sobe e já se testa na placa do servidor.** Com a chave em `sombra` nenhuma tela muda.

## Escopo
Motor Python, fila com prioridade, arquivos com versão, 2 rotas, `/status.montagem`, linhas no journal, limpeza, LGPD, chave no Painel. Fora: qualquer leitura pelo Checkout ou Posto (E2), escolha frente/livre (E3), galeria (E4).

## Mudanças por arquivo

### `agente/eterna-montagem.py` (novo; partir de `sim/v97-montagem:agente/eterna-montagem.py`)
Mantém do antigo: `medir`, `layout`, `rostos`, `_grupo`, `_cola`, `_cinza`, `ampliar`, `desenhar`, `homog`, `warp`, `telao`, `imprimir_corte`, `dentro`, `gravar_jpeg`, protocolo de linha JSON, `--regras`, `--teste`. Atualiza:
- `VERSAO = "m2"`.
- `REGRAS` igual ao `FIA_REGRAS` de hoje: `mirantedia` (com `estreito`), `arq1950` novo (`mono`, `meio/inteiro/estreito` com `alt .66`, sem `largo` e sem `zoom`), `telao` (com `estreito` corte `.47`), mais `campeao2`, `mirante`, `tunel`, `podio` e `PADRAO` (pedido antigo). `ESTREITO_DE = .70`, `ESTREITO_ATE = 1.20`.
- `estreito(R, m)`: porta do `fiaEstreito` (só com `trunc`, razão `box.w/box.h`, mistura linear, `larg = min(meio.larg, mix)`, devolve `estreito = 1 - t`).
- `layout`: ordem igual à do `fiaLayout`: `modo` por `trunc`; `meio` tenta `estreito`; `parte(r)` com a linha de corte descendo até `(bot + .15*h)` de todo rosto com `h >= 30%` do maior; `Math.round` do JS (usar `jsround`); ramo `largo` só se a regra tiver `largo` (hoje nenhuma ativa tem).
- `FUNDOS = {id: {previa, hi, mono, impAlto, telao:{w,h,quad}}}` para os ids com montagem local: `mirantedia`, `arq1950` (`img/bg-maracana1950.jpg`, `img/fundos-5k/maracana1950.jpg`, `mono`, `impAlto`), `telao` (`img/bg-telao-v2.jpg` nas duas, `w 4096, h 2924, quad [[884,181],[3485,525],[3582,1931],[848,1681]]`), `campeao2`, `mirante`, `tunel`, `podio`.
- `montar(...)`: prévia = fundo de prévia no tamanho natural (2400×1711; Telão 2576×1839) com o recorte reduzido a 2400 **em memória** pelo mesmo `thumbnail((2400,2400), LANCZOS)` do `rec_fazer` (é o mesmo PNG que o navegador recebe em `lado:2400`); impressão = fundo `hi` com o recorte de 3000, depois `imprimir_corte`.
- `imprimir_corte(img, fundo)`: 1844×1240 (deitado) ou 1240×1844; `k = max(ow/W, oh/H)`; origem x no centro; origem y: Telão `(H-sh)/2`, `impAlto` `0`, os outros `H-sh`.
- P&B: pessoa com contraste 1,10 em torno de 127,5 antes de colar; depois o quadro inteiro pelos pesos 0,2126/0,7152/0,0722. Nunca `convert("L")`.
- Telão: conteúdo desentortado em meia resolução, pessoa pelo `layout(m,'telao',cw,ch)`, filtros na ordem brilho 1,04, contraste 1,05, saturação 1,06, desfoque `max(.3, cw/2400)`, volta por `warp` com a regra dos 2,5 px.
- `frente(rostos_com_pontos, pessoas)`: devolve `{rostos, frontais, ok}` com o critério do agente (nariz a até 0,35 da distância entre os olhos; rosto principal = largura >= 50% do maior). Na E1 só mede e devolve; ninguém decide com isso.
- Guarda em memória os 2 últimos recortes abertos com a medida e os rostos (os 3 fundos da mesma base não reabrem o PNG) e até 3 fundos.
- `cv2.setNumThreads(2)`, `os.nice(10)`, `MAX_PIXELS` 40 MP, vigia do pai como no recorte.

### `agente/eterna-agente.py`
- Constantes: `MONTAGENS = ~/Eterna/montagens`; `MTG_VERSAO = "m2"`; `MTG_FILHO`; `MTG_DIAS = 2`; `MTG_TETO_GB` (`ETERNA_MONTAGENS_GB`, 20); piso de disco = `REC_PISO_GB`; `MTG_FILA_MAX = 500`; `MTG_P0_MAX = 40`; `MTG_TAXA = 240` por minuto por IP; `MTG_ESPERA_FILHO = 60`; prioridades `MTG_P_PEDIDO=0`, `MTG_P_VIVO=1`, `MTG_P_RESERVA=2`, `MTG_P_IMPRESSAO=3`, `MTG_P_REFAZER=4`; `MTG_FUNDOS` (mesmo conteúdo de `FUNDOS` do filho, caminhos relativos do app); `_re_mtg = ^(ag_)?([0-9a-f]{6,40})/([a-z0-9]{2,40})\.jpg$`.
- `mtg_cfg()`: lê `config/montagem` do `estado.db` com cache de 3 s (padrão do `ia_cfg`); `ETERNA_MONTAGEM=0` força `desligada`. `montagem_valida(j)` no `estado_gravar`: só `{"modo": "desligada|sombra|ligada", "por", "em"}`; `DOC_COL_MOD`: módulo `configuracao`.
- `mtg_fundo_arquivo(fundo, hi)`: caminho no `app-cache` (`app_disco(rel)`), baixando com `app_baixar` se faltar; sem o arquivo, erro `fundo`.
- `mtg_versao(fundo)`: 8 hex de `sha256(MTG_VERSAO | REC_VERSAO | json da regra e da geometria do fundo | sha256 dos arquivos de prévia e de impressão)`. O SHA do arquivo fica em cache por (tamanho, mtime).
- `mtg_arquivo(pid, fundo, tipo)`: `MONTAGENS/<pid>/<fundo>-<versao>-<p|i>.jpg`. `mtg_info(pid)`: `MONTAGENS/<pid>/info-<MTG_VERSAO>.json`.
- `mtg_candidatas(x)`: bases da sessão. Hoje: `x["ia"]` se houver; senão as 2 primeiras fotos pela hora do clique que não deram `sem_pessoa` (a mesma escolha do `rec_pre_escolha`). **É aqui que a fatia 2 encaixa.**
- `mtg_preferida(fundo, i)`: índice de `FIA_BASE` (cópia `MTG_BASE` no agente, conferida por teste).
- `mtg_enfileirar(pid, fundo, tipos, prio)`: um trabalho por `(pid, fundo)`; pedido repetido só sobe a prioridade e soma tipos; recusa com fila cheia; abaixo do piso de disco só passa prioridade 0. `mtg_trabalho()`: 1 trabalhador; fala com o filho; no fim confere se a foto ainda está na biblioteca (LGPD no meio: apaga). Nunca com `lock`, `sess_lock` ou `rec_lock` na mão.
- Gatilhos: (a) no `finally` do `rec_trabalho`, recorte sem erro chama `mtg_recorte_pronto(pid)` (só marca numa fila leve; quem olha a sessão é o `mtg_loop`, fora dos locks do recorte); (b) `mtg_loop` a cada 2 s: para as sessões de hoje, `mtg_candidatas`, e enfileira o que falta da versão atual: prévias preferidas prio 1, prévias da outra base prio 2, impressão das preferidas prio 3; na partida e em troca de versão, prio 4; (c) `POST /montagens/pedir`, prio 0.
- `rec_pre_loop` (ramo da placa): as candidatas de `rec_pre_escolha` entram antes das outras fotos na lista `falta` (hoje é só "mais nova primeiro"). Mudança de ordenação, nada mais.
- Filho: `_mtg_abrir`, `_mtg_filho_leitor`, `mtg_filho_montar`, reabertura com espera crescente e parada na 3ª morte por memória, lista de processos em `ponto/montagem-filhos.json`, ambiente por `rec_env()`, `python -I`. Copiar o padrão do recorte, não inventar outro.
- `limpar_montagens()` de hora em hora no `galeria_loop`: apaga pasta de foto que saiu da biblioteca, arquivo de versão antiga, arquivo com mais de `MTG_DIAS`, `.tmp` com mais de 1 h e, acima do teto, os mais antigos. Não toca em `vendidas/` (E4).
- LGPD: `sess_esquecer(pid)` e `lgpd_excluir` chamam `mtg_cancelar(pid)` e `mtg_apagar(pid)` (apaga `MONTAGENS/<pid>/` sem seguir link).
- `mtg_status()` no `/status` (fora do `lock`, como `rec_status`).
- Journal, sempre com o prefixo `  montagem-srv:` e nunca com pid, nome ou caminho de foto: na partida (`modo`, `versao m2`, fundos e a versão de cada um, pasta, `no_hd=sim|nao`); ao abrir o filho (`processo aberto em N ms`); a cada 5 min com movimento (`feitas`, `fila`, `erros`, `ms_medio`, `atraso p50/p90`, `disco`); em pausa por disco; em morte do filho.
- `ROTAS`: `("GET", "/montagem/", "posto_ou_sessao", VENDER)` e `("POST", "/montagens/pedir", "posto_ou_sessao", VENDER)`; `/montagens/pedir` entra em `rota_privada`.

### `index.html` (mínimo na E1)
- `state.agent.montagem = st.montagem || null` na leitura do `/status`.
- `fiaPanel`: linha "Montagem no servidor" com modo, fila, feitas, média, atraso p50/p90, disco e aviso de pausa; seletor de 3 posições `data-act="mtg-modo"` (`WRITE_OPS`, `ACT_MOD` com `configuracao`), que grava `config/montagem` e chama `auditLog('montagem_modo')`. Textos de equipe (`TE`, 5 línguas): `mtg_h`, `mtg_desligada`, `mtg_sombra`, `mtg_ligada`, `mtg_linha`, `mtg_pausa_disco`, `mtg_parada`.
- `Object.assign(window.ETERNA, {FIA_PADRAO, IMP_PX})` se ainda não estiverem expostos (o teste de tabela precisa).

### `servidor/linux/instalar.sh`
- `MIDIA_PASTAS` ganha `montagens`. Só isso.

## Contratos

Filho:
```
-> {"pronto":true,"versao":"m2","carga_ms":N}
<- {"id":"<n>","op":"montar","recorte":"<recortes/pid.png>","fundo":"telao","previa_fundo":"<arq>","hi_fundo":"<arq>","yunet":"<arq|null>","p":"<destino|null>","i":"<destino|null>","f":"<destino|null>"}
-> {"id":"<n>","ok":true,"w":2576,"h":1839,"layout":{"modo":"meio","estreito":1,"corteFinal":0.47,"rostos":2},"frente":{"rostos":2,"frontais":2,"ok":true},"bytes":{"p":N,"i":N},"ms":{"abrir":N,"medir":N,"rostos":N,"montar":N,"gravar":N,"total":N},"pico_mb":N}
-> {"id":"<n>","ok":false,"erro":"sem_pessoa|fundo|recorte|imagem_grande|caminho_recusado|interno"}
```
Origem só dentro de `--recortes` e `--fundos`; destino só dentro de `--montagens`, nome `^[a-z0-9]{2,40}-[0-9a-f]{8}-[pif]\.jpg$`, gravação por `mkstemp` + `os.replace`, modo 600; pasta da foto 750.

Disco: `~/Eterna/montagens/<pid>/<fundo>-<versao>-p.jpg` (JPEG 90, tamanho do fundo de prévia) e `-i.jpg` (1844×1240, JPEG 92). `info-m2.json`: `{"v":"m2","frente":{...},"trunc":true,"q":0.6,"em":<epoch>}`.

Rotas:
```
POST /montagens/pedir   (X-Eterna: 1, corpo até 2 KB)
  {"pids":["ag_<hex>", até 4],"fundos":["mirantedia","arq1950","telao"] (até 5),"tipos":["p"] | ["p","i"]}
  200 {"ok":true,"v":1,"itens":[{"pid":"ag_..","fundo":"telao","versao":"1a2b3c4d","estado":"pronta|fila|erro|sem_pessoa","p":true,"i":false,"w":2576,"h":1839}]}
  400 campo fora do contrato · 404 foto desconhecida · 429 limite · 503 {"error":"montagem_desligada"|"montagem_parada"}
GET /montagem/<pid>/<fundo>.jpg?t=p|i[&v=<versao>]
  200 image/jpeg (Cache-Control: private, no-store; X-Content-Type-Options: nosniff; cabeçalho X-Eterna-Montagem: <versao>)
  202 {"estado":"fila"} (e sobe a prioridade para 0) · 404 · 409 {"error":"versao"} se `v` não é a atual · 503
```
`/status.montagem`: `{"v":1,"modo":"sombra","ok":true,"motivo":null,"versao":"m2","fundos":{"mirantedia":"1a2b3c4d","arq1950":"...","telao":"..."},"filho":{"vivo":true,"reinicios":0},"parado":null,"fila":N,"feitas":N,"erros":N,"ms_medio":N,"atraso_p50_s":N,"atraso_p90_s":N,"guardado_gb":N,"livre_gb":N,"piso_gb":10,"pausa_disco":false,"no_hd":true}`. Atraso = da chegada da foto (`meta.u`) até as prévias preferidas dela prontas.

## Critérios de aceite (E1)
1. Com `modo=desligada` (padrão): nenhuma pasta `montagens` é criada, nenhum processo de montagem abre, `/status.montagem.modo` é `desligada`, as duas rotas respondem 503.
2. Com `sombra`: sessão nova com 2 fotos com gente → em `MONTAGENS/<pid>/` aparecem as 3 prévias preferidas (uma por fundo, base por `FIA_BASE`), depois as 3 da outra base, depois os 3 `-i.jpg` das preferidas. Nenhuma tela do Checkout ou do Posto muda (contador `ETERNA.fiaMontagens` não existe ainda; conferir que `compose` continua chamando `fiaMontar`).
3. Tabelas: `eterna-montagem.py --regras` é igual, campo a campo, a `ETERNA.FIA_REGRAS`, `FIA_PADRAO`, `FIA_ESTREITO_DE/ATE`, `FIA_BASE`, `IMP_PX` e a `file`, `fileHi`, `mono`, `impAlto`, `telao` de `DATA.backgrounds`. Trocar um número de um lado quebra o `rodar.sh`.
4. Paridade de layout (P1): com o mesmo `m` e a mesma lista de rostos vindos do navegador, `layout` do Python devolve `modo`, `estreito`, `corteFinal`, `src`, `dst`, `s` com diferença até 1e-6, nos 8 recortes sintéticos × 7 fundos.
5. Paridade de medida (P2): `medir` do Python contra `fiaMedir` no mesmo PNG: `box` com até 1 px de diferença na escala de 600, `trunc` igual, mesmo `modo` em todos os casos.
6. Paridade de imagem (P3), prévia e impressão, comparadas sem JPEG no meio, nos 8 recortes × 3 fundos ativos: caixa da pessoa (diferença contra o fundo puro) com até 3 px de desvio em cada lado na prévia; erro médio absoluto por canal até 2,0; no máximo 1,5% dos pontos com diferença acima de 16.
7. Casos sintéticos obrigatórios: casal estreito 644×1080; pessoa de braços abertos 1492×1016; grupo 2156×1468; razão 0,85 e 0,95 (faixa entre os dois casos); corpo inteiro (não encosta embaixo); braço erguido; foto em pé (quadro 1600×2400); criança baixa com rosto na linha de corte (rostos por lista fixa nos dois lados).
8. Maracanã 1950: no arquivo decodificado, `|R-G|` e `|G-B|` até 2 em todos os pontos, prévia e impressão; nenhum ponto do recorte acima de 32% da altura, nem com braço erguido; na impressão o título está inteiro (corte tira de baixo: linha 0 da impressão = linha 0 do quadro).
9. Telão: fora do quadrilátero (dilatado em 3 px) a montagem é igual ao arquivo do fundo (até 2 por canal contra o navegador; zero contra o próprio arquivo aberto no Python); nada novo sobre a moldura; casal estreito com 55% a 65% da largura da tela; impressão cortada no meio da altura.
10. Mirante do Rio: impressão presa embaixo; a faixa do Cristo do teste `tres-fundos.js` continua dentro do corte.
11. Proteção de rosto: com rosto na linha de corte, `corteFinal` é maior que o `corte` da regra e a linha fica abaixo de `bot + 15%` do rosto, igual ao navegador. Sem o modelo YuNet: monta sem rostos e registra `rostos: null`.
12. Halo: em fundo branco de teste, nenhum ponto da borda da pessoa mais escuro que a pessoa e que o fundo.
13. Versão: mudar um número de regra, o arquivo do fundo ou `REC_VERSAO` muda os 8 hex; o arquivo antigo deixa de ser servido (404 ou 409 com `v` antigo), as bases de hoje voltam para a fila com prioridade 4 e a limpeza apaga os antigos.
14. Prioridade: com 30 trabalhos de prioridade 3 e 4 na fila, um `POST /montagens/pedir` é atendido antes de todos os que ainda não foram pegos.
15. Rotas: sem posto pareado e sem sessão → 404; sessão sem módulo de venda → 403; POST sem `X-Eterna: 1` → recusado; `pid` ou `fundo` fora do formato, `..`, fundo fora de `MTG_FUNDOS`, `t` diferente de `p|i` → 404 sem tocar o disco; foto que não está na biblioteca → 404; acima de 240 por minuto → 429. `GET` entrega `no-store` e `nosniff`.
16. Filho morto no meio: o trabalho dá erro, o filho reabre com espera crescente, `/status.montagem.ok=false` com motivo; recorte, FTP e venda seguem. Nenhum `.tmp` fica depois de 1 h.
17. Disco: abaixo do piso, só prioridade 0 monta e `pausa_disco=true`; acima do teto, os mais antigos saem; `recortes/` não é tocado.
18. LGPD: apagar a foto apaga `MONTAGENS/<pid>/` e cancela o trabalho na fila ou em andamento; nenhum arquivo dela reaparece.
19. Carga (`agente/teste-carga.py`, 200 fotos em 5 min, recorte falso): o atraso de chegada na Fila do fotógrafo com `sombra` fica até 10% acima do medido com `desligada`.
20. Reinício do agente com `sombra`: não refaz o que já existe na versão atual; processo órfão de montagem é encerrado.
21. `bash testes/rodar.sh` com `FALHAS: 0` (quem roda é o testador).

## Testes a criar
- `testes/montagem-paridade.js` + `testes/_montagem_paridade.py` (do ramo antigo, com os casos e limites acima): critérios 3 a 12. Recortes sintéticos desenhados no teste, com borda de alfa suave e degradê de cor; nunca foto de cliente.
- `testes/montagem_servidor_agente.py` + `testes/_montagem_filho_falso.py`: critérios 1, 2, 13 a 18, 20.
- `testes/seguranca_rotas_agente.py`: as duas rotas na matriz (critério 15).
- `testes/app_offline_agente.py`: `MTG_FUNDOS` e `MTG_BASE` contra o `index.html`.
- `testes/rodar.sh`: `py_compile` do `eterna-montagem.py` e os testes novos.
- `agente/medir-recorte.py --montagem`: mede tempo e memória com recorte sintético (para o testador, fora do servidor).

## Depende do Ronaldo
Pergunta 1 (pasta no HD antes de ligar). Sem pacote novo, sem modelo novo, sem `sudo` para o deploy em si.

## Riscos (E1)
- **Rota que entrega foto de visitante:** mesma classe do `/recorte/` (posto ou sessão com módulo de venda), nome por expressão regular, `realpath`, limite por IP, sem cache no aparelho. O revisor confere também que a rota não vira oráculo de "esta foto existe" para quem não tem posto (404 igual em todos os casos).
- **Disco:** estimativa minha de 0,5 a 0,9 MB por prévia e 0,6 a 0,8 MB por impressão (a segunda faixa vem da medida do plano de 11/11), cerca de 6 MB por sessão. Não sei quantas sessões há por dia (pergunta 2). Teto de 20 GB e prazo de 2 dias.
- **Concorrência com a chegada de fotos:** 6 núcleos, recorte com `cpu_count - 1` linhas no ONNX, rostos no processador. Montagem em processo próprio, `nice 10`, 2 linhas. Critério 19 mede.
- **Dois lugares com a regra:** critério 3.
- **Pasta no NVMe por engano:** `no_hd=false` no status e no journal; o Painel avisa.
- **Janela antiga:** não muda nada; ela nem lê `montagem` do `/status`.
- **Escala (100 venues):** fundos e regras são tabela fixa no código, por venue ficam para o plano de white label; o motor é o mesmo.
- **Paridade com foto real:** só se vê na E2 (comparador), porque foto de cliente não sai do servidor.

## Conferência no servidor (só leitura; VPN ligada)
```bash
ssh srv-viva-maracana 'curl -s http://127.0.0.1:8797/'
```
O `commit` tem de ser o da E1 e `recusados` não pode trazê-lo.
```bash
ssh srv-viva-maracana '/opt/eterna/venv/bin/python -I -c "import cv2,numpy,PIL;print(cv2.__version__,numpy.__version__,PIL.__version__)"; ls -l /srv/eterna/Eterna/modelos/face_detection_yunet_2023mar.onnx 2>&1 | tail -1'
```
Tem de mostrar `4.10.0 2.5.4 13.0.0`. A segunda linha pode dar "Permission denied" (a pasta é só do serviço); nesse caso vale a linha do journal abaixo.
```bash
ssh srv-viva-maracana 'ls -ld /srv/eterna-midia/montagens; df -h /srv/eterna-midia | tail -1'
```
Depois do instalador do Ronaldo: a pasta existe, dona `eterna`. Antes disso não existe (certo com a chave desligada).
```bash
ssh srv-viva-maracana 'journalctl -u eterna --no-pager --since "-15 min" | grep "montagem-srv" | tail -20'
```
Com `sombra`: uma linha de partida com `modo=sombra versao=m2 no_hd=sim` e os 3 fundos; `processo aberto`; depois de fotos de teste, linha com `feitas` maior que zero, `erros=0`, `ms_medio` e `atraso p50/p90`.
```bash
ssh srv-viva-maracana 'ls /srv/eterna-midia/montagens | wc -l; d=$(ls -t /srv/eterna-midia/montagens | head -1); ls -l /srv/eterna-midia/montagens/$d; du -sh /srv/eterna-midia/montagens'
```
Na pasta mais nova: `mirantedia-xxxxxxxx-p.jpg`, `arq1950-…-p.jpg`, `telao-…-p.jpg` (e os `-i.jpg`), todos `-rw-------`, de 0,3 a 1,5 MB. Não conferi se o login do TI lista essa pasta; se negar, fica só o journal.
```bash
ssh srv-viva-maracana 'ps -u eterna -o pid,ni,rss,etime,args | grep -E "eterna-(montagem|recorte)" | grep -v grep; nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader; uptime'
```
Um processo `eterna-montagem.py` com `NI` 10 e RSS abaixo de 1,5 GB; memória da placa perto dos 1,9 GB de antes (a montagem não usa a placa); carga abaixo de 6.

## Tempo-alvo "foto chegou → 3 montagens prontas"
Alvo: **p50 até 8 s e p90 até 15 s** da chegada da foto no agente até as 3 prévias preferidas em disco, em fluxo normal; em rajada (200 fotos em 5 min), p90 até 45 s. Conta: até 3 s de espera do `rec_pre_loop`, cerca de 1 s de recorte na placa (número dos documentos), e 3 montagens que estimo em 0,3 a 0,8 s cada no processador (a medir; o plano de 11/11 mediu 1,3 a 1,6 s com fundo de 5000 px em 2 núcleos). Os 3 arquivos de impressão: p90 até 30 s. Quem mostra o número real é `atraso_p50_s`/`atraso_p90_s` no journal. Se o p90 passar de 15 s com folga de processador, o primeiro ajuste é o `sleep(3)` do `rec_pre_loop`, não o motor.

---

# E2. Checkout, Venda manual e Posto exibem e imprimem a montagem do servidor (sem montar no navegador)

Regra do Eduardo (18/11): com a chave em Ligada o navegador nunca recorta nem monta. A "reserva no navegador" do texto original saiu; o que foi feito está em "E2: como ficou", no fim.

## Escopo
`compose`, `compHi`, `iaAquecer`/`ljPrepara`, `printMontar`, marcação dos itens de IA (Checkout e Venda manual). Fora: comparador para o Admin, escolha frente/livre, galeria, apagar o canvas.

## Como decide (`index.html`)
- `mtgSrv()`: o último modo do servidor que o aparelho conhece (`mtgConhecido`: o `/status` de agora ou, com o agente fora, o guardado no aparelho) é `ligada`, com `montagem.v >= 1` e `montagem.imprime`. Um `/status` que falha não muda o modo.
- `mtgCanvasOk()`: o navegador só monta no canvas com o modo lido de um `/status` nesta página (`MTG_MEM`, gravado só no `mtgVisto`) e diferente de Ligada. Até o primeiro `/status` da página, nada é montado e nenhum `POST /recorte` sai (`fiaRecorte` confere antes do cache de recortes). Agente sem `montagem` (antigo) ou com a chave Desligada ou Sombra: canvas.
- `compose` → `mtgCompose` (prévia do servidor, `blob:`); `compHi` → `mtgHi` (10x15 do servidor, `data:`, a versão da prévia). Tentativas com espera crescente: 700 ms dobrando até 8 s, com acaso. 404: o item sai da venda. 422 (falhou no servidor): estado final, sai da venda. Depois de `MTG_FALHAS_MAX` (12) tentativas seguidas sem a montagem, com o agente respondendo, o item sai da venda (`fiaFalhou`); na tela da equipe com "Montagem indisponível", na do cliente sem texto da equipe (`aiIndisp` na língua do cliente quando o servidor diz erro).
- Item de IA que ainda não está pronto (`fiaPronta`) não pode ser marcado com a chave ligada: Checkout (`kiosk-tog` e Quero) com o aviso `aiAguarde` (5 línguas e chinês) e Venda manual (`fila-bg`) com `mtg_aguarde`.
- Troca da chave (no `/status` ou no aparelho de quem trocou, `mtgModoSalva`): `mtgTroca` (no `agentPoll`, depois de todas as atribuições do `/status`) revoga os `blob:`, sobe a geração (`MTG_GER`: trabalho em voo não vale mais), limpa `COMP`, `COMPOK`, `COMPURL` e os recortes do canvas (`RECS`), menos as montagens do Photoroom (`pr|`, já pagas), e refaz a tela. Montagem de canvas antiga não volta a valer em Ligada.
- `ETERNA.fiaMontagens = {servidor, canvas}`: o canvas só conta montagem feita de verdade.

## No agente
- `/status.montagem` com `imprime`, `montaveis` e `ativos`. `GET /montagem/…?t=i` de montagem que só tem `-p` gera a impressão com prioridade 0.
- Erro recente da versão atual no motor (`mtg_ruins`, até `MTG_ERRO_RECENTE` = 30 s, a mesma janela no `GET /montagem/` e no `POST /montagens/pedir`): o `GET` responde 422 `{"estado":"erro"}` e o `pedir` `erro`, sem pôr na fila. Com trabalho já na fila para aquela foto e fundo, 202. Passada a janela, tenta de novo (um erro passageiro não segura a impressão).
- A impressão (`t=i`, e o `pedir` com `["p","i"]`) tem a conta dela no limite por minuto: as prévias não a barram. O `pedir` confere também uma conta geral por minuto antes de ler o corpo.
- Montagem nova só de base (`mtg_base_ok`): foto de leva carregada só se é base; foto fora das levas carregadas só com a montagem vendida naquele fundo (venda paga no `vendas.db`, a reimpressão). Senão `nao_base`. As vendas pagas são lidas por uma conexão só de leitura, sem o `ev_lock` (o WAL deixa ler junto com a gravação), e relidas só quando o banco muda.
- Fundo que a origem não entregou: espera crescente de 30 s até 5 min antes de baixar de novo.
- Processo de montagem que parou ou passou do tempo numa foto: a foto vai para `mtg_ruins` com `MTG_ERRO_DE_NOVO` (10 min; o `GET` responde 422 nesse prazo), o processo reabre em `MTG_ERRO_FOTO_SEG` (5 s) e os trabalhos das outras fotos esperam a reabertura em vez de falhar. Uma morte repetida na mesma foto conta uma vez só para a parada.
- Piso duro de disco: abaixo de metade do `REC_PISO_GB` nada é montado, nem o pedido do Checkout (`GET` e `pedir` respondem 503 `disco`).
- Vendas pagas para a reimpressão: só as dos últimos `MTG_PAGAS_DIAS` (o prazo da biblioteca, pelo índice do dia), sem as canceladas, uma leitura por vez (quem chega durante a leitura usa o último valor). Sem como ler: 503 `vendas_indisponivel` (o item não sai da venda).

## Critérios de aceite (E2)
1. Ligada, montagens prontas: o Checkout mostra as 4 sem "Preparando", `fiaMontagens.canvas === 0`, nenhum `POST /recorte`.
2. Montagem na fila (202): aparece quando o servidor termina.
3. Servidor fora (503) ou `/status` falhando com Ligada: prévia em "Preparando", impressão da foto de IA falha (as outras saem), canvas 0, nenhum `POST /recorte`. Antes do primeiro `/status`: o mesmo.
4. 404 ou 422: o item sai da venda. Tentativas seguidas sem montagem: sai depois de `MTG_FALHAS_MAX`.
5. Item em "Preparando" não é marcado (Checkout e Venda manual), com aviso.
6. Impressão: `#print-root` com a imagem do servidor em 1844x1240; versão trocada (409) pede a atual.
7. Trocar para Sombra: em até 2 leituras do `/status` o aparelho volta ao canvas; quem trocou também limpa; `blob:` revogados.
8. Foto de exemplo e agente antigo (sem `montagem.imprime`): como antes.
9. `FALHAS: 0` nos testes afetados.

## Testes
`testes/montagem-servidor-checkout.js` (1 a 8), `testes/montagem_servidor_agente.py` (agente), `testes/montagem-paridade.js` (enquadramento).

## Depende do Ronaldo
Nada novo. Deploy fora do horário de visita e recarregar os postos.

## Riscos (E2)
- **Servidor sem montar com a chave ligada:** o item fica em "Preparando" e, depois das tentativas, sai da venda; a impressão daquela foto falha. É a regra (sem canvas); o registro `montagem-srv:` e o Painel mostram a causa.
- **Imagem de visitante em `blob:` no aparelho:** revogada na troca da chave; o resto como o canvas já fazia.
- **Chave errada no Painel:** só `configuracao.u` grava, validado no agente, com `auditLog`.
- **Fila com muitos postos:** `MTG_P0_MAX` protege; acima disso 429 e o item segue em "Preparando" com espera crescente.

## Conferência no servidor
```bash
ssh srv-viva-maracana 'journalctl -u eterna --no-pager --since "-30 min" | grep "montagem-srv" | tail -5'
```
`modo=ligada`, `erros=0`, `atraso p90` dentro do alvo.

---

# E3. Base por fundo (frente ou livre) e omissão com aviso

## Regra
`MTG_FRENTE = {arq1950: true, telao: true, mirantedia: false}` (e `FIA_FRENTE` igual no app, conferido por teste). Entre as candidatas (2 fotos): fundo que exige frente usa a foto com `frente.ok`; se as duas servem, a com mais rostos de frente, depois a primeira. Fundo livre usa a outra foto; com uma candidata só, usa a que houver. Nenhuma de frente: os fundos que exigem frente são omitidos com motivo `sem_frente`. Decide a imagem, nunca a ordem.

## Escopo
Medida de frente (já devolvida pelo filho desde a E1), decisão no agente, resposta no `pedir`, uso no `lojaAI`/`lojaAIAntigo`, aviso à equipe, registro e métrica. Chave própria `config/montagem.frente`: `desligada | sombra | ligada` (padrão `sombra`). Fora: reconhecer a foto da bandeira (fatia 2), botão para a equipe forçar ou retirar à mão (entrega seguinte), limiar por venue.

## Mudanças
- Agente: `mtg_escolher(pids)` → `{"escolha": {fundo: pid|null}, "omitidas": [{fundo, motivo}], "frente": {pid: {rostos, frontais, ok}}}`; sem medida ainda → `aguardando`. `mtg_loop` passa a montar primeiro o que `mtg_escolher` indicou. `POST /montagens/pedir` devolve `escolha`, `omitidas`, `frente_modo`. Tabela `montagem_omitida(dia, card, fundo, motivo, em)` no `operacao.db`, gravada uma vez por sessão e fundo; `/metricas/dia` ganha `ia_sem_frente` (sessões) e `ia_omitidas` (montagens); `/status.montagem.frente = {modo, sessoes_hoje, sem_frente_hoje}`; linha no journal a cada 5 min.
- `index.html`: `mtgEscolha(ids, bgId)` usada em `lojaAI` e `lojaAIAntigo` no lugar do índice de `FIA_BASE` quando `frente_modo === 'ligada'` e há resposta do servidor; sem resposta em `LJ_PREP_MS`, vale `FIA_BASE` (comportamento de hoje). Fundo omitido não entra em `lojaItems`. Aviso à equipe (`TE`, 5 línguas): `mtg_sem_frente` "Sem foto de frente nesta sessão: Maracanã 1950 e Telão não foram montados", no pedido aberto do Posto (`pendEscolhaItem`), na etiqueta do Upload automático e na Fila do fotógrafo (`ffIa`). Painel: seletor `data-act="mtg-frente"` e a contagem do dia. Cliente: nenhum texto novo (vê menos montagens).

## Critérios de aceite (E3)
1. Candidatas A (2 rostos de frente) e B (perfil): 1950 e Telão usam A, Mirante usa B, nas duas ordens de chegada.
2. As duas de frente: 1950 e Telão usam a de mais rostos de frente; Mirante usa a outra.
3. Nenhuma de frente, modo `ligada`: o Checkout mostra só o Mirante do Rio; `omitidas` traz 2 itens `sem_frente`; a linha entra em `montagem_omitida` uma vez; o aviso aparece no Posto nas 5 línguas.
4. Mesmo caso em `sombra`: o Checkout mostra as 3 como hoje; a contagem sobe; nenhuma tela muda.
5. Uma candidata só, de frente: os 3 fundos usam essa foto.
6. Medida ainda não pronta: o Checkout espera até `LJ_PREP_MS` e segue por `FIA_BASE`; nunca fica sem montagem por espera.
7. Sem o modelo YuNet no servidor: `frente_modo` efetivo vira `desligada` e o status diz o motivo.
8. Venda, impressão e galeria usam a foto escolhida (a chave `ai:<foto>|<fundo>` carrega a foto certa).
9. `/metricas/dia` traz `ia_sem_frente` e `ia_omitidas`; dia antigo aparece como "sem registro".
10. Tabela `MTG_FRENTE` igual a `FIA_FRENTE`. `FALHAS: 0`.

## Testes
`testes/montagem_frente_agente.py` (filho falso devolvendo `frente` por pid), `testes/montagem-frente.js` (Checkout, Posto, 5 línguas, sombra).

## Depende
Eduardo: perguntas 2 e 3, e o ok para sair de `sombra` depois de ver o número de um dia. Ronaldo: nada.

## Riscos (E3)
- **Cliente com menos montagens** enquanto as bases não são as fotos da bandeira (achado 2). Por isso nasce em `sombra`.
- **Precisão do "de frente"** pelo YuNet em recorte: não medida. A sombra mede antes de valer.
- **Divergência entre o que o servidor pré-montou e o que o Checkout pede** (selfie junta sessões; menor e escola filtram fotos): o `pedir` recebe as candidatas do navegador e decide sobre elas; o que faltar monta com prioridade 0.
- **Dado novo de operação:** nasce no banco com métrica do dia (regra do projeto).

## Conferência no servidor
```bash
ssh srv-viva-maracana 'journalctl -u eterna --no-pager --since today | grep "montagem-srv: frente" | tail -3'
```
Mostra `modo=sombra sessoes=N sem_frente=K`. É o número que o Eduardo olha antes de ligar.

---

# E4. Galeria: a montagem comprada é entregue como arquivo final; sai o aviso "só impressa"

## Como fica
A montagem vendida vira um arquivo final congelado no servidor e entra na galeria como uma foto comum, com id próprio. **A nuvem não muda** (achado 3): nada de deploy da Lambda, nada publicado a partir de `idiomas-base`.

## Decisões
- `mid = sha256("eterna-montagem|<pid>|<fundo>")[:32]` (hex). Determinístico: a mesma montagem vendida de novo é o mesmo arquivo; cabe no formato de id da galeria e da nuvem. O programador confere que não colide com id da biblioteca (recusa se `mid in lib`).
- Arquivo final (`tipo f`): quadro inteiro, fundo `hi` com recorte de 3000, reduzido para lado maior de 3000 (Telão fica em 2576×1839), JPEG 92, em `~/Eterna/montagens/vendidas/<mid>.jpg`, modo 600. Gerado quando a venda fica paga, prioridade 0.
- Quem põe na galeria é o agente, pela venda paga no `vendas.db`. O que o navegador mandar sobre montagem é ignorado.
- Congelada (pergunta 4): não é refeita por versão nova nem apagada pelo teto.

## Mudanças no agente
- Tabela `montagem_vendida(mid primary key, base, fundo, versao, venda, card, galeria, sha, bytes, criada, expira, apagada)` no `operacao.db`.
- `mtg_vender(venda)`: chamada no `ev_receber` quando a venda tem `criar` e `pagar` (o mesmo critério do `lgpd_vendas_pagas`); para cada `aiSel` válido (`pid` da biblioteca, fundo em `MTG_FUNDOS`), gera o `f`, grava a linha, `nuvem_enfileira(mid, arquivo)` (o envio existente cria `alta/<mid>.jpg` e `vitrine/<mid>.jpg`) e põe o token da galeria da venda na `gal_fila`. Idempotente pelo `mid`. Na partida, `mtg_vender_pendentes()` refaz o que ficou no meio.
- `_gal_montagens(m)`: tira qualquer item com `t` e acrescenta `{"id":"ag_<mid>","t":"ai","base":"ag_<pid>","bg":"<fundo>","sessao":"<card>","direito":"comprada","canal":"loja"}` das linhas cuja `galeria` é `m["codigo"]`. Chamada depois do `gal_mesclar` em `/galerias/publicar`, no `gal_processar` e depois da gravação do manifesto em `nuvem_vendas_online`.
- `gal_processar`: item `t == "ai"`: `original` = cópia de `vendidas/<mid>.jpg`; `vitrine` pelo `_vitrine` do mesmo arquivo. Não procura na `lib`.
- **Tarefa obrigatória do programador:** passar pelas 25 linhas do agente que leem `m["fotos"]` e tratar o item `t == "ai"` (ele não está na biblioteca): `_gal_confere_sessoes`, `lgpd_*`, `vis_protege_manifesto`, limpezas, `galeria_obj`, vendas online. Nenhum deles pode tirar o item por "foto que saiu da biblioteca".
- `/status.montagem.galeria = true` (o app usa para tirar o aviso).
- Cancelamento da venda: seguir o que o cancelamento já faz com as fotos compradas daquela galeria (não conferi essa regra no código; o programador confere e aplica a mesma à montagem, sem inventar outra).
- Limpeza: galeria vencida ou encerrada (`REPO.listar_expiradas`) apaga o arquivo de `vendidas/` e marca `apagada`. LGPD da base: `lgpd_excluir` já preserva base de venda paga; quando a exclusão for aceita, apaga `vendidas/<mid>.jpg`, o item do manifesto e `alta/` e `vitrine/` do `mid` no S3 pelo mesmo caminho das fotos.

## Mudanças em `index.html`
- `mtgGaleria()` = `!!(state.agent.montagem && state.agent.montagem.galeria)`.
- `pendMontAviso`: com `mtgGaleria()`, some o `po_mont_sem_imp`; o `po_mont_fora` continua (só informa quantas não saem no papel), com texto novo sem "galeria" se precisar. `vm_mont_aviso` (Venda manual): idem. Sem `mtgGaleria()` (agente antigo, chave desligada) os avisos de hoje continuam, porque continuam verdadeiros.
- Trava da montagem na escolha da impressão (R6 do plano da impressão): `impFixa(k)` passa a devolver falso com `mtgGaleria()`.
- `galAtualizar`: sem mudança (o servidor acrescenta a montagem).
- Galeria do cliente (`#g`): nenhum código novo obrigatório; a montagem chega como foto comprada. Selo "Edição Maracanã" na galeria: fora desta entrega (pediria mudar a Lambda para devolver `t`).
- Docs no mesmo commit: `GUIA-DA-EQUIPE.md` (linhas 797 e 1202), `CONTEXTO-ETERNA.md`, `DOCUMENTACAO-TECNICA.md`, `NUVEM.md`, `fundos-ia-regras.md`, `VERSOES.md`.

## Contratos
Manifesto local (item a mais, só o servidor escreve): ver `_gal_montagens`. Para a nuvem vai o mesmo manifesto; a Lambda guarda `id, sessao, direito, canal` e ignora o resto. S3: `alta/<mid>.jpg` (até 3000 px, JPEG 88, pelo `nuvem_versoes`) e `vitrine/<mid>.jpg`. Resposta da galeria para o celular: `{"pid":"ag_<mid>","direito":"comprada","vitrine":"<link>","original":"<link>"}`, igual às fotos.

## Critérios de aceite (E4)
1. Venda paga com 2 fotos e 1 montagem, pacote com impressão: a galeria local (`/g/<token>`) lista 3 itens comprados; o terceiro baixa um JPEG com o fundo, lado maior até 3000, igual em enquadramento à prévia do Checkout.
2. Mesma venda em Zona Mista e em Maracanã Mais (só digitais): a montagem está na galeria; o Posto não mostra mais "não vai para a galeria".
3. Republicar o manifesto pelo navegador (outro aparelho, manifesto sem a montagem): a montagem continua na galeria.
4. Navegador mandando um item `t:'ai'` inventado: é descartado; só entra montagem de venda paga daquela galeria.
5. Nuvem (com `teste_local.py` da `galeria-nuvem`, sem alterar o `app.py`): manifesto com o item da montagem é aceito, `galeria_obj` devolve o item com `vitrine` e `original` quando os dois objetos existem no S3 de teste.
6. `git diff` da entrega não toca `servidor/galeria-nuvem/`.
7. Sem internet na hora da venda: a galeria local entrega; a fila da nuvem envia depois; nada se perde ao reiniciar.
8. Montagem vendida, depois mudança de regra (versão nova): o arquivo da galeria não muda; a prévia de sessões novas muda.
9. Venda com `aiSel` de fundo inativo antigo (`campeao2`): gera o final e entrega.
10. Agente antigo ou `modo=desligada`: o aviso de hoje continua aparecendo.
11. Galeria vencida: `vendidas/<mid>.jpg` some e a linha fica `apagada`. LGPD aceita para a base: arquivo, item e objetos do S3 somem.
12. Duas vendas com a mesma montagem (mesma base e fundo): um arquivo, um envio à nuvem, duas galerias com o item.
13. `/metricas/dia`: `montagens.compradas` não muda de sentido; novo `montagens.na_galeria`.
14. `FALHAS: 0`.

## Testes
`testes/montagem_galeria_agente.py` (1 a 4, 7 a 9, 11, 12), caso novo em `servidor/galeria-nuvem/teste_local.py` só de leitura do contrato (5), `testes/posto-montagem.js` e `testes/escolher-impressao.js` (2, 10), `testes/galeria-agente.js`.

## Depende do Ronaldo
Pergunta 3 (regra da nuvem e expiração do bucket). Nenhum deploy de nuvem.

## Riscos (E4)
- **Rekognition lê a montagem** como lê qualquer foto da galeria depois do consentimento (um `index_faces` por montagem). Rostos são os da própria família; custo de uma leitura a mais. Evitar exigiria mudar a Lambda; fica registrado.
- **Vazamento entre famílias:** a montagem só entra na galeria cujo código está na venda paga; conferido no servidor, nunca pelo navegador. O revisor testa galeria que juntou sessões e sessão de menor.
- **Item fora da biblioteca nas 25 linhas que leem o manifesto:** maior risco de regressão da entrega.
- **Disco:** cerca de 1 a 2 MB por montagem vendida, guardada até a galeria vencer (30 dias); fora do teto de 20 GB.
- **Expiração no S3:** não conferi se `alta/` e `vitrine/` têm regra de ciclo de vida.
- **Escala:** id determinístico não depende de venue; com muitos venues no mesmo bucket o prefixo por venue já teria de existir para as fotos (outro plano).

## Conferência no servidor
```bash
ssh srv-viva-maracana 'journalctl -u eterna --no-pager --since "-1 hour" | grep -E "montagem-srv: vendida|Galeria na nuvem|galeria:" | tail -10; ls /srv/eterna-midia/montagens/vendidas 2>/dev/null | wc -l'
```
Depois de uma venda de teste com montagem: uma linha `vendida` (sem id de foto), nenhum erro de galeria, contagem de arquivos subindo. E, no celular, o QR do recibo abrindo a galeria com a montagem para baixar.

---

## Ordem e o que sobe primeiro
1. **E1 em `desligada`** sobe hoje sem risco (nada roda). Ronaldo roda o instalador (pasta no HD). Eduardo põe em `sombra` no Painel e confere pelos comandos acima. **É a primeira que dá para testar na placa do servidor**, com fotos de teste, sem visita.
2. E2 (Ligada) depois de a Sombra mostrar, no registro `montagem-srv:`, `erros=0` e o `atraso p90` dentro do alvo com fotos de teste no gramado.
3. E3 em `sombra` junto ou logo depois da E2; liga com o número de um dia.
4. E4 por último (depende de E1; não depende de E3). Amarra com a F1 do plano da impressão (`impFixa`).

---

## E1: como ficou (16/11/2026)

Entregue: `agente/eterna-montagem.py` (motor), integração `mtg_*` no `agente/eterna-agente.py`, chave e linha de saúde em Laboratório › Fundos de IA (`mtgPanel`, dentro do `fiaPanel`), `montagens` em `MIDIA_PASTAS`, testes `testes/montagem-paridade.js`, `testes/montagem_servidor_agente.py`, casos novos em `testes/seguranca_rotas_agente.py` e `testes/app_offline_agente.py`, `agente/medir-recorte.py --montagem`.

Diferenças em relação ao texto acima:

- Sem posto pareado e sem sessão as duas rotas respondem 401 `sem_sessao`, como toda rota fechada da tabela `ROTAS` (o critério 15 dizia 404). A resposta é a mesma para qualquer foto, então a rota não diz se a foto existe. Com credencial, tudo que não existe responde o mesmo 404.
- As regras ficam em dois lugares (app e `eterna-montagem.py`), como na D3. O agente não tem uma terceira cópia: lê as tabelas do arquivo do motor (`mtg_motor`) para calcular a versão. `MTG_FUNDOS`, `MTG_BASE` e `MTG_ATIVOS` do agente são conferidos contra o app e contra o motor.
- O servidor monta sozinho só os fundos de `MTG_ATIVOS` (os 3 de `BG_DEF`). Os outros 4 fundos com montagem local só por `POST /montagens/pedir`.
- A impressão (`-i`) é montada só para a base preferida de cada fundo, e só depois de a prévia dela existir (é o que garante a ordem do critério 2). A impressão da outra base sai sob pedido.
- A medida do recorte (`medir`) e as reduções de imagem seguem a conta que o canvas do Chromium faz de verdade (nível de mip por média de 2×2 e bilinear de ponto fixo), medida ponto a ponto com alfa de ruído. O motor antigo usava bilinear direto na medida e Lanczos nas reduções: com recorte de foto de verdade a caixa da pessoa saía até 4 px diferente da do navegador.
- O tipo `f` (arquivo final da galeria) fica para a E4: o nome é aceito no destino, mas o motor ainda não gera.
- `frente` é medida e guardada em `info-m2.json`; nada decide com ela (E3).

Não medido nesta entrega: critério 19 (carga de 200 fotos em 5 min com `sombra` contra `desligada`) e a paridade com foto de cliente no servidor (comparador da E2).

---

## E2: como ficou (19/11/2026)

Regra do Eduardo (18/11, antiga e reafirmada): o recorte e a montagem dos fundos de IA são feitos e guardados no servidor do estádio, nunca no Checkout. O Checkout, a Venda manual e o Posto só mostram e imprimem. Operação com fundos de IA a partir de 21/11.

O que mudou desde a E1 (junto com o `idiomas-base` v99.36.0):

- **Bases só do servidor (regra 19).** `mtg_candidatas(x)` devolve só `x["ia"]` (fotos de gramado reconhecidas). Sem bases, a leva não é montada; o jeito antigo (as 2 primeiras fotos de qualquer ponto) não existe no servidor. Montagem nova pelas rotas também só de base: foto de leva carregada (ontem e hoje) que não é base responde 404 no `GET /montagem/` e `nao_base` no `POST /montagens/pedir` (`mtg_base_ok`). Foto fora das levas carregadas só com a montagem vendida naquele fundo (reimpressão).
- **Quatro fundos ativos.** `MTG_ATIVOS` ganhou a Saída do túnel v2 (`img/bg-tunel-v2.jpg`, `img/fundos-5k/tunel-v2.jpg`, impressão presa no alto como o 1950, regra 22: `alt .766` e `estreito`). `MTG_BASE.tunel = 0` (1ª base, como o `FIA_BASE`).
- **Corte do joelho (D8) no motor.** `png_info` lê o tEXt `eterna` do PNG do recorte e `joelho` é a porta do `fiaJoelho` (mesmos limites `.35` e `.97`, mesma condição: silhueta encostada embaixo e pernas inteiras). Vale na prévia e na impressão. O agente passou a copiar o tEXt para a cópia de 2400 do recorte (`_grava_png`): antes a prévia do navegador perdia o joelho e só a impressão cortava.
- **Checkout, Venda manual e Posto (E2).** Com `mtgSrv()` (agente ligado, `montagem.modo === 'ligada'` e `montagem.imprime`):
  - `compose` → `mtgCompose`: baixa a prévia do servidor (`GET /montagem/<pid>/<fundo>.jpg?t=p`) e mostra como `blob:`; 202, 503, 429 ou rede esperam com espera crescente (700 ms dobrando até 8 s) até 6 s; depois disso o item fica em "Preparando" e o `compHydrate` tenta de novo, também com espera crescente; 404 (sem pessoa, não é base) e 422 (falhou no servidor) tiram o item da venda pelo `fiaFalhou` de sempre.
  - `iaAquecer` faz um `POST /montagens/pedir` só (prioridade 0 para o que faltar) e baixa as prévias juntas.
  - `compHi` → `mtgHi`: o 10x15 do servidor (`?t=i`) com a versão da prévia mostrada; 409 (versão trocada) pede a atual; até 50 s. Sem o arquivo, a foto de IA falha na impressão (vai para `falhasIA`), sem montar no navegador.
  - `lojaAI` deixa de fora o fundo que o servidor não sabe montar (`montagem.montaveis`, ex.: as variações da Noite de campeão).
  - Trocar a chave (ligada ↔ sombra/desligada) limpa as montagens guardadas no aparelho (`mtgTroca`) e vale na próxima leitura do `/status` (2,5 s).
  - Com Desligada, Sombra ou agente antigo (sem `montagem.imprime`): o `fiaMontar` de sempre. `ETERNA.fiaMontagens = {servidor, canvas}` conta de onde veio cada montagem.
- **Agente:** `/status.montagem` ganhou `imprime: true`, `montaveis` (os 7 fundos do motor) e `ativos`. O atraso do registro (`atraso p50/p90`) conta de quando a base passou a existir (chegada da foto ou fechamento da leva, o maior), porque desde a regra 19 as bases só saem no fechamento (60 s sem clique) ou quando o reconhecimento termina.
- **Tempo-alvo.** Medido nesta máquina de teste (2 núcleos): cerca de 0,4 a 0,6 s por montagem no `montagem_servidor_agente.py`. Com 4 fundos são 4 prévias preferidas por leva, então o alvo "p50 até 8 s e p90 até 15 s da base pronta às prévias preferidas" continua com folga no servidor (6 núcleos), contado a partir do fechamento da leva. O visitante leva minutos até o Checkout; o pedido do Checkout passa na frente (prioridade 0). O número real sai no registro `montagem-srv:` com a chave em Sombra.

Revisão (19/11): o aparelho decide pelo último modo conhecido do servidor (um `/status` que falha não faz voltar ao canvas; até o primeiro `/status` da página nada é montado); 422 do servidor e tentativas seguidas sem montagem tiram o item da venda; item em "Preparando" não pode ser marcado; a troca da chave revoga os `blob:` e descarta o trabalho em voo também no aparelho de quem trocou; espera crescente nas tentativas; impressão com limite próprio; foto fora das levas carregadas só com a montagem vendida; download do fundo com espera crescente.

Ficou de fora desta entrega: o comparador lado a lado para o Admin (`mtg-comparar`), a E3 (frente ou livre) e a E4 (galeria). Sem reserva no navegador por decisão do Eduardo: com a chave em Ligada, se o servidor não montar, o item fica em "Preparando" e, depois das tentativas, sai da venda; a impressão daquela foto falha.

### Como ligar (Eduardo ou Admin, na tela)

1. Antes, o Ronaldo roda o `servidor/linux/instalar.sh` (cria `/srv/eterna-midia/montagens` no HD e o link em `~/Eterna/montagens`) e confere com `ls -ld /srv/eterna-midia/montagens`.
2. Laboratório › Fundos de IA › Montagem no servidor: **Sombra**. Fazer 2 ou 3 sessões de teste no gramado e conferir no registro (`journalctl -u eterna | grep montagem-srv`): `modo=sombra`, `no_hd=sim`, `erros=0`, `feitas` subindo, `atraso p90` dentro do alvo.
3. Mesma tela: **Ligada**. Em até 2,5 s todos os Checkouts e Postos passam a mostrar e imprimir o que o servidor montou (sem recarregar). Conferir uma venda de teste: as 4 montagens aparecem e a impressão sai.
4. Para voltar: **Sombra** ou **Desligada** na mesma tela (o navegador volta a montar). Desligamento à força no servidor: `ETERNA_MONTAGEM=0` no `nuvem.env` e reiniciar o serviço.

