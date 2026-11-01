# v91: sessões separadas por tempo e por rosto no agente (critérios 1 a 20 do plano
# docs/planos/2026-10-30-sessoes-por-rosto-e-tempo.md). Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/sessoes_agente.py agente/eterna-agente.py [porta]
# Parte A: o módulo importado aqui, relógio injetado (_sess_add(..., agora), sess_tick(agora)) e rostos sintéticos
# injetados por sess_rostos_lidos: pessoa = vetor unitário aleatório de 128 com semente fixa; rosto na foto =
# normaliza(base + ruído de norma 0,6). Nunca foto de convidado, sem OpenCV (ETERNA_SEM_OPENCV=1).
# Parte B: o agente de verdade em outro processo (FTP embutido, pausa de teste de 3 s): contrato de /status e /sessoes,
# Fila = sessões e reinício.
import importlib.util, io, json, os, random, re, subprocess, sys, tempfile, time, ftplib, http.client

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 8600 + random.randint(0, 80)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# ======================= Parte A: no processo =======================
HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ.pop("ETERNA_SESSAO_PAUSA", None)
os.environ.pop("ETERNA_SESS_LIMITES", None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12, "samuel": "y" * 12, "marinara": "z" * 12}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
ok(m.SESS_PAUSA == 60 and m.FF_PAUSA == 60, "S1: pausa de 60 s (%r)" % m.SESS_PAUSA)
ok((m.SESS_LIM_FICA, m.SESS_LIM_NOVO, m.SESS_LIM_FUNDE) == (0.38, 0.25, 0.45) and m.SESS_ROSTO_ESPERA == 20, "limiares")
LIG = [True]
m.sess_rostos_on = lambda: LIG[0]          # rostos "ligados" sem OpenCV: as leituras são injetadas aqui

rnd = random.Random(90)


def unit():
    v = [rnd.gauss(0, 1) for _ in range(128)]
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def norm(v):
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def rosto(base, larg=200, score=0.95, frontal=True):
    r = unit()
    return (larg, norm([b + 0.6 * x for b, x in zip(base, r)]), score, frontal)


P1, P2, G1, G2, EST, C1 = (unit() for _ in range(6))
_seq = [0]


def reset():
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info,
                  m.sess_faces_pid, m.sess_rostos_mem, m.ff_desvio):
            d.clear()
        m.sess_sujo.clear()


def add(o, u, cap=None, s="ftp", serie="", mt=None):
    _seq[0] += 1
    pid = "%012x" % (0xb00000000000 + _seq[0])
    md = {"o": o, "s": s, "u": u}
    if cap is not None:
        md["cap"] = cap
    if serie:
        md["serie"] = serie
    if mt is not None:
        md["mt"] = mt
    cad = m.ff_cadastrados()
    with m.sess_lock:
        m._sess_add(pid, md, cad, agora=u)
    return pid


def lido(pid, faces, agora):
    m.sess_rostos_lidos(pid, faces, agora)


def tick(agora):
    m.sess_tick(agora)


def de(pid):
    return m.sess.get(m.sess_pid.get(pid) or "")


def vivas():
    return [x for x in m.sess.values() if not x.get("removida")]


T = time.time()            # hoje; o relógio dos cenários anda a partir daqui (sess_feed só é chamado no fim)

# 1: pausa de 60 s (sem rosto, rostos desligados)
reset(); LIG[0] = False
a = [add("carlos", T + i * 10, cap=T + i * 10 - 3) for i in range(3)]
a4 = add("carlos", T + 20 + 70, cap=T + 20 + 70 - 3)
ok(len(vivas()) == 2 and de(a4)["motivo"] == "pausa" and de(a[0])["motivo"] == "inicio" and de(a[0])["fechada_por"] == "pausa_clique",
   "1: 70 s depois = 2 sessões, a segunda por pausa: %r" % [(x["motivo"], len(x["fotos"]), x["fechada_por"]) for x in vivas()])
reset()
a = [add("carlos", T + i * 10, cap=T + i * 10 - 3) for i in range(3)]
add("carlos", T + 20 + 59, cap=T + 20 + 59 - 3)
ok(len(vivas()) == 1 and len(vivas()[0]["fotos"]) == 4, "1: 59 s depois = 1 sessão")
ok(not m.sess_espera and not vivas()[0]["pend"], "10: rostos desligados, nada pendente")
ok(m.sess_status()["rostos"] is False and m.sess_status()["pausa"] == 60 and m.sess_status()["v"] == 2, "10: /status.sessoes.rostos false: %r" % m.sess_status())
LIG[0] = True


