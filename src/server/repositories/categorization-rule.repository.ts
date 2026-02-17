import { eq, and, desc, sql } from "drizzle-orm";
import { categorizationRules } from "../db/schema";
import type { CategorizationRule, NewCategorizationRule } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { ICategorizationRuleRepository } from "./interfaces";

export class CategorizationRuleRepository extends BaseRepository implements ICategorizationRuleRepository {
  async findByUser(userId: string): Promise<CategorizationRule[]> {
    return this.db
      .select()
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId))
      .orderBy(desc(categorizationRules.priority));
  }

  async findActiveByUser(userId: string): Promise<CategorizationRule[]> {
    return this.db
      .select()
      .from(categorizationRules)
      .where(
        and(
          eq(categorizationRules.userId, userId),
          eq(categorizationRules.isActive, true),
        )
      )
      .orderBy(desc(categorizationRules.priority));
  }

  async findById(id: string, userId: string): Promise<CategorizationRule | null> {
    const [rule] = await this.db
      .select()
      .from(categorizationRules)
      .where(and(eq(categorizationRules.id, id), eq(categorizationRules.userId, userId)));
    return rule ?? null;
  }

  async countByUser(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categorizationRules)
      .where(eq(categorizationRules.userId, userId));
    return result?.count ?? 0;
  }

  async create(data: NewCategorizationRule, tx?: DB): Promise<CategorizationRule> {
    const client = this.resolve(tx);
    const [rule] = await client
      .insert(categorizationRules)
      .values(data)
      .returning();
    return rule;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<CategorizationRule>,
    tx?: DB,
  ): Promise<CategorizationRule | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(categorizationRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(categorizationRules.id, id), eq(categorizationRules.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(categorizationRules)
      .where(and(eq(categorizationRules.id, id), eq(categorizationRules.userId, userId)));
  }

  async incrementMatchCount(id: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(categorizationRules)
      .set({
        matchCount: sql`${categorizationRules.matchCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(categorizationRules.id, id));
  }
}
