# Ajudante dos testes que falam com o agente de verdade: cria uma pessoa com sessão aberta e um posto pareado no estado.db
# do HOME do teste e devolve os cookies. Não é teste (começa com _).
#   No mesmo processo:  import _agente_sessao as S; S.cookie_sessao(m) / S.cookie_posto(m)
#   Para o Node:        HOME=<home do agente> python3 -I testes/_agente_sessao.py agente/eterna-agente.py sessao <usuario> [perms-json]
#                       HOME=<home do agente> python3 -I testes/_agente_sessao.py agente/eterna-agente.py posto "<nome>"
import json, os, sys


def pasta_real():
    """A pasta pessoal de verdade, sem olhar o HOME (que o teste troca): pwd no Linux e no Mac; HOMEDRIVE+HOMEPATH no Windows."""
    try:
        import pwd
        return pwd.getpwuid(os.getuid()).pw_dir
    except ImportError:
        return (os.environ.get("HOMEDRIVE") or "") + (os.environ.get("HOMEPATH") or "") or os.path.expanduser("~")


def exige_home_temporario():
    """Os testes nunca gravam no ~/Eterna de verdade: sem HOME temporário, param aqui."""
    h = os.path.realpath(os.environ.get("HOME") or os.environ.get("USERPROFILE") or "")
    real = os.path.realpath(pasta_real())
    if not h or h == real or h == "/":
        sys.exit("FALHA teste do agente: rode com HOME temporário (ex.: HOME=$(mktemp -d)), nunca no ~/Eterna real")


exige_home_temporario()
TUDO = {"c": True, "r": True, "u": True, "d": True}


def cookie_sessao(m, usuario="admin-teste", perms=None):
    """Cadastro ativo (todas as permissões, ou as de perms) + sessão aberta. -> 'eterna_sessao=<token>'"""
    if perms is None:
        perms = {k: dict(TUDO) for k in m.AUTH_MODULOS}
    v = {"v": 2, "email": usuario, "name": usuario, "active": True, "preset": "admin" if perms and len(perms) == len(m.AUTH_MODULOS) else "custom", "perms": perms}
    m.estado_gravar({"docs": [{"col": "usuarios", "id": m.quote(usuario, safe="-_.!~*'()"), "valor": v}]})
    return "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova(usuario))


def cookie_posto(m, nome="Posto de teste"):
    """Posto pareado. -> 'eterna_posto=<token>'"""
    token, _ = m.posto_criar(nome, "teste")
    return "%s=%s" % (m.POSTO_COOKIE, token)


def cookie_sub(ag, home, tipo="sessao", *args):
    """O mesmo, para um agente que roda em outro processo com HOME=home: grava no estado.db dele e devolve o cookie."""
    import os, subprocess
    env = dict(os.environ, HOME=home, USERPROFILE=home, ETERNA_SEM_OPENCV="1")
    r = subprocess.run([sys.executable, "-I", os.path.abspath(__file__), ag, tipo] + [str(a) for a in args], env=env, capture_output=True, text=True, timeout=120)
    return r.stdout.strip().splitlines()[-1]


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    import importlib.util
    sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    if sys.argv[2] == "sessao":
        print(cookie_sessao(m, sys.argv[3] if len(sys.argv) > 3 else "admin-teste", json.loads(sys.argv[4]) if len(sys.argv) > 4 else None))
    elif sys.argv[2] == "posto":
        print(cookie_posto(m, sys.argv[3] if len(sys.argv) > 3 else "Posto de teste"))
