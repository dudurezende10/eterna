# Segundo verificador de rostos (AuraFace ao lado do SFace)

Situação em 27/11/2026: **no agente desde a v99.109.0** (itens 1, 2, 3 e 5 de "Como implementar"). Faltam o item 4 (5 quadros na tela da selfie e o aviso dos óculos) e a confirmação da fal.

## Chave de desligar

No painel logado com permissão de configuração: `POST /rostos2` com `{"ligado": false}` desliga na hora; `{"ligado": true}` religa; `{"corte": 0.92}` troca o corte (0,80 a 1,20). `GET /rostos2` mostra ligado, pronto, motivo, fotos lidas, o que falta de hoje e se hoje está coberto. Fica em `~/Eterna/ponto/rostos2.json`. Sem tocar em nada, `ETERNA_ROSTO2=0` no serviço desliga de vez.

## Por quê

A selfie sem código (v99.108) procura no dia inteiro. Com o SFace sozinho (corte 0,45) ela não acha selfie de óculos ou com pouca luz e, no dia inteiro, devolve estranhos demais. O InsightFace foi descartado: a diretoria não aprovou o custo da licença (27/11).

## Modelo

AuraFace v1, arquivo `glintr100.onnx` (260.694.151 bytes, SHA-256 começa por `a7933ea5330113b0`), de `huggingface.co/fal/AuraFace-v1`. Licença Apache 2.0. **Só esse arquivo:** os de detecção e atributos do mesmo pacote são do InsightFace, uso não comercial. Detecção e alinhamento seguem com o YuNet (5 pontos, molde ArcFace 112x112, RGB, (x-127,5)/127,5). Pendência: pedir à fal confirmação por escrito da origem dos dados de treino.

## Medição (27/11, servidor do estádio, só leitura)

6.959 rostos principais de 25/11 e 8.945 de 26/11, tirando quem aparece nos dois dias (equipe e guias). Cada rosto de 26/11 com 80 px ou mais procurado em todo o 25/11: tudo o que volta é estranho. "Acha a mesma pessoa" = pares do mesmo dia, fotos diferentes, em que um dos modelos dá 0,55 ou mais.

| Regra | Buscas com algum estranho | Acha a mesma pessoa |
|---|---|---|
| SFace >= 0,45 (hoje) | 41,2% | 98,6% |
| AuraFace >= 0,45 | 6,9% | 93,7% |
| AuraFace + SFace >= 0,84 | 13,8% | 99,5% |
| AuraFace + SFace >= 0,88 | 7,4% | 99,1% |
| AuraFace + SFace >= 0,92 | 3,7% | 98,4% |

Selfie de webcam do Ronaldo contra a foto dele de 25/11: de óculos SFace 0,379 (melhor estranho 0,368) e AuraFace 0,456 (melhor estranho 0,334), soma 0,835; sem óculos 0,553 e 0,506, soma 1,059. Velocidade: um leitor só, os dois modelos, AuraFace na placa: 2.000 fotos em 2 min. Scripts: `testes/medicao/rosto2_medir.py` e `rosto2_grade.py` (rodar como o usuário eterna; apagar `/tmp/aura` no fim).

## Decisão (Ronaldo, 27/11)

Soma das duas notas com corte **0,88**, configurável. Só na selfie do site nesta etapa; o Checkout do posto não muda.

## Como implementar

1. Leitor à parte, fora do `leitor_loop`: banco próprio (`rostos2.db`), cada rosto com o vetor SFace e o AuraFace lado a lado. Lê as fotos já lidas pelo SFace que ainda não têm o segundo vetor, o dia de hoje primeiro; dias antigos só fora do horário de operação.
2. Placa: sessão ONNX com CUDA, teto de 2 GB, um rosto por vez, esperando o recorte e a IA. Sem placa, desliga e avisa; nunca CPU.
3. Selfie sem código: se o dia está coberto pelo segundo leitor, vale a soma (passo 1 e passo 2); senão, a regra de hoje.
4. Tela da selfie: 5 quadros em 2 s, vale o melhor; sem achar, pede para tirar os óculos.
5. Chave de desligar sem publicar versão.
6. Antes de publicar: à noite, recorte, IA e AuraFace juntos, medindo o tempo do recorte e da IA com e sem ele.

## Entrada em produção (27/11, 23:28)

- v99.109.0 no servidor do estádio às 23:28:19, sem erro no log. O agente baixou o modelo (260 MB, SHA-256 conferido) e abriu a sessão na placa: 1.164 MiB no processo do agente; o recorte segue com os 9.274 MiB dele.
- Recorte com o segundo verificador relendo fotos sem parar, 10 recortes novos por rodada (`POST /recorte`, etapa do modelo na placa e total, em ms):

| Rodada | Modelo na placa (birefnet) | Total do recorte |
|---|---|---|
| Ligado | 521 a 533 | 952 a 1.177 |
| Desligado pela chave | 521 a 525 | 970 a 1.132 |
| Ligado de novo | 521 a 537 | 973 a 1.176 |

- A chave foi usada nesse teste (desligou e religou na hora, registrado no log com o usuário).
- Releitura: 27/11 coberto às 23:50; os dias anteriores seguem a cerca de 200 fotos por minuto, cedendo a vez ao recorte.
- Releitura dos dias 27, 26 e 25/11 concluída por volta de 00:04 de 28/11 (mais de 10 mil fotos).
- Teste pelo caminho do cliente (site, nuvem, estádio), dia 25/11, às 00:05 de 28/11, com as duas selfies de webcam do Ronaldo:

| Selfie | Resultado | Linha do log do estádio |
|---|---|---|
| Sem óculos | achou, 1 foto (a dele) | `selfie sem código (2 verificadores, corte 0.88): passo 1 1, passo 2 0, 1 sessões` |
| De óculos | não achou | `selfie sem código (2 verificadores, corte 0.88): passo 1 0, passo 2 0, 0 sessões` |

- A selfie de óculos soma 0,835 e fica abaixo do corte 0,88, como previsto na medição. Para ela entrar, o corte teria de ser 0,83 (estranho em cerca de 14% das buscas, contra 7,4% em 0,88 e 41% da regra antiga). Decisão do Ronaldo pendente; a troca é pela chave, sem publicar versão.
- Em operação o segundo leitor espera até 3 s por foto enquanto há recorte na fila: se ele atrasar, o dia de hoje fica abaixo de 97% e a selfie usa a regra de sempre até ele alcançar.
