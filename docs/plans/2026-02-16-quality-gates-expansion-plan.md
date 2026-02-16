# Quality Gates & Anti-Patterns Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand hooks (9 → 17 checks + 2 new hooks), add 5 missing anti-pattern sections, update 6 CLAUDE.md files with undocumented conventions, and pre-populate agent memory.

**Architecture:** All changes are documentation, shell scripts, and JSON config — zero app code. Can be done directly on `develop` branch per worktree exception for doc/config edits.

**Tech Stack:** Bash (hooks), Markdown (docs), JSON (settings)

**Design doc:** `docs/plans/2026-02-16-quality-gates-expansion-design.md`

---

### Task 1: Expand `check-anti-patterns.sh` with 8 new checks

**Files:**
- Modify: `.claude/hooks/check-anti-patterns.sh:63` (append before the final `if` block)

**Step 1: Add 8 new pattern checks**

Append these checks before the final `if [[ -n "$ISSUES" ]]` block (line 65):

```bash
# 10. getServerSideProps (doesn't exist in App Router)
if grep -qn 'getServerSideProps' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- getServerSideProps found (doesn't exist in App Router, use server components or route handlers)\n"
fi

# 11. size={ on Lucide icons (should use Tailwind classes)
if grep -qn 'size={' "$FILE_PATH" 2>/dev/null | grep -v '// ok' | grep -q .; then
  ISSUES+="- size={ prop found (use Tailwind w-4 h-4 classes on icons instead)\n"
fi

# 12. import * as from lucide (kills tree-shaking)
if grep -qn 'import \* as.*lucide' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- import * from lucide-react found (use named imports for tree-shaking)\n"
fi

# 13. .nonempty() on Zod (deprecated in v4, use .min(1))
if grep -qn '\.nonempty()' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- .nonempty() found (deprecated in Zod v4, use .min(1, \"Required\"))\n"
fi

# 14. console.log in non-test server files (use logger)
if grep -qn 'console\.log' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- console.log found (use logger from @/lib/logger in server code)\n"
fi

# 15. toast with type object (use toast.success/error directly)
if grep -qn 'toast(.*type:' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- toast() with type option found (use toast.success/error/warning directly)\n"
fi

# 16. SQL count(*) without ::int cast (returns string)
if grep -n 'count(\*)' "$FILE_PATH" 2>/dev/null | grep -v '::int' | grep -q .; then
  ISSUES+="- count(*) without ::int cast found (returns string, use count(*)::int)\n"
fi

# 17. .describe() on Zod enum (use { error: } option in v4)
if grep -qn '\.describe(' "$FILE_PATH" 2>/dev/null | grep -v '// ok' | grep -q .; then
  ISSUES+="- .describe() found (in Zod v4, use { error: \"message\" } option instead)\n"
fi
```

**Step 2: Verify the hook runs without errors**

```bash
echo '{"tool_input":{"file_path":"src/server/routers/property/property.ts"}}' | .claude/hooks/check-anti-patterns.sh
```

Expected: exits 0, may print advisory findings.

**Step 3: Commit**

```bash
git add .claude/hooks/check-anti-patterns.sh
git commit -m "chore: expand anti-pattern hook from 9 to 17 checks"
```

---

### Task 2: Create `check-env-leaks.sh` hook

**Files:**
- Create: `.claude/hooks/check-env-leaks.sh`

**Step 1: Write the hook**

```bash
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

# Supabase keys hardcoded
if grep -qn 'eyJ[a-zA-Z0-9_-]\{30,\}' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Possible hardcoded JWT/Supabase key found (use env var)\n"
fi

if [[ -n "$ISSUES" ]]; then
  echo "Secret leak check for $(basename "$FILE_PATH"):"
  echo -e "$ISSUES"
fi

exit 0
```

**Step 2: Make executable and test**

```bash
chmod +x .claude/hooks/check-env-leaks.sh
echo '{"tool_input":{"file_path":"src/server/trpc.ts"}}' | .claude/hooks/check-env-leaks.sh
```

Expected: exits 0, no output (no secrets in that file).

**Step 3: Commit**

```bash
git add .claude/hooks/check-env-leaks.sh
git commit -m "chore: add check-env-leaks hook for hardcoded secrets detection"
```

