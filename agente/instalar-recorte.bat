@echo off
rem Eterna - instala o recorte local dos fundos de IA (v97: BiRefNet + a regra do que encosta na pessoa), uma vez por computador.
rem Cria %USERPROFILE%\Eterna\venv com versoes fixas e baixa os 4 modelos: birefnet-general, u2net_human_seg e isnet-general-use
rem (pelo rembg, que confere o hash de cada um) e o MoveNet (SHA-256 conferido), cerca de 1,3 GB.
rem Precisa de 16 GB de memoria. Servidor com placa NVIDIA: rode "instalar-recorte.bat gpu" (usa a placa; driver NVIDIA
rem recente, serie RTX 50 exige driver e CUDA 12.8 ou mais novos). Rodar de novo nao baixa nada que ja esteja certo.
rem Depois, feche e abra o agente (iniciar-eterna.bat): ele passa a usar o Python do venv.
chcp 65001 >nul
title Eterna - instalar recorte local
cd /d "%~dp0"
set "VENV=%USERPROFILE%\Eterna\venv"
set "PACOTES=rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2"
rem Versao do onnxruntime da placa: a confirmar pelo Ronaldo no servidor (mesma versao do onnxruntime da CPU).
set "PACOTE_GPU=onnxruntime-gpu[cuda,cudnn]==1.29.0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale o Python 3.12 em https://www.python.org/downloads/
  echo marcando "Add python.exe to PATH", e rode este arquivo de novo.
  pause
  exit /b 1
)
if not exist "%USERPROFILE%\Eterna" mkdir "%USERPROFILE%\Eterna"
if not exist "%VENV%\Scripts\python.exe" (
  echo Criando o ambiente do Eterna em %VENV%...
  python -m venv "%VENV%"
  if errorlevel 1 (
    echo Nao deu para criar o ambiente.
    pause
    exit /b 1
  )
)
echo Instalando %PACOTES% (pode levar alguns minutos)...
"%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check %PACOTES%
if errorlevel 1 (
  echo Nao deu para instalar.
  pause
  exit /b 1
)
if /i "%~1"=="gpu" (
  echo Trocando o onnxruntime pelo da placa de video: %PACOTE_GPU% com as bibliotecas CUDA e cuDNN...
  "%VENV%\Scripts\python.exe" -m pip uninstall -y onnxruntime
  "%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check "%PACOTE_GPU%"
  if errorlevel 1 (
    echo Nao deu para instalar o onnxruntime da placa de video.
    pause
    exit /b 1
  )
)
if not exist instalar-recorte-modelos.py curl -fsSL -o instalar-recorte-modelos.py https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/instalar-recorte-modelos.py
echo Baixando os modelos do recorte (birefnet-general, u2net_human_seg, isnet-general-use e MoveNet; cerca de 1,3 GB)...
"%VENV%\Scripts\python.exe" instalar-recorte-modelos.py
if errorlevel 1 (
  echo Nao deu para baixar os modelos.
  pause
  exit /b 1
)
if /i "%~1"=="gpu" (
  "%VENV%\Scripts\python.exe" instalar-recorte-modelos.py --provedor
  if errorlevel 1 echo ATENCAO: a placa de video nao abriu; o recorte vai rodar no processador. Confira o driver NVIDIA.
)
echo.
echo Pronto. Feche o agente e abra de novo (iniciar-eterna.bat). No /status, recorte.provedor mostra cuda ou cpu.
pause
