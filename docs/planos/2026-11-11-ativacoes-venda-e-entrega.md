# Ativações no Eterna: Drone, Chute a Gol e Snap Pop (venda e entrega)

**Situação (11/11/2026):** plano aprovado em conversa com o Ronaldo, ainda sem código. O foco é **venda e entrega**.

**Por quê:** o Eterna deixa de vender só fotos. Passa a vender também as ativações do tour: Drone, Chute a Gol e Snap Pop (vídeo com IA). O sistema que faz isso hoje vai ser desligado. Até lá, o histórico dele entra no Eterna todo dia.

**Nomes:** os produtos se chamam Drone, Chute a Gol e Snap Pop. O sistema que sai de uso é o "sistema antigo".

Este plano substitui as opções do plano de 30/10 (`2026-10-30-maracafly-no-eterna.md`) nos pontos que o Ronaldo decidiu em 11/11. O levantamento tela a tela do sistema antigo está em `maracatour/maracafly-doc/docs`, fora deste repositório.

## 1. Decisões do Ronaldo (11/11)

1. O Eterna vende Drone, Chute a Gol e Snap Pop, além das fotos.
2. **A venda é no tablet, com tela pensada primeiro para tela pequena.** É o mesmo aparelho do Posto de venda.
3. **A venda não pede dado do cliente**, para ser rápida. Não há nome, WhatsApp nem país.
4. **A entrega é por QR, ligado no campo, na hora da entrega.** Quando o cartão de memória sai do drone, a equipe lê o QR de um cartão, liga esse QR ao vídeo e entrega o cartão ao cliente. O cliente abre a galeria pelo QR, informa o e-mail, faz a selfie e baixa o vídeo, como já acontece com as fotos. A venda não lê QR. **Não há entrega por WhatsApp.**
5. **O vídeo fica na nuvem da AWS**, no mesmo lugar da galeria.
6. **O Drone também tem fotos.** Elas ficam com as outras fotos do tour, na sessão do cliente, e são vendidas no checkout das fotos. O QR do vídeo serve só para o vídeo.
7. **Cortesia vale para as ativações**, com a mesma regra da Cortesia SAC: motivo, nota e quem deu.
8. **O admin troca preço** e pode desligar um produto no dia ("hoje não vendo").
9. **Por enquanto, vídeo do Drone e Chute a Gol só se compram no local.** A compra online (Imply, plano `2026-11-11-compra-online-pela-imply.md`) continua só para fotos. As ativações entram nela depois.
10. **O histórico do sistema antigo entra no Eterna.** Primeiro, as planilhas exportadas de 01/10 a 11/11. Depois, **a partir de 12/11, as vendas novas entram todo dia, à noite, depois das 19h, quando o tour termina**, até o Ronaldo avisar que o sistema antigo foi desligado.
11. **A venda é local first (12/11):** o vendedor vende com tudo na mão, sem depender de internet nem do servidor. Nada de vídeo carregando ou baixando na hora da venda: os vídeos de demonstração ficam guardados no tablet (seção 3, item 2).
12. **Fora deste plano:**
    - escala da equipe;
    - central de WhatsApp;
    - voos e telemetria;
    - comissão interna.

## 2. Catálogo

Produtos e preços praticados hoje, conferidos no levantamento do sistema antigo (docs 02 e 17) e nas vendas de 01/10 a 11/11. Esses são os valores da carga inicial. Depois disso, quem muda preço é o admin. **Nenhum preço fica fixo no código.**

| Produto | Local | Preço |
|---|---|---|
| Drone, Asteroid | Campo ou Arquibancada | R$ 180 |
| Drone, Boomerang | Campo ou Arquibancada | R$ 120 |
| Drone, Boomerang com chuva | No modo chuva, só o Boomerang é vendido | R$ 180 |
| Drone, Inside Out | Campo ou Arquibancada | R$ 220 |
| Drone, Inside Out | Banco de Suplentes | R$ 250 |

Adicionais do Drone:

- **4K:** + R$ 70.
- **Pessoas no vídeo:** de 1 a 4 na demonstração. Nas vendas de outubro, o preço não mudou até 8 pessoas, então a cobrança por pessoa extra começa desligada.

