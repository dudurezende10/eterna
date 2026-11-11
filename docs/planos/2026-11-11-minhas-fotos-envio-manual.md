# Plano: Minhas fotos, envio manual do cartão (plano B)

Branch `feat/minhas-fotos-manual`, a partir da `feat/ondas-ux` (a9b4028). Item 3 da análise de telas: plano B para quando o cartão não for lido. Continua a parte D do plano `docs/planos/2026-11-09-ondas-ux.md` (commit b35a434). Versão de trabalho segue **v96-ux** (só o carimbo de hora muda); a v97 já está tomada pela `feat/agenda-estatisticas`.

## Objetivo

Quando o leitor não reconhecer o cartão, o fotógrafo (ou o Admin) manda as fotos pela própria tela Minhas fotos, arrastando ou escolhendo os arquivos.
As fotos entram no agente pelo mesmo `ingest_file` do cartão: mesma leva, sessão, visitas, rostos, recorte e regra de repetida. Nenhum caminho paralelo.

## O que já existe (achado no código)

- **Não há rota de importação nesta branch.** `ETERNA_PASTA` (`pasta_vigiada`) vigia uma pasta de um FTP de terceiros no disco do servidor; não serve para o navegador.
- **Também não há `ROTAS` nesta branch.** A tabela `ROTAS` (deny-by-default, `rota_regra`, `autoriza`) e o login no servidor (`auth_quem`, `auth_pode`) estão só na `fix/seguranca-dados` (Ronaldo), fora da `main` e da `feat/ondas-ux`. Aqui as rotas POST da equipe usam o trio `posto()` + `origem_local()` + `X-Eterna: 1` (ex.: `_entradas_post`, `ff_funcao_post`) e a permissão C/R/U/D vive só no navegador.
- **O Ronaldo já fez a rota na `fix/seguranca-dados`** (commit b06b67b, 04/11): `POST /fotos/enviar?nome=&quem=`, corpo = o JPEG, até `FOTO_ENVIO_MAX` 60 MB, `jpeg_completo`, `ingest_file(..., "ftp", move=True)`, resposta `{ok, resultado: new|dup|recusada}`, e no app `fotosEnviar(lista)` com 2 envios em paralelo e o botão "Enviar fotos". Na `ROTAS` dele: `("POST", "/fotos/enviar", "sessao", ("set.c",))`.

Conclusão: **reusar o contrato do Ronaldo** (mesmo caminho, mesmos parâmetros, mesmo nome de função `fotos_enviar_post`/`fotosEnviar`), com as guardas desta branch e as checagens a mais deste plano. Quando a `fix/seguranca-dados` entrar, a linha da `ROTAS` e a sessão do servidor já cobrem a rota; a junção mantém as checagens dos dois lados.

## Escopo desta entrega

1. Link discreto "Enviar fotos do cartão manualmente" em Minhas fotos, só para quem tem `set.c`. Abre um painel com área de soltar e botão "Escolher fotos".
2. `POST /fotos/enviar` no agente, uma foto por pedido, entrando por `ingest_file` como foto de cartão.
3. Progresso na faixa (`upFaixa`): "Enviando 4 de 6", com contagem de erro por motivo e lista curta das fotos recusadas no painel.
4. Sem agente (ou app fora do endereço do agente): o painel mostra o aviso vermelho já existente e não aceita fotos.
5. Testes: Playwright (agente falso e agente de verdade) e Python do agente com HOME temporário.

## Fora do escopo

- Login no servidor e `ROTAS` (vêm com a `fix/seguranca-dados`).
- Retomar envio depois de recarregar a página (a lista de arquivos vive só na memória da aba).
- Pastas inteiras (arrastar diretório), RAW (CR3), PNG, HEIC.
- Envio pelo celular do fotógrafo (5G/Wi-Fi) fora da rede do ponto.
- Mudar "Testar com fotos suas" (continua só no modo demonstração, como na parte D).
- I18N: tela interna, só português.

## Decisões assumidas (o Eduardo pode mudar)

