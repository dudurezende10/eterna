# Plano técnico v78: área de Permissões em Configurações

## Objetivo
Criar em Configurações uma área de **Permissões** onde o admin escolhe, para cada usuário, o que ele pode fazer em cada módulo (Criar, Ver, Alterar, Excluir, com nome completo e explicação) e quais itens do menu ele vê. Os perfis prontos passam a seguir o pedido: atendimento sem dados de vendas e de fotógrafos, fotógrafo sem checkout. O cadastro de usuários ganha CRUD completo, histórico de mudanças e travas para ninguém se trancar fora.

## Pergunta ao Eduardo (mensagem cortada)
A mensagem parou em: "Já o fotógrafo não precisa ver o checkout, nem nada que o tire da atividade dele. Aí ele vai passar para o...". Para quem ou para o que o fotógrafo passa? Algumas leituras possíveis:
- (a) passa a sessão para a Qualidade (validador);
- (b) passa para a próxima sessão no set;
- (c) passa o cliente para o atendimento na Loja.

O plano não depende da resposta. Os campos "tela inicial" e "menu por usuário" atendem qualquer uma das três. Se for um fluxo de passagem (handoff), ele vira a v79.

Outras confirmações, todas com padrão já assumido:
1. O fotógrafo continua vendo o "Índice do fotógrafo" (só o dele)? Assumido: sim.
2. O atendimento vê o Catálogo, só para leitura? Assumido: sim.
3. "Ver" sozinho na área de Permissões serve para alguém (um auditor, por exemplo)? Assumido: não. Para ver a área é preciso "Ver" e "Alterar", que ficam ligados.

## Escopo desta entrega
1. Novo grupo de menu **Configurações** com Usuários, Permissões, Identidade e Repositório.
2. Nova view `permissoes` com três abas:
   - **Por usuário**: matriz de módulos × C/R/U/D com rótulos para leigo, telas do menu por módulo, tela inicial e "Aplicar perfil";
   - **Perfis prontos**: só leitura, explica cada perfil;
   - **Histórico**: auditoria.
3. Menu por usuário: uma lista de telas permitidas, que filtra além do módulo. Uma tela fora da lista some do menu e também é bloqueada pelo `#hash` e por `go()`.
4. Módulos reorganizados:
   - `venda` é dividido em `venda` (operar a venda) e `financeiro` (lista e números de vendas);
   - `usuarios` (cadastro) fica separado do novo `permissoes`.
5. Perfis revisados (tabela abaixo), com tela inicial.
6. Cadastro (view `usuarios`):
   - criar, ver, alterar, desativar e reativar, e excluir com confirmação em 2 toques;
   - a matriz sai daqui e vai para Permissões.
7. Auditoria de toda mudança de usuário e de permissão (local e `state.db`).
8. Travas:
   - ninguém tira de si mesmo o acesso às permissões;
   - sempre existe pelo menos 1 administrador;
   - ninguém dá um acesso que não tem;
   - ninguém edita quem tem mais acesso do que ele;
   - recuperação de administrador no protótipo.
9. A tela Início só mostra "R$" e contagens para quem tem o módulo correspondente.
10. A revogação vale entre abas do mesmo navegador (evento `storage`).

## Fora do escopo (próximas versões)
- **Fazer valer as permissões no servidor (v79+).** Hoje tudo é verificado no navegador; o contrato está desenhado abaixo.
- Permissões por venue e perfis editáveis por venue (CRUD de perfis).
- Corrigir o login do protótipo: o `sessionLoad` confia no e-mail gravado no `localStorage`.
- O agente do ponto exigir token nas rotas de escrita.
- Permissão por registro (só as minhas sessões), além das regras que já existem no `diario` e no `fotografos`.
- I18N: são telas da equipe, em pt-BR.

