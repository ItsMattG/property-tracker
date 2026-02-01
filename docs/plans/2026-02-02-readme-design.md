# README.md Design Document

**Date:** 2026-02-02
**Status:** Approved
**Purpose:** Comprehensive README for GitHub repository

## Overview

Design a ~500-800 line README that serves both developers contributing to the codebase and technical evaluators/stakeholders. Visual-rich with Mermaid diagrams, screenshots, and badges.

## Sections

### 1. Hero (Logo, Tagline, Badges)

```markdown
# 🧱 BrickTrack

**Track smarter. Tax time sorted.**

Your spreadsheet, automated. BrickTrack is an Australian property investment tracking platform that connects to your bank, automatically categorizes transactions for tax, and generates ATO-ready reports.

[![CI](https://github.com/your-org/bricktrack/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/bricktrack/actions)
[![Coverage](https://img.shields.io/codecov/c/github/your-org/bricktrack)](https://codecov.io/gh/your-org/bricktrack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

**Why BrickTrack?**

- 🏦 **Automatic bank feeds** - Connects to 100+ Australian banks via open banking
- 🤖 **AI categorization** - Every transaction mapped to correct ATO tax categories
- 📊 **Tax-ready reports** - Generate reports for your accountant or MyTax in one click
- 🇦🇺 **Australian-first** - Built for Australian tax law, banks, and property investors
```

---

### 2. Screenshots

```markdown
## Screenshots

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Portfolio Dashboard" width="800"/>
  <br/>
  <em>Portfolio dashboard with property overview, rental yield, and cash flow</em>
</p>

<p align="center">
  <img src="docs/screenshots/transactions.png" alt="Transaction Categorization" width="800"/>
  <br/>
  <em>AI-powered transaction categorization with manual override</em>
</p>

<p align="center">
  <img src="docs/screenshots/tax-report.png" alt="Tax Report" width="800"/>
  <br/>
  <em>ATO-ready tax reports exportable to CSV or MyTax format</em>
</p>
```

**Note:** Screenshots to be captured and added to `docs/screenshots/`.

---

### 3. Features

```markdown
## Features

### Core
| Feature | Description |
|---------|-------------|
| **Property Portfolio** | Track unlimited properties with purchase details, valuations, and equity |
| **Bank Feed Sync** | Daily automatic sync from 100+ Australian banks via Basiq |
| **AI Categorization** | Claude-powered transaction categorization to ATO tax categories |
| **Tax Reports** | Income/expense, CGT, depreciation reports ready for MyTax or accountants |
| **Settlement Capture** | Upload settlement statements, AI extracts cost base for CGT |
| **Rental Yield Calculator** | Gross and net yield calculations on dashboard |

### Advanced
| Feature | Description |
|---------|-------------|
| **Multi-Entity Support** | Personal, Trust, Company, and SMSF ownership structures |
| **AI Chat** | Ask questions about your properties and tax in natural language |
| **Scenario Modelling** | "What-if" analysis for investment decisions |
| **Climate Risk** | Flood and bushfire risk assessment by property location |
| **Team Collaboration** | Invite accountants or partners with role-based access |
| **Broker Portal** | Generate loan packs for refinancing |

### Subscription Tiers
| | Free | Pro ($14/mo) | Team ($29/mo) |
|---|:---:|:---:|:---:|
| Properties | 1 | Unlimited | Unlimited |
| Bank connections | 1 | Unlimited | Unlimited |
| Tax reports | Basic | Full | Full |
| AI categorization | ❌ | ✅ | ✅ |
| Team members | — | — | Up to 5 |
```

---

### 4. Tech Stack

```markdown
## Tech Stack

### Frontend
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)

- **Framework:** Next.js 16 (App Router)
- **UI Components:** shadcn/ui + Radix primitives
- **Styling:** Tailwind CSS 4
- **State:** TanStack React Query
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts

### Backend
![tRPC](https://img.shields.io/badge/tRPC-11-2596BE)
![Drizzle](https://img.shields.io/badge/Drizzle-0.45-C5F74F)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)

- **API:** tRPC (type-safe RPC, no REST boilerplate)
- **Database:** PostgreSQL on Supabase
- **ORM:** Drizzle (type-safe schema, fast migrations)
- **Auth:** Clerk (OAuth + email/password)
- **Email:** Resend

### External Services
| Service | Purpose |
|---------|---------|
| [Basiq](https://basiq.io) | Open banking - Australian bank feeds |
| [Anthropic Claude](https://anthropic.com) | AI categorization, chat, document extraction |
| [Stripe](https://stripe.com) | Subscriptions and billing |
| [PostHog](https://posthog.com) | Privacy-friendly analytics |
| [Sentry](https://sentry.io) | Error tracking |
| [Axiom](https://axiom.co) | Structured logging |
| [Supabase](https://supabase.com) | Database hosting + file storage |
```

