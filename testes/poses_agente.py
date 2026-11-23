# 23/11 (plano docs/planos/2026-11-23-poses-estatistica.md, fatia P1): classificador de poses no servidor. Critérios 1 a
# 11: desligada não abre nada nem cria o poses.db; Sombra classifica as sessões fechadas dos últimos 7 dias com a versão
# atual; resposta inválida vira dúvida com o motivo certo e nada inválido chega a dados; janela; recorte e montagem com
# prioridade 0 ou 1 param a classificação em até um lote e fecham o filho; memória da placa e nvidia-smi; POST
# /poses/config (403, 409 criterio, 400, 429) e config/poses recusada pelo /ponto/docs; ETERNA_POSES=0; LGPD; /status.poses
# sem pid, caminho nem chave; linha do llama-server (127.0.0.1, --api-key-file, sem -hf). Também: terceira morte seguida
# = parado. Revisão de 23/11: o SHA dos 6 GB só é conferido com Sombra ou Ligada, na janela e sem recorte ou montagem
# esperando, e fica guardado (0600) sem releitura; nenhum llama-server órfão (pid avisado logo depois de abrir, prazo de
# abertura estourado, órfão achado na partida); lote inteiro com erro do servidor conta como morte (nunca fim_fila);
# versão diferente = parado até a noite seguinte; erro de imagem do PIL = imagem; lista vazia refeita só a cada
# POSE_FILA_SEG e pausa depois do fim da fila não troca o fim_fila.
# O agente/eterna-poses.py é o de verdade; só o llama-server é trocado pelo testes/_poses_filho_falso.py.
# Miniaturas desenhadas na hora; nenhuma foto de visitante.
#   HOME=$(mktemp -d) python3 -I testes/poses_agente.py agente/eterna-agente.py
import hashlib, http.client, importlib.util, inspect, json, os, socket, sqlite3, subprocess, sys, threading, time
from http.server import ThreadingHTTPServer
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao as S

os.environ["ETERNA_SEM_OPENCV"] = "1"
for k in ("ETERNA_TESTE_CARGA", "ETERNA_FUNCAO_DIA", "ETERNA_POSES"):
    os.environ.pop(k, None)
HOME = os.environ["HOME"]
os.makedirs(os.path.join(HOME, "Eterna", "ponto", "sessoes"), exist_ok=True)
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.APP_ORIGIN = "http://127.0.0.1:9"
CARGA0 = m.POSE_CARGA_SEG
m.POSE_DORME = 0.2
m.POSE_FILA_SEG = 1
m.POSE_ERRO_SEG = 0
m.POSE_OCUPADO_SEG = 2
m.REC_PISO_GB = 0.0
falhas, num = [], {}


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


# modelo de mentira com SHA fixado pelo teste, llama-server falso e nvidia-smi falso
os.makedirs(m.MODELOS, exist_ok=True)
for arq, txt in ((m.POSE_ARQ, b"gguf de teste"), (m.POSE_MMPROJ_ARQ, b"mmproj de teste")):
    open(os.path.join(m.MODELOS, arq), "wb").write(txt)
m.POSE_SHA = hashlib.sha256(b"gguf de teste").hexdigest()
m.POSE_MMPROJ_SHA = hashlib.sha256(b"mmproj de teste").hexdigest()
FERR = os.path.join(HOME, "ferramentas")
os.makedirs(FERR)
FDIR = os.path.join(HOME, "falso")
os.makedirs(FDIR)


def controle(**kw):
    """O que o llama-server falso faz (lido a cada pedido): dormir, morre, erro500, sem_health, nao_abre."""
    json.dump(kw, open(os.path.join(FDIR, "controle.json.tmp"), "w"))
    os.replace(os.path.join(FDIR, "controle.json.tmp"), os.path.join(FDIR, "controle.json"))


controle()
m.POSE_BIN = os.path.join(FERR, "llama-server")
open(m.POSE_BIN, "w").write("#!/bin/sh\nexec '%s' -I '%s' --falso-dir '%s' \"$@\"\n" % (sys.executable, os.path.join(AQUI, "_poses_filho_falso.py"), FDIR))
os.chmod(m.POSE_BIN, 0o755)
VRAM = os.path.join(FERR, "vram.txt")
open(VRAM, "w").write("20000\n")
NVSMI = os.path.join(FERR, "nvidia-smi")
open(NVSMI, "w").write("#!/bin/sh\ncat '%s'\n" % VRAM)
os.chmod(NVSMI, 0o755)
m.POSE_NVSMI = NVSMI

from PIL import Image, ImageDraw
os.makedirs(m.THUMBS, exist_ok=True)
_n = [0]
ORIENT = {}


