# Servidor do estádio (29/10) e curadoria remota

Para: Eduardo. De: Ronaldo (TI Maracatour). 29/10/2026.

Durante o teste de ponta a ponta de hoje, o Eterna passou a funcionar como **servidor central**: as fotos ficam num computador só, todos os postos abrem esse servidor pelo navegador e a impressão sai na DNP ligada nele. Este documento junta o que mudou e propõe como você faz a curadoria de Miami. Os achados do teste estão em [`2026-10-29-achados-teste-ponta-a-ponta.md`](2026-10-29-achados-teste-ponta-a-ponta.md).

## 1. O que entrou no main hoje

### Servidor na rede
| Mudança | Onde | Para quê |
|---|---|---|
| `ETERNA_ORIGENS` | agente (`origem_local`, `posto()`) | endereços pelos quais os postos abrem o servidor (ex.: `http://192.168.10.218:8765`). Liberam busca de rosto, publicar galeria, imprimir, recorte da v84, fila de impressão e LGPD. Antes só o próprio computador podia, e o Checkout aberto pela rede dizia "não achamos você" e mostrava o fundo de IA sem as pessoas |
| `~/Eterna/nuvem.env` | agente (`_ler_nuvem_env`) | toda a configuração do ponto num arquivo (`ETERNA_*`): pasta do FTP, impressora, origens, nuvem. O que estiver definido no ambiente vale mais |
| Pasta vigiada retoma 12 h | `pasta_vigiada` | foto que chegou ao FTP com o Eterna desligado entra ao religar (`ETERNA_PASTA_RETOMAR`, padrão 12 h). A que o Eterna já tinha não duplica |
| `POST /nuvem/reenviar` | agente | manda para a nuvem as fotos e galerias de antes de a nuvem ser ligada |
| Checkout sem câmera | app (`camMount`) | com o agente ligado, não sorteia mais sessão: pede o código ou a lista. A simulação fica só na demonstração |

### Impressão pelo servidor
| Mudança | Onde | Para quê |
|---|---|---|
| `ETERNA_IMPRESSORA=DS-RX1` | agente (`POST /imprimir`) | o botão Imprimir de qualquer posto manda as fotos montadas (1800 px) para o servidor, que imprime na DNP dele. Sem a variável, continua o `window.print()` |
| Uma foto por vez | `IMP_PS1` (PowerShell + System.Drawing) | a DS-RX1 descartava o que chegava enquanto imprimia, tanto vários trabalhos seguidos como várias páginas num trabalho. Agora vai uma foto, espera a fila do Windows esvaziar e a impressora sair de "imprimindo", e manda a próxima. Página sempre em pé; foto deitada é girada 90° |
| Fila única em ordem de chegada | `imp_fila`, `imprimir_fila` | vários vendedores ao mesmo tempo: uma venda inteira por vez, sem misturar fotos. O vendedor recebe "enviado · N pedidos na frente" na hora |
| Fila gravada em disco | `~/Eterna/impressao/fila.json`, `imp_retomar` | se o servidor reiniciar, continua de onde parou, só com as fotos que faltavam |
| Tela **Dashboard → Fila de impressão** | app (`vImpFila`, `GET /impressao/fila`) | painel estilo senha de lanchonete: na fila, imprimindo agora (com progresso), prontas para retirar e erros. Botão Tela cheia para TV. Módulo de permissão: Estoque |

### Servidor que se recupera sozinho
| Peça | Arquivo | Como funciona |
|---|---|---|
| Vigia | `agente/eterna-vigia.ps1` | liga o Eterna; a cada 30 s pergunta `/status` com `curl -m 10`. Três faltas seguidas (cerca de 1min30) ou o processo fechado, e ele mata o que sobrou, baixa o main e liga de novo. Registro em `~/Eterna/vigia.log` |
| Instalador | `agente/instalar-vigia.ps1` | sem administrador: põe o vigia na pasta Inicializar do usuário |
| Testado no 218 | — | Eterna derrubado: voltou sozinho em 80 s. O teste de travamento falhou na primeira versão, porque o `Invoke-WebRequest` ficava preso. Corrigido com o `curl`, mas o teste ainda precisa ser repetido |

Ainda dependem do administrador do servidor: entrada automática do Windows no usuário (Autologon), BIOS religando quando a energia volta, sem suspender nem hibernar, horário do Windows Update e IP fixo.

### Cliente e LGPD
| Mudança | Onde |
|---|---|
| Recibo do Caixa: **Mostrar ao cliente** manda o QR da venda para a tela do Checkout (BroadcastChannel `eterna-loja`, mensagem `mostrar-qr`) | app |
| Quem já comprou e volta à câmera vê de novo o QR e o código da galeria | app (quiosque) |
| Recibo: **Apagar as fotos do cliente** (LGPD, art. 18), só com permissão de Galerias. Apaga foto, miniatura, recorte, rostos lidos, fila e bucket da nuvem, encerra a galeria (a nuvem apaga os rostos da AWS), bloqueia a foto para não voltar pelo FTP (`lgpd-excluidas.json`) e registra em `lgpd.log` sem dado pessoal. A venda continua no financeiro, sem as fotos | agente `POST /lgpd/excluir` + app |
| A selfie não é guardada em lugar nenhum (balcão, servidor e nuvem); só fica o registro do consentimento, sem imagem | — |
| Celular: selfie automática quando a câmera vê um rosto de frente por duas leituras seguidas; o botão continua como reserva | app (`selfieMount`) |
| Celular: foto comprada aparece sem marca d'água | app (`pubImg`) |
| Consentimento da nuvem sem citar o provedor (versão `-nuvem2`) | app |
| Caixa: a caixa "Aguardando pagamento" some quando está vazia | app |

