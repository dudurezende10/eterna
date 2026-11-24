# Plano: Estatística de poses (ramo `feat/poses-estatistica`, a partir de `idiomas-base` 77e0901)

## Status (24/11/2026)
- **Pronto:** a P1 (classificador no servidor, chave Desligada/Sombra/Ligada, `poses.db` fora do backup, instalador e medição), com as revisões de 23/11 e 24/11. Revisor, testador e segurança aprovaram. Sai na **v99.43.0**, junto com os alertas do fotógrafo. Com a chave no padrão (Desligada), nada roda.
- **Depende do Ronaldo (TI), nesta ordem** (passos em `docs/SERVIDOR-ESTADIO.md`, "Classificação de poses"):
  1. Rodar o `visao-instalar.sh` com `LLAMA_TAG`, `LLAMA_COMMIT`, `POSE_SHA_MODELO` e `POSE_SHA_MMPROJ`, e mandar esses valores e o commit do repositório do modelo no Hugging Face.
  2. Fixar no código `POSE_SHA` e `POSE_MMPROJ_SHA` (agente e instalador), o padrão de `LLAMA_TAG` e `LLAMA_COMMIT` no `visao-instalar.sh` e o commit no `BASE` do instalador. Publicar.
  3. À noite, com a classificação Desligada, rodar `medir-poses.py --n 50` e mandar o resultado (meta: mediana até 2,5 s e 95% de respostas válidas).
- **Depois:** o Eduardo decide quando pôr em Sombra. P2 a P5 ainda não começaram.

## Objetivo
Toda foto que chega ao servidor é classificada à noite por um modelo de visão local, com set, quem aparece, adereço, pose, enquadramento, orientação e vibração. O Eterna então calcula sozinho a taxa de escolha, a cobertura e a produção por fotógrafo, usando a metodologia do relatório de 22/11.
Todo dia mostra o acumulado do mês, com alertas. No dia 1 fecha o mês, gera um relatório no mesmo formato do PDF e compara com o mês anterior.

## Escopo desta entrega / fora do escopo
**Entra (5 fatias, cada uma testável sozinha):**
- **P1:** classificador no servidor (filho novo, chave Desligada/Sombra/Ligada, banco `poses.db`).
- **P2:** conferência das ~300 fotos no Marcar, com o acerto medido por campo.
- **P3:** agregados diários, taxa de escolha, cobertura e números por fotógrafo.
- **P4:** tela "Poses que vendem", com guia editável, alertas e permissão por fotógrafo.
- **P5:** fechamento mensal, relatório PDF comparado e números de referência carregados pela tela.

**Fica fora:**
- Treino ou ajuste fino do modelo.
- Expressão do rosto (sorriso). Vibração continua sendo só linguagem do corpo, como no relatório.
- Gravar no evento `criar` a lista exata de fotos oferecidas (fatia futura, ver D6).
- Venue na nuvem sem placa de vídeo.
- O fotógrafo ver os próprios números.
- Mandar os agregados para a nuvem.
- Retroativo da Roverpix: o histórico dela não tem foto no servidor.

## Decisões assumidas
- **D1. Modelo:** Qwen3-VL-8B-Instruct, licença Apache 2.0 (permite uso comercial), em GGUF Q4_K_M (5,03 GB) com o mmproj F16 (1,16 GB). Roda no `llama-server` do llama.cpp (MIT), compilado com CUDA para a placa (sm_120).
  - Reserva: Qwen3-VL-4B-Instruct (Apache 2.0), cerca de 2 vezes mais rápido.
  - Ficam de fora por licença: Gemma (termos próprios), MiniCPM-V (cadastro para uso comercial) e derivados de Llama.
  - Memória da placa: cerca de 7,5 GB com contexto de 8k e 4 vagas. Cabe ao lado do BiRefNet (o filho do recorte fica aberto) e do CLIP.
  - O Q8_0 (8,7 GB) não cabe com folga junto do recorte.
- **D2. Tempo (estimativa; a fatia P1 mede no servidor):**
  - Por foto: cerca de 1 a 1,5 s, com a imagem a 768 px no lado maior e resposta JSON curta de ~45 tokens.
  - 3.000 fotos: 50 a 75 min. 6.000 fotos (dia cheio): cerca de 2,5 h.
  - A janela padrão de 20:00 às 07:00 comporta mais de 25.000 fotos.
- **D3. Set:** vem do reconhecimento do ponto que já existe (CLIP, `cena.rotulo`), quando ele está Ligado e com confiança de 0,70 ou mais. O modelo novo também responde o set, só para conferir: se os dois divergem, a foto vira "dúvida".
  - Orientação vem das dimensões da miniatura, que já está com a rotação do EXIF aplicada. Não usa IA.
- **D4. Chroma:** o chroma sai da operação quando o Eterna entra; os Fundos de IA o substituem (Eduardo, 23/11). Por isso o set não tem `chroma` na taxonomia, e no Eterna o "chroma e seu fundo" vira **Fundos de IA por fundo**, calculado só pelas vendas (`aiSel` = `ai:<id>|<fundo>`), sem visão.
  - Os separadores em fundo preto não existem no Eterna (decisão "sem foto preta"). Foto sem pessoa (`quem: ninguem`) sai da conta.
- **D5. Família:** é a visita quando as levas foram juntadas. Fora disso, a família é a leva (sessão).
  - Na venda, `card` mais `sessoes` contam como uma família só.
  - Por fotógrafo, a unidade é a leva, que já é de um fotógrafo só.
- **D6. Fotos oferecidas em uma venda:** fotos das sessões da venda, menos as bases dos fundos (`x["ia"]`), menos as descartadas (`sim/discarded|<pid>`), menos as que saíram da biblioteca.
  - É uma aproximação: na venda achada pela selfie, o Checkout mostra só as fotos com a pessoa.
  - A fatia futura grava a lista oferecida no evento `criar`.
