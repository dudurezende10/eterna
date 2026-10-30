# MaracaFly dentro do Eterna: opções para planejar

30/10/2026. Documento de planejamento: junta o que o MaracaFly faz hoje e o que o Eterna já tem, e lista os caminhos possíveis para cada parte. **Não registra decisões.** As decisões saem da conversa entre Ronaldo e Eduardo.

**Já definido pelo Ronaldo (30/10):** o Eterna é sistema da Viva Maracanã, e a operação do drone também passa a ser da Viva Maracanã; o WhatsApp será uma conta nova; a comissão do guia já existe por fora, no Portal de Parceiros (seção 7); o Snap Pop é um produto novo, com aba própria; a venda de campo acontece só dentro do estádio, com rede local e internet (sem 4G).

Fonte do MaracaFly: a documentação de levantamento em `maracatour/maracafly-doc/docs` (docs 00 a 20). Este texto cita o número do doc em vez de repetir o detalhe.

## 1. Em uma frase

O MaracaFly vende e entrega **vídeos** (drone, chute a gol) pelo vendedor de campo e pelo WhatsApp. O Eterna vende e entrega **fotos** pelo Posto, pelo Checkout e pela galeria com QR. Os dois atendem o mesmo visitante, no mesmo tour, muitas vezes na mesma hora. A proposta é ter **um cliente, um carrinho, uma entrega**.

## 2. O que já existe dos dois lados

| Assunto | MaracaFly hoje | Eterna hoje | Leitura |
|---|---|---|---|
| Produto | Drone (manobra × local, 4K, pessoas, guia) e chute a gol (pacotes e avulsos) · docs 02, 03, 17 | Catálogo de fotos: 6 pacotes e 3 adicionais (Painel de controle) | Mesmo conceito de produto com preço; falta o tipo "vídeo" e as opções do drone |
| Quem vende | Vendedor no celular, tela de campo, postos CAMPO e FOYER · docs 04, 11 | Posto de venda / Caixa, Checkout do cliente | Pessoas e postos diferentes; dá para unificar o cadastro |
| Identificar o cliente | Nome + WhatsApp + nacionalidade digitados; QR de 10 caracteres · docs 04, 06 | Cartão da sessão, selfie e reconhecimento facial, QR da galeria | O Eterna já reconhece o rosto; o MaracaFly depende de digitação |
| Carrinho | Itens em centavos, preço sugerido × cobrado, desconto/acréscimo, anti-duplicidade · doc 04 | Carrinho de pacotes + adicionais, pagamento recebido no Posto | As regras do MaracaFly são mais completas (desconto registrado) |
| Depois da venda | Piloto, drone e bateria preenchidos depois do voo · docs 06, 12 | Fila do balcão, curadoria, fila de impressão | O drone precisa de uma "fila de voo"; o Eterna tem fila de fotos |
| Entrega | WhatsApp Cloud API em 6 idiomas, link Dropbox via `/download/<QR>/` · docs 07, 09, 15 | Galeria na nuvem (S3 + eterna.photo) com QR, impressão DNP | Dois canais; dá para convergir |
| Equipe e escala | Escala mensal de 4 funções (host, operador, piloto, vendedor) · doc 11 | Escala/função do dia dos fotógrafos (campo ou volante) | Mesmo tipo de tela, cadastros separados |
| Bandeiras | Inventário de 153 bandeiras · doc 08 | Já importadas do MaracaFly na v82 (imagens de `maracafly.com.br/static/bandeiras/` e Wikimedia) | O Eterna já é o lugar mais completo |
| Chute a gol | Produto vendido e filmado | Volante no modo "Chute a gol" (fotos separadas do campo) | Já se tocam: foto e vídeo do mesmo chute |
| Guias | 321 guias, comissão e saldo · doc 14 | Não existe | Já resolvido fora dos dois: Portal de Parceiros (seção 7) |
| Voos | Maraca Flights: logs DJI, telemetria, classificação da manobra · docs 12, 20 | Não existe | Módulo à parte; ver seção 9 |
| Números | Estatísticas, Localidades, Resumo · docs 10, 13 | Painel, Diário, Fotógrafos | Os relatórios poderiam somar foto e vídeo |
| Mostruário | Página de 4 vídeos (~530 MB) para o vendedor · doc 16 | Fundos de IA, prévia no Checkout | Mostruário poderia virar uma tela do Checkout |

