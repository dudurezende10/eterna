# Plano v83: multiterminal, um notebook por vendedor

O documentador salva em `/home/claude/eterna/docs/planos/2026-10-29-v83-multiterminal.md`. Nenhum arquivo foi editado. O plano parte do main na v82 (`6b6da2d`) e junta o plano v80 (`docs/planos/2026-10-28-v80-multiterminal.md`) com a etapa 1 e a parte D do plano do Ronaldo (`docs/planos/2026-10-28-v85-nuvem-e-ponta-da-venda.md`), seguindo as decisões do Eduardo de 29/10.

## Objetivo
Cada vendedor tem um notebook com o admin, o Checkout no segundo monitor virado para o cliente e a própria DNP. O vendedor acompanha a escolha ao vivo, confirma o pagamento da maquininha Imply ou do dinheiro e imprime em 10×15. Todos os notebooks pareiam com o agente do ponto pela rede local, funcionam sem internet, e o agente junta as vendas de todos os notebooks para quem tem permissão.

## Como a operação fica
1. O computador do ponto roda o agente e mantém o Eterna aberto em `http://127.0.0.1:8765` no Upload automático, como hoje. É ele que fecha as sessões e as publica.
2. O notebook abre pelo atalho "Eterna Posto" (Chrome com perfil próprio) em `http://<IP-do-ponto>:8765`. O vendedor entra no admin e clica em "Abrir Checkout". A janela do cliente vai para o segundo monitor e o admin cai na tela **Posto de venda**.
3. O cliente olha para a câmera, escolhe as fotos e o pacote e toca em Cartão, PIX ou Dinheiro. Enquanto isso, o vendedor vê no Posto de venda a foto em tela, as escolhidas, o pacote e o total.
4. O Checkout mostra "Pague na maquininha: R$ X" (ou "Pague em dinheiro") e a venda fica aguardando pagamento. O vendedor digita o valor na Imply e, quando aprova, toca em "Pago na maquininha" (o NSU é opcional).
5. O Checkout troca sozinho para a tela do QR. O vendedor toca em "Imprimir N fotos": saem na DNP em 10×15, e ele marca "Saiu certo" ou "Não saiu".
6. Cada passo vira um evento enviado ao agente por uma fila local que não perde nada. Painel, Lista de vendas, Caixa e Alertas mostram as vendas de todos os postos para quem pode ver.

## Achados no código da v82 que mudam o desenho
1. **As brechas com `ETERNA_REDE=1` continuam abertas (o achado 3 da v80 segue valendo).**
   - `/roverpix/config`, `/ftp-remoto/config` e `/photoroom/config|compose` só recusam quando existe um `Origin` de fora (linhas 2598 a 2646). Um `curl` sem `Origin` vindo da rede troca chaves e gasta Photoroom.
   - `/roverpix/sync` não confere nada.
   - `origem_local()` (linha 2244) olha só o `Host`, que dá para forjar, e ignora `client_address`.
   - `/biblioteca`, `/thumb/`, `/file/` e `/events` atendem qualquer requisição da rede sem `Origin`.
   - `cors()` manda `Access-Control-Allow-Origin: *` em todas as rotas que não são privadas.
2. **As sessões nascem no navegador** (`agentPoll` lê `/events`, depois `ingPush` e `ingClose`, que gera `'LP'+random`). Um notebook que lesse `/events` criaria **outras sessões, com outros códigos, para as mesmas fotos**. Por isso o notebook nunca lê `/events`: as sessões vêm de um feed publicado pelo computador do ponto.
3. **Os usuários ficam por origem.** No `http://IP:8765` o notebook só tem a semente (`seedUsers`). O `claude.use('db')` não existe na origem do agente, então quem foi desativado no computador do ponto continua entrando no notebook.
4. **O `novoSaleNo()` é `'E'+contagem` local** e se repete entre notebooks (todos teriam um E001).
5. **`lojaPay` marca cartão e PIX como pagos no toque**, baixa `SIM.stock['Caixa 1']` e chama `galDaVenda`, que manda para `/galerias/publicar`. Essa rota é só local, então daria 403 vindo do notebook.
6. **As prévias de fundo de IA do Checkout chamam `/photoroom/compose`** (`compose()`, linha 2108). Quando a rota for fechada para a rede, os fundos param nos notebooks, a menos que haja uma regra para o posto.
7. **O cache do app em `app()` fica só na memória.** Se o agente reabre sem internet, responde 502. Além disso, `lan_ip()` depende de rota para 8.8.8.8.
8. **As duas janelas do notebook (admin e Checkout) dividem o `localStorage`.** A ponte do `storage` da v79/v81 funciona, mas `saveSim()` regrava o SIM inteiro e pode apagar o que a outra janela acabou de gravar. A fila de envio precisa de chave própria.
9. **A câmera em `http://IP` exige `--unsafely-treat-insecure-origin-as-secure`** (com `--user-data-dir`). O `--kiosk-printing` vale para todo `print()` do perfil: o QR de grupo, por exemplo, também sairia na DNP.

## Decisões assumidas (o padrão mais seguro; o Eduardo pode trocar)
| # | Decisão |
|---|---|
| D1 | **Um tipo de aparelho: `posto`** ("Posto N", N de 1 a 30), com `escopo` definido no convite: `proprias` (padrão, notebook do vendedor) ou `todas` (notebook de supervisor ou gerente). O computador do ponto é o `L00`, "Computador do ponto", e tem escopo `todas`. |
| D2 | **Cada notebook manda nas próprias vendas.** Cria, confirma o pagamento, cancela a pendência e imprime. O agente valida, junta e publica a galeria. Nenhum aparelho mexe na venda de outro posto nesta versão: sem conflito entre aparelhos, sem reserva de impressão. |
| D3 | **Pagamento atrás de uma interface.** App: `PAG_PROV` com `pos-manual` (agora) e `tef: null` (reservado). Agente: `PagamentoPonto` com `PosManual` e `Tef` (`NotImplementedError`), escolhido por `ETERNA_PAG_PONTO`. Cartão, PIX e Dinheiro ficam `aguardando`. Vale também sem agente (modo `off`), e o caminho "pago no toque" deixa de existir. |
| D4 | **NSU/autorização é opcional**: só dígitos, de 4 a 12. Uma sequência de 13 a 19 dígitos é recusada com "Isso parece número de cartão" (nunca gravar cartão). Um NSU repetido no mesmo dia e no mesmo posto gera alerta, mas não bloqueia. |
| D5 | **Tela final do Checkout com dois estados.** Aguardando: mostra o meio, o valor e o código, sem contagem regressiva. Confirmado: vira a tela de hoje (QR e volta em `lojaFimSeg`). Se o vendedor cancela, o Checkout volta ao carrinho da mesma sessão com um aviso. "Voltar ao início" continua disponível, e a pendência segue com o vendedor. |
| D6 | **Confirmar e imprimir em dois toques.** "Pago na maquininha" e depois "Imprimir N fotos", com as fotos já marcadas (favoritas primeiro, até `prints`). O vendedor pode trocar quais imprimir antes. |
| D7 | **Sem faixa de identificação nesta versão.** Avaliação: há um cliente por notebook e a impressora fica ao lado do vendedor, então o risco de trocar fotos é baixo. A faixa de 6 mm reduz ou cobre a foto de um produto premium. A rastreabilidade fica no registro `impressoes` da venda. Se houver troca na operação, entra como interruptor em Painel de controle. |
| D8 | **Foto com fundo de IA imprime** (correção do Eduardo, 29/10 10:47). A impressão usa a imagem montada do fundo, na maior resolução disponível. Se a montagem falhar, só essa foto fica para tentar de novo. `semFoto` conta só quando o pacote prevê mais impressões do que o total de fotos (campo mais IA). |
| D9 | **Valores.** No Posto de venda, o vendedor vê "Minhas vendas de hoje" (deste notebook e do e-mail dele), com o valor de cada venda e **nenhum total, ticket ou contagem em reais**. O agente devolve a um posto `proprias` só as vendas dele. Totais aparecem só em escopo `todas` ou local, e só para quem tem `financeiro.r`. |
| D10 | **Identificação.** `id` = `<dispId>-<ts36><rand4>`. `saleNo` = `P<num>-<seq diário de 3 dígitos>` (ex.: `P3-012`; `L0-012` no computador do ponto), gerado no notebook, sem depender do agente. |
| D11 | **Feed de sessões, configuração e usuários publicado pelo computador do ponto.** Nos postos, Usuários, Permissões e preços ficam só para leitura ("Altere no computador do ponto"). |
| D12 | **O agente recalcula o total com os preços do feed.** Se divergir, aceita e marca `divergente`, com alerta. Recusar perderia uma venda já paga. |
| D13 | **Venda paga marca a sessão como vendida no feed.** Outro notebook passa a ver a sessão como paga e cai no `ljAlreadyPaid`. Uma segunda venda paga da mesma sessão é aceita e gera o alerta `sessao_vendida_duas_vezes`. |
| D14 | **Fundos de IA no posto:** `/photoroom/compose` só com `pid` de foto do feed (nunca `image_b64`), no máximo 30 por minuto e 300 por dia por posto. |
| D15 | **Saem as promessas de "2 minutos"** (`printsReady`, `incPrintD`, `secure`). A DNP RX1HS leva cerca de 2,5 min para 12 fotos. |
| D16 | **Polling com ETag e 304.** Sessões: 5 s com o Checkout na câmera, 15 s nos outros casos. Configuração e usuários: 60 s. Vendas (só local e `todas`): 5 s em Caixa e Lista de vendas, 15 s nas outras telas. |
| D17 | **Retenção no agente.** Eventos de venda: 90 dias. Sessões do feed: 7 dias. Postos: até revogar. Convites: só em memória. Sem nome, e-mail, rosto ou IP de cliente. O nome do vendedor é declarado e só fica registrado. |

