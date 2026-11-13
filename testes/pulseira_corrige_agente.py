# v99.28: cada item tem a sua pulseira (Chute a Gol e Snap Pop também) e ela pode ser corrigida depois da venda. A venda grava
# como cada pulseira foi lida (câmera ou digitado), quando e por quem; cada correção fica no histórico (ativ_pulseira_log).
# O vendedor corrige só as próprias vendas; pulseira de outra compra é recusada; a que já decolou não muda.
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/pulseira_corrige_agente.py agente/eterna-agente.py
import importlib.util, os, sys, time
sys.dont_write_bytecode = True
os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


HOJE = time.strftime("%Y-%m-%d")
venda = lambda vid, tipo, itens, puls, usuario="v1": {"id": vid, "tipo": tipo, "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 100,
                                                       "sugerido": 100, "itens": itens, "pulseiras": puls, "vendedor": "V", "usuario": usuario}
try:
    r = m.ativ_receber([
        venda("TCORR0001D", "drone", [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 2, "pessoas": 1, "videos": 2}],
              [{"n": "501", "meio": "camera", "em": HOJE + "T09:58:00"}]),                       # esqueceu a segunda
        venda("TCORR0001C", "chute", [{"cat": "chute", "produto": "chute3", "op": "", "qtd": 1, "videos": 0}], [{"n": "601", "meio": "digitado"}]),
        venda("TCORR0002D", "drone", [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 1}], ["701"], "v2"),
    ], "v1")
    ok(sorted(r["recebidas"]) == ["TCORR0001C", "TCORR0001D", "TCORR0002D"], "vendas: %s" % r)
    c = m.vendas_db()
    p = c.execute("select numero, slot, por, meio, lido_em from ativ_pulseira where venda='TCORR0001D'").fetchall()
    ok(p == [("501", 1, "v1", "camera", HOJE + "T09:58:00")], "como, quando e quem leu: %s" % p)
    ok(c.execute("select numero from ativ_pulseira where venda='TCORR0001C'").fetchall() == [("601",)], "Chute a Gol com a sua pulseira")
    c.close()
    vs = {v["id"]: v for v in m.ativ_vendas(HOJE, HOJE, "v1")}
    ok([x["numero"] for x in vs["TCORR0001D"]["pulseiras"]] == ["501"] and vs["TCORR0001D"]["pul_mov"] == {"camera": 1, "digitado": 0, "corrigidas": 0},
       "minhas vendas mostram as pulseiras: %s" % vs["TCORR0001D"])
    # inclui a que faltou
    e, ps = m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 2, "n": "0502", "meio": "camera"}]}, "v1", False)
    ok(e is None and [(x["numero"], x["slot"]) for x in ps] == [("501", 1), ("502", 2)], "incluiu a segunda: %s %s" % (e, ps))
    # de outro vendedor: não; supervisão: sim
    ok(m.ativ_pulseiras_edita({"id": "TCORR0002D", "pulseiras": [{"slot": 1, "n": "702"}]}, "v1", False)[0] == "sem_permissao", "venda de outro")
    ok(m.ativ_pulseiras_edita({"id": "TCORR0002D", "pulseiras": [{"slot": 1, "n": "702"}]}, "sup", True)[0] is None, "supervisão corrige")
    # pulseira de outra compra e repetida na mesma venda
    e, x = m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 1, "n": "702"}]}, "v1", False)
    ok(e == "pulseira_usada" and x == {"venda": "TCORR0002D"}, "de outra compra: %s %s" % (e, x))
    ok(m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 1, "n": "502"}]}, "v1", False)[0] == "repetida", "repetida")
    ok(m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 3, "n": "999"}]}, "v1", False)[0] == "dados", "item que não existe")
    # já decolou: não muda
    c = m.vendas_db()
    c.execute("update ativ_pulseira set voo_em=? where venda='TCORR0001D' and numero='501'", (HOJE + "T10:30:00",))
    c.commit()
    c.close()
    ok(m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 1, "n": "511"}]}, "v1", False)[0] == "travada", "já decolou")
    # troca a que não decolou e o histórico
    e, ps = m.ativ_pulseiras_edita({"id": "TCORR0001D", "pulseiras": [{"slot": 2, "n": "512", "meio": "digitado"}]}, "v1", False)
    ok(e is None and [x["numero"] for x in ps] == ["501", "512"] and ps[0]["travada"] and not ps[1]["travada"], "trocou: %s %s" % (e, ps))
    c = m.vendas_db()
    log = c.execute("select slot, numero, de, acao, por, meio from ativ_pulseira_log where venda='TCORR0001D' order by rowid").fetchall()
    c.close()
    ok(log == [(1, "501", None, "venda", "v1", "camera"), (2, "502", None, "incluiu", "v1", "camera"), (2, "512", "502", "trocou", "v1", "digitado")],
       "histórico: %s" % log)
    vs = {v["id"]: v for v in m.ativ_vendas(HOJE, HOJE)}
    ok(vs["TCORR0001D"]["pul_mov"] == {"camera": 1, "digitado": 0, "corrigidas": 2}, "movimentos para a estatística: %s" % vs["TCORR0001D"]["pul_mov"])
    ok(m.ativ_pulseira_busca("512")["vendas"][0]["venda"] == "TCORR0001D" and not m.ativ_pulseira_busca("502")["vendas"], "a entrega acha pela nova")
    # v99.30.2: a pulseira vale no dia: o mesmo número em outro dia não é de outra compra
    ONTEM = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    r = m.ativ_receber([{**venda("TCORR0009D", "drone", [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 1}], ["512"]),
                         "criado": ONTEM + "T10:00:00"}], "v1")
    c = m.vendas_db()
    conf = c.execute("select venda, conflito from ativ_pulseira where numero='512' order by venda").fetchall()
    c.close()
    ok(r["recebidas"] == ["TCORR0009D"] and conf == [("TCORR0001D", 0), ("TCORR0009D", 0)], "mesmo número ontem não é conflito: %s %s" % (r, conf))
    ok(m.ativ_pulseiras_edita({"id": "TCORR0002D", "pulseiras": [{"slot": 1, "n": "777"}]}, "sup", True)[0] is None, "troca livre do número")
    # v99.30: Chute a Gol sem vídeo: o chute é a entrega (Chutou na pulseira fecha a venda)
    fila = lambda vid: next(v for v in m.ativ_fila(HOJE) if v["id"] == vid)
    ok(not fila("TCORR0001C")["entregue_em"], "chute ainda não entregue")
    ok(m.ativ_etapa({"id": "TCORR0001C", "etapa": "chutou"}, "v1") == "pulseira", "Chutou sem pulseira")
    ok(m.ativ_etapa({"id": "TCORR0001C", "etapa": "chutou", "pulseira": "601"}, "v1") is None, "Chutou")
    f = fila("TCORR0001C")
    ok(f["entregue_em"] and f["pulseiras"][0]["voo_em"] and f["recebido_em"], "Chutou entrega a venda: %s" % f)
    # v99.29.3: vídeo entregue antes de a venda ter pulseira; a pulseira incluída depois fica com esse vídeo (não pede decolar de novo)
    m.ativ_receber([venda("TCORR0003D", "drone", [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 1}], [], "v1")], "v1")
    c = m.vendas_db()
    c.execute("update ativ_venda set voo_em=?, piloto='P', drone='D1', bateria='B1' where id='TCORR0003D'", (HOJE + "T09:58:00",))
    c.execute("insert into ativ_entrega (qr, venda, n, em) values (?, 'TCORR0003D', 1, ?)", ("Q" * 22, HOJE + "T09:59:00"))
    c.commit()
    c.close()
    e, ps = m.ativ_pulseiras_edita({"id": "TCORR0003D", "pulseiras": [{"slot": 1, "n": "567"}]}, "v1", False)
    p = next(v for v in m.ativ_fila(HOJE) if v["id"] == "TCORR0003D")["pulseiras"]
    ok(e is None and p and p[0]["qr"] == "Q" * 22 and p[0]["voo_em"] == HOJE + "T09:58:00" and p[0]["piloto"] == "P",
       "pulseira incluída depois fica com o vídeo já entregue: %s %s" % (e, p))
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK pulseira_corrige_agente: pulseira por item, como e quando foi lida, corrigir depois (incluir, trocar), permissão, outra compra, decolada travada, histórico")
