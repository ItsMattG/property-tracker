import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
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
import { LifetimeBanner, FaqSection, MobileNav } from "@/components/landing";

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "PropertyTracker",
            applicationCategory: "FinanceApplication",
            operatingSystem: "Web",
            url: "https://www.propertytracker.com.au",
            description: "Track your investment properties, automate bank feeds, and generate tax reports.",
            offers: [
              { "@type": "Offer", price: "0", priceCurrency: "AUD", name: "Free" },
              { "@type": "Offer", price: "14", priceCurrency: "AUD", name: "Pro" },
              { "@type": "Offer", price: "29", priceCurrency: "AUD", name: "Team" },
            ],
            publisher: {
              "@type": "Organization",
              name: "PropertyTracker",
              url: "https://www.propertytracker.com.au",
            },
          }),
        }}
      />
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">PropertyTracker</span>
          </Link>
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-4">
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
          {/* Mobile navigation */}
          <MobileNav />
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 md:py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Track smarter.{" "}
            <span className="text-primary">Tax time sorted.</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            PropertyTracker connects to your bank, categorizes every transaction
            for tax, and generates ATO-ready reports automatically. No more
            spreadsheets. No more stress at EOFY.
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
              <span className="text-2xl font-bold">Secure</span>
              <span className="text-sm text-muted-foreground">Bank-Grade Security</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Globe className="w-5 h-5 text-primary mb-1" />
              <span className="text-2xl font-bold">100%</span>
              <span className="text-sm text-muted-foreground">Australian</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 md:py-20 px-4 bg-secondary">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Built for Australian investors
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Landmark className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Automatic Bank Feeds</h3>
              <p className="text-muted-foreground">
                Connect CBA, NAB, ANZ, Westpac and 100+ other banks. Transactions
                flow in daily via secure open banking.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">ATO-Ready Categories</h3>
              <p className="text-muted-foreground">
                Every expense maps to the right ATO label. Export clean reports
                your accountant can use directly.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Your Data Stays Here</h3>
              <p className="text-muted-foreground">
                Encrypted, stored on Australian servers, and we never see your
                bank passwords.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Screenshots */}
      <section className="py-12 md:py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            See it in action
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            One place for properties, transactions, and tax reports.
          </p>

          <div className="space-y-12 md:space-y-16">
            {/* Panel 1: Dashboard */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 rounded-xl border overflow-hidden shadow-lg">
                <Image
                  src="/images/screenshots/dashboard.png"
                  alt="PropertyTracker dashboard showing portfolio overview with properties, transactions, potential savings, and rental yield metrics"
                  width={1280}
                  height={800}
                  className="w-full h-auto"
                  priority
                />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Dashboard</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  Your portfolio, one screen
                </h3>
                <p className="text-muted-foreground">
                  Property values, rental income, expenses, loan balances, and equity —
                  all updated automatically. Spot potential savings and track each
                  property&apos;s performance at a glance.
                </p>
              </div>
            </div>

            {/* Panel 2: Tax Reports (reversed) */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-8">
              <div className="flex-1 rounded-xl border overflow-hidden shadow-lg">
                <Image
                  src="/images/screenshots/tax-reports.png"
                  alt="PropertyTracker reports page showing tax report options including ATO-compliant reports, capital gains tax, cash flow forecast, and audit checks"
                  width={1280}
                  height={800}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Reports</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  Tax time in minutes, not hours
                </h3>
                <p className="text-muted-foreground">
                  Generate income and expense reports by property, ready for your
                  accountant or MyTax. Track depreciation, capital gains, and
                  deductions without touching a spreadsheet.
                </p>
              </div>
            </div>

            {/* Panel 3: Bank Feeds */}
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 rounded-xl border overflow-hidden shadow-lg">
                <Image
                  src="/images/screenshots/banking.png"
                  alt="PropertyTracker banking page showing connected bank accounts with Commonwealth Bank transaction and offset accounts"
                  width={1280}
                  height={800}
                  className="w-full h-auto"
                />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-primary">Banking</span>
                <h3 className="text-2xl font-bold mt-1 mb-3">
                  Transactions that categorize themselves
                </h3>
                <p className="text-muted-foreground">
                  Connect your bank once. Transactions import daily and categorize
                  automatically using smart rules. Just review and approve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 md:py-20 px-4 bg-secondary">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            What you get back: time
          </h2>
          <div className="space-y-4">
            {[
              "Bank transactions import and categorize automatically",
              "ATO expense codes applied without manual entry",
              "Export-ready reports for your accountant or MyTax",
              "Unlimited properties across multiple entities",
              "Full support for trusts, companies, and SMSFs",
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
      <section className="py-12 md:py-20 px-4" id="pricing">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simple pricing. No surprises.
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start free, upgrade when you need more.
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
                  "Bank feeds included",
                  "Basic tax categories",
                  "Mobile app",
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
                  "Full tax reports & exports",
                  "Scenario modelling",
                  "Climate & flood risk",
                  "Trusts, companies & SMSFs",
                  "Depreciation tracking",
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
      <section className="py-12 md:py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to ditch the spreadsheet?
          </h2>
          <p className="mb-8 opacity-90">
            Join Australian investors who track smarter and stress less at tax time.
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
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-muted-foreground">
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
