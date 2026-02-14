# E2E Testing Quick Reference

## Test Standards

All new E2E tests **must** follow these standards:

1. **Test user-visible behavior** — navigate as a real user would, verify UI renders correctly
2. **Check for uncaught errors** — use `page.on('pageerror')` to catch uncaught exceptions; test fails on any `pageerror`
3. **Ignore noise** — `console.warn` and `console.log` from third-party libs are not failures
4. **Clean up test data** — delete any created entities to avoid polluting subsequent runs
5. **Add to existing spec files** when the feature fits an existing category (e.g., property features → `properties.spec.ts`). Create new spec only for genuinely new domains
6. **Capture screenshots on failure** — already handled by Playwright `trace: 'on-first-retry'`

## Directory Structure

```
e2e/
  auth.setup.ts          # Login + save storageState (runs once per suite)
  global-setup.ts        # Global setup (env validation)
  fixtures/
    auth.ts              # Legacy authenticatedPage fixture (prefer storageState)
    test-helpers.ts      # safeGoto, shared test utilities
  public/                # Tests for unauthenticated pages (no setup dependency)
    *.spec.ts
  authenticated/         # Tests requiring login (depends on setup project)
    *.spec.ts
  core-loop/             # Long-running flows (bank connect), extended timeout
    *.spec.ts
```

## Auth Fixture

Tests use **project-based auth** via `storageState`. The `setup` project runs `auth.setup.ts` once, saves session cookies to `e2e/.auth/user.json`, and all `authenticated`/`core-loop` projects reuse them.

**Legacy fixture** (`e2e/fixtures/auth.ts`): provides `authenticatedPage`. Only needed for tests outside the standard projects.

**Credentials:** `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` from `.env.local`. Never hardcode.

## Playwright Config

| Setting | Value |
|---------|-------|
| `baseURL` | `PLAYWRIGHT_BASE_URL` or `http://localhost:3000` |
| `trace` | `on-first-retry` |
| `timeout` | 30s (default), 300s (core-loop) |
| `webServer` | Auto-starts `npm run dev` locally (not in CI) |
| `retries` | 0 local, 2 in CI |

## Authenticated Screenshots (MCP Playwright)

When using the Playwright MCP plugin for authenticated screenshots:

```javascript
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Log in via BetterAuth form
  await page.goto('http://localhost:3000/sign-in');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Now take authenticated screenshots
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  await browser.close();
})();
```

## Free Plan Limits

Free plan allows 1 property max. Tests that create properties **must** clean up afterward, or subsequent runs will get `403 FORBIDDEN`.

## Failure Investigation Protocol

When E2E tests fail during validation:

**Attempt 1 — Automated diagnosis:**
- Read Playwright HTML report and trace files
- Check dev server terminal output for errors
- Check browser console logs captured in the trace
- Identify root cause and fix the code
- Re-run the full environment validation

**Attempt 2 — Deeper investigation:**
- Look at network requests in the Playwright trace
- Check DB state: `docker compose exec db psql -U postgres -d bricktrack`
- Check for race conditions, timing issues, or data ordering problems
- Fix and re-run the full environment validation

**After 2 failed attempts — Notify user:**
- Capture all evidence (logs, screenshots, trace)
- Notify via ntfy: `"E2E tests failing after 2 fix attempts — need your input"`
- Wait for user guidance before continuing
