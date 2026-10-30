# Guia da equipe do Eterna

Passo a passo do dia a dia, em linguagem simples. Cada parte diz para quem é. Atualizado na v87 (30/10/2026).

Nomes: a tela do cliente na loja se chama **Checkout**. Ela abre pelo botão **Abrir Checkout**. Antes era o item Loja do menu. É a mesma tela.

---

## 1. O menu (todos)

### Como funciona

O menu fica do lado esquerdo e é dividido em grupos:

| Grupo | O que tem |
| --- | --- |
| Dashboard | Painel, Bandeiras, Estoque, Fotógrafos, Vendas e caixa, Lista de vendas, Galerias online |
| Curadoria | Qualidade, Treino da IA, Alertas |
| Fotógrafo | Diário do set, Upload automático, Fila do fotógrafo, Escala 5×2 |
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

---

## 3. Checkout (caixa e atendimento)

### Abrir

1. No computador do Checkout, entre com o e-mail do aparelho. Se ele tiver o perfil Checkout, a tela abre sozinha.
2. Em outro computador, toque em **Abrir Checkout**. No celular, é o ícone de tela ao lado do botão Menu.
3. O Checkout abre em tela cheia, sem menu e sem login. É a tela do cliente.

**A aba do Checkout nunca entra logada.** Depois que uma aba virou Checkout, recarregar, digitar outro endereço ou duplicar a aba leva sempre à tela do cliente ou ao login. Para usar o sistema, entre de novo com o seu e-mail e o código, ou use outra janela.

### Computador do cliente: Chrome em modo quiosque

No terminal que fica virado para o cliente, abra o Chrome em modo quiosque. Assim o cliente não vê a barra de endereço, as abas nem os botões do navegador.

1. Entre com o perfil **Checkout** (o e-mail do aparelho) ou abra direto `eterna.photo/#loja`.
2. Abra o Chrome em modo quiosque (atalho do Chrome com a opção `--kiosk`). A TI do ponto deixa o atalho pronto.
3. Para sair do modo quiosque, a equipe usa Alt+F4 no Windows ou Cmd+Q no Mac.

### Checkout e Caixa no mesmo computador

Nesta versão o Checkout e o Caixa precisam estar **no mesmo computador e no mesmo navegador**, em duas janelas: uma com o Checkout, na tela do cliente, e outra com o Caixa, na tela da equipe. Em computadores diferentes o dinheiro não aparece no Caixa. Isso muda numa próxima versão.

### Depois de cada atualização: feche as janelas antigas

Quando o Eterna for atualizado, feche ou recarregue **todas** as janelas do Eterna abertas naquele computador (Checkout, Caixa e as outras). Uma janela antiga aberta pode atrapalhar o caixa. Se aparecer o aviso "Há uma janela antiga do Eterna aberta. Recarregue as outras janelas.", faça isso na hora.

### Atender um cliente

1. O cliente olha para a câmera. O Checkout encontra as fotos dele.
2. Se a câmera não encontrar, ele digita o código da sessão (começa com LP).
3. O cliente passa as fotos e toca em ✓ nas que quer levar e em ✗ nas que não quer.
4. Na tela seguinte ele escolhe o pacote e a forma de pagamento. O Checkout já marca o pacote **Ideal**, o mais barato para o número de fotos que ele escolheu.
5. **Cartão, PIX e Dinheiro ficam aguardando você.** O Checkout pede para o cliente pagar na sua maquininha (ou no dinheiro) e espera. A venda só vale depois que você confirma no **Posto de venda** (veja "Novidades da v83").
6. Quando você confirma, aparece no Checkout a tela final com o QR e o código da galeria (exemplo: `Código K7QM-4WXR`). Se você cancelar, o Checkout volta ao carrinho do cliente com um aviso.
7. Imprima as fotos no Posto de venda.
8. A tela final com o QR fica 30 segundos e volta sozinha para a câmera, com contagem. Para atender o próximo antes disso, toque em **Voltar ao início**.

Outras coisas que o cliente pode fazer:
- Trocar o idioma tocando na bandeira: Brasil, Estados Unidos, Espanha, França ou Alemanha.
- Desistir a qualquer momento com **Voltar ao início**. A escolha dele é apagada e a tela volta para a câmera.
- Ficar o tempo que precisar escolhendo. O Checkout não volta sozinho no meio da escolha, só depois da compra.

### O carrinho: pacote, adicionais e economia

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

O que o cliente vê no carrinho:
- **Ideal**: o pacote mais barato para as fotos que ele escolheu, já somando as adicionais. Exemplo: 4 fotos saem por Zona Mista + 1 adicional (R$ 145), mais barato que o Gramado (R$ 150).
- **Fotos com fundo de IA contam dentro do pacote.** Não são mais cobradas à parte no Checkout.
- **Resumo linha a linha** antes do total: o pacote e as adicionais, cada um com o valor.
- **Economia**: quanto ele economiza em comparação a comprar avulso (uma Arquibancada e o resto como Foto adicional). Exemplo: 8 fotos avulsas custariam R$ 70 + 7 × R$ 35 = R$ 315. No Pacote Maracanã ele paga R$ 190 e economiza R$ 125. Só aparece quando há economia.
- "Cabem mais N fotos neste pacote sem pagar mais", quando ele escolheu menos fotos do que o pacote leva.
- Impressas: o pacote imprime até o número de fotos escolhidas, mais uma por adicional. Cada adicional sai do rolo do caixa.

