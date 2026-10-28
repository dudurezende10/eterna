# Plano v80: vários terminais de Checkout e "Vendas ao vivo" com impressão no caixa

Arquivo sugerido para o documentador: `/home/claude/eterna/docs/planos/2026-10-28-v80-multiterminal.md`. Não editei nenhum arquivo. Este plano parte da v79 já implementada (`SIM.caixaDin`, `dinConfirmar`, `dinFechar`, `lojaDinheiro`, `simFresh`, `lojaIdeal`, `s.prints`).

## Objetivo
Cada terminal de Checkout do ponto (Terminal 1 a N) manda as vendas para o agente. Um ou mais caixas veem todas as vendas ao vivo, da mais nova para a mais antiga, acham a do cliente pelo terminal, pelo valor ou pelo código, confirmam o dinheiro e imprimem as fotos em 15×20 no próprio computador. Tudo na rede local, sem internet.

## Achados no código que mudam o desenho (o revisor precisa saber)
1. **Hoje um terminal em outro computador não acha nenhuma foto real.** As sessões (`SIM.sessions`, ids `LP...`) nascem em `ingClose` e ficam no `localStorage` do computador do agente. Os preços editados (`SIM.prices`) e os ajustes (`SIM.edits`, incluindo o recorte `z/x/y`) também ficam só nele. Por isso a v80 precisa de um feed de sessões e de configuração vindo do agente.
2. **O reconhecimento facial e a publicação da galeria não funcionam vindos da rede.** `/rostos/buscar` e `/galerias/publicar` exigem `origem_local()`, que pede Host `127.0.0.1`.
3. **Brecha que já existe com `ETERNA_REDE=1`:**
   - `/roverpix/config`, `/ftp-remoto/config` e `/photoroom/config|compose` só recusam quando o `Origin` existe e é de fora. Um `curl` sem `Origin`, de qualquer aparelho da rede, troca as chaves ou gasta os créditos do Photoroom.
   - `origem_local()` confere só o cabeçalho `Host`, que dá para forjar (`Host: 127.0.0.1:8765`). Ele não confere `client_address`.
   - `/biblioteca`, `/thumb/`, `/file/` e `/events` respondem a qualquer aparelho da rede que mande uma requisição sem `Origin`.
4. **Fotos pela rede (o que foi pedido para confirmar):** funcionam tecnicamente. `<img>` e `background-image` da mesma origem não mandam `Origin`, e o Host do IP da rede está em `HOSTS_OK`. Mas funcionam para qualquer um da rede (item 3). A v80 passa a exigir um aparelho pareado.
5. **O terminal precisa abrir o app pelo agente** (`http://<IP-do-ponto>:8765/#loja`). Um app em https://eterna.photo não pode chamar http na rede local (bloqueio de conteúdo misto). Mas `http://192.168...` não é contexto seguro, e por isso **`getUserMedia` (a câmera) fica bloqueado**. É preciso abrir o Chrome com `--unsafely-treat-insecure-origin-as-secure` (lançador novo).
6. **O agente não funciona sem internet para os terminais.** `app()` guarda o cache do app só na memória. Se o agente reabre sem internet, a resposta é 502 e os terminais não carregam.
7. `lan_ip()` descobre o IP abrindo uma rota para 8.8.8.8. Sem rota padrão (offline), pode voltar o IP errado, e então `HOSTS_OK` recusa os terminais.
8. **O login da equipe é simulado e fica por origem.** O código aparece na tela, e os usuários ficam no `localStorage` de cada origem (`127.0.0.1` e o IP da rede são origens diferentes). Por isso o agente **não pode confiar no usuário que o navegador declara**: ele confia no aparelho pareado, e o `por` é só registro.

## Escopo desta entrega (em ordem de implementação; cada parte se testa sozinha)
- **A. Base e segurança da rede:**
  - quem é local e quem é aparelho;
  - fechar as brechas do item 3;
  - `ETERNA_HOSTS`;
  - cache do app em disco;
  - lançadores de terminal e de caixa.
- **B. Pareamento:** convite emitido no computador do ponto e código digitado no terminal (Checkout) ou no caixa (equipe), gravando um cookie HttpOnly.
- **C. Feed do ponto:** sessões, preços e ajustes publicados pelo computador do ponto e lidos pelos aparelhos. Reconhecimento facial e fotos liberados para aparelhos pareados.
- **D. Vendas no agente:** fila local no terminal, envio idempotente, galeria publicada pelo agente a partir da venda.
- **E. Tela "Vendas ao vivo"** (view `vivo`): polling com ETag, filtros e busca, detalhe da venda, confirmar e cancelar dinheiro (a v79 entre computadores).
- **F. Imprimir pelo navegador em 15×20:**
  - reserva no agente, para dois caixas não imprimirem a mesma venda;
  - "Saiu certo";
  - reimpressão com motivo;
  - estoque de rolo por caixa, baixado uma vez só.
- **G. Lista de vendas, CSV, Alertas e espelho** no computador do ponto incluem as vendas dos terminais.

## Fora do escopo (fica para depois)
- Impressão pelo agente: pasta quente lida pelo software da DNP ou da Fuji, `lp`/CUPS no Mac, spooler no Windows, status da impressora e contador real do rolo.
- Imprimir fotos com fundo de IA (continuam só digitais).
- TEF ou cartão de verdade no terminal.
- HTTPS local com certificado.
- Apelido livre para o terminal (só número).
- Venda no balcão criada no caixa da rede (a `vCheckout` continua local).
- PIN para o painel escondido do terminal (risco 9).
- Sincronizar usuários entre computadores (só o servidor resolve).
- Celular do cliente alcançar o agente.
- Subir as vendas do agente para a nuvem.

