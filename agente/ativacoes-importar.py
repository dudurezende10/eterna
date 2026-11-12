# Importa no servidor do ponto as vendas de Drone, Chute a Gol e Snap Pop do sistema antigo, até ele ser desligado
# (plano docs/planos/2026-11-11-ativacoes-venda-e-entrega.md, seção 6). Roda no próprio servidor, com o mesmo HOME do agente.
#
#   python3 -I agente/ativacoes-importar.py <arquivo>... [--vendedores <lista>] [--agente agente/eterna-agente.py] [--simular]
#
# Arquivos aceitos:
#   .csv  exportação do sistema antigo (separador ";"), uma tabela ou seções "##chute_gol" e "##snap_pop"
#   .json extração diária das telas de venda ({dados:[{tipo, dia, head, rows:[{attrs:{saleId}, cells:[{txt}]}]}]})
# --vendedores: arquivo com linhas "tablet 03 - nome.sobrenome", para trocar "Vendedor03" pelo nome. Fica fora do repositório.
#
# Nome, WhatsApp e foto do cliente são lidos do arquivo e descartados aqui: nunca chegam ao banco.
import csv, importlib.util, io, json, os, re, sys
from datetime import datetime

TIPOS = {"drone": "drone", "chute-gol": "chute", "chute_gol": "chute", "snap-pop": "snap", "snap_pop": "snap"}
LOCAIS = {"campo": "Campo", "arquibancada": "Arquibancada", "banco": "Banco de Suplentes"}
PAGAMENTOS = (("PIX", "PIX"), ("DÉB", "Débito"), ("DEB", "Débito"), ("CRÉD", "Crédito"), ("CRED", "Crédito"), ("DINHEIRO", "Dinheiro"), ("CORTESIA", "Cortesia"))
VAZIO = ("", "-", "—", "None", "null")
IDIOMAS = {"english": "Inglês", "ingles": "Inglês", "español": "Espanhol", "espanol": "Espanhol", "français": "Francês", "frances": "Francês",
           "deutsch": "Alemão", "alemao": "Alemão", "portugues": "Português", "italian": "Italiano"}


def txt(v, n=80):
    v = re.sub(r"\s+", " ", str(v or "")).strip()
    v = v.replace("<", "").replace(">", "")
    return "" if v in VAZIO else v[:n]


def inteiro(v):
    m = re.search(r"\d+", str(v or ""))
    return int(m.group(0)) if m else None


def reais(v):
    m = re.search(r"([\d.]+,\d{2})", str(v or ""))
    return round(float(m.group(1).replace(".", "").replace(",", ".")), 2) if m else 0.0


def quando(v):
    v = str(v or "").strip()
    for f in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(v, f)
        except ValueError:
            pass
    return None


def pagamento(v, valor):
    if valor == 0:                      # venda de R$ 0 é cortesia (o sistema antigo não tem a forma "Cortesia")
        return "Cortesia"
    t = str(v or "").upper().replace("ABRIR PAGAMENTO", "")
    for k, nome in PAGAMENTOS:
        if k in t:
            return nome
    return "Cortesia" if valor == 0 else txt(t.title(), 30)


def itens(tipo, v):
    """'1x asteroid_campo' / '1x 3 Chutes\\n1x Medalha avulsa' / '1x 3 Chutes 1x 5 Chutes' -> [{produto, op, qtd}]"""
    out = []
    for qtd, nome in re.findall(r"(\d+)\s*x\s+(.+?)(?=\s+\d+\s*x\s+|\n|$)", str(v or "")):
        nome = nome.strip()
        op = ""
        if tipo == "drone":
            m = re.fullmatch(r"([a-z_]+?)_(campo|arquibancada|banco)", nome)
            if m:
                nome, op = m.group(1), LOCAIS[m.group(2)]
        elif tipo == "snap" and nome.upper() in ("BRA", "FLA", "FLU"):
            nome, op = "Vídeo com IA", {"BRA": "Brasil", "FLA": "Flamengo", "FLU": "Fluminense"}[nome.upper()]
        out.append({"produto": txt(nome, 60), "op": op, "qtd": int(qtd)})
    return out[:30]


def idioma(v):
    t = txt(re.sub(r"[^\w\s-]", "", str(v or ""), flags=re.UNICODE), 30)
    return IDIOMAS.get(t.lower(), IDIOMAS.get(t.lower().replace("ê", "e").replace("ã", "a"), t))


def ler_vendedores(caminho):
    m = {}
    if caminho:
        for linha in open(caminho, encoding="utf-8"):
            r = re.search(r"tablet\s*0*(\d+)\s*-\s*([a-z0-9._-]+)", linha, re.I) or re.match(r"\|\s*0*(\d+)\s*\|\s*([a-z0-9_-]+\.[a-z0-9._-]+)\s*\|", linha, re.I)
            if r:
                m[int(r.group(1))] = " ".join(p.capitalize() for p in r.group(2).split("."))
    return m


