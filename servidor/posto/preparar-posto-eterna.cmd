@echo off
rem Prepara este computador como posto de venda do Eterna. Duplo clique, uma vez por maquina.
rem Cria o atalho "Eterna" (Area de Trabalho e ao ligar o Windows) e instala o programa de impressao direta na DNP.
rem A ultima parte deste arquivo e uma copia de eterna-impressao.ps1: mudou o .ps1, rode montar-preparar-posto.ps1.
set "ETERNA_CMD=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -Encoding UTF8 $env:ETERNA_CMD) -split ('#'+'ETERNA'+'#'))[1]"
pause
exit /b
#ETERNA#
$Endereco = "http://192.168.10.178:8799"   # servidor do Eterna; mudou o servidor, troque aqui e rode de novo
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $chrome) { Write-Host "Chrome nao encontrado. Instale o Google Chrome e rode de novo."; return }
$pasta = "C:\Eterna"
$perfil = "$pasta\chrome"
New-Item -ItemType Directory -Force $perfil | Out-Null
$argumentos = "--user-data-dir=`"$perfil`" --kiosk-printing --no-first-run --no-default-browser-check"
if ($Endereco -like "http://*") { $argumentos += " --unsafely-treat-insecure-origin-as-secure=$Endereco" }
$argumentos += " $Endereco/#posto"
$w = New-Object -ComObject WScript.Shell
$inicio = [Environment]::GetFolderPath("Startup")
foreach ($l in @((Join-Path ([Environment]::GetFolderPath("Desktop")) "Eterna.lnk"), (Join-Path $inicio "Eterna.lnk"))) {
    $s = $w.CreateShortcut($l); $s.TargetPath = $chrome; $s.Arguments = $argumentos; $s.WorkingDirectory = Split-Path $chrome
    $s.IconLocation = "$chrome,0"; $s.Description = "Eterna - posto de venda"; $s.Save()
    Write-Host "Atalho criado: $l"
}
# programa de impressao direta: a foto vai para a DNP sem a previa do Chrome
$prog = "$pasta\eterna-impressao.ps1"
$partes = (Get-Content -Raw -Encoding UTF8 $env:ETERNA_CMD) -split ('#'+'ETERNA'+'#')
Set-Content -Path $prog -Value $partes[2].Trim() -Encoding UTF8
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$argImp = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$prog`" -Endereco $Endereco"
$s = $w.CreateShortcut((Join-Path $inicio "Eterna impressao.lnk")); $s.TargetPath = $ps; $s.Arguments = $argImp; $s.WindowStyle = 7
$s.Description = "Eterna - impressao direta na DNP"; $s.Save()
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like "*eterna-impressao.ps1*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Process $ps -ArgumentList $argImp -WindowStyle Hidden
Start-Sleep 3
try { $st = Invoke-RestMethod "http://127.0.0.1:8790/status" -Headers @{ Origin = $Endereco } -TimeoutSec 5; Write-Host "Programa de impressao ligado: imprime em $($st.impressora)" }
catch { Write-Host "ATENCAO: o programa de impressao nao respondeu. Veja C:\Eterna\impressao.log" }
$padrao = (Get-CimInstance Win32_Printer -Filter "Default=True" -ErrorAction SilentlyContinue).Name
Write-Host ""
Write-Host "Impressora padrao: $padrao"
if ($padrao -notmatch "DS-RX1|DNP") { Write-Host "ATENCAO: a impressora padrao nao e a DNP. Deixe a DS-RX1 como padrao antes de vender." }
else { Write-Host "Tudo certo. Feche todos os Chromes e abra o Eterna pelo atalho da Area de Trabalho." }
#ETERNA#
# Eterna: impressão direta na DNP deste posto, sem a prévia do Chrome.
#
# Roda escondido no posto (atalho na inicialização do Windows, criado pelo preparar-posto-eterna.cmd).
# Escuta só em 127.0.0.1:8790; o Posto de venda manda as fotos já montadas (JPEG) e este script imprime
# na impressora padrão (a DNP) por um Chrome escondido, igual à impressão do Eterna. Só aceita pedidos do endereço do Eterna (ORIGENS).
# Se este script não estiver rodando, o Eterna imprime pelo Chrome (--kiosk-printing), como antes.
#   GET  /status    -> {ok, impressora, dnp}
#   POST /imprimir  {venda, imagens: ["data:image/jpeg;base64,..."]} -> {ok, fotos, impressora, dnp}
# dnp (null quando não há DNP DS-RX1 no USB): {status, texto, erro, mqty, restantes, vida, antes, saiu, conferido}
#   lido do firmware da DNP pelo USB (comandos de leitura "ESC P": STATUS, INFO MQTY, MNT_RD COUNTER_LIFE), só com a fila
#   do Windows vazia, para nunca misturar com os dados de uma impressão. restantes = MQTY - 50 (margem que a DNP soma ao rolo).
# Log: C:\Eterna\impressao.log

