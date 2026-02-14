#!/bin/bash
set -e
echo "Checking for anti-patterns in server code..."
FAIL=0

# count(*) without ::int (exclude CLAUDE.md and known out-of-scope files)
if grep -rn 'count(\*)' src/server/ --include="*.ts" | grep -v '::int' | grep -v 'node_modules' | grep -v 'CLAUDE.md' | grep -v 'taxOptimization.ts'; then
  echo "ERROR: Found count(*) without ::int cast"
  FAIL=1
fi

# Record<string, unknown> as a bare parameter type in repository files
# Excludes Record<string, unknown>[] which is valid for jsonb array columns
if grep -rn 'Record<string, unknown>' src/server/repositories/ --include="*.ts" | grep -v 'Record<string, unknown>\[\]'; then
  echo "ERROR: Found Record<string, unknown> in repositories — use Partial<SchemaType>"
  FAIL=1
fi

# Promise<unknown> in repository files
if grep -rn 'Promise<unknown>' src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Promise<unknown> in repositories — use proper return types"
  FAIL=1
fi

# Promise<any> in repository files
if grep -rn 'Promise<any>' src/server/repositories/ --include="*.ts"; then
  echo "ERROR: Found Promise<any> in repositories — use proper return types"
  FAIL=1
fi

if [ $FAIL -eq 1 ]; then
  echo "Anti-pattern check FAILED"
  exit 1
fi

echo "No anti-patterns found."
