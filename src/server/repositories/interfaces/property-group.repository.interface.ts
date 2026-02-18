import type { PropertyGroup, NewPropertyGroup } from "../../db/schema";

export interface PropertyGroupWithCount extends PropertyGroup {
  propertyCount: number;
}

export interface IPropertyGroupRepository {
  /** List all groups for a user, with property counts, ordered by sortOrder */
  findByOwner(userId: string): Promise<PropertyGroupWithCount[]>;

  /** Find a single group by ID, scoped to user */
  findById(id: string, userId: string): Promise<PropertyGroup | null>;

  /** Find all groups that a property belongs to */
  findByProperty(propertyId: string, userId: string): Promise<PropertyGroup[]>;

  /** Count groups owned by a user */
  countByOwner(userId: string): Promise<number>;

  /** Create a new property group */
  create(data: NewPropertyGroup): Promise<PropertyGroup>;

  /** Update a group (partial), scoped to user */
  update(
    id: string,
    userId: string,
    data: Partial<PropertyGroup>
  ): Promise<PropertyGroup | null>;

  /** Delete a group, scoped to user */
  delete(id: string, userId: string): Promise<void>;

  /** Assign properties to a group (idempotent) */
  assignProperties(groupId: string, propertyIds: string[]): Promise<void>;

  /** Remove properties from a group */
  unassignProperties(groupId: string, propertyIds: string[]): Promise<void>;

  /** Get all property IDs assigned to a group */
  getPropertyIds(groupId: string): Promise<string[]>;
}
