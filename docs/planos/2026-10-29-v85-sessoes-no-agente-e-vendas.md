# Plano v85: sessões montadas no agente, várias vendas por sessão e pedido Imply obrigatório

Base: `origin/main` em `c27b97d`, com a v84 (recorte local, working tree) já aplicada por cima. Sugestão de arquivo para o plano: `/home/claude/eterna/docs/planos/2026-10-29-v85-sessoes-no-agente-e-vendas.md`. O nome precisa ser diferente de `2026-10-28-v85-nuvem-e-ponta-da-venda.md`, porque os commits da nuvem usaram o rótulo "v85" sem ganhar linha no VERSOES. Esta entrega fica com a linha v85 no `VERSOES.md`.

## Objetivo
1. A sessão nasce no agente, com o app aberto ou fechado. O app só lê as sessões prontas.
2. Uma sessão aceita várias vendas, e cada uma é confirmada com o pedido Imply.
3. A Qualidade passa a mostrar só as sessões que têm fotos neste computador.

## Escopo desta entrega
| Parte | O que entra | Prioridade |
|---|---|---|
| **A** Agente | sessões no servidor, código LP, `/sessoes` com ETag, reagrupamento das órfãs, importação das sessões do SIM e retomada da pasta vigiada | 1 |
| **B** App lê sessões | o app para de montar sessões com fotos `ag_`, guarda o feed em memória, mantém o modo antigo para agente antigo e envia as sessões antigas ao agente | 1 |
| **C** Vendas | `vendas[]` na sessão com migração, segunda compra no Checkout (fotos novas e cópias impressas), impressão, Caixa, Lista, Painel e CSV contando por venda | 2 |
| **D** Pedido Imply | campo obrigatório na confirmação (pistola, câmera com BarcodeDetector ou jsQR, ou digitado), validação, trava de código repetido, Lista e CSV | 3 |
| **E** Qualidade | filtro "Só sessões com fotos neste computador", ligado por padrão | 4 |
| **F** Guia | preparar o Chrome do posto para a DNP. Sem código de impressão | 5 |

Ordem de implementação: A → B → E → C → D → F. A e B já resolvem o Achado 1 e podem ir para o 218 sozinhas.

## Fora do escopo (fica para depois)
- Separar sessões também por rostos. A regra continua só a pausa de 45 s, como o Eduardo pediu.
- Teto de fotos por sessão.
- Validação de foto (olhos e rosto) no agente. Continua no navegador do computador do ponto.
- Feed para notebooks pareados (v83 etapa 2, partes A, B e G). Nesta versão, `/sessoes` só responde ao próprio computador.
- Pedido Imply único entre aparelhos diferentes. Precisa das vendas no agente (v83 G); nesta versão a trava vale por navegador.
- Conciliação com exportação ou API da Imply.
- Mais de uma cópia da mesma foto na mesma venda.
- Mudança no código de impressão, `--kiosk-printing` no `iniciar-eterna.bat` e impressora compartilhada no 218.
- Estorno que tira a foto da galeria. Não existe: o que foi comprado nunca regride (D12).

## Decisões assumidas (padrão mais seguro; o Eduardo pode trocar)
| # | Decisão |
|---|---|
| D1 | **Regra da sessão no agente:** os grupos são separados por fotógrafo. Uma foto entra na sessão do mesmo fotógrafo cuja janela de captura, de `cap0 − 45 s` a `cap1 + 45 s`, inclui a hora do clique dela. A hora do clique vem do EXIF `cap`; sem EXIF, da data do arquivo de origem; sem as duas, da chegada. Se nenhuma janela servir, a foto abre uma sessão nova e a aberta fecha por "pausa entre cliques". A sessão aberta fecha quando o fotógrafo fica 45 s sem mandar foto (pelo relógio do agente). Foto atrasada entra na sessão certa mesmo depois de ela fechar (`tardias`). À meia-noite, todas as abertas fecham. |
| D2 | **Quem é o fotógrafo (grupo):** primeiro a origem gravada pela ingestão (login do FTP, subpasta do login compartilhado, subpasta da pasta vigiada, subpasta do FTP do estádio), se estiver cadastrada (`ftp_cadastrados`, sem acento). Depois o nome do autor ou do dono gravado na câmera, se bater com um cadastrado. Depois `camera:<série>`. Por último `origem:<o>`. Assim, duas câmeras sem login nunca caem na mesma sessão. |
| D3 | **Código LP no agente:** `LP` + 7 caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, gerados com `secrets` e únicos entre todas as sessões guardadas. |
| D4 | **Sessões do agente não vão para o `localStorage`.** O feed fica em memória (`SRV`) e o SIM guarda só o que é da sessão no navegador (pick, vendas, cortesia, menor, bandeira, pendência). Motivo: com 15 mil fotos por dia, gravar as listas de fotos estoura os ~5 MB do `localStorage`. |
| D5 | **Compatibilidade:** o agente sem `st.sessoes` (v84 ou anterior) continua com a montagem antiga no navegador (`ingPush`/`ingClose`). O app v85 funciona com os dois agentes. |
| D6 | **Sessões que já estão no SIM continuam valendo:** a cada boot do agente, o app manda as sessões do SIM que têm fotos `ag_` (`POST /sessoes/legado`). Quando a mesma foto está nas duas, a sessão do SIM ganha da sessão `reagrupada` do agente, a menos que a do agente esteja em `protegidas` (sessões com venda ou pendência neste navegador). Sessão do agente que fica sem foto vira `removida`. |
| D7 | **Órfãs:** no primeiro boot com a v85, o agente reagrupa as fotos dos últimos 7 dias que não estão em sessão nenhuma. Em todo boot seguinte, reconcilia hoje e ontem, para cobrir uma queda entre a ingestão e a gravação. |
| D8 | **Retenção:** 60 dias em disco (igual à galeria e às leituras de rosto, D10) e 7 dias em memória. `/sessoes` devolve hoje e ontem; dias anteriores vêm com `?dia=`. |
| D9 | **`/sessoes` só para o próprio computador** (`loopback()`), inclusive com `ETERNA_REDE` ligado, até existir o pareamento. |
| D10 | **Cópia impressa** vira um item novo do catálogo, `copia` ("Cópia impressa", adicional, digital 0, impressa 1, R$ 35 igual à Foto adicional), com preço editável no Painel de controle. Uma cópia por foto por venda. **Pergunta para o Eduardo: qual é o preço da cópia?** |
| D11 | **Cada venda tem preço próprio:** o Ideal (`lojaIdeal`) usa só as fotos novas da venda e as cópias entram como `copia`. |
| D12 | **Comprada nunca regride**, nem quando a venda é cancelada. Cancelar mexe só no financeiro (receita, Lista, Painel), e o aviso deixa claro que as fotos continuam liberadas. A nuvem já se comporta assim (`gal_mesclar`). |
| D13 | **Venda paga com o pacote "todas" (Maracanã Mais) libera todas as fotos da sessão** na galeria. Hoje libera só as escolhidas, o que é uma falha anterior a esta versão; corrigir é necessário para o "junta os direitos". |
| D14 | **Pedido Imply obrigatório** em `pendConfirmar` (cartão, PIX e dinheiro) e também na venda no balcão (`caixaConfirm`), para a conciliação ficar completa. |
| D15 | **Formato:** vale a regra do Eduardo, que bloqueia: letras e números, de 8 a 16, em maiúsculas (espaços e hífens são tirados). Por cima vai um aviso que **não bloqueia** quando o código não segue o padrão conferido pelo Ronaldo (`^\d{4}[A-Z0-9]{8}$`, com MMDD = hoje no fuso do venue). Exemplo: o número de reimpressão `102972U3H6`. Para seguir, o vendedor toca em "Usar mesmo assim". Só números com 13 a 19 dígitos é recusado como "parece número de cartão" e nunca é gravado. |
| D16 | **Leitura:** com a pistola, o Enter no campo confirma. Pela câmera, o código lido só preenche o campo; a confirmação continua sendo Enter ou toque. `leitura` = `pistola` quando 8 ou mais caracteres chegam em menos de 300 ms, `camera` ou `digitado`. |
| D17 | **jsQR 1.4.0 (Apache-2.0)** em `vendor/jsqr/`, carregado sob demanda só quando não há `BarcodeDetector` (Windows). |
| D18 | O id da venda é o id da pendência (`r.id`), como já acontece. Cada venda tem `saleNo` próprio (`pvSaleNo`). |
| D19 | **Pasta vigiada retoma depois de queda** (A7). Achado: hoje, o que entra na pasta do FTP com o agente fechado nunca é ingerido. Isso pega em cheio o 218, que vai vigiar a pasta do FTP da Microsoft. A correção é pequena. |
| D20 | Impressão: só o Guia (Achado 3). Não achei necessidade de mudar o código. |

