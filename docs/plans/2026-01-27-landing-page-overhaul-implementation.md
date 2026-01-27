# Landing Page Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add social proof, product screenshots, pricing, and FAQ sections to the landing page to improve conversion.

**Architecture:** All new sections are added to `src/app/page.tsx`. The page becomes an async server component to query live user/property counts (hourly cache). One new client component (`LifetimeBanner`) handles dismissible state. The accordion component is installed from shadcn/ui.

**Tech Stack:** Next.js 16, Drizzle ORM, shadcn/ui (Accordion), Tailwind CSS, lucide-react

---

## Task 1: Install shadcn Accordion component

**Files:**
- Create: `src/components/ui/accordion.tsx`

**Step 1: Install the component**

Run:
```bash
npx shadcn@latest add accordion
```

If prompted, accept defaults.

**Step 2: Verify the file was created**

Run:
```bash
ls src/components/ui/accordion.tsx
```
Expected: File exists

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/' | head -5
```
Expected: No errors from source files

**Step 4: Commit**

```bash
git add src/components/ui/accordion.tsx package.json package-lock.json
git commit -m "chore: add shadcn accordion component"
```

---

## Task 2: Add Social Proof Bar section

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Convert page to async server component and add social proof bar**

Replace the entire `src/app/page.tsx` with the following. The key changes are:
1. Import `db`, `sql`, `users`, `properties` for live counts
2. Make `HomePage` async
3. Add `revalidate = 3600` for hourly caching
4. Insert Social Proof Bar section between Hero and Features

```typescript
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ArrowRight,
  Shield,
  Landmark,
  FileSpreadsheet,
  CheckCircle,
  Home,
  Users,
  Lock,
  Globe,
} from "lucide-react";
import { db } from "@/server/db";
import { users, properties } from "@/server/db/schema";
import { sql } from "drizzle-orm";

export const revalidate = 3600; // Revalidate every hour

