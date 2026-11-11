#!/bin/bash
# Eterna · SIMULAÇÃO v97 (montagem no servidor), a partir do clone do repositório. Mac (alternativa ao Windows).
# Dois cliques neste arquivo. Na primeira vez instala o recorte local numa pasta própria e baixa os modelos (cerca de
# 1,3 GB); nas seguintes, só abre. Não mexe na instalação de produção do Eterna nem nas portas dela:
#   dados e ambiente em ~/Eterna-simulacao   (apagar essa pasta apaga tudo da simulação)
#   portas 8797 (Eterna), 2197 (FTP) e 8798 (só neste computador)
# Precisa do Python 3.12 ou 3.13 e de 16 GB de memória. Roteiro: docs/SIMULACAO.md
# ATENÇÃO: esta versão não tem o login do servidor. Só em rede de confiança, com fotos de teste; feche ao terminar.
cd "$(dirname "$0")" || exit 1
AQUI="$(pwd)"
fim() { echo; read -n 1 -s -r -p "Aperte uma tecla para fechar."; echo; exit "$1"; }
SIM="${ETERNA_SIM_PASTA:-$HOME/Eterna-simulacao}"
PYSYS=""
for c in python3.13 python3.12 python3; do
  if command -v "$c" >/dev/null 2>&1; then PYSYS="$c"; break; fi
done
if [ -z "$PYSYS" ]; then
  echo "Python 3 não encontrado. Instale o Python 3.12 ou 3.13 em https://www.python.org/downloads/ e rode de novo."; fim 1
fi
"$PYSYS" "$AQUI/iniciar-simulacao.py" --confere-python || fim 1
mkdir -p "$SIM/Eterna" || fim 1
VENV="$SIM/Eterna/venv"
if [ ! -x "$VENV/bin/python3" ]; then
  echo "Criando o ambiente da simulação em $VENV ..."
  "$PYSYS" -m venv "$VENV" || { echo "Não deu para criar o ambiente."; fim 1; }
fi
# daqui para a frente tudo o que usa a pasta do usuário cai na pasta da simulação (ambiente, modelos e dados)
export ETERNA_SIM_PASTA="$SIM"
export HOME="$SIM"
export PATH="$VENV/bin:$PATH"
if ! "$VENV/bin/python3" "$AQUI/iniciar-simulacao.py" --confere-recorte; then
  echo
  echo "Primeira vez: instalando o recorte local na pasta da simulação."
  echo "Baixa cerca de 1,3 GB e pode levar vários minutos. Ao terminar, aperte uma tecla para continuar."
  echo
  bash "$AQUI/instalar-recorte.command"
  cd "$AQUI" || exit 1
  if ! "$VENV/bin/python3" "$AQUI/iniciar-simulacao.py" --confere-recorte; then
    echo "O recorte local não ficou instalado. Veja a mensagem acima, confira a internet e rode este arquivo de novo."; fim 1
  fi
fi
"$VENV/bin/python3" "$AQUI/iniciar-simulacao.py"
echo "A simulação foi encerrada."
fim 0
