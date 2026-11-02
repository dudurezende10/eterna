# O que o mercado de fotografia tem e o Eterna ainda não (02/11/2026)

Inclui a Roverpix, o sistema atual (seção 6).

**Só análise. Nada daqui entra no Eterna agora.** Primeiro precisamos planejar como cada item se encaixa no que já existe, e decidir junto com o Eduardo e o Bruno. Claude: não implemente nenhum item deste documento sem um plano aprovado.

Feito a pedido do Ronaldo para ele, o Eduardo e o Claude do Eduardo. É o cruzamento do que aprendemos com os fornecedores ao longo de 2026 com o que o Eterna faz na v90 (`docs/relatorios/2026-10-31-servidor-do-ponto-robusto.md`).

**Fontes** (todas na pasta Downloads do Ronaldo; nada foi enviado para fora):

| Sigla | Material |
|---|---|
| MM | Magic Memories: resposta ao RFP em português, deck de 2026, calculadora de receita, política de guarda de dados e reteste do pentest; reuniões de 10/09 e 16/09 com o Eduardo |
| PP | PhotoPark: apresentação e ata de 22/07 |
| FS | Fornecedora italiana ("FotoSmile"): call de 02/09 com a Melissa |
| FT | Fotop: reunião de 11/09 e demo de 14/09 |
| FB | Fabrika de Eventos: reunião de 11/08 |
| CP | Comparativo de sistemas de fotografia de tour |
| RQ | Requisitos técnicos para 20 mil fotos/dia |
| GR | Transcrição da Ticketmaster (granola), na parte de foto e cashless |
| GO | GoPhoto / CaptureLife: e-mails de 28/08 a 15/10, "GoPhoto x Viva Maracana.pdf" |
| SN | Sniper Action Photo: e-mails de 27/08 a 23/09, resposta ao RFP de 09/09 |
| II | Image Insight: e-mails de 27/08 a 15/09 (sem proposta) |
| BK | Banlek: e-mails de 14 e 15/10 |
| OT | Photos.live / Oto.live: e-mails de 09 a 28/10, apresentação, resumo do Fireflies de 16/10 |
| FG | FTG / Fotográfica: ata no Monday de 21/09 |
| FO | Fotosmile: proposta formal de 07/09 ("Viva Maracanã offer.pdf") |
| CO | Comparativo de 15/09 enviado ao time (`Selecao_Fornecedor_Fotografia_Tour_Maracana.docx`) e e-mails da negociação com a Magic Memories |

O histórico de cada contato está no Monday, no item "Busca de Fornecedor de Fotografia" do board Diretoria de TI. Quase todos os subitens só têm título; o conteúdo está nos e-mails. Não há registro do conteúdo da reunião com a Fábrica dos Sonhos nem da reunião com a Snap Pop. Nos e-mails de outubro, "Snap Pop" aparece como experiência vendida no ponto de venda, ao lado de Drone e Chute a Gol.

**Como a concorrência terminou:**
- **14 e 15/10:** GoPhoto, Fotosmile e Banlek receberam "concluímos o bid e seguiremos com o fornecedor atual" (a Roverpix).
- **Magic Memories:** ficou pausada, não recusada. A pausa foi em 30/09 e 01/10, porque o tour começou em 01/10 com o fornecedor atual. Em 14/10 ela avisou que abriu a primeira operação no Brasil (Hasbro / Be-Fun, em São Paulo).
- **15/10:** o Eduardo mandou ao Bruno o comparativo Roverpix x Eterna.

## 1. Números de referência

**Plano da Magic Memories para o Maracanã (MM):**
- 420 mil visitantes por ano, grupos de 2,5 pessoas;
- **68% dos grupos fotografados**;
- **31% a 38% dos grupos compram** (o RFP diz 38%, a calculadora usa 31%);
- ticket médio de **R$ 110** no RFP, **US$ 22** na calculadora;
- **US$ 1,96 por visitante**.

**Calculadora da Magic Memories:**

| Cenário | Grupos que compram | Ticket médio | Receita por ano |
|---|---|---|---|
| Moderado | 28% | US$ 20 | US$ 619 mil |
| Base | 31% | US$ 22 | US$ 824 mil |
| Otimista | 45% | US$ 27 | US$ 1,54 milhão |

**Peso do online:**
- No plano da Magic Memories para o Maracanã, só 25% dos grupos abrem a galeria online e 2% compram (US$ 10 mil por ano no cenário base).
- No painel real de outro cliente deles, o online foi **cerca de 6%** da receita.
- A venda forte é no local.

