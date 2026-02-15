import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import {
  getRequirementsForState,
  getRequirementById,
  type AustralianState,
} from "@/lib/compliance-requirements";
import { calculateNextDueDate, calculateComplianceStatus } from "../../services/compliance";
import type { ComplianceRecord } from "../../db/schema";

export const complianceRouter = router({
  getPropertyCompliance: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      const requirements = getRequirementsForState(property.state as AustralianState);
      const records = await ctx.uow.compliance.findByProperty(input.propertyId, ctx.portfolio.ownerId);

      const items = requirements.map((requirement) => {
        const lastRecord = records.find((r) => r.requirementId === requirement.id);

        let nextDueAt: Date | null = null;
        let status: ReturnType<typeof calculateComplianceStatus> | "never_completed" =
          "never_completed";

        if (lastRecord) {
          nextDueAt = new Date(lastRecord.nextDueAt);
          status = calculateComplianceStatus(nextDueAt);
        }

        return {
          requirement,
          lastRecord: lastRecord || null,
          nextDueAt: nextDueAt?.toISOString() || null,
          status,
        };
      });

      return {
        propertyId: property.id,
        propertyAddress: property.address,
        state: property.state,
        items,
      };
    }),

  getPortfolioCompliance: protectedProcedure.query(async ({ ctx }) => {
    const userProperties = await ctx.uow.property.findByOwner(ctx.portfolio.ownerId);

    if (userProperties.length === 0) {
      return {
        summary: {
          total: 0,
          compliant: 0,
          upcoming: 0,
          dueSoon: 0,
          overdue: 0,
        },
        upcomingItems: [],
        overdueItems: [],
      };
    }

    const allRecords = await ctx.uow.compliance.findByOwner(ctx.portfolio.ownerId);

    const allItems: Array<{
      propertyId: string;
      propertyAddress: string;
      requirement: { id: string; name: string };
      nextDueAt: string;
      status: ReturnType<typeof calculateComplianceStatus>;
    }> = [];

    // Pre-index records by propertyId for O(1) lookup
    const recordsByProperty = new Map<string, typeof allRecords>();
    for (const record of allRecords) {
      const existing = recordsByProperty.get(record.propertyId) ?? [];
      existing.push(record);
      recordsByProperty.set(record.propertyId, existing);
    }

    // Cache requirements by state
    const requirementsByState = new Map<string, ReturnType<typeof getRequirementsForState>>();

    for (const property of userProperties) {
      let requirements = requirementsByState.get(property.state);
      if (!requirements) {
        requirements = getRequirementsForState(property.state as AustralianState);
        requirementsByState.set(property.state, requirements);
      }

      const propertyRecords = recordsByProperty.get(property.id) ?? [];

      // Pre-index by requirementId
      const recordsByRequirement = new Map<string, (typeof allRecords)[0]>();
      for (const record of propertyRecords) {
        if (!recordsByRequirement.has(record.requirementId)) {
          recordsByRequirement.set(record.requirementId, record);
        }
      }

      for (const requirement of requirements) {
        const lastRecord = recordsByRequirement.get(requirement.id);

        if (lastRecord) {
          const nextDueAt = new Date(lastRecord.nextDueAt);
          const status = calculateComplianceStatus(nextDueAt);

          allItems.push({
            propertyId: property.id,
            propertyAddress: property.address,
            requirement: { id: requirement.id, name: requirement.name },
            nextDueAt: nextDueAt.toISOString(),
            status,
          });
        }
      }
    }

    const summary = {
      total: allItems.length,
      compliant: allItems.filter((i) => i.status === "compliant").length,
      upcoming: allItems.filter((i) => i.status === "upcoming").length,
      dueSoon: allItems.filter((i) => i.status === "due_soon").length,
      overdue: allItems.filter((i) => i.status === "overdue").length,
    };

    const upcomingItems = allItems
      .filter((i) => i.status === "upcoming" || i.status === "due_soon")
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    const overdueItems = allItems
      .filter((i) => i.status === "overdue")
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    return {
      summary,
      upcomingItems,
      overdueItems,
    };
  }),

  recordCompletion: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        requirementId: z.string(),
        completedAt: z.string().datetime(),
        notes: z.string().optional(),
        documentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      const requirements = getRequirementsForState(property.state as AustralianState);
      const requirement = requirements.find((r) => r.id === input.requirementId);

      if (!requirement) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requirement "${input.requirementId}" is not applicable to properties in ${property.state}`,
        });
      }

      const completedAt = new Date(input.completedAt);
      const nextDueAt = calculateNextDueDate(completedAt, requirement.frequencyMonths);

      const record = await ctx.uow.compliance.create({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        requirementId: input.requirementId,
        completedAt: completedAt.toISOString().split("T")[0],
        nextDueAt: nextDueAt.toISOString().split("T")[0],
        notes: input.notes,
        documentId: input.documentId,
      });

      return {
        record,
        nextDueAt: nextDueAt.toISOString(),
      };
    }),

  getHistory: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        requirementId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      return ctx.uow.compliance.findHistory(
        input.propertyId,
        input.requirementId,
        ctx.portfolio.ownerId
      );
    }),

  updateRecord: writeProcedure
    .input(
      z.object({
        recordId: z.string().uuid(),
        completedAt: z.string().datetime().optional(),
        notes: z.string().optional(),
        documentId: z.string().uuid().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // We need the existing record for the propertyId to recalculate nextDueAt
      // Use direct DB since compliance.findById isn't in the interface
      const existingRecords = await ctx.uow.compliance.findByOwner(ctx.portfolio.ownerId);
      const existingRecord = existingRecords.find((r) => r.id === input.recordId);

      if (!existingRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compliance record not found",
        });
      }

      const updates: Partial<ComplianceRecord> = {
        updatedAt: new Date(),
      };

      if (input.notes !== undefined) {
        updates.notes = input.notes;
      }

      if (input.documentId !== undefined) {
        updates.documentId = input.documentId;
      }

      if (input.completedAt !== undefined) {
        const property = await ctx.uow.property.findById(existingRecord.propertyId, ctx.portfolio.ownerId);

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }

        const requirements = getRequirementsForState(property.state as AustralianState);
        const requirement = requirements.find((r) => r.id === existingRecord.requirementId);

        if (!requirement) {
          const baseRequirement = getRequirementById(existingRecord.requirementId);
          if (!baseRequirement) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invalid requirement",
            });
          }
          const completedAt = new Date(input.completedAt);
          const nextDueAt = calculateNextDueDate(completedAt, baseRequirement.frequencyMonths);
          updates.completedAt = completedAt.toISOString().split("T")[0];
          updates.nextDueAt = nextDueAt.toISOString().split("T")[0];
        } else {
          const completedAt = new Date(input.completedAt);
          const nextDueAt = calculateNextDueDate(completedAt, requirement.frequencyMonths);
          updates.completedAt = completedAt.toISOString().split("T")[0];
          updates.nextDueAt = nextDueAt.toISOString().split("T")[0];
        }
      }

      return ctx.uow.compliance.update(input.recordId, ctx.portfolio.ownerId, updates);
    }),

  deleteRecord: writeProcedure
    .input(z.object({ recordId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify record exists and belongs to user
      const allRecords = await ctx.uow.compliance.findByOwner(ctx.portfolio.ownerId);
      const existingRecord = allRecords.find((r) => r.id === input.recordId);

      if (!existingRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compliance record not found",
        });
      }

      await ctx.uow.compliance.delete(input.recordId, ctx.portfolio.ownerId);

      return { success: true };
    }),
});
