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
$repo = 'dudurezende10/eterna'

function Registra($m) { Add-Content -Path $log -Value ('{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m) }

# Versão do agente (pedido do Eduardo, 02/11): canal estável (padrão) = só a última release do GitHub (tag vNN, montada
# pela automação liberar-versao.yml) e só com o SHA-256 conferido contra o eterna-agente.py.sha256 da mesma release.
# ETERNA_CANAL=teste no nuvem.env segue o main (servidor de teste), só com a conferência de sintaxe. Qualquer falha
# (sem internet, sem release, SHA-256 diferente, arquivo que não compila): fica a versão que já está no disco.
function Canal {
  $c = Select-String -Path (Join-Path $base 'Eterna\nuvem.env') -Pattern '^\s*ETERNA_CANAL\s*=\s*(\S+)' | Select-Object -First 1
  if ($c) { $c.Matches[0].Groups[1].Value.Trim().ToLower() } else { 'estavel' }
}

function Atualiza {
  $novo = Join-Path $dir 'eterna-agente.py.novo'
  Remove-Item $novo -Force
  if ((Canal) -eq 'teste') {
    $ref = 'main'
    curl.exe -fsSL -m 60 -o $novo "https://raw.githubusercontent.com/$repo/main/agente/eterna-agente.py"
    $esperado = $null
  } else {
    $rel = curl.exe -fsSL -m 30 "https://api.github.com/repos/$repo/releases/latest" | ConvertFrom-Json
    if (-not $rel -or -not $rel.tag_name) { Registra 'sem release no GitHub (ou sem internet): fica a versão do disco'; return }
    $ref = $rel.tag_name
    $url = ($rel.assets | Where-Object { $_.name -eq 'eterna-agente.py' }).browser_download_url
    $urlSha = ($rel.assets | Where-Object { $_.name -eq 'eterna-agente.py.sha256' }).browser_download_url
    if (-not $url -or -not $urlSha) { Registra "release $ref sem o agente ou sem o SHA-256: fica a versão do disco"; return }
    $atual = Join-Path $dir 'versao.txt'
    if ((Test-Path $atual) -and ((Get-Content $atual -Raw).Trim() -eq $ref) -and (Test-Path (Join-Path $dir 'eterna-agente.py'))) { return }
    curl.exe -fsSL -m 60 -o $novo $url
    $esperado = ((curl.exe -fsSL -m 30 $urlSha) -split '\s+')[0].ToLower()
  }
  if (-not (Test-Path $novo) -or (Get-Item $novo).Length -lt 50000) { Remove-Item $novo -Force; Registra "download de $ref falhou: fica a versão do disco"; return }
  $tem = (Get-FileHash $novo -Algorithm SHA256).Hash.ToLower()
  if ($ref -ne 'main' -and $tem -ne $esperado) { Remove-Item $novo -Force; Registra "SHA-256 de $ref não confere ($tem): fica a versão do disco"; return }
  & $py -m py_compile $novo
  if ($LASTEXITCODE) { Remove-Item $novo -Force; Registra "agente de $ref não compila: fica a versão do disco"; return }
  Move-Item -Force $novo (Join-Path $dir 'eterna-agente.py')
  Set-Content -Path (Join-Path $dir 'versao.txt') -Value $ref -Encoding ascii
  Registra ("agente {0} (SHA-256 {1})" -f $ref, $tem.Substring(0, 12))
}

function Liga {
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*eterna-agente.py*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Atualiza
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