## Escopo, em partes testáveis sozinhas (ordem de implementação)
| Parte | O que entrega | Como se testa sozinha |
|---|---|---|
| **A** Rede segura | loopback, rotas de chave só no computador do ponto, porta de entrada da rede, `ETERNA_HOSTS`, CORS, cache do app em disco | `curl` de um IP da rede, com e sem `Origin`, com `Host` forjado |
| **B** Pareamento | convite, cookie HttpOnly, revogação, tela Postos, cartão de pareamento no login do notebook, atalho do Chrome | dois contextos (127.0.0.1 e IP) |
| **C** Feed do ponto | sessões, ajustes, descartes, preços, usuários; fotos, rostos e fundos para quem está pareado | sessão publicada em L aparece no notebook |
| **D** Pagamento aguardando | interface `pos-manual`, as 3 formas aguardando, tela do cliente, Posto de venda com "Pago na maquininha" e NSU | num navegador só, sem agente |
| **E** Venda acompanhada | `BroadcastChannel('eterna-loja')` do Checkout para o Posto de venda | duas janelas, sem agente |
| **F** Impressão 10×15 | seleção, `#print-root`, "Saiu certo", "Não saiu", reimpressão, rolo por posto | `page.pdf` com 102×152 mm, sem agente |
| **G** Vendas no agente | fila de eventos, `POST /ponto/eventos`, máquina de estados, galeria publicada pelo agente, escopo | agente com HOME temporário |
| **H** Vendas de todos nas telas | Painel, Lista, CSV, Caixa, Alertas; "Minhas vendas de hoje" | L e um posto `todas` veem as vendas de dois postos |

## Fora do escopo
Nuvem (S3, AWS, API), galeria no celular do cliente, Rekognition, pós-venda e motor de fundos. Também ficam de fora:
- TEF real;
- leitura do QR do comprovante (jsQR);
- pedido Imply único e conciliação;
- faixa na foto (D7);
- impressão pelo agente (spooler ou pasta quente) e contador real do rolo;
- HTTPS local;
- login real da equipe;
- uma vitrine de 1600 px para os postos (o posto lê o original para imprimir);
- vendas online (`/galerias/vendas`) aparecendo num posto `todas` (seguem só no computador do ponto);
- sessões fechadas pelo agente sem navegador aberto.

## O que cai do plano v80 (por causa do caixa central) e o que entra do Ronaldo
**Cai da v80:**
- os dois tipos de aparelho (`checkout` e `equipe`), "Terminal N" e "Caixa N": vira um tipo só, `posto`;
- a tela **Vendas ao vivo** (`vivo`) como caixa central: as vendas de todos aparecem em Painel, Lista, Caixa e Alertas;
- a reserva de impressão (D12), o "Liberar depois de 5 min" e o 409 "Imprimindo no Caixa 2";
- confirmar ou cancelar dinheiro de outro aparelho, e as ações remotas `confirmar|cancelar|imprimir|liberar` por venda;
- `pontoMeuPull`: a confirmação acontece no mesmo notebook e chega pelo `storage`;
- `ljPickup` e `ljCashTerm` ("saem no balcão, diga Terminal N");
- o lançador em modo "caixa";
- a ASK-400: entra a DNP de cada notebook;
- o estoque por "Caixa N": vira estoque por posto.

**Fica da v80, adaptado:** achados e parte A (rede), pareamento por convite e cookie (B), feed (C), id da venda nascendo no aparelho, idempotência, total recalculado, galeria pelo agente (`pv_galeria`), espelho no computador do ponto, ETag, cache do app em disco, CSS de impressão e retenção.

**Entra do Ronaldo agora:**
- A, sem leitura de QR: cartão e PIX aguardando, confirmação humana, campo de referência;
- B: venda acompanhada por `BroadcastChannel`, só leitura, some em 15 s;
- C: DNP pelo Chrome, `--kiosk-printing`, seleção de fotos, "Saiu certo", "Não saiu", reimpressão com motivo e registro `impressoes`;
- o atalho do Chrome por notebook, conferindo se a impressora padrão é uma DNP;
- D: v80 A a D, com "cada notebook é terminal e caixa da própria venda".

**Fica para a próxima versão do plano do Ronaldo:** jsQR e pedido Imply, faixa (D6 dele), E a K (nuvem, API, vendas centrais, login real, eventos da galeria, adquirente, pós-venda) e L1 a L4 (fundos).

---

## Mudanças em `/home/claude/eterna/agente/eterna-agente.py`

### A. Rede
- **`HOSTS_OK` calculado no boot** por `hosts_ok()`: `127.0.0.1:P`, `localhost:P`, os IPv4 de `socket.getaddrinfo(socket.gethostname(),None)`, `lan_ip()` e `ETERNA_HOSTS` (separado por vírgula). Também `ORIGENS_PROPRIAS = {"http://"+h for h in HOSTS_OK}`. `lan_ip()` não pode derrubar o boot sem rota (já cai em `gethostbyname`; documentar que offline vale o `ETERNA_HOSTS`).
- **Novos métodos em `H`:**
  - `loopback()`: `client_address[0]` em `127.0.0.1`, `::1` ou `::ffff:127.0.0.1`;
  - `local()`: `loopback()`, Host em 127.0.0.1 ou localhost, e `Origin` ausente, local ou `APP_ORIGIN`;
  - `local_chave()`: igual, mas sem aceitar `APP_ORIGIN`.