---

## Mudanças por arquivo

### `/home/claude/eterna/agente/eterna-agente.py` (parte A)

**Constantes e estado** (perto de `META`):
- `SESS_DIR = ~/Eterna/ponto/sessoes`, um arquivo `AAAA-MM-DD.jsonl` por dia.
- `SESS_CFG = ~/Eterna/ponto/sessoes-config.json` (`{ponto}`).
- `SESS_GEN = ~/Eterna/ponto/gen.json`: id aleatório criado uma vez, o mesmo previsto na v83 C.
- `SESS_MIG = ~/Eterna/ponto/sessoes-migracao.json`.
- `SESS_PAUSA = 45`. `ETERNA_SESSAO_PAUSA` só vale de 2 a 600 e existe para os testes.
- `SESS_MEM_DIAS = 7`, `SESS_RET_DIAS = 60`, `CARD_ALFA`.
- `sess_lock = threading.RLock()`.
- `sess = {}` (card → obj), `sess_pid = {}` (pid → card), `sess_aberta = {}` (grupo → card), `sess_rev = [0]`.
- Ordem de travas: **nunca** pegar `lock` com `sess_lock` na mão. Ler `meta[pid]` sob `lock` antes de chamar `sess_add`.

**Funções novas:**
- `sess_quem(o, s, autor, dono, serie)` → grupo, pela regra D2. Usa `sem_acento` e `ftp_cadastrados()`.
- `sess_cap(pid, m, t_origem)` → `m["cap"]`, senão a data do arquivo de origem, senão `m["u"]`.
- `sess_codigo()` → código único (D3).
- `sess_gravar(s)`:
  - faz `rev += 1`, `s["rev"] = rev`;
  - anexa uma linha JSON em `SESS_DIR/<s.dia>.jsonl` e dá `flush`;
  - dá `os.fsync` só quando a sessão fecha ou é removida.
- `sess_carregar()` no boot:
  - lê os últimos 7 dias (vale a última linha de cada card);
  - reconstrói `sess_pid`, `sess_aberta` e `rev`;
  - compacta cada arquivo (tmp + `os.replace`);
  - fecha com `virada_do_dia` as sessões abertas de dias anteriores;
  - fecha com `pausa_45s` as abertas cuja `ultima_chegada` passou do limite.
- `sess_add(pid, o, s_kind, cap, chegada, serie, autor, dono)`:
  - chamada no fim de `ingest_file` (ramo `new`, depois de `nuvem_enfileira`, fora do `lock`);
  - aplica a regra D1;
  - procura candidatas só no mesmo grupo e só em sessões abertas nas últimas 12 h;
  - foto que já está em `sess_pid` não muda de sessão;
  - grava a sessão alterada.
- `sess_loop()` (thread de 2 s):
  - fecha as ociosas (`pausa_45s`);
  - na virada do dia, fecha as abertas, compacta e apaga arquivos com mais de 60 dias;
  - tira da memória o que tem mais de 7 dias.
- `sess_reconciliar(dias)`:
  - pega os pids da `lib` com chegada (`meta.u`) nos últimos `dias` que não estão em `sess_pid`;
  - agrupa por (dia de chegada, grupo), ordena por `cap` e corta onde a pausa passa de 45 s;
  - cria sessões `fechada` com `origem:'reagrupada'` e `fechada_por:'reagrupada'`;
  - no `main()`, roda com 7 dias se `SESS_MIG` não existir (e grava `SESS_MIG` com `{em, reagrupadas, fotos}`); senão, com 2.
- `sess_legado(lista, protegidas)`: regra D6.
  - Card legado: `^[A-Z0-9]{4,16}$`.
  - Só entram pids com `pid_ok` que estejam na `lib`.
  - Card que já existe com `origem:'legado'` é mesclado (união das fotos); card de outra origem é ignorado.
  - Foto que está numa sessão `reagrupada` ou `agente` fora de `protegidas` passa para o card legado.
  - Devolve `{importadas, ignoradas, fotos_movidas, absorvidas}`.
- `sess_feed(desde, dia)`: monta a resposta do contrato abaixo.

**Rotas:**
- `GET /sessoes`:
  - exige `loopback()` e `origem_privada_ok`, senão 403;
  - entra em `rota_privada` (CORS só para a origem do agente e `APP_ORIGIN`);
  - `If-None-Match` igual ao ETag atual devolve 304 sem corpo (`send_response(304)` + `cors()` + `ETag`);
  - `Cache-Control: no-cache`.
- `POST /sessoes/legado`:
  - exige `loopback()`, `Host` em `HOSTS_OK`, `Origin` ausente, local ou `APP_ORIGIN`, e o cabeçalho `X-Eterna: 1` (força o preflight);
  - `corpo(2 MB)`, até 5000 sessões, até 500 fotos por sessão.
