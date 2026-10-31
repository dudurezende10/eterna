# Instalador do servidor do Eterna

30/10/2026. Proposta do Ronaldo depois da tarde perdida no servidor de teste (MCTNBADM041). Para o Eduardo revisar antes de começar. Escopo: **só o servidor do ponto**. Os pontos (caixa, checkout, curadoria) continuam sem instalar nada; aqui fica só como eles chegam ao servidor, que permissão precisam e como as impressoras são nomeadas.

## Por que

Hoje subir um servidor é o [CHECKLIST-SERVIDOR.md](../CHECKLIST-SERVIDOR.md) feito na mão, e cada passo esquecido derruba tudo. Em 30/10 foram três:

- **Usuário do Windows.** O Eterna roda dentro de um usuário logado (vigia na pasta Inicializar). Reiniciou e entrou outro usuário, ele não subiu. A tarefa agendada (`agente/instalar-tarefa.ps1`) foi o remendo do dia.
- **Firewall de máquina corporativa.** Em rede Pública, a política ignora as regras locais. Ninguém da rede conectava.
- **Prioridade de rede.** O cabo do roteador sem internet vencia o Wi-Fi com internet: o DNS falhava, e o Tailscale e a nuvem não conectavam.

Mais dois pontos frágeis que o instalador também resolve:

- **Versão.** O vigia baixa o `eterna-agente.py` do `main` a cada início, e o agente busca o `index.html` em eterna.photo (GitHub Pages do `main`) a cada 60 s (`app()`, `APP_ORIGIN`). Todo push vai direto para o estádio, mesmo em teste, e sem internet o app novo não carrega.
- **Montagem.** Python, venv e modelos do recorte são instalados à mão.

## O que o instalador faz

`Eterna-Servidor-Setup.exe`, feito com Inno Setup (grátis, gera um .exe só, roda como administrador uma vez).

1. **Programa** em `C:\Program Files\Eterna`:
   - Python embutido (python.org "embeddable", sem depender do Python da máquina), com as bibliotecas já dentro (OpenCV, numpy, psutil, boto3, cryptography, rembg);
   - agente e app da versão liberada (ver "Atualizações").
   - Os modelos do recorte (cerca de 350 MB) são baixados no fim da instalação, com barra de progresso.
2. **Dados** numa pasta escolhida na instalação. O padrão é `D:\Eterna` se existir, senão `C:\EternaDados`. Fotos, miniaturas, sessões, fila de impressão, `nuvem.env`, `ftp.json`. O agente passa a ler a pasta de `ETERNA_DADOS` em vez de `~/Eterna`. Hoje o `ETERNA_BASE` faz isso trocando o `USERPROFILE`; o novo jeito é o caminho direto.
3. **Serviço do Windows "Eterna"**, com WinSW (um .exe e um .xml, licença MIT):
   - inicia com a máquina, **sem ninguém logado e sem depender de qual usuário entra**;
   - se o processo cair, o Windows religa em 10 s; o vigia deixa de existir, e o travamento vira um teste de `/status` dentro do próprio serviço;
   - roda numa **conta própria** (usuário local `eterna`, senha gerada pelo instalador e guardada só no Gerenciador de Serviços). Ninguém faz login nela, então ninguém precisa saber a senha.
4. **Rede:**
   - marca a rede do cabo como Privada;
   - acerta a prioridade: a placa com internet tem a métrica menor;
   - cria a regra do firewall para a 8765 (rede local e 100.64.0.0/10 do Tailscale) e para o FTP (21 e as portas passivas).
   - Em máquina corporativa, confere `AllowLocalFirewallRules` e avisa na tela se a política bloqueia, em vez de fingir que deu certo.
5. **Energia:** não suspender na tomada, a tampa não faz nada, ligar na bateria.
6. **Perguntas na tela** (gravadas no `nuvem.env` da pasta de dados; quem instala digita, nunca por chat ou e-mail):
   - nome do ponto (ex.: "Tour Maracanã");
   - nuvem: bucket, região, chaves da AWS e segredo da galeria;
   - impressoras (ver "Impressoras");
   - FTP das câmeras: o FTP do próprio Eterna (porta 2121) ou a pasta de um FTP do Windows que já exista.
