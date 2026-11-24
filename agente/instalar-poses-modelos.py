#!/usr/bin/env python3
# Eterna · baixa o modelo de visão da classificação de poses (P1 do plano docs/planos/2026-11-23-poses-estatistica.md), no
# padrão do instalar-recorte-modelos.py. Uma vez por servidor; rodar de novo não baixa nada que já esteja certo.
#   Qwen3-VL-8B-Instruct (Qwen, Apache 2.0, uso comercial permitido), conversão GGUF oficial do próprio Qwen:
#   Qwen3VL-8B-Instruct-Q4_K_M.gguf (cerca de 5 GB) e mmproj-Qwen3VL-8B-Instruct-F16.gguf (cerca de 1,2 GB), em
#   ~/Eterna/modelos. Baixa num temporário, confere o SHA-256 e só então troca. SHA diferente no que chegou: o temporário é
#   apagado e o instalador para com erro. O temporário (.baixando-*) também é apagado em qualquer outro erro e no Ctrl-C.
#   Arquivo já instalado com SHA diferente do informado: o instalador para e pede para conferir o SHA (não apaga nem baixa
#   de novo sozinho: um SHA digitado errado não pode custar 5 GB de download).
# Nada é baixado sem saber o SHA-256 esperado de cada arquivo. Ele vem de um destes dois lugares:
#   - POSE_SHA e POSE_MMPROJ_SHA fixados aqui (os mesmos do eterna-agente.py), depois da primeira instalação; ou
#   - --esperado-modelo <sha256> e --esperado-mmproj <sha256> na linha de comando, copiados pelo Ronaldo da página de cada
#     arquivo no Hugging Face (Qwen/Qwen3-VL-8B-Instruct-GGUF, aba Files and versions, clicar no arquivo: o SHA256 aparece
#     na página, em "Git LFS Details"). São 64 letras e números.
#   Com os dois lugares preenchidos, eles têm que ser iguais. Faltando o SHA de algum arquivo, nada é baixado.
# Depois de instalar, mande os dois SHA-256 ao programador, que fixa POSE_SHA e POSE_MMPROJ_SHA aqui e no agente (como foi com
# o CENA_SHA). Enquanto estiverem vazios no agente, ele não abre o modelo (motivo sem_modelo).
# Uso, como o usuário do serviço (no servidor do estádio):
#   sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/instalar-poses-modelos.py \
#     --esperado-modelo <sha256 do Q4_K_M> --esperado-mmproj <sha256 do mmproj>
import hashlib, os, re, shutil, sys, tempfile

# Endereço pelo ramo main, não por um commit fixo (como o CENA_URL do instalar-recorte-modelos.py): ainda não há um commit
# conferido deste repositório. O Ronaldo anota o commit da página (aba Files and versions, "History") junto com os SHA-256, e o
# programador troca o "main" abaixo por ele. Até lá, quem garante o arquivo é o SHA-256 esperado.
BASE = "https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF/resolve/main/"
POSE_ARQ = "Qwen3VL-8B-Instruct-Q4_K_M.gguf"          # o mesmo POSE_ARQ do eterna-agente.py
POSE_MMPROJ_ARQ = "mmproj-Qwen3VL-8B-Instruct-F16.gguf"
POSE_SHA = ""                                         # o mesmo POSE_SHA do eterna-agente.py (fixado depois da instalação)
POSE_MMPROJ_SHA = ""                                  # o mesmo POSE_MMPROJ_SHA do eterna-agente.py
PASTA = os.path.join(os.path.expanduser("~"), "Eterna", "modelos")
LIVRE_GB = 7.0                                        # os dois arquivos mais folga
SHA_RE = re.compile(r"[0-9a-f]{64}")


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


