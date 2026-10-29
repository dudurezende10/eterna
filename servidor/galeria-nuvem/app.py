"""Eterna · galeria na nuvem (plano v85, parte F).

API que atende o celular do cliente fora do estádio, com o mesmo contrato das rotas /g/* do agente
(galeria-qr-fase1.md), para o app não mudar de tela:
  GET  /g/codigo/<XXXX-XXXX>      código curto -> token
  GET  /g/<token>/info            tipo, validade, estado
  POST /g/<token>/rosto           selfie com consentimento -> acesso de 1 h + galeria
  POST /g/<token>/galeria         renova os links com o acesso
  POST /g/<token>/pagamento       compra online: desligada até haver canal (só maquininha Imply por ora)
  POST /ponto/galerias            o agente do estádio publica o manifesto (segredo do ponto)

As fotos ficam no S3 (vitrine/<pid>.jpg e alta/<pid>.jpg, enviadas pelo agente) e saem por link assinado de 5 min.
A selfie é comparada pelo Rekognition só com os rostos da própria galeria (coleção por galeria), nunca com a base inteira.
Os rostos das fotos só são lidos depois do primeiro consentimento na galeria, e a coleção é apagada quando a galeria
vence ou é encerrada (limpeza diária). Tetos diários de leituras e buscas seguram o custo.
Sem dado pessoal nos eventos: o IP vira hash com sal do dia.
"""
import base64, hashlib, hmac, json, os, re, secrets, time
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import ClientError

