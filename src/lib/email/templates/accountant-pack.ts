import { baseTemplate } from "./base";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface AccountantPackEmailProps {
  userName: string;
  userEmail: string;
  financialYear: number;
  sections: string[];
}

export function accountantPackEmailTemplate({
  userName,
  userEmail,
  financialYear,
  sections,
}: AccountantPackEmailProps): string {
  const safeName = escapeHtml(userName);
  const safeEmail = escapeHtml(userEmail);

  const sectionList = sections
    .map((s) => `<li style="padding: 4px 0; color: #333;">${escapeHtml(s)}</li>`)
    .join("");

  const content = `
    <h2 style="color: #333; margin-bottom: 20px;">Property Investment Report — FY${financialYear}</h2>
    <p><strong>${safeName}</strong> has shared their FY${financialYear} property investment report with you via BrickTrack.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-weight: 600; color: #333;">Included sections:</p>
      <ul style="margin: 0; padding-left: 20px;">
        ${sectionList}
      </ul>
    </div>

    <p>The full report is attached as a PDF.</p>

    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      If you have questions about this report, please contact ${safeName} directly at
      <a href="mailto:${safeEmail}" style="color: #2563eb;">${safeEmail}</a>.
    </p>
  `;

  return baseTemplate(content);
}
