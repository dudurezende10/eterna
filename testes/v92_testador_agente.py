# v92, testador: conferências independentes do agente para as Estatísticas (plano docs/planos/2026-11-05-estatisticas.md),
# além do testes/estatisticas_agente.py. Roda sozinho com HOME temporário:
#   python3 -I testes/v92_testador_agente.py agente/eterna-agente.py
# A: no processo (met_escreve com gravações concorrentes de migração, importação e metricas_gravar; JSON antigo corrompido
#    que a migração não pode trocar; __proto__ em vendedor, posto e por; pagamento_s só do Checkout).
# B: o agente de verdade (/ponto/presenca dá 404; 429 depois de 30 importações por minuto; 500 em JSON; CORS; fuso no
#    /status com TZ=UTC no ambiente; migração com um resumo antigo quebrado no meio de 366 dias).
# Dados sintéticos; nenhum dado de cliente.
import importlib.util, json, os, random, shutil, subprocess, sys, tempfile, threading, time, http.client

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []
os.environ["TZ"] = "America/Sao_Paulo"   # as datas do teste no fuso do venue (o agente de verdade força o mesmo no main)
time.tzset()


def ok(c, msg):
    if not c:
        falhas.append(msg)


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


# ======================= A: no processo =======================
HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1")
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.sess_rostos_on = lambda: False
os.makedirs(m.MET_DIR, exist_ok=True)

# --- met_escreve: migração e importação de entradas ao mesmo tempo no mesmo dia antigo; nada se perde ---
dias = [m._ff_hoje(time.time() - (30 + i) * 86400) for i in range(6)]
for d in dias:
    json.dump({"dia": d, "gerado": "x", "fotos": 77, "sessoes": 7, "vendas": 2, "faturamento": 300.0, "por_fotografo": {}, "por_vendedor": {}},
              open(os.path.join(m.MET_DIR, d + ".json"), "w"))
    t = time.mktime(time.strptime(d + " 11:05:00", "%Y-%m-%d %H:%M:%S"))
    m.ev_receber({"eventos": [{"tipo": "criar", "idem": "vc%s:1" % d.replace("-", ""), "venda": "vc" + d.replace("-", ""), "em": iso(t - 45),
                               "dados": {"card": "LPCON0001", "total": 150, "canal": "checkout", "lang": "en", "cart": [{"id": "gramado", "v": 150}]}},
                              {"tipo": "pagar", "idem": "vc%s:2" % d.replace("-", ""), "venda": "vc" + d.replace("-", ""), "em": iso(t), "dados": {}}]})
erros_th = []


def importa(d, n):
    try:
        v, _ = m.entradas_validar({"origem": "bip", "dia": d, "seg": [36000 + i for i in range(n)]})
        m.entradas_gravar(*v)
        m._met_regrava(d)
    except Exception as ex:
        erros_th.append(repr(ex))


ths = [threading.Thread(target=m.metricas_migra_v2, kwargs={"pausa": 0})]
for d in dias:
    ths += [threading.Thread(target=importa, args=(d, 5)) for _ in range(4)]
random.shuffle(ths)
[t.start() for t in ths]
[t.join(30) for t in ths]
fim = time.time() + 5
while time.time() < fim and m.est_migra["estado"] != "feita":
    time.sleep(0.05)
time.sleep(0.8)   # entradas_gravar regrava numa thread
perdidos = []
for d in dias:
    try:
        x = json.load(open(os.path.join(m.MET_DIR, d + ".json")))
    except Exception as ex:
        perdidos.append((d, "não abre: %s" % ex))
        continue
    if not (x.get("fotos") == 77 and x.get("v") == 2 and x.get("migrado") and (x.get("entradas") or {}).get("total") == 5
            and (x.get("por_hora") or {}).get("11", {}).get("vendas") == 1):
        perdidos.append((d, {k: x.get(k) for k in ("fotos", "v", "migrado", "entradas")}))
ok(not perdidos and not erros_th, "S1: migração e importação concorrentes no mesmo dia guardam v1, v2 e entradas: %r %r" % (perdidos[:2], erros_th[:2]))
ok(not [n for n in os.listdir(m.MET_DIR) if n.endswith(".tmp")], "S1: nenhum .tmp sobrando depois das gravações concorrentes")

