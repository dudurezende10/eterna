# Ajudante do testes/montagem-paridade.js (plano docs/planos/2026-11-16-montagem-no-servidor.md, E1). Nunca em produção.
#   figuras <pasta>   gera os 8 recortes sintéticos (3000 px e a cópia de 2400 px) e o da prova do halo; imprime o índice JSON
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
    """Degradê de cor (a luz cai da esquerda para a direita e de cima para baixo), borda macia em alfa pré-multiplicado e
    RGB zerado fora da pessoa, como o recorte de verdade."""
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    luz = 1.08 - .22 * (np.arange(w, dtype=np.float32) / max(1, w - 1))[None, :] - .12 * (np.arange(h, dtype=np.float32) / max(1, h - 1))[:, None]
    a[:, :, :3] = np.clip(a[:, :, :3] * luz[:, :, None], 0, 255)
    pm = Image.fromarray(a.astype(np.uint8), "RGBA").convert("RGBa").filter(ImageFilter.GaussianBlur(1.6)).convert("RGBA")
    a = np.array(pm)
    a[a[:, :, 3] == 0] = 0
    return Image.fromarray(a, "RGBA")


def grava_par(im, pasta, nome, eterna=None):
    """O recorte de 3000 px e a cópia de 2400 do agente (rec_fazer: thumbnail com LANCZOS), que é o PNG do navegador.
    eterna: o tEXt que o processo de recorte grava (joelho e pernas, D8), nos dois arquivos como o agente faz."""
    from PIL.PngImagePlugin import PngInfo
    pinfo = None
    if eterna is not None:
        pinfo = PngInfo()
        pinfo.add_text("eterna", json.dumps(eterna))
    p3 = os.path.join(pasta, nome + "_3000.png")
    im.save(p3, "PNG", compress_level=3, pnginfo=pinfo)
    pq = im.copy()
    pq.thumbnail((2400, 2400), Image.LANCZOS)
    p2 = os.path.join(pasta, nome + "_2400.png")
    pq.save(p2, "PNG", compress_level=3, pnginfo=pinfo)
    return p3, p2


