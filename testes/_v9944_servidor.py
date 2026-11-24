# Ajudante do testes/v9944-zerar-servidor.js (não é teste: começa com _). Monta um HOME com a cara do servidor do estádio
# (inbox, recortes, montagens e ativ-* como links para outra pasta, a "mídia", que pode ser outro disco) e tira o retrato do que
# existe antes e depois da zeragem. Nenhuma foto de visitante: imagens geradas aqui ou a ilustração gerada img/ativ-snap.jpg.
#   HOME=<tmp> python3 -I testes/_v9944_servidor.py agente/eterna-agente.py semeia <midia> <presets.json> <senha>
#   HOME=<tmp> python3 -I testes/_v9944_servidor.py agente/eterna-agente.py retrato      -> JSON
import hashlib, importlib.util, io, json, os, sqlite3, sys, time
sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import _agente_sessao  # noqa: F401  (só para exigir HOME temporário)

AG = os.path.abspath(sys.argv[1])
CMD = sys.argv[2]
HOME = os.environ["HOME"]
E = os.path.join(HOME, "Eterna")
os.environ.setdefault("ETERNA_SEM_OPENCV", "1")


def P(*p):
    return os.path.join(E, *p)


D1, D2, D3 = "2026-11-20", "2026-11-21", "2026-11-22"
LIGADAS = ("inbox", "recortes", "montagens", "ativ-videos", "ativ-clientes", "ativ-demo")


def jpeg(cor, w=320, h=240):
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (w, h), cor).save(b, "JPEG", quality=88)
    return b.getvalue()


def carrega():
    sp = importlib.util.spec_from_file_location("ag", AG)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


