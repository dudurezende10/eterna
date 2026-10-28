#!/usr/bin/env python3
"""Eterna · teste de carga da operação.

Quatro papéis, cada um pode rodar numa máquina diferente; todos gravam na pasta --saida
(arquivos .jsonl) e o relatório junta tudo no fim.

  enviar     Transferidor: simula os fotógrafos mandando fotos por FTP (como o Canon CTP).
             Cada envio é uma foto única (mesma imagem, bytes diferentes), para o Eterna não
             descartar como repetida. Anota tamanho, tempo e velocidade de cada arquivo.
  selfies    Testador de selfie: pega fotos que o Eterna já leu, recorta um rosto, deixa com
             cara de câmera de quiosque (menor, outra luz) e busca no Eterna. Anota se achou a
             foto de origem, em que posição e em quanto tempo.
  monitorar  Monitor: a cada 2 s anota fila de leitura, fotos lidas, CPU, memória e disco do Eterna.
  relatorio  Junta os arquivos + as métricas do Eterna (/metricas) num relatório HTML.

O indexador é o próprio agente do Eterna (eterna-agente.py): recebe por FTP, lê os rostos e
monta o índice. Para mais velocidade: ETERNA_LEITORES=4 python3 eterna-agente.py

Exemplos (a senha do FTP é pedida na tela ou lida de ETERNA_FTP_SENHA, nunca vai para arquivo):
  python3 teste-carga.py enviar --host 192.168.10.218 --usuario carlos --fotos ./fotos \\
          --fotografos 5 --ritmo 12 --minutos 10 --saida ./teste
  python3 teste-carga.py selfies --agente http://192.168.10.218:8765 --por-minuto 20 --minutos 10 --saida ./teste
  python3 teste-carga.py monitorar --agente http://192.168.10.218:8765 --minutos 12 --saida ./teste
  python3 teste-carga.py relatorio --agente http://192.168.10.218:8765 --meta-dia 30000 --saida ./teste

Requisitos: Python 3.9+. O testador de selfie precisa de OpenCV (pip install opencv-python-headless numpy)
e dos modelos em ~/Eterna/modelos (o agente baixa na primeira vez).
"""
import argparse, base64, ftplib, getpass, glob, io, json, os, random, socket, statistics, sys, threading, time, urllib.request
from datetime import datetime