---

### Task 3: Create `validate-commit-msg.sh` hook

**Files:**
- Create: `.claude/hooks/validate-commit-msg.sh`

**Step 1: Write the hook**

```bash
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

# Extract commit message from -m flag
MSG=$(echo "$COMMAND" | python3 -c "
import sys, re
cmd = sys.stdin.read()
# Match -m followed by quoted string (single, double, or heredoc)
m = re.search(r'-m\s+[\"'"'"']([^\"'"'"']+)[\"'"'"']', cmd)
if not m:
    # Try heredoc pattern
    m = re.search(r'-m\s+\"\\\$\(cat <<.*?EOF\n(.+?)$', cmd, re.MULTILINE)
if m:
    print(m.group(1).strip())
else:
    print('')
" 2>/dev/null)

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
```

**Step 2: Make executable and test**

```bash
chmod +x .claude/hooks/validate-commit-msg.sh
echo '{"tool_input":{"command":"git commit -m \"added stuff\""}}' | .claude/hooks/validate-commit-msg.sh
```

Expected: exit 2 with "BLOCKED" message.

```bash
echo '{"tool_input":{"command":"git commit -m \"feat: add new feature\""}}' | .claude/hooks/validate-commit-msg.sh
```

Expected: exit 0, no output.

**Step 3: Commit**

```bash
git add .claude/hooks/validate-commit-msg.sh
git commit -m "chore: add validate-commit-msg hook for conventional commits"
```

---

### Task 4: Register new hooks in `settings.json`

**Files:**
- Modify: `.claude/settings.json`

**Step 1: Add check-env-leaks to PostToolUse hooks array**

Add after the `check-anti-patterns.sh` entry in the PostToolUse `Edit|Write` matcher:

```json
{
  "type": "command",
  "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-env-leaks.sh",
  "timeout": 10
}
```

**Step 2: Add validate-commit-msg to PreToolUse hooks array**

Add a new entry in the PreToolUse array (the existing Bash matcher block, add to its hooks array):

```json
{
  "type": "command",
  "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-commit-msg.sh",
  "timeout": 5
}
```

**Step 3: Verify JSON is valid**

```bash
python3 -m json.tool .claude/settings.json > /dev/null && echo "Valid JSON"
```

Expected: "Valid JSON"

**Step 4: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: register check-env-leaks and validate-commit-msg hooks"
```

---

### Task 5: Add 5 new sections to `anti-patterns.md`

**Files:**
- Modify: `.claude/rules/anti-patterns.md:124` (append after Playwright section)

**Step 1: Append 5 new sections**

Add at the end of the file, after the Playwright section:

```markdown

## Sentry v10

| DO | DON'T |
|----|-------|
| `Sentry.captureException(error)` for unexpected errors | `console.error` for production error tracking |
| `Sentry.setUser({ id })` in auth context | Log PII (email, name) in Sentry breadcrumbs |
| `Sentry.withScope(scope => { scope.setTag(...) })` for context | Capture expected/handled errors (404, validation) |
| Use `global-error.tsx` for React error boundary reporting | Silent swallowing of errors in catch blocks |

## Structured Logging / Axiom

| DO | DON'T |
|----|-------|
| `logger.info("message", { context })` from `@/lib/logger` | `console.log` in server code |
| `logger.error("message", error, { context })` | `console.error(error)` without structured context |
| `logger.child({ domain: "banking" })` for domain-scoped logs | Create custom logger instances |
| Include `requestId`, `userId` in log context | Log sensitive data (passwords, tokens, card numbers) |

## Upstash Rate Limiting

| DO | DON'T |
|----|-------|
| Use middleware from `src/server/middleware/rate-limit.ts` | Build custom rate limiting |
| Apply to public/expensive endpoints (AI, bulk exports, auth) | Rate limit every tRPC procedure (overhead) |
| Return TRPCError code `TOO_MANY_REQUESTS` | Silently drop rate-limited requests |
| Sliding window algorithm | Fixed window (burst-prone) |

## Error Boundaries

| DO | DON'T |
|----|-------|
| `error.tsx` per route segment for granular recovery | Single global error boundary only |
| Show "retry" action in error UI | Show raw error messages to users |
| Report to Sentry in error boundary | Swallow errors silently |
| `<ErrorBoundary>` component for client-side granular recovery | Let all errors bubble to global handler |

