import { eq, and } from "drizzle-orm";
import {
  depreciationSchedules,
  depreciationAssets,
  depreciationClaims,
  capitalWorks,
} from "../db/schema";
import type {
  DepreciationAsset,
  NewDepreciationAsset,
  DepreciationClaim,
  NewDepreciationClaim,
  DepreciationSchedule,
  NewDepreciationSchedule,
  CapitalWork,
  NewCapitalWork,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IDepreciationRepository,
  ScheduleWithAssets,
} from "./interfaces/depreciation.repository.interface";

export class DepreciationRepository
  extends BaseRepository
  implements IDepreciationRepository
{
  async createSchedule(
    data: NewDepreciationSchedule,
    tx?: DB
  ): Promise<DepreciationSchedule> {
    const client = this.resolve(tx);
    const [schedule] = await client
      .insert(depreciationSchedules)
      .values(data)
      .returning();
    return schedule;
  }

  async findSchedulesByProperty(
    propertyId: string,
    userId: string
  ): Promise<ScheduleWithAssets[]> {
    return this.db.query.depreciationSchedules.findMany({
      where: and(
        eq(depreciationSchedules.propertyId, propertyId),
        eq(depreciationSchedules.userId, userId)
      ),
      with: {
        assets: {
          with: { claims: true },
        },
      },
    });
  }

  async findAssetById(
    assetId: string,
    userId: string
  ): Promise<DepreciationAsset | null> {
    const result = await this.db.query.depreciationAssets.findFirst({
      where: eq(depreciationAssets.id, assetId),
      with: { schedule: true },
    });
    if (!result) return null;

    // Verify ownership via the schedule's userId
    const { schedule, ...asset } = result;
    if (schedule.userId !== userId) return null;

    return asset;
  }

  async createAsset(
    data: NewDepreciationAsset,
    tx?: DB
  ): Promise<DepreciationAsset> {
    const client = this.resolve(tx);
    const [asset] = await client
      .insert(depreciationAssets)
      .values(data)
      .returning();
    return asset;
  }

  async updateAsset(
    assetId: string,
    userId: string,
    data: Partial<DepreciationAsset>,
    tx?: DB
  ): Promise<DepreciationAsset | null> {
    // Verify ownership before updating
    const existing = await this.findAssetById(assetId, userId);
    if (!existing) return null;

    const client = this.resolve(tx);
    const [updated] = await client
      .update(depreciationAssets)
      .set(data)
      .where(eq(depreciationAssets.id, assetId))
      .returning();
    return updated ?? null;
  }

  async deleteAsset(
    assetId: string,
    userId: string,
    tx?: DB
  ): Promise<void> {
    // Verify ownership before deleting
    const existing = await this.findAssetById(assetId, userId);
    if (!existing) return;

    const client = this.resolve(tx);
    await client
      .delete(depreciationAssets)
      .where(eq(depreciationAssets.id, assetId));
  }

  async findCapitalWorksByProperty(
    propertyId: string,
    userId: string
  ): Promise<CapitalWork[]> {
    return this.db.query.capitalWorks.findMany({
      where: and(
        eq(capitalWorks.propertyId, propertyId),
        eq(capitalWorks.userId, userId)
      ),
      orderBy: (cw, { desc: d }) => [d(cw.createdAt)],
    });
  }

  async createCapitalWork(
    data: NewCapitalWork,
    tx?: DB
  ): Promise<CapitalWork> {
    const client = this.resolve(tx);
    const [capitalWork] = await client
      .insert(capitalWorks)
      .values(data)
      .returning();
    return capitalWork;
  }

  async updateCapitalWork(
    id: string,
    userId: string,
    data: Partial<CapitalWork>,
    tx?: DB
  ): Promise<CapitalWork | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(capitalWorks)
      .set(data)
      .where(and(eq(capitalWorks.id, id), eq(capitalWorks.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async deleteCapitalWork(
    id: string,
    userId: string,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(capitalWorks)
      .where(and(eq(capitalWorks.id, id), eq(capitalWorks.userId, userId)));
  }

  async findClaimsByFY(
    scheduleId: string,
    financialYear: number
  ): Promise<DepreciationClaim[]> {
    return this.db.query.depreciationClaims.findMany({
      where: and(
        eq(depreciationClaims.scheduleId, scheduleId),
        eq(depreciationClaims.financialYear, financialYear)
      ),
    });
  }

  async createClaim(
    data: NewDepreciationClaim,
    tx?: DB
  ): Promise<DepreciationClaim> {
    const client = this.resolve(tx);
    const [claim] = await client
      .insert(depreciationClaims)
      .values(data)
      .returning();
    return claim;
  }

  async deleteClaimsByFY(
    scheduleId: string,
    financialYear: number,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(depreciationClaims)
      .where(
        and(
          eq(depreciationClaims.scheduleId, scheduleId),
          eq(depreciationClaims.financialYear, financialYear)
        )
      );
  }
}