MODELOS = os.path.join(os.path.expanduser("~/Eterna"), "modelos")


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
def enviar(a):
    jpg = lambda d: sorted((f for f in glob.glob(os.path.join(d, "**", "*"), recursive=True) if f.lower().endswith((".jpg", ".jpeg"))),
                           key=lambda f: (os.path.getmtime(f), f))          # ordem em que a câmera gravou
    subs = sorted(d for d in glob.glob(os.path.join(a.fotos, "*")) if os.path.isdir(d) and jpg(d))
    # uma subpasta por fotógrafo/câmera: cada fotógrafo simulado manda só as fotos dela, na ordem dos cliques
    cameras = [(os.path.basename(d), jpg(d)) for d in subs] if subs else [(None, jpg(a.fotos))]
    if not any(c[1] for c in cameras):
        sys.exit("nenhuma foto .jpg em " + a.fotos)
    fotos = [f for _, l in cameras for f in l]
    senha = os.environ.get("ETERNA_FTP_SENHA") or getpass.getpass(f"senha FTP de {a.usuario}@{a.host}: ")
    cache = {}
    def ler(f):
        if f not in cache:
            cache[f] = open(f, "rb").read()
        return cache[f]
    dados = [ler(f) for f in fotos[:50]]
    fmin, fmax = a.fotos_ensaio; dmin, dmax = a.duracao_ensaio
    por_min = a.meta_dia / (a.fotografos * a.horas * 60)            # fotos/min por fotógrafo para fechar a meta
    ciclo = ((fmin + fmax) / 2) / por_min                            # minutos entre o início de um ensaio e o do próximo
    pausa = max(0.2, ciclo - (dmin + dmax) / 2)                      # troca de família
    k = a.acelerar
    fim = agora() + a.minutos * 60
    rodada = datetime.now().strftime("%H%M%S")
    print(f"operação simulada: {a.fotografos} fotógrafos · ensaios de {fmin}-{fmax} fotos em {dmin}-{dmax} min · pausa média {pausa:.1f} min"
          f" · {por_min * a.fotografos * k:.0f} fotos/min no total (meta {a.meta_dia:,}/dia em {a.horas} h{', acelerado %gx' % k if k != 1 else ''})"
          f" · {a.minutos} min de teste ≈ {por_min * a.fotografos * k * a.minutos:.0f} fotos · base: {len(fotos)} imagens, média {statistics.mean(len(d) for d in dados) / 1e6:.1f} MB")
    tot = {"ok": 0, "erro": 0, "bytes": 0, "ensaios": 0}

    def fotografo(i):
        cam_nome, cam_fotos = cameras[i % len(cameras)]
        volta_cam = i // len(cameras)                                 # mais fotógrafos que pastas: dividem a câmera, cada um na sua pasta
        nome_fot = (cam_nome + (f"-{volta_cam + 1}" if volta_cam else "")) if cam_nome else f"fot{i + 1}"
        if not subs:                                                  # sem subpastas: divide as fotos entre os fotógrafos
            cam_fotos = cam_fotos[i::a.fotografos] or cam_fotos
        else:
            dividem = len(range(i % len(cameras), a.fotografos, len(cameras)))
            cam_fotos = cam_fotos[volta_cam::dividem] or cam_fotos
        ftp = None
        n = 0
        ens = 0
        time.sleep(random.uniform(0, ciclo * 60 / k))                # cada um começa num momento diferente
        while agora() < fim:
            ens += 1; tot["ensaios"] += 1
            nf = random.randint(fmin, fmax); dur = random.uniform(dmin, dmax) * 60 / k
            ini = agora()
            for j in range(nf):
                alvo = ini + dur * j / max(1, nf - 1) + random.uniform(-.15, .15) * dur / nf
                if agora() >= fim:
                    break
                if alvo > agora():
                    time.sleep(alvo - agora())
                n += 1
                orig = cam_fotos[(n - 1) % len(cam_fotos)]
                volta = (n - 1) // len(cam_fotos)
                corpo = ler(orig) + (os.urandom(16) if volta else b"")       # repetindo a pasta: bytes no fim do JPEG, arquivo único
                base, ext = os.path.splitext(os.path.basename(orig))
                arq = f"{base}{'_r%d' % (volta + 1) if volta else ''}{ext}"  # nome que a câmera deu
                t0 = agora()
                lin = {"arquivo": arq, "origem": orig, "fotografo": nome_fot, "ensaio": f"{nome_fot}-{ens}", "foto_do_ensaio": j + 1, "fotos_no_ensaio": nf,
                       "bytes": len(corpo), "inicio": t0}
                try:
                    if ftp is None:
                        ftp = ftplib.FTP(); ftp.connect(a.host, a.porta, timeout=60); ftp.login(a.usuario, senha); ftp.set_pasv(True)
                        if a.pasta_por_fotografo:                         # como o CTP: cada fotógrafo na sua pasta do servidor
                            try:
                                ftp.mkd(nome_fot)
                            except Exception:
                                pass
                            ftp.cwd(nome_fot)
                    ftp.storbinary("STOR " + arq, io.BytesIO(corpo), blocksize=256 * 1024)
                    dt = agora() - t0
                    lin.update(seg=round(dt, 3), mbps=round(len(corpo) * 8 / 1e6 / dt, 1) if dt else None, ok=True)
                    tot["ok"] += 1; tot["bytes"] += len(corpo)
                except Exception as ex:
                    lin.update(seg=round(agora() - t0, 3), ok=False, erro=str(ex)[:200]); tot["erro"] += 1
                    try:
                        ftp.close()
                    except Exception:
                        pass
                    ftp = None
                grava(a.saida, "envios.jsonl", lin)
            time.sleep(max(0, random.uniform(.6, 1.4) * pausa * 60 / k - 0))
        try:
            ftp.quit()
        except Exception:
            pass

    ths = [threading.Thread(target=fotografo, args=(i,), daemon=True) for i in range(a.fotografos)]
    for t in ths:
        t.start()
    while any(t.is_alive() for t in ths):
        time.sleep(10)
        print(f"  {datetime.now():%H:%M:%S}  ensaios {tot['ensaios']}  fotos {tot['ok']}  erros {tot['erro']}  {tot['bytes'] / 1e6:.0f} MB")
    print("fim do envio:", tot)
    json.dump({"meta_dia": a.meta_dia, "horas": a.horas, "fotografos": a.fotografos, "fotos_ensaio": a.fotos_ensaio,
               "duracao_ensaio": a.duracao_ensaio, "acelerar": k, "pausa_min": round(pausa, 2)},
              open(os.path.join(a.saida, "parametros.json"), "w", encoding="utf8"))


