# Consentimento de Marketing

Pedido do Ronaldo em 28/11/2026. Situação: plano aprovado nos seis pontos abaixo; duas decisões abertas; nada construído.

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

## Decisões abertas (do Ronaldo)

1. **Foto com outras pessoas que não assinaram** (família, grupo): bloquear, ou liberar com aviso e a pessoa extra destacada para o supervisor decidir. Recomendação: aviso.
2. **Menores:** aceitar com assinatura do responsável e campo próprio, ou recusar menor. Recomendação: aceitar só com o responsável identificado.

## Acesso (suposição a confirmar)

- Cadastrar e conferir: supervisores e Admin.
- Baixar: permissão própria de marketing (Igor e quem o Ronaldo indicar).

## Regras de construção

- O registro mora no servidor do ponto, nunca só no navegador.
- Nenhum dado do cliente em log, em git ou em resposta de rota que não seja a da própria tela.
- Textos da tela nos idiomas do Eterna.
- Publicação fora do horário de operação.
