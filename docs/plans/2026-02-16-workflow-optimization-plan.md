# Workflow Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add quality-gate hooks, extract repeatable workflows into on-demand skills, slim CLAUDE.md to ~150 lines, and formalize context management patterns.

**Architecture:** Shell hook scripts in `.claude/hooks/`, SKILL.md files in `.claude/skills/*/`, slimmed CLAUDE.md pointing to skills for detailed workflows.

**Tech Stack:** Bash (hooks), Markdown (skills/CLAUDE.md), jq (JSON parsing in hooks)

---

### Task 1: Create hook scripts directory and lint hook

**Files:**
- Create: `.claude/hooks/lint-changed.sh`

**Step 1: Create the lint hook script**

```bash
#!/bin/bash
# PostToolUse hook: runs ESLint on files changed by Edit/Write tools
# Receives JSON on stdin with tool_input.file_path
# Exit 0 = success (stdout goes to Claude context)
# Exit 2 = block (not used here, lint is advisory)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only lint TypeScript/JavaScript files
if [[ -z "$FILE_PATH" ]] || [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  exit 0
fi

# Run ESLint on just the changed file (suppress exit code, report errors)
RESULT=$(npx eslint "$FILE_PATH" --format compact 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "⚠️ Lint issues in $FILE_PATH:"
  echo "$RESULT"
  exit 0  # Advisory — don't block, just inform
fi

exit 0
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/lint-changed.sh`

**Step 3: Commit**

```bash
git add .claude/hooks/lint-changed.sh
git commit -m "chore: add PostToolUse lint hook for changed files"
```

---

### Task 2: Create destructive command blocker hook

**Files:**
- Create: `.claude/hooks/block-destructive.sh`

**Step 1: Create the blocker script**

```bash
#!/bin/bash
# PreToolUse hook: blocks destructive bash commands
# Exit 0 = allow, Exit 2 = block (stderr shown to Claude)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Patterns to block
BLOCKED_PATTERNS=(
  "rm -rf /"
  "rm -rf ~"
  "rm -rf \."
  "git reset --hard"
  "git clean -fd"
  "git push.*--force.*main"
  "git push.*--force.*master"
  "DROP TABLE"
  "DROP DATABASE"
  "TRUNCATE"
  "git push.*-f.*main"
  "git push.*-f.*master"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qiE "$pattern"; then
    echo "BLOCKED: Destructive command detected: $pattern" >&2
    echo "If you need to run this, ask the user for explicit confirmation first." >&2
    exit 2
  fi
done

exit 0
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/block-destructive.sh`

**Step 3: Commit**

```bash
git add .claude/hooks/block-destructive.sh
git commit -m "chore: add PreToolUse hook to block destructive commands"
```

---

### Task 3: Create PreCompact progress saver hook

**Files:**
- Create: `.claude/hooks/save-progress.sh`

**Step 1: Create the progress saver script**

```bash
#!/bin/bash
# PreCompact hook: reminds Claude what to preserve during compaction
# Output goes to Claude's context before compaction happens

echo "COMPACTION REMINDER — Preserve the following in your summary:"
echo "  1. Current beads task ID (from bd show)"
echo "  2. All files modified in this session"
echo "  3. Current implementation plan file path (if any)"
echo "  4. Any failing test names and their error messages"
echo "  5. The current step number in the plan"
echo "  6. Any decisions made with the user during this session"

exit 0
```

**Step 2: Make it executable**

Run: `chmod +x .claude/hooks/save-progress.sh`

**Step 3: Commit**

```bash
git add .claude/hooks/save-progress.sh
git commit -m "chore: add PreCompact hook for context preservation reminders"
```

---

### Task 4: Configure hooks in project settings

**Files:**
- Create: `.claude/settings.json`

**Step 1: Create project-level settings with hook configuration**

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

Note: The `Stop` notification hook moves from `~/.claude/settings.json` to project-level. Keep the `Notification` hook in user settings since it applies globally.

**Step 2: Create the notify-on-stop script in the project**

```bash
#!/bin/bash
# Stop hook: notify user that Claude has finished
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "Claude Code has finished working" \
  -H "Title: Claude Code" \
  -H "Priority: default" > /dev/null 2>&1

osascript -e 'display notification "Claude Code has finished" with title "Claude Code"' 2>/dev/null

exit 0
```

