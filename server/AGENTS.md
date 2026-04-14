# AGENTS.md

Reglas locales para `server/`.

- Preservar endpoints, middleware JWT y shape de respuestas salvo pedido explicito.
- Usar solo variables de entorno reales de `server/index.js`.
- Mantener `src/data/` como fuente local de CSV.
- Si tocás auth o endpoints de datos, revisar `src/lib/auth.ts`, `src/hooks/useConsumoData.ts` y `Skills/protected-csv-api-contract/SKILL.md`.
- No sumar builds ni procesos nuevos al flujo operativo.
