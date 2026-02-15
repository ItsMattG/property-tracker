import { eq, and, desc, asc } from "drizzle-orm";
import { propertyValues } from "../db/schema";
import type { PropertyValue, NewPropertyValue } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IPropertyValueRepository } from "./interfaces/property-value.repository.interface";

export class PropertyValueRepository
  extends BaseRepository
  implements IPropertyValueRepository
{
  async findByProperty(
    propertyId: string,
    opts?: { limit?: number; orderAsc?: boolean }
  ): Promise<PropertyValue[]> {
    return this.db.query.propertyValues.findMany({
      where: eq(propertyValues.propertyId, propertyId),
      orderBy: opts?.orderAsc
        ? [asc(propertyValues.valueDate)]
        : [desc(propertyValues.valueDate)],
      limit: opts?.limit,
    });
  }

  async findLatestByUser(
    propertyId: string,
    userId: string
  ): Promise<PropertyValue | null> {
    const result = await this.db.query.propertyValues.findFirst({
      where: and(
        eq(propertyValues.propertyId, propertyId),
        eq(propertyValues.userId, userId)
      ),
      orderBy: [desc(propertyValues.valueDate)],
    });
    return result ?? null;
  }

  async findRecent(
    propertyId: string,
    limit: number
  ): Promise<PropertyValue[]> {
    return this.db.query.propertyValues.findMany({
      where: eq(propertyValues.propertyId, propertyId),
      orderBy: [desc(propertyValues.valueDate)],
      limit,
    });
  }

  async create(data: NewPropertyValue, tx?: DB): Promise<PropertyValue> {
    const client = this.resolve(tx);
    const [value] = await client
      .insert(propertyValues)
      .values(data)
      .returning();
    return value;
  }

  async createMany(data: NewPropertyValue[], tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client.insert(propertyValues).values(data);
  }

  async findById(
    id: string,
    userId: string
  ): Promise<PropertyValue | null> {
    const result = await this.db.query.propertyValues.findFirst({
      where: and(
        eq(propertyValues.id, id),
        eq(propertyValues.userId, userId)
      ),
    });
    return result ?? null;
  }

  async delete(id: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(propertyValues)
      .where(eq(propertyValues.id, id));
  }

  async findDatesByProperty(propertyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ valueDate: propertyValues.valueDate })
      .from(propertyValues)
      .where(eq(propertyValues.propertyId, propertyId));
    return rows.map((r) => r.valueDate);
  }
}
