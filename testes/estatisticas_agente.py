# v92: estatísticas no agente (plano docs/planos/2026-11-05-estatisticas.md, critérios 3 a 7, 10 (hora do servidor), 13 a 16,
# 24 a 27 e 29). Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/estatisticas_agente.py agente/eterna-agente.py [porta]
# Parte A: o módulo importado aqui (sem OpenCV). Parte B: o agente de verdade em outro processo (rotas, limites, migração
# e desempenho com 366 dias). Nenhum dado de cliente: vendas, entradas e sessões sintéticas.
import threading, importlib.util, inspect, json, os, random, re, subprocess, sys, tempfile, time, http.client

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
PORTA = int(sys.argv[2]) if len(sys.argv) > 2 else 8700 + random.randint(0, 80)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


# ======================= Parte A: no processo =======================
HA = tempfile.mkdtemp()
os.environ["HOME"] = HA
os.environ["USERPROFILE"] = HA
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12, "samuel": "y" * 12}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.sess_rostos_on = lambda: False

# --- critério 3 e 4: campos novos e inválidos ---
EM = time.time() - 60
base = {"tipo": "criar", "idem": "vst001:1", "venda": "vst001", "em": iso(EM),
        "dados": {"card": "LPAAAA111", "total": 220, "cart": [{"id": "tribuna", "v": 220}], "lang": "es", "canal": "checkout", "t0": iso(EM - 40)}}
e = m._ev_limpo(base)
d = (e or {}).get("dados") or {}
ok(d.get("lang") == "es" and d.get("canal") == "checkout" and d.get("cart") == [{"id": "tribuna", "v": 220.0}] and d.get("t0") == iso(EM - 40),
   "3: venda do Checkout guarda lang, canal, cart e t0: %r" % d)
bal = m._ev_limpo({**base, "dados": {"card": "LPAAAA112", "total": 70, "canal": "balcao", "cart": [{"id": "arq", "v": 70}]}})
ok(bal and bal["dados"].get("canal") == "balcao" and "lang" not in bal["dados"], "3: balcão com canal e sem lang: %r" % (bal and bal["dados"]))
ruim = m._ev_limpo({**base, "dados": {"card": "LPAAAA113", "total": 190, "cart": [{"id": "x", "v": 1}] * 31, "lang": "xx", "t0": iso(EM - 3 * 3600), "canal": "loja"}})
ok(ruim is not None and not any(k in ruim["dados"] for k in ("cart", "lang", "t0", "canal")) and ruim["dados"].get("total") == 190,
   "4: cart com 31 itens, lang xx, t0 de 3 h antes e canal errado saem; a venda fica: %r" % (ruim and ruim["dados"]))
ruim2 = m._ev_limpo({**base, "dados": {"card": "LPAAAA114", "total": 10, "cart": [{"id": "<b>", "v": 1}], "t0": iso(EM + 60)}})
ok(ruim2 is not None and "cart" not in ruim2["dados"] and "t0" not in ruim2["dados"], "4: item com id inválido e t0 depois de em saem")

# --- critério 15: faixas ---
h = m.h_novo()
for s in (20, 50, 400):
    m.h_add(h, s)
ok(h["n"] == 3 and h["f"] == [1, 1, 0, 0, 1, 0, 0] and h["soma"] == 470, "15: faixas de 20, 50 e 400 s: %r" % h)
m.h_add(h, -5); m.h_add(h, 90000)
ok(h["n"] == 3, "15: tempo negativo ou acima de 1 dia é descartado")

