# Três fundos de IA (Eduardo, 16/11/2026)

## O que mudou
O cliente passa a ver 3 montagens no Checkout, nesta ordem: **Mirante do Rio** (novo, de dia), **Arquibancada 1950** (a foto inteira em preto e branco, pessoa incluída) e **Telão do Maracanã** (imagem nova, luz corrigida). Noite de campeão, Mirante ao pôr do sol e Saída do túnel foram para Laboratório › Fundos em teste. Nada foi apagado: pedido e venda antigos com esses fundos continuam abrindo, montando e imprimindo.

Fica fora: melhoria de borda e luz do recorte; fundos por venue no servidor (white label); limpeza do código do Photoroom.

## Decisões
1. Id `mirantedia`; nome "Mirante do Rio" (pt), "Rio lookout", "Mirador de Río", "Belvédère de Rio", "Aussichtspunkt über Rio" (`I18N.bgMiranteDia`).
2. Posição no Mirante do Rio igual à regra 5 (centro 45%, até 80% da altura e 92% da largura, encostado embaixo; corpo inteiro do joelho para cima). O enquadramento é o mesmo do pôr do sol. A regra tem entrada própria (`FIA_REGRAS.mirantedia`), para ajustar sem mexer no antigo.
3. Ordem no Checkout: Mirante do Rio, Arquibancada 1950, Telão. A primeira é a que abre em tela cheia.
4. O Telão novo substitui a imagem do id `telao`. Reimpressão de montagem de Telão vendida antes sai com a imagem nova.
5. O recorte continua o local de hoje.
6. A lista salva de fundos **não é migrada**; passa a valer uma chave nova, `SIM.bgOn2` (documento `sim/bgOn2`, módulo `configuracao`). Motivo: `sim/bgOn` mora no servidor e na primeira leitura o servidor vale por cima, então uma troca feita em cada aparelho seria desfeita e a lista antiga, filtrada pelos ativos, viraria só 1950 e Telão. Com a chave nova, sem escolha salva vale o padrão (a trinca), janela antiga não estraga e desfazer o deploy volta sozinho à lista antiga. `SIM.bgOn` não é mais lido nem gravado, mas continua em `SIM_INTEIRO` e em `DOC_SIM` (tirar faria cada aparelho mandar apagar no servidor). As migrações `bgMigraPodio` (v86) e `bgMigraTelao` (v97) saíram.
7. `bgOn2` só vale se for lista de textos; qualquer outro valor vale o padrão. Lista vazia salva de propósito continua vazia.
8. Telão: um arquivo só para prévia e impressão, 2576 px (a impressão 10×15 tem 1844×1240; mais que isso só deixaria a montagem lenta).
9. Mirante do Rio: prévia em 2400 px e impressão em 5000 px, as duas do original de 5040×3594 enviado pelo Eduardo em 16/11.
10. Preto e branco do 1950: prévia e impressão passam pelo mesmo `fiaMontar` → `fiaDesenhar`. O único caminho em que a pessoa podia sair colorida era navegador sem `filter` no canvas (Safari; navegadores de iPad e iPhone). Agora `fiaPB` confere uma vez se o `filter` funciona de verdade (um ponto vermelho tem que sair cinza); sem ele, converte ponto a ponto (0,2126 R + 0,7152 G + 0,0722 B) e aplica o contraste de 1,10 na pessoa do mesmo jeito (`fiaContraste`). Gancho de teste: `ETERNA.fiaSemFiltro(true)`.

## Imagens (JPEG qualidade 90, sem metadados)
| Arquivo | Tamanho | Uso |
| --- | --- | --- |
| `img/bg-mirantedia.jpg` | 2400×1711 | prévia |
| `img/fundos-5k/mirantedia.jpg` | 5000×3565 | impressão (`fileHi`) |
| `img/bg-telao-v2.jpg` | 2576×1839 | prévia e impressão |

Imagem nova entra sempre com **nome de arquivo novo**: o agente guarda o arquivo em disco e só revê uma vez por partida, e o navegador guarda por 1 hora. Para trocar um fundo: arquivo novo, `file`/`fileHi` em `DATA.backgrounds` e as listas do agente (`APP_FUNDOS_ATIVOS`, `FUNDOS_PREVIA`, `FUNDOS_IMPRESSAO`). O layout é proporcional ao arquivo; nenhuma regra muda se o enquadramento e a proporção forem os mesmos.

