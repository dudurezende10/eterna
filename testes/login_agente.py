# Entrada da equipe: usuário e senha no agente, com as permissões do módulo Senhas de acesso.
# Roda com HOME temporário:  python3 -I testes/login_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, re, sqlite3, sys, threading, time
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
TUDO = {"c": True, "r": True, "u": True, "d": True}


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


def idd(usuario):
    return m.quote(usuario, safe="-_.!~*'()")


def doc(usuario, perms=None, **campos):
    """Grava direto no banco, como dado já existente: a regra de quem pode gravar é testada à parte."""
    v = dict({"email": usuario, "name": usuario, "active": True, "preset": "custom", "perms": perms or {}}, **campos)
    m.estado_gravar({"docs": [{"col": "usuarios", "id": idd(usuario), "valor": v}]})
    return v


def ler(usuario):
    return m.auth_ler_cadastro(usuario)[0]


def entra(usuario, nova):
    """Cria o cadastro já com permissões, gera a provisória e troca: devolve o cookie."""
    prov = m.auth_criar(usuario, "teste")
    st, j, ck = pede("/auth/trocar", {"usuario": usuario, "senha": prov, "nova": nova})
    ok(st == 200, "%s deveria entrar: %s %s" % (usuario, st, j))
    return cookie_de(ck)


# 1. primeiro administrador: o comando no servidor grava o cadastro e a senha provisória; ela só serve para criar a definitiva
saida = []
print_orig = m.print if hasattr(m, "print") else None
m.print = lambda *a: saida.append(" ".join(str(x) for x in a))
ok(m.auth_criar_admin("Nome Com Espaco", "x") == 1, "usuário inválido recusado")
ok(m.auth_criar_admin("ronaldo", "Ronaldo Santos") == 0, "comando cria o administrador")
del m.print
prov = saida[-1].split(": ")[-1]
ok(ler("ronaldo")["preset"] == "admin" and ler("ronaldo")["perms"]["senhas"]["c"] is True, "administrador nasce com Senhas de acesso")
st, j, ck = pede("/auth/entrar", {"usuario": "ronaldo", "senha": prov})
ok(st == 200 and j.get("troca") and not ck, "senha provisória não abre sessão: %s %s" % (st, j))
for fraca in ("curta", "123456", "1234567890", "12345678901234", "0987654321", "qwertyuiop", "aaaaaaaaaaaa", "abababababab", "senha123456", "Senha@2026", "Maracana2026!",
              "M4r4c4n4@2026", "vivamaracana", "Eterna12345", "Flamengo2026", "ronaldo12345", "Ronaldo@2026", "Santos@2026", "abcdefghijkl", "1q2w3e4r5t", "04112026041120"):
    st, j, _ = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": fraca})
    ok(st == 400 and j.get("erro") == "fraca" and j.get("motivo"), "senha fraca aceita: %s (%s)" % (fraca, st))
st, j, _ = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": prov})
ok(st == 400, "senha provisória não vira definitiva")
SENHA = "cavalo verde corre longe"
st, j, ck = pede("/auth/trocar", {"usuario": "ronaldo", "senha": prov, "nova": SENHA})
ok(st == 200 and j.get("ok") and "HttpOnly" in ck and "SameSite=Strict" in ck, "troca entra: %s %s" % (st, ck))
adm = cookie_de(ck)
st, j, _ = pede("/auth/eu", cookie=adm)
ok(st == 200 and j.get("usuario") == "ronaldo" and "admin" not in j, "/auth/eu reconhece a sessão, sem marca separada de administrador")
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": prov})
ok(st == 401, "senha provisória antiga deixa de valer")

app = open(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "..", "index.html"), encoding="utf-8").read()
mods = re.findall(r"^ \['(\w+)','", app[app.index("const MODULES=["):app.index("const OPS=")], re.M)
ok(sorted(mods) == sorted(m.AUTH_MODULOS) and len(mods) >= 18, "AUTH_MODULOS diferente de MODULES: %s" % sorted(set(mods) ^ set(m.AUTH_MODULOS)))

