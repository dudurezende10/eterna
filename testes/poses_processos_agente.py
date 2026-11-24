# 23/11 (plano docs/planos/2026-11-23-poses-estatistica.md, P1, testador): processos do classificador de poses que o
# poses_agente.py não cobre. O agente/eterna-poses.py e o agente/medir-poses.py são os de verdade; só o llama-server é o
# testes/_poses_filho_falso.py.
#   A. SIGTERM no filho no meio da abertura (logo depois do Popen e mais tarde): o llama-server fecha e a pasta da chave some
#   B. na partida, o filho ainda abrindo do poses-filho.json é encerrado com o llama-server dele; pid reaproveitado por
#      outro programa não é morto
#   C. a limpeza de órfãos do agente não toca no llama-server da medição (ponto/medir/poses-*)
#   D. medir-poses.py: recusa com o classificador do agente aberto (poses-filho.json ou llama-server com a chave em
#      ponto/poses-*), sem SHA fixo diz "modelo indisponível" sem abrir nada; com SHA de teste mede de ponta a ponta, chave em
#      ponto/medir, não grava no poses.db, não imprime id de foto e não deixa processo; abertura estourada não deixa órfão
#   E. visao-instalar.sh: bash -n e as validações de LLAMA_TAG (bNNNN) e LLAMA_COMMIT (40 hex) antes de qualquer passo. O
#      instalador NUNCA é executado aqui: só as 4 linhas de validação, copiadas para um bash à parte. 24/11: as validações de
#      POSE_SHA_MODELO e POSE_SHA_MMPROJ (64 hex) também vêm antes do passo 1; o instalar-poses-modelos.py não baixa nada sem o
#      SHA-256 esperado de cada arquivo, e arquivo com SHA diferente é apagado e dá erro (download trocado por um falso)
#   F. o laço de verdade: versão do filho diferente (parado, nada gravado, nenhum processo), desligar no meio da noite fecha
#      filho e llama-server (parou_por desligada), Sombra gravada 5 vezes seguidas abre um filho só
# Miniaturas desenhadas na hora; nenhuma foto de visitante.
#   HOME=$(mktemp -d) python3 -I testes/poses_processos_agente.py agente/eterna-agente.py
import hashlib, importlib.util, json, os, re, shutil, signal, subprocess, sys, threading, time
sys.dont_write_bytecode = True
REPO = os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[1])))
sys.path.insert(0, os.path.join(REPO, "testes"))
import _agente_sessao  # noqa: F401  (para sem HOME temporário)
AG = os.path.join(REPO, "agente", "eterna-agente.py")
FILHO = os.path.join(REPO, "agente", "eterna-poses.py")
FALSO = os.path.join(REPO, "testes", "_poses_filho_falso.py")
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
os.environ["ETERNA_SEM_OPENCV"] = "1"
os.environ.pop("ETERNA_POSES", None)
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas, info = [], {}


def ok(c, msg):
    if not c:
        falhas.append(msg)


def espera(fn, seg=10.0):
    t0 = time.time()
    while time.time() - t0 < seg:
        try:
            if fn():
                return True
        except Exception:
            pass
        time.sleep(0.05)
    return False


