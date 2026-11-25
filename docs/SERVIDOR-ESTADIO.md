# Servidor do estádio: como cada um acessa

O Eterna roda no servidor `srv-viva-maracana` (Ubuntu, rede do estádio, `192.168.10.10`). De fora do estádio, só pela VPN da Maracatour. Atualização do sistema só pelo git. Desde 15/11/2026 o Tailscale não existe mais.

## Quem acessa e como

| Pessoa | VPN | Login SSH | Pode | Não pode |
|---|---|---|---|---|
| Ronaldo (TI) | FortiClient, perfil MaracaTour | `ubuntu` (chave) | tudo; único com a senha do `sudo` | — |
| Eduardo (desenvolvimento) | FortiClient, perfil MaracaTour | `eduardo` (chave do Mac) | ler registros, código, status, fotos do HD; publicar código pelo git | `sudo`: reiniciar serviço, instalar, mexer em configuração, bancos e chaves |
| Rafael (diretor de TI) | dono do FortiGate e da VPN | — | criar e remover usuários da VPN | — |

- Cada pessoa tem a própria chave; chave compartilhada não existe. Dar e tirar acesso: `servidor/linux/acesso-ssh.sh` (rodado pelo Ronaldo com `sudo`).
- O SSH aceita só chave, sem senha e sem root (endurecimento do Rafael em `/etc/ssh/sshd_config.d/01-hardening.conf`); cada login liberado ganha um `61-eterna-acesso-<login>.conf`.
- Postos de venda e tablets não usam SSH nem VPN: abrem `https://posto.eterna.photo` na rede do estádio.

## Primeira vez (no seu computador)

1. Conectar a VPN MaracaTour no FortiClient (usuário pedido ao Rafael).
2. Criar a chave e o atalho (Mac ou Linux; troque `eduardo` pelo seu login):
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/eterna-estadio -C "eduardo@mac" -N ""
   printf '\nHost srv-viva-maracana\n  HostName 192.168.10.10\n  User eduardo\n  IdentityFile ~/.ssh/eterna-estadio\n  IdentitiesOnly yes\n' >> ~/.ssh/config
   cat ~/.ssh/eterna-estadio.pub
   ```
3. Mandar a linha `ssh-ed25519 ...` (chave pública) ao Ronaldo, que libera com `acesso-ssh.sh`.
4. Testar: `ssh srv-viva-maracana`.

## Para o Claude (ou quem for investigar)

Sempre com a VPN ligada. Tudo aqui é leitura; nada precisa de `sudo`.

```bash
ssh srv-viva-maracana 'systemctl is-active eterna eterna-app eterna-vigia vsftpd'      # serviços
ssh srv-viva-maracana 'journalctl -u eterna --since "-30 min" --no-pager | tail -100'  # registro do Eterna
ssh srv-viva-maracana 'journalctl -u eterna-backup-originais --no-pager -n 20'        # cópia dos originais para a nuvem
ssh srv-viva-maracana 'curl -s http://127.0.0.1:8797/; tail -50 /var/log/eterna-vigia.log'  # deploy: commit no ar, erro
ssh srv-viva-maracana 'nvidia-smi'                                                     # placa de vídeo (recorte)
ssh srv-viva-maracana 'ls /srv/eterna-midia/inbox/$(date +%F) | wc -l'                 # fotos de hoje
ssh srv-viva-maracana 'tail -20 /srv/eterna-midia/diagnostico/selfie/$(date +%F).jsonl'  # últimas buscas por selfie
```

| Onde | O quê | Leitura sem sudo |
|---|---|---|
| `/opt/eterna/app` | cópia do git que está no ar (ramo do vigia) | sim |
| `/srv/eterna-midia/inbox/<dia>/` | originais das fotos (HD de 4 TB) | sim |
| `/srv/eterna-midia/ftp/<login>/` | chegada pelo FTP (vsftpd) antes de entrar no Eterna | sim |
| `/srv/eterna-midia/recortes/` | recortes da IA (placa de vídeo) | sim |
| `/srv/eterna-midia/diagnostico/selfie/<dia>.jsonl` | uma linha por busca por selfie (Checkout e galeria pelo QR), 30 dias | sim |
| `/srv/eterna/Eterna/` | bancos, `nuvem.env`, chaves | não (só o serviço `eterna`) |
| porta 8765 | o Eterna (a tela abre por `https://posto.eterna.photo`) | — |
| porta 8797 | situação do deploy, só leitura | sim |

