import type { Property, Loan, Transaction } from "../../db/schema";

/**
 * Portfolio repository — aggregate queries across properties, loans,
 * transactions, and valuations for portfolio-level analytics.
 *
 * Note: This is distinct from team/share routers which handle
 * portfolio membership. This handles the read-only analytics view.
 */
export interface IPortfolioRepository {
  /** Get all properties for a user */
  findProperties(userId: string): Promise<Property[]>;

  /** Get all loans for specific properties */
  findLoansByProperties(userId: string, propertyIds: string[]): Promise<Loan[]>;

  /** Get transactions in a date range for a user */
  findTransactionsInRange(userId: string, startDate: string, endDate: string): Promise<Transaction[]>;

  /** Get latest property value per property using DISTINCT ON */
  getLatestPropertyValues(userId: string, propertyIds: string[]): Promise<Map<string, number>>;
}
