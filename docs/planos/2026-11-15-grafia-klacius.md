# Grafia do nome: Klacius (correção de 15/11/2026)

Pedido do Eduardo: o nome certo do fotógrafo é com C, **Klacius**, como a câmera dele grava no autor (EXIF Artist). O Eterna mostrava "Klassius". Testes: `testes/fila_fotografo_agente.py` (bloco 7b), `testes/fila-fotografo.js` (bloco "grafia"), `testes/sessoes_agente.py` e `testes/sessoes-upload.js` (blocos "dono").

## Como era

- Nome de tela "Klassius" em `DATA.people` e "Klássius" no cadastro padrão de usuários (`SEED_USERS`).
- Chave interna `klassius`: login do FTP, e-mail `klassius@eterna.photo`, sessões, vendas, função do dia e históricos gravados no servidor.
- O apelido da grafia com C só existia para a Roverpix (`KEY_ALIAS` no app, um mapa solto dentro de `rv_key` no agente). O `ff_quem`, que decide o fotógrafo da foto pelo autor ou pelo dono gravado na câmera, comparava o nome com os cadastrados sem apelido. Três fotos com autor "Klacius" ficaram em "Sem fotógrafo".

## Decisão

1. O nome que aparece é Klacius, em toda tela.
2. A chave interna continua `klassius`. Trocar a chave pediria migração de sessões, vendas e métricas e quebraria o envio das câmeras (login do FTP). Não se renomeia chave, login nem e-mail.
3. Uma regra só de apelido, de nome escrito para chave do cadastro:
   - agente: `FOTOGRAFO_APELIDO` e `fotografo_chave(nome)` (sem acento, minúsculas; vale o nome inteiro ou o primeiro nome, então "Klacius Ank Guarino" serve). Usam a regra: `ff_quem` (origem, autor e dono), `rftp_origem` (subpasta do FTP do estádio), a subpasta do login compartilhado do FTP embutido e `rv_key` (Roverpix).
   - O primeiro nome só vale para o autor e o dono gravados na câmera e para a Roverpix. Nome de pasta e origem usam `fotografo_chave(nome, inteiro=True)`: só o nome inteiro é apelido, para não afrouxar a regra B1 (pasta "Klacius qualquer coisa" continua `ftp-estadio`; pasta "klacius" vira `klassius`).
   - app: `KEY_ALIAS`, que já valia para a Roverpix (`aliasLive`), entra em `keyByName`, que segue a mesma leitura do agente: o primeiro nome sem pontuação ("Klacius," serve) comparado com o apelido, com o nome de tela e com a chave ("Klassius Guarino", a grafia antiga com sobrenome, também resolve). Por ele passam `libWho`, `camWho` e `impWho`, ou seja, os chips da Biblioteca e de Minhas fotos e o fotógrafo da sessão quando o servidor não informou.
   - Grafia nova de alguém entra nesses dois mapas. Nunca vira chave nova.
4. Cadastro já gravado com o nome padrão antigo ("Klassius" ou "Klássius", exatamente, e chave `klassius`): o agente acerta no servidor na partida (`usuarios_grafia`, pelo `estado_gravar`, então os navegadores recebem pela sincronização). A cópia do aparelho é acertada por `nomeTelaCerto` no `migrateUser`, sem gravar no servidor. Nome que alguém editou não é tocado.
   - A troca fica registrada no servidor: o cadastro ganha `updatedBy: "servidor"` e `updatedAt`, e o histórico (`usuarios_log`) ganha uma linha com `por: "servidor"`, `acao: "alterar"`, quando, de, para e o motivo. O id da linha é fixo por cadastro, então não duplica.
   - `usuarios_grafia` roda no `main`, antes de o servidor HTTP abrir e fora de thread, porque lê e grava sem uma trava única. Falha sobe para o `main`, que registra no console.
   - O mapa `NOME_TELA_ANTIGO` existe nos dois arquivos (agente e `index.html`), com comentário cruzado: muda num, muda no outro.

## O que muda sozinho e o que não muda

- Biblioteca e Minhas fotos: o fotógrafo de cada foto é calculado na leitura (`libWho`, com o autor que o `/biblioteca` devolve). As fotos já recebidas com autor "Klacius" passam para o nome dele ao carregar a versão nova, sem reenvio.
- Fotos novas: a sessão já abre no nome dele (`ff_quem`), na Fila do fotógrafo, no Upload, na Qualidade e nas métricas.
- Sessões já fechadas: o fotógrafo da sessão é gravado na chegada da foto (`_sess_add`, arquivo `~/Eterna/ponto/sessoes/AAAA-MM-DD.json`) e copiado para a sessão do app (`SIM.sessions[card].key`). A correção delas está na seção seguinte.

## Sessões antigas sem fotógrafo (aprovado pelo Eduardo em 15/11)

Regra: sessão fechada sem fotógrafo cujas fotos resolvem todas para o mesmo fotógrafo cadastrado, pela regra do `ff_quem` (primeiro a origem, depois o autor e o dono gravados na câmera, tudo por `fotografo_chave`), recebe a chave dele. Fotos de donos diferentes, alguma foto sem dono ou sem registro no índice: fica como está. Sessão que já tem fotógrafo, aberta ou removida nunca é tocada.

