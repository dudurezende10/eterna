# Plano v81: reconhecimento facial com provedor trocável (local + AWS Rekognition)

Não editei nenhum arquivo. Este plano parte da v80 já implementada, e duas coisas dela importam aqui: `origem_local()` passa a exigir loopback, e `GET /status` fica aberto para qualquer aparelho da rede. O agente que li ainda é o da v78 com a galeria da v77.

## Objetivo
O reconhecimento facial passa a ter um adaptador de provedor no agente. O local (YuNet+SFace) continua sendo a base e funciona offline. O Rekognition em sa-east-1 só é usado na galeria por QR (CompareFaces, que não guarda nada) e nos grupos de escola cujos responsáveis aceitaram antes (uma coleção por grupo).

A nuvem só liga se três coisas estiverem certas: o opt-out de IA da AWS foi conferido, o consentimento novo foi aceito e a credencial é temporária. Toda operação de nuvem passa por uma fila persistente, com limpeza, reconciliação e exclusão do titular de ponta a ponta.

## Achados no código que o programador e o revisor precisam saber
1. **A retenção de 60 dias é furada a cada reinício.** `rostos_thread()` chama `limpar_rostos()` e logo depois enfileira toda foto de `lib` que não está em `foto`. As fotos com mais de 60 dias acabaram de sair de `foto` e por isso são lidas de novo, porque o inbox guarda os originais para sempre. A v81 corrige isso (item H).
2. `galeria_loop` só limpa os rostos com `rostos["ligado"]`. Sem OpenCV, nada é limpo, e a limpeza da nuvem não pode depender disso.
3. `gal_post /rosto` responde 503 quando o local está desligado. Com a nuvem disponível, a regra muda.
4. Na v80, `/status` é público na rede. Ele não pode mostrar conta, ARN, chave nem nome de coleção.

## Escopo desta entrega
Os itens estão na ordem de implementação e cada um se testa sozinho.
- **A.** Interface `ProvedorRostos` e escolha por config. Implementações: `ProvedorLocal`, `ProvedorRekognition`, `ProvedorRekognitionFalso` (só em teste) e `ProvedorAzure` (esqueleto desligado).
- **B.** Cliente AWS só com stdlib: SigV4 manual, credencial temporária, região travada e opt-out conferido com falha fechada.
- **C.** Galeria de sessão: o local decide primeiro e o CompareFaces entra com até K=5 fotos. Também entram o consentimento 2026-10-28 com a flag `nuvem`, o limiar por provedor e o teto diário de chamadas.
- **D.** Escola: aceite prévio no admin e coleção `et-<cliente>-ev-<id>`, com indexação só das fotos do grupo. A coleção é apagada no encerramento ou no dia 60.
- **E.** Fila persistente no `rostos.db`, tabela `rosto_nuvem`, manutenção diária com reconciliação por prefixo e alerta.
- **F.** Exclusão do titular (adulto e criança) com lápide, botão "Estas fotos não são minhas" e código individual sem rosto para menor.
- **G.** `/status` com provedor, fila e último erro, cartão só de leitura em Configurações › Repositório e Alertas.
- **H.** Correção da retenção (achado 1) e retenção de 7 dias para fotos fora de galeria.
- **I.** `/rostos/medir` com curva de limiar. No modo AWS, ele só mede numa coleção que já existe com aceite.
- **J.** Testes com `rekognition-falso`, sem conta AWS.

Se a entrega precisar ser partida, D, I e o código individual (F3) vão para a v81.1. A a H funcionam sozinhos.

## Fora do escopo
- Teste com AWS real: depois, com a credencial do Eduardo.
- `ETERNA_REPO=s3`: a leitura das fotos pelo S3 fica descrita no adaptador, mas não implementada.
- Azure real.
- boto3.
- Liveness (prova de vida).
- O celular do cliente alcançar a galeria, porque a galeria na nuvem é da fase 2.
- RIPD e parecer do DPO (documentos, fora do código).
- CloudTrail e SCP: ficam com o Eduardo na AWS, fora do código.
- Tela para editar provedor ou limiar: só pelo arquivo.
- Apagar fisicamente o original no inbox a pedido do titular (decisão do DPO).

