# Eterna · instala o vigia no usuário atual (sem administrador): baixa eterna-vigia.ps1 e põe um atalho na pasta
# Inicializar, para o Eterna ligar sozinho quando o Windows entrar nesse usuário.
# Para ligar sozinho depois de queda de energia, o Windows também precisa entrar sozinho no usuário (Autologon,
# feito por quem tem a senha de administrador) e a BIOS precisa religar o computador quando a energia volta.
$dir = Join-Path $HOME 'Eterna\programa'
New-Item -ItemType Directory -Force $dir | Out-Null
curl.exe -fsSL -o (Join-Path $dir 'eterna-vigia.ps1') https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/eterna-vigia.ps1
$ini = [Environment]::GetFolderPath('Startup')
Set-Content -Encoding ascii (Join-Path $ini 'Eterna vigia.cmd') ('@start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "' + (Join-Path $dir 'eterna-vigia.ps1') + '"')
Write-Output ('Vigia instalado. Atalho: ' + (Join-Path $ini 'Eterna vigia.cmd'))