**Foto incluída no ingresso (MM):** somando US$ 3,99 em todo ingresso, eles projetam **mais de US$ 1,7 milhão por ano**. É a maior alavanca citada por qualquer fornecedor.

**Operação atual do Tour (FB e FT):**
- preço de R$ 49,90;
- 23 a 25 fotos por visitante;
- 7 caixas, cerca de 3 min de escolha por cliente mais cerca de 5 min de espera da impressão;
- meta de 114 vendas por dia;
- 421 mil visitantes em 2025, com meta de 1 milhão entre 2029 e 2030.

**Referência Barça (MM):** 1,5 milhão de visitantes por ano, 2 fotos por pessoa em menos de 1 minuto, 12 a 15 pontos de venda na alta temporada.

**Barça e Fenway Park, na negociação (CO):**
- **40% a 42% dos grupos fotografados compram**;
- ticket médio de **US$ 42 a 44**;
- **US$ 4,80 por pagante**.

É o teto de referência, bem acima do plano da Magic Memories para o Maracanã.

**Quanto cada fornecedor cobraria (CO, FO, SN, GO):**

| Fornecedor | Modelo |
|---|---|
| Magic Memories | 1ª oferta: US$ 0,35 por grupo fotografado + US$ 2,50 por venda. Oferta final: **US$ 0,75 + US$ 0,75**, com até 15 produtos por álbum (2 em vídeo, 3 com fundo de IA). Equivale a uns 4,7% a 9,3% da receita, conforme a conta do comparativo. Implantação paga pela Maracatour. |
| Fotosmile | **23% das vendas no local** e **49% das vendas pós-visita** (que ela opera), mais € 0,006 por foto e técnico a € 850. Contrato de 3 anos. Foi a mais cara do comparativo: R$ 125 a 168 mil por ano. |
| Sniper Action Photo | **15% da receita bruta** (descontados cartão e mídia) **ou US$ 2.500 por mês fixos**. 12 meses, piloto de 60 dias. |
| GoPhoto | Taxa fixa, sem divisão de receita, estimada em **6% a 15% da receita**. Não houve preço fechado. |

**Custo de impressão (FB):** cerca de R$ 2 por foto, mais R$ 2 com ímã.

**Remuneração da Magic Memories:** 14% sobre o valor líquido mais US$ 6 mil de implantação. Toda integração é cobrada à parte.

**O que o Eterna precisa medir para comparar:** o Painel já tem visitantes (catraca), sessões, vendas e ticket. Faltam **"% de grupos fotografados"** e **"% de grupos que compram"** com a mesma definição da Magic Memories. Sem isso, não dá para saber se estamos acima ou abaixo de 31% e US$ 1,96 por visitante.

## 2. Onde o Eterna já está à frente

Duas coisas que as empresas novas ofereciam já estão no Eterna:
- **"uma face por selfie"** (GoPhoto) = a nossa **uma pessoa por vez**, na v90;
- **busca restrita ao dia, para ter velocidade** (Sniper) = a **janela da selfie de 90 minutos**, ajustável, na v91. A busca leva 53 ms na primeira vez e 8 ms nas seguintes, com 3.000 fotos.


- **Reconhecimento facial local e sem internet** (YuNet + SFace no servidor do ponto). A Magic Memories processa rostos na AWS dos EUA (US-West-2). A PhotoPark usa Roverpix. A Fotop depende da nuvem.
- **Menores e escolas:** QR geral do grupo, mostrando só as fotos em que o rosto da criança bate. Na Magic Memories, o menor só se autodeclara com 13 anos ou mais.
- **Antifraude da selfie:** uma pessoa por vez, e o cliente vê só as fotos dele. Nenhum fornecedor citou isso.
- **Pix e maquininha Imply:** a Magic Memories não suporta Pix sem desenvolvimento.
- **Sem taxa sobre a venda**, sem remessa ao exterior (o Ronaldo estimou uns 27% de imposto) e com os dados de vendas no servidor do ponto, com backup próprio.
- **Fundos de IA sem chroma, com custo zero**, uma das dores do Rafael com a posição de chroma da entrada.
- **Fila de impressão com controle e estado real da DNP**, painel de senhas para a TV e índice do fotógrafo.

## 3. O que eles têm e o Eterna não tem

Organizado por área. Em cada item: quem tem e o que é.

