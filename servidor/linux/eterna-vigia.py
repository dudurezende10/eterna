#!/usr/bin/env python3
"""Eterna · vigia do servidor Linux do estádio (serviço eterna-vigia, roda como root, só biblioteca padrão).

Faz três coisas:
1. Deploy pelo git: a cada minuto busca a branch de /etc/eterna/vigia.env (RAMO) no GitHub. Commit novo: confere que o
   agente compila, avança só por fast-forward, religa o agente se agente/ mudou e espera o /status responder. Não respondeu
   em 90 s: volta para o commit anterior, religa e não tenta aquele commit de novo (espera o próximo). A tela (index.html)
   vale sozinha: o agente relê o app a cada 60 s.
2. Saúde: a cada 30 s pergunta ao agente se responde. Três faltas seguidas (o processo vivo mas travado): religa.
   Processo que morre o systemd religa sozinho (Restart=always).
3. Situação só leitura na porta 8797 (o ufw libera só para a rede do estádio e a VPN): versão no ar, última troca,
   último erro, agente vivo; /log mostra o fim do registro sem linhas com senha ou chave.

Esta cópia fica em /opt/eterna/vigia (o instalador copia do repositório). Ela NÃO se atualiza pelo git: um envio errado
nunca derruba quem aplica os envios. Para trocar o vigia, rodar o instalador de novo.
Git roda como o usuário eterna-deploy (dono do código); o agente roda como eterna e só lê o código.
"""
import http.server, json, os, re, subprocess, sys, tempfile, threading, time, urllib.request

APP = "/opt/eterna/app"
VENV_PY = "/opt/eterna/venv/bin/python"
ESTADO = "/var/lib/eterna-vigia/estado.json"
LOG = "/var/log/eterna-vigia.log"
CONF = "/etc/eterna/vigia.env"
DONO = "eterna-deploy"
PORTA_TELA = 8797
STATUS = "http://127.0.0.1:8765/status"
SENSIVEL = re.compile(r"senha|segredo|secret|password|authorization|aws_|token|chave", re.I)


def conf():
    c = {"RAMO": "producao", "REMOTO": "origin", "BUSCA_SEG": "60"}
    try:
        with open(CONF, encoding="utf-8") as f:
            for l in f:
                k, _, v = l.strip().partition("=")
                if k and not l.lstrip().startswith("#"):
                    c[k.strip()] = v.strip().strip('"')
    except FileNotFoundError:
        pass
    return c


agora = lambda: time.strftime("%Y-%m-%d %H:%M:%S")
st = {"ramo": "", "commit": "", "mensagem": "", "atualizado_em": "", "buscado_em": "", "erro": "", "agente_vivo": False,
      "religamentos": 0, "ultimo_religamento": "", "recusados": [], "voltas": 0}


def anota(t):
    if os.path.exists(LOG) and os.path.getsize(LOG) > 10_000_000:
        os.replace(LOG, LOG + ".1")
    with open(LOG, "a", encoding="utf-8", errors="replace") as f:
        f.write("[%s] %s\n" % (agora(), t))


def guarda():
    os.makedirs(os.path.dirname(ESTADO), exist_ok=True)
    tmp = ESTADO + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ESTADO)


