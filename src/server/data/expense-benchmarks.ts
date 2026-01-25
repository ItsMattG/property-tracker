// Insurance: Annual premium per $100k property value, by state
export const insuranceBenchmarks: Record<string, { low: number; average: number; high: number }> = {
  NSW: { low: 140, average: 180, high: 220 },
  VIC: { low: 130, average: 165, high: 200 },
  QLD: { low: 160, average: 200, high: 250 },
  SA: { low: 120, average: 155, high: 190 },
  WA: { low: 130, average: 170, high: 210 },
  TAS: { low: 110, average: 145, high: 180 },
  NT: { low: 180, average: 230, high: 290 },
  ACT: { low: 120, average: 155, high: 190 },
};

// Council Rates: Annual amount by state (median)
export const councilRatesBenchmarks: Record<string, { low: number; average: number; high: number }> = {
  NSW: { low: 1200, average: 1800, high: 2500 },
  VIC: { low: 1400, average: 2100, high: 2800 },
  QLD: { low: 1300, average: 1900, high: 2600 },
  SA: { low: 1100, average: 1600, high: 2200 },
  WA: { low: 1200, average: 1750, high: 2400 },
  TAS: { low: 1000, average: 1500, high: 2000 },
  NT: { low: 1300, average: 1850, high: 2500 },
  ACT: { low: 1500, average: 2200, high: 3000 },
};

// Property Management Fees (% of annual rent)
export const managementFeeBenchmarks = {
  low: 5.0,
  average: 7.0,
  high: 8.8,
};

// Threshold for "above average" status (15% above)
export const ABOVE_AVERAGE_THRESHOLD = 1.15;