| Chute a Gol | Preço |
|---|---|
| 3 Chutes | R$ 110 |
| 5 Chutes | R$ 140 |
| 3 Chutes + Medalha + Vídeo | R$ 149 |
| 5 Chutes + Medalha + Vídeo | R$ 169 |
| 5 Chutes + Mini bola + Medalha + Vídeo | R$ 229 |
| 5 Chutes + Bola Semi-Pro + Medalha + Vídeo | R$ 259 |
| 5 Chutes + Bola Pro + Medalha + Vídeo | R$ 279 |
| Avulsos: Medalha R$ 60 · Mini bola R$ 115 · Bola Semi-Pro R$ 170 · Bola Pro R$ 195 | |

| Snap Pop (vídeo com IA; tema Brasil, Flamengo ou Fluminense) | Preço |
|---|---|
| 1 vídeo | R$ 110 |
| 2 vídeos | R$ 190 |
| 3 vídeos | R$ 290 |
| A partir do 4º | + R$ 90 cada |

Cada produto do catálogo tem:

- **Categoria:** Drone, Chute a Gol ou Snap Pop.
- **Tipo de entrega:** vídeo, foto ou item físico. Medalha e bola são itens físicos.
- **Variações** por local, cada uma com preço próprio.
- **Regras de preço:**
  - valor por pessoa extra e limite de pessoas;
  - adicional 4K;
  - vale com chuva;
  - restrição de local.
- **O que a venda pede:** participantes (chutes), pessoas no vídeo, ou nenhum dos dois.
- **Ativo** e **ativo hoje**. "Ativo hoje" desliga o produto só naquele dia e volta sozinho no dia seguinte.

A tela de admin é uma aba nova em **Preços e Checkout**, com a mesma permissão `catalogo`. Desligar no dia fica liberado também para o supervisor.

## 3. Venda no tablet

Uma tela nova no menu Venda, com o título **Drone, Chute a Gol e Snap Pop** (sem a palavra "Ativações", Ronaldo, 12/11). Ela segue o padrão visual do Posto de venda. Feita na v99.17.3 e refeita na v99.17.4, sem o recibo impresso, que fica para depois.

No topo, o nome de quem está logado e a situação do envio. Duas abas: **Nova venda** e **Minhas vendas**.

A Nova venda segue esta ordem (12/11):

1. **Serviço:** Drone, Chute a Gol, Snap Pop. Aparecem só os produtos ativos hoje. O Snap Pop é vídeo com IA, não voo: conta "Vídeos com IA".
2. **Pessoas no vídeo e vídeo de demonstração (Drone):** o vendedor escolhe de 1 a 5 pessoas. Cada produto tem um botão **Ver vídeo com N pessoas**, que abre em tela cheia o vídeo daquele produto, local e número de pessoas, para convencer o cliente.
   - Os vídeos ficam no servidor do ponto, em `~/Eterna/ativ-demo/<produto>_<campo|arquibancada|banco>_<pessoas>.mp4` (35 vídeos em 720p sem áudio, 199 MB; os originais em 1080p estão fora do repositório).
   - O tablet copia os vídeos em segundo plano para o IndexedDB (`eterna-ativ`, store `demo`), sem barra e sem espera, e só baixa de novo quando o arquivo muda no servidor. Na venda, o vídeo toca do tablet.
   - Vídeo que ainda não está no tablet toca do servidor do ponto, se houver rede. Sem os dois, a tela diz que o vídeo ainda não está no tablet e a venda segue.
   - Rotas: `GET /ativ/demo/lista` e `GET /ativ/demo/<nome>` (com `ativvenda.r` ou `catalogo.r`).
3. **Venda (carrinho):** cada card tem o local e o botão **Adicionar**. O carrinho junta produtos das três categorias. Cada item tem local, quantidade, pessoas e as opções.
   - Os adicionais entram sozinhos: pessoa extra, 4K, chuva.
   - **Preço fixo (decidido 12/11):** vale o preço do catálogo, com os adicionais somados sozinhos. O vendedor não digita valor, diferente do sistema antigo, que aceitava desconto ou acréscimo. Só o admin muda preço, em Preços e Checkout. Venda grátis só como Cortesia.
4. **Cliente:** país numa lista com bandeira, com os principais no topo e todos os países do mundo em ordem alfabética; idioma numa lista com Português, Espanhol, Inglês, Francês, Alemão, Italiano e Outro. O nome fica gravado em português. O idioma serve para o recibo e a galeria abrirem no idioma dele. O país alimenta o resumo por país. Nenhum dos dois identifica a pessoa.
5. **Pagamento:** PIX, Dinheiro, Débito, Crédito ou **Cortesia**. Na Cortesia, o motivo e a nota são obrigatórios.
6. **Registrar** (botão fixo embaixo): grava a venda no próprio tablet na hora, com número próprio e quem vendeu, e envia ao servidor do estádio. Imprime o recibo no idioma do cliente, se houver impressora no posto.
   - Uma venda igual registrada em até 2 minutos pelo mesmo vendedor pede confirmação.

