#!/usr/bin/env bash
# Eterna · dá acesso SSH ao servidor do estádio para uma pessoa, com a chave pública DELA (cada um a sua; nada de chave
# compartilhada). Entra sem senha (só a chave), lê os registros (journalctl -u eterna, /var/log/eterna-vigia.log) e o código.
# NÃO ganha sudo: reiniciar serviço, instalar ou mexer em /srv continua com quem tem a senha do sudo.
# O deploy não precisa de SSH: é pelo git (o vigia aplica o ramo configurado em /etc/eterna/vigia.env em até 1 minuto).
#   sudo bash /opt/eterna/app/servidor/linux/acesso-ssh.sh eduardo "ssh-ed25519 AAAA... eduardo@mac"
#   sudo bash /opt/eterna/app/servidor/linux/acesso-ssh.sh eduardo --remover
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
LOGIN="${1:-}"; CHAVE="${2:-}"
[[ "$LOGIN" =~ ^[a-z][a-z0-9-]{1,31}$ ]] || { echo "login: minúsculas, números e traço, começando por letra"; exit 1; }
case "$LOGIN" in root|ubuntu|eterna|eterna-deploy) echo "login reservado"; exit 1;; esac
if [ "$CHAVE" = --remover ]; then
  id "$LOGIN" >/dev/null 2>&1 && { pkill -u "$LOGIN" || true; userdel -r "$LOGIN" 2>/dev/null || userdel "$LOGIN"; }
  rm -f "/etc/ssh/sshd_config.d/61-eterna-acesso-$LOGIN.conf"; sshd -t && systemctl reload ssh
  echo "acesso de $LOGIN removido"; exit 0
fi
[[ "$CHAVE" =~ ^(ssh-ed25519|ecdsa-sha2-nistp256|ssh-rsa)\ [A-Za-z0-9+/=]+(\ .*)?$ ]] || { echo "chave pública inválida (cole a linha inteira do arquivo .pub)"; exit 1; }
id "$LOGIN" >/dev/null 2>&1 || useradd -m -s /bin/bash "$LOGIN"
passwd -l "$LOGIN" >/dev/null                      # sem senha: só entra com a chave
usermod -aG adm,systemd-journal "$LOGIN"           # lê os registros
H="$(getent passwd "$LOGIN" | cut -d: -f6)"
install -d -m 700 -o "$LOGIN" -g "$LOGIN" "$H/.ssh"
grep -qxF "$CHAVE" "$H/.ssh/authorized_keys" 2>/dev/null || echo "$CHAVE" >>"$H/.ssh/authorized_keys"
chown "$LOGIN:$LOGIN" "$H/.ssh/authorized_keys"; chmod 600 "$H/.ssh/authorized_keys"
# o 01-hardening.conf (Rafael) só deixa entrar o ubuntu; soma este login (AllowUsers é cumulativo entre arquivos)
CONF="/etc/ssh/sshd_config.d/61-eterna-acesso-$LOGIN.conf"
printf '# Eterna · acesso SSH de %s (servidor/linux/acesso-ssh.sh); só chave, sem sudo
AllowUsers %s
' "$LOGIN" "$LOGIN" >"$CONF"
chmod 644 "$CONF"
sshd -t || { rm -f "$CONF"; echo "configuração do SSH recusada: nada mudou"; exit 1; }
T="$(sshd -T -C "user=$LOGIN,host=x,addr=192.168.10.11")"
[[ "$T" == *"allowusers $LOGIN"* && "$T" == *"allowusers ubuntu"* && "$T" == *"passwordauthentication no"* ]] || { rm -f "$CONF"; echo "o SSH não aplicou o acesso: nada mudou"; exit 1; }
systemctl reload ssh
echo "ok: $LOGIN entra com a chave $(ssh-keygen -lf <(echo "$CHAVE") | awk '{print $2}')"
echo "    de fora do estádio, com a VPN MaracaTour (FortiClient) ligada: ssh $LOGIN@192.168.10.10"
