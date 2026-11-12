# v100: importação das vendas do sistema antigo (agente/ativacoes-importar.py -> ativ_venda no vendas.db) e rota /ativ/vendas.
# Dados inventados. Confere: nome e WhatsApp do cliente nunca chegam ao banco; rodar duas vezes não duplica; venda corrigida
# na origem é atualizada; "Vendedor03" vira o nome pela lista de tablets; a rota pede Estatísticas, Financeiro ou Relatórios.
#   HOME=$(mktemp -d) python3 -I testes/ativacoes_importar_agente.py agente/eterna-agente.py
import http.client, importlib.util, io, json, os, sqlite3, sys, tempfile, threading
from contextlib import redirect_stdout
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
spi = importlib.util.spec_from_file_location("imp", os.path.join(os.path.dirname(AG), "ativacoes-importar.py"))
imp = importlib.util.module_from_spec(spi)
spi.loader.exec_module(imp)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


tmp = tempfile.mkdtemp()
DRONE = os.path.join(tmp, "drone.csv")
CHUTE = os.path.join(tmp, "chute_snap.csv")
DIA = os.path.join(tmp, "dia.json")
VEND = os.path.join(tmp, "tablets.txt")
open(DRONE, "w", encoding="utf-8-sig").write(
    "ID;Criação;QR code;Cliente;WhatsApp;Localidade;Descrição dos Serviços;Vendedor;# Vídeos;Preço;Foto;Pagamento;Resolução;Pessoas;Piloto;Drone;Bateria;Hora Entrega;Idioma;Guia\n"
    "101;2026-10-01 10:00:00;QRTESTE001;Fulano Inventado;+55 21 90000-0001;Chile (+56);1x boomerang_arquibancada;Vendedor03 MaracaTour;1;R$ 120,00;;PIX;1080p;2;Piloto X;006;2;2026-10-01 10:30:00;🇪🇸 Español;-\n"
    "102;2026-10-01 11:00:00;QRTESTE002;Beltrana Inventada;+55 21 90000-0002;Brasil (+55);1x inside_out_banco;Ana Teste;1;R$ 250,00;;CRÉDITO;4K;1;;;;;Português;Guia Y\n")
open(CHUTE, "w", encoding="utf-8-sig").write(
    "##chute_gol\nID;Criação;QRCode;Cliente;WhatsApp;Localidade;Foto;Itens da venda;Vendedor;Vídeos;Valor;Pagamento;Participantes;Entrega;Idioma;Guia\n"
    "201;02/10/2026 14:00:00;QRTESTE003;Ciclano Inventado;+56 9 0000 0003;Chile (+56);;1x 3 Chutes 1x 1 Medalha avulsa;Vendedor03 MaracaTour;0;R$ 170,00;DÉBITOAbrir pagamento;1;—;English;—\n"
    "##snap_pop\nID;Foto;Criação;QRCode;Cliente;WhatsApp;Localidade;Itens da venda;Vendedor;Vídeos;Valor;Pagamento;Participantes;Entrega;Idioma;Guia\n"
    "301;;03/10/2026 15:00:00;QRTESTE004;Outro Inventado;+57 300 000 0004;Colômbia (+57);1x FLA;Ana Teste;1;R$ 110,00;DINHEIRO;1;—;Español;—\n")
json.dump({"extraido_em": "2026-10-04T20:00:00", "dados": [{"tipo": "drone", "dia": "2026-10-01",
           "head": ["ID", "Criação", "Cliente", "WhatsApp", "Descrição dos Serviços", "Vendedor", "Preço", "Pagamento", "Pessoas"],
           "rows": [{"attrs": {"saleId": "101"}, "cells": [{"txt": "101"}, {"txt": "2026-10-01 10:00:00"}, {"txt": "Fulano Inventado"}, {"txt": "+55 21 90000-0001"},
                                                          {"txt": "1x boomerang_arquibancada"}, {"txt": "Vendedor03 MaracaTour"}, {"txt": "R$ 0,00"}, {"txt": "PIX"}, {"txt": "3"}]}]}]},
          open(DIA, "w", encoding="utf-8"))
open(VEND, "w", encoding="utf-8").write("tablet 03 - vendedora.teste\ntablet 05 - ana.teste\n")


def roda(*args):
    out = io.StringIO()
    with redirect_stdout(out):
        rc = imp.principal(list(args) + ["--agente", AG, "--vendedores", VEND])
    return rc, out.getvalue()


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def get(rota, cookie):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    c.request("GET", rota, None, {"Host": HOST, "X-Eterna": "1", "Cookie": cookie})
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


