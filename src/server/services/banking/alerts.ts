const EMAIL_DELAY_HOURS = 24;

export function shouldCreateAlert(
  activeAlerts: { alertType: string }[],
  newAlertType: string
): boolean {
  return !activeAlerts.some((alert) => alert.alertType === newAlertType);
}

export function shouldSendEmail(alert: {
  createdAt: Date;
  emailSentAt: Date | null;
}): boolean {
  if (alert.emailSentAt) {
    return false;
  }

  const now = new Date();
  const ageHours = (now.getTime() - alert.createdAt.getTime()) / (60 * 60 * 1000);

  return ageHours >= EMAIL_DELAY_HOURS;
}

export function formatAlertForEmail(alert: {
  alertType: string;
  bankAccount: { accountName: string; institution: string };
}): string {
  const typeMessages: Record<string, string> = {
    disconnected: "has been disconnected",
    requires_reauth: "requires re-authentication",
    sync_failed: "failed to sync",
  };

  const message = typeMessages[alert.alertType] || "has an issue";
  return `${alert.bankAccount.accountName} (${alert.bankAccount.institution}) ${message}`;
}
