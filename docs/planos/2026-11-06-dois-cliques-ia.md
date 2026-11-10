# Plano: os 2 primeiros cliques de cada sessão vão só para os fundos de IA

Data: 06/11/2026 · Pedido do Eduardo de 06/11 07:54 · Base: `9e64057` (v92) · Worktree: `/home/claude/eterna-ia` (branch `feat/cliques-ia`)

## Objetivo

Em cada sessão de ponto de campo, os 2 primeiros cliques (1º corpo inteiro, 2º mais fechado) servem só de base para os fundos de IA. Eles nunca são vendidos como foto normal. O servidor recorta os dois assim que chegam, e o Checkout abre já com as 5 montagens aprovadas.

## Como funciona hoje (v92)

- **Sessão** (`sess_*` no agente): fica por fotógrafo e trilha. A ao vivo é `dia|chave`; a atrasada, `dia|chave|t`, vale para cartão ou para clique feito mais de 10 min antes da chegada. Uma pausa de 60 s, medida pela hora do clique corrigida (`sess_clique`), abre sessão nova, e rostos todos novos também abrem (`rostos_novos`). `x["fotos"]` fica sempre ordenado pela hora do clique corrigida (`_sess_recalc`), então `fotos[0]` e `fotos[1]` já são os 2 primeiros cliques. A fusão (`_sess_fundir`) junta tudo na sessão mais antiga e reordena. A sessão `fechada` não muda mais, só pela LGPD. O ponto vem da função do dia: `x["funcao"] = {tipo:'campo'|'volante'|'folga', point}` e `x["ponto"]` só existe quando o tipo é campo. O Vestiário é campo com `point:'vestiario'` (`ffOnde` mostra "set interno").
- **Recorte**: o recorte antecipado (`rec_pre_loop`) só olha sessões **fechadas**, 15 s depois do boot e depois em ciclos. Faz uma foto por vez e só com a fila ao vivo vazia. Ele recorta o que `rec_pre_escolha` escolhe: as 2 primeiras da sessão mais as 2 primeiras de cada pessoa que aparece em 3 fotos ou mais, até 4 pessoas, ou seja, **até 10 recortes por sessão**. A fila `rec_fila` é FIFO (`Queue(24)`) com 1 worker (`REC_CONC`). Hoje o recorte começa no mínimo 60 s depois do último clique.
- **Checkout**: `lojaAI` pega as 2 primeiras fotos **do cliente** em `lojaFotos`. Cada uma entra nos 3 fundos com melhor `bgMatch` e com o enquadramento em `b.fit`, o que dá até 6 montagens. **Essas 2 fotos também aparecem como fotos normais.** A montagem é feita no navegador (`compose` → `fiaMontar` → canvas, com `fiaRostos` quando o corte passa no joelho) só quando o item aparece na tela (`compHydrate`).
- **Fundos ativos**: 5 (`BG_DEF=['campeao','mirante','arq1950','tunel','podio']`, `BG_MAX=5`). O "4 opções" da fala está resolvido: o Eduardo confirmou que são os 5, com o Pódio.
- **Atenção**: `ajTag` já usa o rótulo "IA" para foto com ajuste automático. A marca nova precisa de outro nome: **"Fundo IA"**.

## Escopo desta entrega

1. A regra no agente: no fechamento da sessão, marcar `ia` com os N primeiros cliques (N=2), conforme a regra configurada e o tipo do ponto.
2. Recorte na chegada: assim que uma foto entra entre os N primeiros cliques de uma sessão aberta (ou pendente de rosto), ela vai para a fila com prioridade. A fila passa a ter prioridades e não duplica pedidos.
3. O app esconde as fotos de IA da venda normal (Checkout, galeria, impressão, "Todas") e monta **os 5 fundos**, cada um com a base indicada. As 5 montagens começam a ser feitas assim que a selfie ou o código acha a sessão.
4. Painel de controle: ligar e desligar a regra, escolher quantos cliques (1 a 3) e em quais pontos ela vale.
5. Upload automático e Fila do fotógrafo mostram a marca "Fundo IA" e o estado dos recortes.
6. LGPD, boot e limpeza do cache consideram o campo novo.

