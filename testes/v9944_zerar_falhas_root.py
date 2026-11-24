# v99.44.0 (testador, 24/11): a zeragem com falhas de verdade, num HOME com cara de servidor e o agente num laço de reinício (o
# papel do systemd, com INVOCATION_ID). Em todos os casos o agente tem de subir e o /status tem de responder.
#   1. pedido vencido (mais de 10 min);
#   2. pasta sem escrita (agente rodando como o usuário nobody, thumbs 0555);
#   3. passos.jsonl sem escrita (no preparo e no meio, depois de uma parada) e a retomada pelo botão;
#   4. disco cheio no meio (HOME num tmpfs pequeno, enchido depois de uma parada) e a retomada pelo botão;
#   5. disco quase cheio desde o começo (bloqueio "espaco" na prévia, POST 409).
# Precisa de root (tmpfs e troca de usuário). Sem root, avisa e sai com OK sem rodar (não entra no rodar.sh).
#   python3 -I testes/v9944_zerar_falhas_root.py agente/eterna-agente.py
import http.client, json, os, shutil, socket, sqlite3, subprocess, sys, tempfile, threading, time
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
AG = os.path.abspath(sys.argv[1])
AJ = os.path.join(AQUI, "_v9944_servidor.py")
if os.geteuid() != 0:
    print("OK v9944_zerar_falhas_root: AVISO sem root, nada rodou")
    sys.exit(0)
falhas, notas = [], []
NOBODY = 65534


def ok(c, msg):
    if not c:
        falhas.append(msg)
    return c


def livre():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


MONTADOS = []


def tmpfs(d, mb):
    os.makedirs(d, exist_ok=True)
    subprocess.run(["mount", "-t", "tmpfs", "-o", "size=%dm,mode=0755" % mb, "tmpfs", d], check=True)
    MONTADOS.append(d)