## Decisões assumidas
| # | Decisão | Por quê |
|---|---|---|
| D1 | Duas camadas: a permissão do módulo (C/R/U/D) decide o que a pessoa **faz**. O menu (`menu: string[]`, lista de telas permitidas) decide o que ela **vê**. Uma tela só aparece com o "Ver" do módulo **e** estando na lista. | É o pedido literal: CRUD por módulo, mais "quais opções do menu". O menu nunca dá mais do que o módulo permite. |
| D2 | A lista de telas é de permitidas, não de escondidas. Tela nova não aparece para ninguém até alguém liberar. Exceção: Admin com perfil não personalizado recebe tudo automaticamente, como já acontece hoje com os módulos. | Menor privilégio. Evita vazar telas futuras. |
| D3 | `venda` fica com `['checkout','fila','caixa']`. O novo `financeiro` ("Números de vendas") fica com `['vendas-lista','vendas']`. `relatorios` fica com `['fluxo','semana','alertas']`. | Sem isso, quem vende vê a Lista de vendas e o volume. O cancelamento de venda (`sales-cancel`, letra `d`) passa a exigir `financeiro.d`. |
| D4 | Novo módulo `permissoes` com a view `permissoes`. "Ver" e "Alterar" ficam sempre ligados entre si. "Criar" e "Excluir" não se aplicam. `canView('permissoes')` exige `r` e `u`. | É o pedido: quem não pode alterar permissões não vê a área. |
| D5 | Cada módulo declara quais letras se aplicam (`MODULE_INFO`). Letra que não se aplica aparece como "não se aplica", desligada e gravada como `false`. | É o que torna a matriz legível para leigo (Relatórios só tem Ver, por exemplo). Um teste garante que nenhuma ação real fica sem letra. |
| D6 | Rótulos: "Criar (C · Create)", "Ver (R · Read)", "Alterar (U · Update)", "Excluir (D · Delete)". Embaixo do nome do módulo, uma linha visível explica o que cada letra faz naquele módulo. | É o pedido. Também vai no `title` e no `aria-label`. |
| D7 | Administrador = usuário ativo com todas as letras aplicáveis de todos os módulos e com todas as telas no menu. Invariante: `adminCount >= 1`. | Ninguém se tranca fora. |
| D8 | Sem escalada de privilégio:<br>- o editor só liga uma letra ou tela que ele mesmo tem;<br>- se o alvo tem algo que o editor não tem, o editor abre só para leitura ("Esta pessoa tem acessos que você não tem");<br>- no cadastro, o select de perfil só lista perfis contidos nos acessos do editor. | Um supervisor com acesso ao cadastro não vira admin. |
| D9 | "Excluir" usuário apaga o cadastro. Já existe uma lápide (`deleted:true`) no `state.db`. O histórico guarda um retrato (nome, perfil, resumo dos módulos). Desativar continua existindo e é o caminho recomendado. | "Nada se perde": quem foi, quando e por quem fica registrado. |
| D10 | Campo `inicio` (tela inicial) por usuário. O Fotógrafo cai no `set`, o Validador na `revisao` e o Cliente no `convidado`. Se a tela não for permitida, vale o `homeView()` atual. | "Nada que tire o fotógrafo da atividade." |
| D11 | Migração dos usuários já salvos para `v:2`:<br>- **com perfil não personalizado**: `financeiro`, `permissoes`, `menu` e `inicio` vêm do perfil novo (o vendedor perde a Lista de vendas de propósito);<br>- **personalizados**: mantêm o acesso que tinham, com `financeiro = venda.r \|\| relatorios.r ? {r:true, d:venda.d} : NONE`, `permissoes = usuarios.u ? {r,u} : NONE` e `menu` = todas as telas dos módulos com "Ver". | Ninguém perde acesso sem que alguém tenha decidido. |
| D12 | Recuperação (só no protótipo): se ao carregar não houver nenhum admin ativo, os e-mails admin do `SEED_USERS` voltam a ser admin e o histórico registra `acao:'recuperacao'`. | Em produção isso vira um comando no servidor, nunca no navegador. |
| D13 | Esta entrega é aplicada **sobre a v77**. Fica mantido o módulo `galerias` e o `PRESETS.supervisor.perms.galerias`. A Loja segue como rota pública `#loja`. O item "Loja" (view `quiosque`) continua com a regra especial `quiosque.r \|\| venda.r`. | Esconder "Loja" do menu de alguém não impede ninguém de abrir `#loja`. Isso é esperado, porque é a área do cliente. |

### Perfis revisados (`PRESETS`)
| id | Nome | Módulos | `menu` | `inicio` |
|---|---|---|---|---|
| admin | Admin | tudo | todas as telas | Início |
| foto | Fotógrafo | set CRU, diario CRU, desempenho R | set, importar, ajustes, diario, fotografos | set |
| venda | **Atendimento e venda** | venda CRU, quiosque CR, catalogo R, galeria R | quiosque, convidado, catalogo, checkout, fila, caixa | Início |
| valida | Validador | qualidade (todas), set R, diario R | revisao, treino, set, diario | revisao |
| supervisor | Supervisor | igual a hoje, mais **financeiro R** e galerias CRU (v77). Sem usuarios e sem permissoes. | todas as telas desses módulos | Início |
| quiosque | Quiosque | quiosque CR | quiosque | quiosque |
| cliente | Cliente | galeria R | convidado | convidado |

