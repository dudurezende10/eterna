#!/bin/bash
# Plano v85: fotos.eterna.photo (CloudFront na frente do bucket), rodado no AWS CloudShell da conta do Eterna.
# Pré-requisito: o certificado de fotos.eterna.photo (us-east-1) já validado pelo CNAME na GoDaddy (fase 1).
# O CloudFront só entrega com link assinado: a chave PRIVADA fica no computador do ponto (~/Eterna/cloudfront-privada.pem);
# aqui vai só a PÚBLICA. O bucket continua privado: só esta distribuição lê (OAC + política com SourceArn).
set -e
R=${R:-us-east-2}
A=$(aws sts get-caller-identity --query Account --output text)
B=${B:-eterna-teste-$A}
CERT=${CERT:-$(cat cert-arn.txt)}

echo "esperando o certificado ser validado (o CNAME de validação precisa estar na GoDaddy)..."
aws acm wait certificate-validated --region us-east-1 --certificate-arn "$CERT"

cat > eterna-publica.pem <<'K'
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq72GjXpGtlmy0gKNAirH
ff12KVVw++yKHS3x0KQ0M2vq8s2SWVzBqWpqGhUxpypIE+Q0QR5gsANTXsoLm7n4
laK3nwleeHg7zHuLMkIE5uLT8vg9BI8jUesu4GCPC4vChq+f0uCzhbeFJDUTT3S2
2W0HWY5N3B2njj5PqgtRRfPF2DK46BLdEo8yYR091w3CG3kcUPWq7Le8c7TI/c01
odfaDXW8M6nsnYS4pbmjL7lvnqdMiOZrs5BXJ40c77OMgy8Xs4dnVziW6FxwFdZx
lOH9qgTO2O/FQBJj3YNMXEL0EUoDPsz8hf7yYN1Q4jGiCDSKdArNzXURrk7V3qIQ
GwIDAQAB
-----END PUBLIC KEY-----
K
REF=eterna-$(date +%s)
PK=$(aws cloudfront create-public-key --public-key-config "{\"CallerReference\":\"$REF\",\"Name\":\"eterna-links\",\"EncodedKey\":$(jq -Rs . eterna-publica.pem)}" --query PublicKey.Id --output text)
KG=$(aws cloudfront create-key-group --key-group-config "{\"Name\":\"eterna-links\",\"Items\":[\"$PK\"]}" --query KeyGroup.Id --output text)
OAC=$(aws cloudfront create-origin-access-control --origin-access-control-config "{\"Name\":\"eterna-$B\",\"SigningProtocol\":\"sigv4\",\"SigningBehavior\":\"always\",\"OriginAccessControlOriginType\":\"s3\"}" --query OriginAccessControl.Id --output text)

# cache: CachingOptimized (gerenciada pela AWS); a assinatura na URL não entra na chave do cache
cat > dist.json <<J
{"CallerReference":"$REF","Comment":"Eterna fotos","Enabled":true,
 "Aliases":{"Quantity":1,"Items":["fotos.eterna.photo"]},
 "Origins":{"Quantity":1,"Items":[{"Id":"s3","DomainName":"$B.s3.$R.amazonaws.com","S3OriginConfig":{"OriginAccessIdentity":""},"OriginAccessControlId":"$OAC"}]},
 "DefaultCacheBehavior":{"TargetOriginId":"s3","ViewerProtocolPolicy":"redirect-to-https","Compress":false,
   "TrustedKeyGroups":{"Enabled":true,"Quantity":1,"Items":["$KG"]},
   "AllowedMethods":{"Quantity":2,"Items":["GET","HEAD"]},
   "CachePolicyId":"658327ea-f89d-4fab-a63d-7e88639e58f6"},
 "ViewerCertificate":{"ACMCertificateArn":"$CERT","SSLSupportMethod":"sni-only","MinimumProtocolVersion":"TLSv1.2_2021"},
 "PriceClass":"PriceClass_All","HttpVersion":"http2and3"}
J
read DID DDOM < <(aws cloudfront create-distribution --distribution-config file://dist.json --query 'Distribution.[Id,DomainName]' --output text)

cat > bpol.json <<P
{"Version":"2012-10-17","Statement":[{"Sid":"SoCloudFrontEterna","Effect":"Allow","Principal":{"Service":"cloudfront.amazonaws.com"},
 "Action":"s3:GetObject","Resource":"arn:aws:s3:::$B/*","Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::$A:distribution/$DID"}}}]}
P
aws s3api put-bucket-policy --bucket "$B" --policy file://bpol.json

echo
echo "PRONTO. Passe estes valores:"
echo "  Para o Eduardo (Registro 2 na GoDaddy): CNAME  fotos  ->  $DDOM"
echo "  Para o Eterna: ETERNA_CDN=fotos.eterna.photo  ETERNA_CDN_CHAVE_ID=$PK"
echo "  (distribuição $DID; leva uns 5 a 10 min para ficar no ar)"
