# Plano: Fila do fotógrafo (grupo Fotógrafo)

Base: `main` em `e98fc3b`. Pedido do Eduardo em 30/10 às 10:37, com o adendo das 10:39 (miniaturas chegando, com fotógrafo e local).

## Objetivo
Um painel de senhas, igual à Fila de impressão, que mostra cada grupo de fotos em 3 etapas: Fotografando, Subindo e Pronta no caixa. Ele mostra quem fotografa, onde e quantas fotos são, e precisa funcionar na TV do caixa aberta pela rede.

## Achado central (muda o desenho)
1. **A sessão LP ainda nasce no navegador.** A v85 parte A (sessões no agente) não foi implementada no main. Hoje o caminho é `agentPoll` → `ingPush` → `ingClose` (index.html ~2855-2870), com pausa de 20 s (`SESSAO_PAUSA_S`, commit 7e1a04f). Cada navegador aberto monta as próprias sessões com códigos LP diferentes; o Ronaldo viu isso em 29/10, com 9 fotos virando LPQ8QQRW6 e LPT8280WF. Além disso, `ingClose` junta **todas** as chegadas numa sessão só, sem separar por fotógrafo.
2. **A única verdade objetiva e comum a todos os postos é a chegada da foto no agente.** O `meta[pid]` guarda `u` (hora de chegada, relógio do agente), `o` (login do FTP, subpasta, volume do cartão ou `ftp-estadio`), `s` (`ftp`/`cartao`) e o EXIF: `cap` (hora do clique), `serie`, `autor` e `dono` (`ingest_file`, agente ~1117).
3. **Consequência:** a fila precisa ser calculada **no agente**, por fotógrafo, e o painel não pode mostrar o código LP nesta entrega, porque o código da TV seria diferente do código do caixa. O código LP entra quando a v85 A estiver no main.

## Escopo desta entrega
- Agente: agrupamento de chegadas por fotógrafo, em memória e refeito a partir do `meta` no boot, com `GET /fila-fotografo` (só leitura) e `POST /fila-fotografo/funcao` (função do dia vinda da Escala).
- App: view `fotofila` no grupo Fotógrafo, com 3 colunas, miniaturas chegando nas duas primeiras, fotógrafo com "(volante)" ou "(campo · ponto)" e tela cheia para TV.
- Um módulo novo de permissão: Ver para todos os perfis da D6; Alterar (só o interruptor das miniaturas) para Admin e Supervisor (segurança B1).
- A Escala envia a função do dia ao agente.

## Fora do escopo
- O código LP na tela e o sinal de sessão "vendida". Os dois dependem da v85 A e das vendas no agente (v83 G).
- O botão "comecei/terminei" do fotógrafo (veja D3).
- O cadastro fixo de câmera por número de série no agente (veja a lacuna L2).
- Corrigir o `ingClose`, que mistura fotógrafos. Isso é parte da v85 A.
- I18N. A tela é da equipe; `vImpFila` também não usa `T()`.

## Sinal objetivo de cada etapa (por grupo)
**Grupo** = fotos do mesmo fotógrafo (chave D2 da v85) em que cada chegada `u` fica a no máximo `FF_PAUSA` = 20 s da anterior. O valor é o mesmo do `SESSAO_PAUSA_S`; `ETERNA_SESSAO_PAUSA` de 2 a 600 vale só para os testes.

**Relógio da câmera:** por `serie`, `desvio` = mínimo de `u − cap` nas últimas 50 fotos do dia, com sinal (revisão: relógio adiantado também é compensado); o último clique nunca passa da última chegada. O último clique no relógio do agente é `ultimo_clique = cap_max + desvio`.

