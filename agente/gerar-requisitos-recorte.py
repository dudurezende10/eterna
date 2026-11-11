# Eterna v97 · gera de novo agente/recorte-requisitos*.txt (versões fixas de todas as rodas do recorte, com o SHA-256 de cada
# arquivo publicado no PyPI) para o pip install --require-hashes dos instaladores. Só para quem troca uma versão (Eduardo ou
# Ronaldo), com internet, nunca no ponto. Só biblioteca padrão e o pip.
#   python3 agente/gerar-requisitos-recorte.py            (grava os 3 arquivos ao lado deste script)
# Resolve as dependências para Windows (3.12 e 3.13, CPU e placa) e Mac (arm64, 3.12 e 3.13) com pip --dry-run --report e
# pega no PyPI os hashes de TODAS as rodas da versão escolhida (o mesmo arquivo serve no Mac e no Windows). As versões de
# cada pacote precisam sair iguais em todas as plataformas; senão o script para e mostra a diferença.
import json, os, subprocess, sys, tempfile, time, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CPU = ["rembg==2.0.86", "onnxruntime==1.29.0", "opencv-python-headless==4.10.0.84", "psutil==7.2.2"]
GPU = ["rembg==2.0.86", "onnxruntime-gpu[cuda,cudnn]==1.29.0", "opencv-python-headless==4.10.0.84", "psutil==7.2.2"]
ALVOS = [("win_amd64", "3.12", CPU), ("win_amd64", "3.13", CPU), ("win_amd64", "3.12", GPU), ("win_amd64", "3.13", GPU),
         ("macosx_14_0_arm64", "3.12", CPU), ("macosx_14_0_arm64", "3.13", CPU)]
SO_WINDOWS = {"colorama"}          # o pip avalia o marcador na máquina que gera; no Windows o tqdm pede o colorama


def resolve(plat, py, reqs):
    with tempfile.TemporaryDirectory() as d:
        rep = os.path.join(d, "r.json")
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--dry-run", "--ignore-installed", "--only-binary=:all:",
                        "--platform", plat, "--python-version", py, "--target", os.path.join(d, "t"), "--report", rep] + reqs, check=True)
        return {it["metadata"]["name"].lower(): it["metadata"]["version"] for it in json.load(open(rep))["install"]}


def hashes(nome, versao):
    j = json.load(urllib.request.urlopen("https://pypi.org/pypi/%s/%s/json" % (nome, versao), timeout=60))
    return sorted({u["digests"]["sha256"] for u in j["urls"] if u["packagetype"] == "bdist_wheel"})


def main():
    vers, gpu_so = {}, set()
    for plat, py, reqs in ALVOS:
        r = resolve(plat, py, reqs)
        for n, v in r.items():
            if vers.setdefault(n, v) != v:
                raise SystemExit("versão diferente entre plataformas: %s %s e %s" % (n, vers[n], v))
            if reqs is GPU and n not in resolve_cpu:
                gpu_so.add(n)
    for n in SO_WINDOWS:
        j = json.load(urllib.request.urlopen("https://pypi.org/pypi/%s/json" % n, timeout=60))
        vers[n] = j["info"]["version"]
    hs = {n: hashes(n, v) for n, v in vers.items()}
    hoje = time.strftime("%Y-%m-%d")

    def grava(nome, nomes, titulo):
        L = ["# Eterna v97 · recorte dos fundos de IA (%s). Gerado em %s a partir do PyPI: versões fixas de todas as rodas" % (titulo, hoje),
             "# (dependências incluídas) com o SHA-256 de cada arquivo publicado. O instalador usa: pip install --require-hashes",
             "# --only-binary=:all: -r <este arquivo>. Não editar à mão: para trocar uma versão, gerar de novo (ver CHECKLIST-SERVIDOR)."]
        for n in sorted(nomes):
            mk = ' ; platform_system == "Windows"' if n in SO_WINDOWS else ""
            L.append("%s==%s%s \\" % (n, vers[n], mk))
            L += ["    --hash=sha256:%s%s" % (h, " \\" if i < len(hs[n]) - 1 else "") for i, h in enumerate(hs[n])]
        with open(os.path.join(AQUI, nome), "w", encoding="utf-8") as f:
            f.write("\n".join(L) + "\n")
    todos = set(vers)
    grava("recorte-requisitos.txt", todos - gpu_so - {"onnxruntime-gpu"}, "processador: Mac e Windows")
    grava("recorte-requisitos-gpu.txt", todos - {"onnxruntime"}, "placa NVIDIA: servidor Windows com instalar-recorte.bat gpu")
    v = vers["onnxruntime-gpu"]
    with open(os.path.join(AQUI, "recorte-requisitos-ort-gpu.txt"), "w", encoding="utf-8") as f:
        f.write("# Eterna v97 · só o onnxruntime-gpu (mesma versão e hashes de recorte-requisitos-gpu.txt). Usado por instalar-recorte.bat gpu\n"
                "# com --force-reinstall --no-deps apenas quando o provedor CUDA falta depois da instalação (onnxruntime de CPU gravou por cima).\n"
                + "onnxruntime-gpu==%s \\\n" % v + " \\\n".join("    --hash=sha256:%s" % h for h in hs["onnxruntime-gpu"]) + "\n")
    print("ok: %d pacotes (%d só da placa)" % (len(vers), len(gpu_so)))


resolve_cpu = set()
if __name__ == "__main__":
    resolve_cpu.update(resolve("win_amd64", "3.12", CPU))
    main()
