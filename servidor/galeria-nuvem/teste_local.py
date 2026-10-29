"""Teste local do app.py da galeria na nuvem com AWS simulada (sem rede, sem custo)."""
import base64, json, os, sys, time, types
from datetime import datetime, timedelta, timezone
from botocore.exceptions import ClientError

sys.path.insert(0, sys.argv[1])
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
    def search_faces_by_image(s, CollectionId, Image, **k):
        if CollectionId not in s.col: raise s.exceptions.ResourceNotFoundException()
        quem = Image["Bytes"].decode()
        return {"FaceMatches": [{"Face": {"ExternalImageId": p}, "Similarity": 99} for p, r in s.col[CollectionId].items() if r == quem]}


class S3:
    def head_object(s, Bucket, Key): return {}
    def generate_presigned_url(s, *a, **k): return "https://x/" + k["Params"]["Key"]


T, R = Tabela(), Rek()
invocacoes = []
import boto3
boto3.resource = lambda *a, **k: types.SimpleNamespace(Table=lambda n: T)
boto3.client = lambda svc, **k: {"rekognition": R, "s3": S3(), "lambda": types.SimpleNamespace(invoke=lambda **k: invocacoes.append(k))}[svc]
import app

ctx = types.SimpleNamespace(get_remaining_time_in_millis=lambda: 29000)
seg = "segredo"
app.SEGREDO_PONTO_SHA256 = __import__("hashlib").sha256(seg.encode()).hexdigest()
tok = "A" * 22
exp = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
man = {"token": tok, "codigo": "ABCD-EFGH", "tipo": "sessao", "expira": exp, "precos": {},
       "fotos": [{"id": "a%05x" % i, "direito": "comprada" if i < 2 else "venda"} for i in range(40)]}


def chama(metodo, caminho, corpo=None, cab=None):
    ev = {"rawPath": caminho, "headers": cab or {}, "body": json.dumps(corpo) if corpo else None,
          "requestContext": {"http": {"method": metodo, "sourceIp": "1.2.3.4"}}}
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
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True})
ok(st == 200 and r["ok"] and R.indexadas == 40, "cliente certo liberado, nenhuma leitura nova")
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-z").decode(), "consentimento": True})
ok(st == 200 and r["motivo"] == "nao_encontrado" and r["restam"] == 4, "cliente errado com leitura completa: conta erro")

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
