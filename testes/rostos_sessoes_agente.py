# 26/11 (fase 2 do plano docs/planos/2026-11-26-procurar-vender.md, critérios 23 a 28): busca por selfie do VENDEDOR, lado do agente.
# POST /rostos/sessoes e /rostos/sessoes/marcar: quem entra, os dois níveis, o que nunca vem (ontem, removida, menor, escola, base de
# IA, foto ainda sem leitura), rosto maior quando há vários, limite por pessoa, registro em busca_vend carimbado pela sessão, nada de
# imagem no disco, chaves para desligar, e a selfie do cliente (POST /rostos/buscar) respondendo como antes.
# Rostos sintéticos (vetor unitário aleatório de 128, semente fixa) e leitor de imagem falso. Nunca foto de convidado.
# Roda sozinho:  USER=teste HOME=$(mktemp -d) python3 -I testes/rostos_sessoes_agente.py agente/eterna-agente.py
import array, base64, http.client, importlib.util, json, os, random, sys, tempfile, threading, time
from http.server import ThreadingHTTPServer

sys.dont_write_bytecode = True
AG = sys.argv[1]
AQUI = os.path.dirname(os.path.abspath(__file__))
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


HA = tempfile.mkdtemp()
os.environ.update(HOME=HA, USERPROFILE=HA, ETERNA_SEM_OPENCV="1")
for k in ("ETERNA_SESSAO_PAUSA", "ETERNA_SESS_LIMITES", "ETERNA_VIZINHAS", "ETERNA_ORIGENS", "ETERNA_BUSCA_DIAS", "ETERNA_BUSCA_JANELA_MIN",
          "ETERNA_BUSCA_VEND", "ETERNA_BUSCA_VEND_PISO", "ETERNA_SELFIE_LOG"):
    os.environ.pop(k, None)
os.environ["ETERNA_BUSCA_VEND"] = "1"            # a busca nasce desligada: o teste liga pela variável, como o servidor
os.makedirs(os.path.join(HA, "Eterna"), exist_ok=True)
json.dump({"users": {n: "x" * 12 for n in ("carlos", "samuel")}}, open(os.path.join(HA, "Eterna", "ftp.json"), "w"))
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
sys.path.insert(0, AQUI)
import _agente_sessao as S

# ---------- constantes e trava do piso (não dependem do numpy) ----------
PISO = m.BUSCA_VEND_PISO
ok(m.LIMITE == 0.45 and m.LIMITE_TALVEZ == 0.38, "os limites da selfie do cliente não mudaram: %r %r" % (m.LIMITE, m.LIMITE_TALVEZ))
ok(m.BUSCA_VEND_PISO_MIN <= PISO < m.LIMITE_TALVEZ and m.BUSCA_VEND_ON is True, "piso do pode ser dentro da faixa travada: %r" % PISO)
for val, esperado in ((None, False), ("", False), ("0", False), ("true", False), ("sim", False), ("2", False), (" 1 ", True), ("1", True)):
    if val is None:
        os.environ.pop("ETERNA_BUSCA_VEND", None)
    else:
        os.environ["ETERNA_BUSCA_VEND"] = val
    ok(m.busca_vend_env() is esperado, "a busca do vendedor só liga com ETERNA_BUSCA_VEND=1: %r -> %r" % (val, m.busca_vend_env()))
os.environ["ETERNA_BUSCA_VEND"] = "1"
ok(m._busca_vend_piso("0.01") == m.BUSCA_VEND_PISO_MIN and m._busca_vend_piso("0.9") == m.LIMITE_TALVEZ and m._busca_vend_piso("-3") == m.BUSCA_VEND_PISO_MIN
   and m._busca_vend_piso("abc") == m.BUSCA_VEND_PISO_PADRAO and m._busca_vend_piso("nan") == m.BUSCA_VEND_PISO_PADRAO and m._busca_vend_piso("") == m.BUSCA_VEND_PISO_PADRAO
   and m._busca_vend_piso("0,33") == 0.33, "piso por variável de ambiente fica travado na faixa")
ok(m.rota_regra("POST", "/rostos/sessoes") == ("sessao", ("venda.c",)) and m.rota_regra("POST", "/rostos/sessoes/marcar") == ("sessao", ("venda.c",))
   and m.rota_regra("GET", "/rostos/sessoes") is None and m.rota_regra("POST", "/rostos/buscar") == ("posto_ou_sessao", m.VENDER), "regras das rotas")

m.SELFIE_LOG_DIR = os.path.join(HA, "diagnostico", "selfie")
m.rostos["ligado"] = True
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT
adm = S.cookie_sessao(m, "admin-bv")
VENDA = {"venda": {"c": True, "r": True, "u": True}, "quiosque": {"c": True, "r": True, "u": True}}
vend = S.cookie_sessao(m, "vendedora-bv", VENDA)
vend2 = S.cookie_sessao(m, "vendedor2-bv", VENDA)
so_ck = S.cookie_sessao(m, "checkout-bv", {"quiosque": {"c": True, "r": True, "u": True}})      # o perfil Checkout
so_ler = S.cookie_sessao(m, "leitura-bv", {"venda": {"r": True, "u": True}, "galerias": {"c": True, "r": True}})
vercomo = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("vendedora-bv", por="admin-bv"))
posto = S.cookie_posto(m, "Caixa 7")
# vendedor com vínculo de fotógrafo e Minhas fotos (na tela, só vê as próprias sessões): não usa a busca, que devolve as de todos
m.estado_gravar({"docs": [{"col": "usuarios", "id": "fotovend-bv", "valor": {"v": 2, "email": "fotovend-bv", "name": "fotovend-bv", "active": True, "preset": "custom", "key": "carlos",
                                                                           "perms": dict(VENDA, set={"r": True})}},
                          {"col": "usuarios", "id": "superv-bv", "valor": {"v": 2, "email": "superv-bv", "name": "superv-bv", "active": True, "preset": "supervisor", "key": "carlos",
                                                                         "perms": dict(VENDA, set={"r": True})}}]})
