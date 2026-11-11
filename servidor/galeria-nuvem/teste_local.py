"""Teste local do app.py da galeria na nuvem com AWS simulada (sem rede, sem custo)."""
import base64, json, os, sys, time, types
from datetime import datetime, timedelta, timezone
from botocore.exceptions import ClientError

sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.abspath(__file__)))
os.environ.update(TABELA="t", BUCKET="b", SEGREDO_PONTO_SHA256="ab" * 32, AWS_LAMBDA_FUNCTION_NAME="f",
                  LIMITE_LEITURAS_DIA="1000", LIMITE_BUSCAS_DIA="1000")


class Tabela:
    def __init__(s): s.d = {}
    def get_item(s, Key): it = s.d.get((Key["pk"], Key["sk"])); return {"Item": dict(it)} if it else {}
    def put_item(s, Item): s.d[(Item["pk"], Item["sk"])] = dict(Item)
    def delete_item(s, Key): s.d.pop((Key["pk"], Key["sk"]), None)
    def update_item(s, Key, UpdateExpression, ExpressionAttributeValues=None, ExpressionAttributeNames=None, ConditionExpression=None, ReturnValues=None):
        k = (Key["pk"], Key["sk"]); it = s.d.setdefault(k, dict(Key)); v = ExpressionAttributeValues or {}; n = ExpressionAttributeNames or {}
        if ConditionExpression and "lk" in it and not it["lk"] < v[":agora"]:
            raise ClientError({"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem")
        if UpdateExpression.startswith("REMOVE"):
            it.pop(UpdateExpression.split()[1], None); return {}
        if UpdateExpression.startswith("ADD"):
            it["n"] = it.get("n", 0) + 1; return {"Attributes": {"n": it["n"]}}
        for par in UpdateExpression[4:].split(","):
            a, b = [x.strip() for x in par.split("=")]
            it[n.get(a, a)] = v[b]
        return {}


class Rek:
    class exceptions:
        class ResourceAlreadyExistsException(Exception): pass
        class ResourceNotFoundException(Exception): pass
        class InvalidParameterException(Exception): pass
    def __init__(s): s.col = {}; s.indexadas = 0; s.lento = 0
    def create_collection(s, CollectionId):
        if CollectionId in s.col: raise s.exceptions.ResourceAlreadyExistsException()
        s.col[CollectionId] = {}
    def delete_collection(s, CollectionId):
        if CollectionId not in s.col: raise s.exceptions.ResourceNotFoundException()
        del s.col[CollectionId]
    def list_collections(s, **k): return {"CollectionIds": list(s.col)}
    def index_faces(s, CollectionId, Image, ExternalImageId, **k):
        s.indexadas += 1; time.sleep(s.lento)
        s.col[CollectionId][ExternalImageId] = "rosto-" + ExternalImageId[:1]
    def detect_faces(s, Image, **k):          # "duas..." = duas pessoas de rosto parecido; "fundo..." = uma e outra bem menor atrás
        b = Image["Bytes"]
        ws = [.3, .28] if b.startswith(b"duas") else [.3, .08] if b.startswith(b"fundo") else [.3]
        return {"FaceDetails": [{"BoundingBox": {"Width": w}} for w in ws]}
    def search_faces_by_image(s, CollectionId, Image, **k):     # "rosto-a@90" = semelhança 90 (padrão 99)
        if CollectionId not in s.col: raise s.exceptions.ResourceNotFoundException()
        quem, _, sim = Image["Bytes"].decode().partition("@")
        return {"FaceMatches": [{"Face": {"ExternalImageId": p}, "Similarity": float(sim or 99)} for p, r in s.col[CollectionId].items() if r == quem]}


class S3:
    heads = 0
    def head_object(s, Bucket, Key): S3.heads += 1; return {}
    def generate_presigned_url(s, *a, **k): return "https://x/" + k["Params"]["Key"]


T, R = Tabela(), Rek()
invocacoes = []
import boto3
boto3.resource = lambda *a, **k: types.SimpleNamespace(Table=lambda n: T)
boto3.client = lambda svc, **k: {"rekognition": R, "s3": S3(), "lambda": types.SimpleNamespace(invoke=lambda **k: invocacoes.append(k)), "sesv2": types.SimpleNamespace(send_email=lambda **k: None)}[svc]
import app

ctx = types.SimpleNamespace(get_remaining_time_in_millis=lambda: 29000)
seg = "segredo"
app.SEGREDO_PONTO_SHA256 = __import__("hashlib").sha256(seg.encode()).hexdigest()
tok = "A" * 22
exp = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
man = {"token": tok, "codigo": "ABCD-EFGH", "tipo": "sessao", "expira": exp, "precos": {},
       "fotos": [{"id": ("b" if i >= 38 else "a") + "%05x" % i, "direito": "comprada" if i < 2 else "venda"} for i in range(40)]}


def chama(metodo, caminho, corpo=None, cab=None, ip="1.2.3.4"):
    ev = {"rawPath": caminho, "headers": cab or {}, "body": json.dumps(corpo) if corpo else None,
          "requestContext": {"http": {"method": metodo, "sourceIp": ip}}}
    r = app.handler(ev, ctx)
    return r["statusCode"], json.loads(r["body"])


def ok(cond, txt):
    print(("OK   " if cond else "FALHA") + " " + txt)
    assert cond


st, _ = chama("POST", "/ponto/galerias", {"manifesto": man}, {"x-eterna-ponto": seg})
ok(st == 200 and R.indexadas == 0 and not R.col and not invocacoes, "publicar não lê rosto nenhum antes do consentimento")
st, _ = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-a").decode()})
ok(st == 400 and R.indexadas == 0, "selfie sem consentimento: recusada e nada lido")

# tempo curto: a leitura para no meio, grava o progresso e continua sem repetir
R.lento = 0.2
ctx.get_remaining_time_in_millis = lambda: 9500       # sobra ~0,5 s para ler
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-z").decode(), "consentimento": True})
lidas1 = R.indexadas
ok(st == 503 and r["motivo"] == "processando" and 0 < lidas1 < 40 and invocacoes, "leitura incompleta: 503 processando, não conta erro, continua em segundo plano (%d lidas)" % lidas1)
ok(app.falhas("1.2.3.4", tok)[0] == 5, "a tentativa não foi descontada")
ctx.get_remaining_time_in_millis = lambda: 29000
R.lento = 0
app.handler({"indexar": tok}, ctx)
ok(R.indexadas == 40, "segundo plano terminou sem reler nenhuma foto (total de leituras = 40)")
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"duas-pessoas").decode(), "consentimento": True})
ok(st == 200 and r["motivo"] == "varias_pessoas" and "restam" not in r, "duas pessoas na selfie: não busca e não conta tentativa")
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True})
ok(st == 200 and r["ok"] and R.indexadas == 40, "cliente certo liberado, nenhuma leitura nova")
ok(len(r["galeria"]["fotos"]) == 38 and not [f for f in r["galeria"]["fotos"] if f["pid"].startswith("b")], "a selfie libera só as fotos em que a pessoa aparece")
# v96.1: com a selfie que bateu, comprada (e cortesia) em que o rosto não bateu entra sempre; a à venda de outra pessoa continua fora
manc = dict(man, fotos=[dict(f) for f in man["fotos"]])
manc["fotos"][38]["direito"] = "comprada"               # b00026: comprada, outra pessoa (o pai com a bandeira); b00027 à venda, outra pessoa
chama("POST", "/ponto/galerias", {"manifesto": manc}, {"x-eterna-ponto": seg})
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True})
ps = {f["pid"]: f for f in r["galeria"]["fotos"]}
ok(st == 200 and len(ps) == 39 and ps["b00026"]["original"] and "b00027" not in ps, "comprada sem o rosto aparece e baixa; à venda de outra pessoa fora")
ace = r["acesso"]
manv = dict(manc, fotos=[dict(f) for f in manc["fotos"]])
manv["fotos"][39]["direito"] = "cortesia"               # cortesia dada no balcão depois da selfie
chama("POST", "/ponto/galerias", {"manifesto": manv}, {"x-eterna-ponto": seg})
st, r = chama("POST", "/g/%s/galeria" % tok, {"acesso": ace})
ok(st == 200 and (next((f for f in r["galeria"]["fotos"] if f["pid"] == "b00027"), {}).get("original")), "cortesia dada depois da selfie entra no mesmo acesso")
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-z").decode(), "consentimento": True})
ok(st == 200 and r["motivo"] == "nao_encontrado" and r["restam"] == 4, "cliente errado com leitura completa: conta erro, mesmo com comprada na venda")

