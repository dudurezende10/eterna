# Plano: Zerar a fase de teste (botão do Admin, 24/11/2026)

Ramo `feat/alertas-fotografo` (HEAD e3407bd, v99.38.0 ainda não publicada). Sai na mesma publicação das 22h30 (sugestão: linha própria `v99.38.1` no VERSOES). Execução às 23h pelo Chrome do Eduardo.

## Objetivo
Às 23h o Admin aperta um botão e o servidor tira das telas tudo o que o Eterna gerou na fase de teste (vendas, sessões, fotos, rostos, galerias, números), guardando tudo numa pasta de arquivo no próprio servidor. Amanhã a operação começa do zero, com o histórico da Roverpix, a bilheteria, o Treino da IA, usuários e configurações intactos.

## Escopo desta entrega
- Agente: inventário (prévia), pedido pelo botão, execução na partida do agente (antes das threads e do HTTP), arquivo em pasta 0700, registro no `login_log`, `/status.zerada`, desfazer por linha de comando (para o Ronaldo).
- Duas correções sem as quais a zeragem quebra a operação (seção "Correções obrigatórias").
- App: cartão no fim do Repositório (só Admin), confirmação digitando ZERAR, espera da volta do servidor e limpeza da cópia local de cada navegador quando o servidor avisa que foi zerado.
- Testes Python com agente real e Playwright.

## Fora do escopo
- Nada na nuvem: galerias já publicadas, vídeos e originais que já subiram ficam lá até a retenção de cada um. O link de QR de um cliente da fase de teste continua abrindo na nuvem.
- Prazo de validade da pasta de arquivo (ver D9).
- Zerar de novo outra vez pela tela (é de uso único, ver D8).
- Qualquer mudança em `BACKUP_BANCOS` (regra do Eduardo).

## Decisões assumidas (o Eduardo pode trocar até 18h)
- **D1 Ativações (Drone, Chute a Gol, Snap Pop):** a regra vira "o que veio do sistema antigo fica, o que o Eterna gerou vai para o arquivo". Ficam as vendas importadas (`ativ_venda` com `origem='antigo'`), cadastros, catálogo, cartões e vídeos de demonstração. Vão para o arquivo as vendas do tablet (`origem='eterna'`), entregas, pulseiras, fotos tiradas do vídeo, vídeos entregues, fotos do cliente e a fila de vídeos da nuvem. **Se as vendas do tablet desde 13/11 foram vendas reais, o Eduardo precisa dizer**: aí as ativações saem desta zeragem e as galerias de vídeo (`tipo: "video"`) e as galerias do Tour ligadas a elas (`tour_token`) ficam fora do arquivo (uns 60 min a mais de programação e teste).
- **D2 Cartões já entregues no teste não podem ir para outro cliente:** o QR do cartão é o token da galeria do vídeo na nuvem; liberar o cartão de novo mostraria o vídeo novo no link do cliente antigo. Os tokens de `ativ_entrega.qr` passam para um lote novo `fase-teste`, com situação `cancelado`. A Entrega já recusa cartão de lote cancelado. O lote aparece no painel de cartões com esse nome.
- **D3 `cena.db` fica inteiro (não vai para o arquivo):** o reconhecimento do ponto Ligado usa os vetores das fotos marcadas no Treino (tabela `modelo` aponta para pids, os vetores estão em `cena`). Apagar `cena` derrubaria as bases dos fundos de IA amanhã. Cópia de segurança vai para o arquivo. As linhas sem rótulo saem sozinhas na limpeza de hora em hora.
- **D4 `index.json` fica:** é a lista de impressões digitais (hash) das fotos já recebidas. Sem ela, a pasta do FTP (vsftpd, `ETERNA_PASTA`) devolveria na partida as fotos das últimas 12 h como novas. Com ela, foto de teste reenviada cai como repetida.
- **D5 `estado.db`:** só a tabela `pedido` (pedidos do Checkout, os abertos aparecem para sempre no Posto) é esvaziada. Usuários, senhas, sessões de login, postos, leitores, permissões, preços, configurações, `venda_seq` e a coleção `doc` ficam. Consequência: ficam visíveis o registro de cortesias do teste (Galerias › Cortesias, `sim/cortesiaLog|*`), o Diário do set (`diario`) e a contagem de bandeiras do Checkout (`sim/flagUse|*`). Se o Eduardo quiser zerar esses três, são 3 linhas a mais no passo 6.
- **D6 Treino da IA:** `treino.db` não é tocado (cópia no arquivo). As 10 mil marcações ficam e a Medição continua (vetores do `cena.db`). Consequência: em Treino › Marcar, os dias de teste somem da lista (as fotos foram para o arquivo). A medida de luz das fotos sem marcação sai sozinha nas próximas madrugadas (`luz_limpa`, foto fora da biblioteca); a das marcadas fica para a calibração.
- **D7 Escolas:** `escolas.json` e `escolas-numeros.json` vão com as galerias (painel Escolas zera). Sem sessões, o laço das escolas não remonta galeria de voucher antigo (`escola_montar` devolve None sem fotos).
- **D8 Uso único:** com `ponto/zerada.json` presente, o botão recusa (`ja_zerado`). Para usar de novo (outro venue, emergência), o Ronaldo renomeia o arquivo.
- **D9 LGPD do arquivo:** a pasta guarda rostos (`rostos.db`) e fotos de visitantes sem prazo. Sugestão: o Eduardo marca um prazo (30 dias, igual à biblioteca) e o Ronaldo apaga a pasta depois. Fica anotado no `resumo.json`.
- **D10 Diagnóstico da selfie** (`diagnostico/selfie/*.jsonl`): fica onde está. Só tem ids e números, vence em 30 dias e os ids não abrem mais nada.
- **D11 Backup na nuvem:** depois da zeragem, os bancos mudados sobem e substituem `backup/<pc>/<banco>` e a cópia do dia `dia/2026-11-24/`. A cópia de 23/11 na nuvem e a pasta de arquivo local guardam o teste. Os JSON antigos de sessões e métricas na nuvem não são apagados.

