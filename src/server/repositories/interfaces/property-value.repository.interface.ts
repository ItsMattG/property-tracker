import type { PropertyValue, NewPropertyValue } from "../../db/schema";
import type { DB } from "../base";

export interface IPropertyValueRepository {
  /** List values for a property, optionally limited, ordered by date desc */
  findByProperty(propertyId: string, opts?: { limit?: number; orderAsc?: boolean }): Promise<PropertyValue[]>;

  /** Get the most recent valuation for a property (user-scoped) */
  findLatestByUser(propertyId: string, userId: string): Promise<PropertyValue | null>;

  /** Get the N most recent valuations for a property */
  findRecent(propertyId: string, limit: number): Promise<PropertyValue[]>;

  /** Insert a new property valuation */
  create(data: NewPropertyValue, tx?: DB): Promise<PropertyValue>;

  /** Insert multiple valuations (batch) */
  createMany(data: NewPropertyValue[], tx?: DB): Promise<void>;

  /** Find a valuation by id scoped to user */
  findById(id: string, userId: string): Promise<PropertyValue | null>;

  /** Delete a valuation */
  delete(id: string, tx?: DB): Promise<void>;

  /** Get existing value dates for a property (for dedup) */
  findDatesByProperty(propertyId: string): Promise<string[]>;
}
