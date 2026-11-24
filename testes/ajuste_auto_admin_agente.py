# 24/11 (Eduardo): o Ajuste automático das fotos (sim/autoAj e sim/autoAjPor) só o Admin grava, também no servidor. O Fotógrafo e a
# Supervisora, mesmo com Alterar em Sessões (set.u), são recusados (so_admin); o "ver como" para antes (so_ver); o Admin grava; os
# outros campos da coleção sim seguem gravando para quem já podia (camDia| e edits| com set.u).
# Roda com HOME temporário:  python3 -I testes/ajuste_auto_admin_agente.py agente/eterna-agente.py
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


def grava(cookies, id_doc, valor):
    st, j, _ = pede("/ponto/docs", {"docs": [{"col": "sim", "id": id_doc, "valor": valor}]}, cookies)
    return st, j


def sim():
    return {d["id"]: d["valor"] for d in m.estado_col("sim")["docs"]}


doc("ronaldo", "admin", {mod: dict(TUDO) for mod in m.AUTH_MODULOS})
doc("carlos.foto", "foto", {"set": P(1, 1, 1, 0), "diario": P(1, 1, 0, 0)})
doc("sup", "supervisor", {"set": P(1, 1, 1, 0), "qualidade": P(0, 1, 1, 0), "configuracao": P(1, 1, 1, 0), "estoque": dict(TUDO)})
adm, fot, sup = entra("ronaldo"), entra("carlos.foto"), entra("sup")
por = lambda on, u: {"on": on, "por": u, "nome": u.title(), "em": "2026-11-24T12:00:00Z"}

# 1. Fotógrafo e Supervisora com set.u: autoAj e autoAjPor recusados (criar, mudar e apagar)
for nome, ck in (("Fotógrafo", fot), ("Supervisora", sup)):
    for id_doc, v in (("autoAj", False), ("autoAjPor", por(False, nome))):
        st, j = grava(ck, id_doc, v)
        ok(st == 200 and j.get("recusados") == 1 and id_doc not in sim(), "1: %s não cria %s: %s %s" % (nome, id_doc, st, j))

# 2. o Admin grava
st, j = grava(adm, "autoAj", False)
ok(st == 200 and j.get("recusados") == 0 and sim().get("autoAj") is False, "2: Admin grava autoAj: %s %s %s" % (st, j, sim().get("autoAj")))
st, j = grava(adm, "autoAjPor", por(False, "ronaldo"))
ok(st == 200 and j.get("recusados") == 0 and (sim().get("autoAjPor") or {}).get("por") == "ronaldo", "2: Admin grava autoAjPor: %s %s" % (st, j))

# 3. com o valor já no servidor, quem não é Admin também não muda nem apaga
for nome, ck in (("Fotógrafo", fot), ("Supervisora", sup)):
    st, j = grava(ck, "autoAj", True)
    ok(j.get("recusados") == 1 and sim().get("autoAj") is False, "3: %s não muda autoAj: %s" % (nome, j))
    st, j = grava(ck, "autoAj", None)
    ok(j.get("recusados") == 1 and sim().get("autoAj") is False, "3: %s não apaga autoAj: %s" % (nome, j))
    st, j = grava(ck, "autoAjPor", por(True, nome))
    ok(j.get("recusados") == 1 and (sim().get("autoAjPor") or {}).get("por") == "ronaldo", "3: %s não muda autoAjPor: %s" % (nome, j))

# 4. o resto da coleção sim segue como antes para quem já podia
st, j = grava(fot, "camDia|carlos", {"cam": "A", "dia": "2026-11-24"})
ok(j.get("recusados") == 0 and "camDia|carlos" in sim(), "4: Fotógrafo com set.u ainda grava camDia|: %s" % j)
st, j = grava(sup, "edits|ag_abc123", {"exp": 0.2})
ok(j.get("recusados") == 0 and "edits|ag_abc123" in sim(), "4: Supervisora ainda grava edits|: %s" % j)
st, j = grava(sup, "flagList", ["a"])
ok(j.get("recusados") == 0 and sim().get("flagList") == ["a"], "4: Supervisora com estoque ainda grava flagList: %s" % j)
st, j = grava(fot, "flagList", ["b"])
ok(j.get("recusados") == 1 and sim().get("flagList") == ["a"], "4: o que já era recusado segue recusado (flagList sem estoque): %s" % j)

# 5. "ver como": o Admin vendo como o Fotógrafo não grava (nem autoAj nem outro campo)
st, j, ck = pede("/auth/assumir", {"usuario": "carlos.foto"}, adm)
ok(st == 200 and j.get("assumido_por") == "ronaldo", "5: assumir: %s %s" % (st, j))
como = {"eterna_sessao": ck.get("eterna_sessao"), "eterna_sessao_adm": ck.get("eterna_sessao_adm")}
st, j = grava(como, "autoAj", True)
ok(st == 403 and j.get("erro") == "so_ver" and sim().get("autoAj") is False, "5: ver como não grava autoAj: %s %s" % (st, j))
# a regra em si também recusa uma sessão de Admin assumida (defesa, caso o so_ver do do_POST mude)
q = {"usuario": "carlos.foto", "assumido_por": "ronaldo", "cadastro": {"preset": "admin", "perms": {mod: dict(TUDO) for mod in m.AUTH_MODULOS}}}
with m.estado_lock:
    db = m.auth_db()
    try:
        r = m.doc_recusa(db, q, {"col": "sim", "id": "autoAj", "valor": True})
        r2 = m.doc_recusa(db, dict(q, assumido_por=None), {"col": "sim", "id": "autoAj", "valor": True})
    finally:
        db.close()
ok(r == "so_admin" and r2 is None, "5: doc_recusa com assumido_por: %s / sem: %s" % (r, r2))

# 6. sem sessão: recusado
st, j = grava(None, "autoAj", True)
ok(sim().get("autoAj") is False, "6: sem sessão não grava: %s %s" % (st, j))

srv.shutdown()
if falhas:
    print("FALHA ajuste_auto_admin_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK ajuste_auto_admin_agente: sim/autoAj e autoAjPor só o Admin grava (Fotógrafo e Supervisora com set.u recusados, ver como recusado), o resto do sim segue igual")
