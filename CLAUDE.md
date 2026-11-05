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