## Fora do escopo (fica para depois)

- Montagem feita no servidor (portar `FIA_REGRAS` para Python). Ela é necessária para a nuvem e a galeria online e para que todos os caixas tenham o mesmo arquivo pronto. Nesta entrega o servidor deixa o recorte pronto (a parte que leva 7 a 8 s) e o navegador monta (centenas de ms por fundo).
- Conferir o enquadramento sozinho (avisar quando o 1º clique não foi de corpo inteiro).
- Botão "devolver as fotos de IA à venda" numa sessão em que o fotógrafo esqueceu a regra (ver D3).
- Estatísticas (v92) contando as fotos de IA à parte na produção do fotógrafo. Nesta entrega elas continuam no total.
- Curadoria/Qualidade avaliando as fotos de IA (elas saem das telas que usam `sessionObj`).
- Modo Photoroom: usa as mesmas bases, mas sem montagem antecipada, porque cada chamada custa.

## Decisões assumidas (padrão mais seguro)

| # | Decisão | Escolha |
|---|---|---|
| A1 | Fundos | **5** (confirmado pelo Eduardo). As 5 montagens saem prontas, uma por fundo. |
| A2 | Ordem | Pela hora do clique corrigida (`_t[pid][0]`), a mesma ordem de `fotos`. A ordem de chegada não conta. |
| A3 | Quando a regra vale | `funcao.tipo == 'campo'` e `ponto` na lista de pontos da regra. Padrão: `terminal, campo2, campo3, campo4`. Ficam fora o Vestiário, o volante e o chroma (D1). |
| A4 | Sem função do dia, ou fotógrafo sem cadastro | A regra **não vale** e as fotos ficam normais, como hoje. Nada some da venda. Upload e Fila mostram o aviso. |
| A5 | Sessão com N fotos ou menos ao fechar | A regra não vale (`motivo:'poucas_fotos'`). As fotos ficam normais e também servem de base, como hoje. |
| A6 | Fusão (v91) | Valem os N primeiros cliques da sessão fundida. O fotógrafo faz os cliques de IA no começo do atendimento, e as primeiras fotos da sessão que entrou na fusão viram normais. O recorte já feito delas fica no cache (2 dias). |
| A7 | Separação por rostos novos | A sessão nova tem os seus próprios N primeiros cliques (família nova = novos cliques de IA). |
| A8 | Trilha atrasada (cartão) | A regra vale igual. O recorte entra na fila com prioridade abaixo da ao vivo. |
| A9 | Base de cada fundo | `FIA_BASE`: **foto 1 (corpo inteiro)** para Arquibancada 1950 (regras 6 e 10, feitas para corpo inteiro) e Pódio de campeão (grupo no pódio). **Foto 2 (fechada)** para Noite de campeão (regra 1), Mirante (regra 5) e Saída do túnel (regra 11). O `fit` não vale para as bases de IA, porque o fotógrafo garante o enquadramento e o `fiaLayout` já trata corte e meio corpo. |
| A10 | Base ruim | Se a base indicada para um fundo falhar (`FIA_RUIM`, olhos fechados em `SIM.invalid`, LGPD, sem pessoa), o fundo usa a outra base de IA. Se as duas falharem, volta o jeito antigo: as 2 primeiras fotos normais do cliente servem de base e continuam à venda. O Checkout nunca fica sem fundos de IA por causa disso. |
| A11 | Menor ou escola (`lojaDele`) | A montagem só aparece se a foto base estiver em `so.ids`. |
| A12 | Mudança no Painel | Vale para as sessões que fecharem depois da mudança. A sessão fechada não muda (S8). |
| A13 | Rótulo para a equipe | "Fundo IA 1 · corpo inteiro" e "Fundo IA 2 · fechada". Nunca só "IA", que já é o rótulo do ajuste automático. |
| A14 | Recorte antecipado das sessões sem a regra | Só as 2 primeiras. Sai o extra por pessoa de `rec_pre_escolha`, que perdeu o sentido desde a v91 B (a selfie mostra a sessão inteira). Menor ou escola pede o recorte na hora. Assim cai a carga de até 10 para 2 recortes por sessão. **O revisor precisa olhar isto, porque mexe em código do Ronaldo.** |
| A15 | Busca facial com as bases (decidida na implementação, mantida na revisão R3) | A selfie do Checkout também compara as bases de IA (`faceFind` percorre `photos` e `ia`). O 2º clique, mais fechado, costuma ter o melhor rosto, e a sessão pode ser achada só por ele. A base nunca aparece como foto: ela só entra em `so.ids` (sessão inteira: todas as bases; menor ou escola: só a base reconhecida), o que libera as montagens dela. |