# v96.1 (decisão do Eduardo, 10/11): o QR sozinho abre as compradas e cortesias da venda, sem selfie; nunca as à venda
st, r = chama("GET", "/g/%s/livres" % tok)
ps = sorted(f["pid"] for f in r["galeria"]["fotos"])
ok(st == 200 and ps == ["a00000", "a00001", "b00026", "b00027"] and all(f["original"] for f in r["galeria"]["fotos"]), "livres: só pelo QR, compradas e cortesia com original (%s)" % ps)
ev_l = [v for k, v in T.d.items() if k[0] == "EVT#" + tok and v["tipo"] == "livres_vistas"]
ok(ev_l and ev_l[-1]["livres"] == "4", "livres: evento livres_vistas com a contagem")
ev_ok = sorted((k[1], v) for k, v in T.d.items() if k[0] == "EVT#" + tok and v["tipo"] == "selfie_ok")
ok(ev_ok and "livres" in ev_ok[-1][1], "selfie_ok registra quantas compradas e cortesias abriram junto")
S3.heads = 0
app.galeria_obj(tok, manv, set())
ok(S3.heads == 8, "galeria_obj: um head_object por chave na chamada (%d para 4 fotos livres)" % S3.heads)
# grupo de escola: nada sem rosto
tokE = "E" * 22
chama("POST", "/ponto/galerias", {"manifesto": dict(manv, token=tokE, codigo=None, tipo="evento")}, {"x-eterna-ponto": seg})
st, r = chama("GET", "/g/%s/livres" % tokE)
ok(st == 200 and r["galeria"]["fotos"] == [], "livres: grupo de escola não abre nada sem rosto")

