# v99.109: segundo verificador de rostos (plano docs/planos/2026-11-27-segundo-verificador-de-rostos.md). A selfie sem código
# vale pela soma das notas do SFace e do AuraFace quando o dia já foi lido pelo segundo; chave desligada, dia não coberto ou
# qualquer falha do segundo: volta a regra de sempre. Os vetores são gravados à mão nos dois bancos; nenhum modelo é aberto.
#   HOME=$(mktemp -d) python3 -I testes/rosto2_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, time
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


def v(n, a, b=0.0, i=0, j=1):
    x = np.zeros(n, "float32"); x[i] = a; x[j] = b
    return x / np.linalg.norm(x)


DIA = time.strftime("%Y-%m-%d", time.localtime(time.time() - 5 * 86400))
P = {k: "c0ffee%02d" % i for i, k in enumerate(["frente", "oculos", "estranho", "fundo", "removida", "perfil", "parente"])}
# (largura, nota SFace com a selfie, nota AuraFace com a selfie)
ROSTOS = {"frente": [(200, 0.60, 0.55)],          # soma 1,15: passo 1 e referência
          "oculos": [(200, 0.38, 0.52)],          # soma 0,90: só os dois juntos acham (SFace sozinho ficaria abaixo de 0,45)
          "estranho": [(200, 0.47, 0.20)],        # soma 0,67: o SFace sozinho traria (0,47 >= 0,45); os dois juntos não
          "fundo": [(60, 0.60, 0.55), (220, 0.0, 0.0)],   # o cliente ao fundo: não é principal
          "removida": [(200, 0.60, 0.55)]}
