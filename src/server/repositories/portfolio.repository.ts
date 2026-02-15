import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import { properties, propertyValues, loans, transactions, portfolioShares } from "../db/schema";
import type { Property, Loan, Transaction, PortfolioShare, NewPortfolioShare } from "../db/schema";
import { BaseRepository } from "./base";
import type { IPortfolioRepository } from "./interfaces/portfolio.repository.interface";

export class PortfolioRepository
  extends BaseRepository
  implements IPortfolioRepository
{
  async findProperties(userId: string): Promise<Property[]> {
    return this.db.query.properties.findMany({
      where: eq(properties.userId, userId),
    });
  }

  async findLoansByProperties(
    userId: string,
    propertyIds: string[]
  ): Promise<Loan[]> {
    if (propertyIds.length === 0) return [];
    return this.db.query.loans.findMany({
      where: and(
        eq(loans.userId, userId),
        inArray(loans.propertyId, propertyIds)
      ),
    });
  }

  async findTransactionsInRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    return this.db.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      ),
    });
  }

  async getLatestPropertyValues(
    userId: string,
    propertyIds: string[]
  ): Promise<Map<string, number>> {
    if (propertyIds.length === 0) return new Map();

    const rows = await this.db
      .selectDistinctOn([propertyValues.propertyId], {
        propertyId: propertyValues.propertyId,
        estimatedValue: propertyValues.estimatedValue,
      })
      .from(propertyValues)
      .where(
        and(
          eq(propertyValues.userId, userId),
          inArray(propertyValues.propertyId, propertyIds)
        )
      )
      .orderBy(propertyValues.propertyId, desc(propertyValues.valueDate));

    const latestValues = new Map<string, number>();
    for (const row of rows) {
      latestValues.set(row.propertyId, Number(row.estimatedValue));
    }
    return latestValues;
  }

  async createShare(data: NewPortfolioShare): Promise<PortfolioShare> {
    const [share] = await this.db
      .insert(portfolioShares)
      .values(data)
      .returning();
    return share;
  }

  async findSharesByOwner(userId: string): Promise<PortfolioShare[]> {
    return this.db.query.portfolioShares.findMany({
      where: eq(portfolioShares.userId, userId),
      orderBy: [desc(portfolioShares.createdAt)],
    });
  }

  async deleteShare(id: string, userId: string): Promise<PortfolioShare | null> {
    const [deleted] = await this.db
      .delete(portfolioShares)
      .where(
        and(eq(portfolioShares.id, id), eq(portfolioShares.userId, userId))
      )
      .returning();
    return deleted ?? null;
  }
}
