import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  scenarios,
  scenarioFactors,
  scenarioProjections,
  properties,
  loans,
  recurringTransactions,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  runProjection,
  type PortfolioState,
  type ScenarioFactorInput,
} from "../services/scenario";

const factorConfigSchema = z.object({
  factorType: z.enum([
    "interest_rate",
    "vacancy",
    "rent_change",
    "expense_change",
    "sell_property",
    "buy_property",
  ]),
  config: z.record(z.string(), z.unknown()),
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
        marginalTaxRate: z.number().min(0).max(1).default(0.37),
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
          marginalTaxRate: String(input.marginalTaxRate),
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

  run: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.db.query.scenarios.findFirst({
        where: and(
          eq(scenarios.id, input.id),
          eq(scenarios.userId, ctx.portfolio.ownerId)
        ),
        with: {
          factors: true,
        },
      });

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      // Get portfolio state
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      const userLoans = await ctx.db.query.loans.findMany({
        where: eq(loans.userId, ctx.portfolio.ownerId),
      });

      // Get recurring transactions for base income/expenses
      const recurring = await ctx.db.query.recurringTransactions.findMany({
        where: and(
          eq(recurringTransactions.userId, ctx.portfolio.ownerId),
          eq(recurringTransactions.isActive, true)
        ),
      });

      // Build portfolio state
      const portfolioState: PortfolioState = {
        properties: userProperties.map((p) => {
          const propertyRecurring = recurring.filter((r) => r.propertyId === p.id);
          const monthlyRent = propertyRecurring
            .filter((r) => r.transactionType === "income")
            .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);
          const monthlyExpenses = propertyRecurring
            .filter((r) => r.transactionType === "expense")
            .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

          return {
            id: p.id,
            monthlyRent,
            monthlyExpenses,
          };
        }),
        loans: userLoans.map((l) => ({
          id: l.id,
          propertyId: l.propertyId,
          currentBalance: Number(l.currentBalance),
          interestRate: Number(l.interestRate),
          repaymentAmount: Number(l.repaymentAmount),
        })),
      };

      // Convert factors
      const factorInputs: ScenarioFactorInput[] = scenario.factors.map((f) => ({
        factorType: f.factorType,
        config: JSON.parse(f.config),
        startMonth: Number(f.startMonth),
        durationMonths: f.durationMonths ? Number(f.durationMonths) : undefined,
      }));

      // Run projection
      const result = runProjection(
        portfolioState,
        factorInputs,
        Number(scenario.timeHorizonMonths)
      );

      // Save or update projection
      const existingProjection = await ctx.db.query.scenarioProjections.findFirst({
        where: eq(scenarioProjections.scenarioId, scenario.id),
      });

      if (existingProjection) {
        await ctx.db
          .update(scenarioProjections)
          .set({
            calculatedAt: new Date(),
            timeHorizonMonths: scenario.timeHorizonMonths,
            monthlyResults: JSON.stringify(result.monthlyResults),
            summaryMetrics: JSON.stringify(result.summaryMetrics),
            isStale: false,
          })
          .where(eq(scenarioProjections.scenarioId, scenario.id));
      } else {
        await ctx.db.insert(scenarioProjections).values({
          scenarioId: scenario.id,
          timeHorizonMonths: scenario.timeHorizonMonths,
          monthlyResults: JSON.stringify(result.monthlyResults),
          summaryMetrics: JSON.stringify(result.summaryMetrics),
          isStale: false,
        });
      }

      return result;
    }),
});
