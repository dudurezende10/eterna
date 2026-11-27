# 26/11 (Ronaldo: "não dá pra ter falha nisso"): o agente lê os visitantes do Maraca Acessos com a chave própria (X-Eterna-Chave),
# mostra só o SHA-256 quando falha e guarda no disco o último número bom de cada período.
#   python3 -I testes/visitantes_chave_agente.py agente/eterna-agente.py
import importlib.util, io, json, os, sys, tempfile, contextlib, hashlib
AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []
def ok(c, msg):
    print(("ok   " if c else "FALHA ") + msg)
    if not c:
        falhas.append(msg)
HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1")
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
with contextlib.redirect_stdout(io.StringIO()):
    sp = importlib.util.spec_from_file_location("ag", AG)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
vistos = []
class R:
    def __init__(s, b): s.b = b
    def read(s, n=-1): return s.b
    def __enter__(s): return s
    def __exit__(s, *a): return False
modo = {"falha": True}
def abrir(rq, timeout=None):
    vistos.append(dict(rq.header_items()))
    if modo["falha"]:
        raise OSError("HTTP Error 401: Unauthorized")
    return R(json.dumps({"total_hoje": 812, "total_ontem": 700, "por_hora": {"hoje": [0] * 10 + [50] * 14}}).encode())
m.urllib.request.urlopen = abrir
with contextlib.redirect_stdout(io.StringIO()):
    r = m.visitantes("2026-11-20", "2026-11-20")
ch = open(m.ACESSOS_CHAVE, encoding="utf8").read().strip()
ok(r["ok"] is False and r["chave_sha256"] == hashlib.sha256(ch.encode()).hexdigest() and ch not in json.dumps(r), "falha mostra só o SHA-256 da chave")
ok(any(v.get("X-eterna-chave") == ch for v in vistos), "a chave vai no cabeçalho X-Eterna-Chave")
modo["falha"] = False
m._acessos_cache.clear()
r = m.visitantes("2026-11-20", "2026-11-20")
ok(r["ok"] and r["total"] == 812, "com a chave aceita vem o total")
modo["falha"] = True
m._acessos_cache.clear()                      # reinício do agente
with contextlib.redirect_stdout(io.StringIO()):
    r = m.visitantes("2026-11-20", "2026-11-20")
ok(r["ok"] and r["total"] == 812 and r.get("guardado"), "falha depois do reinício: vem o último número bom do disco")
print("\n" + ("tudo certo" if not falhas else "%d falha(s)" % len(falhas)))
sys.exit(1 if falhas else 0)
