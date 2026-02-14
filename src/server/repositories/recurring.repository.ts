import { eq, and } from "drizzle-orm";
import {
  recurringTransactions,
  expectedTransactions,
} from "../db/schema";
import type {
  RecurringTransaction,
  NewRecurringTransaction,
  ExpectedTransaction,
  NewExpectedTransaction,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IRecurringRepository,
  RecurringWithRelations,
  ExpectedWithRelations,
  ExpectedTransactionFilters,
} from "./interfaces/recurring.repository.interface";

export class RecurringRepository
  extends BaseRepository
  implements IRecurringRepository
{
  async findByOwner(
    userId: string,
    opts?: { propertyId?: string; isActive?: boolean }
  ): Promise<RecurringWithRelations[]> {
    const conditions = [eq(recurringTransactions.userId, userId)];

    if (opts?.propertyId) {
      conditions.push(eq(recurringTransactions.propertyId, opts.propertyId));
    }
    if (opts?.isActive !== undefined) {
      conditions.push(eq(recurringTransactions.isActive, opts.isActive));
    }

    return this.db.query.recurringTransactions.findMany({
      where: and(...conditions),
      with: {
        property: true,
        linkedBankAccount: true,
      },
      orderBy: (rt, { desc }) => [desc(rt.createdAt)],
    }) as Promise<RecurringWithRelations[]>;
  }

  async findById(
    id: string,
    userId: string
  ): Promise<RecurringWithRelations | null> {
    const result = await this.db.query.recurringTransactions.findFirst({
      where: and(
        eq(recurringTransactions.id, id),
        eq(recurringTransactions.userId, userId)
      ),
      with: {
        property: true,
        linkedBankAccount: true,
        expectedTransactions: {
          orderBy: (et, { desc }) => [desc(et.expectedDate)],
          limit: 10,
        },
      },
    });
    return (result as RecurringWithRelations) ?? null;
  }

  async create(
    data: NewRecurringTransaction,
    tx?: DB
  ): Promise<RecurringTransaction> {
    const client = this.resolve(tx);
    const [recurring] = await client
      .insert(recurringTransactions)
      .values(data)
      .returning();
    return recurring;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<RecurringTransaction>,
    tx?: DB
  ): Promise<RecurringTransaction> {
    const client = this.resolve(tx);
    const [recurring] = await client
      .update(recurringTransactions)
      .set(data)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      )
      .returning();
    return recurring;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      );
  }

  async createExpected(
    data: NewExpectedTransaction[],
    tx?: DB
  ): Promise<void> {
    if (data.length === 0) return;
    const client = this.resolve(tx);
    await client.insert(expectedTransactions).values(data);
  }

  async updateExpected(
    id: string,
    userId: string,
    data: Partial<ExpectedTransaction>,
    tx?: DB
  ): Promise<ExpectedTransaction | null> {
    const client = this.resolve(tx);
    const [result] = await client
      .update(expectedTransactions)
      .set(data)
      .where(
        and(
          eq(expectedTransactions.id, id),
          eq(expectedTransactions.userId, userId)
        )
      )
      .returning();
    return result ?? null;
  }

  async findExpected(
    userId: string,
    filters?: ExpectedTransactionFilters
  ): Promise<ExpectedWithRelations[]> {
    const conditions = [eq(expectedTransactions.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(expectedTransactions.status, filters.status));
    }
    if (filters?.propertyId) {
      conditions.push(eq(expectedTransactions.propertyId, filters.propertyId));
    }
    if (filters?.recurringTransactionId) {
      conditions.push(
        eq(
          expectedTransactions.recurringTransactionId,
          filters.recurringTransactionId
        )
      );
    }

    return this.db.query.expectedTransactions.findMany({
      where: and(...conditions),
      with: {
        recurringTransaction: true,
        property: true,
        matchedTransaction: true,
      },
      orderBy: (et, { desc }) => [desc(et.expectedDate)],
    }) as Promise<ExpectedWithRelations[]>;
  }

  async findPendingExpected(
    userId: string
  ): Promise<ExpectedWithRelations[]> {
    return this.db.query.expectedTransactions.findMany({
      where: and(
        eq(expectedTransactions.userId, userId),
        eq(expectedTransactions.status, "pending")
      ),
      with: {
        recurringTransaction: true,
      },
    }) as Promise<ExpectedWithRelations[]>;
  }
}
