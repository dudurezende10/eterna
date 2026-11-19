# 19/11 (junção publicar-v99-37): "Ligar mesmo assim" do reconhecimento do gramado (regra 19) e a chave da montagem no servidor
# (E2) convivem no mesmo agente. /status de verdade (handler do agente, HTTP neste processo) com o treino Ligada forçado
# (forcar, abaixo do critério) e a montagem em Sombra: os dois blocos aparecem; mudar a montagem (pelo /ponto/docs, como o
# Painel de controle grava) não mexe no treino, e mudar o treino (pelo /treino/config) não mexe na montagem.
# Nenhuma foto: só ids, sessões e textos sintéticos. Sem laços de fundo (nada é montado nem recortado).
#   HOME=$(mktemp -d) python3 -I testes/treino_montagem_agente.py agente/eterna-agente.py      (como o testes/rodar.sh chama)
import http.client, importlib.util, json, os, sqlite3, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

for k in ("ETERNA_MONTAGEM", "ETERNA_TESTE_CARGA"):
    os.environ.pop(k, None)
os.environ["ETERNA_SEM_OPENCV"] = "1"
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


# uma sessão fechada de 4 fotos (para marcar gramado e outra classe no Treino)
DIA = "2026-11-10"
t0 = time.mktime(time.strptime(DIA + " 10:00:00", "%Y-%m-%d %H:%M:%S"))
PIDS = ["%012x" % (0xbeef00000000 + i) for i in range(4)]
for i, p in enumerate(PIDS):
    m.meta[p] = {"o": "carlos", "s": "ftp", "u": t0 + i * 10 + 5, "cap": t0 + i * 10}
    m.lib[p] = {"file": os.path.join(HOME, "Eterna", "inbox", DIA, p + "_x.jpg"), "thumb": ""}
json.dump({"dia": DIA, "sessoes": [{"card": "LPTRMTG01", "dia": DIA, "fotografo": "carlos", "status": "fechada", "fotos": PIDS, "removida": False}]},
          open(os.path.join(m.SESS_DIR, DIA + ".json"), "w"))

