# Subir um servidor do Eterna: passo a passo

Ordem para montar o servidor do ponto do zero, ou trocar de máquina. Cada passo tem o comando e como conferir; marque ao terminar. Saiu da montagem do servidor de teste em 30/10/2026 (notebook MCTNBADM041, Windows 11 Business, corporativo no Azure AD). Variáveis do `nuvem.env`: [NUVEM.md](NUVEM.md). Curadoria remota: [planos/2026-10-29-servidor-do-estadio-e-curadoria-remota.md](planos/2026-10-29-servidor-do-estadio-e-curadoria-remota.md).

Comandos em **PowerShell como administrador**, salvo quando o passo diz "no usuário eterna".

## 0. Antes de começar

- [ ] Máquina com Windows 11 Pro ou Business, 16 GB de memória (o recorte dos fundos de IA usa bastante) e disco com folga para as fotos do dia.
- [ ] Roteador do ponto com internet, ou ao menos o servidor com uma segunda saída para a internet.
- [ ] Em mãos: senha de administrador do Windows; acesso à conta da AWS (credencial do perfil do Eterna e segredo da nuvem); conta do Tailscale da TI (ti@maracatour.com.br); DNP e cabo USB; câmeras.
- [ ] Usuário local **eterna**, com senha. É nele que o Eterna roda.

## 1. Windows e energia

- [ ] Atualizações do Windows em dia, e reiniciar.
- [ ] Nunca suspender nem hibernar na tomada:
  ```powershell
  powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0
  ```
- [ ] Notebook: fechar a tampa não faz nada:
  ```powershell
  powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0; powercfg /setactive SCHEME_CURRENT
  ```
- [ ] BIOS: religar sozinho quando a energia voltar (AC Power Recovery = On).

## 2. Rede

- [ ] Ligar o servidor **no cabo** do roteador do ponto e reservar o IP dele no roteador (DHCP reservado). Não pôr IP manual na placa.
- [ ] Marcar a rede do ponto como **Privada**:
  ```powershell
  Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Private
  ```
  Conferir com `Get-NetConnectionProfile`. **Por quê:** em máquina corporativa, a política pode ignorar as regras locais do firewall em rede Pública (`Get-NetFirewallProfile -PolicyStore ActiveStore` mostra `AllowLocalFirewallRules = False`). Aí o servidor recusa tudo o que chega pela rede, mesmo com as regras criadas: o celular dá `ERR_CONNECTION_ABORTED` e a câmera dá "tempo expirado". **Trocou de roteador ou de cabo, faça de novo:** o Windows marca rede nova como Pública.
- [ ] Internet sai pela placa certa. Se o cabo vai para um roteador sem internet e o Wi-Fi tem internet, o cabo não pode ter prioridade, senão o Tailscale e a nuvem não conectam (o DNS falha):
  ```powershell
  Set-NetIPInterface -InterfaceAlias Ethernet -AddressFamily IPv4 -InterfaceMetric 100
  ```
  Conferir com `Test-NetConnection github.com -Port 443`. Para desfazer quando o roteador tiver internet: `-AutomaticMetric Enabled`.
- [ ] O Wi-Fi do ponto **não pode isolar os aparelhos** entre si. A MARACATOUR_CORP e a VIVA-MARACANA isolam, então não servem para câmeras e postos.

## 3. Eterna (no usuário eterna)

- [ ] Instalar o Python 3.12 (python.org), marcando "Add python.exe to PATH".
- [ ] Baixar e rodar `agente\instalar-recorte.bat`. Ele cria o venv e baixa os modelos do recorte (cerca de 350 MB).
- [ ] Rodar `agente\iniciar-eterna.bat` uma vez. Ele baixa o agente mais novo, instala as bibliotecas e cria `~/Eterna`.
- [ ] Conferir: `curl http://127.0.0.1:8765/status` responde `"ok": true`.

## 4. Nuvem e configuração do ponto

- [ ] Quem tem o acesso coloca o perfil da AWS (`~/.aws/credentials`, perfil do Eterna) e o segredo da nuvem. **Nunca por chat ou e-mail.**
- [ ] `~/Eterna/nuvem.env` com nuvem, bucket, perfil, região e API da galeria (tabela em [NUVEM.md](NUVEM.md)), mais:
  - `ETERNA_PASTA`: a pasta raiz do FTP (passo 6);
  - `ETERNA_IMPRESSORA`: o nome exato da DNP (passo 5);
  - `ETERNA_ORIGENS`: todos os endereços pelos quais o Eterna é aberto, separados por vírgula. O passo 8 acrescenta os do Tailscale.
- [ ] Conferir em `/status`: `nuvem.ligada` = true e `s3_ok` = true.

## 5. Impressora

- [ ] Instalar o driver da DNP e ligar no USB. Conferir o nome com `Get-Printer` e copiar exatamente para o `ETERNA_IMPRESSORA`.
- [ ] Teste: uma venda com 4 fotos, e as 4 precisam sair.

