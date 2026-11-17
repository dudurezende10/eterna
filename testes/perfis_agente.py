# Perfis no servidor (17/11): a coleção perfis grava só com Permissões (Alterar), sem acesso que quem grava não tem; o Admin não muda;
# o perfil pronto editado vale também para --criar-vendedor.
# Roda com HOME temporário:  python3 -I testes/perfis_agente.py agente/eterna-agente.py
import http.client, importlib.util, io, json, os, sys, threading
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


def grava(cookies, id_doc, valor):
    st, j, _ = pede("/ponto/docs", {"docs": [{"col": "perfis", "id": id_doc, "valor": valor}]}, cookies)
    return st, j


def tem(id_doc):
    return any(d["id"] == id_doc for d in m.estado_col("perfis")["docs"])


doc("ronaldo", "admin", {mod: dict(TUDO) for mod in m.AUTH_MODULOS})
doc("sup", "custom", {"permissoes": P(0, 1, 1, 0), "ativvenda": P(1, 1, 0, 0), "ativentrega": P(1, 1, 1, 0)})
doc("vend", "ativ", {"ativvenda": P(1, 1, 0, 0), "ativentrega": P(1, 1, 1, 0)})
adm, sup, vend = entra("ronaldo"), entra("sup"), entra("vend")
perfil = lambda i, perms, **k: dict({"id": i, "name": "Perfil " + i, "perms": perms, "menu": ["ativ-venda"], "inicio": "ativ-venda"}, **k)

# 1. Admin cria; quem não tem Permissões não grava; quem tem não dá o que não tem
st, j = grava(adm, "p1", perfil("p1", {"ativvenda": P(1, 1, 0, 0)}))
ok(st == 200 and tem("p1"), "1: Admin cria perfil: %s %s" % (st, j))
grava(vend, "p2", perfil("p2", {"ativvenda": P(1, 1, 0, 0)}))
ok(not tem("p2"), "1: vendedor não grava perfil")
grava(sup, "p3", perfil("p3", {"venda": P(1, 1, 1, 0)}))
ok(not tem("p3"), "1: não dá acesso que não tem")
grava(sup, "p4", perfil("p4", {"ativvenda": P(1, 1, 0, 0)}))
ok(tem("p4"), "1: dá o que tem")

# 2. o Admin não muda; id e formato
for i, v in (("admin", perfil("admin", {})), ("custom", perfil("custom", {})), ("X Y", perfil("X Y", {})), ("p5", perfil("p6", {})), ("p7", {"id": "p7", "name": ""})):
    grava(adm, i, v)
    ok(not tem(i), "2: recusado %s" % i)

# 3. excluir com a marca deleted
st, j = grava(adm, "p1", {"id": "p1", "deleted": True})
ok(st == 200 and any(d["id"] == "p1" and d["valor"].get("deleted") for d in m.estado_col("perfis")["docs"]), "3: excluir: %s %s" % (st, j))

# 4. perfil pronto editado vale para --criar-vendedor
grava(adm, "ativ", perfil("ativ", {"ativvenda": P(1, 1, 0, 0)}, menu=["ativ-venda"]))
sys.stdin = io.StringIO("Senha-boa-123\n")
m.auth_criar_vendedor("novo.vend", "Novo", "ativ")
cad, _ = m.auth_ler_cadastro("novo.vend")
ok(cad and not (cad["perms"].get("ativentrega") or {}).get("r") and cad["menu"] == ["ativ-venda"], "4: CLI usa o perfil editado: %s" % (cad or {}).get("perms"))

# 5. qualquer pessoa conectada lê os perfis (nomes na tela)
st, j, _ = pede("/ponto/docs?col=perfis", None, vend)
ok(st == 200 and any(d["id"] == "p4" for d in j.get("docs", [])), "5: leitura: %s" % st)

srv.shutdown()
if falhas:
    print("FALHA perfis_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK perfis_agente: só Permissões grava, sem dar o que não tem, Admin fixo, excluir, CLI segue o perfil")
