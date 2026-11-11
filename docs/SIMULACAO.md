# Simulação do Eterna v97 com a montagem no servidor

Roteiro para rodar a simulação a partir do clone do repositório (branch `sim/v97-montagem`). O computador do ponto recorta e monta as fotos; o Checkout só mostra; o caixa vende.

**Aviso:** esta versão de simulação não tem o login do servidor. Use só em rede de confiança, com fotos de teste, e feche o programa ao terminar. Não abra a porta para a internet.

## O que precisa

- Um computador para ser o servidor (Windows 10 ou 11 de 64 bits; Mac como alternativa), com 16 GB de memória e 10 GB livres em disco. Não precisa de placa de vídeo.
- Python 3.12 ou 3.13 de 64 bits. Para conferir no Windows: abra o Prompt de Comando e digite `py -0`. Tem que aparecer `3.12` ou `3.13` com `64`. Se não aparecer, instale em python.org marcando "Add python.exe to PATH".
- Internet só na primeira vez (baixa cerca de 1,3 GB).
- Todos os aparelhos na mesma rede Wi-Fi do servidor.

## Instalar e iniciar

1. No clone, abra a pasta `agente` e dê dois cliques em `iniciar-simulacao.bat` (no Mac, `iniciar-simulacao.command`).
2. Na primeira vez ele instala o recorte e baixa os modelos. Quando pedir, aperte uma tecla para continuar.
3. Se o Windows perguntar se o Python pode usar a rede, clique em Permitir (redes privadas).
4. A janela mostra **PRONTO** e o endereço para os outros aparelhos, no formato `http://IP-do-servidor:8797`. Confira nela se aparece "Recorte local: pronto" e "Montagem no servidor: ligada".

A simulação usa pasta e portas próprias (pasta `Eterna-simulacao` dentro da pasta do usuário; portas 8797, 2197 e 8798). Ela não mexe em outra instalação do Eterna no mesmo computador.

## Abrir em cada aparelho

Em todos, abra o endereço que a janela mostrou. Para entrar, digite o e-mail do papel; o código de acesso aparece na própria tela. Não há senha.

| Aparelho | E-mail | Tela |
| --- | --- | --- |
| Celular do fotógrafo 1 | `carlos@eterna.photo` | Minhas fotos |
| Celular do fotógrafo 2 | `yago@eterna.photo` | Minhas fotos |
| Checkout (tela do cliente) | `quiosque@eterna.photo` | Checkout |
| Caixa | `loja@eterna.photo` | Posto de venda |

- Checkout com a câmera do rosto: abra o Checkout no próprio servidor, pelo endereço `http://127.0.0.1:8797`. O navegador só libera a câmera por esse endereço ou por https.
- Checkout em outro aparelho: toque em "Digite seu código" e use o código da sessão (começa com LP), que aparece em Minhas fotos e no Posto de venda.

## Do celular para o servidor

1. Passe as fotos da câmera para o celular pelo cabo USB, em JPEG.
2. No celular, em Minhas fotos, toque em "Enviar fotos do cartão manualmente" e depois em "Escolher fotos". Selecione as fotos da visita e confirme.
3. As fotos entram no nome do fotógrafo que está logado e no ponto dele no dia (Carlos no Terminal Campo, Yago no Foto Campo 2). Para trocar o ponto, um administrador muda na tela Escala.

Funciona em iPhone e Android, pelo navegador, sem instalar nada. Alternativa: aplicativo de FTP no celular ou FTP da câmera, apontando para o IP do servidor na porta 2197, com o nome do fotógrafo como usuário. A senha de cada um fica no arquivo `ftp.json` da pasta da simulação.

## Uma visita do início ao fim

1. O fotógrafo faz pelo menos 3 fotos da família e envia. As 2 primeiras fotos da visita viram as bases das montagens; as outras são as fotos à venda.
2. Um minuto depois da última foto, a sessão fecha e aparece no Checkout.
3. O servidor recorta as 2 bases e monta cada uma nos 5 fundos (Noite de campeão, Mirante ao pôr do sol, Arquibancada 1950, Saída do túnel e Telão do Maracanã). São 10 montagens por visita; o Checkout mostra 5.
4. No Checkout o cliente vê primeiro as montagens e depois as fotos, escolhe e pede.
5. No Posto de venda o caixa escolhe o pacote e a forma de pagamento e confirma. A venda sai para impressão e a galeria do QR abre no celular que estiver na mesma rede.

## Tempos esperados

- Recorte: de 15 segundos a mais de 1 minuto por foto, conforme o processador. O primeiro recorte do dia demora mais, porque abre os modelos.
- Montagem: de 1 a 3 segundos cada.
- O servidor recorta uma foto por vez. Com dois fotógrafos enviando juntos, as fotos entram na fila na ordem de chegada, e a segunda visita espera a primeira.
- Conta simples: as 5 montagens da tela ficam prontas de 1 a 3 minutos depois que as 2 primeiras fotos chegam. Enquanto isso o Checkout mostra "Preparando sua foto especial" e as fotos normais já podem ser vistas.

## Encerrar e apagar

- Encerrar: feche a janela do programa (ou Ctrl+C).
- Apagar tudo da simulação (fotos, vendas, modelos e ambiente): com o programa fechado, apague a pasta `Eterna-simulacao` dentro da pasta do usuário.
