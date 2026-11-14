#!/usr/bin/env python3
# Eterna · cria (ou mostra) um login do FTP embutido do Eterna no servidor Linux, para o CTP ou uma câmera.
# A senha é sorteada aqui (16 caracteres, sem l/o/0/1) e aparece só nesta tela; fica em /srv/eterna/Eterna/ftp.json (600, eterna).
# --compartilhado: o login pode mandar para subpasta com o nome do fotógrafo (CTP de vários fotógrafos); sem ele, as fotos
# desse login entram como do próprio login.
#   sudo /opt/eterna/venv/bin/python -I ftp-usuario.py ctp --compartilhado && sudo systemctl restart eterna
import argparse, json, os, re, secrets, string, sys

ARQ = "/srv/eterna/Eterna/ftp.json"
ap = argparse.ArgumentParser()
ap.add_argument("login")
ap.add_argument("--compartilhado", action="store_true")
a = ap.parse_args()
login = a.login.strip().lower()
if not re.fullmatch(r"[a-z][a-z0-9_-]{1,31}", login):
    sys.exit("login inválido: só letras minúsculas, números, _ e -, começando por letra")
if os.geteuid() != 0:
    sys.exit("rode com sudo")
if not os.path.exists(ARQ):
    sys.exit("%s ainda não existe: o Eterna cria na primeira vez que liga (sudo systemctl start eterna)" % ARQ)
st = os.stat(ARQ)
with open(ARQ, encoding="utf-8") as f:
    c = json.load(f)
c.setdefault("users", {})
c.setdefault("compartilhado", [])
novo = login not in c["users"]
if novo:
    alfabeto = "".join(x for x in string.ascii_lowercase + string.digits if x not in "lo01")
    c["users"][login] = "".join(secrets.choice(alfabeto) for _ in range(16))
if a.compartilhado and login not in c["compartilhado"]:
    c["compartilhado"].append(login)
tmp = ARQ + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    json.dump(c, f, indent=2)
os.chown(tmp, st.st_uid, st.st_gid)
os.chmod(tmp, 0o600)
os.replace(tmp, ARQ)
print("login %s %s%s" % (login, "criado" if novo else "já existia", " (compartilhado: subpasta = fotógrafo)" if login in c["compartilhado"] else ""))
print("senha: %s" % c["users"][login])
print("servidor: 192.168.10.10, porta 21 (ou 2121), modo passivo")
if novo or a.compartilhado:
    print("falta religar o Eterna para valer: sudo systemctl restart eterna")
