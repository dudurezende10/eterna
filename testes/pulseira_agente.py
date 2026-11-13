# v99.25: pulseira numerada por vídeo e vídeo na nuvem logo depois de ligar o cartão.
# A venda do tablet traz uma pulseira por vídeo; a busca pelo número acha a venda; número repetido em outra compra fica com
# conflito (a venda não é recusada); o voo fica na pulseira; ligar o vídeo com a pulseira confere que ela é da venda e ainda
# não tem vídeo. O rascunho começa a subir para a nuvem assim que chega (video/r-<id>.mp4) e, ao ligar, a nuvem copia por
# dentro para video/<qr>.mp4 (sem subir de novo), mesmo se o cartão for lido no meio da subida.
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/pulseira_agente.py agente/eterna-agente.py
import http.client, importlib.util, json, os, sqlite3, struct, sys, threading, time, types
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# ---- S3 de mentira: guarda o tamanho de cada chave; a subida pode ficar presa (arquivo aberto) até soltar ----
OBJ, LOG = {}, []
solta = threading.Event()
solta.set()


class S3:
    def upload_file(self, arq, bucket, chave, ExtraArgs=None, Config=None, Callback=None):
        with open(arq, "rb") as f:            # aberto durante a subida, como o boto3
            dados = f.read()
            Callback(len(dados) // 2)
            solta.wait(20)
            Callback(len(dados) - len(dados) // 2)
        OBJ[chave] = len(dados)
        LOG.append(("sobe", chave))

    def head_object(self, Bucket, Key):
        return {"ContentLength": OBJ[Key]}

    def copy_object(self, Bucket, Key, CopySource, **k):
        OBJ[Key] = OBJ[CopySource["Key"]]
        LOG.append(("copia", CopySource["Key"], Key))

    def delete_object(self, Bucket, Key):
        OBJ.pop(Key, None)
        LOG.append(("apaga", Key))


b3 = types.ModuleType("boto3")
b3.session = types.SimpleNamespace(Session=lambda **k: types.SimpleNamespace(client=lambda *a, **kw: S3()))
tr = types.ModuleType("boto3.s3.transfer")
tr.TransferConfig = lambda **k: None
bc = types.ModuleType("botocore.config")
bc.Config = lambda **k: None
sys.modules.update({"boto3": b3, "boto3.s3": types.ModuleType("boto3.s3"), "boto3.s3.transfer": tr, "botocore": types.ModuleType("botocore"),
                    "botocore.config": bc})
m.NUVEM, m.NUVEM_BUCKET = "s3", "balde-teste"

srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
m.PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = "127.0.0.1:%d" % m.PORT


def req(met, rota, cookie, corpo=None, bruto=None, tipo="application/json"):
    c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
    h = {"Host": HOST, "Cookie": cookie, "Origin": "http://" + HOST, "X-Eterna": "1"}
    b = bruto
    if corpo is not None:
        b = json.dumps(corpo).encode()
    if b is not None:
        h["Content-Type"] = tipo
    c.request(met, rota, b, h)
    r = c.getresponse()
    try:
        j = json.loads(r.read() or b"{}")
    except ValueError:
        j = {}
    c.close()
    return r.status, j


def caixa(tipo, corpo):
    return struct.pack(">I", 8 + len(corpo)) + tipo + corpo


def mp4(segundos, tam=5000):
    mvhd = b"\x00\x00\x00\x00" + b"\x00" * 8 + struct.pack(">II", 1000, int(segundos * 1000)) + b"\x00" * 80
    return caixa(b"ftyp", b"isom\x00\x00\x02\x00isomiso2") + caixa(b"moov", caixa(b"mvhd", mvhd)) + caixa(b"mdat", b"\x00" * tam)


def espera(cond, s=8):
    fim = time.time() + s
    while time.time() < fim:
        if cond():
            return True
        time.sleep(0.05)
    return False


HOJE = time.strftime("%Y-%m-%d")
QR1, QR2, QR3, QR4 = "P" * 21 + "1", "Q" * 21 + "2", "R" * 21 + "3", "S" * 21 + "4"
RW = {"c": True, "r": True, "u": True, "d": True}


def venda(vid, tipo, videos, pulseiras):
    return {"id": vid, "tipo": tipo, "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 180, "sugerido": 180,
            "itens": [{"cat": tipo, "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 2, "videos": videos}],
            "pais": "Chile", "idioma": "Espanhol", "vendedor": "Vendedora Teste", "usuario": "vendedora-ativ", "pulseiras": pulseiras}


try:
    threading.Thread(target=m.nuvem_videos_loop, daemon=True).start()
    ven = S.cookie_sessao(m, "vendedora-ativ", {"ativvenda": {"c": True, "r": True, "u": False, "d": False}})
    eq = S.cookie_sessao(m, "campo-ativ", {"ativentrega": RW})
    fora = S.cookie_sessao(m, "fotografo", {"catalogo": RW})
    for t, n in (("piloto", "Piloto Um"), ("piloto", "Piloto Dois"), ("drone", "007"), ("drone", "008"), ("bateria", "3")):
        req("POST", "/ativ/cadastros", eq, {"tipo": t, "nome": n})

    # venda: drone com 2 vídeos e 2 pulseiras; chute da mesma compra com a pulseira 0042 (= 42); outra compra repete a 777
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [venda("TPULABC01D", "drone", 2, ["00123", "777"]), venda("TPULABC01C", "chute", 1, ["42"]),
                                                        venda("TOUTRA001D", "drone", 1, ["777"])]})
    ok(st == 200 and len(j.get("recebidas", [])) == 3, "vendas com pulseira gravadas (repetida não recusa a venda): %s %s" % (st, j))
    st, j = req("POST", "/ativ/venda", ven, {"vendas": [venda("TPULRUIM1D", "drone", 1, ["12a"]), venda("TPULRUIM2D", "drone", 2, ["5", "05"])]})
    ok(len(j.get("recusadas", [])) == 2, "pulseira que não é número, ou repetida na mesma venda, recusada: %s" % j)

    # busca pelo número
    st, j = req("GET", "/ativ/pulseira?n=0123", eq)
    ok(st == 200 and j.get("numero") == "123" and [(x["venda"], x["slot"], x["conflito"]) for x in j["vendas"]] == [("TPULABC01D", 1, False)],
       "pulseira 0123 acha a venda e o vídeo 1: %s %s" % (st, j))
    st, j = req("GET", "/ativ/pulseira?n=777", eq)
    ok({x["venda"] for x in j.get("vendas", [])} == {"TPULABC01D", "TOUTRA001D"} and all(x["conflito"] for x in j["vendas"]),
       "número usado em duas compras: as duas com conflito: %s" % j)
    st, j = req("GET", "/ativ/pulseira?n=x", eq)
    ok(st == 400, "busca com número inválido: %s" % st)
    st, j = req("GET", "/ativ/pulseira?n=42", ven)
    ok(st == 200 and j["vendas"][0]["venda"] == "TPULABC01C", "o vendedor confere a pulseira antes de vender: %s %s" % (st, j))
    st, j = req("GET", "/ativ/pulseira?n=42", fora)
    ok(st == 403, "sem venda nem entrega, não consulta: %s" % st)

    # voo na pulseira (dois drones na mesma compra)
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TPULABC01D", "etapa": "voo", "piloto": "Piloto Um", "drone": "007", "bateria": "3", "pulseira": "123"})
    ok(st == 200, "voo da pulseira 123: %s %s" % (st, j))
    st, j = req("POST", "/ativ/etapa", eq, {"id": "TPULABC01D", "etapa": "voo", "piloto": "Piloto Dois", "drone": "008", "bateria": "3", "pulseira": "777"})
    st2, j2 = req("POST", "/ativ/etapa", eq, {"id": "TPULABC01D", "etapa": "voo", "piloto": "Piloto Um", "drone": "007", "bateria": "3", "pulseira": "42"})
    ok(st == 200 and st2 == 409 and j2.get("error") == "pulseira", "pulseira de outra venda recusada no voo: %s %s" % (st2, j2))
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    f = {v["id"]: v for v in j.get("vendas", [])}
    p = {x["numero"]: x for x in f.get("TPULABC01D", {}).get("pulseiras", [])}
    ok(p.get("123", {}).get("piloto") == "Piloto Um" and p.get("777", {}).get("drone") == "008" and p["123"]["slot"] == 1 and p["777"]["conflito"] is True,
       "fila com as pulseiras e o voo de cada uma: %s" % p)

    # vídeo 1: sobe inteiro antes de ler o cartão; ao ligar, a nuvem só copia
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(30), tipo="video/mp4")
    r1 = j.get("rascunho")
    ok(st == 200 and espera(lambda: OBJ.get("video/r-%s.mp4" % r1)), "o rascunho já sobe para a nuvem: %s %s" % (st, LOG))
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    ok((j.get("rascunhos") or {}).get(r1, {}).get("feito") is True, "a fila mostra o rascunho já na nuvem: %s" % j.get("rascunhos"))
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": r1, "venda": "TPULABC01D", "qr": QR1, "pulseira": "42"})
    ok(st == 409 and j.get("error") == "pulseira", "pulseira de outra venda não liga: %s %s" % (st, j))
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": r1, "venda": "TPULABC01D", "qr": QR1, "pulseira": "0123"})
    ok(st == 200 and j.get("n") == 1, "vídeo ligado com a pulseira: %s %s" % (st, j))
    ok(espera(lambda: OBJ.get("video/%s.mp4" % QR1) and "video/r-%s.mp4" % r1 not in OBJ), "copiado para o QR e o rascunho apagado: %s" % LOG)
    ok(sum(1 for x in LOG if x[0] == "sobe") == 1, "subiu uma vez só: %s" % LOG)
    c = m.vendas_db()
    ok(espera(lambda: m.vendas_db().execute("select nuvem_em from ativ_entrega where qr=?", (QR1,)).fetchone()[0]), "entrega marcada na nuvem")
    ok(c.execute("select pulseira, arquivo from ativ_entrega where qr=?", (QR1,)).fetchone() == ("123", os.path.join(m.ATIV_VIDEOS_DIR, QR1 + ".mp4")),
       "entrega com a pulseira e o arquivo com o nome do QR")
    c.close()
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(30), tipo="video/mp4")
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": j.get("rascunho"), "venda": "TPULABC01D", "qr": QR3, "pulseira": "123"})
    ok(st == 409 and j.get("error") == "pulseira_usada", "a mesma pulseira não recebe dois vídeos: %s %s" % (st, j))

    # vídeo 2: o cartão é lido no meio da subida (arquivo ainda aberto); a cópia acontece quando a subida termina
    solta.clear()
    LOG.clear()
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(30, 9000), tipo="video/mp4")
    r2 = j.get("rascunho")
    ok(espera(lambda: ("r-" + r2) in m.ativ_video_em_curso), "subida do rascunho 2 em andamento")
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": r2, "venda": "TPULABC01D", "qr": QR2, "pulseira": "777"})
    ok(st == 200 and j.get("n") == 2, "ligado durante a subida: %s %s" % (st, j))
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    e2 = [e for e in {v["id"]: v for v in j["vendas"]}["TPULABC01D"]["entregas"] if e["qr"] == QR2]
    ok(e2 and e2[0]["subindo"] and e2[0]["subindo"]["total"] > 0 and e2[0]["nuvem"] is False, "a entrega mostra o progresso da subida: %s" % e2)
    # v99.30.6: outro vídeo entregue enquanto o 2 sobe: o rascunho dele ainda espera na fila e muda de nome na entrega
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(20, 7000), tipo="video/mp4")
    r4 = j.get("rascunho")
    st, j = req("POST", "/ativ/video/liga", eq, {"rascunho": r4, "venda": "TPULABC01C", "qr": QR4, "pulseira": "42"})
    ok(st == 200 and not os.path.exists(m.ativ_rascunho(r4)), "vídeo 4 ligado com o rascunho ainda na fila: %s %s" % (st, j))
    solta.set()
    ok(espera(lambda: OBJ.get("video/%s.mp4" % QR4)), "o vídeo 4 sobe com o nome novo do arquivo: %s %s" % (LOG, m.nuvem.get("videos_erro")))
    ok(espera(lambda: OBJ.get("video/%s.mp4" % QR2)), "depois da subida, copiado para o QR: %s" % LOG)
    ok(espera(lambda: os.path.exists(os.path.join(m.ATIV_VIDEOS_DIR, QR2 + ".mp4"))
              and m.vendas_db().execute("select arquivo, nuvem_em is not null from ativ_entrega where qr=?", (QR2,)).fetchone()
              == (os.path.join(m.ATIV_VIDEOS_DIR, QR2 + ".mp4"), 1)), "arquivo local com o nome do QR e entrega na nuvem")
    st, j = req("GET", "/ativ/fila?dia=" + HOJE, eq)
    p = {x["numero"]: x for x in {v["id"]: v for v in j["vendas"]}["TPULABC01D"]["pulseiras"]}
    ok(p["123"]["qr"] == QR1 and p["777"]["qr"] == QR2, "cada pulseira com o seu cartão: %s" % p)

    # rascunho abandonado: sai do servidor e da nuvem depois de um dia
    st, j = req("POST", "/ativ/video", eq, bruto=mp4(10), tipo="video/mp4")
    r3 = j.get("rascunho")
    ok(espera(lambda: OBJ.get("video/r-%s.mp4" % r3)), "rascunho 3 na nuvem")
    m.ativ_videos_limpa(time.time() + 2 * 86400)
    ok(not os.path.exists(m.ativ_rascunho(r3)) and espera(lambda: "video/r-%s.mp4" % r3 not in OBJ), "rascunho abandonado apagado aqui e na nuvem: %s" % LOG)
    ok(os.path.exists(os.path.join(m.ATIV_VIDEOS_DIR, QR2 + ".mp4")), "vídeo entregue fica")
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK pulseira_agente: pulseira por vídeo, busca, conflito, voo por pulseira, vídeo subindo já no rascunho e cópia na nuvem ao ligar")
