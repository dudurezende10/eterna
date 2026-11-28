# 26/11: número curto da sessão (docs/planos/2026-11-26-numero-da-sessao.md). Cada sessão ganha "num", o número do dia
# (1, 2, 3...), dado pelo agente e guardado no arquivo do dia. O card LP não muda. Roda sozinho (testes/rodar.sh) com HOME
# temporário, nos moldes da Parte A do sessoes_agente.py (módulo importado, relógio injetado, sem rostos, sem OpenCV):
#   python3 -I testes/sessao_numero_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, tempfile, time

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["USERPROFILE"] = HA      # Windows: o expanduser("~") lê o USERPROFILE, não o HOME
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ.pop("ETERNA_SESSAO_PAUSA", None)
os.environ.pop("ETERNA_SESS_LIMITES", None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12, "samuel": "y" * 12, "marinara": "z" * 12}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.sess_rostos_on = lambda: False    # só tempo: a numeração não depende de rosto
PZ = m.SESS_PAUSA
_seq = [0]


def reset(tudo=True):
    """Memória zerada, como um agente que acabou de ligar (o disco fica)."""
    with m.sess_lock:
        for d in (m.sess, m.sess_pid, m.sess_aberta, m.sess_cand, m.sess_ultima, m.sess_espera, m.sess_info,
                  m.sess_faces_pid, m.sess_rostos_mem, m.ff_desvio):
            d.clear()
        m.sess_sujo.clear()
        if tudo:
            m.sess_num.clear()


def limpa_disco():
    if os.path.isdir(m.SESS_DIR):
        for n in os.listdir(m.SESS_DIR):
            os.remove(os.path.join(m.SESS_DIR, n))


def add(o, u, cap=None, s="ftp"):
    _seq[0] += 1
    pid = "%012x" % (0xc00000000000 + _seq[0])
    md = {"o": o, "s": s, "u": u}
    if cap is not None:
        md["cap"] = cap
    cad = m.ff_cadastrados()
    with m.sess_lock:
        m._sess_add(pid, md, cad, agora=u)
    return pid


def de(pid):
    return m.sess.get(m.sess_pid.get(pid) or "")


def arq(d):
    return os.path.join(m.SESS_DIR, d + ".json")


def ler(d):
    return json.load(open(arq(d), encoding="utf8"))


def tres(T0, quem="carlos"):
    """Três sessões separadas pela pausa. Devolve um pid de cada."""
    return [add(quem, T0 + i * (PZ + 30), cap=T0 + i * (PZ + 30) - 3) for i in range(3)]


T = time.time()
_lt = time.localtime(T)
if _lt.tm_hour * 3600 + _lt.tm_min * 60 + _lt.tm_sec > 86400 - 3 * 3600:
    T -= 3 * 3600                   # perto da meia-noite os cenários (até T + 1 h) cruzariam o dia: o relógio injetado recua 3 h
HOJE = m._ff_hoje(T)
ONTEM = m._ff_hoje(T - 86400)

# 1: numeração 1, 2, 3 na ordem em que as sessões nascem; o card LP continua como era
reset(); limpa_disco()
p = tres(T)
ok([de(x)["num"] for x in p] == [1, 2, 3], "1: 1, 2, 3 na ordem: %r" % [de(x)["num"] for x in p])
ok(all(de(x)["card"].startswith("LP") and len(de(x)["card"]) == 9 for x in p), "1: o card LP não muda")
ok(m.sess_num.get(HOJE) == 3, "1: último número do dia em memória: %r" % m.sess_num)
feed = {x["card"]: x for x in m.sess_feed(0)["sessoes"]}
ok([feed[de(x)["card"]].get("num") for x in p] == [1, 2, 3], "1: o número vai no /sessoes")
ok(m._sess_codigo().startswith("LP"), "1: _sess_codigo segue LP")

