import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - BrickTrack",
  description: "How BrickTrack collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="py-12 md:py-20 px-4">
      <div className="container mx-auto max-w-3xl prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="lead">Last updated: February 2026</p>

        <h2>1. Information We Collect</h2>
        <p>
          When you use BrickTrack, we collect information you provide directly:
        </p>
        <ul>
          <li>Account information (name, email address)</li>
          <li>Property details you enter</li>
          <li>Financial data from connected bank accounts (via Basiq open banking)</li>
          <li>Documents you upload</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide and improve our services</li>
          <li>Generate reports and analytics for your properties</li>
          <li>Send service-related notifications</li>
          <li>Provide customer support</li>
        </ul>

        <h2>3. Bank Data Security</h2>
        <p>
          We connect to your bank accounts through Basiq, an accredited open banking provider.
          We never see or store your bank login credentials. All bank connections use
          bank-grade encryption and comply with Australian data security standards.
        </p>

        <h2>4. Data Storage</h2>
        <p>
          Your data is stored on secure servers located in Australia. We use encryption
          at rest and in transit to protect your information.
        </p>

        <h2>5. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with:</p>
        <ul>
          <li>Service providers who help us operate (hosting, analytics)</li>
          <li>When required by law or to protect our rights</li>
          <li>With your consent (e.g., sharing reports with your accountant)</li>
        </ul>

        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Delete your account and data</li>
          <li>Export your data</li>
          <li>Disconnect bank accounts at any time</li>
        </ul>

        <h2>7. Cookies</h2>
        <p>
          We use essential cookies for authentication and session management.
          We use analytics cookies to understand how you use our service.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. We will notify you of
          significant changes via email or in-app notification.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have questions about this privacy policy, please contact us at{" "}
          <a href="mailto:privacy@propertytracker.com.au">privacy@propertytracker.com.au</a>.
        </p>
      </div>
    </main>
  );
}
