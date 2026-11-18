#!/usr/bin/env bash
# Eterna · alerta por e-mail quando o backup do servidor do estádio para. Rodar no CloudShell da conta da TI (us-east-2).
# Vigia de fora do servidor (assim avisa também quando o servidor está desligado ou sem internet):
#   - o Eterna grava backup/<pc>/pulso.json a cada 2 min; a cópia dos originais grava backup/<pc>/pulso-originais.json a cada rodada;
#   - a função eterna-alerta-backup roda a cada 10 min e manda e-mail (SNS) quando:
#       pulso com mais de 30 min .................. servidor sem contato com a nuvem (desligado, sem internet, Eterna parado)
#       último backup bom com mais de 30 min ....... backup dos bancos falhando (vai o erro)
#       cópia dos originais sem rodar há 3 h ....... cópia das fotos parada
#   - avisa uma vez quando o problema começa, repete a cada 6 h enquanto durar e avisa quando volta ao normal.
# Os e-mails vão como argumentos (não ficam no repositório). Cada pessoa recebe da AWS um e-mail "Subscription Confirmation"
# e precisa clicar em "Confirm subscription" uma vez; sem isso não recebe os alertas.
#   bash alerta-backup.sh pessoa1@empresa.com pessoa2@empresa.com ...
#   bash alerta-backup.sh --testar          manda um e-mail de teste para todos os inscritos
set -euo pipefail
REGIAO=us-east-2
export AWS_DEFAULT_REGION=$REGIAO
CONTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="eterna-teste-$CONTA"
PC=srv-viva-maracana
NOME=eterna-alerta-backup
TOPICO="$(aws sns create-topic --name "$NOME" --query TopicArn --output text)"
echo "ok tópico $TOPICO"

if [ "${1:-}" = --testar ]; then
  aws sns publish --topic-arn "$TOPICO" --subject "Eterna · teste do alerta de backup" \
    --message "Teste do alerta de backup do servidor do estádio ($PC). Se chegou, o alerta está funcionando." >/dev/null
  echo "ok e-mail de teste enviado"; exit 0
fi

for e in "$@"; do
  [[ "$e" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$ ]] || { echo "e-mail inválido: $e"; exit 1; }
  ja="$(aws sns list-subscriptions-by-topic --topic-arn "$TOPICO" --query "Subscriptions[?Endpoint=='$e'] | length(@)" --output text)"
  [ "$ja" = 0 ] && aws sns subscribe --topic-arn "$TOPICO" --protocol email --notification-endpoint "$e" >/dev/null
  echo "ok inscrito $e (confirmar no e-mail)"
done

