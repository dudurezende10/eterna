# FTP embutido: trocar de usuário pede a senha de novo, pasta temporária por sessão, só JPEG (553 antes de gravar), teto de
# tamanho (552), sem modo ativo (502), conexão de dados só do IP do controle, limite de sessões por IP, foto apagada a pedido
# do cliente responde 226 sem entrar, ETERNA_FTP=0 desliga. Agente de verdade em outro processo, HOME temporário.
#   python3 -I testes/seguranca_ftp_agente.py agente/eterna-agente.py
import ftplib, http.client, importlib.util, io, json, os, random, re, socket, subprocess, sys, tempfile, time
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao

AG = sys.argv[1]
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


PORTA = 21000 + random.randint(0, 800)
FTPP = PORTA + 1000
PASV = "%d-%d" % (PORTA + 2000, PORTA + 2010)
H = tempfile.mkdtemp()
os.makedirs(os.path.join(H, "Eterna"), exist_ok=True)
SENHAS = {"carlos": "carlos-senha-123", "marinara": "marinara-senha-1"}
json.dump({"users": SENHAS}, open(os.path.join(H, "Eterna", "ftp.json"), "w"))
os.environ["HOME"] = os.environ["USERPROFILE"] = tempfile.mkdtemp()     # o módulo importado aqui (quick_hash) não mexe no HOME do agente
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)


def jpeg(cor, tam=(320, 200)):
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", tam, (cor, 90, 160)).save(b, "JPEG", quality=80)
    return b.getvalue()


EXCLUIDA = jpeg(77)
p0 = os.path.join(tempfile.mkdtemp(), "x.jpg")
open(p0, "wb").write(EXCLUIDA)
json.dump([m.quick_hash(p0, len(EXCLUIDA))], open(os.path.join(H, "Eterna", "lgpd-excluidas.json"), "w"))


def subir(home, extra=None):
    env = {**os.environ, "HOME": home, "USERPROFILE": home, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP), "ETERNA_FTP_PASV": PASV,
           "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "USER": "eterna-teste-sem-cartao", **(extra or {})}
    for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_BUCKET"):
        env.pop(k, None)
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        time.sleep(0.25)
        try:
            c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=2)
            c.request("GET", "/status", headers={"Host": "127.0.0.1:%d" % PORTA})
            if c.getresponse().status == 200:
                return p
        except OSError:
            pass
    return p


def biblioteca(cookie):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request("GET", "/biblioteca", headers={"Host": "127.0.0.1:%d" % PORTA, "Cookie": cookie})
    return json.loads(c.getresponse().read()).get("fotos", [])


def cliente(usuario="carlos"):
    f = ftplib.FTP()
    f.connect("127.0.0.1", FTPP, timeout=15)
    if usuario:
        f.login(usuario, SENHAS[usuario])
    return f


def erro(fn):
    try:
        return str(fn())
    except ftplib.all_errors as e:
        return str(e)


def arquivos(raiz):
    return sorted(os.path.relpath(os.path.join(d, x), raiz) for d, _, fs in os.walk(raiz) for x in fs)


