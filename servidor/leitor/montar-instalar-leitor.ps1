# Monta o instalar-leitor.cmd: cabeçalho (até o segundo #ETERNA#) + a cópia exata de agente/eterna-leitor.py.
# Rode depois de mudar o eterna-leitor.py (o teste testes/leitor_programa.py confere que a cópia é idêntica).
$d = Split-Path $MyInvocation.MyCommand.Path
$cmd = Join-Path $d "instalar-leitor.cmd"
$py = Join-Path $d "..\..\agente\eterna-leitor.py"
$m = '#' + 'ETERNA' + '#'
$utf8 = New-Object Text.UTF8Encoding($false)
$p = [IO.File]::ReadAllText($cmd, $utf8) -split [regex]::Escape($m)
$cab = ($p[0] + $m + $p[1] + $m + "`n") -replace "`r`n", "`n"
[IO.File]::WriteAllText($cmd, $cab + [IO.File]::ReadAllText($py, $utf8), $utf8)
Write-Host "instalar-leitor.cmd montado"