## Mudanças por arquivo

### `agente/eterna-agente.py`

**Configuração**
- Constantes novas: `IA_CLIQUES_PADRAO = 2`, `IA_CLIQUES_MAX = 3`, `IA_PONTOS_PADRAO = ("terminal","campo2","campo3","campo4")`, `IA_FILA_ALVO = 2` (quantos trabalhos de IA ficam na fila ao mesmo tempo).
- `ia_cfg()`: segue o mesmo molde de `busca_janela_cfg`. Lê `estado.db` col `config` id `ia` com cache de 3 s (`_ia_cfg`) e valida o formato. Sem valor gravado, ou com valor inválido, devolve o padrão `{ligada:True, cliques:2, pontos:[...padrão], volante:False}`. Em `/ponto/docs` (linha ~5045), quando algum doc for de `config`, zerar também `_ia_cfg["t"]`.

**Sessões** (tudo sob o `sess_lock`, sem pegar `lock` nem `rec_lock` lá dentro)
- `_sess_ia_regra(x)` → `(n, motivo)`. O motivo é `None` ou um destes: `'desligada'`, `'volante'`, `'sem_funcao'`, `'ponto_fora'`. Usa `ia_cfg()`. Para não ler o banco dentro do lock, a configuração é lida antes, fora do `sess_lock`, em `sess_add` e `sess_loop`, e passada como parâmetro ou guardada numa variável global com o snapshot.
- `_sess_ia_cand(x, n)`: com a sessão ainda não fechada, pega os n primeiros de `fotos + pend` pela ordem de `_t`. Os pids que ainda não estavam em `x["_ia_vistos"]` entram em `sess_ia_novos` (deque global, com a trilha para saber a prioridade) e em `x["_ia_vistos"]`. Chamada no fim de `_sess_add`, `_sess_decide` e `_sess_fundir`.
- `_sess_fecha_uma`: depois do `_sess_recalc`, grava `x["ia"] = fotos[:n] if n and len(fotos) > n else []` e `x["ia_regra"] = {"n": n, "motivo": motivo or ("poucas_fotos" if n and len(fotos) <= n else None)}`.
- `sess_carregar`: as sessões lidas como abertas e fechadas com "reinicio" (o `x.update` direto, linha ~4502) também calculam `ia` e `ia_regra`. Sessão de arquivo antigo sem a chave `ia` fica com `ia=[]` e `ia_regra=None` (nada retroativo).
- `_sess_normaliza`: `setdefault("ia", [])` e `setdefault("ia_regra", None)`, e `_ia_vistos=set()`.
- `sess_esquecer` e `sess_esquecer_disco`: tirar o pid de `ia` também. `sess_esquecer` também apaga `rec_arquivo(pid, l)` dos dois tamanhos (LGPD na hora, sem esperar a limpeza diária).