## Cantos do Telão novo
Medidos no original de 4096×2924 (ajuste de reta nas 4 bordas, desvio máximo 1,8 px), pela borda de dentro do filete escuro, na ordem sup. esq., sup. dir., inf. dir., inf. esq.:

`telao:{w:4096,h:2924,quad:[[884,181],[3485,525],[3582,1931],[848,1681]]}`

O `fiaTelao` escala por `largura/telao.w`, então vale para o arquivo de 2576 px. A geometria é quase a do telão antigo (3 a 6 px de diferença), mas não igual. Conferência: `TRES_FUNDOS_RENDER=<pasta> node testes/tres-fundos.js` grava a montagem e os 4 cantos ampliados 4 vezes (e, em vermelho, todo ponto que mudou em relação ao arquivo). Tem que valer: nada novo sobre a moldura cinza, nenhuma faixa da torcida antiga entre a imagem e o filete, e fora do quadrilátero a foto igual ao arquivo (até 2 por canal; o `fiaWarp` cobre até 2,5 px do filete, de propósito).

## Onde está no código
- `index.html`: `BG_DEF`, `bgOn()`, `case 'bg-on'`, `bgMover`, `SIM_INTEIRO`, `FIA_BASE`, `DATA.backgrounds` (`mirantedia` novo; `telao` com arquivo e cantos novos; `campeao2`, `mirante` e `tunel` com `inativo:true`), `FIA_REGRAS.mirantedia`, `I18N.bgMiranteDia`, `fiaFiltroOk`/`fiaContraste`/`fiaPB`, textos `lab_ate5_nota` e `lab_fundos_nota` nas 5 línguas.
- `agente/eterna-agente.py`: `APP_FUNDOS_ATIVOS` (os 3 arquivos da trinca; `/status.app_offline_pronto` passa a exigir os três), `FUNDOS_PREVIA` e `FUNDOS_IMPRESSAO` (+ `mirantedia`), `DOC_SIM` (+ `bgOn2`).
- Correção junto: `bgTelaoV97` estava em `SIM_INTEIRO` e faltava em `DOC_SIM`; o servidor recusava como desconhecido e cada aparelho tentava gravar de novo a cada carga, com o aviso de alteração não aceita. Entrou em `DOC_SIM`.
- Chaves de item e de venda não mudam: `ai:<foto>|<fundo>`; o fundo novo entra como `|mirantedia`.

## Testes
`testes/tres-fundos.js` (novo): trinca no navegador limpo, lista antiga salva e lista antiga no servidor sem migração, `bgOn2` inválido, 3 montagens com as bases certas, nomes nas 5 línguas, Mirante do Rio (layout, impressão, Cristo dentro do corte 10×15), Telão novo (cantos, fora do quadrilátero, impressão), 1950 em preto e branco com e sem `filter`, ids antigos montando e imprimindo, Painel de controle e Laboratório. Ajustados: `telao.js`, `v81.js`, `v83.js`, `v86.js`, `selo-edicao.js`, `cliques-ia.js`, `cliques-ia-e2e.js`, `ondas-ux-i.js`, `app_offline_agente.py`, `seguranca_rotas_agente.py`.

## Cuidados no deploy
- Recarregar todos os postos: janela antiga segue com os 5 fundos até recarregar, e janela antiga de quem tem Configurações apaga `sim/bgOn2` se ele existir (o código antigo apaga chave que não conhece). Sem escolha salva o padrão já é a trinca.
- Publicar fora do horário de visita: cliente no meio da escolha perde as marcas das montagens que saíram.
- Impressão do Mirante do Rio: o corte 10×15 tira 5,7% do alto e o topo do Cristo fica a 3,6% da borda. Conferir numa impressão de verdade na DNP (a impressora come um pouco da borda). Se cortar, é ajuste de arquivo, não de regra.
- Estatística e histórico por fundo seguem pelo id; os ids antigos não mudam.
- Escala: os fundos ainda são lista fixa no app e no agente; com muitos venues isso vai para a configuração do venue no servidor (outro plano).