Cada perfil ganha um `desc` em linguagem simples. Exemplo: "Vê: set, upload, ajustes, diário e o próprio índice. Não vê: Loja, vendas, outros fotógrafos." O desc aparece na aba Perfis prontos e ao lado do select.

## Mudanças por arquivo

### `index.html`
Os números de linha estão mudando por causa da v77; os pontos abaixo citam funções.

**`VIEWS`**
- Mudar o 4º campo de `identidade`, `repo` e `usuarios` para `'Configurações'`.
- Acrescentar `['permissoes','Permissões','quem vê e faz o quê','Configurações']`.
- Deixar o grupo contíguo e no fim, nesta ordem: usuarios, permissoes, identidade, repo. O `render()` abre um cabeçalho de grupo a cada troca de grupo, então itens do mesmo grupo precisam ficar juntos.

**`MODULES`**
- `venda` → `['checkout','fila','caixa']`, nome "Venda no balcão".
- Novo `['financeiro','Números de vendas',['vendas-lista','vendas']]`.
- `relatorios` → `['fluxo','semana','alertas']`.
- `usuarios` → nome "Cadastro de usuários".
- Novo `['permissoes','Permissões',['permissoes']]`.
- Manter `galerias` da v77.

**Novos `OPS_INFO` e `MODULE_INFO`** (contratos abaixo)
- `opOk(m,op)`: diz se a letra se aplica ao módulo.
- `permNorm(perms)`: grava `false` nas letras que não se aplicam, obriga `r` quando houver `c`, `u` ou `d`, e liga `r` e `u` de `permissoes` juntos.
- `OPS` continua existindo, porque o `guardAct` usa.

**`PRESETS`**
- Acrescentar `menu`, `inicio` e `desc` em cada perfil.
- Renomear `venda`.

**Novas funções de perfil**
- `presetMenu(k)`: no admin, todas as telas de `MODULES`; nos outros, `preset.menu` filtrado pelos módulos com "Ver".
- `presetMatch(d)`: devolve o id do perfil quando `perms`, `menu` e `inicio` batem exatamente com ele; senão, `'custom'`.

**Migração**
- `migrateUser(x)` (nova): aplica D11 e `permNorm`, e grava `v:2`.
- `migrateUsers()` (nova): roda `migrateUser` em todos e depois `ensureAdmin()` (D12).
- Substitui o miolo do `try{...localStorage.getItem('eterna.users.v1')...}` atual. O código de renomear `admin@`, o `andressa` e o seed `'3'` continuam como estão.
- Também é chamada para cada documento do `onSnapshot('usuarios')`.

**Acesso**
- `userFor()`: o convidado ganha `menu:presetMenu('cliente')` e `inicio:'convidado'`.
- `userMenu(u)`: `Array.isArray(u.menu) ? u.menu : presetMenu(u.preset)`.
- `menuOk(v)`: `userMenu(state.user).includes(v)`.
- `canView(v)`: mantém `entrar` e `perfis`. A base passa a ser a do módulo (com a regra especial do `quiosque`) `&& menuOk(v)`. Para `permissoes`, exige também `can('permissoes','u')`.
- `homeView()`: começa com `if(u.inicio&&canView(u.inicio))return u.inicio`.
- `isBare()`: sem mudança.

**Regras**
- `isAdminUser(u)` e `adminCount(users)`.
- `permValidate(editor, alvoAntes, alvoDepois, usersDepois)` devolve `{ok, motivo, msg}`, com os motivos:
  - `auto_bloqueio`: o editor é o alvo e perderia `permissoes.r/u`, `usuarios.r/u` ou as telas `permissoes`/`usuarios`;
  - `sem_admin`: `adminCount(usersDepois) < 1`;
  - `sem_poder`: liga uma letra ou tela que o editor não tem;
  - `alvo_maior`: o alvo antes já tinha algo que o editor não tem.
- Chamar `permValidate` em **todo** caminho que grava: `permSave`, `userSave`, `user-active`, `user-del-ok` e a migração (só para logar).

**Auditoria**
- `permDiff(antes, depois)` devolve as `mudancas` (contrato abaixo).
- `auditLog(acao, alvo, mudancas, extra)`:
  - `unshift` em `eterna.users.log.v1`, com no máximo 1.000 itens;
  - com `state.db`, também `state.db.doc('usuarios_log/'+id).set(e)`;
  - sem mudanças, não grava nada.
