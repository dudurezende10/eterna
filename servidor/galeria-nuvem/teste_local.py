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
        if ConditionExpression == "estado <> :p" and it.get("estado") == v[":p"]:
            raise ClientError({"Error": {"Code": "ConditionalCheckFailedException"}}, "UpdateItem")
        if UpdateExpression.startswith("REMOVE"):
            it.pop(UpdateExpression.split()[1], None); return {}
        if UpdateExpression.startswith("ADD"):
            it["n"] = it.get("n", 0) + 1; return {"Attributes": {"n": it["n"]}}
        for par in UpdateExpression[4:].split(","):
            a, b = [x.strip() for x in par.split("=")]
            it[n.get(a, a)] = v[b]
        return {}
    def query(s, KeyConditionExpression, Limit=None, **k):
        def casa(c, it):
            e = c.get_expression(); op, vs = e["operator"], e["values"]
            if op == "AND": return casa(vs[0], it) and casa(vs[1], it)
            a = it[0] if vs[0].name == "pk" else it[1]
            return a == vs[1] if op == "=" else a > vs[1]
        its = sorted((k_, v) for k_, v in s.d.items() if casa(KeyConditionExpression, k_))
        return {"Items": [dict(v) for k_, v in its][:Limit]}


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
    faltam = set()                            # chaves que ainda não estão no bucket
    def head_object(s, Bucket, Key):
        S3.heads += 1
        if Key in S3.faltam: raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return {}
    def generate_presigned_url(s, *a, **k):
        p = k["Params"]; return "https://x/" + p["Key"] + ("?dl=" + p["ResponseContentDisposition"] if "ResponseContentDisposition" in p else "") + "&ttl=%d" % k["ExpiresIn"]


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


def chama(metodo, caminho, corpo=None, cab=None, ip="1.2.3.4", q=None):
    ev = {"rawPath": caminho, "headers": cab or {}, "body": json.dumps(corpo) if corpo else None,
          "requestContext": {"http": {"method": metodo, "sourceIp": ip}}, "queryStringParameters": q}
    r = app.handler(ev, ctx)
    if r["statusCode"] == 302:
        return 302, r["headers"]
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

# foto que saiu do manifesto: os rostos lidos da galeria saem e a coleção se refaz na próxima selfie com consentimento
col_tok, lidas0 = app.colecao(tok), R.indexadas
chama("POST", "/ponto/galerias", {"manifesto": manv}, {"x-eterna-ponto": seg})
ok(col_tok in R.col and ("IDX#" + tok, "M") in T.d, "republicar com as mesmas fotos não mexe nos rostos lidos")
manp = dict(manv, fotos=[dict(f) for i, f in enumerate(manv["fotos"]) if i != 5])        # a00005 saiu
st, _ = chama("POST", "/ponto/galerias", {"manifesto": manp}, {"x-eterna-ponto": seg})
ok(st == 200 and col_tok not in R.col and ("IDX#" + tok, "M") not in T.d and ("COL#" + col_tok, "M") not in T.d, "foto fora do manifesto: coleção de rostos e progresso da leitura apagados")
ok(chama("GET", "/g/%s/info" % tok)[0] == 200 and chama("GET", "/g/codigo/ABCD-EFGH")[0] == 200, "a galeria continua no ar, com o código curto")
st, r = chama("POST", "/g/%s/rosto" % tok, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True}, ip="9.0.2.1")
ok(st == 200 and r.get("ok") and R.indexadas == lidas0 + 39 and "a00005" not in R.col[col_tok] and "a00005" not in [f["pid"] for f in r["galeria"]["fotos"]],
   "a selfie seguinte relê só as 39 fotos que ficaram (%d leituras novas)" % (R.indexadas - lidas0))
chama("POST", "/ponto/galerias", {"manifesto": manv}, {"x-eterna-ponto": seg})          # foto a mais não apaga nada
ok(col_tok in R.col, "republicar com foto a mais não apaga os rostos lidos")

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

