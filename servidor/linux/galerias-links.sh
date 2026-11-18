#!/usr/bin/env bash
# Eterna · lista as galerias online de um dia com o link de cada uma (só leitura; o link abre as fotos, não repassar).
#   sudo bash /opt/eterna/app/servidor/linux/galerias-links.sh            ontem
#   sudo bash /opt/eterna/app/servidor/linux/galerias-links.sh 2026-11-15
# Colunas: hora de criação, código (eterna.photo/g + código), tipo, sessões, fotos (compradas/cortesias), situação e link.
# A selfie não fica ligada a uma galeria (o registro da selfie é só contagem e horário, LGPD), então a lista é por galeria.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
DIA="${1:-$(TZ=America/Sao_Paulo date -d yesterday +%F)}"
[[ "$DIA" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "dia no formato AAAA-MM-DD"; exit 1; }
runuser -u eterna -- python3 -I - "$DIA" <<'PY'
import json, os, sys
from datetime import datetime, timedelta, timezone
dia = sys.argv[1]
base = "/srv/eterna/Eterna/galerias"
br = timezone(timedelta(hours=-3))
linhas = []
for t in os.listdir(base):
    a = os.path.join(base, t, "sessao.json")
    try:
        m = json.load(open(a, encoding="utf8"))
        cr = datetime.fromisoformat(str(m.get("criada")).replace("Z", "+00:00")).astimezone(br)
    except Exception:
        continue
    if cr.strftime("%Y-%m-%d") != dia:
        continue
    fotos = m.get("fotos") or []
    livres = sum(1 for f in fotos if f.get("direito") in ("comprada", "cortesia"))
    sit = "substituída" if m.get("substituida") else "encerrada" if m.get("encerrada") else "aberta"
    tipo = "venda" if m.get("venda") else m.get("tipo") or "?"
    linhas.append((cr.strftime("%H:%M"), m.get("codigo") or "-", tipo, len(m.get("sessoes") or []), len(fotos), livres, sit,
                   "https://eterna.photo/#g/" + t))
linhas.sort()
print("Galerias de %s: %d" % (dia, len(linhas)))
print("hora  código     tipo    sessões fotos compradas situação    link")
for h, c, tp, ns, nf, nl, s, l in linhas:
    print("%s %-10s %-7s %7d %5d %9d %-11s %s" % (h, c, tp, ns, nf, nl, s, l))
PY
