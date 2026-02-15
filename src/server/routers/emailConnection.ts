import { z } from "zod";
import { router, proProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { emailConnections } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { syncUserEmails } from "../services/email";

export const emailConnectionRouter = router({
  /**
   * Lists all email connections for the current user.
   */
  list: proProcedure.query(async ({ ctx }) => {
    const connections = await db
      .select({
        id: emailConnections.id,
        provider: emailConnections.provider,
        emailAddress: emailConnections.emailAddress,
        status: emailConnections.status,
        lastSyncAt: emailConnections.lastSyncAt,
        lastError: emailConnections.lastError,
        createdAt: emailConnections.createdAt,
      })
      .from(emailConnections)
      .where(eq(emailConnections.userId, ctx.user.id));

    return connections;
  }),

  /**
   * Gets a specific email connection.
   */
  get: proProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [connection] = await db
        .select({
          id: emailConnections.id,
          provider: emailConnections.provider,
          emailAddress: emailConnections.emailAddress,
          status: emailConnections.status,
          lastSyncAt: emailConnections.lastSyncAt,
          lastError: emailConnections.lastError,
          pushExpiresAt: emailConnections.pushExpiresAt,
          createdAt: emailConnections.createdAt,
          updatedAt: emailConnections.updatedAt,
        })
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.id),
            eq(emailConnections.userId, ctx.user.id)
          )
        );

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email connection not found",
        });
      }

      return connection;
    }),

  /**
   * Disconnects an email account.
   */
  disconnect: proProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select({ id: emailConnections.id })
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.id),
            eq(emailConnections.userId, ctx.user.id)
          )
        );

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email connection not found",
        });
      }

      await db
        .update(emailConnections)
        .set({
          status: "disconnected",
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, input.id));

      return { success: true };
    }),

  /**
   * Permanently deletes an email connection.
   */
  delete: proProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [connection] = await db
        .select({ id: emailConnections.id })
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.id, input.id),
            eq(emailConnections.userId, ctx.user.id)
          )
        );

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email connection not found",
        });
      }

      await db
        .delete(emailConnections)
        .where(eq(emailConnections.id, input.id));

      return { success: true };
    }),

  /**
   * Triggers a manual sync for all user's email connections.
   */
  syncNow: proProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await syncUserEmails(ctx.user.id);
      return {
        success: true,
        synced: result.total,
        errors: result.errors,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error ? error.message : "Failed to sync emails",
      });
    }
  }),
});
