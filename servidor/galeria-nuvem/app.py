"""Eterna · galeria na nuvem (plano v85, parte F).

API que atende o celular do cliente fora do estádio, com o mesmo contrato das rotas /g/* do agente
(galeria-qr-fase1.md), para o app não mudar de tela:
  GET  /g/codigo/<XXXX-XXXX[-XXXX]> código curto -> token (12 no cartão)
  GET  /g/<token>/info            tipo, validade, estado
  GET  /g/<token>/livres          na venda (sessao): compradas e cortesias só pelo QR, sem selfie (v96.1)
  POST /g/<token>/rosto           selfie com consentimento -> acesso de 1 h + galeria
  POST /g/<token>/galeria         renova os links com o acesso
  POST /g/<token>/pedido          compra online pela Imply: cria o pedido e devolve o endereço do checkout (v99)
  GET  /g/pedido/<ON-...>         volta do checkout: confere o pedido na Imply e diz a galeria e a situação (v99)
  POST /g/<token>/pagamento       rota antiga (compra direta): responde compra_indisponivel
  POST /ponto/galerias            o agente do estádio publica o manifesto (segredo do ponto)
  GET  /ponto/vendas-online       o agente busca as vendas online pagas (segredo do ponto) (v99)
  Vídeo das ativações (Drone, Chute a Gol, Snap Pop; v99.20): galeria tipo "video", o cartão com QR é a chave, sem selfie
  POST /g/<token>/video           aceite de uso de imagem + e-mail -> acesso e o link do vídeo (ou "chegando")
  POST /g/<token>/evento          o cliente deu play (registro com data e hora)
  GET  /g/<token>/baixar?v=&a=    registra o download e manda para o link assinado do arquivo (attachment)
  GET  /ponto/eventos?tokens=     o agente busca quando o cliente abriu, deu play e baixou (segredo do ponto)

As fotos ficam no S3 (vitrine/<pid>.jpg e alta/<pid>.jpg, enviadas pelo agente) e saem por link assinado de 5 min.
A selfie é comparada pelo Rekognition só com os rostos da própria galeria (coleção por galeria), nunca com a base inteira.
Os rostos das fotos só são lidos depois do primeiro consentimento na galeria, e a coleção é apagada quando a galeria
vence ou é encerrada (limpeza diária). Tetos diários de leituras e buscas seguram o custo.
Sem dado pessoal nos eventos: o IP vira hash com sal do dia.
"""
import base64, hashlib, hmac, json, os, re, secrets, time
from datetime import datetime, timezone
import boto3
import imply
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import ClientError

REGIAO = os.environ.get("AWS_REGION", "us-east-2")
TABELA = boto3.resource("dynamodb").Table(os.environ["TABELA"])
BUCKET = os.environ["BUCKET"]
SEGREDO_PONTO_SHA256 = os.environ["SEGREDO_PONTO_SHA256"]       # só o hash; o segredo fica no agente
SEGREDO_TESTE_SHA256 = os.environ.get("SEGREDO_PONTO_TESTE_SHA256", "")   # servidor de teste: publica sem usar o segredo do estádio
COLECAO_PREFIXO = os.environ.get("COLECAO_PREFIXO", "et-maracana-")
LIMIAR_ADULTO = float(os.environ.get("LIMIAR_ADULTO", "85"))    # semelhança do Rekognition (0 a 100)
LIMIAR_CRIANCA = float(os.environ.get("LIMIAR_CRIANCA", "95"))  # grupo de escola e sessão de menor: mais rígido
COMPRA_ONLINE = os.environ.get("COMPRA_ONLINE", "0") == "1"
VOLTA_URL = os.environ.get("VOLTA_URL", "https://eterna.photo/g/")   # a Imply devolve o cliente para cá com ?idpedido=<ON-...>
PED_DIAS = 400                                                     # pedido e venda online guardados (conferência, estorno)
LIMITE_FOTOS_GALERIA = int(os.environ.get("LIMITE_FOTOS_GALERIA", "600"))   # teto de fotos lidas por galeria
LIMITE_LEITURAS_DIA = int(os.environ.get("LIMITE_LEITURAS_DIA", "15000"))   # IndexFaces por dia (US$ 0,001 cada)
LIMITE_BUSCAS_DIA = int(os.environ.get("LIMITE_BUSCAS_DIA", "10000"))       # SearchFacesByImage por dia (US$ 0,001 cada)
s3 = boto3.client("s3", region_name=REGIAO, endpoint_url="https://s3.%s.amazonaws.com" % REGIAO,
                  config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}))
rek = boto3.client("rekognition", region_name=REGIAO)
lam = boto3.client("lambda", region_name=REGIAO)

URL_TTL = 300
VIDEO_TTL = 3600                                           # link do vídeo no player: dá para voltar e rever sem renovar
VIDEO_EVENTOS = ("qr_aberto", "codigo_digitado", "video_aceite", "video_play", "video_baixou")
_re_servico = re.compile(r"^[a-z]{0,20}$")
ACESSO_TTL = 3600
FALHAS, BLOQUEIO = 5, 15 * 60
TETO_DIA = int(os.environ.get("TETO_SELFIES_DIA", "20"))   # v96.1: selfies sem acerto por galeria de venda por dia (todos os IPs)
FUSO_H = -3                                                # dia do venue (Brasília, sem horário de verão)
EVENTO_DISTINTOS, EVENTO_JANELA, EVENTO_HORA = 2, 24 * 3600, 60
EVENTOS_DIAS = 90
_re_token = re.compile(r"^[A-Za-z0-9_-]{22}$")
_re_pid = re.compile(r"^(ag_)?[0-9a-f]{6,40}$")
_re_codigo = re.compile(r"^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4})?$")   # v99.24: cartão com 12
_re_ref = re.compile(r"^ON-[A-HJ-NP-Z2-9]{10}$")
_re_sku = re.compile(r"^[0-9a-f]{40}$")
_re_passaporte = re.compile(r"^[A-Z0-9]{5,20}$")


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


