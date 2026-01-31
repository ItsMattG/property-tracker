import { TRPCClientError } from "@trpc/client";

/**
 * Extracts a user-friendly error message from various error types.
 * Handles tRPC errors, standard Error objects, and unknown error types.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "An unexpected error occurred";
}
