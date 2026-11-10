# Eterna

Responda em português do Brasil. Contexto do produto em `docs/CONTEXTO-ETERNA.md`; esteira em `docs/AGENTES.md`.

## Atualizar o servidor de teste

O servidor de teste é o notebook do Ronaldo. Ninguém entra nele: você envia para a branch `idiomas-base` e ele se atualiza sozinho em até 1 minuto. Leia `docs/SERVIDOR-DE-TESTE.md` antes de mexer.

```bash
git checkout idiomas-base && git pull
# altere e teste
git add <arquivos> && git commit -m "O que mudou" && git push origin idiomas-base
curl http://100.115.186.26:8797/
```

## Regras

- Nunca una `idiomas-base` em `main`: `main` é o site eterna.photo no ar, e essa branch não funciona lá enquanto o servidor do estádio não tiver o agente novo.
- Nunca publique a nuvem a partir de `idiomas-base`: ela removeu rotas que o site em `main` usa.
- Use merge. Sem rebase e sem force.
- O repositório é público: nada de senhas, chaves ou achados de segurança em commit, issue ou PR.
- Sem linha `Co-Authored-By` nos commits e sem menção a IA nos PRs.

## Onde mora o dado (regra do projeto, 10/11/2026)

Todo registro de operação (venda, pedido, impressão, reimpressão, cortesia, rolo, troca, cancelamento, ação de alguém) é gravado no banco do servidor e lido de lá. O navegador só mostra e segura o que ainda não subiu (fila de envio). Sem isso não há salvaguarda, rastreabilidade, estatística, observabilidade nem persistência.

- Cada fato vira evento no servidor na hora em que acontece (`POST /ponto/eventos`, com `idem` para não duplicar), com quem, quando, onde e por quê.
- A tela é refeita do servidor (rota `GET`) e da fila local ainda não enviada. Nunca o contrário.
- `localStorage`/SIM é cópia para desenhar a tela e preferência do aparelho. Não pode ser a única cópia de nada que importe.
- Proibido corrigir dado que some com remendo no navegador (juntar abas, "o maior vence" etc.): leve o dado para o banco.
- Dado novo de operação já nasce no banco, junto com a métrica do dia que o usa.

Inventário do que ainda não segue a regra e a ordem de correção: `docs/planos/2026-11-10-dado-no-banco.md`.
