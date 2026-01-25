import { devAddresses } from "../data/addresses";
import { devBanks, devLenders } from "../data/banks";
import { devMerchants } from "../data/merchants";
import {
  generateProperty,
  generateBankAccount,
  generateTransactions,
  generateLoan,
  generateAnomalyAlert,
  generateConnectionAlert,
  generateComplianceRecord,
  type GeneratedProperty,
  type GeneratedBankAccount,
  type GeneratedTransaction,
  type GeneratedLoan,
  type GeneratedAnomalyAlert,
  type GeneratedConnectionAlert,
  type GeneratedComplianceRecord,
} from "../generators";
import { addMonths } from "../utils";

export interface DevData {
  properties: GeneratedProperty[];
  bankAccounts: GeneratedBankAccount[];
  transactions: GeneratedTransaction[];
  loans: GeneratedLoan[];
  anomalyAlerts: GeneratedAnomalyAlert[];
  connectionAlerts: GeneratedConnectionAlert[];
  complianceRecords: GeneratedComplianceRecord[];
}

export function generateDevData(userId: string): DevData {
  const now = new Date();

  const properties: GeneratedProperty[] = [];
  const bankAccounts: GeneratedBankAccount[] = [];
  const transactions: GeneratedTransaction[] = [];
  const loans: GeneratedLoan[] = [];
  const anomalyAlerts: GeneratedAnomalyAlert[] = [];
  const connectionAlerts: GeneratedConnectionAlert[] = [];
  const complianceRecords: GeneratedComplianceRecord[] = [];

  // Create bank account
  const mainAccount = generateBankAccount({
    userId,
    institution: devBanks[0].institution,
    accountName: "Test Property Account",
    accountType: "transaction",
  });
  bankAccounts.push(mainAccount);

  // Create two properties with dev addresses
  for (let i = 0; i < devAddresses.length; i++) {
    const addr = devAddresses[i];
    const purchaseDate = i === 0 ? new Date("2024-01-01") : new Date("2024-06-01");

    const property = generateProperty({
      userId,
      address: addr.address,
      suburb: addr.suburb,
      state: addr.state,
      postcode: addr.postcode,
      purchasePrice: i === 0 ? 500000 : 400000,
      purchaseDate,
    });
    properties.push(property);

    // Generate transactions
    const patterns = devMerchants.map((m) => ({
      merchantName: m.name,
      category: m.category,
      transactionType: m.category === "rental_income" ? ("income" as const) : ("expense" as const),
      frequency: m.frequency,
      amountRange: m.amountRange,
    }));

    const propertyTransactions = generateTransactions({
      userId,
      bankAccountId: mainAccount.id,
      propertyId: property.id,
      startDate: purchaseDate,
      endDate: now,
      patterns,
    });
    transactions.push(...propertyTransactions);

    // Generate loan
    const loan = generateLoan({
      userId,
      propertyId: property.id,
      lender: devLenders[0].name,
      loanType: "principal_and_interest",
      rateType: "variable",
      originalAmount: i === 0 ? 400000 : 320000,
      currentBalance: i === 0 ? 390000 : 315000,
      interestRate: 6.0,
      repaymentAmount: 2500,
      repaymentFrequency: "monthly",
    });
    loans.push(loan);

    // Generate compliance record
    complianceRecords.push(
      generateComplianceRecord({
        propertyId: property.id,
        userId,
        requirementId: "smoke_alarms",
        completedAt: purchaseDate,
        nextDueAt: addMonths(purchaseDate, 12),
      })
    );
  }

  // Add one of each alert type
  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[0].id,
      alertType: "missed_rent",
      severity: "warning",
      description: "Test missed rent alert",
    })
  );

  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[0].id,
      alertType: "unusual_amount",
      severity: "info",
      description: "Test unusual amount alert",
    })
  );

  anomalyAlerts.push(
    generateAnomalyAlert({
      userId,
      propertyId: properties[1].id,
      alertType: "unexpected_expense",
      severity: "info",
      description: "Test unexpected expense alert",
    })
  );

  // Add a connection alert
  connectionAlerts.push(
    generateConnectionAlert({
      userId,
      bankAccountId: mainAccount.id,
      alertType: "sync_failed",
      errorMessage: "Test sync failure",
    })
  );

  return {
    properties,
    bankAccounts,
    transactions,
    loans,
    anomalyAlerts,
    connectionAlerts,
    complianceRecords,
  };
}
