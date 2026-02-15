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
  SmsfDetails,
  NewSmsfDetails,
  Beneficiary,
  NewBeneficiary,
  TrustDistribution,
  NewTrustDistribution,
  DistributionAllocation,
  NewDistributionAllocation,
} from "../../db/schema";
import type { DB } from "../base";

/** SmsfContribution with its related member eagerly loaded */
export type SmsfContributionWithMember = SmsfContribution & { member: SmsfMember };

/** SmsfPension with its related member eagerly loaded */
export type SmsfPensionWithMember = SmsfPension & { member: SmsfMember };

/** SmsfMember with its parent entity (subset of fields) */
export type SmsfMemberWithEntity = SmsfMember & {
  entity: { id: string; userId: string; type: string };
};

/** Entity with trust/smsf details and members */
export type EntityWithDetails = Entity & {
  trustDetails: TrustDetails | null;
  smsfDetails: SmsfDetails | null;
  members: EntityMember[];
};

/** Trust distribution with its allocations and beneficiary info */
export type TrustDistributionWithAllocations = TrustDistribution & {
  allocations: (DistributionAllocation & { beneficiary: Beneficiary })[];
};

export interface IComplianceRepository {
  // --- Property compliance ---

  /** Find compliance records for a property scoped to user */
  findByProperty(propertyId: string, userId: string): Promise<ComplianceRecord[]>;

  /** Find all compliance records for a user */
  findByOwner(userId: string): Promise<ComplianceRecord[]>;

  /** Find compliance history for a specific requirement on a property */
  findHistory(propertyId: string, requirementId: string, userId: string): Promise<ComplianceRecord[]>;

  /** Create a compliance record */
  create(data: NewComplianceRecord, tx?: DB): Promise<ComplianceRecord>;

  /** Update a compliance record */
  update(id: string, userId: string, data: Partial<ComplianceRecord>, tx?: DB): Promise<ComplianceRecord>;

  /** Delete a compliance record */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  // --- SMSF Members ---

  /** Find all SMSF members for an entity */
  findSmsfMembers(entityId: string): Promise<SmsfMember[]>;

  /** Find a single SMSF member by ID with its parent entity */
  findSmsfMemberById(id: string): Promise<SmsfMemberWithEntity | null>;

  /** Create an SMSF member */
  createSmsfMember(data: NewSmsfMember, tx?: DB): Promise<SmsfMember>;

  /** Update an SMSF member */
  updateSmsfMember(id: string, data: Partial<SmsfMember>, tx?: DB): Promise<SmsfMember>;

  // --- SMSF Contributions ---

  /** Find contributions for an entity in a financial year, with member relation */
  findSmsfContributions(entityId: string, year: string): Promise<SmsfContributionWithMember[]>;

  /** Find a specific contribution by entity + member + year */
  findSmsfContributionByMemberYear(entityId: string, memberId: string, year: string): Promise<SmsfContribution | null>;

  /** Create an SMSF contribution record */
  createSmsfContribution(data: NewSmsfContribution, tx?: DB): Promise<SmsfContribution>;

  /** Update an SMSF contribution record */
  updateSmsfContribution(id: string, data: Partial<SmsfContribution>, tx?: DB): Promise<SmsfContribution>;

  // --- SMSF Pensions ---

  /** Find pensions for an entity in a financial year, with member relation */
  findSmsfPensions(entityId: string, year: string): Promise<SmsfPensionWithMember[]>;

  /** Find a specific pension by entity + member + year */
  findSmsfPensionByMemberYear(entityId: string, memberId: string, year: string): Promise<SmsfPension | null>;

  /** Create an SMSF pension record */
  createSmsfPension(data: NewSmsfPension, tx?: DB): Promise<SmsfPension>;

  /** Update an SMSF pension record */
  updateSmsfPension(id: string, data: Partial<SmsfPension>, tx?: DB): Promise<SmsfPension>;

  // --- SMSF Audit ---

  /** Find audit items for an entity in a financial year */
  findSmsfAuditItems(entityId: string, year: string): Promise<SmsfAuditItem[]>;

  /** Batch-create audit items */
  createSmsfAuditItems(data: NewSmsfAuditItem[], tx?: DB): Promise<SmsfAuditItem[]>;

  /** Update a single audit item */
  updateSmsfAuditItem(id: string, data: Partial<SmsfAuditItem>, tx?: DB): Promise<SmsfAuditItem>;

  // --- Entities ---

  /** Find all entities for a user with trust/smsf details and members */
  findEntitiesByUser(userId: string): Promise<EntityWithDetails[]>;

  /** Find a single entity by ID scoped to user */
  findEntityById(id: string, userId: string): Promise<EntityWithDetails | null>;

  /** Create an entity */
  createEntity(data: NewEntity, tx?: DB): Promise<Entity>;

  /** Update an entity */
  updateEntity(id: string, userId: string, data: Partial<Entity>, tx?: DB): Promise<Entity>;

  /** Delete an entity */
  deleteEntity(id: string, userId: string, tx?: DB): Promise<void>;

  /** Find an entity member record for a specific user */
  findEntityMemberByUser(entityId: string, userId: string): Promise<EntityMember | null>;

  /** Create trust details for an entity */
  createTrustDetails(data: NewTrustDetails, tx?: DB): Promise<TrustDetails>;

  /** Create SMSF details for an entity */
  createSmsfDetails(data: NewSmsfDetails, tx?: DB): Promise<SmsfDetails>;

  // --- Beneficiaries ---

  /** Find all beneficiaries for an entity */
  findBeneficiaries(entityId: string): Promise<Beneficiary[]>;

  /** Find a single beneficiary by ID */
  findBeneficiaryById(id: string): Promise<Beneficiary | null>;

  /** Create a beneficiary */
  createBeneficiary(data: NewBeneficiary, tx?: DB): Promise<Beneficiary>;

  /** Update a beneficiary */
  updateBeneficiary(id: string, data: Partial<Beneficiary>, tx?: DB): Promise<Beneficiary>;

  // --- Trust Distributions ---

  /** Find all trust distributions for an entity with allocations */
  findTrustDistributions(entityId: string): Promise<TrustDistributionWithAllocations[]>;

  /** Find a single trust distribution by ID with allocations */
  findTrustDistributionById(id: string): Promise<TrustDistributionWithAllocations | null>;

  /** Find a trust distribution for a specific entity and financial year */
  findTrustDistributionByYear(entityId: string, year: string): Promise<TrustDistribution | null>;

  /** Create a trust distribution record */
  createTrustDistribution(data: NewTrustDistribution, tx?: DB): Promise<TrustDistribution>;

  /** Batch-create distribution allocations */
  createDistributionAllocations(data: NewDistributionAllocation[], tx?: DB): Promise<DistributionAllocation[]>;
}