preso = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("fotovend-bv"))
sup = "%s=%s" % (m.AUTH_COOKIE, m.auth_sessao_nova("superv-bv"))


def png(rotulo, w=640, h=480):
    """Um "quadro" de teste: cabeçalho de PNG com o tamanho (é só o que o agente lê antes de decodificar) e um rótulo."""
    return b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + w.to_bytes(4, "big") + h.to_bytes(4, "big") + rotulo


def pede(metodo, rota, corpo=None, cookie=None, extra=None, xe=True, cru=None):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    h = {"Host": HOST}
    if metodo == "POST":
        h["Content-Type"] = "application/json"
        if xe:
            h["X-Eterna"] = "1"
    if cookie:
        h["Cookie"] = cookie
    h.update(extra or {})
    c.request(metodo, rota, (cru if cru is not None else json.dumps(corpo if corpo is not None else {}).encode()) if metodo == "POST" else None, h)
    r = c.getresponse()
    b = r.read()
    c.close()
    try:
        return r.status, json.loads(b or b"{}")
    except ValueError:
        return r.status, {}


def linhas():
    db = m.vendas_db()
    try:
        return db.execute("select id, em, dia, por, posto, resultado, certeza, talvez, achadas, marcadas, marcada_em from busca_vend order by rowid").fetchall()
    finally:
        db.close()


IMG0 = ["data:image/png;base64," + base64.b64encode(png(b"sem-rosto")).decode()]

