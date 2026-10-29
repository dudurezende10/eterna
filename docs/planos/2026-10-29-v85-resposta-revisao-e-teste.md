# v85 · Resposta à revisão de segurança da galeria na nuvem e roteiro de teste com câmera

Para: Eduardo. De: Ronaldo (TI Maracatour). 29/10/2026.

## 1. Resposta à revisão

As correções foram feitas no commit `ad4ea1a` e publicadas na AWS às 15:03 de 29/10. Não precisam esperar a v84.

| Achado da revisão | Situação | Como ficou |
|---|---|---|
| Rostos nunca apagados | **corrigido** | A coleção da galeria é apagada na hora quando a galeria é encerrada no ponto, e na limpeza diária agendada quando vence. Coleção sem galeria também é apagada. |
| Galeria encerrada continua no ar | **corrigido** | `POST /galerias/encerrar` no agente também entra na fila da nuvem. A nuvem responde 410 no QR, 404 no código curto e apaga os rostos. Republicar não reabre. |
| Leitura de rosto sem trava (antes do consentimento, inclusive escola) | **corrigido** | Publicar não lê rosto nenhum. A leitura só começa depois da primeira selfie com consentimento naquela galeria. |
| Consentimento não cita a AWS | **corrigido** | Textos novos `gq_consentSelfNuvem` e `gq_consentKidNuvem` (5 idiomas), usados só quando a galeria é atendida pela nuvem (`galNuvem()`). A versão gravada é `GQ_VERSAO-aws`. No estádio continua o texto de antes. |
| Custo sem limite / leitura recomeçando do zero | **corrigido** | Progresso gravado a cada foto e trava por galeria: nenhuma foto é paga duas vezes. Leitura incompleta devolve 503 `processando` (não conta tentativa) e continua em segundo plano. Tetos: 600 fotos por galeria, 15 mil leituras e 10 mil selfies por dia. Alerta de orçamento por e-mail. |
| Documento público com conta e pendências | **corrigido** | Saíram de `docs/NUVEM.md`. As pendências ficam no servidor do ponto, fora do Git. |
| Chave da AWS e senha do FTP | **adiado, decisão do Ronaldo** | Ambiente de homologação. A troca é feita antes da produção. |

Conferências feitas em 29/10:
- Túnel público (cloudflared) parado.
- Envio de galerias para a nuvem desligado por padrão (só com `ETERNA_GALERIA_API`). Hoje só o Eterna de teste do notebook do Ronaldo está ligado.
- Nenhuma coleção de rostos na AWS.
- Teste com AWS simulada, sem custo: `python servidor/galeria-nuvem/teste_local.py servidor/galeria-nuvem`, 11 de 11 verificações passaram.
- Checagem na API publicada: segredo, consentimento e encerrar respondendo certo.

Detalhes, dimensionamento para 15 mil fotos por dia e custos: [`docs/NUVEM.md`](../NUVEM.md), seções 3.5, 4 e 7.

**Para o merge da v84:** além de `servidor/galeria-nuvem/*` e `docs/NUVEM.md`, o commit mexe em 3 pontos de arquivos que a v84 também pode tocar:
- `index.html`: as duas chaves novas de texto antes de `gq_agree`, `galNuvem` na linha do `GAL_API` e a escolha do texto e da versão no consentimento;
- `agente/eterna-agente.py`: uma linha, `nuvem_galeria_enfileira(t)` na rota `/galerias/encerrar`.

## 2. Teste de ponta a ponta com a câmera

O objetivo é provar o caminho inteiro com **fotos da equipe**, nunca de cliente: câmera → Eterna → nuvem → QR → celular fora do Wi-Fi → selfie → download.

### Antes de começar
- Quem aparecer nas fotos precisa ser da equipe e concordar. A selfie vai para a AWS (Rekognition, Estados Unidos).
- O Eterna ligado na nuvem é o do notebook do Ronaldo (`192.168.10.213`, porta 8765 para o app e porta 21 para o FTP). Está no ar.
- O seu Eterna não tem a chave da AWS nem o segredo do ponto. Eles **não vão por Git nem por chat**: se quiser rodar no seu, peça ao Ronaldo pessoalmente.

### Passo a passo
1. **Câmera:** configure o FTP da câmera para `192.168.10.213`, porta 21, com o seu usuário de fotógrafo do Eterna (o mesmo da sua pasta de fotógrafo).
2. **Fotos:** tire de 5 a 10 fotos de 1 ou 2 pessoas da equipe, de frente e de perfil. Sem cliente no fundo.
3. **Chegada:** no app do Eterna (`http://192.168.10.213:8765`), confira se a sessão aparece. Em `/status`, `nuvem.fila` deve voltar a 0 em segundos. Esse é o sinal de que as fotos subiram.
4. **Venda:** no Checkout, ache a pessoa pela câmera do balcão, escolha 2 fotos e marque como paga. Aparece o QR.
5. **Celular no 4G, Wi-Fi desligado:** leia o QR. Deve abrir `eterna.photo/#g/...` com o texto de consentimento **citando a AWS**.
6. **Selfie da pessoa fotografada:** deve liberar a sessão. As 2 compradas baixam em alta; as outras aparecem só na vitrine, com marca d'água. Se aparecer "processando" na primeira vez, tente de novo depois de alguns segundos: é a leitura dos rostos começando.
7. **Selfie de outra pessoa:** deve dar "não encontramos você" e descontar uma tentativa.
8. **Encerrar:** no painel de galerias, encerre a galeria. Abra o QR de novo no celular: deve dizer que a galeria foi encerrada.
9. **Escola (opcional):** grupo com 3 ou 4 pessoas da equipe, QR da turma, e selfie de cada uma. Cada pessoa vê só as fotos em que aparece.

### O que anotar e devolver
- Tempo do clique na câmera até a foto aparecer no Eterna, e até `nuvem.fila` voltar a 0.
- Tempo da primeira selfie e de uma segunda.
- Prints do consentimento, da galeria, do download e da galeria encerrada.
- Qualquer erro, com a hora certa (para achar no log).
