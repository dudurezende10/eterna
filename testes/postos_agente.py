# Posto pareado: cookie próprio por aparelho, só o hash no banco, revogação e link de uso único do --parear-posto.
# Roda com HOME temporário:  python3 -I testes/postos_agente.py agente/eterna-agente.py
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
    st2, j2, ck2 = pede("/postos/parear", {"nome": "Caixa <2>"}, adm)          # clique repetido: o mesmo posto, sem criar outro
    ok(st2 == 200 and j2["posto"]["id"] == j["posto"]["id"] and ck2.split(";")[0] == cp, "pareamento repetido em seguida cria outro posto: %s" % j2)
    token = cp.split("=", 1)[1]
    st, j, _ = pede("/postos/eu", cookie=cp)
    ok(st == 200 and j.get("posto", {}).get("nome") == "Caixa 2", "/postos/eu com o cookie: %s %s" % (st, j))
    st, j, _ = pede("/postos/eu")
    ok(st == 401, "/postos/eu sem cookie: %s %s" % (st, j))
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
    # parear de novo o mesmo nome logo depois de revogar: posto novo, que responde em /postos/eu
    st, j, ck = pede("/postos/parear", {"nome": "Caixa <2>"}, adm)
    ok(st == 200 and j.get("posto", {}).get("id") not in (None, pid) and ck.split(";")[0] != cp, "parear depois de revogar devolveu o posto revogado: %s %s" % (st, j))
    st, j3, _ = pede("/postos/eu", cookie=ck.split(";")[0])
    ok(st == 200 and j3.get("posto", {}).get("id") == j.get("posto", {}).get("id"), "/postos/eu do posto pareado depois de revogar: %s %s" % (st, j3))
    # revogado por fora do /postos/revogar (direto no banco): o pareamento repetido também não reaproveita
    st, j, ck = pede("/postos/parear", {"nome": "Caixa Z"}, adm)
    pz = j.get("posto", {}).get("id")
    db = sqlite3.connect(m.ESTADO_DB)
    db.execute("update posto set revogado_em=? where id=?", (time.time(), pz))
    db.commit()
    db.close()
    st, j, ck = pede("/postos/parear", {"nome": "Caixa Z"}, adm)
    ok(st == 200 and j.get("posto", {}).get("id") not in (None, pz), "pareamento repetido reaproveitou posto revogado no banco: %s %s" % (st, j))
    st, j, _ = pede("/postos/eu", cookie=ck.split(";")[0])
    ok(st == 200, "/postos/eu depois de parear de novo: %s %s" % (st, j))
    # dois navegadores com o mesmo usuário (dois logins), mesmo nome em seguida: postos e cookies diferentes
    adm2 = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("admin-postos"))
    st, ja, cka = pede("/postos/parear", {"nome": "Caixa Dupla"}, adm)
    st2, jb, ckb = pede("/postos/parear", {"nome": "Caixa Dupla"}, adm2)
    ok(st == 200 and st2 == 200 and ja["posto"]["id"] != jb["posto"]["id"] and cka.split(";")[0] != ckb.split(";")[0],
       "dois logins do mesmo usuário receberam o mesmo posto: %s %s" % (ja, jb))
    st, jc, ckc = pede("/postos/parear", {"nome": "Caixa Dupla"}, adm)      # clique repetido no primeiro navegador
    ok(st == 200 and jc["posto"]["id"] == ja["posto"]["id"] and ckc.split(";")[0] == cka.split(";")[0], "clique repetido com o mesmo login: %s %s" % (ja, jc))
    st, jl, _ = pede("/postos", cookie=adm)
    num_max = max([p["num"] for p in jl.get("postos", [])] or [0])
    # CA4: link do --parear-posto vale uma vez e por 10 min
    saida = []
    m.print = lambda *a: saida.append(" ".join(str(x) for x in a))
    ok(m.posto_parear_cli("Checkout 1") == 0, "comando --parear-posto")
    del m.print
    link = saida[-1].strip()
    ok("/postos/aceitar?c=" in link, "link do comando: %s" % saida)
    rota = link[link.index("/postos/"):]
    codigo = rota.split("c=", 1)[1]
    for _ in range(2):                               # abrir o link (ou a prévia do WhatsApp) não gasta o código
        st, j, ck = pede(rota)
        ok(st == 200 and not ck and "Checkout 1" in j.get("html", "") and "method='post'" in j.get("html", ""), "GET do link mostra o botão sem parear: %s %s" % (st, ck))
    st, j, ck = pede("/postos/aceitar", form="c=" + codigo, extra={"X-Eterna": ""})
    ok(st == 200 and ck.startswith("eterna_posto=") and "Checkout 1" in j.get("html", ""), "botão do link pareia: %s %s" % (st, ck))
    st, j, _ = pede("/postos/eu", cookie=ck.split(";")[0])
    ok(st == 200 and j["posto"]["nome"] == "Checkout 1" and j["posto"]["num"] == num_max + 1, "posto do link: %s %s" % (st, j))
    st, j, ck2 = pede("/postos/aceitar", form="c=" + codigo)
    ok(st == 410 and not ck2, "link usado de novo deveria dar 410: %s" % st)
    ok(pede(rota)[0] == 410, "GET do link usado: 410")
    cod = m.posto_convite_novo("Velho")
    db = sqlite3.connect(m.ESTADO_DB)
    db.execute("update posto_convite set expira=? where hash=?", (time.time() - 1, m._sha(cod)))
    db.commit()
    db.close()
    st, j, _ = pede("/postos/aceitar?c=" + cod)
    ok(st == 410, "link com mais de 10 min deveria dar 410: %s" % st)
    ok(pede("/postos/aceitar", form="c=" + cod)[0] == 410, "POST de link vencido: 410")
    cod2 = m.posto_convite_novo("Origem")
    ok(pede("/postos/aceitar", form="c=" + cod2, extra={"Origin": "https://evil.example"})[0] == 403, "POST do link vindo de outro site: 403")
    ok(m.posto_convite_ver(cod2) == "Origem", "o código recusado por origem continua valendo")
    # endereço com certificado (posto.eterna.photo atrás de um proxy que repassa Host e X-Forwarded-Proto: https)
    PX = {"Host": "posto.eterna.photo", "Origin": "https://posto.eterna.photo", "X-Forwarded-Proto": "https"}
    st, j, ck = pede("/postos/parear", {"nome": "Tablet HTTPS"}, adm, extra=PX)
    ok(st == 200 and "; Secure" in ck, "parear pelo endereço com certificado: cookie Secure: %s %s" % (st, ck))
    cs = ck.split(";")[0]
    st, j, _ = pede("/sessoes", cookie=cs, extra=PX)
    ok(st == 200, "posto pelo endereço com certificado lê as sessões: %s %s" % (st, j))
    st, j, _ = pede("/status", cookie=cs, extra=PX)
    ok(st == 200 and "sessoes" in j, "/status completo pelo endereço com certificado")
    st, j, _ = pede("/ponto/eventos", {"eventos": []}, cs, extra=dict(PX, Origin="https://evil.example"))
    ok(st == 403, "Origin de fora no endereço com certificado: %s" % st)
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    c.request("GET", "/postos/eu", headers={"Host": "evil.example:%d" % m.PORT, "Cookie": cp})
    ok(c.getresponse().status == 403, "Host de fora deveria dar 403")
    c.close()
    # Posto automático (revisão do Eduardo, 10/11): só na faixa ETERNA_POSTO_REDE, só Admin, 3 por dia, cai com a remoção da pessoa
    import ipaddress
    rede = [ipaddress.ip_network("192.168.10.0/24")]
    ok(m.posto_auto_ok("192.168.10.50", "192.168.10.178", rede), "aparelho da rede do ponto deveria poder virar posto")
    ok(not m.posto_auto_ok("192.168.10.178", "192.168.10.178", rede), "o próprio servidor não vira posto")
    ok(not m.posto_auto_ok("192.168.20.5", "", rede), "IP fora da faixa não vira posto")
    ok(not m.posto_auto_ok("100.115.186.26", "", rede), "Tailscale não vira posto")
    ok(not m.posto_auto_ok("192.168.10.50", "", []), "ETERNA_POSTO_REDE vazia desliga o automático")
    os.environ.pop("ETERNA_POSTO_REDE", None)
    ok(not m.posto_auto_ok("192.168.10.50", ""), "sem ETERNA_POSTO_REDE o automático fica desligado")
    st, j, ck = pede("/postos/eu", cookie=foto)            # 127.0.0.1 = loopback: acesso remoto, sem posto e sem bloquear
    ok(st == 200 and j.get("remoto") and not ck, "fora da rede do ponto: remoto sem posto: %s %s" % (st, j))
    real = m.posto_auto_ok
    m.posto_auto_ok = lambda ip, srv="", redes=None: True  # simula um aparelho da rede do ponto
    try:
        st, j, ck = pede("/postos/eu", cookie=foto)
        ok(st == 401 and j.get("erro") == "sem_posto" and not ck, "perfil sem configuracao.u virou posto automático: %s %s %s" % (st, j, ck))
        auto = S.cookie_sessao(m, "admin-auto")
        st, j, ck = pede("/postos/eu", cookie=auto, extra={"User-Agent": "Chrome do posto teste"})
        ok(st == 200 and j.get("posto", {}).get("auto") and ck.startswith("eterna_posto=") and "Max-Age=2592000" in ck,
           "Admin na rede do ponto deveria virar posto de 30 dias: %s %s %s" % (st, j, ck))
        pa, cpa = j.get("posto", {}).get("id"), ck.split(";")[0]
        st, j, ck = pede("/postos/eu", cookie=cpa)
        ok(st == 200 and j.get("posto", {}).get("id") == pa and "Max-Age=2592000" in ck, "uso do posto automático renova o cookie: %s %s" % (j, ck))
        db = sqlite3.connect(m.ESTADO_DB)
        lg = db.execute("select acao, por from login_log where usuario=?", ("posto:" + pa,)).fetchone()
        db.close()
        ok(lg and lg[1] == "auto:admin-auto" and "Chrome do posto teste" in lg[0], "auditoria do posto automático: %s" % (lg,))
        for i in range(3):                                     # janela anônima repetida: novo login a cada vez
            ck_i = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("admin-auto"))
            st, j, _ = pede("/postos/eu", cookie=ck_i)
            ok(st == (200 if i < 2 else 429), "teto de 3 postos automáticos por dia, tentativa %d: %s %s" % (i + 2, st, j))
        db = sqlite3.connect(m.ESTADO_DB)                      # 30 dias sem uso: não vale mais
        db.execute("update posto set ultimo_uso=? where id=?", (time.time() - 31 * 86400, pa))
        db.commit()
        db.close()
        m.posto_uso.pop(pa, None)
        st, j, _ = pede("/postos/eu", cookie=cpa)
        ok(st == 401, "posto automático parado há 31 dias ainda vale: %s %s" % (st, j))
        m.auth_remover("admin-auto", "teste")
        db = sqlite3.connect(m.ESTADO_DB)
        vivos = db.execute("select count(*) from posto where criado_por='auto:admin-auto' and revogado_em is null").fetchone()[0]
        db.close()
        ok(vivos == 0, "postos de quem foi removido continuam valendo: %d" % vivos)
    finally:
        m.posto_auto_ok = real
except Exception as ex:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-400:])
print(("OK" if not falhas else "FALHA") + " postos_agente: parear, hash no banco, revogar, link de uso único" + ("" if not falhas else " · " + " | ".join(falhas[:8])))
sys.exit(1 if falhas else 0)
