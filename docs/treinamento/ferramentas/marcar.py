# -*- coding: utf-8 -*-
"""Aplica caixa + seta numerada nos prints brutos (capturar.js) e grava os prontos em docs/treinamento/prints/.
   python marcar.py <pasta dos brutos>"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prints_maracatour import marcar

BRUTOS = sys.argv[1]
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prints")
os.makedirs(SAIDA, exist_ok=True)
M = json.load(open(os.path.join(BRUTOS, "marcas.json"), encoding="utf-8"))
for chave, v in M.items():
    marcar(os.path.join(BRUTOS, chave + ".png"), os.path.join(SAIDA, chave + ".jpg"), tuple(v["recorte"]),
           [(tuple(b), d, n) for b, d, n in v["marcas"]])
    print("ok", chave)
