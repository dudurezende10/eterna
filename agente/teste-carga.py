#!/usr/bin/env python3
"""Eterna · teste de estanque (carga, resistência e ponto de quebra) da operação.

Quatro papéis, cada um pode rodar numa máquina diferente; todos gravam na pasta --saida
(arquivos .jsonl) e o relatório junta tudo no fim.

  enviar     Transferidor: simula os fotógrafos mandando fotos por FTP (como o Canon CTP).
             --sessoes: cada pasta com fotos (uma sessão real do HD) vira um ensaio; os fotógrafos
             pegam a próxima sessão da fila e mandam as fotos na ordem dos cliques, sem repetir.
             --degraus 1,1.5,2,3,4: sobe o ritmo em degraus até achar o ponto de quebra.
             --rajada-a-cada 15: de tempos em tempos todos os fotógrafos começam um ensaio juntos.
             --quedas 0.01: 1% dos envios cai no meio (Wi-Fi da câmera); a foto é mandada de novo.
             Falha de envio é repetida por até --reenvio-min minutos, como a câmera faz.
  selfies    Quiosques: pegam fotos que o Eterna já leu, recortam um rosto, deixam com cara de
             câmera de quiosque e buscam no Eterna. --paralelo 4 = quatro quiosques ao mesmo tempo.
  monitorar  Monitor: a cada 2 s anota fila, CPU, memória do Eterna, banco de rostos, disco e rede.
             Se o Eterna cair ou reiniciar, o monitor registra quanto tempo ficou fora.
  relatorio  Junta tudo + as métricas do Eterna num relatório HTML com critérios de aprovação.

O indexador é o próprio agente do Eterna (eterna-agente.py): recebe por FTP, lê os rostos e
monta o índice. Para mais velocidade: ETERNA_LEITORES=4 python3 eterna-agente.py

Exemplos (a senha do FTP é pedida na tela ou lida de ETERNA_FTP_SENHA, nunca vai para arquivo):
  python3 teste-carga.py enviar --host 192.168.10.218 --usuario carlos --fotos E:\\ --sessoes --minutos 480 --saida ./dia
  python3 teste-carga.py enviar --host 192.168.10.218 --usuario carlos --fotos E:\\ --sessoes --degraus 1,1.5,2,3,4 --minutos-degrau 10 --saida ./quebra
  python3 teste-carga.py selfies --agente http://192.168.10.218:8765 --por-minuto 20 --paralelo 4 --minutos 480 --saida ./dia
  python3 teste-carga.py monitorar --agente http://192.168.10.218:8765 --minutos 490 --saida ./dia
  python3 teste-carga.py relatorio --agente http://192.168.10.218:8765 --saida ./dia

Requisitos: Python 3.9+. O testador de selfie precisa de OpenCV (pip install opencv-python-headless numpy)
e dos modelos em ~/Eterna/modelos (o agente baixa na primeira vez).
"""
import argparse, base64, ftplib, getpass, glob, hashlib, io, json, os, random, statistics, sys, threading, time, urllib.request
from datetime import datetime

MODELOS = os.path.join(os.path.expanduser("~/Eterna"), "modelos")
LIMITE = 0.45  # mesma semelhança mínima do Eterna para "é a pessoa"; abaixo disso ele pergunta


def agora():
    return time.time()


def grava(saida, nome, linha, _lock=threading.Lock()):
    os.makedirs(saida, exist_ok=True)
    with _lock, open(os.path.join(saida, nome), "a", encoding="utf8") as f:
        f.write(json.dumps(linha, ensure_ascii=False) + "\n")


def le(saida, nome):
    p = os.path.join(saida, nome)
    if not os.path.exists(p):
        return []
    return [json.loads(l) for l in open(p, encoding="utf8") if l.strip()]


def get_json(url, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "eterna-teste"}), timeout=timeout) as r:
        return json.loads(r.read().decode("utf8"))


# ---------- transferidor ----------
# Simula a operação real: cada fotógrafo faz ensaios (10 a 20 fotos, clicadas ao longo de 1,5 a 2,5 min), para e começa o próximo.
# A pausa entre ensaios é calculada para fechar a produção do dia (--meta-dia em --horas com --fotografos).
# --acelerar 4 faz o mesmo dia em 1/4 do tempo (pico 4x maior), para testar o limite.
def hora_clique(f):
    """Hora do clique gravada pela câmera (EXIF DateTimeOriginal), em segundos; None se a foto não tiver."""
    try:
        from PIL import Image
        with Image.open(f) as im:
            ex = im.getexif()
            v = ex.get_ifd(0x8769).get(36867) or ex.get(306)
        return datetime.strptime(str(v).strip()[:19], "%Y:%m:%d %H:%M:%S").timestamp() if v else None
    except Exception:
        return None


