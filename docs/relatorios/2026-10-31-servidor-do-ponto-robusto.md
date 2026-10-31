# Relatório de 31/10/2026: servidor do ponto robusto (v90)

Para o Eduardo e para o Claude dele. Dia de teste ponta a ponta no notebook de teste do Maracanã (MCTNBADM041, 192.168.0.140, Tailscale `mctnbadm041` / 100.64.176.33), com o Ronaldo vendendo e imprimindo de verdade. Tudo está no `main`, commits de `1fb00ac` a `ca1c65d`. A versão é a v90 (linha em `VERSOES.md`).

## O desenho, como ficou combinado

- **Um servidor do Eterna por venue** (máquina parruda) e os **pontos** (caixas e Checkout) no Chrome, pela rede do estádio.
- **Tudo funciona sem internet.** Com internet, o servidor sobe para a nuvem as fotos vendidas, os backups e as galerias. O cliente compra e baixa pela nuvem (QR).
- **Impressão:** pelo servidor (fila única) ou pela DNP ligada no próprio ponto (`ETERNA_IMPRESSORA_POSTOS` com `local`).
- **Suporte remoto:** Eduardo e Ronaldo entram pelo Tailscale (`http://mctnbadm041:8765`).
- **Regra nova, não negociável (Ronaldo):** nada mora só no navegador. O servidor é o dono de tudo. O navegador guarda uma cópia e uma fila do que ainda não subiu.

## 1. O servidor liga sozinho, sem ninguém logado

**Problema:** em máquina corporativa (Azure AD), o Eterna rodava dentro de um usuário logado. A tarefa agendada em outro usuário nunca rodava (resultado 267011, política de logon em lote). E o "Cancelar" na pergunta do firewall gravou uma regra que **bloqueava** o Python.

**Feito:**
- `agente/instalar-servidor.ps1`, empacotado em **`agente/instalador/Eterna-Servidor.exe`**. Para refazer o `.exe`, roda-se `agente/instalador/montar.ps1`, que usa o `csc` do .NET do Windows.
- Ele cria a tarefa **"Eterna" como SYSTEM**, ao iniciar o Windows: sem login, sem senha de usuário e religando se cair. A pasta de dados continua no perfil do dono (`ETERNA_BASE`).
- Também cuida de:
  - firewall: o Python, as portas 8765 e 2121, e o desbloqueio do "Cancelar";
  - energia: não dorme e a tampa não faz nada;
  - atalho "Eterna" na área de trabalho de todos;
  - conferência no fim.
- **Testado no servidor:** sobe sozinho, nuvem ok, e **imprime na DNP rodando como sistema**. Esse era o risco principal do plano do instalador.
- O checklist (`docs/CHECKLIST-SERVIDOR.md`, passo 7) foi atualizado. O `instalar-tarefa.ps1` ficou só para máquina fora do domínio.

## 2. Checkout e selfie

- **O cliente só vê as próprias fotos** (`lojaDele`). Achado pela selfie, o Checkout mostra só as fotos em que o rosto dele aparece, nunca a sessão inteira. A fotógrafa emendou grupos diferentes sem a pausa de 20 s, e a sessão juntou 29 fotos de várias pessoas. Pelo código do recibo continua abrindo a sessão inteira.
- **Uma pessoa por vez (antifraude).** Com dois rostos de tamanho parecido na câmera (o segundo com pelo menos metade da largura do maior), a busca não roda. Rosto pequeno ao fundo (a fila) não conta.
  - A regra vale nos três lugares:
    - no navegador (`pessoas()`, `FACE_VARIAS`);
    - no servidor do ponto (`varias_pessoas`, `VARIAS_RAZAO`);
    - na nuvem (`detect_faces` antes da busca, com permissão `rekognition:DetectFaces` no template). **Publicado pelo Ronaldo no CloudShell em 31/10.**
  - Não conta como tentativa errada.
- **A selfie online dispara sozinha.** O detector (230 KB) não espera mais o modelo de reconhecimento de 38 MB, que travava no celular (`ortLoad` separado de `sfLoad`). O botão só aparece se o detector falhar.
- **QR em cima de uma foto escolhida pelo cliente**, na tela final do Checkout, como no sistema anterior. Com o balcão cheio, cada um reconhece o próprio QR (`fotoQR`, `.lj-qrfoto`).
- **`ETERNA_BUSCA_DIAS`** (padrão 1, só hoje): a selfie procura também nos dias anteriores, e as sessões desses dias entram no Checkout. Foi usado só para testar com as fotos da véspera. **No servidor de teste está em 2; em produção, tirar.**

