# 26/11 (plano docs/planos/2026-11-26-montagens-ia-curadoria.md): Curadoria › Montagens de IA no servidor do ponto.
# Agente de verdade num servidor local, com sessões, bases de IA e prévias de montagem inventadas (nenhuma foto de visitante):
#   1 quem pode (sem sessão 401, sem o módulo 403, qualidade.r lê e não grava, qualidade.u grava, "ver como" não grava)
#   2 a lista do dia (só o que tem prévia em disco, preferida, nota, contadores, paginação, dia fora da guarda, dia inválido)
#   3 a prévia (só a pronta; nunca põe montagem na fila; 404 igual para tudo que não existe)
#   4 a nota (boa, ruim com motivos, trocar, desfazer, idem não duplica, pid, fundo, motivos e corpo inválidos, sem montagem)
#   5 quem e quando vêm da sessão; versões gravadas; o console não imprime pid; LGPD apaga
#   HOME=$(mktemp -d) ETERNA_RECORTES_PISO_GB=0.5 python3 -I testes/montagens_ia_agente.py agente/eterna-agente.py
import http.client, importlib.util, io, json, os, shutil, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_MONTAGEM"):
    os.environ.pop(k, None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
falhas, num = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)


JPEG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffd9")
_n = [0]


def foto():
    _n[0] += 1
    pid = "%012x" % (0x2b0000000000 + _n[0])
    f = os.path.join(m.THUMBS, pid + ".jpg")
    with open(f, "wb") as fh:
        fh.write(JPEG)
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"o": "x", "s": "ftp", "u": time.time()}
    return pid


def sessao(card, fotografo, fotos, ia, t, dia):
    with m.sess_lock:
        m.sess[card] = {"card": card, "dia": dia, "status": "fechada", "fotos": list(fotos), "pend": [], "dec": {}, "removida": False,
                        "fotografo": fotografo, "ia": list(ia), "ia_regra": {}, "cap1": t, "ultima_chegada": t, "_t": {}}
        for p in fotos:
            m.sess_pid[p] = card


def previa(pid, fundo, marca=b""):
    a = m.mtg_arquivo(pid, fundo, "p", m.mtg_versao(fundo))
    os.makedirs(os.path.dirname(a), exist_ok=True)
    with open(a, "wb") as fh:
        fh.write(JPEG + marca)
    return a


def linhas(tab, pid):
    with m.treino_lock:
        db = m.treino_db()
        try:
            return db.execute("select * from %s where pid = ?" % tab, (pid,)).fetchall()
        finally:
            db.close()


