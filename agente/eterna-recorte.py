#!/usr/bin/env python3
# Eterna · processo de recorte dos fundos de IA (v97). Roda como FILHO do agente do ponto (eterna-agente.py), nunca sozinho
# na operação: o BiRefNet em CPU passa de 4,7 GB de memória, e se o sistema matar este processo por falta de memória o
# agente (FTP, vendas, Checkout) continua de pé e reabre o recorte depois.
#
# Regra do Eduardo (docs/fundos-ia-regras.md, regra 16): fica a pessoa e tudo que encosta nela (troféu na mão, bandeira,
# boné, óculos, relógio, bolsa, criança no colo); sai o que está solto (troféu no pedestal, pedestal, placas, pessoas ao
# fundo, fundo). Etapas, todas na imagem de trabalho (lado até 1600 px):
#   1) BiRefNet-general (rembg)       -> máscara fina de primeiro plano (contorno)
#   2) u2net_human_seg (rembg)        -> onde há gente
#      MoveNet MultiPose (ONNX)       -> punhos (o que está NA MÃO) e ombros (criança separada do grupo, A4)
#   3) componentes da máscara fina: fica o que encosta em gente; pedaço grudado que não está na mão e desce até o chão
#      (pedestal) sai
#   4) borda: soma o que ISNet E u2net concordam ser primeiro plano numa faixa estreita em volta (óculos na cabeça)
# A máscara volta ao tamanho final (lado até 3000 px) e o PNG leva só a pessoa (RGB zerado onde o alfa é 0).
#
# Contrato (uma linha JSON por mensagem; stdout é só do protocolo, qualquer print de biblioteca vai para o stderr):
#   -> {"pronto":true,"provedor":"cuda|cpu","modelos":[...],"carga_ms":N}       (uma vez, ao abrir)
#   -> {"pronto":false,"erro":"..."}                                            (não abriu; o processo termina)
#   <- {"id":"<pid>","origem":"<caminho>","destino":"<caminho 3000>","trab":1600}
#   -> {"id":"<pid>","ok":true,"ms":{...},"pico_mb":N,"pessoas":K,"trunc":bool,"borda":[...],"luz":{...},"joelho":f|null,"pernas":bool}
#   -> {"id":"<pid>","ok":false,"erro":"sem_pessoa|imagem_grande|caminho_recusado|..."}
# Caminhos só dentro de --inbox (origem) e --recortes (destino), conferidos com realpath. Nunca abre porta, nunca baixa
# modelo (quem baixa é o instalador). Só numpy, Pillow, opencv-python-headless, onnxruntime e rembg; nada do agente.
#
# 18/11 (regra 19, reconhecer o gramado pela imagem): o mesmo arquivo roda como OUTRO processo com --modo cena. Abre só o
# modelo de cena (CLIP ViT-B/32, a torre de imagem em ONNX, em --modelos com o SHA-256 que o agente passa em --cena-sha) e
# NÃO importa o rembg. Lê só miniaturas dentro de --inbox ou --thumbs (realpath). Contrato:
#   -> {"pronto":true,"modo":"cena","provedor":"cuda|cpu","modelo":"clip-b32","sha":"<64 hex>","carga_ms":N}
#   -> {"pronto":false,"erro":"sem_modelo|..."}
#   <- {"id":"c.17","tipo":"cena","itens":[{"pid":"ab12cd34ef56","origem":"<thumbs>/ab12cd34ef56.jpg"}]}      (até 16)
#   -> {"id":"c.17","ok":true,"ms":{...},"res":[{"pid","vet":"<base64 de 512 float16>","verde":0.12,"sinais":{...}}|{"pid","erro"}]}
import os
import sys
import json
import time
import re
import tempfile
import hashlib
import threading

LIMIAR = 128             # 0..255, binarização das máscaras
SOBREPOSICAO_MIN = 0.05  # componente da máscara fina precisa ter >= 5% dentro da máscara de pessoas
FAIXA_PESSOA = 0.015     # dilatação da máscara de pessoas = 1,5% da altura da imagem
RAIO_MAO = 0.04          # objeto "na mão" se encosta num raio de 4% da altura em volta de um punho
FAIXA_REFINO = 0.02      # faixa (2% da altura) em volta do recorte onde ISNet + u2net podem somar
FUNDO_PEQUENO = 0.12     # componente separado com < 12% da área do maior e que não encosta = pessoa ao fundo
OMBROS_CRIANCA = 0.5     # A4: componente pequeno e separado fica se tem uma pessoa com ombros >= 0,5 da maior da foto
PROTEGE_PESSOA = 0.004   # (10/11, braço cortado) ao tirar um objeto, a pessoa (u2net dilatada 0,4% da altura) e os membros da pose ficam
MEMBRO_ESP = 0.30        # espessura do membro da pose = 30% da largura dos ombros (sem ombros: 2% da altura)
BURACO_MAX = 0.04        # (10/11, bandeira furada) buraco interno de objeto grudado preenchido até 4% da imagem
BURACO_OBJ = 0.5         # ...se pelo menos metade da borda dele é objeto (não pessoa: o vão entre braço e corpo é cercado de pessoa)
BURACO_COR = 30          # ...e a cor dele não é a do fundo de fora (distância RGB média abaixo disto = fundo vazando: não preenche)
BURACOS_MAX = 200        # teto de custo: buracos avaliados por foto
GRUDADOS_MAX = 64        # teto de custo: no máximo 64 pedaços avaliados no passo "grudados" (o resto fica)
REGRA_SEG = 1.5          # e no máximo 1,5 s na regra (o que não foi avaliado fica)
TRAB = 1600              # maior lado da imagem entregue aos modelos
LADO_MAX = 3000          # maior lado do PNG
MAX_PIXELS = 40_000_000  # igual ao do agente: acima disso a foto é recusada antes de decodificar
MODELOS = ("birefnet-general", "u2net_human_seg", "isnet-general-use")
# 18/11 (regra 19): medidas do recorte para escolher a base dos fundos de IA (o agente decide com os limites dele)
BORDA_MIN = 0.02         # a pessoa "encosta" na borda esquerda, direita ou de cima se a máscara ocupa 2% daquele lado na faixa de 1%
PONTO_POSE = 0.3         # confiança mínima de um ponto do MoveNet para joelho, tornozelo e rosto
CENA_LOTE = 16           # fotos por mensagem no modo cena
CENA_LADO = 224          # entrada do CLIP
CENA_MEDIA = (0.48145466, 0.4578275, 0.40821073)
CENA_DESVIO = (0.26862954, 0.26130258, 0.27577711)
POSE = "movenet_multipose_lightning_1.onnx"
POSE_SHA = "61c25a6fc887b0e8d14517c3d66fdaf36c0e7a7ec0d50f74ed41a32ca1485184"
_re_destino = re.compile(r"^(ag_)?[0-9a-f]{6,40}\.png$")