## 3. Fila de impressão (estilo McDonald's)

**Problema:** de 7 fotos, saía só a primeira. Com `-File`, o PowerShell só põe em `-Arquivos` o primeiro de vários argumentos. E o pedido aparecia como "impresso".

**Feito:**
- A lista de fotos vai num arquivo (`-Lista`).
- A foto só conta como impressa quando **saiu da DNP** (fila do Windows vazia e impressora parada), não quando foi entregue ao Windows.
- Sem papel, sem ribbon, tampa aberta ou impressora desligada: a fila **espera e mostra o motivo**, sem pular para a próxima.
- O pedido só fica "impresso" com **todas** as fotos entregues. Se faltar uma, é erro com "X de Y".
- **Painel (Dashboard › Fila de impressão):**
  - estado real de cada DNP (`imp_monitor`, a cada 10 s);
  - **Cancelar**;
  - **Reimprimir**;
  - **Imprimir as que faltaram**.
- Rotas: `POST /impressao/acao`; o `GET /impressao/fila` agora traz `estados`.
- **Testado no servidor:** 3 de 3, depois 7 de 7 (uns 10 s por foto), e 1 de 1 rodando como sistema.

## 4. Recorte dos fundos de IA pronto antes do cliente

**Problema:** "Preparando sua foto especial..." com o cliente parado no Checkout, porque o modelo abria na primeira foto.

**Feito:**
- Os modelos abrem quando o Eterna liga.
- Em segundo plano, o servidor recorta **só as fotos que o Checkout vai mostrar com fundo** (`rec_pre_loop`, `rec_pre_escolha`; `ETERNA_PRE_RECORTE=0` desliga): as 2 primeiras da sessão (a regra publicada: fundo de IA em até 2 fotos por sessão, até 3 fundos cada) e as 2 primeiras de cada pessoa da sessão, agrupando os rostos, porque achado pela selfie o cliente vê só as fotos dele. Nunca todas: 15 fotos em vários fundos virariam 75 na tela (Ronaldo). O que escapar, o Checkout pede na hora.
- O pedido ao vivo do Checkout passa na frente.
- O progresso aparece em `/status` › `recorte.antecipado`.
- **Medido no notebook de teste: cerca de 5,2 s por foto.**

**Ainda aberto:** o Ronaldo quer o recorte e a aplicação do fundo em nível profissional, e o tempo menor. É o próximo item de qualidade: revisar em fotos reais do Tour e medir no servidor definitivo.

## 5. Vendas e estado da equipe no servidor (nada só no navegador)

### Vendas
- Cada evento da venda (`criar`, `pagar`, `cancelar`, `impressao`, `rolo`; contrato no plano v83, seção G) sobe **na hora** por `POST /ponto/eventos`.
- O servidor grava em **`~/Eterna/ponto/vendas.db`** (SQLite, `synchronous=full`, `idem` único: repetição não conta duas vezes) e só então confirma.
- O navegador tira da fila só o que foi confirmado. Sem rede, segura e manda depois (`pontoFlush`).

### Estado da equipe
- **`~/Eterna/ponto/estado.db`**, um registro por item: `GET /ponto/docs/revs`, `GET /ponto/docs?col=`, `POST /ponto/docs`.
- O app liga o **banco plugável que já existia** (`state.db`, interface coleção/doc/onSnapshot) ao servidor (`agenteDb()`). Tudo o que já gravava nele passa a gravar no servidor sem mudar as telas:
  - usuários e permissões;
  - registro de quem mudou o quê;
  - diário;
  - treino da IA;
  - venue;
  - revisões;
  - bandeiras;
  - função do dia.
- O resto do `SIM` sobe item por item pela coleção `sim`:
  - preços e catálogo;
  - estoque de rolos;
  - descartes, ajustes de foto e fotos inválidas;
  - bandeiras e uso;
  - fundos;
  - cortesias (só acrescenta).
