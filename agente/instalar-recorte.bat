@echo off
rem Eterna - instala o recorte local dos fundos de IA (v97: BiRefNet + a regra do que encosta na pessoa), uma vez por computador.
rem Cria %USERPROFILE%\Eterna\venv com as versoes fixas de recorte-requisitos.txt (todas as rodas, com SHA-256 conferido pelo
rem pip: --require-hashes) e baixa os 4 modelos: birefnet-general, u2net_human_seg e isnet-general-use (pelo rembg, que confere
rem o hash de cada um) e o MoveNet (SHA-256 conferido), cerca de 1,3 GB.
rem Precisa de 16 GB de memoria. Servidor com placa NVIDIA: rode "instalar-recorte.bat gpu" (usa recorte-requisitos-gpu.txt:
rem onnxruntime-gpu com CUDA 13 e cuDNN 9 por pip, sem o onnxruntime de CPU; driver NVIDIA 580 ou mais novo).
rem Rodar de novo nao baixa nada que ja esteja certo. Servidor do estadio (servico como SYSTEM): o venv do servico fica fora
rem do perfil do usuario, so Administradores e SYSTEM gravam (passo do Ronaldo no docs/CHECKLIST-SERVIDOR.md); use
rem "instalar-recorte.bat gpu C:\caminho\do\venv" para instalar nele.
rem Depois, feche e abra o agente (iniciar-eterna.bat): ele passa a usar o Python do venv.
chcp 65001 >nul
title Eterna - instalar recorte local
cd /d "%~dp0"
set "VENV=%USERPROFILE%\Eterna\venv"
if not "%~2"=="" set "VENV=%~2"
set "REQ=recorte-requisitos.txt"
set "GPU="
if /i "%~1"=="gpu" (
  set "GPU=1"
  set "REQ=recorte-requisitos-gpu.txt"
)
set "PIPI=--disable-pip-version-check --require-hashes --only-binary=:all:"
set "BASE=https://raw.githubusercontent.com/dudurezende10/eterna/main/agente"
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
set "PY=%VENV%\Scripts\python.exe"
for %%f in (%REQ% recorte-requisitos-ort-gpu.txt instalar-recorte-modelos.py) do (
  if not exist %%f curl -fsSL -o %%f %BASE%/%%f
)
if defined GPU (
  rem onnxruntime (CPU) e onnxruntime-gpu dividem a mesma pasta: o de CPU sai antes; se os dois estavam instalados, sai o
  rem da placa tambem e a linha de baixo instala de novo, limpo (do cache do pip, sem baixar outra vez).
  "%PY%" -m pip show -q onnxruntime >nul 2>nul
  if not errorlevel 1 (
    echo Tirando o onnxruntime de CPU, que ocupa a mesma pasta do onnxruntime da placa de video...
    "%PY%" -m pip uninstall -y -q onnxruntime onnxruntime-gpu
  )
) else (
  "%PY%" -m pip show -q onnxruntime-gpu >nul 2>nul
  if not errorlevel 1 (
    echo Este computador tinha o onnxruntime da placa de video; trocando pelo de CPU...
    "%PY%" -m pip uninstall -y -q onnxruntime onnxruntime-gpu
  )
)
echo Instalando as versoes fixas de %REQ% (com o hash de cada arquivo; pode levar alguns minutos)...
"%PY%" -m pip install %PIPI% -r %REQ%
if errorlevel 1 (
  echo Nao deu para instalar. Se o erro fala de hash, o arquivo baixado nao confere: nao continue e avise o Eduardo.
  pause
  exit /b 1
)
if defined GPU (
  "%PY%" -c "import onnxruntime as o, sys; sys.exit(0 if 'CUDAExecutionProvider' in o.get_available_providers() else 1)" 2>nul
  if errorlevel 1 (
    echo O onnxruntime da placa de video ficou sem o provedor CUDA: instalando de novo so ele...
    "%PY%" -m pip install %PIPI% --force-reinstall --no-deps -r recorte-requisitos-ort-gpu.txt
    if errorlevel 1 (
      echo Nao deu para instalar o onnxruntime da placa de video.
      pause
      exit /b 1
    )
  )
)
echo Baixando os modelos do recorte (birefnet-general, u2net_human_seg, isnet-general-use e MoveNet; cerca de 1,3 GB)...
"%PY%" instalar-recorte-modelos.py
if errorlevel 1 (
  echo Nao deu para baixar os modelos.
  pause
  exit /b 1
)
if defined GPU (
  "%PY%" instalar-recorte-modelos.py --provedor
  if errorlevel 1 echo ATENCAO: a placa de video nao abriu; o recorte vai rodar no processador. Confira o driver NVIDIA.
)
echo.
echo Pronto. Feche o agente e abra de novo (iniciar-eterna.bat). No /status, recorte.provedor mostra cuda ou cpu.
pause