def opcoes_ort(ort):
    so = ort.SessionOptions()
    # economiza memória (BiRefNet-general em 1024x1024 passa de 5 GB com o arena padrão)
    so.enable_cpu_mem_arena = False
    so.enable_mem_pattern = False
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    so.intra_op_num_threads = max(1, (os.cpu_count() or 2) - 1)   # um núcleo fica para o FTP, os rostos e a tela
    return so


def modelo_rembg(nome):
    """Arquivo do modelo do rembg já baixado, ou None (mesma busca do agente: o filho nunca baixa)."""
    novos = os.path.expanduser(os.environ.get("REMBG_HOME") or "~/.rembg")
    antigos = os.path.expanduser(os.environ.get("U2NET_HOME") or "~/.u2net")
    for c in (os.path.join(novos, "models", nome, nome + ".onnx"), os.path.join(antigos, "models", nome, nome + ".onnx"),
              os.path.join(antigos, nome + ".onnx")):
        if os.path.isfile(c) and os.path.getsize(c) > 1_000_000:
            return c
    return None


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


class Pose:
    """MoveNet MultiPose Lightning (17 pontos COCO, até 6 pessoas). Roda em 3 escalas e junta (igual ao protótipo)."""
    def __init__(self, caminho, ort):
        self.s = ort.InferenceSession(caminho, providers=["CPUExecutionProvider"])

    def __call__(self, rgb, escalas=(256, 384, 512), lim_pessoa=0.15):
        import numpy as np
        import cv2
        h, w = rgb.shape[:2]
        pessoas = []
        for L in escalas:
            e = L / max(h, w)
            nh, nw = int(round(h * e / 32) * 32), int(round(w * e / 32) * 32)
            o = self.s.run(None, {"input": cv2.resize(rgb, (nw, nh)).astype("int32")[None]})[0][0]
            for p in o:
                if p[55] < lim_pessoa:
                    continue
                k = p[:51].reshape(17, 3)
                pessoas.append(np.stack([k[:, 1] * w, k[:, 0] * h, k[:, 2]], 1))
        return pessoas


def punhos(pessoas, lim=0.2):
    import numpy as np
    pts = [(x, y) for k in pessoas for j in (9, 10) for x, y, c in [k[j]] if c >= lim]
    return np.array(pts, dtype=float).reshape(-1, 2)


def ombros(pessoas, lim=0.2):
    """A4: pontos de ombro e quadril (5, 6, 11, 12) das pessoas com largura de ombros >= OMBROS_CRIANCA da maior da foto."""
    larg = []
    for k in pessoas:
        if k[5][2] >= lim and k[6][2] >= lim:
            larg.append((float(((k[5][0] - k[6][0]) ** 2 + (k[5][1] - k[6][1]) ** 2) ** 0.5), k))
    if not larg:
        return []
    mx = max(lg for lg, _ in larg)
    return [(float(k[j][0]), float(k[j][1])) for lg, k in larg if mx > 0 and lg >= OMBROS_CRIANCA * mx
            for j in (5, 6, 11, 12) if k[j][2] >= lim]


_MEMBROS = ((5, 7), (7, 9), (6, 8), (8, 10), (11, 13), (13, 15), (12, 14), (14, 16))
_VAOS = ((5, 7, 9, 11), (6, 8, 10, 12), (11, 13, 15, 16, 14, 12))   # entre braço e tronco (dos dois lados) e entre as pernas


def pose_mascaras(pessoas, h, w, lim=0.2):
    """(membros, vaos) uint8 h x w: os segmentos ombro-cotovelo-punho e quadril-joelho-tornozelo com espessura proporcional
    aos ombros, e os polígonos dos vãos reais entre braço e tronco e entre as pernas."""
    import numpy as np
    import cv2
    mem = np.zeros((h, w), np.uint8)
    vao = np.zeros((h, w), np.uint8)
    for k in pessoas or ():
        lg = float(((k[5][0] - k[6][0]) ** 2 + (k[5][1] - k[6][1]) ** 2) ** 0.5) if k[5][2] >= lim and k[6][2] >= lim else 0
        esp = max(3, int(MEMBRO_ESP * lg) if lg else int(0.02 * h))
        for a, b in _MEMBROS:
            if k[a][2] >= lim and k[b][2] >= lim:
                cv2.line(mem, (int(k[a][0]), int(k[a][1])), (int(k[b][0]), int(k[b][1])), 1, esp)
        for pol in _VAOS:
            if all(k[j][2] >= lim for j in pol):
                cv2.fillPoly(vao, [np.array([[int(k[j][0]), int(k[j][1])] for j in pol], np.int32)], 1)
    return mem > 0, vao > 0


