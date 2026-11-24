# Treino da IA mais claro (24/11/2026)

Branch `feat/alertas-fotografo`, sobre `e3407bd` (v99.38.0, ainda não publicada). Prazo: programado, revisado, testado e aprovado pela segurança até umas 21h; publica às 22h30 junto com a v99.38.
Pedido do Eduardo em 24/11, às 10:00 ("tela muito confusa") e às 10:08 (pergunta do recorte de IA). Ele aprovou: "Pode fazer todas as sugestões".

## Objetivo

Na tela Curadoria › Treino da IA, cada marcação vira uma pergunta direta, a aba de números passa a se chamar Resultado e o liga e desliga sai dessa tela.
O controle vai para Configurações, com duas posições e nomes que dizem o que acontece na operação.

## Escopo desta entrega

1. Aba Marcar com três perguntas: "1. Onde a foto foi tirada?", "2. Esta foto pode ir para o cliente?" e, só quando a resposta da 1 é Gramado, "3. Serve para recorte de IA?" (Sim ou Não, com os motivos do Não).
2. A aba "Medição" passa a se chamar "Resultado", nas 5 línguas e em todos os textos que citam a aba.
3. O quadro "Análise automática do servidor" sai do Treino e vai para Configurações › Preços e Checkout › aba Fundos de IA, com duas linhas de duas posições: "Fundos de IA automáticos" e "Alerta de foto escura ou estourada".
4. O "Ligar mesmo assim" e o "Ligar de novo com as marcações de agora" vão para o mesmo quadro em Configurações. O Resultado passa a só mostrar números.
5. Aviso no topo do Treino e no quadro de Configurações quando os Fundos de IA automáticos estiverem desligados.

## Fora do escopo (depois)

- Qualquer mudança no agente (`agente/eterna-agente.py`). Nenhuma rota, regra, padrão ou validação muda hoje.
- Trocar o padrão do servidor novo de `desligada` para `medir` (`TREINO_CFG_PADRAO`). Ver Decisão D3.
- Usar a resposta "Serve para recorte de IA?" na escolha automática das bases (`_sess_ia_bases`, `base_rec_ok`). Hoje a resposta só fica guardada para ensinar. Ver "Depois" no fim.
- Mostrar no Resultado alguma conta do recorte (quantas marcadas Sim ou Não, acerto do servidor contra elas).
- A pergunta `frente` (todos olhando para a câmera).
- Alerta na tela Alertas quando os Fundos de IA automáticos estiverem desligados.
- O texto "Versão ligada" que sai do cartão a 390 px (pendência conhecida da v99.37, `.tr-med-ver`).
- Juntar a caixa "Separar os primeiros cliques de cada sessão" (`config/ia.ligada`) com o novo interruptor. Hoje os dois precisam estar ligados; nesta entrega só avisamos (D7).

## Decisões assumidas

**D1. Duas posições na tela, três no servidor.** Ligado na tela = `ligada` no servidor. Desligado na tela = `medir` no servidor. A tela nunca manda `desligada`.
Conferido no agente que `medir` não mexe na operação:
- Checkout e montagens: `_sess_ia_regra` só dá bases com `ponto == "ligada"`; em `medir` devolve `cena_medir`, nenhuma base, nenhum fundo de IA (o mesmo efeito do `desligada`). `cena_chegou` só age em `ligada`. As poses só usam o ponto (`set_diverge`) com ele `ligada`.
- Alertas: `fot_alertas` só cria `fot_luz` com `expo == "ligada"`. Em `medir` a aba Fotógrafos mostra a luz com o selo "Em teste", sem alerta. Isso continua.
- Custo: em `medir` o processo de cena roda (CPU ou GPU) e a luz é medida de madrugada. Já é assim hoje no estádio.

**D2. O `desligada` continua existindo só no servidor.** A rota aceita e o padrão de instalação nova continua `desligada`. Na tela ele aparece como a pílula "Parado no servidor", sem nenhum dos dois botões marcado, com a nota "O Resultado fica sem números. Escolha Ligado ou Desligado". Tocar em Desligado manda `medir`.

**D3. Servidor novo.** Num venue novo o padrão `desligada` deixa o Resultado sem números até alguém tocar em Desligado ou Ligado. Hoje isso fica coberto pelo D2. Depois, mudar o padrão do agente para `medir`.

**D4. Lugar do controle: Configurações › Preços e Checkout › aba Fundos de IA**, num quadro novo "Análise automática das fotos", acima do quadro "Fotos para os fundos de IA" (`iaCfgPanel`).
Motivos:
- a aba já pede `configuracao.r`, a mesma permissão do controle;
- o `iaCfgPanel` já fala do reconhecimento e precisa estar ao lado (os dois precisam estar ligados para haver fundo de IA);
- é um lugar só, com uma função só e um teste só.
O Ajuste automático não serve: é do módulo `set`, o fotógrafo vê e a tela é de sessões.
O ponto fraco: a linha do alerta de exposição fica numa aba chamada Fundos de IA. **Ponto para o Eduardo** (ver o fim). Mudar de lugar depois é trocar uma chamada.

**D5. Ligar os Fundos de IA automáticos sempre funciona para quem tem `configuracao.u`.**
- Critério passou (`/status.treino.modelo_ponto.criterio_passa`, recalculado pelo servidor a cada 60 s): `POST {ponto:"ligada"}` sem confirmação.
- Critério não passou: a confirmação de hoje (`tr_med_forcar_conf`, mesmo texto) e depois `POST {ponto:"ligada", forcar:true}`, pelo `trForcar` de hoje.
- Se o servidor responder 409 `criterio` no caminho normal (o `/status` estava atrasado), a tela grava `criterio_passa=false` na memória e diz "toque em Ligado de novo para ligar mesmo assim".
- Ligado: aparece "Ligar de novo com as marcações de agora" (`tr-forcar`, o religar de hoje). Se nada mudou, o servidor responde `igual` e a tela mostra "Nada mudou".

**D6. Desligar os Fundos de IA automáticos pede confirmação** (regra do Eduardo de 23/11: deve ficar sempre ligado). Texto: `tr_cfg_desl_conf`.
Com ele desligado aparecem:
- no quadro de Configurações, a pílula vermelha "Desligado: o Checkout está sem fundos de IA";
- no topo do Treino da IA, para todos que veem a tela, uma linha de aviso com o botão "Abrir em Configurações" (botão só para quem pode abrir a tela).
O alerta de exposição desliga sem confirmação e não tem aviso.

**D7. Caixa "Separar os primeiros cliques".** Com a Escala desligada, o fundo de IA só sai com `config/ia.ligada` e o ponto `ligada`. Se o ponto estiver Ligado e a caixa desmarcada, o quadro novo mostra `tr_cfg_ia_caixa`. O texto `cf_ia_sem_escala` passa a apontar para o quadro novo.

