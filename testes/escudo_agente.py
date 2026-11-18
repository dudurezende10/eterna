# Proteção por IP (17/11): excesso de pedidos por minuto e robôs de varredura, com bloqueio que cresce e vale depois de reiniciar.
# Roda com HOME temporário:  python3 -I testes/escudo_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sys, threading, time
from http.server import ThreadingHTTPServer

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao               # para aqui se o HOME não for temporário
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


m.PROXY_IP = "127.0.0.1"            # o IP do aparelho vem no X-Real-IP, como atrás do nginx
m.ESCUDO_LIMITE = 20
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def pede(rota, ip=None, cookies=None, corpo=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
    if ip:
        h["X-Real-IP"] = ip
    if cookies:
        h["Cookie"] = "; ".join("%s=%s" % kv for kv in cookies.items())
    c.request("POST" if corpo is not None else "GET", rota, json.dumps(corpo) if corpo is not None else None, h)
    r = c.getresponse()
    r.read()
    st, ra = r.status, r.getheader("Retry-After")
    novos = {}
    for ck in r.msg.get_all("Set-Cookie") or []:
        k, _, v = ck.split(";")[0].partition("=")
        novos[k] = v
    c.close()
    return st, ra, novos


def libera(ip):
    with m.escudo_lock:
        m._escudo["bloq"].pop(ip, None)
        m._escudo["conta"].pop(ip, None)


# 1. excesso: o 21º pedido no minuto bloqueia 15 min; o vizinho segue
sts = [pede("/auth/eu", "10.0.0.5")[0] for _ in range(21)]
ok(all(x != 429 for x in sts[:20]) and sts[20] == 429, "1: 21º pedido: %s" % sts[-3:])
st, ra, _ = pede("/auth/eu", "10.0.0.5")
ok(st == 429 and 899 <= int(ra) <= 901, "1: bloqueado por 15 min: %s %s" % (st, ra))
ok(pede("/auth/eu", "10.0.0.6")[0] != 429, "1: outro IP segue")

# 2. repetiu: 1 hora
libera("10.0.0.5")
for _ in range(21):
    st, ra, _ = pede("/auth/eu", "10.0.0.5")
ok(st == 429 and 3599 <= int(ra) <= 3601, "2: segunda vez, 1 hora: %s %s" % (st, ra))

# 3. varredura: a 1ª isca passa (404), a 2ª bloqueia 1 dia, e aí nada passa
st1 = pede("/wp-login.php", "10.0.0.7")[0]
st2, ra, _ = pede("/.env", "10.0.0.7")
st3 = pede("/auth/eu", "10.0.0.7")[0]
ok(st1 != 403 and st2 == 403 and 86399 <= int(ra) <= 86401 and st3 == 403, "3: varredura: %s %s %s %s" % (st1, st2, ra, st3))
libera("10.0.0.7")
pede("/.git/config", "10.0.0.7")
st, ra, _ = pede("/phpmyadmin/", "10.0.0.7")
ok(st == 403 and int(ra) > 2 * 86400, "3: repetiu, 3 dias: %s %s" % (st, ra))
ok(pede("/vendor/ort/ort.min.js", "10.0.0.9")[0] != 403 and pede("/vendor/ort/ort.min.js", "10.0.0.9")[0] != 403, "3: arquivo do app não é isca")

# 4. conectado não é bloqueado por excesso
v = {"v": 2, "email": "caixa.um", "name": "Caixa", "active": True, "preset": "venda", "perms": {"venda": {"c": True, "r": True, "u": True, "d": False}}}
m.estado_gravar({"docs": [{"col": "usuarios", "id": "caixa.um", "valor": v}]})
ck = {"eterna_sessao": m.auth_sessao_nova("caixa.um")}
sts = [pede("/auth/eu", "10.0.0.8", {"eterna_sessao": ck.get("eterna_sessao")})[0] for _ in range(30)]
ok(429 not in sts, "4: conectado segue: %s" % sts[-3:])

# 4b. IP bloqueado por excesso (ex.: o firewall da VPN, que todos dividem): quem está conectado ainda entra; quem não está, não
libera("10.0.0.8")
for _ in range(21):
    st = pede("/auth/eu", "10.0.0.8")[0]
ok(st == 429, "4b: anônimo bloqueia o IP: %s" % st)
ok(pede("/auth/eu", "10.0.0.8", {"eterna_sessao": ck.get("eterna_sessao")})[0] != 429, "4b: conectado no mesmo IP segue")
ok(pede("/auth/eu", "10.0.0.8")[0] == 429, "4b: anônimo segue barrado")
ok(pede("/auth/eu", "10.0.0.7", {"eterna_sessao": ck.get("eterna_sessao")})[0] == 403, "4b: varredura barra até conectado")

# 5. o próprio servidor nunca
ok(all(pede("/auth/eu")[0] != 429 for _ in range(30)), "5: 127.0.0.1 sem limite")

# 6. vale depois de reiniciar, e fica no login_log
with m.escudo_lock:
    m._escudo.update(pronto=False, conta={}, isca={}, bloq={}, nivel={})
ok(pede("/auth/eu", "10.0.0.7")[0] == 403, "6: bloqueio lido do banco")
db = m.auth_db()
log = [a for (a,) in db.execute("select acao from login_log where acao like 'ip_bloqueado%'")]
db.close()
ok("ip_bloqueado:excesso:15min" in log and "ip_bloqueado:varredura:1440min" in log, "6: login_log: %s" % log)

srv.shutdown()
if falhas:
    print("FALHA escudo_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK escudo_agente: excesso 15 min e 1 h, varredura 1 e 3 dias, conectado e o próprio servidor livres, vale depois de reiniciar")
