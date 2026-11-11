# Plano: selo "Edição Maracanã" nas montagens de IA (item 9 da análise de telas)

Data: 11/11/2026 · Worktree `/home/claude/eterna-selo`, branch `feat/selo-ia`, criada de `feat/recorte-birefnet` `212bc84`.
Versão: v97, junto do recorte e da `feat/ondas-ux` (D8, Eduardo 11/11). Carimbo da branch: `v97-selo`.

## Objetivo
As montagens com fundo de IA passam a ser vistas como o produto especial que são: vêm primeiro no Checkout, juntas, com título, selo dourado "Edição Maracanã" e o nome do fundo.
O Admin passa a ver, por dia, quantas montagens o cliente viu e quantas comprou.

## Antes de começar (Programador)
1. `git -C /home/claude/eterna-selo merge feat/recorte-birefnet` com a ponta mais nova (o Revisor ainda corrige `pendTiraLeva` e o instalador gpu). Rodar `bash testes/rodar.sh` e anotar as falhas que já vêm da base.
2. Não mexer em `ljPronto`, `ljMinhas`, `lojaFim`, `lojaPendCheck`, `pendAcoes`, `pendPainel`, `ecoUpd` nem nas linhas de `pendEscolhaItem` (tudo isso está em `fix/checkout-espera`). O selo chega a "Ver minhas fotos" e ao Posto pelo `lojaThumb`, sem editar essas funções.

## Escopo desta entrega
- Checkout (`#loja`): montagens no início, juntas, com título; selo na tela cheia, na grade e em "Ver minhas fotos"; nome do fundo em cada montagem nas 5 línguas; a tela cheia abre na primeira montagem.
- Posto de venda: selo nas miniaturas do pedido (`pend-th`) e no eco da tela do cliente (`ecoThumb`).
- Estatísticas (só Admin): tabela por dia "montagens vistas × compradas", com contagem agregada nova no agente.
- I18N: selo, título, separador e o nome dos 5 fundos ativos (e do Pódio, que está no Laboratório).

## Fora do escopo
- **Galeria online por QR.** Hoje a galeria não tem montagem nenhuma: `galAtualizar` só põe `s.photos` e as bases já pagas; `aiSel` não entra no manifesto, e o agente não monta (a montagem é feita no canvas do navegador). Isso está registrado como "fora" desde a fase 1 da galeria e na v93 ("Montagem no servidor (nuvem e galeria online)"). Sem montagem na galeria, não tem onde pôr o selo. O contrato para quando isso existir está mais abaixo (D1).
- Ordem das fotos no pedido do Posto (`pendEscolhaItem` continua com as fotos comuns e depois as montagens; as linhas estão em `fix/checkout-espera`).
- Título do grupo na tela cheia (só na grade; D3).
- Contar montagem vista na grade (só conta na tela cheia; D5).
- Selo ou nome do fundo na impressão, no download e no arquivo (o selo é só da tela, decisão do Eduardo).