**Fora da tela (12/11):** o guia não é escolhido na venda; a escolha dele fica no projeto de guias que já existe. Não há agendamento de voo.

**Local first:** a venda nunca espera a rede.
- O catálogo fica guardado no tablet. A tela de venda abre e vende sem internet e sem o servidor.
- A venda é gravada no tablet na hora, numa caixa de saída, com um código gerado no próprio tablet. O envio ao servidor do estádio, pela rede local, acontece em seguida.
- Sem rede, a venda fica na caixa de saída com a situação "Aguardando envio" e é reenviada sozinha. O servidor reconhece o código, então reenviar nunca duplica.
- O dono do dado continua sendo o servidor (`2026-11-10-dado-no-banco.md`): a caixa de saída só guarda o que ainda não chegou lá. A venda acontece só dentro do estádio e nunca depende da nuvem.

**Nenhuma venda se perde no tablet (12/11):**
- A venda é gravada em duas cópias no tablet: `localStorage` (`eterna.ativ.saida.v1`) e IndexedDB (`eterna-ativ`). A tela só diz "registrada" depois que pelo menos uma das duas gravou. Se nenhuma gravar, o carrinho continua na tela com o aviso.
- Ao abrir o app, as duas cópias são juntadas. Se uma sumir, a outra a devolve.
- A venda só sai da caixa de saída com o ok do servidor (`POST /ativ/venda`, que devolve as recebidas). Sem rede, o tablet tenta de novo a cada 5 s e quando o aparelho volta à rede. Venda que o servidor já tem conta como recebida, sem duplicar.
- Venda recusada pelo servidor nunca é apagada. Ela fica no tablet com a situação "Recusada pelo servidor", e o botão **Salvar cópia das vendas não enviadas** baixa um arquivo com elas.
- Sair da conta, trocar de vendedor ou atualizar o app não mexem na caixa de saída. O app pede ao navegador armazenamento persistente.
- O servidor confere só o formato. Produto e preço diferentes do catálogo do servidor não são recusados, porque o tablet pode ter vendido com o catálogo que tinha.
- O cancelamento precisa do servidor. **O vendedor não cancela** (12/11): só o administrador e quem tem `ativvenda.d` ou `financeiro.u`, e só enquanto o vídeo não foi entregue (venda com entrega ou QR ligado devolve 409). O botão Cancelar só aparece para quem tem a permissão. A venda cancelada continua no banco, com motivo, quem e quando, e sai do Resumo.
- Um carrinho com mais de um serviço vira uma venda por serviço, com o mesmo número. Assim o resumo por serviço fica certo.

Todo texto novo entra nos idiomas: `EQ`/`TE` nas telas da equipe e `I18N`/`T` no recibo e na galeria. O teste `testes/idiomas.js` cobra as chaves.

## 3b. Vendedores

Cada vendedor tem cadastro próprio no Eterna, com nome e login. Hoje são 12 tablets, cada um com o seu vendedor. A lista de tablets e logins fica com o Ronaldo e entra direto no cadastro do servidor, fora deste repositório.

- **Módulo próprio, `ativvenda` (12/11):** Criar = registrar venda; Ver = abrir a tela e ver as próprias vendas; Excluir = cancelar venda com o vídeo não entregue. A tela saiu do módulo Posto de venda.
- **Perfil pronto "Vendedor Drone, Chute a Gol e Snap Pop":** só `ativvenda` Criar e Ver, menu só com a tela de venda, que abre direto ao entrar. O vendedor não vê o resto do sistema e não cancela. O Supervisor tem o módulo inteiro; o Admin, como sempre, tudo.
- **Login:** o admin cadastra a pessoa em Usuários, escolhe o perfil acima e gera a senha provisória em Senhas de acesso. No tablet, o vendedor entra com o e-mail e a senha e troca a senha no primeiro acesso.
- **Quem está logado:** o tablet chama o servidor a cada 30 s com a tela aberta. No Resumo, o painel **Equipe agora** mostra cada vendedor visto nas últimas 16 h: "Conectado" (visto há menos de 2 min) ou "Visto há N min". Rota `GET /ativ/equipe` (com `estatisticas.r`, `financeiro.r` ou `ativvenda.d`). Fica só na memória do servidor.
- A venda grava quem vendeu, e o resumo mostra o vendedor pelo nome.
- As vendas importadas do sistema antigo são ligadas ao vendedor pelo nome. Um nome que não estiver no cadastro aparece como veio.

