#!/bin/bash
# Stop hook: extracts session learnings and appends to agent memory
# Advisory only (exit 0) — never blocks stopping

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
DATE=$(date +%Y-%m-%d)
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")

# Skip if no code changes this session
DIFF_STAT=$(git -C "$PROJECT_DIR" diff --stat HEAD 2>/dev/null)
STAGED_STAT=$(git -C "$PROJECT_DIR" diff --cached --stat 2>/dev/null)
if [[ -z "$DIFF_STAT" ]] && [[ -z "$STAGED_STAT" ]]; then
  # Check recent commits (last hour) as proxy for session work
  RECENT=$(git -C "$PROJECT_DIR" log --oneline --since="1 hour ago" 2>/dev/null)
  if [[ -z "$RECENT" ]]; then
    exit 0
  fi
fi

# Categorize changes by domain
CHANGED_FILES=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null)
SERVER_COUNT=$(echo "$CHANGED_FILES" | grep -c "^src/server/" 2>/dev/null || true)
COMPONENT_COUNT=$(echo "$CHANGED_FILES" | grep -c "^src/components/" 2>/dev/null || true)
E2E_COUNT=$(echo "$CHANGED_FILES" | grep -c "^e2e/" 2>/dev/null || true)
HOOK_COUNT=$(echo "$CHANGED_FILES" | grep -c "^\.claude/" 2>/dev/null || true)

# Build entry (max 5 lines)
ENTRY="\n## ${DATE} — ${BRANCH}\n"
ENTRY+="- Files changed: ${SERVER_COUNT} server, ${COMPONENT_COUNT} components, ${E2E_COUNT} e2e, ${HOOK_COUNT} claude config\n"

# Check recent commits for patterns
RECENT_MSGS=$(git -C "$PROJECT_DIR" log --oneline --since="2 hours ago" 2>/dev/null | head -5)
if [[ -n "$RECENT_MSGS" ]]; then
  ENTRY+="- Recent commits: $(echo "$RECENT_MSGS" | head -3 | tr '\n' '; ')\n"
fi

# Dead rule detection — check CLAUDE.md file references
DEAD_REFS=""
for CLAUDE_FILE in $(find "$PROJECT_DIR" -name "CLAUDE.md" -not -path "*/node_modules/*" 2>/dev/null); do
  # Extract backtick-quoted file paths that look like src/ or e2e/ paths
  REFS=$(grep -oE '`(src/[^`]+|e2e/[^`]+)`' "$CLAUDE_FILE" 2>/dev/null | tr -d '`' | sort -u)
  while IFS= read -r ref; do
    if [[ -n "$ref" ]] && [[ ! -e "$PROJECT_DIR/$ref" ]] && [[ ! "$ref" =~ \* ]]; then
      DEAD_REFS+="  $ref (in $(basename "$(dirname "$CLAUDE_FILE")")/CLAUDE.md)\n"
    fi
  done <<< "$REFS"
done

if [[ -n "$DEAD_REFS" ]]; then
  ENTRY+="- Dead references found in CLAUDE.md files:\n${DEAD_REFS}"
fi

# Append to session-learnings memory
MEMORY_DIR="$PROJECT_DIR/.claude/agent-memory/session-learnings"
mkdir -p "$MEMORY_DIR"
MEMORY_FILE="$MEMORY_DIR/MEMORY.md"

if [[ ! -f "$MEMORY_FILE" ]]; then
  echo "# Session Learnings" > "$MEMORY_FILE"
  echo "" >> "$MEMORY_FILE"
  echo "Automatically populated by evaluate-session.sh hook on session end." >> "$MEMORY_FILE"
fi

echo -e "$ENTRY" >> "$MEMORY_FILE"

# Also append to domain-specific memory if relevant
if [[ "$SERVER_COUNT" -gt 0 ]]; then
  REVIEWER_MEM="$PROJECT_DIR/.claude/agent-memory/code-reviewer/MEMORY.md"
  if [[ -f "$REVIEWER_MEM" ]]; then
    # Only add a brief session note under Review History
    sed -i '' '/## Review History/a\
- '"$DATE"' — '"$BRANCH"': '"$SERVER_COUNT"' server files changed' "$REVIEWER_MEM" 2>/dev/null || true
  fi
fi

if [[ "$E2E_COUNT" -gt 0 ]]; then
  TESTER_MEM="$PROJECT_DIR/.claude/agent-memory/test-writer/MEMORY.md"
  if [[ -f "$TESTER_MEM" ]]; then
    echo -e "\n## Session ${DATE}\n- Branch: ${BRANCH}, ${E2E_COUNT} e2e files changed" >> "$TESTER_MEM" 2>/dev/null || true
  fi
fi

exit 0
