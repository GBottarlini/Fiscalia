# AGENTS.md

Reglas locales para `src/`.

- Preservar UX, flujo y shape de props del dashboard salvo pedido explicito.
- No romper contratos del backend ni campos esperados desde `src/data/`.
- Reusar `src/lib/` y `src/hooks/` antes de sumar capas nuevas.
- Si tocás auth o carga de datos, validar compatibilidad con `server/index.js`.
- Si tocás filtros, KPIs o agregaciones, leer `Skills/dashboard-metrics-and-filters/SKILL.md`.
- Si tocás parsing o CSV, leer `src/data/AGENTS.md`.
