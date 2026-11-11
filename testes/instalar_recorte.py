# v97 (Segurança e Revisor, 10/11, itens 2 e 3): instaladores do recorte com versões fixas e hashes, e o modo gpu sem o
# onnxruntime de CPU. Confere os arquivos (o .bat não roda aqui): roda sozinho pelo testes/rodar.sh.
#   python3 -I testes/instalar_recorte.py agente/eterna-agente.py
import os, re, sys

AG = os.path.dirname(os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "agente/eterna-agente.py"))
falhas = []


def ok(c, m):
    if not c:
        falhas.append(m)


def req(nome):
    txt = open(os.path.join(AG, nome), encoding="utf-8").read()
    pac, atual = {}, None
    for linha in txt.splitlines():
        s = linha.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("--hash=sha256:"):
            h = s.split(":", 1)[1].rstrip(" \\")
            ok(re.fullmatch(r"[0-9a-f]{64}", h) is not None, "%s: hash inválido %r" % (nome, h))
            pac[atual].append(h)
            continue
        m = re.match(r"^([a-z0-9._-]+)==([0-9][0-9A-Za-z.+-]*)( ; platform_system == \"Windows\")? \\$", s)
        ok(m is not None, "%s: linha sem versão fixa: %r" % (nome, s))
        if m:
            atual = m.group(1)
            pac[atual] = []
    for n, hs in pac.items():
        ok(hs, "%s: %s sem hash" % (nome, n))
    return pac


cpu, gpu, ort = req("recorte-requisitos.txt"), req("recorte-requisitos-gpu.txt"), req("recorte-requisitos-ort-gpu.txt")
ok({"rembg", "onnxruntime", "opencv-python-headless", "psutil", "numpy", "pillow"} <= set(cpu) and "onnxruntime-gpu" not in cpu
   and not any(n.startswith("nvidia-") for n in cpu), "CPU: pacotes do recorte e nada da placa: %r" % sorted(cpu))
nv = [n for n in gpu if n.startswith("nvidia-")]
ok("onnxruntime-gpu" in gpu and "onnxruntime" not in gpu and {"nvidia-cuda-runtime", "nvidia-cudnn-cu13", "nvidia-cublas", "nvidia-cufft",
   "nvidia-curand", "nvidia-cuda-nvrtc"} <= set(nv), "GPU: onnxruntime-gpu e as bibliotecas nvidia-* fixas, sem o de CPU: %r" % sorted(gpu))
ok(set(ort) == {"onnxruntime-gpu"} and ort["onnxruntime-gpu"] == gpu["onnxruntime-gpu"], "ort-gpu: só o onnxruntime-gpu com os mesmos hashes")
comum = set(cpu) & set(gpu)
ok(all(cpu[n] == gpu[n] for n in comum), "mesmas versões e hashes nos pacotes comuns")
ag = open(os.path.join(AG, "eterna-agente.py"), encoding="utf-8").read()
mv = re.search(r'REC_VERSOES = "([^"]+)"', ag).group(1)
txt_cpu = open(os.path.join(AG, "recorte-requisitos.txt"), encoding="utf-8").read()
ok(all(p in txt_cpu for p in mv.split()), "REC_VERSOES do agente igual ao arquivo: %r" % mv)

bat = open(os.path.join(AG, "instalar-recorte.bat"), encoding="utf-8", newline="").read()
ok("\r\n" in bat and "--require-hashes" in bat and "--only-binary=:all:" in bat, "bat: CRLF, --require-hashes e só rodas")
ok(not re.search(r"pip\"? (-m pip )?install[^\r\n]*==", bat) and "PACOTES" not in bat, "bat: nenhum pacote fora dos arquivos com hash")
ok('set "REQ=recorte-requisitos-gpu.txt"' in bat and "pip uninstall -y -q onnxruntime onnxruntime-gpu" in bat,
   "bat gpu: usa o arquivo da placa e tira o de CPU antes (se estiver lá)")
ok(bat.count("--force-reinstall") == 1 and "CUDAExecutionProvider" in bat and "--force-reinstall --no-deps -r recorte-requisitos-ort-gpu.txt" in bat,
   "bat gpu: --force-reinstall só do onnxruntime-gpu e só sem o provedor CUDA")
# rodar duas vezes: a desinstalação só acontece com o pacote errado presente (pip show), a instalação é idempotente (-r com
# hash: "already satisfied" não baixa nada) e o --force-reinstall depende do provedor faltar
i_show = bat.index("pip show -q onnxruntime >nul")
ok(bat.index("if not errorlevel 1", i_show) < bat.index("pip uninstall", i_show), "bat: só desinstala depois de achar o pacote")
cmd = open(os.path.join(AG, "instalar-recorte.command"), encoding="utf-8").read()
ok("--require-hashes" in cmd and 'REQ="recorte-requisitos.txt"' in cmd and "--upgrade pip" not in cmd and "PACOTES" not in cmd,
   "command: hashes e sem pip sem versão")
ck = open(os.path.join(AG, "..", "docs", "CHECKLIST-SERVIDOR.md"), encoding="utf-8").read()
ok("--require-hashes" in ck and "Administradores" in ck and "SYSTEM" in ck and "icacls" in ck, "CHECKLIST: venv do serviço com ACL e hashes")
if falhas:
    print("FALHA instalar_recorte: " + " | ".join(falhas))
    sys.exit(1)
print("OK instalar_recorte: requisitos com versões fixas e hashes (CPU %d, placa %d com %d nvidia-*), bat gpu sem o onnxruntime de CPU, CHECKLIST com o venv do serviço" % (len(cpu), len(gpu), len(nv)))