def _buracos(manter, obj, isnet, pessoa, rgb, vao, h, w, log):
    """(10/11, bandeira do Colo-Colo furada) buracos internos (fundo cercado, sem tocar a borda nem o fundo de fora) com a
    borda em pelo menos metade de OBJETO grudado (não de pessoa), até BURACO_MAX da imagem: preenchidos. Não preenche o
    vão real: buraco sobre o vão entre membros da pose, ou com a cor do fundo de fora (sem apoio do ISNet/u2net)."""
    import numpy as np
    import cv2
    inv = (~manter).astype("uint8")
    n, lab, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    fora = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]])).tolist())
    cand = [c for c in range(1, n) if c not in fora and st[c, cv2.CC_STAT_AREA] <= BURACO_MAX * h * w]
    cand = sorted(cand, key=lambda c: -st[c, cv2.CC_STAT_AREA])[:BURACOS_MAX]
    cheio = np.zeros_like(manter)
    fundo_cor = None
    for c in cand:
        x0, y0, cw, ch = st[c, 0], st[c, 1], st[c, 2], st[c, 3]
        X0, Y0, X1, Y1 = max(0, x0 - 2), max(0, y0 - 2), min(w, x0 + cw + 2), min(h, y0 + ch + 2)
        B = lab[Y0:Y1, X0:X1] == c
        anel = (cv2.dilate(B.astype("uint8"), np.ones((3, 3), "uint8")) > 0) & ~B
        if anel.sum() == 0 or (anel & obj[Y0:Y1, X0:X1]).sum() < BURACO_OBJ * anel.sum():
            continue                                 # cercado de pessoa: vão entre braço e corpo, entre as pernas
        area = int(B.sum())
        if vao is not None and (B & vao[Y0:Y1, X0:X1]).sum() > 0.2 * area:
            log.append("  buraco %d px sobre o vão entre membros: fica aberto" % area)
            continue
        apoio = float(np.maximum(isnet[Y0:Y1, X0:X1], pessoa[Y0:Y1, X0:X1])[B].mean()) >= 128
        if not apoio and rgb is not None:
            if fundo_cor is None:                    # cor média do fundo de fora (o que toca a borda da foto)
                F = np.isin(lab, list(fora - {0})) if len(fora - {0}) else ~manter
                fundo_cor = rgb[F].reshape(-1, 3).mean(0) if F.any() else np.array([-999.0] * 3)
            cor = rgb[Y0:Y1, X0:X1][B].reshape(-1, 3).mean(0)
            if float(np.abs(cor - fundo_cor).mean()) < BURACO_COR:
                log.append("  buraco %d px com a cor do fundo de fora: fica aberto" % area)
                continue
        cheio[Y0:Y1, X0:X1] |= B
        log.append("  buraco %d px dentro de objeto: preenchido" % area)
    return cheio


