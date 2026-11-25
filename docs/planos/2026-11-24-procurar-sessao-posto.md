# Plano: "Procurar sessão" no Posto de venda

**Ressalvas da leitura.**
- O `index.html` mudou enquanto eu lia (de 14.389 para 14.426 linhas) e o HEAD é "Merge de idiomas-base (v99.52.0 do Ronaldo) ... v99.52.1", não v99.51. As linhas abaixo são aproximadas: procure pelo nome da função.
- Li as linhas 1 a 63 de `docs/CONTEXTO-ETERNA.md` (de 183) e o resto só por busca.
- Não li as etapas 2 e 3 da Venda manual (escolha e pagamento) nem `srvMaterializa` por dentro.

## Objetivo
O caixa acha a sessão do cliente por fotógrafo e horário, reconhece a família pelas miniaturas e segue a venda sem sair do Posto. Usa só dados que o perfil de venda já recebe, sem rota nova.

## 1. O que existe hoje

**Posto e Venda manual (`/home/claude/eterna-af/index.html`)**
- `vPosto` fica por volta da linha 2745. O bloco `#posto-manual` é montado na 2752 quando `state.posto.manual` está ligado, e o corpo vem de `vCheckoutCorpo()` (~2772).
- A etapa 1 de `vCheckoutCorpo` tem a câmera (`camBox`) e o campo `#ck-code` (`data-act="checkout-code"`, grava `state.checkout.code`).
- Abaixo do campo há uma lista de até 16 sessões de `demoSessions()`, sem as pagas, filtrada por `card.includes(q)`. Ela não tem miniatura nem filtro de fotógrafo ou hora.
- Tocar numa sessão dispara `data-act="checkout-pick"`, que chama `checkoutPick(card)` (~2766). Ele marca `state.checkout.session`, `state.caixa.session`, etapa 2, status `no checkout` e chama `saveSim()`.
- `checkoutVoltar()` (~1994) desfaz. `postoManualOn()` (~1992) abre o bloco.

**O botão "Venda manual" não existe mais no Posto.**
- O `case 'posto-manual'` continua no switch (~13912), mas nenhum HTML gera `data-act="posto-manual"`.
- O rodapé (~2760) tem o comentário "18/11 (Ronaldo): sem a Venda manual; no lugar dela, a Cortesia SAC", e esse botão exige `galerias.u`.
- O perfil Atendimento e venda só chega ao bloco pelo endereço `#checkout` (apelido em `postoAlias`). Ele tem `checkout` no menu.
- Esta entrega, portanto, precisa de uma porta de entrada (dúvida 1).

**Sessões de hoje com miniaturas**
- `srvPull()` (~5634) lê `GET /sessoes?desde=<rev>` e guarda em `SRV.sess` (memória, só hoje).
- Cada sessão traz `card`, `fotografo`, `ponto`, `status`, `aberta_em`, `cap0`, `cap1`, `ultima_chegada`, `fechada_em`, `fotos` (pids), `pend`, `ia`, `removida` e `rev`.
- As fechadas passam ao `SIM.sessions` por `srvMaterializa()`, no máximo `SRV_MAT_MAX=12` por ciclo.
- Sessões de hoje em Minhas fotos usa `upSessLista()` (~5908) e miniaturas `<img loading="lazy">` em `<agente>/thumb/<pid>`.
- `revSessions` é da Curadoria (amostra, Roverpix e SIM) e não serve aqui.

**O que o perfil de venda recebe (`ROTAS`, `/home/claude/eterna-af/agente/eterna-agente.py` ~19765)**
- O preset `venda` tem `venda` RW, `quiosque` RW, `catalogo` RO e `filafoto` RO.
- `GET /sessoes`, `/thumb/` e `/file/` pedem `FOTOS_LER`, que inclui `venda.r` e `quiosque.r`. O caixa já recebe todas as sessões de hoje, com a chave do fotógrafo e os pids, e já pode abrir qualquer miniatura.
- Ele não recebe `/biblioteca` e `/events` (`set.r`, `estoque.r`), `/metricas` (`estatisticas.r`, `financeiro.r`) nem `/fotografos/*` (`desempenho.r`).
- Nada novo é aberto. O nome do fotógrafo por sessão já aparece hoje na lista da Venda manual.

## 2. Escopo

