import { eq, and, desc, sql } from "drizzle-orm";
import {
  taxProfiles, taxSuggestions, depreciationSchedules, depreciationAssets,
  merchantCategories, categorizationExamples,
} from "../db/schema";
import type {
  TaxProfile, NewTaxProfile, TaxSuggestion,
  DepreciationSchedule, DepreciationAsset, NewDepreciationAsset, MerchantCategory,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ITaxRepository, TaxSuggestionWithProperty, DepreciationScheduleWithRelations,
} from "./interfaces/tax.repository.interface";

export class TaxRepository extends BaseRepository implements ITaxRepository {
  async findProfileByUserAndYear(userId: string, financialYear: number): Promise<TaxProfile | null> {
    const result = await this.db.query.taxProfiles.findFirst({
      where: and(eq(taxProfiles.userId, userId), eq(taxProfiles.financialYear, financialYear)),
    });
    return result ?? null;
  }

  async createProfile(data: NewTaxProfile, tx?: DB): Promise<TaxProfile> {
    const client = this.resolve(tx);
    const [profile] = await client.insert(taxProfiles).values(data).returning();
    return profile;
  }

  async updateProfile(id: string, data: Partial<TaxProfile>, tx?: DB): Promise<TaxProfile> {
    const client = this.resolve(tx);
    const [profile] = await client.update(taxProfiles).set(data).where(eq(taxProfiles.id, id)).returning();
    return profile;
  }

  async findSuggestions(userId: string, financialYear: string, status: string): Promise<TaxSuggestionWithProperty[]> {
    return this.db.query.taxSuggestions.findMany({
      where: and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.financialYear, financialYear),
        eq(taxSuggestions.status, status as TaxSuggestion["status"])
      ),
      with: { property: true },
      orderBy: [desc(taxSuggestions.estimatedSavings)],
    }) as Promise<TaxSuggestionWithProperty[]>;
  }

  async countActiveSuggestions(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(taxSuggestions)
      .where(and(eq(taxSuggestions.userId, userId), eq(taxSuggestions.status, "active")));
    return count;
  }

  async updateSuggestionStatus(id: string, userId: string, status: string, tx?: DB): Promise<TaxSuggestion | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(taxSuggestions)
      .set({ status: status as TaxSuggestion["status"] })
      .where(and(eq(taxSuggestions.id, id), eq(taxSuggestions.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async actionSuggestionsByPropertyAndType(userId: string, propertyId: string, type: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(taxSuggestions)
      .set({ status: "actioned" })
      .where(and(
        eq(taxSuggestions.userId, userId),
        eq(taxSuggestions.propertyId, propertyId),
        eq(taxSuggestions.type, type as TaxSuggestion["type"]),
        eq(taxSuggestions.status, "active")
      ));
  }

  async findSchedules(userId: string, propertyId?: string): Promise<DepreciationScheduleWithRelations[]> {
    const conditions = [eq(depreciationSchedules.userId, userId)];
    if (propertyId) conditions.push(eq(depreciationSchedules.propertyId, propertyId));
    return this.db.query.depreciationSchedules.findMany({
      where: and(...conditions),
      with: { property: true, assets: true, document: true },
      orderBy: [desc(depreciationSchedules.createdAt)],
    }) as Promise<DepreciationScheduleWithRelations[]>;
  }

  async createSchedule(
    data: { propertyId: string; userId: string; documentId: string; effectiveDate: string; totalValue: string },
    tx?: DB
  ): Promise<DepreciationSchedule> {
    const client = this.resolve(tx);
    const [schedule] = await client.insert(depreciationSchedules).values(data).returning();
    return schedule;
  }

  async deleteSchedule(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.delete(depreciationSchedules).where(
      and(eq(depreciationSchedules.id, id), eq(depreciationSchedules.userId, userId))
    );
  }

  async createAssets(assets: NewDepreciationAsset[], tx?: DB): Promise<DepreciationAsset[]> {
    const client = this.resolve(tx);
    return client.insert(depreciationAssets).values(assets).returning();
  }

  async findMerchantCategories(userId: string): Promise<MerchantCategory[]> {
    return this.db.query.merchantCategories.findMany({
      where: eq(merchantCategories.userId, userId),
    });
  }

  async countCategorizationExamples(userId: string): Promise<number> {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(categorizationExamples)
      .where(eq(categorizationExamples.userId, userId));
    return count;
  }
}
