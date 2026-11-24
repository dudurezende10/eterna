# Plano: bases dos fundos de IA = as duas melhores fotos do gramado

## Objetivo
Trocar, no servidor, a escolha das bases de "as 2 primeiras fotos do gramado que passam na regra" por "as 2 de maior nota". Sem sinal ou em empate, o resultado é idêntico ao de hoje, e há uma chave para voltar.

Nada foi medido no servidor do estádio: o plano sai da leitura do código, e os pesos da nota são provisórios.

## 1. Onde se escolhe hoje e quem consome

Hoje já não são "as duas primeiras da sessão": são as 2 primeiras de gramado que passam nos vetos, em ordem de clique. A escolha é só do agente, em `/home/claude/eterna-af/agente/eterna-agente.py`:

| Função | Linhas | Papel |
| --- | --- | --- |
| `_sess_ia_bases(x, n)` | 6717-6733 | A escolha: percorre em ordem de clique e para ao juntar N. |
| `_sess_ia_base_de` | 6703-6714 | Estado de cada foto: `base`, `pula`, `rec`, `pendente`. |
| `base_rec_ok` | 17611-17626 | Vetos: com gente, sem corte em cima/esquerda/direita, luz 40 a 254. |
| `_sess_ia_fecha` | 6788-6809 | Grava `x["ia"]` no fechamento da leva (60 s sem clique). |
| `cena_completa` | 18183-18224 | Preenche depois, quando a leva fechou em `cena_pendente`. |
| `_vis_ia_reabre` | 8071-8105 | Preenche no Separar. |
| `_sess_ia_cand` | 6754-6785 | Manda candidatas ao recorte com a leva aberta; para ao achar N boas. |

Consumidores, todos lendo `x["ia"]`:
- **Servidor:** `mtg_candidatas` (4581) e `mtg_preferida`/`MTG_BASE` (4659, 4419) na montagem; `rec_pre_escolha` (4232); `sess_ia_hoje` (6823).
- **App (`/home/claude/eterna-af/index.html`), não escolhe nada:** `srvIaCompleta` (5421) copia para `SIM.sessions[c].ia`. Daí leem `lojaAIBase`/`lojaAI` (2986, 2994, Checkout), `compBases`/`compGrid` (5107, 5110, Venda manual), `pendEscolhaItem` (2208, Posto), `impFotos` (2411, impressão) e `iaSet` (1730).
- **Único "2 primeiras" literal no app:** `lojaAIAntigo` (3022, `ph.slice(0,2)`), desligado por `FIA_ANTIGO_ON=false` (2984). Não mexer.
- **Ordem das duas:** índice 0 vai para Maracanã 1950 e Túnel, índice 1 para Mirante e Telão (`FIA_BASE` 2985 = `MTG_BASE`).

## 2. Sinais que já existem por foto (sem modelo novo)

| Regra | Sinal | Onde está | Custo novo |
| --- | --- | --- | --- |
| Gramado | `cena_mem[pid]` (`g`, `c`) | memória + `cena.db` | zero |
| Pessoa cortada | `rec.borda` | `cena_mem[pid].rec` | zero (já é veto) |
| Corpo inteiro com chão | `rec.trunc`, `rec.pernas`, `rec.joelho` | idem | zero |
| Luz na pessoa e no rosto | `rec.luz.med`, `rec.luz.p95` | idem | zero |
| Nitidez | `nr` (rosto), `nq` (quadro) do `lx_medir` | `treino.db` `lixeira.dados`, não fica em memória | cache em memória |
| Gente atrás | `nb - n` (rostos pequenos demais) do `lx_medir` | idem | idem |
| Marcação humana | `rotulo.dados.ia.serve` e `motivos` | `treino.db` | cache em memória |

- **Recorte é o gargalo.** As medidas `rec` só existem para foto recortada. O comentário da linha 4259 diz cerca de 1 s por foto na placa de vídeo; o valor real está em `/status` (`ms_medio` do recorte).
- **Luz e nitidez** já rodam em toda foto no `leitor_loop` (1085-1102), com tempo médio em `/status.lixeira.ms_med`.
- **Enquadramento (tamanho da pessoa no quadro)** não existe. Seriam poucos ms dentro de `medidas()` do `eterna-recorte.py` (395), mas mexe no processo de recorte na véspera: fica fora.
- **Poses (`eterna-poses.py`)** é lento e só estatística: fora.
- **Marcação do Treino** quase nunca chega a tempo, porque o rótulo só é aceito em leva fechada e a escolha congela no fechamento. Serve para medir a nota, não para escolher ao vivo.

