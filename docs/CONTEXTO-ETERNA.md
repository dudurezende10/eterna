# Contexto do Eterna para os agentes

Leia este arquivo inteiro antes de qualquer tarefa. Ele é a memória comum da esteira (planejador, programador, revisor, testador, segurança, documentador, deploy). Se algo aqui estiver desatualizado, o agente que perceber atualiza este arquivo no mesmo commit.

## 1. O que é

Eterna é o sistema de captura, validação, venda e entrega de fotos do Tour do Maracanã (Viva Maracanã, Grupo Viva, operação da Maracatour). Substitui o Roverpix a partir de 01/12/2026 e depois vira produto white label (SaaS + armazenamento) para outros venues no Brasil e nos EUA.

- Dono do produto: Eduardo Rezende (Dudu), Diretor Criativo do Tour. Decide produto, marca e UX. Escreve em português, muitas vezes por voz (transcrição com erros: "Hoverpix" = Roverpix, "Clássius" = Klássius).
- TI: Ronaldo Santos (Maracatour). Também faz commits no repositório (reconhecimento facial OpenCV YuNet/SFace, teste de carga). Sempre `git pull` antes de commitar.
- Chefe/dono da operação: Bruno.
- Escala de hoje: ~3.000 fotos/dia, 3 a 8 fotógrafos (Carlos, Marinara, Samuel, Yago, Márcio, Klássius, Sandessa), 4 pontos de campo, turistas do mundo todo. Custo de operação parada: ~R$ 25.000/dia.
- Premissas não negociáveis: local primeiro (offline-first), zero toque no set (o fotógrafo só fotografa), nada se perde (original sempre guardado, exclusão registrada), um domínio e um login (eterna.photo, e-mail + código, permissão por módulo C/R/U/D e menu por pessoa).
- Pensar do centavo aos milhões: cada decisão precisa funcionar num ponto com um notebook e escalar para muitos venues, milhões de fotos e picos de dia de jogo.

## 2. Peças e arquivos

| Peça | Arquivo | Notas |
| --- | --- | --- |
| App web (todos os perfis) | `index.html` | arquivo único, HTML + CSS + JS puro, ~570 KB. Publicado em https://eterna.photo (GitHub Pages, branch `main`) |
| Agente do ponto | `agente/eterna-agente.py` | Python stdlib (OpenCV opcional, do Ronaldo). Roda no computador do ponto: cartão, FTP, biblioteca, Roverpix, Photoroom. HTTP em 127.0.0.1:8765 e serve o app (proxy de `ETERNA_APP_ORIGIN`) |
| Lançador do agente (Mac) | `agente/Eterna.command` | mata o agente antigo na porta 8765, abre o novo e o navegador |
| Lançador (Windows) | `agente/iniciar-eterna.bat` | do Ronaldo |
| Documentação técnica | `docs/DOCUMENTACAO-TECNICA.md` | arquitetura, modelo de dados, fluxos; galeria por QR em "Galeria online por QR, fase 1"; menus e permissões em "Acesso, permissões e menus (v78)" |
| Guia da equipe | `docs/GUIA-DA-EQUIPE.md` | passo a passo do menu, do Checkout, do Upload automático, das Galerias online e das Permissões, em linguagem simples |
| Planos | `docs/planos/` | um plano por entrega, com as revisões de código e de segurança ao lado |
| Lib de QR | `vendor/qrcode/qrcode.min.js` | qrcodejs 1.0.0 (MIT), cópia local para o ponto offline |
| Versões | `VERSOES.md` | uma linha por versão (vNN, commit, o que entrou) |
| Testes | `testes/` | `testes/rodar.sh` roda tudo |
| Fundos de IA | `img/bg-*.jpg` | metadados em `DATA.backgrounds` no index.html |
| Marca | `img/brand/viva-maracana-{white,azul}.png` | manual: `VENUES.maracana` no index.html |

## 3. Como o index.html é organizado

