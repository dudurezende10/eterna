# v93: os N primeiros cliques de cada sessão de ponto de campo são só base dos fundos de IA (plano
# docs/planos/2026-11-06-dois-cliques-ia.md, critérios 1, 5 a 13 e 15 a 18 do lado do agente). Roda sozinho
# (testes/rodar.sh) com HOME temporário:  python3 -I testes/cliques_ia_agente.py agente/eterna-agente.py
# O módulo é importado aqui, com relógio injetado e rostos sintéticos (como em testes/sessoes_agente.py), sem OpenCV, e
# o recorte é falso (m.REC_FALSO_SEG: copia a foto e demora um pouco; nunca foto de convidado nem modelo de verdade).
import importlib.util, json, os, random, sys, tempfile, threading, time

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["USERPROFILE"] = HA
os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_RECORTE_FALSO", "ETERNA_SESSAO_PAUSA", "ETERNA_SESS_LIMITES", "ETERNA_SEM_RECORTE", "ETERNA_BUSCA_DIAS"):
    os.environ.pop(k, None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {n: "x" * 12 for n in ("carlos", "samuel", "marinara", "yago", "marcio")}},
          open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
os.environ["ETERNA_RECORTE_FALSO"] = "1"
ok(m._rec_falso() is None and "falso" not in m.rec_status(), "S2: a variável de ambiente não liga o recorte falso")
del os.environ["ETERNA_RECORTE_FALSO"]
m.REC_FALSO_SEG = 0.15
ok(m.rec_status().get("falso") is True, "S2: /status.recorte.falso quando ligado")
LIG = [False]
m.sess_rostos_on = lambda: LIG[0]

rnd = random.Random(93)


def unit():
    v = [rnd.gauss(0, 1) for _ in range(128)]
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def norm(v):
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def rosto(base, larg=200):
    r = unit()
    return (larg, norm([b + 0.6 * x for b, x in zip(base, r)]), 0.95, True)


P1, P2, G1, G2 = (unit() for _ in range(4))
FOTOS = tempfile.mkdtemp()
_seq = [0]


def reset():
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info,
                  m.sess_faces_pid, m.sess_rostos_mem, m.ff_desvio):
            d.clear()
        m.sess_sujo.clear()
        m.sess_ia_novos.clear()


def add(o, u, cap=None, s="ftp"):
    _seq[0] += 1
    pid = "%012x" % (0xc00000000000 + _seq[0])
    md = {"o": o, "s": s, "u": u}
    if cap is not None:
        md["cap"] = cap
    f = os.path.join(FOTOS, pid + ".jpg")
    with open(f, "wb") as fh:
        fh.write(b"\xff\xd8 foto sintetica " + pid.encode())
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = dict(md)
    cad = m.ff_cadastrados()
    with m.sess_lock:
        m._sess_add(pid, md, cad, agora=u)
    return pid


def de(pid):
    return m.sess.get(m.sess_pid.get(pid) or "")


def novos():
    with m.sess_lock:
        return list(m.sess_ia_novos)


def funcao(mp):
    with m.ff_lock:
        m.ff_funcao.update(dia=m._ff_hoje(), map=mp)


FUNC = {"carlos": {"tipo": "campo", "point": "campo2"}, "samuel": {"tipo": "volante", "modo": "livre"},
        "marinara": {"tipo": "campo", "point": "vestiario"}, "marcio": {"tipo": "campo", "point": "chroma"}}
funcao(FUNC)
T = time.time() - 3 * 3600
ok(m.ia_cfg() == {"ligada": True, "cliques": 2, "pontos": ["terminal", "campo2", "campo3", "campo4"], "volante": False},
   "padrão da regra: %r" % m.ia_cfg())

