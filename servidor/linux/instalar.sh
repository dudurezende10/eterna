#!/usr/bin/env bash
# Eterna · instalador do servidor Linux do estádio (Ubuntu 26.04 LTS, placa NVIDIA, NVMe para sistema e bancos, HD para
# fotos e vídeos). Plano e decisões: docs/planos/2026-11-14-servidor-definitivo.md.
#
# Uso (no servidor, com sudo; pede a senha uma vez):
#   curl -fsSL https://raw.githubusercontent.com/dudurezende10/eterna/<ramo>/servidor/linux/instalar.sh -o instalar.sh
#   sudo bash instalar.sh
#
# Pode rodar de novo quantas vezes precisar: cada passo confere antes de fazer e pula o que já está certo.
# O único passo que apaga alguma coisa é formatar o HD das fotos, e ele só roda se o disco for o esperado, estiver
# vazio (sem partição e sem assinatura nenhuma) e alguém digitar FORMATAR. Disco com qualquer coisa: o instalador para.
# No fim roda verificar.sh e mostra o que ficou certo e o que falta.
set -Eeuo pipefail

# ---------- configuração desta instalação ----------
REPO_URL="https://github.com/dudurezende10/eterna.git"
RAMO="${ETERNA_RAMO:-idiomas-base}"                # branch que o servidor segue (vigia.env); trocar para producao quando existir
HD_MODELO="ST4000NM000B"                           # Seagate Exos 4 TB das fotos
DADOS_VG="ubuntu-vg"; DADOS_LV="eterna-dados"; DADOS_TAM="300G"   # bancos e miniaturas, no NVMe
DADOS="/srv/eterna"                                # home do usuário eterna (~/Eterna fica aqui)
MIDIA="/srv/eterna-midia"                          # HD de 4 TB
MIDIA_PASTAS="inbox ftp-tmp recortes ativ-videos ativ-clientes ativ-demo"   # o que vai para o HD (miniaturas ficam no NVMe); ftp-tmp no HD: a foto que chega passa para a inbox sem copiar
REDE_ESTADIO="192.168.10.0/24"
IP_SERVIDOR="192.168.10.10"
NVIDIA_PACOTES="nvidia-headless-595-server-open nvidia-utils-595-server linux-modules-nvidia-595-server-open-generic"
APT_PACOTES="git python3-venv ffmpeg smartmontools nvme-cli sqlite3 acl curl ufw parted e2fsprogs"
# ----------------------------------------------------

LOGI=/var/log/eterna-instalar.log
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REINICIAR=0
passo() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; echo "[$(date '+%F %T')] == $*" >>"$LOGI"; }
ok()    { printf '   \033[32mok\033[0m %s\n' "$*"; echo "   ok $*" >>"$LOGI"; }
info()  { printf '   %s\n' "$*"; echo "   $*" >>"$LOGI"; }
para()  { printf '\n\033[1;31mPAROU: %s\033[0m\nNada além do que já apareceu como ok foi feito. Registro: %s\n' "$*" "$LOGI"; echo "PAROU: $*" >>"$LOGI"; exit 1; }
trap 'para "erro inesperado na linha $LINENO: $BASH_COMMAND"' ERR

