# v99.26: fotos do Drone tiradas do vídeo. Depois de entregar, o servidor tira do vídeo 4 fotos do cliente (começo do
# vídeo) e 2 aéreas (segunda metade), espaçadas, e cada uma entra no Eterna como foto de fotógrafo (ingest_file: biblioteca,
# sessão, rostos, nuvem), com a hora do voo e "Drone · <piloto>" como origem; a venda guarda quais são (ativ_foto). Sem
# repetir na segunda vez, sem deixar quadros soltos no disco. Precisa do ffmpeg (sem ele, o teste é pulado).
#   HOME=$(mktemp -d) USERPROFILE=$HOME python3 -I testes/fotos_video_agente.py agente/eterna-agente.py
import importlib.util, json, os, subprocess, sys, time
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


ff = m.ffmpeg_bin()
if not ff:
    print("fotos_video_agente: sem ffmpeg, pulado")
    sys.exit(0)
HOJE = time.strftime("%Y-%m-%d")
try:
    os.makedirs(m.ATIV_VIDEOS_DIR, exist_ok=True)
    tmp = os.path.join(m.ATIV_VIDEOS_DIR, "rascunho-0123456789abcdef.mp4")
    subprocess.run([ff, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=30", "-pix_fmt", "yuv420p", tmp], check=True)
    r = m.ativ_receber([{"id": "TFOTOVID1D", "tipo": "drone", "criado": HOJE + "T10:00:00", "pagamento": "PIX", "valor": 180, "sugerido": 180,
                         "itens": [{"cat": "drone", "produto": "asteroid", "op": "Campo", "qtd": 1, "pessoas": 1, "videos": 1}], "pulseiras": ["4242"],
                         "vendedor": "V", "usuario": "v"}], "v")
    ok(r["recebidas"] == ["TFOTOVID1D"], "venda: %s" % r)
    c = m.vendas_db()
    c.execute("insert or ignore into ativ_cadastro values ('piloto','Piloto Um',1),('drone','007',1),('bateria','3',1)")
    c.commit()
    c.close()
    ok(m.ativ_etapa({"id": "TFOTOVID1D", "etapa": "voo", "piloto": "Piloto Um", "drone": "007", "bateria": "3", "pulseira": "4242"}, "eq") is None, "voo")
    QR = "F" * 21 + "1"
    m.ATIV_FOTOS_TIPOS = ()                 # a entrega dispara sozinha numa thread; aqui a chamada é direta, para medir
    ok(m.ativ_video_grava("TFOTOVID1D", QR, 1, tmp, "eq", "4242", None) is None, "vídeo entregue")
    m.ATIV_FOTOS_TIPOS = ("drone",)
    antes = set(m.lib)
    t0 = time.time()
    n = m.ativ_fotos_video("TFOTOVID1D", QR)
    seg = time.time() - t0
    c = m.vendas_db()
    fs = c.execute("select pid, tipo, t from ativ_foto where venda='TFOTOVID1D' order by t").fetchall()
    c.close()
    ok([x[1] for x in fs].count("cliente") == 4 and [x[1] for x in fs].count("aerea") == 2, "4 do cliente e 2 aéreas: %s" % fs)
    ok(all(x[2] < 15 for x in fs if x[1] == "cliente") and all(x[2] >= 15 for x in fs if x[1] == "aerea"), "cliente no começo, aéreas na segunda metade: %s" % fs)
    cl = [x[2] for x in fs if x[1] == "cliente"]
    ok(all(b - a >= 1.5 for a, b in zip(cl, cl[1:])), "fotos do cliente espaçadas: %s" % cl)
    novas = set(m.lib) - antes
    ok(n == 6 and {x[0] for x in fs} == novas, "as 6 entraram na biblioteca do Eterna: %s %s" % (n, novas))
    mt = [m.meta[p] for p in novas]
    ok(all(x["s"] == "drone" and x["o"] == "Drone · Piloto Um" for x in mt), "origem Drone e o piloto: %s" % [(x["s"], x["o"]) for x in mt])
    ok(all(time.strftime("%Y-%m-%d", time.localtime(x["mt"])) == HOJE for x in mt), "com a data do voo")
    ok(all(p in m.sess_pid for p in novas), "cada foto numa sessão, como as dos fotógrafos")
    ok(not [d for d in os.listdir(m.ATIV_VIDEOS_DIR) if d.startswith("quadros-")], "sem quadros soltos no disco")
    ok(m.ativ_fotos_video("TFOTOVID1D", QR) == 0, "a segunda vez não repete")
    print("  (%d fotos em %.1f s)" % (n, seg))
except Exception as ex:
    import traceback
    traceback.print_exc()
    falhas.append("erro: %s" % ex)
if falhas:
    print("FALHAS:\n- " + "\n- ".join(falhas))
    sys.exit(1)
print("OK fotos_video_agente: 4 fotos do cliente e 2 aéreas tiradas do vídeo, entrando no Eterna como fotos de fotógrafo")