# --- JSON antigo corrompido: a migração não troca (e marca o erro) ---
d_q = m._ff_hoje(time.time() - 50 * 86400)
arq_q = os.path.join(m.MET_DIR, d_q + ".json")
ruim = b'{"dia": "' + d_q.encode() + b'", "fotos": 9, "vendas": '
open(arq_q, "wb").write(ruim)
m.metricas_migra_v2(pausa=0)
ok(open(arq_q, "rb").read() == ruim, "S1: a migração deixa o resumo antigo quebrado com os mesmos bytes")
ok(m.est_migra["estado"] == "feita" and d_q in (m.est_migra.get("erro") or ""), "S1: a migração termina e registra o dia que não abriu: %r" % m.est_migra)

# --- metricas_gravar de hoje concorrendo com importação de hoje: JSON válido e com as entradas ---
hoje = m._ff_hoje()
v, _ = m.entradas_validar({"origem": "catraca", "dia": hoje, "seg": [40000, 40001, 40002]})
ths = [threading.Thread(target=m.metricas_gravar, args=(hoje,)) for _ in range(6)] + [threading.Thread(target=m.entradas_gravar, args=v) for _ in range(3)]
[t.start() for t in ths]
[t.join(30) for t in ths]
time.sleep(0.8)
m.metricas_gravar(hoje)
xh = json.load(open(os.path.join(m.MET_DIR, hoje + ".json")))
ok((xh.get("entradas") or {}).get("total") == 3 and xh.get("v") == 2, "S1: hoje com gravações concorrentes fica v2 com as entradas: %r" % xh.get("entradas"))

# --- __proto__ / constructor / prototype em vendedor, posto e por ---
# dia fixo no passado, às 14 h (nunca cai na virada do dia, qualquer que seja a hora em que o teste roda)
d_fix = m._ff_hoje(time.time() - 45 * 86400)
t_fix = time.mktime(time.strptime(d_fix + " 14:00:00", "%Y-%m-%d %H:%M:%S"))
th = t_fix
r = m.ev_receber({"posto": "prototype", "eventos": [
    {"tipo": "criar", "idem": "vpr1:1", "venda": "vpr1", "em": iso(th - 30), "posto": "__proto__", "por": {"nome": "__proto__"},
     "dados": {"card": "LPPRO0001", "total": 70, "canal": "checkout", "vendedor": {"nome": "__proto__"}, "cart": [{"id": "constructor", "v": 70}]}},
    {"tipo": "pagar", "idem": "vpr1:2", "venda": "vpr1", "em": iso(th), "por": {"nome": "constructor"}, "dados": {}}]})
ok(all(x["s"] == "ok" for x in r["resultados"]), "__proto__: a venda é aceita (só o campo sai): %r" % r)
md = m.metricas_dia(d_fix)
txt = json.dumps({k: md.get(k) for k in ("por_vendedor", "por_posto", "por_confirmador", "por_produto")})
ok(not any(p in txt for p in ('"__proto__"', '"constructor"', '"prototype"')), "__proto__: nenhum nome proibido vira chave no resumo: %s" % txt[:300])

# --- pagamento_s só do Checkout: balcão demorado e venda sem canal ficam fora ---
tb = t_fix + 3600                     # 15:00 do mesmo dia fixo; o criar fica às 14:45
m.ev_receber({"eventos": [
    {"tipo": "criar", "idem": "vbl1:1", "venda": "vbl1", "em": iso(tb - 900), "dados": {"card": "LPBAL0001", "total": 70, "canal": "balcao"}},
    {"tipo": "pagar", "idem": "vbl1:2", "venda": "vbl1", "em": iso(tb), "por": {"nome": "Rui"}, "dados": {}},
    {"tipo": "criar", "idem": "vsc1:1", "venda": "vsc1", "em": iso(tb - 900), "dados": {"card": "LPSC00001", "total": 70}},
    {"tipo": "pagar", "idem": "vsc1:2", "venda": "vsc1", "em": iso(tb), "por": {"nome": "Rui"}, "dados": {}}]})
md = m.metricas_dia(d_fix)
ps = md["tempos"]["pagamento_s"]
ok(ps["n"] == 1 and ps["f"][4] == 0 and "Rui" not in md["por_confirmador"], "R3: pagamento_s só conta o Checkout (balcão e sem canal com 15 min ficam fora): %r %r" % (ps, md["por_confirmador"]))
shutil.rmtree(HA, ignore_errors=True)


# ======================= B: o agente de verdade =======================
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao
COOKIES = {}


