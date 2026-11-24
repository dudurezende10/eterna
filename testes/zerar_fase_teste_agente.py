# 24/11 (plano docs/planos/2026-11-24-zerar-fase-teste.md): zerar a fase de teste com o agente DE VERDADE, num processo à parte
# (este teste faz o papel do systemd: religa o agente quando ele sai). HOME temporário com a inbox, os recortes, as montagens e as
# ativ-* como links para uma pasta "mídia" (como no estádio). Critérios 3, 5 a 21 e 24. Nenhuma foto de cliente: JPEG liso
# gerado aqui, ids e tokens inventados.
#   HOME=$(mktemp -d) python3 -I testes/zerar_fase_teste_agente.py agente/eterna-agente.py
import hashlib, http.client, importlib.util, json, os, random, socket, sqlite3, stat, subprocess, sys, time
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S

AG = os.path.abspath(sys.argv[1])
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_RECORTE_FALSO", "ETERNA_MODO_TESTE", "INVOCATION_ID", "ETERNA_ZERAR_FALHA_PASSO",
          "ETERNA_ZERAR_FOLGA_GB", "ETERNA_ZERAR_LIBERA", "ETERNA_ZERAR_HOJE", "ETERNA_PASTA", "ETERNA_BUSCA_DIAS", "ETERNA_GALERIA_API", "ETERNA_NUVEM", "ETERNA_BUCKET"):
    os.environ.pop(k, None)
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ["ETERNA_ZERAR_HOJE"] = "2026-11-24"           # revisão 24/11: dia simulado dentro do prazo (ZERAR_ATE), para o teste valer depois do dia 25
HOME = os.environ["HOME"]
E = os.path.join(HOME, "Eterna")
MIDIA = os.path.join(HOME, "midia")
PASTA_FTP = os.path.join(HOME, "ftp-pasta")
for d in ("inbox", "recortes", "montagens", "ativ-videos", "ativ-clientes", "ativ-demo"):
    os.makedirs(os.path.join(MIDIA, d), exist_ok=True)
    os.makedirs(E, exist_ok=True)
    if not os.path.lexists(os.path.join(E, d)):
        os.symlink(os.path.join(MIDIA, d), os.path.join(E, d))
os.makedirs(PASTA_FTP, exist_ok=True)
json.dump({"users": {"carlos": "x" * 12}}, open(os.path.join(E, "ftp.json"), "w"))

sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def livre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


PORTA, FTPP = livre(), livre()
LOG = os.path.join(HOME, "agente.log")
proc = [None]


def sobe(extra=None, espera_status=True, seg=60):
    env = {k: v for k, v in os.environ.items()}
    env.update({"HOME": HOME, "USERPROFILE": HOME, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP), "ETERNA_FTP_PASV": "%d-%d" % (FTPP + 1, FTPP + 3),
                "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "ETERNA_PASTA": PASTA_FTP, "ETERNA_SEM_RECORTE": "1"})
    env.update(extra or {})
    log = open(LOG, "a")
    log.write("\n----- partida %s -----\n" % json.dumps(extra or {}))
    log.flush()
    proc[0] = subprocess.Popen([sys.executable, "-I", "-u", AG], env=env, stdout=log, stderr=subprocess.STDOUT)
    if not espera_status:
        return proc[0]
    t0 = time.time()
    while time.time() - t0 < seg:
        if proc[0].poll() is not None:
            return None
        try:
            if pede("GET", "/status")[0] == 200:
                return proc[0]
        except OSError:
            pass
        time.sleep(0.2)
    return None


def para():
    p = proc[0]
    if p and p.poll() is None:
        p.terminate()
        try:
            p.wait(10)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait(5)


def espera_sair(seg):
    try:
        return proc[0].wait(seg)
    except subprocess.TimeoutExpired:
        return None


def pede(metodo, rota, corpo=None, cookie=None, extra=None, xeterna=True):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=30)
    h = {"Host": "127.0.0.1:%d" % PORTA}
    if metodo == "POST":
        h["Content-Type"] = "application/json"
        if xeterna:
            h["X-Eterna"] = "1"
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    c.request(metodo, rota, json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None, h)
    r = c.getresponse()
    b = r.read()
    c.close()
    try:
        return r.status, json.loads(b or b"{}")
    except ValueError:
        return r.status, None


def log_txt():
    try:
        return open(LOG, encoding="utf8", errors="replace").read()
    except OSError:
        return ""


def P(*p):
    return os.path.join(E, *p)


def jpeg(cor, lado=64):
    from PIL import Image
    import io
    b = io.BytesIO()
    Image.new("RGB", (lado, lado), cor).save(b, "JPEG", quality=90)
    return b.getvalue()


def sha_tab(arq, tabelas, where=None):
    """SHA-256 do conteúdo das tabelas (ordenado)."""
    c = sqlite3.connect(arq)
    try:
        h = hashlib.sha256()
        for t in tabelas:
            sql = "select * from %s%s" % (t, (" where " + where[t]) if where and t in where else "")
            for r in sorted(repr(x) for x in c.execute(sql)):
                h.update(r.encode())
        return h.hexdigest()
    finally:
        c.close()


def sha_pasta(d):
    h = hashlib.sha256()
    for raiz, ds, ns in os.walk(d):
        ds.sort()
        for n in sorted(ns):
            a = os.path.join(raiz, n)
            h.update(os.path.relpath(a, d).encode())
            h.update(open(a, "rb").read())
    return h.hexdigest()


def n_sql(arq, sql, args=()):
    c = sqlite3.connect(arq)
    try:
        return c.execute(sql, args).fetchone()[0]
    finally:
        c.close()


def vivos(d):
    return sorted(n for n in os.listdir(d) if not n.startswith(".")) if os.path.isdir(d) else []


# ---------------------------------------------------------------- semeadura ----------------------------------------------------------------
D1, D2, D3 = "2026-11-20", "2026-11-21", "2026-11-22"
PIDS = ["a0a0a0a0a0%02x" % i for i in range(3)]
os.makedirs(P("inbox", D1), exist_ok=True)
for i, pid in enumerate(PIDS):
    open(P("inbox", D1, "%s_IMG_%04d.jpg" % (pid, i)), "wb").write(jpeg((40 + i, 120, 60)))
os.makedirs(P("thumbs"), exist_ok=True)
for pid in PIDS:
    open(P("thumbs", pid + ".jpg"), "wb").write(jpeg((40, 120, 60), 32))
# chegam pela pasta do FTP (ETERNA_PASTA): entram de verdade (inbox de hoje, índice, miniatura, meta)
for i in range(3):
    open(os.path.join(PASTA_FTP, "FTP_%04d.JPG" % i), "wb").write(jpeg((200, 30 + i * 20, 90), 96))
os.makedirs(P("ponto", "sessoes"), exist_ok=True)
for d, n in ((D1, 2), (D2, 1)):
    json.dump({"dia": d, "sessoes": [{"card": "LPZR%s%02d" % (d[-2:], i), "pids": PIDS} for i in range(n)]}, open(P("ponto", "sessoes", d + ".json"), "w"))
os.makedirs(P("ponto", "metricas"), exist_ok=True)
for d in (D1, D2):
    json.dump({"dia": d, "vendas": 2, "sessoes": 3, "faturamento": 300.0, "fotos": 20, "sessoes_com_venda": 2}, open(P("ponto", "metricas", d + ".json"), "w"))
os.makedirs(P("roverpix", "agg"), exist_ok=True)
for d in (D1, D3):
    json.dump({"daily": {"approaches": 9, "converted": 4, "sales": 5, "revenue": 777.0, "photos": 90, "photosSold": 12}}, open(P("roverpix", "agg", d + ".json"), "w"))