## 4. Entrega

**O QR é ligado no campo, na entrega.** A venda fica na fila do produto sem QR. Na hora de entregar:

1. a equipe abre a venda na fila (Drone, Chute a Gol ou Snap Pop);
2. a câmera do tablet lê o QR de um cartão novo;
3. o vídeo é enviado e fica ligado à venda e a esse QR;
4. o cartão vai para o cliente.

Regras:

- Uma venda pode ter um QR por vídeo. Um QR já usado é recusado.
- Só aceita arquivo de produto que entrega vídeo.

**Envio:** o vídeo sai do cartão de memória do drone e é enviado pela tela da fila, ou pela pasta vigiada do agente no servidor do estádio, que já faz isso com as fotos.

- O arquivo sobe para o S3 em partes, mostrando progresso e velocidade.
- Tamanho, duração, resolução e miniatura saem do próprio arquivo.
- O cliente pode ler o QR enquanto o envio termina. A galeria mostra "seu vídeo está chegando" até o arquivo ficar pronto.

**Galeria:** o QR abre a galeria no eterna.photo. O caminho é o mesmo das fotos:

1. o cliente informa o e-mail;
2. faz a selfie e dá o aceite de imagem;
3. baixa o vídeo.

A galeria conta os downloads de cada arquivo.

**Fotos do Drone:** ficam com as outras fotos do tour, na sessão do cliente, e são vendidas no checkout das fotos com os pacotes de sempre. Não passam pelo QR do vídeo.

**Itens físicos:** medalha e bola recebem baixa de "entregue" um a um. A venda fica **entregue**, com data e hora, quando todos os itens estiverem entregues.

**Fila do Drone:** lista as vendas de Drone ainda não voadas, por horário de execução. Para cada venda, o host marca:

- **recebido**;
- **voo feito**, com piloto, drone e bateria;
- **entregue**, quando o QR é ligado ao vídeo (passos acima).

Pilotos, drones e baterias têm cadastro simples, com ativo e inativo.

**Prazo da galeria e LGPD:**

- **O vídeo fica 30 dias na nuvem** e depois é apagado. Cada vídeo tem no máximo 30 segundos.
- O vídeo de venda cancelada é apagado.
- A venda não guarda dado pessoal. E-mail e selfie seguem as regras atuais da galeria.

### 4a. Feito na v99.18.0: entrega no servidor do ponto e no tablet

Tela **Entrega dos vídeos** (menu Venda), módulo `ativentrega` (Criar = ligar o QR e mandar o vídeo; Ver = a fila; Alterar = recebido, voo, itens e o cadastro) e perfil pronto **Equipe de campo** (só esta tela). O Supervisor tem o módulo inteiro.

- **Fila do dia** por serviço (Drone, Chute a Gol, Snap Pop), com Pendentes e Entregues, na ordem da venda (não há agendamento de voo, 12/11). Situação em palavras: "Aguardando o cliente", "Aguardando voo", "Aguardando vídeo", "Entrega pendente", "Entregue".
- **Cliente chegou** e **Voo feito** (Drone): o voo pede piloto, drone e bateria, escolhidos do cadastro ativo. O cadastro fica no fim da tela: inclui e liga ou desliga, nunca apaga.
- **Entregar vídeo N:**
  1. o QR do cartão é lido pela câmera do tablet (`BarcodeDetector`, Chrome do Android) ou pelo leitor, que digita o link; colar o link também vale. Cartão já usado é recusado na hora;
  2. a equipe escolhe o vídeo do cartão do drone (.mp4 ou .mov) e ele vai ao servidor do ponto com barra de progresso e velocidade.
