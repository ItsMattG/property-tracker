import { randomUUID } from "crypto";
import { formatDate } from "../utils";

export interface ComplianceRecordConfig {
  propertyId: string;
  userId: string;
  requirementId: string;
  completedAt: Date;
  nextDueAt: Date;
  notes?: string;
  documentId?: string;
}

export interface GeneratedComplianceRecord {
  id: string;
  propertyId: string;
  userId: string;
  requirementId: string;
  completedAt: string;
  nextDueAt: string;
  notes: string | null;
  documentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function generateComplianceRecord(
  config: ComplianceRecordConfig
): GeneratedComplianceRecord {
  return {
    id: randomUUID(),
    propertyId: config.propertyId,
    userId: config.userId,
    requirementId: config.requirementId,
    completedAt: formatDate(config.completedAt),
    nextDueAt: formatDate(config.nextDueAt),
    notes: config.notes ?? null,
    documentId: config.documentId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Generate standard compliance records for an Australian rental property.
 */
export function generateStandardComplianceRecords(
  propertyId: string,
  userId: string,
  state: string,
  purchaseDate: Date,
  options?: { includeOverdue?: boolean }
): GeneratedComplianceRecord[] {
  const records: GeneratedComplianceRecord[] = [];
  const now = new Date();

  // Smoke alarms - annual check
  const smokeAlarmDate = new Date(now);
  smokeAlarmDate.setFullYear(smokeAlarmDate.getFullYear() - 1);
  const smokeAlarmDue = new Date(smokeAlarmDate);
  smokeAlarmDue.setFullYear(smokeAlarmDue.getFullYear() + 1);

  // Make one overdue if requested
  if (options?.includeOverdue) {
    smokeAlarmDue.setMonth(smokeAlarmDue.getMonth() - 2);
  }

  records.push(
    generateComplianceRecord({
      propertyId,
      userId,
      requirementId: "smoke_alarms",
      completedAt: smokeAlarmDate,
      nextDueAt: smokeAlarmDue,
    })
  );

  // Gas safety - biennial in VIC
  if (state === "VIC") {
    const gasDate = new Date(now);
    gasDate.setFullYear(gasDate.getFullYear() - 1);
    records.push(
      generateComplianceRecord({
        propertyId,
        userId,
        requirementId: "gas_safety_vic",
        completedAt: gasDate,
        nextDueAt: new Date(gasDate.setFullYear(gasDate.getFullYear() + 2)),
      })
    );
  }

  // Electrical safety - varies by state
  if (state === "QLD") {
    const electricalDate = new Date(now);
    electricalDate.setFullYear(electricalDate.getFullYear() - 2);
    records.push(
      generateComplianceRecord({
        propertyId,
        userId,
        requirementId: "electrical_safety_qld",
        completedAt: electricalDate,
        nextDueAt: new Date(electricalDate.setFullYear(electricalDate.getFullYear() + 5)),
      })
    );
  }

  return records;
}
