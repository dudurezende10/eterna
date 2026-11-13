# v99.28.2: a página do vídeo do cartão aberta pelo endereço do servidor do ponto. O servidor repassa à galeria da nuvem
# os quatro pedidos da página (aceite, renovar, play, baixar com redirecionamento), só para cartão de vídeo entregue.
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/video_repassa_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, threading, time, urllib.request, urllib.error
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
sys.dont_write_bytecode = True
os.environ["ETERNA_SEM_OPENCV"] = "1"
AG = os.path.abspath(sys.argv[1])
sp = importlib.util.spec_from_file_location("ag", AG)
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


pedidos = []


class Nuvem(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def resp(self, st, corpo, extra=None):
        b = json.dumps(corpo).encode()
        self.send_response(st)
        self.send_header("Content-Type", "application/json")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        b = json.loads(self.rfile.read(n) or b"{}")
        pedidos.append(("POST", self.path, b))
        if b.get("acesso") == "LOCAL":
            return self.resp(401, {"error": "acesso inválido ou vencido"})
        self.resp(200, {"ok": True, "acesso": "A1", "galeria": {"videos": []}} if self.path.endswith("/video") else {"ok": True})

    def do_GET(self):
        pedidos.append(("GET", self.path, None))
        self.send_response(302)
        self.send_header("Location", "https://s3.exemplo/assinado")
        self.send_header("Content-Length", "0")
        self.end_headers()


class SemSeguir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


nv = ThreadingHTTPServer(("127.0.0.1", 0), Nuvem)
threading.Thread(target=nv.serve_forever, daemon=True).start()
m.NUVEM_API = "http://127.0.0.1:%d" % nv.server_address[1]
srv = ThreadingHTTPServer(("127.0.0.1", 0), m.H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
U = "http://127.0.0.1:%d" % srv.server_address[1]
QR, OUTRO, TOUR = "V" * 22, "W" * 22, "T" * 22


def pede(metodo, path, corpo=None):
    rq = urllib.request.Request(U + path, data=json.dumps(corpo).encode() if corpo is not None else None, method=metodo,
                                headers={"Content-Type": "application/json"})
    try:
        r = urllib.request.build_opener(SemSeguir).open(rq, timeout=10)
        return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


try:
    c = m.vendas_db()
    c.execute("insert into ativ_entrega (qr, venda, n, em) values (?, 'TREPASSA1D', 1, ?)", (QR, time.strftime("%Y-%m-%dT%H:%M:%S")))
    c.commit()
    c.close()
    st, _, b = pede("POST", "/g/%s/video" % QR, {"consentimento": True, "email": "a@b.co", "marketing": False, "idioma": "pt", "versao": "gv1"})
    ok(st == 200 and json.loads(b)["acesso"] == "A1" and pedidos[-1][:2] == ("POST", "/g/%s/video" % QR) and pedidos[-1][2]["email"] == "a@b.co",
       "aceite repassado à nuvem: %s %s %s" % (st, b, pedidos[-1:]))
    st, _, _ = pede("POST", "/g/%s/evento" % QR, {"acesso": "A1", "tipo": "video_play"})
    ok(st == 200 and pedidos[-1][1] == "/g/%s/evento" % QR, "play repassado")
    st, hd, _ = pede("GET", "/g/%s/baixar?v=1&a=A1" % QR)
    ok(st == 302 and hd.get("Location") == "https://s3.exemplo/assinado" and pedidos[-1][1] == "/g/%s/baixar?v=1&a=A1" % QR,
       "baixar: o redirecionamento para o link assinado chega ao navegador: %s %s" % (st, dict(hd)))
    # galeria do Tour aberta pela página do vídeo: o acesso da nuvem (foto da venda) vale; acesso daqui segue aqui
    c = m.vendas_db()
    c.execute("insert into ativ_venda (origem, id, tipo, dia, criado, valor, tour_token) values ('eterna', 'TREPASSA1D', 'drone', ?, ?, 100, ?)",
              (time.strftime("%Y-%m-%d"), time.strftime("%Y-%m-%dT%H:%M:%S"), TOUR))
    c.commit()
    c.close()
    st, _, b = pede("POST", "/g/%s/galeria" % TOUR, {"acesso": "NUVEM"})
    ok(st == 200 and pedidos[-1][1] == "/g/%s/galeria" % TOUR, "galeria do Tour com o acesso da nuvem, sem selfie: %s %s" % (st, b))
    n = len(pedidos)
    st, _, b = pede("POST", "/g/%s/galeria" % TOUR, {"acesso": "LOCAL"})
    ok(len(pedidos) == n + 1 and st in (401, 404) and b"error" in b, "acesso recusado pela nuvem segue para a galeria daqui: %s %s" % (st, b))
    st, _, _ = pede("POST", "/g/%s/evento" % TOUR, {"acesso": "NUVEM"})
    ok(len(pedidos) == n + 1, "galeria do Tour: só a abertura vai à nuvem")
    n = len(pedidos)
    pede("POST", "/g/%s/video" % OUTRO, {"consentimento": True})
    pede("POST", "/g/%s/rosto" % QR, {})
    ok(len(pedidos) == n, "cartão sem vídeo entregue e outras rotas não vão à nuvem")
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
srv.shutdown()
nv.shutdown()
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK video_repassa_agente: aceite, play e baixar da página do vídeo repassados à nuvem pelo servidor do ponto")