## Como funciona (mecanismo)
1. Botão → `POST /zerar/fase-teste` grava `~/Eterna/ponto/zerar-pedido.json` (0600) e responde 202. Uma thread espera 1,5 s e chama `os._exit(0)`. O systemd religa (`Restart=always`, `RestartSec=5`, `KillMode=mixed` derruba os filhos de recorte, montagem e poses).
2. Na partida, no `if __name__ == "__main__":` antes de `main()` (nenhuma thread, nenhum filho, nenhum HTTP ainda): `zerar_partida()`. Se houver pedido com menos de 10 min, troca por `zerar-andamento.json` (`os.replace`) e roda os passos. Pedido mais velho vira `zerar-expirado.json` e nada acontece.
3. Terminou: grava `ponto/zerada.json` e faz `os.execv(sys.executable, sys.orig_argv)` (o módulo já tinha carregado `meta`, `lib` e `seen` do disco antigo na importação; reexecutar evita qualquer cache velho em memória).
4. Mover é sempre `os.rename` no mesmo disco. Nunca renomear a pasta em si (`inbox`, `recortes`, `montagens`, `ativ-*` são links para o HD de 4 TB e `/srv/eterna-midia` é do root): move-se **o conteúdo** de cada pasta. Disco diferente entre origem e destino = recusa no passo 1, antes de mexer em qualquer coisa.
5. Duas pastas com o mesmo nome `fase-teste-AAAAMMDD-HHMM` (0700):
   - NVMe: `~/Eterna/arquivo/<id>/` (bancos, sessões, métricas, galerias, miniaturas, rostos, poses e o registro).
   - HD de fotos: `<realpath(INBOX)>/.arquivo/<id>/` (originais, recortes, montagens, vídeos e fotos das ativações). Dentro da inbox porque é a única pasta do HD que o usuário `eterna` pode escrever; o ponto no começo do nome a esconde de quem varre a inbox (ver correções).
6. Cada passo é idempotente e grava uma linha em `~/Eterna/arquivo/<id>/passos.jsonl` (`{passo, ok, n, erro, em}`). Mover: origem existe e destino não = move; origem sumiu e destino existe = já feito; os dois existem = erro. SQL: cada banco numa transação; apagar de novo é nada.
7. Falha:
   - no passo 1 (conferências): nada foi tocado; `zerar-falhou.json` com o motivo e o agente sobe normal;
   - no meio: os bancos já estão copiados (passo 2 vem antes de qualquer mudança). O `zerar-andamento.json` fica com `tentativas+1` e o agente sai (o systemd religa e retoma do ponto em que parou). Na 3ª tentativa, vira `zerar-falhou.json` com o passo em que parou, e o agente sobe normal. O cartão mostra "Zeragem incompleta: parou em <passo>. Chame o Ronaldo";
   - o vigia religa o agente se o `/status` falhar 3 vezes seguidas, com 30 s entre as checagens (~90 s); a zeragem leva segundos e, se for cortada, retoma sozinha.

## Inventário (conferido no código)