[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash $0"; exit 1; }
touch "$LOGI"; chmod 600 "$LOGI"

passo "0. Conferências antes de começar"
. /etc/os-release
[ "${VERSION_ID:-}" = "26.04" ] || para "esperava Ubuntu 26.04, achei ${PRETTY_NAME:-?}"
ok "$PRETTY_NAME"
getent hosts github.com >/dev/null || para "sem DNS (github.com não resolve). Ver /etc/systemd/resolved.conf.d/eterna-dns.conf"
ok "DNS"
[[ "$(chronyc tracking 2>/dev/null)" == *'Leap status     : Normal'* ]] || para "relógio não sincronizado (chronyc tracking)"
ok "relógio sincronizado: $(date '+%d/%m/%Y %H:%M %Z')"
[ "$(timedatectl show -p Timezone --value)" = "America/Sao_Paulo" ] || { timedatectl set-timezone America/Sao_Paulo; ok "fuso ajustado"; }

passo "1. Pacotes do Ubuntu"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q >>"$LOGI" 2>&1
apt-get install -y -q $APT_PACOTES >>"$LOGI" 2>&1
ok "$APT_PACOTES"

passo "2. Driver da placa NVIDIA"
if [[ "$(lspci)" == *NVIDIA* ]]; then   # sem "| grep -q": com pipefail o SIGPIPE do lspci dava falso (14/11)
  if command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1; then
    ok "driver no ar: $(nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader)"
  else
    apt-get install -y -q $NVIDIA_PACOTES >>"$LOGI" 2>&1
    ok "driver instalado ($NVIDIA_PACOTES)"
    info "A placa só passa a usar o driver novo depois de reiniciar o servidor."
    REINICIAR=1
  fi
  # atualização automática não troca driver nem kernel sozinha: troca planejada, com teste da placa depois
  cat >/etc/apt/apt.conf.d/52eterna-sem-driver-automatico <<'EOF'
// Eterna: driver NVIDIA e kernel não se atualizam sozinhos (troca planejada; ver docs/planos/2026-11-14-servidor-definitivo.md)
Unattended-Upgrade::Package-Blacklist { "nvidia-"; "libnvidia-"; "linux-"; };
EOF
  ok "atualização automática não mexe em driver nem kernel"
else
  info "sem placa NVIDIA: rostos e recorte vão rodar no processador"
fi

passo "3. HD de 4 TB das fotos e vídeos ($MIDIA)"
UUID_MIDIA="$(blkid -L eterna-midia 2>/dev/null | xargs -r blkid -s UUID -o value || true)"
if [ -n "$UUID_MIDIA" ]; then
  ok "HD já formatado (rótulo eterna-midia)"
else
  HD=""
  for d in /sys/block/sd*; do
    n="$(basename "$d")"
    grep -q "$HD_MODELO" "$d/device/model" 2>/dev/null && HD="/dev/$n"
  done
  [ -n "$HD" ] || para "não achei o HD $HD_MODELO"
  [ -z "$(lsblk -nro NAME "$HD" | tail -n +2)" ] || para "$HD já tem partição. Não formato disco com conteúdo: conferir à mão"
  [ -z "$(wipefs -n "$HD")" ] || para "$HD tem assinatura de sistema de arquivos ou RAID. Não formato: conferir à mão"
  findmnt -S "$HD" >/dev/null && para "$HD está montado"
  info "Disco: $HD, $(lsblk -dnro SIZE,MODEL,SERIAL "$HD")"
  info "Ele está vazio e será FORMATADO (tudo o que houver nele se perde)."
  read -r -p "   Digite FORMATAR para continuar: " resp </dev/tty
  [ "$resp" = "FORMATAR" ] || para "formatação não confirmada"
  parted -s "$HD" mklabel gpt mkpart eterna-midia ext4 0% 100%
  udevadm settle
  PART="$(lsblk -nrpo NAME "$HD" | tail -n 1)"
  mkfs.ext4 -q -L eterna-midia -m 1 "$PART"
  udevadm settle
  UUID_MIDIA="$(blkid -s UUID -o value "$PART")"
  ok "formatado: $PART (ext4, rótulo eterna-midia)"
fi
mkdir -p "$MIDIA"
if ! grep -q "UUID=$UUID_MIDIA" /etc/fstab; then
  # trava a pasta vazia: com o HD fora, nada consegue gravar nela (as fotos não caem no NVMe sem ninguém ver)
  findmnt "$MIDIA" >/dev/null || chattr +i "$MIDIA"
  echo "UUID=$UUID_MIDIA $MIDIA ext4 defaults,noatime,nofail,x-systemd.device-timeout=30s 0 2" >>/etc/fstab
  systemctl daemon-reload
fi
findmnt "$MIDIA" >/dev/null || mount "$MIDIA"
ok "montado: $(df -h --output=size,avail "$MIDIA" | tail -1 | xargs) (tamanho, livre)"

passo "4. Volume dos bancos no NVMe ($DADOS)"
if [ ! -e "/dev/$DADOS_VG/$DADOS_LV" ]; then
  LIVRE_G="$(vgs --noheadings --units g -o vg_free "$DADOS_VG" | tr -dc '0-9.' | cut -d. -f1)"
  [ "${LIVRE_G:-0}" -ge "${DADOS_TAM%G}" ] || para "só ${LIVRE_G}G livres no $DADOS_VG; preciso de $DADOS_TAM"
  lvcreate -q -y -L "$DADOS_TAM" -n "$DADOS_LV" "$DADOS_VG" >>"$LOGI" 2>&1
  mkfs.ext4 -q -L eterna-dados "/dev/$DADOS_VG/$DADOS_LV"
  ok "volume criado: $DADOS_LV, $DADOS_TAM"
else
  ok "volume já existe: $DADOS_LV"
fi
mkdir -p "$DADOS"
if ! grep -q "/dev/$DADOS_VG/$DADOS_LV" /etc/fstab; then
  findmnt "$DADOS" >/dev/null || chattr +i "$DADOS"
  echo "/dev/$DADOS_VG/$DADOS_LV $DADOS ext4 defaults,noatime 0 2" >>/etc/fstab
  systemctl daemon-reload
fi
findmnt "$DADOS" >/dev/null || mount "$DADOS"
ok "montado: $(df -h --output=size,avail "$DADOS" | tail -1 | xargs) (tamanho, livre)"

passo "5. Usuários"
install -d -o root -g root -m 755 /opt/eterna
getent group eterna >/dev/null || groupadd --system eterna
id eterna >/dev/null 2>&1 || useradd --system --gid eterna --home-dir "$DADOS" --no-create-home --shell /usr/sbin/nologin eterna
usermod -a -G video,render eterna 2>/dev/null || usermod -a -G video eterna
id eterna-deploy >/dev/null 2>&1 || useradd --system --home-dir /opt/eterna/deploy --create-home --shell /usr/sbin/nologin eterna-deploy
ok "eterna (roda o Eterna, sem login) e eterna-deploy (dono do código, sem login)"

passo "6. Pastas"
chown eterna:eterna "$DADOS"; chmod 750 "$DADOS"
install -d -o eterna -g eterna -m 700 "$DADOS/Eterna"
for p in $MIDIA_PASTAS; do
  install -d -o eterna -g eterna -m 750 "$MIDIA/$p"
  alvo="$DADOS/Eterna/$p"
  if [ -L "$alvo" ]; then
    [ "$(readlink "$alvo")" = "$MIDIA/$p" ] || para "$alvo aponta para $(readlink "$alvo"), esperava $MIDIA/$p"
  elif [ -e "$alvo" ]; then
    [ -z "$(ls -A "$alvo")" ] || para "$alvo já tem arquivos no NVMe; mover para $MIDIA/$p à mão antes"
    rmdir "$alvo"; ln -s "$MIDIA/$p" "$alvo"; chown -h eterna:eterna "$alvo"
  else
    ln -s "$MIDIA/$p" "$alvo"; chown -h eterna:eterna "$alvo"
  fi
done
ok "no HD: $MIDIA_PASTAS; no NVMe: bancos, miniaturas, modelos, configuração"

passo "7. Código (git, ramo $RAMO)"
if [ ! -d /opt/eterna/app/.git ]; then
  install -d -o eterna-deploy -g eterna-deploy -m 755 /opt/eterna/app
  runuser -u eterna-deploy -- env HOME=/opt/eterna/deploy git clone --quiet --filter=blob:none --branch "$RAMO" "$REPO_URL" /opt/eterna/app >>"$LOGI" 2>&1
  ok "clonado $REPO_URL ($RAMO)"
else
  # instalador rodado de novo: traz o código ao commit mais novo do ramo (só fast-forward), como o vigia faria
  runuser -u eterna-deploy -- env HOME=/opt/eterna/deploy git -C /opt/eterna/app pull --quiet --ff-only origin "$RAMO" >>"$LOGI" 2>&1 \
    || info "não consegui atualizar o código (sem rede ou não é fast-forward); sigo com o que está no disco"
  ok "código em /opt/eterna/app ($(runuser -u eterna-deploy -- env HOME=/opt/eterna/deploy git -C /opt/eterna/app log -1 --format='%h %s' | cut -c1-70))"
fi
chmod 755 /opt/eterna/app
install -d -m 755 /etc/eterna
[ -f /etc/eterna/vigia.env ] || printf '# Eterna · vigia (deploy pelo git). Trocar o RAMO e: sudo systemctl restart eterna-vigia\nRAMO=%s\nREMOTO=origin\nBUSCA_SEG=60\n' "$RAMO" >/etc/eterna/vigia.env
ok "vigia segue: $(grep ^RAMO= /etc/eterna/vigia.env)"

passo "8. Python e bibliotecas (versões fixas, hash conferido)"
REQ=/opt/eterna/app/servidor/linux/requisitos.txt
[ -f "$REQ" ] || REQ="$AQUI/requisitos.txt"
[ -f "$REQ" ] || para "não achei requisitos.txt"
[ -x /opt/eterna/venv/bin/python ] || python3 -m venv /opt/eterna/venv
/opt/eterna/venv/bin/python -m pip install -q --disable-pip-version-check --require-hashes --only-binary=:all: -r "$REQ" >>"$LOGI" 2>&1 \
  || para "pip recusou (hash diferente ou pacote faltando): ver $LOGI"
chown -R root:root /opt/eterna/venv; chmod -R go-w /opt/eterna/venv
ok "$(/opt/eterna/venv/bin/python --version), $(grep -c '^[a-z0-9]' "$REQ") pacotes"

passo "9. Modelos de IA (recorte e pose; cerca de 1,3 GB na primeira vez)"
# A internet do estádio corta downloads longos (14/11: o BiRefNet de 973 MB caiu em 2%). Se os modelos já foram baixados
# com retomada (~/eterna-instalar/baixar-modelos.sh, curl -C -), copia daqui; o script abaixo confere o hash de cada um
# e só baixa o que faltar. Até 3 tentativas.
if [ -d "$AQUI/modelos/rembg" ]; then
  for f in "$AQUI"/modelos/rembg/*/*.onnx; do
    [ -s "$f" ] || continue
    n="$(basename "$(dirname "$f")")"
    install -d -o eterna -g eterna -m 755 "$DADOS/.rembg" "$DADOS/.rembg/models" "$DADOS/.rembg/models/$n"
    [ -s "$DADOS/.rembg/models/$n/$(basename "$f")" ] || install -o eterna -g eterna -m 644 "$f" "$DADOS/.rembg/models/$n/"
  done
  install -d -o eterna -g eterna -m 755 "$DADOS/Eterna/modelos"
  for f in "$AQUI"/modelos/eterna/*.onnx; do
    [ -s "$f" ] || continue
    [ -s "$DADOS/Eterna/modelos/$(basename "$f")" ] || install -o eterna -g eterna -m 644 "$f" "$DADOS/Eterna/modelos/"
  done
  info "modelos copiados de $AQUI/modelos"
fi
feito=0
for t in 1 2 3; do
  if (cd "$DADOS" && runuser -u eterna -- env HOME="$DADOS" /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/instalar-recorte-modelos.py >>"$LOGI" 2>&1); then
    feito=1; break
  fi
  info "tentativa $t falhou (rede); tentando de novo"
done
[ "$feito" = 1 ] || para "modelos do recorte não baixaram: ver $LOGI (dica: rodar ~/eterna-instalar/baixar-modelos.sh antes)"
ok "modelos em $DADOS/.rembg e $DADOS/Eterna/modelos (rostos o agente pega do app na primeira abertura)"

passo "10. Configuração do ponto (nuvem.env)"
ENV="$DADOS/Eterna/nuvem.env"
if [ ! -f "$ENV" ]; then
  cat >"$ENV" <<EOF
# Eterna · configuração deste servidor (só variáveis ETERNA_*). Criado pelo instalador em $(date '+%d/%m/%Y').
ETERNA_REDE=1
ETERNA_ORIGENS=http://$IP_SERVIDOR:8765
ETERNA_POSTO_REDE=$REDE_ESTADIO
ETERNA_TZ=America/Sao_Paulo
ETERNA_APP_ORIGIN=http://127.0.0.1:8798
ETERNA_IMPRESSORA_POSTOS=*=local
ETERNA_RECORTE_GPU=auto
# Nuvem (S3, galeria, backup): preencher quem tem o acesso, direto no servidor. Nunca por chat ou e-mail. Ver docs/NUVEM.md.
# ETERNA_NUVEM=
# ETERNA_BUCKET=
# ETERNA_AWS_REGIAO=us-east-2
# ETERNA_GALERIA_API=
EOF
  ok "criado $ENV"
else
  ok "$ENV já existe (não mexo)"
fi
chown eterna:eterna "$ENV"; chmod 600 "$ENV"

passo "11. Serviços (systemd)"
install -d -o root -g root -m 755 /opt/eterna/vigia
install -o root -g root -m 755 /opt/eterna/app/servidor/linux/eterna-vigia.py /opt/eterna/vigia/eterna-vigia.py
for u in eterna-app.service eterna.service eterna-vigia.service; do
  install -o root -g root -m 644 "/opt/eterna/app/servidor/linux/systemd/$u" "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable -q --now eterna-app.service eterna.service eterna-vigia.service
ok "eterna-app (tela, 127.0.0.1:8798), eterna (agente, 8765 e FTP), eterna-vigia (deploy e saúde, 8797)"

passo "12. Firewall (ufw)"
[[ "$(ufw status)" == *'Status: active'* ]] || info "ufw estava desligado; regras gravadas, ligar com: sudo ufw enable (depois de conferir o SSH)"
ufw allow from "$REDE_ESTADIO" to any port 22 proto tcp comment 'SSH da rede do estadio' >/dev/null
for p in 8765 8797 21 2121 50000:50050; do
  ufw allow from "$REDE_ESTADIO" to any port "$p" proto tcp comment 'Eterna' >/dev/null
done
ok "liberado só para $REDE_ESTADIO: SSH 22, Eterna 8765, situação 8797, FTP 21/2121 e 50000-50050"
info "VPN: quando a faixa da VPN existir, liberar a mesma lista para ela."

passo "13. Saúde dos discos"
systemctl enable -q --now smartmontools.service 2>/dev/null || systemctl enable -q --now smartd.service 2>/dev/null || true
ok "smartd ligado (avisa defeito no NVMe e no HD)"

passo "14. Conferência final"
bash /opt/eterna/app/servidor/linux/verificar.sh || true
if [ "$REINICIAR" = 1 ]; then
  printf '\n\033[1;33mFALTA REINICIAR o servidor para a placa de vídeo usar o driver novo: sudo reboot\033[0m\nDepois, conferir com: sudo bash /opt/eterna/app/servidor/linux/verificar.sh\n'
fi
printf '\nAdministradores do Eterna (uma vez, cada um com o seu usuário; a senha provisória aparece só na tela):\n'
printf '  sudo -u eterna env HOME=%s /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --criar-admin ronaldo "Ronaldo Santos"\n' "$DADOS"
