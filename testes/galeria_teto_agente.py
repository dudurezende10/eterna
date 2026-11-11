# v96.1: rota /g/<token>/rosto do agente, no processo, com a busca de rosto simulada (sem OpenCV, sem foto de cliente).
#   python3 -I testes/galeria_teto_agente.py agente/eterna-agente.py
# 1. Venda (sessao): /g/<token>/livres abre comprada e cortesia sem selfie; selfie com acerto acrescenta só as à venda da pessoa;
#    selfie sem acerto não tira as compradas (continuam pela rota livres).
# 2. Teto da galeria: 20 selfies sem acerto no dia, de IPs diferentes, param a galeria até amanhã (a 21ª dá 429, o dono também)
#    e gravam o alerta sem o token; grupo de escola (evento) não entra nesse teto.
# 3. Sessão de menor usa o limiar de criança (LIMITE_MENOR), como a nuvem.
import importlib.util, json, os, sys, tempfile, threading, time, http.client
from http.server import ThreadingHTTPServer

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


H = tempfile.mkdtemp()
os.environ.update(HOME=H, USERPROFILE=H, ETERNA_SEM_OPENCV="1")
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.rostos["ligado"] = True
SIMS = {}
m.buscar_em = lambda imagens, pids: {"rosto": True, "sims": dict(SIMS)}


class H2(m.H):
    def do_POST(self):                     # o IP do cliente vem de um cabeçalho de teste (só neste processo)
        self.client_address = (self.headers.get("X-Teste-IP") or "127.0.0.1", 0)
        return m.H.do_POST(self)

    def log_message(self, *a):
        pass


PORTA = int(os.environ.get("PORTA_TESTE") or 41731)
srv = ThreadingHTTPServer(("127.0.0.1", PORTA), H2)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def req(metodo, caminho, corpo=None, ip="127.0.0.1"):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    dados = json.dumps(corpo).encode() if corpo is not None else None
    c.request(metodo, caminho, body=dados, headers={"Content-Type": "application/json", "X-Teste-IP": ip} if dados else {"X-Teste-IP": ip})
    r = c.getresponse()
    b = r.read()
    c.close()
    try:
        return r.status, json.loads(b)
    except Exception:
        return r.status, None


def galeria(tipo="sessao", menor=False):
    t = m.secrets.token_urlsafe(16)[:22]
    while not m.token_ok(t):
        t = m.secrets.token_urlsafe(16)[:22]
    fotos = [{"id": "ag_a1a1a1a1a1a1", "sessao": "LPT", "direito": "comprada"},     # o pai com a bandeira: rosto não bate
             {"id": "ag_a2a2a2a2a2a2", "sessao": "LPT", "direito": "cortesia"},
             {"id": "ag_b1b1b1b1b1b1", "sessao": "LPT", "direito": "venda"},        # a pessoa da selfie
             {"id": "ag_c1c1c1c1c1c1", "sessao": "LPT", "direito": "venda"}]        # outra pessoa
    man = m.gal_validar({"token": t, "tipo": tipo, "menor": menor, "expira": m._iso(time.time() + 86400), "precos": {"dig": 39, "todas": 250}, "fotos": fotos})
    m.REPO.salvar_manifesto(t, man)
    return t


