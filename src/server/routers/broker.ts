import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import { brokers, loanPacks } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const brokerRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const results = await ctx.db
      .select({
        id: brokers.id,
        name: brokers.name,
        email: brokers.email,
        phone: brokers.phone,
        company: brokers.company,
        notes: brokers.notes,
        createdAt: brokers.createdAt,
        updatedAt: brokers.updatedAt,
        packCount: sql<number>`count(${loanPacks.id})::int`,
        lastPackAt: sql<Date | null>`max(${loanPacks.createdAt})`,
      })
      .from(brokers)
      .leftJoin(loanPacks, eq(loanPacks.brokerId, brokers.id))
      .where(eq(brokers.userId, ctx.portfolio.ownerId))
      .groupBy(brokers.id)
      .orderBy(desc(brokers.updatedAt));

    return results;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const broker = await ctx.db.query.brokers.findFirst({
        where: and(
          eq(brokers.id, input.id),
          eq(brokers.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!broker) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      const packs = await ctx.db.query.loanPacks.findMany({
        where: eq(loanPacks.brokerId, input.id),
        orderBy: [desc(loanPacks.createdAt)],
      });

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
      const [broker] = await ctx.db
        .insert(brokers)
        .values({
          userId: ctx.portfolio.ownerId,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          notes: input.notes || null,
        })
        .returning();

      return broker;
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
      const [updated] = await ctx.db
        .update(brokers)
        .set({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(brokers.id, input.id), eq(brokers.userId, ctx.portfolio.ownerId))
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(brokers)
        .where(
          and(eq(brokers.id, input.id), eq(brokers.userId, ctx.portfolio.ownerId))
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Broker not found" });
      }

      return { success: true };
    }),
});
