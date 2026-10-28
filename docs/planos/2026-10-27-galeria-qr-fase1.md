# Plano técnico: galeria online por QR, fase 1 (v77)

## Objetivo
A tela final da Loja passa a mostrar um QR que aponta para `https://eterna.photo/#g/<token>`. Quem escaneia confirma com uma selfie. Para escola, o responsável envia a foto do rosto da criança por um QR geral do grupo. Depois disso aparecem as fotos compradas e as cortesias para baixar, e o resto da sessão com marca d'água para comprar. A administração dá cortesias e cria os grupos de escola. O armazenamento e o pagamento ficam atrás de adaptadores neutros. Nesta fase o agente do ponto faz o papel do bucket.

## Escopo desta entrega
1. Token e código curto por sessão. QR na tela final da Loja com o código embaixo. A lib de QR passa a ser cópia local em `vendor/`.
2. Rota pública `#g/<token>`, que abre sem login: consentimento, selfie (ou foto da criança), galeria, compra simulada, download.
3. Administração em uma view nova, `galerias`:
   - sessões com direito por foto (comprada, cortesia, à venda);
   - cortesia com motivo e log;
   - grupos de escola, com sessões, QR geral para imprimir e baixar em PNG;
   - fila de envio.
4. Agente: o manifesto `sessao.json` com o adaptador `RepositorioLocal`, links assinados (HMAC e validade), comparação de rosto só dentro das fotos do token, pagamento pelo adaptador `PagamentoSimulado` e vendas online lidas pelo app.
5. Fallback SIM: sem agente, a galeria funciona com o estado local, para o protótipo e os testes.
6. Venda online aparece na Lista de vendas com canal "Online".

## Fora do escopo
- Nuvem real (S3 ou Azure), Rekognition, adquirente real (Mercado Pago ou Asaas) e webhook real (o endpoint fica reservado e responde 501).
- ZIP de download. "Baixar todas" baixa uma por uma.
- Fotos com fundo de IA na galeria por QR.
- Liveness (prova de vida) na selfie.
- Estorno de venda online.
- Juntar a view antiga `convidado` (demo interna) com a galeria pública. A `convidado` fica como está.

## Limitação que precisa ser dita ao Eduardo
Nesta fase o celular do cliente não alcança o agente. Ele roda em 127.0.0.1 no computador do ponto, e o navegador bloqueia https chamando um IP de rede local. No celular, o QR abre a galeria e mostra "Suas fotos estão chegando" até existir a nuvem (fase 2). A galeria funciona de verdade no próprio computador do ponto e nos testes. Na administração haverá o botão "Abrir galeria" para demonstrar.

## Decisões assumidas
| # | Decisão | Por quê |
|---|---|---|
| D1 | Selfie antes de tudo. Nem as compradas aparecem antes do rosto bater. | Item 2 novo |
| D2 | Sessão de adulto: o rosto bate quando alguma foto da sessão tem semelhança ≥ 0,45 (`LIMITE`). Com o rosto batendo, abre a sessão inteira (é o grupo da pessoa). A faixa "talvez" (0,38 a 0,45) não abre; a pessoa tenta de novo. | Mais seguro do que perguntar "é uma destas?" a quem está de fora |
| D3 | Grupo de escola: mostra só as fotos em que o rosto da criança bate, com limite mais alto de 0,50 (`LIMITE_MENOR`). Nunca abre a sessão inteira. | Uma sessão de turma tem outras crianças (LGPD, art. 14). O limite precisa ser calibrado com o Ronaldo. |
| D4 | Ao entrar num grupo, a sessão recebe `menor:true`. A view também tem uma chave "Sessão com menor". Com `menor`, o texto do consentimento é o do responsável. | Item 3 novo |
| D5 | Código curto `XXXX-XXXX` (alfabeto de 32 símbolos, sem 0/O/1/I) só para digitar quando o QR falha. Ele também exige selfie. | O código vira apenas um apelido do token |
| D6 | Token de 16 bytes de `crypto.getRandomValues`, em base64url, 22 caracteres. Nunca `Math.random`, nunca o código LP. | Rascunho, item 1 |
| D7 | Preço online: item novo `dig`, "Foto digital avulsa (galeria online)", R$ 39, editável no Catálogo. "Todas" usa `priceOf('mais')`. O total é sempre `min(n × dig, mais)` e o servidor recalcula. | R$ 39 é um valor assumido, confirmar com o Eduardo |
| D8 | Toda foto escolhida numa venda paga da Loja vira `comprada` (todos os pacotes incluem digital). | Catálogo atual |
| D9 | O tempo da tela "Pronto" da Loja sobe de 20 s para 45 s. | O cliente precisa de tempo para fotografar o QR |
| D10 | `RETENCAO_DIAS` do agente vai de 30 para 60. | Senão a selfie para de funcionar entre o dia 31 e o dia 60. Avisar o Ronaldo. |
| D11 | Vitrine = miniatura de 900 px. Marca d'água gravada com OpenCV quando houver; senão, só a sobreposição `.wm` na tela, e o `/status` informa `vitrine_marca:false`. O original só é servido para foto comprada ou cortesia. | Sem dependência nova |
| D12 | Novo módulo de permissão `galerias` ("Galerias e cortesias"). O admin recebe tudo (automático). O supervisor recebe RW. O vendedor não recebe nada. | Cortesia é receita que deixa de entrar |
| D13 | Publicação e vendas no agente só aceitam origem local (`127.0.0.1:8765` ou `localhost`), igual às chaves. As rotas `/g/*` são públicas, com limite de tentativas. | Mesmo padrão do agente |
| D14 | O agente só publica sessões cujas fotos são todas `ag_`. Sessões de exemplo (sprites) ficam na fila com estado `local` e só funcionam pelo SIM. | O agente não tem os sprites |

