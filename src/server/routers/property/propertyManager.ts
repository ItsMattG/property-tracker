// src/server/routers/property/propertyManager.ts

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  propertyManagerConnections,
  propertyManagerMappings,
  propertyManagerSyncLogs,
  properties,
} from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getPropertyMeProvider } from "../../services/property-manager/propertyme";
import { PropertyManagerSyncService } from "../../services/property-manager/sync";
import { randomUUID } from "crypto";
import { decrypt } from "@/lib/encryption";

const providerSchema = z.enum(["propertyme", "different"]);

export const propertyManagerRouter = router({
  getAuthUrl: protectedProcedure
    .input(z.object({ provider: providerSchema }))
    .mutation(({ ctx, input }) => {
      if (input.provider !== "propertyme") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider not supported yet",
        });
      }

      const provider = getPropertyMeProvider();
      // Encode user ID + nonce in state for CSRF protection
      const nonce = randomUUID();
      const state = Buffer.from(`${ctx.user.id}:${nonce}`).toString("base64url");
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/propertyme/callback`;
      const url = provider.getAuthUrl(redirectUri, state);

      return { url, state };
    }),

  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.db.query.propertyManagerConnections.findMany({
      where: eq(propertyManagerConnections.userId, ctx.portfolio.ownerId),
      with: {
        mappings: true,
      },
    });

    return connections.map((c) => ({
      id: c.id,
      provider: c.provider,
      status: c.status,
      lastSyncAt: c.lastSyncAt,
      mappingsCount: c.mappings.length,
      createdAt: c.createdAt,
    }));
  }),

  getConnection: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
        with: {
          mappings: {
            with: {
              property: true,
            },
          },
          syncLogs: {
            orderBy: [desc(propertyManagerSyncLogs.startedAt)],
            limit: 10,
          },
        },
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      return connection;
    }),

  fetchProviderProperties: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      if (connection.provider !== "propertyme") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Provider not supported",
        });
      }

      const provider = getPropertyMeProvider();
      const pmProperties = await provider.getProperties(decrypt(connection.accessToken));

      // Upsert mappings
      for (const pmProp of pmProperties) {
        const existing = await ctx.db.query.propertyManagerMappings.findFirst({
          where: and(
            eq(propertyManagerMappings.connectionId, connection.id),
            eq(propertyManagerMappings.providerPropertyId, pmProp.id)
          ),
        });

        if (!existing) {
          await ctx.db.insert(propertyManagerMappings).values({
            connectionId: connection.id,
            providerPropertyId: pmProp.id,
            providerPropertyAddress: pmProp.address,
          });
        }
      }

      return { count: pmProperties.length };
    }),

  updateMapping: writeProcedure
    .input(
      z.object({
        mappingId: z.string().uuid(),
        propertyId: z.string().uuid().nullable(),
        autoSync: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mapping = await ctx.db.query.propertyManagerMappings.findFirst({
        where: eq(propertyManagerMappings.id, input.mappingId),
        with: {
          connection: true,
        },
      });

      if (!mapping || mapping.connection.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mapping not found",
        });
      }

      // Verify property belongs to user
      if (input.propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      await ctx.db
        .update(propertyManagerMappings)
        .set({
          propertyId: input.propertyId,
          autoSync: input.autoSync ?? mapping.autoSync,
          updatedAt: new Date(),
        })
        .where(eq(propertyManagerMappings.id, input.mappingId));

      return { success: true };
    }),

  sync: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      // Create sync log
      const [syncLog] = await ctx.db
        .insert(propertyManagerSyncLogs)
        .values({
          connectionId: connection.id,
          syncType: "manual",
          status: "running",
        })
        .returning();

      try {
        const provider = getPropertyMeProvider();
        const syncService = new PropertyManagerSyncService(provider, ctx.db as any);

        const result = await syncService.runFullSync(
          decrypt(connection.accessToken),
          connection.id,
          ctx.portfolio.ownerId,
          connection.lastSyncAt || undefined
        );

        const totalCreated =
          result.rentPayments.created +
          result.maintenanceJobs.created +
          result.bills.created;

        const totalItems =
          result.rentPayments.created +
          result.rentPayments.skipped +
          result.maintenanceJobs.created +
          result.maintenanceJobs.skipped +
          result.bills.created +
          result.bills.skipped;

        // Update sync log
        await ctx.db
          .update(propertyManagerSyncLogs)
          .set({
            status: "completed",
            itemsSynced: String(totalItems),
            transactionsCreated: String(totalCreated),
            completedAt: new Date(),
          })
          .where(eq(propertyManagerSyncLogs.id, syncLog.id));

        // Update connection lastSyncAt
        await ctx.db
          .update(propertyManagerConnections)
          .set({
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(propertyManagerConnections.id, connection.id));

        return {
          success: true,
          transactionsCreated: totalCreated,
          itemsSynced: totalItems,
        };
      } catch (error) {
        await ctx.db
          .update(propertyManagerSyncLogs)
          .set({
            status: "failed",
            errors: JSON.stringify([
              error instanceof Error ? error.message : "Unknown error",
            ]),
            completedAt: new Date(),
          })
          .where(eq(propertyManagerSyncLogs.id, syncLog.id));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Sync failed",
          cause: error,
        });
      }
    }),

  disconnect: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.db.query.propertyManagerConnections.findFirst({
        where: and(
          eq(propertyManagerConnections.id, input.connectionId),
          eq(propertyManagerConnections.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connection not found",
        });
      }

      await ctx.db
        .update(propertyManagerConnections)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(propertyManagerConnections.id, connection.id));

      return { success: true };
    }),
});