# 2. as 4 ações de Senhas de acesso são independentes; o perfil Admin sem a permissão não gera senha
doc("rafael.melo", {"venda": {"r": True}}, name="Rafael")
doc("vitima", {"venda": {"r": True}})
adm_sem = doc("admin.sem", {"usuarios": TUDO, "permissoes": TUDO, "venda": TUDO}, preset="admin")
ck_sem = entra("admin.sem", "lua cheia sobre o mar")
st, j, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, ck_sem)
ok(st == 403, "administrador sem a permissão não gera senha: %s" % st)
st, _, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"})
ok(st == 401, "sem sessão não gera senha")
doc("so.criar", {"senhas": {"c": True}, "venda": TUDO})
ck_c = entra("so.criar", "pedra rolando no rio")
st, j, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, ck_c)
ok(st == 200 and j.get("senha"), "Criar gera a primeira senha: %s" % st)
primeira = j.get("senha")
st, _, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, ck_c)
ok(st == 403, "só Criar não gera outra para quem já tem: %s" % st)
st, _, _ = pede("/auth/senhas", cookie=ck_c)
ok(st == 403, "só Criar não vê quem tem senha")
st, _, _ = pede("/auth/senha/cancelar", {"usuario": "rafael.melo"}, ck_c)
ok(st == 403, "só Criar não cancela")
doc("so.alterar", {"senhas": {"u": True, "r": True}, "venda": TUDO})
ck_u = entra("so.alterar", "folha seca voa alto")
st, j, _ = pede("/auth/senhas", cookie=ck_u)
ok(st == 200 and "rafael.melo" in j["senhas"] and "hash" not in json.dumps(j), "Ver mostra quem tem senha, sem o hash")
st, _, _ = pede("/auth/senha/gerar", {"usuario": "vitima"}, ck_u)
ok(st == 403, "só Alterar não gera a primeira: %s" % st)
st, j, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, ck_u)
ok(st == 200 and j.get("senha") != primeira, "Alterar gera outra")
provis = j["senha"]
st, _, _ = pede("/auth/senha/gerar", {"usuario": "so.alterar"}, ck_u)
ok(st == 400, "não gera senha para si mesmo")
st, _, _ = pede("/auth/senha/gerar", {"usuario": "ronaldo"}, ck_u)
ok(st == 403, "não toma a conta de quem tem mais acesso")
st, _, _ = pede("/auth/senha/gerar", {"usuario": "inexistente"}, adm)
ok(st == 404, "sem cadastro não há senha")

# 3. vendedor sem e-mail entra; recebe o cadastro do servidor
st, j, ck = pede("/auth/trocar", {"usuario": "rafael.melo", "senha": provis, "nova": "janela azul abre cedo"})
ok(st == 200 and j.get("cadastro", {}).get("name") == "Rafael", "vendedor entra sem e-mail: %s" % st)
vend = cookie_de(ck)
st, _, _ = pede("/auth/senha/gerar", {"usuario": "vitima"}, vend)
ok(st == 403, "vendedor não gera senha")

# 4. quem grava o cadastro: sem sessão nada; com sessão, só o que as permissões deixam
def grava(cookie, usuario, valor):
    st, j, _ = pede("/ponto/docs", {"docs": [{"col": "usuarios", "id": idd(usuario), "valor": valor}]}, cookie)
    return j.get("recusados")


