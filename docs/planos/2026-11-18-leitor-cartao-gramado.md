# Plano: leitor de cartão do gramado (envio automático para o servidor do estádio)

Base: `idiomas-base` em 4bd55f4. Plano aprovado pelo Eduardo em 18/11, com as quatro decisões pendentes confirmadas (ver "Decisões do Eduardo" no fim).

## Objetivo
O fotógrafo põe o cartão no computador Windows do gramado. As fotos que faltam no servidor sobem sozinhas e entram no Eterna como foto de cartão. Uma janela avisa quando ele já pode tirar o cartão. Se a rede cair, nada se perde e nada é enviado duas vezes.

## Escopo desta entrega
- Programa novo `agente/eterna-leitor.py`, só com a biblioteca padrão do Python. O alvo principal é o Windows. No Mac roda pelo Terminal.
- Instalador para Windows `servidor/leitor/instalar-leitor.cmd`, rodado uma vez pelo Ronaldo em cada computador.
- No agente: cadastro de leitor com token por aparelho, quatro rotas do leitor, três rotas de gestão e o tipo `leitor` no `autoriza`.
- No app: painel "Leitores de cartão" em Painel de controle › Avançado, uma linha de situação em Minhas fotos e os textos nos 5 idiomas.
- Testes automatizados e a lista do que só dá para testar no estádio.

## Fora do escopo
- Atualização automática do programa do leitor. Nesta entrega o painel só mostra a versão, e reinstalar é com o Ronaldo.
- Executável `.exe` e assinatura de código.
- Proteger o token com DPAPI do Windows (fica para uma próxima versão).
- Mostrar "via Leitor X" na foto em Minhas fotos. O dado vai gravado (`ap`), mas não aparece na tela.
- Arquivo RAW e vídeo: só JPEG, como no FTP e no envio manual.

## Decisões assumidas
Marquei (E) as que o Eduardo confirma e (R) as do Ronaldo.

1. **Python + script, sem executável (E/R).** No Windows o Ronaldo instala o Python 3.12 da python.org (`winget install -e --id Python.Python.3.12 --scope machine`), que já traz o Tk da janela. Motivos:
   - Um arquivo só serve para o Windows e para o Mac.
   - Dá para testar em `testes/` como os outros.
   - O hash é o mesmo do agente (`quick_hash`).
   - Um `.exe` feito com PyInstaller seria binário sem assinatura num repositório público. O SmartScreen e o antivírus costumam barrar, e cada mudança exigiria compilar de novo.

   O PowerShell não precisaria de instalação, mas não roda nos testes do Mac nem do Linux e duplicaria o código para o Mac.

   **Quem instala: o Ronaldo**, porque precisa de administrador para o Python, a pasta em `C:\Program Files` e a tarefa agendada. A instalação do Python precisa de internet uma vez. Sem internet, ele leva o instalador da python.org num pendrive.
2. **Rota nova, sem reaproveitar `/fotos/enviar`.** `/fotos/enviar` exige posto, pessoa conectada e um `quem` escolhido por alguém. Pôr o token de aparelho lá alargaria uma rota de pessoa. As duas rotas passam a dividir só a parte interna de receber o corpo.
3. **Token por aparelho, criado pelo Admin na tela** (Configurações, Alterar):
   - A tela gera um código de ativação de uso único, válido por 10 minutos, igual ao `posto_convite`.
   - O instalador pede esse código e troca pelo token de 256 bits.
   - O token nunca aparece na tela. No banco fica só o SHA-256 dele.
4. **"Pode tirar o cartão" quando a cópia local termina (E).** Não espera o envio ao servidor. O fotógrafo não fica preso à rede, e o envio continua da fila.
5. **Antes de copiar, o leitor pergunta ao servidor quais fotos já chegaram** (`/leitor/tem`, pelo `quick_hash`). O cartão é a redundância: na maior parte das vezes o Wi-Fi e o 5G já entregaram quase tudo, e assim só o que falta é copiado e enviado. Sem rede, copia tudo.
6. **De quem é a foto: a mesma regra de hoje (E).**
   - A origem `o` é o rótulo do volume do cartão, como faz o `scan_card`.
   - O dono sai do `ff_quem_como`: primeiro o rótulo, se for um cadastrado com o nome inteiro; depois o autor ou o dono gravados na câmera.
   - Sem identificação, a foto fica sem fotógrafo, com a fonte "câmera ···1234" ou "cartão", exatamente como no cartão lido no servidor. O `sess_dono_corrigir` continua valendo.
   - O tipo é `s="cartao"`, e o aparelho vai num campo novo `ap` com o nome do leitor.