SELFIE = {"consentimento": True, "versao": "t", "idioma": "pt", "imagem": "data:image/jpeg;base64,AAAA"}
try:
    # ---- 1. QR sozinho abre compradas e cortesias; selfie acrescenta só as à venda da pessoa ----
    T = galeria()
    st, r = req("GET", "/g/%s/livres" % T)
    ps = sorted(f["pid"] for f in (r or {}).get("galeria", {}).get("fotos", []))
    ok(st == 200 and ps == ["ag_a1a1a1a1a1a1", "ag_a2a2a2a2a2a2"], "1: livres sem selfie deveria trazer comprada e cortesia: %s %s" % (st, ps))
    SIMS.clear(); SIMS.update({"b1b1b1b1b1b1": 0.8, "c1c1c1c1c1c1": 0.1, "a1a1a1a1a1a1": 0.1})
    st, r = req("POST", "/g/%s/rosto" % T, SELFIE)
    ps = sorted(f["pid"] for f in (r or {}).get("galeria", {}).get("fotos", []))
    ok(st == 200 and r.get("ok") and ps == ["ag_a1a1a1a1a1a1", "ag_a2a2a2a2a2a2", "ag_b1b1b1b1b1b1"], "1: selfie com acerto: compradas + à venda da pessoa, sem a de outra: %s" % ps)
    SIMS.clear(); SIMS.update({"b1b1b1b1b1b1": 0.1})
    st, r = req("POST", "/g/%s/rosto" % T, SELFIE, ip="10.0.0.2")
    ok(st == 200 and r.get("motivo") == "nao_encontrado" and r.get("restam") == 4, "1: selfie sem acerto conta tentativa: %s %s" % (st, r))
    st, r = req("GET", "/g/%s/livres" % T)
    ok(st == 200 and len(r["galeria"]["fotos"]) == 2, "1: depois da selfie sem acerto as compradas continuam pelo QR")

    # ---- 2. teto por galeria, somando IPs ----
    T2 = galeria()
    SIMS.clear()
    res = [req("POST", "/g/%s/rosto" % T2, SELFIE, ip="10.1.%d.%d" % (i // 200, i % 200 + 1)) for i in range(20)]
    ok(all(s == 200 and j.get("motivo") == "nao_encontrado" for s, j in res), "2: as 20 primeiras sem acerto deveriam dar nao_encontrado: %s" % [s for s, _ in res])
    st, r = req("POST", "/g/%s/rosto" % T2, SELFIE, ip="10.9.9.9")
    ok(st == 429 and r.get("motivo") == "bloqueado", "2: a 21ª (outro IP) deveria dar 429: %s %s" % (st, r))
    amanha = m._amanha()
    ok(r and abs(m._epoch(r.get("ate")) - amanha) < 2, "2: bloqueio até o início de amanhã: %s" % (r or {}).get("ate"))
    SIMS.update({"b1b1b1b1b1b1": 0.9})
    st, r = req("POST", "/g/%s/rosto" % T2, SELFIE, ip="10.9.9.10")
    ok(st == 429, "2: com o teto, a galeria fica parada também para quem bate: %s" % st)
    st, r = req("GET", "/g/%s/livres" % T2)
    ok(st == 200 and len(r["galeria"]["fotos"]) == 2, "2: com o teto as compradas continuam pelo QR")
    alertas = open(m.GAL_ALERTAS).read() if os.path.exists(m.GAL_ALERTAS) else ""
    ok(alertas.count("galeria_teto_selfie") == 1 and T2 not in alertas and T2[:8] not in alertas, "2: um alerta gravado, sem o token: %r" % alertas[:200])
    ok(T not in alertas, "2: a outra galeria não entrou no alerta")
    st, r = req("POST", "/g/%s/rosto" % T, SELFIE, ip="10.9.9.11")
    ok(st == 200 and r.get("ok"), "2: outra galeria não é afetada pelo teto: %s %s" % (st, r))
    # grupo de escola não entra no teto da venda
    TE = galeria(tipo="evento", menor=True)
    SIMS.clear()
    res = [req("POST", "/g/%s/rosto" % TE, SELFIE, ip="10.2.0.%d" % (i + 1)) for i in range(21)]
    ok(all(s == 200 and j.get("motivo") == "nao_encontrado" for s, j in res), "2: grupo de escola fora do teto da venda: %s" % [s for s, _ in res][-3:])

    # ---- 3. sessão de menor usa o limiar de criança ----
    entre = (m.LIMITE + m.LIMITE_MENOR) / 2
    ok(m.LIMITE < entre < m.LIMITE_MENOR, "3: pré: LIMITE < LIMITE_MENOR")
    SIMS.clear(); SIMS.update({"b1b1b1b1b1b1": entre})
    TA, TM = galeria(), galeria(menor=True)
    st, r = req("POST", "/g/%s/rosto" % TA, SELFIE, ip="10.3.0.1")
    ok(st == 200 and r.get("ok"), "3: sessão de adulto abre com %.3f: %s %s" % (entre, st, r))
    st, r = req("POST", "/g/%s/rosto" % TM, SELFIE, ip="10.3.0.2")
    ok(st == 200 and r.get("motivo") == "nao_encontrado", "3: sessão de menor exige o limiar de criança: %s %s" % (st, r))
    SIMS.update({"b1b1b1b1b1b1": m.LIMITE_MENOR + 0.01})
    st, r = req("POST", "/g/%s/rosto" % TM, SELFIE, ip="10.3.0.3")
    ok(st == 200 and r.get("ok"), "3: sessão de menor abre acima do limiar de criança: %s %s" % (st, r))
except Exception as ex:
    falhas.append("erro: %r" % ex)
finally:
    srv.shutdown()

print(("OK" if not falhas else "FALHA") + " galeria_teto_agente: compradas pelo QR, teto de 20 por galeria, limiar de criança na sessão de menor"
      + ("" if not falhas else " · " + " | ".join(falhas[:6])))
sys.exit(1 if falhas else 0)