- **D7. Conferência:** é **cega**, isto é, quem marca não vê a resposta da IA antes de confirmar. Assim o acerto medido é honesto.
- **D8. Validade por campo, não global:** cada campo só vale nas contas e nos alertas quando a Medição tem pelo menos 150 fotos conferidas naquele campo e acerto igual ou acima da meta.
  - Metas: set 90%, quem 85%, adereço 85%, enquadramento 80%, vibração 80%, pose 75%.
  - Orientação vale sempre.
  - Campo que não vale aparece com o selo "acerto ainda não medido" e fica fora dos alertas.
- **D9. Permissões:**
  - Módulo novo `poses`: r = ver, u = editar guia e metas, c = carregar referência.
  - Admin recebe tudo. A Supervisora recebe só r, por migração.
  - Por fotógrafo exige `poses.r` **e** `desempenho.r` (o Índice do fotógrafo, que a Supervisora já tem e o Fotógrafo não). A conferência é no servidor.
- **D10. Chave `config/poses.modo`:**
  - `desligada` (padrão): nada roda.
  - `sombra`: classifica e agrega; a tela mostra os números com "Em teste", sem alertas e sem fechamento.
  - `ligada`: alertas e fechamento mensal. Só aceita com a Medição em 150 ou mais; abaixo disso responde 409 `criterio`. Sem "ligar mesmo assim" nesta entrega.
  - `ETERNA_POSES=0` força desligada.
- **D11. Prioridade da placa:** a classificação só roda dentro da janela, sem trabalho de prioridade 0 ou 1 no recorte e na montagem nos últimos 120 s, e com pelo menos 9.000 MB livres na placa.
  - Se chega trabalho de recorte, termina o lote em andamento e fecha o processo, o que libera a memória da placa.
- **D12. Números do relatório e repositório:** os números ficam fora do repositório. O guia padrão entra no código só com nomes e filtros, sem porcentagens. A referência é um JSON carregado pelo Admin, guardado em `poses.db`. Os testes usam números inventados.

## O que o Ronaldo instala (sudo, uma vez)
1. `build-essential`, `cmake`, `git` e o CUDA Toolkit 13.x (nvcc) do repositório apt da NVIDIA, com a versão fixa. Os pacotes `cuda-*` entram na lista de bloqueio do unattended-upgrades, como os `nvidia-`.
2. llama.cpp num commit ou tag fixa, com suporte a Qwen3-VL. Compila só o `llama-server` com `-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=120` e instala em `/opt/eterna/visao/bin/llama-server` (root:root, 755).
   - Plano B, se a compilação falhar: o binário Vulkan oficial do mesmo commit.
3. O `Qwen3VL-8B-Instruct-Q4_K_M.gguf` e o `mmproj-Qwen3VL-8B-Instruct-F16.gguf` vão para `~/Eterna/modelos` do serviço, baixados pelo `agente/instalar-poses-modelos.py` com o SHA-256 fixo (`POSE_SHA`, `POSE_MMPROJ_SHA`). O programador fixa os SHA a partir do download que o Ronaldo conferir, como foi feito com o `CENA_SHA`. São cerca de 6,2 GB em disco.
4. Rodar à noite `python3 agente/medir-poses.py --n 50`, com o agente e o recorte no ar, e mandar o resultado: ms por foto, pico de memória da placa e % de respostas válidas.

O roteiro fica em `servidor/linux/visao-instalar.sh` (repositório, sem segredo).

---

## P1. Classificador no servidor (sem tela de estatística)

**`agente/eterna-poses.py` (novo, filho, no padrão do `eterna-recorte.py`)**
- Usa a venv do recorte (Pillow) e o `urllib` da biblioteca padrão.
- Ao abrir:
  - Confere o SHA dos dois arquivos.
  - Escolhe uma porta livre no 127.0.0.1.
  - Gera uma chave aleatória num arquivo 0600 (`--api-key-file`).
  - Sobe o `llama-server` com `-m`, `--mmproj`, `--host 127.0.0.1`, `-ngl 99`, `-c 8192`, `-np 4` e `--no-webui`, nunca com `-hf`.
  - Espera o `/health` e responde `{"pronto":true,"modelo":"qwen3vl-8b-q4","sha":...,"carga_ms":N}`.
- Pedido: `<- {"id":"p.7","itens":[{"pid","origem"}]}`, até 8 itens.
  - O caminho precisa estar dentro de `--inbox` ou `--thumbs` (realpath).
  - Abre com a rotação do EXIF e reduz para 768 px.
  - Chama `/v1/chat/completions` com `temperature 0`, `seed` fixo, `max_tokens 80` e `response_format` json_schema (o esquema de `POSE_SAIDA`).
- Resposta: `-> {"id","ok":true,"res":[{"pid","bruto":{...},"ms":N}|{"pid","erro"}]}`.
- O texto do prompt fica fixo no arquivo, em inglês, com a definição de cada valor, e tem versão `POSE_PROMPT_V`.
- Ao sair, mata o grupo de processos do `llama-server` e apaga o arquivo da chave. O PID fica em `~/Eterna/ponto/poses-filho.json` para matar órfão na partida.

**`agente/eterna-agente.py`, bloco "Poses" depois do bloco "Cena"**
- Constantes:
  - `POSES_DB = ~/Eterna/ponto/poses.db`, fora do backup na nuvem (revisão 24/11: tem pid e card, e dado de visitante não sai do servidor).
  - `POSE_TAXO` (abaixo) e `POSE_SAIDA` (esquema da resposta com chaves curtas).
  - `POSE_VERSAO`: hash de SHA do modelo, SHA do mmproj, prompt e versão da taxonomia.
  - `POSE_JANELA_PADRAO = ("20:00","07:00")`, `POSE_LOTE = 8`, `POSE_VRAM_LIVRE_MB = 9000`, `POSE_DIAS = 7` (quantos dias para trás a noite cobre), `POSE_MORTES_MAX = 3`, `POSE_BIN` (caminho fixo; os testes trocam pelo módulo).
