import { demoAddresses } from "../data/addresses";
import { demoBanks } from "../data/banks";
import { demoMerchants } from "../data/merchants";
import {
  generateProperty,
  generatePropertySale,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateRefinanceAlert,
  generateAnomalyAlert,
  generateStandardComplianceRecords,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedRefinanceAlert,
  type GeneratedAnomalyAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths } from "../utils";

export interface DemoData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  refinanceAlerts: GeneratedRefinanceAlert[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

export function generateDemoData(userId: string): DemoData {
  const now = new Date();

  // Property configurations matching the design doc
  const propertyConfigs = [
    {
      ...demoAddresses[0],
      purchasePrice: 850000,
      purchaseDate: new Date("2020-01-15"),
      status: "active" as const,
      rentAmount: 3200,
      loan: {
        amount: 680000,
        balance: 620000,
        rate: 6.29,
        type: "principal_and_interest" as const,
        rateType: "variable" as const,
        lender: "Commonwealth Bank",
      },
    },
    {
      ...demoAddresses[1],
      purchasePrice: 720000,
      purchaseDate: new Date("2021-03-01"),
      status: "active" as const,
      rentAmount: 2800,
      loan: {
        amount: 576000,
        balance: 576000,
        rate: 6.45,
        type: "interest_only" as const,
        rateType: "fixed" as const,
        lender: "ANZ",
        fixedExpiry: addMonths(now, 1),
      },
    },
    {
      ...demoAddresses[2],
      purchasePrice: 550000,
      purchaseDate: new Date("2022-06-15"),
      status: "active" as const,
      rentAmount: 2500,
      loan: {
        amount: 440000,
        balance: 410000,
        rate: 6.15,
        type: "principal_and_interest" as const,
        rateType: "variable" as const,
        lender: "Westpac",
      },
    },
    {
      ...demoAddresses[3],
      purchasePrice: 680000,
      purchaseDate: new Date("2020-02-01"),
      status: "sold" as const,
      soldAt: new Date("2024-10-15"),
      salePrice: 850000,
      rentAmount: 2600,
    },
  ];

  const properties: GeneratedProperty[] = [];
  const propertySales: GeneratedPropertySale[] = [];
  const bankAccounts: GeneratedBankAccount[] = [];
  const transactions: GeneratedTransaction[] = [];
  const loans: GeneratedLoan[] = [];
  const refinanceAlerts: GeneratedRefinanceAlert[] = [];
  const anomalyAlerts: GeneratedAnomalyAlert[] = [];
  const complianceRecords: GeneratedComplianceRecord[] = [];

  // Create main bank account
  const mainAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Property Investment Account",
    accountType: "transaction",
  });
  bankAccounts.push(mainAccount);

  // Create offset account for property 1
  const offsetAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Offset Account",
    accountType: "offset",
  });
  bankAccounts.push(offsetAccount);

  for (let i = 0; i < propertyConfigs.length; i++) {
    const config = propertyConfigs[i];

    // Generate property
    const property = generateProperty({
      userId,
      address: config.address,
      suburb: config.suburb,
      state: config.state,
      postcode: config.postcode,
      purchasePrice: config.purchasePrice,
      purchaseDate: config.purchaseDate,
      status: config.status,
      soldAt: config.soldAt,
    });
    properties.push(property);

    // Generate transactions for this property
    const transactionEndDate = config.status === "sold" ? config.soldAt! : now;
    const vacancyPeriods = [
      {
        start: addMonths(config.purchaseDate, 18),
        end: addMonths(config.purchaseDate, 19),
      },
    ];

    // Build patterns for this property
    const patterns = [
      {
        merchantName: `Rental Income - ${config.suburb}`,
        category: "rental_income",
        transactionType: "income" as const,
        frequency: "monthly" as const,
        amountRange: { min: config.rentAmount, max: config.rentAmount + 100 },
        dayOfMonth: 1,
      },
      ...demoMerchants
        .filter((m) => m.category !== "rental_income")
        .map((m) => ({
          merchantName: m.name,
          category: m.category,
          transactionType: "expense" as const,
          frequency: m.frequency,
          amountRange: m.amountRange,
        })),
    ];

    const propertyTransactions = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: property.id,
      startDate: config.purchaseDate,
      endDate: transactionEndDate,
      patterns,
      vacancyPeriods,
    });
    transactions.push(...propertyTransactions);

    // Generate loan for active properties
    if (config.status === "active" && config.loan) {
      const loan = generateLoan({
        userId,
        propertyId: property.id,
        lender: config.loan.lender,
        loanType: config.loan.type,
        rateType: config.loan.rateType,
        originalAmount: config.loan.amount,
        currentBalance: config.loan.balance,
        interestRate: config.loan.rate,
        fixedRateExpiry: config.loan.fixedExpiry,
        repaymentAmount:
          config.loan.type === "interest_only"
            ? config.loan.balance * (config.loan.rate / 100 / 12)
            : config.loan.amount * 0.006,
        repaymentFrequency: "monthly",
        offsetAccountId: i === 0 ? offsetAccount.id : undefined,
      });
      loans.push(loan);

      // Refinance alert for fixed rate expiring soon
      if (config.loan.fixedExpiry) {
        refinanceAlerts.push(
          generateRefinanceAlert({
            loanId: loan.id,
            enabled: true,
            rateGapThreshold: 0.5,
          })
        );
      }
    }

    // Generate property sale for sold property
    if (config.status === "sold" && config.salePrice) {
      propertySales.push(
        generatePropertySale({
          propertyId: property.id,
          userId,
          purchasePrice: config.purchasePrice,
          purchaseDate: config.purchaseDate,
          salePrice: config.salePrice,
          settlementDate: config.soldAt!,
          agentCommission: config.salePrice * 0.02,
          legalFees: 2000,
        })
      );
    }

    // Generate compliance records (with one overdue for first property)
    complianceRecords.push(
      ...generateStandardComplianceRecords(property.id, userId, config.state, config.purchaseDate, {
        includeOverdue: i === 0,
      })
    );
  }

  // Add anomaly alerts
  // Missed rent for property 2
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[1].id,
      alertType: "missed_rent",
      severity: "warning",
      description: `Expected rent payment of $${propertyConfigs[1].rentAmount} not received for ${propertyConfigs[1].suburb}`,
      suggestedAction: "Contact property manager to follow up with tenant",
    })
  );

  // Unusual expense - find a repair transaction and flag it
  const repairTxn = transactions.find(
    (t) => t.category === "repairs_and_maintenance" && Math.abs(parseFloat(t.amount)) > 1000
  );
  if (repairTxn) {
    // Add an unusually high plumber expense
    const highExpense = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: properties[0].id,
      startDate: addMonths(now, -1),
      endDate: now,
      patterns: [
        {
          merchantName: "Emergency Plumber Services",
          category: "repairs_and_maintenance",
          transactionType: "expense",
          frequency: "sporadic",
          amountRange: { min: 4500, max: 4500 },
        },
      ],
    })[0];

    if (highExpense) {
      transactions.push(highExpense);
      anomalyAlerts.push(
        generateAnomalyAlert({
          userId,
          propertyId: properties[0].id,
          alertType: "unusual_amount",
          severity: "info",
          description: "Plumber charge of $4,500 is significantly higher than typical range ($200-$800)",
          transactionId: highExpense.id,
          suggestedAction: "Review invoice to confirm this is a legitimate expense",
        })
      );
    }
  }

  return {
    properties,
    propertySales,
    bankAccounts,
    transactions,
    loans,
    refinanceAlerts,
    anomalyAlerts,
    complianceRecords,
  };
}
