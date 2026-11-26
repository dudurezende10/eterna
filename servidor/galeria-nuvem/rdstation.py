# 25/11 (Ronaldo): leads da galeria online no RD Station Marketing. Só quem marcou "quero receber novidades e ofertas"
# (consentimento de marketing, LGPD) vai para o RD, com a base legal de consentimento. O cliente nunca espera pelo RD:
# app.lead() põe o e-mail numa fila (pk RDPEND) e a rotina de 5 em 5 minutos envia; erro tenta de novo depois.
# Chave: parâmetro SecureString do SSM (RD_CHAVE_PARAMETRO, ex. /eterna/rdstation-chave), lido só aqui e só em memória.
# A API de conversões do RD recebe a chave na URL (?api_key=), então nenhuma mensagem deste módulo imprime a URL nem o erro
# bruto da biblioteca: só o código HTTP. Documentação: developers.rdstation.com/reference/conversao.
import hmac, json, os, time, urllib.error, urllib.parse, urllib.request

CHAVE_SSM = os.environ.get("RD_CHAVE_PARAMETRO", "").strip()
URL = "https://api.rd.services/platform/conversions"
TIMEOUT = 6
_chave = {}

# o nome da conversão no RD diz de onde veio o lead
CONVERSAO = {"compra": "Eterna - compra de fotos online", "video": "Eterna - video da ativacao", "cortesia": "Eterna - foto cortesia escola",
             "selfie": "Eterna - galeria de fotos (selfie)"}


class RdErro(Exception):
    """Falha no envio, sem a URL (que leva a chave): só o código HTTP ou o tipo do erro."""


def ligada():
    return bool(CHAVE_SSM)


def chave():
    if "v" not in _chave:
        import boto3
        _chave["v"] = boto3.client("ssm").get_parameter(Name=CHAVE_SSM, WithDecryption=True)["Parameter"]["Value"].strip()
    return _chave["v"]


def corpo(email, idioma, origem):
    """Evento de conversão: e-mail, idioma em tag e o consentimento de comunicação. Nada de nome, CPF ou foto."""
    return {"event_type": "CONVERSION", "event_family": "CDP",
            "payload": {"conversion_identifier": CONVERSAO.get(origem, CONVERSAO["selfie"]), "email": email,
                        "tags": ["eterna", "tour-maracana", "eterna-" + origem, "idioma-" + (idioma or "pt")],
                        "available_for_mailing": True,
                        "legal_bases": [{"category": "communications", "type": "consent", "status": "granted"}]}}


def _http(dados):
    url = URL + "?" + urllib.parse.urlencode({"api_key": chave()})
    rq = urllib.request.Request(url, data=json.dumps(dados).encode(), method="POST",
                                headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "eterna-galeria"})
    try:
        with urllib.request.urlopen(rq, timeout=TIMEOUT) as r:
            return r.status
    except urllib.error.HTTPError as ex:
        raise RdErro("http %d" % ex.code) from None
    except Exception as ex:
        raise RdErro(type(ex).__name__) from None


def enviar(email, idioma, origem):
    st = _http(corpo(email, idioma, origem))
    if st not in (200, 201, 202):
        raise RdErro("http %d" % st)


# 26/11 (Ronaldo): saber se o lead é novo no RD ou se o contato já existia. A conversão não diz (responde só o event_uuid), então
# antes do primeiro envio de cada lead a nuvem consulta o contato pelo e-mail (GET /platform/contacts/email:<e-mail>; 200 = já
# existia, 404 = novo). Essa consulta só aceita OAuth: aplicativo privado "Eterna" no App Publisher do RD. O client_id e o
# client_secret ficam num SecureString do SSM (RD_APP_PARAMETRO, JSON {"client_id", "client_secret"}); o refresh_token, que não
# vence, em outro (RD_REFRESH_PARAMETRO), gravado pela própria nuvem em /rd/callback. O access_token (24 h) fica só em memória.
# A autorização só vale com o "state" que o dono da conta AWS grava antes no SSM (RD_ESTADO_PARAMETRO): sem ele ninguém troca o
# acesso por outro RD. Sem OAuth, o envio segue igual e o lead fica sem a marca de novo/existente.
APP_SSM = os.environ.get("RD_APP_PARAMETRO", "").strip()
REFRESH_SSM = os.environ.get("RD_REFRESH_PARAMETRO", "").strip()
ESTADO_SSM = os.environ.get("RD_ESTADO_PARAMETRO", "").strip()
API = "https://api.rd.services"
CALLBACK = os.environ.get("RD_CALLBACK", "https://dxsulr2e9z91t.cloudfront.net/rd/callback")
_oauth = {}


