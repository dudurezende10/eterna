@echo off
rem Eterna - instala o recorte local dos fundos de IA (v84), uma vez por computador.
rem Cria %USERPROFILE%\Eterna\venv com versoes fixas e baixa os modelos isnet-general-use e u2net_human_seg (cerca de 350 MB).
rem Recomendado: 16 GB de memoria. Depois, feche e abra o agente (iniciar-eterna.bat): ele passa a usar o Python do venv.
chcp 65001 >nul
title Eterna - instalar recorte local
set "VENV=%USERPROFILE%\Eterna\venv"
set "PACOTES=rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2"
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
echo Baixando os modelos de recorte (isnet-general-use e u2net_human_seg)...
"%VENV%\Scripts\python.exe" -c "from rembg import new_session; [new_session(m) for m in ('isnet-general-use','u2net_human_seg')]"
if errorlevel 1 (
  echo Nao deu para baixar os modelos.
  pause
  exit /b 1
)
echo.
echo Pronto. Feche o agente e abra de novo (iniciar-eterna.bat).
pause