| Item | Onde | O que acontece | Por quê |
|---|---|---|---|
| `vendas.db` `evento` | ponto/ | apaga as linhas | vendas, pagamentos, impressões do teste |
| `vendas.db` `selfie` | ponto/ | apaga | estatística de selfie do teste |
| `vendas.db` `ativ_venda` origem `eterna`, `ativ_entrega`, `ativ_pulseira`, `ativ_pulseira_log`, `ativ_foto` | ponto/ | apaga (D1) | geradas no teste |
| `vendas.db` `ativ_venda` origem `antigo`, `ativ_cadastro`, `cartao`, `cartao_lote` | ponto/ | fica (cartões usados mudam de lote, D2) | histórico antigo e material impresso |
| `operacao.db` `fotografo_dia`, `fotografo_mes`, `fotografo_dia_calc`, `montagem_vista` | ponto/ | apaga | números e alertas dos fotógrafos, selo |
| `operacao.db` `dia` | ponto/ | nas linhas com `fonte_vendas='eterna'`: `fonte_vendas, vendas, receita, fotos, sessoes, sessoes_com_venda` = null | `dia_consolidar` nunca zera fonte que sumiu; com null, o `dia_completo` da partida refaz pela Roverpix |
| `operacao.db` `entrada`, `entrada_total`, `importacao`, demais colunas de `dia` | ponto/ | fica | bilheteria e calendário |
| `nuvem.db` `fila`, `galerias`, `videos` | HOME | apaga | fila de envio de fotos, galerias e vídeos do teste |
| `nuvem.db` `cursor` | HOME | fica | sem ele, as vendas online já importadas voltariam |
| `estado.db` `pedido` | ponto/ | apaga (D5) | pedidos do Checkout |
| resto do `estado.db` | ponto/ | fica | usuários, senhas, postos, leitores, permissões, configurações |
| `backup-originais.db` `feito` | HOME | linhas vão para a tabela nova `arquivado` | sem isso, o script dos originais acha "faltam N fotos" para sempre e trava toda exclusão LGPD na nuvem (regra dos 10%) |
| `treino.db`, `cena.db` | ponto/ | ficam; cópia no arquivo | D3, D6 |
| `rostos.db` (+`-wal`, `-shm`) | HOME | move | rostos do teste; o reconhecimento de amanhã começa vazio |
| `poses.db` (+`-wal`, `-shm`) | ponto/ | move | poses do teste (`poses-sha.json` fica) |
| `ponto/sessoes/*`, `ponto/metricas/*`, `ponto/visitas/*`, `visitas-log.jsonl`, `visitas-calibracao.jsonl` e `.1` | ponto/ | move | sessões, Painel, visitas |
| `galerias/*` (manifestos, vitrines, `escolas*.json`, `encerradas.json`, `vendas-online.jsonl`, `consentimentos.jsonl`, `alertas.jsonl`) | HOME | move | galerias e vendas online do teste (consentimentos ficam guardados no arquivo) |
| `thumbs/*`, `meta.json`, `metricas.jsonl`, `envio-dia.json`, `leitor-dia.json` | HOME | move | biblioteca e contadores |
| `impressao/fila.json`, `impressao/*.jpg`, `impressao/lista_*.txt` | HOME | move se existir (os `.ps1` ficam) | fila de impressão |
| `inbox/*` (menos `.arquivo`) | HD | move | originais do teste |
| `recortes/*` (menos nomes com ponto, como `.versao`) | HD | move | recortes |
| `montagens/*` (inclui `vendidas/`) | HD | move | montagens |
| `ativ-videos/*`, `ativ-clientes/*` | HD | move (D1) | vídeos e fotos de cliente do teste |
| `ativ-demo/`, `roverpix/`, `fundos/`, `fundos-ia/`, `modelos/`, `app-cache/`, `index.json`, `lgpd-excluidas.json`, `lgpd.log`, `ftp-remoto-vistos.json`, chaves `*.json`, `funcao.json`, `agenda-fonte.json`, `backup-ok.txt` | | fica | configuração, histórico antigo, LGPD, D4 |
| caches em memória (`lib`, `meta`, `sess`, `cena_mem`, rostos pendentes, contadores do `/status`) | | somem no `os.execv` | |
| cópia local de cada navegador | localStorage | limpa quando `/status.zerada` muda (ver App) | SIM, rostos do navegador e filas antigas |

## Correções obrigatórias (entram junto, sem elas a zeragem quebra a operação)
1. **`cena_limpa`** (`agente/eterna-agente.py`, por volta da linha 16104): hoje a linha de foto fora da biblioteca é apagada **antes** de conferir `guardar`, e isso contradiz a docstring. Com a inbox no arquivo, na primeira limpeza de hora em hora sumiriam os vetores do modelo congelado e das fotos marcadas: o ponto Ligado deixa de reconhecer e as bases dos fundos de IA param. Trocar a ordem: `if p in guardar: continue` vem antes de `if p not in vivas: delete`. A LGPD continua: `treino_lgpd` → `cena_lgpd` apaga explicitamente.
2. **`load_lib`** (linha 604): `os.walk(INBOX)` desce em tudo; podar pastas que começam com ponto (`dirs[:] = [d for d in dirs if not d.startswith(".")]`), senão o arquivo volta para a biblioteca na partida e os rostos seriam lidos de novo.
3. **`servidor/linux/backup-originais.py` `arquivos()`**: pular nomes com ponto no `os.listdir(INBOX)` (hoje já não sobe nada de lá, porque só olha 2 níveis, mas fica explícito).

