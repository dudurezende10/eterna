# v99.108: selfie sem código na galeria pública (plano docs/planos/2026-11-27-selfie-na-galeria.md). O servidor do estádio
# leva o pedido da nuvem, procura só no dia escolhido (rosto principal, semelhança de mesma pessoa, fora base de IA, sessão
# removida, grupo de escola e sessão de menor) e monta a galeria de venda da selfie: a comprada numa venda entra liberada.
# Os rostos são vetores gravados à mão no banco de rostos; a leitura da selfie é simulada (selfie_dia_vetor).
#   HOME=$(mktemp -d) python3 -I testes/selfie_dia_agente.py agente/eterna-agente.py
import importlib.util, io, json, os, sqlite3, sys, time
sys.dont_write_bytecode = True
os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
import numpy as np
m._cv["np"] = np
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


HOJE = time.strftime("%Y-%m-%d")
DIA = time.strftime("%Y-%m-%d", time.localtime(time.time() - 10 * 86400))
e0, e1 = np.eye(128, dtype="float32")[0], np.eye(128, dtype="float32")[1]
quase = (e0 * 0.9 + e1 * 0.3) / np.linalg.norm(e0 * 0.9 + e1 * 0.3)       # semelhança 0,95 com e0
P = {k: "a1b2c3%02d" % i for i, k in enumerate(["frente", "fundo", "outro", "ia", "removida", "comprada", "escola", "hoje", "semsessao"])}
try:
    db = m.rostos_db()
    linhas = [(P["frente"], DIA, 200, e0), (P["fundo"], DIA, 60, quase), (P["fundo"], DIA, 220, e1), (P["outro"], DIA, 200, e1),
              (P["ia"], DIA, 200, e0), (P["removida"], DIA, 200, e0), (P["comprada"], DIA, 180, quase), (P["escola"], DIA, 200, e0),
              (P["hoje"], HOJE, 200, e0), (P["semsessao"], DIA, 150, e0)]
    db.executemany("insert into rosto (pid, dia, larg, emb) values (?,?,?,?)", [(p, d, l, v.astype("float32").tobytes()) for p, d, l, v in linhas])
    db.commit()
    db.close()
    os.makedirs(m.SESS_DIR, exist_ok=True)
    with open(os.path.join(m.SESS_DIR, DIA + ".json"), "w", encoding="utf8") as f:
        json.dump({"dia": DIA, "num": 2, "sessoes": [
            {"card": "LPAAAAAAA", "dia": DIA, "num": 1, "fotos": [P[k] for k in ("frente", "fundo", "outro", "ia", "comprada", "escola")], "pend": [], "ia": [P["ia"]]},
            {"card": "LPBBBBBBB", "dia": DIA, "num": 2, "removida": True, "fotos": [P["removida"]], "pend": [], "ia": []}]}, f)
    BASE, VENDA, ESC = "B" * 22, "V" * 22, "E" * 22
    cat = [{"id": "p1", "sku": "a" * 40, "nome": "Pacote", "preco": 90.0, "digital": "todas", "kind": "pacote"}]
    m.REPO.salvar_manifesto(BASE, {"v": 1, "token": BASE, "tipo": "sessao", "criada": HOJE + "T09:00:00", "fotos": [],
                                   "precos": {"dig": 30.0, "todas": 90.0}, "catalogo": cat})
    m.REPO.salvar_manifesto(VENDA, {"v": 1, "token": VENDA, "tipo": "sessao", "criada": DIA + "T11:00:00", "precos": {"dig": 30.0, "todas": 90.0},
                                    "fotos": [{"id": "ag_" + P["comprada"], "sessao": "LPAAAAAAA", "direito": "comprada", "canal": "loja"},
                                              {"id": "ag_" + P["frente"], "sessao": "LPAAAAAAA", "direito": "venda", "canal": None}]})
    m.REPO.salvar_manifesto(ESC, {"v": 1, "token": ESC, "tipo": "evento", "menor": True, "criada": DIA + "T11:00:00", "precos": {"dig": 0, "todas": 0},
                                  "fotos": [{"id": "ag_" + P["escola"], "sessao": "LPAAAAAAA", "direito": "venda"}]})
    m._tour_base.update(t=0.0, v=None)

    # busca no dia escolhido: só ele, o dia todo, sem ficar em memória
    r = m.buscar_vetor(e0, dia=DIA)
    ids = {f["id"] for f in r["fotos"]}
    ok(P["hoje"] not in ids and P["frente"] in ids and P["outro"] not in ids, "busca só no dia escolhido: %s" % sorted(ids))
    ok(DIA not in m._mat, "dia antigo não fica na memória da busca")
    ok({f["id"] for f in m.buscar_vetor(e0)["fotos"]} == {P["hoje"]}, "a busca de sempre (hoje) não mudou")

    fotos = m.selfie_dia_fotos(e0, DIA)
    ok({i for i, _ in fotos} == {"ag_" + P[k] for k in ("frente", "comprada", "escola", "semsessao")},
       "rosto principal, fora base de IA e sessão removida: %s" % fotos)
    ok(dict(fotos).get("ag_" + P["frente"]) == "LPAAAAAAA" and dict(fotos).get("ag_" + P["semsessao"]) == "", "sessão de cada foto: %s" % fotos)

    # v99.108.1: busca em 2 passos. Outro dia, três fotógrafos: de frente (passo 1), de perfil (só o passo 2 acha) e um parente
    # parecido com a foto de referência, mas não com a selfie (não entra)
    DIA2 = time.strftime("%Y-%m-%d", time.localtime(time.time() - 12 * 86400))
    nv = lambda a, b: ((e0 * a + e1 * b) / np.linalg.norm(e0 * a + e1 * b)).astype("float32")
    Q = {k: "d4e5f6%02d" % i for i, k in enumerate(["frenteA", "frenteB", "perfilC", "parenteC", "perfilFundo", "outroD"])}
    db = m.rostos_db()
    db.executemany("insert into rosto (pid, dia, larg, emb) values (?,?,?,?)", [(p, DIA2, l, v.tobytes()) for p, l, v in [
        (Q["frenteA"], 200, nv(0.8, 0.6)),          # 0,80 com a selfie: passo 1 e referência
        (Q["frenteB"], 200, nv(1.0, 0.0)),          # 1,00: passo 1 e referência
        (Q["perfilC"], 200, nv(0.42, 0.9075)),      # 0,42 com a selfie (abaixo de LIMITE), 0,88 com a referência A: passo 2
        (Q["parenteC"], 200, nv(0.2, 0.98)),        # 0,75 com a referência A, 0,20 com a selfie: parente, fica fora
        (Q["perfilFundo"], 60, nv(0.42, 0.9075)), (Q["perfilFundo"], 220, nv(0.0, 1.0)),   # o cliente ao fundo: não é principal
        (Q["outroD"], 200, nv(0.0, 1.0))]])
    db.commit()
    db.close()
    with open(os.path.join(m.SESS_DIR, DIA2 + ".json"), "w", encoding="utf8") as f:
        json.dump({"dia": DIA2, "num": 3, "sessoes": [
            {"card": "LPA222222", "dia": DIA2, "num": 1, "fotografo": "ana", "fotos": [Q["frenteA"]], "pend": [], "ia": []},
            {"card": "LPB222222", "dia": DIA2, "num": 2, "fotografo": "bia", "fotos": [Q["frenteB"]], "pend": [], "ia": []},
            {"card": "LPC222222", "dia": DIA2, "num": 3, "fotografo": "caio", "fotos": [Q["perfilC"], Q["parenteC"], Q["perfilFundo"], Q["outroD"]], "pend": [], "ia": []}]}, f)
    so1 = {f["id"] for f in m.buscar_vetor(e0, dia=DIA2)["fotos"] if f["sim"] >= m.LIMITE and f["principal"]}
    ok(so1 == {Q["frenteA"], Q["frenteB"]}, "pré: a selfie sozinha acha só as de frente: %s" % sorted(so1))
    ok(all("vet" not in f for f in m.buscar_vetor(e0, dia=DIA2)["fotos"]), "sem vetores=True a busca de sempre não traz vetor")
    buf = io.StringIO()
    so, sys.stdout = sys.stdout, buf
    try:
        f2 = m.selfie_dia_fotos(e0, DIA2)
    finally:
        sys.stdout = so
    ids2 = {i for i, _ in f2}
    ok(ids2 == {"ag_" + Q[k] for k in ("frenteA", "frenteB", "perfilC")}, "2 passos: de frente e de perfil, de três fotógrafos; parente e fundo fora: %s" % sorted(ids2))
    ok({c for _, c in f2} == {"LPA222222", "LPB222222", "LPC222222"}, "sessões de fotógrafos diferentes no mesmo dia: %s" % f2)
    log2 = buf.getvalue()
    ok("passo 1 2, passo 2 1, 3 sessões" in log2 and "[" not in log2 and "d4e5f6" not in log2, "log só com números: %r" % log2)
    dono2, _f2, quem2 = m.selfie_dia_sessoes(DIA2)
    p1 = [f for f in m.buscar_vetor(e0, dia=DIA2, vetores=True)["fotos"] if f["sim"] >= m.LIMITE and f["principal"]]
    refs = m.selfie_dia_referencias(p1 + p1, dono2, quem2)
    ok(len(refs) == 2 and {dono2[r["id"]] for r in refs} == {"LPA222222", "LPB222222"}, "referências: uma por fotógrafo, sem repetir: %s" % [r["id"] for r in refs])
    # o piso da trava: se o perfil não chegasse ao "talvez" com a selfie, ficaria fora
    piso0 = m.SELFIE_PASSO2_PISO
    m.SELFIE_PASSO2_PISO = 0.5
    ok("ag_" + Q["perfilC"] not in {i for i, _ in m.selfie_dia_fotos(e0, DIA2)}, "a trava na selfie vale para o passo 2")
    m.SELFIE_PASSO2_PISO = piso0
    ok(m.SELFIE_DIA_MAX >= 400, "sem o teto antigo de 60 fotos")

    # galeria da selfie
    pubs, fila = [], []
    m.nuvem_publica_manifesto = lambda seg, man: pubs.append(json.loads(json.dumps(man)))
    m.nuvem_galeria_enfileira = lambda t: fila.append(t)
    m.rostos["ligado"] = True
    m.selfie_dia_vetor = lambda b: ("ok", e0)
    ped = {"pedido": "x" * 24, "dia": DIA, "imagem": "data:image/jpeg;base64,/9j/AAAA"}
    res = m.selfie_dia_atende("seg", ped)
    ok(res.get("estado") == "achou" and res.get("n") == 3 and "imagem" not in ped, "achou, e a selfie saiu do pedido: %s" % res)
    g = m.REPO.ler_manifesto(res.get("token")) or {}
    fs = {f["id"]: f for f in g.get("fotos") or []}
    ok(g.get("tipo") == "sessao" and g.get("origem") == "selfie" and not g.get("codigo"), "galeria de venda própria, sem código: %s" % {k: g.get(k) for k in ("tipo", "origem", "codigo")})
    ok(set(fs) == {"ag_" + P[k] for k in ("frente", "comprada", "semsessao")}, "grupo de escola fica fora: %s" % sorted(fs))
    ok(fs.get("ag_" + P["comprada"], {}).get("direito") == "comprada" and fs.get("ag_" + P["frente"], {}).get("direito") == "venda",
       "comprada numa venda sai liberada; a outra à venda: %s" % fs)
    ok(g.get("precos") == {"dig": 30.0, "todas": 90.0} and g.get("catalogo") == cat, "preços e catálogo da galeria de venda mais recente")
    exp_esperada = m._epoch(DIA + "T23:59:59") + m.GAL_DIAS * 86400
    ok(abs(m._epoch(g.get("expira")) - exp_esperada) < 5, "vale até 30 dias depois do dia da visita: %s" % g.get("expira"))
    ok(len(pubs) == 1 and pubs[0]["token"] == res.get("token") and fila == [res.get("token")], "publicada na nuvem na hora e na fila de sempre")
    m._tour_base.update(t=0.0, v=None)
    ok(m.ativ_tour_base()["precos"]["todas"] == 90.0 and m.ativ_tour_base()["catalogo"] == cat, "a galeria da selfie nunca vira referência de preço")

    # sem achar, várias pessoas, sem rosto, sem leitura de rostos
    m.selfie_dia_vetor = lambda b: ("ok", e1 * -1)
    ok(m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"}) == {"estado": "nao"}, "ninguém parecido: não achou")
    m.selfie_dia_vetor = lambda b: ("varias", None)
    ok(m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"}) == {"estado": "varias"}, "várias pessoas: não procura")
    ok(m.selfie_dia_atende("seg", {"dia": "ontem", "imagem": "x"}) == {"estado": "erro"}, "dia inválido: erro")
    m.rostos["ligado"] = False
    ok(m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"}) == {"estado": "erro"}, "sem leitura de rostos: erro")
    m.rostos["ligado"] = True

    # a passada: leva da nuvem, responde, e o registro local não guarda selfie nem o número do pedido
    m.NUVEM_API = "https://nuvem.invalid"
    m.selfie_dia_vetor = lambda b: ("ok", e0)
    enviados = []

    class R:
        def __init__(s, b): s.b = b
        def read(s): return s.b
        def __enter__(s): return s
        def __exit__(s, *a): return False

    def urlopen(rq, timeout=0):
        if rq.get_method() == "GET":
            return R(json.dumps({"pedidos": [{"pedido": "P" * 24, "dia": DIA, "imagem": "data:image/jpeg;base64,/9j/AAAA"},
                                             {"pedido": "../x", "dia": DIA, "imagem": "x"}]}).encode())
        enviados.append((rq.full_url, json.loads(rq.data.decode()), rq.headers.get("X-eterna-ponto")))
        return R(b"{}")
    m.urllib.request.urlopen = urlopen
    ok(m.selfie_dia_passa("seg") == 1, "um pedido válido atendido")
    ok(len(enviados) == 1 and enviados[0][0].endswith("/ponto/selfies") and enviados[0][1]["estado"] == "achou" and enviados[0][1]["pedido"] == "P" * 24
       and enviados[0][2] == "seg", "resultado devolvido à nuvem com o segredo: %s" % enviados)
    m.selfie_dia_atende = lambda seg, p: (_ for _ in ()).throw(RuntimeError("falhou"))
    enviados.clear()
    ok(m.selfie_dia_passa("seg") == 1 and enviados[0][1] == {"pedido": "P" * 24, "estado": "erro"}, "falha na busca vira erro para o cliente, sem derrubar nada")
    db = sqlite3.connect(m.NUVEM_DB)
    regs = db.execute("select id, dia, estado, n from selfie_dia").fetchall()
    db.close()
    ok(regs and all(x[0] != "P" * 24 and x[1] == DIA for x in regs) and not any("image" in json.dumps(x) for x in regs), "registro local só com o resumo: %s" % regs)
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHA selfie_dia_agente:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK selfie_dia_agente: busca no dia escolhido em 2 passos (perfil sim, parente não), galeria da selfie com as compradas liberadas e a passada da fila")