7. **Só aceita da rede interna e da VPN.** O IP precisa estar em `ETERNA_LEITOR_REDES`; vazia, vale `ETERNA_POSTO_REDE` (192.168.10.0/24). A VPN chega como 192.168.10.1 (NAT do FortiGate), então já está dentro. As rotas do leitor só aceitam pedido que passou pelo proxy com certificado (`posto.eterna.photo`, `X-Forwarded-Proto: https`). A única exceção é o próprio servidor em pedido direto, sem os cabeçalhos do proxy (é como os testes falam com o agente).
8. **Início automático (R).** A tarefa agendada "Eterna leitor" roda ao entrar no Windows, com o usuário do gramado, sem administrador, e religa a cada 1 minuto se cair. Para ligar sem ninguém digitar senha, o Ronaldo configura o logon automático desse usuário. A janela precisa da sessão do usuário, por isso não roda como serviço.
9. **Só unidade removível (E).** No Windows vale `GetDriveTypeW == DRIVE_REMOVABLE` com pasta `DCIM`. HD externo com `DCIM` é ignorado, para um backup não inundar o servidor.
10. **O leitor só fala com um servidor.** Usa `https://posto.eterna.photo` com o certificado conferido. A conexão vai direto ao IP fixo `192.168.10.10`, e o leitor recusa IP público na configuração. Funciona sem DNS da internet, como o `--host-resolver-rules` do posto.
11. **Teto do dia.** Os leitores têm teto do dia próprio (`ETERNA_LEITOR_TETO_DIA`, padrão 20.000 fotos novas, somando todos os leitores), separado do envio manual. Repetida não conta.

## Mudanças por arquivo

