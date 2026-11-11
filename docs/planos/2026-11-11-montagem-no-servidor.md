# Plano: montagem dos fundos de IA feita e guardada no servidor do ponto

Data: 11/11/2026 · Worktree `/home/claude/eterna-montagem`, branch `feat/montagem-servidor`, criada de `feat/selo-ia` `7467981`.
Pedido do Eduardo (11/11): as 2 primeiras fotos do gramado são as bases das montagens de IA; a montagem é feita no servidor (onde está a placa de vídeo), fica guardada lá e é entregue na galeria. Não é feita no Checkout.

**Regra do projeto (Eduardo, 11/11): recorte e montagem são feitos e guardados no servidor do ponto; o Checkout só mostra.**

## Objetivo
O servidor do ponto monta cada base de IA em cada fundo ativo assim que o recorte fica pronto, guarda o arquivo e uma prévia, e passa a ser a única fonte da montagem para o Checkout, o Posto, a impressão e a galeria por QR (agente e nuvem).
Quem compra montagem em qualquer pacote, inclusive só digital, recebe o arquivo na galeria.

## Situação hoje (conferida no código)
- Bases: `x["ia"]` no fechamento da leva (`_sess_ia_fecha`), por visita (`visita_ja_tem`). O `rec_ia_loop` recorta a base (3000 e 2400 px) no processo `agente/eterna-recorte.py`; arquivo em `~/Eterna/recortes/<pid>.png`, cache de 2 dias (`REC_DIAS`).
- Montagem: `compose` → `fiaMontar` (index.html 3241) no canvas do navegador: `fiaRecorte` (POST `/recorte`), `fiaMedir`, `fiaLayout`, `fiaRostos` (YuNet do navegador), `fiaDesenhar` ou `fiaTelao` (`fiaHomog`, `fiaWarp`). Resultado só em `COMP`/`COMPURL` (memória da aba). Nada vai para o disco.
- Checkout: `lojaAI` escolhe base × fundo (`FIA_BASE`, `bgOn`, `bgFor`), `lojaThumb` põe `.compimg[data-comp]`, `compHydrate` chama `compose`. `iaAquecer` adianta.
- Venda: `aiSel` = lista de `"<base>|<fundo>"`; vai ao servidor no evento `criar` (`pvDados`, `_ev_limpo` guarda `aiSel`). O servidor não faz nada com ele além de contar `nAI`.
- Impressão: `printMontar` → `compHi` → `fiaMontar(...,{hi:true})`: monta de novo com recorte de 3000 e fundo de 5000, corta em 1844×1240. Pelo servidor (`POST /imprimir`) o app manda o JPEG em base64.
- Galeria: `galAtualizar` só põe `s.photos` e bases já pagas; `gal_validar` só aceita foto da biblioteca; `gal_processar` copia de `lib`. A nuvem recebe `alta/<pid>.jpg` (3000 px) e `vitrine/<pid>.jpg` de cada foto da biblioteca. Montagem não existe em nenhum dos dois.
- Fundos: 5000 px para `campeao2`, `mirante`, `arq1950`, `tunel`, `podio` (`img/fundos-5k/`); o Telão só tem 2576×1840. Prévia e 5000 têm a mesma proporção.
- Lista de fundos ativos (`SIM.bgOn`, `SIM.bgAtivo`) e regras (`FIA_REGRAS`, `FIA_BASE`, `bg.telao.quad`) só existem no navegador. O agente tem só o mapa de arquivos `FUNDOS_PREVIA`/`FUNDOS_IMPRESSAO`.

## Escopo desta entrega (em 6 etapas, E0 a E5)
- Agente: processo de montagem (`agente/eterna-montagem.py`), fila própria, índice em banco, arquivos, retenção, invalidação, 3 rotas, `/status.montagem`.
- App: Checkout, Posto e impressão leem a montagem do servidor; `aiMont` na venda; galeria `#g` mostra a montagem comprada com o selo; sai o aviso do Posto para pacote só digital.
- Nuvem: a montagem vendida sobe como as fotos; a Lambda aceita e devolve o item `t:'ai'`.
- Testes de paridade por imagem entre o canvas e o Python.

## Fora do escopo
- Vender montagem pela galeria online (montagem não comprada não aparece na `#g`). Só a comprada no estádio entra.
- Telas do Admin (Fundos de IA, `compGrid`, `compModal`, Laboratório › Fundos em teste) continuam montando no navegador com `fiaMontar`. Isso mantém o canvas como referência da paridade. Trocar essas telas e apagar o canvas: etapa posterior (E6, depois da v98).
- Apagar a cópia de 2400 px do recorte (o app antigo ainda pede).
- Fundos e regras por venue (white label): hoje a tabela é fixa para o Maracanã. Registrado como dívida.
- Ordem da fila de impressão (`impFotos` põe as montagens no fim).
- Código do Photoroom (segue inativo).

## Decisões assumidas (padrão mais seguro; as que dependem do Eduardo estão no fim)
- A1. **Todas as combinações**: 2 bases × N fundos ativos (10 por visita com 5 fundos), como pedido. As 5 que o Checkout mostra (`FIA_BASE`) saem primeiro; as outras 5 (reserva para base ruim) saem depois, com a prioridade mais baixa. Assim o `lojaAI` não muda e qualquer escolha dele já está pronta. Alternativa mais barata em D2.
- A2. **A placa de vídeo não ajuda na montagem.** Montar é redimensionar, colar e gravar JPEG (medido: 1,3 a 1,6 s por montagem de 5000 px em 2 núcleos, sem modelo). A GPU resolve o recorte, que é o gargalo (45 a 75 s em CPU, alvo de 3 s na RTX). A montagem roda em CPU no servidor e no Mac. O `opencv-python-headless` do instalador não tem CUDA; não vale acrescentar.
- A3. **Processo à parte**, como o recorte: uma montagem de 5000 px ocupa ~470 MB de pico (medido) e não pode travar FTP, vendas e Checkout nem cair junto com o agente.
- A4. **Sem biblioteca nova.** Só `numpy 2.5.4`, `pillow 13.0.0` e `opencv-python-headless 4.10.0.84`, que já estão em `agente/recorte-requisitos*.txt` com hash. Rostos pelo YuNet que o agente já usa (`MODELOS/face_detection_yunet_2023mar.onnx`).
- A5. **Três arquivos por montagem**: `final` (tamanho do fundo de impressão, 5000 px quando houver; JPEG 92), `previa` (maior lado 1600, JPEG 85; reduzida do final) e `impressao` (1844×1240, o mesmo corte do `compHi`; feita no primeiro pedido de impressão e guardada).
- A6. **Nome do arquivo = `mid`**, 32 hex de `secrets.token_hex(16)`, gerado pelo servidor. Sem pid, sem fundo, sem sessão no nome. O `mid` cabe no formato de id da galeria e da nuvem (`^(ag_)?[0-9a-f]{6,40}$`), então manifesto, `REPO`, S3 e a Lambda aceitam sem mudar o formato.
- A7. **`aiSel` não muda de formato** (`"<base>|<fundo>"`; impressão, Posto, estatísticas e janelas antigas leem assim). A venda ganha `aiMont = {"<base>|<fundo>": "<mid>"}`, a montagem que o cliente viu. O servidor confere e, sem `aiMont` (app antigo), resolve sozinho pela base e fundo.
- A8. **O servidor decide o que entra na galeria.** A montagem entra no manifesto pelo agente, a partir da venda paga em `vendas.db`, nunca pelo que o navegador mandar. Montagem na galeria é sempre `comprada`.
- A9. **Montagem vendida não muda nunca** (nem com regra nova, nem com fundo trocado). Só a não vendida é refeita.
- A10. **Sem agente (demonstração)**: sem montagem, como já é hoje (`fiaOferece()` falso). O Checkout não volta a montar no navegador quando o servidor diz que monta. O canvas só é usado com agente antigo (compatibilidade) e nas telas do Admin.
- A11. **Retenção**: não vendida, 3 dias; vendida, até a galeria da venda vencer (60 dias). Tudo local; só a vendida sobe para a nuvem.
- A12. **Download na galeria em 3000 px**, como as outras fotos (`ALTA_LADO`). O arquivo de 5000 px fica no servidor para a impressão.
- A13. Montagem de grupo de escola (`tipo evento`) não entra em galeria (não é vendida hoje).
- A14. "Jeito antigo" (`lojaAIAntigo`: leva sem base usa as 2 primeiras fotos normais): montagem sob pedido do Checkout, com prioridade 0. Não é feita antes.
- A15. Variações da Noite de campeão por bandeira (`campeaoarg`, `campeaocol`, hoje inativas): sob pedido, porque a bandeira só existe no app.

