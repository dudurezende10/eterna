# Revisão de código da v77 (agente revisor, 27/10)

**Revisão de código, entrega v77 (galeria por QR fase 1 + Loja apartada)**

A entrega cobre o plano quase todo. Itens 1 a 6 entregues, os adendos A1, A2, A4, A6 e A7 também. O A3 ficou de fora, como o adendo 2 manda. Não entrou nada fora do escopo. O agente usa só biblioteca padrão (`hmac`, `secrets`) e não registra chave em log. As 5 línguas estão completas para todas as chaves `gq_`/`lj` usadas, sem travessão. Encontrei 4 problemas que voltam para o programador. Os dois primeiros eu reproduzi no navegador.

**CORRIGIR**

1. **Recarregar a página joga a equipe na Loja, sem saída visível.**
   - Onde: `index.html`, leitura de `eterna.view` no topo do `state` (`checkout|fila|caixa` viram `quiosque`), o boot e a linha nova de `render()` `if(state.user&&state.view==='quiosque'&&!state.lojaRota)`.
   - O que acontece: `go('checkout')` grava `eterna.view='checkout'`. O botão Recibo da Lista de vendas faz isso. Quando o admin recarrega, cai em `#loja` em tela cheia, e a única saída é Esc ou 3 toques no logo.
   - Reproduzido: com `eterna.view=checkout`, o reload deu `{view:'quiosque', hash:'#loja'}`.
   - O que fazer: no boot, só abrir a Loja quando o hash for `#loja` ou quando `homeView()==='quiosque'`. Nos outros casos, ir para `homeView()`. Tirar também o mapeamento para `quiosque` na leitura de `eterna.view`.

2. **Venda da Loja cancelada continua liberando o download.**
   - Onde: `index.html`, `galAtualizar`.
   - O que acontece: o ramo `else if(o&&o.direito==='comprada')` mantém como `comprada` qualquer foto que já foi comprada, de qualquer canal. O plano manda preservar só `comprada/online`.
   - Reproduzido: sessão paga, depois cancelada, e as 2 fotos ficaram `comprada` com canal `loja`.
   - O que fazer:
     - trocar o ramo por `o.direito==='comprada'&&o.canal==='online'`;
     - em `sales-cancel`, chamar `galAtualizar` + `galPublicar` nas galerias da sessão.
   - Observação: no agente, `gal_mesclar` nunca deixa uma compra voltar para venda. Para o cancelamento chegar até lá, o Eduardo precisa decidir; estorno está fora do escopo.

3. **Texto em português fixo na tela do cliente.**
   - Onde: `index.html`, `pubPagar`, no trecho `toast(j.error||'Pagamento não concluído')`.
   - O que acontece: o erro não passa por `T()` e ainda mostra a mensagem crua do servidor (por exemplo "foto fora do acesso ou não está à venda").
   - O que fazer: criar uma chave nova (por exemplo `gq_payFail`) nas 5 línguas e não exibir `j.error`.

4. **Links assinados vencem e o app não pede links novos.**
   - Onde: `index.html`, `pubBaixar` e `pubPagar`, no modo agente.
   - O que acontece:
     - Os links valem 15 min (`URL_TTL`), mas o app só chama `POST /g/<token>/galeria` dentro de `pubAguardar`. Depois de 15 min na página, Baixar falha e a alternativa abre o mesmo link vencido (403).
     - Quando o acesso vence (401), o app mostra "Esse rosto não aparece nas fotos desta visita" com 5 tentativas. A mensagem está errada para esse caso.
   - O que fazer:
     - se o download falhar, ou se a galeria tiver mais de cerca de 12 min, pedir `/galeria` com `acesso`, atualizar `p.gal` e tentar de novo uma vez;
     - com 401, voltar para a selfie (`pubSelfieAbrir`).

**SUGESTÃO**

5. **Gravação dentro do `render()`.**
   - `index.html`: `galCod()` e `drawQR()` (vCaixa/receiptPanel) criam e salvam manifesto durante a montagem da tela.
   - `vGalerias` chama `galAtualizar` também durante a montagem.
   - `caixaConfirm` (Checkout) imprime o QR, mas nunca chama `galPublicar`.
   - Melhor: criar e publicar em `caixaConfirm`, e deixar o `render` só lendo.
6. **Duplicação em `lojaPay`.** `galDaSessao(card,true)` já roda `galAtualizar` e `saveSim`; o `galAtualizar` repetido logo depois pode sair.
7. **Compra online fica só no manifesto onde aconteceu.**
   - Quem compra na galeria do grupo de escola não marca a foto na galeria da própria sessão, nem na administração.
   - A cortesia já é guardada por foto (`SIM.sessions[card].cort`). Vale fazer o mesmo com a compra online, aqui e no agente.
8. **`capture` no `#gq-file`.** No celular, esse atributo abre direto a câmera, o que contradiz o rótulo `g_pickFile` ("Escolher uma foto do aparelho"). No fluxo de escola o responsável normalmente escolhe uma foto que já tem. Tirar pelo menos no modo criança.
9. **Botão Encerrar sem permissão.** Em `galGrupos`, o botão aparece com `u`, mas a ação exige `d`. O supervisor (`RW` = c, r, u) vê o botão e recebe "Sem permissão". Usar `can('galerias','d')`.
10. **Código morto.**
    - `case 'loja-full'`, `state.kiosk.full` e `ljMode()` constante;
    - a regra antiga de `.lj-langs button` a 640px, agora sobrescrita;
    - o CSS das bandeiras ficou num bloco novo em vez de junto das regras `.lj-langs` originais.
11. **Botão repetido.** O "Voltar ao início" aparece igual 3 vezes em `vQuiosque`; vale um helper pequeno.
12. **`esc()` faltando.** `pubImg` interpola `f.vitrine`, que vem do agente, no `style` sem `esc()`. O risco é baixo, mas o padrão pede.
13. **Indexação desnecessária.** Na rota pública, `selfieMount` chama `faceIndexAll()` também no modo agente e indexa as 373 fotos de exemplo à toa.
14. **Grupos em `galEvSalvar`.**
    - Sessões que mudaram de `menor` são recalculadas, mas não publicadas.
    - Tirar uma sessão do grupo, ou desmarcar menor, não limpa o `menor` da sessão.
15. **Agente, desempenho no pagamento.** A rota de pagamento lê o `vendas-online.jsonl` inteiro duas vezes por venda, dentro do `gal_lock` (idem e numeração). Serve para a fase 1; para escalar, um índice em memória resolve. `gal_info["processadas"]` não é usado.
16. **Testes instáveis.**
    - Resultados aqui: a suíte completa deu `FALHAS: 1` (no critério 24). Rodei `galeria-qr.js` mais 5 vezes: 2 falhas por tempo esgotado em `selfie()`, que espera até 90 s, e 3 passagens seguidas com a máquina quieta. Nas falhas havia carga concorrente: o revisor de segurança rodando agente e navegador, e um processo meu.
    - Causa provável no critério 24: `clock.install()` sem `pauseAt`, enquanto `compraLoja` usa espera real. O tempo real conta nos 5 s.
    - Sugestão: `C.clock.pauseAt(...)` antes da compra; em `selfie()`, esperar a câmera assentar (`err` ou `ready`) e registrar o estado quando estourar o tempo.
17. **Tradução.** Em alemão, `gq_gift` = "Geschenkt" soa estranho; "Gratis" ou "Geschenk" fica melhor. O resto das traduções está bom.
18. **VERSOES.md.** Ainda falta a linha da v77. O carimbo no `index.html` já está atualizado.

DEVOLVER