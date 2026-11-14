# Servidor definitivo do estádio (requisitos, 14/11/2026)

**Situação:** levantamento de requisitos com o Ronaldo, antes da instalação. Nada instalado ainda.

## Servidor como encontrado (levantamento por SSH, 14/11, só leitura)

| Item | Encontrado | Consequência |
|---|---|---|
| Nome e sistema | `srv-viva-maracana`, Ubuntu 26.04.1 LTS, kernel 7.0 | Python do sistema é 3.14: conferir se `onnxruntime-gpu`, OpenCV e rembg já têm pacote para 3.14; se não, Python 3.13 próprio (uv) só para o Eterna |
| Placa-mãe | Gigabyte B650M AORUS ELITE AX | |
| Processador | AMD Ryzen 9 9900X3D, mas **só 6 núcleos visíveis e sem SMT** (um dos dois blocos de núcleos e o hyperthreading desligados na BIOS) | Ligando na BIOS: 12 núcleos / 24 linhas. Não impede começar |
| Memória | 64 GB (59 GiB úteis), swap 8 GB | Folgada |
| Disco do sistema | NVMe **Kingston KC3000 1 TB** (não é o NV2: este tem cache próprio e aguenta mais gravação). LVM com só 100 GB em uso pelo `/`; cerca de 850 GB livres no grupo | Bancos e miniaturas cabem no NVMe com folga: criar volume próprio para `~/Eterna` |
| HD de fotos | Seagate Exos 4 TB (ST4000NM000B, disco de servidor), **sem partição, sem formatar** | O instalador formata (ext4) e monta em `/srv/eterna-midia` |
| Placa de vídeo | NVIDIA **GeForce RTX 5060 Ti 16 GB** (Blackwell) com o driver livre `nouveau`; sem driver NVIDIA, sem CUDA. Tem também o vídeo integrado AMD | Instalar o driver NVIDIA (módulos abertos, versão que suporte Blackwell) e conferir que o `onnxruntime-gpu` tem suporte a essa geração |
| Rede | `enp8s0` 2,5 Gb em 192.168.10.10/24, gateway 192.168.10.1; duas portas 10 Gb (Intel 82599, fibra SFP+) e Wi-Fi desligados | |
| **DNS** | **O DNS do gateway (192.168.10.1) não responde.** A internet funciona por IP e os DNS 1.1.1.1 e 8.8.8.8 respondem | Sem DNS o servidor não acha GitHub, PyPI, AWS nem o relógio. Corrigir antes de tudo |
| **Relógio** | **Cerca de 10 h adiantado** (15/11 00:38 UTC quando eram 14/11 14:36 UTC), fuso UTC, NTP sem nenhuma fonte (por causa do DNS) | Hora errada estraga horário de venda, assinatura da AWS (backup recusado) e certificados. Acertar junto com o DNS; fuso `America/Sao_Paulo` |
| Portas abertas | Só SSH (22). Firewall `ufw` ligado | |
| SSH | Só chave; senha e root desligados | Já está como deve |
| Usuários | Só `ubuntu` (grupo sudo, `sudo` pede senha) | Comandos com `sudo` rodam no terminal do Ronaldo, que tem a senha |
| Software | git sim; sem pip, ffmpeg, Docker, servidor web, smartctl, nvme-cli, NUT | Tudo pelo instalador |
| Nobreak | Nada ligado no USB | Ligar o cabo USB do nobreak, se ele tiver |
| Atualizações | `unattended-upgrades` ligado | Segurar o driver NVIDIA fora da atualização automática |

## O que já está decidido