## Mudanças por arquivo

### `agente/eterna-agente.py`
Bloco novo "Zerar fase de teste", perto do backup:
- Constantes: `ZERAR_PEDIDO`, `ZERAR_ANDA`, `ZERAR_FALHOU`, `ZERAR_EXPIRADO` (em `HOME/ponto/`), `ZERAR_FEITA = HOME/ponto/zerada.json`, `ARQUIVO_DIR = HOME/arquivo`, `ARQUIVO_MIDIA = os.path.join(os.path.realpath(INBOX), ".arquivo")`, `ZERAR_PEDIDO_MAX_S = 600`, `ZERAR_TENTATIVAS = 3`. `ZERADA_ID` global, lido de `zerada.json` no carregamento do módulo (None sem arquivo).
- `zerar_id(agora)` → `fase-teste-AAAAMMDD-HHMM` no fuso do venue (sufixo `-2`, `-3` se a pasta existir).
- `zerar_inventario()` → `{"vai": {...}, "fica": {...}}` só com contagens (formato em Contratos). Só leitura; bancos abertos com `mode=ro` pela URI do sqlite.
- `zerar_bloqueios()` → lista de códigos: `ja_zerado`, `em_andamento` (pedido ou andamento presente), `sem_supervisor` (sem `INVOCATION_ID` no ambiente e sem `ETERNA_MODO_TESTE=1`), `sistema` (`os.name != "posix"`), `pasta_midia` (sem escrita em `realpath(INBOX)`), `outro_disco` (algum item a mover em disco diferente da pasta de arquivo correspondente, por `st_dev`), `link_inesperado` (pasta do NVMe da lista que é link), `espaco` (livre no NVMe < 2 × soma dos bancos copiados + 1 GB).
- `zerar_passos(id)` → lista ordenada `(nome, função)`; a mesma lista serve à execução e ao desfazer:
  1. `preparo`: cria as duas pastas 0700 (`os.makedirs` + `os.chmod`, por causa do umask), roda `zerar_bloqueios()` sem os dois primeiros códigos; qualquer código = falha sem mexer;
  2. `copias`: `sqlite3 backup()` de `vendas.db`, `operacao.db`, `nuvem.db`, `estado.db`, `treino.db`, `cena.db` e `backup-originais.db` (se existir) para `<arq>/bancos/`, 0600;
  3. `vendas`: numa transação, insere `cartao_lote` (`id='fase-teste'`, `n`, `em`, `por='Eterna'`, `situacao='cancelado'`) se houver entrega, `update cartao set lote='fase-teste' where token in (select qr from ativ_entrega)`, depois os `delete` da tabela;
  4. `operacao`; 5. `nuvem`; 6. `estado` (`delete from pedido`); 7. `originais` (`create table if not exists arquivado` com as colunas de `feito` + `arquivo`; `insert`, `delete from feito`);
  8. `mover_nvme` e 9. `mover_midia`: `_zerar_mover(src_dir, dst_dir)` move cada entrada (menos nomes com ponto) com `os.rename`; arquivos soltos com `_zerar_mover_arq`. Recriar vazias as pastas que o agente espera (`thumbs`, `sessoes`, `metricas`, `galerias`, `visitas`) se alguma tiver sumido;
  10. `fim`: `resumo.json` (id, `por`, `em`, versão, contagens antes e depois, `prazo_sugerido` D9), `zerada.json` (`{id, em, por, pasta}`, 0600), `auth_log(db, por, "zerar_feito", por, "")`, apaga `zerar-andamento.json`. Linha no console: `zerar: <id> feito (N fotos, M sessões, ...)`, só números.
