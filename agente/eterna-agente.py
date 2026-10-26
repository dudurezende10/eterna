#!/usr/bin/env python3
"""Eterna · agente do ponto.

1) Vigia cartões de memória inseridos no computador e baixa as fotos novas.
2) Recebe fotos por FTP (Canon Content Transfer Professional no celular, ou a
   câmera direto por Wi-Fi) na mesma pasta.
Tudo cai em ~/Eterna/inbox e aparece sozinho na tela Ingestão de eterna.photo.

Uso: python3 eterna-agente.py        (deixe rodando; Ctrl+C para parar)
     sudo python3 eterna-agente.py   (para o FTP usar a porta 21 padrão)

Credenciais do FTP ficam em ~/Eterna/ftp.json (criadas na primeira vez) e são
mostradas na tela ao iniciar.

Só biblioteca padrão. Miniaturas via `sips` no Mac e via Pillow se instalado;
sem nenhum dos dois, serve o JPG original.
"""
import hashlib, json, os, shutil, subprocess, sys, threading, time, glob, socket, random, string
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
import urllib.request, mimetypes

PORT = 8765
APP_ORIGIN = "https://eterna.photo"
app_cache = {}
HOME = os.path.expanduser("~/Eterna")
INBOX = os.path.join(HOME, "inbox")
THUMBS = os.path.join(HOME, "thumbs")
INDEX = os.path.join(HOME, "index.json")
FTPCFG = os.path.join(HOME, "ftp.json")
FTPTMP = os.path.join(HOME, "ftp-tmp")
EXT = (".jpg", ".jpeg", ".JPG", ".JPEG")
POLL = 2.0

os.makedirs(INBOX, exist_ok=True)
os.makedirs(THUMBS, exist_ok=True)
os.makedirs(FTPTMP, exist_ok=True)

lock = threading.Lock()
events = []            # [{type, id, name, size, t, card}]
seen = {}              # hash -> id
lib = {}               # id -> {file, thumb}  (tudo que já está na inbox)
cards = {}             # volume path -> hashes já tratados nesta inserção
state = {"started": time.time(), "card": None, "copied": 0, "dups": 0, "ftp": {"port": None, "ip": None, "users": [], "received": 0, "last_user": None}}

if os.path.exists(INDEX):
    try:
        seen.update(json.load(open(INDEX)))
    except Exception:
        pass


def load_lib():
    for root, _, files in os.walk(INBOX):
        for fn in files:
            if "_" in fn and fn.endswith(EXT):
                pid = fn.split("_", 1)[0]
                th = os.path.join(THUMBS, pid + ".jpg")
                lib[pid] = {"file": os.path.join(root, fn), "thumb": th if os.path.exists(th) else os.path.join(root, fn)}
    # fotos de hoje que já estão na inbox voltam para a tela Ingestão quando o agente reinicia
    today = time.strftime("%Y-%m-%d")
    ddir = os.path.join(INBOX, today)
    if os.path.isdir(ddir):
        files = []
        for fn in os.listdir(ddir):
            if "_" in fn and fn.endswith(EXT):
                p = os.path.join(ddir, fn)
                files.append((os.path.getmtime(p), fn, p))
        for mt, fn, p in sorted(files):
            pid, name = fn.split("_", 1)
            events.append({"type": "photo", "id": pid, "name": name, "size": os.path.getsize(p), "t": mt,
                           "card": "inbox", "src": "inbox", "file": p, "thumb": lib.get(pid, {}).get("thumb", p)})


load_lib()


def save_index():
    tmp = INDEX + ".tmp"
    json.dump(seen, open(tmp, "w"))
    os.replace(tmp, INDEX)


def quick_hash(path, size):
    h = hashlib.sha256()
    h.update(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(2 * 1024 * 1024))
    return h.hexdigest()


def has_pillow():
    try:
        import PIL  # noqa
        return True
    except Exception:
        return False