# v99: compra online pela Imply (Imply simulada: setPessoa, consulta)
import imply, urllib.parse
ok(imply.cpf_ok("529.982.247-25") and not imply.cpf_ok("111.111.111-11") and not imply.cpf_ok("529.982.247-24"), "CPF: dígitos verificadores")
SKU = {"zona": "bd52ae84" + "0" * 32, "extra": "5ef192a2" + "0" * 32, "mais": "0ef59f3f" + "0" * 32}
cat = [{"id": "zona", "sku": SKU["zona"], "nome": "PACOTE ZONA MISTA", "preco": 110, "digital": 3, "kind": "pacote"},
       {"id": "extra", "sku": SKU["extra"], "nome": "1 foto (adicional) digital ou impressa", "preco": 35, "digital": 1, "kind": "adicional"},
       {"id": "mais", "sku": SKU["mais"], "nome": "Todas as fotos digitais", "preco": 250, "digital": "todas", "kind": "pacote"},
       {"id": "ruim", "sku": "x", "preco": 1, "digital": 1}]
tokP = "P" * 22
LIMITE = app.LIMITE_BUSCAS_DIA
app.LIMITE_LEITURAS_DIA = app.LIMITE_BUSCAS_DIA = 10 ** 6
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokP, codigo="PPPP-PPPP", catalogo=cat)}, {"x-eterna-ponto": seg})
ok([c["id"] for c in app.manifesto(tokP)["catalogo"]] == ["zona", "extra", "mais"], "catálogo online publicado, item sem SKU válido fora")
ok(chama("GET", "/g/%s/info" % tokP)[1]["compra"] is False, "sem COMPRA_ONLINE e sem chave da Imply: compra desligada")
app.COMPRA_ONLINE = True
imply.CHAVE_SSM, imply.TIPO_PESSOA = "/eterna/imply-chave", "99"
imply._chave["v"] = "chave-de-teste"
pessoas, respostas = [], {}
imply.set_pessoa = lambda *a, **k: pessoas.append((a, k)) or "tk-pessoa"
imply.situacao = lambda ref: respostas.get(ref, ("pendente", {"bruto": "aguardando"}))
st, r = chama("POST", "/g/%s/rosto" % tokP, {"imagem": base64.b64encode(b"rosto-a").decode(), "consentimento": True}, ip="5.0.0.1")
aceP = r["acesso"]
ok(r["galeria"]["compra"] and [c["id"] for c in r["galeria"]["catalogo"]] == ["zona", "extra", "mais"], "galeria manda o catálogo online e compra ligada")
venda = [f["pid"] for f in r["galeria"]["fotos"] if f["direito"] == "venda"]
cli = {"nome": "Cliente Teste", "email": "cliente@exemplo.com", "cpf": "529.982.247-25"}
ped = lambda corpo, ip="5.0.0.1": chama("POST", "/g/%s/pedido" % tokP, dict({"acesso": aceP}, **corpo), ip=ip)
ok(ped({"pids": venda[:4], "itens": [{"id": "zona", "qtd": 1}], "cliente": cli})[0] == 400, "carrinho que não cobre as fotos: recusado")
ok(ped({"pids": venda[:1], "itens": [{"id": "extra", "qtd": 1}], "cliente": cli})[0] == 400, "adicional sem pacote: recusado")
ok(ped({"pids": venda[:1], "itens": [{"id": "zona", "qtd": 1}], "cliente": dict(cli, cpf="111.111.111-11")})[1].get("campo") == "documento", "CPF inválido: recusado")
ok(ped({"pids": ["zz0000"], "itens": [{"id": "zona", "qtd": 1}], "cliente": cli})[0] == 400, "foto fora do acesso: recusada")
st, r = ped({"pids": venda[:4], "itens": [{"id": "zona", "qtd": 1}, {"id": "extra", "qtd": 1}], "cliente": cli, "marketing": True, "idioma": "pt"})
ok(st == 200 and r["ok"] and r["total"] == 145 and __import__("re").match(r"^ON-[A-Z0-9]{10}$", r["ref"]), "pedido criado: 4 fotos = Zona Mista + 1 adicional = 145")
ref = r["ref"]
q = urllib.parse.parse_qs(urllib.parse.urlparse(r["url"]).query)
destino = base64.b64decode(q["url"][0]).decode()
dq = urllib.parse.parse_qs(urllib.parse.urlparse(destino).query)
carr = json.loads(base64.b64decode(dq["predefined-cart"][0]))
ok(r["url"].startswith("https://maracanatouradmin.eleventickets.com/OAuth2/external?") and q["token"] == ["tk-pessoa"] and destino.startswith("https://maracanatour.eleventickets.com/pt/checkout?"),
   "endereço: login automático da Imply que cai no checkout")
ok(carr == {"referencia": ref, "itens": [{"idproduto": SKU["zona"], "quantidade": 1}, {"idproduto": SKU["extra"], "quantidade": 1}]} and dq["urlreturn"] == ["https://eterna.photo/g/"],
   "predefined-cart com SKU, quantidade e o nosso código; volta para eterna.photo/g/")
