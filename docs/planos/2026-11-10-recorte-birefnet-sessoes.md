# Plano v97: recorte BiRefNet com a regra do Eduardo + levas e visitas

Base: main publicada v96 `0596b50`. Worktree: `/home/claude/eterna-birefnet`, branch `feat/recorte-birefnet`
(o caminho `/home/claude/eterna-recorte` já existia com a `wip/recorte-v88`; não foi tocado).
Protótipo validado: `scratchpad/recorte/recorte2.py` (5 fotos, saídas em `scratchpad/recorte/resultado/`).

## Objetivo
1. Os fundos de IA passam a usar um recorte só: BiRefNet-general + a regra do Eduardo (fica o que é da pessoa e encosta nela; sai o que está solto). Sem ISNet/u2net como recorte e sem Photoroom na escolha.
2. Leva (o que um fotógrafo/câmera clicou até a pausa, como a sessão de hoje) e Visita (as levas da mesma família, ligadas por rosto em corrente, em até 50 min). O Checkout abre a visita inteira, o Posto junta e separa; e o Checkout nunca fica sem montagem quando existe base com recorte.

## Escopo desta entrega
- Agente: pipeline novo de recorte num processo separado, instalador com os modelos novos, Photoroom travado em "local", visitas (ligação por rosto entre levas, Juntar/Separar, feed `/visitas`), medição de tempo e memória.
- App: selfie e código abrem a visita inteira no Checkout; Posto com Juntar e Separar; some a escolha Local/Photoroom e o painel do Photoroom; painel Recorte local mostra modelo, GPU/CPU e tempo; 503 do recorte não tira a foto da venda; fallback das bases barradas; jeito antigo sem a nota simulada para foto real.
- Docs: regra 16 em `docs/fundos-ia-regras.md` (substitui 12 e 13), DOCUMENTACAO-TECNICA, CONTEXTO, CHECKLIST-SERVIDOR, VERSOES.

## Fora do escopo
- Apagar o código do Photoroom (rotas `/photoroom/*`, `pr_*`, `composePR`, `compHiPR`, `prPanel`): fica para depois do merge da `idiomas-base` do Ronaldo, que reescreve essas rotas (matriz de permissões). Agora só fica inalcançável.
- Cartão numerado como reforço da visita (Eduardo, 10/11: fica para depois; só registrado).
- Galeria por QR com a visita: só a proposta (seção "Galeria por QR"); implementar depois da v96.1.
- Visita no Upload e na Fila do fotógrafo (continuam por leva).
- Montagem no servidor/nuvem; fp16; birefnet-lite.

## Decisões assumidas (padrão seguro; ver lista para o Eduardo no fim)
- A1. Sem BiRefNet instalado: sem fundos de IA (503 `recorte_indisponivel`), sem plano B com ISNet (Eduardo: "esquece as outras").
- A2. u2net_human_seg, isnet-general-use e MoveNet são auxiliares internos da regra, nunca opção de recorte.
- A3. Recorte roda num processo filho (medido: BiRefNet sozinho em CPU passa de 4,7 GB e foi morto pelo sistema nesta máquina de 8 GB; dentro do agente, o OOM derrubaria FTP, vendas e Checkout).
- A4. Criança separada do grupo continua (garantia da v88): componente separado fica se tem uma pessoa do MoveNet com largura de ombros >= 0,5 da maior da foto.
- A5. Pessoa não vista pelo u2net (máscara de pessoa vazia): fica o maior componente do BiRefNet ("melhor levar a foto do que tirá-la da venda", v88).
- A6. Leva = a sessão de hoje sem mudança: por fotógrafo (ou câmera, sem fotógrafo identificado), pausa de 60 s pela hora do clique corrigida, rostos novos separam. Código LP continua sendo da leva (recibo, Fila, autoria).
- A7. Visita (decidido pelo Eduardo, 10/11): levas ligadas quando um rosto de qualidade de uma bate com um rosto de qualidade de outra, em corrente (união), com o primeiro e o último clique da visita a até 50 min. Rosto de qualidade = principal (largura >= 0,5 do maior da foto), >= 60 px na foto de 1600, frontal e score >= 0,80 (os critérios `_sess_qualidade` da v91). Limiar rígido `VIS_LIM = 0,50` (o "é a pessoa" do Eterna é 0,45).
- A7b. Teto da visita: 12 levas ou 15 rostos diferentes. Acima disso a ligação automática para (excursão ou escola encadearia todo mundo) e o Posto vê "visita grande: confira". Grupo de escola (`galeria tipo evento`) e sessão de menor nunca ligam sozinhos.
- A7c. Separar vence a ligação por rosto (vira "não ligar" entre a leva e o resto da visita); Juntar liga mesmo sem rosto. Os dois com auditoria no agente e no app.
- A8. Photoroom: nada é apagado automaticamente; `~/Eterna/photoroom.json` fica no disco sem uso até o Eduardo decidir.
- A9. Base barrada só pela validação (olhos fechados etc.) vira a última alternativa: só entra se a base boa, a outra base e o jeito antigo não derem nenhuma montagem.

## Etapas (agente primeiro; cada etapa com teste e commit)

