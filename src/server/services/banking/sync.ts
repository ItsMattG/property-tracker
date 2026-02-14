export const RATE_LIMIT_MINUTES = 15;

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: Date;
  message?: string;
}

export function checkRateLimit(lastManualSyncAt: Date | null): RateLimitResult {
  if (!lastManualSyncAt) {
    return { allowed: true };
  }

  const now = new Date();
  const diffMs = now.getTime() - lastManualSyncAt.getTime();
  const diffMinutes = diffMs / (60 * 1000);

  if (diffMinutes >= RATE_LIMIT_MINUTES) {
    return { allowed: true };
  }

  const retryAfter = calculateRetryAfter(lastManualSyncAt);
  const remainingMinutes = Math.ceil(RATE_LIMIT_MINUTES - diffMinutes);

  return {
    allowed: false,
    retryAfter,
    message: `Please wait ${remainingMinutes} minutes before syncing again`,
  };
}

export function calculateRetryAfter(lastManualSyncAt: Date): Date {
  return new Date(lastManualSyncAt.getTime() + RATE_LIMIT_MINUTES * 60 * 1000);
}

export type AlertType = "disconnected" | "requires_reauth" | "sync_failed";

export function mapBasiqErrorToAlertType(statusCode: number): AlertType {
  if (statusCode === 401 || statusCode === 403) {
    return "requires_reauth";
  }
  if (statusCode === 408 || statusCode === 504) {
    return "disconnected";
  }
  return "sync_failed";
}

export function mapAlertTypeToConnectionStatus(alertType: AlertType): "disconnected" | "error" {
  if (alertType === "disconnected") {
    return "disconnected";
  }
  return "error";
}