## Decisões assumidas (padrão mais seguro; o Eduardo pode trocar)
| # | Decisão |
|---|---|
| D1 | **Ordem da configuração:** `ETERNA_ROSTOS` (só o nome do provedor), depois `~/Eterna/rostos.json` (chmod 600, dono = usuário do agente; senão, recusa), depois `local`. Um agente por venue, então a config é por venue. `cliente` vira o prefixo das coleções. |
| D2 | **O Checkout do ponto (`/rostos/buscar`, 1:N do dia) nunca chama o provedor de nuvem.** Ele chama a função local diretamente, não o adaptador. |
| D3 | **Galeria de sessão, local primeiro:**<br>• local ≥ 0,45: abre, sem nuvem;<br>• local < 0,38 em todas as fotos: `nao_encontrado`, sem nuvem;<br>• nuvem só quando o local está desligado, ainda processando, sem rosto detectado ou na faixa "talvez" (0,38 a 0,45).<br>Assim o "ou" entre os dois modelos não dobra o falso positivo. Cada tentativa conta uma vez nas falhas. |
| D4 | **CompareFaces:** a selfie é a origem, o alvo são até 5 fotos do token. Entram primeiro as de maior `larg` no `rosto` local; sem local, as 5 primeiras do manifesto. Chamadas em sequência, parando no primeiro acerto, com no máximo 15 s no total. As fotos vão reduzidas a 1600 px, sem EXIF. A selfie nunca entra na fila nem no disco. |
| D5 | **Escola na nuvem só com `nuvem.aceite` no manifesto:** referência do termo, quem marcou e quando. Sem aceite, o grupo fica no local (v77, 0,50). Id da coleção: `et-<cliente>-ev-` + 16 hex de `HMAC(SEGREDO, token)` (o token não aparece na AWS). `ExternalImageId` = pid hex (12) e nada mais. `IndexFaces` com `MaxFaces=15`, `QualityFilter=AUTO` e sem atributos. |
| D6 | **Limiares iniciais:**<br>• local: adulto 0,45, menor 0,50;<br>• Rekognition: adulto 95, menor 98 (similaridade 0 a 100).<br>Pisos travados no código: Rekognition adulto ≥ 90 e menor ≥ 95; local adulto ≥ 0,40 e menor ≥ 0,50. Valor abaixo do piso é corrigido para o piso e gera aviso. Os limiares só mudam no arquivo. |
| D7 | **Opt-out com falha fechada:**<br>• no início, a cada 24 h e a cada 10 min enquanto estiver recusado: `sts:GetCallerIdentity` (a conta precisa ser igual a `conta` da config) e `organizations:DescribeEffectivePolicy` com `AISERVICES_OPT_OUT_POLICY`, sem `TargetId`;<br>• vale `services.rekognition.opt_out_policy` e, se não existir, `services.default.opt_out_policy`; tem que ser `optOut`;<br>• qualquer erro (sem Organization, sem política, AccessDenied, sem rede, relógio) deixa a nuvem `recusado`; a busca e a indexação caem para o local;<br>• **exclusões e `DeleteCollection` rodam mesmo assim**, porque apagar sempre pode. |
| D8 | **Credencial:**<br>• **agora:** `assumir_papel`. Um usuário IAM base que só pode `sts:AssumeRole` num papel, com `ExternalId`; a chave base fica em `rostos.json`; a sessão tem 1 h e fica só em memória;<br>• **alvo:** `processo`, via `credential_process` com o `aws_signing_helper` do IAM Roles Anywhere (certificado, sem chave longa);<br>• as duas formas só com stdlib (`subprocess` sem shell, caminho absoluto; STS por query SigV4 com resposta XML em `xml.etree`);<br>• boto3 não entra: são 9 operações JSON simples, e um segundo caminho dobraria o teste. |
| D9 | **Região travada:** endpoint fixo `rekognition.sa-east-1.amazonaws.com` e `sts.sa-east-1.amazonaws.com`. `regiao` diferente de `sa-east-1` recusa o provedor. A única chamada fora daí é a do Organizations (global, us-east-1), que não leva dado pessoal. Não existe override de endpoint fora de `ETERNA_TESTE=1`. |
| D10 | **Teto diário de chamadas pagas:** `teto_diario`, padrão 3000 (cerca de US$ 4). Passou do teto: a busca não usa a nuvem e a indexação fica na fila. As exclusões nunca entram no teto. Alerta. |
| D11 | **Consentimento:** `GQ_VERSAO='2026-10-28'`. O agente só aceita essa versão (400 `consentimento_desatualizado`). O texto depende de `info.nuvem`, e o corpo devolve `nuvem:true` só se o texto com a AWS foi mostrado. Sem isso, o agente não usa a nuvem nessa busca. O log grava a versão que o servidor conhece, mais `modo`. |
| D12 | **Pendência do Eduardo: código por criança.** Não é impresso para todas as crianças. A alternativa sem rosto é um **código individual gerado sob pedido** pela administração, para uma sessão `menor` (galeria `sem_rosto`, só daquela sessão, nunca as fotos do grupo inteiro). A escola entrega ao responsável. |
| D13 | **Pendência do Eduardo: retenção de quem não comprou.** As leituras locais ficam 60 dias só para fotos em galeria ativa. As demais ficam **7 dias** (`retencao_sem_galeria`, de 1 a 60), o que cobre o Checkout do dia. Se uma galeria for publicada depois, as fotos são lidas de novo. |
| D14 | **"Estas fotos não são minhas":** fecha o acesso e conta no token. No 2º aviso, o token fica `revisao`: a selfie dá 423 até a equipe liberar ou encerrar. Nenhuma imagem ou IP é gravado. |
| D15 | **Exclusão do titular:**<br>• adulto ou sessão de menor: apaga todas as leituras locais das fotos da sessão e as da nuvem; encerra a galeria com lápide motivo `titular`; o original fica no inbox marcado como não usar (pendência do DPO);<br>• criança em grupo: apaga só os FaceIds e as linhas locais que bateram com ela; lápide `(escopo,pid)` para não indexar de novo; a galeria segue para as outras crianças. |
| D16 | **Manutenção diária (sempre, com ou sem OpenCV):**<br>• limpeza local;<br>• `ListCollections` com o prefixo `et-<cliente>-`: apaga a coleção expirada, encerrada, sem registro (órfã, com alerta) ou criada há mais de 60 dias (`CreationTimestamp`);<br>• confere a contagem de rostos de cada coleção ativa contra `rosto_nuvem` e apaga os rostos com `ExternalImageId` fora do grupo (com alerta);<br>• prefixo de outro cliente: nunca toca. |

## O que o Eduardo precisa providenciar na AWS (passo a passo curto)
1. **Conta e Organization:** criar (ou usar) uma conta gestora e ativar AWS Organizations com todos os recursos. Criar uma conta membro `eterna-rostos-prod`. O Rekognition roda só na membro.
2. **Opt-out de IA:** Organizations › Policies › AI services opt-out policies › Enable. Criar a política `{"services":{"default":{"opt_out_policy":{"@@assign":"optOut"}}}}` e anexar na Root.
3. **Travar a região (recomendado):** ativar SCP e anexar uma política que nega tudo com `aws:RequestedRegion` diferente de `sa-east-1`, com exceção de `iam:*`, `organizations:*`, `sts:*`, `support:*` e `budgets:*`.
4. **CloudTrail:** trilha da Organization gravando num bucket privado em sa-east-1.
5. **Papel na conta membro:** `eterna-rostos-<cliente>` com esta política mínima:
```json
{"Version":"2012-10-17","Statement":[
 {"Sid":"Colecoes","Effect":"Allow","Action":["rekognition:CreateCollection","rekognition:DeleteCollection","rekognition:DescribeCollection","rekognition:IndexFaces","rekognition:SearchFacesByImage","rekognition:SearchFaces","rekognition:DeleteFaces","rekognition:ListFaces"],
  "Resource":"arn:aws:rekognition:sa-east-1:<CONTA>:collection/et-<cliente>-*","Condition":{"StringEquals":{"aws:RequestedRegion":"sa-east-1"}}},
 {"Sid":"SemRecurso","Effect":"Allow","Action":["rekognition:CompareFaces","rekognition:ListCollections"],"Resource":"*","Condition":{"StringEquals":{"aws:RequestedRegion":"sa-east-1"}}},
 {"Sid":"OptOut","Effect":"Allow","Action":"organizations:DescribeEffectivePolicy","Resource":"*"}]}
```
   Relação de confiança: só o usuário do passo 6, com `sts:ExternalId` igual a um valor aleatório.
6. **Usuário base** `eterna-agente-<cliente>`: só `sts:AssumeRole` nesse papel. Criar a chave de acesso, com rodízio a cada 90 dias. A chave vai para `~/Eterna/rostos.json` (chmod 600) direto no computador do ponto, colocada pelo Ronaldo. Nunca por chat ou e-mail.
7. **Budgets:** alarme de US$ 50/mês. Conferir as cotas de TPS do Rekognition em sa-east-1.
8. **Passar para a equipe:** id da conta, ARN do papel e ExternalId. O DPO fecha a RIPD antes de ligar. O DPA da AWS já vem nos Service Terms.
9. **Ligar:** `/status` precisa mostrar `rekognition · ok · opt-out conferido`. Depois, calibrar (item I).

