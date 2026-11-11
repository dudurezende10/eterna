# Guia da equipe do Eterna

Passo a passo do dia a dia, em linguagem simples. Cada parte diz para quem é. Atualizado na v99 (11/11/2026).

Três nomes para guardar:

- **Checkout** é a tela do cliente, no monitor virado para ele. Abre pelo botão amarelo **Abrir Checkout**.
- **Posto de venda** (ou só **Posto**) é a tela do vendedor e do caixa, no notebook. Tudo da venda é feito nela.
- **Computador do ponto** é o computador do estádio que recebe e guarda as fotos. Quando ele para, aparece a faixa vermelha "O computador do ponto não está respondendo. Chame a TI."

### Nomes que mudaram

Se alguém falar o nome antigo, é esta tela:

| Nome antigo | Nome de hoje | Onde fica |
| --- | --- | --- |
| Loja | Checkout | botão amarelo **Abrir Checkout** |
| Fila do balcão, tela Caixa antiga, tela Venda | Posto de venda | grupo **Venda** |
| Caixa (tela separada) | Caixa, dentro do Posto de venda | botão amarelo **Caixa** |
| Upload automático | Minhas fotos | grupo **Fotógrafo** |
| Biblioteca (para o fotógrafo) | Minhas fotos de hoje | fim da tela **Minhas fotos** |
| Escala 5×2 | Escala | grupo **Fotógrafo** |
| Painel de controle, Catálogo e preços | Preços e Checkout | grupo **Configurações** |
| Vendas e caixa | Vendedores | grupo **Dashboard** |
| Fundos de IA (em Configurações) | aba **Fundos de IA** de Preços e Checkout | grupo **Configurações** |
| Semana | Painel | grupo **Dashboard** |
| Código do recibo, código do pedido | Seu código | tela do cliente e recibo |

---

## 1. O menu (todos)

### Como funciona

O menu fica do lado esquerdo e é dividido em grupos:

| Grupo | O que tem |
| --- | --- |
| Venda | Posto de venda |
| Dashboard | Painel, Estatísticas, Bandeiras, Estoque, Fila de impressão, Fotógrafos, Vendedores, Lista de vendas, Galerias online, Calendário de eventos |
| Curadoria | Qualidade, Treino da IA, Alertas |
| Fotógrafo | Diário do set, Minhas fotos, Fila do fotógrafo, Escala |
| Configurações | Preços e Checkout, Ajuste automático |
| Sistema | Repositório, Identidade, Fundos de IA (técnico), Usuários, Permissões e a pasta Laboratório (Vestiário, Chute a gol, Fundos em teste) |

1. No alto do menu ficam dois botões amarelos: **Abrir Checkout** e **Caixa**. Só aparecem para quem pode usar.
2. O número ao lado de **Caixa** mostra quantos pagamentos em dinheiro esperam confirmação.
3. Toque no nome do grupo para abrir. Toque de novo para fechar. Quem vê até 5 telas vê a lista direta, sem grupos.
4. O grupo da tela em que você está fica sempre aberto.
5. Para voltar ao **Início**, toque no logo.

Cada pessoa só vê as telas que pode usar. Se faltar uma tela de que você precisa, peça à administração.

Quem só consulta os preços (vendedor) vê a tela **Preços e Checkout** com o nome **Preços**, só com a tabela.

### No celular

1. No alto da tela ficam o logo, o ícone do Checkout e o botão **Menu**.
2. Toque em **Menu**. Os grupos abrem por cima da tela.
3. Toque no grupo e depois na tela. O menu fecha sozinho.
4. Para fechar sem escolher, toque na parte escura ao lado ou em **Menu** de novo.

### Faixa vermelha: o computador do ponto não responde

Quando o computador do ponto está desligado ou fora da rede, as telas que dependem dele mostram uma faixa vermelha:

**O computador do ponto não está respondendo. Chame a TI.**

Embaixo aparece **Último dado às hh:mm**. Os números da tela são dessa hora e não estão atualizando.

1. Avise a TI e diga a hora que aparece na faixa.
2. Não recarregue a página várias vezes. A tela volta sozinha quando o computador do ponto responder.
3. O Checkout e o Posto de venda continuam abrindo mesmo sem internet (veja **Novidades da v97**).

Os detalhes técnicos (endereço, porta, pasta) aparecem só para o Admin, em **Detalhes técnicos**, no fim da tela **Minhas fotos**.

### Modo demonstração (só o Admin)

Os botões de simulação (Simular leva, Testar com fotos suas) ficam escondidos no dia a dia. Só o Admin liga, em **Sistema › Identidade › Modo demonstração neste computador**. Vale só naquele computador e aparece a faixa cinza "Modo demonstração" no alto. Desligue antes de atender.

### Se ao entrar aparecer "Seu acesso ainda não foi liberado"

A administração ainda não liberou nenhuma tela para você. Peça ao administrador.

---

## 1A. Painel (Admin e Supervisor)

O Painel responde em poucos segundos "como foi o período": faturamento, fotos, sessões, o que vendeu e como pagaram.

### Escolher o período, o ponto e a fonte

1. Toque em **Hoje**, **Ontem**, **7 dias** ou **30 dias**. Os dias seguem o horário do Rio, mesmo abrindo de outro país.
2. Para outras datas, toque em **Personalizado** ou direto nas datas **De** e **Até**.
3. **Ponto**: filtra pelo ponto onde a foto foi tirada. Só liga com a Roverpix ao vivo (pelo computador do ponto) ou com a fonte **Eterna**.
4. **Fonte**: **Tudo** (Roverpix + Eterna), só **Roverpix** ou só **Eterna**. A parte Eterna são as vendas deste computador.
5. **Exportar CSV** baixa um dia por linha e uma linha de total.

### Como ler

- **Os 4 cartões**: Faturamento (com ticket médio e vendas), Fotos tiradas (e quantas foram vendidas), Sessões (e quantas compraram) e Gasto por visitante (só com a leitura das catracas; sem catraca aparece um traço).
- **Seta verde ▲ ou cinza ▼**: comparação com o período anterior de mesma duração. Só aparece quando esse período anterior está inteiro nos dados. Abaixo de 1% aparece "estável".
- **Receita por dia**: o melhor dia em azul, com o valor; o pior só com o valor. Passe o mouse ou toque numa coluna para ver o valor do dia.
- **Vendas**: quantos atendimentos viraram venda, foram descartados ou cancelados, e os brindes.
- **Fotos**: quanto das fotos vendidas saiu impressa, e as reimpressões.
- **Sessões**: de cada 100 sessões, quantas chegaram ao balcão e quantas compraram. A frase diz onde está a maior perda.
- **Ranking de produtos**: sempre os 12 produtos do catálogo (os da Imply); o que vem de nomes antigos da Roverpix fica em "Outros (catálogo antigo)". As cortesias (Cortesia SAC e CORTESIA PORTA-RETRATO) aparecem depois dos produtos vendidos, com quantas foram dadas e "cortesia" no lugar do valor. Elas não contam na receita nem na posição do ranking. Só aparecem quando houve alguma no período.
- **Pagamentos**: quanto entrou por modalidade. Dinheiro aguardando caixa aparece numa nota e não entra no total.
- **Dia a dia**: toque para abrir a tabela.
- **"total de 07/10 a 15/10"**: com os números importados, Vendas, Fotos, Ranking e Pagamentos só existem como total do período inteiro.
- **"Roverpix desatualizado desde hh:mm"**: o computador do ponto não atualiza há mais de 15 minutos. Confira se o computador do ponto está ligado.

Atendimento e venda, Fotógrafo, Validador e Checkout não veem o Painel.

---

## 2. Fotógrafo (Minhas fotos e Escala)

### O que o fotógrafo vê

- Ao entrar, cai direto em **Minhas fotos**.
- No menu, só o grupo **Fotógrafo**: Diário do set, Minhas fotos, Fila do fotógrafo e Escala.
- Não vê Checkout, vendas, números de outros fotógrafos, Curadoria nem Configurações.

### Seu nome e seu ponto (v97)

No alto de **Minhas fotos** aparecem o seu nome e o seu ponto do dia. O nome vem do seu login. O ponto vem da **Escala**. Não dá para trocar por aqui.

- Outro fotógrafo vai usar o computador: toque em **Trocar fotógrafo**.
- O ponto está errado: fale com a supervisora. Ela corrige na Escala.

A supervisora e o Admin continuam com os seletores **Fotógrafo** e **Ponto** no alto da tela.

### Escala: onde eu trabalho hoje (v97)

1. Abra **Fotógrafo › Escala**.
2. Em letra grande aparece **Hoje você está em:** e o nome do ponto. Para o volante aparece **Hoje você está como Volante**, com o modo do dia.
3. Se for folga, aparece **Hoje é sua folga**.
4. Se aparecer **Você não está na escala de hoje. Fale com a supervisora.**, fale com ela antes de começar. Sem função do dia, as fotos para os fundos de IA não são separadas.
5. Embaixo ficam os **Próximos 7 dias**. Eles mostram o seu ponto fixo. A supervisora confirma a função de cada dia.

A supervisora e o Admin veem a Escala da equipe a partir de hoje: a função de cada fotógrafo e a cobertura dos pontos. Os dias que já passaram ficam em **Ver dias anteriores**.

### De quem é cada foto

O fotógrafo não faz check-in da câmera. O Eterna sabe de quem é cada foto assim:

1. Pelo **usuário do FTP**: cada fotógrafo manda as fotos com o seu login (ou para a sua pasta) no FTP do estádio.
2. Pelo **nome gravado na câmera** (menu da câmera › Informações de copyright › Nome do autor), se houver.

Foto sem nenhuma dessas pistas cai em **Sem fotógrafo**.

O FTP do estádio é configurado pela administração em **Configurações › Preços e Checkout**, aba **Avançado**. Só funciona com o Eterna aberto no computador do ponto.

### Trocar de fotógrafo no mesmo computador

1. No alto de **Minhas fotos** aparece **Neste computador**, com o nome de quem está logado.
2. Toque em **Trocar fotógrafo**. Quem estava sai.
3. O próximo fotógrafo entra com o usuário e a senha dele.
4. Ele volta direto para **Minhas fotos**.

Para só sair, sem trocar, toque em **Sair**.

### A faixa de estado

Logo abaixo do título, uma faixa diz como estão as suas fotos:

| Faixa | Quer dizer |
| --- | --- |
| **Pronto para receber** | nada chegando agora |
| **Recebendo 12 de 20** (amarela) | as fotos estão chegando e sendo lidas |
| **Tudo no servidor · 48 fotos hoje · 6 sessões** (verde) | tudo o que você fez já está guardado |
| **O computador do ponto não está respondendo. Chame a TI.** (vermelha) | o computador do ponto parou; a hora do último dado aparece embaixo |

### Ligar e desligar o ajuste automático

O ajuste automático da IA clareia a foto escura, segura a estourada e acerta a cor de toda foto que chega.

1. Em **Minhas fotos** fica o painel **Ajuste automático da IA**.
2. Toque no botão para trocar entre **Ligado** e **Desligado**.
3. Embaixo aparece quem mexeu e a hora. Exemplo: "Desligado por Carlos às 14:02".

Bom saber:
- Vale para o computador do ponto inteiro, não só para você. O próximo fotógrafo encontra do jeito que você deixou.
- Ao religar, as fotos que chegaram com ele desligado também são ajustadas, em alguns segundos.
- Toda troca fica registrada com o seu nome.
- O supervisor vê o painel, mas não consegue mudar.

### Minhas fotos de hoje (v97)

No fim da tela o fotógrafo vê **Minhas fotos de hoje**: só as fotos dele, de hoje, separadas por sessão.

- Cada sessão mostra a hora da primeira foto, quantas fotos tem e quantas foram vendidas.
- A foto vendida leva a etiqueta **VENDIDA**.
- As fotos que acabaram de chegar ficam em **Ainda sem sessão** até a sessão fechar.
- Não tem filtro para escolher. A tela já mostra só o que é seu.

A supervisora e o Admin continuam vendo todas as fotos, com os filtros de dia, hora, fotógrafo e venda.

### O cartão não foi lido: enviar as fotos pela tela (v97)

É o plano B. Use só quando o leitor não reconhecer o cartão. As fotos entram do mesmo jeito que entrariam pelo leitor, como fotos de cartão.

**Fotógrafo**