### E1. Recorte BiRefNet (agente)
Arquivo novo `agente/eterna-recorte.py` (processo filho; só numpy, Pillow, opencv-python-headless, onnxruntime, rembg; nada importado do agente):
- `carregar(provedor)`: `new_session` de `birefnet-general`, `u2net_human_seg`, `isnet-general-use` com `SessionOptions` do protótipo (`enable_cpu_mem_arena=False`, `enable_mem_pattern=False`, `ORT_ENABLE_BASIC`, `intra_op_num_threads = cpu-1`) e `providers` = `["CUDAExecutionProvider","CPUExecutionProvider"]` com `ETERNA_RECORTE_GPU=auto` (padrão) ou só CPU com `cpu`. Provedor real lido de `sess.inner_session.get_providers()[0]` (ORT cai em CPU sem avisar).
- `Pose` (MoveNet MultiPose Lightning, `~/Eterna/modelos/movenet_multipose_lightning_1.onnx`, 3 escalas) igual ao protótipo; devolve punhos e, por pessoa, largura dos ombros (pontos 5 e 6).
- `regra(fino, pessoa, isn, punhos, ombros)`: cópia fiel de `recorte2.regra` (mesmas constantes `LIMIAR 128`, `SOBREPOSICAO_MIN .05`, `FAIXA_PESSOA .015`, `RAIO_MAO .04`, `FAIXA_REFINO .02`, `FUNDO_PEQUENO .12`, cortes 0,0005/0,002/0,003, `no_chao`, contato .30/.10), com 3 acréscimos: (a) A4: componente "pequeno e separado" não sai se contém um ponto de quadril/ombro de pessoa com ombros >= 0,5 da maior; (b) A5: sem pixel de pessoa, devolve o maior componente do BiRefNet; (c) teto de custo: no máximo 64 pedaços avaliados no passo "grudados" (o resto fica) e 1,5 s no total.
- `recortar(origem, destino3000, trab=1600)`: MAX_PIXELS conferido antes de decodificar; `exif_transpose`; lado até 3000; máscaras na imagem de 1600; alfa volta ao tamanho final (LANCZOS); RGB zerado onde alfa = 0; PNG 600 por `mkstemp` + `os.replace`. Sem MinFilter e sem `rec_sem_soltos` (o protótipo validado não usa; reabrir só se aparecer halo).
- Laço principal: lê uma linha JSON do stdin, responde uma linha JSON no stdout (contrato abaixo). Erro numa foto não mata o processo.

No `eterna-agente.py`:
- `REC_MODELOS = ("birefnet-general","u2net_human_seg","isnet-general-use")`, `REC_POSE = "movenet_multipose_lightning_1.onnx"` (em `MODELOS`), `REC_VERSAO = "birefnet-1"`, texto `REC_COMO` com os 4 modelos.
- `rec_estado`: acrescenta `cv2` em `falta` (sai `scipy`), confere o arquivo do MoveNet e o tamanho/sha do MoveNet (sha fixo no código).
- `rec_carregar` passa a abrir o filho (`subprocess.Popen([sys.executable, <pasta do agente>/eterna-recorte.py], stdin/stdout PIPE, stderr para o console)`), espera o `{"pronto":true,...}` e guarda provedor e tempo de carga em `rec`. Filho que morreu: `rec["erro"]` com o código de saída ("memória insuficiente" quando -9/137), nova tentativa depois de `REC_ERRO_SEG`.
- `rec_fazer`: o ramo real manda `{"id","origem","destino"}` ao filho e espera até `REC_ESPERA_FILHO` (300 s; CPU lenta); o resto igual (cópia de 2400 sai da de 3000, contadores, `REC_FALSO_SEG` dos testes sem filho).
- `REC_CONC` continua 1 (o `=2` só vale com `provedor == cuda`; em CPU é ignorado com aviso no console).
- Versão do cache: na partida, se `~/Eterna/recortes/.versao` != `REC_VERSAO`, apaga só `*.png` e `*.tmp` da pasta (sem seguir link) e grava a marca. Feito antes do `rec_pre_loop`.
- Sai do código: `rec_limpa_mascara`, `_rec_furo_e_objeto`, `_rec_encostados`, `_rec_ilhas`, `_rec_geo`, `_rec_pontes`, `rec_sem_soltos` e as constantes `REC_SINAL`..`REC_ENC_CORTE`. Os testes dessa regra em `testes/v84_agente.py` (linhas ~110-160) são trocados pelos casos sintéticos da E1 em `testes/recorte_birefnet_agente.py`; o resto do v84_agente (rotas, 503, cache, segurança) fica.
- `rec_status()` ganha os campos do contrato. `rec_pre_escolha`: com provedor CPU, só as bases (sem as 2 normais do plano B), para a fila não crescer sem fim.
- Não mexer no handler HTTP nem em `rota_privada` (a `idiomas-base` reescreve esse trecho).

