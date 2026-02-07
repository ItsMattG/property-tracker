# Staging/Production Branching & Rollback Strategy

## Problem

Every feature merge to `main` auto-deploys to production via Vercel. No buffer exists between "merge" and "live." A broken feature = broken production.

## Design Decisions

- **Solo developer** — no approval workflows needed
- **Minimal extra cost** — leverage Vercel's existing features, no separate staging DB
- **`develop` branch as staging gate** — two-step merge process
- **Shared production DB** with Clerk/Stripe test keys on staging — hybrid isolation

## Branch Strategy

```
feature/* ──→ develop (staging) ──→ main (production)
```

- `develop`: long-lived staging branch, created from `main`
- `main`: production branch, Vercel auto-deploys (unchanged)
- Feature branches merge into `develop` via PR
- `develop` merges into `main` via PR to promote to production

## Vercel Setup

### Branch Configuration

| Branch | Domain | Purpose |
|--------|--------|---------|
| `main` | `bricktrack.au` | Production |
| `develop` | `staging.bricktrack.au` | Staging |

Configure in Vercel → Project Settings → Git → add `develop` branch with custom domain alias.

PR preview deployments continue to work for individual feature branches.

### Environment Variable Scoping

Vercel scopes env vars to Production vs Preview:

| Variable | Production (`main`) | Preview (`develop` + PRs) |
|----------|--------------------|-----------------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Production webhook | Test webhook |
| `DATABASE_URL` | Shared (same) | Shared (same) |
| `NEXT_PUBLIC_APP_URL` | `https://bricktrack.au` | `https://staging.bricktrack.au` |

All other vars (Supabase, PostHog, Anthropic, Sentry, etc.) remain the same across environments.

## CI Pipeline Changes

Update `.github/workflows/ci.yml` branch triggers:

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

No new CI jobs needed. Existing pipeline (lint, typecheck, unit tests, build, security, E2E, Lighthouse) runs on both branches.

## Rollback Strategy

### Instant Rollback (Vercel Dashboard)

1. Go to Vercel → Deployments
2. Find last known good deployment
3. Click "Promote to Production"
4. Takes ~5 seconds, no rebuild

### Git-Level Rollback (if code revert also needed)

```bash
git revert -m 1 <merge-commit-sha>
git push origin main
```

Clean revert, no force-push, triggers fresh production deploy.

## Protection Layers

| Layer | Catches | When |
|-------|---------|------|
| PR preview | Visual/functional bugs on feature branches | Before merge to `develop` |
| CI pipeline | Code quality, types, unit regressions, vulnerabilities | On every PR |
| Staging (`develop`) | Integration issues, real-world behavior | Before promoting to `main` |
| E2E tests | User flow regressions | On push to `develop` and `main` |
| Lighthouse | Performance/a11y regressions | On PRs |
| Vercel instant rollback | Emergency production fix | After deploy |

## Day-to-Day Workflow

### Building a Feature

```
1. bd ready                                    # Pick a task
2. git worktree add ... -b feature/foo         # Create worktree
3. Write code, TDD, etc.
4. Push → PR targeting develop                 # Target develop, not main
5. CI runs, preview URL generated
6. Merge PR into develop                       # Staging auto-deploys
```

### Promoting to Production

```
7. Visit staging.bricktrack.au                 # Sanity check
8. Create PR: develop → main                   # Promotion PR
9. CI runs
10. Merge → production auto-deploys
```

### Promotion Cadence

Flexible — promote after each feature, batch several features, or on a regular cadence.

### Emergency Hotfix

```
1. Branch hotfix/* from main (not develop)
2. Fix the issue
3. PR directly to main → merge → production deploys
4. Merge main back into develop to keep in sync
```

### Keeping Branches in Sync

- After promoting `develop` → `main`, they're identical
- After a hotfix on `main`, merge `main` back into `develop`

## Implementation Steps

1. Create `develop` branch from `main`
2. Update `ci.yml` to trigger on `develop` branch
3. Configure Vercel: add `develop` branch with `staging.bricktrack.au` alias
4. Set Clerk/Stripe test keys for Preview environment in Vercel
5. Update `CLAUDE.md` workflow to target `develop` for feature PRs
6. Update `vercel.json` if needed for staging-specific cron behavior (disable crons on staging to avoid duplicate emails/syncs)
