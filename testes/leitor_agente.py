# 18/11: leitor de cartão do gramado, lado do servidor (rotas /leitor/* e /leitores*), com o agente de verdade no mesmo processo.
# Critérios 3 a 14 do plano docs/planos/2026-11-18-leitor-cartao-gramado.md, mais a resposta reduzida de /leitores (27), a situação
# Ligado/Desligado (26), o limite da ativação e o preflight sem Authorization (risco S5).
# Roda sozinho (testes/rodar.sh):  HOME=<temporário> python3 -I testes/leitor_agente.py agente/eterna-agente.py
# HOME temporário, porta 45xxx, ETERNA_SEM_OPENCV=1. Só JPEGs lisos gerados aqui (nunca foto de cliente).
import hashlib, http.client, importlib.util, io, json, os, random, socket, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
from urllib.parse import quote
from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_LEITOR_REDES", "ETERNA_POSTO_REDE", "ETERNA_PROXY_IP", "ETERNA_ORIGENS", "ETERNA_TESTE_CARGA"):
    os.environ.pop(k, None)
CONSOLE = io.StringIO()
SAIDA_REAL = sys.stdout
sys.stdout = CONSOLE                         # tudo o que o agente escreve no console fica aqui (o token nunca pode aparecer)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


if True:
    sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
m.FOTO_ENVIO_PISO_GB = 0.2                 # o disco do teste pode ter pouco espaço livre
m.PROXY_IP = "127.0.0.1"                   # como atrás do nginx: o IP do aparelho vem do X-Real-IP


def porta_45():
    for _ in range(200):
        p = random.randint(45000, 45999)
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
        finally:
            s.close()
    raise SystemExit("FALHA leitor_agente: sem porta livre em 45xxx")


P = porta_45()
srv = ThreadingHTTPServer(("127.0.0.1", P), m.H)
m.PORT = P
m.HOSTS_OK |= {"127.0.0.1:%d" % P, "localhost:%d" % P}
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % P


def jpeg(lado=(320, 240)):
    im = Image.new("RGB", lado, tuple(random.randint(30, 220) for _ in range(3)))
    for _ in range(60):
        r = os.urandom(5)
        im.putpixel((int.from_bytes(r[:2], "big") % lado[0], int.from_bytes(r[2:4], "big") % lado[1]), (r[0], r[1], r[4]))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=85)
    return b.getvalue()