## Mudanças em `/home/claude/eterna/agente/eterna-agente.py`

**Config e escolha (A)**, no bloco de rostos, logo após `RETENCAO_DIAS`:
- `ROSTOS_CFG = ~/Eterna/rostos.json`.
- `rostos_cfg()`:
  - lê o arquivo; em POSIX, exige `st_mode & 0o077 == 0` e `st_uid == os.getuid()`, senão `None` com motivo `permissao_arquivo`;
  - valida `cliente` `^[a-z0-9-]{2,20}$`, `regiao=='sa-east-1'` e `conta` `^\d{12}$`;
  - aplica os pisos de limiar (D6).
- `class ProvedorRostos` com a interface:
  - `nome`, `limiar(tipo)` (tipo `adulto|menor`);
  - `buscar(escopo, selfie_bytes, candidatos)` → `{rosto:bool, sims:{pid:score}, faces:{pid:[face_id]}}` ou `{processando:True}`;
  - `indexar(escopo, pid, img_bytes)` → `[face_id]`;
  - `apagar_fotos(escopo, pids)`, `apagar_escopo(escopo)`;
  - `saude()` → dict do `/status`.

  Mesmo padrão de `Repositorio` e `Pagamento`.
- `ProvedorLocal`: embrulha `buscar_em` (sims em cosseno). `indexar` é o `leitor_loop` que já existe, então é no-op aqui. `apagar_*` apaga linhas de `rosto` (ver F).
- `ProvedorRekognition(transporte)`: `buscar` com `escopo.tipo=='sessao'` usa CompareFaces K; com `'evento'`, usa SearchFacesByImage na coleção. Os `sims` saem na escala 0 a 100.
- `ProvedorRekognitionFalso`: o mesmo `ProvedorRekognition` com o transporte `AwsFalso`. Só aceito com `ETERNA_TESTE=1`; senão, motivo `falso_so_em_teste` e fica o local.
- `ProvedorAzure`: só entra com `azure.aprovacao_limited_access` preenchido. Mesmo assim, `saude()` devolve `nao_implementado`. Os dois casos caem no local.
- `provedor_escolhido()` devolve `(PROV_LOCAL, PROV_NUVEM|None, motivo)`. Globais `PROV_LOCAL` e `PROV_NUVEM`. `PROV_NUVEM.ok()` é verdadeiro só com opt-out conferido, credencial válida e teto livre.

**Cliente AWS em stdlib (B)**
- `sigv4(metodo, host, caminho, query, cabecalhos, corpo, regiao, servico, cred, agora)` → cabeçalhos `Authorization`, `X-Amz-Date`, `X-Amz-Security-Token` e `X-Amz-Content-Sha256`. É função pura, para testar com vetor.
- `aws_json(servico, alvo, corpo)`:
  - POST `application/x-amz-json-1.1` com `X-Amz-Target` (`RekognitionService.<Op>`, `AWSOrganizationsV20161128.DescribeEffectivePolicy`);
  - `urllib` com timeout de 8 s;
  - transforma o erro em `ErroAws(codigo, repetir:bool, incerto:bool)`: `Throttling*`, `ProvisionedThroughputExceeded`, `LimitExceeded`, 5xx e rede repetem; timeout depois do envio marca `incerto`; `RequestTimeTooSkewed` vira motivo `relogio`.
- `sts_query(acao, params)` para `AssumeRole` e `GetCallerIdentity` em `sts.sa-east-1`.
- `cred_obter()`:
  - cache em memória até `Expiration` − 5 min;
  - `processo`: `subprocess.run(lista, shell=False, timeout=20)`, JSON versão 1;
  - `assumir_papel`: `RoleSessionName=eterna-<cliente>-<host8>`, `DurationSeconds=3600`, `ExternalId`.
- `optout_conferir()` (D7) grava `nuvem["optout"]`, `optout_conferido` e `motivo`.
- `img_para_nuvem(raw|path, lado=1600)`:
  - ≤1600 px e ≤4 MB: só `jpeg_limpo` (sem recomprimir; o falso depende disso);
  - senão, reduz com cv2, depois Pillow, depois a vitrine ou miniatura;
  - senão, `None` (`grande_demais`).
- `jpeg_limpo(raw)`: tira APP1 a APP13 (menos APP14) e COM, usando o mesmo parser de `img_dims`. Também vale para a selfie, que pode trazer GPS.
- `AwsFalso` (só teste):
  - lê `ETERNA_FALSO` (JSON abaixo); coleções em memória;
  - identidade da imagem por `sha256` dos bytes recebidos; mesma identidade dá `semelhanca[id]` (padrão 99), diferente dá 40;
  - injeta `Throttling` N vezes, `timeout_apos_enviar` (aplica e depois levanta `incerto`), `AccessDenied` e opt-out;
  - grava `~/Eterna/aws-falso.jsonl` com `{op,colecao,external_id,sha256,bytes,exif:bool,limiar}`, nunca a imagem.

**Fila e tabelas (E)**, em `rostos_db()`:
```sql
create table if not exists nuvem_fila (id integer primary key, op text, escopo text, pid text, estado text, tentativas int default 0,
  prox real, criado real, atualizado real, erro text, unique(op, escopo, pid));      -- op: criar_escopo|indexar|apagar_fotos|apagar_escopo
create table if not exists rosto_nuvem (provedor text, escopo text, pid text, face_id text, criado real, primary key(provedor, escopo, face_id));
create table if not exists nuvem_escopo (escopo text primary key, token_h text, tipo text, criado real, expira real, estado text, apagado real);
create table if not exists lapide_rosto (pid text, escopo text, motivo text, em real, primary key(pid, escopo));   -- escopo '*' = qualquer
create table if not exists nuvem_uso (dia text primary key, chamadas int);
```
- `nuvem_enfileirar(op, escopo, pid=None)`: `insert or ignore`. `apagar_*` também cancela o `indexar` pendente do mesmo escopo e pid.
- `nuvem_loop()` (thread):
  - pega a próxima op com `prox <= agora`, com as exclusões antes da indexação;
  - balde de 5 chamadas por segundo; semáforo global de 4 buscas ao vivo;
  - backoff `min(900, 2**n) + jitter`; depois de 12 tentativas vira `erro` e alerta;
  - no boot, `fazendo` vira `incerto` (indexar) ou `pendente` (apagar).
