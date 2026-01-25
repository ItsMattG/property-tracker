import { baseTemplate } from "./base";

interface RefinanceOpportunityData {
  propertyAddress: string;
  currentRate: number;
  marketRate: number;
  monthlySavings: number;
  loanId: string;
}

export function refinanceOpportunityTemplate(data: RefinanceOpportunityData): string {
  const rateGap = (data.currentRate - data.marketRate).toFixed(2);
  const formattedSavings = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.monthlySavings);

  const content = `
    <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #92400e; margin: 0 0 10px 0;">Refinancing Opportunity</h2>
      <p style="font-size: 18px; margin: 0;">
        Your loan rate is <strong>${rateGap}%</strong> above the estimated market rate
      </p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Your Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.currentRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Market Rate</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.marketRate.toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Potential Savings</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500; color: #16a34a;">${formattedSavings}/month</td>
      </tr>
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/loans/${data.loanId}/compare"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Compare Options
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function refinanceOpportunitySubject(data: { monthlySavings: number }): string {
  const formattedSavings = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.monthlySavings);

  return `Refinancing could save you ${formattedSavings}/month`;
}
