"""Eterna · compra online pela Imply (Eleven Tickets), plano docs/planos/2026-11-11-compra-online-pela-imply.md.

Só a Nuvem fala com a Imply: a chave do usuário de serviço fica num parâmetro SecureString do SSM (IMPLY_CHAVE_SSM) e
nunca vai ao navegador nem ao repositório. Contrato: documentação "Integração Eleven Tickets – setPessoa" da Imply (P&D,
versão de 18/11/2026). Três chamadas:
  set_pessoa(...)       POST <admin>/api/OAuth2/v01/setPessoa/ com o carrinho em informacoes_extras.predefined-cart
                        (idreferencia = o nosso código do pedido) -> token de login da pessoa
  checkout(...)         <admin>/OAuth2/external?token=..&url=<Base64 de <loja>/pt/checkout?urlreturncheckout=<volta?idpedido=ref>>
  situacao(ref)         consulta do pedido pelo nosso código -> pago | pendente | cancelado | desconhecido

A consulta (seção 7 da documentação da Imply) ainda não veio: o endereço fica em IMPLY_CONSULTA, para ajustar sem mexer no
código quando chegar. Sem ela nenhum pedido é liberado.
"""
import base64, hashlib, hmac, json, os, re, urllib.parse, urllib.request

ADMIN = os.environ.get("IMPLY_ADMIN", "https://maracanatouradmin.eleventickets.com").rstrip("/")
LOJA = os.environ.get("IMPLY_LOJA", "https://maracanatour.eleventickets.com").rstrip("/")
# 18/11 (documentação da Imply): comprador de fotos é Público Geral (PG) = 100001; o código de AGÊNCIA não é para foto
TIPO_PESSOA = os.environ.get("IMPLY_TIPO_PESSOA") or "100001"
CHAVE_SSM = os.environ.get("IMPLY_CHAVE_SSM", "")              # nome do parâmetro SecureString com a chave
# o produto vai pelo idproduto (o SKU do catálogo do Eterna) ou pelo depara de pdv_produto, se a Imply passar a lista de depara
PRODUTO_CAMPO = os.environ.get("IMPLY_PRODUTO_CAMPO") or "idproduto"
CONSULTA = os.environ.get("IMPLY_CONSULTA", "")                 # ex.: https://.../api/pedido?referencia={ref}
PAGO = {x.strip().lower() for x in os.environ.get("IMPLY_PAGO", "pago,aprovado,paid,approved,confirmado,finalizado").split(",") if x.strip()}
CANCELADO = {x.strip().lower() for x in os.environ.get("IMPLY_CANCELADO", "cancelado,estornado,recusado,expirado,canceled,cancelled,refunded,denied,expired").split(",") if x.strip()}
TIMEOUT = 12
_chave = {}


class ImplyErro(Exception):
    pass


def ligada():
    return bool(CHAVE_SSM and TIPO_PESSOA)


def carrinho(ref, itens):
    """predefined-cart (seção 3.3): a referência é o nosso código do pedido, gravada na Imply em pdv_produto_mov.idreferencia."""
    campo = "depara" if PRODUTO_CAMPO == "depara" else "idproduto"
    return {"idreferencia": ref, "itens": [{campo: i["sku"], "quantidade": int(i["qtd"])} for i in itens]}


def chave():
    if "v" not in _chave:
        import boto3
        _chave["v"] = boto3.client("ssm").get_parameter(Name=CHAVE_SSM, WithDecryption=True)["Parameter"]["Value"].strip()
    return _chave["v"]


def _http(metodo, url, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    rq = urllib.request.Request(url, data=dados, method=metodo, headers={"Authorization": "Server " + chave(), "Content-Type": "application/json",
                                                                         "Accept": "application/json", "User-Agent": "eterna-galeria"})
    with urllib.request.urlopen(rq, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf8") or "null")


def cpf_ok(cpf):
    d = re.sub(r"\D", "", cpf or "")
    if len(d) != 11 or d == d[0] * 11:
        return False
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10 % 11) % 10 != int(d[n]):
            return False
    return True


def de_para(email, segredo):
    """Nosso identificador da pessoa na Imply: o mesmo para o mesmo e-mail, sem guardar tabela (HMAC)."""
    return "EP-" + hmac.new(segredo.encode(), email.lower().encode(), hashlib.sha256).hexdigest()[:20]


def set_pessoa(id_pessoa, nome, email, cpf=None, passaporte=None, ref=None, itens=None):
    """Cria/atualiza a pessoa (localizada pelo de_para) e, com ref e itens, monta o carrinho dela. Devolve o token de login."""
    p = {"de_para": id_pessoa, "tipo_pessoa": TIPO_PESSOA, "nome": nome, "email": email}
    if cpf:
        p["cpf"] = re.sub(r"\D", "", cpf)
    elif passaporte:
        p["passaporte"] = passaporte
    if ref and itens:
        p["informacoes_extras"] = {"predefined-cart": carrinho(ref, itens)}   # objeto; nunca string vazia (invalida a chamada)
    j = _http("POST", ADMIN + "/api/OAuth2/v01/setPessoa/", [p, False, ["de_para"]])
    if isinstance(j, dict) and j.get("result") and not j.get("error"):
        return str(j["result"])
    erro = (j or {}).get("error") if isinstance(j, dict) else None
    raise ImplyErro("setPessoa: %s" % (json.dumps(erro)[:160] if erro else "sem token"))


def checkout(token_pessoa, ref, volta):
    """Login automático na Imply que cai no checkout (o carrinho já foi montado no set_pessoa) e volta para `volta?idpedido=<ref>`.
    Seção 6.2: urlreturncheckout vai com URL-encode; o checkout inteiro vai em Base64 e depois URL-encode no parâmetro url."""
    volta_ped = volta + ("&" if "?" in volta else "?") + urllib.parse.urlencode({"idpedido": ref})
    destino = "%s/pt/checkout?urlreturncheckout=%s" % (LOJA, urllib.parse.quote(volta_ped, safe=""))
    url64 = base64.b64encode(destino.encode()).decode()
    return "%s/OAuth2/external?token=%s&url=%s" % (ADMIN, urllib.parse.quote(token_pessoa, safe=""), urllib.parse.quote(url64, safe=""))


def _acha(j, chaves):
    if isinstance(j, dict):
        for k, v in j.items():
            if k.lower() in chaves and isinstance(v, (str, int, float)):
                return v
        for v in j.values():
            r = _acha(v, chaves)
            if r is not None:
                return r
    if isinstance(j, list):
        for v in j:
            r = _acha(v, chaves)
            if r is not None:
                return r
    return None


def situacao(ref):
    """Consulta o pedido pelo nosso código. Devolve (situação, detalhes): pago | pendente | cancelado | desconhecido."""
    if not CONSULTA:
        return "desconhecido", {}
    j = _http("GET", CONSULTA.replace("{ref}", urllib.parse.quote(ref)))
    st = str(_acha(j, {"situacao", "status", "estado", "situacaopedido", "statuspedido"}) or "").strip().lower()
    det = {"idpedido": _acha(j, {"idpedido", "pedido", "numero", "numeropedido"}), "valor": _acha(j, {"valor", "valortotal", "total"}),
           "meio": _acha(j, {"formapagamento", "meio", "pagamento", "meiopagamento"}), "bruto": st}
    if st in PAGO:
        return "pago", det
    if st in CANCELADO:
        return "cancelado", det
    return "pendente", det