- Agente: `sess_dono_corrigir()`, chamada no fim do `sess_carregar` (partida), antes de gravar os arquivos e antes de o servidor HTTP abrir. Dentro de `try`: falha vira uma linha no console e o agente sobe do mesmo jeito.
- Janela: as sessões em memória, de hoje e de ontem. São os dias que o `metricas_loop` refaz a cada 10 min. O `/sessoes` entrega hoje sempre e ontem só com `?ontem=1` (ou com `ETERNA_BUSCA_DIAS` de 2 ou mais). Dia mais antigo não é corrigido: refazer o resumo dele perderia números que já saíram por prazo (rostos), e o navegador não recebe mais essas sessões.
- Registro no servidor: a sessão ganha `dono_corrigido = {em, por: "servidor", de: null, para: <chave>, fonte_antes, motivo}`, `fotografo` e `fonte` novos e `rev` novo. O `motivo` é o caminho que valeu de verdade, dito pelo `ff_quem_como`: `origem`, `autor_da_camera` ou `dono_da_camera`; quando as fotos da sessão resolveram por caminhos diferentes, os nomes vêm juntos por `+` (ex.: `autor_da_camera+dono_da_camera`). A `fonte` nova é a via da primeira foto (cartão ou ftp). Vai para o arquivo do dia e para o backup. Sem dado de cliente.
- Resumo do dia: `metricas_dia` lê o arquivo de sessões, então a sessão, as fotos e a venda dela passam a somar no fotógrafo na próxima rodada do `metricas_loop` (a primeira é logo na partida). Vale também para sessão já vendida: a venda sai de "sem fotógrafo" e entra na estatística dele, que é o correto.
- App: `srvDono(x)` no `srvPull`. A cópia do aparelho (`SIM.sessions[card].key`) segue o servidor só quando a sessão traz `dono_corrigido` com `para` igual ao `fotografo`. Sem a marca, sessão fechada continua sem mudar. Vale também para sessão paga (a venda fica como está, só passa ao nome dele); fotógrafo que a tela não conhece não entra. A Qualidade mostra a sessão no nome dele depois de recarregar.
- App, sessões de ontem: o `srvPull` de sempre só recebe hoje, então a correção de ontem não chegava. `srvOntem()` pede `/sessoes?desde=0&ontem=1` uma vez a cada partida do agente (`gen` novo, que é quando o servidor corrige) e na carga da página, e aplica só o `srvDono` nas sessões de ontem: nada de ontem entra no painel do Upload nem é materializado. Falha tenta de novo depois de 1 minuto. Com isso a Qualidade (Ontem, 7 dias) e os números por fotógrafo da tela batem com o resumo do dia do servidor.
- Travas: `sess_lock`, `lock` e `sess_lock` de novo, uma de cada vez; `ff_lock` não entra.
- Idempotente: a sessão corrigida já tem fotógrafo e não entra de novo.
- Medida (teste): 3.000 sessões sem fotógrafo com 15.000 fotos em 0,04 s. Não lê arquivo.

Fica como está, de propósito: `ponto`, `funcao` e a regra dos cliques de IA da sessão fechada (foram decididos na chegada), a chave da trilha (`k`) e a nota de Qualidade já gravada para a sessão (`reviews/<card>` guarda a chave do fotógrafo no momento da nota).

## Critérios de aceite

1. Fotógrafos, Qualidade, escala, Estatísticas e Usuários mostram "Klacius"; nenhuma tela mostra "Klassius" ou "Klássius".
2. `ff_quem` com autor "Klacius", "KLACIUS", "Klácius" ou "Klacius Ank Guarino" devolve `klassius`; o dono da câmera também; autor desconhecido e nome parecido ("Klaus") continuam sem fotógrafo.
3. `PHOTOGRAPHERS` segue com `klassius`; não existe chave `klacius`.
4. `usuarios_grafia` troca só o nome padrão antigo da chave `klassius`, mantém chave e e-mail, não toca em nome editado nem em outra chave, e rodar de novo não muda nada.
5. Pasta "Klacius qualquer coisa" continua `ftp-estadio`; pasta "klacius" vira `klassius`. A troca do cadastro aparece no `usuarios_log` com `por: "servidor"`.
6. No app, `libWho` leva o autor "Klacius" (e a subpasta `klacius`) para `klassius`; autor desconhecido fica em "Sem fotógrafo".
7. Sessão fechada sem fotógrafo com todas as fotos de "Klacius" vira `klassius` na partida, com `rev` novo e `dono_corrigido`; mista, com foto sem dono ou sem registro fica; com fotógrafo não muda; segunda rodada e outra partida não mudam nada; o resumo do dia soma a sessão e a venda no nome dele (`testes/sessoes_agente.py`, bloco "dono"). No app, a sessão corrigida passa ao nome dele na cópia do aparelho e na Qualidade; sem a marca não muda (`testes/sessoes-upload.js`, bloco "dono").