- `POST /sessoes/ponto`: mesmas travas, `corpo(1 KB)`, `ponto` `^[a-z0-9_-]{1,24}$`. Grava `SESS_CFG`; as sessões novas levam `ponto`.
- `/status` ganha `"sessoes": {"v":1, "pausa":45, "abertas":n, "hoje":n, "rev":r, "gen":g}`.

**`main()`:** depois de `load_lib()` e `gal_indexar()`, roda `sess_carregar()`, depois `sess_reconciliar(...)`, depois a thread `sess_loop`. Imprime "Sessões: N hoje (montadas aqui, regra de 45 s)".

**A7 Pasta vigiada (D19):**
- Gravar `~/Eterna/pasta-vigiada.json` `{pasta, visto_ate}` a cada 30 s.
- No boot, com a mesma `pasta`, os arquivos com `mtime > visto_ate − 60` entram (a duplicada é barrada pelo `seen`, como hoje).
- Pasta nova ou sem o arquivo: segue a regra atual ("o que já estava lá não entra").

### `/home/claude/eterna/index.html`

**Parte B: leitura das sessões**
- `SRV = {gen:null, rev:0, etag:null, s:{}}`, só em memória.
- `agentPoll`:
  - guarda `a.sessoes = st.sessoes || null`;
  - com `a.sessoes`, chama `srvPull()` a cada volta;
  - **não** chama `ingPush` para foto real nem o `ingClose` por 45 s;
  - continua lendo `/events` para a Biblioteca e para o aviso de duplicadas;
  - com `a.boot` novo, chama `legadoEnviar()` e `sessPontoEnviar()`.
- `srvPull()`:
  - `GET /sessoes?desde=<rev>` com `If-None-Match` e `AbortController` de 4 s;
  - `gen` diferente: limpa `SRV` e pede o feed completo;
  - mescla por card (`removida` apaga);
  - cria `UP['ag_'+pid]` com a miniatura;
  - card que passou a `fechada` desde a última leitura vai para `srvFechou(s)`;
  - redesenha só se mudou algo.
- `srvFechou(s)`:
  - grava a linha "Grupo fechado pelo servidor" em `state.ing.feed` e uma entrada em `g.done`;
  - em `pontoModo()==='local'`, põe a sessão na fila `srvValidar` (uma por vez, `validateReal`) e marca `SIM.validado[card] = dia`, com poda de 2 dias.
- `srvKey(f, dia)`: `P[f]` humano → `f`; senão `keyByName`; `camera:<série>` → `camWho(série, dia)`; senão `'sem'`.
- `srvSess(card)` → `{card, key, pdv, date:<ISO>, time, photos:[{id:'ag_'+pid, sold:0}], status, srv:true}`. O `pdv` vem do nome em `DATA.points` pelo `ponto`.
- `sessPhotos(card)`: as fotos do SIM; se não houver, as do `SRV`.
- Usar o `SRV` em:
  - `demoSessions()`: só as `fechada`. A `aberta` não vai para o Checkout nem para a busca por rosto. Se o card também está no SIM com fotos, vale o SIM;
  - `revSessions()`;
  - `photosInSessions()`;
  - `libIndex()`;
  - `ajRaw()`;
  - `simOf(card)`: cria o registro do SIM a partir do `SRV`, sem `photos`, com `date` em ISO (nunca `'hoje'`).
- `legadoEnviar()`: uma vez por `boot` do agente nesta página. Envia `SIM.sessions` que tenham fotos `ag_`. `protegidas` = cards com `vendas.length`, `din` ou `status` `paga`/`aguardando`.
- `sessPontoEnviar()`: no `case` que troca o ponto no Upload automático e ao conectar.
- Upload automático (`vImportar`) com `a.sessoes`: "Sessões" = sessões de hoje no `SRV`; "Sessões criadas nesta leva" vira "Sessões de hoje (montadas no computador do ponto)", com as 30 mais novas. A simulação sem agente fica como está.

**Parte E: Qualidade**
- `state.revFilter.aqui`, padrão `true`, lembrado em `localStorage['eterna.rev.aqui']`.
- Em `vRevisao`, o botão `data-act="rev-aqui"` ("Só sessões com fotos neste computador") e o filtro `s.photos.length > 0`.
- Nota: "N sessões da Roverpix sem fotos aqui estão escondidas".
- Não grava, então não entra em `WRITE_OPS`.

**Parte C: vendas**
- **Modelo:** `SIM.sessions[card].vendas = [venda]`. A venda usa **os mesmos nomes de campo** que a sessão usava, então `saleTotal`, `simPrints`, `impFotos`, `impIniciar`, `impTxt` e `itemV` funcionam com ela sem mudar. Contrato abaixo.
- **Ajudantes novos:**
  - `sessVendas(s)`, `vendasPagas(s)`, `vendaDe(id)` → `{card, s, v}`;
  - `sessCompradas(card)` → `{ph:Set, ai:Set}`: união de `selected`/`aiSel` das vendas pagas, ou todas as fotos se alguma venda paga tem pacote `digital==='todas'` (D13);
  - `sessRecalc(s)`: `status` = `aguardando` se tem `din`; `paga` se tem venda paga; senão `pronta`, ou `no checkout` se já estava assim.
- **`migraVendasV85()`**, idempotente:
  - chamada no boot (antes do primeiro `render`), dentro de `simFresh()` e no ouvinte `storage` (depois de adotar), para o SIM gravado por uma janela antiga também ser migrado;
  - sessão com `status` `paga` ou `cancelada` e sem `vendas` vira `vendas:[{id: s.vendaId || 'mig-'+card, saleNo, estado, criada: s.paidAt, pagaEm: s.paidAt, cart, total: saleTotal(s), nFotos, selected, aiSel, fav, copias:[], prints: simPrints(s), payment, pag, seller, vendedor, posto, caixaPor, caixaEm, impressao, impressoes, canal:'balcao'|'loja', imply:null, migrada:85}]`;
  - depois, apaga esses campos da sessão (`cart:[]`, `selected:[]`, `aiSel:[]`, `fav:[]`, `pick:{}`) e roda `sessRecalc`;
  - grava `SIM.modeloV = 85`.
