import { baseTemplate } from "./base";

interface CashRateChangedData {
  oldRate: number;
  newRate: number;
  changeDirection: "increased" | "decreased";
}

export function cashRateChangedTemplate(data: CashRateChangedData): string {
  const change = Math.abs(data.newRate - data.oldRate).toFixed(2);
  const directionColor = data.changeDirection === "decreased" ? "#16a34a" : "#dc2626";
  const directionText = data.changeDirection === "decreased" ? "dropped" : "risen";

  const content = `
    <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #0369a1; margin: 0 0 10px 0;">RBA Cash Rate Update</h2>
      <p style="font-size: 18px; margin: 0;">
        The cash rate has <span style="color: ${directionColor}; font-weight: bold;">${directionText} by ${change}%</span>
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Previous Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.oldRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">New Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.newRate.toFixed(2)}%</td>
      </tr>
    </table>
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      ${data.changeDirection === "decreased"
        ? "This could mean lower repayments if your lender passes on the reduction."
        : "Your lender may increase your rate. Review your loan options."}
    </p>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/loans/compare"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Compare Your Loans
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function cashRateChangedSubject(data: {
  changeDirection: "increased" | "decreased";
  newRate: number;
}): string {
  const action = data.changeDirection === "decreased" ? "decrease" : "increase";
  return `RBA cash rate ${action} to ${data.newRate.toFixed(2)}%`;
}
