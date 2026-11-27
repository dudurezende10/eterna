# 27/11: a conta de pessoas por visita (_pessoas_visitas). Rodar: python testes/pessoas_visitas_agente.py
import importlib.util, os, sys, tempfile

HA = tempfile.mkdtemp(prefix="eterna-visitas-")
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PESSOAS_DIR=os.path.join(HA, "hd", "contagens", "pessoas"))
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ag", os.path.join(RAIZ, "agente", "eterna-agente.py"))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

falhas = 0


def ok(c, t):
    global falhas
    print(("ok   " if c else "FALHA ") + t)
    falhas += 0 if c else 1


E = b""
# sessão A: família de 4 numa foto (rostos 200, 180, 150, 120) e um ao fundo (30): 1 reconhecida
# sessão B: a mesma família em outro ponto (ligada pelo cliente reconhecido): 3 rostos juntos
# sessão C: só costas (nenhum rosto)
# sessão D: casal (2 rostos), nenhum reconhecido
# sessão E: ligada a D pela venda, 1 rosto
# sessão F: rosto do fotógrafo (equipe) e 1 cliente
rows = [("a1", 200, E), ("a1", 180, E), ("a1", 150, E), ("a1", 120, E), ("a1", 30, E),
        ("b1", 100, E), ("b1", 90, E), ("b1", 80, E),
        ("d1", 100, E), ("d1", 90, E),
        ("e1", 100, E),
        ("f1", 150, E), ("f1", 140, E)]
sess = {"a1": "A", "b1": "B", "c1": "C", "d1": "D", "e1": "E", "f1": "F"}
P = [{"m": [0, 5], "cards": {"A", "B"}, "equipe": False},
     {"m": [11], "cards": {"F", "X1", "X2", "X3"}, "equipe": True},
     {"m": [12], "cards": {"F"}, "equipe": False}]
m._ev_ler = lambda dia: [{"venda": "v1", "tipo": "criar", "dados": {"card": "D", "sessoes": ["E"]}}]
extra, vis, n = m._pessoas_visitas("2026-11-26", rows, P, sess)
# visitas: {A,B}=4 (1 reconhecida -> +3), C=1 (+1), {D,E}=2 (+2), F=1 (1 reconhecida, equipe fora -> +0)
ok(vis == 4 and n == 6, "4 visitas em 6 sessões (A+B pelo cliente, D+E pela venda)")
ok(extra == 6, "somam 6 além das 2 reconhecidas: família de 4, sessão de costas, casal; fundo e equipe fora (%s)" % extra)
ok(2 + extra >= vis, "nunca menos pessoas que visitas")
print("\n" + ("tudo certo" if not falhas else "%d falhas" % falhas))
sys.exit(1 if falhas else 0)
