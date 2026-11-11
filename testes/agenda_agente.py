# v97: agenda automática e série diária no agente (plano docs/planos/2026-11-10-agenda-estatisticas.md, critérios 1, 3 a 7,
# 11 a 16 e 21, e os da chave da API-Football em Configurações, só para quem altera Configurações). Roda sozinho (testes/rodar.sh) com HOME temporário:
#   python3 -I testes/agenda_agente.py agente/eterna-agente.py
# O agente é importado aqui e o servidor HTTP dele roda numa thread (porta 42000-42999); a API-Football é um servidor
# falso local com uma chave falsa. O 2 (feriados iguais aos do app) está em testes/agenda-estatisticas.js; o 17 (histórico
# da Roverpix) saiu (Eduardo, 10/11: sem retroativo).
import importlib.util, io, json, os, random, sys, tempfile, threading, time, http.client, contextlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
PORTA = 42000 + random.randint(0, 899)
PORTA_API = PORTA + 50
CHAVE = "FalsaChaveDeTeste0123456789abcd"      # chave falsa: só o servidor falso daqui aceita
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1", ETERNA_PORTA=str(PORTA), no_proxy="127.0.0.1,localhost", NO_PROXY="127.0.0.1,localhost")
os.environ.pop("ETERNA_API_FOOTBALL", None)
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
saida = io.StringIO()                           # tudo o que o agente imprime (a chave nunca pode aparecer)
with contextlib.redirect_stdout(saida):
    sp = importlib.util.spec_from_file_location("ag", AG)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    m.fuso_ajusta()
m.AF_URL = "http://127.0.0.1:%d" % PORTA_API
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao
COOKIE = _agente_sessao.cookie_sessao(m)      # pessoa conectada (admin): as rotas da equipe pedem sessão (tabela ROTAS)
HOJE = m._ff_hoje()
D = lambda n: m._dia_mais(HOJE, n)

# ---------- API-Football falsa ----------
API = {"fixtures": [], "pedidos": [], "erro": None}


