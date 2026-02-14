import { eq, and, desc } from "drizzle-orm";
import { complianceRecords } from "../db/schema";
import type { ComplianceRecord, NewComplianceRecord } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type { IComplianceRepository } from "./interfaces/compliance.repository.interface";

export class ComplianceRepository
  extends BaseRepository
  implements IComplianceRepository
{
  async findByProperty(
    propertyId: string,
    userId: string
  ): Promise<ComplianceRecord[]> {
    return this.db.query.complianceRecords.findMany({
      where: and(
        eq(complianceRecords.propertyId, propertyId),
        eq(complianceRecords.userId, userId)
      ),
      orderBy: [desc(complianceRecords.completedAt)],
    });
  }

  async findByOwner(userId: string): Promise<ComplianceRecord[]> {
    return this.db.query.complianceRecords.findMany({
      where: eq(complianceRecords.userId, userId),
      orderBy: [desc(complianceRecords.nextDueAt)],
    });
  }

  async findHistory(
    propertyId: string,
    requirementId: string,
    userId: string
  ): Promise<ComplianceRecord[]> {
    return this.db.query.complianceRecords.findMany({
      where: and(
        eq(complianceRecords.propertyId, propertyId),
        eq(complianceRecords.requirementId, requirementId),
        eq(complianceRecords.userId, userId)
      ),
      orderBy: [desc(complianceRecords.completedAt)],
      with: {
        document: true,
      },
    }) as Promise<ComplianceRecord[]>;
  }

  async create(
    data: NewComplianceRecord,
    tx?: DB
  ): Promise<ComplianceRecord> {
    const client = this.resolve(tx);
    const [record] = await client
      .insert(complianceRecords)
      .values(data)
      .returning();
    return record;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<ComplianceRecord>,
    tx?: DB
  ): Promise<ComplianceRecord> {
    const client = this.resolve(tx);
    const [record] = await client
      .update(complianceRecords)
      .set(data)
      .where(
        and(
          eq(complianceRecords.id, id),
          eq(complianceRecords.userId, userId)
        )
      )
      .returning();
    return record;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(complianceRecords)
      .where(
        and(
          eq(complianceRecords.id, id),
          eq(complianceRecords.userId, userId)
        )
      );
  }
}
