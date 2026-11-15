#!/usr/bin/env bash
# Eterna · tira o Tailscale do servidor do estádio. Desde 15/11/2026 o acesso remoto é pela VPN do FortiGate da Maracatour
# (FortiClient, perfil MaracaTour), por ordem da diretoria; o Tailscale não é mais usado.
# O que faz: sai da rede do Tailscale, desliga e desinstala o programa e o repositório dele, apaga as regras do firewall
# "Eterna via Tailscale" (interface tailscale0) e tira do ETERNA_ORIGENS os endereços 100.x e .ts.net. O resto fica igual:
# SSH por chave, https://posto.eterna.photo, regras da rede do estádio.
#   sudo bash /opt/eterna/app/servidor/linux/tailscale-remover.sh
set -Eeuo pipefail
ENV=/srv/eterna/Eterna/nuvem.env
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }

if command -v tailscale >/dev/null; then
  tailscale logout >/dev/null 2>&1 || true
  systemctl disable -q --now tailscaled 2>/dev/null || true
  DEBIAN_FRONTEND=noninteractive apt-get purge -y -q tailscale tailscale-archive-keyring >/dev/null
fi
rm -f /etc/apt/sources.list.d/tailscale.list /usr/share/keyrings/tailscale-archive-keyring.gpg
rm -rf /var/lib/tailscale
hash -r; command -v tailscale >/dev/null && para "o tailscale continua instalado"
ok "Tailscale desinstalado (programa, serviço e repositório)"

# regras do firewall do Tailscale, da última para a primeira (o número muda a cada exclusão)
for n in $(ufw status numbered | grep -E 'tailscale0|Eterna via Tailscale' | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn || true); do
  ufw --force delete "$n" >/dev/null
done
ufw status | grep -qE 'tailscale0|Tailscale' && para "sobrou regra do Tailscale no firewall (ufw status)"
ok "firewall sem as regras do Tailscale"

if grep -q '^ETERNA_ORIGENS=' "$ENV"; then
  ANTES="$(grep '^ETERNA_ORIGENS=' "$ENV")"
  NOVO="$(printf '%s' "${ANTES#ETERNA_ORIGENS=}" | tr ',' '\n' | grep -vE '//100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.|\.ts\.net' | paste -sd, - || true)"
  if [ "ETERNA_ORIGENS=$NOVO" != "$ANTES" ]; then
    sed -i "s|^ETERNA_ORIGENS=.*|ETERNA_ORIGENS=$NOVO|" "$ENV"
    chown eterna:eterna "$ENV"; chmod 600 "$ENV"
    systemctl restart eterna.service
    for i in $(seq 1 30); do curl -sf -m 3 http://127.0.0.1:8765/status >/dev/null && break; sleep 2; done
    curl -sf -m 5 http://127.0.0.1:8765/status >/dev/null || para "o Eterna não respondeu depois do ajuste (journalctl -u eterna)"
  fi
  ok "ETERNA_ORIGENS=$NOVO"
fi
printf '\nPronto. Acesso de fora do estádio: FortiClient VPN (perfil MaracaTour) e depois ssh/https normalmente.\n'