## Paridade com o `fiaMontar` (como garantir o mesmo resultado)
Porta em Python, função por função, no `agente/eterna-montagem.py`: `medir`, `layout`, `rostos`, `desenhar`, `homog`, `warp`, `telao`, `montar`, `imprimir_corte`. Mesmos nomes do canvas, sem o prefixo.

Armadilhas que o Programador precisa tratar (cada uma tem critério):
1. **Preto e branco**: o canvas usa `grayscale(1)` do CSS, com pesos 0,2126 / 0,7152 / 0,0722 em sRGB. `Image.convert('L')` usa 0,299 / 0,587 / 0,114 e dá outro tom. Usar a matriz do CSS.
2. **Filtros do Telão**, na ordem do canvas: `brightness(1.04)`, `contrast(1.05)` (inclinação c, deslocamento 0,5 − 0,5c), `saturate(1.06)` (matriz do CSS), `blur(max(0,3; cw/2400) px)` = gaussiano com esse desvio. Contraste 1,10 no grupo do 1950 antes do P&B.
3. **Halo escuro**: o recorte tem RGB zerado fora da pessoa. Redimensionar em RGBA comum escurece a borda. Redimensionar com alfa pré-multiplicado (`RGBa`), como o canvas.
4. **Homografia**: o `fiaWarp` amostra em coordenada inteira (sem +0,5), bilinear, com a regra dos 2,5 px de borda. `cv2.warpPerspective` usa outra convenção. Portar o `fiaWarp` em numpy, igual; o conteúdo do telão em meia resolução antes, como no canvas.
5. **Medida do grupo**: `fiaMedir` reduz o alfa para 600 px no canvas e corta em 128. A redução do Pillow difere em até 1 px.
6. **Rostos**: mesma leitura do `ynDetect` (640×640, foto inteira + 4 quadrantes de 60%, limiar 0,6, NMS 0,3) sobre o recorte em fundo preto. Sem o modelo: segue sem rostos, como o `catch` do `fiaRostos`, e grava `rostos: null` no índice.
7. **Regras em dois lugares**: `REGRAS`, `PADRAO`, `BASE`, `TELAO` (quad, w, h), `MONO`, `ZOOM` viram tabela no `eterna-montagem.py`. Teste compara com `ETERNA.FIA_REGRAS`, `FIA_PADRAO`, `FIA_BASE` e `DATA.backgrounds` do app; diferença quebra o `rodar.sh`.

Teste `testes/montagem-paridade.js` (Playwright + `python3 agente/eterna-montagem.py --teste`), com 6 recortes sintéticos gerados no teste (nunca foto de cliente no repositório): 3 adultos de meio corpo, casal de corpo inteiro, família larga (regra 10, zoom do 1950), adulto com criança baixa (corte desce pelo rosto, rostos dados por lista fixa aos dois lados), pessoa sozinha, grupo que estoura a largura. Cada um nos 6 fundos (5 ativos + Pódio). Três camadas:
- P1, layout exato: o `m` e os rostos do navegador entram no `layout` do Python; `modo`, `src`, `dst`, `s`, `corteFinal` iguais com diferença ≤ 1e-6.
- P2, medida: `medir` do Python contra `fiaMedir` na mesma PNG: `box` com até 1 px de diferença (na escala de 600), `trunc` e `modo` iguais nos 36 casos.
- P3, imagem: canvas (`fiaMontar` prévia, e `compHi` para a impressão) contra o Python, comparados em PNG sem JPEG no meio, no tamanho da prévia: erro médio absoluto ≤ 2,0 (0 a 255) e no máximo 1,5% dos pontos com diferença > 16; caixa do grupo (diferença contra o fundo puro) com até 0,4% da largura de desvio; nenhum ponto da borda do grupo mais escuro que o fundo e que a pessoa (halo) num fundo branco de teste. Telão: os mesmos limites dentro do quadrilátero e diferença zero fora dele.
- Fotos reais, opcional: `ETERNA_MONTAGEM_FOTOS=<pasta>` (como o `ETERNA_RECORTE_FOTOS`), mesmos limites, e folha lado a lado para o Eduardo aprovar (portão da E2).
- Depois da aprovação: as saídas do Python dos 36 casos, reduzidas a 600 px, viram gabarito em `testes/montagem-ouro/` (são sintéticas); regressão com erro médio ≤ 1,0.

## Mudanças por arquivo

### agente/eterna-montagem.py (novo, processo filho)
Só `numpy`, `PIL`, `cv2`, stdlib. Nada importado do agente. Não abre porta. `cv2.setNumThreads(2)`; prioridade baixa do sistema (`os.nice(10)`; no Windows `BELOW_NORMAL_PRIORITY_CLASS` pelo `Popen` do agente). `Image.MAX_IMAGE_PIXELS` = 40 MP.
- `carregar()`: responde `{"pronto":true,...}`; fundos abertos sob demanda e guardados na memória (até 3 de 5000 px, ~50 MB cada).
- `montar(msg)`: abre o recorte de 3000, `medir`, `layout` (+ `rostos` se `corte < 1`), `desenhar` ou `telao`, grava `final` e `previa` com `mkstemp` + `os.replace`, modo 600. Devolve tamanho, layout e tempos.
- `imprimir_corte(msg)`: do `final` para 1844×1240 (deitado) com o corte do `fiaMontar` hi: centro na horizontal, preso embaixo; Telão no meio da altura.
- Caminhos: origem só dentro de `RECORTES` e `FUNDOS`, destino só dentro de `MONTAGENS` (`realpath`, recusa o resto). stdout só JSON.
- `--regras` imprime a tabela em JSON; `--teste` roda um caso de paridade com entradas dadas (só para os testes).

