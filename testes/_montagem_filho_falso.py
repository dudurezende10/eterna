# Processo de montagem dos TESTES (nunca em produção: o agente só o usa se o teste trocar m.MONT_FILHO). É o
# agente/eterna-montagem.py de verdade (protocolo, caminhos, gravação); só acrescenta uma espera antes de montar quando o
# arquivo indicado em MONTAGEM_FALSO_TRAVA existe (teste do filho morto no meio de uma montagem).
import importlib.util, os, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("eterna_montagem", os.path.join(AQUI, "..", "agente", "eterna-montagem.py"))
M = importlib.util.module_from_spec(sp)
sp.loader.exec_module(M)
_montar = M.montar


def montar(*a, **k):
    trava = os.environ.get("MONTAGEM_FALSO_TRAVA")
    t0 = time.time()
    while trava and os.path.exists(trava) and time.time() - t0 < 30:
        time.sleep(0.05)
    return _montar(*a, **k)


M.montar = montar
if __name__ == "__main__":
    sys.exit(M.main())
