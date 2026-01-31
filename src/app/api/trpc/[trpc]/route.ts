import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError: ({ error, path }) => {
      // TRPCErrors are intentional application errors - pass through unchanged
      if (error.code !== "INTERNAL_SERVER_ERROR") {
        return;
      }

      // Database/unknown errors - generate ID, log full details, sanitize message
      const errorId = randomUUID().slice(0, 8);

      logger.error(
        "Unhandled API error",
        error,
        {
          errorId,
          path,
          causeMessage: error.cause instanceof Error ? error.cause.message : String(error.cause ?? ""),
        }
      );

      // Replace error message with sanitized version
      // The error object is mutable, so this affects what gets sent to client
      error.message = `Something went wrong (Error ID: ${errorId})`;
    },
  });

export { handler as GET, handler as POST };
