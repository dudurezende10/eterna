#!/usr/bin/env bash
# Eterna · confere o servidor Linux do estádio de ponta a ponta e diz o que está certo e o que falta.
# Só lê, não muda nada. Com sudo vê tudo (firewall, SMART); sem sudo pula o que precisa de root.
#   sudo bash /opt/eterna/app/servidor/linux/verificar.sh
DADOS=/srv/eterna; MIDIA=/srv/eterna-midia; PY=/opt/eterna/venv/bin/python
falhas=0; avisos=0
ok()    { printf '  \033[32mok\033[0m    %s\n' "$*"; }
falha() { printf '  \033[31mFALTA\033[0m %s\n' "$*"; falhas=$((falhas+1)); }
aviso() { printf '  \033[33maviso\033[0m %s\n' "$*"; avisos=$((avisos+1)); }
raiz()  { [ "$(id -u)" = 0 ]; }

echo "Sistema"
[ "$(timedatectl show -p Timezone --value)" = America/Sao_Paulo ] && ok "fuso America/Sao_Paulo" || falha "fuso: $(timedatectl show -p Timezone --value)"
timedatectl show -p NTPSynchronized --value | grep -q yes && ok "relógio sincronizado ($(date '+%d/%m %H:%M'))" || falha "relógio não sincronizado"
getent hosts github.com >/dev/null && ok "DNS" || falha "DNS não resolve github.com"

echo "Discos"
findmnt "$DADOS" >/dev/null && ok "bancos no NVMe: $DADOS ($(df -h --output=avail "$DADOS" | tail -1 | xargs) livres)" || falha "$DADOS não montado"
findmnt "$MIDIA" >/dev/null && ok "fotos no HD: $MIDIA ($(df -h --output=avail "$MIDIA" | tail -1 | xargs) livres)" || falha "$MIDIA não montado"
for p in inbox ftp-tmp recortes ativ-videos ativ-clientes ativ-demo; do
  [ "$(readlink "$DADOS/Eterna/$p" 2>/dev/null)" = "$MIDIA/$p" ] || falha "$DADOS/Eterna/$p não aponta para o HD"
done
[ "$(readlink "$DADOS/Eterna/inbox" 2>/dev/null)" = "$MIDIA/inbox" ] && ok "pastas de fotos e vídeos apontam para o HD"
if raiz; then
  for d in /dev/nvme0n1 $(lsblk -dnpo NAME,MODEL | awk '/ST4000NM000B/{print $1}'); do
    s="$(smartctl -H "$d" 2>/dev/null | grep -iE 'overall-health|SMART Health Status' | awk -F: '{print $2}' | xargs)"
    [ -n "$s" ] && { echo "$s" | grep -qiE 'PASSED|OK' && ok "SMART $d: $s" || falha "SMART $d: $s"; } || aviso "SMART $d sem resposta"
  done
  u="$(nvme smart-log /dev/nvme0n1 2>/dev/null | awk -F: '/percentage_used/{print $2}' | xargs)"
  [ -n "$u" ] && ok "desgaste do NVMe: $u"
fi

echo "Placa de vídeo"
if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
  ok "$(nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader)"
  [ -x "$PY" ] && { "$PY" -I -c "import onnxruntime as o,sys;sys.exit(0 if 'CUDAExecutionProvider' in o.get_available_providers() else 1)" 2>/dev/null \
    && ok "onnxruntime enxerga a placa (CUDA)" || falha "onnxruntime sem CUDA"; }
else
  falha "driver NVIDIA fora do ar (reiniciou depois de instalar?)"
fi

echo "Programas"
[ -x "$PY" ] && ok "$($PY --version) em /opt/eterna/venv" || falha "venv /opt/eterna/venv"
command -v ffmpeg >/dev/null && ok "ffmpeg" || falha "ffmpeg"
[ -d /opt/eterna/app/.git ] && ok "código: $(git -C /opt/eterna/app log -1 --format='%h %s' 2>/dev/null | cut -c1-90)" || falha "código em /opt/eterna/app"

echo "Serviços"
for s in eterna-app eterna eterna-vigia; do
  systemctl is-active --quiet "$s" && ok "$s no ar" || falha "$s parado ($(systemctl is-active "$s"))"
  systemctl is-enabled --quiet "$s" || falha "$s não liga sozinho com a máquina"
done
curl -fsS -m 10 http://127.0.0.1:8765/status | grep -q '"ok": *true' && ok "agente responde em 8765" || falha "agente não responde em 8765"
curl -fsS -m 10 -o /dev/null http://127.0.0.1:8765/ && ok "tela abre pelo agente" || falha "tela não abre pelo agente"
v="$(curl -fsS -m 10 http://127.0.0.1:8797/ 2>/dev/null)"
[ -n "$v" ] && ok "vigia: ramo $(echo "$v" | sed -n 's/.*"ramo": "\([^"]*\)".*/\1/p'), commit $(echo "$v" | sed -n 's/.*"commit": "\([^"]*\)".*/\1/p')" || falha "vigia não responde em 8797"
echo "$v" | grep -q '"erro": ""' || { [ -n "$v" ] && aviso "vigia: $(echo "$v" | sed -n 's/.*"erro": "\([^"]*\)".*/\1/p')"; }
ss -ltn | grep -qE ':(21|2121) ' && ok "FTP das câmeras escutando" || falha "FTP das câmeras não escuta (21/2121)"

echo "Rede"
if raiz; then
  ufw status | grep -q '^Status: active' && ok "firewall ligado" || aviso "firewall desligado"
  ufw status | grep -qE '^8765/tcp +ALLOW +192\.168\.10\.0/24' && ok "8765 liberada para a rede do estádio" || falha "regra da 8765 no firewall"
fi

echo
if [ "$falhas" = 0 ]; then printf '\033[1;32mTudo certo\033[0m (%d avisos).\n' "$avisos"; else printf '\033[1;31m%d coisa(s) faltando\033[0m, %d avisos.\n' "$falhas" "$avisos"; fi
[ "$falhas" = 0 ]
