# Ajudante do testes/montagem-paridade.js (plano docs/planos/2026-11-11-montagem-no-servidor.md, E0). Nunca em produção.
#   figuras <pasta>   gera os 6 recortes sintéticos (3000 px e a cópia de 2400 px) e o da prova do halo; imprime o índice JSON
#   compara           lê do stdin uma lista de pares de imagens e imprime as medidas de paridade (JSON)
#   folha <saida.jpg> lê do stdin a lista de linhas e monta a folha lado a lado (canvas do navegador x servidor)
# Só figuras desenhadas aqui: nunca foto de cliente.
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = 40_000_000
PELES = [(226, 190, 160), (198, 150, 118), (150, 104, 78), (240, 208, 184), (176, 128, 96), (214, 170, 140)]
ROUPAS = [(28, 64, 120), (190, 40, 48), (240, 200, 40), (30, 120, 70), (120, 60, 140), (230, 230, 232)]


def pessoa(d, cx, topo, alt, larg, i, chao=None):
    """Uma figura: cabeça, pescoço, tronco listrado e, com chao, pernas e pés. alt = altura da cabeça aos pés (ou até sair do quadro)."""
    pele, roupa = PELES[i % len(PELES)], ROUPAS[i % len(ROUPAS)]
    rc = alt * .075
    d.ellipse([cx - rc, topo, cx + rc, topo + rc * 2.5], fill=pele + (255,))
    d.ellipse([cx - rc * 1.05, topo - rc * .15, cx + rc * 1.05, topo + rc * .9], fill=(40 + 20 * (i % 3), 30, 24, 255))      # cabelo
    for s in (-1, 1):
        d.ellipse([cx + s * rc * .42 - rc * .12, topo + rc * 1.1, cx + s * rc * .42 + rc * .12, topo + rc * 1.34], fill=(20, 20, 24, 255))
    d.rectangle([cx - rc * .4, topo + rc * 2.3, cx + rc * .4, topo + rc * 3], fill=pele + (255,))
    t0, t1 = topo + rc * 2.9, topo + alt * .56
    d.rounded_rectangle([cx - larg / 2, t0, cx + larg / 2, t1 + larg * .1], radius=larg * .18, fill=roupa + (255,))
    y = t0 + larg * .25
    while y < t1:
        d.rectangle([cx - larg / 2, y, cx + larg / 2, y + alt * .012], fill=tuple(min(255, c + 60) for c in roupa) + (255,))
        y += alt * .045
    for s in (-1, 1):                                                                              # braços
        d.rounded_rectangle([cx + s * larg / 2 - larg * .13, t0 + larg * .05, cx + s * larg / 2 + larg * .13, t1 - alt * .04], radius=larg * .1, fill=pele + (255,))
    if chao is None:
        d.rectangle([cx - larg * .46, t1, cx + larg * .46, topo + alt + 50], fill=(36, 40, 60, 255))
        return
    for s in (-1, 1):
        d.rounded_rectangle([cx + s * larg * .23 - larg * .2, t1 - 4, cx + s * larg * .23 + larg * .2, chao - alt * .03], radius=larg * .08, fill=(36, 40, 60, 255))
        d.ellipse([cx + s * larg * .23 - larg * .26, chao - alt * .05, cx + s * larg * .23 + larg * .26, chao], fill=(240, 240, 240, 255))


def acabar(im):
    """Borda macia em alfa pré-multiplicado e RGB zerado fora da pessoa, como o recorte de verdade."""
    pm = im.convert("RGBa").filter(ImageFilter.GaussianBlur(1.6)).convert("RGBA")
    a = np.array(pm)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, "RGBA")


