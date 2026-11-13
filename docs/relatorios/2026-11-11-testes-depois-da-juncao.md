# Testes depois da junção dos ramos do Eduardo (11/11/2026)

Rodada de `testes/*.js` no servidor de teste (`idiomas-base`, até a v98.1 `c4fe705`), no notebook com Windows: 10 testes passaram e 30 falharam. Cada falha foi separada em três tipos:

- **Teste desatualizado**: o teste cobrava um comportamento que uma decisão já registrada mudou. O teste foi corrigido, sem mexer no app.
- **Defeito no app**: o app contraria uma decisão registrada. Fica relatado aqui; nada do app foi alterado nesta rodada.
- **Ambiente**: a falha vem do notebook (Windows, Python, Playwright, pacotes que não estão instalados), não do app.

## Defeitos no app (relatados, não corrigidos)

| Onde | O que acontece | Origem | Teste que pega |
|---|---|---|---|
| Ranking de produtos no Painel | "Cortesia porta-retrato" entra no ranking como venda de Porta-retrato com R$ 0, depois dos itens sem venda. `prodKey0` testa "porta-retrato" antes de "cortesia". | v98 | painel (critério 8) |
| Menu do Admin em 1366×768 | O menu rola 58 px. Os dois botões amarelos no alto (Abrir Checkout e Caixa, `cace1c4`) ocupam 90 px, e o critério H1 das ondas pede o menu sem rolar. | v96-ux | ondas-ux-h (H1) |
| Fundos de IA (técnico) | O texto "O Photoroom fica como opção em Preços e Checkout › Avançado" voltou com a junção; o recorte v97 tinha tirado o Photoroom das opções. | junção | v84 (critério 12) |
| Fontes | `Barlow Condensed` voltou como fonte reserva em `.es-tend` e `.es-g-card` (Estatísticas v97-agenda). A Onda A tirou Cormorant e Barlow do `index.html`. | v97-agenda | ondas-ux-a |

## Defeitos corrigidos depois (11/11, com o ok do Ronaldo)

| Onde | O que acontecia | Correção |
|---|---|---|
| Galeria da venda | O agente recusava a galeria com "preços inválidos": desde a v98.1 o app manda só `precos.todas`. | O agente aceita a galeria sem `dig`, como a nuvem. Sem preço por foto, `dig` fica igual a `todas`: qualquer compra online pelo agente custa o pacote, nunca R$ 0. Sem `todas` continua recusada. |
| Compra na galeria (app) | Sem a Foto digital avulsa, o preço por foto virou 0: a galeria mostrava e gravava a compra online por R$ 0. | Mesma regra do agente (`pubPrecos`): sem preço por foto, qualquer compra custa o pacote. |
| Tela final do QR no Checkout | Contagem em 30 s pelo `SIM0`. | `SIM0` grava 40. Ponto que já gravou 30 continua com 30 (não dá para saber se foi escolha): troque em Preços e Checkout › Checkout. |
| Menu da Supervisora | Grupo Sistema aparecia só com "Chute a gol". | `chute-a-gol` entrou em `SUP_SEM94`; uma migração única (`msup98`) tira a tela da Supervisora salva que já tinha migrado. A permissão do Laboratório dela não muda. |

## Testes corrigidos (desatualizados)