- Revisão de 24/11: `originais` passou para depois de `mover_midia` (ordem: preparo, copias, vendas, operacao, nuvem, estado, mover_nvme, mover_midia, originais, fim), para a tabela `feito` não ser esvaziada com as fotos ainda na inbox. O `preparo` também recusa (`sem_escrita`) pasta a mover sem permissão de escrita, e `copias` apaga a `.tmp` que sobrou. O `__main__` chama `zerar_partida_segura()`: erro fora dos passos (andamento, `passos.jsonl`, `zerar-falhou.json`) vira `zerar-falhou.json` e o agente sobe normal; andamento que já chegou a `ZERAR_TENTATIVAS` não tenta de novo.
- `zerar_partida()` → chamada no `__main__` antes de `main()`; devolve True quando executou (o `__main__` então faz `os.execv`). Teste: `ETERNA_ZERAR_FALHA_PASSO=<nome>` levanta erro naquele passo, só com `ETERNA_MODO_TESTE=1`.
- `zerar_desfazer(id, sobrescrever)` + CLI `--desfazer-zeragem <id> [--sobrescrever]`: recusa se a porta do agente responde (serviço no ar). Na ordem inversa: devolve os arquivos (se o nome já existe no lugar, o atual vai para `<arq>/pos-zeragem/` antes); `vendas.db`, `operacao.db` e `nuvem.db` voltam da cópia (apaga `-wal`/`-shm` antes); se o banco atual tiver evento de venda depois da zeragem, só com `--sobrescrever`; `estado.db`: `insert or ignore into pedido` a partir da cópia (usuários feitos depois ficam); `backup-originais.db`: `insert or ignore into feito select ... from arquivado`; `zerada.json` vira `zerada-desfeita-<id>.json`. Imprime o que voltou.
- Rotas (em `ROTAS`): `("GET", "/zerar/previa", "sessao", ("configuracao.u",))` e `("POST", "/zerar/fase-teste", "sessao", ("configuracao.u",))`. As duas conferem também: sessão com `cadastro.preset == "admin"` e sem `assumido_por` (403 `so_admin`), `posto()` e `origem_local()` como o `agenda_rota`, `nostore`. O POST também confere `X-Eterna: 1`, `limite_ok(ip, "zerar", 2)`, corpo até 1 KB e `confirma == "ZERAR"` exato (400 `confirma`). O "ver como" já cai no 403 `so_ver` do `do_POST`.
  - `zerar_get`: `limite_ok(ip, "zerar_previa", 6)`; devolve a prévia.
  - `zerar_post`: com bloqueio, 409 `{error, bloqueios}`. Senão grava o pedido (`{id, por, por_nome, em, ip}`), `auth_log(db, usuario, "zerar_pedido", usuario, ip)`, responde 202, esvazia a saída e começa a thread de saída.
- `/status` mínimo (linha ~20591): `"zerada": ZERADA_ID`.
- `load_lib` e `cena_limpa`: correções acima.

### `servidor/linux/backup-originais.py`
- `arquivos()`: `if dia.startswith("."): continue`.

### `index.html`
- `vRepo()`: no fim, `${zerarPainel()}`.
- `zerarPainel()`: só com `isAdminUser(state.user) && !state.assumido && state.agent.on && state.agent.url===location.origin`; nos outros casos devolve ''. Classes `zr-` (reaproveitar `.panel`, `.btn`, `.pill`; botão final `btn danger`).
  - Sem prévia: título, nota (`zr_nota`) e botão `data-act="zerar-previa"`.
  - Com prévia: duas listas "Vai para o arquivo" e "Fica como está", com contagens (`zr_n_*`); `ultima` (zeragem feita, com data dd/mm/aaaa hh:mm, quem e pasta) ou `falha`; bloqueios em texto (`zr_bq_*`) e, nesse caso, sem campo nem botão.
  - Campo `<input id="zr-txt" autocomplete="off">` (fora de `data-act`, lido no clique) e botão `data-act="zerar-ir"`.
- `state.zerar = {previa, erro, enviando, espera}` (só memória).
- `case 'zerar-previa'`: `GET /zerar/previa` com `agFetch`; erro → `zr_erro`.
- `case 'zerar-ir'`: com `state.assumido` → toast `vc_so_ver`; valor do campo diferente de `ZERAR` (maiúsculas, sem espaço) → `zr_txt_errado` sem POST; senão `POST` com `X-Eterna: 1` e `{confirma:"ZERAR"}`. 202 → `auditLog('zerar_fase_teste','sistema',{id, ...contagens})` só com números, `state.zerar.espera={id, desde}`, tela "O servidor está reiniciando..." (`zr_espera`) e `zerarEspera()` (pede `/status` a cada 2 s; passou de 3 min: `zr_demorou`). 409 → mostra os bloqueios. 
- `ACT_MOD`: `'zerar-ir':'configuracao'`, `'zerar-previa':'configuracao'`; `WRITE_OPS`: `zerar-ir` com `u`.
- `zeradaConfere(st)` em `agentPoll`, logo depois de `if(!st.ok)` e só com `a.url===location.origin`: `st.zerada` no formato `^fase-teste-\d{8}-\d{4}(-\d+)?$` e diferente de `localStorage['eterna.zerada.v1']` → `zeradaAplica(id)`.
- `zeradaAplica(id)`: `ZERADA_SAINDO=true` (o `saveSim` não grava mais), `removeItem` de `ZERADA_LIMPA = ['eterna.sim.v1','eterna.faces.v3','eterna.ponto.fila.v1','eterna.ponto.descartes.v1','eterna.ponto.conflitos.v1','eterna.edvistas.v1','eterna.agcur']`, grava `eterna.zerada.v1 = id`, `location.reload()`. Fica: sessão, usuários, posto, vendedor, idioma, preferências, `eterna.treino.v1` e `eterna.treino.fila.v1` (marcações), catálogo, IA, busca, venue, `eterna.ponto.seq*`.
- `EQ` (pt, en, es): `zr_titulo`, `zr_nota`, `zr_ver`, `zr_vai`, `zr_fica`, `zr_digite`, `zr_botao`, `zr_txt_errado`, `zr_espera`, `zr_demorou`, `zr_feito` (data, quem, pasta), `zr_falhou` (passo), `zr_erro`, `zr_bq_ja_zerado`, `zr_bq_em_andamento`, `zr_bq_sem_supervisor`, `zr_bq_sistema`, `zr_bq_pasta_midia`, `zr_bq_outro_disco`, `zr_bq_link_inesperado`, `zr_bq_espaco`, e um `zr_n_<chave>` para cada contagem do contrato.