### E2. Instaladores
`agente/instalar-recorte.command` e `.bat`:
- Pacotes fixos de hoje (`rembg==2.0.86 onnxruntime==1.29.0 opencv-python-headless==4.10.0.84 psutil==7.2.2`).
- Baixa por `rembg.new_session` os 3 modelos (o rembg confere o hash de cada um) e o MoveNet de `https://github.com/Kazuhito00/MoveNet-Python-Example/raw/main/onnx/movenet_multipose_lightning_1.onnx` para `~/Eterna/modelos/`, confere SHA-256 `61c25a6fc887b0e8d14517c3d66fdaf36c0e7a7ec0d50f74ed41a32ca1485184`; diferente: apaga e para com mensagem. Download em arquivo temporário e `rename` no fim.
- `.bat gpu` (servidor do estádio): `pip uninstall -y onnxruntime` e instala `onnxruntime-gpu` (versão fixa a escolher pelo Ronaldo no servidor) com as bibliotecas CUDA/cuDNN por pip; imprime o provedor que abriu.
- Texto: "cerca de 1,3 GB" (era 350 MB), "16 GB de memória; servidor com placa NVIDIA usa a placa".
- `docs/CHECKLIST-SERVIDOR.md`: driver NVIDIA recente (série RTX 50 exige driver e CUDA 12.8 ou mais novos), rodar `instalar-recorte.bat gpu`, conferir `/status.recorte.provedor`.

### E3. Visitas (agente)
- Estado novo sob o `sess_lock` (nunca com o `lock`): `vis_idx` = deque dos rostos de qualidade da janela `(t_clique, card, pid, vetor)` de todas as trilhas, podado a 50 min e a 4.000 vetores; `vis_arestas[dia]` = lista `{a, b, tipo:"rosto"|"juntar"|"separar", sim, pa, pb, por, posto, em}`; `vis_de[card]` = id da visita (recalculado).
- `_vis_ligar(card, pid, t, princ)`: chamada em `_sess_decide` e no ramo `_guardar` de `sess_rostos_lidos` (onde já existem os rostos com score e frontal). Compara os rostos de qualidade da foto com `vis_idx` de OUTRAS levas (numpy quando houver, senão `_dot`); `sim >= VIS_LIM` cria aresta `rosto` (uma por par de levas, guarda a maior sim e os 2 pids). Depois põe os vetores no `vis_idx`.
- `_vis_recalc(dia)`: componentes conexos (união-busca) só com arestas permitidas: `rosto` e `juntar`, menos qualquer aresta `rosto` entre leva com `separar` e a visita de onde foi separada; aresta que deixaria a visita com mais de 50 min entre o 1º e o último clique, mais de 12 levas ou mais de 15 rostos não entra (fica registrada com `barrada`); leva de grupo de escola ou menor só entra por `juntar`. Id da visita `V` + menor `_n` das levas (estável enquanto a leva mais antiga ficar). `rev` da visita sobe a cada mudança.
- Foto sem rosto segue a leva (a visita é de levas; nada a fazer).
- Persistência: `~/Eterna/ponto/visitas/AAAA-MM-DD.json` (arestas, 600, `mkstemp`), gravado junto do `sess_gravar`; no boot, arestas relidas e `_vis_recalc`; `vis_idx` refeito do `rostos.db` das últimas 50 min só com largura e principal (score e frontal não ficam no banco; aceito). 60 dias, como as sessões; LGPD tira os pids das arestas e a leva removida sai da visita.
- `_sess_ia_fecha` (depende de D4): na opção recomendada, se a visita da leva já tem outra leva fechada com `ia`, esta leva fecha com `ia=[]` e `ia_regra.motivo="visita_ja_tem"`. Leva fechada não muda depois (venda e Checkout seguem o contrato da v93).
- Rotas (entram também na matriz de permissões da `idiomas-base`, com o Ronaldo): `GET /visitas?desde=<rev>` (posto + origem local, `no-store`): `{rev, visitas:[{id, levas:[card], rev, inicio, fim, grande:bool, separadas:[card]}]}` só de hoje (e ontem com `?ontem=1`), sem vetor e sem pid de aresta. `POST /visitas/juntar {a, b}` e `POST /visitas/separar {card}` (posto + origem + `X-Eterna: 1` + `limite_ok` 30/min + cards de hoje que existem + quem do corpo validado como no `/ponto/eventos`); resposta com a visita nova; log `~/Eterna/ponto/visitas-log.jsonl` (quem, posto, em, de, para; sem rosto).
- `/status.sessoes` ganha `visitas:{n, ligacoes_rosto, barradas, ms_ultimo}`.

### E4. Photoroom fora da escolha (agente + app)
- Agente: `fundos_modo()` devolve sempre `"local"` (o arquivo `fundos-modo.json` é ignorado). Efeito: `rec_ia_loop` nunca para por modo Photoroom, `/photoroom/compose` responde 409 `photoroom_desligado`, `/status.fundos_modo` = `local`. Console de abertura: linha do Photoroom some.
- App: `const fundosModo=()=>'local'`; sai `${fundosModoPanel()}` do Painel de controle e `${prPanel()}` de Fundos de IA (vChroma) e o `prPoll()` do vChroma; `case 'fundos-modo'` e `case 'pr-save'` respondem `toast('O recorte é sempre local')` e param. Textos: vChroma sem "O Photoroom fica como opção"; `MODULE_INFO.configuracao.u` sem "(local ou Photoroom)"; `fiaPanel` diz "BiRefNet neste computador (placa de vídeo | processador) · média X s por foto". `SIM_INTEIRO` mantém `fundosModo` e `fundosModoPor` (janela antiga continua lendo).