# ---------- 23: quem entra ----------
for rota, corpo in (("/rostos/sessoes", {"imagens": IMG0}), ("/rostos/sessoes/marcar", {"busca": "0" * 16, "cards": []})):
    st, r = pede("POST", rota, corpo)
    ok(st == 401 and r.get("erro") == "sem_sessao", "23: %s sem pessoa conectada: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=posto)
    ok(st == 401, "23: %s com posto pareado e sem pessoa: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=so_ck)
    ok(st == 403 and r.get("erro") == "sem_permissao", "23: %s no perfil Checkout (sem venda em Criar): %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=so_ck + "; " + posto)
    ok(st == 403, "23: %s no perfil Checkout com posto pareado: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=so_ler)
    ok(st == 403, "23: %s com venda só em Ver: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=preso)
    ok(st == 403 and r.get("erro") == "sem_permissao", "6: %s com vínculo de fotógrafo e Minhas fotos: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=vercomo)
    ok(st == 403 and r.get("erro") == "so_ver", '23: %s no "ver como": %s %r' % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=vend, extra={"Origin": "http://evil.example"})
    ok(st == 403, "23: %s com Origin de fora: %s %r" % (rota, st, r))
    st, r = pede("POST", rota, corpo, cookie=vend, xe=False)
    ok(st == 403, "23: %s sem X-Eterna: %s %r" % (rota, st, r))
    st, r = pede("GET", rota, cookie=vend)
    ok(st == 404, "23: %s por GET não existe: %s" % (rota, st))
ok(linhas() == [], "23: pedido recusado não grava busca: %r" % (linhas(),))

try:
    import numpy as np
except Exception:
    srv.shutdown()
    print(("OK" if not falhas else "FALHA") + " rostos_sessoes_agente: numpy ausente, só as regras de acesso foram conferidas" + ("" if not falhas else " · " + " | ".join(falhas)))
    sys.exit(1 if falhas else 0)

# ---------- cenário ----------
rnd = random.Random(2611)
HOJE = m._ff_hoje()
ONTEM = m._ff_hoje(time.time() - 86400)
T0 = time.time() - 900
_seq = [0]


def unit():
    v = [rnd.gauss(0, 1) for _ in range(128)]
    n = sum(a * a for a in v) ** 0.5
    return [a / n for a in v]


def mistura(v, sim):
    """Vetor unitário com semelhança exata sim com v (v unitário)."""
    u = unit()
    d = sum(a * b for a, b in zip(u, v))
    u = [a - d * b for a, b in zip(u, v)]
    n = sum(a * a for a in u) ** 0.5
    k = (1 - sim * sim) ** 0.5
    return [sim * b + k * a / n for a, b in zip(u, v)]


def sessao(o, fotos, status="fechada", dia=None, ia=(), pend=(), **mais):
    """fotos = lista; cada item é a lista de rostos [(largura, vetor)] da foto. A leitura de rosto é sempre gravada no dia de
    HOJE (a matriz da busca), mesmo quando a sessão é de ontem: quem tira a sessão de ontem é o filtro da busca do vendedor."""
    dia = dia or HOJE
    _seq[0] += 1
    t = T0 + _seq[0] * 20
    pids, lf, lr = [], [], []
    for fs in fotos:
        _seq[0] += 1
        p = "%012x" % (0xb00000000000 + _seq[0])
        pids.append(p)
        lf.append((p, HOJE, len(fs), time.time()))
        for larg, v in fs:
            lr.append((p, HOJE, float(larg), array.array("f", v).tobytes()))
    with m.sess_lock:
        x = m._sess_nova(dia + "|" + o, t, t, "inicio", {}, o, "ftp", "cap", False)
        x.update(fotos=[p for i, p in enumerate(pids) if i not in pend], pend=[pids[i] for i in pend], cap0=t, cap1=t + 10,
                 ultima_chegada=t + 12, status=status, ia=[pids[i] for i in ia], ponto="campo2")
        if status == "fechada":
            x["fechada_em"] = t + 80
        x.update(mais)
        for p in pids:
            m.sess_pid[p] = x["card"]
        card = x["card"]
    db = m.rostos_db()
    db.executemany("insert or replace into foto values (?,?,?,?)", lf)
    db.executemany("insert into rosto values (?,?,?,?)", lr)
    db.commit()
    db.close()
    return card, pids


A, B, OUTRO = unit(), unit(), unit()
f = lambda sim, larg=200, de=None: (larg, mistura(de or A, sim))
S_CERTA, P_CERTA = sessao("carlos", [[f(.72)], [f(.61), (180, unit())], [(200, unit())], [f(.93)]], ia=(3,))   # a 4ª é base de IA
S_TACA, P_TACA = sessao("samuel", [[f(.33)], [(200, unit())]])                 # de lado e de boné: só "pode ser"
S_ABERTA, P_ABERTA = sessao("carlos", [[f(.66)]], status="aberta")
S_DUVIDA, P_DUVIDA = sessao("samuel", [[f(.41)]])                               # a faixa de dúvida de hoje (0,38 a 0,45)
S_FUNDO, P_FUNDO = sessao("samuel", [[(300, unit()), f(.64, 60)]])              # nota alta, mas a pessoa só passa ao fundo
S_ONTEM, _ = sessao("carlos", [[f(.81)]], dia=ONTEM)
S_REMOVIDA, _ = sessao("carlos", [[f(.82)]], removida=True)
S_MENOR, _ = sessao("carlos", [[f(.83)]], menor=True)
S_ESCOLA, _ = sessao("carlos", [[f(.84)]])
m.vis_prot.add(S_ESCOLA)
S_SO_IA, _ = sessao("samuel", [[f(.85)], [(200, unit())]], ia=(0,))             # o rosto só bate na base de IA
S_PEND, _ = sessao("samuel", [[f(.86)], [(200, unit())]], pend=(0,))            # o rosto só bate em foto ainda na fila
S_BAIXA, _ = sessao("samuel", [[f(max(0.05, PISO - 0.04))]])                    # abaixo do piso
S_B, P_B = sessao("carlos", [[f(.74, de=B)]])                                   # outra pessoa
with m._mat_lock:
    m._mat.clear()

# leitor falso: a "imagem" é um rótulo; cada rótulo tem os rostos do quadro, do maior para o menor
QUADROS = {b"so-a": [(300, A)], b"a-de-novo": [(280, mistura(A, .95))], b"sem-rosto": [],
           b"a-e-b": [(300, A), (200, B)],                                      # dois rostos de tamanho parecido: o maior é o A
           b"b-na-frente": [(310, B), (290, A)],                                # noutro quadro o maior vira o B
           b"so-b": [(300, B)], b"ninguem": [(300, OUTRO)]}


class Cv2Falso:
    IMREAD_COLOR = 1

    @staticmethod
    def imdecode(buf, _flag):
        DECODIFICADAS.append(len(buf))
        return bytes(buf)[24:]            # o rótulo, depois do cabeçalho de PNG do teste


DECODIFICADAS = []


m._cv.update(np=np, cv2=Cv2Falso)
m._busca["m"] = (None, None)
m.ler_rostos = lambda img, det, rec, minimo=40, **k: [(l, np.asarray(v, "float32")) for l, v in QUADROS[img]]
img = lambda *nomes: ["data:image/png;base64," + base64.b64encode(png(n)).decode() for n in nomes]


def arquivos():
    o = set()
    for raiz, _d, fs in os.walk(HA):
        o.update(os.path.join(raiz, x) for x in fs)
    return o


antes = arquivos()
# ---------- 24 e 25: os dois níveis e o que nunca vem ----------
m._janelas.clear()
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a", b"a-de-novo", b"sem-rosto"), "por": "outra-pessoa", "posto": "Posto falso", "dias": 9, "todo": True, "janela": 9999}, cookie=vend + "; " + posto)
ss = {o["card"]: o for o in r.get("sessoes") or []}
ok(st == 200 and r.get("ok") is True and r.get("rosto") is True and r.get("varias") is False and set(r) == {"ok", "busca", "rosto", "varias", "fila", "sessoes"}
   and isinstance(r.get("busca"), str) and len(r["busca"]) == 16, "contrato da resposta: %s %r" % (st, {k: r.get(k) for k in r if k != "sessoes"}))
ok(set(ss) == {S_CERTA, S_ABERTA, S_TACA, S_DUVIDA, S_FUNDO}, "25: só as sessões de hoje que podem sair: %r" % (sorted(ss),))
for nome, c in (("de ontem", S_ONTEM), ("removida", S_REMOVIDA), ("de menor", S_MENOR), ("de escola", S_ESCOLA), ("só com base de IA", S_SO_IA),
                ("só com foto na fila", S_PEND), ("abaixo do piso", S_BAIXA), ("de outra pessoa", S_B)):
    ok(c not in ss and c not in json.dumps(r), "25: sessão %s nunca vem" % nome)
ok(all(set(o) == {"card", "nivel", "status", "fotografo", "ponto", "cap0", "cap1", "n", "bateu"} and all(set(b) == {"id"} for b in o["bateu"]) for o in ss.values()),
   "contrato de cada sessão, sem a nota: %r" % (list(ss.values())[:1],))
ok('"sim"' not in json.dumps(r) and not any(isinstance(v, float) and 0 < v < 1 for o in ss.values() for v in o.values()), "4: a resposta não leva nota nenhuma (nem por sessão, nem por foto)")
NOTAS = {a[0]: a[2] for a in json.loads(m.busca_vend_dia(HOJE)[-1]["achadas"] if isinstance(m.busca_vend_dia(HOJE)[-1]["achadas"], str) else json.dumps(m.busca_vend_dia(HOJE)[-1]["achadas"]))}
c_ = ss.get(S_CERTA) or {}
ok(c_.get("nivel") == "certeza" and c_.get("status") == "fechada" and c_.get("fotografo") == "carlos" and c_.get("ponto") == "campo2" and c_.get("n") == 3
   and [b["id"] for b in c_.get("bateu") or []] == [P_CERTA[0], P_CERTA[1]] and NOTAS.get(S_CERTA, 0) >= 0.6,
   "24: certeza com as fotos em que o rosto bateu, sem a base de IA: %r" % (c_,))
ok(P_CERTA[3] not in json.dumps(r), "25: foto que é base de IA nunca é devolvida")
ok((ss.get(S_ABERTA) or {}).get("status") == "aberta" and ss[S_ABERTA]["nivel"] == "certeza", "25: sessão aberta vem com status aberta: %r" % (ss.get(S_ABERTA),))
t_ = ss.get(S_TACA) or {}
ok(t_.get("nivel") == "pode_ser" and PISO <= NOTAS.get(S_TACA, 0) < m.LIMITE_TALVEZ and [b["id"] for b in t_.get("bateu") or []] == [P_TACA[0]], "24: nota 0,33 aparece em pode_ser: %r" % (t_,))
ok((ss.get(S_DUVIDA) or {}).get("nivel") == "pode_ser", "24: a faixa de dúvida (0,38 a 0,45) é pode_ser: %r" % (ss.get(S_DUVIDA),))
ok((ss.get(S_FUNDO) or {}).get("nivel") == "pode_ser" and NOTAS.get(S_FUNDO, 0) >= m.LIMITE, "nota alta com a pessoa só ao fundo não chega marcada: %r" % (ss.get(S_FUNDO),))
niveis = [o["nivel"] for o in r["sessoes"]]
ok(niveis == sorted(niveis, key=lambda n: n != "certeza") and niveis.count("certeza") == 2, "certeza vem antes de pode_ser: %r" % (niveis,))
BUSCA1 = r["busca"]

# ---------- 26: o registro é carimbado pelo servidor ----------
L = linhas()
ok(len(L) == 1 and L[0][0] == BUSCA1 and L[0][3] == "vendedora-bv" and L[0][4] == "Caixa 7" and L[0][2] == HOJE and L[0][5] == "achou" and L[0][6] == 2 and L[0][7] == 3
   and {a[0] for a in json.loads(L[0][8])} == set(ss) and L[0][9] is None and L[0][10] is None and "outra-pessoa" not in json.dumps(L) and "Posto falso" not in json.dumps(L),
   "26: uma linha em busca_vend, com quem e posto vindos da sessão e não do corpo: %r" % (L,))
ok(all(isinstance(a[2], float) for a in json.loads(L[0][8])), "4: a nota fica só no banco")

# ---------- 24: a selfie do cliente responde como antes ----------
st, rb = pede("POST", "/rostos/buscar", {"imagens": img(b"so-a", b"a-de-novo")}, cookie=vend + "; " + posto)
idsb = {x["id"] for x in rb.get("fotos") or []}
ok(st == 200 and rb.get("rosto") is True and rb.get("limite") == 0.45 and "varias" not in rb and "sessoes" not in rb and "busca" not in rb
   and set(rb) <= {"rosto", "fotos", "limite", "janela_min", "fila", "vizinhas", "viz"} and rb.get("janela_min") == 90, "/rostos/buscar: mesmo contrato: %s %r" % (st, {k: rb.get(k) for k in rb if k not in ("fotos", "vizinhas")}))
ok(P_TACA[0] not in idsb and all(x["sim"] >= m.LIMITE_TALVEZ for x in rb["fotos"]) and all(set(x) == {"id", "sim", "principal"} for x in rb["fotos"]),
   "24: /rostos/buscar não devolve a foto de nota 0,33 nem nada abaixo de 0,38: %r" % (sorted(x["sim"] for x in rb["fotos"])[:3],))
ok({P_CERTA[0], P_CERTA[1], P_CERTA[3], P_ABERTA[0], P_DUVIDA[0], P_FUNDO[0]} <= idsb, "/rostos/buscar segue devolvendo por foto, como antes (inclui a base de IA): %d fotos" % len(idsb))
st, rb = pede("POST", "/rostos/buscar", {"imagens": img(b"a-e-b")}, cookie=vend)
ok(st == 200 and rb == {"rosto": True, "varias": True, "fotos": []}, "/rostos/buscar segue recusando duas pessoas: %r" % (rb,))
st, rb = pede("POST", "/rostos/buscar", {"imagens": img(b"sem-rosto")}, cookie=vend)
ok(st == 200 and rb == {"rosto": False, "fotos": []}, "/rostos/buscar sem rosto: %r" % (rb,))
rv = m.buscar_vetor(np.asarray(A, "float32"), 1, 0)
ok(all(x["sim"] >= m.LIMITE_TALVEZ for x in rv["fotos"]) and P_TACA[0] not in {x["id"] for x in rv["fotos"]}, "buscar_vetor sem piso: corte de sempre")
rv = m.buscar_vetor(np.asarray(A, "float32"), 1, 0, piso=-1)
ok(all(x["sim"] >= m.BUSCA_VEND_PISO_MIN for x in rv["fotos"]), "buscar_vetor nunca desce abaixo do mínimo travado, nem com piso negativo")
ok(len(linhas()) == 1, "/rostos/buscar não grava busca do vendedor")


def selfies_bi():
    db = m.vendas_db()
    try:
        return db.execute("select origem, count(*) from selfie group by origem order by origem").fetchall()
    finally:
        db.close()


ok(selfies_bi() == [("checkout", 3)], "a contagem das selfies dos clientes (Estatísticas) não recebe a busca do vendedor: %r" % (selfies_bi(),))

# ---------- regra 3: mais de um rosto no quadro: usa o maior e avisa ----------
m._janelas.clear()
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"a-e-b")}, cookie=vend)
cs = {o["card"] for o in r.get("sessoes") or []}
ok(st == 200 and r.get("varias") is True and r.get("rosto") is True and S_CERTA in cs and S_B not in cs, "vários rostos: busca com o maior (A) e varias:true: %r %r" % (r.get("varias"), sorted(cs)))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"a-e-b", b"b-na-frente", b"so-a")}, cookie=vend)
cs = {o["card"] for o in r.get("sessoes") or []}
ok(st == 200 and r.get("varias") is True and S_CERTA in cs and S_B not in cs, "o maior troca entre os quadros: fica quem é o maior em mais quadros, sem misturar as duas pessoas: %r" % (sorted(cs),))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-b")}, cookie=vend)
ok(st == 200 and r.get("varias") is False and [o["card"] for o in r["sessoes"]] == [S_B], "um rosto só: varias false: %r" % (r,))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"sem-rosto")}, cookie=vend)
ok(st == 200 and r.get("ok") is True and r.get("rosto") is False and r.get("sessoes") == [] and linhas()[-1][5] == "sem_rosto", "sem rosto: lista vazia e registrada: %r" % (r,))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"ninguem")}, cookie=vend)
ok(st == 200 and r.get("rosto") is True and r.get("sessoes") == [] and linhas()[-1][5] == "nao_achou", "rosto que não está em nenhuma sessão: %r" % (r,))