### `agente/eterna-leitor.py` (novo, biblioteca padrão)
- **Pasta de dados:**
  - Windows: `C:\ProgramData\Eterna\leitor\` (o instalador deixa a pasta só para o usuário, Administradores e SYSTEM).
  - Mac: `~/Library/Application Support/Eterna/leitor/` (700).
  - `ETERNA_LEITOR_DADOS` troca a pasta, só nos testes.
  - Arquivos: `leitor.json` (servidor, ip, id, nome, token; 600 no Mac), `fila.db` (sqlite em WAL), `fila\<hash>.jpg`, `estado.json`, `leitor.log` (1 MB × 3).
- **`quick_hash(path, size)`:** cópia exata do agente. O teste importa os dois e compara.
- **`cartoes()`:**
  - Windows: `ctypes` com `GetLogicalDrives`, `GetDriveTypeW` (só 2, removível), `<X>:\DCIM` e `GetVolumeInformationW` (rótulo e número de série).
  - Mac: `/Volumes/*/DCIM`.
  - `ETERNA_LEITOR_VOLUMES` só vale com `ETERNA_LEITOR_TESTE=1`.
  - O rótulo é limpo para `^[A-Za-z0-9 _-]{1,32}$`; fora disso vira `cartao`.
- **`cartao_ler(raiz, rotulo)`:** percorre `DCIM` com o mesmo filtro do `scan_card` (`EXT`, ignora `._*` e arquivo mexido há menos de 2 s).
  1. Calcula o `quick_hash` de cada foto e pula o que a `fila.db` já tem.
  2. Pergunta `/leitor/tem` em lotes de 500.
  3. Copia o que falta para `fila\<h>.tmp`, calculando o SHA-256 inteiro durante a cópia, e depois renomeia para `.jpg` com `os.replace`.
  4. Grava a linha `copiada`.
  - O cartão só é aberto com `open(..., "rb")` e nunca é escrito, renomeado ou apagado.
  - Cartão tirado no meio: estado `erro`, mensagem "coloque de novo", e ao recolocar continua de onde parou.
  - Disco sem espaço: para de copiar e mostra "Não tire o cartão". O limite é `fila_max_gb`, padrão 50, com pelo menos 5 GB livres.
- **`fila.db`:**
  - `foto(h PK, sha, tam, nome, rotulo, cartao, estado copiada|enviada|recusada, tentativas, erro, em)`.
  - `cartao(id, rotulo, serial, inserido, lido, total, copiadas, ja_tinha, enviadas, sem_dono)`.
  - Linhas `enviada` ficam 30 dias, só com o hash, para não reenviar.
- **`enviar_loop()`:** 2 envios ao mesmo tempo, `POST /leitor/foto`, na ordem cartão → nome.
  - Respostas `new` ou `dup`: apaga o arquivo local na hora e marca `enviada`.
  - 400 (fora `incompleta`), 413 e 415: marca `recusada` e apaga a cópia local. O original continua no cartão.
  - 401: para tudo e mostra "Leitor desativado no Eterna". A fila fica no disco e é apagada sozinha depois de 7 dias desativado (registro no log local).
  - 429 e 503 (servidor ocupado): espera curta, de 5 a 15 s, sem crescer e sem o aviso "Sem conexão".
  - Rede, 408, 507 e 5xx: espera crescente de 5 s até 5 min, sem limite de tentativas.
- **`fila_retomar()` na partida:**
  - Arquivo `.jpg` sem linha: recalcula o hash e entra na fila.
  - Linha `copiada` sem arquivo: apaga a linha, e a foto volta na próxima leitura do cartão.
  - Apaga os `.tmp`.
- **`pulso_loop()`:** `POST /leitor/pulso` a cada 30 s e logo depois de cada mudança de estado.
- **`janela()`:** Tk pequena, sempre visível, com texto grande e cor por estado: cinza "Coloque o cartão", azul "Lendo…", verde "Pode tirar o cartão", amarelo "Sem conexão: as fotos ficam guardadas aqui", vermelho "Não tire o cartão". Toca `winsound.MessageBeep` ao ficar pronto. Sem Tk ou com `--sem-janela`, escreve no console. No Mac o padrão é o console.
- **Textos da janela:** dicionário próprio em pt, en, es, fr, de, escolhido pelo idioma do Windows (`GetUserDefaultUILanguage`), com pt como padrão.
- **Comandos:**
  - `--ativar CODIGO [--servidor https://posto.eterna.photo --ip 192.168.10.10]`
  - `--testar` (manda um pulso e diz o resultado em palavras)
  - `--apagar-fila` (pede confirmação)
  - `--sem-janela`
- **Uma cópia por vez:** a trava é um socket preso em 127.0.0.1:8766, sem servidor HTTP nessa porta.
- **`servidor_pedir()`:** `http.client.HTTPSConnection` com `connect` trocado. O socket vai para o `ip` e o TLS usa `server_hostname` = o host do servidor, com `ssl.create_default_context()`. O `ip` precisa ser privado, senão o leitor se recusa a abrir. Sempre envia `Authorization: Bearer`, `X-Eterna: 1` e `User-Agent: eterna-leitor/<versao>`, e nunca envia `Origin`.

### `servidor/leitor/instalar-leitor.cmd` (novo; no padrão do `preparar-posto-eterna.cmd`)
- Exige administrador.
- Procura o Python 3.10 ou mais novo. Se não achar, tenta `winget`; se o `winget` falhar, para com a instrução do pendrive.
- Copia o `.py` embutido para `C:\Program Files\Eterna Leitor\` (escrita só de administrador).
- Cria `C:\ProgramData\Eterna\leitor\` com a permissão do usuário que vai rodar (padrão: quem está logado no console; parâmetro `-Usuario`).
- Pede o código e roda `python -I ... --ativar`, depois `--testar`.
- Registra a tarefa: `AtLogOn` do usuário, `RunLevel Limited`, `pythonw.exe -I`, `RestartCount 999`/1 min, sem limite de tempo, liga na bateria, `IgnoreNew`. Os ajustes seguem o `instalar-tarefa.ps1`.
- Desliga a Reprodução Automática de cartão de memória ("Nenhuma ação") pelo registro, para o app Fotos do Windows não oferecer "apagar depois de importar".
- `servidor/leitor/montar-instalar-leitor.ps1` regera a cópia embutida do `.py`, como no `montar-preparar-posto.ps1`.

### `agente/eterna-agente.py`
- **`ingest_file(..., extra=None)`:** junta `extra` (`{"ap": nome do leitor, "api": id}`) ao `meta[pid]` e ao evento `photo`. Quem chama hoje não muda.
- **Banco:** tabelas no `auth_db`, criadas como as do `posto`:
  - `leitor(id, nome, hash, criado_por, criado_em, ativado_em, maquina, ultimo_contato, ip_ultimo, revogado_em)`
  - `leitor_convite(hash, leitor_id, expira, usado)`
- **Funções:**
  - `leitor_redes()`, `leitor_ip_ok(ip)`: loopback ou IP dentro das redes; mapeado IPv4 tratado como no `posto_auto_ok`.
  - `leitor_nome_ok(nome)`: o `posto_nome_ok`, e recusa nome que vira cadastrado ou apelido em `fotografo_chave(nome, True)`, ou que repete um leitor ativo.
  - `leitor_criar(nome, por, ip)` → `(id "l_"+hex8, codigo)`.
  - `leitor_codigo_novo(id, por, ip)`.
  - `leitor_ativar(codigo, maquina, ip)` → token. Gasta o código e troca o hash; ativar de novo derruba o token anterior.
  - `leitor_quem(token)` → `{id, nome}` ou None. Grava `ultimo_contato` no máximo 1 vez por minuto.
  - `leitor_revogar(id, por, ip)`.
  - `leitor_lista(completa)`.
  - Toda criação, ativação, novo código e revogação vão para o `auth_log`.
- **Situação dos leitores:** `leitores_pulso` em memória (`{id: dict}`) e `leitor_pulso_valida(body)` com formato fechado.
- **`ROTAS`:**
  - `("POST","/leitor/ativar","publica",())`: a rota confere Host, rede, ausência de `Origin`, `X-Eterna` e limite.
  - `("POST","/leitor/pulso","leitor",())`, `("POST","/leitor/tem","leitor",())`, `("POST","/leitor/foto","leitor",())`.
  - `("GET","/leitores","sessao",("configuracao.r","set.r"))`.
  - `("POST","/leitores/criar"|"/leitores/codigo"|"/leitores/revogar","sessao",("configuracao.u",))`.
  - O `rota_privada` passa a incluir `/leitor/` e `/leitores`.
  - Uma rota `GET /instalar-leitor` pública, servindo `servidor/leitor/instalar-leitor.cmd` da cópia local do repositório (sem internet), com `no-store`.
- **`H.autoriza`, ramo novo `tipo == "leitor"`:**
  1. `host_ok`
  2. sem `Origin` (403 `origem`)
  3. `X-Eterna: 1`
  4. `leitor_ip_ok(client_address)` (403 `rede`)
  5. `Bearer` válido (401 `sem_leitor`)
  - Grava `self._leitor`. Um cookie de sessão ou de posto não serve nessas rotas.
- **`_foto_corpo_receber(self, n, vaga, ...)`:** sai de dentro do `fotos_enviar_post`. Faz piso de disco, teto do dia, as vagas (as do envio manual, ou as próprias dos leitores: `ETERNA_LEITOR_VAGAS`, padrão 2), a vaga por chave (IP no envio manual, `"leitor:"+id` no leitor), o prazo de 120 s, o temporário e o `jpeg_envio_erro`. O `fotos_enviar_post` continua igual por fora; o teste existente cobra isso.
- **`leitor_foto_post`:**
  - Exige `Content-Type: image/jpeg`, `Content-Length` até `FOTO_ENVIO_MAX`, `nome` terminado em `EXT`, `rotulo` dentro do formato, `X-Eterna-Hash` e `X-Eterna-Sha256` com 64 caracteres hexadecimais.
  - Limite de 300 por minuto por leitor (`limite_ok("leitor:"+id, ...)`) e 2 vagas por leitor.
  - Recalcula o `quick_hash` e o SHA-256 do temporário. Diferente: 400 `hash`.
  - Grava com `ingest_file(tmp, envio_nome(nome), st, rotulo, "cartao", move=True, quieto=True, extra={...})`.
  - Foto que o servidor já tratou, repetida ou apagada pela LGPD, responde `dup` com `dono: false`.
  - `dono` = `ff_quem(...)[0] is not None`.
  - Conta em `state["leitor"]` (novas, repetidas, recusadas).
- **`leitor_tem_post`:** corpo até 64 KB, até 500 hashes válidos, 60 por minuto por leitor. Responde o que está em `seen` ou em `lgpd_excluidas`, sem dizer qual dos dois.
- **`leitor_pulso_post`:** corpo até 4 KB, 6 por minuto por leitor, valida e guarda em memória.
- **`leitor_ativar_post`:** 10 por minuto por IP. Depois de 20 códigos errados em 1 hora no total, a ativação fica parada por 15 minutos. O limite fica dentro da própria rota.
- **`leitores_get`:**
  - Situação: `ligado` (pulso há menos de 90 s), `desligado`, `aguardando` (nunca ativado) ou `revogado`.
  - Com só `set.r`, a resposta vem reduzida (sem IP, máquina, quem criou e versão) e sem revogados.
- **`leitores_post`:** criar, novo código e revogar.

### `index.html`
- **`leitoresPoll(force)`:** de 10 em 10 s, só nas telas `catalogo` e `importar`. Grava em `state.leitores = {lista, codigo:{id, codigo, expira}|null, criando}`. O código fica só na memória e some em 10 minutos ou ao trocar de tela.
- **`leitoresPanel()`:** dentro de `tab==='avancado'`, depois do `postosPanel()`, com `configuracao.r`.
  - Tabela: nome, situação (pílula em palavras), último cartão (rótulo, hora, "lendo 120 de 340", "pronto", "N já estavam", "N sem fotógrafo"), fila (N fotos, MB), erro em palavras e versão.
  - Com `configuracao.u`: campo de nome + "Cadastrar leitor", e por linha "Novo código" e "Desativar" (com confirmação).
  - Caixa do código com "Copiar", a validade e o link `/instalar-leitor`.
- **`leitoresFaixa()`:** no `upFaixa` de Minhas fotos, com `set.r` e pelo menos um leitor ativo. Uma linha por leitor: "Leitor Gramado 1: ligado · 34 fotos na fila". Em amarelo quando está desligado ou com a fila parada há mais de 10 minutos.
- **`data-act`:**
  - `leitor-criar`, `leitor-codigo`, `leitor-revogar`, `leitor-revogar-sim`, `leitor-copiar`
  - os quatro primeiros entram em `WRITE_OPS` como `configuracao` `u` e em `ACT_MOD`
  - `auditLog('leitor_criado'|'leitor_codigo'|'leitor_revogado', {nome})`, sem código e sem token
- **Chaves novas no `EQ`** (tela da equipe, pt, en, es, fr, de, pelo `TE`):
  - Painel: `lt_eb`, `lt_h`, `lt_nota`, `lt_nome`, `lt_nome_ph`, `lt_criar`, `lt_criando`, `lt_nome_ruim`.
  - Código: `lt_codigo_t`, `lt_codigo_nota`, `lt_copiar`, `lt_copiado`, `lt_novo_codigo`, `lt_instalador`.
  - Desativar: `lt_revogar`, `lt_revogar_ask`, `lt_revogado_t`.
  - Situação: `lt_ligado`, `lt_desligado(desde)`, `lt_aguardando`, `lt_revogado`.
  - Cartão: `lt_ult_cartao`, `lt_lendo(n,total)`, `lt_pronto`, `lt_ja_tinha(n)`, `lt_sem_dono(n)`.
  - Fila: `lt_fila(n,mb)`, `lt_fila_vazia`, `lt_parado`, `lt_nenhum`, `lt_faixa(nome,sit,n)`.
  - Erros: `lt_err_disco`, `lt_err_rede`, `lt_err_certificado`, `lt_err_recusado`, `lt_err_cartao`.
  - Não entra em `I18N` nem em `I18N_ZH`: não é tela de cliente.

### Documentação
- Plano em `docs/planos/2026-11-18-leitor-cartao-gramado.md`.
- `docs/CONTEXTO-ETERNA.md`: um item na seção 4.
- `docs/GUIA-DA-EQUIPE.md`: como usar o leitor e o que significa cada cor.
- `docs/SERVIDOR-ESTADIO.md`: seção "Leitor de cartão do gramado", com os passos do Ronaldo.
- `testes/rodar.sh`: dois testes novos de agente.

## Contratos
Todas as rotas `/leitor/*` exigem HTTPS por `posto.eterna.photo`, `X-Eterna: 1` e nenhum `Origin`.

- **`POST /leitor/ativar`**
  - Corpo: `{"codigo":"<16 a 32 car>","maquina":"<até 40>"}`
  - Sucesso: 200 `{"id":"l_…","nome":"Gramado 1","token":"<43 car>"}`
  - Erros: 404 `{"erro":"codigo"}` (inválido, vencido ou usado: a mesma resposta), 403 `rede`/`origem`, 429 `taxa`.
- **`POST /leitor/pulso`**
  - Corpo: `{"v":1,"versao":"2026-11-18","maquina":"GRAMADO-1","livre_gb":120,"fila":{"n":34,"mb":510},"cartao":{"rotulo":"EOS_DIGITAL","estado":"sem|lendo|pronto|erro","total":340,"copiadas":40,"ja_tinha":300,"enviadas":6,"sem_dono":0,"em":1763480000},"erro":null|"disco"|"rede"|"certificado"|"recusado"|"cartao"}`
  - Sucesso: `{"ok":true,"agora":<epoch>}`
  - Campo desconhecido ou fora do formato: 400 `campo`.
- **`POST /leitor/tem`**
  - Corpo: `{"h":["<64 hex>", …≤500]}`
  - Resposta: `{"tem":[…]}`
- **`POST /leitor/foto?nome=IMG_0001.JPG&rotulo=EOS_DIGITAL`**
  - Corpo: o JPEG. Cabeçalhos `Content-Type: image/jpeg`, `Content-Length`, `X-Eterna-Hash`, `X-Eterna-Sha256`.
  - Sucesso: 200 `{"ok":true,"resultado":"new|dup","dono":true|false}` (`dono` só vale em `new`)
  - Erros:

    | Código | `erro` |
    |---|---|
    | 400 | `hash`, `incompleta`, `tamanho`, `rotulo` |
    | 401 | `sem_leitor` |
    | 403 | `rede`, `origem` |
    | 408 | `lenta` |
    | 411 | (sem tamanho) |
    | 413 | (grande demais) |
    | 415 | `formato`, `nao_jpeg` |
    | 429 | `taxa`, `teto_dia` |
    | 503 | `ocupado` |
    | 507 | `disco` |
    | 500 | `servidor` |
- **`GET /leitores`**
  - Resposta: `{"leitores":[{"id","nome","situacao","ultimo_contato","cartao":{…},"fila":{…},"erro","versao","livre_gb","maquina","ip_ultimo","criado_por","criado_em"}]}`
  - Com só `set.r`: `nome`, `situacao`, `ultimo_contato`, `cartao.{rotulo,estado,em,total,copiadas}`, `fila.n` e `erro`.
- **`POST /leitores/criar`:** `{"nome"}` → `{"leitor":{"id","nome"},"codigo","expira"}`
- **`POST /leitores/codigo`:** `{"id"}` → `{"codigo","expira"}`
- **`POST /leitores/revogar`:** `{"id"}` → `{"ok":true}`
- **Variável nova:** `ETERNA_LEITOR_REDES` (faixas separadas por vírgula; vazia = `ETERNA_POSTO_REDE`).
- **Configuração do leitor:** `leitor.json`, com `fila_max_gb` (padrão 50) e `livre_min_gb` (padrão 5).

## Critérios de aceite
1. `python3 -m py_compile agente/eterna-leitor.py` passa, e o arquivo só importa a biblioteca padrão (o teste lista os imports).
2. O `quick_hash` do leitor e o do agente dão o mesmo resultado em 5 arquivos de tamanhos diferentes, de 1 KB a 5 MB.
3. Cadastrar um leitor com `configuracao.u` devolve um código. Sem `configuracao.u`, a resposta é 403.
4. Nome que é cadastrado ou apelido (ex.: "Carlos", "Klacius") ou que repete um leitor ativo é recusado.
5. O código ativa uma vez. A segunda tentativa, ou depois de 10 minutos, dá 404 `codigo`. No banco só existe o SHA-256 do token, e o token não aparece em nenhuma linha do console nem do `auth_log`.
6. `/leitor/foto` sem token ou com token errado dá 401. Com `Origin` dá 403 `origem`. Sem `X-Eterna` dá 403.
7. Pedido com IP fora de `ETERNA_LEITOR_REDES` dá 403 `rede`. O teste usa `ETERNA_PROXY_IP=127.0.0.1` e `X-Real-IP` de fora. IP 192.168.10.1 (VPN) é aceito com o padrão.
8. Cookie de sessão de Admin ou de posto, sem token, não abre nenhuma rota `/leitor/*`.
9. Uma foto nova entra na biblioteca com `s:"cartao"`, `o` = rótulo e `ap` = nome do leitor. Ela aparece em `/events` e em `/sessoes` como foto de cartão.
10. A mesma foto enviada de novo responde `dup` e não cria pid novo. Foto apagada pela LGPD responde igual (`dup`, `dono: false`) e não volta.
11. `X-Eterna-Sha256` diferente do corpo dá 400 `hash`, e nada entra.
12. Corpo que não é JPEG dá 415. Acima de 60 MB dá 413 antes de ler o corpo. A mais de 300 por minuto, o mesmo leitor recebe 429.
13. `/leitor/tem` devolve só os hashes que o servidor já tem. Com mais de 500 hashes ou hash fora do formato, dá 400.
14. Depois da revogação, o próximo pedido do leitor dá 401. O programa para de enviar, mostra "Leitor desativado" e não apaga a fila.
15. O leitor lê um cartão de teste com 20 fotos, das quais 12 o servidor já tem. Copia só 8, envia só 8, e depois de cada confirmação o `fila\` fica sem o arquivo.
16. O estado `pronto` ("Pode tirar o cartão") aparece em `estado.json` e no pulso antes de terminar o envio, com o servidor lento.
17. A árvore do cartão de teste fica idêntica antes e depois: mesmos nomes, tamanhos, SHA-256 e datas. O teste roda com o cartão sem permissão de escrita.
18. Com o agente parado, o leitor copia tudo para a fila, mostra "Sem conexão…" e, quando o agente volta, envia sem ninguém fazer nada.
19. Ao matar o leitor no meio do envio e abrir de novo, ele retoma a fila. No fim, cada foto entrou uma vez só: as linhas `new` das métricas do servidor = fotos distintas.
20. Ao recolocar o mesmo cartão já enviado, nenhuma foto é enviada (nenhum pedido `/leitor/foto`).
21. Tirar o cartão no meio da cópia gera o estado `erro`, sem `.tmp` sobrando, e ao recolocar completa sem duplicar.
22. Com a fila acima de `fila_max_gb` ou o disco abaixo de `livre_min_gb`, a cópia para, o estado diz "Não tire o cartão" e nada é apagado.
23. Uma segunda cópia do programa aberta ao mesmo tempo sai na hora com aviso.
24. O leitor recusa `--ip` público e servidor fora de `https://`, e não abre conexão com nenhum outro endereço.
25. O painel "Leitores de cartão" aparece em Painel de controle › Avançado para quem tem `configuracao.r`. Os botões só aparecem com `configuracao.u`.
26. A situação muda de "Ligado" para "Desligado" até 90 s depois do último pulso.
27. Minhas fotos mostra a linha do leitor para o Fotógrafo (`set.r`), sem IP, máquina nem versão. A resposta de `/leitores` para ele não traz esses campos.
28. Todas as chaves `lt_*` existem nas 5 línguas e nenhuma tela mostra a chave crua. `testes/todas-as-telas.js` e `testes/permissoes.js` passam.
29. `testes/seguranca_rotas_agente.py` passa com as rotas novas (o tipo `leitor` precisa entrar na matriz).
30. `testes/envio_manual_agente.py` continua passando depois de separar o `_foto_corpo_receber`.
31. A cópia do `.py` embutida no `instalar-leitor.cmd` é idêntica a `agente/eterna-leitor.py`.
32. `bash testes/rodar.sh` termina com `FALHAS: 0`.

**Testes novos:**
- `testes/leitor_agente.py`: critérios 3 a 14, com o agente de verdade, `HOME` temporário, portas 45xxx, `ETERNA_SEM_OPENCV=1`, JPEG gerado na hora e sessão por `_agente_sessao.py`.
- `testes/leitor_programa.py`: critérios 1, 2, 15 a 24 e 31. Roda o agente e o leitor em processos, com `ETERNA_LEITOR_TESTE=1`, `ETERNA_LEITOR_VOLUMES` e `ETERNA_LEITOR_DADOS`, `--sem-janela`, e um servidor HTTPS de teste com certificado próprio passado por `ETERNA_LEITOR_CA` (só com a variável de teste ligada).
- `testes/leitores.js`: critérios 25 a 28, com `/leitores` simulado.
- A função de unidades do Windows é testada com `GetDriveTypeW` e `GetLogicalDrives` trocados no módulo.

**Só no estádio** (lista no plano, para o Ronaldo marcar):
- [ ] Leitor SD/CFexpress real no Windows aparece como removível.
- [ ] O certificado do Let's Encrypt é aceito pelo repositório de certificados do Windows sem internet.
- [ ] A janela e o som funcionam com logon automático.
- [ ] A Reprodução Automática fica desligada.
- [ ] O computador religa e o leitor volta sozinho.
- [ ] Cabo tirado no meio do envio e depois recolocado.
- [ ] Dois leitores ao mesmo tempo.
- [ ] Cartão de 1.000 fotos: tempo de leitura e de envio.
- [ ] Mac do Eduardo pela VPN com `python3 agente/eterna-leitor.py --sem-janela` (permissão de "volumes removíveis" do Terminal).
- [ ] Gramado ligado por Wi-Fi ou por cabo.

## O que o Ronaldo faz
**No servidor:**
- Nada é obrigatório se os computadores do gramado estiverem em 192.168.10.0/24: o firewall já libera a 443 para essa faixa e o nginx já repassa o `X-Real-IP`.
- Se o gramado ficar em outra rede ou VLAN: gravar `ETERNA_LEITOR_REDES=<faixa>` no `nuvem.env`, liberar a 443 dessa faixa no ufw e reiniciar o `eterna`.
- Depois do deploy, conferir no Painel de controle que o painel aparece.

**Em cada computador do gramado** (administrador, uma vez):
1. Criar ou escolher um usuário local sem administrador e configurar o logon automático dele.
2. Desligar a suspensão do computador.
3. No Eterna, em Painel de controle › Avançado › Leitores de cartão, cadastrar "Gramado 1" e copiar o código.
4. Abrir `https://posto.eterna.photo/instalar-leitor` (ou levar o `.cmd` num pendrive), rodar como administrador e colar o código.
5. Testar com um cartão de verdade.
6. Para reinstalar: "Novo código" no painel.
7. Para tirar um computador de uso: "Desativar" no painel e depois `--apagar-fila` na máquina.

## Regras de funcionamento
- Rotas do leitor só da rede do ponto e da VPN, só pelo proxy com certificado (`X-Forwarded-Proto: https`), sem `Origin`, com `X-Eterna: 1` e o token do aparelho. Pedido direto ao agente (HTTP, porta 8765) é recusado, menos o do próprio servidor sem os cabeçalhos do proxy.
- Servidor ocupado ou teto do dia: o agente lê o corpo da foto até o fim antes de responder 503 ou 429, e o leitor trata os dois como "ocupado" (espera curta).
- Limites por leitor: 300 fotos por minuto, 2 gravações ao mesmo tempo, vagas e teto do dia próprios dos leitores, piso de disco e as conferências de JPEG do envio manual (`jpeg_envio_erro`, até 40 MP).
- Ativação: código de uso único, 10 minutos, 100 bits; a mesma resposta para inválido, vencido e usado; limite na própria rota.
- `/leitor/tem` só para leitor ativo; a resposta não diferencia foto repetida de foto apagada a pedido do cliente.
- O token fica na pasta de dados do leitor, com permissão restrita. O programa fica em `C:\Program Files` (escrita só de administrador). O log local não tem token nem nome de foto.
- A fila guarda fotos de clientes só até o servidor confirmar. O painel mostra o último tamanho da fila de cada leitor, também depois de reiniciar o agente e de desativar o leitor. Leitor desativado apaga a própria fila depois de 7 dias.
- Recomendação: BitLocker ligado no computador do gramado.
- O cartão nunca é escrito. A Reprodução Automática e a indexação de unidades removíveis ficam desligadas no computador do gramado.
- **Escala:** 1 venue com até 2 leitores, um pulso a cada 30 s cada um; 100 leitores num servidor dão cerca de 3,3 pulsos por segundo. As vagas dos leitores são uma variável própria (`ETERNA_LEITOR_VAGAS`). Cada venue tem o próprio servidor e os próprios tokens. O `/leitor/tem` evita reenviar o que o Wi-Fi e o FTP já entregaram.
- **Rede caída:** o cartão é copiado do mesmo jeito, o fotógrafo é liberado e a fila sobe com espera crescente. O teto local de 50 GB e o piso de 5 GB protegem o disco do gramado.

## Pendências de decisão
- **Eduardo:**
  - Confirmar a decisão 4 ("pode tirar" depois da cópia local e não depois do envio).
  - Confirmar a 6 (foto sem fotógrafo fica sem dono, como hoje).
  - Confirmar a 9 (só unidade removível).
  - Confirmar que o som ao terminar está ok.
- **Ronaldo:**
  - Faixa de rede do gramado.
  - Usuário com logon automático.
  - Instalar o Python por `winget` ou levar no pendrive.
  - Cabo ou Wi-Fi no gramado.


## Decisões do Eduardo (18/11)

1. "Pode tirar o cartão" aparece quando termina a cópia local, sem esperar o envio ao servidor.
2. Foto sem fotógrafo identificado fica sem dono, como hoje.
3. Só unidade removível.
4. Bip ao ficar pronto.

Os computadores do gramado são Windows; o Mac do Eduardo, pela VPN, é caso secundário.

**Mudança de regra no mesmo dia (Eduardo, 18/11):** em foto de cartão quem decide o fotógrafo é a câmera (autor, dono ou série); o rótulo do cartão só vale quando a câmera não identifica ninguém. Essa mudança é feita em `ff_quem_como`, noutro ramo. O leitor não tem regra própria: a rota `/leitor/foto` grava a origem = rótulo e o dono sai sempre do `ff_quem`, então a regra nova vale para o leitor assim que os ramos se juntarem. Onde este plano diz "primeiro o rótulo", vale a regra nova.

## Como ficou (entrega de 18/11, ramo `feat/leitor-cartao`)

Ajustes feitos na implementação, em relação ao texto acima:

- **Rede padrão:** `ETERNA_LEITOR_REDES`; vazia vale `ETERNA_POSTO_REDE`; sem as duas, `192.168.10.0/24`.
- **Código de ativação:** 20 letras e números em 5 grupos (`K7QM-2XRP-...`, 100 bits, sem 0/O e 1/I), para o Ronaldo poder digitar; espaços, hífens e minúsculas são aceitos.
- **Pulso:** a fila ganhou `parada_s` (segundos sem progresso com fila cheia), usado no aviso "fila parada há mais de 10 min". O leitor manda no máximo 1 pulso a cada 11 s (o servidor aceita 6 por minuto).
- **Painel:** as colunas Aviso e Versão viraram a segunda linha de Situação e de Leitor, para a tabela caber na tela.
- **Desativar:** tem o botão Cancelar (`leitor-revogar-nao`), sem gravação.
- **Leitor revogado:** para de ler cartão também (não só de enviar), para não juntar foto de cliente num computador que não envia mais.
- **Cartão tirado no meio:** ao recolocar, a mesma linha do cartão continua (os contadores seguem).
- **Variáveis só de teste do leitor** (valem só com `ETERNA_LEITOR_TESTE=1`): `ETERNA_LEITOR_DADOS`, `ETERNA_LEITOR_VOLUMES` (pastas-mãe dos volumes), `ETERNA_LEITOR_CA`, `ETERNA_LEITOR_TRAVA` (porta da trava), `ETERNA_LEITOR_ESPERA` (espera mínima e máxima) e `ETERNA_LEITOR_COPIA_ATRASO`.
- **Testes de disco:** os testes usam `ETERNA_RECORTES_PISO_GB` (piso do envio) e `livre_min_gb` no `leitor.json` do teste, porque o disco de teste pode ter menos de 5 GB livres.
- **Revisão de 18/11:** arquivo do cartão que não abre é pulado (conta em `puladas`, vai para o log e aparece no painel); só a pasta `DCIM` sumindo conta como "cartão saiu"; leitor desativado durante a leitura não copia nada e o cartão fica como não lido; 429 e 503 viram "servidor ocupado" (espera curta); vagas e teto do dia próprios dos leitores (`ETERNA_LEITOR_VAGAS`, `ETERNA_LEITOR_TETO_DIA`); resposta `dup` também para foto apagada pela LGPD; último tamanho da fila guardado no banco (`leitor.fila_n`, `fila_mb`, `fila_em`); fila apagada sozinha 7 dias depois de desativar (`revogado.json` na pasta de dados); o instalador põe Administradores como dono da pasta de dados e desliga a indexação de unidades removíveis.
- **Segunda revisão de 18/11:** o agente lê o corpo da foto até o fim antes de responder `ocupado`, `teto_dia` ou `taxa`, e o leitor lê a resposta mesmo se o envio do corpo for cortado; pedido direto ao agente nas rotas do leitor é recusado (só o proxy com HTTPS, ou o próprio servidor sem os cabeçalhos do proxy); o instalador volta a permissão da pasta de dados ao padrão antes de ajustar e para se ela não ficar com os Administradores; textos da janela no singular quando é 1 foto.
- **Instalador:** o `.cmd` fica com fim de linha LF (como o `preparar-posto-eterna.cmd` no repositório) e `montar-instalar-leitor.ps1` regrava assim, para a cópia embutida ser idêntica byte a byte ao `.py`. A Reprodução Automática é desligada pela política da máquina (`NoDriveTypeAutoRun = 255`, todas as unidades).
