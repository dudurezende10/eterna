# 18/11 (Ronaldo): "importante ter relatório de cancelamento, eles estarem nas estatísticas".
# Venda paga e depois cancelada sai do faturamento do dia em que foi feita, entra nos estornos e no relatório de cancelamentos
# (quem, quando, motivo, valor); cancelamento dias depois refaz o resumo daquele dia; a venda não conta no dia do cancelamento.
#   python3 -I testes/cancelamentos_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, tempfile, time

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


H = tempfile.mkdtemp()
os.environ["HOME"] = H
os.environ["USERPROFILE"] = H
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.makedirs(os.path.join(H, "Eterna"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.sess_rostos_on = lambda: False

agora = time.time()
antes = agora - 3 * 86400                      # três dias atrás: o metricas_loop não refaz mais esse dia sozinho
D0, HOJE = m._ev_dia(iso(antes)), m._ev_dia(iso(agora))
venda = lambda v, t, total, no: [
    {"tipo": "criar", "idem": v + ":1", "venda": v, "seq": 1, "em": iso(t), "por": {"nome": "Vendedor Teste"},
     "dados": {"card": "LP" + v.upper()[-6:], "saleNo": no, "total": total, "nPh": 3, "meio": "pix", "vendedor": {"nome": "Vendedor Teste"}}},
    {"tipo": "pagar", "idem": v + ":2", "venda": v, "seq": 2, "em": iso(t + 30), "dados": {}}]
m.ev_receber({"posto": "Caixa 1", "eventos": venda("vca001", antes, 150, "P1-001") + venda("vca002", antes + 60, 220, "P1-002")})
m.ev_receber({"posto": "Caixa 1", "eventos": venda("vca003", agora - 120, 90, "P1-003")})
r0 = m.metricas_gravar(D0)
ok(r0["vendas"] == 2 and r0["faturamento"] == 370, "antes do cancelamento, o dia antigo tem 2 vendas e 370: %r" % ((r0["vendas"], r0["faturamento"]),))

# o Admin cancela hoje a venda de três dias atrás, com motivo
m.ev_receber({"posto": "Caixa 1", "eventos": [{"tipo": "cancelar", "idem": "vca002:3", "venda": "vca002", "seq": 3, "em": iso(agora - 30),
                                                 "por": {"nome": "Admin Teste"}, "dados": {"motivo": "venda_cancelada", "obs": "cliente desistiu"}}]})
for _ in range(50):                            # o resumo do dia antigo é refeito em segundo plano
    try:
        r1 = json.load(open(m.met_arquivo(D0), encoding="utf8")) if hasattr(m, "met_arquivo") else m.metricas_dia(D0)
    except Exception:
        r1 = None
    if r1 and (r1.get("estornos") or {}).get("vendas"):
        break
    time.sleep(0.1)
r1 = m.metricas_dia(D0)
ok(r1["vendas"] == 1 and r1["faturamento"] == 150, "a cancelada sai do faturamento do dia da venda: %r" % ((r1["vendas"], r1["faturamento"]),))
ok(r1["estornos"] == {"vendas": 1, "valor": 220.0, "fotos": 3}, "estornos do dia: %r" % r1["estornos"])
c = (r1["cancelamentos"] or [{}])[0]
ok(len(r1["cancelamentos"]) == 1 and c.get("no") == "P1-002" and c.get("valor") == 220 and c.get("motivo") == "cliente desistiu"
   and c.get("em") == iso(agora - 30) and c.get("por") and c.get("vendedor") == "Vendedor Teste", "relatório: quem, quando, motivo e valor: %r" % c)
ok(r1["canceladas"] == 1, "canceladas no dia da venda: %r" % r1["canceladas"])
rh = m.metricas_dia(HOJE)
ok(rh["vendas"] == 1 and rh["faturamento"] == 90 and not rh["cancelamentos"] and rh["canceladas"] == 0,
   "hoje: só a venda de hoje; a de três dias atrás não conta no dia do cancelamento: %r" % ((rh["vendas"], rh["faturamento"], rh["canceladas"]),))

if falhas:
    print("FALHA cancelamentos_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK cancelamentos_agente: cancelada sai do faturamento, estornos, relatório com quem/quando/motivo, dia antigo refeito, sem contar no dia do cancelamento")