class Servidor:
    """Um HOME semeado + o agente num laço de reinício."""

    def __init__(self, nome, home_mb=None, usuario=None):
        self.base = tempfile.mkdtemp(prefix="v9944-falha-%s-" % nome, dir="/tmp")
        os.chmod(self.base, 0o755)
        self.home = os.path.join(self.base, "home")
        self.midia = os.path.join(self.base, "hd")
        tmpfs(self.midia, 64)                                  # o HD das fotos: outro disco
        if home_mb:
            tmpfs(self.home, home_mb)                          # o NVMe pequeno (disco cheio)
        os.makedirs(self.home, exist_ok=True)
        self.uid = usuario
        self.porta, self.ftp = livre(), livre()
        self.log = os.path.join(self.base, "agente.log")
        self.env = dict(os.environ, HOME=self.home, USERPROFILE=self.home, USER="v9944-sem-cartao", ETERNA_PORTA=str(self.porta), ETERNA_FTP_PORTA=str(self.ftp),
                        ETERNA_FTP_PASV="%d-%d" % (self.ftp + 1, self.ftp + 3), ETERNA_APP_ORIGIN="http://127.0.0.1:9", ETERNA_SEM_OPENCV="1", ETERNA_SEM_RECORTE="1",
                        INVOCATION_ID="v9944-systemd-falso")
        for k in ("ETERNA_MODO_TESTE", "ETERNA_ZERAR_FALHA_PASSO", "ETERNA_ZERAR_FOLGA_GB", "ETERNA_PASTA"):
            self.env.pop(k, None)
        pre = os.path.join(self.base, "presets.json")
        mods = json.loads(subprocess.run([sys.executable, "-I", "-c", "import importlib.util,sys,json;sp=importlib.util.spec_from_file_location('ag',sys.argv[1]);m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m);print(json.dumps(list(m.AUTH_MODULOS)))", AG],
                                         env=dict(self.env, HOME=os.path.join(self.base, "modulos"), USERPROFILE=os.path.join(self.base, "modulos")), capture_output=True, text=True, timeout=120).stdout.strip().splitlines()[-1])
        tudo = {k: {"c": True, "r": True, "u": True, "d": True} for k in mods}
        json.dump({"admin": {"perms": tudo, "menu": "*"}, "supervisor": {"perms": {"configuracao": {"r": True, "u": True}}, "menu": ["repo"]},
                   "fotografo": {"perms": {"set": {"r": True, "u": True}}, "menu": ["importar"]}}, open(pre, "w"))
        r = subprocess.run([sys.executable, "-I", AJ, AG, "semeia", os.path.join(self.midia, "midia"), pre, "senha-%d" % os.getpid()], env=self.env, capture_output=True, text=True, timeout=120)
        ok(r.returncode == 0, "%s: semeadura: %s" % (nome, r.stderr[-300:]))
        sys.path.insert(0, AQUI)
        import _agente_sessao as S
        self.adm = S.cookie_sub(AG, self.home, "sessao", "admin-falha")
        if usuario:
            for d in (self.home, os.path.join(self.midia, "midia")):
                subprocess.run(["chown", "-R", "%d:%d" % (usuario, usuario), d], check=True)
            os.chown(self.midia, usuario, usuario)
        self.parar = False
        self.partidas = 0
        self.proc = None
        self.extra = {}
        self.t = None

    def P(self, *p):
        return os.path.join(self.home, "Eterna", *p)

    def _laco(self):
        while not self.parar:
            self.partidas += 1
            with open(self.log, "a") as lg:
                lg.write("\n== partida %d %s\n" % (self.partidas, json.dumps(self.extra)))
                lg.flush()
                pre = (lambda: (os.setgid(self.uid), os.setuid(self.uid))) if self.uid else None
                self.proc = subprocess.Popen([sys.executable, "-I", "-u", AG], env=dict(self.env, **self.extra), stdout=lg, stderr=subprocess.STDOUT, preexec_fn=pre)
                self.proc.wait()
            time.sleep(1)

    def sobe(self):
        self.parar = False
        self.t = threading.Thread(target=self._laco, daemon=True)
        self.t.start()

    def para(self):
        self.parar = True
        p = self.proc
        if p and p.poll() is None:
            p.terminate()
            try:
                p.wait(10)
            except subprocess.TimeoutExpired:
                p.kill()
        if self.t:
            self.t.join(15)

    def pede(self, metodo, rota, corpo=None):
        try:
            c = http.client.HTTPConnection("127.0.0.1", self.porta, timeout=20)
            h = {"Host": "127.0.0.1:%d" % self.porta, "Cookie": self.adm}
            if metodo == "POST":
                h.update({"Content-Type": "application/json", "X-Eterna": "1"})
            c.request(metodo, rota, json.dumps(corpo or {}).encode() if metodo == "POST" else None, h)
            r = c.getresponse()
            b = r.read()
            c.close()
            try:
                return r.status, json.loads(b or b"{}")
            except ValueError:
                return r.status, None
        except OSError:
            return 0, None

    def status(self, seg=60):
        t0 = time.time()
        while time.time() - t0 < seg:
            st, j = self.pede("GET", "/status")
            if st == 200:
                return j
            time.sleep(0.3)
        return None

    def log_txt(self):
        try:
            return open(self.log, encoding="utf8", errors="replace").read()
        except OSError:
            return ""

    def ler(self, *p):
        try:
            return json.load(open(self.P(*p)))
        except Exception:
            return None

    def n_inbox(self):
        d = self.P("inbox")
        return sum(len([x for x in os.listdir(os.path.join(d, y)) if "_" in x]) for y in os.listdir(d) if not y.startswith(".") and os.path.isdir(os.path.join(d, y)))

    def fim(self):
        self.para()
        for d in (self.home, self.midia):
            if d in MONTADOS:
                subprocess.run(["umount", d])
                MONTADOS.remove(d)
        shutil.rmtree(self.base, ignore_errors=True)


def pedido(sv, zid, t):
    j = {"id": zid, "por": "admin-falha", "por_nome": "Admin", "em": "x", "t": t, "ip": "127.0.0.1"}
    a = sv.P("ponto", "zerar-pedido.json")
    open(a, "w").write(json.dumps(j))
    os.chmod(a, 0o600)
    if sv.uid:
        os.chown(a, sv.uid, sv.uid)


def n_sql(arq, sql):
    c = sqlite3.connect(arq)
    try:
        return c.execute(sql).fetchone()[0]
    finally:
        c.close()


