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

## Notifications
**CRITICAL: ALWAYS notify via ntfy when waiting for input, task complete, error, or CI done.**
```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "YOUR MESSAGE HERE" -H "Title: Claude Code" -H "Priority: high"
osascript -e 'display notification "YOUR MESSAGE HERE" with title "Claude Code"'
```
