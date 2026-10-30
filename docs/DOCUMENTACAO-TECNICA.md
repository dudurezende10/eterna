# Eterna: documentação técnica v1

26/10/2026 · Eduardo Rezende · versão editável: https://claude.ai/artifact/1hPgjcUPEFf5B6g7wGWWo4

## 1. Visão geral

Eterna é o sistema de captura, validação, venda e entrega de fotos do Tour do Maracanã, construído para substituir o Roverpix a partir de 01/12/2026 e depois ser licenciado a outros venues. Esta é a versão 1 da documentação técnica: descreve o protótipo que está no ar em [eterna.photo](https://eterna.photo) e a arquitetura de produção decidida até 26/10/2026.

**Escopo do MVP (jan a abr 2027)**

- Ingestão automática de fotos por cartão de memória, Wi‑Fi e 5G, sem ação do fotógrafo.
- Separação de grupos pelo servidor, sem foto preta: pausa entre cliques, troca de rostos, mudança de cena.
- Validação técnica e por IA antes da fila da loja; correção automática de exposição; registro de toda decisão para retreino.
- Checkout com reconhecimento facial (QR e código como contingência), pacotes, fundos de IA, pagamento em maquininha avulsa (TEF na fase 2), impressão e recibo com galeria.
- Galeria web do convidado por 60 dias; grupo sem venda vai para campanha pós-visita.
- Gestão: fluxo ao vivo, lista de vendas, índice por fotógrafo, qualidade, estoque (rolos e bandeiras), alertas.

**Princípios**

1. Local primeiro. Ingestão, validação, venda, impressão e relatórios funcionam sem internet. A nuvem recebe cópia e serve a galeria e a venda online.
2. Zero toque no set. O fotógrafo só fotografa. Nada de pasta, botão, formulário ou foto preta.
3. Nada se perde. Original sempre guardado; a correção gera uma derivada; exclusão é registrada, nunca apagada sem log.
4. Um domínio, um login. Todo mundo entra em `eterna.photo` com e-mail e código; o que aparece depois depende das permissões daquele e-mail, módulo a módulo (C, R, U, D).

**Estado em 26/10/2026**

| Peça | Estado | Onde |
| --- | --- | --- |
| App web (protótipo funcional, todos os perfis) | no ar, v19 (login por e-mail e código, permissões por módulo) | eterna.photo, GitHub Pages |
| Agente do ponto (leitor automático de cartão) | funcional, v1 | `agente/eterna-agente.py` |
| Servidor do ponto (API, banco, pipeline) | especificado; código inicial de 29/09 (FastAPI, 14 entidades, 14 testes) | a migrar para o repositório |
| Pipeline de IA | regras v1 definidas; correção de exposição testada em 28 fotos | seção 7 |
| Nuvem | decidida (AWS); conta a criar | seção 9 |

## 2. Arquitetura

Três camadas: dispositivos de captura e venda, o servidor do ponto (local, no CPD do Maracanã) e a nuvem. Tudo que a operação precisa roda no servidor local; a nuvem é cópia, galeria e venda online.

```mermaid
flowchart LR
  subgraph DEV["Dispositivos (set, loja, quiosque)"]
    CAM["Câmeras\nEOS R6 II (CTP) · 5D IV (FTP) · 5Ds (cartão)"]
    CEL["Celular do fotógrafo\nCanon CTP → FTP por Wi‑Fi/5G"]
    LEITOR["Leitor de cartão no ponto\nAgente Eterna"]
    IPAD["iPads e PCs\nset · checkout · fila · caixa"]
    KIOSK["Quiosque\ncâmera + tela"]
    PRN["Impressora DNP/ASK‑400"]
    POS["Maquininha POS\n(TEF na fase 2)"]
  end
  subgraph LOCAL["Servidor do ponto (CPD, rede local)"]
    FTP["Receptor FTP\npyftpdlib"]
    API["API Eterna\nFastAPI"]
    Q["Fila de jobs\nRedis + RQ"]
    IA["Workers de IA\nrostos · validação · correção · bandeira · recorte"]
    DB[("PostgreSQL 16")]
    FS[("Acervo local\noriginais + derivadas, 30 dias")]
    WEB["App web\nReact + Vite"]
  end
  subgraph CLOUD["Nuvem (AWS sa-east-1)"]
    S3[("S3\nvendidas na hora, resto depois")]
    GAL["Galeria e loja online\neterna.photo/g/CODIGO"]
    RDB[("RDS PostgreSQL\ncatálogo, vendas online")]
    REK["Rekognition (opcional por venue)"]
    RD["RD Station\ncampanha pós-visita"]
  end
  CAM --> CEL --> FTP
  CAM --> LEITOR --> API
  CAM -. FTP direto .-> FTP
  FTP --> Q
  API --> Q --> IA --> DB
  IA --> FS
  API --> DB
  IPAD --> WEB --> API
  KIOSK --> WEB
  API --> PRN
  API -. valor da venda (TEF, fase 2) .-> POS
  API -- sync --> S3 --> GAL
  API -- sync --> RDB --> GAL
  GAL --> RD
  IA -. opcional .-> REK
```

**Responsabilidades**

| Camada | Faz | Não faz |
| --- | --- | --- |
| Dispositivos | capturam, mostram telas do app, imprimem, cobram | não guardam estado; tudo vem da API |
| Servidor do ponto | ingestão, grupos, validação, correção, catálogo, vendas, impressão, relatórios, acervo de 30 dias | não depende de internet para nada disso |
| Nuvem | cópia do acervo, galeria do convidado, venda online, campanhas, backup | não participa da venda no balcão |

**Contingências de transferência** (reunião de 26/10): 1) celular por Wi‑Fi local; 2) celular por 5G para FTP na nuvem, que o servidor puxa; 3) cabo RJ45 da caixinha para laptop ou cartão no leitor. Os três caem na mesma pasta de entrada e passam pelo mesmo pipeline. Custo de parada citado: cerca de R$ 25.000 por dia.

## 3. Stack e versões

Python no servidor e no agente, TypeScript no app, PostgreSQL como banco único, Docker para empacotar. Versões são as estáveis em outubro de 2026; fixar no `pyproject.toml` e no `package.json` ao abrir cada módulo.

**Servidor do ponto**

| Camada | Tecnologia | Versão | Uso |
| --- | --- | --- | --- |
| Linguagem | Python | 3.12 | API, workers, agente |
| API | FastAPI | 0.115 | REST e WebSocket (fila ao vivo, set, checkout) |
| Servidor ASGI | Uvicorn | 0.30 | processo da API |
| Validação de dados | Pydantic | 2.9 | esquemas de entrada e saída |
| ORM e migrações | SQLAlchemy + Alembic | 2.0 / 1.13 | modelo de dados, migrações versionadas |
| Banco | PostgreSQL | 16 | tudo do ponto: sessões, fotos, vendas, estoque, logs |
| Fila de jobs | Redis + RQ | 7.4 / 1.16 | ingestão, IA, impressão, sync em segundo plano |
| Receptor FTP | pyftpdlib | 1.5 | recebe do Canon CTP (celular) e da 5D IV |
| Imagens | Pillow + NumPy | 10.4 / 2.1 | leitura, EXIF, derivadas, miniaturas |
| Visão | OpenCV (headless) | 4.10 | nitidez, inclinação, corte, exposição por região |
| Rostos | InsightFace (buffalo_l) sobre ONNX Runtime | 0.7 / 1.19 | detecção, embeddings, olhos, óculos; roda em CPU, GPU opcional |
| Recorte de fundo | rembg com BiRefNet | 2.0 | Chroma e fundos de IA |
| Rotulagem assistida (treino) | OpenAI API (modelo com visão) | atual | pose, expressão, segunda opinião em dúvidas; nunca na venda ao vivo |
| Impressão | CUPS ou spooler do Windows + driver DNP | - | hot folder por caixa |
| Testes | pytest + httpx | 8.3 / 0.27 | API e pipeline |
| Empacotamento | Docker + Compose | 27 / 2.29 | api, workers, redis, postgres, ftp em um `compose.yml` |

**App web (todos os perfis)**

| Camada | Tecnologia | Versão | Uso |
| --- | --- | --- | --- |
| Linguagem | TypeScript | 5.6 |  |
| UI | React | 18.3 | telas por perfil |
| Build | Vite | 5.4 | dev server e bundle estático |
| Rotas | React Router | 6.26 | `/#perfil/tela` como hoje |
| Dados | TanStack Query | 5 | cache e revalidação da API |
| Estado local | Zustand | 4.5 | sessão aberta, carrinho, filtros |
| Estilo | CSS com tokens (sem framework) | - | design system da seção 10 |
| QR | qrcode | 1.5 | recibo e galeria |
| Testes | Vitest + Playwright | 2 / 1.47 | unidade e fluxo ponta a ponta |

**Agente do ponto (leitor de cartão)**

| Item | Tecnologia | Versão | Uso |
| --- | --- | --- | --- |
| Linguagem | Python, só biblioteca padrão | 3.12 | vigia volumes, copia, dedupe por hash, serve miniaturas em 127.0.0.1:8765 |
| Miniaturas | `sips` (macOS) ou Pillow | - | 900 px |
| Empacotamento | PyInstaller | 6.10 | executável único para Windows e macOS, sem instalar Python no ponto |

**Nuvem**

| Item | Tecnologia | Uso |
| --- | --- | --- |
| Armazenamento | AWS S3 (sa-east-1) + CloudFront | acervo sincronizado, entrega da galeria |
| Banco online | AWS RDS PostgreSQL 16 | catálogo, vendas online, consentimentos |
| Galeria e loja | mesmo app web, build `cliente`, em S3 + CloudFront ou ECS | eterna.photo/g/CODIGO |
| Facial opcional | AWS Rekognition | venues que preferirem nuvem ao InsightFace local |
| Pagamento online | Stone/Pagar.me (checkout web) | galeria |
| Campanhas | RD Station (API) | pós-visita 24 h, 7 dias, jogo |

**Protótipo atual (eterna.photo)**: HTML, CSS e JavaScript sem framework em um arquivo, Google Fonts, qrcodejs 1.0.0, sprites WebP das fotos reais, GitHub Pages. Serve de referência de telas e comportamento para o app React.

## 4. Repositório