### E5a. Checkout abre a visita (app)
- `SRV.vis` (de `GET /visitas`, puxado junto do `srvPull`, guardado em `SIM.visitas` como cópia; o servidor é o dono). `visitaDe(card)` devolve as levas da visita que já estão no SIM, ou `[card]`.
- `lojaJuntar`: para cada sessão com foto clara, entra a visita inteira: `minhas[c] =` todas as fotos de `c` para cada `c` em `visitaDe(card)` (some a regra da v95 no Checkout, decisão do Eduardo). Âncora como hoje (mais fotos claras, não paga). O "talvez" continua só para levas fora das visitas achadas.
- `lojaCodigo` (LP ou galeria): abre `visitaDe(card)` inteira (`so={card, cards, ids: todas}`); `lojaDele` passa porque `ids` tem tudo.
- `lojaSesProtegida`: leva de menor ou escola continua nas regras da v77 (a selfie dela não abre a visita; só o que a v77 permite).
- Mudou a visita com o cliente na tela (Juntar ou Separar no Posto): o Checkout refaz `so` no próximo `lojaPendCheck` e mantém só as marcas de fotos que continuam; nunca troca de cliente.
- Venda: igual à v91 B (âncora, `selected` da venda, `vendidasTodas`).

### E5b. Bases de IA no Checkout (app)
- `compHydrate`: `r.pending==='recorte'` (503) deixa de chamar `fiaFalhou`; mostra "Recorte local indisponível" e tenta de novo em 30 s, como o `pending:'fila'`. `fiaFalhou` só para `sem_pessoa`, 404 e 500.
- `lojaAIAntigo`: para foto `ag_`, a escolha das 2 não passa pelo `aiOk` (nota simulada por hash, que barra ~25% das fotos ao acaso); continua passando por `FIA_RUIM`, `fit` do fundo e recorte.
- `lojaAI`: depois de `lojaAIAntigo(card)` vazio, terceira tentativa com as bases que só estão em `SIM.invalid` (com imagem, não descartadas, fora do `FIA_RUIM`, mesma `FIA_BASE`). Sem base nem foto: lista vazia como hoje.
- Sem texto novo de cliente (o "Preparando sua foto especial" `aiMaking` já existe nas 5 línguas). Carimbo v97.

### E6. Posto: Juntar e Separar (app)
- No Posto (`vPosto`, item do pedido `pendEscolhaItem`), por pedido aberto: blocos por leva (ponto · hora · fotógrafo · nº de fotos) com "Separar" em cada leva que não é a âncora, e "Juntar outra leva" que lista as levas de hoje dos últimos 50 min fora da visita (miniatura pequena, ponto, hora, fotógrafo; até 12) e aceita o código LP.
- `visita-juntar` e `visita-separar` no `WRITE_OPS` com `venda` u (`ACT_MOD`); confirmação curta ("Esta leva é desta família?" / "Esta leva não é deles?"); `auditLog('visita_juntar'|'visita_separar', card, {visita, posto})`; POST ao agente; sem agente, botão inativo com "Servidor do ponto fora".
- Separar leva que já tem foto marcada pelo cliente: as marcas dela saem do pedido (`lojaSync`) e o Posto avisa.
- Visita `grande`: selo "Visita grande: confira" no pedido.

### E7. Medição (antes do merge, Mac e servidor)
Script `agente/medir-recorte.py <pasta>` (usa o `eterna-recorte.py`): por foto, ms de cada etapa (birefnet, pessoas, isnet, pose, regra, gravar) e pico de memória do filho (psutil, amostra de 50 ms); no fim, mediana e p90. Resultado colado na DOCUMENTACAO-TECNICA. Números de hoje (máquina de teste, 2 vCPU, 8 GB, CPU): carga 5 a 15 s e 2,1 GB só do BiRefNet carregado; BiRefNet 45 a 74 s por foto, total 61 a 82 s (tempos.json do protótipo); com 4,7 GB livres o processo do BiRefNet foi morto por falta de memória nas duas tentativas de medir o pico.

## Contratos
Filho do recorte (stdin/stdout, uma linha JSON por mensagem):
```
-> {"pronto":true,"provedor":"cuda|cpu","modelos":[...],"carga_ms":N}            (uma vez, ao abrir)
<- {"id":"<pid>","origem":"<caminho>","destino":"<caminho 3000>","trab":1600}
-> {"id":"<pid>","ok":true,"ms":{"birefnet":N,"pessoas":N,"isnet":N,"pose":N,"regra":N,"total":N},"pico_mb":N,"pessoas":K}
-> {"id":"<pid>","ok":false,"erro":"sem_pessoa|imagem_grande|..."}
```
Caminhos só dentro de `INBOX` (origem) e `RECORTES` (destino): o filho confere com `realpath` e recusa o resto.

`/status.recorte` (acrescenta; nada sai): `modelo:"birefnet-general"`, `auxiliares:["u2net_human_seg","isnet-general-use","movenet_multipose_lightning_1"]`, `provedor:"cuda"|"cpu"|null`, `versao:"birefnet-1"`, `etapas_ms:{...}` (da última foto), `pico_mb` (do filho), `filho:{vivo:bool,reinicios:N}`. `fundos_modo` sempre `"local"`.

