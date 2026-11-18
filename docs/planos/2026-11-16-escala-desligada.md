# Escala desligada (Eduardo, 16/11/2026)

Decisão do Eduardo: a Escala (quem trabalha em qual ponto, função do dia, 5×2) é assunto do Maracanã, não do Eterna. A tela Escala e a função do dia saem do sistema. O Calendário de eventos continua.

É a fatia 1 de três. As próximas (reconhecer a foto de IA pela imagem; montagem pronta no servidor antes do Checkout) têm plano próprio.

## O que mudou

- **Chave no código, desligada por padrão.** `ESCALA_ON=false` no `index.html` e `FUNCAO_DIA_ON=False` no agente.
- **Religar:** `ESCALA_ON=true` no `index.html` e `ETERNA_FUNCAO_DIA=1` no ambiente do agente. Tudo volta com os dados antigos no lugar.
- **Nada é apagado.** `vEscala`, `relEscala`, `funcSelect` e os textos continuam no arquivo, sem caminho até eles. No servidor, `funcao.json`, os documentos `funcao/<dia>` e o backup ficam como estão. `SIM.funcao` continua em `SIM_INTEIRO`. O menu gravado de cada pessoa guarda `escala` e só é filtrado na hora de desenhar.
- **Permissão.** O módulo mantém o id `escala` (nenhuma migração) e passa a se chamar "Calendário de eventos" nas 5 línguas (`mod_escala_cal`, `modi_escala_cal_*`). Com a chave desligada ele só tem a tela `calendario`. As ações `ag-*`, o `can('escala','u')` e a rota `/agenda/atualizar` não mudaram.
- **Perfil Fotógrafo.** Menu sem a Escala e descrição sem "Escala 5×2" (`pred_foto_se`). A Supervisora segue com `escala` de leitura e escrita, que é o Calendário.

## Comportamento com a chave desligada

| Onde | O que acontece |
|---|---|
| Menu, Permissões, Exportar, endereço `#escala` | A Escala não aparece e não abre. Quem tinha a Escala como tela inicial entra na tela inicial do perfil |
| Calendário de eventos | Igual: Admin e Supervisora criam, editam, apagam, importam e atualizam; Fotógrafo não vê |
| Minhas fotos | Fotógrafo vê o próprio nome, sem ponto |
| Fila do fotógrafo | Cada cartão mostra o nome (ou a origem), sem "campo · ponto" e sem aviso de folga |
| Preços e Checkout › Fundos de IA | "Fotos para os fundos de IA" fica só com o liga/desliga e uma nota (`cf_ia_sem_escala`) |
| Upload automático | Sessão sem base mostra "Fotos de IA: aguardando reconhecimento do ponto" (`up_iam_sem_ponto`) |
| Alertas e Vestiário | Sem o alerta de exemplo e sem o painel da escala |
| Agente, sessão nova | Nasce sem função e sem ponto; fecha com `ia=[]` e `ia_regra.motivo="sem_funcao"`; todas as fotos ficam à venda |
| Agente, `POST /fila-fotografo/funcao` | Confere origem, limite e permissão como antes e responde 409 `{"error":"escala_desligada"}` sem gravar. Janela antiga aberta durante o deploy não muda nada |

## No intervalo até a fatia 2

Vale o comportamento que já existia para sessão sem função do dia: nenhuma base de IA separada, todas as fotos à venda, e o Checkout monta os fundos de IA com as duas primeiras fotos do cliente, de qualquer ponto. A regra 15 de `docs/fundos-ia-regras.md` (os 2 primeiros cliques só para IA) fica suspensa até o reconhecimento pela imagem entrar.

## Testes

- `testes/escala-desligada.js`: o app como vai ao ar (menu, Permissões nas línguas da equipe, `#escala`, tela inicial, Calendário, Minhas fotos, Fila, painel dos fundos de IA) e, na mesma janela, a página com a chave ligada (religar devolve).
- `testes/fila_fotografo_agente.py`: 409 sem tocar no `funcao.json` (conteúdo e data), permissão conferida antes, sessão nova sem base.
- `testes/_escala.js`: entrega o `index.html` com a chave ligada para os testes que continuam cobrindo a Escala (`escala-fotografo`, a parte da Escala de `relatorios` e de `estatisticas`, `fila-fotografo`, `minhas-fotos-fotografo`, `cliques-ia*`). Os testes do agente ligam `FUNCAO_DIA_ON` no módulo ou `ETERNA_FUNCAO_DIA=1` no processo.

## Fica para depois

- Chave por venue no servidor (plano de white label). Hoje a chave no código vale para todos.
- Guia da equipe, documentação técnica, contexto e fluxos ainda citam a Escala: atualização à parte.
