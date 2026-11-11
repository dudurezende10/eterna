# Guia da equipe do Eterna

Passo a passo do dia a dia, em linguagem simples. Cada parte diz para quem é. Atualizado na v93 (06/11/2026).

Nomes: a tela do cliente na loja se chama **Checkout**. Ela abre pelo botão **Abrir Checkout**. Antes era o item Loja do menu. É a mesma tela.

---

## 1. O menu (todos)

### Como funciona

O menu fica do lado esquerdo e é dividido em grupos:

| Grupo | O que tem |
| --- | --- |
| Dashboard | Painel, Estatísticas, Bandeiras, Estoque, Fotógrafos, Vendas e caixa, Lista de vendas, Galerias online |
| Curadoria | Qualidade, Treino da IA, Alertas |
| Fotógrafo | Diário do set, Upload automático, Fila do fotógrafo, Escala 5×2, Calendário de eventos |
| Configurações | Repositório, Identidade, Painel de controle (catálogo, preços, Checkout e FTP), Fundos de IA, Ajuste automático, Usuários, Permissões |
| Laboratório | Vestiário |

1. Toque no nome do grupo para abrir. Toque de novo para fechar.
2. O grupo da tela em que você está fica sempre aberto.
3. Para voltar ao **Início**, toque no logo.
4. O botão **Abrir Checkout** fica fora dos grupos, logo abaixo do logo.

Cada pessoa só vê as telas que pode usar. Se faltar uma tela de que você precisa, peça à administração.

### No celular

1. No alto da tela ficam o logo, o ícone do Checkout e o botão **Menu**.
2. Toque em **Menu**. Os grupos abrem por cima da tela.
3. Toque no grupo e depois na tela. O menu fecha sozinho.
4. Para fechar sem escolher, toque na parte escura ao lado ou em **Menu** de novo.

### O que mudou na v80

- A **Semana** virou o **Painel**, a primeira tela do Dashboard. Admin e Supervisor começam nele (parte 1A).
- **Vendas e caixa** ficou só com os vendedores. Totais, produtos e pagamentos estão no Painel.
- **Catálogo e preços** passou a se chamar **Painel de controle** (catálogo, preços, Checkout e o FTP do estádio). Não confunda com o **Painel** do Dashboard.
- O cartão de **check-in da câmera** saiu do Upload automático. O fotógrafo de cada foto vem do usuário do FTP (cada fotógrafo tem o seu login) e do nome gravado na câmera.
- O cartão **Servidor FTP do estádio** saiu do Upload automático e foi para **Configurações › Painel de controle**.
- Em Permissões e no cadastro de Usuários: **Copiar permissões de…** (parte 5).
- As datas aparecem sempre como dia/mês/ano (07/10/2026), mesmo com o navegador em inglês.

### O que mudou na v78

- **Loja** virou **Checkout**, com o botão **Abrir Checkout**.
- **Fluxo**, **Anfitrião no set** e **Convidado** saíram do menu.
- O check-in da câmera e a troca de fotógrafo estão agora no **Upload automático** (parte 2).
- O cliente vê as fotos só pela galeria online, com o QR do recibo. Não existe mais login de cliente.
- Se ao entrar aparecer "Seu acesso ainda não foi liberado", a administração ainda não liberou nenhuma tela para você. Peça ao administrador.

---

## 1A. Painel (Admin e Supervisor)

O Painel responde em poucos segundos "como foi o período": faturamento, fotos, sessões, o que vendeu e como pagaram.

### Escolher o período, o ponto e a fonte

1. Toque em **Hoje**, **Ontem**, **7 dias** ou **30 dias**. Os dias seguem o horário do Rio, mesmo abrindo de outro país.
2. Para outras datas, toque em **Personalizado** ou direto nas datas **De** e **Até**.
3. **Ponto**: filtra pelo ponto onde a foto foi tirada. Só liga com a Roverpix ao vivo (agente do ponto) ou com a fonte **Eterna**.
4. **Fonte**: **Tudo** (Roverpix + Eterna), só **Roverpix** ou só **Eterna**. A parte Eterna são as vendas deste computador.
5. **Exportar CSV** baixa um dia por linha e uma linha de total.

### Como ler

- **Os 4 cartões**: Faturamento (com ticket médio e vendas), Fotos tiradas (e quantas foram vendidas), Sessões (e quantas compraram) e Gasto por visitante (só com a leitura das catracas; sem catraca aparece "—").
- **Seta verde ▲ ou cinza ▼**: comparação com o período anterior de mesma duração. Só aparece quando esse período anterior está inteiro nos dados. Abaixo de 1% aparece "estável".
- **Receita por dia**: o melhor dia em azul, com o valor; o pior só com o valor. Passe o mouse ou toque numa coluna para ver o valor do dia.
- **Vendas**: quantos atendimentos viraram venda, foram descartados ou cancelados, e os brindes.
- **Fotos**: quanto das fotos vendidas saiu impressa, e as reimpressões.
- **Sessões**: de cada 100 sessões, quantas chegaram ao balcão e quantas compraram. A frase diz onde está a maior perda.
- **Ranking de produtos**: sempre os 7 itens do catálogo do Tour; o que vem de nomes antigos da Roverpix fica em "Outros (catálogo antigo)". Cortesias não entram.
- **Pagamentos**: quanto entrou por modalidade. Dinheiro aguardando caixa aparece numa nota e não entra no total.
- **Dia a dia**: toque para abrir a tabela.
- **"total de 07/10 a 15/10"**: com os números importados, Vendas, Fotos, Ranking e Pagamentos só existem como total do período inteiro.
- **"Roverpix desatualizado desde hh:mm"**: o agente não atualiza há mais de 15 minutos. Confira se o computador do ponto está ligado.

Atendimento e venda, Fotógrafo, Validador e Checkout não veem o Painel.

---

## 2. Fotógrafo (Upload automático)