### Selfie não achou as fotos (18/11)

Cada busca por selfie grava uma linha em `/srv/eterna-midia/diagnostico/selfie/<dia>.jsonl` (HD de 4 TB, não o disco do sistema). Nunca guarda imagem nem o vetor do rosto: só números e o id das fotos.

| Campo | O que diz |
|---|---|
| `em`, `origem` | hora e de onde veio (`checkout` ou `qr`) |
| `resultado` | `achou`, `nao_achou`, `sem_rosto`, `varias_pessoas` ou `erro` |
| `claras`, `duvida`, `melhor` | fotos com semelhança de 0,45 para cima, fotos entre 0,38 e 0,45 (o "é você?") e a maior semelhança |
| `fila` | fotos que ainda esperavam a leitura de rostos naquela hora (recém-chegadas não são achadas até serem lidas) |
| `janela_min` | janela da selfie (minutos desde o último clique ou a última chegada da sessão; 0 = dia todo) |
| `top` | até 10 fotos mais parecidas (`id`, `sim`) |

Como ler: `claras` 0 e `fila` alta = as fotos ainda não tinham sido lidas; `claras` 0, `fila` 0 e `melhor` abaixo de 0,38 = rosto da selfie ruim (de lado, contra a luz) ou foto fora da janela; `resultado` `erro` ou busca que nem aparece = a imagem não chegou inteira ao servidor (no registro do `eterna`, "corpo inválido" com `BrokenPipeError`: o Checkout desistiu antes de terminar de enviar, rede lenta). A pasta `diagnostico` é criada uma vez pelo Ronaldo (`sudo install -d -o eterna -g eterna /srv/eterna-midia/diagnostico`); sem ela o registro do `eterna` mostra "selfie: diagnóstico não gravou" uma vez e a busca segue normal.

## Publicar uma mudança

Ninguém copia arquivo no servidor. O vigia busca o ramo `idiomas-base` a cada 60 s e reinicia o Eterna sozinho.

```bash
git checkout idiomas-base && git pull
# altere e teste
git add <arquivos> && git commit -m "O que mudou" && git push origin idiomas-base
ssh srv-viva-maracana 'curl -s http://127.0.0.1:8797/'   # o "commit" tem que ser o seu
```

Se o vigia recusar (campo `recusados` ou `erro`), o servidor continua na versão anterior: corrija e envie de novo.

## O que precisa do Ronaldo (sudo)

Reiniciar ou parar serviço à mão, instalar pacote, mexer em `nuvem.env`, chaves, firewall, SSH ou usuários, trocar o ramo do vigia, restaurar backup. Os scripts para isso ficam em `servidor/linux/` e são rodados por ele: `ssh -t srv-viva-maracana "sudo bash /opt/eterna/app/servidor/linux/<script>.sh"`.

Cadastro da equipe por comando (`vendedores.sh`, senha digitada pelo Ronaldo, sem troca obrigatória; os logins vão só na linha de comando): sem opção cria no perfil "Vendedor Drone, Chute a Gol e Snap Pop" (venda e entrega das ativações); com `--perfil venda` antes dos logins, no perfil "Atendimento e venda" (Checkout das fotos). Bilheteria não tem login no Eterna: ingresso é vendido na Imply.

## Cuidados

