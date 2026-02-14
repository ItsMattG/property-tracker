import { eq, and, desc, sql } from "drizzle-orm";
import { properties, equityMilestones } from "../db/schema";
import type { Property, NewProperty, EquityMilestone } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPropertyRepository } from "./interfaces/property.repository.interface";

export class PropertyRepository
  extends BaseRepository
  implements IPropertyRepository
{
  async findByOwner(
    userId: string,
    opts?: { excludeLocked?: boolean }
  ): Promise<Property[]> {
    const conditions = [eq(properties.userId, userId)];
    if (opts?.excludeLocked) {
      conditions.push(eq(properties.locked, false));
    }

    return this.db.query.properties.findMany({
      where: and(...conditions),
      orderBy: (properties, { desc }) => [desc(properties.createdAt)],
    });
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    const result = await this.db.query.properties.findFirst({
      where: and(eq(properties.id, id), eq(properties.userId, userId)),
    });
    return result ?? null;
  }

  async create(data: NewProperty, tx?: DB): Promise<Property> {
    const client = this.resolve(tx);
    const [property] = await client.insert(properties).values(data).returning();
    return property;
  }

  async update(
    id: string,
    userId: string,
    data: Record<string, unknown>,
    tx?: DB
  ): Promise<Property | null> {
    const client = this.resolve(tx);
    const [property] = await client
      .update(properties)
      .set(data)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)))
      .returning();
    return property ?? null;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(properties)
      .where(and(eq(properties.id, id), eq(properties.userId, userId)));
  }

  async countByOwner(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.userId, userId));
    return result?.count ?? 0;
  }

  async findMilestones(
    propertyId: string,
    userId: string
  ): Promise<EquityMilestone[]> {
    return this.db
      .select()
      .from(equityMilestones)
      .where(
        and(
          eq(equityMilestones.propertyId, propertyId),
          eq(equityMilestones.userId, userId)
        )
      )
      .orderBy(desc(equityMilestones.achievedAt));
  }
}