1. **Letra da permissão: `set.c`, não `set.u`.** No `MODULE_INFO.set`, `c` = "receber fotos (leva e arquivos)" e `u` = "parar o recebimento, ligar e desligar o ajuste". A `ROTAS` do Ronaldo também usa `set.c`. Perfis com `set.c` hoje: Fotógrafo e Admin (Supervisor tem `set` só leitura e não vê o link).
2. **Entra como foto de cartão (`src_kind = "cartao"`), não como FTP.** Com `cartao` a sessão vai para a trilha atrasada (`sess_trilha`) no dia da chegada e a foto não mexe no desvio de relógio (`sess_clique`); é o que acontece se o mesmo cartão for lido pelo leitor. O Ronaldo usou `"ftp"`; na junção vale `"cartao"`.
3. **Dono da foto:** Fotógrafo logado = `fotoKey()`, sem escolha. Admin sem chave de fotógrafo escolhe no seletor "Fotógrafo" que já existe; com "Todos" o painel pede "Escolha o fotógrafo acima" e não aceita fotos. O agente só aceita `quem` que esteja em `ff_cadastrados()`; fora disso, 400 `quem`. Na junção com a `fix/seguranca-dados`, a chave do cadastro da sessão vence o `quem` (regra do Ronaldo).
4. **Só com o app aberto pelo endereço do agente** (`fotosNoServidor()` = `state.agent.on && state.agent.url === location.origin`, mesmo nome do Ronaldo). Aberto pelo eterna.photo, o painel mostra o aviso da parte D ("O computador do ponto não está respondendo. Chame a TI." para não Admin; a dica do endereço para Admin) e não aceita fotos. Vale para o computador do servidor e para os postos de `ETERNA_ORIGENS`.
5. **Extensões iguais às do cartão (`EXT`):** `.jpg`, `.jpeg`, `.JPG`, `.JPEG`, com diferença de maiúscula (`.Jpg` não passa, como no `scan_card`). No navegador a mesma regra: `/\.(jpg|jpeg|JPG|JPEG)$/`. Arquivo fora disso nem é enviado e conta como "não era foto".
6. **JPEG de verdade:** começa com `FF D8 FF` e tem `FF D9` nos últimos 4 KB. PNG com nome .jpg é recusado aqui (no cartão de câmera nunca existe); o `jpeg_completo` geral não muda.
7. **Limites:** 60 MB por foto (`FOTO_ENVIO_MAX`, igual ao Ronaldo); até 2.000 arquivos por envio (cliente; um cartão de dia cheio tem 300 a 800); no servidor 300 fotos por minuto por IP (`limite_ok`), no máximo 4 gravações ao mesmo tempo no agente inteiro (`FOTO_ENVIO_SIMULT`, 503 para o cliente tentar de novo) e recusa com 507 se o disco do `INBOX` tiver menos de 2 GB livres (`FOTO_ENVIO_PISO_GB`).
8. **Nome do arquivo:** o arquivo temporário tem nome do servidor (`envio-<token_hex(8)>.tmp` em `FTPTMP`). O nome do cliente só vira rótulo se casar com `^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|JPG|JPEG)$`; senão o agente usa `envio_<hhmmss>_<4 hex>.jpg`. O destino continua `INBOX/<dia>/<pid>_<rótulo>` (padrão do `ingest_file`).
9. **Repetida:** a regra de sempre (`seen` por `quick_hash`). Conta como "já estava no servidor", não é erro. Foto apagada por LGPD (`lgpd_excluidas`) volta como `recusada` sem dizer o motivo.
10. **2 envios em paralelo** por aba (igual ao Ronaldo), em ordem de nome.
11. **Rede caída no meio:** cada foto tenta 3 vezes (1 s, 3 s, 9 s) em erro de rede, 429 e 503. Depois disso a fila para, as que faltaram ficam guardadas na aba e o painel mostra "Tentar de novo as N que faltaram".
12. **Sair da tela não para o envio** (o estado está em `state.imp.envio`, não no DOM). Recarregar ou fechar a aba durante o envio pede confirmação (`beforeunload`).

## Mudanças por arquivo

### agente/eterna-agente.py

