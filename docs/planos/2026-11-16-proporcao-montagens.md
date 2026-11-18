# Proporção da pessoa nas montagens (Eduardo, 16/11/2026)

Eduardo olhou nove montagens reais (casal, pessoa sozinha de braços abertos e grupo de 5 com bandeira, nos três fundos). O recorte foi aprovado. O problema que sobrou era o tamanho da pessoa quando o recorte é estreito.

## Decisões

| Caso | Mirante do Rio | Telão do Maracanã |
|---|---|---|
| Recorte largo (grupo, bandeira aberta, braços abertos): a largura limita | Aprovado como estava. Não muda | Aprovado como estava. Não muda |
| Recorte estreito (casal, pessoa sozinha com os braços junto ao corpo) | Corte em 74% da altura do recorte (quadril), topo a 20% do alto, encostado embaixo | Corte do peito para cima, topo a 10% do alto da tela, casal com cerca de 60% da largura da tela |

A Arquibancada 1950 ficou de fora desta entrega: o fundo vai ser trocado.

## Como foi feito

- `FIA_REGRAS.mirantedia` e `FIA_REGRAS.telao` ganharam a entrada `estreito`. As entradas `meio` e `inteiro` não mudaram.
- `fiaEstreito` decide pela razão largura/altura do recorte medido (`fiaMedir`), só quando o recorte encosta na borda de baixo: até 0,70 usa `estreito`; de 1,20 em diante devolve nada e o `fiaLayout` segue com `meio`, igual a antes; entre os dois, corte, altura, largura e centro andam em linha reta.
- A largura usa o menor entre o teto do `estreito` e o do `meio`. A proteção de rosto é a mesma (`parte` desce a linha de corte).
- O `fiaLayout` devolve `estreito` (1 = estreito, 0 = largo, entre os dois na faixa). Prévia (`fiaMontar`) e impressão (`compHi`) passam pelo mesmo `fiaLayout`.

## O número do Telão

O teste à mão anotou "corte em 55%, casal com 66% da largura". No app as duas coisas não fecham: com o topo a 10% e encostado embaixo, 55% dá 53% da largura. A imagem aprovada mostra o casal com cerca de 60% da largura, o que corresponde a 47%. Ficou 47%, que reproduz a imagem aprovada. Para trocar, é um número em `FIA_REGRAS.telao.estreito.corte`.

## Conferência

- Com os três recortes reais do teste (fora do repositório), as montagens de braços abertos e de grupo saíram idênticas às de antes, ponto a ponto, nos dois fundos. As de casal saíram como as aprovadas.
- `testes/proporcao-montagens.js`: recortes sintéticos com as mesmas proporções. Largo igual à conta antiga, número a número; estreito com o corte novo, topo no lugar e teto de largura; razão de 0,40 a 1,70 sem salto; rosto na linha de corte; prévia e impressão.
- `testes/tres-fundos.js`: o recorte de teste tem razão 0,85 e cai na faixa entre os dois casos; a conferência do Mirante do Rio foi ajustada para isso.

## Fica para depois

- Corpo inteiro estreito (não encosta embaixo) segue com a regra antiga. Os cliques de IA são do joelho para cima (regra 18).
- Deslocar o grupo para livrar o Maracanã e o Cristo no Mirante do Rio: não decidido.
