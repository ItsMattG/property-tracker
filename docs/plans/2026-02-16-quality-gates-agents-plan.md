# Quality Gates & Custom Agents Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add anti-pattern detection hooks, typecheck hook, test coverage verification, and two persistent-memory custom agents (code-reviewer, test-writer).

**Architecture:** Shell script hooks for fast regex-based checks, agent hooks for test coverage verification at session end, custom agents with project-scoped persistent memory for code review and test generation.

**Tech Stack:** Bash (hooks), jq (JSON parsing), Claude Code agents (YAML frontmatter + Markdown), Claude Code hooks API

## Tech Notes (context7)

- Hook types: `command` (shell), `prompt` (LLM judgment), `agent` (multi-turn with tools)
- Command hooks: stdin receives JSON with `tool_input`, exit 0 = allow (stdout → context), exit 2 = block (stderr → feedback)
- Agent hooks: `"type": "agent"` with `prompt` field, `$ARGUMENTS` placeholder for event JSON, timeout default 60s
- Custom agents: `.claude/agents/<name>.md` with YAML frontmatter (name, description, tools, memory, skills, model, maxTurns)
- Agent memory: `memory: project` stores at `.claude/agent-memory/<name>/MEMORY.md`, first 200 lines auto-loaded
- Prompt hooks: return `{"ok": true}` or `{"ok": false, "reason": "..."}`, default model is Haiku
- PostToolUse hooks receive: `tool_name`, `tool_input` (with `file_path` for Edit/Write), `cwd`
- Multiple hooks on same event run sequentially in array order

---

### Task 1: Create anti-pattern check hook

**Files:**
- Create: `.claude/hooks/check-anti-patterns.sh`

**Step 1: Create the hook script**

```bash
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

# Check for anti-patterns (grep -n for line numbers)
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

# 8. COUNT(*) without ::int cast
if grep -qn "COUNT(\*)" "$FILE_PATH" 2>/dev/null | grep -v '::int' | grep -q . 2>/dev/null; then
  ISSUES+="- COUNT(*) without ::int cast (returns string, use sql<number>\`COUNT(*)::int\`)\n"
fi

# 9. queryClient.invalidateQueries (use utils.x.invalidate())
if grep -qn 'queryClient\.invalidateQueries' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- queryClient.invalidateQueries() found (use utils.<domain>.invalidate())\n"
fi

# 10. Promise<unknown> or Promise<any> in non-test files
if grep -qn 'Promise<unknown>\|Promise<any>' "$FILE_PATH" 2>/dev/null; then
  ISSUES+="- Promise<unknown> or Promise<any> found (use typed return values)\n"
fi

if [[ -n "$ISSUES" ]]; then
  echo "Anti-pattern check for $(basename "$FILE_PATH"):"
  echo -e "$ISSUES"
fi

exit 0
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/check-anti-patterns.sh`

**Step 3: Verify the script works**

Run: `echo '{"tool_input":{"file_path":"src/server/routers/property.ts"}}' | .claude/hooks/check-anti-patterns.sh`
Expected: Either empty output (no issues) or anti-pattern warnings

**Step 4: Commit**

```bash
git add .claude/hooks/check-anti-patterns.sh
git commit -m "chore: add PostToolUse anti-pattern detection hook"
```

---

### Task 2: Create typecheck hook

**Files:**
- Create: `.claude/hooks/typecheck-changed.sh`

**Step 1: Create the hook script**

```bash
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
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/typecheck-changed.sh`

**Step 3: Verify the script works**

Run: `echo '{"tool_input":{"file_path":"src/server/routers/property.ts"}}' | .claude/hooks/typecheck-changed.sh`
Expected: Either empty output (no errors) or type error warnings

**Step 4: Commit**

```bash
git add .claude/hooks/typecheck-changed.sh
git commit -m "chore: add PostToolUse typecheck hook for changed files"
```

---

### Task 3: Create code-reviewer agent

**Files:**
- Create: `.claude/agents/code-reviewer.md`
- Create: `.claude/agent-memory/code-reviewer/MEMORY.md`

**Step 1: Create the agent definition**

```markdown
---
name: code-reviewer
description: Expert code reviewer for this project. Use after implementing features or before creating PRs. Reviews against project conventions, anti-patterns, and architectural decisions.
tools: Read, Grep, Glob, Bash
disallowedTools: Write, Edit, NotebookEdit
model: sonnet
maxTurns: 30
memory: project
---

# Code Reviewer Agent

You are a senior code reviewer for the BrickTrack property tracker application. Your job is to review code changes against project conventions and identify real issues.

## What to Check

1. **Anti-patterns** — Read `.claude/rules/anti-patterns.md` and verify changes don't violate any rules
2. **Conventions** — Read `.claude/rules/conventions.md` and verify import ordering, naming, types, icons
3. **Server patterns** — Read `src/server/CLAUDE.md` for procedure types, repository pattern, error codes
4. **Component patterns** — Read `src/components/CLAUDE.md` for tRPC client usage, forms, styling

## Review Process

1. Run `git diff --staged` or `git diff` to see what changed
2. For each changed file, read the full file for context
3. Check each change against the rules files above
4. Score each finding on a confidence scale:
   - **0-25:** Likely false positive or nitpick
   - **25-50:** Might be real but uncertain
   - **50-75:** Probably real but minor
   - **75-100:** Definitely real and important

## Output Format

### Issues (>= 80 confidence — fix these)

For each issue:
- File and line number
- What the issue is
- What the fix should be
- Confidence score

### For User Review (< 80 confidence — your call)

For each item:
- File and line number
- What might be an issue
- Why you're uncertain
- Confidence score

**Important:** Items below 80 confidence MUST be surfaced to the user for manual triage. Never silently filter them out.

### Summary

- Total files reviewed
- Issues found (by severity)
- Overall assessment

## What to Learn

After each review, update your MEMORY.md with:
- New patterns you discovered
- Exceptions the user approved (so you don't flag them again)
- Common mistakes you keep finding
```