### Documentação (documentador)
- `docs/CONTEXTO-ETERNA.md`: um item "Zerar fase de teste (24/11)".
- `docs/SERVIDOR-ESTADIO.md`: seção "Desfazer a zeragem" (passo a passo abaixo).
- `VERSOES.md`: linha da versão.

## Contratos

`GET /zerar/previa` → 200
```json
{"ok": true, "pode": true, "bloqueios": [],
 "vai": {"fotos": 0, "dias_fotos": 0, "miniaturas": 0, "sessoes": 0, "dias_sessoes": 0, "vendas": 0, "eventos": 0,
         "pedidos": 0, "galerias": 0, "rostos_fotos": 0, "rostos": 0, "poses": 0, "dias_metricas": 0, "visitas": 0,
         "recortes": 0, "montagens": 0, "selfies": 0, "fotografo_dias": 0, "fila_nuvem": 0,
         "ativ_vendas": 0, "ativ_entregas": 0, "ativ_videos": 0, "cartoes_bloqueados": 0},
 "fica": {"usuarios": 0, "postos": 0, "leitores": 0, "treino_marcacoes": 0, "dias_roverpix": 0, "dias_entradas": 0,
          "cartoes": 0, "ativ_vendas_antigas": 0},
 "ultima": null, "falha": null}
```
- `ultima`: `{"id": "fase-teste-20261124-2300", "em": "<ISO>", "por": "<nome>", "resumo": {"vai": {...}}}`.
- `falha`: `{"id", "em", "passo", "motivo"}` (`motivo` só código, nunca caminho completo nem texto de exceção).

`POST /zerar/fase-teste` com `X-Eterna: 1`, corpo `{"confirma": "ZERAR"}`:
- 202 `{"ok": true, "id": "fase-teste-...", "vai": {...}, "reinicia": true}`
- 400 `{"error": "confirma"}` · 403 `so_admin` / `so_ver` / origem · 409 `{"error": "bloqueado", "bloqueios": [...]}` · 429.

`GET /status` (mínimo, público): ganha `"zerada": "fase-teste-..." | null`.

Arquivos (0600): `ponto/zerar-pedido.json` `{id, por, por_nome, em, ip}`; `ponto/zerada.json` `{id, em, por, pasta}`; `arquivo/<id>/passos.jsonl`; `arquivo/<id>/resumo.json`.

`login_log.acao`: `zerar_pedido`, `zerar_feito`, `zerar_falhou`, `zerar_expirado`.

