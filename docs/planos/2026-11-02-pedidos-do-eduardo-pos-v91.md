# Pedidos do Eduardo depois da v91 (02/11/2026)

Os pedidos vieram no resumo que o Eduardo mandou ao Ronaldo por WhatsApp em 02/11, sobre as versões v86 a v91. O detalhe da v91 está em `VERSOES.md` e em `docs/planos/2026-10-30-sessoes-por-rosto-e-tempo.md`.

Quem fechar um item atualiza a linha dele **no mesmo commit**.

| # | Pedido | Dono | Situação |
|---|---|---|---|
| 1 | Reiniciar o Eterna no servidor de teste (MCTNBADM041) para pegar a v91 | Ronaldo (janela de administrador) | Comando passado em 02/11 |
| 2 | Tirar `ETERNA_BUSCA_DIAS=2` do `nuvem.env` do servidor de teste: com ele, a janela de 90 min não funciona | Ronaldo | Mesmo comando do item 1 |
| 3 | Conferir que o `ETERNA_ORIGENS` lista só a rede da equipe, nunca o Wi-Fi de visitante. É condição da segurança para o `/file/` ficar aberto até o pareamento | Ronaldo (conferir a linha) | Aguardando o print |
| 4 | **Vigia:** baixar só uma versão marcada (tag) e conferir o SHA-256 antes de rodar. Hoje ele baixa o `main` sem conferir | Ronaldo (código) | Em andamento; é a parte de atualização de `docs/planos/2026-10-30-instalador-do-servidor.md` |
| 5 | **Câmera nos caixas:** o Chrome só libera a câmera em https. Hoje cada caixa precisa da flag. Definitivo: https pelo `tailscale serve` ou certificado na rede local | Ronaldo (planejar) | Aberto |
| 6 | **VPN do FortiGate:** liberar a 8765 para a faixa de IP da VPN | — | Coberto: o `instalar-servidor.ps1` libera a 8765 e a 2121 para qualquer rede (perfil Any). Falta só confirmar a faixa quando a VPN for usada |
| 7 | **Testes do main** que já falhavam antes da v91: galeria-qr, painel, permissoes, v77, v78, v79, v81 e v83. Precisam acompanhar as telas novas do menu e do Checkout | Ronaldo | Aguardando o ok para instalar o Playwright no computador do Ronaldo |
| 8a | Calibrar o reconhecimento com um dia real do Tour | Ronaldo e Eduardo | Antes de 01/12 |
| 8b | RIPD com o agrupamento por rosto | Ronaldo e DPO | Antes de 01/12 |
| 8c | Limpar os dados antigos no navegador e no S3 (60 dias) | Ronaldo | Antes de 01/12 |
| 8d | "Pago" por foto quando duas famílias dividem uma sessão | Eduardo e Ronaldo (planejar) | Antes de 01/12 |

**Também para testar:** o protótipo de instalador `.dmg` do Eterna para Mac (Eterna.app), ainda sem assinatura da Apple, feito pelo Eduardo.

**O que veio da v90 do Ronaldo e o Eduardo mudou de propósito na v91:** o `lojaDele` saiu do fluxo da selfie e ficou só para menor e escola. A família inteira entra quando a pessoa é rosto principal. Isso ficou seguro porque as sessões agora se separam por rosto.