**Fila de recorte**
- `rec_fila` vira `queue.PriorityQueue()` com itens `(prio, seq, job)`. Prioridades: 0 = Checkout ao vivo (`/recorte`), 1 = IA da trilha ao vivo, 2 = IA da trilha atrasada, 3 = recorte antecipado (`rec_pre_loop`).
- `rec_jobs = {}` (pid → job em andamento ou na fila). `rec_pedir` reaproveita o job que já existe e espera o mesmo `Event`, sem recortar duas vezes. A capacidade `REC_FILA_MAX = 24` conta **só** os pedidos de prioridade 0, para que a IA nunca dê `fila_cheia` a um cliente.
- `rec_enfileirar(pid, origem, lado, prio)`: põe na fila sem esperar.
- `rec_ia_loop()`, thread nova iniciada ao lado de `rec_pre_loop`: tira os pids de `sess_ia_novos` (pega o deque sob `sess_lock` e solta), lê o arquivo sob `lock` e enfileira com `lado=2400`, o que gera o de 3000 e o de 2400 de uma vez. Mantém no máximo `IA_FILA_ALVO` trabalhos de IA na fila, para que a prioridade 0 passe na frente de verdade. Não faz nada se `rec_estado()` não estiver ok ou se o modo for `photoroom`. Registra o atraso entre a chegada (`u`) e o recorte pronto.
- `rec["ia"] = {"feitos", "erros", "fila", "atrasos": deque(200)}`. `rec_status()` ganha `"ia": {"ligada", "fila", "feitos", "erros", "atraso_p50_s", "atraso_p90_s"}`.
- `rec_pre_escolha(fotos, x)`: com `x.get("ia")` devolve `x["ia"]`. Com `ia_regra` sem motivo de poucas fotos e `ia` vazia, ou sem a regra, devolve `fotos[:2]`. O extra por pessoa sai (A14). `rec_pre_loop` passa a sessão e enfileira com prioridade 3 em vez de esperar a fila esvaziar.
- `limpar_recortes`: não apaga, nem por idade nem pelo teto de 5 GB, recorte de pid que está em `ia` de sessão de hoje que ainda não saiu da biblioteca. Para isso, recebe o conjunto calculado antes, fora dos locks.

**Fila do fotógrafo e galeria**
- `ff_json`: cada grupo ganha `"ia": {"n": n, "motivo": m, "pids": [...], "prontas": k}`. Os `pids` seguem a mesma regra dos `pids` (só grupo aberto, no máximo N). `prontas` vem de `os.path.exists(rec_arquivo(p, 2400))`, calculado **fora** do `sess_lock`.
- Galeria: `_gal_confere_sessoes` recusa no manifesto um pid que esteja em `ia` da sessão (a foto de IA nunca é publicada como foto, nem por um navegador antigo).

### `index.html`

**Configuração**
- `const FIA_BASE={arq1950:0,podio:0,campeao2:1,campeaoarg:1,campeaocol:1,mirante:1,tunel:1}`: índice da base, 0 = corpo inteiro e 1 = fechada. Um fundo fora do mapa usa 1.
- `iaCfg()`: lê `state.iaCfg` (vem de `config/ia` por `state.db`, copiando o `onSnapshot` de `config/busca` na linha ~5365) e, sem ele, usa o padrão. `iaCfgPanel()` fica dentro de `vCatalogo()`, num painel "Fotos para os fundos de IA" logo depois do painel Checkout. Ele tem:
  - um interruptor `data-act="ia-ligada"`;
  - um número `data-act="ia-cliques"` de 1 a 3;
  - uma caixa por ponto `data-act="ia-ponto" data-id` para os pontos `kind` campo e vestiario de `DATA.points`;
  - uma caixa `data-act="ia-volante"`;
  - uma nota: "Os primeiros cliques de cada sessão destes pontos não aparecem como fotos à venda: viram as montagens nos fundos de IA. Vale para as sessões que fecharem depois da mudança."
  - Tudo fica desabilitado sem `can('configuracao','u')`.
