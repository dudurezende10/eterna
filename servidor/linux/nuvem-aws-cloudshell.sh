#!/usr/bin/env bash
# Eterna · parte AWS da nuvem e do backup do servidor do estádio. Rodar no CloudShell da conta da TI (us-east-2), uma vez.
# 1) usuário IAM eterna-servidor-estadio, que SÓ lê, grava e apaga no bucket do Eterna (fotos alta/vitrine, backup dos
#    bancos, cópia dos originais) e lista esse bucket: não mexe em mais nada da conta;
# 2) retenção do bucket por pasta (substitui a regra de teste "apaga tudo com 7 dias", que apagaria o backup):
#      alta/ e vitrine/ 30 dias (galeria do cliente: 30 dias para ver e baixar) · backup/ 400 dias (bancos e histórico diário)
#      originais/ 180 dias (cópia das fotos do HD) · envio pela metade apagado em 1 dia;
# 3) a chave desse usuário aparece só aqui na tela do CloudShell: digitar no servidor (nuvem-ligar.sh), nunca em chat ou e-mail.
#   bash nuvem-aws-cloudshell.sh
set -euo pipefail
REGIAO=us-east-2
CONTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="eterna-teste-$CONTA"
USUARIO=eterna-servidor-estadio
aws s3api head-bucket --bucket "$BUCKET" --region "$REGIAO" || { echo "bucket $BUCKET não encontrado"; exit 1; }
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
cat >/tmp/ciclo.json <<'POL'
{"Rules": [
  {"ID": "alta-30d",         "Status": "Enabled", "Filter": {"Prefix": "alta/"},      "Expiration": {"Days": 30}},
  {"ID": "vitrine-30d",      "Status": "Enabled", "Filter": {"Prefix": "vitrine/"},   "Expiration": {"Days": 30}},
  {"ID": "originais-180d",   "Status": "Enabled", "Filter": {"Prefix": "originais/"}, "Expiration": {"Days": 180}},
  {"ID": "backup-400d",      "Status": "Enabled", "Filter": {"Prefix": "backup/"},    "Expiration": {"Days": 400}},
  {"ID": "envio-incompleto", "Status": "Enabled", "Filter": {"Prefix": ""}, "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}}
]}
POL
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration file:///tmp/ciclo.json
rm -f /tmp/ciclo.json
aws s3api put-bucket-tagging --bucket "$BUCKET" --tagging 'TagSet=[{Key=projeto,Value=eterna},{Key=uso,Value=producao-estadio}]'
echo "ok bucket $BUCKET: privado, retenção por pasta"
# bash nuvem-aws-cloudshell.sh --so-retencao   só reaplica a retenção (não mexe no usuário nem cria chave)
[ "${1:-}" = --so-retencao ] && { aws s3api get-bucket-lifecycle-configuration --bucket "$BUCKET" --query 'Rules[].[ID,Expiration.Days]' --output text; exit 0; }
aws iam get-user --user-name "$USUARIO" >/dev/null 2>&1 || aws iam create-user --user-name "$USUARIO" --tags Key=projeto,Value=eterna >/dev/null
cat >/tmp/politica.json <<POL
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": "arn:aws:s3:::$BUCKET"},
    {"Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:AbortMultipartUpload"],
     "Resource": "arn:aws:s3:::$BUCKET/*"}
  ]
}
POL
aws iam put-user-policy --user-name "$USUARIO" --policy-name eterna-so-bucket --policy-document file:///tmp/politica.json
rm -f /tmp/politica.json
echo "ok usuário $USUARIO só no bucket $BUCKET"
n="$(aws iam list-access-keys --user-name "$USUARIO" --query 'length(AccessKeyMetadata)' --output text)"
[ "$n" -lt 2 ] || { echo "o usuário já tem 2 chaves: apagar a velha antes (aws iam delete-access-key)"; exit 1; }
echo
echo "=== Digite no servidor quando o nuvem-ligar.sh pedir. Esta chave aparece só agora. ==="
aws iam create-access-key --user-name "$USUARIO" --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text \
  | awk '{print "Chave (ID):     "$1"\nChave secreta:  "$2}'
