#!/bin/bash
# PreToolUse hook: blocks destructive bash commands
# Exit 0 = allow, Exit 2 = block (stderr shown to Claude)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Patterns to block
BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git reset --hard"
  "git clean -fd"
  "git push.*--force.*main"
  "git push.*--force.*master"
  "DROP TABLE"
  "DROP DATABASE"
  "TRUNCATE"
  "git push.*-f.*main"
  "git push.*-f.*master"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo "BLOCKED: Destructive command detected: $pattern" >&2
    echo "If you need to run this, ask the user for explicit confirmation first." >&2
    exit 2
  fi
done

exit 0
