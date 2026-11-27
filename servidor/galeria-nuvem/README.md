# Galeria na nuvem (plano v85, parte F)

API que atende o celular do cliente fora do estádio: QR, código curto, selfie (Rekognition, só contra os rostos da própria galeria), galeria e download do que foi comprado. Mesmo contrato das rotas `/g/*` do agente, então o app não muda de tela. Compra online pela Imply (v99): o cliente paga no checkout da Imply e a Nuvem libera as fotos quando a Imply confirmar.
Ela fica desligada até `CompraOnline=1` e a chave e o tipo de pessoa da Imply estarem configurados (ver "Ligar a compra pela Imply").

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
**Atenção (12/11):** o código está na branch `idiomas-base` (clonar com `-b idiomas-base`). `SegredoPontoSha256` e
`SegredoPontoTesteSha256` são `NoEcho`: o `describe-stacks` devolve `****` no lugar deles. Nunca montar o
`--parameter-overrides` a partir do `describe-stacks` sem trocar esses dois pelos valores de verdade: foi assim que, em 12/11,
os dois viraram `****` e a nuvem passou a recusar os servidores (401) até o deploy seguinte. Os valores são o SHA-256 do
`~/Eterna/nuvem-segredo.txt` de cada servidor (estádio e teste); calcular no próprio servidor, nunca mandar o segredo.
```bash
rm -rf eterna && git clone --depth 1 -b idiomas-base https://github.com/dudurezende10/eterna.git && cd eterna/servidor/galeria-nuvem
sam deploy --template-file template.yaml --stack-name eterna-galeria --region us-east-2 --resolve-s3 \
  --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides Bucket=<bucket> SegredoPontoSha256=<SHA-256 do segredo do ponto> SegredoPontoTesteSha256=<SHA-256 do segredo do teste>   EmailOrcamento=<e-mail do alerta> <os outros parâmetros que já estão na stack>
```
Para atualizar sem redigitar os outros parâmetros (tira os dois `NoEcho` da leitura e passa os dois de verdade):
```bash
P=$(aws cloudformation describe-stacks --stack-name eterna-galeria --region us-east-2 --query "Stacks[0].Parameters[].[ParameterKey,ParameterValue]" --output text | awk '$1 !~ /^SegredoPonto/ {printf "%s=%s ", $1, $2}')
sam deploy ... --parameter-overrides $P SegredoPontoSha256=<SHA-256 do estádio> SegredoPontoTesteSha256=<SHA-256 do teste>
```
Só trocar o segredo de um servidor (16/11: o servidor novo do estádio, `galeria-ligar.sh` mostra o SHA-256), sem
redeploy do código e sem tocar nos outros parâmetros (os `NoEcho` ficam com o valor anterior):
```bash
SHA=<SHA-256 que o galeria-ligar.sh mostrou>
PARAMS=$(for k in $(aws cloudformation describe-stacks --stack-name eterna-galeria --region us-east-2 --query "Stacks[0].Parameters[].ParameterKey" --output text); do
  if [ "$k" = SegredoPontoSha256 ]; then echo "ParameterKey=$k,ParameterValue=$SHA"; else echo "ParameterKey=$k,UsePreviousValue=true"; fi; done)
aws cloudformation update-stack --stack-name eterna-galeria --region us-east-2 --use-previous-template   --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --parameters $PARAMS &&
aws cloudformation wait stack-update-complete --stack-name eterna-galeria --region us-east-2 && echo PRONTO
```
Depois do deploy, conferir que o servidor publica: `GET /ponto/vendas-online` com o cabeçalho `x-eterna-ponto` responde 200 (401 = segredo errado).
No fim, `EnderecoApi` é a URL da API (até existir `api.eterna.photo`).

Teste local, sem AWS: `python teste_local.py .`

## Firewall (WAF) na frente da API (17/11)
A API HTTP não aceita WAF direto; o firewall fica num CloudFront na frente dela. A organização da conta não deixa usar
CloudFormation em us-east-1, então o firewall (`borda-waf.json`) é criado por comando lá (exigência do WAF de CloudFront) e o
CloudFront vem de `borda.yaml`, stack `eterna-galeria-borda` em us-east-2. Custo fixo de US$ 8 a 10 por mês.
- `excesso-por-ip`: mais de 300 pedidos em 1 minuto do mesmo IP recebe 429 enquanto passar do limite.
- Regras prontas da AWS: IP de má fama, entradas maliciosas e ataques comuns. Começam só contando (`Count`).
- As fotos não passam pela API (link assinado do S3), então quem abre a galeria faz poucos pedidos.
- O CloudFront manda o cabeçalho `x-eterna-origem` com um segredo; a API guarda só o SHA-256 (`OrigemSha256`). Pela borda, o IP
  do celular vem do `CloudFront-Viewer-Address`. Com `ExigirBorda=1`, pedido direto à API recebe 403.