def figuras(pasta):
    os.makedirs(pasta, exist_ok=True)
    casos = {}

    def novo(nome, W, H, desenha, rostos=None, nota=""):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        desenha(ImageDraw.Draw(im))
        im = acabar(im)
        p3 = os.path.join(pasta, nome + "_3000.png")
        im.save(p3, "PNG", compress_level=3)
        pq = im.copy()
        pq.thumbnail((2400, 2400), Image.LANCZOS)      # a cópia de 2400 do agente (rec_fazer)
        aq = np.array(pq)
        aq[aq[:, :, 3] == 0] = 0
        p2 = os.path.join(pasta, nome + "_2400.png")
        Image.fromarray(aq, "RGBA").save(p2, "PNG", compress_level=3)
        casos[nome] = {"hi": p3, "previa": p2, "rostos": rostos or [], "nota": nota}

    def meio3(d):
        for i, cx in enumerate((950, 1500, 2050)):
            pessoa(d, cx, 330 + 60 * (i % 2), 2300, 520, i)
    novo("meio3", 3000, 2000, meio3, nota="3 adultos de meio corpo")

    def casal(d):
        pessoa(d, 1330, 230, 1620, 340, 3, chao=1850)
        pessoa(d, 1720, 330, 1520, 320, 1, chao=1850)
    novo("casal", 3000, 2000, casal, nota="casal de corpo inteiro")

    def familia(d):
        for i, cx in enumerate((520, 1010, 1500, 1990, 2480)):
            pessoa(d, cx, 760 + 40 * (i % 2), 1000 - 40 * (i % 2), 300, i, chao=1760)
    novo("familia", 3000, 2000, familia, nota="família larga de corpo inteiro (regra 10)")

    def crianca(d):
        pessoa(d, 1350, 200, 1650, 360, 2, chao=1850)
        pessoa(d, 1800, 1150, 700, 200, 4, chao=1850)
    # rostos (frações da altura do recorte): o adulto e a criança baixa, que o corte padrão cortaria
    novo("crianca", 3000, 2000, crianca, rostos=[{"top": 215 / 2000, "bot": 500 / 2000, "h": 285 / 2000},
                                                  {"top": 1160 / 2000, "bot": 1285 / 2000, "h": 125 / 2000}],
         nota="adulto com criança baixa (o corte desce pelo rosto)")

    def sozinha(d):
        pessoa(d, 950, 420, 3300, 760, 5)
    novo("sozinha", 2000, 3000, sozinha, nota="pessoa sozinha (foto em pé)")

    def estoura(d):
        for i, cx in enumerate((230, 740, 1250, 1760, 2270, 2780)):
            pessoa(d, cx, 420 + 70 * (i % 2), 2200, 500, i)
    novo("estoura", 3000, 2000, estoura, nota="grupo que estoura a largura")

    # prova do halo: uma figura de uma cor só (clara), para o fundo branco de teste
    cor = (200, 170, 140)
    im = Image.new("RGBA", (3000, 2000), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([1150, 300, 1850, 1100], fill=cor + (255,))
    d.rounded_rectangle([900, 1000, 2100, 2100], radius=200, fill=cor + (255,))
    im = acabar(im)
    ph = os.path.join(pasta, "halo_3000.png")
    im.save(ph, "PNG", compress_level=3)
    pq = im.copy()
    pq.thumbnail((2400, 2400), Image.LANCZOS)
    aq = np.array(pq)
    aq[aq[:, :, 3] == 0] = 0
    Image.fromarray(aq, "RGBA").save(os.path.join(pasta, "halo_2400.png"), "PNG", compress_level=3)
    casos["halo"] = {"hi": ph, "previa": os.path.join(pasta, "halo_2400.png"), "rostos": [], "cor": list(cor), "nota": "prova do halo"}
    for nome, tam in (("branco_2400.png", (2400, 1600)), ("branco_5000.png", (5000, 3333))):
        Image.new("RGB", tam, (255, 255, 255)).save(os.path.join(pasta, nome), "PNG", compress_level=1)
    print(json.dumps(casos))


def abre(p):
    with Image.open(p) as im:
        return np.asarray(im.convert("RGB")).astype(np.int16)


def caixa(img, fundo, lim=40):
    """Caixa do grupo: onde a imagem difere do fundo puro (linhas e colunas com pelo menos 3 pontos)."""
    d = np.abs(img - fundo).max(axis=2) > lim
    cols, lins = np.nonzero(d.sum(axis=0) >= 3)[0], np.nonzero(d.sum(axis=1) >= 3)[0]
    if not len(cols) or not len(lins):
        return None
    return [int(cols[0]), int(lins[0]), int(cols[-1]), int(lins[-1])]


def compara():
    out = []
    for j in json.loads(sys.stdin.read()):
        r = {"id": j.get("id")}
        try:
            if j.get("halo"):
                img = abre(j["a"])
                cor = np.array(j["halo"], dtype=np.int16)
                r["halo_min"] = int((img - cor).min())      # negativo = ponto mais escuro que a pessoa (e que o fundo branco)
                out.append(r)
                continue
            a, b = abre(j["a"]), abre(j["b"])
            if j.get("b_reduz"):                         # o fundo de 5000 px no tamanho da prévia (o quanto os dois arquivos diferem)
                with Image.open(j["b"]) as im:
                    b = np.asarray(im.convert("RGB").resize(tuple(j["b_reduz"]), Image.LANCZOS)).astype(np.int16)
            if a.shape != b.shape:
                r["erro"] = "tamanhos diferentes: %r x %r" % (a.shape, b.shape)
                out.append(r)
                continue
            dif = np.abs(a - b)
            dm = dif.max(axis=2)
            r.update(w=a.shape[1], h=a.shape[0], mae=round(float(dif.mean()), 4), frac16=round(float((dm > 16).mean()), 6), max=int(dm.max()))
            fa = abre(j["fundo_a"]) if j.get("fundo_a") else None
            fb = abre(j["fundo_b"]) if j.get("fundo_b") else None
            if j.get("quad"):
                msk = Image.new("L", (a.shape[1], a.shape[0]), 0)
                ImageDraw.Draw(msk).polygon([tuple(p) for p in j["quad"]], fill=255)
                dentro = np.asarray(msk.filter(ImageFilter.MaxFilter(9))) > 0
                r["mae_dentro"] = round(float(dif[dentro].mean()), 4)
                r["frac16_dentro"] = round(float((dm[dentro] > 16).mean()), 6)
                if fa is not None:
                    r["fora_a"] = int(np.abs(a - fa).max(axis=2)[~dentro].max())
                if fb is not None:
                    r["fora_b"] = int(np.abs(b - fb).max(axis=2)[~dentro].max())
            if fa is not None and fb is not None and not j.get("sem_caixa"):
                ca, cb = caixa(a, fa), caixa(b, fb)
                r["caixa_a"], r["caixa_b"] = ca, cb
                r["caixa_desvio"] = round(max(abs(x - y) for x, y in zip(ca, cb)) / a.shape[1], 5) if ca and cb else None
            if fa is not None and fb is not None:
                r["fundo_mae"] = round(float(np.abs(fa - fb).mean()), 4)
        except Exception as ex:
            r["erro"] = "%s: %s" % (type(ex).__name__, str(ex)[:160])
        out.append(r)
    print(json.dumps(out))


def fonte(tam):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Helvetica.ttc", "C:/Windows/Fonts/arial.ttf"):
        try:
            return ImageFont.truetype(p, tam)
        except OSError:
            pass
    return ImageFont.load_default()


def folha(saida):
    """stdin: {"titulo","rodape":[...],"linhas":[{"rotulo","numeros","a","b"}]}. Cada linha: canvas (esq.) x servidor (dir.)."""
    j = json.loads(sys.stdin.read())
    LW, LH, M, CAB, LEG = 900, 0, 24, 150, 118
    linhas = j["linhas"]
    alt = []
    for ln in linhas:
        with Image.open(ln["a"]) as im:
            alt.append(int(round(LW * im.size[1] / im.size[0])))
    W = M * 3 + LW * 2
    H = CAB + sum(h + LEG + M for h in alt) + 40 * len(j.get("rodape") or []) + M
    f1, f2, f3 = fonte(40), fonte(24), fonte(20)
    out = Image.new("RGB", (W, H), (250, 250, 248))
    d = ImageDraw.Draw(out)
    d.text((M, 22), j["titulo"], fill=(19, 64, 120), font=f1)
    d.text((M, 84), "esquerda: canvas do navegador (como é hoje)", fill=(40, 40, 40), font=f2)
    d.text((M * 2 + LW, 84), "direita: servidor do ponto (Python)", fill=(40, 40, 40), font=f2)
    y = CAB
    for ln, h in zip(linhas, alt):
        for k, x in (("a", M), ("b", M * 2 + LW)):
            with Image.open(ln[k]) as im:
                out.paste(im.convert("RGB").resize((LW, h), Image.LANCZOS), (x, y))
        d.text((M, y + h + 6), ln["rotulo"], fill=(20, 20, 20), font=f2)
        for k, parte in enumerate(ln["numeros"].split(" · ")[:3]):
            d.text((M, y + h + 36 + 26 * k), parte, fill=(90, 90, 90), font=f3)
        y += h + LEG + M
    for t in j.get("rodape") or []:
        d.text((M, y), t, fill=(60, 60, 60), font=f3)
        y += 40
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    out.save(saida, "JPEG", quality=88)
    print(json.dumps({"ok": True, "w": W, "h": H}))


if __name__ == "__main__":
    if sys.argv[1] == "figuras":
        figuras(sys.argv[2])
    elif sys.argv[1] == "compara":
        compara()
    elif sys.argv[1] == "folha":
        folha(sys.argv[2])