- `auditText(e)`: frase legível para a aba Histórico, sempre com `esc()`.

**`vPermissoes()`** (nova; `state.perm={tab:'usuario',sel:null,draft:null,q:'',logQ:'',presetPick:null}`)
- Cabeçalho "Configurações · Permissões" e uma legenda fixa: "C, R, U e D são as iniciais em inglês de Create (criar), Read (ver), Update (alterar) e Delete (excluir). Cada pessoa só vê e faz o que estiver marcado."
- Chips de aba `perm-tab`.
- **Aba Por usuário**
  - Lista com busca: nome, e-mail, perfil, pill "desativado".
  - Editor com nome e e-mail (só leitura) e o perfil atual, ou "Personalizado".
  - Select de perfil + "Aplicar perfil" (`perm-preset`, `perm-preset-apply`).
  - Select "Tela inicial" (`perm-inicio`), com as telas permitidas do rascunho mais "Início".
  - Matriz `permMatrix(d, ro)`:
    - uma linha por módulo, com nome, `MODULE_INFO[m].desc` e as descrições das letras aplicáveis;
    - 4 células `input[type=checkbox][data-act=perm-op][data-m][data-op]`;
    - letra que não se aplica vira `<span class="perm-na" title="Não se aplica a este módulo">—</span>`;
    - com "Ver" ligado, uma sublinha "Aparece no menu:" com um checkbox por tela (`data-act=perm-view data-v`), usando o rótulo de `VIEWS`. Checkout, Fila e Caixa aparecem com o sufixo "(tela sem item no menu)".
  - Barra com a pill "alterações não salvas" (quando há diferença), "Salvar" (`perm-save`) e "Descartar" (`perm-discard`).
  - Com `ro`, tudo desligado e uma nota explicando o motivo.
- **Aba Perfis prontos**: um card por perfil com `desc`, os módulos com as letras por extenso e as telas.
- **Aba Histórico**: tabela com quando, quem, pessoa, ação e o que mudou; busca `perm-logq` e no máximo 300 linhas.

**`permDraft(email)`, `permSave()` e `permApplyPreset(k)`**
- O rascunho é uma cópia funda.
- Regras do rascunho no `change`:
  - ligar C, U ou D liga R;
  - desligar R limpa C, U e D e tira do menu as telas do módulo;
  - ligar uma tela liga R do módulo;
  - em `permissoes`, R e U andam juntos;
  - depois de cada mudança, `preset = presetMatch(d)`.
- `permSave()`:
  1. monta `usersDepois`;
  2. chama `permValidate` e, se falhar, mostra `toast(msg)` e não grava;
  3. grava `updatedAt` e `updatedBy`;
  4. chama `saveUsers(e)` e `auditLog('permissoes'|'perfil_aplicado', ...)`;
  5. se o alvo é o próprio usuário, atualiza `state.user = userFor(e)`.

**`vUsuarios()` (cadastro)**
- Sai a tabela `perms`.
- No **novo usuário**: nome, e-mail, fotógrafo vinculado e perfil (só os perfis permitidos por D8). Ao criar, recebe `presetPerms`, `presetMenu`, `inicio`, `createdBy` e `v:2`, e gera auditoria `criar`.
- No **existente**: mostra o perfil e o resumo dos módulos, com o botão "Editar permissões" (`perm-open data-e`) quando `canView('permissoes')`. Também:
  - "Desativar"/"Reativar";
  - "Excluir acesso", que troca para "Confirmar exclusão" (`user-del-ok`) e "Cancelar";
  - sem esses botões para si mesmo.
- Sem `usuarios.u`, campos só de leitura e sem botões de gravar.
- `userSave()`, `user-active` e `user-del-ok` passam por `permValidate` e `auditLog` (`alterar`, `desativar`, `reativar`, `excluir` com `antes`).

**Handlers**
- Clique:
  - `perm-tab`, `perm-sel`, `perm-save`, `perm-discard`, `perm-preset-apply`;
  - `perm-open`: `state.perm.sel=e; permDraft(e); go('permissoes')`;
  - `user-del-ask`, `user-del-ok`, `user-del-no`.
- `change`:
  - `perm-op`, `perm-view`, `perm-inicio`, `perm-preset`;
  - antes de tudo: `if(!can('permissoes','u')){e.target.checked=!e.target.checked;return;}`.
- `input`: `perm-q`, `perm-logq`.
- Remover o caso `user-perm` do `change` e a exceção `a!=='user-perm'` do clique.

