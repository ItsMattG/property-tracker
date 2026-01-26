import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ArrowRight,
  Shield,
  Landmark,
  FileSpreadsheet,
  CheckCircle,
} from "lucide-react";

export default function HomePage() {
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

      {/* Benefits */}
      <section className="py-20 px-4">
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
