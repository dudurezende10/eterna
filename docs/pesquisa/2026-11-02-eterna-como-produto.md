# O Eterna como produto: segurança, infraestrutura e escala (02/11/2026)

**Só análise. Nada daqui entra no Eterna agora.** Primeiro precisamos planejar como cada item se encaixa no que já existe e decidir junto com o Eduardo. Claude: não implemente nenhum item deste documento sem um plano aprovado.

Pedido do Ronaldo: pensar no Eterna como produto vendável para outros venues, que **não pode ser invadido nem perder dados**. Base: uma auditoria independente do código (agente, app, nuvem, instaladores) feita em 02/11, a análise de mercado (`2026-11-02-o-que-o-mercado-tem-e-o-eterna-nao.md`) e o que os fornecedores mostraram:
- Magic Memories: pentest externo, política de guarda por tipo de visitante, suporte 24 horas;
- GoPhoto: privacidade da selfie.

**Os achados detalhados de segurança não estão neste repositório, porque ele é público.** Eles ficam com o Ronaldo e o Eduardo até serem corrigidos. Aqui só aparecem as conclusões e as prioridades.

## 1. Desenho-alvo (decisões do Ronaldo em 02/11)

- **Um servidor do Eterna por venue**, em **Linux**. Distribuição recomendada: **Ubuntu Server 24.04 LTS**, com suporte até 2029 e estendido até 2034. Ele traz o Python 3.12 da venv atual, tem as bibliotecas de rosto e recorte testadas, e tem CUPS e Gutenprint empacotados. A alternativa é o Debian 12 ou 13, mais conservador.
- **Pontos de venda** no Chrome, pela rede do venue. **Impressão** pelo servidor ou pela DNP ligada no ponto.
- **Suporte remoto só pela VPN do FortiGate.** O Tailscale sai.
- **Funciona sem internet.** Com internet, o servidor sobe para a nuvem as fotos vendidas, os backups e as galerias. O cliente compra pela nuvem.

## 2. Situação hoje, em uma frase por área

| Área | Situação |
|---|---|
| **Quem pode fazer o quê** | O login e as permissões existem só na tela do navegador. **O servidor ainda não exige identificação** nas operações sensíveis, e confia em quem está na rede. O próprio projeto já registra isso como pendente (DOCUMENTACAO-TECNICA). |
| **Rede** | Tudo trafega sem criptografia (http) na rede local, inclusive selfie e foto de menor. O FTP das câmeras também. |
| **Servidor** | O programa fica na pasta de um usuário comum e roda como SYSTEM. Os segredos ficam em arquivos de texto nessa mesma pasta. |
| **Atualização** | Desde 02/11 só entra versão liberada e com o SHA-256 conferido. Ainda falta **assinatura** (provar quem publicou), e tudo depende de uma conta pessoal do GitHub. |
| **Perda de dados** | As vendas e a equipe vão para a nuvem a cada 2 minutos. **As fotos originais e os rostos ficam só no disco do servidor.** A chave do servidor consegue apagar o próprio backup, e **a restauração nunca foi testada**. |
| **Biometria** | Os rostos são guardados sem criptografia por 60 dias. As fotos originais não têm prazo de exclusão. |
| **Operação** | Não há monitoramento central nem alerta: queda, disco cheio e falha de backup só aparecem se alguém abrir o `/status`. |
| **Escala** | Atende um venue. A busca por rosto atende uma selfie por vez para todos os caixas, o que precisa de medição em dia de jogo. A nuvem e a marca estão presas ao Maracanã. |

## 3. Princípios para o produto

1. **O servidor confere tudo.** Não basta a tela esconder botões: cada pedido ao servidor diz quem é (o aparelho pareado e a pessoa logada), e o servidor confere a permissão.
2. **Nada em texto puro.** https na rede local e na VPN, segredos cifrados, disco cifrado.
3. **Menor privilégio.** O serviço roda com usuário próprio, sem ser administrador. A chave da nuvem de cada venue só grava o que precisa e **nunca apaga backup**.
4. **Backup que sobrevive a ransomware.** Bucket separado, versionado e com bloqueio contra exclusão por 30 a 90 dias (Object Lock), cópia em outra região, **e restauração testada com o tempo medido**.
5. **Só roda código assinado** por quem pode liberar, com a chave pública fixada no servidor e aprovação de duas pessoas.
6. **Biometria é dado sensível (LGPD art. 11):** prazo curto, cifrada, exclusão automática, registro do consentimento e do responsável no caso de menor.
7. **Ver antes do cliente:** cada servidor manda sinal de vida e métricas para um painel central, com alerta.
8. **Produção não aceita configuração de teste:** o servidor confere ao ligar e se recusa a subir com opções de teste.

## 4. Linux: o que muda