## Critérios de aceite
1. O cartão "Zerar fase de teste" aparece no fim do Repositório só para o Admin. Supervisor, outros perfis, Admin em "ver como" e app aberto pelo eterna.photo (agente em outra origem) não veem.
2. Textos do cartão nas três línguas da equipe (pt, en, es), sem chave crua na tela.
3. "Ver o que vai ser guardado" mostra as contagens de "vai" e "fica" iguais às do banco e das pastas semeadas no teste.
4. Sem digitar `ZERAR` exato (inclusive `zerar` e ` ZERAR `), nenhum POST sai e aparece o aviso.
5. POST sem `X-Eterna`, de outra origem, sem sessão, de não Admin com `configuracao.u` ou em "ver como" é recusado (403) e nada é gravado.
6. Sem supervisor (sem `INVOCATION_ID` e sem modo de teste), a prévia mostra `sem_supervisor` e o POST dá 409.
7. POST válido responde 202, grava o pedido e uma linha `zerar_pedido` no `login_log` (quem, quando, IP), e o processo sai em até 5 s.
8. Na partida seguinte, antes do HTTP abrir, tudo o que a tabela do inventário marca "move" está em `arquivo/<id>/` ou `inbox/.arquivo/<id>/`, as pastas originais existem e estão vazias, e as tabelas marcadas "apaga" estão vazias.
9. Ficam idênticos (mesmo SHA-256 do conteúdo das tabelas): `treino.db` inteiro, `cena.db` inteiro, usuários, credenciais, sessões de login, postos, leitores e `doc` do `estado.db`, `entrada`, `entrada_total`, `importacao`, `ativ_venda` origem `antigo`, `ativ_cadastro`, `cartao_lote` antigos, `nuvem.db` `cursor`, `roverpix/`, `index.json`, `lgpd-excluidas.json`, `fundos/`, `fundos-ia/`, `ativ-demo/`.
10. Cartão com entrega no teste fica no lote `fase-teste` cancelado e a Entrega recusa esse cartão; cartão sem entrega segue aceito.
11. Linha de `dia` que era `eterna` volta como `roverpix` quando há arquivo da Roverpix do dia, ou com vendas nulas sem ele; entradas e marcas do calendário não mudam.
12. Depois de voltar: `/status.zerada` = id; `/biblioteca` vazia; `/sessoes` vazia; `/metricas/dia` sem vendas do Eterna; `/fotografos/dias` vazio; `/rostos/buscar` com o rosto de uma foto do teste não acha nada; Galerias vazias; Estatísticas ainda mostram Roverpix e bilheteria.
13. Pasta de arquivo e arquivos com permissão 0700/0600; `resumo.json` e o console só com números (nenhum id de foto, sessão, token ou nome de cliente).
14. Foto do teste que está na pasta do FTP (`ETERNA_PASTA`, chegada nas últimas 12 h) não volta na partida (cai como repetida).
15. Na partida, `load_lib` ignora `inbox/.arquivo`; nenhuma foto do arquivo entra na biblioteca nem na fila de rostos.
16. Depois de uma rodada de `cena_limpa`, os vetores das fotos marcadas no Treino e das versões em `modelo` continuam; o reconhecimento do ponto Ligado classifica foto nova como antes; linha sem rótulo fora da biblioteca sai.
17. `backup-originais.py` depois da zeragem: não apaga nada na nuvem, não imprime "faltam N fotos", sobe as fotos novas, e uma exclusão LGPD de foto nova volta a apagar o original na nuvem.
18. Segundo POST depois de feito: 409 `ja_zerado`. POST com pedido ou andamento presente: 409 `em_andamento`.
19. Pedido com mais de 10 min na partida não executa: vira `zerar-expirado.json` e grava `zerar_expirado`.
20. Disco diferente, falta de espaço ou pasta do HD sem escrita: recusa no `preparo`, nenhum arquivo ou banco mudou, `zerar-falhou.json` com o código, o agente sobe normal e o cartão mostra o motivo.
21. Falha forçada no meio (`ETERNA_ZERAR_FALHA_PASSO=mover_midia`): a partida seguinte retoma e termina com o mesmo resultado do critério 8. Com a falha mantida, na 3ª vez vira `zerar-falhou.json` com o passo, e o agente sobe e responde `/status`.
22. Navegador com SIM, rostos e fila antigos (Posto, Checkout `#loja` e a aba do Admin): no primeiro `/status` com `zerada` nova, limpa só as chaves de `ZERADA_LIMPA`, recarrega uma vez e não volta a recarregar; sessão, posto, idioma e a fila do Treino continuam.
23. Depois da limpeza, nenhuma sessão, venda, galeria ou pedido do teste aparece em Posto, Checkout, Painel, Lista de vendas, Galerias, Minhas fotos, Fila do fotógrafo, Fotógrafos e Estatísticas.
24. `--desfazer-zeragem <id>` com o agente parado devolve os arquivos e bancos: contagens da prévia iguais às de antes da zeragem; com o agente no ar, recusa; com venda nova depois da zeragem, só com `--sobrescrever`.
25. `testes/rodar.sh` passa inteiro (incluindo `seguranca_rotas_agente.py` com as duas rotas novas na matriz e o `backup_originais_envio.py`).

