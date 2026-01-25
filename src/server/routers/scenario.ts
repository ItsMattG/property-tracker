import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  scenarios,
  scenarioFactors,
  scenarioProjections,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

const factorConfigSchema = z.object({
  factorType: z.enum([
    "interest_rate",
    "vacancy",
    "rent_change",
    "expense_change",
    "sell_property",
    "buy_property",
  ]),
  config: z.record(z.unknown()),
  startMonth: z.number().int().min(0).default(0),
  durationMonths: z.number().int().min(1).optional(),
  propertyId: z.string().uuid().optional(),
});

export const scenarioRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.scenarios.findMany({
      where: eq(scenarios.userId, ctx.portfolio.ownerId),
      orderBy: [desc(scenarios.updatedAt)],
      with: {
        factors: true,
        projection: true,
      },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scenario = await ctx.db.query.scenarios.findFirst({
        where: and(
          eq(scenarios.id, input.id),
          eq(scenarios.userId, ctx.portfolio.ownerId)
        ),
        with: {
          factors: true,
          projection: true,
          snapshot: true,
          parentScenario: true,
        },
      });

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return scenario;
    }),

  create: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        timeHorizonMonths: z.number().int().min(1).max(120).default(60),
        parentScenarioId: z.string().uuid().optional(),
        factors: z.array(factorConfigSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [scenario] = await ctx.db
        .insert(scenarios)
        .values({
          userId: ctx.portfolio.ownerId,
          name: input.name,
          description: input.description,
          timeHorizonMonths: String(input.timeHorizonMonths),
          parentScenarioId: input.parentScenarioId,
          status: "draft",
        })
        .returning();

      if (input.factors && input.factors.length > 0) {
        await ctx.db.insert(scenarioFactors).values(
          input.factors.map((f) => ({
            scenarioId: scenario.id,
            factorType: f.factorType,
            config: JSON.stringify(f.config),
            propertyId: f.propertyId,
            startMonth: String(f.startMonth),
            durationMonths: f.durationMonths ? String(f.durationMonths) : null,
          }))
        );
      }

      return scenario;
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        timeHorizonMonths: z.number().int().min(1).max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.scenarios.findFirst({
        where: and(
          eq(scenarios.id, input.id),
          eq(scenarios.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.timeHorizonMonths) updates.timeHorizonMonths = String(input.timeHorizonMonths);

      const [updated] = await ctx.db
        .update(scenarios)
        .set(updates)
        .where(eq(scenarios.id, input.id))
        .returning();

      // Mark projection as stale
      await ctx.db
        .update(scenarioProjections)
        .set({ isStale: true })
        .where(eq(scenarioProjections.scenarioId, input.id));

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(scenarios)
        .where(
          and(
            eq(scenarios.id, input.id),
            eq(scenarios.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return deleted;
    }),

  addFactor: writeProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        factor: factorConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.db.query.scenarios.findFirst({
        where: and(
          eq(scenarios.id, input.scenarioId),
          eq(scenarios.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const [factor] = await ctx.db
        .insert(scenarioFactors)
        .values({
          scenarioId: input.scenarioId,
          factorType: input.factor.factorType,
          config: JSON.stringify(input.factor.config),
          propertyId: input.factor.propertyId,
          startMonth: String(input.factor.startMonth),
          durationMonths: input.factor.durationMonths
            ? String(input.factor.durationMonths)
            : null,
        })
        .returning();

      // Mark projection as stale
      await ctx.db
        .update(scenarioProjections)
        .set({ isStale: true })
        .where(eq(scenarioProjections.scenarioId, input.scenarioId));

      return factor;
    }),

  removeFactor: writeProcedure
    .input(z.object({ factorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const factor = await ctx.db.query.scenarioFactors.findFirst({
        where: eq(scenarioFactors.id, input.factorId),
        with: { scenario: true },
      });

      if (!factor || factor.scenario.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found" });
      }

      await ctx.db.delete(scenarioFactors).where(eq(scenarioFactors.id, input.factorId));

      // Mark projection as stale
      await ctx.db
        .update(scenarioProjections)
        .set({ isStale: true })
        .where(eq(scenarioProjections.scenarioId, factor.scenarioId));

      return { success: true };
    }),
});