- `const DATA={...}` embutido no topo (dados do Roverpix de 07 a 15/10, catálogo, fundos, pontos). Depois `applyLive(j)` troca pelos dados ao vivo da Roverpix vindos do agente.
- `state` (memória da tela), `SIM` (estado simulado da operação, `localStorage` `eterna.sim.v1`, salvar com `saveSim()`).
- `render()` monta a tela atual: `VIEWFN[state.view]()` devolve HTML em template string. Não há framework; cada render reescreve o `#main`.
- Navegação (v78): `VIEWS` (4º campo = grupo do menu: Dashboard, Curadoria, Fotógrafo, Configurações, Laboratório; itens do mesmo grupo contíguos; grupo `''` = tela sem item: Início pelo logo e Checkout pelo botão "Abrir Checkout" em `#rail-ck`), `VIEWS_EXTRA` (Venda no balcão `checkout`, Fila do balcão `fila`, Caixa `caixa`, abertas por botões), `MODULES` + `MODULE_INFO` (letras C/R/U/D que se aplicam a cada módulo, com o texto de cada uma), `MODULE_OF[view]`, `canView(v)`, `go(v)`. Grupos abrem e fecham (`nav-grp`, `state.navOpen`); até 700 px o menu é uma gaveta (`menu-toggle`, `menu-close`, `state.drawer`).
- Acesso em duas camadas (v78): o módulo (C/R/U/D) decide o que a pessoa faz; `menu` (lista de telas permitidas por usuário, `userMenu(u)`) decide o que ela vê. `canView` exige os dois. Usuário v2: `{v:2,perms,menu,inicio,preset,...}`; `migrateUser`/`migrateUsers`; `permValidate(editor,antes,depois,usersDepois)` em toda gravação (sem_permissao, auto_bloqueio, sem_admin, sem_poder, alvo_maior); ações de cadastro e permissões têm módulo fixo em `ACT_MOD` no `guardAct`, e ação do `WRITE_OPS` em tela sem módulo é barrada; o login grava só `lastLogin` (`loginMark`, `usuarios_login/`); `auditLog` em `eterna.users.log.v1` e `usuarios_log/`; view `permissoes` (`vPermissoes`, `permDraft`, `permSave`); sem tela permitida, a pessoa cai em `semacesso`. Tudo só no navegador (protótipo; servidor na v79).
- **Tela nova**: entra em `VIEWS` (com o grupo), em `MODULES`, em `MODULE_INFO` (texto de cada letra que se aplica) e no `menu` dos perfis que devem vê-la. Sem isso ninguém além do Admin vê. Ação que grava entra em `WRITE_OPS`; o teste do critério 19 em `testes/permissoes.js` cobra a letra no `MODULE_INFO`.
- Perfis (`PRESETS`, v78): Admin (tudo), Fotógrafo (grupo Fotógrafo, começa no Upload automático), Atendimento e venda (Checkout, venda no balcão, Catálogo só leitura; sem números de vendas), Validador (Curadoria sem Alertas, Diário só leitura), Supervisor (vê quase tudo; sem Usuários e Permissões, sem cancelar venda, Curadoria e Catálogo só leitura), Checkout (`quiosque`, tela do cliente). Não existe mais perfil Cliente. Módulos novos: `financeiro` (Vendas e caixa, Lista de vendas), `escala`, `laboratorio`, `permissoes`; saiu `galeria`. O Ajuste automático fica no grupo Configurações, mas no módulo `set`.
- Cliques: um único `document.addEventListener('click',...)` com `switch(a)` sobre `data-act`. Novo botão = `data-act="algo"` + `case 'algo':` no switch. Ações que gravam entram em `WRITE_OPS` com a operação exigida.
- Fotos: `phStyle(id)` devolve as variáveis CSS (`--img`, `--bs`, `--bp`, `--flt` dos ajustes). Fotos de exemplo vêm de sprites (`sprites/cNN.webp`); fotos reais do agente têm id `ag_<id>` e `UP[id].src` = `<agente>/thumb/<id>`; `bigStyle(id)` usa o original (`/file/<id>`).
- Sessões: `demoSessions()`, `sessionObj(card)`, `simOf(card)` (estado da sessão em `SIM.sessions[card]`), `revSessions()` (amostra + Roverpix ao vivo + fotos casadas).
- Checkout (view `quiosque`, antiga Loja; no código as funções seguem com `loja`): rota pública `#loja` (`state.lojaRota`), sem login, sempre em tela cheia, sem menu. `vQuiosque()`, etapas `state.kiosk.step` = code → review → cart → done; `lojaItems`, `lojaCart`, `lojaPay`, `lojaReset`, `lojaAbrir`, `lojaSair` (Esc, ou o botão Sair do painel da equipe; sempre leva ao login, nunca ao app logado), `lojaLogo` (3 toques no logo abrem o painel escondido da equipe com "Sessões esperando" e "Sair"), `lojaTick` (único timer: a tela final com o QR volta à câmera em `SIM.lojaFimSeg` segundos, padrão 30, de 5 a 120, editável em Catálogo e preços › Checkout). O botão "Abrir Checkout" da barra da equipe e o perfil Checkout (`quiosque`) levam para `#loja`; recarregar a página nunca abre o Checkout para a equipe (só com `#loja` ou o perfil Checkout). Classes CSS com prefixo `lj-`.
- Galeria online por QR: rota pública `#g/<token>` (`state.pub`, `pubRead`, `pubLoad`, `pubMatch`, `pubGaleria`, `pubPagar`, `pubBaixar`, `vGaleriaQR`, classes `gq-`). `render()` trata `state.pub` e `state.lojaRota` antes de tudo (sem login, sem `syncHash`). Manifesto por galeria em `SIM.galerias[token]` (`galDaSessao`, `galAtualizar`, `galPublicar`, `galFilaTick`; a venda paga cria e publica por `galDaVenda`, e o `render` só lê); também `SIM.cortesiaLog`, `SIM.vendasOnline`, `SIM.galFila` e a cortesia por foto em `SIM.sessions[card].cort`. QR sempre por `qrDraw(el,texto,tamanho)` com `vendor/qrcode/qrcode.min.js`.
- Administração das galerias (view `galerias`, módulo `galerias`): `vGalerias()` com abas Sessões, Grupos e escolas, Envio e Cortesias.
- Saíram na v78: Fluxo, Galeria do convidado (view `convidado`) e Anfitrião no set (view `set`; `#set` cai em `importar`). A selfie da `#g` usa `selfieStart`, `selfieMount`, `selfieStop` e `state.guest.selfie`. O check-in da câmera (`camPanel`) e a troca de fotógrafo (`fotoQuem`, `set-switch`, `set-logout`) estão no Upload automático (`importar`). Sem login de convidado: e-mail fora do cadastro não entra.
- Idiomas das telas do cliente: `T('chave',...args)` com o dicionário `I18N` (pt, en, es, fr, de), seletor `langPick()` com bandeiras em SVG (`LANG_FLAGS`). Todo texto novo de tela de cliente entra no `I18N` nas 5 línguas.
- Depuração/testes: `window.ETERNA` expõe `state`, `render`, `revSessions`, `demoSessions`, `photoCanvas` e outros.
- Carimbo de versão: duas ocorrências a atualizar a cada versão: `title="Eterna vNN · dd/mm hh:mm"` e `powered by <b>Eterna</b> · vNN`.