- Ficam de fora só o que já tem dono no servidor: sessões, galerias (manifesto), vendas (eventos) e a fila de envio.
- **Regras:**
  - a primeira conexão sobe o que só existia naquele navegador;
  - mudança local ainda não enviada não é atropelada;
  - o que outro computador apagou some aqui também.
- **Testado:** um navegador apagado por inteiro voltou com usuários, ajustes, estoque e preço. A mudança de "outro caixa" chegou em segundos.

### Backup e métricas
- **Backup na nuvem:** S3, `backup/<computador>/`. Os dois bancos, o resumo do dia e as sessões, **a cada 2 min se mudou**, mais uma cópia por dia. Rosto nenhum vai para o backup. Funcionou no servidor (`/status` › `backup`).
- **Métricas do dia, guardadas para sempre:** `~/Eterna/ponto/metricas/AAAA-MM-DD.json`, refeitas a cada 10 min para hoje e ontem; `GET /metricas/dia?de=&ate=`. Trazem:
  - fotos, fotos com rosto e rostos;
  - sessões e sessões com venda (conversão);
  - vendas, faturamento, ticket médio, fotos vendidas (normais e de IA) e impressões;
  - vendas online;
  - tudo por fotógrafo, vendedor, ponto e forma de pagamento.
- No app: **Painel › "Servidor do ponto · todos os caixas"** (`srvMetPainel`), no período escolhido. É assim que quem está fora (Miami) vê as vendas de todos os caixas pelo Tailscale.

## 6. Outros ajustes

- `instalar-vigia.ps1` cria o atalho "Eterna" (`abrir-eterna.cmd`), para máquina que roda no usuário.
- Ronaldo: 1.000 vendas por dia, o ano todo. Isso dá uns 5 mil eventos por dia e 1,8 milhão por ano. O SQLite aguenta folgado, e o resumo de cada dia fica pronto em arquivo.

## Para o Eduardo decidir ou conferir

1. **Réplica das vendas no DynamoDB** (a tabela da galeria já existe): o servidor manda cada venda logo depois de gravar. Com ela, as vendas aparecem de qualquer lugar sem Tailscale. Custo de centavos por mês. Precisa de uma rota nova na nuvem e de publicar pelo CloudShell. Hoje o backup a cada 2 min cobre a perda do servidor.
2. **Login de verdade:** hoje o código de acesso aparece na própria tela (protótipo). O Ronaldo quer ligar a um e-mail real, com usuários de verdade.
3. **Tela de pagamentos pendentes:** ainda lê do navegador. A venda já está no banco do servidor, mas a tela ainda não mostra a visão do servidor.
4. **`ETERNA_BUSCA_DIAS=2`** no `nuvem.env` do servidor de teste: tirar antes de operar.
5. **Atualização do servidor:** hoje, para pegar código novo, é preciso reiniciar a tarefa como administrador. O plano do instalador (`docs/planos/2026-10-30-instalador-do-servidor.md`) prevê versão liberada por tag e troca em janela parada.
6. **Chaves da AWS:** o computador do Ronaldo tem uma chave **root** de outra conta (148761667207). Não foi usada. Vale tirar.

## Onde está cada coisa (para o Claude)

| Assunto | Onde |
|---|---|
| Instalador do servidor | `agente/instalar-servidor.ps1`, `agente/instalador/` |
| Uma pessoa por vez | `varias_pessoas`, `VARIAS_RAZAO` (agente); `pessoas`, `FACE_VARIAS` (app); `varias_pessoas` (`servidor/galeria-nuvem/app.py`), teste em `teste_local.py` |
| Fotos só do cliente | `lojaDele`, `state.kiosk.so` |
| QR sobre a foto | `fotoQR` na tela `done` de `vQuiosque` |
| Fila de impressão | `IMP_PS1`, `imprimir_fila`, `imp_acao`, `imp_monitor` (agente); `vImpFila`, `if-acao` (app) |
| Recorte antecipado | `rec_pre_loop`, `REC_PRE` |
| Vendas no servidor | `ev_receber`, `vendas_db` (agente); `pontoFlush` (app) |
| Estado da equipe | `estado_db`, `estado_gravar`, `estado_col` (agente); `agenteDb`, `simAplica`, `simSobe`, `dbLigar` (app) |
| Métricas e backup | `metricas_dia`, `metricas_loop`, `backup_loop` (agente); `srvMetPainel` (app) |