## 3. Nota, desempate e congelamento

**Candidatas:** as fotos em estado `base` (passam nos vetos de hoje) entre as 8 primeiras de gramado em ordem de clique (`BASE_POOL_MAX=8`).

**Nota de 0 a 100; sinal ausente vale metade do peso:**
- **Corpo (30):** do joelho para cima (`trunc` e não `pernas`) 30; pernas inteiras encostando embaixo 20; chão sob os pés (`trunc` falso) 0.
- **Luz (25):** `luz.med` entre 90 e 170 vale tudo, caindo em linha reta até 0 em 40 e em 230; perde 10 se `p95` for 245 ou mais.
- **Nitidez (20):** `nr` (sem ele, `nq`) de 150 para cima vale tudo; 0 em 25.
- **Gente atrás (15):** `nb - n` igual a 0 vale 15; 1 vale 8; 2 ou mais vale 0.
- **Rosto lido (10):** `n` de 1 para cima vale 10; 0 vale 0.
- **Treino:** `ia.serve` falso tira a foto; verdadeiro soma 100.

**Desempate:** começa com as N primeiras, como hoje. Uma candidata posterior só entra no lugar da mais fraca se a nota for pelo menos 10 pontos maior (`BASE_NOTA_MARGEM`). As escolhidas saem em ordem de clique, então o mapa fundo/base não muda.

**Congelamento:** já existe e fica como está.
- `x["ia"]` é gravado uma vez no fechamento e vai para o arquivo da sessão.
- Leva fechada não recebe foto; foto nova abre outra leva, que fecha em `visita_ja_tem`.
- `cena_completa` e `_vis_ia_reabre` só preenchem `ia` vazia e nunca com base vendida ou em pedido aberto.
- O app só adota `ia` quando não tem (`srvIaCompleta`).
- O cliente só vê a leva depois de fechada, então a escolha nunca muda na frente dele.

## Decisões assumidas
- **Sem espera nova:** candidata ainda sem recorte no fechamento fica fora, e a leva nunca fecha mais tarde que hoje.
- **Mais recortes só com placa de vídeo:** na CPU a lista é só o que já foi medido, ou seja, igual a hoje.
- **Chave sem reiniciar:** `config/treino.bases`, em Configurações › IA automática, só Admin (padrão de 24/11).

## Mudanças por arquivo

**`agente/eterna-agente.py`**
- Constantes `BASE_POOL_MAX`, `BASE_NOTA_MARGEM` e `BASES_FORCA = os.environ.get("ETERNA_BASES")`; `primeiras` vence tudo, como o `ETERNA_MONTAGEM=0`.
- `base_sinais` (dict pid para `{nq, nr, n, nb}`, teto de 20.000): preenchido em `lx_acrescenta`, limpo em `lx_lgpd_mem`, recarregado na partida com hoje e ontem de `lixeira.dados`.
- `base_humano` (pid para `serve`): preenchido em `treino_gravar`, limpo em `treino_lgpd`.
- `base_nota(pid)`: função pura, só memória, pode rodar com o `sess_lock`.
- Renomear a atual para `_sess_ia_bases_ordem`. A nova `_sess_ia_bases(x, n)` chama a antiga; se o estado não for `ok` ou o modo for `primeiras`, devolve igual. Senão aplica a troca por margem. As três chamadas (6801, 8089, 18204) não mudam.
- `_sess_ia_cand`: com placa de vídeo e modo `melhores`, enfileira até `BASE_POOL_MAX` candidatas em vez de parar em N.
- `sess_ia_hoje` já guarda `_ia_vistos`; conferir que a limpeza de recortes não apaga as candidatas.
- `treino_cfg_valida`, `TREINO_CFG_PADRAO`, `treino_cfg_gravar` e POST `/treino/config`: campo `bases`.
- `/status.treino.bases`: `{modo, levas, trocadas, sem_medida}`, só números.

**`index.html`**
- `trCfgPanel` (8277): quarta linha "Escolha das fotos dos fundos de IA", com "As duas melhores" e "As duas primeiras", pela ação `tr-cfg` já existente.
- Chaves `tr_an_bases`, `tr_cfg_bases_melhores`, `tr_cfg_bases_primeiras`, `tr_cfg_bases_nota` nas 5 línguas da equipe. Não é tela de cliente.
- `auditLog` na troca.