- `poses_db()` cria a tabela `pose(pid PK, dia, card, fotografo, w, h, orient, set_ia, set_cena, dados, duvida int, motivo, versao, ms, em)` e os índices de `dia` e `card`.
- `pose_valida(d, origem)` é a única validação, usada para a resposta da IA (`origem="ia"`) e para a marcação humana (`"mao"`):
  - Formato fechado, só os valores de `POSE_TAXO`.
  - Na IA, qualquer campo inválido vira `duvida=1, motivo="formato"`.
  - Regras de coerência (`motivo="incoerente"`): pose `bandeira_*` exige adereço bandeira ou ambos; `trofeu_*` exige troféu ou ambos; `arq_*` exige set arquibancada; `chute_*` exige set chute.
  - `quem=ninguem` vira `motivo="sem_pessoa"` e sai da conta.
- `pose_orient(pid)` lê as dimensões da miniatura pelo `jpeg_cabecalho`: `h` se largura/altura for maior que 1,05, `v` se for menor que 0,95, senão `q`.
- `poses_cfg()` e `poses_cfg_gravar(body, quem)`:
  - Guardam `config/poses {modo, janela:{ini,fim}, por, em}` no `estado.db`. O `estado_gravar` recusa esse documento.
  - Rota `POST /poses/config` com `configuracao.u`, 6 por minuto por pessoa.
  - `ligada` exige `poses_medida()["n"]` de 150 ou mais, senão 409 `{"error":"criterio","falta":N}`.
- `poses_pendentes()` devolve os pids das sessões fechadas de hoje até `POSE_DIAS` para trás que não têm linha com a `POSE_VERSAO` atual, em ordem de dia (mais antigo primeiro) e de clique.
- `poses_pode_rodar()` devolve `(bool, motivo)`. Motivos: `fora_janela`, `recorte_ocupado`, `montagem_ocupada`, `vram`, `sem_modelo`, `parado`.
  - A memória livre vem de `nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits`; sem o comando, o motivo é `vram`.
- `poses_loop()` (thread, no padrão do `cena_loop`):
  - Fora de `sombra` ou `ligada`, ou quando não pode rodar: fecha o filho e dorme 30 s.
  - Dentro: abre o filho, manda lotes, chama `poses_gravar(res)` e confere `poses_pode_rodar()` entre um lote e outro.
  - Na terceira morte do filho seguida, fica `parado` até a próxima noite.
  - Fim da fila ou da janela: fecha o filho e chama `poses_agregar()`. Esta função é um "não faz nada" na P1 e é preenchida na P3.
- `poses_gravar(res)` junta a resposta da IA com o set do `cena_mem`/`cena.db` (D3), valida, grava e conta na noite.
- `poses_lgpd(pids)`, chamada dentro do `lgpd_excluir`, ao lado do `treino_lgpd`.
- Limpeza de hora em hora: linhas de `pose` com mais de 60 dias saem. Agregados e meses ficam.
- `/status.poses` (contrato abaixo), sem nenhum pid.
- No console, linhas `poses:` só com contagens.

**Outros arquivos da P1**
- `agente/instalar-poses-modelos.py`: baixa com SHA, no padrão do `instalar-recorte-modelos.py`.
- `agente/medir-poses.py`: mede N fotos do dia e imprime ms (mediana e p90), % válidas e pico de memória da placa.
- `servidor/linux/visao-instalar.sh`.
- `index.html`: cartão `posesPanel()` em Configurações › Fundos de IA (técnico), view `chroma`, ao lado do `mtgPanel`.
  - Mostra o modo em 3 botões (`data-act="ps-modo"`, em `WRITE_OPS`, `ACT_MOD` configuracao, `confirm`, `auditLog('poses_modo')`).
  - Mostra a janela, modelo pronto ou o motivo em palavras, e a última noite (feitas, dúvidas, erros, ms por foto, por que parou).
  - Quem não tem `configuracao.u` vê só o texto.
  - Textos `ps_modo_*`, `ps_painel_*`.

**Critérios de aceite da P1**
1. Com `modo=desligada`, nenhum processo filho existe e `poses.db` não é criado.
2. Com `sombra`, dentro da janela e o filho falso: todas as fotos de sessões fechadas dos últimos 7 dias ganham linha na tabela `pose` com a `versao` atual.
3. Resposta com campo fora da taxonomia, JSON quebrado ou incoerência vira `duvida=1` com o `motivo` certo. Nada inválido chega a `dados`.
4. Fora da janela nada é classificado. Ao sair da janela, o filho é fechado em até um lote.
5. Trabalho de prioridade 0 ou 1 no recorte ou na montagem para a classificação em até um lote e fecha o filho. Volta 120 s depois de a fila esvaziar.
6. Com menos de `POSE_VRAM_LIVRE_MB` livres, ou sem `nvidia-smi`, o filho não abre e `/status.poses.noite.parou_por` diz o motivo.
7. `POST /poses/config` sem `configuracao.u` responde 403. `ligada` sem medida responde 409 `criterio`. Gravar `config/poses` por `/ponto/docs` é recusado.
8. `ETERNA_POSES=0` vence o modo gravado.
9. A exclusão LGPD apaga a linha de `pose` da foto.
10. `/status.poses` não traz pid, caminho nem a chave do `llama-server`.
11. Teste estático: o código que monta a linha do `llama-server` não contém `0.0.0.0`, `-hf` nem `--hf-repo`, e sempre passa `--host 127.0.0.1` e `--api-key-file`.
12. No servidor (Ronaldo, manual): o `medir-poses.py` com 50 fotos dá mediana de 2,5 s ou menos por foto, 95% ou mais de respostas válidas, e o recorte continua com `provedor=cuda` durante a medição.

**Testes da P1:** `testes/_poses_filho_falso.py` (resposta determinística pelo hash do pid, com 10% inválidas de propósito) e `testes/poses_agente.py` (critérios 1 a 11). Além disso, as rotas novas entram em `testes/seguranca_rotas_agente.py`.

---

## P2. Conferência no Marcar e medida por campo

