# Pedidos do Checkout no servidor (15/11): o posto grava os seus e lê de volta só os dele; fechado não reabre.
# Roda com HOME temporário:  python3 -I testes/pedidos_checkout_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_ORIGENS"] = "https://posto.eterna.photo"      # endereço com certificado dos postos (proxy na frente do agente)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
m.HOSTS_OK.add("127.0.0.1:%d" % m.PORT)
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def pede(rota, corpo=None, cookie=None, extra=None, form=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    if form is not None:
        h["Content-Type"] = "application/x-www-form-urlencoded"
        c.request("POST", rota, form.encode(), h)
    else:
        c.request("POST" if corpo is not None else "GET", rota, json.dumps(corpo) if corpo is not None else None, h)
    r = c.getresponse()
    b = r.read()
    try:
        j = json.loads(b or b"{}")
    except ValueError:
        j = {"html": b.decode("utf8", "replace")}
    ck = r.getheader("Set-Cookie") or ""
    c.close()
    return r.status, j, ck


def ped(id_, estado, posto="Posto 8", **kw):
    return dict({"id": id_, "codigo": "2ADN-LUFX", "estado": estado, "posto": posto, "canal": "checkout", "card": "LPHLVE735",
                 "criada": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())}, **kw)


try:
    p8 = S.cookie_posto(m, "Posto 8")
    p9 = S.cookie_posto(m, "Posto 9")
    st, j, _ = pede("/ponto/pedidos", {"pedidos": [ped("p_a1", "escolha")]})
    ok(st == 401, "sem posto nem sessão deveria dar 401: %s %s" % (st, j))
    st, j, _ = pede("/ponto/pedidos", {"pedidos": [ped("p_a1", "escolha"), ped("x<1>", "escolha"), ped("p_a2", "inventado"), ped("p_a3", "escolha", posto="Posto 9")]}, p8)
    ok(st == 200 and j.get("gravados") == 1 and j.get("recusados") == 3, "posto 8 grava só o seu e válido: %s %s" % (st, j))
    st, j, _ = pede("/ponto/pedidos?posto=Posto%209", cookie=p8)
    ok(st == 200 and [x["id"] for x in j.get("pedidos", [])] == ["p_a1"], "posto 8 lê só os dele (mesmo pedindo outro): %s %s" % (st, j))
    st, j, _ = pede("/ponto/pedidos", cookie=p9)
    ok(st == 200 and j.get("pedidos") == [], "posto 9 não vê o pedido do 8: %s %s" % (st, j))
    st, j, _ = pede("/ponto/pedidos", {"pedidos": [ped("p_a1", "confirmada", total=60)]}, p8)
    ok(j.get("gravados") == 1, "fechar o pedido: %s" % j)
    st, j, _ = pede("/ponto/pedidos", {"pedidos": [ped("p_a1", "escolha")]}, p8)
    ok(j.get("recusados") == 1, "pedido fechado não reabre: %s" % j)
    st, j, _ = pede("/ponto/pedidos", {"pedidos": [ped("p_a1", "cancelada")]}, p8)
    ok(j.get("recusados") == 1, "pedido fechado não troca de desfecho: %s" % j)
    st, j, _ = pede("/ponto/pedidos", cookie=p8)
    ok(j.get("pedidos", [{}])[0].get("estado") == "confirmada" and j["pedidos"][0].get("total") == 60, "fica o confirmado: %s" % j)
    adm = S.cookie_sessao(m, "admin-pedidos")
    st, j, _ = pede("/ponto/pedidos?posto=Posto%208", cookie=adm)
    ok(st == 200 and len(j.get("pedidos", [])) == 1, "pessoa conectada lê o posto pedido: %s %s" % (st, j))
finally:
    srv.shutdown()
print(("FALHA pedidos do Checkout: " + " | ".join(falhas)) if falhas else "OK pedidos do Checkout no servidor (grava, lê só os do posto, fechado não reabre)")
sys.exit(1 if falhas else 0)
