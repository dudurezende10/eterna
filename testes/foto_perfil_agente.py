# Foto do perfil (17/11): o servidor só aceita JPEG pequeno em data URL; a própria foto cada um troca, a de outra pessoa pede
# Alterar em Cadastro de usuários. Roda com HOME temporário:  python3 -I testes/foto_perfil_agente.py agente/eterna-agente.py
import base64, importlib.util, os, sys

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


FOTO = "data:image/jpeg;base64," + base64.b64encode(os.urandom(3000)).decode()
TODOS = {k: {"c": True, "r": True, "u": True, "d": True} for k in m.AUTH_MODULOS}
admin = {"email": "admin@x.com", "name": "Admin", "preset": "admin", "perms": TODOS, "active": True}
venda = {"email": "caixa.um", "name": "Caixa", "preset": "venda", "perms": {"venda": {"c": True, "r": True, "u": True, "d": False}}, "active": True}
outro = {"email": "caixa.dois", "name": "Caixa 2", "preset": "venda", "perms": {"venda": {"c": True, "r": True, "u": True, "d": False}}, "active": True}
Q = lambda u: {"cadastro": u}
com = lambda u, f: dict(u, foto=f)

ok(m.auth_cadastro_recusa(Q(admin), "caixa.dois", outro, com(outro, FOTO)) is None, "admin põe a foto de outra pessoa")
ok(m.auth_cadastro_recusa(Q(venda), "caixa.um", venda, com(venda, FOTO)) is None, "a pessoa põe a própria foto")
ok(m.auth_cadastro_recusa(Q(venda), "caixa.um", com(venda, FOTO), venda) is None, "a pessoa tira a própria foto")
ok(m.auth_cadastro_recusa(Q(venda), "caixa.dois", outro, com(outro, FOTO)) == "sem_permissao", "sem Cadastro de usuários não mexe na foto de outra pessoa")
ok(m.auth_cadastro_recusa(Q(admin), "caixa.dois", outro, com(outro, "data:image/svg+xml;base64,PHN2Zz4=")) == "invalido", "só JPEG")
ok(m.auth_cadastro_recusa(Q(admin), "caixa.dois", outro, com(outro, "https://x.com/a.jpg")) == "invalido", "endereço de fora recusado")
ok(m.auth_cadastro_recusa(Q(admin), "caixa.dois", outro, com(outro, "data:image/jpeg;base64," + "A" * 70000)) == "invalido", "foto grande demais recusada")
ok(m.auth_cadastro_recusa(Q(admin), "caixa.tres", None, dict(outro, email="caixa.tres", foto=FOTO)) is None, "cadastro novo já com foto")

if falhas:
    print("FALHA foto_perfil_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK foto_perfil_agente: JPEG pequeno, a própria foto livre, a de outra pessoa com Cadastro de usuários")