### Receita e oferta
1. **Foto no ingresso e pré-venda (MM).** Direitos por tipo de ingresso: liberar algumas fotos, o álbum inteiro, ou vender upgrade, sempre deixando algo para vender. Vem integrado à ticketeira por API. Para nós, é conversa com a Imply.
2. **Foto grátis desbloqueada como isca (MM).** Uma foto liberada para todos aumenta a captura e puxa a venda das outras.
3. **Motor de regras de oferta (MM).** Decide o que oferecer por tipo de cliente, horário, o que a pessoa já comprou e quando mostrar o upsell. Produtos sazonais e de patrocinador ligam e desligam sozinhos.
4. **Digital como produto principal e impressa como upsell.** É a meta declarada pelo Ronaldo (FT), e a Magic Memories vende assim. Hoje o Tour vende a impressa.
5. **Venda de armazenamento e prazos de guarda por tipo de visitante (MM).** Quem não comprou: 90 dias. Quem comprou sem cadastro: 183 dias de mídia. Quem comprou armazenamento: pelo prazo comprado.

### Produtos (hoje o Eterna tem 10×15, digital e fundo de IA)
6. **Ímã, chaveiro e "figurinhas"** (MM, FB). Custo de cerca de R$ 2 a mais por foto com ímã.
7. **Livreto ou álbum montado** (MM; Camp Nou: livreto de 12 fotos). O exemplo do Arsenal: pacote "melhor valor" com 6 impressas, livro, álbum digital e chaveiro.
8. **A3 emoldurado** ("grande sucesso" na PhotoPark), **encarte ou folder temático** do Maracanã (PP), **capa de revista** e **"The Zoom"** (MM).
9. **Foto "assinada" por jogador**, produtos de patrocinador (MM) e **lenticular 3D** (PP).
10. **Entrega em casa** de impressos, canvas e caneca (MM).
11. **Vídeo curto ou boomerang e "multipose"** (MM): cada pose vira um produto diferente, mais o álbum do grupo.
12. **Efeitos de IA além do fundo:** ilustração para colorir, para crianças (PP), e realidade aumentada (FS e MM).

### Captura e operação
13. **Aprovar ou repetir na hora da foto (MM).** A tela do fotógrafo mostra olho fechado e problemas na hora, e isso elimina a sala de edição. No Eterna, só o olho fechado é validado de verdade, e depois.
14. **Captura automática ou acionada pelo visitante** (MM e PP): câmera fixa com botão e contagem regressiva, ou leitura do QR e disparo em 5 s. Foto Ride (PP).
15. **Alertas operacionais automáticos (MM):** câmera fora do ar, volume de fotos anormal, recurso do servidor alto. O Eterna tem a Fila do fotógrafo, mas não avisa sozinho.
16. **Imprimir antes de o cliente chegar, com mural (FB):** as melhores fotos já impressas na mão, porque "foto impressa vende mais". Exemplo do zoológico de Braga: foto impressa na saída.
17. **Papa-fila no pico (FT):** QR ou tablet para o cliente ver as fotos no celular enquanto espera o caixa.
18. **Busca alternativa ao rosto (MM):** por atributos (roupa), manual pelo operador, e tela grande com QR por foto.
19. **Estrutura física (MM, FB):** set com rodas para montar e desmontar (a maior dor declarada do campo), um flash com difusor, câmera e impressora reserva, e DNP em vez de Fuji no calor.
20. **Rede de captura cabeada, em VLAN própria (MM):** DSLR com mini-PC por cabo. É o desenho que o Eduardo pediu.

### Gestão
21. **Comissão automática e meta por fotógrafo e vendedor**, usando a calculadora como meta diária (MM, pago à parte lá). O Eterna tem índice e conversão por fotógrafo, mas não tem comissão nem meta.
22. **Painel por canal** (MM): pré-venda, patrocínio, loja e online. **Reconciliação por transação com o adquirente** (MM; para nós depende de TEF).
23. **Suporte com chamado e tempo de resposta (MM):** Zendesk 24 horas, resposta em cerca de 5 min, gerente de conta.
24. **Pentest externo independente (MM):** Black Hills, com reteste. O Eterna nunca passou por um.
25. **Duplicar a configuração do dia** (FT): preços e regras do dia anterior.

