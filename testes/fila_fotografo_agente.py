# v87: Fila do fotógrafo no agente (critérios 1 a 13 do plano docs/planos/2026-10-30-fila-do-fotografo.md).
# Rodado por testes/fila-fotografo.js com HOME temporário:
#   python3 -I testes/fila_fotografo_agente.py agente/eterna-agente.py <porta>
# Parte A: o módulo importado aqui (regras com relógio controlado, rostos, cartão, pasta vigiada, câmera atrasada, poda).
# Parte B: o agente de verdade em outro processo, com FTP embutido, pausa de teste de 3 s e cap pelo EXIF.
# Só imagens lisas geradas aqui (nunca foto de convidado).
import importlib.util, io, json, os, socket, subprocess, sys, tempfile, time, ftplib, http.client
from PIL import Image

AG = sys.argv[1]
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 8971
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


def jpeg(cor=(30, 90, 160), cap=None, autor=None, serie=None):
    im = Image.new("RGB", (640, 480), cor)
    ex = Image.Exif()
    if autor:
        ex[0x013B] = autor
    sub = ex.get_ifd(0x8769)
    if cap:
        sub[0x9003] = time.strftime("%Y:%m:%d %H:%M:%S", time.localtime(cap))
    if serie:
        sub[0xA431] = serie
    b = io.BytesIO()
    im.save(b, "JPEG", quality=80, exif=ex.tobytes())
    return b.getvalue()


_cor = [0]


def cor():
    _cor[0] += 1
    c = _cor[0]
    return (c * 37 % 256, c * 91 % 256, c * 53 % 256)


# ======================= Parte A: no processo =======================
HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ["ETERNA_SESSAO_PAUSA"] = "3"
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
ok(m.FF_PAUSA == 3 and m.FF_PRONTA_MIN == 15, "constantes: pausa %r, pronta_min %r" % (m.FF_PAUSA, m.FF_PRONTA_MIN))
m.ff_carregar()
P = m.FF_PAUSA
T = time.time()
_seq = [0]


def foto(o, s, u, cap=None, serie="", autor="", dono=""):
    _seq[0] += 1
    pid = "%012x" % (0xa00000000000 + _seq[0])
    md = {"o": o, "s": s, "u": u}
    if cap:
        md["cap"] = cap
    if serie:
        md["serie"] = serie
    if autor:
        md["autor"] = autor
    if dono:
        md["dono"] = dono
    m.ff_add(pid, md)
    return pid


def grupos(agora):
    return m.ff_json(agora)["grupos"]


def um(gs, **kw):
    r = [g for g in gs if all(g.get(k) == v for k, v in kw.items())]
    return r[0] if len(r) == 1 else None


# 2 e 8: cliques num segundo só, chegando devagar (fila de envio); a câmera da Sandessa com o relógio 2 h atrasado
for nome, serie, atraso in (("marinara", "111100002222", 0), ("sandessa", "333300004444", 7200)):
    base = T + (0 if nome == "marinara" else 100)
    ns = []
    for i in range(8):
        foto(nome, "ftp", base + 0.5 + i, cap=base - atraso, serie=serie)
        g = um(grupos(base + 0.6 + i), fotografo=nome)
        ns.append((g or {}).get("n"))
        if i == 1:
            ok(g and g["estado"] == "fotografando", "%s: logo depois dos cliques deveria estar fotografando: %r" % (nome, g))
        if i >= 5:
            ok(g and g["estado"] == "subindo", "%s (atraso %d s): cliques há mais de %d s e fotos chegando = subindo: %r" % (nome, atraso, P, g))
    ok(ns == list(range(1, 9)), "%s: n sobe a cada chegada: %r" % (nome, ns))
    g = um(grupos(base + 7.5 + P + 0.1), fotografo=nome)
    ok(g and g["estado"] == "pronta" and g["pids"] == [] and g["pronta_em"], "%s: %d s sem chegada = pronta, sem pids: %r" % (nome, P, g))

# 4: rostos ligados, uma foto do grupo ainda na fila de rostos
m.rostos["ligado"], m.rostos["motivo"] = True, None
t4 = T + 300
p4 = [foto("samuel", "ftp", t4 + i * 0.5, cap=t4 + i * 0.5 - 0.2, serie="555500006666") for i in range(3)]
for p in p4:
    m.ff_rosto_fila(p)
m.ff_rosto_lido(p4[0]); m.ff_rosto_lido(p4[1])
g = um(grupos(t4 + 10), fotografo="samuel")
ok(g and g["estado"] == "subindo", "4: foto na fila de rostos segura o grupo fora de pronta: %r" % g)
m.ff_rosto_lido(p4[2])
g = um(grupos(t4 + 10), fotografo="samuel")
ok(g and g["estado"] == "pronta", "4: leitura terminada = pronta: %r" % g)
m.rostos["ligado"], m.rostos["motivo"] = False, "sem OpenCV"

