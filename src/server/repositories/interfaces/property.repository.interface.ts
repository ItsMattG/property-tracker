import type { Property, NewProperty, EquityMilestone } from "../../db/schema";
import type { DB } from "../base";

export interface IPropertyRepository {
  /** List properties for a user, optionally excluding locked properties */
  findByOwner(userId: string, opts?: { excludeLocked?: boolean }): Promise<Property[]>;

  /** Get a single property by id scoped to user */
  findById(id: string, userId: string): Promise<Property | null>;

  /** Insert a new property */
  create(data: NewProperty, tx?: DB): Promise<Property>;

  /** Update a property's fields — returns null if no matching property */
  update(id: string, userId: string, data: Record<string, unknown>, tx?: DB): Promise<Property | null>;

  /** Delete a property */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Count properties for a user */
  countByOwner(userId: string): Promise<number>;

  /** Get equity milestones for a property */
  findMilestones(propertyId: string, userId: string): Promise<EquityMilestone[]>;
}
