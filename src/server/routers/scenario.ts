import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  properties,
  loans,
  recurringTransactions,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
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
    return ctx.uow.scenario.findByOwner(ctx.portfolio.ownerId);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const scenario = await ctx.uow.scenario.findById(input.id, ctx.portfolio.ownerId);

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
      const scenario = await ctx.uow.scenario.create({
        userId: ctx.portfolio.ownerId,
        name: input.name,
        description: input.description,
        timeHorizonMonths: String(input.timeHorizonMonths),
        marginalTaxRate: String(input.marginalTaxRate),
        parentScenarioId: input.parentScenarioId,
        status: "draft",
      });

      if (input.factors && input.factors.length > 0) {
        await Promise.all(
          input.factors.map((f) =>
            ctx.uow.scenario.createFactor({
              scenarioId: scenario.id,
              factorType: f.factorType,
              config: JSON.stringify(f.config),
              propertyId: f.propertyId,
              startMonth: String(f.startMonth),
              durationMonths: f.durationMonths ? String(f.durationMonths) : null,
            })
          )
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
        marginalTaxRate: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.scenario.findById(input.id, ctx.portfolio.ownerId);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.timeHorizonMonths) updates.timeHorizonMonths = String(input.timeHorizonMonths);
      if (input.marginalTaxRate !== undefined) updates.marginalTaxRate = String(input.marginalTaxRate);

      const updated = await ctx.uow.scenario.update(input.id, updates);

      // Mark projection as stale
      await ctx.uow.scenario.markProjectionStale(input.id);

      return updated;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.uow.scenario.delete(input.id, ctx.portfolio.ownerId);

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
      const scenario = await ctx.uow.scenario.findById(input.scenarioId, ctx.portfolio.ownerId);

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const factor = await ctx.uow.scenario.createFactor({
        scenarioId: input.scenarioId,
        factorType: input.factor.factorType,
        config: JSON.stringify(input.factor.config),
        propertyId: input.factor.propertyId,
        startMonth: String(input.factor.startMonth),
        durationMonths: input.factor.durationMonths
          ? String(input.factor.durationMonths)
          : null,
      });

      await ctx.uow.scenario.markProjectionStale(input.scenarioId);

      return factor;
    }),

  removeFactor: writeProcedure
    .input(z.object({ factorId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const factor = await ctx.uow.scenario.findFactor(input.factorId);

      if (!factor || factor.scenario.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Factor not found" });
      }

      await ctx.uow.scenario.deleteFactor(input.factorId);
      await ctx.uow.scenario.markProjectionStale(factor.scenarioId);

      return { success: true };
    }),

  // run uses cross-domain queries (properties, loans, recurring) for portfolio state
  run: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.uow.scenario.findById(input.id, ctx.portfolio.ownerId);

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      // Get portfolio state - fetch all 3 queries in parallel
      const [userProperties, userLoans, recurring] = await Promise.all([
        ctx.db.query.properties.findMany({
          where: eq(properties.userId, ctx.portfolio.ownerId),
        }),
        ctx.db.query.loans.findMany({
          where: eq(loans.userId, ctx.portfolio.ownerId),
        }),
        ctx.db.query.recurringTransactions.findMany({
          where: and(
            eq(recurringTransactions.userId, ctx.portfolio.ownerId),
            eq(recurringTransactions.isActive, true)
          ),
        }),
      ]);

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

      // Convert factors with property data for sell_property
      const marginalTaxRate = Number(scenario.marginalTaxRate || 0.37);
      const factorInputs: ScenarioFactorInput[] = scenario.factors.map((f) => {
        const base = {
          factorType: f.factorType,
          config: JSON.parse(f.config),
          startMonth: Number(f.startMonth),
          durationMonths: f.durationMonths ? Number(f.durationMonths) : undefined,
        };

        if (f.factorType === "sell_property" && f.propertyId) {
          const property = userProperties.find((p) => p.id === f.propertyId);
          if (property) {
            return {
              ...base,
              propertyData: {
                id: property.id,
                purchasePrice: Number(property.purchasePrice),
                improvements: 0,
                depreciationClaimed: 0,
                purchaseDate: new Date(property.purchaseDate),
              },
              marginalTaxRate,
            };
          }
        }

        return base;
      });

      // Run projection
      const result = runProjection(
        portfolioState,
        factorInputs,
        Number(scenario.timeHorizonMonths)
      );

      // Save or update projection
      await ctx.uow.scenario.upsertProjection(scenario.id, {
        calculatedAt: new Date(),
        timeHorizonMonths: scenario.timeHorizonMonths,
        monthlyResults: JSON.stringify(result.monthlyResults),
        summaryMetrics: JSON.stringify(result.summaryMetrics),
        isStale: false,
      });

      return result;
    }),
});