1. No computador do ponto, abra **Minhas fotos**.
2. Toque em **Enviar fotos do cartão manualmente** (fica logo abaixo da faixa de estado, com o aviso "Use só se o cartão não foi lido.").
3. Confira a frase "As fotos entram como do cartão de <seu nome>".
4. Abra a pasta do cartão no computador e arraste as fotos para a área **Solte aqui as fotos do cartão**. Ou toque em **Escolher fotos** e selecione as fotos.
5. A faixa mostra **Enviando 4 de 6**. Espere.
6. No fim aparece **Enviadas 6 de 6**. Pronto.
7. Toque em **Fechar** para guardar o painel.

**Supervisora ou Admin (enviando para um fotógrafo)**

1. Abra **Minhas fotos** no computador do ponto.
2. No seletor **Fotógrafo**, no alto, escolha de quem são as fotos. Com **Todos** aparece "Escolha o fotógrafo acima." e nenhuma foto entra.
3. Siga os passos 2 a 7 acima. Confira o nome na frase "As fotos entram como do cartão de...".

**Se algo não entrar**

| O que aparece | O que fazer |
| --- | --- |
| "já estava no servidor" | Nada. A foto já tinha chegado. Não é erro. |
| "não era foto" | O arquivo não é uma foto JPEG da câmera. Só entram arquivos `.jpg` ou `.jpeg` de verdade. Foto em RAW, vídeo ou arquivo renomeado não entra. |
| "acima de 60 MB" | A foto é grande demais. Fale com a supervisora. |
| "chegou cortada" | A foto chegou incompleta. Envie de novo. |
| **Tentar de novo as N que faltaram** | A conexão caiu no meio. Toque no botão. Cada foto já tinha tentado 3 vezes. |
| "O computador do ponto está sem espaço. Chame a TI." | O disco do computador do ponto está quase cheio. Pare e chame a TI. |
| "O limite de fotos por dia do envio manual foi atingido. Chame a TI." | O envio manual tem um teto de fotos por dia. Chame a TI. |
| "O computador do ponto precisa ser atualizado para receber fotos por aqui. Chame a TI." | O computador do ponto está numa versão antiga. Chame a TI. |
| "O computador do ponto não está respondendo. Chame a TI." | O computador do ponto está desligado ou fora da rede, ou você não abriu o Eterna pelo computador do ponto. |

Bom saber:
- O fotógrafo manda sempre em nome dele. Não dá para mandar em nome de outro.
- Dá para mandar até 2.000 fotos de cada vez.
- Pode trocar de tela durante o envio, ele continua. Não feche nem recarregue a página até terminar.
- Para interromper, toque em **Parar**.
- Cada envio fica registrado com o nome de quem enviou.
### Sessões de hoje (v91)

Com o computador do ponto ligado, **Minhas fotos** mostra o painel **Sessões de hoje**: as fotos agrupadas por sessão, a mais nova em cima. O fotógrafo vê as sessões dele. A supervisora e o Admin filtram pelos seletores **Fotógrafo** e **Ponto** do alto da tela.

Cada sessão tem uma linha com: o código (LP...), o fotógrafo, o ponto, a hora do primeiro e do último clique, o número de fotos e o motivo de ter começado. Quando aparece "chegada" depois da hora, a câmera não mandou a hora do clique e vale a hora em que a foto chegou.

| Como aparece | Quer dizer |
| --- | --- |
| Borda amarela e **aberta · recebendo** | o fotógrafo ainda está nessa sessão; as fotos novas entram nela |
| **fechando** | o servidor viu rostos novos e abriu outra sessão; por 1 minuto esta ainda pode se juntar à nova (por exemplo, as fotos individuais do pai e da mãe antes da foto do grupo) |
| Sem destaque, com **Abrir sessão** | fechada: já está no Checkout e não muda mais |
| Foto apagada com **lendo rostos** | a foto chegou e o servidor ainda está lendo os rostos para decidir a sessão |

Motivo de a sessão ter começado:

- **primeira do dia**: primeira sessão do fotógrafo hoje.
- **pausa de 1 min**: o fotógrafo ficou 1 minuto sem clicar.
- **rostos novos**: sem pausa, mas a foto trouxe só rostos que não estavam na sessão anterior (outra família).
- **agente reiniciado** ou **reagrupada**: o computador do ponto foi reiniciado; as fotos foram agrupadas de novo.
- **atrasada**: fotos do cartão (ou que chegaram mais de 10 minutos depois do clique). Ficam em sessões só delas, separadas das fotos ao vivo do mesmo fotógrafo.

Na dúvida, o servidor deixa a foto na sessão em que está: foto sem rosto, de perfil, de criança pequena ou de alguém ao fundo não abre sessão nova. Se a mesma família foi fotografada por dois fotógrafos, ficam duas sessões; no Checkout a selfie acha as duas.

Se aparecer o aviso **Rostos desligados neste computador**, o servidor está separando as sessões só pela pausa de 1 minuto. Avise a TI.

Clique numa foto para ampliar. As setas passam só pelas fotos daquela sessão.

### Os 2 primeiros cliques são para os fundos de IA (v93)

Vale nos 4 pontos de campo (Terminal Campo, Foto Campo 2, 3 e 4). Volante e Vestiário ficam de fora.

**Fotógrafo: em toda sessão, comece assim**

1. **1º clique: corpo inteiro** do grupo, da cabeça aos pés.
2. **2º clique: mais fechado**, do joelho ou da cintura para cima.
3. Depois, faça as fotos normais da sessão.

**O que acontece com essas 2 fotos**

- Elas não são vendidas como foto. Viram a base das montagens com os fundos de IA.
- O servidor recorta as pessoas assim que as fotos chegam, com a sessão ainda aberta.
- Quando o cliente chega ao Checkout, as **5 montagens** já estão prontas, uma para cada fundo: Arquibancada 1950 usa o 1º clique; Noite de campeão, Mirante, Saída do túnel e Telão do Maracanã usam o 2º.
- **Se você esquecer**, o sistema usa as 2 primeiras fotos assim mesmo. A IA recorta de qualquer jeito. Não existe botão para devolver essas fotos à venda.
- Sessão com 2 fotos ou menos: nada é separado, as fotos ficam à venda.

**Como conferir em Minhas fotos**

- As 2 fotos aparecem com a marca **Fundo IA 1** e **Fundo IA 2**. Passe o mouse sobre a marca para ler o texto inteiro: **Fundo IA 1 · corpo inteiro** e **Fundo IA 2 · fechada**.
- Com a sessão ainda aberta, a marca aparece como **Fundo IA?**. Ela confirma quando a sessão fecha.
- A marca **IA** sozinha continua sendo a do ajuste automático. É outra coisa.
- O cabeçalho da sessão mostra **Fundos de IA: 2 de 2 prontas**. Se a sessão não teve fotos separadas, mostra o motivo: volante, ponto fora da regra, sem função do dia, poucas fotos ou regra desligada.
- Sem função do dia na Escala, nada é separado. Confira a sua função antes de começar.

**Na Fila do fotógrafo**

- **Fundo IA: falta o 2º clique** enquanto a sessão só tem 1 foto.
- **Fundo IA ✓✓** quando os 2 recortes estão prontos.

**Administração: mudar a regra (Admin)**

1. Abra **Configurações › Preços e Checkout** e toque na aba **Fundos de IA**.
2. Desça até o quadro **Fotos para os fundos de IA**.
3. Ali dá para ligar ou desligar a regra, escolher **quantos cliques** (de 1 a 3) e **em quais pontos** ela vale, inclusive Vestiário e Volante.
4. A mudança vale para as sessões que fecharem depois dela. As sessões já fechadas não mudam.

Só quem pode alterar Configurações (Admin e Supervisor, pelos perfis prontos) muda esse quadro. Os outros veem os campos apagados.

**Depois da atualização para a v93:** recarregue todos os navegadores dos caixas. Um navegador antigo ainda mostra essas 2 fotos como fotos à venda.

---

## 3. Checkout e Posto de venda (caixa e atendimento)

### Abrir

1. No computador do Checkout, entre com o usuário do aparelho. Se ele tiver o perfil Checkout, a tela abre sozinha.
2. Em outro computador, toque em **Abrir Checkout**. No celular, é o ícone de tela ao lado do botão Menu.
3. O Checkout abre em tela cheia, sem menu e sem login. É a tela do cliente.

**A aba do Checkout nunca entra logada.** Depois que uma aba virou Checkout, recarregar, digitar outro endereço ou duplicar a aba leva sempre à tela do cliente ou ao login. Para usar o sistema, entre de novo com o seu usuário e a sua senha, ou use outra janela.

### Posto automático (10/11/2026)

Não é preciso parear o aparelho. Basta ligar o computador na rede do ponto, abrir o Eterna pelo atalho e um **Admin** entrar com usuário e senha uma vez: o servidor registra o aparelho sozinho como **Posto 1**, **Posto 2**... e cada venda fica marcada com o posto onde foi feita. O Checkout aberto por esse aparelho funciona na hora. Só os aparelhos da rede do ponto viram posto: quem entra de fora (pelo Tailscale) e o próprio computador do servidor usam o sistema normalmente, sem virar posto. Fotógrafo ou vendedor que entra num aparelho que ainda não é posto vê "Este aparelho ainda não é um posto": chame um Admin. Depois disso, qualquer pessoa da equipe usa o posto. O posto só deixa de valer se ficar mais de 30 dias seguidos sem abrir o Eterna (aí um Admin entra de novo), ou se a pessoa que o criou for removida.

O pareamento abaixo continua existindo só para um aparelho que precisa abrir o Checkout **sem ninguém conectado** (ex.: um tablet fixo ou a TV da Fila).

**Parear um aparelho sem pessoa conectada (Admin, opcional)**

1. No próprio aparelho, abra o Eterna pelo endereço do servidor do ponto (`https://posto.eterna.photo`). Não use eterna.photo.
2. Entre com um usuário que pode alterar o Painel de controle (Admin).
3. Abra **Configurações › Painel de controle** e vá a **Postos deste ponto**.
4. Escreva o nome do aparelho (ex.: Checkout 1) e toque **uma vez** em **Parear este aparelho**. O botão mostra **Pareando…** até terminar. Tocar de novo não cria outro posto.
5. Pronto: o Checkout abre nesse aparelho sem ninguém conectado. A conta do Admin sai do aparelho logo depois de parear (o aparelho continua pareado). Para usar o sistema ali de novo, entre com usuário e senha.

A lista mostra cada aparelho, o número (P1, P2...), quem pareou, o último uso e se está ativo. Dica: no computador do ponto, use como nome o mesmo do rolo de papel (ex.: Caixa 1).

**"Este aparelho ainda não foi pareado"**

Aparece no Checkout de um aparelho sem ninguém conectado, ou que foi revogado. O que fazer:

1. Confira se a página foi aberta pelo endereço do servidor do ponto.
2. Toque em **Sair**, entre com o seu usuário e a sua senha e abra o Checkout de novo: o aparelho vira posto sozinho.
3. Depois, toque em **Tentar de novo**. **Sair** volta para a entrada.

As vendas que o aparelho já tinha na fila ficam guardadas e sobem depois do pareamento.

**Revogar um aparelho (Admin)**

Use quando um aparelho for perdido, trocado ou sair do ponto.

1. Em **Postos deste ponto**, ache o aparelho na lista.
2. Toque em **Revogar**. A situação muda para **revogado** na hora.
3. Aquele aparelho passa a mostrar "Este aparelho ainda não foi pareado". Para voltar a usar, pareie de novo (ele ganha um número novo).

**Outros avisos**

- **"abra o Eterna pelo endereço do servidor do ponto"**: a página foi aberta pelo endereço errado (por exemplo eterna.photo). Abra pelo endereço do servidor do ponto, o mesmo dos postos.
- **"alterações não foram aceitas (sem permissão)"**: a sua conta não pode mudar aquilo. Peça a quem pode.
- **Preços** no Painel de controle: quem não tem o Catálogo vê os preços, mas não muda.

**Galeria da venda no aparelho pareado.** Depois que o Caixa confirma o pagamento, o aparelho pareado publica a galeria da venda (QR e código). Se a sessão ainda estiver chegando do servidor, a galeria espera as fotos e é publicada sozinha em seguida.

### Fotos de mais de uma sessão (v91)

