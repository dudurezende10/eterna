# v100 (fase 2): venda das ativações no tablet, local first. O tablet guarda a venda e reenvia até ouvir o ok:
# reenviar não duplica, venda com formato ruim volta como recusada (o tablet não apaga), Cortesia exige motivo e nota,
# Minhas vendas só traz as do próprio vendedor, cancelamento pelo vendedor (só a própria do dia) e pelo gestor,
# banco antigo (sem as colunas novas) ganha as colunas, e quem não vende não grava.
#   HOME=$(mktemp -d) python3 -I testes/ativacoes_venda_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# banco de antes da fase 2: a tabela sem as colunas do tablet
os.makedirs(os.path.dirname(m.VENDAS_DB), exist_ok=True)
db = sqlite3.connect(m.VENDAS_DB)
db.execute("create table ativ_venda (origem text, id text, tipo text, dia text, criado text, itens text, valor real, pagamento text, vendedor text,"
           " vendedor_n int, pessoas int, videos int, resolucao text, pais text, idioma text, guia text, piloto text, drone text, bateria text,"
           " entrega text, qr text, importado_em text, primary key (origem, id))")
db.execute("insert into ativ_venda (origem, id, tipo, dia, criado, itens, valor, pagamento) values ('antigo','drone-1','drone',?,?,'[]',180,'PIX')",
           (time.strftime("%Y-%m-%d"), time.strftime("%Y-%m-%dT08:00:00")))
db.commit()
db.close()

srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def req(met, rota, cookie, corpo=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    h = {"Host": HOST, "X-Eterna": "1", "Cookie": cookie, "Origin": "http://" + HOST}
    b = None
    if corpo is not None:
        b = json.dumps(corpo).encode()
        h["Content-Type"] = "application/json"
    c.request(met, rota, b, h)
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


HOJE = time.strftime("%Y-%m-%d")


def venda(vid, **k):
    v = {"id": vid, "tipo": "drone", "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 170, "sugerido": 180,
         "itens": [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 2, "videos": 1, "sugerido": 180, "cobrado": 170}],
         "pais": "Chile", "idioma": "Espanhol", "guia": "", "vendedor": "Vendedora Teste", "usuario": "vendedora-ativ"}
    v.update(k)
    return v


RW = {"c": True, "r": True, "u": True, "d": True}
try:
    ven = S.cookie_sessao(m, "vendedora-ativ", {"venda": {"c": True, "r": True, "u": False, "d": False}})
    ven2 = S.cookie_sessao(m, "vendedor2-ativ", {"venda": {"c": True, "r": True, "u": False, "d": False}})
    ger = S.cookie_sessao(m, "gestor-ativ", {"financeiro": RW, "venda": RW})
    foto = S.cookie_sessao(m, "foto-ativ", {"set": RW})
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [venda("TAAAAAA1D"), venda("TAAAAAA2C", tipo="chute", itens=[{"cat": "chute", "produto": "c3", "op": "", "qtd": 1, "cobrado": 110}], valor=110),
                                                       venda("TRUIM0001", pagamento="Fiado"), venda("TCORT0001", pagamento="Cortesia", valor=0, cortesia_motivo="Imprensa")]})
    ok(st == 200 and j.get("recebidas") == ["TAAAAAA1D", "TAAAAAA2C"] and [x["id"] for x in j.get("recusadas", [])] == ["TRUIM0001", "TCORT0001"],
       "recebe duas, recusa pagamento inventado e cortesia sem nota: %s %s" % (st, j))
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [venda("TAAAAAA1D", valor=999)]})
    ok(st == 200 and j.get("recebidas") == ["TAAAAAA1D"], "reenvio conta como recebida: %s" % j)
    db = sqlite3.connect(m.VENDAS_DB)
    ok(db.execute("select count(*), sum(valor) from ativ_venda where origem='eterna'").fetchone() == (2, 280.0), "reenvio não duplica nem regrava")
    r = db.execute("select vendedor, usuario, sugerido, pessoas, videos, situacao, enviado_por, pais from ativ_venda where id='TAAAAAA1D'").fetchone()
    ok(r == ("Vendedora Teste", "vendedora-ativ", 180.0, 2, 1, "ativa", "vendedora-ativ", "Chile"), "linha gravada: %s" % (r,))
    db.close()
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [venda("TCORT0002", pagamento="Cortesia", valor=0, cortesia_motivo="Imprensa", cortesia_nota="Equipe da TV")]})
    ok(j.get("recebidas") == ["TCORT0002"], "cortesia com motivo e nota: %s" % j)
    st, j = req("POST", "/ativ/venda", ven2, {"vendas": [venda("TOUTRO001", usuario="vendedor2-ativ", vendedor="Vendedor Dois")]})
    st, j = req("GET", "/ativ/minhas?dia=" + HOJE, ven)
    ok(st == 200 and sorted(x["id"] for x in j.get("vendas", [])) == ["TAAAAAA1D", "TAAAAAA2C", "TCORT0002"], "minhas vendas só as da vendedora: %s" % j)
    ok(isinstance(j["vendas"][0]["itens"], list) and j["vendas"][0].get("sugerido") is not None, "minhas vendas com itens e sugerido")
    # cancelar
    st, j = req("POST", "/ativ/cancelar", ven, {"id": "TOUTRO001", "motivo": "teste"})
    ok(st == 403, "vendedora não cancela venda de outro: %s" % st)
    st, j = req("POST", "/ativ/cancelar", ven, {"id": "TAAAAAA2C", "motivo": ""})
    ok(st == 400, "cancelar pede motivo: %s" % st)
    st, j = req("POST", "/ativ/cancelar", ven, {"id": "TAAAAAA2C", "motivo": "cliente desistiu"})
    ok(st == 200, "vendedora cancela a própria: %s %s" % (st, j))
    st, j = req("POST", "/ativ/cancelar", ger, {"id": "TOUTRO001", "motivo": "venda em dobro"})
    ok(st == 200, "gestor cancela qualquer uma: %s %s" % (st, j))
    st, j = req("GET", "/ativ/vendas?de=%s&ate=%s" % (HOJE, HOJE), ger)
    sit = {x["id"]: x["situacao"] for x in j.get("vendas", [])}
    ok(sit.get("TAAAAAA2C") == "cancelada" and sit.get("TOUTRO001") == "cancelada" and sit.get("TAAAAAA1D") == "ativa" and sit.get("drone-1") == "ativa",
       "situação no resumo, venda antiga continua: %s" % sit)
    db = sqlite3.connect(m.VENDAS_DB)
    ok(db.execute("select cancel_motivo, cancel_por from ativ_venda where id='TAAAAAA2C'").fetchone() == ("cliente desistiu", "vendedora-ativ"), "cancelamento registrado")
    db.close()
    # quem não vende
    st, j = req("POST", "/ativ/venda", foto, {"vendas": [venda("TFOTO0001")]})
    ok(st == 403, "fotógrafo não grava venda: %s" % st)
    st, j = req("GET", "/ativ/minhas?dia=" + HOJE, foto)
    ok(st == 403, "fotógrafo não lê minhas vendas: %s" % st)
    st, j = req("POST", "/ativ/venda", "", {"vendas": [venda("TSEMSES01")]})
    ok(st in (401, 403), "sem sessão não grava: %s" % st)
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-800:])
finally:
    srv.shutdown()

if falhas:
    print("FALHA ativacoes_venda_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK ativacoes_venda_agente: recebe sem duplicar, recusa formato ruim, cortesia com motivo e nota, minhas vendas, cancelamento com permissão, banco antigo migrado")