Volume do MaracaFly para dimensionar: cerca de 450 vendas de drone e 1.500 de chute a gol por mês, **cerca de 120 GB de vídeo por mês** e 1,05 TB em 9 meses (doc 18, seção 5).

## 2b. Snap Pop (visto no sistema em 30/10, depois da documentação de 02/10)

Aba nova no MaracaFly (`/vendas/nova/snap-pop/` e `/vendas/snap-pop/`, 21 vendas até 30/10). É um **vídeo com IA**: o cliente vira o jogador que comemora o gol, com o nome dele na tela ("GOOOOL do …").

- Demonstração por perfil: menino, menina, homem, mulher.
- Tema: Brasil, Flamengo, Fluminense.
- Preço: 1 vídeo R$ 110, 2 vídeos R$ 190, 3 vídeos R$ 290; a partir do 4º, + R$ 90 por vídeo.
- Mesmos campos de cliente do drone (nome, país com DDI, WhatsApp, idioma, pagamento, pessoas no vídeo, guia) e o mesmo preço sugerido × cobrado.
- A lista tem coluna Foto (o rosto usado) e Entrega.

No Eterna, o rosto pode vir da selfie ou das fotos da sessão, sem tirar outra foto. O "CRM" do menu atual é o painel do WhatsApp (doc 15) com outro nome.

Esboço visual das telas (vendedor, fila de produção e galeria): canvas "Eterna · Drone, Chute a Gol e Snap Pop" (link com o Ronaldo).

## 3. Como o MaracaFly cabe no modelo do Eterna

A ideia comum é tratar tudo como **atividade** do visitante:

| Atividade | Mídia | Quem produz | Como chega ao Eterna |
|---|---|---|---|
| Fotos do tour | foto | fotógrafo de ponto ou volante | FTP da câmera → agente (já existe) |
| Chute a gol | foto e/ou vídeo | volante (foto), operador (vídeo) | foto: FTP; vídeo: pasta vigiada ou upload |
| Drone | vídeo | piloto | cartão do drone → pasta vigiada no servidor do estádio |
| Snap Pop | vídeo com IA | IA, a partir do rosto do cliente | gerado no servidor ou num serviço de IA; entra na galeria |

Para isso o catálogo do Eterna precisaria, além de `pacote` e `adicional`:

- **tipo de mídia** (foto, vídeo);
- **opções do produto**: manobra × local, 4K, número de pessoas, com guia; com preço por combinação, como a tabela do drone (doc 02);
- **modos do dia**: chuva (só Boomerang), só arquibancada (doc 02), ligados à escala do dia;
- **produção pendente**: um produto vendido que ainda não foi gravado (o voo acontece depois da venda).

### Opções para o catálogo

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Um catálogo único | Fotos, drone e chute a gol no mesmo Painel de controle, com tipo de mídia e opções | Um carrinho, um relatório, um preço por lugar | O Painel de controle cresce; a tabela de preço do drone tem muitas combinações |
| B. Catálogos por atividade | Cada atividade com a própria tela de preços, vendidas no mesmo carrinho | Cada operação cuida dos seus preços | Mais telas de configuração |

A opção de deixar o drone fora do Eterna saiu: a operação do drone passa a ser da Viva Maracanã, no Eterna.

## 4. Venda pelos vendedores (ativações)

No MaracaFly o vendedor anda pelo estádio com o celular e registra a venda na hora (doc 04). No Eterna a venda acontece no Posto (Caixa) e no Checkout. As duas formas convivem.

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Vendedor móvel no Eterna | Uma tela de venda no celular (perfil "vendedor"), ligada ao mesmo carrinho e à mesma sessão do cliente | Uma venda só, com fotos e vídeos juntos; aproveita perfis e permissões do Eterna | Exige o servidor do estádio acessível no Wi-Fi dos vendedores (o mesmo problema de isolamento visto no Mac) ou pela nuvem |
| B. Vendedor móvel vendendo pela nuvem | A tela do vendedor fala com a API da nuvem; o servidor do estádio sincroniza | Não depende de o celular enxergar o servidor na rede local | Precisa da "sessão no servidor/nuvem" que ainda está em decisão (plano de 29/10, seção 2b); para de vender se a internet cair |
| C. Só no Posto | Drone e chute a gol vendidos no Caixa, junto com as fotos | Nenhuma tela nova | Perde a venda de campo, que é a força do MaracaFly |

