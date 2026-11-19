#!/usr/bin/env python3
# Eterna · baixa os modelos do recorte (v97), chamado por instalar-recorte.command e instalar-recorte.bat com o Python do
# ~/Eterna/venv. Uma vez por computador; rodar de novo não baixa nada que já esteja certo.
#   birefnet-general, u2net_human_seg, isnet-general-use: pelo próprio rembg (ele confere o hash de cada um) em ~/.rembg
#   MoveNet MultiPose Lightning (Google, Apache-2.0; conversão ONNX de Kazuhito00, Apache-2.0): em ~/Eterna/modelos, com o
#   SHA-256 conferido; diferente, o arquivo é apagado e o instalador para. Baixa num temporário e troca no fim.
#   18/11 (regra 19): o modelo de cena (CLIP ViT-B/32, só a torre de imagem, em ONNX fp32; conversão pública do
#   Transformers.js, Xenova/clip-vit-base-patch32, arquivo onnx/vision_model.onnx; o CLIP original da OpenAI é MIT) em
#   ~/Eterna/modelos/clip-vit-b32-visao.onnx, com o SHA-256 conferido do mesmo jeito. SHA conferido em 18/11 na página do arquivo
#   (commit 6ef1ebc do repositório, licença MIT). Se o CENA_SHA ficar vazio, o instalador NÃO baixa nada dele e avisa.
# --provedor: só mostra se a placa de vídeo (CUDA) abre com o onnxruntime instalado (servidor com NVIDIA), para o recorte
# e, se já estiver instalado, para o modelo de cena.
import hashlib, os, re, sys, tempfile

MOVENET_URL = "https://github.com/Kazuhito00/MoveNet-Python-Example/raw/main/onnx/movenet_multipose_lightning_1.onnx"
MOVENET_SHA = "61c25a6fc887b0e8d14517c3d66fdaf36c0e7a7ec0d50f74ed41a32ca1485184"
MODELOS = ("birefnet-general", "u2net_human_seg", "isnet-general-use")
CENA_URL = "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6ef1ebc8b0766a7a8d11b146462c99cdf74dd22d/onnx/vision_model.onnx"
CENA_ARQ = "clip-vit-b32-visao.onnx"          # o mesmo CENA_ARQ do eterna-agente.py
CENA_SHA = "fd6e1402a588279d1723c7534d4bcba5bc0b14b47dfab0e46f8c47b8270d7d40"  # o mesmo CENA_SHA do eterna-agente.py
PASTA = os.path.join(os.path.expanduser("~"), "Eterna", "modelos")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def baixar(url, destino):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".baixando-", dir=os.path.dirname(destino))
    try:
        with os.fdopen(fd, "wb") as f:
            try:
                import requests                     # vem com o rembg (pooch); usa os certificados do certifi
                with requests.get(url, stream=True, timeout=60) as r:
                    r.raise_for_status()
                    for b in r.iter_content(1 << 20):
                        f.write(b)
            except ImportError:
                import urllib.request
                with urllib.request.urlopen(url, timeout=60) as r:
                    for b in iter(lambda: r.read(1 << 20), b""):
                        f.write(b)
        return tmp
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def movenet():
    destino = os.path.join(PASTA, "movenet_multipose_lightning_1.onnx")
    if os.path.isfile(destino):
        if sha256(destino) == MOVENET_SHA:
            print("ok movenet_multipose_lightning_1 (já estava)")
            return True
        os.remove(destino)
        print("movenet_multipose_lightning_1 diferente do esperado: apagado, baixando de novo")
    tmp = baixar(MOVENET_URL, destino)
    if sha256(tmp) != MOVENET_SHA:
        os.remove(tmp)
        print("ERRO: o MoveNet baixado não confere (SHA-256 diferente). Nada foi instalado; avise o suporte do Eterna.")
        return False
    os.chmod(tmp, 0o644)
    os.replace(tmp, destino)
    print("ok movenet_multipose_lightning_1")
    return True


def cena():
    """18/11 (regra 19): o modelo de cena, igual ao movenet(): URL fixa, SHA-256 fixo, temporário + os.replace, apaga se não bater."""
    if not re.fullmatch(r"[0-9a-f]{64}", CENA_SHA or ""):
        print("AVISO: o SHA-256 do modelo de cena (%s) ainda não foi fixado: nada baixado e o reconhecimento do gramado fica"
              " desligado. Para ligar: (1) confira na página do arquivo (%s) o nome, a licença e o SHA-256; (2) ponha o MESMO"
              " valor em CENA_SHA neste instalador e no agente/eterna-agente.py, num commit em idiomas-base; (3) depois que o"
              " servidor atualizar, rode instalar-recorte de novo e reinicie o Eterna; (4) confira em /status.treino.modelo_ponto"
              " que pronto é true e provedor é cuda." % (CENA_ARQ, CENA_URL))
        return True
    destino = os.path.join(PASTA, CENA_ARQ)
    if os.path.isfile(destino):
        if sha256(destino) == CENA_SHA:
            print("ok %s (já estava)" % CENA_ARQ)
            return True
        os.remove(destino)
        print("%s diferente do esperado: apagado, baixando de novo" % CENA_ARQ)
    tmp = baixar(CENA_URL, destino)
    if sha256(tmp) != CENA_SHA:
        os.remove(tmp)
        print("ERRO: o modelo de cena baixado não confere (SHA-256 diferente). Nada foi instalado; avise o suporte do Eterna.")
        return False
    os.chmod(tmp, 0o644)
    os.replace(tmp, destino)
    print("ok %s" % CENA_ARQ)
    return True


def provedor_cena(ort):
    p = os.path.join(PASTA, CENA_ARQ)
    if not re.fullmatch(r"[0-9a-f]{64}", CENA_SHA or "") or not os.path.isfile(p) or sha256(p) != CENA_SHA:
        print("modelo de cena: não instalado (ou SHA pendente)")
        return True
    s = ort.InferenceSession(p, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    real = s.get_providers()[0]
    print("modelo de cena: %s" % ("placa de vídeo (CUDA)" if real == "CUDAExecutionProvider" else "processador (CPU): a placa NÃO abriu"))
    return real == "CUDAExecutionProvider"


def rembg_modelos():
    os.environ.pop("MODEL_CHECKSUM_DISABLED", None)  # o hash de cada modelo sempre conferido
    from rembg.sessions import sessions_class
    por_nome = {sc.name(): sc for sc in sessions_class}
    for n in MODELOS:
        p = por_nome[n].download_models()            # já baixado: devolve o arquivo sem baixar de novo
        print("ok", n, "(%d MB)" % (os.path.getsize(p) // (1024 * 1024)))


def provedor():
    import onnxruntime as ort
    if hasattr(ort, "preload_dlls"):
        try:
            ort.preload_dlls()                       # bibliotecas CUDA/cuDNN instaladas pelo pip
        except Exception:
            pass
    from rembg.sessions import sessions_class
    p = {sc.name(): sc for sc in sessions_class}["isnet-general-use"].download_models()
    s = ort.InferenceSession(p, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
    real = s.get_providers()[0]
    print("provedor do recorte: %s" % ("placa de vídeo (CUDA)" if real == "CUDAExecutionProvider" else "processador (CPU): a placa NÃO abriu"))
    return provedor_cena(ort) and real == "CUDAExecutionProvider"


if __name__ == "__main__":
    if "--provedor" in sys.argv:
        sys.exit(0 if provedor() else 3)
    rembg_modelos()
    sys.exit(0 if movenet() and cena() else 1)
