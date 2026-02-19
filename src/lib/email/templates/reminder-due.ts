import { baseTemplate } from "./base";

interface ReminderDueData {
  title: string;
  propertyAddress: string;
  dueDate: string;
  daysUntil: number;
  reminderType: string;
  notes?: string | null;
}

const REMINDER_TYPE_LABELS: Record<string, string> = {
  lease_expiry: "Lease Expiry",
  insurance_renewal: "Insurance Renewal",
  fixed_rate_expiry: "Fixed Rate Expiry",
  council_rates: "Council Rates",
  body_corporate: "Body Corporate",
  smoke_alarm: "Smoke Alarm Compliance",
  pool_safety: "Pool Safety Certificate",
  tax_return: "Tax Return",
  custom: "Reminder",
};

export function reminderDueTemplate(data: ReminderDueData): string {
  const typeLabel =
    REMINDER_TYPE_LABELS[data.reminderType] ?? data.reminderType;

  const urgencyColor = data.daysUntil <= 7 ? "#dc2626" : "#f59e0b";
  const urgencyLabel =
    data.daysUntil === 0
      ? "Due today"
      : data.daysUntil === 1
        ? "Due tomorrow"
        : `Due in ${data.daysUntil} days`;

  const content = `
    <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid ${urgencyColor};">
      <h2 style="color: ${urgencyColor}; margin: 0 0 8px 0; font-size: 18px;">
        ${urgencyLabel}
      </h2>
      <p style="font-size: 20px; font-weight: bold; margin: 0; color: #1f2937;">
        ${data.title}
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Type</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${typeLabel}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Due Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.dueDate}</td>
      </tr>
      ${
        data.notes
          ? `<tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Notes</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.notes}</td>
      </tr>`
          : ""
      }
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://bricktrack.au"}/reminders"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Reminders
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function reminderDueSubject(data: ReminderDueData): string {
  const urgency =
    data.daysUntil === 0
      ? "TODAY"
      : data.daysUntil === 1
        ? "Tomorrow"
        : `in ${data.daysUntil} days`;

  return `Reminder: ${data.title} — due ${urgency}`;
}