Quando o cliente olha para a câmera, o Checkout junta todas as sessões do dia em que ele aparece: com a família num ponto e, mais tarde, sozinho em outro ponto, com outro fotógrafo. Cada sessão em que ele aparece entra inteira, inclusive as fotos da família em que ele não está, porque a família costuma vir junta ao balcão. A tela abre direto na primeira foto ampliada; ele passa as fotos com as setas ou arrastando, marca com ✓ e pode tocar em **Ver todas** para ver a grade. O ponto e a hora aparecem no canto da foto.

Se o cliente aparece só no fundo das fotos de outra família (o rosto dele bem menor que o das pessoas da frente), aquela sessão não entra inteira: entram só as fotos em que ele aparece.

Se o Eterna achar o cliente só parecido numa outra sessão, ele pergunta antes: **"Esta sessão também é sua?"**, com até 3 fotos pequenas. **Sim, sou eu** junta só as fotos em que ele parece aparecer, nunca a sessão inteira; **Não sou eu** deixa de fora. Sessão de criança ou de grupo de escola nunca entra assim.

A compra é uma venda só, mesmo com fotos de várias sessões. Foto que já foi comprada não aparece de novo. Pelo código do recibo (o código da sessão) abre a sessão inteira; pelo código da galeria, a compra daquela venda. Depois de 5 códigos errados seguidos, o campo trava por 1 minuto (recarregar a página não destrava).

### Cliente que volta horas depois: use o código do recibo

A câmera procura só as fotos dos **últimos 90 minutos** (a família que fotografou antes disso já foi embora, e a busca fica mais rápida e mais segura). Se o cliente voltar depois, a câmera não acha: peça o **código do recibo** (começa com LP) ou o **código da galeria** (exemplo: `K7QM-4WXR`). O código abre a sessão de qualquer hora do dia.

**"Buscando suas fotos…"** Se a sessão acabou de ser fotografada, as fotos podem levar alguns segundos para chegar ao Checkout. Depois de digitar o código e tocar em **Ver minhas fotos**, o botão fica desativado e mostra "Buscando suas fotos…" por até 4 segundos. É normal. Não toque de novo: assim que as fotos chegam, a sessão abre. Se não chegarem, aparece o aviso de código não encontrado; espere um pouco e tente de novo. Código de sessão sem foto disponível, ou de outro dia, responde na hora, sem espera.

O tempo muda em **Configurações › Preços e Checkout**, aba **Checkout**, em **Procurar fotos dos últimos __ minutos** (de 15 a 480 minutos, ou **Dia todo**). Só Admin e Supervisor mudam. Vale na hora para todos os caixas do ponto. Em dia cheio, diminua; em dia calmo, pode aumentar.

### Computador do cliente: Chrome em modo quiosque

No terminal que fica virado para o cliente, abra o Chrome em modo quiosque. Assim o cliente não vê a barra de endereço, as abas nem os botões do navegador.

1. Entre com o perfil **Checkout** (o usuário do aparelho) ou abra direto `eterna.photo/#loja`.
2. Abra o Chrome em modo quiosque (atalho do Chrome com a opção `--kiosk`). A TI do ponto deixa o atalho pronto.
3. Para sair do modo quiosque, a equipe usa Alt+F4 no Windows ou Cmd+Q no Mac.

### Checkout e Posto de venda no mesmo computador

Nesta versão o Checkout e o Posto de venda precisam estar **no mesmo computador e no mesmo navegador**, em duas janelas: uma com o Checkout, no monitor do cliente, e outra com o Posto de venda, no notebook da equipe. Em computadores diferentes o pedido não aparece no Posto. Isso muda numa próxima versão.

### Depois de cada atualização: feche as janelas antigas

**Na atualização para a v96, logo depois de publicar:** em todos os balcões, feche e abra de novo o Checkout e o Posto de venda (e qualquer outra janela do Eterna aberta no notebook). A v96 grava a compra sem pacote de um jeito que uma janela da versão anterior não lista nem confirma, e o Posto da v96 mostra um alerta vermelho se uma janela antiga mexer numa compra do Checkout. Mesmo assim a janela antiga continua aberta com dados velhos e só some quando é fechada: **fechar e reabrir em todos os balcões continua obrigatório**. Antes de usar a impressora, registre a troca de rolo em cada posto com um rolo novo (os valores que vêm na instalação são de demonstração; veja **Troquei o rolo**).

Quando o Eterna for atualizado, feche ou recarregue **todas** as janelas do Eterna abertas naquele computador (Checkout, Posto de venda e as outras). Uma janela antiga aberta pode atrapalhar o caixa. Se aparecer o aviso "Há uma janela antiga do Eterna aberta. Recarregue as outras janelas.", faça isso na hora.

### Atender um cliente (v96)

O balcão tem o monitor do cliente na frente, com a maquininha presa nele, e o notebook do caixa atrás, no **Posto de venda**. O cliente já está no caixa: o Checkout nunca manda ele para outro lugar.

1. A tela do Checkout mostra o botão grande **Iniciar**. A câmera fica desligada até o cliente tocar nele.
2. O cliente toca em **Iniciar** e olha para a câmera. O Checkout encontra as fotos dele e a câmera desliga.
3. Se a câmera não encontrar (ou se as fotos são de mais de 90 minutos atrás), ele toca em **Digite sua sessão** e digita o código da sessão (começa com LP). Se nenhum rosto aparecer na câmera por 1 minuto (gente passando atrás não conta), ela desliga e a tela volta ao **Iniciar**. Em qualquer caso ela desliga 3 minutos depois do Iniciar.
4. A foto aparece na tela inteira. Ele passa com as setas, arrastando o dedo ou com as teclas de seta, e toca em ✓ nas que quer levar e em ✗ nas que não quer. **Ver todas** mostra a grade.
5. Com fotos marcadas aparece **Continuar · N fotos** no canto de baixo. É o único botão que faz o pedido (o carrinho do canto de cima só mostra quantas estão marcadas). Ao tocar, o cliente vê **Pronto! O atendente vai finalizar sua compra**, com o código dele e quantas fotos escolheu. O Checkout não mostra pacote, preço nem forma de pagamento. Se ele quiser mudar a escolha, toca em **Voltar às fotos**: volta para as fotos com tudo o que já tinha marcado e a compra sai do seu **Aguardando pagamento** (aparece o aviso "O cliente do código ... voltou às fotos"). Quando ele tocar em Continuar de novo, ela volta. Depois que você escolhe o pacote ou a forma de pagamento no Posto, **Voltar às fotos** some e o cliente vê "O atendente já está finalizando sua compra.": a compra fica com você (para mudar, cancele e peça para ele escolher de novo).
   - Se o cliente parar na escolha das fotos sem tocar na tela por 90 segundos, o Checkout volta ao **Iniciar** e as fotos marcadas por ele são apagadas: quem chegar depois começa do zero e não vê as fotos de ninguém. Ele também pode sair quando quiser pelo botão **Sair**, no canto de cima. Se já tiver marcado fotos, o Checkout pergunta "Sair e apagar as fotos marcadas?" (Sim ou Não). Isso não vale depois do Continuar: aí valem as regras da tela Pronto e do valor (abaixo).
6. No **Posto de venda**, a compra aparece em **Aguardando pagamento** com as fotos escolhidas (inclusive as de fundo de IA). Mostre as fotos ao cliente, escolha o **pacote** (o **Ideal** vem marcado com a etiqueta) e a **forma de pagamento**.
7. Assim que você escolhe o pacote, a tela do cliente mostra **Valor a pagar R$ X** e quantas fotos são, sem o nome do pacote. Antes de você escolher a forma de pagamento aparece "O atendente vai informar a forma de pagamento"; depois, "Pague na maquininha" (Cartão), "Pague com PIX na maquininha" (PIX) ou "Pague em dinheiro ao atendente" (Dinheiro). Ele pode tocar em **Ver minhas fotos** para ver as escolhidas. Se você trocar o pacote, o valor muda na hora na tela dele. Cada escolha ou troca de pacote e de forma de pagamento fica no registro de auditoria com o seu nome e o valor.
   - Na tela Pronto e na tela do valor o cliente não tem mais o botão **Voltar ao início** (v97). Ele apertava sem querer e perdia o pedido. Para voltar a tela dele ao começo, use **Recomeçar o Checkout** no seu notebook (veja abaixo).
   - Se a tela Pronto ou a tela do valor ficar parada por 3 minutos (ou a equipe apertar Esc), o Checkout volta sozinho ao **Iniciar**. A compra continua em **Aguardando pagamento** com "O cliente saiu da tela": cancele ou espere ele voltar.
   - Se o preço do pacote mudar em Preços e Checkout depois da sua escolha, ao confirmar o Eterna mostra o valor novo (o cliente também vê) e pede para confirmar de novo.
8. Cobre na maquininha e confirme como antes (**Pago na maquininha** ou **Recebi R$ X**). O Checkout mostra a tela final com o QR, o código da galeria e o **Valor pago R$ X** que você confirmou.
9. Se você cancelar, o Checkout do cliente volta ao início.
10. Imprima as fotos no Posto de venda. A tela final com o QR fica 40 segundos e volta sozinha ao **Iniciar**. Para atender o próximo antes disso, toque em **Voltar ao início** (só a tela final com o QR tem esse botão).

### Recomeçar o Checkout (v97)

Use quando o monitor do cliente ficou parado na tela Pronto ou na tela do valor e você precisa dele livre: o cliente foi buscar alguém, saiu da frente da tela ou outra família vai usar o monitor.

1. No **Posto de venda**, ache o pedido em **Aguardando pagamento**. O botão **Recomeçar o Checkout** aparece só no pedido que o monitor do cliente está esperando.
2. Toque em **Recomeçar o Checkout**.
3. Aparece a pergunta **Recomeçar o Checkout?**, com o código do pedido. Confira o código.
4. Toque em **Sim, recomeçar**. Para desistir, toque em **Não, manter a tela**.
5. O monitor do cliente volta ao **Iniciar**. Aparece o aviso "O monitor do cliente voltou ao início. O pedido continua aqui."

Bom saber:
- O pedido **não é cancelado**. Ele continua em **Aguardando pagamento**, com a marca "Checkout recomeçado às hh:mm". Você ainda pode cobrar e confirmar.
- Para desistir da compra, o caminho é outro: o link **Cancelar compra**.
- Só quem vende vê o botão. Cada uso fica registrado com o seu nome.
- Se o cliente já saiu da tela de espera, o botão some sozinho.

Outras coisas que o cliente pode fazer:
- Trocar o idioma tocando na bandeira: Brasil, Estados Unidos, Espanha, França ou Alemanha. Em tela pequena, as bandeiras ficam guardadas num botão com a bandeira atual.
- Desistir a qualquer momento com o botão **Sair**, no alto da tela. Se ele já marcou fotos, o Checkout pergunta "Sair e apagar as fotos marcadas?" e só apaga com **Sim, sair**. A escolha dele é apagada e a tela volta ao **Iniciar**.
- Se ele parar de mexer na escolha das fotos (foto ampliada, Ver todas ou a confirmação de sessão) por 90 segundos, o Checkout volta sozinho ao **Iniciar** e apaga as marcas. Qualquer toque ou arrasto renova o prazo.
- Se ele já tinha feito o pedido e voltou às fotos (pelo código, pela selfie ou em outro balcão), o **Sair** e a volta em 90 segundos deixam a compra em **Aguardando pagamento** com "O cliente saiu da tela": cancele ou espere ele voltar.

### Pacotes, adicionais e economia (escolhidos no Posto de venda desde a v96)

Desde a v98 o catálogo é o da Imply: mesmos produtos, nomes, preços e código (SKU). Produto que não existe na Imply não é cadastrado.

| Produto | O que leva | Preço | Vende online |
| --- | --- | --- | --- |
| Todas as fotos digitais | todas as fotos, só digitais | R$ 250 | sim |
| Acima de 15 fotos digitais | todas as fotos, só digitais | R$ 250 | não |
| PACOTE TRIBUNA DE HONRA | 12 fotos, digitais e impressas | R$ 220 | não |
| PACOTE MARACANÃ | 9 fotos, digitais e impressas | R$ 190 | não |
| PACOTE GRAMADO | 6 fotos, digitais e impressas | R$ 150 | não |
| PACOTE ZONA MISTA | 3 fotos, só digitais | R$ 110 | sim |
| 3 fotos digitais e impressas | 3 fotos, digitais e impressas | R$ 110 | não |
| PACOTE ARQUIBANCADA | 1 foto, digital e impressa | R$ 70 | não |
| 1 foto digital e impressa | 1 foto, digital e impressa | R$ 70 | não |
| 1 foto (adicional) digital ou impressa | 1 foto a mais | R$ 35 | sim |
| Figurinha Copa | figurinha | R$ 20 | não |
| Porta-retrato | porta-retrato, com a CORTESIA PORTA-RETRATO | R$ 75 | não |

