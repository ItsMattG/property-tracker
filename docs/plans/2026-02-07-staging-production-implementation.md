# Staging/Production Branching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `develop` branch as a staging gate between feature work and production, with CI running on both branches.

**Architecture:** Feature branches merge into `develop` (auto-deploys to staging URL on Vercel). When satisfied, `develop` merges into `main` (auto-deploys to production). Vercel Preview deployments use Clerk/Stripe test keys; Production uses live keys. Cron jobs only fire on Production (Vercel built-in behavior).

**Tech Stack:** Git branching, GitHub Actions CI, Vercel deployment config, CLAUDE.md workflow docs

**Design doc:** `docs/plans/2026-02-07-staging-production-branching-design.md`

---

### Task 1: Create the `develop` branch

**Why:** This is the foundation — the long-lived staging branch that all feature PRs will target.

**Step 1: Create and push `develop` from `main`**

```bash
git branch develop main
git push origin develop
```

Expected: Branch `develop` appears on GitHub, identical to `main`.

**Step 2: Set `develop` as the default branch for PRs (optional)**

On GitHub → Settings → General → Default branch → change to `develop`.

> **Note:** This is a manual step in the GitHub UI. It means new PRs default to targeting `develop` instead of `main`. This is optional — you can also just remember to select `develop` when creating PRs. Skip if you prefer to keep `main` as default.

**Step 3: Protect the `main` branch**

On GitHub → Settings → Branches → Add rule for `main`:
- Require pull request before merging (no direct pushes)
- Require status checks to pass (CI)

> **Note:** This is a manual step in the GitHub UI. It prevents accidental direct pushes to production.

---

### Task 2: Update CI to run on `develop` branch

**Files:**
- Modify: `.github/workflows/ci.yml:3-7`

**Step 1: Update branch triggers**

In `.github/workflows/ci.yml`, change the `on` block from:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

To:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

**Step 2: Update E2E test trigger condition**

The E2E job currently only runs on pushes to `main` (line 195):

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

Change to also run on `develop`:

```yaml
if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop')
```

**Step 3: Verify no other branch-specific conditions exist**

Scan the rest of `ci.yml` for any other `refs/heads/main` references. The coverage-report and lighthouse jobs use `github.event_name == 'pull_request'` which already works for PRs to either branch — no changes needed.

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add develop branch to CI triggers for staging workflow"
```

---

### Task 3: Update CLAUDE.md workflow documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the "Development Workflow" section**

In the "Development Workflow (TDD + E2E Validated)" section, update step 11 (Create PR) from:

```
11. **Create PR**: Push branch and create PR via **github** plugin or `gh pr create`
```

To:

```
11. **Create PR**: Push branch and create PR **targeting `develop`** via `gh pr create --base develop`
```

**Step 2: Update the "Git Worktrees" section**

In the "For each feature" code block, update the worktree command to branch from `develop`:

```bash
# Create worktree with feature branch (branching from develop)
git worktree add ~/worktrees/property-tracker/<feature-name> -b feature/<feature-name> develop
```

**Step 3: Update the "Task Completion Workflow" section**

Change from:

```
1. Mark complete in Beads: `bd done <id>`
2. Create a PR for it
3. Merge the PR
4. Run `/compact`
5. Begin the next task (check `bd ready`)
```

To:

```
1. Mark complete in Beads: `bd done <id>`
2. Create a PR targeting `develop`
3. Merge the PR into `develop`
4. When ready to release: create PR from `develop` → `main` and merge
5. Run `/compact`
6. Begin the next task (check `bd ready`)
```

**Step 4: Add a new "Staging & Production" section**

Add after the "Git Worktrees" section:

```markdown
## Staging & Production

**Branch model:**
- `develop` = staging (auto-deploys to `staging.bricktrack.au`)
- `main` = production (auto-deploys to `bricktrack.au`)
- Feature branches target `develop`, never `main` directly