## Decisões assumidas (padrão mais seguro; o Eduardo pode trocar)
| # | Decisão |
|---|---|
| D1 | Terminais e caixas abrem `http://<IP-do-ponto>:8765`. O computador do agente usa `http://127.0.0.1:8765` e é o único "local". O IP do ponto fica fixo: reserva no DHCP e `ETERNA_HOSTS`. |
| D2 | Dois tipos de aparelho. **`checkout`** (tela do cliente) vê só as próprias vendas e as fotos das sessões de hoje e ontem. **`equipe`** (caixa) vê todas as vendas, confirma, imprime e lê a biblioteca, para não quebrar quem já usa a rede. As rotas de chave e configuração do agente ficam **só no computador do ponto**. |
| D3 | O nome é derivado do número: checkout = "Terminal N", equipe = "Caixa N", N de 1 a 30. Sem texto livre: nada de XSS e nada de nome gigante. O computador do ponto também tem seu número de terminal e de caixa, configurados na tela Terminais. |
| D4 | O pareamento exige um **código de convite** gerado no computador do ponto (Configurações › Terminais, `configuracao.u`). O código tem 8 caracteres, vale 10 min e uma vez só, e já carrega o tipo. No aparelho, a equipe faz o gesto (3 toques no logo, depois "Este terminal") e digita número + código. Trocar o número ou parear de novo exige um código novo. Se o número já estiver em uso, a resposta é 409, e é preciso revogar antes; nunca substitui sozinho. |
| D5 | A credencial do aparelho é o cookie `eterna_disp` (32 bytes aleatórios; `HttpOnly; SameSite=Strict; Path=/; Max-Age=180 dias`). No agente fica só o sha256 do token. O navegador guarda em `eterna.terminal.v1` só `{id,tipo,num,nome}`, nunca o token. O cookie é o que faz `<img>` de miniatura funcionar com autenticação. |
| D6 | **Ordem da lista = hora em que a venda chegou ao agente** (relógio único). A hora mostrada é a mesma. Se a venda foi feita mais de 2 min antes de chegar (estava na fila), aparece "feita às hh:mm no terminal". |
| D7 | O id da venda nasce no terminal: `<dispId>-<ts36><rand4>`, e o agente confere o prefixo. Reenviar o mesmo id com o mesmo conteúdo dá 200 `ja:true`; conteúdo diferente dá 409. Toda ação tem `idem`, e repetir devolve o mesmo resultado. |
| D8 | O total é recalculado no agente com os preços do feed. Se divergir, **aceita e marca `divergente`**, com alerta para a equipe. Recusar perderia uma venda já paga (nada se perde). |
| D9 | **Confirmar ou cancelar dinheiro e imprimir exigem o agente no ar** quando o modo ponto está ativo. O agente é local; sem ele o ponto inteiro já está parado. A v79 local continua valendo só sem agente (modo `off`). |
| D10 | Impressão desta fase pelo navegador:<br>• página 152×203 mm, uma foto por página, foto deitada girada 90°;<br>• original `/file/` com o ajuste copiado no momento da venda (`ed`);<br>• o caixa abre o Chrome com `--kiosk-printing` e imprime direto na impressora padrão (driver do fabricante instalado no sistema, com papel 15×20 como padrão);<br>• como o navegador não sabe se a impressão saiu, quem opera confirma com "Saiu certo" ou "Não saiu". |
| D11 | Imprime as fotos do campo da venda (`selected`, favoritas primeiro), até `prints`. Quem opera pode trocar quais, dentro do limite. O estoque baixa no "Saiu certo", no rolo do caixa que imprimiu, uma vez só. A reimpressão baixa N, com motivo. **O terminal deixa de baixar estoque** no modo ponto. |
| D12 | Reserva de impressão: "Imprimir" deixa a venda em `imprimindo` por aquele caixa. Outro caixa recebe 409 "Imprimindo no Caixa 2 por X". Depois de 5 min, qualquer caixa com `venda.c` pode liberar. Não há liberação automática (evita imprimir em dobro). |
| D13 | Quem vê Vendas ao vivo: módulo `venda`. `venda.r` vê, `venda.c` age. O vendedor vê o valor **de cada venda de hoje**, sem somatório, ticket ou receita (isso continua só para quem tem `financeiro.r`). |
| D14 | O polling roda em `GET /ponto/vendas?desde=<rev>` com `ETag`/`If-None-Match`:<br>• 2 s com a tela visível e 15 s com a aba escondida ou em outra tela;<br>• quando dá erro, o intervalo dobra até 15 s;<br>• `render()` só quando o `rev` muda e nenhum campo está com foco. |
| D15 | Retenção no agente:<br>• vendas e eventos: 90 dias;<br>• sessões do feed: 7 dias;<br>• dispositivos: até revogar;<br>• convites só em memória.<br>Nenhum dado de cliente (sem nome, e-mail, rosto ou IP do cliente). O e-mail do operador vai só para o arquivo de eventos; as respostas da API e o CSV levam só o nome. |
| D16 | Galeria: a venda leva `galeria:{token,codigo}` e a lista de fotos da sessão. O agente monta e publica o manifesto (`gal_validar`, `gal_mesclar`, `gal_fila`), com `comprada` só para o `selected` de venda paga ou confirmada. Venda `aguardando` não publica nada. Se dois terminais venderem a mesma sessão, ficam duas galerias, cada uma com o seu QR (raro; aceito). |

**Decisões em aberto para o Eduardo (o padrão entre parênteses já está no plano):**
- (a) O vendedor vê o valor de cada venda? (Sim, só as de hoje e sem totais, D13.)
- (b) Foto com fundo de IA não imprime? (Não imprime.)
- (c) Confirmar dinheiro e imprimir em dois toques ou em um? (Dois: "Recebi R$ X" e depois "Imprimir".)
- (d) Os textos do Checkout que prometem "prontas em 2 minutos" (`incPrintD`, `secure`, `printsReady`) continuam? (Só a tela final muda, para "saem no balcão".)

---

## Mudanças em `/home/claude/eterna/agente/eterna-agente.py`

**Base e rede (A)**
- `HOSTS_OK` vira `hosts_ok()`, que junta:
  - `127.0.0.1:P` e `localhost:P`;
  - os IPv4 de todas as interfaces (`socket.getaddrinfo(socket.gethostname(),None)`) mais `lan_ip()`;
  - a lista `ETERNA_HOSTS` (separada por vírgula).

  `ORIGENS_PROPRIAS = {"http://"+h for h in HOSTS_OK}`.
- Novo `H.loopback()`: `client_address[0]` em `("127.0.0.1","::1","::ffff:127.0.0.1")`.
- Novo `H.local()`: `loopback()`, Host local e `Origin` ausente ou local.
- **`origem_local()` passa a exigir `loopback()`.** Isso fecha o Host forjado em `/galerias/*` e `/rostos/*`.
- **`/roverpix/config`, `/ftp-remoto/config`, `/photoroom/config|compose` e `/roverpix/sync` passam a exigir `self.local()`.**
- **Porta de entrada da rede** (no começo de `do_GET` e `do_POST`, antes de qualquer rota): se não for `loopback()`, só passam:
  - o app (`app()`), `GET /status` e `POST /ponto/parear`;
  - as rotas públicas `/g/*` da v77;
  - as rotas permitidas ao tipo do aparelho (tabela abaixo).

  Todo o resto devolve 403 `{"error":"so_no_computador_do_ponto"}`.
- `cors()`: `/ponto/*` sem `Access-Control-Allow-Origin` (só mesma origem).
- `/thumb/` e `/file/` vindos de aparelho: `Cache-Control: private, max-age=3600`.
- **`app()` com cache em disco:**
  - guarda em `~/Eterna/app-cache/<sha1(path)>` + `.meta` (content-type);
  - aceita só caminho `^/[A-Za-z0-9._/-]+$` e sem `..`;
  - se a busca no `APP_ORIGIN` falhar, serve a cópia do disco;
  - `main()` pré-aquece `/index.html` em uma thread.
- `main()` imprime "Terminais e caixas: http://<ip>:PORTA/#loja" para cada host da rede, quando `ETERNA_REDE` estiver ligado.