| Etapa | Regra | Observação |
|---|---|---|
| **Fotografando** | grupo aberto e `agora − ultimo_clique ≤ FF_PAUSA` (o fotógrafo ainda está clicando) | foto sem `cap` usa `u`, e Fotografando e Subindo viram uma etapa só |
| **Subindo** | grupo aberto e `agora − ultimo_clique > FF_PAUSA`, com fotos ainda chegando (`agora − ultima_chegada ≤ FF_PAUSA`); ou uma leva de cartão (`s='cartao'`) em andamento | a contagem de fotos sobe a cada chegada |
| **Pronta no caixa** | `agora − ultima_chegada > FF_PAUSA` e nenhuma foto do grupo na fila de rostos (`rostos_pendentes`) quando os rostos estão ligados | é o momento em que a selfie do Checkout já acha a pessoa no servidor |
| **Sai da tela** | `FF_PRONTA_MIN` = 15 min depois de ficar pronta (D1, Eduardo 30/10), ou na virada do dia | — |

Com FTP ao vivo da câmera (4 a 5 s por foto), Subindo pode durar só alguns segundos. É o comportamento esperado. A etapa fica longa quando há fila de envio (Wi-Fi ruim) ou leitura de cartão.

## De onde vem o fotógrafo e o local (adendo das 10:39)
**Fotógrafo (chave), nesta ordem (regra D2 da v85):**
1. A origem `o`, se estiver cadastrada (`sem_acento(o) in ftp_cadastrados()`). Ela vem do login do FTP embutido, da subpasta do login `compartilhado`, da subpasta da pasta vigiada ou da subpasta do FTP do estádio (`rftp_origem`).
2. O `autor` ou o `dono` gravado na câmera, se bater com um cadastrado.
3. Senão, nenhum fotógrafo, e a tela mostra a fonte: `câmera ···1234` (últimos 4 dígitos da série), `pasta`, `ftp-estadio` ou `cartão`.

**Local:** o agente não sabe o ponto de nenhuma foto. A função do dia (campo + ponto, volante + modo, folga) está em `SIM.funcao`, no `localStorage` de quem abriu a Escala (`funcOf`/`setFunc`, ~1171). A TV do caixa não vê esse dado. A solução:
- `setFunc` também faz `POST /fila-fotografo/funcao`. No boot do agente (`a.boot` novo), o app envia o `SIM.funcao` de hoje, se houver.
- O agente guarda o dado em `~/Eterna/ponto/funcao.json` e **fotografa** a função no grupo quando ele abre. Se o fotógrafo trocar de campo para volante no meio do dia, os grupos antigos não mudam.
- Sem função enviada, o app usa o padrão de `DATA.points` (carlos → Terminal Campo, yago → Foto Campo 2, marinara → Foto Campo 3, samuel → Foto Campo 4), que é igual em todo navegador.
- O texto ao lado do nome: `(campo · Foto Campo 2)`, `(volante · chute a gol)`, `(set interno · Vestiário)` para o ponto `kind:'vestiario'`, ou `(sem ponto)`.
- Observação: "Mirante" é nome de fundo de IA, não de ponto. Os pontos hoje são Terminal Campo, Foto Campo 2, 3 e 4 e Vestiário. "Selfie" não é fonte de foto: é a busca do Checkout.

**Lacunas (casos sem como saber hoje):**

| # | Caso | Hoje | Proposta |
|---|---|---|---|
| L1 | Pasta vigiada na raiz (`o='pasta'`) ou subpasta não cadastrada | `quem` = nome da subpasta, sem conferência | não aceitar como fotógrafo (regra 1); a tela mostra a câmera. A TI cria uma subpasta por fotógrafo no FileZilla |
| L2 | Câmera sem login próprio e sem `autor`/`dono` gravados (cartão, FTP do estádio sem subpasta) | só a série | curto prazo: gravar o nome do fotógrafo no campo Artista/Copyright de cada corpo (o Guia explica). Depois: um cadastro "série → fotógrafo" no Painel de controle, gravado no agente |
| L3 | Login compartilhado sem subpasta | `quem` = login | aparece como "sem fotógrafo" + câmera |
| L4 | Fotógrafo de folga na Escala, mas mandando fotos | — | mostra `(sem ponto)` e o painel destaca o caso |
| L5 | Upload manual pelo navegador (`up_`) | não passa pelo agente | não aparece na fila (fora do escopo) |