- **`origem_local()` passa a exigir `loopback()`.**
- **Exigem `local_chave()`:** `/roverpix/config`, `/roverpix/sync`, `/ftp-remoto/config` e `/photoroom/config`. `/photoroom/compose` exige `local_chave()` ou a regra D14.
- **`porta_rede(method, path)`**, no começo de `do_GET`, `do_POST` e `do_OPTIONS`:
  - quando não é `loopback()`, o `Host` precisa estar em `HOSTS_OK` (senão 403) e só passam as rotas da tabela abaixo;
  - o resto devolve 403 `{"error":"so_no_computador_do_ponto"}`;
  - sem cookie válido nas rotas de pareado, devolve 401 `{"error":"nao_pareado"}`.
- **`cors()`:** a requisição que não vem do loopback não recebe `Access-Control-Allow-Origin` nunca. `/ponto/*` também não, em caso algum (só mesma origem).
- **`app()` com cache em disco:**
  - arquivos em `~/Eterna/app-cache/<sha256(path)>` mais `.meta` (`{ctype,em}`);
  - caminho só `^/[A-Za-z0-9._/-]+$`, sem `..`;
  - se a busca falhar, serve o disco;
  - `APP_PREAQUECER`: lista fixa com `/index.html`, `vendor/qrcode/qrcode.min.js` e os arquivos de `vendor/ort/` e `vendor/rostos/` que o Checkout carrega, baixados por uma thread no `main()`.
- **`/status`** ganha `ponto:1` e `disp` (`{id,num,nome,escopo}` ou `null`, vindo do cookie). `rede:[hosts]` só para loopback.
- **`main()`** imprime "Postos: http://<ip>:PORTA" para cada host, com `ETERNA_REDE` ligado.

### B. Pareamento
Arquivos: `~/Eterna/ponto/postos.json` (`_grava_privado`, chmod 600) e `~/Eterna/ponto/postos.log.jsonl`. Trava `ponto_lock = threading.RLock()`.
- **`conv_emitir(escopo)`:** código `XXXX-XXXX` em `GAL_ALFA`. Em memória fica `{hash, escopo, exp: agora+600}`, com no máximo 5 ativos.
- **`posto_parear(codigo, num, ip)`:**
  - `hmac.compare_digest` sobre o sha256 do código; o convite é consumido;
  - `num` em uso por um posto ativo dá 409;
  - gera `token=secrets.token_urlsafe(32)`, `id="P%02d-%s" % (num, 6 hex)` e grava `{id,num,nome:"Posto N",escopo,hash,criado,visto,ip,revogado:null}`.
- **`posto_de_cookie(h)`:** lê `eterna_disp` com `SimpleCookie`, calcula o sha256 e devolve o posto ativo ou `None`. Atualiza `visto` e `ip` em memória, grava no máximo a cada 60 s, e registra `ip_mudou` no log.
- **`posto_revogar(id)`.**
- **Limites:** `limite_ok(ip,"parear",5)` por minuto e `limite_ok("*","parear",30)` no total. 5 erros bloqueiam o IP por 15 min (`falhou`/`bloqueio`).

### C. Feed
- **`~/Eterna/ponto/sessoes/AAAA-MM-DD.jsonl`**: upsert por `card`, com `rev`. Em memória ficam as sessões de hoje e ontem e `fotos_permitidas` (conjunto refeito a cada upsert ou venda). Cada sessão guarda `vendida:{venda,posto}` (D13).
- **`~/Eterna/ponto/config.json`** e **`~/Eterna/ponto/usuarios.json`** (chmod 600). Os usuários entram só com os campos `v,email,name,active,preset,perms,menu,inicio,key`, até 500 usuários e 256 KB.
- **`~/Eterna/ponto/gen.json`**: id aleatório criado uma vez (o cliente recarrega tudo se ele mudar).
- **Rotas para pareados:**
  - `/rostos/buscar`: `limite_ok("disp:"+id,"rostos",20)` por minuto; a selfie continua sem ser gravada;
  - `/thumb/` e `/file/`: só `pid` em `fotos_permitidas`, 600 por minuto por posto, com `Cache-Control: private, max-age=3600`;
  - `/photoroom/status`, `/photoroom/result/<nome>` e `/photoroom/compose` pela regra D14 (`limite_ok("disp:"+id,"pr",30)` e um contador diário).

### G. Vendas
- **`~/Eterna/ponto/vendas/AAAA-MM-DD.jsonl`**: um evento aceito por linha, `{rev,t,posto,idem,venda,seq,tipo,dados,por}`, gravado com `flush` e `os.fsync`.
- **`pv_carregar()`** no boot: reexecuta os eventos de hoje e as vendas `aguardando` de até 2 dias. O `rev` volta para o maior visto.
- **`pv_aplicar(posto, ev)`**, validado pelo contrato:
  - o `venda` começa com `posto.id` (senão `recusado:prefixo`; local usa `L00`);
  - `seq` = último + 1 (repetido com o mesmo `idem` dá `ja`; com conteúdo diferente, `conflito`).

  | tipo | regra |
  |---|---|
  | `criar` | venda nova, sempre `aguardando`. Total recalculado e `divergente`. `selected ⊂` fotos da sessão no feed (fora do feed: aceita, marca `alerta:'sem_sessao'` e não publica galeria). |
  | `pagar` | só de `aguardando`. `PagamentoPonto[prov].validar(dados)` (`pos-manual`: `ref` vazio ou 4 a 12 dígitos; `dinheiro`: sem `ref`). Vira `paga`, roda `pv_galeria(v)`, marca `vendida` na sessão; se ela já estava vendida, alerta. `impressao.estado` vira `pendente` se `prints>0`. |
  | `cancelar` | só de `aguardando`. Vira `cancelada` ou `substituida` (motivo `novo_pedido`). |
  | `impressao` | só de `paga`. Anexa a `impressoes`. `resultado:'ok'` sem reimpressão vira `impressa` e baixa o estoque uma vez. A reimpressão baixa `n`. |
  | `rolo` | `estoque[posto.nome] = capacidade`. |

- **`pv_galeria(v)`:** reaproveita `gal_validar`, `gal_mesclar`, `REPO.salvar_manifesto`, `codigos` e `gal_fila.put`. Monta o manifesto com as fotos da sessão no feed, `comprada` só no `selected`, `menor` do feed e `precos` da configuração. Se o código colidir com o de outro token, gera um novo e devolve `codigo_novo` no resultado.
- **`pv_virada()`** (thread de 60 s): `aguardando` de dia anterior vira `nao_paga` (`sistema`, `fim_do_dia`). Apaga vendas com mais de 90 dias e sessões com mais de 7.
- **`PagamentoPonto`:** classe base com `validar(dados)` e `iniciar(venda)`. `PosManual` implementa a validação e devolve `{"estado":"aguardando"}`. `Tef` levanta `NotImplementedError`. A escolha fica em `pag_ponto_escolhido()` (`ETERNA_PAG_PONTO`, padrão `pos-manual`), no padrão de `pagamento_escolhido()`.

**Quem acessa o quê** (a requisição do loopback continua como hoje, mais as rotas `/ponto/*` de local)

| Rota | local | posto `todas` | posto `proprias` | sem cookie (rede) |
|---|---|---|---|---|
| app, `GET /status`, `POST /ponto/parear`, `/g/*` públicas | sim | sim | sim | sim |
| `GET /ponto/sessoes`, `/ponto/config`, `/ponto/usuarios`; `POST /rostos/buscar`; `/photoroom/status|result|compose` (D14) | sim | sim | sim | 401 |
| `GET /thumb/`, `/file/` | tudo | fotos do feed | fotos do feed | 401 |
| `POST /ponto/eventos` | sim (`L00`) | só vendas com o próprio prefixo | só vendas com o próprio prefixo | 401 |
| `GET /ponto/vendas` | todas | todas, sem `selected`, `ed` ou token | só as dele, sem `ed` | 401 |
| `POST /ponto/convites`, `GET /ponto/postos`, `POST /ponto/postos/<id>/revogar`, `POST /ponto/sessoes|config|usuarios`, rotas de chave, `/galerias/*`, `/biblioteca`, `/events`, `/metricas`, `/roverpix/*`, `/ftp-remoto/*`, `/rostos/medir|projecao` | sim | 403 | 403 | 403 |