## Security

| DO | DON'T |
|----|-------|
| Always scope queries by `ctx.portfolio.ownerId` | Trust client-sent user IDs |
| `stripe.webhooks.constructEvent()` for webhook verification | Process unverified webhook payloads |
| Validate file uploads server-side (type, size, extension) | Trust client-side validation alone |
| `writeProcedure` for mutations | `protectedProcedure` for state-changing ops without `canWrite` |
| Sanitize AI-generated content before rendering | `dangerouslySetInnerHTML` with unsanitized content |
| Use env vars for all secrets/keys | Hardcode API keys, tokens, or passwords |
```

**Step 2: Commit**

```bash
git add .claude/rules/anti-patterns.md
git commit -m "docs: add Sentry, logging, rate limiting, error boundary, and security anti-patterns"
```

---

### Task 6: Add Observability + Unit Testing sections to `src/server/CLAUDE.md`

**Files:**
- Modify: `src/server/CLAUDE.md:235` (append at end)

**Step 1: Append two new sections**

```markdown

## Observability

### Logging (`@/lib/logger`)

| Method | When |
|--------|------|
| `logger.debug(msg, ctx)` | Dev-only detail, stripped in production |
| `logger.info(msg, ctx)` | Business events (user signed up, property created) |
| `logger.warn(msg, ctx)` | Recoverable issues (rate limit hit, retry succeeded) |
| `logger.error(msg, error, ctx)` | Failures requiring investigation |
| `logger.child({ domain })` | Scoped logger for a router/service |

- **Never** use `console.log/warn/error` in server code — use `logger`
- `requestId` and `userId` are auto-set via `setLogContext` in tRPC middleware
- All logs auto-ship to Axiom in production via `@/lib/axiom`

### Error Tracking (Sentry)

- Unexpected errors auto-captured via `global-error.tsx` and tRPC error formatter
- Use `Sentry.captureException(error)` for caught errors that need visibility
- Never capture expected errors (validation, 404, auth redirects)
- Set user context via `Sentry.setUser({ id })` — never log PII in tags/breadcrumbs

### Rate Limiting (Upstash)

- Import from `src/server/middleware/rate-limit.ts`
- Apply to: public endpoints, expensive operations (AI, bulk exports), auth attempts
- Standard error: `throw new TRPCError({ code: "TOO_MANY_REQUESTS" })`

## Unit Testing Conventions

| Pattern | Example |
|---------|---------|
| Test file location | `src/server/repositories/__tests__/property.test.ts` |
| Mock UoW | `const uow = createMockUow()` from `@/server/test-utils` |
| Mock structure | `vi.mocked(uow.propertyRepo.findById).mockResolvedValue(mockProperty)` |
| Test naming | `it("returns null when property not found")` — describe behavior |
| Arrange-Act-Assert | Clear separation with blank lines between sections |

**What to test:**
- Repository methods: query building, filtering, edge cases
- Router procedures: authorization, validation, business logic
- Services: transformation logic, error handling

**What NOT to test:**
- Drizzle query builder internals (trust the ORM)
- Third-party library behavior
- Simple pass-through functions with no logic
```

**Step 2: Commit**

```bash
git add src/server/CLAUDE.md
git commit -m "docs: add observability and unit testing conventions to server CLAUDE.md"
```

---

### Task 7: Add Accessibility section to `src/components/CLAUDE.md`

**Files:**
- Modify: `src/components/CLAUDE.md:213` (append at end)

**Step 1: Append accessibility section**

```markdown

## Accessibility

| DO | DON'T |
|----|-------|
| Semantic HTML (`<button>`, `<nav>`, `<main>`, `<section>`) | `<div onClick>` for interactive elements |
| `aria-label` on icon-only buttons | Rely on visual-only context |
| `aria-live="polite"` for async status updates | Custom notification without aria-live |
| Keyboard-navigable: all interactive elements focusable | `tabIndex` hacks or skip links without reason |
| `sr-only` class for screen-reader-only text | `display: none` for content that should be announced |
| Test with `npm run test:a11y` before merge | Assume Radix handles everything |
```

**Step 2: Commit**

```bash
git add src/components/CLAUDE.md
git commit -m "docs: add accessibility guidelines to components CLAUDE.md"
```

---

### Task 8: Add Logging section to `src/lib/CLAUDE.md`

**Files:**
- Modify: `src/lib/CLAUDE.md:95` (append at end)

**Step 1: Append logging section**

```markdown

