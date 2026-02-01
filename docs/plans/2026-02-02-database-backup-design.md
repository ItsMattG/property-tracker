# Database Backup Verification Design

> **For Claude:** Use superpowers:executing-plans to implement this plan.

**Goal:** Automated daily database backups via GitHub Actions with 90-day retention.

**Architecture:** GitHub Actions workflow runs pg_dump daily at 3am UTC, stores compressed SQL as GitHub artifact, alerts via ntfy.sh on failure.

**Tech Stack:** GitHub Actions, PostgreSQL pg_dump, ntfy.sh

---

## Overview

Supabase Free tier has no automated backups. This design adds automated daily backups using GitHub Actions and pg_dump, storing backups as GitHub artifacts with 90-day retention.

## Components

### 1. GitHub Actions Workflow

**File:** `.github/workflows/backup-database.yml`

**Trigger:**
- Scheduled: Daily at 3am UTC
- Manual: workflow_dispatch for testing

**Steps:**
1. Install PostgreSQL client
2. Run `pg_dump --no-owner --no-acl`
3. Compress with gzip
4. Upload as artifact `db-backup-YYYY-MM-DD`
5. On failure, send ntfy.sh alert

**Configuration:**
- `retention-days: 90`
- `--format=plain` for human-readable SQL
- Uses existing `DATABASE_URL` secret from production environment

**Estimated storage:** 1-5MB compressed per day, ~100-500MB total at 90 days (within 500MB free limit).

### 2. Disaster Recovery Documentation

**File:** `docs/disaster-recovery.md`

**Contents:**
1. Backup overview — schedule, retention, what's included
2. How to download a backup from GitHub Actions
3. How to restore to Supabase or local Postgres
4. What's NOT backed up (Storage files, Clerk, Stripe)
5. Emergency contacts and dashboard links

**Restore command:**
```bash
psql $DATABASE_URL < db-backup-2026-02-02.sql
```

## What's NOT Backed Up

- **Supabase Storage** — Document attachments (PDFs, images)
- **Clerk** — User accounts and authentication
- **Stripe** — Billing and subscription data

These services have their own redundancy/backup mechanisms.

## Testing & Validation

1. Manual trigger test via GitHub Actions UI
2. Verify artifact appears in workflow run
3. Download and confirm valid SQL contents
4. Optionally restore to local Postgres

## Monitoring

- Workflow failures trigger ntfy.sh alerts automatically
- GitHub Actions UI shows run history
- No additional monitoring needed

## Out of Scope (YAGNI)

- Automated restore testing
- Backup size tracking/alerting
- Secondary backup location
- Supabase Storage backup
