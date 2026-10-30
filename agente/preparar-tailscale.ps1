# Deixa o servidor do estádio pronto para a curadoria remota pelo Tailscale (rede privada, sem porta aberta na internet).
# Rodar UMA vez no servidor, no PowerShell como administrador:
#   powershell -ExecutionPolicy Bypass -File preparar-tailscale.ps1
# O que faz:
#  1. instala o Tailscale (se faltar) e pede o login da conta da TI, deixando-o ligado sem ninguém logado (unattended);
#  2. acrescenta ao ETERNA_ORIGENS do nuvem.env o endereço do servidor na rede local e no Tailscale (IP 100.x e nome);
#  3. libera a porta 8765 no firewall só para a rede local e para a faixa do Tailscale (100.64.0.0/10);
#  4. reinicia o Eterna (o vigia religa em até 30 s, já com o main mais novo).
$ErrorActionPreference = 'Stop'
$ts = "$env:ProgramFiles\Tailscale\tailscale.exe"

if (-not (Test-Path $ts)) {
  Write-Host 'Instalando o Tailscale...'
  winget install --id Tailscale.Tailscale -e --accept-source-agreements --accept-package-agreements
}
if (-not (Test-Path $ts)) { throw 'Tailscale não instalou. Baixe em https://tailscale.com/download/windows e rode de novo.' }

$st = & $ts status --json | ConvertFrom-Json
if ($st.BackendState -ne 'Running') {
  Write-Host 'Entre com ti@maracatour.com.br na janela do navegador que vai abrir...'
  & $ts up --unattended
  $st = & $ts status --json | ConvertFrom-Json
} else {
  & $ts set --unattended 2>$null
}
$ip = ($st.Self.TailscaleIPs | Where-Object { $_ -like '100.*' } | Select-Object -First 1)
$fqdn = ($st.Self.DNSName).TrimEnd('.')
$curto = $fqdn.Split('.')[0]
Write-Host "Tailscale: $ip  ($curto / $fqdn)"

# endereços locais IPv4 desta máquina (rede do estádio), fora o loopback e o próprio Tailscale
$locais = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '100.*' -and $_.IPAddress -notlike '169.254.*' } | ForEach-Object { $_.IPAddress }

# nuvem.env de quem roda o Eterna (o vigia lê ~/Eterna/nuvem.env)
$envs = Get-ChildItem 'C:\Users\*\Eterna\nuvem.env' -ErrorAction SilentlyContinue
if (-not $envs) { throw 'Não achei C:\Users\<usuário>\Eterna\nuvem.env. O Eterna já rodou neste servidor?' }
$novos = @("http://${ip}:8765", "http://${curto}:8765", "http://${fqdn}:8765") + ($locais | ForEach-Object { "http://${_}:8765" })
foreach ($f in $envs) {
  $linhas = @(Get-Content $f.FullName -Encoding UTF8)
  $i = [array]::FindIndex([string[]]$linhas, [Predicate[string]]{ param($l) $l -match '^\s*ETERNA_ORIGENS\s*=' })
  $atuais = @()
  if ($i -ge 0) { $atuais = ($linhas[$i] -replace '^\s*ETERNA_ORIGENS\s*=\s*', '').Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
  $todas = (@($atuais) + @($novos)) | Select-Object -Unique   # @(): com um endereço só, $atuais vira texto e o + colava sem vírgula
  $linha = 'ETERNA_ORIGENS=' + ($todas -join ',')
  if ($i -ge 0) { $linhas[$i] = $linha } else { $linhas += $linha }
  Copy-Item $f.FullName ($f.FullName + '.bak') -Force
  [IO.File]::WriteAllLines($f.FullName, $linhas, (New-Object Text.UTF8Encoding $false))
  Write-Host "Atualizado: $($f.FullName)"
  Write-Host "  $linha"
}

# firewall: 8765 só da rede local e do Tailscale
Get-NetFirewallRule -DisplayName 'Eterna 8765 (rede e Tailscale)' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Eterna 8765 (rede e Tailscale)' -Direction Inbound -Protocol TCP -LocalPort 8765 -Action Allow -RemoteAddress LocalSubnet, '100.64.0.0/10' -Profile Any | Out-Null
Write-Host 'Firewall: porta 8765 liberada para a rede local e o Tailscale'

# reinicia o Eterna: o vigia percebe e religa com o código novo
$ag = Get-CimInstance Win32_Process -Filter "Name like 'python%'" | Where-Object { $_.CommandLine -like '*eterna-agente.py*' }
if ($ag) { $ag | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'Eterna reiniciando (o vigia religa em até 30 s)' }
else { Write-Host 'O Eterna não estava rodando: abra pelo atalho do vigia ou pelo iniciar-eterna.bat' }

Write-Host ''
Write-Host 'Pronto. No Mac do Eduardo (com o Tailscale ligado):'
Write-Host "  http://${curto}:8765    ou    http://${ip}:8765"