try:
    # ---------------- 1. pedido vencido ----------------
    sv = Servidor("vencido")
    try:
        pedido(sv, "fase-teste-20261124-2250", time.time() - 700)
        sv.sobe()
        ok(sv.status(), "1: o agente não subiu com pedido vencido: " + sv.log_txt()[-300:])
        ok(os.path.exists(sv.P("ponto", "zerar-expirado.json")) and not os.path.exists(sv.P("arquivo")) and sv.n_inbox() == 10, "1: vencido não executa e não mexe em nada")
        st, j = sv.pede("GET", "/zerar/previa")
        ok(st == 200 and j.get("pode") is True and not j.get("falha"), "1: depois do vencido a prévia deixa zerar: %s %s" % (st, j and j.get("bloqueios")))
        ok(sv.partidas == 1, "1: uma partida só: %d" % sv.partidas)
    finally:
        sv.fim()

    # ---------------- 2. pasta sem escrita (agente como nobody) ----------------
    sv = Servidor("semescrita", usuario=NOBODY)
    try:
        os.chmod(sv.P("thumbs"), 0o555)
        sv.sobe()
        ok(sv.status(), "2: o agente (nobody) não subiu: " + sv.log_txt()[-300:])
        st, j = sv.pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"})
        ok(st == 202, "2: POST: %s %s" % (st, j))
        time.sleep(4)
        ok(sv.status(60), "2: o agente não voltou depois do preparo recusado: " + sv.log_txt()[-400:])
        fz = sv.ler("ponto", "zerar-falhou.json") or {}
        ok(fz.get("passo") == "preparo" and "sem_escrita" in (fz.get("motivo") or ""), "2: zerar-falhou.json com sem_escrita: %s" % fz)
        ok(sv.n_inbox() == 10 and n_sql(sv.P("ponto", "vendas.db"), "select count(*) from evento") == 3, "2: nada mudou")
        st, j = sv.pede("GET", "/zerar/previa")
        ok((j.get("falha") or {}).get("motivo") == "sem_escrita", "2: a prévia leva o motivo: %s" % (j and j.get("falha")))
        notas.append("2: prévia depois da recusa: bloqueios=%s falha=%s" % (j.get("bloqueios"), j.get("falha")))
        ok(sv.partidas == 2, "2: duas partidas (pedido + recusa): %d" % sv.partidas)
    finally:
        sv.fim()

    # ---------------- 3a. passos.jsonl sem escrita já no preparo ----------------
    sv = Servidor("passos", usuario=NOBODY)
    try:
        Z = "fase-teste-20261124-2251"
        os.makedirs(sv.P("arquivo", Z), exist_ok=True)
        for d in (sv.P("arquivo"), sv.P("arquivo", Z)):
            os.chown(d, NOBODY, NOBODY)
            os.chmod(d, 0o700)
        open(sv.P("arquivo", Z, "passos.jsonl"), "w").write("")
        os.chmod(sv.P("arquivo", Z, "passos.jsonl"), 0o644)            # dono root: o nobody não escreve
        pedido(sv, Z, time.time())
        sv.sobe()
        ok(sv.status(60), "3a: o agente não subiu com passos.jsonl sem escrita: " + sv.log_txt()[-400:])
        fz = sv.ler("ponto", "zerar-falhou.json") or {}
        ok(fz.get("passo") == "preparo" and not os.path.exists(sv.P("ponto", "zerar-andamento.json")), "3a: zerar-falhou.json no preparo: %s" % fz)
        ok(sv.n_inbox() == 10 and n_sql(sv.P("ponto", "vendas.db"), "select count(*) from evento") == 3, "3a: nada mudou")
        sv.para()
        # ---------------- 3b. passos.jsonl fica sem escrita no meio (depois de uma parada no mover_nvme) ----------------
        os.remove(sv.P("ponto", "zerar-falhou.json"))
        shutil.rmtree(sv.P("arquivo", Z))
        pedido(sv, Z, time.time())
        sv.extra = {"ETERNA_MODO_TESTE": "1", "ETERNA_ZERAR_FALHA_PASSO": "mover_nvme"}
        sv.parar = False
        sv.partidas = 0
        # uma partida só com a falha forçada
        with open(sv.log, "a") as lg:
            p1 = subprocess.Popen([sys.executable, "-I", "-u", AG], env=dict(sv.env, **sv.extra), stdout=lg, stderr=subprocess.STDOUT, preexec_fn=lambda: (os.setgid(NOBODY), os.setuid(NOBODY)))
            rc = p1.wait(90)
        ok(rc not in (0, None) and os.path.exists(sv.P("ponto", "zerar-andamento.json")), "3b: parou no mover_nvme: rc=%s" % rc)
        ok(n_sql(sv.P("ponto", "vendas.db"), "select count(*) from evento") == 0 and sv.n_inbox() == 10, "3b: bancos já zerados, fotos ainda no lugar")
        os.chown(sv.P("arquivo", Z, "passos.jsonl"), 0, 0)
        os.chmod(sv.P("arquivo", Z, "passos.jsonl"), 0o644)
        sv.extra = {}
        sv.sobe()
        st = sv.status(120)
        ok(st, "3b: o agente não subiu com passos.jsonl sem escrita no meio: " + sv.log_txt()[-500:])
        time.sleep(1)
        fz = sv.ler("ponto", "zerar-falhou.json") or {}
        notas.append("3b: partidas até subir=%d falhou=%s inbox=%d zerada=%s" % (sv.partidas, fz, sv.n_inbox(), st and st.get("zerada")))
        ok(not os.path.exists(sv.P("ponto", "zerar-andamento.json")), "3b: andamento não pode ficar no lugar com o agente no ar")
        ok(sv.partidas <= 4, "3b: sem laço de reinício: %d partidas" % sv.partidas)
        # conserta a permissão e o Admin aperta de novo: retoma o mesmo id e termina
        os.chown(sv.P("arquivo", Z, "passos.jsonl"), NOBODY, NOBODY)
        stp, j = sv.pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"})
        ok(stp == 202 and (j or {}).get("id") == Z, "3b: apertar de novo retoma o mesmo id: %s %s" % (stp, j))
        t0 = time.time()
        while time.time() - t0 < 90:
            s2 = sv.status(5)
            if s2 and s2.get("zerada") == Z:
                break
            time.sleep(1)
        ok(s2 and s2.get("zerada") == Z and sv.n_inbox() == 0, "3b: a retomada termina: %s inbox=%d falhou=%s passos=%s" % (s2 and s2.get("zerada"), sv.n_inbox(), sv.ler("ponto", "zerar-falhou.json"),
           [(x.get("passo"), x.get("ok"), x.get("erro")) for x in map(json.loads, open(sv.P("arquivo", Z, "passos.jsonl")).read().splitlines()[-6:])]))
        # o caminho de volta quando a retomada trava: parar o serviço e desfazer pela linha de comando
        sv.para()
        r = subprocess.run([sys.executable, "-I", AG, "--desfazer-zeragem", Z, "--sobrescrever"], env=sv.env, capture_output=True, text=True, timeout=120,
                           preexec_fn=lambda: (os.setgid(NOBODY), os.setuid(NOBODY)))
        ok(r.returncode == 0 and sv.n_inbox() == 10 and n_sql(sv.P("ponto", "vendas.db"), "select count(*) from evento") == 3 and len(os.listdir(sv.P("thumbs"))) >= 10,
           "3b: desfazer depois da retomada travada devolve tudo: rc=%s inbox=%d eventos=%s · %s" % (r.returncode, sv.n_inbox(), n_sql(sv.P("ponto", "vendas.db"), "select count(*) from evento"), (r.stdout + r.stderr)[-300:]))
    finally:
        sv.fim()

    # ---------------- 4. disco cheio no meio ----------------
    sv = Servidor("cheio", home_mb=48)
    try:
        sv.env.update(ETERNA_MODO_TESTE="1", ETERNA_ZERAR_FOLGA_GB="0")   # o NVMe de teste é pequeno: sem a folga de 1 GB
        sv.sobe()
        ok(sv.status(), "4: o agente não subiu: " + sv.log_txt()[-300:])
        st, j = sv.pede("GET", "/zerar/previa")
        notas.append("4: prévia com HOME de 48 MB: bloqueios=%s" % (j and j.get("bloqueios")))
        sv.para()
        Z = "fase-teste-20261124-2252"
        pedido(sv, Z, time.time())
        env1 = dict(sv.env, ETERNA_MODO_TESTE="1", ETERNA_ZERAR_FALHA_PASSO="mover_nvme", ETERNA_ZERAR_FOLGA_GB="0")
        with open(sv.log, "a") as lg:
            rc = subprocess.Popen([sys.executable, "-I", "-u", AG], env=env1, stdout=lg, stderr=subprocess.STDOUT).wait(90)
        ok(rc not in (0, None) and os.path.exists(sv.P("ponto", "zerar-andamento.json")), "4: parou no mover_nvme: rc=%s · %s" % (rc, sv.log_txt()[-300:]))
        # enche o NVMe
        enche = sv.P("enche.bin")
        subprocess.run(["dd", "if=/dev/zero", "of=" + enche, "bs=1M", "count=200"], capture_output=True)
        livre_b = shutil.disk_usage(sv.home).free
        ok(livre_b < 64 * 1024, "4: disco não encheu: %d" % livre_b)
        sv.partidas = 0
        sv.sobe()
        st = sv.status(150)
        ok(st, "4: com o disco cheio o agente não respondeu /status: %d partidas · %s" % (sv.partidas, sv.log_txt()[-600:]))
        notas.append("4: disco cheio: partidas até subir=%d andamento=%s falhou=%s" % (sv.partidas, os.path.exists(sv.P("ponto", "zerar-andamento.json")), sv.ler("ponto", "zerar-falhou.json")))
        ok(not os.path.exists(sv.P("ponto", "zerar-andamento.json")), "4: andamento ficou no lugar com o agente no ar")
        time.sleep(5)
        ok(sv.status(5), "4: o agente caiu depois de subir com o disco cheio: " + sv.log_txt()[-400:])
        ok(sv.partidas <= 4, "4: laço de reinício com o disco cheio: %d" % sv.partidas)
        # libera o disco e o Admin aperta de novo
        os.remove(enche)
        stp, j = sv.pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"})
        notas.append("4: POST depois de liberar: %s %s" % (stp, j and (j.get("id"), j.get("bloqueios"))))
        if stp == 202:
            ok(j.get("id") == Z, "4: retoma o mesmo id: %s" % j.get("id"))
            t0 = time.time()
            s2 = None
            while time.time() - t0 < 90:
                s2 = sv.status(5)
                if s2 and s2.get("zerada") == Z:
                    break
                time.sleep(1)
            ok(s2 and s2.get("zerada") == Z and sv.n_inbox() == 0, "4: a retomada termina: %s · %s" % (s2 and s2.get("zerada"), sv.log_txt()[-400:]))
    finally:
        sv.fim()

    # ---------------- 5. pouco espaço desde o começo ----------------
    sv = Servidor("espaco", home_mb=48)
    try:
        sv.sobe()
        ok(sv.status(), "5: o agente não subiu")
        st, j = sv.pede("GET", "/zerar/previa")
        ok(st == 200 and "espaco" in (j.get("bloqueios") or []), "5: prévia mostra espaco: %s" % (j and j.get("bloqueios")))
        st, j = sv.pede("POST", "/zerar/fase-teste", {"confirma": "ZERAR"})
        ok(st == 409 and "espaco" in (j.get("bloqueios") or []) and not os.path.exists(sv.P("ponto", "zerar-pedido.json")), "5: POST 409 espaco: %s %s" % (st, j))
    finally:
        sv.fim()
except Exception:
    import traceback
    falhas.append("exceção: " + traceback.format_exc()[-1500:])
finally:
    for d in list(MONTADOS):
        subprocess.run(["umount", "-l", d])

print(("OK" if not falhas else "FALHA") + " v9944_zerar_falhas_root: vencido, pasta sem escrita, passos.jsonl sem escrita, disco cheio no meio, pouco espaço"
      + " (" + " | ".join(notas) + ")" + ("" if not falhas else " · " + " | ".join(falhas)))
sys.exit(1 if falhas else 0)
