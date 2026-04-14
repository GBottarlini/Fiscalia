# AGENTS.md

Reglas locales para `src/data/`.

- Tratar los CSV como datos versionados de negocio: no cambiar nombres ni encabezados sin pedido explicito.
- Mantener CSV plano y compatible con el parsing actual de frontend y backend.
- Documentar cualquier correccion de contenido porque impacta KPIs, ranking y comparativas.
- Evitar cambios cosméticos masivos que vuelvan opaca la auditoria.
- Antes de editar CSV, leer `Skills/csv-contract-and-curation/SKILL.md`.