# --- critérios 13, 14, 16: um sábado com vendas e sessões ---
SAB = "2026-10-31"
t1040 = time.mktime(time.strptime(SAB + " 10:40:00", "%Y-%m-%d %H:%M:%S"))
evs = [
    {"tipo": "criar", "idem": "vsab1:1", "venda": "vsab1", "em": iso(t1040 - 90), "posto": "Caixa 1", "por": {"nome": "Ana"},
     "dados": {"card": "LPSAB0001", "total": 220, "cart": [{"id": "tribuna", "v": 220}], "lang": "es", "canal": "checkout", "t0": iso(t1040 - 150), "vendedor": {"nome": "Ana"}}},
    {"tipo": "pagar", "idem": "vsab1:2", "venda": "vsab1", "em": iso(t1040), "por": {"nome": "Ana"}, "dados": {}},
    {"tipo": "criar", "idem": "vsab2:1", "venda": "vsab2", "em": iso(t1040 + 3600), "dados": {"card": "LPSAB0002", "total": 190}},
    {"tipo": "pagar", "idem": "vsab2:2", "venda": "vsab2", "em": iso(t1040 + 3600), "dados": {}},
    {"tipo": "criar", "idem": "vsab3:1", "venda": "vsab3", "em": iso(t1040 + 7200), "dados": {"card": "LPSAB0003", "total": 70, "canal": "balcao", "lang": "en", "cart": [{"id": "arq", "v": 70}]}},   # balcão com lang fica fora do idioma
    {"tipo": "pagar", "idem": "vsab3:2", "venda": "vsab3", "em": iso(t1040 + 7200), "dados": {}},
    {"tipo": "criar", "idem": "vsab4:1", "venda": "vsab4", "em": iso(t1040 + 100), "dados": {"card": "LPSAB0004", "total": 999, "canal": "checkout", "lang": "pt"}},
]
r = m.ev_receber({"posto": "Caixa 1", "eventos": evs})
ok(all(x["s"] == "ok" for x in r["resultados"]), "eventos gravados: %r" % r)
os.makedirs(m.SESS_DIR, exist_ok=True)
ss = [
    {"card": "LPSAB0001", "dia": SAB, "k": SAB + "|carlos", "fotografo": "carlos", "trilha": "vivo", "atrasada": False, "status": "fechada",
     "aberta_em": t1040 - 600, "ultima_chegada": t1040 - 500, "cap0": t1040 - 610, "cap1": t1040 - 510, "fechada_em": t1040 - 450, "fechada_por": "pausa", "fotos": ["a1", "a2", "a3"], "pend": []},
    {"card": "LPSAB0005", "dia": SAB, "k": SAB + "|carlos|t", "fotografo": "carlos", "trilha": "atrasada", "atrasada": True, "status": "fechada",
     "aberta_em": t1040 + 9000, "ultima_chegada": t1040 + 9100, "cap0": t1040 - 20000, "cap1": t1040 - 19000, "fechada_em": t1040 + 9200, "fechada_por": "pausa", "fotos": ["b1"], "pend": []},
    {"card": "LPSAB0006", "dia": SAB, "k": SAB + "|samuel", "fotografo": "samuel", "trilha": "vivo", "atrasada": False, "status": "fechada",
     "aberta_em": t1040 + 30, "ultima_chegada": t1040 + 40, "cap0": t1040 + 20, "cap1": t1040 + 30, "fechada_em": t1040 + 4000, "fechada_por": "reinicio", "fotos": ["c1"], "pend": []},
]
json.dump({"dia": SAB, "sessoes": ss}, open(os.path.join(m.SESS_DIR, SAB + ".json"), "w"))
md = m.metricas_dia(SAB)
ok(md.get("v") == 2 and md["por_hora"].get("10", {}).get("vendas") == 1 and md["por_hora"]["10"]["faturamento"] == 220,
   "13: venda paga às 10:40 entra na barra das 10 h: %r" % md.get("por_hora"))
ok(time.localtime(t1040).tm_wday == 5, "13: o dia de teste é sábado")
ok(md["por_produto"].get("sem_detalhe") == {"n": 1, "receita": 190.0} and md["por_produto"].get("tribuna") == {"n": 1, "receita": 220.0}
   and "maracana" not in md["por_produto"], "14: venda sem cart vira sem_detalhe: %r" % md["por_produto"])
ok(md["por_idioma"] == {"es": {"vendas": 1, "faturamento": 220.0}}, "21: idioma só das vendas pagas do Checkout: %r" % md["por_idioma"])
ok(md["por_canal"].get("balcao", {}).get("vendas") == 1 and md["por_canal"].get("checkout", {}).get("vendas") == 1 and md["por_canal"].get("sem_canal", {}).get("vendas") == 1,
   "por canal: %r" % md["por_canal"])
