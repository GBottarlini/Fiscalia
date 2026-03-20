---
name: dashboard-metrics-and-filters
description: >
  Conserva el flujo real de filtros y metricas derivadas del dashboard.
  Usar al tocar `src/App.jsx`, `src/lib/data.ts` o componentes de filtros, ranking y tendencia.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "tocar metricas dashboard"
    - "cambiar filtros"
    - "ajustar kpis"
  owner: repo-maintainers
  skill_type: encoded_preference
  risk_level: low
  allowed_tools:
    - read
    - glob
    - apply_patch
---

# dashboard-metrics-and-filters

## Cuando usar

- Editar `src/App.jsx`, `src/components/FilterBar.jsx`, `src/components/RankingChart.jsx` o `src/components/MonthlyTrend.jsx`.
- Cambiar agregaciones en `src/lib/data.ts`.
- Documentar como se calculan KPIs, ranking, serie mensual y resumen ejecutivo.

## Flujo real del dashboard

1. Filtros base en `src/App.jsx`: `ano`, `tipoHoja`, `oficina`.
2. Defaults actuales: `tipoHoja="TODOS"`, `oficina=""` y `ano` toma el ultimo valor de `anos`.
3. `consumosFiltrados` filtra por prefijo de `mes`, igualdad exacta de `tipo_hoja` y `codigo_oficina`.
4. KPIs salen de `sumResmas`, `totalesPorOficina` y `totalesPorMes` sobre la coleccion ya filtrada.

## Derivaciones sensibles

- `Promedio mensual` = `totalResmas / meses.length`.
- `Top oficina` y ranking usan `codigo_oficina` como clave y luego resuelven nombre con `oficinas.csv`.
- `GoalProgress` toma el ultimo mes con datos y fija meta en `avg * 0.9`.
- `Resumen ejecutivo` usa ahorro posible del `10%` sobre `kpis.totalResmas`.

## Guardrails

- No mover logica de filtros a contratos distintos sin revisar `FilterBar`, `ChatBot` y cards derivadas.
- Si cambias una agregacion, revisar impacto en ranking, tendencia, top oficina, pico mensual y contexto enviado a `POST /api/chat`.
- Mantener alineados nombres de campos: `mes`, `codigo_oficina`, `tipo_hoja`, `resmas`.

## Chequeos rapidos

```bash
./scripts/validate-skills.sh
```
