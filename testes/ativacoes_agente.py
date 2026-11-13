# v100: catálogo das ativações (coleção "ativ" do estado.db). Quem grava produto: Preços e Checkout (catalogo); "Hoje não vendo"
# (ativ/hoje|<id>): também quem altera Configurações. Formato conferido no servidor: fora do formato é recusado.
#   HOME=$(mktemp -d) python3 -I testes/ativacoes_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sys, threading
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def pede(met, rota, corpo, cookie):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    c.request(met, rota, json.dumps(corpo).encode() if corpo is not None else None,
              {"Host": HOST, "X-Eterna": "1", "Content-Type": "application/json", "Cookie": cookie})
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


def produto(**k):
    p = {"id": "asteroid", "cat": "drone", "nome": "Asteroid", "entrega": "video", "pede": "pessoas",
         "opcoes": [{"nome": "Campo", "preco": 180}, {"nome": "Arquibancada", "preco": 180}], "k4": 70, "chuva": 0,
         "extra": {"limite": 0, "valor": 0}, "inclui": {"chutes": 0, "videos": 1, "itens": []}, "ativo": True}
    p.update(k)
    return p


def grava(cookie, docs):
    st, j = pede("POST", "/ponto/docs", {"docs": docs}, cookie)
    return st, j


def ler(cookie):
    st, j = pede("GET", "/ponto/docs?col=ativ", None, cookie)
    return {d["id"]: d["valor"] for d in j.get("docs", [])} if st == 200 else None


try:
    RW = {"c": True, "r": True, "u": True, "d": True}
    RO = {"c": False, "r": True, "u": False, "d": False}
    adm = S.cookie_sessao(m, "admin-ativ")
    sup = S.cookie_sessao(m, "supervisor-ativ", {"catalogo": RO, "configuracao": {"c": False, "r": True, "u": True, "d": False}})
    ven = S.cookie_sessao(m, "vendedor-ativ", {"venda": RW, "catalogo": RO})

    ok("ativ" in m.ESTADO_COLS, "coleção ativ no estado.db")
    st, j = grava(adm, [{"col": "ativ", "id": "asteroid", "valor": produto()}])
    ok(st == 200 and ler(adm).get("asteroid", {}).get("opcoes", [{}])[0].get("preco") == 180, "admin grava produto: %s %s" % (st, j))

    # formato: cada um destes é recusado
    ruins = {
        "id diferente": produto(id="outro"),
        "categoria": produto(cat="foto"),
        "nome com <": produto(nome="<b>x</b>"),
        "sem nome": produto(nome="  "),
        "preço negativo": produto(opcoes=[{"nome": "Campo", "preco": -1}]),
        "preço texto": produto(opcoes=[{"nome": "Campo", "preco": "180"}]),
        "sem opções": produto(opcoes=[]),
        "13 opções": produto(opcoes=[{"nome": str(i), "preco": 1} for i in range(13)]),
        "ativo texto": produto(ativo="sim"),
        "faixas sem depois": produto(faixas=[110, 190]),
        "entrega": produto(entrega="whatsapp"),
    }
    for nome, v in ruins.items():
        grava(adm, [{"col": "ativ", "id": "asteroid", "valor": v}])
    ok(ler(adm)["asteroid"] == produto(), "formatos ruins não mudaram o produto: %s" % ler(adm)["asteroid"])
    st, j = grava(adm, [{"col": "ativ", "id": "snap_video", "valor": produto(id="snap_video", cat="snap", nome="Vídeo com IA", faixas=[110, 190, 290], depois=90, k4=0)}])
    ok("snap_video" in ler(adm), "produto com preço por quantidade aceito")
    st, j = grava(adm, [{"col": "ativ", "id": "hoje|asteroid", "valor": {"dia": "data ruim"}}])
    ok("hoje|asteroid" not in ler(adm), "Hoje não vendo com data ruim recusado")

    # permissões
    grava(sup, [{"col": "ativ", "id": "asteroid", "valor": produto(opcoes=[{"nome": "Campo", "preco": 1}])}])
    ok(ler(adm)["asteroid"]["opcoes"][0]["preco"] == 180, "supervisor (só vê preços) não muda preço")
    grava(sup, [{"col": "ativ", "id": "hoje|asteroid", "valor": {"dia": "2026-11-12", "por": "supervisor-ativ"}}])
    ok(ler(adm).get("hoje|asteroid", {}).get("dia") == "2026-11-12", "supervisor (altera Configurações) desliga no dia")
    grava(sup, [{"col": "ativ", "id": "hoje|inside_out.banco_de_suplentes", "valor": {"dia": "2026-11-12", "por": "supervisor-ativ"}}])
    ok(ler(adm).get("hoje|inside_out.banco_de_suplentes", {}).get("dia") == "2026-11-12", "um local fora de venda no dia")
    grava(sup, [{"col": "ativ", "id": "hoje|inside_out.Banco <x>", "valor": {"dia": "2026-11-12"}}])
    ok("hoje|inside_out.Banco <x>" not in ler(adm), "local fora do formato recusado")
    grava(ven, [{"col": "ativ", "id": "hoje|asteroid", "valor": None}])
    ok("hoje|asteroid" in ler(adm), "vendedor não religa o produto")
    grava(ven, [{"col": "ativ", "id": "asteroid", "valor": None}])
    ok("asteroid" in ler(adm), "vendedor não apaga produto")
    ok(ler(ven) is not None and "asteroid" in ler(ven), "vendedor lê o catálogo")
    grava(sup, [{"col": "ativ", "id": "hoje|asteroid", "valor": None}])
    ok("hoje|asteroid" not in ler(adm), "supervisor volta a vender no dia")
except Exception as e:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-600:])
finally:
    srv.shutdown()

if falhas:
    print("FALHA ativacoes_agente: " + " || ".join(falhas))
    sys.exit(1)
print("OK ativacoes_agente: coleção ativ, formato conferido, permissões de produto e de Hoje não vendo")
