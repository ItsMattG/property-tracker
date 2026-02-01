import { baseTemplate } from "./base";
import { format } from "date-fns";

export function welcomeEmailSubject(): string {
  return "Welcome to BrickTrack! Your 14-day Pro trial is active";
}

export function welcomeEmailTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name}!` : "Hi!";
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au";

  const content = `
    <h2 style="color: #2563eb; margin: 0 0 20px 0;">Welcome to BrickTrack!</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      You now have <strong>full Pro access for 14 days</strong> - no credit card required.
    </p>
    <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0;">
      Your trial ends on <strong>${trialEndDate}</strong>.
    </p>

    <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 0 0 24px 0;">
      <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 16px;">Quick Start:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #374151;">
        <li style="margin-bottom: 8px;">Add your first investment property</li>
        <li style="margin-bottom: 8px;">Connect your bank for automatic transaction import</li>
        <li style="margin-bottom: 8px;">Track rental income and expenses effortlessly</li>
      </ol>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/properties/new"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Add Your First Property
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
      <a href="${appUrl}/settings/billing" style="color: #2563eb;">Explore all Pro features</a>
    </p>
  `;
  return baseTemplate(content);
}