sobe = dict(ler("rafael.melo"), perms={"senhas": TUDO})
ok(grava(None, "rafael.melo", sobe) == 1 and not ler("rafael.melo")["perms"].get("senhas"), "sem sessão não muda permissões")
ok(grava(vend, "rafael.melo", sobe) == 1 and not ler("rafael.melo")["perms"].get("senhas"), "vendedor não se dá Senhas de acesso")
ok(grava(vend, "novo.usuario", {"email": "novo.usuario", "perms": {}}) == 1 and ler("novo.usuario") is None, "sem Criar em Usuários não cadastra")
ok(grava(ck_sem, "novo.usuario", {"email": "novo.usuario", "name": "Novo", "perms": {"venda": {"r": True}}}) == 0 and ler("novo.usuario"), "Criar em Usuários cadastra")
ok(grava(ck_sem, "rafael.melo", dict(ler("rafael.melo"), perms={"senhas": TUDO})) == 1, "não dá um acesso que não tem")
ok(grava(ck_sem, "ronaldo", dict(ler("ronaldo"), name="Outro")) == 1 and ler("ronaldo")["name"] == "Ronaldo Santos", "não mexe em quem tem mais acesso")
ok(grava(adm, "rafael.melo", dict(ler("rafael.melo"), perms={"venda": {"r": True}, "senhas": {"r": True}})) == 0 and ler("rafael.melo")["perms"]["senhas"]["r"] is True, "quem tem a permissão pode dar")
ok(grava(vend, "vitima", None) == 1 and ler("vitima"), "sem Excluir não apaga")
st, j, _ = pede("/ponto/docs", {"docs": [{"col": "diario", "id": "x", "valor": {"a": 1}}]})
ok(st == 200 and j.get("gravados") == 1, "as outras coleções seguem como antes")
# tirar a permissão vale na hora, sem nada para sincronizar
ok(grava(adm, "so.alterar", dict(ler("so.alterar"), perms={"venda": TUDO})) == 0, "admin tira a permissão")
st, _, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, ck_u)
ok(st == 403, "sem a permissão, não gera mais: %s" % st)

# 5. mesma resposta para usuário inexistente e senha errada; 5 erros bloqueiam; senha provisória nova libera
a = pede("/auth/entrar", {"usuario": "ninguem", "senha": "x"})
b = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "x"})
ok(a[0] == b[0] == 401 and a[1] == b[1], "erro igual para inexistente e senha errada")
for _ in range(4):
    pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "x"})
st, _, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "janela azul abre cedo"})
ok(st == 429, "5 erros bloqueiam até a senha certa: %s" % st)
st, j, _ = pede("/auth/senha/gerar", {"usuario": "rafael.melo"}, adm)
ok(st == 200, "gera senha para quem esqueceu")
st, j2, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": j["senha"]})
ok(st == 200 and j2.get("troca"), "senha provisória desbloqueia")
st, _, _ = pede("/auth/eu", cookie=vend)
ok(st == 401, "senha nova encerra as sessões antigas")

# 6. desativado perde o acesso; cancelar e excluir tiram a senha; sair encerra a sessão
st, j, ck = pede("/auth/trocar", {"usuario": "rafael.melo", "senha": j["senha"], "nova": "porta velha range muito"})
vend = cookie_de(ck)
ok(grava(adm, "rafael.melo", dict(ler("rafael.melo"), active=False)) == 0, "desativar grava")
st, _, _ = pede("/auth/eu", cookie=vend)
ok(st == 401, "desativado perde a sessão")
st, _, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "porta velha range muito"})
ok(st == 401, "desativado não entra")
ok(grava(adm, "rafael.melo", dict(ler("rafael.melo"), active=True)) == 0, "reativar grava")
st, _, _ = pede("/auth/senha/cancelar", {"usuario": "rafael.melo"}, adm)
ok(st == 200, "Excluir cancela a senha")
st, _, _ = pede("/auth/entrar", {"usuario": "rafael.melo", "senha": "porta velha range muito"})
ok(st == 401, "senha cancelada não entra")
m.auth_criar("rafael.melo", "teste")
ok(grava(adm, "rafael.melo", None) == 0 and ler("rafael.melo") is None and not m.auth_ler_cadastro("rafael.melo")[1], "excluir o cadastro leva a senha junto")
st, _, ck = pede("/auth/sair", {}, adm)
ok(st == 200 and "Max-Age=0" in ck, "sair limpa o cookie")
st, _, _ = pede("/auth/eu", cookie=adm)
ok(st == 401, "sair encerra a sessão no servidor")

# 7. origem: outro site não chama as rotas; sem X-Eterna também não
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": SENHA}, extra={"Origin": "https://exemplo.com"})
ok(st == 403, "outra origem é recusada")
st, _, _ = pede("/auth/entrar", {"usuario": "ronaldo", "senha": SENHA}, extra={"X-Eterna": "0"})
ok(st == 403, "sem X-Eterna é recusado")