**A venda acontece só dentro do estádio, com rede local e internet.** Não há caso de 4G. A opção A passa a ser a natural, com uma condição de rede: o Wi-Fi dos vendedores precisa enxergar o servidor do estádio. Hoje a rede MARACATOUR_CORP isola os aparelhos entre si (foi o que impediu o Mac de chegar ao 218). Caminhos: uma rede (SSID ou VLAN) da operação sem isolamento, ou uma regra que libere só a porta do Eterna no servidor. A internet fica para a galeria na nuvem e o WhatsApp; se cair, a venda continua na rede local e a nuvem sincroniza depois.

Regras do MaracaFly que valem em qualquer opção (doc 04): valores em centavos; preço sugerido e cobrado gravados lado a lado, com desconto ou acréscimo explícito; itens da venda guardados como lista; bloqueio de venda duplicada; vendedor genérico substituído por login individual.

**Como achar o cliente na venda de campo:**

1. selfie do cliente no celular do vendedor → reconhecimento facial do Eterna liga a venda à sessão de fotos (já existe a selfie automática no celular);
2. QR da galeria do cliente lido pelo celular;
3. WhatsApp do cliente como chave, com país por lista (código ISO) e DDI derivado (melhoria dos docs 06 e 10).

## 5. Depois da venda: produção

**Drone.** A venda entra numa **fila de voo** (parecida com a Fila de impressão): vendido → em voo → gravado → entregue. Na baixa do voo, piloto, drone, bateria e bandeira usada. Hoje esses campos ficam vazios com frequência (doc 13). Opções:

- baixa manual obrigatória na fila de voo;
- baixa automática pelo log de voo (seção 9);
- piloto sugerido pela escala do dia.

**Ligar o vídeo à venda.** Hoje o arquivo de vídeo recebe o nome do QR (doc 15). Opções:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Nome do arquivo = código da venda | Como hoje | Simples | Depende de renomear à mão |
| B. Pasta vigiada + hora do voo | O agente pega o vídeo e casa com a venda "em voo" daquele piloto | Sem digitação | Erra se houver dois voos seguidos |
| C. Reconhecimento facial nos quadros do vídeo | O agente extrai quadros e procura o rosto, como faz com as fotos | Usa o que o Eterna já tem; liga também às fotos do tour | Drone filma de longe; rosto pequeno em boomerang e asteroid |

**Chute a gol.** O volante já fotografa o chute no Eterna. Se o vídeo também entrar, foto e vídeo do mesmo chute ficam na mesma galeria.

## 6. Entrega: WhatsApp e galeria

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Galeria única | Fotos e vídeos na galeria do eterna.photo; o QR leva a tudo | Um link para o cliente; S3 já está montado | Vídeo pesado: ~120 GB/mês no S3 e na transferência (seção 11) |
| B. WhatsApp leva o link da galeria | Modelos de mensagem como os do doc 07 (6 idiomas), mas o link aponta para a galeria | O cliente recebe no celular sem ler QR; recupera quem perdeu o QR | Modelos a aprovar na conta nova |
| C. Como hoje | Vídeo pelo WhatsApp/Dropbox, foto pela galeria | Nada muda na entrega do vídeo | Dois links, dois sistemas, cliente confuso |

**O WhatsApp será uma conta nova da Viva Maracanã** (WhatsApp Cloud API), sem herdar a do MaracaFly. Isso pede número próprio, verificação da empresa na Meta e aprovação dos modelos antes de entrar no ar; o histórico de conversas do MaracaFly não vem junto.

Pontos do WhatsApp atual que precisam de dono em qualquer opção (doc 07): autorização de uso de imagem pedida por texto; selfie recebida pelo WhatsApp; conversas órfãs por telefone errado; recibo em imagem. Lembrete: os botões do WhatsApp no sistema legado mandam mensagem para clientes reais.

