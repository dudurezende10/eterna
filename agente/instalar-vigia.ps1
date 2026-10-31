# Eterna · instala o vigia no usuário atual (sem administrador): baixa eterna-vigia.ps1 e põe um atalho na pasta
# Inicializar, para o Eterna ligar sozinho quando o Windows entrar nesse usuário, e o atalho "Eterna" na área de
# trabalho (liga o vigia se o Eterna estiver parado e abre http://localhost:8765).
# Para ligar sozinho depois de queda de energia, o Windows também precisa entrar sozinho no usuário (Autologon,
# feito por quem tem a senha de administrador) e a BIOS precisa religar o computador quando a energia volta.
$dir = Join-Path $HOME 'Eterna\programa'
New-Item -ItemType Directory -Force $dir | Out-Null
curl.exe -fsSL -o (Join-Path $dir 'eterna-vigia.ps1') https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/eterna-vigia.ps1
$ini = [Environment]::GetFolderPath('Startup')
Set-Content -Encoding ascii (Join-Path $ini 'Eterna vigia.cmd') ('@start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "' + (Join-Path $dir 'eterna-vigia.ps1') + '"')
$abrir = Join-Path $dir 'abrir-eterna.cmd'
Set-Content -Encoding ascii $abrir @(
  '@echo off'
  'curl.exe -s -m 3 -o nul http://127.0.0.1:8765/status || (start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0eterna-vigia.ps1" & timeout /t 15 >nul)'
  'start "" http://localhost:8765'
)
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Eterna.lnk'))
$lnk.TargetPath = $abrir
$lnk.WindowStyle = 7
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { $lnk.IconLocation = "$chrome,0" }
$lnk.Save()
Write-Output ('Vigia instalado. Atalho: ' + (Join-Path $ini 'Eterna vigia.cmd') + '. Atalho Eterna na área de trabalho.')
