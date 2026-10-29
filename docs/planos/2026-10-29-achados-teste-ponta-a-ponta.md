# Achados do teste de ponta a ponta de 29/10 (câmera → Eterna → venda → DNP)

Para: Eduardo. De: Ronaldo (TI Maracatour). 29/10/2026, 17:35.

## Como foi o teste
- A câmera mandou 4 fotos (MAR_8945 a 8948) para o FTP do 218, das 17:13 às 17:26.
- O Eterna do notebook do Ronaldo buscou as fotos no 218 ("FTP do estádio"), leu os rostos e subiu para a nuvem sem erro.
- No Checkout (`eterna.photo/#loja`, ligado ao Eterna do notebook), a selfie encontrou a sessão de **ontem** (MAR_8940 a 8943). A venda foi feita e a impressão foi disparada.

## Achado 1 · Foto que chega com o app fechado não vira sessão (bloqueia a produção)
**O que aconteceu:** as 4 fotos de hoje estão na biblioteca do Eterna, mas não entraram em nenhuma sessão. Por isso a selfie não as encontrou e abriu a sessão de ontem.

**Causa no código:** a sessão é montada **no navegador**, em `agentPoll` → `ingPush` → `ingClose`, só quando o app está aberto na hora em que a foto chega e fecha o grupo depois de 45 s sem foto nova.
- Se o app estiver fechado, a foto só entra na biblioteca.
- Ao recarregar a página, `libLoad` já marca todas as fotos da biblioteca em `UP`, então elas também não entram como chegada nova (`was`).

**Pedido:** a sessão tem que nascer **no Eterna do servidor**, com a mesma regra dos 45 s por fotógrafo, e o app só lê as sessões prontas. Num estádio com 15 mil fotos por dia e vários postos, nenhuma foto pode depender de um navegador aberto.

## Achado 2 · Sessão paga não aceita uma segunda compra
**O que aconteceu:** depois da venda, uma nova selfie da mesma pessoa no Checkout mostra "Estas fotos já foram compradas. Fale com a equipe para comprar mais." (`ljAlreadyPaid`) e não deixa comprar de novo.

**Causa no código:** uma sessão guarda **uma venda só**: `status: 'paga'`, `cart`, `selected`, `saleNo` e `impressao` ficam na própria sessão. `lojaJaPaga` bloqueia o Checkout, e `caixaConfirm` recusa "Esta sessão já está paga".

**Por que está errado:** o cliente volta para levar mais fotos, mais uma impressão ou a versão digital. Isso é venda a mais e não pode exigir chamar a equipe.

**Pedido (sugestão de modelo):**
- A venda vira um registro próprio, ligado à sessão (`vendas[]` na sessão, cada uma com `saleNo`, itens, meio de pagamento, localizador Imply e impressão).
- O Checkout de uma sessão já paga abre normalmente.
  - As fotos compradas aparecem marcadas.
  - O cliente pode escolher fotos novas, ou mais cópias impressas das que já comprou.
  - Cada compra gera uma venda nova, com número próprio.
- A galeria junta os direitos de todas as vendas da sessão. Comprada nunca regride, e a nuvem já faz isso.
- As listas de vendas, o caixa, o estoque do rolo e o relatório contam por venda, não por sessão.

## Achado 3 · A impressão sai na impressora da máquina onde a venda é fechada
**O que aconteceu:** a venda foi fechada no notebook do Ronaldo, e a janela de impressão mostrou as impressoras dele (Canon), não a DNP ligada no 218.

Esse é o comportamento esperado do `window.print()`. Fica registrado porque mexe na decisão de onde fica a DNP:
- **Uma DNP por notebook (combinado atual):** a venda é fechada no notebook que tem a DNP no USB.
- **218 como posto de impressão:** o Checkout precisa abrir no Chrome do 218, com `--kiosk-printing`, a DNP como padrão e papel 10×15 sem borda. A outra saída seria compartilhar a DNP na rede, mas a porta 445 do 218 está fechada hoje e a impressão térmica compartilhada costuma travar.

A prévia também mostrou cabeçalho e rodapé do Chrome (data e endereço) e a foto em preto e branco. O `@page foto{size:102mm 152mm;margin:0}` já existe. Cabeçalho, rodapé e cor são opções do Chrome e da impressora: no posto, desmarcar "Cabeçalhos e rodapés" uma vez antes de ligar o `--kiosk-printing`, que repete as últimas opções, e deixar a DNP em cores.

## Próximo passo do teste
O teste continua com o Eterna **rodando no 218**: ele vigia a pasta do FTP da Microsoft (`iniciar-eterna.bat "<pasta do FTP>"`), o Checkout fica aberto no Chrome do 218 e a impressão vai para a DNP. O notebook do Ronaldo parou de buscar fotos no 218 às 17:30.
