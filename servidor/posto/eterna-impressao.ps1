# Eterna: impressão direta na DNP deste posto, sem a prévia do Chrome.
#
# Roda escondido no posto (atalho na inicialização do Windows, criado pelo preparar-posto-eterna.cmd).
# Escuta só em 127.0.0.1:8790; o Posto de venda manda as fotos já montadas (JPEG) e este script imprime
# na impressora padrão (a DNP) por um Chrome escondido, igual à impressão do Eterna. Só aceita pedidos do endereço do Eterna (ORIGENS).
# Se este script não estiver rodando, o Eterna imprime pelo Chrome (--kiosk-printing), como antes.
#   GET  /status    -> {ok, impressora}
#   POST /imprimir  {venda, imagens: ["data:image/jpeg;base64,..."]} -> {ok, fotos, impressora}
# Log: C:\Eterna\impressao.log

param([Parameter(Mandatory = $true)][string]$Endereco)   # endereço do Eterna neste ponto; só ele pode mandar imprimir

$Porta = 8790
$Origens = @($Endereco.TrimEnd("/"))
$Log = "C:\Eterna\impressao.log"
$MaxCorpo = 80MB
$MaxFotos = 20

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web.Extensions

# Quem imprime é um Chrome só deste programa (perfil C:\Eterna\chrome-impressao), aberto fora da tela com --kiosk-printing:
# a foto sai igual à impressão pelo Chrome do Eterna (mesmo motor e mesma correção de cor) e a prévia acontece fora da vista.
# Imprimir direto pelo System.Drawing saía pálido na DNP (10/11), por isso não é usado.
$Chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") |
    Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$Perfil = "C:\Eterna\chrome-impressao"
$Trabalho = "C:\Eterna\impressao"