---

### 5. Architecture

```markdown
## Architecture

```mermaid
graph TB
    subgraph Client
        A[Next.js App Router]
        B[React Query]
    end

    subgraph API Layer
        C[tRPC Routers]
        D[Middleware<br/>Auth • Rate Limit]
    end

    subgraph Data
        E[(PostgreSQL<br/>Supabase)]
        F[Drizzle ORM]
    end

    subgraph External Services
        G[Basiq<br/>Bank Feeds]
        H[Claude AI<br/>Categorization]
        I[Stripe<br/>Billing]
        J[Clerk<br/>Auth]
    end

    A --> B
    B --> C
    C --> D
    D --> F
    F --> E

    C --> G
    C --> H
    C --> I
    A --> J
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **tRPC over REST** | End-to-end type safety, no API schema drift, auto-generated client |
| **Drizzle over Prisma** | Faster migrations, lighter bundle, SQL-like syntax |
| **App Router** | Server components for landing page performance, streaming for dashboards |
| **Clerk for auth** | Handles OAuth complexity, Turnstile bot protection, webhook lifecycle |
| **Basiq for banking** | Only open banking provider with 100+ AU banks, handles OAuth consent |
| **Claude for AI** | Superior categorization accuracy vs GPT-4, better at Australian tax context |
| **PostHog over GA** | Privacy-friendly, no cookie banners needed, self-hostable |
| **Vercel Sydney region** | <50ms latency for Australian users, native Next.js optimization |
```

---

### 6. Getting Started

```markdown
## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+ (recommended) or npm
- PostgreSQL database (or [Supabase](https://supabase.com) account)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/bricktrack.git
cd bricktrack

# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local
```

### Environment Setup

Fill in `.env.local` with your credentials:

```bash
# Database
DATABASE_URL="postgresql://..."

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Banking (Basiq)
BASIQ_API_KEY="..."

# AI (Anthropic)
ANTHROPIC_API_KEY="sk-ant-..."

# Payments (Stripe)
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
```

See `.env.local.example` for the complete list of required variables.

### Database Setup

```bash
# Push schema to database
pnpm db:push

# Or run migrations
pnpm db:migrate
```

### Development

```bash
# Start dev server
pnpm dev

# Open http://localhost:3000
```
```

---

### 7. Project Structure

```markdown
## Project Structure

```
bricktrack/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Sign-in, sign-up pages
│   │   ├── (dashboard)/        # Protected routes (properties, transactions, reports)
│   │   ├── api/                # API routes, webhooks, cron jobs
│   │   │   ├── trpc/           # tRPC handler
│   │   │   ├── webhooks/       # Clerk, Stripe, Basiq webhooks
│   │   │   └── cron/           # Scheduled jobs (bank sync)
│   │   └── blog/               # SEO content pages
│   │
│   ├── components/             # React components by feature
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── dashboard/          # Portfolio overview widgets
│   │   ├── properties/         # Property CRUD, detail views
│   │   ├── transactions/       # Transaction list, categorization
│   │   ├── reports/            # Tax reports, exports
│   │   └── billing/            # Subscription management
│   │
│   ├── server/
│   │   ├── db/                 # Drizzle schema & migrations
│   │   ├── routers/            # tRPC routers (50+ domain routers)
│   │   └── services/           # External API integrations
│   │
│   ├── lib/                    # Utilities, helpers, constants
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript type definitions
│
├── mobile/                     # React Native Expo app
├── e2e/                        # Playwright E2E tests
├── docs/                       # Documentation & design plans
├── drizzle/                    # Database migrations
├── content/                    # Blog MDX content
└── public/                     # Static assets
```
```

---

### 8. Testing

```markdown
## Testing

### Unit Tests

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

Uses [Vitest](https://vitest.dev/) with v8 coverage.

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e e2e/dashboard.spec.ts
```

Uses [Playwright](https://playwright.dev/) with Chromium, Firefox, and WebKit.

### UI Audit

Custom visual regression and accessibility testing across all pages:

```bash
# Run UI audit suite
pnpm test:ui-audit
```

Covers dashboard, properties, transactions, reports, and settings pages.

### CI Pipeline

All tests run automatically on pull requests:

```
lint → typecheck → unit tests → build → E2E
```

See `.github/workflows/ci.yml` for the full pipeline.
```

---

### 9. Deployment

```markdown
## Deployment

### Vercel (Recommended)

BrickTrack is optimized for Vercel with Next.js native support.

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard (copy from `.env.local.example`)
3. **Configure region** to Sydney (`syd1`) for Australian users
4. **Deploy** - automatic on push to `main`

### Environment Variables

Required for production:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk authentication |
| `BASIQ_API_KEY` | Open banking API |
| `ANTHROPIC_API_KEY` | Claude AI |
| `STRIPE_SECRET_KEY` | Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `SENTRY_DSN` | Error tracking |
| `AXIOM_TOKEN` | Logging |
| `POSTHOG_KEY` | Analytics |

### Webhooks

Configure webhook endpoints in each service:

| Service | Endpoint |
|---------|----------|
| Clerk | `https://your-domain.com/api/webhooks/clerk` |
| Stripe | `https://your-domain.com/api/webhooks/stripe` |
| Basiq | `https://your-domain.com/api/webhooks/basiq` |

### Cron Jobs

Vercel cron handles scheduled tasks (configured in `vercel.json`):

| Job | Schedule | Purpose |
|-----|----------|---------|
| Bank sync | Daily 6am AEST | Fetch latest transactions |
| Trial reminders | Daily | Email users before trial expires |
```

---

### 10. Roadmap

```markdown
## Roadmap

### Current: V0.4 (9/15 complete)

**Completed:**
- ✅ Stripe billing integration (subscriptions, webhooks, billing page)
- ✅ Blog content pipeline (5 SEO articles)
- ✅ PostHog analytics
- ✅ Conversion prompts (upgrade CTAs)
- ✅ Rental yield calculator
- ✅ Security hardening (rate limiting, CSP headers)
- ✅ Settlement statement capture (AI extraction)
- ✅ Depreciation schedules
- ✅ Sitemap & robots.txt

**In Progress:**
- 🔄 CI/CD pipeline (GitHub Actions)
- 🔄 Dynamic OG images (@vercel/og)
- 🔄 Monitoring & alerting (Checkly uptime)
- 🔄 Database backup verification
- ⏸️ PropTrack AVM integration (blocked on API key)
- 📋 Gmail/Outlook integration

### Previous Releases

| Version | Highlights |
|---------|------------|
| V0.3 | Landing page, AI chat, onboarding, support tickets, referral program |
| V0.2 | Scenarios, portfolio sharing, trust/SMSF, tax position, benchmarking |
| V0.1 | Core platform, PropertyMe import, mobile app, compliance checks |

See [`docs/plans/2026-01-28-v04-roadmap-design.md`](docs/plans/2026-01-28-v04-roadmap-design.md) for detailed progress.
```

---

### 11. Contributing

```markdown
## Contributing

### Development Workflow

1. **Find a task** - Check available work with `bd ready`
2. **Create a branch** - `git checkout -b feature/<feature-name>`
3. **Make changes** - Follow existing code patterns
4. **Test** - Run `pnpm test` and `pnpm test:e2e`
5. **Push & PR** - `git push -u origin HEAD && gh pr create`
6. **Wait for CI** - All checks must pass before merge
7. **Merge** - Squash merge to main

### Branch Naming

```
feature/<name>    # New features
fix/<name>        # Bug fixes
chore/<name>      # Maintenance, deps, docs
```

### Commit Messages

Follow conventional commits:

```
feat: add rental yield calculator
fix: correct CGT calculation for pre-CGT assets
chore: update dependencies
docs: add architecture diagram to README
```

### Code Style

- **TypeScript** - Strict mode, no `any`
- **Components** - Functional components with hooks
- **Formatting** - Handled by ESLint + Prettier on save
- **Imports** - Use `@/` path aliases (`@/components`, `@/lib`, etc.)

### Task Tracking

We use [Beads](https://github.com/beads-cli/beads) for task management:

```bash
bd ready          # Show available tasks
bd show <id>      # View task details
bd update <id>    # Add progress notes
bd done <id>      # Mark complete
```
```

---

### 12. License

```markdown
## License

This project is proprietary software. All rights reserved.

For licensing inquiries, contact [your-email@example.com](mailto:your-email@example.com).

---

<p align="center">
  <strong>Built for Australian property investors</strong>
  <br/>
  🇦🇺 Sydney, Australia
</p>
```

---

## Implementation Notes

1. **Screenshots required** - Capture and add to `docs/screenshots/`:
   - `dashboard.png` - Portfolio overview
   - `transactions.png` - Transaction list with categorization
   - `tax-report.png` - Tax report or property detail

2. **Badge URLs** - Update `your-org/bricktrack` to actual GitHub org/repo

3. **Contact email** - Replace placeholder in License section

4. **Estimated length** - ~600 lines with all sections

## Approval

- [x] Hero section
- [x] Screenshots section
- [x] Features section
- [x] Tech Stack section
- [x] Architecture section
- [x] Getting Started section
- [x] Project Structure section
- [x] Testing section
- [x] Deployment section
- [x] Roadmap section
- [x] Contributing section
- [x] License section