## Logging (`src/lib/logger.ts`)

| Method | When |
|--------|------|
| `logger.debug(msg, ctx)` | Dev-only detail, stripped in production |
| `logger.info(msg, ctx)` | Business events (user signed up, property created) |
| `logger.warn(msg, ctx)` | Recoverable issues (rate limit hit, retry succeeded) |
| `logger.error(msg, error, ctx)` | Failures requiring investigation |
| `logger.child({ domain })` | Scoped logger for a router/service |

All logs auto-ship to Axiom in production via `@/lib/axiom`.

**Never use `console.log/warn/error` in server code** — the `check-anti-patterns` hook will flag it.
```

**Step 2: Commit**

```bash
git add src/lib/CLAUDE.md
git commit -m "docs: add logging reference to lib CLAUDE.md"
```

---

### Task 9: Add Commit Conventions + Security Principles to root `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (insert after "Context Hygiene" section, before "Worktree Requirement")

**Step 1: Add Commit Conventions section**

Insert after the "Context Hygiene" section (after line 48):

```markdown

## Commit Conventions

Format: `<type>: <description>` (lowercase, imperative mood, no period)

| Type | When |
|------|------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `chore` | Tooling, config, dependencies |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

Enforced by `validate-commit-msg` hook.
```

**Step 2: Add Security Principles section**

Insert after "Staging & Production" section (after line 88, after the Commit Conventions insertion):

```markdown

## Security Principles

| Rule | Enforcement |
|------|-------------|
| All mutations require `writeProcedure` or higher | Code review |
| All queries scoped by `ctx.portfolio.ownerId` | Anti-pattern hook + review |
| Webhook payloads verified cryptographically | `constructEvent()` |
| File uploads validated server-side (type, size) | Supabase signed URLs |
| No secrets in code — use env vars | `check-env-leaks` hook |
| AI-generated content sanitized before render | Code review |
| Rate limiting on public/expensive endpoints | Upstash middleware |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add commit conventions and security principles to root CLAUDE.md"
```

---

### Task 10: Add Error Monitoring to `e2e/CLAUDE.md`

**Files:**
- Modify: `e2e/CLAUDE.md:97` (append at end)

**Step 1: Append error monitoring section**

```markdown

## Error Monitoring in Tests

Every E2E test MUST capture page errors to catch uncaught exceptions, unhandled promise rejections, and React hydration errors:

```ts
const errors: string[] = [];
page.on("pageerror", (err) => errors.push(err.message));

// ... test body ...

expect(errors).toEqual([]);
```

Without this, tests can pass while the page has JavaScript errors that would break real users.
```

**Step 2: Commit**

```bash
git add e2e/CLAUDE.md
git commit -m "docs: add error monitoring requirement to e2e CLAUDE.md"
```

---

### Task 11: Pre-populate agent memory files

**Files:**
- Modify: `.claude/agent-memory/code-reviewer/MEMORY.md`
- Modify: `.claude/agent-memory/test-writer/MEMORY.md`

**Step 1: Update code-reviewer memory**

Replace the placeholder sections:

```markdown
# Code Reviewer Memory

## Project Conventions
- Repository layer: 23 typed repos with interfaces in `src/server/repositories/`
- UnitOfWork (`ctx.uow`) on all `protectedProcedure`+ contexts
- `publicProcedure` does NOT have `ctx.uow`
- `writeProcedure` for mutations, `protectedProcedure` for reads

## Approved Exceptions
(none yet — add as user approves items during reviews)

## Common Patterns Found
- console.log in server code (should use logger from @/lib/logger)
- Missing error boundaries on route segments
- Sequential awaits for independent queries (should use Promise.all)
- Hardcoded colors instead of CSS variables
- Missing aria-label on icon-only buttons
- toast.error(error.message) instead of toast.error(getErrorMessage(error))
- size={16} on Lucide icons instead of Tailwind w-4 h-4 classes

## Manual Review Checklist
1. New files: has appropriate "use client" directive (or deliberately omits it)?
2. New mutations: uses writeProcedure (not protectedProcedure)?
3. New queries: scoped by ctx.portfolio.ownerId?
4. New components: keyboard-navigable, semantic HTML?
5. New API routes: rate-limited if public/expensive?
6. Error handling: uses getErrorMessage, not raw .message?
7. Logging: uses logger, not console.log in server code?
8. Sequential awaits: independent queries should use Promise.all?
9. Insert/update: uses .returning() if return value needed?
10. Bulk operations: uses inArray, not loop?

## Review History
(populated during reviews)
```

