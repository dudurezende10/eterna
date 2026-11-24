# Treinamento das equipes

Dois treinamentos no mesmo padrão, cada um com manual e apresentação:

| Treinamento | Para quem | Manual (Word) | Apresentação (PowerPoint) |
| --- | --- | --- | --- |
| Drone, Chute a Gol e Snap Pop: da venda à entrega do vídeo | vendedores do tablet, supervisores, equipe de entrega | `entregaveis/Manual - Drone, Chute a Gol e Snap Pop - da venda a entrega.docx` | `entregaveis/Treinamento - Drone, Chute a Gol e Snap Pop - da venda a entrega.pptx` |
| Fotos do Tour: da foto à venda online | vendedores do Posto de venda e caixas | `entregaveis/Manual - Fotos do Tour - da foto a venda online.docx` | `entregaveis/Treinamento - Fotos do Tour - da foto a venda online.pptx` |

Manual: um print por tela, setas numeradas iguais aos passos, regras uma vez só na seção 1, cancelamento passo a passo,
roteiro de treino e problemas comuns no fim. A apresentação segue a mesma sequência.

Os prints são das telas de verdade do app, sem servidor (respondido no navegador) e só com dados fictícios: as fotos de
demonstração do app são de clientes de verdade e nunca entram no material; no lugar delas vão fotos do estádio vazio com
silhuetas (`ferramentas/sprites_ficticias.py`), e a câmera mostra uma silhueta, nunca um rosto.

## Onde mora cada coisa

- `ferramentas/conteudo_video.py` e `ferramentas/conteudo_fotos.py`: o texto de cada treinamento (regras, passos, treino, problemas). O Word e o PowerPoint leem daqui.
- `ferramentas/gerar.py`: monta o Word e o PowerPoint dos dois.
- `ferramentas/capturar.js` (vídeo) e `ferramentas/capturar-fotos.js` (fotos): tiram os prints; `ferramentas/print_tela.js` é o comum aos dois.
- `ferramentas/marcar.py`: desenha as caixas e as setas numeradas e grava em `prints/`.

## Refazer depois de mudar uma tela

1. Material fictício (uma vez): fotos do Tour fictícias, `python ferramentas/sprites_ficticias.py <pasta das sprites>`; uma pasta de apoio com `0.jpg` a `4.jpg` (fotos fictícias), `silhueta.jpg`, `cliente.mjpeg` (quadros JPEG da silhueta, para a câmera) e um `.mp4` curto qualquer.
2. Prints, com o Chrome instalado na máquina (o Chromium dos testes não toca MP4):
   - vídeo: `NODE_PATH=<node_modules com playwright> U=<endereço do index.html> VIDEO=<mp4> FOTOS=<pasta de apoio> CAMERA=<cliente.mjpeg> node ferramentas/capturar.js <brutos do vídeo>`
   - fotos: `NODE_PATH=<node_modules com playwright> U=<endereço do index.html> SPRITES=<pasta das sprites> CAMERA=<cliente.mjpeg> node ferramentas/capturar-fotos.js <brutos das fotos>`
3. Setas: `python ferramentas/marcar.py <brutos do vídeo>` e `python ferramentas/marcar.py <brutos das fotos>`.
4. Documentos, rodando em `docs/treinamento`: `python ferramentas/gerar.py`.

Conferir as páginas e os slides (exportar para PDF pelo Word e pelo PowerPoint) antes de mandar.