Se a administração tinha mudado à mão o preço do Maracanã, da Zona Mista, da Arquibancada ou da Foto adicional, esse preço voltou para o novo do catálogo. Confira em **Painel de controle**.

### Sessão que já foi paga

Se o cliente volta ao Checkout com fotos que já comprou, aparece "Estas fotos já foram compradas. Fale com a equipe para comprar mais." O Checkout **não deixa pagar de novo**. Para vender mais fotos para ele, use a Venda no balcão.

### Dinheiro: aguardando caixa (vendedor e caixa)

Quando o cliente escolhe **Dinheiro** no Checkout, a compra não é dada como paga. Ela espera alguém da equipe receber.

**O que o cliente vê**
1. O botão vira "Finalizar e pagar R$ X no caixa".
2. Na tela final aparece um ícone amarelo de dinheiro, "Pague no caixa em dinheiro", o valor, um **código** (exemplo: `K7QM-4WXR`) e o QR.
3. Ele vai ao caixa e mostra o código.
4. Se ele abrir o QR antes de pagar, aparece "Seu pagamento em dinheiro está esperando o caixa". As fotos só aparecem depois da confirmação.

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
| Supervisor | Dashboard (começa no Painel), Curadoria (só para ver), grupo Fotógrafo, Configurações do venue, Laboratório | Usuários e Permissões; não cancela venda |
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
- **Aguardando pagamento**: as compras de Cartão, PIX e Dinheiro esperando você.
- **Impressão 10×15**: as vendas pagas, com as fotos para imprimir já marcadas, e o contador do rolo.
- **Minhas vendas de hoje**: as suas vendas neste notebook, com o valor de cada uma. Não mostra total.

### Confirmar na maquininha

1. O cliente escolhe Cartão ou PIX no Checkout. A compra aparece em **Aguardando pagamento**, com o código, o valor e as fotos.
2. Digite o valor na maquininha e espere aprovar.
3. Toque em **Pago na maquininha**.
4. Se quiser, digite o **NSU ou a autorização** do comprovante (só números, de 4 a 12). É opcional.
5. **Nunca digite o número do cartão.** Se aparecer "Isso parece número de cartão", apague e digite só o NSU.
6. Toque em **Confirmar R$ X**. O Checkout mostra o QR para o cliente.
7. Dinheiro: receba e toque em **Recebi R$ X**.
8. Se o cliente desistir ou a maquininha recusar de vez, toque em **Cancelar** e depois em **Sim, cancelar**. O Checkout volta ao carrinho dele.

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
4. Em **Dashboard › Estoque**, toque em **Registrar troca de rolo**. O contador volta a 700.

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

Um grupo vai para **Já no Checkout** 20 segundos depois da última foto. Sai da tela 15 minutos depois.

Com a câmera mandando direto pelo FTP, **Chegando** pode durar só alguns segundos. É normal.

### O que cada cartão mostra

- O nome do fotógrafo em letra grande e, entre parênteses, de onde ele está fotografando: **(campo · Foto Campo 2)**, **(volante · chute a gol)**, **(set interno · Vestiário)** ou **(sem ponto)**. O ponto vem da **Escala 5×2** (função do dia). Trocou a função na Escala, os grupos seguintes já mostram o ponto novo; os que já estavam na tela não mudam.
- A hora em que o grupo começou e quantas fotos tem.
- Nas duas primeiras colunas, as últimas fotos que chegaram, em miniatura.
- **De folga na Escala e mandando fotos**, em vermelho: a pessoa está de folga na Escala e as fotos dela estão chegando. Confira a Escala.
- **Sem fotógrafo · câmera ···1234**: o Eterna não sabe de quem é a câmera (veja abaixo). Os 4 números são o final da série do corpo.

### Na TV do caixa

1. Abra o Eterna na TV pelo endereço do servidor do ponto e entre com o login de Atendimento e venda.
2. Abra **Fila do fotógrafo** e toque em **Tela cheia**. O menu some.
3. Na tela cheia, as miniaturas ficam **desligadas**. São rostos de turistas e de crianças, e uma TV virada para a fila mostraria as fotos de graça. Se a TV estiver virada só para a equipe, toque em **Miniaturas na tela cheia** para ligar. A escolha fica guardada naquele aparelho.
4. Para sair da tela cheia, aperte **Esc** ou toque em **Sair da tela cheia**.

Se aparecer **Sem conexão com o servidor**, o painel continua mostrando o último dado. Confira se o computador do ponto está ligado.

### Para aparecer o nome do fotógrafo (TI e fotógrafos)

O Eterna descobre o fotógrafo, nesta ordem: pelo usuário do FTP da câmera; pela subpasta do FTP (só se a subpasta tiver o nome de um fotógrafo cadastrado); pelo nome gravado na câmera. Câmera sem usuário próprio no FTP (cartão, FTP do estádio sem subpasta) aparece como **Sem fotógrafo**. Para resolver:

- Grave o nome do fotógrafo na câmera, em **Informações de copyright › Nome do autor** (Canon). Use o mesmo nome do cadastro (Carlos, Yago, Marinara...).
- No FileZilla (pasta vigiada), crie uma subpasta por fotógrafo, com o nome dele.

### O que ainda não tem

- O código LP da sessão não aparece nesta versão. Ele entra quando a sessão passar a ser montada no servidor.
- Se o Checkout estava fechado quando as fotos chegaram, a TV pode mostrar o grupo em **Já no Checkout** e o Checkout ainda não achar o cliente. Isso também se resolve quando a sessão passar a ser montada no servidor.
- Fotos mandadas pelo navegador (upload manual) não entram na fila.

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