Todo POST em `/ponto/*` exige `X-Eterna: 1`, `Host` em `HOSTS_OK` e `Origin` ausente ou em `ORIGENS_PROPRIAS`. Limites de corpo por `corpo()`: eventos 256 KB, sessões 2 MB, usuários 256 KB, o resto 16 KB.

---

## Mudanças em `/home/claude/eterna/index.html`

### B. Modo e pareamento
- **`pontoModo()`** devolve:
  - `'local'`: hostname 127.0.0.1 ou localhost, `state.agent.on` e `st.ponto`;
  - `'posto'`: `st.disp` presente;
  - `'nao_pareado'`: agente ligado com `st.ponto`, fora do loopback e `st.disp` nulo;
  - `'off'`: os outros casos.

  `agentPoll` guarda `st.disp` em `state.posto.disp`. Se vier `null` com `eterna.posto.v1` gravado, limpa a chave (o posto foi revogado).
- **Em `posto` e `nao_pareado`:** `agentPoll` chama só `/status`. Nada de `/events`, `libLoad` ou `ingClose` automático. `livePoll` e `rftpPoll` não rodam. `galFilaTick` marca o item `via_venda` e não chama `/galerias/publicar`.
- **`postoParearCard()`**, em `vEntrar` (abaixo do login) e em `vPosto` quando o modo é `nao_pareado`: select `#posto-num` (1 a 30), `#posto-cod` e o botão `data-act="posto-parear"`.
- **`postoParear()`:** `POST /ponto/parear`. Respostas:
  - 200 grava `eterna.posto.v1` `{id,num,nome,escopo}` (nunca o token);
  - 401 "Código inválido (restam N)";
  - 409 "Posto N já está em uso. Revogue no computador do ponto.";
  - 429 "Muitas tentativas. Espere 15 min."

  Não entra em `WRITE_OPS`: quem autoriza é o código.
- **View `postos`** ("Postos de venda"): entra em `VIEWS` no grupo Configurações, depois de `catalogo`, com `MODULES.configuracao` + `'postos'`. O texto de `MODULE_INFO.configuracao.u` acrescenta "parear e revogar postos de venda". `vPostos()` funciona só em `local` (senão mostra "Abra esta tela no computador do ponto") e tem:
  - os endereços (`st.rede`);
  - `postos-convite` com `data-escopo="proprias|todas"`, que mostra o código grande e o tempo restante;
  - a tabela de postos (nome, escopo, visto há N, último IP, pareado em) com `postos-revogar` e a confirmação `postos-revogar-ok` / `postos-revogar-no`.
- **`WRITE_OPS`:** `'postos-convite':'u'` e `'postos-revogar-ok':'u'`, com `ACT_MOD` `configuracao`.

### C. Feed
- **Publicação (só em `local`), por `pontoReq(method,path,body,{etag})`** (`credentials:'same-origin'`, `X-Eterna:1`, `AbortController` de 4 s):
  - `pontoSessPub(cards)` monta `{card,key,fotografo,pdv,date,time,openedAt,fotos,descartadas,menor,status,edits}`, só com fotos `ag_` e só os `edits` dessas fotos. É chamada no fim de `ingClose`, quando `validateReal` resolve, em `m-discard` e `m-adjust` (com debounce de 3 s) e para as sessões de hoje quando o agente conecta;
  - `pontoCfgPub()`: `precos` de todo o catálogo por `priceOf`, `lojaFimSeg` e `venue`. Chamada nos `case` `price` e `price-reset`, na mudança do tempo do Checkout e quando o agente conecta;
  - `pontoUsersPub()`: chamada em `saveUsers` e quando o agente conecta.
- **Leitura (em `posto`):**
  - `pontoSessPull()`: mescla em `SIM.sessions` com `origem:'ponto'`. Nunca regrava sessão local `aguardando` ou `paga`. Sessão `vendida` por outro posto vira `status:'paga'`, com `vendidaEm`. Preenche `UP['ag_'+hex]`, `SIM.edits` (quando não existe ou é `auto`) e `SIM.discarded`, e poda as sessões `origem:'ponto'` com mais de 2 dias;
  - `pontoCfgPull()`: aplica `SIM.prices` e `SIM.lojaFimSeg`. Em `vCatalogo`, os campos ficam desabilitados com a nota "Preços vêm do computador do ponto";
  - `pontoUsersPull()`: troca `USERS`, roda `migrateUsers(false)` e confere `state.user` (removido ou inativo faz `logout()` com "Seu acesso foi removido"). `permSave`, `user-save`, `user-new`, `user-active` e `user-del-ok` recusam em `posto` com "Altere no computador do ponto".

### D. Pagamento aguardando e tela Posto de venda
- **Interface:** `const PAG_PROV={'pos-manual':{nome:'Maquininha avulsa',iniciar:rec=>({estado:'aguardando'}),manual:true},tef:null}`, com `pagProv()` (padrão `pos-manual`).
- **`lojaPedido(card,meio)`** (`meio` = `cartao`, `pix` ou `dinheiro`) generaliza `lojaDinheiro`, e `lojaPay` passa a chamar só isso.
  - O registro em `SIM.caixaDin` ganha `meio`, `prov` (`dinheiro` ou `pagProv()`), `saleNo` (`pvSaleNo()`), `vendedor:{nome}` (lido de `eterna.posto.vendedor`) e `fav`.
  - Registro antigo sem `meio` conta como `dinheiro`.
  - Não baixa estoque nem publica nada.
  - Emite o evento `criar` (G).
  - A tela recebe `lojaFim({wait:true,meio,...})`.
- **Tela `done` com `p.wait`:**
  - `cash` mantém os textos da v79;
  - `cartao` e `pix` usam `ljPosEyebrow`, `ljPosCardH`/`ljPosPixH` e `ljPosCardSub`/`ljPosPixSub`, além de `ljPosCode` e `ljPosWait`;
  - não mostra QR e não liga `lojaTick`.
- **`lojaPendCheck()`**, chamada no ouvinte `storage` e no render do `done` com `wait`:
  - `confirmada`: `k.paid` sem `wait`, `doneAt` e timer (a tela atual do QR);
  - `cancelada`: `k.step='cart'`, `k.pay=null` e `k.aviso='ljPayCancelled'` (linha `lj-fine` no carrinho);
  - `nao_paga`: `lojaReset()`.

  O `simResumo` já inclui `caixaDin`, então a janela redesenha sozinha.
- **`pendConfirmar(id,{ref})`** generaliza `dinConfirmar`:
  - `s.payment` passa a ser "Cartão (maquininha)", "PIX (maquininha)" ou "Dinheiro";
  - grava `s.pag={prov,ref,em,porNome}`, `s.saleNo = r.saleNo` e `s.impressao={estado: prints?'pendente':'nao_se_aplica'}`;
  - **sem baixa de estoque** (vai para F);
  - `galDaVenda` só em `local` ou `off`;
  - emite o evento `pagar`;
  - `dinConfirmar` continua como apelido, para os testes da v79.
- **`pendPainel()`** substitui `dinPainel()`. Título "Aguardando pagamento"; cada item traz o ícone e o nome do meio, valor, código, sessão, "há N min" e as miniaturas. Botões:
  - cartão e PIX: `pend-pos` "Pago na maquininha", que abre `#pend-ref` ("NSU ou autorização, opcional") e `pend-pos-ok`;
  - dinheiro: `din-confirm` "Recebi R$ X";
  - todos: `din-cancel`, `din-cancel-ok` e `din-cancel-no` como hoje.

  A validação de D4 acontece no app e no agente.