`POST /recorte`, `GET /recorte/<pid>.png`: sem mudança (PNG RGBA, RGB zerado fora, 3000 e 2400).

Variáveis: `ETERNA_RECORTE_GPU` (`auto` padrão, `cpu`). `ETERNA_RECORTE_CONC=2` só vale com CUDA.

Sessões (levas): sem mudança no `/sessoes`. Leva fechada com `ia_regra.motivo` novo possível `"visita_ja_tem"` (só se D4 = por visita).

Visitas:
```
GET /visitas?desde=<rev>[&ontem=1]
{"rev":N,"visitas":[{"id":"V<n>","levas":["LPXXXX",...],"rev":N,"inicio":<epoch>,"fim":<epoch>,"grande":false,"separadas":["LP..."]}]}
POST /visitas/juntar   {"a":"LP..","b":"LP..","por":"<nome>","posto":"<posto>"}  -> {"ok":true,"visita":{...}}
POST /visitas/separar  {"card":"LP..","por":"<nome>","posto":"<posto>"}          -> {"ok":true,"visita":{...},"nova":{...}}
```
Constantes: `VIS_LIM=0.50`, `VIS_JANELA=3000` s, `VIS_LEVAS_MAX=12`, `VIS_ROSTOS_MAX=15`, `VIS_IDX_MAX=4000`. `ETERNA_VIS_LIM` só nos testes.

I18N: nenhuma chave nova.

## Critérios de aceite
Recorte
1. Sem `birefnet-general` baixado: `/status.recorte.ok=false`, motivo cita o modelo; `POST /recorte` 503 `recorte_indisponivel`; nenhum caminho recorta só com ISNet ou u2net.
2. Sem o MoveNet ou com SHA diferente: o mesmo 503, motivo "modelo de pose".
3. Com os modelos: `/status.recorte.modelo == "birefnet-general"` e `provedor` preenchido depois da primeira foto.
4. 5 fotos de referência (só se o Testador tiver a pasta; `ETERNA_RECORTE_FOTOS=<pasta>`, fotos nunca no repositório): alfa >= 128 com IoU >= 0,98 contra `scratchpad/recorte/resultado/<nome>.png` em cada foto (o recorte do agente trabalha em 1600; se a IoU ficar abaixo, subir `trab` para 2400 e medir de novo). Conferência visual nos zooms do `zooms.json`: taça no pedestal fora (03694fcb), bandeira aberta inteira dos dois lados (219d1b26), relógio na mão (5240edb6), taça na mão da criança, óculos e bandeiras (839cb148), óculos inteiros, cotovelo sem fundo e vão do casal aberto (d1c42406).
5. Sintéticos (`testes/recorte_birefnet_agente.py`, máscaras em numpy, sem modelo): a) objeto encostado no punho fica; b) pedestal alto que desce ao chão com contato < 30% sai; c) pessoa pequena separada (< 12% do maior) sai; d) criança separada com ombros >= 0,5 do adulto fica (A4); e) placa sem sobreposição com gente sai; f) bandeira enrolada até o chão com contato >= 30% fica; g) óculos fora do BiRefNet mas no acordo ISNet+u2net dentro da faixa de 2% voltam; h) máscara de pessoa vazia devolve o maior componente (A5); i) 200 pedaços grudados terminam em menos de 2 s.
6. PNG: RGB = 0 onde alfa = 0; lados 3000 e 2400; permissão 600; nenhum `.tmp` sobra.
7. Cache: com `.versao` antigo ou ausente, a primeira partida apaga os PNG de `~/Eterna/recortes/` e grava `birefnet-1`; a segunda partida não apaga nada; link simbólico dentro da pasta não é seguido.
8. Filho morto (kill -9 no meio de uma foto): o agente segue respondendo `/status`, FTP e `/ponto/eventos`; `rec.erro` mostra o motivo; depois de 60 s a próxima foto reabre o filho e recorta.
9. Fila e prioridades: `cliques_ia_agente.py`, `cliques_ia_e2e_agente.py`, `cliques_ia_fila_limpeza_agente.py` passam sem mudança (recorte falso). Com provedor CPU, `rec_pre_escolha` devolve só as bases.
10. Medição feita e registrada (E6) no Mac do Eduardo (CPU) e no servidor do estádio (GPU e CPU). Portão de produção no estádio (não do merge): BiRefNet <= 3 s por foto e total <= 6 s com a GPU; pico do filho <= 6 GB.
11. Instalador: venv novo baixa os 4 modelos; rodar de novo não baixa nada; MoveNet com SHA errado (simular trocando o arquivo) para com mensagem e apaga o arquivo; `.bat gpu` termina mostrando o provedor.

Photoroom
12. Painel de controle sem "Montagem dos fundos"; Fundos de IA sem o quadro Photoroom; nenhum `fetch` para `/photoroom/*` ao abrir telas, Checkout ou impressão (conferir no Playwright).
13. `SIM.fundosModo='photoroom'` salvo num navegador: a prévia, o Checkout e a impressão montam pelo recorte local.
14. Agente com `fundos-modo.json` = photoroom: `/status.fundos_modo == "local"`, bases de IA recortadas, `/photoroom/compose` 409.