D="$(mktemp -d)"
cat >"$D/confia.json" <<'POL'
{"Version": "2012-10-17", "Statement": [{"Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"}, "Action": "sts:AssumeRole"}]}
POL
cat >"$D/politica.json" <<POL
{"Version": "2012-10-17", "Statement": [
  {"Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::$BUCKET/backup/*"},
  {"Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::$BUCKET", "Condition": {"StringLike": {"s3:prefix": "backup/*"}}},
  {"Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::$BUCKET/backup/*/alerta-estado.json"},
  {"Effect": "Allow", "Action": "sns:Publish", "Resource": "$TOPICO"},
  {"Effect": "Allow", "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], "Resource": "*"}
]}
POL
aws iam get-role --role-name "$NOME" >/dev/null 2>&1 || { aws iam create-role --role-name "$NOME" --assume-role-policy-document "file://$D/confia.json" >/dev/null; sleep 10; }
aws iam put-role-policy --role-name "$NOME" --policy-name "$NOME" --policy-document "file://$D/politica.json"
PAPEL="$(aws iam get-role --role-name "$NOME" --query Role.Arn --output text)"
echo "ok papel $PAPEL (só lê backup/, grava o estado do alerta e publica no tópico)"

cat >"$D/lambda_function.py" <<'PY'
import json, os, time
import boto3
s3, sns = boto3.client("s3"), boto3.client("sns")
B, PC, T = os.environ["BUCKET"], os.environ["PC"], os.environ["TOPICO"]
REPETE = 6 * 3600


def le(chave):
    try:
        return json.loads(s3.get_object(Bucket=B, Key="backup/%s/%s" % (PC, chave))["Body"].read())
    except Exception:
        return None


def hora(t):
    return time.strftime("%d/%m %H:%M", time.gmtime(t - 3 * 3600)) if t else "nunca"


def lambda_handler(ev, ctx):
    agora = time.time()
    p, o = le("pulso.json") or {}, le("pulso-originais.json") or {}
    problemas = []
    if agora - (p.get("em") or 0) > 30 * 60:
        problemas.append("Servidor sem contato com a nuvem desde %s (desligado, sem internet ou Eterna parado)." % hora(p.get("em")))
    elif agora - (p.get("ok_em") or 0) > 30 * 60:
        problemas.append("Backup dos bancos falhando desde %s. Erro: %s" % (hora(p.get("ok_em")), p.get("erro") or "sem detalhe"))
    if agora - (o.get("em") or 0) > 3 * 3600:
        problemas.append("Cópia dos originais das fotos sem rodar desde %s." % hora(o.get("em")))
    est = le("alerta-estado.json") or {}
    assunto = None
    if problemas and (not est.get("ruim") or agora - (est.get("avisado") or 0) > REPETE):
        assunto = "Eterna · ALERTA: backup do servidor do estádio parado"
        corpo = "\n".join(problemas)
        est = {"ruim": True, "avisado": agora, "desde": est.get("desde") or agora}
    elif not problemas and est.get("ruim"):
        assunto = "Eterna · backup do servidor do estádio voltou ao normal"
        corpo = "Backup normal de novo (problema começou em %s)." % hora(est.get("desde"))
        est = {"ruim": False}
    if assunto:
        corpo += "\n\nServidor: %s · último pulso %s · último backup bom %s · última cópia dos originais %s" % (
            PC, hora(p.get("em")), hora(p.get("ok_em")), hora(o.get("em")))
        sns.publish(TopicArn=T, Subject=assunto, Message=corpo)
        s3.put_object(Bucket=B, Key="backup/%s/alerta-estado.json" % PC, Body=json.dumps(est).encode(), ContentType="application/json")
    return {"problemas": problemas, "avisou": bool(assunto)}
PY
(cd "$D" && zip -q funcao.zip lambda_function.py)
VARS="Variables={BUCKET=$BUCKET,PC=$PC,TOPICO=$TOPICO}"
if aws lambda get-function --function-name "$NOME" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$NOME" --zip-file "fileb://$D/funcao.zip" >/dev/null
  aws lambda wait function-updated --function-name "$NOME"
  aws lambda update-function-configuration --function-name "$NOME" --environment "$VARS" >/dev/null
else
  aws lambda create-function --function-name "$NOME" --runtime python3.12 --architectures arm64 --handler lambda_function.lambda_handler \
    --role "$PAPEL" --timeout 30 --memory-size 128 --zip-file "fileb://$D/funcao.zip" --environment "$VARS" \
    --tags projeto=eterna >/dev/null
fi
aws lambda wait function-active --function-name "$NOME"
REGRA="$(aws events put-rule --name "$NOME" --schedule-expression "rate(10 minutes)" --query RuleArn --output text)"
aws lambda add-permission --function-name "$NOME" --statement-id eventbridge --action lambda:InvokeFunction \
  --principal events.amazonaws.com --source-arn "$REGRA" >/dev/null 2>&1 || true
aws events put-targets --rule "$NOME" --targets "Id=1,Arn=$(aws lambda get-function --function-name "$NOME" --query Configuration.FunctionArn --output text)" >/dev/null
rm -rf "$D"
echo "ok função $NOME a cada 10 min"
echo; echo "Situação agora:"
aws lambda invoke --function-name "$NOME" /tmp/alerta-r.json >/dev/null && cat /tmp/alerta-r.json; echo
aws sns list-subscriptions-by-topic --topic-arn "$TOPICO" --query 'Subscriptions[].[Endpoint,SubscriptionArn]' --output text \
  | awk '{print "  " $1 ": " ($2 ~ /PendingConfirmation/ ? "aguardando confirmar no e-mail" : "confirmado")}'
