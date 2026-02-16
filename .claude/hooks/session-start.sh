#!/bin/bash
# SessionStart hook: environment health check + context loading
# Advisory only (exit 0) — reports status for Claude's context

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# 1. Docker + DB check
DOCKER_STATUS="✗"
DB_STATUS="✗"
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  DOCKER_STATUS="✓"
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "postgres\|pgvector\|bricktrack"; then
    DB_STATUS="✓"
  fi
fi

# 2. Env var validation
ENV_STATUS="✗"
if [[ -f "$PROJECT_DIR/.env.local" ]]; then
  MISSING=""
  for VAR in DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL; do
    if ! grep -q "^${VAR}=" "$PROJECT_DIR/.env.local" 2>/dev/null; then
      MISSING+=" $VAR"
    fi
  done
  if [[ -z "$MISSING" ]]; then
    ENV_STATUS="✓"
  else
    ENV_STATUS="✗ (missing:$MISSING)"
  fi
fi

echo "[Session] Docker: $DOCKER_STATUS | DB: $DB_STATUS | Env: $ENV_STATUS"

# 3. Git state
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
MODIFIED=$(git -C "$PROJECT_DIR" diff --name-only 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard -- "src/" "e2e/" 2>/dev/null | wc -l | tr -d ' ')
AHEAD=$(git -C "$PROJECT_DIR" rev-list --count @{upstream}..HEAD 2>/dev/null || echo "?")
BEHIND=$(git -C "$PROJECT_DIR" rev-list --count HEAD..@{upstream} 2>/dev/null || echo "?")
echo "[Session] Branch: $BRANCH | ${MODIFIED} modified | ${UNTRACKED} untracked in src/ & e2e/ | ↑${AHEAD} ↓${BEHIND}"

# 4. Beads task summary
if command -v bd &>/dev/null; then
  READY_COUNT=$(bd ready 2>/dev/null | grep -c "^[0-9]" || echo "0")
  echo "[Session] Beads: ${READY_COUNT} tasks ready"
else
  echo "[Session] Beads: bd not found"
fi

# 5. Progress file check
PROGRESS_FILES=$(find "$PROJECT_DIR" -maxdepth 1 -name "PROGRESS-*.md" 2>/dev/null)
if [[ -n "$PROGRESS_FILES" ]]; then
  for f in $PROGRESS_FILES; do
    echo "[Session] Progress file found: $(basename "$f")"
  done
fi

exit 0