Checkout
15. `/recorte` respondendo 503 e depois 200: a foto não entra em `FIA_RUIM` e a montagem aparece sem recarregar.
16. Sessão `ag_` de 1 foto (ia vazia, `poucas_fotos`) com recorte pronto: o Checkout mostra montagens nos fundos em que o enquadramento cabe, em 10 de 10 ids diferentes (sem a nota simulada).
17. Sessão com as 2 bases em `SIM.invalid`, jeito antigo vazio: montagens com a base barrada; com uma base boa, ela continua na frente.

Visitas (rostos sintéticos como no `testes/sessoes_agente.py`; novo `testes/visitas_agente.py` e `testes/visitas-checkout.js`)
18. Família de 4 em 3 fotógrafos (levas em 3 trilhas, 25 min entre a 1ª e a última): 1 visita com as 3 levas; selfie de qualquer um dos 4 abre as 3 levas inteiras no Checkout.
19. Filho sozinho na leva do 3º fotógrafo, com o rosto dele de qualidade na leva da família: entra na visita pela corrente; a selfie da mãe mostra as fotos só do filho.
20. Família B pequena ao fundo (rosto < 0,5 do maior ou < 60 px) nas fotos da família A: a leva de B não entra na visita de A.
21. Foto sem rosto (de costas) numa leva: fica na leva e aparece no Checkout com a visita.
22. Duas famílias clicadas no mesmo minuto em cenários vizinhos, rostos diferentes (sim < 0,50 entre elas): 2 visitas; a selfie de uma não mostra foto da outra.
23. Corrente fora da janela: leva com rosto em comum 51 min depois do 1º clique da visita não entra (aresta `barrada`).
24. Limiar: par com sim 0,49 não liga; 0,50 liga.
25. Teto: 13ª leva ou 16º rosto não liga sozinho; visita marcada `grande`.
26. Escola e menor: leva de grupo de escola não liga por rosto; liga só por Juntar.
27. Juntar no Posto: duas levas sem rosto em comum viram 1 visita; o Checkout aberto mostra as fotos novas sem perder marcas; linha no `visitas-log.jsonl` e `auditLog`.
28. Separar no Posto: a leva sai da visita, as marcas dela saem do pedido, e uma nova foto com o mesmo rosto não a religa; Juntar de novo desfaz.
29. Juntar/Separar sem `venda` u: botão some e POST recusado; origem de fora ou sem `X-Eterna`: 403; 31º pedido no minuto: 429.
30. Código LP de qualquer leva abre a visita inteira.
31. Reinício do agente: visitas iguais depois do boot (arestas relidas).
32. LGPD de uma foto: some das arestas; leva removida sai da visita.
33. Desempenho: 3.000 fotos sintéticas num dia com 6 trilhas simultâneas, ligação por foto <= 50 ms (p90) e `_vis_recalc` <= 20 ms.
34. `testes/sessoes_agente.py`, `fila_fotografo_agente.py`, `sessoes-upload.js`, `checkout-varias-sessoes.js` passam (os que conferem a regra da v95 no Checkout mudam para a visita, com nota no commit).

Geral
35. `bash testes/rodar.sh` termina igual ao main v96: só as 3 falhas já conhecidas (`galeria-agente` 19b, `galeria-qr` 6 e 13, `v77-regressao` B). `todas-as-telas.js` sem erro.
36. Carimbo v97 nas duas ocorrências; linha em VERSOES.md.

## Investigação do teste de hoje (dados no Mac do Eduardo)
Pedir ao Eduardo (ou rodar com ele) e anotar no plano:
- Sessões divididas: em `~/Eterna/meta.json`, para os 5 pids: `o`, `s`, `serie`, `autor`, `dono`, `cap`, `mt`, `u`. Em `~/Eterna/ponto/sessoes/2026-11-10.json`: `k` (esperado `...|cam:<série>` diferente nas duas), `motivo`, `fonte_t`, `ia_regra`. Confirma que foram 2 levas por câmera (A6); com a E3 elas viram uma visita se o rosto bater.
- Grupo de 7 sem montagens: no console do Checkout depois da selfie: `ETERNA.state.kiosk.so` (as bases estão em `ids`?), `ETERNA.SIM.sessions[card].ia`, `ETERNA.lojaAIBase(card)`, `ETERNA.lojaAI(card)`, `ETERNA.FIA_RUIM`, `ETERNA.SIM.invalid[<base>]`; no agente `/status` → `recorte.ok`, `recorte.ia.erros`, `recorte.ia.pausa_disco`; `ls ~/Eterna/recortes/<pid>*` das bases; console do agente com "recorte das bases de IA". Hipóteses em ordem: (1) bases barradas pela validação (olhos fechados num grupo de 7) e jeito antigo vazio pela nota simulada; (2) base fora de `so.ids` (rosto pequeno no corpo inteiro ou não principal, B5); (3) 503 durante a carga dos modelos marcou a foto em `FIA_RUIM` até recarregar; (4) `ia_regra.motivo = sem_funcao` (sem função do dia no Mac), e aí cai no jeito antigo. A E5b cobre 1, 3 e 4; a 2 some com a E5a (a visita inteira entra, base incluída).
- Sessão de 1 foto pela selfie sem montagens: `ia_regra.motivo` deve ser `poucas_fotos`; o jeito antigo dependia da nota simulada (`aiOk`). A E5b cobre; com a E3 a leva de 1 foto entra na visita da família e usa as bases dela.
- Foto P&B fora da selfie: `sqlite3 ~/Eterna/rostos.db "select * from foto where pid='<pid>'"` (n = 0 é "sem rosto lido"; n > 0 é semelhança baixa da P&B contra a selfie colorida). Com a E5a ela aparece com a visita no Checkout. Se n = 0 com rosto visível, abrir bug de leitura (`IMREAD_REDUCED_COLOR_2` + YuNet 0,7) à parte.