**Testes e docs**
- `testes/cena_agente.py`, `testes/treino-claro.js`.
- Regra 19 em `docs/fundos-ia-regras.md`, `docs/CONTEXTO-ETERNA.md`, `VERSOES.md`.

## Contratos
- `config/treino`: `bases: "melhores" | "primeiras"`; ausente vale `melhores`.
- `POST /treino/config {bases}`: Admin, mesmo limite de 6 por minuto.
- `x["ia_regra"]` ganha `esc: {v:1, modo, pool, trocas}`. Conferir que o `srvPull` do app aceita chave a mais.

## 4. Riscos para amanhã e como desligar
- **Fila de recorte maior:** até 8 por leva em prioridade 1, em vez de 2 a 3. Olhar o atraso p50/p90 no log `montagem-srv:`.
- **Pesos não calibrados:** a margem de 10 limita as trocas. Antes de ligar, rodar leitura offline no servidor (só SELECT em `treino.db` e `cena.db`): quantas levas trocariam e se a nota separa "serve" de "não serve" na pergunta 3.
- **Aba antiga do app:** não manda `bases`; o servidor mantém o valor gravado quando o campo falta.
- **Desligar sem reiniciar:** IA automática › "As duas primeiras". Vale para as próximas levas; as fechadas ficam.
- **Desligar à força:** `ETERNA_BASES=primeiras` e reiniciar o agente. O reinício fecha as levas abertas, então só em último caso.

## Para a revisão de segurança
- `bases` só pela rota, e o `estado_gravar` segue recusando `config/treino`.
- Nada de pid, card ou caminho em log ou `/status`.
- Os dois caches novos precisam de teto e limpeza LGPD.
- `base_nota` não pode abrir banco com o `sess_lock`.
- Com 100 venues o custo é por leva (até 8 somas em memória) e a chave é por servidor.

## 5. Critérios de aceite
1. Modo `primeiras`, ou `ETERNA_BASES=primeiras`: `x["ia"]` igual ao da versão atual em todos os casos do `cena_agente.py`.
2. Modo `melhores` sem nenhum sinal de nitidez ou rosto e medidas de recorte iguais: mesmas bases de hoje.
3. Leva com 5 de gramado, em que a 1ª tem chão sob os pés e a 4ª é do joelho para cima: `ia` = [2ª, 4ª], em ordem de clique.
4. Diferença de nota menor que 10: não troca.
5. Foto com `borda`, sem pessoa ou com luz fora nunca entra, com qualquer nota.
6. Candidata sem recorte no fechamento: a leva fecha na mesma hora, com as medidas disponíveis, e `sem_medida` soma 1.
7. Leva fechada com bases: nota nova, rótulo novo ou troca da chave não alteram `x["ia"]`, nem depois de reiniciar o agente.
8. `cena_pendente` e Separar usam a mesma função e seguem recusando base vendida.
9. LGPD de uma foto: some de `base_sinais` e `base_humano`.
10. Só o Admin troca a chave; outro perfil recebe 403 e a tela não mostra o botão.
11. Checkout, Venda manual, Posto e impressão mostram as montagens das bases novas sem mudança no app (`gramado-checkout.js` e `montagem-servidor-checkout.js` passam).
12. `rec_pre_escolha` e `mtg_candidatas` seguem só com `x["ia"]`.

## 6. Dúvidas para o Eduardo
1. **Amanhã já valendo ou só medindo?**
   - (a) Valendo desde a abertura, com a chave à mão. É o que o plano assume.
   - (b) Só contar de manhã quantas levas trocariam e ligar à tarde.
2. **Das duas melhores, qual vai para qual fundo?**
   - (a) Ordem de clique, como hoje. Assumido.
   - (b) A de maior nota vai para Mirante e Telão, que abrem primeiro.
3. **Até onde procurar na sessão?**
   - (a) Entre as 8 primeiras do gramado. Assumido.
   - (b) Todas do gramado, com mais recorte e risco de atraso.
   - (c) Só as 4 primeiras.

## Fora do escopo
- **Achado à parte:** com a leva aberta, a Fila do fotógrafo mostra como "bases" os N primeiros cliques (linha 6508), não as de gramado. Já é assim hoje.
- **Fica para depois:** medida de enquadramento no recorte, "todos olhando para a câmera", poses e recalibrar os pesos com as marcações do Treino.

## Respostas do Eduardo (24/11)
1. Valendo desde a abertura de 25/11, com a chave em IA automática para voltar às duas primeiras.
2. Das duas escolhidas, a ordem é a do clique, como hoje.
3. Procurar entre as 8 primeiras do gramado.
