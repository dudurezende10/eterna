@echo off
rem Eterna - servidor do ponto (Windows).
rem Baixa a versao mais nova do agente, instala o que falta e liga o Eterna local na rede.
rem Uso:  iniciar-eterna.bat                      (recebe pelo FTP do proprio Eterna, porta 2121 se a 21 estiver ocupada)
rem       iniciar-eterna.bat "C:\pasta\do\ftp"    (vigia a pasta de um servidor FTP que ja existe na maquina)
chcp 65001 >nul
title Eterna - servidor do ponto
set "PROG=%USERPROFILE%\Eterna\programa"
if not exist "%PROG%" mkdir "%PROG%"
cd /d "%PROG%"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo Python nao encontrado. Instale o Python 3.12 em https://www.python.org/downloads/
  echo marcando "Add python.exe to PATH", e rode este arquivo de novo.
  pause
  exit /b 1
)

echo Baixando a versao mais nova do Eterna...
curl -fsSL -o eterna-agente.py https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/eterna-agente.py
curl -fsSL -o teste-carga.py https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/teste-carga.py

rem v84: com o recorte local instalado (instalar-recorte.bat), usa o Python de %USERPROFILE%\Eterna\venv
set "PY=python"
if exist "%USERPROFILE%\Eterna\venv\Scripts\python.exe" set "PY=%USERPROFILE%\Eterna\venv\Scripts\python.exe"
echo Conferindo bibliotecas (OpenCV, numpy, psutil; boto3 e cryptography para a nuvem)...
"%PY%" -m pip install --quiet --disable-pip-version-check opencv-python-headless numpy psutil boto3 cryptography

set ETERNA_REDE=1
if "%ETERNA_LEITORES%"=="" set ETERNA_LEITORES=4
if not "%~1"=="" set "ETERNA_PASTA=%~1"

echo.
echo Abra o Eterna em qualquer computador da rede:  http://%COMPUTERNAME%:8765  (ou pelo IP desta maquina)
echo Se o Windows perguntar se o Python pode usar a rede, clique em Permitir (redes privadas).
echo.
"%PY%" eterna-agente.py
pause
