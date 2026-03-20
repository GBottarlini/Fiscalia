# Consumo Hojas Dashboard

Dashboard web para visualizar consumo de resmas por oficina, comparar periodos y exponer equivalencias de impacto. El frontend corre con React + Vite y consume un backend Express liviano que protege datos y chat con JWT.

## Stack real

- Frontend: React 19 + Vite 7.
- Backend: Express 4 en `server/index.js`.
- Datos: CSV locales en `src/data/`.
- Graficos: `recharts`.
- Calidad disponible: ESLint con `npm run lint`.

## Que hace la app

- Login de administrador contra `POST /api/auth/login`.
- Verificacion de sesion con `GET /api/auth/me`.
- Consulta protegida de CSV de oficinas y consumo.
- Dashboard con KPIs, ranking, tendencia mensual, metas y equivalencias.
- Chat contextual "Fisqui" via `POST /api/chat` cuando existe `OPENAI_API_KEY`.

## Estructura util

- `src/App.jsx` - shell principal, autenticacion, filtros y composicion del dashboard.
- `src/components/` - tarjetas, graficos, filtros y chat.
- `src/hooks/useConsumoData.ts` - carga de datos protegidos.
- `src/lib/data.ts` - transformaciones y agregaciones de consumo.
- `src/lib/auth.ts` - manejo de token en `localStorage`.
- `server/index.js` - API Express, login JWT y proxy al chat.
- `src/data/` - archivos CSV versionados usados por la app.
- `AGENTS.md` - reglas globales y jerarquia documental para agentes.
- `src/AGENTS.md` y `server/AGENTS.md` - guardrails locales para frontend y backend.
- `src/data/AGENTS.md` - reglas para tocar CSV y estructura de datos.
- `Skills/AGENTS.md` - convenciones para skills y referencias documentales.
- `Skills/` - skills locales reutilizables para documentar, curar CSV y preservar contratos reales del repo.

## Variables de entorno

Backend (`server/index.js`):

- `PORT` - puerto del server; default `3001`.
- `CORS_ORIGIN` - origen permitido; default `http://localhost:5173`.
- `ADMIN_EMAIL` - usuario administrador.
- `ADMIN_PASSWORD_HASH` - hash `salt:hash` para `crypto.scryptSync`.
- `JWT_SECRET` - secreto para firmar y validar JWT.
- `OPENAI_API_KEY` - habilita `POST /api/chat`.

Frontend:

- `VITE_API_URL` - base URL del backend; si no existe usa mismo origen.

## Desarrollo local

```bash
npm install
npm run dev:all
```

Comandos utiles:

```bash
npm run dev
npm run dev:server
npm run lint
./scripts/validate-skills.sh
```

## Operacion con agentes

- `AGENTS.md` define jerarquia de fuentes, reglas obligatorias y skills auto-invocables.
- Los `AGENTS.md` locales agregan restricciones concretas por zona sensible sin cambiar el comportamiento de la app.
- `Skills/skill-creator/SKILL.md` sirve para crear skills nuevas sin romper la estructura local.
- `Skills/skill-sync/SKILL.md` sirve para auditar referencias, metadata y coherencia documental.
- `Skills/csv-contract-and-curation/SKILL.md` fija encabezados, nombres de archivo y criterios de curacion para `src/data/`.
- `Skills/protected-csv-api-contract/SKILL.md` documenta el contrato entre `server/index.js` y `src/hooks/useConsumoData.ts`.
- `Skills/dashboard-metrics-and-filters/SKILL.md` documenta filtros, agregaciones y metricas derivadas del dashboard.

## Flujo documental recomendado

Antes de proponer cambios documentales u operativos:

- leer `README.md`, `AGENTS.md` y los `AGENTS.md` locales de la zona afectada.
- verificar comandos reales en `package.json` y variables o endpoints reales en `server/index.js`.
- confirmar si la tarea es documental/operativa o funcional para no tocar stack, auth, endpoints ni CSV por error.

Al editar docs o skills:

- actualizar primero la fuente canonica mas cercana al cambio.
- evitar duplicar reglas entre `README.md`, `AGENTS.md` y `Skills/`.
- mantener rutas reales con `Skills/` en mayuscula.
- cargar la skill local mas cercana al cambio cuando exista una para esa zona o contrato.

Convencion local para skills:

- ubicacion canonica: `Skills/<skill-name>/SKILL.md`.
- tipos permitidos: `capability_uplift` y `encoded_preference`.
- `capability_uplift` requiere `review_by`.
- despues de tocar skills o referencias relacionadas, correr `./scripts/validate-skills.sh`.

## Regla de alcance

Este repo no usa esta documentacion para refactorizar comportamiento por defecto. Si una tarea pide docs, skills o flujo operativo, preservar stack, endpoints, auth y estructura funcional existente salvo pedido explicito.

## Validacion minima

Antes de cerrar cambios de documentacion u operaciones con agentes:

```bash
npm run lint
./scripts/validate-skills.sh
```
