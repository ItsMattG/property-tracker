import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  ExternalServiceError,
  domainErrorToTrpcError,
} from "../domain-errors";

describe("DomainError", () => {
  it("creates error with code and message", () => {
    const error = new NotFoundError("User not found");
    expect(error.message).toBe("User not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it("preserves cause", () => {
    const cause = new Error("original");
    const error = new ExternalServiceError("Basiq failed", "basiq", cause);
    expect(error.cause).toBe(cause);
    expect(error.service).toBe("basiq");
  });
});

describe("domainErrorToTrpcError", () => {
  it("maps NotFoundError to NOT_FOUND", () => {
    const domain = new NotFoundError("User not found");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc).toBeInstanceOf(TRPCError);
    expect(trpc.code).toBe("NOT_FOUND");
    expect(trpc.message).toBe("User not found");
  });

  it("maps ForbiddenError to FORBIDDEN", () => {
    const domain = new ForbiddenError("Insufficient permissions");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("FORBIDDEN");
  });

  it("maps ValidationError to BAD_REQUEST", () => {
    const domain = new ValidationError("Invalid CSV format");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("BAD_REQUEST");
  });

  it("maps ConflictError to CONFLICT", () => {
    const domain = new ConflictError("Already exists");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("CONFLICT");
  });

  it("maps ExternalServiceError to INTERNAL_SERVER_ERROR", () => {
    const domain = new ExternalServiceError("Basiq API error", "basiq");
    const trpc = domainErrorToTrpcError(domain);
    expect(trpc.code).toBe("INTERNAL_SERVER_ERROR");
    expect(trpc.message).toBe("Basiq API error");
  });
});
