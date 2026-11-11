# Apagar fotos a pedido do cliente (LGPD) no agente: foto comprada ou de cortesia numa galeria publicada que ainda vale
# fica com o cliente (arquivo, índice e cópia da galeria), e a galeria que tem alguma delas não é encerrada: só perde as
# fotos apagadas. Galeria sem foto do cliente é encerrada como antes. Pela função e pela rota POST /lgpd/excluir.
# Venda paga no balcão (vendas.db) segura as fotos escolhidas e a base da montagem mesmo sem galeria publicada; sem como
# conferir as galerias ou as vendas, nada é apagado.
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
os.environ.update(HOME=H, USERPROFILE=H, ETERNA_SEM_OPENCV="1", ETERNA_PORTA=str(PORTA),
                  ETERNA_PAGAMENTO="simulado", ETERNA_MODO_TESTE="1")   # v93: a compra pelo agente só existe simulada e em teste (7b)
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao   # v93: as rotas da equipe pedem sessão (tabela ROTAS) e todo POST leva X-Eterna
COOKIE = _agente_sessao.cookie_sessao(m)


class H2(m.H):
    def log_message(self, *a):
        pass


srv = ThreadingHTTPServer(("127.0.0.1", PORTA), H2)
threading.Thread(target=srv.serve_forever, daemon=True).start()


def req(caminho, corpo, origem=None):
    c = http.client.HTTPConnection("127.0.0.1", PORTA, timeout=10)
    hd = {"Content-Type": "application/json", "X-Eterna": "1", "Cookie": COOKIE}
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
    ok(r["preservadas_ids"] == ["ag_" + A1, "ag_" + A3] and r["galerias_mantidas_tokens"] == [paga], "1: a resposta diz quais ficaram e qual galeria continua: %r" % r)
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

    # 5. venda paga no balcão ainda sem galeria: a foto escolhida (E1) e a base da montagem (E2) ficam; a de venda só criada
    # (E3) e a que não entrou em venda nenhuma (E4) saem
    E1, E2, E3, E4 = "e1e1e1e1e1e1", "e2e2e2e2e2e2", "e3e3e3e3e3e3", "e4e4e4e4e4e4"
    arq.update({p: foto(p) for p in (E1, E2, E3, E4)})
    ev = lambda idem, venda, seq, tipo, dados=None: {"idem": idem, "venda": venda, "seq": seq, "tipo": tipo, "em": m._iso(), "dados": dados or {}}
    r = m.ev_receber({"posto": "Caixa 1", "eventos": [
        ev("t5-v1-criar", "t5-v1", 1, "criar", {"card": "LPE", "total": 190, "selected": ["ag_" + E1], "aiSel": ["ai:ag_" + E2 + "|mirante"]}),
        ev("t5-v1-pagar", "t5-v1", 2, "pagar", {"meio": "pix"}),
        ev("t5-v2-criar", "t5-v2", 1, "criar", {"card": "LPF", "total": 70, "selected": ["ag_" + E3]})]})
    ok(all(x["s"] == "ok" for x in r["resultados"]), "5: eventos de venda gravados: %r" % r)
    ok(m.lgpd_vendas_pagas() == {E1, E2}, "5: só a venda paga protege, com a foto e a base da montagem: %r" % m.lgpd_vendas_pagas())
    solta2 = galeria([(E1, "venda"), (E4, "venda")])          # galeria publicada antes do pagamento: a paga ainda está "à venda"
    s, j = req("/lgpd/excluir", {"pids": ["ag_" + E1, "ag_" + E2, "ag_" + E3, "ag_" + E4], "tokens": [solta2], "quem": "teste"})
    ok(s == 200 and j["fotos"] == 2 and j["preservadas"] == 2 and j["galerias"] == 0 and j["galerias_mantidas"] == 1, "5: 2 apagadas, 2 de venda paga preservadas, galeria mantida: %r %r" % (s, j))
    ok(all(os.path.exists(arq[p]) and p in m.lib for p in (E1, E2)), "5: a foto paga e a base da montagem paga continuam no disco e no índice")
    ok(all(not os.path.exists(arq[p]) and p not in m.lib for p in (E3, E4)), "5: as outras saem")
    m2 = m.REPO.ler_manifesto(solta2)
    ok(not m2.get("encerrada") and [f["id"] for f in m2["fotos"]] == ["ag_" + E1] and copia(solta2, E1) and not copia(solta2, E4), "5: a galeria com a foto paga continua, sem a apagada: %r" % m2["fotos"])

    # 6. sem como conferir, nada é apagado e fica a linha no registro: repositório que não lista as galerias; vendas.db que não abre
    F1 = "f1f1f1f1f1f1"
    arq[F1] = foto(F1)
    linhas = lambda: open(m.LGPD_LOG, encoding="utf8").read().count("recusada")
    n0 = linhas()

    class SemLista(m.Repositorio):
        def ler_manifesto(self, token): return None

    repo = m.REPO
    m.REPO = SemLista()
    try:
        s, j = req("/lgpd/excluir", {"pids": ["ag_" + F1], "quem": "teste"})
    finally:
        m.REPO = repo
    ok(s == 503 and j.get("error") and j["fotos"] == 0 and os.path.exists(arq[F1]) and F1 in m.lib, "6: repositório que não lista: recusa e a foto fica: %r %r" % (s, j))
    ok(linhas() == n0 + 1, "6: a recusa fica no registro")
    banco = m.vendas_db

    def quebrado():
        raise m.sqlite3.OperationalError("teste")

    m.vendas_db = quebrado
    try:
        r = m.lgpd_excluir([F1], [])
    finally:
        m.vendas_db = banco
    ok(not r["ok"] and r.get("error") and r["fotos"] == 0 and os.path.exists(arq[F1]), "6: vendas.db que não abre: recusa e a foto fica: %r" % r)
    ok(linhas() == n0 + 2 and F1 not in open(m.LGPD_LOG, encoding="utf8").read().split("recusada")[-1], "6: registro da recusa sem id de foto")
    r = m.lgpd_excluir([F1], [])
    ok(r["ok"] and r["fotos"] == 1 and not os.path.exists(arq[F1]), "6: com tudo de volta, apaga: %r" % r)
