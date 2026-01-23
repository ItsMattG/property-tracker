import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties } from "../db/schema";
import { eq, and } from "drizzle-orm";

const propertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  suburb: z.string().min(1, "Suburb is required"),
  state: z.enum(["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]),
  postcode: z.string().regex(/^\d{4}$/, "Invalid postcode"),
  purchasePrice: z.string().regex(/^\d+\.?\d*$/, "Invalid price"),
  purchaseDate: z.string(),
  entityName: z.string().optional(),
});

export const propertyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.user.id),
      orderBy: (properties, { desc }) => [desc(properties.createdAt)],
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.id),
          eq(properties.userId, ctx.user.id)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      return property;
    }),

  create: protectedProcedure
    .input(propertySchema)
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .insert(properties)
        .values({
          userId: ctx.user.id,
          address: input.address,
          suburb: input.suburb,
          state: input.state,
          postcode: input.postcode,
          purchasePrice: input.purchasePrice,
          purchaseDate: input.purchaseDate,
          entityName: input.entityName || "Personal",
        })
        .returning();

      return property;
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid() }).merge(propertySchema.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const [property] = await ctx.db
        .update(properties)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(and(eq(properties.id, id), eq(properties.userId, ctx.user.id)))
        .returning();

      return property;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(properties)
        .where(
          and(eq(properties.id, input.id), eq(properties.userId, ctx.user.id))
        );

      return { success: true };
    }),
});