1. Firewall (CloudShell, na pasta `eterna/servidor/galeria-nuvem`):
```bash
aws wafv2 create-web-acl --region us-east-1 --scope CLOUDFRONT --name eterna-galeria --default-action Allow={}   --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=eterna-galeria   --custom-response-bodies '{"excesso":{"ContentType":"APPLICATION_JSON","Content":"{\"motivo\":\"excesso\"}"}}'   --rules file://borda-waf.json --query Summary.ARN --output text > ~/borda-waf-arn.txt && cat ~/borda-waf-arn.txt
```
2. CloudFront (o segredo não aparece na tela; `~/borda-sha.txt` guarda só o SHA-256):
```bash
S=$(openssl rand -hex 24); printf %s "$S" | sha256sum | cut -d' ' -f1 > ~/borda-sha.txt
aws cloudformation deploy --region us-east-2 --stack-name eterna-galeria-borda --template-file borda.yaml   --parameter-overrides SegredoOrigem=$S FirewallArn=$(cat ~/borda-waf-arn.txt) --no-fail-on-empty-changeset; unset S
aws cloudformation describe-stacks --region us-east-2 --stack-name eterna-galeria-borda --query "Stacks[0].Outputs[0].OutputValue" --output text
```
3. A API conhecendo a borda, sem exigir ainda: o redeploy de "Instalar ou atualizar" (o comando com `$P` e os dois SHA-256
   dos servidores), acrescentando `OrigemSha256=$(cat ~/borda-sha.txt)` no fim do `--parameter-overrides`.
4. Trocar o endereço: `GAL_API` no `index.html` e, no servidor do estádio,
   `sudo bash /opt/eterna/app/servidor/linux/galeria-ligar.sh <EnderecoBorda>`.
5. Depois de uns dias olhando as métricas (console, WAF & Shield › Web ACLs › Global › eterna-galeria): regras prontas
   bloqueando e `ExigirBorda=1` na API (mesmo padrão do passo 3, trocando o parâmetro). Para as regras:
```bash
ID=$(cut -d/ -f4 ~/borda-waf-arn.txt); T=$(aws wafv2 get-web-acl --region us-east-1 --scope CLOUDFRONT --name eterna-galeria --id $ID --query LockToken --output text)
sed 's/"OverrideAction": {"Count": {}}/"OverrideAction": {"None": {}}/' borda-waf.json > /tmp/bloquear.json
aws wafv2 update-web-acl --region us-east-1 --scope CLOUDFRONT --name eterna-galeria --id $ID --lock-token $T --default-action Allow={}   --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=eterna-galeria   --custom-response-bodies '{"excesso":{"ContentType":"APPLICATION_JSON","Content":"{\"motivo\":\"excesso\"}"}}' --rules file:///tmp/bloquear.json
```

## Ligar a compra pela Imply (v99)
1. Guardar a chave do usuário de serviço da Imply como parâmetro protegido. Quem tem a chave digita no CloudShell; ela não
   vai em arquivo, template, e-mail ou chat:
   ```bash
   read -s -p "Chave da Imply: " K && aws ssm put-parameter --region us-east-2 --name /eterna/imply-chave --type SecureString --value "$K" --overwrite; unset K
   ```
2. Atualizar a stack mantendo os outros parâmetros (`aws cloudformation deploy`, como em 18/11; nunca o `sam deploy` com o
   `describe-stacks`, que troca os segredos por `****`), acrescentando em `--parameter-overrides`:
   `CompraOnline=1 ImplyChaveParametro=/eterna/imply-chave`. Tipo de pessoa (100001), consulta (GetCart, seção 7) e
   campo do produto já têm o padrão certo no template.
3. Testar primeiro na homologação da Imply, se ela der uma: trocar `IMPLY_ADMIN` e `IMPLY_LOJA` na função.

Rotas novas: `POST /g/<token>/pedido`, `GET /g/pedido/<ref>`, `GET /ponto/vendas-online` (segredo do ponto) e a conferência
agendada a cada 5 min. Registros no DynamoDB: `PED#<ref>` (pedido), `PEDPEND` (pendentes), `VONL` (vendas pagas), `LEAD#<hash do e-mail>`.

## Selfie sem código (v99.108)
Plano `docs/planos/2026-11-27-selfie-na-galeria.md`. Rotas novas: `POST /g/selfie/dias|pedido|estado` (passam pela rota `/g/{token}/{acao}` que já existe) e `GET|POST /ponto/selfies` (segredo do estádio; o de teste não leva pedido). A busca é do servidor do estádio, com o reconhecimento de lá: a selfie não vai ao Rekognition. Ela fica só no item `SFQ` da fila e sai quando o estádio leva o pedido (ou em 10 min). Estado do pedido em `SFP#<pedido>` (1 h); `SFAG` guarda a última vez que o estádio levou a fila: sem isso há 2 min, a tela não oferece a opção. Precisa de `sam deploy` (o comando de "Instalar ou atualizar").

## Ligar no ponto
Agente com `ETERNA_GALERIA_API=<EnderecoApi>`. No app, `GAL_API` aponta para a mesma URL: o celular fora do estádio usa a nuvem, e o computador do ponto continua usando o agente.

## Antes de usar com fotos de clientes
- Opt-out de treino de IA da AWS conferido (v81 D7).
- Consentimento da selfie citando a AWS (v81 D11).
- RIPD com o DPO.

Até lá, testar só com fotos da equipe.
