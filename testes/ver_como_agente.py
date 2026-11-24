# "Ver como" (16/11): Admin assume a visão de outra pessoa, só para olhar, e volta para a própria conta.
# Roda com HOME temporário:  python3 -I testes/ver_como_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sys, threading
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


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT
TUDO = {"c": True, "r": True, "u": True, "d": True}
P = lambda c, r, u, d: {"c": bool(c), "r": bool(r), "u": bool(u), "d": bool(d)}


def pede(rota, corpo=None, cookies=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
    if cookies:
        h["Cookie"] = "; ".join("%s=%s" % kv for kv in cookies.items() if kv[1])
    c.request("POST" if corpo is not None else "GET", rota, json.dumps(corpo) if corpo is not None else None, h)
    r = c.getresponse()
    j = json.loads(r.read() or b"{}")
    novos = {}
    for ck in r.msg.get_all("Set-Cookie") or []:
        k, _, v = ck.split(";")[0].partition("=")
        novos[k] = v
    c.close()
    return r.status, j, novos


def doc(usuario, preset, perms):
    v = {"v": 2, "email": usuario, "name": usuario.title(), "active": True, "preset": preset, "perms": perms}
    m.estado_gravar({"docs": [{"col": "usuarios", "id": m.quote(usuario, safe="-_.!~*'()"), "valor": v}]})


def entra(usuario):
    prov = m.auth_criar(usuario, "teste")
    st, j, ck = pede("/auth/trocar", {"usuario": usuario, "senha": prov, "nova": "Pi-ano-Verde-%s-77" % usuario})
    ok(st == 200 and ck.get("eterna_sessao"), "%s deveria entrar: %s %s" % (usuario, st, j))
    return {"eterna_sessao": ck.get("eterna_sessao")}


todos = {mod: dict(TUDO) for mod in m.AUTH_MODULOS}
doc("ronaldo", "admin", todos)
doc("eduardo", "admin", todos)
doc("marcos.snap", "snap", {"ativvenda": P(1, 1, 0, 0), "ativentrega": P(1, 1, 1, 0)})
doc("caixa.um", "venda", {"venda": P(1, 1, 1, 0), "quiosque": P(1, 1, 1, 0)})
adm = entra("ronaldo")
vend = entra("caixa.um")

# 1. só Admin, só de quem não é Admin, nunca de si mesmo
st, j, _ = pede("/auth/assumir", {"usuario": "marcos.snap"}, vend)
ok(st == 403 and j.get("erro") == "sem_permissao", "1: vendedor não pode ver como: %s %s" % (st, j))
st, j, _ = pede("/auth/assumir", {"usuario": "eduardo"}, adm)
ok(st == 403 and j.get("erro") == "alvo_maior", "1: Admin não vê como outro Admin: %s %s" % (st, j))
st, j, _ = pede("/auth/assumir", {"usuario": "ronaldo"}, adm)
ok(st == 400, "1: nem como si mesmo: %s" % st)
st, j, _ = pede("/auth/assumir", {"usuario": "ninguem"}, adm)
ok(st == 404, "1: cadastro que não existe: %s" % st)
st, j, _ = pede("/auth/assumir", {"usuario": "marcos.snap"})
ok(st in (401, 403), "1: sem sessão: %s" % st)

# 2. Admin vê como o vendedor: a sessão nova é dele, a do Admin fica guardada no cookie à parte
st, j, ck = pede("/auth/assumir", {"usuario": "marcos.snap"}, adm)
ok(st == 200 and j.get("usuario") == "marcos.snap" and j.get("assumido_por") == "ronaldo" and (j.get("cadastro") or {}).get("preset") == "snap",
   "2: assumir: %s %s" % (st, j))
ok(ck.get("eterna_sessao") and ck.get("eterna_sessao") != adm["eterna_sessao"] and ck.get("eterna_sessao_adm") == adm["eterna_sessao"],
   "2: cookies do ver como: %s" % list(ck))
como = {"eterna_sessao": ck.get("eterna_sessao"), "eterna_sessao_adm": ck.get("eterna_sessao_adm")}
st, j, _ = pede("/auth/eu", None, como)
ok(st == 200 and j.get("usuario") == "marcos.snap" and j.get("assumido_por") == "ronaldo" and j.get("assumido_nome") == "Ronaldo",
   "2: /auth/eu mostra a pessoa e quem assumiu: %s %s" % (st, j))

# 3. só olha: toda gravação é recusada, inclusive gerar senha e assumir de novo
for rota, corpo in (("/ponto/docs", {"docs": [{"col": "diario", "id": "x", "valor": {"a": 1}}]}), ("/ativ/venda", {"vendas": []}),
                    ("/auth/senha/gerar", {"usuario": "caixa.um"}), ("/auth/assumir", {"usuario": "caixa.um"}),
                    ("/auth/trocar", {"usuario": "marcos.snap", "senha": "x", "nova": "y"})):
    st, j, _ = pede(rota, corpo, como)
    ok(st == 403 and j.get("erro") == "so_ver", "3: %s no ver como deveria dar so_ver: %s %s" % (rota, st, j))

# 4. voltar: a sessão do ver como acaba e a do Admin volta
st, j, ck = pede("/auth/voltar", {}, como)
ok(st == 200 and j.get("usuario") == "ronaldo" and not j.get("assumido_por"), "4: voltar: %s %s" % (st, j))
ok(ck.get("eterna_sessao") == adm["eterna_sessao"] and ck.get("eterna_sessao_adm") == "", "4: cookies na volta: %s" % ck)
st, j, _ = pede("/auth/eu", None, {"eterna_sessao": como["eterna_sessao"]})
ok(st == 401, "4: a sessão do ver como não vale mais: %s" % st)
st, j, _ = pede("/auth/eu", None, adm)
ok(st == 200 and j.get("usuario") == "ronaldo", "4: a do Admin segue: %s %s" % (st, j))
st, j, _ = pede("/auth/voltar", {}, vend)
ok(st == 401, "4: voltar sem a sessão guardada do Admin: %s" % st)

# 5. registro no login_log e fim do ver como quando o Admin deixa de ser Admin
db = m.auth_db()
acoes = [(u, a, p) for (u, a, p) in db.execute("select usuario, acao, por from login_log where acao like 'ver_como%'")]
db.close()
ok(("marcos.snap", "ver_como", "ronaldo") in acoes and ("marcos.snap", "ver_como_fim", "ronaldo") in acoes, "5: login_log: %s" % acoes)
st, j, ck = pede("/auth/assumir", {"usuario": "marcos.snap"}, adm)
como = {"eterna_sessao": ck.get("eterna_sessao")}
doc("ronaldo", "custom", todos)
st, j, _ = pede("/auth/eu", None, como)
ok(st == 401, "5: Admin rebaixado: o ver como acaba: %s %s" % (st, j))

# 6. sair durante o ver como encerra as duas sessões
doc("ronaldo", "admin", todos)
st, j, ck = pede("/auth/assumir", {"usuario": "caixa.um"}, adm)
como = {"eterna_sessao": ck.get("eterna_sessao"), "eterna_sessao_adm": ck.get("eterna_sessao_adm")}
st, j, ck = pede("/auth/sair", {}, como)
ok(st == 200 and ck.get("eterna_sessao") == "" and ck.get("eterna_sessao_adm") == "", "6: sair limpa os dois cookies: %s %s" % (st, ck))
st, j, _ = pede("/auth/eu", None, adm)
ok(st == 401, "6: a sessão do Admin também acabou: %s" % st)

# 6b. (24/11) entrar com a sessão do ver como ainda no navegador (o Sair não chegou ao servidor) encerra as duas
adm = entra("ronaldo")
st, j, ck = pede("/auth/assumir", {"usuario": "caixa.um"}, adm)
como = {"eterna_sessao": ck.get("eterna_sessao"), "eterna_sessao_adm": ck.get("eterna_sessao_adm")}
SENHA_V = "Pi-ano-Verde-caixa.um-77"
st, j, ck = pede("/auth/entrar", {"usuario": "caixa.um", "senha": SENHA_V}, como)
ok(st == 200 and j.get("usuario") == "caixa.um" and not j.get("assumido_por") and ck.get("eterna_sessao") and ck.get("eterna_sessao_adm") == "",
   "6b: entrar no ver como: sessão nova e o cookie do Admin limpo: %s %s %s" % (st, j, list(ck)))
st1, _, _ = pede("/auth/eu", None, {"eterna_sessao": como["eterna_sessao"]})
st2, _, _ = pede("/auth/eu", None, {"eterna_sessao": como["eterna_sessao_adm"]})
ok(st1 == 401 and st2 == 401, "6b: entrar apaga a sessão do ver como e a do Admin guardada: %s %s" % (st1, st2))
st, j, _ = pede("/auth/eu", None, {"eterna_sessao": ck.get("eterna_sessao")})
ok(st == 200 and j.get("usuario") == "caixa.um" and not j.get("assumido_por"), "6b: a sessão nova vale, sem ver como: %s %s" % (st, j))

# 7. perfil Snap Pop: o servidor recusa venda de outra ativação
ok(m.ATIV_PERFIL_CATS.get("snap") == ("snap",) and "snap" in m.PERFIS_CLI, "7: perfil snap no servidor")

srv.shutdown()
if falhas:
    print("FALHA ver_como_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK ver_como_agente: só Admin, só olha, voltar, registro, sair")