## Decisões para o Eduardo (com recomendação)
| # | Pergunta | Recomendação |
|---|---|---|
| D1 | Quando o grupo sai de "Pronta"? | **Decidido (Eduardo, 30/10): 15 min depois de ficar pronto** (`FF_PRONTA_MIN = 15`), com até 24 cartões na coluna. "Sumir ao vender" só depois que as vendas forem para o servidor |
| D2 | O que identifica o grupo na tela? | nesta entrega: o nome do fotógrafo em letra grande, a hora de início (hh:mm) e o número de fotos. Com a v85 A, o código LP passa a ser o número grande |
| D3 | O fotógrafo aperta "comecei/terminei"? | não. Fica automático, pela premissa "zero toque no set" |
| D4 | Miniaturas na TV do caixa | **Decidido (Eduardo, 30/10), com o ajuste da segurança (B1):** a escolha gravada no aparelho (`eterna.fotofila.tvmini` `1`/`0`) vale; sem escolha, ligadas só para perfil sem venda/quiosque e com a janela fora de tela cheia (botão do app, `fullscreenElement`, `display-mode: fullscreen` ou F11/quiosque); senão desligadas. O interruptor "Miniaturas neste aparelho" é só de quem tem `filafoto.u` (Admin e Supervisor) e fica no histórico. São rostos de turistas e de menores (LGPD art. 14) |
| D5 | Nomes das colunas | **Decidido (Eduardo, 30/10): "Clicando agora" · "Chegando" · "Já no Checkout"** (estados internos `fotografando`, `subindo`, `pronta`) |
| D6 | Quem vê | Admin, Supervisor, Fotógrafo e Atendimento e venda (a TV do caixa), por um módulo novo só de leitura |

## Mudanças por arquivo

### `/home/claude/eterna/agente/eterna-agente.py`
- **Constantes:** `FF_PAUSA` (20; `ETERNA_SESSAO_PAUSA` de 2 a 600), `FF_PRONTA_MIN = 15`, `FF_MAX = 2000` grupos/dia, `FF_FUNCAO = ~/Eterna/ponto/funcao.json`.
- **Estado:** `ff_lock` (nunca segurar junto com o `lock`; ler o `meta` antes), `ff_grupos` (lista do dia), `ff_aberto` (chave → grupo), `ff_desvio` (série → deque de 50), `ff_rev = [0]`, `rostos_pendentes` (set).
- `ff_quem(o, autor, dono, serie)` → `(chave|None, fonte)`, pela regra acima.
- `ff_add(pid)`: chamada no fim de `ingest_file` (ramo novo, fora do `lock`). Lê `meta[pid]`, calcula a chave e acha o grupo aberto ou cria `{id:'G'+seq, chave, fonte, funcao:snapshot, inicio:u, ultima_chegada:u, cap_max, serie, n, pids:[últimos 6], via}`. Incrementa `ff_rev`.
- `ff_estado(g, agora)` → `fotografando|subindo|pronta|fora`, pelas regras da tabela.
- `ff_carregar()` no boot, depois de `load_lib()`: refaz os grupos de hoje a partir do `meta` (`u` de hoje, ordenado).
- **Rostos:** `rostos_pendentes.add(pid)` junto do `fila_rostos.put` (~1127) e `discard` quando a leitura termina (com erro também).
- **Poda:** dentro de `ff_json`, tirar os grupos `fora` e os de outro dia.
- `GET /fila-fotografo`: exige `self.posto()` e `self.origem_local()`, como `/impressao/fila` (~3650), senão 403. `Cache-Control: no-store`.
- `POST /fila-fotografo/funcao`:
  - exige `posto()`, `origem_local()`, o cabeçalho `X-Eterna: 1` e `corpo(4096)`;
  - valida as chaves em `ftp_cadastrados()`, `tipo ∈ {campo,volante,folga}`, `point` `^[a-z0-9_-]{1,24}$`, `modo ∈ {grupo,chute,livre}` e `dia` = hoje;
  - grava com tmp + `os.replace` e chmod 600;
  - imprime "função do dia atualizada por <posto>" sem conteúdo.

