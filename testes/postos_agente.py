# Posto pareado: cookie próprio por aparelho, só o hash no banco, revogação e link de uso único do --parear-posto.
# Roda com HOME temporário:  python3 -I testes/postos_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

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


def pede(rota, corpo=None, cookie=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
    if cookie:
        h["Cookie"] = cookie
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


try:
    adm = S.cookie_sessao(m, "admin-postos")
    foto = S.cookie_sessao(m, "foto-postos", {"set": {"r": True, "c": True}, "configuracao": {"r": True}})
    # CA1: sem sessão 401; sem configuracao.u 403; com: 200 e cookie HttpOnly, SameSite=Strict
    st, j, ck = pede("/postos/parear", {"nome": "Caixa 2"})
    ok(st == 401 and not ck, "parear sem sessão deveria dar 401: %s %s" % (st, j))
    st, j, ck = pede("/postos/parear", {"nome": "Caixa 2"}, foto)
    ok(st == 403 and not ck, "parear sem configuracao.u deveria dar 403: %s %s" % (st, j))
    st, j, ck = pede("/postos/parear", {"nome": "Caixa <2>"}, adm)
    ok(st == 200 and j.get("posto", {}).get("nome") == "Caixa 2" and j["posto"].get("num") == 1 and j["posto"]["id"].startswith("p_"), "parear com admin: %s %s" % (st, j))
    ok(ck.startswith("eterna_posto=") and "HttpOnly" in ck and "SameSite=Strict" in ck and "Max-Age=34560000" in ck, "cookie do posto: %s" % ck)
    cp = ck.split(";")[0]
    token = cp.split("=", 1)[1]
    st, j, _ = pede("/postos/eu", cookie=cp)
    ok(st == 200 and j.get("posto", {}).get("nome") == "Caixa 2", "/postos/eu com o cookie: %s %s" % (st, j))
    st, j, _ = pede("/postos/eu")
    ok(st == 401 and j.get("erro") == "sem_posto", "/postos/eu sem cookie: %s %s" % (st, j))
    st, j, _ = pede("/postos/parear", {"nome": "  "}, adm)
    ok(st == 400, "nome vazio: %s" % st)
    # lista: configuracao.r, sem hash
    st, j, _ = pede("/postos")
    ok(st == 401, "lista sem sessão: %s" % st)
    st, j, _ = pede("/postos", cookie=foto)
    ok(st == 200 and len(j.get("postos", [])) == 1 and "hash" not in j["postos"][0] and j["postos"][0]["criado_por"] == "admin-postos", "lista: %s %s" % (st, j))
    # CA2: o banco nunca tem o token em claro
    raw = open(m.ESTADO_DB, "rb").read() + b"".join(open(m.ESTADO_DB + x, "rb").read() for x in ("-wal",) if os.path.exists(m.ESTADO_DB + x))
    ok(token.encode() not in raw, "token do posto em claro no estado.db")
    # CA3: revogado -> 401 na próxima chamada
    pid = j["postos"][0]["id"]
    st, j, _ = pede("/postos/revogar", {"id": pid}, foto)
    ok(st == 403, "revogar sem configuracao.u: %s" % st)
    st, j, _ = pede("/postos/revogar", {"id": pid}, adm)
    ok(st == 200, "revogar: %s %s" % (st, j))
    st, j, _ = pede("/postos/eu", cookie=cp)
    ok(st == 401, "posto revogado ainda responde: %s" % st)
    st, j, _ = pede("/postos/revogar", {"id": pid}, adm)
    ok(st == 404, "revogar de novo: %s" % st)
    # CA4: link do --parear-posto vale uma vez e por 10 min
    saida = []
    m.print = lambda *a: saida.append(" ".join(str(x) for x in a))
    ok(m.posto_parear_cli("Checkout 1") == 0, "comando --parear-posto")
    del m.print
    link = saida[-1].strip()
    ok("/postos/aceitar?c=" in link, "link do comando: %s" % saida)
    rota = link[link.index("/postos/"):]
    st, j, ck = pede(rota)
    ok(st == 200 and ck.startswith("eterna_posto=") and "Checkout 1" in j.get("html", ""), "link de pareamento: %s %s" % (st, ck))
    st, j, _ = pede("/postos/eu", cookie=ck.split(";")[0])
    ok(st == 200 and j["posto"]["num"] == 2, "posto do link: %s %s" % (st, j))
    st, j, ck2 = pede(rota)
    ok(st == 410 and not ck2, "link usado de novo deveria dar 410: %s" % st)
    cod = m.posto_convite_novo("Velho")
    db = sqlite3.connect(m.ESTADO_DB)
    db.execute("update posto_convite set expira=? where hash=?", (time.time() - 1, m._sha(cod)))
    db.commit()
    db.close()
    st, j, _ = pede("/postos/aceitar?c=" + cod)
    ok(st == 410, "link com mais de 10 min deveria dar 410: %s" % st)
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    c.request("GET", "/postos/eu", headers={"Host": "evil.example:%d" % m.PORT, "Cookie": cp})
    ok(c.getresponse().status == 403, "Host de fora deveria dar 403")
    c.close()
except Exception as ex:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-400:])
print(("OK" if not falhas else "FALHA") + " postos_agente: parear, hash no banco, revogar, link de uso único" + ("" if not falhas else " · " + " | ".join(falhas[:8])))
sys.exit(1 if falhas else 0)
