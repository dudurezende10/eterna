#!/bin/bash
# Eterna · instala o recorte local dos fundos de IA (v97: BiRefNet + a regra do que encosta na pessoa), uma vez por computador.
# Cria ~/Eterna/venv (ambiente separado do Python do sistema) com as versões fixas de recorte-requisitos.txt (todas as rodas,
# com o SHA-256 de cada arquivo conferido pelo pip: --require-hashes) e baixa os 4 modelos: birefnet-general,
# u2net_human_seg e isnet-general-use (pelo rembg, que confere o hash de cada um) e o MoveNet (SHA-256 conferido), cerca
# de 1,3 GB. Precisa de 16 GB de memória (o BiRefNet sozinho passa de 4,7 GB); servidor com placa NVIDIA usa a placa
# (no Windows: instalar-recorte.bat gpu). Rodar de novo não baixa nada que já esteja certo.
# Depois, feche e abra o agente (Eterna.command): ele passa a usar o Python de ~/Eterna/venv.
cd "$(dirname "$0")"
ET="$HOME/Eterna"
VENV="$ET/venv"
REQ="recorte-requisitos.txt"
BASE="https://raw.githubusercontent.com/dudurezende10/eterna/main/agente"
fim() { read -n 1 -s -r -p "Aperte uma tecla para fechar."; exit "$1"; }
versao_ok() { "$1" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; }
mkdir -p "$ET"

# 1) Ambiente antigo com Python < 3.10 (de uma tentativa anterior): refaz
if [ -x "$VENV/bin/python3" ] && ! versao_ok "$VENV/bin/python3"; then
  echo "O ambiente $VENV usa um Python antigo (< 3.10). Refazendo..."
  mv "$VENV" "$VENV.antigo-$(date +%s)" || { echo "Não deu para mover o ambiente antigo."; fim 1; }
fi

# 2) Criar o ambiente com um Python >= 3.10
if [ ! -x "$VENV/bin/python3" ]; then
  PYOK=""
  for c in python3.13 python3.12 python3.11 python3.10 /opt/homebrew/bin/python3 /usr/local/bin/python3 \
           /Library/Frameworks/Python.framework/Versions/3.1[0-9]/bin/python3 python3; do
    p="$(command -v "$c" 2>/dev/null || true)"
    [ -z "$p" ] && [ -x "$c" ] && p="$c"
    if [ -n "$p" ] && versao_ok "$p"; then PYOK="$p"; break; fi
  done
  if [ -n "$PYOK" ]; then
    echo "Usando $PYOK ($("$PYOK" -V 2>&1)). Criando o ambiente do Eterna em $VENV..."
    "$PYOK" -m venv "$VENV" || { echo "Não deu para criar o ambiente."; fim 1; }
  else
    echo "Este Mac só tem Python antigo. Baixando um Python 3.12 só para o Eterna (uma vez, cerca de 30 MB)..."
    UV="$ET/uv/bin/uv"
    if [ ! -x "$UV" ]; then
      if ! command -v python3 >/dev/null 2>&1; then
        echo "Python 3 não encontrado. Instale em https://www.python.org/downloads/ e rode de novo."; fim 1
      fi
      python3 -m venv "$ET/uv" && { "$ET/uv/bin/python3" -m pip install --disable-pip-version-check --quiet --upgrade pip; true; } \
        && "$ET/uv/bin/python3" -m pip install --disable-pip-version-check --quiet uv \
        || { echo "Não deu para instalar o uv. Alternativa: instale o Python 3.12 em https://www.python.org/downloads/ e rode de novo."; fim 1; }
    fi
    UV_PYTHON_INSTALL_DIR="$ET/python" "$UV" venv --seed --python 3.12 "$VENV" \
      || { echo "Não deu para baixar o Python 3.12. Alternativa: instale em https://www.python.org/downloads/ e rode de novo."; fim 1; }
  fi
fi
echo "Python do Eterna: $("$VENV/bin/python3" -V 2>&1)"

for f in "$REQ" instalar-recorte-modelos.py; do
  [ -f "$f" ] || curl -fsSL -o "$f" "$BASE/$f" || { echo "Não deu para baixar $f."; fim 1; }
done
echo "Instalando as versões fixas de $REQ (com o hash de cada arquivo; pode levar alguns minutos)..."
"$VENV/bin/python3" -m pip install --disable-pip-version-check --require-hashes --only-binary=:all: -r "$REQ" \
  || { echo "Não deu para instalar. Se o erro fala de hash, o arquivo baixado não confere: não continue e avise o Eduardo."; fim 1; }
echo "Baixando os modelos do recorte (birefnet-general, u2net_human_seg, isnet-general-use e MoveNet; cerca de 1,3 GB)..."
"$VENV/bin/python3" instalar-recorte-modelos.py || { echo "Não deu para baixar os modelos."; fim 1; }
echo
echo "Pronto. Feche o agente e abra de novo (Eterna.command): a janela mostra \"Recorte local: pronto\"."
fim 0
