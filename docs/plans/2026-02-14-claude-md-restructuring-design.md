# CLAUDE.md Restructuring Design

**Date:** 2026-02-14
**Goal:** Break monolithic guidance files into scoped, lazy-loaded CLAUDE.md hierarchy. Optimize for signal, non-redundancy, and token efficiency.

## Current State (4 files, 1,483 lines)

| File | Lines | Content |
|------|-------|---------|
| `CLAUDE.md` (root) | 328 | Workflow, git, notifications, beads, MCP plugins, env setup, E2E protocols |
| `docs/codebase-patterns.md` | 921 | ALL patterns — pages, tRPC, forms, styling, auth, AI, exports, anti-patterns |
| `src/components/ui/CLAUDE.md` | 58 | UI component quick-reference table |
| `src/server/CLAUDE.md` | 176 | Server procedures, Drizzle patterns, schema, error codes |

**Problems:** codebase-patterns.md is a 921-line monolith mixing frontend, backend, DB, auth, and styling. Root CLAUDE.md has duplicated sections (worktree instructions appear twice). Project status lists go stale. Everything loads into context regardless of what directory the agent is working in.

## Target State (9 files, ~958 lines)

### Discovery Mechanisms

Claude Code has two file discovery mechanisms:

1. **`CLAUDE.md` in source directories** — lazy-loaded when Claude accesses files in that subtree. Ideal for large, directory-specific guidance.
2. **`.claude/rules/*.md`** — always loaded at session start. Ideal for small, cross-cutting rules.

### File Structure

```
CLAUDE.md                        (~120 lines) — workflow/process only          [always loaded]
.claude/rules/conventions.md     (~40 lines)  — cross-cutting conventions      [always loaded]
.claude/rules/anti-patterns.md   (~60 lines)  — version-specific DO/DON'T     [always loaded]
src/app/CLAUDE.md                (~140 lines) — page templates, routing, nav   [lazy]
src/components/CLAUDE.md         (~170 lines) — component patterns, styling    [lazy]
src/components/ui/CLAUDE.md      (58 lines)   — UNCHANGED                     [lazy]
src/server/CLAUDE.md             (~200 lines) — tRPC, Drizzle, auth, AI       [lazy]
src/lib/CLAUDE.md                (~80 lines)  — utilities, clients, exports    [lazy]
e2e/CLAUDE.md                    (~90 lines)  — E2E standards, Playwright     [lazy]
```

Always-loaded context: ~220 lines (down from 328).
Total: ~958 lines (down from 1,483).

### Content Migration Map

| codebase-patterns.md Section | Destination |
|-----|-----|
| 1. Page Template Pattern | `src/app/CLAUDE.md` |
| 2. tRPC Data Fetching (client-side) | `src/components/CLAUDE.md` |
| 3. Form Patterns | `src/components/CLAUDE.md` |
| 4. Toast / Notification System | `src/components/CLAUDE.md` |
| 5. Loading States & Skeletons | `src/components/CLAUDE.md` |
| 6. Modal & Dialog Patterns | `src/components/CLAUDE.md` |
| 7. Styling System | `src/components/CLAUDE.md` |
| 8. Component Composition Patterns | `src/components/CLAUDE.md` |
| 9. Error Handling | Split: API sanitization → `src/server/`, inline states → `src/components/` |
| 10. Authentication | Split: middleware → `src/app/`, server → `src/server/`, client → `src/lib/` |
| 11. File Uploads | `src/lib/CLAUDE.md` |
| 12. Navigation | `src/app/CLAUDE.md` |
| 13. Utility Functions | `src/lib/CLAUDE.md` |
| 14. Context Providers | `src/app/CLAUDE.md` |
| 15. Plan / Subscription Gating | Split: server → `src/server/`, client → `src/components/` |
| 16. Onboarding Tours | `src/app/CLAUDE.md` |
| 17. AI Integrations | `src/server/CLAUDE.md` |
| 18. Export Patterns | `src/lib/CLAUDE.md` |
| Anti-patterns (per-tech) | `.claude/rules/anti-patterns.md` |
| Import ordering, naming | `.claude/rules/conventions.md` |
| Tech Stack table | `CLAUDE.md` root (compact one-liner) |

