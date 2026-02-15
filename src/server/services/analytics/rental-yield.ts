/**
 * Calculate gross rental yield percentage.
 * Gross Yield = (Annual Rent / Property Value) * 100
 */
export function calculateGrossYield(
  annualRent: number,
  propertyValue: number
): number {
  if (propertyValue <= 0 || annualRent <= 0) return 0;
  return (annualRent / propertyValue) * 100;
}

/**
 * Calculate net rental yield percentage.
 * Net Yield = ((Annual Rent - Annual Expenses) / Property Value) * 100
 */
export function calculateNetYield(
  annualRent: number,
  annualExpenses: number,
  propertyValue: number
): number {
  if (propertyValue <= 0) return 0;
  return ((annualRent - annualExpenses) / propertyValue) * 100;
}