- Os dados são de clientes (LGPD): ler para investigar, nunca copiar fotos ou bancos para fora do servidor.
- Nada de senha, chave ou endereço externo da VPN em commit: o repositório é público.
- Nuvem e backup: `docs/planos/2026-11-14-servidor-definitivo.md` (seção de 15/11).
- Galeria online (QR do recibo, selfie e vídeo do cartão fora do estádio): `galeria-ligar.sh` grava `ETERNA_GALERIA_API` no `nuvem.env`, confere se a nuvem reconhece o segredo do servidor (se não, mostra o SHA-256 para a stack `eterna-galeria`) e reinicia; as galerias que ficaram para trás sobem sozinhas. Sem ela o celular abre "Galeria não encontrada" (16/11: o servidor novo veio sem essa linha).
- Escola pelo voucher: `escola-ligar.sh` pede o token do painel do Viva Parceiros (o mesmo valor de `PARCEIROS_PAINEL_TOKEN` do Render) sem mostrar, confere se o Viva Parceiros aceita, grava `ETERNA_PARCEIROS_TOKEN` no `nuvem.env` e reinicia o Eterna.

## Zerar a fase de teste (24/11, para o Ronaldo)

O Admin aperta **Zerar fase de teste** no fim de Sistema › Repositório. O servidor reinicia e leva vendas, sessões, fotos, rostos, galerias e números do teste para duas pastas de arquivo, no próprio servidor. Nada vai para a nuvem e nada é apagado de vez. Plano: `docs/planos/2026-11-24-zerar-fase-teste.md`. Detalhe técnico: `docs/DOCUMENTACAO-TECNICA.md`, seção v99.45.0, item 8.

O nome da zeragem (`<id>`) tem o formato `fase-teste-AAAAMMDD-HHMM`. Ele aparece no cartão do Repositório e no `zerada.json`. As duas pastas:

- `/srv/eterna/Eterna/arquivo/<id>/` (disco do sistema): `bancos/` (cópia dos bancos antes da zeragem), `home/` (miniaturas, galerias, sessões, métricas, `rostos.db`, `poses.db`), `passos.jsonl` e `resumo.json`.
- `/srv/eterna-midia/inbox/.arquivo/<id>/` (HD das fotos): `inbox/<dia>/` (originais), `recortes/`, `montagens/`, `ativ-videos/` e `ativ-clientes/`.

### (a) Zerar às 23h

**Antes (até 22h55)**
1. Conferir que o commit da v99.45.0 está no ar: `ssh srv-viva-maracana 'curl -s http://127.0.0.1:8797/'`.
2. Em cada tablet das ativações (Venda e Entrega), abrir **Minhas vendas** e conferir que nenhuma venda está esperando para subir ao servidor. Só então fechar.
3. Fechar todos os Postos de venda, Checkouts e tablets. Aberto, um aparelho com fila antiga pode mandar dados do teste antes de limpar a própria cópia.
4. O Admin abre Repositório › **Ver o que vai ser guardado** e confere que não há bloqueio. Guardar um print das contagens.

**Durante**
1. Deixar o registro do agente aberto: `ssh -t srv-viva-maracana 'journalctl -u eterna -f -n 0 --no-pager'`.
2. O Admin digita ZERAR e confirma. Linhas esperadas, só com números:
   - `zerar: pedido recebido (<id>); o agente reinicia em 1,5 s`
   - `zerar: <id>, tentativa 1 de 3`
   - `zerar: <id> feito (N fotos, N sessões, N vendas, N galerias, N rostos); arquivo até <data> (30 dias)`
3. `parou em <passo> (<motivo>)` quer dizer que o systemd religa e a zeragem continua de onde parou. Na 3ª vez aparece `não feito, parou em <passo>`, o agente sobe normal e o cartão mostra o motivo. Nesse caso, não apertar de novo: ver o motivo (disco cheio, permissão de pasta) e chamar o programador.

**Depois**
1. `ssh srv-viva-maracana 'sudo cat /srv/eterna/Eterna/ponto/zerada.json'`: tem `id`, `em`, `por`, `pasta` e `apagar_a_partir_de` (a data dos 30 dias).
2. `ssh srv-viva-maracana 'curl -s http://127.0.0.1:8765/status'`: o campo `zerada` traz o mesmo `<id>`.
3. `ssh srv-viva-maracana 'sudo cat /srv/eterna/Eterna/arquivo/<id>/passos.jsonl'`: todos os passos com `"ok": true`, até `fim`.
4. Reabrir os Postos e Checkouts. Cada tela limpa a própria cópia e recarrega uma vez sozinha. Conferir Painel e Minhas fotos vazios, Estatísticas com Roverpix e bilheteria, Treino › Resultado com as marcações.

