#!/bin/bash
# PostToolUse hook: scans changed files for known anti-patterns
# Advisory only (exit 0) — reports findings as context feedback

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

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

# 10. getServerSideProps (doesn't exist in App Router)
if grep -qn 'getServerSideProps' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- getServerSideProps found (doesn't exist in App Router, use server components or route handlers)\n"
fi

# 11. size={ on Lucide icons (should use Tailwind classes)
# Only flag in files that import from lucide-react
if grep -q 'from "lucide-react"' "$FILE_PATH" 2>/dev/null && grep -n 'size={' "$FILE_PATH" 2>/dev/null | grep -v '// ok' | grep -q .; then
  ISSUES+="- size={ prop found on Lucide icon (use Tailwind w-4 h-4 classes instead)\n"
fi

# 12. import * as from lucide (kills tree-shaking)
if grep -qn 'import \* as.*lucide' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- import * from lucide-react found (use named imports for tree-shaking)\n"
fi

# 13. .nonempty() on Zod (deprecated in v4, use .min(1))
if grep -qn '\.nonempty()' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- .nonempty() found (deprecated in Zod v4, use .min(1, \"Required\"))\n"
fi

# 14. console.log in server files (use logger)
if [[ "$FILE_PATH" =~ src/server/ ]] && grep -qn 'console\.log' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- console.log found in server code (use logger from @/lib/logger)\n"
fi

# 15. toast with type object (use toast.success/error directly)
if grep -qn 'toast(.*type:' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- toast() with type option found (use toast.success/error/warning directly)\n"
fi

# 16. SQL count(*) without ::int cast (returns string)
if grep -n 'count(\*)' "$FILE_PATH" 2>/dev/null | grep -v '::int' | grep -q .; then
  ISSUES+="- count(*) without ::int cast found (returns string, use count(*)::int)\n"
fi

# 17. z.enum().describe() on Zod (use { error: } option in v4)
# Only flag .describe() when preceded by Zod-like patterns to avoid AI tool schema false positives
if grep -n 'z\.\(enum\|string\|number\|object\).*\.describe(' "$FILE_PATH" 2>/dev/null | grep -v '// ok' | grep -q .; then
  ISSUES+="- z.*.describe() found (in Zod v4, use { error: \"message\" } option instead)\n"
fi

if [[ -n "$ISSUES" ]]; then
  echo "Anti-pattern check for $(basename "$FILE_PATH"):"
  echo -e "$ISSUES"
fi

exit 0