export default async function HomePage() {
  // Fetch live stats for social proof
  const [userCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const [propertyCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(properties);

  const userCount = userCountResult?.count ?? 0;
  const propertyCount = propertyCountResult?.count ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">PropertyTracker</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Your spreadsheet,{" "}
            <span className="text-primary">automated</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Stop spending hours updating spreadsheets. PropertyTracker
            automatically imports your bank transactions, categorizes them for
            tax, and generates accountant-ready reports.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-6 px-4 bg-muted border-y">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="flex flex-col items-center gap-1">
              <Home className="w-5 h-5 text-primary mb-1" />
              <span className="text-2xl font-bold">{propertyCount}+</span>
              <span className="text-sm text-muted-foreground">Properties Tracked</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Users className="w-5 h-5 text-primary mb-1" />
              <span className="text-2xl font-bold">{userCount}+</span>
              <span className="text-sm text-muted-foreground">Investors</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Lock className="w-5 h-5 text-primary mb-1" />
              <span className="text-2xl font-bold">AES-256</span>
              <span className="text-sm text-muted-foreground">Bank-Grade Encryption</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Globe className="w-5 h-5 text-primary mb-1" />
              <span className="text-2xl font-bold">AU</span>
              <span className="text-sm text-muted-foreground">Australian Owned</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-secondary">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Australian property investors
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Landmark className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Australian Bank Feeds</h3>
              <p className="text-muted-foreground">
                Connect all major Australian banks. Transactions import
                automatically via secure open banking.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">ATO Tax Categories</h3>
              <p className="text-muted-foreground">
                Every expense maps to the correct ATO category. Export CSV files
                your accountant will love.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Bank-Grade Security</h3>
              <p className="text-muted-foreground">
                Your data is encrypted and stored on Australian servers. We
                never see your bank passwords.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Screenshots */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            See PropertyTracker in action
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Everything you need to manage your investment properties, all in one place.
          </p>

          <div className="space-y-16">
            {/* Panel 1: Dashboard */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 rounded-xl border bg-muted aspect-video flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Dashboard Screenshot</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Dashboard</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  See your whole portfolio at a glance
                </h3>
                <p className="text-muted-foreground">
                  Track property values, rental income, expenses, and equity across all
                  your investments in one unified dashboard. Monitor cash flow, spot
                  anomalies, and see how each property is performing.
                </p>
              </div>
            </div>

            {/* Panel 2: Tax Reports (reversed) */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-8">
              <div className="flex-1 rounded-xl border bg-muted aspect-video flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Tax Reports Screenshot</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Reports</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  Tax-ready reports in one click
                </h3>
                <p className="text-muted-foreground">
                  Generate ATO-compliant income and expense reports broken down by
                  property. Export CSV files your accountant will love. Track
                  depreciation, capital gains, and tax deductions automatically.
                </p>
              </div>
            </div>

            {/* Panel 3: Bank Feeds */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 rounded-xl border bg-muted aspect-video flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Landmark className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Bank Feeds Screenshot</p>
                </div>
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Banking</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  Automatic bank transaction import
                </h3>
                <p className="text-muted-foreground">
                  Connect all major Australian banks via secure open banking. Transactions
                  import and categorize automatically. Review and approve with a single
                  click.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-secondary">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Save hours every week
          </h2>
          <div className="space-y-4">
            {[
              "Automatic transaction import from all your accounts",
              "Smart categorization with ATO-compliant expense codes",
              "One-click export for your accountant",
              "Track multiple properties across entities",
              "Works with trusts, companies, and personal ownership",
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4" id="pricing">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start free. Upgrade when you&apos;re ready.
          </p>

          {/* Lifetime Deal Banner */}
          <LifetimeBanner />

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free */}
            <div className="rounded-xl border bg-card p-8 flex flex-col">
              <h3 className="text-lg font-semibold">Free</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "1 property",
                  "Australian bank feeds",
                  "Basic tax categorization",
                  "Transaction import",
                  "Mobile app access",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/sign-up">Start Free</Link>
              </Button>
            </div>

            {/* Pro */}
            <div className="rounded-xl border-2 border-primary bg-card p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              <h3 className="text-lg font-semibold">Pro</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$14</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Unlimited properties",
                  "Everything in Free",
                  "Full tax reports & CSV export",
                  "Scenario simulator",
                  "Climate & flood risk data",
                  "Trust/SMSF entity support",
                  "Performance benchmarking",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" asChild>
                <Link href="/sign-up?plan=pro">Start Free Trial</Link>
              </Button>
            </div>

            {/* Team */}
            <div className="rounded-xl border bg-card p-8 flex flex-col">
              <h3 className="text-lg font-semibold">Team</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {[
                  "Everything in Pro",
                  "Up to 5 team members",
                  "Broker portal & loan packs",
                  "Audit log",
                  "Portfolio sharing",
                  "Priority support",
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/sign-up?plan=team">Start Free Trial</Link>
              </Button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            All prices in AUD. Billed annually. Cancel anytime.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to automate your property tracking?
          </h2>
          <p className="mb-8 opacity-90">
            Join Australian property investors who have stopped wrestling with
            spreadsheets.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/sign-up">
              Get Started Free
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">
              PropertyTracker &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/changelog" className="hover:text-foreground">
              Changelog
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

Note: `LifetimeBanner` and `FaqSection` are referenced but not yet defined. They will be created in subsequent tasks and imported. For this step, TypeScript will show errors for these — that's expected. We will fix them in Tasks 3 and 4.

**Step 2: Verify the DB query imports work**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/' | grep 'page.tsx' | head -10
```
Expected: Only errors about `LifetimeBanner` and `FaqSection` not being defined — no DB or import errors.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(landing): add social proof bar and product screenshots sections"
```

---

## Task 3: Create LifetimeBanner client component

**Files:**
- Create: `src/components/landing/LifetimeBanner.tsx`
- Modify: `src/app/page.tsx` (add import)

**Step 1: Create the component**

Create `src/components/landing/LifetimeBanner.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const DISMISSED_KEY = "lifetime-banner-dismissed";

export function LifetimeBanner() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (!wasDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative mb-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-semibold">Founding Member Deal</span>
        </div>
        <p className="text-sm text-muted-foreground text-center sm:text-left flex-1">
          Get lifetime Pro access for a one-time payment of $249.
          No subscription ever. Limited to first 100 founding members.
        </p>
        <Button size="sm" asChild>
          <Link href="/sign-up?plan=lifetime">Claim Lifetime Deal</Link>
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Add import to page.tsx**

At the top of `src/app/page.tsx`, add after the existing imports:

```typescript
import { LifetimeBanner } from "@/components/landing/LifetimeBanner";
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/' | grep 'page.tsx' | head -10
```
Expected: Only error about `FaqSection` not being defined.

**Step 4: Commit**

```bash
git add src/components/landing/LifetimeBanner.tsx src/app/page.tsx
git commit -m "feat(landing): add dismissible lifetime deal banner"
```

---

## Task 4: Create FaqSection client component

**Files:**
- Create: `src/components/landing/FaqSection.tsx`
- Modify: `src/app/page.tsx` (add import)

**Step 1: Create the component**

Create `src/components/landing/FaqSection.tsx`:

```typescript
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Is my financial data secure?",
    answer:
      "Your data is protected with bank-grade AES-256 encryption and stored on Australian servers. We use Basiq open banking to connect to your bank — we never see or store your bank passwords. Authentication is handled by Clerk with multi-factor support.",
  },
  {
    question: "Which Australian banks do you support?",
    answer:
      "We support all major Australian banks including Commonwealth Bank, NAB, ANZ, and Westpac, plus over 100 other financial institutions via Basiq open banking.",
  },
  {
    question: "Can I use PropertyTracker with my accountant?",
    answer:
      "Yes. Export ATO-compliant CSV and PDF reports at any time. You can also share read-only portfolio access directly with your accountant or broker via the Team plan.",
  },
  {
    question: "Does it work with trusts and SMSFs?",
    answer:
      "Yes. PropertyTracker supports individual ownership, family trusts, unit trusts, companies, and self-managed super funds with full compliance tracking for each entity type.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes, no lock-in contracts. Cancel anytime and keep access until the end of your current billing period. Your data remains available for export.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Track 1 property free forever with bank feeds and basic tax categorization. Upgrade to Pro when you add more properties.",
  },
  {
    question: "How does the lifetime deal work?",
    answer:
      "Pay $249 once and get permanent Pro access — no monthly or annual fees ever. This is limited to our first 100 founding members and the offer will be removed once all spots are claimed.",
  },
];

export function FaqSection() {
  return (
    <section className="py-20 px-4 bg-secondary">
      <div className="container mx-auto max-w-3xl">
        <h2 className="text-3xl font-bold text-center mb-4">
          Frequently asked questions
        </h2>
        <p className="text-center text-muted-foreground mb-12">
          Everything you need to know about PropertyTracker.
        </p>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
```

**Step 2: Add import to page.tsx**

At the top of `src/app/page.tsx`, add after the LifetimeBanner import:

```typescript
import { FaqSection } from "@/components/landing/FaqSection";
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/' | head -5
```
Expected: No errors from source files

**Step 4: Commit**

```bash
git add src/components/landing/FaqSection.tsx src/app/page.tsx
git commit -m "feat(landing): add FAQ section with accordion"
```

---

## Task 5: Update E2E tests for new sections

**Files:**
- Modify: `e2e/landing.spec.ts`

**Step 1: Add tests for new sections**

Replace the entire `e2e/landing.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display hero section with tagline", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /your spreadsheet/i })).toBeVisible();
    await expect(page.getByText(/automated/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start free trial/i })).toBeVisible();
  });

  test("should display navigation with sign in and get started", async ({ page }) => {
    await page.goto("/");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("should display feature cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/australian bank feeds/i)).toBeVisible();
    await expect(page.getByText(/ato tax categories/i)).toBeVisible();
    await expect(page.getByText(/bank-grade security/i)).toBeVisible();
  });

  test("should display social proof bar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/properties tracked/i)).toBeVisible();
    await expect(page.getByText(/investors/i)).toBeVisible();
    await expect(page.getByText(/bank-grade encryption/i)).toBeVisible();
    await expect(page.getByText(/australian owned/i)).toBeVisible();
  });

  test("should display product screenshot panels", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/see your whole portfolio at a glance/i)).toBeVisible();
    await expect(page.getByText(/tax-ready reports in one click/i)).toBeVisible();
    await expect(page.getByText(/automatic bank transaction import/i)).toBeVisible();
  });

  test("should display benefits list", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/automatic transaction import/i)).toBeVisible();
    await expect(page.getByText(/smart categorization/i)).toBeVisible();
    await expect(page.getByText(/one-click export/i)).toBeVisible();
  });

  test("should display pricing cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/simple, transparent pricing/i)).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$14")).toBeVisible();
    await expect(page.getByText("$29")).toBeVisible();
    await expect(page.getByText(/most popular/i)).toBeVisible();
  });

  test("should display FAQ section with accordion", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
    await expect(page.getByText(/is my financial data secure/i)).toBeVisible();
    await expect(page.getByText(/which australian banks/i)).toBeVisible();
  });

  test("FAQ accordion expands on click", async ({ page }) => {
    await page.goto("/");

    const trigger = page.getByText(/is my financial data secure/i);
    await trigger.click();

    await expect(page.getByText(/aes-256 encryption/i)).toBeVisible();
  });

  test("should navigate to sign up when clicking Get Started", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /start free trial/i }).click();
    await expect(page).toHaveURL(/sign-up/);
  });

  test("should navigate to sign in when clicking Sign In", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("should display footer with links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /changelog/i })).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/landing.spec.ts
git commit -m "test(landing): update E2E tests for new landing page sections"
```

---

## Task 6: Final verification and cleanup

**Step 1: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -v '\.next/' | head -10
```
Expected: No errors from source files

**Step 2: Run linter**

Run:
```bash
npm run lint 2>&1 | grep -E 'error|Error' | grep -v 'node_modules\|\.worktrees\|\.next' | head -10
```
Expected: No errors in source files

**Step 3: Run unit tests**

Run:
```bash
npm run test:unit
```
Expected: All tests pass

**Step 4: Run build**

Run:
```bash
npm run build
```
Expected: Build succeeds

**Step 5: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix(landing): address lint and type issues"
```

---

## Summary

This implementation adds 4 new sections to the landing page:

1. **Social Proof Bar** — Live user/property counts from DB (hourly cache) + trust badges
2. **Product Screenshots** — 3-panel alternating layout with placeholder images
3. **Pricing** — Free ($0) / Pro ($14) / Team ($29) cards + $249 lifetime deal banner (dismissible)
4. **FAQ** — 7-question accordion using shadcn Accordion component

**Files created:** 3
- `src/components/ui/accordion.tsx` (shadcn)
- `src/components/landing/LifetimeBanner.tsx`
- `src/components/landing/FaqSection.tsx`

**Files modified:** 2
- `src/app/page.tsx`
- `e2e/landing.spec.ts`

**Total tasks:** 6
