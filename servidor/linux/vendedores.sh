#!/usr/bin/env bash
# Eterna · cadastra os vendedores dos tablets (perfil "Vendedor Drone, Chute a Gol e Snap Pop") com a mesma senha, sem troca
# obrigatória. Os logins vêm na linha de comando (nomes de pessoas não ficam no git); o nome mostrado sai do login
# (luis.andrade -> Luis Andrade; acento se ajusta depois em Usuários). A senha é pedida uma vez, sem aparecer.
#   sudo bash /opt/eterna/app/servidor/linux/vendedores.sh luis.andrade yasmim.moraes ...
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
[ $# -ge 1 ] || { echo "uso: vendedores.sh login1 login2 ..."; exit 1; }
read -rsp "Senha dos vendedores: " S </dev/tty; echo
read -rsp "Repita: " S2 </dev/tty; echo
[ "$S" = "$S2" ] || { echo "as duas senhas não batem"; exit 1; }
for l in "$@"; do
  nome="$(echo "$l" | tr '._-' '   ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)} 1')"
  printf '%s\n' "$S" | runuser -u eterna -- env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --criar-vendedor "$l" "$nome"
done
unset S S2
