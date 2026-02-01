# Disaster Recovery Runbook

This document describes how to recover BrickTrack data in case of data loss or corruption.

## Backup Overview

| Item | Details |
|------|---------|
| **Schedule** | Daily at 3am UTC |
| **Retention** | 90 days |
| **Location** | GitHub Actions artifacts |
| **Format** | Compressed SQL (`.sql.gz`) |
| **Scope** | PostgreSQL database only |

## What IS Backed Up

- All PostgreSQL tables (users, properties, transactions, documents metadata, etc.)
- Database schema and indexes
- All user data stored in Supabase PostgreSQL

## What is NOT Backed Up

These services maintain their own data and are not included in our database backups:

| Service | Data | Recovery |
|---------|------|----------|
| **Supabase Storage** | Document files (PDFs, images) | Contact Supabase support |
| **Clerk** | User accounts, authentication | Managed by Clerk |
| **Stripe** | Subscriptions, payment history | Managed by Stripe |
| **PostHog** | Analytics data | Managed by PostHog |

## How to Download a Backup

1. Go to [GitHub Actions](https://github.com/ItsMattG/property-tracker/actions/workflows/backup-database.yml)
2. Click on a successful workflow run
3. Scroll to **Artifacts** section
4. Download `db-backup-<run-id>-<run-number>`
5. Unzip to get `backup.sql.gz`
6. Decompress: `gunzip backup.sql.gz`

## How to Restore

### Prerequisites

- PostgreSQL client installed (`psql`)
- Target database URL (Supabase or local)
- Downloaded and decompressed backup file

### Restore to Supabase (Production)

**WARNING:** This will overwrite ALL existing data. Only do this in a true disaster scenario.

```bash
# 1. Download and decompress the backup
gunzip backup.sql.gz

# 2. Connect to Supabase and restore
# Replace DATABASE_URL with your Supabase connection string
psql "$DATABASE_URL" < backup.sql
```

### Restore to Local Database (Testing)

```bash
# 1. Create a local test database
createdb bricktrack_restore_test

# 2. Restore the backup
psql bricktrack_restore_test < backup.sql

# 3. Verify data
psql bricktrack_restore_test -c "SELECT COUNT(*) FROM users;"
psql bricktrack_restore_test -c "SELECT COUNT(*) FROM properties;"

# 4. Clean up when done
dropdb bricktrack_restore_test
```

## Verify Backup Health

### Manual Check (Quarterly)

1. Download the most recent backup
2. Restore to a local database
3. Verify row counts match production
4. Delete local database

### Automated Monitoring

- Workflow failures send alerts to ntfy.sh
- Check [GitHub Actions history](https://github.com/ItsMattG/property-tracker/actions/workflows/backup-database.yml) for run status

## Emergency Contacts

| Service | Dashboard | Status Page |
|---------|-----------|-------------|
| **Supabase** | [dashboard.supabase.com](https://dashboard.supabase.com) | [status.supabase.com](https://status.supabase.com) |
| **Clerk** | [dashboard.clerk.com](https://dashboard.clerk.com) | [status.clerk.com](https://status.clerk.com) |
| **Vercel** | [vercel.com/dashboard](https://vercel.com/dashboard) | [vercel-status.com](https://www.vercel-status.com) |
| **GitHub** | [github.com](https://github.com) | [githubstatus.com](https://www.githubstatus.com) |

## Incident Response

1. **Assess** - Determine scope of data loss
2. **Communicate** - Notify affected users if needed
3. **Identify** - Find the most recent good backup
4. **Restore** - Follow restore procedure above
5. **Verify** - Check data integrity after restore
6. **Document** - Write post-mortem
