# v93 (testador, reteste): agente DE VERDADE em outro processo, recorte falso só por m.REC_FALSO_SEG (testes/_cliques_ia_lanca.py).
# Parte A (critério 11): descarga de cartão longa (30 sessões, 60 bases na trilha atrasada) com bases ao vivo chegando no meio
#   e o Checkout pedindo recortes o tempo todo: a ao vivo passa na frente das atrasadas ainda não pegas, o Checkout segue em
#   primeiro e sem fila_cheia, e a trilha atrasada termina (sem fome).
# Parte B (critério 17): limpeza dos recortes com teto 0 (ETERNA_RECORTES_GB=0) e recortes "velhos" (mtime de 3 dias):
#   bases de sessão aberta (2ª foto chegando antes da 1ª) e fechada ficam; fotos comuns saem; depois do reinício as bases
#   da sessão que estava aberta continuam guardadas; a LGPD ainda apaga.
# Roda sozinho (testes/rodar.sh):  python3 -I testes/cliques_ia_fila_limpeza_agente.py agente/eterna-agente.py
# Só imagens lisas geradas aqui (nunca foto de convidado).
import ftplib, http.client, io, json, os, shutil, signal, socket, subprocess, sys, tempfile, threading, time
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


CTX = {}


def novo_env(pausa, extra=None):
    hb = tempfile.mkdtemp(prefix="eterna-v93-fl-")
    e = {**os.environ, "HOME": hb, "USERPROFILE": hb, "ETERNA_PORTA": str(porta_livre()), "ETERNA_FTP_PORTA": str(porta_livre()),
         "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": str(pausa), "ETERNA_LEITORES": "1",
         "USER": "eterna93f%d" % os.getpid(), "PYTHONUNBUFFERED": "1", **(extra or {})}
    for k in ("ETERNA_PASTA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS", "ETERNA_PRE_RECORTE", "ETERNA_RECORTE_CONC"):
        e.pop(k, None)
    if extra and "ETERNA_RECORTES_GB" in extra:
        e["ETERNA_RECORTES_GB"] = extra["ETERNA_RECORTES_GB"]
    else:
        e.pop("ETERNA_RECORTES_GB", None)
    CTX.update(env=e, HB=hb, PORTA=int(e["ETERNA_PORTA"]), FTPP=int(e["ETERNA_FTP_PORTA"]), REC=os.path.join(hb, "Eterna", "recortes"))
    return e


def req(method, path, body=None, headers=None, porta=None, timeout=60):
    porta = porta or CTX["PORTA"]
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