**Step 2: Update test-writer memory**

Replace the placeholder section:

```markdown
# Test Writer Memory

## Mock Patterns
- `createMockUow()` provides all 23 repository mocks
- Each repo mock has vi.fn() for every method
- Use `.mockResolvedValue()` for async methods
- Use `.mockReturnValue()` for sync methods

## E2E Patterns
- Auth handled by storageState in `e2e/authenticated/` directory
- Free plan limit: 1 property — always clean up
- Use `safeGoto` from `e2e/fixtures/test-helpers.ts` for navigation
- Always capture page errors: `page.on("pageerror", ...)`

## Domain Knowledge
- 23 repositories: property, transaction, bankAccount, loan, document, etc.
- Procedure types: public, protected, write, member, bank, pro, team
- Portfolio context: ownerId, role, canWrite, canManageMembers, etc.

## Learned Preferences
- Test behavior over implementation details
- Descriptive test names: "returns null when property not found"
- Nested describe blocks grouped by method/feature
- Always test error/edge cases, not just happy path
- Repositories: test query filters, empty results, null returns
- Routers: test authorization (wrong user = FORBIDDEN), validation (bad input = BAD_REQUEST)
- Arrange-Act-Assert pattern with blank line separation
```

**Step 3: Commit**

```bash
git add .claude/agent-memory/
git commit -m "chore: pre-populate code-reviewer and test-writer agent memory"
```

---

### Task 12: Final verification

**Step 1: Verify all hooks run without errors**

```bash
echo '{"tool_input":{"file_path":"src/server/trpc.ts"}}' | .claude/hooks/check-anti-patterns.sh
echo '{"tool_input":{"file_path":"src/server/trpc.ts"}}' | .claude/hooks/check-env-leaks.sh
echo '{"tool_input":{"command":"git commit -m \"feat: test\""}}' | .claude/hooks/validate-commit-msg.sh
echo '{"tool_input":{"command":"git commit -m \"bad message\""}}' | .claude/hooks/validate-commit-msg.sh
```

Expected: first 3 exit 0, last exits 2 with block message.

**Step 2: Verify settings.json is valid**

```bash
python3 -m json.tool .claude/settings.json > /dev/null && echo "Valid"
```

**Step 3: Count total anti-pattern checks**

```bash
grep -c "^# [0-9]" .claude/hooks/check-anti-patterns.sh
```

Expected: 17

**Step 4: Verify no broken markdown links in CLAUDE.md files**

Skim each modified file for rendering issues — no action needed, just visual check.

---

## Summary of Changes

| Category | Files | Changes |
|----------|-------|---------|
| Hooks | 3 files (1 modified, 2 created) | 8 new anti-pattern checks + env leak hook + commit msg hook |
| Hook config | `.claude/settings.json` | Register 2 new hooks |
| Anti-patterns | `.claude/rules/anti-patterns.md` | 5 new sections (Sentry, Logging, Rate Limit, Error Boundaries, Security) |
| Server docs | `src/server/CLAUDE.md` | Observability + Unit Testing sections |
| Component docs | `src/components/CLAUDE.md` | Accessibility section |
| Lib docs | `src/lib/CLAUDE.md` | Logging section |
| Root docs | `CLAUDE.md` | Commit Conventions + Security Principles |
| E2E docs | `e2e/CLAUDE.md` | Error Monitoring section |
| Agent memory | 2 files in `.claude/agent-memory/` | Pre-populated checklists and preferences |

**Total: 11 files, 12 commits, zero app code changes.**
