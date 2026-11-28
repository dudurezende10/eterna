# Unir sessões e vender a partir do Procurar fotos (26/11/2026)

## Objetivo

Pedido do Eduardo (26/11): quando a selfie do cliente não traz todas as sessões dele (a foto com a taça, de lado ou de boné), o vendedor acha as sessões no Procurar fotos, confirma na tela dele quais são do cliente e abre a escolha de fotos no Checkout só com essas, já unidas. A venda segue o fluxo de sempre: pedido no Checkout, pacote e pagamento no Posto.

Regra do Eduardo (26/11): **a seleção de sessões é só do vendedor.** O cliente nunca vê a lista, as sessões não marcadas nem a marcação.

## Fases

| Fase | O que entra | Situação |
|---|---|---|
| 1 | Marcar sessões pelos filtros, "Iniciar venda com N sessões", "Vender esta sessão", origem da venda no evento e na métrica do dia | Feita (v99.104.0) |
| 2 | "Procurar por selfie" na tela do vendedor, com a lista de sessões achadas para ele conferir | Feita e DESLIGADA (seção "Fase 2" abaixo): as duas chaves nascem desligadas |
| 3 | Ajustes do que abre nas sessões achadas por selfie | Depois |

Fora do escopo: mudar a selfie do cliente, mudar os limites do Checkout, fechar sessão à força, mexer na Venda manual.

## Decisões assumidas (o Eduardo ainda pode mudar)

- A sessão marcada abre inteira no Checkout.
- Quem escolhe as fotos é o cliente, no monitor do Checkout, vendo só as sessões marcadas.
- Teto de 8 sessões por venda.
- Tudo ou nada: se uma marcada não puder entrar, nada abre e o vendedor vê o motivo.
- Sessão ainda aberta aparece com a caixa desligada e o texto "entra quando fechar (até N min)". O prazo vem da pausa de sessão do servidor (`sessPausaTxt`), não é fixo. Não há fechar à força.
- Sessão de menor ou de escola nunca entra por aqui. Ela continua na lista do vendedor, com a caixa desligada.
- Checkout com a câmera ligada (cliente no meio da selfie) conta como ocupado.
- A sessão que não é a âncora de uma venda unida aparece como vendida quando o servidor devolve as vendas do dia.
- Na tela do vendedor, as sessões marcadas aparecem com o número da sessão (`sessRot`); o canal e o evento levam só o código LP.

## Onde cada passo acontece

| Passo | Tela e aparelho | Quem vê |
|---|---|---|
| 1. Filtros e lista de sessões | Procurar fotos, janela logada do vendedor | Vendedor |
| 2. Marcar as sessões | Procurar fotos, janela do vendedor | Vendedor |
| 3. "Iniciar venda com N sessões" | Barra do Procurar fotos, janela do vendedor | Vendedor |
| 4. Escolha das fotos | Checkout (`#loja`), monitor do cliente | Cliente, só as sessões marcadas |
| 5. Pacote e pagamento | Posto, janela do vendedor | Vendedor |

O que mantém a seleção só com o vendedor:

- As marcadas moram em `state.procurar.sel`, memória da janela logada. Não vão para o SIM, para o `localStorage`, para o `sessionStorage` nem para o canal.
- O Checkout recebe uma mensagem só com os códigos marcados.
- O Checkout abre direto na foto ampliada, com as sessões unidas e o rótulo ponto e hora de sempre.
- A abertura não usa a visita (`so.visita=false`): sessão ligada por visita e não marcada não entra.
- A tela Procurar fotos não existe para a aba `#loja` nem para o perfil Checkout.
- O software não enxerga monitor espelhado ou virado para o cliente. Isso é montagem do posto e treinamento: tela estendida, nunca duplicada (está no Guia da equipe).

## O que mudou

### `index.html`