try:
    cos = lambda c: (c, (1 - c * c) ** 0.5)
    db1, db2 = m.rostos_db(), m.r2_db()
    for k, fs in ROSTOS.items():
        db1.execute("insert into foto values (?,?,?,?)", (P[k], DIA, len(fs), time.time()))
        for larg, s_, a_ in fs:
            vs, va = v(128, *cos(s_)), v(512, *cos(a_))
            db1.execute("insert into rosto (pid, dia, larg, emb) values (?,?,?,?)", (P[k], DIA, larg, vs.tobytes()))
            db2.execute("insert into rosto2 values (?,?,?,?,?)", (P[k], DIA, larg, vs.tobytes(), va.tobytes()))
        db2.execute("insert into foto2 values (?,?,?,?)", (P[k], DIA, len(fs), time.time()))
    db1.commit(); db2.commit()
    os.makedirs(m.SESS_DIR, exist_ok=True)
    with open(os.path.join(m.SESS_DIR, DIA + ".json"), "w", encoding="utf8") as f:
        json.dump({"dia": DIA, "num": 2, "sessoes": [
            {"card": "LPAAAAAAA", "dia": DIA, "num": 1, "fotografo": "ana", "fotos": [P[k] for k in ("frente", "oculos", "estranho", "fundo")], "pend": [], "ia": []},
            {"card": "LPBBBBBBB", "dia": DIA, "num": 2, "removida": True, "fotos": [P["removida"]], "pend": [], "ia": []}]}, f)
    me_s, me_a = v(128, 1.0), v(512, 1.0)

    # chave: ligada por padrão, corte padrão, grava e relê na hora
    ok(m.r2_cfg() == {"ligado": True, "corte": m.R2_CORTE, "por": None, "em": None, "busca": False}, "chave padrão: %s" % m.r2_cfg())
    ok(m.r2_cobre(DIA) and not m.r2_cobre("2020-01-01"), "cobertura do dia")

    # a regra de sempre (só SFace) traz o estranho e perde o de óculos; a soma faz o contrário
    antes = {i for i, _ in m.selfie_dia_fotos(me_s, DIA)}
    ok(antes == {"ag_" + P["frente"], "ag_" + P["estranho"]}, "pré: só SFace: %s" % sorted(antes))
    dois = m.r2_dia_fotos(me_s, me_a, DIA)
    ok({i for i, _ in dois} == {"ag_" + P["frente"], "ag_" + P["oculos"]}, "dois verificadores: de óculos entra, estranho, fundo e removida não: %s" % dois)
    ok(dict(dois).get("ag_" + P["oculos"]) == "LPAAAAAAA", "sessão de cada foto: %s" % dois)

    # passo 2: perfil bate com a referência (frente) e com a selfie acima do piso; o parente bate só com a referência
    ref_s, ref_a = v(128, *cos(0.60)), v(512, *cos(0.55))
    def perto(ref, n, com_ref, com_selfie):          # vetor com as duas notas pedidas (selfie = eixo 0; a referência tem eixos 0 e 1)
        a0 = com_selfie; a1 = (com_ref - a0 * ref[0]) / ref[1]; x = np.zeros(n, "float32"); x[0], x[1] = a0, a1
        x[2] = max(0.0, 1 - a0 * a0 - a1 * a1) ** 0.5
        return x
    for k, (cs, ca, ss, sa) in {"perfil": (0.50, 0.50, 0.38, 0.44), "parente": (0.50, 0.50, 0.20, 0.20)}.items():
        vs, va = perto(ref_s, 128, cs, ss), perto(ref_a, 512, ca, sa)
        db1.execute("insert into foto values (?,?,?,?)", (P[k], DIA, 1, time.time()))
        db1.execute("insert into rosto (pid, dia, larg, emb) values (?,?,?,?)", (P[k], DIA, 200, vs.tobytes()))
        m.r2_grava(db2, P[k], DIA, [(200, vs, va)])
    db1.commit()
    dois = {i for i, _ in m.r2_dia_fotos(me_s, me_a, DIA)}
    ok("ag_" + P["perfil"] in dois and "ag_" + P["parente"] not in dois, "passo 2: perfil entra (soma 0,82 com a selfie), parente não: %s" % sorted(dois))

    # v99.110: reforço do Procurar fotos do Posto. Só soma: o de óculos entra como certo, o estranho que o primeiro trouxe fica
    HOJE = time.strftime("%Y-%m-%d")
    db2.execute("update rosto2 set dia=?", (HOJE,)); db2.execute("update foto2 set dia=?", (HOJE,)); db2.commit()
    db1.execute("update foto set dia=?", (HOJE,)); db1.execute("update rosto set dia=?", (HOJE,)); db1.commit()
    m._r2["mat"].clear()
    base = {"rosto": True, "fotos": [{"id": P["frente"], "sim": 0.60, "principal": True}, {"id": P["estranho"], "sim": 0.47, "principal": True},
                                     {"id": P["perfil"], "sim": 0.40, "principal": True}], "limite": m.LIMITE}
    antes_txt = json.dumps(base, sort_keys=True)
    rf = m.r2_reforco(base, me_s, [(me_s, me_a)])
    ids = {f["id"]: f["sim"] for f in rf["fotos"]}
    ok(json.dumps(base, sort_keys=True) == antes_txt, "reforço não mexe na resposta original")
    ok(ids.get(P["oculos"]) == m.LIMITE, "reforço: o de óculos entra como certo: %s" % ids)
    ok(ids.get(P["frente"]) == 0.60 and ids.get(P["estranho"]) == 0.47, "reforço: nada do primeiro sai nem desce: %s" % ids)
    ok(ids.get(P["perfil"]) == 0.40 and P["parente"] not in ids, "reforço: abaixo do corte da soma não sobe nem entra: %s" % ids)
    ok(m.r2_reforco(base, me_s, [(v(128, 0.0, 1.0), me_a)]) is base, "reforço: quadro de outra pessoa não é usado")
    ok(m.r2_reforco(base, me_s, [(me_s, "quebrado")]) is base, "reforço: falha devolve a resposta como chegou")
    guarda = m.sess_pids_janela
    m.sess_pids_janela = lambda desde: {P["frente"]}
    ok(m.r2_reforco(base, me_s, [(me_s, me_a)], 30) is base, "reforço: foto fora da janela do Checkout não entra")
    m.sess_pids_janela = lambda desde: {P["oculos"]}
    ok(P["oculos"] in {f["id"] for f in m.r2_reforco(base, me_s, [(me_s, me_a)], 30)["fotos"]}, "reforço: foto dentro da janela entra")
    m.sess_pids_janela = guarda
    quase = v(128, 0.8, 0.6)
    ok(m.r2_reforco(base, me_s, [(quase, me_a)], mesmo=0.9) is base and m.r2_reforco(base, me_s, [(quase, me_a)]) is not base, "foto do grupo: só o par do mesmo rosto (0,9)")
    m.r2["pronto"] = True
    ok(not m.r2_busca_ligada(), "Procurar fotos: desligado por padrão")
    m.r2_cfg_grava(None, None, "teste", busca=True)
    ok(m.r2_cfg()["busca"] is True and m.r2_busca_ligada() and m.r2_status()["busca"] is True, "Procurar fotos: liga pela chave própria")
    m.r2_cfg_grava(False, None, "teste")
    ok(not m.r2_busca_ligada(), "Procurar fotos: não vale com a chave principal desligada")
    m.r2_cfg_grava(True, None, "teste", busca=False)
    ok(not m.r2_busca_ligada() and m.r2_cfg()["ligado"], "Procurar fotos: desliga sozinho, a principal fica")
    m.r2["pronto"] = False
    for b_ in (db1, db2):
        for t_ in (("foto", "rosto") if b_ is db1 else ("foto2", "rosto2")):
            b_.execute("update %s set dia=?" % t_, (DIA,))
        b_.commit()
    m._r2["mat"].clear()

    # selfie_dia_atende: com o segundo pronto e o dia coberto usa os dois; chave desligada ou falha, volta a regra de sempre
    usados = []
    m.selfie_dia_galeria = lambda dia, fotos: usados.append(sorted(i for i, _ in fotos)) or None
    m.selfie_dia_vetor = lambda b: ("ok", me_s)
    m.r2_selfie = lambda b: ("ok", me_s, me_a)
    m.rostos["ligado"] = True
    m.r2["pronto"] = True
    m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"})
    ok("ag_" + P["oculos"] in usados[-1] and "ag_" + P["estranho"] not in usados[-1], "atende pelos dois: %s" % usados[-1])
    m.r2_cfg_grava(False, None, "teste")
    ok(m.r2_cfg()["ligado"] is False and m.r2_cfg()["por"] == "teste" and not m.r2_ligado(), "chave desligada na hora: %s" % m.r2_cfg())
    m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"})
    ok("ag_" + P["estranho"] in usados[-1] and "ag_" + P["oculos"] not in usados[-1], "chave desligada: regra de sempre: %s" % usados[-1])
    m.r2_cfg_grava(True, 0.95, "teste")
    ok(m.r2_cfg()["corte"] == 0.95 and m.r2_ligado(), "corte trocado na hora")
    p1 = {f["id"] for f in m.r2_buscar(me_s, me_a, DIA, m.r2_cfg()["corte"])}
    ok(P["oculos"] not in p1 and P["frente"] in p1, "corte 0,95: o de óculos (0,90) sai do passo 1: %s" % sorted(p1))
    ok(m.r2_cfg_grava(None, 5, "teste")["corte"] == m.R2_CORTE_MAX and m.r2_cfg_grava(None, 0.1, "teste")["corte"] == m.R2_CORTE_MIN, "corte fica dentro dos limites")
    m.r2_cfg_grava(True, m.R2_CORTE, "teste")
    def quebra(b):
        raise RuntimeError("placa")
    m.r2_selfie = quebra
    m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"})
    ok("ag_" + P["estranho"] in usados[-1], "falha do segundo: regra de sempre: %s" % usados[-1])
    m.r2_selfie = lambda b: ("ok", me_s, me_a)
    m.r2["pronto"] = False
    m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"})
    ok("ag_" + P["estranho"] in usados[-1], "segundo não pronto: regra de sempre")
    m.r2["pronto"] = True
    db2.execute("delete from foto2 where pid in (?,?,?)", (P["frente"], P["oculos"], P["fundo"])); db2.commit()
    ok(not m.r2_cobre(DIA), "dia com leitura pela metade não está coberto")
    m.selfie_dia_atende("seg", {"dia": DIA, "imagem": "x"})
    ok("ag_" + P["estranho"] in usados[-1], "dia não coberto: regra de sempre")

    # LGPD: foto que saiu do primeiro banco sai do segundo na passada seguinte
    db1.execute("delete from foto where pid=?", (P["estranho"],)); db1.commit()
    faltam, _n = m.r2_faltam(db1, db2, DIA)
    ok(db2.execute("select count(*) from rosto2 where pid=?", (P["estranho"],)).fetchone()[0] == 0, "foto apagada sai do segundo banco")
    ok(faltam == {P["frente"], P["oculos"], P["fundo"]}, "o que falta ler: %s" % sorted(faltam))
    st = m.r2_status()
    ok(st["ligado"] and st["corte"] == m.R2_CORTE and "motivo" in st, "status: %s" % st)
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHA rosto2_agente:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK rosto2_agente: soma dos dois verificadores (óculos entra, estranho não), passo 2 com a trava na selfie, chave e corte na hora, volta à regra de sempre")
