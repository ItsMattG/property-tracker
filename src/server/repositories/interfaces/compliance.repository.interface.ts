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
}