- Constantes perto de `EXT`: `FOTO_ENVIO_MAX = 60 * 1024 * 1024`, `FOTO_ENVIO_TAXA = 300` (por minuto por IP), `FOTO_ENVIO_SIMULT = 4` (`threading.BoundedSemaphore`), `FOTO_ENVIO_PISO_GB = 2`, `_re_envio_nome = re.compile(r"^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|JPG|JPEG)$")`.
- `jpeg_de_verdade(path, size)` (nova): `True` só se os 3 primeiros bytes são `FF D8 FF` e `jpeg_completo(path, size)`.
- `envio_nome(nome)` (nova): devolve o rótulo seguro (decisão 8). Nunca usa `os.path` sobre o nome do cliente.
- `H.fotos_enviar_post()` (nova; mesma assinatura e contrato do b06b67b), na ordem:
  1. `posto()`, `origem_local()` e `X-Eterna == "1"`; senão 403 `origem`.
  2. `Content-Type` precisa ser `image/jpeg`; senão 415 `formato`.
  3. `Content-Length` só dígitos, `0 < n <= FOTO_ENVIO_MAX`; senão 413 `tamanho` (ou 411 sem tamanho).
  4. `quem` em `ff_cadastrados()` (comparado sem acento, em minúsculas); senão 400 `quem`.
  5. `nome` termina em `EXT`; senão 415 `formato`.
  6. `limite_ok(ip, "fotos_enviar", FOTO_ENVIO_TAXA)`; senão 429.
  7. `shutil.disk_usage(INBOX).free` abaixo do piso: 507 `disco`.
  8. Semáforo sem esperar (`acquire(blocking=False)`); ocupado: 503 `ocupado`.
  Em qualquer recusa antes de ler o corpo: `self.close_connection = True` (o corpo não foi lido). Depois: grava o corpo em blocos de 1 MB no temporário, confere que chegaram `n` bytes e `jpeg_de_verdade`; falhou: 400 `incompleta` ou 415 `nao_jpeg`. Então `ingest_file(tmp, envio_nome(nome), os.stat(tmp), quem, "cartao", move=True)`; com `new`, `save_index()`. O `finally` apaga o temporário e solta o semáforo. Resposta 200 `{ok, resultado}`.
  Log de console de uma linha por foto, sem nome de arquivo nem IP: `envio pela tela: <quem> <resultado> <MB>`; as recusas contam em `state["envio"] = {"novas","repetidas","recusadas"}`.
- `do_POST`: `if u.path == "/fotos/enviar": return self.fotos_enviar_post()` antes do tratamento das rotas antigas.
- `rota_privada(path)`: incluir `"/fotos/enviar"` (sem CORS `*`; só as origens do agente e de `ETERNA_ORIGENS`). No `do_OPTIONS`, o `Access-Control-Allow-Headers` desta rota inclui `X-Eterna` (como `/ponto/entradas`).
- `/status`: `"envio": {"v": 1, "max_mb": 60, **state["envio"]}`. O app só mostra o link quando `st.envio` existe (agente antigo não tem a rota).
- Nenhuma mudança em `ingest_file`, sessões, rostos, recorte ou nuvem: é isso que garante o mesmo fluxo.

### index.html