def vivo(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:
        return open("/proc/%d/stat" % pid).read().rsplit(")", 1)[-1].split()[0] != "Z"
    except OSError:
        return False


os.makedirs(m.MODELOS, exist_ok=True)
for arq, txt in ((m.POSE_ARQ, b"gguf de teste"), (m.POSE_MMPROJ_ARQ, b"mmproj de teste")):
    open(os.path.join(m.MODELOS, arq), "wb").write(txt)
SHA, MSHA = hashlib.sha256(b"gguf de teste").hexdigest(), hashlib.sha256(b"mmproj de teste").hexdigest()
FDIR = os.path.join(HOME, "falso")
os.makedirs(FDIR)
BIN = os.path.join(HOME, "llama-server")
open(BIN, "w").write("#!/bin/sh\nexec '%s' -I '%s' --falso-dir '%s' \"$@\"\n" % (sys.executable, FALSO, FDIR))
os.chmod(BIN, 0o755)
os.makedirs(m.THUMBS, exist_ok=True)
os.makedirs(m.INBOX, exist_ok=True)
PONTO = os.path.dirname(m.POSES_DB)
os.makedirs(PONTO, exist_ok=True)


def controle(**kw):
    json.dump(kw, open(os.path.join(FDIR, "controle.json.tmp"), "w"))
    os.replace(os.path.join(FDIR, "controle.json.tmp"), os.path.join(FDIR, "controle.json"))


def llamas():
    return [json.load(open(os.path.join(FDIR, a))) for a in sorted(os.listdir(FDIR)) if a.startswith("llama-")]


def abre_filho(ponto):
    cmd = [sys.executable, "-I", FILHO, "--inbox", m.INBOX, "--thumbs", m.THUMBS, "--modelos", m.MODELOS, "--bin", BIN,
           "--modelo-arq", m.POSE_ARQ, "--mmproj-arq", m.POSE_MMPROJ_ARQ, "--sha", SHA, "--mmproj-sha", MSHA, "--ponto", ponto]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)


def le_linha(p, seg=10):
    r = {}
    t = threading.Thread(target=lambda: r.setdefault("l", p.stdout.readline()), daemon=True)
    t.start()
    t.join(seg)
    try:
        return json.loads(r.get("l") or "null")
    except ValueError:
        return None