**`WRITE_OPS`**
- Acrescentar `'perm-save':'u'`, `'perm-preset-apply':'u'`, `'user-del-ok':'d'`.
- Remover `'user-perm'`. `user-del` vira `user-del-ask`, sem gravar.

**Outros pontos**
- `vPerfis()`:
  - as pills "no set / na fila / no checkout" só com `can('set','r')||can('venda','r')`;
  - a pill "pagas · R$" só com `can('financeiro','r')`.
- Novo `window.addEventListener('storage', ...)` para `eterna.users.v1`: relê, chama `migrateUsers()` e atualiza `state.user`. Se o usuário sumiu ou foi desativado, chama `logout()` e mostra `toast('Seu acesso foi removido')`.
- Firestore:
  - no `onSnapshot('usuarios')`, aplicar `migrateUser(x)`;
  - novo `onSnapshot('usuarios_log')`, que junta no log local sem duplicar (por `id`).
- `VIEWFN.permissoes = vPermissoes`.
- `window.ETERNA` passa a expor `permValidate`, `permDiff`, `MODULE_INFO`, `userMenu`, `adminCount`, `migrateUsers` e `get USERS()`.

**CSS**
- `.perm-tbl` (cabeçalho com a palavra grande e a sigla pequena), `.perm-desc`, `.perm-na`, `.perm-views` (chips com checkbox).
- `@media(max-width:700px)`: cada módulo vira um card com 4 toggles empilhados (palavra, sigla e descrição). Sem rolagem horizontal.

**Versão**
- Carimbo v78 nas 2 ocorrências.

### Testes
- **`testes/permissoes.js` (novo)**: critérios 1 a 20.
  - Usa `_login.js` e logins por e-mail (o código vem de `.otp`).
  - Prints em `testes/prints/permissoes-*.png`.
- `testes/todas-as-telas.js`: sem mudança, já cobre `permissoes` pelo menu do admin.

### Documentação
- **`docs/CONTEXTO-ETERNA.md`**:
  - seção 3: as duas camadas (módulo e menu), `MODULE_INFO`, `permValidate` e "nova tela entra em `MODULES`, `MODULE_INFO` e no `menu` dos perfis";
  - seção 5: D3, D4 e D7.
- **`docs/DOCUMENTACAO-TECNICA.md`**: atualizar o parágrafo "Acesso" (módulos novos, menu por usuário, auditoria e o que é protótipo).
- **`VERSOES.md`**: linha da v78.

## Contratos

**Usuário v2** (`eterna.users.v1` e `usuarios/<email>`)
```json
{"v":2,"email":"carlos@eterna.photo","name":"Carlos","key":"carlos","preset":"foto",
 "perms":{"set":{"c":true,"r":true,"u":true,"d":false},"financeiro":{"c":false,"r":false,"u":false,"d":false}},
 "menu":["set","importar","ajustes","diario","fotografos"],"inicio":"set",
 "active":true,"createdAt":"…","createdBy":"eduardo@eduardorezende.com","updatedAt":"…","updatedBy":"…","lastLogin":null}
```

**`OPS_INFO`**
```js
[['c','Criar','Create','incluir algo novo'],['r','Ver','Read','abrir a tela e consultar'],
 ['u','Alterar','Update','mudar o que já existe'],['d','Excluir','Delete','apagar ou cancelar']]
```

**`MODULE_INFO`** (letras aplicáveis iniciais; o teste do critério 19 manda: se aparecer uma ação, a letra entra)

| módulo | desc | c | r | u | d |
|---|---|---|---|---|---|
| set | Anfitrião no set, Upload, Ajustes | abrir sessão e importar fotos | ver set, sessões e fotos | ajustar fotos, função do dia, parar recebimento | cancelar sessão, zerar importação |
| diario | Diário do set | registrar ocorrência | ver o diário | marcar como resolvida | ver e tratar ocorrências de toda a equipe (sem isso, só as próprias) |
| desempenho | Índice do fotógrafo | não | ver o índice (o fotógrafo vinculado vê só o dele) | não | não |
| venda | Checkout, Fila, Caixa | registrar pagamento, reimprimir | abrir as telas de venda | escolher fotos, fundo e vendedor | não |
| financeiro | Lista de vendas, Vendas e caixa | não | ver vendas, valores e volume | não | cancelar venda |
| quiosque | Loja | fechar compra | abrir a Loja | não | não |
| galeria | Galeria do convidado (demonstração) | não | ver | não | não |
| galerias | Galerias e cortesias (v77) | criar galeria e grupo de escola | ver | dar ou retirar cortesia, reenviar | encerrar grupo |
| qualidade | Qualidade, Treino da IA | importar fotos de treino | ver | avaliar, marcar, descartar, rotular | não |
| relatorios | Fluxo, Semana, Alertas | enviar galerias de quem não comprou | ver relatórios | não | não |
| configuracao | Fundos de IA, Vestiário, Escala, Repositório, Identidade | não | ver | mudar escala, repositório e identidade | não |
| catalogo | Catálogo | não | ver preços | mudar preços | não |
| estoque | Estoque, Bandeiras | cadastrar bandeira | ver | trocar rolo, mudar estado | excluir bandeira |
| usuarios | Cadastro de usuários | cadastrar pessoa | ver a lista | mudar nome, e-mail, fotógrafo, ativar e desativar | excluir acesso |
| permissoes | Permissões | não | ver e mudar o que cada pessoa vê e faz (sempre junto com Alterar) | (junto com Ver) | não |