## Decisões assumidas
- A1. Ordem fixa: `[montagens na ordem de bgOn] + [fotos comuns na ordem de hoje]`. Uma montagem pronta nunca troca de lugar com uma que ainda está sendo feita: a ordem não muda enquanto o cliente olha.
- A2. Montagem ainda sendo feita ocupa o lugar dela no início, com o "Preparando sua foto especial..." (`aiMaking`) de hoje e já com o selo. Quando fica pronta, a imagem aparece no mesmo lugar (`compHydrate`), sem redesenhar a tela.
- A3. Montagem que falha (`fiaFalhou`, `FIA_RUIM`) some como hoje. Se nenhuma montagem existir ou todas falharem: não aparece título, nem separador, nem selo; o Checkout fica igual ao v96, abrindo na primeira foto comum.
- A4. Abertura (selfie, código, `loja-open` do painel da equipe): a tela cheia abre na primeira montagem **pronta**; sem nenhuma pronta, na primeira montagem (em preparo). Se depois de `LJ_ED_ESPERA_MS` (8 s) a montagem na tela ainda estiver em preparo e o cliente não tocou em nada desde a abertura, a tela vai sozinha para o primeiro item pronto (outra montagem pronta, senão a primeira foto comum). Depois do primeiro toque, a tela nunca anda sozinha.
- A5. Âncora da tela: a lista pode mudar com o cliente olhando (montagem falhou, montagem nova entrou no início, o Posto juntou ou separou uma leva). Hoje o Checkout guarda só o número do item (`k.ver`, `k.i`) e a foto na tela pula para outra. Com as montagens no início isso piora (qualquer falha empurra todas as fotos comuns). Esta entrega passa a guardar a chave do item que está na tela e acha o novo número dela a cada desenho.
- A6. Selo no canto de cima, à esquerda, da área da imagem (não da tela): faixa dourada `#FFB800` com texto azul noite `#0C2340`, maiúsculas, tracking ~.1em, fonte dos títulos do Checkout. No canto de cima à direita ficam os controles da tela cheia (`lj-ovtr`).
- A7. Nome do fundo: na tela cheia, embaixo à esquerda (o lugar do `lj-lbsrc`); na grade, no lugar da etiqueta "Fundo de IA" (`lj-tag`, `aiTag`). Montagem não mostra "ponto · hora" (o `lb`), mesmo com várias levas. Em "Ver minhas fotos" só o selo (não editar `ljMinhas`).
- A8. Título do grupo (grade): eyebrow "Edição Maracanã" + título curto. Depois da última montagem, um separador "Suas fotos de hoje" só quando é uma leva só (com várias levas os blocos `lj-blk` "ponto · hora" já fazem esse papel).
- A9. "Vista" = montagem pronta que apareceu na tela cheia do Checkout (`state.lojaRota`), contada uma vez por atendimento (`k.t0`) e por montagem (`k` do item). "Comprada" = `nAI` das vendas pagas do canal `checkout`. Taxa = compradas ÷ vistas.
- A10. Contagem sem dado pessoal: por dia e por terminal, um número acumulado. Terminal = id aleatório do navegador (`eterna.terminal.v1`), sem nome de pessoa, sem IP gravado, sem rosto, sem sessão, sem `t0`.
- A11. White label: o texto do selo vem do venue (`VENUES.maracana.selo = 'edSelo'`); outro venue traz a chave dele.

## Mudanças por arquivo

### index.html (app)

**I18N** (bloco ao lado de `aiMaking`/`bgTelao`, uma linha por chave, `[pt,en,es,fr,de]`):
- `edSelo`: `['Edição Maracanã','Maracanã Edition','Edición Maracanã','Édition Maracanã','Maracanã-Edition']`
- `edTitulo`: `['Montamos estas com as suas fotos','We made these from your photos','Las hicimos con tus fotos','Nous les avons faites avec vos photos','Aus Ihren Fotos gemacht']` (o Eduardo pode trocar; D2)
- `edFotos`: `['Suas fotos de hoje','Your photos from today','Tus fotos de hoy','Vos photos du jour','Ihre Fotos von heute']`
- Nomes dos fundos (só tela de cliente; o Admin continua vendo `b.name`):
  - `bgArq1950`: `['Arquibancada 1950','1950 Stands','Tribuna de 1950','Tribunes de 1950','Tribüne 1950']`
  - `bgMirante`: `['Mirante ao pôr do sol','Lookout at sunset','Mirador al atardecer','Belvédère au coucher du soleil','Aussichtspunkt bei Sonnenuntergang']`
  - `bgCampeao`: `['Noite de campeão',"Champions' night",'Noche de campeón','Nuit de champion','Meisternacht']`
  - `bgTunel`: `['Saída do túnel','Out of the tunnel','Salida del túnel','Sortie du tunnel','Aus dem Spielertunnel']`
  - `bgPodio`: `['Pódio de campeão',"Champions' podium",'Podio de campeón','Podium du champion','Siegerpodest']`
  - `bgTelao` e `bgIA` já existem (sem mudança).
- Nenhum texto com travessão. `aiTag` fica no dicionário sem uso (não apagar agora; a `ondas-ux` mexe no CSS dele).

**DATA.backgrounds**: acrescentar `nome:` em `arq1950` (`bgArq1950`), `mirante` (`bgMirante`), `campeao2`, `campeaoarg`, `campeaocol` (os três `bgCampeao`), `tunel` (`bgTunel`), `podio` (`bgPodio`). `bgNomeCli` já usa `b.nome` (sem mudança).

**VENUES.maracana**: `selo:'edSelo'`. Função nova `edSeloTxt()` = `T(venue().selo||'edSelo')`.

**lojaItems(card)**: devolve `[...ai, ...ph]` (sai o `at` do meio). Marcas no primeiro item de cada grupo, para a grade: `ai[0].edIni = true`; quando há montagem e `!multi`, `ph[0].edFotos = true`. Montagem sem `lb` (A7). `lojaCart`, `lojaSync`, `lojaPedido`, `aiSel`, `n`, `nSes` e preço não mudam (só a ordem). "Ver minhas fotos" (`lojaCart(...).ch`) passa a mostrar as montagens primeiro sozinho.