# 5: carlos e marinara alternados = grupos separados
t5 = T + 400
for i in range(6):
    foto("carlos" if i % 2 == 0 else "marinara", "ftp", t5 + i * 0.4, cap=t5 + i * 0.4 - 0.2)
gs = [g for g in grupos(t5 + 2.5) if g["inicio"] >= t5]
ok(sorted((g["fotografo"], g["n"]) for g in gs) == [("carlos", 3), ("marinara", 3)], "5: grupos separados: %r" % [(g["fotografo"], g["n"]) for g in gs])

# 6: subpasta não cadastrada na pasta vigiada: sem fotógrafo e sem o nome da subpasta
t6 = T + 500
foto("fulano", "ftp", t6, serie="987600001234")
foto("ciclano", "ftp", t6 + 0.2)
gs = [g for g in grupos(t6 + 1) if g["inicio"] >= t6]
fontes = sorted(g["fonte"] for g in gs)
ok(all(g["fotografo"] is None for g in gs) and fontes == ["câmera ···1234", "pasta"], "6: fonte da câmera ou pasta: %r" % fontes)
ok("fulano" not in json.dumps(m.ff_json(t6 + 1)) and "ciclano" not in json.dumps(m.ff_json(t6 + 1)), "6: nome da subpasta não pode sair")
ok("987600001234" not in json.dumps(m.ff_json(t6 + 1)), "6: série completa não pode sair")

# 7: autor EXIF "Yago" vindo do cartão (pelo ingest_file de verdade)
d7 = tempfile.mkdtemp()
f7 = os.path.join(d7, "IMG_0001.JPG")
open(f7, "wb").write(jpeg(cor(), cap=time.time() - 30, autor="Yago", serie="222200007777"))
r = m.ingest_file(f7, "IMG_0001.JPG", os.stat(f7), "EOS_DIGITAL", "cartao")
gs = [g for g in m.ff_json()["grupos"] if g["fonte"] == "cartão"]
ok(r == "new" and len(gs) == 1 and gs[0]["fotografo"] == "yago" and gs[0]["estado"] == "subindo", "7: cartão com autor Yago: %r %r" % (r, gs))

# 9: a função nova vale só para os grupos novos
t9 = time.time() + 1000
with m.ff_lock:
    m.ff_funcao.update(dia=m._ff_hoje(), map={"klassius": {"tipo": "campo", "point": "campo2"}})
foto("klassius", "ftp", t9)
with m.ff_lock:
    m.ff_funcao.update(dia=m._ff_hoje(), map={"klassius": {"tipo": "volante", "modo": "chute"}})
foto("klassius", "ftp", t9 + 1)
foto("klassius", "ftp", t9 + 1 + P + 1)
gs = sorted([g for g in grupos(t9 + P + 3) if g["fotografo"] == "klassius"], key=lambda g: g["inicio"])
ok([g["funcao"] for g in gs] == [{"tipo": "campo", "point": "campo2"}, {"tipo": "volante", "modo": "chute"}] and [g["n"] for g in gs] == [2, 1],
   "9: função fotografada na abertura do grupo: %r" % [(g["funcao"], g["n"]) for g in gs])

# 11: pronta há mais de FF_PRONTA_MIN sai; a virada do dia limpa
t11 = time.time() + 2000
foto("sandessa", "ftp", t11)
ok(um(grupos(t11 + P + 60), fotografo="sandessa"), "11: pronta há 1 min aparece")
ok(not [g for g in grupos(t11 + P + 2 + 15 * 60) if g["fotografo"] == "sandessa"], "11: pronta há mais de 15 min não aparece")
amanha = time.mktime(time.strptime(m._ff_hoje(), "%Y-%m-%d")) + 86400 + 3600
ok(m.ff_json(amanha)["grupos"] == [], "11: a virada do dia limpa a lista")

# 12 (validação do POST, sem rede)
ok(m.ff_funcao_validar({"dia": m._ff_hoje(), "map": {"carlos": {"tipo": "campo", "point": "../x"}}}) is None, "point inválido")
ok(m.ff_funcao_validar({"dia": m._ff_hoje(), "map": {"intruso": {"tipo": "folga"}}}) is None, "chave não cadastrada")
ok(m.ff_funcao_validar({"dia": "2020-01-01", "map": {}}) is None, "dia de outro dia")
ok(m.ff_funcao_validar({"dia": m._ff_hoje(), "map": {"Márcio": {"tipo": "volante", "modo": "chute", "from": "terminal", "x": "<b>"}}})
   == (m._ff_hoje(), {"marcio": {"tipo": "volante", "modo": "chute"}}), "função limpa (só tipo, point e modo; sem acento)")