# 2: persistência. Gravar, religar e carregar devolve os mesmos números; a sessão nova continua do 4
cards = [de(x)["card"] for x in p]
m.sess_tick(T + 3 * (PZ + 30) + PZ + 5)
m.sess_gravar()
j = ler(HOJE)
ok(j.get("num") == 3 and sorted(x["num"] for x in j["sessoes"]) == [1, 2, 3], "2: arquivo com num no topo e em cada sessão: %r" % j.get("num"))
reset()
m.sess_carregar(agora=T + 1000)
ok([m.sess[c]["num"] for c in cards] == [1, 2, 3], "2: mesmos números depois de religar: %r" % [m.sess[c].get("num") for c in cards])
p4 = add("carlos", T + 1100, cap=T + 1097)
ok(de(p4)["num"] == 4, "2: a próxima depois de religar é a 4: %r" % de(p4)["num"])

# 3: fusão. A que fica mantém o número; o da origem é aposentado e nunca volta
reset(); limpa_disco()
a, b = add("carlos", T, cap=T - 3), add("carlos", T + PZ + 30, cap=T + PZ + 27)
sa, sb = de(a), de(b)
ok((sa["num"], sb["num"]) == (1, 2), "3: antes da fusão 1 e 2")
with m.sess_lock:
    m._sess_fundir(sa, sb, T + PZ + 40)
ok(sa["num"] == 1 and not sa["removida"] and sb["removida"] and sb["fundida_em"] == sa["card"] and sb["num"] == 2,
   "3: a que fica mantém o 1; a origem sai com o 2: %r" % ((sa["num"], sb["num"], sb["removida"]),))
c = add("samuel", T + 2 * PZ + 100, cap=T + 2 * PZ + 97)
ok(de(c)["num"] == 3, "3: a sessão seguinte é a 3 (o 2 não é reusado): %r" % de(c)["num"])

# 4: sessão removida (LGPD) não devolve o número, nem depois de religar
reset(); limpa_disco()
p = tres(T)
card2 = de(p[1])["card"]
m._sess_esquecer(p[1])
ok(m.sess[card2]["removida"] and m.sess[card2]["num"] == 2, "4: a removida guarda o número dela")
n = add("samuel", T + 4 * (PZ + 30), cap=T + 4 * (PZ + 30) - 3)
ok(de(n)["num"] == 4, "4: depois da remoção a próxima é a 4: %r" % de(n)["num"])
m.sess_tick(T + 5 * (PZ + 30) + PZ)
m.sess_gravar()
reset()
m.sess_carregar(agora=T + 2000)
n2 = add("samuel", T + 2100, cap=T + 2097)
ok(de(n2)["num"] == 5 and m.sess[card2]["num"] == 2, "4: religado, a próxima é a 5: %r" % de(n2)["num"])
# o número do topo vale mesmo quando a sessão dona dele some do arquivo
reset(); limpa_disco()
os.makedirs(m.SESS_DIR, exist_ok=True)
json.dump({"dia": HOJE, "num": 9, "sessoes": [
    {"card": "LPTOPOAAA", "num": 1, "dia": HOJE, "k": HOJE + "|carlos", "status": "fechada", "fotos": ["aaaaaaaaaa01"], "aberta_em": T - 500}]},
    open(arq(HOJE), "w"))
m.sess_carregar(agora=T)
n3 = add("carlos", T + 10, cap=T + 7)
ok(de(n3)["num"] == 10, "4: o num do topo do arquivo impede o reuso: %r" % de(n3)["num"])


def velha(card, d, **mais):
    x = {"card": card, "dia": d, "k": d + "|carlos", "status": "fechada", "fotos": ["f" + card[2:].lower().rjust(11, "0")], "aberta_em": T - 900}
    x.update(mais)
    return x


# 5: arquivo de hoje sem num, com 5 sessões (uma removida): 1 a 5 na ordem do arquivo; idempotente
reset(); limpa_disco()
C5 = ["LPSEMNUM%d" % i for i in range(1, 6)]
json.dump({"dia": HOJE, "sessoes": [velha(c, HOJE, **({"removida": True, "fotos": []} if c == C5[2] else {})) for c in C5]}, open(arq(HOJE), "w"))
m.sess_carregar(agora=T)
ok([m.sess[c]["num"] for c in C5] == [1, 2, 3, 4, 5], "5: arquivo antigo numerado 1 a 5 na ordem: %r" % [m.sess[c].get("num") for c in C5])
ok(m.sess[C5[2]]["removida"] and m.sess_num.get(HOJE) == 5, "5: a removida também recebe")
j = ler(HOJE)
ok(j.get("num") == 5 and [x["num"] for x in j["sessoes"]] == [1, 2, 3, 4, 5], "5: gravado no arquivo")
revs = {c: m.sess[c]["rev"] for c in C5}
ok(all(revs[c] > 0 for c in C5), "5: rev novo para os navegadores receberem o número")
reset()
m.sess_carregar(agora=T + 5)
ok([m.sess[c]["num"] for c in C5] == [1, 2, 3, 4, 5] and {c: m.sess[c]["rev"] for c in C5} == revs,
   "5: carregar de novo não muda número nem rev")