- Estado: `state.imp.manual` (painel aberto, bool), `state.imp.envio` = `{total, feitas, novas, rep, erros:{nao_foto, grande, cortada, recusada, rede}, falhas:[{nome, motivo}], faltam:[File], parar:false, quem}` durante e `state.imp.envioFim` = o mesmo objeto + `em` depois (some da faixa 20 s depois ou ao abrir novo envio).
- `fotosNoServidor()` (nova, nome do Ronaldo).
- `envioPode()` (nova): `{ok, motivo}` com motivo `perm` (sem `can('set','c')`), `agente` (sem agente), `origem` (agente fora desta origem), `antigo` (sem `state.agent.envio`), `quem` (Admin com "Todos").
- `envioQuem()`: `fotoKey()` ou `state.imp.key` (nunca `todos`).
- `fotosEnviar(lista)` (nova): filtra pela regex da decisão 5 (o resto entra em `erros.nao_foto`, com nome na lista de falhas), corta em 2.000 (aviso "Mande no máximo 2.000 fotos por vez"), ordena por nome, 2 trabalhadores; cada foto `fetch(state.agent.url + '/fotos/enviar?nome=' + encodeURIComponent(f.name) + '&quem=' + encodeURIComponent(quem), {method:'POST', credentials:'same-origin', headers:{'Content-Type':'image/jpeg','X-Eterna':'1'}, body:f})`; mapa de resposta: `new` → novas, `dup` → rep, 413 → grande, 415 → nao_foto, 400 `incompleta` → cortada, `recusada`/400 `quem` → recusada, 401/403/507 → para tudo com a frase da tabela abaixo, rede/429/503 → tentativas da decisão 11. `render()` depois de cada foto (só se `state.view==='importar'`, o resto atualiza ao voltar). No fim: `auditLog('fotos_envio_manual', quem, [{campo:'fotos', de:0, para:novas}], {repetidas, recusadas, total})` sem nomes de arquivo, e `log()` de uma linha.
- `envioPainel()` (nova), desenhada em `vImportarCore()` logo abaixo de `upFaixa(L)`:
  - Fechado: só o link `<button class="btn ghost envio-link" data-act="envio-abrir">Enviar fotos do cartão manualmente</button>` (classe nova `.envio-link`: sem borda, sublinhado, 14 px, alvo de 44 px) com uma linha `.note` "Use só se o cartão não foi lido." Só aparece com `can('set','c')`.
  - Aberto e `envioPode().ok`: `<div class="envio-drop" data-act="envio-drop" tabindex="0">Solte aqui as fotos do cartão</div>`, `<label class="btn primary">Escolher fotos<input type="file" multiple accept=".jpg,.jpeg,.JPG,.JPEG,image/jpeg" data-act="envio-files" hidden></label>`, `Fechar` (`envio-fechar`). Durante o envio a área fica desativada e aparece `Parar` (`envio-parar`). Depois do envio: lista das recusadas (até 20 nomes com `esc()`, "e mais N") e, se houver `faltam`, `Tentar de novo as N que faltaram` (`envio-repetir`).
  - Aberto e sem agente: `faixaConexao({estado:'off', ultimo:state.agent.lastOk, extra:'Chame a TI.'})`, sem área de soltar. Com `origem`: o aviso da parte D. Com `antigo`: "O computador do ponto precisa ser atualizado para receber fotos por aqui. Chame a TI." Com `quem`: "Escolha o fotógrafo acima."
- `upFaixa(L)`: primeiro ramo novo. Com `state.imp.envio`: `.up-faixa.warn` com `Enviando {feitas} de {total}`, a barra e uma linha `envioResumo(e)` ("1 já estava no servidor · 2 não eram foto"). Com `envioFim` recente: `.up-faixa.ok` "Enviadas {novas} de {total}" e a mesma linha de resumo; se houve parada por erro, `.up-faixa` vermelha com a frase do erro. Depois volta às faixas da parte D (as sessões passam a mostrar "Recebendo X de Y" enquanto os rostos são lidos).
- `envioResumo(e)` (nova): junta só os contadores maiores que zero, com singular e plural: "já estava no servidor / já estavam no servidor", "não era foto / não eram foto", "acima de 60 MB", "chegou cortada / chegaram cortadas", "não entrou / não entraram", "não enviada / não enviadas". Separador " · ". Sem travessão.
- Cliques (`switch(a)`): `envio-abrir`, `envio-fechar` (fecha só sem envio em curso), `envio-parar` (`e.parar=true`: termina a foto em curso e para), `envio-repetir` (`fotosEnviar(e.faltam)`). `envio-drop` com teclado (Enter/Espaço) abre o seletor de arquivos.
- `change`: `envio-files` → `const l=[...e.target.files]; e.target.value=''; if(guardAct('envio-files')) fotosEnviar(l)`.
- Arrastar: três ouvintes globais novos (`dragover`, `dragleave`, `drop`) no `document`. Em `.envio-drop` habilitada: `preventDefault`, classe `.on` no hover, `drop` chama `fotosEnviar([...e.dataTransfer.files])`. Fora dela, durante a tela `importar`: `preventDefault` em `dragover` e `drop` para o navegador nunca abrir a foto no lugar do app.
- `WRITE_OPS`: `'envio-files':'c'`, `'envio-repetir':'c'`; `ACT_MOD`: os dois em `set`. `envio-abrir` não grava.
- `beforeunload`: com `state.imp.envio` ativo, pede confirmação.
- CSS (perto de `.up-faixa`): `.envio-drop` (borda tracejada 2px `var(--line)`, altura mínima 140 px, texto 18 px centrado, alvo de toque grande), `.envio-drop.on` (borda `var(--accent)`), `.envio-drop[aria-disabled=true]` (opaca), `.envio-falhas` (lista pequena), `.up-faixa .envio-sub` (14 px).
- Carimbo: `title="Eterna v96-ux · 11/11 hh:mm"`.