**Entra**
- Bloco "Procurar sessão" na etapa 1 da Venda manual, substituindo a lista de 16.
- Filtro de fotógrafo e de horário.
- Cartões com hora, fotógrafo, ponto, número de fotos e 4 miniaturas.
- Toque no cartão segue por `checkout-pick`.
- Botão "Procurar sessão" no rodapé do Posto.
- Chave para desligar.

**Fica fora**
- Dia anterior. Não é de graça: `SRV.sess` só tem hoje e ontem exige `?ontem=1`.
- Busca por rosto nova.
- Filtro "de/até" livre.
- Rota nova, mudança no agente, zoom da miniatura.
- Qualquer mudança nas etapas 2 e 3.

## 3. Decisões assumidas
1. **Fonte.** `SRV.sess`, só `status==='fechada'`, sem `removida` e com `fotos.length>0`.
2. **Hora da sessão.** `max(cap1, ultima_chegada)`, a mesma regra do agente desde 18/11 para câmera com relógio atrasado. Ordena da mais nova para a mais antiga.
3. **Horário.** Chips "30 min", "1h30" (padrão, igual à janela da selfie), "3 h" e "Hoje". Um toque é mais rápido que digitar hora no balcão.
4. **Fotógrafo.** `<select>` com "Todos" e só quem tem sessão fechada hoje, com o nome de `P[key].name`. Chave fora de `P` mostra a própria chave escapada.
5. **Miniaturas.** As 4 primeiras de `fotos` que não estão em `ia`, como `<img loading="lazy" decoding="async">`, quadradas e contidas (regra da foto inteira), sem zoom.
6. **Limite.** 24 cartões, com "Mostrar mais" de 24 em 24. Trocar filtro volta a 24.
7. **Sessão ainda não materializada.** Se `sessionObj(card)` não existe ou vem sem fotos, o cartão aparece desabilitado com "Carregando fotos". Sem isso, `simOf(card)` cria uma sessão vazia e a venda abre sem foto. Existe um auxiliar perto da linha 3414 para "código conhecido sem fotos": o programador deve olhar antes de criar outro.
8. **Vendida ou com pedido.**
   - `paga`: cartão apagado, selo "Já vendida", sem toque.
   - Pedido aberto (`dinAbertaDe(card)` ou status `aguardando`, `no caixa`): selo "Pedido em aberto", sem toque.
   - `no checkout`: selo de aviso, toque permitido, como hoje.
   - Com `sim.lgpd`: segue o `lgpdSelo` que já existe na etapa 2.
9. **Campo do código.** `#ck-code` continua e filtra a mesma lista por `card.includes(q)`. Com código digitado, o filtro de horário é ignorado.
10. **Sem agente** (`!state.agent.on` ou sem `a.sessoes`, e demonstração): mantém a lista antiga de `demoSessions()`. Os testes existentes (`cortesia-sac-posto.js`, `posto-unico.js`) dependem dela.
11. **Texto.** Tela da equipe, com `TE()` nas 5 línguas.

## 4. Mudanças por arquivo

Só `/home/claude/eterna-af/index.html`, mais um teste novo e a documentação.

