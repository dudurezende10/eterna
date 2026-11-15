# Exportar relatório em PDF e XLS nas telas de dados (correção de 15/11/2026)

Pedido do Eduardo: "Em algumas telas, principalmente onde envolve estatísticas e dados, também na tela das bandeiras, ter algum botão que eu possa ter um relatório, um XLS ou um PDF, ideal que seja os dois."

Teste: `testes/relatorios.js` (lê os bytes do arquivo baixado). Código: bloco "Exportar relatório (PDF | XLS)" do `index.html`, logo antes de `VIEWFN`.

## Decisões do Eduardo

1. O botão fica no topo da tela: grupo **Exportar** com **PDF** e **XLS**.
2. Exporta quem já vê a tela, e cada exportação fica registrada.
3. O PDF tem só cabeçalho e tabelas. Sem gráfico e sem logo.
4. Os botões "Exportar CSV" antigos ficam como estão.
5. Em Bandeiras, as colunas Sessões, Vendidas, Conversão e Receita ficam fora do arquivo: na tela elas são estimativa (`flagStats`).
6. Além de Bandeiras, Painel, Estatísticas, Lista de vendas e Fotógrafos, entram a Escala e o Diário do set.

## Como funciona

Tudo é gerado no navegador. Não há biblioteca nova, arquivo novo em `vendor/`, rota nova no agente nem pedido de rede. Não se usa `window.print` nem `@media print`: os postos abrem o Chrome com `--kiosk-printing`, e qualquer impressão sairia direto na impressora de fotos. O `agente/eterna-agente.py` não mudou.

- **XLS** é um `.xlsx` de verdade: ZIP sem compressão (`zipStore`, `crc32`) com o XML mínimo (`xlsxBlob`, `xlsxFolha`). Texto vai em `inlineStr`, então nome que começa com `=` nunca vira fórmula. Número vai como número. Estilos: texto, inteiro, moeda, moeda sem centavos, percentual, data e uma casa decimal, cada um também em negrito (cabeçalho e total). O `workbook.xml` leva `<bookViews>`. Nome de aba (`relAba`): até 31 caracteres, sem `[ ] : * ? / \`, sem apóstrofo no começo ou no fim e sem repetir. `xmlTxt` escapa `& < > "` e tira o caractere que o XML não aceita.
- **PDF** é um arquivo baixado, feito por um escritor próprio (`pdfBlob`): A4, Helvetica e Helvetica-Bold padrão em WinAnsi, tabela de larguras para alinhar e quebrar linha, cabeçalho da tabela repetido em cada página, rodapé "Página x de y" e paisagem quando alguma tabela tem mais de 7 colunas. `pdfWin` converte o texto: letra que a fonte não tem vira a letra sem acento ou `?`. `pdfTxt` escapa `\ ( )`.
- Largura das colunas do PDF (`pdfColunas`): coluna de data e de número fica na largura natural e nunca parte; texto curto (código, hora, nome) também. Só o texto longo (Itens, Registro) encolhe, até a maior palavra, e quebra sempre entre palavras. O título da coluna quebra só entre palavras. Se a tabela não cabe assim, a fonte da tabela desce um passo (8 para 7) e, se ainda não couber, a página vira paisagem. Só depois disso existe o último recurso (`pdfColunasForca`), que divide o resto entre as colunas de texto.
- Texto com mais de 14 linhas numa célula é cortado com "..." e a tabela ganha a nota "o texto completo está no XLS" (`rel_texto_xls`).
- Os dois formatos saem do mesmo modelo:

```
relatorio = { id, titulo, venue, periodo:{de,ate}|null, posicaoEm:ISO|null,
  filtros:[[rotulo,valor]], notas:[texto], geradoEm:ISO, geradoPor:nome,
  abas:[{ nome, titulo, colunas:[{t, tipo:'txt'|'int'|'dec1'|'moeda'|'moeda0'|'pct'|'data'}],
          linhas:[[valor cru]], total:[...]|null }] }
```

Valor cru: número como Number, percentual como fração de 0 a 1, data `AAAA-MM-DD`, `null` para vazio. `{v, tipo}` troca o tipo de uma célula só (aba Resumo). Texto em coluna de número continua texto.

