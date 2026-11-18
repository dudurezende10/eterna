#!/usr/bin/env bash
# Eterna · liga a nuvem e o backup no servidor do estádio (depois do nuvem-aws-cloudshell.sh, que mostra a chave).
# O que faz:
#   1. pede o bucket e a chave do usuário eterna-servidor-estadio (a secreta não aparece na tela) e grava em
#      /srv/eterna/.aws (só o usuário eterna lê), perfil eterna-estadio; confere a chave no bucket antes de seguir;
#   2. nuvem.env: ETERNA_NUVEM=s3, bucket, perfil e região. Com isso o Eterna sobe alta/vitrine de cada foto e faz o
#      backup dos bancos (vendas, equipe, operação) a cada 2 min, mais um por dia;
#   3. liga a cópia dos originais do HD para a nuvem a cada 10 min (eterna-backup-originais.timer);
#   4. reinicia o Eterna e confere nuvem, backup e originais.
#   sudo bash /opt/eterna/app/servidor/linux/nuvem-ligar.sh
set -Eeuo pipefail
ENV=/srv/eterna/Eterna/nuvem.env
AWSD=/srv/eterna/.aws
PERFIL=eterna-estadio
REGIAO=us-east-2
PY=/opt/eterna/venv/bin/python
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }

read -rp  "Bucket (aparece no CloudShell, ex.: eterna-teste-...): " BUCKET </dev/tty
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{2,62}$ ]] || para "nome de bucket inválido"
read -rp  "Chave (ID): " KID </dev/tty
read -rsp "Chave secreta (não aparece): " KSEC </dev/tty; echo
[[ "$KID" =~ ^AKIA[A-Z0-9]{16}$ ]] || para "a chave (ID) começa com AKIA e tem 20 caracteres"
[ "${#KSEC}" -ge 30 ] || para "chave secreta curta"

install -d -o eterna -g eterna -m 700 "$AWSD"
umask 077
python3 - "$AWSD" "$PERFIL" "$KID" "$REGIAO" <<'PY' 3<<<"$KSEC"
import configparser, os, sys
d, perfil, kid, regiao = sys.argv[1:5]
sec = os.fdopen(3).read().strip()
for nome, dados in (("credentials", {"aws_access_key_id": kid, "aws_secret_access_key": sec}), ("config", {"region": regiao})):
    a = os.path.join(d, nome); c = configparser.RawConfigParser(); c.read(a)
    sec_nome = perfil if nome == "credentials" else "profile " + perfil
    c[sec_nome] = dados
    with open(a, "w") as f:
        c.write(f)
PY
unset KSEC
chown eterna:eterna "$AWSD/credentials" "$AWSD/config"; chmod 600 "$AWSD/credentials" "$AWSD/config"
sudo -u eterna HOME=/srv/eterna "$PY" -I -c "
import boto3, sys
s3 = boto3.session.Session(profile_name='$PERFIL', region_name='$REGIAO').client('s3', endpoint_url='https://s3.$REGIAO.amazonaws.com')
s3.put_object(Bucket='$BUCKET', Key='backup/teste-acesso.txt', Body=b'ok')
s3.delete_object(Bucket='$BUCKET', Key='backup/teste-acesso.txt')
" || para "a chave não gravou no bucket $BUCKET (conferir chave e bucket; nada do Eterna mudou)"
ok "chave guardada em $AWSD (só o usuário eterna lê) e testada no bucket $BUCKET"

poe() { if grep -q "^$1=" "$ENV"; then sed -i "s|^$1=.*|$1=$2|" "$ENV"; else echo "$1=$2" >>"$ENV"; fi; }
poe ETERNA_NUVEM s3; poe ETERNA_BUCKET "$BUCKET"; poe ETERNA_AWS_PERFIL "$PERFIL"; poe ETERNA_AWS_REGIAO "$REGIAO"
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
ok "nuvem.env com a nuvem ligada"

for u in eterna-backup-originais.service eterna-backup-originais.timer; do
  install -o root -g root -m 644 "/opt/eterna/app/servidor/linux/systemd/$u" "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable -q --now eterna-backup-originais.timer
ok "cópia dos originais ligada (a cada 10 min)"

INI="$(date '+%F %T')"
systemctl restart eterna.service
for i in $(seq 1 30); do journalctl -u eterna --since "$INI" --no-pager | grep -q "Nuvem: " && break; sleep 2; done
L="$(journalctl -u eterna --since "$INI" --no-pager)"
[[ "$L" == *"Nuvem: "*"S3 $BUCKET"* ]] || para "o Eterna não ligou a nuvem: $(grep -o 'nuvem: .*' <<<"$L" | tail -1)"
ok "Eterna enviando as fotos para S3 $BUCKET"
echo "   esperando o primeiro backup dos bancos (até 3 min)..."
sleep 150
L="$(journalctl -u eterna --since "$INI" --no-pager)"
[[ "$L" != *"backup na nuvem:"* ]] || para "backup dos bancos com erro: $(grep -o 'backup na nuvem: .*' <<<"$L" | tail -1)"
ok "backup dos bancos sem erro"
systemctl start eterna-backup-originais.service
ok "$(journalctl -u eterna-backup-originais.service -n 20 --no-pager | grep -o 'originais: .*' | tail -1)"
printf '\nPronto. Nuvem, backup dos bancos e cópia dos originais ligados.\n'
printf 'Galeria online (QR e selfie fora do estádio): sudo bash /opt/eterna/app/servidor/linux/galeria-ligar.sh\n'
