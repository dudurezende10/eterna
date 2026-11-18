# 18/11 (regra 19): processo de CENA falso para os testes do agente (nunca em produção: o agente só o usa se o teste puser
# m.CENA_FALSO = este caminho). Usa o protocolo, a validação de caminhos, o pré-processamento e os sinais do
# agente/eterna-recorte.py de verdade (main_cena, cena_lote, cena_preparar); só o CLIP é trocado por um vetor determinístico
# pela cor média da miniatura (512 "protótipos" de cor com semente fixa: fotos de cor parecida dão vetores parecidos).
# CENA_FALSO_NAO_ABRE=1: responde sem_modelo. CENA_FALSO_DORMIR=<s>: cada lote demora. CENA_FALSO_MORRE=1: morre no 1º lote.
import importlib.util, os, sys, time
AQUI = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location("eterna_recorte", os.path.join(AQUI, "..", "agente", "eterna-recorte.py"))
R = importlib.util.module_from_spec(sp)
sp.loader.exec_module(R)


class FalsoCena:
    provedor = "cpu"
    carga_ms = 1
    nome = "clip-b32"
    sha = "0" * 64

    def __init__(self, modelos_dir, gpu, arq=None, sha=None):
        import numpy as np
        if os.environ.get("CENA_FALSO_NAO_ABRE"):
            raise R.SemModelo("sem_modelo")
        self.P = np.random.RandomState(7).rand(512, 3).astype(np.float32)

    def vetores(self, lote):
        import numpy as np
        if os.environ.get("CENA_FALSO_MORRE"):
            os._exit(9)
        dorme = float(os.environ.get("CENA_FALSO_DORMIR") or 0)
        if dorme:
            time.sleep(dorme)
        cor = lote.mean(axis=(2, 3)) * np.array(R.CENA_DESVIO, np.float32) + np.array(R.CENA_MEDIA, np.float32)   # cor média 0..1
        d2 = ((cor[:, None, :] - self.P[None, :, :]) ** 2).sum(2)
        return np.exp(-d2 / (2 * 0.06 ** 2)).astype(np.float32)


if __name__ == "__main__":
    sys.exit(R.main_cena(fabrica=FalsoCena))
