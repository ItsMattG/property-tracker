import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { transactions, properties } from "../db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  getFinancialYearRange,
  calculateCategoryTotals,
  calculatePropertyMetrics,
  getFinancialYearTransactions,
  getPropertiesWithLoans,
} from "../services/reports";
import { categories } from "@/lib/categories";

export const reportsRouter = router({
  /**
   * Get available financial years based on user's transactions
   */
  getAvailableYears: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({
        minDate: sql<string>`MIN(${transactions.date})`,
        maxDate: sql<string>`MAX(${transactions.date})`,
      })
      .from(transactions)
      .where(eq(transactions.userId, ctx.portfolio.ownerId));

    const minDate = result[0]?.minDate;
    const maxDate = result[0]?.maxDate;

    if (!minDate || !maxDate) {
      return [];
    }

    // Calculate FY range
    const startYear = new Date(minDate).getMonth() >= 6
      ? new Date(minDate).getFullYear() + 1
      : new Date(minDate).getFullYear();
    const endYear = new Date(maxDate).getMonth() >= 6
      ? new Date(maxDate).getFullYear() + 1
      : new Date(maxDate).getFullYear();

    const years = [];
    for (let year = endYear; year >= startYear; year--) {
      const range = getFinancialYearRange(year);
      years.push({ year, label: range.label });
    }

    return years;
  }),

  /**
   * Get tax report data for a financial year
   */
  taxReport: protectedProcedure
    .input(
      z.object({
        year: z.number().min(2000).max(2100),
        propertyId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { year, propertyId } = input;
      const { startDate, endDate, label } = getFinancialYearRange(year);

      // Validate property ownership if propertyId provided
      if (propertyId) {
        const property = await ctx.db.query.properties.findFirst({
          where: and(
            eq(properties.id, propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          ),
        });
        if (!property) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property not found",
          });
        }
      }

      // Get all user properties
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      });

      // Get transactions for the financial year
      const txns = await getFinancialYearTransactions(
        ctx.portfolio.ownerId,
        year,
        propertyId
      );

      // Group transactions by property
      const byProperty = new Map<string, typeof txns>();
      for (const t of txns) {
        if (t.propertyId) {
          const existing = byProperty.get(t.propertyId) || [];
          existing.push(t);
          byProperty.set(t.propertyId, existing);
        }
      }

      // Calculate metrics per property
      const propertyReports = userProperties
        .filter((p) => !propertyId || p.id === propertyId)
        .map((property) => {
          const propertyTxns = byProperty.get(property.id) || [];
          const metrics = calculatePropertyMetrics(propertyTxns);
          const categoryTotals = calculateCategoryTotals(propertyTxns);

          // Build ATO category breakdown
          const atoBreakdown = categories
            .filter((c) => c.isDeductible || c.type === "income")
            .map((cat) => ({
              category: cat.value,
              label: cat.label,
              amount: categoryTotals.get(cat.value) || 0,
              atoReference: cat.atoReference,
              isDeductible: cat.isDeductible,
            }))
            .filter((c) => c.amount !== 0);

          return {
            property: {
              id: property.id,
              address: property.address,
              suburb: property.suburb,
              state: property.state,
              entityName: property.entityName,
            },
            metrics,
            atoBreakdown,
            transactionCount: propertyTxns.length,
          };
        });

      // Calculate totals across all properties
      const allTxns = Array.from(byProperty.values()).flat();
      const totalMetrics = calculatePropertyMetrics(allTxns);

      return {
        financialYear: label,
        startDate,
        endDate,
        properties: propertyReports,
        totals: totalMetrics,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Get portfolio summary for dashboard
   */
  portfolioSummary: protectedProcedure
    .input(
      z.object({
        period: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
        months: z.number().min(1).max(24).default(12),
        propertyId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { period, months, propertyId } = input;

      // Get properties with loans
      const userProperties = await getPropertiesWithLoans(ctx.portfolio.ownerId);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Build where conditions
      const conditions = [
        eq(transactions.userId, ctx.portfolio.ownerId),
        gte(transactions.date, startDate.toISOString().split("T")[0]),
        lte(transactions.date, endDate.toISOString().split("T")[0]),
      ];
      if (propertyId) {
        conditions.push(eq(transactions.propertyId, propertyId));
      }

      // Get transactions in range
      const txns = await ctx.db.query.transactions.findMany({
        where: and(...conditions),
        orderBy: [desc(transactions.date)],
        with: {
          property: true,
        },
      });

      // Group by month
      const byMonth = new Map<string, typeof txns>();
      for (const t of txns) {
        const monthKey = t.date.slice(0, 7); // YYYY-MM
        const existing = byMonth.get(monthKey) || [];
        existing.push(t);
        byMonth.set(monthKey, existing);
      }

      // Calculate monthly metrics
      const monthlyData = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, monthTxns]) => {
          const metrics = calculatePropertyMetrics(monthTxns);
          return {
            month,
            ...metrics,
          };
        });

      // Calculate totals
      const totalMetrics = calculatePropertyMetrics(txns);

      // Calculate total loan balance
      const totalLoanBalance = userProperties.reduce((sum, p) => {
        const propertyLoans = p.loans || [];
        return sum + propertyLoans.reduce((s, l) => s + Number(l.currentBalance), 0);
      }, 0);

      return {
        properties: userProperties.map((p) => ({
          id: p.id,
          address: p.address,
          purchasePrice: Number(p.purchasePrice),
          loanBalance: (p.loans || []).reduce(
            (s, l) => s + Number(l.currentBalance),
            0
          ),
        })),
        monthlyData,
        totals: {
          ...totalMetrics,
          totalLoanBalance,
          propertyCount: userProperties.length,
        },
        period,
      };
    }),
});
