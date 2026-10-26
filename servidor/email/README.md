# eterna-email

> **Fora de uso desde 26/10/2026.** O envio de e-mail do Eterna vai sair de uma conta @eterna.photo. O contrato das rotas abaixo continua valendo para o serviço que substituir este: basta preencher `MAIL_API` no `index.html`.

Serviço de comunicação do Eterna. Gera, envia e confere o código de acesso do login.
O e-mail sai de **ti@maracatour.com.br** pelo Microsoft 365 (Graph, app-only com certificado),
o mesmo app e certificado do Viva Parceiros.

- VM: `vm-site-viva-maracana-prod-02` (20.242.42.225), pasta `/opt/eterna-email`, container `eterna-email`
- Endereço público: `https://parceiros.vivamaracana.com.br/eterna-api/` (rota no Caddy do Viva Parceiros, `publicar-rota.sh`)
- `.env` na VM (fora do git): `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `MAIL_FROM`, `MAIL_NOME`, `MAIL_MODE`, `APP_SECRET`

| Rota | Corpo | Resposta |
| --- | --- | --- |
| `POST /auth/codigo` | `{ email }` | 202 enviado · 429 aguarde · 502 falha no envio |
| `POST /auth/verificar` | `{ email, codigo }` | 200 `{ ok, token, exp }` · 401 `incorreto` / `expirado` |
| `GET /healthz` | | 200 |

Regras: código de 6 dígitos, 10 minutos, 5 tentativas, uso único. Limites: 1 pedido a cada 30 s e 6 por hora por e-mail,
30 por hora por IP, 400 por hora no total. Códigos ficam só em memória (guardados como HMAC).
CORS: eterna.photo, www.eterna.photo, 127.0.0.1:8765 e localhost:8765.

Sem o serviço, o app gera o código no navegador e mostra a caixa de entrada simulada.

Atualizar: `scp server.js Dockerfile docker-compose.yml azureuser@20.242.42.225:/opt/eterna-email/` e
`cd /opt/eterna-email && sudo docker compose up -d --build`.

## Permissão do remetente

O app do Graph só envia pelas caixas liberadas no Exchange (RBAC for Applications). Para liberar ti@maracatour.com.br,
um admin do Exchange roda no PowerShell:

```powershell
Connect-ExchangeOnline
Get-ManagementRoleAssignment -Role "Application Mail.Send" | Format-List Name,App,CustomResourceScope
New-ManagementScope -Name "Eterna - ti" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'ti@maracatour.com.br'"
New-ManagementRoleAssignment -Name "Eterna - Mail.Send ti" -App <App da linha acima> -Role "Application Mail.Send" -CustomResourceScope "Eterna - ti"
Test-ServicePrincipalAuthorization -Identity <App> -Resource ti@maracatour.com.br
```
