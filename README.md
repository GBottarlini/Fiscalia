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
- Carga mensual protegida de consumo con validacion contra oficinas y contrato CSV.
- Dashboard con KPIs, ranking, tendencia mensual, metas y equivalencias.
- Chat contextual "Fisqui" via `POST /api/chat` cuando existe `OPENAI_API_KEY`.

## Estructura util

- `src/App.jsx` - shell principal, autenticacion, filtros y composicion del dashboard.
- `src/components/` - tarjetas, graficos, filtros y chat.
- `src/components/AdminConsumoForm.jsx` - panel admin para cargar o actualizar consumo mensual.
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
- `CORS_ORIGIN` - origen permitido; default `http://localhost:5173`. Acepta varios origenes separados por coma y normaliza barras finales.
- `ADMIN_EMAIL` - usuario administrador.
- `ADMIN_PASSWORD_HASH` - hash `salt:hash` para `crypto.scryptSync`.
- `JWT_SECRET` - secreto para firmar y validar JWT.
- `OPENAI_API_KEY` - habilita `POST /api/chat`.
- `DATA_DIR` - directorio de CSV editable; default `src/data`. En Render apunta al disco persistente.
- `PERSISTENT_DISK_MOUNT_PATH` - punto de montaje que el backend verifica en Render; default `/opt/render/project/src/storage`.

Frontend:

- `VITE_API_URL` - base URL del backend; si no existe usa mismo origen.
  En produccion debe ser `https://fiscalia.onrender.com`.

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
node scripts/generate-password-hash.mjs "Fiscalia2026"
./scripts/validate-skills.sh
```

## Despliegue en Render

El repo incluye `render.yaml` para crear un unico Web Service Node/Express llamado `Fiscalia`. El frontend existente se mantiene fuera de este Blueprint (por ejemplo, en Netlify).

El backend usa `DATA_DIR` para leer y escribir CSV. Si `DATA_DIR` apunta a un disco persistente nuevo, al arrancar copia los CSV versionados desde `src/data/` cuando faltan:

- `oficinas.csv`
- `consumo_resmas.csv`
- `consumo_resmas_2026.csv`

Configuracion prevista por `render.yaml` y por un Web Service creado manualmente:

- Branch: `main`
- Root Directory: vacio (al omitir `rootDir`, el Blueprint usa la raiz del repositorio)
- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Plan: `starter` o superior, porque Render no permite discos persistentes en servicios Free.
- Persistent Disk mount path: `/opt/render/project/src/storage`
- `DATA_DIR=/opt/render/project/src/storage/data`
- `PERSISTENT_DISK_MOUNT_PATH=/opt/render/project/src/storage`
- `CORS_ORIGIN=https://estadisticafiscalia.netlify.app`
- En Netlify: `VITE_API_URL=https://fiscalia.onrender.com`

Variables que Render debe pedir o generar para el backend:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH` generado con `node scripts/generate-password-hash.mjs "tu-contraseña"`; no va la contraseña en texto plano.
- `JWT_SECRET`
- `OPENAI_API_KEY` si se quiere habilitar el chat

Notas operativas:

- El nombre publico del backend depende del nombre disponible en Render. Si cambia la URL, actualizar `VITE_API_URL` en el frontend desplegado.
- Para el frontend actual de Netlify, `CORS_ORIGIN` debe incluir exactamente `https://estadisticafiscalia.netlify.app`.
- El Persistent Disk requiere plan pago en Render. En Free, las cargas se pierden en reinicios, suspensiones o redeploys porque el filesystem es efimero.
- En Render, el backend verifica si `DATA_DIR` pertenece a un disco distinto del filesystem efimero. Si no hay un disco real, arranca para mantener disponible el servicio pero informa `storage: "ephemeral"` en `/api/health` y registra una advertencia.
- Cada escritura de consumo se serializa, reemplaza el CSV de forma atomica y conserva la version anterior como `<archivo>.bak` dentro del mismo disco.
- El endpoint de prueba del backend es `/api/health` y debe responder `{"ok":true}`.

## Operacion con agentes

- `AGENTS.md` define jerarquia de fuentes, reglas obligatorias y skills auto-invocables.
- Los `AGENTS.md` locales agregan restricciones concretas por zona sensible sin cambiar el comportamiento de la app.
- `Skills/skill-creator/SKILL.md` sirve para crear skills nuevas sin romper la estructura local.
- `Skills/skill-sync/SKILL.md` sirve para auditar referencias, metadata y coherencia documental.
- `Skills/csv-contract-and-curation/SKILL.md` fija encabezados, nombres de archivo y criterios de curacion para `src/data/`.
- `Skills/protected-csv-api-contract/SKILL.md` documenta el contrato entre `server/index.js` y `src/hooks/useConsumoData.ts`.
- `Skills/dashboard-metrics-and-filters/SKILL.md` documenta filtros, agregaciones y metricas derivadas del dashboard.

## Carga mensual de resmas

El administrador puede cargar consumos desde el panel `Carga mensual` despues de iniciar sesion.

- Guarda contra `POST /api/data/consumo` con el mismo JWT usado por el dashboard.
- Valida `fecha` (`YYYY-MM-DD`), deriva `mes` (`YYYY-MM`), valida `codigo_oficina` existente en `oficinas.csv`, `tipo_hoja` (`A4` u `OFICIO`) y `resmas > 0`.
- Deriva el nombre de oficina desde `oficinas.csv` para evitar inconsistencias manuales.
- Si ya existe una fila para `mes + codigo_oficina + tipo_hoja`, responde conflicto salvo que el panel envie modo actualizacion.
- Escribe en `DATA_DIR` si esta configurado; si no, usa `src/data/`. Para años anteriores a 2026 usa `consumo_resmas.csv` y para 2026 o posteriores usa `consumo_resmas_2026.csv`, preservando encabezados.
- Tras guardar, el frontend recarga los CSV y recalcula KPIs, ranking y graficos.

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