T = md["tempos"]
ok(T["cliente_s"]["n"] == 1 and T["cliente_s"]["f"][2] == 1, "c: cliente no Checkout (t0 até criar = 60 s, faixa 1–2 min): %r" % T["cliente_s"])
ok(T["pagamento_s"]["n"] == 1 and T["pagamento_s"]["f"][2] == 1, "R3: confirmação só do Checkout (criar até pagar = 90 s; balcão e sem canal fora): %r" % T["pagamento_s"])
ok(md["por_confirmador"].get("Ana", {}).get("pagamento_s", {}).get("n") == 1 and set(md["por_confirmador"]) == {"Ana"}, "R4: tempo por quem confirmou: %r" % md["por_confirmador"])
ok(all("pagamento_s" not in v for v in md["por_vendedor"].values()) and set(md["por_vendedor"]) <= {"Ana", "sem vendedor"}, "R4: por_vendedor da v1 sem tempo de confirmação: %r" % md["por_vendedor"])
ok(T["clique_checkout_s"]["n"] == 1 and T["clique_checkout_s"]["f"][2] == 1 and T["transferencia_s"]["n"] == 2,
   "16: clique e transferência só da trilha vivo (reinício fora do clique): %r" % {k: T[k] for k in ("clique_checkout_s", "transferencia_s")})
ok(md["por_fotografo"]["carlos"].get("primeira_foto") == t1040 - 600 and md["por_fotografo"]["carlos"]["sessoes"] == 2,
   "b: 1ª foto (ao vivo) e campos v1 do fotógrafo: %r" % md["por_fotografo"]["carlos"])
ok(md["vendas"] == 3 and md["faturamento"] == 480 and md["sessoes"] == 3, "v1 continua igual: %r" % {k: md[k] for k in ("vendas", "faturamento", "sessoes")})

# --- critério 5 e 6: presença ---
hoje = m._ff_hoje()
m._pres_mem.clear()
t_foto = time.time() - 3000
m.meta["fffff0000001"] = {}
card = m.sess_add("fffff0000001", {"o": "carlos", "s": "ftp", "u": t_foto, "cap": t_foto - 2})
p = m.presenca_dia(hoje).get("carlos")
ok(card and p and p["fonte"] == "fotos" and abs(p["primeiro"] - t_foto) < 1 and p["n"] == 0, "6: 1ª foto atribuída sem login grava presença fotos: %r" % p)
m.sess_add("fffff0000002", {"o": "carlos", "s": "ftp", "u": t_foto + 5, "cap": t_foto + 3})
r1 = m.presenca_marca("carlos", time.time(), "login", "Caixa 1")
r2 = m.presenca_marca("carlos", time.time() + 5, "login", "Caixa 2")
p = m.presenca_dia(hoje).get("carlos")
ok(p["n"] == 2 and abs(p["primeiro"] - t_foto) < 1 and p["fonte"] == "fotos" and p["login"] and p["login"] > t_foto and p["postos"] == ["Caixa 1", "Caixa 2"],
   "5/6: login depois mantém primeiro (foto) e soma n; o 1º login fica guardado: %r" % p)
m.presenca_marca("samuel", time.time() - 100, "login")
m.presenca_marca("samuel", time.time() - 50, "login")
p = m.presenca_dia(hoje)["samuel"]
ok(p["n"] == 2 and p["fonte"] == "login", "5: segundo login soma 1 em n: %r" % p)
cart_tarde = m.sess_add("fffff0000003", {"o": "samuel", "s": "cartao", "u": time.time(), "cap": time.time() - 30000})
ok(m.presenca_dia(hoje)["samuel"]["fonte"] == "login" and m.presenca_dia(hoje)["samuel"].get("foto") is None, "6: foto do cartão (atrasada) não marca presença")

# --- critérios 24 e 25: entradas ---
dia_e = m._ff_hoje(time.time() - 3 * 86400)
segs = [10 * 3600 + 41 * 60 + i for i in range(9)] + [9 * 3600 + 1 * 60, 16 * 3600 + 58 * 60]
v, mot = m.entradas_validar({"origem": "bip", "dia": dia_e, "seg": segs + [-1, 86400, "x", True, 1.5], "arquivo": "../../bip.csv", "por": "Ana<b>"})
ok(v and v[2] == segs and v[3] == 5 and "/" not in v[4] and "<" not in v[5], "entradas: só inteiros de 0 a 86399; nome sem caminho: %r" % (v,))
m.entradas_gravar(*v)
m.entradas_gravar(*v)
E = m.entradas_dia(dia_e)
ok(E and E["total"] == 11 and E["fonte"] == "bip", "24: o mesmo arquivo duas vezes dá o mesmo total: %r" % E)
ok(E["pico_min"] == {"hhmm": "10:41", "n": 9} and E["primeira"] == "09:01" and E["ultima"] == "16:58" and E["pico_15"]["hhmm"] == "10:30",
   "25: pico 10:41, 9 pessoas: %r" % E)