- **Checkout (segunda compra):**
  - `lojaJaPaga` e as duas chamadas em `lojaPedido` saem;
  - a tela de `ljAlreadyPaid` em `vQuiosque` sai, e a chave `ljAlreadyPaid` sai do `I18N` (atualizar os testes que usam a chave);
  - `review`: item em `sessCompradas` ganha o selo `<span class="lj-owned">${T('ljOwned')}</span>` e fica sem marca d'água; se a sessão tem comprada, `T('ljOwnedHint')` aparece abaixo do título; ✓ numa comprada = cópia;
  - `lojaSync`: `s.selected`/`s.aiSel` só com as novas, `s.copias` = chaves das compradas marcadas, e `s.fav`;
  - `lojaCart`: `n` = só as novas, `lojaIdeal(n)`, mais `copia × nCop` no `cart`; `prints = printsVenda(cart, n)` (já soma 1 por `copia`); linha `{t:'copia', n, un, v}`; "o que você leva" ganha `[ICO.print, T('incCopy',n), T('incCopyD')]`; a economia (`save`) conta só as novas;
  - `lojaPedido`: `rec` ganha `copias` e `nCop`; `pvDados` ganha `copias`.
- **`pendConfirmar(id, {ref, imply, leitura, avisoOk})`:**
  - valida o Imply (parte D) antes de tudo;
  - **não** recusa mais sessão `paga`: só a pendência que não está `aguardando` (idempotência de `dinPegar`);
  - cria `venda` a partir de `r` e dá `s.vendas.push(venda)` e `impIniciar(venda)`;
  - aplica `aiOf(card).bought` para o `aiSel`;
  - zera `s.pick/selected/aiSel/copias/fav`, apaga `s.din` e roda `sessRecalc(s)`;
  - `r.imply = venda.imply`;
  - depois do `saveSim`: `pvEvento('pagar', r.id, {ref, prov, imply: pedido})` e `galDaVenda(card)`.
- **`caixaConfirm()`:**
  - sai a recusa "Esta sessão já está paga";
  - trava `state.caixaConfirmando` e `cart` vazio (sem carrinho não confirma), contra o duplo clique;
  - exige o Imply (`#caixa-imply`);
  - cria a venda (`canal:'balcao'`) e zera `s.cart`/`s.selected`.
- **Impressão v83** passa a ser por venda: `impVendas()` devolve `[[vid, v, card]]`.
  - `impPainel(vids)`, `impImprimir(vid, re)`, `impOk(vid)`, `impFalha(vid)`, `impReimprimir(vid)`, `state.impSel[vid]`, `state.impJob.venda`.
  - `data-venda` em vez de `data-card` em `imp-pick`, `imp-print`, `imp-ok`, `imp-falha`, `imp-reprint`, `imp-repick`, `imp-reprint-ok` e `imp-motivo`.
  - `impFotos(v)` põe as cópias primeiro (`{k:'cp:'+k, ...}`) e depois as novas, até `v.prints`.
  - O cabeçalho do item mostra `saleNo` e a sessão.
  - Os alertas de impressão (perto da linha 3391) também percorrem as vendas.
- **Galeria:**
  - `galAtualizar` usa `sessCompradas(card)` no lugar de `sim.status==='paga' && selected`;
  - a regra de "comprada online fica" continua;
  - `galDaVenda(card)` não muda: o mesmo token por sessão é republicado com a união, e a nuvem mescla sem regredir.
- **Lista, Caixa, Painel e CSV:**
  - `allSalesSim()`: uma linha por venda (`paga`/`cancelada`), mais as pendências de `caixaDin` como hoje;
  - `photos` = `nFotos` (sem as cópias) e `prints` = `v.prints` (com as cópias);
  - `painelEterna` herda isso;
  - `salesCSV` ganha `pedido_imply` e `imply_leitura` **no fim**, sem mudar a ordem das colunas que já existem;
  - `vVendasLista`: coluna "Pedido Imply", e a busca também procura o pedido;
  - `sales-cancel` e `sales-receipt` com `data-venda`. Cancelar põe `estado:'cancelada'`, `canceladaEm`, `canceladaPor` e o aviso "Venda cancelada. As fotos continuam liberadas na galeria do cliente." (D12), sem `galAtualizar` regressivo;
  - `receiptPanel(s, v)` e o Caixa "Pagas hoje" por venda (`state.caixa.venda`);
  - `minhasVendas()` por venda;
  - `libIndex`/`revSessions` marcam vendida por `sessCompradas`;
  - `lojaEquipe` ("Sessões esperando") mostra as sessões sem venda paga;
  - `novoSaleNo` conta vendas;
  - `simResumo` troca o `imp` da sessão por `vid:estado:feitas:impressoes` de cada venda.
- **Catálogo:** item `copia` em `DATA.catalog`, `'copia'` em `PN_PRECO` (`painelDados`) e o mapeamento em `prodKey`/ranking do catálogo.

**Parte D: pedido Imply**
- **Ajudantes:**
  - `implyLimpa(v)`: maiúsculas, sem espaços e sem hífens;
  - `implyErro(v)`: vazio, cartão (`^\d{13,19}$`) ou fora de `^[A-Z0-9]{8,16}$`;
  - `implyAviso(v)`: D15, com `venueToday()`;
  - `implyUsado(p, exceto)`: varre `vendas` de todas as sessões e `caixaDin` confirmadas e devolve `{saleNo, card}`.
- **`pendPainel`:**
  - "Pago na maquininha" e "Recebi R$ X" (o `din-confirm` passa a só abrir o painel) abrem o mesmo bloco;
  - campo `#pend-imply` (`data-keep`, `autocomplete="off"`, `maxlength=24`, fonte mono grande, `autofocus` depois do render), ao lado do botão `imply-cam` "Ler pela câmera";
  - para cartão e PIX, o `#pend-ref` (NSU, opcional) continua;
  - `pend-pos-ok` confirma os dois casos;
  - Enter em `#pend-imply` confirma, como já acontece no `#pend-ref`;
  - o tempo das teclas (`keydown`) vai para `state.pend.tecla` e decide `leitura`;
  - com aviso de formato, aparece `imply-aviso-ok` ("Usar mesmo assim");
  - erro de pedido repetido: "Este pedido Imply já está na venda L0-012 (sessão LP...). Confira o canhoto." A tentativa vai para `SIM.implyRecusas` (até 50: `{em, pedido, venda, porNome}`), para o `log` e para os Alertas do dia.
- **`implyCam()`:**
  - modal `#modal` com `<video>`, `getUserMedia({video:true})`;
  - leitura a cada 150 ms: `BarcodeDetector` com `qr_code`, se existir; senão `implyJsqr()`, que injeta `vendor/jsqr/jsQR.js` uma vez e lê um canvas de até 640 px com `inversionAttempts:'dontInvert'`;
  - lido e válido: preenche `#pend-imply` (ou `#caixa-imply`), para as trilhas, fecha e foca o botão de confirmar;
  - 30 s sem ler: "Não li o QR. Digite o código.";
  - `implyCamStop()` também roda no Cancelar, no `render` que tira o modal e no `pagehide`;
  - nenhum quadro é guardado.
