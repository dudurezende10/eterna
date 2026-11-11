# v96-ux: envio manual das fotos do cartão pela tela Minhas fotos, com o agente DE VERDADE em outro processo.
# Critérios 16 a 27 do plano docs/planos/2026-11-11-minhas-fotos-envio-manual.md (POST /fotos/enviar).
# Roda sozinho (testes/rodar.sh):  HOME=<temporário> python3 -I testes/envio_manual_agente.py agente/eterna-agente.py
# HOME temporário próprio, portas 45xxx, ETERNA_SEM_OPENCV=1. Só imagens lisas geradas aqui (nunca foto de cliente).
import http.client, io, json, os, random, re, secrets, shutil, socket, subprocess, sys, tempfile, threading, time
from urllib.parse import quote
from PIL import Image

AG = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py"))
LANCA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_envio_lanca.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def porta_45():
    for _ in range(200):
        p = random.randint(45000, 45999)
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            return p
        except OSError:
            continue
        finally:
            s.close()
    raise SystemExit("FALHA envio_manual_agente: sem porta livre em 45xxx")


def jpeg(cor=None, horas=2.0, lado=(320, 240)):
    """JPEG liso com ruído (nunca repetido) e EXIF de captura de `horas` atrás."""
    im = Image.new("RGB", lado, cor or tuple(random.randint(30, 220) for _ in range(3)))
    for k in range(40):
        r = os.urandom(4)
        im.putpixel((int.from_bytes(r[:2], "big") % lado[0], int.from_bytes(r[2:], "big") % lado[1]), (r[0], r[1], r[2]))
    ex = Image.Exif()
    ex.get_ifd(0x8769)[0x9003] = time.strftime("%Y:%m:%d %H:%M:%S", time.localtime(time.time() - horas * 3600))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=85, exif=ex.tobytes())
    return b.getvalue()


def png():
    b = io.BytesIO()
    Image.new("RGB", (40, 30), (200, 10, 10)).save(b, "PNG")
    return b.getvalue()


HB = tempfile.mkdtemp(prefix="eterna-envio-")
ET = os.path.join(HB, "Eterna")
LOG = {}


def ambiente(porta, ftpp, home, user):
    e = {**os.environ, "HOME": home, "USERPROFILE": home, "ETERNA_PORTA": str(porta), "ETERNA_FTP_PORTA": str(ftpp),
         "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": "6", "ETERNA_LEITORES": "1",
         "USER": user, "PYTHONUNBUFFERED": "1"}
    for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_REDE", "ETERNA_RECORTE_FALSO"):
        e.pop(k, None)
    return e


def subir(nome, porta, ftpp, home, user, piso):
    os.makedirs(os.path.join(home, "Eterna"), exist_ok=True)
    # login "equipe" compartilhado no FTP: não é fotógrafo (critério 22)
    usuarios = {u: secrets.token_hex(6) for u in ["carlos", "marinara", "samuel", "yago", "marcio", "klassius", "sandessa", "dudu", "equipe"]}
    with open(os.path.join(home, "Eterna", "ftp.json"), "w") as f:
        json.dump({"users": usuarios, "compartilhado": ["equipe"]}, f)
    os.chmod(os.path.join(home, "Eterna", "ftp.json"), 0o600)
    p = subprocess.Popen([sys.executable, "-I", "-u", LANCA, AG, str(piso)], env=ambiente(porta, ftpp, home, user),
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    LOG[nome] = []
    threading.Thread(target=lambda: [LOG[nome].append((time.time(), l.decode(errors="replace"))) for l in iter(p.stdout.readline, b"")],
                     daemon=True).start()
    for _ in range(160):
        time.sleep(0.25)
        if req("GET", "/status", porta=porta)[0] == 200:
            return p
    p.kill()
    raise SystemExit("FALHA envio_manual_agente: agente não subiu: " + "".join(x[1] for x in LOG[nome])[-600:])


def req(method, path, body=None, headers=None, porta=None, timeout=30):
    porta = porta or PORTA
    h = {"Host": "127.0.0.1:%d" % porta, **(headers or {})}
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=timeout)
    try:
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
            h.setdefault("Content-Type", "application/json")
        c.request(method, path, body=body, headers=h)
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


def enviar(dados, nome="IMG_0001.JPG", quem="carlos", porta=None, extra=None, sem=()):
    h = {"Content-Type": "image/jpeg", "X-Eterna": "1"}
    h.update(extra or {})
    for k in sem:
        h.pop(k, None)
    return req("POST", "/fotos/enviar?nome=%s&quem=%s" % (quote(nome, safe=""), quote(quem, safe="")), dados, h, porta=porta)