## 7. Guias e comissões

**Já existe, por fora do Eterna:** o Portal de Parceiros (`parceiros.vivamaracana.com.br`). O guia se cadastra, o portal cria o filiado na Imply pela API e devolve link e QR próprios. O guia acompanha vendas e comissão no portal. As regras de lá:

- 10% sobre ingressos e **ativações** (Chute a Gol, Foto, Drone, Gol de Placa e qualquer experiência nova da Imply), separadas em grupos no portal;
- a venda no ponto de venda conta para o guia **se o guia for escolhido no PDV da Imply**;
- fechamento no dia 10 (vendas de 1 ao fim do mês, sem as canceladas), pagamento no dia 20 por PIX, CSV para o Financeiro.

O Eterna **não calcula comissão de guia**. A tela de Guias do MaracaFly (doc 14) não precisa ser refeita. O que o Eterna precisa é que a venda de foto, drone, chute a gol e Snap Pop chegue à Imply com o guia identificado:

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. A venda passa pelo PDV da Imply | O vendedor registra no Eterna e cobra no PDV, escolhendo o guia lá | Nada muda no portal; é como já funciona com Chute a Gol e Foto | Duas telas por venda; o Eterna precisa do localizador da Imply para conferir |
| B. O Eterna lança a venda na Imply | O Eterna envia a venda com o filiado do guia pela API | Uma tela só para o vendedor | Depende de a API da Imply aceitar venda de ativação com filiado |
| C. O guia é escolhido no Eterna e o portal lê do Eterna | O portal soma as vendas do Eterna às da Imply | Independe da Imply | Duas fontes de comissão para conciliar |

Em qualquer opção, o Eterna pode ler a lista de guias do portal, para o vendedor escolher pelo nome em vez de digitar.

Comissão interna (vendedor 2%, piloto 2%, fundo 1%, doc 14) é outra regra, da equipe: precisa decidir se continua e se vale para os fotógrafos.

## 8. Equipe e escala

O Eterna tem a função do dia dos fotógrafos; o MaracaFly tem a escala mensal de host, operador, piloto e vendedor (doc 11). Opções:

- **cadastro único de pessoas** com uma ou mais funções (fotógrafo, volante, vendedor, piloto, operador, host), usado na escala, nos perfis de acesso e nos relatórios;
- escala mensal do MaracaFly como base, com a função do dia do Eterna dentro dela;
- chuva e horário do dia ligados ao catálogo (modo chuva do drone).

## 9. Voos (Maraca Flights)

As três opções estão no doc 20, seção 6: manter o open-dronelog com os módulos `rio`, usá-lo só como leitor de logs, ou reimplementar. No Eterna a pergunta extra é **onde o log entra**: pela mesma pasta vigiada do servidor do estádio, junto com os vídeos. Atenção à licença AGPL-3.0 do open-dronelog (doc 20, seção 5).

## 10. Relatórios

Estatísticas, Localidades e Resumo do MaracaFly (docs 10, 13) e o Painel/Diário do Eterna poderiam virar um só painel do dia, com foto e vídeo juntos: receita por atividade, por vendedor, por posto, por país do cliente, impacto da chuva. O mostruário do vendedor (doc 16) pode virar uma tela do Checkout com vídeos de 720p.

## 11. Infraestrutura e custo do vídeo

- 120 GB/mês de vídeo é muito mais que as fotos. Opções: guardar só a versão de entrega (1080p) por 90 dias e a original 4K só de quem comprou 4K; mover para armazenamento frio depois; apagar no fim do prazo da galeria.
- O servidor do estádio (218) recebe os vídeos pela rede; disco e tempo de envio para a nuvem precisam ser medidos antes.
- A conta AWS está no plano gratuito (ver `docs/NUVEM.md`); vídeo em volume exige o plano pago antes.

## 12. LGPD

- Mesma regra do Eterna: apagar só o que não foi vendido; vídeo vendido segue o prazo da galeria.
- Autorização de uso de imagem: hoje por texto no WhatsApp; no Eterna, a mesma tela de consentimento da selfie poderia valer para foto e vídeo.
- Telefone e país do cliente passam a morar no Eterna: entram no apagamento a pedido.

