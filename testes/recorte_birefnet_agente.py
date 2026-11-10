# v97 (plano docs/planos/2026-11-10-recorte-birefnet-sessoes.md, E1): recorte BiRefNet + a regra do Eduardo.
# Roda com HOME temporário:  HOME=$(mktemp -d) python3 -I testes/recorte_birefnet_agente.py agente/eterna-agente.py
# Sem modelo nenhum: a regra com máscaras desenhadas em numpy (critério 5), o processo de recorte com modelos FALSOS
# (testes/_recorte_filho_falso.py, trocado por m.REC_FILHO) para o PNG, o cache e o filho morto (critérios 1, 2, 3, 6, 7, 8).
# Critério 4 (5 fotos de referência com o BiRefNet de verdade): só com ETERNA_RECORTE_FOTOS=<pasta das fotos> e
# ETERNA_RECORTE_REF=<pasta das máscaras do protótipo>; fotos de cliente nunca no repositório. Pesado: passa de 4,7 GB.
import importlib.util, json, os, sys, tempfile, threading, time, shutil, glob
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
sp2 = importlib.util.spec_from_file_location("eterna_recorte", os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "eterna-recorte.py"))
R = importlib.util.module_from_spec(sp2)
sp2.loader.exec_module(R)
falhas, notas = [], []


def ok(c, msg):
    if not c:
        falhas.append(msg)


# ---------- critério 5: a regra com máscaras sintéticas ----------
H, W = 1000, 800


def base():
    fino, pes = np.zeros((H, W), np.uint8), np.zeros((H, W), np.uint8)
    fino[100:951, 300:501] = 255           # a pessoa (pés em y = 950)
    pes[100:951, 300:501] = 255
    return fino, pes, pes.copy()


def pt(*xy):
    return np.array(xy, dtype=float).reshape(-1, 2)


# a) objeto encostado no punho fica
f, p, i = base()
f[395:406, 500:541] = 255                  # a mão (fora da máscara de pessoa) segurando
f[360:441, 540:661] = 255                  # o objeto
a = R.regra(f, p, i, pt(520, 400))
ok(a[400, 600] == 255 and a[500, 400] == 255, "5a: objeto encostado no punho deveria ficar: %r" % a[400, 600])
a2 = R.regra(f, p, i, pt())
ok(a2[400, 600] == 0, "5a: o mesmo objeto sem punho por perto e com pouco contato sai: %r" % a2[400, 580])
# b) Eduardo (10/11, 21 fotos de campo): o objeto só sai quando está solto. Pedestal com taça grudado por uma ponta, sem
# mão nem braço: sai; com a mão apoiada: fica; abraçado, com o braço atrás (o objeto cobre o membro da pose): fica inteiro
f, p, i = base()
f[500:511, 500:521] = 255                  # ponte curta até o pedestal
f[500:951, 520:601] = 255                  # pedestal até o chão
a = R.regra(f, p, i, pt())
ok(a[800, 560] == 0 and a[500, 400] == 255, "5b: pedestal solto que desce ao chão deveria sair: %r" % a[800, 560])
a = R.regra(f, p, i, pt(525, 505))
ok(a[800, 560] == 255, "5b: pedestal com a mão apoiada fica: %r" % a[800, 560])


def braco_atras(cx_omb, y_omb, cx_cot, y_cot, cx_pun, y_pun, larg=100):
    k = np.zeros((17, 3))
    k[5] = (cx_omb - larg, y_omb, .9)
    k[6] = (cx_omb, y_omb, .9)
    k[8] = (cx_cot, y_cot, .9)                 # cotovelo e punho atrás do pedestal (fora da máscara de pessoa)
    k[10] = (cx_pun, y_pun, .9)
    return k


abraco = braco_atras(480, 250, 560, 600, 640, 640)
a = R.regra(f, p, i, pt(), (), pessoas=[abraco])
ok(a[800, 560] == 255 and a[600, 560] == 255, "5b: pedestal abraçado (braço atrás) fica inteiro: %r" % [a[800, 560], a[600, 560]])
# nunca cortar pessoa: tirando o pedestal solto, o braço que a pose vê encostado nele (fora do u2net) fica
f2, p2, i2 = base()
f2[500:511, 500:521] = 255
f2[500:951, 560:621] = 255                 # pedestal mais afastado
f2[430:441, 500:540] = 255                 # antebraço fora do u2net, até perto do pedestal (sem tocar)
a = R.regra(f2, p2, i2, pt(), (), pessoas=[braco_atras(480, 250, 500, 420, 538, 435)])
ok(a[800, 590] == 0 and a[435, 530] == 255, "5b: o pedestal solto sai e o braço da pose fica: %r" % [a[800, 590], a[435, 530]])
# c) pessoa pequena separada (< 12% do maior) sai
f, p, i = base()
f[800:951, 650:701] = 255
p[800:951, 650:701] = 255
a = R.regra(f, p, p.copy(), pt())
ok(a[880, 675] == 0, "5c: pessoa pequena separada deveria sair: %r" % a[880, 675])


