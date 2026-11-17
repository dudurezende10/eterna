# Escola pelo voucher da Imply: uma foto de cortesia por criança (17/11/2026)

**Decisão (Ronaldo, 17/11):** toda escola chega por voucher da Imply. O responsável digita o localizador do voucher no mesmo campo onde hoje se digita o código da sessão, o sistema confere que é voucher de escola, a criança faz a selfie, o responsável informa o e-mail e escolhe **uma** foto de cortesia. As outras fotos ficam à venda. Essa é a gratuidade de escola. Tudo é medido para saber se a estratégia funciona.

## O que vale como escola

- A descrição do voucher traz a etiqueta **`[Escola]`**, como `Voucher [EE Thiago Delgado] [12.11 09h15] [4 Inteiras + 46 Meias] [Escola] - Consumidor - 01 / 01`.
- Só a etiqueta conta. Corporativo, empresa e agência têm localizador também e ficam de fora. O perfil que o Viva Parceiros deduz pelo nome ("Colégio", "EE"...) não libera cortesia.
- O voucher tem de estar **confirmado** (linha azul na tela Vouchers), não cancelado, e a visita já ter acontecido.

## De onde vem o voucher

O robô do Viva Parceiros (`viva-guias/robo/imply-web.mjs`, modo `vouchers`) lê a tela Vouchers da Imply de hora em hora. `GET https://parceiros.vivamaracana.com.br/api/painel/grupos` (cabeçalho `Authorization: Bearer <PARCEIROS_PAINEL_TOKEN>`, o mesmo do Maraca Acessos) devolve cada grupo com:

| Campo | Uso aqui |
|---|---|
| `voucher.localizador` | o que o responsável digita |
| `descricao` | procurar `[Escola]` |
| `instituicao` | nome da escola nas telas e nas estatísticas |
| `status` | só `confirmado` |
| `visitaDia`, `visitaHora` | janela das fotos da visita |
| `pessoas` | teto de cortesias do voucher |

Um voucher com ingressos em mais de um horário vem como um grupo por horário, todos com o mesmo localizador. A galeria junta os horários.

O token do painel fica só no servidor do estádio (ambiente), nunca no app nem no repositório.

## Como funciona

```mermaid
sequenceDiagram
  participant P as Viva Parceiros
  participant A as Servidor do estádio
  participant N as Nuvem (galeria)
  participant R as Responsável (eterna.photo)
  A->>P: de hora em hora: grupos com [Escola] confirmados
  A->>A: depois da visita: monta a galeria evento com as sessões da janela
  A->>N: publica o manifesto (fila de galerias de hoje), com voucher e escola
  R->>N: digita o localizador
  N-->>R: escola e dia da visita
  R->>N: autorização do responsável, e-mail, selfie da criança
  N-->>R: só as fotos em que a criança aparece (vitrine com marca)
  R->>N: escolhe 1 foto de cortesia
  N-->>R: a cortesia sem marca para baixar; as outras à venda (Imply)
```

