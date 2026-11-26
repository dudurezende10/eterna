# Montagens de IA na Curadoria (26/11/2026)

## Objetivo

Pedido do Eduardo (26/11): ter na Curadoria uma tela para ver as montagens com fundo de IA que o servidor já fez e dizer se cada uma ficou boa ou ruim. As notas servem para medir e melhorar a montagem (recorte, enquadramento, escolha da base).

## O que entra

- Tela **Curadoria › Montagens de IA** (view `montagens`), logo depois da Lixeira da IA. Módulo `qualidade`: Ver abre a tela, Alterar dá a nota.
- A tela mostra só o que o servidor já montou e guardou. Ela nunca pede montagem nova e nada é montado no navegador.
- Nota por montagem (uma base de IA num fundo): **Boa** ou **Ruim**. Ruim aceita motivos, mais de um:

| Chave | Texto na tela |
| --- | --- |
| `pequena` | Pessoa pequena |
| `recorte` | Recorte com sujeira ou falha na borda |
| `corte` | Corte errado: perna, braço ou cabeça |
| `lugar` | Não é gramado: arquibancada ou sentado |
| `luz` | Luz: escura, estourada ou cor |
| `outro` | Outro |

- Dá para trocar a nota e desfazer.

## Onde mora o dado

Regra do projeto: registro no banco do servidor, com quem, quando e `idem`.

- `treino.db` (o mesmo banco do Treino da IA e da Lixeira da IA; vai para o backup):
  - `mtg_nota (pid, fundo, dia, v, mot, dados, por, em)`: uma linha por foto e fundo, a nota atual. Desfazer apaga a linha.
  - `mtg_nota_log (pid, fundo, v, mot, dados, por, em, idem)`: só acrescenta, uma linha por gravação (também o desfazer, com `v` nulo). `idem` único.
- `por` e `em` vêm da sessão de login, nunca do navegador.
- `dados` guarda o que a montagem era naquele momento: versão do motor (`MTG_VERSAO`), versão do recorte (`REC_VERSAO`), versão do fundo (`mtg_versao`), se era a base preferida, sessão, fotógrafo e a medida do `info` da montagem. Assim a nota continua fazendo sentido depois que a montagem mudar. Quando a montagem é refeita com outra versão, a lista devolve a nota com `atual: false` e a tela avisa.
- A exclusão LGPD da foto apaga as duas tabelas (`treino_lgpd`).
- O navegador não guarda nada: `state.mn` é só a memória da tela.

## Rotas (agente)

| Rota | Quem | O que faz |
| --- | --- | --- |
| `GET /montagens/dia?dia=aaaa-mm-dd&de=N` | sessão com `qualidade.r`; 30 por minuto por pessoa | montagens prontas do dia (base candidata x fundo ativo com a prévia da versão atual em disco), da sessão mais nova para a mais antiga, até 2.000 por pedido a partir de `de` |
| `GET /montagens/previa/<pid>/<fundo>.jpg` | sessão com `qualidade.r`; 600 por minuto por pessoa | a prévia pronta, do disco. Nunca põe montagem na fila. O que não existe responde o mesmo 404 |
| `POST /montagens/nota {pid, fundo, v, motivos, idem}` | sessão com `qualidade.u`; `X-Eterna`; 120 por minuto por pessoa; corpo até 1 KB | grava a nota. `v` = `"boa"`, `"ruim"` ou `null` (desfaz) |

- Origem local nas três. Posto pareado não lê. O "ver como" não grava.
- O console registra cada nota com o fundo e quem deu, sem o id da foto.
- A foto original da tela vem do `/thumb/` e do `/file/` de sempre, que já aceitam `qualidade.r`.
- Dias: o servidor só monta as sessões do dia corrente e guarda as montagens por `MTG_DIAS` (2 dias). Dia mais antigo que isso devolve lista vazia com `motivo: "guarda"`. Lista vazia de hoje devolve `motivo: "desligada"` (chave `config/montagem` desligada) ou `"nenhuma"`.

## Tela

- Contadores: prontas, sem nota, boas e ruins, do dia e do filtro.
- Filtros: dia (hoje e os dias da guarda), fotógrafo, fundo (Todos e os ativos) e situação (Sem nota, Boas, Ruins, Todas; padrão Sem nota).
- Grade em lotes de 24 com rolagem contínua. Em 390 px, duas colunas e botões de 44 px.
- Cartão: a montagem com a foto original no canto, fundo, sessão, fotógrafo, hora, nota atual e quem marcou. Tocar na imagem abre o zoom com a montagem e, na seta, a original.
- A lista na tela é um retrato do filtro: a montagem que ganha nota continua à vista (para trocar ou desfazer) e só sai no próximo filtro ou no Atualizar.
- A nota aparece na hora; se o servidor não gravar, a tela volta ao que era e avisa.
- Menu: Admin e Supervisora (perfil pronto e, para a já gravada, `migraMontagens26`, marca `mmn26`). Validador, Fotógrafo e Atendimento e venda não veem.

## Fora desta entrega

- Usar as notas para decidir sozinho (trocar de base, esconder montagem ruim do Checkout).
- Relatório das notas por fundo, motivo e versão.
- Contagem no item do menu.
- Guardar as montagens por mais dias para revisar dias antigos.

## Testes

- `testes/montagens_ia_agente.py`: permissões, lista, prévia, nota, `idem`, desfazer, LGPD.
- `testes/montagens-ia.js`: menu, lista em lotes, filtros, nota, falha da gravação, estados vazios, zoom, 390 px e línguas.
- `testes/seguranca_rotas_agente.py` confere as três linhas novas da tabela `ROTAS`.
