import { eq, and, desc, asc } from "drizzle-orm";

import {
  complianceRecords,
  smsfMembers,
  smsfContributions,
  smsfPensions,
  smsfAuditItems,
} from "../db/schema";
import type {
  ComplianceRecord,
  NewComplianceRecord,
  SmsfMember,
  NewSmsfMember,
  SmsfContribution,
  NewSmsfContribution,
  SmsfPension,
  NewSmsfPension,
  SmsfAuditItem,
  NewSmsfAuditItem,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IComplianceRepository,
  SmsfContributionWithMember,
  SmsfPensionWithMember,
  SmsfMemberWithEntity,
} from "./interfaces/compliance.repository.interface";

export class ComplianceRepository
  extends BaseRepository
  implements IComplianceRepository
{
  // --- Property compliance ---

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

  // --- SMSF Members ---

  async findSmsfMembers(entityId: string): Promise<SmsfMember[]> {
    return this.db.query.smsfMembers.findMany({
      where: eq(smsfMembers.entityId, entityId),
      orderBy: [asc(smsfMembers.name)],
    });
  }

  async findSmsfMemberById(id: string): Promise<SmsfMemberWithEntity | null> {
    const result = await this.db.query.smsfMembers.findFirst({
      where: eq(smsfMembers.id, id),
      with: { entity: true },
    });
    if (!result) return null;
    // The entity relation includes all fields; narrow to the interface shape
    return result as SmsfMemberWithEntity;
  }

  async createSmsfMember(data: NewSmsfMember, tx?: DB): Promise<SmsfMember> {
    const client = this.resolve(tx);
    const [member] = await client
      .insert(smsfMembers)
      .values(data)
      .returning();
    return member;
  }

  async updateSmsfMember(
    id: string,
    data: Partial<SmsfMember>,
    tx?: DB
  ): Promise<SmsfMember> {
    const client = this.resolve(tx);
    const [member] = await client
      .update(smsfMembers)
      .set(data)
      .where(eq(smsfMembers.id, id))
      .returning();
    return member;
  }

  // --- SMSF Contributions ---

  async findSmsfContributions(
    entityId: string,
    year: string
  ): Promise<SmsfContributionWithMember[]> {
    const results = await this.db.query.smsfContributions.findMany({
      where: and(
        eq(smsfContributions.entityId, entityId),
        eq(smsfContributions.financialYear, year)
      ),
      with: { member: true },
    });
    return results as SmsfContributionWithMember[];
  }

  async findSmsfContributionByMemberYear(
    entityId: string,
    memberId: string,
    year: string
  ): Promise<SmsfContribution | null> {
    const result = await this.db.query.smsfContributions.findFirst({
      where: and(
        eq(smsfContributions.entityId, entityId),
        eq(smsfContributions.memberId, memberId),
        eq(smsfContributions.financialYear, year)
      ),
    });
    return result ?? null;
  }

  async createSmsfContribution(
    data: NewSmsfContribution,
    tx?: DB
  ): Promise<SmsfContribution> {
    const client = this.resolve(tx);
    const [contribution] = await client
      .insert(smsfContributions)
      .values(data)
      .returning();
    return contribution;
  }

  async updateSmsfContribution(
    id: string,
    data: Partial<SmsfContribution>,
    tx?: DB
  ): Promise<SmsfContribution> {
    const client = this.resolve(tx);
    const [contribution] = await client
      .update(smsfContributions)
      .set(data)
      .where(eq(smsfContributions.id, id))
      .returning();
    return contribution;
  }

  // --- SMSF Pensions ---

  async findSmsfPensions(
    entityId: string,
    year: string
  ): Promise<SmsfPensionWithMember[]> {
    const results = await this.db.query.smsfPensions.findMany({
      where: and(
        eq(smsfPensions.entityId, entityId),
        eq(smsfPensions.financialYear, year)
      ),
      with: { member: true },
    });
    return results as SmsfPensionWithMember[];
  }

  async findSmsfPensionByMemberYear(
    entityId: string,
    memberId: string,
    year: string
  ): Promise<SmsfPension | null> {
    const result = await this.db.query.smsfPensions.findFirst({
      where: and(
        eq(smsfPensions.entityId, entityId),
        eq(smsfPensions.memberId, memberId),
        eq(smsfPensions.financialYear, year)
      ),
    });
    return result ?? null;
  }

  async createSmsfPension(
    data: NewSmsfPension,
    tx?: DB
  ): Promise<SmsfPension> {
    const client = this.resolve(tx);
    const [pension] = await client
      .insert(smsfPensions)
      .values(data)
      .returning();
    return pension;
  }

  async updateSmsfPension(
    id: string,
    data: Partial<SmsfPension>,
    tx?: DB
  ): Promise<SmsfPension> {
    const client = this.resolve(tx);
    const [pension] = await client
      .update(smsfPensions)
      .set(data)
      .where(eq(smsfPensions.id, id))
      .returning();
    return pension;
  }

  // --- SMSF Audit ---

  async findSmsfAuditItems(
    entityId: string,
    year: string
  ): Promise<SmsfAuditItem[]> {
    return this.db.query.smsfAuditItems.findMany({
      where: and(
        eq(smsfAuditItems.entityId, entityId),
        eq(smsfAuditItems.financialYear, year)
      ),
    });
  }

  async createSmsfAuditItems(
    data: NewSmsfAuditItem[],
    tx?: DB
  ): Promise<SmsfAuditItem[]> {
    const client = this.resolve(tx);
    return client
      .insert(smsfAuditItems)
      .values(data)
      .returning();
  }

  async updateSmsfAuditItem(
    id: string,
    data: Partial<SmsfAuditItem>,
    tx?: DB
  ): Promise<SmsfAuditItem> {
    const client = this.resolve(tx);
    const [item] = await client
      .update(smsfAuditItems)
      .set(data)
      .where(eq(smsfAuditItems.id, id))
      .returning();
    return item;
  }
}
