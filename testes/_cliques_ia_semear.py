# v93 (testador): manda fotos sintéticas ao agente de verdade pelo FTP embutido e devolve os pids na ordem (JSON).
# Uso: python3 -I testes/_cliques_ia_semear.py <porta_agente> <porta_ftp> <home> <fotógrafo> <n> [vazias]
#   vazias: índices (0, 1...) separados por vírgula das fotos que vão sem pessoa (só o fundo verde).
# Cada foto é um JPEG com uma silhueta desenhada sobre verde puro; o lançador (testes/_cliques_ia_lanca.py) transforma a cópia
# do recorte falso em PNG com o verde transparente. vazias = só o verde (sem pessoa). Nunca foto de convidado.
import ftplib, http.client, io, json, os, sys, time
from PIL import Image, ImageDraw

porta, ftpp, home, quem, n = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4], int(sys.argv[5])
vazias = {int(x) for x in (sys.argv[6].split(",") if len(sys.argv) > 6 and sys.argv[6] else [])}
senha = json.load(open(os.path.join(home, "Eterna", "ftp.json")))["users"][quem]
semente = int(time.time() * 1000) % 100000


def png(i, vazia):
    W, H = 600, 900
    im = Image.new("RGB", (W, H), (0, 200, 0))
    if not vazia:
        d = ImageDraw.Draw(im)
        c = ((semente + i * 37) % 120 + 120, (semente * 3 + i * 71) % 60 + 20, (i * 53 + 90) % 120 + 120)
        d.ellipse([240, 60, 360, 190], fill=(230, 180, 160))
        d.rectangle([200, 195, 400, 560], fill=c)
        d.rectangle([215, 560, 290, 880], fill=(60, 30, 80))
        d.rectangle([310, 560, 385, 880], fill=(60, 30, 80))
        for k in range(24):                  # marca única (as fotos repetidas são ignoradas pelo agente)
            v = int.from_bytes(os.urandom(3), "big")
            d.rectangle([210 + k * 8, 300, 217 + k * 8, 330], fill=(v >> 16 | 100, (v >> 8 & 255) // 3, v & 255 | 100))
    else:                                    # sem pessoa: só o verde, com um ponto verde diferente para não ser repetida
        for k in range(12):                  # pontos verdes ao acaso: nunca repetida
            r = os.urandom(4)
            im.putpixel((int.from_bytes(r[:2], "big") % W, int.from_bytes(r[2:], "big") % H), (0, 180 + r[0] % 20, 0))
    b = io.BytesIO()
    im.save(b, "JPEG", quality=92)
    return b.getvalue()


nomes = []
f = ftplib.FTP()
f.connect("127.0.0.1", ftpp, timeout=15)
f.login(quem, senha)
for i in range(n):
    nm = "E93_%s_%d_%d.JPG" % (quem, semente, i)
    f.storbinary("STOR " + nm, io.BytesIO(png(i, i in vazias)))
    nomes.append(nm)
    time.sleep(0.15)                         # ordem de chegada = ordem do clique (sem EXIF)
f.quit()
for _ in range(60):
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=10)
    c.request("GET", "/biblioteca", headers={"Host": "127.0.0.1:%d" % porta, "Cookie": os.environ.get("ETERNA_TESTE_COOKIE", "")})  # v93: rota da equipe pede sessão
    j = json.loads(c.getresponse().read())
    c.close()
    m = {x["name"]: x["id"] for x in j.get("fotos", [])}
    if all(x in m for x in nomes):
        print(json.dumps([m[x] for x in nomes]))
        sys.exit(0)
    time.sleep(0.1)
print(json.dumps({"erro": "fotos não chegaram"}))
sys.exit(1)
