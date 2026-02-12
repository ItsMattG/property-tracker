import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manage Your Data Consent - BrickTrack",
  description:
    "Learn how BrickTrack collects and uses your bank data through open banking, and how to manage or revoke your consent.",
};

export default function ConsentPage() {
  return (
    <main className="py-12 md:py-20 px-4">
      <div className="container mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Manage Your Data Consent</h1>
        <p className="lead">Last updated: February 2026</p>

        <p>
          BrickTrack uses{" "}
          <a
            href="https://basiq.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Basiq
          </a>
          , an accredited Consumer Data Right (CDR) intermediary, to securely
          access your bank data. This page explains what data we collect, how we
          use it, and how you can manage or revoke your consent at any time.
        </p>

        <h2>1. What Data We Collect</h2>
        <p>
          When you connect a bank account through open banking, we access the
          following data:
        </p>
        <ul>
          <li>Your name and account holder details</li>
          <li>Account names, numbers, types, and balances</li>
          <li>Transaction history (descriptions, amounts, dates, categories)</li>
        </ul>
        <p>
          We <strong>never</strong> see or store your bank login credentials.
          Authentication is handled entirely by your bank through the CDR
          framework.
        </p>

        <h2>2. How We Use Your Data</h2>
        <p>Your bank data is used to:</p>
        <ul>
          <li>
            Automatically import and categorise transactions for your investment
            properties
          </li>
          <li>Generate financial reports and tax summaries</li>
          <li>
            Calculate rental yield, cash flow, and other portfolio metrics
          </li>
          <li>Provide insights into your property portfolio performance</li>
        </ul>
        <p>
          We do not sell your data, use it for marketing, or share it with third
          parties beyond what is necessary to provide our service.
        </p>

        <h2>3. Consent Duration</h2>
        <p>
          Your consent is valid for <strong>12 months</strong> from the date you
          connect your bank account. After this period, consent automatically
          expires and we will no longer access new data from your bank. You can
          renew your consent at any time by reconnecting your account.
        </p>

        <h2>4. How to Revoke Your Consent</h2>
        <p>You can revoke your consent at any time by:</p>
        <ul>
          <li>
            Going to the{" "}
            <Link href="/banking">Banking</Link> page in your BrickTrack
            dashboard and disconnecting your account
          </li>
          <li>
            Contacting us at{" "}
            <a href="mailto:privacy@bricktrack.au">privacy@bricktrack.au</a>{" "}
            and requesting revocation
          </li>
          <li>
            Revoking access directly through your bank&apos;s CDR consent
            management portal
          </li>
        </ul>

        <h2>5. What Happens After Revocation</h2>
        <p>When you revoke consent:</p>
        <ul>
          <li>We immediately stop accessing new data from your bank</li>
          <li>
            Previously imported transactions remain in your BrickTrack account
            so your reports stay intact
          </li>
          <li>
            If you request full data deletion, all imported bank data will be
            permanently removed within 30 days
          </li>
        </ul>

        <h2>6. Requesting Data Deletion</h2>
        <p>
          To request deletion of all bank data we hold, email{" "}
          <a href="mailto:privacy@bricktrack.au">privacy@bricktrack.au</a> with
          the subject line &ldquo;Data Deletion Request&rdquo;. We will confirm
          deletion within 30 days.
        </p>
        <p>
          You can also delete your entire BrickTrack account from your{" "}
          <Link href="/settings">account settings</Link>, which removes all
          data including imported bank transactions.
        </p>

        <h2>7. Data Security</h2>
        <p>
          All bank data is encrypted at rest and in transit. Our infrastructure
          is hosted in Australia and we follow industry best practices for data
          security. See our{" "}
          <Link href="/privacy">Privacy Policy</Link> for full details.
        </p>

        <h2>8. Contact Us</h2>
        <p>
          If you have questions about your data consent or want to exercise any
          of your rights, contact us at{" "}
          <a href="mailto:privacy@bricktrack.au">privacy@bricktrack.au</a>.
        </p>
      </div>
    </main>
  );
}
