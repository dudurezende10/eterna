#!/bin/bash
# Eterna · instala o recorte local dos fundos de IA (v97: BiRefNet + a regra do que encosta na pessoa), uma vez por computador.
# Cria ~/Eterna/venv (ambiente separado do Python do sistema) com versões fixas e baixa os 4 modelos: birefnet-general,
# u2net_human_seg e isnet-general-use (pelo rembg, que confere o hash de cada um) e o MoveNet (SHA-256 conferido), cerca
# de 1,3 GB. Precisa de 16 GB de memória (o BiRefNet sozinho passa de 4,7 GB); servidor com placa NVIDIA usa a placa
# (no Windows: instalar-recorte.bat gpu). Rodar de novo não baixa nada que já esteja certo.
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
[ -f instalar-recorte-modelos.py ] || curl -fsSL -o instalar-recorte-modelos.py https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/instalar-recorte-modelos.py
echo "Baixando os modelos do recorte (birefnet-general, u2net_human_seg, isnet-general-use e MoveNet; cerca de 1,3 GB)..."
"$VENV/bin/python3" instalar-recorte-modelos.py || { echo "Não deu para baixar os modelos."; fim 1; }
echo
echo "Pronto. Feche o agente e abra de novo (Eterna.command): a janela mostra \"Recorte local: pronto\"."
fim 0