(pa, pk_) = pessoas[-1]
ok(pa[0].startswith("EP-") and pa[1:3] == ("Cliente Teste", "cliente@exemplo.com") and pk_["cpf"] == "52998224725", "setPessoa com de_para, nome, e-mail e CPF")
ok("cpf" not in json.dumps(T.d[("PED#" + ref, "M")]).lower() and "52998224725" not in json.dumps({k[0]: v for k, v in T.d.items()}), "CPF não fica guardado na Nuvem")
lead_ = next(v for k, v in T.d.items() if k[0].startswith("LEAD#"))
ok(lead_["email"] == "cliente@exemplo.com" and lead_["marketing"] is True and ref in lead_["pedidos"], "lead gravado com consentimento de marketing")
st, r = chama("GET", "/g/pedido/" + ref)
ok(st == 200 and r["estado"] == "aguardando" and r["token"] == tokP and app.manifesto(tokP)["fotos"][5]["direito"] == "venda", "volta sem pagamento: nada liberado")
ok(chama("GET", "/g/pedido/ON-ZZZZZZZZZZ")[0] == 404, "código de pedido inexistente: 404")
respostas[ref] = ("pago", {"valor": "145.00", "idpedido": "998877", "meio": "pix", "bruto": "pago"})
st, r = chama("GET", "/g/pedido/" + ref)
compradas = {f["id"] for f in app.manifesto(tokP)["fotos"] if f["direito"] == "comprada" and f.get("canal") == "online"}
ok(st == 200 and r["estado"] == "pago" and set(venda[:4]) <= compradas, "pago na Imply: as 4 fotos viram compradas (online)")
st, r = chama("GET", "/g/pedido/" + ref)
vs = [v for k, v in T.d.items() if k[0] == "VONL"]
ok(len(vs) == 1 and vs[0]["pago"] == "145.0" and vs[0]["idpedido"] == "998877", "conferir de novo não duplica a venda")
st, r = chama("GET", "/ponto/vendas-online", cab={"x-eterna-ponto": seg})
ok(st == 200 and len(r["vendas"]) == 1 and r["vendas"][0]["id"] == ref and r["vendas"][0]["n"] == 4 and r["vendas"][0]["metodo"] == "imply", "agente busca a venda online")
ev_v = {"rawPath": "/ponto/vendas-online", "headers": {"x-eterna-ponto": seg}, "queryStringParameters": {"desde": r["next"]}, "requestContext": {"http": {"method": "GET", "sourceIp": "1.1.1.1"}}}
ok(json.loads(app.handler(ev_v, ctx)["body"])["vendas"] == [], "com o 'desde', nada repetido")
ok(chama("GET", "/ponto/vendas-online")[0] == 401, "vendas online sem o segredo do ponto: 401")
# todas as fotos digitais: o pedido leva todas as à venda que o cliente vê; republicar no ponto não desfaz a compra
st, r = ped({"pids": venda[4:5], "itens": [{"id": "mais", "qtd": 1}], "cliente": dict(cli, cpf="", passaporte="ab 12345")})
ref2 = r["ref"]
ok(st == 200 and r["total"] == 250 and r["fotos"] == len(venda) - 4 and "passaporte" in pessoas[-1][1] and pessoas[-1][1]["passaporte"] == "AB12345", "Todas as fotos digitais com passaporte")
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokP, codigo="PPPP-PPPP", catalogo=cat)}, {"x-eterna-ponto": seg})
ok(set(venda[:4]) <= {f["id"] for f in app.manifesto(tokP)["fotos"] if f["direito"] == "comprada"}, "republicar do ponto não desfaz a compra online")
# conferência agendada: pendente que pagou depois sem voltar; pendente de mais de 24 h expira
respostas[ref2] = ("pago", {"valor": 250, "bruto": "aprovado"})
print("conferir:", app.handler({"conferir": True}, ctx))
ok(T.d[("PED#" + ref2, "M")]["estado"] == "pago" and not [k for k in T.d if k[0] == "PEDPEND"], "agendada: libera o pedido pago sem a volta do cliente")
st, r = ped({"pids": venda[:1], "itens": [{"id": "zona", "qtd": 1}], "cliente": cli}, ip="5.0.0.9")
ok(st == 400, "foto já comprada não entra em pedido novo")
app.LIMITE_BUSCAS_DIA = LIMITE

