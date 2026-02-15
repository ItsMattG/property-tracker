import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import type { ForecastScenario } from "../../db/schema";
import { TRPCError } from "@trpc/server";
import {
  DEFAULT_ASSUMPTIONS,
  generateForecastsForScenario,
} from "../../services/lending";

const assumptionsSchema = z.object({
  rentGrowthPercent: z.number().min(-10).max(20).default(2),
  expenseInflationPercent: z.number().min(-5).max(15).default(3),
  vacancyRatePercent: z.number().min(0).max(100).default(0),
  interestRateChangePercent: z.number().min(-5).max(10).default(0),
});

export const forecastRouter = router({
  listScenarios: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.forecast.listScenarios(ctx.portfolio.ownerId);
  }),

  createScenario: writeProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        assumptions: assumptionsSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;
      const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;

      if (input.isDefault) {
        await ctx.uow.forecast.clearAllDefaults(ownerId);
      }

      const scenario = await ctx.uow.forecast.createScenario({
        userId: ownerId,
        name: input.name,
        assumptions: JSON.stringify(assumptions),
        isDefault: input.isDefault ?? false,
      });

      await generateForecastsForScenario(
        { forecast: ctx.uow.forecast, recurring: ctx.uow.recurring, loan: ctx.uow.loan },
        ownerId,
        scenario.id
      );

      return scenario;
    }),

  updateScenario: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        assumptions: assumptionsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const existing = await ctx.uow.forecast.findScenarioById(input.id, ownerId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const updates: Partial<ForecastScenario> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.assumptions) updates.assumptions = JSON.stringify(input.assumptions);

      const scenario = await ctx.uow.forecast.updateScenario(input.id, updates);

      if (input.assumptions) {
        await generateForecastsForScenario(
          { forecast: ctx.uow.forecast, recurring: ctx.uow.recurring, loan: ctx.uow.loan },
          ownerId,
          scenario.id
        );
      }

      return scenario;
    }),

  deleteScenario: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.uow.forecast.deleteScenario(input.id, ctx.portfolio.ownerId);
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }
      return deleted;
    }),

  setDefaultScenario: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      await ctx.uow.forecast.clearAllDefaults(ownerId);

      const scenario = await ctx.uow.forecast.setDefault(input.id, ownerId);
      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return scenario;
    }),

  getForecast: protectedProcedure
    .input(
      z.object({
        scenarioId: z.string().uuid(),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const forecasts = await ctx.uow.forecast.getForecasts(
        ctx.portfolio.ownerId,
        input.scenarioId,
        input.propertyId
      );

      const totalIncome = forecasts.reduce((sum, f) => sum + Number(f.projectedIncome), 0);
      const totalExpenses = forecasts.reduce((sum, f) => sum + Number(f.projectedExpenses), 0);
      const totalNet = forecasts.reduce((sum, f) => sum + Number(f.projectedNet), 0);

      return {
        forecasts,
        summary: {
          totalIncome,
          totalExpenses,
          totalNet,
          monthsWithNegativeCashFlow: forecasts.filter((f) => Number(f.projectedNet) < 0).length,
        },
      };
    }),

  getComparison: protectedProcedure
    .input(
      z.object({
        scenarioIds: z.array(z.string().uuid()).min(2).max(3),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const entries = await Promise.all(
        input.scenarioIds.map(async (scenarioId) => {
          const forecasts = await ctx.uow.forecast.getForecastsRaw(
            ownerId,
            scenarioId,
            input.propertyId
          );
          return [scenarioId, forecasts] as const;
        })
      );

      return Object.fromEntries(entries);
    }),

  regenerate: writeProcedure
    .input(z.object({ scenarioId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ownerId = ctx.portfolio.ownerId;

      const scenario = await ctx.uow.forecast.findScenarioById(input.scenarioId, ownerId);
      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      await generateForecastsForScenario(
        { forecast: ctx.uow.forecast, recurring: ctx.uow.recurring, loan: ctx.uow.loan },
        ownerId,
        input.scenarioId
      );

      return { success: true };
    }),
});