def enviar(a):
    jpg = lambda d, rec=True: sorted((f for f in glob.glob(os.path.join(d, "**", "*") if rec else os.path.join(d, "*"), recursive=rec)
                                      if f.lower().endswith((".jpg", ".jpeg"))), key=lambda f: (os.path.getmtime(f), f))  # ordem em que a câmera gravou
    sessoes, cameras, subs = [], [], []
    if a.sessoes:
        # toda pasta com fotos dentro é uma sessão (o HD pode ter data/sessão/fotos)
        for raiz, _, arqs in os.walk(a.fotos):
            if any(x.lower().endswith((".jpg", ".jpeg")) for x in arqs):
                sessoes.append(raiz)
        sessoes.sort()
        if not sessoes:
            sys.exit("nenhuma pasta com .jpg em " + a.fotos)
        fila_sessoes = list(sessoes)
        amostra = [f for s in sessoes[:5] for f in jpg(s, False)]
    else:
        subs = sorted(d for d in glob.glob(os.path.join(a.fotos, "*")) if os.path.isdir(d) and jpg(d))
        # uma subpasta por fotógrafo/câmera: cada fotógrafo simulado manda só as fotos dela, na ordem dos cliques
        cameras = [(os.path.basename(d), jpg(d)) for d in subs] if subs else [(None, jpg(a.fotos))]
        if not any(c[1] for c in cameras):
            sys.exit("nenhuma foto .jpg em " + a.fotos)
        amostra = [f for _, l in cameras for f in l][:50]
    senha = os.environ.get("ETERNA_FTP_SENHA") or getpass.getpass(f"senha FTP de {a.usuario}@{a.host}: ")
    cache = {}
    def ler(f):
        if a.sessoes:                                                 # HD inteiro: não cabe na memória, lê na hora
            return open(f, "rb").read()
        if f not in cache:
            cache[f] = open(f, "rb").read()
        return cache[f]
    media_mb = statistics.mean(os.path.getsize(f) for f in amostra) / 1e6
    fmin, fmax = a.fotos_ensaio; dmin, dmax = a.duracao_ensaio
    por_min = a.meta_dia / (a.fotografos * a.horas * 60)            # fotos/min por fotógrafo para fechar a meta
    ciclo = ((fmin + fmax) / 2) / por_min                            # minutos entre o início de um ensaio e o do próximo
    pausa = max(0.2, ciclo - (dmin + dmax) / 2)                      # troca de família
    degraus = [float(x) for x in a.degraus.split(",")] if a.degraus else None
    t0_teste = agora()
    duracao = (len(degraus) * a.minutos_degrau if degraus else a.minutos) * 60
    fim = t0_teste + duracao
    def ritmo():                                                     # aceleração em vigor agora e índice do degrau
        if not degraus:
            return a.acelerar, 0
        i = min(len(degraus) - 1, int((agora() - t0_teste) / (a.minutos_degrau * 60)))
        return degraus[i], i
    rajadas = [t0_teste + n * a.rajada_a_cada * 60 for n in range(1, int(duracao / max(1, a.rajada_a_cada * 60)) + 1)] if a.rajada_a_cada else []
    print(f"operação simulada: {a.fotografos} fotógrafos · ensaios de {fmin}-{fmax} fotos em {dmin}-{dmax} min · pausa média {pausa:.1f} min"
          f" · {por_min * a.fotografos:.0f} fotos/min em ritmo normal (meta {a.meta_dia:,}/dia em {a.horas} h)"
          + (f" · degraus {degraus} de {a.minutos_degrau} min" if degraus else f" · {a.minutos} min{', acelerado %gx' % a.acelerar if a.acelerar != 1 else ''}")
          + (f" · {len(sessoes)} sessões" if a.sessoes else "") + f" · fotos de {media_mb:.1f} MB em média"
          + (f" · rajada a cada {a.rajada_a_cada} min" if rajadas else "") + (f" · {a.quedas * 100:g}% dos envios caem no meio" if a.quedas else ""))
    tot = {"ok": 0, "erro": 0, "bytes": 0, "ensaios": 0, "quedas": 0}
    trava = threading.Lock()
    limite_b = a.limite_gb * 1e9 if a.limite_gb else None

    sem_pasta = {"aviso": False}
    def conecta(nome_fot):
        ftp = ftplib.FTP(); ftp.connect(a.host, a.porta, timeout=60); ftp.login(a.usuario, senha); ftp.set_pasv(True)
        if a.pasta_por_fotografo and not sem_pasta.get("sem"):        # como o CTP: cada fotógrafo na sua pasta do servidor
            try:
                ftp.mkd(nome_fot)
            except Exception:
                pass
            try:
                ftp.cwd(nome_fot)
            except Exception as ex:                                   # usuário sem permissão de criar pasta: manda na raiz
                sem_pasta["sem"] = True
                if not sem_pasta["aviso"]:
                    sem_pasta["aviso"] = True
                    print(f"  aviso: o FTP não deixou criar a pasta do fotógrafo ({ex}); mandando todos na pasta principal")
        return ftp

    def manda(estado, nome_fot, arq, corpo):
        """Manda uma foto; se cair, repete como a câmera (até --reenvio-min). Devolve (ok, tentativas, quedas, erro)."""
        tent, quedas, desde, espera = 0, 0, agora(), 2
        while True:
            tent += 1
            try:
                if estado["ftp"] is None:
                    estado["ftp"] = conecta(nome_fot)
                ftp = estado["ftp"]
                if a.quedas and random.random() < a.quedas and quedas == 0:
                    # Wi-Fi da câmera caiu no meio: manda metade e derruba a conexão; o Eterna tem que recusar a foto cortada
                    quedas += 1
                    con = ftp.transfercmd("STOR " + arq)
                    con.sendall(corpo[:len(corpo) // 2]); con.close()
                    try:
                        ftp.voidresp()
                    except Exception:
                        pass
                    raise ConnectionError("queda simulada no meio do envio")
                ftp.storbinary("STOR " + arq, io.BytesIO(corpo), blocksize=256 * 1024)
                return True, tent, quedas, None
            except Exception as ex:
                try:
                    estado["ftp"].close()
                except Exception:
                    pass
                estado["ftp"] = None
                if agora() - desde > a.reenvio_min * 60 or agora() >= fim + 600:
                    return False, tent, quedas, str(ex)[:200]
                if not str(ex).startswith("queda simulada"):
                    if tent in (1, 3) or tent % 10 == 0:
                        print(f"  {nome_fot}: {arq} falhou ({str(ex)[:120]}); tentativa {tent}, tentando de novo")
                    time.sleep(espera); espera = min(30, espera * 2)

    def fotografo(i):
        nome_fot = f"fot{i + 1}"
        cam_fotos = []
        if not a.sessoes:
            cam_nome, cam_fotos = cameras[i % len(cameras)]
            volta_cam = i // len(cameras)                             # mais fotógrafos que pastas: dividem a câmera, cada um na sua pasta
            nome_fot = (cam_nome + (f"-{volta_cam + 1}" if volta_cam else "")) if cam_nome else nome_fot
            if not subs:                                              # sem subpastas: divide as fotos entre os fotógrafos
                cam_fotos = cam_fotos[i::a.fotografos] or cam_fotos
            else:
                dividem = len(range(i % len(cameras), a.fotografos, len(cameras)))
                cam_fotos = cam_fotos[volta_cam::dividem] or cam_fotos
        estado = {"ftp": None}
        n = 0; ens = 0; rajada_vista = 0
        time.sleep(random.uniform(0, ciclo * 60 / ritmo()[0]))       # cada um começa num momento diferente
        while agora() < fim:
            if limite_b and tot["bytes"] >= limite_b:
                break
            if a.sessoes:
                with trava:
                    if not fila_sessoes:
                        break
                    pasta = fila_sessoes.pop(0)
                lista = jpg(pasta, False); sessao = os.path.relpath(pasta, a.fotos)
            else:
                nf = random.randint(fmin, fmax)
                lista = [cam_fotos[(n + j) % len(cam_fotos)] for j in range(nf)]; sessao = None
            ens += 1; tot["ensaios"] += 1
            k, deg = ritmo()
            nf = len(lista); dur = random.uniform(dmin, dmax) * 60 / k
            # sessão real: os cliques seguem os intervalos que a câmera gravou (sessão de mais de --duracao-max min é encurtada)
            hs = [hora_clique(f) for f in lista] if a.sessoes and a.cliques_reais else []
            reais = len(hs) > 1 and all(hs)
            if reais:
                lista = [f for _, f in sorted(zip(hs, lista))]; hs.sort()
                total = hs[-1] - hs[0]
                encolhe = min(1.0, a.duracao_max * 60 / total) if total > 0 else 1.0
                offs = [(h - hs[0]) * encolhe / k for h in hs]
            ini = agora()
            for j, orig in enumerate(lista):
                alvo = ini + (offs[j] if reais else dur * j / max(1, nf - 1) + random.uniform(-.15, .15) * dur / nf)
                if agora() >= fim and not a.sessoes:
                    break
                if alvo > agora():
                    time.sleep(alvo - agora())
                n += 1
                volta = 0 if a.sessoes else (n - 1) // max(1, len(cam_fotos))
                corpo = ler(orig) + (os.urandom(16) if volta else b"")       # repetindo a pasta: bytes no fim do JPEG, arquivo único
                base, ext = os.path.splitext(os.path.basename(orig))
                arq = f"{base}{'_r%d' % (volta + 1) if volta else ''}{ext}"  # nome que a câmera deu
                k, deg = ritmo()
                lin = {"arquivo": arq, "origem": orig, "sessao": sessao, "fotografo": nome_fot, "ensaio": f"{nome_fot}-{ens}",
                       "foto_do_ensaio": j + 1, "fotos_no_ensaio": nf, "bytes": len(corpo), "sha": hashlib.sha256(corpo).hexdigest(),
                       "inicio": agora(), "ritmo": k, "degrau": deg}
                t0 = agora()
                ok, tent, quedas, erro = manda(estado, nome_fot, arq, corpo)
                dt = agora() - t0
                lin.update(seg=round(dt, 3), ok=ok, tentativas=tent, quedas=quedas,
                           mbps=round(len(corpo) * 8 / 1e6 / dt, 1) if ok and dt and tent == 1 else None)
                if erro:
                    lin["erro"] = erro
                with trava:
                    tot["ok" if ok else "erro"] += 1; tot["quedas"] += quedas
                    if ok:
                        tot["bytes"] += len(corpo)
                grava(a.saida, "envios.jsonl", lin)
            # pausa até o próximo ensaio; numa rajada, todo mundo começa junto
            k, _ = ritmo()
            fim_pausa = agora() + random.uniform(.6, 1.4) * pausa * 60 / k
            while agora() < min(fim_pausa, fim):
                prox = next((r for r in rajadas if r > rajada_vista), None)
                if prox and agora() >= prox:
                    rajada_vista = prox; break
                time.sleep(.5)
        try:
            estado["ftp"].quit()
        except Exception:
            pass

    json.dump({"meta_dia": a.meta_dia, "horas": a.horas, "fotografos": a.fotografos, "fotos_ensaio": a.fotos_ensaio,
               "duracao_ensaio": a.duracao_ensaio, "acelerar": a.acelerar, "degraus": degraus, "minutos_degrau": a.minutos_degrau if degraus else None,
               "inicio": t0_teste, "pausa_min": round(pausa, 2), "sessoes": len(sessoes) if a.sessoes else None,
               "rajada_a_cada": a.rajada_a_cada, "quedas": a.quedas, "reenvio_min": a.reenvio_min},
              open(os.path.join(a.saida, "parametros.json"), "w", encoding="utf8"))
    ths = [threading.Thread(target=fotografo, args=(i,), daemon=True) for i in range(a.fotografos)]
    for t in ths:
        t.start()
    while any(t.is_alive() for t in ths):
        time.sleep(10)
        k, deg = ritmo()
        print(f"  {datetime.now():%H:%M:%S}  ritmo {k:g}x  ensaios {tot['ensaios']}  fotos {tot['ok']}  erros {tot['erro']}  quedas {tot['quedas']}  {tot['bytes'] / 1e9:.2f} GB"
              + (f"  sessões na fila {len(fila_sessoes)}" if a.sessoes else ""))
    print("fim do envio:", tot)


# ---------- quiosques (testador de selfie) ----------
def selfies(a):
    import cv2, numpy as np
    vistos = set(); trava = threading.Lock()
    fim = agora() + a.minutos * 60
    intervalo = 60.0 / a.por_minuto * a.paralelo                    # cada quiosque faz a sua parte
    print(f"testando selfies: {a.por_minuto}/min em {a.paralelo} quiosques ao mesmo tempo, por {a.minutos} min em {a.agente} (busca em {a.dias} dia(s))")

    def quiosque(q):
        det = cv2.FaceDetectorYN.create(os.path.join(MODELOS, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.7, 0.3, 5000)
        time.sleep(random.uniform(0, intervalo))
        while agora() < fim:
            t_ciclo = agora()
            try:
                m = get_json(a.agente + "/metricas?desde=%f" % (agora() - 3600))
                with trava:
                    prontas = [f for f in m["fotos"] if f.get("rostos") and f["pid"] not in vistos]
                    f = random.choice(prontas[-300:]) if prontas else None
                    if f:
                        vistos.add(f["pid"])
            except Exception as ex:
                grava(a.saida, "selfies.jsonl", {"quiosque": q, "inicio": agora(), "erro": "Eterna sem resposta: " + str(ex)[:150]})
                time.sleep(5); continue
            if not f:
                time.sleep(2); continue
            try:
                raw = urllib.request.urlopen(a.agente + "/file/" + f["pid"], timeout=60).read()
                img = cv2.imdecode(np.frombuffer(raw, "uint8"), cv2.IMREAD_REDUCED_COLOR_2)
                h, w = img.shape[:2]; k = min(1.0, 1600 / max(h, w))
                img = cv2.resize(img, (int(w * k), int(h * k)))
                det.setInputSize((img.shape[1], img.shape[0])); _, fs = det.detect(img)
                if fs is None or not len(fs):
                    continue
                x, y, bw, bh = [int(v) for v in max(fs, key=lambda r: r[2])[:4]]
                # "selfie": recorte com folga, reduzido para 640 px de largura, luz e cor diferentes, como uma webcam de quiosque
                mx, my = int(bw * 1.2), int(bh * 1.0)
                crop = img[max(0, y - my):min(h, y + bh + my), max(0, x - mx):min(w, x + bw + mx)]
                crop = cv2.resize(crop, (640, int(640 * crop.shape[0] / crop.shape[1])))
                crop = cv2.convertScaleAbs(crop, alpha=random.uniform(.8, 1.15), beta=random.uniform(-25, 20))
                crop = cv2.GaussianBlur(crop, (3, 3), 0)
                ok, jpg = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 80])
                corpo = json.dumps({"imagens": ["data:image/jpeg;base64," + base64.b64encode(jpg.tobytes()).decode()], "dias": a.dias}).encode()
                t0 = agora()
                req = urllib.request.Request(a.agente + "/rostos/buscar", data=corpo, headers={"Content-Type": "application/json"})
                r = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
                dt = agora() - t0
                res = r.get("fotos", [])
                ids = [x["id"] for x in res]
                sim = next((x["sim"] for x in res if x["id"] == f["pid"]), None)
                grava(a.saida, "selfies.jsonl", {"quiosque": q, "pid": f["pid"], "inicio": t0, "ms": round(dt * 1000, 1), "rosto": r.get("rosto"),
                                                  "achou": f["pid"] in ids, "posicao": ids.index(f["pid"]) + 1 if f["pid"] in ids else None,
                                                  "semelhanca": sim, "resultados": len(ids), "selfie_kb": round(len(jpg) / 1024),
                                                  "fotos": [[x["id"], x["sim"]] for x in res[:200]]})
            except Exception as ex:
                grava(a.saida, "selfies.jsonl", {"quiosque": q, "pid": f["pid"], "inicio": agora(), "erro": str(ex)[:200]})
            time.sleep(max(0, intervalo - (agora() - t_ciclo)))

    ths = [threading.Thread(target=quiosque, args=(q + 1,), daemon=True) for q in range(a.paralelo)]
    for t in ths:
        t.start()
    for t in ths:
        t.join()
    print("fim do teste de selfie:", len(le(a.saida, "selfies.jsonl")), "buscas")


# ---------- monitor ----------
def monitorar(a):
    fim = agora() + a.minutos * 60
    ant = None
    while agora() < fim:
        t0 = agora()
        try:
            st = get_json(a.agente + "/status", timeout=10)
            m = get_json(a.agente + "/metricas?desde=%f" % (agora() + 1), timeout=10)
            r = st.get("rostos") or {}
            maq = m.get("maquina") or {}
            lin = {"t": t0, "recebidas": st.get("copied"), "repetidas": st.get("dups"), "lidas": r.get("lidas"),
                   "fila": r.get("fila"), "leitores": r.get("leitores"), "ftp_recebidas": (st.get("ftp") or {}).get("received"),
                   "resposta_ms": round((agora() - t0) * 1000, 1), **maq}
            # taxas a partir dos contadores da máquina (disco e rede)
            if ant and maq.get("iniciado") == ant.get("iniciado"):
                dt = max(.1, t0 - ant["t"])
                for chave, nome, k in (("disco_escrita_b", "disco_escrita_mbs", 1e6), ("disco_leitura_b", "disco_leitura_mbs", 1e6),
                                       ("rede_rx_b", "rede_rx_mbit", 1e6 / 8), ("rede_tx_b", "rede_tx_mbit", 1e6 / 8)):
                    if maq.get(chave) is not None and ant.get(chave) is not None:
                        lin[nome] = round(max(0, maq[chave] - ant[chave]) / k / dt, 2)
                if maq.get("disco_ocupado_ms") is not None and ant.get("disco_ocupado_ms") is not None:
                    lin["disco_ocupado_pct"] = round(min(100, (maq["disco_ocupado_ms"] - ant["disco_ocupado_ms"]) / 10 / dt), 1)
            ant = {"t": t0, **maq}
            grava(a.saida, "monitor.jsonl", lin)
        except Exception as ex:
            grava(a.saida, "monitor.jsonl", {"t": t0, "erro": str(ex)[:200]})
        time.sleep(max(0, 2 - (agora() - t0)))


# ---------- relatório ----------
def pct(v, p):
    v = sorted(x for x in v if x is not None)
    if not v:
        return None
    return v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))]


