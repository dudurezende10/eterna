#!/usr/bin/env python3
"""Eterna · porta pública da galeria (teste de ponta a ponta, plano v85).

Fica entre a internet (Cloudflare Tunnel) e o agente do ponto. Só deixa passar o que o celular do cliente precisa:
o app (index.html e os arquivos de img/, vendor/, sprites/) e as rotas da galeria /g/... Tudo o mais do agente
(biblioteca, vendas, configurações, rostos, FTP, Roverpix) responde 404 daqui. O Host original segue para o agente,
então as travas de origem dele continuam valendo mesmo se algo escapar deste filtro.

Uso:  python porta-publica.py            (escuta em 127.0.0.1:8780 e repassa para 127.0.0.1:8765)
      cloudflared tunnel --url http://127.0.0.1:8780
"""
import http.client, os, re, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

AGENTE = ("127.0.0.1", int(os.environ.get("ETERNA_PORTA") or 8765))
PORTA = int(os.environ.get("ETERNA_PORTA_PUBLICA") or 8780)
ARQUIVO = re.compile(r"^/(img|vendor|sprites)/[A-Za-z0-9_./-]+\.(png|jpe?g|svg|webp|gif|ico|js|css|json|woff2?|wasm|onnx)$")
# o app aberto por este endereço conversa com o agente por ele mesmo (e o QR da tela final aponta para cá)
INJETA = b"<script>window.ETERNA_AGENTE=location.origin</script>"


def permitido(metodo, caminho):
    if ".." in caminho:
        return False
    if caminho.startswith("/g/"):
        return metodo in ("GET", "POST", "OPTIONS", "HEAD")
    return metodo in ("GET", "HEAD") and (caminho in ("/", "/index.html") or bool(ARQUIVO.match(caminho)))


class Porta(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = 30

    def log_message(self, *a):
        pass

    def repassa(self):
        caminho = urlparse(self.path).path
        if not permitido(self.command, caminho):
            corpo = b'{"error": "not found"}'
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(corpo)))
            self.end_headers()
            self.wfile.write(corpo)
            return
        n = int(self.headers.get("Content-Length") or 0)
        if n > 3 * 1024 * 1024:                       # selfie: o agente aceita até 2 MB
            self.send_error(413)
            return
        corpo = self.rfile.read(n) if n else None
        cab = {k: v for k, v in self.headers.items() if k.lower() not in ("connection", "keep-alive", "transfer-encoding", "accept-encoding")}
        c = http.client.HTTPConnection(*AGENTE, timeout=60)
        try:
            c.request(self.command, self.path, body=corpo, headers=cab)
            r = c.getresponse()
            dados = r.read()
        except Exception:
            self.send_error(502)
            return
        finally:
            c.close()
        if caminho in ("/", "/index.html") and r.status == 200:
            dados = dados.replace(b"<head>", b"<head>" + INJETA, 1)
        self.send_response(r.status)
        for k, v in r.getheaders():
            if k.lower() not in ("content-length", "connection", "transfer-encoding", "keep-alive"):
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(dados)

    do_GET = do_POST = do_HEAD = do_OPTIONS = repassa


if __name__ == "__main__":
    print(f"porta pública em http://127.0.0.1:{PORTA} -> agente {AGENTE[0]}:{AGENTE[1]} (só app e /g/)")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORTA), Porta).serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