## Mudanças por arquivo

### `index.html`

**Cabeçalho**
- Linha 9: trocar o script do cdnjs por `<script src="vendor/qrcode/qrcode.min.js"></script>`.

**Estado**
- `SIM0()`: acrescentar `galerias:{}`, `cortesiaLog:[]`, `vendasOnline:[]`, `galFila:[]`.
- `state.sales`: acrescentar `canal:'all'`.
- Novo `state.pub=null` e `state.gal={tab:'sessoes',card:null,q:'',cort:null,ev:null}`.

**`DATA.catalog`**
- Acrescentar `{"id":"dig","name":"Foto digital avulsa (galeria online)","desc":"uma foto em alta para baixar, comprada na galeria online","price":39,"kind":"adicional","digital":1,"prints":0}`.
- O `lojaPkgAuto` filtra por `pacote`, então a Loja não é afetada.

**Dados da galeria** (bloco novo logo depois de `drawLojaQR`)
- `GAL_BASE='https://eterna.photo/#g/'`, `GAL_DIAS=60`, `GAL_ALFA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'`.
- `galToken()`: 16 bytes aleatórios em base64url, sem `=`. Repete se o token já existir.
- `galCodigo()`: 8 símbolos de `GAL_ALFA` via `getRandomValues`, no formato `XXXX-XXXX`, único em `SIM.galerias`.
- `galDaSessao(card,criar)`: devolve o token da galeria de tipo `sessao` cujo `sessoes[0]===card`. Com `criar`, monta o manifesto (contrato abaixo) com `criada=now`, `expira=criada+60d` e `precos={dig:priceOf('dig'),todas:priceOf('mais')}`.
- `galAtualizar(token)`: recalcula `fotos` a partir de `sessionObj(card).photos` e `simOf(card)` (regra D8).
  - Preserva `cortesia` e `comprada/online` que já existiam. A precedência é `comprada > cortesia > venda`.
  - Para evento, faz isso sessão por sessão.
- `galPublicar(token)`: enfileira em `SIM.galFila` sem duplicar, chama `saveSim()` e depois `galFilaTick()`.
- `galFilaTick()`: para cada item pendente:
  - Se D14 não for atendida, estado `local`.
  - Se o agente estiver fora, estado `pendente`.
  - Senão, `POST /galerias/publicar`. Em caso de sucesso, estado `enviada`. Em caso de erro, `tent++`, guarda `erro` e tenta de novo com espera de 10 s, 30 s, 60 s e depois 300 s.
  - Roda num `setInterval` de 10 s.
- `galVendasPoll()`: a cada 30 s, com o agente ligado, chama `GET /galerias/vendas?desde=n`. Junta em `SIM.vendasOnline` sem duplicar (pelo `id`) e marca as fotos como `comprada/online` no manifesto local.
- `qrDraw(el,text,size)`: helper único. Usa `window.QRCode`. Sem lib, escreve o código em texto.
- `drawQR()` (caixa) e `drawLojaQR()` passam a usar `qrDraw(el, GAL_BASE+token)`. Nunca mais `/g/<card>`.

**Loja**
- `lojaPay(m)`: depois de marcar `paga`:
  - `const tok=galDaSessao(card,true); galAtualizar(tok); galPublicar(tok);`
  - `k.paid.token=tok; k.paid.codigo=SIM.galerias[tok].codigo;`
  - Timer de 45 s (D9).
- Passo `done` em `vQuiosque()`: dentro de `.lj-qrcard`, embaixo do QR, mostrar `<b class="lj-qrcode">${T('gq_codeIs',codigo)}</b>`. O resto da tela não muda; o QR aparece mesmo sem conexão.

**Rota pública**
- `pubRead()`:
  - Se `location.hash` casa com `^#g\/([A-Za-z0-9_-]{22})$`, faz `state.pub={token,step:'carregando',modo:null,info:null,acesso:null,gal:null,sel:{},restam:5,err:null}` e devolve true.
  - Se o hash for `#g` ou `#g/`, faz `state.pub={token:null,step:'codigo'}`.
  - Para qualquer outro hash, `state.pub=null`.
- Boot: chamar `pubRead()` antes de `readHash()`. O handler de `hashchange` chama `pubRead()` primeiro e, se for rota pública, faz `pubLoad()` e `render()`.
- `render()`: logo no início, se houver `state.pub`, então:
  - `body[data-bare]`;
  - `#main = vGaleriaQR()`;
  - montar a selfie, se houver;
  - `return`.
  - Não chama `syncHash`, `camMount` nem `.bare-exit`.
- `syncHash()`: `if(state.pub)return;` como primeira linha.
- `pubLoad()`:
  - Tenta `GET agente/g/<token>/info` com tempo limite de 2,5 s.
  - 200: `modo='agente'`.
  - 404: procura em `SIM.galerias`. Se achar, `modo='sim'`; senão, passo `nao_existe`.
  - 410: passo `expirada`.
  - Erro de rede sem o token no SIM: passo `chegando`.
  - Com `estado:'chegando'` no info: passo `chegando`, com nova tentativa a cada 20 s.
  - Caso contrário: passo `consent`.