### Pós-visita
26. **Campanhas automáticas para quem não comprou (FT, MM).** A ideia do Ronaldo: avisar no 20º dia, limpar no 30º. O Igor propôs separar a venda "local" (sem marca d'água) da venda de "retarget" (com marca d'água e preço mais agressivo). Mesmo pesando cerca de 6%, é receita quase sem custo. No Eterna o plano existe (v82), mas nada foi feito: a compra online está desligada e não há e-mail nem WhatsApp.
27. **"Baixar todas"** num arquivo só (FT). No Eterna, o cliente baixa uma por uma.

### Trazido só pelas empresas do Monday e dos e-mails

**Selfie e privacidade:**

28. **Prova de vida** na selfie (GoPhoto). Ela impede usar a foto de outra pessoa no celular.
29. **Limiar de confiança alto e declarado** (GoPhoto, 92%: "melhor perder uma foto do que mostrar a família de outro"). Junto vem o botão **"Não é minha foto"**, que tira a imagem só para aquele visitante. No Eterna, o "Esta sessão também é sua?" da v91 cobre parte disso. Os 12 casos de "outra sessão" do teste de estanque mostram que vale.
30. **O visitante vê e apaga a própria biometria** e há **verificação de idade com consentimento do adulto** (GoPhoto). O reconhecimento é ligado ou desligado por campanha, e desligado não gera biometria nenhuma.
31. **Orientação na hora da selfie** (FO): pouca luz, olhos fechados, óculos.
32. **Busca por horário** junto da facial, e só por horário para quem recusa a biometria (SN).
33. **Auto-anonimização** (FO, patenteada): o visitante se esconde nas fotos de outros grupos. **Regras de privacidade por país** (FO).

**Venda e pós-visita:**

34. **Álbum compartilhado** (FO): o titular adiciona família e amigos e recebe as fotos deles.
35. **Pré-venda com pré-cadastro facial** (FO; a Magic Memories também citou pré-venda).
36. **E-mail segmentado** (FO, SN): para quem comprou parte, oferecer completar o pacote; para quem não comprou, oferecer o "Photopass".
37. **Galeria aberta por até 365 dias** para compra (GO). Hoje o Eterna deixa 60 dias.
38. **Quiosque de autoatendimento** com pagamento por aproximação, em que **a impressão sai sozinha quando o pagamento entra** (SN).
39. **Nome ou número da camisa sobreposto na foto** (SN) e **molduras sazonais trocadas remotamente** (FO).
40. **Espelho de realidade aumentada** "ao lado dos jogadores", sem chroma (FO), e **quiosque com acessibilidade** (FO).

**Operação:**

41. **Ferramentas do operador** (SN): Order Manager (marcar pedido pago em dinheiro, reimprimir, reenviar e-mail) e Print Manager (retomar a impressão depois da troca do rolo). A fila de impressão da v90 cobre parte: cancelar, reimprimir e imprimir o que faltou.
42. **Cliente oculto** como controle de qualidade (FO, FG).
43. **Comissão coletiva da equipe por desempenho** (FG).
44. **Medir filas, mapa de calor e gargalos com as câmeras de segurança**, ligado ao BI (OT). A Oto.live também faz perfil do público (idade, gênero, marcas que veste), gamificação com missões e prêmios, e acesso por face ou pela veia da palma da mão. A Oto não vende foto; é IA de operação. Ela fez visita técnica no fim de outubro e vai montar um roadmap.
45. **Dois modelos de foto** (FG): o "industrial", a foto de entrada para todos (a que mais converte), e o premium, com edição estilo Disney. A FTG prefere cenário real a chroma.

## 4. Recomendação de prioridade

A ordem leva em conta receita, esforço e o que já existe no Eterna.

