# v84: testes Python do recorte local no agente (sem rede e sem os modelos de verdade: sessões falsas).
# Rodado por testes/v84.js com HOME temporário:  python3 -I testes/v84_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, tempfile
from PIL import Image, ImageDraw

sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# 1. sem modelos: indisponível, com o motivo; sem import de rembg no topo do agente
vazio = tempfile.mkdtemp()
os.environ["REMBG_HOME"] = vazio
os.environ["U2NET_HOME"] = vazio
st, mot = m.rec_estado()
ok(not st and "modelos" in (mot or ""), "sem modelos deveria ficar indisponível: %r" % mot)
src = open(sys.argv[1], encoding="utf-8").read()
topo = src.split("# ---------- reconhecimento facial", 1)[0]
ok("import rembg" not in topo and "from rembg" not in topo and "import onnxruntime" not in topo, "rembg/onnxruntime não podem ser importados no topo")
s = m.rec_status()
ok(s["ok"] is False and s["motivo"] and "ms_medio" in s, "rec_status sem modelos: %r" % s)
os.environ["ETERNA_SEM_RECORTE"] = "1"
ok(m.rec_estado()[0] is False, "ETERNA_SEM_RECORTE deveria desligar")
del os.environ["ETERNA_SEM_RECORTE"]
ok("instalar-recorte" in m.REC_COMO and "rembg==2.0.86" in m.REC_COMO and "onnxruntime==1.29.0" in m.REC_COMO and "[cli]" not in m.REC_COMO, "texto do como: " + m.REC_COMO)