**lojaThumb(x)** (usado pela grade, tela cheia, "Ver minhas fotos" e Posto): para `t==='ai'`, depois do `.compimg` (que o `compHydrate` esvazia com `innerHTML=''`, por isso o selo fica fora dele), acrescentar `<span class="lj-ed" aria-hidden="true">${esc(edSeloTxt())}</span>`. O `aria-label` do `laibadge` vira `edSeloTxt() + ' · ' + bgNomeCli(b)`.

**Aspecto da montagem** (o selo precisa ficar no canto da imagem, não da tela): no `compHydrate`, quando `r.url` chega, gravar `LJ_AR['ai:'+key] = r.w/r.h` e pôr `--ar` no elemento pai `.lj-lbimg.ai`/`.lj-gimg.ai` (sem `render()`). No `img()` do `vQuiosque`, item `ai` ganha a classe `fit` com `--ar` de `LJ_AR['ai:'+id+'|'+bg]`, ou `3/2` enquanto não tem. Reaproveita a regra `.lj-lbmid .lj-lbimg.fit` que já existe.

**vQuiosque, etapa review**:
- `img(q,...)` para `ai`: `lojaThumb(q)` + `<span class="lj-lbsrc lj-edn">${esc(bgNomeCli(bgOf(q.bg)))}</span>` na tela cheia (no lugar do `rot`).
- `card(q,i)` na grade: troca `<span class="lj-tag">${ICO.spark} ${T('aiTag')}</span>` por `<span class="lj-tag">${ICO.spark} ${esc(bgNomeCli(bgOf(q.bg)))}</span>`.
- Grade: antes do card com `q.edIni`, `<div class="lj-edh"><span class="lj-edeb">${esc(edSeloTxt())}</span><h3>${T('edTitulo')}</h3></div>`; antes do card com `q.edFotos`, `<div class="lj-blk">${T('edFotos')}</div>`. Os dois ocupam a linha inteira (`grid-column:1/-1`), como o `lj-blk`.
- Âncora (A5): função nova `ljAncora(k,items)`, chamada no começo do ramo review, antes de calcular `v`: guarda em `k.verKs` a lista de chaves do último desenho; se a lista mudou e `k.verKs[k.ver]` ainda existe, `k.ver` (e `k.i`) passam a ser o novo número dela; se sumiu, fica o mesmo número limitado ao tamanho novo. No fim grava `k.verKs = items.map(x=>x.k)`. Vale para `k.i` na grade também. `lojaReset` e `lojaFim` limpam `k.verKs`.
- Contagem (A9): se `vq.t==='ai'` e `COMPURL[vq.id+'|'+vq.bg]`, chamar `edVista(vq.k)`.

**Abertura (A4)**: função nova `ljPrimeira(card)` = índice da primeira montagem com `COMPURL`, senão 0. Usar no lugar do `i:0,ver:0` em `lojaAbrirSo`, no `case 'kiosk-go'` e no `case 'loja-open'`. Gravar `k.edAbriu = Date.now()` e `setTimeout(lojaEdEspera, LJ_ED_ESPERA_MS)`. `lojaEdEspera()`: só age se `state.view==='quiosque'`, `k.step==='review'`, `k.ver!=null`, o item na tela é `ai` sem `COMPURL` e `!(k.toque > k.edAbriu)`; então `k.ver = k.i =` primeiro item pronto (`ai` com `COMPURL` ou `ph`) e `render()`. Constante `LJ_ED_ESPERA_MS = 8000`, ajustável pelo `window.ETERNA` nos testes.

**compHydrate**: no ramo `r.url`, se o elemento está dentro de `#lj-lb` (tela cheia), chamar `edVista('ai:'+key)` (a montagem ficou pronta com o cliente olhando para ela).

**Contagem de vistas (novo)**:
- `edVista(chave)`: só com `state.lojaRota` e `state.kiosk.t0`; `k.edVistos` (Set, limpo em `lojaReset`) evita contar de novo no mesmo atendimento. Soma 1 em `localStorage['eterna.edvistas.v1'] = {terminal, dias:{'AAAA-MM-DD': n}}` (dia por `venueToday()`, guarda só hoje e ontem) e chama `edVistasEnviar()` com espera de 30 s (uma chamada por vez).
- `edTerminal()`: lê ou cria `eterna.terminal.v1`, 12 caracteres de `[a-z0-9]` por `crypto.getRandomValues`.
- `edVistasEnviar()`: para cada dia guardado, `POST <agente>/ponto/montagens` com `X-Eterna: 1` e o total acumulado. Falha ou agente fora: fica guardado e tenta de novo a cada 5 min e no próximo `edVista`. Como manda o total, repetir o envio não conta duas vezes.