LIMITE = 0.45  # mesma semelhança mínima do Eterna para "é a pessoa"; abaixo disso ele pergunta

# ---------- testador de selfie ----------
def selfies(a):
    import cv2, numpy as np
    det = cv2.FaceDetectorYN.create(os.path.join(MODELOS, "face_detection_yunet_2023mar.onnx"), "", (320, 320), 0.7, 0.3, 5000)
    fim = agora() + a.minutos * 60
    intervalo = 60.0 / a.por_minuto
    vistos = set()
    print(f"testando selfies: {a.por_minuto}/min por {a.minutos} min em {a.agente}")
    while agora() < fim:
        t_ciclo = agora()
        try:
            m = get_json(a.agente + "/metricas?desde=%f" % (agora() - 3600))
            prontas = [f for f in m["fotos"] if f.get("rostos") and f["pid"] not in vistos]
        except Exception as ex:
            print("  sem resposta do Eterna:", ex); time.sleep(5); continue
        if not prontas:
            time.sleep(2); continue
        f = random.choice(prontas[-200:])
        vistos.add(f["pid"])
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
            corpo = json.dumps({"imagens": ["data:image/jpeg;base64," + base64.b64encode(jpg.tobytes()).decode()]}).encode()
            t0 = agora()
            req = urllib.request.Request(a.agente + "/rostos/buscar", data=corpo, headers={"Content-Type": "application/json"})
            r = json.loads(urllib.request.urlopen(req, timeout=60).read().decode())
            dt = agora() - t0
            ids = [x["id"] for x in r.get("fotos", [])]
            sim = next((x["sim"] for x in r.get("fotos", []) if x["id"] == f["pid"]), None)
            grava(a.saida, "selfies.jsonl", {"pid": f["pid"], "inicio": t0, "ms": round(dt * 1000, 1), "rosto": r.get("rosto"),
                                              "achou": f["pid"] in ids, "posicao": ids.index(f["pid"]) + 1 if f["pid"] in ids else None,
                                              "semelhanca": sim, "resultados": len(ids), "selfie_kb": round(len(jpg) / 1024)})
        except Exception as ex:
            grava(a.saida, "selfies.jsonl", {"pid": f["pid"], "inicio": agora(), "erro": str(ex)[:200]})
        time.sleep(max(0, intervalo - (agora() - t_ciclo)))
    print("fim do teste de selfie:", len(le(a.saida, "selfies.jsonl")), "buscas")


# ---------- monitor ----------
def monitorar(a):
    fim = agora() + a.minutos * 60
    while agora() < fim:
        t0 = agora()
        try:
            st = get_json(a.agente + "/status", timeout=10)
            m = get_json(a.agente + "/metricas?desde=%f" % (agora() + 1), timeout=10)
            r = st.get("rostos") or {}
            grava(a.saida, "monitor.jsonl", {"t": t0, "recebidas": st.get("copied"), "repetidas": st.get("dups"), "lidas": r.get("lidas"),
                                              "fila": r.get("fila"), "leitores": r.get("leitores"), "ftp_recebidas": (st.get("ftp") or {}).get("received"),
                                              "resposta_ms": round((agora() - t0) * 1000, 1), **(m.get("maquina") or {})})
        except Exception as ex:
            grava(a.saida, "monitor.jsonl", {"t": t0, "erro": str(ex)[:200]})
        time.sleep(max(0, 2 - (agora() - t0)))


# ---------- relatório ----------
def pct(v, p):
    v = sorted(x for x in v if x is not None)
    if not v:
        return None
    return v[min(len(v) - 1, int(round(p / 100 * (len(v) - 1))))]


def fmt(x, casas=1, suf=""):
    return "–" if x is None else f"{x:,.{casas}f}{suf}".replace(",", "X").replace(".", ",").replace("X", ".")


