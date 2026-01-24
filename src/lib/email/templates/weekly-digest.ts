import { baseTemplate } from "./base";

interface WeeklyDigestData {
  weekStart: string;
  weekEnd: string;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  propertyCount: number;
  alertCount: number;
  properties: Array<{
    address: string;
    income: number;
    expenses: number;
  }>;
}

export function weeklyDigestTemplate(data: WeeklyDigestData): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(value);

  const netColor = data.netCashFlow >= 0 ? "#16a34a" : "#dc2626";

  const propertyRows = data.properties
    .map(
      (p) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${p.address}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #16a34a;">${formatCurrency(p.income)}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; color: #dc2626;">${formatCurrency(p.expenses)}</td>
      </tr>
    `
    )
    .join("");

  const content = `
    <h2 style="margin: 0 0 5px 0;">Weekly Portfolio Summary</h2>
    <p style="color: #666; margin: 0 0 20px 0;">${data.weekStart} - ${data.weekEnd}</p>

    <table style="width: 100%; margin-bottom: 20px;">
      <tr>
        <td style="width: 33%; background: #f0fdf4; border-radius: 8px; padding: 15px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 12px;">Income</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #16a34a;">${formatCurrency(data.totalIncome)}</p>
        </td>
        <td style="width: 33%; background: #fef2f2; border-radius: 8px; padding: 15px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 12px;">Expenses</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #dc2626;">${formatCurrency(data.totalExpenses)}</p>
        </td>
        <td style="width: 33%; background: #f0f9ff; border-radius: 8px; padding: 15px; text-align: center;">
          <p style="margin: 0; color: #666; font-size: 12px;">Net</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: ${netColor};">${formatCurrency(data.netCashFlow)}</p>
        </td>
      </tr>
    </table>

    ${data.alertCount > 0 ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
      <p style="margin: 0; color: #92400e;">
        <strong>${data.alertCount} alert${data.alertCount > 1 ? "s" : ""}</strong> require your attention.
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/alerts" style="color: #92400e;">View alerts</a>
      </p>
    </div>
    ` : ""}

    <h3 style="margin: 20px 0 10px 0;">By Property</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="background: #f9fafb;">
        <th style="padding: 10px; text-align: left; font-weight: 500;">Property</th>
        <th style="padding: 10px; text-align: right; font-weight: 500;">Income</th>
        <th style="padding: 10px; text-align: right; font-weight: 500;">Expenses</th>
      </tr>
      ${propertyRows}
    </table>

    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/dashboard"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Dashboard
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function weeklyDigestSubject(): string {
  return "Your weekly portfolio summary";
}