except Exception as ex:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-600:])

if not falhas:
    try:
        # 7. compra online no meio da exclusão. (a) a compra entra antes: a exclusão espera o lock da galeria e a foto fica
        G1, G2, G3 = "91a1a1a1a1a1", "92a2a2a2a2a2", "93a3a3a3a3a3"
        arq.update({p: foto(p) for p in (G1, G2, G3)})
        gg = galeria([(G1, "venda"), (G2, "venda"), (G3, "venda")])
        res = {}
        m.gal_lock.acquire()
        try:
            th = threading.Thread(target=lambda: res.update(r=m.lgpd_excluir([G1, G2], [gg])), daemon=True)
            th.start()
            time.sleep(0.4)
            ok(th.is_alive() and os.path.exists(arq[G1]) and os.path.exists(arq[G2]), "7a: a exclusão espera a compra em curso sem apagar nada")
            mm = m.REPO.ler_manifesto(gg)
            for f in mm["fotos"]:
                if f["id"] == "ag_" + G1:
                    f["direito"], f["canal"] = "comprada", "online"
            m.REPO.salvar_manifesto(gg, mm)
        finally:
            m.gal_lock.release()
        th.join(10)
        r = res.get("r") or {}
        ok(r.get("fotos") == 1 and r.get("preservadas") == 1 and r.get("galerias_mantidas") == 1 and os.path.exists(arq[G1]) and not os.path.exists(arq[G2]), "7a: a comprada durante a espera fica, a outra sai: %r" % r)
        mm = m.REPO.ler_manifesto(gg)
        ok(not mm.get("encerrada") and sorted(f["id"][3:] for f in mm["fotos"]) == [G1, G3], "7a: a galeria continua, sem a apagada: %r" % mm["fotos"])

        # (b) a compra entra depois (pela rota, enquanto os arquivos estão saindo): a foto já não está à venda, nada é cobrado
        ac = "acesso-teste-7b"
        m.acessos[ac] = {"token": gg, "pids": {"ag_" + G3}, "exp": time.time() + 600}
        visto = {}
        esquecer = m.sess_esquecer

        def no_meio(pid):
            if pid == G3 and "s" not in visto:
                visto["arquivo"] = os.path.exists(arq[G3])
                visto["s"], visto["j"] = req("/g/%s/pagamento" % gg, {"acesso": ac, "pids": ["ag_" + G3], "metodo": "pix", "idem": "teste-7b-0001"})
            return esquecer(pid)

        m.sess_esquecer = no_meio
        try:
            r = m.lgpd_excluir([G3], [])
        finally:
            m.sess_esquecer = esquecer
        ok(visto.get("s") == 400, "7b: compra no meio da exclusão é recusada (a foto já saiu da galeria): %r" % visto)
        mm = m.REPO.ler_manifesto(gg)
        ok(r["fotos"] == 1 and not os.path.exists(arq[G3]) and [f["id"][3:] for f in mm["fotos"]] == [G1] and mm["fotos"][0]["direito"] == "comprada", "7b: a foto sai e nenhuma galeria fica com foto comprada sem arquivo: %r %r" % (r, mm["fotos"]))
        ok(not any(v.get("idem") == "teste-7b-0001" for v in m.vendas_ler()), "7b: nenhuma venda online gravada")
    except Exception as ex:
        import traceback
        falhas.append("exceção: " + traceback.format_exc()[-600:])
srv.shutdown()

print(("FALHA lgpd_compradas_agente: " + " · ".join(falhas)) if falhas else "OK lgpd_compradas_agente: comprada e cortesia ficam, galeria paga continua aberta, galeria sem foto do cliente é encerrada, venda paga do balcão protege sem galeria, sem conferência nada sai")
sys.exit(1 if falhas else 0)