- `iaCfgSalva(patch)`: segue o molde de `buscaJanelaSalva`. Grava `{ligada,cliques,pontos,volante,por,em}` em `localStorage['eterna.ia.v1']` e em `state.db.doc('config/ia')`, e chama `log(...)`.
- O handler de `change` trata `ia-ligada`, `ia-cliques`, `ia-ponto` e `ia-volante` passando por `guardAct`. As quatro entram em `WRITE_OPS` como `'u'` e em `ACT_MOD` como `'configuracao'`.

**Sessão e fotos**
- `ingClose`: com `srv`, grava `SIM.sessions[card].ia = (srv.ia||[]).map(p=>'ag_'+p)` e `iaRegra = srv.ia_regra||null`.
- `demoSessions`: nas sessões do SIM, `photos` passa a excluir os ids de `sim.ia`. O objeto ganha `ia` com as bases que passam por `hasImg` e não estão em `discarded`, **sem** filtrar `invalid`. A sessão não some quando `ok` está vazio mas `ia` não está.
- `iaSet()`: conjunto de todas as bases de IA, guardado no `DS_CACHE` como `vend`.
- `impFotos`: tira de `ph` os ids que estão em `iaSet()` (defesa).
- `galAtualizar`: pula `p.id` que está em `iaSet()` (defesa; o `sessionObj` já tira).

**Checkout**
- `lojaAIBase(card)` → `{ses, bases:[b0,b1]}`. A sessão é `soCards(card)` na ordem de `sesHora`: a âncora (`so.card`) primeiro, depois a próxima que tiver `ia` (D2). Com menor ou escola, filtra as bases por `lojaDele`.
- `lojaAI(card)` reescrita: para cada `o` de `bgOn()`, `b = bgFor(o, card)` e a base `bases[FIA_BASE[b.id] ?? 1]`. Se essa base for ruim (`FIA_RUIM`, `SIM.invalid`, sem imagem), usa a outra. Sem nenhuma base, cai no caminho antigo (`ph.slice(0,2)` do cliente, os 3 fundos de melhor `bgMatch`). Devolve **uma montagem por fundo**, `{t:'ai',id,bg,k:'ai:'+id+'|'+bg,ses}`, com a mesma chave de hoje. Com isso carrinho, `aiSel`, `compHi`, impressão e pós-venda seguem iguais.
- `lojaItems`: o `lb` dos itens de IA vem de `lojaBloco(x.ses)`, porque a base não está mais em `ph`. A posição no meio da lista fica como está.
- `iaAquecer(card)`: chamada quando a revisão abre (`lojaJuntar`, `lojaAbrirSo`, abertura por código). Chama `compose(id,bg)` para os itens de `lojaAI`, um por vez, sem esperar o render. O `COMP` passa a ter o resultado pronto antes de o item aparecer. Só no modo local.
- I18N: **nenhuma chave nova** para o cliente. A espera usa `aiMaking`, que já existe nas 5 línguas. Se o programador precisar de texto novo de cliente, ele entra nas 5 línguas.

**Telas da equipe**
- `upSessBloco` / `upThumb`: as bases recebem a tag "Fundo IA 1 · corpo inteiro" ou "Fundo IA 2 · fechada" (`x.ia` do servidor; com a sessão aberta, `x.ia` vem vazio e as N primeiras recebem a tag "Fundo IA?"). O cabeçalho ganha uma pílula:
  - "Fundos de IA: 2 de 2 prontas";
  - "Volante: sem fotos de IA";
  - "Sem função do dia: fotos de IA não separadas";
  - "Poucas fotos: ficaram à venda".
  Textos em `UP_IA_MOTIVO`.