# 8. nada legível no banco; credenciais fora de /ponto/docs
db = sqlite3.connect(m.ESTADO_DB)
tudo = "\n".join(str(l) for l in db.iterdump())
db.close()
ok(SENHA not in tudo and "porta velha" not in tudo, "senha legível no banco")
ok(not m.estado_col("credencial")["docs"] and "credencial" not in m.ESTADO_COLS, "credencial fora das coleções")

# 8b. esqueci a senha: provisória por e-mail, ao lado da senha atual, sem revelar quem existe
enviados = []
m.auth_enviar_reset = lambda destino, senha, idioma=None: enviados.append((destino, senha, idioma))
FRASE, FRASE2 = "uma frase bem comprida agora", "outra frase bem comprida depois"
def cad_reset(u, **k):
    m.estado_gravar({"docs": [{"col": "usuarios", "id": u, "valor": dict({"v": 2, "email": u, "name": "Pessoa " + u, "preset": "foto", "active": True, "perms": {"importar": TUDO}}, **k)}]})
cad_reset("com.email", contato="pessoa@exemplo.com")
m.auth_criar("com.email", "teste")
m.auth_trocar("com.email", FRASE)
st, j, _ = pede("/auth/esqueci", {"usuario": "nao.existe"})
st2, j2, _ = pede("/auth/esqueci", {"usuario": "com.email"})
ok(st == st2 == 200 and j == j2, "a resposta revela se o usuário existe")
for _ in range(100):
    if enviados:
        break
    time.sleep(0.1)
ok(len(enviados) == 1 and enviados[0][0] == "pessoa@exemplo.com", "e-mail não saiu para o endereço do cadastro: %s" % [e[0] for e in enviados])
prov = enviados[0][1] if enviados else ""
ok(prov not in json.dumps(j2), "a senha aparece na resposta")
ok(not m.auth_esqueci("com.email"), "segundo pedido em 15 minutos não manda outro e-mail")
st, _, ck = pede("/auth/entrar", {"usuario": "com.email", "senha": FRASE})
ok(st == 200 and ck, "pedir o reset derrubou a senha atual")
st, j, ck = pede("/auth/entrar", {"usuario": "com.email", "senha": prov})
ok(st == 200 and j.get("troca") and not ck, "a provisória do e-mail só serve para criar a senha: %s %s" % (st, j))
db = sqlite3.connect(m.ESTADO_DB)
db.execute("update credencial set bloqueado_ate=? where usuario='com.email'", (time.time() + 900,))
db.commit()
db.close()
st, _, _ = pede("/auth/entrar", {"usuario": "com.email", "senha": FRASE})
ok(st == 429, "usuário bloqueado ainda entra com a senha atual: %s" % st)
st, j, _ = pede("/auth/entrar", {"usuario": "com.email", "senha": prov})
ok(st == 200 and j.get("troca"), "a provisória do e-mail libera quem está bloqueado")
st, _, ck = pede("/auth/trocar", {"usuario": "com.email", "senha": prov, "nova": FRASE2})
ok(st == 200 and ck, "criar a senha com a provisória do e-mail")
st, _, _ = pede("/auth/entrar", {"usuario": "com.email", "senha": prov})
ok(st == 401, "a provisória do e-mail não serve duas vezes")
st, _, _ = pede("/auth/entrar", {"usuario": "com.email", "senha": FRASE})
ok(st == 401, "a senha antiga segue valendo depois da troca")
# vencida, sem e-mail, desativado, sem senha e falha de envio
db = sqlite3.connect(m.ESTADO_DB)
db.execute("delete from reset_senha")
db.commit()
db.close()
m.auth_reset_ip.clear()
ok(m.auth_esqueci("com.email"), "novo pedido depois de usada a anterior")
prov = enviados[-1][1]
db = sqlite3.connect(m.ESTADO_DB)
db.execute("update reset_senha set expira=? where usuario='com.email'", (time.time() - 1,))
db.commit()
db.close()
st, _, _ = pede("/auth/entrar", {"usuario": "com.email", "senha": prov})
ok(st == 401, "a provisória do e-mail vence em 30 minutos")
cad_reset("sem.email")
m.auth_criar("sem.email", "teste")
cad_reset("saiu", contato="saiu@exemplo.com", active=False)
m.auth_criar("saiu", "teste")
cad_reset("sem.senha", contato="novo@exemplo.com")
n = len(enviados)
ok(not m.auth_esqueci("sem.email") and not m.auth_esqueci("saiu") and not m.auth_esqueci("sem.senha") and len(enviados) == n, "e-mail saiu para sem e-mail, desativado ou sem senha")
def falha(destino, senha, idioma=None):
    raise OSError("sem internet")