### Textos (português, sem travessão; tela interna, sem I18N)

| Onde | Texto |
| --- | --- |
| Link | Enviar fotos do cartão manualmente |
| Nota do link | Use só se o cartão não foi lido. |
| Área | Solte aqui as fotos do cartão |
| Botão | Escolher fotos |
| Faixa | Enviando 4 de 6 · Enviadas 6 de 6 |
| 401/403 | Sem permissão para enviar fotos neste computador. Chame a TI. |
| 507 | O computador do ponto está sem espaço. Chame a TI. |
| Rede | Sem conexão com o computador do ponto. 3 fotos não foram enviadas. |
| Agente antigo | O computador do ponto precisa ser atualizado para receber fotos por aqui. Chame a TI. |
| Admin com Todos | Escolha o fotógrafo acima. |

Nenhum texto do Fotógrafo pode casar com a regex D2 da parte D (`127.0.0.1`, `8765`, `porta`, `python`, `Terminal`, `~/Eterna`, `.py`, `FTP`).

### Documentação

- `docs/CONTEXTO-ETERNA.md` seção 4: `POST /fotos/enviar` (guardas, limites, entra como cartão) e `/status.envio`. Seção 3: `fotosEnviar`, `envioPainel`, `state.imp.envio`.
- `docs/GUIA-DA-EQUIPE.md`: passo a passo "O cartão não foi lido".
- `docs/FLUXOS.md`: linha "Enviar fotos pela tela" igual à do Ronaldo, com `cartao` e as checagens novas.
- `VERSOES.md`: complemento da linha v96-ux.

### Testes

- `testes/envio_manual_agente.py` (novo, no laço do `rodar.sh`, HOME temporário, `ETERNA_SEM_OPENCV=1`, agente de verdade em outro processo, imagens lisas geradas com Pillow e EXIF de captura): critérios 9 a 20.
- `testes/envio-manual.js` (novo, Playwright): parte A com agente falso por `page.route` (estados da tela, faixa, erros por motivo, sem agente, agente antigo, Admin com Todos, Supervisor sem link); parte B com o agente de verdade servindo o app (padrão do `cliques-ia-e2e.js` com `_cliques_ia_lanca.py`): envio de 6 fotos e a sessão aparecendo em Minhas fotos.
- `testes/ondas-ux-d.js`: D1 e D2 continuam passando com o link novo.

## Contratos

`POST /fotos/enviar?nome=<nome do arquivo>&quem=<chave do fotógrafo>`
Cabeçalhos: `Content-Type: image/jpeg`, `X-Eterna: 1`, `Content-Length`. Corpo: os bytes do JPEG.

| Status | Corpo | Quando |
| --- | --- | --- |
| 200 | `{"ok":true,"resultado":"new"}` | foto nova |
| 200 | `{"ok":true,"resultado":"dup"}` | já estava (mesmo `quick_hash`) |
| 200 | `{"ok":false,"resultado":"recusada"}` | `ingest_file` devolveu `None` (LGPD ou falha de cópia) |
| 400 | `{"erro":"quem"}` / `{"erro":"incompleta"}` | fotógrafo fora do cadastro / bytes a menos ou sem `FF D9` |
| 403 | `{"erro":"origem"}` | fora de `posto()`, `origem_local()` ou sem `X-Eterna` |
| 411 / 413 | `{"erro":"tamanho"}` | sem tamanho / acima de 60 MB ou zero |
| 415 | `{"erro":"formato"}` / `{"erro":"nao_jpeg"}` | extensão ou Content-Type / conteúdo não é JPEG |
| 429 | `{"erro":"taxa"}` | mais de 300 por minuto do IP |
| 503 | `{"erro":"ocupado"}` | 4 gravações em curso |
| 507 | `{"erro":"disco"}` | menos de 2 GB livres |