def git(*a, timeout=180):
    r = subprocess.run(["runuser", "-u", DONO, "--", "env", "HOME=/opt/eterna/deploy", "git", "-C", APP, *a], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    if r.returncode:
        raise RuntimeError("git %s: %s" % (a[0], (r.stderr or r.stdout).strip()[:300]))
    return r.stdout.strip()


def responde():
    try:
        q = urllib.request.Request(STATUS, headers={"User-Agent": "eterna-vigia"})
        with urllib.request.urlopen(q, timeout=10) as r:
            return r.status == 200 and json.loads(r.read(4096) or b"{}").get("ok") is True
    except Exception:
        return False


def religa(motivo):
    anota("religando o agente: " + motivo)
    subprocess.run(["systemctl", "restart", "eterna.service"], timeout=120)
    st["religamentos"] += 1
    st["ultimo_religamento"] = "%s (%s)" % (agora(), motivo)


def espera_no_ar(seg=90):
    fim = time.time() + seg
    time.sleep(5)
    while time.time() < fim:
        if responde():
            return True
        time.sleep(3)
    return False


def compila(commit):
    """O agente do commit novo compila? Confere sem tocar no código em uso (cópia num temporário)."""
    with tempfile.TemporaryDirectory() as d:
        for arq in ("agente/eterna-agente.py", "agente/eterna-recorte.py"):
            try:
                src = git("show", "%s:%s" % (commit, arq))
            except RuntimeError:
                if arq.endswith("eterna-agente.py"):
                    return "falta %s" % arq
                continue
            p = os.path.join(d, os.path.basename(arq))
            with open(p, "w", encoding="utf-8") as f:
                f.write(src + "\n")
            r = subprocess.run([VENV_PY, "-I", "-c", "import ast,sys;ast.parse(open(sys.argv[1],encoding='utf-8').read())", p],
                               capture_output=True, text=True, timeout=60)
            if r.returncode:
                return "%s não compila: %s" % (arq, (r.stderr or "").strip().splitlines()[-1:] or "")
    return ""


def versao():
    st["commit"] = git("rev-parse", "--short", "HEAD")
    st["mensagem"] = git("log", "-1", "--format=%s")[:160]


def busca():
    c = conf()
    ramo, remoto = c["RAMO"], c["REMOTO"]
    st["ramo"], st["buscado_em"] = ramo, agora()
    try:
        git("fetch", "--quiet", remoto, "+refs/heads/%s:refs/remotes/%s/%s" % (ramo, remoto, ramo))
        velho = git("rev-parse", "HEAD")
        novo = git("rev-parse", "refs/remotes/%s/%s" % (remoto, ramo))
        st["erro"] = ""
        if velho == novo or novo[:12] in st["recusados"]:
            return
        if git("merge-base", velho, novo) != velho:
            raise RuntimeError("%s não avança a partir de %s (não é fast-forward): nada aplicado" % (novo[:12], velho[:12]))
        e = compila(novo)
        if e:
            st["recusados"] = (st["recusados"] + [novo[:12]])[-20:]
            raise RuntimeError("recusado %s: %s" % (novo[:12], e))
        mudou_agente = any(a.startswith("agente/") for a in git("diff", "--name-only", velho, novo).splitlines())
        git("merge", "--ff-only", "--quiet", novo)
        versao()
        st["atualizado_em"] = agora()
        anota("atualizado %s -> %s: %s" % (velho[:12], st["commit"], st["mensagem"]))
        if mudou_agente:
            religa("agente mudou em " + st["commit"])
            if not espera_no_ar():
                anota("o agente de %s não respondeu em 90 s: voltando para %s" % (st["commit"], velho[:12]))
                git("reset", "--hard", "--quiet", velho)
                st["recusados"] = (st["recusados"] + [novo[:12]])[-20:]
                st["voltas"] += 1
                versao()
                religa("volta para %s" % st["commit"])
                st["erro"] = "%s não subiu; voltou para %s" % (novo[:12], st["commit"])
    except Exception as ex:
        st["erro"] = str(ex)[:400]
        anota("erro: %s" % st["erro"])
    finally:
        guarda()


class Tela(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/log"):
            m = re.search(r"n=(\d+)", self.path)
            n = min(int(m.group(1)) if m else 200, 2000)
            try:
                with open(LOG, encoding="utf-8", errors="replace") as f:
                    linhas = f.readlines()[-n:]
            except OSError:
                linhas = []
            corpo, tipo = "".join(l for l in linhas if not SENSIVEL.search(l)), "text/plain; charset=utf-8"
        else:
            corpo, tipo = json.dumps(st, ensure_ascii=False, indent=1), "application/json; charset=utf-8"
        corpo = corpo.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, *a):
        pass


def main():
    try:
        with open(ESTADO, encoding="utf-8") as f:
            st["recusados"] = json.load(f).get("recusados", [])[-20:]
    except (OSError, ValueError):
        pass
    s = http.server.ThreadingHTTPServer(("0.0.0.0", PORTA_TELA), Tela)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    try:
        versao()
    except Exception as ex:
        st["erro"] = str(ex)[:400]
    anota("vigia no ar, ramo %s, commit %s" % (conf()["RAMO"], st["commit"]))
    falhas, ultima = 0, 0.0
    while True:
        st["agente_vivo"] = responde()
        falhas = 0 if st["agente_vivo"] else falhas + 1
        ativo = subprocess.run(["systemctl", "is-active", "--quiet", "eterna.service"]).returncode == 0
        if ativo and falhas >= 3:
            falhas = 0
            religa("agente sem responder há 1min30")
        if time.time() - ultima >= int(conf().get("BUSCA_SEG") or 60):
            ultima = time.time()
            busca()
        time.sleep(30)


if __name__ == "__main__":
    main()