Run: `chmod +x .claude/hooks/notify-on-stop.sh`

**Step 3: Commit**

```bash
git add .claude/settings.json .claude/hooks/notify-on-stop.sh
git commit -m "chore: configure project-level hooks (lint, block-destructive, pre-compact, notify)"
```

---

### Task 5: Create TDD workflow skill

**Files:**
- Create: `.claude/skills/tdd-workflow/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: tdd-workflow
description: Use when implementing features or bugfixes with test-driven development. Provides the full TDD workflow with environment spin-up, red-green-refactor, and PR creation.
disable-model-invocation: true
---

# TDD Development Workflow

Every feature must be test-driven and E2E validated. See `e2e/CLAUDE.md` for test standards and failure protocol.

## Steps

1. **Pick task** → `bd ready` / `bd show <id>`
2. **Create worktree** → branch from `develop`
   ```bash
   git worktree add ~/worktrees/property-tracker/<name> -b feature/<name> develop
   cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/<name>/.env.local
   cd ~/worktrees/property-tracker/<name>
   ```
3. **Brainstorm** → `superpowers:brainstorming` + context7
4. **Plan** → `superpowers:writing-plans` or `/feature-dev`
5. **Write tests FIRST (Red)** → unit (Vitest) + E2E (Playwright)
6. **Spin up env** → confirm tests fail (invoke `/env-spinup`)
7. **Implement (Green)** → use context7, frontend-design, typescript-lsp, supabase as needed
8. **Validate** → full env restart, all tests pass
9. **Verify** → `superpowers:verification-before-completion` (lint, build, types)
10. **PR** → `gh pr create --base develop` → `/code-review` → `gh pr checks --watch` → merge
11. **Cleanup** → remove worktree → `bd done <id>` → `/clear`

## Writer/Reviewer Pattern (for complex features)

After implementation (step 8), consider opening a second Claude Code session for review:
- Session B reviews with fresh context (no bias toward its own code)
- Use `/code-review` in Session B
- Address feedback in the original session (Session A)
```

**Step 2: Commit**

```bash
git add .claude/skills/tdd-workflow/SKILL.md
git commit -m "chore: extract TDD workflow into on-demand skill"
```

---

### Task 6: Create environment spin-up skill

**Files:**
- Create: `.claude/skills/env-spinup/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: env-spinup
description: Spin up the local development environment — Docker, database, schema push, and test validation. Use before running tests.
disable-model-invocation: true
---

# Environment Spin-Up

Run before every test validation. Full restart each time.

```bash
docker compose down && docker compose up -d
until docker compose exec db pg_isready -U postgres 2>/dev/null; do sleep 1; done
docker compose exec db psql -U postgres -c "CREATE DATABASE bricktrack;" 2>/dev/null || true
npx drizzle-kit push
npm run test:unit
npm run test:e2e
```

## Key Details

- Playwright auto-starts dev server via `webServer` config in `playwright.config.ts`
- `.env.local` DATABASE_URL must point to `bricktrack` database (not `property_tracker`)
- E2E requires: `BETTER_AUTH_SECRET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` in `.env.local`
- DB runs via Docker Compose with `pgvector/pg16`
- Must manually create `bricktrack` db after fresh container (the `CREATE DATABASE` command above handles this)
```

**Step 2: Commit**

```bash
git add .claude/skills/env-spinup/SKILL.md
git commit -m "chore: extract environment spin-up into on-demand skill"
```

---

### Task 7: Create task completion skill

**Files:**
- Create: `.claude/skills/task-complete/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: task-complete
description: Complete a beads task — mark done, create PR, merge, and clean up worktree. Use after all tests pass and verification is complete.
disable-model-invocation: true
---

# Task Completion Workflow

## Steps

1. **Mark task done**: `bd done <id>`
2. **Create PR**: `gh pr create --base develop` with descriptive title and summary
3. **Code review**: `/code-review` → address any findings
4. **Watch CI**: `gh pr checks --watch`
5. **Merge PR**: `gh pr merge --squash`
6. **Remove worktree**:
   ```bash
   cd ~/Documents/property-tracker
   git worktree remove ~/worktrees/property-tracker/<name>
   ```
7. **Next task**: `/compact` → `bd ready`

## When Ready to Release

1. Verify staging (`staging.bricktrack.au`) works correctly
2. Create PR: `develop` → `main`
3. Merge after CI passes
4. Production deploys automatically to `bricktrack.au`
```

