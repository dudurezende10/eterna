"""Cópia dos originais (15/11): arquivo pequeno com MD5, grande em partes; tamanho na nuvem conferido."""
import hashlib, importlib.util, os, sys, tempfile, types
sys.dont_write_bytecode = True
sp = importlib.util.spec_from_file_location("bo", sys.argv[1]); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
falhas = []
class S3:
    def __init__(s, perde=0): s.obj, s.perde, s.chamadas = {}, perde, []
    def put_object(s, Bucket, Key, Body, StorageClass, ContentMD5):
        s.chamadas.append("put"); s.obj[Key] = len(Body); return {"ETag": '"%s"' % hashlib.md5(Body).hexdigest()}
    def upload_file(s, a, b, k, ExtraArgs=None, Config=None):
        s.chamadas.append("partes"); s.obj[k] = os.path.getsize(a) - s.perde
    def head_object(s, Bucket, Key): return {"ContentLength": s.obj.get(Key)}
bt = types.ModuleType("boto3"); bt.s3 = types.ModuleType("boto3.s3"); tr = types.ModuleType("boto3.s3.transfer")
tr.TransferConfig = lambda **k: k; sys.modules.update({"boto3": bt, "boto3.s3": bt.s3, "boto3.s3.transfer": tr})
d = tempfile.mkdtemp()
p = os.path.join(d, "f.jpg"); open(p, "wb").write(b"x" * 1000)
s3 = S3(); md5 = m.enviar(s3, "b", p, "originais/d/f.jpg", 1000)
if s3.chamadas != ["put"] or md5 != hashlib.md5(b"x" * 1000).hexdigest(): falhas.append("pequeno: %s" % s3.chamadas)
m.GRANDE = 500
s3 = S3(); m.enviar(s3, "b", p, "originais/v.mp4", 1000)
if s3.chamadas != ["partes"]: falhas.append("grande em partes: %s" % s3.chamadas)
s3 = S3(perde=10)
try:
    m.enviar(s3, "b", p, "originais/v.mp4", 1000); falhas.append("tamanho diferente na nuvem passou")
except ValueError:
    pass

# 24/11 (zerar a fase de teste, critério 17): inbox/.arquivo não sobe; depois da zeragem (feito -> arquivado, pelo próprio agente)
# o script não apaga nada na nuvem, não diz "faltam N fotos", sobe as fotos novas e a exclusão LGPD de foto nova volta a apagar.
import io, json, sqlite3, contextlib, time
casa = tempfile.mkdtemp()
os.environ["HOME"] = casa                    # o agente importado aqui grava só nesta pasta
os.environ["ETERNA_SEM_OPENCV"] = "1"
sa = importlib.util.spec_from_file_location("ag", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "agente", "eterna-agente.py"))
ag = importlib.util.module_from_spec(sa); sa.loader.exec_module(ag)
midia = os.path.join(casa, "midia"); E = os.path.join(casa, "Eterna")
for x in ("inbox", "ativ-videos", "ativ-clientes"):
    os.makedirs(os.path.join(midia, x), exist_ok=True)
open(os.path.join(E, "nuvem.env"), "w").write("ETERNA_NUVEM=s3\nETERNA_BUCKET=balde-teste\n")
m.MIDIA, m.INBOX, m.E, m.DB = midia, os.path.join(midia, "inbox"), E, os.path.join(E, "backup-originais.db")
ag.BACKUP_ORIGINAIS_DB = m.DB
velho = time.time() - 3600
def foto(dia, nome):
    os.makedirs(os.path.join(m.INBOX, dia), exist_ok=True)
    a = os.path.join(m.INBOX, dia, nome); open(a, "wb").write(os.urandom(200)); os.utime(a, (velho, velho)); return a
class Nuvem:
    def __init__(s): s.obj, s.apagou = {}, []
    def put_object(s, Bucket, Key, Body, **k):
        s.obj[Key] = len(Body); return {"ETag": '"%s"' % hashlib.md5(Body).hexdigest()}
    def head_object(s, Bucket, Key): return {"ContentLength": s.obj.get(Key)}
    def delete_object(s, Bucket, Key): s.apagou.append(Key); s.obj.pop(Key, None)
nv = Nuvem()
bt.session = types.SimpleNamespace(Session=lambda **k: types.SimpleNamespace(client=lambda *a, **kw: nv))
bc = types.ModuleType("botocore"); bcc = types.ModuleType("botocore.config"); bcc.Config = lambda **k: k
sys.modules.update({"botocore": bc, "botocore.config": bcc})
_ismount = os.path.ismount
os.path.ismount = lambda p: True if p == "/srv/eterna-midia" else _ismount(p)
def rodada():
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        rc = m.main()
    return rc, out.getvalue()
try:
    for i in range(30):
        foto("2026-11-20", "a%02d_IMG.jpg" % i)
    vid = os.path.join(midia, "ativ-videos", "q1.mp4"); open(vid, "wb").write(b"v" * 100); os.utime(vid, (velho, velho))
    rc, out = rodada()
    if rc != 0 or len([k for k in nv.obj if k.startswith("originais/")]) != 31: falhas.append("primeira rodada: %s %s %s" % (rc, len(nv.obj), out))
    # a zeragem: o conteúdo da inbox e das ativ-* vai para inbox/.arquivo/<id>/ e o registro passa para "arquivado"
    zid = "fase-teste-20261124-2300"
    dst = os.path.join(m.INBOX, ".arquivo", zid, "inbox"); os.makedirs(dst)
    os.rename(os.path.join(m.INBOX, "2026-11-20"), os.path.join(dst, "2026-11-20"))
    os.makedirs(os.path.join(m.INBOX, ".arquivo", zid, "ativ-videos")); os.rename(vid, os.path.join(m.INBOX, ".arquivo", zid, "ativ-videos", "q1.mp4"))
    n = ag._zp_originais({"id": zid})
    db = sqlite3.connect(m.DB)
    if n != 31 or db.execute("select count(*) from feito").fetchone()[0] != 0 or db.execute("select count(*) from arquivado where arquivo=?", (zid,)).fetchone()[0] != 31:
        falhas.append("zeragem: feito não foi para arquivado (%s)" % n)
    db.close()
    if any(c.startswith("originais/.arquivo") for c, _ in m.arquivos()): falhas.append("inbox/.arquivo entrou na lista dos originais")
    nv.obj.clear()
    novas = [foto("2026-11-25", "n%02d_IMG.jpg" % i) for i in range(3)]
    rc, out = rodada()
    if rc != 0 or nv.apagou or "faltam" in out or sorted(k for k in nv.obj if k.startswith("originais/")) != ["originais/2026-11-25/n%02d_IMG.jpg" % i for i in range(3)]:
        falhas.append("depois da zeragem: rc %s, apagou %s, sobe %s, %s" % (rc, nv.apagou, sorted(nv.obj), out.strip()))
    os.remove(novas[0])                       # exclusão LGPD de foto nova (a sessão não vendida apagada pelo Eterna)
    rc, out = rodada()
    if nv.apagou != ["originais/2026-11-25/n00_IMG.jpg"] or "faltam" in out:
        falhas.append("LGPD depois da zeragem não apagou da nuvem: %s %s" % (nv.apagou, out.strip()))
finally:
    os.path.ismount = _ismount
print(("FALHA cópia dos originais: " + " | ".join(falhas)) if falhas else "OK cópia dos originais: pequeno com MD5, grande em partes, tamanho conferido, .arquivo e tabela arquivado (zeragem)")
sys.exit(1 if falhas else 0)