- **Idempotência do `IndexFaces`:**
  - antes de indexar, pula se `rosto_nuvem` já tem `(escopo,pid)` ou se existe lápide;
  - se a op estiver `incerto`, primeiro `ListFaces` paginado filtrando `ExternalImageId==pid`: se achar, adota os FaceIds e marca `feito`; se achar dois conjuntos, apaga o extra;
  - `CreateCollection`: `ResourceAlreadyExists` conta como sucesso;
  - `DeleteFaces` e `DeleteCollection`: `ResourceNotFound` conta como sucesso.
- `nuvem_apagar_pid(escopo, pid)`: `ListFaces` com filtro, mais os FaceIds de `rosto_nuvem`, depois `DeleteFaces`. Isso cobre duplicatas desconhecidas.

**Galeria (C, D, F)**
- `gal_validar`:
  - aceita `nuvem: {aceite:true, ref: str≤80, por: str≤120, em: ISO}` só com `tipo=='evento'`;
  - aceita `sem_rosto: bool` só com `tipo=='sessao' and menor`; senão, 400;
  - `gal_mesclar` mantém `revisao` e `nao_sou_eu` do manifesto anterior.
- Depois de publicar (`gal_post /galerias/publicar`), `gal_nuvem_sync(token, m)`:
  - com `nuvem.aceite`, não expirado e provedor configurado: `nuvem_escopo` upsert, `criar_escopo` e `indexar` para cada pid do grupo sem lápide;
  - pids que saíram do grupo: `apagar_fotos`;
  - aceite retirado ou encerrado: `apagar_escopo`.

  **Nenhum outro caminho chama `indexar`.**
- `gal_indexar()` (boot): refaz o `gal_nuvem_sync` dos grupos ativos e monta `pids_ativos`, o conjunto de pids em manifestos não expirados.
- `/galerias/encerrar` e a limpeza das expiradas: `apagar_escopo`, mais `nuvem_escopo.estado='apagando'`.
- `GET /g/<t>/info` ganha:
  - `nuvem`: `PROV_NUVEM.ok()` e (sessão, ou evento com aceite);
  - `sem_rosto`;
  - `consent: "2026-10-28"`.

  Não ganha `revisao`.
- `POST /g/<t>/rosto`:
  1. valida `versao=="2026-10-28"` (D11);
  2. `revisao` dá 423;
  3. `usar_nuvem = body.nuvem is True and info_nuvem`;
  4. local primeiro (D3) via `PROV_LOCAL.buscar`;
  5. nuvem se for o caso: sessão por CompareFaces com o limiar adulto, ou menor se `m.menor`; evento por SearchFacesByImage com o limiar menor, só os pids do grupo, e `ExternalImageId` fora do manifesto é descartado;
  6. 503 só se nenhum dos dois estiver disponível;
  7. o acesso guarda em memória `faces` (FaceIds e ids das linhas locais que bateram) para a exclusão;
  8. contador `rostos["buscas"]={"local":n,"nuvem":n}`;
  9. o log de consentimento ganha `modo`.
- Novas rotas públicas, cada uma com `limite_ok(ip, rota, 10)`:
  - `POST /g/<t>/abrir` (só `sem_rosto`): devolve acesso a todos os pids da sessão;
  - `POST /g/<t>/nao-sou-eu {acesso}`: apaga o acesso, `m.nao_sou_eu += 1`, `revisao` no 2º, linha em `galerias/eventos.jsonl` `{tipo, token_h, em}`;
  - `POST /g/<t>/apagar {acesso, idem}`: `titular_apagar` (D15).
- Novas rotas locais:
  - `POST /galerias/excluir {token}`: exclusão a pedido do DPO, da sessão ou do grupo inteiro (`apagar_escopo` mais as linhas locais dos pids);
  - `POST /galerias/liberar {token}`: zera `revisao`;
  - `GET /galerias/status` ganha `nuvem:{estado, rostos}`, `revisao` e `nao_sou_eu`.
- `titular_apagar(token, m, acesso, idem)`:
  - apaga as linhas `rosto` (todas da sessão, ou só os ids que bateram, no caso de criança em grupo);
  - `foto.n=-1` e `lapide_rosto(pid,'*')` no caso de adulto, ou `(pid, escopo)` no caso de criança;
  - nuvem: `DeleteFaces` dos FaceIds que bateram ou `apagar_fotos`;
  - adulto: encerra a galeria, `lapide_gravar(motivo='titular')` e `REPO.apagar`;
  - anexa em `galerias/exclusoes.jsonl` `{em, tipo, token_h, n_fotos, n_local, n_nuvem, estado}`, sem token e sem IP. Quando a fila termina, entra uma linha `concluida`.

**Retenção (H)**
- `limpar_rostos`:
  - apaga `rosto` com `dia < hoje-7` e pid fora de `pids_ativos`, mantendo `foto`;
  - apaga `rosto`/`foto` com mais de 60 dias, menos as linhas `foto.n=-1` (marca de excluído);
  - poda `_mat`.
- `rostos_thread`: só enfileira pid com dia ≥ hoje-60, fora de `foto` e sem lápide `'*'`.
- `leitor_loop`: pula pid com lápide `'*'`.
- `gal_processar`: pid do manifesto com `foto.n>0` e sem linhas `rosto` volta para `fila_rostos`.

**Manutenção (D16)**
- `manutencao_diaria()` substitui o bloco de limpeza do `galeria_loop` e roda sempre: `limpar_rostos` se houver banco, `optout_conferir` e `nuvem_reconciliar`.
- `POST /rostos/limpar` (local, 1 por minuto) roda na hora.
- `nuvem_reconciliar()`:
  - `ListCollections` paginado com o prefixo;
  - D16;
  - grava `nuvem["ultima_reconciliacao"]` e `nuvem["alerta"]`.

**Medição (I)**
- `/rostos/medir {sessoes, provedor:"local"|"rekognition", token?}`.
- Local: o mesmo de hoje, mais `curva`.
- Rekognition:
  - exige o `token` de um grupo com aceite e coleção ativa;
  - `SearchFaces(FaceId, FaceMatchThreshold=50, MaxFaces=100)` para cada face de `rosto_nuvem`, no máximo 500;
  - nenhum `IndexFaces`;
  - "genuíno" = melhor nota na mesma sessão; "impostor" = melhor nota em outra sessão.