- `pubMatch(dataUrl)`:
  - Modo agente: `POST /g/<token>/rosto`.
  - Modo SIM:
    - Carrega a imagem e chama `faceFind(img, x=>m.sessoes.includes(x.card))`.
    - Sessão: bate se `r.list[0] && r.list[0].sc>=FACE_SIM`.
    - Evento: considera só as fotos com semelhança ≥ 0,50. Para isso, ajustar `faceFind` para devolver também `sims:{id:sc}` (mudança aditiva, sem alterar o retorno atual).
    - Tentativas no `sessionStorage` (`eterna.gq.<token8>`): 5 erros bloqueiam por 15 min.
  - Sempre, no `finally`: `selfieStop()`, zerar `sf.shot` e não guardar a imagem em lugar nenhum.
- `pubGaleria()`: monta a lista `{pid,direito,vitrine,original}`.
  - Modo agente: vem da resposta.
  - Modo SIM: manifesto filtrado (evento: só os pids que bateram). Vitrine com `phStyle` e `.wm`; original com `bigStyle`.
- `pubBaixar(pid)`:
  - Modo agente: `fetch` do link assinado, blob e `<a download="viva-maracana-N.jpg">`. Se falhar, abre o link em outra aba.
  - Modo SIM: `photoCanvas(id).toDataURL`.
- `pubPagar(metodo)`:
  - Modo agente: `POST /g/<token>/pagamento` com `idem` (UUID gerado ao abrir o passo de pagamento).
  - Modo SIM: marca `comprada/canal:'online'`, faz `SIM.vendasOnline.push(...)`, `log('Galeria online: ...')` e `saveSim()`.
  - Com `status:'pendente'` (já previsto para o adquirente), passo `aguardando`, consultando `POST /g/<token>/galeria` a cada 5 s.
- `vGaleriaQR()`: raiz `<div class="gq">`. Passos:
  - `carregando`, `codigo` (campo + "Abrir"), `nao_existe`, `expirada`, `chegando`;
  - `consent`: checkbox com o texto `gq_consentSelf` ou `gq_consentKid` (conforme `menor`/`evento`); o botão `gq-agree` fica desativado até marcar;
  - `selfie`: reaproveita a câmera e o `input file`;
  - `buscando`;
  - `nao`: `gq_noFace`, `gq_noMatch` ou `gq_locked`, com tentativas restantes;
  - `galeria`:
    - topo com logo, `langPick(true)` e `gq_until(data)`;
    - "Suas fotos": compradas e cortesias, com selo `gq_gift` nas cortesias, botão Baixar e "Baixar todas";
    - "Mais fotos da sua visita": à venda, com `.wm`, botão ✓ por foto e barra fixa com total e "Comprar";
    - "Todas por R$ X";
  - `pagar`: Pix ou Cartão, total, `gq_payTest`;
  - `aguardando`.
- Selfie: `state.guest.selfie` ganha `facing` (`'user'` para adulto, `'environment'` para evento). `selfieStart()` usa `sf.facing||'user'`. Em `render()`, a condição para manter a câmera passa a ser `state.view==='convidado'||state.pub`.

**Ações públicas** (`data-act`, fora do `WRITE_OPS` porque não há usuário)
- `gq-code-go`, `gq-consent` (checkbox), `gq-agree`, `gq-snap`, `gq-file` (no handler de `change`, como `guest-selfie`), `gq-retry`, `gq-sel`, `gq-all`, `gq-buy`, `gq-paym`, `gq-pay`, `gq-dl`, `gq-dlall`, `gq-back`.

**CSS**
- `.gq`: rolável, `min-height:100vh`, mesmo fundo azul da `.lj.lj-hero` e com os grafismos.
- Reaproveita `lj-top`, `lj-logo`, `lj-h1`, `lj-cta` (amarelo), `lj-ghost` e `lj-langs`.
- Classes novas:
  - `gq-grid`: 2 colunas no celular, 3 no tablet, 4 acima de 1100 px;
  - `gq-ph` (com `aspect-ratio:3/2`), `gq-badge`, `gq-bar` (barra de compra fixa embaixo), `gq-consent`, `lj-qrcode`.
- Big Shoulders nos títulos com `letter-spacing:.1em`.
- Sem rolagem horizontal em 390 px.

**Administração**
- `VIEWS`: `['galerias','Galerias online','QR, cortesias e escolas','Gestão']`.
- `MODULES`: `['galerias','Galerias e cortesias',['galerias']]`.
- `PRESETS.supervisor.perms.galerias={...RW}`.
- `VIEWFN.galerias=vGalerias`.
- `vGalerias()`, com chips de aba:
  - **Sessões**:
    - busca por LP;
    - tabela com sessão, data, fotógrafo, status de venda, estado da galeria (sem galeria, local, pendente, enviada), menor, e o botão "Abrir";
    - aberta a sessão: grade de fotos com selo de direito;
    - tocar numa foto à venda abre a caixa de cortesia (select de motivo `escola|parceiro|reclamacao|outro`, nota opcional, Confirmar);
    - tocar numa cortesia oferece "Retirar cortesia";
    - foto comprada não muda;
    - botões "Criar galeria" (sessão não paga), "Ver QR" (QR + código), "Abrir galeria" (abre `#g/<token>` em outra aba) e "Reenviar".
  - **Grupos e escolas**:
    - "Novo grupo" com nome (ex.: "Escola X"), data, lista de sessões daquele dia com checkbox e menor (marcado por padrão);
    - Salvar cria um manifesto `evento` e marca `menor` nas sessões;
    - por grupo: "Imprimir QR", "Baixar PNG", "Abrir galeria", "Editar sessões" e "Encerrar" (`expira=now` e reenvio);
    - "Imprimir QR" abre uma janela com logo Viva Maracanã, nome do grupo, data, QR grande, código, `gq_printHow` e chama `print()`;
    - "Baixar PNG" usa `canvas.toDataURL` do QR.
  - **Envio**: `SIM.galFila` com estado, tentativas, último erro e "Tentar agora".
  - **Cortesias**: o log com quando, quem, sessão, foto, motivo, ação (deu ou retirou) e nota.