- **Servidor do ponto** (`POST /ativ/video?venda=&qr=`, um vídeo por vez, até 1 GB): confere a venda (ativa e ainda sem todos os vídeos que comprou) e o QR (formato, nunca usado numa entrega nem numa galeria de fotos) antes de ler o arquivo, confere que é mp4/mov e lê a duração do próprio arquivo. Guarda em `~/Eterna/ativ-videos/<qr>.mp4`, grava a linha em `ativ_entrega` e o QR na venda.
- **Itens físicos** (medalha, bola, do catálogo do pacote): baixa um a um. A venda fica **entregue**, com data e hora, quando todos os vídeos têm QR e todos os itens tiveram baixa. Entregue não cancela.
- **Nuvem:** o vídeo entra numa fila própria (`nuvem.db`, tabela `videos`) e sobe para `video/<qr>.mp4` no bucket em partes de 8 MB, conferindo o tamanho no fim. Sem internet, tenta de novo com espera crescente. A tela mostra "Aguardando internet", "Subindo N%" ou "Na nuvem".
- **Galeria do vídeo:** o QR vira o token de uma galeria `tipo: "video"` (manifesto com o vídeo, o idioma da venda e validade de 30 dias), publicada pela fila de galerias de sempre.
- **Prazo:** o arquivo sai do servidor do ponto depois de 30 dias (limpeza diária); a linha da entrega fica como registro.
- Rotas: `GET /ativ/fila?dia=`, `POST /ativ/etapa`, `POST /ativ/video`, `GET|POST /ativ/cadastros`. Testes: `testes/ativacoes_entrega_agente.py` e `testes/ativacoes_entrega.js`.

### 4b. Falta (parte 2): o vídeo na galeria da nuvem

- A Lambda da galeria (`servidor/galeria-nuvem/app.py`) ainda só conhece fotos: aceitar o manifesto `tipo: "video"`, devolver o link assinado do vídeo (`video/<qr>.mp4`) e "seu vídeo está chegando" enquanto ele não estiver no bucket, e contar os downloads.
- A página do cliente (`index.html`, `#g/<token>`) precisa do player e do botão de baixar, sem passar o vídeo inteiro pela memória do celular.
- No bucket: regra de prazo de 30 dias para o prefixo `video/`. Na política do agente: `s3:AbortMultipartUpload`.
- Esses passos pedem `sam deploy` da nuvem, que o Ronaldo faz; nunca a partir de `idiomas-base`.

## 5. Vendas: listar, editar, cancelar

- **Minhas vendas (vendedor):** as vendas do dia com número, hora, QR, itens, pagamento e valor, e os totais por forma de pagamento.
  - O vendedor cancela ou reagenda a própria venda, com confirmação.
- **Vendas das ativações (supervisor e gestor):** todas as vendas, atualizando sem recarregar.
  - **Situação em palavras:** "Aguardando arquivo", "Entrega pendente", "Entregue", "Cancelada".
  - **Filtros:** produto, data e drone. **Busca:** número ou QR.
  - **Totais do filtro:** vendas, arquivos, pessoas e valor.
  - **Edição:** feita por formulário. Cada mudança grava quem mudou, quando, o valor anterior e o novo. Ao trocar itens, dá para manter o valor negociado.
  - **Cancelamento:** pede motivo. Venda cancelada não some; aparece separada.
- **Resumo no celular** (tela **Resumo das ativações**, no Dashboard, feita na v99.17.2): para o gestor acompanhar de qualquer lugar, como o resumo do sistema antigo, que o Ronaldo usa hoje. Fica no módulo Números de vendas, e quem já via a Lista de vendas ganha a tela no menu.
  - **Filtros:** produto (Drone, Chute a Gol, Snap Pop); dia, semana ou mês, com setas e arrastar para mudar o dia.
  - **Totais:** total vendido, número de vendas e de vídeos.
  - **Por pagamento:** vendas e valor de PIX, Crédito, Dinheiro, Débito e Cortesia.
  - **Por vendedor:** vendas e valor, do maior para o menor, pelo nome.
  - **Serviços vendidos:** quantidade por produto e local.
  - **Por país:** vendas e valor.
  - Atualiza sozinho a cada minuto; quando a venda no tablet entrar, a cada venda nova, com som opcional.
  - Filtro extra "Todos os serviços" e escolha de data, com o botão Hoje.
- **Painel e Estatísticas:** as ativações entram com as fotos:
  - receita por produto, por vendedor e por forma de pagamento;
  - valor da Cortesia (o preço do catálogo que foi dado);
  - arquivos entregues e baixados.

As vendas importadas do sistema antigo aparecem nas mesmas telas, com a origem "Sistema antigo", e só para leitura.

## 6. Histórico do sistema antigo

**Como funciona (feito na v99.17.2):**

- O importador é `agente/ativacoes-importar.py`. Ele roda no servidor do ponto, com o mesmo HOME do agente, e grava na tabela `ativ_venda` do `vendas.db`.
- Ele aceita dois tipos de arquivo:
  - a planilha exportada do sistema antigo (`.csv` com separador `;`; Chute a Gol e Snap Pop vêm em seções `##chute_gol` e `##snap_pop`);
  - a extração diária das telas de venda (`.json`), descrita abaixo.
