#!/bin/bash
# PostToolUse hook: runs tsc --noEmit on changed TypeScript files
# Advisory only — reports type errors as context feedback

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check TypeScript files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Skip node_modules and generated files
if [[ "$FILE_PATH" =~ (node_modules|\.next|\.generated) ]]; then
  exit 0
fi

# Run tsc on just this file's project (suppress warnings, only show errors)
RESULT=$(npx tsc --noEmit --pretty false 2>&1 | grep -F "$(basename "$FILE_PATH")" | head -5)

if [[ -n "$RESULT" ]]; then
  echo "Type errors in $(basename "$FILE_PATH"):"
  echo "$RESULT"
fi

exit 0
