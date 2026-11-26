# Fotos vizinhas na selfie do Checkout (25/11/2026)

## Objetivo

No Checkout, o cliente reconhecido pela selfie via só as fotos em que o rosto dele aparece de frente. As fotos da mesma família feitas pelo mesmo fotógrafo segundos ou minutos depois (de costas, de perfil, olhando longe) ficavam de fora. A selfie passa a mostrar também essas fotos.

## Regra

- O servidor do ponto parte das fotos reconhecidas com certeza (semelhança >= `LIMITE` e rosto principal na foto, os dois da mesma pessoa; na busca em grupo o `grupo_juntar` marca isso por foto no campo `ancora`).
- Anda pela trilha dessas fotos (mesmo dia, mesmo fotógrafo, mesma origem), foto a foto na ordem do clique, para antes e para depois.
- Para, naquele sentido, na primeira foto com rosto de qualidade (tabela `rosto_q`) que não bate com o grupo reconhecido (`VIZ_LIM`, igual a `LIMITE`, 0,45).
- Grupo reconhecido:
  - o rosto de quem fez a selfie em cada foto reconhecida entra sempre (semelhança >= `LIMITE` com o vetor da selfie, que fica só na memória daquela busca);
  - outro rosto principal só entra se o mesmo rosto for principal em pelo menos 2 fotos reconhecidas, ou se na foto tiver pelo menos 80% da largura do maior rosto (`VIZ_G_FORTE`) e for rosto de qualidade;
  - quem aparece atrás do cliente numa foto só não entra no grupo.
- Na busca em grupo (foto do grupo), o grupo reconhecido junta os rostos principais das fotos de todas as pessoas da selfie, e as vizinhas de todas entram.
- Também para na foto ainda sem leitura de rosto, na sessão aberta e na sessão protegida (escola ou menor).
- Para quando passam mais de `VIZ_GAP` segundos entre uma foto e a seguinte da caminhada. Um ensaio longo entra inteiro enquanto as fotos vierem em sequência.
- Sessão removida, de outro dia ou de outra trilha nunca entra. Base dos fundos de IA nunca entra.
- A foto que a busca já devolveu (clara ou "talvez") não se repete.

## Limites

| Constante | Padrão | Variável (piso a teto) | O que limita |
| --- | --- | --- | --- |
| `VIZ_GAP` | 180 s | `ETERNA_VIZ_GAP` (30 a 900) | intervalo entre uma foto da caminhada e a seguinte, pela hora do clique |
| `VIZ_ALCANCE` | 1500 s | `ETERNA_VIZ_ALCANCE` (60 a 3600) | distância, para cada lado, desde a foto reconhecida mais próxima |
| `VIZ_MAX` | 80 | `ETERNA_VIZ_MAX` (1 a 200) | fotos vizinhas por busca (ficam as mais próximas das reconhecidas) |

As variáveis são lidas quando o agente sobe. Valor ilegível vale o padrão; fora da faixa vale a ponta mais próxima.

A hora de cada foto é o clique corrigido que o agente guarda em memória. Depois de um reinício do agente essa hora não existe mais para as sessões antigas; nesse caso a hora da foto é repartida entre o primeiro e o último clique da sessão.

Quando a caminhada para num teto, o campo `viz.corte` diz qual (`"alcance"` ou `"max"`). Parar pelo intervalo, por rosto de fora ou por sessão protegida não é corte.

Vale só no Checkout assistido (`POST /rostos/buscar` sem `todo`). A galeria por QR, a busca do Posto e a galeria de escola não mudam.

## Contrato

`POST /rostos/buscar` ganha dois campos quando a chave está ligada e há foto achada:

```json
{"rosto": true, "fotos": [], "vizinhas": [{"id": "<pid>", "card": "LP...", "mesma": true}], "viz": {"ligada": true, "n": 1, "ms": 1, "corte": null}}
```

