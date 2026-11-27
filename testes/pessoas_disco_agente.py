# 26/11 (Ronaldo: "os números precisam ser confiáveis"): a contagem de pessoas vai para o HD (sobrevive ao reinício do agente),
# cada contagem gera a auditoria do dia, a sessão com rosto sem cliente contado soma 1 pessoa e ontem é recontado uma vez.
#   python3 -I testes/pessoas_disco_agente.py agente/eterna-agente.py
import importlib.util, io, json, os, sys, tempfile, contextlib

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    print(("ok   " if c else "FALHA ") + msg)
    if not c:
        falhas.append(msg)


HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PESSOAS_DIR=os.path.join(HA, "hd", "contagens", "pessoas"))
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
with contextlib.redirect_stdout(io.StringIO()):
    sp = importlib.util.spec_from_file_location("ag", AG)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)

ontem = m._ff_hoje(m.time.time() - 86400)
hoje = m._ff_hoje()
calc = {"n": 0}


def falso_calc(dia, forcar=False):
    """Dia com 3 sessões com rosto: 1 com cliente contado, 2 sem; 1 venda numa sessão sem cliente."""
    if dia >= m._ff_hoje() and not forcar:
        return None
    calc["n"] += 1
    aud = {"situacao": "com ressalvas", "ressalvas": ["1 sessões vendidas sem cliente contado"], "fotos_do_dia": 10, "fotos_lidas": 10,
           "fotos_sem_leitura": 0, "fila_leitura": 0, "sessoes_com_rosto": 3, "sessoes_com_cliente": 1, "sessoes_sem_cliente": 2}
    return {"v": 3, "pessoas": 3 + calc["n"], "pessoas_grupos": 1, "sessoes_sem_cliente": 2}, aud


m._pessoas_dia_calc = falso_calc
# 1. dia passado: calcula uma vez, grava no HD com a auditoria
r = m.pessoas_dia(ontem)
arq = os.path.join(os.environ["ETERNA_PESSOAS_DIR"], ontem + ".json")
ok(r and r["pessoas"] == 4 and os.path.exists(arq), "dia passado calculado e gravado no HD")
j = json.load(open(arq, encoding="utf8"))
ok(j["v"] == 3 and j["auditoria"]["situacao"] == "com ressalvas" and "segundos" in j["auditoria"], "o arquivo traz a auditoria junto")
ok(not any("@" in json.dumps(j) for _ in [0]), "sem e-mail no arquivo")
# 2. reinício do agente (memória vazia): lê do HD, sem recalcular
m._pessoas_cache.clear()
ok(m.pessoas_dia(ontem)["pessoas"] == 4 and calc["n"] == 1, "depois do reinício vem do HD, sem nova conta")
# 3. hoje antes da conta: None (o painel não inventa número); depois do pessoas_contar forçado: no HD
ok(m.pessoas_dia(hoje) is None, "hoje sem conta: sem número")
with m._pessoas_lock:
    m.pessoas_contar(hoje, forcar=True)
m._pessoas_cache.clear()
ok(m.pessoas_dia(hoje)["pessoas"] == 5, "a conta de hoje sobrevive ao reinício")
# 4. refazer hoje: só depois de PESSOAS_REFAZ_SEG, e só se faltava leitura ou chegaram fotos
m._pessoas_fotos_do_dia = lambda dia: 10
ok(m._pessoas_hoje_refazer(hoje) is False, "conta recente não refaz")
j = m.pessoas_disco_ler(hoje)
j["calc_em"] = m._iso(m.time.time() - 3600)
m._pessoas_cache[hoje] = j
ok(m._pessoas_hoje_refazer(hoje) is False, "conta antiga com as mesmas fotos e leitura completa não refaz")
m._pessoas_fotos_do_dia = lambda dia: 12
ok(m._pessoas_hoje_refazer(hoje) is True, "chegaram fotos depois da conta: refaz")
# 5. arquivo de versão antiga não vale (ontem é recontado)
json.dump({"v": 2, "resultado": {"pessoas": 1}}, open(arq, "w", encoding="utf8"))
ok(m.pessoas_disco_ler(ontem) is None, "conta v2 no HD não vale: ontem é recontado")
# 6. auditoria de verdade com dados montados (sem OpenCV): sessão vendida sem cliente vira ressalva
m._pessoas_fotos_do_dia = lambda dia: 4
m._pessoas_vendidas = lambda dia: {"LPB"}
P = [{"pids": {"f1", "f2"}, "cards": {"LPA"}, "maior": 90, "equipe": False}]
rows = [("f1", 90, b""), ("f2", 80, b""), ("f3", 70, b""), ("f4", 50, b"")]
sess = {"f1": "LPA", "f2": "LPA", "f3": "LPB", "f4": "LPC"}
a = m._pessoas_auditoria(ontem, rows, P, sess)
ok(a["sessoes_com_rosto"] == 3 and a["sessoes_sem_cliente"] == 2 and a["vendidas_sem_cliente"] == ["LPB"], "auditoria: %r" % a)
ok(a["situacao"] == "com ressalvas" and any("vendidas sem cliente" in x for x in a["ressalvas"]), "venda sem cliente contado vira ressalva")
m._pessoas_vendidas = lambda dia: {"LPA"}
a = m._pessoas_auditoria(ontem, rows, P, sess)
ok(a["situacao"] == "com ressalvas" and any("sessões com rosto sem cliente" in x for x in a["ressalvas"]), "maioria das sessões sem cliente vira ressalva")
ok(os.environ["ETERNA_PESSOAS_DIR"] in [x for x in [m.PESSOAS_DIR]], "pasta do HD configurável")
print("\n" + ("tudo certo" if not falhas else "%d falha(s)" % len(falhas)))
sys.exit(1 if falhas else 0)
