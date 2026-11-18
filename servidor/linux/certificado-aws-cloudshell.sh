#!/usr/bin/env bash
# Eterna · parte AWS do certificado do servidor do estádio. Rodar no CloudShell da conta 741796256738 (us-east-2), uma vez.
# 1) registro A posto.eterna.photo -> IP do servidor na rede do estádio (zona posto.eterna.photo, já delegada no GoDaddy);
# 2) usuário IAM eterna-certbot-estadio, que SÓ pode criar e apagar o TXT _acme-challenge.posto.eterna.photo (desafio do
#    Let's Encrypt) e ler o andamento: não mexe em mais nada da zona nem da conta;
# 3) a chave desse usuário aparece só aqui na tela do CloudShell: copiar para o servidor (passo do plano), nunca para chat ou e-mail.
#   bash certificado-aws-cloudshell.sh            (IP padrão 192.168.10.10)
set -euo pipefail
NOME=posto.eterna.photo
IP="${1:-192.168.10.10}"
USUARIO=eterna-certbot-estadio
Z="$(aws route53 list-hosted-zones-by-name --dns-name "$NOME." --query "HostedZones[?Name=='$NOME.'].Id | [0]" --output text | cut -d/ -f3)"
[ -n "$Z" ] && [ "$Z" != None ] || { echo "zona $NOME não encontrada nesta conta"; exit 1; }
echo "zona $NOME: $Z"
aws route53 change-resource-record-sets --hosted-zone-id "$Z" --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$NOME\",\"Type\":\"A\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$IP\"}]}}]}" >/dev/null
echo "ok registro A $NOME -> $IP"
aws iam get-user --user-name "$USUARIO" >/dev/null 2>&1 || aws iam create-user --user-name "$USUARIO" --tags Key=projeto,Value=eterna >/dev/null
cat >/tmp/politica-certbot.json <<POL
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["route53:ListHostedZones", "route53:GetChange"], "Resource": "*"},
    {"Effect": "Allow", "Action": "route53:ChangeResourceRecordSets", "Resource": "arn:aws:route53:::hostedzone/$Z",
     "Condition": {
       "ForAllValues:StringEquals": {
         "route53:ChangeResourceRecordSetsNormalizedRecordNames": ["_acme-challenge.$NOME"],
         "route53:ChangeResourceRecordSetsRecordTypes": ["TXT"]
       }
     }}
  ]
}
POL
aws iam put-user-policy --user-name "$USUARIO" --policy-name certbot-so-acme-challenge --policy-document file:///tmp/politica-certbot.json
rm -f /tmp/politica-certbot.json
echo "ok usuário $USUARIO só com o _acme-challenge"
n="$(aws iam list-access-keys --user-name "$USUARIO" --query 'length(AccessKeyMetadata)' --output text)"
[ "$n" -lt 2 ] || { echo "o usuário já tem 2 chaves: apagar a velha antes (aws iam delete-access-key)"; exit 1; }
echo
echo "=== Cole no servidor (passo seguinte do plano). Esta chave aparece só agora. ==="
aws iam create-access-key --user-name "$USUARIO" --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text \
  | awk '{print "[default]\naws_access_key_id = "$1"\naws_secret_access_key = "$2}'
