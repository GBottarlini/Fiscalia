---
name: protected-csv-api-contract
description: >
  Mantiene estable el contrato de endpoints protegidos que entregan CSV al frontend.
  Usar al tocar `server/app.js`, `server/storage.js`, `src/hooks/useConsumoData.ts` o auth de carga de datos.
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

- Cambiar endpoints `/api/data/*` o `requireAuth` en `server/app.js`.
- Ajustar `src/hooks/useConsumoData.ts` o `src/lib/auth.ts`.
- Documentar el contrato entre backend protegido y parsing CSV del frontend.

## Contrato actual

1. `GET /api/data/oficinas` -> `text/csv` de `oficinas.csv` desde el adapter de storage activo.
2. `GET /api/data/consumo` -> `text/csv` de `consumo_resmas.csv` desde el adapter de storage activo.
3. `GET /api/data/consumo_2026` -> `text/csv` de `consumo_resmas_2026.csv` desde el adapter de storage activo.
4. `POST /api/data/consumo` -> JSON protegido para crear o actualizar una fila mensual de consumo.
5. Los endpoints de datos pasan por `requireAuth` y esperan `Authorization: Bearer <token>`.
6. `useConsumoData` hace `Promise.all(...)`, parsea con `loadCsv(...)` y luego concatena + normaliza ambos CSV de consumo.

## Contrato de escritura mensual

- Body esperado: `fecha`, `codigo_oficina`, `tipo_hoja`, `resmas`, `mode` opcional (`create` o `update`) y `mes` opcional si se necesita enviar explicitamente.
- `fecha` debe ser `YYYY-MM-DD`; el backend deriva `mes` como `YYYY-MM`; `tipo_hoja` solo acepta `A4` u `OFICIO`; `resmas` debe ser mayor a 0.
- `codigo_oficina` se valida contra `src/data/oficinas.csv` y el backend deriva `oficina`.
- Si ya existe `mes + codigo_oficina + tipo_hoja`, `create` devuelve `409`; `update` reemplaza esa fila.
- En desarrollo local, el backend escribe en `DATA_DIR` si esta configurado; si no, usa `src/data/`.
- En Netlify Functions usa un store site-wide de Netlify Blobs con lecturas fuertes. Inicializa una clave ausente desde los bytes versionados de `src/data/` mediante `onlyIfNew`.
- Cada reemplazo en Blobs usa el ETag leido y `onlyIfMatch`. Una carrera devuelve `409` con `code: "CSV_WRITE_CONFLICT"`; los deploy previews son de solo lectura.
- Escribe en `consumo_resmas.csv` para años menores a 2026 y en `consumo_resmas_2026.csv` para 2026 o posteriores.

## Guardrails

- No cambiar paths, metodos HTTP, formato `text/csv` de lectura ni shape de errores sin pedido explicito.
- Si tocas auth, preservar `POST /api/auth/login` y `GET /api/auth/me` porque gatean toda la carga.
- Si agregas o renombras una fuente CSV, el frontend, `DATA_FILES` en `server/storage.js`, `netlify.toml` y esta doc deben actualizarse juntos.
- Cualquier cambio de contrato debe revisar `src/lib/data.ts` y `src/hooks/useConsumoData.ts`.

## Chequeos rapidos

```bash
./scripts/validate-skills.sh
```
