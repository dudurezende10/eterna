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
#   -> {"id":"<pid>","ok":true,"ms":{...},"pico_mb":N,"pessoas":K}
#   -> {"id":"<pid>","ok":false,"erro":"sem_pessoa|imagem_grande|caminho_recusado|..."}
# Caminhos só dentro de --inbox (origem) e --recortes (destino), conferidos com realpath. Nunca abre porta, nunca baixa
# modelo (quem baixa é o instalador). Só numpy, Pillow, opencv-python-headless, onnxruntime e rembg; nada do agente.
import os
import sys
import json
import time
import re
import tempfile
import hashlib

LIMIAR = 128             # 0..255, binarização das máscaras
SOBREPOSICAO_MIN = 0.05  # componente da máscara fina precisa ter >= 5% dentro da máscara de pessoas
FAIXA_PESSOA = 0.015     # dilatação da máscara de pessoas = 1,5% da altura da imagem
RAIO_MAO = 0.04          # objeto "na mão" se encosta num raio de 4% da altura em volta de um punho
FAIXA_REFINO = 0.02      # faixa (2% da altura) em volta do recorte onde ISNet + u2net podem somar
FUNDO_PEQUENO = 0.12     # componente separado com < 12% da área do maior e que não encosta = pessoa ao fundo
OMBROS_CRIANCA = 0.5     # A4: componente pequeno e separado fica se tem uma pessoa com ombros >= 0,5 da maior da foto
GRUDADOS_MAX = 64        # teto de custo: no máximo 64 pedaços avaliados no passo "grudados" (o resto fica)
REGRA_SEG = 1.5          # e no máximo 1,5 s na regra (o que não foi avaliado fica)
TRAB = 1600              # maior lado da imagem entregue aos modelos
LADO_MAX = 3000          # maior lado do PNG
MAX_PIXELS = 40_000_000  # igual ao do agente: acima disso a foto é recusada antes de decodificar
MODELOS = ("birefnet-general", "u2net_human_seg", "isnet-general-use")
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


def regra(fino, pessoa, isnet, pts_mao, ancoras=(), info=None, limite_seg=REGRA_SEG, max_pedacos=GRUDADOS_MAX):
    """fino/pessoa/isnet: uint8 0..255 (mesmo tamanho). pts_mao: punhos (N x 2). ancoras: pontos (x, y) de ombro e
    quadril das pessoas grandes (A4). Devolve o alfa uint8. Cópia fiel de recorte2.regra do protótipo validado, com:
    (a) A4: componente pequeno e separado que contém uma âncora fica (criança separada do grupo);
    (b) A5: sem pixel de pessoa, fica o maior componente do BiRefNet (melhor levar a foto do que tirá-la da venda);
    (c) teto de custo: no máximo max_pedacos pedaços avaliados no passo "grudados" e limite_seg no total (o resto fica)."""
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
        # objeto apoiado no chão (pedestal com troféu, placa) sai mesmo com mão por perto: quem segura algo não deixa o
        # objeto ir até o chão. Exceção: contato grande (bandeira enrolada no corpo até o chão).
        sai = (no_chao and contato < 0.30) or (not na_mao and not pequeno and contato < 0.10)
        if sai:
            Rx = cv2.dilate(R.astype("uint8"), kd) > 0   # tira o pedaço, inclusive a lasca na faixa que não é pessoa
            manter[Y0:Y1, X0:X1] &= ~(Rx & ~P[Y0:Y1, X0:X1])
        log.append("  pedaço %d (%.1f%% img): chão=%s mão=%s contato=%.0f%% -> %s"
                   % (c, 100 * area / (h * w), no_chao, na_mao, 100 * contato, "sai" if sai else "fica"))
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
    pessoas = rc.pose(rgb)
    pm, anc = punhos(pessoas), ombros(pessoas)
    ms["pose"] = int((time.time() - t) * 1000)
    del tr, rgb
    t = time.time()
    alfa = regra(fino, pes, isn, pm, anc, info)
    ms["regra"] = int((time.time() - t) * 1000)
    if not alfa.any():
        raise ValueError("sem_pessoa")
    t = time.time()
    a = Image.fromarray(alfa, "L")
    if a.size != im.size:
        a = a.resize(im.size, Image.LANCZOS)
    rgb = np.asarray(im).copy()
    av = np.asarray(a)
    rgb[av == 0] = 0                                  # nada do fundo nem de quem estava ao redor
    out = Image.fromarray(np.dstack([rgb, av]), "RGBA")
    pasta = os.path.dirname(destino)
    fd, tmp = tempfile.mkstemp(prefix=".rec-", suffix=".tmp", dir=pasta)
    try:
        os.chmod(tmp, 0o600)
        with os.fdopen(fd, "wb") as f:
            out.save(f, "PNG", compress_level=3)
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
    return {"ms": ms, "pessoas": np_pessoas}


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
            manda({"id": pid, "ok": True, "ms": r["ms"], "pico_mb": pico_mb(), "pessoas": r["pessoas"]})
        except ValueError as ex:
            manda({"id": pid, "ok": False, "erro": str(ex)[:200] or "erro"})
        except MemoryError:
            manda({"id": pid, "ok": False, "erro": "memória insuficiente"})
        except Exception as ex:
            manda({"id": pid, "ok": False, "erro": ("%s: %s" % (type(ex).__name__, ex))[:200]})
    return 0


if __name__ == "__main__":
    sys.exit(main())
