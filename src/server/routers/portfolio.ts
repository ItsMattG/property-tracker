import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, propertyValues, loans, transactions } from "../db/schema";
import { eq, and, gte, lte, inArray, desc } from "drizzle-orm";
import {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  getDateRangeForPeriod,
} from "../services/portfolio";

/** Fetch the latest property value per property using DISTINCT ON to avoid N+1 */
async function getLatestPropertyValues(
  db: typeof import("../db")["db"],
  userId: string,
  propertyIds: string[]
): Promise<Map<string, number>> {
  if (propertyIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([propertyValues.propertyId], {
      propertyId: propertyValues.propertyId,
      estimatedValue: propertyValues.estimatedValue,
    })
    .from(propertyValues)
    .where(
      and(
        eq(propertyValues.userId, userId),
        inArray(propertyValues.propertyId, propertyIds)
      )
    )
    .orderBy(propertyValues.propertyId, desc(propertyValues.valueDate));

  const latestValues = new Map<string, number>();
  for (const row of rows) {
    latestValues.set(row.propertyId, Number(row.estimatedValue));
  }
  return latestValues;
}

const periodSchema = z.enum(["monthly", "quarterly", "annual"]);
const sortBySchema = z.enum(["cashFlow", "equity", "lvr", "alphabetical"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

const filtersSchema = z.object({
  period: periodSchema,
  state: z.string().optional(),
  entityType: z.string().optional(),
  status: z.enum(["active", "sold"]).optional(),
});

export const portfolioRouter = router({
  getSummary: protectedProcedure
    .input(filtersSchema)
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getDateRangeForPeriod(input.period);

      // Get filtered properties
      let propertyList = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      // Apply filters
      if (input.state) {
        propertyList = propertyList.filter((p) => p.state === input.state);
      }
      if (input.entityType) {
        propertyList = propertyList.filter((p) => p.entityName === input.entityType);
      }
      if (input.status) {
        propertyList = propertyList.filter((p) => p.status === input.status);
      }

      if (propertyList.length === 0) {
        return {
          propertyCount: 0,
          totalValue: 0,
          totalDebt: 0,
          totalEquity: 0,
          portfolioLVR: null,
          cashFlow: 0,
          averageYield: null,
        };
      }

      const propertyIds = propertyList.map((p) => p.id);

      // Get latest value per property using DISTINCT ON (single row per property)
      const latestValues = await getLatestPropertyValues(
        ctx.db,
        ctx.portfolio.ownerId,
        propertyIds
      );

      // Get all loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.portfolio.ownerId),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      // Sum loans per property
      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions in period
      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
      });

      // Filter to only transactions for our properties
      const filteredTransactions = periodTransactions.filter(
        (t) => t.propertyId && propertyIds.includes(t.propertyId)
      );

      // Calculate totals
      const totalValue = Array.from(latestValues.values()).reduce((a, b) => a + b, 0);
      const totalDebt = Array.from(loansByProperty.values()).reduce((a, b) => a + b, 0);
      const totalEquity = calculateEquity(totalValue, totalDebt);
      const portfolioLVR = calculateLVR(totalDebt, totalValue);
      const cashFlow = calculateCashFlow(filteredTransactions);

      // Calculate average yield (weighted by value)
      const incomeTransactions = filteredTransactions.filter(
        (t) => t.transactionType === "income"
      );
      const periodIncome = incomeTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
      // Annualize based on period
      const multiplier = input.period === "monthly" ? 12 : input.period === "quarterly" ? 4 : 1;
      const totalAnnualIncome = periodIncome * multiplier;

      const averageYield = calculateGrossYield(totalAnnualIncome, totalValue);

      return {
        propertyCount: propertyList.length,
        totalValue,
        totalDebt,
        totalEquity,
        portfolioLVR,
        cashFlow,
        averageYield,
      };
    }),

  getPropertyMetrics: protectedProcedure
    .input(
      filtersSchema.extend({
        sortBy: sortBySchema.default("alphabetical"),
        sortOrder: sortOrderSchema.default("asc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getDateRangeForPeriod(input.period);

      // Get filtered properties
      let propertyList = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      if (input.state) {
        propertyList = propertyList.filter((p) => p.state === input.state);
      }
      if (input.entityType) {
        propertyList = propertyList.filter((p) => p.entityName === input.entityType);
      }
      if (input.status) {
        propertyList = propertyList.filter((p) => p.status === input.status);
      }

      if (propertyList.length === 0) {
        return [];
      }

      const propertyIds = propertyList.map((p) => p.id);

      // Get latest value per property using DISTINCT ON (single row per property)
      const latestValues = await getLatestPropertyValues(
        ctx.db,
        ctx.portfolio.ownerId,
        propertyIds
      );

      // Get all loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.portfolio.ownerId),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions in period
      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
      });

      // Group transactions by property
      const transactionsByProperty = new Map<string, typeof periodTransactions>();
      for (const t of periodTransactions) {
        if (t.propertyId && propertyIds.includes(t.propertyId)) {
          const list = transactionsByProperty.get(t.propertyId) || [];
          list.push(t);
          transactionsByProperty.set(t.propertyId, list);
        }
      }

      // Calculate metrics for each property
      const multiplier = input.period === "monthly" ? 12 : input.period === "quarterly" ? 4 : 1;

      const metrics = propertyList.map((property) => {
        const value = latestValues.get(property.id) || 0;
        const totalLoans = loansByProperty.get(property.id) || 0;
        const propertyTransactions = transactionsByProperty.get(property.id) || [];

        const equity = calculateEquity(value, totalLoans);
        const lvr = calculateLVR(totalLoans, value);
        const cashFlow = calculateCashFlow(propertyTransactions);

        const income = propertyTransactions
          .filter((t) => t.transactionType === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const expenses = propertyTransactions
          .filter((t) => t.transactionType === "expense")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

        const annualIncome = income * multiplier;
        const annualExpenses = expenses * multiplier;

        const grossYield = calculateGrossYield(annualIncome, value);
        const netYield = calculateNetYield(annualIncome, annualExpenses, value);

        const capitalGrowth = value - Number(property.purchasePrice);
        const capitalGrowthPercent =
          Number(property.purchasePrice) > 0
            ? (capitalGrowth / Number(property.purchasePrice)) * 100
            : 0;

        return {
          propertyId: property.id,
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          entityName: property.entityName,
          status: property.status,
          purchasePrice: Number(property.purchasePrice),
          currentValue: value,
          capitalGrowth,
          capitalGrowthPercent,
          totalLoans,
          equity,
          lvr,
          grossYield,
          netYield,
          cashFlow,
          annualIncome,
          annualExpenses,
          hasValue: value > 0,
        };
      });

      // Sort
      metrics.sort((a, b) => {
        let comparison = 0;
        switch (input.sortBy) {
          case "cashFlow":
            comparison = a.cashFlow - b.cashFlow;
            break;
          case "equity":
            comparison = a.equity - b.equity;
            break;
          case "lvr":
            comparison = (a.lvr ?? 0) - (b.lvr ?? 0);
            break;
          case "alphabetical":
            comparison = a.suburb.localeCompare(b.suburb);
            break;
        }
        return input.sortOrder === "desc" ? -comparison : comparison;
      });

      return metrics;
    }),
});