os.makedirs(P("ponto", "visitas"), exist_ok=True)
json.dump({"dia": D1, "arestas": []}, open(P("ponto", "visitas", D1 + ".json"), "w"))
open(P("ponto", "visitas-log.jsonl"), "w").write('{"x":1}\n')
TOK = "ZrTesteToken0000000001"
os.makedirs(P("galerias", TOK), exist_ok=True)
json.dump({"v": 1, "token": TOK, "codigo": "ZRZR-ZRZR", "tipo": "sessao", "sessoes": [], "expira": "2027-01-01T00:00:00Z", "envio": {"vitrine": "ok"}},
          open(P("galerias", TOK, "sessao.json"), "w"))
json.dump({}, open(P("galerias", "escolas.json"), "w"))
open(P("galerias", "vendas-online.jsonl"), "w").write("")
os.makedirs(P("impressao"), exist_ok=True)
open(P("impressao", "fila.json"), "w").write("[]")
open(P("impressao", "venda_1.jpg"), "wb").write(jpeg((1, 2, 3), 16))
open(P("impressao", "lista_zr1.txt"), "w").write("x")
open(P("impressao", "imprimir.ps1"), "w").write("# fica")
open(P("recortes", PIDS[0] + ".png"), "wb").write(b"\x89PNG\r\n\x1a\nfalso")
open(P("recortes", ".versao"), "w").write(m.REC_VERSAO)
os.makedirs(P("montagens", PIDS[0]), exist_ok=True)
open(P("montagens", PIDS[0], "info-x.json"), "w").write("{}")
QR1, QR2 = "CartaoEntregueZr000001", "CartaoLivreZr000000002"
open(P("ativ-videos", QR1 + ".mp4"), "wb").write(b"\0" * 100)
open(P("ativ-clientes", "venda1.jpg"), "wb").write(jpeg((5, 5, 5), 16))
open(P("ativ-demo", "demo.mp4"), "wb").write(b"\1" * 50)
for d in ("fundos", "fundos-ia"):
    os.makedirs(P(d), exist_ok=True)
    open(P(d, "x.jpg"), "wb").write(b"fica")
json.dump(["hashlgpd"], open(P("lgpd-excluidas.json"), "w"))
# bancos
c = m.vendas_db()
c.execute("insert into evento (idem, venda, seq, tipo, em, dia, posto, por, dados, recebido) values ('e1','V1',1,'criar','x',?,'p','q','{}','x'),"
          "('e2','V1',2,'pagar','x',?,'p','q','{}','x'),('e3','V2',1,'criar','x',?,'p','q','{}','x')", (D1, D1, D2))
c.execute("insert into selfie values ('x',?,10,'checkout','achou',3,100),('x',?,11,'checkout','nao_achou',0,90)", (D1, D2))
c.execute("insert into ativ_venda (origem, id, tipo, dia, valor) values ('eterna','T1','drone',?,100),('eterna','T2','chute',?,50),('antigo','A1','drone','2026-10-01',80)", (D1, D2))
c.execute("insert into ativ_entrega (qr, venda, n, arquivo) values (?, 'T1', 1, 'x')", (QR1,))
c.execute("insert into ativ_pulseira (numero, venda, slot) values ('001','T1',1)")
c.execute("insert into ativ_pulseira_log (venda, slot, numero, acao) values ('T1',1,'001','ligar')")
c.execute("insert into ativ_foto (venda, qr, pid, tipo, t, em) values ('T1', ?, ?, 'cliente', 0, 'x')", (QR1, PIDS[0]))
c.execute("insert into ativ_cadastro values ('piloto','Piloto de teste',1)")
c.execute("insert into cartao_lote (id, n, em, por, situacao, baixado_n) values ('L20261120-120000', 2, 'x', 'teste', 'recebido', 1)")
c.execute("insert into cartao values (?, ?, 'L20261120-120000'), (?, ?, 'L20261120-120000')", (QR1, m.cartao_codigo(QR1), QR2, m.cartao_codigo(QR2)))
c.commit()
c.close()
c = m.operacao_db()
c.execute("insert into fotografo_dia values (?, 'carlos', '{}', 'x'), (?, 'yago', '{}', 'x')", (D1, D2))
c.execute("insert into fotografo_mes values ('2026-10', '{}', 'x')")
c.execute("insert into fotografo_dia_calc values (?, 'x', 1)", (D1,))
c.execute("insert into montagem_vista values (?, 'terminal01', 5, 0)", (D1,))
c.execute("insert into entrada values (?, 'bip', 100), (?, 'bip', 200), (?, 'bip', 300)", (D1, D1, D1))
c.execute("insert into entrada_total values (?, 'bilheteria', 1234, null)", (D2,))
c.execute("insert into importacao (id, em, por, arquivo, origem, dias, aceitas, recusadas) values ('i1','x','teste','a.csv','bip','[]',3,0)")
c.commit()
c.close()
c = m.nuvem_db()
c.execute("insert into fila (pid, arquivo, entrou) values (?, 'x', 0), (?, 'y', 0)", (PIDS[0], PIDS[1]))
c.execute("CREATE TABLE IF NOT EXISTS galerias (token TEXT PRIMARY KEY, prox REAL, tentativas INTEGER, feito REAL, erro TEXT)")
c.execute("insert into galerias (token) values (?)", (TOK,))
c.execute("CREATE TABLE IF NOT EXISTS videos (qr TEXT PRIMARY KEY, arquivo TEXT, entrou REAL, tentativas INTEGER DEFAULT 0)")
c.execute("insert into videos (qr, arquivo, entrou) values (?, 'x', 0)", (QR1,))
c.execute("CREATE TABLE IF NOT EXISTS cursor (nome TEXT PRIMARY KEY, valor TEXT)")
c.execute("insert into cursor values ('vendas', '123')")
c.commit()
c.close()
c = m.pedidos_db()
c.execute("insert into pedido values ('P1','Caixa 1','escolha','{}','x',0), ('P2','Caixa 1','confirmada','{}','x',0)")
c.commit()
c.close()
c = m.treino_db()
c.execute("insert into rotulo (pid, v, dia, fotografo, card, ordem, dados, por, em, origem, lote) values (?,1,?,'carlos','LPZR',1,'{}','teste','x','mao',null)", (PIDS[0], D1))
c.commit()
c.close()
c = m.cena_db()
c.execute("insert into cena (pid, dia, rotulo, conf) values (?, ?, 'gramado', 0.9)", (PIDS[0], D1))
c.commit()
c.close()
c = m.rostos_db()
c.execute("insert into foto values (?, ?, 2, 0), (?, ?, 1, 0)", (PIDS[0], D1, PIDS[1], D1))
c.execute("insert into rosto values (?, ?, 50, x'00'), (?, ?, 40, x'00'), (?, ?, 60, x'00')", (PIDS[0], D1, PIDS[0], D1, PIDS[1], D1))
c.commit()
c.close()
c = m.poses_db()
c.execute("insert into pose (pid, dia) values (?, ?), (?, ?)", (PIDS[0], D1, PIDS[1], D1))
c.commit()
c.close()
BO = P("backup-originais.db")
c = sqlite3.connect(BO)
c.execute("CREATE TABLE IF NOT EXISTS feito (chave TEXT PRIMARY KEY, tam INTEGER, mtime REAL, md5 TEXT, em REAL)")
for i, pid in enumerate(PIDS):
    c.execute("insert into feito values (?, 1, 1, 'x', 1)", ("originais/%s/%s_IMG_%04d.jpg" % (D1, pid, i),))
c.execute("insert into feito values (?, 1, 1, 'x', 1)", ("originais/ativ-videos/%s.mp4" % QR1,))
c.commit()
c.close()
ADM = S.cookie_sessao(m, "admin-zr")
SUP = S.cookie_sessao(m, "sup-zr", {"configuracao": {"r": True, "u": True}, "qualidade": {"r": True}})
VCOMO = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("sup-zr", por="admin-zr"))
POSTO = S.cookie_posto(m, "Caixa de teste")