- **`WRITE_OPS`/`ACT_MOD`:**
  - `imply-aviso-ok: 'c'`, módulo `venda`, igual a `pend-pos-ok`;
  - `imply-cam` e `imply-cam-fechar` não gravam;
  - na venda no balcão, o campo fica junto do `caixa-confirm` que já existe.
- **Venda:** `imply: {pedido, leitura:'pistola'|'camera'|'digitado', aviso:bool, em, porNome}`.

**CSS:**
- `.lj-owned`: selo amarelo `#FFB800` sobre azul noite `#0C2340`, Inter 600, no canto de cima à esquerda;
- `.pend-imply input`: mono, 22 px, `letter-spacing: .08em`;
- `.imply-cam video`: 100% da largura do modal, máximo 480 px.

**Carimbo:** `v85` nas duas ocorrências.

### I18N (telas do cliente, 5 línguas: pt, en, es, fr, de)
| Chave | pt | en | es | fr | de |
|---|---|---|---|---|---|
| `ljOwned` | Já é sua | Already yours | Ya es tuya | Déjà à vous | Gehört schon dir |
| `ljOwnedHint` | As fotos marcadas como suas já foram compradas. Toque em ✓ numa delas para levar mais uma cópia impressa. | Photos marked as yours are already purchased. Tap ✓ on one to take another printed copy. | Las fotos marcadas como tuyas ya están compradas. Toca ✓ en una para llevar otra copia impresa. | Les photos marquées comme vôtres sont déjà achetées. Touchez ✓ sur l’une d’elles pour emporter un autre tirage. | Als deine markierte Fotos sind schon gekauft. Tippe bei einem auf ✓ für einen weiteren Abzug. |
| `sumCopy(n,x)` | `n` cópia(s) impressa(s) × x | `n` printed cop(y/ies) × x | `n` copia(s) impresa(s) × x | `n` tirage(s) × x | `n` Abzug/Abzüge × x |
| `incCopy(n)` | `n` cópia(s) impressa(s) 10×15 | `n` printed cop(y/ies) 10×15 | `n` copia(s) impresa(s) 10×15 | `n` tirage(s) 10×15 | `n` Abzug/Abzüge 10×15 |
| `incCopyD` | das fotos que já são suas | of photos you already own | de las fotos que ya son tuyas | des photos qui sont déjà à vous | von Fotos, die dir schon gehören |

Use `PL()` como em `sumExtra`. Os textos do Posto ficam só em pt (tela da equipe).

### Outros arquivos
- `/home/claude/eterna/vendor/jsqr/jsQR.js`: `dist/jsQR.js` do pacote npm `jsqr@1.4.0`, com o sha256 anotado.
- `/home/claude/eterna/vendor/jsqr/LICENSE`: Apache-2.0, cópia integral.
- `/home/claude/eterna/vendor/jsqr/LEIAME.md`: origem, versão, sha256, licença.
- `/home/claude/eterna/docs/GUIA-DA-EQUIPE.md` (parte F), seção "Novidades da v85":
  1. **Sessões montadas no computador do ponto:** não é preciso deixar o Eterna aberto.
  2. **Segunda compra.**
  3. **Pedido Imply:** pistola, câmera ou digitado; o que fazer com "já está na venda X".
  4. **Preparar o Chrome do posto para a DNP (TI, uma vez):**
     - instalar o driver e deixar a DNP como impressora padrão; no Windows, desmarcar "Permitir que o Windows gerencie minha impressora padrão";
     - nas preferências do driver: PR 4×6 (10×15), sem borda, **em cores**;
     - abrir o Chrome **sem** `--kiosk-printing`, imprimir uma foto de teste pelo Posto e, na janela de impressão, escolher Destino DNP, Cor: Colorida, Mais definições → Tamanho 4×6 / PR, Margens: Nenhuma, Escala: Padrão, **desmarcar "Cabeçalhos e rodapés"**;
     - fechar **todas** as janelas do Chrome e abrir pelo atalho com `--kiosk-printing` no **mesmo perfil** (outro `--user-data-dir` perde essas opções);
     - imprimir de novo e conferir: sem data e endereço no papel, colorida;
     - a venda é fechada no computador que tem a DNP no USB (Achado 3).
  5. **Variante Mac.**
- `/home/claude/eterna/docs/DOCUMENTACAO-TECNICA.md`: seção "Sessões no agente e vendas por sessão (v85)", com os contratos abaixo.
- `/home/claude/eterna/docs/CONTEXTO-ETERNA.md`:
  - seção 3: "Sessões" (feed `SRV`, `sessPhotos`, `vendas[]`, `sessCompradas`), sai o `ljAlreadyPaid`, entra o Imply;
  - seção 4: `/sessoes`, `/sessoes/legado`, `/sessoes/ponto` e `~/Eterna/ponto/sessoes/`;
  - seção 5: D1, D10, D12, D13, D14 e D15;
  - tabela da seção 2: `vendor/jsqr`.
- `/home/claude/eterna/VERSOES.md`: linha v85.
- Testes:
  - `/home/claude/eterna/testes/v85_agente.py` (HOME temporário, `ETERNA_SEM_OPENCV=1`, `ETERNA_SESSAO_PAUSA=3`, fotos pela pasta vigiada e pelo FTP embutido, `cap` controlado por EXIF);
  - `/home/claude/eterna/testes/v85.js` (Playwright);
  - atualizar `v79-regressao.js`, `v83.js` e `loja.js` onde esperam `ljAlreadyPaid`, "já está paga", `data-card` na impressão ou a sessão com `saleNo`.

---

## Contratos

**`GET /sessoes[?desde=<rev>][&dia=AAAA-MM-DD]`** → 200, `ETag: W/"<gen>-<rev>"`. 304 se `If-None-Match` for igual.
```json
{"ok":true,"gen":"9f3c…","rev":512,"completo":false,"dias":["2026-10-29","2026-10-28"],
 "sessoes":[{"card":"LPK7Q2M9X","dia":"2026-10-29","fotografo":"carlos","ponto":"campo4",
   "status":"fechada","aberta_em":1761765180.2,"fechada_em":1761765301.0,"ultima_chegada":1761765256.0,
   "cap0":1761765170.0,"cap1":1761765250.0,"fechada_por":"pausa_45s","origem":"agente",
   "fotos":["a1b2c3d4e5f6","…"],"tardias":0,"rev":511},
  {"card":"LP…","removida":true,"rev":512}]}
```
- `fechada_por`: `pausa_45s`, `pausa_entre_cliques`, `virada_do_dia`, `reagrupada` ou `legado`.
- `origem`: `agente`, `reagrupada` ou `legado`.
- `completo:true` quando não veio `desde`.
- `dia` aceita até 60 dias atrás e devolve só aquele dia.