**Pareamento (B)** em `~/Eterna/ponto/dispositivos.json` (`_grava_privado`, chmod 600)
- `ponto_lock = threading.RLock()`.
- `conv_emitir(tipo)`:
  - código em `GAL_ALFA`, formato `XXXX-XXXX`;
  - em memória `{hash, tipo, exp: agora+600}`;
  - no máximo 5 ativos.
- `disp_parear(codigo, tipo, num, ip)`:
  - confere o convite (`hmac.compare_digest` no sha256) e o tipo, depois consome o convite;
  - recusa `num` já em uso por um aparelho ativo do mesmo tipo, ou pelo número local;
  - gera `token=secrets.token_urlsafe(32)` e `id = ("T" se checkout, "C" se equipe) + "%02d"%num + "-" + 6 hex`;
  - grava `{id,tipo,num,nome,hash,criado,visto,ip,revogado:null}`.
- `disp_de_cookie(handler)`: `http.cookies.SimpleCookie`, depois `eterna_disp`, depois o sha256. Devolve o aparelho ativo ou None. Atualiza `visto`/`ip` na memória e grava no máximo a cada 60 s.
- `disp_revogar(id)`.
- Limites:
  - `POST /ponto/parear`: `limite_ok(ip,"parear",5)` por minuto e `limite_ok("*","parear",30)` no total;
  - 5 códigos errados por IP: `falhou(ip,"parear")` bloqueia 15 min (reaproveita `_falhas`).

**Feed (C)**
- `~/Eterna/ponto/sessoes/AAAA-MM-DD.jsonl` (upsert por `card`, com `rev`). Em memória ficam as sessões de hoje e ontem, mais o conjunto `fotos_permitidas` (refeito a cada upsert).
- `~/Eterna/ponto/config.json`: `{venue, precos, lojaFimSeg, local:{terminal,caixa}, atualizado}`.
- `~/Eterna/ponto/gen.json`: id aleatório criado uma vez. Muda só se a pasta for zerada.
- `/rostos/buscar` aceita `local()` **ou** aparelho (checkout ou equipe), com `limite_ok("disp:"+id,"rostos",20)` por minuto. A selfie continua sem ser gravada.

**Vendas (D, E, F)** em `~/Eterna/ponto/vendas/AAAA-MM-DD.jsonl`
- Cada linha é um evento `{rev,t,tipo,id,disp,dados}`. A gravação é seguida de `flush` + `os.fsync`.
- No boot, `pv_carregar()` reexecuta os eventos de hoje e as `aguardando` de ontem; `rev` = maior rev visto.
- `pv_criar(d, corpo)`:
  - valida tudo (ver contrato) e confere `id.startswith(d.id)`;
  - recalcula o total e define `divergente`;
  - liga a `impressao` (`pendente` se `prints>0`, senão `nao_se_aplica`);
  - se `estado=='paga'`: `saleNo` diário (`V%04d`) e `pv_galeria(v)`;
  - se `substitui`: fecha a anterior como `substituida`; se ela já estava confirmada, marca as duas com `alerta:'pago_duas_vezes'`.
- `pv_acao(d, id, acao, corpo)`: máquina de estados com `esperado` e `idem`:

  | ação | regra |
  |---|---|
  | `confirmar` | `aguardando` → `confirmada`, com `saleNo` e `pv_galeria` |
  | `cancelar` | `aguardando` → `cancelada` |
  | `imprimir` | `pendente` → `imprimindo`; fotos ⊂ `selected`, no máximo `prints` |
  | `impressa` | só o mesmo aparelho, ou qualquer um depois de 5 min; vira `impressa`; `estoque[d.nome] -= n` uma vez |
  | `liberar` | volta a `pendente`, sem mexer no estoque |
  | `reimprimir` | só se `impressa`; `1 ≤ n ≤ prints`; motivo no enum; `estoque -= n` |

  O aparelho `checkout` só pode `criar`. As ações exigem `equipe` ou local.
- `pv_galeria(v)`:
  - fotos da sessão = `v.fotos`, cruzadas com o feed quando a sessão existe;
  - `menor` vem do feed e `precos` do config;
  - monta o manifesto, depois `gal_validar`, depois `gal_mesclar` com o existente, `REPO.salvar_manifesto`, `codigos[...]` e `gal_fila.put`;
  - se o código colidir com outro token, gera um código novo, devolve na venda e registra no log.
- `pv_virada()` (thread de 60 s): `aguardando` de dia anterior vira `nao_paga` (`sistema`, `fim_do_dia`); apaga arquivos de vendas com mais de 90 dias e de sessões com mais de 7.
- `~/Eterna/ponto/estoque.json` `{ "Caixa 1": 58, ... }`. `POST /ponto/estoque` (equipe ou local) troca o rolo.
- `/status` ganha `"ponto":1` e `"disp":{id,tipo,num,nome}|null`.

**Quem acessa o quê**
| Rota | local | equipe | checkout |
|---|---|---|---|
| `POST /ponto/convites`, `GET /ponto/dispositivos`, `POST /ponto/dispositivos/<id>/revogar`, `POST /ponto/sessoes`, `POST /ponto/config`, rotas de chave, `/galerias/*` | sim | não | não |
| `GET /ponto/sessoes`, `GET /ponto/config`, `POST /rostos/buscar` | sim | sim | sim |
| `GET /thumb/<id>`, `/file/<id>` | sim | sim | só ids em `fotos_permitidas` (máx. 300/min) |
| `POST /ponto/vendas` | sim | não | sim |
| `GET /ponto/vendas` | todas | todas | só as dele (`meu` forçado) |
| `POST /ponto/vendas/<id>/<ação>`, `POST /ponto/estoque` | sim | sim | não |
| `/biblioteca`, `/events`, `/metricas` | sim | sim | não |

Todo POST em `/ponto/*` exige o cabeçalho `X-Eterna: 1`, Host em `HOSTS_OK` e `Origin` ausente ou em `ORIGENS_PROPRIAS`. Os corpos são limitados por `corpo()`: vendas 256 KB, sessões 2 MB, demais 16 KB.

## Mudanças em `/home/claude/eterna/index.html`

**Estado e transporte**
- `SIM0`: `pontoFila:[]`, `pontoConflitos:[]`.
- `state.term`: lido de `eterna.terminal.v1`.
- `state.ponto={gen:null,rev:0,etag:null,vendas:{},disp:[],estoque:{},sessRev:0,cfgEm:0,erro:null,foraDesde:null,q:'',term:'todos',est:'todas',sel:null,printSel:{},confirmar:null}`.
- `pontoModo()` devolve:
  - `'local'` quando `location.hostname` é `127.0.0.1` ou `localhost`, `state.agent.on` e `status.ponto`;
  - `'disp'` quando `state.term` existe e o `/status` devolveu `disp`;
  - `'off'` nos outros casos.

  Guardar `status.disp` em `agentPoll`. Se veio `null` com `state.term` gravado, limpar `state.term` (o aparelho foi revogado).