### What Gets Removed

- **Project status/roadmap lists** — stale quickly, tracked in beads
- **Duplicated worktree instructions** — appeared in both "CRITICAL" section and "Git Worktrees" section
- **Playwright screenshot code block** — moves from root to `e2e/CLAUDE.md`
- **Verbose explanations** — replaced with tables where possible

### Design Principles

1. **Each file is self-sufficient for its scope** — an agent working in `src/server/` gets everything it needs from `src/server/CLAUDE.md` + always-loaded rules
2. **No duplication across files** — each rule lives in exactly one place
3. **Lazy > eager** — large code examples only load when working in the relevant directory
4. **Always-loaded = small + universal** — conventions and anti-patterns (~100 lines) apply everywhere and prevent version-specific mistakes
5. **Under 250 lines per file** — official guidance says under 500, we target half that

## File Contents

### CLAUDE.md (root, ~120 lines)
- Tech stack (one-liner)
- Scoped guidance directory (links to all sub-files)
- Token efficiency rule
- Worktree requirement (single, non-duplicated version)
- MCP plugins table (compact)
- Beads commands table
- Task completion workflow
- Staging & production branch model
- TDD development workflow (condensed, references e2e/CLAUDE.md)
- Environment spin-up procedure
- Notification rules

### .claude/rules/conventions.md (~40 lines)
- Import ordering
- Naming conventions (handleX/onX, key usage)
- "use client" directive rules
- Type patterns (ComponentProps, z.infer)
- Icon import conventions

### .claude/rules/anti-patterns.md (~60 lines)
- React 19 DO/DON'T table
- tRPC v11 / React Query v5 DO/DON'T table
- Drizzle ORM 0.45 DO/DON'T table
- BetterAuth v1 DO/DON'T table
- Tailwind CSS v4 DO/DON'T table
- Zod v4 DO/DON'T table
- Sonner v2, Stripe v20, Recharts v3, Playwright DO/DON'T tables

### src/app/CLAUDE.md (~140 lines)
- Page template (3-state pattern with code)
- Server component pages (rare)
- Suspense boundary pages
- Middleware overview
- Navigation (sidebar, header, breadcrumbs)
- Feature flags
- Context providers (provider tree)
- Onboarding tours
- Responsive grid reference

### src/components/CLAUDE.md (~170 lines)
- tRPC data fetching (client-side queries, mutations, optimistic updates, prefetching, pagination)
- Form pattern (react-hook-form + zod + shadcn)
- Toast patterns (sonner)
- Modal patterns (Dialog, AlertDialog, Sheet)
- Loading states
- Styling system (Tailwind v4, cn(), animations)
- Component composition (CVA, Radix wrapping, asChild, compound components)
- Plan gating (client-side)
- Error states (inline)

### src/components/ui/CLAUDE.md (58 lines, UNCHANGED)
- Component reference table
- Domain-specific skeletons table
- Key conventions

### src/server/CLAUDE.md (~200 lines, expanded from existing 176)
- Key files table
- Procedure types
- Context shape
- Router template (full code example)
- Drizzle query patterns
- Schema conventions
- Error codes table
- API error sanitization
- Server-side auth
- Plan gating (server-side)
- AI integrations (chat + categorization)

### src/lib/CLAUDE.md (~80 lines)
- Key files table
- Date formatting table
- Currency formatting
- Class merging (cn)
- Error messages (getErrorMessage)
- Supabase client (lazy proxy)
- Auth client
- File upload flow
- Export patterns (CSV, PDF, Excel)

### e2e/CLAUDE.md (~90 lines)
- Test standards (6 rules)
- Auth fixture reference
- Authenticated screenshots code block
- Directory structure
- Config notes (auto dev server, plan limits, env vars)
- Failure investigation protocol (attempt 1, 2, escalate)

## Deleted Files

- `docs/codebase-patterns.md` — all 921 lines migrated to sub-files
