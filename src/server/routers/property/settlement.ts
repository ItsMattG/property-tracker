import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, writeProcedure, protectedProcedure } from "../../trpc";
import { documents, transactions } from "../../db/schema";
import type { Property } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { extractSettlement } from "../../services/property-analysis";

export const settlementRouter = router({
  /**
   * Extract settlement data from an uploaded document
   */
  extract: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        storagePath: z.string().min(1),
        fileType: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const result = await extractSettlement(input.storagePath, input.fileType);

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to extract settlement data",
        });
      }

      return result.data;
    }),

  /**
   * Confirm extracted settlement data — creates capital cost transactions
   */
  confirm: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        purchasePrice: z.number().positive().optional(),
        settlementDate: z.string().optional(),
        items: z.array(
          z.object({
            category: z.enum([
              "stamp_duty",
              "conveyancing",
              "buyers_agent_fees",
              "initial_repairs",
            ]),
            description: z.string().min(1),
            amount: z.number().positive(),
            date: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { propertyId, purchasePrice, settlementDate, items } = input;

      const property = await ctx.uow.property.findById(propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      // Update purchase price and date if extracted
      if (purchasePrice || settlementDate) {
        const updates: Partial<Property> = { updatedAt: new Date() };
        if (purchasePrice) updates.purchasePrice = String(purchasePrice);
        if (settlementDate) updates.purchaseDate = settlementDate;

        await ctx.uow.property.update(propertyId, ctx.portfolio.ownerId, updates);
      }

      // Create capital cost transactions
      const created = [];
      for (const item of items) {
        const [tx] = await ctx.db
          .insert(transactions)
          .values({
            userId: ctx.portfolio.ownerId,
            propertyId,
            date: item.date,
            description: item.description,
            amount: String(item.amount * -1), // Capital costs stored as negative
            category: item.category,
            transactionType: "expense",
            status: "confirmed",
          })
          .returning();
        created.push(tx);
      }

      return { created: created.length, transactions: created };
    }),

  /**
   * Get settlement documents for a property
   */
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Cross-domain: document query by propertyId — stays ctx.db
      const docs = await ctx.db.query.documents.findMany({
        where: and(
          eq(documents.propertyId, input.propertyId),
          eq(documents.userId, ctx.portfolio.ownerId),
          eq(documents.category, "contract")
        ),
        orderBy: (d, { desc }) => [desc(d.createdAt)],
      });

      return docs;
    }),
});
