import type { Budget, NewBudget } from "../../db/schema";
import type { DB } from "../base";

export interface BudgetWithSpend extends Budget {
  spent: number;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryGroup: string | null;
}

export interface IBudgetRepository {
  /** Find all budgets for a user effective in the given month, with computed spend */
  findByUser(userId: string, month: Date): Promise<BudgetWithSpend[]>;

  /** Find a single budget by id scoped to user */
  findById(id: string, userId: string): Promise<Budget | null>;

  /** Find the overall budget (null categoryId) for a given month */
  findOverallBudget(userId: string, month: Date): Promise<Budget | null>;

  /** Create a new budget */
  create(data: NewBudget, tx?: DB): Promise<Budget>;

  /** Update a budget's fields — returns null if no matching budget */
  update(id: string, userId: string, data: Partial<Budget>, tx?: DB): Promise<Budget | null>;

  /** Delete a budget scoped to user */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Get total spend per category for a given month */
  getMonthlySpendByCategory(userId: string, month: Date): Promise<{ categoryId: string | null; total: number }[]>;

  /** Get average monthly expenses over the last N months */
  getAverageMonthlyExpenses(userId: string, months: number): Promise<number>;
}
