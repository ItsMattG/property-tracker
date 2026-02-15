import type {
  TaxProfile, NewTaxProfile, TaxSuggestion,
  DepreciationSchedule, DepreciationAsset, NewDepreciationAsset,
  MerchantCategory, Property,
} from "../../db/schema";
import type { DB } from "../base";

export type TaxSuggestionWithProperty = TaxSuggestion & {
  property: Property | null;
};

export type DepreciationScheduleWithRelations = DepreciationSchedule & {
  property: Property | null;
  assets: DepreciationAsset[];
  document: { id: string; name: string; storagePath: string } | null;
};

export interface ITaxRepository {
  findProfileByUserAndYear(userId: string, financialYear: number): Promise<TaxProfile | null>;
  createProfile(data: NewTaxProfile, tx?: DB): Promise<TaxProfile>;
  updateProfile(id: string, data: Partial<TaxProfile>, tx?: DB): Promise<TaxProfile>;

  findSuggestions(userId: string, financialYear: string, status: string): Promise<TaxSuggestionWithProperty[]>;
  countActiveSuggestions(userId: string): Promise<number>;
  updateSuggestionStatus(id: string, userId: string, status: string, tx?: DB): Promise<TaxSuggestion | null>;
  actionSuggestionsByPropertyAndType(userId: string, propertyId: string, type: string, tx?: DB): Promise<void>;

  findSchedules(userId: string, propertyId?: string): Promise<DepreciationScheduleWithRelations[]>;
  createSchedule(data: { propertyId: string; userId: string; documentId: string; effectiveDate: string; totalValue: string }, tx?: DB): Promise<DepreciationSchedule>;
  deleteSchedule(id: string, userId: string, tx?: DB): Promise<void>;
  createAssets(assets: NewDepreciationAsset[], tx?: DB): Promise<DepreciationAsset[]>;

  findMerchantCategories(userId: string): Promise<MerchantCategory[]>;
  countCategorizationExamples(userId: string): Promise<number>;
}
