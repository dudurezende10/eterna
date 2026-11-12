# Treinamento: Drone, Chute a Gol e Snap Pop, da venda à entrega do vídeo

Material para treinar as equipes de venda e de entrega:

- `entregaveis/Manual - ….docx`: manual passo a passo (um print por tela, setas numeradas iguais aos passos, regras uma vez só na seção 1, roteiro de treino na seção 6).
- `entregaveis/Treinamento - ….pptx`: a mesma sequência em slides, para a sala de treino.

Os dois saem do mesmo conteúdo (`ferramentas/gerar.py`); os prints são das telas de verdade do app, com o servidor
respondido no navegador e dados fictícios (nenhum cliente real, nada gravado em servidor).

## Refazer depois de mudar uma tela

1. Prints (Chrome instalado na máquina, porque o Chromium dos testes não toca MP4):
   `NODE_PATH=<node_modules com playwright> U=<endereço do index.html> VIDEO=<um mp4 de exemplo> node ferramentas/capturar.js <pasta dos brutos>`
2. Setas: `python ferramentas/marcar.py <pasta dos brutos>` (grava em `prints/`).
3. Documentos, rodando em `docs/treinamento`: `python ferramentas/gerar.py`.

Conferir os slides e as páginas (exportar para PDF pelo Word) antes de mandar.
