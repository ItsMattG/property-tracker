import type {
  Loan, NewLoan, Property, BankAccount,
  Broker, NewBroker, LoanPack, NewLoanPack,
  LoanComparison, NewLoanComparison, RefinanceAlert, NewRefinanceAlert,
} from "../../db/schema";
import type { DB } from "../base";

/** Loan with property and offset account relations */
export type LoanWithRelations = Loan & {
  property: Property;
  offsetAccount?: BankAccount | null;
};

/** Broker with count of associated loan packs */
export type BrokerWithPackCount = Broker & { packCount: number };

/** Loan pack with its associated broker */
export type LoanPackWithBroker = LoanPack & { broker: Broker | null };

/** Loan comparison with nested loan and property */
export type LoanComparisonWithLoan = LoanComparison & {
  loan: Loan & { property: Property | null };
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

  /** Find recently updated loans for a user */
  findRecent(userId: string, limit: number): Promise<Array<{
    id: string;
    lender: string;
    currentBalance: string;
    updatedAt: Date;
  }>>;

  // --- Brokers ---
  listBrokersWithStats(userId: string): Promise<BrokerWithPackCount[]>;
  findBrokerById(id: string, userId: string): Promise<Broker | null>;
  findBrokerPacks(brokerId: string): Promise<LoanPack[]>;
  createBroker(data: NewBroker, tx?: DB): Promise<Broker>;
  updateBroker(id: string, userId: string, data: Partial<Broker>, tx?: DB): Promise<Broker>;
  deleteBroker(id: string, userId: string, tx?: DB): Promise<void>;

  // --- Loan Packs ---
  createLoanPack(data: NewLoanPack, tx?: DB): Promise<LoanPack>;
  findLoanPacksByOwner(userId: string): Promise<LoanPackWithBroker[]>;
  deleteLoanPack(id: string, userId: string, tx?: DB): Promise<void>;
  findLoanPackByToken(token: string): Promise<LoanPack | null>;
  incrementLoanPackAccess(id: string, tx?: DB): Promise<LoanPack>;

  // --- Loan Comparisons ---
  createComparison(data: NewLoanComparison, tx?: DB): Promise<LoanComparison>;
  findComparisonsByOwner(userId: string, loanId?: string): Promise<LoanComparisonWithLoan[]>;
  deleteComparison(id: string, userId: string, tx?: DB): Promise<void>;

  // --- Refinance Alerts ---
  findRefinanceAlert(loanId: string): Promise<RefinanceAlert | null>;
  upsertRefinanceAlert(loanId: string, data: Partial<RefinanceAlert>, tx?: DB): Promise<RefinanceAlert>;
}
