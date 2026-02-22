import { eq, and, sql, inArray, asc } from "drizzle-orm";
import { propertyGroups, propertyGroupAssignments } from "../db/schema";
import type { PropertyGroup, NewPropertyGroup } from "../db/schema";
import { BaseRepository } from "./base";
import type {
  IPropertyGroupRepository,
  PropertyGroupWithCount,
} from "./interfaces/property-group.repository.interface";

export class PropertyGroupRepository
  extends BaseRepository
  implements IPropertyGroupRepository
{
  async findByOwner(userId: string): Promise<PropertyGroupWithCount[]> {
    return this.db
      .select({
        id: propertyGroups.id,
        userId: propertyGroups.userId,
        name: propertyGroups.name,
        colour: propertyGroups.colour,
        sortOrder: propertyGroups.sortOrder,
        createdAt: propertyGroups.createdAt,
        updatedAt: propertyGroups.updatedAt,
        propertyCount: sql<number>`count(${propertyGroupAssignments.propertyId})::int`,
      })
      .from(propertyGroups)
      .leftJoin(
        propertyGroupAssignments,
        eq(propertyGroups.id, propertyGroupAssignments.groupId)
      )
      .where(eq(propertyGroups.userId, userId))
      .groupBy(propertyGroups.id)
      .orderBy(asc(propertyGroups.sortOrder));
  }

  async findById(id: string, userId: string): Promise<PropertyGroup | null> {
    const result = await this.db.query.propertyGroups.findFirst({
      where: and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)),
    });
    return result ?? null;
  }

  async findByProperty(
    propertyId: string,
    userId: string
  ): Promise<PropertyGroup[]> {
    return this.db
      .select({
        id: propertyGroups.id,
        userId: propertyGroups.userId,
        name: propertyGroups.name,
        colour: propertyGroups.colour,
        sortOrder: propertyGroups.sortOrder,
        createdAt: propertyGroups.createdAt,
        updatedAt: propertyGroups.updatedAt,
      })
      .from(propertyGroups)
      .innerJoin(
        propertyGroupAssignments,
        eq(propertyGroups.id, propertyGroupAssignments.groupId)
      )
      .where(
        and(
          eq(propertyGroupAssignments.propertyId, propertyId),
          eq(propertyGroups.userId, userId)
        )
      )
      .orderBy(asc(propertyGroups.sortOrder));
  }

  async countByOwner(userId: string): Promise<number> {
    const [result] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(propertyGroups)
      .where(eq(propertyGroups.userId, userId));
    return result?.count ?? 0;
  }

  async create(data: NewPropertyGroup): Promise<PropertyGroup> {
    const [created] = await this.db
      .insert(propertyGroups)
      .values(data)
      .returning();
    return created;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<PropertyGroup>
  ): Promise<PropertyGroup | null> {
    const [updated] = await this.db
      .update(propertyGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(propertyGroups)
      .where(and(eq(propertyGroups.id, id), eq(propertyGroups.userId, userId)));
  }

  async assignProperties(
    groupId: string,
    propertyIds: string[]
  ): Promise<void> {
    if (propertyIds.length === 0) return;
    await this.db
      .insert(propertyGroupAssignments)
      .values(propertyIds.map((propertyId) => ({ groupId, propertyId })))
      .onConflictDoNothing();
  }

  async unassignProperties(
    groupId: string,
    propertyIds: string[]
  ): Promise<void> {
    if (propertyIds.length === 0) return;
    await this.db
      .delete(propertyGroupAssignments)
      .where(
        and(
          eq(propertyGroupAssignments.groupId, groupId),
          inArray(propertyGroupAssignments.propertyId, propertyIds)
        )
      );
  }

  async getPropertyIds(groupId: string): Promise<string[]> {
    const rows = await this.db
      .select({ propertyId: propertyGroupAssignments.propertyId })
      .from(propertyGroupAssignments)
      .where(eq(propertyGroupAssignments.groupId, groupId));
    return rows.map((r) => r.propertyId);
  }
}
