#!/usr/bin/env bash
# Eterna · cria (ou troca a senha de) um login do FTP das câmeras no servidor Linux.
# A senha é sorteada aqui (16 letras e números, sem 0/O/1/l) e aparece UMA vez, só nesta tela: anote e configure na câmera
# ou no app (Canon Content Transfer Professional). Fica só em /srv/eterna/Eterna/ftp.json (dono eterna, 600).
# As fotos que chegam por esse login vão para /srv/eterna-midia/inbox (HD de 4 TB), com o login como fotógrafo.
#   sudo bash /opt/eterna/app/servidor/linux/ftp-usuario.sh ctp
#   sudo bash /opt/eterna/app/servidor/linux/ftp-usuario.sh ctp --compartilhado   (subpasta = nome do fotógrafo)
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
LOGIN="${1:-}"; COMP="${2:-}"
[[ "$LOGIN" =~ ^[a-z][a-z0-9._-]{1,31}$ ]] || { echo "login: minúsculas, números, ponto, traço (2 a 32), começando por letra"; exit 1; }
CFG=/srv/eterna/Eterna/ftp.json
[ -f "$CFG" ] || { echo "$CFG ainda não existe: o Eterna cria na primeira vez que liga (systemctl status eterna)"; exit 1; }
SENHA="$(/usr/bin/python3 -I - "$CFG" "$LOGIN" "$COMP" <<'EOF'
import json, os, secrets, sys
cfg_path, login, comp = sys.argv[1], sys.argv[2], sys.argv[3]
cfg = json.load(open(cfg_path))
alfa = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
senha = "".join(secrets.choice(alfa) for _ in range(16))
cfg.setdefault("users", {})[login] = senha
cfg.setdefault("compartilhado", [])
if comp == "--compartilhado" and login not in cfg["compartilhado"]:
    cfg["compartilhado"].append(login)
tmp = cfg_path + ".tmp"
with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f:
    json.dump(cfg, f, indent=2)
os.replace(tmp, cfg_path)
print(senha)
EOF
)"
chown eterna:eterna "$CFG"; chmod 600 "$CFG"
systemctl restart eterna.service
IP="$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)"
cat <<EOF

Login do FTP pronto (o Eterna foi religado para ler o login novo).
  Servidor:  $IP
  Porta:     21 (ou 2121)
  Modo:      passivo
  Usuário:   $LOGIN
  Senha:     $SENHA
  Pasta:     / (qualquer pasta; tudo cai na inbox do dia no HD)
A senha não fica em nenhum outro lugar além do ftp.json do servidor: anote agora.
EOF
