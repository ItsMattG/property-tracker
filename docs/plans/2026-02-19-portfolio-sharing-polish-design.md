# Portfolio Sharing — Polish & Unflag Design

**Goal:** Ship the existing portfolio sharing feature by unflagging it, adding share preview, email sharing, and UX polish.

**Context:** The feature is ~90% built but feature-flagged OFF. Core flow works: create snapshot → generate token → share link → view publicly. Three privacy modes (full/summary/redacted), expiry, and view tracking are all implemented.

## What's Changing

### 1. Feature Flag & Navigation
- Set `portfolioShares: true` in feature-flags.ts
- Add "Portfolio Shares" link in Reports sidebar section (alongside Tax Position, Scenarios, Accountant Pack)
- Route already exists at `/reports/share`

### 2. Share Preview in Create Modal
- When selecting a privacy mode, show a descriptive preview:
  - **Full**: "Recipients will see all property addresses, values, loan details, and cash flow"
  - **Summary**: "Recipients will see portfolio totals only — no individual property data"
  - **Redacted**: "Recipients will see suburbs, percentages, and ratios — no addresses or dollar amounts"
- Add "Preview Share" button that opens the `PortfolioReport` component in a dialog with the selected privacy mode applied to real data
- Reuses existing `PortfolioReport` component from `src/components/share/PortfolioReport.tsx`

### 3. Email Sharing
- After creating a share link, add "Email Link" button alongside "Copy Link"
- Uses `mailto:` link with pre-filled fields:
  - To: empty (user fills in)
  - Subject: "Portfolio snapshot from [User Name] via BrickTrack"
  - Body: share link + "View my portfolio snapshot on BrickTrack"
- No backend email infrastructure needed — simple `mailto:` approach

### 4. UX Fixes
- **Copy button in table row**: Add copy icon button directly in the actions column (not buried in dropdown menu)
- **Better expiry display**: Show actual date + relative time — "Mar 5, 2026 (in 12 days)"
- **Toast on copy**: Show success toast when share link is copied from table
- **Revoke confirmation**: Show confirmation dialog before revoking a share ("This will permanently disable the share link")

### 5. Testing
- Unit tests for share service (snapshot generation, privacy transformation)
- Unit tests for share repository CRUD
- E2E test: create share → copy link → view public page → verify data matches privacy mode

## What's NOT Changing
- No PIN/password protection (96-bit URL tokens are sufficient)
- No live data sharing (snapshots are preferred — users control what's shared at a point in time)
- No share analytics dashboard (view count in table is sufficient for v1)
- No recipient feedback/comments
- Schema unchanged — existing `portfolio_shares` table is sufficient

## Existing Files
- **Schema**: `src/server/db/schema/portfolio.ts` (lines 109-120)
- **Router**: `src/server/routers/portfolio/share.ts`
- **Service**: `src/server/services/portfolio/share.ts`
- **Repository**: `src/server/repositories/portfolio.repository.ts`
- **Share page**: `src/app/(dashboard)/reports/share/page.tsx`
- **Create modal**: `src/components/share/CreateShareModal.tsx`
- **Public viewer**: `src/app/share/[token]/page.tsx`
- **Report component**: `src/components/share/PortfolioReport.tsx`
- **Feature flags**: `src/lib/feature-flags.ts`