m.auth_enviar_reset = falha
cad_reset("sem.rede", contato="rede@exemplo.com")
m.auth_criar("sem.rede", "teste")
ok(not m.auth_esqueci("sem.rede"), "falha de envio conta como enviado")
m.auth_enviar_reset = lambda destino, senha, idioma=None: enviados.append((destino, senha, idioma))
ok(m.auth_esqueci("sem.rede"), "falha de envio não prende o próximo pedido por 15 minutos")
m.auth_reset_ip.clear()
for _ in range(m.AUTH_RESET_IP):
    m.auth_esqueci("nao.existe", "10.0.0.9")
n = len(enviados)
db = sqlite3.connect(m.ESTADO_DB)
db.execute("delete from reset_senha")
db.commit()
db.close()
ok(not m.auth_esqueci("com.email", "10.0.0.9") and len(enviados) == n, "limite de pedidos por endereço")
# o e-mail é para onde vai a senha: mudar exige Alterar em Senhas de acesso
ed_sem = {"cadastro": {"email": "ed", "preset": "custom", "perms": {"usuarios": TUDO, "importar": TUDO}}}
ed_com = {"cadastro": {"email": "ed", "preset": "custom", "perms": {"usuarios": TUDO, "senhas": TUDO, "importar": TUDO}}}
a = {"email": "x", "name": "X", "contato": "x@exemplo.com", "perms": {"importar": TUDO}}
ok(m.auth_cadastro_recusa(ed_sem, "x", a, dict(a, contato="golpe@exemplo.com")) == "sem_permissao", "sem Senhas de acesso, muda o e-mail de outra pessoa")
ok(m.auth_cadastro_recusa(ed_com, "x", a, dict(a, contato="novo@exemplo.com")) is None, "com Senhas de acesso, não muda o e-mail")

# 8c. idioma: o servidor responde com código, cada um troca o próprio, e o e-mail sai no idioma da pessoa
ok(m.auth_senha_fraca("x", "", "curta") == "curta" and m.auth_senha_fraca("x", "", "1234567890123") == "so_numeros", "senha fraca responde com código")
p = {"email": "x", "name": "X", "idioma": "pt", "perms": {"importar": TUDO}}
sem = {"cadastro": {"email": "y", "perms": {"importar": TUDO}}}
ok(m.auth_cadastro_recusa({"cadastro": p}, "x", p, dict(p, idioma="en")) is None, "a pessoa não troca o próprio idioma")
ok(m.auth_cadastro_recusa(sem, "x", p, dict(p, idioma="en")) == "sem_permissao", "troca o idioma de outra pessoa sem permissão")
ok(m.auth_cadastro_recusa({"cadastro": p}, "x", p, dict(p, idioma="<b>")) == "sem_permissao", "idioma inválido aceito")
ok(m.auth_cadastro_recusa({"cadastro": p}, "x", p, dict(p, idioma="en", name="Outro")) == "sem_permissao", "trocar o idioma libera mudar o resto do cadastro")
m.auth_reset_ip.clear()
cad_reset("fala.ingles", contato="en@exemplo.com", idioma="en")
m.auth_criar("fala.ingles", "teste")
ok(m.auth_esqueci("fala.ingles") and enviados[-1][2] == "en", "o e-mail não sai no idioma da pessoa")

# 9. senha provisória vence em 72 horas; muitos erros do mesmo endereço param, mesmo mudando o usuário
doc("velho")
prov = m.auth_criar("velho", "teste")
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
srv.shutdown()

if falhas:
    print("FALHA login_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK login_agente: senhas óbvias recusadas, 4 ações de Senhas de acesso, gravação do cadastro conferida, bloqueio, desativar, origem e banco sem senha legível")