**D8. Alerta de exposição.** O botão Ligado não fica travado: a medida da luz (`/fotografos/luz/medida`) não é carregada em Configurações. O servidor confere o `LUZ_CRIT` e responde 409 `criterio` com `falta`. A tela mostra a lista no próprio quadro (`trLuzFaltaTxt`) e o aviso `tr_an_expo_sem`.

**D9. Permissões do quadro novo.**
- Vê: quem tem `configuracao.r` e chega à tela Preços e Checkout (Admin, Supervisora).
- Muda: `configuracao.u`.
- Sem `u`: só as pílulas (Ligado, Desligado, Parado no servidor), sem botão.
- No "ver como" (`state.assumido`): só pílulas, e as funções recusam com `vc_so_ver` (guardAct, mais a checagem dentro da função; o servidor também recusa).
- Sem servidor (`!trAg()`): o quadro mostra `tr_sem_servidor`. Agente antigo, sem `treino.analise` no `/status`: mostra `tr_an_sem`.

**D10. Ids internos não mudam.** A aba segue `data-a="medida"` e `state.train.aba='medida'`. A ação `tr-analise` sai; entra `tr-cfg`. `tr-forcar` fica. Muda só o que se lê na tela. Isso evita mexer em `todas-as-telas.js` e em quem abre a aba por código.

**D11. "3. Serve para recorte de IA?"**
- Só aparece com o rascunho em `ponto === 'gramado'`. Sim / Não (`data-act="tr-ia"`, `data-v="sim|nao"`). Com Não, aparecem os motivos (`data-act="tr-iam"`, `data-m`).
- Tocar num motivo marca Não sozinho, como o `tr-r` faz com "Não pode".
- Motivos (slugs dentro da regra do agente `^[a-z][a-z0-9_]{0,23}$`, até 8): `cortada` (Pessoa cortada na borda), `chao` (Corpo inteiro com chão), `luz` (Luz ruim para recorte), `gente_atras` (Gente atrás), `outro` (Outro).
- O agente aceita qualquer slug em `ia.motivos` (`_treino_lista(..., None, 8)`): nenhuma mudança no servidor.
- Teclas: **S** = Sim, **X** = Não. Não batem com G A T C O P N D Z, 1 a 9, Enter e setas. Os motivos do recorte não têm tecla: os números já são dos motivos do "Não pode".
- `frente` fica de fora: a tela não mostra. O valor já gravado é repetido com o ponto Gramado e vai `null` fora dele.
- **Troca de ponto.** Saindo de Gramado, o rascunho guarda Sim/Não e motivos na memória (se voltar para Gramado, eles voltam), mas o corpo enviado leva `ia: {serve:null, motivos:[], frente:null}`. Ponto vazio também leva nulo.
- Com Sim, os motivos são apagados.
- Responder a 3 não é obrigatório. O Enter grava com ela em branco (`serve:null`).

## Áreas do `index.html` que este plano toca (para não bater com o plano "Zerar fase de teste")

| Área | Linha aproximada | Choque com o outro plano |
| --- | --- | --- |
| CSS `.tr-*` | 1384-1400 | não |
| `VIEWS` (subtítulo do treino) | 1743 | não |
| `catFundos` | 7359-7363 | não |
| `iaCfgPanel` (só a chave de texto) | 7541-7548 | não |
| Bloco do Treino: `TR_PONTOS`, `trRasc`, `trCorpo`, `trRascNovo`, `trDesfazer`, `trCfgPost`, `trAnalise`, `trForcar`, `vTreinoMedida`, `trLuzMedida`, `trAnaliseHtml`, `vTreinoMarcar`, `vTreino` | 7717-8016 | não |
| `EQ`: `cf_ia_sem_escala` | 9304 | não |
| `EQ`: `tr_*` | 9777-9990 | não |
| `EQ`: `pm_a_treino_analise` | 9991 | não |
| `EQ`: `tr_luz_*` | 10822 | não |
| `EQ`: `vd_treino` | 11536 | não |
| `WRITE_OPS` e `ACT_MOD` | 11624 e 11626 | **sim**: o outro plano põe `zerar-*` na mesma linha. Quem programar depois acrescenta no fim do objeto, sem reescrever a linha. |
| `switch` de cliques: casos `tr-*` | 12834-12855 | o outro plano acrescenta casos em outro ponto |
| teclado do treino | 13128-13133 | não |

O outro plano cita "Treino › Medição" no passo 4 de conferência. Com esta entrega o nome passa a ser "Treino › Resultado". Avisar quem escreve aquele plano; não mexer nele daqui.

## Mudanças por arquivo

### `index.html`

**Estado e marcação**
- `trRasc(pid)`: o rascunho ganha `serve` (`d.ia.serve`, ou `null`) e `iaMot` (cópia de `d.ia.motivos`, ou `[]`).
- `trCorpo(pid,r)`, campo `ia`:
  - com `r.ponto==='gramado'`: `{serve: r.serve==null ? null : !!r.serve, motivos: r.serve===false ? r.iaMot.slice(0,8) : [], frente: d.ia&&d.ia.frente!=null ? !!d.ia.frente : null}`;
  - senão: `{serve:null, motivos:[], frente:null}`.
- `trRascNovo(pid)`: o `igual` passa a comparar também `c.ia.serve` com o `ia.serve` gravado e os motivos ordenados (`ia.motivos`). **Sem isso, mudar só a resposta 3 não grava.**
- `trDesfazer()`: o objeto `r` ganha `serve` e `iaMot` vindos de `a.ia`.
- `trVazio` já conta `ia`: não muda.

**Aba Marcar (`vTreinoMarcar`)**
- Antes do grupo `pontos`: `eyebrow` com `tr_ponto_h` e `note` com `tr_ponto_nota`.
- Antes do grupo `qual`: `eyebrow` com `tr_qual_h` e `note` com `tr_qual_nota`.
- Depois do `qual`, só com `r.ponto==='gramado'`:
  - `eyebrow` `tr_ia_h` e `note` `tr_ia_nota`;
  - `<div class="tr-pontos" role="group" aria-label="tr_ia_h">` com dois `.btn.tr-big`, `data-act="tr-ia"` `data-v="sim"`/`"nao"`, rótulo e tecla (S) e (X), `aria-pressed` por `r.serve`, `disabled` sem `pode`;
  - com `r.serve===false`: `eyebrow` `tr_ia_porque` e os chips de `TR_IA_MOTIVOS` (`data-act="tr-iam"`, `data-m`, `aria-pressed`).
- Nova constante `TR_IA_MOTIVOS=['cortada','chao','luz','gente_atras','outro']`, com rótulos `tr_ia_m_<slug>`.

