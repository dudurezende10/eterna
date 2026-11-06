#!/bin/bash
# Roda todos os testes do Eterna: sobe um servidor local na raiz do repositório e executa cada testes/*.js (menos os que começam com _)
cd "$(dirname "$0")/.."
PORTA=${PORTA:-8890}
python3 -m http.server $PORTA >/dev/null 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
sleep 1
export U="http://127.0.0.1:$PORTA/index.html"
node -e "const h=require('fs').readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);new Function(m[1]);" && echo "OK sintaxe do index.html" || { echo "FALHA sintaxe do index.html"; F=1; }
python3 -m py_compile agente/eterna-agente.py && echo "OK sintaxe do agente" || { echo "FALHA sintaxe do agente"; F=1; }
FALHAS=${F:-0}
# v91: testes do agente que rodam sozinhos (HOME temporário; os outros *_agente.py são chamados pelos .js)
for t in testes/sessoes_agente.py testes/selfie_rapidez.py testes/estatisticas_agente.py testes/v92_testador_agente.py testes/cliques_ia_agente.py testes/cliques_ia_e2e_agente.py testes/cliques_ia_fila_limpeza_agente.py; do
  H=$(mktemp -d); OUT=$(HOME=$H python3 -I "$t" agente/eterna-agente.py 2>&1); RC=$?; rm -rf "$H"
  LINHA=$(echo "$OUT" | grep -E "^(OK|FALHA)")
  # v91 (revisão S9): teste que quebra sem imprimir OK/FALHA também conta como falha
  if [ -z "$LINHA" ]; then echo "FALHA $(basename $t): terminou sem resultado · $(echo "$OUT" | tail -1 | cut -c1-200)"; FALHAS=$((FALHAS+1));
  else echo "$LINHA"; [ $RC -eq 0 ] || FALHAS=$((FALHAS+1)); fi
done
for t in testes/*.js; do
  case "$(basename $t)" in _*) continue;; esac
  node "$t" 2>&1 | grep -E "^(OK|FALHA)" || true
  [ ${PIPESTATUS[0]} -eq 0 ] || FALHAS=$((FALHAS+1))
done
echo "FALHAS: $FALHAS"
[ $FALHAS -eq 0 ]