# 6: num repetido e num inválido. A segunda na ordem do arquivo recebe o próximo
reset(); limpa_disco()
C6 = ["LPREPETE%d" % i for i in range(1, 6)]
nums6 = [2, 2, True, "7", 0]
json.dump({"dia": HOJE, "sessoes": [velha(c, HOJE, num=v) for c, v in zip(C6, nums6)]}, open(arq(HOJE), "w"))
m.sess_carregar(agora=T)
ok([m.sess[c]["num"] for c in C6] == [2, 3, 4, 5, 6], "6: repetido, bool, texto e zero renumerados: %r" % [m.sess[c].get("num") for c in C6])
ok([m._sess_num_ok(v) for v in (1, 99999, 0, -1, 100000, True, 1.0, "3", None)] == [1, 99999, None, None, 100000, None, None, None, None],
   "6: num válido é inteiro de 1 em diante, sem teto")
# número acima de 99999 é estável: não é renumerado na partida seguinte e a próxima sessão continua dele
reset(); limpa_disco()
json.dump({"dia": HOJE, "num": 100000, "sessoes": [velha("LPGRANDE1", HOJE, num=100000)]}, open(arq(HOJE), "w"))
m.sess_carregar(agora=T)
rv = m.sess["LPGRANDE1"].get("rev")
g6 = add("carlos", T + 10, cap=T + 7)
ok(m.sess["LPGRANDE1"]["num"] == 100000 and de(g6)["num"] == 100001, "6: número alto fica e a seguinte continua: %r" % de(g6)["num"])
m.sess_tick(T + 10 + PZ + 5); m.sess_gravar(); reset()
m.sess_carregar(agora=T + 600)
ok(m.sess["LPGRANDE1"]["num"] == 100000 and m.sess[de(g6)["card"]]["num"] == 100001 and m.sess["LPGRANDE1"].get("rev") == rv,
   "6: número alto não é renumerado na partida seguinte")

# 7: arquivo de 10 dias atrás migrado; a segunda chamada não altera nada. Arquivo já numerado não é tocado
reset(); limpa_disco()
D10, D11, D12 = (m._ff_hoje(T - i * 86400) for i in (10, 11, 12))
C7 = ["LPDEZDIA%d" % i for i in range(1, 4)]
json.dump({"dia": D10, "sessoes": [velha(c, D10) for c in C7]}, open(arq(D10), "w"))
json.dump({"dia": D11, "num": 2, "sessoes": [velha("LPONZEAA1", D11, num=1), velha("LPONZEAA2", D11, num=2)]}, open(arq(D11), "w"))
open(arq(D12), "w").write("{isto não é json")
antes11 = open(arq(D11), "rb").read()
m.sess_carregar(agora=T)
n7 = m.sess_num_migrar()
j = ler(D10)
ok(n7 == 1 and j.get("num") == 3 and [x["num"] for x in j["sessoes"]] == [1, 2, 3] and [x["card"] for x in j["sessoes"]] == C7,
   "7: dia antigo migrado (%r arquivos): %r" % (n7, [x.get("num") for x in j["sessoes"]]))
