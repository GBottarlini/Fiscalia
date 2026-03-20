#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${VALIDATE_SKILLS_ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

errors=0
warnings=0

log_info() {
  printf '[INFO] %s\n' "$1"
}

log_warn() {
  warnings=$((warnings + 1))
  printf '[WARN] %s\n' "$1"
}

log_error() {
  errors=$((errors + 1))
  printf '[ERROR] %s\n' "$1"
}

extract_frontmatter() {
  local file="$1"
  awk '
    NR == 1 {
      if ($0 != "---") {
        invalid_start = 1
        exit 2
      }
      in_frontmatter = 1
      next
    }

    in_frontmatter {
      if ($0 == "---") {
        found_end = 1
        exit 0
      }
      print
      next
    }

    END {
      if (!invalid_start && !found_end) {
        exit 3
      }
    }
  ' "$file"
}

has_field_in_frontmatter() {
  local frontmatter="$1"
  local field_regex="$2"
  if ! printf '%s\n' "$frontmatter" | grep -Eq "$field_regex"; then
    return 1
  fi
}

extract_skill_type() {
  local frontmatter="$1"
  local value
  value="$(printf '%s\n' "$frontmatter" | awk '
    /^[[:space:]]*skill_type:[[:space:]]*/ {
      sub(/^[^:]+:[[:space:]]*/, "", $0)
      gsub(/"/, "", $0)
      print
      exit
    }
  ')"
  printf '%s' "$value"
}

find_modern_skills() {
  if [[ ! -d "$ROOT_DIR/Skills" ]]; then
    return
  fi

  find "$ROOT_DIR/Skills" -mindepth 2 -maxdepth 2 -type f -name 'SKILL.md' | sort
}

find_markdown_docs() {
  find "$ROOT_DIR" \
    \( -type d \( -name .git -o -name node_modules -o -name dist -o -name build \) -prune \) -o \
    \( -type f -name '*.md' -print \) | sort
}

check_core_docs() {
  local required=(
    "$ROOT_DIR/AGENTS.md"
    "$ROOT_DIR/README.md"
    "$ROOT_DIR/src/AGENTS.md"
    "$ROOT_DIR/server/AGENTS.md"
    "$ROOT_DIR/src/data/AGENTS.md"
    "$ROOT_DIR/Skills/AGENTS.md"
  )

  local file
  for file in "${required[@]}"; do
    if [[ ! -f "$file" ]]; then
      log_error "Falta archivo requerido: $file"
    fi
  done
}

check_modern_skills() {
  local modern_files
  modern_files="$(find_modern_skills)"

  if [[ -z "$modern_files" ]]; then
    log_error "No se encontraron skills modernas en Skills/*/SKILL.md"
    return
  fi

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    log_info "Validando $file"

    local frontmatter status
    status=0
    frontmatter="$(extract_frontmatter "$file")" || status=$?

    if [[ "$status" -ne 0 ]]; then
      if [[ "$status" -eq 2 ]]; then
        log_error "$file: falta frontmatter YAML inicial (debe empezar con ---)"
      else
        log_error "$file: frontmatter YAML corrupto o sin cierre ---"
      fi
      continue
    fi

    has_field_in_frontmatter "$frontmatter" '^name:[[:space:]]+' || log_error "$file: falta name"
    has_field_in_frontmatter "$frontmatter" '^description:[[:space:]]*' || log_error "$file: falta description"
    has_field_in_frontmatter "$frontmatter" '^license:[[:space:]]+' || log_error "$file: falta license"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*author:[[:space:]]+' || log_error "$file: falta metadata.author"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*version:[[:space:]]+' || log_error "$file: falta metadata.version"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*scope:[[:space:]]*' || log_error "$file: falta metadata.scope"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*auto_invoke:[[:space:]]*' || log_error "$file: falta metadata.auto_invoke"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*owner:[[:space:]]+' || log_error "$file: falta metadata.owner"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*risk_level:[[:space:]]+' || log_error "$file: falta metadata.risk_level"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*allowed_tools:[[:space:]]*' || log_error "$file: falta metadata.allowed_tools"
    has_field_in_frontmatter "$frontmatter" '^[[:space:]]*skill_type:[[:space:]]+' || log_error "$file: falta metadata.skill_type"

    local skill_type
    skill_type="$(extract_skill_type "$frontmatter")"
    if [[ "$skill_type" != "capability_uplift" && "$skill_type" != "encoded_preference" ]]; then
      log_error "$file: skill_type invalido ($skill_type)"
      continue
    fi

    if [[ "$skill_type" == "capability_uplift" ]]; then
      has_field_in_frontmatter "$frontmatter" '^[[:space:]]*review_by:[[:space:]]+' || log_error "$file: capability_uplift requiere review_by"
    fi
  done <<< "$modern_files"
}

check_doc_references() {
  local required_refs=(
    'Skills/skill-creator/SKILL.md'
    'Skills/skill-sync/SKILL.md'
    'Skills/csv-contract-and-curation/SKILL.md'
    'Skills/protected-csv-api-contract/SKILL.md'
    'Skills/dashboard-metrics-and-filters/SKILL.md'
  )
  local docs=(
    "$ROOT_DIR/AGENTS.md"
    "$ROOT_DIR/README.md"
    "$ROOT_DIR/Skills/AGENTS.md"
  )

  local ref doc
  for ref in "${required_refs[@]}"; do
    if [[ ! -f "$ROOT_DIR/$ref" ]]; then
      log_error "Falta skill referenciada: $ROOT_DIR/$ref"
    fi
  done

  for doc in "${docs[@]}"; do
    [[ ! -f "$doc" ]] && continue
    grep -q 'Skills/' "$doc" || log_warn "$doc: no menciona Skills/"
  done
}

check_lowercase_skills_paths() {
  local search_files
  search_files="$(find_markdown_docs)"

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    local matches
    matches=$(grep -nE '`skills/|\bskills/' "$file" || true)
    if [[ -z "$matches" ]]; then
      continue
    fi

    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      log_error "$file: contiene referencia en minuscula a skills/ -> $line"
    done <<< "$matches"
  done <<< "$search_files"
}

main() {
  log_info "Validando skills en $ROOT_DIR"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log_info "Modo dry-run activo (solo auditoria)"
  fi

  check_core_docs
  check_modern_skills
  check_doc_references
  check_lowercase_skills_paths

  printf '\n'
  printf 'Resumen: %s error(es), %s warning(s)\n' "$errors" "$warnings"

  if [[ "$errors" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