Cortesias (sem valor, não são venda):

| Cortesia | Quando | O que leva |
| --- | --- | --- |
| Cortesia SAC | cliente prejudicado pela operação: espera longa, falha de foto, impressão ou sistema, problema no atendimento | as fotos escolhidas, impressas e digitais |
| CORTESIA PORTA-RETRATO | entra sozinha, uma para cada Porta-retrato vendido | 1 foto impressa para pôr no porta-retrato |

Todas as impressas são 10×15 cm.

No Posto de venda, ao escolher o pacote (as contas são as mesmas de antes):
- **Ideal**: o pacote mais barato para as fotos que ele escolheu, já somando as adicionais. Exemplo: 4 fotos saem por Zona Mista + 1 adicional (R$ 145), mais barato que o Gramado (R$ 150).
- **Fotos com fundo de IA contam dentro do pacote.** Não são mais cobradas à parte no Checkout.
- **5 fundos de IA por venda (v93)**: uma montagem para cada fundo, feita com os 2 primeiros cliques da sessão. Esses 2 cliques não aparecem como foto normal nem entram na contagem do "Todas".
- **Resumo linha a linha** antes do total: o pacote e as adicionais, cada um com o valor.
- **Economia**: quanto ele economiza em comparação a comprar avulso (uma Arquibancada e o resto como Foto adicional). Exemplo: 8 fotos avulsas custariam R$ 70 + 7 × R$ 35 = R$ 315. No Pacote Maracanã ele paga R$ 190 e economiza R$ 125. Só aparece quando há economia.
- "Cabem mais N fotos neste pacote sem pagar mais", quando ele escolheu menos fotos do que o pacote leva.
- Impressas: o pacote imprime até o número de fotos escolhidas, mais uma por adicional. Cada adicional sai do rolo do caixa.

Se a administração tinha mudado à mão o preço do Maracanã, da Zona Mista, da Arquibancada ou da Foto adicional, esse preço voltou para o novo do catálogo. Confira em **Configurações › Preços e Checkout**.

### Dar a Cortesia SAC (v99)

Só quem pode dar cortesia (Galerias online, alterar) vê o botão.

1. No **Posto de venda**, abra a **Venda manual** e escolha as fotos com o cliente.
2. Em **Cortesia**, toque em **Cortesia SAC**. Ela ocupa o lugar do pacote.
3. Toque em **Ir para o pagamento**.
4. Escolha o **motivo** e escreva **o que aconteceu** (obrigatório).
5. Toque em **Registrar cortesia e imprimir**.

A venda fica com valor zero e pagamento "Cortesia", com o motivo, o texto e quem deu. As fotos saem impressas e entram na galeria do cliente com o selo Cortesia.

### Sessão que já foi paga

Se o cliente volta ao Checkout com fotos que já comprou, a tela mostra o QR da compra e o botão **Comprar mais fotos**. As fotos já compradas não aparecem nem são cobradas de novo. Cada foto a mais custa o preço de **1 foto (adicional) digital ou impressa**, digital e impressa, e vira uma venda nova, com número e impressão próprios.

### Dinheiro: aguardando caixa (vendedor e caixa)

Desde a v96 quem escolhe **Dinheiro** é você, no Posto de venda. A compra não é dada como paga até você receber.

**O que o cliente vê**
1. Na tela Pronto, antes de você escolher o pacote: o **código** da compra (exemplo: `K7QM-4WXR`) e quantas fotos ele escolheu.
2. Depois que você escolhe o pacote e Dinheiro no Posto de venda: "Valor a pagar R$ X", "N fotos", "Pague em dinheiro ao atendente" e o botão **Ver minhas fotos**. Essa tela não mostra o nome do pacote nem o código.
3. Se ele abrir a galeria antes de pagar, aparece que o pagamento está esperando. As fotos só aparecem depois da confirmação.

**Como confirmar (caixa)**
1. No alto do menu, toque no botão amarelo **Caixa**. O número mostra quantos pagamentos em dinheiro esperam confirmação (cartão, PIX e pedido ainda sem pacote não contam).
2. Abre o mesmo Posto de venda só com o dinheiro, com o título **Caixa**. A lista atualiza sozinha. Para ver tudo de novo, toque em **Dinheiro ✕**.
3. Digite o código que o cliente mostrou no campo de busca. Pode ser com ou sem hífen.
4. Confira o valor, o número de fotos e de impressas e as miniaturas.
5. Receba o dinheiro.
6. Toque em **Recebi R$ X**. A venda fica paga, as fotos vão para **Imprimir** no Posto de venda e a galeria do cliente libera as fotos. O recibo não abre sozinho: o cliente vê o QR no Checkout e, se precisar, o recibo (com "Recebido por <seu nome>") abre pelo botão **Recibo** em Minhas vendas de hoje.

**Se o cliente desistir**
1. Toque em **Cancelar compra** (o link vermelho, afastado do botão principal).
2. Confirme em "Cancelar esta compra? Ela não vira venda."
3. A sessão volta a ficar livre. O cliente pode voltar ao Checkout e comprar de outro jeito.

**Bom saber**
- Só quem registra pagamento confirma: Atendimento e venda, Supervisor e Admin. O fotógrafo e o computador do Checkout não confirmam.
- Se duas pessoas tentarem confirmar o mesmo pagamento, a segunda vê "Já confirmada por <nome> às hh:mm". Não duplica a venda.
- Pagamento esperando há mais de 15 minutos fica amarelo e aparece em **Alertas**.
- Se o cliente pagar a mesma sessão com cartão ou PIX, a espera some do Caixa sozinha.
- Na virada do dia, o que ficou esperando vira **não paga** automaticamente.
- Na **Lista de vendas**, use o filtro **Status** (Pagas, Aguardando caixa, Não pagas, Canceladas). A receita só conta o que foi confirmado.
- Se aparecer "Não gravou, tente de novo", toque outra vez. Se continuar, avise a administração (o armazenamento do navegador pode estar cheio).

### Recibo com o QR

- O QR e o código aparecem na tela final logo depois da compra. Peça para o cliente fotografar o QR com o celular.
- Se ele saiu sem fotografar, abra **Lista de vendas**, ache a venda e toque em **Recibo**. O recibo mostra o mesmo QR e o mesmo código, e dá para reimprimir. Ali também tem **Abrir a galeria online**.
- O QR aparece mesmo sem internet.

### Painel da equipe e saída (só a equipe usa)

**Botão "Equipe: voltar ao app"**

Quando alguém da equipe abre o Checkout pelo botão **Abrir Checkout**, aparece no alto da tela da câmera o botão **Equipe: voltar ao app**. Ele serve para voltar ao sistema sem precisar entrar de novo.

1. Toque uma vez. O botão muda para "Toque de novo: voltar ao app da equipe".
2. Toque de novo em até 3 segundos. Você volta para a tela de onde saiu, ainda logado.

O botão só aparece na tela da câmera e **some de vez** assim que o Checkout começa a atender:
- quando a câmera acha um rosto, **qualquer rosto, inclusive o seu**;
- quando alguém digita um código, abre a lista de sessões ou toca em uma foto;
- depois de 10 minutos;
- depois da primeira compra.

Se o botão sumiu, use o painel do logo ou o Esc (abaixo) e entre de novo com o seu usuário e a sua senha. No computador do perfil Checkout esse botão nunca aparece.

**Painel do logo e Esc**

- **3 toques rápidos no logo** abrem o painel da equipe. Ali estão:
  - **Sessões esperando**: abre as fotos de um cliente pela lista, quando a câmera não acha e ele não tem o código.
  - **Sair do Checkout**: fecha o Checkout.
  - **Fechar**: volta para o cliente.
- **Esc** no teclado sai do Checkout na hora.
- Sair sempre leva para a tela de login. Para voltar ao sistema, entre de novo com o seu usuário e a sua senha.
- Não deixe o painel aberto na frente do cliente. A lista mostra sessões de outras famílias.

---

## 4. Administração (Galerias online)

Fica no grupo **Dashboard** › **Galerias online**. Admin e supervisor veem. Vendedor, fotógrafo e o computador do Checkout não veem.

### Dar uma cortesia

1. Abra **Galerias online** › aba **Sessões**.
2. Busque a sessão pelo código LP e toque em **Abrir**.
3. Toque na foto marcada **à venda**.
4. Escolha o motivo (Escola, Parceiro, Reclamação ou Outro). A nota é opcional, por exemplo "turma do 5º ano".
5. Toque em **Confirmar**. A foto passa a aparecer para o cliente em "Suas fotos", com o selo Cortesia, para baixar.

Para tirar uma cortesia, toque na foto marcada **cortesia** e depois em **Retirar cortesia**. Foto comprada não muda.

Tudo fica registrado na aba **Cortesias**: quem deu, quando, qual foto, o motivo e a nota.

Se a sessão ainda não tem galeria (não houve venda), toque em **Criar galeria**. Depois, **Ver QR** mostra o QR e o código para entregar ao cliente.

Se a sessão tem criança, ligue **Sessão com menor**. O texto de autorização da galeria passa a ser o do responsável.

### Criar um grupo de escola e imprimir o QR geral

1. Abra **Galerias online** › aba **Grupos e escolas** › **Novo grupo**.
2. Escreva o nome (por exemplo, "Escola X") e escolha a data da visita.
3. Marque as sessões da turma naquele dia.
4. Deixe **Grupo com menores** marcado.
5. Toque em **Salvar**. Aparece o código do grupo.
6. Na linha do grupo, toque em **Imprimir QR**. Abre uma página com o logo, o nome do grupo, a data, o QR grande, o código e a instrução para os pais. Se a página não abrir, libere as janelas deste site no navegador.
7. Para mandar por e-mail ou WhatsApp para a escola, toque em **Baixar PNG**.

Para trocar as sessões do grupo, toque em **Editar sessões**.

### Encerrar um grupo

1. Na aba **Grupos e escolas**, toque em **Encerrar** na linha do grupo.
2. O QR e o código param de abrir na hora. **Não dá para desfazer.**

Use quando o prazo combinado com a escola acabar ou quando o QR vazar para quem não deveria ter. Só o admin vê o botão Encerrar.

### Acompanhar o envio

A aba **Envio** mostra se cada galeria chegou ao computador do ponto:
- **enviada**: pronta.
- **pendente**: esperando o computador do ponto. O Eterna tenta de novo sozinho. Para forçar, toque em **Tentar agora**.
- **local**: sessão de exemplo, que só existe neste computador.
- **encerrada**: o grupo foi encerrado.

### Ajustes em Preços e Checkout

- **Tempo da tela final do Checkout**: Configurações › Preços e Checkout › aba Checkout › "Tempo da tela final com o QR (segundos)". Padrão 40, de 5 a 120.
- **Preços da galeria online (v99)**: os mesmos do balcão, dos produtos que vendem online (tabela da seção 3). O cliente escolhe as fotos e a galeria monta o mais barato: até 3 fotos, PACOTE ZONA MISTA; de 4 em diante, mais uma foto adicional por foto, até ficar mais caro que Todas as fotos digitais.

### Ver as vendas da galeria

Em **Lista de vendas**, use o filtro **Canal: Online**. A compra online paga na Imply aparece como **Imply online** (v99), com o código do pedido (ON-...). As compras simuladas do servidor de teste aparecem como **teste** e ficam fora da receita.

Como o cliente compra online (v99): escolhe as fotos na galeria, informa nome, e-mail e CPF (ou passaporte, se for estrangeiro) e paga no checkout da Imply, com Pix ou cartão. Ao voltar, a galeria espera a Imply confirmar e libera as fotos. Se ele fechar a página depois de pagar, a Nuvem confere sozinha e manda o link das fotos por e-mail.

---

## 5. Administração (Usuários e Permissões)

Fica no grupo **Sistema**. **Usuários** é o cadastro da equipe. **Permissões** é onde se decide o que cada pessoa vê e faz. Só o admin vê as duas telas.

### As quatro palavras

Em Permissões, cada parte do sistema tem quatro caixas:

| Caixa | Quer dizer |
| --- | --- |
| **Criar** (C) | incluir algo novo |
| **Ver** (R) | abrir a tela e consultar |
| **Alterar** (U) | mudar o que já existe |
| **Excluir** (D) | apagar ou cancelar |

As letras vêm do inglês (Create, Read, Update, Delete). Embaixo do nome de cada parte, uma linha explica o que cada caixa faz ali. Exemplo: em Números de vendas, **Excluir** é cancelar venda. Um traço no lugar da caixa quer dizer que ela não se aplica àquela parte.

### Cadastrar uma pessoa

1. Abra **Sistema** › **Usuários** › **Novo usuário**.
2. Escreva o nome e o usuário. Se você tiver a permissão em Senhas de acesso, a tela mostra uma senha provisória para entregar à pessoa.
3. Se for fotógrafo, escolha o nome dele em **Fotógrafo vinculado**.
4. Em **Perfil**, escolha um perfil pronto (tabela abaixo). Se ainda não souber o que liberar, escolha **Sem acesso ainda**.
5. Toque em **Criar acesso**.

Para começar igual a alguém da equipe, escolha a pessoa em **Começar com as permissões de…** antes de **Criar acesso**. A tela mostra o que a pessoa nova vai ter e o que ficou de fora.

Quem entra com "Sem acesso ainda" vê a mensagem "Seu acesso ainda não foi liberado" até alguém liberar em Permissões.

### Dar ou tirar acesso

1. Abra **Sistema** › **Permissões** › aba **Por usuário**.
2. Busque a pessoa pelo nome ou e-mail e toque nela.
3. **Jeito rápido:** escolha um **Perfil pronto**, toque em **Aplicar perfil** e depois em **Salvar**.
4. **Jeito fino:** em cada linha, marque o que a pessoa pode fazer.
   - Marcar Criar, Alterar ou Excluir marca **Ver** sozinho.
   - Desmarcar **Ver** limpa a linha inteira e tira as telas dela do menu.
   - Em Permissões, Ver e Alterar andam juntos.
5. Com **Ver** marcado, aparece **Aparece no menu:** embaixo da linha. Marque as telas que a pessoa deve ver. Tela desmarcada some do menu dela e não abre nem pelo link.
6. Em **Tela inicial**, escolha a tela que abre quando ela entra. **Padrão** deixa o sistema decidir.
7. Toque em **Salvar**. Enquanto não salvar, aparece **alterações não salvas**. **Descartar** volta como estava.

Ao mudar uma caixa à mão, o perfil vira **Personalizado**. É normal.

### Copiar permissões de outra pessoa

1. Em **Permissões**, toque na pessoa e depois em **Copiar permissões de…**.
2. Escolha de quem copiar. Vêm as caixas de cada parte, o menu e a tela inicial. Nome, e-mail e status não mudam.
3. Confira a lista **O que muda**. Nada é gravado antes de confirmar.
4. Se a outra pessoa tiver acessos que você não tem, eles ficam de fora e aparecem no aviso **Ficou de fora**. O resto é copiado.
5. Toque em **Confirmar e salvar**. A cópia fica no Histórico, com de quem foi copiada.

As regras de sempre valem: você não dá o que não tem, não muda quem tem mais acesso que você e não tira de você mesmo Usuários e Permissões.

### O que o sistema não deixa fazer

- Tirar de você mesmo o acesso a Usuários ou a Permissões. Peça a outro administrador.
- Ficar sem nenhum administrador ativo.
- Dar a alguém um acesso que você não tem.
- Mudar quem tem mais acesso do que você. A pessoa abre só para ver, com o aviso "Esta pessoa tem acessos que você não tem".

### Desativar, reativar e excluir

1. Abra **Usuários** e toque na pessoa.
2. **Desativar** corta o acesso na hora. Se ela estiver no sistema, volta para a tela de login. É o caminho recomendado.
3. **Reativar** devolve o acesso como estava.
4. **Excluir acesso** apaga o cadastro. Toque e depois confirme em **Confirmar exclusão**. **Cancelar** desiste.

Na sua própria linha não aparecem Desativar nem Excluir.

### Histórico

A aba **Histórico** em Permissões mostra toda mudança: quando, quem mudou, a ação, a pessoa e o que mudou. Dá para buscar por nome ou mudança. Exclusão também fica registrada, com quem era a pessoa.

### Perfis prontos

| Perfil | Vê | Não vê |
| --- | --- | --- |
| Admin | tudo, inclusive Usuários e Permissões; começa no Painel | nada fica de fora |
| Fotógrafo | Diário do set, Minhas fotos (com a troca de fotógrafo e o envio das fotos do cartão pela tela), Fila do fotógrafo, Escala | Checkout, Dashboard, Curadoria, Configurações |
| Atendimento e venda | Checkout, Posto de venda (com o Caixa e a Venda manual dentro dele), Preços (só para ver), Fila do fotógrafo (só para ver) | Dashboard (vendas, números, fotógrafos), Curadoria, Usuários |
| Validador | Qualidade, Treino da IA, Diário do set (só para ver) | vendas, Checkout, Configurações |
| Supervisor | Posto de venda, Dashboard (começa no Painel), Curadoria (só para ver), grupo Fotógrafo (envia as fotos do cartão pela tela em nome de um fotógrafo), Configurações (Preços e Checkout com os Fundos de IA, Ajuste automático) | o grupo Sistema (Usuários, Permissões, Repositório, Identidade, Laboratório); não cancela venda |
| Checkout | só a tela do cliente, em tela cheia | todo o resto |

A aba **Perfis prontos** mostra cada perfil em detalhe.

---

## Novidades da v81

- **Checkout no segundo monitor.** "Abrir Checkout" abre uma janela separada. Arraste essa janela para o monitor do cliente. A sua tela continua logada no admin. Se o cliente apertar Esc ou mexer no endereço da janela dele, o Checkout volta ao início e o seu login não cai.
- **Fundos de IA.** O cliente vê só 5 fundos: Noite de campeão (sem a taça), Mirante ao pôr do sol, Arquibancada 1950 em preto e branco, Saída do túnel e Telão do Maracanã (desde a v97, no lugar do Pódio de campeão). Os outros ficam em Sistema › Laboratório › Fundos em teste, onde o admin pode Ativar ou Mover para o Laboratório.
- **Bandeiras.** As imagens foram corrigidas. A bandeira que ainda não tem a imagem certa fica sem foto, de propósito, até a imagem certa chegar.
- **Fotógrafos.** Klassius e Sandessa já estão na lista.

## Novidades da v82

- **Bandeiras.** 30 bandeiras ganharam imagem da Wikipedia; são só referência, não a bandeira física.

---

## Novidades da v83

Cada vendedor trabalha num notebook com a DNP RX1HS ao lado. A tela do vendedor é o **Posto de venda**. Ao tocar em **Abrir Checkout**, o Checkout abre na outra janela (para o monitor do cliente) e você cai no Posto de venda.

### Preparar o notebook (TI do ponto, uma vez)

1. Instale o driver da DNP DS-RX1HS e ligue no USB. Em **Configurações › Impressoras › DNP › Preferências de impressão**, escolha o papel **PR 4×6 (10×15)**.
2. Deixe a **DNP como impressora padrão** e desligue "Permitir que o Windows gerencie minha impressora padrão" (senão o Windows troca a padrão sozinho).
3. Crie um atalho **Eterna** na Área de Trabalho com o destino `"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir=C:\Eterna\chrome --kiosk-printing --unsafely-treat-insecure-origin-as-secure=<endereço do servidor do ponto> <endereço do servidor do ponto>/#posto` e abra o Eterna sempre por ele. O `--user-data-dir` dá ao Eterna um Chrome só dele, que abre sempre como processo novo: sem isso, se outro Chrome estiver aberto (até em segundo plano), o `--kiosk-printing` é ignorado e a janela de impressão aparece. Com `--kiosk-printing`, a foto sai direto na DNP. O `--unsafely-treat-insecure-origin-as-secure` libera a câmera enquanto o endereço não tem certificado. O atalho abre o **Posto de venda** (`/#posto`): o vendedor entra com usuário e senha e abre o Checkout pelo botão **Abrir Checkout**. Com `--kiosk-printing` a prévia de impressão do Chrome aparece por um instante e fecha sozinha: não precisa clicar. Para conferir: `chrome://version` mostra `--kiosk-printing` na linha de comando. O jeito mais fácil de criar o atalho é dar duplo clique em `servidor/posto/preparar-posto-eterna.cmd` (cria os dois atalhos e confere a impressora padrão; para mandar por e-mail, vai zipado), ou o script `servidor/posto/criar-atalho-eterna.ps1` (uma vez por máquina; `-AoLigar` também abre o Eterna quando o Windows entra).
4. O posto imprime na DNP ligada nele quando o servidor tem `ETERNA_IMPRESSORA_POSTOS="*=local"` (veja a documentação técnica).
5. O `preparar-posto-eterna.cmd` também instala o **programa de impressão**: a foto vai direto para a DNP, sem a prévia do Chrome aparecer. Ele liga sozinho com o Windows, escondido. Se ele estiver parado, o Eterna imprime pelo Chrome como antes (a prévia pisca e fecha sozinha).
6. Sem arquivo anexo: no PowerShell do posto, a linha abaixo baixa o instalador do ramo `idiomas-base` e roda (foi assim que o posto do Bernardo foi instalado em 10/11, e é o que foi mandado ao Bernardo e ao Rafael):

   ```powershell
   $f="$env:TEMP\preparar-posto-eterna.cmd"; Invoke-WebRequest "https://raw.githubusercontent.com/dudurezende10/eterna/idiomas-base/servidor/posto/preparar-posto-eterna.cmd" -OutFile $f -UseBasicParsing; cmd /c $f
   ```
3. Com `--kiosk-printing`, tudo o que for impresso nesse Chrome sai na DNP. Cartaz A4 de grupo de escola: imprima no computador do ponto.

### O que tem no Posto de venda

- **Agora no Checkout**: o que o cliente está vendo e escolhendo, ao vivo.
- **Aguardando pagamento**: as escolhas do Checkout esperando você escolher o pacote, a forma de pagamento e confirmar. No pedido que o monitor do cliente está esperando aparece o botão **Recomeçar o Checkout**.
- **Impressão 10×15**: as vendas pagas, com as fotos para imprimir já marcadas, e o contador do rolo.
- **Minhas vendas de hoje**: as suas vendas neste notebook, com o valor de cada uma. Não mostra total. O botão **Recibo** abre o recibo com o QR em cima do Posto.
- **Caixa** (botão amarelo no alto do menu): o mesmo Posto só com o dinheiro esperando confirmação. **Dinheiro ✕** volta ao Posto completo.
- **Venda manual (quando o Checkout está fora)**: link no fim do Posto. Abre um bloco no alto da própria tela, com a câmera do balcão, o código da sessão, as fotos, o pacote, o Fundo de IA e o pagamento. **Fechar venda manual** fecha o bloco. Com uma sessão aberta na Venda manual, os botões Recibo ficam apagados até você fechar.
- **Cliente pediu: apagar as fotos** (LGPD): fica na Venda manual, depois de escolher a sessão, para quem pode alterar as Galerias online. Pede confirmação e não dá para desfazer. Desde a v97, as fotos compradas e as cortesias ficam com o cliente e a galeria paga continua aberta (passo a passo em **Novidades da v97**).
- As telas **Fila do balcão** e **Caixa** separadas saíram: tudo é feito no Posto de venda.
- **Aviso da Edição Maracanã** (foto com fundo de IA): a montagem ainda não vai para a galeria do QR, então o cliente só recebe se ela for impressa. Quando o pedido tem montagem, os pacotes só digitais (Zona Mista e Maracanã Mais) aparecem com o selo "sem a Edição Maracanã" e, se você escolher um deles, um aviso amarelo aparece abaixo dos pacotes: ofereça um pacote com impressão. O aviso também aparece quando as montagens não cabem nas impressões do pacote. Ele não trava a venda. Na Venda manual, o aviso aparece sempre que um Fundo de IA é escolhido.

### Confirmar na maquininha