- Chave `PROCURAR_VENDER_ON` (ao lado de `PROCURA_SESSAO_ON`). Em `false`, a tela volta a ser a de antes e o Checkout ignora o pedido.
- `bfPodeVender()`: venda em Criar, fora do "ver como", fora do fotógrafo que só vê as próprias sessões, com o servidor do ponto ligado e fora da demonstração.
- `bfEstado(x)`: `aberta`, `protegida`, `paga`, `pedido`, `carregando` ou `livre`. Usa a situação da sessão no servidor, `psEstado` e as vendas de hoje de todos os postos (`MVS`, `GET /ponto/vendas-dia`, pedidas ao entrar na tela).
- `bfMk` (caixa Marcar em cada cartão, botão irmão do cabeçalho e das miniaturas), `bfSessaoVenda` ("Vender esta sessão" e Marcar na sessão aberta), `bfBarra`/`bfBarraUpd` (barra `#bf-barra` no pé da tela: contador, miniaturas das marcadas, aviso de que abrem inteiras, Limpar e Iniciar venda).
- `bfMarca(card)` não chama `render()`: troca só o botão e a barra, e a lista fica como estava. `bfEstUpd` troca só a caixa de uma sessão à vista quando a situação dela muda (fechou, foi vendida).
- A seleção sobrevive a filtro e a Atualizar; zera ao sair da tela, ao sair da conta e ao trocar de pessoa.
- `bfVender(cards, origem)`: revalida cada sessão; sem Checkout aberto, uma sessão segue pela Venda manual do Posto e mais de uma pede para abrir o Checkout; com cliente no Checkout, avisa; senão manda o pedido pelo canal e espera a resposta por 6 s.
- `lojaAbrirMsg` e `lojaAbrirPedido` (janela do Checkout): conferem formato, destinatário, idade da mensagem (4 s, menor que a espera de 6 s do vendedor) e cada sessão; abrem com `lojaAbrirSo` sem `base`; gravam só `so.origem`.
- `lojaPedido` grava `origem` no pedido e `pvDados` repassa ao evento `criar`.
- `bf-vender` e `bf-vender-uma` em `WRITE_OPS` (Criar) e `ACT_MOD` (Posto de venda).
- Textos `bf_*` no `EQ`, nas 5 línguas. Nenhum texto novo para o cliente.

### `agente/eterna-agente.py`

- `EV_ORIGENS = ("procurar", "procurar_selfie")`. `_ev_limpo` só guarda `origem` dessa lista; origem inválida sai e a venda fica.
- `met_v2` soma `por_origem` (venda sem origem cai em `sem_origem`), pela mesma regra do `por_canal`.
- `vendas_do_dia` devolve `origem`.

## Contratos

Canal `eterna-loja`:

```
{tipo:'abrir', id:'<12 a-z0-9>', para:'<janela do Checkout>', cards:['LP…'] (1 a 8), origem:'procurar'|'procurar_selfie', em:<ms>}
{tipo:'abriu', id, ok:true|false, motivo:null|'ocupado'|'carregando'|'paga'|'pedido'|'protegida'|'invalido'|'expirado'}
```

Evento `criar` (`POST /ponto/eventos`): `dados.origem` opcional; `dados.sessoes` como antes.

Métrica do dia: `por_origem: {procurar:{vendas,faturamento}, procurar_selfie:{…}, sem_origem:{…}}`.

Auditoria `procurar_vender`, em duas linhas ligadas pelo campo `pedido`: no envio, `[{campo:'sessoes',de:null,para:'…'}]` com `{posto,porNome,origem,n,via,pedido,resultado:'enviado'}`; na resposta do Checkout, `[{campo:'resultado',de:'enviado',para:'aberto'|'recusado: <motivo>'}]`. Cada linha é gravada uma vez; sem resposta em 1 min fica só a do envio. `via` = `checkout` ou `venda_manual` (esta com uma linha só).

## Testes

- `testes/procurar-vender.js`: quem vê Marcar, marcar sem redesenhar, barra, estados em palavras, abertura só das marcadas (unidas, inteiras, sem visita), recusas do Checkout, Checkout ocupado ou fechado, origem no pedido e no evento, auditoria, chave desligada.
- `testes/procurar-sem-vazar.js`: vendedor e Checkout em duas páginas do mesmo navegador; confere o DOM e o estado do Checkout, o canal, o `localStorage` e o `sessionStorage` do início ao fim.
- `testes/procurar_origem_agente.py`: lista de origens, `por_origem` e `vendas_do_dia`.
- Apoio: `testes/_procurar_vender.js` (agente falso, sessões e cadastros de teste).

## Ajustes da revisão de código (26/11)