try:
    for d in (m.THUMBS, m.APP_CACHE_DIR, m.MONTAGENS):
        os.makedirs(d, exist_ok=True)
    for f in m.MTG_FUNDOS.values():
        for rel in (f["previa"], f["hi"]):
            if not os.path.isfile(m.app_disco(rel)):
                shutil.copyfile(os.path.join(RAIZ, rel), m.app_disco(rel))
    V = {f: m.mtg_versao(f) for f in m.MTG_ATIVOS}
    ok(all(V.values()), "preparo: versão de cada fundo ativo: %r" % V)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    R, RU = {"r": True}, {"r": True, "u": True}
    adm = S.cookie_sessao(m, "admin-mn")
    sup = S.cookie_sessao(m, "supervisora-mn", {"qualidade": RU})
    m.estado_gravar({"docs": [{"col": "usuarios", "id": "supervisora-mn", "valor": {"v": 2, "email": "supervisora-mn", "name": "Sandra Teste", "active": True,
                                                                               "preset": "custom", "perms": {"qualidade": RU}}}]})
    ver = S.cookie_sessao(m, "leitora-mn", {"qualidade": R})
    fot = S.cookie_sessao(m, "fotografo-mn", {"set": {"r": True, "c": True}})
    vend = S.cookie_sessao(m, "venda-mn", {"venda": {"c": True, "r": True, "u": True}})
    so_ver = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("supervisora-mn", por="admin-mn"))
    posto = S.cookie_posto(m, "Checkout de teste")

    def pede(metodo, rota, corpo=None, cookie=None, extra=None, bruto=None):
        m._janelas.clear()
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        h.update(extra or {})
        h = {k: v for k, v in h.items() if v is not None}
        corpo_b = bruto if bruto is not None else (json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None)
        c.request(metodo, rota, corpo_b, h)
        r = c.getresponse()
        b_ = r.read()
        hs = {k.lower(): v for k, v in r.getheaders()}
        c.close()
        try:
            return r.status, json.loads(b_ or b"{}"), hs
        except ValueError:
            return r.status, b_, hs

    _i = [0]

    def idem():
        _i[0] += 1
        return "teste-mn-%06d" % _i[0]

    def nota(pid, fundo, v, motivos=None, cookie=sup, **k):
        corpo = {"pid": pid, "fundo": fundo, "v": v, "idem": k.pop("idem", None) or idem()}
        if motivos is not None:
            corpo["motivos"] = motivos
        corpo.update(k)
        return pede("POST", "/montagens/nota", corpo, cookie=cookie)[:2]

    hoje = m._ff_hoje()
    ontem = m._ff_hoje(time.time() - 86400)
    velho = m._ff_hoje(time.time() - (m.MTG_DIAS + 3) * 86400)
    agora = time.time()
    a1, a2, a3, b1, b2, c1, o1 = [foto() for _ in range(7)]
    sessao("LPMN01", "marcio", [a1, a2, a3], [a1, a2], agora - 600, hoje)
    sessao("LPMN02", "yago", [b1, b2], [b1], agora - 60, hoje)
    sessao("LPMN03", "yago", [c1], [], agora - 30, hoje)               # sem base de IA: fora
    sessao("LPMN04", "marcio", [o1], [o1], agora - 86400, ontem)
    for f in m.MTG_ATIVOS:
        previa(a1, f)
    previa(a2, "telao", b"a2")
    previa(b1, "tunel")
    previa(a3, "telao")                                                # não é base: fora da lista
    previa(o1, "arq1950")
    fila0 = m.mtg_fila.qsize()

    # ---------- 1: quem pode ----------
    st, r, _ = pede("GET", "/montagens/dia")
    ok(st == 401, "1: lista sem sessão = 401: %s" % st)
    st, r, _ = pede("GET", "/montagens/previa/%s/telao.jpg" % a1)
    ok(st == 401, "1: prévia sem sessão = 401: %s" % st)
    st, r, _ = pede("POST", "/montagens/nota", {"pid": a1, "fundo": "telao", "v": "boa", "idem": idem()})
    ok(st == 401, "1: nota sem sessão = 401: %s" % st)
    for nome, ck in (("fotógrafo", fot), ("venda", vend)):
        ok(pede("GET", "/montagens/dia", cookie=ck)[0] == 403 and pede("GET", "/montagens/previa/%s/telao.jpg" % a1, cookie=ck)[0] == 403
           and nota(a1, "telao", "boa", cookie=ck)[0] == 403, "1: %s sem o módulo qualidade = 403" % nome)
    ok(pede("GET", "/montagens/dia", cookie=posto)[0] == 401 and pede("GET", "/montagens/previa/%s/telao.jpg" % a1, cookie=posto)[0] == 401,
       "1: posto pareado não lê (rota da equipe)")
    st, r = nota(a1, "telao", "boa", cookie=ver)
    ok(st == 403 and r.get("erro") == "sem_permissao", "1: qualidade.r não grava: %s %r" % (st, r))
    ok(pede("GET", "/montagens/dia", cookie=ver)[0] == 200 and pede("GET", "/montagens/previa/%s/telao.jpg" % a1, cookie=ver)[0] == 200, "1: qualidade.r lê a lista e a prévia")
    st, r = nota(a1, "telao", "boa", cookie=so_ver)
    ok(st == 403 and r.get("erro") == "so_ver", "1: ver como não grava: %s %r" % (st, r))
    st, r, _ = pede("POST", "/montagens/nota", {"pid": a1, "fundo": "telao", "v": "boa", "idem": idem()}, cookie=sup, extra={"X-Eterna": None})
    ok(st == 403, "1: POST sem X-Eterna = 403: %s" % st)
    st, r, _ = pede("GET", "/montagens/dia", cookie=adm, extra={"Origin": "https://outro.exemplo"})
    ok(st == 403, "1: outra origem = 403: %s" % st)
    ok(not linhas("mtg_nota", a1) and not linhas("mtg_nota_log", a1), "1: nenhuma recusa gravou")

    # ---------- 2: a lista ----------
    st, j, hs = pede("GET", "/montagens/dia", cookie=ver)
    its = j.get("itens") or []
    chaves = [(x["pid"], x["fundo"]) for x in its]
    esperado = [(b1, "tunel")] + [(a1, f) for f in m.MTG_ATIVOS] + [(a2, "telao")]
    ok(st == 200 and j.get("dia") == hoje and chaves == esperado and hs.get("cache-control") == "no-store",
       "2: só as prontas, da sessão mais nova para a mais antiga: %s %r" % (st, chaves))
    por = {(x["pid"], x["fundo"]): x for x in its}
    x = por.get((a1, "telao")) or {}
    ok(x.get("sessao") == "LPMN01" and x.get("fotografo") == "marcio" and x.get("hora") == time.strftime("%H:%M", time.localtime(agora - 600))
       and x.get("nota") is None and x.get("vendida") in (False, None), "2: sessão, fotógrafo, hora e sem nota: %r" % x)
    ok(por[(a1, "arq1950")]["preferida"] is True and por[(a1, "telao")]["preferida"] is False and por[(a2, "telao")]["preferida"] is True
       and por[(b1, "tunel")]["preferida"] is True, "2: a base preferida de cada fundo")
    ok(j.get("n") == {"prontas": 6, "sem_nota": 6, "boas": 0, "ruins": 0} and j.get("total") == 6 and j.get("mais") is False and j.get("motivo") is None
       and j.get("motivos") == list(m.MN_MOTIVOS) and j.get("fundos") == list(m.MTG_ATIVOS) and j.get("modo") == "desligada", "2: contadores e listas fixas: %r" % {k: j.get(k) for k in ("n", "total", "mais", "motivo", "modo")})
    st, j2, _ = pede("GET", "/montagens/dia?dia=" + ontem, cookie=ver)
    ok(st == 200 and [(x["pid"], x["fundo"]) for x in j2.get("itens") or []] == [(o1, "arq1950")], "2: ontem pelo filtro: %s %r" % (st, j2.get("itens")))
    st, j2, _ = pede("GET", "/montagens/dia?dia=" + velho, cookie=ver)
    ok(st == 200 and j2.get("itens") == [] and j2.get("motivo") == "guarda" and j2.get("guarda_dias") == m.MTG_DIAS, "2: dia fora da guarda: lista vazia com o motivo: %r" % j2)
    st, j2, _ = pede("GET", "/montagens/dia?dia=" + m._ff_hoje(time.time() + 3 * 86400), cookie=ver)
    ok(st == 200 and j2.get("itens") == [] and j2.get("motivo") == "futuro", "2: dia futuro: %r" % j2.get("motivo"))
    for ruim in ("26-11-2026", "2026-11-26x", "..%2F..", ""):
        st, j2, _ = pede("GET", "/montagens/dia?dia=" + ruim, cookie=ver)
        ok((st == 400 and j2.get("error") == "dia") or (ruim == "" and st == 200), "2: dia inválido %r = 400: %s" % (ruim, st))
    ok(pede("GET", "/montagens/dia?de=-1", cookie=ver)[0] == 400 and pede("GET", "/montagens/dia?de=abc", cookie=ver)[0] == 400, "2: de inválido = 400")
    real_max = m.MN_ITENS_MAX
    m.MN_ITENS_MAX = 4
    st, p1, _ = pede("GET", "/montagens/dia", cookie=ver)
    st, p2, _ = pede("GET", "/montagens/dia?de=4", cookie=ver)
    m.MN_ITENS_MAX = real_max
    ok(len(p1["itens"]) == 4 and p1["mais"] is True and p1["total"] == 6 and len(p2["itens"]) == 2 and p2["mais"] is False
       and [(x["pid"], x["fundo"]) for x in p1["itens"] + p2["itens"]] == esperado and p1["n"]["prontas"] == 6, "2: paginação simples (de)")
    # sem nenhuma montagem: o motivo diz se a chave está desligada ou se só ainda não há
    with m.sess_lock:
        guard = dict(m.sess)
        m.sess.clear()
    st, j2, _ = pede("GET", "/montagens/dia", cookie=ver)
    ok(j2.get("itens") == [] and j2.get("motivo") == "desligada", "2: vazio com a chave desligada: %r" % j2.get("motivo"))
    m.estado_gravar({"docs": [{"col": "config", "id": "montagem", "valor": {"modo": "sombra"}}]}, quem="teste")
    m._mtg_cfg["t"] = 0
    st, j2, _ = pede("GET", "/montagens/dia", cookie=ver)
    ok(j2.get("itens") == [] and j2.get("motivo") == "nenhuma" and j2.get("modo") == "sombra", "2: vazio em sombra: %r %r" % (j2.get("motivo"), j2.get("modo")))
    with m.sess_lock:
        m.sess.update(guard)

    # ---------- 3: a prévia ----------
    st, b_, hs = pede("GET", "/montagens/previa/%s/telao.jpg" % a2, cookie=ver)
    ok(st == 200 and b_ == JPEG + b"a2" and hs.get("content-type") == "image/jpeg" and hs.get("cache-control") == "private, no-store"
       and hs.get("x-content-type-options") == "nosniff", "3: a prévia pronta: %s %r" % (st, hs))
    ok(pede("GET", "/montagens/previa/ag_%s/telao.jpg" % a2, cookie=ver)[0] == 200, "3: aceita o id com ag_")
    nf = [pede("GET", r_, cookie=ver)[:2] for r_ in ("/montagens/previa/%s/tunel.jpg" % a2, "/montagens/previa/%s/naoexiste.jpg" % a2,
                                                    "/montagens/previa/ffffffffffff/telao.jpg", "/montagens/previa/..%2F..%2Fx/telao.jpg",
                                                    "/montagens/previa/%s/telao.png" % a2, "/montagens/previa/%s/telao.jpg/x" % a2)]
    ok(all(st_ == 404 and r_ == {"error": "not found"} for st_, r_ in nf), "3: o que não existe responde o mesmo 404: %r" % nf)
    with m.mtg_lock:
        jobs = len(m.mtg_jobs)
    ok(m.mtg_fila.qsize() == fila0 and jobs == 0, "3: ler a lista e a prévia nunca põe montagem na fila")

    # ---------- 4 e 5: a nota ----------
    for corpo, campo in (({"pid": "../x", "fundo": "telao", "v": "boa", "idem": idem()}, "pid"),
                         ({"pid": a1, "fundo": "naoexiste", "v": "boa", "idem": idem()}, "fundo"),
                         ({"pid": a1, "fundo": ["telao"], "v": "boa", "idem": idem()}, "fundo"),
                         ({"pid": a1, "fundo": "telao", "v": "otima", "idem": idem()}, "v"),
                         ({"pid": a1, "fundo": "telao", "idem": idem()}, "v"),
                         ({"pid": a1, "fundo": "telao", "v": "ruim", "motivos": ["feia"], "idem": idem()}, "motivos"),
                         ({"pid": a1, "fundo": "telao", "v": "ruim", "motivos": ["luz", "luz"], "idem": idem()}, "motivos"),
                         ({"pid": a1, "fundo": "telao", "v": "ruim", "motivos": "luz", "idem": idem()}, "motivos"),
                         ({"pid": a1, "fundo": "telao", "v": "boa", "motivos": ["luz"], "idem": idem()}, "motivos"),
                         ({"pid": a1, "fundo": "telao", "v": "boa"}, "idem"),
                         ({"pid": a1, "fundo": "telao", "v": "boa", "idem": "x y"}, "idem"),
                         ({"pid": a1, "fundo": "telao", "v": "boa", "idem": idem(), "por": "outra@exemplo.com"}, "campo")):
        st, r, _ = pede("POST", "/montagens/nota", corpo, cookie=sup)
        ok(st == 400 and r.get("error") == campo, "4: %s inválido = 400: %s %r" % (campo, st, r))
    st, r, _ = pede("POST", "/montagens/nota", bruto=json.dumps({"pid": a1, "fundo": "telao", "v": "boa", "idem": idem(), "x": "a" * 1100}).encode(), cookie=sup)
    ok(st in (400, 413), "4: corpo acima de 1 KB: %s" % st)
    st, r, _ = pede("POST", "/montagens/nota", bruto=b"[1]", cookie=sup)
    ok(st == 400, "4: corpo que não é objeto: %s" % st)
    st, r = nota("ffffffffffff", "telao", "boa")
    nf1 = (st, r)
    nf2 = nota(a2, "tunel", "boa")                                     # montagem que não está pronta
    nf3 = nota(a3, "telao", "boa")                                     # tem arquivo, mas a foto não é base de IA de nenhuma sessão
    ok(nf1 == nf2 == nf3 == (404, {"ok": False, "error": "montagem"}), "4: foto, montagem ou base que não existe: o mesmo 404: %r %r %r" % (nf1, nf2, nf3))
    st, r = nota(a1, "telao", "boa", fundo_v="xyz")
    ok(st == 400 and r.get("error") == "fundo_v", "4: fundo_v fora do formato = 400: %s %r" % (st, r))
    st, r = nota(a1, "telao", "boa", fundo_v="00000000")
    ok(st == 409 and r.get("error") == "versao", "4: a tela viu outra versão da montagem = 409: %s %r" % (st, r))
    ok(not linhas("mtg_nota", a1) and not linhas("mtg_nota", a2), "4: nenhuma recusa gravou")

    out = io.StringIO()
    velho_out, sys.stdout = sys.stdout, out
    try:
        i1 = idem()
        st, r = nota(a1, "telao", "boa", idem=i1, fundo_v=V["telao"])     # com a versão que a tela viu
        st_b, r_b = nota(a1, "telao", "boa", idem=i1)                   # o mesmo idem de novo
        st_c, r_c = nota("ag_" + a1, "telao", "boa")                    # a mesma nota da mesma pessoa
    finally:
        sys.stdout = velho_out
    n1 = r.get("nota") or {}
    ok(st == 200 and r.get("ok") and n1.get("v") == "boa" and n1.get("motivos") == [] and n1.get("por") == "supervisora-mn" and n1.get("nome") == "Sandra Teste"
       and n1.get("atual") is True and n1.get("em"), "4: boa gravada com quem e quando da sessão: %s %r" % (st, r))
    ok(st_b == 200 and r_b.get("igual") is True and st_c == 200 and r_c.get("igual") is True and len(linhas("mtg_nota_log", a1)) == 1 and len(linhas("mtg_nota", a1)) == 1,
       "4: idem repetido e nota igual não duplicam: %r %r %d" % (r_b, r_c, len(linhas("mtg_nota_log", a1))))
    # o mesmo idem em outra foto, outro fundo ou de outra pessoa não passa por repetição
    r_i = [nota(a2, "telao", "boa", idem=i1), nota(a1, "tunel", "boa", idem=i1), nota(a1, "telao", "boa", idem=i1, cookie=adm)]
    ok(all(x == (409, {"ok": False, "error": "idem"}) for x in r_i) and not linhas("mtg_nota", a2) and len(linhas("mtg_nota_log", a1)) == 1,
       "4: idem repetido com outra foto, fundo ou pessoa = 409, sem gravar: %r" % r_i)
    ok(a1 not in out.getvalue() and "supervisora-mn" in out.getvalue() and "boa" in out.getvalue(), "5: auditoria no console sem pid: %r" % out.getvalue())
    linha = linhas("mtg_nota", a1)[0]
    dd = json.loads(linha[5])
    ok(linha[2] == hoje and dd.get("mtg") == m.MTG_VERSAO and dd.get("rec") == m.REC_VERSAO and dd.get("fundo_v") == V["telao"] and dd.get("pref") is False
       and dd.get("sessao") == "LPMN01" and dd.get("fotografo") == "marcio", "5: dia, versões da montagem e do recorte, sessão: %r" % (linha,))
    # outra pessoa troca para ruim com motivos (na ordem fixa)
    st, r = nota(a1, "telao", "ruim", ["luz", "pequena"], cookie=adm)
    n2 = r.get("nota") or {}
    ok(st == 200 and n2.get("v") == "ruim" and n2.get("motivos") == ["pequena", "luz"] and n2.get("por") == "admin-mn" and not r.get("igual"), "4: trocar para ruim com motivos: %s %r" % (st, r))
    st, r = nota(a1, "telao", "ruim", ["corte"], cookie=adm)
    ok(st == 200 and r["nota"]["motivos"] == ["corte"] and len(linhas("mtg_nota", a1)) == 1 and len(linhas("mtg_nota_log", a1)) == 3, "4: trocar os motivos: %r" % r)
    st, r = nota(a1, "telao", "ruim", [], cookie=adm)
    ok(st == 200 and r["nota"]["v"] == "ruim" and r["nota"]["motivos"] == [], "4: ruim sem motivo é aceito: %r" % r)
    st, r = nota(a2, "telao", "boa")
    st, r = nota(b1, "tunel", "ruim", list(m.MN_MOTIVOS))
    ok(st == 200 and r["nota"]["motivos"] == list(m.MN_MOTIVOS), "4: todos os motivos: %r" % r)
    st, j, _ = pede("GET", "/montagens/dia", cookie=ver)
    por = {(x["pid"], x["fundo"]): x for x in j["itens"]}
    ok(j["n"] == {"prontas": 6, "sem_nota": 3, "boas": 1, "ruins": 2} and por[(a1, "telao")]["nota"]["v"] == "ruim" and por[(a1, "telao")]["nota"]["por"] == "admin-mn"
       and por[(a2, "telao")]["nota"]["nome"] == "Sandra Teste" and por[(a1, "tunel")]["nota"] is None, "4: a lista volta com as notas e os contadores: %r" % j["n"])
    # desfazer
    st, r = nota(a2, "telao", None)
    ok(st == 200 and r.get("ok") and r.get("nota") is None and not r.get("igual") and not linhas("mtg_nota", a2) and len(linhas("mtg_nota_log", a2)) == 2, "4: desfazer: %s %r" % (st, r))
    st, r = nota(a2, "telao", None)
    ok(st == 200 and r.get("igual") is True and len(linhas("mtg_nota_log", a2)) == 2, "4: desfazer o que não tem nota: igual, sem gravar: %r" % r)
    st, r = nota(a2, "telao", None, ["luz"])
    ok(st == 400 and r.get("error") == "motivos", "4: desfazer com motivo = 400")
    st, j, _ = pede("GET", "/montagens/dia", cookie=ver)
    ok(j["n"] == {"prontas": 6, "sem_nota": 4, "boas": 0, "ruins": 2}, "4: contadores depois de desfazer: %r" % j["n"])
    # montagem refeita com outra versão: a nota fica e avisa que é de antes
    with m.treino_lock:
        db = m.treino_db()
        db.execute("update mtg_nota set dados = ? where pid = ? and fundo = ?", (json.dumps({"fundo_v": "00000000"}), b1, "tunel"))
        db.commit()
        db.close()
    st, j, _ = pede("GET", "/montagens/dia", cookie=ver)
    por = {(x["pid"], x["fundo"]): x for x in j["itens"]}
    ok(por[(b1, "tunel")]["nota"]["atual"] is False and por[(a1, "telao")]["nota"]["atual"] is True, "5: nota de versão anterior marcada (atual false)")
    ok(all(x.get("fundo_v") == V[x["fundo"]] for x in j["itens"]), "5: a lista leva a versão de cada montagem (fundo_v)")
    # a mesma pessoa confirma a mesma nota na montagem refeita: grava de novo, com a versão de agora
    n_log = len(linhas("mtg_nota_log", b1))
    st, r = nota(b1, "tunel", "ruim", list(m.MN_MOTIVOS), fundo_v=V["tunel"])
    ok(st == 200 and not r.get("igual") and r["nota"]["atual"] is True and len(linhas("mtg_nota_log", b1)) == n_log + 1
       and json.loads(linhas("mtg_nota", b1)[0][5]).get("fundo_v") == V["tunel"], "5: nota de montagem refeita é confirmada de novo (não responde igual): %s %r" % (st, r))
    st, r = nota(b1, "tunel", "ruim", list(m.MN_MOTIVOS))
    ok(st == 200 and r.get("igual") is True and len(linhas("mtg_nota_log", b1)) == n_log + 1, "5: depois de confirmada, a mesma nota volta a ser igual")
    # sessão de anteontem (já fora da memória): a nota lê a sessão e o fotógrafo do arquivo do dia
    ante = m._ff_hoje(time.time() - 2 * 86400)
    d1 = foto()
    with open(os.path.join(m.SESS_DIR, ante + ".json"), "w", encoding="utf8") as fh:
        json.dump({"dia": ante, "sessoes": [{"card": "LPMN09", "fotografo": "yago", "fotos": [d1], "ia": [d1], "ia_regra": {}, "cap1": agora - 2 * 86400, "removida": False}]}, fh)
    previa(d1, "telao")
    st, j, _ = pede("GET", "/montagens/dia?dia=" + ante, cookie=ver)
    ok([(x["pid"], x["fundo"], x["sessao"]) for x in j.get("itens") or []] == [(d1, "telao", "LPMN09")], "2: anteontem pelo arquivo do dia: %r" % j.get("itens"))
    st, r = nota(d1, "telao", "boa")
    ln = linhas("mtg_nota", d1)
    dd = json.loads(ln[0][5]) if ln else {}
    ok(st == 200 and ln and ln[0][2] == ante and dd.get("sessao") == "LPMN09" and dd.get("fotografo") == "yago" and dd.get("pref") is True,
       "5: nota em dia fora da memória grava o dia, a sessão e o fotógrafo do arquivo: %s %r" % (st, ln))
    # prazo: as notas mais antigas que RETENCAO_DIAS saem na limpeza da madrugada; as outras ficam
    antigo = m._ff_hoje(time.time() - (m.RETENCAO_DIAS + 2) * 86400)
    limite = m._ff_hoje(time.time() - (m.RETENCAO_DIAS - 1) * 86400)
    with m.treino_lock:
        db = m.treino_db()
        for p_, d_ in (("aaaaaaaaaaa1", antigo), ("aaaaaaaaaaa2", limite)):
            db.execute("insert into mtg_nota values (?,?,?,?,?,?,?,?)", (p_, "telao", d_, "boa", "", "{}", "supervisora-mn", d_ + "T10:00:00.000"))
            db.execute("insert into mtg_nota_log values (?,?,?,?,?,?,?,?)", (p_, "telao", "boa", "", "{}", "supervisora-mn", d_ + "T10:00:00.000", "prazo-" + p_))
        db.commit()
        db.close()
    n_ap = m.mn_limpa()
    ok(n_ap == 2 and not linhas("mtg_nota", "aaaaaaaaaaa1") and not linhas("mtg_nota_log", "aaaaaaaaaaa1") and linhas("mtg_nota", "aaaaaaaaaaa2")
       and linhas("mtg_nota_log", "aaaaaaaaaaa2") and linhas("mtg_nota", b1) and linhas("mtg_nota_log", a1), "6: a limpeza apaga só as notas além do prazo das fotos (%r)" % n_ap)
    ok("mn_limpa(" in __import__("inspect").getsource(m.lx_limpa_noite), "6: a limpeza das notas roda na limpeza da madrugada")
    # limite por minuto
    m._janelas.clear()
    with m.gal_lock:
        m._janelas[("u:supervisora-mn", "montagens_nota")] = [time.time()] * 120
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
    c.request("POST", "/montagens/nota", json.dumps({"pid": a1, "fundo": "tunel", "v": "boa", "idem": idem()}).encode(),
              {"Host": HOST, "Content-Type": "application/json", "X-Eterna": "1", "Cookie": sup})
    r_ = c.getresponse()
    r_.read()
    c.close()
    ok(r_.status == 429, "4: limite por minuto = 429: %s" % r_.status)
    # erro sem pid nem caminho
    real = m.mn_lista
    m.mn_lista = lambda d, de=0: (_ for _ in ()).throw(OSError(HOME + "/" + a1))
    out = io.StringIO()
    velho_out, sys.stdout = sys.stdout, out
    try:
        st, r, _ = pede("GET", "/montagens/dia", cookie=adm)
    finally:
        sys.stdout = velho_out
        m.mn_lista = real
    ok(st == 500 and HOME not in json.dumps(r) and a1 not in out.getvalue() and HOME not in out.getvalue(), "5: erro sem pid nem caminho: %r" % out.getvalue())
    # foto que saiu da biblioteca some da lista; LGPD apaga a nota e o registro
    ok(not m.treino_lgpd([a1]) or True, "")
    ok(not linhas("mtg_nota", a1) and not linhas("mtg_nota_log", a1) and linhas("mtg_nota", b1), "5: a exclusão LGPD apaga a nota e o registro só daquela foto")
    with m.lock:
        m.lib.pop(a1, None)
    st, j, _ = pede("GET", "/montagens/dia", cookie=ver)
    ok(a1 not in [x["pid"] for x in j["itens"]] and j["n"]["prontas"] == 2 and nota(a1, "telao", "boa") == (404, {"ok": False, "error": "montagem"}), "5: foto fora da biblioteca sai da lista: %r" % j["n"])
    num["notas"] = _i[0]
    srv.shutdown()
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1800:])
print(("OK" if not falhas else "FALHA") + " montagens_ia_agente: Curadoria › Montagens de IA no servidor (lista, prévia, nota, permissões, idem, desfazer) · %s" % json.dumps(num)
      + ("" if not falhas else " · " + " | ".join(falhas[:14])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