**Step 2: Commit**

```bash
git add .claude/skills/task-complete/SKILL.md
git commit -m "chore: extract task completion workflow into on-demand skill"
```

---

### Task 8: Create document-continue skill

**Files:**
- Create: `.claude/skills/document-continue/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: document-continue
description: Save current progress to a file before /clear so a fresh session can continue where you left off. Use when context is getting full mid-task.
disable-model-invocation: true
---

# Document & Continue

When context is getting full mid-task, save progress before `/clear`.

## Steps

1. **Create progress file** at `docs/plans/PROGRESS-<task-id>.md` with:
   ```markdown
   # Progress: <Task Title>

   **Beads task:** <id>
   **Branch:** <current branch name>
   **Plan:** <path to plan file if one exists>
   **Step:** <current step number in plan>

   ## Modified Files
   - list every file changed in this session

   ## Current State
   - what's working
   - what's failing (include test names and error messages)

   ## Next Steps
   - exactly what to do next
   - any decisions already made with the user
   ```

2. **User runs** `/clear`

3. **New session starts with:** "Read `docs/plans/PROGRESS-<task-id>.md` and continue from there"

## Tips

- Include exact test commands that were run
- Include any user decisions or preferences expressed during the session
- Be specific about what's left — "implement the remaining 3 mutations" not "finish the feature"
```

**Step 2: Commit**

```bash
git add .claude/skills/document-continue/SKILL.md
git commit -m "chore: add document-continue skill for context handoff"
```

---

### Task 9: Create new-router runbook skill

**Files:**
- Create: `.claude/skills/new-router/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: new-router
description: Scaffold a new tRPC router with repository, interface, tests, and barrel exports following project conventions
---

# New Router Runbook

## Files to Create

Given a domain name `<domain>` (e.g., "invoice"):

1. **Repository interface**: `src/server/repositories/<domain>-repository.ts`
2. **Repository implementation**: (in same file or separate)
3. **Router**: `src/server/routers/<domain>.ts`
4. **Unit tests**: `src/server/routers/__tests__/<domain>.test.ts`
5. **Register in app router**: `src/server/routers/_app.ts`

## Repository Template

See `src/server/CLAUDE.md` for the full repository pattern. Key points:
- Implement an interface with typed methods
- Use `Partial<SchemaType>` for update data (never `Record<string, unknown>`)
- Always scope queries by `userId` / `ownerId`
- Return typed values (never `Promise<unknown>`)

## Router Template

See `src/server/CLAUDE.md` for the router template. Key points:
- Routers are thin controllers — data access through `ctx.uow`
- Use `protectedProcedure` for reads, `writeProcedure` for mutations
- Use `proProcedure` / `teamProcedure` for gated features
- Always validate input with Zod schemas
- Use `.returning()` on insert/update

## Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUow } from "@/server/test-utils";

describe("<domain> router", () => {
  const mockUow = createMockUow();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists items for the owner", async () => {
    // Arrange
    mockUow.<domain>.findByOwner.mockResolvedValue([]);
    // Act + Assert
  });
});
```

## Registration

Add to `src/server/routers/_app.ts`:
```typescript
import { <domain>Router } from "./<domain>";
// In the router() call:
<domain>: <domain>Router,
```

## Checklist

- [ ] Repository interface with typed methods
- [ ] Router with appropriate procedure types
- [ ] Unit tests covering list, get, create, update, delete
- [ ] Registered in `_app.ts`
- [ ] Input validation with Zod
- [ ] User scoping on all queries (`ctx.portfolio.ownerId`)
```

**Step 2: Commit**

```bash
git add .claude/skills/new-router/SKILL.md
git commit -m "chore: add new-router runbook skill"
```

---

### Task 10: Create new-component runbook skill

**Files:**
- Create: `.claude/skills/new-component/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: new-component
description: Create a React component following project conventions — imports, types, cn(), tRPC patterns
---