def semeia(midia, presets_arq, senha):
    os.makedirs(E, exist_ok=True)
    for d in LIGADAS:
        os.makedirs(os.path.join(midia, d), exist_ok=True)
        if not os.path.lexists(P(d)):
            os.symlink(os.path.join(midia, d), P(d))
    json.dump({"users": {"carlos": "x" * 12}}, open(P("ftp.json"), "w"))
    PIDS = {}
    # fotos de dois dias de teste (originais na inbox, miniaturas no NVMe)
    os.makedirs(P("thumbs"), exist_ok=True)
    for d, n in ((D1, 6), (D2, 4)):
        os.makedirs(P("inbox", d), exist_ok=True)
        PIDS[d] = []
        for i in range(n):
            pid = hashlib.sha256(("%s-%d" % (d, i)).encode()).hexdigest()[:12]
            PIDS[d].append(pid)
            open(P("inbox", d, "%s_IMG_%04d.JPG" % (pid, i)), "wb").write(jpeg((30 + i * 20, 110, 70)))
            open(P("thumbs", pid + ".jpg"), "wb").write(jpeg((30 + i * 20, 110, 70), 80, 60))
    json.dump({pid: {"o": "IMG", "s": "ftp", "u": time.time() - 86400 * 3, "c": "carlos"} for d in PIDS for pid in PIDS[d]}, open(P("meta.json"), "w"))
    open(P("metricas.jsonl"), "w").write('{"dia":"%s","fotos":6}\n' % D1)
    json.dump({"dia": D2, "n": 4}, open(P("envio-dia.json"), "w"))
    json.dump({"dia": D2, "n": 4}, open(P("leitor-dia.json"), "w"))
    # sessões, métricas e visitas
    os.makedirs(P("ponto", "sessoes"), exist_ok=True)
    for d in (D1, D2):
        json.dump({"dia": d, "sessoes": [{"card": "LPSRV%s%02d" % (d[-2:], i), "status": "fechada", "fotos": PIDS[d][i * 2:i * 2 + 2], "fotografo": "carlos", "ia": []}
                                         for i in range(len(PIDS[d]) // 2)]}, open(P("ponto", "sessoes", d + ".json"), "w"))
    os.makedirs(P("ponto", "metricas"), exist_ok=True)
    for d in (D1, D2):
        json.dump({"dia": d, "vendas": 2, "sessoes": 3, "faturamento": 300.0, "fotos": 10, "sessoes_com_venda": 2}, open(P("ponto", "metricas", d + ".json"), "w"))
    os.makedirs(P("ponto", "visitas"), exist_ok=True)
    json.dump({"dia": D1, "arestas": []}, open(P("ponto", "visitas", D1 + ".json"), "w"))
    open(P("ponto", "visitas-log.jsonl"), "w").write('{"x":1}\n')
    open(P("ponto", "visitas-calibracao.jsonl"), "w").write('{"x":1}\n')
    # Roverpix (fica)
    os.makedirs(P("roverpix", "agg"), exist_ok=True)
    for d in (D1, D3):
        json.dump({"daily": {"approaches": 9, "converted": 4, "sales": 5, "revenue": 777.0, "photos": 90, "photosSold": 12}}, open(P("roverpix", "agg", d + ".json"), "w"))
    # galerias: uma de sessão, uma de vídeo, escolas, vendas online e consentimentos
    for tok, tipo in (("SrvTesteGaleria0000001", "sessao"), ("SrvTesteVideo000000001", "video")):
        os.makedirs(P("galerias", tok), exist_ok=True)
        json.dump({"v": 1, "token": tok, "codigo": "SRVX-SRVX", "tipo": tipo, "sessoes": [], "expira": "2027-01-01T00:00:00Z", "envio": {"vitrine": "ok"}},
                  open(P("galerias", tok, "sessao.json"), "w"))
    json.dump({}, open(P("galerias", "escolas.json"), "w"))
    json.dump({}, open(P("galerias", "escolas-numeros.json"), "w"))
    open(P("galerias", "vendas-online.jsonl"), "w").write('{"pedido":"online-teste","valor":1}\n')
    open(P("galerias", "consentimentos.jsonl"), "w").write('{"ok":true}\n')
    # impressão: fila e fotos (os .ps1 ficam)
    os.makedirs(P("impressao"), exist_ok=True)
    open(P("impressao", "fila.json"), "w").write("[]")
    open(P("impressao", "venda_srv.jpg"), "wb").write(jpeg((1, 2, 3), 16, 16))
    open(P("impressao", "lista_srv.txt"), "w").write("x")
    open(P("impressao", "imprimir.ps1"), "w").write("# fica")
    # recortes, montagens, ativações
    m = carrega()
    open(P("recortes", PIDS[D1][0] + ".png"), "wb").write(b"\x89PNG\r\n\x1a\nfalso")
    open(P("recortes", ".versao"), "w").write(m.REC_VERSAO)
    os.makedirs(P("montagens", PIDS[D1][0]), exist_ok=True)
    open(P("montagens", PIDS[D1][0], "info-x.json"), "w").write("{}")
    os.makedirs(P("montagens", "vendidas"), exist_ok=True)
    open(P("montagens", "vendidas", "v1.jpg"), "wb").write(jpeg((9, 9, 9), 16, 16))
    QR1, QR2, QR3 = "CartaoEntregueSrv00001", "CartaoLivreSrv00000002", "CartaoSoltoSrv00000003"
    open(P("ativ-videos", QR1 + ".mp4"), "wb").write(b"\0" * 100)
    open(P("ativ-clientes", "venda1.jpg"), "wb").write(jpeg((5, 5, 5), 16, 16))
    open(P("ativ-demo", "demo.mp4"), "wb").write(b"\1" * 50)
    for d in ("fundos", "fundos-ia"):
        os.makedirs(P(d), exist_ok=True)
        open(P(d, "x.jpg"), "wb").write(b"fica")
    json.dump(["hashlgpd"], open(P("lgpd-excluidas.json"), "w"))
    open(P("lgpd.log"), "w").write("linha\n")
    json.dump({"fonte": "teste"}, open(P("agenda-fonte.json"), "w"))
    # bancos
    c = m.vendas_db()
    c.execute("insert into evento (idem, venda, seq, tipo, em, dia, posto, por, dados, recebido) values "
              "('e1','V1',1,'criar','x',?,'p','q','{}','x'),('e2','V1',2,'pagar','x',?,'p','q','{}','x'),"
              "('e3','V2',1,'criar','x',?,'p','q','{\"itens\":[{\"id\":\"pr1\"}]}','x')", (D1, D1, D2))
    c.execute("insert into selfie values ('x',?,10,'checkout','achou',3,100),('x',?,11,'checkout','nao_achou',0,90)", (D1, D2))
    c.execute("insert into ativ_venda (origem, id, tipo, dia, valor) values ('eterna','T1','drone',?,100),('eterna','T2','chute',?,50),('antigo','A1','drone','2026-10-01',80)", (D1, D2))
    c.execute("insert into ativ_entrega (qr, venda, n, arquivo) values (?, 'T1', 1, 'x'), (?, 'T2', 1, 'y')", (QR1, QR3))
    c.execute("insert into ativ_pulseira (numero, venda, slot) values ('001','T1',1)")
    c.execute("insert into ativ_pulseira_log (venda, slot, numero, acao) values ('T1',1,'001','ligar')")
    c.execute("insert into ativ_foto (venda, qr, pid, tipo, t, em) values ('T1', ?, ?, 'cliente', 0, 'x')", (QR1, PIDS[D1][0]))
    c.execute("insert into ativ_cadastro values ('piloto','Piloto de teste',1)")
    c.execute("insert into cartao_lote (id, n, em, por, situacao, baixado_n) values ('L20261120-120000', 2, 'x', 'teste', 'recebido', 1)")
    c.execute("insert into cartao values (?, ?, 'L20261120-120000'), (?, ?, 'L20261120-120000')", (QR1, m.cartao_codigo(QR1), QR2, m.cartao_codigo(QR2)))
    c.commit()
    c.close()
    c = m.operacao_db()
    c.execute("insert into fotografo_dia values (?, 'carlos', '{}', 'x'), (?, 'yago', '{}', 'x')", (D1, D2))
    c.execute("insert into fotografo_mes values ('2026-10', '{}', 'x')")
    c.execute("insert into fotografo_dia_calc values (?, 'x', 1)", (D1,))
    c.execute("insert into montagem_vista values (?, 'terminal01', 5, 0)", (D1,))
    c.execute("insert into entrada values (?, 'bip', 100), (?, 'bip', 200), (?, 'bip', 300)", (D1, D1, D1))
    c.execute("insert into entrada_total values (?, 'bilheteria', 1234, null)", (D2,))
    c.execute("insert into importacao (id, em, por, arquivo, origem, dias, aceitas, recusadas) values ('i1','x','teste','a.csv','bip','[]',3,0)")
    c.commit()
    c.close()
    c = m.nuvem_db()
    c.execute("insert into fila (pid, arquivo, entrou) values (?, 'x', 0), (?, 'y', 0)", (PIDS[D1][0], PIDS[D1][1]))
    c.execute("CREATE TABLE IF NOT EXISTS galerias (token TEXT PRIMARY KEY, prox REAL, tentativas INTEGER, feito REAL, erro TEXT)")
    c.execute("insert into galerias (token) values ('SrvTesteGaleria0000001')")
    c.execute("CREATE TABLE IF NOT EXISTS videos (qr TEXT PRIMARY KEY, arquivo TEXT, entrou REAL, tentativas INTEGER DEFAULT 0)")
    c.execute("insert into videos (qr, arquivo, entrou) values (?, 'x', 0)", (QR1,))
    c.execute("CREATE TABLE IF NOT EXISTS cursor (nome TEXT PRIMARY KEY, valor TEXT)")
    c.execute("insert into cursor values ('vendas', '123')")
    c.commit()
    c.close()
    c = m.treino_db()
    for i, pid in enumerate(PIDS[D1][:4]):
        c.execute("insert into rotulo (pid, v, dia, fotografo, card, ordem, dados, por, em, origem, lote) values (?,1,?,'carlos','LPSRV',?,?,'teste','x','mao',null)",
                  (pid, D1, i, json.dumps({"ponto": "gramado", "qual": {"nivel": "boa"}})))
    c.execute("insert into medida (pid, tipo, valor, em) values (?, 'luz', '{}', 'x')", (PIDS[D1][0],))
    c.commit()
    c.close()
    c = m.cena_db()
    for i, pid in enumerate(PIDS[D1]):
        c.execute("insert into cena (pid, dia, vet, rotulo, conf) values (?, ?, x'0102', ?, 0.9)", (pid, D1, "gramado" if i < 4 else None))
    c.execute("insert into modelo (versao, rotulos, params, por, em) values ('v1', '[]', '{}', 'teste', 'x')")
    c.commit()
    c.close()
    c = m.rostos_db()
    c.execute("insert into foto values (?, ?, 2, 0), (?, ?, 1, 0)", (PIDS[D1][0], D1, PIDS[D1][1], D1))
    c.execute("insert into rosto values (?, ?, 50, x'00'), (?, ?, 40, x'00'), (?, ?, 60, x'00')", (PIDS[D1][0], D1, PIDS[D1][0], D1, PIDS[D1][1], D1))
    c.commit()
    c.close()
    c = m.poses_db()
    c.execute("insert into pose (pid, dia) values (?, ?), (?, ?)", (PIDS[D1][0], D1, PIDS[D1][1], D1))
    c.commit()
    c.close()
    json.dump({"x": 1}, open(P("ponto", "poses-sha.json"), "w"))
    c = sqlite3.connect(P("backup-originais.db"))
    c.execute("CREATE TABLE IF NOT EXISTS feito (chave TEXT PRIMARY KEY, tam INTEGER, mtime REAL, md5 TEXT, em REAL)")
    for pid in PIDS[D1]:
        c.execute("insert into feito values (?, 1, 1, 'x', 1)", ("originais/%s/%s.jpg" % (D1, pid),))
    c.commit()
    c.close()
    # estado.db: usuários com senha (Admin, Supervisora, Fotógrafo), posto, leitor, pedidos, preços, porta-retrato e configurações
    pre = json.load(open(presets_arq))
    for usuario, nome, p in (("admin.srv@exemplo.com", "Admin do servidor", "admin"), ("sup.srv@exemplo.com", "Supervisora", "supervisor"),
                             ("foto.srv@exemplo.com", "Carlos", "fotografo")):
        x = pre[p]
        cad = {"v": 2, "email": usuario, "name": nome, "active": True, "preset": p, "perms": x["perms"], "menu": x["menu"], "inicio": x.get("inicio") or "painel",
               "key": "carlos" if p == "fotografo" else None, "createdBy": "servidor", "createdAt": "2026-11-01T00:00:00.000Z", "updatedAt": "2026-11-01T00:00:00.000Z"}
        m.estado_gravar({"docs": [{"col": "usuarios", "id": m.quote(usuario, safe="-_.!~*'()"), "valor": cad}]})
        m.auth_criar(usuario, "servidor")
        m.auth_trocar(usuario, senha)
    m.posto_criar("Caixa 1", "admin.srv@exemplo.com")
    m.leitor_criar("Leitor Gramado", "admin.srv@exemplo.com")
    c = m.pedidos_db()
    c.execute("insert into pedido values ('P1','Caixa 1','escolha','{}','x',0), ('P2','Caixa 1','confirmada','{}','x',0), ('P3','Caixa 1','aguardando','{}','x',0)")
    c.commit()
    c.close()
    m.estado_gravar({"docs": [{"col": "sim", "id": "prices|p1", "valor": 77}, {"col": "sim", "id": "flagUse|br", "valor": 3},
                              {"col": "config", "id": "busca", "valor": {"min": 90}}, {"col": "diario", "id": "d1", "valor": {"id": "d1", "t": "nota"}}]})
    print(json.dumps({"ok": True, "pids": PIDS, "qr": [QR1, QR2, QR3]}))


def sha_tab(arq, tabelas, where=None):
    if not os.path.exists(arq):
        return None
    c = sqlite3.connect(arq)
    try:
        h = hashlib.sha256()
        for t in tabelas:
            try:
                rows = c.execute("select * from %s%s" % (t, (" where " + where[t]) if where and t in where else ""))
            except sqlite3.OperationalError:
                h.update(b"sem-tabela")
                continue
            for r in sorted(repr(x) for x in rows):
                h.update(r.encode())
        return h.hexdigest()[:16]
    finally:
        c.close()


def sha_cols(arq, sqls):
    c = sqlite3.connect(arq)
    try:
        h = hashlib.sha256()
        for q in sqls:
            for r in sorted(repr(x) for x in c.execute(q)):
                h.update(r.encode())
        return h.hexdigest()[:16]
    finally:
        c.close()


def n_sess():
    t = 0
    d = P("ponto", "sessoes")
    for x in (os.listdir(d) if os.path.isdir(d) else []):
        if x.endswith(".json"):
            try:
                t += len(json.load(open(os.path.join(d, x))).get("sessoes") or [])
            except Exception:
                pass
    return t


def n(arq, sql):
    if not os.path.exists(arq):
        return None
    c = sqlite3.connect(arq)
    try:
        r = c.execute(sql).fetchone()
        return r[0] if r else None
    except sqlite3.OperationalError:
        return None
    finally:
        c.close()


def arvore(d, prof=3):
    out = []
    if not os.path.isdir(d):
        return None
    base = os.path.realpath(d)
    for raiz, ds, ns in os.walk(base):
        ds[:] = sorted(x for x in ds if not x.startswith(".arquivo"))
        if os.path.relpath(raiz, base).count(os.sep) >= prof:
            continue
        for x in sorted(ns):
            out.append(os.path.relpath(os.path.join(raiz, x), base))
    return out


def sha_pasta(d):
    if not os.path.isdir(d):
        return None
    h = hashlib.sha256()
    for raiz, ds, ns in os.walk(d):
        ds.sort()
        for x in sorted(ns):
            a = os.path.join(raiz, x)
            h.update(os.path.relpath(a, d).encode())
            h.update(open(a, "rb").read())
    return h.hexdigest()[:16]


def retrato():
    V, O, NU, ES, TR, CE = P("ponto", "vendas.db"), P("ponto", "operacao.db"), P("nuvem.db"), P("ponto", "estado.db"), P("ponto", "treino.db"), P("ponto", "cena.db")
    r = {"pastas": {d: arvore(P(*d.split("/"))) for d in ("inbox", "recortes", "montagens", "ativ-videos", "ativ-clientes", "ativ-demo", "thumbs", "galerias", "ponto/sessoes",
                                                         "ponto/metricas", "ponto/visitas", "impressao", "roverpix", "fundos", "fundos-ia")},
         "arqs": {a: os.path.exists(P(*a.split("/"))) for a in ("meta.json", "index.json", "metricas.jsonl", "envio-dia.json", "leitor-dia.json", "rostos.db", "ponto/poses.db",
                                                               "ponto/poses-sha.json", "ponto/visitas-log.jsonl", "ponto/visitas-calibracao.jsonl", "lgpd-excluidas.json", "lgpd.log",
                                                               "ftp.json", "agenda-fonte.json", "ponto/zerada.json", "ponto/zerar-falhou.json", "ponto/zerar-pedido.json",
                                                               "ponto/zerar-andamento.json", "ponto/zerar-expirado.json")},
         "n": {"evento": n(V, "select count(*) from evento"), "selfie": n(V, "select count(*) from selfie"),
               "ativ_eterna": n(V, "select count(*) from ativ_venda where origem='eterna'"), "ativ_antigo": n(V, "select count(*) from ativ_venda where origem='antigo'"),
               "ativ_entrega": n(V, "select count(*) from ativ_entrega"), "ativ_pulseira": n(V, "select count(*) from ativ_pulseira"),
               "ativ_foto": n(V, "select count(*) from ativ_foto"), "cartao": n(V, "select count(*) from cartao"),
               "cartao_fase_teste": n(V, "select count(*) from cartao where lote='fase-teste'"), "lote_fase_teste": n(V, "select situacao from cartao_lote where id='fase-teste'"),
               "fotografo_dia": n(O, "select count(*) from fotografo_dia"), "fotografo_mes": n(O, "select count(*) from fotografo_mes"),
               "montagem_vista": n(O, "select count(*) from montagem_vista"), "dia_eterna": n(O, "select count(*) from dia where fonte_vendas='eterna'"),
               "fila": n(NU, "select count(*) from fila"), "galerias_nuvem": n(NU, "select count(*) from galerias"), "videos": n(NU, "select count(*) from videos"),
               "pedido": n(ES, "select count(*) from pedido"), "rostos": n(P("rostos.db"), "select count(*) from rosto"), "poses": n(P("ponto", "poses.db"), "select count(*) from pose"),
               "feito": n(P("backup-originais.db"), "select count(*) from feito"), "arquivado": n(P("backup-originais.db"), "select count(*) from arquivado"),
               "rotulo": n(TR, "select count(*) from rotulo"), "cena": n(CE, "select count(*) from cena"), "modelo": n(CE, "select count(*) from modelo")},
         "sha": {"treino": sha_tab(TR, ("rotulo", "rotulo_hist", "lote", "medida", "liga_log")), "cena": sha_tab(CE, ("cena", "modelo", "meta")),
                 "estado_cred": sha_cols(ES, ("select usuario, hash, sal from credencial", "select id, nome, hash, revogado_em from posto", "select id, nome, hash, revogado_em from leitor")), "estado_doc_sim_config": sha_tab(ES, ("doc",), {"doc": "col in ('sim','config','usuarios','diario')"}),
                 "operacao_fica": sha_tab(O, ("entrada", "entrada_total", "importacao")),
                 "vendas_fica": sha_tab(V, ("ativ_venda", "ativ_cadastro", "cartao_lote"), {"ativ_venda": "origem='antigo'", "cartao_lote": "id != 'fase-teste'"}),
                 "cursor": sha_tab(NU, ("cursor",)), "roverpix": sha_pasta(P("roverpix")), "fundos": sha_pasta(P("fundos")), "fundos-ia": sha_pasta(P("fundos-ia")),
                 "ativ-demo": sha_pasta(P("ativ-demo")), "lgpd": sha_pasta(P("lgpd-excluidas.json")) if False else (hashlib.sha256(open(P("lgpd-excluidas.json"), "rb").read()).hexdigest()[:16] if os.path.exists(P("lgpd-excluidas.json")) else None),
                 "index": hashlib.sha256(open(P("index.json"), "rb").read()).hexdigest()[:16] if os.path.exists(P("index.json")) else None},
         "links": {d: os.path.islink(P(d)) for d in LIGADAS}, "sessoes": n_sess(),
         "metricas_jsonl": open(P("metricas.jsonl")).read()[:20000] if os.path.exists(P("metricas.jsonl")) else ""}
    return r


if CMD == "semeia":
    semeia(sys.argv[3], sys.argv[4], sys.argv[5])
elif CMD == "retrato":
    print(json.dumps(retrato()))


def imagens(dst):
    """Fotos geradas para a Lixeira da IA, a partir da ilustração gerada img/ativ-snap.jpg (nenhuma foto de visitante) e do fundo
    img/bg-mirantedia.jpg (sem ninguém). -> {nome: arquivo}"""
    import cv2
    import numpy as np
    raiz = os.path.dirname(AQUI)
    os.makedirs(dst, exist_ok=True)
    boa = cv2.resize(cv2.imread(os.path.join(raiz, "img", "ativ-snap.jpg")), (1800, 1440), interpolation=cv2.INTER_CUBIC)
    vazio = cv2.resize(cv2.imread(os.path.join(raiz, "img", "bg-mirantedia.jpg")), (1800, 1290), interpolation=cv2.INTER_CUBIC)
    fotos = {"boa": boa, "boa2": cv2.flip(boa, 1),
             "escura": (boa.astype(np.float32) * 0.05).astype(np.uint8),
             "estourada": np.clip(boa.astype(np.int16) + 215, 0, 255).astype(np.uint8),
             "borrada": cv2.GaussianBlur(boa, (0, 0), 18),   # sigma 9 na escala que o leitor mede (900 px)
             "sem_ninguem": vazio}
    out = {}
    for i, (k, im) in enumerate(fotos.items()):
        a = os.path.join(dst, "IMG_%04d.JPG" % (5000 + i))
        cv2.imwrite(a, im, [cv2.IMWRITE_JPEG_QUALITY, 92])
        out[k] = a
    return out


if CMD == "imagens":
    print(json.dumps(imagens(sys.argv[3])))
