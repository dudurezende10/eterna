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


# 24/11 (log da 1ª compra real): o result do GetCart veio como objeto, não como lista. Aceita lista de pedidos, um pedido
# sozinho, a lista dentro de uma chave do objeto ou um objeto de pedidos por id. O mesmo vale para pag e itens.
_CAMPOS_PEDIDO = ("idmovimentacao", "idreferencia", "localizador", "pag", "itens")


def _dicts(x):
    if isinstance(x, list):
        return [p for p in x if isinstance(p, dict)]
    if isinstance(x, dict):
        if any(k in x for k in _CAMPOS_PEDIDO):
            return [x]
        listas = [v for v in x.values() if isinstance(v, list) and any(isinstance(p, dict) for p in v)]
        if listas:
            return [p for v in listas for p in v if isinstance(p, dict)]
        if "status" in x:
            return [x]
        return [v for v in x.values() if isinstance(v, dict)]
    return []


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
    # 24/11 (log real): o result é uma página {total_pages, total_results, current_page, page_summary, tickets}; cada ticket é
    # um item do pedido, com o próprio status. O formato da seção 7 (pedido com pag e itens) continua aceito.
    if isinstance(j, dict) and isinstance(j.get("tickets"), list):
        lista = _dicts(j["tickets"])
    else:
        lista = _dicts(j)
    # 24/11 (1º teste real, "sem pedido" com o PIX pago): a referência é procurada em idreferencia e, se não vier aí, em qualquer
    # campo do pedido com o valor exato do nosso código (o nome do campo na resposta não estava na seção 7)
    peds = [p for p in lista if str(p.get("idreferencia") or "") == ref] or [p for p in lista if any(str(v) == ref for v in p.values())
            or any(any(str(v) == ref for v in i.values()) for i in _dicts(p.get("itens")))]
    if not peds:
        # sem dado de pessoa no log: só o formato da resposta (tipo, quantos pedidos e os nomes dos campos do primeiro)
        forma = "%s, %d pedidos, campos: %s" % (type(j).__name__, len(lista), ",".join(sorted(lista[0].keys()))[:300] if lista else "-")
        if isinstance(j, dict):
            forma += "; chaves do result: " + ",".join("%s=%s" % (k[:30], type(v).__name__) for k, v in list(j.items())[:12])[:300]
        it0 = _dicts(lista[0].get("itens")) if lista else []
        if it0:
            forma += "; campos do item: " + ",".join(sorted(it0[0].keys()))[:300]
        print("GetCart %s: sem pedido com a referência (%s)" % (ref, forma))
        return "pendente", {"bruto": ("sem pedido (%d na resposta)" % len(lista))[:60]}
    if not any("itens" in p or "pag" in p for p in peds):
        return _situacao_tickets(ref, peds)
    for p in peds:
        itens = _dicts(p.get("itens"))
        pags = [_st(x) for x in _dicts(p.get("pag"))]
        if itens and "PA" in pags and all(_st(i) == "PA" for i in itens):
            valor = round(sum(float(i.get("valor") or 0) for i in itens), 2)
            return "pago", {"idpedido": p.get("localizador") or p.get("idmovimentacao"), "valor": valor, "meio": None,
                            "bruto": "PA %d itens" % len(itens)}
    todos = [_st(i) for p in peds for i in _dicts(p.get("itens"))]
    bruto = ",".join(sorted(set(todos)))[:60] or "sem itens"
    if todos and all(t in ST_FIM for t in todos):
        return "cancelado", {"idpedido": peds[0].get("localizador") or peds[0].get("idmovimentacao"), "bruto": bruto}
    return "pendente", {"bruto": bruto}


def _valor_tickets(ts):
    """Soma o valor dos tickets pelo primeiro campo de valor que todos tenham; sem campo de valor, None."""
    for campo in ("valor_pago", "valor", "total", "subtotal"):
        try:
            if all(t.get(campo) not in (None, "") for t in ts):
                return round(sum(float(t[campo]) for t in ts), 2)
        except (TypeError, ValueError):
            continue
    return None


def _situacao_tickets(ref, ts):
    """Tickets da referência (formato real do GetCart): pago se todos PA; cancelado se todos CA/EX/PC. Log só com os nomes
    dos campos (sem valores, sem dado de pessoa)."""
    sts = [_st(t) for t in ts]
    loc = next((str(t.get(k)) for t in ts for k in ("localizador", "idmovimentacao", "idpurchase") if t.get(k)), None)
    # nomes dos campos de situação e valor (a lista inteira passa de 60 campos e cortava antes deles)
    campos = ",".join(k for k in sorted(ts[0].keys()) if any(x in k for x in ("status", "valor", "total", "pago", "localizador")))[:400]
    if sts and all(x == "PA" for x in sts):
        print("GetCart %s: pago, %d tickets (campos: %s)" % (ref, len(ts), campos))
        return "pago", {"idpedido": loc, "valor": _valor_tickets(ts), "meio": None, "bruto": "PA %d tickets" % len(ts)}
    bruto = ",".join(sorted(set(sts)))[:60] or "sem status"
    print("GetCart %s: tickets %s (campos: %s)" % (ref, bruto, campos))
    if sts and all(x in ST_FIM for x in sts):
        return "cancelado", {"idpedido": loc, "bruto": bruto}
    return "pendente", {"bruto": bruto}
