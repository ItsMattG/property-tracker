import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { propertyValues, properties } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const propertyValueRouter = router({
  list: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      return ctx.db.query.propertyValues.findMany({
        where: eq(propertyValues.propertyId, input.propertyId),
        orderBy: [desc(propertyValues.valueDate)],
      });
    }),

  getLatest: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.propertyValues.findFirst({
        where: and(
          eq(propertyValues.propertyId, input.propertyId),
          eq(propertyValues.userId, ctx.user.id)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        estimatedValue: z.string().regex(/^\d+\.?\d*$/, "Invalid value"),
        valueDate: z.string(),
        source: z.enum(["manual", "api"]).default("manual"),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property belongs to user
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      const [value] = await ctx.db
        .insert(propertyValues)
        .values({
          propertyId: input.propertyId,
          userId: ctx.user.id,
          estimatedValue: input.estimatedValue,
          valueDate: input.valueDate,
          source: input.source,
          notes: input.notes,
        })
        .returning();

      return value;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(propertyValues)
        .where(
          and(
            eq(propertyValues.id, input.id),
            eq(propertyValues.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
