"""Servidor de teste do Eterna: mantém o agente no ar e aplica sozinho o que chega no GitHub.

Roda neste computador, fora do Claude, a partir de Eterna-servidor-local/supervisor.py (a cópia do repo é a referência:
mudar aqui não muda o que está rodando, justamente para um envio errado nunca derrubar a atualização).
A cada minuto busca a branch. Mudou a tela: vale sozinha. Mudou agente/: reinicia o agente. Só avança sem conflito (--ff-only).
Situação e log, só leitura: porta 8797, no Tailscale. Ver docs/SERVIDOR-DE-TESTE.md.
"""
import http.server, json, os, re, shutil, subprocess, sys, threading, time, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(BASE, "app")
BRANCH = "idiomas-base"
TAILSCALE = "100.115.186.26"
PORTA = 8797
PY = sys.executable.replace("pythonw.exe", "python.exe")
GIT = shutil.which("git") or r"C:\Program Files\Git\cmd\git.exe"
LOG = os.path.join(BASE, "servidor.log")
SEM_JANELA = 0x08000000 if os.name == "nt" else 0
SENSIVEL = re.compile(r"senha|segredo|secret|password|authorization|aws_|token", re.I)
st = {"branch": BRANCH, "commit": "", "mensagem": "", "atualizado_em": "", "buscado_em": "", "erro_git": "",
      "agente_vivo": False, "agente_pid": None, "reinicios": 0, "ultimo_reinicio": ""}
agora = lambda: time.strftime("%Y-%m-%d %H:%M:%S")


def anota(t):
    with open(LOG, "a", encoding="utf-8", errors="replace") as f:
        f.write("[%s] supervisor: %s\n" % (agora(), t))


def git(*a):
    r = subprocess.run([GIT, "-C", APP, *a], capture_output=True, text=True, encoding="utf-8", errors="replace",
                       timeout=120, creationflags=SEM_JANELA)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[:300])
    return r.stdout.strip()


proc = None


def sobe():
    global proc
    if os.path.exists(LOG) and os.path.getsize(LOG) > 5_000_000:
        os.replace(LOG, LOG + ".1")
    arq = open(LOG, "a", encoding="utf-8", errors="replace")
    proc = subprocess.Popen([PY, "-I", "-u", os.path.join(BASE, "rodar.py"), os.path.join(APP, "agente", "eterna-agente.py")],
                            stdout=arq, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, cwd=BASE, creationflags=SEM_JANELA)
    arq.close()
    st["agente_pid"] = proc.pid
    anota("agente no ar, pid %s, commit %s" % (proc.pid, st["commit"]))


def reinicia(motivo):
    anota("reiniciando o agente: " + motivo)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(15)
        except subprocess.TimeoutExpired:
            proc.kill()
    st["reinicios"] += 1
    st["ultimo_reinicio"] = "%s (%s)" % (agora(), motivo)
    sobe()


def responde():
    try:
        q = urllib.request.Request("http://127.0.0.1:8799/status", headers={"X-Eterna": "1"})
        return urllib.request.urlopen(q, timeout=10).status == 200
    except Exception:
        return False


def versao():
    st["commit"] = git("rev-parse", "--short", "HEAD")
    st["mensagem"] = git("log", "-1", "--format=%s")[:160]


def busca():
    st["buscado_em"] = agora()
    try:
        git("fetch", "--quiet", "origin", BRANCH)
        velho, novo = git("rev-parse", "HEAD"), git("rev-parse", "FETCH_HEAD")
        st["erro_git"] = ""
        if velho == novo:
            return
        git("merge", "--ff-only", "--quiet", "FETCH_HEAD")
        versao()
        st["atualizado_em"] = agora()
        anota("atualizado para %s: %s" % (st["commit"], st["mensagem"]))
        if proc and any(a.startswith("agente/") for a in git("diff", "--name-only", velho, novo).splitlines()):
            reinicia("agente mudou em " + st["commit"])
    except Exception as ex:
        st["erro_git"] = str(ex)
        anota("erro ao atualizar: %s" % ex)


class Tela(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/log"):
            m = re.search(r"n=(\d+)", self.path)
            n = int(m.group(1)) if m else 200
            try:
                with open(LOG, encoding="utf-8", errors="replace") as f:
                    linhas = f.readlines()[-min(n, 2000):]
            except OSError:
                linhas = []
            corpo, tipo = "".join(l for l in linhas if not SENSIVEL.search(l)), "text/plain; charset=utf-8"
        else:
            corpo, tipo = json.dumps(st, ensure_ascii=False, indent=1), "application/json; charset=utf-8"
        corpo = corpo.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, *a):
        pass


def escuta(ender):
    while True:
        try:
            s = http.server.ThreadingHTTPServer((ender, PORTA), Tela)
            threading.Thread(target=s.serve_forever, daemon=True).start()
            return
        except OSError:
            time.sleep(30)                                   # Tailscale ainda subindo


def main():
    try:
        s = http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), Tela)    # a porta também impede dois supervisores
    except OSError:
        sys.exit(0)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    threading.Thread(target=escuta, args=(TAILSCALE,), daemon=True).start()
    versao()
    busca()
    sobe()
    falhas, ultima, espera = 0, time.time(), 0
    while True:
        time.sleep(15)
        vivo = proc.poll() is None
        st["agente_vivo"] = vivo and responde()
        falhas = 0 if st["agente_vivo"] else falhas + 1
        if not vivo and time.time() >= espera:
            espera = time.time() + 60                        # agente quebrado não reinicia em laço; um conserto pelo GitHub ainda chega
            reinicia("agente parou, código %s" % proc.returncode)
        elif vivo and falhas >= 12:
            falhas = 0
            reinicia("agente sem responder há 3 min")
        if time.time() - ultima >= 60:
            ultima = time.time()
            busca()


if __name__ == "__main__":
    main()
