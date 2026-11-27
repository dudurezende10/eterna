# Contagem de pessoas com reconhecimento profissional (InsightFace, no servidor)

27/11/2026. Decisão do Ronaldo.

## Problema

A contagem de pessoas fotografadas usa o SFace do OpenCV (modelo leve). Em 26/11 deu 396, depois 564 e 715 conforme o limite de semelhança: o número depende demais do ajuste e não tem erro medido. Ronaldo: "não tem como em 4 mil fotos ter só 396 pessoas"; "preciso de uma solução segura, confiável e com credibilidade".

## Decisão

- Reconhecimento de rosto da **InsightFace** (detecção SCRFD + reconhecimento ArcFace), com **licença comercial**: os modelos públicos são só para pesquisa não comercial. Orçamento pedido a contact@insightface.ai em 27/11.
- Roda **no servidor do estádio**, na placa NVIDIA (RTX 5060 Ti 16 GB, ONNX Runtime com CUDA já instalado). Nenhum dado de rosto sai do estádio (LGPD: biometria é dado sensível).
- **AWS Rekognition descartado**: cerca de US$ 15 por dia (4.988 fotos e 9.132 rostos de 26/11), mas a biometria ficaria nos EUA (us-east-2), com base legal e aviso ao visitante.

## Como vai funcionar

1. Processo à parte, depois das 19h: revê todas as fotos do dia na placa (o recorte e a venda não são afetados).
2. Rostos agrupados por pessoa com o ArcFace; pares duvidosos conferidos pelo Qwen-VL que já roda no servidor.
3. O e-mail da auditoria das 21h traz a conta nova ao lado da atual até a nova ser validada.
4. Validação: amostra contada à mão (por exemplo 2 horas de fotos de um dia, tela "mesma pessoa / outra pessoa"); a conta nova vira a oficial quando o erro medido for baixo.

## Pendências

- Resposta e preço da InsightFace; compra da licença (Ronaldo).
- Tela de conferência da amostra e o processo noturno (desenvolvimento enquanto a licença não sai; publicação só depois das 18h).
