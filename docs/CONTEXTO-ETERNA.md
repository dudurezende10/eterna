# Contexto do Eterna para os agentes

Leia este arquivo inteiro antes de qualquer tarefa. Ele é a memória comum da esteira (planejador, programador, testador, segurança, deploy). Se algo aqui estiver desatualizado, o agente que perceber atualiza este arquivo no mesmo commit.

## 1. O que é

Eterna é o sistema de captura, validação, venda e entrega de fotos do Tour do Maracanã (Viva Maracanã, Grupo Viva, operação da Maracatour). Substitui o Roverpix a partir de 01/12/2026 e depois vira produto white label (SaaS + armazenamento) para outros venues no Brasil e nos EUA.

- Dono do produto: Eduardo Rezende (Dudu), Diretor Criativo do Tour. Decide produto, marca e UX. Escreve em português, muitas vezes por voz (transcrição com erros: "Hoverpix" = Roverpix, "Clássius" = Klássius).
- TI: Ronaldo Santos (Maracatour). Também faz commits no repositório (reconhecimento facial OpenCV YuNet/SFace, teste de carga). Sempre `git pull` antes de commitar.
- Chefe/dono da operação: Bruno.
- Escala de hoje: ~3.000 fotos/dia, 3 a 8 fotógrafos (Carlos, Marinara, Samuel, Yago, Márcio, Klássius, Sandessa), 4 pontos de campo, turistas do mundo todo. Custo de operação parada: ~R$ 25.000/dia.
- Premissas não negociáveis: local primeiro (offline-first), zero toque no set (o fotógrafo só fotografa), nada se perde (original sempre guardado, exclusão registrada), um domínio e um login (eterna.photo, e-mail + código, permissão por módulo C/R/U/D).
- Pensar do centavo aos milhões: cada decisão precisa funcionar num ponto com um notebook e escalar para muitos venues, milhões de fotos e picos de dia de jogo.

## 2. Peças e arquivos

| Peça | Arquivo | Notas |
| --- | --- | --- |
| App web (todos os perfis) | `index.html` | arquivo único, HTML + CSS + JS puro, ~570 KB. Publicado em https://eterna.photo (GitHub Pages, branch `main`) |
| Agente do ponto | `agente/eterna-agente.py` | Python stdlib (OpenCV opcional, do Ronaldo). Roda no computador do ponto: cartão, FTP, biblioteca, Roverpix, Photoroom. HTTP em 127.0.0.1:8765 e serve o app (proxy de `ETERNA_APP_ORIGIN`) |
| Lançador do agente (Mac) | `agente/Eterna.command` | mata o agente antigo na porta 8765, abre o novo e o navegador |
| Lançador (Windows) | `agente/iniciar-eterna.bat` | do Ronaldo |
| Documentação técnica | `docs/DOCUMENTACAO-TECNICA.md` | arquitetura, modelo de dados, fluxos |
| Versões | `VERSOES.md` | uma linha por versão (vNN, commit, o que entrou) |
| Testes | `testes/` | `testes/rodar.sh` roda tudo |
| Fundos de IA | `img/bg-*.jpg` | metadados em `DATA.backgrounds` no index.html |
| Marca | `img/brand/viva-maracana-{white,azul}.png` | manual: `VENUES.maracana` no index.html |

## 3. Como o index.html é organizado

- `const DATA={...}` embutido no topo (dados do Roverpix de 07 a 15/10, catálogo, fundos, pontos). Depois `applyLive(j)` troca pelos dados ao vivo da Roverpix vindos do agente.
- `state` (memória da tela), `SIM` (estado simulado da operação, `localStorage` `eterna.sim.v1`, salvar com `saveSim()`).
- `render()` monta a tela atual: `VIEWFN[state.view]()` devolve HTML em template string. Não há framework; cada render reescreve o `#main`.
- Navegação: `VIEWS` (menu), `MODULES` (permissões por módulo), `MODULE_OF[view]`, `canView(v)`, `go(v)`.
- Cliques: um único `document.addEventListener('click',...)` com `switch(a)` sobre `data-act`. Novo botão = `data-act="algo"` + `case 'algo':` no switch. Ações que gravam entram em `WRITE_OPS` com a operação exigida.
- Fotos: `phStyle(id)` devolve as variáveis CSS (`--img`, `--bs`, `--bp`, `--flt` dos ajustes). Fotos de exemplo vêm de sprites (`sprites/cNN.webp`); fotos reais do agente têm id `ag_<id>` e `UP[id].src` = `<agente>/thumb/<id>`; `bigStyle(id)` usa o original (`/file/<id>`).
- Sessões: `demoSessions()`, `sessionObj(card)`, `simOf(card)` (estado da sessão em `SIM.sessions[card]`), `revSessions()` (amostra + Roverpix ao vivo + fotos casadas).
- Loja (view `quiosque`): `vQuiosque()`, etapas `state.kiosk.step` = code → review → cart → done; `lojaItems`, `lojaCart`, `lojaPay`, `lojaReset`. Classes CSS com prefixo `lj-`.
- Galeria do convidado (view `convidado`): `vConvidado()`, `vGuestAI()`, `vGuestSelfie()`, `guestAICard()`.
- Idiomas das telas do cliente: `T('chave',...args)` com o dicionário `I18N` (pt, en, es, fr, de), seletor `langPick()`. Todo texto novo de tela de cliente entra no `I18N` nas 5 línguas.
- Depuração/testes: `window.ETERNA` expõe `state`, `render`, `revSessions`, `demoSessions`, `photoCanvas` e outros.
- Carimbo de versão: duas ocorrências a atualizar a cada versão: `title="Eterna vNN · dd/mm hh:mm"` e `powered by <b>Eterna</b> · vNN`.

## 4. Agente do ponto (eterna-agente.py)

- Endpoints GET: `/status`, `/events?since=`, `/biblioteca`, `/thumb/<id>`, `/file/<id>`, `/roverpix/status|data`, `/photoroom/status|result/<n>`, `/ftp-remoto/status`, `/metricas`.
- Endpoints POST com chave (Roverpix, Photoroom, FTP remoto): só aceitam origem `http://127.0.0.1:8765` ou `localhost`.
- Chaves ficam só em `~/Eterna/*.json` com chmod 600. Nunca no código, nunca no git, nunca no navegador.
- Pastas: `~/Eterna/inbox/<dia>/` (fotos), `~/Eterna/roverpix/{raw,agg}/`, `~/Eterna/fundos-ia/` (cache Photoroom).
- Variáveis: `ETERNA_PORTA`, `ETERNA_APP_ORIGIN`, `ETERNA_PASTA`, `ETERNA_REDE`.
- Depois de mudar o agente, ele precisa ir para o Mac do Eduardo em `~/Documents/ETERNA/eterna/eterna-agente.py` e `~/Downloads/Eterna/eterna-agente.py` (o deploy faz).

## 5. Decisões já tomadas (não reabrir sem o Eduardo)

- Sem foto preta. Sessão separada pelo servidor (pausa entre cliques + rostos).
- Checkout por reconhecimento facial; QR e código como contingência.
- Loja única (Checkout, Fila, Caixa e Quiosque viraram um menu): rosto → fotos com ✗ e ✓ → pacote + pagamento numa tela → pronto com QR. Sem texto do tipo "quero essa" na escolha.
- Fundos de IA: no máximo 5 na loja e na galeria; Photoroom faz o recorte (chave só no agente).
- Galeria do convidado 60 dias; menores sem busca facial (LGPD art. 14).
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