### agente/eterna-agente.py
Constantes: `MONTAGENS = ~/Eterna/montagens`, `MONT_DB = ~/Eterna/ponto/montagens.db`, `MONT_VERSAO = "m1"`, `MONT_FILHO`, `MONT_DIAS = 3`, `MONT_TETO_GB` (`ETERNA_MONTAGENS_GB`, 40), `MONT_PISO_GB` (`ETERNA_MONTAGENS_PISO_GB`, 15), `MONT_FILA_MAX = 2000`, `MONT_TAXA = 120`, `MONT_MEM_MIN_GB = 2`, `MONT_CONC = 1` (2 com `ETERNA_MONTAGEM_CONC=2` e 8 núcleos ou mais), prioridades `0` Checkout, impressão e venda · `1` preferida ao vivo · `2` preferida de cartão · `3` reserva e recuperação. `FUNDOS_SHA` = SHA-256 de cada arquivo de fundo (gerado por script, conferido por teste contra `img/`).
- `mont_db()`: tabela e índices do contrato. WAL. Entra no `backup_loop`.
- `mont_fundos()`: lê `config/fundos` do `estado.db` (cache de 3 s, como `ia_cfg`); sem documento, o padrão `campeao2, mirante, arq1950, tunel, telao`. `fundos_valida(j)` no `estado_gravar` (ids do mapa aprovado, até 8, apagar recusado).
- `mont_fundo_arquivo(bg)`: `bg_arquivo(bg, hi=True)` baixado de `APP_ORIGIN` para `~/Eterna/fundos/`, com SHA conferido; diferente, apaga e marca `fundo_invalido`. `mont_fundos_garantir()` na partida e a cada mudança da lista (o servidor monta offline depois disso).
- `mont_versao(bg)`: `sha256(MONT_VERSAO | REC_VERSAO | sha do fundo | regra do fundo em JSON)[:12]`.
- `mont_plano(pid)`: leva da base (`sess_pid`), posição dela em `x["ia"]` (ou `_sess_ia_cand`), fundos preferidos (`BASE[bg] == min(pos, n-1)`) e de reserva.
- `mont_enfileirar(pid, bg, prio, origem)`: idempotente pela chave `(base, fundo, versao)`: linha existente `pronta` devolve; `fila`/`fazendo` só sobe a prioridade; senão cria com `mid` novo. Recusa com disco abaixo do piso (menos prioridade 0, que só para abaixo de 2 GB) e com a fila cheia.
- Gatilho: no `finally` do `rec_trabalho`, trabalho `ia` sem erro chama `mont_base_pronta(pid, prio)`. `mont_loop` (15 s): recupera bases de hoje (`sess_ia_hoje`) com recorte pronto e sem linha da versão atual (partida, `_vis_ia_reabre`, fundo novo, versão nova).
- `mont_trabalho()`: uma de cada vez; fala com o filho (`mont_filho_montar`, espera 60 s); filho morto: erro, reabre em 60 s, para na 3ª morte por memória (mesma política do recorte, `/status.montagem.parado`). Depois de montar confere se a base ainda está na biblioteca (LGPD no meio: apaga).
- Nunca pega `lock`, `sess_lock` e `mont_lock` juntos (regra do `ff_lock`).
- `mont_lista(pids, pedir)`: para as rotas; só bases que estão em sessão de hoje ou ontem (`sess_pid`) ou em venda paga.
- `mont_vender(venda, aiSel, aiMont)`: no `ev_receber`, quando a venda fica paga: para cada `base|fundo`, usa o `mid` de `aiMont` se ele existe e é dessa base e fundo; senão a linha `pronta` da versão atual; senão enfileira com prioridade 0. Marca `vendida`, `venda`, `expira`. Venda cancelada desmarca se a galeria não foi publicada. Depois põe na `gal_fila` as galerias da venda.
- Galeria: `_gal_montagens(m)`, chamada no `/galerias/publicar` depois do `gal_mesclar` e no `gal_processar`: tira qualquer item `t:'ai'` que veio do navegador e acrescenta os das vendas pagas cujas levas estão em `m["sessoes"]` e cuja galeria (`galeria.codigo` do evento) é esta. `gal_processar`: para `t:'ai'`, `original` = cópia do `final` reduzida a 3000 px, `vitrine` pelo `_vitrine` (com a marca). `galeria_obj`: devolve `t`, `bg` e inclui a montagem comprada sempre que o acesso foi dado (não depende do rosto bater na montagem). `gal_validar` passa a aceitar e descartar `t` (compatibilidade).
- Nuvem: `nuvem_enfileira(mid, arquivo_3000)` só quando a montagem é vendida. O envio existente gera `alta/<mid>.jpg` e `vitrine/<mid>.jpg`.
- Impressão: `imprimir()` aceita item `{"mont": "<mid>"}` além do base64: usa o arquivo `impressao` do servidor (só montagem `vendida`).
- Limpeza `limpar_montagens()` (de hora em hora, no `galeria_loop`): apaga não vendida com mais de `MONT_DIAS`, a de base que saiu da biblioteca, a de versão antiga não vendida, a vendida com `expira` vencido, e, acima do teto, as não vendidas mais antigas. Nunca apaga vendida por teto. Linha fica com `estado='apagada'` por 60 dias (auditoria), sem arquivo.
- LGPD: `lgpd_excluir` chama `mont_apagar_base(pid)`: arquivos, linha, item do manifesto, `alta/` e `vitrine/` do `mid` no S3, trabalho na fila cancelado.
- `/status.montagem` (contrato). Console: uma linha na partida; nunca pid, mid ou nome de pessoa em erro.
- Rotas (ver "Rotas novas").