### O que o fotógrafo vê

- Ao entrar, cai direto no **Upload automático**.
- No menu, só o grupo **Fotógrafo**: Diário do set, Upload automático e Escala 5×2.
- Não vê Checkout, vendas, números de outros fotógrafos, Curadoria nem Configurações.

### De quem é cada foto (v80)

O fotógrafo não precisa mais fazer check-in da câmera. O Eterna sabe de quem é cada foto assim:

1. Pelo **usuário do FTP**: cada fotógrafo manda as fotos com o seu login (ou para a sua pasta) no FTP do estádio.
2. Pelo **nome gravado na câmera** (menu da câmera › Informações de copyright › Nome do autor), se houver.

Check-ins feitos antes da v80 continuam valendo para aquelas fotos. Foto sem nenhuma dessas pistas cai em **Sem fotógrafo**.

O FTP do estádio é configurado pela administração em **Configurações › Painel de controle**. Fora do computador do ponto, o cartão aparece com **agente desconectado**: abra o Eterna pelo agente (http://127.0.0.1:8765) naquele computador para configurar.

### Trocar de fotógrafo no mesmo computador

1. No alto do Upload automático aparece **Neste computador**, com o nome de quem está logado.
2. Toque em **Trocar fotógrafo**. Quem estava sai.
3. O próximo fotógrafo entra com o e-mail dele e o código.
4. Ele volta direto para o Upload automático.

Para só sair, sem trocar, toque em **Sair**.

### Ligar e desligar o ajuste automático

O ajuste automático da IA clareia a foto escura, segura a estourada e acerta a cor de toda foto que chega.

1. No topo do **Upload automático** fica o painel **Ajuste automático da IA**.
2. Toque no botão para trocar entre **Ligado** e **Desligado**.
3. Embaixo aparece quem mexeu e a hora. Exemplo: "Desligado por Carlos às 14:02".

Bom saber:
- Vale para o computador do ponto inteiro, não só para você. O próximo fotógrafo encontra do jeito que você deixou.
- Ao religar, as fotos que chegaram com ele desligado também são ajustadas, em alguns segundos.
- Toda troca fica registrada com o seu nome.
- O supervisor vê o painel, mas não consegue mudar.

### Seu nome e seu ponto (v96-ux)

No topo de **Minhas fotos** aparecem o seu nome e o seu ponto do dia, como estão na Escala. Não dá para trocar por aqui. Se outro fotógrafo for usar o computador, toque em **Trocar fotógrafo**. Se o ponto estiver errado, fale com a supervisora para corrigir a Escala.

### Minhas fotos de hoje (v96-ux)

No fim da tela o fotógrafo vê **Minhas fotos de hoje**: só as fotos dele, de hoje, separadas por sessão. Cada sessão mostra a hora da primeira foto, quantas fotos tem e quantas foram vendidas. A foto vendida leva a etiqueta **VENDIDA**. As fotos que acabaram de chegar ficam em **Ainda sem sessão** até a sessão fechar. A supervisora e o Admin continuam vendo a Biblioteca inteira, com os filtros.

### O cartão não foi lido: enviar as fotos pela tela (v96-ux)

Use só quando o leitor não reconhecer o cartão. As fotos entram do mesmo jeito que entrariam pelo leitor.

1. No computador do ponto, abra **Minhas fotos**.
2. Toque em **Enviar fotos do cartão manualmente** (o link fica logo abaixo da faixa de estado).
3. Abra a pasta do cartão no computador e arraste as fotos para a área **Solte aqui as fotos do cartão**, ou toque em **Escolher fotos**.
4. A faixa mostra **Enviando 4 de 6** e, no fim, **Enviadas 6 de 6**.

Bom saber:
- O fotógrafo manda sempre em nome dele. A supervisora e o Admin escolhem o fotógrafo no seletor **Fotógrafo** acima; com **Todos**, aparece "Escolha o fotógrafo acima" e nenhuma foto entra.
- Só entram fotos `.jpg` ou `.jpeg` da câmera. Outro arquivo aparece na lista como "não era foto".
- Foto que já estava no servidor não entra de novo e aparece como "já estava no servidor". Não é erro.
- Se a conexão cair, cada foto tenta 3 vezes. Depois aparece **Tentar de novo as N que faltaram**.
- Pode trocar de tela durante o envio, ele continua. Não feche nem recarregue a página até terminar.
- Se aparecer "O computador do ponto não está respondendo. Chame a TI.", o computador do ponto está desligado ou fora da rede. Os outros avisos com "Chame a TI" dizem o motivo (sem espaço, precisa ser atualizado).

### Sessões de hoje (v91)

Com o agente do ponto aberto, o Upload automático mostra o painel **Sessões de hoje**: as fotos agrupadas por sessão, a mais nova em cima. Os seletores **Fotógrafo** e **Ponto** do alto da tela filtram as sessões.

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
- Quando o cliente chega ao Checkout, as **5 montagens** já estão prontas, uma para cada fundo: Arquibancada 1950 e Pódio de campeão usam o 1º clique; Noite de campeão, Mirante e Saída do túnel usam o 2º.
- **Se você esquecer**, o sistema usa as 2 primeiras fotos assim mesmo. A IA recorta de qualquer jeito. Não existe botão para devolver essas fotos à venda.
- Sessão com 2 fotos ou menos: nada é separado, as fotos ficam à venda.

**Como conferir no Upload automático**

- As 2 fotos aparecem com a marca **Fundo IA 1** e **Fundo IA 2**. Passe o mouse sobre a marca para ler o texto inteiro: **Fundo IA 1 · corpo inteiro** e **Fundo IA 2 · fechada**.
- Com a sessão ainda aberta, a marca aparece como **Fundo IA?**. Ela confirma quando a sessão fecha.
- A marca **IA** sozinha continua sendo a do ajuste automático. É outra coisa.
- O cabeçalho da sessão mostra **Fundos de IA: 2 de 2 prontas**. Se a sessão não teve fotos separadas, mostra o motivo: volante, ponto fora da regra, sem função do dia, poucas fotos ou regra desligada.
- Sem função do dia na Escala, nada é separado. Confira a sua função antes de começar.

**Na Fila do fotógrafo**

- **Fundo IA: falta o 2º clique** enquanto a sessão só tem 1 foto.
- **Fundo IA ✓✓** quando os 2 recortes estão prontos.

**Administração: mudar a regra (Admin)**

1. Abra **Configurações › Painel de controle**.
2. Desça até o quadro **Fotos para os fundos de IA**.
3. Ali dá para ligar ou desligar a regra, escolher **quantos cliques** (de 1 a 3) e **em quais pontos** ela vale, inclusive Vestiário e Volante.
4. A mudança vale para as sessões que fecharem depois dela. As sessões já fechadas não mudam.

Só quem pode alterar Configurações (Admin e Supervisor, pelos perfis prontos) muda esse quadro. Os outros veem os campos apagados.

**Depois da atualização para a v93:** recarregue todos os navegadores dos caixas. Um navegador antigo ainda mostra essas 2 fotos como fotos à venda.

---

## 3. Checkout (caixa e atendimento)

### Abrir

1. No computador do Checkout, entre com o e-mail do aparelho. Se ele tiver o perfil Checkout, a tela abre sozinha.
2. Em outro computador, toque em **Abrir Checkout**. No celular, é o ícone de tela ao lado do botão Menu.
3. O Checkout abre em tela cheia, sem menu e sem login. É a tela do cliente.

**A aba do Checkout nunca entra logada.** Depois que uma aba virou Checkout, recarregar, digitar outro endereço ou duplicar a aba leva sempre à tela do cliente ou ao login. Para usar o sistema, entre de novo com o seu e-mail e o código, ou use outra janela.

### Fotos de mais de uma sessão (v91)

Quando o cliente olha para a câmera, o Checkout junta todas as sessões do dia em que ele aparece: com a família num ponto e, mais tarde, sozinho em outro ponto, com outro fotógrafo. Cada sessão em que ele aparece entra inteira, inclusive as fotos da família em que ele não está, porque a família costuma vir junta ao balcão. A tela abre direto na primeira foto ampliada; ele passa as fotos com as setas ou arrastando, marca com ✓ e pode tocar em **Ver todas** para ver a grade. O ponto e a hora aparecem no canto da foto.

Se o cliente aparece só no fundo das fotos de outra família (o rosto dele bem menor que o das pessoas da frente), aquela sessão não entra inteira: entram só as fotos em que ele aparece.

Se o Eterna achar o cliente só parecido numa outra sessão, ele pergunta antes: **"Esta sessão também é sua?"**, com até 3 fotos pequenas. **Sim, sou eu** junta só as fotos em que ele parece aparecer, nunca a sessão inteira; **Não sou eu** deixa de fora. Sessão de criança ou de grupo de escola nunca entra assim.

A compra é uma venda só, mesmo com fotos de várias sessões. Foto que já foi comprada não aparece de novo. Pelo código do recibo (o código da sessão) abre a sessão inteira; pelo código da galeria, a compra daquela venda. Depois de 5 códigos errados seguidos, o campo trava por 1 minuto (recarregar a página não destrava).

### Cliente que volta horas depois: use o código do recibo

A câmera procura só as fotos dos **últimos 90 minutos** (a família que fotografou antes disso já foi embora, e a busca fica mais rápida e mais segura). Se o cliente voltar depois, a câmera não acha: peça o **código do recibo** (começa com LP) ou o **código da galeria** (exemplo: `K7QM-4WXR`). O código abre a sessão de qualquer hora do dia.

O tempo muda no **Painel de controle** › **Checkout** › **Procurar fotos dos últimos __ minutos** (de 15 a 480 minutos, ou **Dia todo**). Só Admin e Supervisor mudam. Vale na hora para todos os caixas do ponto. Em dia cheio, diminua; em dia calmo, pode aumentar.

### Computador do cliente: Chrome em modo quiosque

No terminal que fica virado para o cliente, abra o Chrome em modo quiosque. Assim o cliente não vê a barra de endereço, as abas nem os botões do navegador.

1. Entre com o perfil **Checkout** (o e-mail do aparelho) ou abra direto `eterna.photo/#loja`.
2. Abra o Chrome em modo quiosque (atalho do Chrome com a opção `--kiosk`). A TI do ponto deixa o atalho pronto.
3. Para sair do modo quiosque, a equipe usa Alt+F4 no Windows ou Cmd+Q no Mac.

### Checkout e Caixa no mesmo computador

Nesta versão o Checkout e o Caixa precisam estar **no mesmo computador e no mesmo navegador**, em duas janelas: uma com o Checkout, na tela do cliente, e outra com o Caixa, na tela da equipe. Em computadores diferentes o dinheiro não aparece no Caixa. Isso muda numa próxima versão.

### Depois de cada atualização: feche as janelas antigas

**Na atualização para a v96, logo depois de publicar:** em todos os balcões, feche e abra de novo o Checkout e o Posto de venda (e qualquer outra janela do Eterna aberta no notebook). A v96 grava a compra sem pacote de um jeito que uma janela da versão anterior não lista nem confirma, e o Posto da v96 mostra um alerta vermelho se uma janela antiga mexer numa compra do Checkout. Mesmo assim a janela antiga continua aberta com dados velhos e só some quando é fechada: **fechar e reabrir em todos os balcões continua obrigatório**. Antes de usar a impressora, registre a troca de rolo em cada posto com um rolo novo (os valores que vêm na instalação são de demonstração; veja **Troquei o rolo**).

Quando o Eterna for atualizado, feche ou recarregue **todas** as janelas do Eterna abertas naquele computador (Checkout, Caixa e as outras). Uma janela antiga aberta pode atrapalhar o caixa. Se aparecer o aviso "Há uma janela antiga do Eterna aberta. Recarregue as outras janelas.", faça isso na hora.

### Atender um cliente (v96)

O balcão tem o monitor do cliente na frente, com a maquininha presa nele, e o notebook do caixa atrás, no **Posto de venda**. O cliente já está no caixa: o Checkout nunca manda ele para outro lugar.

1. A tela do Checkout mostra o botão grande **Iniciar**. A câmera fica desligada até o cliente tocar nele.
2. O cliente toca em **Iniciar** e olha para a câmera. O Checkout encontra as fotos dele e a câmera desliga.
3. Se a câmera não encontrar (ou se as fotos são de mais de 90 minutos atrás), ele toca em **Digitar seu código** e digita o código da sessão (começa com LP). Se nenhum rosto aparecer na câmera por 1 minuto (gente passando atrás não conta), ela desliga e a tela volta ao **Iniciar**. Em qualquer caso ela desliga 3 minutos depois do Iniciar.
4. A foto aparece na tela inteira. Ele passa com as setas, arrastando o dedo ou com as teclas de seta, e toca em ✓ nas que quer levar e em ✗ nas que não quer. **Ver todas** mostra a grade.
5. Com fotos marcadas aparece **Continuar · N fotos** no canto de baixo. É o único botão que faz o pedido (o carrinho do canto de cima só mostra quantas estão marcadas). Ao tocar, o cliente vê **Pronto! O atendente vai finalizar sua compra**, com o código dele e quantas fotos escolheu. O Checkout não mostra pacote, preço nem forma de pagamento. Se ele quiser mudar a escolha, toca em **Voltar às fotos**: volta para as fotos com tudo o que já tinha marcado e a compra sai do seu **Aguardando pagamento** (aparece o aviso "O cliente do código ... voltou às fotos"). Quando ele tocar em Continuar de novo, ela volta. Depois que você escolhe o pacote ou a forma de pagamento no Posto, **Voltar às fotos** some e o cliente vê "O atendente já está finalizando sua compra.": a compra fica com você (para mudar, cancele e peça para ele escolher de novo).
   - Se o cliente parar na escolha das fotos sem tocar na tela por 90 segundos, o Checkout volta ao **Iniciar** e as fotos marcadas por ele são apagadas: quem chegar depois começa do zero e não vê as fotos de ninguém. Ele também pode sair quando quiser pelo botão **Sair**, no canto de cima. Se já tiver marcado fotos, o Checkout pergunta "Sair e apagar as fotos marcadas?" (Sim ou Não). Isso não vale depois do Continuar: aí valem as regras da tela Pronto e do valor (abaixo).
6. No **Posto de venda**, a compra aparece em **Aguardando pagamento** com as fotos escolhidas (inclusive as de fundo de IA). Mostre as fotos ao cliente, escolha o **pacote** (o **Ideal** vem marcado com a etiqueta) e a **forma de pagamento**.
7. Assim que você escolhe o pacote, a tela do cliente mostra **Valor a pagar R$ X** e quantas fotos são, sem o nome do pacote. Antes de você escolher a forma de pagamento aparece "O atendente vai informar a forma de pagamento"; depois, "Pague na maquininha" (Cartão), "Pague com PIX na maquininha" (PIX) ou "Pague em dinheiro ao atendente" (Dinheiro). Ele pode tocar em **Ver minhas fotos** para ver as escolhidas. Se você trocar o pacote, o valor muda na hora na tela dele. Cada escolha ou troca de pacote e de forma de pagamento fica no registro de auditoria com o seu nome e o valor.
   - Se o cliente sair da tela Pronto ou da tela do valor sem tocar em nada por 3 minutos, ou tocar em **Voltar ao início** (ou a equipe apertar Esc), o Checkout volta ao **Iniciar**. A compra continua em **Aguardando pagamento** com "O cliente saiu da tela": cancele ou espere ele voltar.
   - Se o preço do pacote mudar no Catálogo depois da sua escolha, ao confirmar o Eterna mostra o valor novo (o cliente também vê) e pede para confirmar de novo.
8. Cobre na maquininha e confirme como antes (**Pago na maquininha** ou **Recebi R$ X**). O Checkout mostra a tela final com o QR, o código da galeria e o **Valor pago R$ X** que você confirmou.
9. Se você cancelar, o Checkout do cliente volta ao início.
10. Imprima as fotos no Posto de venda. A tela final com o QR fica 30 segundos e volta sozinha ao **Iniciar**. Para atender o próximo antes disso, toque em **Voltar ao início**.

Outras coisas que o cliente pode fazer:
- Trocar o idioma tocando na bandeira: Brasil, Estados Unidos, Espanha, França ou Alemanha. Em tela pequena, as bandeiras ficam guardadas num botão com a bandeira atual.
- Desistir a qualquer momento com o botão **Sair**, no alto da tela. Se ele já marcou fotos, o Checkout pergunta "Sair e apagar as fotos marcadas?" e só apaga com **Sim, sair**. A escolha dele é apagada e a tela volta ao **Iniciar**.
- Se ele parar de mexer na escolha das fotos (foto ampliada, Ver todas ou a confirmação de sessão) por 90 segundos, o Checkout volta sozinho ao **Iniciar** e apaga as marcas. Qualquer toque ou arrasto renova o prazo.
- Se ele já tinha feito o pedido e voltou às fotos (pelo código, pela selfie ou em outro balcão), o **Sair** e a volta em 90 segundos deixam a compra em **Aguardando pagamento** com "O cliente saiu da tela": cancele ou espere ele voltar.

### Pacotes, adicionais e economia (escolhidos no Posto de venda desde a v96)

O catálogo do Tour mudou na v79:

| Pacote | O que leva | Preço |
| --- | --- | --- |
| Maracanã Mais | todas as fotos, só digitais | R$ 250 |
| Tribuna de Honra | 12 fotos, digitais e impressas | R$ 220 |
| Maracanã | 9 fotos, digitais e impressas | R$ 190 |
| Gramado | 6 fotos, digitais e impressas | R$ 150 |
| Zona Mista | 3 fotos, só digitais | R$ 110 |
| Arquibancada | 1 foto, digital e impressa | R$ 70 |
| Foto adicional | 1 foto, digital e impressa | R$ 35 |

Todas as impressas são 10×15 cm.

No Posto de venda, ao escolher o pacote (as contas são as mesmas de antes):
- **Ideal**: o pacote mais barato para as fotos que ele escolheu, já somando as adicionais. Exemplo: 4 fotos saem por Zona Mista + 1 adicional (R$ 145), mais barato que o Gramado (R$ 150).
- **Fotos com fundo de IA contam dentro do pacote.** Não são mais cobradas à parte no Checkout.
- **5 fundos de IA por venda (v93)**: uma montagem para cada fundo, feita com os 2 primeiros cliques da sessão. Esses 2 cliques não aparecem como foto normal nem entram na contagem do "Todas".
- **Resumo linha a linha** antes do total: o pacote e as adicionais, cada um com o valor.
- **Economia**: quanto ele economiza em comparação a comprar avulso (uma Arquibancada e o resto como Foto adicional). Exemplo: 8 fotos avulsas custariam R$ 70 + 7 × R$ 35 = R$ 315. No Pacote Maracanã ele paga R$ 190 e economiza R$ 125. Só aparece quando há economia.
- "Cabem mais N fotos neste pacote sem pagar mais", quando ele escolheu menos fotos do que o pacote leva.
- Impressas: o pacote imprime até o número de fotos escolhidas, mais uma por adicional. Cada adicional sai do rolo do caixa.

Se a administração tinha mudado à mão o preço do Maracanã, da Zona Mista, da Arquibancada ou da Foto adicional, esse preço voltou para o novo do catálogo. Confira em **Painel de controle**.

### Sessão que já foi paga

Se o cliente volta ao Checkout com fotos que já comprou, aparece "Estas fotos já foram compradas. Fale com a equipe para comprar mais." O Checkout **não deixa pagar de novo**. Para vender mais fotos para ele, use a Venda no balcão.

### Dinheiro: aguardando caixa (vendedor e caixa)

Desde a v96 quem escolhe **Dinheiro** é você, no Posto de venda. A compra não é dada como paga até você receber.

**O que o cliente vê**
1. Na tela Pronto, antes de você escolher o pacote: o **código** da compra (exemplo: `K7QM-4WXR`) e quantas fotos ele escolheu.
2. Depois que você escolhe o pacote e Dinheiro no Posto de venda: "Valor a pagar R$ X", "N fotos", "Pague em dinheiro ao atendente" e o botão **Ver minhas fotos**. Essa tela não mostra o nome do pacote nem o código.
3. Se ele abrir a galeria antes de pagar, aparece que o pagamento está esperando. As fotos só aparecem depois da confirmação.

**Como confirmar (caixa)**
1. Na barra da equipe, toque em **Caixa**. O número ao lado mostra quantos pagamentos estão esperando.
2. No topo aparece **Aguardando caixa · dinheiro do Checkout**. A lista atualiza sozinha.
3. Digite o código que o cliente mostrou no campo de busca. Pode ser com ou sem hífen.
4. Confira o valor, o número de fotos e de impressas e as miniaturas.
5. Receba o dinheiro.
6. Toque em **Recebi R$ X**. A venda fica paga, as fotos vão para Impressão 10×15 no Posto de venda, a galeria do cliente libera as fotos e aparece o recibo com "Recebido por <seu nome>".

**Se o cliente desistir**
1. Toque em **Cancelar** no item.
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

Se o botão sumiu, use o painel do logo ou o Esc (abaixo) e entre de novo com o seu e-mail e o código. No computador do perfil Checkout esse botão nunca aparece.

**Painel do logo e Esc**

- **3 toques rápidos no logo** abrem o painel da equipe. Ali estão:
  - **Sessões esperando**: abre as fotos de um cliente pela lista, quando a câmera não acha e ele não tem o código.
  - **Sair do Checkout**: fecha o Checkout.
  - **Fechar**: volta para o cliente.
- **Esc** no teclado sai do Checkout na hora.
- Sair sempre leva para a tela de login. Para voltar ao sistema, entre de novo com o seu e-mail e o código.
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

### Ajustes no Catálogo

- **Tempo da tela final do Checkout**: Painel de controle › Checkout › "Tempo da tela final com o QR (segundos)". Padrão 30, de 5 a 120.
- **Preço da foto avulsa na galeria**: item "Foto digital avulsa (galeria online)", hoje R$ 39. "Todas as fotos" custa o mesmo que o Pacote Maracanã Mais.

### Ver as vendas da galeria

Em **Lista de vendas**, use o filtro **Canal: Online**. Hoje elas aparecem como **teste** e ficam fora da receita (ver limitações).

---

## 5. Administração (Usuários e Permissões)

Fica no grupo **Configurações**. **Usuários** é o cadastro da equipe. **Permissões** é onde se decide o que cada pessoa vê e faz. Só o admin vê as duas telas.

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

1. Abra **Configurações** › **Usuários** › **Novo usuário**.
2. Escreva o nome e o e-mail.
3. Se for fotógrafo, escolha o nome dele em **Fotógrafo vinculado**.
4. Em **Perfil**, escolha um perfil pronto (tabela abaixo). Se ainda não souber o que liberar, escolha **Sem acesso ainda**.
5. Toque em **Criar acesso**.

Para começar igual a alguém da equipe, escolha a pessoa em **Começar com as permissões de…** antes de **Criar acesso**. A tela mostra o que a pessoa nova vai ter e o que ficou de fora.

Quem entra com "Sem acesso ainda" vê a mensagem "Seu acesso ainda não foi liberado" até alguém liberar em Permissões.

### Dar ou tirar acesso

1. Abra **Configurações** › **Permissões** › aba **Por usuário**.
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

1. Em **Permissões**, toque na pessoa e depois em **Copiar permissões de…** (ou, em **Usuários**, abra a pessoa e toque em **Copiar permissões de…**).
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
| Fotógrafo | Diário do set, Upload automático (troca de fotógrafo), Fila do fotógrafo, Escala 5×2 | Checkout, Dashboard, Curadoria, Configurações |
| Atendimento e venda | Checkout, venda no balcão, Fila, Caixa, Catálogo (só para ver os preços), Fila do fotógrafo (só para ver) | Dashboard (vendas, números, fotógrafos), Curadoria, Usuários |
| Validador | Qualidade, Treino da IA, Diário do set (só para ver) | vendas, Checkout, Configurações |
| Supervisor | Dashboard (começa no Painel), Curadoria (só para ver), grupo Fotógrafo (envia as fotos do cartão pela tela em nome de um fotógrafo, v96-ux), Configurações do venue, Laboratório | Usuários e Permissões; não cancela venda |
| Checkout | só a tela do cliente, em tela cheia | todo o resto |

A aba **Perfis prontos** mostra cada perfil em detalhe.

---

## Novidades da v81

- **Checkout no segundo monitor.** "Abrir Checkout" abre uma janela separada. Arraste essa janela para o monitor do cliente. A sua tela continua logada no admin. Se o cliente apertar Esc ou mexer no endereço da janela dele, o Checkout volta ao início e o seu login não cai.
- **Fundos de IA.** O cliente vê só 5 fundos: Noite de campeão (sem a taça), Mirante ao pôr do sol, Arquibancada 1950 em preto e branco, Saída do túnel e Pódio de campeão (desde a v86). Os outros ficam em Laboratório › Fundos em teste, onde o admin pode Ativar ou Mover para o Laboratório.
- **Bandeiras.** As imagens foram corrigidas. A bandeira que ainda não tem a imagem certa fica sem foto, de propósito, até a imagem certa chegar.
- **Fotógrafos.** Klassius e Sandessa já estão na lista.

## Novidades da v82

- **Bandeiras.** 30 bandeiras ganharam imagem da Wikipedia; são só referência, não a bandeira física.

---

## Novidades da v83

Cada vendedor trabalha num notebook com a DNP RX1HS ao lado. A tela do vendedor é o **Posto de venda**. Ao tocar em **Abrir Checkout**, o Checkout abre na outra janela (para o monitor do cliente) e você cai no Posto de venda.

### Preparar o notebook (TI do ponto, uma vez)

1. Instale a DNP RX1HS com papel PR 4×6 (10×15) e deixe a **DNP como impressora padrão** do notebook.
2. Abra o Chrome do Eterna com a opção `--kiosk-printing`. Assim a foto sai direto na DNP, sem a janela de impressão do Chrome. A TI do ponto deixa o atalho pronto.
3. Com `--kiosk-printing`, tudo o que for impresso nesse Chrome sai na DNP. Cartaz A4 de grupo de escola: imprima no computador do ponto.

### O que tem no Posto de venda

- **No Checkout agora**: o que o cliente está vendo e escolhendo, ao vivo.
- **Aguardando pagamento**: as escolhas do Checkout esperando você escolher o pacote, a forma de pagamento e confirmar.
- **Impressão 10×15**: as vendas pagas, com as fotos para imprimir já marcadas, e o contador do rolo.
- **Minhas vendas de hoje**: as suas vendas neste notebook, com o valor de cada uma. Não mostra total.

### Confirmar na maquininha

1. Desde a v96 o cliente só escolhe as fotos. A compra aparece em **Aguardando pagamento** com o código e as fotos. Escolha o pacote e a forma de pagamento (Cartão, PIX ou Dinheiro); o cliente vê o valor na tela dele.
2. Digite o valor na maquininha e espere aprovar.
3. Toque em **Pago na maquininha**.
4. Se quiser, digite o **NSU ou a autorização** do comprovante (só números, de 4 a 12). É opcional.
5. **Nunca digite o número do cartão.** Se aparecer "Isso parece número de cartão", apague e digite só o NSU.
6. Toque em **Confirmar R$ X**. O Checkout mostra o QR para o cliente.
7. Dinheiro: receba e toque em **Recebi R$ X**.
8. Se o cliente desistir ou a maquininha recusar de vez, toque em **Cancelar** e depois em **Sim, cancelar**. O Checkout dele volta ao início.

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
4. Toque em **Reimprimir N fotos** e depois em **Saiu certo** ou **Não saiu**.

### Trocar o rolo de 700

1. O rolo da DNP faz cerca de 700 fotos. O contador "Rolo: X de 700" fica no alto do Posto de venda.
2. Abaixo de 40, o contador fica vermelho e aparece em **Alertas**. Troque antes do pico.
3. Troque o rolo e a fita na DNP.
4. Registre a troca: no Posto de venda (veja **Troquei o rolo** logo abaixo) ou em **Dashboard › Estoque**, em **Registrar troca de rolo** (no Estoque, só quem tem permissão de editar Estoque). O contador volta a 700.

### Troquei o rolo (v96)

1. Só num aparelho configurado como posto: toque no selo **Rolo: X de 700** no alto do Posto de venda, no alto do Caixa ou no painel **Impressão 10×15**. Com o rolo abaixo de 40, o botão **Troquei o rolo** aparece ao lado do selo no alto do Posto de venda e do Caixa (não no painel Impressão 10×15). Em aparelho não configurado como posto, o selo só mostra o contador: registre a troca em **Dashboard › Estoque**.
2. O Eterna pergunta "Trocou o rolo da impressora deste posto? O contador volta para 700." Toque em **Sim, troquei** ou em **Cancelar** (Cancelar não muda nada).
3. Vale só para o posto deste computador. A troca de outro posto se registra no próprio posto ou em **Dashboard › Estoque**.
4. Quem vende (permissão de criar em Venda) pode registrar a troca do próprio posto, mesmo sem acesso ao Estoque. Cada troca fica no registro de auditoria com quem fez, o posto e o valor que o contador tinha. Uma troca de hoje com mais de 60 impressões sobrando aparece em **Alertas** como grave, com o posto, quem fez e o valor.
5. Os valores que vêm na instalação (58, 142 e 171) são de demonstração. Antes de usar no balcão, registre a troca em cada posto com um rolo novo.

### Outras mudanças

- O cliente não vê mais "2 minutos" nem contagem na tela de pagamento.
- Confirmar o pagamento não baixa mais o estoque; quem baixa é o **Saiu certo**.
- O número da venda tem o formato `L0-012`.

## Novidades da v84: fundos de IA montados no próprio computador

As fotos com fundo de IA agora são montadas no computador do ponto, sem internet e sem custo. O agente recorta a pessoa e o Eterna coloca no fundo com as regras aprovadas (meio corpo encostado embaixo, corpo inteiro do joelho para cima, a Arquibancada 1950 toda em preto e branco). Vale para a prévia, o Checkout, o Posto de venda e a impressão 10×15.

### Instalar o recorte (TI do ponto, uma vez por computador)

1. Use um computador com **16 GB de memória** (recomendado). Com 8 GB funciona, mas fica no limite com o Chrome e o reconhecimento de rostos abertos.
2. Na pasta do agente, dê dois cliques em **instalar-recorte.command** (Mac) ou **instalar-recorte.bat** (Windows). Ele cria um ambiente separado do Eterna (`Eterna/venv`, na pasta do usuário), instala as versões testadas do recorte e baixa os dois modelos (cerca de 350 MB). Precisa de internet só nesta hora. Depois disso, o Eterna.command e o iniciar-eterna.bat abrem o agente por esse ambiente.
3. Feche o agente e abra de novo (Eterna.command ou iniciar-eterna.bat). Na janela do agente aparece **Recorte local: pronto**.
4. Em **Configurações › Fundos de IA**, o quadro **Recorte local** mostra "pronto" e, depois das primeiras fotos, o tempo médio por foto.

Se o recorte não estiver instalado, o Checkout não oferece foto com fundo de IA e o quadro mostra o motivo. Enquanto a foto está sendo montada, o cliente vê "Preparando sua foto especial..."; se a montagem falhar, a foto sai da venda. As outras fotos seguem normais.

Os recortes ficam guardados no computador por 2 dias e depois são apagados sozinhos.

### Tempo

A primeira foto do dia demora mais (o agente abre os modelos). Depois, cada foto leva alguns segundos; o recorte fica guardado e não é refeito na impressão.

### Photoroom

O Photoroom continua configurado, só não é usado. Para voltar a ele: **Configurações › Painel de controle › Montagem dos fundos › Photoroom**. Cada montagem pelo Photoroom gasta crédito.

## Novidades da v86: fundo Pódio de campeão

O cliente ganhou um 5º fundo de IA: **Pódio de campeão**. Estádio lotado em verde e amarelo, confete, um pódio dourado e uma taça à direita.

- **Já vem ligado.** Não precisa fazer nada. Se o ponto já tinha uma escolha de fundos salva com 1 a 4 fundos, o Pódio entra sozinho na lista, uma vez só.
- **Se a lista estava vazia de propósito**, continua vazia. Para ligar, use Configurações › Fundos de IA.
- **Se a administração tirar o Pódio**, ele não volta sozinho.
- **Como a foto sai.** A pessoa fica em cima do pódio, um pouco à esquerda, e nunca cobre a taça do fundo. Foto de corpo inteiro vira do joelho para cima, como no Campeão, no Mirante e no Túnel.
- **Anfitrião e vendedor.** Na hora de oferecer, vale mostrar a prévia do Pódio para quem tirou foto comemorando ou segurando a taça. A taça que o cliente segura sai junto no recorte. A taça do fundo é outra e fica sempre à vista.
- **Impressão 10×15.** Funciona igual aos outros fundos.

## Novidades da v87: Fila do fotógrafo

Fica em **Fotógrafo › Fila do fotógrafo**, logo abaixo do Upload automático. É um painel, como a Fila de impressão, que mostra as fotos chegando ao servidor, separadas por fotógrafo. Ninguém precisa apertar nada: o fotógrafo só fotografa e o painel se atualiza sozinho a cada 2 segundos. Veem: Admin, Supervisor, Fotógrafo e Atendimento e venda.

### As três colunas

| Coluna | Quer dizer |
| --- | --- |
| **Clicando agora** | o fotógrafo ainda está fotografando esse grupo |
| **Chegando** | ele parou de clicar e as fotos ainda estão subindo para o servidor (fila do Wi-Fi ou leitura de cartão) |
| **Já no Checkout** | as fotos estão no servidor e os rostos já foram lidos: a selfie do Checkout já acha o cliente |

Um grupo vai para **Já no Checkout** 1 minuto depois da última foto e depois da leitura dos rostos (v91: cada grupo da Fila é uma sessão). Sai da tela 15 minutos depois.

Com a câmera mandando direto pelo FTP, **Chegando** pode durar só alguns segundos. É normal.

### O que cada cartão mostra

- O nome do fotógrafo em letra grande e, entre parênteses, de onde ele está fotografando: **(campo · Foto Campo 2)**, **(volante · chute a gol)**, **(set interno · Vestiário)** ou **(sem ponto)**. O ponto vem da **Escala 5×2** (função do dia). Trocou a função na Escala, os grupos seguintes já mostram o ponto novo; os que já estavam na tela não mudam.
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
- Fotos mandadas pelo navegador (upload manual) não entram na fila.

## Novidades da v92: Estatísticas e Calendário de eventos

Duas telas novas. **Estatísticas** junta os números de vendas, fotógrafos, rapidez, dias e movimento da bilheteria. **Calendário de eventos** guarda os jogos, shows, feriados e dias de estádio fechado, para comparar um dia com o outro.

O Eterna **não faz controle de ponto**. Não marca presença, falta nem atraso. Isso continua no sistema do RH.

### Quem vê o quê

| Pessoa | Estatísticas | Calendário de eventos |
| --- | --- | --- |
| Admin | vê e importa as entradas da bilheteria | vê e edita |
| Supervisora | não vê | vê e edita |
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

1. No menu, abra **Fotógrafo › Calendário de eventos**. O Admin também tem o atalho em **Configurações › Painel de controle**.
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
- Jogos no Maracanã entram sozinhos pela API-Football (v97) toda segunda às 06:00, depois que a chave da API-Football for salva em **Configurações › Painel de controle**. Sem ela, a linha do Calendário diz "Jogos: fonte não configurada, peça ao Admin". **Atualizar jogos agora** busca na hora. Shows e outros eventos continuam por **Novo evento**, **Colar lista** ou CSV.
- A coluna **Origem** mostra "Automático · feriados", "Automático · jogos", "Manual" ou "Importado". Evento automático que você edita ou apaga não volta a ser mudado pelo servidor.
- Se aparecer o aviso **Este aparelho não está ligado ao servidor do ponto**, você está vendo só o que foi salvo neste navegador. O que criar sobe quando abrir o Eterna pelo servidor (no estádio ou pelo Tailscale).

### Chave da API-Football (só o Admin)

1. Crie a conta em dashboard.api-football.com (o plano grátis dá 100 consultas por dia) e copie a chave.
2. Abra o Eterna **pelo servidor do ponto** (no estádio ou pelo Tailscale) e vá em **Configurações › Painel de controle**. Logo abaixo do painel **Checkout** fica **Calendário de eventos · fonte dos jogos**. Só o Admin vê esse painel. A Supervisora e os outros perfis não veem, e o Calendário de eventos não mostra a chave.
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

## Novidades da v97: selo Edição Maracanã

- No Checkout, as fotos com fundo de IA (as montagens) aparecem primeiro, juntas, com a faixa amarela **Edição Maracanã** e o nome do fundo (Noite de campeão, Mirante ao pôr do sol, Arquibancada 1950, Saída do túnel, Telão do Maracanã), nas 5 línguas. Na grade elas vêm com o título "Suas fotos especiais" e, depois delas, "Suas fotos de hoje".
- O Checkout abre na primeira montagem pronta. Se ela ainda estiver sendo preparada e o cliente não tocar em nada, depois de 8 segundos a tela vai sozinha para a próxima foto pronta.
- No Posto de venda, as montagens do pedido e a tela do cliente mostram a mesma faixa Edição Maracanã. A montagem continua contando dentro do pacote, igual a qualquer outra foto.
- A faixa é só da tela: a foto impressa e a do download saem sem ela.
- Atenção: hoje a montagem não vai para a galeria online. No pacote só digital (Zona Mista, Maracanã Mais) a montagem escolhida não chega ao cliente. Nos pacotes com impressão, a montagem sai impressa.
- Para o Admin: em Estatísticas, o quadro "Edição Maracanã: montagens vistas × compradas" mostra por dia quantas montagens os clientes viram no Checkout e quantas compraram.

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

## 7. Limitações de hoje (v83)

- **No celular do cliente aparece "Suas fotos estão chegando".** Nesta fase as fotos ainda ficam no computador do ponto e o celular não chega até ele. Vai funcionar quando a nuvem entrar (fase 2). Não prometa download pelo celular por enquanto.
- **Para demonstrar**, use **Abrir galeria** em Galerias online, no próprio computador do ponto. Ali a galeria funciona de verdade.
- **Compras na galeria online são de teste.** Nada é cobrado. Elas aparecem na Lista de vendas como "teste" e não entram na receita.
- **Cartão e PIX**: o sistema ainda não conversa com a maquininha (sem TEF). Quem confirma é você, depois de ver a maquininha aprovar.
- **Checkout e Posto de venda no mesmo notebook**: nesta etapa o Checkout, o Posto de venda e o Caixa precisam estar no mesmo notebook e no mesmo navegador. Os notebooks ainda não conversam entre si; isso entra na próxima etapa.
- **Ícone do celular no cartão do QR** está quase invisível na tela final. Ajuste previsto.
- **No celular (tela estreita)**, na tela "Estas fotos já foram compradas", o botão **Voltar ao início** aparece só como ícone. Ajuste previsto.
- **Cancelar uma venda do Checkout** tira o download no sistema, mas a foto pode continuar liberada no computador do ponto. Avise a administração quando cancelar.
- **Compra feita na galeria da escola** não aparece na galeria da sessão da família, e vice-versa.
- **"Baixar todas"** baixa as fotos uma por uma (ainda não há arquivo ZIP).
- **Fotos com fundo de IA** ainda não aparecem na galeria por QR. A compra de fundo de IA depois da visita, que existia na tela Convidado, volta na galeria online numa próxima fase.
- **Permissões e confirmação do caixa**: nesta fase organizam o que cada pessoa vê e faz, mas ainda são conferidas só no navegador. Ainda não são uma trava de segurança no servidor. Isso entra quando o servidor entrar.
- **Painel: a parte Eterna são as vendas deste computador.** Dois computadores podem mostrar totais diferentes até as vendas irem para o servidor.
- **Fotógrafo sem o próprio índice**: no perfil pronto, o fotógrafo não vê a tela Fotógrafos. Decisão confirmada pelo Eduardo.