def relatorio(a):
    env = le(a.saida, "envios.jsonl"); sel = le(a.saida, "selfies.jsonl"); mon = le(a.saida, "monitor.jsonl")
    try:
        met = get_json(a.agente + "/metricas?desde=%f" % (min([e["inicio"] for e in env] or [0]) - 5), timeout=60)
        json.dump(met, open(os.path.join(a.saida, "metricas-eterna.json"), "w", encoding="utf8"))
    except Exception:
        p = os.path.join(a.saida, "metricas-eterna.json")
        met = json.load(open(p, encoding="utf8")) if os.path.exists(p) else {"fotos": []}
    # cada envio casa com a foto recebida pelo par (fotógrafo, nome do arquivo); sem pasta por fotógrafo, só pelo nome
    chave_env = lambda e: (e["fotografo"], e["arquivo"])
    env_por = {chave_env(e): e for e in env if e["ok"]}
    so_nome = {e["arquivo"]: e for e in env if e["ok"]}
    def envio_de(f):
        return env_por.get((f.get("quem"), f["nome"])) or so_nome.get(f["nome"])
    rec = [f for f in met["fotos"] if not f.get("dup") and envio_de(f)]
    ok = [e for e in env if e["ok"]]; err = [e for e in env if not e["ok"]]
    t_ini = min([e["inicio"] for e in env] or [0]); t_fim = max([e["inicio"] + e["seg"] for e in env] or [1])
    dur_min = max(1e-9, (t_fim - t_ini) / 60)
    lidas = [f for f in rec if f.get("lida")]
    ponta = []
    for f in lidas:
        e = envio_de(f)
        if e:
            ponta.append(f["lida"] - e["inicio"])                # clique enviado -> foto procurável pelo rosto
    fim_leit = max([f["lida"] for f in lidas] or [t_fim])
    taxa_env = len(ok) / dur_min
    taxa_leit = len(lidas) / max(1e-9, (fim_leit - t_ini) / 60)
    fila_max = max([m.get("fila") or 0 for m in mon] or [0])
    sel_ok = [s for s in sel if "erro" not in s and s.get("rosto")]
    # acurácia = selfies que encontraram a pessoa / todas as selfies testadas (só erro de rede fica de fora;
    # selfie em que o Eterna não viu rosto conta como falha, porque o cliente sairia sem as fotos)
    sel_val = [s for s in sel if "erro" not in s]
    n_achou = sum(1 for s in sel_val if s.get("achou"))
    n_certeza = sum(1 for s in sel_val if s.get("achou") and (s.get("semelhanca") or 0) >= LIMITE)
    n_sem_rosto = sum(1 for s in sel_val if not s.get("rosto"))
    acerto = (n_achou / len(sel_val)) if sel_val else None
    meta_min = a.meta_dia / (a.horas * 60)
    pico_min = meta_min * a.pico
    # pico observado: maior número de fotos enviadas em 1 minuto
    tempos = sorted(e["inicio"] for e in ok)
    pico_obs, j = 0, 0
    for i_, t in enumerate(tempos):
        while tempos[j] < t - 60:
            j += 1
        pico_obs = max(pico_obs, i_ - j + 1)
    pico_min = max(pico_min, pico_obs)
    # ensaio pronto para o checkout: do último clique enviado até a última foto do ensaio ficar procurável
    lida_por_envio = {}
    for f in rec:
        e = envio_de(f)
        if e:
            lida_por_envio[chave_env(e)] = f.get("lida")
    ens = {}
    for e in ok:
        if "ensaio" in e:
            d = ens.setdefault(e["ensaio"], {"ult": 0, "lidas": [], "n": 0}); d["n"] += 1
            d["ult"] = max(d["ult"], e["inicio"] + e["seg"]); d["lidas"].append(lida_por_envio.get(chave_env(e)))
    prontos = [max(d["lidas"]) - d["ult"] for d in ens.values() if d["lidas"] and all(d["lidas"])]
    par_p = os.path.join(a.saida, "parametros.json")
    par = json.load(open(par_p, encoding="utf8")) if os.path.exists(par_p) else {}
    # capacidade real: leitores em paralelo / tempo de leitura (o ritmo lido só mostra o que chegou)
    leitores = max([m.get("leitores") or 0 for m in mon] or [0]) or 1
    leit_med = statistics.mean([f["leitura_ms"] for f in lidas]) if lidas else None
    cap_min = leitores * 60000 / leit_med if leit_med else 0
    cap_dia = cap_min * 60 * a.horas
    aguenta = cap_min >= pico_min and (pct(prontos, 95) or pct(ponta, 95) or 0) <= 60 and not err
    linhas = [
        ("Fotos enviadas", f"{len(ok)} ({len(err)} com erro)"),
        ("Volume enviado", fmt(sum(e["bytes"] for e in ok) / 1e9, 2, " GB") + f" · média {fmt(statistics.mean([e['bytes'] for e in ok]) / 1e6 if ok else None, 1, ' MB')} por foto"),
        ("Duração do envio", fmt(dur_min, 1, " min")),
        ("Ritmo de envio", fmt(taxa_env, 1, " fotos/min") + f" · {fmt(sum(e['bytes'] for e in ok) * 8 / 1e6 / max(1e-9, t_fim - t_ini), 1, ' Mbit/s')} na rede"),
        ("Tempo de upload por foto (mediana / 95%)", f"{fmt(pct([e['seg'] for e in ok], 50), 2, ' s')} / {fmt(pct([e['seg'] for e in ok], 95), 2, ' s')}"),
        ("Velocidade por foto (mediana)", fmt(pct([e['mbps'] for e in ok], 50), 1, " Mbit/s")),
        ("Fotos lidas pelo indexador", f"{len(lidas)} de {len(rec)} recebidas"),
        ("Ritmo do indexador no teste", fmt(taxa_leit, 1, " fotos/min") + f" (acompanhou a chegada) com {leitores} leitores"),
        ("Capacidade do indexador", fmt(cap_min, 0, " fotos/min") + f" = {leitores} leitores / {fmt(leit_med, 0, ' ms')} por foto"),
        ("Leitura de rostos por foto (mediana / 95%)", f"{fmt(pct([f['leitura_ms'] for f in lidas], 50), 0, ' ms')} / {fmt(pct([f['leitura_ms'] for f in lidas], 95), 0, ' ms')}"),
        ("Espera na fila (mediana / 95%)", f"{fmt(pct([f.get('espera_ms') for f in lidas], 50), 0, ' ms')} / {fmt(pct([f.get('espera_ms') for f in lidas], 95), 0, ' ms')}"),
        ("Do envio até ficar procurável (mediana / 95%)", f"{fmt(pct(ponta, 50), 1, ' s')} / {fmt(pct(ponta, 95), 1, ' s')}"),
        ("Ensaios simulados", f"{len(ens)} · {fmt(statistics.mean([d['n'] for d in ens.values()]) if ens else None, 1)} fotos por ensaio em média"),
        ("Pico de envio (maior minuto)", f"{pico_obs} fotos/min"),
        ("Ensaio pronto para o checkout após o último clique (mediana / 95%)", f"{fmt(pct(prontos, 50), 1, ' s')} / {fmt(pct(prontos, 95), 1, ' s')} · {len(prontos)} de {len(ens)} ensaios completos"),
        ("Maior fila de leitura", f"{fila_max} fotos"),
        ("Rostos por foto (média)", fmt(statistics.mean([f['rostos'] for f in lidas]) if lidas else None, 1)),
        ("Buscas por selfie", f"{len(sel_ok)} ({len(sel) - len(sel_ok)} sem rosto ou com erro)"),
        ("Tempo da busca por selfie (mediana / 95%)", f"{fmt(pct([s['ms'] for s in sel_ok], 50), 0, ' ms')} / {fmt(pct([s['ms'] for s in sel_ok], 95), 0, ' ms')}"),
        ("CPU do servidor (média / máxima)", f"{fmt(statistics.mean([m['cpu'] for m in mon if m.get('cpu') is not None]) if any(m.get('cpu') is not None for m in mon) else None, 0, '%')} / {fmt(max([m['cpu'] for m in mon if m.get('cpu') is not None] or [None]) if any(m.get('cpu') is not None for m in mon) else None, 0, '%')}"),
        ("Memória do servidor (máxima)", fmt(max([m['memoria'] for m in mon if m.get('memoria') is not None]) if any(m.get('memoria') is not None for m in mon) else None, 0, "%")),
        ("Disco livre no fim", fmt(([m.get('disco_livre_gb') for m in mon if m.get('disco_livre_gb') is not None] or [None])[-1], 1, " GB")),
    ]
    por_fot = {}
    for e in ok:
        d = por_fot.setdefault(e["fotografo"], [0, 0, []]); d[0] += 1; d[1] += e["bytes"]; d[2].append(e["seg"])
    veredito = (f"A operação aguenta a meta: o indexador dá conta de {fmt(cap_min, 0)} fotos/min, acima do pico de {fmt(pico_min, 0)} fotos/min, "
                f"e 95% dos ensaios ficam prontos para o checkout em até {fmt(pct(prontos, 95) if prontos else pct(ponta, 95), 0)} s após o último clique.") if aguenta else (
                f"A operação ainda não aguenta a meta: pico de {fmt(pico_min, 0)} fotos/min contra capacidade de {fmt(cap_min, 0)} fotos/min"
                + (f", {len(err)} envios com erro" if err else "") + f"; 95% procuráveis em {fmt(pct(ponta, 95), 0)} s (alvo: até 60 s).")
    tab = "".join(f"<tr><th>{k}</th><td>{v}</td></tr>" for k, v in linhas)
    tabf = "".join(f"<tr><td>{k}</td><td>{v[0]}</td><td>{fmt(v[1] / 1e6, 0, ' MB')}</td><td>{fmt(pct(v[2], 50), 2, ' s')}</td><td>{fmt(pct(v[2], 95), 2, ' s')}</td></tr>" for k, v in sorted(por_fot.items()))
    pts = [(m["t"] - t_ini, m.get("fila") or 0) for m in mon if "erro" not in m]
    maxf = max([y for _, y in pts] or [1]) or 1; maxt = max([x for x, _ in pts] or [1]) or 1
    svg = "".join(f"{'M' if i == 0 else 'L'}{20 + 760 * x / maxt:.1f},{170 - 150 * y / maxf:.1f}" for i, (x, y) in enumerate(pts))
    html = f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Teste de carga Eterna</title><style>