## 4. Agente do ponto (eterna-agente.py)

- Endpoints GET: `/status`, `/events?since=`, `/biblioteca`, `/thumb/<id>`, `/file/<id>`, `/roverpix/status|data`, `/photoroom/status|result/<n>`, `/ftp-remoto/status`, `/metricas`.
- Endpoints POST com chave (Roverpix, Photoroom, FTP remoto): só aceitam origem `http://127.0.0.1:8765` ou `localhost`.
- `/biblioteca`, `/thumb/`, `/file/`: CORS só para a origem do agente e `ETERNA_APP_ORIGIN` (outra origem recebe 403). `/rostos/*` e as rotas locais da galeria: só origem local, e o `Host` precisa ser `127.0.0.1:PORTA` ou `localhost:PORTA` (DNS rebinding). Conexões com `timeout` de 20 s; imagens acima de 40 MP são recusadas (`OPENCV_IO_MAX_IMAGE_PIXELS`).
- Galeria online (detalhes na DOCUMENTACAO-TECNICA). Fase 1: o celular do cliente não alcança o agente (127.0.0.1), então no celular aparece "Suas fotos estão chegando" até a nuvem; a galeria funciona no computador do ponto e nos testes. Rotas públicas `/g/<token>/info|rosto|galeria|pagamento`, `/g/codigo/<CODIGO>` e a foto com link HMAC de 15 min; rotas locais `/galerias/publicar|encerrar|vendas|status`; webhook `/pagamento/webhook/<provedor>` responde 501. Pagamento simulado (padrão) grava `teste:true` e a venda fica fora da receita. Limites: 5 falhas por `(ip, token)` bloqueiam 15 min; 10 selfies por minuto por IP; grupo de escola com no máximo 2 crianças diferentes por IP em 24 h e 60 acessos por hora. "Encerrar" não é desfeito por republicação; a limpeza diária deixa lápide em `~/Eterna/galerias/encerradas.json` (republicar dá 410, código dá 404). Arquivos em `~/Eterna/galerias/` (`<token>/`, `vendas-online.jsonl`, `consentimentos.jsonl` sem IP e sem imagem); segredo em `~/Eterna/galeria-segredo.json`.
- Chaves ficam só em `~/Eterna/*.json` com chmod 600. Nunca no código, nunca no git, nunca no navegador.
- Pastas: `~/Eterna/inbox/<dia>/` (fotos), `~/Eterna/roverpix/{raw,agg}/`, `~/Eterna/fundos-ia/` (cache Photoroom).
- Variáveis: `ETERNA_PORTA`, `ETERNA_APP_ORIGIN`, `ETERNA_PASTA`, `ETERNA_REDE`, `ETERNA_REPO` (`local`; `s3`/`azure` na fase 2), `ETERNA_PAGAMENTO` (`simulado`), `ETERNA_SEM_OPENCV` (testes: desliga OpenCV).
- Depois de mudar o agente, ele precisa ir para o Mac do Eduardo em `~/Documents/ETERNA/eterna/eterna-agente.py` e `~/Downloads/Eterna/eterna-agente.py` (o deploy faz).