**ecoThumb (Posto, eco da tela do cliente)**: troca `<span class="eco-tag">IA</span>` por `<span class="lj-ed eco-ed">${esc(edSeloTxt())}</span>` com `title` = nome do fundo.

**Estatísticas**:
- `esDados`: `porDia[d.dia].edVistas = d.montagens ? safeN(d.montagens.vistas) : null` e `edCompradas = d.montagens ? safeN(d.montagens.compradas) : null`.
- `esSecA`: painel novo "Edição Maracanã: montagens vistas × compradas" (`esEdPainel(D)`), depois de "Produtos": tabela `Dia | Vistas | Compradas | Compradas por vista`, um dia por linha (mais novo em cima), dia sem registro = "sem registro" (dias antes desta versão), total do período no rodapé. Datas em dd/mm/aaaa. Nada disso no Painel nem em outra tela.

**CSS** (perto de `.lj-tag`/`.lj-lbsrc`; usar 14 px ou mais nos textos de cliente, que é a regra da `ondas-ux`):
- `.lj-ed`: `position:absolute;top:0;left:clamp(10px,2%,22px);z-index:2;padding:5px 12px 6px;border-radius:0 0 8px 8px;background:#FFB800;color:#0C2340;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(11px,1.4vw,15px);white-space:nowrap;pointer-events:none;box-shadow:0 2px 8px rgba(12,35,64,.25)`.
- `.lj .laibadge{display:none}` continua. Tela cheia: `.lj-lbimg.ai .lj-ed` com `font-size:15px`. Miniaturas pequenas (`.lj-mimg`, `.pend-th`, `.eco-mini`): `container-type:inline-size` e `@container (max-width:150px){.lj-ed{font-size:9px;padding:2px 6px;letter-spacing:.06em}}`. O selo nunca quebra linha nem é cortado.
- `.lj-edh` (linha inteira, eyebrow dourado e `h3` branco), `.lj-edeb`.
- `.pend-th .lj-ed` e `.eco-ed`: 10 px, mesmas cores.

**window.ETERNA**: as exportações novas (`edVista`, `edVistasEnviar`, `ljPrimeira`, `ljAncora`, `edSeloTxt`, `ljEdEsperaMs:v=>{LJ_ED_ESPERA_MS=v;}`) num `Object.assign(window.ETERNA,{...})` separado, logo depois da linha atual. Essa linha muda em todas as branches e daria conflito certo.

### agente/eterna-agente.py
- `operacao_db()`: tabela nova `create table if not exists montagem_vista (dia text, terminal text, vistas int, em real, primary key (dia, terminal))`.
- Rota `POST /ponto/montagens` (ao lado de `/ponto/entradas`, mesma guarda: posto + origem de `ETERNA_ORIGENS`/local + `X-Eterna: 1` + `limite_ok` 30 por minuto por IP + corpo até 1 KB). Validação: `dia` = hoje ou ontem no fuso do agente; `terminal` `^[a-z0-9]{8,16}$`; `vistas` inteiro de 0 a 20.000. Grava `vistas = max(atual, novo)`. No máximo 40 terminais por dia (o 41º é recusado com 409 `muitos_terminais` e conta em `/status.estatisticas.montagens_recusadas`). Responde `{"ok":true,"vistas":<valor gravado>}`. CORS e `Access-Control-Allow-Headers` com `X-Eterna` como no `/ponto/entradas`. Fora da matriz da `idiomas-base` hoje: entra nela no merge (aviso abaixo).
- `montagens_dia(dia)`: soma de `vistas` do dia, ou `None` sem linha.
- `met_v2`: `compradas` = soma de `int(c.get("nAI") or 0)` das vendas pagas com `canal == "checkout"` (no laço que já existe); `out["montagens"] = {"vistas": montagens_dia(dia), "compradas": compradas}`. `metricas_migra_v2` não inventa vistas para dias antigos (fica `vistas: null`).
- Backup: `operacao.db` já vai para o backup (sem mudança).

### testes/
- Novo `testes/selo-edicao.js` (Playwright, com agente de teste e recorte falso `REC_FILHO` como em `cliques-ia-e2e.js`) cobrindo os critérios 1 a 18.
- Novo `testes/montagens_agente.py` cobrindo 19 a 23.
- Os testes que andam pelo Checkout por posição (`v79-regressao.js`, `_v79-testador.js`, `v83.js`, `v84.js`, `checkout-tela-cheia.js`, `cliques-ia-e2e.js`) e rodam com montagens: conferir se o primeiro item deixou de ser foto comum e trocar o índice pela chave do item, com nota no commit. Sem agente (`fiaOferece()` falso) não aparece montagem e nada muda.

