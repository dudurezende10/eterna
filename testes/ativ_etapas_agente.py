# v99.27: tempo de cada etapa das ativações. /ativ/vendas devolve, em cada venda do tablet, os segundos de cada etapa:
# venda, chegou ao campo, decolou (pela pulseira), vídeo entregue, na nuvem (só com todos os vídeos), cliente abriu e
# baixou (eventos da nuvem, em UTC). Venda do sistema antigo não tem etapas.
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/ativ_etapas_agente.py agente/eterna-agente.py
import calendar, importlib.util, json, os, sys, time
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
loc = lambda s: HOJE + "T" + s
try:
    r = m.ativ_receber([{"id": "TETAPAS01D", "tipo": "drone", "criado": loc("10:00:00"), "pagamento": "PIX", "valor": 360, "sugerido": 360,
                         "itens": [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 2}],
                         "pulseiras": ["71", "72"], "vendedor": "V", "usuario": "v"}], "v")
    ok(r["recebidas"] == ["TETAPAS01D"], "venda: %s" % r)
    c = m.vendas_db()
    c.execute("update ativ_venda set recebido_em=? where id='TETAPAS01D'", (loc("10:05:00"),))
    c.execute("update ativ_pulseira set voo_em=? where venda='TETAPAS01D' and numero='71'", (loc("10:12:00"),))
    c.execute("update ativ_pulseira set voo_em=? where venda='TETAPAS01D' and numero='72'", (loc("10:10:00"),))
    abriu = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.mktime(time.strptime(loc("11:00:00"), "%Y-%m-%dT%H:%M:%S"))))
    baixou = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.mktime(time.strptime(loc("11:02:00"), "%Y-%m-%dT%H:%M:%S"))))
    c.execute("insert into ativ_entrega (qr, venda, n, em, nuvem_em, cliente_eventos) values (?,?,?,?,?,?)",
              ("Q" * 22, "TETAPAS01D", 1, loc("10:20:00"), loc("10:21:00"),
               json.dumps([{"tipo": "qr_aberto", "em": abriu}, {"tipo": "video_baixou", "em": baixou}])))
    c.execute("insert into ativ_entrega (qr, venda, n, em, nuvem_em) values (?,?,?,?,?)", ("R" * 22, "TETAPAS01D", 2, loc("10:25:00"), None))
    c.execute("insert into ativ_venda (origem, id, tipo, dia, criado, valor) values ('antigo', 'velha-1', 'drone', ?, ?, 100)", (HOJE, loc("09:00:00")))
    c.commit()
    c.close()
    vs = {v["id"]: v for v in m.ativ_vendas(HOJE, HOJE)}
    e = vs["TETAPAS01D"].get("etapas") or {}
    rel = {k: v - e["venda"] for k, v in e.items()}
    ok(rel == {"venda": 0, "recebido": 300, "voo": 600, "entregue": 1200, "aberto": 3600, "baixou": 3720}, "um vídeo ainda não subiu: sem nuvem: %s" % rel)
    c = m.vendas_db()
    c.execute("update ativ_entrega set nuvem_em=? where qr=?", (loc("10:26:30"), "R" * 22))
    c.commit()
    c.close()
    e = {v["id"]: v for v in m.ativ_vendas(HOJE, HOJE)}["TETAPAS01D"]["etapas"]
    rel = {k: v - e["venda"] for k, v in e.items()}
    ok(rel == {"venda": 0, "recebido": 300, "voo": 600, "entregue": 1200, "nuvem": 1590, "aberto": 3600, "baixou": 3720},
       "todas as etapas (nuvem quando o último subiu; abriu e baixou em UTC): %s" % rel)
    ok("etapas" not in vs["velha-1"], "venda do sistema antigo sem etapas")
    # velocidade real do envio dos vídeos (v99.27): 142 MB em 60 s e 100 MB em 100 s -> mediana
    with m.nuvem_lock:
        db = m.nuvem_db()
        m._nuvem_videos_tabela(db)
        db.execute("insert into videos (qr, arquivo, entrou, feito, bytes, seg) values ('a', 'x', ?, ?, 142000000, 60)", (time.time(), time.time()))
        db.execute("insert into videos (qr, arquivo, entrou, feito, bytes, seg) values ('b', 'x', ?, ?, 100000000, 100)", (time.time(), time.time()))
        db.execute("insert into videos (qr, arquivo, entrou, feito, bytes) values ('c', 'x', ?, ?, 50000000)", (time.time(), time.time()))
        db.commit()
        db.close()
    env = m.nuvem_envio_medido(HOJE, HOJE)
    ok(env == {"n": 2, "mb": 121.0, "seg": 80.0, "mbps": 13.5}, "velocidade do envio: %s" % env)
    ok(m.nuvem_envio_medido("2020-01-01", "2020-01-02") == {"n": 0}, "período sem envio")
    ok(m._ativ_ts("x") is None and m._ativ_ts(None) is None, "hora inválida não quebra")
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK ativ_etapas_agente: venda, campo, voo pela pulseira, entrega, nuvem com todos os vídeos, cliente abriu e baixou")
