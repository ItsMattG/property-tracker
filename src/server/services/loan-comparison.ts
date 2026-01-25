/**
 * Calculate monthly payment for a P&I loan using standard amortization formula
 * PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  if (principal === 0) return 0;
  if (annualRatePercent === 0) return principal / termMonths;

  const monthlyRate = annualRatePercent / 100 / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);

  return principal * (monthlyRate * factor) / (factor - 1);
}

export function calculateMonthlySavings(
  principal: number,
  currentRatePercent: number,
  newRatePercent: number,
  remainingMonths: number
): number {
  const currentPayment = calculateMonthlyPayment(principal, currentRatePercent, remainingMonths);
  const newPayment = calculateMonthlyPayment(principal, newRatePercent, remainingMonths);

  return currentPayment - newPayment;
}

export function calculateTotalInterestSaved(
  principal: number,
  currentRatePercent: number,
  newRatePercent: number,
  remainingMonths: number
): number {
  const monthlySavings = calculateMonthlySavings(
    principal,
    currentRatePercent,
    newRatePercent,
    remainingMonths
  );

  return monthlySavings * remainingMonths;
}

export function calculateBreakEvenMonths(
  monthlySavings: number,
  switchingCosts: number
): number {
  if (switchingCosts === 0) return 0;
  if (monthlySavings <= 0) return Infinity;

  return Math.ceil(switchingCosts / monthlySavings);
}