**Promoting to production:**
1. Verify staging at `staging.bricktrack.au`
2. Create PR: `develop` → `main`
3. Merge after CI passes

**Emergency hotfix:**
1. Branch `hotfix/*` from `main`
2. PR directly to `main`
3. After merge, also merge `main` back into `develop`

**Rollback:**
- Vercel dashboard → Deployments → Promote previous deployment to Production (instant, ~5 seconds)
- Git-level: `git revert -m 1 <sha> && git push origin main`
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md workflow for develop/staging branching model"
```

---

### Task 4: Vercel configuration (manual — dashboard steps)

> **These are manual steps for the user to complete in the Vercel dashboard. Not automatable via code.**

**Step 1: Assign stable URL to `develop` branch**

1. Go to [Vercel Dashboard](https://vercel.com) → property-tracker project
2. Settings → Domains
3. Add `staging.bricktrack.au` (or use `staging-property-tracker.vercel.app` if you don't want a custom subdomain yet)
4. Settings → Git → Branch Deployments → ensure `develop` is listed
5. Assign the staging domain to the `develop` branch

**Step 2: Scope Clerk environment variables**

1. Settings → Environment Variables
2. For `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`:
   - Production: `pk_live_...` (your live key)
   - Preview: `pk_test_...` (your test key from Clerk dashboard)
3. For `CLERK_SECRET_KEY`:
   - Production: `sk_live_...`
   - Preview: `sk_test_...`

**Step 3: Scope Stripe environment variables**

1. For `STRIPE_SECRET_KEY`:
   - Production: `sk_live_...`
   - Preview: `sk_test_...`
2. For `STRIPE_PUBLISHABLE_KEY`:
   - Production: `pk_live_...`
   - Preview: `pk_test_...`
3. For `STRIPE_WEBHOOK_SECRET`:
   - Production: your live webhook secret
   - Preview: your test webhook secret (create a test webhook in Stripe dashboard pointing to `staging.bricktrack.au/api/webhooks/stripe`)

**Step 4: Update `NEXT_PUBLIC_APP_URL`**

1. For `NEXT_PUBLIC_APP_URL`:
   - Production: `https://bricktrack.au`
   - Preview: `https://staging.bricktrack.au`

**Step 5: Verify crons won't run on staging**

Vercel cron jobs defined in `vercel.json` only execute on the Production deployment — they do NOT run on Preview or branch deployments. No action needed. Confirm this by checking Vercel docs or observing that after deploying `develop`, no cron executions appear in the staging deployment's function logs.

---

### Task 5: Push changes and verify

**Step 1: Push the updated `develop` branch**

```bash
git push origin develop
```

**Step 2: Verify CI runs on `develop`**

Check GitHub Actions — the CI workflow should trigger on the push to `develop`.

**Step 3: Verify Vercel deploys staging**

After push, Vercel should auto-deploy the `develop` branch. Check the staging URL loads correctly.

**Step 4: Create a test PR targeting `develop`**

Create a trivial branch, open a PR against `develop`, verify:
- CI runs (lint, typecheck, unit tests, build)
- Vercel creates a preview deployment
- Coverage report comments on the PR
- Lighthouse runs against the preview

**Step 5: Test the promotion flow**

Create a PR from `develop` → `main`, verify:
- CI runs
- Merging triggers a production deployment
- Production site works correctly

---

## Summary of Changes

| What | Type | Who |
|------|------|-----|
| Create `develop` branch | Git | Claude (Task 1) |
| Update `ci.yml` triggers | Code | Claude (Task 2) |
| Update `CLAUDE.md` workflow docs | Code | Claude (Task 3) |
| Configure Vercel domains + env vars | Manual | User (Task 4) |
| Push and verify | Git + manual | Both (Task 5) |

## Cron Jobs — No Action Needed

Vercel crons only run on the Production deployment. Staging/Preview deployments do not trigger crons. The existing `CRON_SECRET` auth adds a second layer of protection. No code changes needed.
