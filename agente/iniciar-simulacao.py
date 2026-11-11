# Eterna · simulação v97 (montagem no servidor), a partir do clone do repositório. Só biblioteca padrão.
# Chamado pelo iniciar-simulacao.bat (Windows) e pelo iniciar-simulacao.command (Mac). Faz, nesta ordem:
#   1. serve o app (index.html, vendor/, img/, sprites/) da pasta do clone, só para este computador (127.0.0.1);
#   2. abre o agente (eterna-agente.py) na rede local, com a montagem no servidor ligada (ETERNA_MONTAGEM=1), em portas
#      próprias e com os dados numa pasta própria (Eterna-simulacao), sem tocar na instalação de produção nem nas portas dela;
#   3. manda ao agente a função do dia padrão dos fotógrafos (o ponto fixo de cada um), para as fotos terem as bases de IA
#      mesmo que ninguém abra a Escala (a Escala, se usada, vale por cima);
#   4. mostra o endereço que os outros aparelhos da rede abrem.
# Esta versão NÃO tem o login do servidor: só em rede de confiança, com fotos de teste, e desligada ao terminar.
#   --confere-python    sai com 0 se este Python serve (3.12 ou 3.13, 64 bits)
#   --confere-recorte   sai com 0 se o recorte local já está instalado neste ambiente
# Variáveis opcionais: ETERNA_SIM_PASTA (pasta dos dados), ETERNA_SIM_IP (IP da rede local, se o achado estiver errado),
# ETERNA_SIM_PORTA (8797), ETERNA_SIM_FTP (2197), ETERNA_SIM_APP (8798).
import http.client, http.server, json, os, shutil, signal, socket, struct, subprocess, sys, threading, time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
AGENTE = os.path.join(AQUI, "eterna-agente.py")
# o ponto fixo de cada fotógrafo no app (DATA.points); vale até alguém mudar a função do dia na Escala
FUNCAO_PADRAO = {"carlos": "terminal", "yago": "campo2", "marinara": "campo3", "samuel": "campo4"}


def python_serve():
    return (3, 12) <= sys.version_info[:2] <= (3, 13) and struct.calcsize("P") == 8


def recorte_instalado():
    import importlib.util
    if any(importlib.util.find_spec(x) is None for x in ("numpy", "PIL", "onnxruntime", "rembg")):
        return False
    casa = os.path.expanduser("~")
    modelos = os.path.join(casa, "Eterna", "modelos")
    biref = os.path.join(os.path.expanduser(os.environ.get("REMBG_HOME") or "~/.rembg"), "models", "birefnet-general")
    antigo = os.path.join(os.path.expanduser(os.environ.get("U2NET_HOME") or "~/.u2net"), "birefnet-general.onnx")
    return os.path.isdir(modelos) and bool(os.listdir(modelos)) and (os.path.isdir(biref) or os.path.isfile(antigo))


def porta_env(nome, padrao):
    try:
        p = int(os.environ.get(nome) or padrao)
    except ValueError:
        p = padrao
    return p if 1024 <= p <= 65535 else padrao


def porta_livre(porta, host="0.0.0.0"):
    s = socket.socket()
    try:
        s.bind((host, porta))
        return True
    except OSError:
        return False
    finally:
        s.close()


def ip_da_rede():
    ip = (os.environ.get("ETERNA_SIM_IP") or "").strip()
    if ip:
        return ip
    for alvo in ("10.255.255.255", "192.168.255.255", "8.8.8.8"):      # UDP: nada é enviado; só escolhe a placa de rede
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((alvo, 9))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
        except OSError:
            pass
        finally:
            s.close()
    try:
        ip = socket.gethostbyname(socket.gethostname())
        return ip if not ip.startswith("127.") else None
    except OSError:
        return None


class App(http.server.SimpleHTTPRequestHandler):
    """O app da pasta do clone, só para o agente deste computador (127.0.0.1). O agente só pede a lista branca dele."""

    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def log_message(self, *a):
        pass


def pede(porta, metodo, caminho, corpo=None, espera=5):
    c = http.client.HTTPConnection("127.0.0.1", porta, timeout=espera)
    try:
        dados = json.dumps(corpo).encode() if corpo is not None else None
        cab = {"Host": "127.0.0.1:%d" % porta, "X-Eterna": "1"}
        if dados is not None:
            cab["Content-Type"] = "application/json"
        c.request(metodo, caminho, body=dados, headers=cab)
        r = c.getresponse()
        b = r.read()
        try:
            return r.status, json.loads(b)
        except ValueError:
            return r.status, None
    except OSError:
        return 0, None
    finally:
        c.close()


def linha(txt=""):
    print(txt, flush=True)