param([Parameter(Mandatory = $true)][string]$Endereco)   # endereço do Eterna neste ponto; só ele pode mandar imprimir

$Porta = 8790
$Origens = @($Endereco.TrimEnd("/"))
$Log = "C:\Eterna\impressao.log"
$MaxCorpo = 80MB
$MaxFotos = 20

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Web.Extensions

# DNP pelo USB: a interface usbprint da impressora (fabricante 1343) aceita comandos de 32 bytes "ESC P" + comando (6) + argumento (16)
# + 8 espaços e responde com 8 dígitos de tamanho seguidos dos dados. Só comandos de leitura são usados aqui.
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Text;using System.Runtime.InteropServices;using Microsoft.Win32.SafeHandles;
public static class EternaDnp{
 [StructLayout(LayoutKind.Sequential)] struct SPDID{public int cb;public Guid g;public int f;public IntPtr r;}
 [DllImport("setupapi.dll",SetLastError=true)] static extern IntPtr SetupDiGetClassDevs(ref Guid g,IntPtr e,IntPtr h,int f);
 [DllImport("setupapi.dll",SetLastError=true)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr s,IntPtr d,ref Guid g,int i,ref SPDID x);
 [DllImport("setupapi.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr s,ref SPDID x,IntPtr b,int n,out int req,IntPtr di);
 [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr s);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool CancelIoEx(SafeFileHandle h,IntPtr o);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)] static extern SafeFileHandle CreateFile(string n,uint a,uint s,IntPtr sa,uint c,uint f,IntPtr t);
 public static string Caminho(){var g=new Guid("28d78fad-5a12-11d1-ae5b-0000f803a8c2");IntPtr s=SetupDiGetClassDevs(ref g,IntPtr.Zero,IntPtr.Zero,0x12);string achou=null;
  for(int i=0;achou==null;i++){var x=new SPDID();x.cb=Marshal.SizeOf(x);if(!SetupDiEnumDeviceInterfaces(s,IntPtr.Zero,ref g,i,ref x))break;
   int req;SetupDiGetDeviceInterfaceDetail(s,ref x,IntPtr.Zero,0,out req,IntPtr.Zero);IntPtr b=Marshal.AllocHGlobal(req);
   Marshal.WriteInt32(b,IntPtr.Size==8?8:6);if(SetupDiGetDeviceInterfaceDetail(s,ref x,b,req,out req,IntPtr.Zero)){string p=Marshal.PtrToStringUni(new IntPtr(b.ToInt64()+4));if(p.ToLower().Contains("vid_1343"))achou=p;}
   Marshal.FreeHGlobal(b);}
  SetupDiDestroyDeviceInfoList(s);return achou;}
 public static string Cmd(string path,string c1,string c2){
  var h=CreateFile(path,0xC0000000,3,IntPtr.Zero,3,0x40000000,IntPtr.Zero);if(h.IsInvalid)return null;
  using(var fs=new FileStream(h,FileAccess.ReadWrite,4096,true)){
   var cmd=new byte[32];for(int i=0;i<32;i++)cmd[i]=0x20;cmd[0]=0x1b;cmd[1]=0x50;
   Encoding.ASCII.GetBytes(c1).CopyTo(cmd,2);Encoding.ASCII.GetBytes(c2).CopyTo(cmd,8);fs.Write(cmd,0,32);fs.Flush();
   var cab=Le(fs,8);if(cab==null)return null;int n;if(!int.TryParse(Encoding.ASCII.GetString(cab),out n)||n<0||n>4096)return null;
   var d=Le(fs,n);return d==null?null:Encoding.ASCII.GetString(d);}}
 static byte[] Le(FileStream fs,int n){var r=new byte[n];int t=0;while(t<n){var ar=fs.BeginRead(r,t,n-t,null,null);if(!ar.AsyncWaitHandle.WaitOne(3000)){CancelIoEx(fs.SafeFileHandle,IntPtr.Zero);try{fs.EndRead(ar);}catch{}return null;}int k=fs.EndRead(ar);if(k<=0)return null;t+=k;}return r;}
}
'@
$DnpMargem = 50
$DnpTextos = @{ 0 = "pronta"; 1 = "imprimindo"; 500 = "esfriando a cabeça"; 510 = "esfriando o motor"; 900 = "em espera"; 1000 = "tampa aberta"; 1010 = "sem a caixa de aparas";
    1100 = "o papel acabou"; 1200 = "a fita acabou"; 1300 = "papel enroscado"; 1400 = "erro na fita"; 1500 = "papel diferente do configurado"; 1600 = "erro nos dados" }

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

