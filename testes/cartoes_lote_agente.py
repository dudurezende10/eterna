# v99.24: lotes de cartões com QR gerados e guardados no servidor do ponto.
# Um lote na gráfica por vez (clicar de novo baixa o mesmo arquivo), token e código de 12 letras únicos entre todos os lotes,
# recebido/cancelado com quem e quando, e na entrega o cartão de lote cancelado ou fora de lote é recusado.
#   HOME=$(mktemp -d) python3 -I testes/cartoes_lote_agente.py agente/eterna-agente.py
import importlib.util, json, os, re, sqlite3, sys, time
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
try:
    m.vendas_db().close()
    # antes do primeiro lote, qualquer cartão vale (como era)
    c = m.vendas_db()
    ok(m.cartao_situacao(c, "A" * 22) is None, "sem lote nenhum: cartão avulso ainda vale")
    c.close()
    ok(m.cartao_lote(0, "adm")[0] == "dados" and m.cartao_lote(10001, "adm")[0] == "dados" and m.cartao_lote("x", "adm")[0] == "dados",
       "quantidade fora de 1 a 10.000 recusada")
    e, r = m.cartao_lote(3000, "adm")
    ok(not e and r["novo"] and r["n"] == 3000, "lote novo: %s" % (e or {k: v for k, v in r.items() if k != "csv"}))
    linhas = r["csv"].split("\n")
    ok(linhas[0] == "token;codigo;qr" and len(linhas) == 3001, "CSV com cabeçalho e 3000 linhas")
    toks = [l.split(";")[0] for l in linhas[1:]]
    cods = [l.split(";")[1] for l in linhas[1:]]
    ok(len(set(toks)) == 3000 and len(set(cods)) == 3000, "token e código únicos no lote")
    ok(all(re.match(r"^[A-Za-z0-9][A-Za-z0-9_-]{21}$", t) for t in toks), "token de 22, sem começar com - ou _")
    ok(all(m._re_codigo.match(k) and len(k) == 14 for k in cods), "código de 12 letras XXXX-XXXX-XXXX")
    ok(all(l.split(";")[2] == "https://eterna.photo/#g/" + l.split(";")[0] for l in linhas[1:]), "QR aponta para a galeria do token")
    ok(all(m.cartao_codigo(t) == k for t, k in zip(toks, cods)), "código é o mesmo cálculo da entrega")
    lote1 = r["lote"]

    # clicar de novo: o mesmo arquivo, nada novo no banco
    time.sleep(1.1)
    e, r2 = m.cartao_lote(5000, "outro")
    ok(not e and not r2["novo"] and r2["lote"] == lote1 and r2["csv"] == r["csv"], "com lote na gráfica, baixa o mesmo arquivo")
    c = m.vendas_db()
    ok(c.execute("select count(*) from cartao").fetchone()[0] == 3000, "nenhum cartão a mais no banco")
    ok(c.execute("select baixado_n, situacao, por from cartao_lote where id=?", (lote1,)).fetchone() == (2, "grafica", "adm"), "dois downloads registrados")
    c.close()

    # recebido -> lote novo pode; tokens e códigos não repetem entre lotes
    ok(m.cartao_lote_muda(lote1, "grafica", "adm") == "dados" and m.cartao_lote_muda("L00000000-000000", "recebido", "adm") == "nao_achou",
       "situação inválida e lote inexistente recusados")
    ok(m.cartao_lote_muda(lote1, "recebido", "adm") is None and m.cartao_lote_muda(lote1, "recebido", "adm") == "situacao", "recebido uma vez")
    time.sleep(1.1)
    e, r3 = m.cartao_lote(2000, "adm")
    ok(not e and r3["novo"] and r3["lote"] != lote1, "depois de recebido, lote novo")
    c = m.vendas_db()
    ok(c.execute("select count(*), count(distinct token), count(distinct codigo) from cartao").fetchone() == (5000, 5000, 5000), "5000 cartões, nada repetido entre lotes")
    c.close()
    ok(m.cartao_lote_muda(r3["lote"], "cancelado", "adm") is None and m.cartao_lote_muda(r3["lote"], "recebido", "adm") == "situacao",
       "cancelado não volta atrás")
    L = {x["id"]: x for x in m.cartao_lotes()}
    ok(L[lote1]["situacao"] == "recebido" and L[lote1]["mudou_por"] == "adm" and L[r3["lote"]]["situacao"] == "cancelado" and L[lote1]["usados"] == 0,
       "lista dos lotes: %s" % L)

    # entrega: cartão de lote recebido vale, de lote cancelado ou avulso não
    tok_cancel = r3["csv"].split("\n")[1].split(";")[0]
    c = m.vendas_db()
    ok(m.cartao_situacao(c, toks[0]) is None, "cartão de lote recebido vale")
    ok(m.cartao_situacao(c, tok_cancel) == "cartao_cancelado", "cartão de lote cancelado recusado")
    ok(m.cartao_situacao(c, "Z" * 22) == "cartao_desconhecido", "cartão fora de qualquer lote recusado")
    c.execute("insert into ativ_venda (origem, id, dia, tipo, itens, situacao) values ('eterna', 'TCART0001', ?, 'drone', ?, 'ativa')",
              (HOJE, json.dumps([{"cat": "drone", "produto": "asteroid", "qtd": 1, "videos": 1}])))
    c.commit()
    c.close()
    ok(m.ativ_video_checa("TCART0001", tok_cancel)[0] == "cartao_cancelado", "a entrega recusa o cartão cancelado")
    ok(m.ativ_video_checa("TCART0001", "Z" * 22)[0] == "cartao_desconhecido", "a entrega recusa o cartão avulso")
    ok(m.ativ_video_checa("TCART0001", toks[1]) == (None, 1), "a entrega aceita o cartão do lote")
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("cartoes_lote_agente: tudo certo")
