#!/bin/bash
# Eterna · instala o recorte local dos fundos de IA (v84), uma vez por computador.
# Cria ~/Eterna/venv (ambiente separado do Python do sistema) com versões fixas e baixa os dois modelos usados pelo
# agente: isnet-general-use e u2net_human_seg (cerca de 350 MB). Recomendado: 16 GB de memória.
# O rembg exige Python 3.10 ou mais novo. Se o Mac só tem o 3.9 da Apple, o instalador baixa um Python 3.12
# só para o Eterna (via uv, dentro de ~/Eterna), sem pedir senha de administrador e sem mexer no Python do sistema.
# Depois, feche e abra o agente (Eterna.command): ele passa a usar o Python de ~/Eterna/venv.
cd "$(dirname "$0")"
ET="$HOME/Eterna"
VENV="$ET/venv"
PACOTES="rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2 boto3 cryptography"
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

# 3) Pacotes e modelos
echo "Instalando $PACOTES (pode levar alguns minutos)..."
"$VENV/bin/python3" -m pip install --disable-pip-version-check --upgrade pip >/dev/null
"$VENV/bin/python3" -m pip install --disable-pip-version-check $PACOTES || { echo "Não deu para instalar."; fim 1; }
echo "Baixando os modelos de recorte (isnet-general-use e u2net_human_seg)..."
"$VENV/bin/python3" -c "from rembg import new_session
for m in ('isnet-general-use', 'u2net_human_seg'):
    new_session(m); print('ok', m)" || { echo "Não deu para baixar os modelos."; fim 1; }
echo
echo "Pronto. Feche o agente e abra de novo (Eterna.command): a janela mostra \"Recorte local: pronto\"."
fim 0
