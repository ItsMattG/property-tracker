# BrickTrack Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename all user-facing "PropertyTracker" brand references to "BrickTrack" throughout the codebase.

**Architecture:** Simple find-and-replace across 114 files. Replace `PropertyTracker` → `BrickTrack` and `Property Tracker` → `Brick Track`. Skip technical references (package.json name, bundle IDs, Vercel URLs).

**Tech Stack:** sed/Edit tool for replacements, grep for verification

---

### Task 1: Core Layout and Metadata

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update metadata**

Replace all occurrences of `PropertyTracker` with `BrickTrack` in the metadata object:
- Line 25: title
- Line 30: openGraph title
- Line 33: siteName
- Line 42: alt text
- Line 48: twitter title

**Step 2: Verify changes**

Run: `grep -n "PropertyTracker" src/app/layout.tsx`
Expected: No matches

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: rename PropertyTracker to BrickTrack in layout metadata"
```

---

### Task 2: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update structured data and UI**

Replace all occurrences of `PropertyTracker` with `BrickTrack`:
- Line 101: JSON-LD name
- Line 113: publisher name
- Line 126: header brand text
- Line 143: hero description

**Step 2: Verify changes**

Run: `grep -n "PropertyTracker" src/app/page.tsx`
Expected: No matches

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: rename PropertyTracker to BrickTrack on landing page"
```

---

### Task 3: Landing Components

**Files:**
- Modify: `src/components/landing/FaqSection.tsx`

**Step 1: Update FAQ text**

Replace line 56: `PropertyTracker` → `BrickTrack`

**Step 2: Verify changes**

Run: `grep -n "PropertyTracker" src/components/landing/FaqSection.tsx`
Expected: No matches

**Step 3: Commit**

```bash
git add src/components/landing/FaqSection.tsx
git commit -m "feat: rename PropertyTracker to BrickTrack in FAQ"
```

---

### Task 4: Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Step 1: Check for brand references**

Search for any PropertyTracker text in sidebar and update if found.

**Step 2: Commit if changes made**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: rename PropertyTracker to BrickTrack in sidebar"
```

---

### Task 5: Email Templates

**Files:**
- Modify: `src/lib/email/templates/base.ts`
- Modify: `src/lib/email/templates/trial-reminder.ts`
- Modify: `src/lib/email/templates/invite.ts`
- Modify: `src/lib/email/templates/eofy-suggestions.ts`

**Step 1: Update base template**

In `base.ts`, replace:
- Line 8: `<title>PropertyTracker</title>` → `<title>BrickTrack</title>`
- Line 12: `<h1>PropertyTracker</h1>` → `<h1>BrickTrack</h1>`

**Step 2: Update other email templates**

Search and replace `PropertyTracker` → `BrickTrack` in all email template files.

**Step 3: Verify changes**

Run: `grep -rn "PropertyTracker" src/lib/email/templates/`
Expected: No matches

**Step 4: Commit**

```bash
git add src/lib/email/templates/
git commit -m "feat: rename PropertyTracker to BrickTrack in email templates"
```

---

### Task 6: Mobile App Display Name

**Files:**
- Modify: `mobile/app.json`

**Step 1: Update display name only**

Replace line 3: `"name": "PropertyTracker"` → `"name": "BrickTrack"`

Keep unchanged (technical references):
- Line 4: `"slug": "property-tracker"` (keep as-is)
- Line 16: `"bundleIdentifier": "com.propertytracker.app"` (keep as-is)
- Line 28: `"package": "com.propertytracker.app"` (keep as-is)

**Step 2: Update iOS camera permission text**

Line 19: Replace `PropertyTracker needs camera access` → `BrickTrack needs camera access`

**Step 3: Verify changes**

Run: `grep -n "PropertyTracker" mobile/app.json`
Expected: No matches

**Step 4: Commit**

```bash
git add mobile/app.json
git commit -m "feat: rename PropertyTracker to BrickTrack in mobile app"
```

---

### Task 7: OG Image

**Files:**
- Modify: `public/og-image.svg`

**Step 1: Update SVG text**

Replace line 9: `PropertyTracker` → `BrickTrack`

**Step 2: Commit**

```bash
git add public/og-image.svg
git commit -m "feat: rename PropertyTracker to BrickTrack in OG image"
```

---

### Task 8: README

**Files:**
- Modify: `README.md`

**Step 1: Update title**

Replace line 1: `# PropertyTracker` → `# BrickTrack`

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rename PropertyTracker to BrickTrack in README"
```

---

### Task 9: Documentation Files

**Files:**
- Modify: All files in `docs/` containing PropertyTracker

**Step 1: Bulk replace in docs**

Use find-and-replace across all markdown files in docs/:
- `PropertyTracker` → `BrickTrack`
- `Property Tracker` → `Brick Track`

**Step 2: Verify changes**

Run: `grep -rn "PropertyTracker" docs/`
Expected: Only the design file we created should remain (explains the rename)

**Step 3: Commit**

```bash
git add docs/
git commit -m "docs: rename PropertyTracker to BrickTrack in documentation"
```

---

### Task 10: Blog Content

**Files:**
- Modify: All files in `content/blog/` containing PropertyTracker

**Step 1: Bulk replace in blog posts**

Replace all occurrences of `PropertyTracker` → `BrickTrack` in blog posts.

**Step 2: Verify changes**

Run: `grep -rn "PropertyTracker" content/blog/`
Expected: No matches

**Step 3: Commit**

```bash
git add content/blog/
git commit -m "docs: rename PropertyTracker to BrickTrack in blog posts"
```

---

### Task 11: Remaining Source Files

**Files:**
- All remaining `src/` files containing PropertyTracker

**Step 1: Find remaining files**

Run: `grep -rln "PropertyTracker" src/`

**Step 2: Update each file**

Replace `PropertyTracker` → `BrickTrack` in:
- `src/server/services/chat-system-prompt.ts`
- `src/server/services/notification.ts`
- `src/config/tours/dashboard.ts`
- `src/components/onboarding/EnhancedWizard.tsx`
- `src/components/onboarding/OnboardingWizard.tsx`
- `src/app/(dashboard)/settings/referrals/page.tsx`
- `src/app/(dashboard)/settings/integrations/propertyme/page.tsx`
- `src/app/(dashboard)/settings/mobile/page.tsx`
- `src/app/(dashboard)/banking/connect/page.tsx`
- `src/app/(legal)/terms/page.tsx`
- `src/app/(legal)/privacy/page.tsx`
- `src/app/changelog/layout.tsx`
- `src/app/changelog/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/blog/layout.tsx`
- `src/app/feedback/page.tsx`
- `src/app/share/[token]/page.tsx`
- `src/app/share/loan-pack/[token]/page.tsx`
- `src/app/api/export/tax-report/route.ts`
- `src/app/api/og/share/[token]/route.tsx`
- `src/app/api/cron/uptime-check/route.ts`
- `src/lib/share-pdf.ts`
- `src/lib/loan-pack-pdf.ts`
- `src/lib/mytax-pdf.ts`

**Step 3: Verify changes**

Run: `grep -rn "PropertyTracker" src/`
Expected: No matches

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: rename PropertyTracker to BrickTrack in remaining source files"
```

