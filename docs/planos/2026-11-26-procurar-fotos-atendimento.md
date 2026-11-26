# Procurar fotos para o atendimento e venda (26/11/2026)

## Objetivo

Pedido do Eduardo (26/11): a tela Procurar fotos fica liberada também para quem atende e vende. A finalidade é achar a foto do cliente no balcão, quando ele não a encontra no Checkout.

## O que entra

- Quem vê o Posto de venda (módulo Posto de venda em Ver e alguma tela de venda no menu) passa a ver **Procurar fotos**, logo depois do Posto. Não ganha Minhas fotos nem outra tela do grupo Fotógrafo.
- A tela mostra as sessões de hoje de todos os fotógrafos, em qualquer situação: aberta, fechando, fechada e já vendida.
- É só leitura para todos: nenhuma ação que grava vale nela.
- `procurar` é tela do módulo `venda` (caixa própria em Permissões, linha Posto de venda) e entra no perfil pronto Atendimento e venda. Quem tem Minhas fotos continua vendo a tela por ela.
- Quem já estava cadastrado ganha a tela uma vez (`migraProcurar26`, marca `mpf26`). Cadastro criado ou salvo desta versão em diante nasce com a marca e fica com o menu escolhido. A migração só entra no histórico e só grava o cadastro quando quem está conectado altera Permissões.
- Só vê apenas as próprias sessões quem tem vínculo de fotógrafo no cadastro e o módulo de Minhas fotos, fora Admin e Supervisora (`impPreso`).
- Menu: com Minhas fotos, a tela fica no grupo Fotógrafo; sem ela, no grupo Venda (`viewsMenu`).

## O que não muda

- O agente do ponto: `/sessoes`, `/thumb/` e `/file/` já aceitam o módulo de venda em Ver.
- O Checkout do cliente não mostra a tela nem o menu.

## Teste

`testes/procurar-fotos.js`.