### v84 no main
O `wip/v84` (recorte local) foi juntado com o main por decisão do Ronaldo. Houve um conflito numa linha (`agentPoll`), resolvido mantendo `a.recorte` e `a.impressora`. Dos testes do `testes/v84_agente.py`, 3 falharam no Windows por causa do ambiente: sem os modelos, `chmod`. Rode os testes no seu ambiente. Recorte testado no notebook com foto da equipe: 14 s na primeira foto (o modelo carregando). Ele levou junto a beirada da mesa e o braço da cadeira encostados na pessoa.

## 2. Pendências para você (ordem de prioridade)
1. **Sessão montada no servidor** (achado 1): hoje a sessão nasce no navegador que está aberto quando as fotos chegam. No servidor, foto que chega com a tela de Upload fechada não vira sessão.
2. **Várias vendas por sessão** (achado 2): o cliente que volta precisa poder comprar mais.
3. **Checkout depois da selfie:** galeria em grade com a foto inteira (as miniaturas cortam as pessoas e o cliente não escolhe). E as telas do cliente sem scroll: pacotes lado a lado, QR com as instruções ao lado, botão principal sempre visível.
4. **Espera da sessão:** baixar os 45 s para 15 a 20 s.
5. **HTTPS no servidor** com um nome do domínio (ex.: `maracana.eterna.photo` apontando para o IP interno, certificado por validação DNS): libera a câmera do balcão em todos os postos e tira o "Não seguro".

## 3. Curadoria remota (você em Miami)

As fotos ficam no servidor do estádio, dentro da rede de lá. O eterna.photo, aberto de fora, procura o Eterna no próprio computador (`127.0.0.1`), e ele não está lá. Por isso hoje não dá para curar de fora.

### Caminho 2 · agora: rede privada até o servidor (Tailscale)
Você abre o Eterna do servidor no navegador do Mac como se estivesse no estádio: curadoria, fila de impressão, painel e Upload. Não abre nenhuma porta na internet, porque a conexão é criptografada ponta a ponta e só os aparelhos aprovados entram.

1. Criar a conta do Tailscale da TI Maracatour (gratuita até 100 aparelhos), com o e-mail da TI.
2. **No servidor** (precisa de administrador): instalar o Tailscale para Windows, entrar com a conta da TI, marcar *Run unattended* para funcionar sem ninguém logado e desligar a expiração da chave desse aparelho no painel.
3. **No seu Mac:** instalar o Tailscale e entrar com o convite da conta da TI.
4. No painel do Tailscale, anotar o endereço do servidor (`100.x.y.z`, ou o nome MagicDNS, ex.: `servidor-maracana`).
5. Acrescentar esse endereço no `nuvem.env` do servidor e reiniciar pelo vigia:
   `ETERNA_ORIGENS=http://192.168.10.218:8765,http://servidor-maracana:8765`
6. No Mac: `http://servidor-maracana:8765`.
7. Regra de acesso (ACL) no Tailscale: só o grupo da curadoria alcança a porta 8765 do servidor.

Limitação: a câmera do balcão continua pedindo HTTPS (`tailscale cert` resolve com o nome `.ts.net`). Para curadoria, não faz falta.

### Caminho 3 · evolução: curadoria pela nuvem no eterna.photo
O servidor já sobe todas as fotos para o S3 (`vitrine/` e `alta/`). A curadoria passa a ler de lá, de qualquer lugar e sem depender do servidor estar acessível.

- **Login real da equipe** (plano v85, parte H): e-mail com código, conferido na API da nuvem, e papéis vindos das Permissões.
- **API da nuvem** (estende `servidor/galeria-nuvem`), com rotas para a equipe autenticada:
  - `GET /equipe/sessoes?dia=` → sessões e fotos do dia;
  - `GET /equipe/foto/<pid>` → link assinado da vitrine ou da alta;
  - `POST /equipe/curadoria` → `{pid, decisao: aprovada | descartada | ajuste, nota}`.
- **O servidor publica as sessões** no fechamento, como já faz com as galerias. Ele lê as decisões numa fila (`GET /ponto/curadoria?desde=`, com o segredo do ponto) e aplica localmente (descartar, ajustes), guardando cada decisão uma vez só.
- **No eterna.photo**, a tela de Qualidade/Curadoria usa a API da nuvem quando aberta de fora, do mesmo jeito que a galeria do cliente já faz com `GAL_API`.
- **Custo:** as fotos já estão no S3; somam-se a leitura das vitrines (centavos) e a Lambda e o DynamoDB das decisões.

Sugestão: o caminho 2 já nesta semana e o caminho 3 como plano próprio (v86), junto com o login real.
