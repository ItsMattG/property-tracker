const ALERT_COOLDOWN_DAYS = 7;

export function calculateLvr(loanBalance: number, propertyValue: number): number {
  if (propertyValue === 0) return 100;
  return (loanBalance / propertyValue) * 100;
}

export function shouldAlertForLoan(params: {
  currentRate: number;
  marketRate: number;
  threshold: number;
  lastAlertedAt: Date | null;
}): boolean {
  const { currentRate, marketRate, threshold, lastAlertedAt } = params;

  // Check rate gap
  const rateGap = currentRate - marketRate;
  if (rateGap < threshold) {
    return false;
  }

  // Check cooldown
  if (lastAlertedAt) {
    const daysSinceLastAlert =
      (Date.now() - lastAlertedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastAlert < ALERT_COOLDOWN_DAYS) {
      return false;
    }
  }

  return true;
}
