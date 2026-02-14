import type { Transaction, NewTransaction } from "../../db/schema";
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

/** Paginated transaction result */
export interface PaginatedTransactions {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

/** Transaction with property and bank account relations */
export type TransactionWithRelations = Transaction & {
  property?: unknown;
  bankAccount?: unknown;
};

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
}
