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
            d.rectangle([w // 2 + 10, 10, w // 2 + 18, 18], fill=255)             # objeto pequeno quase encostado: fica
        else:
            d.rectangle([w // 2, h // 2, w - 1, h - 1], fill=255)                  # a segunda máscara completa a pessoa
            d.rectangle([w // 2, h // 8, w // 2 + 200, h // 3], fill=120)         # objeto translúcido encostado (taça): fica sólido
            d.rectangle([w * 3 // 4 + 50, h // 8, w - 30, h // 3], fill=150)      # translúcido solto, sem sinal forte: sai
            d.rectangle([w // 2 + 201, h // 3 + 40, w // 2 + 300, h // 2 - 1], fill=25)  # abaixo de 0,12 encostado: sai
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
ok(px(1526, 26) > 200, "objeto pequeno encostado deveria ficar: %r" % px(1526, 26))
ok(px(2990, 8) == 0, "mancha solta pequena e longe deveria sair: %r" % px(2990, 8))
ok(px(2600, 450) == 0, "translúcido solto sem sinal forte deveria sair: %r" % px(2600, 450))
ok(px(2000, 850) == 0, "abaixo de 0,12 deveria sair: %r" % px(2000, 850))
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
