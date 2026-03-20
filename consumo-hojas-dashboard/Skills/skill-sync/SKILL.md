---
name: skill-sync
description: >
  Audita y sincroniza metadata y referencias de skills para mantener
  coherencia entre Skills/*/SKILL.md, README.md, AGENTS.md y los AGENTS locales.
  Usar despues de crear o modificar skills locales.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "sincronizar skills"
    - "validar skills"
    - "actualizar referencias de skills"
  owner: repo-maintainers
  skill_type: encoded_preference
  risk_level: low
  allowed_tools:
    - read
    - glob
    - grep
    - apply_patch
---

# skill-sync

## Problema que resuelve

Evita que las skills locales queden desalineadas con la documentacion. Su tipo es `encoded_preference` porque define una rutina estable de auditoria para este repo.

## Cuando usar

- Despues de crear o modificar una skill.
- Cuando `README.md`, `AGENTS.md` o `Skills/AGENTS.md` referencian skills.
- Antes de cerrar mejoras operativas relacionadas con agentes.

## Validaciones obligatorias

1. Estructura moderna: `Skills/<nombre>/SKILL.md`.
2. Metadata minima: `name`, `description`, `license`, `metadata.version`, `metadata.scope`, `metadata.auto_invoke`, `metadata.owner`, `metadata.skill_type`, `metadata.allowed_tools`.
3. Si `skill_type=capability_uplift`, `review_by` es obligatorio.
4. Las rutas documentales apuntan a archivos reales.
5. Las referencias usan `Skills/` con mayuscula.

## Reglas criticas

- No inventar scripts inexistentes; si falta automatizacion, declararlo como pendiente.
- Actualizar solo las secciones afectadas para evitar ruido.
- El objetivo no es sumar texto, sino mantener coherencia verificable.

## Checklist rapido

- [ ] Todas las skills activas usan formato moderno.
- [ ] `AGENTS.md` apunta a skills reales.
- [ ] `README.md`, `AGENTS.md` y `Skills/AGENTS.md` reflejan el flujo real.
- [ ] No hay referencias en minuscula a la carpeta de skills.
- [ ] El validador local termina sin errores.

## Comandos

```bash
./scripts/validate-skills.sh --dry-run
./scripts/validate-skills.sh
```
