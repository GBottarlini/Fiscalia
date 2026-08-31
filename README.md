# Consumo Hojas Dashboard

Dashboard web para visualizar consumo de resmas por oficina, comparar periodos y exponer equivalencias de impacto. El frontend corre con React + Vite y consume un backend Express liviano que protege datos y chat con JWT.

## Stack real

- Frontend: React 19 + Vite 7.
- Backend: Express 4 reutilizable en `server/app.js`, servido localmente por `server/index.js` y en produccion por Netlify Functions.
- Datos: filesystem local en desarrollo y un store site-wide de Netlify Blobs en produccion; `src/data/` conserva las seeds versionadas.
- Graficos: `recharts`.
- Calidad disponible: ESLint con `npm run lint` y tests enfocados con `npm test`.

## Que hace la app

- Login de administrador contra `POST /api/auth/login`.
- Verificacion de sesion con `GET /api/auth/me`.
- Consulta protegida de CSV de oficinas y consumo.
- Carga mensual protegida de consumo con validacion contra oficinas y contrato CSV.
- Dashboard con KPIs, ranking, tendencia mensual, metas y equivalencias.
- Chat contextual "Fisqui" via OpenAI Responses API en `POST /api/chat` cuando existe `OPENAI_API_KEY`.

## Estructura util

- `src/App.jsx` - shell principal, autenticacion, filtros y composicion del dashboard.
- `src/components/` - tarjetas, graficos, filtros y chat.
- `src/components/AdminConsumoForm.jsx` - panel admin para cargar o actualizar consumo mensual.
- `src/hooks/useConsumoData.ts` - carga de datos protegidos.
- `src/lib/data.ts` - transformaciones y agregaciones de consumo.
- `src/lib/auth.ts` - manejo de token en `localStorage`.
- `server/app.js` - API Express, login JWT, endpoints CSV y proxy al chat, sin iniciar listener al importarse.
- `server/openai.js` - cliente HTTP aislado para OpenAI Responses API, con timeout, reintento acotado y extraccion segura de texto.
- `server/chat.js` - validacion de preguntas, allowlist del contexto agregado y reglas del prompt.
- `server/index.js` - entrypoint del servidor local.
- `server/storage.js` - adapters de filesystem local y Netlify Blobs.
- `netlify/functions/api.mjs` y `netlify.toml` - entrypoint y routing same-origin de `/api/*`.
- `src/data/` - seeds CSV versionadas para inicializar storage ausente sin sobrescribir datos existentes.
- `docs/netlify-migration.md` - corte, respaldo, importacion, verificacion y rollback.
- `docs/chat-operations.md` - privacidad, operacion, smoke test y diagnostico de Fisqui.
- `AGENTS.md` - reglas globales y jerarquia documental para agentes.
- `src/AGENTS.md` y `server/AGENTS.md` - guardrails locales para frontend y backend.
- `src/data/AGENTS.md` - reglas para tocar CSV y estructura de datos.
- `Skills/AGENTS.md` - convenciones para skills y referencias documentales.
- `Skills/` - skills locales reutilizables para documentar, curar CSV y preservar contratos reales del repo.

## Variables de entorno

Backend (`server/app.js`, `server/index.js` y `server/storage.js`):

- `PORT` - puerto del server; default `3001`.
- `CORS_ORIGIN` - origen permitido; default `http://localhost:5173`. Acepta varios origenes separados por coma y normaliza barras finales.
- `ADMIN_EMAIL` - usuario administrador.
- `ADMIN_PASSWORD_HASH` - hash `salt:hash` para `crypto.scryptSync`.
- `JWT_SECRET` - secreto para firmar y validar JWT.
- `OPENAI_API_KEY` - habilita `POST /api/chat`.
- `OPENAI_MODEL` - modelo de Responses API; default `gpt-4o-mini`.
- `DATA_DIR` - directorio de CSV editable para el servidor local; default `src/data`. No se usa en Netlify Functions.
- `CONTEXT` - Netlify lo define por contexto de deploy. Solo `production` puede inicializar o escribir el store site-wide.

Frontend:

