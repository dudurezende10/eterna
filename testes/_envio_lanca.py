# v96-ux (envio manual): sobe o agente de verdade com o piso de disco do envio trocado no módulo (critério 24 do plano
# docs/planos/2026-11-11-minhas-fotos-envio-manual.md). Uso: python3 -I -u testes/_envio_lanca.py agente/eterna-agente.py <piso_gb>
# Tudo o mais vem do ambiente (HOME, ETERNA_PORTA, ETERNA_FTP_PORTA...). Nunca em produção.
import importlib.util, sys

sp = importlib.util.spec_from_file_location("eterna_agente", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
m.FOTO_ENVIO_PISO_GB = float(sys.argv[2])
m.main()
