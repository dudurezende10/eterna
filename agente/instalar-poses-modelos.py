#!/usr/bin/env python3
# Eterna · baixa o modelo de visão da classificação de poses (P1 do plano docs/planos/2026-11-23-poses-estatistica.md), no
# padrão do instalar-recorte-modelos.py. Uma vez por servidor; rodar de novo não baixa nada que já esteja certo.
#   Qwen3-VL-8B-Instruct (Qwen, Apache 2.0, uso comercial permitido), conversão GGUF oficial do próprio Qwen:
#   Qwen3VL-8B-Instruct-Q4_K_M.gguf (cerca de 5 GB) e mmproj-Qwen3VL-8B-Instruct-F16.gguf (cerca de 1,2 GB), em
#   ~/Eterna/modelos, com o SHA-256 conferido. Diferente: o arquivo é apagado e o instalador para. Baixa num temporário e
#   troca no fim.
# POSE_SHA e POSE_MMPROJ_SHA (os mesmos do eterna-agente.py) ainda estão vazios: o Ronaldo roda com --conferir, que baixa e
# MOSTRA o SHA-256 e o tamanho de cada arquivo (e compara com a página do arquivo no Hugging Face); o programador fixa os
# dois valores aqui e no agente, como foi com o CENA_SHA. Enquanto estiverem vazios, o agente não abre o modelo (motivo
# sem_modelo) e, sem --conferir, este instalador não baixa nada.
# Uso, como o usuário do serviço (no servidor do estádio):
#   sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/instalar-poses-modelos.py [--conferir]
import hashlib, os, re, shutil, sys, tempfile

BASE = "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/"
POSE_ARQ = "Qwen3VL-8B-Instruct-Q4_K_M.gguf"          # o mesmo POSE_ARQ do eterna-agente.py
POSE_MMPROJ_ARQ = "mmproj-Qwen3VL-8B-Instruct-F16.gguf"
POSE_SHA = ""                                         # o mesmo POSE_SHA do eterna-agente.py (Ronaldo confere, programador fixa)
POSE_MMPROJ_SHA = ""                                  # o mesmo POSE_MMPROJ_SHA do eterna-agente.py
PASTA = os.path.join(os.path.expanduser("~"), "Eterna", "modelos")
LIVRE_GB = 7.0                                        # os dois arquivos mais folga


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
                import requests
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


def um(arq, sha, conferir):
    """-> True se o arquivo ficou certo (ou, em --conferir, baixado e medido)."""
    dest = os.path.join(PASTA, arq)
    fixo = bool(re.fullmatch(r"[0-9a-f]{64}", sha or ""))
    if os.path.isfile(dest):
        atual = sha256(dest)
        if fixo and atual == sha:
            print("ok   %s (SHA-256 confere)" % arq)
            return True
        if not fixo:
            print("tem  %s · %.2f GB · SHA-256 %s" % (arq, os.path.getsize(dest) / 1e9, atual))
            return conferir
        print("SHA diferente em %s: apagado (baixa de novo)" % arq)
        os.remove(dest)
    if not fixo and not conferir:
        print("SEM SHA fixo para %s: nada baixado. Rode com --conferir e mande o SHA-256 ao programador." % arq)
        return False
    print("baixando %s ..." % arq)
    tmp = baixar(BASE + arq, dest)
    atual = sha256(tmp)
    if fixo and atual != sha:
        os.remove(tmp)
        print("FALHA %s: SHA-256 %s, esperado %s. Nada instalado." % (arq, atual, sha))
        return False
    os.replace(tmp, dest)
    os.chmod(dest, 0o644)
    print("%s  %s · %.2f GB · SHA-256 %s" % ("ok  " if fixo else "conf", arq, os.path.getsize(dest) / 1e9, atual))
    return True


def main():
    conferir = "--conferir" in sys.argv
    os.makedirs(PASTA, exist_ok=True)
    livre = shutil.disk_usage(PASTA).free / 1e9
    if livre < LIVRE_GB and not all(os.path.isfile(os.path.join(PASTA, a)) for a in (POSE_ARQ, POSE_MMPROJ_ARQ)):
        print("FALHA: %.1f GB livres em %s; precisa de %.0f GB" % (livre, PASTA, LIVRE_GB))
        return 1
    ok = all([um(POSE_ARQ, POSE_SHA, conferir), um(POSE_MMPROJ_ARQ, POSE_MMPROJ_SHA, conferir)])
    if conferir and not (POSE_SHA and POSE_MMPROJ_SHA):
        print("\nConfira os dois SHA-256 acima com a página de cada arquivo no Hugging Face (Qwen/Qwen3-VL-8B-Instruct-GGUF,"
              " aba Files, link do arquivo) e mande ao programador. Até ele fixar, o agente não abre o modelo.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
