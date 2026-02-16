#!/bin/bash
# PostToolUse hook: scans changed files for known anti-patterns
# Advisory only (exit 0) — reports findings as context feedback

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check TypeScript/TSX files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Skip test files, config files, and type declaration files
if [[ "$FILE_PATH" =~ (__tests__|\.test\.|\.spec\.|\.d\.ts|node_modules) ]]; then
  exit 0
fi

ISSUES=""

# 1. ctx.db without cross-domain/publicProcedure comment
if grep -n 'ctx\.db\.' "$FILE_PATH" 2>/dev/null | grep -v '// cross-domain' | grep -v '// publicProcedure' | grep -v '// background' | grep -q .; then
  ISSUES+="- ctx.db usage without explanatory comment (use ctx.uow instead, or add // cross-domain: reason)\n"
fi

# 2. Record<string, unknown> (should be Partial<SchemaType>)
if grep -qn 'Record<string,\s*unknown>' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Record<string, unknown> found (use Partial<SchemaType> instead)\n"
fi

# 3. as any
if grep -qn 'as any' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- 'as any' found (use proper types)\n"
fi

# 4. React.forwardRef (deprecated in React 19)
if grep -qn 'React\.forwardRef\|forwardRef(' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- forwardRef found (deprecated in React 19, use ref prop directly)\n"
fi

# 5. trpc.useContext() (deprecated, use useUtils)
if grep -qn 'trpc\.useContext()' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- trpc.useContext() found (deprecated, use trpc.useUtils())\n"
fi

# 6. export * (breaks tree-shaking)
if grep -qn '^export \*' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- 'export *' found (use named re-exports for tree-shaking)\n"
fi

# 7. db: any
if grep -qn 'db:\s*any' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- 'db: any' found (use db: DB from repositories/base)\n"
fi

# 8. queryClient.invalidateQueries (use utils.x.invalidate())
if grep -qn 'queryClient\.invalidateQueries' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- queryClient.invalidateQueries() found (use utils.<domain>.invalidate())\n"
fi

# 9. Promise<unknown> or Promise<any> in non-test files
if grep -qn 'Promise<unknown>\|Promise<any>' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Promise<unknown> or Promise<any> found (use typed return values)\n"
fi

if [[ -n "$ISSUES" ]]; then
  echo "Anti-pattern check for $(basename "$FILE_PATH"):"
  echo -e "$ISSUES"
fi

exit 0