REGIAO = os.environ.get("AWS_REGION", "us-east-2")
TABELA = boto3.resource("dynamodb").Table(os.environ["TABELA"])
BUCKET = os.environ["BUCKET"]
SEGREDO_PONTO_SHA256 = os.environ["SEGREDO_PONTO_SHA256"]       # só o hash; o segredo fica no agente
COLECAO_PREFIXO = os.environ.get("COLECAO_PREFIXO", "et-maracana-")
LIMIAR_ADULTO = float(os.environ.get("LIMIAR_ADULTO", "85"))    # semelhança do Rekognition (0 a 100)
LIMIAR_CRIANCA = float(os.environ.get("LIMIAR_CRIANCA", "95"))  # grupo de escola e sessão de menor: mais rígido
COMPRA_ONLINE = os.environ.get("COMPRA_ONLINE", "0") == "1"
LIMITE_FOTOS_GALERIA = int(os.environ.get("LIMITE_FOTOS_GALERIA", "600"))   # teto de fotos lidas por galeria
LIMITE_LEITURAS_DIA = int(os.environ.get("LIMITE_LEITURAS_DIA", "15000"))   # IndexFaces por dia (US$ 0,001 cada)
LIMITE_BUSCAS_DIA = int(os.environ.get("LIMITE_BUSCAS_DIA", "10000"))       # SearchFacesByImage por dia (US$ 0,001 cada)
s3 = boto3.client("s3", region_name=REGIAO, endpoint_url="https://s3.%s.amazonaws.com" % REGIAO,
                  config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
rek = boto3.client("rekognition", region_name=REGIAO)
lam = boto3.client("lambda", region_name=REGIAO)

URL_TTL = 300
ACESSO_TTL = 3600
FALHAS, BLOQUEIO = 5, 15 * 60
EVENTO_DISTINTOS, EVENTO_JANELA, EVENTO_HORA = 2, 24 * 3600, 60
EVENTOS_DIAS = 90
_re_token = re.compile(r"^[A-Za-z0-9_-]{22}$")
_re_pid = re.compile(r"^(ag_)?[0-9a-f]{6,40}$")
_re_codigo = re.compile(r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$")


# ---------- utilidades ----------
def iso(t=None):
    return datetime.fromtimestamp(t if t is not None else time.time(), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def epoch(s):
    try:
        return datetime.strptime(str(s)[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
    except Exception:
        return 0


def resp(corpo, status=200):
    return {"statusCode": status, "headers": {"Content-Type": "application/json", "Cache-Control": "no-store"},
            "body": json.dumps(corpo, ensure_ascii=False)}


def pid_lib(p):
    return p[3:] if p.startswith("ag_") else p


def ip_hash(ip):
    sal = datetime.now(timezone.utc).strftime("%Y-%m-%d") + SEGREDO_PONTO_SHA256[:16]
    return hashlib.sha256((sal + (ip or "")).encode()).hexdigest()[:16]


def item(pk, sk="M"):
    return TABELA.get_item(Key={"pk": pk, "sk": sk}).get("Item")


def manifesto(token):
    it = item("GAL#" + token)
    return json.loads(it["m"]) if it else None


def expirou(m):
    return bool(m.get("encerrada")) or epoch(m.get("expira")) <= time.time()


def evento(token, tipo, ip, **extra):
    """Linha do tempo da galeria (QR aberto, selfie, galeria vista, link de download): sem nome, rosto ou IP puro."""
    try:
        agora = time.time()
        TABELA.put_item(Item={"pk": "EVT#" + token, "sk": "%s#%s" % (iso(agora), secrets.token_hex(3)), "tipo": tipo,
                              "ip": ip_hash(ip), "ttl": int(agora + EVENTOS_DIAS * 86400),
                              **{k: str(v)[:80] for k, v in extra.items() if v is not None}})
    except Exception:
        pass


def contar(chave, janela, n):
    """Limite por janela (DynamoDB com TTL): True se ainda cabe."""
    agora = int(time.time())
    pk = "LIM#%s#%d" % (chave, agora // janela)
    r = TABELA.update_item(Key={"pk": pk, "sk": "M"}, UpdateExpression="ADD n :um SET #t = :ttl",
                           ExpressionAttributeNames={"#t": "ttl"},
                           ExpressionAttributeValues={":um": 1, ":ttl": agora + janela * 2}, ReturnValues="UPDATED_NEW")
    return int(r["Attributes"]["n"]) <= n


def falhas(ip, token, somar=False):
    """Selfie errada: 5 tentativas por (ip, galeria), depois 15 min de bloqueio. Devolve (restam, bloqueado_ate)."""
    pk = "FAL#%s#%s" % (ip_hash(ip), token)
    it = item(pk) or {}
    ate = int(it.get("ate") or 0)
    if ate > time.time():
        return 0, ate
    if not somar:
        return FALHAS - int(it.get("n") or 0), 0
    n = int(it.get("n") or 0) + 1
    if n >= FALHAS:
        ate = int(time.time() + BLOQUEIO)
        TABELA.put_item(Item={"pk": pk, "sk": "M", "n": 0, "ate": ate, "ttl": ate + 3600})
        return 0, ate
    TABELA.put_item(Item={"pk": pk, "sk": "M", "n": n, "ate": 0, "ttl": int(time.time() + 86400)})
    return FALHAS - n, 0


def evento_permite(ip, token, pids):
    """Grupo de escola: o mesmo IP abre no máximo 2 crianças diferentes por galeria em 24 h; 60 acessos por hora por galeria."""
    if not contar("EVH#" + token, 3600, EVENTO_HORA):
        return int(time.time() // 3600 * 3600 + 3600)
    pk = "EVA#%s#%s" % (ip_hash(ip), token)
    it = item(pk) or {}
    agora = time.time()
    lst = [x for x in json.loads(it.get("l") or "[]") if agora - x[1] < EVENTO_JANELA]
    if not any(set(x[0]) & pids for x in lst) and len(lst) >= EVENTO_DISTINTOS:
        return int(min(x[1] for x in lst) + EVENTO_JANELA)
    lst.append([sorted(pids), agora])
    TABELA.put_item(Item={"pk": pk, "sk": "M", "l": json.dumps(lst), "ttl": int(agora + EVENTO_JANELA)})
    return 0


def tem_s3(chave):
    try:
        s3.head_object(Bucket=BUCKET, Key=chave)
        return True
    except Exception:
        return False


def link(chave, nome=None):
    p = {"Bucket": BUCKET, "Key": chave}
    if nome:
        p["ResponseContentDisposition"] = 'attachment; filename="%s"' % nome
    return s3.generate_presigned_url("get_object", Params=p, ExpiresIn=URL_TTL)


def galeria_obj(token, m, pids):
    fotos, ok = [], False
    for i, f in enumerate(m["fotos"]):
        if f["id"] not in pids:
            continue
        pid = pid_lib(f["id"])
        tem = tem_s3("vitrine/%s.jpg" % pid)
        ok = ok or tem
        livre = f["direito"] in ("comprada", "cortesia")
        fotos.append({"pid": f["id"], "direito": f["direito"],
                      "vitrine": link("vitrine/%s.jpg" % pid) if tem else None,
                      "original": link("alta/%s.jpg" % pid, "viva-maracana-%d.jpg" % (i + 1)) if livre and tem_s3("alta/%s.jpg" % pid) else None,
                      "chegando": not tem})
    return {"tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"], "estado": "pronta" if ok else "chegando",
            "precos": m["precos"], "compra": COMPRA_ONLINE, "fotos": fotos}


def estado(m):
    return "pronta" if any(tem_s3("vitrine/%s.jpg" % pid_lib(f["id"])) for f in m["fotos"][:30]) else "chegando"


# ---------- rostos: uma coleção do Rekognition por galeria ----------
# IDX#<token>: cons (houve consentimento), idx (pids lidos), lk (trava da leitura). COL#<coleção>: token e validade,
# para a limpeza diária achar a galeria a partir da coleção (o id da coleção é um HMAC e não volta ao token).
def colecao(token):
    # o token não vai para a AWS em claro (v81 D5): id = prefixo + HMAC do token
    return COLECAO_PREFIXO + hmac.new(SEGREDO_PONTO_SHA256.encode(), token.encode(), hashlib.sha256).hexdigest()[:16]


def ttl_de(m):
    return int(epoch(m["expira"]) + 7 * 86400) if m.get("expira") else int(time.time() + 70 * 86400)


def indexar(token, m, ate):
    """Lê os rostos das fotos da galeria que já estão no S3 e ainda não foram lidas, até o instante `ate`.
    Só depois de um consentimento na galeria. Grava o progresso a cada foto: se o tempo acabar, a próxima chamada
    continua de onde parou, sem pagar de novo. Devolve ok, tempo, teto (limite do dia), travado ou sem_consentimento."""
    k = {"pk": "IDX#" + token, "sk": "M"}
    g = item(k["pk"]) or {}
    if not g.get("cons"):
        return "sem_consentimento"
    try:                                                  # uma leitura por galeria por vez
        TABELA.update_item(Key=k, UpdateExpression="SET lk = :fim", ConditionExpression="attribute_not_exists(lk) OR lk < :agora",
                           ExpressionAttributeValues={":fim": int(ate) + 5, ":agora": int(time.time())})
    except ClientError as ex:
        if ex.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return "travado"
        raise
    try:
        col = colecao(token)
        TABELA.put_item(Item={"pk": "COL#" + col, "sk": "M", "token": token, "exp": int(epoch(m["expira"]))})
        try:
            rek.create_collection(CollectionId=col)
        except rek.exceptions.ResourceAlreadyExistsException:
            pass
        feitas = set(json.loads(g.get("idx") or "[]"))
        for f in m["fotos"]:
            pid = pid_lib(f["id"])
            if pid in feitas:
                continue
            if len(feitas) >= LIMITE_FOTOS_GALERIA:
                break
            if time.time() > ate:
                return "tempo"
            if not tem_s3("alta/%s.jpg" % pid):
                continue                                  # ainda chegando do estádio
            if not contar("IDX", 86400, LIMITE_LEITURAS_DIA):
                return "teto"
            try:
                rek.index_faces(CollectionId=col, Image={"S3Object": {"Bucket": BUCKET, "Name": "alta/%s.jpg" % pid}},
                                ExternalImageId=pid, MaxFaces=15, QualityFilter="AUTO", DetectionAttributes=[])
            except rek.exceptions.InvalidParameterException:
                pass                                      # foto sem rosto (de costas, bandeira): não tenta de novo
            feitas.add(pid)
            TABELA.update_item(Key=k, UpdateExpression="SET idx = :i", ExpressionAttributeValues={":i": json.dumps(sorted(feitas))})
        return "ok"
    finally:
        TABELA.update_item(Key=k, UpdateExpression="REMOVE lk")


def continuar(token):
    """Continua a leitura em segundo plano (só depois do consentimento)."""
    lam.invoke(FunctionName=os.environ["AWS_LAMBDA_FUNCTION_NAME"], InvocationType="Event",
               Payload=json.dumps({"indexar": token}).encode())


def buscar(token, selfie):
    """Semelhança (0 a 100) por pid da galeria. None se a selfie não tem rosto."""
    try:
        r = rek.search_faces_by_image(CollectionId=colecao(token), Image={"Bytes": selfie}, MaxFaces=100, FaceMatchThreshold=60)
    except rek.exceptions.InvalidParameterException:
        return None                                      # nenhum rosto na selfie
    except rek.exceptions.ResourceNotFoundException:
        TABELA.update_item(Key={"pk": "IDX#" + token, "sk": "M"}, UpdateExpression="REMOVE idx")   # coleção sumiu: ler de novo
        return {}
    sims = {}
    for x in r.get("FaceMatches", []):
        pid = x["Face"].get("ExternalImageId")
        sims[pid] = max(sims.get(pid, 0), x["Similarity"])
    return sims


def apagar_rostos(token):
    col = colecao(token)
    try:
        rek.delete_collection(CollectionId=col)
    except rek.exceptions.ResourceNotFoundException:
        pass
    TABELA.delete_item(Key={"pk": "COL#" + col, "sk": "M"})
    TABELA.delete_item(Key={"pk": "IDX#" + token, "sk": "M"})


def limpeza():
    """Diária: apaga a coleção de rostos de galeria vencida, encerrada ou sem registro. Rosto não passa da validade da galeria."""
    apagadas, prox = 0, None
    while True:
        r = rek.list_collections(**({"NextToken": prox} if prox else {}))
        for col in r.get("CollectionIds", []):
            if not col.startswith(COLECAO_PREFIXO):
                continue
            reg = item("COL#" + col)
            m = manifesto(reg["token"]) if reg else None
            if not m or expirou(m):
                try:
                    rek.delete_collection(CollectionId=col)
                except rek.exceptions.ResourceNotFoundException:
                    pass
                TABELA.delete_item(Key={"pk": "COL#" + col, "sk": "M"})
                if reg:
                    TABELA.delete_item(Key={"pk": "IDX#" + reg["token"], "sk": "M"})
                apagadas += 1
        prox = r.get("NextToken")
        if not prox:
            return {"apagadas": apagadas}


# ---------- rotas ----------
def publicar(ev, corpo):
    seg = (ev.get("headers") or {}).get("x-eterna-ponto", "")
    if not seg or not hmac.compare_digest(hashlib.sha256(seg.encode()).hexdigest(), SEGREDO_PONTO_SHA256):
        return resp({"error": "não autorizado"}, 401)
    m = corpo.get("manifesto")
    if not isinstance(m, dict) or not _re_token.match(str(m.get("token") or "")) or m.get("tipo") not in ("sessao", "evento"):
        return resp({"error": "manifesto inválido"}, 400)
    fotos = []
    for f in (m.get("fotos") or [])[:2000]:
        if not isinstance(f, dict) or not _re_pid.match(str(f.get("id") or "")):
            return resp({"error": "foto inválida"}, 400)
        d = f.get("direito") if f.get("direito") in ("comprada", "cortesia", "venda") else "venda"
        fotos.append({"id": f["id"], "sessao": str(f.get("sessao") or "")[:40], "direito": d,
                      "canal": f.get("canal") if f.get("canal") in ("loja", "online") else None})
    pr = m.get("precos") or {}
    novo = {"v": 1, "token": m["token"], "codigo": m.get("codigo") if _re_codigo.match(str(m.get("codigo") or "")) else None,
            "tipo": m["tipo"], "venue": str(m.get("venue") or "")[:40], "nome": str(m.get("nome") or "")[:120] or None,
            "menor": bool(m.get("menor")), "criada": str(m.get("criada") or iso())[:40], "expira": str(m.get("expira") or "")[:40],
            "precos": {"dig": max(0.0, float(pr.get("dig") or 0)), "todas": max(0.0, float(pr.get("todas") or 0))}, "fotos": fotos}
    velho = manifesto(m["token"])
    if velho:                                             # comprada nunca regride; validade nunca aumenta; encerrada não volta
        antes = {f["id"]: f for f in velho["fotos"]}
        for f in novo["fotos"]:
            a = antes.get(f["id"])
            if a and a["direito"] == "comprada" and f["direito"] != "comprada":
                f["direito"], f["canal"] = "comprada", a.get("canal") or "online"
        if velho.get("expira") and epoch(velho["expira"]) < epoch(novo["expira"]):
            novo["expira"] = velho["expira"]
        if velho.get("encerrada"):
            novo["encerrada"] = True
    if m.get("encerrada"):                                # encerrada no ponto: sai do ar na nuvem também
        novo["encerrada"] = True
    ttl = ttl_de(novo)
    TABELA.update_item(Key={"pk": "GAL#" + novo["token"], "sk": "M"}, UpdateExpression="SET m = :m, #t = :t",
                       ExpressionAttributeNames={"#t": "ttl"}, ExpressionAttributeValues={":m": json.dumps(novo), ":t": ttl})
    if novo.get("encerrada"):
        apagar_rostos(novo["token"])
        if novo["codigo"]:
            TABELA.delete_item(Key={"pk": "COD#" + novo["codigo"], "sk": "M"})
        return resp({"ok": True, "token": novo["token"], "estado": "encerrada"})
    if novo["codigo"]:
        TABELA.put_item(Item={"pk": "COD#" + novo["codigo"], "sk": "M", "token": novo["token"], "ttl": ttl})
    # os rostos não são lidos aqui: só depois do primeiro consentimento na galeria (rota /rosto)
    return resp({"ok": True, "token": novo["token"], "estado": estado(novo)})


def rosto(token, m, corpo, ip, ctx):
    if not contar("ROS#" + ip_hash(ip), 60, 10):
        return resp({"motivo": "bloqueado", "ate": iso(time.time() + 60)}, 429)
    if corpo.get("consentimento") is not True:
        return resp({"error": "consentimento obrigatório"}, 400)
    restam, ate = falhas(ip, token)
    if ate:
        return resp({"motivo": "bloqueado", "ate": iso(ate)}, 429)
    img = corpo.get("imagem")
    if not isinstance(img, str) or not img:
        return resp({"error": "sem imagem"}, 400)
    try:
        selfie = base64.b64decode(img.split(",", 1)[-1])
    except Exception:
        return resp({"error": "imagem inválida"}, 400)
    kid = m["tipo"] == "evento" or bool(m.get("menor"))
    TABELA.put_item(Item={"pk": "CON#" + token, "sk": "%s#%s" % (iso(), secrets.token_hex(3)), "tipo": "responsavel" if kid else "titular",
                          "versao": str(corpo.get("versao") or "")[:20], "idioma": str(corpo.get("idioma") or "pt")[:2],
                          "ttl": int(time.time() + 400 * 86400)})
    TABELA.update_item(Key={"pk": "IDX#" + token, "sk": "M"}, UpdateExpression="SET cons = :um, #t = :ttl",
                       ExpressionAttributeNames={"#t": "ttl"}, ExpressionAttributeValues={":um": 1, ":ttl": ttl_de(m)})
    # lê os rostos que faltam com o tempo que sobra desta chamada (o API Gateway corta em 30 s); o resto, em segundo plano
    leitura = indexar(token, m, time.time() + max(2, ctx.get_remaining_time_in_millis() / 1000 - 9))
    if leitura == "tempo":
        continuar(token)
    if not contar("BUS", 86400, LIMITE_BUSCAS_DIA):
        evento(token, "selfie_teto", ip)
        return resp({"ok": False, "motivo": "processando"}, 503)
    sims = buscar(token, selfie)
    selfie = img = None
    if sims is None:
        restam, _ = falhas(ip, token, somar=True)
        evento(token, "selfie_sem_rosto", ip)
        return resp({"ok": False, "motivo": "sem_rosto", "restam": restam})
    if m["tipo"] == "evento":
        pids = {f["id"] for f in m["fotos"] if sims.get(pid_lib(f["id"]), 0) >= LIMIAR_CRIANCA}
    else:
        lim = LIMIAR_CRIANCA if m.get("menor") else LIMIAR_ADULTO
        pids = {f["id"] for f in m["fotos"]} if any(s >= lim for s in sims.values()) else set()
    if not pids and leitura != "ok":
        evento(token, "selfie_processando", ip)          # leitura incompleta: não conta como erro
        return resp({"ok": False, "motivo": "processando"}, 503)
    if not pids:
        restam, ate = falhas(ip, token, somar=True)
        evento(token, "selfie_nao", ip)
        if ate:
            return resp({"motivo": "bloqueado", "ate": iso(ate)}, 429)
        return resp({"ok": False, "motivo": "nao_encontrado", "restam": restam})
    if m["tipo"] == "evento":
        ate = evento_permite(ip, token, pids)
        if ate:
            return resp({"motivo": "bloqueado", "ate": iso(ate)}, 429)
    acesso = secrets.token_urlsafe(24)
    exp = int(time.time() + ACESSO_TTL)
    TABELA.put_item(Item={"pk": "ACE#" + acesso, "sk": "M", "token": token, "pids": json.dumps(sorted(pids)), "exp": exp, "ttl": exp})
    evento(token, "selfie_ok", ip, fotos=len(pids))
    return resp({"ok": True, "acesso": acesso, "exp": iso(exp), "galeria": galeria_obj(token, m, pids)})


def handler(ev, ctx):
    if ev.get("limpeza"):                                 # agendada, uma vez por dia
        return limpeza()
    if ev.get("indexar"):                                 # chamada interna em segundo plano
        t = ev["indexar"]
        m = manifesto(t)
        if not m or expirou(m):
            return {"leitura": "fora"}
        r = indexar(t, m, time.time() + ctx.get_remaining_time_in_millis() / 1000 - 5)
        if r == "tempo":
            continuar(t)
        return {"leitura": r}
    metodo = ev.get("requestContext", {}).get("http", {}).get("method", "GET")
    caminho = ev.get("rawPath") or "/"
    ip = ev.get("requestContext", {}).get("http", {}).get("sourceIp", "")
    corpo = {}
    if metodo == "POST":
        raw = ev.get("body") or ""
        if ev.get("isBase64Encoded"):
            raw = base64.b64decode(raw).decode("utf8", "replace")
        if len(raw) > 2_800_000:
            return resp({"error": "imagem grande demais"}, 413)
        try:
            corpo = json.loads(raw or "{}")
        except Exception:
            return resp({"error": "corpo inválido"}, 400)
    if caminho == "/ponto/galerias" and metodo == "POST":
        return publicar(ev, corpo)
    partes = caminho.split("/")                           # ['', 'g', token, ação]
    if len(partes) == 4 and partes[1] == "g" and partes[2] == "codigo" and metodo == "GET":
        if not contar("COD#" + ip_hash(ip), 60, 30):
            return resp({"motivo": "bloqueado"}, 429)
        c = partes[3].upper()
        it = item("COD#" + c) if _re_codigo.match(c) else None
        m = manifesto(it["token"]) if it else None
        if not m or expirou(m):
            return resp({"error": "not found"}, 404)
        evento(it["token"], "codigo_digitado", ip)
        return resp({"token": it["token"]})
    if len(partes) != 4 or partes[1] != "g" or not _re_token.match(partes[2]):
        return resp({"error": "not found"}, 404)
    token, acao = partes[2], partes[3]
    m = manifesto(token)
    if not m:
        return resp({"error": "not found"}, 404)
    if expirou(m):
        return resp({"error": "expirada"}, 410)
    if acao == "info" and metodo == "GET":
        evento(token, "qr_aberto", ip)
        return resp({"ok": True, "tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"],
                     "estado": estado(m), "venue": m.get("venue"), "compra": COMPRA_ONLINE})
    if acao == "rosto" and metodo == "POST":
        return rosto(token, m, corpo, ip, ctx)
    if acao in ("galeria", "pagamento") and metodo == "POST":
        a = item("ACE#" + str(corpo.get("acesso") or "")) if corpo.get("acesso") else None
        if not a or a["token"] != token or int(a["exp"]) < time.time():
            return resp({"error": "acesso inválido ou vencido"}, 401)
        pids = set(json.loads(a["pids"]))
        if acao == "galeria":
            evento(token, "galeria_vista", ip)
            return resp({"galeria": galeria_obj(token, m, pids)})
        # compra online desligada: por ora a venda é só no balcão, na maquininha Imply
        evento(token, "compra_tentada", ip)
        return resp({"ok": False, "motivo": "compra_indisponivel",
                     "mensagem": "A compra online ainda não está disponível. Fale com a equipe do Tour."}, 503)
    return resp({"error": "not found"}, 404)