- Cabeçalho (`relCab`): título, venue, período ou "Posição em", filtros, notas da tela, "Gerado em" no fuso do venue, "Gerado por" (nome da pessoa; e-mail só se não houver nome) e "Uso interno". No PDF, "Uso interno" repete no rodapé de toda página.
- Nome do arquivo (`relNome`): `eterna-<venue>-<id>-<de>_<ate>.<ext>`; sem período, `-<dia>`. Só `a-z`, `0-9`, `_` e `-`.
- Idioma do arquivo é o idioma da pessoa (`TE`). Chaves novas `rel_*` nas 5 línguas; os títulos de coluna reusam as chaves das telas.
- Limites: PDF até 2.000 linhas (acima disso a tela avisa e sugere o XLS); XLS até 20.000 (acima disso a tela pede um período ou filtro menor). Sem linhas, a tela avisa e não baixa nada.
- Uma exportação por vez (`relTrava`, `relOcupado`): depois de gerar um arquivo os dois botões ficam desligados por 1 segundo. Clique duplo gera um arquivo e um registro só.

## Uma fonte só para a tela e para o arquivo

Cada construtor (`REL[view]`) usa as mesmas funções de dado da tela. É proibido buscar uma fonte mais crua do que a pessoa vê. Para isso saíram de dentro das telas:

| Tela | Construtor | Função comum | O que sai |
| --- | --- | --- | --- |
| Bandeiras | `relBandeiras` | `flagLinhas()` (chip e ordem) | Inventário do chip escolhido, lista de compra e unidades por ponto, com "Posição em". Sem as 4 colunas de estimativa. |
| Painel | `relPainel` | `state.painelUlt` (o `painelDados` que a tela desenhou) e `painelNotas()` | Resumo, Dia a dia, Produtos, Pagamentos e Atendimentos, com as notas do topo da tela (sem conexão, filtro de ponto e avisos) |
| Estatísticas | `relEstatisticas` | `esTela()`, `esFotoOrd()` e `esForaHora()` | A seção aberta. Na a, o cabeçalho leva as notas da tela (vendas sem detalhe de produto e vendas fora das 8h às 20h) e a aba por dia da semana diz que as colunas são média por dia. a: Resumo, Produtos, Pagamento, Posto, montagens vistas e compradas, vendas por hora, por dia da semana e hora por dia. b: fotógrafos na ordem da tela e, com um aberto, o dia a dia dele. e: só a tabela por idioma. |
| Lista de vendas | `relVendasLista` | `salesFiltradas()` | Todas as vendas do período e dos filtros, não só a página de 50, com as colunas da tela. Sem `pagamento_ref`. |
| Fotógrafos | `relFotografos` | `buildStats(rangeDays())` | A tabela do período; com a pessoa aberta, o dia a dia dela e as sessões do dia aberto |
| Escala | `relEscala` | `funcOf`, `escDiaFunc`, `escDiaTxt`, `escCobertura` | A função de hoje e a semana da tela (hoje e os 6 dias seguintes), uma linha por pessoa e dia. O fotógrafo exporta só os dias dele. |
| Diário do set | `relDiario` | `diarioLista()`, `diTipoNome`, `diPontoNome` | Os registros do filtro da tela (Hoje, Em aberto, Todos), só os que a pessoa vê |

## Quem pode e o registro

- `relPode(view)`: existe construtor, `canView(view)` e `can(MODULE_OF[view],'r')`. Em Estatísticas, só nas seções a, b e e. O botão (`relBotao`) não aparece sem isso, e `relExportar` confere de novo no clique: quem força o clique vê "Sem acesso a esta tela" e nada é baixado.
- `relAudita` grava `auditLog('relatorio_exportado','relatorio/<id>',[{campo:'formato',para}],{periodo,linhas,filtros})`. Vai para `usuarios_log` no servidor; sem servidor fica no aparelho e sobe na reconexão, como os outros registros. O conteúdo do relatório nunca entra no registro.
- Aparece em Permissões › Histórico: quem, "exportou o relatório", a tela (em Estatísticas, também a seção), o formato, o período, quantas linhas e os filtros (`auditText`).
- Diário do set e LGPD: o texto livre pode citar um visitante. O arquivo leva só o que a tela já mostra a quem exporta (o fotógrafo sem Excluir vê só os registros dele) e a marca "Uso interno".
- Escala: é a escala, não o ponto. O arquivo não tem presença, falta, atraso nem horário.

## Critérios de aceite e onde o teste confere