# 2. regras 12 e 13 (máximo das duas máscaras; tudo o que está com o convidado sai junto e sólido), mancha solta longe
# sai, RGB zerado fora e teto de 3000 px
class Falsa:
    def __init__(self, lado):
        self.lado = lado

    def predict(self, img):
        mk = Image.new("L", img.size, 0)
        w, h = img.size
        d = ImageDraw.Draw(mk)
        if self.lado == "esq":
            d.rectangle([0, 0, w // 2 - 1, h - 1], fill=255)                      # a pessoa
            d.rectangle([w - 12, 2, w - 4, 10], fill=255)                          # mancha pequena, solta e longe: sai
            d.rectangle([w // 2, 10, w // 2 + 18, 18], fill=255)                  # objeto que encosta na pessoa na imagem: vai junto (segurado ou só sobreposto; limite da regra 13)
            d.rectangle([w // 2 + 30, 30, w // 2 + 38, 38], fill=255)             # objeto solto perto, sem pessoa: sai (v88)
        else:
            d.rectangle([w // 2, h // 2, w - 1, h - 1], fill=255)                  # a segunda máscara completa a pessoa
            d.rectangle([w // 2, h // 8, w // 2 + 200, h // 3], fill=120)         # objeto translúcido encostado (taça): fica sólido
            d.rectangle([w * 3 // 4 + 50, h // 8, w - 30, h // 3], fill=150)      # translúcido solto, sem sinal forte: sai
            d.rectangle([w // 2 + 201, h // 3 + 40, w // 2 + 300, h // 2 - 1], fill=25)  # franja abaixo de 0,10 por fora, encostada: sai
        return [mk]


m.rec_sess[:] = [Falsa("esq"), Falsa("dir")]
d = tempfile.mkdtemp()
foto = os.path.join(d, "f.jpg")
Image.new("RGB", (7200, 4800), (10, 120, 30)).save(foto, quality=80)
p = m.rec_fazer("abc123", foto)
im = Image.open(p)
ok(p == os.path.join(m.RECORTES, "abc123.png") and im.mode == "RGBA", "PNG RGBA em ~/Eterna/recortes: %s %s" % (p, im.mode))
ok(im.size == (3000, 2000), "teto de 3000 px: %r" % (im.size,))
a = im.getchannel("A")
px = lambda x, y: a.getpixel((x, y))
ok(px(100, 100) == 255 and px(2900, 1900) == 255, "máscara final = máximo das duas: %r" % [px(100, 100), px(2900, 1900)])
ok(px(1687, 500) == 255, "objeto translúcido encostado deveria ficar sólido (regra 13): %r" % px(1687, 500))
ok(px(1520, 26) > 200, "objeto que encosta na pessoa na imagem vai junto (limite da regra 13): %r" % px(1520, 26))
ok(px(1564, 64) == 0, "objeto solto perto, sem pessoa, deveria sair (v88): %r" % px(1564, 64))
ok(px(2990, 8) == 0, "mancha solta pequena e longe deveria sair: %r" % px(2990, 8))
ok(px(2600, 450) == 0, "translúcido solto sem sinal forte deveria sair: %r" % px(2600, 450))
ok(px(2000, 850) == 0, "franja fraca por fora deveria sair: %r" % px(2000, 850))
ok(px(1500, 100) == 0 and px(1492, 100) == 255 and px(1499, 100) < 100, "1 px de borda a menos: %r" % [px(x, 100) for x in range(1492, 1501)])
ok(im.getpixel((2600, 450))[:3] == (0, 0, 0) and im.getpixel((100, 100))[:3] != (0, 0, 0), "RGB zerado fora da pessoa: %r" % (im.getpixel((2600, 450)),))
ok(oct(os.stat(p).st_mode & 0o777) == "0o600", "recorte gravado com chmod 600")
p24 = m.rec_fazer("abc123", foto, 2400)
ok(p24.endswith("abc123_2400.png") and Image.open(p24).size == (2400, 1600) and m.rec_status()["feitos"] == 1, "cópia de 2400 px sem rodar os modelos de novo")
# cache: não refaz
m.rec_sess[:] = []
ok(m.rec_fazer("abc123", foto) == p, "cache em disco deveria ser reaproveitado")
# foto girada pelo EXIF sai em pé
m.rec_sess[:] = [Falsa("esq")]
foto2 = os.path.join(d, "g.jpg")
ex = Image.Exif()
ex[0x0112] = 6
Image.new("RGB", (900, 600), (200, 30, 30)).save(foto2, quality=80, exif=ex.tobytes())
ok(Image.open(m.rec_fazer("abc124", foto2)).size == (600, 900), "EXIF de orientação aplicado")
# fila: 1 trabalhador por padrão
r, e = m.rec_pedir("abc125", foto2)
ok(r and not e and len(m.rec_threads) == m.REC_CONC == 1, "fila com 1 trabalhador: %r %r %r" % (r, e, len(m.rec_threads)))
ok(m.rec_status()["feitos"] >= 3, "contagem de recortes")
# v88 (Eduardo, 30/10): vai junto o que está NA pessoa; furos de objeto preenchidos, vão real entre braço e corpo não.
# Máscaras desenhadas (sem foto real): [isnet, u2net_human_seg] de 400x300 e a foto em cor do mesmo tamanho.
def mascaras():
    isn, hum = Image.new("L", (400, 300), 0), Image.new("L", (400, 300), 0)
    cor = Image.new("RGB", (400, 300), (120, 130, 200))              # fundo azulado
    di, dh, dc = ImageDraw.Draw(isn), ImageDraw.Draw(hum), ImageDraw.Draw(cor)
    for dd, v in ((di, 255), (dh, 255), (dc, (200, 40, 40))):         # pessoa: tronco e braço dobrado fechando um vão
        dd.rectangle([150, 100, 250, 299], fill=v)
        dd.rectangle([250, 100, 330, 120], fill=v)
        dd.rectangle([310, 100, 330, 200], fill=v)
        dd.rectangle([250, 180, 330, 200], fill=v)
    dc.rectangle([251, 121, 309, 179], fill=(30, 140, 40))            # o vão mostra a grama do fundo
    di.rectangle([20, 40, 150, 200], fill=200)                        # bandeira segurada, encostada no tronco (só no isnet)
    dc.rectangle([20, 40, 149, 200], fill=(240, 240, 240))
    di.rectangle([40, 60, 70, 100], fill=20)                          # parte fraca da bandeira (sinal ~0,08)
    di.rectangle([90, 120, 120, 170], fill=0)                         # parte branca sem sinal nenhum (branco com branco)
    di.rectangle([160, 40, 240, 100], fill=255)                       # taça segurada (encosta no tronco): vai junto
    dc.rectangle([160, 40, 240, 99], fill=(220, 180, 40))
    di.rectangle([345, 220, 390, 290], fill=255)                      # taça num pedestal ao lado, sem pessoa: não vai
    dc.rectangle([345, 220, 390, 290], fill=(220, 180, 40))
    return [isn, hum], cor


mk, cor = mascaras()
r = m.rec_limpa_mascara(mk, cor)
ok(r.shape == (300, 400) and r.dtype.name == "uint8", "máscara limpa do mesmo tamanho: %r" % (r.shape,))
ok(r[255, 367] == 0 and r[222, 347] == 0, "objeto separado sem pessoa deveria sair: %r" % [r[255, 367], r[222, 347]])
ok(r[70, 200] == 255 and r[150, 200] == 255, "objeto ligado à mão deveria ficar sólido: %r" % [r[70, 200], r[150, 200]])
ok(r[80, 55] == 255, "furo de sinal fraco dentro da bandeira deveria ser preenchido: %r" % r[80, 55])
ok(r[145, 105] == 255, "furo sem sinal com a mesma cor da bandeira em volta deveria ser preenchido: %r" % r[145, 105])
ok(r[150, 280] == 0, "vão real entre braço e corpo (sem sinal, borda com contraste) não pode ser preenchido: %r" % r[150, 280])
r2 = m.rec_limpa_mascara(mk)
ok(r2[145, 105] == 0 and r2[80, 55] == 255 and r2[150, 280] == 0, "sem a foto: furo sem sinal fica aberto, o de sinal fraco fecha: %r" % [r2[145, 105], r2[80, 55]])
ok(not m.rec_limpa_mascara([Image.new("L", (50, 40), 0), Image.new("L", (50, 40), 0)]).any(), "sem sinal nenhum: máscara vazia")
# furo fechado com sinal médio >= 0,03 (abaixo do sinal mínimo de 0,04) fecha pelo REC_FURO, mesmo sem a foto
ok(r2[150, 280] == 0, "furo sem sinal continua aberto sem a foto")
mk9 = mascaras()[0]
ImageDraw.Draw(mk9[0]).rectangle([90, 120, 120, 170], fill=9)          # ~0,035: abaixo de 0,04, acima de 0,03
r9 = m.rec_limpa_mascara(mk9)
ok(r9[145, 105] == 255, "furo com sinal médio 0,035 deveria fechar (REC_FURO): %r" % r9[145, 105])
ImageDraw.Draw(mk9[0]).rectangle([90, 120, 120, 170], fill=6)          # ~0,024: abaixo de 0,03, sem foto: aberto
ok(m.rec_limpa_mascara(mk9)[145, 105] == 0, "furo com sinal médio 0,024 sem a foto fica aberto")
# semente: o modelo de pessoa não viu ninguém com 0,6 -> relativa (0,8 x máximo); nada -> como antes (alfa alto em uma delas)
isn, hum = Image.new("L", (200, 150), 0), Image.new("L", (200, 150), 0)
ImageDraw.Draw(isn).rectangle([40, 30, 100, 149], fill=255)               # pessoa no isnet
ImageDraw.Draw(hum).rectangle([45, 40, 95, 149], fill=110)                # pessoa fraca no u2net_human_seg (0,43)
ImageDraw.Draw(isn).rectangle([150, 60, 190, 140], fill=255)              # objeto solto ao lado
rf = m.rec_limpa_mascara([isn, hum])
ok(rf[90, 70] == 255 and rf[100, 170] == 0, "pessoa fraca: semente relativa leva a pessoa e deixa o objeto solto: %r" % [rf[90, 70], rf[100, 170]])
r1 = m.rec_limpa_mascara([isn])
ok(r1[90, 70] == 255, "uma máscara só: a pessoa sai: %r" % r1[90, 70])
r0 = m.rec_limpa_mascara([isn, Image.new("L", (200, 150), 0)])
ok(r0[90, 70] == 255 and r0[100, 170] == 255, "modelo de pessoa vazio: cai para alfa alto em uma delas (não tira a foto da venda)")
# teto de custo: milhares de furos e de manchas pequenas terminam em poucos segundos
import numpy as _np
gi = _np.zeros((1067, 1600), _np.uint8)
gi[50:1067, 200:1400] = 255
for yy in range(80, 1040, 14):
    for xx in range(230, 1380, 14):
        gi[yy:yy + 7, xx:xx + 7] = 0                                        # ~5600 furos de 49 px sem sinal
gi[0:20:3, 0:1600:3] = 255                                                 # ~3700 manchas soltas lá em cima, longe do grupo
gc = Image.new("RGB", (1600, 1067), (230, 230, 230))
t0 = __import__("time").time()
rg = m.rec_limpa_mascara([Image.fromarray(gi), Image.fromarray(gi)], gc)
dt = (__import__("time").time() - t0)
ok(dt < 8 and rg[500, 800] == 255 and not rg[0:20, :].any(), "milhares de furos e manchas: %.1f s (teto ~2 s nos furos) %r" % (dt, [rg[500, 800], int(rg[0:20].sum())]))
print("tempo com milhares de furos: %.2f s" % dt, file=sys.stderr)

# erro ao abrir os modelos: limpa depois de 60 s
os.environ["REMBG_HOME"] = "/root/.rembg"
import time as _t
with m.rec_lock:
    m.rec["erro"], m.rec["erro_em"] = "erro ao abrir os modelos: x", _t.time()
e1 = m.rec_estado()
with m.rec_lock:
    m.rec["erro_em"] = _t.time() - 61
e2 = m.rec_estado()
ok(e1[1] and "erro ao abrir" in e1[1] and m.rec["erro"] is None, "erro deveria sair depois de 60 s: %r" % [e1, e2])
os.environ["REMBG_HOME"] = vazio
# limpeza: mais de 2 dias, foto fora da biblioteca, teto em GB
with m.lock:
    m.lib.clear()
    m.lib["abc123"] = {"file": foto, "thumb": foto}
    m.lib["abc124"] = {"file": foto2, "thumb": foto2}
velho = m.rec_arquivo("abc124")
os.utime(velho, (_t.time() - 3 * 86400,) * 2)
n = m.limpar_recortes()
rest = sorted(os.listdir(m.RECORTES))
ok(n == 2 and rest == ["abc123.png", "abc123_2400.png"], "limpeza (velho e fora da biblioteca): %r %r" % (n, rest))
m.REC_TETO_GB = 0
ok(m.limpar_recortes() == 2 and not os.listdir(m.RECORTES), "teto em GB")
print(json.dumps({"ok": not falhas, "falhas": falhas}))