- `curva = [{limiar, genuinos_acima, impostores_acima}]` para 80, 85, 90, 95, 97, 98, 99, 99,5 (no local: 0,35 a 0,60).
- Procedimento: criar o grupo "Calibração equipe" com aceite por escrito da equipe e medir, mais um grupo de escola com aceite. Escolher o menor limiar com 0 impostores na amostra e anotar o FRR. Ajustar `rostos.json` à mão.

**`/status`**: `rostos` ganha `provedor`, `limiar:{adulto,menor}`, `buscas` e:
```json
"nuvem":{"estado":"desligado|ok|recusado|sem_rede|sem_permissao|relogio|teto|nao_implementado","motivo":"opt_out_ausente","regiao":"sa-east-1",
 "optout":"ok|nao|desconhecido","optout_conferido":"ISO","fila":{"pendente":0,"incerto":0,"erro":0},
 "ultimo_erro":{"em":"ISO","op":"indexar","codigo":"ThrottlingException"},"chamadas_hoje":12,"teto":3000,"colecoes":1,
 "ultima_reconciliacao":"ISO","alerta":null}
```
Sem conta, ARN, chave, nome de coleção ou mensagem crua da AWS (só `codigo`).

**Docstring e `main()`**: linha "Rostos: local ligado · nuvem rekognition ok (opt-out conferido) · fila 0", ou o motivo da recusa.

## Mudanças em `/home/claude/eterna/index.html`
- **Constantes:**
  - `GQ_VERSAO='2026-10-28'`;
  - `pubLoad` guarda `info.nuvem` e `info.sem_rosto`.
- **Consentimento (`vGaleriaQR`, passo `consent`):**
  - texto `kid ? (evento&&nuvem ? 'gq_consentEvN' : nuvem ? 'gq_consentKidN' : 'gq_consentKid') : (nuvem ? 'gq_consentSelfN' : 'gq_consentSelf')`;
  - em `kid`, link `data-act="gq-semrosto"` leva ao passo `sem_rosto_info` (texto e campo de código, reaproveitando `gq-code-go`);
  - com `info.sem_rosto`, o passo vira `abrir`: botão `gq-abrir` chama `POST /g/<t>/abrir`.
- **`pubMatch`:**
  - corpo com `nuvem:!!p.info.nuvem`;
  - 423 leva a `p.motivo='revisao'`;
  - 400 `consentimento_desatualizado` recarrega a página uma vez.
- **Rodapé da galeria:**
  - `gq-notme`, depois o passo `notme_conf`, depois `gq-notme-ok`, que chama `/nao-sou-eu` e leva a `notme_done`;
  - `gq-delete`, depois `apagar_conf` (avisa que fecha a galeria e manda baixar antes as compradas; criança: "apaga só os dados do rosto desta criança"), depois `gq-delete-ok`, que chama `/apagar` com `idem` e leva a `apagado`;
  - no modo SIM, as duas ações só fecham o acesso local (o apagar marca `SIM.galerias[t].encerrada`).
- **Admin, `galGrupos`:**
  - caixa `gal-ev-nuvem` "Busca na nuvem (AWS) com aceite dos responsáveis" e campo `#gal-ev-ref` (obrigatório quando marcada; até 80 caracteres);
  - `galEvSalvar` grava `m.nuvem={aceite:true,ref,por:user.email,em}` ou `null`;
  - coluna "Nuvem" com "AWS · N rostos", "AWS · aguardando" ou "local", vinda de `/galerias/status`;
  - pill "Em revisão" com `gal-liberar`;
  - `gal-excluir` pede confirmação e leva a `gal-excluir-ok`.
- **Admin, Sessões, detalhe de sessão `menor`:**
  - botão `gal-ind` "Código individual (sem rosto)": `galNovo('sessao',[card],{menor:true,sem_rosto:true})`, `galPublicar` e `galPrint` com o aviso "Só para sessão individual ou da família".
- **`WRITE_OPS` e `ACT_MOD` `'galerias'`:** `'gal-ind':'c'`, `'gal-excluir-ok':'d'`, `'gal-liberar':'u'`. As ações `gq-*` são públicas, como na v77.
- **`vRepo`:** cartão "Reconhecimento facial" só de leitura, a partir de `state.agent.rostos`:
  - provedor, estado e motivo em português, região, opt-out e data da conferência;
  - limiares, fila (pendente, incerto, erro), chamadas hoje/teto, última reconciliação, último erro (código);
  - a nota "Para trocar, edite ~/Eterna/rostos.json no computador do ponto";
  - sem nenhum input.
- **`alerts()`:**
  - nuvem configurada e `recusado` (`bad`, com o motivo);
  - fila com `erro` maior que 0 (`bad`);
  - `incerto` há mais de 1 h (`warn`);
  - `teto` (`warn`);
  - `nuvem.alerta` (`bad`);
  - galeria em `revisao` (`warn`).
- **`vTreino`, painel "Reconhecimento facial":**
  - seletor Local | AWS (AWS só com `nuvem.estado==='ok'`) e seletor do grupo com aceite;
  - tabela da `curva`;
  - a nota "AWS mede só em grupos com aceite; nada novo é enviado".
- **CSS:** `.gq-links` (links discretos do rodapé), `.gq-consent small`.

## Contratos

**`~/Eterna/rostos.json`** (chmod 600)
```json
{"provedor":"rekognition","cliente":"maracana","regiao":"sa-east-1","conta":"123456789012",
 "credencial":{"tipo":"assumir_papel","role_arn":"arn:aws:iam::123456789012:role/eterna-rostos-maracana","external_id":"<aleatório>",
               "chave_base":{"id":"AKIA...","segredo":"..."}},
 "credencial_alternativa_exemplo":{"tipo":"processo","comando":["/usr/local/bin/aws_signing_helper","credential-process","--certificate","...","--private-key","...","--trust-anchor-arn","...","--profile-arn","...","--role-arn","..."]},
 "limiar":{"rekognition":{"adulto":95,"menor":98},"local":{"adulto":0.45,"menor":0.50}},
 "k_fotos":5,"teto_diario":3000,"retencao_sem_galeria":7,"azure":{"aprovacao_limited_access":null}}
```

**`ETERNA_FALSO`** (só com `ETERNA_TESTE=1` e `ETERNA_ROSTOS=rekognition-falso`)
```json
{"optout":"optOut|optIn|erro|sem_org","conta":"123456789012","rostos":{"<sha256 dos bytes>":["A","B"]},"semelhanca":{"A":99.0},
 "falhas":{"Throttling":{"IndexFaces":2},"timeout_apos_enviar":["IndexFaces:<pid>"],"AccessDenied":false}}
```