| # | O que | Por quê | Esforço |
|---|---|---|---|
| 1 | **Medir como a Magic Memories mede**: % de grupos fotografados e % de grupos que compram, por dia, no Painel | Sem isso não sabemos onde estamos contra 31% e US$ 1,96 por visitante | Baixo (os dados já estão no servidor) |
| 2 | **Foto grátis desbloqueada** e **digital como principal**, com a impressa como upsell | Muda a conversão sem equipamento novo; é decisão de preço do Eduardo e do Bruno | Baixo |
| 3 | **Imprimir antes e mural**: as 2 melhores de cada sessão (as com fundo de IA, que já ficam prontas antes) saem impressas enquanto o cliente anda | Ataca a espera de 5 min da impressão e o "foto na mão vende" | Médio |
| 4 | **Produtos novos no catálogo**: ímã, livreto de 12, A3 emoldurado, encarte do Maracanã | Ticket médio; o catálogo e a impressão já existem, faltam layouts | Médio |
| 5 | **Pós-visita**: e-mail e WhatsApp, compra online ligada, "baixar todas" | Receita sem custo de operação; depende do e-mail real (também pedido para o login) | Médio |
| 6 | **Aprovar ou repetir na captura** e **alertas operacionais** | Qualidade, e menos foto ruim no Checkout | Médio |
| 7 | **Foto no ingresso e pré-venda** com a Imply | A maior alavanca de receita citada (MM), mas depende de contrato e integração | Alto |
| 8 | **Vídeo, boomerang e multipose** | Produto novo e diferencial | Alto |
| 9 | **Comissão e meta** por fotógrafo e vendedor | Engajamento da equipe; o índice já existe | Médio |
| 10 | **Pentest externo** e **política de guarda por tipo de visitante** | Antes de 01/12, com fotos de clientes de verdade | Médio (contratar) |
| 11 | **Confiança da selfie**: "Não é minha foto", orientação na hora da selfie e prova de vida | Reduz foto de outra família e fraude; parte já existe na v90 e na v91 | Médio |
| 12 | **Biometria sob controle do visitante**: ver e apagar, idade com consentimento | LGPD, antes de operar com clientes de verdade | Médio |
| 13 | **Álbum compartilhado e e-mail segmentado** | Venda pós-visita mais certeira; depende do item 5 | Médio |

## 5. Para pedir aos fornecedores ou medir no piloto

Nenhum documento trouxe:
- a taxa de conversão do totem (a Magic Memories não respondeu);
- o percentual de revenue share da PhotoPark;
- o tempo exato até a foto aparecer para venda.

O Eterna mede esse tempo na Fila do fotógrafo e no `/metricas`. Vale registrar o nosso, de ponta a ponta, para comparar.

## 6. Roverpix: o sistema atual e o que não pode faltar em 01/12

**Fontes:**
- `PRAZOS_ROVERPIX_OUT-26.pdf` (o "SLA Geral" de 14/10);
- documentação da API de relatórios;
- e-mails de junho a outubro: relatório técnico Fictix/MaracaFly de 02/06, propostas de 14 e 15/09, "Vendas Roverpix 25 e 26" de 07/10, API de 13 e 15/10, auditoria de 24/10, BI de 27/10;
- planos do Eterna (v72, v83, cartão QR).

O contrato assinado não foi encontrado nos e-mails. O comparativo Roverpix × Eterna que o Eduardo mandou ao Bruno em 15/10 é um link de artifact e não foi lido. A ata de 25/09 também ficou sem leitura.

**Quem é quem:** o software é da Roverpix, mas quem opera no estádio desde 2022 é a **Livepix, do grupo Fictix** (contato: Luiz Thiago). O relatório de junho registra indícios de que a relação Fictix–Roverpix é societária, não só de cliente e fornecedor. Uma consulta de 02/09 achou duas ações trabalhistas contra a Roverpix no TRT-2, somando cerca de R$ 351 mil.

**O que ela oferece no Tour:**
- **Captura e identificação:** cartão com QR na estação. A facial estava "em piloto".
- **Pontos de foto:** Chroma (tirado da operação em 26/10), Modo Captura (o cliente dispara no tablet), Foto Volante, PDV, PDV Mobile e Totem em que o próprio cliente paga.
- **Produtos:** pacotes de R$ 69 a R$ 250, digitais avulsas (1 por R$ 49, 3 por R$ 79, 6 por R$ 109), **porta-retrato** (R$ 75 e R$ 150), cortesias com tipo, reimpressões e venda online pelo "Site". A proposta padrão cita ainda caneca, chaveiro, globo de neve e recuperação online de quem não comprou.
- **Admin:** faturamento, conversão, ticket, ranking de produtos, **comissão por fotógrafo e por vendedor**, **integração fiscal e TEF** (bandeira, BIN, carteira digital).
- **API:** só leitura (pedidos, pagamentos, fotos), sem o link da foto nem o fundo de IA (o pedido ficou "no backlog").
- **Infraestrutura (da Fictix):** servidor Dell com reserva, sincronização com a AWS, rede Ubiquiti, link dedicado, 4 estações, 7 PDVs, 6 a 7 tablets e câmeras Canon.
- **Guarda e suporte:** fotos 30 dias no servidor local e 3 meses na nuvem. A Fictix faz o suporte de 2º nível. O "SLA" só tem prazo para pedido de mudança (2 a 10 dias úteis, nada no fim de semana). **Não há prazo para incidente.**