- `vFotoFila` (`card`): uma linha `ff-ia` com "Fundo IA ✓✓", "Fundo IA ✓·" ou "falta o 2º clique" no grupo aberto com 1 foto. Com `ffMiniOn()`, as miniaturas de `g.ia.pids` aparecem primeiro, com a marca `.ff-iamk`.
- `fiaPanel`: uma linha "Fotos para IA: fila X · p90 Y s desde a chegada · Z erros", vinda de `a.recorte.ia`.

**CSS e carimbo**
- CSS mínimo: `.ff-ia`, `.ff-iamk`, `.ph .tag-ia` (amarelo da marca `#FFB800` sobre grafite).
- Carimbo de versão nas duas ocorrências e linha nova em `VERSOES.md`.

### Documentação e testes
- `docs/fundos-ia-regras.md`: regra 15, "Os 2 primeiros cliques de cada sessão de ponto de campo são só para IA (Eduardo, 06/11 07:54)", com a tabela `FIA_BASE`.
- `docs/GUIA-DA-EQUIPE.md`: um passo para o fotógrafo: 1º clique corpo inteiro, 2º mais fechado, depois as fotos normais.
- `docs/CONTEXTO-ETERNA.md`: seções 4 e 5. `docs/DOCUMENTACAO-TECNICA.md`.
- Testes: `testes/cliques_ia_agente.py` (Python, pausa e rostos sintéticos como em `sessoes_agente.py`, recorte falso por variável de ambiente) e `testes/cliques-ia.js` (Playwright).

## Contratos

**Configuração** em `estado.db`, col `config`, id `ia` (pelo `/ponto/docs` que já existe):
```json
{"ligada": true, "cliques": 2, "pontos": ["terminal","campo2","campo3","campo4"], "volante": false, "por": "email", "em": "ISO"}
```
O agente aceita `cliques` de 1 a 3, `pontos` com até 20 itens que passem em `_re_ff_point`, e booleanos. Qualquer outra coisa faz valer o padrão.

**Sessão** em `GET /sessoes` e no arquivo do dia (campos novos):
```json
{"ia": ["<pid1>","<pid2>"], "ia_regra": {"n": 2, "motivo": null}}
```
`motivo` pode ser `null | "desligada" | "volante" | "sem_funcao" | "ponto_fora" | "poucas_fotos"`. Com a sessão aberta, `ia` é `[]`; a lista final só existe depois que ela fecha.

**Fila do fotógrafo** (`GET /fila-fotografo`), em cada grupo: `"ia": {"n":2,"motivo":null,"pids":["..."],"prontas":1}`.

**`/status.recorte.ia`**: `{"ligada":true,"fila":0,"feitos":0,"erros":0,"atraso_p50_s":null,"atraso_p90_s":null}`.

**Item do Checkout** (sem mudança de chave): `{t:'ai', id:'ag_<pid>', bg:'<fundo>', k:'ai:ag_<pid>|<fundo>', ses:'<card>'}`.

## Critérios de aceite

