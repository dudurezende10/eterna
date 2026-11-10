# Cria o atalho "Eterna" num posto de venda (Windows). Roda uma vez por máquina, sem ser administrador.
#
# O atalho abre o Posto de venda do Eterna (<endereço>/#posto) num Chrome só dele (perfil em C:\Eterna\chrome), sempre como processo novo, com:
#   --kiosk-printing  a foto sai direto na impressora padrão (a DNP), sem a janela de impressão
#   --unsafely-treat-insecure-origin-as-secure  libera a câmera enquanto o endereço não tem certificado
#
# Uso (PowerShell no posto):
#   powershell -ExecutionPolicy Bypass -File criar-atalho-eterna.ps1 -Endereco http://192.168.10.178:8799
#   ... -AoLigar     também abre o Eterna sozinho quando o Windows entra
#   ... -Remover     apaga os atalhos criados por este script
# Trocou o servidor (ex.: https://posto.eterna.photo)? Rode de novo com o endereço novo.
param(
    [string]$Endereco = "http://192.168.10.178:8799",
    [switch]$AoLigar,
    [switch]$Remover
)

$Endereco = $Endereco.TrimEnd("/")
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { Write-Host "Chrome não encontrado. Instale o Google Chrome e rode de novo."; exit 1 }

$destinos = @([Environment]::GetFolderPath("Desktop"))
$inicio = Join-Path ([Environment]::GetFolderPath("Startup")) "Eterna.lnk"

if ($Remover) {
    foreach ($d in $destinos) { Remove-Item (Join-Path $d "Eterna.lnk") -ErrorAction SilentlyContinue }
    Remove-Item $inicio -ErrorAction SilentlyContinue
    Write-Host "Atalhos do Eterna removidos."
    exit 0
}

$perfil = "C:\Eterna\chrome"
New-Item -ItemType Directory -Force $perfil | Out-Null
$argumentos = "--user-data-dir=`"$perfil`" --kiosk-printing --no-first-run --no-default-browser-check"
if ($Endereco -like "http://*") { $argumentos += " --unsafely-treat-insecure-origin-as-secure=$Endereco" }
$argumentos += " $Endereco/#posto"   # abre o Posto de venda: o vendedor entra e abre o Checkout por ali

$w = New-Object -ComObject WScript.Shell
$lista = @($destinos | ForEach-Object { Join-Path $_ "Eterna.lnk" })
if ($AoLigar) { $lista += $inicio }
foreach ($l in $lista) {
    $s = $w.CreateShortcut($l)
    $s.TargetPath = $chrome
    $s.Arguments = $argumentos
    $s.WorkingDirectory = Split-Path $chrome
    $s.IconLocation = "$chrome,0"
    $s.Description = "Eterna - posto de venda"
    $s.Save()
    Write-Host "Atalho criado: $l"
}
$padrao = (Get-CimInstance Win32_Printer -Filter "Default=True" -ErrorAction SilentlyContinue).Name
Write-Host "Impressora padrão: $padrao"
if ($padrao -notmatch "DS-RX1|DNP") { Write-Host "Atenção: a impressora padrão não é a DNP. As fotos sairiam em '$padrao'." }
