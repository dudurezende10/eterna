@echo off
rem Eterna - instala o leitor de cartao do gramado neste computador Windows. Uma vez por computador, como administrador
rem (botao direito > Executar como administrador). Pede o codigo de ativacao: Eterna > Painel de controle > Avancado >
rem Leitores de cartao > Cadastrar leitor (ou Novo codigo). O leitor roda com o usuario conectado na tela; outro usuario:
rem   instalar-leitor.cmd -Usuario gramado
rem Passo a passo: docs/SERVIDOR-ESTADIO.md, secao "Leitor de cartao do gramado".
rem A ultima parte deste arquivo e uma copia exata de agente/eterna-leitor.py: mudou o .py, rode servidor/leitor/montar-instalar-leitor.ps1.
set "ETERNA_CMD=%~f0"
set "ETERNA_USUARIO="
if /i "%~1"=="-Usuario" set "ETERNA_USUARIO=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -Encoding UTF8 $env:ETERNA_CMD) -split ('#'+'ETERNA'+'#'))[1]"
pause
exit /b
#ETERNA#
$ErrorActionPreference = 'Continue'      # cada passo confere o resultado (Python e icacls escrevem no stderr)
$Servidor = "https://posto.eterna.photo"   # servidor do Eterna no estadio; o leitor conecta direto no IP abaixo e confere o certificado pelo nome
$Ip = "192.168.10.10"
$Destino = "$env:ProgramFiles\Eterna Leitor"           # programa: escrita so de administrador (o usuario do gramado nao troca o codigo)
$Dados = "$env:ProgramData\Eterna\leitor"              # token, fila e log: so o usuario do leitor, Administradores e SYSTEM
$eu = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Rode como administrador: botao direito em instalar-leitor.cmd > Executar como administrador."; return }

# 1. usuario que vai rodar o leitor (quem esta na tela, ou -Usuario)
$Usuario = $env:ETERNA_USUARIO
if (-not $Usuario) { $Usuario = (Get-CimInstance Win32_ComputerSystem).UserName }
if (-not $Usuario) { Write-Host "Ninguem conectado na tela. Rode de novo com: instalar-leitor.cmd -Usuario <usuario do gramado>"; return }
if ($Usuario -notlike "*\*") { $Usuario = "$env:COMPUTERNAME\$Usuario" }
Write-Host "O leitor vai rodar com o usuario $Usuario."

# 2. Python 3.10 ou mais novo, instalado para todos (em Arquivos de Programas)
function Acha-Python {
    foreach ($v in @("314", "313", "312", "311", "310")) {
        $c = "$env:ProgramFiles\Python$v\python.exe"
        if (Test-Path $c) { return $c }
    }
    return $null
}
$py = Acha-Python
if (-not $py) {
    Write-Host "Instalando o Python 3.12 (python.org) para todos os usuarios..."
    try { winget install -e --id Python.Python.3.12 --scope machine --silent --accept-package-agreements --accept-source-agreements | Out-Host } catch { }
    $py = Acha-Python
}
if (-not $py) {
    Write-Host "Nao consegui instalar o Python. Sem internet: baixe o instalador do Python 3.12 (64 bits) em python.org em outro computador,"
    Write-Host "traga num pendrive, rode como administrador marcando 'Install for all users' e 'tcl/tk', e rode este instalador de novo."
    return }
$pyw = Join-Path (Split-Path $py) "pythonw.exe"
& $py -I -c "import tkinter" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "ATENCAO: este Python nao tem a janela (tcl/tk). O leitor funciona, mas sem a janela de aviso." }

# 3. o programa (copia embutida no fim deste arquivo)
New-Item -ItemType Directory -Force $Destino | Out-Null
$partes = (Get-Content -Raw -Encoding UTF8 $env:ETERNA_CMD) -split ('#'+'ETERNA'+'#')
$codigo_py = $partes[2] -replace "^\r?\n", ""
[IO.File]::WriteAllText("$Destino\eterna-leitor.py", $codigo_py, (New-Object Text.UTF8Encoding($false)))
Write-Host "Programa copiado para $Destino"

# 4. pasta de dados so do usuario do leitor, Administradores e SYSTEM
New-Item -ItemType Directory -Force $Dados | Out-Null
icacls $Dados /reset /T | Out-Null                          # pasta que ja existia: volta ao padrao antes de ajustar
if ($LASTEXITCODE -ne 0) { Write-Host "Nao consegui reiniciar a permissao de $Dados. Apague a pasta e rode de novo."; return }
icacls $Dados /setowner "*S-1-5-32-544" /T | Out-Null      # dono da pasta: Administradores (o usuario do gramado nao muda a permissao)
if ($LASTEXITCODE -ne 0) { Write-Host "Nao consegui passar $Dados para os Administradores. Apague a pasta e rode de novo."; return }
icacls $Dados /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "${Usuario}:(OI)(CI)M" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "Nao consegui ajustar a permissao de $Dados para $Usuario."; return }
$dono = (Get-Acl $Dados).GetOwner([Security.Principal.SecurityIdentifier]).Value
if ($dono -ne "S-1-5-32-544" -and $dono -ne "S-1-5-18") { Write-Host "A pasta $Dados nao ficou com os Administradores. Apague a pasta e rode de novo."; return }

# 5. ativacao: o codigo vale 10 minutos e uma vez so; o token fica so em $Dados\leitor.json
Get-ScheduledTask -TaskName 'Eterna leitor' -ErrorAction SilentlyContinue | Stop-ScheduledTask -ErrorAction SilentlyContinue
$codigo = Read-Host "Codigo de ativacao do Eterna (Painel de controle > Avancado > Leitores de cartao)"
& $py -I "$Destino\eterna-leitor.py" --ativar $codigo --servidor $Servidor --ip $Ip
if ($LASTEXITCODE -ne 0) { Write-Host "A ativacao nao deu certo. Gere um Novo codigo no Eterna e rode de novo."; return }
& $py -I "$Destino\eterna-leitor.py" --testar