- **View `posto`** ("Posto de venda"):
  - entra em `VIEWS_EXTRA.posto`, `MODULES` venda (`['checkout','fila','caixa','posto']`), `PRESETS.venda.menu` e `inicio:'posto'`;
  - a descrição do preset troca "sem números de vendas" por "vê o valor de cada venda sua de hoje, sem totais";
  - `MODULE_INFO.venda.c` passa a dizer "confirmar pagamento da maquininha ou do dinheiro, imprimir e reimprimir";
  - o case `loja-abrir` chama `lojaJanela()` e depois `go('posto')` se `canView('posto')`;
  - `lojaJanela()` grava `eterna.posto.vendedor` `{email,nome}` do usuário logado.
- **`vPosto()`:**
  - cabeçalho: "Posto N" (ou "Computador do ponto"), pill do agente (ligado, ou "fora desde hh:mm"), "N eventos esperando o agente" e o rolo;
  - coluna esquerda: `ecoPainel()` (E);
  - coluna direita: `pendPainel()`, `impPainel()` (F) e `minhasVendas()` (H).
- **`WRITE_OPS`:** `'pend-pos-ok':'c'` (`ACT_MOD` `venda`). `pend-pos` não grava.

### E. Venda acompanhada
- **No Checkout:**
  - `lojaEco()` publica no `BroadcastChannel('eterna-loja')` ao fim de cada `render()` com `state.lojaRota` (com intervalo mínimo de 300 ms) e a cada 5 s;
  - publica `{tipo:'fim'}` em `lojaSair`, `lojaEsc` e `pagehide`;
  - sem `window.BroadcastChannel`, não faz nada.
- **No admin:**
  - `ecoOuvir()` guarda `state.eco` e a hora da mensagem;
  - `ecoPainel()` mostra a foto atual grande (`bigStyle`, ou `compimg` para IA), "Foto i de N", as miniaturas das escolhidas (com favorita), o pacote com selo Ideal, as linhas e o total, o meio, a bandeira do idioma e "parado há N s";
  - com etapa `done` e `pend`, destaca a pendência e rola até ela;
  - sem mensagem por 15 s, mostra "Checkout fechado ou parado";
  - **atualiza só o `#eco`** com `innerHTML`, sem `render()`, para não apagar o campo de NSU.
- Nada vai para o agente.

### F. Impressão 10×15
- **Refatoração:** `editStyle(id)` passa a chamar `editStyleObj(SIM.edits[id])`. `editStyleObj(e)` devolve `--flt` e `--tf`.
- **`impFotos(s)`:** fotos do campo de `s.selected` (sem as de IA), favoritas primeiro, até `s.prints`. Devolve `{fotos, semFoto}`.
- **`impPainel()`:** vendas pagas deste notebook com `impressao.estado` diferente de `nao_se_aplica`.
  - `pendente`: grade com `imp-pick` (não passa de `prints`) e `imp-print` "Imprimir N fotos (10×15)", mais a nota de `semFoto` quando houver;
  - depois de `afterprint`: `imp-ok` "Saiu certo" e `imp-falha` "Não saiu";
  - `impressa`: "Impressa por X às hh:mm", mais `imp-reprint` (número de 1 a `prints`, chips `imp-motivo` com falhou, outra cópia, cor ou outro, e `imp-reprint-ok`).
- **`printMontar(fotos, ed)`:** cria `#print-root` como filho de `body`, fora de `#main`, com uma `.pr-pg` por foto e `<img src="<agente>/file/<hex>" style=editStyleObj(ed[id])>`. A foto de exemplo usa o sprite. Espera `img.decode()` de todas (limite de 15 s). Foto deitada (`naturalWidth>naturalHeight`) ganha `.land`. Depois chama `window.print()`, e o `afterprint` acontece uma vez só.
- **Estoque e registro:**
  - "Saiu certo" muda `impressao.estado` de `pendente` para `impressa` e baixa `SIM.stock[postoNome()]` uma vez (protegido pela transição);
  - a reimpressão baixa `n`;
  - "Não saiu" grava a tentativa e volta a `pendente`;
  - cada passo grava em `s.impressoes` e emite o evento `impressao`;
  - `postoNome()` devolve "Posto N", ou "Caixa 1" em `local`/`off` (compatível);
  - `stock-swap` age em `postoNome()` e emite `rolo`.
- **`caixaConfirm` (venda no balcão):** a baixa de estoque sai daqui e vai para o fluxo de impressão. Em modo ponto, emite `criar` e `pagar`. `caixa-reprint` abre o mesmo `impPainel`. O texto "ASK-400 do Caixa 1" vira "DNP deste posto".
- **`WRITE_OPS`:** `'imp-print':'c'`, `'imp-ok':'c'`, `'imp-falha':'c'` e `'imp-reprint-ok':'c'` (`ACT_MOD` `venda`).
- **CSS:** `#print-root{display:none}` na tela, e o bloco `@media print` da v80 (`@page{size:102mm 152mm;margin:0}`, `.pr-pg`, `.pr-pg.land` girada 90°). Classes novas: `.posto-*` e `.eco-*`.

### G. Fila de eventos
- **Identificadores:**
  - `pvId()`: `<disp.id ou 'L00'>-<Date.now().toString(36)><rand4>`;
  - `pvSaleNo()`: chave `eterna.ponto.seq.v1` `{dia,n}`.
- **`pvEvento(tipo,vendaId,dados)`:** lê, acrescenta e grava `eterna.ponto.fila.v1`, **uma chave fora do SIM** (achado 8), com `{idem:venda+':'+seq, venda, seq, tipo, em, por:{nome}, dados}`. O `seq` por venda fica em `eterna.ponto.seqv.v1`.
- **`pontoFlush()`** (modos `local` e `posto`):
  - roda a cada 5 s enquanto houver fila, no evento `online` e quando o agente volta;
  - envia até 50 eventos em ordem;
  - `ok` ou `ja` sai da fila;
  - `conflito` ou `recusado` vai para `eterna.ponto.conflitos.v1` (com alerta);
  - erro de rede: espera 5, 10, 30 e depois 60 s;
  - nunca descarta;
  - `codigo_novo` atualiza `SIM.galerias[tok].codigo`.
- **Em modo `off`** os eventos também vão para a fila e sobem quando houver agente.

### H. Vendas de todos
- **`pontoVendasPull()`** (em `local` ou posto `todas`, e só para quem tem `financeiro.r` ou `venda.r`): `GET /ponto/vendas?desde=rev` com `If-None-Match`. Guarda `state.ponto={gen,rev,vendas,postos,estoque}`. Um `gen` diferente zera tudo.
- **`allSalesSim()`:** acrescenta as vendas do agente cujo `id` não está em `SIM.caixaDin`. Mapeamento: `no:saleNo`, `pdv:posto.nome`, `seller:vendedor.nome`, `pay` (meio, mais " · maquininha"), `status` (`paga`, `aguardando`, `cancelada` ou `nao_paga`), `posto` e `ref`. É por aqui que Painel (`painelEterna`), Lista e CSV passam a ver todos os postos (o programador confere que `painelEterna` lê `allSalesSim`).
- **`pvEspelhar(v)`** (só em `local`): venda paga de uma sessão local vira `status:'paga'` com `selected`, `saleNo` e `viaPosto`, **sem estoque e sem `galDaVenda`**. Serve para Biblioteca (vendida) e galeria.
- **`salesCSV`:** novas colunas no fim, `posto;pagamento_ref;impressao` (estado e nome, nunca e-mail).
- **`vCaixa`** (local ou `todas`): bloco "Aguardando pagamento nos postos", só leitura para as vendas de outros postos.
- **`alerts()`:**
  - posto sem contato há mais de 2 min (`warn`);
  - pendência com mais de `CAIXA_ALERTA_MIN` em qualquer posto (`warn`);
  - venda paga sem impressão há mais de 10 min (`warn`);
  - `divergente`, `sessao_vendida_duas_vezes`, `semFoto>0` e NSU repetido (`bad`);
  - rolo abaixo de 40 por posto (`warn`);
  - no próprio notebook, conflitos locais (`bad`) e fila parada há mais de 5 min (`warn`).