**`POST /sessoes/legado`** (cabeçalho `X-Eterna: 1`)
```json
{"sessoes":[{"card":"LPAB12CD3","fotos":["a1b2c3d4e5f6"],"aberta_em":"2026-10-28T17:13:00Z","fotografo":"carlos"}],
 "protegidas":["LPAB12CD3"]}
```
→ `{"ok":true,"importadas":1,"ignoradas":0,"fotos_movidas":4,"absorvidas":1}`

**`POST /sessoes/ponto`** `{"ponto":"campo4"}` → `{"ok":true}`

**`/status`**: `"sessoes":{"v":1,"pausa":45,"abertas":2,"hoje":38,"rev":512,"gen":"9f3c…"}`

**Venda (`SIM.sessions[card].vendas[i]`)**
```json
{"id":"L00-mh8x2k4fa1","saleNo":"L0-014","estado":"paga","canal":"loja","criada":"…","pagaEm":"…",
 "cart":[{"id":"gramado","v":150},{"id":"copia","v":35}],"total":185,"nFotos":6,
 "selected":["ag_…"],"aiSel":["ag_…|mirante"],"copias":["ag_…"],"fav":["ag_…"],"prints":7,
 "payment":"Cartão (maquininha)","pag":{"prov":"pos-manual","ref":"123456","em":"…","porNome":"Thainá"},
 "imply":{"pedido":"1029URWB3N63","leitura":"pistola","aviso":false,"em":"…","porNome":"Thainá"},
 "vendedor":{"nome":"…","email":"…"},"posto":"Caixa 1","caixaPor":"…","caixaEm":"…",
 "impressao":{"estado":"pendente","alvo":7,"semFoto":0,"feitas":[]},"impressoes":[],
 "canceladaEm":null,"canceladaPor":null,"migrada":null}
```
O que fica na sessão: `key`, `pdv`, `point`, `date`, `time`, `status` (calculado), `pick`, `selected`/`aiSel`/`copias`/`fav` (só a escolha em andamento), `cart` (balcão em montagem), `din`, `cort`, `menor`, `flag` e `vendas`. Sessão do agente não guarda `photos`.

**CSV:** colunas atuais + `pedido_imply;imply_leitura`.

**Item de catálogo:** `{"id":"copia","name":"Cópia impressa","desc":"mais uma cópia 10×15 de uma foto já comprada","price":35,"kind":"adicional","digital":0,"prints":1}`

## Impacto nos pontos que você pediu
| Ponto | Hoje | Na v85 |
|---|---|---|
| `lojaJaPaga` | bloqueia o Checkout de sessão paga | sai |
| `ljAlreadyPaid` | mensagem e tela de bloqueio | a tela e a chave saem; entram `ljOwned` e `ljOwnedHint` |
| `caixaConfirm` | recusa sessão paga e grava a venda na sessão | cria uma venda nova, exige o Imply e tem trava contra duplo clique |
| `pendConfirmar` | recusa sessão paga ("pago de outro jeito") | só confere a pendência, exige o Imply e anexa uma venda |
| Impressão v83 | por card, `s.impressao` | por venda (`data-venda`), com as cópias primeiro |
| `galDaVenda` e nuvem | direitos de `selected` da sessão paga | união de todas as vendas pagas, mais "todas" (D13), sem regredir |

---

## Critérios de aceite

**Agente (`testes/v85_agente.py`, pausa de teste 3 s)**
1. Três fotos do login FTP `carlos`, com cliques a t, t+10 s e t+20 s, sem navegador nenhum: depois de 3 s sem foto, `GET /sessoes` tem 1 sessão `fechada` com as 3 fotos, `fotografo:"carlos"`, card em `^LP[A-HJ-NP-Z2-9]{7}$` e `fechada_por:"pausa_45s"`.
2. Duas fotos com cliques a mais de 3 s de distância formam 2 sessões; a primeira fecha com `pausa_entre_cliques`.
3. Fotos alternadas de `carlos` e `marinara` formam sessões separadas por fotógrafo.
4. Uma foto que chega depois do fechamento, com clique dentro da janela, entra na mesma sessão (`tardias:1`) e o `rev` sobe.
5. O mesmo arquivo enviado de novo não aparece em sessão nenhuma e o total de fotos não muda.
6. No login compartilhado com subpasta `marinara`, o fotógrafo é `marinara`. Uma subpasta não cadastrada vira `camera:<série>` (ou `origem:…` sem série), nunca o nome da subpasta.
7. O agente reinicia: mesmos cards, mesmas fotos, nenhuma foto em duas sessões, `gen` igual e `rev` maior ou igual ao de antes.
8. Primeiro boot com 10 fotos órfãs de hoje e 5 de 3 dias atrás na `inbox`: viram sessões `reagrupada` e `SESS_MIG` é criado. O segundo boot não cria nada.
9. `POST /sessoes/legado` com o card `X` contendo pids de uma sessão `reagrupada`: os pids passam para `X` e a sessão antiga fica `removida`. Com essa sessão em `protegidas`, nada muda e `ignoradas ≥ 1`.
10. `If-None-Match` com o ETag atual dá 304. Uma foto nova dá 200 com ETag novo. `?desde=<rev>` traz só o que mudou.
11. Segurança:
    - `GET /sessoes` com `Origin: https://evil.example` → 403;
    - com `Host: evil:PORTA` → 403;
    - `POST /sessoes/legado` sem `X-Eterna` → 403;
    - corpo acima de 2 MB → 413;
    - pid inválido ou fora da `lib` é ignorado;
    - `POST /sessoes/ponto` com `"../x"` → 400.
12. Sessão aberta na virada do dia fecha com `virada_do_dia`, e arquivo com mais de 60 dias é apagado (função chamada direto no teste).
13. A7: um arquivo criado na `ETERNA_PASTA` com o agente parado entra no boot seguinte. Um arquivo que já estava lá antes do primeiro boot não entra.

**App: leitura (parte B)**
14. As fotos chegam com o app fechado. Ao abrir o app, a sessão aparece na Qualidade e o Checkout a abre pelo código ("código do recibo").
15. Com agente v85, depois de 10 chegadas, nenhum card novo com foto `ag_` nasceu no navegador (`SIM.sessions` não ganhou `photos`).
16. Com um agente sem `st.sessoes`, a montagem antiga funciona: v79, v83 e `loja.js` passam.
17. Uma sessão antiga do SIM é enviada uma vez por boot do agente, continua abrindo no Checkout, e as fotos dela não aparecem em outra sessão.
18. Com 1000 sessões de 15 fotos no feed, `eterna.sim.v1` cresce menos de 50 KB.
19. Sessão `aberta` aparece no Upload automático, mas não no Checkout nem na busca por rosto.

