import type { BankAccount, NewBankAccount, ConnectionAlert, NewConnectionAlert } from "../../db/schema";
import type { DB } from "../base";

/** Bank account with optional relations loaded */
export type BankAccountWithRelations = BankAccount & {
  defaultProperty?: unknown;
  alerts?: ConnectionAlert[];
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
}