def media(v):
    v = [x for x in v if x is not None]
    return statistics.mean(v) if v else None


def fmt(x, casas=1, suf=""):
    return "–" if x is None else f"{x:,.{casas}f}{suf}".replace(",", "X").replace(".", ",").replace("X", ".")


def esc(x):
    return str(x).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def grafico(series, rotulo, unidade, t_ini):
    """Linhas no tempo: series = [(nome, cor, [(t, y)])]."""
    pts = [p for _, _, s in series for p in s]
    if not pts:
        return "<p class='mu'>sem dados</p>"
    maxt = max(1, max(t for t, _ in pts) - t_ini); maxy = max(1e-9, max(y for _, y in pts))
    caminhos = "".join(
        f'<path d="{"".join(f"{chr(77) if i == 0 else chr(76)}{40 + 740 * (t - t_ini) / maxt:.1f},{170 - 150 * y / maxy:.1f}" for i, (t, y) in enumerate(s))}" fill="none" stroke="{cor}" stroke-width="2"/>'
        for _, cor, s in series if s)
    leg = " · ".join(f'<span style="color:{cor}">■</span> {esc(n)}' for n, cor, s in series if s)
    return (f'<svg viewBox="0 0 800 190" role="img" aria-label="{esc(rotulo)}">{caminhos}'
            f'<text x="40" y="186" font-size="11" fill="#5b6573">0 min</text><text x="730" y="186" font-size="11" fill="#5b6573">{fmt(maxt / 60, 0)} min</text>'
            f'<text x="2" y="24" font-size="11" fill="#5b6573">{fmt(maxy, 0)} {esc(unidade)}</text></svg><p class="mu">{leg}</p>')


