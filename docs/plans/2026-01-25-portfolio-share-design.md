# Portfolio Share Design

**Date:** 2026-01-25
**Status:** Approved

## Overview

One-click shareable portfolio reports with PDF export and web links for viral distribution.

## Features

- One-click shareable report generation
- Beautiful PDF export with key metrics
- Web link with mandatory expiry (7-30 days)
- Three privacy modes (Full, Summary, Redacted)
- "Powered by PropertyTracker" watermark
- View count tracking

## Data Model

```
portfolioShares
├── id (uuid, primary key)
├── userId (uuid, foreign key)
├── token (string, unique) - URL-safe random token
├── title (string) - "Q1 2026 Portfolio Summary"
├── privacyMode (enum: 'full' | 'summary' | 'redacted')
├── snapshotData (jsonb) - Portfolio metrics at creation time
├── expiresAt (timestamp) - mandatory, 7-30 days from creation
├── viewCount (int) - track engagement
├── createdAt (timestamp)
└── lastViewedAt (timestamp, nullable)
```

## API Endpoints

### share.create
- Input: `{ title, privacyMode, expiresInDays (7-30) }`
- Output: `{ id, token, url, expiresAt }`
- Fetches current portfolio metrics, applies privacy transforms, stores snapshot

### share.list
- Input: none
- Output: Array of user's shares with view counts

### share.revoke
- Input: `{ id }`
- Deletes the share immediately

### share.getByToken (public, no auth)
- Input: `{ token }`
- Output: `{ title, snapshotData, privacyMode, createdAt }`
- Returns 404 if expired or not found
- Increments viewCount

## Privacy Modes

### Full Mode
- Complete property addresses
- Exact dollar amounts (values, debt, equity, cash flow)
- Individual property breakdowns
- Percentages and ratios

### Summary Mode
- "X properties in Y states" (no addresses)
- Total portfolio value, debt, equity
- Overall LVR, yield, cash flow
- No individual property breakdown

### Redacted Mode
- Suburbs only (e.g., "Richmond, VIC" not "42 Smith St")
- No dollar amounts - show as "—"
- LVR, yield percentages visible
- Relative comparisons ("Property A: 35% of portfolio")
- Cash flow shown as positive/negative indicator only

## UI Components

### Create Share Modal
- Title input (default: "Portfolio Summary - {Month} {Year}")
- Privacy mode selector (3 radio options with descriptions)
- Expiry dropdown (7, 14, 30 days)
- "Create Share" button
- Shows generated URL with copy button

### Manage Shares Page (`/reports/share`)
- Table: title, privacy mode, created, expires, views
- Quick actions: copy link, revoke
- Empty state prompting first share

### Public Share View (`/share/[token]`)
- Clean, branded layout (no navigation/auth UI)
- "Powered by PropertyTracker" watermark with signup CTA
- Portfolio metrics based on privacy mode
- "Download PDF" button
- Expiry notice if within 3 days

### PDF Export
- Same content as web view
- PropertyTracker branding/watermark
- Generated date and expiry date
- Clean formatting for loan applications

## File Structure

```
src/server/db/schema.ts              - Add portfolioShares table
src/server/routers/share.ts          - Share CRUD + public getByToken
src/server/services/share.ts         - Snapshot generation, privacy transforms

src/app/(dashboard)/reports/share/page.tsx     - Manage shares
src/components/share/CreateShareModal.tsx      - Creation flow
src/components/share/ShareCard.tsx             - List item

src/app/share/[token]/page.tsx                 - Public view (no auth)
src/components/share/PortfolioReport.tsx       - Renders snapshot data
src/lib/share-pdf.ts                           - PDF generation
```

## Technical Decisions

- **Auth:** Token-only with mandatory 7-30 day expiry
- **PDF:** Client-side with jsPDF (existing dependency)
- **Snapshot:** Stored at creation time (immutable)
- **Viral:** "Powered by PropertyTracker" watermark on all shares