ok(open(arq(D11), "rb").read() == antes11, "7: arquivo já numerado não é tocado")
ok(open(arq(D12)).read() == "{isto não é json", "7: arquivo ilegível fica como está e não derruba os outros")
ok(not [n for n in os.listdir(m.SESS_DIR) if n.endswith(".tmp")], "7: nenhum .tmp sobra")
antes10 = open(arq(D10), "rb").read()
ok(m.sess_num_migrar() == 0 and open(arq(D10), "rb").read() == antes10, "7: segunda chamada não altera")
MARCA = os.path.join(m.SESS_DIR, m.SESS_NUM_MARCA)
ok(not os.path.exists(MARCA), "7: passada com erro não deixa a marca (tenta de novo na partida seguinte)")
os.remove(arq(D12))
ok(m.sess_num_migrar() == 0 and os.path.exists(MARCA), "7: passada sem erro deixa a marca de migrado")
D13 = m._ff_hoje(T - 13 * 86400)
json.dump({"dia": D13, "sessoes": [velha("LPTREZEA1", D13)]}, open(arq(D13), "w"))
antes13 = open(arq(D13), "rb").read()
ok(m.sess_num_migrar() == 0 and open(arq(D13), "rb").read() == antes13, "7: com a marca, a partida seguinte não relê os arquivos")
os.remove(arq(D13))
m.sess_limpar(T)
ok(os.path.exists(MARCA) and os.path.exists(arq(D10)), "7: a limpeza de 60 dias não apaga a marca")
# LGPD nos arquivos antigos (sess_esquecer_disco) preserva os números
pid10 = ler(D10)["sessoes"][1]["fotos"][0]
m.sess_esquecer_disco([pid10])
j = ler(D10)
ok(j.get("num") == 3 and [x["num"] for x in j["sessoes"]] == [1, 2, 3] and j["sessoes"][1]["fotos"] == [] and j["sessoes"][1].get("removida") is True,
   "7: a LGPD no arquivo antigo tira a foto e mantém os números: %r" % [(x.get("num"), x.get("fotos")) for x in j["sessoes"]])
ok(D10 not in m.sess_num and not any(c in m.sess for c in C7), "7: a migração não põe dia antigo na memória")

# 8: dia novo começa em 1; cartão de ontem que chega hoje recebe número de hoje
reset(); limpa_disco()
o1 = add("carlos", T - 86400, cap=T - 86400 - 3)
o2 = add("carlos", T - 86400 + PZ + 30, cap=T - 86400 + PZ + 27)
h1 = add("carlos", T, cap=T - 3)
ok((de(o1)["dia"], de(o1)["num"], de(o2)["num"]) == (ONTEM, 1, 2) and (de(h1)["dia"], de(h1)["num"]) == (HOJE, 1),
   "8: cada dia começa em 1: %r" % [(de(x)["dia"], de(x)["num"]) for x in (o1, o2, h1)])
k1 = add("samuel", T + 20, cap=T - 86400 + 3600, s="cartao")
ok(de(k1)["dia"] == HOJE and de(k1)["num"] == 2 and de(k1)["atrasada"], "8: cartão de ontem que chega hoje é a 2 de hoje: %r" % ((de(k1)["dia"], de(k1)["num"]),))

# 9: fotos sem sessão reagrupadas no boot recebem número maior que os do arquivo
reset(); limpa_disco()
json.dump({"dia": HOJE, "sessoes": [velha("LPBOOTAA1", HOJE), velha("LPBOOTAA2", HOJE)]}, open(arq(HOJE), "w"))
orfas = []
for i in range(2):
    pid = "%012x" % (0xd00000000000 + i)
    orfas.append(pid)
    m.meta[pid] = {"o": "marinara", "s": "ftp", "u": T + 50 + i * 3, "cap": T + 47 + i * 3}
    m.lib[pid] = {"file": "/x", "thumb": "/x"}
m.sess_carregar(agora=T + 100)
sb = de(orfas[0])
ok(sb and sb["motivo"] == "reagrupada" and sb["num"] == 3 and (m.sess["LPBOOTAA1"]["num"], m.sess["LPBOOTAA2"]["num"]) == (1, 2),
   "9: reagrupada no boot é a 3: %r" % (sb and sb.get("num"),))
for pid in orfas:
    m.meta.pop(pid, None); m.lib.pop(pid, None)

# 10: /fila-fotografo com num em cada grupo
reset(); limpa_disco()
T3 = time.time()
g1 = add("carlos", T3, cap=T3 - 3)
g2 = add("samuel", T3 + 1, cap=T3 - 2)
fj = m.ff_json(T3 + 5)
ok({x["id"]: x.get("num") for x in fj["grupos"]} == {de(g1)["card"]: 1, de(g2)["card"]: 2},
   "10: grupos da Fila com num: %r" % [(x["id"], x.get("num")) for x in fj["grupos"]])

