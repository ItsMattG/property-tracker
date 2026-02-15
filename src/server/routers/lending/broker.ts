import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";

export const brokerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.loan.listBrokersWithStats(ctx.portfolio.ownerId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const broker = await ctx.uow.loan.findBrokerById(input.id, ctx.portfolio.ownerId);

      if (!broker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      const packs = await ctx.uow.loan.findBrokerPacks(input.id);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return {
        ...broker,
        packs: packs.map((pack) => ({
          id: pack.id,
          token: pack.token,
          url: `${baseUrl}/share/loan-pack/${pack.token}`,
          expiresAt: pack.expiresAt,
          accessCount: pack.accessCount,
          createdAt: pack.createdAt,
          accessedAt: pack.accessedAt,
          isExpired: new Date() > pack.expiresAt,
        })),
      };
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.loan.createBroker({
        userId: ctx.portfolio.ownerId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company || null,
        notes: input.notes || null,
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        company: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.uow.loan.updateBroker(input.id, ctx.portfolio.ownerId, {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        company: input.company || null,
        notes: input.notes || null,
      });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.loan.deleteBroker(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),
});
