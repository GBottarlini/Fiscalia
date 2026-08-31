# AGENTS.md

Reglas locales para `server/`.

- Preservar endpoints, middleware JWT y shape de respuestas salvo pedido explicito.
- Usar solo variables de entorno reales de `server/app.js`, `server/index.js`, `server/storage.js` y Netlify.
- Mantener `src/data/` como fuente versionada inicial de CSV. El desarrollo local usa filesystem y `DATA_DIR` opcional; Netlify Functions usa un store site-wide de Netlify Blobs con consistencia fuerte.
- Si tocás auth o endpoints de datos, revisar `src/lib/auth.ts`, `src/hooks/useConsumoData.ts` y `Skills/protected-csv-api-contract/SKILL.md`.
- No iniciar listeners desde modulos importados por Netlify Functions; `server/index.js` es solo el entrypoint local.
- Las escrituras en Blobs requieren ETag y `onlyIfMatch`; no reemplazar esa concurrencia optimista por colas en memoria.
