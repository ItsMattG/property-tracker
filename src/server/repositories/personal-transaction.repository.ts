import { eq, and, sql, gte, lte, desc, count } from "drizzle-orm";
import { personalTransactions, personalCategories } from "../db/schema";
import type { PersonalTransaction, NewPersonalTransaction } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPersonalTransactionRepository, PersonalTransactionWithCategory } from "./interfaces";

export class PersonalTransactionRepository
  extends BaseRepository
  implements IPersonalTransactionRepository
{
  async findByUser(
    userId: string,
    opts: {
      categoryId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transactions: PersonalTransactionWithCategory[]; total: number }> {
    const conditions = [eq(personalTransactions.userId, userId)];

    if (opts.categoryId) {
      conditions.push(eq(personalTransactions.personalCategoryId, opts.categoryId));
    }
    if (opts.startDate) {
      conditions.push(gte(personalTransactions.date, opts.startDate));
    }
    if (opts.endDate) {
      conditions.push(lte(personalTransactions.date, opts.endDate));
    }

    const whereClause = and(...conditions);
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const [rows, [countResult]] = await Promise.all([
      this.db
        .select({
          id: personalTransactions.id,
          userId: personalTransactions.userId,
          date: personalTransactions.date,
          description: personalTransactions.description,
          amount: personalTransactions.amount,
          personalCategoryId: personalTransactions.personalCategoryId,
          bankAccountId: personalTransactions.bankAccountId,
          basiqTransactionId: personalTransactions.basiqTransactionId,
          notes: personalTransactions.notes,
          isRecurring: personalTransactions.isRecurring,
          suggestedCategoryId: personalTransactions.suggestedCategoryId,
          suggestionConfidence: personalTransactions.suggestionConfidence,
          createdAt: personalTransactions.createdAt,
          categoryName: personalCategories.name,
          categoryIcon: personalCategories.icon,
        })
        .from(personalTransactions)
        .leftJoin(
          personalCategories,
          eq(personalTransactions.personalCategoryId, personalCategories.id)
        )
        .where(whereClause)
        .orderBy(desc(personalTransactions.date))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(personalTransactions)
        .where(whereClause),
    ]);

    return {
      transactions: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        date: row.date,
        description: row.description,
        amount: row.amount,
        personalCategoryId: row.personalCategoryId,
        bankAccountId: row.bankAccountId,
        basiqTransactionId: row.basiqTransactionId,
        notes: row.notes,
        isRecurring: row.isRecurring,
        suggestedCategoryId: row.suggestedCategoryId,
        suggestionConfidence: row.suggestionConfidence,
        createdAt: row.createdAt,
        categoryName: row.categoryName ?? null,
        categoryIcon: row.categoryIcon ?? null,
      })),
      total: countResult.total,
    };
  }

  async findById(id: string, userId: string): Promise<PersonalTransaction | null> {
    const [transaction] = await this.db
      .select()
      .from(personalTransactions)
      .where(and(eq(personalTransactions.id, id), eq(personalTransactions.userId, userId)));
    return transaction ?? null;
  }

  async create(data: NewPersonalTransaction, tx?: DB): Promise<PersonalTransaction> {
    const client = this.resolve(tx);
    const [transaction] = await client
      .insert(personalTransactions)
      .values(data)
      .returning();
    return transaction;
  }

  async createMany(data: NewPersonalTransaction[], tx?: DB): Promise<PersonalTransaction[]> {
    const client = this.resolve(tx);
    return client
      .insert(personalTransactions)
      .values(data)
      .returning();
  }

  async update(
    id: string,
    userId: string,
    data: Partial<PersonalTransaction>,
    tx?: DB
  ): Promise<PersonalTransaction | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(personalTransactions)
      .set(data)
      .where(and(eq(personalTransactions.id, id), eq(personalTransactions.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(personalTransactions)
      .where(and(eq(personalTransactions.id, id), eq(personalTransactions.userId, userId)));
  }

  async findByBasiqId(basiqTransactionId: string): Promise<PersonalTransaction | null> {
    const [transaction] = await this.db
      .select()
      .from(personalTransactions)
      .where(eq(personalTransactions.basiqTransactionId, basiqTransactionId));
    return transaction ?? null;
  }

  async getMonthlySummary(
    userId: string,
    months: number
  ): Promise<{ month: string; income: number; expenses: number }[]> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const rows = await this.db
      .select({
        month: sql<string>`to_char(${personalTransactions.date}, 'YYYY-MM')`,
        income: sql<number>`COALESCE(SUM(CASE WHEN ${personalTransactions.amount}::numeric >= 0 THEN ${personalTransactions.amount}::numeric ELSE 0 END), 0)::numeric`,
        expenses: sql<number>`COALESCE(ABS(SUM(CASE WHEN ${personalTransactions.amount}::numeric < 0 THEN ${personalTransactions.amount}::numeric ELSE 0 END)), 0)::numeric`,
      })
      .from(personalTransactions)
      .where(
        and(
          eq(personalTransactions.userId, userId),
          gte(personalTransactions.date, start)
        )
      )
      .groupBy(sql`to_char(${personalTransactions.date}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${personalTransactions.date}, 'YYYY-MM')`);

    return rows.map((row) => ({
      month: row.month,
      income: Number(row.income),
      expenses: Number(row.expenses),
    }));
  }
}