v2, _ = m.entradas_validar({"origem": "catraca", "dia": dia_e, "seg": segs[:5]})
m.entradas_gravar(*v2)
E = m.entradas_dia(dia_e)
ok(E["fonte"] == "catraca" and E["total"] == 5 and E["por_origem"] == {"bip": 11, "catraca": 5}, "24: com bip e catraca, o total usa a catraca: %r" % E)
ok(m.entradas_validar({"origem": "bip", "dia": m._ff_hoje(time.time() + 2 * 86400), "seg": [1]})[0] is None
   and m.entradas_validar({"origem": "bip", "dia": m._ff_hoje(time.time() - 401 * 86400), "seg": [1]})[0] is None
   and m.entradas_validar({"origem": "outra", "dia": dia_e, "seg": [1]})[0] is None
   and m.entradas_validar({"origem": "bip", "dia": dia_e, "seg": list(range(50001))})[0] is None, "entradas: dia, origem e tamanho fora do limite são recusados")
ok(len(m.entradas_importacoes()["importacoes"]) == 3, "importações registradas")

# --- critério 26: migração só acrescenta ---
dia_m = m._ff_hoje(time.time() - 100 * 86400)
tm = time.mktime(time.strptime(dia_m + " 14:20:00", "%Y-%m-%d %H:%M:%S"))
m.ev_receber({"eventos": [{"tipo": "criar", "idem": "vmig1:1", "venda": "vmig1", "em": iso(tm - 30), "dados": {"card": "LPMIG0001", "total": 150, "canal": "checkout"}},
                          {"tipo": "pagar", "idem": "vmig1:2", "venda": "vmig1", "em": iso(tm), "dados": {}},
                          # R3: venda sem canal (antes da v92) não entra no tempo de confirmação
                          {"tipo": "criar", "idem": "vmig2:1", "venda": "vmig2", "em": iso(tm - 30), "dados": {"card": "LPMIG0002", "total": 80}},
                          {"tipo": "pagar", "idem": "vmig2:2", "venda": "vmig2", "em": iso(tm + 3600), "dados": {}}]})
os.makedirs(m.MET_DIR, exist_ok=True)
v1 = {"dia": dia_m, "gerado": "x", "fotos": 321, "sessoes": 17, "vendas": 5, "faturamento": 999.0, "por_fotografo": {"carlos": {"sessoes": 17, "fotos": 321}}, "por_vendedor": {}}
json.dump(v1, open(os.path.join(m.MET_DIR, dia_m + ".json"), "w"))
m.metricas_migra_v2(pausa=0)
mm = json.load(open(os.path.join(m.MET_DIR, dia_m + ".json")))
ok(all(mm[k] == v1[k] for k in ("fotos", "sessoes", "vendas", "faturamento")) and mm["por_fotografo"] == v1["por_fotografo"],
   "26: os campos v1 ficam: %r" % {k: mm.get(k) for k in ("fotos", "sessoes", "vendas", "faturamento", "por_fotografo")})
ok(mm.get("v") == 2 and mm.get("migrado") is True and mm["por_hora"].get("14", {}).get("vendas") == 1 and mm["por_hora"].get("15", {}).get("vendas") == 1 and mm["tempos"]["pagamento_s"]["n"] == 1
   and "clique_checkout_s" not in mm["tempos"], "26: ganha horas e pagamento_s, sem tempos de sessão (sem arquivo): %r" % {k: mm.get(k) for k in ("v", "migrado", "por_hora", "tempos")})
ok(m.est_migra["estado"] == "feita", "migração marcada como feita")
m.metricas_migra_v2(pausa=0)
ok(json.load(open(os.path.join(m.MET_DIR, dia_m + ".json"))) == mm, "26: a migração roda uma vez (v2 não muda de novo)")
# importar entradas de um dia antigo não recalcula a v1 (só troca entradas)
v3, _ = m.entradas_validar({"origem": "bip", "dia": dia_m, "seg": [36000, 36001]})
m.entradas_gravar(*v3)
def espera(cond, prazo=5.0):
    fim = time.time() + prazo
    while time.time() < fim:
        try:
            if cond():
                return True
        except Exception:
            pass
        time.sleep(0.05)
    return False