7. **Atalhos** para todos os usuários: "Eterna" (abre `http://localhost:8765`) e "Eterna · Diagnóstico".
8. **Diagnóstico** (no fim da instalação e pelo atalho): testa cada item e diz em português o que está errado e como resolver. Itens:
   - serviço no ar;
   - rede Privada;
   - política do firewall;
   - porta aberta para a rede;
   - internet e DNS;
   - nuvem (S3);
   - impressoras;
   - FTP recebendo;
   - Tailscale;
   - espaço em disco.
9. **Tailscale:** opcional, marcado por padrão. Instala, e quem instala cola uma auth key de uso único da conta da TI, sem login pelo navegador. O instalador já põe o nome e o IP do Tailscale no `ETERNA_ORIGENS`.

Desinstalar remove o programa, o serviço e as regras. **A pasta de dados fica**: fotos e vendas nunca são apagadas pelo desinstalador.

## Atualizações

- **Só versão liberada.** O servidor não lê mais o `main`. Quando uma versão está testada, o Eduardo ou o Ronaldo cria uma release no GitHub (ex.: `v90`). O pacote da release leva `eterna-agente.py`, a pasta do app (`index.html` e os arquivos dele) e um `manifesto.json` com a versão e o SHA-256 de cada arquivo. O `main` continua livre para trabalhar.
- **O app vem do servidor, não do eterna.photo.** O agente serve o app da versão instalada, da pasta local. Funciona sem internet, e o app e o agente são sempre da mesma versão. O eterna.photo continua sendo o protótipo e a galeria do cliente.
- **Conferência:** a cada 30 min, o serviço olha a última release.
- **Antes de trocar:**
  - baixa a release numa pasta ao lado;
  - confere o SHA-256 de cada arquivo;
  - testa que o agente abre (`python -c "import ast; ..."` e um start de teste numa porta livre, respondendo `/status`).
- **Quando troca:** só com o ponto parado:
  - sem venda aberta;
  - fila de impressão vazia;
  - nenhuma foto chegando há 5 min;
  - dentro da janela configurada (padrão: 06:00 às 08:30 e depois das 18:00).
- **Volta sozinho:** depois de trocar, se `/status` não responder em 60 s, volta para a versão anterior e marca a release como recusada neste servidor. Ficam guardadas as 3 últimas versões.
- **Painel de controle:** "Versão v90 · liberada em 30/10 · Atualizar agora · Voltar para a anterior". A troca manual respeita a fila de impressão (espera esvaziar).
- **Canal de teste:** `ETERNA_CANAL=teste` faz o servidor seguir o `main` como hoje, para o notebook de teste. O padrão é `estavel`.

Os pontos não atualizam nada: recarregou a página, estão na versão do servidor.

## Os pontos

**Endereço.** Cada ponto abre o servidor no Chrome, por um destes:

| De onde | Endereço | Observação |
|---|---|---|
| Rede do ponto (cabo ou Wi-Fi do roteador do Eterna) | `http://<nome-do-servidor>:8765` ou `http://<ip-reservado>:8765` | O IP é **reservado no roteador** (DHCP), nunca manual na placa. O nome nem sempre resolve em rede sem DNS, então o IP é o principal. |
| Fora, com Tailscale (curadoria, suporte) | `http://<nome-tailscale>:8765` | Ex.: `http://mctnbadm041:8765`. |
| O próprio servidor | `http://localhost:8765` | Atalho na área de trabalho. |

O instalador mostra esses endereços no fim e no Diagnóstico, já com o IP real.

**O que o ponto precisa:**

- **Rede:** estar na rede do ponto, num Wi-Fi que **não isola os aparelhos** (a VIVA-MARACANA e a MARACATOUR_CORP isolam), ou ter o Tailscale.
- **Chrome com câmera liberada para o endereço do servidor**, para a selfie no Checkout. O Chrome só dá câmera em HTTPS ou localhost. Duas saídas:
  - **Agora:** a política do Chrome `OverrideSecurityRestrictionsOnInsecureOrigin` com o endereço do servidor. É uma chave de registro, sem mexer em flags. O instalador do servidor gera um `liberar-camera.reg` com os endereços certos, para rodar uma vez em cada ponto.
  - **Depois:** HTTPS. Pelo Tailscale (certificado de `*.ts.net`, sem configuração no ponto) ou com certificado próprio do Eterna.