- `VITE_API_URL` - base URL del backend; si no existe usa mismo origen.
  En Netlify debe quedar sin definir para que las llamadas existentes usen `/api/*` en el mismo origen.

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
npm test
node scripts/generate-password-hash.mjs "Fiscalia2026"
./scripts/validate-skills.sh
```

## Despliegue en Netlify

`netlify.toml` construye el frontend en `dist`, empaqueta `netlify/functions/api.mjs` y redirige `/api/*` a esa Function sin cambiar las URLs del frontend. La Function reutiliza la app Express sin abrir un listener y persiste en un store site-wide de Netlify Blobs llamado `fiscalia-csv`.

- Las claves actuales son `oficinas.csv`, `consumo_resmas.csv` y `consumo_resmas_2026.csv`.
- Todas las lecturas de Blobs usan consistencia fuerte.
- Una clave ausente se inicializa desde los bytes exactos de `src/data/` con `onlyIfNew`; nunca se pisa una clave existente con una seed.
- Cada escritura usa ETag + `onlyIfMatch`, crea primero un snapshot versionado y devuelve `CSV_WRITE_CONFLICT` si pierde una carrera.
- Los deploy previews comparten el store site-wide, pero quedan en modo solo lectura mediante el `CONTEXT` provisto por Netlify.
- `/api/health` debe responder `{"ok":true,...,"storage":"netlify-blobs"}` en produccion.

Configurar `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `OPENAI_API_KEY` opcional y `OPENAI_MODEL` opcional exclusivamente en la interfaz privada de Netlify, con alcance para Functions. No incluir credenciales en archivos o comandos compartidos. El procedimiento completo para exportar Render, registrar checksums/filas, importar bytes exactos, cortar trafico, verificar y conservar rollback esta en [`docs/netlify-migration.md`](docs/netlify-migration.md).

## Privacidad y operacion de Fisqui

`POST /api/chat` conserva proteccion JWT y envia a OpenAI solamente la pregunta del administrador y una allowlist acotada de metricas agregadas de los filtros actuales. No envia filas CSV, credenciales, JWT, secretos, variables de entorno ni contexto arbitrario del navegador. Las solicitudes usan `store: false`, un limite de salida, timeout estricto y como maximo un reintento para fallas transitorias.

Antes de habilitar Fisqui en produccion, configurar alertas de uso y presupuesto en la cuenta de OpenAI y alertas operativas de Functions en Netlify. Revisar consumo despues de cambiar `OPENAI_MODEL`, porque precio, limites y latencia dependen del modelo. El smoke test, los codigos estables y el procedimiento de diagnostico estan en [`docs/chat-operations.md`](docs/chat-operations.md).

`render.yaml` se conserva marcado como legado solo durante la ventana de rollback. No debe aplicarse como destino activo ni usarse para borrar o mutar recursos productivos de Render.

## Operacion con agentes

- `AGENTS.md` define jerarquia de fuentes, reglas obligatorias y skills auto-invocables.
- Los `AGENTS.md` locales agregan restricciones concretas por zona sensible sin cambiar el comportamiento de la app.
- `Skills/skill-creator/SKILL.md` sirve para crear skills nuevas sin romper la estructura local.
- `Skills/skill-sync/SKILL.md` sirve para auditar referencias, metadata y coherencia documental.
- `Skills/csv-contract-and-curation/SKILL.md` fija encabezados, nombres de archivo y criterios de curacion para `src/data/`.
- `Skills/protected-csv-api-contract/SKILL.md` documenta el contrato entre `server/app.js`, `server/storage.js` y `src/hooks/useConsumoData.ts`.
- `Skills/dashboard-metrics-and-filters/SKILL.md` documenta filtros, agregaciones y metricas derivadas del dashboard.

## Carga mensual de resmas

El administrador puede cargar consumos desde el panel `Carga mensual` despues de iniciar sesion.

- Guarda contra `POST /api/data/consumo` con el mismo JWT usado por el dashboard.
- Valida `fecha` (`YYYY-MM-DD`), deriva `mes` (`YYYY-MM`), valida `codigo_oficina` existente en `oficinas.csv`, `tipo_hoja` (`A4` u `OFICIO`) y `resmas > 0`.
- Deriva el nombre de oficina desde `oficinas.csv` para evitar inconsistencias manuales.
- Si ya existe una fila para `mes + codigo_oficina + tipo_hoja`, responde conflicto salvo que el panel envie modo actualizacion.
- Escribe mediante el adapter activo: filesystem local o Netlify Blobs. Para años anteriores a 2026 usa `consumo_resmas.csv` y para 2026 o posteriores usa `consumo_resmas_2026.csv`, preservando encabezados y orden de filas.
- En Netlify, una escritura concurrente que parte de un ETag obsoleto no se reintenta ni pisa datos: devuelve `409` con `CSV_WRITE_CONFLICT`.
- Tras guardar, el frontend recarga los CSV y recalcula KPIs, ranking y graficos.

## Flujo documental recomendado

Antes de proponer cambios documentales u operativos:

- leer `README.md`, `AGENTS.md` y los `AGENTS.md` locales de la zona afectada.
- verificar comandos reales en `package.json` y variables o endpoints reales en `server/app.js`, `server/index.js` y `server/storage.js`.
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
npm test
npm run build
./scripts/validate-skills.sh
```