# ---------- vídeo das ativações (v99.20): o cartão é a chave, aceite + e-mail, sem selfie; abriu, play e baixou com data e hora ----------
tokV = "V" * 22
manV = {"token": tokV, "codigo": "VVVV-WWWW", "tipo": "video", "servico": "drone", "idioma": "Espanhol", "expira": exp, "fotos": [],
        "videos": [{"id": tokV, "chave": "video/%s.mp4" % tokV, "bytes": 1000, "duracao": 30.0, "n": 1}]}
ok(chama("POST", "/ponto/galerias", {"manifesto": dict(manV, videos=[{"id": tokV, "chave": "video/outro.mp4"}])}, {"x-eterna-ponto": seg})[0] == 400,
   "vídeo: chave fora de video/<qr>.mp4 recusada")
S3.faltam.add("video/%s.mp4" % tokV)
st, r = chama("POST", "/ponto/galerias", {"manifesto": manV}, {"x-eterna-ponto": seg})
ok(st == 200 and r["estado"] == "chegando", "vídeo: publicado antes do arquivo chegar = chegando")
ok(chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokV)}, {"x-eterna-ponto": seg})[0] == 409, "vídeo: cartão do vídeo não vira galeria de fotos")
ok(chama("POST", "/ponto/galerias", {"manifesto": dict(manV, token=tok)}, {"x-eterna-ponto": seg})[0] == 409, "vídeo: cartão de fotos não vira galeria de vídeo")
st, r = chama("GET", "/g/%s/info" % tokV)
ok(st == 200 and r["tipo"] == "video" and r["estado"] == "chegando" and r["servico"] == "drone" and r["compra"] is False, "vídeo: info com o serviço, chegando")
ok(chama("GET", "/g/codigo/VVVV-WWWW")[1].get("token") == tokV, "vídeo: código curto do cartão")
ok(chama("POST", "/g/%s/rosto" % tokV, {"consentimento": True, "imagem": "x"})[0] == 404, "vídeo: sem selfie")
ok(chama("POST", "/g/%s/video" % tokV, {"email": "a@b.com"})[0] == 400, "vídeo: sem o aceite, recusado")
st, r = chama("POST", "/g/%s/video" % tokV, {"consentimento": True, "email": "nao-e-email"})
ok(st == 400 and r.get("campo") == "email", "vídeo: e-mail obrigatório e válido")
st, r = chama("POST", "/g/%s/video" % tokV, {"consentimento": True, "email": "Cliente@Exemplo.com", "idioma": "es", "versao": "v1", "marketing": False})
acV = r.get("acesso")
ok(st == 200 and acV and r["galeria"]["estado"] == "chegando" and r["galeria"]["videos"][0]["url"] is None, "vídeo: aceite dá acesso; o vídeo ainda está chegando")
ok([v for k, v in T.d.items() if k[0] == "CON#" + tokV][0]["tipo"] == "video", "vídeo: aceite registrado")
leadV = [v for k, v in T.d.items() if k[0].startswith("LEAD#") and v["email"] == "cliente@exemplo.com"][0]
ok(tokV in leadV["galerias"], "vídeo: e-mail guardado como lead, ligado ao cartão")
S3.faltam.clear()
st, r = chama("POST", "/g/%s/galeria" % tokV, {"acesso": acV})
v0 = r["galeria"]["videos"][0]
ok(st == 200 and v0["url"].startswith("https://x/video/%s.mp4" % tokV) and "ttl=3600" in v0["url"] and "dl=" not in v0["url"]
   and v0["baixar"] == "/g/%s/baixar?v=%s&a=%s" % (tokV, tokV, acV), "vídeo: chegou; link para tocar (1 h) e o Baixar pela galeria")