# d) criança separada com ombros >= 0,5 do adulto fica (A4), com os pontos do MoveNet
def pessoa_pose(cx, y_omb, larg, y_quad):
    k = np.zeros((17, 3))
    k[5] = (cx - larg / 2, y_omb, .9)
    k[6] = (cx + larg / 2, y_omb, .9)
    k[11] = (cx - larg / 3, y_quad, .9)
    k[12] = (cx + larg / 3, y_quad, .9)
    return k


adulto, crianca = pessoa_pose(400, 250, 100, 550), pessoa_pose(675, 840, 55, 900)
a = R.regra(f, p, p.copy(), pt(), R.ombros([adulto, crianca]))
ok(a[880, 675] == 255, "5d: criança separada com ombros >= 0,5 do adulto deveria ficar (A4): %r" % a[880, 675])
a = R.regra(f, p, p.copy(), pt(), R.ombros([adulto, pessoa_pose(675, 840, 40, 900)]))
ok(a[880, 675] == 0, "5d: com ombros < 0,5 do adulto (pessoa ao fundo) sai: %r" % a[880, 675])
# e) placa sem sobreposição com gente sai
f, p, i = base()
f[100:301, 50:151] = 255
a = R.regra(f, p, i, pt())
ok(a[200, 100] == 0 and a[500, 400] == 255, "5e: placa solta deveria sair: %r" % a[200, 100])
# f) bandeira enrolada até o chão com contato >= 30% fica
f, p, i = base()
f[300:951, 500:541] = 255
a = R.regra(f, p, i, pt())
ok(a[700, 530] == 255, "5f: bandeira enrolada até o chão (contato grande) deveria ficar: %r" % a[700, 530])
# g) óculos fora do BiRefNet mas no acordo ISNet + u2net, dentro da faixa de 2%: voltam
f, p, i = base()
p[88:101, 280:331] = 255
i[88:101, 280:331] = 255
a = R.regra(f, p, i, pt())
ok(a[94, 300] == 255 and a[94, 285] == 255, "5g: óculos do acordo ISNet + u2net deveriam voltar: %r" % [a[94, 300], a[94, 285]])
i2 = i.copy()
i2[88:101, 280:331] = 0
ok(R.regra(f, p, i2, pt())[94, 300] == 0, "5g: sem o acordo (só o u2net) não volta")
# j) bandeira furada (Colo-Colo, 10/11): buraco interno de objeto grudado, sem a cor do fundo, é preenchido e sólido
rgbf = np.zeros((H, W, 3), np.uint8)
rgbf[:] = (40, 120, 60)                    # fundo verde
f, p, i = base()
f[150:451, 500:761] = 255                  # bandeira aberta grudada na pessoa
rgbf[150:451, 500:761] = (240, 240, 240)
f[250:351, 590:671] = 0                    # o miolo saiu furado no BiRefNet
rgbf[250:351, 590:671] = (200, 30, 30)     # escudo vermelho (não é o fundo)
a = R.regra(f, p, i, pt(520, 300), rgb=rgbf)
ok(a[300, 630] == 255 and a[200, 700] == 255, "5j: miolo furado da bandeira preenchido: %r" % [a[300, 630], a[200, 700]])
rgbv = rgbf.copy()
rgbv[250:351, 590:671] = (40, 120, 60)     # o "buraco" mostra o fundo de fora: vão de verdade, fica aberto
ok(R.regra(f, p, i, pt(520, 300), rgb=rgbv)[300, 630] == 0, "5j: buraco com a cor do fundo de fora fica aberto")
iv = i.copy()
iv[250:351, 590:671] = 255                 # o ISNet vê primeiro plano no miolo: preenche mesmo com cor parecida
ok(R.regra(f, p, iv, pt(520, 300), rgb=rgbv)[300, 630] == 255, "5j: com o apoio do ISNet o miolo é preenchido")
# k) vão real entre braço e corpo (cercado de pessoa) nunca é preenchido
f, p, i = base()
for m_ in (f, p):
    m_[300:321, 500:621] = 255             # braço saindo
    m_[300:501, 600:621] = 255             # antebraço descendo
    m_[480:501, 500:621] = 255             # mão voltando ao quadril