## Riscos para o revisor de segurança e de escala
- Memória: BiRefNet em CPU passa de 4,7 GB (medido, morto pelo sistema). Mac de 8 GB não roda com o Chrome aberto; 16 GB é o mínimo. Por isso o processo filho: OOM mata só o recorte. `REC_CONC=2` em CPU dobraria o pico (bloqueado).
- Tempo: em CPU, 45 a 75 s por foto na máquina de teste. Conta do estádio: ~3.000 fotos e ~375 sessões por dia dão ~750 bases; no pico (~15% do dia numa hora) ~110 bases por hora. Em CPU lenta a fila de IA não acompanha; produção depende da GPU (critério 10). Checkout espera até 180 s por recorte ao vivo.
- GPU série RTX 50: `onnxruntime-gpu` precisa de build com suporte à arquitetura e de CUDA 12.8 ou mais novo; se a CUDA não abrir, o ORT cai em CPU sem erro (por isso `provedor` no `/status`). Alternativa a medir pelo Ronaldo: DirectML.
- Cadeia de suprimentos: modelos baixados da internet (rembg com hash do próprio rembg; MoveNet de um repositório pessoal no GitHub, com SHA-256 fixo). ONNX é dado, mas o parser do ORT lê arquivo externo: só arquivo com hash conferido.
- Servidor do estádio roda como SYSTEM usando a venv do usuário (`instalar-servidor.ps1`): bibliotecas CUDA por pip na venv gravável pelo usuário aumentam a superfície de troca de DLL. Revisar permissões da venv.
- Processo filho: caminhos recebidos só dentro de `INBOX`/`RECORTES` (`realpath`); stdout do filho só JSON (print de biblioteca vai para stderr); filho nunca abre porta.
- Fotos de clientes do protótipo: nunca no git, nem como fixture; teste lê por variável de ambiente.
- Photoroom: chave continua em `~/Eterna/photoroom.json` (600) sem uso; revogar no painel do Photoroom.
- Visita, falso positivo: dois estranhos parecidos ligam duas famílias e cada uma vê TODAS as fotos da outra no Checkout (muda a proteção da v95 por decisão do Eduardo). Mitigações: limiar 0,50 só entre rostos de qualidade, janela de 50 min, teto de levas e rostos, Separar no Posto, log de cada ligação com a sim. Calibrar o `VIS_LIM` com fotos reais do Tour antes de ligar no estádio (pares da mesma família e de estranhos do mesmo dia).
- Corrente: um falso positivo junta visitas inteiras (o erro se propaga). Por isso o teto e o selo "visita grande".
- Crianças pequenas e óculos escuros: SFace mais fraco, rostos menores; vão ficar fora da visita mais vezes (falso negativo). Saída: Juntar no Posto ou o código LP da leva.
- Fundo: gente atrás (outra família na fila do cenário) não liga porque não é rosto principal; família que posa junta com outra (foto de "amigos de excursão") liga as duas, como deve.
- Desempenho: comparação por foto com até 4.000 vetores (128 floats); em Python puro ~100 ms por foto, com numpy < 5 ms. Tudo sob o `sess_lock`: medir (critério 33) para não atrasar o FTP.
- Galeria por QR e nuvem ainda seguem a v95 até a proposta abaixo ser aprovada: o mesmo cliente vê mais no Checkout que no celular.
- Rotas novas `/visitas/*` no handler: conflito certo com a `idiomas-base` (matriz de permissões). Combinar com o Ronaldo quem entra primeiro.
- Ordem de deploy: 1) `instalar-recorte` (Mac e servidor) com os modelos novos; 2) agente (`eterna-agente.py` e `eterna-recorte.py`, os dois no deploy do Mac: `~/Documents/ETERNA/eterna/` e `~/Downloads/Eterna/`); 3) app; 4) recarregar Checkout, Posto e Upload. Agente novo sem o instalador = sem fundos de IA (A1).
- Servidor do estádio na `idiomas-base` (68 commits à frente do main, reescreve handler, rotas e `instalar-servidor.ps1`): não publicar o agente do main no servidor; o Ronaldo traz o main para a `idiomas-base`. Esta entrega não mexe no handler nem em `rota_privada` para reduzir conflito; `testes/v84_agente.py` muda nos dois lados (conflito pequeno). `eterna-recorte.py` precisa entrar no `instalar-servidor.ps1` dele.