`GET /status` ganha `"envio": {"v":1, "max_mb":60, "novas":0, "repetidas":0, "recusadas":0}`.

`auditLog('fotos_envio_manual', <chave do fotógrafo>, [{campo:'fotos', de:0, para:<novas>}], {repetidas, recusadas, total})`.

## Critérios de aceite

Tela (Playwright)
1. Carlos (Fotógrafo) com agente: em Minhas fotos aparece o link "Enviar fotos do cartão manualmente"; clicar mostra a área "Solte aqui as fotos do cartão" e o botão "Escolher fotos".
2. Supervisora e um usuário sem `set.c` não veem o link. Admin vê.
3. Sem agente: clicar no link mostra `.conn-off` com "Sem conexão com o computador do ponto" e "Chame a TI", sem área de soltar e sem `input[type=file]` habilitado.
4. Com o agente fora da origem da página (app por outro endereço): o painel não aceita fotos e o texto do Carlos não casa com a regex D2.
5. Agente falso sem `envio` no `/status`: "precisa ser atualizado"; nenhum POST sai.
6. Escolher 6 arquivos (4 JPEG válidos, 1 `.png`, 1 `.txt` renomeado para `.jpg` que o agente falso responde 415): durante o envio a faixa mostra "Enviando N de 6"; no fim "Enviadas 4 de 6" e "2 não eram foto"; os 2 nomes aparecem na lista de recusadas; só 5 POSTs saíram (o `.png` não é enviado).
7. Arquivo `foto.Jpg` não é enviado e conta como "não era foto"; `A.JPG`, `b.jpeg`, `C.JPEG`, `d.jpg` são enviados.
8. Soltar 2 JPEG na área (evento `drop` sintético com `DataTransfer`) envia 2; soltar fora da área não navega para fora do app (`location.href` igual).
9. Resposta `dup` conta como "1 já estava no servidor" e não como erro.
10. Resposta 403 para tudo na primeira foto: a faixa fica vermelha com "Sem permissão para enviar fotos neste computador. Chame a TI." e nenhum POST a mais sai.
11. Rede caindo (agente falso aborta) em 2 de 6: cada uma é tentada 3 vezes; no fim aparece "Tentar de novo as 2 que faltaram" e clicar manda só essas 2.
12. "Parar" durante o envio: no máximo 2 POSTs (os em curso) saem depois do clique.
13. Admin com o seletor em "Todos": "Escolha o fotógrafo acima" e nenhuma foto aceita; escolhendo Samuel, os POSTs saem com `quem=samuel`. Carlos sempre manda `quem=carlos`, mesmo trocando o seletor.
14. Depois do envio existe um registro `fotos_envio_manual` no `auditLog` sem nome de arquivo.
15. D1 e D2 do `ondas-ux-d.js` continuam passando; `todas-as-telas.js` abre Minhas fotos sem erro em 390, 768 e 1366 px, sem rolagem lateral com o painel aberto.

Agente (Python, HOME temporário, agente de verdade)
16. 6 JPEG com EXIF de captura de 2 h atrás, `quem=carlos`: as 6 entram em `~/Eterna/inbox/<hoje>/`, com `meta.s == "cartao"`, `meta.o == "carlos"`, e formam sessão na trilha atrasada `hoje|carlos|t` que aparece em `/sessoes` e em `/fila-fotografo`, igual ao mesmo lote lido por `scan_card`.
17. Mandar a mesma foto de novo responde `dup`; mandar pelo POST uma foto já lida pelo cartão também responde `dup`. `/status.dups` sobe.
18. Corpo PNG com `nome=x.jpg` → 415 `nao_jpeg`; texto qualquer → 415 `nao_jpeg`; JPEG cortado (sem `FF D9`) → 400 `incompleta`; nada fica em `inbox` nem em `ftp-tmp`.
19. `nome=../../etc/passwd.jpg`, `nome=..\\x.JPG`, `nome=%00a.jpg` e nome com 300 letras: o arquivo final fica dentro de `inbox/<dia>/` com rótulo `envio_<hhmmss>_<hex>.jpg` (ou o rótulo limpo), nunca fora.
20. `Content-Length` acima de 60 MB → 413 sem ler o corpo e com a conexão fechada; sem `Content-Length` → 411.
21. Sem `X-Eterna`, com `Origin: https://exemplo.com`, ou com `Host: evil.com:<porta>` → 403; nada gravado.
22. `quem=fulano` (fora do cadastro) e `quem` de login "compartilhado" → 400 `quem`.
23. 301ª foto no mesmo minuto do mesmo IP → 429.
24. Com o piso de disco forçado (constante trocada no módulo de teste) → 507.
25. Foto apagada por LGPD mandada de novo → `recusada`, sem entrar.
26. A resposta de `/fotos/enviar` não tem `Access-Control-Allow-Origin: *`.
27. O console do agente não mostra nome de arquivo, IP nem caminho em nenhuma linha do envio.
28. `bash testes/rodar.sh` termina com `FALHAS: 0`.

