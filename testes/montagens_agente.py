# v97 (selo Edição Maracanã, plano docs/planos/2026-11-11-selo-edicao-maracana.md, critérios 19 a 23): montagens vistas no
# Checkout, um número por dia e terminal no operacao.db, e as compradas no resumo do dia. Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/montagens_agente.py agente/eterna-agente.py [porta]
# Parte A: o módulo importado aqui (validação, teto de 40 terminais, compradas no met_v2). Parte B: o agente de verdade (rota,
# guarda, 403, 429, 409, resumo do dia, reinício, console). Nada de dado de cliente: vendas e números sintéticos.
import importlib.util, json, os, random, sqlite3, subprocess, sys, tempfile, time, http.client

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 47600 + random.randint(0, 300)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


# ======================= Parte A: no processo =======================
HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["USERPROFILE"] = HA
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
hoje, ontem = m._ff_hoje(), m._ff_hoje(time.time() - 86400)
anteontem, amanha = m._ff_hoje(time.time() - 2 * 86400), m._ff_hoje(time.time() + 86400)
v = m.montagens_validar
ok(v({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": 37}) == ((hoje, "k3x9q2m7a1b0", 37), None), "19: corpo válido")
ok(v({"dia": ontem, "terminal": "abcdefgh", "vistas": 0})[0] is not None, "19: ontem e terminal de 8 caracteres valem")
for corpo, campo in (({"dia": anteontem, "terminal": "k3x9q2m7a1b0", "vistas": 1}, "dia"), ({"dia": amanha, "terminal": "k3x9q2m7a1b0", "vistas": 1}, "dia"),
                     ({"dia": hoje, "terminal": "K3X9Q2M7A1B0", "vistas": 1}, "terminal"), ({"dia": hoje, "terminal": "abc", "vistas": 1}, "terminal"),
                     ({"dia": hoje, "terminal": "a" * 17, "vistas": 1}, "terminal"), ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": -1}, "vistas"),
                     ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": 1.5}, "vistas"), ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": "3"}, "vistas"),
                     ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": True}, "vistas"), ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": 20001}, "vistas"),
                     ({"dia": hoje, "terminal": "k3x9q2m7a1b0", "vistas": 1, "__proto__": 1}, "campo"), ([1, 2], "campo")):
    ok(v(corpo) == (None, campo), "20: recusa %r com %s: %r" % (corpo, campo, v(corpo)))
# 19: fica o maior; 20: o 41º terminal do dia é recusado
ok(m.montagens_gravar(hoje, "termaaaa0001", 37) == 37 and m.montagens_gravar(hoje, "termaaaa0001", 10) == 37 and m.montagens_gravar(hoje, "termaaaa0001", 50) == 50,
   "19: grava e mantém o maior")
for i in range(2, 41):
    m.montagens_gravar(hoje, "termaaaa%04d" % i, 1)
ok(m.montagens_gravar(hoje, "termaaaa0041", 1) is None and m.montagens_gravar(hoje, "termaaaa0040", 9) == 9, "20: 41º terminal recusado; o 40º continua atualizando")
ok(m.montagens_dia(hoje) == 50 + 38 + 9 and m.montagens_dia(ontem) is None, "21: soma dos terminais e dia sem linha = None: %r" % m.montagens_dia(hoje))
# 21: compradas = nAI das vendas pagas do Checkout
t = time.time() - 600


def evs(venda, canal, nai, tipos):
    out = []
    for i, tp in enumerate(tipos):
        d = {"card": "LPAAAA111", "total": 150, "canal": canal, "nAI": nai} if tp == "criar" else {}
        out.append({"tipo": tp, "idem": "%s:%d" % (venda, i), "venda": venda, "em": iso(t + i), "dados": d})
    return out


E = evs("vck001", "checkout", 2, ["criar", "pagar"]) + evs("vbl001", "balcao", 3, ["criar", "pagar"]) + evs("vck002", "checkout", 4, ["criar"]) + \
    evs("vck003", "checkout", 5, ["criar", "cancelar"]) + evs("vck004", "checkout", 1, ["criar", "pagar"])