# 1: 8 fotos no campo2; a 2ª chegou ao servidor antes da 1ª
reset()
pb = add("carlos", T + 6, cap=T + 5)            # 2º clique, chega primeiro
pa = add("carlos", T + 8, cap=T + 1)            # 1º clique, chega depois
resto = [add("carlos", T + 10 + i * 3, cap=T + 9 + i * 3) for i in range(6)]
x1 = de(pa)
ok(x1 is de(pb) and x1["status"] == "aberta" and x1["ia"] == [] and x1["ia_regra"] is None, "contrato: aberta tem ia [] e ia_regra None")
ok({p for p, _ in novos()} == {pa, pb} and all(pr == 1 for _, pr in novos()), "5: as 2 bases vão para a fila de IA na chegada (prio 1): %r" % novos())
m.sess_tick(T + 200)
ok(x1["status"] == "fechada" and x1["ia"] == [pa, pb] and x1["ia_regra"] == {"n": 2, "motivo": None},
   "1: ia = os 2 menores cliques: %r %r" % (x1["ia"], x1["ia_regra"]))
ok(x1["fotos"][2:] == resto, "1: as outras 6 seguem na sessão")
ok(m.rec_pre_escolha(x1["fotos"], x1) == [pa, pb], "A14: recorte antecipado = as bases de IA")
ok(m.rec_pre_escolha(["a1", "a2", "a3", "a4"]) == ["a1", "a2"], "A14: sem a regra, só as 2 primeiras")

# 8: volante, Vestiário, ponto fora, sem função e sem cadastro
for quem, mot in (("samuel", "volante"), ("marinara", "ponto_fora"), ("marcio", "ponto_fora"), ("yago", "sem_funcao"),
                  ("fulano", "sem_funcao")):
    reset()
    ps = [add(quem, T + 300 + i * 3, cap=T + 299 + i * 3) for i in range(5)]
    ok(not novos(), "8: %s sem pedido de recorte de IA" % quem)
    m.sess_tick(T + 500)
    x = de(ps[0])
    ok(x["ia"] == [] and x["ia_regra"]["motivo"] == mot and x["fotos"] == ps, "8: %s: %r" % (quem, x["ia_regra"]))

# 9: sessão com 2 fotos: poucas_fotos
reset()
ps = [add("carlos", T + 600 + i * 3, cap=T + 599 + i * 3) for i in range(2)]
m.sess_tick(T + 800)
ok(de(ps[0])["ia"] == [] and de(ps[0])["ia_regra"] == {"n": 2, "motivo": "poucas_fotos"}, "9: poucas_fotos: %r" % de(ps[0])["ia_regra"])

# 11: trilha atrasada (cartão): a regra vale, prioridade 2
reset()
ps = [add("carlos", T + 900 + i, cap=T + 900 - 3000 + i * 3, s="cartao") for i in range(4)]
x = de(ps[0])
ok(x["atrasada"] and {p for p, _ in novos()} == set(ps[:2]) and all(pr == 2 for _, pr in novos()), "11: atrasada com prio 2: %r" % novos())
m.sess_tick(T + 2000)
ok(x["ia"] == ps[:2], "11: ia da atrasada: %r" % x["ia"])

# 10: separação por rostos novos (cada sessão tem a sua) e fusão (a fundida fica com os 2 primeiros cliques dela)
LIG[0] = True
reset()
f = [add("carlos", T + 3000 + i * 2, cap=T + 2996 + i * 2) for i in range(3)]
g = [add("carlos", T + 3009 + i * 2, cap=T + 3005 + i * 2) for i in range(3)]
for i, p in enumerate(f):
    m.sess_rostos_lidos(p, [rosto(P1), rosto(P2)], T + 3016 + i * 0.1)
for i, p in enumerate(g):
    m.sess_rostos_lidos(p, [rosto(G1), rosto(G2)], T + 3016.5 + i * 0.1)
