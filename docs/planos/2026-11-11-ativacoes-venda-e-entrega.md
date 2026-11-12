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
8. **O admin troca preço e vídeo de demonstração**, e pode desligar um produto no dia ("hoje não vendo").
9. **Por enquanto, vídeo do Drone e Chute a Gol só se compram no local.** A compra online (Imply, plano `2026-11-11-compra-online-pela-imply.md`) continua só para fotos. As ativações entram nela depois.
10. **O histórico do sistema antigo entra no Eterna.** Primeiro, as planilhas exportadas de 01/10 a 11/11. Depois, **a partir de 12/11, as vendas novas entram todo dia, à noite, depois das 19h, quando o tour termina**, até o Ronaldo avisar que o sistema antigo foi desligado.
11. **Fora deste plano:**
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
- **Vídeos de demonstração:** até 4 por produto, conforme o número de pessoas.
- **Ativo** e **ativo hoje**. "Ativo hoje" desliga o produto só naquele dia e volta sozinho no dia seguinte.

A tela de admin é uma aba nova em **Preços e Checkout**, com a mesma permissão `catalogo`. Desligar no dia fica liberado também para o supervisor.

## 3. Venda no tablet

Uma tela nova, **Ativações**, no menu de venda. Ela segue o padrão visual do Posto de venda.

1. **Abas:** Drone, Chute a Gol, Snap Pop. Aparecem só os produtos ativos hoje.
2. **Demonstração:** tocar no produto abre o vídeo de exemplo em tela cheia, conforme o número de pessoas escolhido.
   - O tablet baixa os vídeos uma vez, com barra de progresso, e toca sem internet.
   - Quando o admin troca um vídeo, o tablet baixa só o novo.
3. **Carrinho:** junta produtos das três categorias na mesma venda. Cada item tem local, quantidade e as opções.
   - Os adicionais entram sozinhos: pessoa extra, 4K, chuva.
   - O carrinho mostra o **preço sugerido**. O vendedor pode mudar o **preço cobrado**, e os dois ficam gravados.
4. **Guia (opcional):** escolha do guia pelo nome, com busca. A comissão continua no Portal de Parceiros.
5. **Pagamento:** PIX, Dinheiro, Débito, Crédito ou **Cortesia**. Na Cortesia, o motivo e a nota são obrigatórios.
6. **Idioma do cliente:** só para o recibo e para a galeria abrirem no idioma dele. Não é dado pessoal.
7. **Execução:** imediata ou agendada (dia e hora). Serve para o Drone.
8. **Registrar:** grava a venda no servidor do estádio, com número próprio e quem vendeu. Imprime o recibo no idioma do cliente, se houver impressora no posto.
   - Uma venda igual registrada em até 2 minutos pelo mesmo vendedor pede confirmação.

A venda fica no servidor, nunca só no navegador (`2026-11-10-dado-no-banco.md`). Se o tablet perder a conexão com o servidor, a tela avisa e não registra. A venda acontece só dentro do estádio, na rede local.

Todo texto novo entra nos idiomas: `EQ`/`TE` nas telas da equipe e `I18N`/`T` no recibo e na galeria. O teste `testes/idiomas.js` cobra as chaves.

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

## 5. Vendas: listar, editar, cancelar

- **Minhas vendas (vendedor):** as vendas do dia com número, hora, QR, itens, pagamento e valor, e os totais por forma de pagamento.
  - O vendedor cancela ou reagenda a própria venda, com confirmação.
- **Vendas das ativações (supervisor e gestor):** todas as vendas, atualizando sem recarregar.
  - **Situação em palavras:** "Aguardando arquivo", "Entrega pendente", "Entregue", "Cancelada".
  - **Filtros:** produto, data e drone. **Busca:** número ou QR.
  - **Totais do filtro:** vendas, arquivos, pessoas e valor.
  - **Edição:** feita por formulário. Cada mudança grava quem mudou, quando, o valor anterior e o novo. Ao trocar itens, dá para manter o valor negociado.
  - **Cancelamento:** pede motivo. Venda cancelada não some; aparece separada.
- **Painel e Estatísticas:** as ativações entram com as fotos:
  - receita por produto, por vendedor e por forma de pagamento;
  - preço sugerido × cobrado;
  - arquivos entregues e baixados.

As vendas importadas do sistema antigo aparecem nas mesmas telas, com a origem "Sistema antigo", e só para leitura.

## 6. Histórico do sistema antigo

**Carga inicial (de 01/10 a 11/11):**

- Fonte: as duas planilhas exportadas pelo Ronaldo.
  - Drone: 1.754 vendas.
  - Chute a Gol e Snap Pop: duas seções no mesmo arquivo.
- As planilhas ficam no computador do Ronaldo e **não entram no repositório**, porque têm nome e WhatsApp de clientes.
- O importador:
  - lê as planilhas;
  - converte datas e valores (o valor vira centavos);
  - separa os itens ("1x 5 Chutes");
  - envia ao servidor só o que o Eterna usa: data, produto, local, itens, pessoas, valor, pagamento, vendedor, guia, idioma, piloto, drone, bateria, QR e situação da entrega.
- Nome e WhatsApp do cliente **não são importados.** A venda nova também não tem esses dados.

**Vendas novas, todo dia, até o desligamento:**

- **Horário:** todo dia, à noite, depois das 19h, quando o tour termina. Uma tarefa agendada própria, às 19h30, puxa as vendas do dia.
- A extração usa o mesmo extrator da auditoria de vendas (`maracatour/auditoria-vendas/ferramentas/extrair_maracafly.js`), pela sessão do Ronaldo no Chrome. O importador lê o arquivo e envia ao Eterna.
- A auditoria das 07:30 continua como está. Se a puxada da noite falhar, a tarefa avisa e a do dia seguinte cobre o dia que faltou.
- A chave de cada venda é a origem mais o ID antigo. Rodar duas vezes não duplica nada, e uma venda corrigida no sistema antigo é atualizada.
- Quando o Ronaldo avisar o desligamento, a tarefa da noite é desligada, e as vendas antigas ficam no Eterna como histórico.

## 7. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| 1. Catálogo e admin | Produtos, variações, regras de preço, vídeos de demonstração, ativo hoje | O admin cadastra os produtos da seção 2 e desliga um deles no dia |
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