1. Desde a v96 o cliente só escolhe as fotos. A compra aparece em **Aguardando pagamento** com o código e as fotos. Escolha o pacote e a forma de pagamento (Cartão, PIX ou Dinheiro); o cliente vê o valor na tela dele.
2. Digite o valor na maquininha e espere aprovar.
3. Toque em **Pago na maquininha**. É o botão principal do pedido, o maior.
4. Se quiser, digite o **NSU ou a autorização** do comprovante (só números, de 4 a 12). É opcional.
5. **Nunca digite o número do cartão.** Se aparecer "Isso parece número de cartão", apague e digite só o NSU.
6. Toque em **Confirmar R$ X**. O Checkout mostra o QR para o cliente.
7. Dinheiro: receba e toque em **Recebi R$ X**.
8. Se o cliente desistir ou a maquininha recusar de vez, toque no link vermelho **Cancelar compra** e depois em **Sim, cancelar**. O link fica afastado do botão principal, para ninguém tocar sem querer. O Checkout dele volta ao início.

### Imprimir

1. Depois de confirmar, a venda aparece em **Impressão 10×15** com as fotos já marcadas (favoritas primeiro, até o número de impressas do pacote). Fotos com fundo de IA também imprimem.
2. Para trocar quais imprimir, toque nas fotos.
3. Toque em **Imprimir N fotos (10×15)**.
4. Pegue as fotos na DNP e confira.
5. Saíram boas: toque em **Saiu certo**. Só aqui o rolo baixa.
6. Não saíram (papel, cor, travou): toque em **Não saiu** e imprima de novo. O rolo não baixa.
7. Se aparecer "Não deu para montar o fundo: tente de novo", imprima de novo; só a foto com fundo de IA ficou de fora.

### Reimprimir

1. Na venda já impressa, toque em **Reimprimir**.
2. Marque as fotos que vão sair de novo.
3. Escolha o motivo: Falhou, Outra cópia, Cor ou Outro.
4. Toque em **Reimprimir N fotos**. Nos postos com o programa de impressão, a DNP confere e a reimpressão é registrada sozinha; sem ele, toque em **Saiu certo** ou **Não saiu**.

### Trocar o rolo de 700

1. O rolo da DNP faz cerca de 700 fotos. O contador "Rolo: X de 700" fica no alto do Posto de venda.
2. Com 100 ou menos, o contador fica amarelo: separe um rolo novo. Abaixo de 40, fica vermelho piscando, aparece uma faixa vermelha no alto do Posto de venda e do Caixa ("Rolo acabando: faltam N fotos") e um alerta grave em **Alertas**. Troque antes do pico.
3. Quando a impressora avisa um problema (papel ou fita no fim, tampa aberta, papel enroscado), a faixa fica vermelha cheia com o aviso da própria DNP.
4. Nos postos com o programa de impressão, o contador é o da própria DNP e a troca de rolo é percebida sozinha: não precisa registrar.
5. Troque o rolo e a fita na DNP.
6. Sem o programa de impressão, registre a troca: no Posto de venda (veja **Troquei o rolo** logo abaixo) ou em **Dashboard › Estoque**, em **Registrar troca de rolo** (no Estoque, só quem tem permissão de editar Estoque). O contador volta a 700.

### Troquei o rolo (v96)

1. Só num aparelho configurado como posto: toque no selo **Rolo: X de 700** no alto do Posto de venda (o Caixa é a mesma tela) ou no painel **Impressão 10×15** do Dashboard. Com o rolo abaixo de 40, o botão **Troquei o rolo** aparece ao lado do selo no alto do Posto de venda. Em aparelho não configurado como posto, o selo só mostra o contador: registre a troca em **Dashboard › Estoque**.
2. O Eterna pergunta "Trocou o rolo da impressora deste posto? O contador volta para 700." Toque em **Sim, troquei** ou em **Cancelar** (Cancelar não muda nada).
3. Vale só para o posto deste computador. A troca de outro posto se registra no próprio posto ou em **Dashboard › Estoque**.
4. Quem vende (permissão de criar em Venda) pode registrar a troca do próprio posto, mesmo sem acesso ao Estoque. Cada troca fica no registro de auditoria com quem fez, o posto e o valor que o contador tinha. Uma troca de hoje com mais de 60 impressões sobrando aparece em **Alertas** como grave, com o posto, quem fez e o valor.
5. Os valores que vêm na instalação (58, 142 e 171) são de demonstração. Antes de usar no balcão, registre a troca em cada posto com um rolo novo.

### Outras mudanças

- O cliente não vê mais "2 minutos" nem contagem na tela de pagamento.
- Confirmar o pagamento não baixa mais o estoque; quem baixa é o **Saiu certo**.
- O número da venda tem o formato `L0-012`.

## Novidades da v84: fundos de IA montados no próprio computador

As fotos com fundo de IA agora são montadas no computador do ponto, sem internet e sem custo. O computador do ponto recorta a pessoa e o Eterna coloca no fundo com as regras aprovadas (meio corpo encostado embaixo, corpo inteiro do joelho para cima, a Arquibancada 1950 toda em preto e branco). Vale para a prévia, o Checkout, o Posto de venda e a impressão 10×15.

### Instalar o recorte (TI do ponto, uma vez por computador)

1. Use um computador com **16 GB de memória**. Desde a v97 o recorte é mais pesado: com menos de 6 GB de memória livre ele não abre.
2. Na pasta do agente, dê dois cliques em **instalar-recorte.command** (Mac) ou **instalar-recorte.bat** (Windows). Ele cria um ambiente separado do Eterna (`Eterna/venv`, na pasta do usuário), instala as versões testadas do recorte e baixa os modelos (cerca de 1,3 GB na v97). No servidor do estádio, com placa de vídeo, a TI roda `instalar-recorte.bat gpu`. Precisa de internet só nesta hora. Depois disso, o Eterna.command e o iniciar-eterna.bat abrem o agente por esse ambiente.
3. Feche o agente e abra de novo (Eterna.command ou iniciar-eterna.bat). Na janela do agente aparece **Recorte local: pronto**.
4. Em **Sistema › Fundos de IA (técnico)**, o quadro **Recorte local** mostra "pronto" e, depois das primeiras fotos, o tempo médio por foto.

Se o recorte não estiver instalado, o Checkout não oferece foto com fundo de IA e o quadro mostra o motivo. Enquanto a foto está sendo montada, o cliente vê "Preparando sua foto especial..."; se a montagem falhar, a foto sai da venda. As outras fotos seguem normais.

Os recortes ficam guardados no computador por 2 dias e depois são apagados sozinhos.

### Tempo

A primeira foto do dia demora mais (o agente abre os modelos). Depois, cada foto leva alguns segundos; o recorte fica guardado e não é refeito na impressão.

### Photoroom

Desde a v97 o Photoroom saiu das opções da tela. O recorte é sempre feito no computador do ponto. A chave do Photoroom continua guardada, sem uso.

## Novidades da v86: fundo Pódio de campeão

**Na v97 o Pódio de campeão saiu dos fundos do cliente e deu lugar ao Telão do Maracanã.** Ele está em Sistema › Laboratório › Fundos em teste. O texto abaixo vale se a administração ligar o Pódio de novo.

O cliente ganhou um 5º fundo de IA: **Pódio de campeão**. Estádio lotado em verde e amarelo, confete, um pódio dourado e uma taça à direita.

- **Já vem ligado.** Não precisa fazer nada. Se o ponto já tinha uma escolha de fundos salva com 1 a 4 fundos, o Pódio entra sozinho na lista, uma vez só.
- **Se a lista estava vazia de propósito**, continua vazia. Para ligar, use Configurações › Preços e Checkout › aba Fundos de IA.
- **Se a administração tirar o Pódio**, ele não volta sozinho.
- **Como a foto sai.** A pessoa fica em cima do pódio, um pouco à esquerda, e nunca cobre a taça do fundo. Foto de corpo inteiro vira do joelho para cima, como no Campeão, no Mirante e no Túnel.
- **Anfitrião e vendedor.** Na hora de oferecer, vale mostrar a prévia do Pódio para quem tirou foto comemorando ou segurando a taça. A taça que o cliente segura sai junto no recorte. A taça do fundo é outra e fica sempre à vista.
- **Impressão 10×15.** Funciona igual aos outros fundos.

## Novidades da v87: Fila do fotógrafo

Fica em **Fotógrafo › Fila do fotógrafo**, logo abaixo de Minhas fotos. É um painel, como a Fila de impressão, que mostra as fotos chegando ao servidor, separadas por fotógrafo. Ninguém precisa apertar nada: o fotógrafo só fotografa e o painel se atualiza sozinho a cada 2 segundos. Veem: Admin, Supervisor, Fotógrafo e Atendimento e venda.

### As três colunas

| Coluna | Quer dizer |
| --- | --- |
| **Clicando agora** | o fotógrafo ainda está fotografando esse grupo |
| **Chegando** | ele parou de clicar e as fotos ainda estão subindo para o servidor (fila do Wi-Fi ou leitura de cartão) |
| **Já no Checkout** | as fotos estão no servidor e os rostos já foram lidos: a selfie do Checkout já acha o cliente |

Um grupo vai para **Já no Checkout** 1 minuto depois da última foto e depois da leitura dos rostos (v91: cada grupo da Fila é uma sessão). Sai da tela 15 minutos depois.

Com a câmera mandando direto pelo FTP, **Chegando** pode durar só alguns segundos. É normal.

### O que cada cartão mostra

- O nome do fotógrafo em letra grande e, entre parênteses, de onde ele está fotografando: **(campo · Foto Campo 2)**, **(volante · chute a gol)**, **(set interno · Vestiário)** ou **(sem ponto)**. O ponto vem da **Escala** (função do dia). Trocou a função na Escala, os grupos seguintes já mostram o ponto novo; os que já estavam na tela não mudam.
- A hora em que o grupo começou e quantas fotos tem.
- Nas duas primeiras colunas, as últimas fotos que chegaram, em miniatura (no computador da equipe; na TV, não).
- **De folga na Escala e mandando fotos**, em vermelho: a pessoa está de folga na Escala e as fotos dela estão chegando. Confira a Escala.
- **Sem fotógrafo · câmera ···1234**: o Eterna não sabe de quem é a câmera (veja abaixo). Os 4 números são o final da série do corpo.

### Na TV do caixa

1. Abra o Eterna na TV pelo endereço do servidor do ponto e entre com o login de Atendimento e venda.
2. Abra **Fila do fotógrafo** e toque em **Tela cheia**. O menu some.
3. Na TV as miniaturas ficam **desligadas**: no login de Atendimento e venda e em qualquer tela cheia (o botão, o F11 ou o modo quiosque). São rostos de turistas e de crianças, e uma TV virada para a fila mostraria as fotos de graça. Só Admin e Supervisor veem o botão **Miniaturas neste aparelho**, que liga ou desliga naquele aparelho; a escolha fica guardada nele e registrada no histórico.
4. Para sair da tela cheia, aperte **Esc** ou toque em **Sair da tela cheia**.

Se aparecer **O computador do ponto não está respondendo. Chame a TI.**, o painel continua mostrando o último dado (a hora dele aparece embaixo). Confira se o computador do ponto está ligado.

### Para aparecer o nome do fotógrafo (TI e fotógrafos)

O Eterna descobre o fotógrafo, nesta ordem: pelo usuário do FTP da câmera; pela subpasta do FTP (só se a subpasta tiver o nome de um fotógrafo cadastrado); pelo nome gravado na câmera. Câmera sem usuário próprio no FTP (cartão, FTP do estádio sem subpasta) aparece como **Sem fotógrafo**. Para resolver:

- Grave o nome do fotógrafo na câmera, em **Informações de copyright › Nome do autor** (Canon). Use o mesmo nome do cadastro (Carlos, Yago, Marinara...).
- No FileZilla (pasta vigiada), crie uma subpasta por fotógrafo, com o nome dele.

### O que ainda não tem

- O código LP da sessão não aparece nesta versão. Ele entra quando a sessão passar a ser montada no servidor.
- Se o Checkout estava fechado quando as fotos chegaram, a TV pode mostrar o grupo em **Já no Checkout** e o Checkout ainda não achar o cliente. Isso também se resolve quando a sessão passar a ser montada no servidor.
- Fotos de teste do modo demonstração não entram na fila. As fotos do envio manual (parte 2) entram, como fotos de cartão.

## Novidades da v92: Estatísticas e Calendário de eventos

Duas telas novas. **Estatísticas** junta os números de vendas, fotógrafos, rapidez, dias e movimento da bilheteria. **Calendário de eventos** guarda os jogos, shows, feriados e dias de estádio fechado, para comparar um dia com o outro.

