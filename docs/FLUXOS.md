# Eterna: fluxos do sistema

Como o Eterna funciona hoje, passo a passo, com cada bifurcação. Base: código da v91 (commit `e7833a6`), mapeado por leitura em 04/11/2026, sem rodar o sistema. Onde documento e código divergem, vale o código, e a divergência fica listada no próprio fluxo.

**Quem mudar um fluxo atualiza o diagrama no mesmo commit.** A documentação técnica continua em `DOCUMENTACAO-TECNICA.md`. O login futuro está em `planos/2026-11-04-login-real-e-dominio.md`.

Termos: **servidor** é o agente Eterna no venue; **nuvem** é a API da galeria na AWS; **Checkout** é a tela do cliente; **Posto de venda** e **Caixa** são as telas da equipe.

## Índice

| # | Fluxo | Parte |
|---|---|---|
| 1 | [Visão geral da plataforma](#1-visão-geral-da-plataforma) | Visão geral |
| 2 | [Entrada de fotos](#2-entrada-de-fotos) | Da câmera até a foto pronta |
| 3 | [Pipeline depois da chegada](#3-pipeline-depois-da-chegada) | Da câmera até a foto pronta |
| 4 | [Sessões por tempo e rosto](#4-sessões-por-tempo-e-rosto) | Da câmera até a foto pronta |
| 5 | [Validação, correção, olhos fechados, ajuste automático e fila do fotógrafo](#5-validação-correção-olhos-fechados-ajuste-automático-e-fila-do-fotógrafo) | Da câmera até a foto pronta |
| 6 | [Recorte antecipado e fundos de IA](#6-recorte-antecipado-e-fundos-de-ia) | Da câmera até a foto pronta |
| 7 | [Encontrar as fotos](#7-encontrar-as-fotos) | Do cliente até a foto entregue |
| 8 | [Checkout](#8-checkout) | Do cliente até a foto entregue |
| 9 | [Pagamento](#9-pagamento) | Do cliente até a foto entregue |
| 10 | [Fila de impressão](#10-fila-de-impressão) | Do cliente até a foto entregue |
| 11 | [Galeria online e compra pela nuvem](#11-galeria-online-e-compra-pela-nuvem) | Do cliente até a foto entregue |
| 12 | [Exclusão LGPD](#12-exclusão-lgpd) | Do cliente até a foto entregue |
| 13 | [Login e permissões hoje](#13-login-e-permissões-hoje) | Plataforma e operação |
| 14 | [Onde cada dado mora e como sincroniza](#14-onde-cada-dado-mora-e-como-sincroniza) | Plataforma e operação |
| 15 | [O que sobe para a nuvem](#15-o-que-sobe-para-a-nuvem) | Plataforma e operação |
| 16 | [Atualização do programa](#16-atualização-do-programa) | Plataforma e operação |
| 17 | [Instalação do servidor](#17-instalação-do-servidor) | Plataforma e operação |
| 18 | [Métricas e relatórios](#18-métricas-e-relatórios) | Plataforma e operação |
| 19 | [Ciclo de vida de uma foto](#19-ciclo-de-vida-de-uma-foto) | Plataforma e operação |

## Visão geral

### 1. Visão geral da plataforma

Mostra as peças do Eterna na v91 e o que cada uma conversa com a outra. Serve para localizar onde cada coisa roda antes de ler os demais fluxos.

```mermaid
flowchart TB
  subgraph CAMERAS["Câmeras e fotógrafos"]
    CAM["Câmera com envio por FTP"]
    CARTAO["Cartão de memória"]
  end

  subgraph PONTOS["Pontos de venda na rede do venue"]
    CAIXA["Caixa no Chrome"]
    CHECKOUT["Checkout do cliente no Chrome"]
    DNPLOCAL["Impressora DNP ligada no próprio ponto"]
  end

  subgraph VENUE["Servidor do venue"]
    TAREFA["Tarefa do Windows e vigia"]
    AGENTE["Programa Eterna na porta 8765"]
    RECEBE{"Por onde a foto entra?"}
    DISCO[("Disco: fotos originais, miniaturas e rostos")]
    BANCOS[("Bancos: vendas, estado da equipe e fila da nuvem")]
    DNPSRV["Impressoras DNP ligadas no servidor"]
  end

  subgraph NUVEM["Nuvem"]
    SITE["Site eterna.photo com o app"]
    S3[("Armazenamento S3: alta, vitrine e backup")]
    API["API da galeria"]
    DYNAMO[("Banco da galeria")]
    REK["Busca de rosto na nuvem"]
    GITHUB["GitHub: versões do programa"]
  end

  subgraph EXTERNOS["Serviços externos opcionais"]
    ROVER["Roverpix: relatórios do sistema atual"]
    PHOTOROOM["Photoroom: recorte em modo opcional"]
  end

  subgraph CLIENTE["Cliente fora do venue"]
    CELULAR["Celular com QR ou código"]
  end

  subgraph SUPORTE["Suporte remoto"]
    TAILSCALE["Equipe pelo Tailscale"]
    ACESSOREMOTO["Área de trabalho remota"]
  end

  CAM -->|"FTP"| RECEBE
  CARTAO -->|"inserido no servidor"| RECEBE
  RECEBE -->|"FTP do próprio Eterna, porta 21 ou 2121"| AGENTE
  RECEBE -->|"pasta de outro servidor FTP na mesma máquina"| AGENTE
  RECEBE -->|"outro servidor FTP da rede, buscado pelo Eterna"| AGENTE
  RECEBE -->|"cartão"| AGENTE
  TAREFA -->|"liga e religa"| AGENTE
  AGENTE --> DISCO
  AGENTE --> BANCOS
  CAIXA -->|"telas, vendas e estado"| AGENTE
  CHECKOUT -->|"selfie, escolha e venda"| AGENTE
  AGENTE -->|"terminal usa impressora do servidor"| DNPSRV
  CAIXA -->|"terminal marcado como local"| DNPLOCAL
  SITE -->|"app buscado e guardado na memória"| AGENTE
  AGENTE -->|"todas as fotos em duas versões e backup"| S3
  AGENTE -->|"galerias"| API
  GITHUB -->|"versão liberada do programa"| TAREFA
  API --> DYNAMO
  API --> REK
  REK -->|"lê a versão alta"| S3
  CELULAR -->|"abre o app"| SITE
  CELULAR -->|"galeria e selfie"| API
  CELULAR -->|"foto por link temporário"| S3
  AGENTE -->|"relatórios a cada 5 min"| ROVER
  AGENTE -->|"só no modo Photoroom"| PHOTOROOM
  TAILSCALE -->|"telas da equipe"| AGENTE
  ACESSOREMOTO --> VENUE
```

**O que funciona sem internet e o que não**

| Função | Situação sem internet | Condição |
|---|---|---|
| Receber fotos pelo FTP, pasta vigiada, cartão ou FTP da rede local | Funciona | A rede local precisa estar de pé |
| Ler rostos e montar sessões | Funciona | Os modelos precisam já estar no disco; a primeira carga deles vem do site |
| Selfie no Checkout | Funciona | A busca roda no servidor |
| Abrir o app em um ponto | Funciona com condição | O servidor precisa ter buscado o app desde que ligou. Servidor reiniciado sem internet responde `app_indisponivel` |
| Tela já aberta | Funciona | Não depende de recarregar |
| Login da equipe | Funciona | Hoje o código é gerado no navegador |
| Registrar venda | Funciona | A maquininha é avulsa; a conexão dela é não confirmado neste código |
| Imprimir | Funciona | No servidor ou na DNP do ponto |
| Fundo de IA com recorte local (modo padrão) | Funciona | Precisa do recorte instalado |
| Fundo de IA pelo Photoroom | Não funciona | Serviço externo |
| Painel "Servidor do ponto" | Funciona | Lê os bancos locais |
| Dados da Roverpix | Não funciona | Fica o último dado baixado |
| Enviar fotos para a nuvem | Funciona com condição | Fila espera se o servidor ligou com internet. Se ligou sem internet, ver a seção 4 |
| Publicar galeria na nuvem | Fica na fila | Sobe sozinha quando a conexão volta |
| Backup | Não funciona | Tenta de novo a cada 2 minutos; não acumula versões |
| Cliente abrir galeria que já subiu | Funciona | Depende da internet do cliente, não da do venue |
| Cliente abrir galeria que ainda não subiu | Não funciona | Até a fila andar |
| Suporte remoto | Não funciona | Tailscale precisa de internet |
| Atualizar o programa | Não funciona | Fica a versão do disco |

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Porta das telas | 8765, ou `ETERNA_PORTA`; ouve a rede só com `ETERNA_REDE`, que o vigia liga | `PORT`, `main`, `eterna-vigia.ps1 Liga` |
| Porta do FTP próprio | Tenta 21, depois 2121; `ETERNA_FTP_PORTA` só em testes. Nenhuma livre: FTP não abre | `ftp_server` |
| Pasta vigiada | Só com `ETERNA_PASTA`; retoma o que chegou nas últimas 12 h (`ETERNA_PASTA_RETOMAR`) | `pasta_vigiada` |
| Impressão por terminal | `ETERNA_IMPRESSORA_POSTOS`: terminal listado usa as DNPs dele; valor `local` imprime pelo navegador; fora da lista usa qualquer livre | `IMP_POSTOS`, `IMP_LOCAIS`, `imp_destinos` |
| De onde vem o app | Do `ETERNA_APP_ORIGIN` (padrão eterna.photo), renovado a cada 60 s, guardado só na memória; sem cópia e sem resposta: erro 502 | `H.app`, `app_cache` |
| Modo do recorte | Padrão local; Photoroom só com `fundos-modo.json` | `fundos_modo` |
| Roverpix | A cada 300 s, janela de 30 dias, só com chave | `rover_loop`, `ROVER_EVERY`, `ROVER_DAYS` |
| Suporte remoto hoje | Tailscale. A VPN do FortiGate é desenho-alvo, não está no código | `preparar-tailscale.ps1`; `docs/pesquisa/2026-11-02-eterna-como-produto.md` |

## Da câmera até a foto pronta

### 2. Entrada de fotos

Mostra por onde uma foto entra no Eterna e quando ela é recusada, ignorada ou aceita. As quatro entradas do servidor terminam na mesma etapa de registro; o envio pela tela fica só no navegador.

```mermaid
flowchart TD
  subgraph CARTAO["Cartão de memória"]
    C1["A cada 2 s o servidor procura discos com pasta DCIM"] --> C2{"Arquivo termina em jpg ou jpeg e não começa com ponto e sublinhado?"}
    C2 -- "não" --> C3["Ignorado sem aviso"]
    C2 -- "sim" --> C4{"Arquivo mudou há menos de 2 s?"}
    C4 -- "sim" --> C5["Fica para a próxima volta"]
    C4 -- "não" --> C6["Vai para o registro, por cópia, com o cartão intacto"]
  end

  subgraph FTPAGENTE["FTP do próprio servidor: CTP ou câmera com FTP"]
    F0{"Abriu a porta 21 ou a 2121?"}
    F0 -- "não" --> F00["Recepção por FTP fica desligada"]
    F0 -- "sim" --> F1{"Endereço de origem está bloqueado?"}
    F1 -- "sim" --> F2["Recusa o login: tente em 15 minutos"]
    F1 -- "não" --> F3{"Usuário e senha corretos?"}
    F3 -- "não" --> F4["Login recusado e erro contado"]
    F4 --> F5{"Chegou a 5 erros seguidos?"}
    F5 -- "sim" --> F6["Bloqueia esse endereço por 15 minutos"]
    F5 -- "não" --> F7["Câmera pode tentar de novo"]
    F3 -- "sim" --> F8{"Conexão de dados abriu?"}
    F8 -- "não" --> F9["Recusa o envio: abra a conexão de dados"]
    F8 -- "sim" --> F10["Recebe em pasta temporária"]
    F10 --> F11{"Nome termina em jpg ou jpeg?"}
    F11 -- "não" --> F12["Responde recebido, fica na temporária e não entra no Eterna"]
    F11 -- "sim" --> F13{"Conexão caiu ou arquivo está incompleto ou não é imagem aceita?"}
    F13 -- "sim" --> F14["Apaga e pede para enviar de novo"]
    F13 -- "não" --> F15["Dono da foto é o login; subpasta só vale em login compartilhado e com fotógrafo cadastrado"]
    F15 --> F16["Vai para o registro, movendo o arquivo"]
  end

  subgraph PASTA["Pasta vigiada ETERNA_PASTA"]
    P0{"Variável definida e a pasta existe?"}
    P0 -- "não" --> P00["Pasta vigiada desligada"]
    P0 -- "sim" --> P1["Ao ligar, marca como vistas as fotos com mais de 12 h e as que já estão no Eterna"]
    P1 --> P2["A cada 0,5 s percorre a pasta"]
    P2 --> P3{"Termina em jpg ou jpeg?"}
    P3 -- "não" --> P4["Ignorado sem aviso"]
    P3 -- "sim" --> P5{"Mesmo tamanho e mesma data já tratados?"}
    P5 -- "sim" --> P2
    P5 -- "não" --> P6{"Ainda crescendo ou mudou há menos de 0,5 s?"}
    P6 -- "sim" --> P2
    P6 -- "não" --> P7{"Foto completa?"}
    P7 -- "não" --> P8{"Mudou há menos de 10 minutos?"}
    P8 -- "sim" --> P2
    P8 -- "não" --> P9["Ignorada com aviso no registro do servidor"]
    P7 -- "sim" --> P10["Dono é a subpasta ou a palavra pasta"]
    P10 --> P11["Vai para o registro, por cópia, com o original intacto"]
  end

  subgraph REMOTO["FTP remoto do estádio"]
    R0{"Servidor FTP configurado?"}
    R0 -- "não" --> R00["Espera até 10 s e confere de novo"]
    R0 -- "sim" --> R1{"Conectou e listou?"}
    R1 -- "não" --> R2["Mostra o erro e tenta de novo em até 8 s"]
    R1 -- "sim" --> R3["Lista fotos jpg e jpeg em até 3 níveis de pasta, a cada 2,5 s"]
    R3 --> R4{"Mesmo caminho e tamanho já baixados?"}
    R4 -- "sim" --> R3
    R4 -- "não" --> R5{"Servidor informou o tamanho?"}
    R5 -- "não" --> R6["Não baixa e mostra aviso de fotos aguardando"]
    R5 -- "sim" --> R7{"Tamanho igual ao da volta anterior?"}
    R7 -- "não" --> R3
    R7 -- "sim" --> R8["Baixa para a pasta temporária"]
    R8 --> R9{"Foto completa?"}
    R9 -- "não" --> R10{"Já veio cortada 5 vezes?"}
    R10 -- "sim" --> R11["Desiste dessa foto"]
    R10 -- "não" --> R3
    R9 -- "sim" --> R12["Dono é a subpasta se cadastrada; senão FTP do estádio"]
    R12 --> R13["Vai para o registro, movendo o arquivo baixado"]
  end

  subgraph TELA["Upload pela tela: Testar com fotos suas"]
    T1["Pega até 80 imagens escolhidas no navegador"] --> T2["Guarda só neste navegador, sem enviar ao servidor"]
    T2 --> T3{"Imagem quase preta?"}
    T3 -- "sim" --> T4["Pula a imagem"]
    T3 -- "não" --> T5["Entra na sessão em formação deste navegador"]
    T5 --> T6{"Servidor conectado?"}
    T6 -- "não" --> T7["Fecha no fim da leva, com código só deste navegador"]
    T6 -- "sim" --> T8["Fica em formação até Limpar esta leva"]
  end

  C6 --> I1
  F16 --> I1
  P11 --> I1
  R13 --> I1
  I1["Calcula a assinatura com o tamanho e os primeiros 2 MB"] --> I2{"Foto foi apagada a pedido do cliente?"}
  I2 -- "sim" --> I3["Não entra; em arquivo movido, o temporário é apagado"]
  I2 -- "não" --> I4{"Cartão: já tratada nesta inserção?"}
  I4 -- "sim" --> I5["Ignorada sem aviso"]
  I4 -- "não" --> I6{"Assinatura já existe no Eterna?"}
  I6 -- "sim" --> I7["Repetida: não duplica e a tela avisa"]
  I6 -- "não" --> I8{"Copiou ou moveu para a pasta do dia?"}
  I8 -- "não" --> I9["Erro no registro do servidor; foto não entra"]
  I8 -- "sim" --> I10["Foto registrada: segue para o fluxo 2"]
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Disco é cartão | Tem pasta `DCIM`; no Windows, procura de D: a Z:; verificação a cada 2 s | `list_volumes`, `watcher`, `POLL` |
| Extensão aceita no cartão e na pasta vigiada | Termina em `.jpg`, `.jpeg`, `.JPG` ou `.JPEG`, com diferença entre maiúscula e minúscula. Um `.Jpg`, por exemplo, não passa | `EXT`, `scan_card`, `pasta_vigiada` |
| Enviar fotos pela tela (v96-ux) | Plano B quando o leitor não reconhece o cartão. Em Minhas fotos, quem tem `set.c` (Fotógrafo, Supervisora e Admin) abre "Enviar fotos do cartão manualmente" e solta ou escolhe as fotos; cada JPG vai a `POST /fotos/enviar?nome=&quem=` (2 por vez, em ordem de nome, até 2.000 por envio). Só com o Eterna aberto pelo endereço do agente. O agente exige posto, origem local e `X-Eterna: 1`, `Content-Type: image/jpeg`, até 60 MB, fotógrafo cadastrado (não vale login compartilhado), extensão do cartão, 300 fotos por minuto por IP, 2 GB livres e no máximo 4 gravações ao mesmo tempo (503). Confere que é JPEG de verdade (`FF D8 FF` e `FF D9` no fim) e dá o nome do arquivo (rótulo seguro). Entra pelo `ingest_file` como foto de cartão: trilha atrasada do dia da chegada, sem mexer no desvio de relógio; repetida conta como "já estava no servidor". Rede caída: cada foto tenta 3 vezes, depois "Tentar de novo as N que faltaram" | `fotosEnviar`, `fotos_enviar_post`, `jpeg_de_verdade`, `envio_nome` |
| Extensão aceita no FTP e no FTP remoto | `jpg` ou `jpeg`, sem diferença entre maiúscula e minúscula | `FTPSession.handle`, `rftp_list` |
| Cartão ainda gravando | Última mudança há menos de 2 s: espera a próxima volta | `scan_card` |
| Porta do FTP | Tenta 21 e depois 2121. `ETERNA_FTP_PORTA` é só para testes | `ftp_server` |
| Login FTP bloqueado | 5 erros seguidos por endereço bloqueiam por 900 s (15 min). Durante o bloqueio, responde "tente de novo em 15 minutos". Login certo zera a contagem | `FTP_MAX_FALHAS`, `FTP_BLOQUEIO_S`, `ftp_bloqueado`, `ftp_falhou` |
| Foto completa | JPEG: começa com o marcador de início e tem o marcador de fim nos últimos 4 KB. PNG com nome de JPEG é aceito se tiver o bloco final. Outro conteúdo é recusado | `jpeg_completo` |
| Incompleto no FTP do servidor | Apaga e responde "Transferência incompleta, envie de novo". Não há retomada: a foto volta inteira | `FTPSession.handle` |
| Não JPG no FTP do servidor | Responde "recebido", fica na pasta temporária e não entra na biblioteca | `FTPSession.handle` |
| Dono no FTP do servidor | É o login. Subpasta só muda o dono em login marcado como compartilhado e se a subpasta for um fotógrafo cadastrado | `FTPSession.handle` |
| Pasta vigiada ao ligar | Marca como vista a foto com mais de `ETERNA_PASTA_RETOMAR` horas (padrão 12) ou que já está no Eterna. O resto entra, para recuperar o que chegou com o sistema desligado | `pasta_vigiada` |
| Incompleto na pasta vigiada | Espera até 600 s (10 min) desde a última mudança; depois ignora com aviso | `pasta_vigiada` |
| Dono na pasta vigiada | Nome da subpasta, ou "pasta" na raiz. O nome só vale como fotógrafo se for cadastrado (fluxo 4) | `pasta_vigiada`, `ff_quem` |
| Tamanho desconhecido no FTP remoto | Tamanho 0 ou não informado: não baixa e mostra "aguardando" | `rftp_loop` |
| Foto parou de crescer no FTP remoto | Mesmo tamanho em duas voltas seguidas (intervalo de 2,5 s) | `rftp_loop` |
| Cortada no FTP remoto | Apaga e tenta de novo; na 5ª vez, desiste daquele caminho e tamanho | `rftp_cortadas`, `rftp_loop` |
| Dono no FTP remoto | Subpasta logo abaixo da pasta configurada, se cadastrada (sem acento e em minúsculas); senão, "ftp-estadio" | `rftp_origem` |
| Upload pela tela | Só tipo `image/*`, até 80 por vez, em ordem de nome. Guarda no navegador. Imagem com brilho médio abaixo de 22 é pulada | tratamento `imp-files`, `upSave`, `detectBlack` |
| Fechamento do upload pela tela | Sem servidor: fecha no fim da fila. Com servidor: a fila acaba e a sessão não fecha sozinha | `ingTick`, `agentPoll` |
| Pedido de exclusão | Assinatura na lista de excluídas não entra de novo | `ingest_file`, `lgpd_excluidas` |
| Duplicado | Assinatura = tamanho + primeiros 2 MB. Já existente: evento de repetida, contador e métrica, sem nova cópia | `quick_hash`, `ingest_file` |
| Duplicado na mesma inserção do cartão | Ignorado sem evento | `ingest_file`, `cards` |

#### Divergências entre documento e código

- `DOCUMENTACAO-TECNICA.md` 7.1 diz "sha256 já existe". O código compara o SHA-256 do tamanho com os primeiros 2 MB. O SHA-256 do arquivo inteiro fica só na métrica.
- O mesmo diagrama traz "5G, FTP nuvem e pull" como entrada própria. No código há só um FTP remoto genérico, configurado na tela.
- O cabeçalho de `eterna-agente.py` diz que as credenciais do FTP são mostradas na tela ao iniciar. O código não as mostra no console nem no registro.
- O comentário de `pasta_vigiada` diz que a foto já existente cai como repetida depois de reiniciar. `pasta_vigiada` não chama `save_index`. Sem gravação por outro canal, a assinatura pode não estar no índice depois do reinício e a foto pode ser reprocessada.

#### Não confirmado

- Se cada câmera ou o CTP realmente reenvia depois da resposta de envio incompleto. Depende do aparelho; o código só pede o reenvio.
- O código não diferencia CTP de 5D: os dois são clientes de FTP. A diferença entre eles não foi confirmada aqui.
- Nada foi executado. O comportamento da sessão aberta no upload pela tela e o reprocessamento da pasta vigiada vêm da leitura do código.

### 3. Pipeline depois da chegada

Mostra o que acontece com a foto aceita até o rosto dela poder ser achado pela selfie. A sessão recebe a foto antes da leitura dos rostos, então os dois caminhos andam em paralelo.

```mermaid
flowchart TD
  A["Foto registrada na pasta do dia"] --> B["Calcula a assinatura do arquivo inteiro para conferência"]
  B --> C{"Gerou a miniatura de até 900 px?"}
  C -- "sim" --> D["Usa a miniatura nova"]
  C -- "não" --> E["Usa o próprio original como miniatura"]
  D --> F["Lê da foto: câmera, autor, dono e hora do clique"]
  E --> F
  F --> G["Grava origem e horários, publica o evento e a métrica"]
  G --> H["Entrega à sessão: fluxo 3"]
  G --> I["Marca rosto pendente e põe na fila com prioridade de foto nova"]
  G --> J{"Nuvem ligada?"}
  J -- "sim" --> K["Entra na fila de envio para a nuvem"]
  J -- "não" --> L["Fica só no servidor"]
  G --> M["A tela Upload vê o evento em até 2,5 s"]

  N["Servidor liga"] --> O{"OpenCV disponível?"}
  O -- "não" --> P["Rostos desligados: sessões só por tempo"]
  O -- "sim" --> Q{"Modelos de rosto prontos ou baixados?"}
  Q -- "não" --> P
  Q -- "sim" --> R["Apaga leituras com mais de 60 dias"]
  R --> S["Fotos ainda não lidas entram atrás das novas, mais recentes primeiro"]
  S --> T["Leitores em paralelo aguardam a fila"]

  I --> T
  T --> U{"A imagem abriu?"}
  U -- "não" --> V["Sem gravação; conta como lida sem rosto e volta à fila no próximo início"]
  U -- "sim" --> W["Reduz para no máximo 1600 px e procura rostos"]
  W --> X{"Rosto com pelo menos 40 px de largura?"}
  X -- "não" --> Y["Rosto ignorado, tratado como fundo"]
  X -- "sim" --> Z["Gera o vetor do rosto"]
  Y --> AA["Grava a foto e os rostos no índice"]
  Z --> AA
  AA --> AF{"Deu erro ao gravar ou ler?"}
  AF -- "sim" --> AG["Erro no registro do servidor; conta como lida sem rosto"]
  AG --> AE
  AF -- "não" --> AB{"Índice do dia já está na memória?"}
  AB -- "sim" --> AC["Atualiza a memória sem reler o dia"]
  AB -- "não" --> AD["A próxima busca lê o dia no banco"]
  AC --> AE["Tira de rostos pendentes e avisa a sessão"]
  AD --> AE
  V --> AE
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Pasta da foto | Dia da data de modificação do arquivo recebido; nome com os 12 primeiros caracteres da assinatura + nome original | `ingest_file` |
| Miniatura | Lado maior de 900 px, qualidade 82. Mac usa `sips`; os demais usam Pillow. Se falhar, serve o original | `make_thumb`, `ingest_file` |
| Dados da foto | Modelo, autor, dono, série e hora do clique, lidos dos primeiros 256 KB; sem EXIF, o campo fica vazio | `exif_info`, `_exif_tiff` |
| Falha na sessão ou na fila do fotógrafo | É registrada e não barra a entrada da foto | `ingest_file` |
| Prioridade da fila de rostos | Foto nova primeiro; atraso do início depois | `rostos_enfileira`, `rostos_thread` |
| Rostos ligados | Exige OpenCV, numpy e os 2 modelos; `ETERNA_SEM_OPENCV` desliga. Falha deixa os rostos desligados, com motivo no status | `rostos_thread`, `modelos_ok` |
| Quantidade de leitores | `ETERNA_LEITORES`, ou metade dos núcleos (mínimo 1) | `rostos_thread` |
| Abertura da imagem | Abre em tamanho reduzido à metade. Se falhar, não grava em `foto`; no próximo início ela volta à fila | `leitor_loop`, `rostos_thread` |
| Limite de pixels no OpenCV | 40 milhões de pixels | `OPENCV_IO_MAX_IMAGE_PIXELS` |
| Detector de rosto | YuNet com confiança 0,7 sobre a foto reduzida a 1600 px. Vetor SFace de 128 números | `leitor`, `ler_rostos`, `LADO` |
| Rosto que conta | Largura de pelo menos 40 px na imagem reduzida | `ROSTO_MIN`, `ler_rostos` |
| Índice | Banco `rostos.db`, com uma tabela de fotos lidas e outra de rostos; regrava os rostos daquela foto | `rostos_db`, `leitor_loop` |
| Índice em memória | Acrescenta só quando o dia já está carregado | `mat_acrescenta`, `matriz` |
| Retenção | 60 dias, no início e uma vez por dia | `RETENCAO_DIAS`, `limpar_rostos` |
| Envio à nuvem | Só com a nuvem ligada; a continuação fica fora deste fluxo | `nuvem_enfileira` |

#### Divergências entre documento e código

- `DOCUMENTACAO-TECNICA.md` lista InsightFace, Redis e filas de trabalho. O código usa YuNet + SFace (OpenCV), linhas de execução e fila em memória.
- O diagrama 7.1 lê os rostos antes de decidir a sessão. No código, a foto entra na sessão primeiro e a decisão por rosto vem depois, com prazo (fluxo 3).
- O diagrama 7.1 cita derivadas "miniatura e web" na chegada. Na chegada, o código gera só a miniatura de 900 px.

#### Não confirmado

- O tempo real de cada etapa neste servidor. Existe medição em `/metricas`, mas nada foi executado.

### 4. Sessões por tempo e rosto

Mostra como as fotos viram sessões iguais em todos os navegadores. O tempo decide primeiro; o rosto só separa ou junta fotos que passaram no teste de tempo.

```mermaid
flowchart TD
  A["Foto registrada chega à sessão"] --> B{"Tem hora de chegada e ainda não tem sessão?"}
  B -- "não" --> B1["Nada a fazer"]
  B -- "sim" --> C["Identifica fotógrafo, câmera ou fonte"]
  C --> D["Calcula a hora do clique corrigida"]
  D --> E{"Veio de cartão ou chegou mais de 10 min depois do clique?"}
  E -- "sim" --> F["Trilha atrasada, no dia da chegada"]
  E -- "não" --> G["Trilha ao vivo, no dia do clique"]
  F --> H{"A trilha tem sessão aberta?"}
  G --> H
  H -- "não" --> I["Abre sessão: início do dia ou pausa"]
  H -- "sim" --> J{"Clique mais de 60 s depois da última foto ou mais de 60 s antes da primeira?"}
  J -- "sim" --> K["Fecha a aberta e as em fechamento: pausa entre cliques"]
  K --> I
  I --> L["Foto entra na hora, decidida por tempo"]
  L --> L1["Rostos dela entram na sessão quando forem lidos"]
  J -- "não" --> M{"Separação por rosto está ligada?"}
  M -- "não" --> N["Foto entra na aberta, só por tempo"]
  M -- "sim" --> O["Foto fica pendente, na ordem do clique"]

  O --> P{"Rosto desta foto já foi lido?"}
  P -- "não" --> Q{"Passaram 20 s desde a chegada?"}
  Q -- "não" --> P
  Q -- "sim" --> N
  P -- "sim" --> R{"Falta ler o rosto de quem abriu a sessão e o prazo não venceu?"}
  R -- "sim" --> P
  R -- "não" --> S{"A foto tem rosto principal?"}
  S -- "não" --> T["Fica na aberta: sem rosto"]
  S -- "sim" --> U{"Bate com 2 ou mais candidatas com semelhança de 0,45 ou mais?"}
  U -- "sim" --> V["Funde as candidatas na mais antiga; as outras viram removidas"]
  U -- "não" --> W{"Melhor semelhança é de 0,38 ou mais?"}
  W -- "sim" --> X["Entra na sessão mais parecida, que passa a ser a aberta"]
  W -- "não" --> Y{"Há rosto de qualidade e a melhor semelhança fica abaixo de 0,25?"}
  Y -- "sim" --> Z["Abre sessão nova: rostos novos"]
  Z --> AA["A aberta anterior passa a fechando e ainda pode fundir"]
  AA --> AB{"Passou de 2 sessões em fechamento na trilha?"}
  AB -- "sim" --> AC["A mais antiga fecha de vez"]
  AB -- "não" --> AD["Foto entra na sessão nova"]
  AC --> AD
  Y -- "não" --> AE["Fica na aberta: dúvida ou rosto sem qualidade"]

  L1 --> AF["A cada 2 s verifica os prazos"]
  N --> AF
  T --> AF
  V --> AF
  X --> AF
  AD --> AF
  AE --> AF
  AF --> AG{"Sessão foi aberta antes da virada do dia?"}
  AG -- "sim" --> AH["Fechada: virada do dia"]
  AG -- "não" --> AI{"Mais de 60 s sem chegada nesta sessão?"}
  AI -- "sim" --> AJ["Fechada: pausa sem foto"]
  AI -- "não" --> AF
  AK["Servidor reiniciou"] --> AL["Sessão não fechada fecha: reinício"]
  AK --> AM["Foto sem sessão é reagrupada sem esperar e também fecha: reinício"]
  K --> AN["Pendentes ficam na sessão que fechou, só por tempo; vetores saem da memória"]
  AH --> AN
  AJ --> AN
  AL --> AN
  AM --> AN
  AN --> AO["Sessão fechada não muda mais, salvo pedido de exclusão"]
  AO --> AP["Navegador lê a sessão e segue para o fluxo 4"]
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Quem é o fotógrafo | 1) origem, se cadastrada; 2) autor ou dono da câmera, inteiro ou primeiro nome, se cadastrado; 3) sem fotógrafo, com a fonte: final da série da câmera, FTP do estádio, cartão ou pasta. Login compartilhado sem subpasta não conta como fotógrafo | `ff_quem`, `ff_cadastrados` |
| Separação sem fotógrafo | Trilha por série da câmera; sem série, pela fonte | `_sess_add` |
| Cadastro | Lido com cache de 30 s | `ff_cadastrados` |
| Hora do clique | Hora da câmera + desvio da série, se estiver entre 48 h antes e 10 min depois da chegada; senão, data do arquivo de origem na mesma janela; senão, a chegada | `sess_clique`, `SESS_CLIQUE_ANTES`, `SESS_CLIQUE_DEPOIS` |
| Desvio da câmera | Últimas 50 diferenças entre chegada e clique, sem fotos de cartão. Com 3 ou mais, descarta o que está a mais de max(3 x desvio mediano, 30 s) da mediana e usa o menor | `sess_desvio`, `ff_desvio` |
| Trilha atrasada (`SESS_ATRASO`) | Cartão sempre; demais fontes quando chegada − clique > 600 s | `sess_trilha` |
| Pausa (`SESS_PAUSA`) | 60 s. `ETERNA_SESSAO_PAUSA` de 2 a 600 só em testes | `_sess_pausa`, `_sess_add` |
| Motivo de abertura | Início (primeira da trilha), pausa, rostos novos, ou reagrupada no início do servidor | `_sess_add`, `_sess_decide` |
| Espera do rosto (`SESS_ROSTO_ESPERA`) | Até 20 s desde a chegada. A foto da frente segura as seguintes da trilha. Vencido o prazo, ou com os rostos desligados, entra por tempo | `_sess_drenar` |
| Erro na leitura | Conta como lida sem rosto | `leitor_loop`, `sess_rostos_lidos` |
| Rosto principal | Largura de pelo menos metade do maior rosto da foto e de pelo menos 40 px | `_sess_principais` |
| Rosto de qualidade | Confiança de pelo menos 0,80, largura de pelo menos 60 px e frontal: nariz a até 0,35 da distância entre os olhos | `_sess_qualidade`, `ler_rostos` |
| Candidatas | A aberta + em fechamento da trilha, até 3 | `SESS_CAND_MAX`, `_sess_cands` |
| Fundir | Semelhança de 0,45 ou mais com 2 ou mais candidatas: junta na mais antiga | `SESS_LIM_FUNDE`, `_sess_fundir` |
| Ficar | Melhor semelhança de 0,38 ou mais: vai para a mais parecida, que volta a ser a aberta | `SESS_LIM_FICA`, `_sess_decide`, `_sess_vira_aberta` |
| Abrir por rostos novos | Exige rosto de qualidade, pelo menos uma candidata com rosto guardado e melhor semelhança abaixo de 0,25 | `SESS_LIM_NOVO`, `_sess_decide` |
| Sem rosto guardado para comparar | Fica na aberta, como dúvida ou sem rosto | `_sess_decide` |
| Rostos guardados | Até 40 por sessão; repetido com semelhança de 0,7 ou mais não entra. Só em memória e só em sessões não fechadas | `SESS_ROSTOS_MAX`, `SESS_REPETIDO`, `_sess_guarda_rostos` |
| Fechar por pausa de clique | Trilha fecha a aberta e as em fechamento | `_sess_add`, `_sess_fecha_uma` |
| Fechar por falta de chegada | Mais de 60 s sem chegada na sessão; verificação a cada 2 s | `_sess_fechar`, `sess_loop` |
| Fechar por limite | Mais de 2 sessões em fechamento na trilha: a mais antiga fecha, registrada como pausa | `_sess_vira_aberta` |
| Virada do dia | Comparação pelo dia da primeira chegada | `_sess_fechar` |
| Início do servidor | Lê ontem e hoje; a não fechada fecha como reinício. Foto sem sessão usa os rostos do banco, que não votam por sessão nova | `sess_carregar`, `_sess_faces_db` |
| Guarda | Memória com hoje e ontem; arquivo por dia durante 60 dias; sem vetor de rosto no arquivo | `sess_loop`, `sess_gravar`, `SESS_RET_DIAS`, `sess_limpar` |
| Entrega ao navegador | Lê mudanças a cada 2,5 s; só a fechada vira sessão de venda, até 12 por ciclo | `agentPoll`, `srvPull`, `srvMaterializa`, `SRV_MAT_MAX` |

#### Divergências entre documento e código

- `DOCUMENTACAO-TECNICA.md` 7.1 diz que o limiar é aprendido por ponto, com valor inicial de 20 s, e prevê sessão em dúvida para o vendedor juntar ou separar. No código, a pausa é fixa em 60 s e a dúvida fica na sessão aberta, sem ação do vendedor.
- A seção "Fila do fotógrafo (v87)" ainda descreve pausa de 20 s e grupos próprios. A seção da v91 no mesmo documento registra que eles saíram, e o código confirma.
- A regra S2 do plano e da documentação usa o menor desvio. O código descarta primeiro os valores fora da curva; isso aparece em outra parte da documentação.
- O plano S2 diz que clique inválido cai na chegada. O código tenta antes a data do arquivo de origem.
- A regra S3 da documentação usa o dia do clique nas duas trilhas, e S14 diz que os arquivos são pelo dia do clique. Na trilha atrasada, o código usa o dia da chegada; o risco 7 da própria documentação já admite isso.
- O plano S3 define a atrasada pelo tempo. No código, foto de cartão é sempre atrasada, mesmo recém-clicada.
- O plano se chama v90; `VERSOES.md` registra esta regra na v91.
- O comentário em `main` diz que os grupos da fila são refeitos do meta. `ff_carregar` hoje carrega só a função do dia.

#### Não confirmado

- Se os limiares 0,38, 0,25 e 0,45 acertam em um dia real. `2026-11-02-pedidos-do-eduardo-pos-v91.md` deixa essa calibração pendente antes de 01/12.

### 5. Validação, correção, olhos fechados, ajuste automático e fila do fotógrafo

Mostra o que acontece depois do fechamento até a foto poder aparecer no Checkout, e como a Fila do fotógrafo mostra esse andamento. Neste fluxo, "correção" é o ajuste manual e o descarte, pois o código não tem outra etapa com esse nome.

```mermaid
flowchart TD
  A["Navegador recebe a sessão fechada"] --> B{"Já existe neste navegador?"}
  B -- "sim" --> B1["Só aplica pedido de exclusão, se houver"]
  B -- "não" --> C{"Sobrou foto que não está em outra sessão deste navegador?"}
  C -- "não" --> C1["Não cria a sessão"]
  C -- "sim" --> D["Sessão entra na lista com status fechada"]
  D --> E["Validação entra na fila deste navegador, uma por vez"]
  D --> AA["Foto já pode aparecer no Checkout enquanto a validação não termina"]
  E --> F{"Tela é o Checkout com cliente em atendimento?"}
  F -- "sim" --> G{"Balcão ocupado há 10 min seguidos?"}
  G -- "não" --> F
  G -- "sim" --> H
  F -- "não" --> H{"Modelo de validação carregou?"}
  H -- "não" --> I["Validação não roda e nenhuma foto é barrada"]
  H -- "sim" --> J["Lê a próxima foto"]
  J --> K{"Conseguiu ler e achou rosto?"}
  K -- "não" --> L["Foto continua válida"]
  K -- "sim" --> M{"Algum rosto com pelo menos 60% da largura do maior tem os dois olhos fechados?"}
  M -- "não" --> L
  M -- "sim" --> N["Não válida: olhos fechados"]
  N --> O["Sai do Checkout e fica no acervo; a tela não oferece botão para reverter"]
  O --> P{"Todas as fotos da sessão saíram?"}
  P -- "sim" --> Q["Sessão some da lista"]
  P -- "não" --> AA
  L --> AA

  R["A cada 3 s o ajuste automático verifica as fotos"] --> S{"Está ligado e fora da tela do Checkout?"}
  S -- "não" --> S1["Não faz nada"]
  S -- "sim" --> T{"Foto já tem ajuste ou falhou antes?"}
  T -- "sim" --> T1["Pula a foto"]
  T -- "não" --> U{"Conseguiu ler pontos suficientes?"}
  U -- "não" --> U1["Marca como falha e não tenta de novo até recarregar a tela"]
  U -- "sim" --> V["Define brilho, contraste e temperatura; marca como ajuste da IA"]
  V --> AA

  W["Equipe abre a foto em Ajustes ou na ampliação"] --> X{"Qual ação?"}
  X -- "Mexer nos controles" --> Y["Salva como ajuste à mão; a IA não troca sem pedido"]
  X -- "Pedir ajuste da IA" --> V
  X -- "Desfazer" --> Z["Apaga o ajuste da foto"]
  X -- "Descartar" --> X1["Foto sai do Checkout"]
  X1 --> X2["Pode voltar com Recuperar foto"]
  X2 --> AA
  Y --> AA
  Z --> AA

  AA --> AB{"Sessão existe, foto tem imagem, não foi descartada e não é inválida?"}
  AB -- "sim" --> AC["Foto pronta para venda no Checkout"]
  AB -- "não" --> AD["Fora da venda"]

  FF0["A Fila consulta o servidor a cada 2 s"] --> FF1{"Sessão é de hoje, tem foto e não foi removida?"}
  FF1 -- "não" --> FF2["Não aparece"]
  FF1 -- "sim" --> FF3{"Status é fechada?"}
  FF3 -- "sim" --> FF4{"Alguma foto ainda aguarda leitura de rosto?"}
  FF4 -- "sim" --> FF5["Coluna Chegando"]
  FF4 -- "não" --> FF6{"Pronta há mais de 15 min?"}
  FF6 -- "sim" --> FF2
  FF6 -- "não" --> FF7{"Está entre as 24 mais recentes?"}
  FF7 -- "sim" --> FF8["Coluna Já no Checkout"]
  FF7 -- "não" --> FF2
  FF3 -- "não" --> FF9{"Aberta, ao vivo e com clique nos últimos 60 s?"}
  FF9 -- "sim" --> FF10["Coluna Clicando agora"]
  FF9 -- "não" --> FF5
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Foto repetida no navegador | Foto que já está em outra sessão local não duplica | `srvMaterializa`, `photosInSessions` |
| Regra geral de validação | `validatePhoto` sempre devolve nulo. A única regra que pode barrar é a de olhos fechados | `validatePhoto`, `validateReal`, `ingClose` |
| Fila de validação | Uma por vez em cada navegador; cada navegador valida de novo | `VAL_FILA`, `ingClose` |
| Espera do balcão | Só na tela do Checkout. Livre = aguardando rosto e sem busca em andamento. Teto de 10 min seguidos | `valLivre`, `VAL_TETO` |
| Imagem validada | Miniatura de até 900 px, para foto do servidor; imagem maior é reduzida a 1400 px de largura | `photoCanvas`, `validateReal` |
| Detecção | Confiança mínima de 0,5 | `validateReal` |
| Quem conta | Largura de pelo menos 60% do maior rosto da foto | `validateReal` |
| Olho fechado | Maior abertura dos dois olhos abaixo de 0,19. Abertura = altura / largura do olho | `eyeOpen`, `validateReal` |
| Sem rosto ou erro | Foto continua válida: "sem rosto" não barra | `validateReal` |
| Efeito de não válida | Sai de `sessionObj` e do Checkout; continua no acervo. Compartilhado por `SIM.invalid` | `demoSessions`, `SIM_MAPA` |
| Gravação da validação | O resultado fica em memória até a próxima gravação do navegador | `ingClose`, `saveSim` |
| Ajuste automático ligado | Vale para o ponto inteiro; desligar exige permissão de alterar no módulo do set e registra quem mexeu. Ao religar, processa as que ficaram sem ajuste | `ajAutoSet`, `SIM.autoAj` |
| Lote do ajuste | Até 16 fotos a cada 3 s, sem foto já ajustada e sem as que falharam desde a última recarga da tela | `ajQueue` |
| Pontos suficientes | Pelo menos 50 pontos com brilho de 6 ou mais, em uma cópia com 160 px de largura | `ajAuto` |
| Valores do ajuste | Brilho de 75 a 140, contraste de 90 a 140, temperatura de −30 a +30, em passos de 5 | `ajAuto` |
| Ajuste manual protegido | Ajuste à mão só é trocado com pedido explícito da IA | `ajAuto`, `ajSet`, `aj-auto`, `aj-auto-all` |
| Original | O ajuste é um conjunto de valores aplicado na tela e na impressão; o arquivo original não muda | `SIM.edits`, `editStyleObj`, `printMontar` |
| Descartar e recuperar | Liga e desliga `SIM.discarded`; a foto sai ou volta | `aj-discard`, `m-discard` |
| Clicando agora | Status aberta, trilha ao vivo e último clique há 60 s ou menos | `ff_json` |
| Chegando | Resto das não fechadas, ou fechada com foto ainda na fila de rostos | `ff_json` |
| Já no Checkout | Fechada e sem pendência de rosto. Conta a partir do maior entre fechamento e última leitura | `ff_json` |
| Saída da coluna final | 15 min depois de pronta; no máximo 24 cartões | `FF_PRONTA_MIN`, `FF_PRONTAS_MAX` |
| Miniaturas na Fila | Até 6 e só nas duas primeiras colunas. Sem escolha salva no aparelho, só para quem não é do caixa e fora de tela cheia | `FF_PIDS`, `ffMiniOn`, `vFotoFila` |
| Função do dia | Vem da Escala, é validada e guardada na abertura da sessão; sem ela, usa o ponto padrão do fotógrafo | `ff_funcao_validar`, `_ff_func_snapshot`, `ffPadrao` |
| Falta de resposta | Mantém o último dado e mostra "Sem conexão com o servidor"; tempo limite de 4 s | `fotoFilaPoll` |

#### Divergências entre documento e código

- `DOCUMENTACAO-TECNICA.md` 7.2 descreve validação por sem rosto, óculos, exposição, contraluz, anel do estádio, borda e bandeira, com resultado "dúvida". No código, só olhos fechados barra. Não há dúvida nem revisão automática.
- O documento registra cada decisão em uma tabela `VALIDATION`, de só inserção. O código guarda só o mapa `SIM.invalid`, por foto, sem histórico de decisão.
- A seção 7.2 descreve correção por rosto até 1,5 EV, gerando derivada. O código calcula pelo histograma da foto inteira e guarda só valores de exibição, sem arquivo derivado.
- A lista `INVALID_REASONS` cita desfocada, sem rosto e cortada, e `validatePhoto` nunca as usa.
- A mensagem "rosto e olhos aprovados em todas" aparece mesmo quando a foto passou por não ter rosto detectado.
- A coluna "Já no Checkout" não espera a validação nem a chegada da sessão a cada navegador. Depende só do fechamento e da leitura de rostos no servidor.
- O plano S12 põe foto pendente de rosto em "Chegando". No código, uma sessão aberta ao vivo com clique recente fica em "Clicando agora" mesmo com pendência.
- A seção "Fila do fotógrafo (v87)" descreve `ff_estado`, 20 s e `G014`. O código usa a sessão e o código LP.

#### Não confirmado

- A tela diz que o ajuste vale para o Checkout, a impressão e a galeria. Checkout e impressão foram confirmados; na galeria, não localizei o uso do ajuste em `galAtualizar` nem em `_vitrine`.
- Taxa de acerto da regra de olhos fechados: não há medição no material lido.

### 6. Recorte antecipado e fundos de IA

Mostra quais fotos são recortadas antes do cliente chegar e como o Checkout monta os fundos. Se a montagem não for possível, o item some da venda e a foto normal continua disponível.

```mermaid
flowchart TD
  A{"Recorte antecipado está ligado?"}
  A -- "não" --> A1["Recorta só quando o Checkout pede"]
  A -- "sim" --> B["Espera 15 s depois de ligar; repete a cada 15 s"]
  B --> C{"Pacotes e modelos instalados, sem erro nos últimos 60 s?"}
  C -- "não" --> B
  C -- "sim" --> D{"Abriu os modelos?"}
  D -- "não" --> D1["Guarda o erro e o recorte fica indisponível por 60 s"]
  D1 --> B
  D -- "sim" --> E["Pega as sessões fechadas dos dias da busca, mais novas primeiro"]
  E --> F["Escolhe as 2 primeiras fotos de cada sessão"]
  F --> G{"Sessão tem mais de 2 fotos e o índice de rostos está disponível?"}
  G -- "não" --> H["Fica só com as 2 primeiras"]
  G -- "sim" --> I["Agrupa pelo maior rosto de cada foto, com semelhança de 0,45 ou mais"]
  I --> J{"Pessoa aparece em 3 fotos ou mais?"}
  J -- "não" --> J1["Pessoa não conta"]
  J -- "sim" --> K["Fica com as 4 pessoas com mais fotos e as 2 primeiras de cada uma"]
  H --> L{"Foto já recortada ou já tentada?"}
  K --> L
  L -- "sim" --> L1["Pula a foto"]
  L -- "não" --> M{"Há pedido na fila?"}
  M -- "sim" --> M1["Espera a fila esvaziar"]
  M1 --> M
  M -- "não" --> N{"Foto ainda está na biblioteca?"}
  N -- "não" --> L1
  N -- "sim" --> O["Pede o recorte e espera: até 10 min no antecipado, até 3 min no Checkout"]

  P["Cliente abre as fotos no Checkout"] --> Q{"Fundos podem ser oferecidos?"}
  Q -- "não" --> Q1["Mostra só as fotos normais"]
  Q -- "sim" --> R["Pega as 2 primeiras fotos do cliente"]
  R --> S{"Leitura de ângulo, luz e enquadramento terminou?"}
  S -- "não" --> T["Usa as 2 primeiras por enquanto"]
  S -- "sim" --> U{"A foto passa na nota mínima?"}
  U -- "sim" --> V["Mantém a foto"]
  U -- "não" --> W{"Há outra foto aprovada do cliente?"}
  W -- "sim" --> X["Troca pela aprovada"]
  W -- "não" --> X1["Tira a foto da lista"]
  T --> Y["Escolhe até 3 fundos por foto entre os ativos que aceitam o enquadramento"]
  V --> Y
  X --> Y
  Y --> Z{"Modo de montagem?"}
  Z -- "Local" --> AA{"Fundo abriu?"}
  AA -- "não" --> AX["Item sai da venda"]
  AA -- "sim" --> AB["Pede o recorte ao servidor"]
  AB --> AB1{"Foto está na biblioteca do servidor?"}
  AB1 -- "não" --> AF
  AB1 -- "sim" --> AC{"Recorte já existe?"}
  AC -- "sim" --> AD["Devolve o recorte"]
  AC -- "não" --> AE{"Recorte disponível?"}
  AE -- "não" --> AF["Foto sai dos fundos e a tela mostra o motivo"]
  AE -- "sim" --> AG{"Limite por minuto tem vaga?"}
  AG -- "não" --> AH["Mostra Na fila do recorte e tenta de novo em 3 s"]
  AH --> AB
  AG -- "sim" --> O

  O --> AI{"Fila tem vaga?"}
  AI -- "não" --> AJ["Fila cheia"]
  AI -- "sim" --> AK{"Imagem tem até 40 milhões de pixels e o recorte funcionou?"}
  AK -- "não" --> AL["Falha do recorte"]
  AK -- "sim" --> AM["Grava PNG com a pessoa e fundo transparente"]
  AJ --> AN{"Quem pediu?"}
  AL --> AN
  AN -- "Antecipado" --> AO["Registra o erro e não tenta de novo até reiniciar"]
  AN -- "Checkout, fila cheia ou demora" --> AH
  AN -- "Checkout, outro erro" --> AF
  AM --> AD
  AD --> AP{"Encontrou pessoa no recorte?"}
  AP -- "não" --> AF
  AP -- "sim" --> AQ["Monta no fundo com as regras do fundo escolhido"]
  AQ --> AR["Fundo de IA pronto para venda"]

  Z -- "Photoroom" --> AS{"Chave configurada?"}
  AS -- "não" --> AT["Tela pede para conectar o Photoroom"]
  AS -- "sim" --> AU{"Modo ligado no servidor e Photoroom devolveu a montagem?"}
  AU -- "não" --> AX
  AU -- "sim" --> AR
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Antecipado ligado | Padrão ligado. `ETERNA_PRE_RECORTE=0` desliga | `REC_PRE`, `rec_pre_loop` |
| Modo Photoroom e antecipado | O laço não confere o modo de montagem, então continua recortando | `rec_pre_loop` |
| Recorte disponível | `rembg`, `onnxruntime`, Pillow, numpy e scipy instalados; os 2 modelos baixados; sem `ETERNA_SEM_RECORTE`; sem erro nos últimos 60 s | `rec_estado`, `REC_ERRO_SEG` |
| Dias considerados | `ETERNA_BUSCA_DIAS`; padrão de 1, só hoje | `BUSCA_DIAS`, `rec_pre_loop` |
| Sessões consideradas | Status fechada, não removida, mais nova primeiro pelo fechamento | `rec_pre_loop` |
| Fotos escolhidas sempre | As 2 primeiras da sessão | `rec_pre_escolha` |
| Pessoa | Maior rosto de cada foto, comparado ao primeiro rosto do grupo, com semelhança de 0,45 ou mais. Conta se aparece em 3 fotos ou mais | `rec_pre_escolha`, `LIMITE` |
| Limite por sessão | Até 4 pessoas, com 2 fotos cada, + as 2 primeiras = até 10 recortes | `rec_pre_escolha` |
| Sem índice de rostos | Sem numpy, com até 2 fotos ou com erro no banco: só as 2 primeiras | `rec_pre_escolha` |
| O que o agente desconhece | A escolha não confere descarte nem foto não válida, que ficam no navegador | `rec_pre_escolha` |
| Prioridade do Checkout | O antecipado só pede o próximo com a fila vazia. O que já está rodando não é interrompido | `rec_pre_loop`, `rec_trabalho` |
| Tentativa do antecipado | Uma por foto até reiniciar. O Checkout ainda pode pedir aquela foto | `rec_pre_loop` |
| Concorrência | 1 recorte por vez; `ETERNA_RECORTE_CONC=2` permite 2 | `REC_CONC` |
| Fila | Até 24 pedidos | `REC_FILA_MAX`, `rec_pedir` |
| Taxa do Checkout | 60 recortes novos por minuto por endereço; o recorte pronto não conta | `REC_TAXA`, `recorte_post` |
| Tempo de espera | Checkout: 180 s. Antecipado: 600 s | `rec_pedir`, `rec_pre_loop` |
| Tamanhos | Modelos em 1600 px; PNG final com até 3000 px; prévia de 2400 px, derivada sem rodar os modelos | `REC_TRAB`, `REC_LADOS`, `rec_fazer` |
| Limite da imagem | Até 40 milhões de pixels | `MAX_PIXELS`, `rec_fazer` |
| Quem pode pedir o recorte ao vivo | Só postos autorizados, com código de foto e tamanho válidos (2400 ou 3000 px); fora disso, o pedido é recusado | `recorte_post` |
| Respostas do recorte ao vivo | Sem foto na biblioteca: "não encontrada". Indisponível: "recorte_indisponivel". Fila cheia ou limite: "muitos pedidos" ou "fila_cheia". Demora: "recorte demorou demais". Outro erro: "não deu para recortar" | `recorte_post` |
| Reação da tela | Indisponível ou erro de recorte: a foto sai dos fundos. Fila cheia ou demora: tenta em 3 s. Sem conexão: mostra mensagem, sem tirar da venda | `fiaRecorte`, `compHydrate`, `fiaFalhou` |
| Sem pessoa | Máscara em menos de 0,5% da imagem: item sai como "Ninguém encontrado na foto" | `fiaMedir`, `fiaMontar` |
| Cache | 2 dias; teto de 5 GB por `ETERNA_RECORTES_GB`, apagando os mais antigos; recorte de foto fora da biblioteca sai | `REC_DIAS`, `REC_TETO_GB`, `limpar_recortes` |
| Oferta no Checkout | Local: servidor conectado, recorte disponível e foto do servidor. Photoroom: sempre oferece | `fiaOferece`, `lojaAI` |
| Foto no Checkout | Até 2 fotos do próprio cliente. Depois da leitura: nota total de 70 ou mais e borda de 70 ou mais; se reprovar, troca por outra aprovada do cliente | `lojaAI`, `aiOk`, `AI_MIN` |
| Fundos por foto | Até 3, entre até 5 ativos, se aceitarem o enquadramento, ordenados pela combinação: ângulo 45%, luz 35%, direção 20% | `lojaAI`, `BG_MAX`, `bgOn`, `bgMatch` |
| Enquadramento | Pela altura e posição dos rostos: corpo inteiro, meio corpo ou fechada. Sem leitura, usa um valor calculado do código da foto | `aiAnalyze`, `aiScore` |
| Regras de montagem | Corte, altura, largura e posição por fundo e por tipo de foto. Os valores conferem com `docs/fundos-ia-regras.md` | `FIA_REGRAS`, `fiaLayout` |
| Impressão do fundo | Usa recorte de 3000 px e fundo de 5000 px; sem o arquivo de 5000 px, usa o de 2400 px com aviso. Espera até 60 s antes de registrar falha | `fiaMontar`, `printMontar` |
| Photoroom | Só com o modo ligado também no servidor; senão "photoroom_desligado". Sem chave: "Conecte o Photoroom". Falha da montagem tira o item da venda | `fundos_modo`, `composePR`, `do_POST`, `pr_compose` |

#### Divergências entre documento e código

- A tela de Fundos de IA diz que a IA dá nota a cada foto em quatro critérios. No código, as notas vêm de um cálculo sobre o código da foto (`h32`), sem ler a imagem. Só o enquadramento e a combinação de ângulo e luz usam a imagem.
- A mesma tela diz que a montagem é feita pelo Photoroom e que o Checkout mostra os 5 fundos com maior combinação. O padrão do código é a montagem local, com até 3 fundos por foto.
- O comentário em `REC_PRE` diz que cada sessão fechada é recortada. O código recorta só as escolhidas por `rec_pre_escolha`.
- O comentário diz que o pedido do Checkout "passa na frente". O código não interrompe o recorte em andamento e a fila atende por ordem de chegada; o antecipado apenas não coloca pedido novo enquanto há fila.
- A mensagem de início e o painel dizem que o recorte "carrega na primeira foto". Com o antecipado ligado, os modelos abrem cerca de 15 s depois da partida.
- `DOCUMENTACAO-TECNICA.md` não tem seção sobre o recorte antecipado. Ele aparece em `CONTEXTO-ETERNA.md` e `VERSOES.md`.

#### Não confirmado

- Regra de falha interna do Photoroom: li a estrutura de `pr_compose`, os limites e os erros, mas não testei a API.
- Tempo real por recorte. O comentário do código estima cerca de 40 s para 10 recortes; nada foi medido aqui.
- Se a seleção do antecipado cobre na prática as fotos que o Checkout pede. Não há medição no material lido.

## Do cliente até a foto entregue

### 7. Encontrar as fotos

Leva o cliente da câmera do Checkout até as fotos dele, de uma ou mais sessões do dia. A selfie decide o que entra; o código do recibo é a alternativa quando a câmera não resolve.

```mermaid
flowchart TD
  A["Cliente chega ao Checkout"] --> B{"Como ele entra?"}
  B -->|"olha para a câmera"| C{"A câmera funciona?"}
  B -->|"toca em código do recibo"| K1
  B -->|"equipe toca 3 vezes no logo"| T1["Painel da equipe com as sessões ainda não pagas"]
  T1 --> T2["Equipe abre a sessão inteira na grade"]
  T2 --> Z1

  C -->|"não, venda de verdade"| C1["Avisa que a câmera não está disponível e pede o código"]
  C1 --> K1
  C -->|"não, só demonstração"| C2["Simula: sorteia uma sessão de amostra"]
  C2 --> Z1
  C -->|"sim"| D{"Alguém parou na frente?"}
  D -->|"ainda não"| D
  D -->|"rosto grande visto ou movimento seguido de parada"| E["Tira 3 quadros da câmera"]

  E --> F{"O servidor de rostos respondeu?"}
  F -->|"não e não há fotos de amostra"| N1["Não vi um rosto, olhe para a câmera"]
  F -->|"não e há fotos de amostra"| F1["Navegador compara só com as fotos de amostra"]
  F -->|"sim"| G
  F1 --> G{"Mais de uma pessoa na câmera?"}
  G -->|"sim"| N2["Uma pessoa por vez"]
  G -->|"não"| H{"Achou um rosto?"}
  H -->|"não"| N1
  H -->|"sim"| I["Procura só nas sessões com a última foto dentro da janela, 90 minutos por padrão"]

  I --> J{"Alguma foto clara da pessoa?"}
  J -->|"não"| J1{"Alguma foto em dúvida?"}
  J1 -->|"não"| N3["Não achamos fotos suas, use o código"]
  J1 -->|"sim"| J2["Pergunta: É uma destas? até 4 sessões"]
  J2 -->|"nenhuma"| V0["Volta para a câmera"]
  J2 -->|"escolheu uma"| J3["Abre só as fotos em dúvida daquela sessão"]
  J3 --> Z1

  J -->|"sim"| L["Para cada sessão com foto clara"]
  L --> L1{"Sessão de menor ou de grupo de escola?"}
  L1 -->|"sim"| L2["Entram só as fotos claras"]
  L1 -->|"não"| L3{"O rosto é principal em alguma foto clara?"}
  L3 -->|"sim"| L4["Entra a sessão inteira"]
  L3 -->|"não, só aparece ao fundo"| L2
  L2 --> M["Escolhe a sessão âncora: a com mais fotos claras, ainda não paga quando houver"]
  L4 --> M

  M --> P{"Há outra sessão só com fotos em dúvida, sem ser de menor ou escola?"}
  P -->|"não"| Q
  P -->|"sim"| P1["Pergunta: Esta sessão também é sua? uma por vez, até 3 sessões, até 3 miniaturas"]
  P1 -->|"Sim, sou eu"| P2["Junta só as fotos em dúvida dessa sessão"]
  P1 -->|"Não sou eu"| P3["Deixa essa sessão de fora"]
  P2 --> P4{"Ainda há pergunta?"}
  P3 --> P4
  P4 -->|"sim"| P1
  P4 -->|"não"| Q

  Q["Monta a lista, sem sessões pagas e sem fotos já vendidas"] --> Q1{"Sobrou alguma foto?"}
  Q1 -->|"não"| R["Já pago: mostra de novo o QR da venda"]
  Q1 -->|"sim"| Z2["Abre a primeira foto ampliada, segue no fluxo 2"]

  K1{"Campo de código travado?"} -->|"sim"| K2["Pede para aguardar"]
  K1 -->|"não"| K3{"Formato e código existem?"}
  K3 -->|"não, menos de 5 erros seguidos"| K4["Código não encontrado"]
  K3 -->|"não, 5º erro seguido"| K5["Trava o campo por 1 minuto neste terminal"]
  K3 -->|"código da sessão, com LP"| K6["Abre a sessão inteira, sem passar pela janela"]
  K3 -->|"código da galeria"| K7{"Galeria de venda que juntou sessões?"}
  K7 -->|"sim"| K8["Abre só a escolha daquela venda"]
  K7 -->|"não"| K6
  K6 --> Z1
  K8 --> Z1
  Z1{"Sessão já paga?"} -->|"sim"| R
  Z1 -->|"não"| Z3["Abre as fotos, segue no fluxo 2"]

  N1 --> V1["Volta a olhar a câmera em 6 segundos"]
  N2 --> V1
  N3 --> V1
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Disparo da busca | Rosto com largura de pelo menos 12% do vídeo e confiança 0,7, conferido a cada 1,2 s, com pausa de 8 s entre tentativas se ninguém se mexeu. Ou movimento acumulado acima de 40 seguido de 5 leituras paradas (250 ms cada). | `camFaceCheck`, `camTick` |
| Quadros da selfie | 3 quadros com 250 ms entre eles, até 960 px de largura. O servidor lê o maior rosto de cada quadro, com mínimo de 60 px, e faz a média. | `camFound`, `_buscar` |
| Sem câmera | Com o servidor ligado: estado "câmera indisponível", nunca sorteia. Sem servidor: simula depois de 4,5 s. | `camMount`, `camFound` |
| Servidor de rostos fora | O Checkout só compara no navegador se houver foto de amostra. Sem elas, responde como "sem rosto". | `faceAgente`, `faceFind` |
| Mais de uma pessoa | O 2º maior rosto tem pelo menos 0,5 vez a largura do maior. A busca não roda. | `varias_pessoas`, `VARIAS_RAZAO`, `pessoas`, `FACE_VARIAS` |
| Janela de 90 minutos | Só sessões cuja última foto (hora do clique corrigida, senão a última chegada) está nos últimos N minutos. Padrão 90. Aceita 0 (dia todo) ou de 15 a 480; fora disso, o valor mais próximo. Valor do Painel de controle, gravado em `config/busca`, relido a cada 3 s. Vale no servidor e no navegador. | `buscar_vetor`, `busca_janela_cfg`, `busca_janela_efetiva`, `_busca_janela`, `sess_pids_janela`, `buscaJanelaMin`, `sesUltima`, `faceFind` |
| Quando a janela não vale | Com `ETERNA_BUSCA_DIAS` definida (dia todo dos dias da busca, 1 dia por padrão). Na galeria por QR (`todo:true`). Em código da sessão ou da galeria. No navegador, enquanto a janela está ativa, sessão sem hora fica de fora da selfie. | `busca_janela_efetiva`, `H.do_POST` em `/rostos/buscar`, `faceAgente`, `faceFind` |
| Foto clara ou em dúvida | Clara: semelhança de 0,45 ou mais. Em dúvida: de 0,38 até menos de 0,45. Abaixo disso, descartada. | `LIMITE`, `LIMITE_TALVEZ`, `FACE_SIM`, `FACE_DUV`, `faceFind` |
| Rosto principal | O rosto que bateu tem largura de pelo menos 0,5 vez a do maior rosto daquela foto. | `ROSTO_PRINCIPAL`, `buscar_vetor`, `faceFind` |
| Fotos que a selfie abre | Só as fotos em que o rosto de quem fez a selfie aparece, nunca a sessão inteira (LGPD). O código do recibo continua abrindo a sessão toda, porque quem tem o recibo é o dono da compra. | `lojaJuntar`, `lojaIdsSo` |
| Menor e escola | Protegida: sessão marcada como menor, ou incluída numa galeria de grupo. Filtra por foto usando a lista `so.ids`. | `lojaSesProtegida`, `lojaDele`, `lojaFotos` |
| Sessão âncora | Ordena por mais fotos claras, depois maior semelhança. Fica com a primeira não paga; se todas estão pagas, a primeira. | `lojaJuntar` |
| "Esta sessão também é sua?" | Só sessões sem foto clara, sem menor e fora de escola. Máximo de 3 sessões, por maior semelhança, com 3 miniaturas das mais parecidas. "Sim" junta todas as fotos em dúvida daquela sessão, nunca a sessão inteira. | `lojaJuntar`, ação `kiosk-tv-sim`, `kiosk-tv-nao` |
| "É uma destas?" | Só quando não há nenhuma foto clara. Até 4 sessões, ordenadas por número de fotos e semelhança. Abre as fotos em dúvida da sessão tocada. | `camFound`, `faceFind`, `faceCands`, ação `cam-pick` |
| O que sai da lista | Pela selfie com sessões juntadas: sessões pagas e fotos vendidas em qualquer venda paga deste navegador. Sempre: fotos descartadas e sem imagem. | `lojaFotos`, `vendidasTodas` |
| Nada sobrando | Sessão âncora paga, ou selfie sem foto restante: mostra o QR da venda (o da venda da sessão ou o da sessão). | `vQuiosque`, `lojaFim` |
| Código digitado | Sessão: `LP` mais 5 a 10 letras ou números. Galeria: `XXXX-XXXX`, de tipo sessão, não substituída. 5 erros seguidos travam 1 minuto; o contador sobrevive a recarregar a aba. | `lojaCodigo`, `LJ_COD` |
| Nenhum resultado | A mensagem fica 6 s e a câmera volta a procurar. | `camFound`, `lojaAbrirSo` |
| Quiosque | Mesma tela do Checkout. A selfie e a janela valem igual nas duas entradas. | `vQuiosque`, `camWanted`, `faceFind` |
| Painel da equipe | 3 toques no logo em até 1,5 s. Lista até 24 sessões não pagas, sem janela e sem passar pela selfie. | `lojaLogo`, `lojaEquipe`, ação `loja-open` |

#### Divergências

- `docs/relatorios/2026-10-31-servidor-do-ponto-robusto.md`, seção 2, diz que o Checkout mostra "nunca a sessão inteira". Na v91, a sessão entra inteira quando há foto clara com rosto principal e a sessão não é protegida. `lojaDele` continua no código, mas `so.ids` passa a trazer a sessão inteira nesse caso.
- O comentário em `vQuiosque` chama "Esta sessão também é sua?" de confirmação de sessão inteira. A ação `kiosk-tv-sim` junta só as fotos em dúvida, como diz o `GUIA-DA-EQUIPE.md`.
- A exclusão da sessão sem hora durante a janela não aparece em nenhum documento. O comentário de `sesUltima` diz "null = sem hora (amostra)", e o teste em `faceFind` a deixa de fora.

### 8. Checkout

Transforma as fotos encontradas em um pedido: o cliente escolhe fotos e fundos, o sistema sugere o pacote mais barato e a equipe acompanha tudo numa segunda janela. O pedido fica sempre registrado na sessão âncora.

```mermaid
flowchart TD
  A["Fotos abertas, em ordem de hora"] --> B{"Vêm de mais de uma sessão?"}
  B -->|"sim"| B1["Cada foto mostra ponto e hora, e a grade separa em blocos"]
  B -->|"não"| C
  B1 --> C{"O recorte de fundos está disponível?"}
  C -->|"não"| D["Só as fotos do campo"]
  C -->|"sim"| C1["Oferece fundos em até 2 fotos do cliente, até 3 fundos por foto"]
  C1 --> E
  D --> E["Cliente marca e desmarca, na foto ampliada ou na grade"]
  E --> E1{"Um fundo falhou ao montar?"}
  E1 -->|"sim"| E2["A foto com fundo sai da venda e as outras seguem"]
  E2 --> E
  E1 -->|"não"| F{"Marcou pelo menos uma?"}
  F -->|"não"| F1["Botão de continuar fica desligado"]
  F1 --> E
  F -->|"sim"| G["Carrinho: sugere o pacote de menor custo"]
  G --> H{"Cliente trocou o pacote?"}
  H -->|"sim"| H1["Vale o pacote escolhido, mais fotos adicionais se passar do limite"]
  H -->|"não"| I
  H1 --> I["Cliente escolhe cartão, PIX ou dinheiro e toca em pagar"]
  I --> J{"A sessão foi paga enquanto isso?"}
  J -->|"sim"| J1["Já pago"]
  J -->|"não"| K{"Há pedido aberto nesta sessão?"}
  K -->|"sim"| K1["O pedido antigo vira substituído"]
  K -->|"não"| L
  K1 --> L{"Várias sessões, sessão protegida ou escolha parcial?"}
  L -->|"sim"| L1["Galeria própria da venda, só com as fotos da escolha"]
  L -->|"não"| L2["Galeria da sessão"]
  L1 --> M["Pedido aguardando pagamento, na sessão âncora"]
  L2 --> M
  M --> N{"Gravou neste navegador?"}
  N -->|"não"| N1["Desfaz tudo e avisa o cliente"]
  N -->|"sim"| O["Segue no fluxo 3"]

  subgraph Espelho["Segunda janela"]
    W1["Equipe toca em Abrir Checkout"] --> W2{"Pop-up liberado?"}
    W2 -->|"não"| W3["Pede para liberar as janelas do site"]
    W2 -->|"sim"| W4["Abre o Checkout e a equipe vai para o Posto de venda"]
    W4 --> W5["Cada mudança aparece em No Checkout agora"]
    W5 --> W6{"Última mensagem há mais de 15 segundos?"}
    W6 -->|"sim"| W7["Mostra Checkout fechado ou parado"]
    W6 -->|"não"| W8["Mostra foto, escolhidas, pacote, total e pagamento"]
  end
  E -.-> W5
  I -.-> W5
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Ordem das fotos | Sessão por sessão, por hora de abertura. Rótulo de ponto e hora só com mais de uma sessão. | `sesHora`, `lojaFotos`, `lojaBloco`, `lojaItems` |
| Oferta de fundos | Recorte pronto, ou modo Photoroom. Até 2 fotos do cliente, até 3 fundos por foto, pela melhor combinação. No modo local, só fotos vindas do servidor. Fundo que falhou sai da oferta e da escolha. | `fiaOferece`, `lojaAI`, `fiaFalhou`, `FIA_RUIM` |
| Contagem | Foto com fundo conta como foto do pacote: fotos do campo mais fotos com fundo. O item "Fundo de IA" do catálogo não é cobrado à parte no Checkout. | `lojaCart`, `lojaItems` |
| Catálogo inicial | Maracanã Mais, R$ 250, todas as digitais e nenhuma impressa. Tribuna de Honra, R$ 220, 12 e 12. Maracanã, R$ 190, 9 e 9. Gramado, R$ 150, 6 e 6. Zona Mista, R$ 110, 3 digitais. Arquibancada, R$ 70, 1 e 1. Foto adicional, R$ 35, digital e impressa. Preços editáveis no Catálogo. | `DATA.catalog`, `priceOf` |
| Pacote sugerido | Menor custo (pacote mais adicionais). Empate: mais impressas; depois o pacote menor. | `lojaIdeal`, `lojaPkgCusto` |
| Total e impressas | Total = pacote + fotos além do limite x preço da adicional. "Todas" não tem adicional. Impressas = menor valor entre fotos escolhidas e impressas do pacote, mais as adicionais. | `lojaCart`, `printsVenda` |
| Trava do pagamento | Botão desligado até escolher o meio. Com o meio escolhido, relê os dados e recusa se já está pago ou sem foto. Número da venda tirado com trava. | `vQuiosque`, `lojaPedido`, `pvSaleNo` |
| Regra da sessão âncora | Pedido, fotos escolhidas e situação "aguardando" ficam só na âncora. As outras sessões ficam listadas em `sessoes`. Foto de outra sessão entra em `selected` da âncora. | `lojaPedido`, `lojaSync`, `soCards` |
| Galeria da venda | Própria quando há mais de uma sessão, quando a âncora é protegida, ou quando alguma sessão não entrou inteira. Enquanto não paga, é refeita a cada pedido. | `lojaPedido`, `galDaVendaJunta`, `galDaSessao` |
| Uma pendência por sessão | Novo pedido fecha o anterior como substituído, motivo `novo_pedido`. | `dinAbertaDe`, `dinFechar`, `pvCancelEv` |
| Falha ao gravar | Restaura o estado anterior e não cria pendência. | `lojaPedido`, `saveSim` |
| 2ª janela | Abre em pop-up de 1280 x 800. As mensagens passam por `BroadcastChannel`, no máximo a cada 300 ms, e são repetidas a cada 5 s. Mais de 15 s sem mensagem é tela parada. Só funciona no mesmo navegador. | `lojaJanela`, `lojaEco`, `lojaEcoMsg`, `ecoNorm`, `ecoOff`, `ecoBody` |
| Saída do Checkout | Esc ou "Voltar ao início": zera as escolhas da tela. Se havia pedido aberto, ele continua aguardando. | `lojaEsc`, `lojaReset`, ação `loja-new` |

#### Divergências

- `DOCUMENTACAO-TECNICA.md`, seção 7.3, descreve iPad e API com `POST /faces/match` e `/sales/{id}/payment`. Essas rotas não existem no código. A busca é `POST /rostos/buscar`, e venda e pagamento correm no navegador, com eventos em `POST /ponto/eventos`.
- O comentário antes de `lojaFimSeg` diz que o Checkout volta à câmera em 5 s. O padrão é 30 s, de 5 a 120 (`LOJA_FIM_PADRAO`), como dizem o Guia e a documentação.
- A documentação da v77 lista as etapas como code, review, cart, done. O código também tem `emerg` e `talvez`.

### 9. Pagamento

Separa o pedido do cliente da venda de verdade. Só a equipe transforma um pedido em venda, depois de receber na maquininha avulsa da Imply ou em dinheiro.

```mermaid
flowchart TD
  A["Pedido aguardando pagamento"] --> B{"Meio escolhido?"}
  B -->|"dinheiro"| B1["Cliente vê: Pague no caixa, com o valor e o código"]
  B -->|"cartão ou PIX"| B2["Cliente vê: Pague na maquininha, com o valor e o código"]
  B1 --> C["Pedido aparece em Aguardando pagamento, no Posto de venda e no Caixa"]
  B2 --> C
  C --> C1{"Passou de 15 minutos?"}
  C1 -->|"sim"| C2["Tempo fica destacado"]
  C1 -->|"não"| D
  C2 --> D{"Quem está na tela pode registrar pagamento?"}
  D -->|"não"| D1["Só vê o pedido"]
  D -->|"sim"| E{"O que a equipe faz?"}

  E -->|"Recebi, em dinheiro"| H
  E -->|"Pago na maquininha"| F["Pede o NSU ou a autorização, opcional"]
  F --> G{"O número é aceito?"}
  G -->|"vazio ou de 4 a 12 números"| H
  G -->|"de 13 a 19 números"| G1["Recusa: parece número de cartão, nada é gravado"]
  G -->|"outro formato"| G2["Recusa e explica o formato"]
  G1 --> F
  G2 --> F
  E -->|"Cancelar"| X1{"Confirma o cancelamento?"}
  X1 -->|"não"| E
  X1 -->|"sim"| X2["Compra cancelada, sessão volta para pronta"]
  X2 --> X3["Checkout volta ao carrinho da mesma sessão com aviso"]
  E -->|"nada até a virada do dia"| Y1["Vira não paga, sessão volta para pronta"]
  Y1 --> Y2["Checkout volta para a câmera"]

  H{"O pedido ainda está aguardando?"} -->|"não"| H1["Avisa quem já fechou e nada muda"]
  H -->|"sim"| I{"A sessão já foi paga de outro jeito?"}
  I -->|"sim"| I1["Pedido vira substituído"]
  I -->|"não"| J["Sessão fica paga, com fotos, total, NSU e impressão pendente"]
  J --> K{"Gravou neste navegador?"}
  K -->|"não"| K1["Desfaz e pede para tentar de novo"]
  K -->|"sim"| L["Registra o pagamento no servidor e publica a galeria"]
  L --> M["Checkout mostra o QR e a contagem, segue nos fluxos 4 e 5"]

  N["Caixa do balcão: sessão montada pela equipe"] --> O{"Recebeu?"}
  O -->|"Receber e imprimir"| O1["Fecha pedido aberto como substituído e marca a sessão paga"]
  O1 --> K
  O -->|"Voltar para a fila"| O2["Sessão volta para pronta"]
  P["TEF"] --> P1["Desligado: avisa que ainda não está disponível"]
  Q["Compra na galeria online"] --> Q1["Pagamento simulado ou indisponível, ver fluxo 5"]
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Nenhum pagamento no toque | Todo meio do Checkout vira pedido aguardando. Sem venda, fundo comprado ou galeria publicada até a confirmação. | `lojaPay`, `lojaPedido` |
| Tela de espera | Mostra valor e código `XXXX-XXXX`. Não mostra QR nem contagem. | `lojaFim`, `vQuiosque` |
| Maquininha | Provedor `pos-manual`: confirmação humana, sem integração com a Imply. `PAG_PROV.tef` é nulo. | `PAG_PROV`, `pagProv` |
| Quem confirma | Só na tela da equipe, com permissão `venda.c`. Na rota do Checkout ou da galeria a confirmação é recusada. | `dinPegar`, `pendPainel` |
| NSU | Opcional. Limpa espaços, pontos, traços e barras. Aceita de 4 a 12 números. De 13 a 19 números é recusado como cartão. Dinheiro não pede. | `refLimpa`, `refErro`, `pendConfirmar` |
| "Pago" | A sessão recebe `status: paga`, carrinho, fotos, número da venda, meio, vendedor, posto e dados do pagamento. A impressão começa como pendente quando o pacote tem impressas. Fundos entram como comprados. | `pendConfirmar`, `impIniciar` |
| Publicação da galeria | Publica quando `pontoModo()` não é `posto`. Como `state.posto.disp` nunca recebe valor no código, publica sempre. | `pendConfirmar`, `pontoModo`, `galDaVenda` |
| Cancelamento | Pede confirmação. Pedido vira cancelado, motivo `cancelada_no_caixa`, evento com motivo `cancelada_no_posto`. A sessão só volta para pronta se ainda estava aguardando. | `dinCancelar`, `dinFechar`, `pvCancelEv` |
| Volta do Checkout | Confere a cada 5 s. Confirmado: QR e contagem. Cancelado: carrinho com aviso. Não paga ou substituído: volta à câmera. | `lojaPendCheck` |
| Fim do dia | Pedido aguardando de dia anterior vira não pago, motivo `fim_do_dia`. Fechados com mais de 30 dias saem, com teto de 1000. | `dinVirada`, `DIN_DIAS`, `DIN_MAX` |
| Alerta de espera | Mais de 15 minutos. | `CAIXA_ALERTA_MIN`, `dinAtrasada` |
| Caixa do balcão | Paga direto, sem pedido do Checkout. Fecha pedido aberto com motivo `pago_de_outro_jeito`. | `caixaConfirm`, `vCaixa` |
| Pagamento simulado | `PagamentoSimulado`, padrão de `ETERNA_PAGAMENTO`, só na galeria atendida pelo servidor. Aprova na hora, marca `teste: true` e fica fora das métricas. Outro valor impede o agente de iniciar. Webhook responde 501. | `PagamentoSimulado`, `pagamento_escolhido`, `metricas_dia`, `gal_post` |

#### Divergências

- `DOCUMENTACAO-TECNICA.md`, seção da v77: o diagrama diz "venda paga (lojaPay)", a seção "Segurança da galeria por QR" diz que cartão e PIX viram pagos pelo toque do cliente, e "Estado novo no app" diz que `lojaPay` publica a galeria. No código, `lojaPay` só cria o pedido aguardando.
- `GUIA-DA-EQUIPE.md`, seção "Dinheiro: aguardando caixa": diz que a tela final tem o QR e que abrir esse QR mostra "esperando o caixa". A tela de espera não tem QR, e o texto `ljCashQR` ficou sem uso. O passo `aguarda_caixa` só existe no modo local, com o token no mesmo navegador. Com a galeria ainda não publicada, a nuvem responde que não existe.
- `pendConfirmar` e seu comentário tratam um modo `posto` que nunca liga na v91 (`state.posto.disp` só é iniciado como nulo).
- O relatório de 31/10 diz que "nada mora só no navegador". O comentário em `simDocs` diz que sessões, galerias e vendas já têm dono no servidor. `SIM.caixaDin`, `status` da sessão e `SIM.galerias` ficam no `localStorage`, fora de `SIM_MAPA`, `SIM_INTEIRO` e `SIM_LISTA`. O Guia acerta ao exigir Checkout e Caixa no mesmo navegador.

### 10. Fila de impressão

Depois do pagamento, leva as fotos escolhidas até o papel, pela fila do servidor ou pela DNP ligada no próprio terminal. A fila acompanha a impressora de verdade; a baixa do rolo e o encerramento da venda dependem da confirmação da equipe.

```mermaid
flowchart TD
  A["Pagamento confirmado"] --> Q1["Tela do cliente: QR em cima da primeira foto escolhida, com o código"]
  Q1 --> Q2["Volta sozinha para a câmera em 30 segundos por padrão"]
  A --> B{"O pacote tem impressas e há fotos?"}
  B -->|"não"| B1["Sem impressão para esta venda"]
  B -->|"sim"| C["Venda aparece como para imprimir, com favoritas primeiro"]
  C --> C1{"Marcou fotos?"}
  C1 -->|"não"| C2["Botão Imprimir fica desligado"]
  C1 -->|"sim"| D["Equipe toca em Imprimir e o sistema prepara as fotos"]
  D --> E{"Alguma ficou pronta?"}
  E -->|"nenhuma"| E1["Avisa para tentar de novo"]
  E1 --> C
  E -->|"sim, talvez sem alguma com fundo"| F{"Servidor com impressora e terminal fora da lista local?"}

  F -->|"não: DNP local"| G["Navegador imprime direto na DNP do terminal"]
  G --> L
  F -->|"sim: servidor"| H{"O servidor aceitou?"}
  H -->|"não: mais de 20 fotos, sem impressora ou falha"| H1["Avisa que a impressora do servidor não imprimiu"]
  H1 --> C
  H -->|"sim"| I["Entra na fila única e o terminal mostra quantos pedidos estão na frente"]
  I --> J["Monitor da fila atualiza a cada 2 segundos"]
  J --> J1{"A impressora está bem?"}
  J1 -->|"sem papel, sem ribbon, tampa aberta, papel preso, desligada ou sem cabo"| J2["Fila espera, sem pular foto, e mostra o motivo"]
  J2 --> J3{"Equipe cancela?"}
  J3 -->|"sim"| J4["Para antes da próxima foto"]
  J3 -->|"não, resolve a impressora"| J1
  J1 -->|"sim"| J5["Foto só conta quando sai da DNP"]
  J5 --> J6{"Todas saíram?"}
  J6 -->|"ainda não"| J1
  J6 -->|"sim"| J7["Pedido impresso, em Prontas para retirar"]
  J6 -->|"faltou foto ou falhou"| J8["Pedido com erro, mostra quantas saíram"]
  J4 --> J9["Pedido cancelado, mostra quantas saíram"]
  J8 --> R{"Ação no monitor?"}
  J9 --> R
  J7 --> R
  R -->|"Imprimir as que faltaram"| R1["Pedido novo só com o que falta, no fim da fila"]
  R -->|"Reimprimir"| R2["Pedido novo com todas, no fim da fila"]
  R1 --> I
  R2 --> I

  I --> L{"A equipe confere o resultado no painel da venda"}
  L -->|"Saiu certo"| M["Baixa do rolo uma vez por foto"]
  L -->|"Não saiu"| N["Registra a tentativa, sem baixar o rolo"]
  N --> C
  M --> O{"Todas as impressas foram feitas?"}
  O -->|"não"| P["Avisa quantas faltam"]
  P --> C
  O -->|"sim"| S["Venda impressa"]
  S --> T["Reimprimir pela venda: escolhe fotos e motivo"]
  T --> D
```

```mermaid
stateDiagram-v2
  state "Na fila" as NaFila
  state "Imprimindo" as Imprimindo
  state "Impresso" as Impresso
  state "Com erro" as ComErro
  state "Cancelado" as Cancelado
  [*] --> NaFila : servidor aceitou o pedido
  NaFila --> Imprimindo : vez do pedido e impressora livre
  NaFila --> Cancelado : equipe cancelou
  Imprimindo --> Imprimindo : saiu uma foto, soma uma
  Imprimindo --> Imprimindo : impressora parou, mostra o motivo e espera
  Imprimindo --> NaFila : servidor reiniciou, continua da foto que faltava
  Imprimindo --> Impresso : todas as fotos saíram
  Imprimindo --> ComErro : faltou foto ou o envio falhou
  Imprimindo --> Cancelado : equipe cancelou, para antes da próxima foto
  Impresso --> [*]
  ComErro --> [*]
  Cancelado --> [*]
  note right of ComErro
    Reimprimir e Imprimir as que faltaram
    criam um pedido novo no fim da fila
  end note
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| QR sobre a foto | Só depois de confirmado. Usa a 1ª foto de `selected` da sessão. Sem foto do campo escolhida, o QR aparece sozinho. O QR aponta para o token da galeria. | `vQuiosque` (variável `fotoQR`), `.lj-qrfoto`, `drawLojaQR` |
| Tempo da tela final | Padrão 30 s, de 5 a 120 (`SIM.lojaFimSeg`). | `lojaFimSeg`, `lojaTick` |
| Se a venda imprime | Impressas maiores que zero e pelo menos uma foto. Caso contrário, situação "sem impressão". | `impIniciar`, `impFotos` |
| Lista de fotos | Favoritas primeiro, depois fotos do campo e fotos com fundo. Corta no número de impressas. Pacote prevendo mais que as fotos existentes conta "sem foto". A equipe pode trocar quais imprimir, até o que falta. | `impFotos`, `impSel`, `impFalta` |
| Preparo | Fundo em alta resolução com tempo limite de 60 s; imagens com 15 s para abrir. Foto que falha fica de fora. Sem nenhuma pronta, estado de erro. | `printMontar`, `compHi` |
| Servidor ou DNP local | Servidor quando o agente está ligado com `ETERNA_IMPRESSORA` e o nome do terminal não está em `IMP_LOCAIS`. Local usa `window.print`, que sai direto com `--kiosk-printing`. | `impImprimir`, `IMP_LOCAIS` |
| Envio ao servidor | JPEG com até 1800 px no lado maior, qualidade 0,92. De 1 a 20 fotos por pedido. | `impImprimir`, `imprimir` |
| Ordem e impressora | Ordem de chegada. Só espera pedido anterior que disputa a mesma impressora. A venda sai inteira na primeira livre entre as do terminal (`ETERNA_IMPRESSORA_POSTOS`), ou entre todas. | `imprimir_fila`, `imp_destinos` |
| Foto contada | Linha `FOTO` só depois da fila do Windows vazia e impressora parada. A próxima só vai depois disso. | PowerShell `Espera-Livre`, `imprimir_fila` |
| Pedido impresso | Saída 0, última linha `OK` e fotos contadas iguais às enviadas. Faltando uma, com erro "X de Y". | `imprimir_fila` |
| Avisos | Pouco papel, sem papel, ribbon acabando, sem ribbon, tampa aberta, papel preso, desligada ou sem cabo, pede manutenção, bandeja cheia, não encontrada no Windows, impressora parou, não termina há mais de 2 minutos. Aviso não derruba o pedido: fica esperando até resolver ou cancelar. | `IMP_ESTADO_PS1`, `Espera-Livre`, `imprimir_fila` |
| Monitor | O app lê a fila a cada 2 s. O estado das impressoras é lido do Windows a cada 10 s. Colunas: Na fila, Imprimindo agora, Prontas (12 últimas), Com erro ou canceladas (4 últimas). Previsão de 14 s por foto. Terminados somem depois de 3 h. Guarda os 200 últimos pedidos. | `vImpFila`, `impFilaPoll`, `imp_monitor`, `imp_fila_json`, `imp_pedido` |
| Ações do monitor | Na fila ou imprimindo: Cancelar. Com parte impressa: Imprimir as que faltaram e Reimprimir tudo. Demais: Reimprimir. Nos dois casos, pedido novo, com as fotos que ainda existem no disco. | `vImpFila`, `imp_acao`, ação `if-acao` |
| Reinício do servidor | Pedido na fila ou imprimindo volta para a fila, a partir da foto que faltava. | `imp_retomar`, `imp_salvar` |
| Sem impressora real | `ETERNA_IMPRESSORA_TESTE` simula 6 s por foto e desliga o monitor do Windows. Sem `ETERNA_IMPRESSORA`, a rota responde 503. | `imprimir_fila`, `imp_monitor`, `gal_post` |
| Saiu certo | Baixa o rolo por foto nova do `postoNome`. Com todas feitas, venda "impressa". Vale também para a reimpressão, que grava a lista e o motivo. | `impOk` |
| Não saiu | Registra `nao_saiu`, sem baixa. A venda continua como estava. | `impFalha` |
| Reimpressão pela venda | Só depois de impressa. Até o número de impressas da venda, com motivo obrigatório: Falhou, Outra cópia, Cor, Outro. | `impReimprimir`, `impReMax`, `IMP_MOTIVOS` |
| Rolo e alerta | 700 fotos por rolo, alerta abaixo de 40. Venda paga sem impressão há mais de 10 min vira alerta. | `ROLO_CAP`, `ROLO_ALERTA`, `IMP_ALERTA_MIN` |

#### Divergências

- `DOCUMENTACAO-TECNICA.md`, seção da v83: "Uma DNP por notebook, pelo Chrome". Na v91 é uma das duas opções, e o servidor tem preferência quando tem impressora. O painel da venda ainda diz "impressora deste posto" mesmo no modo servidor.
- O relatório de 31/10 diz que a foto só conta quando sai da DNP. Isso vale para a fila do servidor. No app, a venda passa para "enviada" assim que o servidor aceita o pedido, e os botões "Saiu certo" e "Não saiu" aparecem antes de a foto sair. Rolo e situação da venda dependem da resposta da equipe, sem ligação com a contagem da fila.
- Reimprimir pelo monitor da fila não baixa o rolo nem registra em `s.impressoes`. Só a reimpressão pelo painel da venda faz isso. Nenhum documento registra a diferença.

### 11. Galeria online e compra pela nuvem

Entrega as fotos no celular do cliente depois da visita. O QR ou o código abrem a galeria, a selfie confirma quem é, e cada foto mostra o que ele pode baixar e o que ainda está à venda.

```mermaid
flowchart TD
  P1["Venda confirmada ou galeria criada pela equipe"] --> P2["Servidor recebe o manifesto, prepara as fotos e manda para a nuvem"]
  P2 --> P3{"Conseguiu publicar?"}
  P3 -->|"não"| P4["Tenta de novo com espera crescente"]
  P4 --> P2
  P3 -->|"galeria encerrada"| P5["Fica como encerrada e não reabre"]
  P3 -->|"sim"| A

  A["Cliente abre o QR, o cartão impresso ou digita o código"] --> B{"Token ou código reconhecido?"}
  B -->|"não"| B1["Galeria não encontrada, oferece digitar o código"]
  B -->|"sim"| C{"Situação da galeria?"}
  C -->|"encerrada ou vencida"| C1["Galeria expirada"]
  C -->|"sem resposta da rede"| C2["Suas fotos estão chegando, tenta de novo em 20 segundos"]
  C -->|"fotos ainda subindo"| C2
  C2 --> C
  C -->|"pronta"| D["Pede consentimento, do titular ou do responsável"]
  D --> E{"Marcou e concordou?"}
  E -->|"não"| D
  E -->|"sim"| F["Câmera: frontal para adulto, traseira para criança"]
  F --> G["Tira a selfie sozinha com um rosto em 2 leituras, ou pelo botão ou arquivo"]
  G --> H{"Tentativas bloqueadas?"}
  H -->|"sim"| H1["Bloqueado, mostra até que horas"]
  H -->|"não"| I{"Mais de uma pessoa?"}
  I -->|"sim"| I1["Uma pessoa por vez, sem contar como erro"]
  I1 --> F
  I -->|"não"| J{"Achou rosto e bateu com a galeria?"}
  J -->|"sem rosto"| J1["Conta um erro e deixa tentar de novo"]
  J -->|"não bateu, leitura incompleta"| J2["Fotos ainda chegando, sem contar erro"]
  J -->|"não bateu"| J1
  J1 --> F
  J2 --> F
  J -->|"bateu"| K{"Grupo de escola?"}
  K -->|"sim"| K1["Abre só as fotos em que a criança aparece"]
  K -->|"não"| K2["Abre todas as fotos da galeria"]
  K1 --> L["Acesso vale 1 hora"]
  K2 --> L

  L --> M{"Direito de cada foto"}
  M -->|"comprada ou cortesia"| N["Suas fotos: pode baixar"]
  M -->|"à venda"| O["Mais fotos, com marca d'água"]
  N --> N1{"Link ainda válido?"}
  N1 -->|"sim"| N2["Baixa a foto em alta"]
  N1 -->|"não"| N3{"Acesso de 1 hora ainda vale?"}
  N3 -->|"sim"| N4["Pede links novos e tenta de novo"]
  N4 --> N2
  N3 -->|"não"| N5["Volta para a selfie com aviso"]
  N5 --> F

  O --> Q["Cliente marca fotos e escolhe Pix ou cartão"]
  Q --> R{"Quem atende a galeria?"}
  R -->|"nuvem"| R1["Compra online indisponível: fale com a equipe"]
  R -->|"servidor do estádio"| R2["Pagamento de teste aprova na hora"]
  R -->|"navegador da venda, sem servidor"| R2
  R2 --> R3["Foto vira comprada, venda marcada como teste"]
  R3 --> N

  S["60 dias depois da criação, ou encerrada pela equipe"] --> T["Galeria sai do ar"]
  T --> U["Limpeza diária apaga as fotos da galeria e os rostos na nuvem"]
  U --> V["Lápide no servidor: o token nunca mais reabre"]
  V --> C1
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Quem responde | Página em https usa a nuvem. Fora disso, o servidor, ou `window.ETERNA_AGENTE`. Sem resposta em 2,5 s e token no mesmo navegador: modo local. | `galApi`, `pubLoad` |
| Formato | Token de 22 caracteres. Código `XXXX-XXXX`, que também exige selfie. | `pubRead`, `pubCodigo` |
| Cartão com QR impresso | Lido no recibo. Aceita o endereço inteiro ou só o token. Mesmo cartão na mesma sessão: mostra de novo. Cartão já usado noutra venda: recusa. A galeria antiga vira substituída e o QR vai para a tela do cliente. Na nuvem, token com fotos de outra sessão é recusado (409). | `cartaoAtrelar`, `cartaoToken`, `publicar` em `app.py` |
| Publicação | O app tenta em 10 s, 30 s, 60 s e depois a cada 300 s. Só publica se todas as fotos vieram do servidor. Do servidor para a nuvem: espera de 5 s dobrando, até 300 s. | `galFilaTick`, `nuvem_galerias_loop` |
| Foto de outra sessão | O servidor recusa com 400 foto de outra sessão conhecida, ou fora da escolha da venda. | `_gal_confere_sessoes` |
| Consentimento | Obrigatório. Registra tipo, versão e idioma, sem imagem. A nuvem só lê rostos das fotos depois do primeiro consentimento. | `vGaleriaQR`, `gal_post`, `rosto`, `indexar` |
| Quem é tratado como criança | Galeria de grupo ou com `menor` verdadeiro: texto do responsável e câmera traseira. | `pubKid`, `pubSelfieAbrir` |
| Selfie automática | A cada 600 ms. 2 leituras seguidas com um único rosto de pelo menos 40 px e 20% da largura. Botão só se o detector falhar. Enviar arquivo fica disponível. | `selfieMount`, `vGaleriaQR` |
| Bateu com a galeria | Nuvem: 85 de 100 em adulto, 95 em grupo ou sessão com menor. Servidor: 0,45 em sessão, 0,50 em grupo. Sessão abre todas as fotos do manifesto; grupo abre só as fotos que bateram. | `rosto`, `LIMIAR_ADULTO`, `LIMIAR_CRIANCA`, `gal_post`, `LIMITE`, `LIMITE_MENOR` |
| Tentativas | 5 erros bloqueiam 15 min. Várias pessoas e leitura incompleta não contam. Grupo de escola tem tetos próprios por visitante e por hora. | `falhas`, `falhou`, `evento_permite`, `pubFalhou` |
| Direito por foto | Prioridade: comprada, cortesia, venda. Comprada vem de `selected` desta venda ou da compra online. Comprada nunca regride ao republicar. | `galAtualizar`, `gal_mesclar`, `publicar` em `app.py` |
| O que aparece | Comprada e cortesia: original para baixar. Venda: vitrine. Original nunca vai para foto à venda. | `galeria_obj`, `vGaleriaQR`, `gal_get` |
| Links assinados | Nuvem: 5 min. Servidor: 15 min, com redirecionamento para a nuvem de 5 min quando a foto já subiu. App renova com mais de 12 min de galeria ou depois de falha no download; 2ª falha abre o link em outra aba. | `URL_TTL` nos dois lados, `link`, `nuvem_link`, `pubBaixar`, `pubRenovar` |
| Acesso | 1 h. Vencido responde 401 e volta para a selfie. | `ACESSO_TTL`, `pubAcessoVenceu` |
| Compra online | Nuvem: sempre responde `compra_indisponivel` (503). Servidor: `min(n x R$ 39, R$ 250)` nos valores iniciais, calculado no servidor; o mesmo pedido repetido não duplica. Só foto à venda dentro do acesso. | `handler` em `app.py`, `gal_post`, `pubPagar`, `pubTotal` |
| 60 dias | `expira` = criação + 60 dias. Republicar nunca aumenta a validade. | `GAL_DIAS`, `galNovo`, `gal_mesclar`, `publicar` em `app.py` |
| Encerrar | Grupo de escola: a administração grava `expira` igual a agora e publica. LGPD: fluxo 12. Cartão: encerra a galeria substituída. | ação `gal-ev-encerrar`, `cartaoAtrelar` |
| Limpeza e lápide | No servidor, uma vez por dia: grava a lápide e apaga a pasta da galeria. Republicar responde 410, informação responde 410 e código responde 404. Na nuvem, limpeza diária apaga a coleção de rostos de galeria vencida ou encerrada. | `galeria_loop`, `lapide_gravar`, `gal_post`, `limpeza` |

#### Divergências

- Links: `DOCUMENTACAO-TECNICA.md` e o comentário de `pubBaixar` dizem 15 min. Na nuvem são 5 min, como diz `NUVEM.md`.
- Compra: a documentação da v77 descreve aprovação de teste. A nuvem nunca aprova: `COMPRA_ONLINE` e `CompraOnline` no `template.yaml` só mudam o campo `compra` da resposta, e o app ignora esse campo. No celular, o cliente vê a tela de pagamento com "Pagamento de teste" e recebe a mensagem de falha.
- O aviso da tela Galerias online e `CONTEXTO-ETERNA.md` dizem que o celular não alcança o servidor e que fica em "chegando". Hoje o celular usa a nuvem.
- Encerrar: a documentação diz que grava `encerrada: true` no app e no agente. A ação do grupo só muda `expira`. `gal_validar` não leva `encerrada` e o app não chama `POST /galerias/encerrar`.
- Limiares: a documentação só cita 0,45 e 0,50. A nuvem usa outro motor e outra escala (85 e 95). Sessão de menor fora de grupo usa 95 na nuvem e 0,45 no servidor.
- `docs/planos/2026-10-30-cartao-qr-impresso.md` diz que o cartão vira o QR "da galeria da venda". `cartaoAtrelar` trabalha com a galeria da sessão (`galDaSessao`), que não acha a galeria própria de venda com sessões juntadas. O mesmo vale para o código do recibo (`galCod`) e o botão "Mostrar ao cliente" (ação `eco-qr`).

### 12. Exclusão LGPD

Atende o cliente que não comprou e pede para não guardar as fotos dele. Tira foto, rosto e galeria do servidor e da nuvem, sem desfazer. Sessão vendida não passa por aqui.

```mermaid
flowchart TD
  A["Cliente pede à equipe para apagar as fotos"] --> B["Equipe abre a sessão na Fila do balcão"]
  B --> B1{"Sessão já está com as fotos apagadas?"}
  B1 -->|"sim"| B2["Mostra o selo Fotos apagadas, com data e responsável"]
  B1 -->|"não"| C{"Sessão está paga?"}
  C -->|"sim"| C1["Bloqueado: as fotos ficam com o cliente"]
  C -->|"não"| D{"A pessoa da equipe tem permissão em galerias?"}
  D -->|"não"| D1["Botão não aparece"]
  D -->|"sim"| E["Toca em Cliente pediu: apagar as fotos"]
  E --> F{"Confirma? Não dá para desfazer"}
  F -->|"cancelar"| B
  F -->|"sim"| G{"O servidor respondeu?"}
  G -->|"não"| G1["Sem conexão, nada foi apagado"]
  G -->|"erro"| G2["Não apaguei, com o motivo"]
  G -->|"sim"| H["Servidor apaga: foto, miniatura, recorte e original da pasta vigiada"]
  H --> I["Apaga os rostos lidos e tira da sessão, das pendências e da busca"]
  I --> J["Marca a foto como excluída, para não voltar a entrar"]
  J --> K{"Nuvem ligada?"}
  K -->|"sim"| K1["Apaga as duas versões da foto na nuvem e tira da fila de envio"]
  K -->|"não"| L
  K1 --> L["Encerra as galerias da sessão, aqui e na nuvem"]
  L --> L1["Na nuvem: sai do ar, código e rostos apagados"]
  L1 --> M["Grava no registro: quantas fotos, quem pediu, qual posto, sem imagem"]
  M --> N{"Houve falha em algum passo?"}
  N -->|"sim"| N1["Avisa: com falhas, veja o registro"]
  N -->|"não"| O["Avisa quantas fotos saíram"]
  N1 --> P["Sessão fica sem fotos e com o selo Fotos apagadas"]
  O --> P
  P --> Q["Outros computadores tiram as fotos ao ler as sessões"]
  Q --> Q1{"A sessão está paga naquele computador?"}
  Q1 -->|"sim"| Q2["Mantém a venda e só registra uma linha no log"]
  Q1 -->|"não"| Q3["Tira as fotos da sessão daquele navegador"]
```

#### Decisões

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Quem pede | O cliente, à equipe. A galeria e o Checkout não têm essa opção. | `vFila`, ação `lgpd-pedir` |
| Quem executa | Usuário com `galerias.u`. Botão só para sessão não paga. | `can('galerias','u')`, ação `lgpd-excluir` |
| Bloqueio de sessão vendida | `status` da própria sessão igual a paga: botão escondido e, se a ação chegar, mensagem "Venda paga: as fotos ficam com o cliente". | ação `lgpd-excluir` |
| O que é enviado | Todas as fotos da sessão, até 500, e as galerias de tipo sessão que contêm a sessão, até 20. | ação `lgpd-excluir`, `gal_post` |
| O que sai do servidor | Índice da biblioteca, foto, miniatura, recorte e o original da pasta vigiada com o mesmo nome e hash. Rostos e foto em `rostos.db`. Sessões em memória e em disco. Matriz de busca do dia. Fila de rostos pendentes. | `lgpd_excluir`, `ff_esquecer`, `sess_esquecer`, `sess_esquecer_disco` |
| Não volta a entrar | O hash fica em `lgpd_excluidas`, gravado em disco. | `lgpd_excluir`, `LGPD_EXCLUIDAS` |
| O que sai da nuvem | Versões alta e vitrine, e o item da fila de envio. A galeria encerrada apaga a coleção de rostos e o código curto. | `lgpd_excluir`, `nuvem_galeria_enfileira`, `publicar`, `apagar_rostos` |
| Galerias | Grava `encerrada: true`, `lgpd: true` e `expira` igual a agora. Galeria de grupo fica fora da lista. | `lgpd_excluir`, ação `lgpd-excluir` |
| O que fica | Número da venda e carrinho marcado como apagado na sessão, selo `s.lgpd`, `lgpd.log` e métrica da foto com pid, nome do arquivo, sessão, posto e autor. | ação `lgpd-excluir`, `lgpd_excluir`, `metrica_grava` |
| Falhas parciais | Cada falha é anotada e o processo continua. Responde `ok: false` com até 5 falhas. O app marca a sessão como apagada mesmo assim. | `lgpd_excluir`, ação `lgpd-excluir` |
| Outros computadores | Sessão fechada só muda pela LGPD. Sem venda paga: tira as fotos. Com venda paga: mantém e registra uma linha. | `srvPull`, `srvLgpd` |
| Prazo sem pedido | Rostos, sessões e galerias: 60 dias. | `RETENCAO_DIAS`, `sess_limpar`, `limpar_rostos`, `GAL_DIAS` |

#### Divergências

- A docstring de `lgpd_excluir` diz que "a venda continua no registro financeiro, sem as fotos". A trava da sessão paga está no app e o caminho normal nem chega lá.
- `GUIA-DA-EQUIPE.md` não tem nenhuma instrução sobre esse botão.
- A ação não fecha um pedido que esteja aguardando pagamento na sessão. Nenhum documento trata esse caso.

## Plataforma e operação

### 13. Login e permissões hoje

Descreve como uma pessoa entra e o que ela passa a ver, do jeito que o app funciona na v91. A conferência acontece no navegador: a seção "Pendências de segurança" de `DOCUMENTACAO-TECNICA.md` registra que o servidor ainda não é a fonte da verdade.

```mermaid
flowchart TD
  ABRE["Pessoa abre o app"] --> ROTA{"Qual endereço?"}
  ROTA -->|"link de galeria"| GALERIA["Galeria do cliente, sem login"]
  ROTA -->|"endereço do Checkout"| LOJA["Checkout sem login, em tela cheia"]
  ROTA -->|"qualquer outro"| ABALOJA{"Esta aba já virou Checkout?"}
  ABALOJA -->|"sim"| ENTRAR["Tela de entrada"]
  ABALOJA -->|"não"| SESSAO{"Há sessão salva com menos de 12 horas e pessoa ativa?"}
  SESSAO -->|"sim"| LOGADO["Pessoa conectada"]
  SESSAO -->|"não"| ENTRAR

  ENTRAR --> EMAIL{"E-mail com formato válido?"}
  EMAIL -->|"não"| ERROEMAIL["Aviso: digite um e-mail válido"]
  ERROEMAIL --> ENTRAR
  EMAIL -->|"sim"| MAIL{"Endereço do serviço de e-mail está preenchido?"}
  MAIL -->|"não, é o caso hoje"| CODLOCAL["Código de 6 dígitos gerado no navegador e mostrado em uma caixa de entrada simulada"]
  MAIL -->|"sim, não usado hoje"| RESPOSTA{"Resposta do serviço"}
  RESPOSTA -->|"enviado"| CODREAL["Código enviado por e-mail"]
  RESPOSTA -->|"pedidos demais"| ESPERA["Aviso: aguarde antes de pedir outro"]
  RESPOSTA -->|"e-mail recusado"| ERROEMAIL
  RESPOSTA -->|"outra resposta ou sem resposta"| CODLOCAL
  ESPERA --> ENTRAR

  CODLOCAL --> VENCEU{"Passaram 10 minutos?"}
  CODREAL --> VENCEU
  VENCEU -->|"sim"| EXPIROU["Aviso: código expirado"]
  EXPIROU --> ENTRAR
  VENCEU -->|"não"| CONFERE{"Código confere?"}
  CONFERE -->|"não"| ERRADO["Aviso: código incorreto; pode reenviar ou trocar o e-mail"]
  ERRADO --> VENCEU
  CONFERE -->|"sim"| CADASTRO{"E-mail no cadastro e ativo?"}
  CADASTRO -->|"não"| SEMCADASTRO["Aviso: este e-mail não tem acesso"]
  SEMCADASTRO --> ENTRAR
  CADASTRO -->|"sim"| GRAVA["Salva a sessão e o último acesso"]
  GRAVA --> LOGADO

  LOGADO --> INICIO{"Tela inicial da pessoa está permitida?"}
  INICIO -->|"sim"| TELAINI["Abre a tela inicial dela"]
  INICIO -->|"não"| TEMTELA{"Há alguma tela permitida?"}
  TEMTELA -->|"não"| SEMACESSO["Aviso: seu acesso ainda não foi liberado"]
  TEMTELA -->|"sim"| SOCHK{"Só tem o módulo Checkout?"}
  SOCHK -->|"sim"| PRIMEIRA["Primeira tela permitida, sem menu"]
  SOCHK -->|"não"| HOME["Tela Início com o menu"]

  TELAINI --> NAVEGA{"Pode ver a tela pedida?"}
  HOME --> NAVEGA
  PRIMEIRA --> NAVEGA
  NAVEGA -->|"módulo com Ver e tela no menu da pessoa"| MOSTRA["Mostra a tela"]
  NAVEGA -->|"não"| INICIO
  MOSTRA --> ACAO{"A ação grava algo?"}
  ACAO -->|"não"| MOSTRA
  ACAO -->|"sim, e tem a letra exigida"| EXECUTA["Executa"]
  ACAO -->|"sim, sem a letra ou tela sem módulo"| NEGA["Aviso: sem permissão"]

  MOSTRA --> SAIR{"Como a sessão termina?"}
  SEMACESSO --> SAIR
  SAIR -->|"botão sair"| LOGOUT["Apaga a sessão salva e o vendedor do ponto"]
  SAIR -->|"cadastro removido ou desativado em outra tela ou computador"| REMOVIDO["Aviso: seu acesso foi removido"]
  REMOVIDO --> LOGOUT
  SAIR -->|"sessão com mais de 12 horas, ao recarregar"| ENTRAR
  LOGOUT --> ENTRAR

  LOJA --> LOJASAI{"Saída do Checkout"}
  LOJASAI -->|"Esc em aba sem pessoa conectada"| LOJA
  LOJASAI -->|"3 toques no logo, depois Sair"| LOGOUT
  LOJASAI -->|"botão da equipe, até 10 min depois de abrir e antes do primeiro cliente"| TELAINI
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Serviço de e-mail | `MAIL_API=''` na v91. Vazio: o código nasce no navegador. Os serviços `/auth/codigo` e `/auth/verificar` existem em `servidor/email` e na nuvem, mas o app não aponta para eles | `MAIL_API`, `mailApi`, `sendCode` |
| Código | 6 dígitos, validade de 10 minutos | `sendCode`, `checkCode` |
| Modo real, quando ligado | 202 = enviado; 429 = aguarde; 400 = e-mail inválido; outra resposta = modo local. Na conferência: 200 grava o token e entra; "expirado" volta ao e-mail; sem conexão avisa | `sendCode`, `checkCode` |
| Cadastro | `userFor`: e-mail existente e `active` diferente de falso. O pedido de código não consulta o cadastro; a conferência acontece em `login` | `userFor`, `login` |
| Sessão salva | Validade de 12 horas, em `eterna.session`; não é carregada em aba marcada como Checkout | `sessionLoad`, `LOJA_ABA` |
| Módulos | 17 módulos, cada um com Criar, Ver, Alterar e Excluir | `MODULES`, `OPS`, `can` |
| Perfis prontos | Admin, Fotógrafo, Atendimento e venda, Validador, Supervisor, Checkout; cadastro também pode nascer sem acesso | `PRESETS`, `SEED_USERS` |
| Ver uma tela | Módulo com Ver e tela no menu da pessoa. Checkout: Ver em `quiosque` ou `venda`. Permissões: exige também Alterar | `canView`, `menuOk` |
| Tela de abertura | `inicio` permitido; sem telas = sem acesso; só Checkout = primeira tela sem menu; demais = Início | `homeView`, `isBare` |
| Ação que grava | Ação listada exige a letra no módulo fixo da ação ou no módulo da tela; tela sem módulo é barrada | `WRITE_OPS`, `ACT_MOD`, `guardAct` |
| Cadastro sincronizado | Com servidor: coleção `usuarios` do estado. Sem servidor: cópia do navegador em `eterna.users.v1` | `dbLigar`, `agenteDb` |
| Cadastro sem administrador | O app recria os administradores da lista inicial | `ensureAdmin` |
| Sair | Para a câmera, apaga `eterna.posto.vendedor` e `eterna.session`, volta à entrada | `logout` |
| Checkout sem login | `#loja` marca a aba com `eterna.lojaTab` e não carrega a sessão salva. O vendedor das vendas é o declarado ao abrir pela equipe | `render`, `lojaJanela`, `postoVendedor` |
| Saídas do Checkout | Esc em aba sem pessoa: volta ao início. 3 toques em 1,5 s abrem o painel da equipe. Saída normal apaga a sessão. Volta ao app só por 10 minutos depois de "Abrir Checkout" | `lojaEsc`, `lojaSair`, `lojaLogo`, `lojaEquipeOn`, `lojaVoltarApp` |
| Situação declarada pelo projeto | Login e permissões são conferidos no navegador; o agente não confere usuário nas rotas | `DOCUMENTACAO-TECNICA.md`, "O que é protótipo na v78" e "Pendências de segurança" |

### 14. Onde cada dado mora e como sincroniza

Mostra como vendas e estado da equipe chegam ao servidor e o que acontece quando o servidor ou o navegador caem. O navegador guarda uma cópia e uma fila; o servidor é o dono dos dados que já confirmou.

| Dado | Onde mora | Cópia ou fila | Vai para a nuvem |
|---|---|---|---|
| Vendas (eventos criar, pagar, cancelar, impressão, rolo) | `~/Eterna/ponto/vendas.db` | Fila `eterna.ponto.fila.v1` no navegador | Backup do banco |
| Usuários, permissões, registro, diário, treino, venue, revisões, bandeiras, função do dia | `~/Eterna/ponto/estado.db` | Fila `eterna.db.fila.v1` | Backup do banco |
| Preços, catálogo, estoque, ajustes, descartes, fundos, cortesias | `estado.db`, coleção `sim`, um registro por item | `eterna.sim.v1` no navegador | Backup do banco |
| Sessões | `~/Eterna/ponto/sessoes/AAAA-MM-DD.json` | Lidas pelo app | Backup de hoje e ontem |
| Galerias | `~/Eterna/galerias/<token>/sessao.json` | `SIM.galFila` no navegador e fila no `nuvem.db` | Banco da galeria |
| Fotos originais e miniaturas | `~/Eterna/inbox/AAAA-MM-DD/` e `thumbs/` | Nenhuma | Original não sobe; sobem alta e vitrine |
| Rostos lidos | `~/Eterna/rostos.db` | Nenhuma | Não vão para o backup |
| Resumo do dia | `~/Eterna/ponto/metricas/AAAA-MM-DD.json` | Nenhuma | Backup de hoje e ontem |
| Métricas técnicas por foto | `~/Eterna/metricas.jsonl` | Nenhuma | Não |
| Fila de impressão | `~/Eterna/impressao/fila.json` | Nenhuma | Não |

```mermaid
sequenceDiagram
  participant T as Tela do caixa
  participant F as Fila no navegador
  participant S as Servidor Eterna
  participant V as Banco de vendas
  participant E as Banco de estado
  participant W as Vigia

  Note over T,V: Venda
  T->>F: Grava o evento da venda
  alt Servidor no ar
    F->>S: Envia até 50 eventos em ordem
    S->>V: Grava e confirma no disco
    alt Evento novo
      V-->>S: Gravado
      S-->>F: Resultado ok e sai da fila
    else Evento repetido
      V-->>S: Já existia e não conta duas vezes
      S-->>F: Resultado já e sai da fila
    else Evento fora do contrato
      S-->>F: Resultado recusado
      F->>F: Sai da fila e vai para a lista de conflitos
    end
  else Servidor fora ou rede caída
    F->>F: Segura e tenta a cada 5 segundos e quando a rede volta
    F->>F: Evento com mais de 7 dias ou acima de 2000 sai e fica anotado como descarte
  end

  Note over T,E: Estado da equipe
  T->>F: Grava a mudança
  alt Servidor no ar
    F->>S: Envia até 200 mudanças
    S->>E: Grava cada item com nova revisão
    S-->>F: Confirma e o lote sai da fila
  else Servidor fora
    F->>F: Segura e tenta a cada 3 segundos
  end
  loop A cada 3 segundos
    F->>S: Pergunta as revisões de todas as coleções
    alt Coleção mudou ou há mudança local pendente
      S-->>F: Devolve a coleção inteira sem os apagados
      F->>T: Atualiza a tela e o que está na fila vale por cima
    else Nada mudou
      S-->>F: Mesma revisão e nada é baixado
    end
  end

  Note over S,W: Servidor caiu
  loop A cada 30 segundos
    W->>S: Pergunta se responde
    alt Respondeu
      W->>W: Zera as faltas
    else Sem resposta três vezes seguidas
      W->>S: Encerra o que sobrou, atualiza se houver versão e liga de novo
      W->>W: Espera 60 segundos antes de voltar a conferir
    end
  end
  Note over W: Se o próprio vigia cair a tarefa do Windows o liga em 1 minuto
  S->>S: Ao ligar recarrega sessões, fila de impressão, galerias e leituras pendentes
  T->>S: A tela percebe a volta em até 2,5 segundos
  F->>S: As filas seguem de onde pararam

  Note over T,F: Navegador caiu
  alt Dados do navegador preservados
    T->>F: Ao abrir, a fila continua e é enviada
  else Dados do navegador apagados
    S-->>T: O que foi confirmado volta do servidor
    Note over F: O que ainda não tinha subido é perdido
  end
  Note over T,S: Primeira leitura em navegador com dados só dele
  F->>S: O que só existe neste navegador sobe
  S-->>F: No restante o servidor vale por cima
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Quando a venda sobe | Na hora, a cada 5 s e no evento de rede; só se o servidor estiver marcado como ligado; 1 envio por vez | `pvEvento`, `pontoFlush` |
| Lote de vendas | Até 50 eventos por envio; corpo até 2 MB | `pontoFlush`, `ev_receber`, `gal_post` |
| Repetição | `idem` único (`venda:seq`); gravação com `insert or ignore`: novo = `ok`, repetido = `ja` | `vendas_db`, `ev_receber` |
| Evento recusado | Tipo fora de criar, pagar, cancelar, impressao, rolo, ou identificador inválido; guardados até 500 em `eterna.ponto.conflitos.v1` | `_ev_limpo`, `pontoFlush` |
| Durabilidade | SQLite com `synchronous=full`; confirma depois do `commit` | `vendas_db`, `estado_db`, `ev_receber` |
| Limite da fila de vendas | 7 dias e 2.000 eventos; o excesso sai e fica em `eterna.ponto.descartes.v1` | `pvPoda`, `PV_DIAS`, `PV_MAX` |
| Envio do estado | Na hora e a cada 3 s; lote de 200 no navegador; servidor aceita até 500 por pedido e corpo de 8 MB | `agenteDb`, `gal_post`, `estado_gravar` |
| Item do estado ignorado | Coleção fora da lista, id vazio ou acima de 300 caracteres, valor acima de 512 KB. O servidor pula o item, e o lote sai da fila do navegador | `estado_gravar`, `ESTADO_MAX`, `agenteDb` |
| Coleções | `usuarios`, `usuarios_login`, `usuarios_log`, `diario`, `treino`, `config`, `reviews`, `bandeiras`, `funcao`, `sim` | `ESTADO_COLS` |
| Revisão | Contador global crescente; valor nulo apaga; a gravação não compara revisão, vale a última que chegou | `estado_gravar`, `estado_col`, `estado_revs` |
| Mudança local x servidor | Fila pendente vale por cima na tela. Em `sim`: primeira leitura, servidor vale e o que só existe aqui sobe; depois, mudança não enviada fica, e o que outro computador apagou sai | `agenteDb`, `simAplica`, `simSobe`, `dbMigra` |
| Fora da coleção `sim` | Sessões, galerias, vendas e fila de envio têm dono próprio | comentário antes de `SIM_MAPA` |
| Navegador cheio | Falha ao gravar marca `state.simCheio` | `pvEvento`, `agenteDb` |
| Saber se o servidor voltou | Consulta `/status` a cada 2,5 s | `agentPoll` |
| Vigia | Pergunta a cada 30 s com limite de 10 s; 3 faltas (cerca de 1min30) religam; espera 60 s | `eterna-vigia.ps1 Responde`, `Liga` |
| Tarefa do Windows | Religa o vigia em 1 minuto, até 999 vezes; não abre duas | `instalar-servidor.ps1` |
| Retomada ao ligar | Sessões, fila de impressão, galerias e fotos sem leitura de rosto voltam | `sess_carregar`, `imp_retomar`, `gal_indexar`, `rostos_thread` |

### 15. O que sobe para a nuvem

Mostra as quatro saídas para a nuvem: fotos, galerias, backup e o teste de saúde. Cada uma tem regra própria para falta de internet.

```mermaid
flowchart TD
  subgraph LIGAR["Ao ligar o servidor"]
    L1{"Nuvem configurada como S3?"}
    L1 -->|"não"| L2["Envio de fotos desligado"]
    L1 -->|"sim"| L3{"Bucket informado?"}
    L3 -->|"não"| L2
    L3 -->|"sim"| L4{"Conectou ao bucket?"}
    L4 -->|"não, por exemplo sem internet"| L5["Envio de fotos fica desligado até o próximo reinício do programa"]
    L4 -->|"sim"| L6["Envio de fotos ligado, com 4 envios em paralelo"]
  end

  subgraph FOTOS["Fotos"]
    F1["Foto nova entra no servidor"] --> F2{"Envio de fotos está ligado?"}
    F2 -->|"não"| F3["Não entra na fila"]
    F3 --> F4["Só sobe depois com o reenvio manual"]
    F2 -->|"sim, vendida ou não"| F5["Entra na fila guardada em disco"]
    F4 -.-> F5
    F5 --> F6{"Pausa de teste ativa?"}
    F6 -->|"sim"| F6A["Nada sobe e a fila aguarda"]
    F6A --> F6
    F6 -->|"não"| F7["Gera versão alta sem dados da câmera e vitrine com marca d'água"]
    F7 --> F8{"Enviou e a conferência bateu?"}
    F8 -->|"sim"| F9["Marcada como enviada; o original não sobe"]
    F8 -->|"não, inclusive sem internet"| F10["Espera de 5 segundos a 5 minutos, crescendo"]
    F10 --> F6
  end

  subgraph GALERIAS["Galerias"]
    G1["Venda ou tela de galerias publica no servidor"] --> G2{"Galeria já encerrada neste servidor?"}
    G2 -->|"sim"| G3["Recusada e o app marca como encerrada"]
    G2 -->|"não"| G4{"Manifesto válido e fotos da sessão certa?"}
    G4 -->|"não"| G5["Erro e o app tenta de novo em 10 s, 30 s, 1 min e depois a cada 5 min"]
    G4 -->|"sim"| G6{"API da galeria configurada?"}
    G6 -->|"não"| G7["Fica só no servidor"]
    G6 -->|"sim"| G8["Entra na fila guardada em disco"]
    G8 --> G9{"A nuvem aceitou?"}
    G9 -->|"sim"| G10["Publicada para o celular do cliente"]
    G9 -->|"não, inclusive sem internet"| G11["Espera de 5 segundos a 5 minutos, crescendo"]
    G11 --> G8
  end

  subgraph BACKUP["Backup"]
    B1["A cada 2 minutos"] --> B2{"Há bucket configurado?"}
    B2 -->|"não"| B3["Sem backup"]
    B2 -->|"sim"| B4{"Algum banco existe e mudou?"}
    B4 -->|"não"| B1
    B4 -->|"sim"| B5["Tira cópia consistente de vendas e estado"]
    B5 --> B6["Envia a cópia atual, a cópia do dia, resumo e sessões de hoje e ontem"]
    B6 --> B7{"Deu certo?"}
    B7 -->|"sim"| B8["Status do backup: certo, com a hora"]
    B7 -->|"não, inclusive sem internet"| B9["Status do backup: erro"]
    B8 --> B1
    B9 --> B1
  end

  subgraph ENTREGA["Entrega ao cliente"]
    E1{"A foto é comprada ou cortesia?"}
    E1 -->|"sim"| E2["Link temporário da versão alta e da vitrine"]
    E1 -->|"não"| E3["Link temporário só da vitrine"]
  end

  L6 --> F1
  L5 --> F1
  L2 --> F1
  F9 --> E1
  G10 --> E1
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Ligar o envio | `ETERNA_NUVEM=s3`, `ETERNA_BUCKET` e `head_bucket` com sucesso. Falhou: a função termina e não tenta de novo | `nuvem_loop` |
| O que entra na fila | Toda foto nova ao entrar, sem olhar se foi vendida; `INSERT OR IGNORE` por foto | `ingest_file`, `nuvem_enfileira` |
| Foto com envio desligado | Não é registrada; `POST /nuvem/reenviar` põe de novo todas as fotos e galerias abertas, e exige nuvem ligada | `nuvem_enfileira`, `nuvem_reenviar` |
| Versões enviadas | Alta com lado máximo de 3.000 px, JPEG 88, sem EXIF nem GPS; vitrine de 900 px com marca d'água | `nuvem_versoes`, `_vitrine`, `ALTA_LADO` |
| Conferência | `Content-MD5` no envio e `ETag` igual ao MD5 | `nuvem_envia` |
| Ritmo | Olha a fila a cada 1 s, pega até 40, 4 envios (`ETERNA_NUVEM_ENVIADORES`) | `nuvem_loop` |
| Falha ao enviar | Espera `min(300, 5 × 2^tentativas)` segundos, sem limite de tentativas | `enviador`, `nuvem_galerias_loop` |
| Pausa de teste | Arquivo `~/Eterna/nuvem-pausa` existe: nada sobe | `NUVEM_PAUSA` |
| Publicar galeria | Local em `/galerias/publicar`; encerrada responde 410; comprada não regride e validade não aumenta | `gal_post`, `gal_validar`, `gal_mesclar` |
| Fila do app para o servidor | Só foto vinda do servidor; espera 10 s, 30 s, 60 s e 300 s | `galFilaTick` |
| Fila do servidor para a nuvem | Só com `ETERNA_GALERIA_API`; acorda a cada 5 s ou no pedido; até 20 por volta; identifica-se com o segredo do ponto | `nuvem_galeria_enfileira`, `nuvem_galerias_loop` |
| Regras na nuvem | Sessão diferente em token já usado responde 409; encerrada tira do ar e apaga os rostos | `publicar` em `servidor/galeria-nuvem/app.py` |
| Backup | Espera 120 s; só com `ETERNA_BUCKET`; compara a data dos bancos e do arquivo WAL; só com mudança | `backup_loop` |
| Caminhos do backup | `backup/<pc>/<banco>.db`, `backup/<pc>/dia/AAAA-MM-DD/<banco>.db`, `backup/<pc>/metricas/` e `backup/<pc>/sessoes/`; a do dia é sobrescrita até o dia virar | `backup_loop` |
| Fora do backup | Rostos, fotos originais, `nuvem.db` e arquivos de configuração | `backup_loop` |
| Falha no backup | Grava erro em `/status`; não marca a mudança como enviada, então repete no próximo ciclo | `backup_loop`, `backup` |
| Saúde da nuvem | A cada 2 min abre um arquivo de teste pelo S3 e pelo CloudFront, se configurado | `nuvem_saude` |
| Link da foto | Validade de 5 minutos; CloudFront quando ligado, com reserva direta no S3 | `nuvem_link`, `LINK_TTL`, `link` em `app.py` |
| Compra online | Desligada por padrão (`COMPRA_ONLINE=0`); a nuvem responde indisponível | `handler` em `app.py` |

### 16. Atualização do programa

Mostra como uma versão testada do programa do servidor chega ao venue e o que acontece em cada falha. Vale só para o `eterna-agente.py`; o app segue outro caminho, indicado no diagrama.

```mermaid
flowchart TD
  subgraph LIBERAR["Liberar uma versão no GitHub"]
    A1["Pessoa cria a etiqueta da versão no ponto testado"] --> A2["Automação liberar-versao é acionada"]
    A2 --> A3{"O programa compila?"}
    A3 -->|"não"| A4["Automação falha e nenhuma versão nova é publicada"]
    A3 -->|"sim"| A5["Calcula o SHA-256"]
    A5 --> A6["Publica a release com o programa e o SHA-256"]
  end

  subgraph SERVIDOR["No servidor do venue"]
    B1{"Quando o vigia age?"}
    B1 -->|"vigia iniciou e o Eterna não responde"| B2["Encerra o programa que sobrou"]
    B1 -->|"vigia iniciou e o Eterna responde"| B0["Só acompanha, sem atualizar"]
    B1 -->|"três faltas seguidas"| B2
    B0 --> B1
    B2 --> B3{"Canal escolhido no nuvem.env"}
    B3 -->|"teste"| C1["Baixa o programa da linha principal"]
    B3 -->|"estável, padrão ou qualquer outro valor"| D1{"Achou a última release?"}
    D1 -->|"não, sem release ou sem internet"| KEEP["Fica a versão do disco e registra o motivo"]
    D1 -->|"sim"| D2{"A release tem o programa e o SHA-256?"}
    D2 -->|"não"| KEEP
    D2 -->|"sim"| D3{"Já é a versão instalada e o arquivo existe?"}
    D3 -->|"sim"| LIGA["Liga o Eterna"]
    D3 -->|"não"| D4["Baixa o programa e o SHA-256"]
    C1 --> E1{"Baixou e tem ao menos 50 mil bytes?"}
    D4 --> E1
    E1 -->|"não"| KEEP
    E1 -->|"sim, canal teste"| E3{"Compila?"}
    E1 -->|"sim, canal estável"| E2{"SHA-256 confere?"}
    E2 -->|"não"| KEEP
    E2 -->|"sim"| E3
    E3 -->|"não"| KEEP
    E3 -->|"sim"| E4["Troca o arquivo e grava a versão"]
    E4 --> LIGA
    KEEP --> LIGA
    LIGA --> F1["Espera 60 segundos"]
    F1 --> F2{"Respondeu?"}
    F2 -->|"sim"| F3["Pergunta de novo a cada 30 segundos"]
    F3 --> F2
    F2 -->|"não, três vezes seguidas"| B1
  end

  subgraph APP["App das telas"]
    G1["Atualização publicada no site eterna.photo"] --> G2["Servidor renova a cópia em até 60 segundos"]
    G2 --> G3["Ponto recebe ao recarregar a tela"]
  end

  A6 -.->|"consultada quando o vigia religa o programa"| D1
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Gatilho da release | Push de etiqueta `v*`; compila com `py_compile`; `gh release create` com `eterna-agente.py` e `eterna-agente.py.sha256` | `.github/workflows/liberar-versao.yml` |
| Quando o vigia procura versão | Só dentro de `Liga`: início com o Eterna fora do ar, ou 3 faltas. Não há consulta periódica | `eterna-vigia.ps1 Liga`, `Atualiza` |
| Canal | `ETERNA_CANAL` no `nuvem.env`: `teste` segue o `main`; qualquer outro valor ou ausência = estável | `Canal` |
| Canal estável | Lê `releases/latest` com limite de 30 s; download com limite de 60 s | `Atualiza` |
| Canal teste | Sem SHA-256; só tamanho e compilação; grava `main` em `versao.txt` | `Atualiza` |
| Já instalada | `versao.txt` igual à etiqueta e arquivo existente: não baixa | `Atualiza` |
| Tamanho mínimo | Menos de 50.000 bytes = falha de download | `Atualiza` |
| SHA-256 | Calculado no arquivo baixado e comparado ao da mesma release. Sem o SHA-256 da release, a troca é recusada. | `Atualiza` |
| Compilação | `python -m py_compile`; falhou: apaga o `.novo` | `Atualiza` |
| Troca | `Move-Item` sobre o arquivo e `versao.txt`; registro em `~/Eterna/vigia.log` | `Atualiza`, `Registra` |
| Janela de troca | Sem janela de horário, sem conferir venda aberta ou fila de impressão | `Liga` |
| Falha depois da troca | Não há volta automática: o vigia só religa em 3 faltas e fica no arquivo do disco | `eterna-vigia.ps1` |
| Situação da release | A consulta pública a `releases/latest` respondeu 404 em 04/11/2026, e o repositório local não tem etiquetas. No canal estável, o vigia hoje fica na versão do disco | `Atualiza`; `docs/planos/2026-11-02-pedidos-do-eduardo-pos-v91.md` |
| Vigia e primeira cópia | O vigia e a instalação inicial do programa vêm do `main`, fora do canal de release | `instalar-servidor.ps1`, `instalar-vigia.ps1`, `iniciar-eterna.bat` |
| App | Segue o `ETERNA_APP_ORIGIN`, fora do canal de release; renovado a cada 60 s na próxima abertura | `H.app` |

### 17. Instalação do servidor

Mostra o que o `Eterna-Servidor.exe` faz, passo a passo. O `.exe` só leva o `instalar-servidor.ps1` embutido e o executa; a cópia embutida hoje é igual ao script do repositório.

```mermaid
flowchart TD
  INI{"Como foi iniciado?"}
  INI -->|"Eterna-Servidor.exe"| X1["Windows pede permissão de administrador"]
  X1 --> X2["Extrai o script para a pasta temporária e executa com pausa no fim"]
  INI -->|"script direto"| ADM{"Está como administrador?"}
  X2 --> ADM
  ADM -->|"não"| ERRO["Mostra o erro e termina com falha; passos já feitos ficam"]
  ADM -->|"sim"| P1{"A pasta do usuário dono foi informada?"}
  P1 -->|"sim"| P3{"Existe o Python preparado do Eterna nessa pasta?"}
  P1 -->|"não"| P2["Procura em todos os usuários; com mais de um, usa a pasta Eterna alterada por último"]
  P2 --> P3
  P3 -->|"não"| ERRO
  P3 -->|"sim"| V1["Baixa o vigia da linha principal"]
  V1 --> V2{"Baixou com mais de 500 bytes?"}
  V2 -->|"sim"| V3["Troca o vigia"]
  V2 -->|"não"| V4{"Já havia vigia no disco?"}
  V3 --> PARA
  V4 -->|"não"| ERRO
  V4 -->|"sim"| PARA["Para o vigia e o Eterna que estiverem rodando"]
  PARA --> AT{"Há atalho do vigia na inicialização de algum usuário?"}
  AT -->|"sim"| AT2["Desliga o atalho, para não subirem dois"]
  AT -->|"não"| TAREFA
  AT2 --> TAREFA["Cria ou substitui a tarefa Eterna do sistema, ao iniciar o Windows"]
  TAREFA --> FW1["Reúne o Python preparado e o Python de origem, quando encontrado"]
  FW1 --> FW2["Desfaz bloqueios do firewall gravados para esses programas"]
  FW2 --> FW3["Refaz as regras do Eterna: Python e portas 8765 e 2121"]
  FW3 --> FW4{"A política da empresa ignora regras locais em algum perfil?"}
  FW4 -->|"sim"| FW5["Aviso: quem estiver nessa rede não conecta"]
  FW4 -->|"não"| FW6["Confirma o firewall liberado"]
  FW5 --> EN
  FW6 --> EN["Energia: não dorme na tomada e fechar a tampa não faz nada"]
  EN --> AL["Remove atalhos antigos do Eterna de cada usuário"]
  AL --> CH{"Chrome instalado?"}
  CH -->|"sim"| AL2["Cria o atalho comum na área de trabalho, com ícone do Chrome"]
  CH -->|"não"| AL3["Cria o atalho comum, sem esse ícone"]
  AL2 --> LIGA
  AL3 --> LIGA["Liga a tarefa e pergunta a cada 3 segundos, por até 3 minutos"]
  LIGA --> RESP{"Respondeu?"}
  RESP -->|"não"| AV["Aviso: veja o registro do vigia"]
  RESP -->|"sim"| OK["Mostra impressora, nuvem e rostos, e os endereços para os pontos"]
  AV --> FIM["Mensagem final: pode reiniciar; o Eterna sobe sozinho"]
  OK --> FIM
  FIM --> PAUSA{"Iniciado com pausa?"}
  PAUSA -->|"sim, pelo .exe"| PA["Espera Enter e o .exe apaga o script temporário"]
  PAUSA -->|"não"| TERM["Termina"]
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Elevação do `.exe` | Manifesto com `requireAdministrator` | `agente/instalador/app.manifest` |
| Script embutido | Recurso `instalar-servidor.ps1`, montado com o `csc` do .NET | `Eterna-Servidor.cs`, `montar.ps1` |
| Administrador | Sem o papel de administrador: erro e fim | `instalar-servidor.ps1`, início |
| Falha geral | `$ErrorActionPreference='Stop'` e `trap`: mostra o erro e sai com código 1, sem desfazer | `instalar-servidor.ps1`, `trap` |
| Pasta do dono | `-Base`, ou perfil com `Eterna\venv\Scripts\python.exe`, o de `Eterna` mais recente | `instalar-servidor.ps1` |
| Pré-requisito | Python e venv criados antes no usuário dono; a mensagem pede rodar o `instalar-vigia` | `instalar-servidor.ps1`; `CHECKLIST-SERVIDOR.md`, passo 7 |
| Vigia | Baixado do `main`, limite de 60 s, maior que 500 bytes | `instalar-servidor.ps1` |
| Parar o que roda | Processos com `eterna-vigia.ps1` ou `python.exe` com `eterna-agente.py` | `instalar-servidor.ps1` |
| Atalho antigo | `Eterna vigia.cmd` vira `.desligado` em cada usuário | `instalar-servidor.ps1` |
| Tarefa | `Eterna`, conta SYSTEM, ao iniciar, nível mais alto, sem limite de tempo, roda em bateria, 999 religadas a cada 1 min, nunca duas | `Register-ScheduledTask` |
| Pasta dos dados | Continua no perfil do dono, via `ETERNA_BASE`; o vigia ajusta `USERPROFILE` | `instalar-servidor.ps1`, `eterna-vigia.ps1` |
| Firewall | Entrada, perfil Any: venv, Python de `pyvenv.cfg` e portas TCP 8765 e 2121; regras `Eterna*` antigas são removidas | `instalar-servidor.ps1` |
| Política da empresa | `AllowLocalFirewallRules = False` no armazenamento ativo gera aviso | `Get-NetFirewallProfile` |
| Energia | Suspensão e hibernação na tomada = 0; tampa = nada, na tomada e na bateria | `powercfg` |
| Atalho | `Eterna.url` na área pública, apontando para o próprio computador na porta 8765 | `instalar-servidor.ps1` |
| Conferência | `/status` igual a 200, a cada 3 s, por até 3 min | `instalar-servidor.ps1` |
| Máquina fora do domínio | `instalar-tarefa.ps1` cria a tarefa em nome do dono, pedindo a senha dele. Em máquina corporativa a tarefa do sistema é o caminho documentado | `instalar-tarefa.ps1`; `CHECKLIST-SERVIDOR.md`, passo 7 |

**O que muda no instalador Linux** (análise de `docs/pesquisa/2026-11-02-eterna-como-produto.md`, seção 4; nada disso está implementado)

| Hoje (Windows) | No Linux |
|---|---|
| Impressão pelo PowerShell | Pillow (corte 10×15) e CUPS/IPP. A DNP DS-RX1HS precisa de teste de bancada antes de decidir; conferir se há driver Linux oficial |
| Tarefa do sistema e vigia | Serviço `systemd` com usuário `eterna` sem shell; programa em `/opt/eterna`, dono root, e dados em `/var/lib/eterna` |
| Atualização pelo vigia | Pacote `.deb` assinado em repositório próprio, ou release assinada conferida por um timer |
| Firewall do Windows | nftables ou ufw: 8765 só para caixas e VPN; 2121 só para a rede das câmeras; SSH só pela VPN |
| powercfg | Servidor sem suspensão e BIOS religando quando a energia volta |
| Sem BitLocker | LUKS no disco de dados, com desbloqueio pelo TPM |
| Windows Update | Atualização automática de segurança fora do horário, e registro de acesso com auditd |

### 18. Métricas e relatórios

Mostra de onde saem os números do Painel e como o resumo diário é montado. O Painel junta duas visões: a do navegador e Roverpix, e a seção "Servidor do ponto · todos os caixas".

```mermaid
flowchart TD
  subgraph FONTES["Fontes no servidor"]
    S1[("Fotos e rostos lidos")]
    S2[("Sessões do dia e da véspera")]
    S3[("Eventos das vendas dos caixas")]
    S4[("Vendas online registradas neste servidor")]
  end

  subgraph RESUMO["Resumo do dia"]
    T1["A cada 10 minutos, véspera e hoje"] --> T2["Monta o resumo"]
    S1 --> T2
    S2 --> T2
    S3 --> T2
    S4 --> T2
    T2 --> V1{"Para cada venda: como está?"}
    V1 -->|"sem evento de criação"| V2["Ignorada"]
    V1 -->|"cancelada e não paga"| V3["Conta como cancelada"]
    V1 -->|"não paga e não cancelada"| V2
    V1 -->|"paga"| V4["Conta como venda e faturamento"]
    V2 --> T3
    V3 --> T3
    V4 --> T3["Grava o arquivo do dia, guardado para sempre"]
  end

  subgraph PEDIDO["Pedido do período"]
    P1["Tela pede o período ao servidor"] --> P2{"Origem autorizada?"}
    P2 -->|"não"| P3["Recusado"]
    P2 -->|"sim"| P4{"Datas válidas?"}
    P4 -->|"não"| P5["Erro de datas inválidas"]
    P4 -->|"sim"| P6{"Para cada dia do período"}
    P6 -->|"é hoje"| P7["Refaz na hora"]
    P6 -->|"dia passado com arquivo"| P8["Lê o arquivo como está"]
    P6 -->|"dia passado sem arquivo"| P9["Dia fica de fora"]
    P7 --> P10["Devolve os dias, no máximo 400"]
    P8 --> P10
    P9 --> P10
  end

  subgraph PAINEL["Painel no app"]
    A1["Pessoa escolhe período, ponto e fonte"] --> A2{"App conectado ao servidor?"}
    A2 -->|"não"| A3["Seção do servidor não aparece"]
    A2 -->|"sim"| A4{"Mesmo período pedido há menos de 60 segundos?"}
    A4 -->|"sim"| A5["Usa o último resultado"]
    A4 -->|"não"| P1
    P10 --> A6{"Resposta certa?"}
    P3 --> A7["Aviso: sem conexão com o servidor do ponto"]
    P5 --> A7
    A6 -->|"sim"| A5
    A6 -->|"não"| A7
    A5 --> A8["Seção Servidor do ponto · todos os caixas, com tabelas por fotógrafo, vendedor, ponto e pagamento"]
    A1 --> B1{"Fonte dos cartões principais"}
    B1 -->|"Eterna"| B2["Vendas guardadas neste navegador"]
    B1 -->|"Roverpix"| B3["Roverpix ao vivo ou dados importados"]
    B1 -->|"Tudo"| B4["Roverpix mais vendas deste navegador"]
    B3 --> B5{"Dado ao vivo com mais de 15 minutos?"}
    B4 --> B5
    B5 -->|"sim"| B6["Etiqueta: Roverpix desatualizado"]
    B5 -->|"não"| B7["Mostra sem aviso"]
  end
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Atualização do resumo | Véspera e hoje a cada 600 s; dias anteriores não são refeitos | `metricas_loop` |
| Arquivo do dia | `ponto/metricas/AAAA-MM-DD.json`, gravação atômica; o código não apaga | `metricas_gravar`, `MET_DIR` |
| Rota | `GET /metricas/dia?de=&ate=`; sem data = hoje; hoje é refeito; limite de 400 dias | `metricas_periodo`, `do_GET` |
| Fotos | `rostos.db`, por dia; sem linhas: soma das sessões | `metricas_dia` |
| Sessões | Exclui as removidas; venda de sessão de ontem conta para o fotógrafo | `metricas_dia` |
| Venda contada | Exige `criar` e `pagar`. Cancelada sem pagar vai para `canceladas` | `metricas_dia` |
| Paga e depois cancelada | Pelo código, continua contada como venda no resumo: o teste é "cancelada e não paga", e o cancelamento na Lista de vendas muda só o estado no navegador, sem evento `cancelar`. O evento só sai para pedido pendente. Não testado | `metricas_dia`, `pvCancelEv`, `sales-cancel` |
| Dia da venda | Lê a venda inteira se ela tem algum evento no dia, e soma sem filtrar pelo dia. Pelo código, venda com eventos em dois dias entra nos dois. Não testado | `_ev_ler`, `metricas_dia` |
| Impressões | Evento `impressao`: resultado `ok` soma em `impressoes`, demais em `impressoes_falhas` | `metricas_dia` |
| Vendas online | Só o arquivo local `galerias/vendas-online.jsonl`, sem as marcadas como teste. A API da nuvem não devolve vendas ao servidor | `vendas_ler`, `metricas_dia` |
| Conversão | Sessões com venda ÷ sessões; fotos vendidas ÷ fotos | `metricas_dia` |
| Ticket médio | Faturamento ÷ vendas | `metricas_dia` |
| Painel, seção do servidor | Só com `state.agent.on`; cache de 60 s por período | `srvMetPull`, `srvMetPainel`, `srvMetSoma` |
| Painel, cartões principais | Fonte `tudo`, `roverpix` ou `eterna`; a opção Eterna é rotulada "vendas deste computador" | `vPainel`, `painelFiltro`, `allSalesSim` |
| Roverpix | A cada 300 s, 30 dias; app recebe totais; etiqueta com mais de 15 min | `rover_loop`, `rover_data`, `applyLive`, `vPainel` |
| Métricas técnicas | `metricas.jsonl`, relido e podado para 3 dias; rota `/metricas` traz fila de rostos e uso da máquina | `metricas_carrega`, `metrica_grava`, `do_GET` |

### 19. Ciclo de vida de uma foto

Acompanha uma foto da chegada até a exclusão, com os prazos reais do código. O original no disco do servidor não tem prazo: só sai por pedido do cliente.

```mermaid
stateDiagram-v2
  state "Chegando ao servidor" as Chegando
  state "Incompleta aguardando reenvio" as Incompleta
  state "Ignorada" as Ignorada
  state "Repetida e avisada" as Repetida
  state "Guardada no servidor" as Guardada
  state "Rosto na fila de leitura" as FilaRosto
  state "Rostos lidos" as RostoLido
  state "Leitura de rosto apagada" as RostoApagado
  state "Aguardando decisão de sessão" as PendSessao
  state "Em sessão aberta" as SessaoAberta
  state "Em sessão fechada" as SessaoFechada
  state "Arquivo de sessão apagado" as SessaoApagada
  state "Na fila da nuvem" as FilaNuvem
  state "Na nuvem em alta e vitrine" as NaNuvem
  state "Fora da fila da nuvem" as ForaFila
  state "Removida pela regra do bucket" as RemovidaBucket
  state "Em galeria de 60 dias" as EmGaleria
  state "Rostos lidos na nuvem" as RostoNuvem
  state "Galeria vencida ou encerrada" as GaleriaFim
  state "Original sem prazo de exclusão" as OriginalFica
  state "Excluída a pedido do cliente" as ExcluidaLgpd

  [*] --> Chegando
  Chegando --> Ignorada: já excluída a pedido do cliente
  Chegando --> Incompleta: arquivo cortado na pasta vigiada
  Incompleta --> Chegando: câmera manda de novo em até 10 minutos
  Incompleta --> Ignorada: depois de 10 minutos
  Chegando --> Repetida: mesma assinatura de arquivo
  Chegando --> Guardada: foto nova com miniatura
  Ignorada --> [*]
  Repetida --> [*]

  state Guardada {
    [*] --> FilaRosto
    FilaRosto --> RostoLido: leitura concluída
    RostoLido --> RostoApagado: 60 dias depois do dia da foto
    --
    [*] --> PendSessao
    PendSessao --> SessaoAberta: rosto lido ou 20 segundos vencidos
    SessaoAberta --> SessaoFechada: 60 segundos sem clique
    SessaoFechada --> SessaoApagada: 60 dias
    --
    [*] --> FilaNuvem: envio ligado
    [*] --> ForaFila: envio desligado
    ForaFila --> FilaNuvem: reenvio manual
    FilaNuvem --> FilaNuvem: falha e nova tentativa
    FilaNuvem --> NaNuvem: envio conferido
    NaNuvem --> RemovidaBucket: 7 dias no bucket de teste
    --
    [*] --> OriginalFica
  }

  Guardada --> EmGaleria: venda ou galeria publicada
  EmGaleria --> RostoNuvem: primeiro consentimento na selfie online
  RostoNuvem --> GaleriaFim: 60 dias ou encerramento
  EmGaleria --> GaleriaFim: 60 dias ou encerramento
  GaleriaFim --> [*]: limpeza diária e token não reabre

  Guardada --> ExcluidaLgpd: pedido do cliente
  EmGaleria --> ExcluidaLgpd: pedido do cliente
  ExcluidaLgpd --> [*]: venda segue no registro sem as fotos
```

**Decisões**

| Decisão | Regra exata | Onde no código |
|---|---|---|
| Entradas | FTP próprio, pasta vigiada, FTP remoto e cartão | `FTPSession`, `pasta_vigiada`, `rftp_loop`, `scan_card` |
| Identidade da foto | Hash de conteúdo; os 12 primeiros caracteres viram o identificador | `ingest_file`, `quick_hash` |
| Excluída antes | Hash em `lgpd-excluidas.json`: não entra de novo | `ingest_file` |
| Arquivo cortado | Pasta vigiada espera 10 minutos e depois ignora | `pasta_vigiada`, `jpeg_completo` |
| Arquivo na origem | Pasta vigiada: fica onde está, sem prazo. FTP remoto: nada é apagado lá | `pasta_vigiada`, comentário de `rftp_loop` |
| Original no servidor | `inbox/AAAA-MM-DD/`, sem prazo: as únicas remoções do arquivo estão na exclusão a pedido | `ingest_file`, `lgpd_excluir`, `galeria_loop` |
| Miniatura | `thumbs/`, sem prazo | `ingest_file`, `lgpd_excluir` |
| Rostos locais | 60 dias contados pela pasta do dia; limpa ao ligar a leitura e uma vez por dia | `RETENCAO_DIAS`, `limpar_rostos`, `rostos_thread`, `galeria_loop` |
| Sessão | 60 s sem clique fecham; espera do rosto de 20 s desde a chegada | `SESS_PAUSA`, `SESS_ROSTO_ESPERA` |
| Arquivo de sessão | 60 dias | `SESS_RET_DIAS`, `sess_limpar` |
| Recorte | 2 dias, teto de 5 GB (`ETERNA_RECORTES_GB`), apagando os mais antigos | `REC_DIAS`, `REC_TETO_GB`, `limpar_recortes` |
| Validade da galeria | 60 dias a partir da criação; não aumenta em republicação | `GAL_DIAS`, `galNovo`, `gal_mesclar` |
| Arquivos da galeria no servidor | Originais de compradas e cortesias, e vitrines; saem na limpeza diária depois do vencimento, com registro que impede reabrir | `gal_processar`, `galeria_loop`, `lapide_gravar` |
| Rostos na nuvem | Só depois do primeiro consentimento; coleção apagada ao encerrar e na limpeza diária | `rosto`, `apagar_rostos`, `limpeza` em `app.py` |
| Registro da galeria na nuvem | Validade + 7 dias | `ttl_de` em `app.py` |
| Registros na nuvem | Eventos por 90 dias, consentimentos por 400 dias | `docs/NUVEM.md`, seção 4 |
| Bucket | Teste: 7 dias. Produção: 60 dias previstos no documento. A regra é configurada fora deste código | `docs/NUVEM.md`, seções 2 e 8.1 |
| Exclusão a pedido | Apaga original, miniatura, recorte, rostos, fila, alta e vitrine; encerra galerias; registro em `lgpd.log`; a venda fica | `lgpd_excluir` |
| Números do dia | Ficam depois que a foto sai | comentário antes de `VENDAS_DB` |

## O que ficou sem confirmar nesta leitura

- **Validade das fotos no bucket S3:** `template.yaml` não define regra de ciclo de vida. `NUVEM.md` cita 7 dias em teste e 60 em produção. A configuração real não foi conferida.
- **Nuvem em produção:** se a trava 409 do cartão e o valor de `CompraOnline` já foram implantados não dá para saber pelo repositório.
- **Motivos de parada da DNP:** o código lê códigos do Windows. Se a DS-RX1HS informa cada motivo não foi testado nesta leitura.
- **Situação de venda entre computadores:** não encontrei código que devolva ao navegador os eventos de venda enviados ao servidor. Pela leitura, um Checkout em outro navegador não vê a sessão como paga.

- Regra de expiração do bucket de produção, e se ela poupa a pasta `backup/`. Ela não está no código, e a própria pesquisa de 02/11 lista isso como não verificado.
- Restauração do backup: não há rotina no código, e a pesquisa de 02/11 diz que nunca foi testada.
- Publicação do site eterna.photo a partir do `main`: o código confirma só a origem do app; o `main` vem do documento de pedidos e do `CNAME` na raiz.
- Conexão da maquininha Imply sem a internet do venue: ela é avulsa, e a confirmação no app é manual.
- Versão e canal que rodam de fato nos servidores: sem acesso a eles nesta análise.
- CloudFront `fotos.eterna.photo`: script existe; `NUVEM.md` o marca como pendente. Ativação real não confirmada.
- Comportamentos marcados como "não testado" nas tabelas: lidos no código, sem execução.

## Outras divergências entre documentos e código

Em todos os casos abaixo, os diagramas seguem o código.

| Assunto | O documento diz | O código faz | Onde |
|---|---|---|---|
| O que sobe | Relatório de 31/10 e pesquisa de 02/11: sobem "as fotos vendidas" | Toda foto nova entra na fila, vendida ou não. `NUVEM.md` 3.3 está de acordo com o código | `ingest_file` |
| Tudo sem internet | Relatório de 31/10: tudo funciona sem internet | O app vem do eterna.photo e fica só na memória. Servidor reiniciado sem internet não abre telas novas | `H.app` |
| Fila sem internet | `NUVEM.md` seção 1: fotos esperam na fila e sobem sozinhas | Vale se o servidor ligou conectado. Ligado sem internet, o envio de fotos não tenta de novo e as fotos não entram na fila até o reenvio manual | `nuvem_loop`, `nuvem_enfileira` |
| Fila de vendas | Comentário do `pontoFlush`: "nunca descarta" | `pvPoda` tira eventos acima de 7 dias ou 2.000, com registro | `pvEvento`, `pvPoda` |
| Compra pela nuvem | Pesquisa de 02/11: "o cliente compra pela nuvem" | Compra online desligada; a API responde indisponível | `handler` em `app.py` |
| Login por e-mail | `DOCUMENTACAO-TECNICA`: entra com e-mail e código; hello@ como remetente | `MAIL_API` vazio: código nasce no navegador. O relatório de 31/10 já registra isso | `sendCode` |
| Prazo do original | `DOCUMENTACAO-TECNICA`, diagrama: acervo local de 30 dias | Sem prazo | `ingest_file`, `galeria_loop` |
| Arquitetura | `DOCUMENTACAO-TECNICA`: React e Vite, FastAPI, PostgreSQL, Redis, pyftpdlib | App em arquivo único e servidor em Python com SQLite e FTP próprio. O documento se apresenta como especificação de 26/10 | `index.html`, `eterna-agente.py` |
| Só versão liberada | Pesquisa de 02/11: desde 02/11 só entra versão liberada | Vale para o agente no canal estável. Vigia, instalação inicial e app vêm do `main`. `pedidos-do-eduardo-pos-v91` já registra o app | `instalar-servidor.ps1`, `iniciar-eterna.bat`, `H.app` |
| Plano de atualização | Plano do instalador: consulta a cada 30 min, pacote com o app, teste em porta livre, janela, volta sozinho, 3 versões | Só ao religar; só o programa; só compilação; sem janela e sem volta | `eterna-vigia.ps1` |
| Retenção de 60 dias | Comentário e documentos: leituras ficam 60 dias | Ao ligar, fotos do disco sem leitura voltam para a fila, inclusive as com mais de 60 dias. Pelo código, são relidas com o dia antigo e apagadas na limpeza seguinte. Não testado | `rostos_thread`, `leitor_loop`, `limpar_rostos` |
| Pausa da sessão | Relatório de 31/10: pausa de 20 s | 60 s na v91. O relatório é anterior | `SESS_PAUSA` |
| Selfie e fotos | Relatório de 31/10: achado pela selfie, vê só as próprias fotos | A v91 mudou: `lojaDele` só para menor e escola, segundo o plano de pedidos. Fluxo detalhado fora deste escopo | `docs/planos/2026-11-02-pedidos-do-eduardo-pos-v91.md` |
| Usuário do servidor | `CHECKLIST-SERVIDOR` passo 0 e 3: usuário eterna; passo 7: usuário de quem usa o computador | O instalador aceita qualquer perfil com a venv | `instalar-servidor.ps1` |

## Diagramas que ainda podemos construir

| Diagrama | Para que serve | Depende de |
|---|---|---|
| Instalador Linux, passo a passo | Guiar a criação do instalador | Decidir a distribuição e testar a DNP em bancada |
| Rede e portas do venue | Mostrar quem fala com quem, por qual porta, na VLAN e na VPN | Desenho final do FortiGate |
| Modelo de dados | Tabelas e relações de `vendas.db`, `estado.db` e DynamoDB | Pode fazer agora |
| Dia de operação, por pessoa | Fotógrafo, vendedor, caixa e supervisor lado a lado, da abertura ao fechamento | Pode fazer agora |
| Contingências | O que fazer quando caem Wi-Fi, internet, servidor, impressora ou maquininha | Decidir o caminho do 5G |
| Restauração do backup | Do servidor perdido até voltar a vender, com o tempo medido | Fazer o primeiro teste de restauração |
| Login novo por tela | O que muda em cada tela com o servidor exigindo login | Aprovar o plano do login |