| Hoje (Windows) | No Linux |
|---|---|
| Impressão pelo PowerShell | Pillow (corte 10×15) e CUPS/IPP para enviar e ler a fila. **A DNP DS-RX1HS aparece no Gutenprint, mas precisa de teste de bancada** (corte, contador de mídia, velocidade) antes de decidir. Conferir também se há driver Linux oficial da DNP. |
| Tarefa do sistema e vigia | Serviço `systemd` com usuário `eterna` sem shell, religando sozinho, com as proteções do systemd. Programa em `/opt/eterna` (dono root) e dados em `/var/lib/eterna`. |
| Atualização pelo vigia | Pacote `.deb` assinado, num repositório próprio, ou release assinada conferida por um timer. |
| Firewall do Windows | nftables/ufw: a 8765 só para os caixas e a VPN; a 2121 só para a rede das câmeras; SSH só pela VPN. |
| powercfg | Servidor sem suspensão e com a BIOS religando quando a energia volta. |
| (sem BitLocker) | LUKS no disco de dados, com desbloqueio pelo TPM. |
| Windows Update | Atualização automática de segurança em janela fora do horário, e registro de acesso (auditd). |

## 5. Acesso remoto pela VPN (sem Tailscale)

- **VPN do FortiGate com MFA**, uma conta por pessoa e nada compartilhado.
- O grupo de suporte do Eterna **alcança só o servidor, só nas portas de SSH e https.** Nada na rede dos caixas e das câmeras, e nada publicado para a internet.
- **SSH só por chave**, sem senha e sem root. Registro de acessos guardado por pelo menos 6 meses.
- **Acesso a partir dos EUA** é transferência internacional (LGPD art. 33): prazo e revisão de acesso.
- **Câmera dos caixas sem a flag do Chrome:** um nome interno (ex.: `eterna.maracana.<domínio>`) que resolve para o servidor na rede e na VPN, com certificado gratuito (Let's Encrypt pelo DNS, sem expor nada à internet) num proxy https na frente do Eterna. A alternativa é uma autoridade certificadora interna distribuída nos caixas.
- O que hoje depende do Tailscale sai do caminho: `preparar-tailscale.ps1`, nomes `.ts.net` e IPs 100.x no `ETERNA_ORIGENS`.

## 6. Top 10 antes de operar com clientes de verdade (01/12)

1. **Identificação no servidor:** pareamento de cada caixa e login de pessoa conferido pelo servidor, com permissão em toda operação. A galeria do cliente continua aberta pelo QR.
2. **Configurações sensíveis** (chaves de integração, FTP remoto) só pelo próprio servidor, com login de admin.
3. **Fechar o acesso de outros sites** ao servidor pelo navegador do caixa (CORS).
4. **Programa fora da pasta do usuário**, protegido, e serviço com usuário próprio. No Linux isso já nasce assim.
5. **Release assinada**, repositório na organização com 2FA e proteção de tag, e canal de teste desligado em produção.
6. **Backup à prova de ransomware** e **teste de restauração cronometrado e documentado.**
7. **Disco cifrado** e exclusão automática das fotos originais e dos rostos no prazo.
8. **https na rede local**, câmeras em rede isolada e firewall só para quem precisa.
9. **Monitoramento com alerta:** queda, disco, backup, fila de rostos e impressora.
10. **Servidor recusa configuração de teste em produção:** pagamento simulado, busca de vários dias, chaves de teste.

## 7. Top 10 para virar produto

1. **Multi-cliente na nuvem**: dados, fotos e rostos separados por cliente, cada um com sua chave de criptografia, sem nada fixo do Maracanã.
2. **Identidade central**: login único com o SSO do cliente, MFA, permissões no servidor e registro de auditoria que não se apaga.
3. **Servidor padrão por venue**: imagem Linux pronta, pacote assinado, painel da frota (versão, saúde, voltar versão por venue).
4. **App modular**, com build, testes automáticos, política de segurança do navegador (CSP) e marca por configuração. Hoje é um arquivo único de cerca de 600 KB.
5. **Observabilidade e SLA**: métricas, logs centrais, página de status, plantão e roteiros de incidente.
6. **Pagamento real** com conciliação automática (TEF, webhook assinado) e cobrança por venue e por uso.
7. **Pacote de privacidade**: RIPD para biometria e menores, DPA, lista de suboperadores (AWS nos EUA), painel de direitos do titular, política de guarda. Nos EUA, leis estaduais de biometria (Illinois BIPA, Texas, Washington).
8. **Segurança comprovável**: pentest externo anual, lista de componentes (SBOM) e varredura de dependências a cada versão, canal para relatar falhas. Depois, SOC 2 Type II e ISO 27001. A Magic Memories não tem nenhum dos dois: isso pode virar diferencial.
9. **Implantação de venue**: instalador e checklist automáticos, contrato com SLA, níveis de suporte, documentação para cliente e integrador.
10. **Busca por rosto em escala**: fila e paralelismo (ou serviço próprio com índice vetorial), com teste de carga de dia de jogo como condição para liberar versão.

## 8. Ainda não verificado

- A DNP DS-RX1HS no Linux, em bancada.
- Se a regra de expiração do bucket de produção poupa a pasta de backup.
- O desempenho em dia de jogo.
- A política de acesso (IAM) real da produção.