# fila do Windows da impressora padrão vazia (nada sendo enviado pelo USB): só então o programa conversa com a DNP
function FilaVazia { try { return -not @(Get-PrintJob -PrinterName (Padrao) -ErrorAction Stop).Count } catch { return $true } }

# lê a DNP: $null sem DNP no USB ou sem resposta; senão @{status; texto; erro; mqty; restantes; vida}
function DnpLer {
    try {
        $c = [EternaDnp]::Caminho(); if (-not $c) { return $null }
        $st = [EternaDnp]::Cmd($c, "STATUS", ""); $mq = [EternaDnp]::Cmd($c, "INFO", "MQTY"); $vd = [EternaDnp]::Cmd($c, "MNT_RD", "COUNTER_LIFE")
    } catch { return $null }
    if ($null -eq $st -or $mq -notmatch '^MQTY(\d+)') { return $null }
    $mqty = [int]$Matches[1]; $cod = 0; [void][int]::TryParse($st.Trim(), [ref]$cod)
    $vida = $null; if ($vd -match '^CL(\d+)') { $vida = [int]$Matches[1] }
    $tx = $DnpTextos[$cod]; if (-not $tx) { $tx = "código $cod" }
    return @{ status = $cod; texto = $tx; erro = ($cod -ge 1000); mqty = $mqty; restantes = [Math]::Max(0, $mqty - $DnpMargem); vida = $vida }
}
function DnpJson($d) { if (-not $d) { return "null" }; return (ConvertTo-Json $d -Compress) }

# $fotos: lista de @{ bytes = JPEG; deitada = $true/$false }. Mesma página de impressão do index.html (#print-root).
function Imprime($fotos) {
    if (-not $Chrome) { throw "Chrome não encontrado" }
    $antes = $null; if (FilaVazia) { $antes = DnpLer }
    if ($antes -and $antes.erro) { throw ("A DNP avisa: " + $antes.texto) }
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
        if (-not $antes) { return $null }
        # conferência pela DNP: a fila esvazia (o Windows entregou tudo), depois a DNP termina e o MQTY desce
        $fim = (Get-Date).AddSeconds(60 + 25 * $fotos.Count); $d = $null
        while ((Get-Date) -lt $fim) {
            Start-Sleep -Milliseconds 1500
            if (-not (FilaVazia)) { continue }
            $d = DnpLer; if (-not $d) { continue }
            if ($d.erro) { break }
            if (($antes.mqty - $d.mqty) -ge $fotos.Count -and ($d.status -eq 0 -or $d.status -eq 900)) { break }
        }
        if (-not $d) { return @{ antes = $antes.mqty; vida_antes = $antes.vida; saiu = $null; conferido = $false; erro = $false; texto = "sem resposta da DNP" } }
        $d.antes = $antes.mqty; $d.vida_antes = $antes.vida; $d.saiu = $antes.mqty - $d.mqty; $d.conferido = ($d.saiu -ge $fotos.Count -and -not $d.erro)
        return $d
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
        $dn = $null; if (FilaVazia) { $dn = DnpLer }
        Responde $st 200 ('{"ok":true,"impressora":' + (ConvertTo-Json ([string](Padrao))) + ',"dnp":' + (DnpJson $dn) + '}') $origem $cors
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
        $dn = Imprime $imgs
        $ext = ""; if ($dn) { $ext = " | DNP: contador {0} -> {1}, saiu {2}, restam {3}, vida {4}, {5}" -f $dn.antes, $dn.mqty, $dn.saiu, $dn.restantes, $dn.vida, $dn.texto }
        Anota ("venda {0}: {1} foto(s) em {2}{3}" -f $j["venda"], $imgs.Count, $imp, $ext)
        Responde $st 200 ('{"ok":true,"fotos":' + $imgs.Count + ',"impressora":' + (ConvertTo-Json $imp) + ',"dnp":' + (DnpJson $dn) + '}') $origem $cors
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