def codigo_liga(codigo, token, ttl):
    """v99.23.7: o código digitável (XXXX-XXXX) nunca troca de dono. Com muitos cartões, dois tokens podem dar o mesmo código;
    o segundo fica só com o QR (que é único) e o código continua abrindo a galeria do primeiro. Nunca abre a de outro."""
    it = item("COD#" + codigo)
    if it and it.get("token") != token:
        print("ALERTA código repetido %s: fica com a galeria que chegou primeiro; a nova abre só pelo QR" % codigo)
        return False
    TABELA.put_item(Item={"pk": "COD#" + codigo, "sk": "M", "token": token, "ttl": ttl})
    return True


def codigo_solta(codigo, token):
    """Galeria encerrada solta só o código que é dela."""
    it = item("COD#" + codigo)
    if it and it.get("token") == token:
        TABELA.delete_item(Key={"pk": "COD#" + codigo, "sk": "M"})


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


def _dia_venue(t=None):
    t = time.time() if t is None else t
    return datetime.fromtimestamp(t + FUSO_H * 3600, timezone.utc).strftime("%Y-%m-%d")


def _amanha_venue():
    t = time.time() + FUSO_H * 3600
    return int((t // 86400 + 1) * 86400 - FUSO_H * 3600)


def teto_galeria(token):
    """v96.1: galeria de venda com TETO_DIA selfies sem acerto hoje (todos os IPs) fica parada até o dia seguinte. 0 = pode."""
    it = item("FALG#%s#%s" % (token, _dia_venue())) or {}
    return _amanha_venue() if int(it.get("n") or 0) >= TETO_DIA else 0


def teto_soma(token, ip):
    agora = int(time.time())
    r = TABELA.update_item(Key={"pk": "FALG#%s#%s" % (token, _dia_venue()), "sk": "M"}, UpdateExpression="ADD n :um SET #t = :ttl",
                           ExpressionAttributeNames={"#t": "ttl"}, ExpressionAttributeValues={":um": 1, ":ttl": agora + 2 * 86400},
                           ReturnValues="UPDATED_NEW")
    n = int(r["Attributes"]["n"])
    if n == TETO_DIA:                                     # alerta: evento na linha do tempo e linha no log (sem token)
        evento(token, "galeria_teto_selfie", ip, n=n)
        print("ALERTA galeria %s: %d selfies sem acerto hoje, parada até amanhã" % (colecao(token)[-8:], n))
    return n


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


def link(chave, nome=None, ttl=URL_TTL):
    p = {"Bucket": BUCKET, "Key": chave}
    if nome:
        p["ResponseContentDisposition"] = 'attachment; filename="%s"' % nome
    return s3.generate_presigned_url("get_object", Params=p, ExpiresIn=ttl)


def livres(m):
    """v96.1 (decisão do Eduardo, 10/11): na galeria de uma venda (tipo sessao) o QR sozinho abre as compradas e as cortesias
    daquela venda, sem selfie. A selfie só acrescenta as à venda em que a pessoa aparece (v95). Grupo de escola (evento): só o rosto."""
    if m["tipo"] != "sessao":
        return set()
    return {f["id"] for f in m["fotos"] if f["direito"] in ("comprada", "cortesia")}


def galeria_obj(token, m, pids=()):
    pids = set(pids) | livres(m)            # compradas e cortesias seguem o manifesto de agora
    fotos, ok, cache = [], False, {}

    def tem(chave):                         # um head_object por chave nesta chamada
        if chave not in cache:
            cache[chave] = tem_s3(chave)
        return cache[chave]
    for i, f in enumerate(m["fotos"]):
        if f["id"] not in pids:
            continue
        pid = pid_lib(f["id"])
        v = tem("vitrine/%s.jpg" % pid)
        ok = ok or v
        livre = f["direito"] in ("comprada", "cortesia")
        fotos.append({"pid": f["id"], "direito": f["direito"],
                      "vitrine": link("vitrine/%s.jpg" % pid) if v else None,
                      "original": link("alta/%s.jpg" % pid, "viva-maracana-%d.jpg" % (i + 1)) if livre and tem("alta/%s.jpg" % pid) else None,
                      "chegando": not v})
    return {"tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"], "estado": "pronta" if ok else "chegando",
            "precos": m["precos"], "catalogo": m.get("catalogo") or [], "compra": compra_ligada(m), "fotos": fotos}


def estado(m):
    if m["tipo"] == "video":
        return "pronta" if any(tem_s3(v["chave"]) for v in m["videos"]) else "chegando"
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


VARIAS_RAZAO = 0.5     # mesma regra do agente (varias_pessoas): o 2º rosto com metade da largura do maior = duas pessoas


def varias_pessoas(selfie):
    """Uma pessoa por vez (antifraude): duas pessoas de rosto parecido na selfie e a busca não roda. Rosto bem menor ao fundo
    não conta. O search_faces_by_image só olha o maior rosto, por isso a conferência vem antes, com o detect_faces."""
    try:
        fs = sorted((f["BoundingBox"]["Width"] for f in rek.detect_faces(Image={"Bytes": selfie}).get("FaceDetails", [])), reverse=True)
    except Exception:
        return False
    return len(fs) >= 2 and fs[1] >= VARIAS_RAZAO * fs[0]


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


# ---------- esqueci a senha: e-mail com a senha provisória gerada pelo servidor do estádio ----------
# POST /auth/senha-email {email, senha, idioma} -> 202 · 400 · 401 · 429 · 502. Só o servidor do estádio chama, com o segredo do ponto. A senha não é
# guardada nem vai para log. Sai pelo Amazon SES com a permissão da própria função. Limites: 6 por hora por e-mail, 400 por hora no total.
MAIL_FROM = os.environ.get("MAIL_FROM", "")
MAIL_NOME = os.environ.get("MAIL_NOME", "Viva Maracanã")
_re_email = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$", re.I)
_re_senha_prov = re.compile(r"^[a-z0-9]{8,64}$")
_ses = boto3.client("sesv2", region_name=REGIAO)


EMAIL_SENHA = {
    "pt": ("Sua senha provisória", "Recebemos um pedido para redefinir sua senha do Eterna. Use esta senha provisória na tela de entrada.",
           "Ela vale por 30 minutos e só serve para criar a sua senha nova.", "Se não foi você que pediu, ignore este e-mail. Sua senha atual continua valendo."),
    "en": ("Your temporary password", "We received a request to reset your Eterna password. Use this temporary password on the sign-in screen.",
           "It is valid for 30 minutes and can only be used to create your new password.", "If you did not request this, ignore this email. Your current password keeps working."),
    "es": ("Tu contraseña temporal", "Recibimos una solicitud para restablecer tu contraseña de Eterna. Usa esta contraseña temporal en la pantalla de entrada.",
           "Es válida durante 30 minutos y solo sirve para crear tu contraseña nueva.", "Si no fuiste tú, ignora este correo. Tu contraseña actual sigue funcionando."),
    "fr": ("Votre mot de passe temporaire", "Nous avons reçu une demande de réinitialisation de votre mot de passe Eterna. Utilisez ce mot de passe temporaire sur l'écran de connexion.",
           "Il est valable 30 minutes et sert uniquement à créer votre nouveau mot de passe.", "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail. Votre mot de passe actuel reste valable."),
    "de": ("Ihr vorläufiges Passwort", "Wir haben eine Anfrage zum Zurücksetzen Ihres Eterna-Passworts erhalten. Verwenden Sie dieses vorläufige Passwort auf der Anmeldeseite.",
           "Es gilt 30 Minuten und dient nur dazu, Ihr neues Passwort zu erstellen.", "Wenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail. Ihr aktuelles Passwort bleibt gültig."),
}


def senha_email(ev, corpo):
    seg = (ev.get("headers") or {}).get("x-eterna-ponto", "")
    if not ponto_ok(seg):
        return resp({"erro": "nao_autorizado"}, 401)
    email = str(corpo.get("email") or "").strip().lower()
    senha = str(corpo.get("senha") or "")
    if not _re_email.match(email) or not _re_senha_prov.match(senha):
        return resp({"erro": "pedido"}, 400)
    he = hashlib.sha256(email.encode()).hexdigest()[:24]
    if not (contar("REH#" + he, 3600, 6) and contar("RTOT", 3600, 400)):
        return resp({"erro": "aguarde"}, 429)
    if not MAIL_FROM:
        return resp({"erro": "envio desligado"}, 502)
    assunto, intro, aviso, ignore = EMAIL_SENHA.get(str(corpo.get("idioma") or ""), EMAIL_SENHA["pt"])
    texto = "%s\n\n%s\n\n%s\n\n%s" % (intro, senha, aviso, ignore)
    html = ("<div style='font-family:Arial,sans-serif;color:#0C2340;max-width:480px'><p>%s</p><p style='font-family:monospace;font-size:26px;font-weight:bold;margin:18px 0'>%s</p>"
            "<p>%s</p><p style='color:#666;font-size:13px'>%s</p></div>") % (intro, senha, aviso, ignore)
    try:
        _ses.send_email(FromEmailAddress="%s <%s>" % (MAIL_NOME, MAIL_FROM), Destination={"ToAddresses": [email]},
                        Content={"Simple": {"Subject": {"Data": "%s · %s" % (assunto, MAIL_NOME), "Charset": "UTF-8"},
                                            "Body": {"Text": {"Data": texto, "Charset": "UTF-8"}, "Html": {"Data": html, "Charset": "UTF-8"}}}})
    except Exception as ex:
        print("senha-email: envio falhou:", str(ex)[:200])
        return resp({"erro": "envio"}, 502)
    return resp({"ok": True}, 202)


# ---------- compra online pela Imply (v99, plano docs/planos/2026-11-11-compra-online-pela-imply.md) ----------
# A galeria monta o carrinho com os produtos do catálogo online (mesmos SKU e preço da Imply, publicados pelo ponto no
# manifesto); a Nuvem confere, cria o pedido (PED#<ON-...>), cadastra a pessoa na Imply (setPessoa) e devolve o endereço do
# checkout. A volta do cliente não libera nada: a foto só vira comprada quando a consulta à Imply responde pago, na volta
# (GET /g/pedido/<ref>) ou na conferência agendada dos pendentes (PEDPEND). Venda paga vira registro em VONL, que o agente
# do estádio busca (GET /ponto/vendas-online) e junta às vendas do ponto.
_ALFA_REF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def compra_ligada(m=None):
    return COMPRA_ONLINE and imply.ligada() and (m is None or bool(m.get("catalogo")))


def catalogo_ok(cat):
    out = []
    for c in (cat if isinstance(cat, list) else [])[:20]:
        if not isinstance(c, dict) or not re.match(r"^[a-z0-9_]{1,20}$", str(c.get("id") or "")) or not _re_sku.match(str(c.get("sku") or "")):
            continue
        dig = c.get("digital")
        if dig != "todas":
            try:
                dig = max(0, int(dig))
            except Exception:
                continue
        try:
            preco = round(max(0.0, float(c.get("preco"))), 2)
        except Exception:
            continue
        out.append({"id": c["id"], "sku": c["sku"], "nome": str(c.get("nome") or "")[:80], "preco": preco, "digital": dig,
                    "kind": "pacote" if c.get("kind") == "pacote" else "adicional"})
    return out


def cesta(m, itens, n):
    """Confere o carrinho da galeria: produtos do catálogo online, ao menos um pacote, cobrindo as n fotos escolhidas.
    O preço é o do manifesto (o que o navegador mandar é ignorado). Devolve (itens, total, todas) ou None."""
    cat = {c["id"]: c for c in m.get("catalogo") or []}
    if not isinstance(itens, list) or not 1 <= len(itens) <= 5:
        return None
    out, total, cobre, todas, pacote = [], 0.0, 0, False, False
    for i in itens:
        c = cat.get(str(i.get("id"))) if isinstance(i, dict) else None
        q = i.get("qtd") if isinstance(i, dict) else None
        if not c or not isinstance(q, int) or isinstance(q, bool) or not 1 <= q <= 50 or any(x["id"] == c["id"] for x in out):
            return None
        out.append({"id": c["id"], "sku": c["sku"], "nome": c["nome"], "qtd": q, "preco": c["preco"]})
        total += c["preco"] * q
        pacote = pacote or c["kind"] == "pacote"
        if c["digital"] == "todas":
            todas = True
        else:
            cobre += c["digital"] * q
    if not pacote or not (todas or cobre >= n):
        return None
    return out, round(total, 2), todas


def _ref():
    return "ON-" + "".join(secrets.choice(_ALFA_REF) for _ in range(10))


def pedido(token, m, corpo, ip, pids_acesso):
    if not compra_ligada(m):
        evento(token, "compra_tentada", ip)
        return resp({"ok": False, "motivo": "compra_indisponivel"}, 503)
    if not contar("PED#" + ip_hash(ip), 3600, 20):
        return resp({"motivo": "bloqueado"}, 429)
    dire = {f["id"]: f["direito"] for f in m["fotos"]}
    a_venda = [f["id"] for f in m["fotos"] if f["id"] in pids_acesso and f["direito"] == "venda"]
    pids = corpo.get("pids")
    if not isinstance(pids, list) or not pids or len(set(map(str, pids))) != len(pids) or any(x not in pids_acesso or dire.get(x) != "venda" for x in pids):
        return resp({"error": "foto fora do acesso ou não está à venda"}, 400)
    c = cesta(m, corpo.get("itens"), len(pids))
    if not c:
        return resp({"error": "carrinho inválido"}, 400)
    itens, total, todas = c
    if todas:
        pids = a_venda                                     # "todas as fotos digitais": todas as à venda que o cliente vê
    cli = corpo.get("cliente") if isinstance(corpo.get("cliente"), dict) else {}
    nome = " ".join(str(cli.get("nome") or "").split())[:120]
    email = str(cli.get("email") or "").strip().lower()
    cpf = re.sub(r"\D", "", str(cli.get("cpf") or ""))
    passaporte = re.sub(r"[^A-Z0-9]", "", str(cli.get("passaporte") or "").upper())
    if len(nome) < 3 or not _re_email.match(email):
        return resp({"error": "dados", "campo": "nome" if len(nome) < 3 else "email"}, 400)
    if cpf and not imply.cpf_ok(cpf) or not cpf and not _re_passaporte.match(passaporte):
        return resp({"error": "dados", "campo": "documento"}, 400)
    ref, agora = _ref(), time.time()
    pessoa = imply.de_para(email, SEGREDO_PONTO_SHA256)
    idioma = str(corpo.get("idioma") or "pt")[:2]
    marketing = corpo.get("marketing") is True
    TABELA.put_item(Item={"pk": "PED#" + ref, "sk": "M", "token": token, "pids": json.dumps(sorted(pids)), "itens": json.dumps(itens),
                          "total": str(total), "todas": todas, "estado": "criado", "nome": nome, "email": email, "pessoa": pessoa,
                          "idioma": idioma, "criado": iso(agora), "consultas": 0, "ttl": int(agora + PED_DIAS * 86400)})
    lead(email, idioma, token, marketing, str(corpo.get("versao") or "")[:20], ref)
    try:
        tk = imply.set_pessoa(pessoa, nome, email, cpf=cpf or None, passaporte=None if cpf else passaporte)
        url = imply.checkout(tk, ref, itens, VOLTA_URL)
    except Exception as ex:                               # a Imply fora ou recusou: o pedido fica registrado com o erro
        print("pedido %s: Imply falhou: %s" % (ref, str(ex)[:200]))
        TABELA.update_item(Key={"pk": "PED#" + ref, "sk": "M"}, UpdateExpression="SET estado = :e, erro = :x",
                           ExpressionAttributeValues={":e": "erro", ":x": str(ex)[:200]})
        evento(token, "pedido_erro", ip, ref=ref)
        return resp({"ok": False, "motivo": "imply_indisponivel"}, 502)
    TABELA.update_item(Key={"pk": "PED#" + ref, "sk": "M"}, UpdateExpression="SET estado = :e", ExpressionAttributeValues={":e": "aguardando"})
    TABELA.put_item(Item={"pk": "PEDPEND", "sk": ref, "criado": int(agora), "ttl": int(agora + 3 * 86400)})
    evento(token, "pedido_criado", ip, ref=ref, total=total, fotos=len(pids))
    return resp({"ok": True, "ref": ref, "url": url, "total": total, "fotos": len(pids)})


def lead(email, idioma, token, marketing, versao, ref=None):
    """E-mail de quem comprou ou tentou comprar (lead). O consentimento de marketing é separado e opcional (LGPD):
    só quem marcou vai para o RD Station (etapa 4 do plano)."""
    k = {"pk": "LEAD#" + hashlib.sha256(email.encode()).hexdigest()[:32], "sk": "M"}
    velho = item(k["pk"]) or {}
    gs = set(json.loads(velho.get("galerias") or "[]")) | {token}
    peds = (json.loads(velho.get("pedidos") or "[]") + ([ref] if ref else []))[-50:]
    novo = {**k, "email": email, "idioma": idioma, "galerias": json.dumps(sorted(gs)[-50:]), "pedidos": json.dumps(peds),
            "primeiro": velho.get("primeiro") or iso(), "ultimo": iso(), "ttl": int(time.time() + PED_DIAS * 86400)}
    if marketing:
        novo.update({"marketing": True, "marketing_em": iso(), "marketing_versao": versao})
    elif velho.get("marketing"):
        novo.update({k2: velho[k2] for k2 in ("marketing", "marketing_em", "marketing_versao") if k2 in velho})
    TABELA.put_item(Item=novo)


def liberar(ref, it, det):
    """Pago na Imply: as fotos do pedido viram compradas (canal online) e a venda vai para VONL. Uma vez só por pedido."""
    try:
        TABELA.update_item(Key={"pk": "PED#" + ref, "sk": "M"}, UpdateExpression="SET estado = :p, pago = :t",
                           ConditionExpression="estado <> :p", ExpressionAttributeValues={":p": "pago", ":t": iso()})
    except ClientError as ex:
        if ex.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return
        raise
    token, pids = it["token"], set(json.loads(it["pids"]))
    m = manifesto(token)
    if m:
        for f in m["fotos"]:
            if f["id"] in pids and f["direito"] != "comprada":
                f["direito"], f["canal"] = "comprada", "online"
                f.pop("cortesia", None)
        TABELA.update_item(Key={"pk": "GAL#" + token, "sk": "M"}, UpdateExpression="SET m = :m", ExpressionAttributeValues={":m": json.dumps(m)})
    total = float(it["total"])
    try:
        pago = round(float(det.get("valor")), 2) if det.get("valor") is not None else total
    except Exception:
        pago = total
    sessoes = sorted({f.get("sessao") for f in (m or {}).get("fotos", []) if f["id"] in pids and f.get("sessao")})
    TABELA.put_item(Item={"pk": "VONL", "sk": "%s#%s" % (iso(), ref), "ref": ref, "token": token, "pids": it["pids"], "n": len(pids),
                          "total": str(total), "pago": str(pago), "diferenca": str(round(pago - total, 2)), "itens": it["itens"],
                          "todas": bool(it.get("todas")), "sessoes": json.dumps(sessoes), "idpedido": str(det.get("idpedido") or "")[:40],
                          "meio": str(det.get("meio") or "")[:40], "ttl": int(time.time() + PED_DIAS * 86400)})
    TABELA.delete_item(Key={"pk": "PEDPEND", "sk": ref})
    evento(token, "pedido_pago", "", ref=ref, total=pago)
    email_pago(it)


def conferir(ref):
    """Pergunta à Imply a situação do pedido. Só "pago" libera; "cancelado" encerra o pedido sem liberar."""
    it = item("PED#" + ref)
    if not it or it.get("estado") in ("pago", "cancelado", "expirado", "erro"):
        return it
    try:
        st, det = imply.situacao(ref)
    except Exception as ex:
        st, det = "desconhecido", {"bruto": "erro: " + str(ex)[:100]}
    TABELA.update_item(Key={"pk": "PED#" + ref, "sk": "M"}, UpdateExpression="SET consultas = :n, conferido = :t, resposta = :r",
                       ExpressionAttributeValues={":n": int(it.get("consultas") or 0) + 1, ":t": iso(), ":r": str(det.get("bruto") or "")[:60]})
    if st == "pago":
        liberar(ref, it, det)
    elif st == "cancelado":
        TABELA.update_item(Key={"pk": "PED#" + ref, "sk": "M"}, UpdateExpression="SET estado = :e", ExpressionAttributeValues={":e": "cancelado"})
        TABELA.delete_item(Key={"pk": "PEDPEND", "sk": ref})
    return item("PED#" + ref)


def conferir_pendentes():
    """A cada 5 min: pedidos sem resposta. Na 1ª hora, todo ciclo; até 24 h, a cada 30 min; depois, expira sem liberar."""
    agora, feitos = time.time(), 0
    for p in TABELA.query(KeyConditionExpression=Key("pk").eq("PEDPEND")).get("Items", []):
        idade = agora - int(p.get("criado") or agora)
        if idade > 86400:
            it = conferir(p["sk"])                        # última consulta antes de desistir
            if it and it.get("estado") not in ("pago", "cancelado"):
                TABELA.update_item(Key={"pk": "PED#" + p["sk"], "sk": "M"}, UpdateExpression="SET estado = :e", ExpressionAttributeValues={":e": "expirado"})
            TABELA.delete_item(Key={"pk": "PEDPEND", "sk": p["sk"]})
            continue
        if idade > 3600 and int(agora // 300) % 6:
            continue
        conferir(p["sk"])
        feitos += 1
    return {"conferidos": feitos}


def pedido_volta(ref, ip):
    if not _re_ref.match(ref) or not contar("VOL#" + ip_hash(ip), 60, 30):
        return resp({"error": "not found"}, 404)
    it = conferir(ref)
    if not it:
        return resp({"error": "not found"}, 404)
    return resp({"token": it["token"], "estado": it["estado"], "total": float(it["total"]), "fotos": len(json.loads(it["pids"]))})


def vendas_online(ev):
    if not ponto_ok((ev.get("headers") or {}).get("x-eterna-ponto", "")):
        return resp({"error": "não autorizado"}, 401)
    desde = str((ev.get("queryStringParameters") or {}).get("desde") or "")[:80]
    kc = Key("pk").eq("VONL") & Key("sk").gt(desde) if desde else Key("pk").eq("VONL")
    its = TABELA.query(KeyConditionExpression=kc, Limit=200).get("Items", [])
    vs = [{"id": x["ref"], "token": x["token"], "pids": json.loads(x["pids"]), "n": int(x["n"]), "total": float(x["pago"]),
           "esperado": float(x["total"]), "itens": json.loads(x["itens"]), "todas": bool(x.get("todas")), "sessoes": json.loads(x["sessoes"]),
           "idpedido": x.get("idpedido") or None, "meio": x.get("meio") or None, "em": x["sk"].split("#")[0], "metodo": "imply", "canal": "online"} for x in its]
    return resp({"vendas": vs, "next": its[-1]["sk"] if its else desde})


EMAIL_PAGO = {
    "pt": ("Suas fotos estão liberadas", "Recebemos o pagamento das suas fotos do Tour Maracanã. Abra a galeria para baixar:", "A galeria fica disponível até"),
    "en": ("Your photos are ready", "We received the payment for your Maracanã Tour photos. Open the gallery to download them:", "The gallery is available until"),
    "es": ("Tus fotos están liberadas", "Recibimos el pago de tus fotos del Tour Maracanã. Abre la galería para descargarlas:", "La galería está disponible hasta"),
}


def email_pago(it):
    if not MAIL_FROM:
        return
    m = manifesto(it["token"]) or {}
    assunto, txt, ate = EMAIL_PAGO.get(it.get("idioma"), EMAIL_PAGO["pt"])
    link = "https://eterna.photo/#g/" + it["token"]
    validade = str(m.get("expira") or "")[:10]
    try:
        _ses.send_email(FromEmailAddress="%s <%s>" % (MAIL_NOME, MAIL_FROM), Destination={"ToAddresses": [it["email"]]},
                        Content={"Simple": {"Subject": {"Data": "%s · %s" % (assunto, MAIL_NOME), "Charset": "UTF-8"},
                                            "Body": {"Text": {"Data": "%s\n\n%s\n\n%s %s" % (txt, link, ate, validade), "Charset": "UTF-8"}}}})
    except Exception as ex:
        print("pedido: e-mail de fotos liberadas falhou:", str(ex)[:160])


# ---------- rotas ----------
def ponto_ok(seg):
    h = hashlib.sha256(seg.encode()).hexdigest() if seg else ""
    return bool(h) and any(x and hmac.compare_digest(h, x) for x in (SEGREDO_PONTO_SHA256, SEGREDO_TESTE_SHA256))


# ---------- vídeo das ativações: o cartão com QR é a chave, sem selfie (o rosto não compara com vídeo) ----------
def publicar_video(m):
    vs = []
    for v in (m.get("videos") or [])[:5]:
        if not isinstance(v, dict) or not _re_token.match(str(v.get("id") or "")) or v.get("chave") != "video/%s.mp4" % v.get("id"):
            return resp({"error": "vídeo inválido"}, 400)
        vs.append({"id": v["id"], "chave": v["chave"], "bytes": max(0, int(v.get("bytes") or 0)),
                   "duracao": max(0.0, float(v.get("duracao") or 0)), "n": max(1, int(v.get("n") or 1))})
    if not vs:
        return resp({"error": "vídeo inválido"}, 400)
    velho = manifesto(m["token"])
    if velho and velho.get("tipo") != "video":            # cartão já usado numa galeria de fotos
        return resp({"error": "token já usado por outra sessão"}, 409)
    sv = str(m.get("servico") or "")
    novo = {"v": 1, "token": m["token"], "codigo": m.get("codigo") if _re_codigo.match(str(m.get("codigo") or "")) else None,
            "tipo": "video", "venue": str(m.get("venue") or "")[:40], "servico": sv if _re_servico.match(sv) else "",
            "idioma": str(m.get("idioma") or "")[:20], "criada": str(m.get("criada") or iso())[:40], "expira": str(m.get("expira") or "")[:40],
            "menor": False, "fotos": [], "precos": {"dig": 0.0, "todas": 0.0}, "catalogo": [], "videos": vs}
    t = m.get("tour")                                     # v99.22: as fotos do Tour achadas pela foto da venda (outra galeria)
    if isinstance(t, dict) and _re_token.match(str(t.get("token") or "")) and t.get("token") != m["token"]:
        try:
            novo["tour"] = {"token": t["token"], "n": max(0, min(500, int(t.get("n") or 0)))}
        except (TypeError, ValueError):
            pass
    if velho:                                             # validade nunca aumenta; encerrada não volta
        if velho.get("expira") and epoch(velho["expira"]) < epoch(novo["expira"]):
            novo["expira"] = velho["expira"]
        if velho.get("encerrada"):
            novo["encerrada"] = True
    if m.get("encerrada"):
        novo["encerrada"] = True
    ttl = ttl_de(novo)
    TABELA.update_item(Key={"pk": "GAL#" + novo["token"], "sk": "M"}, UpdateExpression="SET m = :m, #t = :t",
                       ExpressionAttributeNames={"#t": "ttl"}, ExpressionAttributeValues={":m": json.dumps(novo), ":t": ttl})
    if novo.get("encerrada"):
        if novo["codigo"]:
            codigo_solta(novo["codigo"], novo["token"])
        return resp({"ok": True, "token": novo["token"], "estado": "encerrada"})
    if novo["codigo"]:
        codigo_liga(novo["codigo"], novo["token"], ttl)
    return resp({"ok": True, "token": novo["token"], "estado": estado(novo)})


def video_obj(token, m, acesso):
    """Os vídeos do cartão: link para tocar (inline) e o endereço do Baixar, que passa por aqui para registrar o download."""
    vs = []
    for v in m["videos"]:
        ok = tem_s3(v["chave"])
        vs.append({"id": v["id"], "n": v["n"], "duracao": v["duracao"], "bytes": v["bytes"], "chegando": not ok,
                   "url": link(v["chave"], ttl=VIDEO_TTL) if ok else None,
                   "baixar": "/g/%s/baixar?v=%s&a=%s" % (token, v["id"], acesso) if ok else None})
    out = {"tipo": "video", "servico": m.get("servico") or "", "expira": m["expira"],
           "estado": "pronta" if any(not v["chegando"] for v in vs) else "chegando", "videos": vs}
    t = m.get("tour")
    if t and t.get("n"):
        g = manifesto(t["token"])
        if g and g.get("tipo") == "sessao" and not g.get("encerrada") and not expirou(g):
            out["tour"] = {"token": t["token"], "n": t["n"]}
            if g.get("origem") == "ativ" and g["fotos"]:
                out["tour"].update(tour_acesso(t["token"], g, acesso))
    return out


def tour_acesso(tok, g, acesso):
    """v99.23: a galeria do Tour de uma venda de ativação só tem as fotos em que o cliente é o rosto principal, achadas pela
    foto da venda com o aceite dele. Quem abriu o vídeo vê essas fotos ali mesmo, sem selfie: acesso próprio da galeria do Tour,
    o mesmo enquanto valer o do vídeo (HMAC), com todas as fotos de agora (a galeria só cresce)."""
    a = item("ACE#" + acesso) or {}
    exp = int(min(int(a.get("exp") or time.time() + ACESSO_TTL), epoch(g["expira"]) if g.get("expira") else time.time() + ACESSO_TTL))
    ta = "t" + hmac.new(SEGREDO_PONTO_SHA256.encode(), ("tour:%s:%s" % (acesso, tok)).encode(), hashlib.sha256).hexdigest()[:31]
    pids = sorted(f["id"] for f in g["fotos"])
    TABELA.put_item(Item={"pk": "ACE#" + ta, "sk": "M", "token": tok, "pids": json.dumps(pids), "exp": exp, "ttl": exp + 86400})
    return {"acesso": ta, "galeria": galeria_obj(tok, g, pids)}


def acesso_ok(token, a):
    it = item("ACE#" + str(a or "")) if a else None
    return bool(it) and it["token"] == token and int(it["exp"]) >= time.time()


def video_aceite(token, m, corpo, ip):
    if not contar("VID#" + ip_hash(ip), 60, 20):
        return resp({"motivo": "bloqueado"}, 429)
    if corpo.get("consentimento") is not True:
        return resp({"error": "consentimento obrigatório"}, 400)
    email = str(corpo.get("email") or "").strip().lower()[:254]
    if not _re_email.match(email):
        return resp({"error": "e-mail inválido", "campo": "email"}, 400)
    idioma, versao = str(corpo.get("idioma") or "pt")[:2], str(corpo.get("versao") or "")[:20]
    TABELA.put_item(Item={"pk": "CON#" + token, "sk": "%s#%s" % (iso(), secrets.token_hex(3)), "tipo": "video", "versao": versao,
                          "idioma": idioma, "ttl": int(time.time() + 400 * 86400)})
    lead(email, idioma, token, corpo.get("marketing") is True, versao)
    # o acesso vale enquanto a galeria valer: o aceite é uma vez por aparelho (o cartão continua sendo a chave)
    acesso = secrets.token_urlsafe(24)
    exp = int(max(time.time() + ACESSO_TTL, epoch(m["expira"])))
    TABELA.put_item(Item={"pk": "ACE#" + acesso, "sk": "M", "token": token, "pids": "[]", "exp": exp, "ttl": exp + 86400})
    evento(token, "video_aceite", ip, marketing=int(corpo.get("marketing") is True))
    return resp({"ok": True, "acesso": acesso, "exp": iso(exp), "galeria": video_obj(token, m, acesso)})


def video_baixar(token, m, q, ip):
    v = next((x for x in m["videos"] if x["id"] == str(q.get("v") or "")), None)
    if not v or not acesso_ok(token, q.get("a")):
        return resp({"error": "acesso inválido ou vencido"}, 401)
    if not contar("BXV#" + ip_hash(ip), 60, 20):
        return resp({"motivo": "bloqueado"}, 429)
    if not tem_s3(v["chave"]):
        return resp({"motivo": "chegando"}, 404)
    evento(token, "video_baixou", ip, v=v["id"])
    nome = "viva-maracana-%s%s.mp4" % (m.get("servico") or "video", "-%d" % v["n"] if len(m["videos"]) > 1 else "")
    return {"statusCode": 302, "headers": {"Location": link(v["chave"], nome, VIDEO_TTL), "Cache-Control": "no-store"}, "body": ""}


def eventos_ponto(ev):
    """O agente traz, para a tela de entrega, quando o cliente abriu o QR, aceitou, deu play e baixou (sem IP nem e-mail)."""
    if not ponto_ok((ev.get("headers") or {}).get("x-eterna-ponto", "")):
        return resp({"error": "não autorizado"}, 401)
    toks = [t for t in str((ev.get("queryStringParameters") or {}).get("tokens") or "").split(",") if _re_token.match(t)][:50]
    out = {}
    for t in toks:
        its = TABELA.query(KeyConditionExpression=Key("pk").eq("EVT#" + t), Limit=300).get("Items", [])
        out[t] = [{"tipo": x["tipo"], "em": x["sk"].split("#")[0]} for x in its if x.get("tipo") in VIDEO_EVENTOS]
    return resp({"eventos": out})


def publicar(ev, corpo):
    seg = (ev.get("headers") or {}).get("x-eterna-ponto", "")
    if not ponto_ok(seg):
        return resp({"error": "não autorizado"}, 401)
    m = corpo.get("manifesto")
    if not isinstance(m, dict) or not _re_token.match(str(m.get("token") or "")) or m.get("tipo") not in ("sessao", "evento", "video"):
        return resp({"error": "manifesto inválido"}, 400)
    if m["tipo"] == "video":
        return publicar_video(m)
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
            "precos": {"dig": max(0.0, float(pr.get("dig") or 0)), "todas": max(0.0, float(pr.get("todas") or 0))},
            "catalogo": catalogo_ok(m.get("catalogo")), "fotos": fotos}
    if m.get("origem") == "ativ":                         # v99.23: galeria do Tour montada pela foto da venda de uma ativação
        novo["origem"] = "ativ"
    velho = manifesto(m["token"])
    if velho and velho.get("tipo") == "video":            # cartão já ligado a um vídeo de ativação
        return resp({"error": "token já usado por outra sessão"}, 409)
    if velho:                                             # cartão com QR impresso já usado em outra venda: não troca de dono
        s_velho = {f.get("sessao") for f in velho["fotos"] if f.get("sessao")}
        s_novo = {f["sessao"] for f in novo["fotos"] if f["sessao"]}
        if s_velho and s_novo and not (s_velho & s_novo):
            return resp({"error": "token já usado por outra sessão"}, 409)
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
    # foto que saiu da galeria: os rostos lidos dela saem junto (a coleção se refaz na próxima selfie com consentimento)
    perdeu = bool(velho) and bool({f.get("id") for f in velho["fotos"]} - {f["id"] for f in novo["fotos"]})
    ttl = ttl_de(novo)
    TABELA.update_item(Key={"pk": "GAL#" + novo["token"], "sk": "M"}, UpdateExpression="SET m = :m, #t = :t",
                       ExpressionAttributeNames={"#t": "ttl"}, ExpressionAttributeValues={":m": json.dumps(novo), ":t": ttl})
    if novo.get("encerrada"):
        apagar_rostos(novo["token"])
        if novo["codigo"]:
            codigo_solta(novo["codigo"], novo["token"])
        return resp({"ok": True, "token": novo["token"], "estado": "encerrada"})
    if perdeu:
        apagar_rostos(novo["token"])
    if novo["codigo"]:
        codigo_liga(novo["codigo"], novo["token"], ttl)
    # os rostos não são lidos aqui: só depois do primeiro consentimento na galeria (rota /rosto)
    return resp({"ok": True, "token": novo["token"], "estado": estado(novo)})


def rosto(token, m, corpo, ip, ctx):
    if not contar("ROS#" + ip_hash(ip), 60, 10):
        return resp({"motivo": "bloqueado", "ate": iso(time.time() + 60)}, 429)
    if corpo.get("consentimento") is not True:
        return resp({"error": "consentimento obrigatório"}, 400)
    restam, ate = falhas(ip, token)
    teto = teto_galeria(token) if not ate and m["tipo"] == "sessao" else 0
    if ate or teto:                                      # v96.2: teto = parada até amanhã (o app diz "Tente de novo amanhã")
        return resp(dict({"motivo": "bloqueado", "ate": iso(ate or teto)}, **({"teto": True} if teto else {})), 429)
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
    if varias_pessoas(selfie):                          # não conta como tentativa: cada um tenta de novo, sozinho
        selfie = img = None
        evento(token, "selfie_varias_pessoas", ip)
        return resp({"ok": False, "motivo": "varias_pessoas"})
    sims = buscar(token, selfie)
    selfie = img = None
    if sims is None:
        restam, _ = falhas(ip, token, somar=True)
        evento(token, "selfie_sem_rosto", ip)
        return resp({"ok": False, "motivo": "sem_rosto", "restam": restam})
    lim = LIMIAR_CRIANCA if m["tipo"] == "evento" or m.get("menor") else LIMIAR_ADULTO
    pids = {f["id"] for f in m["fotos"] if sims.get(pid_lib(f["id"]), 0) >= lim}   # as fotos em que quem fez a selfie aparece
    if not pids and leitura != "ok":
        evento(token, "selfie_processando", ip)          # leitura incompleta: não conta como erro
        return resp({"ok": False, "motivo": "processando"}, 503)
    if not pids:                                         # as compradas e cortesias da venda continuam abertas pelo QR (rota livres)
        if m["tipo"] == "sessao":
            teto_soma(token, ip)
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
    evento(token, "selfie_ok", ip, fotos=len(pids), livres=len(livres(m) - pids))   # livres: compradas e cortesias sem o rosto, abertas junto
    return resp({"ok": True, "acesso": acesso, "exp": iso(exp), "galeria": galeria_obj(token, m, pids)})


def handler(ev, ctx):
    if ev.get("limpeza"):                                 # agendada, uma vez por dia
        return limpeza()
    if ev.get("conferir"):                                # agendada: pedidos online ainda sem resposta da Imply
        return conferir_pendentes()
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
    if caminho == "/auth/senha-email" and metodo == "POST":
        return senha_email(ev, corpo)
    if caminho == "/ponto/vendas-online" and metodo == "GET":
        return vendas_online(ev)
    if caminho == "/ponto/eventos" and metodo == "GET":
        return eventos_ponto(ev)
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
    if len(partes) == 4 and partes[1] == "g" and partes[2] == "pedido" and metodo == "GET":
        return pedido_volta(partes[3].upper(), ip)
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
        if m["tipo"] == "video":
            return resp({"ok": True, "tipo": "video", "menor": False, "expira": m["expira"], "estado": estado(m), "venue": m.get("venue"),
                         "servico": m.get("servico") or "", "idioma": m.get("idioma") or "", "compra": False})
        return resp({"ok": True, "tipo": m["tipo"], "menor": bool(m.get("menor")), "expira": m["expira"],
                     "estado": estado(m), "venue": m.get("venue"), "compra": compra_ligada(m)})
    if m["tipo"] == "video":                              # vídeo: aceite, play, baixar e renovar os links; nada de selfie nem compra
        if acao == "video" and metodo == "POST":
            return video_aceite(token, m, corpo, ip)
        if acao == "baixar" and metodo == "GET":
            return video_baixar(token, m, ev.get("queryStringParameters") or {}, ip)
        if acao in ("galeria", "evento") and metodo == "POST":
            if not acesso_ok(token, corpo.get("acesso")):
                return resp({"error": "acesso inválido ou vencido"}, 401)
            if acao == "galeria":
                return resp({"galeria": video_obj(token, m, corpo["acesso"])})
            if corpo.get("tipo") != "video_play" or not contar("EVP#" + token, 60, 10):
                return resp({"ok": False}, 400 if corpo.get("tipo") != "video_play" else 429)
            v = next((x["id"] for x in m["videos"] if x["id"] == str(corpo.get("v") or "")), None)
            evento(token, "video_play", ip, v=v)
            return resp({"ok": True})
        return resp({"error": "not found"}, 404)
    if acao == "livres" and metodo == "GET":              # v96.1: compradas e cortesias da venda só pelo QR
        if not contar("LIV#" + ip_hash(ip), 60, 30):
            return resp({"motivo": "bloqueado"}, 429)
        g = galeria_obj(token, m)
        if g["fotos"]:
            evento(token, "livres_vistas", ip, livres=len(g["fotos"]))
        return resp({"galeria": g})
    if acao == "rosto" and metodo == "POST":
        return rosto(token, m, corpo, ip, ctx)
    if acao in ("galeria", "pagamento", "pedido") and metodo == "POST":
        a = item("ACE#" + str(corpo.get("acesso") or "")) if corpo.get("acesso") else None
        if not a or a["token"] != token or int(a["exp"]) < time.time():
            return resp({"error": "acesso inválido ou vencido"}, 401)
        pids = set(json.loads(a["pids"]))
        if acao == "galeria":
            evento(token, "galeria_vista", ip)
            return resp({"galeria": galeria_obj(token, m, pids)})
        if acao == "pedido":
            return pedido(token, m, corpo, ip, pids)
        # compra online desligada: por ora a venda é só no balcão, na maquininha Imply
        evento(token, "compra_tentada", ip)
        return resp({"ok": False, "motivo": "compra_indisponivel",
                     "mensagem": "A compra online ainda não está disponível. Fale com a equipe do Tour."}, 503)
    return resp({"error": "not found"}, 404)