- `WRITE_OPS`: `'gal-criar':'c','gal-cort':'u','gal-cort-ok':'u','gal-cort-rm':'u','gal-menor':'u','gal-reenviar':'u','gal-ev-salvar':'c','gal-ev-editar':'u','gal-ev-encerrar':'d'`.
- Ações só de leitura (sem gravação, fora do `WRITE_OPS`): `gal-tab`, `gal-open`, `gal-qr`, `gal-abrir`, `gal-ev-print`, `gal-ev-png`.
- Cada cortesia dada ou retirada: `SIM.cortesiaLog.unshift({token,card,pid,acao:'deu'|'retirou',motivo,nota,por:state.user.email,em:ISO})`, depois `galAtualizar` e `galPublicar`.

**Vendas**
- `allSalesSim()`: acrescentar as linhas de `SIM.vendasOnline` mapeadas para:
  - `{no:id, date: dia da compra === todayISO() ? 'hoje' : dia, time, card, key:(sessionObj(card)||{}).key, pdv:'Galeria online', seller:'Online', items:n===todas?['mais']:Array(n).fill('dig'), photos:n, prints:0, pay, total, status:'paga', est:false, canal:'online'}`;
  - as demais linhas recebem `canal:'loja'`.
- `vVendasLista()`:
  - chips "Canal: Todos / Loja / Online" (`sales-canal`) e coluna "Canal";
  - linhas online sem os botões Recibo e Cancelar.
- `salesCSV`: coluna `canal`.

**Repositório**
- `vRepo()`: trocar a árvore do exemplo para `galerias/<token>/sessao.json`, `vitrine/`, `original/`.
- Nota: "provedor em aberto entre Azure Blob e AWS S3". Acrescentar `azure` como provedor padrão possível no select (já existe).

**Depuração**
- `window.ETERNA`: expor `galDaSessao`, `galAtualizar`, `pubRead`, `get pub()`.

### `vendor/qrcode/` (novo)
- `qrcode.min.js` do qrcodejs 1.0.0 (MIT), a mesma versão do cdnjs.
- `LICENSE-NOTE.md`.

### `agente/eterna-agente.py`

**Constantes**
- `GALERIAS=~/Eterna/galerias`, `RETENCAO_DIAS=60` (D10), `LIMITE_MENOR=0.50`, `URL_TTL=900`, `ACESSO_TTL=3600`.
- Segredo HMAC em `~/Eterna/galeria-segredo.json` (32 bytes de `secrets`, chmod 600, criado na primeira vez).

**Adaptador de armazenamento**
- Classe `Repositorio` com a interface:
  - `salvar_manifesto(token,m)`, `ler_manifesto(token)`;
  - `subir(token,pid,variante,caminho)`, `existe(token,pid,variante)`;
  - `url(token,pid,variante,ttl)`, `abrir(token,pid,variante)`;
  - `apagar(token)`, `listar_expiradas(agora)`.
- `RepositorioLocal(GALERIAS)` grava em `<token>/sessao.json`, `<token>/original/<pid>.jpg` e `<token>/vitrine/<pid>.jpg`.
  - `url()` devolve `/g/<token>/foto/<pid>?v=<variante>&exp=<epoch>&sig=<hmac_sha256(segredo, token|pid|v|exp)>`.
- Escolha por `ETERNA_REPO` (padrão `local`). `s3` e `azure` levantam `NotImplementedError`, com um comentário do mapeamento: `put_object`/`generate_presigned_url` ou `upload_blob`/`generate_blob_sas`.
- Sem SDK nesta fase.

**Validação**
- `token_ok(t)`: regex `^[A-Za-z0-9_-]{22}$`, antes de qualquer `os.path.join`.
- `pid` com regex `^[0-9a-f]{6,40}$` (ou o formato que a `lib` usa).