- A mensagem ao Checkout vale 4 s e o vendedor espera 6 s. Resposta que chega depois do prazo, ou com o vendedor já em outra tela, ainda grava a auditoria e limpa a seleção.
- Sem Checkout aberto, a venda de uma sessão nunca nasce como Cortesia.
- Caixa Marcar com 44 px. Barra das marcadas só com miniatura e número; em tela estreita, uma linha com rolagem lateral.
- Vendedor recém-recarregado espera o Checkout se anunciar (até 5,5 s) antes de cair na Venda manual.
- O selo do cartão acompanha a sessão que fecha ou é vendida; a marcada que não pode mais entrar fica riscada na barra.
- Avisos com "Sessão 147".
- Agente: `_ev_origem(d)` no lugar da expressão repetida.
- A auditoria é gravada no envio e de novo no desfecho; os prazos não são alteráveis pela página (os testes servem o `index.html` com o prazo trocado); mensagem vencida no Checkout mostra ao vendedor o texto de "não respondeu".

## Fase 2: Procurar por selfie (26/11/2026)

Botão **Procurar por selfie** no Procurar fotos, ao lado dos filtros (não os substitui).

**A entrega fica pronta e desligada.** Para ligar são precisas as duas chaves: `ETERNA_BUSCA_VEND=1` no servidor do ponto (sem ela as rotas respondem 404) e `PROCURAR_SELFIE_ON=true` no `index.html`. O `/status` leva `rostos.busca_vend`, e a tela só mostra o botão com as duas ligadas.

Regras do Eduardo para esta fase:

1. Quem seleciona as sessões é o vendedor. A lista achada, o nível de cada sessão, as não marcadas e o identificador da busca ficam só na memória da janela do vendedor. O Checkout recebe só os códigos marcados, como na fase 1.
2. LGPD: a imagem da câmera não é guardada (como já é no Checkout); só câmera ao vivo, sem escolher arquivo; só sessões de hoje; sessão removida, de menor ou de escola nunca vem; foto que é base dos fundos de IA nunca é devolvida; toda busca é registrada no servidor.
3. Na busca do vendedor, mais de um rosto no quadro não recusa a busca: vale o rosto maior e a tela avisa "Usei o rosto maior. Se não for o cliente, enquadre só ele." A selfie do cliente no Checkout não mudou em nada (mesma rota, mesmos limites, mesma recusa com duas pessoas).

### Passo a passo do vendedor

1. Pede ao cliente antes de apontar a câmera (o modal lembra, com uma linha fixa). Toca **Procurar por selfie**, enquadra o cliente e toca **Procurar**.
2. A lista vem com as sessões **Certeza** já marcadas e as **Pode ser** desmarcadas (com mais de um rosto na câmera, nada vem marcado), cada uma com as fotos em que o rosto apareceu em destaque e as outras fotos da sessão ao lado. Ele desmarca a que não for do cliente e marca o "pode ser" que reconhecer.
3. Faltou alguma: **Adicionar pelos filtros** volta aos filtros com a seleção e a barra; **Voltar às sessões da selfie** retorna à lista.
4. **Iniciar venda com N sessões**: o mesmo `bfVender` da fase 1. A venda leva `origem: procurar_selfie` quando alguma marcada veio da selfie.

### `agente/eterna-agente.py`

