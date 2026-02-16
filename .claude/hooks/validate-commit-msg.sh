#!/bin/bash
# PreToolUse hook: validates conventional commit message format
# Blocks (exit 2) if commit message doesn't follow convention

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only check git commit commands
if [[ ! "$COMMAND" =~ "git commit" ]]; then
  exit 0
fi

# Skip merge commits and amends
if [[ "$COMMAND" =~ "--amend" ]] || [[ "$COMMAND" =~ "Merge" ]]; then
  exit 0
fi

# Extract commit message - look for -m flag with quoted string
MSG=$(echo "$COMMAND" | python3 -c '
import sys, re
cmd = sys.stdin.read()
# Try double-quoted -m "message"
m = re.search(r"-m\s+\"([^\"]+)\"", cmd)
if not m:
    # Try single-quoted -m '"'"'message'"'"'
    m = re.search(r"-m\s+'"'"'([^'"'"']+)'"'"'", cmd)
if not m:
    # Try heredoc: -m "$(cat <<'"'"'EOF'"'"' ... EOF )"
    m = re.search(r"<<\s*[\"'"'"']?EOF[\"'"'"']?\s*\n\s*(.+)", cmd)
if m:
    print(m.group(1).strip().split("\n")[0])
else:
    print("")
' 2>/dev/null)

# If we can't extract the message, skip validation
if [[ -z "$MSG" ]]; then
  exit 0
fi

# Check conventional commit format
VALID_PREFIXES="^(feat|fix|chore|refactor|test|docs|ci|perf|build|style|revert)(\(.+\))?:"
if echo "$MSG" | grep -qE "$VALID_PREFIXES"; then
  exit 0
fi

echo "BLOCKED: Commit message must follow conventional commits format."
echo "Got: \"$MSG\""
echo "Expected: <type>: <description>"
echo "Types: feat, fix, chore, refactor, test, docs, ci, perf, build"
exit 2
