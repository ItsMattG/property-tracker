# CLAUDE.md Restructuring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break monolithic guidance files into scoped, lazy-loaded CLAUDE.md hierarchy across 4 independent PRs.

**Architecture:** Pure content migration — no code changes. Each PR creates/modifies markdown files in a specific scope. PRs are independent and can merge in any order, except PR 4 (cleanup) which goes last.

**Tech Stack:** Claude Code CLAUDE.md discovery, `.claude/rules/` directory

**Design doc:** `docs/plans/2026-02-14-claude-md-restructuring-design.md`

**Context7 best practices applied:**
- Each rules file covers a single topic
- Descriptive filenames in `.claude/rules/`
- Subdirectory CLAUDE.md files are self-sufficient for their scope

---

## PR 1: Always-Loaded Rules (`.claude/rules/`)

**Branch:** `feature/claude-rules-files`
**Scope:** Create `.claude/rules/conventions.md` and `.claude/rules/anti-patterns.md`
**Why first:** These are referenced by other files and have no dependencies.

### Task 1.1: Create conventions.md

**Files:**
- Create: `.claude/rules/conventions.md`

**Step 1: Create the file**

Write `.claude/rules/conventions.md` with content from design doc Section ".claude/rules/conventions.md":
- Import ordering (8-level grouping with code example)
- Naming conventions (handleX/onX, key usage)
- "use client" directive rules
- Type patterns (ComponentProps, z.infer)
- Icon import conventions (lucide-react named imports, Tailwind classes)

**Source content:** `docs/codebase-patterns.md` sections:
- "Import Ordering" (lines 909-921)
- "General Conventions" (lines 899-907)
- "Type Patterns" (lines 543-547)
- "Lucide Icons" (lines 893-897)

**Step 2: Verify file loads**

```bash
# Confirm file is in the right location
ls -la .claude/rules/conventions.md
# Confirm it's under 50 lines
wc -l .claude/rules/conventions.md
```

**Step 3: Commit**

```bash
git add .claude/rules/conventions.md
git commit -m "docs: add cross-cutting conventions to .claude/rules/"
```

### Task 1.2: Create anti-patterns.md

**Files:**
- Create: `.claude/rules/anti-patterns.md`

**Step 1: Create the file**

Write `.claude/rules/anti-patterns.md` with content from design doc Section ".claude/rules/anti-patterns.md":
- DO/DON'T tables for: React 19, tRPC v11, Drizzle 0.45, BetterAuth v1, Tailwind v4, Zod v4, Sonner v2, Stripe v20, Recharts v3, Playwright

**Source content:** `docs/codebase-patterns.md` sections:
- "Anti-Patterns: Do This, Not That" (lines 802-921) — extract version-specific tables only, NOT the general conventions (those went to conventions.md)

**Step 2: Verify**

```bash
wc -l .claude/rules/anti-patterns.md
# Should be ~60-70 lines
```

**Step 3: Commit**

```bash
git add .claude/rules/anti-patterns.md
git commit -m "docs: add version-specific anti-patterns to .claude/rules/"
```

### Task 1.3: Create PR

