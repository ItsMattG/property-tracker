import { eq, desc } from "drizzle-orm";
import { BaseRepository, type DB } from "./base";
import type { IInsightsRepository } from "./interfaces/insights.repository.interface";
import {
  portfolioInsights,
  type PortfolioInsightRow,
  type NewPortfolioInsightRow,
} from "../db/schema";

export class InsightsRepository
  extends BaseRepository
  implements IInsightsRepository
{
  async findFreshByUser(userId: string): Promise<PortfolioInsightRow | null> {
    const [row] = await this.db
      .select()
      .from(portfolioInsights)
      .where(eq(portfolioInsights.userId, userId))
      .orderBy(desc(portfolioInsights.generatedAt))
      .limit(1);

    if (!row) return null;

    // Check if still fresh (expiresAt > now)
    if (row.expiresAt < new Date()) return null;

    return row;
  }

  async upsert(
    data: NewPortfolioInsightRow,
    tx?: DB
  ): Promise<PortfolioInsightRow> {
    const client = this.resolve(tx);

    // Delete existing row for user, then insert new
    await client
      .delete(portfolioInsights)
      .where(eq(portfolioInsights.userId, data.userId));

    const [row] = await client
      .insert(portfolioInsights)
      .values(data)
      .returning();

    return row;
  }
}