function Anota($t) {
    try { Add-Content -Path $Log -Value ("[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $t) -Encoding UTF8 } catch {}
}

function Padrao { (New-Object System.Drawing.Printing.PrinterSettings).PrinterName }

# $fotos: lista de @{ bytes = JPEG; deitada = $true/$false }. Mesma página de impressão do index.html (#print-root).
function Imprime($fotos) {
    if (-not $Chrome) { throw "Chrome não encontrado" }
    $dir = Join-Path $Trabalho ([guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force $dir | Out-Null
    try {
        $pgs = ""
        for ($i = 0; $i -lt $fotos.Count; $i++) {
            [IO.File]::WriteAllBytes((Join-Path $dir "f$i.jpg"), $fotos[$i].bytes)
            $pgs += '<div class="pg' + $(if ($fotos[$i].deitada) { " land" } else { "" }) + '"><div class="box"><img src="f' + $i + '.jpg"></div></div>'
        }
        $html = '<!doctype html><meta charset="utf-8"><style>@page{margin:0}html,body{margin:0;padding:0;background:#fff}' +
            '.pg{width:100vw;height:100vh;position:relative;overflow:hidden;break-after:page;page-break-after:always}.pg:last-child{break-after:auto;page-break-after:auto}' +
            '.box{position:absolute;left:0;top:0;width:100vw;height:100vh;overflow:hidden}.pg.land .box{width:100vh;height:100vw;left:50%;top:50%;transform:translate(-50%,-50%) rotate(90deg)}' +
            'img{display:block;width:100%;height:100%;object-fit:cover}</style>' + $pgs +
            '<script>var n=0,ims=document.images;function vai(){window.addEventListener("afterprint",function(){setTimeout(function(){window.close()},300)});window.print();}' +
            'for(var k=0;k<ims.length;k++){if(ims[k].complete)n++;else ims[k].onload=ims[k].onerror=function(){if(++n===ims.length)vai()}}if(n===ims.length)vai();</script>'
        [IO.File]::WriteAllText((Join-Path $dir "imprimir.html"), $html, (New-Object Text.UTF8Encoding($false)))
        $url = "file:///" + ((Join-Path $dir "imprimir.html") -replace "\\", "/")
        $arg = "--user-data-dir=`"$Perfil`" --kiosk-printing --no-first-run --no-default-browser-check --disable-extensions --allow-file-access-from-files " +
            "--window-position=-32000,-32000 --window-size=500,400 `"$url`""
        $p = Start-Process $Chrome -ArgumentList $arg -PassThru
        if (-not $p.WaitForExit(90000)) { Anota "Chrome da impressão não fechou em 90 s" }
        Start-Sleep -Milliseconds 500
    } finally {
        Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
function Responde($st, $cod, $corpo, $origem, $cors) {
    $nomes = @{ 200 = "OK"; 204 = "No Content"; 400 = "Bad Request"; 403 = "Forbidden"; 404 = "Not Found"; 413 = "Payload Too Large"; 500 = "Internal Server Error" }
    $b = [Text.Encoding]::UTF8.GetBytes([string]$corpo)
    $hd = "HTTP/1.1 $cod $($nomes[$cod])`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($b.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n"
    if ($cors) {
        $hd += "Access-Control-Allow-Origin: $origem`r`nVary: Origin`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nAccess-Control-Allow-Headers: Content-Type`r`n"
        $hd += "Access-Control-Allow-Private-Network: true`r`nAccess-Control-Allow-Local-Network: true`r`n"
    }
    $hb = [Text.Encoding]::ASCII.GetBytes($hd + "`r`n")
    $st.Write($hb, 0, $hb.Length)
    if ($b.Length) { $st.Write($b, 0, $b.Length) }
    $st.Flush()
}

function Atende($c) {
    $c.ReceiveTimeout = 30000
    $c.SendTimeout = 30000
    $st = $c.GetStream()
    $buf = New-Object byte[] 65536
    $ms = New-Object System.IO.MemoryStream
    $fim = -1
    while ($fim -lt 0) {
        $n = $st.Read($buf, 0, $buf.Length)
        if ($n -le 0) { return }
        $ms.Write($buf, 0, $n)
        $txt = [Text.Encoding]::ASCII.GetString($ms.ToArray())
        $fim = $txt.IndexOf("`r`n`r`n")
        if ($fim -lt 0 -and $ms.Length -gt 65536) { return }
    }
    $linhas = $txt.Substring(0, $fim) -split "`r`n"
    $partes = $linhas[0] -split " "
    $metodo = $partes[0]
    $caminho = $partes[1]
    $h = @{}
    foreach ($ln in $linhas[1..($linhas.Count - 1)]) { $kv = $ln -split ":\s*", 2; if ($kv.Count -eq 2) { $h[$kv[0].ToLower()] = $kv[1] } }
    $origem = [string]$h["origin"]
    $cors = $origem -and ($Origens -contains $origem.TrimEnd("/"))
    $tam = 0
    [void][int]::TryParse([string]$h["content-length"], [ref]$tam)
    if ($tam -gt $MaxCorpo) { Responde $st 413 '{"ok":false,"erro":"grande"}' $origem $cors; return }
    if ($metodo -eq "OPTIONS") { Responde $st 204 "" $origem $cors; return }
    if (-not $cors) { Responde $st 403 '{"ok":false,"erro":"origem"}' $origem $false; return }
    if ($metodo -eq "GET" -and $caminho -like "/status*") {
        Responde $st 200 ('{"ok":true,"impressora":' + (ConvertTo-Json ([string](Padrao))) + '}') $origem $cors
        return
    }
    if ($metodo -ne "POST" -or $caminho -ne "/imprimir") { Responde $st 404 '{"ok":false,"erro":"rota"}' $origem $cors; return }
    $todo = $ms.ToArray()
    $corpo = New-Object System.IO.MemoryStream
    $corpo.Write($todo, $fim + 4, $todo.Length - $fim - 4)
    while ($corpo.Length -lt $tam) {
        $n = $st.Read($buf, 0, $buf.Length)
        if ($n -le 0) { break }
        $corpo.Write($buf, 0, $n)
    }
    $imgs = @()
    try {
        $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $ser.MaxJsonLength = [int]::MaxValue
        $j = $ser.DeserializeObject([Text.Encoding]::UTF8.GetString($corpo.ToArray()))
        foreach ($d in @($j["imagens"])) {
            $d = [string]$d
            if ($d -notmatch "^data:image/(jpeg|png);base64,") { continue }
            $bytes = [Convert]::FromBase64String($d.Substring($d.IndexOf(",") + 1))
            $im = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, $bytes)))   # só para validar o JPEG e ler a orientação
            $imgs += @{ bytes = $bytes; deitada = ($im.Width -gt $im.Height) }
            $im.Dispose()
        }
        if (-not $imgs.Count -or $imgs.Count -gt $MaxFotos) { Responde $st 400 '{"ok":false,"erro":"fotos"}' $origem $cors; return }
        $imp = [string](Padrao)
        Imprime $imgs
        Anota ("venda {0}: {1} foto(s) em {2}" -f $j["venda"], $imgs.Count, $imp)
        Responde $st 200 ('{"ok":true,"fotos":' + $imgs.Count + ',"impressora":' + (ConvertTo-Json $imp) + '}') $origem $cors
    } catch {
        Anota ("erro ao imprimir: {0}" -f $_.Exception.Message)
        Responde $st 500 ('{"ok":false,"erro":' + (ConvertTo-Json ([string]$_.Exception.Message)) + '}') $origem $cors
    } finally {
        $imgs = $null
    }
}

$l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Porta)
try { $l.Start() } catch { Anota "porta $Porta ocupada: outro ajudante já está rodando"; exit }
Anota ("ligado em 127.0.0.1:{0}, impressora {1}" -f $Porta, (Padrao))
while ($true) {
    $c = $l.AcceptTcpClient()
    try { Atende $c } catch { Anota ("erro: {0}" -f $_.Exception.Message) } finally { $c.Close() }
}