- **`minhasVendas()`:** vendas de hoje deste notebook com `vendedor.email` igual ao do usuário, com hora, `saleNo`, meio, **valor de cada venda**, estado do pagamento e da impressão. Sem nenhum somatório.

## Outros arquivos
- **`/home/claude/eterna/agente/abrir-posto.bat` e `/home/claude/eterna/agente/abrir-posto.command`** (novos). Leem o IP de `posto.txt` ou do argumento e abrem o Chrome com:
  `--user-data-dir=<perfil-eterna-posto> --kiosk-printing --unsafely-treat-insecure-origin-as-secure=http://IP:8765 http://IP:8765/#posto`.
  No Windows, conferem a impressora padrão (`Get-CimInstance Win32_Printer -Filter "Default=TRUE"`) e avisam se o nome não contém "RX1" nem "DNP" (impressora definida pelo Eduardo em 29/10: DNP DS-RX1HS, uma por notebook; mídia PR 4×6 = 102×152 mm sem margem, cerca de 700 fotos por rolo; na v83 etapa 1 a capacidade do rolo já é 700).
- **`Eterna.command` e `iniciar-eterna.bat`:** comentário sobre `ETERNA_REDE=1`, `ETERNA_HOSTS` e o IP fixo por reserva no DHCP.
- **`/home/claude/eterna/testes/v83-multiterminal.js`** (novo): agente com HOME temporário, `ETERNA_REDE=1`, `ETERNA_SEM_OPENCV=1`, `ETERNA_HOSTS=<1º IP>` e `ETERNA_APP_ORIGIN=http://127.0.0.1:<porta do rodar.sh>`. Contextos: **L** = 127.0.0.1; **N3** e **N5** = postos `proprias`; **G7** = posto `todas` (os três em `http://IP`).
- **`todas-as-telas.js`:** abre `posto` e `postos` sem agente.
- **`loja.js`, `v79-regressao.js` e `galeria-agente.js`:** ajustados para cartão e PIX aguardando.
- **Documentação:** `DOCUMENTACAO-TECNICA.md` (rede, pareamento, `/ponto/*`, eventos, pagamento e impressão), `GUIA-DA-EQUIPE.md` (parear, confirmar na maquininha, imprimir, trocar rolo, nunca limpar os dados do perfil do posto), `CONTEXTO-ETERNA.md` (seções 3, 4 e 5 com D1 a D17), `VERSOES.md` e o carimbo v83.

## Contratos

**Pareamento**
- `POST /ponto/convites` `{escopo:"proprias|todas"}` → `{codigo:"ABCD-2345",expira}`.
- `POST /ponto/parear` `{codigo,num}` → 200 `{ok,disp:{id,num,nome,escopo}}` com `Set-Cookie: eterna_disp=<token>; HttpOnly; SameSite=Strict; Path=/; Max-Age=15552000`.
  Erros: 401 `{error:"codigo_invalido",restam}`, 409 `{error:"numero_em_uso",nome}`, 429 `{motivo:"bloqueado",ate}`.
- `GET /ponto/postos` → `{postos:[{id,num,nome,escopo,criado,visto,ip,revogado}]}` (sem hash).
- `POST /ponto/postos/<id>/revogar` → `{ok}`. Depois disso, o posto recebe 401 `{error:"disp_revogado"}`.

**Feed**
- `POST /ponto/sessoes` `{sessoes:[{card,key,fotografo,pdv,date,time,openedAt,fotos,descartadas,menor,status,edits}]}` → `{ok,rev}`.
- `GET /ponto/sessoes?desde=<rev>` → `{gen,rev,sessoes:[...+vendida]}`, com ETag.
- `GET|POST /ponto/config` → `{venue,precos:{"zona":110,...},lojaFimSeg,atualizado}`.
- `GET|POST /ponto/usuarios` → `{usuarios:{"email":{v,email,name,active,preset,perms,menu,inicio,key}},atualizado}`.

**Eventos:** `POST /ponto/eventos` `{eventos:[...]}`
```json
{"idem":"P03-a1b2c3-lk9x2q7f:1","venda":"P03-a1b2c3-lk9x2q7f","seq":1,"tipo":"criar","em":"ISO","por":{"nome":"Thainá"},
 "dados":{"saleNo":"P3-012","card":"LPAB12CD","meio":"cartao|pix|dinheiro","prov":"pos-manual|dinheiro","total":190,
  "cart":[{"id":"maracana","v":190}],"prints":5,"nPh":5,"nAI":1,"selected":["ag_8b69d689c412"],"aiSel":["ag_x|bg3"],"fav":[],
  "ed":{"ag_8b69d689c412":{"b":104,"c":100,"s":100,"t":5,"z":100,"x":0,"y":0}},"galeria":{"token":"<22 base64url>","codigo":"ABCD-2345"},
  "vendedor":{"nome":"Thainá"},"lang":"pt"}}
```
- `pagar`: `{"ref":"123456"|null,"prov":"pos-manual"}`.
- `cancelar`: `{"motivo":"cancelada_no_posto|novo_pedido|pago_de_outro_jeito"}`.
- `impressao`: `{"resultado":"ok|nao_saiu","fotos":["ag_..."],"n":5,"reimpressao":false,"motivo":null,"semFoto":0}`.
- `rolo`: `{"capacidade":400}`.

**Validação**
- `venda`: `^(P[0-9]{2}|L00)-[0-9a-f]{6}-[a-z0-9]{8,16}$` (ou `L00-...`), com o prefixo do posto;
- `card`: `^[A-Z0-9]{4,16}$`;
- fotos por `pid_ok`;
- `|selected| ≤ 200`;
- `ed` só números entre −200 e 400;
- `cart[].id` existe em `precos`;
- `0 ≤ prints ≤ nPh+nAI`;
- `ref`: `^[0-9]{4,12}$` ou `null`;
- strings de nome com no máximo 60 caracteres e sem `<>`.

**Respostas**
- 200 `{ok:true,rev,resultados:[{idem,s:"ok|ja|conflito|recusado",erro?,codigo_novo?}]}`;
- 401 `nao_pareado` ou `disp_revogado`; 413; 429.

**Lista:** `GET /ponto/vendas?desde=<rev>&limite=500` → `{gen,rev,mais,vendas:[...],postos:[{id,num,nome,escopo,visto}],estoque:{"Posto 3":312}}`, com `ETag: "<gen>.<rev>.<escopo>"` e 304. Venda devolvida:
```json
{"id":"...","saleNo":"P3-012","posto":{"id":"P03-a1b2c3","num":3,"nome":"Posto 3"},"vendedor":{"nome":"Thainá"},"criada":"ISO","recebida":"ISO",
 "card":"LPAB12CD","meio":"cartao","prov":"pos-manual","estado":"aguardando|paga|cancelada|substituida|nao_paga","total":190,"total_agente":190,
 "divergente":false,"prints":5,"nPh":5,"nAI":1,"galeria":{"codigo":"ABCD-2345"},"pag":{"ref":"123456","em":"ISO","porNome":"Thainá"},
 "impressao":{"estado":"nao_se_aplica|pendente|impressa","n":5,"em":"ISO","porNome":"Thainá","semFoto":0},
 "impressoes":[{"em":"ISO","porNome":"Thainá","resultado":"ok","n":5,"reimpressao":false,"motivo":null}],"alerta":null}
```
O loopback recebe também `selected`, `aiSel`, `ed` e `galeria.token`.

