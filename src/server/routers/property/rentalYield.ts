import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import { properties, transactions, propertyValues } from "../../db/schema";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
import { calculateGrossYield, calculateNetYield } from "../../services/analytics";

export const rentalYieldRouter = router({
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new Error("Property not found");
      }

      // Get latest valuation or fall back to purchase price
      const [latestValue] = await ctx.db
        .select()
        .from(propertyValues)
        .where(eq(propertyValues.propertyId, input.propertyId))
        .orderBy(desc(propertyValues.valueDate))
        .limit(1);

      const currentValue = latestValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property.purchasePrice);

      // Annual rent (income transactions in last 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const cutoffDate = oneYearAgo.toISOString().split("T")[0];

      const [rentResult] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, input.propertyId),
            eq(transactions.category, "rental_income"),
            gte(transactions.date, cutoffDate)
          )
        );

      const annualRent = parseFloat(rentResult?.total ?? "0");

      // Annual expenses (all non-income, non-uncategorized in last 12 months)
      const [expenseResult] = await ctx.db
        .select({
          total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.propertyId, input.propertyId),
            sql`${transactions.category} NOT IN ('rental_income', 'other_rental_income', 'uncategorized')`,
            gte(transactions.date, cutoffDate)
          )
        );

      const annualExpenses = parseFloat(expenseResult?.total ?? "0");

      const grossYield = calculateGrossYield(annualRent, currentValue);
      const netYield = calculateNetYield(annualRent, annualExpenses, currentValue);

      return {
        propertyId: input.propertyId,
        currentValue,
        annualRent,
        annualExpenses,
        grossYield: Math.round(grossYield * 100) / 100,
        netYield: Math.round(netYield * 100) / 100,
      };
    }),

  getPortfolioSummary: protectedProcedure.query(async ({ ctx }) => {
    const userProperties = await ctx.db.query.properties.findMany({
      where: eq(properties.userId, ctx.portfolio.ownerId),
    });

    if (userProperties.length === 0) {
      return { properties: [], averageGrossYield: 0, averageNetYield: 0 };
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0];
    const propertyIds = userProperties.map((p) => p.id);

    // Batch fetch all data in 3 queries instead of 3*N queries
    const [allPropertyValues, rentTotals, expenseTotals] = await Promise.all([
      // Get all valuations for user's properties (we'll pick latest per property in JS)
      ctx.db
        .select({
          propertyId: propertyValues.propertyId,
          estimatedValue: propertyValues.estimatedValue,
          valueDate: propertyValues.valueDate,
        })
        .from(propertyValues)
        .where(inArray(propertyValues.propertyId, propertyIds))
        .orderBy(desc(propertyValues.valueDate)),
      // Get rent totals grouped by property
      ctx.db
        .select({
          propertyId: transactions.propertyId,
          total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.propertyId, propertyIds),
            eq(transactions.category, "rental_income"),
            gte(transactions.date, cutoffDate)
          )
        )
        .groupBy(transactions.propertyId),
      // Get expense totals grouped by property
      ctx.db
        .select({
          propertyId: transactions.propertyId,
          total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.propertyId, propertyIds),
            sql`${transactions.category} NOT IN ('rental_income', 'other_rental_income', 'uncategorized')`,
            gte(transactions.date, cutoffDate)
          )
        )
        .groupBy(transactions.propertyId),
    ]);

    // Index results by propertyId for O(1) lookup - pick latest valuation per property
    const valuesByProperty = new Map<string, number>();
    for (const v of allPropertyValues) {
      if (v.propertyId && !valuesByProperty.has(v.propertyId)) {
        valuesByProperty.set(v.propertyId, parseFloat(v.estimatedValue));
      }
    }
    const rentByProperty = new Map(rentTotals.map((r) => [r.propertyId, parseFloat(r.total)]));
    const expensesByProperty = new Map(expenseTotals.map((e) => [e.propertyId, parseFloat(e.total)]));

    const results = userProperties.map((property) => {
      const currentValue = valuesByProperty.get(property.id) ?? parseFloat(property.purchasePrice);
      const annualRent = rentByProperty.get(property.id) ?? 0;
      const annualExpenses = expensesByProperty.get(property.id) ?? 0;

      return {
        propertyId: property.id,
        address: property.address,
        suburb: property.suburb,
        currentValue,
        annualRent,
        annualExpenses,
        grossYield: Math.round(calculateGrossYield(annualRent, currentValue) * 100) / 100,
        netYield: Math.round(calculateNetYield(annualRent, annualExpenses, currentValue) * 100) / 100,
      };
    });

    const withRent = results.filter((r) => r.annualRent > 0);
    const avgGross =
      withRent.length > 0
        ? withRent.reduce((sum, r) => sum + r.grossYield, 0) / withRent.length
        : 0;
    const avgNet =
      withRent.length > 0
        ? withRent.reduce((sum, r) => sum + r.netYield, 0) / withRent.length
        : 0;

    return {
      properties: results,
      averageGrossYield: Math.round(avgGross * 100) / 100,
      averageNetYield: Math.round(avgNet * 100) / 100,
    };
  }),
});
