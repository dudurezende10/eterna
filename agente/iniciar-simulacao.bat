@echo off
rem Eterna - SIMULACAO v97 (montagem no servidor), a partir do clone do repositorio. Windows, sem placa de video.
rem Dois cliques neste arquivo. Na primeira vez instala o recorte local (processador) numa pasta propria e baixa os
rem modelos (cerca de 1,3 GB); nas seguintes, so abre. Nao mexe na instalacao de producao do Eterna nem nas portas dela:
rem   dados e ambiente em %USERPROFILE%\Eterna-simulacao   (apagar essa pasta apaga tudo da simulacao)
rem   portas 8797 (Eterna), 2197 (FTP) e 8798 (so neste computador)
rem Precisa do Python 3.12 ou 3.13 de 64 bits e de 16 GB de memoria. Roteiro: docs\SIMULACAO.md
rem ATENCAO: esta versao nao tem o login do servidor. So em rede de confianca, com fotos de teste; feche ao terminar.
setlocal
chcp 65001 >nul
title Eterna - simulacao v97
cd /d "%~dp0"

set "SIM=%USERPROFILE%\Eterna-simulacao"
if not "%ETERNA_SIM_PASTA%"=="" set "SIM=%ETERNA_SIM_PASTA%"

rem Python do sistema: o lancador "py" com 3.13 ou 3.12; senao, o "python" do PATH
set "PYSYS="
py -3.13 -c "pass" >nul 2>nul
if not errorlevel 1 set "PYSYS=py -3.13"
if defined PYSYS goto tem_python
py -3.12 -c "pass" >nul 2>nul
if not errorlevel 1 set "PYSYS=py -3.12"
if defined PYSYS goto tem_python
python -c "pass" >nul 2>nul
if not errorlevel 1 set "PYSYS=python"
if defined PYSYS goto tem_python
echo.
echo Python nao encontrado. Instale o Python 3.12 ou 3.13 de 64 bits em https://www.python.org/downloads/
echo marcando "Add python.exe to PATH", e rode este arquivo de novo.
goto erro

:tem_python
%PYSYS% "%~dp0iniciar-simulacao.py" --confere-python
if errorlevel 1 goto erro

if not exist "%SIM%" mkdir "%SIM%"
if not exist "%SIM%\Eterna" mkdir "%SIM%\Eterna"
set "VENV=%SIM%\Eterna\venv"
if exist "%VENV%\Scripts\python.exe" goto tem_venv
echo Criando o ambiente da simulacao em "%VENV%" ...
%PYSYS% -m venv "%VENV%"
if errorlevel 1 goto erro_venv

:tem_venv
rem daqui para a frente tudo o que usa a pasta do usuario cai na pasta da simulacao (ambiente, modelos e dados)
set "ETERNA_SIM_PASTA=%SIM%"
set "USERPROFILE=%SIM%"
set "HOME=%SIM%"
set "PATH=%VENV%\Scripts;%PATH%"

"%VENV%\Scripts\python.exe" "%~dp0iniciar-simulacao.py" --confere-recorte
if not errorlevel 1 goto iniciar
echo.
echo Primeira vez: instalando o recorte local (processador, sem placa de video) na pasta da simulacao.
echo Baixa cerca de 1,3 GB e pode levar varios minutos. Ao terminar, aperte uma tecla para continuar.
echo.
call "%~dp0instalar-recorte.bat"
cd /d "%~dp0"
"%VENV%\Scripts\python.exe" "%~dp0iniciar-simulacao.py" --confere-recorte
if errorlevel 1 goto erro_recorte

:iniciar
"%VENV%\Scripts\python.exe" "%~dp0iniciar-simulacao.py"
echo.
echo A simulacao foi encerrada.
pause
endlocal
exit /b 0

:erro_venv
echo Nao deu para criar o ambiente em "%VENV%".
goto erro

:erro_recorte
echo.
echo O recorte local nao ficou instalado. Veja a mensagem acima, confira a internet e rode este arquivo de novo.

:erro
echo.
pause
endlocal
exit /b 1