### (b) Desfazer

Só com o serviço parado. Se já houve venda depois da zeragem, o comando avisa e só segue com `--sobrescrever` (o que estava no lugar vai para `arquivo/<id>/pos-zeragem/`).

```bash
sudo systemctl stop eterna-vigia eterna
sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --desfazer-zeragem <id> [--sobrescrever]
sudo systemctl start eterna eterna-vigia
```

Depois, fechar e abrir de novo os Postos e Checkouts. O desfazer funciona mesmo sem o `rostos.db` do arquivo.

### (c) Exclusão LGPD de uma foto que ficou no arquivo

Pedido de exclusão de um visitante cuja foto (`<pid>`) é da fase de teste: a tela não acha mais a foto, então a exclusão é à mão. Com `sudo`:

1. **Listar o que tem o pid no HD** (original em `inbox/<dia>/<pid>_*`, recorte `recortes/<pid>.png` e `<pid>_*.png`, montagens em `montagens/<pid>/`):
   `sudo find /srv/eterna-midia/inbox/.arquivo/<id> -name '<pid>*'`
   Conferir a lista e apagar: `sudo find /srv/eterna-midia/inbox/.arquivo/<id> -name '<pid>*' -prune -exec rm -rf {} +`
2. **Miniatura:** `sudo rm -f /srv/eterna/Eterna/arquivo/<id>/home/thumbs/<pid>.jpg`
3. **Rostos** (se o `rostos.db` do arquivo ainda existir):
   `sudo -u eterna /opt/eterna/venv/bin/python -I -c "import sqlite3,sys;c=sqlite3.connect(sys.argv[1]);[c.execute('delete from '+t+' where pid=?',(sys.argv[2],)) for t in ('rosto','rosto_q')];c.commit();c.execute('vacuum')" /srv/eterna/Eterna/arquivo/<id>/home/rostos.db <pid>`
4. **Original na nuvem:** a chave do arquivo fica na tabela `arquivado` de `/srv/eterna/Eterna/backup-originais.db` (`originais/<dia>/<pid>_...`). Apagar esse objeto no bucket com a mesma conta que o `backup-originais.py` usa (perfil e bucket do `nuvem.env`) e depois apagar a linha dele em `arquivado`.
5. Registrar a exclusão como nas outras (data, quem pediu, pid), sem foto.

Se a foto também tinha marcação no Treino da IA, as linhas dela continuam no `treino.db` e no `cena.db` do servidor e nas cópias em `arquivo/<id>/bancos/`. Pedir ao programador o comando para tirar.

### (d) Em até 7 dias: apagar os rostos do arquivo

Depois de conferir que a zeragem deu certo, apagar só o banco de rostos do arquivo. O desfazer continua funcionando sem ele.

```bash
sudo rm -f /srv/eterna/Eterna/arquivo/<id>/home/rostos.db /srv/eterna/Eterna/arquivo/<id>/home/rostos.db-wal /srv/eterna/Eterna/arquivo/<id>/home/rostos.db-shm
```

### (e) Em 30 dias: apagar as imagens do arquivo

A data está em `apagar_a_partir_de` (`zerada.json` e `resumo.json`). A partir dela, apagar fotos, miniaturas, recortes, montagens e rostos:

```bash
sudo rm -rf /srv/eterna-midia/inbox/.arquivo/<id>
sudo rm -rf /srv/eterna/Eterna/arquivo/<id>/home/thumbs
sudo rm -f /srv/eterna/Eterna/arquivo/<id>/home/rostos.db /srv/eterna/Eterna/arquivo/<id>/home/rostos.db-wal /srv/eterna/Eterna/arquivo/<id>/home/rostos.db-shm
```

Escreva os caminhos inteiros, sem `*`: a pasta é do usuário `eterna` e o seu terminal não consegue expandir o `*` lá dentro.

Ficam pelo prazo legal os bancos de venda (`arquivo/<id>/bancos/`) e os consentimentos (`arquivo/<id>/home/galerias/consentimentos.jsonl`). Depois deste passo, o desfazer não devolve mais as fotos.

### (f) O botão só vale até 25/11