espera(lambda: (json.load(open(os.path.join(m.MET_DIR, dia_m + ".json"))).get("entradas") or {}).get("total") == 2)
mm2 = json.load(open(os.path.join(m.MET_DIR, dia_m + ".json")))
ok(mm2["sessoes"] == 17 and mm2["fotos"] == 321 and (mm2.get("entradas") or {}).get("total") == 2, "entradas de dia antigo: v1 intacta: %r" % {k: mm2.get(k) for k in ("sessoes", "fotos", "entradas")})
# S1 (revisão): resumo antigo que existe e não abre nunca é trocado; dia sem resumo ganha registro mínimo sem v:2
dia_x = m._ff_hoje(time.time() - 20 * 86400)
arq_x = os.path.join(m.MET_DIR, dia_x + ".json")
ruim = b'{"dia": "' + dia_x.encode() + b'", "fotos": 12, quebrado'
open(arq_x, "wb").write(ruim)
v4, _ = m.entradas_validar({"origem": "bip", "dia": dia_x, "seg": [36000]})
m.entradas_gravar(*v4)
espera(lambda: False, 0.6)
ok(open(arq_x, "rb").read() == ruim, "S1: JSON inválido de dia antigo fica com os mesmos bytes depois de importar entradas")
dia_y = m._ff_hoje(time.time() - 21 * 86400)
arq_y = os.path.join(m.MET_DIR, dia_y + ".json")
v5, _ = m.entradas_validar({"origem": "catraca", "dia": dia_y, "seg": [36000, 36060]})
m.entradas_gravar(*v5)
espera(lambda: os.path.exists(arq_y))
my = json.load(open(arq_y))
ok(my.get("v") != 2 and my.get("so_entradas") is True and my["entradas"]["total"] == 2, "S1: dia sem resumo ganha registro mínimo sem v:2: %r" % my)
ok(not [n for n in os.listdir(m.MET_DIR) if n.endswith(".tmp")], "S1: nenhum temporário sobrando")
# S1: várias gravações ao mesmo tempo no mesmo dia não quebram o arquivo
ths = [threading.Thread(target=m._met_regrava, args=(dia_y,)) for _ in range(8)]
[t.start() for t in ths]
[t.join() for t in ths]
ok(json.load(open(arq_y))["entradas"]["total"] == 2, "S1: gravações concorrentes deixam um JSON válido")

# --- agenda (risco 4) ---
AGV = {"id": "ag_0123456789ab", "data": "2026-11-08", "hora": "16:00", "tipo": "jogo", "mandante": "<script>alert(1)</script>Flamengo",
       "visitante": "Palmeiras", "competicao": "Brasileirão", "obs": "", "origem": "csv", "por": "Eduardo", "em": "2026-11-05T12:00:00Z", "extra": "x" * 50}
a = m.agenda_valida("ag_0123456789ab", AGV)
ok(a and "<" not in json.dumps(a) and "extra" not in a and a["mandante"].startswith("scriptalert(1)/script"), "agenda: sem < >, sem campo de fora: %r" % a)
ok(m.agenda_valida("ag_0123456789ab", {**AGV, "tipo": "festa"}) is None and m.agenda_valida("ag_0123456789ab", {**AGV, "data": "08/11/2026"}) is None
   and m.agenda_valida("../x", AGV) is None and m.agenda_valida("ag_0123456789ab", {**AGV, "hora": "25:00"}) is None, "agenda: tipo, data, hora e id inválidos recusados")
g = m.estado_gravar({"docs": [{"col": "agenda", "id": "ag_0123456789ab", "valor": AGV}, {"col": "agenda", "id": "ag_ffffffffffff", "valor": {**AGV, "id": "ag_ffffffffffff", "tipo": "x"}}]})
docs = m.estado_col("agenda")["docs"]
ok(g["gravados"] == 1 and len(docs) == 1 and "extra" not in docs[0]["valor"], "agenda: o estado.db guarda só o registro válido e limpo: %r" % docs)

ok("presenca" not in mm and "presenca" not in m.metricas_dia(SAB) and "carlos" in m.metricas_dia(hoje).get("presenca", {}),
   "S7: presença só a partir do 1º dia com marca (dias antigos ficam sem o campo)")