- `POST /rostos/sessoes` com `{imagens: [1 a 3 quadros]}`. Só pessoa conectada com `venda` em Criar (tipo `sessao` em `ROTAS`): posto pareado sem pessoa, perfil Checkout e "ver como" não entram. A rota confere de novo origem e permissão, e recusa também quem tem vínculo de fotógrafo e Minhas fotos (a regra `impPreso` da tela; Admin e Supervisora fora dela).
- O tamanho de cada quadro é lido do cabeçalho por `img_dims_estrito`, só desta rota (o `img_dims` das outras não muda): quadro que não é JPEG ou PNG bem formado é recusado com 400 e quadro acima de `BUSCA_VEND_PIXELS` com 413, sempre antes de decodificar.
- A resposta não leva a nota: só o nível em palavras e as fotos. A nota fica no banco.
- `buscar_vend` e `_buscar_maior`: sempre só hoje e o dia todo (sem a janela do Checkout e sem `ETERNA_BUSCA_DIAS`); o maior rosto de cada quadro; `busca_vend_vetor` fica com a pessoa que é a maior em mais quadros e não mistura duas pessoas na média; `varias: true` na resposta quando havia mais de um rosto.
- `buscar_vetor(..., piso=None)`: sem `piso`, o corte de sempre (`LIMITE_TALVEZ`). A busca do vendedor passa `BUSCA_VEND_PISO`, ajustável por `ETERNA_BUSCA_VEND_PISO` e travado numa faixa fixa no código (nunca acima de `LIMITE_TALVEZ`).
- `busca_vend_sessoes(fotos)`: agrupa por sessão, com o `sess_lock`. Só `dia == hoje`, sem `removida`, sem `_vis_protegida` (menor ou escola), só foto que já está em `fotos` e que não é base de IA. `certeza` = alguma foto com nota a partir de `LIMITE` em que o rosto é dos principais da foto; o resto é `pode_ser`. Tetos: `BUSCA_VEND_CERTEZA_MAX`, `BUSCA_VEND_MAX` e `BUSCA_VEND_BATEU` fotos por sessão.
- Tabela `busca_vend` (`vendas.db`): `id, em, dia, por, posto, resultado, certeza, talvez, achadas, marcadas, marcada_em`. `por`, `posto` e as horas vêm da sessão e do servidor, nunca do corpo; sem posto pareado, `posto` guarda o endereço do aparelho. Sem conseguir gravar, a rota não roda a busca nem devolve lista. Guarda `BUSCA_VEND_RETENCAO` dias (limpa a cada busca e na limpeza diária, `sess_limpar`) e entra no Zerar fase de teste.
- Limite por pessoa: `BUSCA_VEND_POR_MIN` por minuto (429 `muitas_buscas`) e `BUSCA_VEND_POR_DIA` por dia (429 `limite_dia`). `busca_vend_reserva` conta e grava a linha da busca na mesma transação, então buscas simultâneas não passam do teto. A recusa por limite também fica registrada (`limite_min`, `limite_dia`), com teto por pessoa e por dia.
- `POST /rostos/sessoes/marcar` com `{busca, cards}`: vale uma vez, só para quem fez a busca, só busca de hoje e só com sessões que estavam nas achadas.
- `GET /ponto/selfies` ganha `vendedor` (as linhas de `busca_vend` do dia), `vendedor_resumo` (por pessoa: `buscas`, `acharam`, `sem_venda` e `limite`, para o Admin conferir o uso; a tela fica para depois) e as linhas de diagnóstico com `origem: vendedor`. A tabela `selfie` (contagem das selfies dos clientes nas Estatísticas) não recebe a busca do vendedor.
- Nasce desligada: sem `ETERNA_BUSCA_VEND=1` as duas rotas respondem 404. Com o reconhecimento desligado, 503.

### `index.html`

- Chave `PROCURAR_SELFIE_ON` (ao lado de `PROCURAR_VENDER_ON`), que nasce em `false`: a tela é a da fase 1.
- `bfSelfiePode()`: a chave, `bfPodeVender()`, reconhecimento ligado e `rostos.busca_vend` no `/status`. Sem isso o botão não aparece.
- `bfSelfie()`: modal `#bf-selfie-modal` na janela do vendedor, com a câmera ao vivo e sem campo de arquivo. `bfSelfieCam()` escolhe a câmera como o Checkout (`camEscolhe`); câmera em uso por outro programa ou pela janela do Checkout vira o aviso "A câmera está em uso..." com **Tentar a câmera de novo**, sem mexer no Checkout. `bfSelfieFecha()` solta a câmera ao fechar, ao achar, ao sair da tela ou da conta e sozinho depois de 1 minuto parado (`bfSelfiePrazo`, rearmado ao fim de cada busca sem resultado). O modal traz a linha fixa "Peça ao cliente antes de apontar a câmera.", fecha com Esc de qualquer lugar da página, prende o Tab nos próprios botões, devolve o foco ao botão que o abriu e mostra o vídeo sem espelho.
- `bfSelfieBusca()`: 3 quadros de até 960 px para o servidor; resposta que chega com o modal fechado, com outra pessoa conectada ou fora da tela é descartada. `bfSelfieNorm()` só aceita o formato esperado e não guarda a nota.
- `bfSelfieRecebe()`: o resultado vai para `state.procurar.selfie` (só memória); as de `certeza` que podem entrar (`bfEstado` em `livre`) chegam em `state.procurar.sel`, até o teto da venda (acima dele, aviso `bf_max`); com `varias` nada chega marcado; resultado novo tira as sessões que só estavam marcadas pela busca anterior.
- `bfSelfieLista()`, `bfSelfieCartao()`, `bfMkVivo()`: blocos Certeza e Pode ser, fotos do rosto com contorno (`.bf-bateu`) antes das outras, a mesma caixa Marcar e a mesma barra. `bfEstUpd` redesenha a lista quando a situação de uma sessão muda (vendida em outro posto, pedido, fechou), comparando com `data-ass` (`bfSelfieAss`). Ações `bf-selfie`, `bf-selfie-filtros`, `bf-selfie-ver`, `bf-selfie-limpa`. Nenhuma está em `WRITE_OPS` (a busca não grava nada no app e a tela segue sem ação de gravar à vista): quem barra é `bfSelfiePode()` e, de verdade, o servidor.
- `bfVender`: a origem é `procurar_selfie` quando alguma sessão marcada veio da selfie (`bfOrigem`). Quando a venda abre (Checkout respondeu, ou Venda manual com uma sessão), `bfSelfieMarcar()` manda ao servidor quais das achadas foram marcadas (com uma segunda tentativa se a rede ou o servidor falhar) e apaga o resultado da tela.
- Textos `bf_selfie*`, `bf_certeza*`, `bf_pode_ser*` e `bf_bateu` no `EQ`, nas 5 línguas. Nenhum texto novo para o cliente.

