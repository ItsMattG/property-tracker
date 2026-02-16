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