## 5. Decisões já tomadas (não reabrir sem o Eduardo)

- Sem foto preta. Sessão separada pelo servidor (pausa entre cliques + rostos).
- Checkout por reconhecimento facial; QR e código como contingência.
- Checkout único (antiga Loja; Checkout, Fila, Caixa e Quiosque viraram uma tela só): rosto → fotos com ✗ e ✓ → pacote + pagamento numa tela → pronto com QR. Sem texto do tipo "quero essa" na escolha.
- Fundos de IA: no máximo 5 na loja e na galeria; Photoroom faz o recorte (chave só no agente).
- Galeria do convidado 60 dias; menores sem busca facial aberta (LGPD art. 14). Exceção da v77: grupo de escola, com consentimento do responsável e só as fotos em que o rosto da criança bate.
- Galeria por QR (v77): selfie antes de tudo, nem as compradas aparecem antes. Escola: um QR geral por grupo, impresso pela administração; mostra só as fotos em que o rosto da criança bate, com limite 0,50 (`LIMITE_MENOR`), nunca a sessão inteira (D3). Retenção das leituras de rosto no agente: 60 dias (D10), para a selfie funcionar até o fim da galeria.
- Foto avulsa online: R$ 39 (item `dig` do catálogo); "todas" pelo preço do Pacote Maracanã Mais. Total sempre `min(n × dig, todas)`, recalculado no agente.
- Checkout apartado (v77): `#loja` sem login e em tela cheia; sem volta automática por inatividade; só depois da compra a tela do QR volta sozinha à câmera, em 30 s configuráveis (5 a 120, Catálogo e preços › Checkout); botão Voltar ao início em todas as etapas; idiomas por bandeiras em SVG nas telas do cliente.
- Menus da v78 (`docs/planos/2026-10-27-menus-v78.md`): Dashboard (Bandeiras, Estoque, Semana, Fotógrafos, Vendas e caixa, Lista de vendas, Galerias online), Curadoria (Qualidade, Treino da IA, Alertas), Fotógrafo (Diário do set, Upload automático, Escala 5×2), Configurações (Repositório, Identidade, Catálogo e preços, Fundos de IA, Ajuste automático, Usuários, Permissões), Laboratório (Vestiário). Loja virou Checkout (botão "Abrir Checkout"). Saíram Fluxo, Anfitrião no set e Convidado.
- Permissões (v78, `docs/planos/2026-10-27-permissoes-v78.md`): ninguém tira de si o acesso a Usuários e Permissões, sempre existe 1 admin ativo, ninguém dá o que não tem nem edita quem tem mais acesso. Em Permissões, Ver e Alterar andam juntos. O vendedor não vê números de vendas; cancelar venda exige `financeiro.d`. Pendências de servidor e segurança: seção "Pendências para a v79" do plano.
- Confirmado pelo Eduardo (28/10): o Fotógrafo NÃO vê o Índice do fotógrafo nem o Ajuste automático (só o grupo Fotógrafo); Ajuste no grupo Configurações com a tela no módulo `set`; módulos `escala`, `laboratorio` e `financeiro` mantidos. Venda em Dinheiro no Checkout fica "aguardando caixa" até a equipe confirmar (v79). A mensagem cortada sobre o fotógrafo "passar para o..." foi descartada.
- Nuvem: AWS, preferência S3 São Paulo (sa-east-1), bucket privado, links assinados.
- Marca: manual Viva Maracanã 09/10/2026. Azul #134078 (mais peso), verde #005500, amarelo #FFB800; secundárias azul luz #307FE2, azul noite #0C2340, verde luz #43B02A, amarelo luz #FCE300, cinza museu #D9D9D6, grafite #25282A. Títulos Big Shoulders Display com tracking 100 (letter-spacing ~.1em), textos Inter. Logo branco sobre azul. Grafismos: multidão (pontos), radialidade (anéis amarelos), foco/spot (V de luz).
- Telas do cliente: 5 idiomas, responsivas (notebook, tablet, celular), quentes, que mostrem o valor do que a pessoa leva.