**Agente**
- `TREINO_CAMPOS` ganha `"pose"`.
- `treino_valida` aceita `pose: {quem, adereco, pose, enq, vib}`, cada campo podendo ser null, validado pelo `pose_valida(origem="mao")`. O set humano continua sendo o `ponto`.
- `treino_vazio` passa a considerar `pose`.
- `treino_amostra(..., modo="poses")`:
  - Só fotos do dia com linha em `pose`.
  - Estratificadas em rodízio por (set, fotógrafo).
  - Sem as já marcadas em pose. n padrão 60.
  - Nunca devolve a resposta da IA (D7).
- `TREINO_MODOS` ganha `poses`.
- `poses_medida()` e a rota `GET /poses/medida` (`qualidade.r`, 10 por minuto por pessoa):
  - Junta `rotulo.pose` com `pose.dados` pelo pid.
  - Por campo: n, acerto, meta, `vale`, acerto por classe e matriz.
  - IA em dúvida é contada à parte.
  - Cache de 60 s.

**App**
- A aba nova **Poses** no Treino (`vTreinoPoses`) aparece em `ABAS` e no `case 'tr-aba'`.
- Reaproveita `trCarregar`, `trGravar` e `trEnviar` com `modo='poses'` (mesma fila `TR_FILA` e mesmo tratamento do 409).
- O rascunho `trRasc` ganha `pose:{}`, e o `trCorpo` manda `pose`.
- Tela:
  - A foto inteira, como no Marcar.
  - Uma linha por campo (set = os mesmos botões do `TR_PONTOS`).
  - Teclado: Tab e Shift+Tab trocam de campo, 1 a 9 escolhem o valor, Enter confirma, Z desfaz, D marca dúvida.
- Depois do Enter, aparece por 1,5 s o "A IA disse:" com o que divergiu (`.tr-ps-diverge`). Isso não muda o que foi gravado.
- Na aba Medição, bloco "Poses" (`trPsMedida`) com uma tabela por campo (n, acerto, meta, Vale/Não vale), a matriz do campo escolhido e o contador "conferidas: N de 300".

**Critérios de aceite da P2**
1. `POST /treino/rotulo` com `pose` fora da taxonomia responde 400 `campo=pose`. Sem `qualidade.u` responde 403.
2. A amostra `modo=poses` não traz nenhuma chave da resposta da IA, e duas cargas no mesmo dia trazem as mesmas fotos (semente fixa).
3. Marcar 3 fotos, desfazer 1 e recarregar a página: a fila sobe, e o servidor fica com 2 marcadas.
4. `/poses/medida` calcula certo o acerto de um conjunto sintético com acertos conhecidos, campo a campo.
5. Um campo com n abaixo de 150 ou acerto abaixo da meta sai `vale:false`.
6. Com 150 conferidas ou mais, `POST /poses/config {modo:"ligada"}` passa.
7. A aba Poses e o bloco da Medição abrem nas 5 línguas sem chave faltando.

**Testes da P2:** `testes/poses_agente.py` (parte 2) e `testes/poses-marcar.js`.

---

## P3. Agregados diários e taxa de escolha

**Agente:** `poses_agrega_dia(dia, sessoes, poses, vendas, descartes, guia)` é uma **função pura** testável. `poses_agregar()` roda depois de cada noite para os últimos 35 dias e grava `pose_dia(dia, k, v)`, com `k` = `geral` ou `foto:<chave>`.

- **Vendas:** `poses_vendas(dias)` usa uma conexão só de leitura, como o `_mtg_pagas_ler`.
  - Entram vendas com `criar`, com `pagar`, sem `cancelar` e sem `teste`.
  - Para cada venda: O = oferecidas (D6) e S = `selected` dentro de O.
- **Inclusão:** |O| de 3 ou mais e S entre 1 e 60% de |O|. As excluídas são contadas por motivo (`tudo`, `pequena`, `sem_oferta`).
- **Contas por recorte X:**
  - oferecidas = Σ|O∩X|
  - escolhidas = Σ|S∩X|
  - esperado = Σ|O∩X|·|S|/|O|. O |S|/|O| usa todas as oferecidas da venda, inclusive as em dúvida.
  - Foto em dúvida fica fora de qualquer X.
  - Índice = escolhidas/esperado. Taxa = escolhidas/oferecidas.
  - Cada recorte guarda `[oferecidas, escolhidas, esperado×1000, famílias]`.
- **Recortes:** lista fixa `POSE_RECORTES`.
  - Cada campo sozinho.
  - pose×enq×orient para `bandeira_*` e `trofeu_*`.
  - quem×pose.
  - set×vib.
  - `guia:<id>` para cada item ativo do guia.
  - `fundo:<id>`: vendas com base de IA na sessão contra vendas que levaram aquele fundo pelo `aiSel`.
- **Cobertura por item** (sets e itens do guia):
  - Famílias com o item, em todas as famílias com foto classificada.
  - Das que compraram alguma coisa: quantas levaram pelo menos uma foto do item.
  - Soma de fotos levadas com o item e sem ele, para a média.
- **Por fotógrafo** (unidade = leva):
  - Soma e histograma de cliques por família no gramado, troféu e arquibancada. Faixas: menos de 15, 15 a 19, 20 a 24, 25 a 30, mais de 30.
  - Soma do chute à parte.
  - Contagem por set para a divisão.
  - Soma de poses diferentes por família.
  - Contagem de horizontais, com vibração e "para parar de fazer".
  - Oferecidas, escolhidas e esperado das fotos dele.
- Tudo no formato de soma, para o mês ser a soma dos dias.
- Rotas, com o período limitado a 92 dias e 30 por minuto por pessoa:
  - `GET /poses/resumo?de=&ate=` (`poses.r`): sem nada por fotógrafo.
  - `GET /poses/fotografos?de=&ate=` (`poses.r` e `desempenho.r`, conferido no servidor; senão 403 `sem_permissao`).
  - As duas trazem `cobertura_ia` (% de fotos classificadas) e `campos_validos`.
