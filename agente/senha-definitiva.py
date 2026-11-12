# Senha definitiva para vários acessos de uma vez, digitada no terminal do servidor pelo administrador.
# A senha não aparece na tela nem fica em arquivo: só o hash, como na troca pela tela. Passa pelo mesmo filtro de senha fraca.
# Quem recebe não precisa trocar no primeiro acesso. Cada troca fica no histórico de login ("senha_definida_terminal").
#
# Uso (no servidor, com a pasta de dados do agente):
#   python agente/senha-definitiva.py --casa <pasta home do servidor> --perfil ativ
#   python agente/senha-definitiva.py --casa <pasta home do servidor> julio.gama pedro.nunes
# A opção --aceitar-fraca existiu só para a carga inicial dos vendedores (12/11, commit 6902737) e foi retirada a pedido do Ronaldo.
# --perfil ativ = todos os acessos ativos com o perfil "Vendedor Drone, Chute a Gol e Snap Pop".
import argparse, getpass, importlib.util, json, os, secrets, sys, time

sys.dont_write_bytecode = True
ap = argparse.ArgumentParser(description="Define a mesma senha definitiva para os acessos escolhidos.")
ap.add_argument("--casa", required=True, help="pasta home do servidor (a mesma que o agente usa)")
ap.add_argument("--perfil", help="todos os acessos ativos deste perfil (ex.: ativ)")
ap.add_argument("usuarios", nargs="*", help="logins, se não usar --perfil")
a = ap.parse_args()
if not os.path.isdir(a.casa):
    sys.exit("pasta não encontrada: " + a.casa)
if bool(a.perfil) == bool(a.usuarios):
    sys.exit("informe --perfil ou a lista de logins (um dos dois)")
os.environ.update(HOME=a.casa, USERPROFILE=a.casa)

sp = importlib.util.spec_from_file_location("ag", os.path.join(os.path.dirname(os.path.abspath(__file__)), "eterna-agente.py"))
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)

db = m.auth_db()
try:
    cads = {}
    for (v,) in db.execute("select valor from doc where col='usuarios' and valor is not null"):
        c = json.loads(v)
        if isinstance(c, dict) and c.get("email") and not c.get("deleted"):
            cads[c["email"]] = c
finally:
    db.close()

if a.perfil:
    alvo = sorted(u for u, c in cads.items() if c.get("preset") == a.perfil and m.auth_ativo(c))
else:
    falta = [u for u in a.usuarios if u not in cads or not m.auth_ativo(cads[u])]
    if falta:
        sys.exit("sem cadastro ativo: " + ", ".join(falta))
    alvo = a.usuarios
if not alvo:
    sys.exit("nenhum acesso encontrado")
if any(m.auth_pode(cads[u], "usuarios", "u") or m.auth_pode(cads[u], "senhas", "u") for u in alvo):
    sys.exit("a lista tem quem administra acessos; para esses, a senha é trocada pela própria pessoa")

print("Vai receber a mesma senha definitiva (%d):" % len(alvo))
for u in alvo:
    print("  %-22s %s" % (u, cads[u].get("name") or ""))
if input("Confirma? (s/n) ").strip().lower() != "s":
    sys.exit("nada mudou")
s1 = getpass.getpass("Senha (não aparece): ")
s2 = getpass.getpass("Repita a senha: ")
if s1 != s2:
    sys.exit("as duas não batem; nada mudou")
fracas = [(u, r) for u in alvo for r in [m.auth_senha_fraca(u, cads[u].get("name"), s1)] if r]
if fracas:
    motivos = {"curta": "curta (mínimo %d)" % m.AUTH_SENHA_MIN, "so_numeros": "só números", "repetida": "letras repetidas",
               "obvia": "fácil de adivinhar (nome, sequência ou palavra óbvia)"}
    sys.exit("senha recusada: %s; nada mudou" % motivos.get(fracas[0][1], fracas[0][1]))

with m.estado_lock:
    db = m.auth_db()
    try:
        for u in alvo:
            sal = secrets.token_hex(16)
            h = m.auth_hash(s1, sal, m.AUTH_N)
            db.execute("insert into credencial (usuario, hash, sal, n, provisoria, erros, bloqueado_ate, atualizada) values (?, ?, ?, ?, 0, 0, 0, ?)"
                       " on conflict(usuario) do update set hash=excluded.hash, sal=excluded.sal, n=excluded.n, provisoria=0, erros=0, bloqueado_ate=0,"
                       " atualizada=excluded.atualizada", (u, h, sal, m.AUTH_N, time.time()))
            db.execute("delete from sessao_login where usuario=?", (u,))
            db.execute("delete from reset_senha where usuario=?", (u,))
            m.auth_log(db, u, "senha_definida_terminal", "terminal", "")
        db.commit()
    finally:
        db.close()
print("pronto: %d acessos com a senha nova" % len(alvo))