**Cliques (switch)**
- `case 'tr-ia'`: atual `p`, `r=trRasc(p.pid)`, `v = d.v==='sim'`. Se `r.serve===v`, vira `null`; senão vira `v`. Com `true`, `r.iaMot=[]`. Depois `render()`. Só faz algo com `r.ponto==='gramado'`.
- `case 'tr-iam'`: só com slug em `TR_IA_MOTIVOS` e ponto Gramado. `r.serve=false` e liga ou desliga o slug em `r.iaMot`. Depois `render()`.
- Nenhuma das duas entra em `WRITE_OPS`, como `tr-ponto` e `tr-q`: mudam só o rascunho, e a gravação passa pelo `trGravar`, que já recusa no "ver como".

**Teclado** (bloco do treino): `k==='s'` chama `clica('tr-ia','[data-v="sim"]')`; `k==='x'` chama `clica('tr-ia','[data-v="nao"]')`. O `clica` já ignora botão ausente ou travado, então fora de Gramado nada acontece.

**Topo do Treino (`vTreino`)**
- Tira `${trAnaliseHtml()}`.
- No lugar entra `${trAvisoDesl()}`: devolve `''` sem `state.agent.treino.analise` ou com `ponto==='ligada'`. Senão, `<div class="note tr-aviso-desl" role="status">` com a pílula `bad` `tr_aviso_desl` e, se `canView('catalogo')&&can('configuracao','r')`, o botão `data-act="tr-cfg-abrir"` com `tr_cfg_abrir`.
- A nota do cabeçalho (`tr_pode_nao`) ganha o texto novo.

**`case 'tr-cfg-abrir'`** (não grava): `state.catTab='fundos'; go('catalogo')`, depois rola até `#tr-cfg` (`scrollIntoView` num `setTimeout 0`).

**Resultado (`vTreinoMedida`)**
- Pílula da situação: `trCfgPilula(an)`, que devolve "Ligado" (`good`), "Desligado" (`neutral`) ou "Parado no servidor" (`warn`), conforme `ligada`, `medir` ou `desligada`. Usar também na cabeça do `trLuzMedida`.
- No `crit`, sai o `forca` (botão e `forcarAviso`). No lugar, uma `note` com `TE('tr_res_onde', TE('g_configuracoes'), viewLabel('catalogo'), TE('cf_fundos'))` e o botão `tr-cfg-abrir` (mesma regra de quem vê).
- Selo "Ligado abaixo da meta", "Modelo não instalado" e "Ligado com 0 fotos" ficam: são situação, não comando.

**Quadro novo `trCfgPanel()`** (substitui `trAnaliseHtml`, que é apagada)
- Devolve `''` sem `can('configuracao','r')`.
- `<div class="panel tr-an" id="tr-cfg">` com o título `tr_an_h` e a nota `tr_an_nota`.
- Sem `trAg()`: nota `tr_sem_servidor`. Sem `analise` no `/status`: nota `tr_an_sem`.
- `pode = can('configuracao','u') && !state.assumido && !!trAg()`.
- `linha(k)`, com `k` em `ponto` e `exposicao`:
  - nome (`tr_an_ponto` ou `tr_an_exposicao`) e nota da linha (`tr_cfg_ponto_nota` ou `tr_cfg_expo_nota`);
  - com `pode`: `<span class="seg" role="group">` com dois `button.chip`, `data-act="tr-cfg"`, `data-k`, `data-v="on|off"`, rótulos `tr_cfg_on` e `tr_cfg_off`. `aria-pressed` de on = `v==='ligada'`; de off = `v==='medir'`; com `desligada`, nenhum dos dois marcado. Os dois travam enquanto houver pedido em voo (`state.train.med.forcando` ou o novo `state.train.cfgVoo`);
  - sem `pode`: só `trCfgPilula(v)`;
  - `desligada`: pílula `tr_cfg_parado` e nota `tr_cfg_parado_nota`.
- Só na linha do ponto:
  - desligado: pílula `bad` `tr_cfg_ponto_off`;
  - desligado, com `pode` e `!mp.criterio_passa`: nota `tr_cfg_abaixo_nota`;
  - ligado: selo `tr-med-abaixo` (o mesmo de hoje, `tr_med_abaixo` e `tr_med_abaixo_nota`), `tr-med-sem-modelo` e `tr-med-zero` com as mesmas regras do `vTreinoMedida`;
  - ligado com `pode`: botão `data-act="tr-forcar"` (`tr_med_religar_forcar`, `btn`, travado com `m.forcando`) e a nota `tr_med_forcar_nota`;
  - ligado com `iaCfg().ligada===false`: nota `tr_cfg_ia_caixa`;
  - `state.train.med.forcarAviso`: a lista de hoje, tirada para uma função comum `trForcarAvisoHtml()` (texto puro, `esc`).
- Só na linha da exposição: `state.train.cfgFalta` (`{k:'exposicao', itens:[texto]}`) vira a lista `.tr-med-faltas` com `esc`.

**`trCfgMuda(k,on)`** (novo, ação `tr-cfg`)
- Recusa com `state.assumido` (toast `vc_so_ver`), sem `can('configuracao','u')`, com `k` fora de `ponto`/`exposicao` ou com pedido em voo.
- `de` = valor no `/status`.
- `on`:
  - já `ligada`: nada;
  - `k==='ponto'` e `mp.criterio_passa`: `trAnalise('ponto','ligada')`;
  - `k==='ponto'` sem critério: `trForcar()`, que já confirma;
  - `k==='exposicao'`: `trAnalise('exposicao','ligada')`.
- `off`:
  - já `medir`: nada;
  - `k==='ponto'` e `de==='ligada'`: `confirm(TE('tr_cfg_desl_conf'))`, e só com OK segue;
  - depois `trAnalise(k,'medir')`.

**`trAnalise(k,v)`** (ajustes)
- Checa `state.assumido`.
- Põe `state.train.cfgVoo=true` durante o pedido.
- O 409 `criterio` **não troca mais de aba nem de tela**:
  - ponto: `modelo_ponto.criterio_passa=false` e toast `tr_an_criterio`;
  - exposição: `state.train.cfgFalta={k, itens:(j.falta||[]).slice(0,20).map(trLuzFaltaTxt)}` e toast `tr_an_expo_sem`.
- No sucesso limpa `cfgFalta`.
- O `auditLog('treino_analise', ...)` segue com os valores do servidor (`medir`/`ligada`) em `de`/`para`.

**`trForcar()`**
- Checa `state.assumido`.
- O resto fica igual. O toast do 409 passa a ser o novo `tr_med_forcar_nao`, porque a lista agora aparece no quadro de Configurações.

**`WRITE_OPS` e `ACT_MOD`**
- Entra `'tr-cfg':'u'` e `'tr-cfg':'configuracao'`.
- Sai `tr-analise` (não existe mais botão).
- `tr-forcar` fica como está.
- `case 'tr-analise'` sai do switch; entra `case 'tr-cfg': trCfgMuda(d.k, d.v==='on')`.