**Manifesto (acréscimos):** `"nuvem":{"aceite":true,"ref":"Termo Escola X 28/10","por":"...","em":"ISO"}|null` e `"sem_rosto":false`.

**Rotas**
| Rota | Corpo | Respostas |
|---|---|---|
| `GET /g/<t>/info` | | acrescenta `nuvem`, `sem_rosto`, `consent` |
| `POST /g/<t>/rosto` | `{consentimento:true,versao:"2026-10-28",idioma,nuvem:bool,imagem}` | as da v77, mais 400 `{error:"consentimento_desatualizado",versao}` e 423 `{motivo:"revisao"}` |
| `POST /g/<t>/abrir` | `{}` | `{ok,acesso,exp,galeria}`; 404 se não for `sem_rosto` |
| `POST /g/<t>/nao-sou-eu` | `{acesso}` | `{ok:true}`; 401 com acesso inválido |
| `POST /g/<t>/apagar` | `{acesso,idem}` | `{ok:true,pendente_nuvem:bool}`; o mesmo `idem` devolve o mesmo resultado |
| `POST /galerias/excluir` (local) | `{token}` | `{ok,pendente_nuvem}` |
| `POST /galerias/liberar` (local) | `{token}` | `{ok}` |
| `POST /rostos/medir` (local) | `{sessoes,provedor,token?}` | acrescenta `curva`, `provedor` |
| `POST /rostos/limpar` (local) | `{}` | `{ok,apagadas:{local,nuvem},alertas}` |

**I18N** (arrays `[pt,en,es,fr,de]`). Abaixo, o pt e o en; o programador faz es, fr e de com o mesmo conteúdo. Todo texto `*N` precisa conter "AWS", o nome do Brasil na língua e "60".

| chave | pt | en |
|---|---|---|
| `gq_consentSelf` (revisado) | Concordo que a minha selfie seja usada só para encontrar as minhas fotos desta visita. Ela é comparada na hora e descartada. As leituras de rosto das fotos ficam guardadas até 60 dias e posso pedir a exclusão nesta página (LGPD). | I agree that my selfie is used only to find my photos from this visit. It is compared on the spot and discarded. Face data from the photos is kept for up to 60 days and I can ask for deletion on this page (LGPD). |
| `gq_consentKid` (revisado) | o texto atual mais "As leituras de rosto ficam até 60 dias e posso pedir a exclusão nesta página." | the same addition in en |
| `gq_consentSelfN` | Concordo que a minha selfie seja usada só para encontrar as minhas fotos desta visita. A comparação é feita no computador do Viva Maracanã e, quando preciso, pela Amazon Web Services (AWS), contratada como operadora, em servidores no Brasil. A selfie não é guardada. As leituras de rosto das fotos ficam até 60 dias e posso pedir a exclusão nesta página (LGPD). | I agree that my selfie is used only to find my photos from this visit. The comparison is done on the Viva Maracanã computer and, when needed, by Amazon Web Services (AWS), hired as a data processor, on servers in Brazil. The selfie is not stored. Face data from the photos is kept for up to 60 days and I can ask for deletion on this page (LGPD). |
| `gq_consentKidN` | Sou mãe, pai ou responsável legal pela criança e autorizo o uso da foto do rosto dela só para encontrar as fotos desta visita (LGPD, art. 14). A comparação é feita no computador do Viva Maracanã e, quando preciso, pela Amazon Web Services (AWS), contratada como operadora, em servidores no Brasil. A foto não é guardada. As leituras de rosto ficam até 60 dias e posso pedir a exclusão nesta página. | I am the child's parent or legal guardian and I authorise the use of the child's face photo only to find the photos from this visit (LGPD, art. 14). The comparison is done on the Viva Maracanã computer and, when needed, by Amazon Web Services (AWS), hired as a data processor, on servers in Brazil. The photo is not stored. Face data is kept for up to 60 days and I can ask for deletion on this page. |
| `gq_consentEvN` | Sou mãe, pai ou responsável legal pela criança e autorizo o uso da foto do rosto dela só para encontrar as fotos dela neste passeio da escola (LGPD, art. 14). Os rostos das fotos do grupo ficam indexados pela Amazon Web Services (AWS), contratada como operadora, em servidores no Brasil, até o fim da galeria ou no máximo 60 dias. A foto que envio agora não é guardada. Posso pedir a exclusão nesta página. | I am the child's parent or legal guardian and I authorise the use of the child's face photo only to find their photos from this school trip (LGPD, art. 14). Faces in the group photos are indexed by Amazon Web Services (AWS), hired as a data processor, on servers in Brazil, until the gallery closes or for 60 days at most. The photo I send now is not stored. I can ask for deletion on this page. |
| `gq_noFaceAlt` | Prefiro não usar foto do rosto | I'd rather not use a face photo |
| `gq_codeKidD` | Peça à escola ou ao atendimento do Tour o código individual da criança e digite aqui. | Ask the school or the Tour desk for the child's individual code and type it here. |
| `gq_openKid` | Abrir as fotos | Open the photos |
| `gq_notMe` | Estas fotos não são minhas | These photos are not mine |
| `gq_notMeD` | Vamos fechar estas fotos agora. Se as suas não aparecerem, procure o atendimento do Tour com o seu recibo. | We will close these photos now. If yours don't show up, go to the Tour desk with your receipt. |
| `gq_notMeDone` | Obrigado por avisar. | Thanks for letting us know. |
| `gq_review` | Esta galeria está em revisão. Procure o atendimento do Tour. | This gallery is under review. Please go to the Tour desk. |
| `gq_delete` | Apagar meus dados de rosto | Delete my face data |
| `gq_deleteD` | Isso apaga as leituras de rosto e fecha esta galeria. Baixe antes as fotos que você comprou. | This deletes the face data and closes this gallery. Download the photos you bought first. |
| `gq_deleteKidD` | Isso apaga só os dados do rosto desta criança. | This deletes only this child's face data. |
| `gq_deleted` | Pronto. Os dados de rosto foram apagados. | Done. The face data has been deleted. |
| `gq_confirm` | Confirmar | Confirm |

## Testes
- `/home/claude/eterna/testes/v81-rostos.js` (novo):
  - sobe o agente como em `galeria-agente.js`, com HOME temporário, `ETERNA_TESTE=1`, `ETERNA_ROSTOS=rekognition-falso`, `ETERNA_FALSO=<json>` e `ETERNA_SEM_OPENCV=1` na fase A;
  - fase B com OpenCV, se existir, para o "local primeiro";
  - imagens pequenas sem EXIF, para o sha256 bater;
  - relógio de teste: reusar o mecanismo da v80; se ele não existir, `agora()` com deslocamento só com `ETERNA_TESTE=1`.