### `/home/claude/eterna/index.html`
- `VIEWS`: `['fotofila','Fila do fotógrafo','fotografando, subindo e pronta','Fotógrafo']`, logo depois de `importar`.
- `MODULES`: `['filafoto','Fila do fotógrafo',['fotofila']]`. `MODULE_INFO.filafoto = {desc:'Painel das fotos chegando, por fotógrafo e ponto', r:'ver a fila do fotógrafo (também na TV)', u:'ligar e desligar as miniaturas (rostos) neste aparelho'}` (o `u` entrou com a segurança B1).
- `PRESETS`: `filafoto:{...RO}` e `fotofila` no `menu` de `foto` e de `venda`; Supervisor `filafoto` Ver e Alterar; o Admin já ganha pelo `ALL`.
- Só `fotofila-mini` entra em `WRITE_OPS` (`u`, `ACT_MOD` `filafoto`), registrado no `auditLog` (segurança B1).
- `VIEWFN.fotofila = vFotoFila`.
- `state.fotoFila = null`, `fotoFilaTimer`.
- `fotoFilaPoll()`: cópia de `impFilaPoll`, com `fetch(state.agent.url+'/fila-fotografo')` e `AbortController` de 4 s. Sem resposta, mantém o último dado e mostra "Sem conexão com o servidor · atualizado há N s".
- `vFotoFila()`: estrutura `if-wrap`/`if-board`. A coluna do meio é a destacada (Subindo, `.agora`).
  - Cartão: nome (`P[chave].name` ou a fonte), `<span class="ff-onde">(…)</span>` via `ffOnde(g.funcao||padraoDe(chave))`, hora de início, `n fotos` e "há N min".
  - Nas duas primeiras colunas, até 6 `<img loading="lazy" src="${agent}/thumb/<pid>">` de 56 px, a mais nova primeiro, só se `ffMiniOn()`.
  - Tudo com `esc()`.
- `ffOnde(f)` → `campo · <nome do ponto>` | `volante · <modo>` | `set interno · <nome>` | `sem ponto`.
- `ffMiniOn()`: veja a D4 (escolha do aparelho; sem ela, ligado só para perfil sem venda/quiosque e fora de tela cheia).
- `data-act`:
  - `fotofila-tv`: liga e desliga a classe `if-tv` mais o fullscreen, igual ao `impfila-tv`;
  - `fotofila-mini`: "Miniaturas neste aparelho", só com `filafoto.u`. Grava só no aparelho e no histórico, não no servidor.
- **Correção pequena:** o ouvinte `fullscreenchange` tira `if-tv` quando o fullscreen termina, e `go()` tira `if-tv`. Hoje a classe fica presa depois do Esc.
- `setFunc`: depois de `saveSim()`, `ffFuncaoEnviar()` faz o POST com `X-Eterna: 1`, sem bloquear e sem erro na tela. `agentPoll` chama a mesma função quando `a.boot` muda.
- **CSS:** `.ff-thumbs{display:flex;gap:4px}`, `.ff-thumbs img{width:56px;height:56px;object-fit:cover;border-radius:6px}`, `.ff-onde{font-weight:500;color:var(--muted)}`, e `body.if-tv .ff-thumbs img{width:80px;height:80px}`.
- **Carimbo** da versão nas duas ocorrências.