- **Constante `PROCURA_SESSAO_ON=true`**, ao lado de `ESCALA_ON`. Em `false`, tudo volta ao que é hoje.
- **Estado.** `state.posto.busca={key:'todos',jan:90,n:24}`, junto de `state.posto.manual=false` (~2744). Nada em `SIM` nem em `localStorage`.
- **`psLista()`**, função pura. Devolve `{fotografos:[{key,nome,n}], itens:[...], total}` a partir de `SRV.sess`, `state.posto.busca` e `state.checkout.code`. Aplica as decisões 1, 2, 4 e 9.
- **`psEstado(card)`**. Devolve `'livre'|'carregando'|'paga'|'pedido'|'nocheckout'` (decisões 7 e 8).
- **`psCartao(x)`**. Usa `<button class="scard ps-card" data-act="checkout-pick" data-card>` quando livre e `<div class="ps-card off">` nos outros estados. Tudo com `esc()`, e o pid com `encodeURIComponent`.
- **`psPainel()`**. Monta os filtros, a lista de `itens.slice(0,n)`, a contagem e o "Mostrar mais".
- **`vCheckoutCorpo()`**, etapa 1. Com a chave ligada e o agente com sessões, o painel direito mostra `psPainel()` no lugar do `.sess`. Senão, o código atual, intacto.
- **`vPosto` rodapé (~2760).** Com `canView('checkout')&&can('venda','r')&&!man&&PROCURA_SESSAO_ON`, acrescenta `<button data-act="posto-manual">` com `TE('ps_abrir')`. O `case` já existe. Trocar o toast fixo dele por `TE('sem_acesso_tela')`.
- **Switch de cliques.** `case 'ps-jan'` (valores 30, 90, 180, 0; zera `n`) e `case 'ps-mais'` (`n+=24`).
- **Ouvinte `change`.** `ps-foto` grava `busca.key` só se a chave estiver em `psLista().fotografos`.
- Nenhuma ação nova grava, então nada entra em `WRITE_OPS`.
- **`checkoutPick(card)`.** Se `PROCURA_SESSAO_ON` e `psEstado(card)` não for `livre` nem `nocheckout`, mostra um toast e sai. Isso vale também para clique forjado.
- **Atualização.** Onde `srvPull` já chama `render()`, garantir que só redesenha com o Posto na etapa 1 se o resultado mudou (comparar os `card` e estados visíveis). Não pode perder foco nem texto do `#ck-code`, que já tem `data-keep`.
- **CSS, prefixo `ps-`.**
  - `.ps-filtros`: flex com wrap, chips com 44 px de altura.
  - `.ps-lista`: grid de 1 coluna até 700 px, `repeat(auto-fill,minmax(300px,1fr))` acima.
  - `.ps-thumbs`: 4 colunas, `aspect-ratio:1`, `object-fit:contain`, fundo neutro.
  - `.ps-card.off`: opacidade .55.
  - Sem rolagem horizontal a 390 px.
- **Teste novo.** `/home/claude/eterna-af/testes/posto-procurar-sessao.js`.
- **Documentação.** Um item em `CONTEXTO-ETERNA.md`, um passo no `GUIA-DA-EQUIPE.md` e uma linha em `VERSOES.md`.

## 5. Contratos

**Agente.** Nenhuma mudança. Lê `GET /sessoes` (já em uso) e `GET /thumb/<pid>`.

**Chaves novas no I18N da equipe (pt, en, es, fr, de)**

| Chave | pt | en | es | fr | de |
| --- | --- | --- | --- | --- | --- |
| `ps_abrir`, `ps_titulo` | Procurar sessão | Find session | Buscar sesión | Chercher une séance | Sitzung suchen |
| `ps_nota` | Escolha o fotógrafo e o horário e toque na família. | Pick the photographer and the time, then tap the family. | Elija el fotógrafo y el horario y toque la familia. | Choisissez le photographe et l'horaire, puis touchez la famille. | Fotograf und Uhrzeit wählen, dann die Familie antippen. |
| `ps_fot` | Fotógrafo | Photographer | Fotógrafo | Photographe | Fotograf |
| `ps_todos` | Todos | All | Todos | Tous | Alle |
| `ps_30` | Últimos 30 min | Last 30 min | Últimos 30 min | 30 dernières min | Letzte 30 Min. |
| `ps_90` | Última 1h30 | Last 1h30 | Última 1h30 | Dernière 1h30 | Letzte 1,5 Std. |
| `ps_180` | Últimas 3 h | Last 3 h | Últimas 3 h | 3 dernières h | Letzte 3 Std. |
| `ps_hoje` | Hoje | Today | Hoy | Aujourd'hui | Heute |
| `ps_mais` | Mostrar mais | Show more | Mostrar más | Afficher plus | Mehr anzeigen |
| `ps_n` (a, b) | a de b sessões | a of b sessions | a de b sesiones | a sur b séances | a von b Sitzungen |
| `ps_vazio` | Nenhuma sessão neste filtro. Aumente o horário. | No session in this filter. Widen the time range. | Ninguna sesión en este filtro. Amplíe el horario. | Aucune séance avec ce filtre. Élargissez l'horaire. | Keine Sitzung in diesem Filter. Zeitraum erweitern. |
| `ps_vendida` | Já vendida | Already sold | Ya vendida | Déjà vendue | Bereits verkauft |
| `ps_pedido` | Pedido em aberto | Open order | Pedido abierto | Commande en cours | Offene Bestellung |
| `ps_carregando` | Carregando fotos | Loading photos | Cargando fotos | Chargement des photos | Fotos werden geladen |

Reusar `n_fotos` e `statusLabel`.

## 6. Critérios de aceite