- `/home/claude/eterna/testes/todas-as-telas.js`: `repo` e `galerias` com `state.agent.rostos` simulado.
- `/home/claude/eterna/testes/galeria-agente.js`: continua passando, com a versão do consentimento atualizada para `2026-10-28`.

## Critérios de aceite
**Escolha e travas**
1. Sem `rostos.json` e sem `ETERNA_ROSTOS`: `/status.rostos.provedor=="local"` e `nuvem.estado=="desligado"`. `galeria-agente.js` passa.
2. `ETERNA_ROSTOS=rekognition-falso` sem `ETERNA_TESTE=1` dá provedor local, motivo `falso_so_em_teste`, e o `aws-falso.jsonl` não é criado.
3. `rostos.json` com chmod 644 dá motivo `permissao_arquivo` e fica o local (em POSIX).
4. Falso com `optout:"optIn"`, depois `"erro"`, depois `"sem_org"`: `estado=="recusado"` com o motivo certo, e nenhuma operação `rekognition` no log. Com `"optOut"`: `estado=="ok"` e `optout_conferido` preenchido.
5. Com `regiao:"us-east-1"`, a nuvem é recusada com motivo `regiao`. Com `azure` sem aprovação, motivo `azure_sem_aprovacao`; com aprovação, `nao_implementado`. Nos dois casos fica o local.
6. Limiar `adulto:80` no arquivo vira 90 no `/status`, com aviso na saída do agente.

**Bloqueantes**
7. `POST /rostos/buscar` com a nuvem ok não gera nenhuma linha no log do falso.
8. Publicar 5 galerias de sessão e 1 grupo sem aceite gera 0 `IndexFaces`. Um grupo com aceite e 3 fotos gera 1 `CreateCollection` com nome `^et-maracana-ev-[0-9a-f]{16}$` e 3 `IndexFaces`, com `external_id` igual aos pids hex. O token não aparece em nenhum campo do log.
9. Galeria de sessão com o local desligado e a selfie com identidade A: abre, com no máximo 5 `CompareFaces` com `limiar==95` e 0 `IndexFaces`. Em nenhum arquivo do HOME aparece o base64 da selfie nem `data:image`.
10. Uma galeria com 12 fotos gera no máximo 5 `CompareFaces` por tentativa, e para no primeiro acerto. Na fase B, as 5 são as de maior `larg`.
11. Fase B (OpenCV): local ≥ 0,45 abre com 0 chamadas de nuvem. Local < 0,38 dá `nao_encontrado` com 0 chamadas.
12. `versao:"2026-10-27"` dá 400 `consentimento_desatualizado`. `nuvem:false` no corpo com a nuvem ok dá 0 chamadas de nuvem.
13. `/info` traz `nuvem:true` numa sessão com a nuvem ok, `false` num grupo sem aceite e `false` com a nuvem recusada.
14. Semelhança 94 não abre a sessão de adulto e 96 abre. No grupo, 97 não entra e 98,5 entra. Só aparecem as fotos em que a criança bateu.
15. O `ExternalImageId` que o falso devolver fora do manifesto não aparece na galeria.

**Fila, idempotência e limpeza**
16. `Throttling` 2× em `IndexFaces` conclui na 3ª tentativa. `tentativas==3`, e cada pid tem um único conjunto de faces na coleção falsa.
17. `timeout_apos_enviar` em `IndexFaces:<pid>` deixa a op `incerto`. Depois da reconciliação, a op fica `feito`, com exatamente as faces de uma indexação para aquele pid.
18. Matar o agente (SIGKILL) com 3 ops pendentes e subir de novo: as 3 concluem, nenhuma se perde e nenhuma se duplica.
19. Encerrar o grupo leva a `DeleteCollection` em até 60 s. `rosto_nuvem` fica sem esse escopo e `nuvem_escopo.estado=="apagado"`.
20. Com o relógio adiantado 61 dias, `/rostos/limpar` apaga a coleção. Uma coleção órfã `et-maracana-ev-…` criada direto no falso é apagada, com `nuvem.alerta` preenchido. `et-outro-ev-…` não é tocada.
21. Com `teto_diario:10`, depois de 10 chamadas a busca não chama a nuvem e `estado=="teto"`. Uma exclusão ainda roda.
22. Com opt-out recusado e uma coleção existente, encerrar o grupo ainda gera `DeleteCollection`.

**Titular**
23. Adulto: `POST /g/<t>/apagar` dá 200. `/info` dá 410, as linhas `rosto` dos pids da sessão ficam em 0 e `foto.n==-1`. Depois de reiniciar, esses pids não são lidos de novo. `exclusoes.jsonl` tem a linha sem o token inteiro e sem IP.
24. Criança em grupo: `DeleteFaces` só com os FaceIds dela, e outra criança continua sendo encontrada. Ao editar o grupo, só os pids novos são indexados.
25. "Estas fotos não são minhas": o acesso dá 401 em `/galeria`. No 2º aviso, `/rosto` dá 423. `/galerias/liberar` volta ao normal.
26. `sem_rosto`: a sessão `menor` abre por `/abrir` sem selfie. Publicar `sem_rosto` numa sessão sem `menor`, ou num evento, dá 400.

**Status, segredo e assinatura**
27. O corpo de `/status` não casa com `arn:`, `\b\d{12}\b`, `AKIA`, `ASIA` nem `et-`. A saída do agente não tem `AKIA`, `ASIA`, segredo nem base64 de imagem.
28. `sigv4` com o vetor da documentação da AWS (`AKIDEXAMPLE`, `20150830T123600Z`, `iam`, `us-east-1`, `GET /?Action=ListUsers&Version=2010-05-08`) devolve a assinatura publicada `5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7`. O testador confere esse valor na página da AWS.
29. Uma selfie JPEG com APP1 (EXIF/GPS) chega ao falso com `exif:false`.

**Retenção**
30. Uma foto numa pasta de 70 dias atrás não é lida no boot. Uma foto de 10 dias fora de galeria perde as linhas `rosto` na manutenção e mantém `foto`. Publicada depois, é lida de novo.

