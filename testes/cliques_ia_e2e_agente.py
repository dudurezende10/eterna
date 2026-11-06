# v93 (testador): os cliques de IA com o agente DE VERDADE em outro processo (HTTP, FTP embutido, threads de sessão e de
# recorte), recorte falso só por m.REC_FALSO_SEG (testes/_cliques_ia_lanca.py). Complementa testes/cliques_ia_agente.py,
# que importa o módulo e chama as funções direto. Critérios do plano docs/planos/2026-11-06-dois-cliques-ia.md:
# 1, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, navegador antigo (ia_vendidas) e a variável ETERNA_RECORTE_FALSO ignorada.
# Roda sozinho (testes/rodar.sh):  python3 -I testes/cliques_ia_e2e_agente.py agente/eterna-agente.py
# Só imagens lisas geradas aqui (nunca foto de convidado).
import ftplib, http.client, io, json, os, signal, socket, subprocess, sys, tempfile, threading, time
from PIL import Image

AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py"))
LANCA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_cliques_ia_lanca.py")
falhas, notas = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def porta_livre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


PORTA = porta_livre()
FTPP = porta_livre()
HB = tempfile.mkdtemp(prefix="eterna-v93-e2e-")
REC_SEG = 0.5
env = {**os.environ, "HOME": HB, "USERPROFILE": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP),
       "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": "6", "ETERNA_LEITORES": "1",
       "USER": "eterna93c%d" % os.getpid(), "PYTHONUNBUFFERED": "1"}
for k in ("ETERNA_PASTA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS", "ETERNA_PRE_RECORTE"):
    env.pop(k, None)
REC = os.path.join(HB, "Eterna", "recortes")
CARTAO = os.path.join("/media", env["USER"], "marcio")   # cartão de verdade (o vigia procura em /media/<USER>/*/DCIM)


def req(method, path, body=None, headers=None, porta=None, timeout=60):
    porta = porta or PORTA
    h = {"Host": "127.0.0.1:%d" % porta, **(headers or {})}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=timeout)
    try:
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        b = r.read()
        try:
            j = json.loads(b)
        except Exception:
            j = None
        return r.status, j, b
    except Exception as ex:
        return 0, {"erro": str(ex)}, b""
    finally:
        c.close()


LOG = {}


