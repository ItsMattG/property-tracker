# CI/CD Pipeline Enhancement Design

**Date:** 2026-01-24
**Status:** Approved
**Scope:** Improve existing CI with caching, coverage, E2E against preview, security scanning

## Overview

Enhance the existing GitHub Actions CI workflow with four improvements:
1. Shared caching for faster builds
2. E2E tests against Vercel preview deployments
3. Test coverage reporting on PRs
4. Dependency vulnerability scanning

---

## Current State

The existing `.github/workflows/ci.yml` has:
- Lint (ESLint)
- Type check (tsc --noEmit)
- Unit tests (Vitest)
- Build with dummy env vars
- E2E tests against localhost
- PR comment on success
- Playwright report upload on failure

---

## Design

### Job Dependency Graph

```
┌─────────────────┐
│  Setup & Cache  │ ← Installs deps, caches node_modules + .next/cache
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ▼         ▼          ▼
┌───────┐ ┌───────────┐ ┌──────────┐
│ Lint  │ │Unit Tests │ │ Security │ ← Run in parallel
└───┬───┘ └─────┬─────┘ └────┬─────┘
    │           │            │
    └─────┬─────┴────────────┘
          ▼
    ┌───────────┐
    │   Build   │
    └─────┬─────┘
          │
          ▼
┌─────────────────────┐
│ Wait for Vercel     │ ← PRs only
│ Deploy              │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ E2E Tests against   │ ← Preview URL (PRs) or localhost (main)
│ Preview URL         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Coverage & Status   │ ← Comments on PR
│ Comment             │
└─────────────────────┘
```

### 1. Shared Caching

Cache `node_modules` and `.next/cache` across jobs:

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      .next/cache
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

Also cache Playwright browsers:

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

### 2. E2E Tests Against Vercel Preview

For PRs, wait for Vercel deployment and test against real preview URL:

```yaml
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

e2e-tests:
  needs: [wait-for-vercel]
  env:
    PLAYWRIGHT_BASE_URL: ${{ needs.wait-for-vercel.outputs.preview_url }}
```

For pushes to main, E2E runs against localhost (no preview URL available).

### 3. Test Coverage Reporting

Generate coverage during unit tests and comment on PR:

```yaml
- name: Run unit tests with coverage
  run: npm run test:unit:coverage

- name: Generate coverage report
  uses: davelosert/vitest-coverage-report-action@v2
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Coverage thresholds in `vitest.config.ts`:
- Statements: 70%
- Branches: 60%
- Functions: 70%
- Lines: 70%

### 4. Dependency Vulnerability Scanning

```yaml
security:
  name: Security Scan
  runs-on: ubuntu-latest
  needs: [setup]
  steps:
    - uses: actions/checkout@v4

    - name: Restore cache
      uses: actions/cache@v4
      with:
        path: node_modules
        key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}

    - name: Run npm audit
      run: npm audit --audit-level=high
      continue-on-error: true

    - name: Check for critical vulnerabilities
      run: |
        CRITICAL=$(npm audit --json | jq '.metadata.vulnerabilities.critical')
        if [ "$CRITICAL" -gt 0 ]; then
          echo "::error::Found $CRITICAL critical vulnerabilities"
          exit 1
        fi
```

Behavior:
- Critical vulnerabilities → Block the PR
- High/Medium/Low → Report but don't block

---

## Files to Modify

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | Complete rewrite with new job structure |
| `package.json` | Add `@vitest/coverage-v8` dev dependency |
| `vitest.config.ts` | Add coverage configuration |

---

## Required Setup

- Vercel GitHub integration (already connected)
- No new secrets needed - uses `GITHUB_TOKEN` and existing Vercel integration
- Enable Dependabot alerts in repo settings (optional)

---

## Success Criteria

- All jobs run successfully on PRs
- E2E tests run against actual Vercel preview URL
- Coverage report appears as PR comment
- Critical vulnerabilities block merging
- CI completes faster due to caching