Um repositório único, [github.com/dudurezende10/eterna](https://github.com/dudurezende10/eterna), público enquanto for só protótipo; vira privado quando o código do servidor entrar. Branch `main` publica o app no GitHub Pages em eterna.photo a cada push (cerca de 1 minuto).

**Estrutura hoje (26/10)**

```text
eterna/
├─ index.html          app completo (HTML + CSS + JS), v18
├─ img/                fundos de IA e vestiário (6 jpg)
├─ sprites/            fotos reais em sprites WebP (12 arquivos, 373 fotos)
├─ agente/
│  └─ eterna-agente.py leitor automático de cartão
├─ CNAME               eterna.photo
├─ .nojekyll
└─ README.md
```

**Estrutura alvo (monorepo)**

```text
eterna/
├─ apps/
│  ├─ web/             React + Vite: perfis admin, foto, venda, valida, cliente, quiosque
│  └─ galeria/         build da loja online (mesmo código, só perfil cliente)
├─ services/
│  ├─ api/             FastAPI: rotas, esquemas, serviços, auth
│  ├─ workers/         jobs RQ: ingestão, grupos, validação, correção, bandeira, recorte, impressão, sync
│  ├─ ftp/             receptor pyftpdlib (CTP e 5D IV)
│  └─ ia/              modelos, regras v1, avaliação contra o gabarito do treino
├─ agente/             leitor de cartão (Python stdlib) + build PyInstaller
├─ packages/
│  ├─ design-tokens/   tokens CSS e JSON (seção 10)
│  └─ schema/          tipos compartilhados gerados do OpenAPI
├─ infra/
│  ├─ compose.yml      api, workers, redis, postgres, ftp
│  ├─ ponto/           instalação do servidor do ponto, backup, NAS
│  └─ aws/             S3, CloudFront, RDS (Terraform)
├─ docs/               esta documentação, ADRs, runbooks
├─ prototype/          index.html atual, congelado como referência
└─ .github/workflows/  testes, build, deploy do Pages e das imagens Docker
```

**Convenções**

- Branches: `main` (produção), `dev` (homologação no servidor do CPD), ramos curtos por tarefa.
- Commits em português, imperativo, com o módulo no início: `api: fecha grupo por pausa`.
- Versão do app no rodapé do menu (`v18 · 26/10 16:10`), gerada no build a partir da tag.
- Decisões de arquitetura em `docs/adr/NNNN-titulo.md`, uma por decisão (sem foto preta, PostgreSQL, InsightFace local).

## 5. Componentes

| Componente | Roda em | Porta e interface | Entrada | Saída |
| --- | --- | --- | --- | --- |
| Agente do ponto | PC de cada ponto de captura | `http://127.0.0.1:8765` (`/status`, `/events`, `/thumb/{id}`, `/file/{id}`) | cartão inserido (DCIM) | arquivos em `~/Eterna/inbox/AAAA-MM-DD/`, eventos `photo` e `dup` para a API |
| Receptor FTP | servidor do ponto | 21 (FTP) e 990 (FTPS), um usuário por fotógrafo | JPG do Canon CTP ou da 5D IV | arquivo na pasta de entrada, evento na fila |
| API Eterna | servidor do ponto | 8000, REST `/v1/*` e WebSocket `/ws` | app web, agente, FTP, quiosque | JSON, eventos ao vivo, jobs na fila |
| Workers | servidor do ponto (CPU; GPU opcional) | fila Redis `ingest`, `ia`, `print`, `sync` | jobs | fotos em grupos, validações, derivadas, impressões, cópias na nuvem |
| Banco | servidor do ponto | 5432 |  | fonte de verdade do ponto |
| Acervo | NAS ou disco do servidor | SMB/NFS | originais e derivadas | retenção 30 dias local |
| App web | navegador (iPad, PC, quiosque) | servido pela API ou pelo Pages | API | telas por perfil |
| Sync | worker `sync` | S3 e RDS por HTTPS | vendidas na hora, resto em lote | galeria online |
| Galeria | nuvem (fase 1: agente do ponto) | eterna.photo/#g/{token}, código curto como contingência | S3, RDS | fotos, compra, download (ver "Galeria online por QR") |

**Contratos principais da API** (nomes definitivos ao gerar o OpenAPI):

- `POST /v1/ingest/events` (agente e FTP): foto nova ou repetida, com hash, hora de captura, ponto, fotógrafo.
- `GET /v1/sessions?status=` e `WS /ws/sessions`: grupos em formação, fechados, no checkout, pagos.
- `POST /v1/sessions/{id}/merge` e `/split`: ajuste do vendedor em grupos em dúvida.
- `POST /v1/faces/match` (selfie): devolve sessões do dia com aquele rosto.
- `POST /v1/sales` e `POST /v1/sales/{id}/payment`: venda e pagamento (POS manual hoje; TEF depois).
- `POST /v1/print-jobs`: impressão por caixa.
- `GET /v1/reports/*`: semana, fotógrafos, vendas, estoque, bandeiras, alertas.
- `POST /v1/validations/{photo_id}`: decisão humana ou da IA, com motivo, nunca sobrescrita (histórico).

## 6. Modelo de dados

A sessão (grupo de convidados) é a unidade central. Foto nunca é apagada: ganha validações e derivadas. Venda liga sessão, vendedor, itens e pagamento. Tudo que a IA decide fica em `validation`, com quem decidiu e por quê.

```mermaid
erDiagram
  VENUE ||--o{ STATION : tem
  VENUE ||--o{ USER : tem
  STATION ||--o{ SESSION : captura
  USER ||--o{ SESSION : fotografa
  SESSION ||--o{ PHOTO : contem
  PHOTO ||--o{ DERIVATIVE : gera
  PHOTO ||--o{ VALIDATION : recebe
  PHOTO }o--o| FLAG : mostra
  SESSION ||--o{ FACE : reconhece
  SESSION ||--o| SALE : vende
  SALE ||--|{ SALE_ITEM : tem
  SALE_ITEM }o--|| PRODUCT : usa
  SALE ||--o{ PAYMENT : recebe
  SALE ||--o{ PRINT_JOB : imprime
  SESSION ||--o| GALLERY : publica
  SESSION ||--o{ CONSENT : registra
  SESSION ||--o{ POST_VISIT : agenda
  STATION ||--o{ SUPPLY : consome
  FLAG ||--o{ FLAG_EVENT : movimenta
  PHOTO ||--o{ TRAINING_LABEL : rotula
  USER ||--o{ EVENT_LOG : registra

  SESSION {
    uuid id PK
    string code "LP6ZM8K74"
    uuid station_id FK
    uuid photographer_id FK
    datetime opened_at
    datetime closed_at
    string closed_by "pausa | rostos | cena | vendedor"
    float boundary_confidence
    string status "aberta|fechada|no_checkout|paga|perdida"
    string flag_name
  }
  PHOTO {
    uuid id PK
    uuid session_id FK
    string sha256
    string original_path
    datetime captured_at
    string source "cartao|wifi|5g|cabo"
    int width
    int height
    string state "valida|nao_valida|duvida"
  }
  VALIDATION {
    uuid id PK
    uuid photo_id FK
    string verdict "pode|nao|duvida"
    string reasons "contraluz, torta..."
    string decided_by "ia|usuario"
    uuid user_id FK
    float confidence
    json metrics "rosto, fundo, tilt"
    datetime at
  }
  DERIVATIVE {
    uuid id PK
    uuid photo_id FK
    string kind "thumb|web|corrigida|recorte|fundo"
    string path
    json params
  }
  SALE {
    uuid id PK
    string number "E001"
    uuid session_id FK
    uuid seller_id FK
    decimal total
    string status "paga|cancelada"
    datetime paid_at
  }
  PAYMENT {
    uuid id PK
    uuid sale_id FK
    string method "pix|credito|debito|dinheiro"
    string channel "pos_manual|tef|online"
    string nsu
    decimal amount
  }
  FLAG {
    uuid id PK
    string name
    string country
    int quantity
    string fabric_type "A|B"
    string state "nova|boa|desgastada|defeito|fora"
    uuid station_id FK
    string reference_images
  }
  TRAINING_LABEL {
    uuid id PK
    uuid photo_id FK
    string verdict
    string reasons
    string note
    uuid user_id FK
    datetime at
  }
```

**Regras de integridade**

- `PHOTO.sha256` único por venue: a segunda chegada do mesmo arquivo vira evento `dup`, não linha nova.
- `VALIDATION` é só inserção. O estado da foto é a última validação; o histórico inteiro alimenta o retreino.
- `SESSION.boundary_confidence` abaixo do limiar marca a sessão como "em dúvida" para o vendedor juntar ou separar.
- `FACE` guarda embedding e hash, nunca a imagem do rosto; apagado 60 dias depois da visita ou quando o consentimento é retirado.
- `SALE.number` sequencial por dia e por caixa; cancelamento muda `status`, não apaga.

## 7. Fluxos de entrada e saída

Quatro fluxos cobrem a operação: ingestão, validação, checkout e pós-visita. Entradas à esquerda, saídas à direita.

**7.1 Ingestão e grupos** (sem foto preta)

```mermaid
flowchart TD
  A1["Cartão no leitor\n(agente)"] --> IN
  A2["Celular por Wi‑Fi\n(CTP → FTP local)"] --> IN
  A3["Celular por 5G\n(CTP → FTP nuvem → pull)"] --> IN
  A4["5D IV por FTP\ndireto"] --> IN
  IN["Pasta de entrada\nevento photo"] --> H{"sha256\njá existe?"}
  H -- sim --> DUP["evento dup\nignorada, log"]
  H -- não --> CP["copia original\nEXIF, hora de captura"]
  CP --> TH["miniatura e web\n(derivadas)"]
  TH --> FACES["rostos: embeddings\n(InsightFace)"]
  FACES --> G{"mesmo grupo?\nrosto em comum E\npausa < limiar"}
  G -- sim --> ADD["adiciona à sessão aberta"]
  G -- não --> CLOSE["fecha sessão anterior\nclosed_by, confiança"] --> NEW["abre sessão nova"]
  G -- incerto --> DUV["sessão em dúvida\nvendedor junta ou separa"]
  ADD --> VAL["fila: validação"]
  NEW --> VAL
  DUV --> VAL
```

Limiar de pausa aprendido por ponto (mediana dos intervalos entre sessões dos últimos 7 dias); valor inicial 20 s (`SESSAO_PAUSA_S`; era 45 s até 29/10).

**7.2 Validação e correção** (regras v1, requisitos seção 13)

```mermaid
flowchart TD
  P["foto nova"] --> R{"rosto\ndetectado?"}
  R -- não --> NV1["não válida: sem rosto"]
  R -- sim --> OC{"óculos escuros?"}
  OC -- sim --> EXP
  OC -- não --> EYES{"olhos abertos\nem 1º plano?"}
  EYES -- não --> NV2["não válida: olho fechado"]
  EYES -- incerto --> DV["dúvida → revisão"]
  EYES -- sim --> EXP{"rosto vs fundo\nalvo 132 (107 a 154)"}
  EXP -- contraluz --> FIX["correção automática\nlevanta rosto até 1,5 EV"] --> EXP2{"passou?"}
  EXP2 -- sim --> OK1["válida, corrigida\n(derivada)"]
  EXP2 -- não --> NV3["não válida: contraluz\nalerta ao fotógrafo"]
  EXP -- estourada leve --> FIX
  EXP -- estourada forte --> NV4["não válida: estourada\nalerta ao fotógrafo"]
  EXP -- ok --> TILT{"anel do estádio\n> 3°?"}
  TILT -- sim --> NV5["não válida: torta"]
  TILT -- não --> CROP{"cabeça ou corpo\nna borda?"}
  CROP -- sim --> NV6["não válida: cortada"]
  CROP -- não --> FLAG["bandeira: compara com\nreferências do cadastro"] --> OK2["válida → fila da loja"]
  NV1 & NV2 & NV3 & NV4 & NV5 & NV6 --> LOG["VALIDATION registrada\nfica no acervo, fora da venda"]
  DV --> LOG
```

Toda decisão, da IA ou de pessoa, vira uma linha em `VALIDATION`. Confiança baixa em qualquer regra manda para dúvida, nunca reprova sozinha.

**7.3 Checkout e pagamento**

```mermaid
sequenceDiagram
  participant C as Convidado
  participant V as Vendedor (iPad)
  participant API as API Eterna
  participant POS as Maquininha
  participant PRN as Impressora
  participant S3 as Nuvem
  C->>V: olha para a câmera
  V->>API: POST /faces/match (selfie)
  API-->>V: sessões do dia com aquele rosto
  V->>API: escolhe fotos, fundo, pacote
  API-->>V: total, impressões
  alt hoje: POS manual
    V->>POS: digita o valor
    POS-->>V: aprovado
    V->>API: POST /sales/{id}/payment (manual)
  else fase 2: TEF
    V->>API: POST /sales/{id}/payment (tef)
    API->>POS: valor
    POS-->>API: aprovado, NSU
  end
  API->>PRN: print-job
  API-->>V: recibo com QR eterna.photo/#g/TOKEN e código curto
  API->>S3: sync das fotos vendidas (agora)
  API-->>C: galeria por 60 dias
```

**7.4 Não vendeu**

```mermaid
flowchart LR
  S["sessão fechada\nsem venda até o fim do dia"] --> UP["sync para S3\n(em lote, à noite)"] --> G["galeria web\npelo rosto ou código"]
  G --> R1["RD: 24 h"] --> R2["RD: 7 dias"] --> R3["RD: próximo jogo\ndo time da bandeira"]
  G --> BUY["compra online\nStone/Pagar.me"] --> DL["download em alta\n60 dias"]
```

**Entradas e saídas do sistema (resumo)**

| Entrada | De | Formato | Saída | Para | Formato |
| --- | --- | --- | --- | --- | --- |
| Fotos | câmeras via agente, CTP, FTP | JPG (6 a 9 MB) | derivadas, grupos, validações | app, nuvem | WebP, JPG, JSON |
| Selfie | iPad, quiosque, celular | JPG | sessões correspondentes | app | JSON |
| PAX | catracas (painel Maracatour, JSON) | JSON | spend per guest, capture rate | gestão | relatórios, CSV |
| Catálogo e preços | admin | app | carrinho, recibo | checkout, quiosque, galeria | JSON |
| Pagamento | vendedor (manual) ou TEF | app, maquininha | venda registrada, impressão | lista de vendas, impressora | JSON, job |
| Rótulos do treino | validador | app | regras e gabarito da IA | pipeline | JSON |
| Inventário de bandeiras | admin, supervisor | app, CSV | uso por foto, lista de compra | gestão | relatórios |

## 8. Integrações externas

| Sistema | Direção | Protocolo | O que troca | Estado |
| --- | --- | --- | --- | --- |
| Canon Content Transfer Professional (celular) | entra | FTP/FTPS para o receptor local ou da nuvem | JPG no clique, auto transfer; R6 Mark II por cabo USB‑C | app validado na loja; teste de campo pendente |
| Canon EOS 5D Mark IV | entra | FTP pelo Wi‑Fi da câmera | JPG direto ao servidor, sem celular | a testar |
| Agente do ponto | entra | HTTP local 8765 | fotos do cartão, eventos dup | v1 funcional |
| Painel Maracatour (catracas) | entra | HTTP JSON `/api/stats`, `/api/fotos/stats?periodo=` | PAX por dia, hora e canal | disponível, sem login |
| Roverpix (transição até a troca) | entra | API em tempo real (credencial com o Ronaldo) | vendas e sessões para comparar o período paralelo | aguardando credencial |
| AWS S3 e CloudFront | sai | HTTPS, SDK boto3 | acervo e galeria | conta a criar |
| AWS Rekognition | sai (opcional) | HTTPS | facial para venues que preferirem nuvem | não usado no Maracanã |
| Maquininha POS | manual hoje | - | valor digitado pelo vendedor | em uso |
| TEF (Stone Connect, SiTef ou similar) | sai, fase 2 | API da adquirente ou cliente TEF | valor, confirmação, NSU, cancelamento | adquirente a definir |
| Stone/Pagar.me (online) | sai | API REST | checkout da galeria | fase 2 |
| RD Station | sai | API REST | contato, evento de visita, disparos 24 h, 7 dias, jogo | confirmar que é RD Station |
| Impressora DNP (ASK‑400) | sai | driver, hot folder | impressões por caixa, contador de rolo | em uso no Tour |
| OpenAI API | sai, só treino | HTTPS | rotulagem assistida e segunda opinião em dúvidas | chave oferecida na reunião de 26/10 |

## 9. Infraestrutura e rede

**Servidor do ponto (CPD)**: uma máquina com CPU de 8 núcleos ou mais, 32 GB de RAM, SSD NVMe de 2 TB para o acervo de 30 dias, GPU opcional (uma RTX de entrada reduz o tempo de rosto e recorte de 0,5 s para 0,05 s por foto). Sistema recomendado: Ubuntu Server 24.04 LTS com Docker; Windows Server 2022 é possível se for o padrão da TI, rodando os mesmos containers. Nobreak de 30 minutos (cotação de R$ 4.000 a 5.000).

**Rede**: VLAN própria para os pontos, iPads e quiosques; FortiGate como firewall e VPN para acesso remoto e para o pull do FTP na nuvem; link dedicado com redundância (fibra e rádio). Wi‑Fi do estádio para os celulares dos fotógrafos; 5G como contingência; cabo RJ45 nas caixinhas para descarga direta.

```mermaid
flowchart LR
  subgraph CAMPO["Pontos de captura"]
    P1["Terminal Campo"]
    P2["Foto Campo 2"]
    P3["Foto Campo 3"]
    P4["Foto Campo 4"]
    P5["Vestiário"]
    CH["Chroma 1 e 2"]
  end
  subgraph LOJA["Loja"]
    CK["iPads de checkout"]
    CX["Caixas 1 a 3 + impressoras"]
    KQ["Quiosques"]
  end
  SW["Switch PoE\nVLAN Eterna"]
  WIFI["Wi‑Fi do estádio"]
  SRV["Servidor do ponto\nDocker: api, workers, redis, postgres, ftp"]
  NAS[("NAS\nbackup local")]
  FG["FortiGate\nfirewall + VPN"]
  NET["Internet\nfibra + rádio"]
  AWS["AWS\nS3, RDS, CloudFront"]
  P1 & P2 & P3 & P4 & P5 & CH --> SW
  CK & CX & KQ --> SW
  WIFI --> SW
  SW --> SRV --> NAS
  SRV --> FG --> NET --> AWS
```

**Hospedagem do protótipo**: GitHub Pages (branch `main`), domínio eterna.photo (GoDaddy, registros A para 185.199.108/109/110/111.153 e CNAME www), HTTPS do GitHub. Em produção o app é servido pela API no servidor do ponto (sem depender de internet) e a galeria pela nuvem.

**E-mail do domínio**: hello@eterna.photo encaminhado para o Gmail do Eduardo pelo ImprovMX (plano grátis). DNS no GoDaddy: MX `mx1.improvmx.com` (10) e `mx2.improvmx.com` (20); SPF `v=spf1 include:spf.improvmx.com include:_spf.google.com ~all` (respostas saem pelo Gmail, "Enviar e-mail como"). É o e-mail oficial do Eterna: remetente dos códigos de login e contato do convidado (recibo e galeria). Envio real em produção sai pelo servidor (SMTP do Gmail com senha de app, ou o serviço da VM), sempre com remetente hello@eterna.photo.

**Roverpix (transição)**: enquanto o Eterna não opera sozinho, o agente do ponto sincroniza a API de relatórios da Roverpix (`/reports/orders`, `/payments`, `/photos`, cabeçalho `ApiKey`) a cada 5 minutos, últimos 30 dias, dia a dia (dias fechados ficam em cache). A chave fica só em `~/Eterna/roverpix.json` (permissão 600), digitada pelo admin na tela Repositório com o app aberto pelo agente; nunca vai para o site nem para o GitHub. Os dados brutos (com dados de clientes) ficam em `~/Eterna/roverpix/raw`; o app recebe por `GET /roverpix/data` só totais por dia, vendedor, fotógrafo, forma de pagamento e produto. Semana, Fotógrafos e Vendas e caixa passam a usar esses dados e seguem o filtro de datas.

**Backup**: originais e banco copiados para o NAS a cada hora; vendidas para o S3 na hora; acervo inteiro para o S3 à noite; retenção local de 30 dias, nuvem por 12 meses, galeria do convidado por 60 dias.

## 10. Design system

O mesmo sistema visual do site Wesden: papel claro, tinta quase preta, serifa para títulos e números grandes, sem-serifa para o resto, um acento terracota. Tudo em tokens CSS no `:root`, com versão escura automática. Os tokens já estão no `index.html` e vão para `packages/design-tokens`.

**Temas por venue**: o Eterna é a plataforma e cada venue entra com a própria marca. A tela Identidade (módulo Configuração) escolhe o venue, as duas cores (principal e apoio) e recebe o arquivo da logo oficial; o app aplica em `:root` (`--accent`, `--venue2`, `--display`, tema claro ou escuro) e troca nomes de pontos, taglines e assinatura. Regra de marca: a marca do venue vem primeiro em tudo que o público vê (quiosque, galeria, recibo), o Eterna assina pequeno ("fotos por Eterna"); nas telas da equipe o Eterna vem primeiro. Temas cadastrados: Viva Maracanã (Manual de Marca do Grupo Viva, out/2026: Azul #134078, Verde #005500, Amarelo #FFB800, secundárias Azul luz #307FE2, Azul noite #0C2340, Verde luz #43B02A, Amarelo luz #FCE300, Cinza museu #D9D9D6, Grafite #25282A; Big Shoulders com tracking 100 nos títulos, Inter nos textos; logo oficial em img/brand, branco sobre azul e azul sobre branco, mínimo 150 px em tela; grafismo multidão como pontos no menu e na entrada; white label com Eterna só como powered by) e Lollapalooza Brasil (escuro, rosa e lima, Archivo Black; variante de apresentação). As cores abaixo são as do tema base.

**Cor**

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--bg` | #fafaf8 | #141311 | fundo da página |
| `--surface` | #ffffff | #1c1a17 | cartões e painéis |
| `--surface2` | #f1eee8 | #24211d | item de menu ativo, trilhas, fundos secundários |
| `--fg` | #141311 | #f2eee7 | texto e botão primário |
| `--muted` | #6b625a | #a69d92 | texto secundário, rótulos |
| `--line` | #dcd8d0 | #34302a | bordas |
| `--accent` | #53342e | #d2b29c | seleção de foto, destaque único por tela |
| `--good` / `--good-bg` | #2f6b3f / #e7f0e9 | #8fcb9d / #1f2e23 | pago, válida, conectado |
| `--warn` / `--warn-bg` | #8a6a14 / #f3ecd6 | #dcbb62 / #2f2812 | atenção, dúvida, em andamento |
| `--bad` / `--bad-bg` | #b3402a / #f6e3dd | #ee9479 / #3a211b | não válida, alerta, cancelada |
| `--bar` / `--bar2` | #141311 / #c9c2b6 | #f2eee7 / #4a443c | barras de gráfico, principal e comparativa |

Regra: uma cor de estado por elemento, sempre com texto junto (nunca só cor). O acento aparece uma vez por tela.

**Tipografia**

| Token | Fonte | Pesos | Onde |
| --- | --- | --- | --- |
| `--display` | Cormorant Garamond | 500, 600 | h1 38 px, h2 24 px, h3 19 px, números de tile 34 px, códigos de sessão 20 a 64 px, preços |
| `--body` | Inter | 400, 500, 600 | corpo 14 px / 1,45; notas 12 px; eyebrow 11 px em caixa alta com espaçamento 0,18 em |

Números sempre com `font-variant-numeric: tabular-nums`. Tabelas em 13 px.

**Espaço e forma**

- Escala de espaço: 4, 8, 12, 14, 16, 18, 22, 28 px. Gutter da página 28 px (16 no celular).
- Raio: 5 px em botões e inputs, 6 px em cartões e painéis, 999 em chips e pills, 28 px na moldura do celular, 12 px no quiosque.
- Bordas de 1 px em `--line`; sombra só na moldura do celular. Sem gradientes.
- Menu lateral de 230 px fixo, em grupos que abrem e fecham (v78). Entre 701 e 900 px vira barra no topo; até 700 px o cabeçalho fica com logo, ícone do Checkout e botão Menu, e o menu abre numa gaveta por cima da tela.

**Componentes** (nomes como estão no CSS)

| Componente | Classe | Para |
| --- | --- | --- |
| Tile | `.tile` | um número com rótulo e nota |
| Painel | `.panel` | bloco com título e conteúdo |
| Chip | `.chip` (`aria-pressed`) | filtro, modo, opção |
| Pill | `.pill.good/.warn/.bad/.neutral` | estado |
| Botão | `.btn`, `.primary`, `.ghost`, `.big` | ação; uma primária por tela |
| Cartão de sessão | `.scard` | código, fotógrafo, hora, estado |
| Foto | `.ph` (`data-sel`, `data-v`, `data-off`) | miniatura com seleção, nota, descarte |
| Cartão de perfil | `.role` | entrada de tela ou de perfil |
| Etapas | `.steps .step` | checkout em 4 passos |
| Celular | `.phone` | moldura de celular |
| Quiosque | `.kiosk .screen`, `.face` | tela cheia, câmera |
| Barras | `.bars .bar` | comparação horizontal |
| Alerta | `.alert.bad/.warn/.good` | regra disparada |
| Recibo | `.receipt` | monoespaçada |

**Estados**: `aria-pressed` em chips e botões de seleção; `aria-current="page"` no menu; foco visível com contorno de 2 px no acento; `[disabled]` a 45% de opacidade; animações só na chegada de foto e na câmera do quiosque, desligadas com `prefers-reduced-motion`.

**Linguagem**: convidado (não cliente), anfitrião (fotógrafo no set), sessão ou grupo (não cartão), ponto de captura, passe de foto, galeria. Frases curtas, números na frente, sem texto explicativo dentro do app. Taxa, prazo e tamanho do arquivo sempre no recibo.

**Acessibilidade**: contraste mínimo 4,5:1 nos textos (os tokens acima cumprem nos dois temas); alvos de toque de 42 px ou mais (botões grandes de 56 px no set, checkout e quiosque); tudo operável por teclado nas telas de gestão.

## 11. Segurança, LGPD, backup e observabilidade

**Acesso**: entrada por e-mail e código de uso único (sem senha). O usuário digita o e-mail, recebe um código de 6 dígitos válido por 10 minutos e entra; a sessão dura 12 h. Só entra e-mail cadastrado e ativo: fora do cadastro aparece "Este e-mail não tem acesso" (desde a v78 não existe mais perfil Cliente nem login de convidado; o cliente abre as fotos pela galeria pública `#g`). O acesso tem duas camadas: a permissão **C, R, U, D por módulo** decide o que a pessoa faz, e a lista de telas do menu decide o que ela vê. Os perfis prontos (Admin, Fotógrafo, Atendimento e venda, Validador, Supervisor, Checkout) preenchem as duas e podem ser ajustados por pessoa em Configurações › Permissões. Desativar ou excluir o e-mail corta o acesso na hora. O computador do Checkout entra com o e-mail do aparelho. Detalhes, regras e o que ainda é protótipo na seção "Acesso, permissões e menus (v78)". No protótipo o e-mail é simulado na tela; em produção o envio sai por Amazon SES ou Resend a partir da API, com o código guardado em Redis com expiração.

**Dados pessoais (LGPD)**: rosto é dado biométrico. O sistema guarda embedding e hash, nunca a imagem recortada do rosto; consentimento registrado em `CONSENT` no primeiro contato (checkout ou quiosque), com texto e versão; quem não autoriza usa QR ou código; embeddings apagados 60 dias depois da visita ou no pedido do titular; fotos não vendidas apagadas da nuvem em 60 dias; vendidas ficam 12 meses para reimpressão. Nome, e-mail e telefone só na venda e na galeria, com finalidade declarada; RD Station recebe apenas quem autorizou campanha.

**Rede e segredos**: API só na VLAN e pela VPN; FTP com usuário por fotógrafo e FTPS quando o CTP permitir; segredos em variáveis de ambiente do Docker, nunca no repositório; chaves de nuvem com permissão mínima por bucket.

**Backup e continuidade**: NAS a cada hora, S3 à noite; restauração testada por mês; servidor reserva (um PC de ponto) com o mesmo `compose.yml` e o último backup, sobe em 30 minutos; impressão e venda continuam sem internet.

**Observabilidade**: logs estruturados (JSON) por serviço; métricas de fila (tempo por foto em cada etapa), de ingestão (fotos por minuto por ponto, repetidas) e de IA (acerto contra o gabarito do treino); alertas operacionais já definidos no app (fotos por sessão, conversão, estação parada, rolo, bandeira). Ferramenta: Prometheus + Grafana no servidor do ponto, Sentry para erros do app.

## 12. Ambientes, versionamento e decisões em aberto

| Ambiente | Onde | Dados | Deploy |
| --- | --- | --- | --- |
| Desenvolvimento | notebook do desenvolvedor, Docker | amostra anonimizada (24 sessões) | `docker compose up` |
| Homologação | servidor do CPD, branch `dev` | cópia do acervo real, cartões de teste | push em `dev` |
| Produção | servidor do CPD, branch `main` | real | tag `vX.Y.Z`, janela fora do horário do Tour |
| Protótipo | GitHub Pages, eterna.photo | fotos reais em sprites, simulação no navegador | push em `main` |

Versionamento semântico: `v1.0.0` na substituição do Roverpix; o protótipo segue `v18`, `v19` até lá. Cada entidade e cada rota da API carrega versão no caminho (`/v1`).

**Decisões em aberto**

- [ ] Banco no servidor do ponto: PostgreSQL (recomendado) ou SQL Server, que a TI citou na reunião de 26/10. O ORM aceita os dois; a escolha afeta backup, licença e Docker.
- [ ] Sistema do servidor: Ubuntu com Docker (recomendado) ou Windows Server.
- [ ] Adquirente e forma de TEF (fase 2).
- [ ] "RD" do quadro de 26/10 é RD Station?
- [ ] Reflexo de flash na lente dos óculos: pode ou não pode?
- [ ] Nome definitivo: busca no INPI (classes 9, 41, 42) pendente desde 29/09.
- [ ] GPU no servidor do ponto: decidir depois de medir o tempo por foto em CPU com fotos em tamanho cheio.

**Documentos relacionados** (projeto Maracanã): requisitos v0.2, especificação v0.1, decisões técnicas, reunião de TI de 16/10, reunião de implantação de 26/10, inventário de bandeiras.

Fontes: protótipo em [eterna.photo](https://eterna.photo) e repositório [github.com/dudurezende10/eterna](https://github.com/dudurezende10/eterna); [Canon CTP](https://www.canon-europe.com/apps/content-transfer-mobile) e [câmeras compatíveis](https://cam.start.canon/en/S013/manual/html/UG-00_Before_0020.html); [Wi‑Fi e FTP da EOS 5D Mark IV](https://in.canon/en/support/8203044300); resumo da reunião "Implantação fluxo fotos" de 26/10/2026; requisitos Eterna v0.2 (projeto Maracanã).

## Glossário

| Termo | Significado |
| --- | --- |
| Sessão ou grupo | conjunto de fotos de uma família ou pessoa em um ponto, separado pelo servidor |
| Ponto de captura | lugar com fotógrafo ou estação automática (Terminal Campo, Foto Campo 2 a 4, Vestiário, Chroma 1 e 2) |
| Ingestão | chegada da foto ao servidor, por qualquer caminho, sem ação do fotógrafo |
| Validação | decisão pode, não pode ou dúvida sobre uma foto, com motivo; da IA ou de pessoa |
| Derivada | versão gerada de uma foto: miniatura, web, corrigida, recorte, com fundo |
| Checkout | tela única do vendedor: identificar, escolher, pagar, recibo |
| PAX | visitantes do dia pela catraca |
| Spend per guest | receita dividida por PAX |
| Índice do fotógrafo | receita do dia dividida pela média dos colegas do mesmo dia, vezes 100 |
| Agente do ponto | programa local que vigia o cartão e entrega as fotos |
| CTP | Canon Content Transfer Professional, app que manda a foto da câmera para FTP pelo celular |
| TEF | pagamento integrado: o sistema envia o valor à maquininha e recebe a confirmação |

## Histórico desta documentação

| Versão | Data | O que mudou |
| --- | --- | --- |
| v1 | 26/10/2026 | primeira versão: arquitetura, stack, repositório, modelo de dados, fluxos, integrações, infraestrutura, design system, segurança, ambientes |
| v1.1 | 26/10/2026 | acesso: login por e-mail e código substitui a tela de perfis; permissões CRUD por módulo; tela Usuários; app v19 |
| v1.2 | 26/10/2026 | câmera sempre ligada no checkout e quiosque; editor manual de ajustes; FTP embutido no agente; temas por venue (Maracanã, Lollapalooza) |
| v1.3 | 26/10/2026 | white label com a identidade Viva Maracanã do manual de marca |
| v1.4 | 26/10/2026 | e-mail hello@eterna.photo (ImprovMX + Gmail), registros de DNS |
| v1.5 | 26/10/2026 | hello@eterna.photo vira o e-mail oficial do Eterna (códigos de login e contato) |
| v1.6 | 26/10/2026 | sincronização Roverpix pelo agente (chave local, só agregados no app) |
| v1.7 | 28/10/2026 | galeria online por QR, fase 1 (app v77): rotas `#loja` e `#g`, manifesto, adaptadores, links HMAC, lápide, limites, CORS e Host, retenção 60 dias, administração Galerias online, canal Online, tempo da tela final, segurança e pendências da fase 2 |
| v1.8 | 28/10/2026 | acesso, permissões e menus (app v78): módulos novos, `MODULE_INFO`, duas camadas módulo e menu, `permValidate`, `ACT_MOD`, auditoria, `loginMark`, migração v2, tela "sem acesso", menus em grupos e gaveta no celular, telas removidas, contrato de servidor e pendências de segurança |
| v1.9 | 28/10/2026 | Checkout, caixa e ajuste automático (app v79): dinheiro aguardando caixa (`SIM.caixaDin`, estados, Caixa, Lista de vendas, CSV, Alertas, contrato futuro), sincronização entre janelas, aba do Checkout sem login, saída da equipe só na câmera, interruptor do ajuste automático, catálogo novo do Tour, `lojaIdeal`, `printsVenda`, economia, valor gravado na venda e pendências |


## Fundos de IA com Photoroom (v41, 27/10/2026)

- Os 10 fundos limpos ficam em `img/bg-<id>.jpg` e estão cadastrados em `DATA.backgrounds` com ângulo de câmera, tipo e direção da luz, cor (cor, sépia, P&B), enquadramentos aceitos e posição do grupo (`pos`).
- O recorte e a montagem são feitos pelo Photoroom (Image Editing API, `POST https://image-api.photoroom.com/v2/edit`), chamado pelo agente do ponto. O Eterna não recorta mais no navegador.
- Chave: `~/Eterna/photoroom.json` (permissão 600), digitada pelo usuário em Fundos de IA. Chaves `sandbox_` são grátis (1.000 por mês, com marca d'água).
- Agente: `GET /photoroom/status`, `POST /photoroom/config` e `POST /photoroom/compose` (só aceitam a origem do próprio agente), `GET /photoroom/result/<arquivo>`.
- Pedido: foto (`pid` do agente em alta, ou JPEG da tela), fundo, `outputSize` do fundo, `padding*` calculado da posição do grupo, `lighting.mode=ai.auto`, `shadow.mode=ai.soft`, `export.format=jpeg`.
- Cache: `~/Eterna/fundos-ia/<hash foto>_<fundo>_<hash posição>.jpg`. A mesma foto no mesmo fundo não é cobrada de novo.
- Sala de imprensa: o app recoloca a bancada por cima do resultado, para o grupo ficar atrás da mesa.

## Galeria online por QR, fase 1 (v77, 27/10/2026)

Depois da compra, a tela final do Checkout mostra um QR. Quem escaneia confirma com uma selfie e vê as fotos compradas e as cortesias para baixar, e o resto da visita com marca d'água para comprar. Para escola, um QR geral por grupo: o responsável envia a foto do rosto da criança e vê só as fotos em que ela aparece. Armazenamento e pagamento ficam atrás de adaptadores neutros. Nesta fase o agente do ponto faz o papel do bucket e o pagamento é simulado.

Plano completo, critérios de aceite e adendos: `docs/planos/2026-10-27-galeria-qr-fase1.md`. Revisões: `...-revisao.md` (código) e `...-seguranca.md` (segurança).

```mermaid
sequenceDiagram
  participant C as Cliente (celular)
  participant L as Checkout (#loja)
  participant APP as App (SIM)
  participant AG as Agente do ponto
  L->>APP: venda paga (lojaPay)
  APP->>APP: galDaVenda: token, código, manifesto
  APP->>AG: POST /galerias/publicar (fila, com novas tentativas)
  AG->>AG: copia originais de compradas e cortesias, gera vitrines
  L-->>C: QR eterna.photo/#g/<token> e código XXXX-XXXX
  C->>AG: GET /g/<token>/info
  C->>AG: POST /g/<token>/rosto (consentimento + selfie)
  AG-->>C: acesso (1 h) + galeria com links assinados (15 min)
  C->>AG: POST /g/<token>/pagamento (pids, método, idem)
  AG-->>C: pedido aprovado (teste) + galeria atualizada
  APP->>AG: GET /galerias/vendas (a cada 30 s)
  AG-->>APP: vendas online (Lista de vendas, canal Online)
```

### Rotas do app

| Rota | Quem usa | O que abre |
| --- | --- | --- |
| `#loja` | cliente no Checkout (perfil Checkout, ou o botão "Abrir Checkout" da barra da equipe, desde a v78) | Checkout sem login, sempre em tela cheia, sem menu e sem cabeçalho do app. Etapas `state.kiosk.step` = code → review → cart → done |
| `#g/<token>` | cliente que escaneou o QR | galeria pública sem login (`vGaleriaQR`, classes `gq-`) |
| `#g` | cliente sem o QR | campo para digitar o código curto do recibo |

- `render()` trata `state.pub` e `state.lojaRota` antes de tudo: não pede login, não chama `syncHash` e não mostra `.bare-exit`. Recarregar a página nunca abre o Checkout para a equipe; ele só abre com `#loja` ou com o perfil quiosque.
- **Checkout (`#loja`)**: Esc ou o botão Sair do painel da equipe chamam `lojaSair()`, que sempre leva ao login (faz logout se houver usuário). 3 toques seguidos no logo (`lojaLogo`, janela de 1,5 s) abrem o painel escondido da equipe com "Sessões esperando" e "Sair". Botão "Voltar ao início" em todas as etapas. Não há volta automática por inatividade. Idiomas por bandeiras em SVG (`LANG_FLAGS`, Brasil, EUA, Espanha, França, Alemanha), porque emoji de bandeira não aparece no Chrome do Windows.
- **Tela final do Checkout**: QR (`#lqr`) com o código `XXXX-XXXX` embaixo e contagem regressiva. Volta sozinha à câmera em `SIM.lojaFimSeg` segundos (padrão 30, de 5 a 120). `lojaTick` é o único timer do Checkout e morre ao sair da rota, trocar de etapa ou recarregar.
- **Galeria pública (`#g/<token>`)**, passos de `state.pub.step`:
  - `carregando` → `GET /g/<token>/info` no agente (tempo limite 2,5 s);
  - `codigo`, `nao_existe`, `expirada` (410) ou `chegando` (agente fora e token desconhecido neste aparelho; nova tentativa a cada 20 s);
  - `consent` (texto do titular ou do responsável, botão desligado até marcar) → `selfie` (câmera frontal para adulto, traseira para criança) → `buscando` → `nao` (sem rosto, não encontrado ou bloqueado, com tentativas restantes) ou `galeria`;
  - `pagar` (Pix ou Cartão, aviso "Pagamento de teste") → `aguardando` (reservado para o adquirente real, consulta a cada 5 s).
- **Modo agente e modo SIM**: com o agente respondendo, tudo passa pelas rotas `/g/*`. Sem agente, mas com o token em `SIM.galerias` (o mesmo navegador que vendeu), a galeria roda no navegador com `faceFind` e `photoCanvas`. O modo SIM existe para o protótipo e os testes.
- **Links vencidos**: com mais de 12 min de galeria aberta, ou se um download falhar, o app pede `POST /g/<token>/galeria` e tenta de novo uma vez. Acesso vencido (401) volta para a selfie com o aviso `gq_again`.
- Textos do cliente: chaves `gq_*` e `lj*` no `I18N`, nas 5 línguas. "Baixar todas" baixa uma por uma (sem ZIP nesta fase).

### Token e código curto

- Token: 16 bytes de `crypto.getRandomValues`, base64url sem `=`, 22 caracteres (`^[A-Za-z0-9_-]{22}$`). Nunca `Math.random`, nunca derivado do código LP.
- Código curto: `XXXX-XXXX` com o alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem 0, O, 1, I). É só um apelido do token para digitar quando o QR falha, e também exige selfie.
- Os dois nascem no app (`galToken`, `galCodigo`, `galNovo`), então o Checkout nunca trava sem internet. O QR é sempre desenhado por `qrDraw(el,texto,tamanho)` com a cópia local `vendor/qrcode/qrcode.min.js` (qrcodejs 1.0.0, MIT). Sem a biblioteca, aparece o código em texto.
- O recibo da venda (Lista de vendas › Recibo) mostra o mesmo QR e o código (`drawQR`, `galCod`).

### Manifesto `sessao.json`

Igual no app (`SIM.galerias[token]`) e no agente (`~/Eterna/galerias/<token>/sessao.json`).

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

- `tipo`: `sessao` (uma sessão, criada na venda ou pela administração) ou `evento` (grupo de escola: `nome`, `data`, várias `sessoes`, `menor:true`).
- `expira` = `criada` + 60 dias. `encerrada:true` aparece depois de "Encerrar".
- `precos.dig` vem do item `dig` do catálogo ("Foto digital avulsa (galeria online)", R$ 39). `precos.todas` vem do `mais` ("Pacote Maracanã Mais", R$ 250).
- `envio` é preenchido pelo agente: `ok` quando os originais das compradas e cortesias e as vitrines estão prontos.
- O agente valida tudo em `gal_validar` (só campos conhecidos, tipos e tamanhos, até 2.000 fotos e 200 sessões) antes de gravar.

### Direito por foto

| Direito | De onde vem | O que o cliente vê |
| --- | --- | --- |
| `comprada` | venda paga da Loja (`canal:"loja"`, todas as fotos escolhidas, porque todo pacote inclui digital) ou compra na galeria (`canal:"online"`) | "Suas fotos", com Baixar (original) |
| `cortesia` | dada na administração, guardada por foto em `SIM.sessions[card].cort` e válida em todas as galerias que contêm a sessão | "Suas fotos", com selo Cortesia e Baixar |
| `venda` | o resto da sessão | "Mais fotos da sua visita", vitrine com marca d'água, ✓ para comprar |

- Precedência: `comprada > cortesia > venda`. Uma foto comprada não recebe cortesia.
- `galAtualizar(token)` recalcula as fotos a partir da sessão e preserva a `comprada/online`. Cancelar uma venda da Loja tira a `comprada/loja` no app.
- No agente, `gal_mesclar` nunca deixa uma compra regredir, de nenhum canal. Por isso o cancelamento ainda não chega ao agente (pendência da fase 2).
- Sessão de adulto: o rosto bate quando alguma foto tem semelhança ≥ 0,45 (`LIMITE`) e abre a sessão inteira. A faixa "talvez" (0,38 a 0,45) não abre.
- Grupo de escola: só as fotos em que o rosto bate com ≥ 0,50 (`LIMITE_MENOR`), nunca a sessão inteira. O limite ainda precisa ser calibrado com fotos de escola (Ronaldo, `/rostos/medir`).

### Adaptadores no agente

| Adaptador | Interface | Fase 1 | Fase 2 |
| --- | --- | --- | --- |
| Armazenamento `Repositorio` | `salvar_manifesto`, `ler_manifesto`, `subir`, `existe`, `url`, `abrir`, `apagar`, `listar_expiradas` | `RepositorioLocal` em `~/Eterna/galerias/<token>/{sessao.json,original/,vitrine/}` | `ETERNA_REPO=s3` (`put_object`, `generate_presigned_url`) ou `azure` (`upload_blob`, `generate_blob_sas`). Hoje levantam `NotImplementedError` |
| Pagamento `Pagamento` | `criar(pedido)`, `consultar(id)`, `webhook(corpo,cabecalhos)` | `PagamentoSimulado`: aprova na hora e devolve `teste:true` | `ETERNA_PAGAMENTO=<provedor>` (Mercado Pago ou Asaas), chaves em `~/Eterna/pagamento.json` (chmod 600). Liberação só pelo webhook assinado ou pela consulta |

- As rotas não mudam quando o adaptador muda. Sem SDK nesta fase.
- O preço é sempre recalculado no agente: `min(n × dig, todas)`. O `total` mandado pelo navegador é ignorado.
- Vitrine: miniatura de 900 px. Com OpenCV, a marca d'água "VIVA MARACANA" é gravada na imagem. Sem OpenCV, a tela põe a sobreposição `.wm` e o `/status` informa `vitrine_marca:false`. O original só é copiado e servido para foto `comprada` ou `cortesia`.
- `galeria_loop()` processa a fila por token: primeiro os originais das compradas e cortesias, depois as vitrines. Depois de uma compra online, os originais são preparados antes de responder.
- D14: o agente só recebe sessões cujas fotos são todas `ag_`. Sessões de exemplo (sprites) ficam com estado `local` e funcionam só no modo SIM.

### Links assinados (HMAC)

- Formato: `/g/<token>/foto/<pid>?v=<vitrine|original>&exp=<epoch>&sig=<hex>`.
- `sig = HMAC-SHA256(segredo, "token|pid|v|exp")`, comparada com `hmac.compare_digest` depois de checar o formato `^[0-9a-f]{64}$`.
- Segredo de 32 bytes em `~/Eterna/galeria-segredo.json` (chmod 600), criado na primeira vez.
- Validade: 15 min (`URL_TTL=900`). O acesso devolvido pela selfie vale 1 h (`ACESSO_TTL=3600`) e fica só em memória.
- A rota de foto checa de novo o manifesto a cada pedido: 403 com assinatura ruim ou vencida, pid fora do token, galeria encerrada ou expirada, ou `v=original` em foto `venda`.

### Rotas do agente

**Públicas** (CORS `*`; token validado por regex antes de qualquer caminho em disco)

| Rota | Entrada | Saída |
| --- | --- | --- |
| `GET /g/<token>/info` | | `{ok,tipo,menor,expira,estado:"pronta"\|"chegando",venue}`. Nunca `sessoes`, `fotos`, `codigo` nem a quantidade de fotos. 404 se não existe, 410 se encerrada, expirada ou com lápide |
| `GET /g/codigo/<CODIGO>` | | `{token}`, ou 404 (também para galeria encerrada, expirada ou com lápide) |
| `POST /g/<token>/rosto` | `{consentimento:true,versao,idioma,imagem:"data:image/jpeg;base64,…"}` | bateu: `{ok:true,acesso,exp,galeria}`. Sem rosto: `{ok:false,motivo:"sem_rosto",restam}`. Não bateu: `{ok:false,motivo:"nao_encontrado",restam}`. Bloqueado: 429 `{motivo:"bloqueado",ate}`. Reconhecimento desligado ou fotos ainda não lidas: 503 `{motivo:"processando"}`. Sem consentimento: 400. Corpo acima de 2 MB: 413 |
| `POST /g/<token>/galeria` | `{acesso}` | `{galeria}` com links reassinados. 401 se o acesso for inválido ou vencido |
| `GET /g/<token>/foto/<pid>?v=&exp=&sig=` | | JPEG, ou 403 (ver acima) |
| `POST /g/<token>/pagamento` | `{acesso,pids:[…],metodo:"pix"\|"cartao",idem}` | `{ok,pedido:{id,status,total,canal:"online",teste,checkout_url,pix_copia_cola},galeria}`. Pid fora do acesso ou que não está à venda: 400. Mesmo `idem` duas vezes: a mesma venda |
| `POST /pagamento/webhook/<provedor>` | | 501 (reservado para o adquirente real) |

Objeto `galeria`:

```json
{"tipo":"sessao","menor":false,"expira":"…","estado":"pronta","precos":{"dig":39,"todas":250},
 "fotos":[{"pid":"ag_3f9a1c","direito":"comprada","vitrine":"/g/…?v=vitrine&exp=…&sig=…","original":"/g/…?v=original&…","chegando":false}]}
```

**Locais** (Origin vazio ou `http://127.0.0.1:PORTA`/`http://localhost:PORTA`, e `Host` igual a `127.0.0.1:PORTA` ou `localhost:PORTA`; o resto recebe 403)

| Rota | Função |
| --- | --- |
| `POST /galerias/publicar` | recebe `{manifesto}`, mescla com o que existe e devolve `{ok,token,estado}`. Token com lápide: 410 `{estado:"encerrada"}` |
| `POST /galerias/encerrar` | recebe `{token}`, grava `expira=agora` e `encerrada:true` |
| `GET /galerias/vendas?desde=n` | `{vendas:[{id,token,sessoes,pids,n,total,metodo,em,canal,todas,teste}],next}`, de 500 em 500 |
| `GET /galerias/status` | `{fila,galerias:[{token8,estado,envio}]}` |

`/status` ganhou `galerias:{fila,total,vitrine_marca}`.

### Encerrar e lápide

- "Encerrar" (só grupos, na administração) grava `encerrada:true` e `expira=agora` no app e no agente.
- Republicar não desfaz: `gal_mesclar` mantém a menor validade entre o manifesto velho e o novo, e mantém `encerrada`. Não existe ação para reabrir na fase 1.
- A limpeza diária apaga do disco as galerias encerradas ou expiradas. Antes, grava uma lápide em `~/Eterna/galerias/encerradas.json`: `{token: {encerrada:true, motivo:"encerrada"|"expirada", em, codigo}}`.
- Com lápide: republicar dá 410 (a fila do app marca `encerrada`), `/info` dá 410 e o código curto dá 404. Os originais em `~/Eterna/inbox` continuam guardados.

### Limites de tentativas

| Limite | Valor | Onde |
| --- | --- | --- |
| Falhas de selfie por `(ip, token)` | 5 falhas bloqueiam 15 min (sem rosto também conta). Um acerto não zera as falhas | `falhou`, `bloqueio` |
| Selfies por IP | 10 `POST /rosto` por minuto | `limite_ok(ip,"rosto",10)` |
| Código curto por IP | 30 `GET /g/codigo` por minuto | `limite_ok(ip,"codigo",30)` |
| Grupo de escola, por `(ip, token)` | no máximo 2 crianças diferentes em 24 h | `evento_permite` |
| Grupo de escola, por galeria | no máximo 60 acessos por hora, somando todos os IPs | `evento_permite` |
| Corpo | 2 MB no `/rosto` e no `/galerias/publicar`; 64 KB no `/galeria` e no `/pagamento` | `corpo()` |
| Imagem | acima de 40 MP é recusada (`OPENCV_IO_MAX_IMAGE_PIXELS`) | início do agente |
| Conexão | `timeout` de 20 s na classe `H` | `H.timeout` |

No navegador (modo SIM), as tentativas ficam em `sessionStorage` (`eterna.gq.<token8>`), só com contador e hora.

### CORS e Host

- `/g/*`: públicas, CORS `*`.
- `/biblioteca`, `/thumb/`, `/file/`: CORS só para a origem do agente e `ETERNA_APP_ORIGIN`; outra origem recebe 403. O `Host` precisa ser o do agente (127.0.0.1, localhost ou o IP da rede com `ETERNA_REDE`), contra DNS rebinding.
- `/rostos/*` e `/galerias/*`: só origem local, com `Host` `127.0.0.1:PORTA` ou `localhost:PORTA`.
- Rotas com chave (Roverpix, Photoroom, FTP remoto): como antes, só origem local.

### Retenção: 60 dias

- Galeria: `expira` = criada + 60 dias. Depois disso, `/info` dá 410 e a limpeza diária apaga a pasta (com lápide).
- Leituras de rosto no agente (`RETENCAO_DIAS`): subiu de 30 para 60 (D10), para a selfie funcionar até o último dia da galeria. A limpeza roda ao iniciar e uma vez por dia dentro do `galeria_loop`, mesmo com o agente ligado sem parar.
- A selfie e a foto da criança nunca vão para disco, log, `localStorage` ou `sessionStorage`. No navegador, `selfieStop()` zera a imagem logo depois da busca.

### Arquivos no agente

| Caminho | Conteúdo |
| --- | --- |
| `~/Eterna/galerias/<token>/sessao.json` | manifesto |
| `~/Eterna/galerias/<token>/original/<pid>.jpg` | originais de compradas e cortesias |
| `~/Eterna/galerias/<token>/vitrine/<pid>.jpg` | vitrines de 900 px |
| `~/Eterna/galerias/encerradas.json` | lápides |
| `~/Eterna/galerias/vendas-online.jsonl` | `{id:"O0001",token,sessoes,pids,n,total,metodo,em,canal:"online",idem,todas,pagamento,teste}` |
| `~/Eterna/galerias/consentimentos.jsonl` | `{token,tipo:"titular"\|"responsavel",versao,idioma,em}`, sem IP e sem imagem |
| `~/Eterna/galeria-segredo.json` | segredo HMAC (chmod 600) |
| `~/Eterna/pagamento.json` | chaves do adquirente (fase 2, chmod 600) |

Variáveis novas: `ETERNA_REPO` (padrão `local`), `ETERNA_PAGAMENTO` (padrão `simulado`), `ETERNA_SEM_OPENCV` (testes).

### Estado novo no app (`SIM`)

| Chave | Conteúdo |
| --- | --- |
| `SIM.galerias[token]` | manifesto |
| `SIM.galFila` | `[{token,estado:"local"\|"pendente"\|"enviada"\|"encerrada"\|"erro",tent,erro,prox,em}]`. `galFilaTick` roda a cada 10 s; erro tenta de novo em 10 s, 30 s, 60 s e depois a cada 5 min |
| `SIM.vendasOnline` | `[{id,token,card,pids,n,total,pay:"Pix online"\|"Cartão online",at,canal:"online",status:"paga",todas,teste}]`. Vem do agente (`galVendasPoll`, a cada 30 s) ou do modo SIM |
| `SIM.galVendasN` | posição já lida de `/galerias/vendas` |
| `SIM.cortesiaLog` | `[{token,card,pid,acao:"deu"\|"retirou",motivo,nota,por,em}]`, até 500 |
| `SIM.sessions[card].cort` | cortesias por foto da sessão |
| `SIM.sessions[card].menor` | sessão com menor (consentimento do responsável) |
| `SIM.lojaFimSeg` | segundos da tela final do Checkout |

A venda paga cria e publica a galeria por `galDaVenda(card)`, na Loja (`lojaPay`) e no caixa (`caixaConfirm`). O `render` só lê.

### Administração: Galerias online

View `galerias` (`vGalerias`), módulo de permissão `galerias` ("Galerias e cortesias"). Admin recebe tudo; supervisor recebe criar, ver e alterar (sem excluir, então não vê "Encerrar"); os outros perfis não recebem nada. Um aviso no topo lembra a limitação da fase 1.

| Aba | O que faz |
| --- | --- |
| Sessões | busca por LP; tabela com venda, estado da galeria (sem galeria, local, pendente, enviada) e menor. Aberta a sessão: grade com o direito de cada foto. Tocar numa foto à venda abre a cortesia (motivo Escola, Parceiro, Reclamação ou Outro, nota opcional). Tocar numa cortesia oferece "Retirar cortesia". Botões "Criar galeria", "Ver QR", "Abrir galeria" (abre `#g/<token>` em outra aba), "Reenviar" e a chave "Sessão com menor" |
| Grupos e escolas | "Novo grupo" com nome, data, sessões do dia e "Grupo com menores" (marcado por padrão). Salvar cria um manifesto `evento` e marca `menor` nas sessões (e limpa das que saíram, se nenhum outro grupo com menor as tiver). Por grupo: "Imprimir QR" (página com logo, nome, data, QR grande, código e instrução), "Baixar PNG" (QR de 1024 px), "Abrir galeria", "Editar sessões" e "Encerrar" |
| Envio | `SIM.galFila` com estado, tentativas, último erro e "Tentar agora" |
| Cortesias | log com quando, quem, sessão, foto, motivo, ação (deu ou retirou) e nota |

Ações que gravam (`WRITE_OPS`): `gal-criar` (c), `gal-cort`, `gal-cort-ok`, `gal-cort-rm`, `gal-menor`, `gal-reenviar`, `gal-ev-editar` (u), `gal-ev-novo` e `gal-ev-salvar` (c), `gal-ev-encerrar` (d). Só leitura: `gal-tab`, `gal-open`, `gal-qr`, `gal-abrir`, `gal-ev-print`, `gal-ev-png`. As ações da galeria pública (`gq-*`) ficam fora do `WRITE_OPS`, porque não há usuário.

### Vendas: canal Online

- `allSalesSim()` junta as linhas de `SIM.vendasOnline` com `pdv:"Galeria online"`, `seller:"Online"`, itens `dig` (ou `mais` quando saiu pelo preço de todas) e `canal:"online"`. As demais linhas recebem `canal:"loja"`.
- Lista de vendas: chips "Canal: Todos / Loja / Online" e coluna Canal. Linhas online não têm Recibo nem Cancelar. O CSV ganhou a coluna `canal`.
- Venda com `teste:true` (pagamento simulado) aparece com status "teste" e pagamento "(teste)", e fica fora da receita.

### Checkout: tempo da tela final

Catálogo e preços › seção Checkout › "Tempo da tela final com o QR (segundos)". Padrão 30, mínimo 5, máximo 120, gravado em `SIM.lojaFimSeg` (permissão `catalogo.u`). Fora da faixa, o Checkout usa o padrão.

### Segurança da galeria por QR

**O que ainda é protótipo na v77**

- O celular do cliente não alcança o agente (127.0.0.1 no computador do ponto, e o navegador bloqueia https chamando IP de rede local). No celular, o QR mostra "Suas fotos estão chegando" até a nuvem (fase 2). A galeria funciona de verdade só no computador do ponto e nos testes.
- Pagamento simulado é o padrão: nada é cobrado e toda venda online sai com `teste:true`, fora da receita.
- Modo SIM: sem agente, toda a decisão (rosto, direito, compra) fica no navegador e é fácil de contornar. Só vale no navegador que tem o SIM e não expõe nada a terceiros, mas `window.ETERNA` expõe `SIM`. Precisa de uma chave para desligar em produção.
- Permissões da administração são verificadas só no navegador (o servidor passa a verificar quando entrar; ainda sem versão marcada).
- Estado em memória no agente (`acessos`, `_janelas`, `_falhas`, `_evento_acertos`): reiniciar o agente derruba os acessos, e o cliente volta para a selfie.
- Vendas e consentimentos em jsonl, com id de venda pela contagem de linhas.
- Sem prova de vida (liveness) na selfie. Risco aceito: quem tem o QR normalmente é o comprador.
- `LIMITE_MENOR` (0,50) não foi medido com fotos de crianças; o SFace foi calibrado em adultos.
- Com `ETERNA_REDE=1`, a galeria roda na rede local em http puro, com a selfie sem criptografia.

**Pendências para a fase 2**

- **IMPORTANTE.** Grupo de escola: quem já abriu as fotos de uma criança pode recortar o rosto de outra da vitrine e abrir as fotos dela. A v77 só reduz o risco (2 crianças por IP e galeria em 24 h, 60 acessos por galeria por hora). Decisão do Eduardo: PIN por criança ou família, ou desfoque dos outros rostos na vitrine.
- **IMPORTANTE.** Pagamento na Loja: Dinheiro fica "aguardando caixa" desde a v79 (seção "Checkout, caixa e ajuste automático"). Cartão e PIX ainda viram `paga` pelo que o cliente toca e liberam o original na galeria (I5 da v79).
- **IMPORTANTE.** Limite de selfies por `(ip, token)` no lugar de só por IP: hoje 10 por minuto num IP bloqueiam todos atrás do mesmo NAT (o Wi-Fi do estádio). Juntar com teto global na fila do `_busca_lock` e `X-Forwarded-For` só de proxy confiável.
- **IMPORTANTE.** Limite de concorrência nas rotas `/g/*` (a v77 já tem `timeout` de 20 s por conexão).
- **IMPORTANTE.** Adquirente real (Mercado Pago ou Asaas): liberar só pelo webhook com assinatura validada ou pela consulta, nunca pelo retorno do navegador.
- Banco em vez de jsonl: SQLite (ou o banco da nuvem) com `UNIQUE(token, idem)`; tirar `acessos`, `_janelas`, `_falhas` e `_evento_acertos` da memória.
- Compra online por foto valer em todas as galerias da sessão (hoje fica só no manifesto onde aconteceu, grupo ou sessão).
- Cancelamento de venda da Loja chegar ao agente, com uma ação explícita de estorno.
- Notas menores da revisão de segurança: limpeza de `_falhas`; faixa de preços no manifesto; recusar código curto repetido entre tokens; versão do consentimento definida pelo servidor e prazo para os logs; não expor `menor` no `/info` nem o total de galerias no `/status`; vitrine sem marca quando o `imread` falha; `os.link` para não duplicar originais; "não sou eu" e pedido de remoção na sessão de adulto (D2).

## Acesso, permissões e menus (v78, 28/10/2026)

A v78 reorganiza o menu em grupos, cria a área de Permissões em Configurações e tira as telas que a galeria por QR substituiu. Cada pessoa passa a ter duas coisas separadas: o que pode fazer em cada módulo (C, R, U, D) e quais telas vê no menu.

Planos: `docs/planos/2026-10-27-menus-v78.md` (com as decisões do programador) e `docs/planos/2026-10-27-permissoes-v78.md` (com as "Pendências para a v79"). Revisões: `docs/planos/2026-10-28-v78-revisao.md` e `docs/planos/2026-10-28-v78-seguranca.md`.

### Menus e submenus

| Grupo | Itens (view) |
| --- | --- |
| (sem grupo) | Início (`perfis`, abre pelo logo) · Checkout (`quiosque`, botão "Abrir Checkout") |
| Dashboard | Painel (`painel`, v80) · Bandeiras (`bandeiras`) · Estoque (`estoque`) · Fotógrafos (`fotografos`) · Vendas e caixa (`vendas`) · Lista de vendas (`vendas-lista`) · Galerias online (`galerias`) |
| Curadoria | Qualidade (`revisao`) · Treino da IA (`treino`) · Alertas (`alertas`) |
| Fotógrafo | Diário do set (`diario`) · Upload automático (`importar`) · Escala 5×2 (`escala`) |
| Configurações | Repositório (`repo`) · Identidade (`identidade`) · Painel de controle (`catalogo`, antes Catálogo e preços) · Fundos de IA (`chroma`) · Ajuste automático (`ajustes`) · Usuários (`usuarios`) · Permissões (`permissoes`) |
| Laboratório | Vestiário (`vestiario`) |

- O grupo é o 4º campo de cada linha de `VIEWS`. Grupo `''` é tela sem item no menu. Itens do mesmo grupo ficam contíguos, porque o `render()` abre um cabeçalho a cada troca de grupo.
- Os grupos abrem e fecham (`nav-grp`, `state.navOpen`, `aria-expanded` e `aria-controls`). O grupo da tela atual fica aberto (`state.navCur`). Grupo sem nenhum item permitido some.
- "Abrir Checkout" fica em `#rail-ck`, fora dos grupos, e só aparece com `canView('quiosque')` (ação `loja-abrir`, leva a `#loja`).
- `VIEWS_EXTRA`: telas sem item no menu, abertas por botões dentro de outras telas. Venda no balcão (`checkout`), Fila do balcão (`fila`) e Caixa (`caixa`). "Fila da loja" virou "Fila do balcão" para não haver duas coisas chamadas Checkout.
- **Celular (até 700 px)**: o cabeçalho fixo fica com o logo, o Checkout em ícone e o botão Menu (`#menu-btn`, `menu-toggle`). O menu abre numa gaveta por cima da tela (`body[data-drawer]`, `#railgav` com `role=dialog` e `aria-modal`). Fecha ao escolher um item, ao tocar no fundo escuro (`#navback`, `menu-close`), com Esc ou se a janela passar de 700 px. Entre 701 e 900 px o menu continua como barra no topo.

### Telas e perfis removidos

- **Fluxo**: saiu inteiro (`vFluxo`, `postvisit-all`, CSS `.flow`). O módulo `relatorios` ficou com Semana e Alertas.
- **Anfitrião no set** (view `set`): saiu. O check-in da câmera (`camPanel`, série da câmera → fotógrafo do dia) e a troca ou saída do fotógrafo (`fotoQuem`, `set-switch`, `set-logout` com `auth_next='importar'`) foram para o Upload automático (`importar`). O check-in respeita `can('set','u')`. O link antigo `#set` cai em `importar`. Ao carregar, sessões com `status:'aberta'` em `SIM.sessions` viram `fechada`, com `closedBy:'v78: Anfitrião no set removido'`, para nada ficar preso.
- **Convidado** (view `convidado`, módulo `galeria`): saiu. A galeria pública `#g/<token>` substitui. A selfie da `#g` usa `selfieStart`, `selfieMount`, `selfieStop` e `state.guest.selfie`. O recibo oferece "Abrir a galeria online" (`gal-abrir`). Pendência: a compra de fundo de IA depois da visita só existia no Convidado e fica para a fase 2 da `#g`.
- **Perfil Cliente e login de convidado**: saíram. `userFor(email)` devolve `null` para e-mail fora do cadastro ou desativado, e o login mostra "Este e-mail não tem acesso". Sessão forjada com e-mail desconhecido é recusada.

### Módulos (`MODULES` e `MODULE_INFO`)

| Módulo | Nome na tela | Telas | Letras que se aplicam |
| --- | --- | --- | --- |
| `estoque` | Estoque e bandeiras | bandeiras, estoque | C R U D |
| `relatorios` | Relatórios | alertas (v80: a Semana saiu) | R |
| `desempenho` | Índice do fotógrafo | fotografos | R |
| `financeiro` (novo) | Números de vendas | painel (v80), vendas, vendas-lista | R D (D = cancelar venda) |
| `galerias` | Galerias online | galerias | C R U D |
| `qualidade` | Qualidade e IA | revisao, treino | C R U |
| `diario` | Diário do set | diario | C R U D (D = ver e tratar as ocorrências da equipe toda) |
| `set` | Upload, câmeras e ajustes | importar, ajustes | C R U D (D = limpar a leva; v80: o check-in da câmera saiu) |
| `escala` (novo) | Escala 5×2 | escala | R U |
| `configuracao` | Configurações do venue | repo, identidade, chroma (e o FTP do estádio dentro do Painel de controle, v80) | R U |
| `catalogo` | Painel de controle (catálogo e preços) | catalogo | R U |
| `usuarios` | Cadastro de usuários | usuarios | C R U D |
| `permissoes` (novo) | Permissões | permissoes | R U, sempre juntos |
| `laboratorio` (novo) | Laboratório | vestiario | R |
| `venda` | Venda no balcão | checkout, fila, caixa | C R U |
| `quiosque` | Checkout (autoatendimento) | quiosque | C R |

- O módulo `galeria` (Galeria do convidado) saiu.
- O Ajuste automático aparece no grupo Configurações, mas a tela `ajustes` continua no módulo `set`. Assim a migração não tira nem dá o direito de ajustar fotos a ninguém.
- `MODULE_INFO[m]` = `{desc, c?, r?, u?, d?}`: uma descrição do módulo e o texto de cada letra que se aplica. Letra sem texto não se aplica (`opOk(m,op)` falso), aparece como um traço na matriz (`.perm-na`, "Não se aplica a este módulo") e é gravada como `false`.
- `OPS_INFO` dá os rótulos: Criar (C · Create), Ver (R · Read), Alterar (U · Update), Excluir (D · Delete). `OPS` continua existindo para o `guardAct`.
- `permNorm(perms)`: zera letra que não se aplica, liga R quando há C, U ou D, e em `permissoes` liga R e U juntos ou nenhum.
- O teste `testes/permissoes.js` (critério 19) abre cada tela como admin e confere que toda ação do `WRITE_OPS` encontrada tem a letra aplicável no `MODULE_INFO` do módulo dela.

### Perfis prontos (`PRESETS`)

| id | Nome | Módulos | Menu | Tela inicial |
| --- | --- | --- | --- | --- |
| `admin` | Admin | tudo | todas as telas (`menu:'*'`) | Início |
| `foto` | Fotógrafo | set C R U, diario C R U, escala R | diario, importar, escala | Upload automático |
| `venda` | Atendimento e venda | venda C R U, quiosque C R, catalogo R | quiosque, checkout, fila, caixa, catalogo | Início |
| `valida` | Validador | qualidade (tudo), diario R | revisao, treino, diario | Qualidade |
| `supervisor` | Supervisor | relatorios R, desempenho R, financeiro R, diario tudo, set R, venda C R U, qualidade R, estoque tudo, configuracao R U, escala R U, laboratorio R, catalogo R, galerias C R U | todas as telas desses módulos | Início |
| `quiosque` | Checkout (tela do cliente) | quiosque C R | quiosque | Checkout |

- Cada perfil tem `desc` em linguagem simples, mostrada na aba Perfis prontos e ao escolher o perfil.
- **Pendente de confirmação do Eduardo**: o Fotógrafo vê só o grupo Fotógrafo. Ficou sem o Índice do fotógrafo e sem o Ajuste automático no menu. O plano de permissões assumia que ele continuaria vendo o próprio índice.

### Duas camadas: módulo e menu

- `canView(v)` exige as duas: "Ver" do módulo da tela (no Checkout, `quiosque.r` ou `venda.r`) **e** a tela na lista `menu` da pessoa (`menuOk(v)`). Em `permissoes`, exige também `permissoes.u`.
- `userMenu(u)`: para Admin, todas as telas; para os outros, `u.menu` ou, se faltar, `presetMenu(u.preset)`.
- A lista é de telas permitidas, não de escondidas. Tela nova não aparece para ninguém até alguém liberar, menos para o Admin, que recebe tudo.
- Tela não permitida: some do menu, `go(v)` mostra "Sem acesso a esta tela", o `#hash` mostra o mesmo aviso e o `render()` cai no `homeView()`.
- `homeView()`: a tela inicial da pessoa (`inicio`) se ela puder ver; senão `semacesso` quando nenhuma tela é permitida; senão a primeira tela, no aparelho só de Checkout; senão o Início.
- **Tela `semacesso`** (`vSemAcesso`): quem foi criado com "Sem acesso ainda" vê "Seu acesso ainda não foi liberado. Peça ao administrador." e o botão Sair, sem menu.
- O Início só mostra "R$" para quem tem `financeiro.r`, e as contagens de set e venda só para quem tem `set.r` ou `venda.r`.

**Regra para tela nova**: entra em `VIEWS` (com o grupo), em `MODULES` (num módulo existente ou novo), em `MODULE_INFO` (com o texto de cada letra que se aplica) e no `menu` dos perfis que devem vê-la. Ação que grava entra em `WRITE_OPS` com a letra.

### Usuário v2

Gravado em `localStorage` `eterna.users.v1` (mapa por e-mail) e em `usuarios/<email>` no `state.db`.

```json
{"v":2,"email":"carlos@eterna.photo","name":"Carlos","key":"carlos","preset":"foto",
 "perms":{"set":{"c":true,"r":true,"u":true,"d":false},
          "financeiro":{"c":false,"r":false,"u":false,"d":false}},
 "menu":["diario","importar","escala"],"inicio":"importar",
 "active":true,"createdAt":"2026-10-26T12:00:00.000Z","createdBy":"seed",
 "updatedAt":"…","updatedBy":"eduardo@eduardorezende.com","lastLogin":null}
```

- `perms` tem uma entrada para cada módulo de `MODULES` (no exemplo, só duas).
- `preset` é o id do perfil ou `custom`. `presetMatch(d)` devolve o id quando módulos, menu e tela inicial batem exatos com um perfil; senão `custom`.
- `inicio` é uma view ou `null` (padrão).
- Exclusão no `state.db` deixa lápide: `{"email":"…","deleted":true,"at":"…"}`.

### Migração para v2

`migrateUsers()` roda ao carregar e `migrateUser(x)` roda também em cada documento do `onSnapshot('usuarios')`.
- Chave que não é e-mail (exemplo: `__proto__`) é descartada, no `localStorage` e no `onSnapshot`.
- Usuário com perfil pronto: módulos, menu e tela inicial vêm do perfil novo. O vendedor perde a Lista de vendas de propósito.
- Usuário personalizado: mantém o que tinha, módulo a módulo. `escala` e `laboratorio` herdam do antigo `configuracao` (`MIGRA_V1`). `financeiro` recebe Ver se havia `venda.r` ou `relatorios.r`, e Excluir se havia `venda.d`. `permissoes` recebe Ver e Alterar se havia `usuarios.u`. O menu vira todas as telas dos módulos com Ver, e `inicio` fica `null`.
- Telas que não existem mais (`set`, `convidado`, `fluxo`) saem do menu e do `inicio`.
- `ensureAdmin()` (só no protótipo, decisão D12): se não houver nenhum administrador ativo, os e-mails admin da semente voltam a ser admin e o histórico registra `acao:'recuperacao'`.

### Regras de toda gravação: `permValidate`

`permValidate(editor, antes, depois, usersDepois)` devolve `{ok:true}` ou `{ok:false, motivo, msg}`. É chamada em todo caminho que grava usuário: `permSave` (Permissões), `userSave` (criar e editar no cadastro) e `userApply` (desativar, reativar, excluir). Sem editor logado, devolve `sem_poder`. As regras, nesta ordem:

| Motivo | Quando barra |
| --- | --- |
| `sem_permissao` | quem grava não tem a letra da ação: criar exige `usuarios.c`; excluir exige `usuarios.d`; mudar nome, e-mail, fotógrafo ou ativo exige `usuarios.u`; mudar módulos, menu, tela inicial ou perfil exige `permissoes.r` e `permissoes.u` |
| `auto_bloqueio` | o editor tiraria de si mesmo Ver ou Alterar de Usuários ou Permissões, ou essas telas do próprio menu |
| `sem_admin` | depois da gravação não sobraria nenhum administrador ativo (ativo, todas as letras aplicáveis e todas as telas) |
| `sem_poder` | a gravação liga uma letra ou tela que o editor não tem |
| `alvo_maior` | a pessoa editada já tinha algo que o editor não tem; o editor abre essa pessoa só para leitura ("Esta pessoa tem acessos que você não tem") |

- `userApply` e `permSave` também conferem a permissão logo no início, antes de montar a mudança.
- O select de perfil (cadastro e Permissões) só lista perfis que cabem nos acessos do editor (`presetsFor`).
- O `change` de `perm-op`, `perm-view`, `perm-inicio` e `perm-preset` confere `can('permissoes','u')` antes de tudo e desfaz o clique se faltar.
- Regras do rascunho: ligar C, U ou D liga Ver; desligar Ver limpa C, U, D e as telas do módulo; ligar uma tela liga Ver; em Permissões, Ver e Alterar andam juntos.

### `guardAct` e `ACT_MOD`

- `guardAct(a)` confere a letra exigida em `WRITE_OPS[a]` contra um módulo. Desde a v78, as ações de cadastro e de permissões têm módulo fixo, sem depender da tela aberta:

```js
const ACT_MOD={'user-new':'usuarios','user-save':'usuarios','user-active':'usuarios',
               'user-del-ok':'usuarios','perm-save':'permissoes','perm-preset-apply':'permissoes'};
```

- As outras ações usam `MODULE_OF[state.view]`. Ação do `WRITE_OPS` em tela sem módulo (Início, por exemplo) agora é barrada com "Sem permissão nesta tela". Antes passava.
- Entradas novas no `WRITE_OPS`: `perm-save:'u'`, `perm-preset-apply:'u'`, `user-del-ok:'d'`. Saiu `user-perm`. `user-del-ask` só pede a confirmação e não grava.

### Auditoria

`auditLog(acao, alvo, mudancas, extra)` acrescenta no início de `localStorage` `eterna.users.log.v1` (no máximo 1.000 entradas) e, com `state.db`, grava `usuarios_log/<id>`. Sem mudanças, não grava nada.

```json
{"id":"L1761579000000-k3f9","em":"2026-10-28T15:30:00.000Z","por":"eduardo@eduardorezende.com",
 "alvo":"carlos@eterna.photo","acao":"permissoes",
 "mudancas":[{"campo":"perms.set.d","de":false,"para":true},
             {"campo":"menu","sai":["importar"],"entra":[]},
             {"campo":"preset","de":"foto","para":"custom"}],
 "venue":"maracana","origem":"app-v78"}
```

- `acao`: `criar`, `alterar`, `permissoes`, `perfil_aplicado`, `desativar`, `reativar`, `excluir` ou `recuperacao`.
- `excluir` leva também `antes:{name,preset,modulos:[...]}`, para o histórico saber quem era.
- Nunca guarda código de login, token nem IP.
- `permDiff(antes, depois)` gera as `mudancas`. `auditText(e)` monta a frase da aba Histórico, sempre com `esc()`. A aba mostra no máximo 300 linhas, com busca.
- O `onSnapshot('usuarios_log')` junta no log local sem duplicar (por `id`).

### Login e sincronização entre aparelhos

- `loginMark(email)` grava só `lastLogin`: no `localStorage` e em `usuarios_login/<email>` (`{email, lastLogin}`). O login nunca regrava o cadastro inteiro, para uma cópia velha não devolver um acesso revogado. O `onSnapshot('usuarios_login')` só atualiza `lastLogin` quando a data é mais nova.
- O `onSnapshot('usuarios')` aplica a migração, trata a lápide `deleted:true` e, se o usuário logado sumiu ou foi desativado, faz logout com "Seu acesso foi removido".
- Entre abas do mesmo navegador, o evento `storage` de `eterna.users.v1` relê, migra e faz o mesmo logout. Ele só lê dados, não executa nada deles, não roda a recuperação de admin e ignora `newValue` nulo.

### Tela Permissões (view `permissoes`)

- `vPermissoes()`, com `state.perm={tab,sel,draft,q,logQ,presetPick}`. Legenda fixa explicando C, R, U e D.
- **Por usuário**: lista com busca; editor com perfil atual, "Perfil pronto" + "Aplicar perfil", "Tela inicial" e a matriz `permMatrix` (uma linha por módulo, com a descrição e o texto de cada letra; com Ver ligado, a sublinha "Aparece no menu:" com uma caixa por tela). Pill "alterações não salvas", Salvar e Descartar. Até 700 px cada módulo vira um card.
- **Perfis prontos**: só leitura, um card por perfil.
- **Histórico**: quando, quem, ação, pessoa e o que mudou.
- O cadastro (view `usuarios`) ficou só com os dados da pessoa: criar (perfil entre os permitidos, ou "Sem acesso ainda"), alterar nome, e-mail e fotógrafo vinculado, Desativar ou Reativar, e "Excluir acesso" com "Confirmar exclusão". Na própria linha não aparecem Desativar nem Excluir. O botão "Editar permissões" leva à tela Permissões.

### O que é protótipo na v78

- **IMPORTANTE.** Permissões e login são verificados só no navegador. Quem edita o `localStorage` (`eterna.users.v1`) vira admin. Esconder do menu é experiência de uso, não segurança.
- **IMPORTANTE.** O `sessionLoad()` confia no e-mail gravado em `eterna.session`, sem verificar token.
- **IMPORTANTE.** O `state.db` aceita escrita de qualquer pessoa, inclusive em `usuarios/`, `usuarios_login/` e `usuarios_log/`. O histórico pode ser apagado ou forjado, e o campo `por` é declarado pelo próprio navegador.
- O agente do ponto não confere usuário nas rotas (já registrado na v77).

### Contrato do servidor (ainda não implementado)

| Rota (Bearer do `/auth/verificar`) | Função |
| --- | --- |
| `GET /auth/eu?venue=` | devolve `{email,nome,venue,perfil,perms,menu,inicio,versao,exp,assinatura}`; o app guarda como cache para funcionar offline |
| `GET /usuarios?venue=` · `POST /usuarios` · `PATCH /usuarios/:email` · `DELETE /usuarios/:email` | cadastro; cada rota checa a permissão e roda `permValidate` (com `sem_permissao`) numa transação |
| `PUT /usuarios/:email/acessos/:venue` | grava `{perfil,perms,menu,inicio}` por venue |
| `GET /auditoria?alvo=&desde=&cursor=` | auditoria só de acréscimo, paginada, com `por` vindo do token |

- Modelo: `usuarios(email)`, `acessos(email, venue, perfil, perms, menu, inicio)`, `perfis(venue, id, …)`, `auditoria` (só acréscimo) e um papel de plataforma separado do admin do venue.
- O retrato `/auth/eu` vem assinado (Ed25519) com validade de 12 h. O agente valida com a chave pública. Offline, uma revogação demora no máximo até essa validade vencer.
- Mudar permissão exige servidor (fica bloqueado offline); o ponto opera com o último retrato assinado.

### Pendências de segurança (para o servidor)

- **IMPORTANTE.** Servidor como fonte da verdade: contrato acima, `permValidate` no servidor e auditoria só de acréscimo. Fecha os três riscos aceitos do protótipo.
- **IMPORTANTE.** Recuperação de admin (D12) sem trava: o `ensureAdmin` roda sempre que o app carrega, só localmente, e um `onSnapshot('usuarios')` posterior pode sobrescrever o admin recuperado. Pôr atrás de uma marca de protótipo e trocar por um comando no servidor.
- **IMPORTANTE.** LGPD no histórico: nomes e e-mails ficam em `eterna.users.log.v1` e em `usuarios_log` sem prazo de retenção. Definir a retenção. O `onSnapshot` da coleção inteira não escala e vira consulta paginada no servidor.
- No modo real com `MAIL_API`, o servidor deve responder igual para e-mail desconhecido, para não dar pista de quem tem cadastro.
- Menores: chamar `permValidate` na migração só para registrar no histórico; validar `inicio` contra o menu no `permSave` (hoje o `homeView` já confere).

Corrigido na volta da v78: `permValidate` com `sem_permissao`, `ACT_MOD` no `guardAct` e bloqueio de gravação em tela sem módulo (bloqueante da segurança); login grava só `lastLogin`; e-mail inválido (`__proto__`) não entra pelo `onSnapshot` nem pelo `localStorage`.

### Decisões do Eduardo (fechadas em 28/10)

- Perfil Fotógrafo sem o Índice do fotógrafo e sem a tela Ajuste automático no menu. Ele liga e desliga o ajuste pelo Upload automático (v79).
- Ajuste automático no grupo Configurações, com a tela no módulo `set`.
- Módulos novos `escala`, `laboratorio` e `financeiro` mantidos.
- A mensagem cortada "Aí ele vai passar para o..." foi descartada.

## Checkout, caixa e ajuste automático (v79, 28/10/2026)

A v79 muda quatro coisas. Dinheiro no Checkout fica "aguardando caixa" até a equipe confirmar. O fotógrafo liga e desliga o ajuste automático no Upload. A equipe tem uma saída do Checkout só na tela da câmera. O carrinho calcula o pacote ideal, as impressas e a economia pelo catálogo novo do Tour.

Plano com todas as decisões e as correções da revisão: `docs/planos/2026-10-28-v79-checkout-caixa-ajuste.md`. Testes: `testes/v79-regressao.js`.

### Limite desta versão

Checkout e Caixa funcionam **no mesmo computador e no mesmo navegador**, em duas janelas (`#loja` na tela do cliente, Caixa na tela da equipe). Entre computadores diferentes só com o agente ou o servidor (plano v80, vários terminais).

### Dinheiro aguardando caixa

**Fluxo**

1. Cliente escolhe Dinheiro no carrinho. O botão vira "Finalizar e pagar R$ X no caixa" e aparece a nota "Em dinheiro, a compra é confirmada no caixa."
2. `lojaDinheiro(card)`: `simFresh()`, fecha uma pendência anterior da mesma sessão como `substituida`/`novo_pedido`, cria o token da galeria **sem publicar** (`galDaSessao(card,true)`), grava o registro em `SIM.caixaDin` e põe a sessão em `status:'aguardando'`, `din:<id>`. Não baixa estoque, não grava `aiOf().bought`, não gera `saleNo`.
3. Tela final do cliente (`lj-wait`, ícone de dinheiro em amarelo): "Pague no caixa em dinheiro", valor, código `XXXX-XXXX` (o mesmo da galeria) e QR. Volta à câmera em `SIM.lojaFimSeg` segundos, como as outras.
4. Na janela do Caixa a pendência aparece sozinha (evento `storage`) em **Caixa › Aguardando caixa · dinheiro do Checkout**.
5. **Recebi R$ X** (`dinConfirmar`) ou **Cancelar** com segunda confirmação (`dinCancelar`).

**Contrato `SIM.caixaDin`** (lista, mais novo primeiro)

```json
{"id":"D<ts36><rand4>","venue":"maracana","card":"LP...","token":"<galeria>","codigo":"ABCD-2345",
 "criada":"ISO","total":190,"prints":8,"n":8,"nPh":4,"nAI":4,
 "cart":[{"id":"maracana","v":190}],"selected":["..."],"aiSel":["ph|bg"],
 "estado":"aguardando|confirmada|cancelada|nao_paga|substituida",
 "fechada":"ISO|null","por":"email|sistema|null","porNome":"Thainá|null",
 "motivo":"null|cancelada_no_caixa|fim_do_dia|novo_pedido|pago_de_outro_jeito","saleNo":"E012|null"}
```

Na sessão (`SIM.sessions[card]`): enquanto espera, `status:'aguardando'` e `din:<id>`. Confirmada: `status:'paga'`, `payment:'Dinheiro'`, `paidAt` (hora da confirmação), `saleNo`, `caixaPor` (nome), `caixaEm`, `prints`, `total`.

| Estado | Quando | Sessão volta para |
| --- | --- | --- |
| `aguardando` | cliente finalizou em Dinheiro | fica `aguardando` |
| `confirmada` | Recebi R$ X no Caixa | `paga` |
| `cancelada` | Cancelar no Caixa (`cancelada_no_caixa`) | `pronta` |
| `nao_paga` | virada do dia local, `por:'sistema'`, `fim_do_dia` (`dinVirada`, no boot e a cada 60 s) | `pronta` |
| `substituida` | novo pedido em Dinheiro (`novo_pedido`) ou pago com cartão, PIX ou no balcão (`pago_de_outro_jeito`) | conforme o novo pagamento |

**Regras**

- Uma pendência aberta por sessão.
- `dinPegar(id)` concentra as travas de Confirmar e Cancelar: recusa com `state.lojaRota` ou `state.pub` ("Confirme no Caixa da equipe"), exige `can('venda','c')`, roda `simFresh()` e é idempotente ("Já confirmada por <nome> às hh:mm"). Estoque, `saleNo` e receita mudam uma vez só.
- Confirmar aplica `cart`, `selected` e `aiSel` do registro, grava `aiOf(card).bought` com `where:'loja'`, baixa `prints` de `SIM.stock['Caixa 1']`, publica a galeria (`galDaVenda`) e mostra o recibo com "Recebido por <nome> às hh:mm". Se a galeria `#g` estiver aberta em "esperando o caixa", ela recarrega sozinha (`pubLoad`).
- Cancelar não publica a galeria. O token é reaproveitado numa compra futura.
- Retenção: registros fechados ficam 30 dias, no máximo 1000 (`DIN_DIAS`, `DIN_MAX`). Sem dado do cliente.
- `CAIXA_ALERTA_MIN=15`: pendência com mais de 15 min vira alerta "Dinheiro esperando no caixa há N min · código X" e a pill fica amarela.

**Onde aparece**

| Lugar | O que mostra |
| --- | --- |
| Caixa (`vCaixa`) | painel no topo: busca por código ou sessão (ignora hífen e maiúsculas), código grande, sessão, valor, hora, "há N min", fotos e impressas, até 4 miniaturas. Botões só com `venda.c`; sem ela, "Só quem registra pagamento confirma." |
| Barra da equipe (`#rail-ck`) | botão Caixa com o número de pendências, para quem tem `canView('caixa')` e `venda.c` |
| Início (`vPerfis`) | cartão "Caixa · N aguardando dinheiro" e pill "N aguardando caixa" |
| Lista de vendas | status "aguardando caixa" e "não paga" (`statusLabel`), filtro Status (Todos, Pagas, Aguardando caixa, Não pagas, Canceladas, `sales-status`), bloco "Aguardando caixa" com N e R$. Receita só soma `paga` |
| CSV | `status` `aguardando` ou `nao_paga`; colunas novas no fim: `caixa` (nome) e `caixa_em` (ISO). Nunca o e-mail. Célula que começa com `= + - @` ganha `'` na frente |
| Galeria `#g` | passo `aguarda_caixa`: "Seu pagamento em dinheiro está esperando o caixa", sem foto liberada e sem compra |
| Alertas | pendência acima de 15 min; janela antiga aberta; armazenamento cheio |

**Permissões**: `din-confirm`, `din-cancel` e `din-cancel-ok` em `WRITE_OPS` com `c` e `ACT_MOD` `venda`. Podem Atendimento e venda, Supervisor e Admin. Fotógrafo, Validador e o perfil Checkout não. `din-q`, `din-cancel-no` e `sales-status` não gravam. `MODULE_INFO.venda.c`: "registrar pagamento, reimprimir, confirmar ou cancelar dinheiro do Checkout".

**Contrato futuro do servidor** (documentado, não implementado)

| Rota | Função |
| --- | --- |
| `POST /caixa/pendentes` | cria a pendência com o corpo do registro, sem `por` |
| `GET /caixa/pendentes?venue=&estado=aguardando` | lista do caixa |
| `POST /caixa/pendentes/<id>/confirmar` e `/cancelar` | corpo `{"esperado":"aguardando"}`; 409 com `{estado,porNome,fechada}` se já fechada; `por` vem do token, nunca do corpo |

### Sincronização entre janelas

- `SIM` continua um bloco único em `localStorage['eterna.sim.v1']`.
- `simFresh()` relê o `SIM` gravado pela outra janela antes de qualquer ação de caixa.
- Ouvinte `storage`: sempre adota o `SIM` novo, mas só redesenha quando muda o que aparece (`simResumo`: pendências do caixa, status das sessões e da sessão aberta, ajuste automático e rolo). Com um campo em foco, não redesenha.
- **Janela antiga (I2).** `SIM` sem `caixaDin` ou sem `catalogoV` vem de uma janela v78. Não é adotado. Aparecem o toast e o alerta "Há uma janela antiga do Eterna aberta. Recarregue as outras janelas."
- `ajQueue` não roda na janela do Checkout.
- **Armazenamento cheio (I3).** `saveSim()` devolve `true`/`false`. Sem espaço, poda o registro antigo e os ajustes automáticos de fotos que não estão no computador e tenta de novo. Se falhar: `lojaDinheiro` desfaz e mostra ao cliente `ljSaveFail` ("Não conseguimos registrar o pedido. Fale com a equipe no balcão.", 5 línguas); Confirmar e Cancelar desfazem e mostram "Não gravou, tente de novo". Alerta "Armazenamento do navegador cheio".
- Continua "último que grava ganha" no `SIM` inteiro. O servidor resolve.

### Aba do Checkout sem login (D7 e I1)

- Sair do `#loja` por qualquer caminho (Esc, painel, trocar o endereço, voltar do navegador, ir para `#g`) passa por `lojaSair`, que sempre remove `eterna.session` e zera `state.user`.
- `sessionStorage['eterna.lojaTab']='1'` marca a aba como tela do cliente. É gravada por `lojaAbrir`, no boot com `#loja` e ao entrar em `#loja` pelo `hashchange`. Com a marca, o boot não chama `sessionLoad()` e vai para `#loja`. Recarregar, digitar `#caixa` ou duplicar a aba não entra logado.
- A marca só sai com um login feito nessa aba ou pelo botão da equipe (`lojaVoltarApp`).
- Para o computador do cliente: Chrome em modo quiosque (Guia da equipe).

### Saída da equipe no Checkout

- `lojaAbrir` liga o modo equipe (`state.lojaEquipeAte`, `LOJA_EQUIPE_MS` = 10 min) quando quem abre é da equipe e não é o perfil Checkout. Guarda a tela de origem em `state.lojaDe`.
- `lojaEquipeOn()` exige `#loja`, usuário, não ser o perfil Checkout, `state.kiosk.step==='code'` (só na câmera) e o prazo.
- `lojaCliente()` encerra o modo equipe para sempre na primeira interação de cliente: `kiosk-go`, `kiosk-emerg`, Enter no código, `cam-pick`, a câmera achando um rosto (`camFound`, qualquer rosto, inclusive o da equipe), `loja-exit`, `loja-new`. Também zeram `lojaPay` e `lojaDinheiro`. Recarregar a página zera.
- Botão `loja-inicio`, rótulo fixo em português: "Equipe: voltar ao app". Primeiro toque arma por 3 s ("Toque de novo: voltar ao app da equipe"). Segundo toque no prazo chama `lojaVoltarApp()`: desliga timer e câmera, limpa a marca da aba, `replaceState('#')` e volta para `state.lojaDe` ou `homeView()`, **logado**. É o único caminho do `#loja` para o app logado.

### Ajuste automático: interruptor do fotógrafo

- `ajAutoPanel()` no topo do Upload automático (`vImportarCore`) e em Configurações › Ajuste automático (`vAjustes`). Título "Ajuste automático da IA", botão Ligado/Desligado e a linha "Desligado por Carlos às 14:02".
- `ajAutoSet(on)` grava `SIM.autoAj` e `SIM.autoAjPor={on,por,nome,em}`, registra no log e confere `can('set','u')` por dentro.
- Vale para o computador do ponto inteiro (D9). Ao religar, o `ajQueue` ajusta as fotos que chegaram com ele desligado.
- `WRITE_OPS['aj-autotoggle']='u'`, `ACT_MOD` `set`. Fecha a brecha da v78 em que o Supervisor (só leitura em `set`) mexia no ajuste.
- O menu do Fotógrafo não muda: a tela Ajuste automático continua só em Configurações.

### Catálogo novo e carrinho

| id | Produto | Preço | Digitais | Impressas 10×15 |
| --- | --- | --- | --- | --- |
| `mais` | Pacote Maracanã Mais | R$ 250 | todas | 0 |
| `tribuna` | Pacote Tribuna de Honra (novo) | R$ 220 | 12 | 12 |
| `maracana` | Pacote Maracanã | R$ 190 | 9 | 9 |
| `gramado` | Pacote Gramado (novo) | R$ 150 | 6 | 6 |
| `zona` | Pacote Zona Mista | R$ 110 | 3 | 0 |
| `arq` | Pacote Arquibancada | R$ 70 | 1 | 1 |
| `extra` | Foto adicional | R$ 35 | 1 | 1 |
| `fundo`, `dig` | sem mudança | R$ 40, R$ 39 | | |

- **Migração única.** Preços editados antes para `maracana`, `zona`, `arq` e `extra` são descartados uma vez, com registro no log. A versão fica em `localStorage['eterna.catalogo.v']` e em `SIM.catalogoV=2`, para um `SIM` antigo não repetir a migração.
- **Fotos com fundo de IA contam dentro do pacote** no Checkout (decisão do Eduardo). Número de fotos = fotos do campo + fotos com fundo de IA. O carrinho não leva mais itens `fundo`. A compra continua registrando quais são de IA (`aiOf(card).bought`, `s.aiSel`). A receita de fundo só soma o que foi pago no balcão.
- `lojaIdeal(n)`: menor custo de pacote + adicionais (`priceOf`, então vale com preço editado). Empate: mais impressas; depois o pacote menor. Só preço, inclusive contra o "Todas". Com os preços padrão: 1 Arquibancada R$ 70; 2 Arquibancada + 1 R$ 105; 3 Zona Mista R$ 110; 4 Zona Mista + 1 R$ 145; 5 e 6 Gramado R$ 150; 7 Gramado + 1 R$ 185; 8 e 9 Maracanã R$ 190; 10 a 12 Tribuna R$ 220; 13 ou mais Todas R$ 250.
- `printsVenda(cart,n)`: impressas = min(fotos, impressas do pacote) + 1 por adicional. Usado em `lojaCart`, `reconSale`, `caixaConfirm`, `simPrints` e na Venda no balcão.
- **Economia (N6):** compra avulsa de verdade = Arquibancada + (fotos − 1) × Foto adicional, menos o que a pessoa paga. No "Todas" contam as fotos da sessão. Só aparece quando é maior que zero. Exemplo: 8 fotos no Maracanã, 70 + 7 × 35 = 315 − 190 = R$ 125.
- Carrinho: selo Ideal, linha "+ N adicionais de R$ X" por pacote, resumo linha a linha (`.lj-sum`) antes do Total, "Cabem mais N fotos neste pacote sem pagar mais" quando sobra espaço. "Impressas prontas em 2 minutos" só aparece com impressas e fora do Dinheiro.
- **Valor gravado (I4).** A venda grava `s.total` e o preço de cada item (`{id,v}`) em `lojaPay`, `lojaDinheiro`, `dinConfirmar` e `caixaConfirm`. Lista de vendas, CSV, recibo, Início e Caixa leem o gravado (`saleTotal`, `itemV`). O preço atual só vale para venda antiga sem total.
- Vendas antigas reconstruídas da Roverpix (`reconSale`) usam o Ideal do catálogo atual.
- **Sessão paga não paga de novo.** Nenhuma forma de pagamento tira uma sessão de `paga`. Reaberta no Checkout, mostra `ljAlreadyPaid` ("Estas fotos já foram compradas. Fale com a equipe para comprar mais.", 5 línguas); `lojaPay` e `lojaDinheiro` recusam.
- `fmtR` usa espaço fixo entre R$ e o valor.

### Pendências de segurança e de tela (v79)

- **IMPORTANTE (I5, requisito de produção).** Cartão e PIX no Checkout ainda fecham a venda na hora, sem confirmação real do pagamento. Antes de operar com dinheiro de verdade: TEF ou adquirente, ou PIX com confirmação do PSP (webhook no servidor), e a venda só vira `paga` com a confirmação. Até lá, o Checkout opera com a equipe ao lado.
- **IMPORTANTE.** Confirmação, permissão, `por` e idempotência valem só dentro do mesmo navegador. Quem mexe no `localStorage` forja uma confirmação. Corrige com o contrato do servidor acima.
- **IMPORTANTE.** Risco que sobra no botão da equipe: um cliente na tela da câmera, nos primeiros 10 min de um Checkout aberto pela equipe e antes de qualquer interação. Mitigação: no terminal do cliente, usar o perfil Checkout ou `#loja` direto, em Chrome modo quiosque.
- Compra em dobro: se a galeria da sessão já estava publicada antes, o cliente pode comprar online enquanto o dinheiro espera. Risco baixo na fase 1; rever na fase 2.
- Sugestão para depois: relatório "canceladas no caixa por operador".
- Tela: o ícone do celular no cartão do QR está quase invisível.
- Tela: em 390 px, na tela "já compradas", o botão "Voltar ao início" aparece só como ícone.


## Painel, Painel de controle, cópia de permissões e upload sem check-in (v80, 28/10/2026)

Plano: `docs/planos/2026-10-28-v83-painel.md` (escrito como v83; publicado como v80). Testes: `testes/painel.js` e `testes/copiar-permissoes.js`.

### Painel (view `painel`, módulo `financeiro`)

- Primeira tela do Dashboard e tela inicial de Admin e Supervisor (`PRESETS.*.inicio='painel'`). Substitui a Semana (`vSemana` e `barChart` saíram). `#semana` e `eterna.view='semana'` abrem o Painel (`LEGACY_HASH`).
- Fica no módulo `financeiro` (D2): `relatorios` cobre só Alertas. Quem tinha só `relatorios.r` deixa de ver receita.
- Migração única por usuário (`migraPainel`, marca `x.mv=83`, roda dentro de `migrateUser` antes do filtro `MODULE_OF`; quando muda algo e há servidor, grava o usuário de volta com a marca, para a cópia sincronizada não migrar e registrar de novo): `semana` no menu vira `painel` com `financeiro.r` (sem isso só sai); perfil pronto ganha as telas novas de `presetMenu`; início `semana` vira `painel`; admin e supervisor com início `perfis` (ou vazio) passam a `painel`; registra `migracao_v83` no histórico.
- Tela inicial vazia ("Padrão") agora vale a do perfil: `homeView` usa `PRESETS[u.preset].inicio` e `presetMatch` trata início vazio como o do perfil.
- Funções puras (não alteram `DATA` nem `state.range`): `painelRover(from,to,pdv)` lê `LIVE.days[d]` direto (não usa `liveRangeAgg`) ou, sem LIVE, `DATA.daily` e `DATA.rows`; `painelEterna(from,to,pdv,sales)` lê `allSalesSim()` (`date:'hoje'` vira `venueToday()`; `teste`, `est` e `aguardando` fora da receita; `aguardando` só em `aguardandoCaixa`; sessões `lost` contam como descartadas); `painelDados(f)` junta pela fonte e devolve o contrato do plano (mais `vazio`). Auxiliares: `prodKey`, `payKey`, `splitOrder`, `pctParts` (maior resto, "<1%"), `deltaOf`, `fmtRv`, `safeN`, `venueToday` (`America/Sao_Paulo`), `addDays`, `diasEntre`.
- Filtro: `state.painel` em `localStorage 'eterna.painel.v1'`, validado por `painelFiltro` (fonte em {tudo, roverpix, eterna}; ponto precisa estar em `painelPontos`). O ponto só liga com LIVE ou fonte Eterna (D12). `eterna.range` adulterado é recusado na leitura.
- Comparação (D9): período anterior de mesma duração, só se estiver inteiro nos dados da Roverpix e a fonte não for Eterna. Alta ▲ verde, queda ▼ grafite, abaixo de 1% "estável".
- Modo importado com parte do período: Vendas, Fotos, Ranking e Pagamentos usam o total de 07 a 15/10 com a pill "total de 07/10 a 15/10".
- Sem dado nenhum no período: só os 4 cartões com "—" e um alerta com "Ver 07/10 a 15/10".
- Gráficos (template string, `esc()` em todo texto, inclusive `<title>`, `aria-label`, `data-tip`, `<option>`): `kpiCard`, `donut`, `stackBar`, `funnelBars`, `rankList`, `dayBars`. Dica única `#tip` (ouvintes delegados de `pointerover`, `pointerout`, `pointerdown`, `focusin`; escreve com `textContent`).
- CSV: `painelCSV(D)` (`;`, uma linha por dia e uma de total, `'` antes de célula iniciada por `= + - @`), baixado por `painelBaixar` como `eterna-painel-<from>_<to>.csv`; exige `financeiro.r`; não é ação de gravação.
- Tokens: `--pn-focus`, `--pn-focus2`, `--pn-rest`, `--pn-rest2`, `--pn-hl`, `--pn-up`, `--pn-up-bg`, `--pn-down`, `--pn-down-bg` (padrão para qualquer venue; valores do manual em `:root[data-venue="maracana"]`).
- Período: `rangeBar(note,extra,semAlerta)` com Hoje, Ontem, 7 dias, 30 dias (fuso do venue), Importado (sem LIVE) e Personalizado; campos de data por `dateField(act,valor,rótulo,max,vazio)`, sempre dd/mm/aaaa (input nativo transparente por cima). Também em Qualidade (`rev-date`) e Galerias (`gal-ev-data`).
- Desempenho (critério 28, abaixo de 50 ms com 30 dias × 400 pedidos): `prodKey` memoizado por nome (`PK_MEMO`), preços do catálogo lidos uma vez por `painelDados` (`PN_PRECO`), pontos da Roverpix recalculados só quando o LIVE muda (`PN_PONTOS`) e um `Intl.NumberFormat` único para `fmtN`/`fmtR` (`NF_BR`).
- Fonte Tudo com venda do Eterna no período: a seta de Faturamento some (o período anterior só tem a Roverpix).
- Escala: com muitos venues, o mesmo contrato vira `GET /painel?from&to&pdv&fonte` no servidor (venue da sessão, período até 366 dias, agregados diários por venue e ponto). `painelDados` e `vPainel` estão em `window.ETERNA` só para os testes; não podem ir para o build de produção.

### Outras telas

- Vendas e caixa: só a tabela de vendedores e o link para o Painel.
- Fotógrafos: quem não tem sessão no período mostra "sem dados" em cor apagada, vai para o fim e não mostra o índice em vermelho; colunas secundárias com `c2` (somem até 1600 px) e `c3` (até 900 px).
- Catálogo e preços passou a se chamar **Painel de controle** (view e hash continuam `catalogo`; subtítulo "catálogo, preços, Checkout e FTP").

### FTP do estádio no Painel de controle

- `rftpPanel` saiu do Upload automático (`vImportar`) e entrou no fim de `vCatalogo`. Ver: `configuracao.r`; alterar (`rf-save`, em `WRITE_OPS` e `ACT_MOD` com `configuracao`): `configuracao.u`; sem `.u` os campos ficam desativados e aparece "somente leitura". A senha continua só no agente (`~/Eterna/*.json`); o navegador nunca recebe a senha salva. Sem o agente conectado, o cartão aparece desligado (pílula "agente desconectado", campos desativados e a nota para abrir o Eterna pelo agente em http://127.0.0.1:8765).

### Upload sem check-in da câmera

- Saíram o cartão de check-in (`camPanel`), o botão "É a minha" (`cam-mine`), o select de fotógrafo por câmera (`cam-who`) e `camName`.
- Ficaram: `camDay` e `camWho` (check-ins já gravados em `SIM.camDia` continuam valendo), o nome do autor gravado na câmera (`keyByName`), o palpite pela Roverpix (`camGuess`) e a sessão.
- `libWho` usa primeiro o login do FTP (segurança I1), quando ele bate com um fotógrafo do cadastro; depois a câmera (check-in antigo ou nome gravado), o palpite pela Roverpix e a sessão. FTP com nome desconhecido continua em `ftp:<nome>`.

### Copiar permissões de… (Permissões e Usuários)

- `permCopia(de, alvo, editor)`: copia `perms` (C/R/U/D), `menu` e `inicio` da origem; nunca nome, e-mail, status. Letra ou tela que o editor não tem (e o alvo ainda não tem) fica de fora e volta em `fora`; tela inicial fora do menu vira vazia; `preset` por `presetMatch`.
- Em Permissões: botão "Copiar permissões de…" (`perm-copy`), escolha da pessoa (`perm-copy-from`), prévia com `permDiff` e o que ficou de fora, "Confirmar e salvar" (`perm-copy-ok`, em `WRITE_OPS` `u` e `ACT_MOD` `permissoes`). `permCopiaSalvar` passa por `permRO` e `permValidate` como uma edição manual e grava `permissoes_copiadas` (`de`, `para`, `fora`, `mudancas`).
- Em Usuários: no editor, "Copiar permissões de…" (`perm-copy-open`) abre Permissões com a cópia; no cadastro novo, "Começar com as permissões de…" (`user-copy-from`) troca o perfil pelo da pessoa escolhida (filtrado pelo que o editor pode dar) e registra `criar` e `permissoes_copiadas`.

### Agente (revisão de segurança da v80)

- **B1** FTP embutido: o dono da foto é sempre o login (`quem = self.user`). Subpasta = fotógrafo só para login listado em `"compartilhado": [...]` no `~/Eterna/ftp.json` e só se a subpasta for um fotógrafo cadastrado (usuário do FTP ou `PHOTOGRAPHERS`).
- **I2** Foto cortada: `jpeg_completo` recusa o que não começa como JPEG nem PNG; o FTP não anuncia `REST STREAM` e responde 550 a `REST` maior que 0 (a câmera manda a foto inteira de novo).
- **I3** `rota_privada` também cobre `/metricas`, `/ftp-remoto/*` e `/photoroom/status` (sem CORS `*`; `Host` do agente).
- **I4** `/rostos/projecao`: só com `ETERNA_TESTE_CARGA=1`, por `POST {"n":...}`, origem local, no máximo 200 mil rostos (`PROJECAO_MAX`). O `teste-carga.py` passou a usar POST e extrapola acima de 200 mil.
- **I5** `/ftp-remoto/config`: se servidor, porta ou usuário mudarem, a senha salva não é reaproveitada (400 "digite a senha de novo").
- **I7** FTP embutido: senhas novas com `secrets.choice` e 12 caracteres, `ftp.json` com chmod 600, senha comparada com `hmac.compare_digest`, 5 erros seguidos bloqueiam o IP por 15 min (421), senhas fora do console. Senhas antigas com menos de 12 caracteres continuam valendo (para não derrubar câmeras configuradas) e geram um aviso no console.
- **I6** (parcial) `metricas.jsonl` é podado para os últimos 3 dias ao abrir o agente. Pendentes: `pasta_vigiada` faz `os.walk` a cada 0,5 s e o hash relê o arquivo (ver o plano).
- `ETERNA_FTP_PORTA`: porta do FTP embutido (testes); sem ela, 21 ou 2121.
- Testes: `testes/agente-seguranca.js`.
- `rota_privada` inclui `/roverpix/`: `/roverpix/status` e `/roverpix/data` só devolvem CORS para a origem do agente e `ETERNA_APP_ORIGIN`; outra origem recebe 403 sem `Access-Control-Allow-Origin` (e o `Host` precisa ser o do agente, contra DNS rebinding). O app aberto pelo agente (mesma origem) continua lendo.

## Bandeiras, Fundos em teste, Checkout em janela separada e FTP do estádio (v81, 28/10/2026)

Testes: `testes/v81.js` e `testes/agente-seguranca.js`.

- **Checkout em janela separada.** "Abrir Checkout" faz `window.open(location.pathname+'#loja','eterna-checkout','popup,width=1280,height=800')`: a janela vai para o segundo monitor e a aba do admin continua logada. Na janela do cliente (sem login), Esc ou sair do `#loja` só volta ao início do Checkout e não apaga a sessão salva do admin no mesmo navegador; a janela do cliente não fica ligada à do admin (sem `opener`).
- **Fundos em teste.** Só 5 fundos visíveis ao cliente: Noite de campeão (sem a taça, `img/bg-campeao-v81.jpg`), Mirante ao pôr do sol, Arquibancada 1950 em P&B, Saída do túnel e, desde a v86, Pódio de campeão. `DATA.backgrounds[].inativo` é o padrão; o estado por venue fica em `SIM.bgAtivo[id]`. Os inativos vão para Laboratório › Fundos em teste, com Ativar e Mover para o Laboratório (pedem Alterar em Configurações do venue; registram `fundo_ativado` e `fundo_laboratorio` no histórico). Fundo sem enquadramento aceito não se ativa. Escolha salva só com fundos ocultos volta ao padrão; variação oculta cai na Noite de campeão.
- **Bandeiras.** As imagens do item 67 em diante estavam desalinhadas. Tabela de correção (arquivo antigo errado para o certo; `""` = sem imagem) com fonte em `docs/bandeiras-correcao-2026-10-28.json`. Migração única na cópia salva (`SIM.flagList`): troca só o arquivo antigo errado pelo certo; item editado com outro arquivo e foto enviada (campo 7) ficam. Registra `v81_bandeiras` no histórico. Bandeira sem imagem certa fica sem foto.
- **Menu.** Títulos dos grupos em maiúsculo, negrito, 12px, cor no token `--nav-grp`.
- **Fotógrafos.** Klassius e Sandessa entram em `DATA.people` (lista oficial: Carlos, Klassius, Márcio, Marinara, Samuel, Sandessa, Yago).
- **Agente, FTP do estádio (B1).** `rftp_origem(path, pasta)`: a subpasta logo abaixo da pasta configurada só vira o fotógrafo se estiver cadastrada (comparação `sem_acento`); qualquer outro caso (fora do prefixo, `/outro`, `/../`) fica como `ftp-estadio`. Pasta vazia (450) não é erro; arquivo com tamanho desconhecido não baixa e gera aviso.

## Bandeiras com imagem da Wikimedia (v82, 28/10/2026)

Testes: `testes/v82.js`.

- **Imagens.** As 30 bandeiras sem imagem no maracafly recebem escudo ou bandeira da Wikimedia (`FLAG_WEB_V82`, fonte em `docs/bandeiras-web-2026-10-28.json`). `flagSrc` aceita URL completa só de `upload.wikimedia.org` e `maracafly.com.br` (allowlist); o resto continua sendo nome de arquivo do maracafly. Imagem que não carrega some sem quebrar o layout.
- **Migração `flagMigraV82`.** Uma vez só (`eterna.flags.v=82`): item salvo com campo 6 vazio ou com o arquivo errado da v81 recebe a URL da Wikimedia; foto enviada (campo 7) e arquivo editado ficam. Registra `migracao_v82_bandeiras` no histórico.

### Pendências de segurança (v82)

- Pôr `referrerpolicy="no-referrer"` nas imagens das bandeiras.
- Baixar os 30 PNG para `img/` antes de produção, para funcionar offline (hoje dependem da Wikimedia).
- Usar `esc(r.f[7])` na miniatura da foto enviada.
- Escudos de clubes são logos de uso restrito: só uso interno, como referência, nunca em produto vendido.

## Multiterminal, etapa 1: pagamento na maquininha, Posto de venda e impressão 10×15 (v83, 29/10/2026)

Plano: `docs/planos/2026-10-29-v83-multiterminal.md` (decisões D1 a D11, notas de D8 e da DNP). Esta etapa roda num notebook só, sem rede; pareamento, `/ponto/*` e envio da fila ao agente ficam para a etapa 2. Testes: `testes/v83.js`, `testes/v81.js` e `testes/agente-seguranca.js`.

### Pagamento aguardando (parte D)

- `lojaPay` só chama `lojaPedido(card,meio)`. Cartão, PIX e Dinheiro viram pendência em `SIM.caixaDin` com `meio`, `prov`, `saleNo` e `vendedor` (de `eterna.posto.vendedor`). Nada de venda, estoque, fundo comprado ou galeria até a confirmação.
- `PAG_PROV`: `pos-manual` (maquininha avulsa, confirmação humana) e `tef:null`, reservado para o TEF real.
- `pendConfirmar(id,{ref})`: "Pago na maquininha" com NSU ou autorização opcional (4 a 12 dígitos). `refErro` recusa 13 a 19 dígitos (parece número de cartão) e o valor nunca é gravado. Dinheiro usa "Recebi R$ X" (`dinConfirmar` é apelido). Confirmar não baixa estoque.
- `lojaPendCheck`: o Checkout vai ao QR quando a pendência é confirmada, ou volta ao carrinho da mesma sessão com `ljPayCancelled` (5 línguas) quando é cancelada. Saíram as promessas de "2 minutos" e a contagem na tela de pagamento.
- TEF simulado (`caixa-tef`) não marca venda como paga enquanto `PAG_PROV.tef` for `null`.

### Tela Posto de venda (view `posto`)

- Em `VIEWS_EXTRA`, módulo `venda`; tela inicial de Atendimento e venda (`mpv83` acrescenta `posto` ao menu dos perfis prontos com venda). `loja-abrir` abre a janela do Checkout e leva o admin ao Posto.
- Colunas: "No Checkout agora" (`ecoPainel`), Aguardando pagamento (`pendPainel`), Impressão 10×15 (`impPainel`) e Minhas vendas de hoje (`minhasVendas`: valor de cada venda, sem total, ticket nem contagem em reais).
- Venda acompanhada (parte E): o Checkout publica no BroadcastChannel `eterna-loja` o que o cliente vê; o Posto só lê e atualiza `#eco`. Só campos conhecidos são lidos, nunca HTML vindo do canal. Nada passa pelo agente.

### Impressão 10×15 na DNP DS-RX1HS (parte F)

- Uma DNP por notebook, pelo Chrome. `printMontar` monta `#print-root` com `body.pr-on` e `@page foto` de 102×152 mm sem margem; foto deitada é girada.
- `impFotos`/`impSel` marcam as fotos (favoritas primeiro, até `prints`). Foto com fundo de IA imprime (D8, decisão do Eduardo em 29/10): `compHi` monta de novo com o fundo `fileHi` de 5000 px (`img/fundos-5k/`). Se a montagem falhar, só essa foto fica para tentar de novo. `semFoto` só conta quando o pacote prevê mais impressões que o total de fotos (campo mais IA).
- `impOk` ("Saiu certo") baixa o rolo uma vez por foto; `impFalha` ("Não saiu") registra a tentativa sem baixar; `impReimprimir` imprime as fotos escolhidas com motivo (`IMP_MOTIVOS`: Falhou, Outra cópia, Cor, Outro) e só baixa no "Saiu certo". Todos com `simFresh`.
- Rolo por `postoNome()` ("Caixa 1" em local/off), `ROLO_CAP=700`, alerta abaixo de `ROLO_ALERTA=40`; venda paga sem impressão há mais de 10 min vira alerta. A troca é `stock-swap` em Estoque. Venda no balcão também não baixa mais o estoque.
- `galPrint` avisa que, num posto com `--kiosk-printing`, o cartaz A4 sairia na DNP.

### Fila local de eventos (parte G, só o local)

- `pvEvento` grava `criar`, `pagar`, `cancelar`, `impressao` e `rolo` em `eterna.ponto.fila.v1` (fora do SIM), com `navigator.locks`; até 7 dias ou 2000 eventos, descartes em `eterna.ponto.descartes.v1`. `pvId` = `<dispId>-<ts36><rand4>`; `pvSaleNo` (dentro do lock) gera `L0-NNN` por dia (`P<num>-NNN` nos postos da etapa 2).

### Agente

- Fundos do Photoroom por mapa fixo: `FUNDOS_PREVIA` (2400 px) e `FUNDOS_IMPRESSAO` (`img/fundos-5k/`, com `hi`). Nunca `img/bg-campeao2.jpg` (fundo antigo, com a taça). A prévia cobre todos os fundos de `DATA.backgrounds` (os 4 ativos e os do Laboratório, que podem ser ativados), com o mesmo arquivo do app; a impressão em 5000 px existe só para os 4 aprovados.
- `recorte:true` pede só a pessoa em PNG transparente, para a impressão; W e H até 5000 (`PR_LADO_MAX`) no `/photoroom/compose`.

### Pendências de segurança (v83)

- A simulação do TEF continua no código, desligada (`PAG_PROV.tef=null`). Quando o TEF real entrar, ela precisa ser **trocada** pela integração real, não só religada.
- Um número de venda (`L0-NNN`) pode ser pulado (por exemplo, quando a gravação falha depois de gerar o número). Não há número repetido, mas a sequência pode ter buracos.

## Fundos de IA com recorte local, sem Photoroom (v84, 29/10/2026)
Decisão do Eduardo (29/10): a montagem dos fundos sai do Photoroom. O agente recorta a pessoa no computador do ponto e o app monta no canvas com as regras de `docs/fundos-ia-regras.md`.

### Agente (`eterna-agente.py`)
- `POST /recorte` com `{pid, lado}` (só foto da biblioteca, `pid_ok` + `lib`; `lado` 3000, padrão, para a impressão, ou 2400 para a prévia): devolve a pessoa em PNG RGBA (lado maior até 3000 px, `REC_LADO_MAX`; EXIF de orientação aplicado). O RGB fora da máscara é zerado: o PNG não leva o fundo nem quem estava ao redor. Cache em `~/Eterna/recortes/<pid>.png` e `<pid>_2400.png` (chmod 600; a de 2400 sai da de 3000, sem rodar os modelos de novo). `GET /recorte/<pid>.png` devolve o de 3000 já feito.
- Recorte: rembg com duas sessões, `isnet-general-use` e `u2net_human_seg`, sobre uma cópia de até 1600 px (`REC_TRAB`). Máscara (`rec_limpa_mascara`, regras 12 e 13): máximo das duas (o que uma delas pega com alfa alto fica), níveis (abaixo de 0,3 vira 0, de 0,3 a 0,9 estica, acima de 0,9 vira 1), entra tudo o que tem algum sinal (≥ 0,04) ligado a um ponto que a máscara de pessoa (`u2net_human_seg`) pega com alfa alto (≥ 0,6): objeto solto que não encosta na pessoa sai (v88, taça num pedestal ao lado); miolo sólido onde o sinal passa de 0,10 ou fica cercado por ele, com reentrâncias de até 0,8% do lado fechadas (só a borda, até 0,2% do lado, fica macia); furo fechado com sinal médio ≥ 0,03 fecha; furo sem sinal decide pela cor da cópia de trabalho (`rec_limpa_mascara(masks, foto)`, `_rec_furo_e_objeto`): fecha se a borda não tem contraste (diferença de cor < 20 entre 3 px dentro e 3 px fora) em ≥ 40% da volta, ou em 15% a 40% se a cor do furo não aparece no fundo perto do grupo; vão entre braço e corpo fica vazado: taça, bandeira aberta, boné e óculos saem inteiros e sólidos. Pedaço com 3% ou mais da área do maior fica sempre; pedaço menor só sai se estiver solto, a mais de 1,5% do lado do grupo (na dúvida, mantém). Depois volta ao tamanho final e perde 1 px de borda (sem halo); `rec_sem_soltos` tira pedaço opaco (≥ 128) com menos de 0,5% do maior que ficou solto, com até 3 px de borda macia. Pedaço só do ISNet encostado na pessoa (`_rec_encostados`, precisa da foto) sai só com quatro provas: alfa ISNet ≥ 0,5 fora da pessoa engordada 2 px, média do modelo de pessoa < 0,15 e área < 1,5% da pessoa; contato curto (pontos colados na pessoa / raiz da área < 2); o fundo continua por ele (≥ 30% da borda com o fundo sem contraste de cor); a foto mostra borda entre ele e a pessoa (diferença de cor ≥ 15). Até 32 pedaços; na faixa de 2 px junto dele vale o alfa do modelo de pessoa. No fim (`_rec_ilhas`), ilha com alfa ≥ 0,5 que não está ligada à pessoa pelo alfa ≥ 0,5 nem pelo miolo (sinal ≥ 0,10; rotulado depois de abrir 1 px com a cruz 3x3, para fio de 1 px não ligar); pedaço mantido que só se liga à pessoa por miolo fraco ganha o caminho mais curto desse miolo opaco (`_rec_pontes`, até 16 pedaços e 5% do lado); pedaço com semente de pessoa e pelo menos 0,2% do maior nunca cai por tamanho e tem menos de 3% da área dela sai, com a borda macia em volta. Até 48 furos sem sinal (os maiores) são decididos pela cor, em no máximo 2 s; o resto fica aberto. Semente sem pessoa ≥ 0,6: 80% do máximo do modelo de pessoa (se > 0,3); sem nada, alfa alto em qualquer uma das máscaras, como antes da v88. Conferido com fotos de exemplo do repo: óculos escuros, taça segurada e bandeira aberta saem sólidos. Casos da v88 (fotos reais de 30/10, fora do repo): convidado ao lado da taça da Libertadores num pedestal sai sem a taça e sem o pedestal; bandeira do Vasco segurada atrás do corpo sai inteira, sem furo no branco e sem o teto do estádio; família com bandeiras e a taça segurada pela criança sai com tudo, sem fechar os vãos entre as pessoas. Limite: objeto que encosta ou se sobrepõe à pessoa na imagem vai junto, segurado ou não.
- Prazo do cache: `limpar_recortes()` uma vez por dia no `galeria_loop` (junto do `limpar_rostos`): apaga o que tem mais de 2 dias (mtime), o de foto que saiu da biblioteca e, acima de 5 GB (`ETERNA_RECORTES_GB`), os mais antigos. O `POST /recorte` também apaga o recorte quando a foto não está mais na biblioteca.
- Sessões abertas uma vez, na primeira foto, dentro da thread de trabalho (`rec_carregar`, com trava própria: o `/status` nunca espera a carga), `intra_op_num_threads = núcleos − 1`, sem arena de memória. Erro ao abrir os modelos: 503 por 60 s e depois tenta de novo.
- Fila `rec_fila` (até 24) com 1 trabalhador (`ETERNA_RECORTE_CONC=2` para 2). Fila cheia: 429 `fila_cheia`; mais de 180 s: 504.
- Sem rembg, onnxruntime, Pillow, numpy, scipy ou os modelos: 503 `{error:"recorte_indisponivel", motivo, como}` (o `como` manda rodar `instalar-recorte`). Nada é importado no topo. O agente nunca baixa modelo sozinho; procura em `$REMBG_HOME/models/<nome>/<nome>.onnx` (padrão `~/.rembg`) e em `$U2NET_HOME/<nome>.onnx` (padrão `~/.u2net`). `ETERNA_SEM_RECORTE=1` desliga (testes).
- `/status` traz `recorte:{ok,motivo,carregado,modelos,fila,feitos,ms_medio,ms_ultimo,simultaneos}` e `fundos_modo`; o console de abertura mostra "Recorte local".
- Acesso: `/recorte` e `/recorte/` em `rota_privada`. `POST /recorte` só de loopback, com `Host` do agente e `Origin` vazia ou do agente (a regra do `/photoroom/compose`; os postos pareados entram na etapa 2 da v83 com a mesma regra). `GET /recorte/` também só de loopback. Limite de 60 recortes novos por minuto por IP (o cache não conta).
- Trava do Photoroom: `POST /fundos/modo {modo:"local"|"photoroom"}` (só loopback e origem local) grava `~/Eterna/fundos-modo.json`. Sem o arquivo vale `local`, e o `/photoroom/compose` responde 409 `photoroom_desligado`.
- Medido no ambiente de teste (2 vCPU, 7 GB, CPU): cerca de 1,1 GB residentes com as duas sessões abertas e pico de 1,7 GB durante o recorte; 5 a 6 s por foto de 3000×2000 (a primeira, com a abertura dos modelos, de 7 a 8 s). Recomendado: 16 GB de RAM no computador do ponto.

### App (`index.html`)
- `fiaMontar(photoId,bgId,{hi})`: única montagem para a prévia (`compose`, recorte de 2400 px e fundo `file` de 2400 px, imagem por `toBlob`), o Checkout, o Posto de venda e a impressão da v83 (`compHi`, recorte de 3000 px e fundo `fileHi` de 5000 px, saída `IMP_PX` 1844×1240 em 10×15, cortada na horizontal pelo centro e presa embaixo; a impressão espera até 60 s pela montagem). `fiaRecorte` (POST `/recorte`, até 8 recortes na memória), `fiaMedir` (máscara com alfa ≥ 128 numa cópia de até 600 px; meio corpo quando a máscara encosta embaixo), `fiaLayout` (pura) e `fiaDesenhar`. O cache `COMP` apaga a montagem que deu erro ou ficou pendente.
- Rosto nunca cortado (D5, regra 10): quando a regra corta o recorte, o YuNet do app (`ynDetect`) lê os rostos do recorte (`fiaRostos`, uma vez por foto) e a linha de corte desce até a base do rosto mais baixo + 15% da altura dele (rostos com pelo menos 30% da altura do maior).
- Regras em `FIA_REGRAS` (corte = fração da altura da pessoa mantida a partir do topo; alt e larg = teto no quadro; cx = centro; o grupo sempre encosta embaixo; sem sombra):

| Fundo | Meio corpo | Corpo inteiro | Outros |
| --- | --- | --- | --- |
| Noite de campeão (`campeao2`) | inteiro, 88% alt., 92% larg. | joelho (62%), 85% alt., 95% larg. | sem sombra (regra 9) |
| Mirante (`mirante`) | 80% alt., centro 45% | joelho (62%), 80% alt., centro 45% | |
| Arquibancada 1950 (`arq1950`) | umbigo (72%), até 100% larg. | 60% e 78% alt. | grupo largo: zoom do fundo 80% preso no topo, corte 55%, até 105% larg. (regra 10); tudo P&B, grupo com +10% de contraste |
| Saída do túnel (`tunel`) | teto 75% alt. | joelho (62%), teto 75% | |
| Pódio de campeão (`podio`, v86) | inteiro, 80% alt., 62% larg., centro 45% | joelho (62%), 80% alt., 62% larg., centro 45% | borda direita do grupo até 76%; nunca cobre a taça do fundo (80% a 94%) |

- `fit` do Campeão, do Mirante, do Túnel e do Pódio aceita `inteiro` (vira do joelho para cima).
- Checkout: no modo local, `lojaAI` só oferece fundo de IA com `state.agent.recorte.ok` e só para fotos do agente (`fiaOferece`). A miniatura mostra `T('aiMaking')` com indicador (`.lj-aimk`, `.lj-spin`) até a montagem ficar pronta. Item que falhou (503, sem pessoa ou erro) entra em `FIA_RUIM` (`fiaFalhou`; falha do recorte vale para a foto inteira) e sai da venda e da escolha já feita.
- Interruptor em Painel de controle › Montagem dos fundos (`SIM.fundosModo`: `local` padrão ou `photoroom`; ação `fundos-modo`, módulo `configuracao.u`), que também grava o modo no agente (`POST /fundos/modo`). O código do Photoroom ficou intacto como `composePR` e `compHiPR`, chamado só no modo Photoroom.
- Fundos de IA ganhou o quadro "Recorte local" (`fiaPanel`), com o motivo real (não instalado, erro ao abrir os modelos ou desligado). Foto de exemplo (sem `ag_`) não é recortada.

### Instalador
`agente/instalar-recorte.command` (Mac) e `agente/instalar-recorte.bat` (Windows): criam `~/Eterna/venv` e instalam versões fixas (`rembg==2.0.86`, `onnxruntime==1.29.0`, `opencv-python-headless==4.10.0.84`, `psutil==7.2.2`, sem o extra `[cli]`), depois baixam os dois modelos por `rembg.new_session`. `Eterna.command` e `iniciar-eterna.bat` passam a usar o Python do venv quando ele existe.

### Fora desta entrega
- Zonas protegidas (Cristo, Pão de Açúcar). A escolha das fotos continua pela nota simulada e pelo `fit` de cada fundo.
- Recorte pedido de outro posto da rede (etapa 2 da v83).

## Nuvem: fotos online, galeria do cliente e teste de estanque (plano v85, 29/10/2026)
Documento próprio: [NUVEM.md](NUVEM.md) (recursos da AWS, variáveis do agente, API da galeria, DNS, custos, como recriar e como apagar).

## Fundo Pódio de campeão (v86, 29/10/2026)

Teste: `testes/v86.js`. Regra 14 em [fundos-ia-regras.md](fundos-ia-regras.md).

- **Fundo novo.** 5º fundo de IA, `id:'podio'`, "Pódio de campeão": estádio lotado verde e amarelo, confete, pódio dourado no centro e uma taça num pedestal à direita (de 80% a 94% da largura). Aprovado direto pelo Eduardo (29/10), sem passar pelo Laboratório. Arquivos: `img/bg-podio.jpg` (2400 px, prévia) e `img/fundos-5k/podio.jpg` (5000 px, impressão, `fileHi`). `fit:['meio','close','inteiro']`.
- **Ativo por padrão.** `BG_DEF=['campeao','mirante','arq1950','tunel','podio']`, dentro do limite `BG_MAX=5`.
- **Montagem local.** `FIA_REGRAS.podio`: `meio {corte:1, alt:.80, larg:.62, cx:.45}` e `inteiro {corte:.62, alt:.80, larg:.62, cx:.45}`. Com centro em 0,45 e largura até 0,62, a borda direita do grupo fica em até 0,76, antes da taça. A taça é zona protegida (regra 2): o grupo nunca a cobre.
- **Photoroom (`bgPad`).** `pos` ganhou `larg` opcional, teto da largura do grupo em fração do quadro: a largura útil passa a ser `min(min(cx,1-cx)×2×0,95, larg)`. Sem `larg`, nada muda nos outros fundos. O Pódio usa `pos:{cx:.45, top:.2, base:1, larg:.62}`, com o mesmo limite de 0,76 da montagem local.
- **Migração `bgMigraPodio`.** Uma vez só, depois da migração do catálogo (a gravação já sai com `catalogoV=2`). Quem tem a escolha de fundos salva (`SIM.bgOn`) com 1 a 4 fundos ganha o `podio` no fim da lista. Lista vazia fica vazia (foi escolha da pessoa). Se tirarem o Pódio depois, ele não volta. A marca fica em `SIM.bgPodioV86=true` e em `localStorage['eterna.bgpodio.v']='86'`, para um `SIM` antigo gravado por outra janela não refazer.
- **Agente.** `podio` entrou no mapa fixo `FUNDOS_PREVIA` (`img/bg-podio.jpg`) e `FUNDOS_IMPRESSAO` (`img/fundos-5k/podio.jpg`). O agente precisa ir para o Mac do Eduardo (o deploy faz).
- **IMPORTANTE: trocar a imagem de um fundo exige trocar o nome do arquivo.** O agente guarda o fundo em cache pelo nome do arquivo. Se a imagem nova entrar com o mesmo nome, a prévia e a impressão podem sair com a imagem antiga. Novo nome no `file`/`fileHi` do `DATA.backgrounds` e no mapa do agente (como foi feito com `img/bg-campeao-v81.jpg`).

## Fila do fotógrafo (v87, 30/10/2026)

Plano: `docs/planos/2026-10-30-fila-do-fotografo.md`. Testes: `testes/fila-fotografo.js` (app, Playwright, `/fila-fotografo` simulado) e `testes/fila_fotografo_agente.py` (agente, chamado pelo .js, critérios 1 a 13).

Decisões do Eduardo (30/10): D1 sai da coluna final 15 min depois de pronto (`FF_PRONTA_MIN = 15`); D2 nome do fotógrafo grande, hora de início e nº de fotos, sem código LP; D3 automático, sem botão; D4 miniaturas na tela da equipe e nunca na TV (ajuste da segurança B1, abaixo); D5 colunas "Clicando agora" · "Chegando" · "Já no Checkout" (estados `fotografando`, `subindo`, `pronta`); D6 Admin, Supervisor, Fotógrafo e Atendimento e venda, módulo `filafoto` só com Ver. Adendo: cada grupo mostra o fotógrafo e, entre parênteses, de onde vem.

### Agente

- **Por que no agente.** A sessão LP ainda nasce no navegador (v85 A não está no main): cada navegador monta sessões e códigos diferentes. A chegada da foto no agente (`meta[pid].u`) é a única verdade comum, então a fila é calculada lá, por fotógrafo.
- **Grupo.** Fotos da mesma chave em que cada chegada fica a no máximo `FF_PAUSA` (20 s; `ETERNA_SESSAO_PAUSA` de 2 a 600 só nos testes) da anterior. Chave: 1) a origem `o`, se `sem_acento(o)` estiver em `ff_cadastrados()` (os cadastrados menos os logins `compartilhado` do `ftp.json`: login compartilhado sem subpasta não é fotógrafo, L3); 2) `autor` ou `dono` do EXIF (inteiro ou o primeiro nome), se cadastrado; 3) sem fotógrafo, agrupado por série (`câmera ···1234`) ou pela fonte (`ftp-estadio`, `cartão`, `pasta`). Subpasta não cadastrada nunca vira nome na tela (L1).
- **Relógio da câmera.** Por série, deque das últimas 50 diferenças `u − cap`; `desvio = min` (com sinal: relógio adiantado também é compensado). `ultimo_clique = min(cap_max + desvio, ultima_chegada)`; sem `cap`, usa a chegada.
- **Estado (`ff_estado`).** Chegada nos últimos `FF_PAUSA` s: sem `cap` = `fotografando` (as duas etapas viram uma); leva de cartão = `subindo`; senão `fotografando` se `agora − ultimo_clique ≤ FF_PAUSA`, `subindo` se não. Sem chegada: `subindo` enquanto houver foto do grupo na fila de rostos (rostos ligados ou ainda "iniciando", `ff_rostos_ligados`); depois `pronta`, com `pronta_em = max(ultima_chegada + FF_PAUSA, fim da última leitura de rosto)`; `fora` depois de `FF_PRONTA_MIN` min (podado em `ff_json`). Virada do dia limpa a lista.
- **Estado em memória.** `ff_grupos`, `ff_aberto`, `ff_desvio`, `ff_pid_g`, `ff_rev`, `rostos_pendentes`, `ff_funcao`, todos sob `ff_lock`. **O `ff_lock` nunca é pego com o `lock` na mão**: `ingest_file` copia o meta dentro do `lock` e chama `ff_add` depois de soltar; `ff_carregar` copia o meta e solta antes. `ff_carregar()` roda no começo de `main()` e refaz os grupos de hoje a partir do meta de hoje (mesmos ids e `n`; cada pid num grupo só; meta estragado de uma foto é pulado com aviso). A poda tira de `ff_pid_g` os pids do grupo podado. `ingest_file` chama `ff_add` e `ff_rosto_fila` (antes do `put`) dentro de `try`: erro na fila nunca barra a foto. `lgpd_excluir` chama `ff_esquecer(pid)` (sai da contagem e das miniaturas). `ff_rosto_fila` (junto de cada `fila_rostos.put`) e `ff_rosto_lido` (no `finally` do leitor, com erro também) contam as fotos na fila de rostos.
- **Limites.** Até `FF_MAX = 2000` grupos por dia; até 24 grupos na coluna final; `pids` só nos grupos `fotografando` e `subindo`, até 6 (`FF_PIDS`); nos `pronta`, `pids: []`. Sem nome de arquivo, sem série completa, sem nome de convidado.
- **Função do dia.** `~/Eterna/ponto/funcao.json` (`{dia, map, em}`, chmod 600, tmp + `os.replace`). A função é fotografada no grupo quando ele abre (trocar na Escala não muda grupo aberto). Reiniciar o agente refaz os grupos de hoje com a função atual do arquivo (a fotografia por grupo não é gravada em disco).

`GET /fila-fotografo` → 200, `Cache-Control: no-store`, CORS só para as origens de `ETERNA_ORIGENS` (nunca `*`; segurança N1). Exige `posto()` (loopback ou `Host` em `ORIGENS_REDE_HOSTS`) e `origem_local()`; senão 403.
```json
{"ok":true,"agora":1761830000.1,"rev":88,"pausa":20,"pronta_min":15,
 "grupos":[{"id":"G014","estado":"subindo","fotografo":"carlos","fonte":"ftp","funcao":{"tipo":"campo","point":"terminal"},
   "inicio":1761829900.0,"ultima_chegada":1761829995.2,"ultimo_clique":1761829970.0,"pronta_em":null,"n":11,"pids":["a1b2c3d4e5f6"]}]}
```
`fonte`: `ftp` ou `cartão` quando há fotógrafo; senão `câmera ···NNNN`, `ftp-estadio`, `cartão` ou `pasta`.

`POST /fila-fotografo/funcao` com `X-Eterna: 1`, corpo até 4 KB: `{"dia":"AAAA-MM-DD","map":{"carlos":{"tipo":"campo","point":"terminal"},"yago":{"tipo":"volante","modo":"chute"}}}`. Exige `posto()`, `origem_local()` e o cabeçalho (403), `limite_ok` de 30 por minuto por IP (429), corpo até 4096 bytes (413). Resposta `{"ok":true,"ignoradas":n}`: chave fora de `ff_cadastrados()` é ignorada e contada (revisão 1). Validação (400): `dia` = hoje no fuso do agente (ou em UTC); `map` objeto com até 40 chaves; numa chave cadastrada: `tipo ∈ {campo, volante, folga}`; `point` `^[a-z0-9_-]{1,24}$`; `modo ∈ {grupo, chute, livre}`. Só `tipo`, `point` e `modo` são gravados (o resto, como `from`, sai). A gravação do arquivo e da memória é feita com o `ff_lock` (dois POSTs não disputam o `.tmp`; N2). O console registra "função do dia atualizada por este computador" ou "por posto <IP>", sem conteúdo.

**`ETERNA_ORIGENS` sem esquema (segurança I1).** Entrada sem `http://` ou `https://` não vira Host vazio em `ORIGENS_REDE_HOSTS` e é avisada no console no boot.

**Miniatura pelo endereço da rede (risco 4).** `origem_privada_ok` aceita `/thumb/<pid>` com `Host` em `ORIGENS_REDE_HOSTS` (Origin vazia ou em `ETERNA_ORIGENS`), para a TV aberta pelo endereço do servidor do ponto. `/file/` continua só com `HOSTS_OK`.

### App

- View `fotofila` (`vFotoFila`) no grupo Fotógrafo, logo depois de `importar`; módulo `filafoto` (`MODULE_INFO.filafoto` com `r` e `u`, este só para o interruptor das miniaturas); `PRESETS`: `foto` e `venda` com `filafoto:{...RO}` e `fotofila` no `menu`, Supervisor com `filafoto` Ver e Alterar, Admin pelo `ALL`. Só `fotofila-mini` entra em `WRITE_OPS`. Migração única `x.mff87` põe `fotofila` no menu salvo de quem tem perfil pronto que inclui a tela.
- `fotoFilaPoll` a cada 2 s, `AbortController` de 4 s; sem resposta, mantém o último dado e mostra "Sem conexão com o servidor · atualizado há N s". Estrutura `if-wrap`/`if-board` da Fila de impressão; coluna do meio (`Chegando`) destacada.
- `ffOnde(f)`: `campo · <ponto>`, `volante · <modo>`, `set interno · <ponto>` (ponto `kind:'vestiario'`) ou `sem ponto`. Sem função no agente, `ffPadrao(chave)` usa o ponto fixo de `DATA.points` (igual em todo navegador). Fotógrafo de folga mandando fotos ganha o aviso "De folga na Escala e mandando fotos" (L4).
- Miniaturas: até 6 `<img loading="lazy" src="<agente>/thumb/<pid>">` (pid conferido por regex) só em Clicando agora e Chegando, e só se `ffMiniOn()` (segurança B1): a escolha gravada no aparelho (`localStorage['eterna.fotofila.tvmini']` `'1'`/`'0'`) vale; sem escolha, ligado só quando o perfil não tem `venda.r` nem `quiosque.r` (o perfil venda é o caixa/TV) **e** a janela não está em tela cheia (`ffTelaCheia`: `body.if-tv`, `document.fullscreenElement`, `matchMedia('(display-mode: fullscreen)')` ou `screen.height − innerHeight < 2`, que pega F11 e quiosque); senão desligado. Assim a TV recarregada, em quiosque ou aberta direto em `#fotofila` não mostra rostos. O interruptor "Miniaturas neste aparelho" (`fotofila-mini`, `WRITE_OPS` `u`, `ACT_MOD` `filafoto`) aparece só com `filafoto.u` (Admin e Supervisor) e registra `fotofila_miniaturas` no `auditLog`. Um `resize` redesenha a tela (F11 na hora).
- Tela cheia (`fotofila-tv`, igual ao `impfila-tv`). Correção: a classe `if-tv` saía presa depois do Esc; agora `fullscreenchange` (fim da tela cheia), Esc sem tela cheia e `go()` (`tvSair`) tiram a classe. Vale também para a Fila de impressão.
- `setFunc` chama `ffFuncaoEnviar()` (POST com `X-Eterna: 1`, `dia` local, só pessoas de `humans`, sem bloquear e sem erro na tela). `agentPoll` envia de novo só quando o `boot` do agente é diferente do último envio deste aparelho (`ffBootNovo`, `localStorage['eterna.fotofila.boot']`), e só para quem tem `escala.u`.
- Sem `T()`: tela da equipe.

### Limites e riscos (para a v85 A e o pareamento)

- Sem código LP e sem "vendida" até a v85 A e as vendas no agente. "Já no Checkout" quer dizer fotos no servidor e rostos lidos; se o navegador do caixa estava fechado quando as fotos chegaram, o Checkout pode não achar a sessão (a sessão ainda é montada no navegador).
- O agente não tem autenticação: qualquer máquina que passe na checagem de origem lê a fila e troca a função do dia (impacto só de exibição; POST com limite por minuto e registro do IP). O pid continua abrindo `/file/` para quem tem o `Host` certo (risco já existente, v85 risco 1); por isso só 6 pids por grupo aberto. A correção é o pareamento do posto (v83 A).
- Polling de 2 s por tela; com mais de 5 telas, acrescentar 304 por `rev`.
