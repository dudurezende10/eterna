# Eterna · deixa o servidor do ponto pronto, de uma vez (rodar como administrador; é o que o Eterna-Servidor.exe executa).
# O Eterna passa a ligar com o Windows como tarefa do SISTEMA: sem ninguém entrar, sem senha de usuário e sem depender de
# quem usa o computador. A pasta Eterna (fotos, sessões, nuvem.env, chaves) continua no perfil do usuário dono (ex.: Rafael).
# Passos: acha a pasta do Eterna; para o Eterna e o vigia do usuário; desliga o atalho do vigia na pasta Inicializar
# (senão sobem dois); cria a tarefa "Eterna" (SYSTEM, ao iniciar, religa se cair); libera o firewall (Python e portas 8765 e
# 2121, inclusive desfazendo bloqueio de "Cancelar"); impede dormir na tomada e com a tampa fechada; atalho "Eterna" na área
# de trabalho de todos; liga e confere.
#   powershell -ExecutionPolicy Bypass -File instalar-servidor.ps1                       (acha a pasta sozinho)
#   powershell -ExecutionPolicy Bypass -File instalar-servidor.ps1 -Base C:\Users\RafaelMelo
param([string]$Base, [switch]$Pausa)
$ErrorActionPreference = 'Stop'
trap { Write-Host ''; Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red; if ($Pausa) { Read-Host 'Enter para fechar' | Out-Null }; exit 1 }
function Passo($t) { Write-Host ''; Write-Host ('== ' + $t) -ForegroundColor Cyan }
function Ok($t) { Write-Host ('   ok  ' + $t) -ForegroundColor Green }
function Aviso($t) { Write-Host ('   !!  ' + $t) -ForegroundColor Yellow }

$adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $adm) { throw 'Rode como administrador (botão direito > Executar como administrador).' }

Passo 'Pasta do Eterna'
if (-not $Base) {
  # o perfil com a venv do Eterna; se houver mais de um, o que recebeu foto ou sessão mais recentemente
  $cands = Get-ChildItem C:\Users -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'Eterna\venv\Scripts\python.exe') }
  $Base = ($cands | Sort-Object { (Get-Item (Join-Path $_.FullName 'Eterna')).LastWriteTime } -Descending | Select-Object -First 1).FullName
}
if (-not $Base -or -not (Test-Path (Join-Path $Base 'Eterna\venv\Scripts\python.exe'))) { throw 'Não achei a pasta do Eterna com a venv (C:\Users\<usuário>\Eterna\venv). Rode antes o instalar-vigia no usuário.' }
$dir = Join-Path $Base 'Eterna\programa'
$vigia = Join-Path $dir 'eterna-vigia.ps1'
New-Item -ItemType Directory -Force $dir | Out-Null
curl.exe -fsSL -m 60 -o "$vigia.novo" https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/eterna-vigia.ps1
if ((Test-Path "$vigia.novo") -and (Get-Item "$vigia.novo").Length -gt 500) { Move-Item -Force "$vigia.novo" $vigia }
if (-not (Test-Path $vigia)) { throw "Sem o vigia em $vigia (e sem internet para baixar)." }
Ok "Eterna de $Base"

Passo 'Parando o Eterna que roda no usuário'
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*eterna-vigia.ps1*' -or ($_.Name -eq 'python.exe' -and $_.CommandLine -like '*eterna-agente.py*') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Ok ("parado " + $_.Name + " " + $_.ProcessId) }
Get-ChildItem C:\Users -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $a = Join-Path $_.FullName 'AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Eterna vigia.cmd'
  if (Test-Path $a) { Rename-Item $a ($a + '.desligado') -Force; Ok ("atalho do vigia desligado em " + $_.Name) }
}

Passo 'Tarefa "Eterna" do sistema'
$cmd = "`$env:ETERNA_BASE='$Base'; & '$vigia'"
$acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command `"$cmd`""
$quando = New-ScheduledTaskTrigger -AtStartup
$quem = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$como = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Eterna' -Action $acao -Trigger $quando -Principal $quem -Settings $como -Force | Out-Null
Ok 'liga com o Windows, sem ninguém entrar; religa se cair'