def familia_e_grupo(T0, ordem_inversa=False):
    """F (P1, P2) em 3 fotos; G (G1, G2) 5 s depois em 2 fotos. Devolve os pids."""
    reset()
    f = [add("carlos", T0 + i * 2, cap=T0 + i * 2 - 4) for i in range(3)]
    g = [add("carlos", T0 + 9 + i * 2, cap=T0 + 9 + i * 2 - 4) for i in range(2)]
    fr = {p: [rosto(P1), rosto(P2)] for p in f}
    gr = {p: [rosto(G1), rosto(G2)] for p in g}
    ordem = f + g
    if ordem_inversa:
        ordem = [f[0], f[2], f[1], g[1], g[0]]
    for i, p in enumerate(ordem):
        lido(p, fr.get(p) or gr.get(p), T0 + 14 + i * 0.1)
    return f, g


# 2: rostos novos sem pausa
f, g = familia_e_grupo(T)
s1, s2 = de(f[0]), de(g[0])
ok(s1 and s2 and s1 is not s2 and all(de(p) is s1 for p in f) and all(de(p) is s2 for p in g),
   "2: duas sessões (família F e família G): %r" % [(x["card"], x["fotos"]) for x in vivas()])
ok(s2 and s2["motivo"] == "rostos_novos" and s2["sim_abertura"] is not None and s2["sim_abertura"] < 0.25 and s2["dec"][g[0]] == "n",
   "2: motivo rostos_novos e sim_abertura < 0,25: %r" % ((s2 and (s2["motivo"], s2["sim_abertura"])),))
ok(s1 and s1["status"] == "separada" and s2["status"] == "aberta", "2: a primeira fica separada (fechando)")
ok(s1 and s1["dec"][f[1]] == "r" and s2["dec"][g[1]] == "r", "3: individual/grupo da mesma família = r")
cards2 = {s1["card"], s2["card"]}
tick(T + 9 + 2 + 61)
ok(s1["status"] == "fechada" and s2["status"] == "fechada" and s1["fechada_por"] == "pausa", "2: depois de 60 s sem chegada, fechadas")
ok(not m.sess_rostos_mem, "S9: vetores somem quando a sessão fecha")

# 8: leituras fora de ordem dão o mesmo resultado
fa, ga = familia_e_grupo(T + 400)
certo = sorted((len(x["fotos"]), x["motivo"]) for x in vivas())
fb, gb = familia_e_grupo(T + 800, ordem_inversa=True)
inv = sorted((len(x["fotos"]), x["motivo"]) for x in vivas())
ok(certo == inv == [(2, "rostos_novos"), (3, "inicio")], "8: ordem inversa igual à certa: %r %r" % (certo, inv))
reset()
b1 = add("carlos", T + 1200, cap=T + 1196)
b2 = add("carlos", T + 1202, cap=T + 1198)
ok(de(b2)["pend"] == [b2] and b2 not in de(b2)["fotos"], "8: com rostos ligados a foto fica pendente até a leitura")

# 3: foto só de P2 depois do grupo
reset()
x3 = [add("carlos", T + 1500 + i * 3, cap=T + 1496 + i * 3) for i in range(3)]
lido(x3[0], [rosto(P1), rosto(P2)], T + 1507); lido(x3[1], [rosto(P1), rosto(P2)], T + 1507.1); lido(x3[2], [rosto(P2)], T + 1507.2)
ok(len(vivas()) == 1 and de(x3[2])["dec"][x3[2]] == "r", "3: individual fica na família, dec r: %r" % de(x3[2])["dec"])

# 4: individuais antes do grupo (fusão)
reset()
i1 = add("carlos", T + 1800, cap=T + 1796)
i2 = add("carlos", T + 1803, cap=T + 1799)
lido(i1, [rosto(P1)], T + 1803.5); lido(i2, [rosto(P2)], T + 1803.6)
sA, sB = de(i1), de(i2)
ok(sA is not sB and sB["motivo"] == "rostos_novos" and sA["status"] == "separada", "4: P2 sozinho abre a S2 por rostos novos")
i3 = add("carlos", T + 1806, cap=T + 1802)
lido(i3, [rosto(P1), rosto(P2)], T + 1806.5)
ok(de(i1) is sA and de(i2) is sA and de(i3) is sA and sA["dec"][i3] == "f" and sA["status"] == "aberta",
   "4: grupo funde na mais antiga: %r" % [(x["card"], x["fotos"], x["status"]) for x in m.sess.values()])
