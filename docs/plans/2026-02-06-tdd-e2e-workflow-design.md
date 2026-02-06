# TDD + E2E Validation Workflow Design

**Date:** 2026-02-06
**Status:** Approved

## Summary

Update CLAUDE.md to enforce test-driven development for every feature. Before committing and raising a PR, Claude must spin up the full development environment (Docker DB + dev server) and validate the feature with Playwright E2E tests, checking for uncaught errors and investigating failures.

## Workflow

### Development Steps (replaces current "Development Workflow" in CLAUDE.md)

1. **Pick task**: `bd ready` to find next task, `bd show <id>` for details
2. **Create worktree**: `git worktree add ~/worktrees/property-tracker/<feature-name> -b feature/<feature-name>`
3. **Change to worktree**: `cd ~/worktrees/property-tracker/<feature-name>`
4. **Brainstorm**: Use `superpowers:brainstorming` for design
5. **Plan**: Use `superpowers:writing-plans` for implementation plan
6. **Write tests first (TDD Red Phase)**:
   - Write unit tests (Vitest) for any new logic/utils/API routes
   - Write E2E tests (Playwright) for user-facing acceptance criteria
   - Tests define the expected behavior before any implementation exists
7. **Spin up environment & confirm tests fail (Red)**:
   - Full environment restart (see Environment Procedure below)
   - Run unit tests → confirm they fail as expected
   - Run Playwright E2E → confirm new tests fail as expected
8. **Implement (Green Phase)**: Write code until all tests pass
9. **Spin up full environment & validate (Green)**:
   - Full environment restart (clean slate)
   - Run ALL unit tests → must pass
   - Run ALL Playwright E2E tests → must pass
   - Check for uncaught browser errors (pageerror events)
   - On failure: investigate and auto-fix up to 2 attempts (see Failure Protocol)
   - Notify via ntfy if still failing after 2 attempts
10. **Verify**: Run lint, build, type-check (`superpowers:verification-before-completion`)
11. **Create PR**: Push branch and create PR with `gh pr create`
12. **Wait for CI**: `gh pr checks --watch`
13. **Merge PR**: Only after CI passes
14. **Cleanup**: Remove worktree, `bd done <id>`, `/clear`

### Environment Spin-Up Procedure

```bash
# 1. Stop everything
docker compose down

# 2. Start fresh DB
docker compose up -d
# Wait for health check
until docker compose exec db pg_isready -U postgres 2>/dev/null; do sleep 1; done

# 3. Create bricktrack DB (if not exists) + push schema
docker compose exec db psql -U postgres -c "CREATE DATABASE bricktrack;" 2>/dev/null || true
npx drizzle-kit push

# 4. Run unit tests
npm run test:unit

# 5. Run E2E (Playwright auto-starts dev server via webServer config)
npm run test:e2e
```

### E2E Test Standards

All new E2E tests must:
- **Test user-visible behavior** — navigate as a user would, verify UI renders correctly
- **Check for uncaught errors** — use `page.on('pageerror')` to catch uncaught exceptions
- **Clean up test data** — delete any created entities to avoid polluting subsequent runs
- **Add to existing spec files** when the feature fits an existing category; create new spec only for genuinely new domains

### Console Error Policy

- **Fail on**: uncaught exceptions (`pageerror` events) and `console.error` calls
- **Ignore**: `console.warn` and `console.log` (including third-party library noise)

### Failure Investigation Protocol

**Attempt 1 — Automated diagnosis:**
- Read Playwright HTML report / trace
- Check dev server terminal output for errors
- Check browser console logs captured in the trace
- Identify root cause and fix

**Attempt 2 — Deeper investigation:**
- Look at network requests in the trace
- Check DB state (`docker compose exec db psql -U postgres -d bricktrack`)
- Check for race conditions or timing issues
- Fix and re-run

**After 2 failed attempts:**
- Capture all evidence (logs, screenshots, trace)
- Notify via ntfy: "E2E tests failing after 2 fix attempts — need your input"
- Wait for user guidance