## Riscos de segurança e escala (para o revisor)

1. **Sem login no servidor nesta branch.** Quem abrir o Eterna pelo endereço do agente (este computador ou um posto de `ETERNA_ORIGENS`) consegue mandar fotos em nome de qualquer fotógrafo cadastrado: o `quem` e a permissão `set.c` são conferidos só no navegador. É o mesmo nível de `/ponto/entradas` e `/fila-fotografo/funcao` hoje. Fecha com a `fix/seguranca-dados` (`ROTAS` com `set.c` e o dono = chave do cadastro). Precisa de aceite do Eduardo para ir ao Mac antes disso.
2. **Foto atribuída ao fotógrafo errado** mexe em produção do fotógrafo nas Estatísticas e na sessão. Mitigação: Fotógrafo não escolhe; Admin escolhe explicitamente; `auditLog` registra quem mandou e para quem.
3. **Disco cheio** por envio grande ou malicioso: 60 MB por foto, 300 por minuto por IP, piso de 2 GB livres, temporário apagado no `finally`.
4. **Esgotar threads do agente:** `ThreadingHTTPServer` abre uma thread por pedido; o semáforo limita a 4 gravações e o resto recebe 503 na hora, sem ler o corpo. Conexão lenta cai no `timeout` de 20 s já existente.
5. **Conteúdo hostil:** checagem de `FF D8 FF` e `FF D9` não prova que a imagem decodifica. A miniatura (`make_thumb`) e os rostos já tratam falha; imagem acima de 40 MP é recusada pelo OpenCV (`OPENCV_IO_MAX_IMAGE_PIXELS`). O revisor confere que `make_thumb` com Pillow não estoura memória num JPEG com dimensões enormes declaradas (Pillow `MAX_IMAGE_PIXELS`).
6. **Caminho vindo do cliente:** o nome nunca passa por `os.path`; só a regex de rótulo. Revisor confere que nenhum outro ponto usa `nome` cru (log, metricas, events). `events.name` e `metricas.nome` recebem o rótulo, não o nome original.
7. **EXIF forjado** pode empurrar a foto para outra sessão: `sess_clique` já limita a ±48 h da chegada; com `cartao` a foto vai para a trilha atrasada do dia da chegada.
8. **CSRF:** a rota exige `X-Eterna: 1` (força preflight de outra origem) e `origem_local()`; entra em `rota_privada` para não receber CORS `*`.
9. **Escala (1 venue e 100):** um pedido por foto, 2 por aba, 4 por agente: um cartão de 600 fotos de 25 MB leva poucos minutos na rede local e não disputa com o leitor do cartão nem com o FTP (os dois não passam pelo semáforo). Com muitos venues nada muda: a rota é do agente de cada ponto. A leitura de rostos e o recorte seguem a fila com prioridade que já existe (`rostos_enfileira` 0, `rec_fila`), então um envio grande atrasa as sessões ao vivo do mesmo ponto; hoje o `ingest_file` põe tudo com prioridade 0, inclusive o cartão, e este plano não muda isso (dúvida 4).
10. **Internet caída:** o envio é só na rede do ponto (offline-first). Se o computador do ponto cair, a aba guarda as que faltaram até ser fechada; recarregar perde a lista (aviso do `beforeunload`).
11. **Junção com a `fix/seguranca-dados`:** a função existe nos dois lados com o mesmo nome. Na junção ficam: a `ROTAS`/sessão do Ronaldo, o `quem` da sessão, e daqui `cartao`, `jpeg_de_verdade`, rótulo seguro, taxa, semáforo, piso de disco e `/status.envio`.