`mesma` diz se a foto é de uma sessão que tem foto reconhecida. App antigo ignora os campos. A contagem de fotos da selfie (tabela `selfie` e diagnóstico) continua só com as reconhecidas. O diagnóstico da selfie ganha `viz_n` e `viz_corte` (só os números, sem id de foto nem de sessão).

No app, `lojaJuntar(res, tv, sims, viz)` soma as vizinhas só quando há foto clara. Busca só com "talvez" não puxa vizinha. Sessão de menor, de escola ou já paga fica fora. Na sessão só com "talvez" as vizinhas entram só com o Sim da pergunta ("Esta sessão também é sua?"); a que não chega a ser perguntada (só as 3 primeiras são) fica sem vizinha. Em "Adicionar outra pessoa", cada selfie traz as vizinhas dela e a soma não repete foto nem perde as das pessoas anteriores. O app aceita até 200 itens em `vizinhas`. Nenhum texto novo para o cliente.

## Chave de desligar

- Painel de controle › Checkout, **Fotos vizinhas na selfie do Checkout**: só o Admin vê e muda. Vale na busca seguinte, sem reiniciar.
- Grava `config/vizinhas {"ligada": bool}` pela rota `POST /vizinhas/config` (só o perfil Admin da sessão; os outros recebem 403 `so_admin`). A sincronização de documentos recusa esse documento.
- `ETERNA_VIZINHAS=0` no ambiente do servidor desliga e vence o Painel (exige reiniciar o agente).
- Sem documento gravado, fica ligada. Documento que existe e não pôde ser lido (formato ruim, banco ocupado) vale desligada até a próxima leitura boa.
- Estado em `/status.sessoes.vizinhas` (`ligada`, `forcada`, `em`).
- Qualquer erro no cálculo devolve lista vazia e a busca responde como antes.

## Testes

- `testes/vizinhas_agente.py`: mesma sessão, sessão vizinha a 150 s e a 200 s, cadeia de 6 sessões a 2 min 30 s, alcance de 1500 s com o corte, rosto de outra pessoa a 10 s, rosto do grupo, quem entra no grupo (estranho a 60% numa foto só, casal de frente uma vez, filho pequeno em 2 fotos), barreira em 0,45, âncora na busca em grupo, busca em grupo com duas pessoas, o que nunca entra, teto de 80 com o corte, variáveis dos limites, custo com 5.000 fotos no dia (meta abaixo de 50 ms), erro, rota com e sem `todo`, diagnóstico, chave (documento ilegível, banco ocupado, reinício), só Admin, sincronização, `/status`.
- `testes/checkout-vizinhas.js`: Checkout com reconhecidas e vizinhas, pedido no Posto com todas, só "talvez", proteções, Adicionar outra pessoa (2ª e 3ª), quarta sessão "talvez", foto do grupo, interruptor do Admin.
- Regressão: `sessoes_agente`, `visitas_agente`, `selfie_rapidez`, `seguranca_rotas_agente`, `checkout-varias-sessoes`, `visitas-checkout`, `selfie-varias`, `escola-galeria`, `posto-checkout`, `idiomas`.

## Limites conhecidos

- A fila da trilha é montada sessão por sessão (pela hora do primeiro clique). Duas sessões da mesma trilha com cliques intercalados não são intercaladas foto a foto.
- Rosto pequeno, de perfil ou coberto pode não ter leitura de qualidade; a foto com ele não para a caminhada.
- A leitura do banco de rostos para as vizinhas espera no máximo 1 s; banco ocupado devolve a busca sem vizinhas.

## Pendências

- Limite de pedidos por minuto em `POST /rostos/buscar`.
- Proteção das sessões de escola antes de a galeria da escola ser publicada (hoje a sessão só é protegida depois da publicação ou quando marcada como de menor).

## Fora desta entrega

- Mudar `SESS_PAUSA` ou a regra de fechamento das sessões.
- Ligar as visitas por rosto.
- Coluna nova na tabela `selfie`.