def _ssm():
    import boto3
    return boto3.client("ssm")


def _ler(nome):
    try:
        return _ssm().get_parameter(Name=nome, WithDecryption=True)["Parameter"]["Value"].strip()
    except Exception as ex:
        if type(ex).__name__ == "ParameterNotFound" or "ParameterNotFound" in str(ex):
            return ""
        raise


def _app():
    if "app" not in _oauth:
        v = json.loads(_ler(APP_SSM) or "{}")
        _oauth["app"] = (str(v.get("client_id") or "").strip(), str(v.get("client_secret") or "").strip())
    return _oauth["app"]


def _json(metodo, caminho, dados=None, bearer=None):
    """(status, corpo) de uma chamada à API do RD. Erro de rede vira RdErro com o tipo só; nada de URL nem corpo no erro."""
    hs = {"Accept": "application/json", "User-Agent": "eterna-galeria"}
    if dados is not None:
        hs["Content-Type"] = "application/json"
    if bearer:
        hs["Authorization"] = "Bearer " + bearer
    rq = urllib.request.Request(API + caminho, data=json.dumps(dados).encode() if dados is not None else None, method=metodo, headers=hs)
    try:
        with urllib.request.urlopen(rq, timeout=TIMEOUT) as r:
            return r.status, json.loads(r.read(200000) or b"{}")
    except urllib.error.HTTPError as ex:
        try:
            corpo = json.loads(ex.read(20000) or b"{}")
        except Exception:
            corpo = {}
        return ex.code, corpo
    except Exception as ex:
        raise RdErro(type(ex).__name__) from None


def oauth_ligado():
    return bool(APP_SSM and REFRESH_SSM)


def conectar(code, estado):
    """Volta da autorização no RD: confere o state gravado no SSM, troca o code pelos tokens e guarda o refresh_token.
    Devolve "" se deu certo ou o motivo (sem segredo nenhum)."""
    if not (APP_SSM and REFRESH_SSM and ESTADO_SSM):
        return "desligado"
    esperado = _ler(ESTADO_SSM)
    if not esperado or esperado == "usado" or not estado or not hmac.compare_digest(esperado, str(estado)):
        return "state"
    cid, seg = _app()
    if not (cid and seg):
        return "sem_app"
    st, c = _json("POST", "/auth/token?token_by=code", {"client_id": cid, "client_secret": seg, "code": str(code or "")})
    if st != 200 or not c.get("refresh_token"):
        e = c.get("errors") if isinstance(c.get("errors"), dict) else c
        return "token %d %s" % (st, str(e.get("error_type") or "")[:40])
    s = _ssm()
    s.put_parameter(Name=REFRESH_SSM, Value=c["refresh_token"], Type="SecureString", Overwrite=True)
    s.put_parameter(Name=ESTADO_SSM, Value="usado", Type="SecureString", Overwrite=True)
    _oauth["tok"] = (c.get("access_token") or "", time.time() + int(c.get("expires_in") or 86400) - 600)
    _oauth["refresh"] = c["refresh_token"]
    return ""


def _token():
    t = _oauth.get("tok")
    if t and t[0] and t[1] > time.time():
        return t[0]
    rt = _oauth.get("refresh") or _ler(REFRESH_SSM)
    if not rt:
        raise RdErro("sem_autorizacao")
    cid, seg = _app()
    st, c = _json("POST", "/auth/token", {"client_id": cid, "client_secret": seg, "refresh_token": rt})
    if st != 200 or not c.get("access_token"):
        _oauth.pop("refresh", None)
        _oauth.pop("app", None)
        raise RdErro("token %d" % st)
    if c.get("refresh_token") and c["refresh_token"] != rt:      # se o RD trocar o refresh_token, guarda o novo
        _ssm().put_parameter(Name=REFRESH_SSM, Value=c["refresh_token"], Type="SecureString", Overwrite=True)
        rt = c["refresh_token"]
    _oauth["refresh"] = rt
    _oauth["tok"] = (c["access_token"], time.time() + int(c.get("expires_in") or 86400) - 600)
    return c["access_token"]


def contato_existe(email):
    """True se o contato já está no RD, False se não está. Erro: RdErro (o lead segue para o envio sem a marca)."""
    for tentativa in (1, 2):
        st, _ = _json("GET", "/platform/contacts/email:" + urllib.parse.quote(email, safe="@"), bearer=_token())
        if st == 200:
            return True
        if st == 404:
            return False
        if st == 401 and tentativa == 1:
            _oauth.pop("tok", None)
            continue
        raise RdErro("contato %d" % st)
