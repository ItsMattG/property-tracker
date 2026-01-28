# V0.3 Remaining Features Design

**Date:** 2026-01-28
**Status:** Final
**Scope:** SEO Polish + Email Fixes, Advisor Invitation System, Referral/Rewards Program

---

## Feature A: SEO Polish + Email Fixes

### A1. SEO Completion (Phase 4.2)

Add Open Graph and Twitter Card metadata to the root layout / landing page:
- `og:title`, `og:description`, `og:site_name`, `og:type: "website"`, `og:url`, `og:locale: "en_AU"`
- `og:image` — static 1200x630 PNG in `/public/og-image.png` with logo and tagline
- `twitter:card: "summary_large_image"`, `twitter:image`

Add JSON-LD structured data to the landing page:
- `Organization` schema: name, url, logo
- `SoftwareApplication` schema for rich results

### A2. Email Attachment Downloads (Phase 9.1 completion)

Add tRPC query `downloadAttachment`:
- Takes attachment ID
- Verifies user ownership (attachment → email → property → user)
- Generates signed Supabase storage URL (time-limited)
- Returns URL

Wire existing download button in email detail UI to call this endpoint.

### A3. Email Thread Grouping UI

Group emails by `threadId` in the email list component:
- Show thread count badge on grouped items
- Expand/collapse thread view
- Most recent email shown by default when collapsed

---

## Feature B: Advisor Invitation System (Phase 8.4)

### B1. Invite Flow

New `/settings/advisors` page:
- Lists current advisors with role and status
- "Invite Advisor" button with form: email, role (accountant/advisor), optional message
- Invitation sent via transactional email (SendGrid)
- Accept/decline flow: advisor clicks link → signs in or creates account → linked

### B2. Advisor Role & Permissions

Add `advisor` to role enums (alongside existing `accountant`):
- Read-only access to: properties, transactions, tax reports, audit checks, documents
- Cannot: add/edit properties, create transactions, modify settings
- Permission checks in tRPC middleware

### B3. Advisor Dashboard

When a user with advisor role logs in, different dashboard:
- Client list (all users who invited them) with portfolio summary per client
- Click into client to view their data in read-only mode
- Quick access to tax reports and audit checks

No real-time collaboration — advisors view data, they don't co-edit.

### B4. Database Changes

- Add `advisor` to `portfolioMemberRole` and `entityMemberRole` enums
- Add `advisor_invitations` table if needed (or reuse existing invite infrastructure)

---

## Feature C: Referral/Rewards Program (Phase 8.3)

### C1. Referral Codes

Each user gets a unique referral code (`REF-{nanoid}`):
- Generated on account creation or first visit to referral page
- Shareable link: `propertytracker.com.au/r/{code}`
- Referral page at `/settings/referrals`: code, share link, copy button, stats

### C2. Database Schema

```
referral_codes: id, userId, code (unique), createdAt
referrals: id, referrerUserId, refereeUserId, referralCodeId, status (pending/qualified/rewarded/expired), createdAt, qualifiedAt, rewardedAt
referral_credits: id, userId, referralId, monthsFree, appliedAt, expiresAt
```

### C3. Reward Structure

- Referrer: 1 month free Pro plan per qualified referral
- Referee: 1 month free Pro plan on signup
- "Qualified" = referee signs up AND adds at least 1 property (prevents abuse)
- Credits tracked in `referral_credits`, auto-applied at next billing cycle

### C4. Tracking Flow

1. Referee visits `/r/{code}` → cookie set with referral code → redirect to `/sign-up`
2. On signup, if referral cookie present, create `referrals` row (status: pending)
3. When referee adds first property, status → qualified, both users get credits
4. Credits auto-apply at next billing cycle

### C5. UI

- `/settings/referrals` page: referral link, stats (invited, qualified, rewards earned)
- Dashboard notification when a referral qualifies
- Sign-up page: subtle "Referred by a friend?" link

No partner integrations — user-to-user referrals only.