1. Numa sessão de ponto de campo (função `campo`, ponto `campo2`) com 8 fotos, `ia` fechada = os 2 pids de menor hora de clique corrigida, mesmo quando a 2ª chegou ao servidor antes da 1ª.
2. As 2 fotos de IA não aparecem como foto normal no Checkout (selfie e código), na galeria `#g`, em `impFotos` nem na contagem "Todas". As outras 6 aparecem.
3. O Checkout dessa sessão mostra exatamente 5 montagens, uma por fundo de `bgOn()`. Arquibancada 1950 e Pódio usam a foto 1; Campeão, Mirante e Túnel usam a foto 2.
4. Base de um fundo com olhos fechados (`SIM.invalid`) ou com `sem_pessoa`: o fundo usa a outra base. As duas ruins: as montagens usam as 2 primeiras fotos normais (o jeito antigo) e o Checkout continua com fundos de IA.
5. Com a fila de recorte vazia, os recortes de 3000 e 2400 px das 2 fotos de IA existem em `~/Eterna/recortes/` em até 30 s depois da chegada da 2ª foto, **antes** de a sessão fechar (a sessão ainda aberta).
6. Com 20 trabalhos de IA pendentes, um `POST /recorte` do Checkout para outra foto é atendido antes deles (prioridade 0) e nunca recebe `fila_cheia` por causa da IA.
7. Dois pedidos da mesma foto (IA e Checkout ao mesmo tempo) geram um recorte só (`rec["feitos"]` sobe 1).
8. Sessão de volante, de Vestiário ou sem função do dia: `ia=[]`, `ia_regra.motivo` certo, todas as fotos à venda. O Upload mostra a pílula do motivo.
9. Sessão que fecha com 2 fotos ou menos: `motivo:'poucas_fotos'`, as fotos ficam à venda e servem de base como hoje.
10. Fusão (individual e depois grupo, v91): `ia` da sessão fundida = os 2 primeiros cliques dela. Separação por rostos novos: cada sessão tem a sua `ia`.
11. Trilha atrasada (cartão): a regra vale. O recorte entra com prioridade 2, atrás de uma foto ao vivo que chegou depois.
12. Painel de controle: desligar a regra, ou mudar para 1 clique, vale para a próxima sessão que fechar, e as já fechadas não mudam. Sem `configuracao.u`, os campos ficam desabilitados e a ação é barrada por `guardAct`. A mudança fica registrada no log.
13. Fila do fotógrafo: grupo aberto com 1 foto mostra "falta o 2º clique". Depois de pronto, "Fundo IA ✓✓". As miniaturas de IA só aparecem com `ffMiniOn()`.
14. Upload automático: as bases têm a tag "Fundo IA 1 · corpo inteiro" e "Fundo IA 2 · fechada". A tag "IA" do ajuste automático continua igual.
15. LGPD de uma foto de IA: ela sai de `ia` na memória e no arquivo do dia, e os recortes dela são apagados na hora.
16. Reinício do agente com sessão aberta: ela fecha com "reinicio" e com `ia` calculada. O `rec_pre_loop` recorta as bases que faltam.
17. A limpeza do cache (teto de 5 GB forçado baixo no teste) não apaga recorte de foto de IA de sessão de hoje.
18. Um manifesto de galeria com um pid de IA é recusado pelo agente.
19. Com o recorte já feito, todas as 5 montagens ficam prontas no `COMP` em até 4 s depois de a selfie achar a sessão, no computador de teste.
20. Funciona sem internet: agente local, fila, recorte e montagem.
21. `bash testes/rodar.sh` termina com `FALHAS: 0`, com `todas-as-telas.js`, `v84.js`, `v86.js`, `checkout-varias-sessoes.js`, `sessoes_agente.py` e os dois testes novos.

## Custo, tempo e escala

- **Por sessão**: 2 recortes × 7 a 8 s (medido na v84) ≈ 15 s de CPU. Hoje são até 10 recortes por sessão, então a carga cai até 5 vezes (A14).
- **Dia normal**: 3.000 fotos, ~10 por sessão ≈ 300 sessões ≈ 600 recortes ≈ 80 min de CPU por dia.
- **Pico**: 4 pontos × 1 sessão a cada 2 min ≈ 2 sessões/min ≈ 4 recortes/min ≈ 32 s de CPU por minuto com 1 worker (~55%). Acima de ~7 recortes/min, que é o pico de dia de jogo, 1 worker satura: a fila de IA cresce, mas não trava o Checkout (prioridade). Medir o p90 em `/status.recorte.ia`. Se passar de 5 min, usar `ETERNA_RECORTE_CONC=2` (16 GB) ou uma máquina melhor. Os rostos (YuNet+SFace) disputam a mesma CPU.
- **Disco**: PNG de 3000 + 2400 px por foto, várias MB cada. 600 por dia pode chegar perto do teto de 5 GB, por isso o critério 17. Recomendo também medir no servidor e subir `ETERNA_RECORTES_GB` para 15 se for preciso.
- **De 1 para 100 venues**: a regra e os pontos ficam no `estado.db` de cada servidor. O padrão `IA_PONTOS_PADRAO` é só do Maracanã; o venue novo precisa gravar `config/ia`. Na nuvem, a montagem precisa ir para o servidor (fora do escopo).

