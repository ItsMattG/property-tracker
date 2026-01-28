import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions, propertyValues } from "../db/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";
import { calculateGrossYield, calculateNetYield } from "../services/rental-yield";

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

    const results = await Promise.all(
      userProperties.map(async (property) => {
        const [latestValue] = await ctx.db
          .select()
          .from(propertyValues)
          .where(eq(propertyValues.propertyId, property.id))
          .orderBy(desc(propertyValues.valueDate))
          .limit(1);

        const currentValue = latestValue
          ? parseFloat(latestValue.estimatedValue)
          : parseFloat(property.purchasePrice);

        const [rentResult] = await ctx.db
          .select({
            total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.propertyId, property.id),
              eq(transactions.category, "rental_income"),
              gte(transactions.date, cutoffDate)
            )
          );

        const [expenseResult] = await ctx.db
          .select({
            total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.propertyId, property.id),
              sql`${transactions.category} NOT IN ('rental_income', 'other_rental_income', 'uncategorized')`,
              gte(transactions.date, cutoffDate)
            )
          );

        const annualRent = parseFloat(rentResult?.total ?? "0");
        const annualExpenses = parseFloat(expenseResult?.total ?? "0");

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
      })
    );

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
