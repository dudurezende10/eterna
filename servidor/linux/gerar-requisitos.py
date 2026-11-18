# Eterna · gera servidor/linux/requisitos.txt: todas as bibliotecas Python do servidor Linux (agente, nuvem, rostos e
# recorte na placa NVIDIA), com versão fixa e o SHA-256 de cada arquivo publicado no PyPI. O instalador usa
# pip install --require-hashes --only-binary=:all: -r requisitos.txt; arquivo diferente do esperado = para e avisa.
# Só para quem troca uma versão, com internet, fora do servidor:  python servidor/linux/gerar-requisitos.py
# As versões do recorte são as mesmas de agente/recorte-requisitos-gpu.txt (Windows), para os dois servidores rodarem igual.
import json, os, subprocess, sys, tempfile, time, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
PY = "3.14"                                  # Python do Ubuntu 26.04 LTS
PLATS = ["manylinux_2_%d_x86_64" % n for n in range(17, 40)] + ["manylinux2014_x86_64", "linux_x86_64"]
PEDIDOS = ["rembg==2.0.86", "onnxruntime-gpu[cuda,cudnn]==1.29.0", "opencv-python-headless==4.10.0.84", "psutil==7.2.2",
           "boto3", "cryptography"]


def resolve():
    with tempfile.TemporaryDirectory() as d:
        rep = os.path.join(d, "r.json")
        cmd = [sys.executable, "-m", "pip", "install", "-q", "--dry-run", "--ignore-installed", "--only-binary=:all:",
               "--python-version", PY, "--implementation", "cp", "--target", os.path.join(d, "t"), "--report", rep]
        for p in PLATS:
            cmd += ["--platform", p]
        subprocess.run(cmd + PEDIDOS, check=True)
        with open(rep, encoding="utf-8") as f:
            return {it["metadata"]["name"].lower(): it["metadata"]["version"] for it in json.load(f)["install"]}


def hashes(nome, versao):
    j = json.load(urllib.request.urlopen("https://pypi.org/pypi/%s/%s/json" % (nome, versao), timeout=60))
    hs = sorted({u["digests"]["sha256"] for u in j["urls"] if u["packagetype"] == "bdist_wheel"})
    if not hs:
        raise SystemExit("sem roda publicada: %s %s" % (nome, versao))
    return hs


def main():
    vers = resolve()
    L = ["# Eterna · bibliotecas do servidor Linux (Ubuntu 26.04, Python %s, placa NVIDIA). Gerado em %s por" % (PY, time.strftime("%Y-%m-%d")),
         "# gerar-requisitos.py a partir do PyPI: versões fixas de tudo (dependências incluídas) com o SHA-256 de cada arquivo.",
         "# Não editar à mão: para trocar uma versão, gerar de novo e revisar a diferença no commit."]
    for n in sorted(vers):
        hs = hashes(n, vers[n])
        L.append("%s==%s \\" % (n, vers[n]))
        L += ["    --hash=sha256:%s%s" % (h, " \\" if i < len(hs) - 1 else "") for i, h in enumerate(hs)]
    with open(os.path.join(AQUI, "requisitos.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print("requisitos.txt: %d pacotes" % len(vers))


if __name__ == "__main__":
    main()
