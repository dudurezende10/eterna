# Galeria na nuvem (plano v85, parte F)

API que atende o celular do cliente fora do estádio: QR, código curto, selfie (Rekognition, só contra os rostos da própria galeria), galeria e download do que foi comprado. Mesmo contrato das rotas `/g/*` do agente, então o app não muda de tela. A compra online fica desligada (`CompraOnline=0`) enquanto o pagamento for só na maquininha Imply no balcão.

## Como funciona
- O agente do estádio envia as fotos para o bucket (`vitrine/` e `alta/`, parte E) e publica cada galeria em `POST /ponto/galerias`, autenticado pelo segredo do ponto (`~/Eterna/nuvem-segredo.txt`; na nuvem fica só o SHA-256).
- A API guarda o manifesto no DynamoDB (`eterna-galeria`, com TTL) e lê em segundo plano os rostos das fotos numa coleção do Rekognition por galeria (`et-maracana-<HMAC do token>`).
- A selfie é comparada só com essa coleção:
  - adulto: semelhança ≥ 85 libera a sessão inteira;
  - grupo de escola e sessão de menor: ≥ 95, e só as fotos em que a criança aparece;
  - 5 tentativas por (IP, galeria) e depois 15 min de bloqueio;
  - escola: no máximo 2 crianças diferentes por IP em 24 h e 60 acessos por hora por galeria.
- As fotos saem por link assinado do S3 de 5 min. A alta só sai para foto comprada ou cortesia.
- Eventos sem dado pessoal (IP com hash e sal do dia), guardados por 90 dias: `qr_aberto`, `codigo_digitado`, `selfie_ok`, `selfie_nao`, `selfie_sem_rosto`, `galeria_vista`, `compra_tentada`.

## Instalar ou atualizar (AWS CloudShell, região us-east-2)
```bash
rm -rf eterna && git clone --depth 1 https://github.com/dudurezende10/eterna.git && cd eterna/servidor/galeria-nuvem
sam deploy --template-file template.yaml --stack-name eterna-galeria --region us-east-2 --resolve-s3 \
  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides Bucket=eterna-teste-741796256738 SegredoPontoSha256=<SHA-256 do segredo do ponto>
```
No fim, `EnderecoApi` é a URL da API (até existir `api.eterna.photo`).

## Ligar no ponto
Agente com `ETERNA_GALERIA_API=<EnderecoApi>`. No app, `GAL_API` aponta para a mesma URL: o celular fora do estádio usa a nuvem, e o computador do ponto continua usando o agente.

## Antes de usar com fotos de clientes
- Opt-out de treino de IA da AWS conferido (v81 D7).
- Consentimento da selfie citando a AWS (v81 D11).
- RIPD com o DPO.

Até lá, testar só com fotos da equipe.
