# Guia "Entendendo o Eterna"

Fonte do PDF `docs/Entendendo-o-Eterna.pdf`, o guia do sistema para quem não é de tecnologia.

- `entendendo-o-eterna.html`: o guia inteiro, num arquivo só (CSS embutido, sem nada da internet). Cada `<section class="pagina">` é uma folha A4 deitada. O sumário e os números de página são montados sozinhos a partir de `data-parte` e `data-titulo` de cada página. Os fluxos são escritos em `<pre class="fluxo">`, uma caixa por linha (o formato está no comentário do topo do arquivo).
- `gerar-pdf.js`: abre o HTML no Chrome instalado (playwright) e grava o PDF.

## Gerar o PDF

Na raiz do repositório, com o playwright de uma pasta de ferramentas:

```bash
NODE_PATH=C:/xampp/htdocs/eterna-testes-tools/node_modules NODE_OPTIONS="--require C:/xampp/htdocs/eterna-testes-tools/windows-shim.js" node docs/guia/gerar-pdf.js
```

O script diz quantas páginas saíram e lista as páginas em que algum texto passou do rodapé ou da margem. Se aparecer alguma, encurte o texto daquela página ou divida em duas `section` e gere de novo.

## Ao atualizar

1. Mude o HTML (versão e data na capa).
2. Gere o PDF e abra algumas páginas para conferir.
3. Commit do HTML e do PDF juntos.

Regras do texto: só funções (vendedor, piloto, equipe de entrega, TI), nunca nomes de pessoas; nada de segredos, endereços internos, números de conta ou dados de clientes; o sistema que vendia as ativações antes é o "sistema antigo".
