# Production Smoke Test

## Purpose
A Playwright test that verifies login and property creation work on production (or any target environment).

## What it does
1. Logs in using E2E Clerk credentials (existing `authenticatedPage` fixture)
2. Navigates to properties page
3. Creates a test property via the add-property UI form
4. Verifies the property appears
5. Deletes the property via UI to clean up

## Test file
`e2e/smoke.spec.ts`

## How to run
```bash
# Against production
PLAYWRIGHT_BASE_URL=https://www.bricktrack.au npx playwright test e2e/smoke.spec.ts

# Against local
npx playwright test e2e/smoke.spec.ts
```

## Key decisions
- Uses existing `authenticatedPage` fixture (no new auth code)
- Test property: "1 Smoke Test Street, Testville NSW 2000" (identifiable fake data)
- Deletes via UI (not DB) since production has no direct DB access
- Cleanup in `test.afterEach` so property is removed even if assertions fail
- Single self-contained file, no seeding required
