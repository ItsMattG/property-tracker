import type { Transaction, NewTransaction, Property, BankAccount } from "../../db/schema";
import type { DB } from "../base";

/** Filters for listing transactions */
export interface TransactionFilters {
  propertyId?: string;
  category?: string;
  isVerified?: boolean;
  startDate?: string;
  endDate?: string;
  bankAccountId?: string;
  limit?: number;
  offset?: number;
}

/** Transaction with property and bank account relations */
export type TransactionWithRelations = Transaction & {
  property?: Property | null;
  bankAccount?: BankAccount | null;
};

/** Paginated transaction result (includes relations from joins) */
export interface PaginatedTransactions {
  transactions: TransactionWithRelations[];
  total: number;
  hasMore: boolean;
}

export interface ITransactionRepository {
  /** List transactions with filters and pagination */
  findByOwner(userId: string, filters?: TransactionFilters): Promise<PaginatedTransactions>;

  /** List all transactions matching filters (no pagination, for export) */
  findAllByOwner(userId: string, filters?: Omit<TransactionFilters, "limit" | "offset">): Promise<TransactionWithRelations[]>;

  /** Get a single transaction by id scoped to user */
  findById(id: string, userId: string): Promise<Transaction | null>;

  /** Insert a single transaction */
  create(data: NewTransaction, tx?: DB): Promise<Transaction>;

  /** Insert multiple transactions */
  createMany(data: NewTransaction[], tx?: DB): Promise<Transaction[]>;

  /** Update a single transaction */
  update(id: string, userId: string, data: Partial<Transaction>, tx?: DB): Promise<Transaction>;

  /** Update multiple transactions by ids */
  updateMany(ids: string[], userId: string, data: Partial<Transaction>, tx?: DB): Promise<void>;

  /** Delete a single transaction */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Count uncategorized transactions for an account */
  countUncategorized(bankAccountId: string, userId: string): Promise<number>;

  /** Get reconciled balance for an account */
  getReconciledBalance(bankAccountId: string, userId: string): Promise<string>;

  /** Get monthly cash in/out for an account */
  getMonthlyCashFlow(bankAccountId: string, userId: string, monthStart: string): Promise<{ cashIn: string; cashOut: string }>;

  /** Find recent transactions for a bank account (for anomaly detection) */
  findRecentByAccount(userId: string, bankAccountId: string, limit: number): Promise<Transaction[]>;

  /** Find uncategorized transactions for a bank account (post-sync AI categorization) */
  findUncategorizedByAccount(userId: string, bankAccountId: string, limit: number): Promise<Transaction[]>;

  /** Find transactions with pending AI suggestions (paginated, with relations) */
  findPendingSuggestions(
    userId: string,
    filters: { confidenceFilter?: "all" | "high" | "low"; limit?: number; offset?: number }
  ): Promise<{ transactions: TransactionWithRelations[]; total: number }>;

  /** Count transactions with pending AI suggestions */
  countPendingSuggestions(userId: string): Promise<number>;

  /** Find uncategorized transactions for manual AI categorization trigger */
  findForCategorization(userId: string, opts?: { limit?: number }): Promise<Transaction[]>;

  /** Find multiple transactions by IDs scoped to user */
  findByIds(ids: string[], userId: string): Promise<Transaction[]>;
}
