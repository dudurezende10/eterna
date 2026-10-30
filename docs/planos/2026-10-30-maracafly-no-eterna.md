# MaracaFly dentro do Eterna: opções para planejar

30/10/2026. Documento de planejamento: junta o que o MaracaFly faz hoje e o que o Eterna já tem, e lista os caminhos possíveis para cada parte. **Não registra decisões.** As decisões saem da conversa entre Ronaldo e Eduardo.

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
| Guias | 321 guias, comissão e saldo · doc 14 | Não existe | Só o MaracaFly tem |
| Voos | Maraca Flights: logs DJI, telemetria, classificação da manobra · docs 12, 20 | Não existe | Módulo à parte; ver seção 9 |
| Números | Estatísticas, Localidades, Resumo · docs 10, 13 | Painel, Diário, Fotógrafos | Os relatórios poderiam somar foto e vídeo |
| Mostruário | Página de 4 vídeos (~530 MB) para o vendedor · doc 16 | Fundos de IA, prévia no Checkout | Mostruário poderia virar uma tela do Checkout |

Volume do MaracaFly para dimensionar: cerca de 450 vendas de drone e 1.500 de chute a gol por mês, **cerca de 120 GB de vídeo por mês** e 1,05 TB em 9 meses (doc 18, seção 5).

## 3. Como o MaracaFly cabe no modelo do Eterna

A ideia comum é tratar tudo como **atividade** do visitante:

| Atividade | Mídia | Quem produz | Como chega ao Eterna |
|---|---|---|---|
| Fotos do tour | foto | fotógrafo de ponto ou volante | FTP da câmera → agente (já existe) |
| Chute a gol | foto e/ou vídeo | volante (foto), operador (vídeo) | foto: FTP; vídeo: pasta vigiada ou upload |
| Drone | vídeo | piloto | cartão do drone → pasta vigiada no servidor do estádio |
| Snap pop | **a definir** (ver seção 12) | — | — |

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
| C. Drone fora do Eterna | Eterna só vende fotos e chute a gol; drone continua num sistema próprio | Menos mudança no Eterna | Dois sistemas para o mesmo cliente, que é o problema de hoje |

## 4. Venda pelos vendedores (ativações)

No MaracaFly o vendedor anda pelo estádio com o celular e registra a venda na hora (doc 04). No Eterna a venda acontece no Posto (Caixa) e no Checkout. As duas formas convivem.

| Opção | Como | Prós | Contras |
|---|---|---|---|
| A. Vendedor móvel no Eterna | Uma tela de venda no celular (perfil "vendedor"), ligada ao mesmo carrinho e à mesma sessão do cliente | Uma venda só, com fotos e vídeos juntos; aproveita perfis e permissões do Eterna | Exige o servidor do estádio acessível no Wi-Fi dos vendedores (o mesmo problema de isolamento visto no Mac) ou pela nuvem |
| B. Vendedor móvel vendendo pela nuvem | A tela do vendedor fala com a API da nuvem; o servidor do estádio sincroniza | Funciona em 4G, fora da rede do estádio | Precisa da "sessão no servidor/nuvem" que ainda está em decisão (plano de 29/10, seção 2b) |
| C. Só no Posto | Drone e chute a gol vendidos no Caixa, junto com as fotos | Nenhuma tela nova | Perde a venda de campo, que é a força do MaracaFly |

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
| B. WhatsApp leva o link da galeria | Mantém os modelos do WhatsApp (6 idiomas, doc 07), mas o link aponta para a galeria | O cliente recebe no celular sem ler QR; recupera quem perdeu o QR | Exige a conta do WhatsApp Cloud API e modelos aprovados no Eterna |
| C. Como hoje | Vídeo pelo WhatsApp/Dropbox, foto pela galeria | Nada muda na entrega do vídeo | Dois links, dois sistemas, cliente confuso |

Pontos do WhatsApp atual que precisam de dono em qualquer opção (doc 07): autorização de uso de imagem pedida por texto; selfie recebida pelo WhatsApp; conversas órfãs por telefone errado; recibo em imagem. Lembrete: os botões do WhatsApp no sistema legado mandam mensagem para clientes reais.

## 7. Guias e comissões

| Assunto | Hoje (doc 14) | Opções no Eterna |
|---|---|---|
| Cadastro de guias | 321 guias no MaracaFly | Importar; cadastro único de pessoas (seção 8) |
| Comissão do guia | 10% ou R$ 30 por vídeo (há conflito entre as duas regras) | Regra por produto; vale também para fotos? |
| Comissão interna | Vendedor 2%, piloto 2%, fundo 1% | Calcular na venda e mostrar no relatório; fotos entram? |
| Saldo e pagamento | Pago e em aberto por guia | Relatório de fechamento por período |

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

## 13. Fases possíveis

Uma ordem possível, para discutir:

1. **Catálogo e venda**: drone e chute a gol no catálogo; venda no Posto com o mesmo carrinho.
2. **Vendedor móvel**: tela de venda no celular e perfil de vendedor.
3. **Fila de voo e vídeo na galeria**: pasta vigiada de vídeos, ligação vídeo ↔ venda, entrega pela galeria.
4. **WhatsApp**: modelos apontando para a galeria.
5. **Pessoas, escala, guias e comissões**.
6. **Voos e telemetria**.

## 14. Perguntas em aberto

1. **O que é o "snap pop"?** Não aparece na documentação do MaracaFly. É foto, vídeo, um produto novo?
2. Drone fica dentro do Eterna (opção A ou B do catálogo) ou ao lado (opção C)?
3. A venda de campo precisa funcionar em 4G, fora do Wi-Fi do estádio?
4. WhatsApp: a conta do WhatsApp Cloud API do MaracaFly passa para o Eterna ou fica com a RIO DRONE XP?
5. Comissão de guia: 10% ou R$ 30 por vídeo? E vale para fotos?
6. Por quanto tempo o vídeo fica disponível ao cliente, e em que qualidade?
7. O MaracaFly é da RIO DRONE XP Ltda (doc 05): quem é dono dos dados e do sistema novo?
