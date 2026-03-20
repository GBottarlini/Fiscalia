---
name: protected-csv-api-contract
description: >
  Mantiene estable el contrato de endpoints protegidos que entregan CSV al frontend.
  Usar al tocar `server/index.js`, `src/hooks/useConsumoData.ts` o auth de carga de datos.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "tocar api csv"
    - "cambiar carga protegida"
    - "ajustar useConsumoData"
  owner: repo-maintainers
  skill_type: encoded_preference
  risk_level: low
  allowed_tools:
    - read
    - glob
    - apply_patch
---

# protected-csv-api-contract

## Cuando usar

- Cambiar endpoints `/api/data/*` o `requireAuth` en `server/index.js`.
- Ajustar `src/hooks/useConsumoData.ts` o `src/lib/auth.ts`.
- Documentar el contrato entre backend protegido y parsing CSV del frontend.

## Contrato actual

1. `GET /api/data/oficinas` -> `text/csv` de `src/data/oficinas.csv`.
2. `GET /api/data/consumo` -> `text/csv` de `src/data/consumo_resmas.csv`.
3. `GET /api/data/consumo_2026` -> `text/csv` de `src/data/consumo_resmas_2026.csv`.
4. Los tres endpoints pasan por `requireAuth` y esperan `Authorization: Bearer <token>`.
5. `useConsumoData` hace `Promise.all(...)`, parsea con `loadCsv(...)` y luego concatena + normaliza ambos CSV de consumo.

## Guardrails

- No cambiar paths, metodo HTTP, formato `text/csv` ni shape de errores sin pedido explicito.
- Si tocas auth, preservar `POST /api/auth/login` y `GET /api/auth/me` porque gatean toda la carga.
- Si agregas o renombras una fuente CSV, el frontend y esta doc deben actualizarse juntos.
- Cualquier cambio de contrato debe revisar `src/lib/data.ts` y `src/hooks/useConsumoData.ts`.

## Chequeos rapidos

```bash
./scripts/validate-skills.sh
```
