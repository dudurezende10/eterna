# Revisão de segurança da v77 (agente de segurança, 27/10)

**Veredito: APROVADO.** Não achei nenhum BLOQUEANTE. Os quatro itens bloqueantes do plano passam, e a fase 1 só é alcançável pelo próprio computador do ponto (127.0.0.1). Os achados IMPORTANTE abaixo precisam ser corrigidos antes da fase 2 ou de usar `ETERNA_REDE=1` em produção. O item 1 é o mais grave.

Subi o agente na porta 8797, com HOME temporário e OpenCV ligado, e derrubei no fim. A porta ficou livre e o HOME temporário foi apagado. O script de teste ficou em `/tmp/claude-0/-home-claude/fef0effa-643b-53e4-9f03-27edd5ebde99/scratchpad/probe.py`. Não editei o código do produto.

## Pontos pedidos

| Item | Resultado |
|---|---|
| Original de foto à venda | Nunca é servido. A rota checa o direito no manifesto a cada pedido, e o agente só copia original de comprada ou cortesia. |
| Assinatura dos links | Usa `hmac.compare_digest` (há uma ressalva na NOTA 1). |
| Validação do token | `token_ok` vem antes de qualquer caminho, no GET e no POST. O `pid` passa por regex. |
| Selfie e foto da criança | Não vão para disco nem log: procurei `data:image` no HOME e na saída do agente e não achei nada. No navegador, `selfieStop` zera a selfie e o `sessionStorage` guarda só contador e hora. |
| Total da compra | Calculado no servidor. O `total` mandado pelo cliente é ignorado. |
| Idempotência | Funciona por `(token, idem)`, dentro do `gal_lock`. |

## BLOQUEANTE
Nenhum.

## IMPORTANTE