---

### Task 12: Scripts and E2E

**Files:**
- Modify: Files in `scripts/` and `e2e/` containing PropertyTracker

**Step 1: Find and update**

Replace `PropertyTracker` → `BrickTrack` in:
- `scripts/generate-audit-report.ts`
- `scripts/manual-qa-test.ts`
- `scripts/capture-landing-screenshots.ts`
- `e2e/ui-audit/README.md`

**Step 2: Verify changes**

Run: `grep -rn "PropertyTracker" scripts/ e2e/`
Expected: No matches

**Step 3: Commit**

```bash
git add scripts/ e2e/
git commit -m "chore: rename PropertyTracker to BrickTrack in scripts and e2e"
```

---

### Task 13: Mobile Source Files

**Files:**
- Modify: Files in `mobile/src/` and `mobile/e2e/` containing PropertyTracker

**Step 1: Update mobile files**

Replace `PropertyTracker` → `BrickTrack` in:
- `mobile/src/app/SettingsScreen.tsx`
- `mobile/src/app/LoginScreen.tsx`
- `mobile/e2e/screens/settings.spec.ts`
- `mobile/.detoxrc.js`
- `mobile/README.md`

**Step 2: Verify changes**

Run: `grep -rn "PropertyTracker" mobile/`
Expected: No matches (except bundleIdentifier which we're keeping)

**Step 3: Commit**

```bash
git add mobile/
git commit -m "feat: rename PropertyTracker to BrickTrack in mobile app"
```

---

### Task 14: Final Verification

**Step 1: Search for any remaining references**

Run: `grep -ri "PropertyTracker" --include="*.tsx" --include="*.ts" --include="*.md" --include="*.json" --include="*.svg" .`

Expected: Only technical references should remain:
- Bundle identifiers in `mobile/app.json`

**Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Lint check**

Run: `npm run lint`
Expected: No errors

**Step 4: Create final commit if any stragglers**

```bash
git add -A
git commit -m "chore: final PropertyTracker to BrickTrack cleanup"
```

---

### Task 15: Create PR

**Step 1: Push branch**

```bash
git push -u origin feature/bricktrack-rename
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: rename PropertyTracker to BrickTrack" --body "## Summary
- Renamed all user-facing brand references from PropertyTracker to BrickTrack
- Updated landing page, layout metadata, email templates, mobile app name
- Updated all documentation and blog posts
- Updated OG image SVG text

## What's NOT changed (by design)
- package.json name (property-tracker)
- Bundle identifiers (com.propertytracker.app)
- Vercel URLs
- Environment variable names

## Test plan
- [ ] Landing page shows 'BrickTrack' branding
- [ ] Sidebar shows 'BrickTrack'
- [ ] Email templates render with 'BrickTrack'
- [ ] Mobile app displays 'BrickTrack' name
- [ ] OG image shows 'BrickTrack'

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
