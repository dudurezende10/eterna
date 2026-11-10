@echo off
rem Prepara este computador como posto de venda do Eterna. Duplo clique, uma vez por maquina.
rem Cria o atalho "Eterna" na Area de Trabalho e outro que abre o Eterna ao ligar o Windows.
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -Encoding UTF8 '%~f0') -split ('#'+'ETERNA'+'#'),2)[1]"
pause
exit /b
#ETERNA#
$Endereco = "http://192.168.10.178:8799"   # servidor do Eterna; mudou o servidor, troque aqui e rode de novo
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { Write-Host "Chrome nao encontrado. Instale o Google Chrome e rode de novo."; return }
$perfil = "C:\Eterna\chrome"
New-Item -ItemType Directory -Force $perfil | Out-Null
$argumentos = "--user-data-dir=`"$perfil`" --kiosk-printing --no-first-run --no-default-browser-check --unsafely-treat-insecure-origin-as-secure=$Endereco $Endereco/#posto"
$w = New-Object -ComObject WScript.Shell
foreach ($l in @((Join-Path ([Environment]::GetFolderPath("Desktop")) "Eterna.lnk"), (Join-Path ([Environment]::GetFolderPath("Startup")) "Eterna.lnk"))) {
    $s = $w.CreateShortcut($l); $s.TargetPath = $chrome; $s.Arguments = $argumentos; $s.WorkingDirectory = Split-Path $chrome
    $s.IconLocation = "$chrome,0"; $s.Description = "Eterna - posto de venda"; $s.Save()
    Write-Host "Atalho criado: $l"
}
$padrao = (Get-CimInstance Win32_Printer -Filter "Default=True" -ErrorAction SilentlyContinue).Name
Write-Host ""
Write-Host "Impressora padrao: $padrao"
if ($padrao -notmatch "DS-RX1|DNP") { Write-Host "ATENCAO: a impressora padrao nao e a DNP. Deixe a DS-RX1 como padrao antes de vender." }
else { Write-Host "Tudo certo. Feche todos os Chromes e abra o Eterna pelo atalho da Area de Trabalho." }
