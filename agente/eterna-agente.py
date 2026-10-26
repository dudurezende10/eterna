#!/usr/bin/env python3
"""Eterna · agente do ponto de captura.

Vigia cartões de memória inseridos no computador, baixa as fotos novas para a
pasta do Eterna (~/Eterna/inbox) e entrega para o app em eterna.photo, que
mostra tudo chegando sozinho na tela Ingestão.

Uso: python3 eterna-agente.py        (deixe rodando; Ctrl+C para parar)

Só biblioteca padrão. Miniaturas via `sips` no Mac e via Pillow se instalado;
sem nenhum dos dois, serve o JPG original.
"""
import hashlib, json, os, shutil, subprocess, sys, threading, time, glob
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PORT = 8765
HOME = os.path.expanduser("~/Eterna")
INBOX = os.path.join(HOME, "inbox")
THUMBS = os.path.join(HOME, "thumbs")
INDEX = os.path.join(HOME, "index.json")
EXT = (".jpg", ".jpeg", ".JPG", ".JPEG")
POLL = 2.0

os.makedirs(INBOX, exist_ok=True)
os.makedirs(THUMBS, exist_ok=True)

lock = threading.Lock()
events = []            # [{type, id, name, size, t, card}]
seen = {}              # hash -> id
lib = {}               # id -> {file, thumb}  (tudo que já está na inbox)
cards = {}             # volume path -> hashes já tratados nesta inserção
state = {"started": time.time(), "card": None, "copied": 0, "dups": 0}

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
            h = quick_hash(src, st.st_size)
            with lock:
                done = cards.setdefault(vol, set())
                if h in done:
                    continue            # já tratado nesta inserção
                done.add(h)
                if h in seen:
                    pid = seen[h]       # cartão relido: repetida, ignorada (uma vez por inserção)
                    events.append({"type": "dup", "id": pid, "name": fn, "size": st.st_size,
                                   "t": st.st_mtime, "card": name})
                    state["dups"] += 1
                    dup += 1
                    continue
            pid = h[:12]
            day = time.strftime("%Y-%m-%d", time.localtime(st.st_mtime))
            ddir = os.path.join(INBOX, day)
            os.makedirs(ddir, exist_ok=True)
            dst = os.path.join(ddir, f"{pid}_{fn}")
            try:
                shutil.copy2(src, dst)
            except Exception as ex:
                print("erro ao copiar", fn, ex)
                continue
            thumb = os.path.join(THUMBS, pid + ".jpg")
            if not make_thumb(dst, thumb):
                thumb = dst
            with lock:
                seen[h] = pid
                lib[pid] = {"file": dst, "thumb": thumb}
                events.append({"type": "photo", "id": pid, "name": fn, "size": st.st_size,
                               "t": st.st_mtime, "card": name, "file": dst, "thumb": thumb})
                state["copied"] += 1
                new += 1
            print(f"  + {fn}  ({st.st_size/1e6:.1f} MB)")
    if new or dup:
        save_index()
        print(f"cartão {name}: {new} novas, {dup} repetidas ignoradas")


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
                return self.js({"ok": True, "agent": "eterna-agente", "version": 1, "card": state["card"],
                                "copied": state["copied"], "dups": state["dups"], "events": len(events),
                                "inbox": INBOX, "platform": sys.platform})
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
        return self.js({"error": "not found"}, 404)


def main():
    print("Eterna · agente do ponto")
    print(f"  fotos baixadas em: {INBOX}")
    print(f"  escutando em:      http://127.0.0.1:{PORT}")
    print("  insira o cartão. Ctrl+C para parar.\n")
    threading.Thread(target=watcher, daemon=True).start()
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nparado.")


if __name__ == "__main__":
    main()
