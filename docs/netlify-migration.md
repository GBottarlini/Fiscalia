# Migracion operativa de Render a Netlify

La API activa pasa a ejecutarse como Netlify Function y los tres CSV completos pasan a un unico store site-wide de Netlify Blobs llamado `fiscalia-csv`. `render.yaml` queda solamente como referencia de rollback durante la aceptacion. Esta migracion del repositorio NO modifica ni elimina recursos o datos de Render.

## Contrato de almacenamiento

- Claves actuales: `oficinas.csv`, `consumo_resmas.csv` y `consumo_resmas_2026.csv`.
- Las lecturas usan consistencia fuerte para evitar la propagacion eventual de hasta 60 segundos.
- Si una clave no existe en produccion, se inicializa una sola vez con los bytes exactos de `src/data/<archivo>` mediante `onlyIfNew`. Una clave existente nunca se reemplaza con una seed.
- Las escrituras leen el ETag y reemplazan mediante `onlyIfMatch`. Si otro request escribio primero, la API responde `409` con `CSV_WRITE_CONFLICT`; no hay reintentos ilimitados.
- Antes de intentar el reemplazo se crea `backups/<archivo>/<timestamp>-<uuid>` con la version anterior. El snapshot y el reemplazo NO son transaccionales: un conflicto puede dejar un snapshot valido aunque la clave actual no haya sido reemplazada.
- Los stores site-wide se comparten entre produccion y deploy previews. Por eso, los contextos distintos de `production` pueden leer pero no inicializar ni escribir Blobs.

## Procedimiento seguro de corte

1. Congelar temporalmente las cargas administrativas o coordinar una ventana sin escrituras.
2. Antes de desplegar, descargar/exportar desde el servicio Render activo los tres CSV completos. No borrar ni mutar los originales.
3. Para cada archivo exportado, registrar checksum SHA-256, cantidad de bytes y cantidad de filas de datos. Guardar los archivos y el registro fuera del repositorio, en una ubicacion privada y controlada.
4. Comparar los exportados con las seeds versionadas. Si Render contiene datos mas nuevos, importar esos bytes exactos en las tres claves del store site-wide `fiscalia-csv` desde la interfaz de Netlify antes de habilitar trafico de produccion. No parsear, ordenar, deduplicar ni reformatear los CSV durante la importacion.
5. Si no existe informacion productiva mas nueva o se confirma que Render nunca recibio cargas que deban conservarse, dejar las claves ausentes: la primera lectura productiva las inicializara desde `src/data/` sin sobrescribir una clave creada en paralelo.
6. Configurar en la interfaz privada de Netlify, con alcance de Functions, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY` y `GEMINI_MODEL` opcional. No guardar ni compartir esos valores en el repositorio. `VITE_API_URL` debe quedar sin definir para usar `/api/*` en el mismo origen.
7. Desplegar primero sin trafico administrativo concurrente. Confirmar en los logs de Netlify que la Function carga y que `/api/health` informa `storage: "netlify-blobs"`.
8. Verificar login, `/api/auth/me`, las tres lecturas CSV protegidas, content type `text/csv`, `Cache-Control: no-store, max-age=0`, checksums/filas esperados y una carga controlada. Ejecutar tambien una prueba de dos escrituras con el mismo ETag y comprobar que solo una modifica la clave y la otra recibe `CSV_WRITE_CONFLICT`.
9. Confirmar que un deploy preview no puede escribir ni inicializar claves de produccion.
10. Mantener Render congelado, sin nuevas cargas y sin eliminar recursos, durante el periodo de aceptacion. Para rollback, restaurar el enrutamiento al backend Render y reconciliar cualquier escritura aceptada en Netlify desde los snapshots/CSV antes de reabrir cargas.
11. Eliminar el servicio y disco de Render solamente despues de la aceptacion funcional y de datos, con autorizacion operativa explicita y una copia final verificada. Esa eliminacion queda fuera de esta implementacion.

## Comprobaciones reproducibles

Estas herramientas forman parte del sistema operativo y no requieren credenciales:

```bash
sha256sum oficinas.csv consumo_resmas.csv consumo_resmas_2026.csv
wc -c oficinas.csv consumo_resmas.csv consumo_resmas_2026.csv
node --input-type=module -e 'import { readFileSync } from "node:fs"; import Papa from "papaparse"; for (const file of process.argv.slice(1)) { const parsed = Papa.parse(readFileSync(file, "utf8"), { header: true, skipEmptyLines: true }); if (parsed.errors.length) throw new Error(`${file}: ${parsed.errors[0].message}`); console.log(`${file}: ${parsed.data.length} filas`); }' oficinas.csv consumo_resmas.csv consumo_resmas_2026.csv
```

El comando de filas usa `papaparse`, dependencia instalada por el proyecto, para respetar campos entrecomillados y saltos internos; no usar `wc -l` como prueba definitiva. La importacion y consulta del store debe realizarse desde la interfaz de Netlify porque este repositorio no instala ni fija una version de Netlify CLI para ese flujo.
