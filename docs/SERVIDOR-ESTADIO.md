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
```

| Onde | O quê | Leitura sem sudo |
|---|---|---|
| `/opt/eterna/app` | cópia do git que está no ar (ramo do vigia) | sim |
| `/srv/eterna-midia/inbox/<dia>/` | originais das fotos (HD de 4 TB) | sim |
| `/srv/eterna-midia/ftp/<login>/` | chegada pelo FTP (vsftpd) antes de entrar no Eterna | sim |
| `/srv/eterna-midia/recortes/` | recortes da IA (placa de vídeo) | sim |
| `/srv/eterna/Eterna/` | bancos, `nuvem.env`, chaves | não (só o serviço `eterna`) |
| porta 8765 | o Eterna (a tela abre por `https://posto.eterna.photo`) | — |
| porta 8797 | situação do deploy, só leitura | sim |

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
