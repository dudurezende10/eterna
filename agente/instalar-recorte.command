#!/bin/bash
# Eterna · instala o recorte local dos fundos de IA (v84), uma vez por computador.
# Cria ~/Eterna/venv (ambiente separado do Python do sistema) com versões fixas e baixa os dois modelos usados pelo
# agente: isnet-general-use e u2net_human_seg (cerca de 350 MB). Recomendado: 16 GB de memória.
# Depois, feche e abra o agente (Eterna.command): ele passa a usar o Python de ~/Eterna/venv.
cd "$(dirname "$0")"
VENV="$HOME/Eterna/venv"
PACOTES="rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2"
fim() { read -n 1 -s -r -p "Aperte uma tecla para fechar."; exit "$1"; }
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 não encontrado. Instale em https://www.python.org/downloads/ e rode de novo."; fim 1
fi
mkdir -p "$HOME/Eterna"
if [ ! -x "$VENV/bin/python3" ]; then
  echo "Criando o ambiente do Eterna em $VENV..."
  python3 -m venv "$VENV" || { echo "Não deu para criar o ambiente."; fim 1; }
fi
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
