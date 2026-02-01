import { baseTemplate } from "./base";

export function trialReminderSubject(daysLeft: number): string {
  if (daysLeft === 0) return "Your PropertyTracker Pro trial has ended";
  if (daysLeft === 1) return "Last day of your PropertyTracker Pro trial";
  return `Your PropertyTracker Pro trial ends in ${daysLeft} days`;
}

export function trialReminderTemplate({
  name,
  daysLeft,
  upgradeUrl,
}: {
  name: string | null;
  daysLeft: number;
  upgradeUrl: string;
}): string {
  const greeting = name ? `Hi ${name},` : "Hi,";

  if (daysLeft === 0) {
    const content = `
      <h2 style="color: #dc2626; margin: 0 0 20px 0;">Your Pro Trial Has Ended</h2>
      <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
        Your 14-day PropertyTracker Pro trial has ended. Your account has been moved to the Free plan.
      </p>
      <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
        On the Free plan, you can access 1 property. Any additional properties have been locked but your data is safe.
      </p>
      <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
        Ready to unlock everything?
      </p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${upgradeUrl}"
           style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          Upgrade to Pro
        </a>
      </div>
      <p style="font-size: 16px; color: #374151; margin: 20px 0 0 0;">
        Thanks for trying PropertyTracker!
      </p>
    `;
    return baseTemplate(content);
  }

  const content = `
    <h2 style="color: #f59e0b; margin: 0 0 20px 0;">
      Your Pro Trial ${daysLeft === 1 ? "Ends Tomorrow" : `Ends in ${daysLeft} Days`}
    </h2>
    <p style="font-size: 16px; margin: 0 0 16px 0;">${greeting}</p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 16px 0;">
      Your PropertyTracker Pro trial ${daysLeft === 1 ? "ends tomorrow" : `ends in ${daysLeft} days`}.
    </p>
    <p style="font-size: 16px; color: #374151; margin: 0 0 20px 0;">
      To keep access to unlimited properties, bank feeds, tax reports, and more, upgrade now:
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${upgradeUrl}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
        Upgrade to Pro - $14/month
      </a>
    </div>
    <p style="font-size: 16px; color: #374151; margin: 20px 0 0 0;">
      Thanks for using PropertyTracker!
    </p>
  `;
  return baseTemplate(content);
}