1. As 7 telas têm Exportar com PDF e XLS no topo; Estatísticas só em a, b e e.
2. XLS do Painel em 7 dias abre como ZIP (também pelo `python3 -m zipfile -l`), tem as 5 abas e o total de receita igual ao da tela.
3. Célula numérica é número. Bandeira chamada `=1+1 <b>&"` sai como texto literal e o XML continua válido.
4. O PDF começa com `%PDF-1.` e termina com `%%EOF`; cabeçalho com título, venue, período, data e hora no fuso do venue (conferido com o aparelho em Tóquio) e quem gerou; o número de páginas confere com o rodapé.
5. Bandeiras com o chip Atenção: só as linhas do filtro, na ordem da tela, com "Posição em", sem as 4 colunas de estimativa.
6. Lista de vendas com vendedor e status filtrados e mais de 50 linhas: todas as linhas do filtro e nenhuma fora.
7. Estatísticas com a seção e aberta: só a tabela por idioma, com os valores da tela.
8. Pessoa com idioma inglês: cabeçalho e colunas em inglês; chaves `rel_*` nas 5 línguas.
9. Sem a permissão da tela (módulo ou menu): o botão não aparece e o clique forçado não baixa nada nem deixa registro.
10. Cada exportação cria `relatorio_exportado` no histórico e um documento em `usuarios_log`.
11. PDF com mais de 2.000 linhas não é gerado; período vazio avisa.
12. Nenhum `window.print`, pedido de rede ou arquivo novo em `vendor/`.
13. `pn-csv` e `sales-csv` seguem funcionando (o `es-dias-csv` precisa do servidor e é coberto por `testes/agenda-estatisticas.js`).
14. Escala e Diário exportam o que a tela mostra no período da tela.
15. PDF da Lista de vendas (12 colunas) e de uma tabela de teste com texto longo: nenhuma data, código, nome ou título de coluna partido; só a coluna longa quebra, entre palavras.
16. Painel: as notas da tela estão no arquivo; dinheiro sem centavos no PDF; R$/visitante inteiro na linha e no total.
17. Nome de aba nunca começa nem termina com apóstrofo.
18. XLS com 20.001 linhas é recusado com o aviso.
19. Clique duplo gera um arquivo e um registro.
20. O Histórico mostra a seção de Estatísticas exportada.

## Decisões da implementação

- Dinheiro no PDF sai com centavos (`R$ 105,00`), menos no Painel: lá a receita já vem arredondada, então o tipo é `moeda0` (`R$ 90.992`, como a tela) e o XLS mostra o mesmo número sem casas decimais. R$/visitante do Painel é arredondado na linha como no total. Nas outras telas o número do XLS é o valor cru, com os centavos reais.
- Lista de compra de Bandeiras: a bandeira de peça única muito usada entra com o motivo "Peça única", sem o número de sessões (que é estimativa). A escolha de quais entram ainda usa a estimativa, como na tela. Aguarda decisão do Eduardo.
- Bandeiras com um chip sem nenhuma linha não gera arquivo, mesmo havendo lista de compra.
- Lista de vendas: não há linha de total, porque somar pagas, aguardando e canceladas confunde. O cabeçalho traz "Pagas: N · Receita: R$ X", os mesmos números dos cartões da tela.
- Fotógrafos: "Fotos vendidas" da tela ("120 (22%)") vira duas colunas, a quantidade e o percentual.
- Escala: a grade "Ver dias anteriores" (histórico dos dados de exemplo) não sai. A linha "Cobertura" sai como na tela.
- Painel: as tabelas "números do servidor do ponto" (por fotógrafo, vendedor, ponto e meio) não saem nesta entrega.
- O teste `testes/relatorios.js` entra sozinho no `testes/rodar.sh` (todo `testes/*.js` roda).

## Ficou de fora

- Telas: Vendedores, Drone, Chute a Gol e Snap Pop, Estoque, Qualidade, Galerias online, Histórico de permissões, Calendário de eventos e Alertas.
- Estatísticas: seções c (Rapidez), d (Dias e eventos), f (Movimento) e g (Jogos e ano a ano).
- Gráficos e logo no PDF.
- Trocar os "Exportar CSV" antigos pelo botão novo.
- Defeito achado e não corrigido aqui: o "Exportar CSV" da Lista de vendas (`sales-csv`) ignora os filtros e o período da tela e baixa todas as vendas, embora o botão mostre a contagem filtrada. O XLS novo respeita os filtros.
