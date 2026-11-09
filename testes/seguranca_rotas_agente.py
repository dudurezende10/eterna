# Rotas do agente: nada abre sem pessoa conectada ou aparelho pareado. Confere a tabela ROTAS linha por linha (sem cookie,
# posto em rota da equipe, pessoa sem o módulo, Host e Origin de fora, POST sem X-Eterna) e, no código, que toda rota
# tratada em do_GET/do_POST/gal_get/gal_post/postos_*/auth_* está na tabela (rota nova sem regra quebra este teste).
# Roda com HOME temporário:  python3 -I testes/seguranca_rotas_agente.py agente/eterna-agente.py
import http.client, importlib.util, inspect, json, os, re, sys, threading
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ.pop("ETERNA_TESTE_CARGA", None)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"              # o app não é baixado de fora neste teste
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def pede(metodo, rota, corpo=None, cookie=None, extra=None, xeterna=True):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST}
    if metodo == "POST":
        h["Content-Type"] = "application/json"
        if xeterna:
            h["X-Eterna"] = "1"
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    dados = json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None
    c.request(metodo, rota, dados, h)
    r = c.getresponse()
    b = r.read()
    try:
        j = json.loads(b or b"{}")
    except ValueError:
        j = None
    hs = {k.lower(): v for k, v in r.getheaders()}
    c.close()
    return r.status, j, hs


def concreto(caminho):
    """Um caminho de verdade para a linha da tabela (prefixo ganha um final)."""
    if caminho == "/g/":
        return "/g/" + "a" * 22 + "/info"
    return caminho + "x1" if caminho.endswith("/") and caminho != "/" else caminho