ok(chama("POST", "/g/%s/galeria" % tokV, {"acesso": "x" * 32})[0] == 401, "vídeo: acesso inventado recusado")
ok(chama("POST", "/g/%s/evento" % tokV, {"acesso": acV, "tipo": "video_play", "v": tokV})[0] == 200, "vídeo: play registrado")
ok(chama("POST", "/g/%s/evento" % tokV, {"acesso": acV, "tipo": "outro"})[0] == 400, "vídeo: só o play é aceito como evento do cliente")
ok(chama("GET", "/g/%s/baixar" % tokV, q={"v": tokV, "a": "errado"})[0] == 401, "vídeo: baixar sem acesso recusado")
st, h = chama("GET", "/g/%s/baixar" % tokV, q={"v": tokV, "a": acV})
ok(st == 302 and 'attachment; filename="viva-maracana-drone.mp4"' in h["Location"], "vídeo: baixar manda para o arquivo, com o nome do serviço")
ok(chama("GET", "/ponto/eventos", q={"tokens": tokV})[0] == 401, "vídeo: eventos só com o segredo do ponto")
st, r = chama("GET", "/ponto/eventos", cab={"x-eterna-ponto": seg}, q={"tokens": tokV + ",lixo"})
tipos = [e["tipo"] for e in r["eventos"][tokV]]
ok(st == 200 and list(r["eventos"]) == [tokV] and {"qr_aberto", "video_aceite", "video_play", "video_baixou"} <= set(tipos)
   and all(app.epoch(e["em"]) > 0 for e in r["eventos"][tokV]), "vídeo: o agente recebe abriu, aceite, play e baixou com data e hora: %s" % tipos)
ok('"ip"' not in json.dumps(r) and "cliente@" not in json.dumps(r), "vídeo: eventos sem IP nem e-mail")
# v99.22: fotos do Tour achadas pela foto da venda (outra galeria, tipo sessao): o vídeo mostra o atalho
ok(chama("POST", "/ponto/galerias", {"manifesto": dict(manV, tour={"token": tokP, "n": 3})}, {"x-eterna-ponto": seg})[0] == 200, "vídeo com fotos do Tour publicado")
g = chama("POST", "/g/%s/galeria" % tokV, {"acesso": acV})[1]["galeria"]
ok(g.get("tour") == {"token": tokP, "n": 3}, "vídeo: atalho para as fotos do Tour: %s" % g.get("tour"))
ok("acesso" not in g["tour"], "vídeo: galeria do Tour comum (sem origem ativ) segue pela selfie")
chama("POST", "/ponto/galerias", {"manifesto": dict(man, token=tokP, codigo="PPPP-PPPP", catalogo=cat, origem="ativ")}, {"x-eterna-ponto": seg})
ok(app.manifesto(tokP).get("origem") == "ativ", "origem ativ guardada na galeria do Tour")
g = chama("POST", "/g/%s/galeria" % tokV, {"acesso": acV})[1]["galeria"]
tg = g["tour"].get("galeria") or {}
ok(g["tour"].get("acesso") and len(tg.get("fotos") or []) == len(app.manifesto(tokP)["fotos"]) and tg.get("tipo") == "sessao",
   "vídeo: as fotos do Tour vêm junto, sem selfie: %s" % {k: v for k, v in g["tour"].items() if k != "galeria"})
ok(any(f["original"] for f in tg["fotos"] if f["direito"] == "comprada") and not any(f["original"] for f in tg["fotos"] if f["direito"] == "venda"),
   "vídeo: comprada vem com o original, à venda só a vitrine")
ok(chama("POST", "/g/%s/galeria" % tokV, {"acesso": acV})[1]["galeria"]["tour"]["acesso"] == g["tour"]["acesso"], "vídeo: o acesso do Tour é o mesmo a cada abertura")
st, r = chama("POST", "/g/%s/galeria" % tokP, {"acesso": g["tour"]["acesso"]})
ok(st == 200 and len(r["galeria"]["fotos"]) == len(tg["fotos"]), "galeria do Tour abre com o acesso vindo do vídeo")
ok(chama("POST", "/g/%s/galeria" % tokP, {"acesso": "t" + "0" * 31})[0] == 401, "acesso do Tour inventado é recusado")
chama("POST", "/ponto/galerias", {"manifesto": dict(manV, tour={"token": "N" * 22, "n": 3})}, {"x-eterna-ponto": seg})
ok("tour" not in chama("POST", "/g/%s/galeria" % tokV, {"acesso": acV})[1]["galeria"], "vídeo: galeria do Tour que não existe não aparece")
chama("POST", "/ponto/galerias", {"manifesto": dict(manV, tour={"token": "<x>", "n": 3})}, {"x-eterna-ponto": seg})
ok("tour" not in json.loads(T.d[("GAL#" + tokV, "M")]["m"]), "vídeo: token do Tour inválido não é gravado")
st, r = chama("POST", "/ponto/galerias", {"manifesto": dict(manV, encerrada=True)}, {"x-eterna-ponto": seg})
ok(st == 200 and chama("GET", "/g/%s/info" % tokV)[0] == 410 and chama("GET", "/g/codigo/VVVV-WWWW")[0] == 404, "vídeo: venda cancelada encerra o cartão")
print("\ntudo certo")