# --- revisão: __proto__, cfg_valida, abono, teto da agenda, tipo de acesso e servidor fora ---
ok(m._ev_cart([{"id": "__proto__", "v": 1}]) is None and m._ev_limpo({"tipo": "criar", "idem": "vp1:1", "venda": "vp1", "posto": "__proto__", "por": {"nome": "constructor"}, "dados": {"total": 1}})["posto"] is None,
   "__proto__/constructor recusados em cart.id, posto e por")
E1 = {"historico": [{"desde": "2026-11-05", "folgas": {"carlos": [1, 2]}}], "por": "Eduardo", "em": "2026-11-05T12:00:00Z"}
T1 = {"historico": [{"desde": "2026-11-05", "padrao": "09:00", "tolerancia": 10, "por_ponto": {"campo1": "09:30"}}], "por": "Eduardo", "em": "2026-11-05T12:00:00Z"}
ok(m.cfg_valida("escala", E1) and m.cfg_valida("turnos", T1)
   and m.cfg_valida("escala", {"historico": [{"desde": "ontem", "folgas": {}}]}) is None
   and m.cfg_valida("escala", {"historico": [{"desde": "2026-11-05", "folgas": {"Carlos!": [1]}}]}) is None
   and m.cfg_valida("escala", {"historico": [{"desde": "2026-11-05", "folgas": {"carlos": [7]}}]}) is None
   and m.cfg_valida("turnos", {"historico": [{"desde": "2026-11-05", "padrao": "9h", "tolerancia": 10}]}) is None
   and m.cfg_valida("escala", {"historico": [{"desde": "2026-11-05", "folgas": {}}] * 201}) is None
   and m.cfg_valida("turnos", {**T1, "em": "2099-01-01T00:00:00Z"})["em"] is None, "cfg_valida: escala e turnos")
g2 = m.estado_gravar({"docs": [{"col": "config", "id": "escala", "valor": {"historico": "x"}}, {"col": "config", "id": "turnos", "valor": T1},
                               {"col": "abono", "id": hoje + "|carlos", "valor": {"dia": hoje, "chave": "carlos", "motivo": "<b>médico</b>", "por": "Sandra"}},
                               {"col": "abono", "id": hoje + "|carlos", "valor": {"dia": hoje, "chave": "carlos", "motivo": ""}}]})
ab = m.estado_col("abono")["docs"]
ok(g2["gravados"] == 2 and ab and ab[0]["valor"]["motivo"] == "bmédico/b", "estado: config inválida recusada, abono limpo: %r" % ((g2, ab),))
m.AGENDA_DOCS_MAX = 1
g3 = m.estado_gravar({"docs": [{"col": "agenda", "id": "ag_00000000000a", "valor": {**AGV, "id": "ag_00000000000a"}}, {"col": "agenda", "id": "ag_0123456789ab", "valor": {**AGV, "obs": "edit"}}]})
ok(g3["gravados"] == 1, "agenda: teto de documentos (edição continua valendo): %r" % g3)
m.AGENDA_DOCS_MAX = 5000
ok([m.tipo_acesso(x) for x in ("127.0.0.1", "::ffff:127.0.0.1", "192.168.0.10", "100.101.1.2", "100.128.0.1")] == ["loopback", "loopback", "rede", "remota", "rede"], "tipo de acesso")
dia_s = m._ff_hoje(time.time() - 3 * 86400)
ts = time.mktime(time.strptime(dia_s, "%Y-%m-%d"))
ok(m.servico_fora(dia_s) is None, "servidor fora: sem registro = sem dado")
with m.op_lock:
    dbs = m.operacao_db()
    dbs.executemany("insert into servico values (?, ?)", [(ts + 3600, ts + 9 * 3600), (ts + 11 * 3600, ts + 86400 + 100)])
    dbs.commit()
    dbs.close()
sf = m.servico_fora(dia_s)
ok(sf == [[ts + 9 * 3600, ts + 11 * 3600]] and m.met_v2(dia_s, [], []).get("servidor_fora") == sf, "servidor fora das 9 às 11 h: %r" % sf)