**App**
31. A galeria mostra o texto `*N` certo para cada caso (sessão, menor, evento com aceite) e o texto local quando `nuvem:false`. Nas 5 línguas os textos `*N` contêm "AWS" e "60", sem chave crua, e cabem em 390, 768 e 1366 px.
32. Os links "Estas fotos não são minhas" e "Apagar meus dados de rosto" funcionam no modo agente e no modo SIM, nas 5 línguas.
33. Grupos: marcar "Busca na nuvem" sem a referência mostra o toast e não salva. Com a referência, o manifesto tem `nuvem.aceite` e o `por`. Desmarcar e salvar gera `apagar_escopo`.
34. Configurações › Repositório mostra o cartão com provedor, estado, opt-out, fila e último erro, sem nenhum `input`. Os Alertas mostram "nuvem recusada" e "fila com erro" quando for o caso.
35. Treino da IA › Medir em AWS com um grupo com aceite gera só `SearchFaces` nessa coleção, 0 `IndexFaces`, e mostra a curva.
36. `bash testes/rodar.sh` termina com `FALHAS: 0`. `permissoes.js` cobra `gal-ind`, `gal-excluir-ok` e `gal-liberar` no `MODULE_INFO`.

## Riscos de segurança e escala (para o revisor)
1. **Chave base de longa duração no `rostos.json`** (modo `assumir_papel`). Ela só assume um papel restrito a `et-<cliente>-*` em sa-east-1, mas quem tiver o arquivo do computador do ponto consegue CompareFaces e SearchFaces enquanto ela valer. Mitigação: chmod 600 conferido, rodízio a cada 90 dias, CloudTrail e Budgets. O definitivo é o Roles Anywhere (`processo`).
2. **`credential_process` executa um comando do arquivo.** Exigir caminho absoluto, `shell=False`, timeout e arquivo chmod 600 do próprio usuário. Revisar que nada do corpo HTTP chega a esse caminho.
3. **Opt-out mudado depois da conferência.** É reconferido a cada 24 h. Entre uma conferência e outra existe uma janela; o SCP e o CloudTrail cobrem.
4. **Custo e abuso pela galeria pública:**
   - K ≤ 5, nuvem só na faixa "talvez" ou com o local fora;
   - limites da v77 (5 falhas por `(ip,token)`, 10 por minuto por IP), semáforo de 4 e teto diário;
   - o revisor deve tentar estourar o teto com muitos tokens.
5. **Rosto recortado da vitrine em grupo de escola** (IMPORTANTE 1 da v77). O Rekognition não resolve: seguem os limites de 2 crianças por IP e 60 por hora. O código individual (D12) é a saída para quem não quer biometria. O PIN por criança como segundo fator continua sendo decisão do Eduardo.
6. **Falso positivo de adulto abre a sessão inteira** (D2 da v77). O limiar 95 e o local primeiro reduzem, e o "não sou eu" leva a revisão. Calibrar antes de ligar em produção.
7. **`sem_rosto` é um link sem segundo fator.** Token de 128 bits e código de 8 caracteres com 30 por minuto por IP. Gerar só sob pedido e só para sessão individual ou da família.
8. **Provedor falso em produção abriria qualquer galeria.** Ele só existe com `ETERNA_TESTE=1`. O revisor deve conferir que nenhuma outra variável liga o falso ou um endpoint alternativo (SSRF).
9. **Vazamento por `/status`, que é público na rede na v80.** Critério 27. As mensagens de erro da AWS podem conter ARN: guardar só o `codigo`.
10. **Exclusão parcial:** a nuvem falha depois que o local já foi apagado. `pendente_nuvem` mais fila persistente mais reconciliação diária. Se a fila chegar a `erro`, alerta `bad` até a equipe agir. O original continua no inbox (pendência do DPO).
11. **Banco local perdido:** a reconciliação apaga as coleções órfãs, e as que ainda valem são recriadas a partir dos manifestos com aceite. Revisar que nada é recriado sem `nuvem.aceite`.
12. **Escala:**
    - **1 venue:** cerca de 3.000 fotos por dia, 0 indexadas fora das escolas, cerca de 1.500 `IndexFaces` em dia com 5 escolas, poucos US$ por dia;
    - **100 venues:** um agente, um papel e um prefixo por cliente; cotas de TPS do Rekognition são por conta e região, então pedir aumento ou usar uma conta por cliente na Organization (melhor isolamento);
    - `ListCollections` paginado; o limite por coleção (milhões de rostos) não preocupa.
13. **Internet caída:** o Checkout e a galeria seguem no local; as escolas com aceite caem para o local (0,50, comportamento da v77); a fila espera; o opt-out fica `recusado` (falha fechada) até a rede voltar.
14. **Relógio do computador errado** quebra o SigV4 (`relogio` no `/status`). Também afeta a validade das galerias.

**Para guardar na memória do projeto:**
- A v81 foi desenhada com o adaptador `ProvedorRostos` (local, rekognition, falso de teste, azure desligado), SigV4 em stdlib, opt-out conferido com falha fechada e fila persistente no `rostos.db`.
- Decisões assumidas nas pendências do Eduardo: código individual sem rosto só sob pedido (não para todas as crianças); retenção local de 7 dias para fotos fora de galeria e 60 para fotos em galeria.
- Limiares iniciais do Rekognition: adulto 95, menor 98, com pisos de 90 e 95.
- Bug achado: a retenção de 60 dias é furada a cada reinício do agente, porque as fotos antigas são lidas de novo. A correção está no item H.

Arquivos lidos: `/home/claude/eterna/docs/CONTEXTO-ETERNA.md`, `/home/claude/eterna/agente/eterna-agente.py`, `/home/claude/eterna/index.html`, `/home/claude/eterna/docs/planos/2026-10-28-v80-multiterminal.md`, `/home/claude/eterna/docs/planos/2026-10-27-galeria-qr-fase1.md`, `/home/claude/eterna/docs/planos/2026-10-27-galeria-qr-fase1-seguranca.md`, `/home/claude/eterna/docs/planos/2026-10-28-v79-checkout-caixa-ajuste.md` e `/home/claude/eterna/testes/galeria-agente.js`. Arquivo sugerido para o documentador: `/home/claude/eterna/docs/planos/2026-10-28-v81-rostos-provedor.md`.

## Decisões do Eduardo (28/10 11:08), substituem D12 e D13
- D12: escola só com QR geral do grupo. Sem código individual por criança ou família, nem sob pedido; o link "Prefiro não usar foto do rosto" e a rota `/g/<t>/abrir`/`sem_rosto` saem do escopo. Risco aceito pelo Eduardo: um responsável com o QR pode enviar o rosto de outra criança; seguem as mitigações (limiar de menor, limites por IP, "Estas fotos não são minhas" com revisão).
- D13: retenção local das leituras de rosto = 60 dias para todas as fotos, inclusive de quem não comprou (para o pós-venda da v82). `retencao_sem_galeria` sai; a correção do item H (não reler fotos com mais de 60 dias no boot) continua obrigatória.