# New Component Runbook

## Conventions

See `src/components/CLAUDE.md` for full patterns. Key points:

### Import Order
```tsx
"use client";                                    // 1. Directive (only if needed)
import { useState } from "react";                // 2. React
import Link from "next/link";                    // 3. Next.js
import { Plus } from "lucide-react";             // 4. Third-party
import { Button } from "@/components/ui/button"; // 5. Internal UI
import { MyCard } from "@/components/my/MyCard";  // 6. Internal app
import { trpc } from "@/lib/trpc/client";        // 7. Internal lib
import { MyHelper } from "./MyHelper";            // 8. Relative
```

### Type Patterns
- UI components: inline types `React.ComponentProps<"div">`
- App components: file-local `interface` (NOT exported)
- Never export prop interfaces
- Use `z.infer<typeof schema>` for form types

### Styling
- Use `cn()` for conditional classes: `cn("base", conditional && "extra", className)`
- Tailwind v4 — CSS variables for colors: `var(--color-primary)`
- No hardcoded hex colors

### Icons
- `import { Plus } from "lucide-react"` (named imports only)
- `<Plus className="w-4 h-4" />` (Tailwind classes, not `size` prop)

### tRPC Data Fetching
```tsx
const { data, isLoading } = trpc.<domain>.<method>.useQuery({ ... });
const utils = trpc.useUtils();
const mutation = trpc.<domain>.<method>.useMutation({
  onSuccess: () => utils.<domain>.list.invalidate(),
});
```

### "use client" Directive
Only add when the component needs hooks or interactivity. Server components by default.

## Checklist

- [ ] Import order follows convention
- [ ] Types are file-local (not exported)
- [ ] `cn()` used for class merging
- [ ] Icons use named imports + Tailwind sizing
- [ ] `"use client"` only if hooks/interactivity needed
- [ ] No anti-patterns from `.claude/rules/anti-patterns.md`
```

**Step 2: Commit**

```bash
git add .claude/skills/new-component/SKILL.md
git commit -m "chore: add new-component runbook skill"
```

---

### Task 11: Create new-e2e-test runbook skill

**Files:**
- Create: `.claude/skills/new-e2e-test/SKILL.md`

**Step 1: Create the skill file**

```markdown
---
name: new-e2e-test
description: Create a Playwright E2E test with auth fixture, cleanup, accessibility checks, and error monitoring
---

# New E2E Test Runbook

See `e2e/CLAUDE.md` for full test standards and failure protocol.

## Where to Put Tests

| Category | Directory | Auth Required | Timeout |
|----------|-----------|---------------|---------|
| Public pages | `e2e/public/` | No | 30s |
| Authenticated features | `e2e/authenticated/` | Yes (storageState) | 30s |
| Long flows (bank connect) | `e2e/core-loop/` | Yes (storageState) | 300s |

**Add to existing spec files** when the feature fits an existing category. Create new spec only for genuinely new domains.

## Test Template

```typescript
import { test, expect } from "@playwright/test";

test.describe("<Feature Name>", () => {
  // Catch uncaught page errors
  test.beforeEach(async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));

    // Store for afterEach check
    (page as any).__pageErrors = errors;
  });

  test.afterEach(async ({ page }) => {
    const errors = (page as any).__pageErrors || [];
    expect(errors).toHaveLength(0);
  });

  test("should do the thing", async ({ page }) => {
    await page.goto("/path");
    await expect(page.getByRole("heading", { name: "Title" })).toBeVisible();

    // Interact
    await page.getByRole("button", { name: "Action" }).click();

    // Verify
    await expect(page.getByText("Success")).toBeVisible();
  });
});
```

## Key Patterns

### Selectors (prefer accessibility)
```typescript
// Good
page.getByRole("button", { name: "Save" })
page.getByLabel("Email")
page.getByText("Success")

// Bad
page.locator("#save-btn")
page.locator(".success-message")
```

### Cleanup (required for data-creating tests)
```typescript
test.afterAll(async ({ page }) => {
  // Delete created test entities
  // Free plan allows only 1 property — cleanup is critical
});
```