### Outros
- `testes/fila_fotografo_agente.py`: HOME temporário, `ETERNA_SEM_OPENCV=1`, `ETERNA_SESSAO_PAUSA=3`, FTP embutido, `cap` pelo EXIF.
- `testes/fila-fotografo.js`: Playwright com o `/fila-fotografo` simulado. Incluir os dois no `rodar.sh`.
- `docs/GUIA-DA-EQUIPE.md` (o que cada coluna quer dizer; TV; Artista gravado na câmera), `docs/DOCUMENTACAO-TECNICA.md` (contrato), `CONTEXTO-ETERNA.md` (seções 3 e 4) e `VERSOES.md`.

## Contratos
`GET /fila-fotografo` → 200
```json
{"ok":true,"agora":1761830000.1,"rev":88,"pausa":20,"pronta_min":15,
 "grupos":[{"id":"G014","estado":"subindo","fotografo":"carlos","fonte":"ftp",
   "funcao":{"tipo":"campo","point":"terminal"},"inicio":1761829900.0,"ultima_chegada":1761829995.2,
   "ultimo_clique":1761829970.0,"pronta_em":null,"n":11,"pids":["a1b2c3d4e5f6"]},
  {"id":"G015","estado":"fotografando","fotografo":null,"fonte":"câmera ···1234","funcao":null,"n":3,"pids":["…"]}]}
```
- `pids` só nos grupos `fotografando` e `subindo` (até 6). Nos grupos `pronta`, `pids: []`.
- Sem nome de convidado, sem série completa, sem nome de arquivo.

`POST /fila-fotografo/funcao` (cabeçalho `X-Eterna: 1`)
```json
{"dia":"2026-10-30","map":{"carlos":{"tipo":"campo","point":"terminal"},"yago":{"tipo":"volante","modo":"chute"}}}
```
→ `{"ok":true,"ignoradas":n}` (chave fora do cadastro, ou login compartilhado, é ignorada e contada) · 400 com dia errado, map que não é objeto, mais de 40 chaves ou campo inválido numa chave cadastrada · 403 sem posto, origem ou cabeçalho · 413 acima de 4 KB.

Sem chaves de I18N.

## Critérios de aceite
**Agente** (pausa de teste: 3 s)
1. Três fotos do login `carlos` com cliques a t, t+1 e t+2 s, chegando juntas: um grupo `fotografando` com `n:3` e `fotografo:"carlos"`.
2. Fotos com `cap` antigo (clique há mais de 3 s) ainda chegando: o grupo fica `subindo` e `n` sobe a cada chegada.
3. Três segundos sem chegada, com os rostos desligados: `pronta`, com `pronta_em` preenchido e `pids:[]`.
4. Com os rostos ligados e uma foto do grupo ainda na fila de rostos, o grupo não fica `pronta` até a leitura terminar.
5. `carlos` e `marinara` alternados formam grupos separados.
6. Subpasta não cadastrada na pasta vigiada: `fotografo:null` e `fonte` com a câmera ou `pasta`, nunca o nome da subpasta.
7. Foto com `autor` EXIF "Yago", vinda do cartão: `fotografo:"yago"`.
8. Câmera com o relógio 2 h atrasado: o estado segue as mesmas regras do critério 2 (o desvio é compensado).
9. O POST de função muda a `funcao` só dos grupos novos; o grupo aberto antes continua com a função antiga.
10. Reiniciar o agente: os grupos de hoje voltam com os mesmos `n`, e nenhuma foto fica em dois grupos.
11. Grupo `pronta` há mais de `FF_PRONTA_MIN` não aparece. A virada do dia limpa a lista.
12. Segurança:
    - `GET` com `Host: evil:PORTA` → 403;
    - com `Origin: https://evil.example` → 403;
    - POST sem `X-Eterna` → 403;
    - `point:"../x"` → 400;
    - chave não cadastrada → ignorada, 200 com `ignoradas` (revisão 1); dia errado → 400;
    - corpo de 5 KB → 413.