# ======================= Parte B: o agente de verdade =======================
HB = tempfile.mkdtemp()
FTPP = PORTA + 1000
ORIG = "http://eterna-tv.local:%d" % PORTA
env = {**os.environ, "HOME": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP), "ETERNA_APP_ORIGIN": "http://127.0.0.1:9",
       "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": "3", "ETERNA_ORIGENS": ORIG, "ETERNA_LEITORES": "1"}
env.pop("ETERNA_PASTA", None)
env["USER"] = "eterna-teste-sem-cartao"     # o vigia de cartões procura em /media/<USER>/: nenhum cartão do computador entra


def req(method, path, body=None, headers=None, origem=None):
    h = dict(headers or {})
    h.setdefault("Host", "127.0.0.1:%d" % PORTA)
    data = None
    if body is not None:
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10, source_address=(origem, 0) if origem else None)
    try:
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        b = r.read()
        try:
            j = json.loads(b)
        except Exception:
            j = None
        return r.status, j, dict(r.getheaders())
    except Exception as ex:
        return 0, {"erro": str(ex)}, {}
    finally:
        c.close()


def subir():
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        time.sleep(0.25)
        if req("GET", "/status")[0] == 200:
            return p
    p.kill()
    raise SystemExit(json.dumps({"ok": False, "falhas": ["agente não subiu: " + p.stdout.read().decode()[-400:]]}))


def fila():
    s, j, h = req("GET", "/fila-fotografo")
    return j["grupos"] if s == 200 and j else []


def g_de(nome, gs=None):
    r = [g for g in (gs if gs is not None else fila()) if g["fotografo"] == nome]
    return r[-1] if r else None


senhas = {}


def ftp_envia(user, itens):
    f = ftplib.FTP()
    f.connect("127.0.0.1", FTPP, timeout=10)
    f.login(user, senhas[user])
    for nome, dados in itens:
        f.storbinary("STOR " + nome, io.BytesIO(dados))
    f.quit()