def subir(nome, rec_seg):
    e = CTX["env"]
    p = subprocess.Popen([sys.executable, "-I", "-u", LANCA, AG, str(rec_seg)], env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    LOG[nome] = []
    threading.Thread(target=lambda: [LOG[nome].append(l.decode(errors="replace")) for l in iter(p.stdout.readline, b"")], daemon=True).start()
    for _ in range(120):
        time.sleep(0.25)
        if req("GET", "/status", timeout=3)[0] == 200:
            return p
    p.kill()
    raise SystemExit("agente não subiu: " + "".join(LOG[nome])[-600:])


def parar(p):
    p.send_signal(signal.SIGTERM)
    try:
        p.wait(10)
    except subprocess.TimeoutExpired:
        p.kill(); p.wait(5)


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
SERIE = {"carlos": "93100001", "yago": "93100002", "sandessa": "93100008", "marcio": "93100005", "dudu": "93100007"}
_n = [0]


def envia(user, caps):
    nomes = []
    f = ftplib.FTP()
    f.connect("127.0.0.1", CTX["FTPP"], timeout=15)
    f.login(user, SENHAS[user])
    for cap in caps:
        _n[0] += 1
        nome = "F93_%05d.JPG" % _n[0]
        f.storbinary("STOR " + nome, io.BytesIO(jpeg(cap, SERIE[user])))
        nomes.append(nome)
    f.quit()
    for _ in range(60):
        s, j, _ = req("GET", "/biblioteca")
        m = {x["name"]: x["id"] for x in (j or {}).get("fotos", [])}
        if all(n in m for n in nomes):
            return [m[n] for n in nomes]
        time.sleep(0.1)
    raise RuntimeError("fotos não chegaram à biblioteca: %r" % nomes)


def sessoes():
    return (req("GET", "/sessoes")[1] or {}).get("sessoes") or []


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
    return os.path.join(CTX["REC"], pid + ("_2400" if lado == 2400 else "") + ".png")


def pronto(pid):
    return os.path.exists(rec(pid)) and os.path.exists(rec(pid, 2400))


def t_pronto(pid):
    try:
        return max(os.path.getmtime(rec(pid)), os.path.getmtime(rec(pid, 2400)))
    except OSError:
        return None


def fechada(pid, seg=20):
    return espera(lambda: (lambda x: x if x and x["status"] == "fechada" else None)(sessao_de(pid)), seg)


def funcao(mp):
    s, j, _ = req("POST", "/fila-fotografo/funcao", {"dia": time.strftime("%Y-%m-%d"), "map": mp}, {"X-Eterna": "1"})
    ok(s == 200, "função do dia: %r %r" % (s, j))


def status_rec():
    return (req("GET", "/status")[1] or {}).get("recorte") or {}


MAPA = {"carlos": {"tipo": "campo", "point": "campo2"}, "yago": {"tipo": "campo", "point": "campo3"},
        "sandessa": {"tipo": "campo", "point": "terminal"}, "marcio": {"tipo": "campo", "point": "campo4"},
        "dudu": {"tipo": "volante", "modo": "chute"}}
procs = []
CARTAO = None
try:
    # ======================= A: descarga longa + ao vivo no meio + Checkout =======================
    REC_SEG = 0.6
    novo_env(6)
    CARTAO = os.path.join("/media", CTX["env"]["USER"], "marcio")
    A = subir("a", REC_SEG)
    procs.append(A)
    SENHAS.update(json.load(open(os.path.join(CTX["HB"], "Eterna", "ftp.json")))["users"])
    funcao(MAPA)
    normais = envia("dudu", [time.time() - 80 + i * 0.5 for i in range(80)])     # volante: nada recortado na chegada
    time.sleep(7)
    try:
        assert sys.platform.startswith("linux")
        os.makedirs(os.path.join(CARTAO, "DCIM", "100TESTE"), exist_ok=True)
        tem_cartao = True
    except Exception:
        tem_cartao = False
        notas["A"] = "pulado: sem /media gravável (só no Linux)"
    if tem_cartao:
        tc = time.time()
        nomes = []
        for k in range(30):                          # 30 sessões de 3 fotos, cliques de ~60 min atrás, 30 s entre sessões
            for i in range(3):
                _n[0] += 1
                nm = "D93_%05d.JPG" % _n[0]
                fp = os.path.join(CARTAO, "DCIM", "100TESTE", nm)
                open(fp, "wb").write(jpeg(tc - 3600 + k * 30 + i, SERIE["marcio"]))
                os.utime(fp, (tc - 60, tc - 60))
                nomes.append(nm)

        def lib_nomes():
            return {x["name"]: x["id"] for x in (req("GET", "/biblioteca")[1] or {}).get("fotos", [])}

        # Checkout em segundo plano: um pedido a cada ~1,2 s durante toda a descarga
        ck_res, parar_ck = [], threading.Event()

        def checkout():
            i = 0
            while not parar_ck.is_set() and i < len(normais):
                t0 = time.time()
                s, j, _ = req("POST", "/recorte", {"pid": normais[i], "lado": 2400})
                ck_res.append((normais[i], s, (j or {}).get("error") or (j or {}).get("erro"), round(time.time() - t0, 2)))
                i += 1
                parar_ck.wait(1.2)
        thc = threading.Thread(target=checkout, daemon=True)
        ok(espera(lambda: len([n for n in nomes if n in lib_nomes()]) >= 12, 30), "A: o cartão começou a ser lido")
        thc.start()
        # ao vivo no meio: uma sessão de 3 fotos a cada ~3 s, girando entre 3 fotógrafos (cada um a cada ~9 s > pausa de 6 s)
        vivos = []                                   # (pids, t_envio)
        quem = ["carlos", "yago", "sandessa"]
        t_vivo0 = time.time()
        for r in range(12):
            t0 = time.time()
            ps = envia(quem[r % 3], [t0 - 1.5, t0 - 1.0, t0 - 0.5])
            vivos.append((ps, t0))
            time.sleep(max(0, 3.0 - (time.time() - t0)))
        t_vivo1 = time.time()
        ok(espera(lambda: all(n in lib_nomes() for n in nomes), 90), "A: o cartão foi lido inteiro")
        m = lib_nomes()
        pids = [m.get(n) for n in nomes]
        bases_at = [p for k in range(30) for p in pids[k * 3:k * 3 + 2] if p]
        comuns_at = [pids[k * 3 + 2] for k in range(30) if pids[k * 3 + 2]]
        x0 = sessao_de(bases_at[0])
        ok(x0 and x0.get("atrasada") is True, "A: o cartão vai para a trilha atrasada: %r" % (x0 and x0.get("trilha")))
        bases_vv = [p for ps, _ in vivos for p in ps[:2]]
        ok(espera(lambda: all(pronto(p) for p in bases_vv), 30), "A: todas as bases ao vivo ficam prontas: faltam %r" % [p for p in bases_vv if not pronto(p)])
        t_fim = espera(lambda: all(pronto(p) for p in bases_at) and time.time(), 180)
        ok(t_fim, "A (sem fome): a trilha atrasada termina: faltam %d de %d" % (sum(1 for p in bases_at if not pronto(p)), len(bases_at)))
        parar_ck.set()
        thc.join(30)
        # ordem: para cada base ao vivo que chegou com atrasadas ainda esperando, quantas atrasadas terminaram entre o
        # envio dela e o recorte dela (a que já estava sendo recortada + no máximo uma na janela do laço de 0,5 s)
        tat = {p: t_pronto(p) for p in bases_at}
        ultrapass, latencias, com_backlog = [], [], 0
        for ps, t0 in vivos:
            tv = max(t_pronto(p) or 1e18 for p in ps[:2])
            backlog = sum(1 for p in bases_at if (tat[p] or 1e18) > t0)
            if backlog < 3:
                continue
            com_backlog += 1
            ultrapass.append(sum(1 for p in bases_at if tat[p] and t0 < tat[p] < tv))
            latencias.append(round(tv - t0, 2))
        notas["A_vivos_com_atrasadas_esperando"] = com_backlog
        notas["A_atrasadas_que_passaram_na_frente"] = ultrapass
        notas["A_latencia_vivo_s"] = latencias
        ok(com_backlog >= 6, "A: o cenário teve ao vivo chegando com a trilha atrasada cheia (%d de %d)" % (com_backlog, len(vivos)))
        ok(ultrapass and max(ultrapass) <= 2, "A (critério 11): a ao vivo passa na frente das atrasadas ainda não pegas; atrasadas terminadas no meio: %r" % ultrapass)
        ok(latencias and max(latencias) <= 2 * 2 * REC_SEG + 2 * REC_SEG + 2.0,
           "A: a base ao vivo sai rápido mesmo com a descarga e o Checkout (latências %r s)" % latencias)
        # sem fome: a trilha atrasada anda também enquanto chegam as ao vivo
        no_meio = sum(1 for p in bases_at if tat[p] and t_vivo0 < tat[p] < t_vivo1)
        notas["A_atrasadas_feitas_durante_ao_vivo"] = no_meio
        notas["A_fim_atrasada_s"] = round(t_fim - t_vivo0, 1) if t_fim else None
        ok(no_meio >= 8, "A (sem fome): a trilha atrasada continua andando enquanto chegam ao vivo (%d feitas em %.0f s)" % (no_meio, t_vivo1 - t_vivo0))
        # Checkout
        cheia = [r for r in ck_res if r[2] == "fila_cheia" or r[1] != 200]
        lat = sorted(r[3] for r in ck_res)
        notas["A_checkout_n"] = len(ck_res)
        notas["A_checkout_max_s"] = lat[-1] if lat else None
        ok(len(ck_res) >= 15 and not cheia, "A: Checkout sem fila_cheia nem erro durante a descarga: %r" % cheia[:5])
        ok(lat and lat[-1] <= 2 * REC_SEG + 1.5, "A: Checkout em primeiro (no máximo o trabalho em andamento + o dele): %r" % lat[-5:])
        ok(not any(pronto(p) for p in comuns_at), "A: as fotos comuns do cartão não são recortadas")
        # regra no fechamento
        xs = [fechada(ps[0], 20) for ps, _ in vivos[:3]]
        ok(all(x and x["ia"] == ps[:2] for x, (ps, _) in zip(xs, vivos[:3])), "A: ia das sessões ao vivo: %r" % [x and x.get("ia") for x in xs])
        shutil.rmtree(os.path.dirname(CARTAO), ignore_errors=True)
    parar(A)
    procs.remove(A)

    # ======================= B: limpeza com teto 0 e recortes velhos =======================
    REC_SEG = 0.2
    novo_env(8, {"ETERNA_RECORTES_GB": "0"})
    O = {"Origin": "http://127.0.0.1:%d" % CTX["PORTA"]}
    B = subir("b", REC_SEG)
    procs.append(B)
    SENHAS.clear()
    SENHAS.update(json.load(open(os.path.join(CTX["HB"], "Eterna", "ftp.json")))["users"])
    funcao(MAPA)
    # sessão que vai fechar (yago) e sessão que fica aberta (carlos, a 2ª foto chega antes da 1ª)
    fy = envia("yago", [time.time() - 3, time.time() - 2, time.time() - 1, time.time() - 0.5])
    t = time.time()
    pb = envia("carlos", [t - 3])[0]
    time.sleep(0.3)
    pa = envia("carlos", [t - 5])[0]
    pc = envia("carlos", [t - 1])[0]
    aberta = [pa, pb]
    comuns = envia("dudu", [time.time() - 3, time.time() - 2])
    for p in comuns + [pc, fy[3]]:                   # comuns recortadas pelo Checkout (inclusive a 3ª da aberta e a 4ª da fechada)
        req("POST", "/recorte", {"pid": p, "lado": 2400})
    ok(espera(lambda: all(pronto(p) for p in aberta + fy[:2] + comuns + [pc, fy[3]]), 15), "B: recortes feitos antes da limpeza")
    for i in range(8):                               # mantém a de carlos aberta enquanto a de yago fecha (pausa 8 s)
        if sessao_de(fy[0])["status"] == "fechada":
            break
        pc2 = envia("carlos", [time.time() - 0.5])
        time.sleep(2)
    xy = fechada(fy[0], 5)
    xc = sessao_de(pa)
    ok(xy and xy["ia"] == fy[:2], "B: a sessão de yago fechou com ia: %r" % (xy and xy.get("ia")))
    ok(xc and xc["status"] == "aberta" and xc["fotos"][:2] == [pa, pb], "B: a de carlos segue aberta: %r" % ((xc and (xc["status"], xc["fotos"][:2], [pa, pb])),))
    velho = time.time() - 3 * 86400                  # tudo "velho" (passa do REC_DIAS) e teto 0: só a guarda segura
    for n in os.listdir(CTX["REC"]):
        os.utime(os.path.join(CTX["REC"], n), (velho, velho))
    tok = "Fl93ab3dEf6hIj9lMn0pQr"
    man = {"token": tok, "tipo": "sessao", "sessoes": [xy["card"]], "expira": "2099-01-01T00:00:00Z", "precos": {"dig": 39, "todas": 250},
           "fotos": [{"id": "ag_" + fy[2], "sessao": xy["card"], "direito": "venda"}]}
    s, j, _ = req("POST", "/galerias/publicar", {"manifesto": man}, O)   # acorda o galeria_loop: a 1ª limpeza do processo roda já
    ok(s == 200, "B: publicar galeria: %r %r" % (s, j))
    ok(espera(lambda: not any(pronto(p) or os.path.exists(rec(p, 2400)) for p in comuns + [pc, fy[3]]), 20),
       "B: as fotos comuns saem na limpeza (teto 0): sobram %r" % [p for p in comuns + [pc, fy[3]] if os.path.exists(rec(p, 2400))])
    xc = sessao_de(pa)
    ok(xc and xc["status"] == "aberta", "B: a limpeza rodou com a sessão de carlos ainda aberta: %r" % (xc and xc["status"]))
    ok(all(pronto(p) for p in aberta), "B (critério 17): bases da sessão ABERTA ficam (teto 0, 3 dias): %r" % {p: pronto(p) for p in aberta})
    ok(all(pronto(p) for p in fy[:2]), "B (critério 17): bases da sessão FECHADA ficam: %r" % {p: pronto(p) for p in fy[:2]})
    # reinício com a sessão de carlos aberta
    parar(B)
    procs.remove(B)
    B = subir("b2", REC_SEG)
    procs.append(B)
    xc = sessao_de(pa)
    ok(xc and xc["status"] == "fechada" and xc["fechada_por"] == "reinicio" and xc["ia"] == aberta,
       "B: depois do reinício a sessão de carlos fecha com ia = os 2 primeiros cliques: %r" % (xc and {k: xc.get(k) for k in ("status", "fechada_por", "ia")}))
    n3 = envia("dudu", [time.time() - 1])[0]
    req("POST", "/recorte", {"pid": n3, "lado": 2400})
    nova = envia("carlos", [time.time() - 3, time.time() - 2, time.time() - 1])      # nova sessão aberta depois do reinício
    ok(espera(lambda: pronto(n3) and all(pronto(p) for p in nova[:2]), 15), "B: recortes depois do reinício")
    for n in os.listdir(CTX["REC"]):
        os.utime(os.path.join(CTX["REC"], n), (velho, velho))
    s, j, _ = req("POST", "/galerias/publicar", {"manifesto": man}, O)
    ok(espera(lambda: not os.path.exists(rec(n3, 2400)) and not os.path.exists(rec(n3)), 20), "B: depois do reinício a limpeza roda e tira a foto comum")
    ok(sessao_de(nova[0])["status"] == "aberta", "B: a sessão nova seguia aberta na limpeza")
    ok(all(pronto(p) for p in aberta), "B: depois do reinício as bases da sessão que estava aberta continuam guardadas: %r" % {p: pronto(p) for p in aberta})
    ok(all(pronto(p) for p in fy[:2]), "B: depois do reinício as bases da fechada continuam guardadas")
    ok(all(pronto(p) for p in nova[:2]), "B: bases da sessão aberta depois do reinício guardadas: %r" % {p: pronto(p) for p in nova[:2]})
    # LGPD ainda apaga a base guardada
    s, j, _ = req("POST", "/lgpd/excluir", {"pids": [pa, nova[0]], "quem": "teste", "posto": "Caixa 1"}, O)
    ok(s == 200, "B: /lgpd/excluir: %r %r" % (s, j))
    ok(not any(os.path.exists(rec(p, l)) for p in (pa, nova[0]) for l in (2400, 3000)), "B: a LGPD apaga o recorte da base guardada (fechada e aberta)")
    ok(pronto(pb) and pronto(nova[1]), "B: as outras bases ficam")
    notas["B_console_limpeza"] = [l.strip()[:120] for l in LOG["b"] + LOG["b2"] if "recortes" in l and "erro" in l]
    ok(not notas["B_console_limpeza"], "B: sem erro na limpeza: %r" % notas["B_console_limpeza"])
except SystemExit as ex:
    falhas.append(str(ex)[:600])
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-900:])
finally:
    if CARTAO:
        shutil.rmtree(os.path.dirname(CARTAO), ignore_errors=True)
    for p in procs:
        try:
            p.terminate(); p.wait(8)
        except Exception:
            p.kill()

print(json.dumps({"ok": not falhas, "falhas": falhas, "notas": notas}, ensure_ascii=False))
print(("OK cliques_ia_fila_limpeza_agente: descarga longa com ao vivo no meio (critério 11) e limpeza com sessão aberta, fechada e reinício (critério 17) · "
       + json.dumps(notas)) if not falhas else "FALHA cliques_ia_fila_limpeza_agente: " + " | ".join(falhas))
sys.exit(0 if not falhas else 1)
