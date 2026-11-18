# Cabeçalhos de segurança (17/11): toda resposta do servidor leva cada um deles uma vez só.
# Roda com HOME temporário:  python3 -I testes/cabecalhos_agente.py agente/eterna-agente.py
import http.client, importlib.util, os, sys, threading
from http.server import ThreadingHTTPServer

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao               # para aqui se o HOME não for temporário
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
porta = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

for metodo, rota in (("GET", "/auth/eu"), ("GET", "/rota-que-nao-existe"), ("POST", "/auth/sair"), ("OPTIONS", "/auth/eu")):
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=30)
    c.request(metodo, rota, "{}" if metodo == "POST" else None, {"Host": "127.0.0.1:%d" % porta, "X-Eterna": "1", "Content-Type": "application/json"})
    r = c.getresponse()
    r.read()
    for k, v in m.SEG_CABECALHOS:
        vs = r.msg.get_all(k) or []
        if vs != [v]:
            falhas.append("%s %s: %s = %s" % (metodo, rota, k, vs))
    c.close()

srv.shutdown()
if falhas:
    print("FALHA cabecalhos_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK cabecalhos_agente: frame, nosniff, referrer, câmera só aqui, uma vez em cada resposta")