# ---------- 28: nada de imagem no disco ----------
novos = arquivos() - antes
ok(all(x.endswith((".jsonl", ".db", ".db-wal", ".db-shm")) for x in novos), "28: nenhum arquivo novo além de registro e banco: %r" % (sorted(novos),))
marcas = [base64.b64encode(png(n)) for n in QUADROS] + list(QUADROS)
for x in arquivos():
    try:
        d = open(x, "rb").read()
    except OSError:
        continue
    ok(not any(mk in d for mk in marcas), "28: a imagem da câmera não foi gravada em %s" % os.path.basename(x))
ok(getattr(m._viz_tl, "vets", None) is None, "os vetores da busca não ficam guardados")
diag = open(os.path.join(m.SELFIE_LOG_DIR, HOJE + ".jsonl"), encoding="utf-8").read()
dl = [json.loads(x) for x in diag.strip().splitlines()]
dv = [x for x in dl if x.get("origem") == "vendedor"]
ok(len(dv) == 6 and dv[0]["vendedor"] == "vendedora-bv" and dv[0]["posto"] == "Caixa 7" and dv[0]["resultado"] == "achou"
   and not any(c in json.dumps(dv) for c in (S_ONTEM, S_MENOR, S_ESCOLA)) and P_CERTA[3] not in json.dumps(dv), "diagnóstico da busca do vendedor, só com o que saiu: %r" % (dv[:1],))