r2 = m.met_v2(hoje, [], E)
ok(r2.get("montagens") == {"vistas": 97, "compradas": 3}, "21: compradas só do Checkout pago (2 + 1): %r" % r2.get("montagens"))
ok(m.met_v2(ontem, [], [])["montagens"] == {"vistas": None, "compradas": 0}, "21: dia sem registro = vistas null")

# ======================= Parte B: o agente de verdade =======================
HB = tempfile.mkdtemp()
os.makedirs(os.path.join(HB, "Eterna", "ponto"), exist_ok=True)
# 39 terminais já gravados hoje (o 40º entra pela rota; o 41º dá 409)
db = sqlite3.connect(os.path.join(HB, "Eterna", "ponto", "operacao.db"))
db.execute("create table if not exists montagem_vista (dia text, terminal text, vistas int, em real, primary key (dia, terminal))")
for i in range(39):
    db.execute("insert into montagem_vista values (?, ?, ?, ?)", (hoje, "semente%05d" % i, 2, time.time()))
db.commit()
db.close()
env = {**os.environ, "HOME": HB, "USERPROFILE": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(PORTA + 100),
       "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "USER": "eterna-teste-sem-cartao"}
for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_BUCKET"):
    env.pop(k, None)


sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao   # v93: as rotas da equipe pedem sessão (tabela ROTAS); o teste usa um admin no HOME temporário
COOKIE = _agente_sessao.cookie_sub(AG, HB)


def req(metodo, path, body=None, headers=None, cru=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=15)
    try:
        hs = {"Host": "127.0.0.1:%d" % PORTA, "Cookie": COOKIE, **(headers or {})}
        data = cru if cru is not None else (json.dumps(body).encode() if body is not None else None)
        if data is not None:
            hs["Content-Type"] = "application/json"
        c.request(metodo, path, body=data, headers=hs)
        r = c.getresponse()
        b = r.read()
        try:
            return r.status, json.loads(b)
        except Exception:
            return r.status, None
    except Exception as ex:
        return 0, {"erro": str(ex)}
    finally:
        c.close()


def subir():
    log = open(os.path.join(HB, "console.txt"), "ab")
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=log, stderr=subprocess.STDOUT)
    for _ in range(100):
        time.sleep(0.25)
        if req("GET", "/status")[0] == 200:
            break
    return p


def mont(dia=None):
    s, md = req("GET", "/metricas/dia?de=%s&ate=%s" % (dia or hoje, dia or hoje))
    return (((md or {}).get("dias") or [{}])[0]).get("montagens")