- `pontoReq(method,path,body,{etag})`: `fetch` com `credentials:'same-origin'`, `X-Eterna:1`, `AbortController` de 4 s. Devolve `{s,j,etag}`.
- **`agentPoll`, `livePoll`, `libLoad`, `galFilaTick`, poll de `/galerias/vendas`:** quando `state.term.tipo==='checkout'`, chamar só `/status`. Para equipe, `/events` e `libLoad` seguem como hoje. **`galFilaTick` em modo `disp` marca o item como `via_venda` e não chama `/galerias/publicar`.**

**Feed (C)**
- `pontoSessPub(cards)` (só `local`): monta `{card,key,fotografo,pdv,date,time,openedAt,fotos,menor,status,edits}` com fotos válidas `ag_` e `edits` só dessas fotos. Chamar:
  - no fim de `ingClose`;
  - quando `validateReal` resolve;
  - em `m-discard` e `m-adjust` (com debounce de 3 s);
  - em `pontoSessPubAll()` quando o agente conecta (sessões de hoje).
- `pontoCfgPub()` (só `local`): `precos` de todos os ids do catálogo via `priceOf`, mais `lojaFimSeg` e `venue`. Chamar quando o agente conecta e nos `case` `price`, `price-reset` e na mudança do tempo do Checkout.
- `pontoSessPull()` (aparelhos): 5 s com o Checkout no passo `code`, 15 s nos outros.
  - Mescla em `SIM.sessions` com `origem:'ponto'` e não regrava sessão `paga` ou `aguardando`.
  - Preenche `UP['ag_'+hex]={src:url+'/thumb/'+hex}`, e `SIM.edits[id]` quando não existe ou é `auto`.
  - Poda sessões `origem:'ponto'` com mais de 2 dias.
- `pontoCfgPull()` a cada 60 s: aplica em `SIM.prices` e `SIM.lojaFimSeg`. Em `vCatalogo`, num aparelho, os campos ficam desabilitados com a nota "Preços vêm do computador do ponto".

**Terminal de cliente (B, D)**
- `lojaEquipe`: novo bloco "Este terminal":
  - pareado: `Terminal N`, estado (pareado, sem contato com o agente, não pareado) e "N vendas esperando o agente";
  - botão `term-config`, que abre o seletor de número `#term-num` (1 a 30) e o código `#term-cod`, mais o botão `term-parear`.
- `termParear(tipo)`: `POST /ponto/parear`. Mensagens:
  - 200: grava `eterna.terminal.v1` e mostra "Pareado como Terminal 3";
  - 409: "Terminal 3 já está em uso. Revogue no computador do ponto.";
  - 401: "Código inválido (restam N)";
  - 429: "Muitas tentativas. Espere 15 min.".
- `vQuiosque`: selo discreto `lj-term` no `lj-top` com `T('ljTerm',num)` quando `state.term`.
- **`lojaPay` (v79):** se `pontoModo()!=='off'`:
  - não baixa `SIM.stock`;
  - não chama `galPublicar`; usa `galDaSessao(card,true)` só para ter token e código;
  - `pvEnfileirar(pvNovo(card,c,'paga',m))`; grava `s.pv=id`.
- **`lojaDinheiro` (v79):** mesmo caminho com `'aguardando'`. O registro em `caixaDin` usa o mesmo id da venda. Com pendência aberta, manda `substitui`.
- `pvNovo(card,c,estado,meio)`: devolve o corpo do contrato. `ed` vem de `SIM.edits` das fotos de `selected`. `fotos` são as fotos da sessão.
- `pvEnfileirar(rec)`: põe em `SIM.pontoFila`, `saveSim()` e `pontoFlush()`.
- `pontoFlush()` (5 s enquanto houver fila, e no evento `online`):
  - envia em ordem;
  - 200 ou 201 tira da fila;
  - 409 `id_em_uso` vai para `SIM.pontoConflitos` com `log`;
  - erro de rede: espera 5, 10, 30 e depois 60 s;
  - nunca descarta;
  - se o `localStorage` encher, alerta.
- `pontoMeuPull()` (checkout, 10 s; `GET /ponto/vendas?meu=1&desde=`): para cada venda `confirmada`, `cancelada` ou `nao_paga`, chama `dinFechar` local e aplica na sessão local (`paga` com `saleNo`, ou `pronta`).
- Tela final (`done`), em modo `disp`:
  - com `p.prints`, troca `printsReady` por `T('ljPickup',p.prints,T('ljTerm',num))`;
  - no dinheiro (variante da v79), linha `T('ljCashTerm',T('ljTerm',num))`.

**Vendas ao vivo (E, F)**: view `vivo`, módulo `venda`
- `VIEWS_EXTRA.vivo='Vendas ao vivo'`; `MODULES` venda: `['checkout','fila','caixa','vivo']`; `PRESETS.venda.menu` + `'vivo'`.
- `MODULE_INFO.venda.c`: "registrar pagamento, reimprimir, confirmar ou cancelar dinheiro do Checkout, imprimir vendas dos terminais".
- `pontoPoll()`:
  - roda em `vivo` e `caixa` a cada 2 s;
  - roda em qualquer outra tela de quem tem `canView('vivo')` ou `can('financeiro','r')` a cada 15 s;
  - aba escondida: 15 s;
  - manda `If-None-Match`; 304 não faz nada;
  - `gen` diferente: zera e recarrega com `desde=0`;
  - guarda `dispositivos` e `estoque`;
  - em `local`, chama `pvEspelhar(v)`;
  - `render()` só quando o `rev` mudou e nenhum `INPUT` está com foco (senão atualiza só a barra).
- `pvLista()`: as vendas do agente mais os itens de `SIM.pontoFila` deste navegador ainda não confirmados, marcados "ainda não chegou ao agente". Filtra por `term`, `est` e `q`:
  - `q` sem hífen e em maiúsculas compara com `codigo` e `card`;
  - se `q` for número ("200", "200,00", "R$ 200"), compara com `total`.

  Ordena por `recebida`, mais nova primeiro, e mostra as 100 primeiras (`pv-mais`).
