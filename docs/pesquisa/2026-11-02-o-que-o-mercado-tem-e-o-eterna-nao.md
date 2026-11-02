# O que o mercado de fotografia tem e o Eterna ainda não (02/11/2026)

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

**Custo de impressão (FB):** cerca de R$ 2 por foto, mais R$ 2 com ímã.

**Remuneração da Magic Memories:** 14% sobre o valor líquido mais US$ 6 mil de implantação. Toda integração é cobrada à parte.

**O que o Eterna precisa medir para comparar:** o Painel já tem visitantes (catraca), sessões, vendas e ticket. Faltam **"% de grupos fotografados"** e **"% de grupos que compram"** com a mesma definição da Magic Memories. Sem isso, não dá para saber se estamos acima ou abaixo de 31% e US$ 1,96 por visitante.

## 2. Onde o Eterna já está à frente

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

## 5. Para pedir aos fornecedores ou medir no piloto

Nenhum documento trouxe:
- a taxa de conversão do totem (a Magic Memories não respondeu);
- o percentual de revenue share da PhotoPark;
- o tempo exato até a foto aparecer para venda.

O Eterna mede esse tempo na Fila do fotógrafo e no `/metricas`. Vale registrar o nosso, de ponta a ponta, para comparar.
