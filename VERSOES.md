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
| v46 | – | Fotos enviadas pelo navegador ficam guardadas no aparelho (voltam depois de recarregar e entram no reconhecimento); aviso da câmera abaixo do quadro; quiosque cabe na tela sem rolagem |
| v47 | – | Sessões cujas fotos não estão mais no aparelho somem das listas, do quiosque e do reconhecimento (sem quadros vazios) |
| v48 | – | SFace + YuNet também no navegador (ONNX Runtime Web, MIT): mesma régua do servidor (semelhança 0,45; 0,38 a 0,45 pergunta); fila única de inferência; selfie sem rolagem; índice pronto refeito (93,5% nas miniaturas, 9/9 com fotos reais) |
| v49 | – | Câmera do checkout procura em toda sessão ainda não paga (antes pulava as que já estavam "no checkout"); quiosque procura em todas |
| v50 | `0536e38` | Photoroom ligado ao Eterna pelo agente: recorte, luz e sombra nos 10 fundos; chave em Fundos de IA; sem recorte no navegador (recorte do v39 e v40 removido) |
| v51 | `e8d1a11` | Correção: a chave colada em Fundos de IA (Photoroom) e em Repositório (Roverpix) não some mais com as atualizações automáticas da tela |
| v52 | `5d06aca` | Correção do erro 400 do Photoroom: sem forçar JPEG; aceita PNG transparente e o app monta o fundo por baixo |
| v53 | `580a0f6` | Biblioteca no Upload (tudo o que já está no computador, por dia); reabrir o Eterna ou religar o cartão não baixa de novo; Photoroom com saída PNG |
| v54 | `038adef` | Montagens dos fundos de IA abrem em tamanho grande pela lupa, com setas para passar entre os fundos |
| v55 | `93dd973` | Biblioteca do Upload: hoje e ontem, filtros por hora, últimas 1 e 2 horas, fotógrafo e vendidas/não vendidas |
| v56 | `2f1d11c` | Fotógrafos Klássius e Andressa (telas, login e FTP); Biblioteca mostra a equipe toda no filtro |
| v57 | `b191b7c` | Correção do nome: Sandessa (telas, login e FTP) |
| v58 | `f193805` | Removidos das listas: Igor, Durval, Fictix, Andressa e Enzo (histórico mantido nos totais) |
| v59 | `959866e` | Check-in da câmera no Set (número de série no EXIF); nome do autor gravado na câmera reconhecido sozinho; Biblioteca atribui o fotógrafo pela câmera |
| – | `8d74cf6` | Teste de carga da operação (agente/teste-carga.py: enviar, selfies, monitorar, relatorio); agente com leitores em paralelo, /metricas, vigia de pasta FTP (ETERNA_PASTA); agente/iniciar-eterna.bat |
| v60 | `5542a33` | Fotos em tempo real por um servidor FTP da rede: o agente busca as novas, pasta por fotógrafo; conexão no Upload |
| v61 | `db36f1c` | Anfitrião no set: quem está logado, Trocar fotógrafo e Sair na própria tela |
| v62 | `e779f0d` | Fundos P&B e sépia deixam a foto inteira no mesmo tom; aviso de miniatura nas sessões de exemplo |
| v63 | `874d321` | Enquadramento lido pelos rostos; Mirante só fechada/meio corpo; asa-delta fora do automático (precisa de montagem generativa) |
| v64 | `5284276` | Sala de imprensa: grupo na altura das cadeiras, atrás da bancada |
| v65 | `8eddc1a` | Fundo Noite de campeão substituído pela versão nova |
| v66 | `bcbd8df` | Fundo Noite de campeão · Argentina |
| v67 | `b37a9d5` | Quiosque: revisão foto a foto em tela cheia com setas e Quero essa; depois só as escolhidas e o pacote |
| v68 | `479f7b7` | Campos De/Até abrem o calendário ao toque |
| v69 | `4d7bf00` | Revisão de fotos com menus de fotógrafo, data e venda, filtro de foto vendida/não vendida; sessões reais incluídas |
| v70 | `1b949e5` | Revisão de fotos até hoje: sessões da Roverpix por cartão, fotos locais casadas por fotógrafo e hora de captura; correção de Escala/Alertas com fotógrafo novo |
| v71 | `534ce8d` | Fundo Noite de campeão · Colômbia; grafia Klacius da Roverpix mapeada para Klássius |
| v72 | `d80a1a6` | Revisão: fotos casadas com as sessões da Roverpix pela sequência de captura; horários Roverpix em UTC; câmera sem check-in inferida |
| v73 | `ee6cd2a` | Upload automático: opção Todos no fotógrafo e no ponto; grupo fica com o fotógrafo das fotos |
| v74 | `6112327` | Loja única com escolha por símbolos e fundos de IA na sequência; Ajustes com IA automática e manual em alta; até 5 fundos; Klássius único |
| v75 | `c769026` | Loja: só ✗ e ✓; pagamento no carrinho; ícones novos de impressa, digital e pagamento |
| v76 | `55527a2` | Loja com o manual da marca, checkout numa tela, responsiva; 5 idiomas na Loja e na galeria do convidado |
| v77 | `0cec13e` | Galeria online por QR (fase 1): selfie, cortesias, grupos de escola com QR geral, compra de teste a R$ 39; Checkout em tela cheia sem login, bandeiras, tela final de 30 s configurável; canal Online nas vendas |
| v78 | `71b4510` | Menu em grupos (Dashboard, Curadoria, Fotógrafo, Configurações, Laboratório) com gaveta no celular; Loja vira Checkout (botão Abrir Checkout); área de Permissões com Criar, Ver, Alterar e Excluir por módulo, menu e tela inicial por pessoa, histórico e travas; check-in da câmera e troca de fotógrafo no Upload automático; saem Fluxo, Anfitrião no set, Convidado e o login de cliente |
| v79 | `a9e2cf6` | Dinheiro no Checkout aguardando caixa, com Confirmar e Cancelar no Caixa, status e filtro na Lista de vendas e alerta após 15 min; interruptor do ajuste automático no Upload do fotógrafo; botão "Equipe: voltar ao app" só na câmera; aba do Checkout nunca entra logada; catálogo novo do Tour (Tribuna de Honra e Gramado), pacote Ideal pelo menor preço, fundos de IA dentro do pacote, resumo linha a linha e economia contra a compra avulsa; sessão paga não paga de novo |
| v80 | `8f937f4` | Painel no Dashboard no lugar da Semana (faturamento, fotos, sessões, gasto por visitante, receita por dia, vendas, fotos, funil, ranking do catálogo novo, pagamentos, CSV; filtros de período, ponto e fonte; tela inicial de Admin e Supervisor); Vendas e caixa só com vendedores; datas sempre dd/mm/aaaa; Catálogo e preços vira Painel de controle, com o FTP do estádio; sai o check-in da câmera do Upload; Copiar permissões de… em Permissões e Usuários; agente: /roverpix/* sem CORS aberto |
| v81 | `e924e1e` | Bandeiras com a imagem certa (as do item 67 em diante estavam trocadas; a lista salva é corrigida uma vez, sem mexer em foto enviada); fundos de IA só com os 4 aprovados (Noite de campeão sem a taça, Mirante ao pôr do sol, Arquibancada 1950 em preto e branco, Saída do túnel), os outros em Laboratório › Fundos em teste (Ativar e Mover para o Laboratório, com histórico); títulos dos grupos do menu em negrito, maiores e mais claros; Klassius e Sandessa na lista de fotógrafos; Abrir Checkout abre uma janela à parte para o segundo monitor e o admin continua logado; agente: FTP do estádio só aceita a subpasta de fotógrafo cadastrado, pasta vazia (450) e arquivo sem tamanho não baixam |
| v82 | `6b6da2d` | Bandeiras sem imagem no maracafly (30, escudos dos clubes e bandeiras de Eslováquia, Reino Unido e Índia) com imagem da Wikimedia; a imagem da bandeira aceita URL completa só da Wikimedia ou do maracafly; a lista salva recebe as imagens uma vez, sem mexer em foto enviada nem em arquivo editado; imagem que não carrega some sem quebrar o layout |
| v83 | `pendente` | Multiterminal, etapa 1 (um notebook, sem rede): Cartão, PIX e Dinheiro do Checkout ficam aguardando (interface PAG_PROV com `pos-manual` e espaço para `tef`) e o vendedor confirma "Pago na maquininha" (NSU opcional, de 4 a 12 números; número de cartão é recusado e nunca gravado) ou "Recebi" no dinheiro; cancelar devolve o cliente ao carrinho com aviso nas 5 línguas; saem as promessas de "2 minutos"; tela Posto de venda (o admin cai nela ao abrir o Checkout; tela inicial de Atendimento e venda) com a venda acompanhada ao vivo (BroadcastChannel, sem passar pelo agente), Aguardando pagamento, Impressão 10×15 e Minhas vendas de hoje (valor de cada venda, sem totais); impressão pela DNP RX1HS de cada notebook pelo Chrome (102×152 mm sem margem, foto deitada girada, "Saiu certo" baixa o rolo uma vez, "Não saiu" e reimpressão com motivo, registro no CSV com posto, NSU e impressão); foto com fundo de IA imprime (decisão do Eduardo, 29/10), montada de novo com o fundo de 5000 px (`img/fundos-5k/`); rolo de 700 por posto e alerta abaixo de 40; confirmar pagamento e venda no balcão não baixam mais o estoque; fila local de eventos de venda (`eterna.ponto.fila.v1`, fora do SIM, até 7 dias ou 2000 eventos, gravada com `navigator.locks`) pronta para o envio ao agente na etapa 2; número da venda `L0-NNN`; venda acompanhada só com campos conhecidos (sem HTML vindo do canal); TEF simulado fora do Caixa até existir o TEF real; reimpressão com as fotos escolhidas e baixa só no "Saiu certo"; agente: fundos do Photoroom por um mapa fixo de arquivos aprovados (Noite de campeão sem a taça; 5000 px na impressão, com pedido só do recorte da pessoa) e W/H até 5000 no /photoroom/compose |