def main():
    if "--confere-python" in sys.argv:
        if not python_serve():
            linha("Este Python é o %d.%d (%d bits). A simulação precisa do Python 3.12 ou 3.13 de 64 bits." % (
                sys.version_info[0], sys.version_info[1], struct.calcsize("P") * 8))
            linha("Instale em https://www.python.org/downloads/ (no Windows, marque \"Add python.exe to PATH\") e rode de novo.")
            return 1
        return 0
    if "--confere-recorte" in sys.argv:
        return 0 if recorte_instalado() else 1
    if not os.path.isfile(os.path.join(RAIZ, "index.html")) or not os.path.isfile(AGENTE):
        linha("Não achei o index.html e o agente/eterna-agente.py. Rode este arquivo de dentro do clone do repositório.")
        return 1
    casa = os.environ.get("ETERNA_SIM_PASTA") or os.path.join(os.path.expanduser("~"), "Eterna-simulacao")
    casa = os.path.abspath(casa)
    os.makedirs(casa, exist_ok=True)
    porta, ftp, app = porta_env("ETERNA_SIM_PORTA", 8797), porta_env("ETERNA_SIM_FTP", 2197), porta_env("ETERNA_SIM_APP", 8798)
    if not porta_livre(porta) or not porta_livre(app, "127.0.0.1"):
        linha("A porta %d ou a %d já está em uso. Feche a outra janela da simulação e rode de novo." % (porta, app))
        return 1
    ip = ip_da_rede()
    if not ip:
        linha("Não achei o IP deste computador na rede local. Ligue o Wi-Fi ou o cabo de rede e rode de novo")
        linha("(ou defina ETERNA_SIM_IP com o IP deste computador).")
        return 1
    endereco = "http://%s:%d" % (ip, porta)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", app), App)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    env = dict(os.environ)
    for k in ("ETERNA_PASTA", "ETERNA_IMPRESSORA", "ETERNA_RECORTE_FALSO", "ETERNA_SEM_RECORTE"):
        env.pop(k, None)
    env.update({"HOME": casa, "USERPROFILE": casa, "ETERNA_REDE": "1", "ETERNA_PORTA": str(porta), "ETERNA_FTP_PORTA": str(ftp),
                "ETERNA_ORIGENS": endereco, "ETERNA_GALERIA_PUBLICA": endereco, "ETERNA_APP_ORIGIN": "http://127.0.0.1:%d" % app,
                "ETERNA_MONTAGEM": "1", "ETERNA_RECORTE_GPU": "cpu", "PYTHONUNBUFFERED": "1"})
    env.setdefault("ETERNA_RECORTES_PISO_GB", "5")       # simulação com poucas fotos: 5 GB livres bastam
    env.setdefault("ETERNA_MONTAGENS_PISO_GB", "5")
    try:
        livre = shutil.disk_usage(casa).free / 1024 ** 3
    except OSError:
        livre = None
    linha("=" * 78)
    linha("ETERNA · SIMULAÇÃO v97 (montagem no servidor)")
    linha("ATENÇÃO: esta versão não tem o login do servidor. Use só em rede de confiança, com fotos")
    linha("de teste, e feche esta janela ao terminar. Não abra esta porta para a internet.")
    linha("=" * 78)
    linha("Dados da simulação: %s" % casa)
    if livre is not None:
        linha("Espaço livre: %.0f GB%s" % (livre, "" if livre >= 8 else "  (pouco: abaixo de 5 GB o recorte e a montagem param)"))
    def encerrar(*_):                                    # janela fechada ou processo encerrado: o agente fecha junto
        raise KeyboardInterrupt
    for nome in ("SIGTERM", "SIGHUP", "SIGBREAK"):
        if hasattr(signal, nome):
            try:
                signal.signal(getattr(signal, nome), encerrar)
            except (OSError, ValueError):
                pass
    p = subprocess.Popen([sys.executable, AGENTE], env=env, cwd=AQUI)
    try:
        st = None
        for _ in range(240):
            if p.poll() is not None:
                linha("O agente fechou ao abrir. Veja a mensagem acima.")
                return 1
            cod, st = pede(porta, "GET", "/status", espera=3)
            if cod == 200 and st:
                break
            time.sleep(0.5)
        else:
            linha("O agente não respondeu em 2 minutos.")
            return 1
        mapa = {k: {"tipo": "campo", "point": v} for k, v in FUNCAO_PADRAO.items()}
        cod, _ = pede(porta, "POST", "/fila-fotografo/funcao", {"dia": time.strftime("%Y-%m-%d"), "map": mapa})
        rec, mo = st.get("recorte") or {}, st.get("montagem") or {}
        linha()
        linha("=" * 78)
        linha("PRONTO. Nos outros aparelhos da mesma rede (fotógrafos, Checkout, caixa), abra:")
        linha()
        linha("    %s" % endereco)
        linha()
        linha("Neste computador: http://127.0.0.1:%d  (a câmera do Checkout só abre por este endereço)" % porta)
        linha("Recorte local:        %s" % ("pronto (processador)" if rec.get("ok") else "NÃO instalado: feche e rode de novo para instalar"))
        linha("Montagem no servidor: %s" % ("ligada, o Checkout mostra as do servidor" if mo.get("ligada") and mo.get("checkout")
                                             else "DESLIGADA: %s" % (mo.get("motivo") or "confira a instalação do recorte")))
        linha("Função do dia padrão: %s" % ("enviada (Carlos, Yago, Marinara e Samuel nos pontos fixos)" if cod == 200 else "não enviada: defina na Escala"))
        linha("Se o Windows perguntar se o Python pode usar a rede, clique em Permitir (redes privadas).")
        linha("Para encerrar: feche esta janela (ou Ctrl+C). Roteiro: docs/SIMULACAO.md")
        linha("=" * 78)
        return p.wait()
    except KeyboardInterrupt:
        return 0
    finally:
        for nome in ("SIGTERM", "SIGHUP", "SIGBREAK", "SIGINT"):      # um segundo aviso não interrompe o fechamento
            if hasattr(signal, nome):
                try:
                    signal.signal(getattr(signal, nome), signal.SIG_IGN)
                except (OSError, ValueError):
                    pass
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(10)
            except subprocess.TimeoutExpired:
                p.kill()
        srv.shutdown()


if __name__ == "__main__":
    sys.exit(main())