Passo 'Firewall'
$pys = @(Join-Path $Base 'Eterna\venv\Scripts\python.exe')
$cfg = Join-Path $Base 'Eterna\venv\pyvenv.cfg'
if (Test-Path $cfg) { $h = ((Get-Content $cfg | Where-Object { $_ -match '^home\s*=' }) -replace '^home\s*=\s*', '').Trim(); if ($h) { $pys += (Join-Path $h 'python.exe') } }
foreach ($py in $pys) {
  # "Cancelar" na janela do Windows grava um bloqueio para o Python, que vale mais que qualquer liberação
  Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue | Where-Object { $_.Program -eq $py } | Get-NetFirewallRule |
    Where-Object { $_.Action -eq 'Block' } | Set-NetFirewallRule -Action Allow
}
Get-NetFirewallRule -DisplayName 'Eterna*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
foreach ($py in $pys) { New-NetFirewallRule -DisplayName ('Eterna Python ' + (Split-Path (Split-Path $py) -Leaf)) -Direction Inbound -Program $py -Action Allow -Profile Any | Out-Null }
New-NetFirewallRule -DisplayName 'Eterna 8765 e FTP 2121' -Direction Inbound -Protocol TCP -LocalPort 8765,2121 -Action Allow -Profile Any | Out-Null
$pol = Get-NetFirewallProfile -PolicyStore ActiveStore -ErrorAction SilentlyContinue | Where-Object { $_.AllowLocalFirewallRules -eq 'False' }
if ($pol) { Aviso ('a política da empresa ignora regras locais no perfil ' + (($pol | ForEach-Object Name) -join ', ') + ': quem estiver nessa rede não conecta') } else { Ok 'Python e portas 8765 e 2121 liberados' }

Passo 'Energia'
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
powercfg /setdcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 | Out-Null
powercfg /setactive SCHEME_CURRENT | Out-Null
Ok 'não dorme na tomada; fechar a tampa não faz nada'

Passo 'Atalho "Eterna" na área de trabalho de todos'
Get-ChildItem C:\Users -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  foreach ($m in @((Join-Path $_.FullName 'Desktop\Eterna.lnk'), (Join-Path $_.FullName 'OneDrive*\*\Eterna.lnk'))) {
    Get-Item $m -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue      # atalhos antigos (vigia/tarefa do usuário)
  }
}
$pub = Join-Path $env:PUBLIC 'Desktop\Eterna.url'
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
Set-Content -Encoding ascii $pub @('[InternetShortcut]', 'URL=http://localhost:8765/', $(if ($chrome) { "IconFile=$chrome" }), 'IconIndex=0')
Ok $pub

Passo 'Ligando'
Start-ScheduledTask -TaskName 'Eterna'
$fim = (Get-Date).AddMinutes(3); $no = $false
while ((Get-Date) -lt $fim) { if ((curl.exe -s -o NUL -w '%{http_code}' -m 5 http://127.0.0.1:8765/status) -eq '200') { $no = $true; break }; Start-Sleep 3 }
if (-not $no) { Aviso ('o Eterna não respondeu em 3 minutos; veja ' + (Join-Path $Base 'Eterna\vigia.log')) } else {
  $s = curl.exe -s -m 5 http://127.0.0.1:8765/status | ConvertFrom-Json
  Ok ('no ar · impressora ' + $(if ($s.impressora) { $s.impressora } else { 'nenhuma' }) + ' · nuvem ' + $(if ($s.nuvem.s3_ok) { 'ok' } else { 'sem conexão' }) + ' · rostos ' + $s.rostos.lidas)
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object IPAddress
  Write-Host ''
  Write-Host '   Endereços para os pontos:' -ForegroundColor Cyan
  foreach ($ip in $ips) { Write-Host ("     http://{0}:8765" -f $ip) }
  Write-Host ("     http://{0}:8765  (pelo Tailscale)" -f $env:COMPUTERNAME.ToLower())
}
Write-Host ''
Write-Host 'Pronto. Pode reiniciar o computador: o Eterna sobe sozinho, sem ninguém entrar.' -ForegroundColor Green
if ($Pausa) { Read-Host 'Enter para fechar' | Out-Null }
