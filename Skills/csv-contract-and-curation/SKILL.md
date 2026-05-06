---
name: csv-contract-and-curation
description: >
  Preserva y cura los CSV versionados del repo sin romper el parsing actual.
  Usar al editar `src/data/*.csv`, revisar encabezados o documentar calidad de datos.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "editar csv"
    - "curar datos csv"
    - "ajustar src/data"
  owner: repo-maintainers
  skill_type: encoded_preference
  risk_level: low
  allowed_tools:
    - read
    - glob
    - apply_patch
---

# csv-contract-and-curation

## Cuando usar

- Editar `src/data/oficinas.csv`, `src/data/consumo_resmas.csv` o `src/data/consumo_resmas_2026.csv`.
- Auditar encabezados, codigos de oficina o filas que impactan KPIs.
- Documentar una correccion puntual de datos sin cambiar comportamiento.

## Contratos que no se negocian

1. `src/data/oficinas.csv` usa `codigo_oficina,oficina`.
2. `src/data/consumo_resmas*.csv` usan `fecha,mes,oficina,codigo_oficina,tipo_hoja,resmas`.
3. No renombrar archivos ni encabezados sin pedido explicito: `server/index.js` sirve esos nombres exactos desde `DATA_DIR` o `src/data/`.
4. `src/lib/data.ts` filtra filas sin `mes`, sin `codigo_oficina` o con `resmas <= 0` en `normalizeConsumos`.
5. La carga mensual por `POST /api/data/consumo` escribe una fila con esos mismos encabezados y deriva `oficina` desde `oficinas.csv`.
6. `src/data/` sigue siendo la fuente versionada inicial; en despliegues con `DATA_DIR`, el backend copia estos CSV si el directorio editable esta vacio.

## Curacion minima

- Preferir correcciones quirurgicas; no reordenar ni reformatear archivos enteros.
- Mantener `mes` en formato `YYYY-MM` y `resmas` numerico compatible con `toNumberSafe`.
- Si una oficina cambia de etiqueta, validar que `codigo_oficina` siga siendo la clave de cruce con `oficinas.csv`.
- Ojo: una fila con `codigo_oficina` vacio se pierde en el dashboard aunque exista el nombre de oficina.
- Para evitar duplicados funcionales, tratar `mes + codigo_oficina + tipo_hoja` como clave logica de una carga mensual.

## Chequeos rapidos

```bash
./scripts/validate-skills.sh
```