**Entrada de auditoria** (`eterna.users.log.v1[]` e `usuarios_log/<id>`)
```json
{"id":"L1761579000000-k3f9","em":"2026-10-27T15:30:00.000Z","por":"eduardo@eduardorezende.com",
 "alvo":"carlos@eterna.photo","acao":"permissoes",
 "mudancas":[{"campo":"perms.set.d","de":false,"para":true},
             {"campo":"menu","sai":["importar"],"entra":[]},
             {"campo":"preset","de":"foto","para":"custom"}],
 "venue":"maracana","origem":"app-v78"}
```
- `acao` ∈ `criar | alterar | permissoes | perfil_aplicado | desativar | reativar | excluir | recuperacao`.
- `excluir` leva `antes:{name,preset,modulos:[...]}`.
- Nunca leva código de login, token nem IP.

**Contrato do servidor (alvo da v79; não implementar agora)**

| Rota (Bearer do `/auth/verificar`) | Função |
|---|---|
| `GET /auth/eu?venue=` | Devolve `{email,nome,venue,perfil,perms,menu,inicio,versao,exp,assinatura}`. O app guarda essa resposta como cache para funcionar offline. |
| `GET /usuarios?venue=` · `POST /usuarios` · `PATCH /usuarios/:email` · `DELETE /usuarios/:email` | CRUD. Cada rota checa a permissão e roda `permValidate` numa transação. |
| `PUT /usuarios/:email/acessos/:venue` | Grava `{perfil,perms,menu,inicio}` por venue. |
| `GET /auditoria?alvo=&desde=&cursor=` | Lista a auditoria (só acrescenta, nunca apaga), paginada. |

Modelo no servidor: `usuarios(email)`, `acessos(email, venue, perfil, perms, menu, inicio)`, `perfis(venue, id, …)`, `auditoria` (só acréscimo) e um papel de plataforma ("dono da plataforma", fora dos venues) separado do admin do venue.

## Critérios de aceite
1. Logado como admin, o menu tem o grupo "Configurações" com Usuários, Permissões, Identidade e Repositório, nessa ordem e contíguos. `#permissoes` abre sem "Algo falhou". O `todas-as-telas` inclui `permissoes`.
2. O cabeçalho da matriz mostra "Criar", "Ver", "Alterar" e "Excluir", cada um com "C · Create", "R · Read", "U · Update" e "D · Delete". Nenhuma célula de cabeçalho tem só uma letra. O texto da legenda está presente.
3. Toda linha de módulo mostra visível a descrição de cada letra aplicável. Em "Números de vendas", as células de Criar e Alterar são `.perm-na`, sem checkbox. Em "Permissões", Criar e Excluir são `.perm-na`.
4. No rascunho:
   - ligar "Alterar" em um módulo sem "Ver" liga "Ver";
   - desligar "Ver" desliga C, U e D e todas as telas do módulo;
   - ligar uma tela liga "Ver";
   - em Permissões, ligar "Ver" liga "Alterar" e vice-versa.
5. Como admin, tirar "Upload" do menu do Carlos e salvar. Logado como `carlos@`:
   - o `#nav` não tem `[data-v="importar"]`;
   - `ETERNA.state.view='importar';render()` cai em outra tela;
   - abrir `U#importar` mostra "Sem acesso a esta tela";
   - `set` e `ajustes` continuam no menu.
6. Com o seed limpo, logado como `carlos@`:
   - os `data-v` do menu ficam dentro de {set, importar, ajustes, diario, fotografos};
   - depois do login a view é `set`;
   - abrir `perfis` não mostra "R$".