try:
    adm = S.cookie_sessao(m, "admin-rotas")
    nada = S.cookie_sessao(m, "sem-modulo", {})
    foto = S.cookie_sessao(m, "fotografo-rotas", {"set": {"r": True, "c": True}})
    posto = S.cookie_posto(m, "Checkout de teste")

    # 1. estático: toda rota tratada no código está na tabela
    fontes = {"GET": ("do_GET", "gal_get", "postos_get", "auth_get"), "POST": ("do_POST", "gal_post", "postos_post", "auth_post")}
    sem_regra = []
    for metodo, fs in fontes.items():
        for f in fs:
            src = inspect.getsource(getattr(m.H, f))
            for lit in set(re.findall(r'"(/[a-z][a-z0-9_/.-]*)', src)):
                coberta = any(m.rota_regra(mm, lit) for mm in ("GET", "POST")) or any(c.startswith(lit) for _, c, _, _ in m.ROTAS)
                if not coberta:
                    sem_regra.append("%s %s (%s)" % (metodo, lit, f))
    ok(not sem_regra, "rota sem regra na tabela ROTAS: %s" % sem_regra)
    ok(m.rota_regra("GET", "/nao-existe") is None and pede("GET", "/nao-existe")[0] == 404, "rota fora da tabela: 404")
    ok(pede("GET", "/agente/eterna-agente.py")[0] == 404, "arquivo fora do app: 404 sem buscar")

    # 2. dinâmico: cada linha da tabela
    for metodo, caminho, tipo, mods in m.ROTAS:
        rota = concreto(caminho)
        if tipo == "publica":
            st, j, _ = pede(metodo, rota)
            ok((j or {}).get("erro") not in ("sem_sessao", "sem_permissao", "origem") and not (st == 403 and metodo == "GET"), "pública %s %s respondeu %s %s" % (metodo, rota, st, j))
            continue
        st, j, hs = pede(metodo, rota)
        ok(st == (404 if tipo == "teste" else 401), "sem cookie %s %s: %s %s" % (metodo, rota, st, j))
        ok(hs.get("access-control-allow-headers") != "*", "Allow-Headers * em %s" % rota)
        st, j, _ = pede(metodo, rota, cookie=posto)
        if tipo == "posto_ou_sessao" and not mods:
            ok(st != 401, "posto pareado barrado em %s %s: %s" % (metodo, rota, st))
        elif tipo != "teste":
            ok(st == 401 if tipo == "sessao" else st in (200, 400, 404), "posto em rota da equipe %s %s: %s %s" % (metodo, rota, st, j))
        if mods:
            st, j, _ = pede(metodo, rota, cookie=nada)
            ok(st == 403 and (j or {}).get("erro") == "sem_permissao", "sem o módulo %s %s: %s %s" % (metodo, rota, st, j))
        st, j, _ = pede(metodo, rota, cookie=adm, extra={"Host": "evil.example:%d" % m.PORT})
        ok(st in (403, 404) if tipo == "teste" else st == 403, "Host de fora %s %s: %s" % (metodo, rota, st))
        st, j, hs = pede(metodo, rota, extra={"Origin": "http://evil.example"})
        ok(st in (401, 403, 404) and "access-control-allow-origin" not in hs, "Origin forjada sem cookie %s %s: %s %s" % (metodo, rota, st, hs.get("access-control-allow-origin")))
        if metodo == "POST":
            st, j, _ = pede(metodo, rota, cookie=adm, xeterna=False)
            ok(st in (403, 404) if tipo == "teste" else st == 403, "POST sem X-Eterna %s: %s" % (rota, st))

    # 3. casos fixos
    ok(pede("GET", "/ponto/docs?col=usuarios")[0] == 401, "lista de usuários sem sessão deveria dar 401")
    st, j, _ = pede("POST", "/lgpd/excluir", {"pids": ["abc"]})
    ok(st == 401, "/lgpd/excluir sem sessão: %s" % st)
    ok(pede("GET", "/ponto/docs?col=usuarios", cookie=posto)[0] == 403, "posto lendo usuarios deveria dar 403")
    st, j, _ = pede("GET", "/ponto/docs?col=sim", cookie=posto)
    ok(st == 200 and j.get("ok"), "posto lê a coleção sim (Checkout): %s" % st)
    m.estado_gravar({"docs": [{"col": "sim", "id": "prices|zona", "valor": 100}]})
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": "prices|zona", "valor": 1}]}, cookie=foto)
    ok(st == 200 and j.get("recusados") == 1, "Fotógrafo mudando preço: %s %s" % (st, j))
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": "prices|zona", "valor": 2}, {"col": "sim", "id": "stock|Caixa 1", "valor": 3}]}, cookie=posto)
    ok(st == 200 and j.get("recusados") == 2 and j.get("gravados") == 0, "posto não grava docs: %s %s" % (st, j))
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": "segredoNovo", "valor": 2}]}, cookie=adm)
    ok(j.get("recusados") == 1, "id desconhecido na coleção sim é recusado: %s" % j)
    prc = [d["valor"] for d in m.estado_col("sim")["docs"] if d["id"] == "prices|zona"]
    ok(prc == [100], "preço inalterado: %s" % prc)
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": "prices|zona", "valor": 120}]}, cookie=adm)
    ok(j.get("gravados") == 1, "admin muda o preço: %s" % j)
    m.estado_gravar({"docs": [{"col": "usuarios_log", "id": "log1", "valor": {"a": 1}}]})
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "usuarios_log", "id": "log1", "valor": None}, {"col": "usuarios_log", "id": "log2", "valor": {"b": 2}}]}, cookie=foto)
    ok(j.get("recusados") == 1 and j.get("gravados") == 1, "registro de usuários só acrescenta: %s" % j)
    st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "usuarios_login", "id": "admin-rotas", "valor": {"lastLogin": "x"}}]}, cookie=foto)
    ok(j.get("recusados") == 1, "último acesso de outra pessoa: %s" % j)
    # /status: mínimo sem credencial; sem logins do FTP, pasta nem caminhos
    st, j, _ = pede("GET", "/status")
    ok(st == 200 and set(j) == {"ok", "agent", "version", "boot"}, "/status anônimo: %s" % sorted(j))
    st, j, _ = pede("GET", "/status", cookie=posto)
    ok(st == 200 and "sessoes" in j and "inbox" not in j and "users" not in j.get("ftp", {}) and "impressora_locais" not in j, "/status do posto: %s" % sorted(j))
    st, j, _ = pede("GET", "/status", cookie=adm)
    ok(st == 200 and "inbox" not in j and "users" not in j.get("ftp", {}) and "impressora_locais" in j, "/status da equipe: %s" % sorted(j))
    st, j, _ = pede("GET", "/status", cookie=adm, extra={"Host": "evil.example:%d" % m.PORT})
    ok(set(j) == {"ok", "agent", "version", "boot"}, "/status com Host de fora: mínimo")
    st, j, _ = pede("GET", "/photoroom/status", cookie=posto)
    ok(st == 200 and set(j) == {"configured", "fundos_modo"}, "/photoroom/status do posto: %s" % j)
    # CORS: * só na galeria do cliente
    _, _, hs = pede("GET", "/g/" + "a" * 22 + "/info", extra={"Origin": "https://qualquer.example"})
    ok(hs.get("access-control-allow-origin") == "*", "galeria /g/ com CORS aberto")
    _, _, hs = pede("GET", "/status", extra={"Origin": "https://qualquer.example"})
    ok("access-control-allow-origin" not in hs, "/status sem CORS para origem de fora")
    _, _, hs = pede("GET", "/sessoes", cookie=adm, extra={"Origin": "http://" + HOST})
    ok(hs.get("access-control-allow-origin") == "http://" + HOST and hs.get("access-control-allow-headers") == "Content-Type, X-Eterna", "CORS da própria origem: %s" % hs.get("access-control-allow-headers"))
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=10)
    c.request("OPTIONS", "/ponto/eventos", headers={"Host": HOST, "Origin": "http://evil.example", "Access-Control-Request-Headers": "x-eterna"})
    r = c.getresponse()
    r.read()
    ok("Access-Control-Allow-Origin" not in dict(r.getheaders()), "preflight de origem de fora sem CORS")
    c.close()
    # sessão que caiu (cadastro desativado): 401 na próxima chamada
    m.estado_gravar({"docs": [{"col": "usuarios", "id": "fotografo-rotas", "valor": {"email": "fotografo-rotas", "active": False, "perms": {"set": {"r": True}}}}]})
    ok(pede("GET", "/biblioteca", cookie=foto)[0] == 401, "cadastro desativado perde a sessão")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-600:])
print(("OK" if not falhas else "FALHA") + " seguranca_rotas_agente: %d rotas da tabela, rota sem regra, docs por permissão, /status mínimo, CORS" % len(m.ROTAS)
      + ("" if not falhas else " · " + " | ".join(falhas[:10])))
sys.exit(1 if falhas else 0)