### docs
CONTEXTO (seção 3, Checkout e Cliques de IA), DOCUMENTACAO-TECNICA (seção do Checkout v96 e Estatísticas), GUIA-DA-EQUIPE (o vendedor vê o selo; montagem continua contando no pacote), VERSOES.

## Contratos

Item de montagem em `lojaItems` (a mais, nada sai):
```
{t:'ai', id:'<base>', bg:'<fundo>', k:'ai:<base>|<fundo>', ses:'<leva>', edIni?:true}
{t:'ph', id, k, ses, lb?, blk?, edFotos?:true}
```

Checkout para o agente:
```
POST /ponto/montagens   (X-Eterna: 1, Content-Type: application/json, até 1 KB)
{"dia":"2026-11-12","terminal":"k3x9q2m7a1b0","vistas":37}
-> 200 {"ok":true,"vistas":37}
-> 400 {"ok":false,"error":"dia|terminal|vistas"}  403 origem  409 muitos_terminais  429 limite
```

Resumo do dia (`GET /metricas/dia`, campo novo, nada sai):
```
"montagens": {"vistas": 37 | null, "compradas": 9}
```

localStorage (só o navegador do Checkout): `eterna.terminal.v1` = `"k3x9q2m7a1b0"`; `eterna.edvistas.v1` = `{"terminal":"k3x9q2m7a1b0","dias":{"2026-11-12":37}}`.

Galeria por QR, para quando a montagem for para a galeria (não implementar agora): entrada do manifesto `{id:'ai:<base>|<fundo>', t:'ai', base, bg, sessao, direito}`; `vGaleriaQR` põe `<span class="lj-ed gq-ed">` e o nome do fundo no card; o download continua sendo o arquivo montado sem selo.

I18N novas: `edSelo`, `edTitulo`, `edFotos`, `bgArq1950`, `bgMirante`, `bgCampeao`, `bgTunel`, `bgPodio`.

## Critérios de aceite
Checkout, com agente de teste, recorte falso e uma leva com 2 bases e 6 fotos comuns (5 fundos ativos):
1. A lista começa pelas 5 montagens, na ordem de `bgOn()`, e depois as 6 fotos comuns na ordem de hoje. Nenhuma montagem no meio das fotos comuns.
2. Selfie ou código com as montagens já prontas: a tela cheia abre na 1ª montagem (`k.ver===0`), com o selo e o nome do fundo.
3. Montagens ainda em preparo na abertura: a tela abre na 1ª montagem com "Preparando sua foto especial..." e o selo; quando fica pronta, a imagem aparece no mesmo lugar, sem trocar de item e sem piscar a tela.
4. Com o recorte falso segurando a 1ª montagem e o cliente sem tocar: depois de 8 s (ou o valor de `ljEdEsperaMs` no teste) a tela vai para a primeira montagem pronta; sem nenhuma pronta, para a 1ª foto comum. Com um toque antes disso, a tela não anda sozinha.
5. Âncora: com o cliente na 3ª foto comum, a 2ª montagem falha (`fiaFalhou`): a tela continua na mesma foto (mesmo `id`), o contador "N / total" se ajusta e as marcas ficam. O mesmo quando uma montagem nova entra no início e quando o Posto junta outra leva.
6. Nenhuma montagem (agente sem recorte, sem bases ou todas falharam): sem selo, sem título, sem separador; a tela abre na 1ª foto comum, igual à v96.
7. Grade ("Ver todas"): eyebrow "Edição Maracanã" + `edTitulo` antes da 1ª montagem; cada montagem com o selo no alto e o nome do fundo embaixo (no lugar de "Fundo de IA"); separador "Suas fotos de hoje" antes da 1ª foto comum só com uma leva; com 2 ou mais levas, os blocos "ponto · hora" continuam e o separador não aparece.
8. As 5 línguas: trocando a bandeira, selo, título, separador e os 5 nomes de fundo mudam para o texto da tabela de I18N; nenhuma chave aparece crua; nenhum texto novo tem travessão (`—` ou `–`).
9. Selo no canto de cima à esquerda da área da imagem (não da tela), em 1280×800, 1920×1080, 820×1180 e 390×844: a caixa do `.lj-ed` fica dentro da caixa da imagem e não encosta na caixa do `.lj-ovtl` nem do `.lj-ovtr`.
10. "Ver minhas fotos" (tela Pronto, sem mudar `ljPronto` nem `ljMinhas`): as montagens escolhidas vêm primeiro e cada uma tem o selo, na grade e ampliada; o selo não quebra linha nem é cortado, nem com 30 fotos escolhidas.
11. Pedido: marcar 2 montagens e 3 fotos gera o mesmo `selected`, `aiSel`, `n` e valor que na v97 para a mesma escolha (só a ordem mudou).
12. Posto: no pedido aberto, cada miniatura de montagem tem a faixa "Edição Maracanã" e o nome do fundo no `title`; o eco da tela do cliente mostra o selo na montagem atual e nas escolhidas.
13. Impressão: `printMontar` de uma venda com 2 montagens não tem nenhum `.lj-ed` no `#print-root`, e a imagem do `compHi` é igual, byte a byte, à de antes da mudança para a mesma foto e fundo.
14. Download e arquivo: `photoCanvas` e os arquivos da galeria não mudam (nenhuma chamada nova desenha texto no canvas).
15. Vista contada uma vez: abrir a mesma montagem pronta 3 vezes no mesmo atendimento soma 1; outro atendimento (depois do Iniciar) soma de novo; montagem em preparo não conta até ficar pronta na tela; a grade não conta.
16. Fora do Checkout (`#loja`), por exemplo na Venda no balcão, nada é contado.
17. Agente fora: as vistas ficam em `eterna.edvistas.v1`; com o agente de volta, o próximo envio manda o total e o agente fica com o mesmo número (sem contar duas vezes). Envio repetido com o mesmo total não muda nada.
18. Estatísticas (Admin): painel "Edição Maracanã: montagens vistas × compradas" com uma linha por dia, Vistas, Compradas (`nAI` das vendas pagas do Checkout) e a taxa; dia antes da versão = "sem registro"; Supervisor e outros perfis não veem a tela (como hoje).