O Eterna **não faz controle de ponto**. Não marca presença, falta nem atraso. Isso continua no sistema do RH.

### Quem vê o quê

| Pessoa | Estatísticas | Calendário de eventos |
| --- | --- | --- |
| Admin | vê e importa as entradas da bilheteria | vê e edita |
| Supervisora | não vê | vê e edita (sem a chave da API de jogos) |
| Fotógrafo, Atendimento e venda, Validador, Checkout | não veem | não veem |

### Usar as Estatísticas (Admin)

1. No menu, abra **Dashboard › Estatísticas** (logo abaixo do Painel).
2. Escolha o período: **Hoje**, **Ontem**, **7 dias**, **30 dias** ou **Personalizado**. Os dias seguem o horário do Rio. Dá para ver até um ano.
3. Toque na seção que quer ver: **Vendas e produtos**, **Fotógrafos**, **Rapidez**, **Dias e eventos**, **Visitantes** ou **Movimento**.
4. **Com histórico Roverpix**: ligado, os números por dia incluem os dias que vieram da Roverpix. Desligado, só o que passou pelo Eterna.

Os números vêm do servidor do ponto e somam todos os caixas. Sem o servidor, aparece "Sem conexão com o servidor do ponto". Se aparecer "O relógio do servidor do ponto está em outro fuso", avise a TI: as horas ficam erradas até ajustar o computador servidor.

### O que significa cada número

**Vendas e produtos**
- **Faturamento, Vendas, Sessões e Fotos**: o total do período.
- **Produtos**: quanto vendeu cada pacote e cada item, pelo valor cobrado. Vendas de antes da v92 aparecem numa nota como "sem detalhe de produto", porque o sistema ainda não guardava o carrinho.
- **Pagamento e posto**: quanto entrou por cartão, PIX e dinheiro, e por ponto de venda.
- **Vendas por hora**: a hora em que a venda foi paga, das 8 às 20 h.
- **Por dia da semana**: a média de vendas por dia em cada dia da semana.
- **Hora × dia da semana**: a tabela que mostra os horários mais fortes de cada dia.

**Fotógrafos** (só produção)
- **Dias com produção**: dias em que o fotógrafo teve fotos ou sessões no servidor. Não é presença.
- **Sessões e Fotos**: quantas sessões ele abriu e quantas fotos tirou.
- **Fotos por sessão**: a média de fotos em cada sessão.
- **Vendas e Conversão**: quantas vendas saíram das sessões dele e quantas sessões, em cada 100, compraram.
- **R$ por sessão**: quanto cada sessão dele rendeu, em média.
- **Faturamento**: o total vendido das sessões dele.
- **Clique → Checkout**: o tempo típico entre a última foto da sessão e ela aparecer no Checkout.
- Toque no título da coluna para ordenar. Toque no nome para ver o dia a dia dele.

**Rapidez**
- **Cliente no Checkout**: do momento em que o cliente sai da tela inicial até pedir o pagamento.
- **Confirmação pelo vendedor**: do pedido no Checkout até o vendedor confirmar o pagamento. Abaixo, o mesmo tempo por vendedor.
- **Clique até o Checkout**: da última foto da sessão até ela aparecer no Checkout.
- **Câmera até o servidor**: do clique até a foto chegar ao servidor.
- **Mediana**: metade dos casos foi mais rápida que isso. **p90**: 9 em cada 10 casos foram mais rápidos que isso. **n**: quantos casos foram medidos.
- **Impressão** aparece como "sem dado ainda". Entra numa próxima versão.

**Dias e eventos**
- Junta os dias em grupos: com jogo ou sem jogo, por time mandante, por competição, por tipo de evento, fim de semana ou dia útil, feriado ou não.
- Cada linha mostra quantos dias entraram no grupo e a média por dia: faturamento, vendas, sessões, ticket, conversão, outras línguas e entradas.
- **poucos dias**: o grupo tem menos de 3 dias. Ainda não dá para tirar conclusão.
- Embaixo, o **Dia a dia** com o evento de cada dia. Os eventos vêm do Calendário de eventos.

**Visitantes**
- **Idioma no Checkout**: o idioma que o cliente escolheu na tela do Checkout. "Outras línguas" é provável estrangeiro. Vendas no balcão não entram.
- **Ticket por idioma**: quanto gasta, em média, quem escolheu cada idioma.

**Movimento**
- **Total** e **Média por dia**: quantas pessoas entraram, pelo bip ou pela catraca.
- **Pessoas por hora**: quantas entraram em cada hora.
- **Pico do minuto** e **Pico de 15 min**: o momento de maior entrada. Exemplo: "pico 10:41, 9 pessoas".
- **Por minuto aberto**: a média de pessoas por minuto, entre a primeira e a última entrada.
- **Funil**: entradas, sessões, vendas e quanto cada visitante rendeu.
- **Retrato de outubro**: as catracas de 07 a 15/10, já importadas. Fica separado do período escolhido.

### Importar as entradas do bip (Admin)

Hoje a equipe faz um bip por convidado na chegada. As catracas estão previstas até o fim do ano. O arquivo do bip vem da TI.

1. Peça à TI o arquivo do bip em CSV.
2. Confira que o arquivo tem a coluna **data_hora** (exemplo: 05/11/2026 10:41:12, no horário do Rio) e a coluna **origem** (bip ou catraca). As colunas podem ser separadas por ; ou por ,.
3. Em **Estatísticas › Movimento**, toque em **Importar CSV de entradas** e escolha o arquivo (até 5 MB).
4. Veja o resumo: quantas linhas entraram e as primeiras linhas recusadas, com o motivo.
5. Em **Últimas importações** fica quem importou, quando, o arquivo e quantas linhas entraram.

Bom saber:
- As outras colunas do arquivo (ingresso, documento, nome) ficam no seu computador. Só a data, a hora e a origem vão para o servidor.
- Importar de novo o mesmo dia substitui o que havia. Não soma em dobro.
- Num dia com bip e catraca, o total usa a catraca.

### Cadastrar o calendário (Admin e Supervisora)

1. No menu, abra **Dashboard › Calendário de eventos** (desde a v97; antes ficava no grupo Fotógrafo). O atalho também fica em **Configurações › Preços e Checkout**, aba **Checkout**.
2. Use **‹** e **›** para trocar de mês e **Hoje** para voltar ao mês atual.
3. Toque em **Novo evento**. Preencha a data, a hora, o tipo (jogo, show, feriado, fechado, evento ou outro), o mandante, o visitante, a competição e, se quiser, uma observação.
4. Toque em **Salvar**.
5. Para mudar, toque no evento no mês ou em **Editar** na lista **Eventos do mês**. Para tirar, toque em **Apagar** e confirme.
6. Feriados entram sozinhos (v97): os nacionais, o Carnaval, a Sexta-feira Santa, o Corpus Christi e os do Rio (20/01, 23/04 e 20/11), deste ano e do próximo. O botão **Adicionar feriados de AAAA** só aparece quando o aparelho não está ligado ao servidor do ponto.
7. Para cadastrar muitos jogos de uma vez, toque em **Colar lista** e cole as linhas copiadas da planilha (Google Sheets ou Excel), na ordem data, hora, tipo, mandante, visitante, competição, observação. Ou toque em **Importar CSV**. O arquivo tem as colunas `data;hora;tipo;mandante;visitante;competicao;obs`, até 2000 linhas. O mesmo jogo importado de novo atualiza, não duplica.

Bom saber:
- Escreva o nome do clube como aparece na lista (Flamengo, Fluminense, Vasco...). Assim os dias se juntam no mesmo grupo nas Estatísticas.
- Use **fechado** para os dias de estádio fechado.
- Toda mudança fica registrada com o seu nome.
- Jogos no Maracanã entram sozinhos pela API-Football (v97) toda segunda às 06:00, depois que o Admin salvar a chave da API-Football em **Configurações › Preços e Checkout**, aba **Checkout**. Sem ela, a linha do Calendário diz "Jogos: fonte não configurada, peça ao Admin". **Atualizar jogos agora** busca na hora. Shows e outros eventos continuam por **Novo evento**, **Colar lista** ou CSV.
- A coluna **Origem** mostra "Automático · feriados", "Automático · jogos", "Manual" ou "Importado". Evento automático que você edita ou apaga não volta a ser mudado pelo servidor.
- Se aparecer o aviso **Este aparelho não está ligado ao servidor do ponto**, você está vendo só o que foi salvo neste navegador. O que criar sobe quando abrir o Eterna pelo servidor (no estádio ou pelo Tailscale).

### Chave da API-Football (só o Admin)

1. Crie a conta em dashboard.api-football.com (o plano grátis dá 100 consultas por dia) e copie a chave.
2. Abra o Eterna **pelo servidor do ponto** (no estádio ou pelo Tailscale) e vá em **Configurações › Preços e Checkout** e toque na aba **Checkout**. Logo abaixo do painel **Checkout** fica **Calendário de eventos · fonte dos jogos**. Só o Admin vê esse painel. A Supervisora e os outros perfis não veem, e o Calendário de eventos não mostra a chave.
3. Cole a chave e toque em **Salvar chave**. A tela passa a mostrar "Chave configurada ····" com os 4 últimos caracteres, quando e por quem foi salva.
4. Toque em **Testar agora**: aparece se a temporada atual veio e quantos jogos no Maracanã. Dá para testar uma vez por minuto.
5. **Trocar chave** e **Remover** ficam no mesmo bloco. Tudo fica no registro de alterações, sem a chave.

A chave fica só no servidor do ponto. Ela não aparece na tela, no navegador, no backup nem no registro.

Para não gastar as consultas do plano, o servidor busca os jogos no máximo a cada 10 minutos e para sozinho quando o plano do dia está perto do fim. Se uma busca não der certo, ele tenta de novo sozinho depois de 6 horas.

### Jogos e ano a ano (Estatísticas, só o Admin)

Desde 10/11/2026 o servidor guarda uma linha por dia: tipo do dia (estádio fechado, jogo, show, evento, feriado, véspera de jogo ou normal), visitantes, vendas, fotos e conversão. Em **Estatísticas › Jogos e ano a ano**:
- a faixa do topo diz se a visitação está **subindo**, **caindo** ou **estável** nos últimos 28 dias;
- os cartões comparam **Dia de jogo** com **Dia normal**, e a frase embaixo compara cada jogo com os dias normais do mesmo dia da semana;
- **Mês a mês** compara o ano escolhido com o anterior; **Baixar dias (CSV)** exporta o ano.

O total de visitantes por dia da bilheteria entra em **Estatísticas › Movimento › Importar total por dia (bilheteria)**, com um CSV `dia;total`.

### Fotógrafo: novo login a cada dia

Quem entra com perfil de fotógrafo precisa entrar de novo no dia seguinte. Ao abrir o Eterna num dia novo, ou se ele ficou aberto na virada da meia-noite, aparece "Novo dia: entre de novo". Entre com o e-mail e o código, como sempre. É só segurança da conta. Não marca ponto.

## Novidades da v97

Resumo do que mudou. Os passos estão nas partes indicadas.

| Para quem | O que mudou | Onde ler |
| --- | --- | --- |
| Vendedor e caixa | Uma tela só para vender: o **Posto de venda**. O **Caixa** e a **Venda manual** ficam dentro dele. | parte 3 e **O que tem no Posto de venda** |
| Vendedor e caixa | **Recomeçar o Checkout** fica no notebook do caixa. O cliente não tem mais **Voltar ao início** enquanto espera o pagamento. | parte 3, **Recomeçar o Checkout** |
| Vendedor e caixa | **Pago na maquininha** é o botão principal. **Cancelar compra** virou um link vermelho, afastado. | **Confirmar na maquininha** |
| Vendedor e caixa | Aviso quando o pedido tem foto Edição Maracanã e o pacote é só digital. | **O que tem no Posto de venda** |
| Fotógrafo | Nome e ponto vêm do login e da Escala. **Minhas fotos de hoje** por sessão. Escala com **Hoje você está em:**. | parte 2 |
| Fotógrafo e supervisora | Envio das fotos pela tela quando o cartão não é lido. | parte 2, **O cartão não foi lido** |
| Todos | Faixa vermelha com a hora do último dado quando o computador do ponto não responde. | parte 1 |
| Supervisora e Admin | **Calendário de eventos** foi para o grupo **Dashboard**. | **Cadastrar o calendário** |
| Admin | Chave da API de jogos, **Juntar a família pelo rosto** e modo demonstração ficam só com o Admin. | **Chave da API-Football** e abaixo |