**`catFundos()`**: `${trCfgPanel()}${iaCfgPanel()}` no fim, nessa ordem.

**`TR_ANALISE`** continua (validação do `trAnalise`).

**CSS**
- Reaproveitar `.tr-an`, `.tr-an-l`, `.tr-an-k` e `.seg`.
- A 390 px, `.tr-an-k{min-width:0;flex:1 1 100%}` dentro de `@media (max-width:700px)`, para a linha não passar da largura.
- `.tr-aviso-desl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}`.
- Nada de largura fixa nova.

**Chaves que saem do `EQ`** (depois de conferir com `grep` que ninguém mais usa): `tr_an_o_que`, `tr_an_medir`, `tr_an_desligada`, `tr_an_ligada`, `tr_med_forcar`.

### `testes/`

- **`testes/treino.js`**
  - linhas 46-51: o Treino não tem `.tr-an` nem `[data-act="tr-analise"]`;
  - o interruptor agora é testado em `#tr-cfg` de `catalogo`/`fundos`: off da exposição manda `{exposicao:'medir'}` com `auditLog`;
  - 369: a Supervisora vê o `#tr-cfg` com 4 botões;
  - 374-376: o Validador não vê botão e um `tr-cfg` injetado não chega ao servidor;
  - a descrição da aba passa a ser "Resultado".
- **`testes/treino-medida.js`**
  - 64: nome da aba;
  - 66-68: sem travamento; trocar por "Ligado com o critério não passando abre a confirmação";
  - 90-94: o 409 fica em Configurações e não troca de aba;
  - 95-140: os cliques do "Ligar mesmo assim" passam a ser `#tr-cfg [data-act="tr-cfg"][data-k="ponto"][data-v="on"]` (a confirmação e o texto são os mesmos), e `tr-forcar`, o selo e o aviso do 409 são procurados dentro de `#tr-cfg`;
  - 110: toast `O que falta está logo abaixo`;
  - 145: incluir `tr_cfg_`, `tr_ia_`, `tr_ponto_nota`, `tr_qual_nota`, `tr_aviso_desl`, `tr_res_onde` na lista das 5 línguas.
- **`testes/fot-alertas.js`**
  - 106: a exposição Ligada do `/status` aparece marcada em `#tr-cfg`;
  - 121-125: incluir `['catalogo','fundos']` no laço das 5 línguas;
  - o padrão procurado inclui `tr_cfg`.
- **Novo `testes/treino-claro.js`** (Playwright, agente falso por `page.route` como no `treino-medida.js`, em 390×844 e 1280×900). Cobre os critérios abaixo, os casos `ver como` e sem servidor. Entra no `testes/rodar.sh`.
- `todas-as-telas.js` e os testes Python do agente não mudam (D10, nada no agente). Rodar `treino_agente.py` e `cena_agente.py` mesmo assim, como conferência.

### Documentação (documentador, depois dos testes)

- `docs/GUIA-DA-EQUIPE.md`: linhas 1297-1327 ("Ordem para ligar", "Selos da Medição") e 1385-1388 (exposição), mais a seção "Novidades da v99.38".
- `docs/CONTEXTO-ETERNA.md`: itens das linhas 65, 107, 108, 113 e 153 (nomes Medição, Só medir e lugar do interruptor).
- `docs/DOCUMENTACAO-TECNICA.md`, seção v99.38.
- `VERSOES.md`.

## Contratos

Nenhum endpoint novo. Usa os de hoje:
- `POST /treino/config` com `{ponto:"ligada"}`, `{ponto:"ligada", forcar:true}`, `{ponto:"medir"}`, `{exposicao:"ligada"}` ou `{exposicao:"medir"}`. Respostas iguais às de hoje: 200 `{ok, analise, ..., igual?}`, 409 `{error:"criterio"|"rotulos", falta:[...]}`, 403 e 429.
- `GET /status` → `treino.analise.{ponto, exposicao}` e `treino.modelo_ponto.{criterio_passa, abaixo, congelados, erro, aviso, versao, ligada_versao}`.
- `POST /treino/rotulo`, corpo de sempre. O campo `ia` passa a ser preenchido:
```json
{"pid":"…","v":1,"ponto":"gramado","ia":{"serve":false,"motivos":["cortada","gente_atras"],"frente":null},
 "qual":{"nivel":"boa","motivos":[],"ajuste":[]},"duvida":false,"obs":"","base_em":null}
```
Fora de Gramado: `"ia":{"serve":null,"motivos":[],"frente":null}`.

### Chaves do `EQ` (pt | en | es | fr | de)