A = subir(H)
try:
    ck = _agente_sessao.cookie_sub(AG, H)
    antes = set(arquivos(H))
    # USER depois do login: a sessão volta a pedir senha (não grava como outro fotógrafo)
    f = cliente()
    ok(f.sendcmd("USER marinara").startswith("331"), "USER depois do login: 331")
    r = erro(lambda: f.storbinary("STOR troca.jpg", io.BytesIO(jpeg(10))))
    ok(r.startswith("530"), "STOR depois de USER sem senha deveria dar 530: %s" % r)
    ok(erro(lambda: f.sendcmd("PASV")).startswith("530"), "PASV depois de USER sem senha: 530")
    f.close()
    # USER com caminho + senha certa de outro: 530, nada fora da pasta temporária
    f = cliente(None)
    r = erro(lambda: f.login("../../x", SENHAS["carlos"]))
    ok(r.startswith("530"), "USER ../../x com a senha do carlos: %s" % r)
    f.close()
    # só JPEG: 553 antes do 150, nada gravado
    f = cliente()
    r = erro(lambda: f.storbinary("STOR virus.exe", io.BytesIO(b"MZ" + b"\0" * 5000)))
    ok(r.startswith("553"), "STOR .exe deveria dar 553: %s" % r)
    r = erro(lambda: f.storbinary("STOR ../../fora.jpg.sh", io.BytesIO(b"#!/bin/sh\n")))
    ok(r.startswith("553"), "STOR .sh deveria dar 553: %s" % r)
    # sem modo ativo
    ok(erro(lambda: f.sendcmd("PORT 127,0,0,1,4,1")).startswith("502"), "PORT deveria dar 502")
    ok(erro(lambda: f.sendcmd("EPRT |1|127.0.0.1|1025|")).startswith("502"), "EPRT deveria dar 502")
    ok("PORT" not in f.sendcmd("FEAT"), "FEAT sem PORT")
    # teto de tamanho: 61 MB -> 552
    r = erro(lambda: f.storbinary("STOR enorme.jpg", io.BytesIO(b"\xff\xd8" + b"\0" * (61 * 1024 * 1024))))
    ok(r.startswith("552"), "arquivo de 61 MB deveria dar 552: %s" % r[:80])
    f.close()
    # conexão de dados de outro IP é fechada; a do IP certo grava (226)
    c = socket.create_connection(("127.0.0.1", FTPP), timeout=15)
    cf = c.makefile("rb")
    lin = lambda: cf.readline().decode().strip()
    lin()
    for cmd in ("USER carlos", "PASS " + SENHAS["carlos"], "TYPE I", "PASV"):
        c.sendall((cmd + "\r\n").encode())
        resp = lin()
    pp = [int(x) for x in re.search(r"\((\d+,\d+,\d+,\d+,\d+,\d+)\)", resp).group(1).split(",")]
    porta_d = pp[4] * 256 + pp[5]
    ok(PORTA + 2000 <= porta_d <= PORTA + 2010, "porta passiva fora da faixa de ETERNA_FTP_PASV: %d" % porta_d)
    c.sendall(b"STOR outro-ip.jpg\r\n")
    intruso = socket.socket()
    try:
        intruso.bind(("127.0.0.2", 0))
        intruso.connect(("127.0.0.1", porta_d))
        intruso.settimeout(3)
        try:
            intruso.sendall(jpeg(20))
            fechou = intruso.recv(10) == b""
        except OSError:
            fechou = True
        ok(fechou, "conexão de dados de outro IP deveria ser fechada")
    except OSError as ex:
        falhas.append("não deu para testar outro IP (127.0.0.2): %s" % ex)
    finally:
        intruso.close()
    certo = socket.create_connection(("127.0.0.1", porta_d), timeout=10)
    certo.sendall(jpeg(30))
    certo.close()
    r1, r2 = lin(), lin()
    ok(r1.startswith("150") and r2.startswith("226"), "conexão de dados do IP certo grava: %s %s" % (r1, r2))
    cf.close()
    c.close()
    # JPEG válido entra na biblioteca; foto apagada a pedido do cliente responde 226 e não entra
    f = cliente()
    ok(f.storbinary("STOR IMG_OK.jpg", io.BytesIO(jpeg(40))).startswith("226"), "JPEG válido: 226")
    ok(f.storbinary("STOR IMG_LGPD.jpg", io.BytesIO(EXCLUIDA)).startswith("226"), "foto excluída a pedido: 226 (a câmera não reenvia)")
    f.close()
    nomes = {}
    for _ in range(40):
        nomes = {x["name"]: x for x in biblioteca(ck)}
        if "IMG_OK.jpg" in nomes and "outro-ip.jpg" in nomes:
            break
        time.sleep(0.25)
    ok("IMG_OK.jpg" in nomes and nomes["IMG_OK.jpg"]["origem"] == "carlos", "JPEG válido na biblioteca com dono carlos: %s" % list(nomes))
    ok("IMG_LGPD.jpg" not in nomes and "troca.jpg" not in nomes, "excluída ou troca de usuário entrou: %s" % list(nomes))
    novos = sorted(set(arquivos(H)) - antes)
    estranhos = [x for x in novos if not re.match(r"^Eterna/(inbox|thumbs|ponto|rostos|metricas|sessoes|galerias|recortes|logs|roverpix)/|^Eterna/[^/]+\.(json|jsonl|db|db-wal|db-shm|log)$", x)]
    ok(not estranhos, "arquivos fora do lugar depois do FTP: %s" % estranhos)
    ok(not [x for x in arquivos(os.path.join(H, "Eterna", "ftp-tmp")) if x], "sobrou arquivo na pasta temporária do FTP")
    ok(not any(re.search(r"virus|fora|enorme", x) for x in novos), "arquivo recusado foi gravado: %s" % novos)
    # limite de sessões por IP: a 9ª conexão recebe 421
    abertas = []
    time.sleep(1.5)                                  # as sessões acima terminam do lado do servidor
    for i in range(9):
        s_ = socket.create_connection(("127.0.0.1", FTPP), timeout=5)
        abertas.append((s_, s_.recv(200).decode()))
    ok(all(x[1].startswith("220") for x in abertas[:8]) and abertas[8][1].startswith("421"), "9ª sessão do mesmo IP: %s" % [x[1][:3] for x in abertas])
    for s_, _ in abertas:
        s_.close()
finally:
    A.kill()
    A.wait(10)
# ETERNA_FTP=0: nada escuta na porta do FTP
H2 = tempfile.mkdtemp()
B = subir(H2, {"ETERNA_FTP": "0"})
try:
    try:
        socket.create_connection(("127.0.0.1", FTPP), timeout=2).close()
        ok(False, "ETERNA_FTP=0 deveria desligar o FTP embutido")
    except OSError:
        pass
finally:
    B.kill()
print(("OK" if not falhas else "FALHA") + " seguranca_ftp_agente: USER depois do login, pasta por sessão, só JPEG, 61 MB, PORT, IP da conexão de dados, 8 por IP, LGPD, ETERNA_FTP=0"
      + ("" if not falhas else " · " + " | ".join(falhas[:8])))
sys.exit(1 if falhas else 0)