Depois de 25/11 (data do servidor), a prévia e o botão mostram o bloqueio `prazo`. Para liberar de novo (outro venue, emergência), gravar `ETERNA_ZERAR_LIBERA=1` no `nuvem.env` e reiniciar o `eterna`. O botão também é de uso único: com uma zeragem feita, é preciso renomear o `ponto/zerada.json` antes. Tirar a linha do `nuvem.env` depois de usar.

## Recorte só na placa de vídeo (19/11, inegociável)

Toda foto é recortada no servidor assim que chega, na placa NVIDIA, antes de o cliente chegar ao Checkout. O Checkout nunca prepara recorte na frente do cliente. Com `ETERNA_RECORTE_GPU=obrigatoria` no `nuvem.env` (o `instalar.sh` grava sozinho quando há placa NVIDIA), o modelo que abrir fora da placa (driver caído, CUDA faltando) é fechado na hora: `/status.recorte` fica com `ok: false` e o motivo "recorte fora da placa de vídeo", o Checkout não oferece fundo de IA e o agente tenta a placa de novo a cada minuto. Nunca cai no processador. Teste: `testes/recorte_placa_obrigatoria_agente.py`.

Conferir a placa: `ssh srv-viva-maracana 'nvidia-smi'` e, como o usuário `eterna`, `instalar-recorte-modelos.py --provedor` (tem que dizer "placa de vídeo (CUDA)").

## Classificação de poses: modelo de visão local (23/11, P1)

Plano: `docs/planos/2026-11-23-poses-estatistica.md`. À noite o servidor classifica cada foto (set, quem aparece, adereço, pose, enquadramento, vibração) com o Qwen3-VL-8B-Instruct (Apache 2.0) num `llama-server` do llama.cpp que só escuta em `127.0.0.1`, numa porta escolhida na hora e com uma chave nova a cada abertura (arquivo 0600 em `~/Eterna/ponto/poses-*/`, apagado ao fechar). Nenhuma foto sai do servidor. O recorte e a montagem dos fundos de IA têm prioridade: a classificação só roda na janela (padrão 20:00 às 07:00), para quando chega recorte ou montagem do Checkout e volta 2 minutos depois, e só abre com 9 GB livres na placa. Chave em Fundos de IA (técnico) › Classificação de poses (Desligada, Sombra, Ligada; padrão Desligada). `ETERNA_POSES=0` no `nuvem.env` força Desligada.

**Situação em 24/11:** o código está publicado, mas o modelo ainda não foi instalado. `POSE_SHA` e `POSE_MMPROJ_SHA` estão vazios, o `visao-instalar.sh` não tem `LLAMA_TAG` nem `LLAMA_COMMIT` fixos e o `BASE` do `instalar-poses-modelos.py` aponta para `main`. Enquanto isso, a classificação não abre (motivo `sem_modelo`) e nada muda na operação.

**Ronaldo: instalar (sudo, uma vez)**

1. **Anotar os valores antes de rodar.** São cinco:
   - `LLAMA_TAG`: a tag do llama.cpp (`bNNNN`, de uma release com suporte a Qwen3-VL).
   - `LLAMA_COMMIT`: o hash completo (40 caracteres) do commit dessa tag, na página da release.
   - `POSE_SHA_MODELO`: o SHA-256 do `Qwen3VL-8B-Instruct-Q4_K_M.gguf`.
   - `POSE_SHA_MMPROJ`: o SHA-256 do `mmproj-Qwen3VL-8B-Instruct-F16.gguf`.
   - O commit do repositório do modelo no Hugging Face (aba Files and versions, "History").

   Os dois SHA-256 ficam na página de cada arquivo no Hugging Face (Qwen/Qwen3-VL-8B-Instruct-GGUF, aba Files and versions, clicar no arquivo, quadro Git LFS Details). São 64 letras e números. Confira também a versão do CUDA Toolkit da mesma geração do driver.
