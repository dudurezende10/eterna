#!/usr/bin/env bash
# Eterna · recebimento das fotos do celular/câmera por SFTP (Canon Content Transfer Professional › SFTP, porta 22).
# Por que: no Wi-Fi do estádio o FTP entra (login ok) mas o arquivo chega com 0 byte; o FTP abre uma segunda conexão para cada
# arquivo e o caminho do Wi-Fi trava essa conexão. O SFTP passa tudo numa conexão só (a do SSH), então não depende disso.
#
# O que faz:
#   - usuário Linux do SFTP (padrão: ctp) sem terminal e sem shell: só SFTP, preso (chroot) em /srv/eterna-midia/sftp,
#     gravando em /srv/eterna-midia/sftp/<login>/ (HD de 4 TB);
#   - senha dele só da rede do estádio (192.168.10.0/24); de fora não entra. Soma ao AllowUsers do 01-hardening.conf (Rafael)
#     só este usuário, só dessa rede; o resto do SSH continua igual (ubuntu por chave);
#   - o Eterna vigia /srv/eterna-midia/sftp (ETERNA_PASTA): a foto que termina de chegar entra sozinha, com o login como fotógrafo.
#   sudo bash /opt/eterna/app/servidor/linux/sftp-ctp.sh            (login ctp; pede a senha, duas vezes, sem aparecer)
#   sudo bash /opt/eterna/app/servidor/linux/sftp-ctp.sh fotografo2
set -Eeuo pipefail
LOGIN="${1:-ctp}"
REDE="192.168.10.0/24"
RAIZ=/srv/eterna-midia/sftp
ENV=/srv/eterna/Eterna/nuvem.env
CONF=/etc/ssh/sshd_config.d/60-eterna-sftp.conf
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
[[ "$LOGIN" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || para "login: minúsculas, números e traço, começando por letra"
case "$LOGIN" in root|ubuntu|eterna|eterna-deploy) para "login reservado";; esac
findmnt /srv/eterna-midia >/dev/null || para "o HD (/srv/eterna-midia) não está montado"

# 1. usuário só de SFTP, no grupo eterna (o Eterna lê e, na exclusão LGPD, apaga o original)
if ! id "$LOGIN" >/dev/null 2>&1; then
  useradd -M -d / -s /usr/sbin/nologin -g eterna "$LOGIN"
fi
usermod -s /usr/sbin/nologin -g eterna "$LOGIN"
read -rsp "Senha do SFTP para $LOGIN (mínimo 8): " S </dev/tty; echo
[ "${#S}" -ge 8 ] || para "senha curta"
read -rsp "Repita: " S2 </dev/tty; echo
[ "$S" = "$S2" ] || para "as duas senhas não batem"
printf '%s:%s\n' "$LOGIN" "$S" | chpasswd; unset S S2
ok "usuário $LOGIN (só SFTP, sem terminal)"

# 2. pastas: a raiz do chroot é do root (exigência do SSH); a do login é dele + grupo eterna, no HD
install -d -o root -g root -m 755 "$RAIZ"
install -d -o "$LOGIN" -g eterna -m 2770 "$RAIZ/$LOGIN"
ok "fotos em $RAIZ/$LOGIN (HD)"

# 3. SSH: este usuário, só da rede do estádio, só SFTP preso na pasta
cat >"$CONF.novo" <<EOF
# Eterna · SFTP das fotos (servidor/linux/sftp-ctp.sh). Soma ao AllowUsers do 01-hardening.conf só os logins de foto, só da rede
# do estádio; senha vale só para eles e só de $REDE; sem terminal, sem túnel, presos em $RAIZ.
EOF
USUS=""
for u in $(ls -1 "$RAIZ" 2>/dev/null); do
  if id "$u" >/dev/null 2>&1 && [ "$(id -gn "$u")" = eterna ] && [ "$u" != eterna ]; then
    echo "AllowUsers $u@$REDE" >>"$CONF.novo"; USUS="${USUS:+$USUS,}$u"
  fi
done
cat >>"$CONF.novo" <<EOF
Match User $USUS Address $REDE
    PasswordAuthentication yes
    ForceCommand internal-sftp -u 0007
    ChrootDirectory $RAIZ
    AllowTcpForwarding no
    AllowAgentForwarding no
    PermitTunnel no
    X11Forwarding no
    PermitTTY no
EOF
[ -f "$CONF" ] && cp -a "$CONF" "$CONF.antes"
mv "$CONF.novo" "$CONF"; chmod 644 "$CONF"
if ! sshd -t; then
  if [ -f "$CONF.antes" ]; then mv "$CONF.antes" "$CONF"; else rm -f "$CONF"; fi
  para "configuração do SSH recusada: nada mudou"
fi
rm -f "$CONF.antes"
T="$(sshd -T -C "user=$LOGIN,host=celular,addr=192.168.10.12")"
[[ "$T" == *"passwordauthentication yes"* && "$T" == *"chrootdirectory $RAIZ"* && "$T" == *"allowusers $LOGIN@$REDE"* && "$T" == *"allowusers ubuntu"* ]] || para "o SSH não aplicou a regra do SFTP (ver $CONF)"
T2="$(sshd -T -C "user=ubuntu,host=x,addr=192.168.10.11")"
[[ "$T2" == *"passwordauthentication no"* ]] || para "a senha ficou ligada para o ubuntu: conferir $CONF"
systemctl reload ssh
ok "SSH: $LOGIN só SFTP, só de $REDE; ubuntu continua só por chave"

# 4. Eterna vigia a pasta
if grep -q '^ETERNA_PASTA=' "$ENV"; then sed -i "s|^ETERNA_PASTA=.*|ETERNA_PASTA=$RAIZ|" "$ENV"; else echo "ETERNA_PASTA=$RAIZ" >>"$ENV"; fi
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
systemctl restart eterna.service
sleep 4
journalctl -u eterna --since "-20s" --no-pager | grep -q "Pasta vigiada:     $RAIZ" && ok "Eterna vigiando $RAIZ" || para "o Eterna não abriu a pasta vigiada (journalctl -u eterna)"

IP="$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1)"
cat <<EOF

Pronto. No CTP (Configuração do destino):
  Protocolo:  SFTP
  Servidor:   $IP
  Porta:      22
  Usuário:    $LOGIN
  Senha:      a que você digitou
  Pasta:      /$LOGIN
EOF
