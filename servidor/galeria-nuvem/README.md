# Galeria na nuvem (plano v85, parte F)

API que atende o celular do cliente fora do estádio: QR, código curto, selfie (Rekognition, só contra os rostos da própria galeria), galeria e download do que foi comprado. Mesmo contrato das rotas `/g/*` do agente, então o app não muda de tela. A compra online fica desligada (`CompraOnline=0`) enquanto o pagamento for só na maquininha Imply no balcão.

## Como funciona
- O agente do estádio envia as fotos para o bucket (`vitrine/` e `alta/`, parte E) e publica cada galeria em `POST /ponto/galerias`, autenticado pelo segredo do ponto (`~/Eterna/nuvem-segredo.txt`; na nuvem fica só o SHA-256).
- A API guarda o manifesto no DynamoDB (`eterna-galeria`, com TTL). Os rostos das fotos só são lidos depois do primeiro consentimento na galeria, numa coleção do Rekognition por galeria (`et-maracana-<HMAC do token>`), com o progresso gravado a cada foto.
- A coleção é apagada quando a galeria é encerrada no ponto ou vence (limpeza diária agendada).
- Tetos por dia de leituras e de selfies, e alerta de orçamento por e-mail.
- A selfie é comparada só com essa coleção:
  - adulto: semelhança ≥ 85 libera as fotos à venda em que a pessoa aparece (v95) e, numa venda, sempre todas as compradas e cortesias dela (v96.1);
  - grupo de escola: ≥ 95, e só as fotos em que a criança aparece; sessão de menor: ≥ 95, e as compradas e cortesias da venda também;
  - sem acerto em nenhuma foto: `nao_encontrado`, mesmo com foto comprada;
  - 5 tentativas por (IP, galeria) e depois 15 min de bloqueio;
  - escola: no máximo 2 crianças diferentes por IP em 24 h e 60 acessos por hora por galeria.
- As fotos saem por link assinado do S3 de 5 min. A alta só sai para foto comprada ou cortesia.
- Eventos sem dado pessoal (IP com hash e sal do dia), guardados por 90 dias: `qr_aberto`, `codigo_digitado`, `selfie_ok`, `selfie_nao`, `selfie_sem_rosto`, `galeria_vista`, `compra_tentada`, `livres_vistas` (v96.1: compradas e cortesias abertas só pelo QR, com a contagem; `selfie_ok` também leva `livres`) e `galeria_teto_selfie` (v96.1: 20 selfies sem acerto no dia na galeria de venda, somando IPs; a selfie da galeria para até o dia seguinte e o log ganha uma linha `ALERTA`).

## Instalar ou atualizar (AWS CloudShell, região us-east-2)
```bash
rm -rf eterna && git clone --depth 1 https://github.com/dudurezende10/eterna.git && cd eterna/servidor/galeria-nuvem
sam deploy --template-file template.yaml --stack-name eterna-galeria --region us-east-2 --resolve-s3 \
  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides Bucket=<bucket> SegredoPontoSha256=<SHA-256 do segredo do ponto> EmailOrcamento=<e-mail do alerta>
```
No fim, `EnderecoApi` é a URL da API (até existir `api.eterna.photo`).

Teste local, sem AWS: `python teste_local.py .`

## Ligar no ponto
Agente com `ETERNA_GALERIA_API=<EnderecoApi>`. No app, `GAL_API` aponta para a mesma URL: o celular fora do estádio usa a nuvem, e o computador do ponto continua usando o agente.

## Antes de usar com fotos de clientes
- Opt-out de treino de IA da AWS conferido (v81 D7).
- Consentimento da selfie citando a AWS (v81 D11).
- RIPD com o DPO.

Até lá, testar só com fotos da equipe.
