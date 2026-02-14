import type { ComplianceRecord, NewComplianceRecord } from "../../db/schema";
import type { DB } from "../base";

export interface IComplianceRepository {
  /** Find compliance records for a property scoped to user */
  findByProperty(propertyId: string, userId: string): Promise<ComplianceRecord[]>;

  /** Find all compliance records for a user */
  findByOwner(userId: string): Promise<ComplianceRecord[]>;

  /** Find compliance history for a specific requirement on a property */
  findHistory(propertyId: string, requirementId: string, userId: string): Promise<ComplianceRecord[]>;

  /** Create a compliance record */
  create(data: NewComplianceRecord, tx?: DB): Promise<ComplianceRecord>;

  /** Update a compliance record */
  update(id: string, userId: string, data: Record<string, unknown>, tx?: DB): Promise<ComplianceRecord>;

  /** Delete a compliance record */
  delete(id: string, userId: string, tx?: DB): Promise<void>;
}
