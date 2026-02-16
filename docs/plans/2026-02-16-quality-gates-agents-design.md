# Quality Gates & Custom Agents — Full Coverage (Approach C)

**Date:** 2026-02-16
**Status:** Approved

## Problem

Three quality issues slip through the current workflow:
1. **Forgotten tests** — code committed without corresponding test coverage
2. **Type/lint issues** — TypeScript errors caught in CI instead of locally
3. **Anti-pattern drift** — old patterns (ctx.db, Record<string,unknown>, as any) creep back despite rules

Additionally, no persistent-memory agents exist to learn project conventions across sessions.

## Design

### 1. Quality Gate Hooks

#### `check-anti-patterns.sh` (PostToolUse, command)

Regex-based scan of changed files for known anti-patterns:
- `ctx.db` without `// cross-domain:` or `// publicProcedure:` comment
- `Record<string, unknown>` (should be `Partial<SchemaType>`)
- `as any` (type safety violation)
- `React.forwardRef` (deprecated in React 19)
- `trpc.useContext()` (deprecated, use `trpc.useUtils()`)
- `export *` (breaks tree-shaking)
- `db: any` (should be `db: DB`)
- `COUNT(*)` without `::int` cast
- `queryClient.invalidateQueries()` (use `utils.x.invalidate()`)

Advisory only (exit 0). Reports findings as context feedback.

Matcher: `Edit|Write`

#### `check-anti-patterns-llm` (PostToolUse, prompt)

Haiku prompt hook for subtle anti-pattern detection. Toggleable — disabled by default, enable by adding to settings.json.

Prompt: "Does this code change violate any rules in .claude/rules/anti-patterns.md? Check for: incorrect procedure types, missing user scoping, sequential awaits for independent queries, missing .returning() on insert/update."

Only fires on `.ts/.tsx` files. Advisory.

#### `typecheck-changed.sh` (PostToolUse, command)

Runs `tsc --noEmit` scoped to changed file's project. Reports TypeScript errors as context feedback. Advisory only.

Matcher: `Edit|Write`
Timeout: 30s (tsc can be slow)

#### `verify-tests-exist` (Stop, agent)

Before session ends, checks `git diff --name-only` for changed `.ts/.tsx` source files in `src/` and verifies corresponding test files exist (in `__tests__/` or `.test.ts`). Reports missing test coverage as a warning.

Agent-based hook with tool access (Read, Bash). Timeout: 30s.

### 2. Custom Agents

#### `code-reviewer` agent

**File:** `.claude/agents/code-reviewer.md`
**Memory:** `project` (persisted in `.claude/agent-memory/code-reviewer/`)
**Skills injected:** conventions, anti-patterns

**Purpose:** Reviews code changes against project conventions, remembers past review findings.

**Behavior:**
- Reads git diff of staged/unstaged changes
- Checks against conventions.md and anti-patterns.md
- Scores each finding 0-100 confidence
- Items >= 80 confidence: reports as issues to fix
- Items < 80 confidence: surfaces to user for manual triage (user decides whether to address)
- Updates memory with new patterns learned from corrections

**Learns across sessions:**
- Common mistakes and their fixes
- Approved exceptions (patterns that look wrong but are intentional)
- Project-specific conventions not in rules files

#### `test-writer` agent

**File:** `.claude/agents/test-writer.md`
**Memory:** `project` (persisted in `.claude/agent-memory/test-writer/`)
**Skills injected:** new-e2e-test, conventions

**Purpose:** Generates Vitest unit tests and Playwright E2E tests following project patterns.

**Knows:**
- `createMockUow()` setup from `src/server/test-utils`
- `authenticatedPage` fixture from `e2e/fixtures/auth.ts`
- Cleanup requirements (free plan: 1 property max)
- `page.on('pageerror')` error monitoring pattern
- Accessibility-first selectors

**Learns across sessions:**
- Which mock patterns work best for each repository
- Common edge cases per domain
- Test naming conventions

### 3. Settings Updates

Add new hooks to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/lint-changed.sh", "timeout": 30 },
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-anti-patterns.sh", "timeout": 10 },
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/typecheck-changed.sh", "timeout": 30 }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/notify-on-stop.sh", "timeout": 10 },
          { "type": "agent", "prompt": "Check git diff --name-only for changed .ts/.tsx files in src/. For each, verify a corresponding test file exists. Report any source files missing tests.", "timeout": 30 }
        ]
      }
    ]
  }
}
```

## Files to Create/Modify

| Action | File |
|--------|------|
| Create | `.claude/hooks/check-anti-patterns.sh` |
| Create | `.claude/hooks/typecheck-changed.sh` |
| Create | `.claude/agents/code-reviewer.md` |
| Create | `.claude/agents/test-writer.md` |
| Modify | `.claude/settings.json` (add new hooks) |

## Not Doing

- **Prompt hook for anti-patterns** — disabled by default, can enable later if regex has too many false positives
- **Agent teams** — experimental, 5x token cost, revisit when stable
- **Blocking hooks** — all gates are advisory (exit 0) to avoid workflow interruption