### index.html
- `state.agent.montagem = st.montagem || null` na leitura do `/status`. `montSrv()` = agente ligado, `montagem.v >= 1` e `montagem.ligada`.
- `MONT = {}` (chave `"<base>|<fundo>"` → `{mid, estado, motivo, w, h}`), `montLista(bases, pedir)` (POST `/montagens/lista`, `X-Eterna: 1`), `montPoll()` (2 s enquanto houver item da tela em `fila` ou `fazendo`; para em 3 min ou fora do Checkout e do Posto), `montUrl(mid, 'previa')`.
- `compose(photoId, bgId)`: com `montSrv()`, foto `ag_` e fundo do mapa aprovado, devolve do servidor: `pronta` → `{url, w, h, mid}`; `fila`/`fazendo`/`indisponivel` → `{pending:'montagem'}`; `erro` → `{err}` (`sem_pessoa` como hoje). Sem `montSrv()`: caminho de hoje. `COMP`, `COMPOK`, `COMPURL`, `LJ_AR`, `fiaPronta`, `ljPrimeira`, `lojaEdEspera`, `edVista`, `ljAncora` não mudam.
- `compHydrate`: ramo novo `r.pending==='montagem'`: mantém o `.lj-aimk` ("Preparando sua foto especial...") e tenta de novo em 2 s (como o ramo `fila`). Nunca chama `fiaFalhou` por espera.
- `iaAquecer(card)`: com `montSrv()` vira `montLista(bases da visita, true)` (sobe a prioridade para 0 e liga o `montPoll`).
- `lojaAI`, `lojaAIBase`, `lojaItems`, `lojaThumb`: sem mudança.
- `lojaPedido(card)`: grava `aiMont` no pedido (do `MONT`, só das chaves de `aiSel`). `pendConfirmar` copia para `s.aiMont`; `pvDados` manda `aiMont`. `pendN` não muda.
- `printMontar`: item `ai` com `montSrv()` usa `<agente>/montagens/<mid>/impressao.jpg` (mid de `s.aiMont`, senão `montLista`); sem servidor, `compHi` de hoje. Envio ao `POST /imprimir`: item `ai` vai como `{mont: mid}` quando `montagem.imprime`.
- `galAtualizar`: não põe montagem (A8). `vGaleriaQR`/card da `#g`: item com `t==='ai'` ganha `<span class="lj-ed gq-ed">` e `bgNomeCli(bgOf(f.bg))`; proporção pela imagem. Download igual ao das outras.
- `fiaPanel`: linha "Montagens: fila N · feitas hoje N · média X s · N GB guardados" e o aviso de pausa por disco.
- Painel de controle › Fundos de IA: `bg-on`, `bg-ativar` e as migrações gravam também `config/fundos` (`fundosCfgSalva`, só com `configuracao.u`, `auditLog('fundos_lista')`).
- E4: remover o aviso do Posto para pacote só digital da `feat/posto-unico` (ainda não tem commit em 11/11; quando entrar, registrar aqui a função, o CSS e o teste para sair juntos). O Posto volta a aceitar Zona Mista e Maracanã Mais com montagem.
- CSS: `.gq-ed` (selo na galeria, mesmas cores do `.lj-ed`). I18N: nenhuma chave nova (`aiMaking`, `edSelo` e os nomes dos fundos já existem nas 5 línguas).
- Exportar em `Object.assign(window.ETERNA,{...})` separado: `montSrv`, `montLista`, `MONT`.

### servidor/galeria-nuvem/app.py (E5)
- `publicar`: mantém `t:'ai'` e `bg` (`^[a-z0-9]{2,40}$`) no item; item `ai` só com `direito: comprada`.
- `galeria_obj`: devolve `t` e `bg`; item `ai` comprado entra sempre que o acesso foi dado.
- `indexar`: pula `t:'ai'` (montagem não vai para o Rekognition: sem custo e sem rosto de montagem na coleção).
- `teste_local.py`: casos novos.

### Instaladores e deploy
- Sem pacote novo. `instalar-servidor.ps1`, `eterna-vigia.ps1` e o deploy do Mac levam o 3º arquivo, `eterna-montagem.py` (Ronaldo, na `idiomas-base`).
- `docs/CHECKLIST-SERVIDOR.md`: disco com 100 GB livres para montagens; conferir `/status.montagem`.

## Contratos

Filho (uma linha JSON por mensagem):
```
-> {"pronto":true,"versao":"m1","carga_ms":N}
<- {"op":"montar","id":"<mid>","recorte":"<caminho>","fundo":"<caminho>","bg":"arq1950","final":"<caminho>","previa":"<caminho>","yunet":"<caminho|null>"}
-> {"id":"<mid>","ok":true,"w":5000,"h":3571,"bytes":{"final":N,"previa":N},"layout":{"modo":"meio","corteFinal":0.72,"rostos":2},"ms":{"abrir":N,"medir":N,"rostos":N,"montar":N,"gravar":N,"total":N},"pico_mb":N}
-> {"id":"<mid>","ok":false,"erro":"sem_pessoa|fundo|recorte|imagem_grande|interno"}
<- {"op":"imprimir","id":"<mid>","final":"<caminho>","bg":"telao","destino":"<caminho>"}
```

Banco `~/Eterna/ponto/montagens.db`:
```
montagem(mid text primary key, base text, fundo text, versao text, estado text, motivo text, dia text,
         w int, h int, bytes int, sha text, rostos int, prio int, origem text,
         criada real, pronta real, ms int, vendida real, venda text, expira real, apagada real)
unique(base, fundo, versao)      index(base)      index(estado, prio, criada)      index(vendida)
```
`estado`: `fila | fazendo | pronta | erro | apagada`. `origem`: `auto | pedido | venda`. `sha` = SHA-256 do `final`.

Arquivos: `~/Eterna/montagens/<AAAA-MM-DD>/<mid>.jpg` (final), `<mid>_p.jpg` (prévia), `<mid>_i.jpg` (impressão). Pasta 700, arquivo 600.

Configuração (`estado.db`, pelo `/ponto/docs` que já existe):
```
config/fundos   {"ativos":["campeao2","mirante","arq1950","tunel","telao"],"por":"<e-mail>","em":"<iso>"}
config/montagem {"ligada":true}        (ausente: valor de ETERNA_MONTAGEM; na v97 o padrão é desligada)
```

Rotas:
```
POST /montagens/lista        (X-Eterna: 1, até 4 KB)
  {"bases":["<pid>", ... até 12],"fundos":["<bg>", ... até 8]?, "pedir":true?}
  -> 200 {"versao":1,"itens":[{"base":"<pid>","fundo":"arq1950","mid":"<32 hex>"|null,"estado":"fila|fazendo|pronta|erro|indisponivel","motivo":null|"sem_pessoa|fundo|disco|recorte","w":5000,"h":3571}]}
  -> 400 campo · 403 origem · 404 base desconhecida · 429 limite · 503 {"error":"montagem_desligada"}
GET  /montagens/<mid>/previa.jpg       -> 200 image/jpeg (private, max-age=3600, nosniff) · 404
GET  /montagens/<mid>/impressao.jpg    -> 200 image/jpeg (só montagem vendida) · 404 · 409 nao_vendida
```
`pedir:true` enfileira o que falta com prioridade 0 (só base de sessão de hoje ou ontem e fundo do mapa aprovado).