- Até a P4, a "taxonomia" é só para o servidor e os testes.

**Critérios de aceite da P3**
1. Num conjunto sintético de 4 vendas com números calculados à mão, oferecidas, escolhidas, esperado, índice e taxa batem até a terceira casa.
2. Venda com S acima de 60% de O, venda com |O| abaixo de 3 e venda cancelada não entram, e aparecem nos contadores de excluídas.
3. Foto em dúvida não entra em nenhum recorte, mas entra no |O| da venda.
4. A soma dos `pose_dia` de 3 dias é igual ao agregado calculado direto sobre os 3 dias.
5. Depois de uma exclusão LGPD, o reagregado da noite seguinte não conta a foto apagada.
6. `/poses/resumo` não tem nenhuma chave de fotógrafo. `/poses/fotografos` sem `desempenho.r` responde 403.
7. Agregar 35 dias de 6.000 fotos (sintético) leva menos de 60 s.

**Testes da P3:** `testes/poses_agrega.py` (função pura) e `testes/poses_agente.py` (rotas).

---

## P4. Tela, guia e alertas

**Agente**
- `pose_guia(id PK, dados, por, em, ativo)` e `pose_guia_hist` (só acrescenta).
- `POSE_GUIA_PADRAO` no código: os 6 por tipo de grupo e os 5 para parar de fazer, **só com nome e filtro, sem números**, mais as metas padrão.
- `GET /poses/guia` (`poses.r`) e `POST /poses/guia` (`poses.u`, até 60 itens, 32 KB, 6 por minuto, formato fechado).
- `poses_alertas(periodo, com_fotografos)` e `GET /poses/alertas`. O bloco por fotógrafo só sai com o mesmo portão da P3.
  - Alertas só no modo `ligada`, só com campos que valem e só com dados suficientes (não "poucos").
- Tipos de alerta e regra de cada um:

| Tipo | Regra |
|---|---|
| `pose_sem_uso` | item "faz" em menos de `sem_uso_pct` (15%) das famílias do grupo, com pelo menos 10 famílias |
| `pose_acima` / `pose_abaixo` | índice de 1,25 ou mais / de 0,80 ou menos |
| `evitar_alto` | mais de 20% das fotos |
| `cobertura_baixa` | arquibancada ou chute em menos de 50% das famílias |
| `foto_poucos_cliques` | média abaixo de 20, com pelo menos 5 famílias |
| `foto_divisao` | algum set a mais de 15 pontos de 50/30/20 |
| `foto_variedade` | menos de 5 poses por família |
| `foto_evitar` | mais de 20% |
| `foto_vertical` | mais de 40% vertical |

- Todos os limites ficam no `metas` do guia, editáveis.

**App**
- `VIEWS`: `['poses','Poses que vendem','o que vende, guia e alertas','Curadoria']` (Eduardo, 23/11: no grupo Curadoria, não em Dashboard), logo depois de `['fotografos',...]` e antes de `['alertas',...]`. Ordem final da Curadoria: Qualidade, Treino da IA, Fotógrafos (que passa de Dashboard para Curadoria junto com a P1, Eduardo 23/11), Poses que vendem, Alertas. O chip "Poses" na Estatísticas continua como atalho.
- `MODULES`: `['poses','Poses que vendem',['poses']]`.
- `MODULE_INFO.poses`, com texto para c, r e u.
- No agente: `AUTH_MODULOS` e `AUTH_MODULOS_NOVOS` ganham `poses`.
- `migraPoses` (marca `mps1`, `auditLog('migracao_poses')`) dá `poses.r` e o item de menu a quem está no perfil Supervisor.
- `vPoses()`:
  - `rangeBar` e chips `ps-sec`.
  - Seções Geral, O que vende, Quem tem compra, Guia, Alertas (só os gerais) e Mês (P5). Sem seção de fotógrafos.
- **Por fotógrafo fica na view Fotógrafos, em Curadoria (Eduardo, 23/11):** aba "Poses e roteiro" (`psVeFotografos()` = `can('poses','r')&&can('desempenho','r')`, a mesma conferência no servidor) com cliques por família, divisão 50/30/20, poses diferentes, roteiro de cada fotógrafo, alertas `foto_*`, os gráficos e o PDF por fotógrafo da P5. A tela Poses que vendem fica com o geral (o que vende, cobertura, guia, alertas gerais e mês).
- `psPull(tipo)`: cache de 5 min em `state.ps`, nada em SIM ou `localStorage`.
- `psBarra`: barra do índice com a linha "1,0 = ao acaso", o texto "x de n" e `.ps-pouco` com "poucos dados".
- Selos: `.ps-teste` (sombra) e `.ps-nao-medido` (campo que não vale).
- O guia editável (`psGuiaHtml`) tem nome, ordem, ativo, filtro por campo em chips e metas.
  - Ações `ps-guia-edit`, `ps-guia-salvar` (`WRITE_OPS` poses u, `auditLog('poses_guia')`) e `ps-guia-cancelar`.
  - Para cada item: "feita em X% das famílias" e a taxa.
- Na Estatísticas (`esChips`), um chip "Poses" que faz `go('poses')` quando `canView('poses')`.
- `REL.poses = relPoses` (geral). A aba de fotógrafos só entra com o portão.
- Textos nas 5 línguas (tela da equipe; não precisa de chinês).

**Critérios de aceite da P4**
1. Admin vê todas as seções e a aba "Poses e roteiro" da view Fotógrafos. A Supervisora migrada vê todas, inclusive a aba, mas não edita o guia. O Fotógrafo não tem o item no menu e recebe 403 em todas as rotas `/poses/*`.
2. Um perfil com `poses.r` e sem `desempenho.r` não vê a aba "Poses e roteiro", não recebe alerta `foto_*` e não tem a aba de fotógrafos no Exportar.
3. Todo número aparece como "taxa · x de n". Abaixo de 30 fotos ou de 5 famílias aparece "poucos dados" e o item não gera alerta.
4. Em `sombra`, a tela mostra o selo "Em teste" e a lista de alertas fica vazia com a explicação.
5. Editar o guia, salvar e recarregar mantém a edição, que vem do servidor. Filtro com valor fora da taxonomia dá 400 e a tela avisa.
6. Os textos de alerta não falam em presença, falta ou horário, só em produção por família.
7. A tela abre em `testes/todas-as-telas.js` nas 5 línguas. O critério 19 de `testes/permissoes.js` passa com as letras do `MODULE_INFO.poses`.

