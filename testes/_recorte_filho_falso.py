# v97: processo de recorte FALSO para os testes do agente (nunca em produção: o agente só o usa se o teste trocar
# m.REC_FILHO). Usa o protocolo, a validação de caminhos e a gravação do PNG do agente/eterna-recorte.py de verdade; só os
# modelos são trocados por máscaras de cor (pixel com vermelho > 150 é "pessoa") e a pose por nenhuma pessoa.
# RECORTE_FALSO_DORMIR=<s> faz cada foto demorar (teste do filho morto no meio de uma foto).
import importlib.util, os, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("eterna_recorte", os.path.join(AQUI, "..", "agente", "eterna-recorte.py"))
R = importlib.util.module_from_spec(sp)
sp.loader.exec_module(R)


class Falso:
    provedor = "cpu"
    carga_ms = 1

    def __init__(self, modelos_dir, gpu):
        if os.environ.get("RECORTE_FALSO_NAO_ABRE"):
            raise RuntimeError("modelos falsos não abriram")

    def mascaras(self, trab):
        import numpy as np
        dorme = float(os.environ.get("RECORTE_FALSO_DORMIR") or 0)
        if dorme:
            time.sleep(dorme)
        a = np.asarray(trab)
        m = np.where(a[:, :, 0] > 150, 255, 0).astype("uint8")
        return m, m.copy(), m.copy(), {"birefnet": 1, "pessoas": 1, "isnet": 1}

    def pose(self, rgb):
        return []


if __name__ == "__main__":
    sys.exit(R.main(fabrica=Falso))
