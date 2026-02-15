import type { RecurringTransaction, NewRecurringTransaction, ExpectedTransaction, NewExpectedTransaction, Property, BankAccount, Transaction } from "../../db/schema";
import type { DB } from "../base";

/** Recurring transaction with relations */
export type RecurringWithRelations = RecurringTransaction & {
  property?: Property | null;
  linkedBankAccount?: BankAccount | null;
  expectedTransactions?: ExpectedTransaction[];
};

/** Expected transaction with relations */
export type ExpectedWithRelations = ExpectedTransaction & {
  recurringTransaction?: RecurringTransaction;
  property?: Property | null;
  matchedTransaction?: Transaction | null;
};

/** Filters for expected transactions */
export interface ExpectedTransactionFilters {
  status?: "pending" | "matched" | "missed" | "skipped";
  propertyId?: string;
  recurringTransactionId?: string;
}

export interface IRecurringRepository {
  /** List recurring templates for a user with optional filters */
  findByOwner(userId: string, opts?: { propertyId?: string; isActive?: boolean }): Promise<RecurringWithRelations[]>;

  /** Get a single recurring template with recent expected transactions */
  findById(id: string, userId: string): Promise<RecurringWithRelations | null>;

  /** Insert a new recurring template */
  create(data: NewRecurringTransaction, tx?: DB): Promise<RecurringTransaction>;

  /** Update a recurring template */
  update(id: string, userId: string, data: Partial<RecurringTransaction>, tx?: DB): Promise<RecurringTransaction>;

  /** Delete a recurring template */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Insert expected transactions */
  createExpected(data: NewExpectedTransaction[], tx?: DB): Promise<void>;

  /** Update an expected transaction */
  updateExpected(id: string, userId: string, data: Partial<ExpectedTransaction>, tx?: DB): Promise<ExpectedTransaction | null>;

  /** Find expected transactions with filters */
  findExpected(userId: string, filters?: ExpectedTransactionFilters): Promise<ExpectedWithRelations[]>;

  /** Find pending expected transactions with recurring template */
  findPendingExpected(userId: string): Promise<ExpectedWithRelations[]>;
}