try:
    # ---------- A. SIGTERM no filho no meio da abertura: llama-server fechado, chave apagada ----------
    controle(sem_health=True)
    for atraso in (0.0, 0.05, 0.3, 1.5):
        antes = {x["pid"] for x in llamas()}
        p = abre_filho(PONTO)
        j = le_linha(p, 15)
        ok(isinstance(j, dict) and isinstance(j.get("llama_pid"), int), "A(%.2f): o filho avisa o llama_pid logo depois do Popen: %r" % (atraso, j))
        lp = (j or {}).get("llama_pid")
        time.sleep(atraso)
        p.send_signal(signal.SIGTERM)
        try:
            p.wait(15)
        except subprocess.TimeoutExpired:
            p.kill()
        novos = [x for x in llamas() if x["pid"] not in antes]
        ok(espera(lambda: lp and not vivo(lp) and all(not vivo(x["pid"]) for x in novos), 15),
           "A(%.2f): SIGTERM na abertura: nenhum llama-server vivo (%r)" % (atraso, [(x["pid"], vivo(x["pid"])) for x in novos] + [lp]))
        sobra = [d for d in os.listdir(PONTO) if d.startswith("poses-") and os.path.isdir(os.path.join(PONTO, d))]
        ok(not sobra, "A(%.2f): pasta da chave apagada: %r" % (atraso, sobra))
        for x in novos:
            if vivo(x["pid"]):
                os.kill(x["pid"], 9)

    # ---------- B. partida: poses-filho.json com filho vivo (abrindo) é encerrado com o llama-server ----------
    antes = {x["pid"] for x in llamas()}
    p = abre_filho(PONTO)
    j = le_linha(p, 15)
    lp = (j or {}).get("llama_pid")
    m._grava_privado(m.POSE_PIDS, json.dumps({"filho": p.pid, "llama": lp, "agente": 999999, "criado": time.time()}))
    outro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)", "eterna-poses-nao.py"])
    n = m.poses_orfaos_encerrar()
    try:
        p.wait(10)
    except subprocess.TimeoutExpired:
        pass
    novos = [x for x in llamas() if x["pid"] not in antes]
    ok(n >= 1 and p.poll() is not None and not vivo(lp) and all(not vivo(x["pid"]) for x in novos) and not os.path.exists(m.POSE_PIDS),
       "B: partida encerra filho e llama-server do poses-filho.json (n=%d, filho=%r, llama vivo=%r)" % (n, p.poll(), vivo(lp)))
    ok(outro.poll() is None, "B: processo alheio não é morto")
    outro.kill()
    outro.wait()
    sobra = [d for d in os.listdir(PONTO) if d.startswith("poses-") and os.path.isdir(os.path.join(PONTO, d))]
    ok(not sobra, "B: pastas de chave apagadas: %r" % sobra)
    # poses-filho.json apontando para um pid reaproveitado por outro programa: não mata
    alheio = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    m._grava_privado(m.POSE_PIDS, json.dumps({"filho": alheio.pid, "llama": alheio.pid, "agente": 1}))
    m.poses_orfaos_encerrar()
    ok(alheio.poll() is None, "B: pid reaproveitado por outro programa não é morto")
    alheio.kill()
    alheio.wait()

    # ---------- C. a limpeza de órfãos do agente não derruba o llama-server da medição (ponto/medir) ----------
    MED = os.path.join(PONTO, "medir")
    os.makedirs(MED, exist_ok=True)
    antes = {x["pid"] for x in llamas()}
    pm = abre_filho(MED)
    j = le_linha(pm, 15)
    lpm = (j or {}).get("llama_pid")
    ok(espera(lambda: lpm and vivo(lpm), 5), "C: llama-server da medição aberto")
    m.poses_orfaos_encerrar()
    time.sleep(0.5)
    ok(lpm and vivo(lpm) and pm.poll() is None, "C: poses_orfaos_encerrar não toca o llama-server de ponto/medir")
    # D1. medir-poses.py recusa com um llama-server com a chave em ponto/poses-* (aqui o da medição NÃO conta: está em ponto/medir)
    pm.send_signal(signal.SIGTERM)
    pm.wait(15)
    ok(espera(lambda: not vivo(lpm), 10), "C: medição fechada pelo SIGTERM")

    MEDIR = os.path.join(REPO, "agente", "medir-poses.py")
    env = dict(os.environ, HOME=HOME)
    # D1: filho do agente aberto (poses-filho.json com pid vivo e cmdline do eterna-poses.py)
    p = abre_filho(PONTO)
    j = le_linha(p, 15)
    lp = (j or {}).get("llama_pid")
    m._grava_privado(m.POSE_PIDS, json.dumps({"filho": p.pid, "llama": lp, "agente": os.getpid()}))
    r = subprocess.run([sys.executable, "-I", MEDIR, "--n", "5"], env=env, capture_output=True, text=True, timeout=120)
    ok(r.returncode == 2 and "aberto" in r.stdout, "D1: medir recusa com o classificador aberto (poses-filho.json): %d %r" % (r.returncode, r.stdout[-200:]))
    ok(p.poll() is None and vivo(lp), "D1: medir não derruba o classificador do agente")
    # D2: sem poses-filho.json, mas o llama-server com chave em ponto/poses-*
    os.remove(m.POSE_PIDS)
    r = subprocess.run([sys.executable, "-I", MEDIR, "--n", "5"], env=env, capture_output=True, text=True, timeout=120)
    ok(r.returncode == 2 and "aberto" in r.stdout, "D2: medir recusa com llama-server solto em ponto/poses-*: %d %r" % (r.returncode, r.stdout[-200:]))
    p.send_signal(signal.SIGTERM)
    p.wait(15)
    ok(espera(lambda: not vivo(lp), 10), "D2: fechado")
    # D3: nada aberto e o SHA do repositório vazio: modelo indisponível, nenhum processo
    antes = {x["pid"] for x in llamas()}
    r = subprocess.run([sys.executable, "-I", MEDIR, "--n", "5"], env=env, capture_output=True, text=True, timeout=120)
    ok(r.returncode == 2 and "indispon" in r.stdout and not [x for x in llamas() if x["pid"] not in antes],
       "D3: medir sem SHA fixo: modelo indisponível, nada aberto: %d %r" % (r.returncode, r.stdout[-200:]))
    # D4: cópia do agente com SHA e binário de teste: medir roda de ponta a ponta e não deixa nada
    COP = os.path.join(HOME, "copia", "agente")
    shutil.copytree(os.path.join(REPO, "agente"), COP, ignore=shutil.ignore_patterns("__pycache__"))
    src = open(os.path.join(COP, "eterna-agente.py"), encoding="utf8").read()
    src = src.replace('POSE_SHA = ""', 'POSE_SHA = "%s"' % SHA, 1).replace('POSE_MMPROJ_SHA = ""', 'POSE_MMPROJ_SHA = "%s"' % MSHA, 1)
    src = src.replace('POSE_BIN = "/opt/eterna/visao/bin/llama-server"', 'POSE_BIN = "%s"' % BIN, 1)
    open(os.path.join(COP, "eterna-agente.py"), "w", encoding="utf8").write(src)
    from PIL import Image
    for i in range(10):
        Image.new("RGB", (300, 200) if i % 2 else (200, 300), (i * 20, 90, 120)).save(os.path.join(m.THUMBS, "%012x.jpg" % (0xabc000000000 + i)), "JPEG")
    controle()
    antes = {x["pid"] for x in llamas()}
    r = subprocess.run([sys.executable, "-I", os.path.join(COP, "medir-poses.py"), "--n", "10"], env=env, capture_output=True, text=True, timeout=180)
    info["medir"] = r.stdout[-600:]
    novos = [x for x in llamas() if x["pid"] not in antes]
    ok(r.returncode == 0 and "respostas válidas" in r.stdout and "mediana" in r.stdout, "D4: medir mede: %d %r" % (r.returncode, r.stdout[-400:] + r.stderr[-300:]))
    ok(novos and all(os.path.dirname(os.path.dirname(x["chave_arq"])) == MED for x in novos), "D4: chave da medição em ponto/medir/poses-*: %r" % [x["chave_arq"] for x in novos])
    ok(espera(lambda: all(not vivo(x["pid"]) for x in novos), 10), "D4: nenhum llama-server da medição sobra")
    sob=[(d, os.listdir(os.path.join(MED,d))) for d in os.listdir(MED) if d.startswith("poses-") and os.path.isdir(os.path.join(MED, d))]
    ok(not sob, "D4: pasta da chave da medição apagada: %r (novos=%r)" % (sob, [x["chave_arq"] for x in novos]))
    ok(not any(re.search(r"[0-9a-f]{12}", l) for l in r.stdout.splitlines() if "pid" not in l.lower() and "MB" not in l), "D4: medir não imprime id de foto")
    ok(not os.path.exists(m.POSES_DB), "D4: medir não grava no poses.db")
    # D5: medir com o lote passando do prazo (sem_health: a abertura não termina) -> não deixa órfão
    controle(sem_health=True)
    src2 = src.replace("POSE_CARGA_SEG = 360", "POSE_CARGA_SEG = 3", 1)
    open(os.path.join(COP, "eterna-agente.py"), "w", encoding="utf8").write(src2)
    antes = {x["pid"] for x in llamas()}
    r = subprocess.run([sys.executable, "-I", os.path.join(COP, "medir-poses.py"), "--n", "3"], env=env, capture_output=True, text=True, timeout=180)
    novos = [x for x in llamas() if x["pid"] not in antes]
    ok(r.returncode == 3 and novos and espera(lambda: all(not vivo(x["pid"]) for x in novos), 15),
       "D5: medir com abertura estourada: código 3 e nenhum llama-server sobra: %d %r" % (r.returncode, r.stdout[-200:]))
    controle()

    # ---------- E. visao-instalar.sh: bash -n e as validações de LLAMA_TAG e LLAMA_COMMIT (sem executar o instalador) ----------
    SH = os.path.join(REPO, "servidor", "linux", "visao-instalar.sh")
    ok(subprocess.run(["bash", "-n", SH]).returncode == 0, "E: bash -n")
    txt = open(SH, encoding="utf8").read()
    linhas = [l for l in txt.splitlines() if l.startswith("[ -n \"$LLAMA_") or l.startswith("[[ \"$LLAMA_")]
    ok(len(linhas) == 4, "E: 4 validações de LLAMA_TAG/LLAMA_COMMIT: %r" % linhas)
    ok(txt.index("LLAMA_COMMIT\" =~") < txt.index("passo \"1."), "E: as validações vêm antes do passo 1 (nada instalado sem elas)")
    ok("-hf" not in re.sub(r"grep -nE -- '[^']*'", "", txt.split("passo \"1.")[1]).replace("sem -hf", ""), "E: o roteiro não chama -hf")
    corpo = "set -u\npara(){ echo \"PAROU $*\"; exit 1; }\n" + "\n".join(linhas) + "\necho PASSOU\n"
    casos = [("", "", False), ("b6500", "", False), ("b6500", "abc", False), ("b6500", "A" * 40, False), ("b6500", "a" * 39, False),
             ("main", "a" * 40, False), ("b6500;rm", "a" * 40, False), ("b6500", "a" * 40 + "\n", False), ("b6500", "0123456789abcdef0123456789abcdef01234567", True)]
    for tag, com, deve in casos:
        r = subprocess.run(["bash", "-c", corpo], env={"PATH": os.environ["PATH"], "LLAMA_TAG": tag, "LLAMA_COMMIT": com}, capture_output=True, text=True)
        passou = "PASSOU" in r.stdout
        ok(passou == deve, "E: LLAMA_TAG=%r LLAMA_COMMIT=%r -> %s" % (tag, com[:12], "passa" if passou else "para"))
    ok('LLAMA_TAG="${LLAMA_TAG:-}"' in txt and 'LLAMA_COMMIT="${LLAMA_COMMIT:-}"' in txt, "E: sem valor padrão (vazio = para)")
    ok("rev-parse HEAD)\" = \"$LLAMA_COMMIT\"" in txt, "E: confere o commit do código baixado")
    # 24/11: o SHA-256 esperado do modelo é exigido antes do passo 1 (sem ele nada seria conferido)
    ls_sha = [l.strip() for l in txt.splitlines() if l.strip().startswith('[[ "$POSE_SHA_')]
    ok(len(ls_sha) == 2 and txt.index('[[ "$POSE_SHA_MMPROJ" =~') < txt.index('passo "1.'), "E: 2 validações do SHA do modelo antes do passo 1: %r" % ls_sha)
    ok("--conferir" not in txt and "--esperado-modelo" in txt and "--esperado-mmproj" in txt, "E: o passo 3 passa o SHA esperado (sem --conferir)")
    corpo = "set -u\npara(){ echo \"PAROU $*\"; exit 1; }\n" + "\n".join(ls_sha) + "\necho PASSOU\n"
    H64 = "0123456789abcdef" * 4
    for mod, mmp, deve in (("", "", False), (H64, "", False), ("", H64, False), (H64[:-1], H64, False), (H64 + "0", H64, False),
                           (H64.replace("0", "g"), H64, False), (H64 + ";x", H64, False), (H64, H64, True)):
        r = subprocess.run(["bash", "-c", corpo], env={"PATH": os.environ["PATH"], "POSE_SHA_MODELO": mod, "POSE_SHA_MMPROJ": mmp}, capture_output=True, text=True)
        ok(("PASSOU" in r.stdout) == deve, "E: POSE_SHA_MODELO=%r POSE_SHA_MMPROJ=%r -> %s" % (mod[:8], mmp[:8], r.stdout.strip()[-40:]))
    # o instalador: sem SHA esperado não baixa nada; SHA em formato errado ou diferente do fixado no código: erro
    INST = os.path.join(REPO, "agente", "instalar-poses-modelos.py")
    H_I = os.path.join(HOME, "inst")
    os.makedirs(H_I, exist_ok=True)
    env_i = {"PATH": os.environ["PATH"], "HOME": H_I, "http_proxy": "http://127.0.0.1:9", "https_proxy": "http://127.0.0.1:9",
             "HTTP_PROXY": "http://127.0.0.1:9", "HTTPS_PROXY": "http://127.0.0.1:9"}     # rede de saída fechada: nada pode ser baixado
    r = subprocess.run([sys.executable, "-I", INST], env=env_i, capture_output=True, text=True, timeout=60)
    pasta_i = os.path.join(H_I, "Eterna", "modelos")
    ok(r.returncode == 1 and "Nada baixado" in r.stdout and "--esperado-modelo" in r.stdout and not (os.path.isdir(pasta_i) and os.listdir(pasta_i)),
       "E: sem SHA esperado não baixa nada e explica: %d %r" % (r.returncode, r.stdout[-300:]))
    r = subprocess.run([sys.executable, "-I", INST, "--esperado-modelo", H64], env=env_i, capture_output=True, text=True, timeout=60)
    ok(r.returncode == 1 and "Nada baixado" in r.stdout, "E: com o SHA de um arquivo só, nada baixado: %d %r" % (r.returncode, r.stdout[-200:]))
    for args in (["--esperado-modelo", "abc", "--esperado-mmproj", H64], ["--conferir"], ["--esperado-modelo"]):
        r = subprocess.run([sys.executable, "-I", INST] + args, env=env_i, capture_output=True, text=True, timeout=60)
        ok(r.returncode == 2 and "FALHA" in r.stdout, "E: %r recusado: %d %r" % (args, r.returncode, r.stdout[-200:]))
    # download trocado por um falso (sem rede): SHA diferente apaga e para no primeiro; igual instala; já certo não baixa de novo
    spi = importlib.util.spec_from_file_location("inst", INST)
    inst = importlib.util.module_from_spec(spi)
    spi.loader.exec_module(inst)
    inst.PASTA, inst.LIVRE_GB = os.path.join(H_I, "modelos-teste"), 0
    conteudo = {inst.POSE_ARQ: b"modelo de teste", inst.POSE_MMPROJ_ARQ: b"mmproj de teste"}
    baixados = []

    def baixar_falso(url, destino):
        baixados.append(os.path.basename(destino))
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        tmp = os.path.join(os.path.dirname(destino), ".baixando-teste")
        open(tmp, "wb").write(conteudo[os.path.basename(destino)])
        return tmp
    inst.baixar = baixar_falso

    def quieto(f, *a):                                   # a saída do instalador não vai para a linha de resultado do teste
        import contextlib, io
        with contextlib.redirect_stdout(io.StringIO()):
            return f(*a)
    sha_m, sha_p = (hashlib.sha256(conteudo[a]).hexdigest() for a in (inst.POSE_ARQ, inst.POSE_MMPROJ_ARQ))
    ok(quieto(inst.main, ["x", "--esperado-modelo", H64, "--esperado-mmproj", sha_p]) == 1 and baixados == [inst.POSE_ARQ]
       and not os.listdir(inst.PASTA), "E: SHA diferente: arquivo apagado, erro e o segundo nem é baixado: %r %r" % (baixados, os.listdir(inst.PASTA)))
    del baixados[:]
    ok(quieto(inst.main, ["x", "--esperado-modelo", sha_m.upper(), "--esperado-mmproj", sha_p]) == 0 and baixados == [inst.POSE_ARQ, inst.POSE_MMPROJ_ARQ]
       and sorted(os.listdir(inst.PASTA)) == sorted(conteudo), "E: SHA igual instala os dois: %r" % os.listdir(inst.PASTA))
    del baixados[:]
    ok(quieto(inst.main, ["x", "--esperado-modelo", sha_m, "--esperado-mmproj", sha_p]) == 0 and baixados == [], "E: já certo não baixa de novo")
    inst.POSE_SHA = H64
    ok(quieto(inst.main, ["x", "--esperado-modelo", sha_m, "--esperado-mmproj", sha_p]) == 2, "E: SHA da linha de comando diferente do fixado no código: erro")

    # ---------- F. o laço de verdade: versão diferente, desligar no meio da noite, Sombra gravada várias vezes ----------
    controle()
    NV = os.path.join(HOME, "nvidia-smi")
    open(NV, "w").write("#!/bin/sh\necho 20000\n")
    os.chmod(NV, 0o755)
    m.POSE_NVSMI, m.POSE_BIN, m.POSE_SHA, m.POSE_MMPROJ_SHA = NV, BIN, SHA, MSHA
    m.POSE_DORME, m.POSE_FILA_SEG, m.POSE_ERRO_SEG, m.POSE_OCUPADO_SEG = 0.2, 1, 0, 2
    m._poses_sha_mem["v"] = None
    os.makedirs(m.THUMBS, exist_ok=True)
    fotos = []
    for i in range(40):
        pid = "%012x" % (0xc0de00000000 + i)
        f = os.path.join(m.THUMBS, pid + ".jpg")
        Image.new("RGB", (300, 200), (i * 5, 100, 50)).save(f, "JPEG")
        with m.lock:
            m.lib[pid] = {"file": f, "thumb": f}
            m.meta[pid] = {"o": "ana", "s": "ftp", "u": time.time() + i, "cap": time.time() + i}
        fotos.append(pid)
    HOJE = m._ff_hoje()
    json.dump({"sessoes": [{"card": "LPV1", "status": "fechada", "fotos": fotos, "fotografo": "ana"}]}, open(os.path.join(m.SESS_DIR, HOJE + ".json"), "w"))
    hm = lambda t: time.strftime("%H:%M", time.localtime(t))
    JAN = {"ini": hm(time.time() - 3600), "fim": hm(time.time() + 3600)}
    threading.Thread(target=m.poses_loop, daemon=True).start()
    # versão diferente
    m.POSE_PROMPT_V = "outra"
    m.poses_cfg_gravar({"modo": "sombra", "janela": JAN}, "adm")
    ok(espera(lambda: m.poses_status()["noite"]["parou_por"] == "versao", 20), "versao: parado: %r" % m.poses_status()["noite"])
    ok(llamas() and espera(lambda: all(not vivo(x["pid"]) for x in llamas()), 10) and m.poses_filho["p"] is None, "versao: nenhum llama-server nem filho sobra")
    ok(not os.path.exists(m.POSES_DB) or not len(__import__("sqlite3").connect(m.POSES_DB).execute("select * from pose").fetchall()), "versao: nada gravado")
    m.POSE_PROMPT_V = "p1"
    with m.poses_lock:
        m.poses_st.update(parado=None, parado_por=None, mortes=0, erro=None)
    # desligar com o filho aberto e classificando (dormir) fecha tudo
    controle(dormir=0.5)
    ok(espera(lambda: m.poses_filho.get("pronto") and m.poses_st["rodando"], 20), "desligar: classificando")
    m.poses_cfg_gravar({"modo": "desligada"}, "adm")
    ok(espera(lambda: m.poses_filho["p"] is None and all(not vivo(x["pid"]) for x in llamas()), 20), "desligar: filho e llama-server fechados")
    ok(espera(lambda: m.poses_status()["noite"]["parou_por"] == "desligada", 5), "desligar: parou_por desligada: %r" % m.poses_status()["noite"])
    # cliques repetidos na chave: Sombra 5 vezes seguidas -> um filho só
    controle(dormir=0.3)
    for _ in range(5):
        m.poses_cfg_gravar({"modo": "sombra"}, "adm")
    ok(espera(lambda: m.poses_filho.get("pronto"), 20), "repetido: abriu")
    time.sleep(1.5)
    vivos = [x["pid"] for x in llamas() if vivo(x["pid"])]
    ok(len(vivos) == 1, "repetido: um llama-server só: %r" % vivos)
    m.poses_cfg_gravar({"modo": "desligada"}, "adm")
    ok(espera(lambda: all(not vivo(x["pid"]) for x in llamas()), 20), "repetido: fechado")
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-1500:])
    print(traceback.format_exc())
# nada fica rodando
m.poses_parar.set()
try:
    m.poses_fechar()
except Exception:
    pass
for x in llamas():
    if vivo(x["pid"]):
        try:
            os.kill(x["pid"], 9)
        except OSError:
            pass
print(("OK" if not falhas else "FALHA") + " poses_processos_agente: sinais na abertura, órfãos na partida, medir-poses.py, visao-instalar.sh, versão e chave no laço (P1)"
      + ("" if not falhas else " · " + " | ".join(falhas[:10])))
sys.stdout.flush()
os._exit(1 if falhas else 0)
