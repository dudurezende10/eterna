#!/bin/bash
# Eterna · agente do ponto
# Dois cliques: fecha o agente antigo (se estiver aberto), abre o novo e o Eterna no navegador.
cd "$(dirname "$0")"
PIDS=$(lsof -ti tcp:8765 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "Fechando o agente antigo..."
  kill $PIDS 2>/dev/null
  sleep 1
fi
( sleep 3; open "http://127.0.0.1:8765/#chroma" ) &
# v84: com o recorte local instalado (instalar-recorte.command), usa o Python de ~/Eterna/venv
PY=python3
[ -x "$HOME/Eterna/venv/bin/python3" ] && PY="$HOME/Eterna/venv/bin/python3"
"$PY" eterna-agente.py