def pede(metodo, rota, corpo=None, cab=None, ip=None, sem=()):
    c = http.client.HTTPConnection("127.0.0.1", P, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1"}
    if ip:                                   # como o nginx: IP do aparelho e HTTPS
        h["X-Real-IP"] = ip
        h["X-Forwarded-Proto"] = "https"
    if isinstance(corpo, (dict, list)):
        corpo = json.dumps(corpo).encode()
        h["Content-Type"] = "application/json"
    h.update(cab or {})
    for k in sem:
        h.pop(k, None)
    try:
        c.request(metodo, rota, corpo, h)
        r = c.getresponse()
        b = r.read()
        hs = {k.lower(): v for k, v in r.getheaders()}
        try:
            return r.status, json.loads(b), hs
        except ValueError:
            return r.status, None, hs
    finally:
        c.close()


def foto(tok, dados, nome="IMG_0001.JPG", rotulo="EOS_DIGITAL", cab=None, sha=None, ip=None, sem=()):
    p = os.path.join(os.environ["HOME"], "qh.tmp")
    with open(p, "wb") as f:
        f.write(dados)
    qh = m.quick_hash(p, len(dados))
    os.remove(p)
    h = {"Content-Type": "image/jpeg", "X-Eterna-Hash": qh, "X-Eterna-Sha256": sha or hashlib.sha256(dados).hexdigest()}
    if tok:
        h["Authorization"] = "Bearer " + tok
    h.update(cab or {})
    st, j, _ = pede("POST", "/leitor/foto?nome=%s&rotulo=%s" % (quote(nome), quote(rotulo)), dados, h, ip=ip, sem=sem)
    return st, j, qh


def pulso(tok, extra=None, ip=None):
    b = {"v": 1, "versao": "2026-11-18", "maquina": "GRAMADO-1", "livre_gb": 120, "fila": {"n": 34, "mb": 510, "parada_s": 0},
         "cartao": {"rotulo": "EOS_DIGITAL", "estado": "lendo", "total": 340, "copiadas": 40, "ja_tinha": 300, "enviadas": 6, "sem_dono": 0, "em": int(time.time())},
         "erro": None}
    b.update(extra or {})
    return pede("POST", "/leitor/pulso", b, {"Authorization": "Bearer " + tok}, ip=ip)


try:
    if True:
        adm = S.cookie_sessao(m, "admin-leitor")
        cfg_r = S.cookie_sessao(m, "so-ver-config", {"configuracao": {"r": True}})
        fot = S.cookie_sessao(m, "fotografo-leitor", {"set": {"r": True, "c": True}})
        posto = S.cookie_posto(m, "Checkout do teste")
        # login carlos e klassius no FTP: são fotógrafos cadastrados
        with open(m.FTPCFG, "w") as f:
            json.dump({"users": {"carlos": "x" * 12, "klassius": "y" * 12}, "compartilhado": []}, f)

    # ---------- 3: cadastrar ----------
    st, j, _ = pede("POST", "/leitores/criar", {"nome": "Gramado 1"}, {"Cookie": cfg_r})
    ok(st == 403, "3: cadastrar só com configuracao.r: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitores/criar", {"nome": "Gramado 1"}, {"Cookie": fot})
    ok(st == 403, "3: cadastrar como fotógrafo: %s" % st)
    st, j, _ = pede("POST", "/leitores/criar", {"nome": "Gramado 1"}, {"Cookie": adm})
    ok(st == 200 and j["leitor"]["nome"] == "Gramado 1" and len(j["codigo"].replace("-", "")) == 20 and j["expira"] > time.time() + 500,
       "3: cadastrar com configuracao.u: %s %s" % (st, j))
    LID, COD = j["leitor"]["id"], j["codigo"]
    # ---------- 4: nome de fotógrafo, apelido ou repetido ----------
    for n in ("Carlos", "Klacius", "klassius", "gramado 1", "GRAMADO 1"):
        st, j, _ = pede("POST", "/leitores/criar", {"nome": n}, {"Cookie": adm})
        ok(st == 400 and j.get("erro") == "nome", "4: nome %r aceito: %s %s" % (n, st, j))

    # ---------- 5: código de uso único, 10 min, só o hash no banco ----------
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": COD.lower().replace("-", " "), "maquina": "GRAMADO-1"}, ip="192.168.10.50")
    ok(st == 200 and j.get("id") == LID and len(j.get("token", "")) == 43, "5: ativar: %s %s" % (st, {k: v for k, v in (j or {}).items() if k != "token"}))
    TOK = j["token"]
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": COD, "maquina": "OUTRO"}, ip="192.168.10.51")
    ok(st == 404 and j == {"erro": "codigo"}, "5: segunda ativação: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitores/codigo", {"id": LID}, {"Cookie": adm})
    ok(st == 200 and j.get("codigo"), "5: novo código: %s" % st)
    db = sqlite3.connect(os.path.join(m.HOME, "ponto", "estado.db"))
    db.execute("update leitor_convite set expira=? where usado is null", (time.time() - 1,))
    db.commit()
    st, j2, _ = pede("POST", "/leitor/ativar", {"codigo": j["codigo"]}, ip="192.168.10.52")
    ok(st == 404 and j2 == {"erro": "codigo"}, "5: código vencido: %s %s" % (st, j2))
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": "AAAA-BBBB-CCCC-DDDD-EEEE"}, ip="192.168.10.53")
    ok(st == 404 and j == {"erro": "codigo"}, "5: código inválido: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": COD}, ip="203.0.113.9")
    ok(st == 403 and j == {"erro": "rede"}, "5: ativar de fora da rede: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": COD}, {"Origin": "http://" + HOST})
    ok(st == 403 and j == {"erro": "origem"}, "5: ativar com Origin: %s %s" % (st, j))
    linhas = db.execute("select hash from leitor where id=?", (LID,)).fetchall()
    ok(linhas == [(hashlib.sha256(TOK.encode()).hexdigest(),)], "5: no banco não está só o SHA-256 do token")
    tudo = "\n".join(str(r) for t in ("leitor", "leitor_convite", "login_log") for r in db.execute("select * from %s" % t))
    ok(TOK not in tudo and COD not in tudo and COD.replace("-", "") not in tudo, "5: token ou código em claro no banco")
    log = [r[2] for r in db.execute("select * from login_log where usuario=?", ("leitor:" + LID,))]
    ok(log[:3] == ["leitor_criado", "leitor_ativado GRAMADO-1", "leitor_codigo"], "5: auth_log do leitor: %s" % log)

    # ---------- 6: sem token, token errado, Origin, sem X-Eterna ----------
    J1 = jpeg()
    ok(foto(None, J1)[0] == 401, "6: foto sem token")
    ok(foto("x" * 43, J1)[0] == 401, "6: foto com token errado")
    st, j, _ = foto(TOK, J1, cab={"Origin": "http://" + HOST})
    ok(st == 403 and j == {"erro": "origem"}, "6: foto com Origin: %s %s" % (st, j))
    st, j, _ = foto(TOK, J1, sem=("X-Eterna",))
    ok(st == 403, "6: foto sem X-Eterna: %s" % st)
    # ---------- 7: rede ----------
    st, j, _ = foto(TOK, J1, ip="203.0.113.7")
    ok(st == 403 and j == {"erro": "rede"}, "7: IP de fora: %s %s" % (st, j))
    st, j, _ = pulso(TOK, ip="192.168.10.1")
    ok(st == 200, "7: VPN (192.168.10.1) com o padrão: %s %s" % (st, j))
    os.environ["ETERNA_LEITOR_REDES"] = "10.9.0.0/16"
    ok(pulso(TOK, ip="192.168.10.1")[0] == 403 and pulso(TOK, ip="10.9.3.4")[0] == 200, "7: ETERNA_LEITOR_REDES")
    del os.environ["ETERNA_LEITOR_REDES"]
    os.environ["ETERNA_POSTO_REDE"] = "172.20.0.0/24"
    ok(pulso(TOK, ip="172.20.0.9")[0] == 200 and pulso(TOK, ip="192.168.10.1")[0] == 403, "7: vazia vale ETERNA_POSTO_REDE")
    del os.environ["ETERNA_POSTO_REDE"]
    st, j, _ = pulso(TOK, ip="192.168.10.1", )
    ok(st == 200, "7: pelo proxy com HTTPS: %s" % st)
    st, j, _ = pede("POST", "/leitor/pulso", {"v": 1}, {"Authorization": "Bearer " + TOK, "X-Real-IP": "192.168.10.1"})
    ok(st == 403 and j == {"erro": "origem"}, "7: pelo proxy sem X-Forwarded-Proto: https: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitor/pulso", {"v": 1}, {"Authorization": "Bearer " + TOK, "X-Real-IP": "192.168.10.1", "X-Forwarded-Proto": "http"})
    ok(st == 403 and j == {"erro": "origem"}, "7: pelo proxy em http: %s %s" % (st, j))
    st, j, _ = pulso(TOK, ip="127.0.0.1")
    ok(st == 403 and j == {"erro": "rede"}, "7: loopback vindo do proxy: %s %s" % (st, j))
    st, j, _ = pede("POST", "/leitor/pulso", {"v": 1}, {"Authorization": "Bearer " + TOK, "X-Forwarded-Proto": "https"})
    ok(st == 403 and j == {"erro": "origem"}, "7: direto com cabeçalho do proxy: %s %s" % (st, j))
    m.PROXY_IP = ""                          # sem proxy configurado: X-Real-IP não vale e o pedido é direto
    st, j, _ = pulso(TOK, ip="192.168.10.1")
    ok(st == 403 and j == {"erro": "origem"}, "7: direto (fora do proxy) com X-Real-IP: %s %s" % (st, j))
    ok(pulso(TOK)[0] == 200, "7: o próprio servidor direto, sem cabeçalhos do proxy")
    m.PROXY_IP = "127.0.0.1"
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": COD}, {"X-Real-IP": "192.168.10.70"})
    ok(st == 403 and j == {"erro": "origem"}, "7: ativar pelo proxy sem HTTPS: %s %s" % (st, j))
    m._janelas.clear()
    # ---------- 8: cookie de pessoa ou de posto não abre /leitor/* ----------
    for ck in (adm, posto):
        for rota, corpo in (("/leitor/pulso", {"v": 1}), ("/leitor/tem", {"h": []})):
            st, j, _ = pede("POST", rota, corpo, {"Cookie": ck})
            ok(st == 401 and j == {"erro": "sem_leitor"}, "8: %s com cookie: %s %s" % (rota, st, j))
        st, j, _ = foto(None, J1, cab={"Cookie": ck})
        ok(st == 401, "8: /leitor/foto com cookie: %s" % st)
    # S5: o preflight não libera Authorization nem a origem
    c = http.client.HTTPConnection("127.0.0.1", P, timeout=10)
    c.request("OPTIONS", "/leitor/foto", headers={"Host": HOST, "Origin": "http://" + HOST, "Access-Control-Request-Headers": "authorization"})
    hs = {k.lower(): v for k, v in c.getresponse().getheaders()}
    c.close()
    ok("access-control-allow-origin" not in hs and "authorization" not in hs.get("access-control-allow-headers", "").lower(), "S5: preflight de /leitor/foto: %s" % hs)

    # ---------- 9: foto nova entra como cartão, com o leitor ----------
    st, j, qh = foto(TOK, J1, nome="IMG_0001.JPG", rotulo="EOS_DIGITAL")
    ok(st == 200 and j == {"ok": True, "resultado": "new", "dono": False}, "9: foto nova: %s %s" % (st, j))
    pid = qh[:12]
    mm = m.meta.get(pid) or {}
    ok(mm.get("s") == "cartao" and mm.get("o") == "EOS_DIGITAL" and mm.get("ap") == "Gramado 1" and mm.get("api") == LID, "9: meta: %s" % mm)
    st, j, _ = pede("GET", "/events?since=0", cab={"Cookie": adm})
    ev = [e for e in j["events"] if e.get("id") == pid and e["type"] == "photo"]
    ok(len(ev) == 1 and ev[0]["src"] == "cartao" and ev[0]["card"] == "EOS_DIGITAL" and ev[0]["ap"] == "Gramado 1", "9: /events: %s" % ev)
    st, j, _ = pede("GET", "/sessoes?desde=0", cab={"Cookie": adm})
    ok(st == 200 and pid in json.dumps(j), "9: a foto do leitor não aparece em /sessoes")
    # rótulo que é um fotógrafo cadastrado: a foto tem dono (a mesma regra do cartão lido no servidor)
    st, j, _ = foto(TOK, jpeg(), nome="IMG_0002.JPG", rotulo="CARLOS")
    ok(st == 200 and j.get("resultado") == "new" and j.get("dono") is True, "9: rótulo do fotógrafo dá dono: %s" % j)
    # ---------- 10: repetida e apagada pela LGPD ----------
    n_ev = len(m.events)
    st, j, _ = foto(TOK, J1)
    ok(st == 200 and j == {"ok": True, "resultado": "dup", "dono": False} and len([e for e in m.events[n_ev:] if e["type"] == "photo"]) == 0, "10: repetida: %s" % j)
    J3 = jpeg()
    p = os.path.join(os.environ["HOME"], "x.tmp")
    open(p, "wb").write(J3)
    h3 = m.quick_hash(p, len(J3))
    os.remove(p)
    m.lgpd_excluidas.add(h3)
    st, j, _ = foto(TOK, J3)
    ok(st == 200 and j == {"ok": True, "resultado": "dup", "dono": False} and h3[:12] not in m.lib, "10: apagada pela LGPD responde como repetida: %s" % j)
    # vagas e teto do dia próprios dos leitores (o envio pela tela cheio não segura o leitor, e vice-versa)
    for _ in range(m.FOTO_ENVIO_SIMULT):
        m.envio_sem.acquire()
    st, j, _ = foto(TOK, jpeg(), nome="IMG_0005.JPG")
    ok(st == 200 and j.get("resultado") == "new", "vagas próprias: envio pela tela cheio segurou o leitor: %s %s" % (st, j))
    for _ in range(m.FOTO_ENVIO_SIMULT):
        m.envio_sem.release()
    for _ in range(m.LEITOR_VAGAS_TOTAL):
        m.leitor_sem.acquire()
    st, j, _ = foto(TOK, jpeg(), nome="IMG_0006.JPG")
    ok(st == 503 and j == {"erro": "ocupado"}, "vagas dos leitores cheias: %s %s" % (st, j))

    def grande(cab_extra=""):
        """Foto de 8 MB mandada inteira por socket: o agente lê e descarta o corpo antes de recusar, e a resposta chega."""
        s = socket.create_connection(("127.0.0.1", P), 30)
        corpo = os.urandom(8 * 1024 * 1024)
        s.sendall(("POST /leitor/foto?nome=IMG_0008.JPG&rotulo=X HTTP/1.1\r\nHost: %s\r\nX-Eterna: 1\r\nAuthorization: Bearer %s\r\nContent-Type: image/jpeg\r\n"
                   "Content-Length: %d\r\nX-Eterna-Hash: %s\r\nX-Eterna-Sha256: %s\r\n%s\r\n" % (HOST, TOK, len(corpo), "a" * 64, "b" * 64, cab_extra)).encode())
        try:
            s.sendall(corpo)
            enviou = True
        except OSError:
            enviou = False
        s.settimeout(20)
        resp = b""
        while True:
            try:
                ch = s.recv(65536)
            except OSError:
                break
            if not ch:
                break
            resp += ch
        s.close()
        return enviou, resp.decode(errors="replace")
    enviou, resp = grande()
    ok(enviou and " 503 " in resp.split("\r\n")[0] and '"ocupado"' in resp, "1 (segurança): 503 com o corpo inteiro lido: %s %s" % (enviou, resp[:60]))
    for _ in range(m.LEITOR_VAGAS_TOTAL):
        m.leitor_sem.release()
    n_env = m.envio_dia_n()
    teto0 = m.LEITOR_TETO_DIA
    m.LEITOR_TETO_DIA = m.leitor_dia_n()
    st, j, _ = foto(TOK, jpeg(), nome="IMG_0007.JPG")
    ok(st == 429 and j == {"erro": "teto_dia"}, "teto do dia do leitor: %s %s" % (st, j))
    enviou, resp = grande()
    ok(enviou and " 429 " in resp.split("\r\n")[0] and '"teto_dia"' in resp, "1 (segurança): 429 com o corpo inteiro lido: %s %s" % (enviou, resp[:60]))
    m.LEITOR_TETO_DIA = teto0
    ok(m.leitor_dia_n() == 3 and m.envio_dia_n() == n_env == 0, "o leitor conta no próprio teto: leitor %s, envio %s" % (m.leitor_dia_n(), m.envio_dia_n()))
    # ---------- 11: SHA-256 diferente ----------
    J4 = jpeg()
    st, j, qh4 = foto(TOK, J4, sha="0" * 64)
    ok(st == 400 and j == {"erro": "hash"} and qh4 not in m.seen and qh4[:12] not in m.lib, "11: sha diferente: %s %s" % (st, j))
    st, j, _ = foto(TOK, J4, cab={"X-Eterna-Hash": "f" * 64})
    ok(st == 400 and j == {"erro": "hash"} and qh4 not in m.seen, "11: quick_hash diferente: %s %s" % (st, j))
    st, j, _ = foto(TOK, J4, cab={"X-Eterna-Hash": "abc"})
    ok(st == 400 and j == {"erro": "hash"}, "11: hash fora do formato: %s" % st)
    st, j, _ = foto(TOK, J4, rotulo="<x>")
    ok(st == 400 and j == {"erro": "rotulo"}, "rótulo fora do formato: %s %s" % (st, j))
    # ---------- 12: não JPEG, grande demais, limite ----------
    st, j, _ = foto(TOK, b"texto que nao e foto" * 100)
    ok(st == 415, "12: não JPEG: %s %s" % (st, j))
    st, j, _ = foto(TOK, J4, cab={"Content-Type": "image/png"})
    ok(st == 415, "12: Content-Type: %s" % st)
    s = socket.create_connection(("127.0.0.1", P), 10)
    s.sendall(("POST /leitor/foto?nome=IMG_9.JPG&rotulo=X HTTP/1.1\r\nHost: %s\r\nX-Eterna: 1\r\nAuthorization: Bearer %s\r\nContent-Type: image/jpeg\r\n"
               "Content-Length: %d\r\nX-Eterna-Hash: %s\r\nX-Eterna-Sha256: %s\r\n\r\n" % (HOST, TOK, 61 * 1024 * 1024, "a" * 64, "b" * 64)).encode())
    s.settimeout(10)
    resp = s.recv(4096).decode(errors="replace")
    s.close()
    ok(" 413 " in resp.split("\r\n")[0], "12: 61 MB sem mandar o corpo: %s" % resp[:40])
    for _ in range(m.LEITOR_FOTO_TAXA):
        m.limite_ok("leitor:" + LID, "leitor_foto", m.LEITOR_FOTO_TAXA)
    st, j, _ = foto(TOK, jpeg())
    ok(st == 429 and j == {"erro": "taxa"}, "12: 301ª foto no minuto: %s %s" % (st, j))
    m._janelas.clear()
    # ---------- 13: /leitor/tem ----------
    st, j, _ = pede("POST", "/leitor/tem", {"h": [qh, h3, qh4, "e" * 64]}, {"Authorization": "Bearer " + TOK})
    ok(st == 200 and sorted(j["tem"]) == sorted([qh, h3]), "13: tem: %s" % j)
    ok(pede("POST", "/leitor/tem", {"h": ["a" * 64] * 501}, {"Authorization": "Bearer " + TOK})[0] == 400, "13: mais de 500 hashes")
    ok(pede("POST", "/leitor/tem", {"h": ["A" * 64]}, {"Authorization": "Bearer " + TOK})[0] == 400, "13: hash fora do formato")
    ok(pede("POST", "/leitor/tem", {"h": "x"}, {"Authorization": "Bearer " + TOK})[0] == 400, "13: corpo fora do formato")
    # ---------- pulso, situação (26) e resposta reduzida (27) ----------
    ok(pulso(TOK, {"extra": 1})[0] == 400 and pulso(TOK, {"erro": "outro"})[0] == 400 and pulso(TOK, {"fila": {"n": -1, "mb": 0}})[0] == 400, "pulso fora do formato aceito")
    m._janelas.clear()
    st, j, _ = pulso(TOK)
    ok(st == 200 and j.get("ok"), "pulso: %s" % j)
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": adm})
    lt = (j or {}).get("leitores", [{}])[0]
    ok(lt.get("situacao") == "ligado" and lt.get("cartao", {}).get("copiadas") == 40 and lt.get("versao") == "2026-11-18" and lt.get("maquina") == "GRAMADO-1",
       "/leitores completo: %s" % lt)
    m.leitores_pulso.clear()                  # agente reiniciado: a fila vem do banco
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": adm})
    ok((j["leitores"][0].get("fila") or {}).get("n") == 34 and j["leitores"][0]["situacao"] == "desligado", "fila guardada no banco: %s" % j["leitores"][0])
    pulso(TOK)
    m.leitores_pulso[LID]["em"] -= 91
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": adm})
    ok(j["leitores"][0]["situacao"] == "desligado", "26: sem pulso há 91 s continua %s" % j["leitores"][0]["situacao"])
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": fot})
    lt = (j or {}).get("leitores", [{}])[0]
    proib = {"ip_ultimo", "maquina", "versao", "criado_por", "livre_gb", "criado_em", "ativado_em"}
    ok(st == 200 and lt.get("nome") == "Gramado 1" and not proib & set(lt) and set(lt.get("cartao") or {}) <= {"rotulo", "estado", "em", "total", "copiadas"},
       "27: /leitores para o fotógrafo: %s" % lt)
    ok(pede("GET", "/leitores", cab={"Cookie": S.cookie_sessao(m, "sem-nada", {})})[0] == 403, "/leitores sem módulo")
    # ---------- 14: revogado ----------
    st, j, _ = pede("POST", "/leitores/revogar", {"id": LID}, {"Cookie": adm})
    ok(st == 200, "14: revogar: %s" % st)
    ok(pulso(TOK)[0] == 401 and foto(TOK, jpeg())[0] == 401, "14: depois de revogar")
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": fot})
    ok(j.get("leitores") == [], "27: revogado aparece para o fotógrafo: %s" % j)
    st, j, _ = pede("GET", "/leitores", cab={"Cookie": adm})
    ok(j["leitores"][0]["situacao"] == "revogado" and (j["leitores"][0].get("fila") or {}).get("n") == 34, "14: depois de revogar (situação e fila guardada): %s" % j["leitores"][0])
    ok(pede("POST", "/leitores/codigo", {"id": LID}, {"Cookie": adm})[0] == 404, "14: novo código para leitor desativado")
    # ativar de novo derruba o token anterior
    st, j, _ = pede("POST", "/leitores/criar", {"nome": "Gramado 1"}, {"Cookie": adm})
    ok(st == 200, "nome de leitor desativado pode voltar: %s %s" % (st, j))
    L2 = j["leitor"]["id"]
    t1 = pede("POST", "/leitor/ativar", {"codigo": j["codigo"]}, ip="192.168.10.60")[1]["token"]
    c2 = pede("POST", "/leitores/codigo", {"id": L2}, {"Cookie": adm})[1]["codigo"]
    t2 = pede("POST", "/leitor/ativar", {"codigo": c2}, ip="192.168.10.61")[1]["token"]
    ok(pulso(t1)[0] == 401 and pulso(t2)[0] == 200, "reativar derruba o token anterior")
    # ---------- ativação: 20 códigos errados em 1 hora param tudo por 15 min ----------
    c3 = pede("POST", "/leitores/codigo", {"id": L2}, {"Cookie": adm})[1]["codigo"]
    m._janelas.clear()
    m.leitor_ativar_falhas.clear()
    for i in range(20):
        pede("POST", "/leitor/ativar", {"codigo": "ZZZZ-ZZZZ-ZZZZ-ZZZZ-%04d" % i}, ip="192.168.10.%d" % (100 + i))
    st, j, _ = pede("POST", "/leitor/ativar", {"codigo": c3}, ip="192.168.10.99")
    ok(st == 429 and j == {"erro": "taxa"}, "ativação parada depois de 20 erros: %s %s" % (st, j))
    m.leitor_ativar_parada["ate"] = 0
    for i in range(10):
        pede("POST", "/leitor/ativar", {"codigo": "x"}, ip="192.168.10.200")
    ok(pede("POST", "/leitor/ativar", {"codigo": c3}, ip="192.168.10.200")[0] == 429, "11ª ativação no minuto do mesmo IP")
    ok(pede("POST", "/leitor/ativar", {"codigo": c3}, ip="192.168.10.201")[0] == 200, "ativação com código bom depois da parada")
    # o instalador sai da cópia local do repositório, sem internet
    c = http.client.HTTPConnection("127.0.0.1", P, timeout=10)
    c.request("GET", "/instalar-leitor", headers={"Host": HOST})
    r = c.getresponse()
    corpo = r.read()
    c.close()
    cmd = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "..", "servidor", "leitor", "instalar-leitor.cmd")
    ok(r.status == 200 and "attachment" in (r.getheader("Content-Disposition") or "") and r.getheader("Cache-Control") == "no-store"
       and corpo == open(cmd, "rb").read(), "GET /instalar-leitor: %s" % r.status)
    # token e código nunca no console do agente
    con = CONSOLE.getvalue()
    ok(TOK not in con and t1 not in con and t2 not in con and COD not in con and c3 not in con, "o token ou o código apareceu no console do agente")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-800:])
sys.stdout = SAIDA_REAL
print(("OK" if not falhas else "FALHA") + " leitor_agente: cadastro, código de uso único, só hash no banco, rede, sem Origin, token, foto de cartão com o leitor,"
      " repetida, LGPD, hash, limites, /leitor/tem, revogação, resposta reduzida (critérios 3 a 14, 26 e 27)"
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
sys.exit(1 if falhas else 0)
