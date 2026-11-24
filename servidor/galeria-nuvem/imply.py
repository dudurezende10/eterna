"""Eterna · compra online pela Imply (Eleven Tickets), plano docs/planos/2026-11-11-compra-online-pela-imply.md.

Só a Nuvem fala com a Imply: a chave do usuário de serviço fica num parâmetro SecureString do SSM (IMPLY_CHAVE_SSM) e
nunca vai ao navegador nem ao repositório. Contrato: documentação "Integração Eleven Tickets – setPessoa" da Imply (P&D,
versão de 18/11/2026, com a seção 7 recebida em 23/11). Três chamadas:
  set_pessoa(...)       POST <admin>/api/OAuth2/v01/setPessoa/ com o carrinho em informacoes_extras.predefined-cart
                        (idreferencia = o nosso código do pedido) -> token de login da pessoa
  checkout(...)         <admin>/OAuth2/external?token=..&url=<Base64 de <loja>/pt/checkout?urlreturncheckout=<volta?idpedido=ref>>
  situacao(ref)         POST <admin>/api/SuperIngressoV02/v01/GetCart/ pelo idreferencia (seção 7) -> pago | pendente | cancelado
                        A volta do checkout (urlreturncheckout) só leva o cliente de volta: nunca libera nada sozinha.
"""
import base64, hashlib, hmac, json, os, re, urllib.parse, urllib.request

ADMIN = os.environ.get("IMPLY_ADMIN", "https://maracanatouradmin.eleventickets.com").rstrip("/")
LOJA = os.environ.get("IMPLY_LOJA", "https://maracanatour.eleventickets.com").rstrip("/")
# 18/11 (documentação da Imply): comprador de fotos é Público Geral (PG) = 100001; o código de AGÊNCIA não é para foto
TIPO_PESSOA = os.environ.get("IMPLY_TIPO_PESSOA") or "100001"
CHAVE_SSM = os.environ.get("IMPLY_CHAVE_SSM", "")              # nome do parâmetro SecureString com a chave
# o produto vai pelo idproduto (o SKU do catálogo do Eterna) ou pelo depara de pdv_produto, se a Imply passar a lista de depara
PRODUTO_CAMPO = os.environ.get("IMPLY_PRODUTO_CAMPO") or "idproduto"
# seção 7 (23/11): GetCart, mesma chave (Authorization: Server). Corpo na ordem: idpessoa, status, idpurchase, page,
# results_per_page, date_start, date_end, idreferencia. Status: RE reservado, PA pago, CA cancelado, EX expirado,
# PC pendente de cancelamento (AP e TP: não pagos ainda).
CONSULTA = os.environ.get("IMPLY_CONSULTA") or ADMIN + "/api/SuperIngressoV02/v01/GetCart/"
ST_PEDIDO = "PA;RE;CA;AP;TP;PC;EX"
ST_FIM = {"CA", "EX", "PC"}
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


def _st(x):
    return str((x or {}).get("status") or "").strip().upper()


def situacao(ref):
    """Consulta o pedido pelo nosso código no GetCart. Devolve (situação, detalhes): pago | pendente | cancelado.
    Pago = um pedido com esta referência com o pagamento PA e todos os itens PA; o valor é a soma dos itens (o app confere
    com o total do nosso pedido). Cancelado = todos os pedidos da referência com todos os itens em CA, EX ou PC.
    Sem pedido ([]) = o cliente ainda não fechou: pendente (expira em 24 h sem liberar)."""
    j = _http("POST", CONSULTA, ["", ST_PEDIDO, "", 1, 100, "-2 months", "now", ref])
    if isinstance(j, dict):
        if j.get("error"):
            raise ImplyErro("GetCart: %s" % json.dumps(j["error"])[:160])
        j = j.get("result")
    peds = [p for p in (j or []) if isinstance(p, dict) and str(p.get("idreferencia") or "") == ref] if isinstance(j, list) else []
    if not peds:
        return "pendente", {"bruto": "sem pedido"}
    for p in peds:
        itens = [i for i in (p.get("itens") or []) if isinstance(i, dict)]
        pags = [_st(x) for x in (p.get("pag") or []) if isinstance(x, dict)]
        if itens and "PA" in pags and all(_st(i) == "PA" for i in itens):
            valor = round(sum(float(i.get("valor") or 0) for i in itens), 2)
            return "pago", {"idpedido": p.get("localizador") or p.get("idmovimentacao"), "valor": valor, "meio": None,
                            "bruto": "PA %d itens" % len(itens)}
    todos = [_st(i) for p in peds for i in (p.get("itens") or []) if isinstance(i, dict)]
    bruto = ",".join(sorted(set(todos)))[:60] or "sem itens"
    if todos and all(t in ST_FIM for t in todos):
        return "cancelado", {"idpedido": peds[0].get("localizador") or peds[0].get("idmovimentacao"), "bruto": bruto}
    return "pendente", {"bruto": bruto}