def make_thumb(src, dst):
    try:
        if sys.platform == "darwin":
            subprocess.run(["sips", "-Z", "900", src, "--out", dst], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        if has_pillow():
            from PIL import Image, ImageOps
            im = Image.open(src)
            im = ImageOps.exif_transpose(im)
            im.thumbnail((900, 900))
            im.convert("RGB").save(dst, "JPEG", quality=82)
            return True
    except Exception:
        pass
    return False


def list_volumes():
    vols = []
    if sys.platform == "darwin":
        vols = [p for p in glob.glob("/Volumes/*") if os.path.isdir(p)]
    elif sys.platform.startswith("win"):
        vols = [f"{d}:\\" for d in "DEFGHIJKLMNOPQRSTUVWXYZ" if os.path.exists(f"{d}:\\")]
    else:
        user = os.environ.get("USER", "")
        vols = glob.glob(f"/media/{user}/*") + glob.glob("/run/media/*/*")
    return [v for v in vols if os.path.isdir(os.path.join(v, "DCIM"))]


def ingest_file(src, fn, st, origin, src_kind, move=False, dedupe_set=None):
    """Leva um arquivo para a inbox. Devolve 'new', 'dup' ou None."""
    h = quick_hash(src, st.st_size)
    with lock:
        if dedupe_set is not None:
            if h in dedupe_set:
                return None             # já tratado nesta inserção
            dedupe_set.add(h)
        if h in seen:
            pid = seen[h]               # repetida: ignorada, mas avisada
            events.append({"type": "dup", "id": pid, "name": fn, "size": st.st_size,
                           "t": st.st_mtime, "card": origin, "src": src_kind})
            state["dups"] += 1
            return "dup"
    pid = h[:12]
    day = time.strftime("%Y-%m-%d", time.localtime(st.st_mtime))
    ddir = os.path.join(INBOX, day)
    os.makedirs(ddir, exist_ok=True)
    dst = os.path.join(ddir, f"{pid}_{fn}")
    try:
        if move:
            shutil.move(src, dst)
        else:
            shutil.copy2(src, dst)
    except Exception as ex:
        print("erro ao copiar", fn, ex)
        return None
    thumb = os.path.join(THUMBS, pid + ".jpg")
    if not make_thumb(dst, thumb):
        thumb = dst
    with lock:
        seen[h] = pid
        lib[pid] = {"file": dst, "thumb": thumb}
        events.append({"type": "photo", "id": pid, "name": fn, "size": st.st_size,
                       "t": st.st_mtime, "card": origin, "src": src_kind, "file": dst, "thumb": thumb})
        state["copied"] += 1
    print(f"  + {fn}  ({st.st_size/1e6:.1f} MB)  via {src_kind} {origin}")
    return "new"


def scan_card(vol):
    name = os.path.basename(vol.rstrip("/\\")) or vol
    state["card"] = name
    new = dup = 0
    for root, _, files in os.walk(os.path.join(vol, "DCIM")):
        for fn in sorted(files):
            if not fn.endswith(EXT) or fn.startswith("._"):
                continue
            src = os.path.join(root, fn)
            try:
                st = os.stat(src)
            except OSError:
                continue
            # espera o arquivo parar de crescer (câmera ainda gravando)
            if time.time() - st.st_mtime < 2:
                continue
            r = ingest_file(src, fn, st, name, "cartao", move=False, dedupe_set=cards.setdefault(vol, set()))
            if r == "new":
                new += 1
            elif r == "dup":
                dup += 1
    if new or dup:
        save_index()
        print(f"cartão {name}: {new} novas, {dup} repetidas ignoradas")


# ---------------------------------------------------------------- FTP --------
# Receptor FTP mínimo (só biblioteca padrão) para o Canon Content Transfer
# Professional e para câmeras com FTP embutido. Modo passivo e ativo, STOR,
# pastas aceitas e ignoradas (tudo cai na inbox por data).

PHOTOGRAPHERS = ["carlos", "marinara", "samuel", "yago", "marcio", "dudu"]


def load_ftp_cfg():
    cfg = None
    if os.path.exists(FTPCFG):
        try:
            cfg = json.load(open(FTPCFG))
        except Exception:
            cfg = None
    if not cfg or not cfg.get("users"):
        alphabet = string.ascii_lowercase + string.digits
        for c in "lo01":
            alphabet = alphabet.replace(c, "")
        cfg = {"users": {u: "".join(random.choice(alphabet) for _ in range(8)) for u in PHOTOGRAPHERS}}
        json.dump(cfg, open(FTPCFG, "w"), indent=2)
    return cfg


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


class FTPSession(threading.Thread):
    def __init__(self, conn, addr, users):
        super().__init__(daemon=True)
        self.conn, self.addr, self.users = conn, addr, users
        self.user = None
        self.ok = False
        self.cwd = "/"
        self.pasv = None       # socket de escuta (modo passivo)
        self.port_addr = None  # (ip, porta) do modo ativo
        self.rest = 0

    def send(self, line):
        try:
            self.conn.sendall((line + "\r\n").encode("utf-8", "replace"))
        except Exception:
            pass

    def data_conn(self):
        if self.pasv:
            self.pasv.settimeout(20)
            d, _ = self.pasv.accept()
            self.pasv.close()
            self.pasv = None
            return d
        if self.port_addr:
            d = socket.create_connection(self.port_addr, timeout=20)
            self.port_addr = None
            return d
        return None

    def run(self):
        self.send("220 Eterna FTP pronto")
        f = self.conn.makefile("rb")
        try:
            while True:
                raw = f.readline()
                if not raw:
                    break
                line = raw.decode("utf-8", "replace").strip()
                if not line:
                    continue
                parts = line.split(" ", 1)
                cmd = parts[0].upper()
                arg = parts[1] if len(parts) > 1 else ""
                self.handle(cmd, arg)
                if cmd == "QUIT":
                    break
        except Exception as ex:
            print("ftp sessão:", ex)
        finally:
            try:
                self.conn.close()
            except Exception:
                pass

    def handle(self, cmd, arg):
        if cmd == "USER":
            self.user = arg.strip().lower()
            self.send("331 Senha")
            return
        if cmd == "PASS":
            if self.user in self.users and self.users[self.user] == arg:
                self.ok = True
                with lock:
                    state["ftp"]["last_user"] = self.user
                print(f"ftp: {self.user} conectado de {self.addr[0]}")
                self.send("230 Bem-vindo ao Eterna, " + self.user)
            else:
                print(f"ftp: login recusado para '{self.user}' de {self.addr[0]}")
                self.send("530 Usuário ou senha incorretos")
            return
        if cmd == "SYST":
            self.send("215 UNIX Type: L8"); return
        if cmd == "FEAT":
            for l in ("211-Recursos", " UTF8", " PASV", " EPSV", " REST STREAM", "211 Fim"):
                self.send(l)
            return
        if cmd in ("OPTS", "NOOP"):
            self.send("200 OK"); return
        if cmd == "QUIT":
            self.send("221 Até logo"); return
        if not self.ok:
            self.send("530 Faça login"); return
        if cmd in ("PWD", "XPWD"):
            self.send(f'257 "{self.cwd}"'); return
        if cmd in ("CWD", "XCWD"):
            a = arg.strip() or "/"
            self.cwd = a if a.startswith("/") else (self.cwd.rstrip("/") + "/" + a)
            self.send("250 OK"); return
        if cmd in ("CDUP", "XCUP"):
            self.cwd = "/" + "/".join(self.cwd.strip("/").split("/")[:-1])
            self.send("250 OK"); return
        if cmd in ("MKD", "XMKD"):
            self.send(f'257 "{arg}" criada'); return
        if cmd == "TYPE":
            self.send("200 OK"); return
        if cmd == "REST":
            try:
                self.rest = int(arg)
            except Exception:
                self.rest = 0
            self.send("350 OK"); return
        if cmd in ("PASV", "EPSV"):
            if self.pasv:
                self.pasv.close()
            self.pasv = socket.socket()
            self.pasv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.pasv.bind(("0.0.0.0", 0))
            self.pasv.listen(1)
            port = self.pasv.getsockname()[1]
            if cmd == "EPSV":
                self.send(f"229 Modo passivo (|||{port}|)")
            else:
                ip = self.conn.getsockname()[0].replace(".", ",")
                self.send(f"227 Modo passivo ({ip},{port // 256},{port % 256})")
            return
        if cmd == "PORT":
            p = arg.split(",")
            self.port_addr = (".".join(p[:4]), int(p[4]) * 256 + int(p[5]))
            self.send("200 OK"); return
        if cmd == "EPRT":
            p = arg.split("|")
            self.port_addr = (p[2], int(p[3]))
            self.send("200 OK"); return
        if cmd in ("LIST", "NLST", "MLSD"):
            d = self.data_conn()
            self.send("150 Lista")
            if d:
                d.close()
            self.send("226 OK"); return
        if cmd == "SIZE":
            self.send("550 Sem tamanho"); return
        if cmd in ("DELE", "RMD", "RNFR", "RNTO", "RETR"):
            self.send("550 Não permitido"); return
        if cmd == "STOR":
            name = os.path.basename(arg.strip().replace("\\", "/")) or f"foto_{int(time.time())}.jpg"
            d = self.data_conn()
            if not d:
                self.send("425 Abra a conexão de dados (modo passivo)"); return
            self.send("150 Pode enviar")
            tmpdir = os.path.join(FTPTMP, self.user)
            os.makedirs(tmpdir, exist_ok=True)
            tmp = os.path.join(tmpdir, name)
            size = 0
            try:
                with open(tmp, "ab" if self.rest else "wb") as out:
                    while True:
                        chunk = d.recv(256 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
                        size += len(chunk)
            finally:
                d.close()
            self.rest = 0
            st = os.stat(tmp)
            if name.lower().endswith((".jpg", ".jpeg")):
                r = ingest_file(tmp, name, st, self.user, "ftp", move=True)
                if r:
                    save_index()
                with lock:
                    state["ftp"]["received"] += 1
            else:
                print(f"ftp: {name} recebido ({size/1e6:.1f} MB), não é JPG; guardado em {tmp}")
            self.send(f"226 Recebido {name}")
            return
        self.send("502 Comando não suportado: " + cmd)


def ftp_server():
    cfg = load_ftp_cfg()
    users = cfg["users"]
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    port = None
    for p in (21, 2121):
        try:
            srv.bind(("0.0.0.0", p))
            port = p
            break
        except Exception:
            continue
    if port is None:
        print("FTP: não consegui abrir as portas 21 nem 2121")
        return
    srv.listen(8)
    ip = lan_ip()
    with lock:
        state["ftp"].update({"port": port, "ip": ip, "users": sorted(users)})
    print(f"  FTP ligado em:     {ip}  porta {port}" + ("" if port == 21 else "  (porta 21 pede sudo; use 2121 no app)"))
    print("  usuários do FTP (senhas em ~/Eterna/ftp.json):")
    for u, pw in users.items():
        print(f"     {u:10s} senha {pw}")
    print()
    while True:
        try:
            conn, addr = srv.accept()
            FTPSession(conn, addr, users).start()
        except Exception as ex:
            print("ftp:", ex)


def watcher():
    while True:
        try:
            vols = list_volumes()
            if not vols:
                state["card"] = None
            for v in vols:
                if v not in cards:
                    cards[v] = set()
                    print(f"cartão inserido: {v}")
                scan_card(v)
            for v in list(cards):
                if v not in vols:
                    print(f"cartão removido: {v}")
                    del cards[v]
        except Exception as ex:
            print("watcher:", ex)
        time.sleep(POLL)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def js(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def file(self, path):
        try:
            with open(path, "rb") as f:
                data = f.read()
        except Exception:
            return self.js({"error": "not found"}, 404)
        self.send_response(200)
        self.cors()
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "max-age=86400")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/status":
            with lock:
                return self.js({"ok": True, "agent": "eterna-agente", "version": 2, "card": state["card"],
                                "copied": state["copied"], "dups": state["dups"], "events": len(events),
                                "inbox": INBOX, "platform": sys.platform, "ftp": state["ftp"]})
        if u.path == "/events":
            since = int(q.get("since", ["0"])[0])
            with lock:
                evs = events[since:since + 200]
                out = [{k: v for k, v in e.items() if k not in ("file", "thumb")} for e in evs]
                for e, o in zip(evs, out):
                    if e["type"] == "photo":
                        o["thumb"] = f"/thumb/{e['id']}"
                        o["url"] = f"/file/{e['id']}"
                return self.js({"events": out, "next": since + len(evs), "total": len(events)})
        if u.path.startswith("/thumb/") or u.path.startswith("/file/"):
            pid = u.path.rsplit("/", 1)[1]
            with lock:
                e = lib.get(pid)
            if not e:
                return self.js({"error": "not found"}, 404)
            return self.file(e["thumb"] if u.path.startswith("/thumb/") else e["file"])
        return self.app(u.path)

    # O app servido pelo próprio agente: o navegador abre http://127.0.0.1:8765 e
    # conversa com o agente na mesma origem (sem bloqueio de rede local do Chrome).
    def app(self, path):
        if path in ("", "/"):
            path = "/index.html"
        if ".." in path:
            return self.js({"error": "not found"}, 404)
        key = path
        hit = app_cache.get(key)
        if not hit or (path == "/index.html" and time.time() - hit[2] > 60):
            try:
                req = urllib.request.Request(APP_ORIGIN + path + ("?t=%d" % int(time.time()) if path == "/index.html" else ""),
                                             headers={"User-Agent": "eterna-agente"})
                with urllib.request.urlopen(req, timeout=20) as r:
                    data = r.read()
                    ctype = r.headers.get("Content-Type") or mimetypes.guess_type(path)[0] or "application/octet-stream"
                hit = (data, ctype, time.time())
                app_cache[key] = hit
            except Exception as ex:
                if not hit:
                    return self.js({"error": "app indisponível: %s" % ex}, 502)
        data, ctype, _ = hit
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if path == "/index.html" else "max-age=3600")
        self.end_headers()
        self.wfile.write(data)


def main():
    print("Eterna · agente do ponto")
    print(f"  fotos baixadas em: {INBOX}")
    print(f"  abra o Eterna em:  http://127.0.0.1:{PORT}   (mesmo Mac)")
    threading.Thread(target=watcher, daemon=True).start()
    threading.Thread(target=ftp_server, daemon=True).start()
    time.sleep(0.4)
    print("  insira o cartão ou mande pelo CTP. Ctrl+C para parar.\n")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