def arquivos(pasta):
    out = []
    for raiz, _, nomes in os.walk(pasta):
        out += [os.path.join(raiz, n) for n in nomes]
    return out


def tmp_vazio():
    return not [n for n in os.listdir(os.path.join(ET, "ftp-tmp")) if n.startswith("envio-")]


PORTA, FTPP = porta_45(), porta_45()
USER = "eterna-envio-%d" % os.getpid()
CARTAO = os.path.join("/media", USER, "samuel")
procs = []
try:
    procs.append(subir("a", PORTA, FTPP, HB, USER, 2))
    hoje = time.strftime("%Y-%m-%d")
    INB = os.path.join(ET, "inbox")
    st0 = req("GET", "/status")[1]
    ok(st0.get("envio") == {"v": 1, "max_mb": 60, "novas": 0, "repetidas": 0, "recusadas": 0}, "status.envio: %s" % st0.get("envio"))
    t_log0 = time.time()

    # 16: 6 JPEG com EXIF de 2 h atrás, quem=carlos
    fotos = [jpeg() for _ in range(6)]
    res = [enviar(b, "IMG_%04d.JPG" % (i + 1)) for i, b in enumerate(fotos)]
    ok(all(r[0] == 200 and r[1] == {"ok": True, "resultado": "new"} for r in res), "16: as 6 entram: %s" % [r[:2] for r in res])
    meta = json.load(open(os.path.join(ET, "meta.json")))
    novos = [p for p in arquivos(os.path.join(INB, hoje)) if re.search(r"_IMG_000[1-6]\.JPG$", p)]
    pids = [os.path.basename(p)[:12] for p in novos]
    ok(len(novos) == 6, "16: 6 arquivos em inbox/%s: %d" % (hoje, len(novos)))
    ok(all(meta.get(p, {}).get("s") == "cartao" and meta.get(p, {}).get("o") == "carlos" for p in pids),
       "16: meta s=cartao, o=carlos: %s" % [(meta.get(p, {}).get("s"), meta.get(p, {}).get("o")) for p in pids])
    ok(all(meta.get(p, {}).get("cap") for p in pids), "16: hora do clique lida do EXIF")
    ses = None
    for _ in range(40):
        ss = (req("GET", "/sessoes")[1] or {}).get("sessoes") or []
        ses = [x for x in ss if set(pids) & set((x.get("fotos") or []) + (x.get("pend") or []))]
        if ses:
            break
        time.sleep(0.25)
    ok(ses and all(x.get("fotografo") == "carlos" and x.get("trilha") == "atrasada" and x.get("atrasada") and x.get("dia") == hoje for x in ses),
       "16: sessão na trilha atrasada de hoje do Carlos: %s" % [(x.get("fotografo"), x.get("trilha"), x.get("dia")) for x in (ses or [])])
    ok(ses and sum(len((x.get("fotos") or []) + (x.get("pend") or [])) for x in ses) == 6, "16: as 6 fotos na sessão")
    ff = (req("GET", "/fila-fotografo")[1] or {}).get("grupos") or []
    ok(any(g.get("fotografo") == "carlos" and g.get("id") in {x["card"] for x in ses or []} for g in ff), "16: sessão na /fila-fotografo: %s" % ff)

    # 16 (comparação): o mesmo tipo de lote lido pelo leitor do cartão (scan_card) vai para a mesma trilha
    cart = [jpeg() for _ in range(3)]
    try:
        os.makedirs(os.path.join(CARTAO, "DCIM", "100CANON"), exist_ok=True)
        for i, b in enumerate(cart):
            fp = os.path.join(CARTAO, "DCIM", "100CANON", "CRD_%04d.JPG" % i)
            with open(fp, "wb") as f:
                f.write(b)
            os.utime(fp, (time.time() - 30, time.time() - 30))
        cartao_ok = True
    except OSError:
        cartao_ok = False
    if cartao_ok:
        cp = []
        for _ in range(60):
            cp = [os.path.basename(p)[:12] for p in arquivos(INB) if re.search(r"_CRD_\d{4}\.JPG$", p)]
            if len(cp) == 3:
                break
            time.sleep(0.25)
        ok(len(cp) == 3, "16: o leitor do cartão leu as 3 fotos: %d" % len(cp))
        time.sleep(0.5)
        meta = json.load(open(os.path.join(ET, "meta.json")))
        ss = (req("GET", "/sessoes")[1] or {}).get("sessoes") or []
        sc = [x for x in ss if set(cp) & set((x.get("fotos") or []) + (x.get("pend") or []))]
        ok(all(meta.get(p, {}).get("s") == "cartao" for p in cp) and sc and all(x.get("trilha") == "atrasada" and x.get("dia") == hoje for x in sc),
           "16: cartão lido pelo leitor na mesma trilha atrasada: %s" % [(x.get("fotografo"), x.get("trilha")) for x in sc])
        # 17: foto já lida pelo cartão, mandada pela tela, é repetida
        d0 = req("GET", "/status")[1]["dups"]
        r = enviar(cart[0], "CRD_0000.JPG", quem="samuel")
        ok(r[0] == 200 and r[1] == {"ok": True, "resultado": "dup"}, "17: foto do cartão mandada pela tela: %s" % (r[:2],))
        ok(req("GET", "/status")[1]["dups"] == d0 + 1, "17: /status.dups sobe com a do cartão")
    else:
        print("nota: /media sem escrita, comparação com o leitor do cartão não rodou")

    # 17: a mesma foto de novo
    d0 = req("GET", "/status")[1]["dups"]
    r = enviar(fotos[0], "IMG_0001.JPG")
    ok(r[0] == 200 and r[1] == {"ok": True, "resultado": "dup"}, "17: mesma foto de novo: %s" % (r[:2],))
    ok(req("GET", "/status")[1]["dups"] == d0 + 1, "17: /status.dups sobe")

    # 18: PNG com nome .jpg, texto qualquer, JPEG cortado
    antes = set(arquivos(INB))
    r1 = enviar(png(), "x.jpg")
    r2 = enviar(b"isto nao e uma foto, so texto" * 10, "y.jpg")
    cortado = jpeg()
    cortado = cortado[:len(cortado) // 2]
    r3 = enviar(cortado, "z.jpg")
    ok(r1[0] == 415 and r1[1] == {"erro": "nao_jpeg"}, "18: PNG com nome .jpg: %s" % (r1[:2],))
    ok(r2[0] == 415 and r2[1] == {"erro": "nao_jpeg"}, "18: texto: %s" % (r2[:2],))
    ok(r3[0] == 400 and r3[1] == {"erro": "incompleta"}, "18: JPEG cortado: %s" % (r3[:2],))
    ok(set(arquivos(INB)) == antes and tmp_vazio(), "18: nada ficou em inbox nem em ftp-tmp")
    r4 = enviar(jpeg(), "foto.png")
    ok(r4[0] == 415 and r4[1] == {"erro": "formato"}, "extensão fora do cartão: %s" % (r4[:2],))
    r5 = enviar(jpeg(), "foto.Jpg")
    ok(r5[0] == 415, ".Jpg não passa (igual ao scan_card): %s" % (r5[:2],))
    r6 = enviar(jpeg(), "a.jpg", extra={"Content-Type": "application/octet-stream"})
    ok(r6[0] == 415 and r6[1] == {"erro": "formato"}, "Content-Type que não é image/jpeg: %s" % (r6[:2],))

    # 19: nomes perigosos viram rótulo do servidor, sempre dentro de inbox/<dia>/
    perig = ["../../etc/passwd.jpg", "..\\x.JPG", "\x00a.jpg", "a" * 296 + ".jpg", "com espaço.jpg", "Bom_nome-1.jpeg"]
    antes = set(arquivos(INB))
    for nm in perig:
        r = enviar(jpeg(), nm)
        ok(r[0] == 200 and r[1] == {"ok": True, "resultado": "new"}, "19: %r: %s" % (nm[:30], r[:2]))
    novos = sorted(set(arquivos(INB)) - antes)
    ok(len(novos) == len(perig), "19: %d arquivos novos" % len(novos))
    dia_dir = os.path.realpath(os.path.join(INB, hoje))
    ok(all(os.path.dirname(os.path.realpath(p)) == dia_dir for p in novos), "19: tudo dentro de inbox/<dia>/: %s" % novos)
    rot = [os.path.basename(p)[13:] for p in novos]
    ok(sum(bool(re.match(r"^envio_\d{6}_[0-9a-f]{4}\.jpg$", x)) for x in rot) == 5 and "Bom_nome-1.jpeg" in rot, "19: rótulos: %s" % rot)
    ok(not [p for p in arquivos(HB) if "passwd" in p] and not os.path.exists(os.path.join(HB, "etc")), "19: nada fora da inbox")
    bib = req("GET", "/biblioteca")[1] or {}
    nomes_bib = json.dumps(bib)
    ok("passwd" not in nomes_bib and "com espa" not in nomes_bib, "19: /biblioteca só com o rótulo")

    # 20: Content-Length acima de 60 MB (sem ler o corpo, conexão fechada) e sem Content-Length
    s = socket.create_connection(("127.0.0.1", PORTA), timeout=10)
    s.sendall(("POST /fotos/enviar?nome=a.jpg&quem=carlos HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nContent-Type: image/jpeg\r\nX-Eterna: 1\r\n"
               "Content-Length: %d\r\n\r\n" % (PORTA, 60 * 1024 * 1024 + 1)).encode())
    t0 = time.time()
    resp = b""
    while True:
        ch = s.recv(65536)
        if not ch:
            break
        resp += ch
    s.close()
    ok(resp.startswith(b"HTTP/1.0 413") or resp.startswith(b"HTTP/1.1 413"), "20: 413 acima de 60 MB: %r" % resp[:40])
    ok(b'"tamanho"' in resp and time.time() - t0 < 5, "20: resposta na hora e conexão fechada (sem ler o corpo)")
    s = socket.create_connection(("127.0.0.1", PORTA), timeout=10)
    s.sendall(("POST /fotos/enviar?nome=a.jpg&quem=carlos HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nContent-Type: image/jpeg\r\nX-Eterna: 1\r\n\r\n" % PORTA).encode())
    resp = s.recv(4096)
    s.close()
    ok(b" 411 " in resp.split(b"\r\n")[0], "20: 411 sem Content-Length: %r" % resp[:40])

    # 21: sem X-Eterna, Origin de fora, Host de fora
    antes = set(arquivos(INB))
    r1 = enviar(jpeg(), sem=("X-Eterna",))
    r2 = enviar(jpeg(), extra={"Origin": "https://exemplo.com"})
    r3 = enviar(jpeg(), extra={"Host": "evil.com:%d" % PORTA})
    ok(all(r[0] == 403 and r[1] == {"erro": "origem"} for r in (r1, r2, r3)), "21: 403 origem: %s" % [r[:2] for r in (r1, r2, r3)])
    ok(set(arquivos(INB)) == antes and tmp_vazio(), "21: nada gravado")

    # 22: quem fora do cadastro e login compartilhado
    r1 = enviar(jpeg(), quem="fulano")
    r2 = enviar(jpeg(), quem="equipe")
    r3 = enviar(jpeg(), quem="")
    ok(all(r[0] == 400 and r[1] == {"erro": "quem"} for r in (r1, r2, r3)), "22: 400 quem: %s" % [r[:2] for r in (r1, r2, r3)])
    r4 = enviar(jpeg(), "IMG_9001.JPG", quem="Márcio")
    ok(r4[0] == 200 and r4[1]["resultado"] == "new", "22: Márcio com acento vira marcio: %s" % (r4[:2],))

    # 25: foto apagada por LGPD mandada de novo
    lg = jpeg()
    r = enviar(lg, "LGPD_1.JPG")
    pid = [os.path.basename(p)[:12] for p in arquivos(INB) if p.endswith("_LGPD_1.JPG")]
    rl = req("POST", "/lgpd/excluir", {"pids": pid})
    ok(r[1] == {"ok": True, "resultado": "new"} and pid and rl[0] == 200, "25: preparar LGPD: %s %s" % (r[:2], rl[:2]))
    antes = set(arquivos(INB))
    r = enviar(lg, "LGPD_1.JPG")
    ok(r[0] == 200 and r[1] == {"ok": False, "resultado": "recusada"}, "25: apagada por LGPD volta como recusada: %s" % (r[:2],))
    ok(set(arquivos(INB)) == antes and tmp_vazio(), "25: não entrou")

    # 26: sem CORS aberto
    ra = enviar(jpeg(), extra={"Origin": "http://127.0.0.1:%d" % PORTA})
    rb = req("OPTIONS", "/fotos/enviar", headers={"Origin": "http://127.0.0.1:%d" % PORTA, "Access-Control-Request-Headers": "x-eterna"})
    rc = req("OPTIONS", "/fotos/enviar", headers={"Origin": "https://exemplo.com"})
    ok(ra[0] == 200 and ra[2].get("Access-Control-Allow-Origin") == "http://127.0.0.1:%d" % PORTA, "26: origem do agente recebe a própria origem: %s" % ra[2])
    ok(all(x[2].get("Access-Control-Allow-Origin") != "*" for x in (ra, rb, rc, r1)), "26: nunca CORS *")
    ok("X-Eterna" in (rb[2].get("Access-Control-Allow-Headers") or ""), "26: preflight libera X-Eterna para a origem do agente")
    ok(not rc[2].get("Access-Control-Allow-Origin"), "26: origem de fora sem CORS: %s" % rc[2])

    # semáforo: 4 gravações em curso, a 5ª recebe 503 na hora
    presos = []
    for i in range(4):
        s = socket.create_connection(("127.0.0.1", PORTA), timeout=10)
        s.sendall(("POST /fotos/enviar?nome=p%d.jpg&quem=carlos HTTP/1.1\r\nHost: 127.0.0.1:%d\r\nContent-Type: image/jpeg\r\nX-Eterna: 1\r\n"
                   "Content-Length: 100000\r\n\r\n" % (i, PORTA)).encode() + b"\xff\xd8\xff")
        presos.append(s)
    time.sleep(0.6)
    r = enviar(jpeg(), "q.jpg")
    ok(r[0] == 503 and r[1] == {"erro": "ocupado"}, "semáforo: 5ª gravação ao mesmo tempo: %s" % (r[:2],))
    for s in presos:
        s.close()
    time.sleep(0.6)
    r = enviar(jpeg(), "IMG_9002.JPG")
    ok(r[0] == 200 and r[1]["resultado"] == "new", "semáforo solto depois das conexões caídas: %s" % (r[:2],))
    ok(tmp_vazio(), "temporários das conexões caídas apagados")

    # 27: o console do envio sem nome de arquivo do cliente, IP nem caminho
    linhas = [l for t, l in LOG["a"] if t >= t_log0]
    env_l = [l for l in linhas if "envio pela tela" in l]
    ok(len(env_l) >= 15, "27: uma linha por foto: %d" % len(env_l))
    ruins = [l for l in linhas if re.search(r"127\.0\.0\.1|passwd|\.\.|com espa|IMG_|LGPD_|Bom_nome|\\\\x00|" + re.escape(HB), l)
             and ("envio" in l or "+ " in l) and "CRD_" not in l]   # CRD_ = fotos lidas pelo leitor do cartão (fora do envio)
    ok(not ruins, "27: console com nome, IP ou caminho: %s" % ruins[:3])
    st = req("GET", "/status")[1]["envio"]
    ok(st["novas"] >= 14 and st["repetidas"] >= 1 and st["recusadas"] >= 10, "status.envio conta: %s" % st)

    # 23: 301ª foto no mesmo minuto do mesmo IP (agente novo, contagem zerada)
    P2, F2 = porta_45(), porta_45()
    H2 = tempfile.mkdtemp(prefix="eterna-envio-b-")
    procs.append(subir("b", P2, F2, H2, USER + "b", 2))
    um = jpeg()
    cods = [enviar(um, "T.jpg", porta=P2)[0] for _ in range(300)]
    r = enviar(um, "T.jpg", porta=P2)
    ok(all(c == 200 for c in cods) and r[0] == 429 and r[1] == {"erro": "taxa"}, "23: 301ª no minuto: %s %s" % (sorted(set(cods)), r[:2]))

    # 24: piso de disco trocado no módulo
    P3, F3 = porta_45(), porta_45()
    H3 = tempfile.mkdtemp(prefix="eterna-envio-c-")
    procs.append(subir("c", P3, F3, H3, USER + "c", 10 ** 9))
    r = enviar(jpeg(), "D.jpg", porta=P3)
    ok(r[0] == 507 and r[1] == {"erro": "disco"}, "24: 507 sem espaço: %s" % (r[:2],))
    ok(not arquivos(os.path.join(H3, "Eterna", "inbox")), "24: nada gravado")
    shutil.rmtree(H2, ignore_errors=True)
    shutil.rmtree(H3, ignore_errors=True)
except SystemExit as ex:
    falhas.append(str(ex))
except Exception as ex:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-800:])
finally:
    for p in procs:
        p.terminate()
        try:
            p.wait(5)
        except Exception:
            p.kill()
    shutil.rmtree(os.path.join("/media", USER), ignore_errors=True)
    shutil.rmtree(HB, ignore_errors=True)

if falhas:
    print("FALHA envio_manual_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK envio_manual_agente: POST /fotos/enviar entra como cartão, com guardas, limites e rótulo seguro (critérios 16 a 27)")