def relatorio(a):
    env = le(a.saida, "envios.jsonl"); sel = le(a.saida, "selfies.jsonl"); mon = le(a.saida, "monitor.jsonl")
    par_p = os.path.join(a.saida, "parametros.json")
    par = json.load(open(par_p, encoding="utf8")) if os.path.exists(par_p) else {}
    try:
        met = get_json(a.agente + "/metricas?desde=%f" % (min([e["inicio"] for e in env] or [0]) - 5), timeout=60)
        json.dump(met, open(os.path.join(a.saida, "metricas-eterna.json"), "w", encoding="utf8"))
    except Exception:
        p = os.path.join(a.saida, "metricas-eterna.json")
        met = json.load(open(p, encoding="utf8")) if os.path.exists(p) else {"fotos": []}

    # ---- integridade: cada envio casa com a foto recebida pela assinatura do arquivo ----
    ok = [e for e in env if e["ok"]]; err = [e for e in env if not e["ok"]]
    t_ini_env = par.get("inicio") or min([e["inicio"] for e in env] or [0])
    t_fim_env = max([e["inicio"] + e["seg"] for e in env] or [t_ini_env]) + 900
    rec_todas = [f for f in met["fotos"] if not f.get("dup") and t_ini_env - 5 <= f["chegada"] <= t_fim_env]   # só o que chegou durante este teste
    por_sha = {f["sha"]: f for f in rec_todas if f.get("sha")}
    chave_env = lambda e: (e["fotografo"], e["arquivo"])
    env_por = {chave_env(e): e for e in ok}; so_nome = {e["arquivo"]: e for e in ok}
    tem_sha = bool(por_sha)
    def recebida_de(e):
        if tem_sha and e.get("sha"):
            return por_sha.get(e["sha"])
        return None
    if tem_sha:
        par_env = [(e, recebida_de(e)) for e in ok]
    else:                                                    # Eterna antigo, sem assinatura: casa por fotógrafo + nome
        rec_por = {}
        for f in rec_todas:
            rec_por.setdefault((f.get("quem"), f["nome"]), f); rec_por.setdefault(f["nome"], f)
        par_env = [(e, rec_por.get(chave_env(e)) or rec_por.get(e["arquivo"])) for e in ok]
    env_de_pid = {f["pid"]: e for e, f in par_env if f}
    rec = [f for _, f in par_env if f]
    sha_env = {e.get("sha") for e in env}
    nomes_env = {(e["fotografo"], e["arquivo"]) for e in env}
    # sem a mesma assinatura: se chegou um arquivo com o mesmo fotógrafo e nome, chegou estragado; se não, se perdeu
    por_nome = {}
    for f in rec_todas:
        if tem_sha and f.get("sha") not in sha_env:
            por_nome.setdefault((f.get("quem"), f["nome"]), []).append(f)
    corrompidas, perdidas = [], []
    for e, f in par_env:
        if f:
            continue
        estragada = next((x for x in por_nome.get(chave_env(e), []) if x["chegada"] >= e["inicio"] - 5), None)
        (corrompidas if estragada else perdidas).append(e)
    n_dup = sum(1 for f in met["fotos"] if f.get("dup") and (f.get("quem"), f["nome"]) in nomes_env)
    reenvios = sum(1 for e in env if e.get("tentativas", 1) > 1)
    quedas_sim = sum(e.get("quedas", 0) for e in env)
    seg_inc = {}                                            # contador do Eterna zera quando ele reinicia: soma o que subiu em cada trecho
    for m in mon:
        if "erro" not in m and m.get("ftp_incompletas") is not None:
            v = seg_inc.setdefault(m.get("iniciado"), [m["ftp_incompletas"], m["ftp_incompletas"]]); v[1] = m["ftp_incompletas"]
    incompletas = sum(f - i for i, f in seg_inc.values())

    t_ini = par.get("inicio") or min([e["inicio"] for e in env] or [0])
    t_fim = max([e["inicio"] + e["seg"] for e in env] or [t_ini + 1])
    dur_min = max(1e-9, (t_fim - t_ini) / 60)
    lidas = [f for f in rec if f.get("lida")]
    ponta = [f["lida"] - env_de_pid[f["pid"]]["inicio"] for f in lidas]          # clique enviado -> foto procurável pelo rosto
    fim_leit = max([f["lida"] for f in lidas] or [t_fim])
    taxa_env = len(ok) / dur_min
    taxa_leit = len(lidas) / max(1e-9, (fim_leit - t_ini) / 60)
    monok = [m for m in mon if "erro" not in m]
    fila_max = max([m.get("fila") or 0 for m in monok] or [0])
    meta_min = a.meta_dia / (a.horas * 60)
    pico_min = meta_min * a.pico
    tempos = sorted(e["inicio"] for e in ok)
    pico_obs, j = 0, 0
    for i_, t in enumerate(tempos):
        while tempos[j] < t - 60:
            j += 1
        pico_obs = max(pico_obs, i_ - j + 1)
    pico_min = max(pico_min, pico_obs)

    # ---- ensaio pronto para o checkout: do último clique até a última foto do ensaio ficar procurável ----
    ens = {}
    lida_de = {id(e): f.get("lida") if f else None for e, f in par_env}
    for e in ok:
        d = ens.setdefault(e["ensaio"], {"ult": 0, "lidas": [], "n": 0}); d["n"] += 1
        d["ult"] = max(d["ult"], e["inicio"] + e["seg"]); d["lidas"].append(lida_de.get(id(e)))
    prontos = [max(0, max(d["lidas"]) - d["ult"]) for d in ens.values() if d["lidas"] and all(d["lidas"])]   # foto repetida já lida antes conta como pronta

    # ---- estatísticas das sessões: cliques, duração real (hora gravada pela câmera), volume e tempos no teste ----
    sess = {}
    for e in ok:
        d = sess.setdefault(e.get("sessao") or e["ensaio"], {"n": 0, "b": 0, "ini": 1e18, "fim": 0, "origens": [], "ens": e["ensaio"]})
        d["n"] += 1; d["b"] += e["bytes"]; d["ini"] = min(d["ini"], e["inicio"]); d["fim"] = max(d["fim"], e["inicio"] + e["seg"])
        d["origens"].append(e.get("origem"))
    for d in sess.values():
        hs = sorted(h for h in (hora_clique(o) for o in d["origens"] if o and os.path.exists(o)) if h)
        d["dur_real"] = (hs[-1] - hs[0]) / 60 if len(hs) > 1 else None
        d["int_real"] = statistics.mean(b - a_ for a_, b in zip(hs, hs[1:])) if len(hs) > 1 else None
        de = ens.get(d["ens"])
        d["pronta"] = max(0, max(de["lidas"]) - de["ult"]) if de and de["lidas"] and all(de["lidas"]) else None
    sv = list(sess.values())
    def est(v, casas=1, suf=""):
        v = [x for x in v if x is not None]
        return [fmt(statistics.mean(v), casas, suf), fmt(statistics.median(v), casas, suf), fmt(min(v), casas, suf), fmt(max(v), casas, suf)] if v else ["–"] * 4
    tab_sess = [("Cliques (fotos) por sessão", est([d["n"] for d in sv], 1)),
                ("Duração real da sessão (1º ao último clique, pela câmera)", est([d["dur_real"] for d in sv], 1, " min")),
                ("Intervalo entre cliques", est([d["int_real"] for d in sv], 1, " s")),
                ("Volume da sessão", est([d["b"] / 1e6 for d in sv], 1, " MB")),
                ("Tempo para enviar a sessão no teste", est([(d["fim"] - d["ini"]) / 60 for d in sv], 1, " min")),
                ("Pronta no checkout após o último clique", est([d["pronta"] for d in sv], 1, " s"))]
    faixas = [(1, 1, "1 foto"), (2, 5, "2 a 5"), (6, 10, "6 a 10"), (11, 20, "11 a 20"), (21, 40, "21 a 40"), (41, 10 ** 6, "mais de 40")]
    dist = [(r, sum(1 for d in sv if lo <= d["n"] <= hi), sum(d["n"] for d in sv if lo <= d["n"] <= hi)) for lo, hi, r in faixas]

    leitores = max([m.get("leitores") or 0 for m in monok] or [0]) or 1
    leit_med = media([f["leitura_ms"] for f in lidas])
    cap_min = leitores * 60000 / leit_med if leit_med else 0
    cap_dia = cap_min * 60 * a.horas

    # ---- acurácia ----
    # Com sessões: a selfie tirada de uma foto tem que achar OUTRA foto da mesma sessão (como o cliente no quiosque).
    # Sem sessões: tem que achar a foto de onde o rosto saiu.
    sessao_de = {pid: e.get("sessao") for pid, e in env_de_pid.items() if e.get("sessao")}
    lida_em = {f["pid"]: f.get("lida") for f in lidas if f.get("rostos")}
    por_sessao = {}
    for pid, s_ in sessao_de.items():
        por_sessao.setdefault(s_, []).append(pid)
    modo_sessao = bool(sessao_de)
    sel_val = [s for s in sel if "erro" not in s and s.get("pid")]
    if modo_sessao:
        sel_val = [s for s in sel_val if s["pid"] in sessao_de
                   and any(p != s["pid"] and (lida_em.get(p) or 1e18) <= s["inicio"] for p in por_sessao[sessao_de[s["pid"]]])]
    casos = []
    for s in sel_val:
        res = {pid: sim for pid, sim in s.get("fotos") or []}
        if modo_sessao:
            mesma = [p for p in por_sessao[sessao_de[s["pid"]]] if p != s["pid"] and (lida_em.get(p) or 1e18) <= s["inicio"]]
            achadas = [p for p in mesma if p in res]
            certeza = [p for p in achadas if res[p] >= LIMITE]
            outras = [p for p, sim in res.items() if sim >= LIMITE and p != s["pid"] and sessao_de.get(p) and sessao_de.get(p) != sessao_de[s["pid"]]]
            casos.append({"s": s, "achou": bool(achadas), "certeza": bool(certeza), "frac": len(achadas) / len(mesma), "outras": outras})
        else:
            casos.append({"s": s, "achou": bool(s.get("achou")), "certeza": bool(s.get("achou")) and (s.get("semelhanca") or 0) >= LIMITE,
                          "frac": None, "outras": []})
    n_val = len(casos)
    n_achou = sum(1 for c in casos if c["achou"]); n_certeza = sum(1 for c in casos if c["certeza"])
    n_sem_rosto = sum(1 for c in casos if not c["s"].get("rosto"))
    n_nao = n_val - n_achou - n_sem_rosto
    n_estranho = sum(1 for c in casos if c["outras"])
    acerto = n_achou / n_val if n_val else None
    frac_med = media([c["frac"] for c in casos if c["frac"] is not None])
    pc = lambda n: fmt(100 * n / n_val if n_val else None, 1, "%")
    busca_ms = [s["ms"] for s in sel if "erro" not in s and s.get("ms")]
    sel_erros = sum(1 for s in sel if "erro" in s)

    # ---- quedas do Eterna (monitor sem resposta ou reinício) ----
    quedas_eterna, fora = [], None
    ult_ini = None
    for m in mon:
        if "erro" in m:
            fora = fora or m["t"]
            continue
        if fora or (ult_ini and m.get("iniciado") and m["iniciado"] != ult_ini):
            quedas_eterna.append({"de": fora or m.get("iniciado") or m["t"], "ate": m["t"], "reiniciou": bool(ult_ini and m.get("iniciado") != ult_ini)})
            fora = None
        ult_ini = m.get("iniciado") or ult_ini
    if fora:
        quedas_eterna.append({"de": fora, "ate": None, "reiniciou": False})
    voltou = all(q["ate"] for q in quedas_eterna)

    # ---- memória do Eterna ao longo do teste (vazamento) ----
    mem = [(m["t"], m["memoria_eterna_mb"]) for m in monok if m.get("memoria_eterna_mb")]
    cresc_mem = None
    if len(mem) > 20 and (mem[-1][0] - mem[0][0]) >= 3600:
        dez = max(1, len(mem) // 10)
        ini_m = media([y for _, y in mem[dez:2 * dez]]); fim_m = media([y for _, y in mem[-dez:]])   # pula o aquecimento
        cresc_mem = 100 * (fim_m - ini_m) / ini_m if ini_m else None

    # ---- máquina ----
    cpu = [m["cpu"] for m in monok if m.get("cpu") is not None]
    disco_w = [m["disco_escrita_mbs"] for m in monok if m.get("disco_escrita_mbs") is not None]
    disco_oc = [m["disco_ocupado_pct"] for m in monok if m.get("disco_ocupado_pct") is not None]
    rede_rx = [m["rede_rx_mbit"] for m in monok if m.get("rede_rx_mbit") is not None]
    livre = ([m.get("disco_livre_gb") for m in monok if m.get("disco_livre_gb") is not None] or [None])[-1]
    gb_dia = (media([e["bytes"] for e in ok]) or 0) * a.meta_dia / 1e9
    dias_disco = livre / gb_dia if livre and gb_dia else None

    # ---- projeção do índice em 60 dias, medida na máquina do Eterna ----
    rostos_foto = media([f["rostos"] for f in lidas]) or 2
    n_proj = int(rostos_foto * a.meta_dia * a.retencao)
    proj_p = os.path.join(a.saida, "projecao.json")
    try:
        proj = get_json(a.agente + "/rostos/projecao?n=%d" % n_proj, timeout=300)
        json.dump(proj, open(proj_p, "w", encoding="utf8"))
    except Exception:
        proj = json.load(open(proj_p, encoding="utf8")) if os.path.exists(proj_p) else {}

    # ---- degraus: até onde aguenta e o que estoura primeiro ----
    def gargalo(ms):
        c = media([m.get("cpu") for m in ms]); d = media([m.get("disco_ocupado_pct") for m in ms]); r = media([m.get("rede_rx_mbit") for m in ms])
        if c is not None and c >= 85:
            return "processador"
        if d is not None and d >= 80:
            return "disco"
        if r is not None and r >= .8 * a.link_mbit:
            return "rede"
        return "leitura de rostos (aumentar ETERNA_LEITORES)" if (c or 0) < 60 else "processador"
    tab_deg, quebra = [], None
    if par.get("degraus"):
        md = par["minutos_degrau"] * 60
        for i, k in enumerate(par["degraus"]):
            a0, a1 = t_ini + i * md, t_ini + (i + 1) * md
            es = [e for e in ok if e.get("degrau") == i]
            if not es:                                       # acabaram as sessões antes deste degrau
                continue
            ms = [m for m in monok if a0 <= m["t"] < a1]
            fs = [m.get("fila") or 0 for m in ms]
            terco = max(1, len(fs) // 3)
            crescendo = len(fs) >= 6 and media(fs[-terco:]) > media(fs[:terco]) * 1.5 + 2 * leitores
            esp = pct([f.get("espera_ms") for f in lidas if env_de_pid[f["pid"]].get("degrau") == i], 95)
            bs = pct([s["ms"] for s in sel if "erro" not in s and s.get("ms") and a0 <= s["inicio"] < a1], 95)
            quebrou = crescendo or (esp or 0) > a.alvo_pronto * 1000
            if quebrou and quebra is None:
                quebra = {"ritmo": k, "fotos_min": len(es) / (md / 60), "gargalo": gargalo(ms)}
            tab_deg.append((k, len(es) / (md / 60), max(fs or [0]), esp, bs, media([m.get("cpu") for m in ms]),
                            media([m.get("disco_ocupado_pct") for m in ms]), "Quebrou" if quebrou else "Aguentou"))

    # ---- por hora (resistência) ----
    tab_hora = []
    horas_n = int((t_fim - t_ini) // 3600) + 1
    if horas_n >= 2:
        for h in range(horas_n):
            a0, a1 = t_ini + h * 3600, t_ini + (h + 1) * 3600
            ms = [m for m in monok if a0 <= m["t"] < a1]
            tab_hora.append((h + 1, sum(1 for e in ok if a0 <= e["inicio"] < a1),
                             pct([f.get("espera_ms") for f in lidas if a0 <= f.get("chegada", 0) < a1], 95),
                             pct([s["ms"] for s in sel if "erro" not in s and s.get("ms") and a0 <= s["inicio"] < a1], 95),
                             max([m.get("memoria_eterna_mb") or 0 for m in ms] or [0]) or None,
                             max([m.get("banco_rostos_mb") or 0 for m in ms] or [0]) or None, media([m.get("cpu") for m in ms])))

    # ---- critérios de aprovação ----
    p95_pronto = pct(prontos, 95) if prontos else pct(ponta, 95)
    fila_fim = monok[-1].get("fila") if monok else None
    def crit(nome, alvo, valor, passou):
        return (nome, alvo, valor, "Não testado" if passou is None else ("Aprovado" if passou else "Reprovado"))
    criterios = [
        crit("Sessão pronta no checkout após o último clique (95% das sessões)", f"até {a.alvo_pronto:g} s", fmt(p95_pronto, 1, " s"),
             None if p95_pronto is None else p95_pronto <= a.alvo_pronto),
        crit("Tempo da busca por selfie no pior momento (95% das buscas)", f"até {a.alvo_busca:g} s", fmt(pct(busca_ms, 95) / 1000 if busca_ms else None, 2, " s"),
             None if not busca_ms else pct(busca_ms, 95) <= a.alvo_busca * 1000),
        crit("Acurácia do reconhecimento", f"pelo menos {a.meta_acerto:g}%", fmt(acerto * 100 if acerto is not None else None, 1, "%"),
             None if acerto is None else acerto * 100 >= a.meta_acerto),
        crit("Fotos perdidas", "nenhuma", f"{len(perdidas)} de {len(ok)}", None if not ok else not perdidas),
        crit("Fotos corrompidas ou pela metade na galeria", "nenhuma", str(len(corrompidas)), None if not tem_sha else not corrompidas),
        crit("Capacidade de leitura contra o pico da operação", f"pelo menos {fmt(pico_min, 0)} fotos/min", fmt(cap_min, 0, " fotos/min"),
             None if not lidas else cap_min >= pico_min),
        crit("Fila de leitura esvazia no fim", "volta a zero", fmt(fila_fim, 0, " fotos"), None if fila_fim is None else fila_fim <= leitores),
        crit("Memória do Eterna estável ao longo do dia", f"cresce no máximo {a.alvo_memoria:g}%", fmt(cresc_mem, 1, "%"),
             None if cresc_mem is None else cresc_mem <= a.alvo_memoria),
        crit("Volta sozinho depois de uma queda", "volta e não perde foto", (f"{len(quedas_eterna)} queda(s) · " + ("voltou" if voltou else "não voltou")) if quedas_eterna else "sem queda no teste",
             None if not quedas_eterna else voltou and not perdidas),
        crit("Foto cortada no envio é recusada e reenviada", "nenhuma entra pela metade", f"{quedas_sim} quedas simuladas · {incompletas} recusadas",
             None if not quedas_sim else (not corrompidas and not perdidas)),
        crit(f"Disco para {a.retencao} dias de fotos", f"{a.retencao} dias", fmt(dias_disco, 0, " dias"), None if dias_disco is None else dias_disco >= a.retencao),
        crit(f"Busca com {a.retencao} dias no índice ({fmt(n_proj, 0)} rostos)", f"até {a.alvo_busca:g} s", fmt(proj.get("busca_ms"), 0, " ms") + (f" · {fmt(proj.get('memoria_mb'), 0, ' MB')} de memória" if proj else ""),
             None if not proj.get("busca_ms") else proj["busca_ms"] <= a.alvo_busca * 1000),
    ]
    reprovados = [c for c in criterios if c[3] == "Reprovado"]
    aprovado = not reprovados and any(c[3] == "Aprovado" for c in criterios)
    veredito = ("Aprovado: o sistema aguenta a operação em todos os critérios medidos." if aprovado else
                "Reprovado em %d critério(s): %s." % (len(reprovados), "; ".join(c[0].lower() for c in reprovados)) if reprovados else
                "Sem dados suficientes para aprovar.")
    if quebra:
        veredito += f" Ponto de quebra: ritmo {fmt(quebra['ritmo'], 1)}x ({fmt(quebra['fotos_min'], 0)} fotos/min); gargalo: {quebra['gargalo']}."
    elif tab_deg:
        veredito += f" Aguentou todos os degraus, até {fmt(tab_deg[-1][0], 1)}x ({fmt(tab_deg[-1][1], 0)} fotos/min)."

    linhas = [
        ("Fotos enviadas", f"{len(ok)} ({len(err)} desistidas depois de reenviar)"),
        ("Sessões enviadas", f"{len(ens)} · {fmt(media([d['n'] for d in ens.values()]), 1)} fotos por sessão em média"),
        ("Volume enviado", fmt(sum(e["bytes"] for e in ok) / 1e9, 2, " GB") + f" · média {fmt(media([e['bytes'] for e in ok]) / 1e6 if ok else None, 1, ' MB')} por foto"),
        ("Duração do envio", fmt(dur_min, 1, " min")),
        ("Ritmo de envio", fmt(taxa_env, 1, " fotos/min") + f" · {fmt(sum(e['bytes'] for e in ok) * 8 / 1e6 / max(1e-9, t_fim - t_ini), 1, ' Mbit/s')} na rede"),
        ("Pico de envio (maior minuto)", f"{pico_obs} fotos/min"),
        ("Tempo de upload por foto (mediana / 95%)", f"{fmt(pct([e['seg'] for e in ok], 50), 2, ' s')} / {fmt(pct([e['seg'] for e in ok], 95), 2, ' s')}"),
        ("Velocidade por foto (mediana)", fmt(pct([e.get('mbps') for e in ok], 50), 1, " Mbit/s")),
        ("Fotos lidas pelo indexador", f"{len(lidas)} de {len(rec)} recebidas"),
        ("Ritmo do indexador no teste", fmt(taxa_leit, 1, " fotos/min") + f" com {leitores} leitores"),
        ("Capacidade do indexador", fmt(cap_min, 0, " fotos/min") + f" = {leitores} leitores / {fmt(leit_med, 0, ' ms')} por foto · {fmt(cap_dia, 0)} fotos em {fmt(a.horas, 0)} h"),
        ("Leitura de rostos por foto (mediana / 95%)", f"{fmt(pct([f['leitura_ms'] for f in lidas], 50), 0, ' ms')} / {fmt(pct([f['leitura_ms'] for f in lidas], 95), 0, ' ms')}"),
        ("Espera na fila (mediana / 95%)", f"{fmt(pct([f.get('espera_ms') for f in lidas], 50), 0, ' ms')} / {fmt(pct([f.get('espera_ms') for f in lidas], 95), 0, ' ms')}"),
        ("Do envio até ficar procurável (mediana / 95%)", f"{fmt(pct(ponta, 50), 1, ' s')} / {fmt(pct(ponta, 95), 1, ' s')}"),
        ("Sessão pronta para o checkout após o último clique (mediana / 95%)", f"{fmt(pct(prontos, 50), 1, ' s')} / {fmt(pct(prontos, 95), 1, ' s')} · {len(prontos)} de {len(ens)} sessões completas"),
        ("Maior fila de leitura", f"{fila_max} fotos"),
        ("Rostos por foto (média)", fmt(rostos_foto, 1)),
        ("Buscas por selfie", f"{len(busca_ms)} em {max([s.get('quiosque') or 1 for s in sel] or [1])} quiosque(s) ao mesmo tempo · {sel_erros} sem resposta"),
        ("Tempo da busca por selfie (mediana / 95% / pior)", f"{fmt(pct(busca_ms, 50), 0, ' ms')} / {fmt(pct(busca_ms, 95), 0, ' ms')} / {fmt(max(busca_ms) if busca_ms else None, 0, ' ms')}"),
    ]
    integ = [
        ("Fotos enviadas com sucesso", str(len(ok))),
        ("Chegaram íntegras (mesma assinatura do arquivo)" if tem_sha else "Chegaram (conferido pelo nome)", f"{len(rec)} ({fmt(100 * len(rec) / len(ok) if ok else None, 2, '%')})"),
        ("Perdidas (enviadas e não estão no Eterna)", str(len(perdidas))),
        ("Corrompidas ou pela metade", str(len(corrompidas)) if tem_sha else "–"),
        ("Recebidas em dobro (descartadas como repetidas)", str(n_dup)),
        ("Envios que precisaram de nova tentativa", str(reenvios)),
        ("Quedas simuladas no meio do envio / recusadas pelo Eterna", f"{quedas_sim} / {incompletas}"),
        (f"Envios desistidos (falharam por mais de {fmt(par.get('reenvio_min'), 0)} min)", str(len(err))),
    ]
    infra = [
        ("Processador (média / máxima / núcleo mais cheio)", f"{fmt(media(cpu), 0, '%')} / {fmt(max(cpu) if cpu else None, 0, '%')} / {fmt(max([m.get('cpu_nucleo_max') or 0 for m in monok] or [0]) or None, 0, '%')}"),
        ("Memória da máquina (máxima)", fmt(max([m.get('memoria') or 0 for m in monok] or [0]) or None, 0, "%")),
        ("Memória do Eterna (início / máxima / fim)", f"{fmt(mem[0][1] if mem else None, 0, ' MB')} / {fmt(max(y for _, y in mem) if mem else None, 0, ' MB')} / {fmt(mem[-1][1] if mem else None, 0, ' MB')}"),
        ("Banco de rostos no fim", fmt(([m.get('banco_rostos_mb') for m in monok if m.get('banco_rostos_mb')] or [None])[-1], 1, " MB")),
        ("Gravação em disco (média / máxima)", f"{fmt(media(disco_w), 1, ' MB/s')} / {fmt(max(disco_w) if disco_w else None, 1, ' MB/s')}"),
        ("Disco ocupado (média / máxima)", f"{fmt(media(disco_oc), 0, '%')} / {fmt(max(disco_oc) if disco_oc else None, 0, '%')}"),
        ("Rede recebendo (média / máxima)", f"{fmt(media(rede_rx), 1, ' Mbit/s')} / {fmt(max(rede_rx) if rede_rx else None, 1, ' Mbit/s')} de {a.link_mbit} Mbit/s"),
        ("Disco livre no fim", fmt(livre, 1, " GB") + f" · {fmt(gb_dia, 0, ' GB')} por dia de {a.meta_dia:,} fotos".replace(",", ".")),
        ("Tempo de resposta do Eterna ao monitor (mediana / pior)", f"{fmt(pct([m.get('resposta_ms') for m in monok], 50), 0, ' ms')} / {fmt(max([m.get('resposta_ms') or 0 for m in monok] or [0]), 0, ' ms')}"),
        ("Quedas do Eterna", "; ".join(f"{datetime.fromtimestamp(q['de']):%H:%M:%S} por {fmt((q['ate'] - q['de']) if q['ate'] else None, 0, ' s')}{' (reiniciou)' if q['reiniciou'] else ''}" + ("" if q["ate"] else " (não voltou)") for q in quedas_eterna) or "nenhuma"),
    ]

    tr = lambda rows: "".join(f"<tr><th>{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in rows)
    cor_st = {"Aprovado": "var(--ok)", "Reprovado": "var(--bad)", "Não testado": "var(--mu)", "Aguentou": "var(--ok)", "Quebrou": "var(--bad)"}
    tab_crit = "".join(f"<tr><td>{esc(n)}</td><td>{esc(al)}</td><td>{esc(v)}</td><td style='color:{cor_st[s_]};font-weight:600'>{s_}</td></tr>" for n, al, v, s_ in criterios)
    por_fot = {}
    for e in ok:
        d = por_fot.setdefault(e["fotografo"], [0, 0, [], 0]); d[0] += 1; d[1] += e["bytes"]; d[2].append(e["seg"]); d[3] += e.get("tentativas", 1) > 1
    tabf = "".join(f"<tr><td>{esc(k)}</td><td>{v[0]}</td><td>{fmt(v[1] / 1e6, 0, ' MB')}</td><td>{fmt(pct(v[2], 50), 2, ' s')}</td><td>{fmt(pct(v[2], 95), 2, ' s')}</td><td>{v[3]}</td></tr>" for k, v in sorted(por_fot.items()))
    html_deg = ""
    if tab_deg:
        html_deg = ("<h2>Ponto de quebra (degraus de ritmo)</h2><table><tr><th>Ritmo</th><th>Fotos/min</th><th>Maior fila</th><th>Espera 95%</th><th>Busca 95%</th><th>Processador</th><th>Disco ocupado</th><th>Resultado</th></tr>"
                    + "".join(f"<tr><td>{fmt(k, 1)}x</td><td>{fmt(fm, 0)}</td><td>{fl}</td><td>{fmt(es / 1000 if es else None, 1, ' s')}</td><td>{fmt(bs, 0, ' ms')}</td><td>{fmt(c, 0, '%')}</td><td>{fmt(d, 0, '%')}</td>"
                              f"<td style='color:{cor_st[r]};font-weight:600'>{r}</td></tr>" for k, fm, fl, es, bs, c, d, r in tab_deg) + "</table>")
    html_hora = ""
    if tab_hora:
        html_hora = ("<h2>Hora a hora (resistência)</h2><table><tr><th>Hora</th><th>Fotos</th><th>Espera 95%</th><th>Busca 95%</th><th>Memória do Eterna</th><th>Banco de rostos</th><th>Processador</th></tr>"
                     + "".join(f"<tr><td>{h}ª</td><td>{n}</td><td>{fmt(es / 1000 if es else None, 1, ' s')}</td><td>{fmt(bs, 0, ' ms')}</td><td>{fmt(me, 0, ' MB')}</td><td>{fmt(bd, 1, ' MB')}</td><td>{fmt(c, 0, '%')}</td></tr>"
                               for h, n, es, bs, me, bd, c in tab_hora) + "</table>")
    # casos para conferir no olho: selfies que trouxeram foto de outra sessão (pode ser a mesma pessoa em duas sessões, ou erro)
    conferir = [c for c in casos if c["outras"]][:12]
    html_conf = ""
    if conferir:
        img = lambda pid: f'<img src="{a.agente}/thumb/{pid}" loading="lazy" alt="">'
        html_conf = ("<h2>Para conferir no olho: fotos de outra sessão no resultado</h2><p class='mu'>Primeira foto: de onde saiu a selfie. Depois: fotos de outras sessões que a busca trouxe com certeza. "
                     "Se for a mesma pessoa (ex.: a família voltou), não é erro.</p>"
                     + "".join(f"<div class='conf'>{img(c['s']['pid'])}<span>→</span>{''.join(img(p) for p in c['outras'][:5])}</div>" for c in conferir))
    pts_fila = [(m["t"], m.get("fila") or 0) for m in monok]
    graf_fila = grafico([("fila de leitura", "#134078", pts_fila)], "Fila de leitura", "fotos", t_ini)
    graf_mem = grafico([("memória do Eterna", "#B07800", mem)], "Memória do Eterna", "MB", t_ini)
    graf_maq = grafico([("processador %", "#134078", [(m["t"], m["cpu"]) for m in monok if m.get("cpu") is not None]),
                        ("disco ocupado %", "#b3261e", [(m["t"], m["disco_ocupado_pct"]) for m in monok if m.get("disco_ocupado_pct") is not None])], "Máquina", "%", t_ini)
    cab = (f"{datetime.fromtimestamp(t_ini):%d/%m/%Y %H:%M} · meta {a.meta_dia:,} fotos/dia em {fmt(a.horas, 0)} h · {par.get('fotografos', '?')} fotógrafos".replace(",", ".")
           + (f" · {par['sessoes']} sessões reais" if par.get("sessoes") else f" · ensaios de {'-'.join(str(x) for x in par.get('fotos_ensaio', [])) or '?'} fotos")
           + f" em {'-'.join(fmt(x, 1) for x in par.get('duracao_ensaio', [])) or '?'} min"
           + (f" · degraus {', '.join(fmt(x, 1) + 'x' for x in par['degraus'])} de {fmt(par['minutos_degrau'], 0)} min" if par.get("degraus") else
              (f" · tempo acelerado {fmt(par['acelerar'], 1)}x" if par.get("acelerar", 1) != 1 else ""))
           + (f" · rajada a cada {fmt(par['rajada_a_cada'], 0)} min" if par.get("rajada_a_cada") else ""))
    ac_cor = "var(--ok)" if acerto is not None and acerto * 100 >= a.meta_acerto else "var(--bad)"
    def_ac = ("selfie tirada de uma foto encontrou outra foto da mesma sessão" if modo_sessao else "selfie encontrou a foto de onde o rosto saiu")
    html = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teste de estanque Eterna</title><style>
:root{{--fg:#0C2340;--mu:#5b6573;--bg:#fff;--line:#e3e6eb;--ac:#134078;--ok:#005500;--bad:#b3261e}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,Segoe UI,Arial,sans-serif}}main{{max-width:960px;margin:0 auto;padding:24px 16px}}
h1{{font-size:26px;margin:0 0 4px}}h2{{margin-top:32px}}.mu{{color:var(--mu)}}table{{width:100%;border-collapse:collapse;margin:14px 0}}th,td{{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{font-weight:600}}.kv th{{width:52%}}.v{{padding:14px 16px;border-radius:10px;color:#fff;background:{'var(--ok)' if aprovado else 'var(--bad)'};font-weight:600}}
.ac{{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:6px 0}}.ac b{{font-size:56px;line-height:1}}
.conf{{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0}}.conf img{{height:90px;border-radius:6px}}
.tw{{overflow-x:auto}}svg{{width:100%;height:auto;border:1px solid var(--line);border-radius:8px}}</style></head><body><main>
<h1>Teste de estanque do Eterna</h1><div class="mu">{esc(cab)}</div>
<p class="v">{esc(veredito)}</p>
<h2>Critérios de aprovação</h2><div class="tw"><table><tr><th>Critério</th><th>Alvo</th><th>Medido</th><th>Resultado</th></tr>{tab_crit}</table></div>
<h2>Acurácia do reconhecimento</h2>
<p class="ac"><b style="color:{ac_cor}">{fmt(acerto * 100 if acerto is not None else None, 1, '%')}</b>
<span>{n_achou} de {n_val} selfies encontraram a pessoa · meta {fmt(a.meta_acerto, 0, '%')}</span></p>
<p class="mu">Acerto = {def_ac}.</p>
<table class="kv"><tr><th>Encontrou com certeza</th><td>{n_certeza} ({pc(n_certeza)})</td></tr>
<tr><th>Encontrou perguntando "é uma destas?"</th><td>{n_achou - n_certeza} ({pc(n_achou - n_certeza)})</td></tr>
<tr><th>Não encontrou</th><td>{n_nao} ({pc(n_nao)})</td></tr>
<tr><th>Não viu rosto na selfie</th><td>{n_sem_rosto} ({pc(n_sem_rosto)})</td></tr>
{f"<tr><th>Fotos da sessão trazidas pela selfie (média)</th><td>{fmt(frac_med * 100 if frac_med is not None else None, 1, '%')} (numa família, a selfie de um traz as fotos em que ele aparece)</td></tr>" if modo_sessao else ""}
{f"<tr><th>Selfies que trouxeram foto de outra sessão</th><td>{n_estranho} ({pc(n_estranho)}) · conferir abaixo</td></tr>" if modo_sessao else ""}</table>
<h2>Sessões</h2><p class="mu">{len(sv)} sessões · {sum(d["n"] for d in sv)} cliques.</p>
<div class="tw"><table><tr><th>Medida</th><th>Média</th><th>Mediana</th><th>Menor</th><th>Maior</th></tr>{"".join(f"<tr><td>{esc(n)}</td>" + "".join(f"<td>{x}</td>" for x in v) + "</tr>" for n, v in tab_sess)}</table></div>
<div class="tw"><table><tr><th>Cliques na sessão</th><th>Sessões</th><th>% das sessões</th><th>Fotos</th></tr>{"".join(f"<tr><td>{r}</td><td>{n}</td><td>{fmt(100 * n / len(sv) if sv else None, 1, '%')}</td><td>{f}</td></tr>" for r, n, f in dist)}</table></div>
<h2>Integridade das fotos</h2><table class="kv">{tr(integ)}</table>
{html_deg}
<h2>Operação</h2><table class="kv">{tr(linhas)}</table>
{html_hora}
<h2>Máquina do Eterna</h2><table class="kv">{tr(infra)}</table>
<h3>Fila de leitura</h3>{graf_fila}
<h3>Memória do Eterna</h3>{graf_mem}
<h3>Processador e disco</h3>{graf_maq}
<h2>Por fotógrafo simulado</h2><div class="tw"><table><tr><th>Fotógrafo</th><th>Fotos</th><th>Volume</th><th>Upload mediano</th><th>Upload 95%</th><th>Reenvios</th></tr>{tabf}</table></div>
{html_conf}
<p class="mu">Arquivos brutos nesta pasta: envios.jsonl, selfies.jsonl, monitor.jsonl, metricas-eterna.json, projecao.json.</p></main></body></html>"""
    out = os.path.join(a.saida, "relatorio.html")
    open(out, "w", encoding="utf8").write(html)
    print(veredito)
    for n, al, v, s_ in criterios:
        print(f"  {s_:<12} {n}: {v}")
    print("relatório:", out)


def main():
    ap = argparse.ArgumentParser(description="Eterna · teste de estanque")
    sp = ap.add_subparsers(dest="cmd", required=True)
    e = sp.add_parser("enviar"); e.add_argument("--host", required=True); e.add_argument("--porta", type=int, default=21)
    e.add_argument("--usuario", required=True); e.add_argument("--fotos", required=True); e.add_argument("--fotografos", type=int, default=7)
    e.add_argument("--sessoes", action="store_true", help="cada pasta com fotos é uma sessão real (um ensaio), mandada uma vez")
    e.add_argument("--meta-dia", type=int, default=15000); e.add_argument("--horas", type=float, default=8)
    e.add_argument("--fotos-ensaio", type=int, nargs=2, default=[10, 20], metavar=("MIN", "MAX"))
    e.add_argument("--duracao-ensaio", type=float, nargs=2, default=[1.5, 2.5], metavar=("MIN", "MAX"), help="minutos")
    e.add_argument("--acelerar", type=float, default=1, help="2 = o mesmo dia na metade do tempo"); e.add_argument("--minutos", type=float, default=30)
    e.add_argument("--degraus", help="ex.: 1,1.5,2,3,4 (sobe o ritmo a cada --minutos-degrau)"); e.add_argument("--minutos-degrau", type=float, default=10)
    e.add_argument("--rajada-a-cada", type=float, default=0, help="minutos; todos os fotógrafos começam um ensaio juntos")
    e.add_argument("--quedas", type=float, default=0, help="fração dos envios que cai no meio (0.01 = 1%%)")
    e.add_argument("--cliques-reais", action=argparse.BooleanOptionalAction, default=True, help="nas sessões, usa a hora de cada clique gravada na foto")
    e.add_argument("--duracao-max", type=float, default=10, help="minutos; sessão real mais longa que isso é encurtada")
    e.add_argument("--reenvio-min", type=float, default=10, help="por quanto tempo uma foto que falhou é tentada de novo")
    e.add_argument("--limite-gb", type=float, help="para depois de mandar este volume")
    e.add_argument("--pasta-por-fotografo", action=argparse.BooleanOptionalAction, default=True, help="cada fotógrafo numa pasta do FTP (padrão)")
    s = sp.add_parser("selfies"); s.add_argument("--agente", required=True); s.add_argument("--por-minuto", type=float, default=20); s.add_argument("--minutos", type=float, default=10)
    s.add_argument("--paralelo", type=int, default=1, help="quiosques buscando ao mesmo tempo"); s.add_argument("--dias", type=int, default=1, help="dias de fotos na busca (galeria online: 60)")
    m = sp.add_parser("monitorar"); m.add_argument("--agente", required=True); m.add_argument("--minutos", type=float, default=12)
    r = sp.add_parser("relatorio"); r.add_argument("--agente", default="http://127.0.0.1:8765"); r.add_argument("--meta-dia", type=int, default=15000)
    r.add_argument("--horas", type=float, default=8, help="horas de operação por dia"); r.add_argument("--pico", type=float, default=1.7, help="pico / média: ensaios de vários fotógrafos ao mesmo tempo")
    r.add_argument("--meta-acerto", type=float, default=90); r.add_argument("--alvo-pronto", type=float, default=60, help="segundos")
    r.add_argument("--alvo-busca", type=float, default=3, help="segundos"); r.add_argument("--alvo-memoria", type=float, default=20, help="%% de crescimento aceito")
    r.add_argument("--retencao", type=int, default=60, help="dias de fotos e rostos guardados"); r.add_argument("--link-mbit", type=float, default=1000, help="velocidade da rede do servidor")
    for x in (e, s, m, r):
        x.add_argument("--saida", default="./teste-carga")
    a = ap.parse_args()
    if getattr(a, "agente", None):
        a.agente = a.agente.rstrip("/")
    {"enviar": enviar, "selfies": selfies, "monitorar": monitorar, "relatorio": relatorio}[a.cmd](a)


if __name__ == "__main__":
    main()