**Testes da P4:** `testes/poses-tela.js`. Além disso, `testes/permissoes.js` e `testes/seguranca_rotas_agente.py` atualizados.

---

## P5. Fechamento mensal, relatório e referência

**Agente**
- `pose_mes(mes PK, dados, fechado_em, cobertura, versao_modelo, campos_validos, guia_v)`.
- `poses_fecha_mes()` roda na noite do dia 1, no fuso do venue:
  - Fecha o mês anterior quando 98% ou mais das fotos estão classificadas.
  - Senão tenta toda noite até o dia 5 e fecha com a cobertura gravada.
  - Só no modo `ligada`.
  - Grava os agregados do mês, os alertas do mês e as diferenças para o mês anterior.
  - Uma vez fechado, o mês não muda.
- `GET /poses/meses` e `GET /poses/mes?mes=AAAA-MM` (`poses.r`; bloco por fotógrafo só com o portão).
- `pose_ref(id PK, dados, por, em)`:
  - `POST /poses/referencia`: `poses.c` e `admin_do_cadastro`, até 256 KB, 500 itens, só inteiros, chaves que existem em `POSE_RECORTES`, 3 por minuto.
  - `GET /poses/referencia` (`poses.r`).

**App**
- A seção Mês tem a lista de meses fechados, "Comparado com" (mês anterior ou a referência) e dois ícones de PDF.
  - `relPosesMes(mes)`, geral, pode circular na equipe.
  - `relPosesFotografos(mes)`, uso interno, só com o portão; o ícone dele fica na aba "Poses e roteiro" da view Fotógrafos (Curadoria), não na tela Poses que vendem.
- O PDF segue a ordem do relatório: Resumo, Como a análise foi feita (texto fixo com o n do mês, % em dúvida, acerto por campo e versão do modelo), Limites, O que vende por tipo de foto, Pose, enquadramento e atitude, Fotos feitas poucas vezes, Guia (este mês, mês anterior e diferença) e As 5 para parar de fazer.
- O `pdfBlob` ganha dois blocos: `par` (parágrafo com quebra entre palavras) e `barras` (retângulo proporcional ao índice, linha do 1,0 e texto "taxa · x de n").
- "Carregar referência" (`ps-ref-carregar`, `WRITE_OPS` poses c) lê o JSON no navegador e manda.

**Critérios de aceite da P5**
1. Com 30 dias sintéticos de outubro em `ligada`, a noite de 01/11 fecha `2026-10` com a cobertura certa. Nas noites seguintes, o mês não muda.
2. Com 90% de cobertura no dia 1, o mês não fecha. No dia 5, fecha com `cobertura: 0.9` visível na tela e no PDF.
3. O PDF geral não contém nome de fotógrafo. O de fotógrafos só aparece e só é gerado com `poses.r` e `desempenho.r`.
4. A comparação mostra, para cada item, este mês, o anterior e a diferença em pontos. Item "poucos dados" em qualquer dos dois meses não recebe seta.
5. Referência com chave desconhecida, número não inteiro ou mais de 256 KB dá 400. Quem não é Admin recebe 403.
6. `grep` no repositório não acha nenhum número da referência. Os testes usam números inventados.

**Testes da P5:** `testes/poses_mes_agente.py` e `testes/poses-mes.js` (PDF gerado, com barras e sem nome de fotógrafo no geral).

---

## Guia padrão = roteiro de 22/11 (Eduardo, 23/11)
O `POSE_GUIA_PADRAO` da P4 sai do roteiro dos fotógrafos por set de 22/11, item por item. Os cliques-meta e as regras entram no repositório (são metas de trabalho, não números de venda); as frases do roteiro com resultado de venda ("toda família que tinha comprou" e parecidas) ficam fora.
- **Item "faz"**: `set`, `grupo` (`individual | dupla | familia_crianca | grupo_adultos`), `ordem` (a ordem da linha no roteiro), `nome` (o texto da linha), `filtro` (campos da taxonomia que reconhecem a foto) e `cliques` (a coluna Cliques: número, faixa `[3,4]` ou "por pessoa" quando o roteiro diz "2 cada").
- **Itens "evitar"**: os "Não fazer" de cada set viram itens `tipo: "evitar"` do set, com filtro quando a taxonomia reconhece (ex.: bandeira atrás com a pessoa parada = `pose: bandeira_atras` e `vib` vazia; troféu na vertical em meio corpo = `orient: v` e `enq: meio`; arquibancada na vertical = `orient: v`; pessoa parada com a bola = `chute_parado`). O que a taxonomia não reconhece fica só como texto do guia, sem alerta.
- **Set 5 Chroma** do roteiro vira o item dos **Fundos de IA** (D4), sem cliques-meta: a base sai das 2 primeiras fotos do gramado (regra 19), não de cliques próprios.
- **Regras gerais** (em `metas`, editáveis): mínimo de 20 cliques por família, ideal de 25 a 30, somando bandeira, troféu e arquibancada; chute a gol à parte; divisão 50/30/20 (bandeira, troféu, arquibancada); 3 a 4 cliques por pose; pelo menos 8 poses diferentes por família nos três sets; toda família passa pela arquibancada; horizontal primeiro (a vertical só como segunda opção).
- **Alertas novos previstos para a P4**, além da tabela da P4: `foto_menos_8_poses` (família com menos de 8 poses diferentes nos três sets; substitui o limite de 5 do `foto_variedade`), `foto_cliques_pose` (mais de 4 cliques da mesma pose na mesma família) e `cobertura_baixa` da arquibancada mirando 100% das famílias (os outros sets seguem com 50%).