**Modelo comercial:**
- Proposta padrão da Roverpix (com o Ronaldo como cliente oculto, 15/09): **10% da receita**.
- Proposta Fictix/Livepix para continuar (14/09): **25% da receita bruta com piso de R$ 180 mil por mês**, 12 meses e renovação automática. Rescisão com 90 dias de aviso, 30 dias para retirar os equipamentos. O código e as bases ficam com a Fictix.

**Números reais (dados da Roverpix):**
- 2025: 109.954 cartões, 1,93 milhão de fotos, **19% vendidas**, R$ 21,66 por foto, **R$ 7,65 milhões**.
- 2026, de janeiro a setembro: R$ 6,03 milhões, com 18% das fotos vendidas.
- De 07 a 15/10 (já com a Maracatour): R$ 115 mil em 868 vendas, **ticket de R$ 133**, 24% das fotos vendidas, **56% das sessões viram as fotos no balcão**, R$ 16 por visitante.
- Auditoria de 01 a 23/10: **101 vendas sem conciliação entre a Imply e a Roverpix (R$ 8.021,70)**: vendas sem cobrança, cancelamentos que continuaram como venda e cortesias sem lançamento.

**Dores registradas:**
- Só sabe a hora de chegada da foto, não a do clique.
- Dia em UTC.
- O painel tinha um "funil disfarçado" de pizzas.
- Mudança simples leva 2 dias úteis.
- Não integra com o caixa da Imply.
- Sem LTV, CRM, retargeting nem foto-produto (admitido pela própria Fictix).
- A própria Maracatour não confia nos relatórios de custo.

**O que a Roverpix tem e o Eterna ainda não tem.** Isso pesa mais que a lista do mercado, porque é o que se perde no dia da troca:

| # | Recurso | Situação no Eterna |
|---|---|---|
| R1 | **Venda online de verdade** ("Site") | Compra online desligada e pagamento simulado |
| R2 | **Porta-retrato** (vendido hoje), caneca e chaveiro | Catálogo só com 10×15, digital e fundo de IA |
| R3 | **TEF e dados de pagamento** (bandeira, BIN, NSU automático) | NSU digitado (`pos-manual`); a conciliação dos R$ 8 mil continua aberta |
| R4 | **Integração fiscal** | Não existe |
| R5 | **Comissão por fotógrafo e vendedor** (valor rateado) | Índice e conversão, sem comissão |
| R6 | **API de relatórios para o BI**: o Caio consome a da Roverpix | Não há API publicada: **o BI quebra em 01/12** |
| R7 | Modo Captura, PDV Mobile e **totem em que o cliente paga** | O Checkout depende do vendedor confirmar o pagamento |
| R8 | Cadastro de e-mail e WhatsApp na loja | Só no plano (v82) |
| R9 | Guarda de **3 meses** | 60 dias |
| R10 | Suporte de 2º nível | Não há suporte formal |
| R11 | Infraestrutura física redundante (servidor com reserva) | Um servidor só (o de teste ficou offline desde 01/11) |

**Riscos da transição:**
- **Contrato:** conferir aviso prévio, multa, piso e renovação automática antes de 01/12. Pela proposta de setembro, a rescisão pedia 90 dias de aviso, e a renovação automática acontecia se ninguém avisasse até 60 dias antes do fim.
- **Equipamento:** servidor, rede, PDVs, tablets e câmeras podem ser da Fictix e sair com ela.
- **Exportar o histórico** de pedidos, pagamentos e fotos de 2025 e 2026 **enquanto a chave da API funciona**. A chave é de um PDV e pode ser revogada, e a API não exporta as fotos.
- **Clientes que compraram até 30/11** resgatam pela Roverpix até cerca de fevereiro/2027. É preciso definir quem atende o SAC.
- **Cartões com QR da Roverpix** não abrem no Eterna: recolher o estoque e trocar pelos cartões novos.
- **LGPD:** formalizar a devolução ou a exclusão de leads e fotos que estão com a Fictix. Não há protocolo de saída.
- **Comparar antes e depois:** os preços mudam (R$ 149 por 6 fotos lá, R$ 190 por 9 no Eterna), e o Painel depende do histórico da Roverpix para comparar com o período anterior.
