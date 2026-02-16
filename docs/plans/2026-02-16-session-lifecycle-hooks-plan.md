# Session Lifecycle Hooks & Continuous Learning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SessionStart, enhanced Stop, and SubagentStop hooks to improve session initialization, completion validation, and automated knowledge capture.

**Architecture:** 3 new shell scripts + 1 prompt-based hook + 1 new agent memory file + settings.json updates. All scripts follow existing hook conventions (stdin JSON parsing, exit 0 advisory / exit 2 block).

**Tech Stack:** Bash, Python3 (JSON parsing), git CLI, beads CLI

**Design doc:** `docs/plans/2026-02-16-session-lifecycle-and-continuous-learning-design.md`

---

### Task 1: Create `session-start.sh`

**Files:**
- Create: `.claude/hooks/session-start.sh`

**Step 1: Create the hook script**

```bash
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
echo "[Session] Branch: $BRANCH | ${MODIFIED} modified | ${UNTRACKED} untracked in src/e2e | ↑${AHEAD} ↓${BEHIND}"

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
```

**Step 2: Make executable**

Run: `chmod +x .claude/hooks/session-start.sh`

**Step 3: Test manually**

Run: `echo '{}' | .claude/hooks/session-start.sh`
Expected: Output like `[Session] Docker: ✓ | DB: ✓ | Env: ✓` etc.

**Step 4: Commit**

```bash
git add .claude/hooks/session-start.sh
git commit -m "feat: add session-start hook for environment health check"
```

---

### Task 2: Create `stop-quality-gate.sh`

**Files:**
- Create: `.claude/hooks/stop-quality-gate.sh`

**Step 1: Create the hook script**

```bash
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
```

**Step 2: Make executable**

Run: `chmod +x .claude/hooks/stop-quality-gate.sh`

**Step 3: Test with clean state**

Run: `echo '{}' | .claude/hooks/stop-quality-gate.sh; echo "Exit: $?"`
Expected: Exit 0, possibly advisory warnings

**Step 4: Commit**

```bash
git add .claude/hooks/stop-quality-gate.sh
git commit -m "feat: add stop quality gate hook for work validation"
```

---

### Task 3: Create `evaluate-session.sh`

**Files:**
- Create: `.claude/hooks/evaluate-session.sh`
- Create: `.claude/agent-memory/session-learnings/MEMORY.md`

**Step 1: Create the session-learnings memory file**

```markdown
# Session Learnings

Automatically populated by evaluate-session.sh hook on session end.
Each entry captures: files changed, anti-patterns caught, new patterns discovered.
```

**Step 2: Create the hook script**

```bash
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
SERVER_COUNT=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | grep -c "^src/server/" || echo "0")
COMPONENT_COUNT=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | grep -c "^src/components/" || echo "0")
E2E_COUNT=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | grep -c "^e2e/" || echo "0")
HOOK_COUNT=$(git -C "$PROJECT_DIR" diff --name-only HEAD 2>/dev/null | grep -c "^\.claude/" || echo "0")

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
```

**Step 3: Make executable**

Run: `chmod +x .claude/hooks/evaluate-session.sh`

**Step 4: Test manually**

Run: `echo '{}' | .claude/hooks/evaluate-session.sh && cat .claude/agent-memory/session-learnings/MEMORY.md`
Expected: Memory file created/appended with session entry

**Step 5: Commit**

```bash
git add .claude/hooks/evaluate-session.sh .claude/agent-memory/session-learnings/MEMORY.md
git commit -m "feat: add evaluate-session hook for continuous learning"
```

---

### Task 4: Update `settings.json` with all new hooks

**Files:**
- Modify: `.claude/settings.json`

**Step 1: Add SessionStart and SubagentStop arrays, update Stop array**

The final `settings.json` should be:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/lint-changed.sh",
            "timeout": 30
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-anti-patterns.sh",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-env-leaks.sh",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/typecheck-changed.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-destructive.sh"
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-commit-msg.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/save-progress.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/stop-quality-gate.sh",
            "timeout": 15
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/evaluate-session.sh",
            "timeout": 15
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/notify-on-stop.sh",
            "timeout": 10
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Before this subagent stops, verify: (1) Was the assigned task fully completed? (2) If it wrote code, are there any TODO/FIXME markers left unresolved? (3) If it ran tests, did they pass? If any check fails, return 'block' with a specific explanation of what's incomplete. If all checks pass, return 'approve'.",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('.claude/settings.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "feat: register session lifecycle and continuous learning hooks"
```

---

### Task 5: Integration test — verify all hooks

**Step 1: Test session-start in isolation**

Run: `echo '{}' | .claude/hooks/session-start.sh`
Expected: `[Session]` output lines with status indicators

**Step 2: Test stop-quality-gate in isolation**

Run: `echo '{}' | .claude/hooks/stop-quality-gate.sh; echo "Exit: $?"`
Expected: Exit 0 with any advisory warnings

**Step 3: Test evaluate-session in isolation**

Run: `echo '{}' | .claude/hooks/evaluate-session.sh && tail -5 .claude/agent-memory/session-learnings/MEMORY.md`
Expected: New timestamped entry appended

**Step 4: Validate settings.json structure**

Run: `python3 -c "import json; d=json.load(open('.claude/settings.json')); print('Hooks:', list(d['hooks'].keys()))"`
Expected: `Hooks: ['SessionStart', 'PostToolUse', 'PreToolUse', 'PreCompact', 'Stop', 'SubagentStop']`

**Step 5: Final commit if any fixes were needed**

```bash
git add -A .claude/
git commit -m "fix: polish session lifecycle hooks after integration testing"
```
