# v100 (fase 4): entrega das ativações. Fila do dia, recebido e voo feito (piloto, drone e bateria do cadastro), vídeo do cartão
# do drone ligado ao QR de um cartão novo (QR usado é recusado, só mp4, a venda não passa do número de vídeos), item físico com
# baixa um a um, venda entregue quando tudo foi entregue (e aí não cancela), galeria do vídeo gravada e vídeo na fila da nuvem.
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/ativacoes_entrega_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, re, sqlite3, struct, sys, threading, time
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


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def req(met, rota, cookie, corpo=None, bruto=None, tipo="application/json", xe=True):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    h = {"Host": HOST, "Cookie": cookie, "Origin": "http://" + HOST}
    if xe:
        h["X-Eterna"] = "1"
    b = bruto
    if corpo is not None:
        b = json.dumps(corpo).encode()
    if b is not None:
        h["Content-Type"] = tipo
    c.request(met, rota, b, h)
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


def caixa(tipo, corpo):
    return struct.pack(">I", 8 + len(corpo)) + tipo + corpo


def mp4(segundos):
    mvhd = b"\x00\x00\x00\x00" + b"\x00" * 8 + struct.pack(">II", 1000, int(segundos * 1000)) + b"\x00" * 80
    return caixa(b"ftyp", b"isom\x00\x00\x02\x00isomiso2") + caixa(b"moov", caixa(b"mvhd", mvhd)) + caixa(b"mdat", b"\x00" * 5000)


def entrega(venda, qr, bruto, cookie):
    """vídeo sobe como rascunho e depois é ligado à venda e ao cartão (a tela faz assim)"""
    st, j = req("POST", "/ativ/video", cookie, bruto=bruto, tipo="video/mp4")
    if st != 200:
        return st, j
    return req("POST", "/ativ/video/liga", cookie, {"rascunho": j["rascunho"], "venda": venda, "qr": qr})


HOJE = time.strftime("%Y-%m-%d")
CODIGO_APP = "4B3J-GCRL"            # cartaoCodigo("abcdefghijklmnopqrstuv") no app
QR1, QR2, QR3 = "A" * 21 + "1", "B" * 21 + "2", "C" * 21 + "3"
RW = {"c": True, "r": True, "u": True, "d": True}


def venda(vid, tipo, itens):
    return {"id": vid, "tipo": tipo, "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 180, "sugerido": 180, "itens": itens,
            "pais": "Chile", "idioma": "Espanhol", "vendedor": "Vendedora Teste", "usuario": "vendedora-ativ"}