s1, s2 = de(f[0]), de(g[0])
ok(s1 is not s2 and s2["motivo"] == "rostos_novos", "10: duas sessões por rostos novos")
m.sess_tick(T + 3200)
ok(s1["ia"] == f[:2] and s2["ia"] == g[:2], "10: cada sessão com a sua ia: %r %r" % (s1["ia"], s2["ia"]))
reset()
i1 = add("carlos", T + 3600, cap=T + 3596)
i2 = add("carlos", T + 3603, cap=T + 3599)
m.sess_rostos_lidos(i1, [rosto(P1)], T + 3603.5)
m.sess_rostos_lidos(i2, [rosto(P2)], T + 3603.6)
sA, sB = de(i1), de(i2)
ok(sA is not sB and i2 in {p for p, _ in novos()}, "10: a S2 por rostos novos pede o recorte da 1ª dela")
mais = [add("carlos", T + 3606 + i * 3, cap=T + 3602 + i * 3) for i in range(3)]
for j, p in enumerate(mais):
    m.sess_rostos_lidos(p, [rosto(P1), rosto(P2)], T + 3616 + j * 0.1)
ok(de(i2) is sA and sB["removida"] and sB["ia"] == [], "10: fundiu na mais antiga")
m.sess_tick(T + 3800)
ok(sA["ia"] == [i1, i2] and sA["fotos"][:2] == [i1, i2], "10: ia da fundida = 2 primeiros cliques: %r" % sA["ia"])
LIG[0] = False

# 12: Painel de controle: 1 clique vale para a próxima que fechar; a fechada não muda; valor inválido = padrão
reset()
a = [add("carlos", T + 4000 + i * 3, cap=T + 3999 + i * 3) for i in range(4)]
m.sess_tick(T + 4200)
xa = de(a[0])
ok(xa["ia"] == a[:2], "12: antes da mudança, 2")
m.estado_gravar({"docs": [{"col": "config", "id": "ia", "valor": {"ligada": True, "cliques": 1, "pontos": ["campo2"], "volante": False,
                                                                   "por": "teste", "em": "2026-11-06T10:00:00Z"}}]})
ok(m.ia_cfg()["cliques"] == 1, "12: a gravação no /ponto/docs vale na hora: %r" % m.ia_cfg())
b = [add("carlos", T + 4400 + i * 3, cap=T + 4399 + i * 3) for i in range(4)]
m.sess_tick(T + 4600)
ok(de(b[0])["ia"] == b[:1] and xa["ia"] == a[:2], "12: 1 clique na próxima; a fechada não mudou: %r %r" % (de(b[0])["ia"], xa["ia"]))
m.estado_gravar({"docs": [{"col": "config", "id": "ia", "valor": {"ligada": False, "cliques": 2, "pontos": ["campo2"], "volante": False}}]})
m.ia_cfg()
c = [add("carlos", T + 4800 + i * 3, cap=T + 4799 + i * 3) for i in range(4)]
m.sess_tick(T + 5000)
ok(de(c[0])["ia"] == [] and de(c[0])["ia_regra"]["motivo"] == "desligada", "12: desligada")
for ruim in ({"cliques": 7}, {"cliques": True}, {"pontos": ["../x"]}, {"pontos": ["a"] * 21}, {"ligada": "sim"}, "x", None):
    ok(m.ia_valida(ruim) is None, "12: inválido recusado: %r" % (ruim,))
m.estado_gravar({"docs": [{"col": "config", "id": "ia", "valor": {"ligada": True, "cliques": 9}}]})
ok(m.ia_cfg() == m.ia_padrao(), "12: inválido = padrão")
m.estado_gravar({"docs": [{"col": "config", "id": "ia", "valor": None}]})
m.ia_cfg()

# 13: Fila do fotógrafo: grupo aberto com 1 foto = n 2, 1 pid; fechada traz prontas
reset()
agora = time.time()
q1 = add("carlos", agora - 5, cap=agora - 6)
fj = m.ff_json(agora)
g1 = [g for g in fj["grupos"] if g["id"] == de(q1)["card"]][0]
ok(g1["ia"] == {"n": 2, "motivo": None, "pids": [q1], "prontas": 0}, "13: aberto com 1 foto: %r" % g1["ia"])
reset()
xs = [add("samuel", agora - 5 + i * 0.1, cap=agora - 6 + i * 0.1) for i in range(3)]
g2 = [g for g in m.ff_json(agora)["grupos"] if g["id"] == de(xs[0])["card"]][0]
ok(g2["ia"]["n"] == 0 and g2["ia"]["motivo"] == "volante" and g2["ia"]["pids"] == [], "13: volante sem bases: %r" % g2["ia"])

