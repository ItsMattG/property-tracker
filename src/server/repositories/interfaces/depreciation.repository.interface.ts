import type {
  DepreciationAsset,
  NewDepreciationAsset,
  DepreciationClaim,
  NewDepreciationClaim,
  CapitalWork,
  NewCapitalWork,
  DepreciationSchedule,
  NewDepreciationSchedule,
} from "../../db/schema";
import type { DB } from "../base";

export type DepreciationAssetWithClaims = DepreciationAsset & {
  claims: DepreciationClaim[];
};

export type ScheduleWithAssets = DepreciationSchedule & {
  assets: DepreciationAssetWithClaims[];
};

export interface IDepreciationRepository {
  /** Create a new depreciation schedule */
  createSchedule(data: NewDepreciationSchedule, tx?: DB): Promise<DepreciationSchedule>;

  /** Find all schedules for a property with nested assets and claims */
  findSchedulesByProperty(propertyId: string, userId: string): Promise<ScheduleWithAssets[]>;

  /** Find a single asset by id, verifying ownership via schedule */
  findAssetById(assetId: string, userId: string): Promise<DepreciationAsset | null>;

  /** Insert a new depreciation asset */
  createAsset(data: NewDepreciationAsset, tx?: DB): Promise<DepreciationAsset>;

  /** Update an asset's fields — returns null if not found or not owned */
  updateAsset(assetId: string, userId: string, data: Partial<DepreciationAsset>, tx?: DB): Promise<DepreciationAsset | null>;

  /** Delete an asset after verifying ownership */
  deleteAsset(assetId: string, userId: string, tx?: DB): Promise<void>;

  /** Find all capital works for a property, ordered by createdAt desc */
  findCapitalWorksByProperty(propertyId: string, userId: string): Promise<CapitalWork[]>;

  /** Insert a new capital work */
  createCapitalWork(data: NewCapitalWork, tx?: DB): Promise<CapitalWork>;

  /** Update a capital work — returns null if not found or not owned */
  updateCapitalWork(id: string, userId: string, data: Partial<CapitalWork>, tx?: DB): Promise<CapitalWork | null>;

  /** Delete a capital work after verifying ownership */
  deleteCapitalWork(id: string, userId: string, tx?: DB): Promise<void>;

  /** Find all claims for a schedule in a given financial year */
  findClaimsByFY(scheduleId: string, financialYear: number): Promise<DepreciationClaim[]>;

  /** Insert a new depreciation claim */
  createClaim(data: NewDepreciationClaim, tx?: DB): Promise<DepreciationClaim>;

  /** Delete all claims for a schedule in a given financial year */
  deleteClaimsByFY(scheduleId: string, financialYear: number, tx?: DB): Promise<void>;
}
