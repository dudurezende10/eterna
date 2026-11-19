# 16/11 (plano "Curadoria › Treino da IA", fatia F1): rótulos de fotos reais do servidor no treino.db, amostra do dia com
# semente fixa, formato fechado, conflito entre duas pessoas, permissões (ler com qualidade.r, marcar com qualidade.u, o
# interruptor da análise com configuracao.u), limite por pessoa, LGPD (treino.db e os documentos da foto no estado.db) e o
# interruptor config/treino (só pela rota, padrão desligado, em /status.treino). Nenhuma foto: só ids, sessões e textos sintéticos.
#   python3 -I testes/treino_agente.py agente/eterna-agente.py      (HOME temporário, como o testes/rodar.sh chama)
import http.client, importlib.util, json, os, sqlite3, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ.pop("ETERNA_TESTE_CARGA", None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# ---------- dia sintético: 3 fotógrafos, sessões de 6 fotos das 9h às 17h, uma aberta e uma removida (fora) ----------
DIA = "2026-11-10"
t0 = time.mktime(time.strptime(DIA + " 09:00:00", "%Y-%m-%d %H:%M:%S"))
sessoes, n_pid = [], [0]


def pid():
    n_pid[0] += 1
    return "%012x" % (0xabc000000000 + n_pid[0])


for h in range(9):
    for k, quem in enumerate(("carlos", "yago", "samuel")):
        card = "LP%02d%s" % (h, quem[:3].upper())
        fs = [pid() for _ in range(6)]
        base = t0 + h * 3600 + k * 600
        for i, p in enumerate(fs):
            m.meta[p] = {"o": quem, "s": "ftp", "u": base + i * 10 + 5, "cap": base + i * 10}
            m.lib[p] = {"file": os.path.join(HOME, "Eterna", "inbox", DIA, p + "_x.jpg"), "thumb": ""}
        sessoes.append({"card": card, "dia": DIA, "fotografo": quem, "status": "fechada", "fotos": list(reversed(fs)), "removida": False})
ABERTA = [pid() for _ in range(3)]
REMOV = [pid() for _ in range(3)]
for p in ABERTA + REMOV:
    m.lib[p] = {"file": os.path.join(HOME, "Eterna", "inbox", DIA, p + "_x.jpg"), "thumb": ""}
    m.meta[p] = {"u": t0 + 100, "cap": t0 + 90}
sessoes += [{"card": "LPABERTA1", "dia": DIA, "fotografo": "carlos", "status": "aberta", "fotos": ABERTA},
            {"card": "LPREMOV01", "dia": DIA, "fotografo": "carlos", "status": "fechada", "removida": True, "fotos": REMOV}]
json.dump({"dia": DIA, "sessoes": sessoes}, open(os.path.join(m.SESS_DIR, DIA + ".json"), "w"))
TOTAL = 9 * 3 * 6
PRIMEIRA = sessoes[0]["fotos"][-1]          # 1º clique da 1ª sessão (a lista do arquivo veio invertida de propósito)

try:
    # ---------- amostra ----------
    a1 = m.treino_amostra(DIA, None, "misto", 400)
    a2 = m.treino_amostra(DIA, None, "misto", 400)
    ok(a1["v"] == 1 and a1["total_dia"] == TOTAL and len(a1["itens"]) == TOTAL, "amostra: total do dia só das fechadas: %r" % ((a1["total_dia"], len(a1["itens"])),))
    ok([x["pid"] for x in a1["itens"]] == [x["pid"] for x in a2["itens"]] and a1["semente"] == a2["semente"], "amostra: mesma ordem para todos (semente fixa)")
    ok(not ({x["pid"] for x in a1["itens"]} & set(ABERTA + REMOV)), "amostra: sessão aberta e removida ficam fora")
    it = {x["pid"]: x for x in a1["itens"]}
    ok(it[PRIMEIRA]["ordem"] == 1 and it[PRIMEIRA]["n_sessao"] == 6 and it[PRIMEIRA]["card"] == "LP00CAR" and it[PRIMEIRA]["fotografo"] == "carlos",
       "amostra: ordem de clique (não a do arquivo): %r" % it[PRIMEIRA])
    ok(set(it[PRIMEIRA]) == {"pid", "card", "fotografo", "t", "ordem", "n_sessao", "rostos", "rotulo"} and it[PRIMEIRA]["rotulo"] is None, "amostra: campos do item: %r" % sorted(it[PRIMEIRA]))
    ia = m.treino_amostra(DIA, None, "ia", 400)
    ok(ia["itens"] and all(x["ordem"] <= 4 for x in ia["itens"]) and len(ia["itens"]) == 9 * 3 * 4, "modo ia: só 1ª a 4ª de cada sessão: %d" % len(ia["itens"]))
    horas = [time.localtime(x["t"]).tm_hour for x in ia["itens"][:9]]
    ok(len(set(horas)) == 9, "modo ia: as primeiras espalhadas pelas horas: %r" % horas)
    ql = m.treino_amostra(DIA, None, "qualidade", 400)
    ok(ql["semente"] != ia["semente"] and len(ql["itens"]) == TOTAL, "modo qualidade: todas, semente própria")
    hq = [time.localtime(x["t"]).tm_hour for x in ql["itens"][:18]]
    ok(max(hq.count(h) for h in set(hq)) <= 3, "modo qualidade: proporcional por hora: %r" % hq)
    mi = a1["itens"][:50]
    ok(sum(1 for x in mi if x["ordem"] <= 4) >= 30, "modo misto: ao menos 60%% de fotos de IA no começo: %d" % sum(1 for x in mi if x["ordem"] <= 4))
    ok(len(m.treino_amostra(DIA, "yago", "misto", 400)["itens"]) == 9 * 6 and all(x["fotografo"] == "yago" for x in m.treino_amostra(DIA, "yago", "misto", 20)["itens"]),
       "filtro de fotógrafo")
    ok(len(m.treino_amostra(DIA, None, "misto", 7)["itens"]) == 7, "n limita a amostra")
    fora = a1["itens"][0]["pid"]
    lib_fora = m.lib.pop(fora)
    ok(fora not in {x["pid"] for x in m.treino_amostra(DIA, None, "misto", 400)["itens"]}, "foto que saiu da biblioteca fica fora")
    m.lib[fora] = lib_fora

    # ---------- formato fechado ----------
    V = m.treino_valida
    bom = {"pid": "ag_" + PRIMEIRA, "v": 1, "ponto": "gramado", "ia": {"serve": None, "motivos": [], "frente": None},
           "qual": {"nivel": "boa", "motivos": [], "ajuste": []}, "duvida": False, "obs": "ok", "base_em": None}
    ok(V(bom)[0] is not None and V(bom)[0]["pid"] == PRIMEIRA, "formato válido")
    for mud, campo in (({"extra": 1}, "campo"), ({"v": 2}, "v"), ({"v": True}, "v"), ({"pid": "../x"}, "pid"), ({"ponto": "bandeira"}, "ponto"),
                       ({"ia": {"serve": "sim"}}, "ia"), ({"ia": {"motivos": ["A B"]}}, "ia"), ({"ia": {"x": 1}}, "ia"),
                       ({"qual": {"nivel": "otima"}}, "qual"), ({"qual": {"motivos": ["inventado"]}}, "qual"),
                       ({"qual": {"motivos": ["olhos", "olhos"]}}, "qual"), ({"duvida": "sim"}, "duvida"),
                       ({"obs": "x" * 201}, "obs"), ({"obs": 3}, "obs"), ({"base_em": "x" * 41}, "base_em"), ({"__proto__": {}}, "campo")):
        ok(V(dict(bom, **mud)) == (None, campo), "recusa %r como %s: %r" % (mud, campo, V(dict(bom, **mud))))
    ok(V(dict(bom, obs="a\x00b\nc "))[0]["obs"] == "abc", "obs sem caractere de controle")

    # ---------- HTTP de verdade (mesmo processo) ----------
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    RO, RU = {"r": True}, {"r": True, "u": True}
    adm = S.cookie_sessao(m, "admin-treino")
    sup = S.cookie_sessao(m, "supervisora-treino", {"qualidade": RU, "configuracao": {"c": True, "r": True, "u": True}})
    val = S.cookie_sessao(m, "validador-treino", {"qualidade": {"c": True, "r": True, "u": True, "d": True}})
    so_ver = S.cookie_sessao(m, "so-ver-treino", {"qualidade": RO})
    nada = S.cookie_sessao(m, "nada-treino", {"set": RU})
    posto = S.cookie_posto(m, "Checkout treino")

    def pede(metodo, rota, corpo=None, cookie=None, extra=None, cru=None):
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        h.update(extra or {})
        dados = cru if cru is not None else (json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None)
        c.request(metodo, rota, dados, h)
        r = c.getresponse()
        b = r.read()
        c.close()
        try:
            return r.status, json.loads(b or b"{}")
        except ValueError:
            return r.status, None

    # permissões
    ok(pede("GET", "/treino/dias")[0] == 401 and pede("GET", "/treino/dias", cookie=posto)[0] == 401 and pede("GET", "/treino/dias", cookie=nada)[0] == 403,
       "ler: sem sessão 401, posto 401, sem o módulo 403")
    st, d = pede("GET", "/treino/dias", cookie=so_ver)
    ok(st == 200 and d["v"] == 1 and d["dias"] == [{"dia": DIA, "fotos": TOTAL, "sessoes": 27, "rotuladas": 0}], "/treino/dias: %s %r" % (st, d))
    st, am = pede("GET", "/treino/amostra?dia=%s&modo=misto&n=150" % DIA, cookie=so_ver)
    ok(st == 200 and am["v"] == 1 and am["dia"] == DIA and len(am["itens"]) == 150 and am["total_dia"] == TOTAL and am["semente"] == a1["semente"],
       "/treino/amostra: %s %r" % (st, {k: v for k, v in (am or {}).items() if k != "itens"}))
    for q, e in (("dia=10-11-2026", "dia"), ("dia=%s&modo=x" % DIA, "modo"), ("dia=%s&n=0" % DIA, "n"), ("dia=%s&n=401" % DIA, "n"), ("dia=%s&fotografo=A%%20B" % DIA, "fotografo")):
        st, r = pede("GET", "/treino/amostra?" + q, cookie=so_ver)
        ok(st == 400 and r.get("error") == e, "amostra recusa %s: %s %r" % (q, st, r))
    ok(pede("POST", "/treino/rotulo", bom, cookie=so_ver)[0] == 403, "marcar exige qualidade.u")
    ok(pede("POST", "/treino/rotulo", bom, cookie=adm, extra={"X-Eterna": ""})[0] == 403, "POST sem X-Eterna: 403")
    ok(pede("POST", "/treino/rotulo", bom, cookie=adm, extra={"Origin": "http://evil.example"})[0] == 403, "origem de fora: 403")
    # Supervisora marca; por e em carimbados pelo servidor
    st, r = pede("POST", "/treino/rotulo", dict(bom, por="outra-pessoa"), cookie=sup)
    ok(st == 400 and r.get("campo") == "campo", "por vindo do navegador é recusado: %s %r" % (st, r))
    st, r = pede("POST", "/treino/rotulo", bom, cookie=sup)
    doc = (r or {}).get("doc") or {}
    ok(st == 200 and doc.get("por") == "supervisora-treino" and doc.get("em") and doc.get("dia") == DIA and doc.get("card") == "LP00CAR" and doc.get("ordem") == 1
       and doc.get("origem") == "mao" and doc.get("lote") is None and doc.get("pid") == PRIMEIRA, "Supervisora marca: %s %r" % (st, r))
    ok(set(doc) == {"v", "pid", "dia", "fotografo", "card", "ordem", "ponto", "ia", "qual", "duvida", "obs", "por", "em", "origem", "lote"}, "documento v1: %r" % sorted(doc))
    # conflito: outra pessoa com base velha -> 409 com o doc atual; com a base certa, grava
    st, r = pede("POST", "/treino/rotulo", dict(bom, ponto="arquibancada", base_em=None), cookie=adm)
    ok(st == 409 and r.get("error") == "outro_marcou" and (r.get("doc") or {}).get("em") == doc["em"], "409 outro_marcou: %s %r" % (st, r))
    st, r = pede("POST", "/treino/rotulo", dict(bom, ponto="arquibancada", base_em=doc["em"]), cookie=adm)
    ok(st == 200 and r["doc"]["ponto"] == "arquibancada" and r["doc"]["por"] == "admin-treino" and r["doc"]["em"] > doc["em"], "base em dia grava: %s %r" % (st, r))
    st, r2 = pede("POST", "/treino/rotulo", dict(bom, ponto="trofeu", base_em="velho"), cookie=adm)
    ok(st == 200, "a mesma pessoa regrava sem conflito: %s" % st)
    st, r = pede("POST", "/treino/rotulo", dict(bom, pid="ag_" + "f" * 12), cookie=adm)
    ok(st == 404 and r.get("error") == "pid", "foto que não está numa sessão fechada: 404: %s %r" % (st, r))
    st, r = pede("POST", "/treino/rotulo", dict(bom, pid=ABERTA[0]), cookie=adm)
    ok(st == 404, "foto de sessão aberta: 404: %s" % st)
    st, r = pede("POST", "/treino/rotulo", cru=json.dumps(dict(bom, obs="x" * 5000)).encode(), cookie=adm)
    ok(st == 413, "corpo acima de 4 KB: %s" % st)
    # amostra pula a marcada; com marcadas=1 traz com o rótulo; rotulos do dia
    st, am2 = pede("GET", "/treino/amostra?dia=%s&n=400" % DIA, cookie=so_ver)
    ok(PRIMEIRA not in {x["pid"] for x in am2["itens"]} and len(am2["itens"]) == TOTAL - 1, "amostra pula a já marcada")
    st, am3 = pede("GET", "/treino/amostra?dia=%s&n=400&marcadas=1" % DIA, cookie=so_ver)
    ok(any(x["pid"] == PRIMEIRA and (x["rotulo"] or {}).get("ponto") == "trofeu" for x in am3["itens"]), "marcadas=1 traz a marcada com o rótulo")
    st, ro = pede("GET", "/treino/rotulos?dia=%s" % DIA, cookie=so_ver)
    ok(st == 200 and [x["pid"] for x in ro["rotulos"]] == [PRIMEIRA], "/treino/rotulos: %r" % ro)
    st, d = pede("GET", "/treino/dias", cookie=so_ver)
    ok(d["dias"][0]["rotuladas"] == 1, "rotuladas no dia: %r" % d)
    tdb = sqlite3.connect(m.TREINO_DB)
    hist = tdb.execute("select por from rotulo_hist where pid = ? order by rowid", (PRIMEIRA,)).fetchall()
    tabs = {r[0] for r in tdb.execute("select name from sqlite_master where type = 'table'")}
    tdb.close()
    ok([h[0] for h in hist] == ["supervisora-treino", "admin-treino", "admin-treino"], "histórico só acrescenta: %r" % hist)
    ok({"rotulo", "rotulo_hist", "lote", "medida"} <= tabs, "tabelas do treino.db: %r" % tabs)
    # o Z da tela grava a marcação vazia: conta como não marcada (volta para a amostra e não soma no dia)
    vaz = sessoes[0]["fotos"][-2]
    ok(pede("POST", "/treino/rotulo", dict(bom, pid="ag_" + vaz, ponto="chute"), cookie=adm)[0] == 200, "marca a segunda foto")
    vazio = {"pid": "ag_" + vaz, "v": 1, "ponto": None, "ia": {"serve": None, "motivos": [], "frente": None},
             "qual": {"nivel": None, "motivos": [], "ajuste": []}, "duvida": False, "obs": ""}
    ok(pede("POST", "/treino/rotulo", vazio, cookie=adm)[0] == 200, "desfazer grava a marcação vazia")
    st, am4 = pede("GET", "/treino/amostra?dia=%s&n=400" % DIA, cookie=so_ver)
    st, d4 = pede("GET", "/treino/dias", cookie=so_ver)
    ok(any(x["pid"] == vaz and x["rotulo"] is None for x in am4["itens"]) and d4["dias"][0]["rotuladas"] == 1,
       "marcação vazia volta para a amostra e não conta no dia: %r" % d4)
    # limite: 120 por minuto por pessoa (a outra pessoa segue)
    seg = sessoes[1]["fotos"][-1]
    n429 = 0
    for i in range(125):
        st, _ = pede("POST", "/treino/rotulo", dict(bom, pid=seg), cookie=val)
        if st == 429:
            n429 = i + 1
            break
    ok(n429 > 100, "429 depois de 120 pedidos no minuto por pessoa: %d" % n429)
    ok(pede("POST", "/treino/rotulo", dict(bom, pid=seg, base_em=None), cookie=adm)[0] in (200, 409), "o limite é por pessoa: o Admin segue")

    # ---------- interruptor da análise ----------
    st, s0 = pede("GET", "/status", cookie=so_ver)
    ok(s0.get("treino") == {"v": 1, "rotulos": 2, "analise": {"ponto": "desligada", "exposicao": "desligada"}, "modelo_ponto": None, "ajuste": None} or
       (s0.get("treino") or {}).get("analise") == {"ponto": "desligada", "exposicao": "desligada"}, "/status.treino padrão desligado: %r" % s0.get("treino"))
    ok(pede("POST", "/treino/config", {"exposicao": "medir"}, cookie=val)[0] == 403, "Validador (só qualidade) não muda o interruptor")
    st, r = pede("POST", "/treino/config", {"exposicao": "medir"}, cookie=sup)
    ok(st == 200 and r["analise"] == {"ponto": "desligada", "exposicao": "medir"} and r["por"] == "supervisora-treino", "configuracao.u liga a medida da exposição: %s %r" % (st, r))
    for c in ({"exposicao": "aplicar"}, {"x": 1}, {}, {"ponto": True}):
        ok(pede("POST", "/treino/config", c, cookie=adm)[0] == 400, "interruptor recusa %r" % c)
    m.estado_gravar({"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "ligada", "exposicao": "ligada"}}]})
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["exposicao"] == "medir" and m.treino_cfg()["ponto"] == "desligada", "config/treino pela sincronização é recusada: %r" % m.treino_cfg())
    st, r = pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "treino", "valor": {"ponto": "ligada", "exposicao": "ligada"}}]}, cookie=adm)
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["ponto"] == "desligada", "nem pelo /ponto/docs: %r" % m.treino_cfg())
    st, r = pede("POST", "/treino/config", {"ponto": "medir", "exposicao": "desligada"}, cookie=adm)
    st, s1 = pede("GET", "/status", cookie=adm)
    mp_ = (s1.get("treino") or {}).get("modelo_ponto") or {}
    ok((s1.get("treino") or {}).get("analise") == {"ponto": "medir", "exposicao": "desligada"} and mp_.get("pronto") is False and mp_.get("erro") == "sem_modelo",
       "/status.treino acompanha (18/11: modelo_ponto sem o arquivo do modelo = sem_modelo): %r" % s1.get("treino"))
    # 18/11 (regra 19): Ligada só acima do critério (409 com o que falta); o modo duvidas existe em Só medir
    st, r = pede("POST", "/treino/config", {"ponto": "ligada"}, cookie=adm)
    m._treino_cfg["t"] = 0.0
    ok(st == 409 and r.get("error") == "criterio" and r.get("falta") and m.treino_cfg()["ponto"] == "medir", "Ligada abaixo do critério: 409: %s %r" % (st, r))
    st, r = pede("GET", "/treino/amostra?dia=%s&modo=duvidas&n=10" % DIA, cookie=so_ver)
    ok(st == 200 and len(r.get("itens") or []) == 10, "modo duvidas em Só medir: %s" % st)
    # 18/11 (Eduardo, ligar já): forcar liga abaixo do critério. Aqui sem o modelo instalado e sem vetor: contam as marcações.
    for c in ({"ponto": "medir", "forcar": True}, {"ponto": "ligada", "forcar": "sim"}, {"exposicao": "medir", "forcar": True}, {"forcar": True}):
        ok(pede("POST", "/treino/config", c, cookie=sup)[0] == 400, "forcar recusa %r" % c)
    ok(pede("POST", "/treino/config", {"ponto": "ligada", "forcar": True}, cookie=val)[0] == 403
       and pede("POST", "/treino/config", {"ponto": "ligada", "forcar": True}, cookie=so_ver)[0] == 403, "forcar sem configuracao.u: 403")
    real_rot = m.cena_rotulos
    m.cena_rotulos = lambda: [x for x in real_rot() if x[1] != "gramado"]
    m._cena_base_t[0] = time.time()
    st, r = pede("POST", "/treino/config", {"ponto": "ligada", "forcar": True}, cookie=sup)
    m.cena_rotulos = real_rot
    m._cena_base_t[0] = time.time()
    m._treino_cfg["t"] = 0.0
    ok(st == 409 and r.get("error") == "rotulos" and [f["k"] for f in r.get("falta") or []] == ["rot_gramado"] and m.treino_cfg()["ponto"] == "medir",
       "forcar sem foto de gramado marcada: 409 rotulos: %s %r" % (st, r))
    st, r = pede("POST", "/treino/config", {"ponto": "ligada", "forcar": True}, cookie=sup)
    m._treino_cfg["t"] = 0.0
    cf = m.treino_cfg()
    ok(st == 200 and r.get("abaixo", {}).get("por") == "supervisora-treino" and r.get("aviso") == "sem_modelo" and r.get("ponto_versao")
       and cf["ponto"] == "ligada" and cf["ponto_versao"] == r["ponto_versao"] and cf["abaixo"]["por"] == "supervisora-treino",
       "forcar sem modelo grava Ligada (nada é reconhecido): %s %r %r" % (st, r, cf))
    st, s3 = pede("GET", "/status", cookie=adm)
    mp3 = (s3.get("treino") or {}).get("modelo_ponto") or {}
    ok(mp3.get("erro") == "sem_modelo" and mp3.get("aviso") == "modelo não instalado: nada é reconhecido" and (mp3.get("abaixo") or {}).get("por") == "supervisora-treino"
       and mp3.get("ligada_versao") == r.get("ponto_versao"), "/status: modelo não instalado, nada é reconhecido, e quem ligou abaixo da meta: %r" % mp3)
    tdb = sqlite3.connect(m.TREINO_DB)
    ll = tdb.execute("select por, abaixo, versao, dados from liga_log").fetchall()
    tdb.close()
    d0 = json.loads(ll[0][3]) if ll else {}
    ok(len(ll) == 1 and ll[0][:3] == ("supervisora-treino", 1, r.get("ponto_versao")) and d0.get("modelo_ok") is False and d0.get("congelados") == 0
       and d0.get("faltam", {}).get("gramado") == 150 and d0.get("criterio_passa") is False, "liga_log com quem, quando e quanto faltava: %r" % (ll,))
    m._treino_cfg["t"] = 0.0
    ok(m.treino_cfg()["ponto"] == "ligada", "Ligada forçado com a versão congelada (vazia) não é rebaixado pela migração")
    st, s2 = pede("GET", "/status")
    ok("treino" not in s2, "/status anônimo sem o treino")

    # ---------- LGPD: marcações e documentos da foto saem ----------
    m.estado_gravar({"docs": [{"col": "sim", "id": "edits|ag_" + PRIMEIRA, "valor": {"b": 1}}, {"col": "sim", "id": "invalid|ag_" + PRIMEIRA, "valor": "olhos fechados"},
                              {"col": "sim", "id": "discarded|ag_" + PRIMEIRA, "valor": True}, {"col": "treino", "id": "ag_" + PRIMEIRA, "valor": {"verdict": "pode"}},
                              {"col": "sim", "id": "edits|ag_" + seg, "valor": {"b": 2}}]})
    r = m.lgpd_excluir([PRIMEIRA], [], quem="teste")
    tdb = sqlite3.connect(m.TREINO_DB)
    resto = [tdb.execute("select count(*) from %s where pid = ?" % t, (PRIMEIRA,)).fetchone()[0] for t in ("rotulo", "rotulo_hist", "medida")]
    outro = tdb.execute("select count(*) from rotulo where pid = ?", (seg,)).fetchone()[0]
    tdb.close()
    ok(resto == [0, 0, 0] and outro == 1, "LGPD apaga rotulo, histórico e medida da foto (e só dela): %r %r" % (resto, outro))
    ed = sqlite3.connect(m.ESTADO_DB)
    vivos = ed.execute("select col, id from doc where valor is not null and id like ?", ("%" + PRIMEIRA + "%",)).fetchall()
    fica = ed.execute("select count(*) from doc where valor is not null and id = ?", ("edits|ag_" + seg,)).fetchone()[0]
    ed.close()
    ok(not vivos and fica == 1, "LGPD apaga sim/edits, invalid, discarded e treino/ da foto no estado.db: %r" % vivos)
    ok(r.get("fotos") == 1 and not [f for f in r.get("falhas", []) if "treino" in f or "estado" in f], "lgpd_excluir sem falha do treino: %r" % r)
    ok(m.TREINO_DB in [b for b in (m.VENDAS_DB, m.ESTADO_DB, m.OPERACAO_DB, m.NUVEM_DB, m.TREINO_DB)] and "TREINO_DB)" in open(sys.argv[1], encoding="utf8").read(),
       "treino.db na lista de bancos do backup")
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-800:])
print(("OK" if not falhas else "FALHA") + " treino_agente: amostra fixa por dia e modo, formato fechado, conflito, permissões (Supervisora marca), limite, interruptor da análise, LGPD"
      + ("" if not falhas else " · " + " | ".join(falhas[:10])))
sys.exit(1 if falhas else 0)