Mudam de texto:
- `tr_ponto_h`: 1. Onde a foto foi tirada? | 1. Where was the photo taken? | 1. ¿Dónde se tomó la foto? | 1. Où la photo a-t-elle été prise ? | 1. Wo wurde das Foto aufgenommen?
- `tr_qual_h`: 2. Esta foto pode ir para o cliente? | 2. Can this photo go to the customer? | 2. ¿Esta foto puede ir al cliente? | 2. Cette photo peut-elle aller au client ? | 2. Kann dieses Foto zum Kunden?
- `tr_aba_medida`: Resultado | Results | Resultado | Résultat | Ergebnis
- `tr_pode_nao`: Marque as fotos para ensinar o servidor. Na aba Resultado você vê quanto ele acerta. | Label photos to teach the server. The Results tab shows how often it is right. | Marque las fotos para enseñar al servidor. En la pestaña Resultado ve cuánto acierta. | Étiquetez les photos pour entraîner le serveur. L'onglet Résultat montre à quel point il a raison. | Markieren Sie Fotos, um den Server anzulernen. Im Tab Ergebnis sehen Sie, wie oft er richtig liegt.
- `vd_treino` (e o 3º campo de `VIEWS` para `treino`): ensinar e conferir | teach and check | enseñar y revisar | entraîner et vérifier | anlernen und prüfen
- `tr_med_h`: Fundos de IA automáticos: quanto o servidor acerta | Automatic AI backgrounds: how often the server is right | Fondos de IA automáticos: cuánto acierta el servidor | Fonds IA automatiques : à quel point le serveur a raison | Automatische KI-Hintergründe: wie oft der Server richtig liegt
- `tr_med_criterio_ok`: Chegou à meta. Os Fundos de IA automáticos podem ser ligados em Configurações. | Goal reached. Automatic AI backgrounds can be switched on in Settings. | Llegó a la meta. Los Fondos de IA automáticos se pueden activar en Configuración. | Objectif atteint. Les fonds IA automatiques peuvent être activés dans Paramètres. | Ziel erreicht. Automatische KI-Hintergründe lassen sich in den Einstellungen einschalten.
- `tr_med_criterio_falta`: Ainda falta para chegar à meta: | Still missing to reach the goal: | Aún falta para llegar a la meta: | Il manque encore pour atteindre l'objectif : | Bis zum Ziel fehlt noch:
- `tr_med_forcar_nao`: Não ligou. O que falta está logo abaixo. | Not switched on. What is missing is listed below. | No se activó. Lo que falta está abajo. | Non activé. Ce qui manque est indiqué ci-dessous. | Nicht eingeschaltet. Was fehlt, steht darunter.
- `tr_med_forcar_nota`: Abaixo da meta, quem pode mudar a Configuração liga mesmo assim. Fica registrado quem ligou, quando e o acerto naquele momento. | Below the goal, anyone who can change Settings may still switch on. Who, when and the accuracy at that moment are recorded. | Por debajo de la meta, quien puede cambiar la Configuración activa igual. Queda registrado quién, cuándo y el acierto en ese momento. | Sous l'objectif, une personne pouvant modifier la Configuration peut quand même activer. Qui, quand et la précision à ce moment sont enregistrés. | Unter dem Ziel darf trotzdem einschalten, wer die Konfiguration ändern kann. Wer, wann und die Trefferquote in dem Moment werden gespeichert.
- `tr_med_abaixo_nota`: Marcações novas só valem depois de tocar em Ligar de novo com as marcações de agora, em Configurações. | New labels only count after tapping Switch on again with the current labels, in Settings. | Las marcas nuevas solo cuentan después de tocar Activar de nuevo con las marcas de ahora, en Configuración. | Les nouvelles étiquettes ne comptent qu'après Réactiver avec les étiquettes actuelles, dans Paramètres. | Neue Markierungen zählen erst nach Mit den aktuellen Markierungen neu einschalten, in den Einstellungen.
- `tr_an_criterio`: O servidor diz que o acerto ainda está abaixo da meta. Toque em Ligado de novo para ligar mesmo assim. | The server says accuracy is still below the goal. Tap On again to switch on anyway. | El servidor dice que el acierto sigue por debajo de la meta. Toque Activado de nuevo para activar de todos modos. | Le serveur indique que la précision est encore sous l'objectif. Touchez Activé à nouveau pour activer quand même. | Laut Server liegt die Trefferquote noch unter dem Ziel. Noch einmal auf An tippen, um trotzdem einzuschalten.
- `tr_an_expo_sem`: O alerta só liga quando o servidor acerta o bastante. O que falta está logo abaixo e em Curadoria › Treino da IA › Resultado › Exposição. | The alert only switches on once the server is accurate enough. What is missing is below and in Curation › AI training › Results › Exposure. | La alerta solo se activa cuando el servidor acierta lo suficiente. Lo que falta está abajo y en Curaduría › Entrenamiento de la IA › Resultado › Exposición. | L'alerte ne s'active que lorsque le serveur est assez précis. Ce qui manque est ci-dessous et dans Curation › Entraînement de l'IA › Résultat › Exposition. | Der Alarm lässt sich erst einschalten, wenn der Server genau genug ist. Was fehlt, steht darunter und unter Kuratierung › KI-Training › Ergebnis › Belichtung.
- `tr_an_h`: Análise automática das fotos | Automatic photo analysis | Análisis automático de las fotos | Analyse automatique des photos | Automatische Fotoanalyse
- `tr_an_nota`: Desligado, o servidor continua analisando em silêncio para o Resultado ter números. Isso não muda nada no Checkout nem nos Alertas. | When Off, the server keeps analysing quietly so Results has numbers. Nothing changes in the Checkout or in Alerts. | Apagado, el servidor sigue analizando en silencio para que Resultado tenga números. No cambia nada en el Checkout ni en las Alertas. | Désactivé, le serveur continue d'analyser sans rien afficher pour que Résultat ait des chiffres. Rien ne change dans le Checkout ni dans les Alertes. | Bei Aus analysiert der Server still weiter, damit Ergebnis Zahlen hat. Im Checkout und bei den Alarmen ändert sich nichts.
- `tr_an_ponto`: Fundos de IA automáticos | Automatic AI backgrounds | Fondos de IA automáticos | Fonds IA automatiques | Automatische KI-Hintergründe
- `tr_an_exposicao`: Alerta de foto escura ou estourada | Dark or overexposed photo alert | Alerta de foto oscura o quemada | Alerte photo sombre ou surexposée | Alarm bei dunklem oder überbelichtetem Foto
- `tr_analise_ok`: Salvo no servidor | Saved on the server | Guardado en el servidor | Enregistré sur le serveur | Auf dem Server gespeichert
- `tr_analise_erro`: Não deu para salvar no servidor. Confira a conexão e tente de novo. | Could not save on the server. Check the connection and try again. | No se pudo guardar en el servidor. Revise la conexión e intente de nuevo. | Impossible d'enregistrer sur le serveur. Vérifiez la connexion et réessayez. | Speichern auf dem Server fehlgeschlagen. Verbindung prüfen und erneut versuchen.
- `pm_a_treino_analise`: mudou a análise automática das fotos | changed the automatic photo analysis | cambió el análisis automático de las fotos | a modifié l'analyse automatique des photos | hat die automatische Fotoanalyse geändert
- `cf_ia_sem_escala`: As fotos para os fundos de IA são escolhidas pela imagem. Isso só funciona com esta caixa marcada e com Fundos de IA automáticos em Ligado, no quadro acima. | Photos for AI backgrounds are chosen from the image. This only works with this box ticked and Automatic AI backgrounds On, in the panel above. | Las fotos para los fondos de IA se eligen por la imagen. Solo funciona con esta casilla marcada y con Fondos de IA automáticos en Activado, en el cuadro de arriba. | Les photos des fonds IA sont choisies à partir de l'image. Cela ne marche qu'avec cette case cochée et Fonds IA automatiques sur Activé, dans le cadre au-dessus. | Die Fotos für KI-Hintergründe werden anhand des Bildes gewählt. Das funktioniert nur mit diesem Häkchen und mit Automatische KI-Hintergründe auf An, im Feld darüber.
- `tr_teclas`: acrescentar antes de "Enter", em cada língua: "S serve para recorte · X não serve · " | "S good for cutout · X not for cutout · " | "S sirve para recorte · X no sirve · " | "S utilisable pour détourage · X non · " | "S taugt als Freisteller · X taugt nicht · ". No pt, "G A T C O escolhem o ponto" vira "G A T C O escolhem onde foi tirada".

