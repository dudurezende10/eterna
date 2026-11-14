# Atrás do proxy com certificado: o X-Real-IP só vale vindo de ETERNA_PROXY_IP (servidor/linux/certificado.sh).
# Roda com HOME temporário:  python3 -I testes/proxy_ip_agente.py agente/eterna-agente.py
import http.client, importlib.util, os, sys, threading
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao  # noqa: F401  (para aqui se o HOME não for temporário)

os.environ["ETERNA_PROXY_IP"] = "127.0.0.1"
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
visto = []


class Eco(m.H):
    def do_GET(self):
        visto.append(self.client_address[0])
        self.send_response(204)
        self.end_headers()


srv = ThreadingHTTPServer(("127.0.0.1", 0), Eco)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def pede(h):
    c = http.client.HTTPConnection("127.0.0.1", srv.server_address[1], timeout=10)
    c.request("GET", "/x", headers=h)
    c.getresponse().read()
    return visto[-1]


falhas = []
if pede({"X-Real-IP": "192.168.10.50"}) != "192.168.10.50":
    falhas.append("vindo do proxy, X-Real-IP vale")
if pede({"X-Real-IP": "nao-e-ip"}) != "127.0.0.1":
    falhas.append("X-Real-IP inválido é ignorado")
if pede({}) != "127.0.0.1":
    falhas.append("sem X-Real-IP fica o do proxy")
m.PROXY_IP = "10.9.9.9"
if pede({"X-Real-IP": "192.168.10.50"}) != "127.0.0.1":
    falhas.append("pedido que não vem do proxy não troca o IP pelo cabeçalho")
m.PROXY_IP = ""
if pede({"X-Real-IP": "192.168.10.50"}) != "127.0.0.1":
    falhas.append("sem ETERNA_PROXY_IP o cabeçalho é ignorado")
srv.shutdown()
if falhas:
    print("FALHA proxy_ip_agente: " + "; ".join(falhas))
    sys.exit(1)
print("OK proxy_ip_agente: X-Real-IP só do ETERNA_PROXY_IP, inválido ignorado")