ok(sB["removida"] is True and sB["fundida_em"] == sA["card"] and sB["fotos"] == [], "4: S2 removida com fundida_em")
ok(sA["fotos"] == [i1, i2, i3], "4: fotos na ordem do clique")

# 5 e 6: sem rosto, perfil e criança fraca ficam
reset()
y = [add("carlos", T + 2100 + i * 3, cap=T + 2096 + i * 3) for i in range(5)]
lido(y[0], [rosto(P1), rosto(P2)], T + 2115)
lido(y[1], [], T + 2115.1)                                         # sem rosto
lido(y[2], [rosto(EST, frontal=False)], T + 2115.2)                # só de perfil, pessoa nova
mem = [v for _, v in m.sess_rostos_mem[de(y[0])["card"]]]
orto = unit()
orto = norm([a - dot(orto, mem[0]) * b for a, b in zip(orto, mem[0])])
fraca = norm([0.30 * a + (1 - 0.09) ** 0.5 * b for a, b in zip(mem[0], orto)])
simf = max(dot(fraca, v) for v in mem)
lido(y[3], [(80, fraca, 0.9, True)], T + 2115.3)                   # criança com leitura fraca (sim ~0,30)
lido(y[4], [rosto(C1, larg=50)], T + 2115.4)                       # rosto pequeno de pessoa nova (< 60 px)
s5 = de(y[0])
ok(len(vivas()) == 1 and all(de(p) is s5 for p in y), "5/6: tudo na mesma sessão: %r" % [(x["card"], x["fotos"]) for x in vivas()])
ok(s5["dec"].get(y[1]) == "s" and s5["dec"].get(y[2]) == "s" and s5["dec"].get(y[3]) == "d" and s5["dec"].get(y[4]) == "s",
   "5/6: decisões s, s, d, s: %r (sim criança %.2f)" % ([s5["dec"].get(p) for p in y], simf))
ok(0.25 <= simf < 0.38, "6: a criança sintética fica na zona de dúvida: %.3f" % simf)

# 7: rosto do fundo não separa nem entra nos guardados
reset()
z1 = add("carlos", T + 2400, cap=T + 2396)
z2 = add("carlos", T + 2403, cap=T + 2399)
lido(z1, [rosto(P1)], T + 2404)
est = rosto(EST, larg=70)
lido(z2, [rosto(P1, larg=200), est], T + 2404.1)
s7 = de(z1)
mem7 = [v for _, v in m.sess_rostos_mem[s7["card"]]]
ok(de(z2) is s7 and s7["dec"][z2] == "r" and max(dot(est[1], v) for v in mem7) < 0.25, "7: o estranho ao fundo não entra nos guardados")
z3 = add("carlos", T + 2406, cap=T + 2402)
lido(z3, [rosto(EST, larg=200)], T + 2406.5)
ok(de(z3) is not s7 and de(z3)["motivo"] == "rostos_novos", "7: o estranho em primeiro plano abre sessão nova")

# 9: prazo de 20 s sem leitura
reset()
w1 = add("carlos", T + 2700, cap=T + 2696)
w2 = add("carlos", T + 2703, cap=T + 2699)
w3 = add("carlos", T + 2705, cap=T + 2701)
tick(T + 2703 + 15)
ok(de(w2)["pend"] == [w2, w3], "9: antes do prazo continua pendente: %r" % de(w2)["pend"])
tick(T + 2703 + 21)
ok(de(w2)["dec"].get(w2) == "t" and de(w3)["pend"] == [w3], "9: depois do prazo vale o tempo (t) e a fila anda: %r %r" % (de(w2)["dec"], de(w3)["pend"]))
tick(T + 2705 + 21)
ok(not m.sess_espera and de(w3)["dec"].get(w3) == "t", "9: a fila da trilha esvazia")

