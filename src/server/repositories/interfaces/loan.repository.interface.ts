import type { Loan, NewLoan } from "../../db/schema";
import type { DB } from "../base";

/** Loan with property and offset account relations */
export type LoanWithRelations = Loan & {
  property?: unknown;
  offsetAccount?: unknown;
};

export interface ILoanRepository {
  /** List loans for a user, optionally filtered by property */
  findByOwner(userId: string, opts?: { propertyId?: string }): Promise<LoanWithRelations[]>;

  /** Find stale loans (not updated within cutoff date) */
  findStale(userId: string, cutoffDate: Date): Promise<LoanWithRelations[]>;

  /** Get a single loan by id scoped to user */
  findById(id: string, userId: string): Promise<LoanWithRelations | null>;

  /** Insert a new loan */
  create(data: NewLoan, tx?: DB): Promise<Loan>;

  /** Update a loan */
  update(id: string, userId: string, data: Partial<NewLoan>, tx?: DB): Promise<Loan>;

  /** Delete a loan */
  delete(id: string, userId: string, tx?: DB): Promise<void>;
}
