import { eq, and, desc, gte, lte, inArray, isNotNull, sql } from "drizzle-orm";
import { transactions } from "../db/schema";
import type { Transaction, NewTransaction } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ITransactionRepository,
  TransactionFilters,
  PaginatedTransactions,
  TransactionWithRelations,
} from "./interfaces/transaction.repository.interface";

export class TransactionRepository
  extends BaseRepository
  implements ITransactionRepository
{
  /** Build where clause from filters, always scoped to userId */
  private buildWhere(userId: string, filters?: Omit<TransactionFilters, "limit" | "offset">) {
    const conditions = [eq(transactions.userId, userId)];

    if (filters?.propertyId) {
      conditions.push(eq(transactions.propertyId, filters.propertyId));
    }
    if (filters?.category) {
      conditions.push(eq(transactions.category, filters.category as typeof transactions.category.enumValues[number]));
    }
    if (filters?.isVerified !== undefined) {
      conditions.push(eq(transactions.isVerified, filters.isVerified));
    }
    if (filters?.startDate) {
      conditions.push(gte(transactions.date, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(transactions.date, filters.endDate));
    }
    if (filters?.bankAccountId) {
      conditions.push(eq(transactions.bankAccountId, filters.bankAccountId));
    }

    return and(...conditions);
  }

  async findByOwner(
    userId: string,
    filters?: TransactionFilters
  ): Promise<PaginatedTransactions> {
    const whereClause = this.buildWhere(userId, filters);
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const results = await this.db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.date)],
      limit,
      offset,
      with: {
        property: true,
        bankAccount: true,
      },
    });

    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(whereClause);

    return {
      transactions: results,
      total,
      hasMore: offset + results.length < total,
    };
  }

  async findAllByOwner(
    userId: string,
    filters?: Omit<TransactionFilters, "limit" | "offset">
  ): Promise<TransactionWithRelations[]> {
    return this.db.query.transactions.findMany({
      where: this.buildWhere(userId, filters),
      orderBy: [desc(transactions.date)],
      with: {
        property: true,
      },
    }) as Promise<TransactionWithRelations[]>;
  }

  async findById(id: string, userId: string): Promise<Transaction | null> {
    const result = await this.db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
    });
    return result ?? null;
  }

  async create(data: NewTransaction, tx?: DB): Promise<Transaction> {
    const client = this.resolve(tx);
    const [transaction] = await client.insert(transactions).values(data).returning();
    return transaction;
  }

  async createMany(data: NewTransaction[], tx?: DB): Promise<Transaction[]> {
    if (data.length === 0) return [];
    const client = this.resolve(tx);
    return client.insert(transactions).values(data).returning();
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Transaction>,
    tx?: DB
  ): Promise<Transaction> {
    const client = this.resolve(tx);
    const [transaction] = await client
      .update(transactions)
      .set(data)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return transaction;
  }

  async updateMany(
    ids: string[],
    userId: string,
    data: Partial<Transaction>,
    tx?: DB
  ): Promise<void> {
    if (ids.length === 0) return;
    const client = this.resolve(tx);
    await client
      .update(transactions)
      .set(data)
      .where(
        and(inArray(transactions.id, ids), eq(transactions.userId, userId))
      );
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  async countUncategorized(bankAccountId: string, userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.bankAccountId, bankAccountId),
          eq(transactions.userId, userId),
          eq(transactions.category, "uncategorized")
        )
      );
    return result?.count ?? 0;
  }

  async getReconciledBalance(bankAccountId: string, userId: string): Promise<string> {
    const [result] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(amount AS NUMERIC)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.bankAccountId, bankAccountId),
          eq(transactions.userId, userId),
          sql`${transactions.category} != 'uncategorized'`
        )
      );
    return result?.total ?? "0";
  }

  async getMonthlyCashFlow(
    bankAccountId: string,
    userId: string,
    monthStart: string
  ): Promise<{ cashIn: string; cashOut: string }> {
    const [result] = await this.db
      .select({
        cashIn: sql<string>`COALESCE(SUM(CASE WHEN CAST(amount AS NUMERIC) > 0 THEN CAST(amount AS NUMERIC) ELSE 0 END), 0)`,
        cashOut: sql<string>`COALESCE(SUM(CASE WHEN CAST(amount AS NUMERIC) < 0 THEN CAST(amount AS NUMERIC) ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.bankAccountId, bankAccountId),
          eq(transactions.userId, userId),
          sql`${transactions.date} >= ${monthStart}`
        )
      );
    return {
      cashIn: result?.cashIn ?? "0",
      cashOut: result?.cashOut ?? "0",
    };
  }

  async findRecentByAccount(
    userId: string,
    bankAccountId: string,
    limit: number
  ): Promise<Transaction[]> {
    return this.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.bankAccountId, bankAccountId)
      ),
      orderBy: [desc(transactions.createdAt)],
      limit,
    });
  }

  async findUncategorizedByAccount(
    userId: string,
    bankAccountId: string,
    limit: number
  ): Promise<Transaction[]> {
    return this.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.bankAccountId, bankAccountId),
        eq(transactions.category, "uncategorized"),
        sql`${transactions.suggestionStatus} IS NULL`
      ),
      orderBy: [desc(transactions.createdAt)],
      limit,
    });
  }

  async findPendingSuggestions(
    userId: string,
    filters: { confidenceFilter?: "all" | "high" | "low"; limit?: number; offset?: number }
  ): Promise<{ transactions: TransactionWithRelations[]; total: number }> {
    const conditions = [
      eq(transactions.userId, userId),
      eq(transactions.suggestionStatus, "pending"),
      isNotNull(transactions.suggestedCategory),
    ];

    if (filters.confidenceFilter === "high") {
      conditions.push(sql`${transactions.suggestionConfidence}::numeric >= 85`);
    } else if (filters.confidenceFilter === "low") {
      conditions.push(sql`${transactions.suggestionConfidence}::numeric < 60`);
    }

    const whereClause = and(...conditions);
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const results = await this.db.query.transactions.findMany({
      where: whereClause,
      orderBy: [desc(transactions.date)],
      limit,
      offset,
      with: {
        property: true,
        bankAccount: true,
      },
    });

    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(whereClause);

    return { transactions: results as TransactionWithRelations[], total };
  }

  async countPendingSuggestions(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.suggestionStatus, "pending"),
          isNotNull(transactions.suggestedCategory)
        )
      );
    return count;
  }

  async findForCategorization(
    userId: string,
    opts?: { limit?: number }
  ): Promise<Transaction[]> {
    return this.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.category, "uncategorized"),
        sql`${transactions.suggestionStatus} IS NULL OR ${transactions.suggestionStatus} = 'failed'`
      ),
      limit: opts?.limit ?? 20,
      orderBy: [desc(transactions.date)],
    });
  }

  async findByIds(ids: string[], userId: string): Promise<Transaction[]> {
    if (ids.length === 0) return [];
    return this.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        inArray(transactions.id, ids)
      ),
    });
  }
}
