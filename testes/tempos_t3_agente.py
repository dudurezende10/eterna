# 24/11 (v99.51.0): tempos novos das Estatísticas (fotografia, escolha, fila, impressão) e sessões por número de cliques.
# Roda sozinho com HOME temporário:  python3 -I testes/tempos_t3_agente.py agente/eterna-agente.py
# Dados sintéticos; nenhum dado de cliente.
import importlib.util, json, os, sys, tempfile, time

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


def iso(t):
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(t))


H = tempfile.mkdtemp()
os.environ["HOME"] = H
os.environ["USERPROFILE"] = H
os.environ["ETERNA_SEM_OPENCV"] = "1"
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)

T = 1_790_000_000
ss = [{"card": "A", "cap0": T, "cap1": T + 90, "fotos": ["f"] * 12},                 # 90 s, 12 cliques
      {"card": "B", "cap0": T, "cap1": T + 20, "fotos": ["f"] * 3, "pend": ["p"]},  # 20 s, 4 cliques
      {"card": "C", "cap0": T, "cap1": T + 500, "fotos": ["f"] * 90, "trilha": "cartao"},   # fora do tempo (cartão), conta cliques
      {"card": "D", "removida": True, "cap0": T, "cap1": T + 10, "fotos": ["f"] * 5}]
evs = [{"venda": "v1", "tipo": "criar", "dados": {"tempos": {"inicio": iso(T), "escolha": iso(T + 45)}}},
       {"venda": "v1", "tipo": "pagar", "dados": {}},
       {"venda": "v2", "tipo": "criar", "dados": {"tempos": {"inicio": iso(T), "escolha": iso(T + 400)}}},   # não paga: fora
       {"venda": "v1", "tipo": "fila", "dados": {"entrou": iso(T + 100), "comecou": iso(T + 110), "terminou": iso(T + 170)}}]
t, fs = m.met_t3(ss, evs)
ok(t["fotografia_s"]["n"] == 2 and t["fotografia_s"]["soma"] == 110, "fotografia: %r" % t["fotografia_s"])
ok(t["escolha_s"]["n"] == 1 and t["escolha_s"]["soma"] == 45, "escolha só das pagas: %r" % t["escolha_s"])
ok(t["fila_s"]["n"] == 1 and t["fila_s"]["soma"] == 10, "fila: %r" % t["fila_s"])
ok(t["impressao_s"]["n"] == 1 and t["impressao_s"]["soma"] == 70, "impressão: %r" % t["impressao_s"])
ok(fs == [1, 0, 1, 0, 0, 1], "cliques por sessão (1–5, 6–10, 11–20, 21–40, 41–80, 81+): %r" % fs)

# dia passado v2 sem os tempos novos: entra uma vez em segundo plano, sem trocar o que existe
dia = "2026-11-20"
os.makedirs(m.MET_DIR, exist_ok=True)
os.makedirs(m.SESS_DIR, exist_ok=True)
json.dump({"sessoes": ss}, open(os.path.join(m.SESS_DIR, dia + ".json"), "w"))
velho = {"v": 2, "dia": dia, "fotos": 5, "tempos": {"cliente_s": m.h_novo(), "escolha_s": {"n": 7, "soma": 1.0, "f": [7, 0, 0, 0, 0, 0, 0]}}}
json.dump(velho, open(os.path.join(m.MET_DIR, dia + ".json"), "w"))
t0 = time.time()
r = m.metricas_periodo(dia, dia)
ok(time.time() - t0 < 1 and r and not r[0].get("t3"), "a leitura não espera o cálculo: %r" % (r and r[0].get("t3")))
for _ in range(100):
    time.sleep(0.1)
    g = json.load(open(os.path.join(m.MET_DIR, dia + ".json"), encoding="utf8"))
    if g.get("t3"):
        break
ok(g.get("t3") == 1, "o dia passado ganhou os tempos novos")
ok(g["tempos"]["escolha_s"]["n"] == 7, "o que já existia não muda: %r" % g["tempos"].get("escolha_s"))
ok(g["tempos"].get("fotografia_s", {}).get("n") == 2 and g.get("fotos_sessao") == [1, 0, 1, 0, 0, 1], "fotografia e cliques do arquivo de sessões: %r" % g.get("fotos_sessao"))
ok(g.get("fotos") == 5, "o resto do resumo fica igual")

# sem arquivo de sessões: não inventa tempo de fotografia
dia2 = "2026-11-19"
json.dump({"v": 2, "dia": dia2, "tempos": {}}, open(os.path.join(m.MET_DIR, dia2 + ".json"), "w"))
m.met_t3_completa(dia2, {"v": 2})
g2 = json.load(open(os.path.join(m.MET_DIR, dia2 + ".json"), encoding="utf8"))
ok(g2.get("t3") == 1 and "fotografia_s" not in g2["tempos"] and "fotos_sessao" not in g2, "sem sessões: %r" % g2)

print(json.dumps({"ok": not falhas, "falhas": falhas}, ensure_ascii=False))
print(("OK tempos_t3_agente: fotografia, escolha, fila, impressão e cliques por sessão (v99.51.0)") if not falhas else "FALHA tempos_t3_agente: " + "; ".join(falhas))
sys.exit(0 if not falhas else 1)