# 11: cartão com cliques em 3 blocos separados por 2 min, chegando em 5 s
reset()
u0 = T + 3000
c11 = [add("samuel", u0 + i * 5 / 30, cap=u0 - 3600 + (i // 10) * 120 + (i % 10) * 2, s="cartao", serie="400000004444") for i in range(30)]
ss = sorted({de(p)["card"]: de(p) for p in c11}.values(), key=lambda x: x["cap0"])
ok(len(ss) == 3 and all(x["atrasada"] and x["trilha"] == "atrasada" for x in ss) and [len(x["fotos"]) + len(x["pend"]) for x in ss] == [10, 10, 10],
   "11: 3 sessões atrasadas de 10: %r" % [(len(x["fotos"]), len(x["pend"]), x["atrasada"]) for x in ss])
ok([x["fechada_por"] for x in ss[:2]] == ["pausa_clique", "pausa_clique"] and ss[2]["status"] == "aberta", "11: as duas primeiras fecham durante a leitura")
ok(ss[1]["motivo"] == "pausa" and ss[0]["fonte_t"] == "cap", "11: motivo pausa e hora do clique")
tick(u0 + 5 + 61)
ok(ss[2]["status"] == "fechada" and ss[2]["fechada_por"] == "pausa", "11: a última fecha 60 s depois")

# C1 (revisão): câmera com o relógio 1 h ADIANTADO. A foto ao vivo ensina o desvio; o cartão da mesma câmera, com 3 blocos de
# cliques separados por 2 min, vira 3 sessões atrasadas pela hora corrigida (antes caía tudo na chegada: uma sessão só)
reset(); LIG[0] = False
uc = T + 3150
add("samuel", uc, cap=uc + 3600, s="ftp", serie="990000009999")
cc = [add("samuel", uc + 30 + i * 5 / 30, cap=uc + 3600 - 3000 + (i // 10) * 120 + (i % 10) * 2, s="cartao", serie="990000009999") for i in range(30)]
sc = sorted({de(p)["card"]: de(p) for p in cc}.values(), key=lambda x: x["cap0"])
ok(len(sc) == 3 and all(x["atrasada"] and x["fonte_t"] == "cap" for x in sc) and abs(sc[0]["cap0"] - (uc - 3000)) < 1,
   "C1: cartão da câmera adiantada = 3 sessões pela hora corrigida: %r" % [(len(x["fotos"]), x["fonte_t"], round(x["cap0"] - uc)) for x in sc])
LIG[0] = True
# desvio da série (revisão, 01/11): um valor fora da curva (EXIF forjado, foto que chegou estranha) não puxa a hora das outras
ok(abs(m.sess_desvio([3.0, 2.5, 4.0, 3.2, -5000.0]) - 2.5) < 1e-6, "desvio: valor fora da curva descartado: %r" % m.sess_desvio([3.0, 2.5, 4.0, 3.2, -5000.0]))
ok(abs(m.sess_desvio([3600.5, 3601.0, 3602.0]) - 3600.5) < 1e-6 and m.sess_desvio([7.0]) == 7.0, "desvio: série normal fica com o menor atraso")

# 12: ao vivo e cartão juntos, do mesmo fotógrafo
reset(); LIG[0] = False
u1 = T + 3300
mix = []
for i in range(20):
    mix.append(("c", add("samuel", u1 + i * 0.25, cap=u1 - 5400 + i * 3, s="cartao", serie="400000004444")))
    if i % 4 == 0:
        mix.append(("v", add("samuel", u1 + i * 0.25 + 0.1, cap=u1 + i * 0.25 - 4, s="ftp", serie="400000004444")))
tipo = {p: k for k, p in mix}
ok(all(len({tipo[p] for p in x["fotos"]}) == 1 for x in vivas()), "12: nenhuma sessão mistura ao vivo e cartão")
ok(all(x["atrasada"] == (tipo[x["fotos"][0]] == "c") for x in vivas()), "12: só as do cartão são atrasadas")
LIG[0] = True

# 13: EXIF forjado
reset(); LIG[0] = False
e1 = add("carlos", T + 3600, cap=978307200.0)                 # 2001
e2 = add("carlos", T + 3610, cap=T + 3610 + 86400)            # amanhã
ok(de(e1) is de(e2) and de(e1)["fonte_t"] == "u" and de(e1)["cap1"] == T + 3610, "13: EXIF forjado cai na chegada: %r" % (de(e1)["fonte_t"],))
e3 = add("carlos", T + 3620, mt=T + 3618)
ok(de(e3) is de(e1), "13: sem cap, a data do arquivo (mt) vale")
LIG[0] = True

# 14: vários fotógrafos, mesma família
reset()
v14 = []
for i in range(6):
    who = "carlos" if i % 2 == 0 else "samuel"
    v14.append((who, add(who, T + 3900 + i * 1.5, cap=T + 3896 + i * 1.5)))
for who, p in v14:
    lido(p, [rosto(P1), rosto(P2)], T + 3912)
ok(len(vivas()) == 2 and all(len({w for w, p in v14 if p in x["fotos"]}) == 1 for x in vivas()), "14: uma sessão por fotógrafo")

# 15: sessão fechada não muda
reset()
h1 = add("carlos", T + 4200, cap=T + 4196)
lido(h1, [rosto(P1)], T + 4200.5)
tick(T + 4200 + 61)
sf = de(h1)
antes = (list(sf["fotos"]), sf["rev"])
h2 = add("carlos", T + 4262, cap=T + 4210)                     # chegou atrasada, clique 14 s depois do da fechada
lido(h2, [rosto(P1)], T + 4262.5)
ok(de(h2) is not sf and (list(sf["fotos"]), sf["rev"]) == antes and sf["status"] == "fechada", "15: a fechada mantém fotos e rev")

# 19: prioridade na fila de rostos
while not m.fila_rostos.empty():
    m.fila_rostos.get()
for i in range(200):
    m.rostos_enfileira("%012x" % (0xc00000000000 + i), "/x/%d.jpg" % i, 1)
m.rostos_enfileira("%012x" % 0xd00000000001, "/x/nova.jpg", 0, time.time())
pri = m.fila_rostos.get()
ok(pri[0] == 0 and pri[2] == "%012x" % 0xd00000000001, "19: a foto nova sai antes das 200 do boot: %r" % (pri[:3],))
seg = m.fila_rostos.get()
ok(seg[2] == "%012x" % 0xc00000000000, "19: depois, as do boot na ordem em que entraram")
while not m.fila_rostos.empty():
    m.fila_rostos.get()

# 20: Fila = sessões (cenário do critério 2, no relógio de agora)
m.rostos["ligado"], m.rostos["motivo"] = True, None
T2 = time.time()
f, g = familia_e_grupo(T2)
for p in f + g:
    m.ff_rosto_fila(p)
for p in f + g[:1]:
    m.ff_rosto_lido(p)
fj = m.ff_json(T2 + 12)
cards = {de(f[0])["card"], de(g[0])["card"]}
ok({x["id"] for x in fj["grupos"]} == cards and fj["pausa"] == 60, "20: a Fila mostra as 2 sessões com o código LP: %r %r" % ([x["id"] for x in fj["grupos"]], cards))
ok({x["id"]: x["n"] for x in fj["grupos"]} == {de(f[0])["card"]: 3, de(g[0])["card"]: 2}, "20: n de cada grupo")
fj = m.ff_json(T2 + 9 + 2 + 62)
gg = {x["id"]: x["estado"] for x in fj["grupos"]}
ok(gg.get(de(f[0])["card"]) == "pronta" and gg.get(de(g[0])["card"]) == "subindo", "20: pronta só fechada e com os rostos lidos: %r" % gg)
m.ff_rosto_lido(g[1])
gg = {x["id"]: x["estado"] for x in m.ff_json(T2 + 9 + 2 + 63)["grupos"]}
ok(gg.get(de(g[0])["card"]) == "pronta", "20: leitura terminada = pronta: %r" % gg)
feed = m.sess_feed(0)
ok(cards <= {x["card"] for x in feed["sessoes"]} and feed["rostos"] is True and feed["pausa"] == 60, "20: os mesmos códigos no /sessoes")
campos = {"card", "dia", "fotografo", "fonte", "ponto", "trilha", "atrasada", "status", "motivo", "aberta_em", "ultima_chegada", "cap0",
          "cap1", "fonte_t", "fechada_em", "fechada_por", "fotos", "pend", "dec", "sim_abertura", "fundida_em", "removida", "rev"}
x0 = [x for x in feed["sessoes"] if x["card"] in cards][0]
ok(campos <= set(x0) and not [k for k in x0 if k.startswith("_") or k == "k"], "contrato de /sessoes: faltam %r; internos %r" % (campos - set(x0), [k for k in x0 if k.startswith("_") or k == "k"]))
ok(m.sess_feed(0, ontem=True)["rev"] == feed["rev"], "?ontem=1 responde")

# 16: LGPD (memória, pendente, rostos guardados e o arquivo de 10 dias atrás)
reset()
q1 = add("carlos", T2 + 200, cap=T2 + 196)
q2 = add("carlos", T2 + 203, cap=T2 + 199)
lido(q1, [rosto(P1)], T2 + 203.5)
ok(q2 in de(q2)["pend"] and any(p == q1 for p, _ in m.sess_rostos_mem[de(q1)["card"]]), "16: antes, pendente e rostos guardados")
d10 = m._ff_hoje(time.time() - 10 * 86400)
os.makedirs(m.SESS_DIR, exist_ok=True)
json.dump({"dia": d10, "sessoes": [{"card": "LPVELHA234", "dia": d10, "k": d10 + "|carlos", "status": "fechada", "fotos": [q1, "aaaaaaaaaaaa"], "dec": {q1: "r"}}]},
          open(os.path.join(m.SESS_DIR, d10 + ".json"), "w"))
for p in (q1, q2):
    fp = os.path.join(HA, p + ".jpg")
    open(fp, "wb").write(b"x")
    m.lib[p] = {"file": fp, "thumb": fp}
r16 = m.lgpd_excluir([q1, q2], [], quem="teste")
m.sess_gravar()
ok(r16["fotos"] == 2 and q1 not in m.sess_pid and q2 not in m.sess_info and not m.sess_espera and not m.sess_faces_pid, "16: sai da memória e das pendentes: %r" % r16)
ok(not any(p in (q1, q2) for mem in m.sess_rostos_mem.values() for p, _ in mem), "16: sai dos rostos guardados")
txt = "".join(open(os.path.join(m.SESS_DIR, n)).read() for n in os.listdir(m.SESS_DIR) if n.endswith(".json"))
ok(q1 not in txt and q2 not in txt and "aaaaaaaaaaaa" in txt, "16: grep no diretório de sessões não acha o pid")
lista_num = re.compile(r"\[\s*-?\d+(\.\d+)?(e-?\d+)?(\s*,\s*-?\d+(\.\d+)?(e-?\d+)?){16,}\s*\]")
ok(not lista_num.search(txt) and not lista_num.search(json.dumps(m.sess_feed(0))), "16: nenhum vetor em arquivo de sessão nem no /sessoes")

# 17: retenção de 60 dias
for dias in (61, 59):
    d = m._ff_hoje(time.time() - dias * 86400)
    json.dump({"dia": d, "sessoes": []}, open(os.path.join(m.SESS_DIR, d + ".json"), "w"))
m.sess_limpar()
ok(not os.path.exists(os.path.join(m.SESS_DIR, m._ff_hoje(time.time() - 61 * 86400) + ".json")) and
   os.path.exists(os.path.join(m.SESS_DIR, m._ff_hoje(time.time() - 59 * 86400) + ".json")), "17: 61 dias apaga, 59 fica")

# 18: reinício com sessão aberta
reset(); LIG[0] = False
r1 = add("marinara", T2 + 500, cap=T2 + 497)
card18 = de(r1)["card"]
m.sess_gravar()
reset()
m.sess_carregar(agora=T2 + 505)
ok(m.sess.get(card18, {}).get("fechada_por") == "reinicio" and m.sess[card18]["status"] == "fechada", "18: a aberta volta fechada por reinício: %r" % m.sess.get(card18))
r2 = add("marinara", T2 + 506, cap=T2 + 503)
ok(de(r2)["card"] != card18 and de(r2)["motivo"] in ("inicio", "pausa"), "18: a foto nova abre sessão nova: %r" % (de(r2)["motivo"],))

# boot: fotos sem sessão reagrupadas com os rostos do rostos.db (sem score/pose no banco: nunca votam por sessão nova)
import array as _array
reset()
db = m.rostos_db()
orfas = []
for i, base in enumerate((P1, P1, EST)):
    pid = "%012x" % (0xe00000000000 + i)
    orfas.append(pid)
    m.meta[pid] = {"o": "carlos", "s": "ftp", "u": T2 + 700 + i * 3, "cap": T2 + 697 + i * 3}
    m.lib[pid] = {"file": "/x", "thumb": "/x"}
    db.execute("insert or replace into foto values (?,?,?,?)", (pid, m._ff_hoje(T2), 1, time.time()))
    db.execute("insert into rosto values (?,?,?,?)", (pid, m._ff_hoje(T2), 200.0, _array.array("f", rosto(base)[1]).tobytes()))
db.commit(); db.close()
m.sess_carregar(agora=T2 + 760)
sb = de(orfas[0])
ok(sb and all(de(p) is sb for p in orfas) and sb["motivo"] == "reagrupada" and sb["fechada_por"] == "reinicio" and sb["dec"].get(orfas[1]) == "r" and sb["dec"].get(orfas[2]) == "s",
   "boot: reagrupadas com os rostos do banco: %r" % ((sb and (sb["motivo"], sb["fechada_por"], sb["dec"])),))
ok(not m.sess_rostos_mem, "boot: nenhum vetor fica em memória depois de fechar")

# v91 parte B: a venda achada pela selfie junta várias sessões; o evento guarda as sessões (só códigos válidos)
ev = m._ev_limpo({"tipo": "criar", "idem": "vtest01:1", "venda": "vtest01", "dados": {"card": "LPAAAA111", "sessoes": ["LPAAAA111", "LPBBBB222", "<script>", "lp minúsculo"], "total": 190}})
ok(ev and ev["dados"].get("sessoes") == ["LPAAAA111", "LPBBBB222"], "parte B: evento criar guarda as sessões da venda: %r" % (ev and ev["dados"]))

# segurança 5: as fotos do manifesto precisam ser das sessões do manifesto (e de m.so na galeria da venda que juntou sessões)
reset()
with m.sess_lock:
    m.sess["LPGALSEG1"] = {"card": "LPGALSEG1", "dia": m._ff_hoje(), "k": "x", "status": "fechada", "fotos": ["aaaaaaaaaaa1", "aaaaaaaaaaa2"], "pend": [], "removida": False}
def conf(mf, fotos):
    try:
        m._gal_confere_sessoes(mf, fotos); return True
    except ValueError:
        return False
F = lambda pid, ses="LPGALSEG1": {"id": "ag_" + pid, "sessao": ses}
ok(conf({"sessoes": ["LPGALSEG1"]}, [F("aaaaaaaaaaa1")]), "seg 5: foto da sessão passa")
with m.sess_lock:
    m.sess["LPGALSEG2"] = {"card": "LPGALSEG2", "dia": m._ff_hoje(), "k": "y", "status": "fechada", "fotos": ["bbbbbbbbbbb1"], "pend": [], "removida": False}
    m.sess_pid["bbbbbbbbbbb1"] = "LPGALSEG2"
ok(not conf({"sessoes": ["LPGALSEG1"]}, [F("bbbbbbbbbbb1")]), "seg 5: foto de outra sessão do agente (outra família) é recusada")
ok(not conf({"sessoes": ["LPGALSEG1"]}, [F("bbbbbbbbbbb1", "LPGALSEG1")]), "seg 5: dizer que a foto é da sessão não engana")
ok(not conf({"sessoes": ["LPGALSEG1"], "so": {"LPGALSEG1": ["ag_aaaaaaaaaaa1"]}}, [F("aaaaaaaaaaa2")]), "seg 5: foto fora de m.so é recusada")
ok(conf({"sessoes": ["LPDESCONH"]}, [F("ccccccccccc1", "LPDESCONH")]), "seg 5: sessão que o agente não conhece fica só com a primeira regra")

# ======================= Parte B: o agente de verdade =======================
from PIL import Image


def jpeg(cor=(30, 90, 160), cap=None, serie=None):
    im = Image.new("RGB", (320, 240), cor)
    ex = Image.Exif()
    sub = ex.get_ifd(0x8769)
    if cap:
        sub[0x9003] = time.strftime("%Y:%m:%d %H:%M:%S", time.localtime(cap))
    if serie:
        sub[0xA431] = serie
    b = io.BytesIO()
    im.save(b, "JPEG", quality=80, exif=ex.tobytes())
    return b.getvalue()


HB = tempfile.mkdtemp()
FTPP = PORTA + 1000
env = {**os.environ, "HOME": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(FTPP), "ETERNA_APP_ORIGIN": "http://127.0.0.1:9",
       "ETERNA_SEM_OPENCV": "1", "ETERNA_SESSAO_PAUSA": "3", "ETERNA_LEITORES": "1", "USER": "eterna-teste-sem-cartao"}
env.pop("ETERNA_PASTA", None)
env.pop("ETERNA_ORIGENS", None)


def req(path):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    try:
        c.request("GET", path, headers={"Host": "127.0.0.1:%d" % PORTA})
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
    p = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    for _ in range(80):
        time.sleep(0.25)
        if req("/status")[0] == 200:
            return p
    p.kill()
    raise SystemExit(json.dumps({"ok": False, "falhas": falhas + ["agente não subiu: " + p.stdout.read().decode()[-400:]]}))


procs = []
try:
    A = subir(); procs.append(A)
    senhas = json.load(open(os.path.join(HB, "Eterna", "ftp.json")))["users"]
    s, st = req("/status")
    ss = (st or {}).get("sessoes") or {}
    ok(ss.get("v") == 2 and ss.get("pausa") == 3 and ss.get("rostos") is False, "B: /status.sessoes v2, pausa e rostos false: %r" % ss)
    t = int(time.time()) - 1
    f = ftplib.FTP(); f.connect("127.0.0.1", FTPP, timeout=10); f.login("carlos", senhas["carlos"])
    for i in range(3):
        f.storbinary("STOR B%d.JPG" % i, io.BytesIO(jpeg((i * 50, 90, 160), cap=t + i, serie="100000001111")))
    f.quit()
    s, j = req("/sessoes?desde=0")
    ab = [x for x in (j or {}).get("sessoes", []) if x["fotografo"] == "carlos"]
    ok(s == 200 and len(ab) == 1 and ab[0]["status"] == "aberta" and len(ab[0]["fotos"]) == 3 and ab[0]["fonte_t"] == "cap" and j["rostos"] is False,
       "B: uma sessão aberta com 3 fotos pela hora do clique: %r" % ab)
    s, fl = req("/fila-fotografo")
    ok(s == 200 and [g["id"] for g in fl["grupos"]] == [ab[0]["card"]] if ab else False, "B: a Fila usa o mesmo código LP: %r" % (fl and fl.get("grupos")))
    ok("100000001111" not in json.dumps(j) and not re.search(r"\[\s*-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?){16,}\s*\]", json.dumps(j)), "B: sem série completa nem vetor no /sessoes")
    time.sleep(2.3)                          # o sess_loop grava o arquivo do dia a cada 2 s (ainda aberta: pausa de 3 s)
    A.terminate(); A.wait(10)
    A = subir(); procs.append(A)
    s, j = req("/sessoes?desde=0")
    x = [x for x in (j or {}).get("sessoes", []) if ab and x["card"] == ab[0]["card"]]
    ok(x and x[0]["status"] == "fechada" and x[0]["fechada_por"] in ("reinicio", "pausa") and len(x[0]["fotos"]) == 3, "B: depois de reiniciar, a sessão volta fechada: %r" % x)
    # queda entre a chegada e a gravação: as fotos sem sessão são reagrupadas no boot e fecham por reinício
    f = ftplib.FTP(); f.connect("127.0.0.1", FTPP, timeout=10); f.login("samuel", senhas["samuel"])
    for i in range(2):
        f.storbinary("STOR R%d.JPG" % i, io.BytesIO(jpeg((i * 70, 20, 60))))
    f.quit()
    A.kill(); A.wait(10)
    for n in os.listdir(os.path.join(HB, "Eterna", "ponto", "sessoes")):   # caiu antes de gravar: nenhuma sessão no disco
        os.remove(os.path.join(HB, "Eterna", "ponto", "sessoes", n))
    A = subir(); procs.append(A)
    s, j = req("/sessoes?desde=0")
    x = sorted([(x["fotografo"], len(x["fotos"]), x["motivo"], x["fechada_por"]) for x in (j or {}).get("sessoes", [])])
    ok(x == [("carlos", 3, "reagrupada", "reinicio"), ("samuel", 2, "reagrupada", "reinicio")], "B: fotos sem sessão reagrupadas no boot: %r" % x)
finally:
    for p in procs:
        try:
            p.kill()
        except Exception:
            pass
falhas = [x for x in falhas if x]
print(json.dumps({"ok": not falhas, "falhas": falhas}))
print(("OK sessoes_agente: critérios 1 a 20 do plano v91 (rostos sintéticos)" if not falhas else "FALHA sessoes_agente: " + " | ".join(falhas[:6])))
sys.exit(0 if not falhas else 1)