a = R.regra(f, p, p.copy(), pt(), rgb=rgbf)
ok(a[400, 550] == 0 and a[310, 550] == 255, "5k: vão entre braço e corpo fica aberto: %r" % a[400, 550])
# h) máscara de pessoa vazia: o maior componente do BiRefNet (A5)
f, p, i = base()
f[100:201, 600:701] = 255
a = R.regra(f, np.zeros_like(p), i, pt())
ok(a[500, 400] == 255 and a[150, 650] == 0, "5h: sem pessoa, fica o maior componente: %r" % [a[500, 400], a[150, 650]])
ok(not R.regra(np.zeros_like(f), np.zeros_like(p), i, pt()).any(), "5h: nada na foto: alfa vazio (sem_pessoa)")
# i) 200 pedaços grudados terminam em menos de 2 s (teto de 64 pedaços e 1,5 s)
Hg, Wg = 1000, 3000
fg = np.full((Hg, Wg), 255, np.uint8)
pg = np.zeros((Hg, Wg), np.uint8)
for y in range(0, Hg, 115):
    pg[y:y + 4, :] = 255
for x in range(0, Wg, 115):
    pg[:, x:x + 4] = 255
info = []
t0 = time.time()
a = R.regra(fg, pg, pg.copy(), pt(), (), info)
dt = time.time() - t0
npd = sum(1 for l in info if "pedaço" in l)
ok(dt < 2.0 and any("teto" in l for l in info), "5i: 200 pedaços grudados em %.2f s (teto 2 s), avaliados %d: %r" % (dt, npd, info[-3:]))
notas.append("regra com %s pedaços: %.2f s" % (npd, dt))

# ---------- critérios 1 e 2: sem o BiRefNet ou sem o MoveNet certo, 503 com o motivo ----------
vazio = tempfile.mkdtemp()
os.environ["REMBG_HOME"] = vazio
os.environ["U2NET_HOME"] = vazio
okk, mot = m.rec_estado()
ok(not okk and "birefnet-general" in (mot or ""), "1: sem modelos, o motivo cita o birefnet: %r" % mot)
for n in ("u2net_human_seg", "isnet-general-use"):
    os.makedirs(os.path.join(vazio, "models", n))
    with open(os.path.join(vazio, "models", n, n + ".onnx"), "wb") as fh:
        fh.write(b"\0" * 1_100_000)
okk, mot = m.rec_estado()
ok(not okk and "birefnet-general" in mot and "isnet" not in mot, "1: só sem o BiRefNet: indisponível e o motivo cita só ele: %r" % mot)
os.makedirs(os.path.join(vazio, "models", "birefnet-general"))
with open(os.path.join(vazio, "models", "birefnet-general", "birefnet-general.onnx"), "wb") as fh:
    fh.write(b"\0" * 1_100_000)
okk, mot = m.rec_estado()
ok(not okk and "modelo de pose" in (mot or ""), "2: sem o MoveNet: %r" % mot)
os.makedirs(m.MODELOS, exist_ok=True)
pose = os.path.join(m.MODELOS, m.REC_POSE)
with open(pose, "wb") as fh:
    fh.write(b"nao e o movenet")
okk, mot = m.rec_estado()
ok(not okk and "modelo de pose" in (mot or "") and "diferente" in mot, "2: MoveNet com SHA diferente: %r" % mot)
ok("scipy" not in json.dumps(m.rec_estado()) and m.REC_MODELOS[0] == "birefnet-general", "1: sem scipy, BiRefNet primeiro")
ok("instalar-recorte" in m.REC_COMO and "1,3 GB" in m.REC_COMO and "movenet" in m.REC_COMO and "birefnet-general" in m.REC_COMO, "1: texto do como: " + m.REC_COMO)
st = m.rec_status()
ok(st["modelo"] == "birefnet-general" and st["versao"] == "birefnet-1" and "movenet_multipose_lightning_1" in st["auxiliares"]
   and st["provedor"] is None and st["filho"] == {"vivo": False, "reinicios": 0} and st["ok"] is False, "1: /status.recorte sem modelos: %r" % st)