**Fila de envio**
- Thread `galeria_loop()`, com uma fila por token:
  - primeiro copia os originais das fotos `comprada` e `cortesia` (`subir(...,'original')`);
  - depois gera as vitrines de todas (a partir de `lib[pid]['thumb']`, marca d'água com cv2 se houver, D11);
  - atualiza `m['envio']={'compradas':'ok','vitrine':'ok'|'pendente'}`.
- Uma vez por dia: apaga as galerias expiradas. Os originais em `inbox` continuam guardados.

**Rosto**
- `buscar_em(imagens, pids)`: o mesmo leitor de `buscar`, mas lê só `select pid, emb from rosto where pid in (...)` (em blocos de 500) e devolve `{rosto:bool, sims:{pid:max}}`.
- Se nenhum pid do token tiver sido lido ainda: `{processando:true}`.

**Acesso**
- `acessos={}` em memória: `{acesso: {token, pids, exp}}`.
- Para sessão, `pids` = todos. Para evento, só os que bateram com ≥ `LIMITE_MENOR`.

**Limite de tentativas**
- Por `(ip, token)`: 5 falhas bloqueiam 15 min.
- Por IP: 10 `POST /rosto` por minuto e 30 `GET /g/codigo` por minuto.
- Corpo de `/rosto` com no máximo 2 MB.

**Pagamento**
- Classe `Pagamento` com a interface:
  - `criar(pedido) -> {id,status,checkout_url,pix_copia_cola,expira}`;
  - `consultar(id)`;
  - `webhook(corpo,cabecalhos) -> {id,status}`.
- `PagamentoSimulado` aprova na hora.
- Escolha por `ETERNA_PAGAMENTO` (padrão `simulado`). Chaves futuras em `~/Eterna/pagamento.json`, chmod 600.
- `POST /pagamento/webhook/<provedor>` responde 501.
- Vendas em `GALERIAS/vendas-online.jsonl`. Idempotência por `idem`.

**Consentimento**
- Cada consentimento é anexado a `GALERIAS/consentimentos.jsonl` como `{token, tipo:'titular'|'responsavel', versao, idioma, em}`.
- Sem IP e sem imagem.

**Rotas**
- Rotas novas em `do_GET` e `do_POST` (ver Contratos).
- `/status` ganha `galerias:{fila, total, vitrine_marca}`.

### Testes
- `testes/galeria-qr.js` (novo): critérios 1 a 14.
- `testes/galeria-agente.js` (novo):
  - sobe o agente com `HOME` temporário e `ETERNA_PORTA=8799`, sem OpenCV;
  - testa as rotas e as regras de segurança (critérios 15 a 20);
  - derruba o agente no fim.
- `testes/todas-as-telas.js`: passa a cobrir `galerias` automaticamente pelo menu. Acrescentar uma abertura de `#g/<token-inexistente>` sem login, sem erro.

### Documentação
- `docs/CONTEXTO-ETERNA.md`:
  - seção 3: rota pública `#g`, `vGaleriaQR`, `vGalerias` e as chaves `SIM` novas;
  - seção 4: as rotas `/g/*` e `/galerias/*` e as variáveis `ETERNA_REPO` e `ETERNA_PAGAMENTO`;
  - seção 5: D3 e D10.
- `docs/DOCUMENTACAO-TECNICA.md`: um parágrafo sobre os dois adaptadores.

## Contratos

**Manifesto `sessao.json`** (igual no SIM e no agente)
```json
{"v":1,"token":"Qm9…22c","codigo":"K7QM-4WXR","tipo":"sessao","venue":"maracana",
 "nome":null,"sessoes":["LP2IVBK56"],"menor":false,
 "criada":"2026-10-27T15:02:00Z","expira":"2026-12-26T15:02:00Z",
 "precos":{"dig":39,"todas":250},"moeda":"BRL",
 "fotos":[{"id":"ag_3f9a1c","sessao":"LP2IVBK56","direito":"comprada","canal":"loja"},
          {"id":"ag_77b2e0","sessao":"LP2IVBK56","direito":"cortesia","canal":null,
           "cortesia":{"motivo":"escola","por":"eduardo@eduardorezende.com","em":"…"}},
          {"id":"ag_9d01aa","sessao":"LP2IVBK56","direito":"venda","canal":null}],
 "envio":{"compradas":"pendente","vitrine":"pendente"}}
```
- Evento: `tipo:"evento"`, `nome:"Escola X"`, várias `sessoes`, `menor:true`.
- O agente mescla com o que já tem. `comprada` nunca regride. A cortesia só pode ser retirada se a foto não estiver comprada.

**Rotas públicas do agente** (CORS `*`)

| Rota | Entrada | Saída |
|---|---|---|
| `GET /g/<token>/info` | | `{ok,tipo,menor,expira,estado:"pronta"\|"chegando",venue}`. Nunca `sessoes`, `fotos`, `codigo` nem a quantidade de fotos. 404 se não existir, 410 se expirada. |
| `GET /g/codigo/<CODIGO>` | | `{token}` ou 404. Com limite de tentativas. |
| `POST /g/<token>/rosto` | `{consentimento:true,versao:"2026-10-27",idioma:"pt",imagem:"data:image/jpeg;base64,…"}` | Bateu: `{ok:true,acesso,exp,galeria}`. Sem rosto: `{ok:false,motivo:"sem_rosto",restam}`. Não bateu: `{ok:false,motivo:"nao_encontrado",restam}`. Bloqueado: 429 `{motivo:"bloqueado",ate}`. Reconhecimento desligado ou fotos ainda não lidas: 503 `{motivo:"processando"}`. Sem consentimento: 400. |
| `POST /g/<token>/galeria` | `{acesso}` | `{galeria}`, com links reassinados. 401 se o acesso for inválido ou vencido. |
| `GET /g/<token>/foto/<pid>?v=&exp=&sig=` | | JPEG. 403 se a assinatura for ruim, se estiver vencida, se o pid não for do token, ou se for `v=original` com `direito=venda`. |
| `POST /g/<token>/pagamento` | `{acesso,pids:[…],metodo:"pix"\|"cartao",idem}` | `{ok,pedido:{id,status:"aprovado"\|"pendente",total,canal:"online",checkout_url,pix_copia_cola},galeria}`. O total é calculado no agente. Pid que não está à venda ou fora do acesso: 400. |

**Objeto `galeria`**
```json
{"tipo":"sessao","menor":false,"expira":"…","estado":"pronta","precos":{"dig":39,"todas":250},
 "fotos":[{"pid":"ag_3f9a1c","direito":"comprada","vitrine":"/g/…?v=vitrine&exp=…&sig=…","original":"/g/…?v=original&…","chegando":false}]}
```

**Rotas locais** (origem `127.0.0.1:8765` ou `localhost`; qualquer outra recebe 403)

| Rota | Função |
|---|---|
| `POST /galerias/publicar` | Recebe `{manifesto}` e devolve `{ok,token,estado}`. |
| `POST /galerias/encerrar` | Recebe `{token}` e devolve `{ok}`. |
| `GET /galerias/vendas?desde=n` | Devolve `{vendas:[{id:"O0001",token,sessoes,pids,n,total,metodo,em,canal:"online"}],next}`. |
| `GET /galerias/status` | Devolve `{fila,galerias:[{token8,estado,envio}]}`. |

**Venda online em `SIM.vendasOnline`**
```json
{"id":"O001","token":"…","card":"LP2IVBK56","pids":["…"],"n":1,"total":39,"pay":"Pix online","at":"ISO","canal":"online","status":"paga"}
```

**Chaves de I18N novas** (pt / en; o programador escreve es, fr e de no mesmo tom, sem travessão)
- `gq_loading` Abrindo suas fotos / Opening your photos
- `gq_consentH` Antes de começar / Before you start
- `gq_consentSelf` Concordo que a minha selfie seja usada só para encontrar as minhas fotos desta visita. Ela é comparada na hora e descartada (LGPD). / I agree that my selfie is used only to find my photos from this visit. It is compared on the spot and discarded (LGPD).
- `gq_consentKid` Sou mãe, pai ou responsável legal pela criança e autorizo o uso da foto do rosto dela só para encontrar as fotos desta visita. A foto é comparada na hora e descartada (LGPD, art. 14). / I am the child's parent or legal guardian and I authorise the use of the child's face photo only to find the photos from this visit. It is compared on the spot and discarded (LGPD, art. 14).
- `gq_agree` Concordo e continuar / Agree and continue
- `gq_selfieH` Tire uma selfie / Take a selfie
- `gq_selfieD` Assim só você vê as suas fotos. / This way only you see your photos.
- `gq_kidH` Foto do rosto da criança / Photo of the child's face
- `gq_kidD` De frente, com boa luz, sem boné nem óculos escuros. / Facing the camera, good light, no cap or sunglasses.
- `gq_comparing` Procurando nas fotos da sua visita. / Looking through the photos from your visit.
- `gq_noFace` Não encontramos um rosto na foto. Tente de frente e com boa luz. / We couldn't find a face. Try facing the camera in good light.
- `gq_noMatch` Esse rosto não aparece nas fotos desta visita. / This face isn't in the photos from this visit.
- `gq_tries` (n) Você tem mais n tentativa(s). / n more attempt(s).
- `gq_locked` (hh:mm) Muitas tentativas. Tente de novo às hh:mm. / Too many attempts. Try again at hh:mm.
- `gq_tryAgain` Tentar de novo / Try again
- `gq_help` Precisa de ajuda? Fale com a equipe do Tour. / Need help? Talk to the Tour team.
- `gq_arriving` Suas fotos estão chegando / Your photos are on their way
- `gq_arrivingD` Volte em alguns minutos. / Come back in a few minutes.
- `gq_expired` Esta galeria expirou / This gallery has expired
- `gq_expiredD` As fotos ficam disponíveis por 60 dias. / Photos stay available for 60 days.
- `gq_notFound` Galeria não encontrada / Gallery not found
- `gq_codeH` Digite o código do recibo / Enter the code on your receipt
- `gq_codeIs` (c) Código c / Code c
- `gq_open` Abrir / Open
- `gq_until` (d) Disponível até d / Available until d
- `gq_yours` Suas fotos / Your photos
- `gq_yoursD` (n) n foto(s) em alta para baixar / n high-resolution photo(s) to download
- `gq_none` Nenhuma foto liberada ainda. / No photos unlocked yet.
- `gq_gift` Cortesia / Complimentary
- `gq_dl` Baixar / Download
- `gq_dlAll` Baixar todas / Download all
- `gq_more` Mais fotos da sua visita / More photos from your visit
- `gq_moreD` Toque em ✓ nas que quiser levar. / Tap ✓ on the ones you want.
- `gq_each` (x) x cada / x each
- `gq_all` (x) Todas por x / All for x
- `gq_buy` (n,x) Comprar n foto(s) · x / Buy n photo(s) · x
- `gq_payTest` Pagamento de teste. Nada é cobrado. / Test payment. Nothing is charged.
- `gq_paid` Pagamento aprovado. Suas fotos estão liberadas. / Payment approved. Your photos are unlocked.
- `gq_waitPay` Aguardando a confirmação do pagamento. / Waiting for payment confirmation.
- `gq_kidFound` (n) Encontramos n foto(s) da criança / We found n photo(s) of the child
- `gq_printHow` Aponte a câmera do celular para o QR e envie uma foto do rosto da criança. / Point your phone camera at the QR and send a photo of the child's face.

Também são reaproveitadas as chaves que já existem: `payH`, `card`, `pix`, `total`, `g_snap`, `g_pickFile`, `g_fit`, `back`.

## Critérios de aceite
1. `index.html` não referencia mais o cdnjs do qrcodejs. Com `page.route('**/cdnjs.cloudflare.com/**', abort)`, `#lqr` contém um `canvas` ou um `img` depois do pagamento na Loja.
2. Depois do pagamento na Loja, a sessão tem um token em `SIM.galerias` que casa com `^[A-Za-z0-9_-]{22}$`, é diferente do código LP e não o contém. Dois pagamentos geram tokens diferentes.
3. A tela final da Loja mostra `Código XXXX-XXXX` (regex `^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$`). O texto do QR é `https://eterna.photo/#g/<token>` (verificável pelo `title` ou por `qrDraw`, interceptado no teste).
4. A tela final continua visível 30 s depois do pagamento (`page.clock`) e volta ao início por volta dos 45 s.
5. Abrir `U#g/<token>` numa página sem login mostra o consentimento. O hash não é apagado. Não existe nenhum `.gq-ph` no DOM antes da selfie. O botão "Concordo e continuar" fica desativado até marcar o checkbox.
6. Selfie feita com uma foto de uma pessoa da sessão (recorte do maior rosto de uma foto da sessão, via `setInputFiles`): a galeria aparece com as 3 fotos compradas em "Suas fotos", com Baixar, e as demais em "Mais fotos", com `.wm`.
7. Selfie de uma pessoa que não está na sessão: aparece `gq_noMatch`, as tentativas restantes caem de 5 para 4 e nenhum `.gq-ph` é exibido. Depois de 5 falhas aparece `gq_locked`.
8. Depois da busca, nem `state.pub`, nem `state.guest.selfie`, nem `localStorage` ou `sessionStorage` contêm a string `data:image`.
9. Na view `galerias`, marcar uma foto à venda como cortesia com motivo `escola` grava em `SIM.cortesiaLog` um item com `por:'eduardo@eduardorezende.com'`, `motivo:'escola'`, `acao:'deu'`. Reabrindo a galeria, a foto aparece em "Suas fotos" com o selo "Cortesia". Retirar a cortesia grava `acao:'retirou'`. Foto comprada não tem a opção de cortesia.
10. Comprar 1 foto na galeria por Pix: `SIM.vendasOnline` com 1 item, `canal:'online'`, `total===priceOf('dig')`. A foto passa para "Suas fotos". Na Lista de vendas a linha aparece com canal "Online", e o filtro "Online" mostra só ela. O CSV tem a coluna `canal`.
11. Selecionar todas as fotos à venda cobra `min(n*dig, mais)`.
12. Criar um grupo com 2 sessões (A e B) e menor marcado gera um token de tipo `evento` e marca `menor` em A e B. Abrir `#g/<token>`:
    - o consentimento contém "responsável";
    - a foto do rosto de uma pessoa de A mostra apenas fotos de A em que o rosto bateu (todos os pids pertencem a A e têm semelhança ≥ 0,50);
    - nenhuma foto de B aparece.
13. Na galeria pública, trocar entre PT, EN, ES, FR e DE muda os textos, e nenhum texto `gq_` cru aparece no DOM em nenhuma das 5 línguas.
14. A galeria pública e a view `galerias` em 390×844, 1024×1366 e 1440×900: `scrollWidth <= innerWidth`, prints em `testes/prints/galeria-*.png`. A data "Disponível até" é igual a `criada + 60 dias`.
15. Agente: `POST /galerias/publicar` com `Origin: https://evil.example` recebe 403. Sem `Origin` ou com origem local recebe 200.
16. Agente: `GET /g/<token>/info` não contém as chaves `sessoes`, `fotos` nem `codigo`. Token com `../` ou com tamanho errado recebe 404 sem tocar o disco. Manifesto com `expira` no passado recebe 410.
17. Agente: `GET /g/<token>/foto/<pid>` sem `sig`, com `sig` alterada ou com `exp` vencido recebe 403. Trocar `v=vitrine` por `v=original` numa foto `venda` recebe 403.
18. Agente sem OpenCV: `POST /g/<token>/rosto` recebe 503 `processando` e não devolve fotos nem acesso. Sem `consentimento:true` recebe 400. Corpo acima de 2 MB recebe 413.
19. Agente: `POST /g/<token>/pagamento` com um acesso forjado recebe 401. Com o mesmo `idem` duas vezes, a venda é registrada uma só vez. O `total` enviado pelo cliente é ignorado.
20. Agente: republicar um manifesto em que uma foto comprada online volta a `venda` mantém a foto como `comprada`.
21. `bash testes/rodar.sh` termina com `FALHAS: 0`, e `todas-as-telas` inclui `galerias`.

## Riscos para o revisor de segurança
- **BLOQUEANTE a checar:**
  - a rota de foto nunca serve original de foto à venda;
  - a assinatura usa `hmac.compare_digest`;
  - `token_ok` vem antes de qualquer caminho;
  - selfie e foto da criança nunca vão para disco, log ou `localStorage`.
- **Já existia, IMPORTANTE:** `/thumb/<id>` e `/file/<id>` não exigem nada, e o CORS é `*`.
  - Com `ETERNA_REDE=1`, qualquer pessoa da rede baixa todos os originais.
  - Qualquer site aberto no computador do ponto pode ler essas rotas.
  - Não é desta entrega, mas a galeria por QR não pode depender delas.
- **QR geral do grupo vazando** (grupo de pais no WhatsApp): quem tiver o QR e uma foto de outra criança vê as fotos dela (com marca d'água) e as cortesias dela.
  - Mitigações desta entrega: só as fotos em que o rosto bate, limite 0,50, limite de tentativas, validade de 60 dias e "Encerrar".
  - Alternativa para o Eduardo decidir depois: um PIN do grupo no comunicado, ou tirar a cortesia do download do grupo.
- **Falso positivo entre crianças:** o SFace foi calibrado em adultos. O `LIMITE_MENOR` de 0,50 precisa ser medido com fotos de escola (Ronaldo, `/rostos/medir`).
- **Selfie falsificada** com foto da pessoa tirada de rede social: sem liveness nesta fase. O risco é aceito porque quem tem o QR normalmente é o comprador.
- **Pagamento:**
  - preço calculado só no servidor;
  - idempotência por `idem`;
  - com adquirente real, o webhook precisa de assinatura validada e a liberação só acontece pelo webhook ou pela consulta, nunca pelo retorno do navegador;
  - chave só em `~/Eterna/pagamento.json` (chmod 600).
- **LGPD:**
  - o log de consentimento tem token, versão do texto, idioma e hora, sem identificar a pessoa; o encarregado (DPO) deve dizer se basta;
  - a retenção dos rostos sobe para 60 dias (D10).
- **Escala:**
  - Com 1 venue: cerca de 3.000 fotos por dia × 150 KB de vitrine ≈ 450 MB por dia, mais os originais vendidos. A busca dentro de um token compara de 10 a 200 vetores, o que é barato.
  - Com 100 venues: um bucket ou contêiner por venue e prefixo por token (sem listagem). O manifesto é lido por chave. O reconhecimento passa para a nuvem (decisão em aberto entre Rekognition e modelo próprio). O agente vira só o publicador.
  - O `_busca_lock` serializa a leitura da selfie: num pico de dia de jogo, a fila de `/rosto` precisa de um limite global (nesta fase, 10 por minuto por IP).
- **Internet caída:**
  - o QR é gerado localmente e o token nasce no app, então a Loja nunca trava;
  - a fila guarda e reenvia;
  - o `app_cache` do agente fica só em memória: se o agente reiniciar sem internet, o app não abre. Nota para uma fase futura.
## Adendo do Eduardo (27/10, 21:54): Loja apartada, em tela cheia, que volta sozinha

A Loja é a área do cliente: não depende de login, não tem menu lateral, abre em tela cheia, "tela virgem".

- A1. Rota pública própria `#loja` (como `#g/<token>`): abre sem login, ocupa a tela inteira, sem menu lateral, sem cabeçalho do app, sem `.bare-exit`. O usuário de perfil quiosque cai direto nela. O item "Loja" do menu da equipe leva para `#loja`. `ljMode()` passa a ser sempre tela cheia; o botão de tela cheia some (o navegador do quiosque roda em modo kiosk).
- A2. Saída só para a equipe, escondida: tecla Esc ou 3 toques seguidos no logo voltam ao app (se houver usuário logado; senão, à tela de login). Nada visível para o cliente.
- A3. Inatividade: nas etapas de fotos, carrinho e código, depois de `LOJA_INATIVO` = 90 s sem toque, clique, tecla ou movimento, aparece um aviso "Ainda está aí?" (5 idiomas) com contagem de 10 s e um botão grande para continuar. Sem resposta, `lojaReset()` e volta para a câmera (facial). Qualquer interação zera o contador.
- A4. Depois do pagamento: a tela final volta sozinha para a câmera em `LOJA_POS_COMPRA` = 5 s (pedido do Eduardo; substitui a D9 de 45 s), com contagem visível (anel ou número). Botão grande "Voltar ao início" (ícone de rosto + texto nos 5 idiomas) volta na hora.
- A5. Os timers não podem vazar: sair da Loja, trocar de etapa ou recarregar limpa todos; nenhum timer roda fora da rota `#loja`.
- Critérios de aceite extras:
  - 22. `U#loja` sem login mostra a câmera da Loja em tela cheia; não existe `#nav` visível nem menu lateral; `document.body` sem rolagem horizontal em 390, 1024 e 1440 px.
  - 23. Com `page.clock`, nas fotos, 90 s parado mostram o aviso; mais 10 s voltam para a câmera (`state.kiosk.step==='code'`). Um toque no aviso mantém a etapa.
  - 24. Depois do pagamento, 5 s voltam para a câmera; o botão "Voltar ao início" volta antes.
  - 25. Esc (logado) sai da Loja para o app; 3 toques no logo idem.

### Adendo 2 do Eduardo (27/10, 21:58): substitui A3 e ajusta A4

- A3 CANCELADO: não existe volta automática por inatividade. A pessoa pode estar escolhendo foto; só volta pelo botão.
- A4 mantido: só depois da compra a tela final volta sozinha para a câmera em 5 s (contagem visível) e tem o botão "Voltar ao início".
- A6. Botão "Voltar" manual visível em todas as etapas da Loja (fotos, carrinho, código): volta para a câmera (facial) na hora, limpando a sessão do cliente.
- A7. Seletor de idiomas com BANDEIRAS em vez de PT/EN/ES/FR/DE, na Loja e na galeria pública: Brasil (português), Estados Unidos (inglês), Espanha (espanhol), França (francês), Alemanha (alemão). Bandeiras em SVG desenhado no próprio código (emoji de bandeira não aparece no Chrome do Windows), com `title` e `aria-label` com o nome do idioma; a selecionada com anel amarelo.
- Critério 23 passa a ser: com `page.clock`, 5 minutos parado nas fotos NÃO mudam de etapa. Critério 26: o seletor mostra 5 SVGs de bandeira, sem os textos PT/EN/ES/FR/DE visíveis, e trocar de bandeira troca o idioma.

### Adendo 3 do Eduardo (27/10, 22:30)
- A4 ajustado: depois da compra, a tela final com o QR fica **30 s** (não 5 s) e volta sozinha para a câmera; o botão "Voltar ao início" continua para voltar antes.
- A8. O tempo é configurável: no Catálogo e preços, seção "Checkout", campo "Tempo da tela final com o QR (segundos)", padrão 30, mínimo 5, máximo 120, gravado em `SIM` (permissão `catalogo.u`). A Loja lê esse valor.
- Preço da foto avulsa online confirmado pelo Eduardo: **R$ 39** (22:33).
- Critério 24 passa a ser: com `page.clock`, a tela final ainda está visível aos 25 s e volta à câmera aos 30 s; trocar o valor no Catálogo para 10 faz voltar aos 10 s.
