# Servidor de teste

Enquanto não há acesso ao servidor do estádio (MCTNBADM041), o notebook do Ronaldo faz esse papel: recebe fotos, vende, imprime e sobe para a nuvem de teste.

## Como se chega nele

Pelo Tailscale. Endereço: `100.115.186.26`.

| Porta | O que é | Quem usa |
| --- | --- | --- |
| 8799 | App e agente: `http://100.115.186.26:8799` | Equipe, com usuário e senha |
| 2199 | FTP das câmeras | Câmeras e programas de FTP |
| 8797 | Situação do servidor e log, só leitura | Quem está atualizando |

Não há acesso remoto ao computador em si (nem SSH, nem área de trabalho). Tudo o que muda nele chega pelo GitHub.

## Como atualizar

Envie para a branch `idiomas-base`. O supervisor busca a cada minuto e aplica.

| O que mudou | Quando vale | O que acontece |
| --- | --- | --- |
| `index.html`, `vendor/`, `img/` | Até 2 min (1 da busca e 1 do agente); depois, F5 | Nada para |
| `agente/` | Até 1 min | O agente reinicia; o app fica fora por alguns segundos |
| `servidor/galeria-nuvem/` | Não é aplicado aqui | Veja "Nuvem" |
| `servidor/teste/supervisor.py` | Não é aplicado aqui | O Ronaldo copia à mão; veja "Montagem" |

### Conferir se entrou

```bash
curl http://100.115.186.26:8797/
curl "http://100.115.186.26:8797/log?n=200"
```

O primeiro responde com `commit`, `atualizado_em`, `erro_git`, `agente_vivo` e `reinicios`. O log omite linhas com senhas ou segredos.

| Sintoma | Significa | O que fazer |
| --- | --- | --- |
| `commit` é o seu e `agente_vivo` é `true` | Entrou | Testar em `:8799` |
| `agente_vivo` é `false` e `reinicios` subindo | O agente novo não sobe | Ver o log, corrigir e enviar de novo: o supervisor continua buscando com o agente fora |
| `erro_git` preenchido | Não conseguiu avançar (branch reescrita, por exemplo) | Enviar por merge. Se persistir, chamar o Ronaldo |
| A porta 8797 não responde | Notebook desligado, dormindo ou sem Tailscale | Chamar o Ronaldo |

### O que só o Ronaldo faz

- Ligar o notebook e a impressora, trocar papel e reiniciar o Spooler.
- Senhas, chaves da AWS e segredos: ficam no notebook, fora do repositório, e nunca passam por chat ou e-mail.
- Mudar variáveis em `rodar.py` e atualizar o `supervisor.py` (ver "Montagem").

### Postos pareados (v93)

O servidor só abre os dados para quem entrou com usuário e senha ou para um aparelho pareado. Cada aparelho que roda o Checkout (ou a TV da fila) é pareado uma vez:

- No próprio aparelho, entre no Eterna com um usuário que tem Painel de controle (Alterar), abra Configurações › Painel de controle › Postos deste ponto, dê um nome e toque em "Parear este aparelho". Depois disso o Checkout abre ali sem ninguém conectado.
- Sem entrar no app: no servidor, `python eterna-agente.py --parear-posto "Checkout 1"` imprime um link que vale uma vez, por 10 minutos. Abra o link no aparelho (trocando `127.0.0.1` pelo endereço do servidor na rede).
- Aparelho perdido ou trocado: "Revogar" na mesma lista.
- Aparelho sem pareamento mostra "Este aparelho ainda não foi pareado" no Checkout. As vendas que ele já tinha na fila ficam guardadas e sobem depois do pareamento.
- O teste de carga (`agente/teste-carga.py`) entra com `--login <usuário>` nos comandos que falam com o agente; a senha vem de `ETERNA_SENHA` ou é digitada.

## O que roda onde

| Onde | O que serve | Como muda |
| --- | --- | --- |
| Servidor de teste | Branch `idiomas-base` | Envio para a branch |
| eterna.photo (galeria do cliente, QR) | Branch `main` | Merge em `main`, com a esteira de `docs/AGENTES.md` |
| Nuvem de teste na AWS (fotos, selfie, publicação de galerias) | Implantação manual | CloudShell da conta da nuvem do Eterna |

O celular do cliente sempre abre a galeria em eterna.photo. Uma mudança na tela da galeria ou da selfie em `idiomas-base` não chega ao QR até ir para `main`.

### Nuvem

A nuvem aceita dois segredos de ponto: o do estádio e o de teste. A branch `nuvem-segredo-teste`, feita a partir de `main`, é a que está publicada. Implante sempre a partir de `main` ou de uma branch feita dela. Ver `docs/NUVEM.md`.

## Montagem

Fica em `Eterna-servidor-local`, na pasta do usuário, fora do repositório:

| Item | O que é |
| --- | --- |
| `app/` | Clone só do servidor, na branch `idiomas-base`. Não edite: o supervisor só avança sem conflito |
| `supervisor.py` | Cópia de `servidor/teste/supervisor.py`. Sobe o agente, refaz se ele cair e busca o GitHub |
| `rodar.py` | Variáveis do teste e portas restritas ao Tailscale |
| `home/` | Dados: fotos, bancos, fila de impressão, configuração da nuvem e segredos |
| `servidor.log` | Saída do agente e do supervisor |

O supervisor roda sem depender de nenhuma janela aberta, mas não volta sozinho depois de reiniciar o Windows: alguém precisa abri-lo no notebook (`pythonw supervisor.py`). Para funcionar sem ninguém por perto, o notebook precisa estar na tomada, conectado e sem suspender.

Variáveis de `rodar.py` que diferem do estádio:

| Variável | Motivo |
| --- | --- |
| `ETERNA_IMPRESSORA` = Samsung M332x | Não há DNP aqui |
| `ETERNA_IMP_SEM_ESTADO=1` | O status da Samsung no Windows fica preso depois de um aviso |
| `ETERNA_IMP_PAPEL_PADRAO=1` | Imprime em A4, o papel da bandeja |
| `ETERNA_BUSCA_DIAS=1` | A selfie procura no dia todo, não só na janela de 90 min |

## Quando o servidor do estádio voltar

Este arranjo é só de teste. No estádio, o agente é instalado como em `docs/CHECKLIST-SERVIDOR.md`, com segredo próprio. A impressão precisa ser revista na DNP real.