def sobe(home, porta, extra=None):
    env = {**os.environ, "HOME": home, "USERPROFILE": home, "ETERNA_PORTA": str(porta), "ETERNA_FTP_PORTA": str(porta + 1000),
           "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", **(extra or {})}
    for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_BUCKET", "ETERNA_TZ"):
        if k not in (extra or {}):
            env.pop(k, None)
    COOKIES[porta] = _agente_sessao.cookie_sub(AG, home)      # pessoa conectada (admin): as rotas da equipe pedem sessão
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        time.sleep(0.25)
        if req(porta, "GET", "/status")[0] == 200:
            break
    return p


def req(porta, metodo, path, body=None, headers=None, raw=False):
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=15)
    try:
        hs = {"Host": "127.0.0.1:%d" % porta, **({"Cookie": COOKIES[porta]} if porta in COOKIES else {}), **(headers or {})}
        data = json.dumps(body).encode() if body is not None else None
        if data is not None:
            hs["Content-Type"] = "application/json"
        c.request(metodo, path, body=data, headers=hs)
        r = c.getresponse()
        b = r.read()
        if raw:
            return r.status, b, dict((k.lower(), v) for k, v in r.getheaders())
        try:
            return r.status, json.loads(b)
        except Exception:
            return r.status, None
    except Exception as ex:
        return (0, ("sem resposta: " + str(ex)).encode(), {}) if raw else (0, {"erro": str(ex)})
    finally:
        c.close()


X = {"X-Eterna": "1"}
P1 = 9100 + random.randint(0, 400)
HB = tempfile.mkdtemp()
MD = os.path.join(HB, "Eterna", "ponto", "metricas")
os.makedirs(MD, exist_ok=True)
json.dump({"users": {"carlos": "x" * 12}}, open(os.path.join(HB, "Eterna", "ftp.json"), "w"))
t0 = time.time()
quebrado = time.strftime("%Y-%m-%d", time.localtime(t0 - 360 * 86400))   # entre os primeiros que a migração lê
for i in range(2, 368):
    dd = time.strftime("%Y-%m-%d", time.localtime(t0 - i * 86400))
    if dd == quebrado:
        open(os.path.join(MD, dd + ".json"), "wb").write(b'{"dia": "' + dd.encode() + b'", "fotos": ')
        continue
    json.dump({"dia": dd, "gerado": "x", "fotos": 100, "sessoes": 10, "vendas": 3, "faturamento": 500.0, "por_fotografo": {}, "por_vendedor": {}, "por_posto": {}, "por_meio": {}},
              open(os.path.join(MD, dd + ".json"), "w"))
A = sobe(HB, P1, {"TZ": "UTC"})
try:
    s, st = req(P1, "GET", "/status")
    ok(s == 200, "agente subiu: %r" % s)
    fz = (st or {}).get("fuso") or {}
    ok(fz.get("tz") == "America/Sao_Paulo" and fz.get("offset_min") == -180, "fuso: com TZ=UTC no ambiente o agente usa America/Sao_Paulo (-180): %r" % fz)
    # presença saiu: 404 (POST com tudo certo e GET)
    s1, _ = req(P1, "POST", "/ponto/presenca", {"chave": "carlos", "posto": "Caixa 1"}, X)
    s2, _ = req(P1, "GET", "/ponto/presenca")
    ok(s1 == 404 and s2 != 200, "sem presença: POST /ponto/presenca responde 404 e o GET não existe (POST %r, GET %r)" % (s1, s2))
    # 366 dias com um resumo quebrado no meio: responde, sem 500, e o quebrado não é trocado
    de = time.strftime("%Y-%m-%d", time.localtime(t0 - 367 * 86400))
    ini = time.time()
    s, md = req(P1, "GET", "/metricas/dia?de=%s&ate=%s" % (de, time.strftime("%Y-%m-%d")))
    dt = time.time() - ini
    ok(s == 200 and dt < 2 and len((md or {}).get("dias") or []) >= 365, "27: 366 dias (um quebrado) em %.2f s, status %r, %d dias" % (dt, s, len((md or {}).get("dias") or [])))
    for _ in range(80):   # a migração espera 0,2 s por dia; o quebrado é o 8º mais antigo
        mg = (req(P1, "GET", "/status")[1] or {}).get("estatisticas", {}).get("migracao", {})
        if mg.get("feitos", 0) > 20:
            break
        time.sleep(0.25)
    ok(quebrado in (mg.get("erro") or ""), "S1: a migração registra o dia que não abriu: %r" % mg)
    ok(open(os.path.join(MD, quebrado + ".json"), "rb").read().endswith(b'"fotos": '), "S1: a migração do agente de verdade não troca o resumo quebrado")
    ok(json.load(open(os.path.join(MD, time.strftime("%Y-%m-%d", time.localtime(t0 - 362 * 86400)) + ".json"))).get("migrado") is True, "26: os dias antes do quebrado migraram")
    # dia inválido e datas trocadas
    s, _ = req(P1, "GET", "/metricas/dia?de=2026-02-31&ate=2026-03-01")
    ok(s == 400, "metricas/dia com data inválida: 400 (%r)" % s)
    # CORS: origem de fora não recebe Allow-Origin nem grava
    s, b, h = req(P1, "OPTIONS", "/ponto/entradas", headers={"Origin": "http://evil.example", "Access-Control-Request-Headers": "content-type, x-eterna"}, raw=True)
    ok("access-control-allow-origin" not in h, "CORS: origem de fora sem Allow-Origin em /ponto/entradas: %r" % h.get("access-control-allow-origin"))
    s, b, h = req(P1, "OPTIONS", "/ponto/entradas", headers={"Origin": "http://127.0.0.1:9", "Access-Control-Request-Headers": "content-type, x-eterna"}, raw=True)
    ok(h.get("access-control-allow-origin") == "http://127.0.0.1:9" and "X-Eterna" in (h.get("access-control-allow-headers") or ""), "CORS: app de origem com X-Eterna: %r" % h)
    ontem = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    s, _ = req(P1, "POST", "/ponto/entradas", {"origem": "bip", "dia": ontem, "seg": [1]}, {**X, "Origin": "http://evil.example"})
    ok(s == 403, "entradas de origem de fora: 403 (%r)" % s)
    # 429: mais de 30 importações por minuto
    sts = [req(P1, "POST", "/ponto/entradas", {"origem": "bip", "dia": ontem, "seg": [36000 + i]}, X)[0] for i in range(32)]
    ok(sts.count(200) <= 30 and sts[-1] == 429 and all(x in (200, 429) for x in sts), "limite: a 31ª importação no minuto dá 429: %r" % sts)
    s, b, h = req(P1, "POST", "/ponto/entradas", {"origem": "bip", "dia": ontem, "seg": [1]}, X, raw=True)
    ok(s == 429 and "json" in (h.get("content-type") or "") and json.loads(b).get("error"), "429 em JSON: %r %r" % (s, b[:80]))
