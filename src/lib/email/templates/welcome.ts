import { format } from "date-fns";
import { baseTemplate } from "./base";

export function welcomeEmailSubject(): string {
  return "Welcome to BrickTrack - Your 14-day Pro trial has started";
}

export function welcomeEmailTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");

  const content = `
    <h2 style="color: #16a34a; margin: 0 0 20px 0;">Welcome to BrickTrack!</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      Thanks for signing up! Your 14-day Pro trial is now active and you have full access to all features until <strong>${trialEndDate}</strong>.
    </p>
    <h3 style="color: #1f2937; margin: 24px 0 12px 0;">What you can do with BrickTrack Pro:</h3>
    <ul style="font-size: 15px; color: #374151; margin: 0 0 20px 0; padding-left: 20px;">
      <li style="margin-bottom: 8px;">Track unlimited investment properties</li>
      <li style="margin-bottom: 8px;">Connect bank feeds for automatic transaction import</li>
      <li style="margin-bottom: 8px;">Generate tax reports and depreciation schedules</li>
      <li style="margin-bottom: 8px;">Calculate rental yields and cash flow projections</li>
      <li style="margin-bottom: 8px;">Share portfolio summaries with your accountant or advisor</li>
    </ul>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au"}/dashboard"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Go to Your Dashboard
      </a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
      Need help getting started? Check out our <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au"}/help" style="color: #2563eb;">help center</a> or reply to this email.
    </p>
  `;
  return baseTemplate(content);
}
