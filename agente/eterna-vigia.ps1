# Eterna · vigia do servidor do ponto (Windows).
# Liga o Eterna e, a cada 30 s, pergunta se ele responde (http://127.0.0.1:8765/status). Três faltas seguidas
# (cerca de 1min30), ou o processo fechado, e ele mata o que sobrou e liga de novo. Roda sozinho na entrada do
# Windows (atalho na pasta Inicializar, criado por instalar-vigia.ps1). Registro em ~/Eterna/vigia.log.
# A configuração do ponto fica em ~/Eterna/nuvem.env (ETERNA_PASTA, ETERNA_ORIGENS, ETERNA_IMPRESSORA, nuvem...).
$ErrorActionPreference = 'SilentlyContinue'
# ETERNA_BASE: outro usuário do Windows liga o MESMO Eterna (pasta, fotos, nuvem e AWS do usuário dono), sem copiar nada.
# Ex.: no atalho do usuário do dia a dia, ETERNA_BASE=C:\Users\eterna. O agente e o boto3 acham ~ pelo USERPROFILE.
$base = if ($env:ETERNA_BASE) { $env:ETERNA_BASE } else { $HOME }
$dir = Join-Path $base 'Eterna\programa'
$py = Join-Path $base 'Eterna\venv\Scripts\python.exe'                      # com o recorte local da v84
if (-not (Test-Path $py)) { $py = Join-Path $base 'AppData\Local\Programs\Python\Python312\python.exe' }
$log = Join-Path $base 'Eterna\vigia.log'
$fonte = 'https://raw.githubusercontent.com/dudurezende10/eterna/main/agente/eterna-agente.py'

function Registra($m) { Add-Content -Path $log -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

function Liga {
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*eterna-agente.py*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  # versão mais nova do main; sem internet (ou download quebrado), fica a que já está no disco
  $novo = Join-Path $dir 'eterna-agente.py.novo'
  curl.exe -fsSL -m 60 -o $novo $fonte
  if ((Test-Path $novo) -and (Get-Item $novo).Length -gt 50000) { Move-Item -Force $novo (Join-Path $dir 'eterna-agente.py') }
  $env:ETERNA_REDE = '1'
  $env:USERPROFILE = $base                                                   # ~/Eterna e ~/.aws do usuário dono
  Start-Process -FilePath $py -ArgumentList 'eterna-agente.py' -WorkingDirectory $dir -WindowStyle Minimized
  Registra 'Eterna ligado'
}

function Responde {
  # curl com tempo máximo de verdade: o Invoke-WebRequest fica esperando para sempre quando o Eterna trava aceitando a conexão
  $c = curl.exe -s -o NUL -w '%{http_code}' -m 10 http://127.0.0.1:8765/status
  return ($c -eq '200')
}

Registra 'vigia iniciado'
if (-not (Responde)) { Liga; Start-Sleep -Seconds 60 }
$faltas = 0
while ($true) {
  if (Responde) { $faltas = 0 } else { $faltas++; Registra "Eterna sem resposta ($faltas de 3)" }
  if ($faltas -ge 3) { Registra 'religando'; Liga; $faltas = 0; Start-Sleep -Seconds 60 }
  Start-Sleep -Seconds 30
}