- `vVivo()`:
  - **Cabeçalho:** "Vendas ao vivo", pill "ao vivo · há N s" ou "Agente fora desde hh:mm" (`bad`). Faixa de chips de terminais (`pv-term`), com ponto verde ou âmbar quando `visto` passou de 60 s. Chips de estado (`pv-est`): Todas de hoje, A imprimir, Aguardando caixa, Impressas. Busca `<input id="pv-q" data-keep data-act="pv-q">`.
  - **Linha** (`data-act="pv-open" data-id`):
    - hora `hh:mm:ss` + "há N min";
    - **Terminal N** em negrito;
    - `fmtR(total)` grande;
    - "N fotos · M impressas";
    - pill de `pvRotulo(v)`;
    - código `XXXX-XXXX`;
    - até 3 miniaturas por `pvThumb(id)`;
    - `pv-new` (borda amarela + pill "nova") quando chegou há menos de 120 s;
    - pill `bad` "preço divergente" quando for o caso.
  - **Detalhe** (coluna direita):
    - cabeçalho com terminal, hora, código e sessão;
    - grade das fotos com caixa de seleção (`pv-pick`; padrão: as `prints` primeiras; não passa do limite);
    - fotos de IA com selo "digital";
    - recibo com QR (`qrDraw` com `GAL_BASE+token`).
  - **Botões** (só com `can('venda','c')` e `pontoModo()!=='off'`; senão a nota "Só quem registra pagamento confirma" ou "Agente fora: espere ele voltar"):

    | estado | botões |
    |---|---|
    | `aguardando` | `pv-confirm` "Recebi R$ X", `pv-cancel` (depois `pv-cancel-ok` / `pv-cancel-no`) |
    | paga e `pendente` | `pv-print` "Imprimir N fotos (15×20)" |
    | `imprimindo` por este aparelho | `pv-printed` "Saiu certo", `pv-print-fail` "Não saiu, liberar" |
    | `imprimindo` por outro | texto "Imprimindo no Caixa 2 por X há N min"; depois de 5 min, `pv-print-fail` "Liberar" |
    | `impressa` | "Impressa por X no Caixa 1 às hh:mm", `pv-reprint` (depois número + chips de motivo + `pv-reprint-ok`) |

  - **Num aparelho `checkout`:** só a nota "Este aparelho é um terminal de cliente."
  - **Sem pareamento num computador da rede:** formulário de pareamento do tipo equipe (`term-parear`).
  - **Sem agente:** a nota "Sem agente do ponto. As vendas dos outros terminais aparecem quando ele voltar." mais a lista da v79.
- `pvAcao(id,acao,extra)`: `simFresh()` e `POST` com `{esperado,idem,por:{nome,email}}`. Resultado:
  - 200 atualiza `state.ponto.vendas[id]`;
  - 409 dá o toast "Já ${rótulo} por ${nome} às ${hh:mm}" ou "Imprimindo no Caixa 2 por X";
  - erro de rede dá o toast "Não deu para falar com o agente. Tente de novo." (o mesmo `idem` vai no próximo toque).
- `pvImprimir(id)`:
  1. `pvAcao(id,'imprimir',{fotos})`.
  2. `printMontar(fotos,v.ed)` cria `#print-root` (filho de `body`, fora de `#main`) com `.pr-pg`:
     - `<img src="<agente>/file/<hex>">` com `style` de `editStyleObj(ed[id])`;
     - foto de exemplo usa o sprite com `phStyle`;
     - foto deitada ganha `.land`.
  3. Espera `img.decode()` de todas, com limite de 15 s.
  4. `window.print()`. No `afterprint`, `state.ponto.confirmar=id` e `render()`.
- Refatorar `editStyle(id)` em `editStyleObj(e)` (`editStyle` passa a chamar `editStyleObj(SIM.edits[id])`) para a impressão usar o ajuste copiado na venda (`--flt`, `--tf`).
- `pvEspelhar(v)` (só `local`): para venda paga ou confirmada com `card` em `SIM.sessions`, ainda sem `status==='paga'`, aplica:
  - `status:'paga'`, `selected`, `cart`, `payment`, `paidAt`, `saleNo`, `prints`, `pv`, `viaTerminal`.
  
  **Sem** estoque e **sem** `galDaVenda`. Também espelha `SIM.stock[nome]=estoque[nome]`.
- **v79 no modo ponto:**
  - `dinConfirmar` e `dinCancelar` delegam para `pvAcao`;
  - o painel "Aguardando caixa" do `vCaixa` lê `pvLista({est:'aguardando'})`;
  - o botão do `#rail-ck` vira "Vendas ao vivo", com pill = aguardando + a imprimir (`warn` quando alguma passou de 15 min ou de 10 min a imprimir);
  - `stock-swap` em modo ponto chama `POST /ponto/estoque`.
- **Lista de vendas e CSV:**
  - `allSalesSim` junta as vendas do agente cujo id não esteja em nenhum `s.pv` local, com `pdv:` nome do terminal, `seller: LOJA_VENDEDOR` e o status mapeado;
  - `allSales` com `LIVE` também as inclui;
  - `salesCSV` ganha no fim as colunas `terminal` e `impressao` (estado + nome de quem imprimiu, nunca o e-mail).
- **`alerts()`:**
  - terminal sem contato há mais de 2 min (`warn`);
  - venda com preço divergente ou `pago_duas_vezes` (`bad`);
  - venda paga esperando impressão há mais de 10 min (`warn`);
  - `SIM.pontoConflitos` com itens (`bad`).

**Terminais** (view nova `terminais`, grupo Configurações, módulo `configuracao`)
- Entra em `VIEWS` depois de `catalogo`, e em `MODULES.configuracao`: `['repo','identidade','chroma','terminais']`. Admin e Supervisor (`'*'`) veem.
- `MODULE_INFO.configuracao.u`: "... e parear ou revogar terminais e caixas".
- `vTerminais()`:
  - **só em `local`** (senão a nota "Abra esta tela no computador do ponto");
  - endereço para os aparelhos (`http://<host>:porta/#loja`, vindo de `/status`);
  - números deste computador (`term-local`: Terminal N e Caixa N, enviados por `POST /ponto/config` em `local`);
  - botões `term-convite` "Novo código para terminal de cliente" e "Novo código para caixa", que mostram o código grande e o tempo restante;
  - tabela de aparelhos (nome, tipo, visto há N, último IP, pareado em) com `term-revogar`, que pede confirmação.

**Permissões e cliques**
- `WRITE_OPS`:
  - `'pv-confirm':'c'`, `'pv-cancel-ok':'c'`, `'pv-print':'c'`, `'pv-printed':'c'`, `'pv-print-fail':'c'`, `'pv-reprint-ok':'c'`, todos com `ACT_MOD` `'venda'`;
  - `'term-convite':'u'`, `'term-revogar':'u'`, `'term-local':'u'`, com `ACT_MOD` `'configuracao'`.
- Não gravam: `pv-open`, `pv-q`, `pv-term`, `pv-est`, `pv-pick`, `pv-mais`, `pv-cancel`, `pv-cancel-no`, `pv-reprint`, `term-config`.
- `term-parear` não entra em `WRITE_OPS`. No terminal não há usuário; a autorização é o código, conferido no agente.
- Novos `case` no switch para todas essas ações.