### Auth
Tests in `e2e/authenticated/` and `e2e/core-loop/` automatically get auth via `storageState` configured in `playwright.config.ts`. No manual login needed.

## Checklist

- [ ] Uses `page.on('pageerror')` to catch uncaught exceptions
- [ ] Accessibility-first selectors (`getByRole`, `getByLabel`, `getByText`)
- [ ] Cleans up created data in `afterAll`
- [ ] Added to existing spec file if feature fits
- [ ] Respects free plan limits (1 property max)
- [ ] No hardcoded credentials
```

**Step 2: Commit**

```bash
git add .claude/skills/new-e2e-test/SKILL.md
git commit -m "chore: add new-e2e-test runbook skill"
```

---

### Task 12: Slim down CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Rewrite CLAUDE.md to ~150 lines**

Remove the Development Workflow (TDD), Environment Spin-Up, and Task Completion Workflow sections. Replace with references to skills. Add Context Hygiene section.

The new CLAUDE.md should contain:

```markdown
# Claude Code Rules

**Stack:** Next.js 16 (App Router) · React 19 · tRPC v11 · Drizzle ORM · BetterAuth · Tailwind v4 · Zod v4 · Stripe · Supabase (storage) · Playwright

## Scoped Guidance

| Scope | File | Content |
|-------|------|---------|
| Cross-cutting conventions | `.claude/rules/conventions.md` | Import ordering, naming, types, icons |
| Version-specific anti-patterns | `.claude/rules/anti-patterns.md` | DO/DON'T for React 19, tRPC v11, Drizzle, etc. |
| Pages & routing | `src/app/CLAUDE.md` | Page templates, middleware, navigation, providers |
| Component patterns | `src/components/CLAUDE.md` | tRPC client, forms, toasts, modals, styling |
| UI component reference | `src/components/ui/CLAUDE.md` | Component table (imports, props, usage) |
| Server & data layer | `src/server/CLAUDE.md` | Procedures, Drizzle, auth, AI, error codes |
| Utilities & clients | `src/lib/CLAUDE.md` | Formatting, Supabase, auth client, exports |
| E2E testing | `e2e/CLAUDE.md` | Standards, auth fixture, failure protocol |

## On-Demand Skills

| Skill | Invoke | Purpose |
|-------|--------|---------|
| TDD Workflow | `/tdd-workflow` | Full development workflow with red-green-refactor |
| Environment Spin-Up | `/env-spinup` | Docker, DB, schema push, test validation |
| Task Completion | `/task-complete` | bd done, PR, merge, worktree cleanup |
| Document & Continue | `/document-continue` | Save progress before /clear for context handoff |
| New Router | `/new-router` | Scaffold tRPC router + repo + tests |
| New Component | `/new-component` | React component following conventions |
| New E2E Test | `/new-e2e-test` | Playwright test with auth + cleanup |

## Anti-Pattern Zero Tolerance
**NEVER copy patterns from existing codebase without verifying against context7 and `.claude/rules/anti-patterns.md`.**

1. **Context7 is mandatory** — query current docs for every technology before coding
2. **Existing code is not a source of truth** — fix anti-patterns, don't copy them
3. **Plans must include a "Tech Notes" section** — prove validation against real docs
4. **When moving code, audit it** — fix anti-patterns in the same PR
5. **Type safety is non-negotiable** — no `any`, no `unknown` where real types exist

## Token Efficiency
- Always pick the token-efficient approach
- For investigation requiring 3+ file reads, delegate to Task subagent
- Minimize unnecessary exploration and verbose output

## Context Hygiene
- `/clear` between unrelated tasks
- Before `/clear` mid-task, invoke `/document-continue`
- When compacting, preserve: beads task ID, modified files, plan path, test commands
- At 40% context, consider `/compact` with specific preservation instructions

## Worktree Requirement
**NEVER start feature or task work in the main repository directory.**
```bash
git worktree add ~/worktrees/property-tracker/<name> -b feature/<name> develop
cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/<name>/.env.local
cd ~/worktrees/property-tracker/<name>
```
Only trivial doc/config edits may be done directly on main/develop.

