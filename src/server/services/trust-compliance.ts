// Trust Compliance - Distribution Deadlines and Calculations

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 6) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }
  return `${year - 1}-${year.toString().slice(-2)}`;
}

export function getDistributionDeadline(financialYear: string): Date {
  // Distribution must be resolved by June 30
  const [startYear] = financialYear.split("-");
  const endYear = parseInt(startYear) + 1;
  return new Date(endYear, 5, 30); // June 30
}

export function getDaysUntilDeadline(financialYear: string): number {
  const deadline = getDistributionDeadline(financialYear);
  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDeadlineStatus(
  financialYear: string,
  hasDistribution: boolean
): "compliant" | "info" | "warning" | "urgent" | "overdue" {
  if (hasDistribution) return "compliant";

  const daysUntil = getDaysUntilDeadline(financialYear);

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 5) return "urgent";
  if (daysUntil <= 15) return "warning";
  if (daysUntil <= 30) return "info";
  return "compliant";
}

export function validateAllocationTotals(
  totalAmount: number,
  capitalGainsComponent: number,
  frankingCreditsComponent: number,
  allocations: Array<{ amount: number; capitalGains: number; frankingCredits: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const allocatedAmount = allocations.reduce((sum, a) => sum + a.amount, 0);
  const allocatedCG = allocations.reduce((sum, a) => sum + a.capitalGains, 0);
  const allocatedFranking = allocations.reduce((sum, a) => sum + a.frankingCredits, 0);

  if (Math.abs(allocatedAmount - totalAmount) > 0.01) {
    errors.push(`Total amount mismatch: allocated ${allocatedAmount}, expected ${totalAmount}`);
  }
  if (Math.abs(allocatedCG - capitalGainsComponent) > 0.01) {
    errors.push(`Capital gains mismatch: allocated ${allocatedCG}, expected ${capitalGainsComponent}`);
  }
  if (Math.abs(allocatedFranking - frankingCreditsComponent) > 0.01) {
    errors.push(`Franking credits mismatch: allocated ${allocatedFranking}, expected ${frankingCreditsComponent}`);
  }

  return { valid: errors.length === 0, errors };
}
