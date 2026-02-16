#!/bin/bash
# Stop hook: validates work state before Claude stops
# Exit 0 = allow stop (advisory warnings only)
# Exit 2 = block stop (lint errors in uncommitted changes)

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"

# 1. Check for uncommitted TS/TSX files with ESLint errors
CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
STAGED_FILES=$(git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
ALL_CHANGED=$(echo -e "${CHANGED_FILES}\n${STAGED_FILES}" | sort -u | grep -v '^$' || true)

if [[ -n "$ALL_CHANGED" ]]; then
  LINT_ERRORS=""
  while IFS= read -r file; do
    if [[ -f "$PROJECT_DIR/$file" ]]; then
      # Only check for errors (exit code 1), not warnings
      RESULT=$(cd "$PROJECT_DIR" && npx eslint "$file" --quiet --format compact 2>/dev/null || true)
      if [[ -n "$RESULT" ]] && echo "$RESULT" | grep -q "Error"; then
        LINT_ERRORS+="  $file\n"
      fi
    fi
  done <<< "$ALL_CHANGED"

  if [[ -n "$LINT_ERRORS" ]]; then
    echo "Uncommitted files have ESLint errors:" >&2
    echo -e "$LINT_ERRORS" >&2
    echo "Fix these before stopping, or commit with the fixes." >&2
    exit 2
  fi
fi

# 2. Untracked new files in src/ or e2e/ (advisory)
UNTRACKED=$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard -- "src/" "e2e/" 2>/dev/null)
if [[ -n "$UNTRACKED" ]]; then
  COUNT=$(echo "$UNTRACKED" | wc -l | tr -d ' ')
  echo "[Stop] Warning: ${COUNT} untracked file(s) in src/ or e2e/ — may need committing"
fi

# 3. Check for uncommitted changes (advisory)
DIRTY=$(git -C "$PROJECT_DIR" status --porcelain -- "src/" "e2e/" 2>/dev/null | head -5)
if [[ -n "$DIRTY" ]]; then
  echo "[Stop] You have uncommitted changes in src/ or e2e/"
fi

exit 0
