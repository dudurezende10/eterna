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
print(("FALHA cópia dos originais: " + " | ".join(falhas)) if falhas else "OK cópia dos originais: pequeno com MD5, grande em partes, tamanho conferido")
sys.exit(1 if falhas else 0)
