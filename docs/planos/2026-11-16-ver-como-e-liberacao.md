# Ver como (Admin assume a visão de outra pessoa) e liberação por função

Situação: pedido do Ronaldo em 16/11/2026. Implementado e no ar.

## 1. Liberação por função (planilha "Liberação Produto x POS x Vendedor x Device")

A planilha da operação diz o que cada pessoa vende. No Eterna, isso vira o perfil do cadastro. Os nomes ficam só no servidor, nunca no git.

| Na planilha ("Liberar somente") | Perfil no Eterna | O que a pessoa vê |
|---|---|---|
| Drone, Chute a gol, Snap Pop | Vendedor Drone, Chute a Gol e Snap Pop (`ativ`) | Venda e Entrega dos vídeos, as três abas |
| Snap Pop | **Vendedor Snap Pop (`snap`, novo)** | Venda e Entrega, só a aba do Snap Pop |
| Fotos | Atendimento e venda (`venda`) | Posto de venda, Checkout, Venda manual, Fila do fotógrafo, preços |
| Ingressos | sem cadastro no Eterna | a venda de ingresso é na Imply |

Perfil `snap`:
- Na tela, `ATIV_PERFIL_CATS` deixa só a aba do Snap Pop.
- No servidor, `ATIV_PERFIL_CATS` no agente faz `ativ_receber` recusar, com motivo `categoria`, venda de outro serviço enviada por quem tem esse perfil.
- O comando `--criar-vendedor` aceita `ETERNA_PERFIL=snap` (`PERFIS_CLI`).

## 2. Ver como

Admin (Ronaldo, Eduardo) abre o sistema exatamente como a pessoa vê, para conferir menu, telas e permissões. É só para olhar.

**Na tela**
- Em Usuários, o cadastro de quem não é Admin tem "Ver como esta pessoa" → **Ver como**.
- Enquanto vale, todas as telas mostram uma faixa no topo: "Vendo como Fulano (perfil) · só visualização", com o botão **Voltar para <admin>**.
- O botão volta para a conta do Admin e abre Usuários.

**No servidor (`POST /auth/assumir {usuario}`)**
- Só quem tem perfil Admin e não está em outro "ver como".
- Não vale para um Admin, para alguém com acesso que o Admin não tem, para cadastro desativado ou para si mesmo.
- Cria uma sessão da pessoa com `por` = o Admin (coluna nova em `sessao_login`), válida por 4 horas (`ASSUMIR_S`).
- A sessão do Admin fica guardada no cookie `eterna_sessao_adm`.
- Fica no `login_log` como `ver_como`, com o fim registrado como `ver_como_fim`.

**Só olha**
- O servidor recusa todo POST nessa sessão com 403 `so_ver`; ficam livres só `/auth/voltar` e `/auth/sair`.
- Na tela, nada se grava em nome da pessoa:
  - `guardAct` barra as ações de gravação;
  - `agFetch` não manda POST;
  - a fila do banco (`agenteDb`) não recebe nem sobe nada;
  - `pvEvento` e `avRegistrar` param;
  - `loginMark` não marca a última entrada dela.

**Fim**
- `POST /auth/voltar` apaga a sessão do "ver como" e devolve a do Admin.
- `/auth/sair` durante o "ver como" encerra as duas sessões.
- Se o Admin perde o perfil Admin ou é desativado, o "ver como" cai na hora (`auth_quem`).

**Testes:** `testes/ver_como_agente.py` (servidor) e `testes/ver_como.js` (tela).