Teste Playwright com agente falso por `page.route`, no padrão de `sessoes-upload.js`. Login por `_entrar.js`, com um usuário de preset `venda` criado no teste.

1. O perfil venda vê "Procurar sessão" no rodapé do Posto. O toque abre `#posto-manual` com o bloco.
2. Com 40 sessões fechadas no feed, aparecem 24, da mais nova para a mais antiga, e "Mostrar mais" leva a 40.
3. O padrão de 1h30 esconde sessão com última foto há 2 h, e "Hoje" mostra.
4. O select lista só fotógrafos com sessão fechada hoje, e escolher um filtra.
5. Cada cartão tem hora, fotógrafo, ponto quando houver, número de fotos e no máximo 4 `<img>` com `loading="lazy"` em `/thumb/`.
6. Sessão aberta, removida ou sem foto não aparece.
7. Tocar numa sessão livre leva à etapa 2 com o código certo em `.posto-manual-cod`.
8. Sessão `paga` mostra "Já vendida" e não tem `data-act`. Chamar `checkoutPick` à mão não muda a etapa.
9. Sessão com pedido aberto mostra "Pedido em aberto" e não abre.
10. Sessão no feed mas fora do SIM mostra "Carregando fotos" desabilitado. Depois de materializar, fica tocável.
11. Digitar parte do código filtra e ignora o horário.
12. Novo `/sessoes` com a tela aberta não apaga o texto do `#ck-code` nem volta a contagem para 24.
13. A 390×844 e 1280×800 não há rolagem horizontal (`scrollWidth<=clientWidth`), e os botões têm 44 px ou mais.
14. Nas 5 línguas não há chave crua nem travessão nos textos `ps_*`.
15. Fotógrafo com `<img onerror>` no nome ou na chave não vira HTML.
16. Com `PROCURA_SESSAO_ON=false`, o Posto fica idêntico ao de hoje.
17. Sem agente, a lista antiga aparece e `cortesia-sac-posto.js` e `posto-unico.js` seguem passando.
18. Perfil sem `venda` (Fotógrafo) não vê o botão. Com `#checkout` na URL, cai em sem acesso.
19. `testes/rodar.sh` inteiro passa, sem `pageerror`.

## 7. Riscos

**Escala**
- Um dia de 300 sessões cabe em memória. O custo é o `render()` que reescreve o `#main`, e por isso o limite de 24 e o redesenho só quando muda.
- Miniaturas têm cache de 1 dia, o que dá no máximo 96 pedidos por página.
- Com 100 venues nada muda, porque cada agente é local.
- Internet caída não afeta (rede do ponto). Com o agente caído, vale a lista antiga e a faixa de conexão.

**Amanhã**
- A Venda manual volta a ficar a um toque de todo caixa depois de retirada em 18/11. Antes de programar, fazer uma venda manual inteira (dinheiro e maquininha) no servidor de teste e conferir que o evento chega ao servidor (`/ponto/eventos`) e a impressão sai. Se não fechar, não publicar. Não validei essas etapas.
- `SRV_MAT_MAX=12` por ciclo: na abertura, com muitas sessões, os cartões ficam em "Carregando fotos" por alguns ciclos.
- Depois do deploy, fechar e abrir todos os Postos.

**Como desligar**
- `PROCURA_SESSAO_ON=false` e push em `idiomas-base` (o servidor atualiza em até 1 minuto), depois recarregar os Postos. Ou reverter o commit.
- Enquanto isso, o caixa usa o código LP ou a Supervisora procura em Minhas fotos.

## 8. Dúvidas para o Eduardo
1. **A Venda manual saiu do Posto em 18/11 (Ronaldo). Pode voltar como botão "Procurar sessão" para todo o perfil Atendimento e venda?** Assumo que sim, no rodapé ao lado da Cortesia SAC. Vale avisar o Ronaldo, porque o motivo da retirada não está no código.
2. **Sessão já vendida: só o selo "Já vendida" sem toque, ou o toque abre o recibo para reimprimir?** Assumo só o selo. Recibo e reimpressão seguem pelo botão Recibo, e isso mantém a entrega pequena.

## Decisões para a programação (24/11, 23h50)
1. O Eduardo combinou com o Ronaldo que a busca entra no Posto de venda. O botão "Procurar sessão" volta ao rodapé do Posto para o perfil Atendimento e venda.
2. Sessão já vendida: só o selo "Já vendida", sem toque.