def regra(fino, pessoa, isnet, pts_mao, ancoras=(), info=None, limite_seg=REGRA_SEG, max_pedacos=GRUDADOS_MAX, rgb=None, pessoas=None):
    """fino/pessoa/isnet: uint8 0..255 (mesmo tamanho). pts_mao: punhos (N x 2). ancoras: pontos (x, y) de ombro e
    quadril das pessoas grandes (A4). Devolve o alfa uint8. Cópia fiel de recorte2.regra do protótipo validado, com:
    (a) A4: componente pequeno e separado que contém uma âncora fica (criança separada do grupo);
    (b) A5: sem pixel de pessoa, fica o maior componente do BiRefNet (melhor levar a foto do que tirá-la da venda);
    (c) teto de custo: no máximo max_pedacos pedaços avaliados no passo "grudados" e limite_seg no total (o resto fica);
    (d) 10/11 (21 fotos de campo, decisão do Eduardo): objeto grudado só sai quando está solto: com mão apoiada, contato de
    10% ou mais, ou braço atrás ou na frente dele (membro da pose), fica inteiro; ao tirar, a pessoa (u2net dilatada) e os
    membros nunca saem; buraco interno de objeto grudado (bandeira furada) é preenchido (_buracos).
    rgb (a foto de trabalho) e pessoas (MoveNet) são opcionais: sem eles, (d) usa só o u2net."""
    import numpy as np
    import cv2
    t0 = time.time()
    h, w = fino.shape
    log = []
    F = fino >= LIMIAR
    P = pessoa >= LIMIAR
    if not P.any():                                  # (b) A5
        n, lab, st, _ = cv2.connectedComponentsWithStats(F.astype("uint8"), 8)
        if n < 2:
            return np.zeros_like(fino)
        c = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        km = (lab == c).astype("uint8")
        zona = cv2.dilate(km, np.ones((9, 9), "uint8")) > 0
        if info is not None:
            info.append("sem pessoa no u2net: fica o maior componente do BiRefNet (A5)")
        return np.where(zona, fino, 0).astype("uint8")
    d = max(3, int(FAIXA_PESSOA * h))
    kd = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * d + 1, 2 * d + 1))
    Pd = cv2.dilate(P.astype("uint8"), kd) > 0
    membros, vao = pose_mascaras(pessoas, h, w) if pessoas else (np.zeros((h, w), bool), None)
    dp = max(2, int(PROTEGE_PESSOA * h))
    Prot = (cv2.dilate(P.astype("uint8"), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dp + 1, 2 * dp + 1))) > 0) | membros
    n, lab, st, _ = cv2.connectedComponentsWithStats(F.astype("uint8"), 8)
    manter = np.zeros_like(F)
    comps = []
    for c in range(1, n):
        area = st[c, cv2.CC_STAT_AREA]
        if area < 0.0005 * h * w:
            continue
        x0, y0, cw, ch = st[c, 0], st[c, 1], st[c, 2], st[c, 3]
        sub = lab[y0:y0 + ch, x0:x0 + cw] == c
        ov = (sub & P[y0:y0 + ch, x0:x0 + cw]).sum() / area
        comps.append((c, area, ov))
    maior = max([a for _, a, ov in comps if ov >= SOBREPOSICAO_MIN], default=0)
    for c, area, ov in comps:
        if ov < SOBREPOSICAO_MIN:
            log.append("comp %d: solto (só %.0f%% em pessoa) -> sai" % (c, 100 * ov))
            continue
        if area < FUNDO_PEQUENO * maior:
            anc = any(0 <= int(y) < h and 0 <= int(x) < w and lab[int(y), int(x)] == c for x, y in ancoras)
            if not anc:
                log.append("comp %d: pequeno e separado (%.0f%% do maior) -> pessoa ao fundo, sai" % (c, 100 * area / maior))
                continue
            log.append("comp %d: pequeno e separado, mas com ombros de pessoa grande (A4) -> fica" % c)
        manter |= lab == c
        log.append("comp %d: pessoa (%.0f%%) -> fica" % (c, 100 * ov))
    # pedaços grudados que não são gente: decide se estão na mão / no corpo ou apoiados no chão
    E = manter & ~Pd
    pes_y = np.nonzero(P.any(1))[0].max() if P.any() else h
    ne, le, se, _ = cv2.connectedComponentsWithStats(E.astype("uint8"), 8)
    r_mao = RAIO_MAO * h
    pedacos = sorted((c for c in range(1, ne) if se[c, cv2.CC_STAT_AREA] >= 0.002 * h * w),
                     key=lambda c: -se[c, cv2.CC_STAT_AREA])
    if len(pedacos) > max_pedacos:
        log.append("teto: %d pedaços grudados, só os %d maiores avaliados (o resto fica)" % (len(pedacos), max_pedacos))
        pedacos = pedacos[:max_pedacos]
    mg = d + 3                                       # margem do recorte local (dilatações de d e de 5x5)
    for c in pedacos:
        if time.time() - t0 > limite_seg:
            log.append("teto de tempo: pedaços restantes ficam")
            break
        area = se[c, cv2.CC_STAT_AREA]
        x0, y0, cw, ch = se[c, 0], se[c, 1], se[c, 2], se[c, 3]
        X0, Y0, X1, Y1 = max(0, x0 - mg), max(0, y0 - mg), min(w, x0 + cw + mg), min(h, y0 + ch + mg)
        R = le[Y0:Y1, X0:X1] == c
        ys, xs = np.nonzero(R)
        ys = ys + Y0
        # distância mínima entre o pedaço e algum punho (só importa se for <= r_mao: fora da caixa + r_mao, longe)
        dm = np.inf
        if len(pts_mao):
            perto = [(x, y) for x, y in pts_mao if x0 - r_mao <= x <= x0 + cw + r_mao and y0 - r_mao <= y <= y0 + ch + r_mao]
            if perto:
                rm = int(r_mao) + 2
                A0, B0, A1, B1 = max(0, x0 - rm), max(0, y0 - rm), min(w, x0 + cw + rm), min(h, y0 + ch + rm)
                Rm = le[B0:B1, A0:A1] == c
                dist = cv2.distanceTransform((~Rm).astype("uint8"), cv2.DIST_L2, 5)
                dm = min(dist[min(B1 - B0 - 1, max(0, int(y) - B0)), min(A1 - A0 - 1, max(0, int(x) - A0))] for x, y in perto)
        na_mao = dm <= r_mao
        # apoiado no chão: desce até o nível dos pés E é alto (pedestal, placa); sapato não conta
        no_chao = ys.max() >= pes_y - 0.03 * h and (ys.max() - ys.min()) > 0.10 * h
        # contato: borda do pedaço que encosta na máscara de pessoa dilatada
        borda = cv2.dilate(R.astype("uint8"), np.ones((5, 5), "uint8")) > 0
        borda &= ~R
        contato = (borda & Pd[Y0:Y1, X0:X1]).sum() / max(1, borda.sum())
        pequeno = area < 0.003 * h * w               # acessório pequeno grudado (óculos, boné, relógio): fica
        # Eduardo (10/11, depois do teste com 21 fotos de campo; substitui o "sai mesmo com a mão por perto" do protótipo):
        # o objeto só sai quando está realmente solto. Mão apoiada (punho perto), contato de verdade com a pessoa (>= 10% da
        # borda) ou braço atrás ou na frente dele (o objeto cobre parte de um membro da pose: tirar cortaria a pessoa) = fica
        # inteiro, com o pedestal. Não dá para inventar braço.
        toca_membro = int((R & membros[Y0:Y1, X0:X1]).sum()) > max(20, 0.002 * area)
        interage = na_mao or contato >= 0.10 or toca_membro
        sai = not interage and (no_chao or not pequeno)
        if sai:
            Rx = cv2.dilate(R.astype("uint8"), kd) > 0   # tira o pedaço, inclusive a lasca na faixa que não é pessoa
            manter[Y0:Y1, X0:X1] &= ~(Rx & ~Prot[Y0:Y1, X0:X1])   # a pessoa e os membros ficam (braço encostado na taça)
        log.append("  pedaço %d (%.1f%% img): chão=%s mão=%s contato=%.0f%% membro=%s -> %s"
                   % (c, 100 * area / (h * w), no_chao, na_mao, 100 * contato, toca_membro, "sai" if sai else "fica"))
    buraco = _buracos(manter, manter & ~Pd, isnet, pessoa, rgb, vao, h, w, log) if time.time() - t0 <= limite_seg * 2 else np.zeros_like(manter)
    manter |= buraco
    # alfa: o alfa suave do BiRefNet dentro das regiões mantidas (com a borda suave)
    km = manter.astype("uint8")
    zona = cv2.dilate(km, np.ones((9, 9), "uint8")) > 0
    alfa = np.where(zona, fino, 0).astype(np.float32)
    # refino: onde ISNet e u2net concordam (min >= 0,5), numa faixa em volta do recorte, soma
    fr = max(3, int(FAIXA_REFINO * h))
    kf = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * fr + 1, 2 * fr + 1))
    faixa = cv2.dilate(km, kf) > 0
    acordo = np.minimum(isnet, pessoa).astype(np.float32)
    A = (acordo >= LIMIAR) & faixa
    na, la, sa, _ = cv2.connectedComponentsWithStats((A | manter).astype("uint8"), 8)   # só o que encosta no recorte mantido
    lig = np.isin(la, np.unique(la[manter])) & A
    soma = np.where(cv2.dilate(lig.astype("uint8"), np.ones((5, 5), "uint8")) > 0, acordo, 0)
    alfa = np.maximum(alfa, soma)
    alfa[buraco] = 255                               # miolo da bandeira sólido (regra 13)
    if info is not None:
        info.extend(log + ["refino: +%.2f%% da imagem" % (100 * (lig & ~manter).sum() / (h * w))])
    return np.clip(alfa, 0, 255).astype("uint8")


