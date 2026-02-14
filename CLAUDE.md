# Claude Code Rules

**Stack:** Next.js 15 (App Router) · React 19 · tRPC v11 · Drizzle ORM · BetterAuth · Tailwind v4 · Zod v4 · Stripe · Supabase (storage) · Playwright

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

## Token Efficiency
Always pick the token-efficient approach. Minimize unnecessary exploration and verbose output.

## Worktree Requirement
**NEVER start feature or task work in the main repository directory.**
```bash
git worktree add ~/worktrees/property-tracker/<name> -b feature/<name> develop
cp ~/Documents/property-tracker/.env.local ~/worktrees/property-tracker/<name>/.env.local
cd ~/worktrees/property-tracker/<name>
# After merge:
git worktree remove ~/worktrees/property-tracker/<name>
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

**Context hygiene:** `/clear` at 40% context. Re-read task with `bd show <id>` after clearing.

## Task Completion Workflow
1. `bd done <id>`
2. Create PR targeting `develop` → merge
3. When ready to release: PR `develop` → `main` → merge
4. `/compact` → `bd ready` for next task

## Staging & Production
- `develop` = staging (`staging.bricktrack.au`), `main` = production (`bricktrack.au`)
- Feature branches → `develop`. Exception: `hotfix/*` → `main` (then merge main back to develop)
- **Promote:** verify staging → PR `develop` → `main` → merge after CI
- **Rollback:** Vercel dashboard → Promote previous deployment, or `git revert -m 1 <sha>`

## Development Workflow (TDD)
Every feature must be test-driven and E2E validated. See `e2e/CLAUDE.md` for test standards and failure protocol.

1. **Pick task** → `bd ready` / `bd show <id>`
2. **Create worktree** → branch from `develop`
3. **Brainstorm** → `superpowers:brainstorming` + context7
4. **Plan** → `superpowers:writing-plans` or `/feature-dev`
5. **Write tests FIRST (Red)** → unit (Vitest) + E2E (Playwright)
6. **Spin up env** → confirm tests fail (see Environment Spin-Up below)
7. **Implement (Green)** → use context7, frontend-design, typescript-lsp, supabase as needed
8. **Validate** → full env restart, all tests pass
9. **Verify** → `superpowers:verification-before-completion` (lint, build, types)
10. **PR** → `gh pr create --base develop` → `/code-review` → `gh pr checks --watch` → merge
11. **Cleanup** → remove worktree → `bd done <id>` → `/clear`

## Environment Spin-Up
Run before every test validation. Full restart each time.
```bash
docker compose down && docker compose up -d
until docker compose exec db pg_isready -U postgres 2>/dev/null; do sleep 1; done
docker compose exec db psql -U postgres -c "CREATE DATABASE bricktrack;" 2>/dev/null || true
npx drizzle-kit push
npm run test:unit
npm run test:e2e
```
- Playwright auto-starts dev server via `webServer` config
- `.env.local` DATABASE_URL points to `bricktrack` (not `property_tracker`)
- E2E requires: `BETTER_AUTH_SECRET`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`

## Notifications
**CRITICAL: ALWAYS notify via ntfy when waiting for input, task complete, error, or CI done.**
```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "YOUR MESSAGE HERE" -H "Title: Claude Code" -H "Priority: high"
osascript -e 'display notification "YOUR MESSAGE HERE" with title "Claude Code"'
```
