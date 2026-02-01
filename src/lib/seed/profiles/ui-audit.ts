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
  generateConnectionAlert,
  generateStandardComplianceRecords,
  generateComplianceRecord,
  type GeneratedProperty,
  type GeneratedPropertySale,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedRefinanceAlert,
  type GeneratedAnomalyAlert,
  type GeneratedConnectionAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths, formatDate, randomAmount } from "../utils";
import type { TransactionPattern } from "../types";
import { randomUUID } from "crypto";

export interface UIAuditData {
  properties: GeneratedProperty[];
  propertySales: GeneratedPropertySale[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  refinanceAlerts: GeneratedRefinanceAlert[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  connectionAlerts: GeneratedConnectionAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

/**
 * UI Audit Seed Profile
 *
 * Generates comprehensive test data covering UI edge cases:
 * - 6 properties in different states
 * - 4 bank accounts including error states
 * - 150+ transactions with edge cases (long descriptions, large amounts, uncategorized)
 * - Loans with expiring fixed rates
 * - Anomaly and connection alerts
 * - Compliance records with overdue items
 */
export function generateUIAuditData(userId: string): UIAuditData {
  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // UI Audit addresses covering all major states
  const uiAuditAddresses = [
    {
      address: "1 Harbour View Drive",
      suburb: "Sydney",
      state: "NSW" as const,
      postcode: "2000",
    },
    {
      address: "255 Collins Street",
      suburb: "Melbourne",
      state: "VIC" as const,
      postcode: "3000",
    },
    {
      address: "42 Eagle Street",
      suburb: "Brisbane",
      state: "QLD" as const,
      postcode: "4000",
    },
    {
      address: "100 St Georges Terrace",
      suburb: "Perth",
      state: "WA" as const,
      postcode: "6000",
    },
    {
      address: "77 King William Street",
      suburb: "Adelaide",
      state: "SA" as const,
      postcode: "5000",
    },
    {
      address: "10 Murray Street",
      suburb: "Hobart",
      state: "TAS" as const,
      postcode: "7000",
    },
  ];

  // Property configurations for different UI states
  const propertyConfigs = [
    // 1. Fully populated - Sydney, active, with transactions, documents, tasks
    {
      ...uiAuditAddresses[0],
      purchasePrice: 1250000,
      purchaseDate: new Date("2019-03-15"),
      status: "active" as const,
      rentAmount: 4500,
      entityName: "Personal",
      loan: {
        amount: 1000000,
        balance: 920000,
        rate: 6.29,
        type: "principal_and_interest" as const,
        rateType: "variable" as const,
        lender: "Commonwealth Bank",
      },
    },
    // 2. Recently purchased - Melbourne, minimal data (1 week ago)
    {
      ...uiAuditAddresses[1],
      purchasePrice: 890000,
      purchaseDate: oneWeekAgo,
      status: "active" as const,
      rentAmount: 0, // Not yet tenanted
      entityName: "Family Trust",
      loan: {
        amount: 712000,
        balance: 712000,
        rate: 6.15,
        type: "principal_and_interest" as const,
        rateType: "variable" as const,
        lender: "ANZ",
      },
    },
    // 3. Renovating - Brisbane, expenses only, no income
    {
      ...uiAuditAddresses[2],
      purchasePrice: 650000,
      purchaseDate: new Date("2023-06-01"),
      status: "active" as const,
      rentAmount: 0, // Under renovation
      entityName: "Personal",
      loan: {
        amount: 520000,
        balance: 495000,
        rate: 6.45,
        type: "interest_only" as const,
        rateType: "fixed" as const,
        lender: "Westpac",
        fixedExpiry: addMonths(now, 2), // Fixed rate expiring soon
      },
    },
    // 4. Empty lot - Perth, land only (no building, no rent)
    {
      ...uiAuditAddresses[3],
      purchasePrice: 380000,
      purchaseDate: new Date("2022-09-20"),
      status: "active" as const,
      rentAmount: 0,
      entityName: "SMSF",
      loan: {
        amount: 304000,
        balance: 290000,
        rate: 6.35,
        type: "interest_only" as const,
        rateType: "variable" as const,
        lender: "NAB",
      },
    },
    // 5. Sold property - Adelaide, with sale data for CGT
    {
      ...uiAuditAddresses[4],
      purchasePrice: 520000,
      purchaseDate: new Date("2018-02-10"),
      status: "sold" as const,
      soldAt: new Date("2025-08-15"),
      salePrice: 780000,
      rentAmount: 2800,
      entityName: "Personal",
    },
    // 6. Problem property - Hobart, overdue tasks, compliance warnings
    {
      ...uiAuditAddresses[5],
      purchasePrice: 445000,
      purchaseDate: new Date("2021-11-01"),
      status: "active" as const,
      rentAmount: 2400,
      entityName: "Personal",
      loan: {
        amount: 356000,
        balance: 340000,
        rate: 6.89, // High rate
        type: "principal_and_interest" as const,
        rateType: "variable" as const,
        lender: "Commonwealth Bank",
      },
    },
  ];

  const properties: GeneratedProperty[] = [];
  const propertySales: GeneratedPropertySale[] = [];
  const bankAccounts: GeneratedBankAccount[] = [];
  const transactions: GeneratedTransaction[] = [];
  const loans: GeneratedLoan[] = [];
  const refinanceAlerts: GeneratedRefinanceAlert[] = [];
  const anomalyAlerts: GeneratedAnomalyAlert[] = [];
  const connectionAlerts: GeneratedConnectionAlert[] = [];
  const complianceRecords: GeneratedComplianceRecord[] = [];

  // ===========================================
  // BANK ACCOUNTS (4 total with edge cases)
  // ===========================================

  // 1. Connected & synced - offset account
  const offsetAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Investment Property Offset",
    accountType: "offset",
  });
  bankAccounts.push(offsetAccount);

  // 2. Connected & synced - mortgage account
  const mortgageAccount = generateBankAccount({
    userId,
    institution: demoBanks[2].institution,
    accountName: "Home Loan Account",
    accountType: "mortgage",
  });
  bankAccounts.push(mortgageAccount);

  // 3. Disconnected - old savings (edge case)
  const disconnectedAccount = generateBankAccount({
    userId,
    institution: demoBanks[1].institution,
    accountName: "Old Savings Account",
    accountType: "savings",
  });
  disconnectedAccount.isConnected = false;
  disconnectedAccount.connectionStatus = "disconnected";
  disconnectedAccount.lastSyncedAt = addMonths(now, -3); // Last synced 3 months ago
  bankAccounts.push(disconnectedAccount);

  // 4. Error state - credit card with sync error (edge case)
  const errorAccount = generateBankAccount({
    userId,
    institution: demoBanks[3].institution,
    accountName: "Business Credit Card",
    accountType: "credit_card",
  });
  errorAccount.isConnected = true;
  errorAccount.connectionStatus = "error";
  errorAccount.lastSyncedAt = addMonths(now, -1);
  bankAccounts.push(errorAccount);

  // Connection alerts for error states
  connectionAlerts.push(
    generateConnectionAlert({
      userId,
      bankAccountId: disconnectedAccount.id,
      alertType: "disconnected",
      errorMessage: "Bank connection expired. Please reconnect your account.",
    })
  );

  connectionAlerts.push(
    generateConnectionAlert({
      userId,
      bankAccountId: errorAccount.id,
      alertType: "sync_failed",
      errorMessage: "Unable to sync transactions. Error code: BANK_API_TIMEOUT",
    })
  );

  // Main transaction account for all properties
  const mainAccount = generateBankAccount({
    userId,
    institution: demoBanks[0].institution,
    accountName: "Property Investment Transaction",
    accountType: "transaction",
  });
  bankAccounts.push(mainAccount);

  // ===========================================
  // PROPERTIES, LOANS, AND TRANSACTIONS
  // ===========================================

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
      entityName: config.entityName,
      status: config.status,
      soldAt: "soldAt" in config ? config.soldAt : undefined,
    });
    properties.push(property);

    // Generate transactions for this property
    const transactionEndDate = config.status === "sold" && "soldAt" in config ? config.soldAt! : now;

    // Build patterns for this property based on its state
    const patterns: TransactionPattern[] = [];

    // Only add rental income for properties that have tenants
    if (config.rentAmount > 0) {
      patterns.push({
        merchantName: `Rental Income - ${config.suburb}`,
        category: "rental_income",
        transactionType: "income",
        frequency: "monthly",
        amountRange: { min: config.rentAmount, max: config.rentAmount + 100 },
        dayOfMonth: 1,
      });
    }

    // Add standard expense patterns for active properties
    if (config.status === "active") {
      patterns.push(
        ...demoMerchants
          .filter((m) => m.category !== "rental_income")
          .map((m) => ({
            merchantName: m.name,
            category: m.category,
            transactionType: "expense" as const,
            frequency: m.frequency,
            amountRange: m.amountRange,
          }))
      );
    }

    // Add renovation expenses for property 3 (Brisbane)
    if (i === 2) {
      patterns.push(
        {
          merchantName: "Harvey Norman Commercial - Kitchen Appliances",
          category: "capital_works_deductions",
          transactionType: "expense",
          frequency: "sporadic",
          amountRange: { min: 3000, max: 8000 },
        },
        {
          merchantName: "Reece Plumbing Supplies",
          category: "capital_works_deductions",
          transactionType: "expense",
          frequency: "sporadic",
          amountRange: { min: 1500, max: 4000 },
        },
        {
          merchantName: "Master Builders QLD - Contractor",
          category: "capital_works_deductions",
          transactionType: "expense",
          frequency: "sporadic",
          amountRange: { min: 5000, max: 15000 },
        }
      );
    }

    // Generate regular transactions
    if (patterns.length > 0) {
      const propertyTransactions = generateTransactions({
        userId,
        bankAccountId: mainAccount.id,
        propertyId: property.id,
        startDate: config.purchaseDate,
        endDate: transactionEndDate,
        patterns,
      });
      transactions.push(...propertyTransactions);
    }

    // Generate loan for active properties with loans
    if (config.status === "active" && "loan" in config && config.loan) {
      const loan = generateLoan({
        userId,
        propertyId: property.id,
        lender: config.loan.lender,
        loanType: config.loan.type,
        rateType: config.loan.rateType,
        originalAmount: config.loan.amount,
        currentBalance: config.loan.balance,
        interestRate: config.loan.rate,
        fixedRateExpiry: "fixedExpiry" in config.loan ? config.loan.fixedExpiry : undefined,
        repaymentAmount:
          config.loan.type === "interest_only"
            ? config.loan.balance * (config.loan.rate / 100 / 12)
            : config.loan.amount * 0.006,
        repaymentFrequency: "monthly",
        offsetAccountId: i === 0 ? offsetAccount.id : undefined,
      });
      loans.push(loan);

      // Refinance alert for fixed rate expiring soon (property 3)
      if ("fixedExpiry" in config.loan && config.loan.fixedExpiry) {
        refinanceAlerts.push(
          generateRefinanceAlert({
            loanId: loan.id,
            enabled: true,
            rateGapThreshold: 0.5,
          })
        );
      }

      // Refinance alert for high rate (property 6 - problem property)
      if (i === 5) {
        refinanceAlerts.push(
          generateRefinanceAlert({
            loanId: loan.id,
            enabled: true,
            rateGapThreshold: 0.25, // Lower threshold to trigger more easily
          })
        );
      }
    }

    // Generate property sale for sold property (Adelaide)
    if (config.status === "sold" && "salePrice" in config && config.salePrice) {
      propertySales.push(
        generatePropertySale({
          propertyId: property.id,
          userId,
          purchasePrice: config.purchasePrice,
          purchaseDate: config.purchaseDate,
          salePrice: config.salePrice,
          settlementDate: config.soldAt!,
          agentCommission: config.salePrice * 0.025,
          legalFees: 2500,
          marketingCosts: 3500,
        })
      );
    }

    // Generate compliance records with edge cases
    if (config.status === "active") {
      // Standard compliance records
      complianceRecords.push(
        ...generateStandardComplianceRecords(property.id, userId, config.state, config.purchaseDate, {
          // Include overdue for problem property (Hobart)
          includeOverdue: i === 5,
        })
      );

      // Add more compliance edge cases for problem property
      if (i === 5) {
        // Overdue pool safety check
        const poolSafetyDate = new Date(now);
        poolSafetyDate.setFullYear(poolSafetyDate.getFullYear() - 2);
        complianceRecords.push(
          generateComplianceRecord({
            propertyId: property.id,
            userId,
            requirementId: "pool_safety",
            completedAt: poolSafetyDate,
            nextDueAt: addMonths(now, -6), // 6 months overdue
            notes: "Pool fence inspection OVERDUE - urgent attention required",
          })
        );

        // Upcoming electrical safety
        complianceRecords.push(
          generateComplianceRecord({
            propertyId: property.id,
            userId,
            requirementId: "electrical_safety",
            completedAt: addMonths(now, -23),
            nextDueAt: addMonths(now, 1), // Due in 1 month
            notes: "Safety switch test due soon",
          })
        );
      }
    }
  }

  // ===========================================
  // EDGE CASE TRANSACTIONS
  // ===========================================

  // Edge case 1: Very long description (200+ chars)
  const longDescriptionTxn: GeneratedTransaction = {
    id: randomUUID(),
    userId,
    bankAccountId: mainAccount.id,
    basiqTransactionId: `seed_txn_long_desc`,
    propertyId: properties[0].id,
    date: formatDate(addMonths(now, -2)),
    description:
      "EMERGENCY PLUMBING REPAIRS - Complete bathroom renovation including replacement of all copper pipes, installation of new hot water system, waterproofing membrane replacement, and full tiling works. Invoice #INV-2025-12345-ABCD. Contractor: Smith & Sons Master Plumbers Pty Ltd ABN 12 345 678 901",
    amount: "-8750.00",
    category: "repairs_and_maintenance",
    transactionType: "expense",
    isDeductible: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.push(longDescriptionTxn);

  // Edge case 2: Maximum reasonable amount ($999,999.99)
  const largeAmountTxn: GeneratedTransaction = {
    id: randomUUID(),
    userId,
    bankAccountId: mainAccount.id,
    basiqTransactionId: `seed_txn_large_amt`,
    propertyId: properties[0].id,
    date: formatDate(addMonths(now, -6)),
    description: "Settlement Statement - Property Purchase Deposit",
    amount: "-999999.99",
    category: "stamp_duty",
    transactionType: "expense",
    isDeductible: false,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.push(largeAmountTxn);

  // Edge case 3: Zero amount transaction
  const zeroAmountTxn: GeneratedTransaction = {
    id: randomUUID(),
    userId,
    bankAccountId: mainAccount.id,
    basiqTransactionId: `seed_txn_zero`,
    propertyId: properties[0].id,
    date: formatDate(addMonths(now, -1)),
    description: "Bank Fee Reversal - Waived",
    amount: "0.00",
    category: "borrowing_expenses",
    transactionType: "expense",
    isDeductible: false,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.push(zeroAmountTxn);

  // Edge case 4: Very small amount (cents only)
  const smallAmountTxn: GeneratedTransaction = {
    id: randomUUID(),
    userId,
    bankAccountId: mainAccount.id,
    basiqTransactionId: `seed_txn_small`,
    propertyId: properties[0].id,
    date: formatDate(addMonths(now, -1)),
    description: "Interest Adjustment",
    amount: "-0.01",
    category: "interest_on_loans",
    transactionType: "expense",
    isDeductible: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.push(smallAmountTxn);

  // Edge case 5: Transaction with special characters in description
  const specialCharsTxn: GeneratedTransaction = {
    id: randomUUID(),
    userId,
    bankAccountId: mainAccount.id,
    basiqTransactionId: `seed_txn_special`,
    propertyId: properties[0].id,
    date: formatDate(addMonths(now, -1)),
    description: "O'Brien's Electrical & Co. - Service #123/456 (Unit 7A)",
    amount: "-450.00",
    category: "repairs_and_maintenance",
    transactionType: "expense",
    isDeductible: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  transactions.push(specialCharsTxn);

  // ===========================================
  // UNCATEGORIZED TRANSACTIONS (30% of additional)
  // ===========================================

  const uncategorizedDescriptions = [
    "DIRECT DEBIT - REF 123456",
    "EFTPOS PURCHASE",
    "BANK TRANSFER",
    "PAYMENT RECEIVED",
    "INTERNET TRANSFER",
    "BPAY - MERCHANT",
    "ATM WITHDRAWAL",
    "POS PURCHASE",
    "DIRECT CREDIT",
    "AUTO TRANSFER",
    "CARD PAYMENT",
    "OSKO PAYMENT",
    "NPP TRANSFER",
    "INTERNATIONAL TXN",
    "PAYPAL *",
  ];

  // Generate 30 uncategorized transactions
  for (let i = 0; i < 30; i++) {
    const txnDate = new Date(now);
    txnDate.setDate(txnDate.getDate() - Math.floor(Math.random() * 365));

    const sign = Math.random() > 0.5 ? -1 : 1;
    const txnType = sign < 0 ? "expense" : "income";

    const uncategorizedTxn: GeneratedTransaction = {
      id: randomUUID(),
      userId,
      bankAccountId: mainAccount.id,
      basiqTransactionId: `seed_txn_uncat_${i}`,
      propertyId: properties[Math.floor(Math.random() * 3)].id, // Random active property
      date: formatDate(txnDate),
      description: uncategorizedDescriptions[i % uncategorizedDescriptions.length] + ` ${1000 + i}`,
      amount: (sign * randomAmount(10, 500)).toFixed(2),
      category: "uncategorized",
      transactionType: txnType,
      isDeductible: false,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    transactions.push(uncategorizedTxn);
  }

  // ===========================================
  // ANOMALY ALERTS
  // ===========================================

  // Missed rent alert for problem property
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[5].id, // Hobart problem property
      alertType: "missed_rent",
      severity: "warning",
      description: `Expected rent payment of $${propertyConfigs[5].rentAmount} not received for ${propertyConfigs[5].suburb}`,
      suggestedAction: "Contact property manager to follow up with tenant",
    })
  );

  // Unusual amount alert for the large plumbing expense
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[0].id, // Sydney fully populated
      alertType: "unusual_amount",
      severity: "info",
      description: "Plumbing expense of $8,750 is significantly higher than typical range ($200-$800)",
      transactionId: longDescriptionTxn.id,
      suggestedAction: "Review invoice to confirm this is a legitimate expense",
    })
  );

  // Duplicate transaction alert
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[0].id,
      alertType: "duplicate_transaction",
      severity: "warning",
      description: "Potential duplicate: Council Rates payment appears twice on the same day",
      suggestedAction: "Check if this is a duplicate charge and dispute with bank if necessary",
    })
  );

  // Critical alert for problem property
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[5].id,
      alertType: "unexpected_expense",
      severity: "critical",
      description: "Large unexpected expense: $15,000 emergency roof repair after storm damage",
      suggestedAction: "Review insurance claim status and update property records",
      metadata: {
        insuranceClaim: true,
        claimNumber: "CLM-2025-98765",
      },
    })
  );

  return {
    properties,
    propertySales,
    bankAccounts,
    transactions,
    loans,
    refinanceAlerts,
    anomalyAlerts,
    connectionAlerts,
    complianceRecords,
  };
}
