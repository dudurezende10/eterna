# Monta o Eterna-Servidor.exe com o csc do .NET Framework do próprio Windows (sem instalar nada).
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:exe /out:"$aqui\Eterna-Servidor.exe" /win32manifest:"$aqui\app.manifest" `
  /resource:"$aqui\..\instalar-servidor.ps1,instalar-servidor.ps1" "$aqui\Eterna-Servidor.cs"
if ($LASTEXITCODE) { throw 'csc falhou' }
Get-Item "$aqui\Eterna-Servidor.exe" | Select-Object Name, Length
