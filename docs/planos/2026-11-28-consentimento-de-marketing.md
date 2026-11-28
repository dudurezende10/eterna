# Consentimento de Marketing

Pedido do Ronaldo em 28/11/2026. Situação: plano aprovado e decidido; nada construído. Construção e publicação fora do horário de operação.

## Para que serve

Os supervisores (Igor, Karen, Tatiana) às vezes recolhem, no papel, a autorização assinada de um cliente para o Viva Maracanã usar as fotos dele em marketing. Hoje isso não fica no sistema e ninguém consegue achar as fotos desse cliente depois. A tela nova guarda a prova do consentimento, acha as fotos do cliente no Tour e deixa o marketing baixá-las.

## Fluxo

1. Menu: **Consentimento de Marketing**.
2. O supervisor abre um registro novo e informa nome e um contato do cliente.
3. Registra a foto do cliente: tirada na hora pela câmera do aparelho ou enviada do celular. Esta foto fica gravada (ao contrário da selfie de busca, que é descartada).
4. Registra a foto do papel assinado.
5. O servidor do ponto procura as fotos do cliente no dia da visita, pelos dois verificadores de rosto.
6. O supervisor confere e marca quais fotos são mesmo do cliente. Só as marcadas ficam liberadas.
7. Quem tem a permissão de marketing baixa as fotos liberadas, no original, sem marca d'água.

## Pontos aprovados (Ronaldo, 28/11)

- **Conferência humana antes de liberar.** A busca por rosto pode trazer um parecido; sem a marcação do supervisor nenhuma foto é liberada.
- **Cópia guardada à parte.** As fotos do Tour saem do servidor em 30 dias. As liberadas são copiadas para uma pasta própria, com a foto do cliente e a do papel, e ficam pelo tempo de uso da imagem.
- **Registro de quem e quando.** Quem cadastrou, quem conferiu e quem baixou cada foto, com data e hora.
- **Revogação.** Botão "consentimento retirado": bloqueia o download e marca as fotos que já tinham sido baixadas.
- **Dados do cliente.** Nome e um contato, para ligar o papel à pessoa e achar o registro num pedido de retirada.
- **Arquivo sem marca d'água.** O download do marketing é o original.

## Decisões do Ronaldo (28/11)

- **Foto com outras pessoas que não assinaram:** liberada, sem bloqueio. O supervisor já confere foto a foto.
- **Menores:** sem regra própria na tela nesta primeira versão; fica como o fluxo desenhado. Quem assina pelo menor no papel é assunto do processo dos supervisores.
- Começa simples, do jeito desenhado, e ajusta com o uso.

## Acesso (suposição a confirmar)

- Cadastrar e conferir: supervisores e Admin.
- Baixar: permissão própria de marketing (Igor e quem o Ronaldo indicar).

## Regras de construção

- O registro mora no servidor do ponto, nunca só no navegador.
- Nenhum dado do cliente em log, em git ou em resposta de rota que não seja a da própria tela.
- Textos da tela nos idiomas do Eterna.
- Publicação fora do horário de operação.