## 6. FTP das câmeras

- [ ] Ligar o FTP do Windows (IIS):
  ```powershell
  Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerRole,IIS-FTPServer,IIS-FTPSvc,IIS-ManagementConsole -All
  ```
- [ ] No Gerenciador do IIS, criar o site FTP na porta 21, apontando para a pasta do `ETERNA_PASTA`. Usar autenticação básica, um usuário local de FTP com permissão de gravação e uma faixa de portas passivas. Abrir no firewall a 21 e essa faixa.
- [ ] Uma **subpasta por fotógrafo** (ex.: `\carlos`). Na câmera, o destino aponta para a subpasta dela: é assim que o Eterna sabe quem tirou a foto.
- [ ] Na câmera: Wi-Fi do ponto, servidor = IP reservado, porta 21, usuário do FTP, modo passivo ligado. A câmera precisa aparecer na lista de clientes do roteador; o app do celular só configura, quem conecta é a câmera.
- [ ] Teste: tirar uma foto, e ela aparece em Upload automático em segundos, com o rosto lido.

## 7. Ligar sozinho

- [ ] A pasta do Eterna fica no usuário de quem usa o computador (ex.: Rafael). Nesse usuário, sem administrador: Python 3.12 (`winget install --id Python.Python.3.12 -e --scope user`), a venv em `%USERPROFILE%\Eterna\venv` com as bibliotecas do passo 3 e `agente\instalar-vigia.ps1`.
- [ ] Como administrador: rodar **`agente\instalador\Eterna-Servidor.exe`** (executa o `agente\instalar-servidor.ps1`). Ele:
  - cria a tarefa "Eterna" do **sistema** (SYSTEM), que liga o Eterna com o Windows sem ninguém entrar e sem senha de usuário, e religa se cair;
  - desliga o atalho do vigia na pasta Inicializar, para não subirem dois;
  - libera o firewall: Python, 8765 e 2121, e desfaz o bloqueio que o Windows grava quando alguém clica em **Cancelar** na pergunta do firewall;
  - não deixa dormir na tomada nem com a tampa fechada;
  - põe o atalho "Eterna" na área de trabalho de todos;
  - liga o Eterna e mostra os endereços para os pontos.

  Em máquina corporativa (Azure AD), a tarefa em outro usuário não roda (resultado 267011) e o usuário separado não entra sozinho; por isso a tarefa é do sistema, e o `agente\instalar-tarefa.ps1` ficou só para máquina fora do domínio. Para refazer o `.exe` depois de mudar o script: `agente\instalador\montar.ps1`.
- [ ] Mudou de usuário: copiar a pasta `Eterna` (e `.aws`, `.u2net`) do usuário antigo como administrador, com `robocopy <origem> <destino> /E /B /XD venv programa` (sem o `/B` o administrador leva "Acesso negado" na pasta de outro usuário).
- [ ] Teste: reiniciar o servidor e entrar no usuário de sempre. Em até 2 minutos, `/status` responde.

## 8. Acesso remoto (Tailscale)

- [ ] Rodar `agente\preparar-tailscale.ps1`. Ele instala o Tailscale, acrescenta os endereços no `ETERNA_ORIGENS`, libera a 8765 só para a rede local e o Tailscale, e reinicia o Eterna.
- [ ] Se o login pelo navegador não abrir: no painel, Settings › Keys › Generate auth key (uso único). Salve num arquivo na área de trabalho do servidor e rode `tailscale up --unattended --authkey (Get-Content <arquivo>)`. Depois, apague o arquivo.
- [ ] No painel, em Machines, no "…" do servidor: **Disable key expiry**.
- [ ] Área de trabalho remota ligada, aberta só para a rede local e o Tailscale.
- [ ] Conta do Tailscale fora do trial (plano gratuito ou pago).

## 9. Teste final, de ponta a ponta

- [ ] Do servidor: `http://127.0.0.1:8765` abre.
- [ ] De um posto ou celular no Wi-Fi do ponto: `http://<ip-reservado>:8765` abre, com as fotos visíveis.
- [ ] De fora, com Tailscale: `http://<nome-do-servidor>:8765` abre, com as miniaturas e a foto ampliada.
- [ ] Câmera → foto aparece → selfie no Checkout acha a pessoa → venda → impressão na DNP → QR abre a galeria no celular (eterna.photo).
- [ ] Cartão com QR impresso: ler com a pistola dentro de uma venda, e o mesmo QR aparece na tela do cliente.

## 10. Pegadinhas da montagem remota

- AnyDesk sem instalar não digita em janela de administrador. Use **Ações › Solicitar direitos de administrador**, e alguém aceita do outro lado.
- No PowerShell, clicar dentro da janela ativa o modo "Selecionar" e **pausa** o comando que está rodando. Esc volta.
- Colar pelo AnyDesk: espere 2 a 3 segundos depois de copiar antes do Ctrl+V, até a área de transferência sincronizar.