- Nome, WhatsApp e foto do cliente são lidos e descartados no importador. O agente também recusa qualquer venda que traga um campo fora da lista (`ATIV_VENDA_CAMPOS`).
- O que é gravado: dia e hora, itens (produto, local ou tema, quantidade), valor em reais, pagamento, vendedor, pessoas ou participantes, vídeos, resolução, país, idioma, guia, piloto, drone, bateria, entrega e QR.
- Ajustes na leitura:
  - venda de R$ 0 vira **Cortesia**;
  - "asteroid_campo" vira produto Asteroid com local Campo;
  - FLA, FLU e BRA viram Vídeo com IA com o tema;
  - o idioma é gravado em português;
  - o país é gravado sem o DDI.
- **Vendedor:** a extração diária mostra "VendedorNN". A opção `--vendedores` aponta para a lista dos 12 tablets, que fica fora do repositório, e troca o número pelo nome.
- **Chave:** a origem mais o ID antigo. Rodar duas vezes não duplica nada, e uma venda corrigida no sistema antigo é atualizada.
- **Leitura:** a rota `GET /ativ/vendas?de=&ate=` exige Estatísticas, Financeiro ou Relatórios. Ela alimenta o Resumo das ativações (seção 5).

**Carga inicial (de 01/10 a 11/11):** as duas planilhas exportadas pelo Ronaldo e as extrações diárias da auditoria de vendas. As planilhas ficam no computador do Ronaldo e **não entram no repositório**.

**Vendas novas, todo dia, até o desligamento:**

- **Horário:** 19h30, depois que o tour termina.
- **Fonte:** o extrator de vendas da auditoria diária, que lê as telas de venda do sistema antigo pelo Chrome do Ronaldo, só para leitura. Ele gera o mesmo `.json` que o importador já lê, sem dado de cliente.
- O robô da VM do portal de parceiros não é usado nesta etapa.
- A auditoria das 07:30 continua como está. Se a puxada da noite falhar, a do dia seguinte cobre o dia que faltou, porque reimportar não duplica.
- Quando o Ronaldo avisar o desligamento, a tarefa da noite é desligada, e as vendas antigas ficam no Eterna como histórico.

## 7. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1. Catálogo e admin | Produtos, variações, regras de preço, ativo hoje | O admin cadastra os produtos da seção 2 e desliga um deles no dia |
| 2. Venda no tablet | Tela Ativações, carrinho, cortesia, recibo, Minhas vendas | Venda completa em menos de 60 s no tablet, com teste automático |
| 3. Histórico | Importador das planilhas e passo diário na tarefa da auditoria | Totais por dia no Eterna iguais aos do sistema antigo |
| 4. Entrega | QR lido no campo e ligado ao vídeo, S3 em partes, vídeo na galeria, fila do Drone, itens físicos | O cliente baixa o vídeo pelo QR, com e-mail e selfie |
| 5. Gestão | Vendas das ativações com edição registrada, Painel e Estatísticas | Fechamento do dia por produto, vendedor e pagamento |

A fase 3 pode correr junto com as fases 1 e 2, porque não depende de tela nova.

Cada fase vira uma versão em `VERSOES.md` e tem teste em `testes/`.

## 8. Em aberto

1. **Cartão com QR (decidido 11/11):** cartão próprio do vídeo, ligado no campo na entrega; as fotos do Drone ficam com as outras fotos.
2. **Fotos do Drone (decidido 11/11):** quadros tirados do próprio vídeo, no ângulo aberto que pega o campo. Entram na sessão de fotos do cliente, junto com as do tour. Falta definir como cada quadro chega à sessão certa: pela venda do Drone, pela hora do voo ou por reconhecimento facial.
3. **Snap Pop (decidido 11/11):** o vídeo é gerado depois, por uma integração a fazer. Até lá, o Eterna vende e registra o Snap Pop, e a entrega segue a regra do QR quando o arquivo existir.
4. **Preços (decidido 11/11):** ficam os da seção 2, tirados da documentação e das vendas.
5. **Prazo do vídeo (decidido 11/11):** 30 dias na nuvem; cada vídeo tem no máximo 30 segundos.
6. **Compra online das ativações:** entra no checkout da Imply depois, quando a compra online das fotos estiver no ar.
7. **Venda só nos horários da Imply (12/11):** o Ronaldo quer estudar consumir a Imply para vender somente nos horários com vaga (allotment). Ele passa a chave depois. **Por ora a venda é livre.**
