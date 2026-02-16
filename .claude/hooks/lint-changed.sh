#!/bin/bash
# PostToolUse hook: runs ESLint on files changed by Edit/Write tools
# Receives JSON on stdin with tool_input.file_path
# Exit 0 = success (stdout goes to Claude context)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only lint TypeScript/JavaScript files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Run ESLint on just the changed file (suppress exit code, report errors)
RESULT=$(npx eslint "$FILE_PATH" --format compact 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "Lint issues in $FILE_PATH:"
  echo "$RESULT"
  exit 0  # Advisory — don't block, just inform
fi

exit 0