**CSS:**
- `.pv-list`, `.pv-row`, `.pv-row.pv-new` (borda #FFB800), `.pv-row[aria-current]`, `.pv-val` (Big Shoulders, tracking .1em), `.pv-terms`, `.lj-term`.
- `#print-root{display:none}` e o bloco de impressão:
```css
@media print{body>*:not(#print-root){display:none!important}#print-root{display:block}
@page{size:152mm 203mm;margin:0}
.pr-pg{width:152mm;height:203mm;overflow:hidden;position:relative;break-after:page;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pr-pg img{width:100%;height:100%;object-fit:cover;filter:var(--flt);transform:var(--tf)}
.pr-pg.land img{position:absolute;width:203mm;height:152mm;left:-25.5mm;top:25.5mm;transform:rotate(90deg) var(--tf)}}
```

## Outros arquivos
- `/home/claude/eterna/agente/abrir-terminal.bat` e `/home/claude/eterna/agente/abrir-terminal.command` (novos), com o modo `checkout` ou `caixa` e o IP como argumento (ou lido de `terminal.txt`):
  - Checkout: Chrome `--kiosk --user-data-dir=<perfil-eterna-terminal> --unsafely-treat-insecure-origin-as-secure=http://IP:8765 http://IP:8765/#loja`;
  - Caixa: `--kiosk-printing --user-data-dir=<perfil-eterna-caixa> http://IP:8765/#vivo`.
- `/home/claude/eterna/agente/Eterna.command` e `/home/claude/eterna/agente/iniciar-eterna.bat`: comentário sobre `ETERNA_REDE=1` e `ETERNA_HOSTS`.
- `/home/claude/eterna/testes/v80-multiterminal.js` (novo; critérios abaixo):
  - sobe o agente com HOME temporário, `ETERNA_REDE=1`, `ETERNA_SEM_OPENCV=1`, `ETERNA_HOSTS=<1º IP de hostname -I>` e `ETERNA_APP_ORIGIN=http://127.0.0.1:${PORTA do rodar.sh}`;
  - os aparelhos usam `http://<IP>:porta`, que chega com `client_address` fora do loopback (neste ambiente, 192.0.2.2); o computador do ponto usa `127.0.0.1`.
- `/home/claude/eterna/testes/todas-as-telas.js`: abre `vivo` e `terminais` sem agente.
- `/home/claude/eterna/testes/galeria-agente.js`: continua passando (rotas `/galerias/*` só no loopback).
- Documentação:
  - `DOCUMENTACAO-TECNICA.md`: rede, pareamento, `/ponto/*`, estados e impressão;
  - `GUIA-DA-EQUIPE.md`: como parear, achar a venda, imprimir, "Saiu certo", trocar rolo, revogar;
  - `CONTEXTO-ETERNA.md`: seções 3, 4 e 5 (D1 a D16);
  - `VERSOES.md` e o carimbo de versão.

## Contratos

**Corpo de `POST /ponto/vendas`** (checkout ou local; o terminal vem do cookie e nunca do corpo)
```json
{"id":"T03-a1b2c3-lk9x2q7f","criada":"ISO","card":"LPAB12CD","estado":"paga|aguardando","meio":"cartao|pix|dinheiro",
 "cart":[{"id":"zona"},{"id":"extra"},{"id":"fundo","ai":"ag_x|bg3"}],"total":304,"prints":4,"nPh":4,"nAI":4,
 "selected":["ag_..."],"aiSel":["ag_x|bg3"],"fotos":["ag_..."],"ed":{"ag_...":{"b":104,"c":100,"s":100,"t":5,"z":100,"x":0,"y":0}},
 "galeria":{"token":"<22 base64url>","codigo":"ABCD-2345"},"substitui":null,"lang":"pt"}
```
Validação:
- `id` `^[TCL][0-9]{2}-[0-9a-f]{6}-[a-z0-9]{8,16}$`, com o prefixo do aparelho;
- `card` `^[A-Z0-9]{4,16}$`;
- ids de foto por `pid_ok`;
- `selected ⊂ fotos`, `|fotos| ≤ 2000`, `|selected| ≤ 200`;
- `ed` só números entre −200 e 400;
- `cart[].id` existe em `precos`;
- `0 ≤ prints ≤ nPh`.

Respostas:
- 201 `{ok,venda,rev}`;
- 200 `{ok,ja:true,venda}`;
- 409 `{error:"id_em_uso"}`;
- 403 `{error:"prefixo"}`.

**Venda como o agente devolve**
```json
{"id":"...","rev":812,"disp":{"id":"T03-a1b2c3","nome":"Terminal 3","num":3},"criada":"ISO","recebida":"ISO","card":"LPAB12CD",
 "estado":"paga|aguardando|confirmada|cancelada|nao_paga|substituida","meio":"pix","total":304,"total_agente":304,"divergente":false,
 "prints":4,"nPh":4,"nAI":4,"selected":[],"aiSel":[],"ed":{},"galeria":{"token":"...","codigo":"ABCD-2345"},"saleNo":"V0042",
 "impressao":{"estado":"nao_se_aplica|pendente|imprimindo|impressa","fotos":[],"n":4,"porNome":"Thainá","disp":"Caixa 1","em":"ISO"},
 "reimpressoes":[{"n":1,"motivo":"falhou|outra_copia|cor|outro","porNome":"Thainá","disp":"Caixa 1","em":"ISO"}],
 "fechada":{"porNome":"Thainá","disp":"Caixa 2","em":"ISO","motivo":"cancelada_no_caixa|fim_do_dia|novo_pedido|pago_de_outro_jeito"},
 "alerta":null}
```
Para o aparelho `checkout`, a lista sai sem `ed` e sem `selected` (só estado, `saleNo` e `fechada`).

**`GET /ponto/vendas?desde=<rev>&limite=200[&meu=1]`**
- Resposta `{gen,rev,mais,vendas:[...],dispositivos:[{id,nome,tipo,num,visto}],estoque:{"Caixa 1":58}}`.
- `ETag: "<gen>.<rev>.<escopo>"`; com o mesmo valor em `If-None-Match`, 304.
- `desde=0` traz as vendas de hoje.

**Ações:** `POST /ponto/vendas/<id>/{confirmar|cancelar|imprimir|impressa|liberar|reimprimir}`
- Corpo: `{"esperado":"aguardando|pendente|imprimindo|impressa","idem":"<uuid>","por":{"nome":"Thainá","email":"loja@eterna.photo"},"fotos":[...],"n":1,"motivo":"falhou"}` (`fotos` só em `imprimir`; `n` e `motivo` só em `reimprimir`).
- 200 `{ok,venda}`; 409 `{error:"estado",venda}`; 403 para o tipo errado.

**Pareamento**
- `POST /ponto/convites` `{tipo}` → `{codigo,expira}`.
- `POST /ponto/parear` `{codigo,tipo,num}` → 200 `{ok,disp}` com `Set-Cookie: eterna_disp=...; HttpOnly; SameSite=Strict; Path=/; Max-Age=15552000`. Erros: 401 `{error:"codigo_invalido",restam}`, 409 `{error:"numero_em_uso",nome}`, 429 `{motivo:"bloqueado",ate}`.
- `GET /ponto/dispositivos` → `{dispositivos:[...]}` (sem hash).
- `POST /ponto/dispositivos/<id>/revogar` → `{ok}`. A partir daí o aparelho recebe 401 `{error:"disp_revogado"}`.

**Feed**
- `POST /ponto/sessoes` `{sessoes:[{card,key,fotografo,pdv,date,time,openedAt,fotos,menor,status,edits}]}` → `{ok,rev}`.
- `GET /ponto/sessoes?desde=` → `{gen,rev,sessoes}`, com ETag.
- `POST /ponto/config` e `GET /ponto/config` → `{venue,precos:{"zona":109,...},lojaFimSeg,local:{terminal:1,caixa:1},atualizado}`.
- `POST /ponto/estoque` `{acao:"rolo",capacidade:200,idem,por}` → `{ok,estoque}`.

Este contrato substitui o "contrato futuro" da v79 (`/caixa/pendentes`). Ele foi pensado para virar `/v1/venues/<venue>/vendas` no servidor sem mudar o JSON.

**Chaves I18N novas** (pt / en; o programador faz es, fr e de)
| chave | pt | en |
|---|---|---|
| `ljTerm(n)` | Terminal ${n} | Terminal ${n} |
| `ljPickup(n,t)` | ${PL(n,'Sua foto impressa sai','Suas '+n+' fotos impressas saem')} no balcão. Mostre este código ou diga: ${t}. | Your ${PL(n,'print is','{n} prints are')} ready at the counter. Show this code or say: ${t}. |
| `ljCashTerm(t)` | No caixa, diga: ${t}. | At the counter, say: ${t}. |

As telas Terminais, Vendas ao vivo e o painel escondido são da equipe e ficam só em português.

## Critérios de aceite
Os critérios 1 a 25 rodam em `testes/v80-multiterminal.js`, com os contextos: **L** = computador do ponto (`127.0.0.1`), **T1** e **T3** = terminais, **C2** = caixa (os três em `http://<IP>`), e **C1** = segundo caixa (L logado como Atendimento e venda).

**Rede e pareamento**
1. Com `ETERNA_REDE=1`, `GET http://<IP>/biblioteca`, `/thumb/<id>`, `/file/<id>`, `/events` e `/roverpix/data` sem cookie dão 403. `GET /status` e `/` (app) dão 200.
2. Vindo de `<IP>` com `Host: 127.0.0.1:P` forjado e sem Origin: `POST /roverpix/config`, `/photoroom/compose`, `/galerias/publicar` e `/ponto/convites` dão 403, e nada é gravado em `~/Eterna`.
3. Em L, Configurações › Terminais gera um código para terminal de cliente. Em T3, 3 toques no logo, "Este terminal", número 3 e o código levam a "Pareado como Terminal 3". O selo "Terminal 3" aparece no Checkout. `document.cookie` não mostra `eterna_disp` (HttpOnly). `eterna.terminal.v1` não tem token.
4. O mesmo código usado de novo dá "Código inválido". Um código depois de 10 min (adiantando o relógio do agente nos testes) é recusado. 5 códigos errados no mesmo IP: a 6ª tentativa dá 429.
5. Parear outro aparelho como Terminal 3 dá "Terminal 3 já está em uso". Depois de revogar em L, o Terminal 3 antigo recebe 401 na próxima chamada e o painel escondido mostra "não pareado".
6. A tela Terminais aberta em C2 mostra "Abra esta tela no computador do ponto". `POST /ponto/convites` vindo de C2 dá 403.

**Feed e fotos**
7. Sessões publicadas em L (`POST /ponto/sessoes` com fotos `ag_` do inbox) aparecem em T3 em até 6 s. Digitar o código do recibo abre a sessão, e as miniaturas carregam (`naturalWidth>0`; `/thumb` dá 200 com o cookie).
8. Com o cookie de T3, `/thumb/<id>` de uma foto fora das sessões do feed dá 403. Com o cookie de C2, dá 200.
9. Preço de `extra` mudado para R$ 45 em L: em até 65 s, T3 calcula o carrinho com R$ 45 (Ideal da v79 4.7) e o agente grava `divergente:false`.
10. O ajuste salvo em L para uma foto aparece em T3 na escolha e vai junto na venda (`ed`).

**Vendas e lista**
11. T3 vende 4 fotos por PIX. Em até 3 s, C2 mostra no topo: hora, "Terminal 3", "R$ 304", "4 fotos · 4 impressas", "paga · imprimir", código e 3 miniaturas, com destaque "nova" nos primeiros 120 s. A tela final de T3 diz "Suas 4 fotos impressas saem no balcão... Terminal 3".
12. T1 vende em dinheiro: em C2 entra no topo "aguardando caixa", acima da venda de T3 (ordem por chegada). O filtro "Terminal 3" mostra só a de T3. A busca "304", "R$ 304" ou o código, com ou sem hífen, encontra a venda certa.
13. O mesmo `POST /ponto/vendas` repetido dá 200 `ja:true` e existe uma linha só. O mesmo id com total diferente dá 409. Um id com prefixo de outro aparelho dá 403.
14. O cookie de T3 em `GET /ponto/vendas` devolve só as vendas de T3, sem `ed` e sem `selected`. `POST .../confirmar` com o cookie de T3 dá 403.
15. Sem mudança, o polling de C2 recebe 304 (conferir pelo log da rede ou contador no teste). A tela não chama `render()` sem mudança de `rev`. Com a busca em foco, o texto digitado não se perde.

**Dinheiro entre computadores**
16. C2 clica em "Recebi R$ X" na venda de T1: o estado vira confirmada, ganha `saleNo` `V0001` e a galeria é publicada no agente (o manifesto tem `comprada` só em `selected`). Em até 12 s, a sessão em T1 fica `paga`, e `SIM.caixaDin` de T1 fica `confirmada` com `porNome`.
17. C1 confirma a mesma venda depois de C2: o toast diz "Já confirmada por <nome> às hh:mm". Estoque, `saleNo` e receita mudam uma vez só.
18. Cancelar uma pendência em C2 exige a segunda confirmação, deixa a venda `cancelada`, e T1 volta a sessão para `pronta`.
19. Uma pendência com `criada` de ontem vira `nao_paga` no boot do agente.

**Impressão**
20. Em C2, "Imprimir 4 fotos" deixa o estado `imprimindo · Caixa 2`. `#print-root` tem 4 `.pr-pg` com `img` apontando para `/file/<hex>`. `page.pdf({preferCSSPageSize:true})` gera 4 páginas de 152×203 mm. Uma foto deitada sai girada e preenchendo a página.
21. C1, ao mesmo tempo, vê "Imprimindo no Caixa 2 por <nome>", e "Imprimir" dá 409. Depois de 5 min (relógio adiantado), C1 vê "Liberar".
22. "Saiu certo" deixa a venda `impressa` com nome, caixa e hora. O estoque do Caixa 2 cai exatamente 4. Recarregar C2 e tentar de novo não baixa outra vez. "Não saiu" volta a venda para `pendente` sem baixar.
23. "Reimprimir" 1 com o motivo "falhou" baixa 1, fica registrado na venda, e a reimpressão aparece no detalhe e no CSV (coluna `impressao`).
24. A pessoa que só vê vendas (`venda.r` sem `c`) não vê os botões. Forçar `pv-print` cai no `guardAct` com "Sem permissão". O Fotógrafo não abre `#vivo`. Logado como Admin em T3 (aparelho checkout), Vendas ao vivo mostra "Este aparelho é um terminal de cliente".

**Queda e volta**
25. O agente para, e T3 vende por PIX: a tela final aparece normalmente e o painel escondido mostra "1 venda esperando o agente". C2 mostra "Agente fora desde hh:mm" com os botões desabilitados. O agente volta: em até 15 s a venda aparece uma vez só em C2, e a fila de T3 zera.
26. O agente reaberto com `ETERNA_APP_ORIGIN` apontando para uma porta morta continua servindo `/index.html` do cache em disco, e T3 recarrega o Checkout.

**Regressão**
27. Sem agente (modo `off`), a v79 funciona igual: o critério 1.6 da v79 passa com duas janelas no mesmo navegador.
28. A Lista de vendas em L mostra as vendas de T1 e T3 uma vez só (sem duplicar com o espelho) e com a coluna do terminal. Receita, Vendas e Ticket somam só pagas e confirmadas. O CSV termina com `terminal;impressao`.
29. `bash testes/rodar.sh` termina com `FALHAS: 0`. Isso inclui `permissoes.js` (critério 19, com as letras novas em `MODULE_INFO`), `todas-as-telas.js` (com `vivo` e `terminais`) e `galeria-agente.js`.
30. Os textos `ljTerm`, `ljPickup` e `ljCashTerm` aparecem nos 5 idiomas, sem chave crua, e cabem em 390 px, 768 px e 1366 px.

## Riscos de segurança e escala (para o revisor)
1. **O usuário não é confiável no agente.** O login é simulado e fica por origem. O que o agente impõe é o **tipo do aparelho**. O `por` (nome e e-mail) é registro declarado: o `disp` vem do cookie e não dá para forjar, mas o nome dá. Correção definitiva: login no servidor, com o `por` vindo do token. Também: um usuário desativado no computador do ponto continua existindo no caixa da rede.
2. **Cookie em http puro na rede.** Quem escuta a rede rouba o cookie. Mitigação:
   - terminais e caixas em rede cabeada ou SSID WPA2 próprio, **nunca no Wi-Fi de visitante**;
   - revogação imediata pela tela Terminais;
   - alerta quando o IP de um aparelho mudar (o agente guarda `ip`).

   Definitivo: HTTPS local na fase 2. O cookie vale para o host em todas as portas: nenhum outro serviço web deve rodar no computador do ponto.
3. **Brechas atuais com `ETERNA_REDE` (achado 3).** O revisor deve testar cada rota de chave com e sem `Origin`, com `Host` forjado, de um IP da rede. O critério 2 cobre isso.
4. **A câmera do terminal depende de `--unsafely-treat-insecure-origin-as-secure`.** Ela só vale no perfil do lançador. Se alguém abrir o terminal num Chrome comum, a câmera não abre e só o código do recibo funciona.
5. **O terminal decide "paga" no cartão e no PIX** (não há TEF), como já é hoje. Quem tiver o cookie de um terminal consegue criar venda paga e liberar originais de uma sessão. Mitigações:
   - o cookie é HttpOnly e o terminal fica em modo quiosque;
   - o agente aceita só fotos da sessão;
   - total recalculado, e divergência marcada;
   - tudo auditado por aparelho.

   Fechamento definitivo: TEF e webhook.
6. **Fotos pela rede.** O terminal recebe `/file/` (original) das sessões de hoje e ontem, até 300 por minuto. Opção mais segura para a v81: uma vitrine de 1600 px com marca para os terminais. O caixa (equipe) lê tudo, porque precisa imprimir.
7. **Conflitos.**
   - Confirmar duas vezes: o primeiro ganha, o segundo recebe 409.
   - Imprimir duas vezes: a reserva por aparelho, com liberação manual depois de 5 min.
   - Pagar dinheiro e depois PIX: `substitui`; se a pendência já estava confirmada, `pago_duas_vezes` gera alerta para devolver.
   - Ações repetidas pela rede: `idem`.

   O revisor deve tentar uma corrida com duas abas de caixa clicando ao mesmo tempo.
8. **Fila do terminal.** As vendas ficam no `localStorage` do terminal até o agente confirmar. Limpar os dados do navegador perde a fila e o pareamento. O Guia da equipe deve dizer para nunca limpar os dados do perfil do terminal. O alerta "terminal sem contato" ajuda a ver.
9. **Painel escondido do terminal (3 toques).** Qualquer cliente pode abrir. Hoje ele lista "Sessões esperando", com fotos de outros clientes, e na v80 também o formulário de pareamento (inofensivo sem código). Recomendação para a v81: PIN da equipe nesse painel quando o aparelho estiver pareado.
10. **Pareamento.** Código de 8 caracteres em 32 símbolos (cerca de 10^12 combinações), 10 min, uso único, 5 tentativas por IP e 30 por minuto no total. Convites só em memória. O sha256 do token fica em arquivo chmod 600.
11. **LGPD.**
    - Vendas e sessões sem dado do cliente (ids de foto, valores, sessão).
    - A foto é dado pessoal: só aparelhos pareados veem, com `Cache-Control: private`, e o terminal apaga as sessões do feed com mais de 2 dias.
    - A selfie da busca não é gravada.
    - O e-mail do operador fica só no arquivo de eventos do agente (90 dias) e não sai na API nem no CSV.
12. **Escala num ponto** (5 terminais, 2 caixas, dia de jogo):
    - ~2,5 requisições por segundo, a maioria 304 com ~200 bytes;
    - ~800 vendas por dia, ≈ 1 MB na primeira carga e depois só as mudanças;
    - impressão lê 4 originais de ~15 MB, em memória, por venda;
    - `ThreadingHTTPServer` aguenta. A gravação usa `fsync` por evento, o que é aceitável nesse volume.
13. **Escala em muitos venues.** Cada venue tem o seu agente, isolado. O contrato `/ponto/*` vira o do servidor por venue, o polling pode virar SSE, e o agente passa a ter sua própria fila de subida (fora desta entrega).
14. **Internet caída:** tudo funciona, porque é local, e o app vem do cache em disco do agente. **Agente caído:** os terminais vendem e enfileiram, mas os caixas não confirmam nem imprimem até ele voltar (D9). O lançador do agente deve reabrir sozinho.
15. **IP do ponto mudando:** os terminais perdem o agente. Reserva no DHCP mais `ETERNA_HOSTS`, e a tela Terminais mostra o endereço atual.

**Para guardar na memória do projeto:**
- A v80 (multiterminal) foi desenhada com pareamento por código e cookie de aparelho, vendas no agente com polling e ETag, e impressão pelo navegador com `--kiosk-printing`.
- Três achados importantes: as sessões e os preços existiam só no navegador do computador do ponto; a câmera em http na rede exige a flag do Chrome; havia brechas abertas com `ETERNA_REDE=1`.
- Decisões em aberto para o Eduardo: (a) o vendedor vê o valor de cada venda (padrão: sim, sem totais); (b) fundo de IA não imprime; (c) confirmar e imprimir em dois toques; (d) manter ou não os textos de "2 minutos".