```bash
gh pr create --base develop --title "docs: add .claude/rules/ for cross-cutting conventions" --body "$(cat <<'EOF'
## Summary
- Creates `.claude/rules/conventions.md` — import ordering, naming, type patterns, icon usage
- Creates `.claude/rules/anti-patterns.md` — version-specific DO/DON'T for React 19, tRPC v11, Drizzle, BetterAuth, Tailwind v4, Zod v4, Sonner, Stripe, Recharts, Playwright
- These files are always-loaded at session start (~100 lines total)
- Part of CLAUDE.md restructuring: docs/plans/2026-02-14-claude-md-restructuring-design.md

## Test plan
- [ ] Start a new Claude Code session, verify rules appear in context
- [ ] Verify no duplication with existing files

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 2: Source Directory CLAUDE.md Files (Frontend)

**Branch:** `feature/claude-frontend-docs`
**Scope:** Create `src/app/CLAUDE.md`, `src/components/CLAUDE.md`, `src/lib/CLAUDE.md`
**Independent of PR 1.** Can merge in any order.

### Task 2.1: Create src/app/CLAUDE.md

**Files:**
- Create: `src/app/CLAUDE.md`

**Step 1: Create the file**

Write `src/app/CLAUDE.md` with content from design doc — page templates, routing, navigation, providers, tours, responsive grids.

**Source content from `docs/codebase-patterns.md`:**
- Section 1: Page Template Pattern (lines 38-137)
- Section 10: Authentication — middleware only (lines 576-619)
- Section 12: Navigation (lines 636-658)
- Section 14: Context Providers (lines 694-711)
- Section 16: Onboarding Tours (lines 744-759)
- Section 7: Responsive Grid Reference (lines 458-467)

**Step 2: Verify**

```bash
wc -l src/app/CLAUDE.md
# Should be ~140-150 lines
```

**Step 3: Commit**

```bash
git add src/app/CLAUDE.md
git commit -m "docs: add src/app/CLAUDE.md for page templates and routing"
```

### Task 2.2: Create src/components/CLAUDE.md

**Files:**
- Create: `src/components/CLAUDE.md`

**Step 1: Create the file**

Write `src/components/CLAUDE.md` with content from design doc — tRPC client-side fetching, forms, toasts, modals, loading states, styling, component composition, plan gating (client), error states.

**Source content from `docs/codebase-patterns.md`:**
- Section 2: tRPC Data Fetching (lines 141-243)
- Section 3: Form Patterns (lines 247-308)
- Section 4: Toast / Notification System (lines 310-342)
- Section 5: Loading States (lines 344-368)
- Section 6: Modal & Dialog Patterns (lines 370-425)
- Section 7: Styling System (lines 427-467) — minus responsive grids (those go to src/app/)
- Section 8: Component Composition Patterns (lines 474-547) — minus type patterns (those go to .claude/rules/)
- Section 9: Error Handling — inline states only (lines 560-567)
- Section 15: Plan Gating — client-side only (lines 728-739)

**Step 2: Verify**

```bash
wc -l src/components/CLAUDE.md
# Should be ~170-180 lines
```

**Step 3: Commit**

```bash
git add src/components/CLAUDE.md
git commit -m "docs: add src/components/CLAUDE.md for component patterns"
```

### Task 2.3: Create src/lib/CLAUDE.md

**Files:**
- Create: `src/lib/CLAUDE.md`

**Step 1: Create the file**

Write `src/lib/CLAUDE.md` with content from design doc — key files table, utilities, Supabase client, auth client, file uploads, exports.

**Source content from `docs/codebase-patterns.md`:**
- Section 13: Utility Functions (lines 662-690)
- Section 10: Authentication — client-side only (lines 609-615)
- Section 11: File Uploads (lines 622-633)
- Section 18: Export Patterns (lines 778-799)

Plus key files table from current `src/server/CLAUDE.md` client-side entries (lines 13-16).

**Step 2: Verify**

```bash
wc -l src/lib/CLAUDE.md
# Should be ~80-90 lines
```

**Step 3: Commit**

```bash
git add src/lib/CLAUDE.md
git commit -m "docs: add src/lib/CLAUDE.md for utilities and clients"
```

### Task 2.4: Create PR

```bash
gh pr create --base develop --title "docs: add frontend CLAUDE.md files for app, components, lib" --body "$(cat <<'EOF'
## Summary
- Creates `src/app/CLAUDE.md` — page templates, routing, middleware, navigation, providers, tours
- Creates `src/components/CLAUDE.md` — tRPC client patterns, forms, toasts, modals, styling, composition
- Creates `src/lib/CLAUDE.md` — utilities, tRPC/auth/Supabase clients, file uploads, exports
- All lazy-loaded only when working in the respective directory
- Part of CLAUDE.md restructuring: docs/plans/2026-02-14-claude-md-restructuring-design.md

## Test plan
- [ ] Open Claude Code, work in src/app/ — verify src/app/CLAUDE.md guidance appears
- [ ] Work in src/components/ — verify component guidance appears
- [ ] Work in src/lib/ — verify utility guidance appears

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 3: Server + E2E CLAUDE.md Files

**Branch:** `feature/claude-server-e2e-docs`
**Scope:** Expand `src/server/CLAUDE.md`, create `e2e/CLAUDE.md`
**Independent of PR 1 and 2.**

### Task 3.1: Expand src/server/CLAUDE.md

**Files:**
- Modify: `src/server/CLAUDE.md`

**Step 1: Read current file**

Read `src/server/CLAUDE.md` (176 lines currently).

**Step 2: Expand with additional content**

Add to the existing file (which already has procedures, context, router template, Drizzle patterns, schema, error codes):
- Server-side auth section (from codebase-patterns.md Section 10, lines 601-607)
- Plan gating server-side (from Section 15, lines 718-726)
- AI integrations (from Section 17, lines 764-776)
- API error sanitization (from Section 9, lines 569-573)

**Step 3: Verify**

```bash
wc -l src/server/CLAUDE.md
# Should be ~200-220 lines
```

**Step 4: Commit**

```bash
git add src/server/CLAUDE.md
git commit -m "docs: expand src/server/CLAUDE.md with auth, plan gating, AI, error sanitization"
```

### Task 3.2: Create e2e/CLAUDE.md

**Files:**
- Create: `e2e/CLAUDE.md`

**Step 1: Create the file**

Write `e2e/CLAUDE.md` with content from design doc — test standards, auth fixture, authenticated screenshots, directory structure, config, failure protocol.

**Source content from root `CLAUDE.md`:**
- "E2E Test Standards" (lines 271-279)
- "Playwright Authenticated Screenshots" (lines 247-269)
- "E2E Failure Investigation Protocol" (lines 282-300)

**Step 2: Verify**

```bash
wc -l e2e/CLAUDE.md
# Should be ~90-100 lines
```

**Step 3: Commit**

```bash
git add e2e/CLAUDE.md
git commit -m "docs: add e2e/CLAUDE.md for Playwright standards and failure protocol"
```

### Task 3.3: Create PR