## Notas da implementação da P1 (23/11)
- `POSE_TAXO.set` é o `TREINO_PONTOS` (sem `chroma`, D4). Ganhou `chute_comemora` (pose) e a regra de coerência `chute_*` cobre ela.
- `POSE_VERSAO` virou a função `pose_versao()` (8 hex de SHA do modelo, SHA do mmproj, `POSE_PROMPT_V` e `POSE_TAXO_V`), porque os SHA são trocados nos testes e serão fixados depois.
- `POSE_SHA` e `POSE_MMPROJ_SHA` ficam vazios até a primeira instalação (`instalar-poses-modelos.py --esperado-modelo <sha> --esperado-mmproj <sha>`, revisão 24/11: sem o SHA esperado nada é baixado); vazio = o filho não abre (`sem_modelo`).
- O esquema `POSE_SAIDA` mora só no agente e vai em cada pedido ao filho; o prompt mora só no filho, e o teste confere que ele define todos os valores da taxonomia. O filho responde `prompt_v`; diferente do `POSE_PROMPT_V` do agente, ele é fechado (motivo `versao`).
- Motivos além dos três da P1: `set_diverge` (o set do modelo diverge do reconhecimento do ponto Ligado com confiança de 0,70 ou mais: dúvida, dados ficam) e `nao_classificavel` (a foto em si não serve: caminho recusado ou imagem ilegível; não volta à fila). Erro do servidor de modelo numa foto não grava linha: a foto tenta de novo na noite seguinte.
- A memória da placa só é conferida antes de abrir o filho (aberto, o próprio modelo ocupa a placa). Recorte e montagem marcam o último trabalho de prioridade 0 ou 1 (`poses_marca_prio`), na fila ou terminando.
- `/status.poses` segue o contrato e traz também `modelo.pronto`, `modelo.carga_ms` e `rodando`. `modelo.erro` pode ser `conferindo` (o `/status` nunca lê os 6 GB para conferir o SHA; quem confere é o laço).
- `poses_medida()` existe na P1 só com `n: 0` (a medida é da P2), então Ligada responde sempre 409 `criterio` nesta fatia.
- O teste troca o binário do `llama-server` por `testes/_poses_filho_falso.py` (um servidor HTTP local que confere a linha de comando e a chave); o `agente/eterna-poses.py` testado é o de verdade. O falso recebe a pasta de controle pela linha do lançador do teste (`--falso-dir`): o `env_llama` de produção não repassa variável de teste.
- Revisão de 23/11:
  - O SHA dos 6,2 GB só é conferido pelo laço, com Sombra ou Ligada, dentro da janela e depois de `recorte_ocupado` e `montagem_ocupada` (ordem do `poses_pode_rodar`: desligada, fora_janela, parado/versao, recorte, montagem, sem_modelo/conferindo, vram). O resultado fica em `~/Eterna/ponto/poses-sha.json` (0600: tamanho, mtime, inode e SHA lido de cada arquivo) e não é relido sem mudança, nem em outra partida. Fora disso o `/status` diz `conferindo` ou o estado guardado. O filho recebe `--conferido` (tamanho, mtime e inode) e só confere isso.
  - Nenhum `llama-server` órfão: o filho avisa `{"llama_pid"}` logo depois do Popen (o agente grava no `poses-filho.json`); o SIGTERM do filho fecha o `llama-server` também no meio da abertura (o SIGTERM entre o Popen e o `self.p` fica anotado; `pthread_sigmask` não serve, porque o `llama-server` herdaria a máscara); o agente manda SIGTERM, espera `POSE_TERM_SEG` e só então SIGKILL, e no grupo do `llama-server` SIGTERM antes do SIGKILL; o prazo do filho (300 s) conta do início e é menor que o do agente (360 s); na partida o agente encerra o que sobrou pelo `poses-filho.json` e procurando `--api-key-file` dentro de `ponto/poses-*`, e apaga as pastas de chave que sobraram.
  - Versão do filho diferente: parado até a noite seguinte (motivo `versao`). Lote inteiro com erro do servidor de modelo (nenhuma foto respondida): as fotos ficam na fila e conta como morte do filho (motivo `servidor`; na 3ª seguida, `parado`), nunca `fim_fila`. `ValueError` do PIL vira `imagem`. A lista vazia só é refeita a cada `POSE_FILA_SEG`, e pausa depois do fim da fila não troca o `fim_fila`.

## Contratos

**Taxonomia (`POSE_TAXO`, v1)**
- set (= `TREINO_PONTOS`): `gramado | trofeu | arquibancada | chute | outro`
- quem: `individual | dupla | grupo_adultos | familia_crianca | so_criancas | ninguem`
- adereco: `bandeira | trofeu | ambos | nenhum`
- pose: `bandeira_frente | bandeira_atras | bandeira_capa | bandeira_outra | trofeu_segura | trofeu_comemora | trofeu_ao_lado | arq_sentado | arq_em_pe | chute_bola_ar | chute_parado | chute_comemora | abraco_beijo | posado | comemora_sem | outra` (16; `chute_comemora` = comemorando o gol, do roteiro de 22/11. Arquibancada "olhando para a câmera" não tem pose própria: é `arq_sentado` com `vib` vazia)
- enq: `inteiro | meio | close`
- vib (lista, vazia = parado): `braco | punho | pulo | movimento`
- orient (do servidor): `h | v | q`

**Saída do modelo (json_schema fechado)**
```json
{"s":"gramado","q":"dupla","a":"bandeira","p":"bandeira_frente","e":"inteiro","vb":["braco"]}
```