def pico_mb():
    """Pico de memória deste processo em MB (resource no Mac e no Linux; psutil no Windows, se houver)."""
    try:
        import resource
        r = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(r / (1024 * 1024) if sys.platform == "darwin" else r / 1024)
    except Exception:
        pass
    try:
        import psutil
        mi = psutil.Process().memory_info()
        return int(getattr(mi, "peak_wset", mi.rss) / (1024 * 1024))
    except Exception:
        return None


class Recortador:
    def __init__(self, modelos_dir, gpu="auto"):
        import onnxruntime as ort
        from rembg import new_session
        t0 = time.time()
        falta = [n for n in MODELOS if not modelo_rembg(n)]
        if falta:
            raise RuntimeError("modelos não baixados (%s)" % ", ".join(falta))
        pose = os.path.join(modelos_dir, POSE)
        if not os.path.isfile(pose) or sha256(pose) != POSE_SHA:
            raise RuntimeError("modelo de pose ausente ou diferente (%s)" % POSE)
        if gpu != "cpu" and hasattr(ort, "preload_dlls"):
            try:
                ort.preload_dlls()                       # CUDA e cuDNN instalados pelo pip (instalar-recorte.bat gpu)
            except Exception:
                pass
        disp = ort.get_available_providers()
        prov = ["CPUExecutionProvider"]
        if gpu != "cpu" and "CUDAExecutionProvider" in disp:
            prov = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        elif gpu != "cpu" and "DmlExecutionProvider" in disp:
            prov = ["DmlExecutionProvider", "CPUExecutionProvider"]
        self.s = {}
        for n in MODELOS:
            self.s[n] = new_session(n, sess_opts=opcoes_ort(ort), providers=list(prov))
        self.pose = Pose(pose, ort)
        try:
            real = self.s["birefnet-general"].inner_session.get_providers()[0]   # o ORT cai em CPU sem avisar
        except Exception:
            real = "CPUExecutionProvider"
        self.provedor = {"CUDAExecutionProvider": "cuda", "DmlExecutionProvider": "directml"}.get(real, "cpu")
        self.carga_ms = int((time.time() - t0) * 1000)

    def mascaras(self, trab):
        """(fino, pessoa, isnet, ms) no tamanho da imagem de trabalho (PIL RGB)."""
        import numpy as np
        ms = {}
        out = []
        for n, k in (("birefnet-general", "birefnet"), ("u2net_human_seg", "pessoas"), ("isnet-general-use", "isnet")):
            t = time.time()
            out.append(np.array(self.s[n].predict(trab)[0].convert("L")))
            ms[k] = int((time.time() - t) * 1000)
        return out[0], out[1], out[2], ms


def medidas(alfa, rgb, pessoas):
    """18/11 (regra 19 e D8 novo): o que o agente precisa para aceitar a foto como base, na imagem de trabalho.
    trunc: a máscara encosta embaixo (mesma regra do fiaMedir do app: nas linhas do 1% de baixo, a maior largura com alfa
    >= 128 passa de 0,5% da largura). borda: lados (cima, esq, dir) em que a pessoa está cortada (faixa de 1% do lado com
    mais de BORDA_MIN do comprimento dele). luz: mediana da luminância na pessoa e p95 no rosto (pontos do rosto do MoveNet;
    sem rosto, na pessoa inteira). joelho: a linha mais baixa dos joelhos das pessoas principais (fração da altura), e
    pernas: todas as pessoas principais com um tornozelo visível (pernas inteiras na foto)."""
    import numpy as np
    h, w = alfa.shape
    m = alfa >= 128
    nb = max(1, int(round(h * 0.01)))
    nl = max(1, int(round(w * 0.01)))

    def largura(linhas):
        mx = 0
        for r in linhas:
            xs = np.nonzero(r)[0]
            if len(xs):
                mx = max(mx, int(xs[-1] - xs[0] + 1))
        return mx
    trunc = largura(m[h - nb:]) > w * 0.005
    borda = []
    if largura(m[:nb]) > w * BORDA_MIN:
        borda.append("cima")
    if largura(m[:, :nl].T) > h * BORDA_MIN:
        borda.append("esq")
    if largura(m[:, w - nl:].T) > h * BORDA_MIN:
        borda.append("dir")
    lum = None
    luz = {"med": None, "p95": None, "fonte": None}
    if rgb is not None and m.any():
        lum = (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.float32)
        pv = lum[m]
        luz = {"med": round(float(np.median(pv)), 1), "p95": round(float(np.percentile(pv, 95)), 1), "fonte": "pessoa"}
    principais = []
    larg = []
    for k in pessoas or ():
        if k[5][2] >= PONTO_POSE and k[6][2] >= PONTO_POSE:
            larg.append((float(abs(k[5][0] - k[6][0])), k))
    if larg:
        mx = max(lg for lg, _ in larg)
        principais = [k for lg, k in larg if mx > 0 and lg >= 0.5 * mx]
    if lum is not None and principais:
        rosto = np.zeros_like(m)
        for k in principais:
            pts = [(k[j][0], k[j][1]) for j in range(5) if k[j][2] >= PONTO_POSE]
            if len(pts) >= 2:
                xs, ys = [p[0] for p in pts], [p[1] for p in pts]
                lado = max(max(xs) - min(xs), max(ys) - min(ys), 8.0)
                x0, x1 = int(max(0, min(xs) - 0.4 * lado)), int(min(w, max(xs) + 0.4 * lado))
                y0, y1 = int(max(0, min(ys) - 0.8 * lado)), int(min(h, max(ys) + 0.9 * lado))
                rosto[y0:y1, x0:x1] = True
        rv = lum[rosto & m]
        if rv.size >= 50:
            luz["p95"] = round(float(np.percentile(rv, 95)), 1)
            luz["fonte"] = "rosto"
    joelho, pernas = None, False
    if principais:
        jy = [max(k[j][1] for j in (13, 14) if k[j][2] >= PONTO_POSE) for k in principais if max(k[13][2], k[14][2]) >= PONTO_POSE]
        if jy:
            joelho = round(min(1.0, float(max(jy)) / h), 4)   # float(): o ponto da pose vem em float32, que o json.dumps recusa
        pernas = all(max(k[15][2], k[16][2]) >= PONTO_POSE for k in principais)
    return {"trunc": bool(trunc), "borda": borda, "luz": luz, "joelho": joelho, "pernas": bool(pernas and joelho is not None)}