**Qualidade (parte E)**
20. Com o filtro ligado (padrão), as sessões da Roverpix sem foto aqui ficam escondidas e a nota mostra quantas são. Desligado, elas aparecem. A escolha vale depois de recarregar a página.

**Vendas (parte C)**
21. Migração: um SIM v83 com uma sessão `paga` (`L0-003`, impressão `impressa`) carrega com `vendas.length===1` e o mesmo `saleNo`, total, `prints` e impressão. A Lista mostra a mesma linha. Recarregar não duplica. Um SIM gravado por janela antiga e adotado pelo `storage` também é migrado.
22. Checkout de uma sessão paga abre a escolha. As compradas mostram "Já é sua" (conferir as 5 línguas) e o aviso de cópia.
23. Duas fotos novas: o carrinho usa o Ideal para n=2 e a venda confirmada tem `saleNo` novo. `vendas.length===2`.
24. ✓ numa comprada: linha "1 cópia impressa × R$ 35", `prints` inclui a cópia, a cópia aparece primeiro na Impressão 10×15 e "Saiu certo" baixa o rolo em 1.
25. O manifesto da galeria tem como `comprada` a união das duas vendas. Cancelar a venda 2 na Lista (com `financeiro.d`) mantém as fotos `comprada`, mostra o aviso, marca a venda 2 `cancelada` e tira o valor dela da receita.
26. Painel: 2 vendas e a receita somada. "Fotos vendidas" não conta as cópias; "impressões" conta.
27. CSV: 2 linhas para a mesma sessão, com números de venda diferentes e as colunas `pedido_imply;imply_leitura` no fim.
28. Balcão: confirmar numa sessão paga cria a venda 3. Clique duplo cria uma só.
29. Venda paga com Maracanã Mais: todas as fotos da sessão ficam `comprada` na galeria.
30. "Minhas vendas de hoje" lista cada venda numa linha.

**Pedido Imply (parte D)**
31. "Pago na maquininha" abre o bloco com `#pend-imply` em foco. Confirmar com o campo vazio mostra a mensagem e nenhuma venda nasce.
32. Pistola simulada (`1029URWB3N63` + Enter, 10 ms entre teclas): a venda é confirmada com `imply.pedido` e `leitura:"pistola"`, e o pedido aparece na Lista e no CSV.
33. "Recebi R$ X" (dinheiro) e a venda no balcão também exigem o pedido.
34. Validação:
    - `ABC` → erro;
    - `4111111111111111` → "parece número de cartão", e o número não aparece em nenhuma chave do `localStorage`;
    - `abcd1234` → normalizado para `ABCD1234`, mostra o aviso e confirma só com "Usar mesmo assim";
    - `102972U3H6` → mostra o aviso.
35. O mesmo pedido numa segunda venda é recusado com o `saleNo` da primeira, grava em `SIM.implyRecusas` e aparece em Alertas.
36. Câmera com `BarcodeDetector` simulado: o campo é preenchido sem confirmar; depois de ler ou cancelar, todas as trilhas ficam `ended`. Sem `BarcodeDetector`, `vendor/jsqr/jsQR.js` é carregado uma vez só.
37. O NSU continua opcional e recusa número de cartão.
38. `vendor/jsqr/LICENSE` e `LEIAME.md` existem, e a versão e o sha256 batem com o arquivo.

**Geral**
39. Guia: a seção do Chrome do posto tem os passos de D20, nesta ordem, inclusive "mesmo perfil" e "fechar todas as janelas antes do `--kiosk-printing`".
40. `testes/todas-as-telas.js` sem erro e `bash testes/rodar.sh` com `FALHAS: 0`.
41. Carimbo v85 nas duas ocorrências e linha v85 no `VERSOES.md`.

---

## Riscos para o revisor de segurança e escala

**Segurança**
1. **`/sessoes` lista pids e fotógrafos.** Com o pid, `/file/` entrega o original para a origem do agente e para o `APP_ORIGIN`. Por isso a rota é loopback mais `origem_privada_ok`. Conferir que `ETERNA_REDE` ligado não abre a rota para a LAN. A falha que já existe em `/biblioteca` e `/file` sem `Origin` vindo da LAN continua aberta até a v83 A.
2. **`/sessoes/legado` muda o agrupamento.** Um site qualquer não pode chamar a rota: há preflight por `X-Eterna`, CORS fechado, checagem de `Host` e loopback. Conferir os limites (2 MB, 5000 × 500) e que `protegidas` só consegue impedir uma mudança, nunca forçar.
3. **O pedido Imply é declarado pelo vendedor.** Um código inventado e válido libera originais. Mitigações: formato, aviso, trava de repetido (por navegador nesta versão), `leitura` registrada e auditoria da TI cruzando Imply e Eterna. A trava só vale entre aparelhos quando as vendas forem para o agente.
4. **Cancelar não tira a foto da galeria (D12).** Um vendedor com `financeiro.d` pode vender, entregar e cancelar. O cancelamento fica registrado com quem e quando; vale um alerta no Painel para "cancelada com fotos entregues".
5. **A câmera do canhoto e a câmera do Checkout podem ser a mesma webcam.** O Chrome compartilha a câmera entre janelas, mas é preciso testar no Windows do posto. Nenhum quadro é guardado.
6. **Pistola com foco na janela errada:** o código digitado na janela do Checkout (cliente) não pode disparar ação. Conferir os atalhos de teclado do `review`.
7. **jsQR:** biblioteca nova, com versão fixa, cópia local, sha256 e carga sob demanda (CSP e cadeia de fornecimento).

**Escala (15 mil fotos/dia, vários postos)**
8. **Agente:** `sess_add` em O(1) amortizado (índice pid → card e candidatas só do grupo nas últimas 12 h). Uma linha JSONL por mudança dá ~0,2 por segundo no pico; `fsync` só no fechamento. 60 dias em disco ≈ 20 MB.
9. **Feed:** o dia completo tem ~300 KB. O polling de 2,5 s usa `desde` e ETag, então o normal é 304 ou um delta pequeno. Medir com `agente/teste-carga.py`.
10. **Navegador:** `demoSessions()` e `faceFind` percorrem todas as sessões de hoje a cada render ou busca (~15 mil fotos). Medir o tempo de render na Qualidade e no Checkout; se passar de 50 ms, guardar em cache por `SRV.rev`.
11. **`validateReal` no navegador do computador do ponto** com 15 mil fotos/dia é pesado. Fica numa fila de uma sessão por vez; levar para o agente na próxima versão.
12. **`events` em memória no agente** continua crescendo sem limite (problema anterior a esta versão). Anotar para depois.

