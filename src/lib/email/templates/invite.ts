import { baseTemplate } from "./base";

interface InviteEmailProps {
  ownerName: string;
  role: "partner" | "accountant";
  token: string;
  expiresAt: Date;
}

const roleDescriptions = {
  partner: "full access to view and manage properties, transactions, and loans",
  accountant: "read-only access to view financial data for tax and reporting purposes",
};

export function inviteEmailTemplate({
  ownerName,
  role,
  token,
  expiresAt,
}: InviteEmailProps): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://propertytracker.com";
  const acceptUrl = `${appUrl}/invite/accept?token=${token}`;
  const expiryDate = expiresAt.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const content = `
    <h2 style="color: #333; margin-bottom: 20px;">You've been invited!</h2>
    <p><strong>${ownerName}</strong> has invited you to access their property portfolio on BrickTrack.</p>

    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Your role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</p>
      <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
        This gives you ${roleDescriptions[role]}.
      </p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
        Accept Invitation
      </a>
    </div>

    <p style="color: #666; font-size: 14px;">
      This invitation expires on ${expiryDate}. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `;

  return baseTemplate(content);
}