# 5, 6, 7 e 11 com a fila de recorte de verdade (recorte falso)
threading.Thread(target=m.rec_ia_loop, daemon=True).start()
reset()
agora = time.time()
r1 = add("carlos", agora, cap=agora - 1)
r2 = add("carlos", agora + 0.2, cap=agora - 0.5)
r3 = add("carlos", agora + 0.4, cap=agora - 0.2)
t0 = time.time()
while time.time() - t0 < 30 and not all(os.path.exists(m.rec_arquivo(p, l)) for p in (r1, r2) for l in (2400, 3000)):
    time.sleep(0.1)
dt = time.time() - t0
ok(all(os.path.exists(m.rec_arquivo(p, l)) for p in (r1, r2) for l in (2400, 3000)) and de(r1)["status"] == "aberta",
   "5: recortes de 3000 e 2400 das 2 bases com a sessão aberta (%.1f s)" % dt)
ok(not os.path.exists(m.rec_arquivo(r3)), "5: a 3ª foto não é recortada na chegada")
ok(all(oct(os.stat(m.rec_arquivo(r1, l)).st_mode & 0o777) == "0o600" for l in (2400, 3000)), "S2: PNG com chmod 600")
time.sleep(0.3)
st = m.rec_status()["ia"]
ok(set(st) == {"ligada", "fila", "feitos", "erros", "atraso_p50_s", "atraso_p90_s"} and st["feitos"] >= 2 and st["atraso_p90_s"] is not None,
   "/status.recorte.ia: %r" % st)
fj = m.ff_json(time.time())
g3 = [g for g in fj["grupos"] if g["id"] == de(r1)["card"]][0]
ok(g3["ia"]["prontas"] == 2 and g3["ia"]["pids"] == [r1, r2], "13: prontas 2: %r" % g3["ia"])


def foto(nome):
    f = os.path.join(FOTOS, nome + ".jpg")
    open(f, "wb").write(b"x")
    return f


# 6: 20 trabalhos de IA pendentes (e mais 24 para passar do teto antigo); o Checkout passa na frente e nunca fila_cheia
m.REC_FALSO_SEG = 0.05
blk, _ = m.rec_enfileirar("b10c000000", foto("b10c000000"), 3000, m.REC_PRIO_ANTECIPADO)   # trabalho em andamento
time.sleep(0.02)
ia_jobs = []
for i in range(30):
    pid = "1a%08x" % i
    j, e = m.rec_enfileirar(pid, foto(pid), 2400, m.REC_PRIO_IA, ia=True, u=time.time())
    ia_jobs.append(j)
ok(all(j is not None for j in ia_jobs), "6: a IA nunca recebe fila_cheia")
res = {}


def checkout():
    res["r"] = m.rec_pedir("c0ffee0001", foto("c0ffee0001"), 2400)
    res["ia_prontos"] = sum(1 for j in ia_jobs if j["ev"].is_set())


th = threading.Thread(target=checkout)
th.start()
th.join(30)
ok(res.get("r") and res["r"][0] and not res["r"][1], "6: o Checkout foi atendido: %r" % (res.get("r"),))
ok(res.get("ia_prontos", 99) <= 1, "6: o Checkout passou na frente das bases de IA (%r prontas antes)" % res.get("ia_prontos"))
for j in ia_jobs:
    j["ev"].wait(30)

