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