X = {"X-Eterna": "1"}
TERM = "k3x9q2m7a1b0"
A = subir()
try:
    # 20: sem X-Eterna, de outra origem ou outro Host: 403 (não contam no limite)
    s1, _ = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 5})
    s2, _ = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 5}, {**X, "Origin": "http://evil.example"})
    s3, _ = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 5}, {**X, "Origin": "http://127.0.0.1:9"})
    s4, _ = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 5}, {**X, "Host": "evil.example:%d" % PORTA})
    ok((s1, s2, s3, s4) == (403, 403, 403, 403), "20: sem X-Eterna, origem de fora (até a do app publicado) e Host de fora: 403: %r" % ((s1, s2, s3, s4),))
    # 19: grava, mantém o maior e responde o valor gravado
    a1 = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 37}, X)
    a2 = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 12}, {**X, "Origin": "http://127.0.0.1:%d" % PORTA})
    a3 = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 37}, X)
    ok(a1 == (200, {"ok": True, "vistas": 37}) and a2 == (200, {"ok": True, "vistas": 37}) and a3 == (200, {"ok": True, "vistas": 37}),
       "19: grava 37, um número menor mantém 37, o mesmo total não muda: %r" % ((a1, a2, a3),))
    # 20: recusas pela rota
    rs = [req("POST", "/ponto/montagens", c, X) for c in ({"dia": anteontem, "terminal": TERM, "vistas": 1}, {"dia": hoje, "terminal": "AB", "vistas": 1},
                                                           {"dia": hoje, "terminal": TERM, "vistas": 1.0}, {"dia": hoje, "terminal": TERM, "vistas": 20001},
                                                           {"dia": hoje, "terminal": TERM, "vistas": 1, "__proto__": {"x": 1}})]
    ok([x[0] for x in rs] == [400] * 5 and [x[1].get("error") for x in rs] == ["dia", "terminal", "vistas", "vistas", "campo"], "20: 400 com o campo: %r" % rs)
    big = req("POST", "/ponto/montagens", cru=json.dumps({"dia": hoje, "terminal": TERM, "vistas": 1, "x": "a" * 1100}).encode(), headers=X)
    ok(big[0] in (400, 413), "20: corpo acima de 1 KB recusado: %r" % (big,))
    # 20: o 41º terminal do dia (39 já gravados + o TERM) dá 409 e conta no /status
    t41 = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": "outroterm041", "vistas": 3}, X)
    st = req("GET", "/status")[1] or {}
    ok(t41 == (409, {"ok": False, "error": "muitos_terminais"}) and (st.get("estatisticas") or {}).get("montagens_recusadas") == 1, "20: 41º terminal: 409 e /status: %r" % ((t41, st.get("estatisticas")),))
    # 21: resumo do dia: soma dos terminais e compradas só das vendas pagas do Checkout
    sv, jv = req("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": E}, {"X-Eterna": "1"})
    ok(sv == 200, "21: eventos aceitos: %r" % ((sv, jv),))
    mh = mont()
    ok(mh == {"vistas": 39 * 2 + 37, "compradas": 3}, "21: montagens no /metricas/dia: %r" % mh)
    ok(mont(ontem) in (None, {"vistas": None, "compradas": 0}), "21: ontem sem linha: vistas null: %r" % mont(ontem))
    # 20: 30 por minuto por IP (o 31º no minuto dá 429)
    n429 = 0
    for i in range(32):
        s_, _ = req("POST", "/ponto/montagens", {"dia": hoje, "terminal": TERM, "vistas": 37}, X)
        if s_ == 429:
            n429 = i
            break
    ok(n429 > 0, "20: 429 depois de 30 pedidos no minuto")
    # CORS com X-Eterna (mesmo padrão do /ponto/entradas)
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request("OPTIONS", "/ponto/montagens", headers={"Host": "127.0.0.1:%d" % PORTA, "Origin": "http://127.0.0.1:%d" % PORTA, "Access-Control-Request-Headers": "content-type, x-eterna"})
    rr = c.getresponse()
    rr.read()
    ok("X-Eterna" in (rr.getheader("Access-Control-Allow-Headers") or ""), "CORS: X-Eterna no Allow-Headers: %r" % rr.getheader("Access-Control-Allow-Headers"))
    c.close()
finally:
    A.kill()
    A.wait()
# 23: reinício: os números continuam
A = subir()
try:
    mh2 = mont()
    ok(mh2 == {"vistas": 39 * 2 + 37, "compradas": 3}, "23: depois do reinício, os mesmos números: %r" % mh2)
finally:
    A.kill()
    A.wait()
# 22: só dia, terminal, vistas e em; nada de IP, sessão, foto ou nome no banco e no console
db = sqlite3.connect(os.path.join(HB, "Eterna", "ponto", "operacao.db"))
cols = [r[1] for r in db.execute("pragma table_info(montagem_vista)")]
linhas = db.execute("select * from montagem_vista").fetchall()
db.close()
ok(cols == ["dia", "terminal", "vistas", "em"], "22: colunas da tabela: %r" % cols)
ok(not any("127.0.0.1" in str(x) for r in linhas for x in r), "22: nenhum IP no banco")
console = open(os.path.join(HB, "console.txt"), encoding="utf8", errors="replace").read()
ok(TERM not in console and "outroterm041" not in console and "montagens" not in console.lower().replace("montagens_recusadas", ""), "22: o console não imprime o corpo nem o terminal")
falhas = [x for x in falhas if x]
print(("OK montagens_agente: critérios 19 a 23 do plano do selo (POST /ponto/montagens, 40 terminais, 403/400/409/429, resumo do dia, reinício, sem dado pessoal)" if not falhas else "FALHA montagens_agente: " + " | ".join(falhas[:8])))
sys.exit(0 if not falhas else 1)