**Chaves I18N novas** (pt / en; o programador escreve es, fr e de)

| chave | pt | en |
|---|---|---|
| `ljPosEyebrow` | Falta só pagar | One last step: payment |
| `ljPosCardH` | Pague na maquininha | Pay on the card machine |
| `ljPosCardSub(t)` | Aproxime ou insira o cartão na maquininha do atendente. Valor: ${t}. | Tap or insert your card on the attendant's card machine. Amount: ${t}. |
| `ljPosPixH` | Pague com PIX na maquininha | Pay with PIX on the card machine |
| `ljPosPixSub(t)` | Leia o QR Code da maquininha do atendente com o app do seu banco. Valor: ${t}. | Scan the QR code on the attendant's card machine with your banking app. Amount: ${t}. |
| `ljPosWait` | Assim que o pagamento for aprovado, suas fotos aparecem aqui. | As soon as your payment is approved, your photos appear here. |
| `ljPosCode(c)` | Código do pedido: ${c} | Order code: ${c} |
| `ljPayCancelled` | O pagamento foi cancelado. Você pode mudar a escolha e pagar de novo. | The payment was cancelled. You can change your selection and pay again. |

**Textos que mudam** (5 línguas, sem o tempo):
- `printsReady(n)`: "Suas N fotos impressas saem aqui no balcão." / "Your N prints come out right here at the counter.";
- `incPrintD`: "impressas aqui no balcão" / "printed here at the counter";
- `secure`: "Pagamento seguro na maquininha do atendente." / "Secure payment on the attendant's card machine."

As telas Posto de venda e Postos de venda são da equipe e ficam só em português.

## Critérios de aceite
**A. Rede**
1. Com `ETERNA_REDE=1`, de `http://IP` sem cookie: `/biblioteca`, `/thumb/<id>`, `/file/<id>`, `/events`, `/metricas` e `/roverpix/data` dão 403 ou 401. `/status` e `/` dão 200, sem `Access-Control-Allow-Origin`.
2. De `IP` com `Host: 127.0.0.1:P` forjado e sem `Origin`: `POST /roverpix/config`, `/roverpix/sync`, `/ftp-remoto/config`, `/photoroom/config`, `/photoroom/compose` (com `image_b64`), `/galerias/publicar`, `/ponto/convites` e `/ponto/sessoes` dão 403, e nada muda em `~/Eterna`.
3. De `127.0.0.1`, todas essas rotas continuam funcionando como na v82 (`galeria-agente.js` e `agente-seguranca.js` passam).
4. Com o agente reaberto e `ETERNA_APP_ORIGIN` apontando para uma porta morta, `/index.html` e `vendor/qrcode/qrcode.min.js` saem do cache em disco, e N3 recarrega o app.

**B. Pareamento**
5. Em L, Postos de venda gera um código `proprias`. Em N3, o login mostra "Este notebook não está pareado". Número 3 mais o código levam a "Pareado como Posto 3". `document.cookie` não mostra `eterna_disp`, e `eterna.posto.v1` não tem token.
6. O mesmo código de novo dá "Código inválido". Um código vencido (relógio adiantado no teste) é recusado. 5 erros no mesmo IP: a 6ª tentativa dá 429.
7. Parear outro aparelho como Posto 3 dá 409. Revogado em L, N3 recebe 401 na chamada seguinte e volta a mostrar o cartão de pareamento.
8. Postos de venda aberta em N3 mostra "Abra esta tela no computador do ponto", e `POST /ponto/convites` com o cookie de N3 dá 403.

**C. Feed**
9. Uma sessão fechada em L (fotos `ag_`) aparece em N3 em até 6 s. A busca por código abre a sessão, as miniaturas carregam (`naturalWidth>0`) e N3 não chamou `/events` nenhuma vez.
10. Com o cookie de N3, `/thumb/` de foto fora do feed dá 403, e uma do feed dá 200. `/rostos/buscar` com o cookie dá 200; a 21ª no mesmo minuto dá 429.
11. Preço do `extra` mudado para R$ 45 em L: em até 65 s o carrinho de N3 usa R$ 45, e os campos de preço em N3 estão desabilitados.
12. Um usuário desativado em L é deslogado em N3 em até 65 s. Em N3, `perm-save` dá "Altere no computador do ponto".
13. `/photoroom/compose` com o cookie de N3: `pid` do feed é aceito; `image_b64` ou `pid` de fora dá 403; a 31ª chamada no minuto dá 429.

**D. Pagamento**
14. Sem agente, num navegador só: o cliente escolhe Cartão. A venda fica "aguardando", não há QR nem contagem regressiva, a sessão fica `aguardando`, o estoque não muda e nada vai para `SIM.galFila`. A tela mostra "Pague na maquininha" e o valor.
15. No Posto de venda, "Pago na maquininha" com NSU `123456`: a venda vira paga com `pag.ref` e `payment` "Cartão (maquininha)". Em até 2 s a janela do Checkout mostra a tela do QR com a contagem de `lojaFimSeg`.
16. O NSU `4111111111111111` é recusado com "Isso parece número de cartão". `12` é recusado. Vazio é aceito.
17. PIX mostra `ljPosPixH`. Dinheiro mantém os textos da v79 e também passa à tela do QR na confirmação.
18. O vendedor cancela: o Checkout volta ao carrinho da mesma sessão com `ljPayCancelled`. A pendência fica `cancelada` e não vira venda.
19. Quem só tem `venda.r` não vê os botões. Forçar `pend-pos-ok` cai em "Sem permissão".
20. As chaves `ljPos*` e `ljPayCancelled` aparecem nos 5 idiomas, sem chave crua, e cabem em 390, 768 e 1366 px. Nenhum texto do Checkout diz "2 minutos".

**E. Venda acompanhada**
21. Com o Checkout numa segunda janela, o Posto de venda mostra em até 1 s a foto em tela ("Foto 4 de 22"), as escolhidas, o pacote com Ideal e o total. Digitar no campo de NSU enquanto o cliente navega não perde o texto.
22. Fechando a janela do Checkout, o painel mostra "Checkout fechado ou parado" em até 15 s. Nenhuma requisição ao agente leva os dados do painel.

**F. Impressão**
23. Venda paga com 5 impressas: "Imprimir 5 fotos" cria `#print-root` com 5 `.pr-pg` e `img` em `/file/<hex>`. `page.pdf({preferCSSPageSize:true})` dá 5 páginas de 102×152 mm, e a foto deitada sai girada, preenchendo a página.
24. "Saiu certo" deixa a venda `impressa` e baixa exatamente 5 do rolo do posto. Repetir ou recarregar não baixa de novo. "Não saiu" volta a `pendente` sem baixar. Reimprimir 1 com o motivo "falhou" baixa 1 e aparece no registro e no CSV.
25. Venda com 3 fotos do campo e 1 de IA, num pacote de 4 impressas: imprime 3, mostra "1 impressão sem foto do campo" e grava `semFoto:1`. A foto de IA nunca entra em `#print-root`.
26. O vendedor desmarca uma foto e marca outra: não passa de `prints`, e o PDF tem as fotos escolhidas.