**Step 2: Create initial agent memory file**

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
(populated during reviews)

## Review History
(populated during reviews)
```

**Step 3: Commit**

```bash
git add .claude/agents/code-reviewer.md .claude/agent-memory/code-reviewer/MEMORY.md
git commit -m "chore: add code-reviewer agent with persistent project memory"
```

---

### Task 4: Create test-writer agent

**Files:**
- Create: `.claude/agents/test-writer.md`
- Create: `.claude/agent-memory/test-writer/MEMORY.md`

**Step 1: Create the agent definition**

```markdown
---
name: test-writer
description: Generates Vitest unit tests and Playwright E2E tests following project patterns. Use when you need tests written for new or existing code.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
maxTurns: 50
memory: project
---

# Test Writer Agent

You are a test specialist for the BrickTrack property tracker application. You write Vitest unit tests and Playwright E2E tests following strict project conventions.

## Before Writing Any Test

1. Read `e2e/CLAUDE.md` for E2E test standards
2. Read `.claude/rules/conventions.md` for naming and import patterns
3. Read `.claude/rules/anti-patterns.md` for Playwright DO/DON'T

## Unit Test Conventions (Vitest)

### Setup
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "@/server/test-utils";

describe("<domain> router", () => {
  const mockUow = createMockUow();

  beforeEach(() => {
    vi.clearAllMocks();
  });
});
```

### Key Patterns
- Use `createMockUow()` from `src/server/test-utils` for repository mocking
- Mock individual repo methods: `mockUow.<domain>.<method>.mockResolvedValue(...)`
- Test both success and error paths
- Test user scoping (verify `ctx.portfolio.ownerId` is passed)
- Test authorization (verify `writeProcedure` is used for mutations)

## E2E Test Conventions (Playwright)

### Setup
```typescript
import { test, expect } from "@playwright/test";

test.describe("<Feature>", () => {
  test.beforeEach(async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    (page as any).__pageErrors = errors;
  });

  test.afterEach(async ({ page }) => {
    const errors = (page as any).__pageErrors || [];
    expect(errors).toHaveLength(0);
  });
});
```

### Key Patterns
- Accessibility-first selectors: `getByRole`, `getByLabel`, `getByText`
- NEVER use CSS selectors like `#id` or `.class`
- Clean up created data in `afterAll` (free plan: 1 property max)
- Tests in `e2e/authenticated/` get auth via `storageState` automatically
- Add to existing spec files when feature fits existing category

## What to Learn

After writing tests, update MEMORY.md with:
- Mock patterns that worked well for specific repositories
- Edge cases discovered during test writing
- Test naming conventions the user preferred
```

**Step 2: Create initial agent memory file**

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

## Domain Knowledge
- 23 repositories: property, transaction, bankAccount, loan, document, etc.
- Procedure types: public, protected, write, member, bank, pro, team
- Portfolio context: ownerId, role, canWrite, canManageMembers, etc.

## Learned Preferences
(populated during test writing sessions)
```

**Step 3: Commit**

```bash
git add .claude/agents/test-writer.md .claude/agent-memory/test-writer/MEMORY.md
git commit -m "chore: add test-writer agent with persistent project memory"
```

---

### Task 5: Update settings.json with new hooks

**Files:**
- Modify: `.claude/settings.json`

**Step 1: Update the settings file**

Replace the current `.claude/settings.json` with the expanded version that includes all new hooks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/lint-changed.sh",
            "timeout": 30
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-anti-patterns.sh",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/typecheck-changed.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-destructive.sh"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/save-progress.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/notify-on-stop.sh",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Note: The Stop agent hook for test verification is NOT added to settings.json because agent hooks on Stop add latency to every session end. Instead, use the `test-writer` agent explicitly when needed. This keeps the session responsive.

**Step 2: Verify settings.json is valid JSON**

Run: `cat .claude/settings.json | jq .`
Expected: Valid JSON output without errors

**Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: add anti-pattern and typecheck hooks to settings"
```

---

### Task 6: Final validation and single commit

**Step 1: Verify all new files exist**

Run: `ls -la .claude/hooks/check-anti-patterns.sh .claude/hooks/typecheck-changed.sh .claude/agents/code-reviewer.md .claude/agents/test-writer.md .claude/agent-memory/code-reviewer/MEMORY.md .claude/agent-memory/test-writer/MEMORY.md`

Expected: All 6 files present

**Step 2: Verify hooks are executable**

Run: `file .claude/hooks/check-anti-patterns.sh .claude/hooks/typecheck-changed.sh`

Expected: Both show as "shell script" or "Bourne-Again shell script"

**Step 3: Verify settings.json is valid**

Run: `cat .claude/settings.json | jq .`

Expected: Valid JSON, no errors

**Step 4: Verify agent files have valid frontmatter**

Run: `head -3 .claude/agents/code-reviewer.md .claude/agents/test-writer.md`

Expected: Both start with `---`

**Step 5: Squash into single commit if not already committed individually**

If individual commits were made:
```bash
git log --oneline -6
```

All validation passes = done.