def normalizar(tipo, c, vendedores):
    """c: coluna -> texto de uma venda. Devolve a venda no formato do banco, ou None."""
    g = lambda *nomes: next((c[n] for n in nomes if n in c), "")
    vid = txt(g("ID"), 40)
    dt = quando(g("Criação"))
    if not vid or not re.fullmatch(r"[A-Za-z0-9_-]+", vid) or not dt:
        return None
    valor = reais(g("Preço", "Valor"))
    vend = txt(g("Vendedor"))
    n = re.search(r"vendedor\s*0*(\d+)", vend, re.I)
    vn = int(n.group(1)) if n else None
    return {
        "origem": "antigo", "id": tipo + "-" + vid, "tipo": tipo, "dia": dt.strftime("%Y-%m-%d"), "criado": dt.strftime("%Y-%m-%dT%H:%M:%S"),
        "itens": itens(tipo, g("Descrição dos Serviços", "Itens da venda")), "valor": valor, "pagamento": pagamento(g("Pagamento"), valor),
        "vendedor": vendedores.get(vn, vend) if vn is not None else vend, "vendedor_n": vn,
        "pessoas": inteiro(g("Pessoas", "Participantes")), "videos": inteiro(g("# Vídeos", "Vídeos")), "resolucao": txt(g("Resolução"), 20),
        "pais": txt(re.sub(r"\(\+?\d+\)", "", g("Localidade")), 60), "idioma": idioma(g("Idioma")),
        "guia": txt(g("Guia")), "piloto": txt(g("Piloto")), "drone": txt(g("Drone")), "bateria": txt(g("Bateria")),
        "entrega": txt(g("Hora Entrega", "Entrega"), 40), "qr": txt(g("QR code", "QRCode"), 40),
    }


def de_csv(caminho, vendedores):
    texto = open(caminho, encoding="utf-8-sig").read()
    secoes, atual, nome = [], [], None
    for linha in texto.splitlines():
        if linha.startswith("##"):
            if atual:
                secoes.append((nome, atual))
            nome, atual = linha[2:].strip(), []
        elif linha.strip():
            atual.append(linha)
    if atual:
        secoes.append((nome, atual))
    out = []
    for nome, linhas in secoes:
        tipo = TIPOS.get((nome or "").lower()) or ("drone" if "drone" in os.path.basename(caminho).lower() else None)
        if not tipo:
            continue
        for r in csv.DictReader(io.StringIO("\n".join(linhas)), delimiter=";"):
            v = normalizar(tipo, {k.strip(): (val or "") for k, val in r.items() if k}, vendedores)
            if v:
                out.append(v)
    return out


def de_json(caminho, vendedores):
    j = json.load(open(caminho, encoding="utf-8"))
    out = []
    for bloco in j.get("dados", []):
        tipo = TIPOS.get(bloco.get("tipo"))
        if not tipo:
            continue
        head = bloco.get("head") or []
        for r in bloco.get("rows", []):
            if "saleId" not in (r.get("attrs") or {}):
                continue
            c = {h: (cel.get("txt") or "") for h, cel in zip(head, r.get("cells") or [])}
            c.setdefault("ID", r["attrs"]["saleId"])
            v = normalizar(tipo, c, vendedores)
            if v:
                out.append(v)
    return out


def principal(args):
    agente = os.path.join(os.path.dirname(os.path.abspath(__file__)), "eterna-agente.py")
    vend, simular, arquivos = None, False, []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--vendedores":
            vend, i = args[i + 1], i + 2
            continue
        if a == "--agente":
            agente, i = args[i + 1], i + 2
            continue
        if a == "--simular":
            simular = True
        else:
            arquivos.append(a)
        i += 1
    if not arquivos:
        print(__doc__ or "uso: ativacoes-importar.py <arquivo>...")
        return 2
    vendedores = ler_vendedores(vend)
    linhas = []
    for f in arquivos:
        linhas += de_csv(f, vendedores) if f.lower().endswith(".csv") else de_json(f, vendedores)
    por_tipo = {}
    for v in linhas:
        por_tipo[v["tipo"]] = por_tipo.get(v["tipo"], 0) + 1
    dias = sorted({v["dia"] for v in linhas})
    print("lidas: %d vendas %s, de %s a %s" % (len(linhas), json.dumps(por_tipo), dias[0] if dias else "-", dias[-1] if dias else "-"))
    if simular:
        return 0
    os.environ.setdefault("ETERNA_SEM_OPENCV", "1")
    sp = importlib.util.spec_from_file_location("eterna_agente", agente)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    r = m.ativ_importar(linhas)
    print("gravadas: %d novas, %d atualizadas, %d iguais, %d recusadas (banco %s)" % (r["novas"], r["atualizadas"], r["iguais"], r["recusadas"], m.VENDAS_DB))
    return 1 if r["recusadas"] else 0


if __name__ == "__main__":
    sys.exit(principal(sys.argv[1:]))