| Tema | Decisão |
|---|---|
| Máquina | Servidor dedicado com Ubuntu, na rede `vm-vivalocal`, IP fixo 192.168.10.10 |
| Acesso de manutenção | SSH com chave (sem senha trafegando); `sudo` continua pedindo a senha do usuário |
| Acesso das estações | Tudo local: postos, tablets e computador da entrega falam com o servidor pela rede do estádio; de fora, só pela VPN (FortiGate, decisão de 02/11). Tailscale sai |
| Sistema e bancos | No NVMe da placa-mãe (Kingston KC3000 1 TB) |
| Fotos e vídeos | No HD de 4 TB |
| IA de imagem | Na placa de vídeo do servidor |

## Discos: o que vai em cada um

Hoje tudo mora em `~/Eterna` do usuário que roda o agente. A divisão fica assim:

| Disco | Pastas | Por quê |
|---|---|---|
| Flash (placa-mãe) | sistema, app, `ponto/estado.db`, `ponto/vendas.db`, `ponto/operacao.db`, `rostos.db`, `nuvem.db`, `index.json`, `meta.json`, `modelos/`, `nuvem.env` | Banco pequeno e acessado o tempo todo; precisa de disco rápido |
| HD 4 TB | `inbox/` (fotos das câmeras), `thumbs/`, `recortes/`, `ativ-videos/`, `ativ-clientes/`, `ativ-demo/` | Volume grande: cerca de 15 mil fotos por dia, mais os vídeos do Drone, Chute a Gol e Snap Pop |

Como fazer sem mexer no código: o HD de 4 TB é montado em `/srv/eterna-midia` (pelo UUID, no `fstab`) e cada pasta da
tabela vira um *bind mount* para dentro de `~/Eterna`. O agente continua vendo `~/Eterna/inbox` etc.

Proteção obrigatória: o serviço do Eterna só sobe com o HD montado (`RequiresMountsFor=/srv/eterna-midia` no systemd). Sem isso,
se o HD não montar, as fotos caem no disco flash e o enchem sem ninguém perceber. O agente já recusa receber foto com menos de
10 GB livres (`ETERNA_RECORTES_PISO_GB`), e isso passa a valer para o HD.

## Placa de vídeo: o que roda nela

| Trabalho | Hoje | No servidor definitivo |
|---|---|---|
| Recorte dos fundos de IA (BiRefNet, rembg) | Já usa a placa NVIDIA pelo `onnxruntime-gpu` (`ETERNA_RECORTE_GPU=auto`), com instalador só para Windows | Mesmo código; falta o instalador para Linux |
| Rostos: achar e medir cada rosto de cada foto que chega (YuNet + SFace) | OpenCV, só processador | Passar para o `onnxruntime-gpu`, com os mesmos modelos, e cair no processador se a placa faltar |
| Selfie (busca do cliente) | OpenCV, só processador | Igual à linha de cima: a selfie é uma imagem; o peso está em medir as 15 mil fotos do dia |

Recomendação: sim, rostos na placa também. A comparação da selfie com o banco de rostos é barata; o que pesa é medir cada foto
que chega, e é isso que atrasa a selfie no pico. Regra para trocar: rodar a massa real (587 fotos vendidas, 96 sessões, acerto de 95,4%
no processador) nos dois caminhos e só ligar a placa se o acerto for o mesmo e as medidas do `rostos.db` continuarem compatíveis
(não pode ser preciso medir de novo o que já está no banco).

## Rede e endereço

- **Começo pelo IP** (decisão do Ronaldo, 14/11): os aparelhos abrem `http://192.168.10.10:8765`; DNS e certificado
  (`posto.eterna.photo`, com proxy na frente, CHECKLIST-SERVIDOR passo 4) ficam para depois, com calma.
- Consequência: o navegador só abre a câmera em endereço com certificado ou em `localhost`. Com o IP, a selfie do Checkout e a
  foto do cliente no tablet ficam sem câmera, a menos que cada aparelho marque esse endereço como confiável no Chrome:
  política `OverrideSecurityRestrictionsOnInsecureOrigin` (Chrome gerenciado) ou, aparelho a aparelho,
  `chrome://flags/#unsafely-treat-insecure-origin-as-secure` com `http://192.168.10.10:8765`. A venda do tablet funciona sem a foto.