# ---------- 26: limite por pessoa ----------
m._janelas.clear()
n0 = len(linhas())
sts = [pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)[0] for _ in range(7)]
ok(sts == [200] * 6 + [429], "26: a sétima busca no mesmo minuto dá 429: %r" % (sts,))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)
ok(st == 429 and r.get("erro") == "muitas_buscas" and "sessoes" not in r, "26: 429 muitas_buscas, sem lista: %s %r" % (st, r))
buscas = lambda quem="vendedora-bv": [x for x in linhas() if x[3] == quem and x[5] not in m.BUSCA_VEND_FORA]
recusas = lambda quem="vendedora-bv": [x for x in linhas() if x[3] == quem and x[5] in m.BUSCA_VEND_FORA]
ok(len([x for x in linhas() if x[5] not in m.BUSCA_VEND_FORA]) == n0 + 6 and all(x[3] == "vendedora-bv" for x in linhas()), "26: cada busca aceita grava uma linha de busca")
ok([x[5] for x in recusas()] == ["limite_min", "limite_min"] and all(x[6] == 0 and x[8] == "[]" for x in recusas()), "7: a recusa por limite também fica registrada: %r" % ([x[5] for x in recusas()],))
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend2)
ok(st == 200 and linhas()[-1][3] == "vendedor2-bv" and linhas()[-1][4] == "ip 127.0.0.1", "26 e 17: o limite é por pessoa; sem posto pareado fica o endereço do aparelho: %s %r" % (st, linhas()[-1][4]))
BUSCA2 = r["busca"]
m._janelas.clear()
dia_max, m.BUSCA_VEND_POR_DIA = m.BUSCA_VEND_POR_DIA, len(buscas())
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)
ok(st == 429 and r.get("erro") == "limite_dia" and "sessoes" not in r and linhas()[-1][5] == "limite_dia" and linhas()[-1][3] == "vendedora-bv",
   "7: teto do dia por pessoa, contado no banco, com erro próprio e registrado: %s %r" % (st, r))