try:
    rc, out = roda(DRONE, CHUTE)
    ok(rc == 0 and "4 novas" in out, "primeira carga: 4 novas: %s %s" % (rc, out))
    rc, out = roda(DRONE, CHUTE)
    ok(rc == 0 and "0 novas" in out and "4 iguais" in out, "rodar de novo não duplica: %s" % out)
    db = sqlite3.connect(m.VENDAS_DB)
    tudo = json.dumps(db.execute("select * from ativ_venda").fetchall(), ensure_ascii=False)
    ok(not any(t in tudo for t in ("Fulano", "Beltrana", "Ciclano", "Outro Inventado", "90000-", "0000 0003", "000 0004")), "nome e WhatsApp do cliente fora do banco")
    ok(db.execute("select count(*) from ativ_venda").fetchone()[0] == 4, "4 vendas no banco")
    v = dict(zip(m.ATIV_VENDA_CAMPOS, db.execute("select " + ",".join(m.ATIV_VENDA_CAMPOS) + " from ativ_venda where id='drone-101'").fetchone()))
    ok(v["vendedor"] == "Vendedora Teste" and v["vendedor_n"] == 3 and v["pais"] == "Chile" and v["idioma"] == "Espanhol" and v["valor"] == 120
       and json.loads(v["itens"]) == [{"produto": "boomerang", "op": "Arquibancada", "qtd": 1}] and v["guia"] == "", "drone normalizado: %s" % v)
    ok(db.execute("select vendedor, vendedor_n from ativ_venda where id='drone-102'").fetchone() == ("Ana Teste", 5), "número do tablet pelo nome da planilha")
    c3 = db.execute("select itens, pagamento, idioma from ativ_venda where id='chute-201'").fetchone()
    ok(json.loads(c3[0]) == [{"produto": "3 Chutes", "op": "", "qtd": 1}, {"produto": "1 Medalha avulsa", "op": "", "qtd": 1}] and c3[1] == "Débito" and c3[2] == "Inglês",
       "chute com dois itens, pagamento e idioma: %s" % (c3,))
    s3 = db.execute("select itens, pagamento from ativ_venda where id='snap-301'").fetchone()
    ok(json.loads(s3[0]) == [{"produto": "Vídeo com IA", "op": "Flamengo", "qtd": 1}] and s3[1] == "Dinheiro", "snap com tema: %s" % (s3,))
    db.close()
    # a extração diária corrige a venda 101 (virou cortesia, 3 pessoas): atualiza, não duplica
    rc, out = roda(DIA)
    ok(rc == 0 and "1 atualizadas" in out, "extração diária atualiza: %s" % out)
    db = sqlite3.connect(m.VENDAS_DB)
    ok(db.execute("select valor, pagamento, pessoas from ativ_venda where id='drone-101'").fetchone() == (0.0, "Cortesia", 3), "venda corrigida na origem")
    ok(db.execute("select count(*) from ativ_venda").fetchone()[0] == 4, "continua com 4 vendas")
    db.close()
    # formato ruim é recusado pelo agente
    r = m.ativ_importar([{"origem": "antigo", "id": "x-1", "tipo": "drone", "dia": "2026-10-01", "criado": "2026-10-01T10:00:00", "itens": [], "valor": 1, "cliente": "Fulano"}])
    ok(r["recusadas"] == 1, "campo de cliente recusado: %s" % r)
    # rota
    RW = {"c": True, "r": True, "u": True, "d": True}
    adm = S.cookie_sessao(m, "admin-ativ")
    ven = S.cookie_sessao(m, "vendedor-ativ", {"venda": RW})
    st, j = get("/ativ/vendas?de=2026-10-01&ate=2026-10-31", adm)
    ok(st == 200 and len(j.get("vendas", [])) == 4 and isinstance(j["vendas"][0]["itens"], list), "rota devolve as vendas do período: %s" % st)
    st, j = get("/ativ/vendas?de=2026-10-02&ate=2026-10-02", adm)
    ok(st == 200 and [x["id"] for x in j["vendas"]] == ["chute-201"], "filtro por dia: %s" % j)
    st, j = get("/ativ/vendas?de=ontem&ate=hoje", adm)
    ok(st == 400, "datas inválidas: %s" % st)
    st, j = get("/ativ/vendas?de=2026-10-01&ate=2026-10-31", ven)
    ok(st == 403, "vendedor sem Estatísticas não lê o resumo: %s" % st)
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-800:])
finally:
    srv.shutdown()

if falhas:
    print("FALHA ativacoes_importar_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK ativacoes_importar_agente: planilhas e extração diária, sem dado de cliente, sem duplicar, venda corrigida, vendedor pelo tablet, rota com permissão")
