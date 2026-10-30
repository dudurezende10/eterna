# Checklist do servidor do Eterna (estádio)

Lista para montar ou trocar o servidor do ponto. Saiu da montagem do servidor de teste em 30/10/2026: notebook MCTNBADM041, Windows 11 Business, corporativo no Azure AD. Cada item diz como conferir. Variáveis do `nuvem.env`: [NUVEM.md](NUVEM.md). Curadoria remota: [planos/2026-10-29-servidor-do-estadio-e-curadoria-remota.md](planos/2026-10-29-servidor-do-estadio-e-curadoria-remota.md).

## 1. Rede

- [ ] **Rede dos postos e das câmeras marcada como Privada.**
  Conferir: `Get-NetConnectionProfile`.
  Corrigir: `Set-NetConnectionProfile -InterfaceAlias <placa> -NetworkCategory Private`.
  Por quê: em máquina corporativa, a política da empresa pode ignorar as regras locais do firewall em rede **Pública** (`AllowLocalFirewallRules = False`, ver com `Get-NetFirewallProfile -PolicyStore ActiveStore`). Nesse caso tudo o que chega pela rede é recusado, mesmo com a regra criada. O sintoma foi o celular dar `ERR_CONNECTION_ABORTED` no Eterna e a câmera dar "tempo expirado" no FTP, enquanto pelo Tailscale (rede Privada) funcionava. **Trocou de roteador ou de cabo, confira de novo:** o Windows marca a rede nova como Pública.
- [ ] **IP fixo:** reservar o IP do servidor no roteador (DHCP reservado). Não mudar a placa para IP manual.
- [ ] **Internet pela placa certa.** Com duas placas (cabo num roteador sem internet e Wi-Fi com internet), a placa sem internet não pode ter prioridade, senão Tailscale e nuvem não conectam (DNS falha).
  Conferir: `Get-NetIPInterface -AddressFamily IPv4` (menor métrica ganha).
  Corrigir: `Set-NetIPInterface -InterfaceAlias Ethernet -AddressFamily IPv4 -InterfaceMetric 100`.
  Desfazer: `-AutomaticMetric Enabled`.
- [ ] **Isolamento de Wi-Fi:** a rede de câmeras e postos não pode isolar os aparelhos entre si. A MARACATOUR_CORP e a VIVA-MARACANA isolam. Conferir abrindo `http://<ip-do-servidor>:8765` num celular dessa rede.

## 2. Eterna

- [ ] Python 3.12 e venv: `agente\iniciar-eterna.bat` (instala boto3, cryptography e o recorte).
- [ ] `~/Eterna/nuvem.env` com `ETERNA_ORIGENS` (todos os endereços pelos quais o Eterna é aberto: IP da rede, IP e nome do Tailscale, separados por vírgula), `ETERNA_IMPRESSORA` e `ETERNA_PASTA`.
- [ ] Segredo da nuvem e credenciais da AWS: quem tem o acesso coloca. Nunca copiar por chat.
- [ ] Vigia: `agente\instalar-vigia.ps1` no usuário que roda o Eterna (atalho "Eterna vigia" na pasta Inicializar). Outro usuário do Windows pode ligar o mesmo Eterna com `ETERNA_BASE` (ver o cabeçalho de `eterna-vigia.ps1`).
- [ ] Firewall: porta 8765 só para a rede local e o Tailscale (`agente\preparar-tailscale.ps1` cria a regra).
- [ ] Conferir: `curl http://127.0.0.1:8765/status`, de um posto `http://<ip>:8765` e de fora `http://<nome-tailscale>:8765`.

## 3. Câmeras (FTP)

- [ ] Serviço FTP ligado na porta 21 (`Get-NetTCPConnection -LocalPort 21 -State Listen`), com regra de entrada no firewall.
- [ ] Modo passivo ligado na câmera. Se conectar e travar no envio, abrir no firewall a faixa de portas passivas do servidor FTP.
- [ ] Câmera no **mesmo Wi-Fi** do servidor. Ela precisa aparecer na lista de clientes do roteador. O app do celular só configura; quem conecta é a câmera.
- [ ] Destino na câmera: IP do servidor, porta 21, usuário do FTP. Trocar quando o IP do servidor mudar.

## 4. Impressora

- [ ] DNP instalada (`Get-Printer`) com o mesmo nome do `ETERNA_IMPRESSORA`.
- [ ] Teste de uma venda com 4 fotos: as 4 precisam sair.

## 5. Acesso remoto (Tailscale)

- [ ] Rodar `agente\preparar-tailscale.ps1` como administrador. Se o login pelo navegador não abrir, usar uma chave de uso único (painel › Settings › Keys) com `tailscale up --unattended --authkey ...` e apagar o arquivo da chave depois.
- [ ] No painel, **Disable key expiry** no servidor.
- [ ] Área de trabalho remota ligada, aberta só para a rede local e o Tailscale.
- [ ] Conta Tailscale: sair do trial para o plano gratuito ou pago antes de vencer.

## 6. Energia e religar sozinho

- [ ] Nunca suspender nem hibernar na tomada: `powercfg /change standby-timeout-ac 0` e `hibernate-timeout-ac 0`. Se for notebook, fechar a tampa não faz nada: `LIDACTION 0`.
- [ ] Windows entra sozinho no usuário do Eterna (Autologon da Sysinternals, feito por quem tem a senha).
- [ ] BIOS: religar quando a energia voltar (AC Power Recovery = On).

## 7. Pegadinhas da montagem remota

- AnyDesk sem instalar não digita em janela de administrador. Use **Ações › Solicitar direitos de administrador**, e alguém aceita do outro lado.
- No console do PowerShell, clicar dentro da janela ativa o modo "Selecionar" e **pausa** o comando que está rodando. Esc volta.
