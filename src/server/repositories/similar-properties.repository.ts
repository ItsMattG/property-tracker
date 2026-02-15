import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import {
  propertyVectors,
  externalListings,
  sharingPreferences,
  suburbBenchmarks,
  propertyPerformanceBenchmarks,
} from "../db/schema";
import type {
  PropertyVector,
  NewPropertyVector,
  ExternalListing,
  NewExternalListing,
  SuburbBenchmark,
  NewSuburbBenchmark,
  PropertyPerformanceBenchmark,
  NewPropertyPerformanceBenchmark,
  SharingPreference,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  ISimilarPropertiesRepository,
  SimilarVectorRow,
  PropertyVectorWithRelations,
} from "./interfaces/similar-properties.repository.interface";

export class SimilarPropertiesRepository
  extends BaseRepository
  implements ISimilarPropertiesRepository
{
  // ── Property Vectors ──────────────────────────────────────────────

  async findVectorByProperty(propertyId: string): Promise<PropertyVector | null> {
    const result = await this.db.query.propertyVectors.findFirst({
      where: eq(propertyVectors.propertyId, propertyId),
    });
    return result ?? null;
  }

  async upsertVector(propertyId: string, userId: string, vector: number[]): Promise<void> {
    const existing = await this.db.query.propertyVectors.findFirst({
      where: eq(propertyVectors.propertyId, propertyId),
    });

    if (existing) {
      await this.db
        .update(propertyVectors)
        .set({ vector, updatedAt: new Date() })
        .where(eq(propertyVectors.id, existing.id));
    } else {
      await this.db.insert(propertyVectors).values({
        propertyId,
        userId,
        vector,
      });
    }
  }

  async findVectorById(id: string): Promise<PropertyVector | null> {
    const result = await this.db.query.propertyVectors.findFirst({
      where: eq(propertyVectors.id, id),
    });
    return result ?? null;
  }

  async findVectorByPropertyAndUser(
    propertyId: string,
    userId: string
  ): Promise<PropertyVector | null> {
    const result = await this.db.query.propertyVectors.findFirst({
      where: and(
        eq(propertyVectors.propertyId, propertyId),
        eq(propertyVectors.userId, userId)
      ),
    });
    return result ?? null;
  }

  async findSimilarVectors(
    vectorId: string,
    vectorStr: string,
    userId: string,
    includeCommunity: boolean,
    limit: number
  ): Promise<SimilarVectorRow[]> {
    // pgvector requires the vector as a string literal for the <-> operator.
    // Two query variants: with or without community shared vectors.
    const results = includeCommunity
      ? await this.db.execute(sql`
          SELECT
            pv.id,
            pv.property_id,
            pv.external_listing_id,
            pv.user_id,
            pv.vector <-> ${vectorStr}::vector AS distance,
            p.suburb as property_suburb,
            p.state as property_state,
            p.address as property_address,
            el.suburb as listing_suburb,
            el.state as listing_state,
            el.property_type as listing_type,
            el.price as listing_price,
            el.source_url as listing_url
          FROM property_vectors pv
          LEFT JOIN properties p ON p.id = pv.property_id
          LEFT JOIN external_listings el ON el.id = pv.external_listing_id
          WHERE pv.id != ${vectorId}
            AND (pv.user_id = ${userId} OR pv.is_shared = true)
          ORDER BY pv.vector <-> ${vectorStr}::vector
          LIMIT ${limit}
        `)
      : await this.db.execute(sql`
          SELECT
            pv.id,
            pv.property_id,
            pv.external_listing_id,
            pv.user_id,
            pv.vector <-> ${vectorStr}::vector AS distance,
            p.suburb as property_suburb,
            p.state as property_state,
            p.address as property_address,
            el.suburb as listing_suburb,
            el.state as listing_state,
            el.property_type as listing_type,
            el.price as listing_price,
            el.source_url as listing_url
          FROM property_vectors pv
          LEFT JOIN properties p ON p.id = pv.property_id
          LEFT JOIN external_listings el ON el.id = pv.external_listing_id
          WHERE pv.id != ${vectorId}
            AND pv.user_id = ${userId}
          ORDER BY pv.vector <-> ${vectorStr}::vector
          LIMIT ${limit}
        `);

    return results as unknown as SimilarVectorRow[];
  }

  async updateVectorSharing(id: string, data: Partial<PropertyVector>): Promise<void> {
    await this.db
      .update(propertyVectors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(propertyVectors.id, id));
  }

  async discoverVectors(
    userId: string,
    limit: number,
    offset: number
  ): Promise<PropertyVectorWithRelations[]> {
    return this.db.query.propertyVectors.findMany({
      where: or(
        eq(propertyVectors.userId, userId),
        eq(propertyVectors.isShared, true)
      ),
      limit,
      offset,
      with: {
        property: true,
        externalListing: true,
      },
    });
  }

  // ── External Listings ─────────────────────────────────────────────

  async createExternalListing(data: NewExternalListing, tx?: DB): Promise<ExternalListing> {
    const client = this.resolve(tx);
    const [listing] = await client
      .insert(externalListings)
      .values(data)
      .returning();
    return listing;
  }

  async insertVector(data: NewPropertyVector, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.insert(propertyVectors).values(data);
  }

  async listExternalListings(userId: string): Promise<ExternalListing[]> {
    return this.db.query.externalListings.findMany({
      where: eq(externalListings.userId, userId),
      orderBy: [desc(externalListings.createdAt)],
    });
  }

  async deleteExternalListing(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(externalListings)
      .where(
        and(
          eq(externalListings.id, id),
          eq(externalListings.userId, userId)
        )
      );
  }

  // ── Sharing Preferences ───────────────────────────────────────────

  async findSharingPreferences(userId: string): Promise<SharingPreference | null> {
    const result = await this.db.query.sharingPreferences.findFirst({
      where: eq(sharingPreferences.userId, userId),
    });
    return result ?? null;
  }

  async upsertSharingPreferences(
    userId: string,
    data: { defaultShareLevel: string; defaultSharedAttributes: string[] }
  ): Promise<void> {
    const existing = await this.db.query.sharingPreferences.findFirst({
      where: eq(sharingPreferences.userId, userId),
    });

    if (existing) {
      await this.db
        .update(sharingPreferences)
        .set({
          defaultShareLevel: data.defaultShareLevel as SharingPreference["defaultShareLevel"],
          defaultSharedAttributes: data.defaultSharedAttributes,
          updatedAt: new Date(),
        })
        .where(eq(sharingPreferences.id, existing.id));
    } else {
      await this.db.insert(sharingPreferences).values({
        userId,
        defaultShareLevel: data.defaultShareLevel as SharingPreference["defaultShareLevel"],
        defaultSharedAttributes: data.defaultSharedAttributes,
      });
    }
  }

  // ── Suburb Benchmarks ─────────────────────────────────────────────

  async findSuburbBenchmark(
    suburb: string,
    state: string,
    propertyType?: string
  ): Promise<SuburbBenchmark | null> {
    const conditions = [
      eq(suburbBenchmarks.suburb, suburb),
      eq(suburbBenchmarks.state, state),
    ];
    if (propertyType) {
      conditions.push(eq(suburbBenchmarks.propertyType, propertyType));
    }
    const result = await this.db.query.suburbBenchmarks.findFirst({
      where: and(...conditions),
    });
    return result ?? null;
  }

  async createSuburbBenchmark(data: NewSuburbBenchmark): Promise<SuburbBenchmark> {
    const [inserted] = await this.db.insert(suburbBenchmarks).values(data).returning();
    return inserted;
  }

  // ── Performance Benchmarks ──────────────────────────────────────────

  async upsertPerformanceBenchmark(data: NewPropertyPerformanceBenchmark): Promise<void> {
    await this.db
      .insert(propertyPerformanceBenchmarks)
      .values(data)
      .onConflictDoUpdate({
        target: propertyPerformanceBenchmarks.propertyId,
        set: {
          yieldPercentile: data.yieldPercentile,
          growthPercentile: data.growthPercentile,
          expensePercentile: data.expensePercentile,
          vacancyPercentile: data.vacancyPercentile,
          performanceScore: data.performanceScore,
          cohortSize: data.cohortSize,
          cohortDescription: data.cohortDescription,
          suburbBenchmarkId: data.suburbBenchmarkId,
          insights: data.insights,
          calculatedAt: new Date(),
        },
      });
  }

  async findPerformanceBenchmarksByProperties(
    propertyIds: string[]
  ): Promise<PropertyPerformanceBenchmark[]> {
    if (propertyIds.length === 0) return [];
    return this.db.query.propertyPerformanceBenchmarks.findMany({
      where: inArray(propertyPerformanceBenchmarks.propertyId, propertyIds),
    });
  }
}