# v96.1: sessão de menor usa o limiar de criança (95): semelhança 90 abre a de adulto e não a de menor
tokA, tokM = "F" * 22, "G" * 22
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokA, codigo=None)}, {"x-eterna-ponto": seg})
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokM, codigo=None, menor=True)}, {"x-eterna-ponto": seg})
st, r = chama("POST", "/g/%s/rosto" % tokA, {"imagem": base64.b64encode(b"rosto-a@90").decode(), "consentimento": True}, ip="7.0.0.1")
ok(st == 200 and r.get("ok"), "adulto abre com semelhança 90")
st, r = chama("POST", "/g/%s/rosto" % tokM, {"imagem": base64.b64encode(b"rosto-a@90").decode(), "consentimento": True}, ip="7.0.0.2")
ok(st == 200 and r.get("motivo") == "nao_encontrado", "sessão de menor exige o limiar de criança (90 < 95)")

# v96.1: teto da galeria de venda: 20 selfies sem acerto no dia, somando IPs; a 21ª (de outro IP) dá 429 até amanhã, com alerta
tokT = "H" * 22
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokT, codigo=None)}, {"x-eterna-ponto": seg})
res = [chama("POST", "/g/%s/rosto" % tokT, {"imagem": base64.b64encode(b"rosto-z").decode(), "consentimento": True}, ip="9.0.0.%d" % (i + 1)) for i in range(20)]
ok(all(s_ == 200 and r_["motivo"] == "nao_encontrado" for s_, r_ in res), "teto: as 20 primeiras sem acerto dão nao_encontrado")
st, r = chama("POST", "/g/%s/rosto" % tokT, {"imagem": base64.b64encode(b"rosto-z").decode(), "consentimento": True}, ip="9.0.1.1")
ok(st == 429 and r["motivo"] == "bloqueado" and r.get("teto") is True and app.epoch(r["ate"]) == app._amanha_venue(), "teto: a 21ª de outro IP dá 429 até o início de amanhã")
st, r = chama("POST", "/g/%s/rosto" % tokT, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True}, ip="9.0.1.2")
ok(st == 429, "teto: parada também para quem bate")
ok(len([v for k, v in T.d.items() if k[0] == "EVT#" + tokT and v["tipo"] == "galeria_teto_selfie"]) == 1, "teto: um evento de alerta")
ok(chama("GET", "/g/%s/livres" % tokT)[0] == 200, "teto: as compradas continuam pelo QR")
st, r = chama("POST", "/g/%s/rosto" % tokA, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True}, ip="9.0.1.3")
ok(st == 200 and r.get("ok"), "teto: outra galeria não é afetada")
for t_ in (tokA, tokM, tokT):                          # tira do ar as galerias deste bloco (coleções apagadas)
    chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=t_, codigo=None, encerrada=True)}, {"x-eterna-ponto": seg})

# encerrar no ponto: some da nuvem e os rostos são apagados
man2 = dict(man, encerrada=True, expira=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
st, r = chama("POST", "/ponto/galerias", {"manifesto": man2}, {"x-eterna-ponto": seg})
ok(st == 200 and r["estado"] == "encerrada" and not R.col, "encerrada: coleção de rostos apagada")
ok(chama("GET", "/g/%s/info" % tok)[0] == 410 and chama("GET", "/g/codigo/ABCD-EFGH")[0] == 404, "encerrada: QR 410 e código curto 404")
st, r = chama("POST", "/ponto/galerias", {"manifesto": man}, {"x-eterna-ponto": seg})
ok(chama("GET", "/g/%s/info" % tok)[0] == 410, "republicar não reabre a galeria encerrada")

# limpeza diária: coleção sem registro (órfã) e de galeria vencida
R.col["et-maracana-orfa0000000000"] = {}
R.col["outro-sistema"] = {}
print("limpeza:", app.handler({"limpeza": True}, ctx))
ok(list(R.col) == ["outro-sistema"], "limpeza apagou a órfã e não tocou em coleção de outro sistema")

# teto diário de leituras
app.LIMITE_LEITURAS_DIA = R.indexadas  # já gastou o dia
tok3 = "B" * 22
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tok3, codigo=None)}, {"x-eterna-ponto": seg})
antes = R.indexadas
st, r = chama("POST", "/g/%s/rosto" % tok3, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True})
ok(st == 503 and R.indexadas == antes, "teto do dia atingido: nenhuma leitura paga a mais, cliente vê 'processando'")
print("\ntudo certo")
