# Entrada da equipe: usuário e senha no agente. Roda com HOME temporário:  python3 -I testes/login_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer

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


def pede(rota, corpo=None, cookie=None, extra=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    h = {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json"}
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    c.request("POST" if corpo is not None else "GET", rota, json.dumps(corpo) if corpo is not None else None, h)
    r = c.getresponse()
    j = json.loads(r.read() or b"{}")
    ck = r.getheader("Set-Cookie") or ""
    c.close()
    return r.status, j, ck


def cookie_de(ck):
    return ck.split(";")[0]


def doc(usuario, valor):
    m.estado_gravar({"docs": [{"col": "usuarios", "id": m.quote(usuario, safe="-_.!~*'()"), "valor": valor}]})


# 1. primeiro admin, criado no servidor, tem de trocar a senha antes de entrar
prov = m.auth_criar("ronaldo", "Ronaldo", True, "servidor")
st, j, ck = pede("/auth/entrar", {"usuario": "ronaldo", "senha": prov})
ok(st == 200 and j.get("troca") and not ck, "senha provisória não abre sessão: %s %s" % (st, j))
for fraca in ("curta", "123456", "1234567890", "12345678901234", "0987654321", "qwertyuiop", "aaaaaaaaaaaa", "abababababab", "senha123456", "Senha@2026", "Maracana2026!",
              "M4r4c4n4@2026", "vivamaracana", "Eterna12345", "Flamengo2026", "ronaldo12345", "Ronaldo@2026", "abcdefghijkl", "1q2w3e4r5t", "04112026041120"):
    st, j, _ = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": fraca})
    ok(st == 400 and j.get("erro") == "fraca" and j.get("motivo"), "senha fraca aceita: %s (%s)" % (fraca, st))
st, j, _ = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": prov})
ok(st == 400, "senha provisória não vira definitiva")
SENHA = "cavalo verde corre longe"
st, j, ck = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": SENHA})
ok(st == 200 and j.get("ok") and j.get("admin") and "HttpOnly" in ck and "SameSite=Strict" in ck, "troca entra como admin: %s %s" % (st, ck))
adm = cookie_de(ck)
st, j, _ = pede("/auth/eu", cookie=adm)
ok(st == 200 and j.get("usuario") == "ronaldo", "/auth/eu reconhece a sessão")
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": prov})
ok(st == 401, "senha provisória antiga deixa de valer")

# 2. admin cadastra um vendedor sem e-mail; quem não é admin não gera senha
st, j, _ = pede("/auth/admin/senha", {"usuario": "rafael.melo", "nome": "Rafael"})
ok(st == 401, "sem sessão não gera senha")
st, j, _ = pede("/auth/admin/senha", {"usuario": "rafael.melo", "nome": "Rafael"}, adm)
ok(st == 200 and j.get("senha"), "admin gera senha")
doc("rafael.melo", {"email": "rafael.melo", "name": "Rafael", "active": True, "preset": "venda"})
st, j, ck = pede("/auth/trocar", {"usuario": "rafael.melo", "senha": j["senha"], "nova": "janela azul abre cedo"})
ok(st == 200 and j.get("admin") is False and j.get("cadastro", {}).get("name") == "Rafael", "vendedor entra sem e-mail")
vend = cookie_de(ck)
st, _, _ = pede("/auth/admin/senha", {"usuario": "outro"}, vend)
ok(st == 403, "vendedor não gera senha")
st, _, _ = pede("/auth/admin/senha", {"usuario": "rafael.melo", "admin": True}, vend)
ok(st == 403, "vendedor não se promove")

# 3. mesma resposta para usuário inexistente e senha errada; 5 erros bloqueiam; admin libera com senha nova
a = pede("/auth/entrar", {"usuario": "ninguem", "senha": "x"})
b = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "x"})
ok(a[0] == b[0] == 401 and a[1] == b[1], "erro igual para inexistente e senha errada")
for _ in range(4):
    pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "x"})
st, _, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "janela azul abre cedo"})
ok(st == 429, "5 erros bloqueiam até a senha certa: %s" % st)
st, j, _ = pede("/auth/admin/senha", {"usuario": "rafael.melo"}, adm)
ok(st == 200, "admin gera senha para quem esqueceu")
st, j2, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": j["senha"]})
ok(st == 200 and j2.get("troca"), "senha provisória desbloqueia")
st, _, _ = pede("/auth/eu", cookie=vend)
ok(st == 401, "senha nova encerra as sessões antigas")

# 4. desativado perde o acesso; excluído também; sair encerra a sessão
st, j, ck = pede("/auth/trocar", {"usuario": "rafael.melo", "senha": j["senha"], "nova": "porta velha range muito"})
vend = cookie_de(ck)
doc("rafael.melo", {"email": "rafael.melo", "name": "Rafael", "active": False, "preset": "venda"})
st, _, _ = pede("/auth/eu", cookie=vend)
ok(st == 401, "desativado perde a sessão")
st, _, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "porta velha range muito"})
ok(st == 401, "desativado não entra")
st, _, _ = pede("/auth/admin/remover", {"usuario": "ronaldo"}, adm)
ok(st == 400, "admin não remove a si mesmo")
st, _, _ = pede("/auth/admin/remover", {"usuario": "rafael.melo"}, adm)
ok(st == 200, "admin remove")
st, _, ck = pede("/auth/sair", {}, adm)
ok(st == 200 and "Max-Age=0" in ck, "sair limpa o cookie")
st, _, _ = pede("/auth/eu", cookie=adm)
ok(st == 401, "sair encerra a sessão no servidor")

# 5. origem: outro site não chama as rotas; sem X-Eterna também não
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": SENHA}, extra={"Origin": "https://exemplo.com"})
ok(st == 403, "outra origem é recusada")
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": SENHA}, extra={"X-Eterna": "0"})
ok(st == 403, "sem X-Eterna é recusado")

# 6. nada legível no banco; credenciais fora de /ponto/docs
db = sqlite3.connect(m.ESTADO_DB)
tudo = "\n".join(str(l) for l in db.iterdump())
db.close()
ok(SENHA not in tudo and "porta velha" not in tudo, "senha legível no banco")

# 7. senha provisória vence em 72 horas; muitos erros do mesmo endereço param, mesmo mudando o usuário
prov = m.auth_criar("velho", "Velho", True, "servidor")
db = sqlite3.connect(m.ESTADO_DB)
db.execute("update credencial set atualizada=? where usuario='velho'", (time.time() - 73 * 3600,))
db.commit()
db.close()
st, _, _ = pede("/auth/entrar", {"usuario": "velho", "senha": prov})
ok(st == 401, "senha provisória vencida não entra")
for i in range(32):
    m.auth_ip_erros.setdefault("127.0.0.1", []).append(time.time())
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": SENHA})
ok(st == 429, "muitos erros do mesmo endereço bloqueiam: %s" % st)
ok(not m.estado_col("credencial")["docs"] and "credencial" not in m.ESTADO_COLS, "credencial fora das coleções")
srv.shutdown()

if falhas:
    print("FALHA login_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK login_agente: senhas óbvias recusadas, senha provisória, cadastro sem e-mail, bloqueio, desativar, origem e banco sem senha legível")