`/status.montagem`: `{"v":1,"ligada":true,"imprime":true,"versao":"m1","filho":{"vivo":true,"reinicios":0},"parado":false,"fila":N,"feitas_hoje":N,"erros_hoje":N,"ms_medio":N,"pico_mb":N,"guardado_gb":N,"livre_gb":N,"pausa_disco":false,"fundos":[...],"fundos_faltando":[...]}`.

Venda (evento `criar`, campo a mais): `"aiMont":{"ag_<pid>|arq1950":"<mid>"}` (até 20 pares; chave e valor validados no `_ev_limpo`; par inválido sai, a venda fica).

Manifesto e galeria (item a mais, o contrato deixado pelo plano do selo com o `mid` no lugar do id composto):
```
{"id":"<mid>","t":"ai","base":"<pid>","bg":"arq1950","sessao":"LP...","direito":"comprada","canal":"loja"}
galeria_obj: {"pid":"<mid>","t":"ai","bg":"arq1950","direito":"comprada","vitrine":"<link>","original":"<link>","chegando":false}
```
Nuvem: `alta/<mid>.jpg` (3000 px, JPEG 88) e `vitrine/<mid>.jpg`, pelo envio que já existe.

I18N: nenhuma chave nova.

## Rotas novas: deny-by-default e matriz do Ronaldo
- Um despachante só (`mont_rota`) com tabela fechada: `^/montagens/lista$` (POST) e `^/montagens/([0-9a-f]{32})/(previa|impressao)\.jpg$` (GET). Qualquer outro caminho em `/montagens` responde 404 sem CORS. Não existe rota para o `final` (a galeria entrega por link HMAC; a impressão usa o corte).
- Guarda, nesta ordem: `posto()` + `origem_local()` (Host da lista, contra DNS rebinding) → `X-Eterna: 1` no POST → `limite_ok(ip, "montagens", 120)` → validação (campo desconhecido = 400). Entram em `rota_privada` e no ramo do `cors()` das `/visitas` (só `ETERNA_ORIGENS`; nunca `*`).
- Para a matriz de permissões da `idiomas-base` (sessão autenticada, permissão conferida no servidor):

| Rota | Quem | Permissão |
| --- | --- | --- |
| `POST /montagens/lista` | terminal do Checkout, Posto | sessão do terminal do Checkout ou `venda` r |
| `GET /montagens/<mid>/previa.jpg` | terminal do Checkout, Posto | a mesma |
| `GET /montagens/<mid>/impressao.jpg` | Posto | `venda` u |
| `POST /imprimir` com `{mont}` | Posto | a que já vale para `/imprimir` |
| `config/fundos`, `config/montagem` em `/ponto/docs` | Admin | `configuracao` u, validado no `estado_gravar` |

O Checkout `#loja` não tem login: na `idiomas-base` ele precisa de sessão de terminal (o mesmo ponto em aberto do `/ponto/montagens` do selo). Combinar com o Ronaldo.
- Atenção ao nome: `/ponto/montagens` (contagem de vistas, v97) é outra rota e não muda.

## Quando faz, limites e contas
- Ordem por visita: recorte da base 2 pronto → montagens preferidas dela na ordem do `bgOn` (a 1ª da tela primeiro) → preferidas da base 1 → reservas. Pedido do Checkout (`pedir`) passa na frente de tudo.
- Não atrasa o recorte nem as fotos ao vivo: processo próprio, prioridade baixa do sistema, 2 threads, 1 montagem por vez. O recorte usa a GPU; a montagem usa CPU.
- Tempo medido (máquina de teste, 2 núcleos, fundo de 5000 px, recorte sintético de 3000 px): 1,3 a 1,6 s por montagem com final + prévia + corte de impressão; Telão ~0,5 s. Pico de 470 MB.
- Espaço medido: final 2,6 a 4,1 MB, prévia 0,36 a 0,48 MB, impressão 0,6 a 0,8 MB. Conta: ~4 MB por montagem.
- Por visita (2 bases × 5 fundos): 10 montagens, ~40 MB, ~15 s de CPU na máquina de teste; as 5 da tela em ~7 s (no servidor, menos).
- Por dia (teto de 375 visitas, o número de sessões do plano do recorte; com bases por visita o real é menor): 3.750 montagens, ~15 GB, ~1,5 h de CPU espalhada. Na hora de pico (15% do dia): 56 visitas, ~14 min de CPU.
- Disco em regime: 3 dias de não vendidas (~45 GB no teto) + vendidas por 60 dias (estimativa de 110 por dia × 4 MB = 0,45 GB por dia, ~27 GB). Teto das não vendidas em 40 GB, piso de 15 GB livres. Pedir ao Ronaldo 100 GB livres.
- Mac de teste: o recorte em CPU (45 a 75 s por base) é o que demora; a montagem soma ~3 s por base.
- Medir de verdade no servidor na sexta 13/11 (`agente/medir-recorte.py` ganha `--montagem`) e gravar os números na DOCUMENTACAO-TECNICA.

## Idempotência e invalidação
- Chave `(base, fundo, versao)`: pedir duas vezes devolve a mesma linha e o mesmo `mid`. Reinício no meio: linha `fazendo` volta para `fila`; arquivo sem linha é apagado na limpeza.
- Admin tira um fundo: nada é apagado; `lista` deixa de devolver o fundo; a limpeza leva em 3 dias. Admin põe um fundo: `mont_loop` enfileira para as bases de hoje (prioridade 3) e o Checkout aberto recebe pelo `pedir`.
- Regra, fundo ou recorte novo (versão muda): as não vendidas da versão antiga saem na limpeza; as de hoje são refeitas. As vendidas ficam (A9).
- Juntar e Separar: a montagem é da base, não da visita; nenhum arquivo muda. Juntar: o `lojaAIBase` escolhe as bases da visita e pede as delas. Separar com bases devolvidas (`_vis_ia_reabre`): o `mont_loop` monta as devolvidas em até 15 s. Marca de montagem da leva separada já sai do pedido pelo `pendTiraLeva`.
- LGPD da base: tudo dela some, inclusive vendida e na nuvem.

## Compatibilidade
- App novo + agente antigo (sem `/status.montagem`): `montSrv()` falso, tudo como hoje (canvas). Sem `aiMont`. Galeria sem montagem (como hoje).
- App antigo + agente novo: o app monta no canvas e ignora o servidor. `/recorte` não muda. Na venda paga o agente resolve `aiSel` sem `aiMont` e a montagem entra na galeria do mesmo jeito.
- Janela antiga do SIM: `aiMont` é campo a mais; `SIM_V` não muda.
- Ordem de deploy: agente (3 arquivos) → app → recarregar Checkout e Postos → `config/montagem` ligada. Nuvem (E5) depois, em qualquer ordem com o agente: manifesto com `t:'ai'` numa Lambda antiga é aceito como foto comum (o id é válido) e baixa normalmente, só sem selo.

## Etapas, aceite e riscos