:root{{--fg:#0C2340;--mu:#5b6573;--bg:#fff;--line:#e3e6eb;--ac:#134078;--ok:#005500;--bad:#b3261e}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 Inter,Segoe UI,Arial,sans-serif}}main{{max-width:900px;margin:0 auto;padding:24px 16px}}
h1{{font-size:26px;margin:0 0 4px}}.mu{{color:var(--mu)}}table{{width:100%;border-collapse:collapse;margin:14px 0}}th,td{{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{font-weight:600;width:52%}}.v{{padding:14px 16px;border-radius:10px;color:#fff;background:{'var(--ok)' if aguenta else 'var(--bad)'};font-weight:600}}
.ac{{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:6px 0}}.ac b{{font-size:56px;line-height:1}}
svg{{width:100%;height:auto;border:1px solid var(--line);border-radius:8px}}</style></head><body><main>
<h1>Teste de carga do Eterna</h1><div class="mu">{datetime.fromtimestamp(t_ini):%d/%m/%Y %H:%M} · meta {a.meta_dia:,} fotos/dia em {fmt(a.horas, 0)} h · {par.get('fotografos', '?')} fotógrafos · ensaios de {'-'.join(str(x) for x in par.get('fotos_ensaio', [])) or '?'} fotos em {'-'.join(fmt(x, 1) for x in par.get('duracao_ensaio', [])) or '?'} min{' · tempo acelerado %gx' % par['acelerar'] if par.get('acelerar', 1) != 1 else ''}</div>
<p class="v">{veredito}</p>
<p>Capacidade medida do indexador: <b>{fmt(cap_dia, 0)} fotos por dia</b> em {a.horas} h de operação.</p>
<h2>Acurácia do reconhecimento</h2>
<p class="ac"><b style="color:{'var(--ok)' if acerto is not None and acerto * 100 >= a.meta_acerto else 'var(--bad)'}">{fmt(acerto * 100 if acerto is not None else None, 1, '%')}</b>
<span>{n_achou} de {len(sel_val)} selfies encontraram a pessoa · meta {fmt(a.meta_acerto, 0, '%')}</span></p>
<table><tr><th>Encontrou com certeza</th><td>{n_certeza} ({fmt(100 * n_certeza / len(sel_val) if sel_val else None, 1, '%')})</td></tr>
<tr><th>Encontrou perguntando "é uma destas?"</th><td>{n_achou - n_certeza} ({fmt(100 * (n_achou - n_certeza) / len(sel_val) if sel_val else None, 1, '%')})</td></tr>
<tr><th>Não encontrou</th><td>{len(sel_val) - n_achou - n_sem_rosto} ({fmt(100 * (len(sel_val) - n_achou - n_sem_rosto) / len(sel_val) if sel_val else None, 1, '%')})</td></tr>
<tr><th>Não viu rosto na selfie</th><td>{n_sem_rosto} ({fmt(100 * n_sem_rosto / len(sel_val) if sel_val else None, 1, '%')})</td></tr></table>
<h2>Resultados</h2><table>{tab}</table>
<h2>Por fotógrafo simulado</h2><table><tr><th>Fotógrafo</th><th>Fotos</th><th>Volume</th><th>Upload mediano</th><th>Upload 95%</th></tr>{tabf}</table>
<h2>Fila de leitura ao longo do teste</h2><svg viewBox="0 0 800 190" role="img" aria-label="Fila de leitura"><path d="{svg}" fill="none" stroke="#134078" stroke-width="2"/><text x="20" y="186" font-size="11" fill="#5b6573">0 min</text><text x="740" y="186" font-size="11" fill="#5b6573">{fmt(maxt / 60, 1)} min</text><text x="24" y="16" font-size="11" fill="#5b6573">{maxf} fotos</text></svg>
<p class="mu">Arquivos brutos nesta pasta: envios.jsonl, selfies.jsonl, monitor.jsonl, metricas-eterna.json.</p></main></body></html>"""
    out = os.path.join(a.saida, "relatorio.html")
    open(out, "w", encoding="utf8").write(html)
    print(veredito)
    print("relatório:", out)


def main():
    ap = argparse.ArgumentParser(description="Eterna · teste de carga")
    sp = ap.add_subparsers(dest="cmd", required=True)
    e = sp.add_parser("enviar"); e.add_argument("--host", required=True); e.add_argument("--porta", type=int, default=21)
    e.add_argument("--usuario", required=True); e.add_argument("--fotos", required=True); e.add_argument("--fotografos", type=int, default=7)
    e.add_argument("--meta-dia", type=int, default=15000); e.add_argument("--horas", type=float, default=8)
    e.add_argument("--fotos-ensaio", type=int, nargs=2, default=[10, 20], metavar=("MIN", "MAX"))
    e.add_argument("--duracao-ensaio", type=float, nargs=2, default=[1.5, 2.5], metavar=("MIN", "MAX"), help="minutos")
    e.add_argument("--acelerar", type=float, default=1, help="2 = o mesmo dia na metade do tempo"); e.add_argument("--minutos", type=float, default=30)
    e.add_argument("--pasta-por-fotografo", action=argparse.BooleanOptionalAction, default=True, help="cada fotógrafo numa pasta do FTP (padrão)")
    s = sp.add_parser("selfies"); s.add_argument("--agente", required=True); s.add_argument("--por-minuto", type=float, default=20); s.add_argument("--minutos", type=float, default=10)
    m = sp.add_parser("monitorar"); m.add_argument("--agente", required=True); m.add_argument("--minutos", type=float, default=12)
    r = sp.add_parser("relatorio"); r.add_argument("--agente", default="http://127.0.0.1:8765"); r.add_argument("--meta-dia", type=int, default=15000); r.add_argument("--meta-acerto", type=float, default=90)
    r.add_argument("--horas", type=float, default=8, help="horas de operação por dia"); r.add_argument("--pico", type=float, default=1.7, help="pico / média: ensaios de vários fotógrafos ao mesmo tempo")
    for x in (e, s, m, r):
        x.add_argument("--saida", default="./teste-carga")
    a = ap.parse_args()
    if getattr(a, "agente", None):
        a.agente = a.agente.rstrip("/")
    {"enviar": enviar, "selfies": selfies, "monitorar": monitorar, "relatorio": relatorio}[a.cmd](a)


if __name__ == "__main__":
    main()