13. Pelo endereço de `ETERNA_ORIGENS`, a partir de outro IP da rede, o GET responde 200.

**App**
14. `fotofila` aparece no grupo Fotógrafo, logo abaixo do Upload automático, para Admin, Supervisor, Fotógrafo e Atendimento e venda. Um perfil sem `filafoto.r` não vê o item e cai em `semacesso` pelo `#fotofila`.
15. Três colunas com contadores. Coluna vazia mostra o texto de vazio, como a Fila de impressão.
16. O cartão mostra "Carlos (campo · Terminal Campo)", "Yago (volante · chute a gol)" e "(set interno · Vestiário)" para o ponto vestiário. Sem fotógrafo, mostra "Sem fotógrafo · câmera ···1234".
17. Miniaturas (até 6, `naturalWidth>0`) só em Fotografando e Subindo. Nenhuma em Pronta.
18. Em tela cheia, sem menu e sem miniaturas por padrão. O interruptor liga e fica lembrado depois de recarregar. Esc sai da tela cheia e o menu volta (`if-tv` removido).
19. Com o agente fora do ar: aviso "Sem conexão com o servidor", o último dado na tela e nenhum erro no console.
20. Trocar a função na Escala gera um POST com `X-Eterna: 1`. Outro navegador (a TV) passa a mostrar o novo ponto nos grupos seguintes.
21. Nenhum texto do painel vem de `T()`. Nenhum nome de convidado, e-mail ou nome de arquivo aparece no HTML.
22. `testes/todas-as-telas.js` sem erro e `bash testes/rodar.sh` com `FALHAS: 0`. O teste do critério 19 de `testes/permissoes.js` passa (letras `r` e `u` em `MODULE_INFO.filafoto`).

## Riscos para o revisor de segurança e escala
1. **Rostos na TV (LGPD, menores):** as miniaturas são dado pessoal. Pela D4, ficam desligadas na tela cheia por padrão. Conferir que nada de `pids` sai para os grupos `pronta`.
2. **O pid abre o original:** `/file/<pid>` vale para quem passa na checagem de `Host`, e qualquer máquina da rede pode mandar o `Host` certo. Essa falha já existe (v85, risco 1). Por isso o feed só traz 6 pids por grupo aberto. A correção de verdade é o pareamento do posto (v83 A).
3. **O agente não tem autenticação:** qualquer máquina da rede que passe na checagem de origem consegue ler a fila e trocar a função do dia. O impacto é só de exibição, mas o POST deve ter limite por minuto (`limite_ok`) e um registro do posto.
4. **Miniatura pelo endereço da Tailscale:** `/thumb/` exige `Host` em `HOSTS_OK`, que só ganha o IP da rede com `ETERNA_REDE`. A TV aberta por um nome que esteja em `ETERNA_ORIGENS` e fora de `HOSTS_OK` recebe a miniatura quebrada. Conferir e alinhar com `ORIGENS_REDE_HOSTS`.
5. **Escala:** com cerca de 3 mil fotos e algumas centenas de grupos por dia, a resposta fica abaixo de 20 KB, porque a coluna Pronta tem teto. O polling é de 2 s por TV. Com 100 venues, cada um tem o próprio agente e nada vai para a nuvem. Se houver mais de 5 telas, acrescentar 304 por `rev`.
6. **Internet caída:** tudo funciona na rede local. Agente caído: aviso na tela e o vigia religa.
7. **Divergência com o Checkout:** "Pronta" quer dizer que as fotos estão no servidor e os rostos já foram lidos. A sessão LP do caixa continua sendo montada pelo navegador até a v85 A. Se o navegador do caixa estava fechado quando as fotos chegaram, a TV mostra "pronta" e o Checkout não acha. Avisar o Eduardo e priorizar a v85 A.
8. **Travas:** `ff_lock` nunca pode ser pego com o `lock` na mão (a mesma regra da v85 para o `sess_lock`).
