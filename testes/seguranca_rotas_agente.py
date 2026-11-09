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
            # só as linhas que escolhem a rota (path == / in / startswith); texto de resposta e URLs montadas ficam de fora
            linhas = [x for x in src.splitlines() if re.search(r"\b(u\.path|path|p)\b\s*(==|in\b|\.startswith)", x)]
            for lit in set(re.findall(r'"(/[a-z][a-z0-9_/.-]*)', "\n".join(linhas))):
                coberta = any(m.rota_regra(mm, lit) for mm in ("GET", "POST"))      # o literal é uma rota da tabela, exata ou prefixo dela
                if not coberta:
                    sem_regra.append("%s %s (%s)" % (metodo, lit, f))
    ok(not sem_regra, "rota sem regra na tabela ROTAS: %s" % sem_regra)
    ok(m.rota_regra("GET", "/nao-existe") is None and pede("GET", "/nao-existe")[0] == 404, "rota fora da tabela: 404")
    ok(pede("GET", "/agente/eterna-agente.py")[0] == 404, "arquivo fora do app: 404 sem buscar")
    ok(pede("GET", "/img/x.php")[0] == 404 and pede("GET", "/vendor/a/..%2F..%2Fx.js")[0] == 404 and m.APP_ARQUIVO.match("/vendor/qrcode/qrcode.min.js")
       and m.APP_ARQUIVO.match("/img/bg-campeao-v81.jpg") and not m.APP_ARQUIVO.match("/img/.git/config"), "pastas do app só com arquivos do pacote")

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
        if tipo == "posto_ou_sessao":
            ok(st not in (401, 403) or (j or {}).get("erro") not in ("sem_sessao", "sem_permissao", "origem"), "posto pareado barrado em %s %s: %s %s" % (metodo, rota, st, j))
        elif tipo == "sessao":
            ok(st == 401, "posto em rota da equipe %s %s: %s %s" % (metodo, rota, st, j))
        if mods:
            st, j, _ = pede(metodo, rota, cookie=nada)
            ok(st == 403 and (j or {}).get("erro") == "sem_permissao", "sem o módulo %s %s: %s %s" % (metodo, rota, st, j))
        st, j, _ = pede(metodo, rota, cookie=adm, extra={"Host": "evil.example:%d" % m.PORT})
        ok(st in (403, 404) if tipo == "teste" else st == 403, "Host de fora %s %s: %s" % (metodo, rota, st))
        st, j, hs = pede(metodo, rota, extra={"Origin": "http://evil.example"})
        ok(st in (401, 403, 404) and "access-control-allow-origin" not in hs, "Origin forjada sem cookie %s %s: %s %s" % (metodo, rota, st, hs.get("access-control-allow-origin")))
        if tipo != "teste":
            st, j, hs = pede(metodo, rota, cookie=adm, extra={"Origin": "http://evil.example"})
            ok(st == 403 and (j or {}).get("erro") == "origem" and "access-control-allow-origin" not in hs, "admin com Origin forjada %s %s: %s %s" % (metodo, rota, st, j))
        if metodo == "POST":
            st, j, _ = pede(metodo, rota, cookie=adm, xeterna=False)
            ok(st in (403, 404) if tipo == "teste" else st == 403, "POST sem X-Eterna %s: %s" % (rota, st))

    # 3. casos fixos
    st, j, _ = pede("GET", "/postos/eu")
    ok(st == 401 and j.get("erro") == "sem_posto", "/postos/eu sem posto: %s %s" % (st, j))
    # /file/ (original) e /sessoes: pessoa sem módulo de foto não lê
    ok(pede("GET", "/file/abc", cookie=nada)[0] == 403 and pede("GET", "/sessoes", cookie=nada)[0] == 403, "pessoa sem módulo de foto lê original ou sessões")
    # usuarios: sem usuarios.r, o próprio inteiro e dos outros só o nome; registro e últimos acessos só para quem tem módulo
    st, j, _ = pede("GET", "/ponto/docs?col=usuarios", cookie=foto)
    us = {d["id"]: d["valor"] for d in j.get("docs", [])}
    ok(us.get("fotografo-rotas", {}).get("perms") and set(us.get("admin-rotas", {})) <= {"email", "name", "key", "active"}, "usuarios para quem não tem usuarios.r: %s" % us)
    st, j, _ = pede("GET", "/ponto/docs?col=usuarios", cookie=adm)
    ok(any("perms" in d["valor"] for d in j.get("docs", []) if d["id"] == "sem-modulo"), "admin vê os cadastros inteiros")
    ok(pede("GET", "/ponto/docs?col=usuarios_log", cookie=nada)[0] == 403 and pede("GET", "/ponto/docs?col=usuarios_login", cookie=nada)[0] == 403, "registro de usuários para quem não tem módulo")
    ok(pede("GET", "/ponto/docs?col=usuarios_log", cookie=foto)[0] == 200, "registro de usuários para o fotógrafo")
    cfgr = S.cookie_sessao(m, "so-config", {"configuracao": {"r": True}})
    st, j, _ = pede("GET", "/photoroom/status", cookie=cfgr)
    ok(st == 200 and "calls" in j, "/photoroom/status com só configuracao.r: %s %s" % (st, j))
    # /ftp/contas: Painel de controle (Ver)
    ok(pede("GET", "/ftp/contas", cookie=foto)[0] == 403 and pede("GET", "/ftp/contas", cookie=adm)[0] == 200, "/ftp/contas só com configuracao.r")
    # coleção sim por perfil (cópia dos PRESETS do index.html): cada perfil grava o que a tela dele grava
    RW, RO, ALL = {"c": True, "r": True, "u": True}, {"r": True}, {"c": True, "r": True, "u": True, "d": True}
    perfis = {"foto": {"set": RW, "diario": RW, "escala": RO, "filafoto": RO},
              "venda": {"venda": RW, "quiosque": RW, "catalogo": RO, "filafoto": RO},
              "supervisor": {"relatorios": RO, "desempenho": RO, "financeiro": RO, "diario": ALL, "set": RO, "venda": RW, "qualidade": RO, "estoque": ALL,
                             "configuracao": RW, "escala": RW, "laboratorio": RO, "catalogo": RO, "galerias": RW, "filafoto": {"r": True, "u": True}}}
    grava = {"foto": ["edits|ag_x1", "discarded|ag_x1", "invalid|ag_x1", "flagUse|br", "autoAj", "autoAjPor", "camDia|2026-11-09"],
             "venda": ["stock|Caixa 1", "ai|ag_x1", "invalid|ag_x2", "flagUse|ar"],
             "supervisor": ["stock|Caixa 2", "flagUse|pt", "invalid|ag_x3", "bgAtivo|podio", "bgOn", "fundosModo", "cortesiaLog|abc"]}
    nao = {"foto": ["prices|zona", "lojaFimSeg", "pagProv"], "venda": ["prices|zona", "lojaFimSeg", "edits|ag_x9"], "supervisor": ["prices|zona", "lojaFimSeg", "catalogoV"]}
    for nome, perms in perfis.items():
        ck = S.cookie_sessao(m, "perfil-" + nome, perms)
        st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": i, "valor": 1} for i in grava[nome]]}, cookie=ck)
        ok(j.get("recusados") == 0 and j.get("gravados") == len(grava[nome]), "perfil %s grava %s: %s" % (nome, grava[nome], j))
        for i in nao[nome]:
            st, j, _ = pede("POST", "/ponto/docs", {"docs": [{"col": "sim", "id": i, "valor": 2}]}, cookie=ck)
            ok(j.get("recusados") == 1, "perfil %s não deveria gravar %s: %s" % (nome, i, j))
    # galeria publicada pelo posto: cortesia nova vira venda; validade no máximo 60 dias; menor do servidor não é desmarcado
    import time as _t
    tok = "b" * 22
    man = {"v": 1, "token": tok, "codigo": None, "tipo": "sessao", "venue": "maracana", "sessoes": [], "menor": True, "criada": m._iso(),
           "expira": m._iso(_t.time() + 400 * 86400), "precos": {"dig": 39, "todas": 250},
           "fotos": [{"id": "ag_aaaaaaaaaaaa", "sessao": "", "direito": "cortesia", "cortesia": {"motivo": "x"}}, {"id": "ag_bbbbbbbbbbbb", "sessao": "", "direito": "venda"}]}
    st, j, _ = pede("POST", "/galerias/publicar", {"manifesto": man}, cookie=posto)
    gm = m.REPO.ler_manifesto(tok) or {}
    ok(st == 200 and [f["direito"] for f in gm.get("fotos", [])] == ["venda", "venda"], "cortesia do posto deveria virar venda: %s %s" % (st, gm.get("fotos")))
    ok(m._epoch(gm.get("expira")) <= _t.time() + 60 * 86400 + 5, "validade além de 60 dias: %s" % gm.get("expira"))
    st, j, _ = pede("POST", "/galerias/publicar", {"manifesto": dict(man, menor=False)}, cookie=adm)
    gm = m.REPO.ler_manifesto(tok) or {}
    ok(gm.get("menor") is True and [f["direito"] for f in gm["fotos"]] == ["cortesia", "venda"], "admin dá cortesia; menor segue marcado: %s" % gm)
    st, j, _ = pede("POST", "/galerias/publicar", {"manifesto": dict(man, menor=False)}, cookie=posto)
    gm = m.REPO.ler_manifesto(tok) or {}
    ok([f["direito"] for f in gm["fotos"]] == ["cortesia", "venda"], "cortesia que já estava no servidor fica na republicação do posto: %s" % gm.get("fotos"))
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
