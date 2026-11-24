#!/usr/bin/env bash
# Eterna · modelo de visão da classificação de poses (P1 do plano docs/planos/2026-11-23-poses-estatistica.md).
# Roteiro do Ronaldo, uma vez, com sudo, no servidor do estádio:
#   sudo bash /opt/eterna/app/servidor/linux/visao-instalar.sh
# O que faz (cada passo confere antes e pula o que já está certo; pode rodar de novo):
#   1. build-essential, cmake e git; CUDA Toolkit (nvcc) do repositório apt da NVIDIA, na versão fixa CUDA_PACOTE; os
#      pacotes cuda- entram na lista de bloqueio do unattended-upgrades (como os nvidia-): troca só planejada.
#   2. llama.cpp (MIT) na tag fixa LLAMA_TAG, compilado só o llama-server, com CUDA para a placa (sm_120), estático e SEM
#      libcurl (o binário não consegue baixar nada, nem com -hf). Instala em /opt/eterna/visao/bin/llama-server, root:root 755
#      (o usuário eterna executa e não escreve).
#   3. Os dois arquivos do modelo (Qwen3-VL-8B-Instruct, Apache 2.0) em ~/Eterna/modelos do usuário eterna, pelo
#      agente/instalar-poses-modelos.py. Enquanto o POSE_SHA estiver vazio no código, roda com --conferir: baixa e MOSTRA o
#      SHA-256 de cada arquivo, que o Ronaldo confere na página do arquivo no Hugging Face e manda ao programador (como foi
#      com o CENA_SHA). O agente só abre o modelo com os dois SHA fixados no código.
# Nada aqui liga a classificação: ela continua Desligada até alguém trocar a chave em Fundos de IA (técnico).
# Medição (critério 12), depois dos SHA fixados e publicados, à noite, com a classificação Desligada no Eterna:
#   sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/medir-poses.py --n 50
# Plano B, se a compilação com CUDA falhar: o binário Vulkan oficial do mesmo LLAMA_TAG (ver docs/SERVIDOR-ESTADIO.md).
set -Eeuo pipefail

# ---------- versões fixas (conferidas pelo Ronaldo antes de rodar) ----------
LLAMA_TAG="${LLAMA_TAG:-}"            # tag de release do llama.cpp com suporte a Qwen3-VL (ex.: bNNNN); vazio = o script para
CUDA_PACOTE="${CUDA_PACOTE:-cuda-toolkit-13-0}"   # versão fixa do toolkit (nvcc); a mesma geração do driver 595
CUDA_REPO="${CUDA_REPO:-ubuntu2404}"  # pasta do repositório apt da NVIDIA para esta versão do Ubuntu (conferir se já existe a do 26.04)
DADOS="/srv/eterna"                   # home do usuário eterna (~/Eterna fica aqui)
VISAO="/opt/eterna/visao"
# --------------------------------------------------------------------------

LOGI=/var/log/eterna-visao.log
passo() { printf '\n\033[1;34m== %s\033[0m\n' "$*"; echo "[$(date '+%F %T')] == $*" >>"$LOGI"; }
ok()    { printf '   \033[32mok\033[0m %s\n' "$*"; echo "   ok $*" >>"$LOGI"; }
info()  { printf '   %s\n' "$*"; echo "   $*" >>"$LOGI"; }
para()  { printf '\n\033[1;31mPAROU: %s\033[0m\nRegistro: %s\n' "$*" "$LOGI"; echo "PAROU: $*" >>"$LOGI"; exit 1; }
trap 'para "erro inesperado na linha $LINENO: $BASH_COMMAND"' ERR

