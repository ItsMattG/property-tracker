import { eq, and, desc, asc } from "drizzle-orm";

import {
  complianceRecords,
  smsfMembers,
  smsfContributions,
  smsfPensions,
  smsfAuditItems,
  entities,
  entityMembers,
  trustDetails,
  smsfDetails,
  beneficiaries,
  trustDistributions,
  distributionAllocations,
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
  Entity,
  NewEntity,
  EntityMember,
  TrustDetails,
  NewTrustDetails,
  SmsfDetails as SmsfDetailsType,
  NewSmsfDetails,
  Beneficiary,
  NewBeneficiary,
  TrustDistribution,
  NewTrustDistribution,
  DistributionAllocation,
  NewDistributionAllocation,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IComplianceRepository,
  SmsfContributionWithMember,
  SmsfPensionWithMember,
  SmsfMemberWithEntity,
  EntityWithDetails,
  TrustDistributionWithAllocations,
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

  // --- Entities ---

  async findEntitiesByUser(userId: string): Promise<EntityWithDetails[]> {
    return this.db.query.entities.findMany({
      where: eq(entities.userId, userId),
      with: { trustDetails: true, smsfDetails: true, members: true },
      orderBy: (e, { desc: d }) => [d(e.createdAt)],
    }) as Promise<EntityWithDetails[]>;
  }

  async findEntityById(
    id: string,
    userId: string
  ): Promise<EntityWithDetails | null> {
    const result = await this.db.query.entities.findFirst({
      where: and(eq(entities.id, id), eq(entities.userId, userId)),
      with: { trustDetails: true, smsfDetails: true, members: true },
    });
    return (result as EntityWithDetails) ?? null;
  }

  async createEntity(data: NewEntity, tx?: DB): Promise<Entity> {
    const client = this.resolve(tx);
    const [entity] = await client.insert(entities).values(data).returning();
    return entity;
  }

  async updateEntity(
    id: string,
    userId: string,
    data: Partial<Entity>,
    tx?: DB
  ): Promise<Entity> {
    const client = this.resolve(tx);
    const [entity] = await client
      .update(entities)
      .set(data)
      .where(and(eq(entities.id, id), eq(entities.userId, userId)))
      .returning();
    return entity;
  }

  async deleteEntity(id: string, userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(entities)
      .where(and(eq(entities.id, id), eq(entities.userId, userId)));
  }

  async findEntityMemberByUser(
    entityId: string,
    userId: string
  ): Promise<EntityMember | null> {
    const result = await this.db.query.entityMembers.findFirst({
      where: and(
        eq(entityMembers.entityId, entityId),
        eq(entityMembers.userId, userId)
      ),
    });
    return result ?? null;
  }

  async createTrustDetails(
    data: NewTrustDetails,
    tx?: DB
  ): Promise<TrustDetails> {
    const client = this.resolve(tx);
    const [details] = await client
      .insert(trustDetails)
      .values(data)
      .returning();
    return details;
  }

  async createSmsfDetails(
    data: NewSmsfDetails,
    tx?: DB
  ): Promise<SmsfDetailsType> {
    const client = this.resolve(tx);
    const [details] = await client
      .insert(smsfDetails)
      .values(data)
      .returning();
    return details;
  }

  // --- Beneficiaries ---

  async findBeneficiaries(entityId: string): Promise<Beneficiary[]> {
    return this.db.query.beneficiaries.findMany({
      where: eq(beneficiaries.entityId, entityId),
      orderBy: (b, { asc: a }) => [a(b.name)],
    });
  }

  async findBeneficiaryById(id: string): Promise<Beneficiary | null> {
    const result = await this.db.query.beneficiaries.findFirst({
      where: eq(beneficiaries.id, id),
    });
    return result ?? null;
  }

  async createBeneficiary(
    data: NewBeneficiary,
    tx?: DB
  ): Promise<Beneficiary> {
    const client = this.resolve(tx);
    const [beneficiary] = await client
      .insert(beneficiaries)
      .values(data)
      .returning();
    return beneficiary;
  }

  async updateBeneficiary(
    id: string,
    data: Partial<Beneficiary>,
    tx?: DB
  ): Promise<Beneficiary> {
    const client = this.resolve(tx);
    const [beneficiary] = await client
      .update(beneficiaries)
      .set(data)
      .where(eq(beneficiaries.id, id))
      .returning();
    return beneficiary;
  }

  // --- Trust Distributions ---

  async findTrustDistributions(
    entityId: string
  ): Promise<TrustDistributionWithAllocations[]> {
    return this.db.query.trustDistributions.findMany({
      where: eq(trustDistributions.entityId, entityId),
      with: { allocations: { with: { beneficiary: true } } },
      orderBy: (td, { desc: d }) => [d(td.financialYear)],
    }) as Promise<TrustDistributionWithAllocations[]>;
  }

  async findTrustDistributionById(
    id: string
  ): Promise<TrustDistributionWithAllocations | null> {
    const result = await this.db.query.trustDistributions.findFirst({
      where: eq(trustDistributions.id, id),
      with: { allocations: { with: { beneficiary: true } } },
    });
    return (result as TrustDistributionWithAllocations) ?? null;
  }

  async findTrustDistributionByYear(
    entityId: string,
    year: string
  ): Promise<TrustDistribution | null> {
    const result = await this.db.query.trustDistributions.findFirst({
      where: and(
        eq(trustDistributions.entityId, entityId),
        eq(trustDistributions.financialYear, year)
      ),
    });
    return result ?? null;
  }

  async createTrustDistribution(
    data: NewTrustDistribution,
    tx?: DB
  ): Promise<TrustDistribution> {
    const client = this.resolve(tx);
    const [distribution] = await client
      .insert(trustDistributions)
      .values(data)
      .returning();
    return distribution;
  }

  async createDistributionAllocations(
    data: NewDistributionAllocation[],
    tx?: DB
  ): Promise<DistributionAllocation[]> {
    const client = this.resolve(tx);
    return client
      .insert(distributionAllocations)
      .values(data)
      .returning();
  }
}
