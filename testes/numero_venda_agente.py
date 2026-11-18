# Número da venda (15/11): sequência única do dia no servidor, para todas as estações.
import importlib.util, sys
sys.dont_write_bytecode = True
sp = importlib.util.spec_from_file_location("ag", sys.argv[1]); m = importlib.util.module_from_spec(sp); sp.loader.exec_module(m)
ns = [m.numero_venda("2026-11-15")["n"] for _ in range(5)]
outro = m.numero_venda("2026-11-16")["n"]
falhas = []
if ns != [1, 2, 3, 4, 5]: falhas.append("sequência do dia: %s" % ns)
if outro != 1: falhas.append("dia novo começa em 1: %s" % outro)
if m.rota_regra("POST", "/ponto/numero") is None: falhas.append("rota sem regra")
print(("FALHA número da venda: " + " | ".join(falhas)) if falhas else "OK número da venda: sequência única do dia no servidor")
sys.exit(1 if falhas else 0)
