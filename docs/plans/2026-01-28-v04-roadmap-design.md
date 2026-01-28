# V0.4 Roadmap - Revenue, Growth, Depth & Infrastructure

**Date:** 2026-01-28
**Status:** Final
**Scope:** Stripe billing, SEO content pipeline, real AVM, depreciation, Gmail/Outlook, CI/CD, monitoring

---

## Phase 1: Revenue & Monetization

### 1.1 Stripe Billing Integration

Three tiers matching existing pricing section:

- **Free:** 1 property, basic tracking, no bank feeds, no export
- **Pro ($19/mo):** Unlimited properties, bank feeds, tax reports, email forwarding, AI chat
- **Team ($39/mo):** Everything in Pro + team members, advisor access, audit log, priority support

**Implementation:**
- Stripe Checkout for signup, Customer Portal for management
- `subscriptions` table: userId, stripeCustomerId, stripeSubscriptionId, planId, status, currentPeriodEnd
- `planGatedProcedure` middleware that checks subscription before allowing Pro/Team features
- Webhook handler at `/api/webhooks/stripe` for subscription lifecycle events
- Apply referral credits at billing time
- `/settings/billing` page: current plan, usage, upgrade/downgrade, invoices

No free trial abuse prevention needed — Clerk auth requires email verification.

---

## Phase 2: Growth & Acquisition

### 2.1 Sitemap & Robots.txt
- Dynamic sitemap at `/sitemap.xml` including blog posts, changelog, static pages
- Optimized robots.txt with crawl directives

### 2.2 Blog Content Pipeline
- 5 initial SEO-targeted articles (rental expenses guide, Victorian compliance, tax deductions, SMSF rules, negative gearing)
- MDX-based, stored in `/content/blog/`
- Article schema structured data per post

### 2.3 Dynamic OG Images
- Property share pages get dynamically generated OG images (address, value, growth stats)
- Use `@vercel/og` for edge-rendered images

### 2.4 Privacy-Friendly Analytics
- PostHog or Plausible (no Google Analytics)
- Key funnels: landing → signup → add property → connect bank → Pro upgrade

### 2.5 Conversion Optimization
- "Upgrade to Pro" prompts at natural gates (property limit, export, bank feeds)
- Non-intrusive — show what they'd get, not a hard wall

---

## Phase 3: Product Depth

### 3.1 Real AVM Provider (PropTrack)
- Implement `PropTrackProvider` against existing `ValuationProvider` interface
- Environment variable swap: `VALUATION_PROVIDER=proptrack`
- Monthly cron already exists — needs real API key
- Keep mock provider as fallback for dev/test

### 3.2 Depreciation Schedules (Division 40/43)
- Division 43 (building/capital works): 2.5% or 4% of construction cost over 40/25 years
- Division 40 (plant & equipment): diminishing value or prime cost per ATO effective life
- `depreciation_schedules` table with asset items, methods, annual calculations
- Report integration with MyTax export (Item 21 already mapped)
- Start with manual entry, add ATO effective life lookup later

### 3.3 Settlement Statement Capture
- Prompt to upload settlement PDF when adding a property
- Extract purchase price, stamp duty, legal fees, adjustments via existing document extraction
- Auto-create capital cost base entries for CGT

### 3.4 Rental Yield Calculator
- Dashboard widget: gross and net yield per property
- Gross = annual rent / current value
- Net = (annual rent - expenses) / current value
- Card component on property detail and portfolio pages

---

## Phase 4: Infrastructure & Platform

### 4.1 Gmail/Outlook Integration
- OAuth via Gmail API and Microsoft Graph API
- Auto-scan inbox, filter by property-related senders
- Reuse existing email parsing pipeline and property matching from Phase 9.1
- Feature-gated to Pro plan

### 4.2 CI/CD Pipeline
- GitHub Actions: lint → typecheck → unit tests → build → E2E tests
- Preview deployments on PRs via Vercel
- Branch protection on main requiring all checks pass

### 4.3 Monitoring & Alerting
- Axiom structured logging already integrated
- Add: uptime monitoring (Checkly), error tracking (Sentry), cron health checks
- Alert to Slack/ntfy on failures

### 4.4 Security Hardening
- CSP headers, rate limiting on auth endpoints
- API rate limiting per user (tRPC middleware)
- Supabase RLS policies review for storage buckets
- Regular dependency updates via Renovate bot

### 4.5 Database Backups
- Verify Supabase automated daily backups and retention
- Test restore process
- Document disaster recovery procedure

---

## Implementation Order

| Phase | Feature | Priority | Complexity |
|-------|---------|----------|------------|
| 1.1 | Stripe Billing | Critical | High |
| 2.1 | Sitemap & Robots.txt | High | Low |
| 2.2 | Blog Content | High | Medium |
| 3.4 | Rental Yield Calculator | High | Low |
| 4.2 | CI/CD Pipeline | High | Medium |
| 4.3 | Monitoring & Alerting | High | Medium |
| 3.1 | PropTrack AVM | High | Medium |
| 2.4 | Analytics | Medium | Low |
| 2.5 | Conversion Prompts | Medium | Low |
| 3.2 | Depreciation Schedules | Medium | High |
| 3.3 | Settlement Capture | Medium | Medium |
| 4.4 | Security Hardening | Medium | Medium |
| 4.1 | Gmail/Outlook | Medium | High |
| 2.3 | Dynamic OG Images | Low | Low |
| 4.5 | Backup Verification | Low | Low |

---

## Decision: Shares/Crypto (7.4)

**Skipped.** PropertyTracker stays property-focused. Adding share/crypto tracking would dilute the brand, create maintenance burden with market data feeds, and pit us against established competitors (Sharesight, Navexa). If users want combined net worth, a future Sharesight API integration is the better path.
