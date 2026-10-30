# Eterna · liga o Eterna com o Windows, sem ninguém entrar no usuário dono (tarefa agendada "Eterna", ao iniciar).
# O Eterna roda escondido como o usuário dono da pasta (ex.: eterna), qualquer que seja o usuário na tela: quem usa o
# computador (ex.: o Rafael) abre http://localhost:8765 no próprio Chrome. Substitui o Autologon e o atalho do vigia.
# Rodar UMA vez no PowerShell como administrador; a janela pede a senha do usuário dono (fica guardada no Agendador):
#   powershell -ExecutionPolicy Bypass -File instalar-tarefa.ps1            (dono = eterna)
#   powershell -ExecutionPolicy Bypass -File instalar-tarefa.ps1 -Dono outro
param([string]$Dono = 'eterna')
$ErrorActionPreference = 'Stop'
$vigia = "C:\Users\$Dono\Eterna\programa\eterna-vigia.ps1"
if (-not (Test-Path $vigia)) { throw "Não achei $vigia. Rode antes o instalar-vigia.ps1 no usuário $Dono." }

$cred = Get-Credential -UserName $Dono -Message "Senha do usuário $Dono (o Eterna roda como ele)"
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$vigia`""
$t = New-ScheduledTaskTrigger -AtStartup
# notebook: liga na bateria e não para quando a tomada cai; sem limite de tempo; se o vigia morrer, a tarefa religa
$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'Eterna' -Action $a -Trigger $t -Settings $s -User $Dono -Password $cred.GetNetworkCredential().Password -RunLevel Limited -Force | Out-Null

# o atalho da pasta Inicializar do dono abriria um segundo vigia se alguém entrar nele
$atalho = "C:\Users\$Dono\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Eterna vigia.cmd"
if (Test-Path $atalho) { Rename-Item $atalho ($atalho + '.desligado') -Force; Write-Host 'Atalho do vigia na pasta Inicializar desligado (a tarefa assume).' }

Write-Host "Tarefa 'Eterna' criada: liga com o Windows como $Dono, sem ninguém entrar nesse usuário."
Write-Host 'Teste: reinicie o computador, entre no seu usuário e abra http://localhost:8765 (até 2 minutos).'
