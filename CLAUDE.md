# Claude Code Rules

## Project Status (as of 2026-02-02)
V0.1, v0.2, and v0.3 roadmaps are **complete**. V0.4 is **in progress** (14/15 done).

**V0.4 Roadmap:** See `docs/plans/2026-01-28-v04-roadmap-design.md` for full progress tracker.

**V0.4 completed:**
- Stripe Billing Integration (subscriptions, webhooks, plan-gated middleware, billing page)
- Blog Content Pipeline (5 SEO articles)
- PostHog Analytics (provider, page tracking, user identification)
- Conversion Prompts (UpgradePrompt component)
- Rental Yield Calculator (dashboard widget, gross/net yield)
- Security Hardening (rate limiting middleware, security headers)
- Settlement Statement Capture (AI extraction, post-creation flow, CGT cost base)
- Depreciation Schedules & Sitemap/Robots.txt (pre-existed)
- Dynamic OG Images (@vercel/og)
- CI/CD Pipeline (GitHub Actions)
- Monitoring & Alerting (uptime cron, cron health, ntfy.sh alerts)
- Gmail OAuth Integration (PR #122)
- Database Backups (daily pg_dump, 90-day retention)

**V0.4 remaining (1 item):**
- 3.1 PropTrack AVM (blocked on API key)

**Earlier roadmaps (all complete):**
- v0.1-v0.2: PropertyMe, Mobile App, Scenarios, Portfolio Share, Compliance, Milestones, Broker Portal, Climate Risk, Trust/SMSF, Benchmarking, Tax Position, Similar Properties, Axiom
- v0.3: Feedback System, Changelog, Landing Page, Blog/SEO, Email Integration, Task Management, Onboarding, AI Chat, TaxTank Features, Audit Checks, YoY Comparison, Support Tickets, Advisor System, Referral Program

## Token Efficiency
Always pick the token-efficient approach when implementing. Minimize unnecessary exploration and verbose output.

## MCP Plugins (Required Usage)
The following plugins are installed and **must** be used at the appropriate workflow stages.

### context7 — Up-to-Date Documentation
**Always** use context7 to fetch current, version-specific documentation before implementing with any package, library, or framework. Never rely on potentially outdated training knowledge when context7 can provide the latest docs.
- **When:** Before writing code that uses any dependency (Next.js, Drizzle, Clerk, Stripe, Tailwind, React, tRPC, Playwright, Zod, Radix, Recharts, etc.)
- **Trigger:** Any uncertainty about API signatures, configuration options, breaking changes, or best practices
- **Examples:** "How does Drizzle handle upserts?", "What's the Next.js 16 middleware API?", "Clerk v6 server-side auth"

### frontend-design — UI Implementation
Use when building or modifying any user-facing component, page, or layout.
- **When:** Creating new pages, redesigning components, building dashboards, landing pages, forms
- **How:** Automatically invoked for frontend work — produces production-grade, distinctive UI

### feature-dev — Structured Feature Development
Use for any non-trivial feature that touches multiple files or requires architectural decisions.
- **When:** New features touching 3+ files, complex integrations, features with unclear requirements
- **Command:** `/feature-dev [description]`
- **Phases:** Discovery → Codebase exploration → Clarifying questions → Architecture design → Implementation → Quality review → Summary

### code-review — Automated PR Review
Use after creating any PR with meaningful changes. Runs 4 parallel review agents with confidence-based scoring.
- **When:** After every PR is created (before merge)
- **Command:** `/code-review`
- **What it checks:** CLAUDE.md compliance, obvious bugs, git history context

### playwright — E2E Testing & Browser Automation
Use when writing, debugging, or running E2E tests.
- **When:** Writing new E2E tests, debugging test failures, browser automation tasks
- **Capabilities:** Page interaction, screenshots, form filling, element clicking

### typescript-lsp — Code Intelligence
Use for navigating the codebase and verifying types.
- **When:** Finding references, go-to-definition, checking type errors, understanding call sites
- **Supported:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`

### supabase — Database Operations
Use when working with the database directly.
- **When:** Schema changes, migrations, direct SQL queries, debugging data issues, checking DB state
- **Capabilities:** Run SQL, manage tables, inspect data

### github — Repository Management
Use for all GitHub interactions.
- **When:** Creating/managing issues, PRs, code search, repository operations
- **Preferred over:** Manual `gh` CLI when richer API access is needed

## Task Management (Beads)
Use Beads (`bd`) for persistent task tracking across sessions:

**Finding work:**
- `bd ready` — show tasks with no blockers
- `bd show <id>` — view full task details

**During work:**
- `bd update <id> -m "progress note"` — track progress
- `bd block <id> -m "reason"` — mark if blocked

**Completing work:**
- `bd done <id>` — mark task complete

**Creating tasks:**
- `bd create "Task title" -p 1` — create with priority (0=urgent, 3=low)
- `bd dep add <child> <parent>` — set dependencies

**Context hygiene:**
- `/clear` when context exceeds 40%
- Re-read task with `bd show <id>` after clearing
- Beads persists state across session boundaries

## Task Completion Workflow
After completing each task:
1. Mark complete in Beads: `bd done <id>`
2. Create a PR for it
3. Merge the PR
4. Run `/compact`
5. Begin the next task (check `bd ready`)

## Git Worktrees (Required for Feature Work)
Use git worktrees to isolate feature work. This prevents branch conflicts when multiple Claude sessions run in parallel.

**Setup (one-time):**
```bash
mkdir -p ~/worktrees/property-tracker
```

**For each feature:**
```bash
# Create worktree with feature branch
git worktree add ~/worktrees/property-tracker/<feature-name> -b feature/<feature-name>

# Work in the worktree directory
cd ~/worktrees/property-tracker/<feature-name>
```

**Cleanup after merge:**
```bash
git worktree remove ~/worktrees/property-tracker/<feature-name>
```

**Why worktrees:**
- Each Claude session works in its own isolated directory
- No branch switching conflicts between sessions
- Main repo stays on `main` for quick checks
- Parallel feature development without interference

## Development Workflow (TDD + E2E Validated)
Always follow this workflow for new features. **Every feature must be test-driven and E2E validated before PR.**

See `docs/plans/2026-02-06-tdd-e2e-workflow-design.md` for full design rationale.

1. **Pick task**: `bd ready` to find next task, `bd show <id>` for details
2. **Create worktree**: `git worktree add ~/worktrees/property-tracker/<feature-name> -b feature/<feature-name>`
3. **Change to worktree**: `cd ~/worktrees/property-tracker/<feature-name>`
4. **Brainstorm**: Use `superpowers:brainstorming` for design. Use **context7** to look up current docs for any libraries/frameworks involved.
5. **Plan**: Use `superpowers:writing-plans` for implementation plan. For complex features, use `/feature-dev` instead for the full structured workflow.
6. **Write tests FIRST (TDD Red Phase)**:
   - Write **unit tests** (Vitest) for new logic, utils, API routes
   - Write **E2E tests** using **playwright** plugin for user-facing acceptance criteria
   - Tests define expected behavior — no implementation code yet
   - Use **context7** to check latest Playwright/Vitest APIs if unsure
7. **Spin up environment & confirm tests fail (Red)**:
   - Run the full environment restart (see "Environment Spin-Up Procedure" below)
   - Run `npm run test:unit` → confirm new tests fail as expected
   - Run `npm run test:e2e` → confirm new E2E tests fail as expected
   - This validates the tests are actually testing something
8. **Implement (Green Phase)**: Write code until all tests pass
   - Use **context7** for up-to-date docs on any package/API before coding
   - Use **frontend-design** for any UI component or page work
   - Use **typescript-lsp** for go-to-definition, find-references, and type checking
   - Use **supabase** for any database schema changes or direct SQL queries
9. **Full environment validation (Green)**:
   - Run the full environment restart again (clean slate)
   - Run `npm run test:unit` → ALL tests must pass
   - Run `npm run test:e2e` → ALL E2E tests must pass
   - On failure: follow the "E2E Failure Investigation Protocol" below
10. **Verify**: Use `superpowers:verification-before-completion` — lint, build, type-check
11. **Create PR**: Push branch and create PR via **github** plugin or `gh pr create`
12. **Review**: Run `/code-review` on the PR before requesting merge
13. **Wait for CI**: Run `gh pr checks --watch` to wait for GitHub Actions and Vercel preview deploy to pass
14. **Merge PR**: Only after CI passes and code review is clean, merge with `gh pr merge`
15. **Cleanup**: `git worktree remove ~/worktrees/property-tracker/<feature-name>`
16. **Complete task**: `bd done <id>`, then `/clear` for fresh context

Always use a worktree for feature work. Never commit directly to main.

## Environment Spin-Up Procedure
**Run this before every test validation (steps 7 and 9 above). Full restart every time — no reuse.**

```bash
# 1. Stop everything
docker compose down

# 2. Start fresh DB
docker compose up -d

# 3. Wait for DB health check
until docker compose exec db pg_isready -U postgres 2>/dev/null; do sleep 1; done

# 4. Create bricktrack DB (if not exists) + push schema
docker compose exec db psql -U postgres -c "CREATE DATABASE bricktrack;" 2>/dev/null || true
npx drizzle-kit push

# 5. Run unit tests
npm run test:unit

# 6. Run E2E (Playwright auto-starts dev server via webServer config)
npm run test:e2e
```

**Notes:**
- Playwright's `webServer` config automatically starts `npm run dev` — no manual dev server management needed
- The `bricktrack` DB is what `.env.local` DATABASE_URL points to (not the default `property_tracker`)
- E2E requires Clerk env vars (`CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_USER_EMAIL`, etc.) in `.env.local`

## Playwright Authenticated Screenshots
When you need to screenshot or interact with authenticated pages (dashboard, settings, etc.) using Playwright, log in with the test user credentials from `.env.local`:

```javascript
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Log in via Clerk
  await page.goto('http://localhost:3000/sign-in');
  await page.fill('input[name="identifier"]', process.env.E2E_CLERK_USER_EMAIL);
  await page.click('button:has-text("Continue")');
  await page.fill('input[name="password"]', process.env.E2E_CLERK_USER_PASSWORD);
  await page.click('button:has-text("Continue")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Now take authenticated screenshots
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();
```

**Credentials:** Read `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER_PASSWORD` from `.env.local`. Never hardcode them.

## E2E Test Standards
All new E2E tests **must** follow these standards:

1. **Test user-visible behavior** — navigate as a real user would, verify UI renders correctly
2. **Check for uncaught errors** — use `page.on('pageerror')` to catch uncaught exceptions; test fails on any `pageerror`
3. **Ignore noise** — `console.warn` and `console.log` from third-party libs are not failures
4. **Clean up test data** — delete any created entities to avoid polluting subsequent runs
5. **Add to existing spec files** when the feature fits an existing category (e.g., property features → `properties.spec.ts`). Create new spec only for genuinely new domains
6. **Capture screenshots on failure** — already handled by Playwright `trace: 'on-first-retry'`

## E2E Failure Investigation Protocol
When E2E tests fail during step 9 (Green validation):

**Attempt 1 — Automated diagnosis:**
- Read Playwright HTML report and trace files
- Check dev server terminal output for errors
- Check browser console logs captured in the trace
- Identify root cause and fix the code
- Re-run the full environment validation (step 9)

**Attempt 2 — Deeper investigation:**
- Look at network requests in the Playwright trace
- Check DB state: `docker compose exec db psql -U postgres -d bricktrack`
- Check for race conditions, timing issues, or data ordering problems
- Fix and re-run the full environment validation (step 9)

**After 2 failed attempts — Notify user:**
- Capture all evidence (logs, screenshots, trace)
- Notify via ntfy: `"E2E tests failing after 2 fix attempts — need your input"`
- Wait for user guidance before continuing

## Notifications
**ALWAYS notify the user via ntfy for these events:**
1. When asking a question or waiting for input
2. When a task or PR is complete
3. When there's an error or blocker
4. When waiting for CI to finish

**Notification command (run this, do not ask):**
```bash
curl -s -X POST "https://ntfy.sh/property-tracker-claude" \
  -d "YOUR MESSAGE HERE" \
  -H "Title: Claude Code" \
  -H "Priority: high"
```

**Examples:**
- Question: `"Need your input: Which approach do you prefer?"`
- Complete: `"PR #123 ready for review: https://github.com/..."`
- Error: `"Build failed - need your help to debug"`
- CI: `"All CI checks passed - ready to merge"`

This is mandatory. Never skip notifications.