**G. Vendas no agente**
27. N3 vende por PIX e confirma: o agente tem `criar` e `pagar` uma vez cada, a venda `paga`, o `saleNo` `P3-001`, o manifesto da galeria publicado com `comprada` só em `selected`, e a sessão `vendida` no feed. Em N5, a mesma sessão cai em `ljAlreadyPaid` em até 6 s.
28. O mesmo lote reenviado dá `ja` em todos. O mesmo `idem` com total diferente dá `conflito`. Uma venda com o prefixo de N5 enviada por N3 dá `recusado:prefixo`. `pagar` antes de `criar` dá `conflito`.
29. Com o agente parado, N3 vende (sessão já no feed), confirma e marca "Não saiu"; o Posto de venda mostra "3 eventos esperando o agente". O agente volta: em até 15 s os eventos chegam em ordem, uma vez só, e a fila zera.
30. Uma pendência `aguardando` de ontem vira `nao_paga` no boot do agente.
31. Total enviado diferente do recalculado: a venda é aceita com `divergente:true`, e aparece alerta em L.

**H. Vendas de todos**
32. N3 e N5 vendem. Em L e em G7 (posto `todas`, logado como Supervisor), Lista de vendas e Painel mostram as duas vendas uma vez só, com a coluna Posto. O CSV termina em `posto;pagamento_ref;impressao`.
33. Com o cookie de N3, `GET /ponto/vendas` devolve só as vendas de N3, sem `ed`. Logado como Admin em N3, a Lista não mostra a venda de N5.
34. No Posto de venda de N3, logado como Atendimento e venda, "Minhas vendas de hoje" mostra o valor de cada venda e nenhuma soma, ticket ou "Total". Outro vendedor no mesmo notebook não vê as vendas do primeiro.
35. Alertas em L: N5 sem contato há mais de 2 min; pendência com mais de 15 min; venda paga sem impressão há mais de 10 min; rolo do Posto 3 abaixo de 40.
36. O Caixa em L mostra as pendências de N3 e N5, sem botões para agir.

**Regressão**
37. Sem agente (modo `off`), o Checkout e o Caixa no mesmo navegador funcionam com as mudanças de D, e os critérios da v79 ajustados passam.
38. `bash testes/rodar.sh` termina com `FALHAS: 0`. Isso inclui `permissoes.js` (letras novas em `MODULE_INFO`), `todas-as-telas.js` (`posto` e `postos`) e o novo `v83-multiterminal.js`.

## Riscos de segurança e escala (para o revisor)
1. **O usuário não é confiável no agente.** O login é simulado. O agente impõe só o posto (cookie). O `por` e o `vendedor` são declarados. "Pago na maquininha" é uma confirmação humana sem prova: quem tem o cookie e um usuário com `venda.c` libera originais de uma sessão do feed. Mitigações: o agente aceita só fotos da sessão, recalcula o total, audita por posto e alerta NSU repetido. A correção definitiva é o TEF e o login real.
2. **Cookie em http puro.** Quem escuta a rede rouba o cookie. Os notebooks ficam em cabo ou num SSID WPA2 da equipe, nunca no Wi-Fi de visitante. Há revogação imediata e log de `ip_mudou`. Nenhum outro serviço web pode rodar no computador do ponto (o cookie vale para todas as portas). O definitivo é HTTPS local.
3. **Brechas atuais (achado 1).** O revisor testa cada rota de chave com e sem `Origin`, com `Host` forjado, de um IP da rede, e confere que nenhuma resposta para a rede leva `Access-Control-Allow-Origin`.
4. **Escopo de vendas.** O posto `proprias` não pode ler vendas de outros nem com devtools: o filtro é no agente, pelo cookie. Um posto `todas` é poder de gerente; o convite `todas` deve ser raro e fica registrado no log.
5. **Fotos pela rede.** O posto lê o original (`/file/`) das sessões do feed de hoje e ontem, até 600 por minuto. Para depois: um `/impressao/<id>` de 1800 px e uma vitrine de 1600 px para o Checkout.
6. **Corrida entre as duas janelas do notebook.** A fila e as sequências ficam fora do SIM (achado 8). O revisor confere que `saveSim()` de uma janela velha não apaga `caixaDin` recém-gravado (o `lojaFresh`/`simFresh` da v79 precisa cobrir `pendConfirmar` e as ações de impressão).
7. **Limpar os dados do perfil do Chrome** perde a fila e o pareamento. O Guia da equipe proíbe isso, e o alerta "fila parada" ajuda a perceber.
8. **`--kiosk-printing`** imprime sem diálogo na impressora padrão: um `print()` qualquer do perfil sai na DNP. O lançador confere a padrão.
9. **Painel escondido do Checkout (3 toques)** continua listando "Sessões esperando", com fotos de outros clientes. Para depois: PIN da equipe nesse painel.
10. **LGPD.** No agente não há nome, e-mail, rosto ou IP de cliente. NSU só com até 12 dígitos e com recusa do que parece número de cartão. A venda acompanhada não sai do notebook. A selfie não é gravada. O nome do vendedor fica no evento por 90 dias e não sai no CSV como e-mail.
11. **Escala num ponto** (8 notebooks, dia de jogo):
    - feed com 304 a cada 5 a 15 s por janela: cerca de 3 requisições por segundo, de ~200 bytes;
    - cerca de 800 vendas por dia, com 4 a 6 eventos cada, e `fsync` por lote;
    - a impressão lê 5 originais de 10 a 20 MB por venda, no próprio notebook.

    O `ThreadingHTTPServer` aguenta esse volume.
12. **Escala em 100 venues.** Cada venue tem o seu agente, isolado. Os eventos e o `GET /ponto/vendas` foram pensados para virar `/v1/venues/<venue>/eventos` na API da nuvem (parte G do Ronaldo) sem mudar o JSON. O polling pode virar SSE.
13. **Internet caída:** tudo funciona, e o app vem do cache em disco. **Agente caído:** os notebooks terminam vendas de sessões já no feed e enfileiram; a busca por rosto, sessões novas e a impressão esperam o agente voltar. **Computador do ponto sem o Eterna aberto:** não nascem sessões novas (fica para depois a separação de sessões no agente).
14. **IP do ponto mudando:** os notebooks perdem o agente. Reserva no DHCP, `ETERNA_HOSTS`, e a tela Postos de venda mostra o endereço atual.

## O que fica para depois
- TEF: provedor `tef` no `PAG_PROV` e no `PagamentoPonto`, com a confirmação vinda do agente;
- leitura do QR do comprovante (jsQR) e pedido Imply único, com conciliação;
- faixa de identificação como interruptor;
- separação de sessões no agente;
- `/impressao/<id>` em 1800 px e vitrine para o Checkout;
- PIN no painel escondido;
- ações de supervisor em venda de outro posto (cancelar ou estornar);
- HTTPS local;
- login real e usuários no servidor;
- vendas online visíveis em posto `todas`;
- nuvem, galeria no celular, Rekognition, pós-venda e fundos (planos v85, v81, v82 e v84).

## Para guardar na memória do projeto
- v83 (29/10): modelo "notebook por vendedor", sem caixa central. Cada notebook pareia com o agente por convite e cookie HttpOnly, com escopo `proprias` ou `todas`, e manda nas próprias vendas. O agente valida, junta e publica a galeria.
- Pagamento: cartão, PIX e dinheiro ficam aguardando, e o vendedor confirma "Pago na maquininha" (NSU opcional, nunca número de cartão). Interface `pos-manual` agora, com espaço para `tef`.
- Impressão pelo Chrome na DNP do notebook, em dois toques. Sem faixa nesta versão. Fundo de IA não imprime.
- Achados: sessões só nascem no navegador do computador do ponto (o notebook não pode ler `/events`); `saleNo` se repetia entre aparelhos; a prévia de fundo de IA usa `/photoroom/compose`; as brechas de `ETERNA_REDE` ainda estavam abertas na v82.