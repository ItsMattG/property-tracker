import { eq, and, desc, sql } from "drizzle-orm";
import { properties, equityMilestones, propertySales } from "../db/schema";
import type { Property, NewProperty, EquityMilestone, PropertySale, NewPropertySale } from "../db/schema";
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
    data: Partial<Property>,
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

  async findByOwnerWithSales(
    userId: string
  ): Promise<(Property & { sales: PropertySale[] })[]> {
    return this.db.query.properties.findMany({
      where: eq(properties.userId, userId),
      with: { sales: true },
    });
  }

  async findSaleByProperty(
    propertyId: string,
    userId: string
  ): Promise<(PropertySale & { property: Property }) | null> {
    const result = await this.db.query.propertySales.findFirst({
      where: and(
        eq(propertySales.propertyId, propertyId),
        eq(propertySales.userId, userId)
      ),
      with: { property: true },
    });
    return result ?? null;
  }

  async createSale(data: NewPropertySale, tx?: DB): Promise<PropertySale> {
    const client = this.resolve(tx);
    const [sale] = await client.insert(propertySales).values(data).returning();
    return sale;
  }

  async findRecent(
    userId: string,
    limit: number
  ): Promise<Array<{ id: string; address: string; createdAt: Date }>> {
    return this.db.query.properties.findMany({
      where: eq(properties.userId, userId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit,
      columns: {
        id: true,
        address: true,
        createdAt: true,
      },
    });
  }
}