Agente (`testes/montagens_agente.py`):
19. `POST /ponto/montagens` válido grava; com `vistas` menor que o gravado, mantém o maior; responde o valor gravado.
20. Recusa: dia de anteontem ou de amanhã, terminal fora do padrão, `vistas` negativo, fracionário, texto ou acima de 20.000, corpo acima de 1 KB, chave `__proto__` (400); sem `X-Eterna` ou de outra origem (403); 31º pedido no minuto (429); 41º terminal do dia (409).
21. `GET /metricas/dia` traz `montagens.vistas` (soma dos terminais) e `montagens.compradas` (só canal checkout pago; venda cancelada ou não paga fora); dia sem linha = `vistas: null`.
22. A tabela não tem nenhuma coluna além de `dia, terminal, vistas, em`; nada de IP, sessão, foto ou nome no banco e no console.
23. Reinício do agente: os números continuam (está no `operacao.db`).

Geral:
24. `bash testes/rodar.sh` termina igual à base depois do merge da `feat/recorte-birefnet` (mesmas falhas conhecidas, nenhuma nova). `todas-as-telas.js` sem erro.
25. Carimbo e linha em VERSOES.md com a versão que o Eduardo escolher (D8).

## Riscos para o revisor de segurança e de escala
- Contagem inflada: qualquer aparelho da rede do ponto que passe a origem e o `X-Eterna` pode mandar números altos. Teto de 20.000 por terminal e 40 terminais por dia, `max` (não soma) e 30/min por IP. É só estatística, não mexe em venda nem em dinheiro. Com a `idiomas-base`, a rota entra na matriz de permissões (sessão do terminal do Checkout conferida no servidor): combinar com o Ronaldo, que hoje não tem o Checkout `#loja` postando no agente (só `/rostos/buscar` e `/recorte`).
- Dado pessoal: o id do terminal é aleatório e do aparelho, não da pessoa; o dia e o número são agregados. Nenhum `t0`, sessão, foto ou rosto sai do navegador. Conferir que o console do agente não imprime o corpo.
- Rota nova no handler: o plano do recorte evitou mexer no handler por causa da `idiomas-base`. Esta rota entra ao lado de `/ponto/entradas` (o mesmo padrão) e precisa ir para a matriz no merge, como as `/visitas*`.
- XSS: o nome do fundo vem de `DATA.backgrounds` e do I18N fixos, sempre por `esc()`; nada vem do cliente.
- Âncora da tela (A5): mudança no coração da escolha. Risco de a tela "voltar" quando o cliente navega. A âncora só age quando a lista de chaves muda, nunca nas setas, no deslizar ou nas teclas (os testes 3 e 5 conferem).
- Andar sozinho (A4): a tela só muda sozinha antes do primeiro toque e só uma vez por abertura; não pode disparar `lojaEscolhaOciosa` nem apagar marcas.
- Escala: com 100 venues, cada agente guarda poucas linhas por dia (dia × terminal); o resumo do dia ganha 2 números. A ordem nova não custa nada a mais (`lojaItems` é o mesmo trabalho). As montagens na frente fazem a montagem da 1ª aparecer antes; o `iaAquecer` já monta na ordem do `bgOn`, que é a ordem da tela.
- Sem internet e com o servidor do ponto na rede: tudo funciona (é local). Sem o servidor do ponto: não há recorte, logo não há montagem nem selo; as vistas esperam no navegador.
- Testes por posição: com as montagens no início, testes antigos que tocam no "1º item" passam a marcar uma montagem. Pode esconder regressão se alguém só trocar o número; trocar pela chave do item.

