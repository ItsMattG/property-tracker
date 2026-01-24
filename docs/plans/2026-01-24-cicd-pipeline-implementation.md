# CI/CD Pipeline Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance CI with shared caching, E2E against Vercel preview, coverage reporting, and security scanning.

**Architecture:** Rewrite `.github/workflows/ci.yml` with a setup job that caches dependencies, parallel jobs for lint/tests/security, then E2E against Vercel preview URL for PRs.

**Tech Stack:** GitHub Actions, Vitest coverage, Playwright, npm audit

---

## Task 1: Install Coverage Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Check if @vitest/coverage-v8 is already installed**

Run: `npm ls @vitest/coverage-v8`
Expected: Either shows the package or "empty"

**Step 2: Install coverage package if needed**

Run: `npm install --save-dev @vitest/coverage-v8`
Expected: Package added to devDependencies

**Step 3: Verify installation**

Run: `npm run test:unit:coverage`
Expected: Tests run with coverage output

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest coverage dependency

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Coverage Thresholds to Vitest Config

**Files:**
- Modify: `vitest.config.ts`

**Step 1: Update vitest.config.ts with coverage thresholds**

Replace the coverage section in `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      exclude: ["node_modules/", "e2e/", "*.config.*", "**/*.d.ts"],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: Test coverage runs with thresholds**

Run: `npm run test:unit:coverage`
Expected: Coverage report shows, may warn about thresholds

**Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "feat: add coverage thresholds to vitest config

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite CI Workflow - Setup Job with Caching

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Create the new workflow with setup job**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "20"

jobs:
  setup:
    name: Setup & Cache
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-deps
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-node-

      - name: Install dependencies
        if: steps.cache-deps.outputs.cache-hit != 'true'
        run: npm ci

  lint:
    name: Lint
    runs-on: ubuntu-latest
    needs: [setup]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Run ESLint
        run: npm run lint

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    needs: [setup]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Run TypeScript type check
        run: npx tsc --noEmit

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: [setup]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Run unit tests with coverage
        run: npm run test:unit:coverage

      - name: Upload coverage artifacts
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
          retention-days: 7

  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: [setup]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true

      - name: Check for critical vulnerabilities
        run: |
          CRITICAL=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.critical // 0')
          if [ "$CRITICAL" -gt 0 ]; then
            echo "::error::Found $CRITICAL critical vulnerabilities"
            exit 1
          fi
          echo "No critical vulnerabilities found"

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint, typecheck, unit-tests, security]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Cache Next.js build
        uses: actions/cache@v4
        with:
          path: .next/cache
          key: ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('**/*.ts', '**/*.tsx') }}
          restore-keys: |
            ${{ runner.os }}-nextjs-${{ hashFiles('package-lock.json') }}-
            ${{ runner.os }}-nextjs-

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_dummy
          CLERK_SECRET_KEY: sk_test_dummy
          DATABASE_URL: postgresql://dummy:dummy@localhost:5432/dummy

  wait-for-vercel:
    name: Wait for Vercel Preview
    runs-on: ubuntu-latest
    needs: [build]
    if: github.event_name == 'pull_request'
    outputs:
      preview_url: ${{ steps.vercel.outputs.url }}
    steps:
      - name: Wait for Vercel deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        id: vercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
          check_interval: 10

  e2e-tests-preview:
    name: E2E Tests (Preview)
    runs-on: ubuntu-latest
    needs: [wait-for-vercel]
    if: github.event_name == 'pull_request' && github.event.pull_request.draft == false
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'

      - name: Install Playwright deps only
        run: npx playwright install-deps chromium
        if: steps.playwright-cache.outputs.cache-hit == 'true'

      - name: Run E2E tests against preview
        run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ needs.wait-for-vercel.outputs.preview_url }}
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
          E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  e2e-tests-main:
    name: E2E Tests (Main)
    runs-on: ubuntu-latest
    needs: [build]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Restore node_modules cache
        uses: actions/cache@v4
        with:
          path: node_modules
          key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies (fallback)
        run: npm ci
        if: hashFiles('node_modules/.package-lock.json') == ''

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        if: steps.playwright-cache.outputs.cache-hit != 'true'

      - name: Install Playwright deps only
        run: npx playwright install-deps chromium
        if: steps.playwright-cache.outputs.cache-hit == 'true'

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          E2E_CLERK_USER_EMAIL: ${{ secrets.E2E_CLERK_USER_EMAIL }}
          E2E_CLERK_USER_PASSWORD: ${{ secrets.E2E_CLERK_USER_PASSWORD }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  coverage-report:
    name: Coverage Report
    runs-on: ubuntu-latest
    needs: [unit-tests]
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download coverage artifacts
        uses: actions/download-artifact@v4
        with:
          name: coverage-report
          path: coverage/

      - name: Report coverage
        uses: davelosert/vitest-coverage-report-action@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          json-summary-path: coverage/coverage-summary.json
          json-final-path: coverage/coverage-final.json

  status-comment:
    name: Status Comment
    runs-on: ubuntu-latest
    needs: [e2e-tests-preview, coverage-report]
    if: github.event_name == 'pull_request' && always()
    steps:
      - name: Comment PR with status
        uses: actions/github-script@v7
        with:
          script: |
            const e2eResult = '${{ needs.e2e-tests-preview.result }}';
            const coverageResult = '${{ needs.coverage-report.result }}';

            let status = '✅';
            let message = 'All checks passed!';

            if (e2eResult === 'failure' || coverageResult === 'failure') {
              status = '❌';
              message = 'Some checks failed. Please review.';
            } else if (e2eResult === 'skipped') {
              status = '⏭️';
              message = 'E2E tests skipped (draft PR).';
            }

            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `${status} **CI Status**: ${message}\n\nPreview deployment is available on Vercel.`
            });
```

**Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat: enhance CI with caching, coverage, security, and preview E2E

- Add shared node_modules caching across jobs
- Run lint, typecheck, unit-tests, security in parallel
- Add npm audit security scanning (blocks on critical)
- E2E tests run against Vercel preview URL for PRs
- Add coverage report commenting on PRs
- Cache Playwright browsers and Next.js build

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update Playwright Config for Base URL

**Files:**
- Modify: `playwright.config.ts`

**Step 1: Read current Playwright config**

Check current `playwright.config.ts` for baseURL handling.

**Step 2: Update to use PLAYWRIGHT_BASE_URL env var**

Ensure the config respects `PLAYWRIGHT_BASE_URL` environment variable:

```typescript
// In playwright.config.ts, the use.baseURL should be:
baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
```

**Step 3: Commit if changes made**

```bash
git add playwright.config.ts
git commit -m "feat: support PLAYWRIGHT_BASE_URL for preview testing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Verify CI Workflow Locally

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors (or only .next/dev type errors which are ignored in CI)

**Step 3: Run unit tests with coverage**

Run: `npm run test:unit:coverage`
Expected: All tests pass, coverage report generated

**Step 4: Run security audit**

Run: `npm audit --audit-level=high`
Expected: Report shows, no critical vulnerabilities

**Step 5: Push to trigger CI**

```bash
git push origin feature/infrastructure
```
Expected: CI runs on GitHub with new workflow

---

## Task 6: Final Verification

**Step 1: Check GitHub Actions**

Open: `https://github.com/ItsMattG/property-tracker/actions`
Expected: New workflow runs with parallel jobs visible

**Step 2: Verify caching works**

Look at "Setup & Cache" job logs for cache hit/miss

**Step 3: Verify coverage report**

Check PR for coverage comment (if PR exists)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve CI workflow issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install @vitest/coverage-v8 dependency |
| 2 | Add coverage thresholds to vitest.config.ts |
| 3 | Rewrite CI workflow with all enhancements |
| 4 | Update Playwright config for base URL |
| 5 | Verify CI workflow locally |
| 6 | Final verification on GitHub |
