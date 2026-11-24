#!/usr/bin/env python3
# Eterna · medição da classificação de poses (P1 do plano docs/planos/2026-11-23-poses-estatistica.md, critério 12).
# Abre o classificador de verdade (agente/eterna-poses.py, que sobe o llama-server só no 127.0.0.1) e classifica as N
# miniaturas mais recentes de hoje, em lotes de 8, como o agente faz. No fim mostra: tempo de abertura, ms por foto
# (mediana e p90), % de respostas válidas (pela mesma pose_valida do agente), o pico de memória usada na placa
# (nvidia-smi a cada 0,5 s) e os processos na placa nesse pico (o recorte tem que continuar lá, na placa).
# Nada é gravado: nenhuma linha no poses.db, nenhuma foto copiada; só números na tela (nenhum id de foto).
#
# Uso, no servidor do estádio, à noite, com o agente e o recorte no ar e a classificação de poses DESLIGADA no Eterna
# (Fundos de IA (técnico) › Classificação de poses; dois modelos de visão juntos não cabem na placa):
#   sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/medir-poses.py --n 50
# Meta (critério 12): mediana de 2,5 s ou menos por foto e 95% ou mais de respostas válidas.
# Recusa rodar com o classificador do agente aberto (poses-filho.json ou um llama-server com a chave em ponto/poses-*).
# A chave da medição fica em ponto/medir/poses-* (pasta própria): a limpeza de órfãos do agente, que procura em
# ponto/poses-*, não derruba o llama-server da medição, e o log dele vai para ponto/medir/poses-llama.log.
# Prazo estourado (abrir ou um lote): SIGTERM no classificador (ele fecha o llama-server), SIGKILL só se não sair.
import glob, importlib.util, json, os, queue, statistics, subprocess, sys, threading, time

AQUI = os.path.dirname(os.path.abspath(__file__))
os.environ["ETERNA_SEM_OPENCV"] = "1"     # só as constantes e a pose_valida do agente: o OpenCV não precisa carregar
AG = None                                 # o módulo do agente (main)


def arg(nome, padrao=None):
    a = sys.argv
    return a[a.index(nome) + 1] if nome in a and a.index(nome) + 1 < len(a) else padrao


def p90(v):
    v = sorted(v)
    return v[min(len(v) - 1, int(0.9 * len(v)))] if v else None


def placa(campo):
    try:
        r = subprocess.run(["nvidia-smi", "--query-gpu=%s" % campo, "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=10)
        return int(r.stdout.split()[0])
    except Exception:
        return None


def processos_placa():
    try:
        r = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader"],
                           capture_output=True, text=True, timeout=10)
        return [x.strip() for x in r.stdout.splitlines() if x.strip()]
    except Exception:
        return []


def main():
    n = int(arg("--n") or 50)
    sp = importlib.util.spec_from_file_location("eterna_agente", os.path.join(AQUI, "eterna-agente.py"))
    ag = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(ag)               # só as constantes e a pose_valida (o agente em si não sobe aqui)
    global AG
    AG = ag
    aberto = False
    try:
        with open(ag.POSE_PIDS, encoding="utf8") as f:
            j = json.load(f)
        aberto = isinstance(j, dict) and isinstance(j.get("filho"), int) and ag._poses_pid_vivo(j["filho"]) and ag._poses_e_nosso(j["filho"])
    except (OSError, ValueError):
        pass
    if aberto or ag._poses_llamas_soltos():
        print("o classificador de poses do agente está aberto: desligue a classificação no Eterna (Fundos de IA (técnico)) e espere ele fechar")
        return 2
    ok, erro = ag.poses_modelo_ok()
    if not ok:
        print("modelo indisponível: %s (POSE_SHA/POSE_MMPROJ_SHA fixados? arquivos em %s? llama-server em %s?)" % (erro, ag.MODELOS, ag.POSE_BIN))
        return 2
    hoje = time.strftime("%Y-%m-%d")
    fotos = [f for f in glob.glob(os.path.join(ag.THUMBS, "*.jpg")) if time.strftime("%Y-%m-%d", time.localtime(os.path.getmtime(f))) == hoje]
    fotos = sorted(fotos, key=os.path.getmtime)[-n:]
    if not fotos:
        print("nenhuma miniatura de hoje em %s" % ag.THUMBS)
        return 2
    base_mb = placa("memory.used")
    pico = {"mb": base_mb or 0, "proc": []}
    fim = threading.Event()

    def vigia():
        while not fim.is_set():
            u = placa("memory.used")
            if u is not None and u > pico["mb"]:
                pico["mb"] = u
                pico["proc"] = processos_placa()
            time.sleep(0.5)
    threading.Thread(target=vigia, daemon=True).start()
    ponto = os.path.join(os.path.dirname(ag.POSES_DB), "medir")    # fora de ponto/poses-*: o agente não mexe nela
    os.makedirs(ponto, mode=0o700, exist_ok=True)
    os.chmod(ponto, 0o700)
    cmd = [sys.executable, "-I", ag.POSE_FILHO, "--inbox", ag.INBOX, "--thumbs", ag.THUMBS, "--modelos", ag.MODELOS, "--bin", ag.POSE_BIN,
           "--modelo-arq", ag.POSE_ARQ, "--mmproj-arq", ag.POSE_MMPROJ_ARQ, "--sha", ag.POSE_SHA, "--mmproj-sha", ag.POSE_MMPROJ_SHA,
           "--conferido", ag.poses_conferido() or "", "--ponto", ponto]
    t0 = time.time()
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1, env=ag.rec_env())
    fila = queue.Queue()
    threading.Thread(target=ag._rec_filho_leitor, args=(p, fila), daemon=True).start()   # o mesmo leitor do agente (só linhas JSON)
    llama = {"pid": None}

    def espera(mid, prazo):
        """A próxima mensagem com o id (ou a do pronto, mid None); {"llama_pid"} só é anotado. Prazo: None."""
        fim_ = time.time() + prazo
        while True:
            try:
                j = fila.get(timeout=max(0.1, fim_ - time.time()))
            except queue.Empty:
                return None
            if j is None:
                return {}
            if isinstance(j.get("llama_pid"), int):
                llama["pid"] = j["llama_pid"]
            if (mid is None and "pronto" in j) or (mid is not None and j.get("id") == mid):
                return j

    def encerra():
        """SIGTERM no classificador (fecha o llama-server), SIGKILL só se não sair; o llama-server que sobrar (só o com a
        chave em ponto/medir/poses-*), pela mesma função do agente."""
        try:
            p.stdin.close()
        except Exception:
            pass
        try:
            p.wait(timeout=15)                  # o fim do stdin já fecha o classificador
        except subprocess.TimeoutExpired:
            pass
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=ag.POSE_TERM_SEG)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait(timeout=5)
        if llama["pid"]:
            ag._poses_mata_llama(llama["pid"], ponto=ponto)
        fim.set()
    try:
        return medir(p, fotos, espera, encerra, t0, base_mb, pico, fim)
    finally:
        encerra()