1. **As fotos sobem como qualquer outra** (`nuvem_enfileira` no `ingest_file`): alta e vitrine. Nada muda no envio.
2. **Galeria da escola, automática.** O agente lê os grupos de hoje do Viva Parceiros. Quando acaba a janela da visita (do horário do voucher até 2h30 depois), ele cria um manifesto `evento` com `nome` = escola, `data` = dia, as sessões começadas na janela, `menor:true` e o bloco `voucher` (`localizador`, `escola`, `pessoas`, `horarios`). Ele publica pela fila que já existe. É o mesmo manifesto da aba "Grupos e escolas", que continua para os casos manuais, e "Editar sessões" serve para corrigir a janela.
3. **Mesma tela de hoje (Ronaldo, 17/11):** o campo "Digite seu código" da galeria aceita também o localizador do voucher. Não há tela nova: depois do localizador, o fluxo é o mesmo de hoje (autorização, e-mail, selfie, fotos). O voucher só diz duas coisas: em quais fotos procurar (a galeria da visita) e que a criança tem direito a uma foto grátis. O QR e o link que a escola recebe abrem essa tela com o localizador já digitado. A página "kids" que encante o pai é uma decisão em aberto: o endereço é o mesmo, só muda a aparência.
4. **Localizador → galeria.** A nuvem guarda `VOU#<localizador>` → token, como o `COD#` do código curto. A busca do código tenta o localizador quando o texto não é um código curto e responde `{token, escola, data}` ou "não encontrado", sem dizer o motivo. Tem limite por IP, como o código.
5. **O resto é o fluxo de escola que já existe:** autorização do responsável (`gq_consentKidNuvem`, LGPD art. 14), selfie com limiar de criança, só as fotos em que ela aparece, no máximo 2 crianças por aparelho em 24 h e 60 acessos por hora por galeria.
6. **E-mail obrigatório** antes da selfie, como na compra online.
7. **Cortesia:** `POST /g/<token>/cortesia {acesso, foto, email}`.
   - Uma por criança. A criança é o conjunto de fotos que a selfie abriu. Se uma dessas fotos já for cortesia de outro acesso, a nuvem devolve a mesma foto e não libera outra. Assim um segundo e-mail ou outro aparelho com a mesma criança não ganha mais uma.
   - No máximo `pessoas` cortesias por voucher. Passou disso, acaba a cortesia daquele voucher e o resto fica à venda.
   - A escolha é final.
   - A foto escolhida sai da vitrine para a alta, sem marca, e vira `direito: cortesia` com `motivo: escola-voucher`.
8. **As outras** seguem a compra online pela Imply, como em qualquer galeria.

## Estatística

Eventos novos em `EVT#<token>`, com o localizador e a escola em todos:

| Evento | Extras |
|---|---|
| `voucher_digitado` | resultado: `ok`, `nao_encontrado`, `nao_escola`, `nao_confirmado`, `antes_da_visita` (o motivo fica só no registro, nunca na tela) |
| `consentimento` | versão e idioma (já existe em `CON#`) |
| `email_informado` | e-mail guardado com o voucher (lead) |
| `selfie_ok` / `selfie_nao` / `selfie_sem_rosto` | já existem; mais a quantidade de fotos encontradas |
| `cortesia_escolhida` | foto, quando |
| `cortesia_repetida` | outro acesso com a mesma criança |
| `cortesia_esgotada` | o voucher chegou ao teto |
| `foto_baixada` | foto, se é a cortesia ou comprada |
| `compra_tentada` / `compra_paga` | quantidade, valor, localizador da Imply |

Painel **Escolas** (estatísticas):
- **Por voucher:** escola, visita, alunos no voucher, acessos, selfies que acharam a criança, cortesias escolhidas e baixadas, compras (fotos e valor) e onde as pessoas pararam.
- **Funil no período:** digitou, autorizou, fez a selfie, achou, escolheu a cortesia, baixou, comprou.
- **Totais:** taxa de conversão da cortesia em compra e receita por escola.

## Dimensionamento (Ronaldo, 17/11: superdimensionado)

O teto de 600 fotos por galeria (`LIMITE_FOTOS_GALERIA`) não serve para escola. A conta parte do pior caso, não da média.

| | Base | Escola |
|---|---|---|
| Fotos por dia | 15 mil (projeto da nuvem) | — |
| Fotos por hora | ~1.900 de média; pico de 2x ≈ 3.800 | — |
| Janela de uma visita (2h30) | — | **até 10 mil fotos** (pico o tempo todo, com folga) |
| Escolas no mesmo dia | — | várias, com janelas que se cruzam |

Como fica:

1. **Uma coleção de rostos por dia de escola, não uma por voucher.** Toda foto de uma janela de escola é lida **uma vez só**, mesmo que caia na janela de 3 escolas. A busca da selfie devolve as fotos daquela coleção, e a galeria do voucher mostra só as que estão na sua janela (`ExternalImageId` = foto).
2. **Leitura em paralelo.** A primeira autorização de um responsável no dia dispara a leitura. A Lambda se divide em lotes de 100 fotos que rodam ao mesmo tempo, até o limite de transações por segundo da conta. A 50 por segundo, 10 mil fotos levam cerca de 3,5 minutos. Esse primeiro responsável vê "processando" e é avisado por e-mail quando as fotos ficam prontas. Os seguintes entram na hora. Os rostos continuam sendo lidos só depois de uma autorização, nunca antes.
3. **Tetos próprios da escola**, separados dos da galeria comum:
   - até 10 mil fotos por janela;
   - `LimiteLeiturasDia` de 15 mil para 60 mil, contando a galeria comum mais 4 janelas cheias;
   - `LimiteBuscasDia` de 10 mil para 20 mil.

   Chegar a 80% de qualquer teto manda alerta por e-mail antes de o cliente ver "processando".
4. **Custo do pior caso:** cerca de US$ 0,001 por foto lida e por selfie. Uma janela cheia custa ~US$ 10, uma vez só, e as selfies dos alunos ficam em centavos. Um dia com 4 escolas no pico custa ~US$ 40. O alerta de orçamento continua.
5. **Teste de carga antes de ligar:** 10 mil fotos sintéticas numa janela, 50 responsáveis ao mesmo tempo, e medição do tempo até a primeira foto e do custo. Também simula três escolas na mesma hora.

**A conferir na conta (Ronaldo, CloudShell):**
- **Cota conferida em 17/11: 5 por segundo** em `IndexFaces` e em `SearchFacesByImage` (us-east-2). Com isso, 10 mil fotos levam 33 minutos, e 5 selfies por segundo na conta inteira travam com muitos pais ao mesmo tempo. **Pedido de aumento para 50 por segundo nas duas**, feito pelo Ronaldo em 17/11 às 18h (Service Quotas, us-east-2): `L-43CBEB68` SearchFacesByImage e `L-7C13EBAD` IndexFaces, que abriu caso no suporte. Acompanhar com `aws service-quotas list-requested-service-quota-change-history --service-code rekognition --region us-east-2`. Até a aprovação, escola não liga;
- **Plano da conta conferido em 17/11: gratuito** (`FREE`, ativo), crédito de US$ 139,23, vence em 29/04/2027. No plano gratuito, quando o crédito acaba a conta é cortada e a galeria inteira sai do ar. Um dia cheio de escola, no pior caso ~US$ 40, consumiria o crédito em 3 ou 4 dias. **A escola só liga com a conta no plano pago** (cartão no Billing e "Upgrade plan", feitos pelo Ronaldo), com o alerta de orçamento ajustado ao valor real. Vale também para a produção da galeria comum (NUVEM.md §7).

## Pontos de atenção

- **Gente de fora na janela:** a janela pega visitantes que não são da escola. Eles nunca aparecem para o responsável, porque a escola só mostra as fotos em que a criança da selfie aparece, com limiar de criança.
- **Atraso do robô:** o voucher aparece em até 1 hora depois de criado ou confirmado. Como o responsável entra depois da visita, isso não atrapalha.
- **Risco já registrado do grupo de escola** (DOCUMENTACAO-TECNICA, "IMPORTANTE"): recortar o rosto de outra criança da vitrine. Continuam os limites de 2 crianças por aparelho e 60 acessos por hora.

## Ordem de construção

1. Agente: leitura dos grupos `[Escola]` no Viva Parceiros e criação automática da galeria `evento` com o bloco `voucher`.
2. Nuvem: `VOU#`, `GET /g/voucher/<localizador>`, e-mail, `POST /g/<token>/cortesia` com os dois limites, eventos novos.
3. App: o campo do código aceita o localizador; na galeria da escola, a escolha da foto grátis. Textos nos 5 idiomas e na lista do chinês.
4. Estatísticas: painel Escolas.
5. Testes: agente, nuvem (`teste_local.py`) e Playwright do fluxo inteiro, com a cortesia repetida e a esgotada.