### Selo Edição Maracanã

- No Checkout, as fotos com fundo de IA (as montagens) aparecem primeiro, juntas, com a faixa amarela **Edição Maracanã** e o nome do fundo (Noite de campeão, Mirante ao pôr do sol, Arquibancada 1950, Saída do túnel, Telão do Maracanã), nas 5 línguas. Na grade elas vêm com o título "Suas fotos especiais" e, depois delas, "Suas fotos de hoje".
- O Checkout abre na primeira montagem pronta. Se ela ainda estiver sendo preparada e o cliente não tocar em nada, depois de 8 segundos a tela vai sozinha para a próxima foto pronta.
- No Posto de venda, as montagens do pedido e a tela do cliente mostram a mesma faixa Edição Maracanã. A montagem continua contando dentro do pacote, igual a qualquer outra foto.
- A faixa é só da tela: a foto impressa e a do download saem sem ela.
- Atenção: hoje a montagem não vai para a galeria online. No pacote só digital (Zona Mista, Maracanã Mais) a montagem escolhida não chega ao cliente. Nos pacotes com impressão, a montagem sai impressa. Por isso o Posto avisa o caixa.
- Para o Admin: em Estatísticas, o quadro "Edição Maracanã: montagens vistas × compradas" mostra por dia quantas montagens os clientes viram no Checkout e quantas compraram.

### Fundo novo: Telão do Maracanã

O **Telão do Maracanã** entrou nos 5 fundos do cliente, no lugar do Pódio de campeão. A família aparece dentro do telão do estádio. O Pódio foi para **Sistema › Laboratório › Fundos em teste**.

### QR maior na tela final

Na tela final do Checkout, o QR ficou maior e ao lado da foto do cliente, não mais em cima dela. Dá para ler com o celular a cerca de 1 metro. Peça para o cliente fotografar o QR antes de sair.

### O Eterna abre sem internet

O computador do ponto guarda uma cópia do Eterna, das letras, dos fundos de IA e do que o Checkout precisa para achar o rosto. Se a internet cair, o Checkout e o Posto de venda continuam abrindo e vendendo pelo endereço do computador do ponto.

- A cópia é feita sozinha quando o computador do ponto liga com internet. A TI confere se ela está completa.
- O que não funciona sem internet: o celular do cliente abrir a galeria pelo QR e a busca automática de jogos do calendário.

### Cliente pediu: apagar as fotos

O link fica na **Venda manual**, depois de escolher a sessão. Na v97 mudou o que é apagado:

1. Abra o **Posto de venda** e toque em **Venda manual (quando o Checkout está fora)**.
2. Escolha a sessão do cliente pelo código ou pela lista.
3. Toque no link vermelho **Cliente pediu: apagar as fotos**.
4. Leia a pergunta **Apagar as fotos do cliente?** Ela diz quantas fotos saem e quantas ficam.
5. Toque em **Sim, apagar as fotos**. Não dá para desfazer.

Bom saber:
- As fotos que o cliente **comprou** e as **cortesias** não são apagadas. Elas ficam com ele e a galeria paga continua aberta.
- Saem as fotos que ele não comprou, e o rosto lido nelas é apagado.
- Se houver um pedido aberto no Posto usando essas fotos, cancele o pedido antes.
- Só quem pode alterar as Galerias online vê o link.

### Lista de vendas e Vendedores

- A **Lista de vendas** cabe inteira na tela do notebook: 4 cartões no alto (Vendas, Receita, Ticket e Aguardando caixa), os filtros numa linha só (Dia, Vendedor, Pagamento, Canal, Status) e 50 vendas por página, com **Anterior** e **Próxima**.
- As colunas Ponto e Fotógrafo saíram da tabela. Continuam no recibo e no CSV.
- A tela **Vendas e caixa** agora se chama **Vendedores**.
- O título de cada tela é igual ao nome dela no menu.
- O código do cliente tem um nome só em todas as telas: **Seu código**.

### Agenda e Estatísticas

- Feriados e jogos no Maracanã entram sozinhos no **Calendário de eventos** (veja **Cadastrar o calendário**).
- **Estatísticas › Jogos e ano a ano** compara dia de jogo com dia normal. Só o Admin vê.
- A chave da API de jogos fica só com o Admin, em **Configurações › Preços e Checkout**, aba **Checkout**.
- **Juntar a família pelo rosto (em teste)** fica no mesmo lugar, só para o Admin, e vem desligado. Enquanto estiver desligado, o caixa junta as fotos da mesma família pelo botão **Juntar outra leva**, no pedido do Posto de venda, e desfaz com **Separar**.

### Recorte novo dos fundos de IA

O recorte da pessoa ficou mais preciso. O que a pessoa segura, como a bandeira, fica na foto, e a pessoa nunca sai cortada. Ele roda só no computador do ponto. A TI instala uma vez, com a opção para placa de vídeo no servidor do estádio (veja **Instalar o recorte**).

### Laboratório: Chute a gol

Em **Sistema › Laboratório › Chute a gol** está a ficha de um produto em teste: a foto do cliente com o goleiro em frente à trave, segurando a placa "Fiz um gol no Maracanã" na língua dele. A tela explica onde fica, quem é o goleiro, quantos cliques e o material. Ainda não é vendido. Só o Admin vê o Laboratório.
---

## Novidades da v93: servidor do ponto com acesso por pessoa ou aparelho

O servidor do ponto só abre os dados para quem entrou com usuário e senha ou para um aparelho pareado.

- **Postos**: o aparelho da rede do ponto vira posto sozinho quando um Admin entra nele (veja "Posto automático" na parte 3). Só aparelho sem ninguém conectado precisa de pareamento.
- **Código no Checkout**: com a sessão recém-fotografada, o botão mostra "Buscando suas fotos…" por alguns segundos (veja "Cliente que volta horas depois").
- **Galeria da venda**: o aparelho pareado publica a galeria depois que o Caixa confirma o pagamento.
- **Compra pelo celular**: desligada. A galeria mostra as fotos e pede para o cliente falar com a equipe no balcão.
- **Senha provisória**: logo depois de cadastrar uma pessoa, o botão **Gerar senha provisória** espera alguns segundos o cadastro chegar ao servidor.
- **Sessão vencida**: se o login venceu e a página é recarregada, a tela volta à entrada sem o aviso "Sua sessão terminou". É só entrar de novo (detalhe conhecido).

### Para o TI (Ronaldo)

Lista de operação no servidor do ponto:

1. **Endereço com certificado.** Os aparelhos abrem o Eterna por `https://posto.eterna.photo`. No `nuvem.env`: `ETERNA_ORIGENS=https://posto.eterna.photo` (mais os endereços do Tailscale, se houver).
2. **Proxy.** O proxy na frente do Eterna repassa o `Host` original e manda `X-Forwarded-Proto: https`. Sem isso, o login e o pareamento não ficam guardados no aparelho.
3. **Parear de novo todos os aparelhos** em `https://posto.eterna.photo` (Painel de controle › Postos deste ponto). O pareamento vale por endereço: aparelho pareado em outro endereço precisa parear de novo.
4. **Abrir o app pelo endereço do servidor**, nunca por eterna.photo. Aberto por outro endereço, o app avisa "abra o Eterna pelo endereço do servidor do ponto".
5. **FTP embutido, portas passivas.** O FTP do Eterna usa só modo passivo, na faixa `ETERNA_FTP_PASV` (padrão 50000-50050). Libere essa faixa no firewall, além da porta 21. Câmera em modo ativo não envia.
6. **Outro FTP na porta 21.** Onde já houver outro servidor FTP (por exemplo o IIS do estádio), use `ETERNA_FTP=0` para desligar o FTP embutido.
7. **Teste com a câmera Canon.** Uma hora, com uma foto a cada 6 minutos e a câmera em RAW+JPEG. O FTP embutido recebe só JPEG. Se a câmera travar a fila por causa do RAW, use `ETERNA_FTP_RAW=descartar` (o RAW é recebido e descartado, sem erro).
8. **Configurações inválidas são ignoradas.** `ftp-remoto.json` com servidor fora da rede do ponto ou porta diferente de 21/990, e `roverpix.json` com endereço que não é o oficial, agora são ignorados. Confira o log do agente depois de reiniciar e, se preciso, refaça a configuração pelo Painel de controle. Servidor FTP do estádio com nome (ou IP fora da rede interna): um por linha em `~/Eterna/ftp-remoto-hosts.txt`.
9. **Status.** Sem login, o `/status` mostra só que o Eterna está no ar. Impressora, nuvem e rostos se conferem no app, com login de administrador.

---

## 6. O que dizer ao cliente

**Sobre o QR**
- "Aponte a câmera do celular para este QR. Suas fotos ficam disponíveis por 60 dias."
- "Se o QR não abrir, entre em eterna.photo/#g e digite este código."

**Sobre a selfie**
- "Antes de mostrar as fotos, o site pede uma selfie. É para garantir que só você vê as suas fotos."
- "A selfie é comparada na hora e descartada. Ela não fica guardada."
- "Tire de frente, com boa luz, sem boné e sem óculos escuros."
- "Se errar 5 vezes, o site pede para esperar 15 minutos."

**Sobre o que aparece**
- "As fotos que você comprou e as cortesias aparecem primeiro, para baixar em alta."
- "As outras fotos da sua visita aparecem com marca d'água. Dá para comprar cada uma por R$ 39, ou todas pelo preço do pacote."

**Para escola (pais e responsáveis)**
- "Aponte a câmera para o QR do comunicado e envie uma foto do rosto da criança."
- "Aparecem só as fotos em que a criança está, não a turma inteira."
- "Só a mãe, o pai ou o responsável legal deve enviar a foto."

---

## 7. Limitações de hoje

- **No celular do cliente aparece "Suas fotos estão chegando".** Nesta fase as fotos ainda ficam no computador do ponto e o celular não chega até ele. Vai funcionar quando a nuvem entrar (fase 2). Não prometa download pelo celular por enquanto.
- **Para demonstrar**, use **Abrir galeria** em Galerias online, no próprio computador do ponto. Ali a galeria funciona de verdade.
- **Compra pelo celular está desligada (v93).** A galeria mostra as fotos e pede para o cliente falar com a equipe no balcão. A venda é feita no Checkout.
- **Cartão e PIX**: o sistema ainda não conversa com a maquininha (sem TEF). Quem confirma é você, depois de ver a maquininha aprovar.
- **Checkout e Posto de venda no mesmo notebook**: nesta etapa o Checkout e o Posto de venda (com o Caixa dentro dele) precisam estar no mesmo notebook e no mesmo navegador. Os notebooks ainda não conversam entre si; isso entra na próxima etapa.
- **Ícone do celular no cartão do QR** está quase invisível na tela final. Ajuste previsto.
- **No celular (tela estreita)**, na tela "Estas fotos já foram compradas", o botão **Voltar ao início** aparece só como ícone. Ajuste previsto.
- **Cancelar uma venda do Checkout** tira o download no sistema, mas a foto pode continuar liberada no computador do ponto. Avise a administração quando cancelar.
- **Compra feita na galeria da escola** não aparece na galeria da sessão da família, e vice-versa.
- **"Baixar todas"** baixa as fotos uma por uma (ainda não há arquivo ZIP).
- **Fotos com fundo de IA (Edição Maracanã)** ainda não aparecem na galeria por QR. No pacote só digital elas não chegam ao cliente: ofereça um pacote com impressão. Isso muda numa próxima versão. A compra de fundo de IA depois da visita, que existia na tela Convidado, volta na galeria online numa próxima fase.
- **Permissões**: desde a v93, o servidor do ponto confere a permissão de cada pessoa ou aparelho em cada pedido. O que a conta não pode mudar volta com o aviso "alterações não foram aceitas (sem permissão)".
- **Sessão vencida ao recarregar**: a tela volta à entrada sem o aviso "Sua sessão terminou". Basta entrar de novo.
- **Painel: a parte Eterna são as vendas deste computador.** Dois computadores podem mostrar totais diferentes até as vendas irem para o servidor.
- **Fotógrafo sem o próprio índice**: no perfil pronto, o fotógrafo não vê a tela Fotógrafos. Decisão confirmada pelo Eduardo.