## Conflitos previstos
- `feat/ondas-ux` (v97, parte G): mexe no CSS de `.lj-tag`, `.lj-lbsrc`, `.lj-blk`, `.lj-aimk`, `.lj-badge`, `.gq-badge`, `.es-t-v` (fontes de 13 para 14 px) e na linha do `window.ETERNA`. Este plano troca o conteúdo do `.lj-tag` (HTML, não o CSS), usa `.lj-lbsrc` e `.lj-blk` sem mudar o CSS deles e põe as regras novas em linhas novas. Conflito esperado: só a linha do `window.ETERNA` se não usar o `Object.assign` separado.
- `fix/checkout-espera`: mexe em `pendEscolhaItem` (outras linhas), `ljPronto`, `lojaFim`, `lojaPendCheck`, `ecoUpd`. Este plano não toca essas linhas; `lojaFim` só se for preciso limpar `k.verKs` (dá para limpar em `lojaReset` e na abertura e não tocar no `lojaFim`).
- `feat/posto-unico`: mexe no `vQuiosque`. Conflito provável no ramo review; resolver mantendo os dois.
- `feat/agenda-estatisticas`: mexe em `esSecF`; este plano mexe em `esDados` e `esSecA`. Sem conflito de linha esperado.
- `fix/galeria-testes`: mexe em `pubGaleria`/`vGaleriaQR`; este plano não mexe (galeria fora).
- `idiomas-base` (Ronaldo): rota nova `/ponto/montagens` na matriz de permissões.

## Testes que o Testador roda
`node testes/selo-edicao.js`, `python3 testes/montagens_agente.py`, `bash testes/rodar.sh`; conferência visual com print da tela cheia, da grade, de "Ver minhas fotos" e do Posto nas 4 resoluções do critério 9 e nas 5 línguas.

## Decisões (Eduardo, 11/11)
- D1. Galeria por QR: fica para depois (plano à parte, junto da montagem feita no servidor do ponto). A investigação de quem compra montagem num pacote só digital está em "Investigação D1" abaixo.
- D2. Título do grupo na grade: "Suas fotos especiais". EN "Your special photos", ES "Tus fotos especiales", FR "Vos photos spéciales", DE "Ihre besonderen Fotos" (chave `edTitulo`, sem travessão).
- D3. O título aparece só na grade (proposta aceita).
- D4. Nomes dos fundos nas 5 línguas: os da tabela de I18N deste plano (aceitos sem mudança).
- D5. A "vista" conta só na tela cheia (proposta aceita).
- D6. Espera de 8 s (`LJ_ED_ESPERA_MS = 8000`).
- D7. No Posto, as montagens também vêm primeiro no pedido. Só depois da `fix/checkout-espera` (mexe no `pendEscolhaItem`). **Pendente**: em 11/11 a `fix/checkout-espera` ainda não tem commits próprios (aponta para a ponta da `feat/ondas-ux`, `a9b4028`); a ordem do pedido no Posto não mudou nesta entrega.
- D8. Entra junto na v97 (não na v98).

