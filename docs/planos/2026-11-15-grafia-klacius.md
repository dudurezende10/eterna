# Grafia do nome: Klacius (correção de 15/11/2026)

Pedido do Eduardo: o nome certo do fotógrafo é com C, **Klacius**, como a câmera dele grava no autor (EXIF Artist). O Eterna mostrava "Klassius". Testes: `testes/fila_fotografo_agente.py` (bloco 7b) e `testes/fila-fotografo.js` (bloco "grafia").

## Como era

- Nome de tela "Klassius" em `DATA.people` e "Klássius" no cadastro padrão de usuários (`SEED_USERS`).
- Chave interna `klassius`: login do FTP, e-mail `klassius@eterna.photo`, sessões, vendas, função do dia e históricos gravados no servidor.
- O apelido da grafia com C só existia para a Roverpix (`KEY_ALIAS` no app, um mapa solto dentro de `rv_key` no agente). O `ff_quem`, que decide o fotógrafo da foto pelo autor ou pelo dono gravado na câmera, comparava o nome com os cadastrados sem apelido. Três fotos com autor "Klacius" ficaram em "Sem fotógrafo".

## Decisão

1. O nome que aparece é Klacius, em toda tela.
2. A chave interna continua `klassius`. Trocar a chave pediria migração de sessões, vendas e métricas e quebraria o envio das câmeras (login do FTP). Não se renomeia chave, login nem e-mail.
3. Uma regra só de apelido, de nome escrito para chave do cadastro:
   - agente: `FOTOGRAFO_APELIDO` e `fotografo_chave(nome)` (sem acento, minúsculas; vale o nome inteiro ou o primeiro nome, então "Klacius Ank Guarino" serve). Usam a regra: `ff_quem` (origem, autor e dono), `rftp_origem` (subpasta do FTP do estádio), a subpasta do login compartilhado do FTP embutido e `rv_key` (Roverpix).
   - app: `KEY_ALIAS`, que já valia para a Roverpix (`aliasLive`), entra em `keyByName`. Por ele passam `libWho`, `camWho` e `impWho`, ou seja, os chips da Biblioteca e de Minhas fotos e o fotógrafo da sessão quando o servidor não informou.
   - Grafia nova de alguém entra nesses dois mapas. Nunca vira chave nova.
4. Cadastro já gravado com o nome padrão antigo ("Klassius" ou "Klássius", exatamente, e chave `klassius`): o agente acerta no servidor na partida (`usuarios_grafia`, pelo `estado_gravar`, então os navegadores recebem pela sincronização). A cópia do aparelho é acertada por `nomeTelaCerto` no `migrateUser`, sem gravar no servidor. Nome que alguém editou não é tocado.

## O que muda sozinho e o que não muda

- Biblioteca e Minhas fotos: o fotógrafo de cada foto é calculado na leitura (`libWho`, com o autor que o `/biblioteca` devolve). As fotos já recebidas com autor "Klacius" passam para o nome dele ao carregar a versão nova, sem reenvio.
- Fotos novas: a sessão já abre no nome dele (`ff_quem`), na Fila do fotógrafo, no Upload, na Qualidade e nas métricas.
- Sessões já fechadas: o fotógrafo da sessão é gravado na chegada da foto (`_sess_add`, arquivo `~/Eterna/ponto/sessoes/AAAA-MM-DD.json`) e copiado para a sessão do app (`SIM.sessions[card].key`). Sessão fechada sem fotógrafo continua assim na Qualidade e no resumo do dia ("sem fotógrafo"). Não foi feita migração.

## Pendente (decisão do Eduardo)

Corrigir as sessões antigas dele que ficaram sem fotógrafo. Caminho proposto, pequeno e no servidor: na carga das sessões (`sess_carregar`), sessão sem fotógrafo cujas fotos têm todas o autor ou dono resolvido para o mesmo cadastrado recebe essa chave, com `rev` novo para os navegadores atualizarem a cópia, e o resumo do dia é refeito. Precisa de revisão antes, porque sessão fechada hoje não muda (exceto LGPD) e o resumo do dia soma por fotógrafo.

## Critérios de aceite

1. Fotógrafos, Qualidade, escala, Estatísticas e Usuários mostram "Klacius"; nenhuma tela mostra "Klassius" ou "Klássius".
2. `ff_quem` com autor "Klacius", "KLACIUS", "Klácius" ou "Klacius Ank Guarino" devolve `klassius`; o dono da câmera também; autor desconhecido e nome parecido ("Klaus") continuam sem fotógrafo.
3. `PHOTOGRAPHERS` segue com `klassius`; não existe chave `klacius`.
4. `usuarios_grafia` troca só o nome padrão antigo da chave `klassius`, mantém chave e e-mail, não toca em nome editado nem em outra chave, e rodar de novo não muda nada.
5. No app, `libWho` leva o autor "Klacius" (e a subpasta `klacius`) para `klassius`; autor desconhecido fica em "Sem fotógrafo".
