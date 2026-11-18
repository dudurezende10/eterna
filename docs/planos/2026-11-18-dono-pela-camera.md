# Dono da foto pela câmera (18/11/2026)

Correção pedida pelo Eduardo em 18/11. Ramo `fix/dono-pela-camera`, a partir de `idiomas-base` 6fc75d4.

## O que aconteceu

O Eduardo mandou 70 fotos do cartão da câmera do Márcio por Minhas fotos › "Enviar fotos do cartão manualmente" com o seletor Fotógrafo em Samuel. A Biblioteca mostrou Márcio (o app lê o autor gravado na câmera, `camWho`), mas as 5 sessões do dia ficaram com Samuel, porque o `ff_quem` do agente dava prioridade à origem (o `quem` da tela) sobre o autor e o dono gravados na câmera.

## Decisões do Eduardo

1. **Quem manda é a câmera.** Na foto de cartão (`s == "cartao"`: envio manual, cartão lido no servidor e o futuro leitor do gramado) o fotógrafo vem do autor e, sem ele, do dono gravado na câmera. A origem (rótulo do cartão) só vale quando a câmera não identifica ninguém. No FTP nada muda: login ou subpasta primeiro.
2. **No envio manual ninguém escolhe o fotógrafo**, nem o fotógrafo logado. O `POST /fotos/enviar` não exige nem usa `quem`; a origem gravada é fixa (`ENVIO_ORIGEM = "tela:envio"`, nunca um fotógrafo). Câmera sem nome cadastrado: a foto fica sem fotógrafo ("sem fotógrafo · câmera ···1234").
3. **O ponto não importa mais em Minhas fotos.** Saíram o seletor Ponto, o filtro por ponto das sessões e o ponto do cabeçalho ("Fotógrafo · Samuel · Foto Campo 4"). Fica o filtro por fotógrafo. Os dados e o cadastro de pontos ficam.
4. **As sessões que já existem são corrigidas na partida do agente** (`sess_dono_corrigir`).

## O que mudou

Agente (`agente/eterna-agente.py`):
- `ff_quem_como`: no cartão, autor e dono da câmera antes da origem; no FTP, como antes.
- `sess_dono_corrigir`: além da sessão fechada sem fotógrafo, corrige a sessão fechada de cartão (`fonte` "cartão", ou atrasada com todas as fotos de cartão) que já tem fotógrafo, quando todas as fotos resolvem pela regra nova para um mesmo cadastrado diferente do atual. Grava `dono_corrigido` com `de` (o atual), `para`, `motivo`, `fonte_antes`, `venda_paga` (há venda paga ligada à sessão, lida dos eventos; `None` se não deu para ler) e `anterior` (a correção que já existia). Rev novo, mesma janela (hoje e ontem em memória), mesmas travas, idempotente. Sessão com venda paga também passa, como já acontecia com a sessão sem fotógrafo: a venda vai para a estatística do fotógrafo certo.
- `fotos_enviar_post`: sem `quem`; aceita `mt` (data do arquivo, `envio_mt`) e grava essa data no arquivo antes do `ingest_file`, como faz o cartão lido no servidor; sem `mt` válido, a foto entra sem `mt` (`ingest_file(..., sem_mt=True)`).

App (`index.html`):
- `camWho(serie, day, autor, dono)`: autor e depois dono, a mesma ordem do agente. O mapa série → fotógrafo do check-in antigo (`SIM.camDia`, `camDay`) deixou de ser lido: ninguém grava nele desde a v80 (28/10), a Biblioteca só mostra hoje e ontem e o agente não o conhece. Os dados continuam no SIM.
- Envio manual: saíram `envioQuem`, `ENVIO_NAO.quem` ("Escolha o fotógrafo acima") e a frase "As fotos entram como do cartão de X"; entrou "O fotógrafo de cada foto vem do nome gravado na câmera..." (`en_camera`, 5 línguas). O POST leva `mt = lastModified` em segundos. Auditoria: `auditLog('fotos_envio_manual', 'cartao', ...)` com quem mandou em `por`.
- Minhas fotos: sem o seletor `imp-point`, sem o efeito dele em `upSessLista`, sem o ponto no cabeçalho.
- `srvDono` já trocava de um fotógrafo para outro (só exige `dono_corrigido.para === fotografo` e nome diferente na cópia); só o comentário e a linha do registro mudaram.

## As 59 fotos numa sessão só (LPVQPXP92, `fonte_t: "mt"`)

No envio manual o agente grava a foto num temporário e usa a data desse temporário como `mt`. Essa data é a hora da chegada. Então `fonte_t: "mt"` no envio manual queria dizer, na prática, "a hora do clique do EXIF foi recusada e valeu a hora da chegada", com o rótulo errado (a tela só avisa "chegada" com `fonte_t: "u"`). As fotos de um lote chegam a segundos umas das outras, sem a pausa de 60 s, e por isso as 59 fotos recusadas caíram numa sessão só; as outras 11, com o EXIF aceito, se separaram em 4 sessões pela hora do clique.

O EXIF foi lido (a Biblioteca achou o Márcio pelo nome gravado e o navegador manda o arquivo sem mexer), então a hora do clique existia e foi recusada pela janela de `sess_clique`: clique corrigido fora de [chegada − 48 h, chegada + 10 min]. Como 11 fotos da mesma câmera passaram, as causas possíveis são:
- as 59 fotos eram de mais de 48 h antes (fotos antigas ainda no cartão); ou
- o relógio da câmera estava adiantado (por exemplo, no fuso UTC, 3 h à frente): as fotos das últimas horas ficam "no futuro" e passam dos 10 min.

Conferir no posto, com o Admin, no console do navegador em Minhas fotos (minutos entre o clique da câmera e a chegada, por foto):

```js
const s=ETERNA.SRV.sess.LPVQPXP92,ids=new Set(s.fotos);ETERNA.state.lib.filter(f=>ids.has(f.id)).map(f=>f.cap?Math.round((f.cap-f.t)/60):null)
```

Acima de +10: relógio adiantado. Abaixo de −2880: foto de mais de 48 h. `null`: sem hora no EXIF.

Correção feita: o app manda a data original do arquivo (`lastModified`) e o agente a usa como `mt`; sem ela, a foto entra sem `mt` e a sessão diz "chegada". Isso não separa as 59 fotos se o relógio da câmera estava errado: a data do arquivo no cartão vem do mesmo relógio e cai fora da mesma janela. A janela de 48 h não mudou (pergunta aberta ao Eduardo; ver abaixo).

## Fora desta correção

- A janela de 48 h / 10 min (`SESS_CLIQUE_ANTES`, `SESS_CLIQUE_DEPOIS`) não mudou. Proposta para decidir: no cartão, com o clique fora da janela, usar a diferença entre os cliques só para separar as sessões (a ordem e as pausas da câmera), sem usar a hora como hora do dia.
- A sessão de 59 fotos não é refeita: a correção troca o dono, não reagrupa.
- Ponto em outras telas: o Posto, o Checkout e a Fila do fotógrafo não filtram sessão por ponto (o Checkout e a sessão em Minhas fotos só mostram o nome do ponto). Nada mudou nelas.
- Cada sessão em Minhas fotos ainda mostra o ponto dela ("sem ponto" com a Escala desligada); só o filtro e o cabeçalho saíram.
- O palpite pela Roverpix (`camGuess`, na `libWho`) continua só no app, depois do `camWho`; é palpite pela contagem de fotos, não o que a câmera diz, e o agente não o usa.
