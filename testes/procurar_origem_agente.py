# 26/11 (plano docs/planos/2026-11-26-procurar-vender.md, critérios 20 a 22): a venda aberta pelo vendedor no Procurar fotos leva
# "origem" no evento criar. O agente só guarda origem da lista EV_ORIGENS, soma por_origem na métrica do dia e devolve a origem
# nas vendas de hoje. Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/procurar_origem_agente.py agente/eterna-agente.py
# Vendas e sessões sintéticas, nenhum dado de cliente.
import importlib.util, json, os, sys, tempfile, time

sys.dont_write_bytecode = True
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

ok(m.EV_ORIGENS == ("procurar", "procurar_selfie"), "lista de origens: %r" % (m.EV_ORIGENS,))

# --- 20: _ev_limpo guarda origem válida e descarta a inválida; a venda fica ---
EM = time.time() - 600
base = {"tipo": "criar", "idem": "vpo001:1", "venda": "vpo001", "em": iso(EM),
        "dados": {"card": "LPPOA0001", "sessoes": ["LPPOA0001", "LPPOB0002"], "total": 220, "canal": "checkout", "origem": "procurar"}}
e = m._ev_limpo(base)
ok(e and e["dados"].get("origem") == "procurar" and e["dados"].get("sessoes") == ["LPPOA0001", "LPPOB0002"] and e["dados"].get("total") == 220,
   "20: origem procurar fica, com as sessões: %r" % (e and e["dados"]))
e2 = m._ev_limpo({**base, "dados": {**base["dados"], "origem": "procurar_selfie"}})
ok(e2 and e2["dados"].get("origem") == "procurar_selfie", "20: origem procurar_selfie fica: %r" % (e2 and e2["dados"]))
for ruim in ("outra", "PROCURAR", "procurar ", "<b>", "", None, 7, ["procurar"], {"x": 1}, True):
    r = m._ev_limpo({**base, "dados": {**base["dados"], "origem": ruim}})
    ok(r is not None and "origem" not in r["dados"] and r["dados"].get("total") == 220 and r["dados"].get("card") == "LPPOA0001",
       "20: origem inválida %r sai e a venda fica: %r" % (ruim, r and r["dados"]))
sem = m._ev_limpo({**base, "dados": {"card": "LPPOA0001", "total": 220}})
ok(sem is not None and "origem" not in sem["dados"], "20: venda sem origem continua sem o campo: %r" % (sem and sem["dados"]))

# --- 21 e 22: vendas de hoje gravadas pelo caminho de verdade (ev_receber) ---
agora = time.time()
t = agora - 300
evs = [
    # procurar (2 sessões), paga
    {"tipo": "criar", "idem": "vpo101:1", "venda": "vpo101", "em": iso(t), "posto": "Caixa 1",
     "dados": {"card": "LPPOA0001", "sessoes": ["LPPOA0001", "LPPOB0002"], "total": 220, "canal": "checkout", "origem": "procurar", "saleNo": "L0-101"}},
    {"tipo": "pagar", "idem": "vpo101:2", "venda": "vpo101", "em": iso(t + 5), "dados": {}},
    # procurar_selfie, paga
    {"tipo": "criar", "idem": "vpo102:1", "venda": "vpo102", "em": iso(t + 10), "posto": "Caixa 1",
     "dados": {"card": "LPPOC0003", "total": 100, "canal": "checkout", "origem": "procurar_selfie", "saleNo": "L0-102"}},
    {"tipo": "pagar", "idem": "vpo102:2", "venda": "vpo102", "em": iso(t + 15), "dados": {}},
    # sem origem (selfie do cliente ou código do recibo), paga
    {"tipo": "criar", "idem": "vpo103:1", "venda": "vpo103", "em": iso(t + 20), "posto": "Caixa 1",
     "dados": {"card": "LPPOD0004", "total": 70, "canal": "checkout", "saleNo": "L0-103"}},
    {"tipo": "pagar", "idem": "vpo103:2", "venda": "vpo103", "em": iso(t + 25), "dados": {}},
    # origem inválida, paga: conta como sem origem
    {"tipo": "criar", "idem": "vpo104:1", "venda": "vpo104", "em": iso(t + 30), "posto": "Caixa 2",
     "dados": {"card": "LPPOE0005", "total": 30, "canal": "balcao", "origem": "inventada", "saleNo": "L0-104"}},
    {"tipo": "pagar", "idem": "vpo104:2", "venda": "vpo104", "em": iso(t + 35), "dados": {}},
    # procurar, ainda não paga: fica fora das somas (a mesma regra do por_canal)
    {"tipo": "criar", "idem": "vpo105:1", "venda": "vpo105", "em": iso(t + 40), "posto": "Caixa 1",
     "dados": {"card": "LPPOF0006", "total": 999, "canal": "checkout", "origem": "procurar", "saleNo": "L0-105"}},
]
r = m.ev_receber({"posto": "Caixa 1", "eventos": evs})
ok(all(x["s"] == "ok" for x in r["resultados"]), "eventos gravados: %r" % r)