def recortar(rc, origem, destino, trab=TRAB, info=None):
    """Recorta origem e grava destino (PNG RGBA, lado até 3000, RGB zerado onde o alfa é 0, 600, mkstemp + replace).
    Devolve {"ms": {...}, "pessoas": K}. Levanta ValueError("imagem_grande" | "sem_pessoa")."""
    import numpy as np
    from PIL import Image, ImageOps
    t_ini = time.time()
    with Image.open(origem) as im0:
        if im0.size[0] * im0.size[1] > MAX_PIXELS:   # o cabeçalho basta: nada é decodificado
            raise ValueError("imagem_grande")
        im = ImageOps.exif_transpose(im0).convert("RGB")
    if max(im.size) > LADO_MAX:
        im.thumbnail((LADO_MAX, LADO_MAX), Image.LANCZOS)
    tr = im.copy()
    tr.thumbnail((trab, trab), Image.LANCZOS)
    fino, pes, isn, ms = rc.mascaras(tr)
    t = time.time()
    rgb = np.array(tr)
    tr_rgb = rgb
    pessoas = rc.pose(rgb)
    pm, anc = punhos(pessoas), ombros(pessoas)
    ms["pose"] = int((time.time() - t) * 1000)
    del tr
    t = time.time()
    alfa = regra(fino, pes, isn, pm, anc, info, rgb=np.asarray(tr_rgb), pessoas=pessoas)
    ms["regra"] = int((time.time() - t) * 1000)
    if not alfa.any():
        raise ValueError("sem_pessoa")
    med = medidas(alfa, np.asarray(tr_rgb), pessoas)
    t = time.time()
    a = Image.fromarray(alfa, "L")
    if a.size != im.size:
        a = a.resize(im.size, Image.LANCZOS)
    rgb = np.asarray(im).copy()
    av = np.asarray(a)
    rgb[av == 0] = 0                                  # nada do fundo nem de quem estava ao redor
    out = Image.fromarray(np.dstack([rgb, av]), "RGBA")
    from PIL.PngImagePlugin import PngInfo
    pinfo = PngInfo()                                 # 18/11 (D8): o app lê o joelho daqui (fiaPngInfo) e corta a perna inteira
    pinfo.add_text("eterna", json.dumps({"v": 1, "joelho": med["joelho"], "pernas": med["pernas"]}))
    pasta = os.path.dirname(destino)
    fd, tmp = tempfile.mkstemp(prefix=".rec-", suffix=".tmp", dir=pasta)
    try:
        os.chmod(tmp, 0o600)
        with os.fdopen(fd, "wb") as f:
            out.save(f, "PNG", compress_level=3, pnginfo=pinfo)
        os.replace(tmp, destino)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise
    ms["gravar"] = int((time.time() - t) * 1000)
    ms["total"] = int((time.time() - t_ini) * 1000)
    np_pessoas = 0
    if pessoas:
        np_pessoas = max(1, len(pessoas) // 3)        # 3 escalas: cada pessoa aparece até 3 vezes
    return {"ms": ms, "pessoas": np_pessoas, **med}


class SemModelo(RuntimeError):
    pass


class Cena:
    """18/11 (regra 19): CLIP ViT-B/32, só a torre de imagem (ONNX fp32), em ~/Eterna/modelos com o SHA-256 que o agente
    fixou. Sem o arquivo ou com outro SHA: SemModelo ("sem_modelo"). Placa de vídeo quando houver (conferida de verdade)."""
    nome = "clip-b32"

    def __init__(self, modelos_dir, gpu="auto", arq=None, sha=None):
        t0 = time.time()
        p = os.path.join(modelos_dir, os.path.basename(arq or ""))
        if not arq or not sha or not re.fullmatch(r"[0-9a-f]{64}", sha) or not os.path.isfile(p) or sha256(p) != sha:
            raise SemModelo("sem_modelo")
        import onnxruntime as ort
        if gpu != "cpu" and hasattr(ort, "preload_dlls"):
            try:
                ort.preload_dlls()
            except Exception:
                pass
        disp = ort.get_available_providers()
        prov = ["CPUExecutionProvider"]
        if gpu != "cpu" and "CUDAExecutionProvider" in disp:
            prov = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        elif gpu != "cpu" and "DmlExecutionProvider" in disp:
            prov = ["DmlExecutionProvider", "CPUExecutionProvider"]
        self.s = ort.InferenceSession(p, sess_options=opcoes_ort(ort), providers=prov)
        real = (self.s.get_providers() or ["CPUExecutionProvider"])[0]       # o ORT cai em CPU sem avisar
        self.provedor = {"CUDAExecutionProvider": "cuda", "DmlExecutionProvider": "directml"}.get(real, "cpu")
        self.entrada = self.s.get_inputs()[0].name
        saidas = [o.name for o in self.s.get_outputs()]
        self.saida = "image_embeds" if "image_embeds" in saidas else saidas[0]
        self.sha = sha
        self.carga_ms = int((time.time() - t0) * 1000)

    def vetores(self, lote):
        """lote: float32 N x 3 x 224 x 224 -> N x 512."""
        import numpy as np
        try:
            out = self.s.run([self.saida], {self.entrada: lote})[0]
        except Exception:                                # modelo exportado sem lote dinâmico: uma de cada vez
            out = np.concatenate([self.s.run([self.saida], {self.entrada: lote[i:i + 1]})[0] for i in range(len(lote))])
        if out.ndim == 3:
            out = out[:, 0, :]
        return out


def cena_preparar(origem):
    """Miniatura -> (entrada do CLIP 3x224x224 float32, verde, sinais). Lado menor a 224, corte central, normalização do CLIP.
    verde: fração de pixels verdes (H de 70 a 170 graus, que é 35 a 85 na escala 0-180 do OpenCV; S > 0,25; V > 0,15) fora
    da coluna central de 40%, onde ficam as pessoas. Sinais baratos do Eduardo (18/11), na miniatura reduzida a 192 px:
      flash    = luminância mediana da coluna central (onde está a pessoa) / a das laterais (gramado e bandeira: pessoa com
                 flash mais clara que o fundo; chute a gol: sem flash)
      cadeiras = fração de bordas fortes nas laterais da metade de cima (arquibancada: cadeiras logo atrás, bem perto)
      dourado  = fração de pixels dourados (H de 35 a 60 graus, S > 0,4, V > 0,5) na coluna central (troféu grande)"""
    import numpy as np
    from PIL import Image, ImageOps
    with Image.open(origem) as im0:
        if im0.size[0] * im0.size[1] > MAX_PIXELS:
            raise ValueError("imagem_grande")
        im = ImageOps.exif_transpose(im0).convert("RGB")
    w, h = im.size
    k = CENA_LADO / min(w, h)
    nw, nh = max(CENA_LADO, int(round(w * k))), max(CENA_LADO, int(round(h * k)))
    r = im.resize((nw, nh), Image.BICUBIC)
    x0, y0 = (nw - CENA_LADO) // 2, (nh - CENA_LADO) // 2
    a = np.asarray(r.crop((x0, y0, x0 + CENA_LADO, y0 + CENA_LADO)), dtype=np.float32) / 255.0
    a = (a - np.array(CENA_MEDIA, np.float32)) / np.array(CENA_DESVIO, np.float32)
    entrada = a.transpose(2, 0, 1).astype(np.float32)
    p = im.copy()
    p.thumbnail((192, 192), Image.BILINEAR)
    q = np.asarray(p, dtype=np.float32) / 255.0
    hh, ww = q.shape[:2]
    mx, mn = q.max(2), q.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    R, G, B = q[:, :, 0], q[:, :, 1], q[:, :, 2]
    hue = np.where(mx == R, ((G - B) / d) % 6, np.where(mx == G, (B - R) / d + 2, (R - G) / d + 4)) * 60.0
    c0, c1 = int(ww * 0.3), int(ww * 0.7)
    lado = np.ones((hh, ww), bool)
    lado[:, c0:c1] = False
    verde_m = (hue >= 70) & (hue <= 170) & (sat > 0.25) & (mx > 0.15)
    verde = float(verde_m[lado].mean()) if lado.any() else 0.0
    lum = 0.299 * R + 0.587 * G + 0.114 * B
    y0c, y1c = int(hh * 0.15), int(hh * 0.85)
    centro = lum[y0c:y1c, c0:c1]
    laterais = np.concatenate([lum[:, :c0].ravel(), lum[:, c1:].ravel()])
    flash = float(np.median(centro)) / (float(np.median(laterais)) + 0.02) if centro.size and laterais.size else 1.0
    gy = np.abs(np.diff(lum, axis=0))[:, :-1]
    gx = np.abs(np.diff(lum, axis=1))[:-1, :]
    forte = (gx + gy) > 0.16
    cima = forte[: hh // 2]
    cad = np.concatenate([cima[:, :c0].ravel(), cima[:, c1:].ravel()])
    cadeiras = float(cad.mean()) if cad.size else 0.0
    dour = (hue >= 35) & (hue <= 60) & (sat > 0.4) & (mx > 0.5)
    dourado = float(dour[:, int(ww * 0.25):int(ww * 0.75)].mean())
    return entrada, round(verde, 4), {"flash": round(flash, 3), "cadeiras": round(cadeiras, 4), "dourado": round(dourado, 4)}


def cena_lote(cn, itens, pastas):
    """Uma mensagem do modo cena -> a lista res. Cada item com caminho fora das pastas (realpath) vira caminho_recusado."""
    import base64
    import numpy as np
    t0 = time.time()
    res, prontos, entradas = [], [], []
    for it in itens[:CENA_LOTE]:
        pid = str((it or {}).get("pid") or "")[:40]
        origem = str((it or {}).get("origem") or "")
        if not re.fullmatch(r"[0-9a-f]{6,40}", pid):
            res.append({"pid": pid, "erro": "pid"})
            continue
        if not any(dentro(origem, p) for p in pastas if p) or not os.path.isfile(origem):
            res.append({"pid": pid, "erro": "caminho_recusado"})
            continue
        try:
            e, verde, sinais = cena_preparar(origem)
        except ValueError as ex:
            res.append({"pid": pid, "erro": str(ex)[:60] or "erro"})
            continue
        except Exception as ex:
            res.append({"pid": pid, "erro": ("%s" % type(ex).__name__)[:60]})
            continue
        prontos.append({"pid": pid, "verde": verde, "sinais": sinais})
        entradas.append(e)
    t1 = time.time()
    if entradas:
        v = np.asarray(cn.vetores(np.stack(entradas)), dtype=np.float32)
        v = v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-6)
        for o, vec in zip(prontos, v):
            o["vet"] = base64.b64encode(vec.astype("<f2").tobytes()).decode("ascii")
            res.append(o)
    t2 = time.time()
    return res, {"ler": int((t1 - t0) * 1000), "modelo": int((t2 - t1) * 1000), "total": int((t2 - t0) * 1000)}


def main_cena(fabrica=None):
    """--modo cena: o processo do reconhecimento do ponto (fabrica(modelos_dir, gpu, arq, sha): só os testes trocam)."""
    proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
    os.dup2(2, 1)
    sys.stdout = sys.stderr

    def manda(o):
        proto.write(json.dumps(o) + "\n")
        proto.flush()
    inbox, thumbs = _arg("--inbox"), _arg("--thumbs")
    modelos_dir = _arg("--modelos") or os.path.expanduser("~/Eterna/modelos")
    if not inbox and not thumbs:
        manda({"pronto": False, "erro": "faltam --inbox e --thumbs"})
        return 2
    try:
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        cn = (fabrica or Cena)(modelos_dir, (os.environ.get("ETERNA_RECORTE_GPU") or "auto").strip().lower(), _arg("--cena-arq"), _arg("--cena-sha"))
    except SemModelo:
        manda({"pronto": False, "erro": "sem_modelo"})
        return 3
    except MemoryError:
        manda({"pronto": False, "erro": "memória insuficiente"})
        return 3
    except Exception as ex:
        manda({"pronto": False, "erro": str(ex)[:200]})
        return 3
    pai = os.getppid()

    def vigia_pai():
        while True:
            time.sleep(2)
            if os.getppid() != pai:
                os._exit(0)
    if os.name != "nt":
        threading.Thread(target=vigia_pai, daemon=True).start()
    manda({"pronto": True, "modo": "cena", "provedor": cn.provedor, "modelo": getattr(cn, "nome", "clip-b32"), "sha": getattr(cn, "sha", None),
           "carga_ms": cn.carga_ms})
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        mid = None
        try:
            j = json.loads(linha)
            mid = str(j.get("id") or "")[:60]
            if j.get("tipo") != "cena" or not isinstance(j.get("itens"), list):
                manda({"id": mid, "ok": False, "erro": "tipo"})
                continue
            res, ms = cena_lote(cn, j["itens"], (inbox, thumbs))
            manda({"id": mid, "ok": True, "ms": ms, "res": res})
        except MemoryError:
            manda({"id": mid, "ok": False, "erro": "memória insuficiente"})
        except Exception as ex:
            manda({"id": mid, "ok": False, "erro": ("%s: %s" % (type(ex).__name__, ex))[:200]})
    return 0


def dentro(caminho, pasta):
    try:
        c, p = os.path.realpath(caminho), os.path.realpath(pasta)
    except (OSError, ValueError):
        return False
    return os.path.commonpath([c, p]) == p and c != p


def _arg(nome, padrao=None):
    a = sys.argv
    return a[a.index(nome) + 1] if nome in a and a.index(nome) + 1 < len(a) else padrao


def main(fabrica=None):
    """fabrica(modelos_dir, gpu) -> recortador: só os testes trocam (testes/_recorte_filho_falso.py, sem modelos)."""
    # stdout fica só para o protocolo: o fd 1 do processo passa a ser o stderr (print de biblioteca, até de C, vai para lá)
    proto = os.fdopen(os.dup(1), "w", buffering=1, encoding="utf-8")
    os.dup2(2, 1)
    sys.stdout = sys.stderr

    def manda(o):
        proto.write(json.dumps(o) + "\n")
        proto.flush()

    inbox, recortes = _arg("--inbox"), _arg("--recortes")
    modelos_dir = _arg("--modelos") or os.path.expanduser("~/Eterna/modelos")
    if not inbox or not recortes:
        manda({"pronto": False, "erro": "faltam --inbox e --recortes"})
        return 2
    try:
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        rc = (fabrica or Recortador)(modelos_dir, (os.environ.get("ETERNA_RECORTE_GPU") or "auto").strip().lower())
    except Exception as ex:
        manda({"pronto": False, "erro": str(ex)[:200]})
        return 3
    pai = os.getppid()

    def vigia_pai():                       # o agente caiu no meio de uma foto: o recorte não fica segurando a memória
        while True:
            time.sleep(2)
            if os.getppid() != pai:
                os._exit(0)
    if os.name != "nt":
        threading.Thread(target=vigia_pai, daemon=True).start()
    manda({"pronto": True, "provedor": rc.provedor, "modelos": list(MODELOS) + [POSE[:-5]], "carga_ms": rc.carga_ms})
    for linha in sys.stdin:
        linha = linha.strip()
        if not linha:
            continue
        pid = None
        try:
            j = json.loads(linha)
            pid = str(j.get("id") or "")[:60]
            origem, destino = str(j.get("origem") or ""), str(j.get("destino") or "")
            trab = int(j.get("trab") or TRAB)
            if not dentro(origem, inbox) or not os.path.isfile(origem) \
                    or not _re_destino.match(os.path.basename(destino)) \
                    or os.path.realpath(os.path.dirname(destino)) != os.path.realpath(recortes):
                manda({"id": pid, "ok": False, "erro": "caminho_recusado"})
                continue
            r = recortar(rc, origem, destino, min(max(trab, 512), 3000))
            manda({"id": pid, "ok": True, "ms": r["ms"], "pico_mb": pico_mb(), "pessoas": r["pessoas"],
                   **{k: r.get(k) for k in ("trunc", "borda", "luz", "joelho", "pernas")}})
        except ValueError as ex:
            manda({"id": pid, "ok": False, "erro": str(ex)[:200] or "erro"})
        except MemoryError:
            manda({"id": pid, "ok": False, "erro": "memória insuficiente"})
        except Exception as ex:
            manda({"id": pid, "ok": False, "erro": ("%s: %s" % (type(ex).__name__, ex))[:200]})
    return 0


if __name__ == "__main__":
    sys.exit(main_cena() if _arg("--modo") == "cena" else main())