### E0. Porta em Python e paridade (sem efeito em produção)
`eterna-montagem.py` com `--teste` e `--regras`; `testes/montagem-paridade.js`; `FUNDOS_SHA`.
1. P1: layout igual (≤ 1e-6) nos 36 casos.
2. P2: `box` com até 1 px, `trunc` e `modo` iguais nos 36 casos.
3. P3: erro médio ≤ 2,0, no máximo 1,5% dos pontos com diferença > 16, caixa do grupo com até 0,4% da largura, na prévia e no corte de impressão.
4. Halo: no fundo branco de teste, nenhum ponto da borda mais escuro que os dois lados.
5. Telão: diferença zero fora do quadrilátero; dentro, os limites do critério 3.
6. Arquibancada 1950: tom de cinza dentro do critério 3 (pega o erro do `convert('L')`).
7. Tabela de regras do Python igual à do app; mudar um número num dos lados quebra o teste.
8. `FUNDOS_SHA` bate com os arquivos de `img/`; arquivo trocado é recusado.
9. Só importa numpy, PIL, cv2 e stdlib (teste lê os imports); roda com os requisitos do recorte sem instalar nada.
Riscos para Segurança: arquivo novo que roda no servidor; caminho por `realpath`; decodificação de imagem (limite de 40 MP).

### E1. Montar e guardar no servidor (modo sombra: ninguém lê)
Fila, banco, arquivos, gatilho, recuperação, retenção, LGPD, `/status.montagem`, `config/fundos`, `config/montagem`. Teste `testes/montagem_servidor_agente.py` (recorte e montagem falsos por atributo do módulo, como `REC_FILHO`).
10. Leva com 2 bases fecha: em até 15 s depois dos recortes há 10 linhas `pronta` (5 fundos), as 5 preferidas com `pronta` antes das reservas; 2 arquivos por linha, 600, sem `.tmp`.
11. Nome do arquivo é só o `mid` (32 hex); nenhum pid, fundo ou código LP em nome de arquivo ou no console.
12. Repetir o gatilho, reiniciar o agente e pedir de novo: nenhuma linha nem arquivo duplicado; o `mid` é o mesmo.
13. Trabalho de recorte na frente: com a fila de montagem cheia, um `POST /recorte` e a chegada de fotos pelo FTP respondem no mesmo tempo de antes (± 10%).
14. Matar o filho no meio: o agente segue respondendo `/status`, FTP e `/ponto/eventos`; a linha volta para `fila`; 3 mortes por memória param e `/status.montagem.parado` fica verdadeiro.
15. Disco abaixo do piso: nada novo com prioridade 1 a 3, `pausa_disco` verdadeiro; volta sozinho.
16. Limpeza: não vendida com 3 dias sai; vendida fica até `expira`; acima do teto saem as não vendidas mais antigas; link simbólico na pasta não é seguido.
17. Fundo novo em `config/fundos`: as bases de hoje ganham a montagem dele; fundo fora do mapa aprovado é recusado (400) e apagar o documento também.
18. Versão nova (`MONT_VERSAO` trocado no teste): não vendidas refeitas; vendida intacta, com o mesmo SHA.
19. LGPD da base: arquivos, linhas e trabalho na fila somem; nada volta na recuperação.
20. `_vis_ia_reabre` (Separar): as bases devolvidas ganham montagem.
21. Sem OpenCV ou sem o YuNet: monta sem rostos e grava `rostos` nulo; sem numpy ou Pillow: `ligada` falso com motivo, agente normal.
22. `config/montagem` desligada: nenhum trabalho, nenhum arquivo.
23. Offline: com os fundos já baixados, monta sem internet; sem o fundo, `motivo: fundo` e nova tentativa.
Riscos: disco cheio derruba FTP e vendas (piso e teto); memória (470 MB medido; exigir 2 GB livres); fundo baixado do GitHub Pages vira produto do cliente (SHA fixo); arquivos com rosto no disco (600, 3 dias, fora do backup e da nuvem).

### E2. Checkout e Posto leem do servidor
3 rotas; `compose`, `compHydrate`, `iaAquecer`, `montPoll`, `aiMont`. Testes: `testes/montagem-checkout.js`; ajustar o agente falso de `selo-edicao.js`, `cliques-ia-e2e.js`, `visitas-checkout.js`.
24. Com `montSrv()`: nenhum `POST /recorte` e nenhum `fiaMontar` no Checkout e no Posto (espião no teste); a imagem vem de `/montagens/<mid>/previa.jpg`.
25. Montagem ainda na fila: "Preparando sua foto especial..." com o selo, no lugar dela; pronta, a imagem entra sem redesenhar a tela e sem trocar de item.
26. Os 18 critérios do Checkout do plano do selo continuam passando (ordem, abertura na 1ª pronta, 8 s, âncora, vista contada uma vez).
27. Base preferida com olhos fechados (`SIM.invalid`): a montagem da outra base aparece na hora (já estava pronta).
28. Leva sem bases (jeito antigo): o Checkout pede e a montagem aparece; a 121ª chamada no minuto do mesmo IP recebe 429 e a tela segue com as fotos.
29. Servidor com montagem ligada e filho parado: "Preparando..." e, em 8 s sem toque, a tela vai para a 1ª foto; nenhuma montagem feita no navegador.
30. Agente antigo (sem `/status.montagem`): tudo igual à v97 (canvas).
31. Sem agente: sem montagem, sem selo, sem título, igual à v97.
32. Pedido grava `aiMont` com um `mid` por item de `aiSel`; `selected`, `aiSel`, `n` e valor iguais aos da v97 para a mesma escolha.
33. Rotas: outra origem, Host fora da lista ou POST sem `X-Eterna`: 403; `mid` fora do formato, `../`, caminho a mais: 404; campo desconhecido: 400; base de outra data ou fora das sessões: 404; nenhuma resposta com `Access-Control-Allow-Origin: *`.
34. Posto em outro computador (endereço de `ETERNA_ORIGENS`): miniaturas do pedido com a montagem do servidor.
35. Portão: folha lado a lado (canvas × servidor) de 10 montagens reais aprovada pelo Eduardo.
Riscos: `lista` devolve estado de montagem a quem souber o pid (terminal do ponto, mesma confiança do `/recorte` e do `/thumb` de hoje; sessão na `idiomas-base`); `pedir` como forma de encher disco (só sessão de hoje ou ontem, fundo aprovado, taxa, fila com teto, piso); `mid` como chave de acesso (128 bits, nunca em log).

### E3. Impressão pelo arquivo do servidor
36. `printMontar` de venda com 2 montagens: as 2 imagens vêm de `/montagens/<mid>/impressao.jpg`, 1844×1240; nenhum `compHi`.
37. Pelo `POST /imprimir`: item `{mont}` imprime o arquivo do servidor; `mid` de montagem não vendida ou inexistente é recusado; base64 continua valendo (app antigo).
38. O corte bate com o do `compHi` (critério 3) nos 6 fundos; Telão cortado no meio da altura.
39. Nenhum selo nem nome do fundo no arquivo (comparar com o `final` sem texto).
40. Reimpressão usa o mesmo arquivo (mesmo SHA).
Riscos: `{mont}` abre arquivo por id no servidor (regex, só `vendida`, caminho montado pelo servidor).

