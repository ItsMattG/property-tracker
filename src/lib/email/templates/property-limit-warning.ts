import { baseTemplate } from "./base";
import { format, differenceInDays } from "date-fns";

export function propertyLimitWarningSubject(): string {
  return "Quick heads up about your BrickTrack properties";
}

export function propertyLimitWarningTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const trialEndDate = format(trialEndsAt, "MMMM d, yyyy");
  const daysRemaining = differenceInDays(trialEndsAt, new Date());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au";

  const content = `
    <h2 style="color: #f59e0b; margin: 0 0 20px 0;">You've added your 2nd property!</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      Nice work building your portfolio! Your 14-day Pro trial gives you unlimited properties.
    </p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      <strong>Quick heads up:</strong> After your trial ends on ${trialEndDate}, only your first property stays active.
    </p>

    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
      <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">What happens to other properties?</h4>
      <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px;">
        <li style="margin-bottom: 4px;">Your data is preserved (nothing is deleted)</li>
        <li style="margin-bottom: 4px;">Properties become "dormant" - view-only, no new transactions</li>
        <li style="margin-bottom: 4px;">Upgrade anytime to reactivate all properties</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${appUrl}/settings/billing"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Upgrade to Pro - $14/month
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin: 20px 0 0 0;">
      No pressure - you still have ${daysRemaining} days to decide.
    </p>
  `;
  return baseTemplate(content);
}