# 7: seis buscas ao mesmo tempo com 2 de folga no teto do dia: passam exatamente 2
m._janelas.clear()
m.BUSCA_VEND_POR_DIA = len(buscas()) + 2
saida = []
ts = [threading.Thread(target=lambda: saida.append(pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend))) for _ in range(6)]
[t.start() for t in ts]
[t.join() for t in ts]
ok(sorted(x[0] for x in saida) == [200, 200, 429, 429, 429, 429] and all(x[1].get("erro") == "limite_dia" for x in saida if x[0] == 429) and len(buscas()) == m.BUSCA_VEND_POR_DIA,
   "7: buscas ao mesmo tempo não passam do teto do dia: %r" % (sorted(x[0] for x in saida),))
# as recusas registradas têm teto por pessoa e por dia (um laço de pedidos não enche o banco)
rec_max, m.BUSCA_VEND_RECUSAS_DIA = m.BUSCA_VEND_RECUSAS_DIA, len(recusas())
nr = len(linhas())
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)
ok(st == 429 and len(linhas()) == nr, "7: acima do teto de recusas registradas, só responde 429: %s" % st)
m.BUSCA_VEND_RECUSAS_DIA = rec_max
m.BUSCA_VEND_POR_DIA = dia_max
# 2: retenção de 30 dias, limpa a cada busca
with m.ev_lock:
    db = m.vendas_db()
    for idv, dias in (("a" * 16, 45), ("b" * 16, 10)):
        d_ = m._ff_hoje(time.time() - dias * 86400)
        db.execute("insert into busca_vend (id, em, dia, por, posto, resultado, certeza, talvez, achadas) values (?, ?, ?, 'antiga-bv', 'Caixa 1', 'achou', 1, 0, '[]')", (idv, d_ + "T10:00:00", d_))
    db.commit()
    db.close()
m._janelas.clear()
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend2)
ids_ = {x[0] for x in linhas()}
ok(st == 200 and "a" * 16 not in ids_ and "b" * 16 in ids_ and m.BUSCA_VEND_RETENCAO == 30, "2: a tabela guarda 30 dias (a linha de 45 dias saiu, a de 10 ficou)")
# 5: quadro acima de 4 MP é recusado antes de decodificar; o que não é JPEG nem PNG não é lido
m._janelas.clear()
nd = len(DECODIFICADAS)
grande = ["data:image/png;base64," + base64.b64encode(png(b"so-a", 3000, 2000)).decode()]
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a") + grande}, cookie=vend2)
ok(st == 413 and r.get("erro") == "grande" and "sessoes" not in r and len(DECODIFICADAS) == nd and linhas()[-1][5] == "imagem_grande", "5: imagem acima de 4 MP: 413 sem decodificar nada: %s %r" % (st, r))
st, r = pede("POST", "/rostos/sessoes", {"imagens": ["data:image/jpeg;base64," + base64.b64encode(b"so-a").decode(), base64.b64encode(b"GIF89a" + b"so-a").decode()]}, cookie=vend2)
ok(st == 200 and r.get("rosto") is False and r.get("sessoes") == [] and len(DECODIFICADAS) == nd, "5: o que não é JPEG nem PNG não é decodificado: %s %r" % (st, r))
ok(m.BUSCA_VEND_PIXELS == 4000000, "teto de 4 MP por quadro")
m._janelas.clear()
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=sup)
ok(st == 200 and r.get("ok") is True, "6: Supervisora com vínculo de fotógrafo segue podendo (como na tela): %s" % st)
ok(dia_max == 150 and m.BUSCA_VEND_POR_MIN == 6, "limites: 6 por minuto e 150 por dia")

