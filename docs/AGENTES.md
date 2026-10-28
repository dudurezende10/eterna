# Esteira de agentes do Eterna

Cada task do Eduardo passa por sete agentes especialistas, definidos em `.claude/agents/`. Todos leem `docs/CONTEXTO-ETERNA.md` antes de começar.

```
Eduardo → Planejador → Programador → Revisor → Testador → Segurança → Documentador → Deploy → relatório
                           ↑___________|__________|__________|   (qualquer um devolve ao Programador)
```

| Agente | Arquivo | Entrega |
| --- | --- | --- |
| Planejador | `eterna-planejador.md` | plano com escopo, decisões assumidas, mudanças por arquivo, critérios de aceite, riscos |
| Programador | `eterna-programador.md` | código no index.html / agente, testes passando, relatório do que mudou |
| Revisor | `eterna-revisor.md` | revisão do código (lógica, padrão, plano cumprido, traduções), APROVADO/DEVOLVER |
| Testador | `eterna-testador.md` | testes novos em `testes/`, prints, veredito APROVADO/REPROVADO com falhas detalhadas |
| Segurança | `eterna-seguranca.md` | achados BLOQUEANTE / IMPORTANTE / NOTA, veredito |
| Documentador | `eterna-documentador.md` | documentação técnica, contexto dos agentes, guia da equipe, notas da versão |
| Deploy | `eterna-deploy.md` | commit em `main`, `VERSOES.md`, publicação em eterna.photo, relatório |

Regras da esteira
- Revisor e testador devolvem ao programador até APROVADO (máximo 3 voltas; na terceira o orquestrador decide com o Eduardo).
- Segurança só reprova com achado BLOQUEANTE; IMPORTANTES viram pendência registrada.
- Deploy só roda com revisor, testador e segurança aprovados, documentação atualizada e `bash testes/rodar.sh` com `FALHAS: 0`.
- Quem orquestra (Claude na conversa com o Eduardo) passa o resultado de um agente para o próximo e devolve o relatório final.

Como usar fora desta conversa: no Claude Code, dentro do repositório, os agentes aparecem como subagentes (`eterna-planejador`, etc.).