## 12b. Histórico do MaracaFly (migrar)

Ronaldo quer migrar o histórico desde janeiro/2026. O que existe hoje, na pasta Downloads dele:

| Arquivo | O que tem | Serve para |
|---|---|---|
| `RELATORIO_DIARIO_EXPERIENCIAS_MARACATOUR_2026_G.AGUIA.xlsx` | Totais por dia (vendas, valor, ticket médio) de Gol de Placa, Photo Tour e Maraca Fly, janeiro a abril/2026 | Números do painel por dia; não tem venda a venda |
| `2026-10-02_17-28-27_Open_Dronelog.db.backup` (gzip, 329 MB) | Banco do Maraca Flights em 02/10: voos e telemetria | Voos, pilotos, drones e baterias (seção 9) |
| `Guias-MaracaFly-2026-10-02.csv` | Guias com vendas, comissão, pago e saldo | Conferência com o Portal de Parceiros; o cadastro de guias já mora lá |

**A venda a venda já foi extraída** pela auditoria de vendas (`maracatour/auditoria-vendas`, extrator `ferramentas/extrair_maracafly.js`, que lê as telas `/vendas/drone/`, `/vendas/chute-gol/` e `/vendas/snap-pop/` dia a dia). Arquivos em `auditoria-vendas/dados/maracafly_historico/`, extraídos em 27/10, de 01/12/2025 a 26/10/2026, sem erros:

| Arquivo | Colunas | Linhas por mês |
|---|---|---|
| `maracafly_drone_historico_…json` | ID, criação, QR, cliente, WhatsApp, localidade, serviços, vendedor, vídeos, preço, foto, pagamento, resolução, pessoas, piloto, drone, bateria, hora da entrega, idioma, guia | jan 534 · fev 761 · mar 847 · abr 747 · mai 840 · jun 763 · jul 1.000 · ago 928 · set 416 · out (até 26) 889 |
| `maracafly_chute_snap_historico_…json` | ID, foto, criação, QR, cliente, WhatsApp, localidade, itens, vendedor, vídeos, valor, pagamento, participantes, entrega, idioma, guia | chute a gol e Snap Pop só aparecem em outubro (1.535 e 38 linhas); nos meses anteriores sai uma linha por dia, provavelmente "sem vendas" (a conferir) |

Antes de migrar, conferir: setembro do drone (416) parece baixo, e chute a gol antes de outubro pode ter ficado em outro sistema. De 27/10 em diante, a extração diária da auditoria continua cobrindo. Os vídeos (1,05 TB) ficam no Dropbox: migrar só os links ou baixar e subir para o S3.

Na migração: país como código ISO (de-para do doc 10), telefones e nomes entram nas regras de LGPD do Eterna, e cada venda antiga ganha a origem "MaracaFly" para não misturar com a operação nova.

## 13. Fases possíveis

Uma ordem possível, para discutir:

1. **Catálogo e venda**: drone e chute a gol no catálogo; venda no Posto com o mesmo carrinho.
2. **Vendedor móvel**: tela de venda no celular e perfil de vendedor.
3. **Fila de voo e vídeo na galeria**: pasta vigiada de vídeos, ligação vídeo ↔ venda, entrega pela galeria.
4. **WhatsApp**: modelos apontando para a galeria.
5. **Pessoas, escala e comissão interna** (a de guia já está no Portal de Parceiros).
6. **Voos e telemetria**.

## 14. Perguntas em aberto

1. **Snap Pop**: o que entrega (foto, vídeo, impresso), preço, quem produz e onde fica no estádio.
2. Catálogo único ou um por atividade (opção A ou B da seção 3)?
3. Rede dos vendedores: SSID/VLAN da operação sem isolamento, ou liberar só a porta do Eterna no servidor (seção 4)?
4. Guia na venda: PDV da Imply, lançamento pela API ou portal lendo o Eterna (seção 7)?
5. Comissão interna (vendedor, piloto, fundo) continua? Vale para fotógrafos?
6. Por quanto tempo o vídeo fica disponível ao cliente, e em que qualidade?
7. Histórico: a venda a venda já está extraída (seção 12b); falta conferir setembro do drone e o chute a gol antes de outubro.