procs = []
try:
    A = subir(); procs.append(A)
    senhas.update(json.load(open(os.path.join(HB, "Eterna", "ftp.json")))["users"])
    hoje = time.strftime("%Y-%m-%d")
    s, j, h = req("GET", "/fila-fotografo")
    ok(s == 200 and j["ok"] and j["pausa"] == 3 and j["pronta_min"] == 15 and j["grupos"] == [] and h.get("Cache-Control") == "no-store",
       "GET vazio: %r %r %r" % (s, j, h.get("Cache-Control")))
    # 1: três cliques a t, t+1, t+2 chegando juntos
    t = int(time.time()) - 2
    ftp_envia("carlos", [("C%d.JPG" % i, jpeg(cor(), cap=t + i, serie="100000001111")) for i in range(3)])
    g = g_de("carlos")
    ok(g and g["estado"] == "fotografando" and g["n"] == 3 and g["fonte"] == "ftp" and 1 <= len(g["pids"]) <= 3,
       "1: fotografando com n 3: %r" % g)
    # 3: pausa de teste sem chegada
    time.sleep(3.6)
    g = g_de("carlos")
    ok(g and g["estado"] == "pronta" and g["pronta_em"] and g["pids"] == [], "3: pronta, pronta_em e pids vazio: %r" % g)
    # 2 (ao vivo): cliques no mesmo segundo, chegando um a um
    t2 = int(time.time())
    vistos = []
    for i in range(9):
        ftp_envia("marinara", [("M%d.JPG" % i, jpeg(cor(), cap=t2, serie="200000002222"))])
        g = g_de("marinara")
        vistos.append((round(time.time() - t2, 1), g and g["estado"], g and g["n"]))
        time.sleep(0.6)
    ok([v[2] for v in vistos] == list(range(1, 10)), "2: n sobe a cada chegada: %r" % vistos)
    ok(any(v[1] == "subindo" for v in vistos if v[0] > 4.2) and all(v[1] in ("fotografando", "subindo") for v in vistos),
       "2: cliques antigos e fotos chegando = subindo: %r" % vistos)
    # 5: alternados
    ftp_envia("carlos", [("A0.JPG", jpeg(cor()))]); ftp_envia("samuel", [("A1.JPG", jpeg(cor()))])
    ftp_envia("carlos", [("A2.JPG", jpeg(cor()))]); ftp_envia("samuel", [("A3.JPG", jpeg(cor()))])
    gs = [g for g in fila() if g["estado"] != "pronta" and g["fotografo"] in ("carlos", "samuel")]
    ok(sorted((g["fotografo"], g["n"]) for g in gs) == [("carlos", 2), ("samuel", 2)], "5: alternados em grupos separados: %r" % gs)
    time.sleep(3.6)
    # 9 e 12: POST da função
    H1 = {"X-Eterna": "1"}
    s, j, _ = req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {"samuel": {"tipo": "campo", "point": "campo4"}}}, H1)
    ok(s == 200 and j == {"ok": True}, "POST da função: %r %r" % (s, j))
    fj = os.path.join(HB, "Eterna", "ponto", "funcao.json")
    ok(os.path.exists(fj) and oct(os.stat(fj).st_mode & 0o777) == "0o600", "funcao.json com chmod 600")
    ftp_envia("samuel", [("S0.JPG", jpeg(cor()))])
    req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {"samuel": {"tipo": "volante", "modo": "chute"}}}, H1)
    ftp_envia("samuel", [("S1.JPG", jpeg(cor()))])
    g = g_de("samuel")
    ok(g and g["n"] == 2 and g["funcao"] == {"tipo": "campo", "point": "campo4"}, "9: grupo aberto mantém a função antiga: %r" % g)
    time.sleep(3.6)
    ftp_envia("samuel", [("S2.JPG", jpeg(cor()))])
    g = g_de("samuel")
    ok(g and g["n"] == 1 and g["funcao"] == {"tipo": "volante", "modo": "chute"}, "9: grupo novo com a função nova: %r" % g)
    # 12: segurança
    ok(req("GET", "/fila-fotografo", headers={"Host": "evil:%d" % PORTA})[0] == 403, "12: Host evil")
    ok(req("GET", "/fila-fotografo", headers={"Origin": "https://evil.example"})[0] == 403, "12: Origin evil")
    ok(req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {}})[0] == 403, "12: POST sem X-Eterna")
    ok(req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {}}, {"X-Eterna": "1", "Origin": "https://evil.example"})[0] == 403, "12: POST de outra origem")
    ok(req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {"carlos": {"tipo": "campo", "point": "../x"}}}, H1)[0] == 400, "12: point ../x")
    ok(req("POST", "/fila-fotografo/funcao", {"dia": hoje, "map": {"intruso": {"tipo": "folga"}}}, H1)[0] == 400, "12: chave não cadastrada")
    ok(req("POST", "/fila-fotografo/funcao", b'{"dia":"' + hoje.encode() + b'","map":{},"x":"' + b"a" * 5120 + b'"}', H1)[0] == 413, "12: corpo de 5 KB")
    # 13: pelo endereço de ETERNA_ORIGENS, de outro IP
    hostr = "eterna-tv.local:%d" % PORTA
    s, j, _ = req("GET", "/fila-fotografo", headers={"Host": hostr, "Origin": ORIG}, origem="127.0.0.2")
    ok(s == 200 and j and j["ok"], "13: GET pelo endereço da rede, de outro IP: %r" % s)
    ok(req("GET", "/fila-fotografo", origem="127.0.0.2")[0] == 403, "13: outro IP com o Host local não é posto")
    pid = (g_de("samuel") or {"pids": ["x"]})["pids"][0]
    ok(req("GET", "/thumb/" + pid, headers={"Host": hostr}, origem="127.0.0.2")[0] == 200, "risco 4: miniatura pelo endereço de ETERNA_ORIGENS")
    ok(req("GET", "/file/" + pid, headers={"Host": hostr}, origem="127.0.0.2")[0] == 403, "risco 4: o original continua fechado pelo endereço da rede")
    ok(req("GET", "/thumb/" + pid, headers={"Host": hostr, "Origin": "https://evil.example"}, origem="127.0.0.2")[0] == 403, "risco 4: miniatura com Origin de fora")
    # contrato: sem série completa, sem nome de arquivo
    txt = json.dumps(fila())
    ok("100000001111" not in txt and ".JPG" not in txt and "C0" not in txt, "contrato: sem série completa nem nome de arquivo")
    # 10: reiniciar
    antes = sorted((g["id"], g["fotografo"], g["n"]) for g in fila())
    A.terminate(); A.wait(10)
    A = subir(); procs.append(A)
    depois = sorted((g["id"], g["fotografo"], g["n"]) for g in fila())
    ok(antes == depois and sum(x[2] for x in depois) == 3 + 9 + 4 + 3, "10: depois de reiniciar, os mesmos grupos e n: %r %r" % (antes, depois))
    ok(g_de("samuel")["funcao"] == {"tipo": "volante", "modo": "chute"}, "10: a função do dia volta do funcao.json")
finally:
    for p in procs:
        try:
            p.kill()
        except Exception:
            pass
print(json.dumps({"ok": not falhas, "falhas": falhas}))
