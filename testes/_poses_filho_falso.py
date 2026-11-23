# P1 de poses (plano docs/planos/2026-11-23-poses-estatistica.md): llama-server FALSO para os testes (nunca em produção:
# o agente só o usa se o teste puser m.POSE_BIN num lançador que chama este arquivo). O agente/eterna-poses.py de verdade
# abre este "servidor" como abriria o llama-server: confere a linha de comando (só 127.0.0.1, --api-key-file, sem -hf),
# responde o /health e o /v1/chat/completions com a chave do arquivo (outra chave = 401) e devolve uma resposta
# determinística pelo hash da imagem recebida (cada foto de teste é desenhada para o seu pid), com 10% inválidas de
# propósito: fora da taxonomia, JSON quebrado e incoerência, um terço de cada.
# O lançador do teste passa --falso-dir <pasta> (o agente/eterna-poses.py não repassa variáveis de teste ao llama-server):
# ali o falso grava pid, linha e caminho da chave (llama-<pid>.json) e lê, a cada pedido, o controle.json do teste:
#   nao_abre   sai antes de abrir a porta          dormir <s>  cada foto demora
#   morre      morre no primeiro pedido             erro500     todo pedido responde 500
#   sem_health o /health nunca responde 200 (a abertura passa do prazo)
import hashlib, json, os, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

a = sys.argv[1:]


def arg(n):
    return a[a.index(n) + 1] if n in a and a.index(n) + 1 < len(a) else None


D = arg("--falso-dir")


def ctl():
    try:
        with open(os.path.join(D, "controle.json")) as f:
            return json.load(f)
    except (OSError, ValueError, TypeError):
        return {}


if ctl().get("nao_abre"):
    sys.exit(1)
if arg("--host") != "127.0.0.1" or not arg("--api-key-file") or any(x in a for x in ("-hf", "--hf-repo", "0.0.0.0")):
    sys.exit(2)
CHAVE = open(arg("--api-key-file")).read().strip()
if D:
    json.dump({"pid": os.getpid(), "argv": a, "chave_arq": arg("--api-key-file"), "modo": oct(os.stat(arg("--api-key-file")).st_mode & 0o777)},
              open(os.path.join(D, "llama-%d.json" % os.getpid()), "w"))

SETS = {"gramado": [("bandeira_frente", "bandeira"), ("bandeira_atras", "bandeira"), ("bandeira_capa", "ambos"), ("posado", "nenhum")],
        "trofeu": [("trofeu_segura", "trofeu"), ("trofeu_comemora", "ambos"), ("trofeu_ao_lado", "trofeu")],
        "arquibancada": [("arq_sentado", "nenhum"), ("arq_em_pe", "bandeira")],
        "chute": [("chute_bola_ar", "nenhum"), ("chute_parado", "nenhum"), ("chute_comemora", "nenhum")],
        "outro": [("comemora_sem", "nenhum"), ("abraco_beijo", "nenhum")]}
QUEM = ["individual", "dupla", "grupo_adultos", "familia_crianca", "so_criancas"]
VIB = ["braco", "punho", "pulo", "movimento"]


def resposta(img):
    h = int(hashlib.sha256(img.encode()).hexdigest()[:12], 16)
    k = h % 30
    if k == 0:
        return json.dumps({"s": "gramado", "q": "dupla", "a": "bandeira", "p": "voando", "e": "inteiro", "vb": []})   # fora da taxonomia
    if k == 1:
        return '{"s": "gramado", "q": "dupla", "a": "band'                                                          # JSON quebrado
    if k == 2:
        return json.dumps({"s": "arquibancada", "q": "dupla", "a": "nenhum", "p": "bandeira_frente", "e": "meio", "vb": []})  # incoerente
    s = sorted(SETS)[h // 30 % len(SETS)]
    p, ad = SETS[s][h // 180 % len(SETS[s])]
    vb = [VIB[i] for i in range(4) if (h >> (20 + i)) & 1 and (h >> 30) & 1]
    return json.dumps({"s": s, "q": QUEM[h // 1000 % len(QUEM)], "a": ad, "p": p, "e": ["inteiro", "meio", "close"][h // 7 % 3], "vb": vb})


class H(BaseHTTPRequestHandler):
    def log_message(self, *x):
        pass

    def _js(self, o, st=200):
        b = json.dumps(o).encode()
        self.send_response(st)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            if ctl().get("sem_health"):
                return self._js({"error": "carregando"}, 503)
            return self._js({"status": "ok"})
        self._js({"error": "x"}, 404)

    def do_POST(self):
        if self.path != "/v1/chat/completions":
            return self._js({"error": "x"}, 404)
        if self.headers.get("Authorization") != "Bearer " + CHAVE:
            return self._js({"error": "chave"}, 401)
        c = ctl()
        if c.get("morre"):
            os._exit(9)
        j = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if c.get("erro500"):
            return self._js({"error": "falso"}, 500)
        dorme = float(c.get("dormir") or 0)
        if dorme:
            time.sleep(dorme)
        rf = j.get("response_format") or {}
        if rf.get("type") != "json_schema" or j.get("temperature") != 0 or j.get("max_tokens") != 80:
            return self._js({"error": "pedido"}, 400)
        img = j["messages"][1]["content"][0]["image_url"]["url"]
        self._js({"choices": [{"message": {"role": "assistant", "content": resposta(img)}}]})


ThreadingHTTPServer(("127.0.0.1", int(arg("--port"))), H).serve_forever()