- Quando o DNS entrar, cada aparelho é pareado de novo no endereço novo (o cookie do posto vale por endereço).
- `ETERNA_ORIGENS` e `ETERNA_POSTO_REDE` passam para a faixa da rede `vm-vivalocal`.
- FTP das câmeras apontado para o servidor novo.
- Impressão continua no posto (DNP pelo USB do posto); o servidor não precisa de impressora.

## Estratégia da instalação (decisão de 14/11: começar zerado)

1. **Conhecer o servidor** pelo SSH, só leitura: discos e partições, placa de vídeo e driver, memória, processador, versão do
   Ubuntu, rede, o que já está instalado e rodando, nobreak no USB. O resultado vira a seção "Servidor como encontrado" deste plano.
2. **Escrever o instalador** `servidor/linux/instalar.sh`, que se pode rodar de novo sem estragar nada (cada passo confere
   antes de fazer) e termina com um teste que diz o que ficou certo e o que faltou.
3. **Ensaiar** o instalador numa máquina virtual Ubuntu igual, antes do servidor.
4. **Instalar no servidor**, rodar o teste do instalador e depois o teste de ponta a ponta do CHECKLIST-SERVIDOR (passo 9).

### O que o instalador põe no lugar

| Parte | O quê |
|---|---|
| Usuário e permissões | Usuário de sistema `eterna`, sem login; `~/Eterna` só dele (700); `nuvem.env` 600; o administrador entra por SSH com chave, sem senha pelo SSH |
| Discos | HD de 4 TB pelo UUID em `/srv/eterna-midia`; pastas de fotos e vídeos ligadas a `~/Eterna`; o serviço não sobe sem o HD |
| Linguagens e bibliotecas | Python 3 do Ubuntu num ambiente próprio (`venv`), com versões fixas e hash conferido (como os `recorte-requisitos*.txt`): OpenCV, NumPy, Pillow, boto3, rembg, `onnxruntime-gpu`; ffmpeg; git |
| Placa de vídeo | Driver NVIDIA do Ubuntu; CUDA e cuDNN vêm como pacotes do Python junto do `onnxruntime-gpu`; teste confirma que o provedor CUDA está ativo e não caiu no processador |
| Modelos de IA | Rostos (YuNet, SFace), recorte (BiRefNet e os do rembg), MoveNet, com SHA-256 conferido |
| Serviço | `eterna.service` no systemd: liga com a máquina, religa se cair, fuso `America/Sao_Paulo`, registro no journal |
| Vigia | O mesmo papel do `eterna-vigia.ps1`: a cada 30 s confere `/status`, três faltas e religa; busca versão nova só de release conferida por SHA-256 e, se algo falhar, fica a versão do disco |
| Rede | Firewall (ufw): 8765 e FTP das câmeras só para a rede do estádio, SSH só para a rede da TI/VPN |
| Saúde | SMART dos dois discos (alerta do desgaste do NV2), NUT do nobreak, atualizações de segurança do Ubuntu sem tocar no driver NVIDIA |

### Quem mexe no servidor e como a versão nova chega (requisito do Ronaldo, 14/11)

Ronaldo (no Brasil) e Eduardo (em Miami) trabalham pelo Claude e pelo git. O deploy tem de ser direto: mandou para o GitHub,
o servidor aplica. Desenho:

- **Deploy sem entrar no servidor.** O vigia busca o GitHub a cada minuto (o mesmo modelo do `supervisor.py` do servidor de
  teste, que já funciona assim para o Claude do Eduardo). Não precisa abrir porta nenhuma para fora: é o servidor que busca.
- **Branch de produção protegida.** O servidor segue uma branch só dele (`producao`), que só anda por fast-forward e por pull
  request aprovado (proteção da branch no GitHub). Quem tem push nas outras branches não chega ao servidor sozinho: hoje,
  no servidor de teste, quem tem push no `idiomas-base` executa código no notebook, e na produção isso não pode acontecer.