Novas:
- `tr_ponto_nota`: Só as fotos do Gramado podem virar fundo de IA. Os outros pontos ensinam o servidor a reconhecer o que não é gramado. | Only Pitch photos can become AI backgrounds. The other spots teach the server what is not the pitch. | Solo las fotos del Césped pueden convertirse en fondo de IA. Los otros puntos le enseñan al servidor lo que no es césped. | Seules les photos de la Pelouse peuvent devenir un fond IA. Les autres points apprennent au serveur ce qui n'est pas la pelouse. | Nur Rasenfotos können zu KI-Hintergründen werden. Die anderen Spots zeigen dem Server, was nicht Rasen ist.
- `tr_qual_nota`: Vale para a foto como ela é: foco, luz, olhos, enquadramento. Não muda nada nos fundos de IA. | About the photo itself: focus, light, eyes, framing. It changes nothing in the AI backgrounds. | Se trata de la foto en sí: foco, luz, ojos, encuadre. No cambia nada en los fondos de IA. | Concerne la photo elle-même : netteté, lumière, yeux, cadrage. Cela ne change rien aux fonds IA. | Es geht um das Foto selbst: Schärfe, Licht, Augen, Bildausschnitt. An den KI-Hintergründen ändert das nichts.
- `tr_ia_h`: 3. Serve para recorte de IA? | 3. Good for an AI cutout? | 3. ¿Sirve para recorte de IA? | 3. Utilisable pour un détourage IA ? | 3. Taugt es als KI-Freisteller?
- `tr_ia_nota`: Só aparece no Gramado. Uma foto pode ser boa para o cliente e não servir para recorte. | Only shows for the Pitch. A photo can be fine for the customer and still not work as a cutout. | Solo aparece en Césped. Una foto puede servir al cliente y no servir para recorte. | N'apparaît que pour la Pelouse. Une photo peut convenir au client sans convenir au détourage. | Erscheint nur beim Rasen. Ein Foto kann für den Kunden gut sein und trotzdem nicht als Freisteller taugen.
- `tr_ia_sim`: Sim | Yes | Sí | Oui | Ja
- `tr_ia_nao`: Não | No | No | Non | Nein
- `tr_ia_porque`: Por que não serve? (pode marcar mais de um) | Why not? (you can pick more than one) | ¿Por qué no sirve? (puede marcar más de uno) | Pourquoi ? (plusieurs choix possibles) | Warum nicht? (Mehrfachauswahl möglich)
- `tr_ia_m_cortada`: Pessoa cortada na borda | Person cut off at the edge | Persona cortada en el borde | Personne coupée au bord | Person am Rand abgeschnitten
- `tr_ia_m_chao`: Corpo inteiro com chão | Full body with the ground | Cuerpo entero con suelo | Corps entier avec le sol | Ganzer Körper mit Boden
- `tr_ia_m_luz`: Luz ruim para recorte | Light bad for a cutout | Luz mala para recorte | Lumière mauvaise pour le détourage | Licht schlecht zum Freistellen
- `tr_ia_m_gente_atras`: Gente atrás | People behind | Gente detrás | Du monde derrière | Leute im Hintergrund
- `tr_ia_m_outro`: Outro | Other | Otro | Autre | Anderes
- `tr_cfg_on`: Ligado | On | Activado | Activé | An
- `tr_cfg_off`: Desligado | Off | Apagado | Désactivé | Aus
- `tr_cfg_parado`: Parado no servidor | Stopped on the server | Detenido en el servidor | Arrêté sur le serveur | Auf dem Server gestoppt
- `tr_cfg_parado_nota`: O servidor não está analisando, então o Resultado fica sem números. Escolha Ligado ou Desligado. | The server is not analysing, so Results has no numbers. Choose On or Off. | El servidor no está analizando, así que Resultado queda sin números. Elija Activado o Apagado. | Le serveur n'analyse pas, donc Résultat n'a pas de chiffres. Choisissez Activé ou Désactivé. | Der Server analysiert nicht, daher hat Ergebnis keine Zahlen. An oder Aus wählen.
- `tr_cfg_ponto_nota`: Ligado: o servidor reconhece as fotos do gramado e o Checkout mostra os fundos de IA feitos com elas. | On: the server recognises pitch photos and the Checkout shows the AI backgrounds made from them. | Activado: el servidor reconoce las fotos del césped y el Checkout muestra los fondos de IA hechos con ellas. | Activé : le serveur reconnaît les photos de la pelouse et le Checkout affiche les fonds IA faits avec elles. | An: Der Server erkennt die Rasenfotos, und der Checkout zeigt die daraus erstellten KI-Hintergründe.
- `tr_cfg_expo_nota`: Ligado: os Alertas avisam quando um fotógrafo tem muitas fotos escuras ou estouradas. | On: Alerts flag when a photographer has many dark or overexposed photos. | Activado: las Alertas avisan cuando un fotógrafo tiene muchas fotos oscuras o quemadas. | Activé : les Alertes signalent quand un photographe a beaucoup de photos sombres ou surexposées. | An: Die Alarme melden, wenn ein Fotograf viele dunkle oder überbelichtete Fotos hat.
- `tr_cfg_ponto_off`: Desligado: o Checkout está sem fundos de IA. | Off: the Checkout has no AI backgrounds. | Apagado: el Checkout está sin fondos de IA. | Désactivé : le Checkout n'a pas de fonds IA. | Aus: Der Checkout hat keine KI-Hintergründe.
- `tr_cfg_abaixo_nota`: O acerto ainda não chegou à meta (veja em Curadoria › Treino da IA › Resultado). Ao ligar, o Eterna pede confirmação e registra quem ligou. | Accuracy has not reached the goal yet (see Curation › AI training › Results). Switching on asks for confirmation and records who did it. | El acierto todavía no llegó a la meta (vea Curaduría › Entrenamiento de la IA › Resultado). Al activar, el Eterna pide confirmación y registra quién lo hizo. | La précision n'a pas encore atteint l'objectif (voir Curation › Entraînement de l'IA › Résultat). À l'activation, Eterna demande confirmation et enregistre qui a activé. | Die Trefferquote hat das Ziel noch nicht erreicht (siehe Kuratierung › KI-Training › Ergebnis). Beim Einschalten fragt Eterna nach und speichert, wer eingeschaltet hat.
- `tr_cfg_desl_conf`: Desligar os Fundos de IA automáticos? Os próximos visitantes ficam sem fundos de IA no Checkout. Para ligar de novo, o servidor usa as marcações daquele momento. | Switch off automatic AI backgrounds? The next visitors get no AI backgrounds in the Checkout. Switching on again uses the labels of that moment. | ¿Apagar los Fondos de IA automáticos? Los próximos visitantes quedan sin fondos de IA en el Checkout. Al activar de nuevo, el servidor usa las marcas de ese momento. | Désactiver les fonds IA automatiques ? Les prochains visiteurs n'auront pas de fonds IA dans le Checkout. À la réactivation, le serveur utilise les étiquettes de ce moment. | Automatische KI-Hintergründe ausschalten? Die nächsten Besucher bekommen im Checkout keine KI-Hintergründe. Beim erneuten Einschalten nutzt der Server die Markierungen von diesem Moment.
- `tr_cfg_ia_caixa`: Os fundos de IA também precisam da caixa Separar os primeiros cliques de cada sessão, logo abaixo. Ela está desmarcada. | AI backgrounds also need the box Set aside the first shots of each session, just below. It is unticked. | Los fondos de IA también necesitan la casilla Separar los primeros disparos de cada sesión, justo abajo. Está desmarcada. | Les fonds IA ont aussi besoin de la case Mettre de côté les premières prises de chaque séance, juste en dessous. Elle est décochée. | KI-Hintergründe brauchen auch das Kästchen Die ersten Aufnahmen jeder Sitzung zurückhalten, direkt darunter. Es ist nicht angehakt.
- `tr_cfg_abrir`: Abrir em Configurações | Open in Settings | Abrir en Configuración | Ouvrir dans Paramètres | In den Einstellungen öffnen
- `tr_aviso_desl`: Fundos de IA automáticos desligados: o Checkout está sem fundos de IA. | Automatic AI backgrounds are off: the Checkout has no AI backgrounds. | Fondos de IA automáticos apagados: el Checkout está sin fondos de IA. | Fonds IA automatiques désactivés : le Checkout n'a pas de fonds IA. | Automatische KI-Hintergründe aus: Der Checkout hat keine KI-Hintergründe.
- `tr_res_onde` (função `(c,p,f)`): Aqui você só confere. Ligar e desligar fica em ${c} › ${p} › ${f}. | This tab is for checking only. Switching on and off is in ${c} › ${p} › ${f}. | Aquí solo se revisa. Activar y apagar está en ${c} › ${p} › ${f}. | Ici, on vérifie seulement. Activer et désactiver se fait dans ${c} › ${p} › ${f}. | Hier wird nur geprüft. Ein- und Ausschalten unter ${c} › ${p} › ${f}.

## Critérios de aceite

Valem em 1280×900 e em 390×844, salvo quando o critério diz outra coisa. O agente é falso, como no `treino-medida.js`.

1. Na aba Marcar, com uma foto carregada, aparecem os títulos "1. Onde a foto foi tirada?" e "2. Esta foto pode ir para o cliente?", cada um com a nota de uma linha (`tr_ponto_nota`, `tr_qual_nota`).
2. Sem ponto, ou com Arquibancada, Troféu, Chute a Gol ou Outro, não existe `[data-act="tr-ia"]` na página. Com Gramado (clique ou tecla G) aparecem "3. Serve para recorte de IA?" e os botões Sim e Não.
3. Não (clique ou X) mostra os 5 motivos. Tocar num motivo com Sim marcado passa para Não. Sim (clique ou S) esconde os motivos e zera a lista.
4. Gramado + Não + "Pessoa cortada na borda" + "Gente atrás" + Enter manda um `POST /treino/rotulo` com `ia = {serve:false, motivos:["cortada","gente_atras"], frente:null}` (ordem dos motivos livre).
5. Marcar Gramado + Sim, trocar para Arquibancada e confirmar manda `ia = {serve:null, motivos:[], frente:null}`. Voltar para Gramado antes de confirmar mostra Sim marcado de novo.
6. Numa foto já gravada, mudar só a resposta 3 e ir para a próxima (seta) grava. Abrir a foto sem mudar nada não grava.
7. Z desfaz uma marcação que tinha `ia`: o POST de desfazer leva o `ia` anterior.
8. As teclas S e X fora do Gramado não fazem nada e não dão erro. G A T C O P N D Z, 1 a 9 e Enter seguem como antes (o `treino.js` passa).
9. No "ver como", os botões da 3 ficam travados como os outros e nada é gravado nem posto na fila.
10. A aba que se chamava Medição mostra "Resultado" (pt), "Results", "Resultado", "Résultat", "Ergebnis". Nas 5 línguas, o texto do `#main` no Treino (Marcar e Resultado) e em Preços e Checkout › Fundos de IA não tem "Medição", "Measurement", "Medición", "Mesure", "Messung", "Só medir", "Measure only", "Reconhecer o ponto", "Medir a exposição", nem chave crua (`tr_`, `undefined`, `NaN`).
11. O Treino da IA não tem mais `.tr-an`, `[data-act="tr-analise"]` nem `[data-act="tr-forcar"]` (nenhuma aba).
12. O Resultado mostra a pílula "Ligado", "Desligado" ou "Parado no servidor" e a nota "Aqui você só confere. Ligar e desligar fica em Configurações › Preços e Checkout › Fundos de IA." Para o Admin aparece o botão "Abrir em Configurações", que abre `catalogo` na aba `fundos` com `#tr-cfg` visível.
13. Para o Admin, Configurações › Preços e Checkout › Fundos de IA tem `#tr-cfg` com "Fundos de IA automáticos" e "Alerta de foto escura ou estourada", cada um com Ligado e Desligado, acima de `#ia-cfg`.
14. Ligações entre botão e servidor: `ligada` → só Ligado marcado; `medir` → só Desligado marcado; `desligada` → nenhum marcado, mais a pílula "Parado no servidor" e a nota.
15. Exposição em `medir`, Ligado com o servidor aceitando: o POST é `{exposicao:"ligada"}` e o `auditLog` grava `treino_analise` com `analise.exposicao` de `medir` para `ligada`. Desligado manda `{exposicao:"medir"}`, sem confirmação.
16. Exposição Ligado com 409 `criterio` (com `falta`): o toast é `tr_an_expo_sem`, a lista aparece em `#tr-cfg`, a tela continua em `catalogo` e não há `auditLog`.
17. Ponto em `medir` com `criterio_passa:true`: Ligado manda `{ponto:"ligada"}` sem confirmação.
18. Ponto em `medir` com `criterio_passa:false`: Ligado abre a confirmação de hoje ("O acerto ainda está abaixo da meta..."). Cancelar não manda nada. OK manda `{ponto:"ligada", forcar:true}`. Depois aparecem, em `#tr-cfg`, o selo "Ligado abaixo da meta por <nome> em dd/mm/aaaa hh:mm" e o botão "Ligar de novo com as marcações de agora".
19. 409 `rotulos` no "ligar mesmo assim": o toast é "Não ligou. O que falta está logo abaixo." e a lista (texto puro, sem `&amp;`) aparece em `#tr-cfg`.
20. Ponto em `ligada`, Desligado: abre `tr_cfg_desl_conf`. Cancelar não manda nada. OK manda `{ponto:"medir"}`.
21. Com o ponto fora de `ligada`, aparece o aviso `tr_aviso_desl` no topo do Treino (nas 3 abas) e a pílula `tr_cfg_ponto_off` em `#tr-cfg`. Com `ligada`, nenhum dos dois.
22. Ponto `ligada` e caixa `ia-ligada` desmarcada: aparece `tr_cfg_ia_caixa` em `#tr-cfg`.
23. Supervisora (`configuracao.u`): vê e usa os 4 botões. Quem tem `configuracao.r` sem `u` vê só as pílulas. Um botão `tr-cfg` injetado no DOM não gera POST.
24. Validador (sem `configuracao.r`): não vê `#tr-cfg`. No Treino vê o aviso sem o botão "Abrir em Configurações".
25. "Ver como" de um Admin: `#tr-cfg` só com pílulas. Chamar `ETERNA.trCfgMuda('ponto',true)` não gera POST e mostra `vc_so_ver`.
26. Sem servidor (`state.agent.on=false`): `#tr-cfg` mostra `tr_sem_servidor`, sem botão e sem erro de página.
27. A 390 px, `#tr-cfg`, o aviso do Treino e a aba Marcar com a pergunta 3 aberta não fazem a página rolar para o lado (`document.documentElement.scrollWidth <= innerWidth`). Os botões Sim e Não têm pelo menos 56 px de altura.
28. Todas as chaves novas e mudadas têm 5 textos, sem vazio. Nenhum texto pt novo tem travessão (—).
29. `testes/rodar.sh` passa inteiro, com `treino.js`, `treino-medida.js`, `fot-alertas.js`, `todas-as-telas.js`, `treino_agente.py`, `cena_agente.py` e o novo `treino-claro.js`.

## Riscos para o revisor de segurança

- **Sem mudança no servidor.** A rota `/treino/config` continua exigindo `configuracao.u` no servidor, com limite de 6 por minuto e `forcar` só com `ponto:"ligada"`. A tela nunca manda `desligada`, mas a rota aceita. Quem tem `configuracao.u` e chama a API direto ainda consegue: aceitável.
- **"Ver como".** Três barreiras: `guardAct` (`tr-cfg` em `WRITE_OPS`), checagem de `state.assumido` em `trCfgMuda`, `trAnalise` e `trForcar`, e a recusa do servidor. As ações `tr-ia` e `tr-iam` mexem só no rascunho; o `trGravar` já recusa no "ver como".
- **Desligar por engano.** Para os fundos de IA, o efeito é imediato para os próximos visitantes. Por isso há confirmação. Religar abaixo da meta precisa do "ligar mesmo assim" e congela as marcações daquele momento (versão nova). Fica no `liga_log` do servidor e no `auditLog`.
- **XSS.** Todo texto novo passa por `TE`. Os motivos do recorte vêm de uma lista fixa no app, e um slug desconhecido vindo do servidor nunca é desenhado (os botões saem de `TR_IA_MOTIVOS`). Nome no selo continua com `esc(trMedQuem(...))`. As listas do 409 continuam texto puro com `esc`.
- **`ia.motivos` no servidor** aceita qualquer slug de até 24 caracteres, até 8, de quem tem `qualidade.u`. Não é risco hoje. Depois, fechar com uma lista `TREINO_IA_MOTIVOS` no `treino_valida`.
- **Escala.** Nenhuma consulta nova: o quadro lê o `/status`, que já é pedido. O `/treino/medida` (pesado, 10 por minuto) não é chamado em Configurações. Com 100 venues, cada servidor tem a sua chave: nada é global.
- **Sem internet ou sem servidor.** A configuração mora só no servidor do ponto. Sem ele não há botão, e nada vai para `localStorage`. A marcação segue a fila de hoje (`eterna.treino.fila.v1`).
- **Dados.** Nada de vendas no quadro. O repositório é público: o plano não tem senha, chave nem número de venda.
- **Branch compartilhada.** `WRITE_OPS` e `ACT_MOD` são a mesma linha que o plano "Zerar fase de teste" muda. Conferir no merge que nenhuma entrada sumiu (`tr-forcar`, `tr-luz-usar`, `zerar-*`).

## Depois (sugestões, não para hoje)

- No Resultado, uma conta do recorte: entre as fotos de Gramado marcadas, quantas o servidor escolheria como base (`base_rec_ok`) e quantas a pessoa disse que não servem. Só com essa medida dá para decidir se a resposta "Não serve" deve vetar a base. Minha opinião: deve, mas medindo antes.
- Padrão `medir` para servidor novo (D3).
- Alerta na tela Alertas quando os Fundos de IA automáticos estiverem desligados.
- Juntar a caixa "Separar os primeiros cliques" ao interruptor novo, com a Escala desligada.

## Pontos para o Eduardo decidir

1. **Lugar do alerta de exposição.** O plano põe as duas linhas juntas em Configurações › Preços e Checkout › Fundos de IA. Se ele preferir o alerta em outro lugar (por exemplo, perto dos limites dos alertas em Curadoria › Fotógrafos), é trocar uma chamada.
2. **Motivos do "Não serve para recorte":** Pessoa cortada na borda, Corpo inteiro com chão, Luz ruim para recorte, Gente atrás, Outro. Falta algum?
3. **Teclas S (sim) e X (não)** para a pergunta 3.
4. **"Parado no servidor"** só aparece em servidor recém-instalado. Ele aceita mudar o padrão do servidor para "Desligado (mede em silêncio)" numa próxima entrega?

## Mudanças pedidas depois do plano (24/11)

- **10:44, Enter sem escolha.** Na aba Marcar, o Enter numa foto sem nenhuma escolha (sem ponto, sem qualidade e sem resposta 3) só passa para a próxima, como Próxima. Nada é gravado nem vai para a fila, também no "ver como". Com escolha, o Enter grava e vai para a próxima sem marcação, como antes. `tr_teclas` diz isso nas 5 línguas.
- **11:04, IA automática.** O quadro saiu de Preços e Checkout › Fundos de IA e virou a tela Configurações › IA automática (view `ia-auto`, módulo `configuracao`), com três chaves Ligado/Desligado: Fundos de IA automáticos, Alerta de foto escura ou estourada e Ajuste automático das fotos (o antigo cartão de Minhas fotos). Só o Admin muda (`isAdminUser`, fora do "ver como"); quem tem a tela no menu vê as pílulas; o Fotógrafo não vê a tela. No servidor, o `POST /treino/config` passou a exigir o perfil admin pela sessão (403 `so_admin`), como o `/poses/config`. O Ajuste automático continua no SIM (`sim/autoAj`, sincronizado pelo servidor do ponto); o ajuste em si roda no navegador que tem a Biblioteca aberta. Em Ajuste automático fica só a situação.
- **11:04, Minhas fotos sem o seletor Fotógrafo.** Admin e Supervisora veem as Sessões de hoje de todos; o Fotógrafo preso continua só com as dele. Os chips de fotógrafo da Biblioteca ficam.