## Riscos para o revisor de segurança

1. **Configuração sem autenticação no servidor**: `config/ia` grava pelo `/ponto/docs`, como `config/busca`. Antes do login de verdade (plano de 04/11), qualquer posto pareado consegue desligar a regra ou subir para 3 cliques e esconder fotos da venda. Mitigação: validação de formato, teto de 3, log. O servidor vai checar `configuracao.u` quando o login existir.
2. **Navegador antigo**: sem a v nova, ele mostra as bases de IA como fotos normais e pode vendê-las. O critério 18 protege a galeria; o Checkout depende do vigia atualizar.
3. **Lock**: `sess_lock` nunca pode ser pego junto com `lock` ou `rec_lock`. `rec_ia_loop`, `ff_json` (exists) e `limpar_recortes` precisam ler fora dele.
4. **Fila sem limite**: `sess_ia_novos` precisa de teto (ex.: 2.000; acima disso o `rec_pre_loop` recupera depois). Um cartão com milhares de fotos não pode estourar a memória.
5. **Pids das miniaturas**: os pids de IA na Fila do fotógrafo abrem `/thumb/` pela rede. Mesma regra dos `pids` atuais (risco 2 da v87): só grupo aberto, só com `ffMiniOn()`.
6. **EXIF forjado** pode mudar a ordem dos cliques e transformar outra foto em base. O impacto é baixo (a foto não se perde, vira montagem), e os limites de `sess_clique` continuam valendo.
7. **LGPD**: o recorte é dado de imagem da pessoa. A remoção na hora (critério 15) e o prazo de 2 dias continuam.
8. **A14** muda o comportamento do recorte antecipado do Ronaldo. O teste dele com fotos de dias anteriores (`ETERNA_BUSCA_DIAS`) precisa continuar passando.

## Decisões para o Eduardo (com recomendação)

- **D1. Volante e Vestiário seguem a regra?** Recomendo **não**, e ligar por ponto no Painel quando quiser. O volante fotografa no improviso ("chute", "grupo", "livre"), sem atendimento posado. O Vestiário é um set próprio, e a foto dele já é o produto. Fica valendo nos 4 pontos de campo.
- **D2. Cliente fotografado em 2 ou mais pontos no mesmo dia: um conjunto de montagens ou um por sessão?** Recomendo **um conjunto de 5 por venda**, da sessão âncora (a com mais fotos claras dele), passando para a próxima sessão só se a âncora não tiver fotos de IA. Um conjunto por sessão daria 10 a 20 montagens na tela.
- **D3. Quando o fotógrafo esquecer a regra, precisa já nesta entrega de um botão "devolver as 2 fotos à venda"?** Recomendo **não nesta entrega**. As 2 fotos não se perdem (viram montagem e o original fica guardado). A marca "Fundo IA" na Fila do fotógrafo mostra o erro na hora para o treino. O botão entra na próxima, junto com o aviso de enquadramento.

## Respostas do Eduardo (06/11)
- **D1**: só nos 4 pontos de campo. Volante e Vestiário ficam fora (dá para ligar por ponto no Painel de controle).
- **D2**: um conjunto de 5 montagens por venda, da sessão âncora; passa para a próxima sessão só se a âncora não tiver fotos de IA.
- **D3**: sem botão. Nas palavras dele: "se ele esquecer, o modelo vai usar as primeiras fotos que ele fizer de qualquer maneira; nossa IA consegue recortar de qualquer maneira." Ou seja, os 2 primeiros cliques viram base de IA sempre, mesmo que o fotógrafo não tenha feito o corpo inteiro e o fechado.
- **Fundos**: são 5 aprovados (com o Pódio), confirmado.
