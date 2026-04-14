---
name: skill-creator
description: >
  Crea o adapta skills reutilizables para este repo usando la estructura
  moderna Skills/<nombre>/SKILL.md. Usar cuando se pida crear una skill,
  copiar una skill de referencia o estandarizar metadata local.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "crear skill"
    - "adaptar skill"
    - "copiar skill de referencia"
  owner: repo-maintainers
  skill_type: encoded_preference
  risk_level: low
  allowed_tools:
    - read
    - glob
    - apply_patch
---

# skill-creator

## Problema que resuelve

Evita skills improvisadas o desalineadas con este repo. Su tipo es `encoded_preference` porque fija una convencion estable de estructura y documentacion local.

## Cuando usar

- Crear una skill reusable para este proyecto.
- Adaptar una skill externa al contexto local.
- Normalizar metadata y estructura de `Skills/`.

## Cuando no usar

- Tareas one-off.
- Casos donde alcanza con actualizar `README.md`, `AGENTS.md` o un `AGENTS.md` local.

## Reglas criticas

1. Toda skill activa vive en `Skills/<skill-name>/SKILL.md`.
2. La descripcion debe decir que hace y cuando se activa.
3. Si la skill refleja una preferencia estable del repo, usar `encoded_preference`.
4. Si agrega capacidad temporal del modelo, usar `capability_uplift` y declarar `review_by`.
5. Si se crea o modifica una skill, actualizar referencias en `README.md`, `AGENTS.md` y `Skills/AGENTS.md` cuando corresponda.

## Frontmatter minimo

```yaml
---
name: <skill-name>
description: >
  Que hace la skill y en que contexto debe activarse.
license: Apache-2.0
metadata:
  author: consumo-hojas-dashboard
  version: "1.0.0"
  scope:
    - root
  auto_invoke:
    - "contexto o accion"
  owner: repo-maintainers
  skill_type: capability_uplift # capability_uplift|encoded_preference
  review_by: "YYYY-MM-DD" # obligatorio si es capability_uplift
  sunset_at: null
  risk_level: low # low|medium|high
  allowed_tools: []
---
```

## Checklist rapido

- [ ] El nombre esta en kebab-case.
- [ ] La skill es reutilizable y no un one-off.
- [ ] El frontmatter esta completo.
- [ ] `skill_type` esta bien elegido.
- [ ] Si es `capability_uplift`, tiene `review_by`.
- [ ] Las rutas usan `Skills/` con mayuscula.
- [ ] Las referencias del repo quedaron sincronizadas.

## Comando util

```bash
./scripts/validate-skills.sh
```
