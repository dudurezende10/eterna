"""Eterna · cópia dos originais das fotos (HD do servidor) para o bucket do Eterna, em originais/<dia>/<arquivo>.
Rodado pelo eterna-backup-originais.timer a cada 10 min, como o usuário eterna, com a mesma chave da nuvem (nuvem.env).
- só sobe o que ainda não subiu (registro em /srv/eterna/Eterna/backup-originais.db), classe STANDARD_IA, conferido por MD5;
- LGPD: foto apagada pelo Eterna (sessão não vendida excluída) também sai da nuvem; se faltar de uma vez mais de 10%
  das fotos já copiadas, NÃO apaga nada (HD com defeito ou fora do lugar não pode virar exclusão em massa);
- a retenção (180 dias) é do próprio bucket (nuvem-aws-cloudshell.sh).
"""
import base64, hashlib, os, sqlite3, sys, time

INBOX = "/srv/eterna-midia/inbox"
E = "/srv/eterna/Eterna"
DB = os.path.join(E, "backup-originais.db")
EXT = (".jpg", ".jpeg", ".png", ".heic", ".cr3", ".cr2", ".arw", ".nef", ".dng", ".mp4", ".mov")


def env():
    v = {}
    try:
        for ln in open(os.path.join(E, "nuvem.env"), encoding="utf-8"):
            ln = ln.strip()
            if ln.startswith("ETERNA_") and "=" in ln:
                k, x = ln.split("=", 1)
                v[k] = x.strip()
    except OSError:
        pass
    return v


def main():
    cfg = env()
    if cfg.get("ETERNA_NUVEM") != "s3" or not cfg.get("ETERNA_BUCKET"):
        print("nuvem desligada: nada a copiar")
        return 0
    if not os.path.ismount("/srv/eterna-midia"):
        print("HD das fotos não montado: nada feito")
        return 1
    import boto3
    from botocore.config import Config
    regiao = cfg.get("ETERNA_AWS_REGIAO") or "us-east-2"
    s3 = boto3.session.Session(profile_name=cfg.get("ETERNA_AWS_PERFIL") or None, region_name=regiao).client(
        "s3", endpoint_url="https://s3.%s.amazonaws.com" % regiao, config=Config(retries={"max_attempts": 5, "mode": "standard"}))
    bucket = cfg["ETERNA_BUCKET"]
    db = sqlite3.connect(DB, timeout=30)
    db.execute("CREATE TABLE IF NOT EXISTS feito (chave TEXT PRIMARY KEY, tam INTEGER, mtime REAL, md5 TEXT, em REAL)")
    feitos = {k: (t, m) for k, t, m in db.execute("SELECT chave, tam, mtime FROM feito")}
    vistos, novos, bytes_ = set(), 0, 0
    agora = time.time()
    for dia in sorted(os.listdir(INBOX)):
        pasta = os.path.join(INBOX, dia)
        if not os.path.isdir(pasta):
            continue
        for nome in sorted(os.listdir(pasta)):
            if not nome.lower().endswith(EXT):
                continue
            a = os.path.join(pasta, nome)
            try:
                st = os.stat(a)
            except OSError:
                continue
            chave = "originais/%s/%s" % (dia, nome)
            vistos.add(chave)
            if agora - st.st_mtime < 60:                      # ainda chegando
                continue
            if feitos.get(chave) == (st.st_size, st.st_mtime):
                continue
            with open(a, "rb") as f:
                corpo = f.read()
            md5 = hashlib.md5(corpo)
            r = s3.put_object(Bucket=bucket, Key=chave, Body=corpo, StorageClass="STANDARD_IA",
                              ContentMD5=base64.b64encode(md5.digest()).decode())
            if r.get("ETag", "").strip('"') != md5.hexdigest():
                raise SystemExit("ETag diferente em " + chave)
            db.execute("INSERT OR REPLACE INTO feito VALUES (?,?,?,?,?)", (chave, st.st_size, st.st_mtime, md5.hexdigest(), time.time()))
            db.commit()
            novos += 1
            bytes_ += st.st_size
    sumiram = [k for k in feitos if k not in vistos]
    apagadas = 0
    if sumiram and len(sumiram) > max(20, 0.10 * len(feitos)):
        print("faltam %d fotos já copiadas de uma vez: nada apagado da nuvem (conferir o HD)" % len(sumiram))
    else:
        for k in sumiram:
            s3.delete_object(Bucket=bucket, Key=k)
            db.execute("DELETE FROM feito WHERE chave=?", (k,))
            db.commit()
            apagadas += 1
    print("originais: %d novos (%.1f MB), %d apagados da nuvem (LGPD), %d no total" % (novos, bytes_ / 1e6, apagadas, len(vistos)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