# 7: o mesmo pid pedido pela IA e pelo Checkout ao mesmo tempo = um recorte só
m.REC_FALSO_SEG = 0.3
blk, _ = m.rec_enfileirar("b10c000001", foto("b10c000001"), 3000, m.REC_PRIO_ANTECIPADO)
time.sleep(0.05)
antes = m.rec_status()["feitos"]
fd = foto("d0b1e00001")
j1, _ = m.rec_enfileirar("d0b1e00001", fd, 2400, m.REC_PRIO_IA, ia=True, u=time.time())
rr = {}
th = threading.Thread(target=lambda: rr.setdefault("r", m.rec_pedir("d0b1e00001", fd, 3000)))
th.start()
j1["ev"].wait(30)
th.join(30)
blk["ev"].wait(30)
ok(rr.get("r") and rr["r"][0] == m.rec_arquivo("d0b1e00001") and os.path.exists(m.rec_arquivo("d0b1e00001", 2400)),
   "7: os dois pedidos atendidos: %r" % (rr.get("r"),))
ok(m.rec_status()["feitos"] - antes == 2, "7: um recorte para a foto (mais o que estava em andamento): %r" % (m.rec_status()["feitos"] - antes))

# 11: atrasada (prio 2) atrás da ao vivo (prio 1) que chegou depois
m.REC_FALSO_SEG = 0.2
blk, _ = m.rec_enfileirar("b10c000002", foto("b10c000002"), 3000, m.REC_PRIO_ANTECIPADO)
time.sleep(0.05)
reset()
agora = time.time()
at = [add("carlos", agora + i * 0.01, cap=agora - 3000 + i, s="cartao") for i in range(2)]
vv = [add("yago", agora + 0.1 + i * 0.01, cap=agora + i * 0.01) for i in range(2)]   # sem função: não entra
funcao(dict(FUNC, yago={"tipo": "campo", "point": "campo3"}))
reset()
at = [add("carlos", agora + i * 0.01, cap=agora - 3000 + i, s="cartao") for i in range(2)]
vv = [add("yago", agora + 0.1 + i * 0.01, cap=agora + i * 0.01) for i in range(2)]
t0 = time.time()
while time.time() - t0 < 20 and not all(os.path.exists(m.rec_arquivo(p)) for p in at + vv):
    time.sleep(0.05)
mt = {p: os.path.getmtime(m.rec_arquivo(p)) for p in at + vv if os.path.exists(m.rec_arquivo(p))}
ok(len(mt) == 4 and max(mt[p] for p in vv) <= min(mt[p] for p in at), "11: ao vivo antes da atrasada: %r" % mt)

# 15: LGPD de uma base de IA: sai de ia (memória e arquivo) e os recortes somem na hora
reset()
L = [add("carlos", T + 6000 + i * 3, cap=T + 5999 + i * 3) for i in range(4)]
m.sess_tick(T + 6200)
xl = de(L[0])
for lx in (2400, 3000):
    m.rec_fazer(L[0], m.lib[L[0]]["file"], lx)
m.sess_gravar()
m.lgpd_excluir([L[0]], [])
m.sess_gravar()
arq = json.load(open(os.path.join(m.SESS_DIR, xl["dia"] + ".json")))
xd = [x for x in arq["sessoes"] if x["card"] == xl["card"]][0]
ok(xl["ia"] == [L[1]] and xd["ia"] == [L[1]] and L[0] not in xd["fotos"], "15: fora de ia na memória e no arquivo: %r %r" % (xl["ia"], xd["ia"]))
ok(not os.path.exists(m.rec_arquivo(L[0])) and not os.path.exists(m.rec_arquivo(L[0], 2400)), "15: recortes apagados na hora")

# 17: limpeza com teto baixo não apaga a base de IA de hoje
reset()
agora = time.time()
K = [add("carlos", agora - 900 + i * 3, cap=agora - 901 + i * 3) for i in range(4)]
m.sess_tick(agora - 600)
for p in K:
    m.rec_fazer(p, m.lib[p]["file"], 2400)