# 6. tarefa agendada: liga quando o usuario entra no Windows (logon automatico), sem administrador; religa em 1 minuto se cair
$acao = New-ScheduledTaskAction -Execute $pyw -Argument "-I `"$Destino\eterna-leitor.py`"" -WorkingDirectory $Destino
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $Usuario
$conf = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$quem = New-ScheduledTaskPrincipal -UserId $Usuario -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Eterna leitor' -Action $acao -Trigger $gatilho -Settings $conf -Principal $quem -Force | Out-Null
Write-Host "Tarefa 'Eterna leitor' criada: liga quando $Usuario entra no Windows."

# 7. Reproducao Automatica desligada (o Windows nao oferece importar e apagar as fotos do cartao)
$pol = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"
New-Item -Path $pol -Force | Out-Null
Set-ItemProperty -Path $pol -Name NoDriveTypeAutoRun -Value 255 -Type DWord
Set-ItemProperty -Path $pol -Name NoAutorun -Value 1 -Type DWord
Write-Host "Reproducao Automatica desligada para todas as unidades."
# 8. indexacao do Windows fora das unidades removiveis (o cartao nao entra no indice de pesquisa)
$busca = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search"
New-Item -Path $busca -Force | Out-Null
Set-ItemProperty -Path $busca -Name DisableRemovableDriveIndexing -Value 1 -Type DWord
Write-Host "Indexacao de unidades removiveis desligada."

$logado = (Get-CimInstance Win32_ComputerSystem).UserName
if ($logado -and $logado -ieq $Usuario) { Start-ScheduledTask -TaskName 'Eterna leitor'; Write-Host "Leitor ligado. Teste com um cartao." }
else { Write-Host "O leitor liga quando $Usuario entrar no Windows. Configure o logon automatico desse usuario." }
#ETERNA#
#!/usr/bin/env python3
"""Eterna · leitor de cartão do gramado (18/11, plano docs/planos/2026-11-18-leitor-cartao-gramado.md).

O fotógrafo põe o cartão da câmera no computador do gramado. O leitor pergunta ao servidor do estádio quais fotos já chegaram
(Wi-Fi, 5G, FTP), copia só as que faltam para uma fila neste computador e avisa "Pode tirar o cartão". A fila sobe sozinha para o
servidor, uma foto por vez por conexão, e cada foto confirmada sai da fila. Rede caída: nada se perde e nada é enviado duas vezes.

Só biblioteca padrão do Python. Alvo: Windows (instalado pelo servidor/leitor/instalar-leitor.cmd, tarefa agendada com pythonw).
No Mac: python3 agente/eterna-leitor.py --sem-janela.

Regras:
- O cartão só é aberto para leitura: nunca é escrito, renomeado ou apagado.
- Só fala com um servidor: https://posto.eterna.photo, conectando direto no IP privado fixo (192.168.10.10), com o certificado
  conferido pelo nome. IP público ou servidor sem https: o leitor não abre.
- O token do aparelho fica só em leitor.json (pasta de dados com permissão só do usuário, Administradores e SYSTEM) e nunca vai
  para tela, log ou console.

Comandos:
  eterna-leitor.py --ativar CODIGO [--servidor https://posto.eterna.photo] [--ip 192.168.10.10]
  eterna-leitor.py --testar        manda um pulso e diz o resultado em palavras
  eterna-leitor.py --apagar-fila   apaga as fotos guardadas neste computador (pede confirmação)
  eterna-leitor.py [--sem-janela]  roda (com a janela, ou escrevendo no console)
"""
import argparse
import hashlib
import http.client
import ipaddress
import json
import locale
import logging
import logging.handlers
import os
import random
import re
import shutil
import socket
import sqlite3
import ssl
import sys
import threading
import time
import urllib.parse

VERSAO = "2026-11-18"
UA = "eterna-leitor/" + VERSAO
SERVIDOR_PADRAO = "https://posto.eterna.photo"
IP_PADRAO = "192.168.10.10"
EXT = (".jpg", ".jpeg", ".JPG", ".JPEG")                 # o mesmo do agente (scan_card)
FOTO_MAX = 60 * 1024 * 1024                              # FOTO_ENVIO_MAX do agente: acima disso o servidor recusa (413)
TEM_LOTE = 500
PARALELO = 2
PULSO_S = 30
PULSO_MIN_S = 11                                         # o servidor aceita 6 pulsos por minuto
GUARDA_DIAS = 30                                         # linhas "enviada" ficam (só o hash) para não reenviar
REVOGADO_DIAS = 7                                        # leitor desativado no Eterna: a fila deste computador é apagada depois disto
TRAVA_PORTA = 8766
ROTULO_RE = re.compile(r"^[A-Za-z0-9 _-]{1,32}$")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def teste():
    return os.environ.get("ETERNA_LEITOR_TESTE") == "1"


def _env_teste(nome):
    """Variável que só vale nos testes automáticos (ETERNA_LEITOR_TESTE=1)."""
    return os.environ.get(nome) if teste() else None


# ---------------------------------------------------------------- textos ------
TXT = {
    "coloque": ["Coloque o cartão", "Insert the card", "Inserte la tarjeta", "Insérez la carte", "Karte einstecken"],
    "lendo": ["Lendo o cartão…", "Reading the card…", "Leyendo la tarjeta…", "Lecture de la carte…", "Karte wird gelesen…"],
    "lendo_sub": ["%d de %d fotos", "%d of %d photos", "%d de %d fotos", "%d sur %d photos", "%d von %d Fotos"],
    "pronto": ["Pode tirar o cartão", "You can remove the card", "Puede retirar la tarjeta", "Vous pouvez retirer la carte", "Karte kann entnommen werden"],
    "pronto_sub": ["%d fotos novas guardadas, enviando", "%d new photos saved, sending", "%d fotos nuevas guardadas, enviando",
                   "%d nouvelles photos enregistrées, envoi en cours", "%d neue Fotos gespeichert, werden gesendet"],
    "pronto_nada": ["Todas as fotos já estavam no servidor", "All photos were already on the server", "Todas las fotos ya estaban en el servidor",
                    "Toutes les photos étaient déjà sur le serveur", "Alle Fotos waren schon auf dem Server"],
    "sem_conexao": ["Sem conexão: as fotos ficam guardadas aqui", "No connection: the photos are kept here", "Sin conexión: las fotos quedan guardadas aquí",
                    "Pas de connexion : les photos restent ici", "Keine Verbindung: Die Fotos bleiben hier gespeichert"],
    "esperando": ["%d fotos esperando para subir", "%d photos waiting to upload", "%d fotos esperando para subir",
                  "%d photos en attente d'envoi", "%d Fotos warten auf das Hochladen"],
    "enviando": ["Enviando %d fotos ao servidor", "Sending %d photos to the server", "Enviando %d fotos al servidor",
                 "Envoi de %d photos au serveur", "%d Fotos werden an den Server gesendet"],
    "tudo_enviado": ["Tudo enviado ao servidor", "Everything sent to the server", "Todo enviado al servidor", "Tout est envoyé au serveur", "Alles an den Server gesendet"],
    "nao_tire": ["Não tire o cartão", "Do not remove the card", "No retire la tarjeta", "Ne retirez pas la carte", "Karte nicht entnehmen"],
    "disco_sub": ["Este computador está sem espaço. Chame a TI.", "This computer is out of space. Call IT.", "Esta computadora no tiene espacio. Llame a TI.",
                  "Cet ordinateur n'a plus d'espace. Appelez l'informatique.", "Dieser Computer hat keinen Speicherplatz mehr. Rufen Sie die IT."],
    "recoloque": ["Coloque o cartão de novo", "Insert the card again", "Inserte la tarjeta de nuevo", "Insérez à nouveau la carte", "Karte erneut einstecken"],
    "recoloque_sub": ["O cartão saiu antes do fim da leitura", "The card was removed before reading finished", "La tarjeta salió antes de terminar la lectura",
                      "La carte a été retirée avant la fin de la lecture", "Die Karte wurde vor dem Ende des Lesens entnommen"],
    "desativado": ["Leitor desativado no Eterna", "Reader turned off in Eterna", "Lector desactivado en Eterna", "Lecteur désactivé dans Eterna", "Lesegerät in Eterna deaktiviert"],
    "desativado_sub": ["As fotos ficam guardadas aqui. Chame a TI.", "The photos are kept here. Call IT.", "Las fotos quedan guardadas aquí. Llame a TI.",
                       "Les photos restent ici. Appelez l'informatique.", "Die Fotos bleiben hier. Rufen Sie die IT."],
    "certificado_sub": ["O endereço do servidor não confere. Chame a TI.", "The server address does not match. Call IT.", "La dirección del servidor no coincide. Llame a TI.",
                        "L'adresse du serveur ne correspond pas. Appelez l'informatique.", "Die Serveradresse stimmt nicht. Rufen Sie die IT."],
    "pronto_puladas": ["%d fotos do cartão não abriram. Avise a TI.", "%d photos on the card could not be opened. Tell IT.",
                       "%d fotos de la tarjeta no se abrieron. Avise a TI.", "%d photos de la carte n'ont pas pu être ouvertes. Prévenez l'informatique.",
                       "%d Fotos der Karte ließen sich nicht öffnen. Bitte die IT informieren."],
    "erro_leitura": ["Erro ao ler o cartão", "Error reading the card", "Error al leer la tarjeta", "Erreur de lecture de la carte", "Fehler beim Lesen der Karte"],
    "erro_leitura_sub": ["Não tire o cartão: o leitor tenta de novo. Se continuar, chame a TI.", "Do not remove the card: the reader tries again. If it continues, call IT.",
                         "No retire la tarjeta: el lector lo intenta de nuevo. Si continúa, llame a TI.", "Ne retirez pas la carte : le lecteur réessaie. Si cela continue, appelez l'informatique.",
                         "Karte nicht entnehmen: Das Lesegerät versucht es erneut. Wenn es weitergeht, die IT rufen."],
    "ocupado": ["Servidor ocupado: %d fotos esperando a vez", "Server busy: %d photos waiting their turn", "Servidor ocupado: %d fotos esperando su turno",
                "Serveur occupé : %d photos en attente", "Server ausgelastet: %d Fotos warten"],
    # singular (o t() usa a chave _1 quando o número é 1)
    "pronto_sub_1": ["1 foto nova guardada, enviando", "1 new photo saved, sending", "1 foto nueva guardada, enviando",
                     "1 nouvelle photo enregistrée, envoi en cours", "1 neues Foto gespeichert, wird gesendet"],
    "esperando_1": ["1 foto esperando para subir", "1 photo waiting to upload", "1 foto esperando para subir", "1 photo en attente d'envoi", "1 Foto wartet auf das Hochladen"],
    "enviando_1": ["Enviando 1 foto ao servidor", "Sending 1 photo to the server", "Enviando 1 foto al servidor", "Envoi d'1 photo au serveur", "1 Foto wird an den Server gesendet"],
    "pronto_puladas_1": ["1 foto do cartão não abriu. Avise a TI.", "1 photo on the card could not be opened. Tell IT.", "1 foto de la tarjeta no se abrió. Avise a TI.",
                         "1 photo de la carte n'a pas pu être ouverte. Prévenez l'informatique.", "1 Foto der Karte ließ sich nicht öffnen. Bitte die IT informieren."],
    "ocupado_1": ["Servidor ocupado: 1 foto esperando a vez", "Server busy: 1 photo waiting its turn", "Servidor ocupado: 1 foto esperando su turno",
                  "Serveur occupé : 1 photo en attente", "Server ausgelastet: 1 Foto wartet"],
    "titulo": ["Eterna · leitor de cartão", "Eterna · card reader", "Eterna · lector de tarjetas", "Eterna · lecteur de cartes", "Eterna · Kartenleser"],
}
LINGUAS = ("pt", "en", "es", "fr", "de")
_lingua = [0]


def lingua_escolher():
    """Idioma do Windows (GetUserDefaultUILanguage) ou do sistema; português se não for um dos 5."""
    cod = ""
    if sys.platform.startswith("win"):
        try:
            import ctypes
            prim = ctypes.windll.kernel32.GetUserDefaultUILanguage() & 0x3FF
            cod = {0x16: "pt", 0x09: "en", 0x0A: "es", 0x0C: "fr", 0x07: "de"}.get(prim, "")
        except Exception:
            cod = ""
    if not cod:
        for v in (os.environ.get("LC_ALL"), os.environ.get("LANG"), (locale.getlocale()[0] if hasattr(locale, "getlocale") else None)):
            if v:
                cod = str(v)[:2].lower()
                break
    _lingua[0] = LINGUAS.index(cod) if cod in LINGUAS else 0


def t(k, *a):
    if len(a) == 1 and a[0] == 1 and k + "_1" in TXT:
        return TXT[k + "_1"][_lingua[0]]
    s = TXT[k][_lingua[0]]
    return s % a if a else s


# ---------------------------------------------------------------- pastas ------
def pasta_dados():
    d = _env_teste("ETERNA_LEITOR_DADOS")
    if d:
        return d
    if sys.platform.startswith("win"):
        return os.path.join(os.environ.get("ProgramData") or r"C:\ProgramData", "Eterna", "leitor")
    if sys.platform == "darwin":
        return os.path.expanduser("~/Library/Application Support/Eterna/leitor")
    return os.path.expanduser("~/.eterna-leitor")


DADOS = pasta_dados()
CFG = os.path.join(DADOS, "leitor.json")
FILA = os.path.join(DADOS, "fila")
FILA_DB = os.path.join(DADOS, "fila.db")
ESTADO = os.path.join(DADOS, "estado.json")
REVOGADO = os.path.join(DADOS, "revogado.json")            # quando o Eterna desativou este leitor (401)
LOG_ARQ = os.path.join(DADOS, "leitor.log")
log = logging.getLogger("eterna-leitor")


def preparar_pastas():
    for d in (DADOS, FILA):
        os.makedirs(d, exist_ok=True)
        if not sys.platform.startswith("win"):
            try:
                os.chmod(d, 0o700)
            except OSError:
                pass
    if not log.handlers:
        h = logging.handlers.RotatingFileHandler(LOG_ARQ, maxBytes=1024 * 1024, backupCount=3, encoding="utf-8")
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        log.addHandler(h)
        log.setLevel(logging.INFO)


def grava_privado(arq, texto):
    tmp = arq + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(texto)
    os.replace(tmp, arq)


# ---------------------------------------------------------------- hash --------
def quick_hash(path, size):
    """Cópia exata do quick_hash do agente: o servidor reconhece a foto pelo mesmo número (o teste compara os dois)."""
    h = hashlib.sha256()
    h.update(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(2 * 1024 * 1024))
    return h.hexdigest()


# ---------------------------------------------------------------- configuração
def config_ler():
    try:
        with open(CFG, encoding="utf-8") as f:
            c = json.load(f)
        return c if isinstance(c, dict) else None
    except (OSError, ValueError):
        return None


def config_erro(cfg, com_token=True):
    """None se a configuração serve; senão o motivo em palavras. Só https, só o nome do servidor e só IP privado."""
    try:
        u = urllib.parse.urlsplit(str(cfg.get("servidor") or ""))
        porta = u.port
    except ValueError:
        return "endereço do servidor inválido"
    if u.scheme != "https" or not u.hostname or u.username or u.password or u.path not in ("", "/") or u.query or u.fragment:
        return "o servidor precisa ser https://nome (sem caminho)"
    if porta is not None and not 0 < porta < 65536:
        return "porta do servidor inválida"
    try:
        ip = ipaddress.ip_address(str(cfg.get("ip") or ""))
    except ValueError:
        return "IP do servidor inválido"
    if not ip.is_private or ip.is_unspecified or ip.is_multicast or ip.is_link_local:
        return "o IP do servidor precisa ser da rede interna (ex.: 192.168.10.10)"
    if com_token and not (isinstance(cfg.get("token"), str) and 20 <= len(cfg["token"]) <= 100):
        return "leitor não ativado: rode o instalador com o código do Eterna"
    return None


def num_cfg(cfg, k, padrao):
    try:
        v = float(cfg.get(k, padrao))
        return v if v >= 0 else padrao
    except (TypeError, ValueError):
        return padrao


# ---------------------------------------------------------------- conexão -----
class Conexao(http.client.HTTPSConnection):
    """HTTPS para o nome do servidor, mas o socket vai direto para o IP privado da configuração (sem DNS da internet).
    O certificado é conferido pelo nome (server_hostname), como no navegador."""

    def __init__(self, host, porta, ip, ctx, timeout):
        super().__init__(host, porta, context=ctx, timeout=timeout)
        self._ip = ip

    def connect(self):
        s = socket.create_connection((self._ip, self.port), self.timeout)
        self.sock = self._context.wrap_socket(s, server_hostname=self.host)


def contexto_tls():
    ctx = ssl.create_default_context()
    ca = _env_teste("ETERNA_LEITOR_CA")
    if ca:
        ctx.load_verify_locations(cafile=ca)
    return ctx


class ErroRede(Exception):
    def __init__(self, tipo):
        super().__init__(tipo)
        self.tipo = tipo                 # "rede" ou "certificado"


def pedir(cfg, metodo, caminho, corpo=None, cab=None, timeout=60, token=True):
    """-> (status, json|None). Rede fora ou certificado errado: ErroRede. Nunca manda Origin; sempre X-Eterna e o token."""
    u = urllib.parse.urlsplit(cfg["servidor"])
    h = {"X-Eterna": "1", "User-Agent": UA}
    if token:
        h["Authorization"] = "Bearer " + cfg["token"]
    if isinstance(corpo, (dict, list)):
        corpo = json.dumps(corpo).encode()
        h["Content-Type"] = "application/json"
    h.update(cab or {})
    c = Conexao(u.hostname, u.port or 443, cfg["ip"], contexto_tls(), timeout)
    try:
        try:
            c.request(metodo, caminho, body=corpo, headers=h)
        except (BrokenPipeError, ConnectionResetError):
            pass                         # o servidor pode ter respondido antes do fim do corpo: lê a resposta abaixo
        r = c.getresponse()
        b = r.read(1024 * 1024)
        st = r.status
    except ssl.SSLCertVerificationError:
        raise ErroRede("certificado")
    except (OSError, http.client.HTTPException):
        raise ErroRede("rede")
    finally:
        c.close()
    try:
        j = json.loads(b or b"null")
    except ValueError:
        j = None
    return st, j


# ---------------------------------------------------------------- cartões -----
_k32 = None                    # kernel32 do Windows (os testes trocam por um falso)


def rotulo_limpo(r):
    r = str(r or "").strip()
    return r if ROTULO_RE.match(r) else "cartao"


def win_cartoes(existe=os.path.isdir):
    """Unidades removíveis (GetDriveTypeW == 2) com pasta DCIM. HD externo com DCIM fica de fora (um backup não inunda o servidor)."""
    import ctypes
    k = _k32 or ctypes.windll.kernel32
    out = []
    mascara = k.GetLogicalDrives()
    for i in range(26):
        if not mascara & (1 << i):
            continue
        raiz = chr(65 + i) + ":\\"
        if k.GetDriveTypeW(ctypes.c_wchar_p(raiz)) != 2:
            continue
        if not existe(os.path.join(raiz, "DCIM")):
            continue
        nome = ctypes.create_unicode_buffer(261)
        serie = ctypes.c_uint32(0)
        ok = k.GetVolumeInformationW(ctypes.c_wchar_p(raiz), nome, 261, ctypes.pointer(serie), None, None, None, 0)
        out.append({"raiz": raiz, "rotulo": rotulo_limpo(nome.value if ok else ""), "serial": "%08X" % serie.value if ok else ""})
    return out


def cartoes():
    """Cartões com DCIM agora. Windows: só unidade removível. Mac: /Volumes/*. Nos testes: ETERNA_LEITOR_VOLUMES (pastas-mãe)."""
    if _env_teste("ETERNA_LEITOR_VOLUMES"):
        maes = _env_teste("ETERNA_LEITOR_VOLUMES").split(os.pathsep)
    elif sys.platform.startswith("win"):
        try:
            return win_cartoes()
        except Exception as ex:
            log.warning("unidades: %s", type(ex).__name__)
            return []
    elif sys.platform == "darwin":
        maes = ["/Volumes"]
    else:
        maes = ["/media/" + os.environ.get("USER", ""), "/run/media/" + os.environ.get("USER", "")]
    out = []
    for m in maes:
        try:
            nomes = sorted(os.listdir(m))
        except OSError:
            continue
        for n in nomes:
            raiz = os.path.join(m, n)
            if os.path.isdir(os.path.join(raiz, "DCIM")):
                out.append({"raiz": raiz, "rotulo": rotulo_limpo(n), "serial": ""})
    return out


def fotos_do_cartao(raiz):
    """As fotos do DCIM com o filtro do scan_card do agente: extensão do cartão, sem ._* e paradas há 2 s. Só leitura."""
    out = []
    agora = time.time()
    for base, pastas, arqs in os.walk(os.path.join(raiz, "DCIM")):
        pastas.sort()
        for fn in sorted(arqs):
            if not fn.endswith(EXT) or fn.startswith("._"):
                continue
            p = os.path.join(base, fn)
            try:
                st = os.stat(p)
            except OSError:
                if not os.path.isdir(os.path.join(raiz, "DCIM")):
                    raise                       # o cartão saiu
                out.append((p, fn, -1))         # não abre: conta como pulada
                continue
            if agora - st.st_mtime < 2:
                continue
            out.append((p, fn, st.st_size))
    return out


# ---------------------------------------------------------------- fila --------
class Fila:
    """fila.db (sqlite, WAL) + fila/<hash>.jpg. Uma conexão, protegida por trava."""

    def __init__(self):
        self.trava = threading.Lock()
        self.db = sqlite3.connect(FILA_DB, check_same_thread=False, timeout=30)
        self.db.execute("pragma journal_mode=wal")
        self.db.execute("create table if not exists foto (h text primary key, sha text, tam integer, nome text, rotulo text, cartao integer,"
                        " estado text, tentativas integer default 0, erro text, em real)")
        self.db.execute("create table if not exists cartao (id integer primary key, rotulo text, serial text, inserido real, lido real,"
                        " total integer default 0, copiadas integer default 0, ja_tinha integer default 0, enviadas integer default 0,"
                        " sem_dono integer default 0)")
        self.db.execute("create index if not exists foto_estado on foto (estado, cartao, nome)")
        self.db.commit()

    def q(self, sql, args=(), um=False, todos=False):
        with self.trava:
            c = self.db.execute(sql, args)
            r = c.fetchone() if um else c.fetchall() if todos else None
            if not (um or todos):
                self.db.commit()
            return r

    def arquivo(self, h):
        return os.path.join(FILA, h + ".jpg")

    def resumo(self):
        r = self.q("select count(*), coalesce(sum(tam), 0) from foto where estado='copiada'", um=True)
        return {"n": r[0], "bytes": r[1]}

    def retomar(self):
        """Na partida: temporário sai; arquivo sem linha volta para a fila; linha sem arquivo sai (a foto volta na próxima leitura)."""
        n_tmp = n_volta = n_sem = 0
        try:
            nomes = os.listdir(FILA)
        except OSError:
            nomes = []
        for fn in nomes:
            p = os.path.join(FILA, fn)
            if fn.endswith(".tmp"):
                try:
                    os.remove(p)
                    n_tmp += 1
                except OSError:
                    pass
                continue
            if not fn.endswith(".jpg") or not HEX64.match(fn[:-4]):
                continue
            h = fn[:-4]
            if self.q("select 1 from foto where h=?", (h,), um=True):
                continue
            try:
                tam = os.path.getsize(p)
                if quick_hash(p, tam) != h:
                    os.remove(p)
                    continue
                sha = hashlib.sha256()
                with open(p, "rb") as f:
                    for b in iter(lambda: f.read(1 << 20), b""):
                        sha.update(b)
            except OSError:
                continue
            self.q("insert or ignore into foto (h, sha, tam, nome, rotulo, cartao, estado, em) values (?, ?, ?, ?, ?, ?, 'copiada', ?)",
                   (h, sha.hexdigest(), tam, "fila_%s.jpg" % h[:16], "cartao", 0, time.time()))
            n_volta += 1
        for (h,) in self.q("select h from foto where estado='copiada'", todos=True):
            if not os.path.exists(self.arquivo(h)):
                self.q("delete from foto where h=?", (h,))
                n_sem += 1
        self.q("delete from foto where estado in ('enviada', 'recusada') and em < ?", (time.time() - GUARDA_DIAS * 86400,))
        self.q("delete from cartao where inserido < ?", (time.time() - GUARDA_DIAS * 86400,))
        if n_tmp or n_volta or n_sem:
            log.info("fila retomada: %d temporários apagados, %d voltaram, %d sem arquivo", n_tmp, n_volta, n_sem)


# ---------------------------------------------------------------- o leitor ----
class Leitor:
    def __init__(self, cfg, fila):
        self.cfg = cfg
        self.fila = fila
        self.trava = threading.RLock()
        self.mudou = threading.Event()
        self.tem_trabalho = threading.Condition()
        self.cartao_id = None            # o último cartão lido (linha da tabela cartao)
        self.estado_cartao = "sem"       # sem | lendo | pronto | erro
        self.presente = False
        self.progresso = (0, 0)
        self.erro_copia = None           # "disco" | "cartao" | None
        self.erro_rede = None            # "rede" | "certificado" | "recusado" | None
        self.revogado = False
        self.ocupado = False
        self.puladas = 0                 # arquivos do último cartão que não abriram
        self.pausa_ate = 0.0
        self.espera = self._espera_ini()
        self.em_curso = set()
        self.ultimo_progresso = time.time()
        self.bip_pendente = False
        self.parar = threading.Event()
        self.ultima_tela = None

    @staticmethod
    def _espera_ini():
        e = _env_teste("ETERNA_LEITOR_ESPERA")
        if e:
            a, b = e.split(",")
            return [float(a), float(a), float(b)]
        return [5.0, 5.0, 300.0]          # [atual, mínima, máxima]

    # ---------- situação ----------
    def cartao_dict(self):
        if not self.cartao_id:
            return None
        r = self.fila.q("select rotulo, total, copiadas, ja_tinha, enviadas, sem_dono, inserido from cartao where id=?", (self.cartao_id,), um=True)
        if not r:
            return None
        return {"rotulo": r[0], "estado": self.estado_cartao, "total": r[1], "copiadas": r[2], "ja_tinha": r[3], "enviadas": r[4],
                "sem_dono": r[5], "puladas": self.puladas, "em": int(r[6])}

    def erro_atual(self):
        if self.erro_copia:
            return self.erro_copia
        if self.revogado:
            return "recusado"
        return self.erro_rede if self.fila.resumo()["n"] else (self.erro_rede if self.erro_rede in ("certificado", "recusado") else None)

    def situacao(self):
        f = self.fila.resumo()
        parada = int(time.time() - self.ultimo_progresso) if f["n"] else 0
        return {"versao": VERSAO, "cartao": self.cartao_dict(), "presente": self.presente, "erro": self.erro_atual(), "ocupado": self.ocupado,
                "fila": {"n": f["n"], "mb": round(f["bytes"] / 1e6, 1), "parada_s": parada}}

    def tela(self):
        """(cor, título, linha de baixo) da janela."""
        f = self.fila.resumo()
        n = f["n"]
        if self.erro_copia == "disco":
            return "vermelho", t("nao_tire"), t("disco_sub")
        if self.estado_cartao == "lendo":
            return "azul", t("lendo"), (t("lendo_sub", *self.progresso) if self.progresso[1] else "")
        if self.revogado:
            return "vermelho", t("desativado"), t("desativado_sub")
        if self.erro_copia == "cartao" and not self.presente:
            return "vermelho", t("recoloque"), t("recoloque_sub")
        if self.estado_cartao == "erro" and self.presente:
            return "vermelho", t("erro_leitura"), t("erro_leitura_sub")
        rede = self.erro_rede in ("rede", "certificado", "recusado") and n
        sub_rede = t("certificado_sub") if self.erro_rede == "certificado" else t("esperando", n)
        if self.presente and self.estado_cartao == "pronto":
            c = self.cartao_dict() or {}
            if self.puladas:
                return "verde", t("pronto"), t("pronto_puladas", self.puladas)
            if rede:
                return "verde", t("pronto"), t("sem_conexao")
            return "verde", t("pronto"), (t("pronto_sub", c.get("copiadas", 0)) if c.get("copiadas") else t("pronto_nada"))
        if rede:
            return "amarelo", t("sem_conexao"), sub_rede
        if n and self.ocupado:
            return "cinza", t("coloque"), t("ocupado", n)
        return "cinza", t("coloque"), (t("enviando", n) if n else (t("tudo_enviado") if self.cartao_id else ""))

    def avisa(self):
        self.mudou.set()
        self.grava_estado()

    def grava_estado(self):
        try:
            cor, tit, sub = self.tela()
            s = self.situacao()
            s.update(tela={"cor": cor, "titulo": tit, "sub": sub}, revogado=self.revogado, em=int(time.time()))
            grava_privado(ESTADO, json.dumps(s, ensure_ascii=False))
        except Exception as ex:
            log.warning("estado.json: %s", type(ex).__name__)

    # ---------- leitura do cartão ----------
    def espaco_ok(self, tam):
        f = self.fila.resumo()
        try:
            livre = shutil.disk_usage(DADOS).free
        except OSError:
            livre = 0
        return f["bytes"] + tam <= num_cfg(self.cfg, "fila_max_gb", 50) * 1e9 and livre - tam >= num_cfg(self.cfg, "livre_min_gb", 5) * 1e9

    def cartao_ler(self, v):
        """Lê um cartão. -> True (pronto), "disco" ou "cartao" (erro). Nunca escreve no cartão."""
        raiz, rotulo, serial = v["raiz"], v["rotulo"], v["serial"]
        r = self.fila.q("select id from cartao where rotulo=? and serial=? and lido is null order by id desc", (rotulo, serial), um=True)
        cid = r[0] if r else None
        if cid is None:
            with self.fila.trava:
                cur = self.fila.db.execute("insert into cartao (rotulo, serial, inserido) values (?, ?, ?)", (rotulo, serial, time.time()))
                self.fila.db.commit()
                cid = cur.lastrowid
        with self.trava:
            self.cartao_id, self.estado_cartao, self.erro_copia, self.progresso, self.puladas = cid, "lendo", None, (0, 0), 0
        self.avisa()
        log.info("cartão %s: lendo", rotulo)
        try:
            arqs = fotos_do_cartao(raiz)
        except OSError:
            return self._erro_cartao(cid, rotulo)
        total = len(arqs)
        self.fila.q("update cartao set total=?, copiadas=0, ja_tinha=0 where id=?", (total, cid))
        self.progresso = (0, total)
        self.avisa()
        # 1. o hash de cada foto (o mesmo do servidor) e o que este computador já conhece
        itens, copiadas, ja_tinha = [], 0, 0
        for i, (p, fn, tam) in enumerate(arqs):
            try:
                if tam < 0:
                    raise OSError("não abre")
                h = quick_hash(p, tam)
            except OSError:
                if not os.path.isdir(os.path.join(raiz, "DCIM")):
                    return self._erro_cartao(cid, rotulo)
                self._pula(rotulo)
                continue
            r = self.fila.q("select estado from foto where h=?", (h,), um=True)
            if r and r[0] == "copiada":
                copiadas += 1
            elif r:
                ja_tinha += 1
            else:
                itens.append((p, fn, tam, h))
        # 2. o que o servidor já tem (o Wi-Fi, o 5G e o FTP costumam ter entregado quase tudo); sem rede, copia tudo
        tem = set()
        for i in range(0, len(itens), TEM_LOTE):
            lote = list(dict.fromkeys(x[3] for x in itens[i:i + TEM_LOTE]))
            try:
                st, j = pedir(self.cfg, "POST", "/leitor/tem", {"h": lote}, timeout=30)
            except ErroRede as ex:
                self._rede_falhou(ex.tipo)
                break
            if st == 401:
                self._revogar()
                break
            if st != 200 or not isinstance(j, dict) or not isinstance(j.get("tem"), list):
                break
            tem |= {x for x in j["tem"] if isinstance(x, str)}
        if self.revogado:                # desativado no Eterna durante a leitura: não copia nada e o cartão fica como não lido
            with self.trava:
                self.estado_cartao = "erro"
            log.warning("cartão %s: leitura parada (leitor desativado)", rotulo)
            self.avisa()
            return "revogado"
        agora = time.time()
        for p, fn, tam, h in itens:
            if h in tem:
                self.fila.q("insert or ignore into foto (h, tam, nome, rotulo, cartao, estado, em) values (?, ?, ?, ?, ?, 'enviada', ?)",
                            (h, tam, fn, rotulo, cid, agora))
                ja_tinha += 1
        self.fila.q("update cartao set copiadas=?, ja_tinha=? where id=?", (copiadas, ja_tinha, cid))
        self.progresso = (copiadas + ja_tinha, total)
        self.avisa()
        # 3. copia o que falta (SHA-256 inteiro durante a cópia) para fila/<h>.tmp e renomeia para .jpg
        atraso = float(_env_teste("ETERNA_LEITOR_COPIA_ATRASO") or 0)
        feitos = set()
        for p, fn, tam, h in itens:
            if h in tem or h in feitos:
                continue
            feitos.add(h)
            if tam > FOTO_MAX:
                self.fila.q("insert or ignore into foto (h, tam, nome, rotulo, cartao, estado, erro, em) values (?, ?, ?, ?, ?, 'recusada', 'grande', ?)",
                            (h, tam, fn, rotulo, cid, time.time()))
                ja_tinha += 1
                continue
            if not self.espaco_ok(tam):
                with self.trava:
                    self.estado_cartao, self.erro_copia = "erro", "disco"
                self.fila.q("update cartao set copiadas=?, ja_tinha=? where id=?", (copiadas, ja_tinha, cid))
                log.warning("cartão %s: sem espaço na fila; cópia parada", rotulo)
                self.avisa()
                return "disco"
            if atraso:
                time.sleep(atraso)
            tmp = os.path.join(FILA, h + ".tmp")
            try:
                sha = hashlib.sha256()
                with open(p, "rb") as src, open(tmp, "wb") as dst:
                    for b in iter(lambda: src.read(1 << 20), b""):
                        sha.update(b)
                        dst.write(b)
                    dst.flush()
                    os.fsync(dst.fileno())
                if os.path.getsize(tmp) != tam:
                    raise OSError("tamanho")
                os.replace(tmp, self.fila.arquivo(h))
            except OSError:
                try:
                    os.remove(tmp)
                except OSError:
                    pass
                if not os.path.isdir(os.path.join(raiz, "DCIM")):
                    return self._erro_cartao(cid, rotulo)
                if not self.espaco_ok(tam):
                    with self.trava:
                        self.estado_cartao, self.erro_copia = "erro", "disco"
                    self.avisa()
                    return "disco"
                self._pula(rotulo)           # o cartão continua aqui: este arquivo não abre, os outros seguem
                continue
            self.fila.q("insert or replace into foto (h, sha, tam, nome, rotulo, cartao, estado, tentativas, em) values (?, ?, ?, ?, ?, ?, 'copiada', 0, ?)",
                        (h, sha.hexdigest(), tam, fn, rotulo, cid, time.time()))
            copiadas += 1
            self.fila.q("update cartao set copiadas=?, ja_tinha=? where id=?", (copiadas, ja_tinha, cid))
            self.progresso = (copiadas + ja_tinha, total)
            with self.tem_trabalho:
                self.tem_trabalho.notify_all()
            self.mudou.set()
        self.fila.q("update cartao set copiadas=?, ja_tinha=?, lido=? where id=?", (copiadas, ja_tinha, time.time(), cid))
        with self.trava:
            self.estado_cartao, self.erro_copia, self.progresso = "pronto", None, (total, total)
            self.bip_pendente = True
        log.info("cartão %s: pronto (%d fotos, %d copiadas, %d já estavam, %d não abriram)", rotulo, total, copiadas, ja_tinha, self.puladas)
        self.avisa()
        return True

    def _pula(self, rotulo):
        self.puladas += 1
        log.warning("cartão %s: um arquivo não abriu e foi pulado", rotulo)

    def _erro_cartao(self, cid, rotulo):
        with self.trava:
            self.estado_cartao, self.erro_copia = "erro", "cartao"
        log.warning("cartão %s: saiu antes do fim da leitura", rotulo)
        self.avisa()
        return "cartao"

    def vigiar(self):
        """Olha os cartões a cada segundo. Cartão lido até o fim só é lido de novo depois de sair e voltar."""
        lidos, proxima = set(), {}
        while not self.parar.is_set():
            try:
                vols = cartoes()
            except Exception as ex:
                log.warning("cartões: %s", type(ex).__name__)
                vols = []
            chaves = {(v["raiz"], v["serial"], v["rotulo"]): v for v in vols}
            lidos &= set(chaves)
            for k in [k for k in proxima if k not in chaves]:      # cartão que saiu e voltou: lê na hora
                proxima.pop(k, None)
            presente = bool(chaves)
            if presente != self.presente:
                self.presente = presente
                if self.erro_copia == "disco" and not presente:
                    self.erro_copia = None
                self.avisa()
            if not self.revogado:
                for k, v in chaves.items():
                    if k in lidos or time.time() < proxima.get(k, 0):
                        continue
                    r = self.cartao_ler(v)
                    if r is True:
                        lidos.add(k)
                    elif r != "revogado":
                        proxima[k] = time.time() + (30 if r == "disco" else 3)
                    self.presente = bool(cartoes())
                    self.avisa()
            self.limpar_revogado()
            self.parar.wait(1)

    # ---------- leitor desativado no Eterna ----------
    def revogado_desde(self):
        try:
            with open(REVOGADO, encoding="utf-8") as f:
                return float(json.load(f).get("desde") or 0)
        except (OSError, ValueError, AttributeError, TypeError):
            return 0.0

    def limpar_revogado(self, agora=None):
        """Leitor desativado há REVOGADO_DIAS: apaga a fila deste computador (os originais continuam nos cartões). -> arquivos apagados."""
        desde = self.revogado_desde()
        agora = time.time() if agora is None else agora
        if not desde or agora - desde < REVOGADO_DIAS * 86400:
            return 0
        n = 0
        try:
            nomes = os.listdir(FILA)
        except OSError:
            nomes = []
        for fn in nomes:
            try:
                os.remove(os.path.join(FILA, fn))
                n += 1
            except OSError:
                pass
        self.fila.q("delete from foto where estado='copiada'")
        if n:
            log.warning("fila apagada: leitor desativado há mais de %d dias (%d arquivos)", REVOGADO_DIAS, n)
            self.avisa()
        return n

    # ---------- envio ----------
    def _rede_falhou(self, tipo):
        with self.trava:
            mudou = self.erro_rede != tipo
            self.erro_rede = tipo
            self.pausa_ate = time.time() + self.espera[0]
            self.espera[0] = min(self.espera[2], self.espera[0] * 2)
        if mudou:
            log.warning("servidor: %s", {"rede": "sem conexão", "certificado": "certificado não confere"}.get(tipo, tipo))
            self.avisa()

    def _ocupado(self, st=503):
        """O servidor está com as vagas cheias (503, 429): espera curta e sem aviso de rede."""
        a, b = (self.espera[1], self.espera[2]) if _env_teste("ETERNA_LEITOR_ESPERA") else (5.0, 15.0)
        with self.trava:
            novo = not self.ocupado
            self.ocupado = True
            self.pausa_ate = time.time() + random.uniform(a, b)
        if novo:
            log.info("servidor ocupado (%s): espera curta", st)
            self.avisa()

    def _rede_ok(self):
        with self.trava:
            self.ocupado = False
            mudou = self.erro_rede is not None
            self.erro_rede = None
            self.espera[0] = self.espera[1]
            self.pausa_ate = 0
        if mudou:
            log.info("servidor: conexão de volta")
            self.avisa()

    def _revogar(self):
        if not self.revogado:
            self.revogado = True
            if not self.revogado_desde():
                try:
                    grava_privado(REVOGADO, json.dumps({"desde": time.time()}))
                except OSError:
                    pass
            log.warning("leitor desativado no Eterna (401): envio parado, a fila fica neste computador")
            self.avisa()

    def proxima(self):
        with self.trava:
            if self.revogado or time.time() < self.pausa_ate:
                return None
            em = list(self.em_curso)
            marca = ",".join("?" * len(em))
            r = self.fila.q("select h, sha, tam, nome, rotulo, cartao from foto where estado='copiada'%s order by cartao, nome limit 1"
                            % (" and h not in (%s)" % marca if em else ""), tuple(em), um=True)
            if r:
                self.em_curso.add(r[0])
            return r

    def enviar_loop(self):
        while not self.parar.is_set():
            r = self.proxima()
            if not r:
                with self.tem_trabalho:
                    self.tem_trabalho.wait(1)
                continue
            try:
                self.enviar_um(*r)
            except Exception as ex:
                log.warning("envio: %s", type(ex).__name__)
                self._rede_falhou("rede")
            finally:
                with self.trava:
                    self.em_curso.discard(r[0])

    def enviar_um(self, h, sha, tam, nome, rotulo, cid):
        arq = self.fila.arquivo(h)
        if not os.path.exists(arq):
            self.fila.q("delete from foto where h=? and estado='copiada'", (h,))
            return
        qs = urllib.parse.urlencode({"nome": nome[:200], "rotulo": rotulo if ROTULO_RE.match(rotulo or "") else "cartao"})
        try:
            with open(arq, "rb") as f:
                st, j = pedir(self.cfg, "POST", "/leitor/foto?" + qs, f, {"Content-Type": "image/jpeg", "Content-Length": str(tam),
                                                                          "X-Eterna-Hash": h, "X-Eterna-Sha256": sha or ""}, timeout=180)
        except ErroRede as ex:
            self.fila.q("update foto set tentativas=tentativas+1 where h=?", (h,))
            self._rede_falhou(ex.tipo)
            return
        erro = (j or {}).get("erro") if isinstance(j, dict) else None
        if st == 200 and isinstance(j, dict) and j.get("resultado") in ("new", "dup"):
            self.fila.q("update foto set estado='enviada', em=?, erro=null where h=?", (time.time(), h))
            try:
                os.remove(arq)
            except OSError:
                pass
            sem_dono = 1 if j["resultado"] == "new" and j.get("dono") is False else 0
            self.fila.q("update cartao set enviadas=enviadas+1, sem_dono=sem_dono+? where id=?", (sem_dono, cid))
            self.ultimo_progresso = time.time()
            self._rede_ok()
            self.mudou.set()
            if self.fila.resumo()["n"] == 0:
                self.avisa()
            return
        if st == 401:
            self._revogar()
            return
        if st in (413, 415) or (st == 400 and erro != "incompleta"):
            self.fila.q("update foto set estado='recusada', erro=?, em=? where h=?", (str(erro or st)[:20], time.time(), h))
            try:
                os.remove(arq)
            except OSError:
                pass
            log.warning("foto recusada pelo servidor (%s); o original continua no cartão", erro or st)
            self.ultimo_progresso = time.time()
            self.mudou.set()
            return
        self.fila.q("update foto set tentativas=tentativas+1, erro=? where h=?", (str(erro or st)[:20], h))
        if st in (429, 503):
            self._ocupado(st)
            return
        self._rede_falhou("recusado" if st == 403 else "rede")

    # ---------- pulso ----------
    def pulso(self):
        livre = None
        try:
            livre = round(shutil.disk_usage(DADOS).free / 1e9, 1)
        except OSError:
            pass
        s = self.situacao()
        c = s["cartao"]
        corpo = {"v": 1, "versao": VERSAO, "maquina": maquina(), "livre_gb": livre, "fila": s["fila"],
                 "cartao": {k: c[k] for k in ("rotulo", "estado", "total", "copiadas", "ja_tinha", "enviadas", "sem_dono", "puladas", "em")} if c else None,
                 "erro": s["erro"]}
        return pedir(self.cfg, "POST", "/leitor/pulso", corpo, timeout=20)

    def pulso_loop(self):
        ultimo = 0.0
        while not self.parar.is_set():
            passou = time.time() - ultimo
            alvo = PULSO_MIN_S if self.mudou.is_set() else PULSO_S
            if passou < alvo:
                if self.mudou.is_set():
                    self.parar.wait(min(alvo - passou, 1.0))
                else:
                    self.mudou.wait(min(alvo - passou, 1.0))
                continue
            self.mudou.clear()
            ultimo = time.time()
            try:
                st, _ = self.pulso()
                if st == 401:
                    self._revogar()
                elif st == 200 and self.erro_rede in ("rede", "certificado") and not self.fila.resumo()["n"]:
                    self._rede_ok()
            except ErroRede as ex:
                if self.fila.resumo()["n"]:
                    self._rede_falhou(ex.tipo)
                elif ex.tipo == "certificado":
                    self._rede_falhou(ex.tipo)
            except Exception as ex:
                log.warning("pulso: %s", type(ex).__name__)

    def iniciar(self):
        if self.revogado_desde():           # desativado antes de fechar: continua parado até reinstalar
            self.revogado = True
        self.limpar_revogado()
        for alvo in [self.vigiar, self.pulso_loop] + [self.enviar_loop] * PARALELO:
            threading.Thread(target=alvo, daemon=True).start()
        self.avisa()


def maquina():
    n = re.sub(r"[^A-Za-z0-9 ._-]", "", socket.gethostname() or "")[:40]
    return n


# ---------------------------------------------------------------- telas -------
CORES = {"cinza": ("#5f6368", "#ffffff"), "azul": ("#134078", "#ffffff"), "verde": ("#005500", "#ffffff"),
         "amarelo": ("#FFB800", "#25282A"), "vermelho": ("#B00020", "#ffffff")}


def bip():
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_OK)
        return
    except Exception:
        pass
    try:
        sys.stdout.write("\a")
        sys.stdout.flush()
    except Exception:
        pass


def console(lt):
    """Sem janela: uma linha a cada mudança do que a janela mostraria."""
    ultimo = None
    while True:
        cor, tit, sub = lt.tela()
        if lt.bip_pendente:
            lt.bip_pendente = False
            bip()
        if (cor, tit, sub) != ultimo:
            ultimo = (cor, tit, sub)
            print("[%s] %s%s" % (time.strftime("%H:%M:%S"), tit, (" · " + sub) if sub else ""), flush=True)
        time.sleep(0.5)


def janela(lt):
    import tkinter as tk
    root = tk.Tk()
    root.title(t("titulo"))
    root.attributes("-topmost", True)
    root.geometry("460x190+24+24")
    root.resizable(False, False)
    tit = tk.Label(root, font=("Segoe UI", 26, "bold"), wraplength=430, justify="center")
    sub = tk.Label(root, font=("Segoe UI", 13), wraplength=430, justify="center")
    tit.pack(expand=True, fill="both", padx=12, pady=(18, 4))
    sub.pack(fill="x", padx=12, pady=(0, 18))
    root.protocol("WM_DELETE_WINDOW", root.iconify)      # fechar só minimiza: o fotógrafo não desliga o leitor sem querer

    def tick():
        cor, a, b = lt.tela()
        fundo, texto = CORES[cor]
        for w in (root, tit, sub):
            w.configure(bg=fundo)
        tit.configure(text=a, fg=texto)
        sub.configure(text=b, fg=texto)
        if lt.bip_pendente:
            lt.bip_pendente = False
            bip()
            root.deiconify()
            root.lift()
        root.after(400, tick)
    tick()
    root.mainloop()


# ---------------------------------------------------------------- comandos ----
_trava_sock = []


def trava():
    """Uma cópia por vez: socket preso em 127.0.0.1:8766 (nenhum servidor nessa porta)."""
    porta = int(_env_teste("ETERNA_LEITOR_TRAVA") or TRAVA_PORTA)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
        s.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
    try:
        s.bind(("127.0.0.1", porta))
    except OSError:
        s.close()
        return False
    _trava_sock.append(s)
    return True


def cmd_ativar(a):
    cfg = dict(config_ler() or {})
    cfg.update(servidor=(a.servidor or cfg.get("servidor") or SERVIDOR_PADRAO).rstrip("/"), ip=a.ip or cfg.get("ip") or IP_PADRAO)
    cfg.pop("token", None)
    e = config_erro(cfg, com_token=False)
    if e:
        print("Não ativei: %s." % e)
        return 2
    try:
        st, j = pedir(cfg, "POST", "/leitor/ativar", {"codigo": a.ativar, "maquina": maquina()}, timeout=30, token=False)
    except ErroRede as ex:
        print("Não ativei: %s." % ("o certificado do servidor não confere" if ex.tipo == "certificado" else "sem conexão com o servidor"))
        return 1
    if st != 200 or not isinstance(j, dict) or not isinstance(j.get("token"), str):
        erro = (j or {}).get("erro") if isinstance(j, dict) else None
        print("Não ativei: %s." % {"codigo": "código inválido, vencido ou já usado (gere outro no Eterna)", "rede": "este computador está fora da rede do ponto",
                                     "taxa": "tentativas demais; espere alguns minutos", "origem": "pedido recusado pelo servidor"}.get(erro, "o servidor respondeu %s" % st))
        return 1
    cfg.update(id=j.get("id"), nome=j.get("nome"), token=j["token"])
    cfg.setdefault("fila_max_gb", 50)
    cfg.setdefault("livre_min_gb", 5)
    grava_privado(CFG, json.dumps(cfg, indent=1))
    try:
        os.remove(REVOGADO)
    except OSError:
        pass
    log.info("leitor ativado como %s", j.get("nome"))
    print("Leitor ativado: %s." % j.get("nome"))
    return 0


def cmd_testar(cfg):
    lt = Leitor(cfg, Fila())
    try:
        st, j = lt.pulso()
    except ErroRede as ex:
        print("Sem conexão com o servidor." if ex.tipo == "rede" else "O certificado do servidor não confere.")
        return 1
    if st == 200:
        print("Conectado ao Eterna como %s." % (cfg.get("nome") or "leitor"))
        return 0
    if st == 401:
        print("Este leitor foi desativado no Eterna ou o código foi trocado. Gere um novo código no Painel de controle.")
    elif st == 403:
        print("O servidor recusou este computador (rede fora da lista do leitor).")
    else:
        print("O servidor respondeu %s." % st)
    return 1


def cmd_apagar_fila():
    print("Isto apaga as fotos guardadas neste computador que ainda não subiram para o servidor.")
    print("Os originais continuam nos cartões. Digite APAGAR para confirmar:")
    try:
        r = input().strip()
    except EOFError:
        r = ""
    if r != "APAGAR":
        print("Nada foi apagado.")
        return 1
    n = 0
    for fn in os.listdir(FILA):
        try:
            os.remove(os.path.join(FILA, fn))
            n += 1
        except OSError:
            pass
    for sufixo in ("", "-wal", "-shm"):
        try:
            os.remove(FILA_DB + sufixo)
        except OSError:
            pass
    log.info("fila apagada (%d arquivos)", n)
    print("Fila apagada: %d arquivos." % n)
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description="Eterna · leitor de cartão do gramado")
    p.add_argument("--ativar", metavar="CODIGO")
    p.add_argument("--servidor")
    p.add_argument("--ip")
    p.add_argument("--testar", action="store_true")
    p.add_argument("--apagar-fila", action="store_true")
    p.add_argument("--sem-janela", action="store_true")
    a = p.parse_args(argv)
    lingua_escolher()
    preparar_pastas()
    if a.ativar:
        return cmd_ativar(a)
    if a.apagar_fila:
        if not trava():
            print("Feche o leitor antes de apagar a fila.")
            return 3
        return cmd_apagar_fila()
    cfg = config_ler() or {}
    e = config_erro(cfg)
    if e:
        print("O leitor não abriu: %s." % e)
        log.warning("não abriu: %s", e)
        return 2
    if a.testar:
        return cmd_testar(cfg)
    if not trava():
        print("O leitor já está aberto neste computador.")
        return 3
    fila = Fila()
    fila.retomar()
    lt = Leitor(cfg, fila)
    lt.iniciar()
    log.info("leitor aberto (%s)", VERSAO)
    sem_janela = a.sem_janela or sys.platform == "darwin"
    if not sem_janela:
        try:
            janela(lt)
            return 0
        except Exception as ex:
            log.warning("sem janela (%s): seguindo no console", type(ex).__name__)
    try:
        console(lt)
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
