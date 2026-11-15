# Fila de impressão com a DNP de cada posto (15/11): montada pelas vendas e impressões de hoje no banco de vendas.
# Roda com HOME temporário:  python3 -I testes/fila_postos_agente.py agente/eterna-agente.py
import importlib.util, sys, time
sys.dont_write_bytecode = True
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []
agora = m._iso()


def ev(idem, venda, tipo, posto, **d):
    return {"idem": idem, "venda": venda, "tipo": tipo, "em": agora, "posto": posto, "dados": d}


m.ev_receber({"eventos": [
    ev("ev-c1", "venda-1", "criar", "Posto 1", saleNo="P1-001", prints=3, selected=["ag_foto-a", "ag_foto-b", "<x>"]),
    ev("ev-c2", "venda-2", "criar", "Posto 2", saleNo="P2-001", prints=2),
    ev("ev-i2", "venda-2", "impressao", "Posto 2", resultado="ok", n=2, dnp={"mqty": 300, "status": 0}),
    ev("ev-c3", "venda-3", "criar", "Posto 3", saleNo="P3-001", prints=1),
    ev("ev-i3", "venda-3", "impressao", "Posto 3", resultado="nao_saiu", n=1, dnp={"mqty": 0, "status": 1100, "texto": "sem papel"}),
    ev("ev-c4", "venda-4", "criar", "Posto 1", saleNo="P1-002", prints=2),
    ev("ev-x4", "venda-4", "cancelar", "Posto 1"),
    ev("ev-c5", "venda-5", "criar", "Posto 4", saleNo="P4-001", prints=0),
    ev("ev-c6", "venda-6", "criar", "Posto 4", saleNo="P4-002", prints=1),
    ev("ev-i6", "venda-6", "impressao", "Posto 4", resultado="nao_saiu", n=1, fotos=["ag_foto-z", "ai:ag_foto-z|tunel", "ai:ag_foto-y|campeao"], dnp={"mqty": 200, "status": 0}),
]})
f = m.imp_fila_json()
m.ev_receber({"eventos": [ev("ev-c7", "venda-7", "criar", "Posto 2", saleNo="P2-002", prints=1),
                          ev("ev-i7", "venda-7", "impressao", "Posto 2", resultado="nao_saiu", n=1, dnp={"mqty": 0, "status": 1100, "texto": "sem papel"}),
                          ev("ev-r7", "rolo-2", "rolo", "Posto 2", dnp={"mqty": 700, "status": 0})]})
f = m.imp_fila_json()
por = {p["venda"]: p for p in f["pedidos"]}
ok = lambda c, msg: c or falhas.append(msg)
ok(set(f["impressoras"]) >= {"Posto 1", "Posto 2", "Posto 3", "Posto 4"}, "todas as impressoras dos postos: %s" % f["impressoras"])
ok(por.get("P1-001", {}).get("estado") == "na_fila" and por["P1-001"]["impressora"] == "Posto 1", "venda sem impressão espera no posto: %s" % por.get("P1-001"))
ok(por.get("P2-001", {}).get("estado") == "impresso" and por["P2-001"]["feitas"] == 2, "impressa: %s" % por.get("P2-001"))
ok(por.get("P3-001", {}).get("estado") == "erro" and "sem papel" in (por["P3-001"].get("erro") or ""), "não saiu: %s" % por.get("P3-001"))
ok("P1-002" not in por and "P4-001" not in por, "cancelada e sem impressão ficam fora: %s" % sorted(por))
ok(f["estados"].get("Posto 3", {}).get("estado") == "erro" and f["estados"]["Posto 3"].get("motivo") == "sem papel", "DNP do posto 3 parada: %s" % f["estados"].get("Posto 3"))
ok(f["estados"].get("Posto 1", {}).get("pendentes") == 1, "posto 1 com 1 esperando: %s" % f["estados"].get("Posto 1"))
ok(por.get("P1-001", {}).get("ids") == ["foto-a", "foto-b"], "miniaturas: ids das fotos da venda, sem o prefixo e sem id inválido: %s" % por.get("P1-001"))
ok(por.get("P4-002", {}).get("estado") == "na_fila" and por["P4-002"].get("ids") == ["foto-z", "foto-y"], "'Não saiu' sem erro da DNP volta a esperar no posto, não é erro: %s" % por.get("P4-002"))
f2 = m.imp_fila_postos(time.time() + m.IMP_NAO_SAIU_S + 60)
ok("P4-002" not in {p["venda"] for p in f2[2]}, "'Não saiu' parado há mais de 15 min sai da fila")
ok({p["venda"]: p for p in f["pedidos"]}.get("P2-002", {}).get("estado") == "na_fila", "erro da DNP some quando a DNP volta ao normal: %s" % {p["venda"]: p for p in f["pedidos"]}.get("P2-002"))
ok(all(p.get("local") for p in f["pedidos"]), "pedidos dos postos marcados como locais")
r = m.vendas_posto_sem_impressao("Posto 1")
ok([v["venda"] for v in r["vendas"]] == ["venda-1"] and r["vendas"][0]["dados"].get("saleNo") == "P1-001", "posto 1 recupera só a venda sem impressão: %s" % r)
ok([v["venda"] for v in m.vendas_posto_sem_impressao("Posto 2")["vendas"]] == ["venda-7"], "venda impressa não volta (só a que não saiu)")
ok([v["venda"] for v in m.vendas_posto_sem_impressao("Posto 3")["vendas"]] == ["venda-3"], "venda que não saiu volta para imprimir")
print(("FALHA fila dos postos: " + " | ".join(falhas)) if falhas else "OK fila de impressão com a DNP de cada posto (esperando, impressa, erro, cancelada fora, estado da DNP)")
sys.exit(1 if falhas else 0)
