import { TRPCError } from "@trpc/server";

export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "EXTERNAL_SERVICE"
  | "PRECONDITION_FAILED";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.code = code;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("NOT_FOUND", message, cause);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("FORBIDDEN", message, cause);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("VALIDATION", message, cause);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super("CONFLICT", message, cause);
  }
}

export class ExternalServiceError extends DomainError {
  readonly service: string;

  constructor(message: string, service: string, cause?: unknown) {
    super("EXTERNAL_SERVICE", message, cause);
    this.service = service;
  }
}

const DOMAIN_TO_TRPC_CODE: Record<DomainErrorCode, TRPCError["code"]> = {
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  EXTERNAL_SERVICE: "INTERNAL_SERVER_ERROR",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",
};

/**
 * Convert a DomainError to a TRPCError for the transport layer.
 * Use this in routers to catch service-layer domain errors.
 */
export function domainErrorToTrpcError(error: DomainError): TRPCError {
  return new TRPCError({
    code: DOMAIN_TO_TRPC_CODE[error.code],
    message: error.message,
    cause: error.cause,
  });
}
