# Como desenvolver o Eterna (Ronaldo e Eduardo, cada um da sua máquina)

Leitura obrigatória para quem programa no Eterna, gente ou Claude. Resumo em uma linha: **você altera no seu computador, testa local, faz commit e `git push` para `idiomas-base`; o servidor do estádio puxa sozinho em até 1 minuto.** Ninguém copia arquivo para o servidor e ninguém publica no `main` sem o Ronaldo autorizar.

## 1. O mapa

```
Seu computador (Mac do Eduardo / Windows do Ronaldo)
  repositório git ── commit ── git push origin idiomas-base (e producao)
                                      │
                                   GitHub (dudurezende10/eterna)
                                      │  a cada 60 s
Servidor do estádio srv-viva-maracana (Ubuntu, 192.168.10.10)
  eterna-vigia   busca o ramo, confere, avança (fast-forward) e religa o agente
  /opt/eterna/app        cópia do git que está no ar
  eterna-app     serve o index.html dessa cópia em 127.0.0.1:8798
  eterna         o agente (agente/eterna-agente.py), porta 8765; postos abrem https://posto.eterna.photo
  eterna-recorte recorte com IA na placa de vídeo (RTX 5060 Ti), processo filho do agente
  vsftpd         FTP das câmeras e celulares → /srv/eterna-midia/ftp/<login>/
```

| Peça | Arquivo no repositório | Onde roda |
|---|---|---|
| Tela inteira (todas as telas, um arquivo só) | `index.html` | navegador dos postos e tablets, servida pelo agente |
| Agente do ponto (API, sessões, vendas, FTP, rostos, nuvem, backup) | `agente/eterna-agente.py` | servidor, serviço `eterna` |
| Recorte com IA | `agente/eterna-recorte.py` | servidor, placa de vídeo |
| Vigia (deploy e saúde) | `servidor/linux/eterna-vigia.py` | servidor, serviço `eterna-vigia` (cópia fixa: não se atualiza pelo git) |
| Instalação e manutenção do servidor | `servidor/linux/*.sh` | rodados pelo Ronaldo com `sudo` |
| Galeria online do cliente | `servidor/galeria-nuvem/` | AWS (Lambda), deploy à parte |
| Testes | `testes/` (`bash testes/rodar.sh`) | seu computador |

## 2. Os ramos

| Ramo | Para quê | Quem envia |
|---|---|---|
| `idiomas-base` | **o que o servidor do estádio roda hoje** (o vigia segue este ramo) | Ronaldo e Eduardo |
| `producao` | espelho de `idiomas-base`; o vigia vai passar a seguir este ramo, e aí `idiomas-base` vira o de teste | os dois, sempre junto com `idiomas-base` |
| `main` | site eterna.photo (GitHub Pages) e a versão antiga | **só com autorização do Ronaldo** |

Regras de git: merge, nunca rebase nem `--force`. Nunca unir `idiomas-base` em `main`. O vigia só aceita avanço (fast-forward): se o seu envio não parte do commit que está no ar, ele não aplica nada.

## 3. Ciclo de trabalho

```bash
# 1. começar sempre do que está no ar
git checkout idiomas-base && git pull origin idiomas-base

# 2. alterar index.html / agente/... e testar (seção 4)
bash testes/rodar.sh            # precisa terminar com FALHAS: 0 (ou ao menos as duas linhas de sintaxe OK)

# 3. enviar (o Ronaldo também envia: puxe antes e una por merge)
git add <arquivos> && git commit -m "O que mudou, em português"
git pull origin idiomas-base     # merge se houver commit novo; resolva conflitos mantendo os dois lados
git push origin idiomas-base && git push origin idiomas-base:producao

# 4. conferir que entrou no servidor (VPN ligada)
ssh srv-viva-maracana 'curl -s http://127.0.0.1:8797/'
```

Na resposta do passo 4: `commit` tem que ser o seu, `erro` vazio, `agente_vivo: true`. Mudou só o `index.html`: o agente relê a tela em até 60 s, sem reinício. Mudou algo em `agente/`: o vigia religa o agente e espera ele responder.

**Se der errado o vigia se protege sozinho:** agente que não compila é recusado (fica em `recusados` e o servidor continua na versão anterior); agente que não sobe em 90 s volta para o commit anterior (`voltas` aumenta). Corrija e envie um commit novo (o recusado não é tentado de novo). Para desfazer algo que entrou: `git revert <commit>` e push; nunca reescreva o histórico.

## 4. Testar no seu computador antes de enviar

O agente roda igual no Mac, no Windows e no Linux, com os dados em `~/Eterna` (separado do servidor):

```bash
# terminal 1: serve a tela do SEU repositório (senão o agente baixa a do eterna.photo)
python3 -m http.server 8798 --bind 127.0.0.1
# terminal 2: o agente usando essa tela
ETERNA_APP_ORIGIN=http://127.0.0.1:8798 python3 agente/eterna-agente.py
# abrir http://127.0.0.1:8765
```

- Fotos de teste: copiar JPGs para a pasta vigiada indicada no console (ou usar o Upload da tela).
- Recorte com IA local é opcional (`agente/instalar-recorte.command` no Mac); sem ele, o resto funciona.
- `bash testes/rodar.sh` usa uma pasta descartável e não toca o seu `~/Eterna`.
- Sintaxe rápida sem rodar tudo: `python3 -m py_compile agente/eterna-agente.py` e, para a tela, o `node -e` da primeira linha do `testes/rodar.sh`.

## 5. Olhar o servidor (VPN MaracaTour ligada)

Acesso e comandos prontos: `docs/SERVIDOR-ESTADIO.md`. O essencial:

```bash
ssh srv-viva-maracana 'journalctl -u eterna --since "-30 min" --no-pager | tail -100'   # o que o agente está fazendo
ssh srv-viva-maracana 'tail -50 /var/log/eterna-vigia.log'                               # histórico de deploy
ssh srv-viva-maracana 'ls /srv/eterna-midia/inbox/$(date +%F) | wc -l'                  # fotos de hoje
```

O login de desenvolvedor lê tudo isso, mas não tem `sudo`: reiniciar serviço, mexer em `nuvem.env`, chaves, firewall, bancos ou trocar o ramo do vigia é com o Ronaldo. Os bancos (`/srv/eterna/Eterna/`) não são legíveis pelo desenvolvedor, de propósito (LGPD); para investigar dado, use as rotas do agente ou peça ao Ronaldo.

## 6. Regras do projeto que valem em todo commit

- Todo texto novo da tela entra nos 5 idiomas (`T()`; pt, en, es, fr, de).
- Registro de operação mora no banco do servidor, nunca só no navegador (`CLAUDE.md`, "Onde mora o dado").
- Nomes das ativações: Drone, Chute a Gol e Snap Pop.
- Fundo de IA é montado no servidor quando a foto chega, nunca na frente do cliente (`docs/fundos-ia-regras.md`).
- Status e níveis sempre em palavras na tela, nunca código ou letra.
- Mudança e decisão registradas em `docs/` no mesmo commit; plano vigente do servidor em `docs/planos/2026-11-14-servidor-definitivo.md`.
- Repositório público: nada de senha, chave, IP externo da VPN ou achado de segurança em commit. Sem `Co-Authored-By` e sem menção a IA.
- Dados de clientes: ler para investigar, nunca copiar fotos ou bancos para fora do servidor.

## 7. Quando chamar o Ronaldo

Qualquer coisa com `sudo` (lista na seção 5), publicar no `main`, mudar algo na AWS, no FortiGate ou no Wi-Fi do estádio, e qualquer venda real na Imply.
