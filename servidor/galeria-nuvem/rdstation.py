# 25/11 (Ronaldo): leads da galeria online no RD Station Marketing. Só quem marcou "quero receber novidades e ofertas"
# (consentimento de marketing, LGPD) vai para o RD, com a base legal de consentimento. O cliente nunca espera pelo RD:
# app.lead() põe o e-mail numa fila (pk RDPEND) e a rotina de 5 em 5 minutos envia; erro tenta de novo depois.
# Chave: parâmetro SecureString do SSM (RD_CHAVE_PARAMETRO, ex. /eterna/rdstation-chave), lido só aqui e só em memória.
# A API de conversões do RD recebe a chave na URL (?api_key=), então nenhuma mensagem deste módulo imprime a URL nem o erro
# bruto da biblioteca: só o código HTTP. Documentação: developers.rdstation.com/reference/conversao.
import json, os, urllib.error, urllib.parse, urllib.request

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
