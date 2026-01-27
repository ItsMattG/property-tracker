# Landing Page Overhaul Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the minimal landing page into a high-converting page with social proof, product screenshots, pricing, and FAQ.

**Scope:** 4 new sections added to existing page. No new routes — all changes in `src/app/page.tsx`.

---

## Page Section Order

1. Header (existing — keep as-is)
2. Hero (existing — keep as-is)
3. **Social Proof Bar** (new)
4. Features (existing — keep as-is)
5. **Product Screenshots** (new)
6. Benefits (existing — keep as-is)
7. **Pricing** (new)
8. **FAQ** (new)
9. CTA (existing — keep as-is)
10. Footer (existing — keep as-is)

---

## New Section 1: Social Proof Bar

**Position:** Between Hero and Features

**Design:** Horizontal strip, `bg-muted`, `py-6`. Four items in a row on desktop, 2x2 grid on mobile.

**Content (live DB counts, cached hourly):**
- 🏠 `{propertyCount}` Properties Tracked
- 👥 `{userCount}` Investors
- 🔒 Bank-Grade Encryption (static)
- 🇦🇺 Australian Owned & Hosted (static)

**Data source:** Server component query to count `users` and `properties` tables. Use `revalidate = 3600` (hourly cache).

**Component:** Create `SocialProofBar` as a server component in `src/app/page.tsx` (inline, no separate file needed).

---

## New Section 2: Product Screenshots

**Position:** Between Features and Benefits

**Design:** 3-panel alternating layout. Each panel has a screenshot placeholder on one side and text on the other, alternating left/right.

**Panels:**

1. **Dashboard Overview** (image left, text right)
   - Badge: "Dashboard"
   - Heading: "See your whole portfolio at a glance"
   - Description: "Track property values, rental income, expenses, and equity across all your investments in one unified dashboard."

2. **Tax Reports** (text left, image right)
   - Badge: "Reports"
   - Heading: "Tax-ready reports in one click"
   - Description: "Generate ATO-compliant income and expense reports broken down by property. Export CSV files your accountant will love."

3. **Bank Feeds** (image left, text right)
   - Badge: "Banking"
   - Heading: "Automatic bank transaction import"
   - Description: "Connect all major Australian banks via secure open banking. Transactions import and categorize automatically."

**Placeholder images:** Rounded `aspect-video` containers with `bg-muted` border, containing centered text "Screenshot" and a subtle image icon. Images stored in `public/images/screenshots/` when ready.

**Responsive:** On mobile, stacks vertically (image always on top).

---

## New Section 3: Pricing

**Position:** Between Benefits and FAQ

### Lifetime Deal Banner

Positioned above the pricing cards. Accent/gradient background (`bg-primary/5` with primary border).

- Heading: "Founding Member Deal"
- Text: "Get lifetime Pro access for a one-time payment of $249. No subscription ever."
- CTA button: "Claim Lifetime Deal" → `/sign-up?plan=lifetime`
- Scarcity: "Limited to first 100 founding members"
- Dismissible via X button (client-side state, localStorage to remember dismissal)

### Pricing Cards

Three cards side-by-side. Pro card elevated with ring border and "Most Popular" badge.

**Free — $0/month:**
- 1 property
- Australian bank feeds
- Basic tax categorization
- Transaction import
- Mobile app access
- CTA: "Start Free" → `/sign-up`

**Pro — $14/month:**
- Everything in Free
- Unlimited properties
- Full tax reports & CSV export
- Scenario simulator (what-if modeling)
- Climate & flood risk data
- Trust/SMSF entity support
- Performance benchmarking
- CTA: "Start Free Trial" → `/sign-up?plan=pro`

**Team — $29/month:**
- Everything in Pro
- Up to 5 team members
- Broker portal & loan packs
- Audit log
- Portfolio sharing
- Priority support
- CTA: "Start Free Trial" → `/sign-up?plan=team`

Annual billing note: "Prices shown are monthly. Billed annually."

---

## New Section 4: FAQ

**Position:** Between Pricing and CTA

**Design:** Centered heading + Radix Accordion (shadcn `Accordion` component, `type="single"`, `collapsible`).

**Questions:**

1. **Is my financial data secure?**
   Your data is protected with bank-grade AES-256 encryption and stored on Australian servers. We use Basiq open banking to connect to your bank — we never see or store your bank passwords. Authentication is handled by Clerk with multi-factor support.

2. **Which Australian banks do you support?**
   We support all major Australian banks including Commonwealth Bank, NAB, ANZ, and Westpac, plus over 100 other financial institutions via Basiq open banking.

3. **Can I use PropertyTracker with my accountant?**
   Yes. Export ATO-compliant CSV and PDF reports at any time. You can also share read-only portfolio access directly with your accountant or broker via the Team plan.

4. **Does it work with trusts and SMSFs?**
   Yes. PropertyTracker supports individual ownership, family trusts, unit trusts, companies, and self-managed super funds with full compliance tracking for each entity type.

5. **Can I cancel anytime?**
   Yes, no lock-in contracts. Cancel anytime and keep access until the end of your current billing period. Your data remains available for export.

6. **Is there a free plan?**
   Yes. Track 1 property free forever with bank feeds and basic tax categorization. Upgrade to Pro when you add more properties.

7. **How does the lifetime deal work?**
   Pay $249 once and get permanent Pro access — no monthly or annual fees ever. This is limited to our first 100 founding members and the offer will be removed once all spots are claimed.

---

## Technical Notes

- All changes are in `src/app/page.tsx` (server component for DB query)
- The page currently uses `export default function HomePage()` — needs to become `async` for the DB query
- Social proof stats: import `db` from `@/server/db`, query `users` and `properties` table counts
- Use existing shadcn components: `Button`, `Badge`, `Accordion`
- Accordion may need to be installed: check `src/components/ui/accordion.tsx`
- Lifetime banner dismissal: extract a small client component for the banner with `useState` + `localStorage`
- Screenshots section: use placeholder divs now, replace with `<Image>` from `next/image` later
- No new API routes or tRPC procedures needed (server component queries directly)

## Competitive Context

**TaxTank:** $15/month for property module (3 properties), +$3/property. Modular pricing.
**The Property Accountant:** $3.99/property/month residential, $7.49/property/month commercial.
**PropertyTracker positioning:** Free tier undercuts both. Pro at $14/month beats TaxTank. Unlimited properties beats per-property pricing at scale.