finally:
    A.kill()
    A.wait()

# 500 em JSON: operacao.db que não abre (uma pasta no lugar do arquivo)
P2 = P1 + 1
H2 = tempfile.mkdtemp()
os.makedirs(os.path.join(H2, "Eterna", "ponto", "operacao.db"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12}}, open(os.path.join(H2, "Eterna", "ftp.json"), "w"))
A2 = sobe(H2, P2, {"ETERNA_TZ": "UTC"})
try:
    s, st = req(P2, "GET", "/status")
    ok(s == 200, "agente com operacao.db quebrado continua subindo: %r" % s)
    ok(((st or {}).get("fuso") or {}).get("offset_min") == 0, "fuso: ETERNA_TZ=UTC vale (offset 0): %r" % (st or {}).get("fuso"))
    ontem = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    s, b, h = req(P2, "POST", "/ponto/entradas", {"origem": "bip", "dia": ontem, "seg": [1, 2]}, X, raw=True)
    try:
        jb = json.loads(b)
    except Exception:
        jb = None
    ok(s == 500 and "json" in (h.get("content-type") or "") and isinstance(jb, dict) and jb.get("error"), "500 em JSON no POST /ponto/entradas: %r %r" % (s, b[:120]))
    s, b, h = req(P2, "GET", "/ponto/entradas/importacoes", raw=True)
    try:
        jb = json.loads(b)
    except Exception:
        jb = None
    ok(s == 500 and isinstance(jb, dict) and jb.get("error"), "500 em JSON no GET /ponto/entradas/importacoes: %r %r" % (s, b[:120]))
    s, md = req(P2, "GET", "/metricas/dia?de=%s&ate=%s" % (ontem, time.strftime("%Y-%m-%d")))
    ok(s == 200 and isinstance((md or {}).get("dias"), list), "metricas/dia continua respondendo sem o operacao.db: %r %r" % (s, [d.get("dia") for d in (md or {}).get("dias") or []]))
finally:
    A2.kill()
    A2.wait()
for h_ in (HB, H2):
    shutil.rmtree(h_, ignore_errors=True)

print(("OK v92_testador_agente: met_escreve concorrente, JSON quebrado, __proto__, pagamento_s, 404 da presença, 429, 500 JSON, CORS, fuso (v92)"
       if not falhas else "FALHA v92_testador_agente: " + " | ".join(falhas[:8])))
sys.exit(0 if not falhas else 1)