### E4. Galeria local e venda
`mont_vender`, `_gal_montagens`, `gal_processar`, `galeria_obj`, `vGaleriaQR`; sai o aviso do Posto.
41. Zona Mista e Maracanã Mais com 1 montagem + 2 fotos, PIX confirmado: a galeria tem as 3, a montagem baixa (o caso da Investigação D1).
42. Gramado: a montagem imprime e também está na galeria.
43. Manifesto do navegador com `t:'ai'` inventado, ou de montagem não vendida: o item não entra (contado em `ignoradas`).
44. Venda paga antes da montagem pronta (app antigo): a galeria mostra "chegando" e completa sozinha.
45. Montagem comprada aparece depois de qualquer selfie aceita da galeria, mesmo se o rosto não bater na montagem (Telão).
46. Download: JPEG de 3000 px, sem selo, sem EXIF; na tela, selo "Edição Maracanã" e nome do fundo nas 5 línguas.
47. Montagem não comprada nunca aparece na galeria; galeria de escola nunca tem montagem.
48. Venda cancelada antes de publicar: montagem desmarcada; galeria vencida ou encerrada: arquivo apagado na limpeza.
49. Posto: nenhum aviso nem bloqueio de pacote só digital com montagem marcada; teste do aviso removido.
50. Regra nova depois da venda: o arquivo da galeria é o mesmo (SHA igual).
Riscos: entrega de produto pago (falha silenciosa = cliente sem foto: alerta no Posto quando a venda paga tem montagem sem arquivo depois de 5 min); montagem de uma família na galeria de outra (só entra por venda paga cujas levas estão no manifesto).

### E5. Nuvem
51. Montagem vendida: `alta/<mid>.jpg` e `vitrine/<mid>.jpg` no S3; a não vendida nunca sobe (conferir a fila `nuvem.db`).
52. Celular na `#g`: a montagem comprada aparece com o selo e baixa.
53. Sem internet na venda: sobe sozinha quando volta; a galeria local já tem.
54. `indexar` não chama o Rekognition para item `ai`.
55. LGPD e galeria encerrada: os dois objetos do `mid` saem do S3.
56. Lambda antiga com manifesto novo: aceita e entrega a montagem como foto comum.
O que muda na nuvem: 2 objetos por montagem vendida (~1,2 MB + ~0,15 MB). No teto de 110 por dia e 60 dias: ~9 GB, menos de US$ 1 por mês de S3 mais a saída dos downloads (centavos). Com 100 venues, menos de US$ 100 por mês. O bucket de hoje é o de teste (apaga em 7 dias, us-east-2): produção precisa do bucket com regra de 60 dias, pendência que já existe.
Riscos: rosto de cliente na nuvem só de venda paga, com o consentimento que já vale para as fotos; segredo do ponto como única autenticação do `POST /ponto/galerias` (igual a hoje).

### E6 (depois da v98). Limpeza
Admin e Laboratório pedem a prévia ao servidor; saem `fiaMontar` e companhia do app, a cópia de 2400 px e o `compHi`. Só depois de 2 semanas de produção sem voltar ao canvas.

## O que entra na v97 e o que fica para a v98
- **v97 (sem risco para a operação):** E0 inteira (arquivo novo e testes; nada chama em produção) e E1 com `config/montagem` desligada por padrão. Ligada só no Mac de teste e, na sexta 13/11, no servidor novo, em modo sombra: o servidor monta e guarda, o Checkout continua no canvas. Serve para medir tempo, disco e paridade com fotos reais na RTX 5060 Ti sem tocar na venda.
- **v98:** E2 a E5, nesta ordem, cada uma publicável sozinha. A E2 depende do portão do critério 35 e do agente novo no servidor do estádio (merge na `idiomas-base` com as rotas na matriz). O aviso do Posto para pacote só digital fica na v97 e sai na E4.
- Não entra na v97: qualquer mudança no caminho do Checkout, da impressão ou da galeria.

## Riscos gerais para o revisor de segurança e de escala
- **Duas fontes da mesma imagem** durante a transição (canvas com agente antigo, servidor com o novo). A paridade é o que impede o cliente de ver uma coisa e receber outra; por isso o `aiMont` fixa o arquivo vendido.
- **Regras duplicadas** (JS e Python) até a E6: o critério 7 trava a divergência.
- **Conflito com a `idiomas-base`**: rotas novas no handler e no `cors()`, `ev_receber`, `gal_processar`, `imprimir`, `instalar-servidor.ps1` e `eterna-vigia.ps1` (3º arquivo). Não publicar o agente do main no servidor do estádio.
- **Conflitos no app**: `compose` e `compHydrate` (selo, `ondas-ux`), `printMontar` e `pendConfirmar` (`posto-unico`, `checkout-espera`), `vGaleriaQR` (`fix/galeria-testes`, que muda as compradas sem selfie: a montagem segue a regra das compradas).
- **Escala**: 1 venue com notebook: liga só se houver 16 GB e disco; senão `config/montagem` desligada e tudo como hoje. 100 venues: tudo local, nada cresce na nuvem além das vendidas. Dia de jogo (pico 3×): fila maior, preferidas primeiro; a reserva atrasa sem afetar a tela.
- **Internet caída**: nada muda no ponto (fundos em cache local, galeria local); só o envio à nuvem espera.
- **Mal-intencionado na rede do ponto**: rotas só para Host e origem da lista; sem listagem geral (precisa do pid); taxa por IP; nenhum caminho vindo do cliente chega ao disco.
- **Backup**: `montagens.db` entra; os arquivos não. Disco perdido: a vendida que já subiu está na nuvem em 3000 px; a que não subiu é refeita da foto original pela mesma versão. Aceito nesta entrega; avaliar cópia das vendidas no backup.
- **Relógio e virada do dia**: pasta pelo dia da criação; `expira` pela galeria.

## Testes que o Testador roda
`node testes/montagem-paridade.js`, `python3 testes/montagem_servidor_agente.py`, `node testes/montagem-checkout.js`, `node testes/selo-edicao.js`, `python3 servidor/galeria-nuvem/teste_local.py`, `bash testes/rodar.sh` (o `py_compile` e a lista de testes do agente ganham os arquivos novos). Medição no Mac e no servidor com `agente/medir-recorte.py --montagem`.

