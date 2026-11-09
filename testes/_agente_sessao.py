# Ajudante dos testes que falam com o agente de verdade: cria uma pessoa com sessão aberta e um posto pareado no estado.db
# do HOME do teste e devolve os cookies. Não é teste (começa com _).
#   No mesmo processo:  import _agente_sessao as S; S.cookie_sessao(m) / S.cookie_posto(m)
#   Para o Node:        HOME=<home do agente> python3 -I testes/_agente_sessao.py agente/eterna-agente.py sessao <usuario> [perms-json]
#                       HOME=<home do agente> python3 -I testes/_agente_sessao.py agente/eterna-agente.py posto "<nome>"
import json, sys

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


if __name__ == "__main__":
    import importlib.util
    sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    if sys.argv[2] == "sessao":
        print(cookie_sessao(m, sys.argv[3], json.loads(sys.argv[4]) if len(sys.argv) > 4 else None))
    elif sys.argv[2] == "posto":
        print(cookie_posto(m, sys.argv[3] if len(sys.argv) > 3 else "Posto de teste"))