# --- critério 29: backup e privacidade ---
ok("OPERACAO_DB" in inspect.getsource(m.backup_loop), "29: o operacao.db vai para o backup")
txt = json.dumps(m.metricas_dia(SAB)) + json.dumps(m.metricas_dia(hoje))
ok("@" not in txt and not re.search(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b", txt) and '"emb' not in txt and "vetor" not in txt and "LPSAB" not in txt,
   "29: o resumo não traz e-mail, CPF nem rosto")

# ======================= Parte B: o agente de verdade =======================
HB = tempfile.mkdtemp()
os.makedirs(os.path.join(HB, "Eterna", "ponto", "metricas"), exist_ok=True)
json.dump({"users": {"carlos": "x" * 12, "samuel": "y" * 12}}, open(os.path.join(HB, "Eterna", "ftp.json"), "w"))
t0 = time.time()
for i in range(2, 368):                       # 366 dias antigos (v1) para a migração e o desempenho
    dd_ = time.strftime("%Y-%m-%d", time.localtime(t0 - i * 86400))
    json.dump({"dia": dd_, "gerado": "x", "fotos": 100 + i, "sessoes": 10, "vendas": 3, "faturamento": 500.0, "por_fotografo": {}, "por_vendedor": {}, "por_posto": {}, "por_meio": {}},
              open(os.path.join(HB, "Eterna", "ponto", "metricas", dd_ + ".json"), "w"))
env = {**os.environ, "HOME": HB, "USERPROFILE": HB, "ETERNA_PORTA": str(PORTA), "ETERNA_FTP_PORTA": str(PORTA + 1000),
       "ETERNA_APP_ORIGIN": "http://127.0.0.1:9", "ETERNA_SEM_OPENCV": "1", "USER": "eterna-teste-sem-cartao"}
for k in ("ETERNA_PASTA", "ETERNA_ORIGENS", "ETERNA_BUCKET"):
    env.pop(k, None)


def req(metodo, path, body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=15)
    try:
        hs = {"Host": "127.0.0.1:%d" % PORTA, **(headers or {})}
        data = json.dumps(body).encode() if body is not None else None
        if data is not None:
            hs["Content-Type"] = "application/json"
        c.request(metodo, path, body=data, headers=hs)
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


A = subprocess.Popen([sys.executable, "-I", AG], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
try:
    for _ in range(80):
        time.sleep(0.25)
        if req("GET", "/status")[0] == 200:
            break
    s, st = req("GET", "/status")
    ok(s == 200 and (st or {}).get("estatisticas", {}).get("v") == 2 and "migracao" in st["estatisticas"], "/status.estatisticas: %r" % (st or {}).get("estatisticas"))
    X = {"X-Eterna": "1"}
    s1, _ = req("POST", "/ponto/presenca", {"chave": "carlos"})
    s2, _ = req("POST", "/ponto/presenca", {"chave": "carlos"}, {**X, "Origin": "http://evil.example"})
    s3, _ = req("POST", "/ponto/presenca", {"chave": "fulano"}, X)
    ok((s1, s2, s3) == (403, 403, 400), "7: sem X-Eterna 403, origem de fora 403, chave fora do cadastro 400: %r" % ((s1, s2, s3),))
    s4, j4 = req("POST", "/ponto/presenca", {"chave": "Carlos", "posto": "Caixa <1>", "primeiro": 1000, "em": "2020-01-01T00:00:00Z"}, X)
    ok(s4 == 200 and j4.get("ok") and abs(j4["primeiro"] - time.time()) < 30, "5: grava com a hora do servidor (a do navegador é ignorada): %r" % j4)
    s5, j5 = req("POST", "/ponto/presenca", {"chave": "carlos"}, X)
    ok(s5 == 200 and j5["primeiro"] == j4["primeiro"], "5: segundo login mantém primeiro")
    cods = [req("POST", "/ponto/presenca", {"chave": "samuel"}, X)[0] for _ in range(30)]
    ok(429 in cods, "7: mais de 30 por minuto dá 429: %r" % cods[-5:])
    s, md = req("GET", "/metricas/dia")
    pr = ((md or {}).get("dias") or [{}])[0].get("presenca", {}).get("carlos") or {}
    ok(pr.get("n") == 2 and pr.get("fonte") == "login" and pr.get("postos") == ["Caixa 1"], "5: presença no resumo de hoje: %r" % pr)
    ontem = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
    corpo = {"origem": "bip", "dia": ontem, "seg": [36060 + i for i in range(9)], "arquivo": "bip.csv", "por": "Eduardo"}
    se, je = req("POST", "/ponto/entradas", corpo)
    ok(se == 403, "entradas sem X-Eterna: 403")
    se, je = req("POST", "/ponto/entradas", corpo, X)
    se2, je2 = req("POST", "/ponto/entradas", corpo, X)
    ok(se == 200 and je2.get("aceitas") == 9, "24: entradas aceitas: %r" % je2)
    sx, _ = req("POST", "/ponto/entradas", {**corpo, "seg": "1,2,3"}, X)
    ok(sx == 400, "entradas: seg que não é lista dá 400")
    si, ji = req("GET", "/ponto/entradas/importacoes")
    ok(si == 200 and len(ji["importacoes"]) == 2 and ji["importacoes"][0]["aceitas"] == 9, "importações: %r" % ji)
    espera(lambda: (((req("GET", "/metricas/dia?de=%s&ate=%s" % (ontem, ontem))[1] or {}).get("dias") or [{}])[0].get("entradas") or {}).get("total") == 9)
    s, md = req("GET", "/metricas/dia?de=%s&ate=%s" % (ontem, ontem))
    en = ((md or {}).get("dias") or [{}])[0].get("entradas") or {}
    ok(en.get("total") == 9 and en.get("pico_min") == {"hhmm": "10:01", "n": 9}, "24/25: o resumo de ontem traz as entradas: %r" % en)
    # critério 27: 366 dias em menos de 2 s, com a migração rodando
    de = time.strftime("%Y-%m-%d", time.localtime(t0 - 367 * 86400))
    ini = time.time()
    s, md = req("GET", "/metricas/dia?de=%s&ate=%s" % (de, time.strftime("%Y-%m-%d")))
    dt = time.time() - ini
    s2_, st2 = req("GET", "/status")
    ok(s == 200 and len(md["dias"]) >= 366 and dt < 2, "27: 366 dias em %.2f s (%d dias)" % (dt, len((md or {}).get("dias") or [])))
    mg = st2["estatisticas"]["migracao"]
    ok(mg["estado"] == "rodando" and mg["feitos"] < mg["total"], "27: o agente atende enquanto a migração está rodando: %r" % mg)
    ok(isinstance((st2.get("fuso") or {}).get("offset_min"), int) and st2["fuso"]["tz"] in ("America/Sao_Paulo", ""), "fuso no /status: %r" % st2.get("fuso"))
    # revisão: 413, origem de fora nas importações, CORS com X-Eterna, ip e acesso da presença
    big = {"origem": "bip", "dia": ontem, "seg": [1] * 400000}
    sb, _ = req("POST", "/ponto/entradas", big, X)
    ok(sb == 413, "entradas acima de 1 MB: 413 (%r)" % sb)
    so, _ = req("GET", "/ponto/entradas/importacoes", headers={"Origin": "http://evil.example"})
    sh, _ = req("GET", "/ponto/entradas/importacoes", headers={"Host": "evil.example:%d" % PORTA})
    ok(so == 403 and sh == 403, "importações: origem e Host de fora dão 403: %r" % ((so, sh),))
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    c.request("OPTIONS", "/ponto/presenca", headers={"Host": "127.0.0.1:%d" % PORTA, "Origin": "http://127.0.0.1:9", "Access-Control-Request-Headers": "content-type, x-eterna"})
    rr = c.getresponse()
    rr.read()
    ok("X-Eterna" in (rr.getheader("Access-Control-Allow-Headers") or ""), "CORS: X-Eterna no Allow-Headers de /ponto/presenca: %r" % rr.getheader("Access-Control-Allow-Headers"))
    c.close()
    s, md = req("GET", "/metricas/dia")
    pr = ((md or {}).get("dias") or [{}])[0].get("presenca", {}).get("carlos") or {}
    ok(pr.get("acesso") == "loopback", "presença com o tipo de acesso: %r" % pr)
finally:
    A.kill()
falhas = [x for x in falhas if x]
print(json.dumps({"ok": not falhas, "falhas": falhas}))
print(("OK estatisticas_agente: presença, entradas, resumo v2, migração e agenda (v92)" if not falhas else "FALHA estatisticas_agente: " + " | ".join(falhas[:6])))
sys.exit(0 if not falhas else 1)
