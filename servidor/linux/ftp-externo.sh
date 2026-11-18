#!/usr/bin/env bash
# Eterna · desliga o FTP embutido do Eterna e passa a receber as fotos de um FTP do próprio servidor, instalado pela infra
# (ex.: vsftpd do Rafael). A porta 21 fica livre para ele. O Eterna vigia a pasta (ETERNA_PASTA): cada foto que termina de
# chegar entra sozinha; a subpasta de primeiro nível vira o nome do fotógrafo (ex.: /srv/eterna-midia/ftp/ctp/foto.jpg -> ctp).
#
# Para a infra (FTP dele):
#   - raiz dos usuários de FTP: /srv/eterna-midia/ftp/<login>/ (HD de 4 TB). Pasta do grupo eterna, com setgid: usuário do FTP
#     no grupo eterna e umask 002 (o Eterna precisa ler; na exclusão LGPD apaga o original);
#   - o ufw do servidor já libera 21 e 50000-50050 para 192.168.10.0/24 (usar essa faixa no modo passivo, ou ajustar o ufw).
#   sudo bash /opt/eterna/app/servidor/linux/ftp-externo.sh            desliga o embutido e vigia a pasta
#   sudo bash /opt/eterna/app/servidor/linux/ftp-externo.sh --voltar   religa o FTP do Eterna (e para de vigiar a pasta)
set -Eeuo pipefail
ENV=/srv/eterna/Eterna/nuvem.env
PASTA=/srv/eterna-midia/ftp
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
findmnt /srv/eterna-midia >/dev/null || para "o HD (/srv/eterna-midia) não está montado"
poe() { if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >>"$ENV"; fi; }
tira() { sed -i "/^$1=/d" "$ENV"; }

if [ "${1:-}" = --voltar ]; then
  tira ETERNA_FTP; tira ETERNA_PASTA
  chown eterna:eterna "$ENV"; chmod 600 "$ENV"
  systemctl restart eterna.service; sleep 4
  ok "FTP do Eterna religado (pare antes o FTP da infra, se estiver na porta 21)"
  exit 0
fi

install -d -o eterna -g eterna -m 2775 "$PASTA"
poe ETERNA_FTP 0
poe ETERNA_PASTA "$PASTA"
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
systemctl restart eterna.service
sleep 5
L="$(journalctl -u eterna --since "-30s" --no-pager)"
[[ "$L" == *"FTP embutido:      desligado"* ]] || para "o Eterna não desligou o FTP embutido (journalctl -u eterna)"
[[ "$L" == *"Pasta vigiada:     $PASTA"* ]] || para "o Eterna não abriu a pasta vigiada"
[[ "$(ss -ltn)" != *":21 "* ]] || para "a porta 21 continua ocupada"
ok "FTP do Eterna desligado; portas 21 e 2121 livres"
ok "Eterna vigiando $PASTA (HD): subpasta = fotógrafo"
cat <<EOF

Para o Rafael: raiz dos usuários de FTP em $PASTA/<login>/ (grupo eterna, umask 002); passivo 50000-50050.
Voltar ao FTP do Eterna: sudo bash /opt/eterna/app/servidor/linux/ftp-externo.sh --voltar
EOF