## Dúvidas que só o Eduardo resolve

1. Ir para o Mac antes do login no servidor (risco 1), ou esperar a `fix/seguranca-dados`?
2. `set.c` em vez de `set.u` (decisão 1).
3. Supervisora deve poder mandar fotos de um fotógrafo (hoje ela tem `set` só leitura)?
4. Prioridade das fotos do cartão (lido ou enviado pela tela) na fila de rostos: hoje entram na frente, junto com as ao vivo. Passar para trás das ao vivo fica para outra entrega?

## Decisões (Eduardo, 11/11)

1. **Pode ir ao Mac antes do login no servidor.** A rota segue o mesmo nível de proteção de `/ponto/entradas` (posto, origem local e `X-Eterna: 1`). Fica fechada quando entrar a `fix/seguranca-dados`, que tem o login no servidor do Ronaldo (`ROTAS` com `set.c` e o dono = chave do cadastro).
2. **A permissão é `set.c`**, igual à da `ROTAS` do Ronaldo.
3. **A Supervisora também envia fotos** (muda a resposta anterior, "a Supervisora não manda fotos por enquanto"). Ela envia como o Admin: escolhe o fotógrafo no seletor; com "Todos", nenhuma foto é aceita. O perfil pronto Supervisor ganhou `set.c` (`set` passa de só leitura para receber e ver; `u` continua fora, ela não liga nem desliga o ajuste automático). Supervisora já salva ganha a letra uma vez por `migraEnvio96` (marca `menv96`, registro `migracao_v96_envio`); usuário personalizado não muda. O Caixa e o vendedor (Atendimento e venda) continuam sem `set` e não veem o link.
4. **A prioridade da fila de rostos não muda nesta entrega.** Fica como pendência: hoje as fotos do cartão (lidas pelo leitor ou enviadas pela tela) entram com prioridade 0, junto com as ao vivo; passar para trás das ao vivo fica para outra entrega.

## Notas da implementação (programador, 11/11)

- **Seletor de arquivos fora do `#main`** (`envioInput()`, um único `input type=file` no `body`, aberto pelo botão "Escolher fotos" e pela área de soltar). O plano previa o `input` dentro de um `label` no painel; com o agente de verdade o `render()` troca o `#main` a cada sessão nova, e um `input` trocado enquanto o seletor do sistema está aberto perde a escolha (o `change` cai num elemento solto). Ação nova `envio-escolher` no `WRITE_OPS` (c) e no `ACT_MOD` (set).
- **Tentativas:** 3 tentativas por foto (na hora, depois de 1 s e depois de 3 s). O 9 s da decisão 11 ficou de fora: com "tenta 3 vezes" só cabem duas esperas.
- **Rede caída:** a primeira foto que esgota as tentativas para a fila; a foto em curso no outro trabalhador termina; as que faltaram (as que falharam e as que não saíram) ficam em `faltam`. "Parar", 401, 403 e 507 também guardam as que faltaram, e o botão "Tentar de novo" aparece.
- **Console do agente:** o `ingest_file` ganhou o parâmetro `quieto` (padrão `False`), que só tira o nome do arquivo da linha `+ <nome>` e de "erro ao copiar" no envio pela tela (critério 27). O fluxo do `ingest_file` não muda.
- **Contador `recusadas` do `/status.envio`:** conta toda recusa da rota (inclusive 403, 429 e 503) e as `recusada` do `ingest_file`.
- **Admin fora da origem:** a dica é "Para enviar fotos por aqui, abra o Eterna pelo endereço do computador do ponto" com o endereço do agente.
- **Sessões em Minhas fotos:** a lista continua filtrada pelo ponto do seletor. Uma sessão atrasada sem função do dia (sem ponto) não aparece com o seletor num ponto; no teste de ponta a ponta a função do dia do Carlos é mandada antes, como a Escala faz.
