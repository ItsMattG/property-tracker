import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure, publicProcedure } from "../../trpc";
import { loanPacks } from "../../db/schema";
import { eq } from "drizzle-orm";
import { generateLoanPackToken, generateLoanPackSnapshot } from "../../services/lending";

export const loanPackRouter = router({
  create: writeProcedure
    .input(
      z.object({
        expiresInDays: z.number().int().min(3).max(30).default(7),
        brokerId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify broker belongs to user if provided
      if (input.brokerId) {
        const broker = await ctx.uow.loan.findBrokerById(input.brokerId, ctx.portfolio.ownerId);
        if (!broker) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
        }
      }

      const snapshot = await generateLoanPackSnapshot(ctx.portfolio.ownerId);
      const token = generateLoanPackToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const pack = await ctx.uow.loan.createLoanPack({
        userId: ctx.portfolio.ownerId,
        brokerId: input.brokerId || null,
        token,
        expiresAt,
        snapshotData: snapshot,
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return {
        id: pack.id,
        token: pack.token,
        url: `${baseUrl}/share/loan-pack/${token}`,
        expiresAt: pack.expiresAt,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const packs = await ctx.uow.loan.findLoanPacksByOwner(ctx.portfolio.ownerId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return packs.map((pack) => ({
      id: pack.id,
      token: pack.token,
      url: `${baseUrl}/share/loan-pack/${pack.token}`,
      expiresAt: pack.expiresAt,
      accessCount: pack.accessCount,
      createdAt: pack.createdAt,
      accessedAt: pack.accessedAt,
      isExpired: new Date() > pack.expiresAt,
      brokerId: pack.brokerId,
      brokerName: pack.broker?.name || null,
    }));
  }),

  revoke: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.loan.deleteLoanPack(input.id, ctx.portfolio.ownerId);
      return { success: true };
    }),

  // publicProcedure: no ctx.uow available
  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const pack = await ctx.db.query.loanPacks.findFirst({ where: eq(loanPacks.token, input.token) });

      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found or has been revoked" });
      if (new Date() > pack.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "This report has expired" });

      await ctx.db
        .update(loanPacks)
        .set({ accessCount: pack.accessCount + 1, accessedAt: new Date() })
        .where(eq(loanPacks.id, pack.id));

      return { snapshot: pack.snapshotData, createdAt: pack.createdAt, expiresAt: pack.expiresAt };
    }),
});