def esperados(argv):
    """-> ({arquivo: sha esperado}, erro). Junta o fixado no código com o da linha de comando; os dois têm que bater."""
    args = {"--esperado-modelo": None, "--esperado-mmproj": None}
    i = 1
    while i < len(argv):
        a = argv[i]
        if a in args and i + 1 < len(argv):
            args[a] = argv[i + 1].strip().lower()
            i += 2
            continue
        if a in args:
            return None, "faltou o SHA-256 depois de %s" % a
        return None, "opção desconhecida: %s (use --esperado-modelo e --esperado-mmproj)" % a
    out = {}
    for arq, fixo, opc in ((POSE_ARQ, POSE_SHA, "--esperado-modelo"), (POSE_MMPROJ_ARQ, POSE_MMPROJ_SHA, "--esperado-mmproj")):
        dado = args[opc]
        if dado is not None and not SHA_RE.fullmatch(dado):
            return None, "%s precisa de um SHA-256 com 64 letras e números (0-9, a-f): %r" % (opc, dado[:80])
        if fixo and dado and fixo != dado:
            return None, "%s diferente do SHA-256 fixado no código para %s: confira a página do arquivo" % (opc, arq)
        out[arq] = fixo or dado
    return out, None


def um(arq, sha):
    """Deixa o arquivo certo (já estava ou baixado e conferido). -> True / False (nada instalado)."""
    dest = os.path.join(PASTA, arq)
    if os.path.isfile(dest):
        atual = sha256(dest)
        if atual == sha:
            print("ok   %s (SHA-256 confere)" % arq)
            return True
        print("PARADO %s: o arquivo já instalado tem SHA-256 %s, e o informado é %s.\n"
              "Confira o SHA-256 na página do arquivo no Hugging Face. Nada foi apagado nem baixado. Se o SHA informado estiver\n"
              "certo, apague %s e rode de novo." % (arq, atual, sha, dest))
        return False
    print("baixando %s ..." % arq)
    tmp = baixar(BASE + arq, dest)
    try:
        atual = sha256(tmp)
        if atual != sha:
            print("FALHA %s: SHA-256 %s, esperado %s. Arquivo apagado, nada instalado." % (arq, atual, sha))
            return False
        os.replace(tmp, dest)
        os.chmod(dest, 0o644)
    finally:
        if os.path.exists(tmp):                      # SHA diferente, erro ou Ctrl-C: o temporário não fica na pasta
            try:
                os.remove(tmp)
            except OSError:
                pass
    print("ok   %s · %.2f GB · SHA-256 %s" % (arq, os.path.getsize(dest) / 1e9, atual))
    return True


def main(argv=None):
    sha, erro = esperados(sys.argv if argv is None else argv)
    if erro:
        print("FALHA: " + erro)
        return 2
    falta = [a for a, s in sha.items() if not s]
    if falta:
        print("Nada baixado: falta o SHA-256 esperado de %s.\n"
              "Sem ele não dá para saber se o arquivo que chegou é o certo. Abra a página de cada arquivo no Hugging Face\n"
              "(Qwen/Qwen3-VL-8B-Instruct-GGUF, aba Files and versions, clicar no arquivo; o SHA256 fica em Git LFS Details)\n"
              "e rode de novo com --esperado-modelo <sha256> --esperado-mmproj <sha256>." % " e ".join(falta))
        return 1
    os.makedirs(PASTA, exist_ok=True)
    livre = shutil.disk_usage(PASTA).free / 1e9
    if livre < LIVRE_GB and not all(os.path.isfile(os.path.join(PASTA, a)) for a in sha):
        print("FALHA: %.1f GB livres em %s; precisa de %.0f GB" % (livre, PASTA, LIVRE_GB))
        return 1
    for arq in (POSE_ARQ, POSE_MMPROJ_ARQ):          # para no primeiro que não bate
        if not um(arq, sha[arq]):
            return 1
    if not (POSE_SHA and POSE_MMPROJ_SHA):
        print("\nInstalado e conferido. Mande os dois SHA-256 acima ao programador: ele fixa no agente, e só então o Eterna abre o modelo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