2. **Rodar o instalador:**
   `ssh -t srv-viva-maracana "sudo LLAMA_TAG=bNNNN LLAMA_COMMIT=<hash do commit> POSE_SHA_MODELO=<SHA-256 do Q4_K_M> POSE_SHA_MMPROJ=<SHA-256 do mmproj> bash /opt/eterna/app/servidor/linux/visao-instalar.sh"`
   - Sem os dois SHA-256 (ou fora do formato), o roteiro para antes de instalar qualquer coisa.
   - Ele instala `build-essential`, `cmake`, `git` e o CUDA Toolkit (versão fixa em `CUDA_PACOTE`, bloqueado no unattended-upgrades), confere que a tag está no commit `LLAMA_COMMIT` (se a tag foi movida, o roteiro para), compila só o `llama-server` com CUDA para a placa (sm_120), estático e sem libcurl, e instala em `/opt/eterna/visao/bin/llama-server` (root, 755).
   - Quem garante que nada é baixado pelo `llama-server` é a linha de comando que o agente monta (`agente/eterna-poses.py`: só `127.0.0.1`, `-m` e `--mmproj` com arquivos locais, chave por arquivo, `LLAMA_OFFLINE=1`, nunca `-hf` nem outra opção de baixar modelo). O roteiro confere isso no arquivo publicado.
   - Plano B se a compilação falhar: o binário Vulkan oficial do mesmo `LLAMA_TAG` e `LLAMA_COMMIT`, instalado no mesmo caminho e do mesmo jeito.
3. **O modelo (passo 3 do roteiro).** O roteiro chama `agente/instalar-poses-modelos.py --esperado-modelo <sha> --esperado-mmproj <sha>`. Ele baixa os dois arquivos (cerca de 6,2 GB) para `~/Eterna/modelos` do usuário `eterna`, num temporário, e confere o SHA-256 de cada um.
   - Chegou com SHA-256 diferente: o temporário é apagado, aparece `FALHA` e o roteiro para. Nada fica instalado.
   - Arquivo já instalado com SHA-256 diferente do informado: aparece `PARADO`. Nada é apagado nem baixado de novo. Confira o SHA na página do arquivo. Se o informado estiver certo, apague o arquivo indicado na mensagem e rode de novo.
   - Sem o SHA-256 esperado, nada é baixado.
   - Para rodar só o modelo, sem o roteiro inteiro: `ssh -t srv-viva-maracana "sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/instalar-poses-modelos.py --esperado-modelo <sha> --esperado-mmproj <sha>"`
4. **Mandar os cinco valores do passo 1 ao programador.** Não são segredo: são números públicos de arquivos públicos.

**Fixar os valores no código (programador, ou o Ronaldo com commit em `idiomas-base`)**

5. Preencher, com os valores conferidos:
   - `POSE_SHA` e `POSE_MMPROJ_SHA` em `agente/eterna-agente.py` e em `agente/instalar-poses-modelos.py` (os mesmos nos dois).
   - O padrão de `LLAMA_TAG` e `LLAMA_COMMIT` em `servidor/linux/visao-instalar.sh` (por exemplo `LLAMA_TAG="${LLAMA_TAG:-bNNNN}"`), para a próxima instalação sair igual.
   - O commit do Hugging Face no `BASE` do `agente/instalar-poses-modelos.py`, no lugar de `main`.

   Publicar pelo git. Só depois disso o Eterna reconhece o modelo.

**Ronaldo: medir (depois de publicado, à noite)**

6. Com a classificação **Desligada** no Eterna (Fundos de IA (técnico) › Classificação de poses; dois modelos de visão juntos não cabem na placa) e o agente e o recorte no ar, medir 50 fotos e mandar o resultado:
   `ssh -t srv-viva-maracana "sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/medir-poses.py --n 50"`
   - Mostra ms por foto (mediana e p90), % de respostas válidas, pico de memória da placa e os processos na placa nesse pico (o recorte tem que aparecer lá).
   - Meta: mediana até 2,5 s e 95% ou mais de válidas.
   - Nada é gravado e nenhum id de foto aparece.
   - Ele não roda antes do passo 5: com os SHA vazios no código, responde "modelo indisponível".
   - Ele se recusa a rodar com o classificador do agente aberto. Se a abertura ou um lote passar do prazo, encerra o classificador (SIGTERM, que fecha o `llama-server`). A chave e o registro da medição ficam numa pasta própria, `~/Eterna/ponto/medir/`, para a limpeza de órfãos do agente (que procura em `~/Eterna/ponto/poses-*`) não derrubar o `llama-server` da medição.
