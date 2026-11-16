#!/usr/bin/env python3
# Eterna · medição do recorte (v97, plano docs/planos/2026-11-10-recorte-birefnet-sessoes.md, E7).
# Abre o processo de recorte de verdade (agente/eterna-recorte.py, BiRefNet + a regra) e recorta as fotos de uma pasta,
# uma por vez, como o agente faz. Mostra, por foto, os ms de cada etapa (birefnet, pessoas, isnet, pose, regra, gravar) e o
# pico de memória do processo de recorte (psutil, amostra a cada 50 ms; sem psutil, o pico que o próprio filho informa);
# no fim, a mediana e o p90 de cada etapa e a carga dos modelos.
#
# Uso (Mac: com o Python do ~/Eterna/venv, o mesmo do agente; Windows: %USERPROFILE%\Eterna\venv\Scripts\python.exe):
#   ~/Eterna/venv/bin/python3 agente/medir-recorte.py <pasta com fotos .jpg> [--gpu auto|cpu] [--saida <pasta dos PNG>]
# As fotos não saem do computador e não são copiadas para lugar nenhum; os PNG vão para uma pasta temporária (apagada no
# fim) ou para --saida. Rode com o agente FECHADO (dois BiRefNet ao mesmo tempo não cabem em 16 GB).
import glob, json, os, statistics, subprocess, sys, tempfile, threading, time, shutil

AQUI = os.path.dirname(os.path.abspath(__file__))


def arg(nome, padrao=None):
    a = sys.argv
    return a[a.index(nome) + 1] if nome in a and a.index(nome) + 1 < len(a) else padrao


def p90(v):
    v = sorted(v)
    return v[min(len(v) - 1, int(0.9 * len(v)))] if v else None