class FalsaAPI(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        API["pedidos"].append(self.path)
        if self.headers.get("x-apisports-key") != CHAVE:
            corpo = {"errors": {"token": "Error/Missing application key"}, "response": []}
        elif API["erro"]:
            corpo = {"errors": {"plan": API["erro"]}, "response": []}
        elif self.path.startswith("/venues"):
            corpo = {"errors": [], "response": [{"id": 204, "name": "Estadio Jornalista Mário Filho (Maracanã)", "city": "Rio de Janeiro"},
                                                {"id": 999, "name": "Maracanã", "city": "Outra"}]}
        elif self.path.startswith("/fixtures"):
            temporada = int(self.path.split("season=")[1].split("&")[0])
            corpo = {"errors": [], "response": [f for f in API["fixtures"] if f["_temporada"] == temporada]}
        else:
            corpo = {"errors": {"rota": "x"}, "response": []}
        b = json.dumps(corpo).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("x-ratelimit-requests-remaining", "97")
        self.end_headers()
        self.wfile.write(b)


def fx(fid, ts, status="NS", home="Flamengo", away="Palmeiras", liga="Serie A"):
    return {"_temporada": int(time.strftime("%Y", time.gmtime(ts))), "fixture": {"id": fid, "timestamp": int(ts), "status": {"short": status}},
            "teams": {"home": {"name": home}, "away": {"name": away}}, "league": {"name": liga}}


threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", PORTA_API), FalsaAPI).serve_forever, daemon=True).start()
threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", PORTA), m.H).serve_forever, daemon=True).start()
time.sleep(0.3)


def req(metodo, path, corpo=None, cab=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=60)
    h = {"Host": "127.0.0.1:%d" % PORTA, "Content-Type": "application/json", "Cookie": COOKIE}
    h.update(cab or {})
    c.request(metodo, path, body=None if corpo is None else json.dumps(corpo), headers=h)
    r = c.getresponse()
    b = r.read().decode()
    c.close()
    try:
        return r.status, json.loads(b), b
    except Exception:
        return r.status, None, b


XE = {"X-Eterna": "1"}


def agenda():
    return {k: v for k, v in m._agenda_todos().items()}


def vivos():
    return [v for v in agenda().values() if v]


with contextlib.redirect_stdout(saida):
    # ---------- 3 (gêmeo): feriado criado antes pelo botão, de id aleatório ----------
    m.estado_gravar({"docs": [{"col": "agenda", "id": "ag_0123456789ab", "valor": {"id": "ag_0123456789ab", "data": "2026-12-25", "hora": "", "tipo": "feriado",
                     "obs": "Natal", "origem": "feriados", "por": "Ana", "em": "2026-10-01T10:00:00Z"}}]}, quem="teste")
    # ---------- 1: boot num estado.db só com esse ----------
    n1 = m.agenda_semear_feriados(2026)
    fer = [v for v in vivos() if v["tipo"] == "feriado"]
    datas = {v["data"] for v in fer}
    ok(len(fer) == 30 and n1 == 29, "1: 15 feriados de 2026 e 15 de 2027 (um já existia): %d novos, %d no total" % (n1, len(fer)))
    ok({"2026-02-16", "2026-02-17", "2026-04-03", "2026-06-04", "2027-02-08", "2027-02-09"} <= datas, "1: Carnaval, Sexta-feira Santa e Corpus Christi certos")
    ok(all(v["origem"] == "feriados" and v["por"] in ("Eterna", "Ana") for v in fer), "1: origem feriados, por Eterna")
    ok(sum(1 for v in fer if v["data"] == "2026-12-25") == 1, "3: o feriado de id aleatório não ganha gêmeo")
    # ---------- 3: reiniciar não duplica; apagado não volta ----------
    for _ in range(3):
        m.agenda_semear_feriados(2026)
    ok(len([v for v in vivos() if v["tipo"] == "feriado"]) == 30, "3: três boots não duplicam")
    tir = m.agenda_id("feriado|2026-04-21")
    m.estado_gravar({"docs": [{"col": "agenda", "id": tir, "valor": None}]}, quem="teste")
    m.agenda_semear_feriados(2026)
    ok(agenda().get(tir, "x") is None, "3: feriado apagado no app não volta depois do boot")
    ok(m.agenda_semear_feriados(2027) == 15, "1: na virada para 2027 entram os de 2028")

    # ---------- 6 e 7: sem chave ----------
    st = m.agenda_status()
    ok(st["jogos"]["fonte"] == "nenhuma" and st["jogos"]["chave"] is False, "6: sem chave, fonte nenhuma: %r" % st["jogos"])
    s, j, _ = req("POST", "/agenda/atualizar", {}, XE)
    ok(s == 409, "6: atualizar sem chave dá 409: %d" % s)

    # ---------- chave pela tela: só Admin do cadastro ----------
    adm = {"email": "admin@teste.local", "name": "Admin Teste", "active": True,
           "perms": {"configuracao": {"c": True, "r": True, "u": True, "d": False}, "usuarios": {"c": True, "r": True, "u": True, "d": True}, "permissoes": {"c": False, "r": True, "u": True, "d": False}}}
    sup = {"email": "sup@teste.local", "name": "Só leitura", "active": True, "perms": {"configuracao": {"c": False, "r": True, "u": False, "d": False}, "escala": {"c": True, "r": True, "u": True, "d": False}}}
    sv = {"email": "superv@teste.local", "name": "Supervisora", "active": True, "perms": {"configuracao": {"c": True, "r": True, "u": True, "d": False}}}
    ina = dict(adm, email="velho@teste.local", active=False)
    m.estado_gravar({"docs": [{"col": "usuarios", "id": "admin%40teste.local", "valor": adm}, {"col": "usuarios", "id": "sup%40teste.local", "valor": sup}, {"col": "usuarios", "id": "superv%40teste.local", "valor": sv},
                              {"col": "usuarios", "id": "velho%40teste.local", "valor": ina}]}, quem="teste")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "sup@teste.local"}, XE)
    ok(s == 403 and not os.path.exists(m.AF_CFG), "chave: quem só lê Configurações (e edita o calendário) recebe 403 e nada é gravado: %d" % s)
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "velho@teste.local"}, XE)
    ok(s == 403, "chave: Admin inativo recebe 403")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "admin@teste.local"})
    ok(s == 403, "chave: sem X-Eterna recebe 403")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "admin@teste.local"}, {**XE, "Host": "outro.exemplo:%d" % PORTA})
    ok(s == 403, "7: /agenda/fonte com Host de fora recebe 403")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "admin@teste.local"}, {**XE, "Origin": "https://site.exemplo"})
    ok(s == 403, "7: /agenda/fonte de outra origem recebe 403")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": "curta", "quem": "admin@teste.local"}, XE)
    ok(s == 400, "chave: chave com formato inválido dá 400")
    s, j, b = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "admin@teste.local"}, XE)
    ok(s == 200 and j.get("ok") and j.get("final") == CHAVE[-4:] and CHAVE not in b, "chave: Admin salva; a resposta só tem os 4 últimos: %d %s" % (s, b[:120]))
    ok(oct(os.stat(m.AF_CFG).st_mode & 0o777) == "0o600", "chave: arquivo com permissão 600")
    s, j, b = req("GET", "/agenda/status")
    ok(s == 200 and j["jogos"]["chave"] and j["jogos"]["final"] == CHAVE[-4:] and j["jogos"]["salva_por"] == "Admin Teste" and CHAVE not in b,
       "chave: /agenda/status mostra configurada, 4 últimos e quem salvou, sem a chave: %s" % b[:200])

    # ---------- 4 e 21: fonte falsa com 3 partidas, uma adiada; fuso ----------
    base = time.mktime(time.strptime(D(-6) + " 16:00:00", "%Y-%m-%d %H:%M:%S"))
    t2130 = time.mktime(time.strptime(D(-3) + " 21:30:00", "%Y-%m-%d %H:%M:%S"))     # 21:30 no Rio = 00:30 UTC do dia seguinte
    API["fixtures"] = [fx(1001, base), fx(1002, t2130, home="Fluminense", away="Vasco DA Gama", liga="Copa do Brasil"), fx(1003, base + 86400, status="PST")]
    m._janelas.clear()
    r1 = m.agenda_jogos_sync("teste")
    jg = [v for v in vivos() if v["tipo"] == "jogo"]
    ok(r1["ok"] and len(jg) == 2 and all(v["origem"] == "api" and v["por"] == "Eterna" and v.get("ext", "").startswith("af:") for v in jg),
       "4: 2 jogos com origem api e ext, o adiado fora: %r %r" % (r1, jg))
    j2 = [v for v in jg if v["ext"] == "af:1002"]
    ok(j2 and j2[0]["data"] == D(-3) and j2[0]["hora"] == "21:30" and j2[0]["visitante"] == "Vasco da Gama",
       "21: jogo às 21:30 do Rio (00:30 UTC do dia seguinte) cai no dia certo: %r" % j2)
    m.agenda_jogos_sync("teste")
    ok(len([v for v in vivos() if v["tipo"] == "jogo"]) == 2, "4: rodar de novo não duplica")
    ok(any("/venues" in p for p in API["pedidos"]) and sum("/venues" in p for p in API["pedidos"]) == 1, "4: o estádio é procurado uma vez só")

    # ---------- 5: editado e apagado por pessoa; manual na mesma data ----------
    i1, i2 = m.agenda_id("af|1001"), m.agenda_id("af|1002")
    ed = dict(agenda()[i1], hora="18:00", por="Ana")
    m.estado_gravar({"docs": [{"col": "agenda", "id": i1, "valor": ed}, {"col": "agenda", "id": i2, "valor": None}]}, quem="teste")
    man = {"id": "ag_aaaaaaaaaaaa", "data": D(-10), "hora": "20:00", "tipo": "jogo", "mandante": "Botafogo", "visitante": "Santos", "origem": "manual", "por": "Ana", "em": "x"}
    m.estado_gravar({"docs": [{"col": "agenda", "id": man["id"], "valor": man}]}, quem="teste")
    API["fixtures"][0] = fx(1001, base + 3600)                       # a API muda a hora
    API["fixtures"].append(fx(1004, time.mktime(time.strptime(D(-10) + " 19:00:00", "%Y-%m-%d %H:%M:%S")), home="Botafogo", away="Santos"))
    r3 = m.agenda_jogos_sync("teste")
    A = agenda()
    ok(A[i1]["hora"] == "18:00" and A[i1]["por"] == "Ana", "5: jogo automático editado no app não muda: %r" % A[i1])
    ok(A.get(i2, "x") is None, "5: jogo automático apagado no app não volta")
    ok(m.agenda_id("af|1004") not in A and r3["ja_no_calendario"] == 1, "5: jogo manual na mesma data impede o automático e conta: %r" % r3)
    # adiado depois de gravado sai; volta se for remarcado
    API["fixtures"].append(fx(1005, base - 86400 * 2))
    m.agenda_jogos_sync("teste")
    i5 = m.agenda_id("af|1005")
    API["fixtures"][-1] = fx(1005, base - 86400 * 2, status="CANC")
    m.agenda_jogos_sync("teste")
    ok(agenda().get(i5, "x") is None, "D2: jogo cancelado sai do calendário")
    API["fixtures"][-1] = fx(1005, base - 86400)
    m.agenda_jogos_sync("teste")
    ok((agenda().get(i5) or {}).get("data") == D(-7), "D2: jogo remarcado pela fonte volta (só o que o próprio agente tirou)")

    # ---------- 7: atualizar ----------
    m._janelas.clear()
    s1 = req("POST", "/agenda/atualizar", {})[0]
    s2 = req("POST", "/agenda/atualizar", {}, {**XE, "Origin": "https://site.exemplo"})[0]
    s3 = req("POST", "/agenda/atualizar", {}, XE)[0]
    s4 = req("POST", "/agenda/atualizar", {}, XE)[0]
    ok((s1, s2, s3, s4) == (403, 403, 200, 429), "7: atualizar sem X-Eterna, de outra origem, e 2 vezes no minuto: %r" % ((s1, s2, s3, s4),))
    ok(m.agenda_wake.is_set(), "7: atualizar acorda o agenda_loop")
    m.agenda_wake.clear()
    # testar agora
    s, j, b = req("POST", "/agenda/testar", {"quem": "admin@teste.local"}, XE)
    ok(s == 200 and j.get("ok") and j.get("n", 0) >= 1 and CHAVE not in b, "chave: Testar agora traz a temporada: %d %s" % (s, b[:160]))
    API["erro"] = "Free plans do not have access to this season"
    m._janelas.clear()
    s, j, b = req("POST", "/agenda/testar", {"quem": "admin@teste.local"}, XE)
    ok(s == 200 and j.get("ok") is False and "Free plans" in (j.get("erro") or ""), "chave: teste que falha mostra o motivo: %s" % b[:160])
    antes = len(vivos())
    r = m.agenda_jogos_sync("teste")
    ok(r["ok"] is False and len(vivos()) == antes and m.agenda_status()["jogos"]["ultima"], "risco 8: falha da API não apaga nada e guarda a última que deu certo")
    API["erro"] = None
    # chave nunca em /status, /agenda/status, arquivo da fonte e console
    s, j, b = req("GET", "/status")
    ok(s == 200 and j.get("agenda", {}).get("jogos", {}).get("chave") is True and "final" not in json.dumps(j.get("agenda")) and CHAVE not in b and CHAVE[-4:] not in json.dumps(j.get("agenda")),
       "7: /status com o bloco agenda, sem a chave nem os 4 últimos: %s" % json.dumps(j.get("agenda"))[:200])
    ok(CHAVE not in req("GET", "/agenda/status")[2], "7: /agenda/status sem a chave")
    ok(CHAVE not in open(m.AF_FONTE, encoding="utf8").read(), "7: agenda-fonte.json sem a chave")
    # remover; chave do servidor vale por cima
    m._janelas.clear()
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "remover", "quem": "admin@teste.local"}, XE)
    ok(s == 200 and not os.path.exists(m.AF_CFG) and m.agenda_status()["jogos"]["fonte"] == "nenhuma", "chave: Remover apaga o arquivo")
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": CHAVE, "quem": "superv@teste.local"}, XE)
    ok(s == 200 and m.agenda_status()["jogos"]["salva_por"] == "Supervisora", "chave: quem altera Configurações (Supervisora) salva: %d" % s)
    req("POST", "/agenda/fonte", {"acao": "remover", "quem": "superv@teste.local"}, XE)
    os.environ["ETERNA_API_FOOTBALL"] = CHAVE
    st = m.agenda_status()["jogos"]
    s, j, _ = req("POST", "/agenda/fonte", {"acao": "salvar", "chave": "B" * 30, "quem": "admin@teste.local"}, XE)
    ok(st["env"] and st["chave"] and s == 409 and not os.path.exists(m.AF_CFG), "chave: variável do servidor aparece como definida no servidor e a tela não sobrescreve")
    os.environ.pop("ETERNA_API_FOOTBALL")
    m.af_salvar(CHAVE, "Admin Teste")

    # ---------- 11, 12, 13, 14, 15: série diária ----------
    m.DIA_DESDE = D(-30)
    os.makedirs(m.MET_DIR, exist_ok=True)
    json.dump({"dia": D(-2), "vendas": 3, "faturamento": 570.0, "fotos": 300, "sessoes": 20, "sessoes_com_venda": 3, "online": {"vendas": 1, "faturamento": 39.0}},
              open(os.path.join(m.MET_DIR, D(-2) + ".json"), "w"))
    rv = os.path.join(m.ROVER_DIR, "agg", D(-3) + ".json")
    json.dump({"daily": {"sales": 7, "revenue": 1330.5, "photos": 800, "approaches": 60, "converted": 7}}, open(rv, "w"))
    # jogo em feriado (D-8), fechado e jogo no mesmo dia (D-12)
    m.estado_gravar({"docs": [
        {"col": "agenda", "id": "ag_bbbbbbbbbbb1", "valor": {"id": "ag_bbbbbbbbbbb1", "data": D(-8), "tipo": "feriado", "obs": "Feriado de teste", "origem": "manual", "por": "Ana", "em": "x"}},
        {"col": "agenda", "id": "ag_bbbbbbbbbbb2", "valor": {"id": "ag_bbbbbbbbbbb2", "data": D(-8), "tipo": "jogo", "mandante": "Flamengo", "visitante": "Grêmio", "origem": "manual", "por": "Ana", "em": "x"}},
        {"col": "agenda", "id": "ag_bbbbbbbbbbb3", "valor": {"id": "ag_bbbbbbbbbbb3", "data": D(-12), "tipo": "fechado", "obs": "Manutenção", "origem": "manual", "por": "Ana", "em": "x"}},
        {"col": "agenda", "id": "ag_bbbbbbbbbbb4", "valor": {"id": "ag_bbbbbbbbbbb4", "data": D(-12), "tipo": "jogo", "mandante": "=1+1", "visitante": "X", "origem": "manual", "por": "Ana", "em": "x"}}]}, quem="teste")
    # 13: visitação
    m.entradas_gravar("bip", D(-2), list(range(900)), 0, "bip.csv", "Ana")
    m.totais_gravar(*m.totais_validar({"origem": "bilheteria", "dias": [{"dia": D(-2), "total": 1000}, {"dia": D(-4), "total": 1000}], "arquivo": "v.csv", "por": "Ana"})[0])
    m.entradas_gravar("bip", D(-4), list(range(900)), 0, "bip.csv", "Ana")
    m.entradas_gravar("catraca", D(-4), list(range(1100)), 0, "cat.csv", "Ana")
    t0 = time.time()
    n = m.dia_completo(pausa=0)
    ok(n == 31 and time.time() - t0 < 10, "série: 31 dias consolidados em %.1f s" % (time.time() - t0))
    s, j, b = req("GET", "/estatisticas/dias?ano=" + HOJE[:4])
    L = {x["dia"]: x for x in (j or {}).get("dias", [])}
    ok(s == 200 and len(L) == 31, "11: /estatisticas/dias traz uma linha por dia: %d %d" % (s, len(L)))
    ok(L[D(-2)]["fonte_vendas"] == "eterna" and L[D(-2)]["vendas"] == 4 and L[D(-2)]["receita"] == 609.0, "11/D6: dia com resumo da Eterna: %r" % L[D(-2)])
    ok(L[D(-3)]["fonte_vendas"] == "roverpix" and L[D(-3)]["vendas"] == 7 and L[D(-3)]["sessoes"] == 60, "11: dia só com Roverpix: %r" % L[D(-3)])
    ok(L[D(-5)]["fonte_vendas"] is None and L[D(-5)]["vendas"] is None, "11: dia sem nada tem vendas null, não 0: %r" % L[D(-5)])
    j8 = L[D(-8)]
    ok(j8["tipo"] == "jogo" and j8["marcas"]["feriado"] == 1 and j8["marcas"]["jogo"] == 1, "12: jogo em feriado é jogo com a marca de feriado: %r" % j8)
    ok(L[D(-9)]["tipo"] == "vespera" and L[D(-9)]["marcas"]["vespera"] == 1, "12: dia antes do jogo é véspera: %r" % L[D(-9)])
    ok(L[D(-12)]["tipo"] == "fechado" and L[D(-12)]["marcas"]["jogo"] == 1, "12: estádio fechado e jogo no mesmo dia = fechado")
    ok(any("Flamengo × Grêmio" in e for e in j8["eventos"]) and all("Ana" not in e for e in j8["eventos"]), "12: eventos curtos, sem quem cadastrou: %r" % j8["eventos"])
    ok((L[D(-2)]["entradas"], L[D(-2)]["entradas_fonte"]) == (1000, "bilheteria"), "13: bip 900 e bilheteria 1000 = 1000 bilheteria: %r" % L[D(-2)])
    ok((L[D(-4)]["entradas"], L[D(-4)]["entradas_fonte"]) == (1100, "catraca"), "13: com catraca 1100 = catraca: %r" % L[D(-4)])
    ok(all(set(x) >= {"dia", "tipo", "marcas", "eventos", "fonte_vendas", "vendas", "receita", "fotos", "sessoes", "sessoes_com_venda", "entradas", "entradas_fonte", "clima"} for x in L.values()),
       "contrato de /estatisticas/dias")
    ok(req("GET", "/estatisticas/dias?ano=1999")[0] == 400 and req("GET", "/estatisticas/dias?ano=2025")[1].get("dias") == [], "ano fora dá 400; ano sem dias dá lista vazia")
    ok(req("GET", "/estatisticas/dias?ano=2026", cab={"Origin": "https://site.exemplo"})[0] == 403, "/estatisticas/dias de outra origem: 403")
    # 14: jogo novo num dia passado marca o dia e a véspera
    with m.dia_sujos_lock:
        m.dia_sujos.clear()
    m.estado_gravar({"docs": [{"col": "agenda", "id": "ag_cccccccccccc", "valor": {"id": "ag_cccccccccccc", "data": D(-20), "tipo": "jogo", "mandante": "Vasco da Gama", "origem": "manual", "por": "Ana", "em": "x"}}]}, quem="teste")
    with m.dia_sujos_lock:
        sujos = set(m.dia_sujos)
    ok({D(-20), D(-21)} <= sujos and m.dia_wake.is_set(), "14: o dia e a véspera vão para o recálculo: %r" % sujos)
    m.dia_consolidar(sujos)
    L = {x["dia"]: x for x in m.dias_periodo(int(HOJE[:4]))["dias"]}
    ok(L[D(-20)]["tipo"] == "jogo" and L[D(-21)]["tipo"] == "vespera", "14: a linha muda para jogo e a véspera para vespera")
    # 15: resumo da Roverpix sumiu
    os.remove(rv)
    m.dia_consolidar([D(-3)])
    L = {x["dia"]: x for x in m.dias_periodo(int(HOJE[:4]))["dias"]}
    ok(L[D(-3)]["fonte_vendas"] == "roverpix" and L[D(-3)]["vendas"] == 7, "15: arquivo da Roverpix apagado não zera a linha: %r" % L[D(-3)])
    # base diária começa em 10/11/2026 (Eduardo): nada antes
    m.DIA_DESDE = "2026-11-10"
    ok(m.dia_consolidar(["2026-11-09"]) == 0, "D: nenhum dia antes de 10/11/2026 entra na série")

    # ---------- 16: total por dia ----------
    m._janelas.clear()
    s, j, _ = req("POST", "/ponto/entradas/totais", {"origem": "bilheteria", "dias": [{"dia": D(-1), "total": 1}] * 1001}, XE)
    ok(s == 400, "16: 1001 dias recusado: %d" % s)
    s, j, _ = req("POST", "/ponto/entradas/totais", {"origem": "bilheteria", "arquivo": "v.csv", "por": "Ana",
                                                     "dias": [{"dia": D(-1), "total": 1500}, {"dia": D(-1 + 0), "total": -3}, {"dia": D(5), "total": 10}, {"dia": "__proto__", "total": 10}, {"dia": D(-6), "total": True}]}, XE)
    ok(s == 200 and j["aceitos"] == 1 and len(j["recusados"]) == 4, "16: total negativo, dia no futuro, __proto__ e booleano recusados: %r" % j)
    ok(req("POST", "/ponto/entradas/totais", {"origem": "bilheteria", "dias": [{"dia": D(-1), "total": 1}]})[0] == 403, "16: sem X-Eterna: 403")
    ok(req("POST", "/ponto/entradas/totais", {"origem": "bip", "dias": [{"dia": D(-1), "total": 1}]}, XE)[0] == 400, "16: origem que não é bilheteria: 400")
    rs = m.op_ler("select dia, total from entrada_total where origem = 'bilheteria' order by dia")
    ok(all(r[0] != "__proto__" and r[1] >= 0 for r in rs) and (D(-1), 1500) in [tuple(r) for r in rs], "16: nada do inválido gravado: %r" % rs)
    imps = m.entradas_importacoes()["importacoes"]
    ok(any(x["origem"] == "bilheteria" and x["arquivo"] == "v.csv" and x["aceitas"] == 1 for x in imps), "16: importação registrada")

console = saida.getvalue()
ok(CHAVE not in console, "7: a chave não aparece no console")
ok("chave da API-Football salva por Admin Teste" in console, "auditoria no console sem a chave")
for raiz, _, arqs in os.walk(os.path.join(HA, "Eterna")):
    for a in arqs:
        if a == "api-football.json":
            continue
        try:
            if CHAVE.encode() in open(os.path.join(raiz, a), "rb").read():
                falhas.append("a chave apareceu em %s" % os.path.join(raiz, a)[len(HA):])
        except OSError:
            pass

print("%s agenda_agente: %s" % ("FALHA" if falhas else "OK", "; ".join(falhas[:8]) if falhas else "feriados, jogos, chave pela tela, série diária e totais"))
sys.exit(1 if falhas else 0)
