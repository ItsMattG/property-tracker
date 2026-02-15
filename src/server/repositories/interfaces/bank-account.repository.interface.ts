import type {
  BankAccount, NewBankAccount, ConnectionAlert, NewConnectionAlert, Property,
  AnomalyAlert, NewAnomalyAlert, Transaction,
} from "../../db/schema";
import type { DB } from "../base";

/** Bank account with optional relations loaded */
export type BankAccountWithRelations = BankAccount & {
  defaultProperty?: Property | null;
  alerts?: ConnectionAlert[];
};

/** Anomaly alert with property and transaction relations */
export type AnomalyAlertWithRelations = AnomalyAlert & {
  property: Property | null;
  transaction: Transaction | null;
};

/** Anomaly alert with all relations (full detail view) */
export type AnomalyAlertFull = AnomalyAlert & {
  property: Property | null;
  transaction: Transaction | null;
  recurringTransaction: { id: string } | null;
  expectedTransaction: { id: string } | null;
};

/** Anomaly alert count breakdown */
export type AnomalyAlertCounts = {
  total: number;
  critical: number;
  warning: number;
  info: number;
};

export interface IBankAccountRepository {
  /** List accounts for a user with optional relations */
  findByOwner(userId: string, opts?: { withProperty?: boolean; withAlerts?: boolean }): Promise<BankAccountWithRelations[]>;

  /** Get a single account by id scoped to user */
  findById(id: string, userId: string): Promise<BankAccount | null>;

  /** Insert a new bank account */
  create(data: NewBankAccount, tx?: DB): Promise<BankAccount>;

  /** Update a bank account by id */
  update(id: string, data: Partial<BankAccount>, tx?: DB): Promise<BankAccount>;

  /** Update all accounts matching an institution for a user */
  updateByInstitution(institution: string, userId: string, data: Partial<BankAccount>, tx?: DB): Promise<void>;

  /** Delete a bank account */
  delete(id: string, tx?: DB): Promise<void>;

  /** Find active connection alerts for a user with bank account relation */
  findActiveAlerts(userId: string): Promise<(ConnectionAlert & { bankAccount: BankAccount })[]>;

  /** Find active alerts for a specific account */
  findActiveAlertsByAccount(accountId: string): Promise<ConnectionAlert[]>;

  /** Create a connection alert */
  createAlert(data: NewConnectionAlert, tx?: DB): Promise<ConnectionAlert>;

  /** Dismiss an alert by id scoped to user */
  dismissAlert(id: string, userId: string, tx?: DB): Promise<ConnectionAlert | null>;

  /** Resolve all active alerts for an account */
  resolveAlertsByAccount(accountId: string, tx?: DB): Promise<void>;

  // --- Anomaly Alerts ---
  findAnomalyAlerts(userId: string, opts?: {
    status?: AnomalyAlert["status"]; severity?: AnomalyAlert["severity"]; propertyId?: string;
    limit?: number; offset?: number;
  }): Promise<AnomalyAlertWithRelations[]>;
  findAnomalyAlertById(id: string, userId: string): Promise<AnomalyAlertFull | null>;
  getAnomalyAlertCounts(userId: string): Promise<AnomalyAlertCounts>;
  updateAnomalyAlertStatus(id: string, userId: string, data: Partial<AnomalyAlert>, tx?: DB): Promise<AnomalyAlert | null>;
  bulkUpdateAnomalyAlertStatus(ids: string[], userId: string, data: Partial<AnomalyAlert>, tx?: DB): Promise<void>;
  createAnomalyAlerts(alerts: NewAnomalyAlert[], tx?: DB): Promise<AnomalyAlert[]>;
}
