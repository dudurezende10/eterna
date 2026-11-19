#!/usr/bin/env bash
# Eterna · liga a escola pelo voucher no servidor do estádio (17/11, docs/planos/2026-11-17-escola-pelo-voucher.md).
# Sem ETERNA_PARCEIROS_TOKEN no nuvem.env o Eterna não lê os vouchers [Escola] do Viva Parceiros e não monta a galeria da visita.
# O que faz:
#   1. pede o token do painel do Viva Parceiros (o mesmo valor de PARCEIROS_PAINEL_TOKEN do Render), sem mostrar na tela;
#   2. confere se o Viva Parceiros aceita o token;
#   3. grava no nuvem.env e reinicia o Eterna; espera "Escola pelo voucher: ligada" no registro.
#   sudo bash /opt/eterna/app/servidor/linux/escola-ligar.sh
set -Eeuo pipefail
ENV=/srv/eterna/Eterna/nuvem.env
URL=https://parceiros.vivamaracana.com.br/api/painel/grupos
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
[ -f "$ENV" ] || para "não achei $ENV"
grep -q '^ETERNA_GALERIA_API=' "$ENV" || para "a galeria na nuvem não está ligada (rode galeria-ligar.sh antes)"

read -rsp "Token do painel do Viva Parceiros (não aparece): " TOK; echo
[[ "$TOK" =~ ^[A-Za-z0-9._~+/=-]{16,200}$ ]] || para "token vazio ou com caractere estranho"
COD=$(TOK="$TOK" python3 -I -c "
import os, urllib.request, urllib.error
rq = urllib.request.Request('$URL', headers={'Authorization': 'Bearer ' + os.environ['TOK'], 'User-Agent': 'eterna-agente'})
try:
    print(urllib.request.urlopen(rq, timeout=30).status)
except urllib.error.HTTPError as e:
    print(e.code)
except Exception:
    print(0)
")
case "$COD" in
  200) ok "o Viva Parceiros aceitou o token" ;;
  401|403) para "o Viva Parceiros recusou o token (confira o valor de PARCEIROS_PAINEL_TOKEN no Render)" ;;
  0) para "sem internet até o Viva Parceiros" ;;
  *) para "o Viva Parceiros respondeu $COD" ;;
esac

grep -v '^ETERNA_PARCEIROS_TOKEN=' "$ENV" >"$ENV.tmp" || true
echo "ETERNA_PARCEIROS_TOKEN=$TOK" >>"$ENV.tmp"
mv "$ENV.tmp" "$ENV"; chown eterna:eterna "$ENV"; chmod 600 "$ENV"
unset TOK
ok "nuvem.env com ETERNA_PARCEIROS_TOKEN"

INI="$(date '+%F %T')"
systemctl restart eterna.service
for i in $(seq 1 30); do journalctl -u eterna --since "$INI" --no-pager | grep -q "Escola pelo voucher: ligada" && break; sleep 2; done
journalctl -u eterna --since "$INI" --no-pager | grep -q "Escola pelo voucher: ligada" || para "o Eterna não ligou a escola (ver journalctl -u eterna)"
ok "Eterna lendo os vouchers [Escola] a cada 10 minutos"
