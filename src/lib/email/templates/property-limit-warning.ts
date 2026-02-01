import { baseTemplate } from "./base";

export function propertyLimitWarningSubject(): string {
  return "Important: Property limits on your BrickTrack trial";
}

export function propertyLimitWarningTemplate({
  name,
  trialEndsAt,
}: {
  name: string | null;
  trialEndsAt: Date;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const formattedDate = trialEndsAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const content = `
    <h2 style="color: #f59e0b; margin: 0 0 20px 0;">Property Limit Reminder</h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      You've added a second property to your BrickTrack account. That's great!
    </p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      Just a heads up: when your trial ends on <strong>${formattedDate}</strong>, only your first property will remain active on the Free plan. Additional properties will be locked (but your data is always safe).
    </p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
      To keep tracking all your properties, consider upgrading to Pro:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://bricktrack.au/billing"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        View Plans
      </a>
    </div>
    <p style="font-size: 16px; color: #374151; margin: 20px 0 0 0;">
      Thanks for using BrickTrack!
    </p>
  `;
  return baseTemplate(content);
}
