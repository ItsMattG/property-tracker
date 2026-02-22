import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
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
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provider not supported yet" });
      }
      const provider = getPropertyMeProvider();
      const nonce = randomUUID();
      const state = Buffer.from(`${ctx.user.id}:${nonce}`).toString("base64url");
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/propertyme/callback`;
      const url = provider.getAuthUrl(redirectUri, state);
      return { url, state };
    }),

  getConnections: protectedProcedure.query(async ({ ctx }) => {
    const connections = await ctx.uow.propertyManager.findByUser(ctx.portfolio.ownerId);
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
      const connection = await ctx.uow.propertyManager.findByIdWithDetails(
        input.connectionId,
        ctx.portfolio.ownerId
      );
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      return connection;
    }),

  fetchProviderProperties: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.uow.propertyManager.findById(
        input.connectionId,
        ctx.portfolio.ownerId
      );
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      if (connection.provider !== "propertyme") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provider not supported" });
      }

      const provider = getPropertyMeProvider();
      const pmProperties = await provider.getProperties(decrypt(connection.accessToken));

      // Batch: fetch all existing mappings in one query, then bulk-insert new ones
      const existingMappings = await ctx.uow.propertyManager.findMappingsByConnection(connection.id);
      const existingProviderIds = new Set(existingMappings.map((m) => m.providerPropertyId));

      const newMappings = pmProperties
        .filter((pmProp) => !existingProviderIds.has(pmProp.id))
        .map((pmProp) => ({
          connectionId: connection.id,
          providerPropertyId: pmProp.id,
          providerPropertyAddress: pmProp.address,
        }));

      if (newMappings.length > 0) {
        await ctx.uow.propertyManager.createMappings(newMappings);
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
      const mapping = await ctx.uow.propertyManager.findMappingWithConnection(input.mappingId);
      if (!mapping || mapping.connection.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mapping not found" });
      }

      if (input.propertyId) {
        const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);
        if (!property) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
        }
      }

      await ctx.uow.propertyManager.updateMapping(input.mappingId, {
        propertyId: input.propertyId,
        autoSync: input.autoSync ?? mapping.autoSync,
        updatedAt: new Date(),
      });

      return { success: true };
    }),

  sync: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.uow.propertyManager.findById(
        input.connectionId,
        ctx.portfolio.ownerId
      );
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }

      const syncLog = await ctx.uow.propertyManager.createSyncLog({
        connectionId: connection.id,
        syncType: "manual",
        status: "running",
      });

      try {
        const provider = getPropertyMeProvider();
        // Cross-domain: SyncService queries both propertyManagerMappings and transactions tables
        const syncService = new PropertyManagerSyncService(provider, ctx.db);

        const result = await syncService.runFullSync(
          decrypt(connection.accessToken),
          connection.id,
          ctx.portfolio.ownerId,
          connection.lastSyncAt || undefined
        );

        const totalCreated =
          result.rentPayments.created + result.maintenanceJobs.created + result.bills.created;
        const totalItems =
          result.rentPayments.created + result.rentPayments.skipped +
          result.maintenanceJobs.created + result.maintenanceJobs.skipped +
          result.bills.created + result.bills.skipped;

        await ctx.uow.propertyManager.updateSyncLog(syncLog.id, {
          status: "completed",
          itemsSynced: String(totalItems),
          transactionsCreated: String(totalCreated),
          completedAt: new Date(),
        });

        await ctx.uow.propertyManager.updateLastSync(connection.id);

        return { success: true, transactionsCreated: totalCreated, itemsSynced: totalItems };
      } catch (error) {
        await ctx.uow.propertyManager.updateSyncLog(syncLog.id, {
          status: "failed",
          errors: JSON.stringify([error instanceof Error ? error.message : "Unknown error"]),
          completedAt: new Date(),
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Sync failed", cause: error });
      }
    }),

  disconnect: writeProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await ctx.uow.propertyManager.findById(
        input.connectionId,
        ctx.portfolio.ownerId
      );
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connection not found" });
      }
      await ctx.uow.propertyManager.updateStatus(connection.id, "revoked");
      return { success: true };
    }),
});