[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash $0"; exit 1; }
touch "$LOGI"; chmod 600 "$LOGI"
[ -n "$LLAMA_TAG" ] || para "defina LLAMA_TAG com a tag do llama.cpp conferida (ex.: sudo LLAMA_TAG=bNNNN bash $0)"
[[ "$LLAMA_TAG" =~ ^b[0-9]{4,6}$ ]] || para "LLAMA_TAG fora do formato bNNNN: $LLAMA_TAG"
command -v nvidia-smi >/dev/null && nvidia-smi >/dev/null 2>&1 || para "placa NVIDIA sem driver no ar (nvidia-smi): rode antes o instalar.sh e reinicie"
ok "placa: $(nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader)"

passo "1. Ferramentas de compilação e CUDA Toolkit ($CUDA_PACOTE)"
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -q build-essential cmake git >>"$LOGI" 2>&1
ok "build-essential, cmake, git"
if ! dpkg -s cuda-keyring >/dev/null 2>&1; then
  tmp="$(mktemp -d)"
  curl -fsSL "https://developer.download.nvidia.com/compute/cuda/repos/$CUDA_REPO/x86_64/cuda-keyring_1.1-1_all.deb" -o "$tmp/cuda-keyring.deb" \
    || para "não baixei o cuda-keyring do repositório $CUDA_REPO da NVIDIA"
  dpkg -i "$tmp/cuda-keyring.deb" >>"$LOGI" 2>&1
  rm -rf "$tmp"
  apt-get update -q >>"$LOGI" 2>&1
  ok "repositório apt da NVIDIA ($CUDA_REPO)"
fi
dpkg -s "$CUDA_PACOTE" >/dev/null 2>&1 || apt-get install -y -q --no-install-recommends "$CUDA_PACOTE" >>"$LOGI" 2>&1
NVCC="$(ls -d /usr/local/cuda-*/bin/nvcc 2>/dev/null | sort -V | tail -1)"
[ -x "$NVCC" ] || para "nvcc não encontrado depois de instalar $CUDA_PACOTE"
ok "$($NVCC --version | tail -1)"
cat >/etc/apt/apt.conf.d/53eterna-sem-cuda-automatico <<'EOF'
// Eterna: CUDA Toolkit não se atualiza sozinho (o llama-server foi compilado com esta versão; troca planejada)
Unattended-Upgrade::Package-Blacklist { "cuda-"; "libcublas"; "libcudnn"; };
EOF
ok "atualização automática não mexe no CUDA"

passo "2. llama-server ($LLAMA_TAG, CUDA sm_120, sem libcurl)"
install -d -o root -g root -m 755 "$VISAO" "$VISAO/bin"
SRC="$VISAO/src-$LLAMA_TAG"
if [ -x "$VISAO/bin/llama-server" ] && [ -f "$VISAO/bin/llama-server.tag" ] && [ "$(cat "$VISAO/bin/llama-server.tag")" = "$LLAMA_TAG" ]; then
  ok "já instalado ($LLAMA_TAG)"
else
  [ -d "$SRC/.git" ] || git clone --quiet --depth 1 --branch "$LLAMA_TAG" https://github.com/ggml-org/llama.cpp.git "$SRC" >>"$LOGI" 2>&1
  [ "$(git -C "$SRC" describe --tags --exact-match 2>/dev/null)" = "$LLAMA_TAG" ] || para "o código baixado não está na tag $LLAMA_TAG"
  ok "código na tag $LLAMA_TAG ($(git -C "$SRC" rev-parse --short HEAD))"
  export PATH="$(dirname "$NVCC"):$PATH"
  cmake -S "$SRC" -B "$SRC/build" -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=120 -DLLAMA_CURL=OFF -DBUILD_SHARED_LIBS=OFF \
        -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=ON -DCMAKE_BUILD_TYPE=Release >>"$LOGI" 2>&1 \
    || para "cmake falhou (ver $LOGI); plano B: binário Vulkan oficial do mesmo $LLAMA_TAG"
  cmake --build "$SRC/build" --target llama-server -j "$(nproc)" >>"$LOGI" 2>&1 || para "compilação falhou (ver $LOGI); plano B: Vulkan"
  install -o root -g root -m 755 "$SRC/build/bin/llama-server" "$VISAO/bin/llama-server"
  echo "$LLAMA_TAG" >"$VISAO/bin/llama-server.tag"; chmod 644 "$VISAO/bin/llama-server.tag"
  ok "instalado em $VISAO/bin/llama-server"
fi
chown -R root:root "$VISAO/bin"; chmod 755 "$VISAO/bin" "$VISAO/bin/llama-server"
"$VISAO/bin/llama-server" --version >>"$LOGI" 2>&1 || para "o llama-server não roda (ver $LOGI)"
ok "$("$VISAO/bin/llama-server" --version 2>&1 | grep -m1 -i version || echo versão lida)"

passo "3. Modelo (Qwen3-VL-8B-Instruct Q4_K_M + mmproj F16, cerca de 6,2 GB)"
PY="runuser -u eterna -- env HOME=$DADOS /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/instalar-poses-modelos.py"
if grep -qE '^POSE_SHA = "[0-9a-f]{64}"' /opt/eterna/app/agente/instalar-poses-modelos.py; then
  (cd "$DADOS" && $PY) || para "modelo não instalado (ver acima)"
  ok "modelo em $DADOS/Eterna/modelos com o SHA-256 conferido"
else
  (cd "$DADOS" && $PY --conferir) || para "download para conferir falhou"
  info "SHA ainda não fixado no código: mande os dois SHA-256 acima ao programador. Depois de publicado, rode este script de novo."
fi

printf '\n\033[1;32mPronto.\033[0m A classificação continua Desligada. Depois dos SHA fixados e publicados: medir-poses.py (ver docs/SERVIDOR-ESTADIO.md).\n'
