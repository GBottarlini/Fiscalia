# AGENTS.md

Guia corta para agentes del repo.

## Prioridad documental

1. Pedido explicito del usuario.
2. Este `AGENTS.md`.
3. `README.md`.
4. `src/AGENTS.md`, `server/AGENTS.md`, `src/data/AGENTS.md` y `Skills/AGENTS.md` segun la zona.
5. `Skills/*/SKILL.md`.

## Guardrails

1. Preservar comportamiento: no tocar stack, auth, endpoints, CSV ni UX salvo pedido explicito.
2. Usar solo comandos, variables, endpoints y contratos reales del repo.
3. Dejar cambios auditables: que se hizo, por que y en que archivo.
4. Si cambias docs o skills, mantener alineados `README.md`, `AGENTS.md`, `Skills/` y los `AGENTS.md` locales afectados.

## Skills a auto-cargar

- `Skills/skill-creator/SKILL.md` para crear o adaptar skills reutilizables.
- `Skills/skill-sync/SKILL.md` despues de tocar skills o referencias documentales.
- `Skills/csv-contract-and-curation/SKILL.md` al editar o curar `src/data/*.csv`.
- `Skills/protected-csv-api-contract/SKILL.md` al tocar carga protegida de CSV en `server/index.js` o `src/hooks/useConsumoData.ts`.
- `Skills/dashboard-metrics-and-filters/SKILL.md` al tocar filtros, KPIs o agregaciones del dashboard.

## Zonas sensibles

- `src/`: leer `src/AGENTS.md`.
- `server/`: leer `server/AGENTS.md`.
- `src/data/`: leer `src/data/AGENTS.md`.
- `Skills/`: leer `Skills/AGENTS.md`.

## Cierre minimo

- La documentacion debe reflejar el estado real del repo.
- Las skills deben validar con `./scripts/validate-skills.sh`.