def medir_montagem():
    """--montagem: mede o processo de montagem (agente/eterna-montagem.py) com um recorte desenhado aqui (nenhuma foto):
    tempo por montagem e pico de memória, na prévia e na impressão dos 3 fundos ativos. Os fundos vêm da pasta img/ do
    repositório. Uso: python3 -I agente/medir-recorte.py --montagem [--voltas 3]"""
    raiz = os.path.dirname(AQUI)
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        print("falta o Pillow (o mesmo ambiente do agente: numpy, pillow e opencv-python-headless)")
        return 2
    tmp = tempfile.mkdtemp(prefix="eterna-medir-mtg-")
    try:
        rec, mont = os.path.join(tmp, "recortes"), os.path.join(tmp, "montagens")
        os.makedirs(rec)
        os.makedirs(mont)
        im = Image.new("RGBA", (3000, 2000), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for i, cx in enumerate((1250, 1750)):
            d.ellipse([cx - 140, 500, cx + 140, 860], fill=(226 - 40 * i, 190 - 30 * i, 160 - 30 * i, 255))
            d.rounded_rectangle([cx - 330, 840, cx + 330, 2300], radius=110, fill=(40 + 120 * i, 80, 150 - 60 * i, 255))
        im = im.convert("RGBa").filter(ImageFilter.GaussianBlur(1.6)).convert("RGBA")
        im.save(os.path.join(rec, "aaaaaaaaaaaa.png"), "PNG", compress_level=3)
        regras = json.loads(subprocess.run([sys.executable, "-I", os.path.join(AQUI, "eterna-montagem.py"), "--regras"],
                                           capture_output=True, text=True).stdout)
        modelos = arg("--modelos") or os.path.expanduser("~/Eterna/modelos")
        yunet = os.path.join(modelos, "face_detection_yunet_2023mar.onnx")
        p = subprocess.Popen([sys.executable, "-I", os.path.join(AQUI, "eterna-montagem.py"), "--recortes", rec, "--fundos", os.path.join(raiz, "img"),
                              "--montagens", mont, "--modelos", modelos], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)
        pronto = json.loads(p.stdout.readline() or "{}")
        if not pronto.get("pronto"):
            print("o processo de montagem não abriu:", pronto.get("erro"))
            return 3
        print("processo aberto em %s ms · rostos: %s" % (pronto.get("carga_ms"), "YuNet" if os.path.isfile(yunet) else "sem o modelo (monta sem rostos)"))
        voltas = int(arg("--voltas") or 3)
        tempos, pico, n = {}, 0, 0
        for v in range(voltas):
            for fundo in ("mirantedia", "arq1950", "telao"):
                for tipo in ("p", "i"):
                    n += 1
                    dest = os.path.join(mont, "aaaaaaaaaaaa", "%s-%08x-%s.jpg" % (fundo, v, tipo))
                    req = {"id": str(n), "op": "montar", "recorte": os.path.join(rec, "aaaaaaaaaaaa.png"), "fundo": fundo,
                           "previa_fundo": os.path.join(raiz, regras["fundos"][fundo]["previa"]), "hi_fundo": os.path.join(raiz, regras["fundos"][fundo]["hi"]),
                           "yunet": yunet if os.path.isfile(yunet) else None, "p": dest if tipo == "p" else None, "i": dest if tipo == "i" else None}
                    t0 = time.time()
                    p.stdin.write(json.dumps(req) + "\n")
                    p.stdin.flush()
                    j = json.loads(p.stdout.readline() or "{}")
                    if not j.get("ok"):
                        print("montagem %s %s falhou: %s" % (fundo, tipo, j.get("erro")))
                        return 4
                    tempos.setdefault((fundo, tipo), []).append(int((time.time() - t0) * 1000))
                    pico = max(pico, j.get("pico_mb") or 0)
        p.stdin.close()
        p.wait(timeout=10)
        print("montagem (ms, mediana de %d; a 1ª de cada recorte e de cada fundo inclui abrir os arquivos):" % voltas)
        for fundo in ("mirantedia", "arq1950", "telao"):
            print("  %-11s prévia %5d · impressão %5d" % (fundo, statistics.median(tempos[(fundo, "p")]), statistics.median(tempos[(fundo, "i")])))
        print("pico de memória do processo: %d MB" % pico)
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    if "--montagem" in sys.argv:
        return medir_montagem()
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
        print(__doc__ or "uso: medir-recorte.py <pasta> [--gpu auto|cpu] [--saida <pasta>]")
        return 2
    pasta = os.path.abspath(sys.argv[1])
    fotos = sorted(glob.glob(os.path.join(pasta, "*.jpg")) + glob.glob(os.path.join(pasta, "*.jpeg")) + glob.glob(os.path.join(pasta, "*.JPG")))
    if not fotos:
        print("nenhuma foto .jpg em", pasta)
        return 2
    saida = arg("--saida")
    tmp = tempfile.mkdtemp(prefix="eterna-medir-")
    dest = os.path.abspath(saida) if saida else tmp
    os.makedirs(dest, exist_ok=True)
    env = dict(os.environ)
    if arg("--gpu"):
        env["ETERNA_RECORTE_GPU"] = arg("--gpu")
    modelos = arg("--modelos") or os.path.expanduser("~/Eterna/modelos")
    p = subprocess.Popen([sys.executable, os.path.join(AQUI, "eterna-recorte.py"), "--inbox", pasta, "--recortes", dest, "--modelos", modelos],
                         stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None, text=True, bufsize=1, env=env)
    pico = [0]
    try:
        import psutil
        proc = psutil.Process(p.pid)
    except Exception:
        proc = None
    parar = threading.Event()

    def amostra():
        while not parar.is_set() and proc is not None:
            try:
                pico[0] = max(pico[0], proc.memory_info().rss)
            except Exception:
                break
            time.sleep(0.05)

    threading.Thread(target=amostra, daemon=True).start()
    t0 = time.time()
    pronto = json.loads(p.stdout.readline() or "{}")
    if not pronto.get("pronto"):
        print("o recorte não abriu:", pronto.get("erro") or "(o processo terminou; memória?) código %s" % p.poll())
        return 1
    carga_mb = pico[0] // (1024 * 1024)
    print("modelos abertos em %.1f s · provedor %s · %d MB depois da carga" % (time.time() - t0, pronto.get("provedor"), carga_mb))
    etapas, picos = {}, []
    for i, f in enumerate(fotos, 1):
        pid = "%012x" % i
        pico[0] = 0 if proc is not None else pico[0]
        t = time.time()
        p.stdin.write(json.dumps({"id": pid, "origem": f, "destino": os.path.join(dest, pid + ".png"), "trab": 1600}) + "\n")
        p.stdin.flush()
        linha = p.stdout.readline()
        if not linha:
            print("[%d] %s: o processo de recorte terminou (código %s; memória insuficiente?)" % (i, os.path.basename(f), p.wait()))
            return 1
        r = json.loads(linha)
        mb = pico[0] // (1024 * 1024) if proc is not None else (r.get("pico_mb") or 0)
        picos.append(mb)
        if not r.get("ok"):
            print("[%d] %s: erro %s" % (i, os.path.basename(f), r.get("erro")))
            continue
        for k, v in (r.get("ms") or {}).items():
            etapas.setdefault(k, []).append(v)
        print("[%d] %s: %.1f s · %s · pico %d MB" % (i, os.path.basename(f), time.time() - t,
                                                     ", ".join("%s %d ms" % kv for kv in (r.get("ms") or {}).items()), mb))
    parar.set()
    p.stdin.close()
    p.wait(timeout=30)
    print("\nresumo (%d fotos, %s):" % (len(fotos), pronto.get("provedor")))
    for k, v in etapas.items():
        print("  %-9s mediana %7d ms · p90 %7d ms" % (k, statistics.median(v), p90(v)))
    if picos:
        print("  pico de memória do recorte: mediana %d MB · máximo %d MB" % (statistics.median(picos), max(picos)))
    if not saida:
        shutil.rmtree(tmp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