# ---------- corpo ----------
m._janelas.clear()
n0 = len(linhas())
for corpo in ({"imagens": img(b"so-a") * 4}, {"imagens": []}, {"imagens": "so-a"}, {"imagens": [7]}, {"imagens": [""]}, {}):
    st, r = pede("POST", "/rostos/sessoes", corpo, cookie=vend)
    ok(st == 400 and r.get("erro") == "invalido", "corpo recusado %r: %s %r" % (str(corpo)[:40], st, r))
st, r = pede("POST", "/rostos/sessoes", cookie=vend, cru=b'{"imagens":["' + b"A" * (6 * 1024 * 1024 + 10) + b'"]}')
ok(st == 413, "corpo acima de 6 MB: %s" % st)
st, r = pede("POST", "/rostos/sessoes", cookie=vend, cru=b"[1,2")
ok(st == 400, "corpo que não é JSON: %s" % st)
ok(len(linhas()) == n0, "corpo recusado não grava busca")

# ---------- 27: marcar ----------
m._janelas.clear()
mc = lambda corpo, ck=vend: pede("POST", "/rostos/sessoes/marcar", corpo, cookie=ck)
st, r = mc({"busca": BUSCA1, "cards": [S_CERTA, S_B]})
ok(st == 400 and r.get("erro") == "fora", "27: sessão fora das achadas é recusada: %s %r" % (st, r))
st, r = mc({"busca": BUSCA1, "cards": [S_CERTA, S_MENOR]})
ok(st == 400, "27: sessão de menor (nunca achada) é recusada: %s" % st)
st, r = mc({"busca": BUSCA1, "cards": [S_CERTA]}, vend2)
ok(st == 404 and r.get("erro") == "busca", "27: busca de outra pessoa é recusada, como se não existisse: %s %r" % (st, r))
st, r = mc({"busca": BUSCA2, "cards": [S_CERTA]})
ok(st == 404, "27: e o contrário também: %s" % st)
for corpo in ({"busca": "x", "cards": []}, {"busca": BUSCA1}, {"busca": BUSCA1, "cards": "LP"}, {"busca": BUSCA1, "cards": ["lp minúsculo"]}, {"busca": BUSCA1, "cards": [S_CERTA, S_CERTA]},
              {"busca": BUSCA1, "cards": [S_CERTA] * 21}, {"busca": None, "cards": []}, {"busca": BUSCA1.upper() + "'", "cards": []}):
    st, r = mc(corpo)
    ok(st == 400 and r.get("erro") == "invalido", "27: marcar com corpo ruim %r: %s %r" % (str(corpo)[:50], st, r))
st, r = mc({"busca": "f" * 16, "cards": []})
ok(st == 404, "27: busca que não existe: %s" % st)
ok([x for x in linhas() if x[0] == BUSCA1][0][9] is None, "27: recusa não grava marcação")
st, r = mc({"busca": BUSCA1, "cards": [S_CERTA, S_TACA], "por": "outra-pessoa", "marcada_em": "2000-01-01"})
l1 = [x for x in linhas() if x[0] == BUSCA1][0]
ok(st == 200 and r == {"ok": True} and json.loads(l1[9]) == [S_CERTA, S_TACA] and l1[10] and l1[10][:10] == HOJE and l1[3] == "vendedora-bv", "27: marcar grava as marcadas, com a hora do servidor: %s %r" % (st, l1[9:]))
st, r = mc({"busca": BUSCA1, "cards": [S_CERTA]})
ok(st == 409 and r.get("erro") == "ja_marcada" and json.loads([x for x in linhas() if x[0] == BUSCA1][0][9]) == [S_CERTA, S_TACA], "27: marcar vale uma vez: %s %r" % (st, r))
ok([x for x in linhas() if x[0] == BUSCA2][0][9] is None, "a busca da outra pessoa segue sem marcação")
st, r = mc({"busca": BUSCA2, "cards": []}, vend2)
ok(st == 200 and json.loads([x for x in linhas() if x[0] == BUSCA2][0][9]) == [], "marcar sem nenhuma das achadas (o vendedor desmarcou todas): %s" % st)
with m.ev_lock:
    db = m.vendas_db()
    db.execute("update busca_vend set dia = ? where id = ?", (ONTEM, BUSCA2))
    db.execute("update busca_vend set marcadas = null, marcada_em = null where id = ?", (BUSCA2,))
    db.commit()
    db.close()
st, r = mc({"busca": BUSCA2, "cards": []}, vend2)
ok(st == 404, "27: busca de outro dia não aceita marcação: %s" % st)

# ---------- GET /ponto/selfies inclui as buscas do vendedor ----------
st, r = pede("GET", "/ponto/selfies?dia=" + HOJE, cookie=adm)
vd = r.get("vendedor") or []
v1 = [x for x in vd if x.get("busca") == BUSCA1]
ok(st == 200 and r.get("ok") is True and isinstance(r.get("buscas"), list) and any(x.get("origem") == "vendedor" for x in r["buscas"]) and any(x.get("origem") == "checkout" for x in r["buscas"])
   and len(v1) == 1 and v1[0]["por"] == "vendedora-bv" and v1[0]["posto"] == "Caixa 7" and v1[0]["marcadas"] == [S_CERTA, S_TACA] and v1[0]["certeza"] == 2 and v1[0]["talvez"] == 3
   and {a[0] for a in v1[0]["achadas"]} == set(ss) and set(v1[0]) == {"busca", "em", "por", "posto", "resultado", "certeza", "talvez", "achadas", "marcadas", "marcada_em"},
   "/ponto/selfies traz as buscas do vendedor: %s %r" % (st, v1))
