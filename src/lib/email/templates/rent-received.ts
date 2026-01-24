import { baseTemplate } from "./base";

interface RentReceivedData {
  propertyAddress: string;
  amount: number;
  date: string;
  transactionId: string;
}

export function rentReceivedTemplate(data: RentReceivedData): string {
  const formattedAmount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(data.amount);

  const content = `
    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #16a34a; margin: 0 0 10px 0;">Rent Received</h2>
      <p style="font-size: 24px; font-weight: bold; margin: 0;">${formattedAmount}</p>
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Property</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">${data.propertyAddress}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${data.date}</td>
      </tr>
    </table>
    <div style="margin-top: 20px; text-align: center;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com"}/transactions?highlight=${data.transactionId}"
         style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        View Transaction
      </a>
    </div>
  `;

  return baseTemplate(content);
}

export function rentReceivedSubject(data: RentReceivedData): string {
  const formattedAmount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
  }).format(data.amount);

  return `Rent received: ${formattedAmount} from ${data.propertyAddress}`;
}
