# Apagar fotos a pedido do cliente (LGPD) no agente: foto comprada ou de cortesia numa galeria publicada que ainda vale
# fica com o cliente (arquivo, índice e cópia da galeria), e a galeria que tem alguma delas não é encerrada: só perde as
# fotos apagadas. Galeria sem foto do cliente é encerrada como antes. Pela função e pela rota POST /lgpd/excluir.
#   python3 -I testes/lgpd_compradas_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, tempfile, threading, time, http.client
from http.server import ThreadingHTTPServer

AG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "agente", "eterna-agente.py")
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


PORTA = int(os.environ.get("PORTA_TESTE") or 49701)
H = tempfile.mkdtemp()
os.environ.update(HOME=H, USERPROFILE=H, ETERNA_SEM_OPENCV="1", ETERNA_PORTA=str(PORTA))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)


class H2(m.H):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(("127.0.0.1", PORTA), H2)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def req(caminho, corpo, origem=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    hd = {"Content-Type": "application/json"}
    if origem:
        hd["Origin"] = origem
    c.request("POST", caminho, body=json.dumps(corpo).encode(), headers=hd)
    r = c.getresponse()
    b = r.read()
    c.close()
    try:
        return r.status, json.loads(b)
    except Exception:
        return r.status, None


PASTA = os.path.join(H, "fotos")
os.makedirs(PASTA)


def foto(pid):
    fp = os.path.join(PASTA, pid + "_IMG.JPG")
    open(fp, "wb").write(b"x" * 64)
    m.lib[pid] = {"file": fp, "thumb": fp}
    return fp


def token():
    t = m.secrets.token_urlsafe(16)[:22]
    while not m.token_ok(t):
        t = m.secrets.token_urlsafe(16)[:22]
    return t


def galeria(fotos, expira=86400):
    t = token()
    man = m.gal_validar({"token": t, "tipo": "sessao", "expira": m._iso(time.time() + expira), "precos": {"dig": 39, "todas": 250},
                         "fotos": [{"id": "ag_" + p, "sessao": "LPT", "direito": d} for p, d in fotos]})
    m.REPO.salvar_manifesto(t, man)
    for p, _ in fotos:                                   # cópias da galeria, como depois da publicação
        for v in ("original", "vitrine"):
            arq = m.REPO._arq(t, "ag_" + p, v)
            os.makedirs(os.path.dirname(arq), exist_ok=True)
            open(arq, "wb").write(b"g")
    return t


def copia(t, p, v="original"):
    return os.path.exists(m.REPO._arq(t, "ag_" + p, v))


try:
    # 1. venda de visita: galeria paga com a foto A1 comprada (da leva A), A3 cortesia, A2 e B1 à venda; outra galeria só à venda
    A1, A2, A3, A4, B1 = "a1a1a1a1a1a1", "a2a2a2a2a2a2", "a3a3a3a3a3a3", "a4a4a4a4a4a4", "b1b1b1b1b1b1"
    arq = {p: foto(p) for p in (A1, A2, A3, A4, B1)}
    paga = galeria([(A1, "comprada"), (A2, "venda"), (A3, "cortesia"), (B1, "venda")])
    solta = galeria([(A2, "venda"), (A4, "venda")])
    r = m.lgpd_excluir(["ag_" + A1, "ag_" + A2, "ag_" + A3, A4], [paga, solta], quem="teste", posto="Caixa 1", sessao="LPA")
    ok(r["fotos"] == 2 and r["preservadas"] == 2 and r["galerias"] == 1 and r["galerias_mantidas"] == 1, "1: 2 apagadas, 2 preservadas, 1 galeria encerrada, 1 mantida: %r" % r)
    ok(os.path.exists(arq[A1]) and os.path.exists(arq[A3]) and A1 in m.lib and A3 in m.lib, "1: a comprada e a cortesia continuam no disco e no índice")
    ok(not os.path.exists(arq[A2]) and not os.path.exists(arq[A4]) and A2 not in m.lib and A4 not in m.lib, "1: as não compradas saem")
    mp, ms = m.REPO.ler_manifesto(paga), m.REPO.ler_manifesto(solta)
    ok(not mp.get("encerrada") and not m.gal_expirou(mp), "1: a galeria paga continua aberta: %r" % {k: mp.get(k) for k in ("encerrada", "expira", "lgpd")})
    ok(sorted(f["id"][3:] + ":" + f["direito"] for f in mp["fotos"]) == sorted([A1 + ":comprada", A3 + ":cortesia", B1 + ":venda"]), "1: a galeria paga perde só a apagada: %r" % mp["fotos"])
    ok(copia(paga, A1) and copia(paga, A3) and copia(paga, B1) and not copia(paga, A2) and not copia(paga, A2, "vitrine"), "1: cópias da galeria: as do cliente ficam, a apagada sai")
    ok(ms.get("encerrada") and ms.get("lgpd"), "1: a galeria sem foto do cliente é encerrada")
    ok(m.gal_livres(mp) == {"ag_" + A1, "ag_" + A3}, "1: o QR continua abrindo a comprada e a cortesia: %r" % m.gal_livres(mp))

    # 2. pela rota: outra tentativa na comprada, com o token da galeria paga
    s, j = req("/lgpd/excluir", {"pids": ["ag_" + A1], "tokens": [paga], "quem": "teste"})
    ok(s == 200 and j["fotos"] == 0 and j["preservadas"] == 1 and j["galerias"] == 0 and j["galerias_mantidas"] == 1, "2: rota preserva a comprada e a galeria: %r %r" % (s, j))
    ok(os.path.exists(arq[A1]) and not m.REPO.ler_manifesto(paga).get("encerrada"), "2: arquivo e galeria continuam")
    s, j = req("/lgpd/excluir", {"pids": ["ag_" + A1]}, origem="https://exemplo.com")
    ok(s == 403 and os.path.exists(arq[A1]), "2: origem de fora continua recusada: %r" % s)

    # 3. galeria vencida não segura a foto; galeria encerrada também não
    C1, C2 = "c1c1c1c1c1c1", "c2c2c2c2c2c2"
    arq.update({p: foto(p) for p in (C1, C2)})
    galeria([(C1, "comprada")], expira=-3600)
    enc = galeria([(C2, "comprada")])
    me = m.REPO.ler_manifesto(enc)
    me["encerrada"] = True
    m.REPO.salvar_manifesto(enc, me)
    r = m.lgpd_excluir([C1, C2], [])
    ok(r["fotos"] == 2 and r["preservadas"] == 0 and not os.path.exists(arq[C1]) and not os.path.exists(arq[C2]), "3: galeria vencida ou encerrada não segura a foto: %r" % r)

    # 4. sem galeria nenhuma: como antes
    D1 = "d1d1d1d1d1d1"
    arq[D1] = foto(D1)
    r = m.lgpd_excluir([D1], [])
    ok(r["fotos"] == 1 and r["ok"] and not os.path.exists(arq[D1]), "4: foto sem galeria sai: %r" % r)
    ok(B1 in m.lib and os.path.exists(arq[B1]), "4: foto que ninguém pediu para apagar continua")
except Exception as ex:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-600:])
finally:
    srv.shutdown()

print(("FALHA lgpd_compradas_agente: " + " · ".join(falhas)) if falhas else "OK lgpd_compradas_agente: comprada e cortesia ficam, galeria paga continua aberta, galeria sem foto do cliente é encerrada")
sys.exit(1 if falhas else 0)
