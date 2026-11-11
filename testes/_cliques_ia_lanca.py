# v93 (testador): sobe o agente de verdade com o recorte falso dos testes (m.REC_FALSO_SEG, a única chave do recorte falso;
# a variável de ambiente é ignorada). Uso: python3 -I -u testes/_cliques_ia_lanca.py agente/eterna-agente.py <segundos>
# Tudo o mais vem do ambiente (HOME, ETERNA_PORTA, ETERNA_FTP_PORTA, ETERNA_SESSAO_PAUSA...). Nunca em produção.
# O recorte falso copia a foto; aqui a cópia vira PNG com o verde puro (0, 200, 0) transparente, para a montagem do app ter
# uma pessoa recortada (fotos sintéticas de testes/_cliques_ia_semear.py; foto só de verde = sem pessoa).
import importlib.util, os, sys

sp = importlib.util.spec_from_file_location("eterna_agente", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.REC_FALSO_SEG = float(sys.argv[2])
if os.environ.get("ETERNA_TESTE_MONT_MEM_GB"):       # máquina de teste dividida: memória livre mínima para montar
    m.MONT_MEM_MIN_GB = float(os.environ["ETERNA_TESTE_MONT_MEM_GB"])
_fazer = m.rec_fazer


def _png(f):
    try:
        with open(f, "rb") as fh:
            if fh.read(2) != b"\xff\xd8":
                return
        import numpy as np
        from PIL import Image
        a = np.asarray(Image.open(f).convert("RGBA")).copy()
        verde = (a[:, :, 1] > 140) & (a[:, :, 0] < 90) & (a[:, :, 2] < 90)
        a[verde] = 0
        Image.fromarray(a, "RGBA").save(f + ".v.tmp", "PNG")
        os.chmod(f + ".v.tmp", 0o600)
        os.replace(f + ".v.tmp", f)
    except FileNotFoundError:
        pass


def rec_fazer(pid, origem, lado=m.REC_LADO_MAX):
    r = _fazer(pid, origem, lado)
    for lx in m.REC_LADOS:
        _png(m.rec_arquivo(pid, lx))
    return r


m.rec_fazer = rec_fazer
m.main()
