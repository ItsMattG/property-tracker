/**
 * Demo data for previewing the dashboard with realistic Australian property data.
 * Used when the user has no properties yet to show what BrickTrack looks like with data.
 */

export const DEMO_STATS = {
  propertyCount: 3,
  transactionCount: 47,
  uncategorizedCount: 3,
};

export const DEMO_TRENDS = {
  propertyCount: { current: 3, previous: 2 },
  transactionCount: { current: 47, previous: 38 },
  uncategorizedCount: { current: 3, previous: 8 },
  portfolioValue: { current: 3_280_000, previous: 3_050_000 },
  totalEquity: { current: 1_540_000, previous: 1_380_000 },
};

export const DEMO_PROPERTIES = [
  {
    id: "demo-1",
    address: "45 Beach Street",
    suburb: "Bondi",
    state: "NSW",
    postcode: "2026",
    purchasePrice: "1250000",
    currentValue: 1_450_000,
    contractDate: "2022-03-15",
    entityName: "Personal",
    status: "active" as const,
    createdAt: new Date("2022-03-15"),
    updatedAt: new Date("2024-01-10"),
  },
  {
    id: "demo-2",
    address: "12 River Road",
    suburb: "South Yarra",
    state: "VIC",
    postcode: "3141",
    purchasePrice: "980000",
    currentValue: 1_120_000,
    contractDate: "2021-08-20",
    entityName: "Personal",
    status: "active" as const,
    createdAt: new Date("2021-08-20"),
    updatedAt: new Date("2024-02-01"),
  },
  {
    id: "demo-3",
    address: "8 Jacaranda Avenue",
    suburb: "New Farm",
    state: "QLD",
    postcode: "4005",
    purchasePrice: "710000",
    currentValue: 810_000,
    contractDate: "2023-06-01",
    entityName: "Family Trust",
    status: "active" as const,
    createdAt: new Date("2023-06-01"),
    updatedAt: new Date("2024-03-15"),
  },
];
