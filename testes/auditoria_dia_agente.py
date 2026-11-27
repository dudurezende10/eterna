# 26/11 (Ronaldo): auditoria diária às 21h, só do dia, com o resultado por e-mail pela nuvem.
#   python3 -I testes/auditoria_dia_agente.py agente/eterna-agente.py
import importlib.util, io, json, os, sys, tempfile, contextlib
AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []
def ok(c, msg):
    print(("ok   " if c else "FALHA ") + msg)
    if not c:
        falhas.append(msg)
HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PESSOAS_DIR=os.path.join(HA, "hd", "contagens", "pessoas"))
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
with contextlib.redirect_stdout(io.StringIO()):
    sp = importlib.util.spec_from_file_location("ag", AG)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
hoje = m._ff_hoje()
m.pessoas_contar = lambda dia, forcar=False: {"resultado": {"pessoas": 300}, "auditoria": {"fotos_do_dia": 100, "fotos_sem_leitura": 0,
    "sessoes_com_rosto": 50, "sessoes_com_cliente": 50, "ressalvas": []}}
m.metricas_gravar = lambda dia: {"faturamento": 320.0}
m.vendas_do_dia = lambda: [
    {"venda": "a", "saleNo": "P1-001", "meio": "pix", "total": 250, "vendedor": "X", "selected": ["f"], "galeria": {"token": "t"}},
    {"venda": "b", "saleNo": "P1-002", "meio": "cartao", "total": 70, "vendedor": "", "selected": ["f"], "galeria": None},
    {"venda": "c", "saleNo": "P1-003", "meio": "cortesia", "total": None, "vendedor": "Y", "selected": ["f"] * 38, "galeria": {"token": "u"}, "posto": "Posto 17"},
    {"venda": "d", "saleNo": "P1-004", "meio": "pix", "total": 105, "cancelada": True}]
m._auditoria_pedidos_abertos = lambda: [{"saleNo": "P18-004", "posto": "Posto 18", "criada": "2026-11-25T08:57", "total": 70}]
m.visitantes = lambda de, ate: {"ok": True, "total": 1500}
m.selfies_dia = lambda dia: {"por_origem": {"checkout": {"selfies": 10, "achou": 6}}}
with contextlib.redirect_stdout(io.StringIO()):
    j = m.auditoria_dia()
d = "\n".join(j["desvios"])
ok(os.path.exists(os.path.join(m.AUDITORIA_DIR, hoje + ".json")), "auditoria gravada no HD")
ok("P1-002: venda paga sem vendedor" in d and "P1-002: venda com fotos sem galeria online" in d, "venda sem vendedor e sem galeria")
ok("P1-003: cortesia" in d and "P18-004" in d, "cortesia e pedido aberto aparecem")
ok("P1-004" not in d, "cancelada não é desvio")
ok(not any("Faturamento" in x for x in j["desvios"]), "faturamento bate (320)")
ok(["Abordagem (pessoas ÷ visitantes)", "20.0%"] in j["numeros"], "abordagem calculada")
try:
    m.auditoria_dia("2020-01-01"); ok(False, "passado recusado")
except ValueError:
    ok(True, "auditoria do passado é recusada")
env = []
m.NUVEM_API = "http://nuvem.teste"
class R:
    def read(s): return b"{}"
    def __enter__(s): return s
    def __exit__(s, *a): return False
m.urllib.request.urlopen = lambda rq, timeout=None: env.append(json.loads(rq.data)) or R()
ok(m.auditoria_email(j) and env[0]["dia"] == hoje and env[0]["desvios"] == j["desvios"], "e-mail vai pela nuvem com o resultado")
print("\n" + ("tudo certo" if not falhas else "%d falha(s)" % len(falhas)))
sys.exit(1 if falhas else 0)