1. **Grupo de escola: dá para abrir as fotos de outra criança recortando o rosto dela da vitrine. Confirmei no teste.**
   - O que fiz: o pai da criança A mandou o rosto de A e recebeu a foto em grupo. Recortei o rosto de B da vitrine dessa foto (800 px, com marca d'água), mandei como "foto da criança" e abri a galeria de B. Baixei o original da cortesia de B (HTTP 200).
   - Por que o limite atual não segura: sucesso não conta tentativa, e `_falhas.pop((ip, token))` ainda zera as falhas.
   - Onde: `gal_post`, ramo `evento` do `/rosto`.
   - O que mudar agora: no evento, contar acertos por `(ip, token)`, por exemplo no máximo 2 acessos distintos em 24 h, mais um teto por token por hora. Não zerar as falhas quando acerta.
   - Decisão do Eduardo antes da fase 2: um PIN por criança ou família, ou desfocar os outros rostos na vitrine das fotos em grupo.

2. **"Encerrar" é desfeito ao republicar. Confirmei no teste.** Depois do encerrar o info dá 410; republicar o manifesto com a validade antiga volta a dar 200.
   - Hoje isso acontece quando o app republica de outro aparelho, ou quando alguém chama `/galerias/encerrar`, que o app nem usa.
   - O que mudar: em `gal_mesclar`, manter `expira = min(velho, novo)`, ou guardar `encerrada:true`, que só uma ação explícita desfaz.

3. **O pagamento simulado é o padrão, e as vendas de teste entram como receita.**
   - Sem `ETERNA_PAGAMENTO`, `PagamentoSimulado` aprova tudo e libera o original.
   - A venda aparece na Lista de vendas e no CSV como "Pix online", status paga.
   - O que mudar:
     - `pagamento_escolhido()` passa a recusar quando a variável não estiver definida fora dos testes;
     - gravar `teste:true` em `vendas-online.jsonl`;
     - em `allSalesSim()`, marcar essas vendas como teste e tirá-las da receita.

4. **A Loja pública (`#loja`, sem login) tem três problemas:**
   - **Saída da equipe:** Esc ou 3 toques no logo (`lojaSair`) caem direto no app logado com o usuário da equipe que estiver no navegador. Pedir código ou PIN, ou mandar sempre para o login.
   - **Lista de sessões:** o botão "Sessões esperando" (`loja-list` / `loja-open`) fica visível para qualquer cliente e abre as fotos de outras famílias. Esconder atrás de um gesto da equipe.
   - **Pagamento:** `lojaPay` marca a venda como paga pelo que o cliente declara, inclusive "Dinheiro", e agora isso libera original na galeria. Sem TEF ou adquirente, a venda deve ficar "aguardando caixa" até um operador confirmar, registrando o terminal e o operador.

5. **Uma imagem pequena faz o agente reservar mais de 2 GB de memória. Confirmei no teste.**
   - Um PNG de 20000×20000 ocupa 518 KB em base64, abaixo do limite de 2 MB, e `cv2.imdecode` aloca 2,3 GB. Isso pode derrubar o agente do ponto.
   - Acontece no `buscar_em` e também no `/rostos/buscar`, que já existia.
   - O que mudar: `os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS","40000000")` antes do primeiro `import cv2`, ou ler as dimensões e recusar imagens acima de cerca de 40 MP.

6. **Sem tempo limite de conexão. Confirmei no teste.** Abri 60 conexões que declaram um corpo e nunca mandam: ficaram 60 threads presas (de 8 para 68).
   - O que mudar: `timeout = 20` na classe `H` e um limite de concorrência nas rotas `/g/*`.

7. **O limite por IP vira bloqueio de todos atrás do mesmo IP. Confirmei no teste.**
   - Depois de 10 tentativas de `/rosto` num minuto, um cliente em outra galeria, no mesmo IP, recebeu 429.
   - Quem tiver o QR da escola consegue bloquear a galeria para todos os pais atrás do NAT do estádio.
   - Para a fase 2:
     - contar o limite por minuto por `(ip, token)`;
     - pôr um teto global na fila do `_busca_lock`;
     - aceitar `X-Forwarded-For` só de proxy confiável.

8. **DNS rebinding em `/galerias/vendas`. Confirmei no teste.** Sem Origin e com Host de outro domínio, a rota respondeu 200 com os tokens de todas as galerias.
   - O que mudar: em `origem_local()`, exigir também `Host` igual a `127.0.0.1:PORT` ou `localhost:PORT`.

9. **Já existia, e a retenção de 60 dias (D10) piorou.** `/biblioteca`, `/thumb`, `/file` e `/rostos/buscar` respondem com CORS `*` e `Access-Control-Allow-Private-Network: true`, sem checar origem.
   - Confirmei: com Origin de outro site, `/biblioteca` e o original de uma foto à venda em `/file` deram 200.
   - Qualquer site aberto no computador do ponto pode procurar um rosto em 60 dias de fotos e baixar os originais. Com `ETERNA_REDE=1`, qualquer aparelho da rede também. Enquanto isso valer, a selfie da galeria não protege nada.
   - O que mudar: tirar CORS `*` e `Allow-Private-Network` dessas rotas e exigir origem local em `/rostos/*`.

10. **A limpeza dos rostos só roda quando o agente inicia (`rostos_thread`).** Se o agente ficar ligado mais de 60 dias, a retenção de 60 dias não acontece. O que mudar: limpeza diária dentro de um loop.

## NOTA
1. Uma `sig` com caractere fora do ASCII faz o `compare_digest` levantar `TypeError`: a conexão fecha sem resposta e o traceback vai para a saída. Validar `^[0-9a-f]{64}$` antes de comparar.
2. O código curto de uma galeria expirada ou encerrada ainda devolve o token (confirmei). Checar a validade, ou tirar o código de `codigos` ao encerrar.
3. `_falhas` nunca é limpo. `acessos` fica só em memória: se o agente reiniciar, os acessos caem e o app responde ao 401 com "esse rosto não aparece", o que confunde.
4. `vendas-online.jsonl` é lido inteiro duas vezes em cada pagamento, dentro do `gal_lock`, e também a cada consulta do app. O id da venda vem da contagem de linhas, então uma linha corrompida pode perder ou repetir uma venda. Melhor passar para SQLite com `UNIQUE(token, idem)`.
5. Os preços do manifesto não têm limite: `todas=0` ou `inf` são aceitos (só pela origem local). Validar faixa e número finito.
6. Republicar com um código que já pertence a outro token sobrescreve o mapeamento. Na fase 2 isso precisa ser recusado.
7. A `versao` do consentimento vem do cliente; o servidor deveria gravar a versão do texto que ele conhece. O log de consentimento e o de vendas guardam o token inteiro e não têm prazo de retenção.
8. O `/g/<token>/info` expõe `menor`, e o `/status` público mostra o total de galerias.
9. Quando o `imread` falha, a vitrine vira a miniatura sem marca d'água. Os originais são copiados em dobro no disco (dá para usar `os.link`). `gal_indexar` lê todos os manifestos ao iniciar.
10. No modo SIM, toda a decisão fica no navegador e fácil de contornar, e agora `window.ETERNA` expõe `SIM`. Só funciona no navegador que tem o SIM, não expõe nada a terceiros, mas convém desligar esse modo em produção por uma chave.
11. Com `ETERNA_REDE=1`, a galeria funciona na rede local em http puro, com a selfie sem criptografia. Além disso, a Loja rodando em outro computador recebe 403 ao publicar, o que é um problema de funcionamento para o revisor de código.
12. D2: na sessão de adulto, qualquer rosto com semelhança ≥ 0,45, até de alguém ao fundo, abre a sessão inteira com os originais. Também não existe opção de "não sou eu" nem pedido de remoção.
13. Escala e custo: o reconhecimento serializado e o manifesto lido por chave aguentam bem um venue. O que quebra com 100 venues é o estado em memória (`acessos`, `_janelas`) e os jsonl, que precisam ir para um banco na fase 2.

Arquivos revisados: `/home/claude/eterna/agente/eterna-agente.py`, `/home/claude/eterna/index.html` e `/home/claude/eterna/docs/planos/2026-10-27-galeria-qr-fase1.md`. Os IMPORTANTE 1 a 10 precisam ser registrados no plano.