# Monta o preparar-posto-eterna.cmd: cabeçalho (até o segundo #ETERNA#) + eterna-impressao.ps1. Rode depois de mudar o .ps1.
$d = Split-Path $MyInvocation.MyCommand.Path
$cmd = Join-Path $d "preparar-posto-eterna.cmd"
$m = '#' + 'ETERNA' + '#'
$p = (Get-Content -Raw -Encoding UTF8 $cmd) -split [regex]::Escape($m)
$novo = $p[0] + $m + $p[1] + $m + "`r`n" + (Get-Content -Raw -Encoding UTF8 (Join-Path $d "eterna-impressao.ps1"))
[IO.File]::WriteAllText($cmd, ($novo -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding($false)))
Write-Host "preparar-posto-eterna.cmd montado"