## Investigação D1 (11/11, sem correção)
Quem compra montagem num pacote só digital (Zona Mista, Maracanã Mais) não leva a montagem de jeito nenhum. Confirmado por teste (Checkout e Posto de verdade, agente falso como no `selo-edicao.js`; script fora do `testes/`): 1 montagem + 2 fotos, PIX confirmado no Posto em modo local.
- Zona Mista (R$ 110): `prints` 0, nada para imprimir, galeria com as 2 fotos compradas e sem a montagem.
- Maracanã Mais (R$ 250): igual, `prints` 0, galeria sem a montagem.
- Gramado (R$ 150, com impressão): a montagem sai impressa (`impFotos`), mas também não vai para a galeria.
Passo a passo no código (linhas da `c0965e3`): `pendConfirmar` grava `s.aiSel` (index.html 1492) e chama `galDaVenda` (1498) → `galAtualizar` (2382) monta `m.fotos` só com `s.photos` e as bases já pagas (laço da linha 2389); `aiSel` nunca entra no manifesto. `impFotos` (1682) põe as montagens depois das fotos comuns e corta em `s.prints`, que é 0 nos pacotes só digitais (catálogo: `zona` e `mais` com `prints: 0`). Além disso, na Zona Mista com fotos adicionais (que são impressas), as montagens ficam no fim da fila e só saem se sobrar impressão. O agente não monta (a montagem é feita no canvas do navegador) e a galeria recusa base de IA.
Sugestão: até a montagem ir para a galeria, não vender montagem em pacote sem impressão (o Posto avisa e não deixa escolher Zona Mista ou Maracanã Mais com montagem marcada), ou imprimir a montagem como cortesia nesses pacotes; e, no plano da galeria, levar a montagem feita no servidor do ponto (`aiSel` no manifesto, contrato acima).

## Decisões que dependiam do Eduardo (respondidas acima)
- D1. Galeria por QR: hoje a montagem comprada não vai para a galeria (só a impressa sai da DNP). O selo na galeria depende de a montagem ir para a galeria, que precisa de a montagem ser feita no servidor do ponto (plano à parte). Confirmar que fica para essa entrega, e conferir com ele se o cliente que compra montagem num pacote só digital está levando a montagem de algum jeito hoje.
- D2. Título do grupo: proposta "Montamos estas com as suas fotos" (EN "We made these from your photos"). Alternativa: "Suas fotos em outros cantos do Maracanã".
- D3. Título só na grade (proposta) ou também na tela cheia, em cima do nome do fundo da 1ª montagem.
- D4. Tradução dos nomes dos 5 fundos (tabela acima): aprovar ou corrigir.
- D5. "Vista" só na tela cheia (proposta) ou também na grade.
- D6. Espera de 8 s antes de sair de uma montagem que não fica pronta (A4).
- D7. Ordem do pedido no Posto com as montagens primeiro também (fica para depois do merge da `fix/checkout-espera`).
- D8. Versão: v98 sozinha (proposta) ou junto da v97 com a `ondas-ux` e o recorte.

## Implementação (Programador, 11/11)
- Merge da `feat/recorte-birefnet` (`212bc84`): já estava na base, nada novo.
- "Pronta" no Checkout = `fiaPronta(x)`: `COMPURL` (montagem que já apareceu) ou `COMPOK` (montagem que o `compose` terminou, mesmo aquecida pelo `iaAquecer` sem aparecer). Sem isso a abertura e a espera de 8 s não viam as montagens prontas fora da tela.
- Selo na grade: o card é 4/5 e a montagem fica inteira; o selo desce até a borda de cima da imagem pela proporção (`--ar` no `.lj-gimg.ai`, `container-type:inline-size`). Em "Ver minhas fotos" (célula 3/2) o selo acompanha a borda da imagem do mesmo jeito.
- Tela cheia: com a imagem encostada no alto da tela (1280×800, por exemplo), o selo anda para a direita do logo do overlay (`@container (min-aspect-ratio:4/3)`), para não encostar no `.lj-ovtl`.
- Âncora: `ljAncora` também acerta o `k.i` quando a tela cheia está aberta (`k.i = k.ver`), porque o `fiaFalhou` e o `lojaVisitaAtualiza` limitam o `k.i` pelo tamanho novo antes do desenho.
- Contagem: o Set das vistas é por `t0` do atendimento (`k.edT0`), além de limpo no `lojaReset`.
- Agente: `montagens_validar` recusa qualquer campo fora de `dia`, `terminal`, `vistas` (400 `campo`, cobre `__proto__`); `vistas` precisa ser inteiro de verdade (`true` e `1.0` dão 400). Compradas seguem a regra de venda do resumo (tem "pagar").
- Testes: `testes/selo-edicao.js` usa o agente falso por `page.route` (como `visitas-checkout.js`), com o `/recorte` segurando a base para deixar a montagem "em preparo"; o critério 4 com montagem que fica pronta durante a espera chama o fim da espera à mão (o tempo da montagem no navegador varia). `testes/montagens_agente.py` usa o agente de verdade (no `rodar.sh`).
- Fora: critério 5 com o Posto juntando leva e critério 7 com 2 levas (blocos "ponto · hora") não têm teste próprio; o critério 10 com 30 fotos e o 13 byte a byte não foram testados (a impressão não passa pelo `lojaThumb`; o teste confere que o `#print-root` não tem selo nem nome do fundo).