def figuras(pasta):
    """Os 8 recortes sintéticos do plano (medidas no quadro de 2400 px; aqui em 3000, x 1,25) e a prova do halo."""
    os.makedirs(pasta, exist_ok=True)
    casos = {}

    def novo(nome, W, H, desenha, rostos=None, nota=""):
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        desenha(ImageDraw.Draw(im))
        p3, p2 = grava_par(acabar(im), pasta, nome)
        casos[nome] = {"hi": p3, "previa": p2, "rostos": rostos or [], "nota": nota}

    def casal(d):
        pessoa(d, 1310, 650, 1800, 340, 3)
        pessoa(d, 1690, 700, 1800, 330, 1)
    novo("casal", 3000, 2000, casal, nota="casal estreito de meio corpo (644x1080 em 2400)")

    def bracos(d):
        d.rounded_rectangle([567, 1010, 2433, 1160], radius=70, fill=PELES[2] + (255,))
        pessoa(d, 1500, 730, 1700, 420, 2)
    novo("bracos", 3000, 2000, bracos, nota="pessoa de braços abertos (1492x1016)")

    def grupo(d):
        for i, cx in enumerate((455, 978, 1500, 2022, 2545)):
            pessoa(d, cx, 165 + 60 * (i % 2), 2400, 480, i)
    novo("grupo", 3000, 2000, grupo, nota="grupo largo de meio corpo (2156x1468)")

    novo("q085", 3000, 2000, lambda d: pessoa(d, 1500, 650, 1800, 911, 0), nota="razão 0,85 (entre estreito e largo)")
    novo("q095", 3000, 2000, lambda d: pessoa(d, 1500, 650, 1800, 1018, 4), nota="razão 0,95 (entre estreito e largo)")

    def braco(d):
        d.rounded_rectangle([1560, 150, 1680, 1000], radius=55, fill=PELES[4] + (255,))
        pessoa(d, 1400, 800, 1700, 420, 4)
    novo("braco", 3000, 2000, braco, nota="meio corpo com um braço erguido")

    novo("empe", 2000, 3000, lambda d: pessoa(d, 1000, 500, 2200, 560, 5, chao=2750), nota="corpo inteiro em foto em pé (quadro 1600x2400)")

    def crianca(d):
        pessoa(d, 1350, 200, 1650, 360, 2, chao=1850)
        pessoa(d, 1800, 1150, 700, 200, 4, chao=1850)
    # rostos (frações da altura do recorte): o adulto e a criança baixa, que o corte padrão cortaria
    novo("crianca", 3000, 2000, crianca, rostos=[{"top": 215 / 2000, "bot": 500 / 2000, "h": 285 / 2000},
                                                  {"top": 1160 / 2000, "bot": 1285 / 2000, "h": 125 / 2000}],
         nota="adulto com criança baixa de corpo inteiro (o corte desce pelo rosto)")

    # borda áspera (só para a medida, P2): alfa com ruído perto do limiar, como cabelo e tecido de foto de verdade; a borda
    # macia e simétrica das figuras acima não distingue um bilinear direto da redução que o canvas faz de verdade
    rng = np.random.default_rng(16)
    for nome, (W, H) in (("aspero", (3000, 2000)), ("aspero_impar", (3000, 2001))):
        base = Image.new("L", (W, H), 0)
        ImageDraw.Draw(base).ellipse([W * .3, H * .15, W * .7, H * 1.2], fill=255)
        al = np.asarray(base.filter(ImageFilter.GaussianBlur(14))).astype(np.float32) + rng.normal(0, 60, (H, W)).astype(np.float32)
        al = np.clip(al, 0, 255).astype(np.uint8)
        rgb = np.full((H, W, 3), (180, 140, 110), np.uint8)
        rgb[al == 0] = 0
        p3, p2 = grava_par(Image.fromarray(np.dstack([rgb, al]), "RGBA"), pasta, nome)
        casos[nome] = {"hi": p3, "previa": p2, "rostos": [], "so_medida": True, "nota": "borda áspera"}

    # corte do joelho (D8): casal de corpo inteiro com os pés na borda de baixo e o joelho do recorte no PNG; o mesmo casal
    # sem as pernas inteiras (não corta) e com chão abaixo dos pés (não encosta: não corta)
    def casal_ci(chao):
        def f(d):
            pessoa(d, 1300, 160, 1840 - (2000 - chao), 300, 3, chao=chao)
            pessoa(d, 1700, 200, 1800 - (2000 - chao), 290, 1, chao=chao)
        return f
    for nome, chao, info, corta in (("joelho", 2000, {"v": 1, "joelho": .74, "pernas": True}, True),
                                    ("joelho_sem_pernas", 2000, {"v": 1, "joelho": .74, "pernas": False}, False),
                                    ("joelho_chao", 1880, {"v": 1, "joelho": .70, "pernas": True}, False)):
        im = Image.new("RGBA", (3000, 2000), (0, 0, 0, 0))
        casal_ci(chao)(ImageDraw.Draw(im))
        p3, p2 = grava_par(acabar(im), pasta, nome, info)
        casos[nome] = {"hi": p3, "previa": p2, "rostos": [], "joelho": info, "corta": corta, "nota": "corpo inteiro (D8)"}

    # prova do halo: uma figura de uma cor só (clara), para o fundo branco de teste
    cor = (200, 170, 140)
    im = Image.new("RGBA", (3000, 2000), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([1150, 300, 1850, 1100], fill=cor + (255,))
    d.rounded_rectangle([900, 1000, 2100, 2100], radius=200, fill=cor + (255,))
    pm = im.convert("RGBa").filter(ImageFilter.GaussianBlur(1.6)).convert("RGBA")
    a = np.array(pm)
    a[a[:, :, 3] == 0] = 0
    p3, p2 = grava_par(Image.fromarray(a, "RGBA"), pasta, "halo")
    casos["halo"] = {"hi": p3, "previa": p2, "rostos": [], "cor": list(cor), "nota": "prova do halo"}
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


def corte_esperado(fundo, pos, tam):
    """O arquivo do fundo no corte 10x15 (centro na horizontal; alto, meio ou baixo na vertical), como o imprimir_corte."""
    W, H = fundo.size
    ow, oh = tam
    k = max(ow / W, oh / H)
    sw, sh = ow / k, oh / k
    x, y = (W - sw) / 2, {"alto": 0, "meio": (H - sh) / 2, "baixo": H - sh}[pos]
    return np.asarray(fundo.resize((ow, oh), Image.LANCZOS, box=(x, y, x + sw, y + sh))).astype(np.int16)


def compara():
    """Lê do stdin a lista de conferências e imprime uma medida por item:
       {"a","b"[,"fundo_a","fundo_b","quad"]}  paridade ponto a ponto, caixa do grupo (px) e, no Telão, fora da tela
       {"a","halo":[r,g,b]}                     o ponto mais escuro em relação à cor da figura (fundo branco)
       {"a","cinza":true}                       preto e branco: maior |R-G| e |G-B| no PNG e depois de virar JPEG 90 e 92
       {"a","corte":{"fundo","pos","faixa"}}    o corte 10x15: a faixa sem pessoa igual ao fundo cortado em pos; e nas outras posições"""
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
            if j.get("cinza"):
                import io
                with Image.open(j["a"]) as im:
                    im = im.convert("RGB")
                a = np.asarray(im).astype(np.int16)
                r["cinza_png"] = int(max(np.abs(a[:, :, 0] - a[:, :, 1]).max(), np.abs(a[:, :, 1] - a[:, :, 2]).max()))
                pior = 0
                for q in (90, 92):
                    buf = io.BytesIO()
                    im.save(buf, "JPEG", quality=q, optimize=False)
                    with Image.open(io.BytesIO(buf.getvalue())) as jp:
                        d = np.asarray(jp.convert("RGB")).astype(np.int16)
                    pior = max(pior, int(np.abs(d[:, :, 0] - d[:, :, 1]).max()), int(np.abs(d[:, :, 1] - d[:, :, 2]).max()))
                r["cinza_jpeg"] = pior
                out.append(r)
                continue
            if j.get("corte"):
                c = j["corte"]
                a = abre(j["a"])
                h, w = a.shape[:2]
                with Image.open(c["fundo"]) as fu:
                    fu = fu.convert("RGB")
                    x0, y0, x1, y1 = [int(round(v * (w if i % 2 == 0 else h))) for i, v in enumerate(c["faixa"])]
                    for pos in ("alto", "meio", "baixo"):
                        e = corte_esperado(fu, pos, (w, h))
                        if c.get("cinza"):
                            g = np.floor(e[:, :, 0] * .2126 + e[:, :, 1] * .7152 + e[:, :, 2] * .0722 + .5)
                            e = np.repeat(g[:, :, None], 3, axis=2).astype(np.int16)
                        r["corte_" + pos] = round(float(np.abs(a[y0:y1, x0:x1] - e[y0:y1, x0:x1]).mean()), 3)
                r.update(w=w, h=h)
                out.append(r)
                continue
            a, b = abre(j["a"]), abre(j["b"])
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
                dentro = np.asarray(msk.filter(ImageFilter.MaxFilter(7))) > 0      # a tela dilatada em 3 px
                r["mae_dentro"] = round(float(dif[dentro].mean()), 4)
                r["frac16_dentro"] = round(float((dm[dentro] > 16).mean()), 6)
                r["fora_ab"] = int(dm[~dentro].max())                              # navegador x Python fora da tela
                if fa is not None:
                    r["fora_a"] = int(np.abs(a - fa).max(axis=2)[~dentro].max())   # cada um contra o próprio fundo: zero
                if fb is not None:
                    r["fora_b"] = int(np.abs(b - fb).max(axis=2)[~dentro].max())
            if fa is not None and fb is not None:
                ca, cb = caixa(a, fa), caixa(b, fb)
                r["caixa_a"], r["caixa_b"] = ca, cb
                r["caixa_px"] = max(abs(x - y) for x, y in zip(ca, cb)) if ca and cb else None
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