def subir(nome, args, e):
    p = subprocess.Popen(args, env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    LOG[nome] = []
    threading.Thread(target=lambda: [LOG[nome].append(l.decode(errors="replace")) for l in iter(p.stdout.readline, b"")], daemon=True).start()
    porta = int(e["ETERNA_PORTA"])
    for _ in range(120):
        time.sleep(0.25)
        if req("GET", "/status", porta=porta, timeout=3)[0] == 200:
            return p
    p.kill()
    raise SystemExit("agente não subiu: " + "".join(LOG[nome])[-600:])


_cor = [0]


def jpeg(cap, serie):
    _cor[0] += 1
    c = _cor[0]
    im = Image.new("RGB", (320, 240), (c * 37 % 256, c * 91 % 256, (c * 53 + 40) % 256))
    ex = Image.Exif()
    sub = ex.get_ifd(0x8769)
    sub[0x9003] = time.strftime("%Y:%m:%d %H:%M:%S", time.localtime(cap))
    sub[0xA431] = serie
    b = io.BytesIO()
    im.save(b, "JPEG", quality=80, exif=ex.tobytes())
    return b.getvalue()


SENHAS = {}
SERIE = {"carlos": "93000001", "yago": "93000002", "samuel": "93000003", "marinara": "93000004", "marcio": "93000005",
         "klassius": "93000006", "dudu": "93000007", "sandessa": "93000008"}
_n = [0]


def envia(user, caps):
    """Manda as fotos pelo FTP (uma conexão, na ordem dada) e devolve os pids na mesma ordem."""
    nomes = []
    f = ftplib.FTP()
    f.connect("127.0.0.1", FTPP, timeout=15)
    f.login(user, SENHAS[user])
    for cap in caps:
        _n[0] += 1
        nome = "T93_%05d.JPG" % _n[0]
        f.storbinary("STOR " + nome, io.BytesIO(jpeg(cap, SERIE[user])))
        nomes.append(nome)
    f.quit()
    for _ in range(40):
        s, j, _ = req("GET", "/biblioteca")
        m = {x["name"]: x["id"] for x in (j or {}).get("fotos", [])}
        if all(n in m for n in nomes):
            return [m[n] for n in nomes]
        time.sleep(0.1)
    raise RuntimeError("fotos não chegaram à biblioteca: %r" % nomes)


def sessoes():
    s, j, _ = req("GET", "/sessoes")
    return (j or {}).get("sessoes") or []


def sessao_de(pid):
    for x in sessoes():
        if pid in (x.get("fotos") or []) + (x.get("pend") or []):
            return x
    return None


def espera(fn, seg):
    t0 = time.time()
    while time.time() - t0 < seg:
        v = fn()
        if v:
            return v
        time.sleep(0.1)
    return fn()


def rec(pid, lado=3000):
    return os.path.join(REC, pid + ("_2400" if lado == 2400 else "") + ".png")


def fechada(pid, seg=20):
    return espera(lambda: (lambda x: x if x and x["status"] == "fechada" else None)(sessao_de(pid)), seg)


def funcao(mp):
    s, j, _ = req("POST", "/fila-fotografo/funcao", {"dia": time.strftime("%Y-%m-%d"), "map": mp}, {"X-Eterna": "1"})
    ok(s == 200, "função do dia: %r %r" % (s, j))


def status_rec():
    return (req("GET", "/status")[1] or {}).get("recorte") or {}


procs = []
try:
    # ---------- S2: ETERNA_RECORTE_FALSO no ambiente é ignorada (agente normal, sem modelos no HOME) ----------
    H0 = tempfile.mkdtemp(prefix="eterna-v93-s2-")
    P0 = porta_livre()
    e0 = {**env, "HOME": H0, "USERPROFILE": H0, "ETERNA_PORTA": str(P0), "ETERNA_FTP_PORTA": str(porta_livre()), "ETERNA_RECORTE_FALSO": "1"}
    p0 = subir("s2", [sys.executable, "-I", "-u", AG], e0)
    procs.append(p0)
    r0 = (req("GET", "/status", porta=P0)[1] or {}).get("recorte") or {}
    time.sleep(0.6)
    ok(r0.get("ok") is False and "falso" not in r0, "S2: ETERNA_RECORTE_FALSO=1 não liga o recorte falso: %r" % r0)
    ok(any("ETERNA_RECORTE_FALSO ignorado" in l for l in LOG["s2"]), "S2: o console avisa que a variável foi ignorada")
    os.makedirs(os.path.join(H0, "Eterna", "inbox"), exist_ok=True)
    s, j, _ = req("POST", "/recorte", {"pid": "abcdef123456"}, porta=P0)
    ok(s in (404, 503), "S2: /recorte sem recorte de verdade não devolve imagem: %r" % s)
    p0.terminate(); p0.wait(10); procs.remove(p0)

    # ---------- agente com o recorte falso ----------
    A = subir("a", [sys.executable, "-I", "-u", LANCA, AG, str(REC_SEG)], env)
    procs.append(A)
    SENHAS.update(json.load(open(os.path.join(HB, "Eterna", "ftp.json")))["users"])
    st = status_rec()
    ok(st.get("ok") is True and st.get("falso") is True and isinstance(st.get("ia"), dict) and st["ia"].get("ligada") is True,
       "/status.recorte com a fila de IA: %r" % st)
    funcao({"carlos": {"tipo": "campo", "point": "campo2"}, "yago": {"tipo": "campo", "point": "campo3"},
            "samuel": {"tipo": "volante", "modo": "livre"}, "marinara": {"tipo": "campo", "point": "vestiario"},
            "marcio": {"tipo": "campo", "point": "campo4"}, "dudu": {"tipo": "volante", "modo": "chute"},
            "sandessa": {"tipo": "campo", "point": "terminal"}})
    # klassius sem função do dia

    # ---------- 1 e 5: 8 fotos no campo2; a 2ª (clique) chega ANTES da 1ª ----------
    t = time.time()
    pb = envia("carlos", [t - 3])[0]           # 2º clique, chega primeiro
    time.sleep(0.3)
    pa = envia("carlos", [t - 5])[0]           # 1º clique, chega depois
    t2a = time.time()                          # chegada da 2ª foto
    x = sessao_de(pa)
    ok(x and x["status"] == "aberta" and x.get("ia") == [] and x.get("ia_regra") is None, "contrato: aberta com ia [] e ia_regra None: %s" % repr(x and {k: x.get(k) for k in ("status", "ia", "ia_regra")}))
    resto = []
    feito_aberta = None
    for i in range(6):                         # mantém a sessão aberta (uma foto a cada ~1 s, pausa de 6 s)
        resto += envia("carlos", [time.time() - 1])
        if feito_aberta is None and all(os.path.exists(rec(p, l)) for p in (pa, pb) for l in (2400, 3000)):
            xa = sessao_de(pa)
            feito_aberta = (round(time.time() - t2a, 1), xa and xa["status"])
        time.sleep(0.8)
    if feito_aberta is None:
        espera(lambda: all(os.path.exists(rec(p, l)) for p in (pa, pb) for l in (2400, 3000)), 30)
        xa = sessao_de(pa)
        feito_aberta = (round(time.time() - t2a, 1), xa and xa["status"]) if all(os.path.exists(rec(p, l)) for p in (pa, pb) for l in (2400, 3000)) else None
    notas["c5_recorte_s"] = feito_aberta and feito_aberta[0]
    ok(feito_aberta and feito_aberta[0] <= 30 and feito_aberta[1] == "aberta",
       "5: recortes 3000 e 2400 das 2 bases com a sessão ainda aberta, em até 30 s: %r" % (feito_aberta,))
    ok(not any(os.path.exists(rec(p)) for p in resto), "5: as fotos normais não são recortadas na chegada")
    x1 = fechada(pa, 25)
    ok(x1 and x1["ia"] == [pa, pb] and x1["ia_regra"] == {"n": 2, "motivo": None} and x1["fotos"][:2] == [pa, pb] and len(x1["fotos"]) == 8,
       "1: ia = os 2 menores cliques corrigidos (a 2ª chegou antes): %s" % repr(x1 and (x1["ia"], x1["ia_regra"], x1["fotos"][:2], [pa, pb])))
    ok(x1 and all(p in x1["fotos"] for p in resto), "1: as outras 6 seguem na sessão")
    S1 = x1

    # ---------- 13: Fila do fotógrafo, grupo aberto com 1 foto ----------
    q1 = envia("sandessa", [time.time() - 1])[0]
    s, fj, _ = req("GET", "/fila-fotografo")
    g = [g for g in (fj or {}).get("grupos", []) if q1 in (g.get("pids") or []) or g.get("fotografo") == "sandessa"]
    ok(g and g[0]["ia"]["n"] == 2 and g[0]["ia"]["motivo"] is None and g[0]["ia"]["pids"] == [q1], "13: aberto com 1 foto: %s" % repr(g and g[0].get("ia")))
    ok(espera(lambda: [gg for gg in (req("GET", "/fila-fotografo")[1] or {}).get("grupos", []) if gg.get("fotografo") == "sandessa" and gg["ia"]["prontas"] == 1], 10),
       "13: prontas sobe para 1 com o recorte feito")
    q2 = envia("sandessa", [time.time() - 0.5])[0]
    ok(espera(lambda: [gg for gg in (req("GET", "/fila-fotografo")[1] or {}).get("grupos", []) if gg.get("fotografo") == "sandessa" and gg["ia"]["prontas"] == 2 and gg["ia"]["pids"] == [q1, q2]], 10),
       "13: 2 de 2 prontas: %r" % [gg.get("ia") for gg in (req("GET", "/fila-fotografo")[1] or {}).get("grupos", []) if gg.get("fotografo") == "sandessa"])

    # ---------- 8 e 9: volante, Vestiário, sem função do dia e poucas fotos ----------
    grupos = {}
    for quem in ("samuel", "marinara", "klassius"):
        grupos[quem] = envia(quem, [time.time() - 4 + i for i in range(4)])
    pou = envia("yago", [time.time() - 3, time.time() - 2])
    time.sleep(2.5)
    ok(not any(os.path.exists(rec(p)) for ps in grupos.values() for p in ps), "8: sem recorte de IA na chegada fora da regra")
    for quem, mot in (("samuel", "volante"), ("marinara", "ponto_fora"), ("klassius", "sem_funcao")):
        xx = fechada(grupos[quem][0], 25)
        ok(xx and xx["ia"] == [] and xx["ia_regra"] and xx["ia_regra"]["motivo"] == mot and xx["fotos"] == grupos[quem],
           "8: %s: %r" % (quem, xx and xx.get("ia_regra")))
    xp = fechada(pou[0], 25)
    ok(xp and xp["ia"] == [] and xp["ia_regra"] == {"n": 2, "motivo": "poucas_fotos"} and xp["fotos"] == pou, "9: poucas_fotos: %s" % repr(xp and xp.get("ia_regra")))
    s, fj, _ = req("GET", "/fila-fotografo")
    gm = {g["fotografo"]: g["ia"] for g in (fj or {}).get("grupos", []) if g.get("fotografo") in ("samuel", "marinara", "klassius")}
    ok(gm.get("samuel", {}).get("motivo") == "volante" and gm.get("klassius", {}).get("motivo") == "sem_funcao" and gm.get("marinara", {}).get("motivo") == "ponto_fora",
       "8: motivo no /fila-fotografo: %r" % gm)

    # ---------- 7: a mesma foto pedida pela IA e pelo Checkout ao mesmo tempo = um recorte ----------
    res = {}

    def ck(pid, chave):
        t0 = time.time()
        s, j, b = req("POST", "/recorte", {"pid": pid, "lado": 2400})
        res[chave] = (s, (j or {}).get("error") or (j or {}).get("erro"), round(time.time() - t0, 2), time.time())

    f0 = status_rec().get("feitos")
    p7 = envia("marcio", [time.time() - 1])[0]
    s7, j7, _ = req("POST", "/recorte", {"pid": p7, "lado": 3000})
    espera(lambda: os.path.exists(rec(p7, 2400)), 10)
    time.sleep(1.2)
    f1 = status_rec().get("feitos")
    ok(s7 == 200 and os.path.exists(rec(p7, 2400)) and f1 - f0 == 1, "7: um recorte só (feitos %r -> %r, status %r)" % (f0, f1, s7))
    fechada(p7, 20)
    envia("marcio", [time.time() - 2, time.time() - 1, time.time() - 0.5])   # série com desvio conhecido (chegada − clique)
    normais = envia("dudu", [time.time() - 40 + i * 0.5 for i in range(40)])   # volante: nada recortado na chegada
    time.sleep(7)

    # ---------- 6: descarga de cartão com 10 sessões (20 bases); o Checkout passa na frente e nunca recebe fila_cheia ----------
    try:                                         # o vigia de cartões do Linux procura em /media/<USER>/*/DCIM
        assert sys.platform.startswith("linux")
        os.makedirs(os.path.join(CARTAO, "DCIM", "100TESTE"), exist_ok=True)
        tem_cartao = True
    except Exception:
        tem_cartao = False
        notas["c6"] = "pulado: sem /media gravável (só no Linux)"
    if tem_cartao:
        tc = time.time()
        nomes6 = []
        for k in range(10):                         # 10 sessões de 3 fotos (clique de 50 a 45 min atrás, pausa de 30 s entre elas)
            for i in range(3):
                _n[0] += 1
                nm = "C93_%05d.JPG" % _n[0]
                fp = os.path.join(CARTAO, "DCIM", "100TESTE", nm)
                open(fp, "wb").write(jpeg(tc - 3000 + k * 30 + i, SERIE["marcio"]))
                os.utime(fp, (tc - 60, tc - 60))
                nomes6.append(nm)
        def lib_nomes():
            return {x["name"]: x["id"] for x in (req("GET", "/biblioteca")[1] or {}).get("fotos", [])}
        ok(espera(lambda: all(n in lib_nomes() for n in nomes6), 20), "6: o cartão foi lido")
        m6 = lib_nomes()
        pids6 = [m6.get(n) for n in nomes6]
        bases = [p for k in range(10) for p in pids6[k * 3:k * 3 + 2]]
        x6 = sessao_de(bases[0])
        ok(x6 and x6.get("atrasada") is True, "6: o cartão vai para a trilha atrasada: %s" % repr(x6 and (x6.get("trilha"), x6.get("fotos"))))
        prontas_antes = sum(1 for p in bases if os.path.exists(rec(p)))
        ck(normais[0], "primeiro")
        prontas_depois = sum(1 for p in bases if os.path.exists(rec(p)))
        notas["c6_checkout_s"] = res["primeiro"][2]
        notas["c6_bases_prontas_antes_depois"] = [prontas_antes, prontas_depois]
        ok(prontas_antes < 15, "6: havia bases pendentes quando o Checkout pediu (%d de 20 prontas)" % prontas_antes)
        ok(res["primeiro"][0] == 200 and res["primeiro"][2] <= 2 * REC_SEG + 1.5,
           "6: o Checkout é atendido na frente das bases (%r; prontas antes %d, depois %d de %d)" % (res["primeiro"], prontas_antes, prontas_depois, len(bases)))
        ok(prontas_depois - prontas_antes <= 2, "6: as bases não passaram na frente do Checkout: %d recortadas no meio" % (prontas_depois - prontas_antes))
        ths = [threading.Thread(target=ck, args=(p, "c%d" % i)) for i, p in enumerate(normais[1:25])]
        for th in ths:                               # 24 pedidos quase juntos (40 ms entre eles: o backlog de 5 conexões do
            th.start()                               # http.server, de antes da v93, derruba conexões que chegam no mesmo instante)
            time.sleep(0.04)
        [th.join(120) for th in ths]
        cheia = [k for k, v in res.items() if v[1] == "fila_cheia"]
        ok(not cheia and all(v[0] == 200 for v in res.values()), "6: 24 pedidos do Checkout com as bases na fila: nenhum fila_cheia: %r" % {k: v for k, v in res.items() if v[0] != 200})
        ok(espera(lambda: all(os.path.exists(rec(p, 2400)) for p in bases), 60), "6: as 20 bases ficam prontas depois: faltam %r de %r; sessões %r" % (
            [p for p in bases if not os.path.exists(rec(p, 2400))], len(bases), [(x["card"], x["status"], x["fotos"], x.get("ia")) for x in sessoes() if set(x["fotos"]) & set(bases)]))
        x6 = fechada(bases[0], 20)
        ok(x6 and x6["ia"] == bases[:2] and x6["ia_regra"] == {"n": 2, "motivo": None}, "11: a regra vale no cartão: %s" % repr(x6 and (x6["ia"], x6["ia_regra"])))
        import shutil
        shutil.rmtree(CARTAO, ignore_errors=True)

    # ---------- 11: trilha atrasada (clique de 25 min atrás) com o trabalhador ocupado; a ao vivo chega 1 s depois ----------
    time.sleep(3)
    ocupa = normais[25:35]                       # 10 pedidos do Checkout = trabalhador ocupado por ~5 s
    ths = [threading.Thread(target=ck, args=(p, "o%d" % i)) for i, p in enumerate(ocupa)]
    [th.start() for th in ths]
    time.sleep(0.3)
    at = envia("marcio", [time.time() - 1500, time.time() - 1499, time.time() - 1498])
    xat = sessao_de(at[0])
    ok(xat and xat.get("atrasada") is True, "11: clique de 25 min atrás vai para a trilha atrasada: %s" % repr(xat and xat.get("trilha")))
    time.sleep(1.0)
    vv = envia("carlos", [time.time() - 1, time.time() - 0.5, time.time() - 0.2])
    t_vivo = time.time()
    [th.join(60) for th in ths]
    ocupado = sum(1 for k, v in res.items() if k.startswith("o") and v[3] > t_vivo)
    espera(lambda: all(os.path.exists(rec(p)) for p in at[:2] + vv[:2]), 40)
    mt = {p: os.path.getmtime(rec(p)) for p in at[:2] + vv[:2] if os.path.exists(rec(p))}
    notas["c11_ordem"] = [("vivo" if p in vv else "atrasada") for p in sorted(mt, key=mt.get)]
    notas["c11_checkout_depois_do_vivo"] = ocupado
    ok(ocupado >= 2, "11: o trabalhador ainda estava ocupado quando a ao vivo chegou (%d pedidos do Checkout depois)" % ocupado)
    ok(len(mt) == 4 and max(mt[p] for p in vv[:2]) <= min(mt[p] for p in at[:2]),
       "11: com o recorte ocupado, a base ao vivo que chegou 1 s depois sai antes da atrasada (ordem: %r)" % notas["c11_ordem"])
    xat = fechada(at[0], 25)
    ok(xat and xat["ia"] == at[:2], "11: a regra vale na trilha atrasada: %s" % repr(xat and xat.get("ia")))

    # ---------- 12: Painel de controle pelo /ponto/docs ----------
    O = {"Origin": "http://127.0.0.1:%d" % PORTA}
    antes = fechada(vv[0], 20)
    s, j, _ = req("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "ia", "valor": {"ligada": True, "cliques": 1, "pontos": ["campo2", "campo3", "campo4", "terminal"], "volante": False, "por": "eduardo@eduardorezende.com", "em": "2026-11-06T13:00:00Z"}}]}, O)
    ok(s == 200 and j and j.get("gravados") == 1, "12: gravar 1 clique: %r %r" % (s, j))
    ok(espera(lambda: any("config/ia: de" in l and '"cliques": 1' in l for l in LOG["a"]), 3), "12: a mudança fica no console (de, para, por, host)")
    c12 = envia("carlos", [time.time() - 3, time.time() - 2, time.time() - 1, time.time() - 0.5])
    x12 = fechada(c12[0], 25)
    ok(x12 and x12["ia"] == c12[:1] and x12["ia_regra"] == {"n": 1, "motivo": None}, "12: 1 clique na próxima sessão: %s" % repr(x12 and (x12["ia"], x12["ia_regra"])))
    xa2 = [x for x in sessoes() if x["card"] == S1["card"]][0]
    ok(xa2["ia"] == S1["ia"] and antes and [x for x in sessoes() if x["card"] == antes["card"]][0]["ia"] == antes["ia"], "12: as sessões já fechadas não mudam")
    for ruim in ({"ligada": True, "cliques": 9}, {"ligada": "sim"}, {"pontos": ["../x"]}, {"cliques": 2.5}, "x", [], None):
        s, j, _ = req("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "ia", "valor": ruim}]}, O)
        ok(s == 200 and j and j.get("gravados") == 0, "12: config/ia inválido ou nulo recusado: %r -> %r" % (ruim, j))
    s, j, _ = req("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "ia", "valor": {"ligada": False, "cliques": 2, "pontos": [], "volante": False}}]},
                  {"Origin": "https://evil.example"})
    ok(s == 403, "12: /ponto/docs de outra origem: %r" % s)
    s, j, _ = req("GET", "/ponto/docs?col=config")
    doc = [d for d in ((j or {}).get("docs") or []) if d.get("id") == "ia"]
    ok(doc and (doc[0].get("valor") or {}).get("cliques") == 1, "12: o valor válido ficou: %r" % doc)
    req("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "ia", "valor": {"ligada": False, "cliques": 2, "pontos": ["campo2"], "volante": False}}]}, O)
    c12b = envia("carlos", [time.time() - 3, time.time() - 2, time.time() - 1])
    x12b = fechada(c12b[0], 25)
    ok(x12b and x12b["ia"] == [] and x12b["ia_regra"]["motivo"] == "desligada", "12: desligada: %s" % repr(x12b and x12b["ia_regra"]))
    req("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "ia", "valor": {"ligada": True, "cliques": 2, "pontos": ["terminal", "campo2", "campo3", "campo4"], "volante": False}}]}, O)
    time.sleep(3.2)

    # ---------- 18: manifesto da galeria com base de IA; navegador antigo vendendo a base ----------
    tok = "Tq93ab3dEf6hIj9lMn0pQr"
    man = {"token": tok, "tipo": "sessao", "sessoes": [S1["card"]], "expira": "2099-01-01T00:00:00Z", "precos": {"dig": 39, "todas": 250},
           "fotos": [{"id": "ag_" + S1["ia"][0], "sessao": S1["card"], "direito": "venda"}, {"id": "ag_" + S1["fotos"][3], "sessao": S1["card"], "direito": "venda"}]}
    s, j, _ = req("POST", "/galerias/publicar", {"manifesto": man}, O)
    ok(s == 200 and j and j.get("ignoradas") == 1, "18: a base sai do manifesto (ignoradas 1): %r %r" % (s, j))
    gal = os.path.join(HB, "Eterna", "galerias", tok, "sessao.json")
    try:
        gv = json.load(open(gal))
    except Exception:
        gv = {}
    ok([f["id"] for f in gv.get("fotos") or []] == ["ag_" + S1["fotos"][3]], "18: manifesto gravado sem a base: %r" % [f.get("id") for f in gv.get("fotos") or []])
    s, j, _ = req("POST", "/ponto/eventos", {"posto": "Caixa 1", "eventos": [{"tipo": "pagar", "idem": "idem-e2e-93", "venda": "venda-e2e-93", "seq": 1, "em": "2026-11-06T13:00:00Z",
                                                                             "dados": {"card": S1["card"], "selected": ["ag_" + S1["ia"][1], "ag_" + S1["fotos"][4]], "total": 70}}]}, O)
    ok(s == 200 and j and j["resultados"][0]["s"] == "ok" and any("base(s) de IA vendida(s)" in l for l in LOG["a"]),
       "navegador antigo: a venda com a base fica gravada e o console avisa: %r" % j)

    # ---------- 15: LGPD de uma base (pronta e com o recorte em andamento) ----------
    alvo = S1["ia"][0]
    ok(os.path.exists(rec(alvo)) and os.path.exists(rec(alvo, 2400)), "15: o recorte da base existe antes")
    s, j, _ = req("POST", "/lgpd/excluir", {"pids": [alvo], "quem": "teste", "posto": "Caixa 1"}, O)
    ok(s == 200, "15: /lgpd/excluir: %r %r" % (s, j))
    ok(not os.path.exists(rec(alvo)) and not os.path.exists(rec(alvo, 2400)), "15: os recortes saem na hora")
    xl = [x for x in sessoes() if x["card"] == S1["card"]][0]
    arq = json.load(open(os.path.join(HB, "Eterna", "ponto", "sessoes", xl["dia"] + ".json")))
    xd = [x for x in arq["sessoes"] if x["card"] == S1["card"]][0]
    ok(xl["ia"] == [S1["ia"][1]] and alvo not in xl["fotos"], "15: fora de ia em memória: %r" % xl["ia"])
    ok(espera(lambda: [x for x in json.load(open(os.path.join(HB, "Eterna", "ponto", "sessoes", xl["dia"] + ".json")))["sessoes"] if x["card"] == S1["card"]][0]["ia"] == [S1["ia"][1]], 8),
       "15: fora de ia no arquivo do dia: %r" % xd.get("ia"))
    # em andamento: a base entra, o trabalho é pego, e a LGPD chega no meio
    ocupa2 = envia("dudu", [time.time() - 10 + i for i in range(2)])
    ths = [threading.Thread(target=ck, args=(p, "l%d" % i)) for i, p in enumerate(ocupa2)]
    [th.start() for th in ths]
    time.sleep(0.2)
    lg = envia("carlos", [time.time() - 1, time.time() - 0.5])
    time.sleep(0.9)
    req("POST", "/lgpd/excluir", {"pids": lg, "quem": "teste"}, O)
    [th.join(30) for th in ths]
    time.sleep(3 * REC_SEG + 1.5)
    sobra = [n for n in os.listdir(REC) if n.startswith(lg[0]) or n.startswith(lg[1])]
    ok(not sobra, "15: LGPD com o trabalho em andamento ou na fila: nenhum arquivo fica: %r" % sobra)

    # ---------- 16: reinício com sessão aberta; o recorte antecipado refaz as bases que faltam ----------
    r16 = envia("yago", [time.time() - 3, time.time() - 2, time.time() - 1, time.time() - 0.5])
    espera(lambda: all(os.path.exists(rec(p, 2400)) for p in r16[:2]), 10)
    card16 = sessao_de(r16[0])["card"]
    ok(sessao_de(r16[0])["status"] == "aberta", "16: aberta antes do reinício")
    A.send_signal(signal.SIGTERM)
    try:
        A.wait(10)
    except subprocess.TimeoutExpired:
        A.kill(); A.wait(5)
    procs.remove(A)
    for p in r16[:2]:                          # as bases perderam o recorte (ex.: limpeza): o rec_pre_loop refaz
        for l in (2400, 3000):
            try:
                os.remove(rec(p, l))
            except OSError:
                pass
    A = subir("a2", [sys.executable, "-I", "-u", LANCA, AG, str(REC_SEG)], env)
    procs.append(A)
    x16 = [x for x in sessoes() if x["card"] == card16]
    x16 = x16 and x16[0]
    ok(x16 and x16["status"] == "fechada" and x16["fechada_por"] == "reinicio" and x16["ia"] == r16[:2] and x16["ia_regra"] == {"n": 2, "motivo": None},
       "16: fechou com reinicio e ia calculada: %s" % repr(x16 and {k: x16.get(k) for k in ("status", "fechada_por", "ia", "ia_regra")}))
    t16 = time.time()
    ok(espera(lambda: all(os.path.exists(rec(p)) for p in r16[:2]), 60), "16: o recorte antecipado recorta as bases que faltam (até 60 s)")
    notas["c16_pre_s"] = round(time.time() - t16, 1)
    x1b = [x for x in sessoes() if x["card"] == S1["card"]][0]
    ok(x1b["ia"] == [S1["ia"][1]], "16/15: a LGPD continua valendo depois do reinício: %r" % x1b["ia"])
    stb = status_rec().get("ia") or {}
    ok({"ligada", "fila", "feitos", "erros", "atraso_p50_s", "atraso_p90_s"} <= set(stb), "/status.recorte.ia: %r" % stb)
except SystemExit as ex:
    falhas.append(str(ex)[:600])
except Exception as ex:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-900:])
finally:
    import shutil
    shutil.rmtree(os.path.dirname(CARTAO), ignore_errors=True)
    for p in procs:
        try:
            p.terminate(); p.wait(8)
        except Exception:
            p.kill()

print(json.dumps({"ok": not falhas, "falhas": falhas, "notas": notas}, ensure_ascii=False))
print(("OK cliques_ia_e2e_agente: agente de verdade, critérios 1, 5 a 9, 11, 12, 13, 15, 16, 18 e S2 · " + json.dumps(notas)) if not falhas
      else "FALHA cliques_ia_e2e_agente: " + " | ".join(falhas))
sys.exit(0 if not falhas else 1)