**`/status.poses`**
```json
{"v":1,"modo":"sombra","forcada":false,"versao":"a1b2c3d4","modelo":{"ok":true,"erro":null,"nome":"qwen3vl-8b-q4"},
 "janela":{"ini":"20:00","fim":"07:00"},"na_janela":false,"pendentes":0,"parado":false,
 "noite":{"ini":"...","fim":"...","feitas":0,"duvidas":0,"erros":0,"ms_med":0,"parou_por":"fim_fila"}}
```

**Guia (item)**
```json
{"id":"dupla-1","tipo":"faz","grupo":"dupla","ordem":1,"nome":"Sentados na arquibancada vibrando","ativo":true,
 "filtro":{"set":["arquibancada"],"pose":["arq_sentado"],"vib":["sim"]}}
```

**Referência**
```json
{"v":1,"nome":"Roverpix out-nov","periodo":{"de":"2026-10-01","ate":"2026-11-22"},
 "itens":[{"chave":"pose=bandeira_frente|enq=inteiro|orient=h","x":0,"n":0}],
 "cobertura":[{"chave":"set=arquibancada","fam_com":0,"fam":0,"compraram":0}]}
```

**Chaves do I18N (5 línguas; tela da equipe)**
- Tela e modo: `v_poses`, `mod_poses`, `modi_poses_c|r|u`, `ps_sec_*`, `ps_x_de_n`, `ps_pouco`, `ps_acaso`, `ps_teste`, `ps_nao_medido`, `ps_modo_desligada|sombra|ligada`, `ps_janela`, `ps_parou_*`.
- Alertas: `ps_al_*` (um por tipo).
- Guia e referência: `ps_guia_*`, `ps_ref_*`.
- Mês: `ps_mes_*`, `ps_pdf_geral`, `ps_pdf_fotografos`.
- Taxonomia: `ps_set_*`, `ps_quem_*`, `ps_ad_*`, `ps_pose_*` (16), `ps_enq_*`, `ps_or_*`, `ps_vib_*`.
- Marcar: `tr_aba_poses`, `tr_ps_*`.

---

## Riscos para o revisor de segurança
- **`llama-server` local:** só em 127.0.0.1, porta aleatória, chave aleatória por abertura num arquivo 0600 (nunca na linha de comando, que aparece no `ps`), sem `-hf` e sem rede.
  - O binário fica em `/opt` como root, sem escrita para o usuário do serviço.
  - Os modelos têm SHA fixo; SHA diferente não abre.
- **Texto dentro da foto tentando mandar no modelo** (placa, camiseta): a gramática fechada mais o `pose_valida` limitam o estrago a um rótulo errado. Nada da resposta vira HTML sem `esc()`, e nada vira comando.
- **Ranking dos fotógrafos:** a permissão é conferida no servidor, em todas as rotas e no Exportar, nunca só na tela.
  - Números por fotógrafo são dado pessoal de funcionário: acesso restrito, sem nada sobre presença, e o PDF geral sem nomes.
- **LGPD:** as linhas de `pose` saem na exclusão e vencem em 60 dias. Os agregados são só contagens, sem pid. Nenhuma foto sai do servidor. `poses.db` fica fora do backup na nuvem.
- **Disputa pela placa no dia de operação:** janela, pausa quando o recorte tem trabalho, conferência de memória livre e o filho fechado fora da janela.
  - Risco que sobra: falta de memória na placa durante um lote noturno se chegar um cartão com muitas fotos. A defesa é terminar o lote (no máximo 8 fotos) antes de liberar.
- **Escala:** cada venue classifica no próprio servidor. Com 100 venues, a taxonomia e o guia ficam por venue em `poses.db`. Venue sem placa não tem esta função (com o processador seriam mais de 20 s por foto).
  - Com a internet caída nada muda: tudo é local, inclusive o PDF.
- **Repositório público:** referência, números e prompts com dado de cliente nunca entram. Os testes têm números inventados (critério P5.6).
- **Limites:** `POST /poses/guia`, `/poses/referencia` e `/poses/config` com limite por pessoa e tamanho máximo. As rotas GET com teto de 92 dias por pedido.

## Perguntas para o Eduardo (com recomendação)
1. **Conferência cega ou com a resposta da IA à vista?** Recomendo **cega** (D7). Leva cerca de 1 h 15 min para 300 fotos, mas o acerto medido não fica inflado.
2. **A Supervisora edita o guia de poses?** Recomendo **só ver**; quem edita é o Admin.
3. **Janela da noite das 20:00 às 07:00?** Recomendo que sim. Em dia de jogo à noite, a pausa automática pelo recorte já protege a operação.
4. **Metas de acerto por campo** (90/85/85/80/80/75)? Recomendo aceitar e rever depois da primeira Medição.
5. **"Oferecidas" = fotos das sessões da venda** (D6), aproximado na venda pela selfie? Recomendo aceitar agora e gravar a lista oferecida no evento `criar` numa fatia seguinte.
6. **Fundos de IA por fundo no lugar do chroma** (D4)? Recomendo que sim.
7. **Calendário:** Sombra a partir de 25/11, conferência das 300 até 30/11, Ligada em 01/12. Primeiro mês fechado: dezembro (em 01/01), comparado com a referência que você carregar. Recomendo esse calendário.

## Arquivos que a entrega toca
- `agente/eterna-agente.py` (blocos Treino, Cena, `ROTAS`, `lgpd_excluir`, backup, `AUTH_MODULOS`)
- `agente/eterna-poses.py`, `agente/instalar-poses-modelos.py`, `agente/medir-poses.py` (novos)
- `servidor/linux/visao-instalar.sh` (novo)
- `index.html` (Treino, Fundos de IA técnico, `VIEWS`/`MODULES`/`PRESETS`, view `poses`, `REL`, `pdfBlob`, I18N)
- `testes/` (os arquivos citados em cada fatia)
- Documentação: `docs/CONTEXTO-ETERNA.md`, `docs/DOCUMENTACAO-TECNICA.md`, `docs/GUIA-DA-EQUIPE.md`, `docs/SERVIDOR-ESTADIO.md` (o que o Ronaldo instala)

Modelo: Qwen3-VL-8B-Instruct, Apache 2.0
