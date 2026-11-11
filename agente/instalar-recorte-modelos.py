#!/usr/bin/env python3
# Eterna · baixa os modelos do recorte (v97), chamado por instalar-recorte.command e instalar-recorte.bat com o Python do
# ~/Eterna/venv. Uma vez por computador; rodar de novo não baixa nada que já esteja certo.
#   birefnet-general, u2net_human_seg, isnet-general-use: pelo próprio rembg (ele confere o hash de cada um) em ~/.rembg
#   MoveNet MultiPose Lightning (Google, Apache-2.0; conversão ONNX de Kazuhito00, Apache-2.0): em ~/Eterna/modelos, com o
#   SHA-256 conferido; diferente, o arquivo é apagado e o instalador para. Baixa num temporário e troca no fim.
# --provedor: só mostra se a placa de vídeo (CUDA) abre com o onnxruntime instalado (servidor com NVIDIA).
import hashlib, os, sys, tempfile

MOVENET_URL = "https://github.com/Kazuhito00/MoveNet-Python-Example/raw/main/onnx/movenet_multipose_lightning_1.onnx"
MOVENET_SHA = "61c25a6fc887b0e8d14517c3d66fdaf36c0e7a7ec0d50f74ed41a32ca1485184"
MODELOS = ("birefnet-general", "u2net_human_seg", "isnet-general-use")
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
    return real == "CUDAExecutionProvider"


if __name__ == "__main__":
    if "--provedor" in sys.argv:
        sys.exit(0 if provedor() else 3)
    rembg_modelos()
    sys.exit(0 if movenet() else 1)
