#!/usr/bin/env bash
# Eterna · liga a galeria online na nuvem no servidor do estádio (QR do recibo, selfie e vídeo do cartão fora do estádio).
# Sem ETERNA_GALERIA_API no nuvem.env nenhuma galeria sai do ponto: o celular do cliente abre "Galeria não encontrada".
# O que faz:
#   1. nuvem.env: ETERNA_GALERIA_API com o endereço da API da galeria (público, o mesmo que o app usa);
#   2. confere se a nuvem reconhece o segredo deste servidor (~/Eterna/nuvem-segredo.txt, que não aparece na tela).
#      Se a nuvem recusar, mostra o SHA-256 do segredo para atualizar a stack eterna-galeria (servidor/galeria-nuvem/README.md);
#   3. reinicia o Eterna: as galerias abertas que nunca foram para a nuvem entram na fila sozinhas.
#   sudo bash /opt/eterna/app/servidor/linux/galeria-ligar.sh
set -Eeuo pipefail
ENV=/srv/eterna/Eterna/nuvem.env
SEG=/srv/eterna/Eterna/nuvem-segredo.txt
API=https://whe2hyve2j.execute-api.us-east-2.amazonaws.com
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
[ -f "$ENV" ] || para "não achei $ENV"

poe() { if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >>"$ENV"; fi; }
poe ETERNA_GALERIA_API "$API"
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
ok "nuvem.env com ETERNA_GALERIA_API"

if [ ! -s "$SEG" ]; then
  runuser -u eterna -- python3 -I -c "import secrets,os;os.umask(0o077);open('$SEG','w').write(secrets.token_urlsafe(32))"
  ok "segredo do ponto criado (só o usuário eterna lê)"
fi
chown eterna:eterna "$SEG"; chmod 600 "$SEG"
COD=$(runuser -u eterna -- python3 -I -c "
import urllib.request, urllib.error
s = open('$SEG').read().strip()
rq = urllib.request.Request('$API/ponto/vendas-online?desde=0', headers={'X-Eterna-Ponto': s, 'User-Agent': 'eterna-agente'})
try:
    print(urllib.request.urlopen(rq, timeout=20).status)
except urllib.error.HTTPError as e:
    print(e.code)
except Exception:
    print(0)
")
case "$COD" in
  200) ok "a nuvem reconhece este servidor" ;;
  401|403)
    printf '\n\033[1;33mA nuvem ainda não conhece o segredo deste servidor.\033[0m\n'
    printf 'Atualizar a stack eterna-galeria (CloudShell, servidor/galeria-nuvem/README.md) com:\n'
    printf '   SegredoPontoSha256=%s\n' "$(sha256sum "$SEG" | cut -c1-64)"
    printf 'O Eterna já fica tentando sozinho; quando a stack for atualizada, as galerias sobem.\n\n' ;;
  0) para "sem internet até a nuvem ($API)" ;;
  *) printf '   aviso: a nuvem respondeu %s na conferência; o Eterna tenta de novo sozinho\n' "$COD" ;;
esac

INI="$(date '+%F %T')"
systemctl restart eterna.service
for i in $(seq 1 30); do journalctl -u eterna --since "$INI" --no-pager | grep -q "Galeria na nuvem:  http" && break; sleep 2; done
journalctl -u eterna --since "$INI" --no-pager | grep -q "Galeria na nuvem:  http" || para "o Eterna não ligou a galeria na nuvem (ver journalctl -u eterna)"
ok "Eterna publicando as galerias em $API"
journalctl -u eterna --since "$INI" --no-pager | grep -o "Galeria na nuvem:  [0-9].*" | sed 's/^/   /' || true