teto = m.REC_TETO_GB
m.REC_TETO_GB = 0
m.limpar_recortes()
m.REC_TETO_GB = teto
ok(all(os.path.exists(m.rec_arquivo(p, l)) for p in K[:2] for l in (2400, 3000)), "17: bases de IA de hoje ficam")
ok(not any(os.path.exists(m.rec_arquivo(p)) for p in K[2:]), "17: as outras saem pelo teto")

# 18 (segurança S1): base de IA sai do manifesto gravado (sem recusar a galeria); a já comprada fica
xk = de(K[0])
fs18 = [{"id": "ag_" + K[0], "sessao": xk["card"]}, {"id": "ag_" + K[2], "sessao": xk["card"]},
        {"id": "ag_" + K[1], "sessao": xk["card"], "direito": "comprada"}]
ok(m._gal_confere_sessoes({"sessoes": [xk["card"]]}, fs18) == 1 and [f["id"] for f in fs18] == ["ag_" + K[2], "ag_" + K[1]],
   "18: só a base não comprada sai: %r" % fs18)
import http.client, socket
_so = socket.socket(); _so.bind(("127.0.0.1", 0)); PT = _so.getsockname()[1]; _so.close()
m.PORT = PT
srv = m.ThreadingHTTPServer(("127.0.0.1", PT), m.H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
TOK = "Ab3dEf6hIj9lMn0pQr2tUv"
man = {"token": TOK, "tipo": "sessao", "sessoes": [xk["card"]], "expira": "2099-01-01T00:00:00Z", "precos": {"dig": 39, "todas": 250},
       "fotos": [{"id": "ag_" + K[0], "sessao": xk["card"], "direito": "venda"}, {"id": "ag_" + K[2], "sessao": xk["card"], "direito": "venda"}]}
cn = http.client.HTTPConnection("127.0.0.1", PT, timeout=10)
cn.request("POST", "/galerias/publicar", json.dumps({"manifesto": man}), {"Content-Type": "application/json"})
rr = cn.getresponse(); rj = json.loads(rr.read() or b"{}")
gv = m.REPO.ler_manifesto(TOK) or {}
ok(rr.status == 200 and rj.get("ignoradas") == 1, "18: publicar responde ok com ignoradas 1: %r %r" % (rr.status, rj))
ok([f["id"] for f in gv.get("fotos") or []] == ["ag_" + K[2]], "18: a base não está no manifesto gravado: %r" % gv.get("fotos"))

# 16: reinício com sessão aberta: fecha com "reinicio" e ia calculada; o recorte antecipado escolhe as bases
reset()
agora = time.time()
R = [add("carlos", agora - 30 + i * 3, cap=agora - 31 + i * 3) for i in range(4)]
xr = de(R[0])
ok(xr["status"] == "aberta", "16: aberta antes do reinício")
with m.sess_lock:
    m.sess_sujo.add(xr["dia"])
m.sess_gravar()
reset()
m.sess_carregar(agora + 5)
xr2 = m.sess.get(xr["card"])
ok(xr2 and xr2["fechada_por"] == "reinicio" and xr2["ia"] == R[:2] and xr2["ia_regra"] == {"n": 2, "motivo": None},
   "16: fechou com reinicio e ia: %r" % ((xr2 and (xr2["fechada_por"], xr2["ia"], xr2["ia_regra"])),))
ok(m.rec_pre_escolha(xr2["fotos"], xr2) == R[:2], "16: o recorte antecipado recorta as bases")
feed = m.sess_feed(0)
xf = [x for x in feed["sessoes"] if x["card"] == xr["card"]][0]
ok(xf["ia"] == R[:2] and xf["ia_regra"]["n"] == 2 and not [k for k in xf if k.startswith("_")], "contrato de /sessoes com ia e ia_regra")

print(json.dumps({"ok": not falhas, "falhas": falhas}))
print(("OK cliques_ia_agente: critérios 1, 5 a 13 e 15 a 18 do plano v93" if not falhas else "FALHA cliques_ia_agente: " + " | ".join(falhas)))
sys.exit(0 if not falhas else 1)
