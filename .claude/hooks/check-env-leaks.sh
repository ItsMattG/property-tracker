#!/bin/bash
# PostToolUse hook: scans for hardcoded secrets and API keys
# Advisory only (exit 0)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only check source files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Skip env files, test files, config
if [[ "$FILE_PATH" =~ (\.env|__tests__|\.test\.|\.spec\.|node_modules|\.config\.) ]]; then
  exit 0
fi

ISSUES=""

# Stripe keys
if grep -qn 'sk_live_\|sk_test_\|pk_live_\|pk_test_' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Hardcoded Stripe key found (use process.env.STRIPE_SECRET_KEY)\n"
fi

# Generic long tokens/secrets
if grep -qn "Bearer [a-zA-Z0-9]\{30,\}" "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Hardcoded Bearer token found (use env var)\n"
fi

# Hardcoded passwords
if grep -qn 'password\s*=\s*["'"'"'][^"'"'"']\+["'"'"']' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Hardcoded password found (use env var)\n"
fi

# Supabase/JWT keys hardcoded
if grep -qn 'eyJ[a-zA-Z0-9_-]\{30,\}' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Possible hardcoded JWT/Supabase key found (use env var)\n"
fi

if [[ -n "$ISSUES" ]]; then
  echo "Secret leak check for $(basename "$FILE_PATH"):"
  echo -e "$ISSUES"
fi

exit 0
