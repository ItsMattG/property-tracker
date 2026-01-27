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
import { LifetimeBanner } from "@/components/landing/LifetimeBanner";
import { FaqSection } from "@/components/landing/FaqSection";

export const revalidate = 3600; // Revalidate every hour

export default async function HomePage() {
  // Fetch live stats for social proof (gracefully handle missing DB during build)
  let userCount = 0;
  let propertyCount = 0;
  try {
    const [userCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [propertyCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties);
    userCount = userCountResult?.count ?? 0;
    propertyCount = propertyCountResult?.count ?? 0;
  } catch {
    // DB unavailable during build — use fallback zeros
  }

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
              <Link href="/blog">Blog</Link>
            </Button>
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
            <Link href="/blog" className="hover:text-foreground">
              Blog
            </Link>
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
