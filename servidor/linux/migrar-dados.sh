#!/usr/bin/env bash
# Eterna · traz para o servidor do estádio os dados de outro servidor do Eterna (pacote .tgz com a pasta Eterna de lá).
# O pacote é montado na máquina antiga com os bancos fechados (checkpoint do WAL) e os caminhos já no formato do Linux
# (/srv/eterna/Eterna/...). Fica de fora do pacote: app-cache, modelos, nuvem.env, nuvem-segredo.txt, ftp.json, ftp-tmp, nuvem-tmp.
#
# O que faz, nesta ordem:
#   1. para o Eterna;
#   2. guarda o que existe hoje em /srv/eterna/antes-migracao-<data>.tgz (bancos e configurações; fotos do HD ficam onde estão);
#   3. fotos, vídeos e recortes do pacote vão para o HD (/srv/eterna-midia/<pasta>), somando ao que já existe;
#   4. o resto (bancos, galerias, índice, Roverpix...) substitui o de /srv/eterna/Eterna; nuvem.env, ftp.json e modelos
#      deste servidor continuam os daqui;
#   5. dono eterna, liga o Eterna e confere.
#   sudo bash /opt/eterna/app/servidor/linux/migrar-dados.sh /home/ubuntu/eterna-migracao.tgz
set -Eeuo pipefail
PACOTE="${1:-}"
DADOS=/srv/eterna; MIDIA=/srv/eterna-midia; E="$DADOS/Eterna"
MIDIA_PASTAS="inbox ftp-tmp recortes ativ-videos ativ-clientes ativ-demo"
FICAM="nuvem.env ftp.json modelos app-cache nuvem-segredo.txt"
ok()   { printf '   \033[32mok\033[0m %s\n' "$*"; }
para() { printf '\n\033[1;31mPAROU: %s\033[0m\n' "$*"; exit 1; }
trap 'para "erro na linha $LINENO: $BASH_COMMAND (o antes está em $DADOS/antes-migracao-*.tgz)"' ERR
[ "$(id -u)" = 0 ] || { echo "Rode com sudo"; exit 1; }
[ -s "$PACOTE" ] || para "pacote não encontrado: $PACOTE"
findmnt "$MIDIA" >/dev/null || para "o HD ($MIDIA) não está montado"
tar -tzf "$PACOTE" Eterna/ponto/estado.db >/dev/null 2>&1 || para "o pacote não tem Eterna/ponto/estado.db"

TMP="$DADOS/migracao-tmp"; rm -rf "$TMP"; mkdir -p "$TMP"
tar -xzf "$PACOTE" -C "$TMP"
for db in $(find "$TMP/Eterna" -name '*.db'); do
  [ "$(sqlite3 "$db" 'pragma integrity_check')" = ok ] || para "banco com defeito no pacote: ${db#$TMP/}"
done
ok "pacote aberto e bancos íntegros"

systemctl stop eterna.service
ANTES="$DADOS/antes-migracao-$(date +%Y%m%d-%H%M%S).tgz"
tar -czf "$ANTES" -C "$DADOS" Eterna          # links das pastas do HD entram como links (as fotos não são copiadas)
chmod 600 "$ANTES"
ok "o que havia antes guardado em $ANTES"

for p in $MIDIA_PASTAS; do
  if [ -d "$TMP/Eterna/$p" ] && [ ! -L "$TMP/Eterna/$p" ]; then
    install -d -o eterna -g eterna -m 750 "$MIDIA/$p"
    cp -a "$TMP/Eterna/$p/." "$MIDIA/$p/"
    rm -rf "$TMP/Eterna/$p"
  fi
done
ok "fotos e vídeos somados no HD ($MIDIA)"

for f in $FICAM; do rm -rf "$TMP/Eterna/$f"; done
for x in "$TMP/Eterna/"* "$TMP/Eterna/".[!.]*; do
  [ -e "$x" ] || continue
  n="$(basename "$x")"
  rm -rf "${E:?}/$n"
  mv "$x" "$E/$n"
done
for p in $MIDIA_PASTAS; do [ -L "$E/$p" ] || { rm -rf "${E:?}/$p"; ln -s "$MIDIA/$p" "$E/$p"; }; done
rm -f "$E/ponto/"*.db-wal "$E/ponto/"*.db-shm "$E/"*.db-wal "$E/"*.db-shm
chown -R eterna:eterna "$E" "$MIDIA"/{inbox,ftp-tmp,recortes,ativ-videos,ativ-clientes,ativ-demo}
chmod 700 "$E"
rm -rf "$TMP"
ok "bancos, galerias e configurações no lugar"

systemctl start eterna.service
for i in $(seq 1 30); do curl -sf -m 3 http://127.0.0.1:8765/status >/dev/null && break; sleep 2; done
curl -sf -m 5 http://127.0.0.1:8765/status >/dev/null || para "o Eterna não respondeu depois da migração (journalctl -u eterna)"
V="$(sqlite3 "$E/ponto/vendas.db" 'select count(*) from ativ_venda' 2>/dev/null || echo ?)"
U="$(sqlite3 "$E/ponto/estado.db" "select count(*) from doc where col='usuarios' and valor is not null" 2>/dev/null || echo ?)"
ok "Eterna no ar: $V vendas das ativações, $U usuários"
printf '\nPronto. Os logins e senhas passam a ser os do servidor antigo.\nVoltar ao antes: parar o eterna e abrir %s em %s\n' "$ANTES" "$DADOS"
