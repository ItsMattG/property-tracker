import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure, publicProcedure } from "../trpc";
import { loanPacks } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateLoanPackToken, generateLoanPackSnapshot } from "../services/loanPack";

export const loanPackRouter = router({
  create: writeProcedure
    .input(z.object({ expiresInDays: z.number().int().min(3).max(30).default(7) }))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await generateLoanPackSnapshot(ctx.portfolio.ownerId);
      const token = generateLoanPackToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      const [pack] = await ctx.db
        .insert(loanPacks)
        .values({ userId: ctx.portfolio.ownerId, token, expiresAt, snapshotData: snapshot })
        .returning();

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return { id: pack.id, token: pack.token, url: `${baseUrl}/share/loan-pack/${token}`, expiresAt: pack.expiresAt };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const packs = await ctx.db.query.loanPacks.findMany({
      where: eq(loanPacks.userId, ctx.portfolio.ownerId),
      orderBy: [desc(loanPacks.createdAt)],
    });

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
    }));
  }),

  revoke: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(loanPacks)
        .where(and(eq(loanPacks.id, input.id), eq(loanPacks.userId, ctx.portfolio.ownerId)))
        .returning();

      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Loan pack not found" });
      return { success: true };
    }),

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