# 8: por pessoa, quantas buscas fez e quantas terminaram sem venda marcada
rs_ = {x["por"]: x for x in r.get("vendedor_resumo") or []}
eu_ = rs_.get("vendedora-bv") or {}
ok(set(eu_) == {"por", "buscas", "acharam", "sem_venda", "limite"} and eu_["buscas"] == len(buscas()) and eu_["sem_venda"] == eu_["buscas"] - 1 and eu_["limite"] == len(recusas()) >= 3
   and 0 < eu_["acharam"] <= eu_["buscas"] and "vendedor2-bv" in rs_ and rs_["vendedor2-bv"]["sem_venda"] == rs_["vendedor2-bv"]["buscas"]
   and [x["buscas"] for x in r["vendedor_resumo"]] == sorted((x["buscas"] for x in r["vendedor_resumo"]), reverse=True),
   "8: /ponto/selfies traz o resumo por pessoa (buscas, sem venda marcada, vezes no limite): %r" % (r.get("vendedor_resumo"),))
st, r = pede("GET", "/ponto/selfies?dia=" + HOJE, cookie=vend)
ok(st == 403, "/ponto/selfies segue só para quem tem galerias em Ver: %s" % st)

# ---------- chaves para desligar ----------
m._janelas.clear()
st, r = pede("GET", "/status", cookie=vend)
ok(st == 200 and (r.get("rostos") or {}).get("busca_vend") is True, "B1: o /status diz que a busca do vendedor está ligada: %r" % ((r.get("rostos") or {}).get("busca_vend"),))
n0 = len(linhas())
m.rostos["ligado"] = False
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)
ok(st == 503 and r.get("erro") == "desligado" and "sessoes" not in r, "reconhecimento desligado: 503: %s %r" % (st, r))
m.rostos["ligado"] = True
m.BUSCA_VEND_ON = False
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend)
st2, r2 = mc({"busca": BUSCA1, "cards": []})
ok(st == 404 and st2 == 404 and "sessoes" not in r, "B1: desligada (como nasce), as duas rotas respondem 404: %s %s" % (st, st2))
st, r = pede("GET", "/status", cookie=vend)
ok(st == 200 and (r.get("rostos") or {}).get("busca_vend") is False, "B1: desligada, o /status avisa a tela: %r" % ((r.get("rostos") or {}).get("busca_vend"),))
st, rb = pede("POST", "/rostos/buscar", {"imagens": img(b"so-a")}, cookie=vend)
ok(st == 200 and rb.get("rosto") is True and len(rb.get("fotos") or []) >= 5, "com a busca do vendedor desligada, a selfie do cliente segue: %s" % st)
m.BUSCA_VEND_ON = True
ok(len(linhas()) == n0, "rota desligada não grava busca")

# ---------- erro dentro da busca: registrado, sem lista ----------
m._janelas.clear()
orig = m.buscar_vetor
m.buscar_vetor = lambda *a, **k: 1 / 0
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend2)
m.buscar_vetor = orig
ok(st == 500 and r.get("erro") == "busca" and "sessoes" not in r and "ZeroDivision" not in json.dumps(r) and linhas()[-1][5] == "erro" and linhas()[-1][3] == "vendedor2-bv", "erro na busca: 500 sem detalhe, registrado: %s %r" % (st, r))
orig = m.busca_vend_grava
m.busca_vend_grava = lambda *a, **k: 1 / 0
st, r = pede("POST", "/rostos/sessoes", {"imagens": img(b"so-a")}, cookie=vend2)
m.busca_vend_grava = orig
ok(st == 500 and r.get("erro") == "registro" and "sessoes" not in r, "sem conseguir registrar, a busca não devolve nada: %s %r" % (st, r))

ok(all(o == "checkout" for o, _n in selfies_bi()), "até o fim, a tabela das selfies dos clientes só tem as do Checkout: %r" % (selfies_bi(),))
# ---------- 2: Zerar fase de teste leva a tabela das buscas ----------
import inspect
ok(len(linhas()) > 5 and '"buscas_vendedor"' in inspect.getsource(m) and "delete from busca_vend\")" in inspect.getsource(m._zp_vendas), "2: o Zerar fase de teste conta e apaga as buscas do vendedor")
try:
    m._zp_vendas({})
    ok(linhas() == [], "2: depois do Zerar fase de teste, a tabela das buscas fica vazia: %d" % len(linhas()))
except Exception as ex:
    ok(False, "2: _zp_vendas falhou: %r" % (ex,))
srv.shutdown()
if falhas:
    print("FALHA rostos_sessoes_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK rostos_sessoes_agente: acesso (pessoa com venda em Criar), certeza e pode_ser, só hoje e sem removida, menor, escola, base de IA ou foto na fila, "
      "rosto maior com aviso, resposta sem nota, limite por pessoa (minuto e dia, sem corrida), registro pelo servidor com 30 dias, resumo por pessoa, marcar uma vez e só do dono, "
      "nada de imagem no disco, imagem grande recusada, nasce desligada (404) e /rostos/buscar igual")
