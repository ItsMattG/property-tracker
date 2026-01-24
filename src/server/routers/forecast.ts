import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import {
  forecastScenarios,
  cashFlowForecasts,
  recurringTransactions,
  loans,
  type CashFlowForecast,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  DEFAULT_ASSUMPTIONS,
  parseAssumptions,
  calculateMonthlyProjection,
  getForecastMonth,
  type ScenarioAssumptions,
} from "../services/forecast";

const assumptionsSchema = z.object({
  rentGrowthPercent: z.number().min(-10).max(20).default(2),
  expenseInflationPercent: z.number().min(-5).max(15).default(3),
  vacancyRatePercent: z.number().min(0).max(100).default(0),
  interestRateChangePercent: z.number().min(-5).max(10).default(0),
});

export const forecastRouter = router({
  listScenarios: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.forecastScenarios.findMany({
      where: eq(forecastScenarios.userId, ctx.user.id),
      orderBy: [desc(forecastScenarios.isDefault), desc(forecastScenarios.createdAt)],
    });
  }),

  createScenario: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        assumptions: assumptionsSchema.optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;

      if (input.isDefault) {
        await ctx.db
          .update(forecastScenarios)
          .set({ isDefault: false })
          .where(eq(forecastScenarios.userId, ctx.user.id));
      }

      const [scenario] = await ctx.db
        .insert(forecastScenarios)
        .values({
          userId: ctx.user.id,
          name: input.name,
          assumptions: JSON.stringify(assumptions),
          isDefault: input.isDefault ?? false,
        })
        .returning();

      await generateForecastsForScenario(ctx.db, ctx.user.id, scenario.id);

      return scenario;
    }),

  updateScenario: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        assumptions: assumptionsSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.forecastScenarios.findFirst({
        where: and(
          eq(forecastScenarios.id, input.id),
          eq(forecastScenarios.userId, ctx.user.id)
        ),
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updates.name = input.name;
      if (input.assumptions) updates.assumptions = JSON.stringify(input.assumptions);

      const [scenario] = await ctx.db
        .update(forecastScenarios)
        .set(updates)
        .where(eq(forecastScenarios.id, input.id))
        .returning();

      if (input.assumptions) {
        await generateForecastsForScenario(ctx.db, ctx.user.id, scenario.id);
      }

      return scenario;
    }),

  deleteScenario: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(forecastScenarios)
        .where(
          and(
            eq(forecastScenarios.id, input.id),
            eq(forecastScenarios.userId, ctx.user.id)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      return deleted;
    }),

  setDefaultScenario: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(forecastScenarios)
        .set({ isDefault: false })
        .where(eq(forecastScenarios.userId, ctx.user.id));

      const [scenario] = await ctx.db
        .update(forecastScenarios)
        .set({ isDefault: true })
        .where(
          and(
            eq(forecastScenarios.id, input.id),
            eq(forecastScenarios.userId, ctx.user.id)
          )
        )
        .returning();

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
      const conditions = [
        eq(cashFlowForecasts.userId, ctx.user.id),
        eq(cashFlowForecasts.scenarioId, input.scenarioId),
      ];

      if (input.propertyId) {
        conditions.push(eq(cashFlowForecasts.propertyId, input.propertyId));
      }

      const forecasts = await ctx.db.query.cashFlowForecasts.findMany({
        where: and(...conditions),
        with: {
          property: true,
        },
        orderBy: [cashFlowForecasts.forecastMonth],
      });

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
      const results: Record<string, CashFlowForecast[]> = {};

      for (const scenarioId of input.scenarioIds) {
        const conditions = [
          eq(cashFlowForecasts.userId, ctx.user.id),
          eq(cashFlowForecasts.scenarioId, scenarioId),
        ];

        if (input.propertyId) {
          conditions.push(eq(cashFlowForecasts.propertyId, input.propertyId));
        }

        results[scenarioId] = await ctx.db.query.cashFlowForecasts.findMany({
          where: and(...conditions),
          orderBy: [cashFlowForecasts.forecastMonth],
        });
      }

      return results;
    }),

  regenerate: protectedProcedure
    .input(z.object({ scenarioId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.db.query.forecastScenarios.findFirst({
        where: and(
          eq(forecastScenarios.id, input.scenarioId),
          eq(forecastScenarios.userId, ctx.user.id)
        ),
      });

      if (!scenario) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Scenario not found" });
      }

      await generateForecastsForScenario(ctx.db, ctx.user.id, input.scenarioId);

      return { success: true };
    }),
});

async function generateForecastsForScenario(
  db: any,
  userId: string,
  scenarioId: string
) {
  const scenario = await db.query.forecastScenarios.findFirst({
    where: eq(forecastScenarios.id, scenarioId),
  });

  if (!scenario) return;

  const assumptions = parseAssumptions(scenario.assumptions);

  const recurring = await db.query.recurringTransactions.findMany({
    where: and(
      eq(recurringTransactions.userId, userId),
      eq(recurringTransactions.isActive, true)
    ),
  });

  const userLoans = await db.query.loans.findMany({
    where: eq(loans.userId, userId),
  });

  const baseIncome = recurring
    .filter((r: any) => r.transactionType === "income")
    .reduce((sum: number, r: any) => sum + Math.abs(Number(r.amount)), 0);

  const baseExpenses = recurring
    .filter((r: any) => r.transactionType === "expense")
    .reduce((sum: number, r: any) => sum + Math.abs(Number(r.amount)), 0);

  const totalLoanBalance = userLoans.reduce(
    (sum: number, l: any) => sum + Number(l.currentBalance),
    0
  );
  const weightedRate =
    totalLoanBalance > 0
      ? userLoans.reduce(
          (sum: number, l: any) =>
            sum + (Number(l.currentBalance) / totalLoanBalance) * Number(l.interestRate),
          0
        )
      : 0;

  await db
    .delete(cashFlowForecasts)
    .where(eq(cashFlowForecasts.scenarioId, scenarioId));

  for (let month = 0; month < 12; month++) {
    const projection = calculateMonthlyProjection({
      monthsAhead: month,
      baseIncome,
      baseExpenses,
      loanBalance: totalLoanBalance,
      loanRate: weightedRate,
      assumptions,
    });

    await db.insert(cashFlowForecasts).values({
      userId,
      scenarioId,
      propertyId: null,
      forecastMonth: getForecastMonth(month),
      projectedIncome: String(projection.projectedIncome),
      projectedExpenses: String(projection.projectedExpenses),
      projectedNet: String(projection.projectedNet),
      breakdown: JSON.stringify({
        baseIncome,
        baseExpenses,
        loanInterest: projection.projectedExpenses - baseExpenses,
      }),
    });
  }
}