```bash
gh pr create --base develop --title "docs: add server and E2E CLAUDE.md files" --body "$(cat <<'EOF'
## Summary
- Expands `src/server/CLAUDE.md` with auth, plan gating, AI integrations, error sanitization
- Creates `e2e/CLAUDE.md` — test standards, auth fixture, authenticated screenshots, failure protocol
- Part of CLAUDE.md restructuring: docs/plans/2026-02-14-claude-md-restructuring-design.md

## Test plan
- [ ] Work in src/server/ — verify expanded guidance appears
- [ ] Work in e2e/ — verify E2E standards appear

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR 4: Root Rewrite + Cleanup (LAST)

**Branch:** `feature/claude-root-rewrite`
**Scope:** Rewrite root `CLAUDE.md`, delete `docs/codebase-patterns.md`
**MUST merge after PRs 1-3** — this removes content that the other PRs migrated.

### Task 4.1: Rewrite root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Read current file**

Read `CLAUDE.md` (328 lines currently).

**Step 2: Rewrite with condensed content**

Replace entire file with content from design doc Section "CLAUDE.md (root, ~120 lines)":
- Tech stack one-liner
- Scoped guidance directory (links to all sub-files)
- Token efficiency
- Worktree requirement (single version, not duplicated)
- MCP plugins table (compact)
- Beads commands table
- Task completion workflow
- Staging & production
- TDD workflow (condensed, references e2e/CLAUDE.md)
- Environment spin-up
- Notifications

**Removed from root:**
- Project status/roadmap lists
- Duplicated worktree section
- E2E test standards (moved to e2e/CLAUDE.md)
- Playwright screenshot code (moved to e2e/CLAUDE.md)
- E2E failure protocol (moved to e2e/CLAUDE.md)

**Step 3: Verify**

```bash
wc -l CLAUDE.md
# Should be ~120 lines
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite root CLAUDE.md — workflow only, no patterns"
```

### Task 4.2: Delete docs/codebase-patterns.md

**Step 1: Verify all content has been migrated**

Before deleting, confirm every section has a new home:
- Sections 1, 10 (middleware), 12, 14, 16, grids → `src/app/CLAUDE.md` (PR 2)
- Sections 2-8, 9 (inline), 15 (client) → `src/components/CLAUDE.md` (PR 2)
- Sections 11, 13, 18, 10 (client auth) → `src/lib/CLAUDE.md` (PR 2)
- Sections 9 (API), 10 (server), 15 (server), 17 → `src/server/CLAUDE.md` (PR 3)
- Anti-patterns → `.claude/rules/anti-patterns.md` (PR 1)
- Import/naming → `.claude/rules/conventions.md` (PR 1)
- Tech stack → root `CLAUDE.md` (this PR)

**Step 2: Delete**

```bash
git rm docs/codebase-patterns.md
git commit -m "docs: remove codebase-patterns.md — content migrated to scoped CLAUDE.md files"
```

### Task 4.3: Update any references to deleted file

**Step 1: Search for references**

```bash
# Search for any file referencing the deleted doc
grep -r "codebase-patterns" --include="*.md" --include="*.ts" --include="*.tsx" .
```

**Step 2: Update references**

Replace any `docs/codebase-patterns.md` references with pointers to the appropriate sub-CLAUDE.md file. Known references:
- `src/components/ui/CLAUDE.md` line 3: "See `docs/codebase-patterns.md`" → update to "See `src/components/CLAUDE.md`"
- `src/server/CLAUDE.md` line 3: "See `docs/codebase-patterns.md`" → update to relevant section note

**Step 3: Commit**

```bash
git add -A
git commit -m "docs: update references from codebase-patterns.md to scoped CLAUDE.md files"
```

### Task 4.4: Create PR

```bash
gh pr create --base develop --title "docs: rewrite root CLAUDE.md and remove codebase-patterns.md" --body "$(cat <<'EOF'
## Summary
- Rewrites root `CLAUDE.md` from 328 → ~120 lines (workflow/process only)
- Deletes `docs/codebase-patterns.md` (921 lines — all content migrated in PRs #X, #Y, #Z)
- Updates stale references to the deleted file
- Removes: project status lists, duplicated worktree section, E2E content (now in e2e/CLAUDE.md)

## Test plan
- [ ] Start new Claude Code session — verify root guidance is concise and workflow-focused
- [ ] Verify no broken references to codebase-patterns.md
- [ ] Verify all sub-CLAUDE.md files exist and are discoverable

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Execution Order

```
PR 1 (.claude/rules/)  ─┐
PR 2 (frontend docs)   ─┼─ Independent, merge in any order
PR 3 (server + e2e)    ─┘
         │
         ▼
PR 4 (root rewrite + cleanup) ─ LAST, after 1-3 merged
```

**Session breakdown:**
- **Session 1:** PR 1 (small, ~15 min)
- **Session 2:** PR 2 (medium, ~30 min)
- **Session 3:** PR 3 (medium, ~20 min)
- **Session 4:** PR 4 (small, ~15 min, depends on 1-3 being merged)

Each session: create worktree → execute tasks → PR → merge → cleanup worktree.