7. Depois da medição, o Eduardo decide quando pôr a classificação em **Sombra**. Ligada só depois da conferência (fatia P2 do plano).

**Para conferir (sem sudo):** `ssh srv-viva-maracana 'journalctl -u eterna --since "-12 h" --no-pager | grep "poses:"'` (só contagens: quando começou, quando parou e por quê, feitas, dúvidas, erros, ms por foto) e `nvidia-smi` durante a noite (aparece o `llama-server`). Motivos de parada: `desligada`, `fora_janela`, `recorte_ocupado`, `montagem_ocupada`, `conferindo` (lendo o SHA dos 6,2 GB: só acontece à noite, com Sombra ou Ligada e sem recorte ou montagem esperando, e uma vez por arquivo; o resultado fica em `~/Eterna/ponto/poses-sha.json`, 0600, com tamanho, data e inode, e só é relido se o arquivo mudar), `sem_modelo` (também quando a leitura do arquivo falha no meio: só tenta de novo na noite seguinte ou se o arquivo mudar), `vram` (menos de 9 GB livres ou sem `nvidia-smi`), `parado` (3 quedas seguidas, contando lote inteiro com erro do servidor do modelo, motivo `servidor`; volta na noite seguinte), `versao` (classificador de outra versão: publicar de novo; parado até a noite seguinte), `fim_fila`. Na partida, o agente encerra classificador e `llama-server` que tenham sobrado de uma partida anterior (pelo `~/Eterna/ponto/poses-filho.json` e pela chave em `~/Eterna/ponto/poses-*`). O registro do `llama-server` da última abertura fica em `~/Eterna/ponto/poses-llama.log` (sem imagens).

## Leitor de cartão do gramado (18/11)

O computador Windows do gramado roda `agente/eterna-leitor.py`: o fotógrafo põe o cartão e as fotos que faltam no servidor sobem sozinhas (plano `docs/planos/2026-11-18-leitor-cartao-gramado.md`).

**No servidor:** o leitor fala só por `https://posto.eterna.photo` (o nginx); pedido direto à porta 8765 é recusado. Nada obrigatório se os computadores do gramado estiverem em `192.168.10.0/24` (o firewall já libera a 443 para essa faixa e o nginx repassa o `X-Real-IP`). Se o gramado ficar em outra rede ou VLAN: gravar `ETERNA_LEITOR_REDES=<faixa>` no `nuvem.env`, liberar a 443 dessa faixa no ufw e reiniciar o `eterna`. Depois do deploy, conferir que o painel **Leitores de cartão** aparece em Painel de controle › Avançado.

**Em cada computador do gramado** (administrador, uma vez):

1. Criar ou escolher um usuário local sem administrador e configurar o logon automático dele.
2. Desligar a suspensão do computador.
3. No Eterna, Painel de controle › Avançado › Leitores de cartão: cadastrar "Gramado 1" e anotar o código (10 minutos, uma vez).
4. Abrir `https://posto.eterna.photo/instalar-leitor` (ou levar `servidor/leitor/instalar-leitor.cmd` num pendrive), botão direito › Executar como administrador e digitar o código. Com outro usuário que não o da tela: `instalar-leitor.cmd -Usuario <usuario>`.
   O instalador põe o Python 3.12 para todos (winget; sem internet, levar o instalador da python.org num pendrive e marcar "Install for all users" e "tcl/tk"), copia o programa para `C:\Program Files\Eterna Leitor`, cria `C:\ProgramData\Eterna\leitor` só para o usuário do leitor, Administradores e SYSTEM (dono: Administradores), ativa, testa, registra a tarefa agendada "Eterna leitor" (ao entrar no Windows, religa em 1 minuto) e desliga a Reprodução Automática e a indexação de unidades removíveis.