7. Logado como `loja@` (Atendimento e venda):
   - o menu tem `quiosque` e não tem vendas-lista, vendas, fotografos, fluxo, semana, alertas, revisao, usuarios nem permissoes;
   - `canView('vendas-lista')===false`;
   - o Início não contém "R$".
8. Logado como `supervisor@`: vê vendas-lista e vendas, e o clique em Cancelar venda é barrado pelo `guardAct` (toast "Sem permissão"). Não vê Usuários nem Permissões.
9. Migração. Com um `eterna.users.v1` no formato da v77, contendo um usuário `custom` com `venda` RW e o `loja@` com perfil `venda`, ao carregar:
   - o custom tem `financeiro.r===true` e um `menu` que inclui `vendas-lista`;
   - o `loja@` tem `financeiro.r===false`;
   - todos têm `v:2`;
   - nenhum usuário some.
10. Como admin, editando a si mesmo: desligar "Ver" de Permissões, ou tirar Permissões ou Usuários do próprio menu, e salvar mostra um toast com "outro administrador" e não altera o `USERS`.
11. `ETERNA.permValidate` com um `usersDepois` sem nenhum admin devolve `motivo:'sem_admin'`. Ao carregar um `localStorage` sem admin ativo, `eduardo@` volta a ser admin e o histórico tem `acao:'recuperacao'`.
12. Criar `gerente@` (personalizado: usuarios CRUD, permissoes RU, set R, sem financeiro). Logado como gerente:
    - no Carlos, o checkbox "Ver" de Números de vendas está desativado;
    - `permValidate` com essa letra ligada devolve `sem_poder`;
    - abrir o Eduardo mostra o editor só para leitura (`alvo_maior`);
    - no cadastro, o select de perfil não oferece Admin nem Supervisor.
13. Cadastro:
    - criar `teste@eterna.photo` (Fotógrafo) faz ele aparecer na lista;
    - mudar o nome grava;
    - "Desativar" faz o login com esse e-mail mostrar "Este e-mail não tem acesso";
    - "Reativar" funciona;
    - "Excluir acesso" só apaga depois de "Confirmar exclusão";
    - e-mail duplicado ou inválido é recusado;
    - na própria linha não existem Desativar nem Excluir.
14. Auditoria:
    - cada gravação acrescenta exatamente 1 entrada em `eterna.users.log.v1` com `por`, `alvo`, `acao` e `mudancas` (por exemplo `perms.set.d` de false para true e `menu.sai` contendo `importar`);
    - salvar sem mudança não acrescenta nada;
    - a aba Histórico mostra a frase com os nomes;
    - com um `state.db` falso (stub), `usuarios_log/<id>` recebe o mesmo objeto;
    - nome com `<img onerror>` aparece como texto, sem executar.
15. Um usuário com `usuarios` só R vê a lista do cadastro sem botões de gravar e não tem Permissões no menu. Um usuário com `permissoes.r` sem `u` também não vê Permissões.
16. Logado sem `permissoes.u`, disparar `change` num `perm-op` (pelo DOM) volta o checkbox e não altera o rascunho.
17. Com `inicio='diario'` no Carlos, o login cai em `diario`. Com um `inicio` não permitido, cai no `homeView()` padrão.
18. `permissoes` e `usuarios` em 390×844, 1024×1366 e 1440×900 têm `scrollWidth <= innerWidth`. Em 390, a matriz aparece como cards. Prints salvos.
19. Consistência:
    - como admin, abrir cada view de cada módulo e coletar os `data-act` em `#main`;
    - toda ação encontrada no `WRITE_OPS` (menos `reset`) tem a letra aplicável no `MODULE_INFO` do módulo da view;
    - todo módulo de `MODULES` tem entrada no `MODULE_INFO` e uma descrição para cada letra aplicável.
20. Duas páginas no mesmo contexto: A logada como admin, B como `carlos@`. Desativar o Carlos em A faz B voltar para a tela de login em até 1 s, com o toast "Seu acesso foi removido".
21. `bash testes/rodar.sh` termina com `FALHAS: 0`, incluindo a Loja e os testes da v77.
22. O carimbo v78 está nas 2 ocorrências e o `VERSOES.md` tem a linha da v78.

## Riscos para o revisor de segurança

