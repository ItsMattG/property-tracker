# Infrastructure Documentation

## Overview

BrickTrack uses the following infrastructure:

- **Hosting:** Vercel (Next.js optimized)
- **Database:** PostgreSQL on Supabase
- **Authentication:** BetterAuth
- **Error Tracking:** Sentry
- **CI/CD:** GitHub Actions + Vercel

## CI/CD Pipeline

### GitHub Actions

On every PR and push to main:

1. **Lint & Type Check** - ESLint and TypeScript
2. **Unit Tests** - Vitest
3. **Build** - Next.js production build
4. **E2E Tests** - Playwright (on main and ready PRs)

### Vercel Deployments

- **Production:** Automatic on merge to `main`
- **Preview:** Automatic on PR creation
- **Region:** Sydney (syd1) for Australian users

## Environment Variables

### Required for All Environments

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | BetterAuth secret key |
| `BETTER_AUTH_URL` | Application URL (e.g., https://bricktrack.au) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN |

### Production Only

| Variable | Description |
|----------|-------------|
| `SENTRY_AUTH_TOKEN` | For source map uploads |
| `CRON_SECRET` | Vercel cron authentication |

### E2E Testing

| Variable | Description |
|----------|-------------|
| `E2E_USER_EMAIL` | Test user email |
| `E2E_USER_PASSWORD` | Test user password |

## Monitoring

### Sentry

- **Errors:** Automatic capture with stack traces
- **Performance:** 10% sampling rate
- **Session Replay:** 10% normal, 100% on error

### Business Metrics (Future)

- Failed bank syncs
- Categorization accuracy
- Uncategorized transaction age

## Database

### Indexes

Optimized indexes on `transactions` table:
- `user_id` - User filtering
- `property_id` - Property filtering
- `date` - Date range queries
- `category` - Category filtering
- `(user_id, date)` - Combined user + date queries

## Cron Jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/sync-banks` | Daily 6am AEST | Bank transaction sync |

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```