## Testes
- `testes/zerar_fase_teste_agente.py` (novo, no `rodar.sh`): HOME temporário com a inbox, os recortes, as montagens e as `ativ-*` como links para uma pasta "mídia" (como no estádio); semeia cada item do inventário; sobe o agente em subprocesso com `ETERNA_MODO_TESTE=1`, `ETERNA_SEM_OPENCV=1` e `ETERNA_PASTA`; cookies por `_agente_sessao.py`; religa o agente quando ele sai (faz o papel do systemd). Cobre os critérios 3, 5 a 21 e 24. Para o 12 com rosto, usa o caminho de rostos que os testes de selfie já usam ou confere `rostos.db` vazio, se o OpenCV estiver desligado.
- `testes/backup_originais_envio.py`: casos do `.arquivo` e da tabela `arquivado` (critério 17).
- `testes/cena_agente.py`: caso novo da ordem do `cena_limpa` (critério 16).
- `testes/zerar-fase-teste.js` (Playwright, novo): agente real; Admin, Supervisor e "ver como" (1); troca de idioma (2); prévia (3); `zerar`/`ZERAR` (4); fluxo completo com o religar feito pelo teste; segunda página `#loja` com SIM antigo (22, 23).
- `testes/seguranca_rotas_agente.py`: as duas rotas novas.

## Desfazer (para o Ronaldo, com sudo)
1. `sudo systemctl stop eterna-vigia eterna`
2. `sudo -u eterna env HOME=/srv/eterna /opt/eterna/venv/bin/python -I /opt/eterna/app/agente/eterna-agente.py --desfazer-zeragem fase-teste-AAAAMMDD-HHMM` (o nome está no cartão do Repositório e em `/srv/eterna/Eterna/ponto/zerada.json`). Se já houve venda depois da zeragem, o comando avisa: só com `--sobrescrever`, e as vendas novas se perdem (ficam guardadas em `arquivo/<id>/pos-zeragem/`).
3. `sudo systemctl start eterna eterna-vigia`
4. Fechar e abrir de novo os postos e Checkouts.

## Passo a passo das 22h30 às 23h15
1. 22h30: publicar. Conferir o commit no ar pelo vigia e, no Repositório, que a prévia abre sem bloqueio.
2. Antes das 23h: fechar Postos, Checkouts e tablets (os que ficarem abertos limpam sozinhos quando voltarem, mas assim nenhuma fila antiga sobe no meio).
3. 23h: Chrome do Eduardo, Repositório › Ver o que vai ser guardado. Guardar um print das contagens. Digitar ZERAR, Zerar fase de teste. A tela volta sozinha em até 2 minutos.
4. Conferir: cartão "Zerado em ...", Painel e Minhas fotos vazios, Estatísticas com Roverpix e bilheteria, Treino › Medição com as marcações, Painel de controle sem mudança.
5. Reabrir os postos.

## Riscos para o revisor de segurança
- **Botão destrutivo no navegador:** a defesa é Admin do cadastro pela sessão (não pelo e-mail do corpo), sem "ver como", Origin e Host do agente, `X-Eterna`, 2 por minuto, texto ZERAR, uso único, pedido que vence em 10 min e registro no `login_log`. Conta de Admin roubada consegue tirar a operação das telas, mas não apaga nada, e o desfazer devolve. Fica a sugestão de pedir a senha de novo numa próxima versão.
- **Caminhos:** nenhum caminho vem do pedido; o id é gerado no servidor. Nunca seguir link: conferir `islink` nas pastas do NVMe, mover só entradas de primeiro nível, `realpath` só da inbox para achar o HD. Destino que já existe = erro, nunca sobrescrever.
- **LGPD:** fotos, rostos e consentimentos continuam no servidor (nada copiado para fora; a pasta não entra no backup da nuvem porque `backup_arquivos_lista` só varre `sessoes`, `metricas` e `galerias`). A pasta não tem prazo (D9). O arquivo não pode ser servido por nenhuma rota: `/file/` e `/thumb/` só servem o que está em `lib`, e as galerias só do `REPO`.
- **Reexecução (`os.execv`) e saída (`os._exit`):** o primeiro só na partida, sem threads. O segundo depende do systemd (`sem_supervisor` recusa fora dele). Conferir que nenhum JSON fica pela metade numa saída no meio de uma gravação (os que usam `.tmp` + `os.replace` estão seguros; listar os que não usam).
- **Concorrência com `backup-originais.py`** (outro processo a cada 10 min): `timeout=30` no sqlite e uma transação. Se ele estiver no meio de uma rodada, a regra dos 10% impede apagar algo na nuvem.
- **Filas antigas no navegador** (`eterna.ponto.fila.v1`, publicação de galeria pelo `galFilaTick`): um navegador que volte antes do primeiro `/status` pode mandar uma venda ou galeria do teste. Mitigação: fechar os postos antes (passo 2). Melhoria futura: o servidor recusar evento com `em` anterior à zeragem.
- **Escala:** a zeragem é por servidor e roda em segundos com dezenas de milhares de arquivos (só `rename`). Para 100 venues isso vira rotina por venue na nuvem (fora daqui). Sem internet funciona igual: nada depende da rede.
