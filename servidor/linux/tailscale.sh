#!/usr/bin/env bash
# Eterna · acesso remoto ao servidor do estádio pelo Tailscale (rede privada da TI; nenhuma porta aberta na internet).
# Depois disto, de qualquer lugar com o Tailscale ligado (Ronaldo, Eduardo em Miami):
#   - https://posto.eterna.photo funciona igual a dentro do estádio: o servidor anuncia a própria rota 192.168.10.10/32
#     no Tailscale, então o mesmo nome e o mesmo certificado valem (com câmera);
#   - ssh pelo IP 100.x do servidor (cada pessoa com a sua chave; ver servidor/linux/acesso-ssh.sh);
#   - página do vigia (deploy) em http://<IP 100.x>:8797.
# O deploy continua sendo pelo git: o que entra no ramo do vigia (/etc/eterna/vigia.env) vai para o servidor em até 1 minuto.
#   sudo bash /opt/eterna/app/servidor/linux/tailscale.sh
# Na primeira vez mostra um link de login: abrir no navegador e entrar com a conta do Tailscale da TI.
set -Eeuo pipefail
NOME_TS=srv-viva-maracana
IP_LAN=192.168.10.10
ENV=/srv/eterna/Eterna/nuvem.env
LOGI=/var/log/eterna-instalar.log
passo() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; echo "[$(date '+%F %T')] == tailscale: $*" >>"$LOGI"; }
ok()    { printf '   \033[32mok\033[0m %s\n' "$*"; }
para()  { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }

passo "1. Programa do Tailscale (repositório oficial)"
if ! command -v tailscale >/dev/null; then
  . /etc/os-release
  curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.noarmor.gpg" -o /usr/share/keyrings/tailscale-archive-keyring.gpg
  curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$VERSION_CODENAME.tailscale-keyring.list" -o /etc/apt/sources.list.d/tailscale.list
  apt-get update -q >>"$LOGI" 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q tailscale >>"$LOGI" 2>&1
fi
systemctl enable -q --now tailscaled
ok "$(tailscale version | head -1)"

passo "2. Entrar na rede da TI"
# rota só deste servidor (/32): não mexe na rede de quem está do outro lado; DNS do servidor fica como está
tailscale up --hostname="$NOME_TS" --accept-dns=false --advertise-routes="$IP_LAN/32" --reset
IP_TS="$(tailscale ip -4 | head -1)"
FQDN="$(tailscale status --json | /usr/bin/python3 -I -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')"
[ -n "$IP_TS" ] || para "o Tailscale não pegou IP (login não concluído?)"
ok "$NOME_TS = $IP_TS ($FQDN)"

passo "3. Firewall: só pela interface do Tailscale"
for p in 22 80 443 8765 8797; do ufw allow in on tailscale0 to any port "$p" proto tcp comment "Eterna via Tailscale" >/dev/null; done
ok "22, 80, 443, 8765 e 8797 liberadas para quem está no Tailscale da TI"

passo "4. Eterna aceita os endereços do Tailscale"
for o in "http://$IP_TS:8765" "http://$FQDN:8765"; do
  grep -q "^ETERNA_ORIGENS=.*$o" "$ENV" || sed -i "s|^ETERNA_ORIGENS=\(.*\)|ETERNA_ORIGENS=\1,$o|" "$ENV"
done
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
systemctl restart eterna.service
ok "$(grep '^ETERNA_ORIGENS=' "$ENV")"

cat <<EOF

Pronto. Falta no painel do Tailscale (https://login.tailscale.com/admin/machines), máquina $NOME_TS:
  1. "Edit route settings": aprovar a rota $IP_LAN/32 (sem isso o https://posto.eterna.photo não abre de fora);
  2. "Disable key expiry" (senão o servidor sai da rede sozinho em 180 dias).
Depois, de fora do estádio com o Tailscale ligado: https://posto.eterna.photo  ·  ssh ubuntu@$IP_TS  ·  http://$IP_TS:8797
EOF
