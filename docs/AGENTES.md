# Esteira de agentes do Eterna

Cada task do Eduardo passa por cinco agentes especialistas, definidos em `.claude/agents/`. Todos leem `docs/CONTEXTO-ETERNA.md` antes de começar.

```
Eduardo → Planejador → Programador ⇄ Testador → Segurança → Deploy → relatório
                           ↑______________________|  (devolve se reprovar)
```

| Agente | Arquivo | Entrega |
| --- | --- | --- |
| Planejador | `eterna-planejador.md` | plano com escopo, decisões assumidas, mudanças por arquivo, critérios de aceite, riscos |
| Programador | `eterna-programador.md` | código no index.html / agente, testes passando, relatório do que mudou |
| Testador | `eterna-testador.md` | testes novos em `testes/`, prints, veredito APROVADO/REPROVADO com falhas detalhadas |
| Segurança | `eterna-seguranca.md` | achados BLOQUEANTE / IMPORTANTE / NOTA, veredito |
| Deploy | `eterna-deploy.md` | commit em `main`, `VERSOES.md`, publicação em eterna.photo, relatório |

Regras da esteira
- Programador e testador alternam até APROVADO (máximo 3 voltas; na terceira o orquestrador decide com o Eduardo).
- Segurança só reprova com achado BLOQUEANTE; IMPORTANTES viram pendência registrada.
- Deploy só roda com testador e segurança aprovados e `bash testes/rodar.sh` com `FALHAS: 0`.
- Quem orquestra (Claude na conversa com o Eduardo) passa o resultado de um agente para o próximo e devolve o relatório final.

Como usar fora desta conversa: no Claude Code, dentro do repositório, os agentes aparecem como subagentes (`eterna-planejador`, etc.).
