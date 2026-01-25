import {
  generateProperty,
  generatePropertySale,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateAnomalyAlert,
  generateComplianceRecord,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedAnomalyAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths } from "../utils";

export interface MinimalPortfolioData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
}

/**
 * Minimal fixture: 1 property, 1 loan, 5 transactions
 */
export function seedMinimalPortfolio(userId: string): MinimalPortfolioData {
  const now = new Date();
  const threeMonthsAgo = addMonths(now, -3);

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  const property = generateProperty({
    userId,
    address: "1 Test Lane",
    suburb: "Testburg",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate: threeMonthsAgo,
  });

  const transactions = generateTransactions({
    userId,
    bankAccountId: bankAccount.id,
    propertyId: property.id,
    startDate: threeMonthsAgo,
    endDate: now,
    patterns: [
      {
        merchantName: "Test Rent",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        amountRange: { min: 2000, max: 2000 },
      },
    ],
  });

  const loan = generateLoan({
    userId,
    propertyId: property.id,
    lender: "Test Lender",
    loanType: "principal_and_interest",
    rateType: "variable",
    originalAmount: 400000,
    currentBalance: 395000,
    interestRate: 6.0,
    repaymentAmount: 2500,
    repaymentFrequency: "monthly",
  });

  return {
    properties: [property],
    bankAccounts: [bankAccount],
    transactions,
    loans: [loan],
  };
}

export interface MultiPropertyData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
}

/**
 * Multi-property fixture: 3 properties for list/filter testing
 */
export function seedMultiPropertyPortfolio(userId: string): MultiPropertyData {
  const states = ["NSW", "VIC", "QLD"] as const;
  const properties: GeneratedProperty[] = [];

  for (let i = 0; i < 3; i++) {
    properties.push(
      generateProperty({
        userId,
        address: `${i + 1} Test Street`,
        suburb: `Suburb ${i + 1}`,
        state: states[i],
        postcode: `${2000 + i * 1000}`,
        purchasePrice: 400000 + i * 100000,
        purchaseDate: addMonths(new Date(), -(12 * (i + 1))),
      })
    );
  }

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  return {
    properties,
    bankAccounts: [bankAccount],
  };
}

export interface CGTScenarioData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
}

/**
 * CGT scenario: Sold property with complete sale record
 */
export function seedCGTScenario(userId: string): CGTScenarioData {
  const purchaseDate = new Date("2020-01-01");
  const saleDate = new Date("2024-06-01");

  const property = generateProperty({
    userId,
    address: "99 Sold Street",
    suburb: "Salesville",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate,
    status: "sold",
    soldAt: saleDate,
  });

  const sale = generatePropertySale({
    propertyId: property.id,
    userId,
    purchasePrice: 500000,
    purchaseDate,
    salePrice: 650000,
    settlementDate: saleDate,
    agentCommission: 13000,
    legalFees: 2000,
    marketingCosts: 3000,
  });

  return {
    properties: [property],
    propertySales: [sale],
  };
}

export interface AnomalyScenarioData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  anomalyAlerts: GeneratedAnomalyAlert[];
}

/**
 * Anomaly scenario: Property with various alert types
 */
export function seedAnomalyScenario(userId: string): AnomalyScenarioData {
  const now = new Date();
  const sixMonthsAgo = addMonths(now, -6);

  const bankAccount = generateBankAccount({
    userId,
    institution: "Test Bank",
    accountName: "Test Account",
    accountType: "transaction",
  });

  const property = generateProperty({
    userId,
    address: "42 Alert Avenue",
    suburb: "Alertville",
    state: "NSW",
    postcode: "2000",
    purchasePrice: 500000,
    purchaseDate: sixMonthsAgo,
  });

  const transactions = generateTransactions({
    userId,
    bankAccountId: bankAccount.id,
    propertyId: property.id,
    startDate: sixMonthsAgo,
    endDate: now,
    patterns: [
      {
        merchantName: "Test Rent",
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        amountRange: { min: 2000, max: 2000 },
      },
    ],
  });

  const anomalyAlerts: GeneratedAnomalyAlert[] = [
    generateAnomalyAlert({
      userId,
      propertyId: property.id,
      alertType: "missed_rent",
      severity: "warning",
      description: "Expected rent not received",
    }),
    generateAnomalyAlert({
      userId,
      propertyId: property.id,
      alertType: "unusual_amount",
      severity: "info",
      description: "Unusually high expense detected",
      transactionId: transactions[0]?.id,
    }),
  ];

  return {
    properties: [property],
    bankAccounts: [bankAccount],
    transactions,
    anomalyAlerts,
  };
}

export interface ComplianceScenarioData {
  properties: GeneratedProperty[];
  complianceRecords: GeneratedComplianceRecord[];
}

/**
 * Compliance scenario: Properties with due/overdue items
 */
export function seedComplianceScenario(userId: string): ComplianceScenarioData {
  const now = new Date();
  const property = generateProperty({
    userId,
    address: "1 Compliance Court",
    suburb: "Rulesville",
    state: "VIC",
    postcode: "3000",
    purchasePrice: 500000,
    purchaseDate: addMonths(now, -24),
  });

  const complianceRecords: GeneratedComplianceRecord[] = [
    // Overdue smoke alarm
    generateComplianceRecord({
      propertyId: property.id,
      userId,
      requirementId: "smoke_alarms",
      completedAt: addMonths(now, -14),
      nextDueAt: addMonths(now, -2), // 2 months overdue
    }),
    // Upcoming gas safety
    generateComplianceRecord({
      propertyId: property.id,
      userId,
      requirementId: "gas_safety_vic",
      completedAt: addMonths(now, -22),
      nextDueAt: addMonths(now, 2), // Due in 2 months
    }),
  ];

  return {
    properties: [property],
    complianceRecords,
  };
}