srv = None
try:
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    adm = S.cookie_sessao(m, "admin-trmtg")

    def pede(metodo, rota, corpo=None, cookie=adm):
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=30)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        c.request(metodo, rota, json.dumps(corpo or {}).encode() if metodo == "POST" else None, h)
        r = c.getresponse()
        b = r.read()
        c.close()
        try:
            return r.status, json.loads(b or b"{}")
        except ValueError:
            return r.status, None

    def status_ate(cond, seg=8):
        """/status até cond(j) (o agente relê as duas chaves a cada 3 s; nada de mexer no cache por fora)."""
        fim = time.time() + seg
        while True:
            st, j = pede("GET", "/status")
            if st == 200 and j and cond(j):
                return j
            if time.time() > fim:
                return j or {}
            time.sleep(0.25)

    def doc(id_):
        db = sqlite3.connect(m.ESTADO_DB)
        try:
            r = db.execute("select valor from doc where col = 'config' and id = ?", (id_,)).fetchone()
        finally:
            db.close()
        return json.loads(r[0]) if r and r[0] else None

    def montagem(modo):
        return pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "montagem", "valor": {"modo": modo, "por": "admin-trmtg", "em": "2026-11-19T10:00:00Z"}}]})

    def tr(j):
        return (j.get("treino") or {})

    def mt(j):
        mm = j.get("montagem") or {}
        return {k: mm.get(k) for k in ("modo", "fundos", "versao", "imprime", "montaveis", "ativos")}

    def tr_fixo(j):
        t = tr(j)
        mp = t.get("modelo_ponto") or {}
        return (t.get("analise"), mp.get("ligada_versao"), mp.get("abaixo"), mp.get("congelados"), mp.get("aviso"))

    # marcações: gramado e outra classe (sem o modelo instalado e sem vetor, o forcar conta as marcações)
    bom = {"v": 1, "ia": {"serve": None, "motivos": [], "frente": None}, "qual": {"nivel": "boa", "motivos": [], "ajuste": []},
           "duvida": False, "obs": "", "base_em": None}
    for p, ponto in zip(PIDS, ("gramado", "gramado", "arquibancada", "trofeu")):
        st, r = pede("POST", "/treino/rotulo", dict(bom, pid="ag_" + p, ponto=ponto))
        ok(st == 200, "marcação %s: %s %r" % (ponto, st, r))

    # 1. montagem em Sombra e treino Ligada forçado: os dois blocos no /status
    st, r = montagem("sombra")
    ok(st == 200 and r.get("gravados") == 1, "chave da montagem em sombra: %s %r" % (st, r))
    st, r = pede("POST", "/treino/config", {"ponto": "ligada"})
    ok(st == 409 and r.get("error") == "criterio", "Ligada sem forcar abaixo do critério: 409: %s %r" % (st, r))
    st, lig = pede("POST", "/treino/config", {"ponto": "ligada", "forcar": True})
    ok(st == 200 and (lig.get("abaixo") or {}).get("por") == "admin-trmtg" and lig.get("ponto_versao"), "forcar liga abaixo do critério: %s %r" % (st, lig))
    j1 = status_ate(lambda j: mt(j)["modo"] == "sombra" and (tr(j).get("analise") or {}).get("ponto") == "ligada")
    ok(mt(j1)["modo"] == "sombra" and mt(j1)["imprime"] is True and mt(j1)["ativos"] == list(m.MTG_ATIVOS), "/status.montagem em sombra: %r" % (j1.get("montagem"),))
    mp1 = tr(j1).get("modelo_ponto") or {}
    ok((tr(j1).get("analise") or {}).get("ponto") == "ligada" and (mp1.get("abaixo") or {}).get("por") == "admin-trmtg"
       and mp1.get("ligada_versao") == lig.get("ponto_versao"), "/status.treino Ligada forçado: %r" % (tr(j1),))
    cfg_tr = doc("treino")

    def firme(seg=3.5):
        """Todas as respostas do /status por mais que o cache de 3 s das duas chaves (o agente relê o banco no meio)."""
        fim, todas = time.time() + seg, []
        while time.time() < fim:
            st, j = pede("GET", "/status")
            todas.append(j if st == 200 and j else {})
            time.sleep(0.25)
        return todas

    # 2. mudar a montagem (sombra -> ligada -> desligada -> sombra) não mexe no treino
    for modo in ("ligada", "desligada", "sombra"):
        st, r = montagem(modo)
        todas = firme()
        ok(st == 200 and mt(todas[-1])["modo"] == modo, "chave da montagem em %s: %s %r" % (modo, st, todas[-1].get("montagem")))
        ruins = [tr_fixo(j) for j in todas if tr_fixo(j) != tr_fixo(j1)]
        ok(not ruins, "montagem em %s não mexe no /status.treino: %r != %r" % (modo, ruins[:1], tr_fixo(j1)))
        ok(doc("treino") == cfg_tr, "montagem em %s não mexe no config/treino: %r" % (modo, doc("treino")))
    cfg_mt = doc("montagem")
    mt1 = mt(todas[-1])
    ok(mt1["modo"] == "sombra", "montagem de volta em sombra: %r" % (mt1,))

    # 3. mudar o treino (Só medir, Desligada, Ligada forçado de novo) não mexe na montagem
    for corpo, ponto in (({"ponto": "medir"}, "medir"), ({"ponto": "desligada"}, "desligada"), ({"ponto": "ligada", "forcar": True}, "ligada")):
        m._janelas.clear()                       # limite próprio do /treino/config: 6 por minuto por pessoa
        st, r = pede("POST", "/treino/config", corpo)
        todas = firme()
        ok(st == 200 and (tr(todas[-1]).get("analise") or {}).get("ponto") == ponto, "treino em %s: %s %r" % (ponto, st, r))
        ruins = [mt(j) for j in todas if mt(j) != mt1]
        ok(not ruins, "treino em %s não mexe no /status.montagem: %r != %r" % (ponto, ruins[:1], mt1))
        ok(doc("montagem") == cfg_mt, "treino em %s não mexe no config/montagem: %r" % (ponto, doc("montagem")))
    j = todas[-1]
    ok((tr(j).get("modelo_ponto") or {}).get("abaixo", {}).get("por") == "admin-trmtg", "Ligada forçado de novo traz o abaixo: %r" % (tr(j),))
    ok("treino" not in pede("GET", "/status", cookie=None)[1] and pede("GET", "/status", cookie=None)[0] == 200, "/status anônimo segue sem o treino")
except Exception as e:
    import traceback
    traceback.print_exc()
    falhas.append("exceção: %r" % e)
finally:
    if srv:
        srv.shutdown()

print(("OK" if not falhas else "FALHA") + " treino_montagem_agente: /status com treino Ligada forçado e montagem em sombra; uma chave não mexe na outra"
      + ("" if not falhas else ": " + " | ".join(falhas)))
sys.exit(1 if falhas else 0)
