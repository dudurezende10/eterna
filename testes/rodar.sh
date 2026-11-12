#!/bin/bash
# Roda todos os testes do Eterna: sobe um servidor local na raiz do repositório e executa cada testes/*.js (menos os que começam com _)
cd "$(dirname "$0")/.."
PORTA=${PORTA:-8890}
python3 -m http.server $PORTA >/dev/null 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 1
# v94-ux: porta ocupada (outro servidor ainda aberto) faria os testes rodarem contra outra pasta
kill -0 $SRV 2>/dev/null || { echo "FALHA porta $PORTA ocupada: feche o outro servidor ou rode com PORTA=outra"; echo "FALHAS: 1"; exit 1; }
export U="http://127.0.0.1:$PORTA/index.html"
node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);new Function(m[1]);" && echo "OK sintaxe do index.html" || { echo "FALHA sintaxe do index.html"; F=1; }
python3 -m py_compile agente/eterna-agente.py agente/eterna-recorte.py agente/medir-recorte.py && echo "OK sintaxe do agente" || { echo "FALHA sintaxe do agente"; F=1; }
FALHAS=${F:-0}
# v94-ux: cada teste conta como FALHA se imprimir FALHA, se terminar sem imprimir OK nem FALHA ou se sair com código diferente de 0
conta(){ # $1 = nome, $2 = código de saída, $3 = saída
  local LINHA; LINHA=$(echo "$3" | grep -E "^(OK|FALHA)")
  if [ -z "$LINHA" ]; then echo "FALHA $1: terminou sem resultado (código $2) · $(echo "$3" | tail -1 | cut -c1-200)"; FALHAS=$((FALHAS+1)); return; fi
  echo "$LINHA"
  if [ "$2" -ne 0 ]; then
    echo "$LINHA" | grep -q "^FALHA" || echo "FALHA $1: saiu com código $2"
    FALHAS=$((FALHAS+1))
  elif echo "$LINHA" | grep -q "^FALHA"; then FALHAS=$((FALHAS+1)); fi
}
# v91: testes do agente que rodam sozinhos (HOME temporário; os outros *_agente.py são chamados pelos .js)
for t in testes/sessoes_agente.py testes/selfie_rapidez.py testes/login_agente.py testes/estatisticas_agente.py testes/v92_testador_agente.py testes/postos_agente.py testes/seguranca_rotas_agente.py testes/seguranca_ftp_agente.py testes/seguranca_config_agente.py testes/cliques_ia_agente.py testes/cliques_ia_e2e_agente.py testes/cliques_ia_fila_limpeza_agente.py testes/galeria_teto_agente.py testes/agenda_agente.py testes/recorte_birefnet_agente.py testes/visitas_agente.py testes/instalar_recorte.py testes/app_offline_agente.py testes/envio_manual_agente.py testes/montagens_agente.py testes/lgpd_compradas_agente.py testes/ativacoes_agente.py testes/ativacoes_importar_agente.py testes/ativacoes_venda_agente.py; do
  H=$(mktemp -d); OUT=$(HOME=$H python3 -I "$t" agente/eterna-agente.py 2>&1); RC=$?; rm -rf "$H"
  conta "$(basename $t)" $RC "$OUT"
done
for t in testes/*.js; do
  case "$(basename $t)" in _*) continue;; esac
  OUT=$(node "$t" 2>&1); RC=$?
  conta "$(basename $t .js)" $RC "$OUT"
done
echo "FALHAS: $FALHAS"
[ $FALHAS -eq 0 ]
