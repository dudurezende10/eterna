# v97 (plano docs/planos/2026-11-10-recorte-birefnet-sessoes.md, E3): visitas no agente, critérios 18 a 33 (parte do agente)
# e a D4 (bases de IA por visita). Rostos sintéticos como no testes/sessoes_agente.py: pessoa = vetor unitário aleatório de
# 128 com semente fixa; rosto na foto = normaliza(base + ruído de norma 0,6). Nunca foto de convidado, sem OpenCV.
# Roda sozinho (testes/rodar.sh):  HOME=$(mktemp -d) python3 -I testes/visitas_agente.py agente/eterna-agente.py
import importlib.util, json, os, random, socket, sys, tempfile, threading, time, http.client

AG = sys.argv[1]
falhas, notas = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def porta_livre():
    for p in range(39000 + random.randint(0, 900), 39999):
        s = socket.socket()
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
    raise SystemExit("sem porta")


PORTA = porta_livre()
HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PORTA=str(PORTA))
for k in ("ETERNA_SESSAO_PAUSA", "ETERNA_SESS_LIMITES", "ETERNA_VIS_LIM", "ETERNA_ORIGENS"):
    os.environ.pop(k, None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
NOMES = ["carlos", "samuel", "marinara", "yago", "marcio", "klassius", "sandessa", "dudu"]
json.dump({"users": {n: "x" * 12 for n in NOMES}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
ok(m.VIS_LIM == 0.50 and m.VIS_JANELA == 3000 and m.VIS_LEVAS_MAX == 12 and m.VIS_ROSTOS_MAX == 15 and m.VIS_IDX_MAX == 4000, "constantes")
m.sess_rostos_on = lambda: True
rnd = random.Random(97)


def unit():
    v = [rnd.gauss(0, 1) for _ in range(128)]
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def norm(v):
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def rosto(base, larg=200, score=0.95, frontal=True, ruido=0.6):
    r = unit()
    return (larg, norm([b + ruido * x for b, x in zip(base, r)]), score, frontal)


_seq = [0]
HOJE = time.strftime("%Y-%m-%d")
T0 = time.mktime(time.strptime(HOJE + " 10:00:00", "%Y-%m-%d %H:%M:%S"))


def reset():
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info,
                  m.sess_faces_pid, m.sess_rostos_mem, m.ff_desvio, m.vis_arestas, m.vis_de, m.vis_info, m.vis_rostos):
            d.clear()
        m.sess_sujo.clear()
        m.vis_sujo.clear()
        m.vis_prot.clear()
        m.vis_idx.update(M=None, T=None, C=None, meta=[], w=0, n=0, cid={}, tmax=0.0)


def foto(o, u, faces, serie=""):
    """Uma foto do fotógrafo o com clique em u e os rostos lidos 1 s depois. Devolve (pid, card)."""
    _seq[0] += 1
    pid = "%012x" % (0xd00000000000 + _seq[0])
    md = {"o": o, "s": "ftp", "u": u, "cap": u}
    if serie:
        md["serie"] = serie
    with m.sess_lock:
        m._sess_add(pid, md, m.ff_cadastrados(), agora=u)
    m.sess_rostos_lidos(pid, faces, u + 1)
    m.sess_tick(u + 1)
    return pid, m.sess_pid.get(pid)


def leva(o, t, faces_por_foto, passo=10):
    pids = []
    card = None
    for i, fs in enumerate(faces_por_foto):
        p, card = foto(o, t + i * passo, fs)
        pids.append(p)
    return card, pids


def fecha(t):
    m.sess_tick(t)


def visita(card):
    with m.sess_lock:
        return sorted(m.vis_levas_de(card))


P = [unit() for _ in range(40)]

# ---------- 18: família de 4 em 3 fotógrafos (25 min) -> 1 visita; 19: filho sozinho entra pela corrente ----------
reset()
mae, pai, filha, filho = P[0], P[1], P[2], P[3]
A, pa = leva("carlos", T0, [[rosto(mae), rosto(pai)], [rosto(mae), rosto(pai), rosto(filha)]])
fecha(T0 + 200)
B, pb = leva("samuel", T0 + 600, [[rosto(filha), rosto(filho)], [rosto(filho), rosto(pai)]])
fecha(T0 + 800)
C, pc = leva("marinara", T0 + 1500, [[rosto(mae), rosto(filho)], [rosto(filha)]])
fecha(T0 + 1700)
D, pd = leva("yago", T0 + 1600, [[rosto(filho)], [rosto(filho)]])      # 19: o filho sozinho com o 4º fotógrafo
fecha(T0 + 1800)
todas = sorted({m.sess_pid[p] for p in pa + pb + pc + pd})   # a filha sozinha na leva C abre leva nova (rostos novos)
ok(len({A, B, C, D}) == 4 and len(todas) >= 4, "18: levas de fotógrafos diferentes: %r" % todas)
ok(visita(A) == todas, "18/19: uma visita com todas as levas da família (o filho sozinho pela corrente): %r %r" % (visita(A), todas))
vf = m.vis_feed()
ok(len(vf["visitas"]) == 1 and sorted(vf["visitas"][0]["levas"]) == todas and vf["visitas"][0]["id"].startswith("V")
   and set(vf["visitas"][0]) == {"id", "levas", "rev", "inicio", "fim", "grande", "separadas"}, "contrato do /visitas (sem pid e sem sim): %r" % vf)
ok(m.vis_feed(vf["rev"]) == {"ok": True, "rev": vf["rev"], "igual": True, "visitas": []}, "desde=rev sem mudança: lista vazia")
st = m.sess_status()["visitas"]
ok(st["n"] == 1 and st["ligacoes_rosto"] >= 3 and "ms_ultimo" in st and "barradas" in st, "/status.sessoes.visitas: %r" % st)

# ---------- 20: família B pequena ao fundo (< 0,5 do maior) e rosto pequeno (< 60 px) não liga ----------
reset()
fa1, fa2, fb1 = P[4], P[5], P[6]
A, _ = leva("carlos", T0, [[rosto(fa1), rosto(fa2), rosto(fb1, larg=80)], [rosto(fa1), rosto(fb1, larg=90)]])
B, _ = leva("samuel", T0 + 120, [[rosto(fb1)], [rosto(fb1)]])
C, _ = leva("marinara", T0 + 240, [[rosto(fa2, larg=50)], [rosto(fa2, larg=55)]])   # rosto de A, mas pequeno (< 60 px)
fecha(T0 + 600)
ok(visita(A) == [A] and visita(B) == [B] and visita(C) == [C], "20: fundo pequeno e rosto < 60 px não ligam: %r" % [visita(A), visita(B), visita(C)])
# score baixo ou perfil também não
D, _ = leva("yago", T0 + 300, [[rosto(fa1, score=0.7)], [rosto(fa1, frontal=False)]])
fecha(T0 + 700)
ok(visita(D) == [D], "rosto de score baixo ou de perfil não liga: %r" % visita(D))

# ---------- 21: foto sem rosto fica na leva (e entra com a visita) ----------
reset()
A, pa = leva("carlos", T0, [[rosto(P[7])], [], [rosto(P[7])]])        # a 2ª de costas
B, _ = leva("samuel", T0 + 300, [[rosto(P[7])]])
fecha(T0 + 900)
with m.sess_lock:
    fa = list(m.sess[A]["fotos"])
ok(pa[1] in fa and visita(A) == sorted([A, B]), "21: foto sem rosto fica na leva da visita: %r" % [fa, visita(A)])

# ---------- 22: duas famílias no mesmo minuto, rostos diferentes -> 2 visitas ----------
reset()
A, _ = leva("carlos", T0, [[rosto(P[8]), rosto(P[9])]] * 2)
B, _ = leva("samuel", T0 + 5, [[rosto(P[10]), rosto(P[11])]] * 2)
C, _ = leva("marinara", T0 + 400, [[rosto(P[8])]])
D, _ = leva("yago", T0 + 400, [[rosto(P[11])]])
fecha(T0 + 900)
ok(visita(A) == sorted([A, C]) and visita(B) == sorted([B, D]), "22: duas visitas separadas: %r" % [visita(A), visita(B)])

# ---------- 23: corrente fora da janela (51 min) não entra (barrada) ----------
reset()
A, _ = leva("carlos", T0, [[rosto(P[12])]])
B, _ = leva("samuel", T0 + 1800, [[rosto(P[12])]])
C, _ = leva("marinara", T0 + 51 * 60, [[rosto(P[12])]])
fecha(T0 + 4000)
with m.sess_lock:
    bar = [e.get("barrada") for e in m.vis_arestas[HOJE]]
ok(visita(A) == sorted([A, B]) and visita(C) == [C] and "janela" in bar, "23: 51 min depois não entra (janela): %r %r" % (visita(A), bar))

# ---------- 24: limiar exato ----------
reset()
def eixo(i):
    v = [0.0] * 128
    v[i] = 1.0
    return v


def mistura(s, i):
    return [s * a + (1 - s * s) ** 0.5 * b for a, b in zip(eixo(0), eixo(i))]


A, _ = leva("carlos", T0, [[(200, eixo(0), 0.95, True)]])
B, _ = leva("samuel", T0 + 60, [[(200, mistura(0.49, 1), 0.95, True)]])
C, _ = leva("marinara", T0 + 120, [[(200, mistura(0.50, 2), 0.95, True)]])
fecha(T0 + 600)
ok(visita(B) == [B] and C in visita(A), "24: 0,49 não liga, 0,50 liga: %r %r" % (visita(A), visita(B)))

# ---------- 25: teto de 12 levas e de 15 rostos ----------
reset()
comum = P[13]
cards = []
for i in range(13):
    c, _ = leva(NOMES[i % 8], T0 + i * 100 + (i // 8) * 7, [[rosto(comum)]])
    cards.append(c)
    fecha(T0 + i * 100 + 70)
fecha(T0 + 2000)
ok(len(set(cards)) == 13, "25: 13 levas: %r" % len(set(cards)))
v1 = visita(cards[0])
with m.sess_lock:
    vi = m.vis_info.get(m.vis_de.get(cards[0]) or "") or {}
    bar = [e.get("barrada") for e in m.vis_arestas[HOJE]]
ok(len(v1) == 12 and vi.get("grande") and "levas" in bar, "25: a 13ª leva não liga e a visita é grande: %r %r %r" % (len(v1), vi.get("grande"), bar))
reset()
fam = P[14:30]                                   # 16 pessoas
A, _ = leva("carlos", T0, [[rosto(f) for f in fam[0:5]], [rosto(fam[0])] + [rosto(f) for f in fam[5:9]],
                            [rosto(fam[0])] + [rosto(f) for f in fam[9:13]], [rosto(fam[0]), rosto(fam[13]), rosto(fam[14])]])
B, _ = leva("samuel", T0 + 300, [[rosto(fam[0]), rosto(fam[15])]])
fecha(T0 + 900)
with m.sess_lock:
    vi = m.vis_info.get(m.vis_de.get(A) or "") or {}
    bar = [e.get("barrada") for e in m.vis_arestas[HOJE]]
ok(visita(A) == [A] and visita(B) == [B] and "rostos" in bar, "25: o 16º rosto não liga: %r %r" % (visita(A), bar))
ok(any(v.get("grande") for v in m.vis_info.values()), "25: visita grande marcada mesmo sozinha: %r" % list(m.vis_info.values()))

# ---------- 26: escola ou menor só liga por Juntar ----------
reset()
A, _ = leva("carlos", T0, [[rosto(P[30])]])
m.vis_protege({A})
B, _ = leva("samuel", T0 + 120, [[rosto(P[30])]])
fecha(T0 + 600)
with m.sess_lock:
    bar = [e.get("barrada") for e in m.vis_arestas[HOJE]]
ok(visita(A) == [A] and "escola_menor" in bar, "26: leva de escola não liga por rosto: %r %r" % (visita(A), bar))
r, cod = m.vis_acao("juntar", {"a": A, "b": B, "por": "Ana", "posto": "Caixa 1"}, "127.0.0.1")
ok(cod == 200 and visita(A) == sorted([A, B]) and sorted(r["visita"]["levas"]) == sorted([A, B]), "26: Juntar liga a leva de escola: %r" % (r,))

# ---------- 27 e 28: Juntar sem rosto; Separar; foto nova não religa; Juntar de novo desfaz ----------
reset()
A, _ = leva("carlos", T0, [[rosto(P[31])]])
B, _ = leva("samuel", T0 + 120, [[rosto(P[32])]])
fecha(T0 + 400)
ok(visita(A) == [A], "27: sem rosto em comum, separadas")
r, cod = m.vis_acao("juntar", {"a": A, "b": B, "por": "Ana", "posto": "Caixa 1"}, "127.0.0.1")
ok(cod == 200 and visita(A) == sorted([A, B]), "27: Juntar sem rosto em comum: %r" % (r,))
linhas = [json.loads(l) for l in open(m.VIS_LOG)]
ok(linhas and linhas[-1]["acao"] == "juntar" and linhas[-1]["por"] == "Ana" and linhas[-1]["posto"] == "Caixa 1" and sorted(linhas[-1]["para"]) == sorted([A, B])
   and "sim" not in linhas[-1] and oct(os.stat(m.VIS_LOG).st_mode & 0o777) == "0o600", "27: linha no visitas-log.jsonl (600): %r" % linhas[-1:])
reset()
fam = P[33]
A, _ = leva("carlos", T0, [[rosto(fam)]])
B, _ = leva("samuel", T0 + 120, [[rosto(fam)]])
C, _ = leva("marinara", T0 + 200, [[rosto(fam)]])
fecha(T0 + 600)
ok(visita(A) == sorted([A, B, C]), "28: começa com 3 levas: %r" % visita(A))
r, cod = m.vis_acao("separar", {"card": C, "por": "Ana", "posto": "Caixa 1"}, "127.0.0.1")
ok(cod == 200 and visita(C) == [C] and visita(A) == sorted([A, B]) and r["nova"]["levas"] == [C] and sorted(r["visita"]["levas"]) == sorted([A, B]),
   "28: Separar tira a leva: %r" % (r,))
with m.sess_lock:
    vi = m.vis_info.get(m.vis_de.get(A) or "") or {}
ok(C in vi.get("separadas", []), "28: a visita lista a separada: %r" % vi)
# foto nova com o mesmo rosto na leva separada (ainda aberta? não: nova leva do marinara religaria pela corrente) e na mesma leva
D, _ = leva("yago", T0 + 300, [[rosto(fam)]])
fecha(T0 + 700)
ok(C not in visita(A) and D in visita(A), "28: foto nova com o mesmo rosto não religa a separada: %r" % visita(A))
r, cod = m.vis_acao("juntar", {"a": C, "b": A, "por": "Ana", "posto": "Caixa 1"}, "127.0.0.1")
ok(cod == 200 and visita(A) == sorted([A, B, C, D]), "28: Juntar de novo desfaz: %r" % visita(A))
# inválidos
ok(m.vis_acao("juntar", {"a": A, "b": "LPNAOEXISTE"}, "127.0.0.1")[1] == 400 and m.vis_acao("separar", {"card": "../x"}, "127.0.0.1")[1] == 400
   and m.vis_acao("juntar", {"a": A, "b": A}, "127.0.0.1")[1] == 400, "levas inválidas: 400")
r, cod = m.vis_acao("juntar", {"a": A, "b": B, "por": "__proto__", "posto": "<b>x</b>"}, "127.0.0.1")
linhas = [json.loads(l) for l in open(m.VIS_LOG)]
ok(linhas[-1]["por"] is None and "<" not in (linhas[-1]["posto"] or ""), "por e posto limpos: %r" % linhas[-1])

# ---------- 31: reinício: visitas iguais (arestas relidas) ----------
antes = sorted(tuple(v["levas"]) for v in m.vis_feed()["visitas"])
m.sess_gravar()
with m.sess_lock:
    for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info, m.sess_faces_pid,
              m.sess_rostos_mem, m.vis_arestas, m.vis_de, m.vis_info, m.vis_rostos):
        d.clear()
m.sess_carregar(T0 + 900)
depois = sorted(tuple(v["levas"]) for v in m.vis_feed()["visitas"])
ok(antes == depois and antes, "31: visitas iguais depois do reinício: %r %r" % (antes, depois))
fv = os.path.join(m.VIS_DIR, HOJE + ".json")
ok(oct(os.stat(fv).st_mode & 0o777) == "0o600" and "\"v\"" not in open(fv).read(), "31: arquivo das arestas 600 e sem vetor")

# ---------- 32: LGPD de uma foto: some das arestas; leva removida sai da visita ----------
reset()
A, pa = leva("carlos", T0, [[rosto(P[34])], [rosto(P[34])]])
B, pb = leva("samuel", T0 + 120, [[rosto(P[34])]])
C, pc = leva("marinara", T0 + 200, [[rosto(P[34])]])
fecha(T0 + 600)
ok(visita(A) == sorted([A, B, C]), "32: começa com 3")
m._sess_esquecer(pb[0])
with m.sess_lock:
    pids_ar = [p for e in m.vis_arestas[HOJE] for p in (e.get("pa"), e.get("pb"))]
ok(pb[0] not in pids_ar and B not in visita(A) and visita(A) == sorted([A, C]), "32: LGPD tira o pid e a leva removida: %r %r" % (pids_ar, visita(A)))

# ---------- D4: bases de IA por visita ----------
reset()
m.ff_funcao.update(dia=HOJE, map={"carlos": {"tipo": "campo", "point": "campo2"}, "samuel": {"tipo": "campo", "point": "campo3"}})
fam = P[35]
A, pa = leva("carlos", T0, [[rosto(fam)]] * 5)
fecha(T0 + 200)
B, pb = leva("samuel", T0 + 300, [[rosto(fam)]] * 5)
fecha(T0 + 600)
with m.sess_lock:
    xa, xb = dict(m.sess[A]), dict(m.sess[B])
ok(xa["ia"] == pa[:2] and xb["ia"] == [] and (xb["ia_regra"] or {}).get("motivo") == "visita_ja_tem" and B in visita(A),
   "D4: a 2ª leva da visita fecha sem bases (visita_ja_tem): %r %r" % ((xa["ia"], xa["ia_regra"]), (xb["ia"], xb["ia_regra"])))
ok(m.rec_pre_escolha(pb, {"ia": [], "ia_regra": xb["ia_regra"]}) == [], "D4: leva sem bases da visita não é recortada antes")
m.ff_funcao.update(dia="", map={})

# ---------- 29: HTTP: X-Eterna, origem, 429; GET /visitas ----------
srv = m.ThreadingHTTPServer(("127.0.0.1", PORTA), m.H)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def req(method, path, body=None, headers=None):
    h = {"Host": "127.0.0.1:%d" % PORTA, **(headers or {})}
    data = json.dumps(body).encode() if body is not None else None
    if data:
        h["Content-Type"] = "application/json"
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request(method, path, body=data, headers=h)
    r = c.getresponse()
    b = r.read()
    try:
        return r.status, json.loads(b), dict(r.getheaders())
    except ValueError:
        return r.status, None, dict(r.getheaders())


s, j, h = req("GET", "/visitas")
ok(s == 200 and j["ok"] and isinstance(j["visitas"], list) and h.get("Cache-Control") == "no-store", "GET /visitas: %r %r" % (s, j))
ok(req("GET", "/visitas", headers={"Origin": "https://exemplo.com"})[0] == 403, "29: GET com origem de fora: 403")
ok(req("GET", "/visitas", headers={"Host": "exemplo.com:%d" % PORTA})[0] == 403, "29: GET com Host forjado: 403")
s, _, _ = req("POST", "/visitas/juntar", {"a": A, "b": B})
ok(s == 403, "29: POST sem X-Eterna: %r" % s)
s, _, _ = req("POST", "/visitas/juntar", {"a": A, "b": B}, {"X-Eterna": "1", "Origin": "https://exemplo.com"})
ok(s == 403, "29: POST de outra origem: %r" % s)
cods = [req("POST", "/visitas/separar", {"card": B, "por": "Ana"}, {"X-Eterna": "1"})[0] for _ in range(31)]
ok(cods[0] == 200 and cods[29] == 200 and cods[30] == 429, "29: o 31º pedido no minuto dá 429: %r" % cods[-3:])
srv.shutdown()

# ---------- 33: desempenho: 3.000 fotos num dia, 6 trilhas ao mesmo tempo ----------
reset()
m.vis_med["lig"].clear()
m.vis_med["recalc"].clear()
pessoas = [unit() for _ in range(900)]
t = T0
fot = NOMES[:6]
fams = [pessoas[i * 3:(i + 1) * 3] for i in range(300)]
n = 0
fi = 0
t_ini = time.time()
while n < 3000:
    for k, o in enumerate(fot):                  # 6 trilhas ao mesmo tempo, cada uma numa família
        fam = fams[(fi + k * 7) % len(fams)]
        for j in range(3):
            foto(o, t + j * 8 + k, [rosto(p) for p in fam[: 1 + (j % 3)]])
            n += 1
    t += 90                                       # pausa de 90 s: leva nova em cada trilha
    fi += 1
dur = time.time() - t_ini
lig = sorted(m.vis_med["lig"])
rc = sorted(m.vis_med["recalc"])
p90 = lambda v: v[int(0.9 * (len(v) - 1))] if v else 0
notas["c33"] = {"fotos": n, "ligar_p90_ms": round(p90(lig), 2), "recalc_p90_ms": round(p90(rc), 2), "recalc_max_ms": round(max(rc or [0]), 2),
                "total_s": round(dur, 1), "visitas": len(m.vis_info)}
ok(p90(lig) <= 50, "33: ligação por foto p90 %.1f ms (teto 50)" % p90(lig))
ok(p90(rc) <= 20, "33: _vis_recalc p90 %.1f ms (teto 20)" % p90(rc))

if falhas:
    print("FALHA visitas_agente: " + " | ".join(falhas) + " · " + json.dumps(notas))
    sys.exit(1)
print("OK visitas_agente: critérios 18 a 26, 27 e 28 (agente), 29 (HTTP), 31, 32, 33 e a D4 do plano v97 · " + json.dumps(notas))