- **Aplica com segurança.** Antes de trocar: confere que o código compila; troca; religa; se o `/status` não responder em
  1min30, volta sozinho para a versão anterior e registra o motivo. A situação (versão no ar, última troca, erro) fica numa
  página só de leitura, como a 8797 do teste, para o Claude de qualquer um dos dois conferir o deploy.
- **Acesso de manutenção** (diagnóstico, logs, instalação), separado do deploy:
  - cada pessoa com o seu próprio usuário e a sua chave SSH (Ronaldo e Eduardo), para o registro dizer quem fez o quê;
  - de fora do estádio, só pela VPN FortiGate: o Eduardo precisa de um usuário de VPN (pedir à TI/infra) que funcione de Miami;
  - `sudo` com senha de cada um; o Claude de cada um usa o SSH da própria máquina.

### Versão que vai para o servidor

O vigia de produção só aceita **release** do GitHub (tag `vNN` com SHA-256), e hoje o repositório não tem nenhuma release
publicada. Antes de instalar, decidir com o Eduardo: publicar a primeira release a partir do `main` atual (que já recebeu o
`idiomas-base` na v99.30.7) ou deixar o servidor no canal de teste no início.

## O que falta construir para Linux

1. Instalador para Ubuntu: usuário `eterna`, Python em ambiente próprio, dependências com hash (como os `recorte-requisitos*.txt`), ffmpeg, serviço systemd que volta sozinho, fuso `America/Sao_Paulo`.
2. Driver NVIDIA e CUDA compatíveis com `onnxruntime-gpu` 1.29.
3. Montagem do HD de 4 TB e as pastas da tabela.
4. Proxy com certificado para `posto.eterna.photo`.
5. Rostos pelo `onnxruntime-gpu`, com o teste de acerto acima.
6. Migração dos dados do servidor de teste (bancos e fotos ainda em uso), se o Ronaldo quiser levar.

## Perguntas em aberto

1. ~~Tipo do disco da placa-mãe?~~ NVMe Kingston NV2 (Ronaldo, 14/11). Serve para os bancos (SQLite em WAL). Não tem memória
   própria de cache e aguenta menos gravação que um SSD de servidor: acompanhar o desgaste pelo SMART (`nvme smart-log`, campo
   `percentage_used`) e mandar o número para a tela de situação do servidor. Falta o tamanho (sai no SSH).
2. ~~Tipo do HD?~~ Mecânico (Ronaldo, 14/11). Serve para guardar fotos e vídeos (gravação em sequência). Dois cuidados:
   - **Miniaturas:** o Checkout abre dezenas de miniaturas por sessão, e disco mecânico demora em leitura espalhada. Se o NVMe
     tiver espaço, `thumbs/` fica no NVMe (cerca de 30 KB por foto, uns 450 MB por dia) com prazo de limpeza; o original fica no HD.
   - **Cópia:** um disco só, sem RAID. Se ele quebrar, perdem-se as fotos que ainda não subiram para a nuvem (as vendidas sobem
     para a galeria; as não vendidas só existem nele). Decidir depois: segundo HD em espelho ou aceitar o risco.
3. Modelo da placa de vídeo e memória dela (sai no `nvidia-smi`), memória RAM e processador.
4. ~~Nobreak no servidor?~~ Tem (Ronaldo, 14/11). Se ele tiver cabo USB ou rede, ligar ao servidor (NUT) para desligar com os bancos fechados quando a bateria acabar.
5. "VPN tudo local": as estações entram por VPN mesmo dentro do estádio, ou só quem está fora?
6. ~~Levar os dados do teste?~~ Começar zerado (Ronaldo, 14/11): primeiro entender a estrutura do servidor, depois instalar com um instalador novo que deixa tudo pronto.
