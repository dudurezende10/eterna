# v99.22: fotos do Tour pela foto da venda. Com o aceite do cliente (só vale com a foto), a foto da venda é procurada nas
# fotos do Tour do dia no servidor do ponto; as fotos em que ele é o rosto principal (sem base de IA) viram uma galeria de
# venda própria, com os preços e o catálogo da galeria de venda mais recente, e o vídeo ganha o atalho "encontramos N fotos".
# A galeria só cresce, a busca repete de hora em hora enquanto a foto existe, e venda sem aceite nunca é procurada.
# O reconhecimento de rosto é simulado aqui (buscar), o resto é o código de verdade.
#   HOME=$(mktemp -d) python3 -I testes/ativacoes_tour_agente.py agente/eterna-agente.py
import importlib.util, json, os, sqlite3, sys, time
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


import base64
JPG = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8" + b"\x00" * 200 + b"\xff\xd9").decode()
HOJE = time.strftime("%Y-%m-%d")


def venda(vid, **k):
    v = {"id": vid, "tipo": "drone", "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 170, "sugerido": 180,
         "itens": [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 1}], "usuario": "v"}
    v.update(k)
    return v


try:
    m.vendas_db().close()
    r = m.ativ_receber([venda("TTOUR0001", cliente_foto=JPG, cliente_foto_busca=True), venda("TTOUR0002", cliente_foto=JPG),
                        venda("TTOUR0003", cliente_foto_busca=True)], "v")
    ok(r["recebidas"] == ["TTOUR0001", "TTOUR0002", "TTOUR0003"], "vendas recebidas: %s" % r)
    db = sqlite3.connect(m.VENDAS_DB)
    fb = dict(db.execute("select id, foto_busca from ativ_venda where id like 'TTOUR%'").fetchall())
    db.close()
    ok(fb == {"TTOUR0001": 1, "TTOUR0002": 0, "TTOUR0003": 0}, "aceite só com a foto: %s" % fb)

    # sem galeria de venda para copiar os preços, nada é criado
    m.rostos["ligado"] = True
    achadas = [{"id": "aaaaaa01", "sim": 0.62, "principal": True}, {"id": "aaaaaa02", "sim": 0.40, "principal": True},
               {"id": "aaaaaa03", "sim": 0.70, "principal": False}, {"id": "aaaaaa04", "sim": 0.55, "principal": True}]
    chamadas = []

    def buscar_falso(imgs, dias=1, janela=None):
        chamadas.append((len(imgs), dias, janela, imgs[0][:23]))
        return {"rosto": True, "fotos": list(achadas)}
    m.buscar = buscar_falso
    m.sess["C1"] = {"fotos": ["aaaaaa01"], "pend": [], "ia": ["aaaaaa04"]}
    m.sess_pid.update({"aaaaaa01": "C1", "aaaaaa04": "C1"})
    ok(m.ativ_tour_atualiza("TTOUR0001") is None, "sem preço de referência não cria galeria")
    ok(chamadas and chamadas[0] == (1, 1, 0, "data:image/jpeg;base64,"), "busca com a foto da venda, o dia todo: %s" % chamadas)

    BASE = "B" * 22
    m.REPO.salvar_manifesto(BASE, {"v": 1, "token": BASE, "tipo": "sessao", "criada": HOJE + "T09:00:00", "fotos": [],
                                   "precos": {"dig": 30.0, "todas": 90.0}, "catalogo": [{"id": "p1", "sku": "a" * 40, "nome": "Pacote", "preco": 90.0, "digital": "todas", "kind": "pacote"}]})
    m._tour_base.update(t=0.0, v=None)
    g = m.ativ_tour_atualiza("TTOUR0001")
    ok(g and g["n"] == 1, "uma foto: rosto principal, acima do limite, fora da base de IA: %s" % g)
    gm = m.REPO.ler_manifesto(g["token"]) if g else {}
    ok(gm.get("tipo") == "sessao" and gm.get("origem") == "ativ" and [f["id"] for f in gm.get("fotos", [])] == ["ag_aaaaaa01"]
       and gm["fotos"][0]["direito"] == "venda" and gm["fotos"][0]["sessao"] == "C1", "galeria do Tour: %s" % gm.get("fotos"))
    ok(gm.get("precos") == {"dig": 30.0, "todas": 90.0} and len(gm.get("catalogo") or []) == 1 and gm.get("codigo"), "preços e catálogo copiados")
    db = sqlite3.connect(m.VENDAS_DB)
    ok(db.execute("select tour_token, tour_n from ativ_venda where id='TTOUR0001'").fetchone() == (g["token"], 1), "token guardado na venda")
    db.close()
    m._tour_base.update(t=0.0, v=None)
    ok(m.ativ_tour_base()["precos"]["todas"] == 90.0, "a galeria do Tour nunca vira referência de preço")

    # vídeo entregue: o atalho entra no manifesto do vídeo quando aparece foto nova
    QR = "Q" * 22
    m.REPO.salvar_manifesto(QR, {"v": 1, "token": QR, "tipo": "video", "fotos": [], "videos": []})
    db = sqlite3.connect(m.VENDAS_DB)
    db.execute("insert into ativ_entrega (qr, venda, n) values (?, 'TTOUR0001', 1)", (QR,))
    db.commit()
    db.close()
    achadas.append({"id": "aaaaaa05", "sim": 0.5, "principal": True})
    g2 = m.ativ_tour_atualiza("TTOUR0001")
    ok(g2 and g2["token"] == g["token"] and g2["n"] == 2, "a mesma galeria cresce: %s" % g2)
    ok(m.REPO.ler_manifesto(QR).get("tour") == {"token": g["token"], "n": 2}, "atalho no vídeo: %s" % m.REPO.ler_manifesto(QR).get("tour"))
    # comprada nunca regride, e foto que some da busca não sai da galeria
    gm = m.REPO.ler_manifesto(g["token"])
    gm["fotos"][0]["direito"], gm["fotos"][0]["canal"] = "comprada", "online"
    m.REPO.salvar_manifesto(g["token"], gm)
    del achadas[:]
    achadas.append({"id": "aaaaaa06", "sim": 0.5, "principal": True})
    g3 = m.ativ_tour_atualiza("TTOUR0001")
    gm = m.REPO.ler_manifesto(g["token"])
    ok(g3["n"] == 3 and [f["direito"] for f in gm["fotos"]] == ["comprada", "venda", "venda"], "só cresce e a comprada fica: %s" % gm["fotos"])
    n0 = len(chamadas)
    ok(m.ativ_tour_atualiza("TTOUR0002") is None and len(chamadas) == n0, "venda sem aceite nunca é procurada")
    m.ativ_cliente_foto_grava("TTOUR0003", b"\xff\xd8x")
    ok(m.ativ_tour_passa() == 1, "passada de hora em hora: só quem aceitou e ainda tem a foto")
    # várias pessoas na foto: nada novo
    m.buscar = lambda imgs, dias=1, janela=None: {"rosto": True, "varias": True, "fotos": []}
    ok(m.ativ_tour_atualiza("TTOUR0001")["n"] == 3, "foto com várias pessoas não acrescenta nada")
    # vídeo novo da venda já nasce com o atalho
    db = sqlite3.connect(m.VENDAS_DB)
    ok(db.execute("select tour_n from ativ_venda where id='TTOUR0001'").fetchone() == (3,), "contagem atualizada na venda")
    db.close()
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("ativacoes_tour_agente: tudo certo")
