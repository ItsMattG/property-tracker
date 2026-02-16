import { eq, and, sql, gte, lt, lte, isNull, or } from "drizzle-orm";
import { budgets, personalCategories, personalTransactions } from "../db/schema";
import type { Budget, NewBudget } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IBudgetRepository, BudgetWithSpend } from "./interfaces";

/** Compute the first day of the month for a given date */
function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Compute the first day of the next month */
function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export class BudgetRepository extends BaseRepository implements IBudgetRepository {
  async findByUser(userId: string, month: Date): Promise<BudgetWithSpend[]> {
    const start = monthStart(month);
    const end = monthEnd(month);

    // Get all budgets effective in this month, joined with category info and spend
    const rows = await this.db
      .select({
        id: budgets.id,
        userId: budgets.userId,
        personalCategoryId: budgets.personalCategoryId,
        monthlyAmount: budgets.monthlyAmount,
        effectiveFrom: budgets.effectiveFrom,
        effectiveTo: budgets.effectiveTo,
        createdAt: budgets.createdAt,
        categoryName: personalCategories.name,
        categoryIcon: personalCategories.icon,
        categoryGroup: personalCategories.group,
        spent: sql<number>`COALESCE(ABS(SUM(
          CASE WHEN ${personalTransactions.date} >= ${start}
               AND ${personalTransactions.date} < ${end}
               AND ${personalTransactions.amount}::numeric < 0
          THEN ${personalTransactions.amount}::numeric
          ELSE 0 END
        )), 0)::numeric`,
      })
      .from(budgets)
      .leftJoin(
        personalCategories,
        eq(budgets.personalCategoryId, personalCategories.id)
      )
      .leftJoin(
        personalTransactions,
        and(
          eq(personalTransactions.userId, budgets.userId),
          // For category budgets: match on category. For overall: match all transactions
          or(
            eq(personalTransactions.personalCategoryId, budgets.personalCategoryId),
            isNull(budgets.personalCategoryId)
          )
        )
      )
      .where(
        and(
          eq(budgets.userId, userId),
          lte(budgets.effectiveFrom, start),
          or(
            isNull(budgets.effectiveTo),
            gte(budgets.effectiveTo, start)
          )
        )
      )
      .groupBy(
        budgets.id,
        budgets.userId,
        budgets.personalCategoryId,
        budgets.monthlyAmount,
        budgets.effectiveFrom,
        budgets.effectiveTo,
        budgets.createdAt,
        personalCategories.name,
        personalCategories.icon,
        personalCategories.group
      );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      personalCategoryId: row.personalCategoryId,
      monthlyAmount: row.monthlyAmount,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      createdAt: row.createdAt,
      spent: Number(row.spent),
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      categoryGroup: row.categoryGroup,
    }));
  }

  async findById(id: string, userId: string): Promise<Budget | null> {
    const [budget] = await this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    return budget ?? null;
  }

  async findOverallBudget(userId: string, month: Date): Promise<Budget | null> {
    const start = monthStart(month);

    const [budget] = await this.db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          isNull(budgets.personalCategoryId),
          lte(budgets.effectiveFrom, start),
          or(
            isNull(budgets.effectiveTo),
            gte(budgets.effectiveTo, start)
          )
        )
      );
    return budget ?? null;
  }

  async create(data: NewBudget, tx?: DB): Promise<Budget> {
    const client = this.resolve(tx);
    const [budget] = await client
      .insert(budgets)
      .values(data)
      .returning();
    return budget;
  }

  async update(id: string, userId: string, data: Partial<Budget>, tx?: DB): Promise<Budget | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(budgets)
      .set(data)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  async getMonthlySpendByCategory(
    userId: string,
    month: Date
  ): Promise<{ categoryId: string | null; total: number }[]> {
    const start = monthStart(month);
    const end = monthEnd(month);

    const rows = await this.db
      .select({
        categoryId: personalTransactions.personalCategoryId,
        total: sql<number>`COALESCE(ABS(SUM(${personalTransactions.amount}::numeric)), 0)::numeric`,
      })
      .from(personalTransactions)
      .where(
        and(
          eq(personalTransactions.userId, userId),
          gte(personalTransactions.date, start),
          lt(personalTransactions.date, end),
          sql`${personalTransactions.amount}::numeric < 0`
        )
      )
      .groupBy(personalTransactions.personalCategoryId);

    return rows.map((row) => ({
      categoryId: row.categoryId,
      total: Number(row.total),
    }));
  }

  async getAverageMonthlyExpenses(userId: string, months: number): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);

    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(ABS(SUM(${personalTransactions.amount}::numeric)), 0)::numeric`,
      })
      .from(personalTransactions)
      .where(
        and(
          eq(personalTransactions.userId, userId),
          gte(personalTransactions.date, start),
          lt(personalTransactions.date, end),
          sql`${personalTransactions.amount}::numeric < 0`
        )
      );

    const totalExpenses = Number(result?.total ?? 0);
    return months > 0 ? totalExpenses / months : 0;
  }
}
