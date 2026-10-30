# Eterna · liga o Eterna com o Windows, sem ninguém entrar no usuário dono (tarefa agendada "Eterna", ao iniciar).
# O Eterna roda escondido como o usuário dono da pasta (ex.: eterna), qualquer que seja o usuário na tela: quem usa o
# computador (ex.: o Rafael) abre http://localhost:8765 no próprio Chrome. Substitui o Autologon e o atalho do vigia.
# Rodar UMA vez no PowerShell como administrador; a janela pede a senha do usuário dono (fica guardada no Agendador):
#   powershell -ExecutionPolicy Bypass -File instalar-tarefa.ps1            (dono = eterna)
#   powershell -ExecutionPolicy Bypass -File instalar-tarefa.ps1 -Dono outro
#   powershell -ExecutionPolicy Bypass -File instalar-tarefa.ps1 -SoAtalho   (tarefa já criada: só o atalho e a permissão)
# Também põe na área de trabalho de quem rodou o atalho "Eterna", que liga a tarefa (se não estiver rodando) e abre o app.
param([string]$Dono = 'eterna', [switch]$SoAtalho)
$ErrorActionPreference = 'Stop'
$vigia = "C:\Users\$Dono\Eterna\programa\eterna-vigia.ps1"
if (-not (Test-Path $vigia)) { throw "Não achei $vigia. Rode antes o instalar-vigia.ps1 no usuário $Dono." }

if (-not $SoAtalho) {
$cred = Get-Credential -UserName $Dono -Message "Senha do usuário $Dono (o Eterna roda como ele)"
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$vigia`""
$t = New-ScheduledTaskTrigger -AtStartup
# notebook: liga na bateria e não para quando a tomada cai; sem limite de tempo; se o vigia morrer, a tarefa religa
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Eterna' -Action $a -Trigger $t -Settings $s -User $Dono -Password $cred.GetNetworkCredential().Password -RunLevel Limited -Force | Out-Null

# o atalho da pasta Inicializar do dono abriria um segundo vigia se alguém entrar nele
$atalho = "C:\Users\$Dono\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Eterna vigia.cmd"
if (Test-Path $atalho) { Rename-Item $atalho ($atalho + '.desligado') -Force; Write-Host 'Atalho do vigia na pasta Inicializar desligado (a tarefa assume).' }

}

# qualquer usuário do computador pode LIGAR a tarefa (ler e executar; não muda nem apaga): é o que o atalho faz
$svc = New-Object -ComObject Schedule.Service; $svc.Connect()
$tarefa = $svc.GetFolder('\').GetTask('Eterna')
$sd = $tarefa.GetSecurityDescriptor(0xF)
if ($sd -notmatch '\(A;;GRGX;;;AU\)') { $tarefa.SetSecurityDescriptor($sd + '(A;;GRGX;;;AU)', 0) }

$mesa = [Environment]::GetFolderPath('Desktop')
$lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $mesa 'Eterna.lnk'))
$lnk.TargetPath = "$env:SystemRoot\System32\cmd.exe"
$lnk.Arguments = '/c schtasks /run /tn Eterna >nul 2>&1 & timeout /t 3 >nul & start "" http://localhost:8765'
$lnk.WindowStyle = 7
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { $lnk.IconLocation = "$chrome,0" }
$lnk.Save()
Write-Host "Atalho 'Eterna' na área de trabalho: liga o Eterna (se estiver parado) e abre o app."

if (-not $SoAtalho) { Write-Host "Tarefa 'Eterna' criada: liga com o Windows como $Dono, sem ninguém entrar nesse usuário."
Write-Host 'Teste: reinicie o computador, entre no seu usuário e abra http://localhost:8765 (até 2 minutos).' }