**LGPD**
13. O feed não tem dado de cliente: só pids, logins de fotógrafo, número de série de câmera e horários. O pedido Imply é dado da transação e vai para a Lista e o CSV, sem nome nem cartão. Número de cartão é recusado e nunca gravado. A retenção das sessões (60 dias) é igual à da galeria e das leituras de rosto.

**Operação**
14. Durante a troca de versão, uma janela antiga do app ainda pode montar sessões no navegador. A D6 resolve na próxima vez que as sessões do SIM forem enviadas ao agente, mas o Guia precisa repetir "recarregue todas as janelas".
15. Sem A7, foto que chega na pasta vigiada do 218 com o agente parado se perde. A7 precisa entrar antes do próximo teste no 218.

## Para guardar na memória do projeto
- v85 (planejada em 29/10):
  - sessões montadas no agente, por fotógrafo e pela hora do clique, com a pausa de 45 s;
  - código LP gerado no agente;
  - app lê `/sessoes` com ETag;
  - várias vendas por sessão (`vendas[]`), com cópia impressa como item `copia`;
  - pedido Imply obrigatório (8 a 16 letras e números, com aviso para o padrão MMDD+8);
  - comprada nunca regride, nem no cancelamento.
- Achado novo: a pasta vigiada ignora o que chega com o agente parado (corrigido na A7).
- Pergunta para o Eduardo: preço da cópia impressa (o plano assume R$ 35).
---

## Adendo (Eduardo, 29/10 18:48) · Parte G: hora de chegada de cada foto, com busca por horário

Quando uma foto chega ao servidor, o Eterna registra a hora de chegada. A equipe precisa conseguir achar uma foto pela hora.

- **Agente:** a hora de chegada já existe em `meta[pid].u`. Ela passa a ser devolvida também em `/biblioteca` e no feed `/sessoes`, por foto, junto com a hora do clique (`cap`, vinda do EXIF) e a origem (login FTP, pasta, cartão, FTP do estádio).
- **Upload automático e Biblioteca:**
  - cada foto mostra "chegou às hh:mm:ss" e, quando existe, "clique às hh:mm:ss", com o fotógrafo e a origem;
  - **busca por horário:** campo "de hh:mm até hh:mm", mais data e fotógrafo opcionais. A busca filtra pela hora de chegada (padrão) ou pela hora do clique (alternância);
  - a lista sai ordenada pela chegada, da mais nova para a mais antiga;
  - clicar numa foto do resultado abre a sessão dela.
- **Sessão:** o cartão da sessão mostra a primeira e a última chegada.
- **Critérios de aceite:**
  - **G1:** uma foto que chega às 17:13:05 aparece com "chegou às 17:13:05" no Upload e na Biblioteca;
  - **G2:** a busca "17:10 até 17:15" mostra só as fotos que chegaram nesse intervalo; com a alternância para hora do clique, filtra pelo EXIF;
  - **G3:** a busca funciona com o app aberto ou fechado na hora da chegada, porque a hora vem do agente;
  - **G4:** com 15 mil fotos no dia, a busca responde em menos de 300 ms. O filtro roda no agente com `?de=&ate=&dia=`, ou em índice ordenado no app.

### Adendo G2 (Eduardo, 29/10 18:51) · miniatura e foto ampliada no feed do Upload
Hoje a lista de chegadas do Upload automático (`index.html` perto da linha 2802, `g.feed`) é só texto e não dá para clicar.
- Cada linha mostra a **miniatura** da foto (`/thumb/<pid>`, 56 px, `loading="lazy"`), a hora de chegada e a de clique, o fotógrafo, a origem e o card da sessão quando já houver.
- **Um clique ou duplo clique** abre a foto **ampliada** no modal existente (`showModal`), com setas para as fotos vizinhas da mesma chegada e o botão "Abrir a sessão".
- Na linha "repetida", a miniatura é a da foto que já estava na biblioteca, para mostrar com qual ela é igual.
- Linha sem foto, como "Grupo fechado", mostra o card e abre a sessão.
- **Critérios:**
  - G5: toda foto nova no feed tem miniatura com `naturalWidth>0`;
  - G6: clicar abre o modal com a foto em tamanho grande e as setas passam para a próxima chegada;
  - G7: com 60 linhas, o feed continua rápido (miniaturas lazy, sem re-render ao passar o mouse).

## Adendo (Ronaldo, 30/10 17:40) · Parte A e o essencial da B implementados

Motivo: com o servidor acessado por vários navegadores (Chrome do servidor, PC pelo Tailscale, Mac do Eduardo), cada um só via as sessões das fotos que chegaram com o Upload aberto nele, e a selfie no Checkout de outro navegador dava "não achamos".

**O que entrou**
- **Agente:** `sess_*`, perto da Fila do fotógrafo.
  - Mesma regra de grupo da v87: `ff_quem` (D2) e pausa `FF_PAUSA`, que é 20 s e não 45, igual ao app desde o 7e1a04f.
  - Código LP + 7 caracteres com `secrets` (D3).
  - Arquivo `~/Eterna/ponto/sessoes/AAAA-MM-DD.json`, regravado inteiro a cada 2 s quando muda.
  - Em memória ficam hoje e ontem. No boot, as fotos de hoje e ontem sem sessão são agrupadas (D7 simplificado).
  - O LGPD tira a foto da sessão.
  - `GET /sessoes?desde=<rev>`, com `gen` = `BOOT`.
  - `/status.sessoes`.
- **App:** `srvPull()`.
  - Com `st.sessoes`, a foto real não entra mais em `ingPush`.
  - Cada sessão fechada de hoje vira `SIM.sessions[card]` pelo próprio `ingClose(how, srv)`, com o mesmo código do servidor, fotógrafo por `impWho`, hora de abertura e validação como antes.
  - Foto que já está numa sessão deste navegador não duplica.

**Diferenças em relação ao plano**
- D9: `/sessoes` passa pelo `origem_privada_ok`, então responde também aos endereços de `ETERNA_ORIGENS` (postos e Tailscale), não só ao loopback. É o objetivo desta mudança.
- D4: as sessões continuam indo para o SIM (`localStorage`), como já iam pelo `ingClose`. O feed só em memória fica para quando o volume pedir.
- Ficaram de fora: D1 por hora do clique (a regra continua a da chegada), `POST /sessoes/legado`, `POST /sessoes/ponto`, ETag/304, dias anteriores (`?dia=`) e as partes C, D, E e F.

**Teste (30/10, notebook do Ronaldo, `ETERNA_SESSAO_PAUSA=4`)**
- 6 fotos novas na pasta vigiada, em duas levas com 10 s entre elas.
- O agente montou 2 sessões de 3, fechadas por pausa e gravadas em `2026-10-30.json`.
- Um navegador sem nada guardado recebeu as duas sessões com os mesmos códigos (LPEMVX2GS, LP3MJ59NC).
