#!/bin/sh
# Publica o serviço eterna-email em https://parceiros.vivamaracana.com.br/eterna-api/*
# no proxy Caddy do Viva Parceiros (VM vm-site-viva-maracana-prod-02). Faz backup e só recarrega se a config validar.
# Rodar na VM: sh /opt/eterna-email/publicar-rota.sh
set -e
cd /opt/viva-parceiros/deploy/parceiros
if ! grep -q eterna-api Caddyfile; then
cp Caddyfile "Caddyfile.bak-$(date +%Y%m%d%H%M)"
python3 - <<'EOF'
p = "Caddyfile"; s = open(p).read()
marca = "\t# IP real do visitante"
bloco = """\t# Eterna (fotos do Tour): serviço de e-mail do login, container eterna-email (/opt/eterna-email)
\thandle_path /eterna-api/* {
\t\treverse_proxy eterna-email:8090 {
\t\t\theader_up X-Real-Ip {remote_host}
\t\t\theader_up -X-Forwarded-For
\t\t}
\t}

"""
assert s.count(marca) == 1
open(p, "w").write(s.replace(marca, bloco + marca))
EOF
fi
sudo docker run --rm -v /opt/viva-parceiros/deploy/parceiros/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2.8.4-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# O Caddyfile é montado como arquivo: quando ele é substituído, o container continua vendo o antigo até reiniciar.
sudo docker exec viva-parceiros-proxy grep -q eterna-api /etc/caddy/Caddyfile || sudo docker restart viva-parceiros-proxy
sleep 4
curl -s -o /dev/null -w "parceiros: %{http_code}\n" https://parceiros.vivamaracana.com.br/healthz
curl -s -w "  eterna-api: %{http_code}\n" https://parceiros.vivamaracana.com.br/eterna-api/healthz