try:
    # catálogo no estado.db: o pacote de chute com medalha
    db = m.estado_db()
    db.execute("insert or replace into doc (col, id, valor, rev, em) values ('ativ', 'c5mv', ?, 1, '')",
               (json.dumps({"id": "c5mv", "cat": "chute", "nome": "5 Chutes + Medalha + Vídeo", "inclui": {"chutes": 5, "videos": 1, "itens": ["Medalha"]}}),))
    db.commit()
    db.close()
    ven = S.cookie_sessao(m, "vendedora-ativ", {"ativvenda": {"c": True, "r": True, "u": False, "d": False}})
    eq = S.cookie_sessao(m, "campo-ativ", {"ativentrega": RW})
    sup = S.cookie_sessao(m, "supervisora-ativ", {"ativvenda": RW, "ativentrega": RW})
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [
        venda("TDRONE001D", "drone", [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 2, "videos": 1}]),
        venda("TCHUTE001C", "chute", [{"cat": "chute", "produto": "c5mv", "op": "", "qtd": 1, "pessoas": 1, "videos": 1}])]})
    ok(st == 200 and len(j.get("recebidas", [])) == 2, "vendas gravadas: %s %s" % (st, j))
    # quem vê a fila
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, ven)
    ok(st == 403, "vendedor não vê a fila de entrega: %s" % st)
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    fila = {v["id"]: v for v in j.get("vendas", [])}
    ok(st == 200 and set(fila) == {"TDRONE001D", "TCHUTE001C"}, "fila do dia: %s %s" % (st, j))
    ok(fila.get("TCHUTE001C", {}).get("fisicos") == [{"i": 0, "nome": "Medalha", "entregue": False}] and fila.get("TDRONE001D", {}).get("videos") == 1,
       "itens físicos e vídeos previstos: %s" % fila)
    # cadastro e voo
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TDRONE001D", "etapa": "voo", "piloto": "Piloto Um", "drone": "007", "bateria": "3"})
    ok(st == 400 and j.get("error") == "cadastro", "voo com piloto fora do cadastro: %s %s" % (st, j))
    for t, n in (("piloto", "Piloto Um"), ("drone", "007"), ("bateria", "3")):
        st, j = req("POST", "/ativ/cadastros", eq, {"tipo": t, "nome": n})
    ok(st == 200 and j["cadastros"]["bateria"] == [{"nome": "3", "ativo": True}], "cadastro: %s" % j)
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TDRONE001D", "etapa": "voo", "piloto": "Piloto Um", "drone": "007", "bateria": "3"})
    ok(st == 200, "voo feito: %s %s" % (st, j))
    st, j = req("POST", "/ativ/etapa", ven, {"id": "TDRONE001D", "etapa": "recebido"})
    ok(st == 403, "vendedor não marca etapa: %s" % st)
    # vídeo: sobe como rascunho assim que é solto na tela; depois liga à venda e ao cartão
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(30), tipo="video/mp4")
    ok(st == 200 and re.match(r"^[0-9a-f]{16}$", j.get("rascunho") or "") and j.get("duracao") == 30.0, "rascunho: %s %s" % (st, j))
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": j.get("rascunho"), "venda": "TDRONE001D", "qr": "curto"})
    ok(st == 400, "QR inválido: %s" % st)
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": "0" * 16, "venda": "TDRONE001D", "qr": QR1})
    ok(st == 410 and j.get("error") == "rascunho", "rascunho que não existe: %s %s" % (st, j))
    st, j = req("POST", "/ativ/video", eq, bruto=b"nao e video" * 100, tipo="video/mp4")
    ok(st == 415, "arquivo que não é mp4: %s %s" % (st, j))
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(30), tipo="video/mp4", xe=False)
    ok(st == 403, "sem X-Eterna: %s" % st)
    st, j = req("POST", "/ativ/video", ven, bruto=mp4(30), tipo="video/mp4")
    ok(st == 403, "vendedor não manda vídeo: %s" % st)
    st, j = req("POST", "/ativ/video/liga", ven, {"rascunho": "0" * 16, "venda": "TDRONE001D", "qr": QR1})
    ok(st == 403, "vendedor não liga vídeo: %s" % st)
    st, j = entrega("TDRONE001D", QR1, mp4(30), eq)
    ok(st == 200 and j.get("n") == 1 and re.match(r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$", j.get("codigo") or ""), "vídeo ligado ao QR: %s %s" % (st, j))
    ok(os.path.getsize(os.path.join(m.ATIV_VIDEOS_DIR, QR1 + ".mp4")) == len(mp4(30)) and not [f for f in os.listdir(m.ATIV_VIDEOS_DIR) if f.endswith(".tmp")],
       "arquivo guardado, sem sobra")
    sobra = [f for f in os.listdir(m.ATIV_VIDEOS_DIR) if f.startswith("rascunho-")]
    ok(len(sobra) == 1, "só o rascunho do teste do QR inválido sobrou: %s" % sobra)
    m.ativ_videos_limpa()
    ok(len([f for f in os.listdir(m.ATIV_VIDEOS_DIR) if f.startswith("rascunho-")]) == 1, "rascunho novo fica")
    m.ativ_videos_limpa(time.time() + 2 * 86400)
    ok(not [f for f in os.listdir(m.ATIV_VIDEOS_DIR) if f.startswith("rascunho-")], "rascunho de mais de um dia sai")
    st, j = entrega("TDRONE001D", QR2, mp4(30), eq)
    ok(st == 409 and j.get("error") == "completa", "venda com o vídeo que comprou não recebe outro: %s %s" % (st, j))
    st, j = entrega("TCHUTE001C", QR1, mp4(20), eq)
    ok(st == 409 and j.get("error") == "qr_usado", "QR já usado: %s %s" % (st, j))
    # galeria do vídeo e fila da nuvem
    man = m.REPO.ler_manifesto(QR1)
    ok(man and man["tipo"] == "video" and man["videos"][0]["chave"] == "video/%s.mp4" % QR1 and man["videos"][0]["duracao"] == 30.0 and man["idioma"] == "Espanhol",
       "galeria do vídeo: %s" % man)
    nd = sqlite3.connect(m.NUVEM_DB)
    ok(nd.execute("select qr from videos where feito is null").fetchall() == [(QR1,)], "vídeo na fila da nuvem")
    nd.close()
    # venda entregue não cancela
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    fila = {v["id"]: v for v in j.get("vendas", [])}
    d = fila.get("TDRONE001D", {})
    ok(d.get("entregue_em") and d.get("piloto") == "Piloto Um" and d.get("voo_em") and d.get("recebido_em") and d["entregas"][0]["qr"] == QR1,
       "drone entregue, com voo e recebido: %s" % d)
    st, j = req("POST", "/ativ/cancelar", sup, {"id": "TDRONE001D", "motivo": "teste"})
    ok(st == 409, "entregue não cancela: %s" % st)
    # chute: vídeo e a medalha, um a um
    st, j = entrega("TCHUTE001C", QR3, mp4(20), eq)
    ok(st == 200, "vídeo do chute: %s %s" % (st, j))
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    ch = {v["id"]: v for v in j.get("vendas", [])}.get("TCHUTE001C", {})
    ok(not ch.get("entregue_em"), "chute com a medalha pendente ainda não está entregue: %s" % ch)
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TCHUTE001C", "etapa": "item", "i": 5})
    ok(st == 400, "item fora da venda: %s" % st)
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TCHUTE001C", "etapa": "item", "i": 0})
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    ch = {v["id"]: v for v in j.get("vendas", [])}.get("TCHUTE001C", {})
    ok(ch.get("entregue_em") and ch["fisicos"][0]["entregue"], "medalha entregue: venda entregue: %s" % ch)
    # limpeza: depois de 30 dias o arquivo sai do servidor do ponto, a entrega continua registrada
    ok(m.ativ_videos_limpa() == 0 and os.path.exists(os.path.join(m.ATIV_VIDEOS_DIR, QR1 + ".mp4")), "vídeo novo fica")
    ok(m.ativ_videos_limpa(time.time() + 31 * 86400) == 2 and not os.path.exists(os.path.join(m.ATIV_VIDEOS_DIR, QR1 + ".mp4")), "vídeo de 31 dias sai")
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    ok({v["id"]: v for v in j.get("vendas", [])}.get("TDRONE001D", {}).get("entregue_em"), "entrega continua registrada")
    # data inválida
    st, j = req("GET", "/ativ/fila?dia=ontem", eq)
    ok(st == 400, "data inválida: %s" % st)
    # o mesmo código do app (cartaoCodigo em index.html), conferido com valores calculados lá
    ok(m.cartao_codigo("abcdefghijklmnopqrstuv") == CODIGO_APP, "código do cartão igual ao do app: %s" % m.cartao_codigo("abcdefghijklmnopqrstuv"))
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-800:])
finally:
    srv.shutdown()

if falhas:
    print("FALHA ativacoes_entrega_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK ativacoes_entrega_agente: fila do dia, cadastro e voo, vídeo ligado ao QR (QR usado, só mp4, sem passar do comprado), galeria do vídeo, fila da nuvem, item físico um a um, entregue não cancela")
