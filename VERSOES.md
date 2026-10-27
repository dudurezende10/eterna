# Versões do Eterna

Cada versão é um commit em `main`. Para abrir uma versão: `git checkout <commit>`.

| Versão | Commit | O que entrou |
| --- | --- | --- |
| v13 | `7023356` | Eterna: protótipo funcional, versão 13 (ingestão automática sem foto preta, bandeiras) |
| – | `89d1ba0` | README |
| – | `beb38b1` | Fluxo do sistema, validação por IA, maquininha/TEF, pós-visita web+RD, domínio eterna.photo |
| – | `8666b42` | Checkout em uma tela, lista de vendas com CSV, quiosque com facial automático |
| – | `a557511` | Carimbo de versão no menu |
| – | `84a8db9` | Agente do ponto: leitor automático de cartão + integração na Ingestão |
| – | `58beae9` | Treino da IA: rotular 189 fotos reais (pode / não pode / dúvida), com motivos e exportação |
| v18 | `e2c2c09` | Cara de app: entrada por perfil (admin, foto, venda, valida, cliente, quiosque), navegação por perfil, sem textos explicativos nem comparativos |
| – | `2a11a58` | docs: documentação técnica v1 (arquitetura, stack, dados, fluxos, design system) |
| v19 | `268951d` | app: login por e-mail e código, permissões CRUD por módulo, tela Usuários |
| – | `7735cfb` | docs: acesso por e-mail e código, permissões CRUD por módulo (v1.1) |
| v20 | `8af95cb` | app: perfil do fotógrafo enxuto, telas Ajustes e Diário do set, fotógrafo vinculado ao usuário |
| v21 | `09c9e27` | app: câmera sempre ligada no checkout e quiosque (acha o rosto sozinha), editor manual de ajustes |
| v22 | `6d88367` | agente: receptor FTP embutido para o Canon CTP (usuário por fotógrafo); app mostra o FTP na Ingestão |
| v23 | `c5489e7` | app: identidade por venue (cores, logo, nomes), temas Maracanã e Lollapalooza, tela Identidade |
| v24 | `da684f6` | app: white label, marca do Maracanã em todas as telas, Eterna só como powered by |
| v25 | `19c35b1` | app: identidade Viva Maracanã do manual de marca (logo, cores, Big Shoulders, grafismo) |
| v26 | `c06366d` | app: CRUD de bandeiras (cadastrar, editar, excluir, foto, unidades) com permissão por módulo |
| – | `a8e84e0` | agente: serve o app em http://127.0.0.1:8765 (mesma origem, sem bloqueio de rede local do Chrome); aviso na Ingestão |
| – | `1bd119a` | agente: reapresenta as fotos de hoje da inbox ao reiniciar |
| v27 | `3e30f06` | app: Ingestão vira Upload, filtro de datas (de/até) nos relatórios, nomes de pessoas padronizados |
| – | `7507235` | ci: espelho automático para MaracaTour/eterna |
| v28 | – | login: código enviado por e-mail de verdade (serviço eterna-email na VM, remetente ti@maracatour.com.br) |
| – | – | login volta ao código na tela; envio da VM desligado (e-mail vai sair de @eterna.photo) |

Regra do projeto: toda alteração pedida vira commit, por padrão.
| v32 | `f457136` | Convidado: fundos de IA na galeria (5 fundos aprovados), lista guardada por 60 dias, paga agora ou depois |
| Lolla V1 | `4072e7f` (branch `lolla-v1`) | Conceito Lollapalooza Brasil, sistema separado, fora do main |
| v33 | `9a19e7a` | Convidado: selfie liga a câmera frontal do celular ou a webcam do computador; sem câmera, escolhe foto do aparelho |
| v34 | `baa9202` | Fotógrafo de campo ou volante (acompanha o grupo, chute a gol, livre com lugar), troca no set e na Escala, sessões separadas do campo |
| v35 | `f53c2ac` | Chroma cortado; os mesmos 5 fundos de IA passam a ser aplicados nas fotos do campo (e do volante); histórico do Chroma mantido nos totais |
| v36 | `54503c6` | Roteiro do set ganha o quadro obrigatório para fundo de IA (campo e volante acompanhando grupo) |
| v37 | `7447079` | Escolha automática da foto para fundo de IA (5 critérios com peso, nota mínima 70, corpo inteiro e borda obrigatórios); taxa de foto apta por fotógrafo |
| v38 | `6459808` | Escolha da foto para fundo de IA por fundo: corpo inteiro, meio corpo ou fechada, cada fundo aceita os seus enquadramentos; critérios: lateral, rostos, foco, recorte |
| v39 | `c0da032` | Recorte real do grupo e montagem automática nos 5 fundos (checkout, fila, galeria); aguarda os fundos limpos img/plate-<id>.jpg |
| v40 | `63f3e81` | 10 fundos limpos; casamento por ângulo e luz entre foto e fundo; montagem com ajuste de cor, luz lateral, sombra e P&B/sépia |
| v41 | `a32fbaa` | Reconhecimento facial de verdade (face-api, MIT, no navegador): selfie do convidado e câmera do checkout/quiosque acham a sessão pelo rosto; pergunta "é uma destas?" na dúvida; medição de acerto em Treino da IA (94,1% nas fotos de exemplo) |
| v42 | – | Reconhecimento facial instantâneo: rostos das fotos de exemplo já vêm lidos (vendor/faceapi/indice-exemplos.json); busca não espera a leitura das fotos novas |
| v43 | – | Câmera do quiosque e checkout: avisos em faixa grande (vermelha quando não acha, verde quando acha), 6 segundos na tela |
| v44 | – | Reconhecimento no servidor do ponto: agente lê os rostos na chegada (YuNet + SFace, OpenCV, MIT/Apache), índice por dia, busca em < 1 s; app usa o agente quando ligado e o navegador nas fotos de exemplo; medição no servidor |
| v45 | – | Câmera do quiosque e checkout dispara ao ver um rosto (sem precisar se mexer); quiosque abre sessões fechadas; validação real de olhos fechados no lugar da sorteada |