### Contratos da fase 2

```
POST /rostos/sessoes {imagens:[dataURL x 1..3]}
200 {ok:true, busca:'<16 hex>', rosto:true|false, varias:true|false, fila:N,
     sessoes:[{card, nivel:'certeza'|'pode_ser', status:'aberta'|'separada'|'fechada',
               fotografo, ponto, cap0, cap1, n, bateu:[{id}]}]}
Erros: 400 invalido, 401, 403, 404 (rota desligada), 413 grande, 429 muitas_buscas|limite_dia, 500 busca|registro, 503 desligado

POST /rostos/sessoes/marcar {busca, cards:[…]}  ->  {ok:true}
Erros: 400 invalido|fora, 404 busca, 409 ja_marcada
```

O canal `eterna-loja`, o evento `criar` e a métrica `por_origem` são os da fase 1.

### Testes da fase 2

- `testes/rostos_sessoes_agente.py` (no `testes/rodar.sh`): quem entra, os dois níveis, o que nunca vem, rosto maior com aviso, limite por pessoa, registro carimbado pelo servidor, marcar, nada de imagem no disco, chaves de desligar e `/rostos/buscar` respondendo como antes.
- `testes/procurar-selfie.js`: modal, lista, marcar e desmarcar, Adicionar pelos filtros, abertura do Checkout com o conjunto final, aviso do rosto maior, recusas, câmera ocupada, chave desligada.
- `testes/procurar-sem-vazar.js`: ganhou a parte da selfie (DOM e estado do Checkout, canal, `localStorage`, `sessionStorage`, SIM e câmera).

### Decisões da fase 2

- A marcação vai ao servidor quando a venda abre (não antes do envio): assim fica gravado o conjunto que realmente abriu, e uma recusa do Checkout não gasta a marcação.
- "Certeza" exige que o rosto seja dos principais da foto. Quem só passa ao fundo de uma foto, mesmo com nota alta, fica em "Pode ser" e chega desmarcado.
- Foto que é base de IA não conta para achar a sessão nesta busca.
- A nota não sai do servidor: a resposta leva o nível em palavras.

## O que ficou para depois

- Fase 3 (o que abre nas sessões achadas por selfie).
- Calibrar o piso do "pode ser" com dado real antes de ligar.
- Tela para o Admin ver o resumo das buscas por pessoa (o dado já sai em `GET /ponto/selfies`).
- Testar no Windows do posto a câmera do modal com o Checkout aberto no mesmo computador.
- A Venda manual não leva `origem` (a venda aberta por ela, sem o Checkout, entra em `sem_origem`).
- As sessões do dia continuam no SIM de todo navegador do ponto, como antes desta entrega. O que esta entrega garante é que a lista e a marcação do vendedor não são gravadas em lugar nenhum.