def foto(tam=(300, 200)):
    _n[0] += 1
    pid = "%012x" % (0xb0e000000000 + _n[0])
    im = Image.new("RGB", tam, ((_n[0] * 37) % 255, (_n[0] * 91) % 255, (_n[0] * 53) % 255))
    ImageDraw.Draw(im).rectangle([tam[0] // 3, tam[1] // 4, tam[0] // 2, tam[1] - 5], fill=(230, 200, 180))
    f = os.path.join(m.THUMBS, pid + ".jpg")
    im.save(f, "JPEG", quality=85)
    ORIENT[pid] = "h" if tam[0] / tam[1] > 1.05 else "v" if tam[0] / tam[1] < 0.95 else "q"
    with m.lock:
        m.lib[pid] = {"file": f, "thumb": f}
        m.meta[pid] = {"o": "carlos", "s": "ftp", "u": time.time() + _n[0], "cap": time.time() + _n[0]}
    return pid


SESS = {}


def sessao(dia, n, status="fechada", card=None):
    tams = [(300, 200), (200, 300), (250, 250)]
    ps = [foto(tams[i % 3]) for i in range(n)]
    card = card or "LP%04d" % (len(SESS) + 1)
    SESS.setdefault(dia, []).append({"card": card, "status": status, "fotos": ps, "fotografo": "carlos"})
    json.dump({"sessoes": SESS[dia]}, open(os.path.join(m.SESS_DIR, dia + ".json"), "w"))
    with m.treino_lock:
        m._treino_cache.clear()
    return ps


def linhas():
    if not os.path.exists(m.POSES_DB):
        return {}
    db = sqlite3.connect(m.POSES_DB)
    try:
        return {r[0]: r for r in db.execute("select pid, dia, card, fotografo, w, h, orient, set_ia, set_cena, dados, duvida, motivo, versao, ms from pose")}
    finally:
        db.close()


def hm(t):
    return time.strftime("%H:%M", time.localtime(t))


def janela(dentro=True):
    agora = time.time()
    return {"ini": hm(agora - 3600), "fim": hm(agora + 3600)} if dentro else {"ini": hm(agora + 3600), "fim": hm(agora + 7200)}


def vivo():
    p = m.poses_filho.get("p")
    return p is not None and p.poll() is None


def proc_vivo(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:                                     # zumbi ainda não colhido conta como morto
        return open("/proc/%d/stat" % pid).read().split()[2] != "Z"
    except OSError:
        return True


def llamas():
    out = []
    for a in sorted(os.listdir(FDIR)):
        if a.startswith("llama-"):
            out.append(json.load(open(os.path.join(FDIR, a))))
    return out


HOJE = m._ff_hoje()
try:
    # ---------- 1: desligada (padrão): nenhum processo, nenhum poses.db ----------
    ok(m.poses_cfg()["modo"] == "desligada" and m.poses_cfg()["janela"] == {"ini": "20:00", "fim": "07:00"}, "1: padrão desligada 20:00 às 07:00")
    DIAS = {i: m._ff_hoje(time.time() - i * 86400) for i in range(9)}
    P_OK = []
    for i in range(7):
        P_OK += sessao(DIAS[i], 4) + sessao(DIAS[i], 4)
    P_ANTIGA = sessao(DIAS[7], 4)                      # 8º dia para trás: fora
    P_ABERTA = sessao(HOJE, 3, status="aberta")       # sessão aberta: fora
    threading.Thread(target=m.poses_loop, daemon=True).start()
    time.sleep(1.5)
    st1 = m.poses_status()
    ok(m.poses_filho["p"] is None and not os.path.exists(m.POSES_DB) and not os.path.exists(m.POSE_PIDS) and not llamas(),
       "1: desligada: nenhum filho, nenhum poses.db")
    ok(st1["modo"] == "desligada" and st1["pendentes"] == 0 and not os.path.exists(m.POSES_DB), "1: /status.poses não cria o banco: %r" % st1)
    ok(not os.path.exists(m.POSE_SHA_ARQ) and st1["modelo"]["erro"] == "conferindo" and m.poses_pode_rodar() == (False, "desligada"),
       "1: desligada: o SHA do modelo não é conferido (o /status diz conferindo): %r" % st1["modelo"])

    # ---------- revisão: Sombra fora da janela ou com o recorte esperando também não confere o SHA ----------
    st, r = m.poses_cfg_gravar({"modo": "sombra", "janela": janela(False)}, "adm")
    ok(st == 200 and espera(lambda: m.poses_status()["noite"]["parou_por"] == "fora_janela", 5), "1b: sombra fora da janela: %r" % m.poses_status()["noite"])
    time.sleep(0.5)
    ok(not os.path.exists(m.POSE_SHA_ARQ) and m.poses_status()["modelo"]["erro"] == "conferindo", "1b: fora da janela: SHA não conferido")
    m.POSE_PRIO_EM["rec"] = time.time()
    m.poses_cfg_gravar({"janela": janela(True)}, "adm")
    ok(espera(lambda: m.poses_status()["noite"]["parou_por"] == "recorte_ocupado", 5) and not os.path.exists(m.POSE_SHA_ARQ),
       "1b: recorte esperando: o SHA não é conferido antes dele: %r" % m.poses_status()["noite"])

    # ---------- 6: memória da placa e nvidia-smi: o filho não abre, parou_por diz o motivo ----------
    open(VRAM, "w").write("4000\n")
    st, r = m.poses_cfg_gravar({"modo": "sombra", "janela": janela(True)}, "adm")
    ok(st == 200 and r["modo"] == "sombra", "6: sombra gravada: %s %r" % (st, r))
    ok(espera(lambda: m.poses_status()["noite"]["parou_por"] == "vram", 5) and m.poses_filho["p"] is None and not llamas(),
       "6: pouca memória: vram, sem filho: %r" % m.poses_status()["noite"])
    m.POSE_NVSMI = os.path.join(FERR, "nao-existe")
    m.poses_st["noite"]["parou_por"] = None
    ok(espera(lambda: m.poses_status()["noite"]["parou_por"] == "vram", 5) and m.poses_filho["p"] is None, "6: sem nvidia-smi: vram")
    ok(m.poses_vram_livre_mb() is None, "6: sem nvidia-smi a memória é None")
    open(VRAM, "w").write("20000\n")
    m.POSE_NVSMI = NVSMI
    ok(m.poses_vram_livre_mb() == 20000, "6: nvidia-smi falso lido")
    ok(os.path.exists(m.POSE_SHA_ARQ) and oct(os.stat(m.POSE_SHA_ARQ).st_mode & 0o777) == "0o600" and m.poses_status()["modelo"]["ok"] is True,
       "6: SHA conferido na janela e guardado em arquivo 0600")

    # ---------- 2: Sombra, dentro da janela: as sessões fechadas dos últimos 7 dias ganham linha com a versão atual ----------
    t2 = time.time()
    ok(espera(lambda: len(linhas()) >= len(P_OK), 40), "2: classificadas: %d de %d" % (len(linhas()), len(P_OK)))
    num["s_56"] = round(time.time() - t2, 1)
    L = linhas()
    ver = m.pose_versao()
    ok(set(L) == set(P_OK) and all(L[p][12] == ver for p in P_OK), "2: todas com a versão %s e nada além delas" % ver)
    ok(not set(P_ANTIGA) & set(L) and not set(P_ABERTA) & set(L), "2: o 8º dia e a sessão aberta ficam fora")
    ok(all(L[p][6] == ORIENT[p] for p in P_OK), "2: orientação pela miniatura")
    ok(all(L[p][3] == "carlos" and L[p][2].startswith("LP") for p in P_OK), "2: card e fotógrafo")
    ok(espera(lambda: not vivo() and m.poses_status()["noite"]["parou_por"] == "fim_fila", 5), "2: fim da fila fecha o filho: %r" % m.poses_status()["noite"])
    st2 = m.poses_status()
    ok(st2["noite"]["feitas"] == len(P_OK) and st2["pendentes"] == 0 and st2["noite"]["ini"] and st2["noite"]["fim"], "2: /status.poses.noite: %r" % st2["noite"])
    lls = llamas()
    ok(lls and all(not os.path.exists(x["chave_arq"]) and x["modo"] == "0o600" and not proc_vivo(x["pid"]) for x in lls),
       "2: chave 0600 apagada e llama-server fechado: %r" % lls)
    ok(not os.path.exists(m.POSE_PIDS), "2: poses-filho.json some com o filho fechado")
    # revisão: pausa depois do fim da fila não troca o fim_fila; a lista vazia só é refeita a cada POSE_FILA_SEG
    conta_p, pend0 = [0], m.poses_pendentes

    def _pend():
        conta_p[0] += 1
        return pend0()
    m.POSE_FILA_SEG = 60
    m.poses_pendentes = _pend
    m.POSE_PRIO_EM["rec"] = time.time()
    time.sleep(3.0)
    ok(m.poses_status()["noite"]["parou_por"] == "fim_fila", "2: pausa do recorte depois do fim da fila não troca o fim_fila: %r" % m.poses_status()["noite"])
    ok(conta_p[0] == 0, "2: lista vazia não é refeita antes de POSE_FILA_SEG: %d vezes" % conta_p[0])
    m.poses_pendentes = pend0
    m.POSE_FILA_SEG = 1

    # ---------- 3: inválidas viram dúvida com o motivo certo; nada inválido em dados ----------
    ok(all(r[9] is None and r[10] == 1 for r in L.values() if r[11] in ("formato", "incoerente")), "3: formato e incoerente: dúvida sem dados")
    validos = [json.loads(r[9]) for r in L.values() if r[9]]
    ok(validos and all(m.pose_valida({k: v for k, v in d.items() if k != "orient"}, "mao") == ({k: v for k, v in d.items() if k != "orient"}, None)
                       and d["orient"] in m.POSE_TAXO["orient"] for d in validos), "3: tudo em dados passa na validação")
    pv = m.pose_valida
    base = {"s": "gramado", "q": "dupla", "a": "bandeira", "p": "bandeira_frente", "e": "inteiro", "vb": ["punho", "braco"]}
    ok(pv(base) == ({"set": "gramado", "quem": "dupla", "adereco": "bandeira", "pose": "bandeira_frente", "enq": "inteiro", "vib": ["braco", "punho"]}, None), "3: válida")
    for d_, mt in ((dict(base, p="voando"), "formato"), (dict(base, vb=["dança"]), "formato"), (dict(base, x=1), "formato"),
                   ({k: v for k, v in base.items() if k != "e"}, "formato"), ('{"s": "gram', "formato"), (None, "formato"), (dict(base, s="chroma"), "formato"),
                   (dict(base, a="nenhum"), "incoerente"), (dict(base, p="trofeu_segura"), "incoerente"), (dict(base, p="arq_sentado", a="nenhum"), "incoerente"),
                   (dict(base, p="chute_comemora", a="nenhum"), "incoerente")):
        ok(pv(d_) == (None, mt), "3: %r -> %s: %r" % (d_, mt, pv(d_)))
    ok(pv(dict(base, s="chute", p="chute_comemora", a="nenhum"))[1] is None, "3: chute_comemora no chute vale")
    ok(pv(dict(base, q="ninguem"))[1] == "sem_pessoa" and pv(dict(base, q="ninguem"))[0], "3: ninguém: sem_pessoa com dados")
    ok(pv({"quem": "dupla", "pose": None}, "mao") == ({"set": None, "quem": "dupla", "adereco": None, "pose": None, "enq": None, "vib": None}, None)
       and pv({"quem": "x"}, "mao")[1] == "formato", "3: marcação humana (P2) com null")
    # set do reconhecimento do ponto Ligado (D3): divergência vira dúvida; sem divergência, vale o da cena
    pa, pb, pc = P_OK[0], P_OK[1], P_OK[2]
    tc = m._treino_cfg["v"]
    m._treino_cfg["v"] = dict(m.treino_cfg_mem(), ponto="ligada")
    m.cena_mem[pa] = {"r": "trofeu", "c": 0.9, "g": False}
    m.cena_mem[pb] = {"r": "gramado", "c": 0.9, "g": True}
    m.cena_mem[pc] = {"r": "trofeu", "c": 0.5, "g": False}
    info = {p: {"dia": HOJE, "card": "LPX", "fotografo": "carlos"} for p in (pa, pb, pc)}
    m.poses_gravar([{"pid": pa, "bruto": base, "ms": 900}, {"pid": pb, "bruto": base, "ms": 900}, {"pid": pc, "bruto": base, "ms": 900}], info)
    L3 = linhas()
    ok(L3[pa][10] == 1 and L3[pa][11] == "set_diverge" and L3[pa][7] == "gramado" and L3[pa][8] == "trofeu", "3: set diverge: dúvida: %r" % (L3[pa][7:12],))
    ok(L3[pb][10] == 0 and L3[pb][11] is None and json.loads(L3[pb][9])["set"] == "gramado" and L3[pb][8] == "gramado", "3: set igual: vale")
    ok(L3[pc][8] is None and L3[pc][10] == 0, "3: confiança abaixo de 0,70 não conta")
    m._treino_cfg["v"] = tc
    for p in (pa, pb, pc):
        m.cena_mem.pop(p, None)
    m.poses_gravar([{"pid": pa, "erro": "caminho_recusado"}, {"pid": pb, "bruto": "{quebrado", "ms": 5}], info)
    L3 = linhas()
    ok(L3[pa][11] == "nao_classificavel" and L3[pa][9] is None and L3[pb][11] == "formato" and L3[pb][9] is None, "3: caminho recusado e JSON quebrado")

    # ---------- 4: fora da janela nada é classificado; ao sair, o filho fecha em até um lote ----------
    controle(dormir=0.25)
    P4 = sessao(HOJE, 120)
    n0 = len(linhas())
    ok(espera(lambda: len(linhas()) >= n0 + 8, 15), "4: voltou a classificar as novas")
    n1 = len(linhas())
    m.poses_cfg_gravar({"janela": janela(False)}, "adm")
    ok(espera(lambda: not vivo() and m.poses_status()["noite"]["parou_por"] == "fora_janela", 6), "4: fora da janela: filho fechado")
    n2 = len(linhas())
    ok(n2 - n1 <= m.POSE_LOTE, "4: no máximo um lote depois de sair da janela: %d" % (n2 - n1))
    time.sleep(1.0)
    st4 = m.poses_status()
    ok(len(linhas()) == n2 and st4["na_janela"] is False and st4["noite"]["parou_por"] == "fora_janela", "4: fora da janela nada: %r" % st4["noite"])
    ok(m.poses_pode_rodar() == (False, "fora_janela"), "4: pode_rodar")

    # ---------- 5: recorte ou montagem com prioridade 0 ou 1 param em até um lote, fecham o filho e voltam depois ----------
    m.REC_FALSO_SEG = 0.5
    m.poses_cfg_gravar({"janela": janela(True)}, "adm")
    ok(espera(lambda: vivo() and len(linhas()) >= n2 + 8, 15), "5: classificando de novo")
    n3 = len(linhas())
    job, err = m.rec_enfileirar(P4[0], m.lib[P4[0]]["file"], prio=m.REC_PRIO_CHECKOUT)
    ok(err is None, "5: recorte na fila: %r" % err)
    ok(espera(lambda: not vivo() and m.poses_status()["noite"]["parou_por"] == "recorte_ocupado", 6), "5: recorte de prioridade 0: filho fechado")
    n4 = len(linhas())
    ok(n4 - n3 <= m.POSE_LOTE + 8, "5: no máximo o lote em andamento: %d" % (n4 - n3))
    ok(m.poses_status()["noite"]["parou_por"] == "recorte_ocupado", "5: parou_por recorte_ocupado: %r" % m.poses_status()["noite"])
    ok(job["ev"].wait(10), "5: recorte terminou")
    t5 = time.time()
    ok(espera(lambda: len(linhas()) > n4, 12), "5: voltou depois do recorte")
    num["volta_s"] = round(time.time() - t5, 1)
    ok(time.time() - t5 >= m.POSE_OCUPADO_SEG - 0.3, "5: só depois de POSE_OCUPADO_SEG: %.1f s" % (time.time() - t5))
    # montagem: um trabalho de prioridade 1 (prévia da base preferida) na fila
    ok(espera(vivo, 6), "5: filho aberto de novo")
    with m.mtg_lock:
        m.mtg_jobs[("aaaaaaaaaaaa", "telao")] = {"pid": "aaaaaaaaaaaa", "fundo": "telao", "prio": m.MTG_P_VIVO, "pego": True}
    ok(espera(lambda: not vivo() and m.poses_status()["noite"]["parou_por"] == "montagem_ocupada", 6), "5: montagem de prioridade 1: filho fechado: %r" % m.poses_status()["noite"])
    with m.mtg_lock:
        m.mtg_jobs.pop(("aaaaaaaaaaaa", "telao"), None)
    with m.mtg_lock:
        m.mtg_jobs[("bbbbbbbbbbbb", "telao")] = {"pid": "bbbbbbbbbbbb", "fundo": "telao", "prio": m.MTG_P_IMPRESSAO, "pego": False}
    m.POSE_PRIO_EM["mtg"] = time.time() - 10
    ok(m.poses_pode_rodar(aberto=True)[1] != "montagem_ocupada", "5: montagem de prioridade 3 (impressão) não para as poses")
    with m.mtg_lock:
        m.mtg_jobs.pop(("bbbbbbbbbbbb", "telao"), None)
    ok(espera(vivo, 8), "5: voltou depois da montagem")

    # 3 (com todas as fotos do falso): formato e incoerência de verdade, vindos do filho
    mot = {}
    for r in linhas().values():
        mot[r[11]] = mot.get(r[11], 0) + 1
    num["motivos"] = mot
    ok(mot.get("formato", 0) >= 2 and mot.get("incoerente", 0) >= 1, "3: o falso devolveu formato e incoerente: %r" % mot)
    ok(all(r[9] is None and r[10] == 1 for r in linhas().values() if r[11] in ("formato", "incoerente")), "3: formato e incoerente: dúvida sem dados")

    # ---------- 8: ETERNA_POSES=0 vence o modo gravado ----------
    os.environ["ETERNA_POSES"] = "0"
    m._poses_cfg["t"] = 0.0
    ok(espera(lambda: not vivo(), 6), "8: ETERNA_POSES=0: filho fechado")
    st8 = m.poses_status()
    ok(st8["modo"] == "desligada" and st8["forcada"] is True, "8: /status.poses: %r" % {k: st8[k] for k in ("modo", "forcada")})
    n8 = len(linhas())
    time.sleep(0.8)
    ok(len(linhas()) == n8, "8: nada classificado")
    del os.environ["ETERNA_POSES"]

    # ---------- 7 e 10: rotas ----------
    srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
    m.PORT = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    HOST = "127.0.0.1:%d" % m.PORT
    adm = S.cookie_sessao(m, "admin-poses")
    cfgr = S.cookie_sessao(m, "so-ver-config", {"configuracao": {"r": True}, "qualidade": {"r": True, "u": True}})

    def pede(metodo, rota, corpo=None, cookie=None, limpa=True):
        if limpa:
            m._janelas.clear()
        c = http.client.HTTPConnection("127.0.0.1", m.PORT, timeout=60)
        h = {"Host": HOST}
        if metodo == "POST":
            h.update({"Content-Type": "application/json", "X-Eterna": "1"})
        if cookie:
            h["Cookie"] = cookie
        c.request(metodo, rota, json.dumps(corpo if corpo is not None else {}).encode() if metodo == "POST" else None, h)
        r = c.getresponse()
        b = r.read()
        c.close()
        try:
            return r.status, json.loads(b or b"{}")
        except ValueError:
            return r.status, b

    ok(pede("POST", "/poses/config", {"modo": "desligada"})[0] == 401, "7: sem sessão 401")
    ok(pede("POST", "/poses/config", {"modo": "desligada"}, cookie=cfgr)[0] == 403, "7: sem configuracao.u 403")
    st, r = pede("POST", "/poses/config", {"modo": "ligada"}, cookie=adm)
    ok(st == 409 and r.get("error") == "criterio" and r.get("falta") == m.POSE_MEDIDA_MIN, "7: ligada sem medida: 409 criterio: %s %r" % (st, r))
    for c_ in ({"modo": "x"}, {"x": 1}, {}, {"janela": {"ini": "25:00", "fim": "07:00"}}, {"janela": {"ini": "07:00", "fim": "07:00"}},
               {"janela": {"ini": "20:00"}}, {"modo": "sombra", "por": "eu"}):
        ok(pede("POST", "/poses/config", c_, cookie=adm)[0] == 400, "7: recusa %r" % c_)
    ok(m.poses_cfg()["modo"] == "sombra", "7: o modo não mudou")
    pede("POST", "/ponto/docs", {"docs": [{"col": "config", "id": "poses", "valor": {"modo": "desligada", "janela": {"ini": "01:00", "fim": "02:00"}}}]}, cookie=adm)
    m.estado_gravar({"docs": [{"col": "config", "id": "poses", "valor": {"modo": "ligada", "janela": {"ini": "01:00", "fim": "02:00"}}}]})
    m._poses_cfg["t"] = 0.0
    ok(m.poses_cfg()["modo"] == "sombra" and m.poses_cfg()["janela"] != {"ini": "01:00", "fim": "02:00"}, "7: config/poses pelo /ponto/docs é recusada: %r" % m.poses_cfg())
    st, r = pede("POST", "/poses/config", {"modo": "sombra", "janela": janela(True)}, cookie=adm)
    ok(st == 200 and r["por"] == "admin-poses" and r["modo"] == "sombra", "7: admin grava: %s %r" % (st, r))
    m._janelas.clear()
    cods = [pede("POST", "/poses/config", {"modo": "sombra"}, cookie=adm, limpa=False)[0] for _ in range(7)]
    ok(cods[:6] == [200] * 6 and cods[6] == 429, "7: 6 por minuto por pessoa: %r" % cods)
    # 10: /status.poses sem pid, caminho nem chave
    st, s10 = pede("GET", "/status", cookie=adm)
    ps10 = s10.get("poses") or {}
    txt = json.dumps(ps10)
    chaves = [open(x["chave_arq"]).read().strip() for x in llamas() if os.path.exists(x["chave_arq"])]
    ok(st == 200 and set(ps10) >= {"v", "modo", "forcada", "versao", "modelo", "janela", "na_janela", "pendentes", "parado", "noite"}
       and set(ps10["noite"]) == {"ini", "fim", "feitas", "duvidas", "erros", "ms_med", "parou_por"} and ps10["versao"] == m.pose_versao(),
       "10: contrato do /status.poses: %r" % ps10)
    ok(not any(p in txt for p in list(linhas())[:400]) and HOME not in txt and "/" not in txt.replace("\\/", "") and "chave" not in txt
       and not any(k in txt for k in chaves) and m.POSE_SHA not in txt, "10: sem pid, caminho, SHA ou chave: %s" % txt[:300])
    num["status_poses"] = {k: ps10.get(k) for k in ("modo", "pendentes")}

    # ---------- 9: a exclusão LGPD apaga a linha de pose ----------
    alvo = P_OK[5]
    ok(alvo in linhas(), "9: a foto tem linha")
    m.lgpd_excluir([alvo], [], quem="teste")
    ok(alvo not in linhas(), "9: LGPD apagou a linha de pose")

    # ---------- limpeza de 60 dias ----------
    db = sqlite3.connect(m.POSES_DB)
    db.execute("insert into pose (pid, dia, versao) values ('cccccccccccc', ?, 'x')", (m._ff_hoje(time.time() - 61 * 86400),))
    db.commit()
    db.close()
    ok(m.poses_limpa() == 1 and "cccccccccccc" not in linhas(), "limpeza: linha com mais de 60 dias sai")

    # ---------- terceira morte seguida: parado até a próxima noite ----------
    m.poses_fechar()
    controle(morre=True)
    m.poses_st["mortes"] = 0
    sessao(HOJE, 10)
    ok(espera(lambda: m.poses_status()["parado"] is True and m.poses_status()["noite"]["parou_por"] == "parado", 25), "morte: parado na 3ª morte: %r" % m.poses_st["mortes"])
    stp = m.poses_status()
    ok(stp["modelo"]["erro"] == "parado" and stp["noite"]["parou_por"] == "parado" and not vivo(), "morte: /status.poses: %r" % stp)
    ok(all(not proc_vivo(x["pid"]) and not os.path.exists(x["chave_arq"]) for x in llamas()), "morte: nenhum llama-server nem chave sobrando")
    controle()

    # ---------- revisão: SHA guardado não é relido sem mudança (o laço está parado: só este teste confere) ----------
    g = json.load(open(m.POSE_SHA_ARQ))
    ok(set(g) == {m.POSE_ARQ, m.POSE_MMPROJ_ARQ} and all(len(x["assin"]) == 3 for x in g.values())
       and {x["sha"] for x in g.values()} == {m.POSE_SHA, m.POSE_MMPROJ_SHA}, "sha: arquivo com tamanho, data, inode e SHA: %r" % g)
    real, conta = m.hashlib, [0]

    class _H:
        def __getattr__(self, k):
            return getattr(real, k)

        def sha256(self, *a):
            conta[0] += 1
            return real.sha256(*a)
    m.hashlib = _H()
    try:
        m._poses_sha_mem["v"] = None                     # outra partida do agente
        r1, n1 = m.poses_modelo_ok(), conta[0]
        ok(r1 == (True, None) and n1 == 0, "sha: outra partida, nada mudou: nada relido (%r, %d)" % (r1, n1))
        arq = os.path.join(m.MODELOS, m.POSE_ARQ)
        st_ = os.stat(arq)
        os.utime(arq, ns=(st_.st_atime_ns, st_.st_mtime_ns + 10 ** 9))
        r2 = m.poses_modelo_ok(conferir=False)
        r3 = m.poses_modelo_ok()
        ok(r2 == (False, "conferindo") and r3 == (True, None) and conta[0] == 1, "sha: data mudou: o /status diz conferindo e o laço relê só o que mudou (%r %r %d)" % (r2, r3, conta[0]))
    finally:
        m.hashlib = real

    # ---------- revisão: lote inteiro com erro do servidor de modelo conta como morte (nunca fim_fila) ----------
    controle(erro500=True)
    with m.poses_lock:
        m.poses_st.update(parado=None, parado_por=None, mortes=0, falhou=set())
    P_500 = sessao(HOJE, 6)
    ok(espera(lambda: m.poses_status()["parado"] is True, 25), "500: parado na 3ª morte: %r" % m.poses_st["mortes"])
    st5 = m.poses_status()
    ok(st5["noite"]["parou_por"] == "parado" and m.poses_st["erro"] == "servidor" and not set(P_500) & m.poses_st["falhou"]
       and not set(P_500) & set(linhas()) and not vivo(), "500: motivo servidor, as fotos ficam na fila: %r" % st5["noite"])
    ok(all(not proc_vivo(x["pid"]) for x in llamas()), "500: nenhum llama-server sobrando")
    controle()

    # ---------- revisão: versão do filho diferente = parado até a noite seguinte (sem contar morte) ----------
    with m.poses_lock:
        m.poses_st.update(parado=None, parado_por=None, mortes=0, erro=None)
    pv0 = m.POSE_PROMPT_V
    m.POSE_PROMPT_V = "outra"
    ok(espera(lambda: m.poses_status()["parado"] is True and m.poses_status()["noite"]["parou_por"] == "versao", 10), "versao: parado")
    stv = m.poses_status()
    ok(stv["modelo"]["erro"] == "versao" and stv["noite"]["parou_por"] == "versao" and m.poses_st["mortes"] == 0 and not vivo()
       and m.poses_pode_rodar() == (False, "versao"), "versao: %r %r" % (stv["modelo"], stv["noite"]))
    m.POSE_PROMPT_V = pv0

    # ---------- revisão: abertura passa do prazo: nenhum llama-server falso sobra ----------
    with m.poses_lock:
        m.poses_st.update(parado=None, parado_por=None, mortes=0, erro=None)
    antes = {x["pid"] for x in llamas()}
    controle(sem_health=True)
    m.POSE_CARGA_SEG = 2

    def _llama_no_json():
        try:
            return isinstance(json.load(open(m.POSE_PIDS)).get("llama"), int) and not m.poses_filho.get("pronto")
        except (OSError, ValueError):
            return False
    ok(espera(_llama_no_json, 8), "carga: o pid do llama-server vai para o poses-filho.json antes do pronto")
    ok(espera(lambda: m.poses_st["mortes"] >= 1 and m.poses_st["erro"] == "filho", 20), "carga: prazo estourado conta como morte: %r" % m.poses_st["mortes"])
    m.poses_cfg_gravar({"modo": "desligada"}, "adm")
    ok(espera(lambda: not vivo() and m.poses_filho["p"] is None, 25), "carga: filho fechado")
    novos = [x for x in llamas() if x["pid"] not in antes]
    ok(novos and espera(lambda: all(not proc_vivo(x["pid"]) and not os.path.exists(x["chave_arq"]) for x in novos), 10),
       "carga: nenhum processo do servidor falso nem chave sobrando: %r" % [(x["pid"], proc_vivo(x["pid"])) for x in novos])
    ok(not os.path.exists(m.POSE_PIDS), "carga: poses-filho.json some")
    controle()
    m.POSE_CARGA_SEG = CARGA0

    # ---------- revisão: na partida, llama-server solto (filho morto com SIGKILL) é achado pelo --api-key-file em ponto/poses-* ----------
    pasta = os.path.join(os.path.dirname(m.POSES_DB), "poses-orfao1")
    os.makedirs(pasta)
    ch = os.path.join(pasta, "chave")
    open(ch, "w").write("x\n")
    so = socket.socket()
    so.bind(("127.0.0.1", 0))
    porta = so.getsockname()[1]
    so.close()
    q = subprocess.Popen([m.POSE_BIN, "--host", "127.0.0.1", "--port", str(porta), "--api-key-file", ch], start_new_session=True,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    outro = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)", "--api-key-file", os.path.join(HOME, "outra", "chave")])
    ok(espera(lambda: m._poses_e_nosso(q.pid, llama=True), 5) and not m._poses_e_nosso(outro.pid, llama=True), "órfão: só o da pasta ponto/poses-* é nosso")
    n_orf = m.poses_orfaos_encerrar()
    try:
        q.wait(10)
    except subprocess.TimeoutExpired:
        pass
    ok(n_orf >= 1 and q.poll() is not None and outro.poll() is None and not os.path.exists(pasta), "órfão: encerrado na partida e pasta apagada (%d)" % n_orf)
    outro.kill()
    outro.wait()
    srv.shutdown()

    # ---------- 11: linha do llama-server ----------
    spf = importlib.util.spec_from_file_location("ps", os.path.join(AQUI, "..", "agente", "eterna-poses.py"))
    P = importlib.util.module_from_spec(spf)
    spf.loader.exec_module(P)
    fonte = open(os.path.join(AQUI, "..", "agente", "eterna-poses.py"), encoding="utf8").read()
    src = inspect.getsource(P.linha_llama)
    lin = P.linha_llama("/bin/llama-server", "m.gguf", "mm.gguf", 1234, "/x/chave")
    ok(not any(x in src for x in ("0.0.0.0", "-hf", "--hf-repo", "hf-file")) and not any(x in fonte for x in ("0.0.0.0", '"-hf"', "--hf-repo")),
       "11: sem 0.0.0.0 nem -hf no código do filho")
    ok(lin[lin.index("--host") + 1] == "127.0.0.1" and lin[lin.index("--api-key-file") + 1] == "/x/chave" and "--no-webui" in lin
       and "-hf" not in lin and all("chave" not in x or x == "/x/chave" for x in lin), "11: --host 127.0.0.1 e --api-key-file: %r" % lin)
    ok(fonte.count("Popen(") == 1 and "Popen(linha_llama(" in fonte, "11: o llama-server só abre pela linha_llama")
    ok("ProxyHandler({})" in fonte, "11: pedido ao llama-server nunca passa por proxy")
    ok(P.POSE_CARGA_SEG < CARGA0, "11: o prazo de abertura do filho (%d s, contado do início) é menor que o do agente (%d s)" % (P.POSE_CARGA_SEG, CARGA0))
    os.environ["POSES_FALSO_X"] = "1"
    ok(not any(k.startswith("POSES_FALSO") for k in P.env_llama()) and P.env_llama().get("LLAMA_OFFLINE") == "1", "11: env_llama de produção sem variáveis de teste")
    os.environ.pop("POSES_FALSO_X", None)
    try:
        P.Llama(m.POSE_BIN, m.MODELOS, m.POSE_ARQ, m.POSE_MMPROJ_ARQ, m.POSE_SHA, m.POSE_MMPROJ_SHA, None, conferido=[[1, 2, 3], [4, 5, 6]])
        r11 = "abriu"
    except P.SemModelo:
        r11 = "sem_modelo"
    ok(r11 == "sem_modelo" and P._conferido("1:2:3,4:5:6") == [[1, 2, 3], [4, 5, 6]] and P._conferido("1:2,x") is None,
       "11: o filho confia no SHA do agente só com o mesmo tamanho, data e inode: %s" % r11)
    prep0, th = P.preparar, os.path.join(m.THUMBS, P_OK[0] + ".jpg")
    try:
        P.preparar = lambda o: (_ for _ in ()).throw(ValueError("cannot identify image"))
        r_v = P.lote(None, [{"pid": P_OK[0], "origem": th}], (m.THUMBS,), {})
        P.preparar = lambda o: (_ for _ in ()).throw(P.FotoGrande("imagem_grande"))
        r_g = P.lote(None, [{"pid": P_OK[0], "origem": th}], (m.THUMBS,), {})
    finally:
        P.preparar = prep0
    ok(r_v == [{"pid": P_OK[0], "erro": "imagem"}] and r_g == [{"pid": P_OK[0], "erro": "imagem_grande"}]
       and "imagem" in m.POSE_ERROS_FOTO, "11: ValueError do PIL vira imagem: %r %r" % (r_v, r_g))
    # o prompt define cada valor da taxonomia, e o esquema é o da taxonomia
    falta = [v for k, vs in m.POSE_TAXO.items() if k not in ("orient", "set") for v in vs if v + " =" not in P.POSE_PROMPT]
    falta += [v for v in m.POSE_TAXO["set"] if v + " =" not in P.POSE_PROMPT]
    ok(not falta, "11: o prompt define todos os valores: falta %r" % falta)
    ok(P.POSE_PROMPT_V == m.POSE_PROMPT_V and P.POSE_LOTE == m.POSE_LOTE and P.POSE_NOME == m.POSE_NOME, "11: versão do prompt, lote e nome iguais")
    ok(all(m.POSE_SAIDA["properties"][c]["enum"] == list(m.POSE_TAXO[k]) for c, k in m.POSE_CURTAS if c != "vb")
       and m.POSE_SAIDA["properties"]["vb"]["items"]["enum"] == list(m.POSE_TAXO["vib"]) and m.POSE_SAIDA["additionalProperties"] is False,
       "11: POSE_SAIDA fechado na taxonomia")
    ok("chroma" not in m.POSE_TAXO["set"] and "chute_comemora" in m.POSE_TAXO["pose"], "taxonomia: sem chroma (Eduardo, 23/11) e com chute_comemora")
    # SHA vazio: sem_modelo (o padrão do repositório)
    s_, sm_ = m.POSE_SHA, m.POSE_MMPROJ_SHA
    m.POSE_SHA = ""
    ok(m.poses_modelo_ok() == (False, "sem_modelo") and m.poses_pode_rodar()[1] in ("sem_modelo", "parado", "fora_janela", "desligada"), "sem SHA fixo: sem_modelo")
    m.POSE_SHA = "ab" * 32
    ok(m.poses_modelo_ok() == (False, "sem_modelo"), "SHA diferente: sem_modelo")
    m.POSE_SHA = s_
    ok(m.POSE_PRIO_EM["rec"] > 0, "o recorte marcou a prioridade")
except Exception:
    import traceback
    falhas.append("exceção: %s" % traceback.format_exc()[-1500:])
m.poses_parar.set()
try:
    m.poses_fechar()
except Exception:
    pass
print(("OK" if not falhas else "FALHA") + " poses_agente: classificador de poses (P1, critérios 1 a 11) · %s" % json.dumps(num, ensure_ascii=False)
      + ("" if not falhas else " · " + " | ".join(falhas[:12])))
time.sleep(0.5)
sys.stdout.flush()
os._exit(1 if falhas else 0)
