import { randomUUID } from "crypto";

export interface AnomalyAlertConfig {
  userId: string;
  propertyId?: string;
  alertType: "missed_rent" | "unusual_amount" | "unexpected_expense" | "duplicate_transaction";
  severity: "info" | "warning" | "critical";
  description: string;
  suggestedAction?: string;
  transactionId?: string;
  recurringId?: string;
  expectedTransactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedAnomalyAlert {
  id: string;
  userId: string;
  propertyId: string | null;
  alertType: "missed_rent" | "unusual_amount" | "unexpected_expense" | "duplicate_transaction";
  severity: "info" | "warning" | "critical";
  transactionId: string | null;
  recurringId: string | null;
  expectedTransactionId: string | null;
  description: string;
  suggestedAction: string | null;
  metadata: string | null;
  status: "active" | "dismissed" | "resolved";
  dismissalCount: string;
  createdAt: Date;
  dismissedAt: Date | null;
  resolvedAt: Date | null;
}

export function generateAnomalyAlert(config: AnomalyAlertConfig): GeneratedAnomalyAlert {
  return {
    id: randomUUID(),
    userId: config.userId,
    propertyId: config.propertyId ?? null,
    alertType: config.alertType,
    severity: config.severity,
    transactionId: config.transactionId ?? null,
    recurringId: config.recurringId ?? null,
    expectedTransactionId: config.expectedTransactionId ?? null,
    description: config.description,
    suggestedAction: config.suggestedAction ?? null,
    metadata: config.metadata ? JSON.stringify(config.metadata) : null,
    status: "active",
    dismissalCount: "0",
    createdAt: new Date(),
    dismissedAt: null,
    resolvedAt: null,
  };
}

export interface ConnectionAlertConfig {
  userId: string;
  bankAccountId: string;
  alertType: "disconnected" | "requires_reauth" | "sync_failed";
  errorMessage?: string;
}

export interface GeneratedConnectionAlert {
  id: string;
  userId: string;
  bankAccountId: string;
  alertType: "disconnected" | "requires_reauth" | "sync_failed";
  status: "active" | "dismissed" | "resolved";
  errorMessage: string | null;
  emailSentAt: Date | null;
  createdAt: Date;
  dismissedAt: Date | null;
  resolvedAt: Date | null;
}

export function generateConnectionAlert(config: ConnectionAlertConfig): GeneratedConnectionAlert {
  return {
    id: randomUUID(),
    userId: config.userId,
    bankAccountId: config.bankAccountId,
    alertType: config.alertType,
    status: "active",
    errorMessage: config.errorMessage ?? null,
    emailSentAt: null,
    createdAt: new Date(),
    dismissedAt: null,
    resolvedAt: null,
  };
}
