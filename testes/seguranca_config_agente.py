# Rotas de configuração: Roverpix só para os endereços oficiais, FTP do estádio só na rede do ponto (portas 21 e 990, erro
# sem detalhe, 5 testes por minuto), corpos com teto e nome de fotógrafo vindo da Roverpix sem HTML.
#   python3 -I testes/seguranca_config_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sys, threading
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def pede(rota, corpo, cookie, bruto=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    dados = bruto if bruto is not None else json.dumps(corpo).encode()
    c.request("POST", rota, dados, {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json", "Cookie": cookie})
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


try:
    adm = S.cookie_sessao(m, "admin-config")
    # Roverpix: só os endereços oficiais
    for base in ("http://169.254.169.254", "https://evil.example", "http://beta.api.roverpix.com", "https://api.roverpix.com.evil.example"):
        st, j = pede("/roverpix/config", {"api_key": "chave-de-teste", "base_url": base}, adm)
        ok(st == 400, "Roverpix com base_url %s deveria dar 400: %s" % (base, st))
    ok(not os.path.exists(m.ROVER_CFG), "chave gravada com endereço recusado")
    st, j = pede("/roverpix/config", {"api_key": "chave-de-teste", "base_url": "https://api.roverpix.com/api/v1"}, adm)
    ok(st == 200 and json.load(open(m.ROVER_CFG))["base_url"] == "https://api.roverpix.com/api/v1", "Roverpix oficial: %s" % st)
    st, j = pede("/roverpix/config", None, adm, bruto=b'{"api_key":"' + b"a" * 5000 + b'"}')
    ok(st == 413, "corpo da Roverpix acima de 4 KB: %s" % st)
    # FTP do estádio: IP público, porta estranha e nome fora da lista recusados; erro sem detalhe; 5 por minuto
    for host, porta in (("8.8.8.8", 21), ("169.254.169.254", 21), ("127.0.0.1", 21), ("ftp.exemplo.com", 21), ("10.0.0.5", 22), ("192.168.0.9", 2121)):
        st, j = pede("/ftp-remoto/config", {"host": host, "port": porta, "user": "u", "password": "p"}, adm)
        ok(st == 400, "FTP do estádio %s:%s deveria dar 400: %s %s" % (host, porta, st, j))
    open(m.RFTP_HOSTS, "w").write("# nomes aceitos\n127.0.0.1\nftp.estadio.local\n")
    st, j = pede("/ftp-remoto/config", {"host": "127.0.0.1", "port": 21, "user": "u", "password": "p"}, adm)
    ok(st == 502 and j.get("error") == "não conectou: confira servidor, porta, usuário e senha", "erro sem detalhe da conexão: %s %s" % (st, j))
    sts = [pede("/ftp-remoto/config", {"host": "127.0.0.1", "port": 21, "user": "u", "password": "p"}, adm)[0] for _ in range(5)]
    ok(sts[-1] == 429 and 429 not in sts[:3], "6º teste no minuto deveria dar 429: %s" % sts)
    ok(m.rftp_host_ok("10.1.2.3") and m.rftp_host_ok("172.20.0.1") and m.rftp_host_ok("192.168.1.20") and not m.rftp_host_ok("172.32.0.1")
       and m.rftp_host_ok("ftp.estadio.local") and not m.rftp_host_ok("100.64.0.1"), "rftp_host_ok")
    # destino conferido também ao ler a configuração (arquivo trocado à mão)
    json.dump({"base_url": "http://169.254.169.254/api/v1", "api_key": "x"}, open(m.ROVER_CFG, "w"))
    ok(m.rover_cfg() is None, "roverpix.json com endereço de fora é ignorado")
    json.dump({"host": "8.8.8.8", "port": 21, "user": "u", "password": "p"}, open(m.RFTP_CFG, "w"))
    ok(m.rftp_cfg() is None, "ftp-remoto.json com servidor de fora é ignorado")
    json.dump({"host": "10.0.0.5", "port": 21, "user": "u", "password": "p"}, open(m.RFTP_CFG, "w"))
    ok(m.rftp_cfg() is not None, "ftp-remoto.json da rede do ponto vale")
    # Photoroom: chave com teto de corpo
    st, j = pede("/photoroom/config", None, adm, bruto=b'{"api_key":"' + b"a" * 5000 + b'"}')
    ok(st == 413, "corpo do Photoroom config acima de 4 KB: %s" % st)
    # nome de fotógrafo vindo da Roverpix: sem < > " ' ` &, até 60
    agg = m.rv_aggregate("2026-11-09", [], [], [{"photographer_name": "<img src=x onerror=alert(1)>" + "z" * 80, "pdv_name": "Ponto \"1\" <b>", "card": "C1"}])
    nomes = [p["name"] for p in agg["people"].values()] + [p["pdv"] for p in agg["people"].values()]
    ok(all(not any(ch in n for ch in "<>\"'`&") and len(n) <= 60 for n in nomes), "nome da Roverpix com HTML: %s" % nomes)
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-600:])
print(("OK" if not falhas else "FALHA") + " seguranca_config_agente: Roverpix oficial, FTP do estádio na rede do ponto, tetos de corpo, nome da Roverpix sem HTML"
      + ("" if not falhas else " · " + " | ".join(falhas[:8])))
sys.exit(1 if falhas else 0)