## Esforço estimado (dias de trabalho da esteira, sem revisão e teste; somar ~40%)
| Etapa | Dias |
| --- | --- |
| E0 porta e paridade | 2 |
| E1 montar e guardar | 2,5 |
| E2 Checkout e Posto | 1,5 |
| E3 impressão | 1 |
| E4 galeria local, venda, aviso do Posto | 2 |
| E5 nuvem | 1,5 (mais o deploy do Ronaldo) |
| E6 limpeza | 1 |

## Decisões (assumidas em 11/11 para a implementação; o Eduardo pode mudar)
- D1. Retenção da montagem não vendida: **3 dias** (`MONT_DIAS`).
- D2. **As 10 por visita** (2 bases × 5 fundos); as 5 que a tela mostra saem primeiro, as 5 de reserva depois.
- D3. Download da galeria em **3000 px**; o arquivo de **5000 px fica guardado no servidor para a impressão**.
- D4. Telão no **tamanho nativo do fundo (2576×1840)** por enquanto.
- D5. **Portão da E2, ainda aberto**: o Eduardo aprova a folha lado a lado (canvas × servidor) antes de o Checkout trocar. Até lá a E2 fica atrás do interruptor `config/montagem {"checkout": false}` (desligado por padrão; `/status.montagem.checkout`). Folha com figuras sintéticas gerada pelo `testes/montagem-paridade.js` (`MONTAGEM_FOLHA=<arquivo.jpg>`); a de fotos reais sai no servidor do estádio.
- D6. Montagem não comprada à venda na galeria online: **fora** desta entrega.
- D7. Venda paga com montagem que falhou no servidor: **alerta no Posto** (entra na E4).

## Registro da implementação (E0 e E1, 11/11)
- **E0** (`58e675d`): `agente/eterna-montagem.py`, `agente/gerar-fundos-sha.py`, `FUNDOS_SHA` e o Telão no `FUNDOS_PREVIA` do agente, `testes/montagem-paridade.js` (com `testes/_montagem_paridade.py`). Paridade medida nos 36 casos (Chromium do ambiente de teste): layout com diferença 0, medida com 0 px, prévia com as mesmas entradas erro médio 0,12 (pior 0,50) e 0,05% dos pontos acima de 16 no pior caso, caixa do grupo 0; impressão 10×15 erro médio 0,94 (pior 1,40; 0,42%); Telão sem nada mexido fora da tela; halo sem ponto mais escuro que a pessoa.
- O que a paridade pediu além do plano: a ampliação do fundo na regra 10 é cúbica de Mitchell truncada para 8 bits (`ampliar`), e entre um filtro de cor e o seguinte do Telão o canvas trunca para 8 bits; os dois medidos contra o Chromium e marcados no código. A medida do grupo usa redução bilinear sem antialias em numpy (deu 0 px de diferença, sem depender do OpenCV).
- **O arquivo do servidor não é idêntico à prévia de hoje, por causa do fundo**: o servidor monta com o fundo de 5000 px (o da impressão) e a prévia do navegador usa o de 2400 px; os dois arquivos de cada fundo diferem entre si (erro médio de 1,1 a 2,6 só no fundo, medido em `notas.fundos_5000_x_2400`). Com as mesmas entradas, navegador e servidor dão a mesma imagem. Na E2 a prévia do Checkout passa a ser a do arquivo que imprime. O teste mede esse caso como "servidor" e não o trava; a folha lado a lado mostra os dois números.
- `--teste` aceita uma lista de pedidos (um processo para os 36 casos) e `so_layout`/`so_medir`/`so_rostos`. Rostos: a leitura do YuNet do Python roda com o modelo do repositório; a paridade de rostos com fotos de gente fica para a folha de fotos reais (as figuras sintéticas não têm rosto; o caso da criança usa a lista fixa dos dois lados).
- **E1**: bloco `mont_*` no `eterna-agente.py`, `testes/montagem_servidor_agente.py` (com `testes/_montagem_filho_falso.py`). A fila é o próprio banco (linha `fila`, por prioridade e ordem de entrada), sem fila em memória: sobrevive ao reinício. Preferida = `min(BASE[fundo], n − 1) == posição` (a conta do `lojaAI`; a fórmula do plano trocava os lados com 1 base só). A tabela `BASE` e a regra de cada fundo vêm do `eterna-montagem.py` (o agente carrega o arquivo; não há terceira cópia). O cache do fundo é o mesmo arquivo do `bg_bytes` (`~/Eterna/fundos/v83-...`), agora com o SHA conferido.
- `config/fundos` e `config/montagem` inválidas ou apagadas: recusadas no `estado_gravar` como a `config/ia` (documento não gravado, `gravados` não conta, linha no console); a rota `/ponto/docs` não responde 400 para um documento recusado.
- `config/montagem` ganhou `checkout` (interruptor da E2, D5) e `/status.montagem` ganhou `checkout`, `motivo` e `dias`; `imprime` fica falso até a E3.
- Medido na máquina de teste (2 núcleos divididos, recorte sintético de 1200 px): 10 montagens de uma visita em 8 a 9 s, 0,8 s por montagem, pico de 490 a 510 MB no processo filho, 2,3 MB por montagem (final + prévia; foto real pesa mais).
- Ficou de fora da E1: `agente/medir-recorte.py --montagem`; o critério 13 só confere que `/status` responde com a fila cheia (a medida de ±10% no `POST /recorte` e no FTP fica para o servidor do estádio); apagar do S3 e do manifesto na LGPD (entra com a E4 e a E5, quando a montagem passa a ir para lá); instaladores e vigia com o 3º arquivo (Ronaldo, `idiomas-base`).

## Decisões para o Eduardo (texto original das propostas)
- D1. Retenção da montagem não vendida: 3 dias (proposta). Mais dias = mais disco (~15 GB por dia no teto).
- D2. Quantas montagens por visita: as 10 (2 bases × 5 fundos, como pedido; proposta) ou só as 5 que o Checkout mostra, com a reserva feita em ~2 s quando a base preferida é ruim (metade do disco e do tempo).
- D3. Tamanho do download na galeria: 3000 px como as outras fotos (proposta) ou o arquivo cheio de 5000 px (3 vezes mais pesado no celular e na nuvem).
- D4. Telão em 5000 px: hoje o fundo só existe em 2576×1840; a montagem do Telão sai nesse tamanho (imprime bem em 10×15). Gerar o fundo em 5000 px e medir de novo os 4 cantos, se quiser o mesmo padrão dos outros.
- D5. Aprovar a folha lado a lado (canvas × servidor) com 10 montagens reais antes de o Checkout trocar (portão da E2).
- D6. Montagem não comprada à venda na galeria online: fora desta entrega (proposta). Confirmar que fica para depois.
- D7. Venda paga com montagem que falhou no servidor (raro): o Posto alerta e a equipe refaz ou dá outra foto. Confirmar o procedimento.
- D8 (Ronaldo). 100 GB livres no servidor; 3º arquivo no instalador e no vigia; as 3 rotas na matriz; sessão do terminal do Checkout na `idiomas-base`.