def medir(p, fotos, espera, encerra, t0, base_mb, pico, fim):
    ag = AG
    pronto = espera(None, ag.POSE_CARGA_SEG)
    if pronto is None:
        print("o classificador não abriu em %d s" % ag.POSE_CARGA_SEG)
        return 3
    if not pronto.get("pronto"):
        print("o classificador não abriu: %s" % pronto.get("erro"))
        return 3
    print("classificador aberto em %.1f s (memória da placa: %s MB antes)" % (time.time() - t0, base_mb))
    ms, validas, motivos, erros = [], 0, {}, 0
    t1 = time.time()
    for i in range(0, len(fotos), ag.POSE_LOTE):
        lote = fotos[i:i + ag.POSE_LOTE]
        itens = [{"pid": os.path.basename(f)[:-4], "origem": f} for f in lote]
        p.stdin.write(json.dumps({"id": "m.%d" % i, "itens": itens, "esquema": ag.POSE_SAIDA}) + "\n")
        p.stdin.flush()
        j = espera("m.%d" % i, ag.POSE_ESPERA_SEG)
        if j is None:
            print("o lote passou de %d s: o classificador é encerrado" % ag.POSE_ESPERA_SEG)
            return 4
        if not j:
            print("o classificador parou no meio da medição")
            return 4
        for r in j.get("res") or []:
            if "erro" in r:
                erros += 1
                motivos["erro:" + str(r["erro"])[:30]] = motivos.get("erro:" + str(r["erro"])[:30], 0) + 1
                continue
            ms.append(r.get("ms") or 0)
            _, mot = ag.pose_valida(r.get("bruto"), "ia")
            motivos[mot or "valida"] = motivos.get(mot or "valida", 0) + 1
            if mot not in ("formato", "incoerente"):
                validas += 1
        print("  %d de %d" % (min(i + ag.POSE_LOTE, len(fotos)), len(fotos)))
    total = time.time() - t1
    encerra()
    feitas = len(ms)
    print("\nfotos: %d (%d com erro) em %.0f s · %.2f s por foto no total (com 4 ao mesmo tempo)" % (len(fotos), erros, total, total / max(1, len(fotos))))
    if ms:
        print("ms por foto (cada pedido): mediana %d · p90 %d" % (statistics.median(ms), p90(ms)))
    print("respostas válidas: %d de %d (%.1f%%) · %s" % (validas, feitas, 100.0 * validas / max(1, feitas), json.dumps(motivos, ensure_ascii=False)))
    print("pico de memória usada na placa: %s MB (antes: %s MB)" % (pico["mb"], base_mb))
    for x in pico["proc"]:
        print("  na placa no pico: %s" % x)
    print("meta: mediana até 2500 ms e 95%% ou mais de válidas · %s" % ("OK" if ms and statistics.median(ms) <= 2500 and validas >= 0.95 * feitas else "ABAIXO DA META"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