def fica_hash():
    ed = P("ponto", "estado.db")
    return {"treino": sha_tab(P("ponto", "treino.db"), ("rotulo", "rotulo_hist", "lote", "medida", "liga_log")),
            "cena": sha_tab(P("ponto", "cena.db"), ("cena", "modelo", "meta")),
            "estado": sha_tab(ed, ("credencial", "sessao_login", "posto", "leitor", "doc")),
            "operacao": sha_tab(P("ponto", "operacao.db"), ("entrada", "entrada_total", "importacao")),
            "vendas": sha_tab(P("ponto", "vendas.db"), ("ativ_venda", "ativ_cadastro", "cartao_lote"),
                              {"ativ_venda": "origem='antigo'", "cartao_lote": "id != 'fase-teste'"}),
            "cursor": sha_tab(P("nuvem.db"), ("cursor",)),
            "roverpix": sha_pasta(P("roverpix")), "fundos": sha_pasta(P("fundos")), "fundos-ia": sha_pasta(P("fundos-ia")),
            "ativ-demo": sha_pasta(P("ativ-demo")), "index": open(P("index.json"), "rb").read(), "lgpd": open(P("lgpd-excluidas.json"), "rb").read()}


ZID = None
try:
    # ---------------------------------------- 5 e 6: sem supervisor e as recusas ----------------------------------------
    ok(sobe(), "o agente não subiu: " + log_txt()[-400:])
    t0 = time.time()
    while time.time() - t0 < 30:                         # as 3 fotos da pasta do FTP entram
        st, j = pede("GET", "/biblioteca", cookie=ADM)
        if st == 200 and len((j or {}).get("fotos") or []) >= 6:
            break
        time.sleep(0.3)
    time.sleep(1)
    ok(len((pede("GET", "/biblioteca", cookie=ADM)[1] or {}).get("fotos") or []) >= 6, "as 3 fotos semeadas e as 3 da pasta do FTP na biblioteca")
    st, j = pede("GET", "/status")
    ok(st == 200 and "zerada" in j and j["zerada"] is None, "/status mínimo com zerada null antes: %s" % j)
    st, j = pede("GET", "/zerar/previa", cookie=ADM)
    ok(st == 200 and "sem_supervisor" in j.get("bloqueios", []) and j.get("pode") is False, "6: sem supervisor a prévia mostra sem_supervisor: %s %s" % (st, j and j.get("bloqueios")))
    for nome, args, esperado in (
            ("sem X-Eterna", dict(cookie=ADM, xeterna=False), 403),
            ("Origin de fora", dict(cookie=ADM, extra={"Origin": "http://evil.example"}), 403),
            ("Host de fora", dict(cookie=ADM, extra={"Host": "evil.example:%d" % PORTA}), 403),
            ("sem sessão", dict(), 401),
            ("posto pareado", dict(cookie=POSTO), 401),
            ("não Admin com configuracao.u", dict(cookie=SUP), 403),
            ("ver como", dict(cookie=VCOMO), 403)):
        st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, **args)
        ok(st == esperado, "5: POST %s: %s %s" % (nome, st, j))
    ok(pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=SUP)[1].get("error") == "so_admin", "5: não Admin recebe so_admin")
    ok(pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=VCOMO)[1].get("erro") == "so_ver", "5: ver como recebe so_ver")
    ok(pede("GET", "/zerar/previa", cookie=VCOMO)[0] == 403 and pede("GET", "/zerar/previa", cookie=SUP)[0] == 403
       and pede("GET", "/zerar/previa", cookie=POSTO)[0] == 401, "5: prévia só do Admin")
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "zerar"}, cookie=ADM)
    ok(st == 400 and j.get("error") == "confirma", "4: zerar minúsculo: %s %s" % (st, j))
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 409 and "sem_supervisor" in j.get("bloqueios", []), "6: POST sem supervisor: %s %s" % (st, j))
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 429, "2 por minuto: %s" % st)
    ok(not os.path.exists(m.ZERAR_PEDIDO) and not os.path.exists(P("arquivo")), "5: nada gravado nas recusas")
    para()

    # ---------------------------------------- 19: pedido vencido ----------------------------------------
    m._grava_privado(m.ZERAR_PEDIDO, json.dumps({"id": "fase-teste-20261124-2300", "por": "admin-zr", "em": "x", "t": time.time() - 700, "ip": "127.0.0.1"}))
    ok(sobe({"ETERNA_MODO_TESTE": "1"}), "agente com pedido vencido não subiu: " + log_txt()[-400:])
    ok(os.path.exists(m.ZERAR_EXPIRADO) and not os.path.exists(m.ZERAR_PEDIDO) and not os.path.exists(P("arquivo", "fase-teste-20261124-2300")),
       "19: pedido de 11 min vira zerar-expirado.json e nada acontece")
    ok(n_sql(P("ponto", "estado.db"), "select count(*) from login_log where acao='zerar_expirado'") == 1, "19: zerar_expirado no login_log")
    ok(len(vivos(P("inbox", D1))) == 3, "19: a inbox ficou")

    # ---------------------------------------- 3: prévia igual ao disco e aos bancos ----------------------------------------
    st, pv = pede("GET", "/zerar/previa", cookie=ADM)
    ok(st == 200 and pv.get("pode") is True and pv.get("bloqueios") == [], "prévia sem bloqueio no modo de teste: %s" % (pv and pv.get("bloqueios")))
    v, f = pv.get("vai") or {}, pv.get("fica") or {}
    fotos_disco = sum(len([n for n in vivos(P("inbox", d)) if "_" in n]) for d in vivos(P("inbox")))
    sess_disco = sum(len(json.load(open(P("ponto", "sessoes", n))).get("sessoes") or []) for n in vivos(P("ponto", "sessoes")) if n.endswith(".json"))
    DIAS_INBOX = [d for d in vivos(P("inbox")) if [n for n in vivos(P("inbox", d)) if "_" in n]]
    esperado = {"fotos": fotos_disco, "dias_fotos": len(DIAS_INBOX), "miniaturas": len(vivos(P("thumbs"))), "sessoes": sess_disco, "vendas": 2, "eventos": 3, "pedidos": 2,
                "galerias": 1, "rostos_fotos": 2, "rostos": 3, "poses": 2, "dias_metricas": len([n for n in vivos(P("ponto", "metricas")) if n.endswith(".json")]),
                "visitas": len(vivos(P("ponto", "visitas"))), "recortes": 1, "montagens": 1, "selfies": 2, "fotografo_dias": n_sql(P("ponto", "operacao.db"), "select count(*) from fotografo_dia"),
                "fila_nuvem": 2, "ativ_vendas": 2, "ativ_entregas": 1, "ativ_videos": 1, "cartoes_bloqueados": 1}
    dif = {k: (v.get(k), x) for k, x in esperado.items() if v.get(k) != x}
    ok(not dif and fotos_disco >= 6 and D1 in DIAS_INBOX, "3: prévia (vai) diferente do disco e dos bancos: %s" % dif)
    ok(f.get("treino_marcacoes") == 1 and f.get("dias_roverpix") == 2 and f.get("dias_entradas") == 2 and f.get("cartoes") == 1
       and f.get("ativ_vendas_antigas") == 1 and f.get("postos") == 1 and f.get("usuarios", 0) >= 2, "3: prévia (fica): %s" % f)
    ok(pv.get("ultima") is None and pv.get("falha") is None and pv.get("prazo_dias") == 30, "prévia sem última, sem falha, prazo 30: %s" % pv)
    # 18 (em andamento) e 20 (bloqueios na prévia)
    m._grava_privado(m.ZERAR_PEDIDO, "{}")
    ok("em_andamento" in pede("GET", "/zerar/previa", cookie=ADM)[1].get("bloqueios", []), "18: pedido presente = em_andamento")
    os.remove(m.ZERAR_PEDIDO)
    if os.path.isdir("/dev/shm") and os.stat("/dev/shm").st_dev != os.stat(MIDIA).st_dev:
        outro = os.path.join("/dev/shm", "eterna-zr-%d" % os.getpid())
        os.makedirs(outro, exist_ok=True)
        os.rename(P("montagens"), P("montagens-link"))
        os.symlink(outro, P("montagens"))
        ok("outro_disco" in pede("GET", "/zerar/previa", cookie=ADM)[1].get("bloqueios", []), "20: montagens em outro disco = outro_disco")
        os.remove(P("montagens"))
        os.rename(P("montagens-link"), P("montagens"))
        os.rmdir(outro)
    os.rename(P("thumbs"), P("thumbs-real"))
    os.symlink(P("thumbs-real"), P("thumbs"))
    ok("link_inesperado" in pede("GET", "/zerar/previa", cookie=ADM)[1].get("bloqueios", []), "20: pasta do NVMe que é link = link_inesperado")
    os.remove(P("thumbs"))
    os.rename(P("thumbs-real"), P("thumbs"))
    para()

    # ---------------------------------------- revisão 24/11: prazo do botão (ZERAR_ATE) ----------------------------------------
    for hoje, libera, esperado in (("2026-11-25", None, []), ("2026-11-26", None, ["prazo"]), ("2026-11-26", "1", [])):
        env = {"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_HOJE": hoje}
        if libera:
            env["ETERNA_ZERAR_LIBERA"] = libera
        ok(sobe(env), "prazo: agente não subiu: " + log_txt()[-400:])
        st, j = pede("GET", "/zerar/previa", cookie=ADM)
        ok(st == 200 and j.get("bloqueios") == esperado and j.get("pode") is (not esperado), "prazo %s libera=%s: prévia %s %s" % (hoje, libera, st, j and j.get("bloqueios")))
        if esperado:
            st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
            ok(st == 409 and j.get("bloqueios") == ["prazo"], "prazo: POST depois do dia 25 dá 409 prazo: %s %s" % (st, j))
            ok(not os.path.exists(m.ZERAR_PEDIDO) and not os.path.exists(m.ZERAR_ANDA), "prazo: nada gravado na recusa")
        para()

    # ---------------------------------------- 20: falta de espaço na partida (preparo recusa, nada muda) ----------------------------------------
    ok(sobe({"ETERNA_MODO_TESTE": "1"}), "agente não subiu")
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": " ZERAR "}, cookie=ADM)
    ok(st == 400, "4: ' ZERAR ' com espaço: %s" % st)
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 202 and j.get("reinicia") is True and m._re_zerada.match(j.get("id") or ""), "7: POST válido 202: %s %s" % (st, j))
    ok(espera_sair(5) is not None, "7: o processo sai em até 5 s")
    antes_inv = json.dumps(pv["vai"], sort_keys=True)
    ok(sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_FOLGA_GB": "100000000"}), "20: agente não subiu depois da recusa: " + log_txt()[-400:])
    fz = json.load(open(m.ZERAR_FALHOU)) if os.path.exists(m.ZERAR_FALHOU) else {}
    ok(fz.get("passo") == "preparo" and "espaco" in (fz.get("motivo") or ""), "20: zerar-falhou.json com o código: %s" % fz)
    ok(not os.path.exists(m.ZERAR_ANDA) and not os.path.exists(m.ZERAR_FEITA), "20: sem andamento e sem zerada")
    st, j = pede("GET", "/zerar/previa", cookie=ADM)
    ok(json.dumps(j["vai"], sort_keys=True) == antes_inv, "20: nada mudou depois da recusa no preparo")
    ok((j.get("falha") or {}).get("passo") == "preparo" and "espaco" in ((j.get("falha") or {}).get("motivo") or ""), "20: a prévia mostra a falha: %s" % j.get("falha"))
    ok(n_sql(P("ponto", "estado.db"), "select count(*) from login_log where acao='zerar_falhou'") == 1, "20: zerar_falhou no login_log")
    para()

    # ---------------------------------------- 7, 8, 21: pedido, parada no meio, retomada ----------------------------------------
    antes = fica_hash()
    ok(sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_HOJE": "2026-11-26", "ETERNA_ZERAR_LIBERA": "1"}), "agente não subiu")
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 202, "7: POST válido (depois do prazo, com ETERNA_ZERAR_LIBERA=1): %s %s" % (st, j))
    ZID = (j or {}).get("id")
    ok(not os.path.exists(m.ZERAR_FALHOU), "pedido novo tira a falha do preparo")
    ped = json.load(open(m.ZERAR_PEDIDO)) if os.path.exists(m.ZERAR_PEDIDO) else {}
    ok(ped.get("id") == ZID and ped.get("por") == "admin-zr" and ped.get("ip") and stat.S_IMODE(os.stat(m.ZERAR_PEDIDO).st_mode) == 0o600,
       "7: pedido gravado (0600) com quem, quando e IP: %s" % ped)
    lg = sqlite3.connect(P("ponto", "estado.db")).execute("select usuario, ip from login_log where acao='zerar_pedido'").fetchall()
    ok(lg and lg[-1][0] == "admin-zr" and lg[-1][1], "7: zerar_pedido no login_log: %s" % lg)
    ok(espera_sair(5) is not None, "7: sai em até 5 s")
    # 21: para no mover_midia na 1ª partida; a 2ª (sem a falha) continua e termina
    # prazo: as duas partidas rodam como se fosse dia 26, sem ETERNA_ZERAR_LIBERA; o andamento gravado retoma normal
    p1 = sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_FALHA_PASSO": "mover_midia", "ETERNA_ZERAR_HOJE": "2026-11-26"}, espera_status=False)
    rc = espera_sair(60)
    ok(rc not in (None, 0), "21: com a falha no mover_midia o agente sai para o systemd religar: %s" % rc)
    an = json.load(open(m.ZERAR_ANDA)) if os.path.exists(m.ZERAR_ANDA) else {}
    ok(an.get("tentativas") == 1 and n_sql(P("ponto", "vendas.db"), "select count(*) from evento") == 0 and len(vivos(P("inbox"))) >= 1,
       "21: parou no meio: bancos já zerados, fotos ainda na inbox: %s" % an)
    # revisão 24/11: originais vem depois de mover_midia; parado no mover_midia, o registro do backup-originais fica intacto
    ok(n_sql(BO, "select count(*) from feito") == 4 and n_sql(BO, "select count(*) from sqlite_master where name='arquivado'") == 0,
       "21: parado no mover_midia, a tabela feito do backup-originais não foi esvaziada")
    ok(sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_HOJE": "2026-11-26"}, seg=90), "21: a partida seguinte não terminou: " + log_txt()[-600:])
    st, j = pede("GET", "/status")
    ok(j.get("zerada") == ZID, "12: /status.zerada = id: %s" % j.get("zerada"))
    # 8: tudo no arquivo
    ARQ, AM = P("arquivo", ZID), os.path.join(MIDIA, "inbox", ".arquivo", ZID)
    for rel in ("inbox", "recortes", "montagens", "ativ-videos", "ativ-clientes", "thumbs", "galerias", "ponto/sessoes", "ponto/metricas", "ponto/visitas"):
        # métricas e visitas de hoje e de ontem o agente regrava sozinho (zeradas) logo depois de subir
        sobra = [n for n in vivos(P(*rel.split("/"))) if not (rel in ("ponto/metricas", "ponto/visitas") and n[:10] >= m._ff_hoje(time.time() - 86400))]
        ok(os.path.isdir(P(*rel.split("/"))) and sobra == [], "8: %s existe e está vazia: %s" % (rel, sobra))
    for d in (D1, D2):
        ok(not os.path.exists(P("ponto", "metricas", d + ".json")) and os.path.exists(os.path.join(P("arquivo", ZID), "home", "ponto", "metricas", d + ".json")),
           "8: métricas de %s no arquivo" % d)
    ok(os.path.islink(P("inbox")) and os.path.exists(P("recortes", ".versao")), "8: a inbox segue link para o HD e o .versao fica")
    ok(sorted(vivos(os.path.join(AM, "inbox"))) == sorted(DIAS_INBOX) and vivos(os.path.join(AM, "recortes")) == [PIDS[0] + ".png"]
       and vivos(os.path.join(AM, "ativ-videos")) == [QR1 + ".mp4"], "8: originais, recortes e vídeos no arquivo do HD")
    ok(os.path.exists(os.path.join(ARQ, "home", "galerias", TOK, "sessao.json")) and os.path.exists(os.path.join(ARQ, "home", "rostos.db"))
       and os.path.exists(os.path.join(ARQ, "home", "ponto", "poses.db")) and os.path.exists(os.path.join(ARQ, "home", "meta.json"))
       and os.path.exists(os.path.join(ARQ, "home", "impressao", "venda_1.jpg")) and os.path.exists(P("impressao", "imprimir.ps1"))
       and not os.path.exists(P("impressao", "fila.json")), "8: galerias, rostos, poses, meta e impressão no arquivo do NVMe (o .ps1 fica)")
    ok(all(os.path.exists(os.path.join(ARQ, "bancos", b)) for b in ("vendas.db", "operacao.db", "nuvem.db", "estado.db", "treino.db", "cena.db", "backup-originais.db")),
       "8: cópia dos bancos")
    vd = P("ponto", "vendas.db")
    ok(all(n_sql(vd, "select count(*) from %s" % t) == 0 for t in ("evento", "selfie", "ativ_entrega", "ativ_pulseira", "ativ_pulseira_log", "ativ_foto"))
       and n_sql(vd, "select count(*) from ativ_venda where origem='eterna'") == 0, "8: tabelas de venda vazias")
    od = P("ponto", "operacao.db")
    ok(all(n_sql(od, "select count(*) from %s" % t) == 0 for t in ("fotografo_mes", "montagem_vista")), "8: operacao.db zerado")
    ok(n_sql(P("nuvem.db"), "select count(*) from fila") == 0 and n_sql(P("nuvem.db"), "select count(*) from galerias") == 0
       and n_sql(P("nuvem.db"), "select count(*) from videos") == 0, "8: filas da nuvem vazias")
    ok(n_sql(P("ponto", "estado.db"), "select count(*) from pedido") == 0, "8: pedidos vazios")
    # 9: o que fica, idêntico
    depois = fica_hash()
    ok(antes == depois, "9: mudou o que devia ficar: %s" % [k for k in antes if antes[k] != depois.get(k)])
    # 10: cartões
    cv = sqlite3.connect(vd)
    ok(cv.execute("select lote from cartao where token=?", (QR1,)).fetchone()[0] == "fase-teste"
       and cv.execute("select situacao from cartao_lote where id='fase-teste'").fetchone()[0] == "cancelado"
       and m.cartao_situacao(cv, QR1) == "cartao_cancelado" and m.cartao_situacao(cv, QR2) is None, "10: cartão entregue no lote fase-teste cancelado; o livre segue")
    cv.close()
    # 11: série diária
    t0 = time.time()
    lin = {}
    while time.time() - t0 < 20:
        lin = {r[0]: r[1:] for r in sqlite3.connect(od).execute("select dia, fonte_vendas, vendas, entradas from dia where dia in (?,?,?)", (D1, D2, D3))}
        if lin.get(D1, (None,))[0] == "roverpix":
            break
        time.sleep(0.5)
    ok(lin.get(D1, ())[:2] == ("roverpix", 5) and lin.get(D2, ())[:2] == (None, None) and lin.get(D3, ())[:2] == ("roverpix", 5)
       and lin.get(D1, (0, 0, 0))[2] == 3 and lin.get(D2, (0, 0, 0))[2] == 1234, "11: dia eterna vira roverpix ou nulo, entradas ficam: %s" % lin)
    # 12: telas vazias
    time.sleep(3)                                           # a pasta do FTP é relida na partida (as 3 fotos caem como repetidas)
    ok((pede("GET", "/biblioteca", cookie=ADM)[1] or {}).get("fotos") == [], "12, 14, 15: biblioteca vazia (nem o arquivo nem a pasta do FTP voltam)")
    ok(vivos(P("inbox")) == [], "14: a foto da pasta do FTP não volta para a inbox")
    ok(((pede("GET", "/sessoes", cookie=ADM)[1] or {}).get("sessoes") or []) == [], "12: /sessoes vazia")
    st, j = pede("GET", "/metricas/dia?de=%s&ate=%s" % (D1, D2), cookie=ADM)
    ok(st == 200 and not any((x or {}).get("vendas") for x in (j if isinstance(j, list) else (j or {}).get("dias") or [])), "12: /metricas/dia sem vendas do Eterna: %s" % j)
    st, j = pede("GET", "/fotografos/dias?de=%s&ate=%s" % (D1, D2), cookie=ADM)
    ok(st == 200 and not any(d.get("por_fotografo") for d in (j or {}).get("dias") or []), "12: /fotografos/dias vazio: %s" % j)
    ok(n_sql(P("rostos.db"), "select count(*) from rosto") == 0 if os.path.exists(P("rostos.db")) else True, "12: rostos.db vazio")
    st, j = pede("GET", "/estatisticas/dias?ano=2026", cookie=ADM)
    ok(st == 200, "12: estatísticas abrem: %s" % st)
    # 13: permissões e só números
    ok(stat.S_IMODE(os.stat(ARQ).st_mode) == 0o700 and stat.S_IMODE(os.stat(AM).st_mode) == 0o700
       and stat.S_IMODE(os.stat(P("arquivo")).st_mode) == 0o700, "13: pastas 0700")
    for a in (os.path.join(ARQ, "resumo.json"), os.path.join(ARQ, "passos.jsonl"), m.ZERAR_FEITA, os.path.join(ARQ, "bancos", "vendas.db")):
        ok(os.path.exists(a) and stat.S_IMODE(os.stat(a).st_mode) == 0o600, "13: %s 0600" % os.path.basename(a))
    rs = open(os.path.join(ARQ, "resumo.json"), encoding="utf8").read()
    segredos = PIDS + [TOK, QR1, QR2, "ZRZR-ZRZR", "LPZR", "FTP_000", "IMG_000"]
    ok(not [x for x in segredos if x in rs], "13: resumo.json com id de foto, token ou venda: %s" % [x for x in segredos if x in rs])
    zl = [ln for ln in log_txt().splitlines() if "zerar" in ln]
    ok(not [x for x in segredos if any(x in ln for ln in zl)], "13: console da zeragem com id de foto, token ou venda")
    rj = json.loads(rs)
    ok(rj.get("prazo_dias") == 30 and rj.get("apagar_a_partir_de") and any(rj["apagar_a_partir_de"] in ln for ln in zl), "D9: prazo de 30 dias no resumo e no console")
    # 16 (passos) e 17: registro dos originais
    pz = [json.loads(x) for x in open(os.path.join(ARQ, "passos.jsonl"))]
    ok([x["passo"] for x in pz if x["ok"]] == ["preparo", "copias", "vendas", "operacao", "nuvem", "estado", "mover_nvme", "mover_midia", "originais", "fim"]
       and any(x["passo"] == "mover_midia" and not x["ok"] and x["erro"] == "falha_teste" for x in pz), "21: passos com a parada e a retomada: %s" % pz)
    ok(n_sql(BO, "select count(*) from feito") == 0 and n_sql(BO, "select count(*) from arquivado where arquivo=?", (ZID,)) == 4, "17: feito vai para arquivado")
    # 18: segundo POST
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 409 and "ja_zerado" in j.get("bloqueios", []), "18: segundo POST: %s %s" % (st, j))
    st, j = pede("GET", "/zerar/previa", cookie=ADM)
    u = (j or {}).get("ultima") or {}
    ok(u.get("id") == ZID and u.get("por") == "admin-zr" and u.get("pasta") == "arquivo/" + ZID and (u.get("resumo") or {}).get("vai", {}).get("fotos") == pv["vai"]["fotos"],
       "prévia com a última zeragem: %s" % u)
    ok(n_sql(P("ponto", "estado.db"), "select count(*) from login_log where acao='zerar_feito'") == 1, "zerar_feito no login_log")
    # 24: desfazer
    ok(subprocess.run([sys.executable, "-I", AG, "--desfazer-zeragem", ZID], env=dict(os.environ, ETERNA_PORTA=str(PORTA)), capture_output=True, timeout=60).returncode == 3,
       "24: com o agente no ar, desfazer recusa")
    para()
    cv = sqlite3.connect(vd)
    cv.execute("insert into evento (idem, venda, seq, tipo, em, dia) values ('novo','VN',1,'criar','x',?)", (m._ff_hoje(),))
    cv.commit()
    cv.close()
    r = subprocess.run([sys.executable, "-I", AG, "--desfazer-zeragem", ZID], env=dict(os.environ, ETERNA_PORTA=str(PORTA)), capture_output=True, text=True, timeout=60)
    ok(r.returncode == 4, "24: com venda depois da zeragem, só com --sobrescrever: %s %s" % (r.returncode, r.stdout[-200:]))
    r = subprocess.run([sys.executable, "-I", AG, "--desfazer-zeragem", ZID, "--sobrescrever"], env=dict(os.environ, ETERNA_PORTA=str(PORTA)), capture_output=True, text=True, timeout=60)
    ok(r.returncode == 0, "24: desfazer: %s %s" % (r.returncode, (r.stdout + r.stderr)[-400:]))
    ok(not os.path.exists(m.ZERAR_FEITA) and os.path.exists(P("ponto", "zerada-desfeita-%s.json" % ZID)), "24: zerada.json vira zerada-desfeita")
    ok(sobe({"ETERNA_MODO_TESTE": "1"}), "24: agente não subiu depois de desfazer: " + log_txt()[-400:])
    st, j = pede("GET", "/zerar/previa", cookie=ADM)
    dv = {k: (pv["vai"][k], (j.get("vai") or {}).get(k)) for k in pv["vai"] if pv["vai"][k] != (j.get("vai") or {}).get(k)}
    ok(not dv or set(dv) <= {"cartoes_bloqueados"}, "24: contagens depois de desfazer iguais às de antes: %s" % dv)
    ok(n_sql(BO, "select count(*) from feito") == 4 and n_sql(BO, "select count(*) from arquivado") == 0, "24: registro dos originais volta")
    ok(pede("GET", "/status")[1].get("zerada") is None, "24: /status sem zerada depois de desfazer")
    para()

    # ---------------------------------------- 21: a falha mantida três vezes ----------------------------------------
    os.replace(P("ponto", "zerada-desfeita-%s.json" % ZID), os.path.join(HOME, "desfeita.json"))
    ok(sobe({"ETERNA_MODO_TESTE": "1"}), "agente não subiu")
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 202, "POST da segunda rodada: %s %s" % (st, j))
    Z2 = (j or {}).get("id")
    ok(Z2 and Z2 != ZID, "id novo quando a pasta do anterior existe: %s" % Z2)
    espera_sair(5)
    rcs = []
    for i in range(2):
        sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_FALHA_PASSO": "originais"}, espera_status=False)
        rcs.append(espera_sair(60))
    ok(all(x not in (None, 0) for x in rcs) and os.path.exists(m.ZERAR_ANDA), "21: duas partidas com falha saem: %s" % rcs)
    ok(sobe({"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_FALHA_PASSO": "originais"}), "21: na 3ª vez o agente sobe e responde /status: " + log_txt()[-400:])
    fz = json.load(open(m.ZERAR_FALHOU)) if os.path.exists(m.ZERAR_FALHOU) else {}
    ok(fz.get("passo") == "originais" and fz.get("id") == Z2 and not os.path.exists(m.ZERAR_ANDA) and not os.path.exists(m.ZERAR_FEITA),
       "21: na 3ª vez vira zerar-falhou.json com o passo: %s" % fz)
    st, j = pede("GET", "/zerar/previa", cookie=ADM)
    ok((j.get("falha") or {}).get("passo") == "originais", "21: a prévia mostra onde parou: %s" % j.get("falha"))
    st, j = pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"}, cookie=ADM)
    ok(st == 202 and j.get("id") == Z2, "21: apertar de novo retoma o mesmo id: %s %s" % (st, j))
    espera_sair(5)
    ok(sobe({"ETERNA_MODO_TESTE": "1"}, seg=90) and pede("GET", "/status")[1].get("zerada") == Z2, "21: retomada pelo botão termina: " + log_txt()[-400:])
    ok(vivos(P("inbox")) == [] and n_sql(BO, "select count(*) from feito") == 0, "21: retomada com o mesmo resultado do 8")
    para()

    # ---------------------------------------- revisão 24/11: laço de reinício na partida ----------------------------------------
    # o passos.jsonl não pode ser gravado (aqui, é uma pasta): até a 4ª partida o /status responde e o andamento não fica
    def pedido(zid, **extra):
        json.dump(dict({"id": zid, "por": "admin-zr", "por_nome": "Admin", "em": m._iso(), "t": time.time(), "ip": "127.0.0.1"}, **extra),
                  open(m.ZERAR_PEDIDO, "w"))
    for f in (m.ZERAR_FALHOU,):
        if os.path.exists(f):
            os.remove(f)
    Z3 = "fase-teste-20261124-2301"
    os.makedirs(os.path.join(P("arquivo", Z3), "passos.jsonl"))
    pedido(Z3)
    sobem = []
    for i in range(4):
        sobem.append(bool(sobe({"ETERNA_MODO_TESTE": "1"}, seg=60)))
        ok(not os.path.exists(m.ZERAR_ANDA), "laço: partida %d com o zerar-andamento.json no lugar" % (i + 1))
        para()
    ok(all(sobem), "laço: passos.jsonl sem gravar, o /status responde nas 4 partidas: %s · %s" % (sobem, log_txt()[-400:]))
    fz = json.load(open(m.ZERAR_FALHOU)) if os.path.exists(m.ZERAR_FALHOU) else {}
    ok(fz.get("id") == Z3 and fz.get("passo") == "preparo", "laço: vira zerar-falhou.json no preparo: %s" % fz)
    ok(m.ZERAR_FEITA and json.load(open(m.ZERAR_FEITA)).get("id") == Z2, "laço: a zerada anterior não mudou")
    # o andamento já com 3 tentativas (a partida anterior caiu depois de somar): não tenta a 4ª, sobe normal
    os.remove(m.ZERAR_FALHOU)
    Z4 = "fase-teste-20261124-2302"
    json.dump({"id": Z4, "por": "admin-zr", "tentativas": 3}, open(m.ZERAR_ANDA, "w"))
    ok(sobe({"ETERNA_MODO_TESTE": "1"}, seg=60), "laço: andamento com 3 tentativas, o agente sobe: " + log_txt()[-400:])
    fz = json.load(open(m.ZERAR_FALHOU)) if os.path.exists(m.ZERAR_FALHOU) else {}
    ok(fz.get("id") == Z4 and fz.get("motivo") == "tentativas" and not os.path.exists(m.ZERAR_ANDA), "laço: 3 tentativas viram zerar-falhou.json: %s" % fz)
    para()
    # erro fora dos passos que escapa do zerar_partida (o zerar-falhou.json não pode ser gravado): o andamento sai e o agente sobe
    os.remove(m.ZERAR_FALHOU)
    os.makedirs(m.ZERAR_FALHOU)
    pedido(Z3)
    sobem = []
    for i in range(4):
        sobem.append(bool(sobe({"ETERNA_MODO_TESTE": "1"}, seg=60)))
        ok(not os.path.exists(m.ZERAR_ANDA) and not os.path.exists(m.ZERAR_PEDIDO), "laço: partida %d com andamento ou pedido no lugar" % (i + 1))
        para()
    ok(all(sobem) and "a partida falhou" in log_txt(), "laço: zerar-falhou.json sem gravar, o /status responde nas 4 partidas: %s" % sobem)
    os.rmdir(m.ZERAR_FALHOU)
    # revisão 24/11: preparo confere escrita; cópia dos bancos apaga a .tmp que sobrou de uma tentativa que caiu
    real = os.access
    try:
        os.access = lambda p, modo, **k: False if os.path.basename(p) == "thumbs" else real(p, modo, **k)
        se = m._zerar_sem_escrita()
    finally:
        os.access = real
    ok(se == ["thumbs"] and m._zerar_sem_escrita() == [], "preparo: pasta sem escrita aparece antes de mexer: %s" % se)
    cp = os.path.join(HOME, "copia-teste")
    os.makedirs(os.path.join(cp, "bancos"))
    open(os.path.join(cp, "bancos", "vendas.db.tmp"), "wb").write(b"lixo de uma copia que caiu no meio" * 10)
    n_cp = m._zp_copias({"arq": cp})
    ok(n_cp >= 1 and n_sql(os.path.join(cp, "bancos", "vendas.db"), "select count(*) from sqlite_master") > 0
       and not os.path.exists(os.path.join(cp, "bancos", "vendas.db.tmp")), "copias: a .tmp que sobrou é apagada antes de copiar: %s" % n_cp)
    # ---------------------------------------- testador 24/11: mover idempotente (retomada sem destino_existe) ----------------------------------------
    # o mover_nvme terminou mas o registro falhou; o agente subiu entre as tentativas e recriou meta.json, a métrica de hoje e uma
    # pasta de galeria: a retomada segue, a cópia da fase de teste no arquivo fica intacta e o que nasceu depois vai ao lado (.pos-)
    mv = os.path.join(HOME, "mover-teste")
    src, dst = os.path.join(mv, "src"), os.path.join(mv, "dst")
    for d in (os.path.join(src, "gal1"), os.path.join(dst, "gal1")):
        os.makedirs(d)
    open(os.path.join(dst, "gal1", "m.json"), "w").write("teste")
    open(os.path.join(src, "gal1", "m.json"), "w").write("novo")
    open(os.path.join(dst, "2026-11-24.json"), "w").write("teste")
    open(os.path.join(src, "2026-11-24.json"), "w").write("novo")
    open(os.path.join(src, "2026-11-25.json"), "w").write("so-origem")
    n_mv = m._zerar_mover(src, dst)
    pos = sorted(x for x in os.listdir(dst) if ".pos-" in x)
    ok(n_mv == 3 and m._zerar_ls(src) == [] and open(os.path.join(dst, "2026-11-24.json")).read() == "teste"
       and open(os.path.join(dst, "gal1", "m.json")).read() == "teste" and open(os.path.join(dst, "2026-11-25.json")).read() == "so-origem"
       and len(pos) == 2 and all(m._re_zerar_pos.search(x) for x in pos)
       and open(os.path.join(dst, [x for x in pos if x.startswith("gal1")][0], "m.json")).read() == "novo",
       "mover: pasta e arquivo repetidos vão ao lado sem sobrescrever: n=%s src=%s dst=%s" % (n_mv, m._zerar_ls(src), sorted(os.listdir(dst))))
    ok(m._zerar_mover(src, dst) == 0, "mover: origem vazia (já movido) segue")
    a_src, a_dst = os.path.join(mv, "home", "meta.json"), os.path.join(mv, "arq", "meta.json")
    os.makedirs(os.path.dirname(a_src))
    os.makedirs(os.path.dirname(a_dst))
    open(a_dst, "w").write("teste")
    ok(m._zerar_mover_arq(a_src, a_dst) == 0 and open(a_dst).read() == "teste", "mover_arq: origem ausente e destino presente segue")
    open(a_src, "w").write("novo")
    for x in ("rostos.db", "rostos.db-wal"):
        open(os.path.join(mv, "arq", x), "w").write("teste")
        open(os.path.join(mv, "home", x), "w").write("novo")
    ok(m._zerar_mover_arq(a_src, a_dst) == 1 and not os.path.exists(a_src) and open(a_dst).read() == "teste", "mover_arq: os dois presentes, o novo vai ao lado")
    for x in ("rostos.db", "rostos.db-wal"):
        m._zerar_mover_arq(os.path.join(mv, "home", x), os.path.join(mv, "arq", x))
    la = sorted(os.listdir(os.path.join(mv, "arq")))
    pdb = [x for x in la if x.startswith("rostos.db.pos-") and not x.endswith("-wal")]
    ok(len(la) == 6 and len(pdb) == 1 and pdb[0] + "-wal" in la and open(os.path.join(mv, "arq", pdb[0] + "-wal")).read() == "novo",
       "mover_arq: banco e -wal ao lado continuam um par: %s" % la)
    # revisão 24/11: banco, -wal e -shm são um grupo. Bancos de verdade: o do arquivo (fase de teste, 3 linhas, sem -wal) e o da
    # origem (nasceu depois, 5 linhas que ainda estão só no -wal). O -wal novo nunca pode cair ao lado do banco do arquivo.
    import shutil as _sh

    def banco_teste(pasta, n, wal):
        os.makedirs(pasta, exist_ok=True)
        tmp = os.path.join(mv, "fabrica-%d" % len(os.listdir(mv)))
        os.makedirs(tmp)
        c = sqlite3.connect(os.path.join(tmp, "rostos.db"))
        try:
            if wal:
                c.execute("pragma journal_mode=wal")
                c.execute("pragma wal_autocheckpoint=0")
            c.execute("create table rosto (id integer primary key, de text)")
            c.executemany("insert into rosto (de) values (?)", [("wal" if wal else "teste",)] * n)
            c.commit()
            for x in os.listdir(tmp):            # com a conexão aberta: o -wal e o -shm ainda existem
                _sh.copy2(os.path.join(tmp, x), os.path.join(pasta, x))
        finally:
            c.close()

    def conta(arq):
        c = sqlite3.connect(arq)
        try:
            return (c.execute("select count(*) from rosto").fetchone()[0], c.execute("pragma integrity_check").fetchone()[0])
        finally:
            c.close()

    def move_rostos(o, a):
        return sum(m._zerar_mover_arq(os.path.join(o, x), os.path.join(a, x)) for x in ("rostos.db", "rostos.db-wal", "rostos.db-shm"))

    g_o, g_a = os.path.join(mv, "g1", "home"), os.path.join(mv, "g1", "arq")
    banco_teste(g_a, 3, False)
    banco_teste(g_o, 5, True)
    ok(sorted(os.listdir(g_a)) == ["rostos.db"] and "rostos.db-wal" in os.listdir(g_o), "grupo: preparo do caso: %s %s" % (os.listdir(g_a), os.listdir(g_o)))
    n_g = move_rostos(g_o, g_a)
    la = sorted(os.listdir(g_a))
    pdb = [x for x in la if x.startswith("rostos.db.pos-") and not x.endswith(("-wal", "-shm"))]
    ok(n_g == 3 and os.listdir(g_o) == [] and len(pdb) == 1 and la == sorted(["rostos.db", pdb[0], pdb[0] + "-wal", pdb[0] + "-shm"]),
       "grupo: arquivo só com o banco, origem com banco e -wal: o grupo novo vai inteiro ao lado: n=%s %s" % (n_g, la))
    ok(conta(os.path.join(g_a, "rostos.db")) == (3, "ok"), "grupo: o banco arquivado continua mostrando as linhas dele: %s" % (conta(os.path.join(g_a, "rostos.db")),))
    ok(len(pdb) == 1 and conta(os.path.join(g_a, pdb[0])) == (5, "ok"), "grupo: o banco novo ao lado abre com o -wal dele")
    # par que sobrou sozinho na origem (o banco foi numa tentativa anterior): fica à parte, nunca ao lado do banco do arquivo
    g_o, g_a = os.path.join(mv, "g2", "home"), os.path.join(mv, "g2", "arq")
    banco_teste(g_a, 3, False)
    banco_teste(g_o, 5, True)
    os.remove(os.path.join(g_o, "rostos.db"))
    n_g = move_rostos(g_o, g_a)
    la = sorted(os.listdir(g_a))
    ok(n_g == 2 and os.listdir(g_o) == [] and "rostos.db-wal" not in la and "rostos.db-shm" not in la and len(la) == 3
       and all(m._re_zerar_pos.search(x) for x in la if x != "rostos.db") and conta(os.path.join(g_a, "rostos.db")) == (3, "ok"),
       "grupo: -wal que sobrou sozinho na origem vai à parte (.pos-): n=%s %s" % (n_g, la))
    # sem nada no arquivo: o grupo segue com o nome normal e continua um par
    g_o, g_a = os.path.join(mv, "g3", "home"), os.path.join(mv, "g3", "arq")
    banco_teste(g_o, 5, True)
    n_g = move_rostos(g_o, g_a)
    ok(n_g == 3 and sorted(os.listdir(g_a)) == ["rostos.db", "rostos.db-shm", "rostos.db-wal"] and conta(os.path.join(g_a, "rostos.db")) == (5, "ok"),
       "grupo: sem conflito, banco e pares seguem com o nome normal: n=%s %s" % (n_g, sorted(os.listdir(g_a))))
    # o arquivo só tem o -wal (o banco não): o banco novo também não pode cair ao lado dele
    g_o, g_a = os.path.join(mv, "g4", "home"), os.path.join(mv, "g4", "arq")
    os.makedirs(g_a)
    open(os.path.join(g_a, "rostos.db-wal"), "w").write("de outro banco")
    banco_teste(g_o, 5, True)
    move_rostos(g_o, g_a)
    la = sorted(os.listdir(g_a))
    pdb = [x for x in la if x.startswith("rostos.db.pos-") and not x.endswith(("-wal", "-shm"))]
    ok("rostos.db" not in la and len(pdb) == 1 and open(os.path.join(g_a, "rostos.db-wal")).read() == "de outro banco"
       and conta(os.path.join(g_a, pdb[0])) == (5, "ok"), "grupo: -wal sozinho no arquivo, o banco novo vai ao lado com os pares: %s" % la)
    # o mesmo dentro de uma pasta movida por entradas (_zerar_mover)
    g_o, g_a = os.path.join(mv, "g5", "home"), os.path.join(mv, "g5", "arq")
    banco_teste(g_a, 3, False)
    banco_teste(g_o, 5, True)
    n_g = m._zerar_mover(g_o, g_a)
    la = sorted(os.listdir(g_a))
    pdb = [x for x in la if x.startswith("rostos.db.pos-") and not x.endswith(("-wal", "-shm"))]
    ok(n_g == 3 and len(pdb) == 1 and la == sorted(["rostos.db", pdb[0], pdb[0] + "-wal", pdb[0] + "-shm"])
       and conta(os.path.join(g_a, "rostos.db")) == (3, "ok") and conta(os.path.join(g_a, pdb[0])) == (5, "ok"),
       "grupo: pasta com banco repetido, o grupo novo vai inteiro ao lado: n=%s %s" % (n_g, la))
    # desfazer: os .pos- ficam e o banco devolvido não herda o -wal do banco que está no lugar
    g_h, g_p = os.path.join(mv, "g5", "lugar"), os.path.join(mv, "g5", "pos-zeragem")
    banco_teste(g_h, 5, True)
    for solto in (False, True):
        if solto:
            g_a, g_h, g_p = os.path.join(mv, "g6", "arq"), os.path.join(mv, "g6", "lugar"), os.path.join(mv, "g6", "pos-zeragem")
            banco_teste(g_a, 3, False)
            banco_teste(g_h, 5, True)
            open(os.path.join(g_a, "rostos.db.pos-20261124-230000-wal"), "w").write("fica")
        nv = m._zerar_volta(g_a, g_h, g_p, soltos=solto)
        ok(nv == 1 and sorted(os.listdir(g_h)) == ["rostos.db"] and conta(os.path.join(g_h, "rostos.db")) == (3, "ok")
           and sorted(os.listdir(g_p)) == ["rostos.db", "rostos.db-shm", "rostos.db-wal"] and conta(os.path.join(g_p, "rostos.db")) == (5, "ok")
           and all(m._re_zerar_pos.search(x) for x in os.listdir(g_a)) and len(os.listdir(g_a)) == 1,
           "grupo: desfazer (soltos=%s) devolve o banco sem par trocado: n=%s lugar=%s pos=%s arq=%s"
           % (solto, nv, sorted(os.listdir(g_h)), sorted(os.listdir(g_p)) if os.path.isdir(g_p) else None, sorted(os.listdir(g_a))))
    # desfazer: o que foi ao lado fica no arquivo
    volta = os.path.join(mv, "volta")
    nv = m._zerar_volta(dst, volta, os.path.join(mv, "pos-zeragem"))
    ok(nv == 3 and sorted(os.listdir(volta)) == ["2026-11-24.json", "2026-11-25.json", "gal1"] and sorted(os.listdir(dst)) == pos,
       "desfazer: os .pos- ficam no arquivo: %s %s" % (sorted(os.listdir(volta)), sorted(os.listdir(dst))))
    # testador 24/11: o zerar-falhou.json sempre com passo e motivo legíveis, mesmo sem espaço para o .tmp
    import errno as _errno
    ok(m._zerar_codigo(OSError(_errno.ENOSPC, "x")) == "disco_cheio" and m._zerar_codigo(PermissionError(_errno.EACCES, "x")) == "sem_escrita"
       and m._zerar_codigo(OSError(_errno.EXDEV, "x")) == "outro_disco" and m._zerar_codigo(m.ZerarErro("sem_escrita")) == "sem_escrita",
       "motivo: erros do disco viram códigos legíveis")
    for f in (m.ZERAR_FALHOU, m.ZERAR_ANDA):
        if os.path.exists(f):
            os.remove(f)
    json.dump({"id": "fase-teste-20261124-2303", "por": "admin-zr", "tentativas": 2, "t": 1, "ip": "127.0.0.1"}, open(m.ZERAR_ANDA, "w"))
    real_gp = m._grava_privado

    def cheio(path, data):
        open(path + ".tmp", "w").close()
        raise OSError(_errno.ENOSPC, "No space left on device")
    m._grava_privado = cheio
    try:
        m._zerar_falhou("fase-teste-20261124-2303", "mover_nvme", "disco_cheio", "admin-zr")
    finally:
        m._grava_privado = real_gp
    fz = json.load(open(m.ZERAR_FALHOU)) if os.path.exists(m.ZERAR_FALHOU) else {}
    ok(fz.get("passo") == "mover_nvme" and fz.get("motivo") == "disco_cheio" and fz.get("id") == "fase-teste-20261124-2303" and "tentativas" not in fz
       and not os.path.exists(m.ZERAR_ANDA) and not os.path.exists(m.ZERAR_FALHOU + ".tmp"),
       "disco cheio: zerar-falhou.json reescrito no lugar com passo e motivo: %s" % fz)
    pv_f = m.zerar_previa().get("falha") or {}
    ok(pv_f.get("passo") == "mover_nvme" and pv_f.get("motivo") == "disco_cheio", "disco cheio: a prévia leva passo e motivo: %s" % pv_f)
    os.remove(m.ZERAR_FALHOU)
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-1500:])
finally:
    para()

print(("OK" if not falhas else "FALHA") + " zerar_fase_teste_agente: prévia, recusas, sem supervisor, vencido, espaço, parada e retomada, arquivo, o que fica,"
      " cartões, série diária, telas vazias, permissões, desfazer, 3 tentativas e partida sem laço" + ("" if not falhas else " · " + " | ".join(falhas)))
sys.exit(1 if falhas else 0)