DIA = m._ev_dia(iso(agora))
v2 = m.met_v2(DIA, [], m._ev_ler(DIA))
po = v2.get("por_origem") or {}
ok(po.get("procurar") == {"vendas": 1, "faturamento": 220.0}, "21: por_origem.procurar: %r" % po)
ok(po.get("procurar_selfie") == {"vendas": 1, "faturamento": 100.0}, "21: por_origem.procurar_selfie: %r" % po)
ok(po.get("sem_origem") == {"vendas": 2, "faturamento": 100.0}, "21: venda sem origem (ou com origem inválida) cai em sem_origem: %r" % po)
ok(set(po) == {"procurar", "procurar_selfie", "sem_origem"}, "21: só as origens conhecidas e sem_origem: %r" % sorted(po))
pc = v2.get("por_canal") or {}
ok(sum(g["vendas"] for g in po.values()) == sum(g["vendas"] for g in pc.values()) == 4
   and round(sum(g["faturamento"] for g in po.values()), 2) == round(sum(g["faturamento"] for g in pc.values()), 2) == 420.0,
   "21: por_origem soma o mesmo que por_canal: %r %r" % (po, pc))
vazio = m.met_v2("2020-01-01", [], [])
ok(vazio.get("por_origem") == {}, "21: dia sem venda tem por_origem vazio: %r" % vazio.get("por_origem"))
md = m.metricas_dia(DIA)
ok((md.get("por_origem") or {}).get("procurar", {}).get("vendas") == 1, "21: o resumo do dia traz por_origem: %r" % md.get("por_origem"))

vd = m.vendas_do_dia(agora=agora)
lista = vd.get("vendas") if isinstance(vd, dict) else vd
por = {v["venda"]: v for v in lista}
ok(por.get("vpo101", {}).get("origem") == "procurar" and por["vpo101"].get("sessoes") == ["LPPOA0001", "LPPOB0002"], "22: vendas_do_dia devolve a origem e as sessões: %r" % por.get("vpo101"))
ok(por.get("vpo102", {}).get("origem") == "procurar_selfie", "22: origem procurar_selfie: %r" % por.get("vpo102"))
ok("origem" in por.get("vpo103", {}) and por["vpo103"]["origem"] is None, "22: venda sem origem volta com origem vazia: %r" % por.get("vpo103"))
ok(por.get("vpo104", {}).get("origem") is None, "22: origem inválida não volta: %r" % por.get("vpo104"))

print(("FALHA origem da venda (Procurar fotos): " + " | ".join(falhas)) if falhas else "OK origem da venda (Procurar fotos): lista branca no evento, por_origem na métrica do dia e origem nas vendas de hoje")
sys.exit(1 if falhas else 0)