## MCP Plugins (Required)

| Plugin | When to use |
|--------|-------------|
| **context7** | Before coding with ANY dependency — fetch current docs, never guess APIs |
| **frontend-design** | Building or modifying any UI component, page, or layout |
| **feature-dev** | Non-trivial features touching 3+ files (`/feature-dev`) |
| **code-review** | After every PR, before merge (`/code-review`) |
| **playwright** | Writing/debugging E2E tests, browser automation |
| **typescript-lsp** | Go-to-definition, find-references, type checking |
| **supabase** | Schema changes, migrations, direct SQL queries |
| **github** | Issues, PRs, code search (preferred over `gh` CLI) |

## Task Management (Beads)

| Command | Purpose |
|---------|---------|
| `bd ready` | Show tasks with no blockers |
| `bd show <id>` | View full task details |
| `bd update <id> -m "note"` | Track progress |
| `bd block <id> -m "reason"` | Mark if blocked |
| `bd done <id>` | Mark task complete |
| `bd create "Title" -p 1` | Create task (0=urgent, 3=low) |
| `bd dep add <child> <parent>` | Set dependencies |

## Staging & Production
- `develop` = staging (`staging.bricktrack.au`), `main` = production (`bricktrack.au`)
- Feature branches → `develop`. Exception: `hotfix/*` → `main` (then merge main back to develop)
- **Promote:** verify staging → PR `develop` → `main` → merge after CI
- **Rollback:** Vercel dashboard → Promote previous deployment, or `git revert -m 1 <sha>`

## Notifications
**CRITICAL: ALWAYS notify via ntfy when waiting for input, task complete, error, or CI done.**
```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "YOUR MESSAGE HERE" -H "Title: Claude Code" -H "Priority: high"
osascript -e 'display notification "YOUR MESSAGE HERE" with title "Claude Code"'
```
```

**Step 2: Verify line count**

Run: `wc -l CLAUDE.md`
Expected: ~110-120 lines (well under 150 target)

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "chore: slim CLAUDE.md — extract workflows to on-demand skills"
```

---

### Task 13: Update MEMORY.md

**Files:**
- Modify: `/Users/matthewgleeson/.claude/projects/-Users-matthewgleeson-Documents-property-tracker/memory/MEMORY.md`

**Step 1: Add skills and hooks info to memory**

Add under a new `## Skills & Hooks` section:

```markdown
## Skills & Hooks
- 7 custom skills in `.claude/skills/`: tdd-workflow, env-spinup, task-complete, document-continue, new-router, new-component, new-e2e-test
- 4 hooks in `.claude/hooks/`: lint-changed (PostToolUse), block-destructive (PreToolUse), save-progress (PreCompact), notify-on-stop (Stop)
- Hook config in `.claude/settings.json` (project-level, committable)
- Skills are manual invocation only (`disable-model-invocation: true`)
```

Update the Beads Commands section to fix the `bd close` vs `bd done` discrepancy — CLAUDE.md says `bd done`, so memory should match.

**Step 2: No commit needed** (memory files are not in git)

---

### Task 14: Final validation

**Step 1: Verify all files exist**

Run: `ls -la .claude/hooks/ .claude/skills/*/SKILL.md .claude/settings.json`

Expected: 4 hook scripts, 7 SKILL.md files, 1 settings.json

**Step 2: Verify CLAUDE.md is under 150 lines**

Run: `wc -l CLAUDE.md`

Expected: < 150

**Step 3: Verify hooks are executable**

Run: `file .claude/hooks/*.sh`

Expected: All show as "shell script" or "Bourne-Again shell script"

**Step 4: Verify no broken references**

Check that CLAUDE.md references to skills and scoped files all exist:

Run: `ls src/app/CLAUDE.md src/components/CLAUDE.md src/components/ui/CLAUDE.md src/server/CLAUDE.md src/lib/CLAUDE.md e2e/CLAUDE.md .claude/rules/conventions.md .claude/rules/anti-patterns.md`

Expected: All files exist

**Step 5: Final commit (squash if needed)**

If any fixups were needed:
```bash
git add -A
git commit -m "chore: workflow optimization — hooks, skills, slimmed CLAUDE.md"
```