## Galeria por QR (proposta, não implementar agora)
Coerente com a v96.1: compradas e cortesias sempre aparecem, sem selfie. O que não foi comprado da visita aparece depois da selfie, quando a selfie bate com qualquer pessoa da visita (mesma regra do Checkout); no celular a selfie continua por câmera ao vivo (v94) e com o limite de tentativas. Escola e menor seguem a v77 (só as fotos em que o rosto da criança bate). Precisa da visita gravada no manifesto (`m.visita`, levas) e da nuvem com o mesmo dado; plano à parte.

## Decisões para o Eduardo
- D1. Leva: pausa continua 60 s (a leva é a sessão de hoje). 30 s só se ele pedir de novo.
- D2. Limiar da visita 0,50 e tetos de 12 levas e 15 rostos: aprovar e calibrar com fotos reais.
- D3. Galeria por QR: aprovar a proposta acima (compradas e cortesias sempre; o resto da visita depois da selfie).
- D4. Bases de IA: por leva (hoje: cada fotógrafo começa com 2 cliques de IA; numa visita de 6 fotógrafos saem até 12 fotos da venda para um só conjunto de 5 montagens) ou por visita (recomendado: só a primeira leva da visita nos pontos de IA guarda as bases; as levas seguintes, já ligadas por rosto no fechamento, vendem todas as fotos; o fotógrafo continua fazendo os 2 cliques, que voltam à venda quando a família já tem bases). Sem código: deixar só um cenário na lista de pontos de IA no Painel de controle. Padrão até responder: por leva (como hoje).
- D4b. Bases com olhos fechados: usar como última alternativa para nunca ficar sem montagem? Padrão: sim.
- D5. Resolvida pela visita no Checkout: a foto sem rosto (P&B, de costas) aparece com a visita. Na galeria, depende do D3.
- D6. Photoroom: revogar a chave no painel do Photoroom e apagar `~/Eterna/photoroom.json`; o código sai depois do merge do Ronaldo. Padrão: nada apagado automaticamente.
- D7. Sem BiRefNet instalado o ponto fica sem fundos de IA (sem recorte antigo de reserva). Confirmar.
- D8 (Ronaldo). GPU do servidor: CUDA (`onnxruntime-gpu`) ou DirectML, decidido pela medição.

## Decisões do Eduardo (10/11, depois do plano)
- D4: bases de IA por VISITA (as 2 primeiras fotos da família no campo).
- D1: leva fecha com 60 s sem disparo. Uma leva nova criada por falta de disparo não pode separar a família: no Checkout aparecem todas as levas da pessoa ou família (a visita junta).
- D6: Photoroom fica guardado e inativo (chave mantida no servidor, fora das opções). BiRefNet é o padrão.
- D7: todos os recortes são feitos no servidor do ponto (onde o BiRefNet fica instalado). Os outros computadores não recortam.
- Padrões assumidos (sem objeção): D2 limiar 0,50 e tetos 12 levas / 15 rostos, a calibrar com fotos reais antes de ligar no estádio; D3 galeria por QR com compradas e cortesias sempre visíveis e o resto da visita depois da selfie (escola e menor seguem a v77); D4b base com olhos fechados como última alternativa; D8 CUDA ou DirectML decidido pela medição do Ronaldo.

## Execução (Programador, 10/11)
Commits: E1 `628fdb6`, E2 `85fbf4c`, E3 `69329e3`, E4 `1589be1`, E5a/E5b `c2938f6`, E6 `5bc03b3`; docs neste commit. Desvios e escolhas:
- Id da visita = `V` + código da leva mais antiga (estável no reinício; o `_n` das levas muda no boot).
- `GET /visitas?desde=` devolve `igual` com lista vazia quando nada mudou, senão a lista inteira (sem remoções parciais para o app tratar).
- Juntar não passa pelo teto nem pela janela (decisão da equipe); só marca a visita `grande`. Juntar desfaz o Separar entre as duas visitas; Separar desfaz o Juntar entre a leva e o resto.
- Escola e menor no agente vêm das galerias publicadas (`tipo evento` ou `menor`); o app filtra de novo por `lojaSesProtegida`.
- `REC_CONC=2` com CUDA = um processo de recorte por trabalhador. Recorte falso dos testes por `m.REC_FILHO` (módulo, como o `REC_FALSO_SEG` da v93; sem variável de ambiente no agente).
- `ETERNA.fundosModoTeste` só para os testes antigos que precisavam de fundos de IA sem o agente (não grava nada).
- Criança separada (A4) e o teto de custo não mudaram o resultado nas 5 fotos de referência (regra conferida bit a bit nas máscaras em cache; recorte real com IoU 0,999 em 1600 px, sem precisar subir para 2400).
Conflitos previstos: `pubGaleria` não foi tocada (a galeria por QR segue a v95; a v96.1 em `fix/galeria-testes` muda compradas e cortesias); rotas `/visitas*` entram no handler e no `cors()` ao lado da Fila do fotógrafo e precisam entrar na matriz de permissões da `idiomas-base`; `testes/v84_agente.py` e `testes/v84.js` mudam nos dois lados; `instalar-servidor.ps1` e `eterna-vigia.ps1` (idiomas-base) precisam levar o `eterna-recorte.py`.
