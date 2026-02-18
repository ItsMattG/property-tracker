# Disaster Recovery Runbook

This document describes how to recover BrickTrack in case of data loss, bad deploys, or schema issues.

## 1. Database Restore

### Backup Overview

| Item | Details |
|------|---------|
| **Schedule** | Daily at 3am UTC |
| **Retention** | 90 days |
| **Location** | GitHub Actions artifacts |
| **Format** | Compressed SQL (`.sql.gz`) |
| **Scope** | PostgreSQL database only |
| **Secret Required** | `DATABASE_URL_DIRECT` (direct connection, not pooler) |
| **Workflow** | `.github/workflows/backup-database.yml` |
| **Failure alerts** | ntfy.sh (`property-tracker-claude` topic) |

### What IS Backed Up

- All PostgreSQL tables (users, properties, transactions, bank connections, subscriptions, etc.)
- Database schema, indexes, constraints, sequences

### What is NOT Backed Up

| Service | Data | Recovery |
|---------|------|----------|
| **Supabase Storage** | Document files (PDFs, images) | Supabase has its own redundancy |
| **BetterAuth** | Session data | Users re-authenticate; accounts are in our DB |
| **Stripe** | Subscriptions, payment history | Stripe retains all data; webhook replays available |
| **Basiq** | Bank connection tokens | Users reconnect; historical transactions are in our DB |
| **PostHog** | Analytics data | Managed by PostHog |

### Download a Backup

1. Go to [GitHub Actions > Database Backup](https://github.com/ItsMattG/property-tracker/actions/workflows/backup-database.yml)
2. Click on a successful workflow run
3. Scroll to **Artifacts** section
4. Download `db-backup-<run-id>-<run-number>`
5. Extract: `unzip db-backup-*.zip && gunzip backup.sql.gz`

### Trigger a Manual Backup

Go to [GitHub Actions > Database Backup](https://github.com/ItsMattG/property-tracker/actions/workflows/backup-database.yml) and click **Run workflow**.

### Restore to Production (Supabase)

**WARNING:** This overwrites ALL existing data. Only use in a true disaster scenario.

```bash
# Use the DIRECT connection URL (not the pooler — psql doesn't work with poolers)
# Find it in: Supabase Dashboard > Project Settings > Database > Connection string > URI (direct)
psql "$DATABASE_URL_DIRECT" < backup.sql
```

### Restore to Local (Testing)

```bash
# Ensure local DB is running
docker compose up -d

# Create database if needed
docker exec -it property-tracker-db-1 createdb -U postgres bricktrack

# Restore
psql postgresql://postgres:postgres@localhost:5432/bricktrack < backup.sql

# Verify
psql postgresql://postgres:postgres@localhost:5432/bricktrack -c "SELECT COUNT(*) FROM properties;"
```

### Verify Backup Health (Quarterly)

1. Download the most recent backup
2. Restore to a local database
3. Verify row counts match production
4. Delete local database

## 2. Application Rollback (Vercel)

### Instant Rollback via Vercel Dashboard

1. Go to [Vercel Deployments](https://vercel.com/itsmattg/property-tracker/deployments)
2. Find the last known-good deployment
3. Click the three-dot menu > **Promote to Production**

This instantly serves the previous build with zero downtime. No git changes needed.

### Rollback via Git Revert

```bash
# Revert the problematic merge commit on main
git revert -m 1 <merge-sha>
git push origin main
```

Vercel auto-deploys on push to `main`. After reverting, sync branches:

```bash
git checkout develop && git merge main && git push origin develop
```

### Staging Rollback

Same process on the `develop` branch. Use Vercel's preview deployments list or `git revert` on `develop`.

## 3. Database Migration Rollback (Drizzle)

BrickTrack uses **push-based schema management** (`drizzle-kit push`), not versioned migrations. Schema changes are applied automatically on every Vercel deploy via the build command in `vercel.json`.

### Rollback by Change Type

**Additive changes** (new tables, new columns with defaults):
- No rollback needed — old code ignores new columns/tables
- Promote the previous Vercel deployment and it continues to work

**Destructive changes** (column renames, type changes, dropped columns):
1. If data was lost (dropped column), restore from backup first
2. Revert the git commit that changed the schema
3. Push to trigger a new deploy — `drizzle-kit push` restores the previous schema

**Emergency manual fix:**

```bash
# Connect directly to production
psql "$DATABASE_URL_DIRECT"

# Run corrective SQL
ALTER TABLE properties ADD COLUMN IF NOT EXISTS my_column text;
```

Then revert the code and redeploy so `drizzle-kit push` matches the corrected state.

### Prevention

- Test schema changes on staging (`develop` branch) before promoting to `main`
- Prefer additive changes — add new column, backfill, then remove old
- Preview changes: `npx drizzle-kit push --dry-run`

## 4. Incident Response Checklist

If both the application and database are down:

1. **Assess** — Check service status pages (see table below)
2. **Platform outage?** — If Vercel or Supabase is down, wait for recovery
3. **Bad deploy?** — Promote previous deployment in Vercel dashboard
4. **Database corrupted?**
   - Download latest backup from GitHub Actions
   - Restore: `psql "$DATABASE_URL_DIRECT" < backup.sql`
   - Verify via Supabase SQL editor: `SELECT count(*) FROM properties;`
5. **Verify recovery** — Check `bricktrack.au` loads, check Sentry for errors, test login
6. **Communicate** — Notify affected users if needed
7. **Document** — Write post-mortem

## 5. Emergency Contacts & Dashboards

| Service | Dashboard | Status Page |
|---------|-----------|-------------|
| **Vercel** | [vercel.com/itsmattg/property-tracker](https://vercel.com/itsmattg/property-tracker) | [vercel-status.com](https://www.vercel-status.com) |
| **Supabase** | [supabase.com/dashboard](https://supabase.com/dashboard) | [status.supabase.com](https://status.supabase.com) |
| **Sentry** | [sentry.io](https://sentry.io) | — |
| **GitHub Actions** | [CI & backup runs](https://github.com/ItsMattG/property-tracker/actions) | [githubstatus.com](https://www.githubstatus.com) |
| **Stripe** | [dashboard.stripe.com](https://dashboard.stripe.com) | — |
| **ntfy.sh** | `property-tracker-claude` topic | — |