5. Testar com um cartão de verdade (lista "Só no estádio" no plano).
6. Reinstalar: **Novo código** no painel e rodar o instalador de novo.
7. Tirar um computador de uso: **Desativar** no painel e depois, na máquina, `"C:\Program Files\Python312\python.exe" -I "C:\Program Files\Eterna Leitor\eterna-leitor.py" --apagar-fila` (com a tarefa parada).

**Desinstalar** (administrador, no computador do gramado):

1. **Desativar** o leitor no painel.
2. Parar e tirar a tarefa: `Unregister-ScheduledTask -TaskName 'Eterna leitor' -Confirm:$false` (PowerShell).
3. Apagar a fila: `"C:\Program Files\Python312\python.exe" -I "C:\Program Files\Eterna Leitor\eterna-leitor.py" --apagar-fila` e digitar `APAGAR`.
4. Apagar as pastas `C:\Program Files\Eterna Leitor` e `C:\ProgramData\Eterna\leitor`.
5. Se o computador não for mais usado para cartão, voltar as políticas: apagar `NoDriveTypeAutoRun` e `NoAutorun` em `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer` e `DisableRemovableDriveIndexing` em `HKLM\SOFTWARE\Policies\Microsoft\Windows\Windows Search`.

Recomendação: BitLocker ligado no computador do gramado.

Conferir na máquina: `... eterna-leitor.py --testar` diz se o leitor fala com o servidor. O log fica em `C:\ProgramData\Eterna\leitor\leitor.log` (sem token e sem nome de foto).

## Contas por pessoa, sem conta genérica (18/11)

Decisão do Ronaldo: cada pessoa entra com a própria conta; contas genéricas (Supervisão, Validação, Checkout, Atendimento e venda, testes) são desativadas. Dois comandos no próprio servidor:

- Cadastrar a pessoa, ou mudar o perfil de quem já existe, copiando o perfil de uma conta-modelo (perfil, módulos, menu, tela inicial). A senha vem pela entrada padrão; vazia mantém a senha atual. A conta-modelo pode estar desativada.

  ```
  printf '%s\n' 'SENHA' | sudo runuser -u eterna -- env HOME=/srv/eterna ETERNA_COMO=supervisor@eterna.photo /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --usuario nome.sobrenome "Nome Sobrenome"
  ```

  Modelos: `supervisor@eterna.photo` (Supervisão), `ronaldo` (Admin).

- Desativar (não apaga: vendas e registros continuam com o nome; derruba as sessões abertas; postos pareados continuam, revogar é no Painel de controle):

  ```
  sudo runuser -u eterna -- env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --desativar usuario1 usuario2
  ```

- Excluir de vez (o mesmo que excluir na tela de Usuários; vendas e registros continuam com o nome; postos pareados continuam):

  ```
  sudo runuser -u eterna -- env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --excluir usuario1 usuario2
  ```

  Excluir a conta Supervisão só depois de cadastrar os supervisores: ela é o modelo.

A conta `hello@eterna.photo` do sistema pode ser excluída: o e-mail de nova senha sai pela nuvem (SES, remetente `MailFrom` da stack), sem depender dela.

## Vendas canceladas (24/11)

A venda cancelada sai das telas e das contagens, mas nada é apagado: a cópia inteira fica em `~/Eterna/ponto/estado.db`, tabela `venda_cancelada` (`tipo` foto, pedido ou ativacao; `id`; `no` = número da venda; `em`; `por`; `motivo`; `dados` = JSON da venda no momento do cancelamento; `arquivada_em`). Para achar uma:

```
sqlite3 ~/Eterna/ponto/estado.db "select tipo, id, no, em, por, motivo from venda_cancelada order by em desc limit 50"
sqlite3 ~/Eterna/ponto/estado.db "select dados from venda_cancelada where no = 'P14-003'"
```

Recuperar uma venda de foto (`foto`): a sessão continua no SIM com `status` cancelada; volta a paga com `status: 'paga'` e sem o campo `cancelada`, e as compradas voltam à galeria quando ela for publicada de novo. Ativação: `update ativ_venda set situacao = null, cancel_motivo = null, cancel_por = null, cancel_em = null where origem = 'eterna' and id = ?` no `vendas.db` (a situação ativa é vazia). Sempre com o pedido de quem tem o Financeiro e registro no git.