- **Login no Eterna:** e-mail e código, como hoje. O que cada pessoa vê vem do perfil dela no app (vendedor, caixa, curador, admin). Isso não muda com o instalador.
- **Windows:** nenhuma permissão de administrador no ponto, a não ser para rodar o `liberar-camera.reg` uma vez.

## Impressoras

**Nome no Windows = nome no Eterna.** O Eterna manda imprimir pelo nome exato da impressora no Windows (`ETERNA_IMPRESSORA`, uma ou várias separadas por vírgula). Hoje a DNP aparece como "DS-RX1", "DS-RX1 (2)", e ninguém sabe qual é qual.

**Proposta:**

1. **Renomear no Windows** cada DNP com o lugar dela: `DNP Caixa 1`, `DNP Caixa 2`, `DNP Reserva`. O instalador lista as impressoras encontradas (`Get-Printer`), mostra a porta USB de cada uma e deixa renomear ali mesmo. Para saber qual é qual, tem o botão **"Imprimir teste"**: sai uma folha escrito o nome na impressora certa.
2. **Ligar cada caixa às suas DNPs** (`ETERNA_IMPRESSORA_POSTOS`, já existe). Na tela:

   | Posto | Imprime em |
   |---|---|
   | Caixa 1 | DNP Caixa 1 |
   | Caixa 2 | DNP Caixa 2, DNP Reserva |
   | Checkout | qualquer livre |

   O nome do posto é o que cada ponto escolhe no app ao entrar (`#posto`). Posto fora da lista usa qualquer DNP livre. "Local" continua valendo para um posto com DNP ligada nele mesmo.
3. **Trocou a DNP de USB ou de máquina:** o Windows cria "DS-RX1 (2)" de novo. O Diagnóstico avisa "a impressora DNP Caixa 1 não existe mais; achei DS-RX1 (2) nova" e oferece renomear.

**Risco a testar primeiro:** a impressão sai por PowerShell com System.Drawing (`imp_ps1()`). Rodando como serviço, sem ninguém logado, a Microsoft não garante isso. Antes de tudo, testar no notebook de teste: o serviço imprimindo 4 fotos na DNP. Se falhar, o plano B é o serviço entregar a impressão para um pequeno "impressor" que roda no usuário logado. Isso não muda o resto do plano.

## Ordem de trabalho

1. **Prova do serviço** no MCTNBADM041:
   - WinSW com o agente atual;
   - reinício sem ninguém logado;
   - impressão na DNP;
   - câmera pelo FTP.

   Se a DNP falhar como serviço, decidir o plano B antes de seguir.
2. **Mudanças no agente:**
   - `ETERNA_DADOS`;
   - servir o app da pasta local;
   - conferência e troca de versão;
   - Painel de controle "Versão";
   - Diagnóstico como rota (`/diagnostico`).
3. **Release:** pacote com manifesto, montado por uma GitHub Action quando alguém cria a tag `vNN`.
4. **Instalador Inno Setup**, com as telas de nuvem, impressoras e FTP.
5. **Teste completo** numa máquina limpa. O checklist vira o roteiro de teste do instalador.

## Para o Eduardo decidir

- **Releases:** quem libera versão? Uma tag `vNN` no GitHub está bom?
- **App:** servir da pasta local da versão em vez do eterna.photo?
- **Conta:** o serviço roda numa conta local `eterna` com senha só no Gerenciador de Serviços. Alternativa: conta de serviço virtual (`NT SERVICE\Eterna`), mas aí as credenciais da AWS ficam só no `nuvem.env`.
- **Pasta de dados:** padrão `D:\Eterna` ou `C:\EternaDados`?
- **Janela de atualização:** padrão 06:00 às 08:30 e depois das 18:00?