# 11: o sess_gravar não deixa o número do topo cair abaixo do maior da lista
reset(); limpa_disco()
p = tres(T)
with m.sess_lock:
    m.sess_num.clear()
    m.sess_sujo.add(HOJE)
m.sess_gravar()
ok(ler(HOJE).get("num") == 3, "11: topo do arquivo nunca menor que o maior número: %r" % ler(HOJE).get("num"))

# 12: arquivo de hoje ilegível na partida. É guardado à parte e a numeração continua do número do topo
reset(); limpa_disco()
p = tres(T)
m.sess_tick(T + 3 * (PZ + 30) + PZ + 5); m.sess_gravar()
bom = open(arq(HOJE), encoding="utf8").read()
open(arq(HOJE), "w", encoding="utf8").write(bom[:len(bom) // 2])        # truncado no meio
reset()
m.sess_carregar(agora=T + 1000)
guard = [n for n in os.listdir(m.SESS_DIR) if n.startswith(HOJE + ".json.ilegivel-")]
ok(len(guard) == 1 and open(os.path.join(m.SESS_DIR, guard[0]), encoding="utf8").read() == bom[:len(bom) // 2],
   "12: o arquivo ilegível fica guardado à parte, inteiro: %r" % os.listdir(m.SESS_DIR))
n12 = add("carlos", T + 1100, cap=T + 1097)
ok(de(n12)["num"] == 4, "12: a numeração continua do número do topo (4): %r" % de(n12)["num"])
m.sess_gravar()
ok(os.path.exists(os.path.join(m.SESS_DIR, guard[0])) and ler(HOJE).get("num") == 4, "12: gravar depois não apaga o guardado")
# sem o número do topo legível: guarda e recomeça (não inventa)
reset(); limpa_disco()
open(arq(HOJE), "w", encoding="utf8").write("[1, 2, 3]")
m.sess_carregar(agora=T)
ok([n for n in os.listdir(m.SESS_DIR) if ".ilegivel-" in n] and m.sess_num.get(HOJE, 0) == 0, "12: arquivo que não é do formato é guardado e a numeração recomeça")
# o .tmp que sobrou e o ilegível antigo saem na limpeza de 60 dias; os recentes ficam
D70 = m._ff_hoje(T - 70 * 86400)
for nome in (D70 + ".json.tmp", D70 + ".json.ilegivel-101010", HOJE + ".json.tmp"):
    open(os.path.join(m.SESS_DIR, nome), "w").write("x")
m.sess_limpar(T)
resto = set(os.listdir(m.SESS_DIR))
ok(D70 + ".json.tmp" not in resto and D70 + ".json.ilegivel-101010" not in resto and HOJE + ".json.tmp" in resto,
   "12: a limpeza tira o .tmp e o ilegível antigos: %r" % sorted(resto))
os.remove(os.path.join(m.SESS_DIR, HOJE + ".json.tmp"))
# falha ao gravar não deixa .tmp pela metade
reset(); limpa_disco()
tres(T)
_dump = m.json.dump


def _cheio(o, fh, *a, **k):
    fh.write('{"dia"')
    raise OSError(28, "No space left on device")


m.json.dump = _cheio
try:
    m.sess_gravar()
finally:
    m.json.dump = _dump
ok(not [n for n in os.listdir(m.SESS_DIR) if n.endswith(".tmp")] and HOJE in m.sess_sujo, "12: disco cheio não deixa .tmp e o dia fica para gravar de novo")
m.sess_gravar()
ok(ler(HOJE).get("num") == 3, "12: a gravação seguinte funciona")
# a marca da migração não vai para o backup
open(os.path.join(m.SESS_DIR, m.SESS_NUM_MARCA), "w").write("x")
bl = [os.path.basename(a) for a in m.backup_arquivos_lista()]
ok(m.SESS_NUM_MARCA not in bl and HOJE + ".json" in bl, "12: a marca fica fora do backup: %r" % bl)

falhas = [x for x in falhas if x]
print(json.dumps({"ok": not falhas, "falhas": falhas}))
print("OK sessao_numero_agente: número curto do dia, estável, sem reuso, migração e Fila" if not falhas else "FALHA sessao_numero_agente: " + " | ".join(falhas[:6]))
sys.exit(0 if not falhas else 1)