src = open(sys.argv[1], encoding="utf-8").read()
ok("rec_limpa_mascara" not in src and "rec_sem_soltos" not in src and "REC_SINAL" not in src, "E1: o recorte antigo saiu do agente")
topo = src.split("# ---------- reconhecimento facial", 1)[0]
ok("import rembg" not in topo and "import onnxruntime" not in topo, "rembg/onnxruntime não podem ser importados no topo")

# ---------- critérios 3, 6 e 8: processo de recorte (modelos falsos) ----------
m.rec_estado = lambda: (True, None)            # os modelos de verdade não estão aqui; o filho falso não precisa deles
m.REC_FILHO = os.path.join(AQUI, "_recorte_filho_falso.py")
dia = time.strftime("%Y-%m-%d")
ib = os.path.join(m.INBOX, dia)
os.makedirs(ib, exist_ok=True)


def foto(pid, tam=(4500, 3000), exif=None):
    im = Image.new("RGB", tam, (20, 90, 30))
    from PIL import ImageDraw
    ImageDraw.Draw(im).rectangle([tam[0] // 3, tam[1] // 5, tam[0] // 2, tam[1] - 1], fill=(220, 60, 60))   # a "pessoa"
    f_ = os.path.join(ib, pid + "_IMG.jpg")
    im.save(f_, quality=85, **({"exif": exif} if exif else {}))
    with m.lock:
        m.lib[pid] = {"file": f_, "thumb": f_}
    return f_


f1 = foto("a97000000001")
p1 = m.rec_fazer("a97000000001", f1)
im = Image.open(p1)
ok(im.mode == "RGBA" and im.size == (3000, 2000), "6: PNG RGBA de 3000: %r" % ((im.mode, im.size),))
arr = np.asarray(im)
ok(int(arr[arr[:, :, 3] == 0][:, :3].max()) == 0 and (arr[:, :, 3] == 255).any(), "6: RGB zerado onde o alfa é 0")
ok(oct(os.stat(p1).st_mode & 0o777) == "0o600", "6: permissão 600: %s" % oct(os.stat(p1).st_mode & 0o777))
p24 = m.rec_fazer("a97000000001", f1, 2400)
ok(Image.open(p24).size == (2400, 1600) and oct(os.stat(p24).st_mode & 0o777) == "0o600", "6: cópia de 2400 com 600")
ok(not glob.glob(os.path.join(m.RECORTES, "*.tmp")) and not glob.glob(os.path.join(m.RECORTES, ".rec-*")), "6: nenhum .tmp sobra: %r" % os.listdir(m.RECORTES))
st = m.rec_status()
ok(st["provedor"] == "cpu" and st["carregado"] and st["filho"]["vivo"] and st["etapas_ms"] and "regra" in st["etapas_ms"] and st["feitos"] == 1,
   "3: provedor e etapas depois da primeira foto: %r" % st)
ok(isinstance(st["pico_mb"], int) or st["pico_mb"] is None, "3: pico_mb do filho: %r" % st["pico_mb"])
# EXIF de orientação aplicado (no filho)
ex = Image.Exif()
ex[0x0112] = 6
f2 = foto("a97000000002", (900, 600), ex.tobytes())
ok(Image.open(m.rec_fazer("a97000000002", f2)).size == (600, 900), "6: EXIF de orientação aplicado no filho")
# caminho fora da inbox: o filho recusa
fora = os.path.join(tempfile.mkdtemp(), "x_IMG.jpg")
shutil.copyfile(f2, fora)
try:
    m.rec_fazer("a97000000003", fora)
    ok(False, "contrato: origem fora da inbox deveria ser recusada")
except ValueError as e_:
    ok("caminho_recusado" in str(e_), "contrato: origem fora da inbox: %r" % e_)
# foto grande demais: recusada antes de decodificar
fg_ = os.path.join(ib, "a97000000004_IMG.png")
Image.new("RGB", (8000, 5100)).save(fg_)
try:
    m.rec_fazer("a97000000004", fg_)
    ok(False, "contrato: imagem acima de 40 MP deveria ser recusada")
except ValueError as e_:
    ok("imagem_grande" in str(e_), "contrato: imagem grande: %r" % e_)
# foto sem ninguém: sem_pessoa (o filho segue vivo)
fv_ = os.path.join(ib, "a97000000005_IMG.jpg")
Image.new("RGB", (600, 400), (10, 10, 200)).save(fv_)
try:
    m.rec_fazer("a97000000005", fv_)
    ok(False, "contrato: sem ninguém deveria dar sem_pessoa")
except ValueError as e_:
    ok("sem_pessoa" in str(e_) and m.rec_status()["filho"]["vivo"], "contrato: sem_pessoa sem matar o filho: %r" % e_)

# 8. filho morto (kill -9 no meio de uma foto): o agente segue; rec.erro com o motivo; depois do prazo, reabre e recorta
m._rec_filho_matar(m.rec_filhos[0])
os.environ["RECORTE_FALSO_DORMIR"] = "3"
f6 = foto("a97000000006", (900, 600))
res = {}
th = threading.Thread(target=lambda: res.update(r=m.rec_pedir("a97000000006", f6)))
th.start()
pid_filho = None
for _ in range(100):
    time.sleep(0.05)
    fl = m.rec_filhos.get(0)
    if fl and fl["p"] is not None and m.rec["carregado"]:
        pid_filho = fl["p"].pid
        break
time.sleep(0.5)
os.kill(pid_filho, 9)
th.join(10)
del os.environ["RECORTE_FALSO_DORMIR"]
st = m.rec_status()
ok(res.get("r") and res["r"][0] is None and "memória insuficiente" in (res["r"][1] or ""), "8: pedido no meio do kill: %r" % res)
ok(m.rec["erro"] and "memória insuficiente" in m.rec["erro"] and not st["filho"]["vivo"], "8: rec.erro com o motivo: %r %r" % (m.rec["erro"], st["filho"]))
m.REC_ERRO_SEG = 1
m.rec_estado = lambda: (True, None) if time.time() - m.rec["erro_em"] >= m.REC_ERRO_SEG else (False, m.rec["erro"])
time.sleep(1.1)
r2, e2 = m.rec_pedir("a97000000006", f6)
ok(r2 and not e2 and os.path.exists(r2), "8: depois do prazo a próxima foto reabre o filho e recorta: %r" % ((r2, e2),))
ok(m.rec_status()["filho"]["reinicios"] >= 1, "8: reinícios contados: %r" % m.rec_status()["filho"])
# filho que não abre os modelos: erro com o motivo, sem travar
m._rec_filho_matar(m.rec_filhos[0])
os.environ["RECORTE_FALSO_NAO_ABRE"] = "1"
try:
    m.rec_carregar()
    ok(False, "filho que não abre deveria dar erro")
except RuntimeError:
    ok("não abriram" in (m.rec["erro"] or ""), "filho que não abre: %r" % m.rec["erro"])
del os.environ["RECORTE_FALSO_NAO_ABRE"]
m._rec_filho_matar(m.rec_filhos[0])

# ---------- critério 7: versão do cache ----------
alvo = os.path.join(tempfile.mkdtemp(), "fora.png")
open(alvo, "w").write("x")
os.symlink(alvo, os.path.join(m.RECORTES, "link.png"))
open(os.path.join(m.RECORTES, "velho.tmp"), "w").write("x")
open(os.path.join(m.RECORTES, "outro.txt"), "w").write("x")
n1 = m.rec_versao_cache()
rest = sorted(os.listdir(m.RECORTES))
ok(n1 >= 4 and rest == [".versao", "outro.txt"] and os.path.exists(alvo), "7: primeira partida apaga os PNG e .tmp (link desfeito, alvo fica): %r %r" % (n1, rest))
ok(open(os.path.join(m.RECORTES, ".versao")).read() == "birefnet-1" and oct(os.stat(os.path.join(m.RECORTES, ".versao")).st_mode & 0o777) == "0o600", "7: marca birefnet-1 com 600")
open(os.path.join(m.RECORTES, "a97000000001.png"), "w").write("x")
ok(m.rec_versao_cache() == 0 and os.path.exists(os.path.join(m.RECORTES, "a97000000001.png")), "7: segunda partida não apaga nada")
open(os.path.join(m.RECORTES, ".versao"), "w").write("isnet-0")
ok(m.rec_versao_cache() == 1, "7: marca antiga apaga de novo")
# a limpeza de hora em hora nunca apaga a marca (nem velha) nem o .tmp do recorte em andamento
velho_ = time.time() - 3 * 86400
os.utime(os.path.join(m.RECORTES, ".versao"), (velho_, velho_))
open(os.path.join(m.RECORTES, ".rec-andamento.tmp"), "w").write("x")
m.limpar_recortes(guardar=set())
ok(os.path.exists(os.path.join(m.RECORTES, ".versao")) and os.path.exists(os.path.join(m.RECORTES, ".rec-andamento.tmp")), "7: limpar_recortes guarda a .versao e o .tmp em andamento: %r" % os.listdir(m.RECORTES))
ok(m.rec_versao_cache() == 0, "7: depois da limpeza a partida não apaga o cache")

# ---------- critério 9 (parte): CPU -> rec_pre_escolha só com as bases ----------
with m.rec_lock:
    m.rec["provedor"] = "cpu"
ok(m.rec_pre_escolha(["a", "b", "c", "d"], {"ia": ["a", "b"]}) == ["a", "b"], "9: CPU: só as bases")
with m.rec_lock:
    m.rec["provedor"] = "cuda"
ok(m.rec_pre_escolha(["a", "b", "c", "d"], {"ia": ["a", "b"]}) == ["a", "b", "c", "d"], "9: GPU: bases e as 2 normais do plano B")
ok(m.rec_pre_escolha(["a", "b", "c"], {"ia": []}) == ["a", "b"], "9: leva sem bases: as 2 primeiras")

# ---------- critério 4: 5 fotos de referência com o BiRefNet de verdade (só com as variáveis) ----------
FOTOS, REF = os.environ.get("ETERNA_RECORTE_FOTOS"), os.environ.get("ETERNA_RECORTE_REF")
if FOTOS and REF:
    m.rec_estado = lambda: (True, None)
    m.REC_FILHO = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), "eterna-recorte.py")
    m.REC_ERRO_SEG = 60
    with m.rec_lock:
        m.rec.update(erro=None, provedor=None)
    for k in ("REMBG_HOME", "U2NET_HOME"):
        os.environ.pop(k, None)
    for k in ("ETERNA_RECORTE_REMBG_HOME", "ETERNA_RECORTE_U2NET_HOME"):
        if os.environ.get(k):
            os.environ[k.replace("ETERNA_RECORTE_", "")] = os.environ[k]
    shutil.copyfile(os.environ.get("ETERNA_RECORTE_MOVENET") or os.path.join(os.path.dirname(FOTOS.rstrip("/")), "modelos", m.REC_POSE), pose)
    res = {}
    for i, f_ in enumerate(sorted(glob.glob(os.path.join(FOTOS, "*.jpg"))), 1):
        nome = os.path.splitext(os.path.basename(f_))[0]
        pid = "b97%09d" % i
        dst = os.path.join(ib, pid + "_IMG.jpg")
        shutil.copyfile(f_, dst)
        t0 = time.time()
        try:
            pr = m.rec_fazer(pid, dst)
        except Exception as ex:
            ok(False, "4: %s não recortou: %s" % (nome, ex))
            continue
        nosso = Image.open(pr).getchannel("A")
        ref = Image.open(os.path.join(REF, nome + ".png")).getchannel("A")
        a1 = np.asarray(nosso.resize(ref.size, Image.LANCZOS)) >= 128
        a2 = np.asarray(ref) >= 128
        iou = (a1 & a2).sum() / max(1, (a1 | a2).sum())
        res[nome] = {"iou": round(float(iou), 4), "s": round(time.time() - t0, 1), "etapas": m.rec_status()["etapas_ms"], "pico_mb": m.rec_status()["pico_mb"]}
        print("  %s: IoU %.4f, %.1f s, %r, pico %s MB" % (nome, iou, time.time() - t0, res[nome]["etapas"], res[nome]["pico_mb"]), file=sys.stderr)
        ok(iou >= 0.98, "4: %s IoU %.4f < 0,98" % (nome, iou))
        if os.environ.get("ETERNA_RECORTE_SAIDA"):
            shutil.copyfile(pr, os.path.join(os.environ["ETERNA_RECORTE_SAIDA"], nome + ".png"))
    notas.append("referência: " + json.dumps(res))
    m._rec_filho_matar(m.rec_filhos[0])
else:
    notas.append("fotos de referência fora (ETERNA_RECORTE_FOTOS e ETERNA_RECORTE_REF): critério 4 pulado")

for f_ in list(m.rec_filhos.values()):
    m._rec_filho_matar(f_)
if falhas:
    print("FALHA recorte BiRefNet (agente): " + " | ".join(falhas))
    sys.exit(1)
print("OK recorte BiRefNet (agente): regra sintética (a a i), 503 sem BiRefNet ou MoveNet, filho com PNG 3000/2400 600, cache por versão, filho morto e reaberto · " + " · ".join(notas))
