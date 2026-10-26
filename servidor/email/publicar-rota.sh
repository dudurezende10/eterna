#!/bin/sh
# Publica o serviço eterna-email em https://parceiros.vivamaracana.com.br/eterna-api/*
# no proxy Caddy do Viva Parceiros (VM vm-site-viva-maracana-prod-02). Faz backup e só recarrega se a config validar.
# Rodar na VM: sh /opt/eterna-email/publicar-rota.sh
set -e
cd /opt/viva-parceiros/deploy/parceiros
grep -q eterna-api Caddyfile && { echo "Rota já existe."; exit 0; }
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
sudo docker exec viva-parceiros-proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo docker exec viva-parceiros-proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
sleep 2
curl -s -o /dev/null -w "parceiros: %{http_code}\n" https://parceiros.vivamaracana.com.br/guias/healthz
curl -s -w "  eterna-api: %{http_code}\n" https://parceiros.vivamaracana.com.br/eterna-api/healthz