**BLOQUEANTE para produção, não para esta entrega** (o Eduardo precisa saber que hoje é protótipo):
- As permissões só valem no navegador. Quem edita o `localStorage` (`eterna.users.v1`) vira admin. Esconder do menu é experiência de uso, não segurança.
- O `sessionLoad()` aceita qualquer `{email}` em `eterna.session` sem verificar o token. Qualquer pessoa entra como qualquer e-mail.
- O `state.db` (`claude.use('db')`) aceita escrita de qualquer pessoa que abre o artifact, inclusive em `usuarios/` e `usuarios_log/`. A auditoria local pode ser apagada.
- O agente do ponto não confere usuário nas rotas, e `/thumb` e `/file` são abertas (já registrado na v77).
- **Caminho de correção (v79)**: o servidor é a fonte da verdade (contrato acima); cada rota de dados checa o token e a permissão; as regras de `permValidate` rodam no servidor; a auditoria só aceita acréscimo. O app guarda `/auth/eu` assinado (Ed25519) com validade de 12 h para o ponto funcionar offline, e o agente valida a assinatura com a chave pública. A revogação offline demora no máximo até a validade vencer, e isso precisa ser dito.

**Checar nesta entrega:**
- `permValidate` está em **todos** os caminhos que gravam (permSave, userSave, user-active, user-del-ok, aplicar perfil). Não pode haver gravação direta em `USERS[...]` fora deles.
- O `change` de `perm-op` e `perm-view` checa `can('permissoes','u')` antes de qualquer coisa.
- Sem escalada pelo select de perfil do cadastro.
- `esc()` em nome, e-mail e motivo no Histórico e nos atributos `data-e`.
- A auditoria não guarda código, token nem IP.
- O listener de `storage` só relê dados; não executa nada que venha deles.
- A recuperação D12 existe só porque é protótipo e precisa sumir quando o servidor entrar.

**Escala:**
- **1 venue**: cerca de 20 usuários e uma auditoria de dezenas de linhas por mês. Trivial.
- **100 venues**: cerca de 2.000 usuários.
  - Permissão por (usuário, venue), com uma pessoa em vários venues (o Eduardo).
  - Perfis editáveis por venue.
  - Admin do venue não enxerga outros venues.
  - Papel de plataforma separado.
  - Auditoria paginada no servidor, nunca carregada inteira no app.
  - O `onSnapshot` da coleção inteira de `usuarios_log` não escala; na v79 vira consulta paginada.
- **Internet caída**:
  - no protótipo, as mudanças ficam locais e sincronizam depois pelo `state.db`, com a última gravação vencendo;
  - em produção, mudar permissão exige servidor (fica bloqueado offline) e o ponto opera com o último retrato assinado.
- **Troca de venue na Identidade**: hoje é só a marca. Quando as permissões forem por venue, trocar de venue vai exigir trocar o retrato de acesso, senão quem troca fica trancado fora.
## Pendências para a v79
Registradas na revisão de segurança da v78 (`2026-10-28-v78-seguranca.md`). Não bloqueiam a v78 (protótipo), mas precisam entrar antes de produção.
1. **Riscos aceitos do protótipo:**
   - permissões e login são verificados só no navegador;
   - o `sessionLoad` confia no e-mail gravado no `localStorage`;
   - o `state.db` aceita escrita de qualquer um, inclusive em `usuarios/`, `usuarios_login/` e `usuarios_log/`. O histórico pode ser apagado ou forjado, e o `por` é declarado pelo próprio navegador.
   - Correção: servidor como fonte da verdade (contrato acima), `permValidate` rodando no servidor (já com o motivo `sem_permissao`), auditoria só de acréscimo com `por` vindo do token.
2. **Recuperação de admin (D12) sem trava:** o `ensureAdmin` roda sempre que o app carrega, só localmente, e um `onSnapshot('usuarios')` posterior pode sobrescrever o admin recuperado. Pôr atrás de uma marca de protótipo e trocar por um comando no servidor.
3. **LGPD no histórico:** nomes e e-mails ficam no `localStorage` (`eterna.users.log.v1`) e em `usuarios_log` sem prazo de retenção definido. Definir a retenção. O `onSnapshot` da coleção inteira vira consulta paginada no servidor.
4. Sugestão da revisão de código: chamar `permValidate` na migração só para registrar no histórico (hoje a migração não dá acesso novo a ninguém).

Já corrigido na volta da v78:
- B1: `permValidate` com o motivo `sem_permissao`; `userApply` e `permSave` conferem a permissão no início; `guardAct` usa módulo fixo por ação (`ACT_MOD`) e barra ação de gravação em tela sem módulo.
- Login grava só a última entrada (`loginMark`, coleção `usuarios_login/`), não o cadastro inteiro.
- E-mail inválido (ex.: `__proto__`) não entra pelo `onSnapshot` nem pelo `localStorage`.
