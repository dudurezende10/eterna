#!/usr/bin/env bash
# Eterna · endereço com certificado (https) para o servidor do estádio: https://posto.eterna.photo
# Sem certificado o navegador não abre a câmera (selfie no Checkout, foto do cliente no tablet) e mostra "Não seguro".
#
# Como funciona:
#   - posto.eterna.photo (zona no Route 53, conta 741796256738) aponta para o IP do servidor na rede do estádio. O nome é
#     público, o IP é privado: só quem está na rede do estádio (ou na VPN) chega.
#   - O certificado é do Let's Encrypt, pelo desafio de DNS (o servidor não precisa estar aberto para a internet). O certbot
#     usa uma chave da AWS que só pode mexer no registro _acme-challenge.posto.eterna.photo (criada no CloudShell, passo do plano).
#   - nginx na porta 443 entrega para o agente (127.0.0.1:8765) com X-Real-IP e X-Forwarded-Proto; o agente confia no
#     X-Real-IP só vindo de ETERNA_PROXY_IP=127.0.0.1. A porta 80 só manda para o https.
#   - Renova sozinho (certbot.timer, a cada 60 dias) e recarrega o nginx.
#
# Antes: a chave da AWS do certbot em /root/.aws/credentials (perfil default), colocada pelo Ronaldo direto no servidor.
#   sudo bash /opt/eterna/app/servidor/linux/certificado.sh
set -Eeuo pipefail
NOME="${ETERNA_NOME:-posto.eterna.photo}"
REDE_ESTADIO="192.168.10.0/24"
ENV=/srv/eterna/Eterna/nuvem.env
LOGI=/var/log/eterna-instalar.log
passo() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; echo "[$(date '+%F %T')] == certificado: $*" >>"$LOGI"; }
ok()    { printf '   \033[32mok\033[0m %s\n' "$*"; }
para()  { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }

passo "1. Conferências"
[ -s /root/.aws/credentials ] || para "falta a chave da AWS do certbot em /root/.aws/credentials (ver docs/planos/2026-11-14-servidor-definitivo.md, seção Certificado)"
chmod 700 /root/.aws; chmod 600 /root/.aws/credentials
IP="$(getent ahostsv4 "$NOME" | awk 'NR==1{print $1}')"
[ -n "$IP" ] || para "$NOME não resolve (falta o registro A no Route 53)"
[[ "$(ip -4 -o addr show)" == *" $IP/"* ]] || para "$NOME aponta para $IP, que não é deste servidor"
ok "$NOME -> $IP (este servidor)"

passo "2. Pacotes"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q nginx certbot python3-certbot-dns-route53 >>"$LOGI" 2>&1
ok "nginx, certbot e o plugin do Route 53"

passo "3. Certificado (Let's Encrypt, desafio de DNS)"
if [ -s "/etc/letsencrypt/live/$NOME/fullchain.pem" ]; then
  ok "já existe: $(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$NOME/fullchain.pem")"
else
  # rodar este script é aceitar os termos do Let's Encrypt (https://letsencrypt.org/repository/); sem e-mail pessoal
  certbot certonly --dns-route53 -d "$NOME" --non-interactive --agree-tos --register-unsafely-without-email \
    --deploy-hook "systemctl reload nginx" >>"$LOGI" 2>&1 || para "certbot recusou: ver $LOGI"
  ok "emitido: $(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$NOME/fullchain.pem")"
fi
grep -q 'renew_hook\|deploy_hook\|post_hook' "/etc/letsencrypt/renewal/$NOME.conf" \
  || echo "deploy_hook = systemctl reload nginx" >>"/etc/letsencrypt/renewal/$NOME.conf"
systemctl enable -q --now certbot.timer
ok "renovação automática ligada (certbot.timer)"

passo "4. nginx na frente do Eterna"
cat >/etc/nginx/sites-available/eterna <<EOF
# Eterna · https://$NOME -> agente em 127.0.0.1:8765 (servidor/linux/certificado.sh). Não editar à mão.
server {
    listen 80;
    listen [::]:80;
    server_name $NOME;
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name $NOME;
    ssl_certificate     /etc/letsencrypt/live/$NOME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$NOME/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;
    client_max_body_size 1100m;          # vídeo do Drone até 1 GB (ATIV_VIDEO_MAX)
    proxy_request_buffering off;         # foto e vídeo vão direto para o agente, sem passar pelo disco do nginx
    proxy_buffering off;
    proxy_read_timeout 1800s;            # ATIV_VIDEO_PRAZO
    proxy_send_timeout 1800s;
    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
EOF
ln -sf /etc/nginx/sites-available/eterna /etc/nginx/sites-enabled/eterna
rm -f /etc/nginx/sites-enabled/default
nginx -t >>"$LOGI" 2>&1 || para "configuração do nginx com erro: ver $LOGI"
systemctl enable -q nginx; systemctl reload nginx || systemctl restart nginx
ok "https://$NOME -> 127.0.0.1:8765"

passo "5. Eterna aceita o endereço novo"
grep -q '^ETERNA_PROXY_IP=' "$ENV" || echo "ETERNA_PROXY_IP=127.0.0.1" >>"$ENV"
if ! grep -q "^ETERNA_ORIGENS=.*https://$NOME" "$ENV"; then
  sed -i "s|^ETERNA_ORIGENS=\(.*\)|ETERNA_ORIGENS=https://$NOME,\1|" "$ENV"
fi
chown eterna:eterna "$ENV"; chmod 600 "$ENV"
systemctl restart eterna.service
ok "$(grep '^ETERNA_ORIGENS=' "$ENV")"

passo "6. Firewall"
ufw allow from "$REDE_ESTADIO" to any port 443 proto tcp comment 'Eterna https' >/dev/null
ufw allow from "$REDE_ESTADIO" to any port 80 proto tcp comment 'Eterna http->https' >/dev/null
ok "443 e 80 liberadas para $REDE_ESTADIO"

passo "7. Conferência"
sleep 4
c="$(curl -s -o /dev/null -w '%{http_code}' --resolve "$NOME:443:127.0.0.1" "https://$NOME/status")"
[ "$c" = 200 ] && ok "https://$NOME/status responde 200, certificado válido" || para "https://$NOME/status respondeu $c"
printf '\nPronto. Abrir nos aparelhos da rede do estádio: https://%s\n(Cada posto e tablet precisa ser pareado de novo no endereço novo.)\n' "$NOME"