| Teste | Decisão que o teste não acompanhava |
|---|---|
| ondas-ux-f | Tela inicial do Checkout com "Digite sua sessão" nas 5 línguas (v97-junta). |
| ondas-ux-c | Agente em outro endereço fica indisponível e o app avisa para abrir pelo endereço do servidor (v93, `docs/GUIA-DA-EQUIPE.md`). O agente falso passou para o mesmo endereço da página. |
| ondas-ux-d | Contas do FTP vêm de `GET /ftp/contas` (v93). |
| ondas-ux-e, ondas-ux-h (H4), permissoes, v79-regressao (1.6) | Botões amarelos Abrir Checkout e Caixa no alto do menu para quem pode usá-los, sem "Abrir Checkout" no rodapé (Eduardo `cace1c4`, v97-junta "botão único"); botão Caixa abre a tela Caixa de antes (`cdcf4b5`). |
| ondas-ux-i | Aba Avançado sem "Montagem dos fundos" (recorte sempre local, `1589be1`); altura da aba Preços medida por produto, porque a v98 tem 12 produtos com a linha do SKU. |
| v81, permissoes (gaveta) | Pasta Laboratório dentro do Sistema é subpasta, com estilo próprio (`a9b4028`). |
| ondas-ux-e (E9), v79-regressao, painel, checkout-tela-cheia | Catálogo da Imply (v98 e v98.1): 12 produtos com os nomes da Imply, Fundo de IA fora, "3 fotos digitais e impressas" empata com a Zona Mista e o Ideal escolhe a que imprime mais (D11). |
| galeria-qr | Tela final do QR com "Comprar mais fotos" antes de "Voltar ao início" (`d5c5d65`); sem preço por foto, a compra online custa o pacote (v98.1). |
| checkout-tela-cheia | Tela final: QR, instrução da câmera, "ou acesse eterna.photo/g e digite o código" e o código, nessa ordem (`2a1cd80`). Antes o teste estourava o tempo; agora termina. |
| agenda-estatisticas, visitas-config, posto-checkout, operacao-agente, seg-pareamento-codigo-agente, caixa-galeria-agente | Fonte dos jogos, rosto da família e Postos deste ponto na aba Avançado (v97-junta); aviso do aparelho sem posto "ainda não é um posto" (`5b5d876`). |
| cliques-ia-e2e | Rotas da equipe no agente pedem sessão (v93): o teste usa a sessão de um admin no HOME temporário (`_agente_sessao`). |
| v83 (critério 23) | Impressão 10×15 sem tamanho fixo de página; a foto cobre o papel escolhido na impressora (`24c3668`). |

## Ambiente do notebook (não é o app)

| Teste | Causa |
|---|---|
| galeria-agente | A porta padrão do teste (8799) é a do servidor de teste deste notebook: o teste falava com o servidor em uso. Com `GA_PORTA` livre os critérios da galeria passam; um critério de rede (como o S6 do v77) fica para conferir fora do Windows. |
| v84, v961-testador | `rembg` e `onnxruntime` não instalados; o OpenCV instalado (versão nova do `dnn`) recusa o alvo do reconhecimento. |
| agente-seguranca, v84 | Permissão de arquivo do Unix não existe no NTFS; um passo manda um JPEG em hex pela linha de comando e passa do limite do Windows (`ENAMETOOLONG`). |
| fila-fotografo | O teste Python do agente troca só o `HOME`; no Windows o Python usa `USERPROFILE`, então o segundo agente grava em outra pasta. |
| v77-regressao | Lê o I18N procurando `\n};\n`, mas o checkout no Windows tem CRLF; o critério S6 lê `/proc` (só Linux). |
| v92-testador | No Windows o agente não aplica `ETERNA_TZ` (sem `time.tzset`), então o aviso de fuso não aparece. O critério 25 (pico às 10:41) também depende do fuso; confirmar no Mac. |
| visitas-config | Playwright 1.49 do notebook trata `?` no padrão de rota como curinga: `/visitas?*` captura `/visitas/config`. Nas versões novas o `?` é literal. |
| ondas-ux-a (A5) | O `http.server` do Python no Windows serve `.woff2` como `application/octet-stream`. |
| cliques-ia (19), sessoes-upload, v79-regressao, v92-testador | Tempos do notebook (5 s onde o critério pede 4 s, captura de tela esperando fontes) e o aviso do Chrome "wasm streaming compile failed" do onnxruntime contado como erro de página. |
| v96-testador (item 1) | Com o relógio falso do Playwright 1.49, a câmera desliga antes dos 55 s. Confirmar no Mac antes de tratar como defeito. |

## Como rodar no Windows

```bash
python -m http.server PORTA --bind 127.0.0.1
NODE_PATH=C:/xampp/htdocs/eterna-testes-tools/node_modules NODE_OPTIONS="--require C:/xampp/htdocs/eterna-testes-tools/windows-shim.js" U=http://127.0.0.1:PORTA/index.html node testes/<teste>.js
```

Nunca use a porta 8799 nem a 8797 neste notebook: são do servidor de teste.
