#!/usr/bin/env python3
# Gera o FUNDOS_SHA do eterna-agente.py: SHA-256 de cada arquivo de fundo aprovado (FUNDOS_PREVIA e FUNDOS_IMPRESSAO).
# O servidor do ponto baixa o fundo do app uma vez e só monta com o arquivo que bate com este SHA (a montagem é produto do
# cliente). Rodar na raiz do repositório depois de trocar a imagem de um fundo e colar a saída no agente:
#   python3 agente/gerar-fundos-sha.py
# O teste testes/montagem-paridade.js confere o FUNDOS_SHA do agente com os arquivos de img/.
import hashlib, json, os, re, sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = open(os.path.join(RAIZ, "agente", "eterna-agente.py"), encoding="utf8").read()
arquivos = set()
for nome in ("FUNDOS_PREVIA", "FUNDOS_IMPRESSAO"):
    bloco = re.search(r"^%s = \{(.*?)\}" % nome, src, re.S | re.M).group(1)
    arquivos.update(re.findall(r'"(img/[a-z0-9/_.-]+\.jpg)"', bloco))
linhas = []
for rel in sorted(arquivos):
    with open(os.path.join(RAIZ, rel), "rb") as f:
        linhas.append('    "%s": "%s"' % (rel, hashlib.sha256(f.read()).hexdigest()))
sys.stdout.write("FUNDOS_SHA = {\n" + ",\n".join(linhas) + "}\n")