## 6. Regras de engenharia

- Mudança mínima e coerente com o código existente; sem dependências novas no app sem necessidade (se precisar de lib, versão fixa e, para o que o ponto usa offline, cópia local em `vendor/`).
- Nada de chave, senha, CPF ou dado de cliente em código, log, URL ou commit. Dados de cliente da Roverpix ficam no agente; o app recebe agregados.
- Texto de interface em português do Brasil; em textos para cliente, sem travessão e sem jeito de texto de IA.
- Toda tela nova precisa abrir sem erro em `testes/todas-as-telas.js`.

## 7. Testes

- `bash testes/rodar.sh` sobe um servidor local, roda todas as telas, a Loja de ponta a ponta e o que mais estiver em `testes/`. Precisa terminar com `FALHAS: 0`.
- Playwright e Chromium já estão instalados no ambiente (`require('playwright')`). Não reinstalar.
- Fontes e CDNs externos podem estar bloqueados no ambiente de teste: QR, Google Fonts. Isso não é falha do código.

## 8. Git e publicação

- Repositório `dudurezende10/eterna`, branch `main`. Commitar sempre (regra do Eduardo).
- `git pull -q origin main` antes de commitar. Conflito com o Ronaldo: manter os dois lados.
- Autor: `git -c user.name="Eduardo Rezende" -c user.email="eduardo@eduardorezende.com" commit ...`
- Mensagem em português, primeira linha com o que entrou e `(vNN)`; terminar com as linhas de atribuição que a sessão indicar (Co-Authored-By e Claude-Session).
- Linha nova em `VERSOES.md` (`| vNN | \`hash\` | resumo |`) e carimbo de versão no index.html.
