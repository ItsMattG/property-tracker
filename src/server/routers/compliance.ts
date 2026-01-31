import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { complianceRecords, properties } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  getRequirementsForState,
  getRequirementById,
  type AustralianState,
} from "@/lib/compliance-requirements";
import { calculateNextDueDate, calculateComplianceStatus } from "../services/compliance";

export const complianceRouter = router({
  /**
   * Get compliance status for a specific property
   * Returns all requirements for the property's state with current status
   */
  getPropertyCompliance: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get property to verify ownership and get state
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

      // Get requirements for the property's state
      const requirements = getRequirementsForState(property.state as AustralianState);

      // Get existing compliance records for this property
      const records = await ctx.db.query.complianceRecords.findMany({
        where: and(
          eq(complianceRecords.propertyId, input.propertyId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
        orderBy: [desc(complianceRecords.completedAt)],
      });

      // Build compliance items with status
      const items = requirements.map((requirement) => {
        // Find the most recent record for this requirement
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

  /**
   * Get aggregated compliance status across all properties in the portfolio
   */
  getPortfolioCompliance: protectedProcedure.query(async ({ ctx }) => {
    // Get all properties for the user
    const userProperties = await ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.portfolio.ownerId),
    });

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

    // Get all compliance records for user's properties
    const allRecords = await ctx.db.query.complianceRecords.findMany({
      where: eq(complianceRecords.userId, ctx.portfolio.ownerId),
      orderBy: [desc(complianceRecords.nextDueAt)],
    });

    // Build compliance items for all properties
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

    // Cache requirements by state to avoid redundant calls
    const requirementsByState = new Map<string, ReturnType<typeof getRequirementsForState>>();

    for (const property of userProperties) {
      // Get cached requirements or fetch and cache
      let requirements = requirementsByState.get(property.state);
      if (!requirements) {
        requirements = getRequirementsForState(property.state as AustralianState);
        requirementsByState.set(property.state, requirements);
      }

      // O(1) lookup instead of O(n) filter
      const propertyRecords = recordsByProperty.get(property.id) ?? [];

      // Pre-index property records by requirementId for O(1) lookup
      const recordsByRequirement = new Map<string, (typeof allRecords)[0]>();
      for (const record of propertyRecords) {
        // Keep most recent (already sorted by nextDueAt desc)
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

    // Calculate summary
    const summary = {
      total: allItems.length,
      compliant: allItems.filter((i) => i.status === "compliant").length,
      upcoming: allItems.filter((i) => i.status === "upcoming").length,
      dueSoon: allItems.filter((i) => i.status === "due_soon").length,
      overdue: allItems.filter((i) => i.status === "overdue").length,
    };

    // Get upcoming items (within 30 days) sorted by due date
    const upcomingItems = allItems
      .filter((i) => i.status === "upcoming" || i.status === "due_soon")
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    // Get overdue items sorted by most overdue first
    const overdueItems = allItems
      .filter((i) => i.status === "overdue")
      .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

    return {
      summary,
      upcomingItems,
      overdueItems,
    };
  }),

  /**
   * Record completion of a compliance requirement
   */
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
      // Verify property belongs to user
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

      // Verify requirement is valid for the property's state
      const requirements = getRequirementsForState(property.state as AustralianState);
      const requirement = requirements.find((r) => r.id === input.requirementId);

      if (!requirement) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requirement "${input.requirementId}" is not applicable to properties in ${property.state}`,
        });
      }

      // Calculate next due date
      const completedAt = new Date(input.completedAt);
      const nextDueAt = calculateNextDueDate(completedAt, requirement.frequencyMonths);

      // Create compliance record
      const [record] = await ctx.db
        .insert(complianceRecords)
        .values({
          propertyId: input.propertyId,
          userId: ctx.portfolio.ownerId,
          requirementId: input.requirementId,
          completedAt: completedAt.toISOString().split("T")[0],
          nextDueAt: nextDueAt.toISOString().split("T")[0],
          notes: input.notes,
          documentId: input.documentId,
        })
        .returning();

      return {
        record,
        nextDueAt: nextDueAt.toISOString(),
      };
    }),

  /**
   * Get history of compliance records for a specific requirement on a property
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        requirementId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify property belongs to user
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

      // Get all records for this property and requirement
      const records = await ctx.db.query.complianceRecords.findMany({
        where: and(
          eq(complianceRecords.propertyId, input.propertyId),
          eq(complianceRecords.requirementId, input.requirementId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
        orderBy: [desc(complianceRecords.completedAt)],
        with: {
          document: true,
        },
      });

      return records;
    }),

  /**
   * Update an existing compliance record
   */
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
      // Get existing record
      const existingRecord = await ctx.db.query.complianceRecords.findFirst({
        where: and(
          eq(complianceRecords.id, input.recordId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!existingRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compliance record not found",
        });
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.notes !== undefined) {
        updates.notes = input.notes;
      }

      if (input.documentId !== undefined) {
        updates.documentId = input.documentId;
      }

      // If completedAt changed, recalculate nextDueAt
      if (input.completedAt !== undefined) {
        const property = await ctx.db.query.properties.findFirst({
          where: eq(properties.id, existingRecord.propertyId),
        });

        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }

        const requirements = getRequirementsForState(property.state as AustralianState);
        const requirement = requirements.find((r) => r.id === existingRecord.requirementId);

        if (!requirement) {
          // Fallback to base requirement
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

      // Update record
      const [updatedRecord] = await ctx.db
        .update(complianceRecords)
        .set(updates)
        .where(
          and(
            eq(complianceRecords.id, input.recordId),
            eq(complianceRecords.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      return updatedRecord;
    }),

  /**
   * Delete a compliance record
   */
  deleteRecord: writeProcedure
    .input(z.object({ recordId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify record exists and belongs to user
      const existingRecord = await ctx.db.query.complianceRecords.findFirst({
        where: and(
          eq(complianceRecords.id, input.recordId),
          eq(complianceRecords.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!existingRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Compliance record not found",
        });
      }

      await ctx.db
        .delete(complianceRecords)
        .where(
          and(
            eq(complianceRecords.id, input.recordId),
            eq(complianceRecords.userId, ctx.portfolio.ownerId)
          )
        );

      return { success: true };
    }),
});
