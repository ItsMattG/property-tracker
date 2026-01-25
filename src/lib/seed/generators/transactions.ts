import { randomUUID } from "crypto";
import type { TransactionPattern, TransactionCategory } from "../types";
import {
  generateRecurringDates,
  generateSporadicDates,
  randomAmount,
  formatDate,
  isInVacancyPeriod,
} from "../utils";

export interface BankAccountConfig {
  userId: string;
  institution: string;
  accountName: string;
  accountType: "transaction" | "savings" | "mortgage" | "offset" | "credit_card" | "line_of_credit";
  defaultPropertyId?: string;
}

export interface GeneratedBankAccount {
  id: string;
  userId: string;
  basiqConnectionId: string;
  basiqAccountId: string;
  institution: string;
  accountName: string;
  accountNumberMasked: string;
  accountType: "transaction" | "savings" | "mortgage" | "offset" | "credit_card" | "line_of_credit";
  defaultPropertyId: string | null;
  isConnected: boolean;
  connectionStatus: "connected" | "disconnected" | "error";
  lastSyncedAt: Date;
  createdAt: Date;
}

export function generateBankAccount(config: BankAccountConfig): GeneratedBankAccount {
  const id = randomUUID();
  return {
    id,
    userId: config.userId,
    basiqConnectionId: `seed_conn_${id.slice(0, 8)}`,
    basiqAccountId: `seed_acct_${id.slice(0, 8)}`,
    institution: config.institution,
    accountName: config.accountName,
    accountNumberMasked: `****${Math.floor(1000 + Math.random() * 9000)}`,
    accountType: config.accountType,
    defaultPropertyId: config.defaultPropertyId ?? null,
    isConnected: true,
    connectionStatus: "connected",
    lastSyncedAt: new Date(),
    createdAt: new Date(),
  };
}

export interface TransactionGeneratorConfig {
  userId: string;
  bankAccountId: string;
  propertyId: string;
  startDate: Date;
  endDate: Date;
  patterns: TransactionPattern[];
  vacancyPeriods?: { start: Date; end: Date }[];
}

export interface GeneratedTransaction {
  id: string;
  userId: string;
  bankAccountId: string;
  basiqTransactionId: string;
  propertyId: string;
  date: string;
  description: string;
  amount: string;
  category: TransactionCategory;
  transactionType: "income" | "expense" | "capital" | "transfer" | "personal";
  isDeductible: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function generateTransactions(
  config: TransactionGeneratorConfig
): GeneratedTransaction[] {
  const transactions: GeneratedTransaction[] = [];
  const vacancyPeriods = config.vacancyPeriods ?? [];

  for (const pattern of config.patterns) {
    let dates: Date[];

    if (pattern.frequency === "sporadic") {
      dates = generateSporadicDates(config.startDate, config.endDate, 4);
    } else {
      dates = generateRecurringDates(
        config.startDate,
        config.endDate,
        pattern.frequency,
        pattern.dayOfMonth ?? 15
      );
    }

    for (const date of dates) {
      // Skip rent during vacancy periods
      if (
        pattern.category === "rental_income" &&
        isInVacancyPeriod(date, vacancyPeriods)
      ) {
        continue;
      }

      const amount = randomAmount(pattern.amountRange.min, pattern.amountRange.max);
      const signedAmount = pattern.transactionType === "income" ? amount : -amount;

      const id = randomUUID();
      transactions.push({
        id,
        userId: config.userId,
        bankAccountId: config.bankAccountId,
        basiqTransactionId: `seed_txn_${id.slice(0, 8)}`,
        propertyId: config.propertyId,
        date: formatDate(date),
        description: pattern.merchantName,
        amount: signedAmount.toFixed(2),
        category: pattern.category,
        transactionType: pattern.transactionType,
        isDeductible: pattern.transactionType === "expense",
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}
