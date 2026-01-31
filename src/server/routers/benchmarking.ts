import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { properties, transactions } from "../db/schema";
import { eq, and, gte, inArray } from "drizzle-orm";
import {
  calculateInsuranceBenchmark,
  calculateCouncilRatesBenchmark,
  calculateManagementFeesBenchmark,
} from "../services/benchmarking";
import type {
  PropertyBenchmark,
  PortfolioBenchmarkSummary,
} from "@/types/benchmarking";

// Get transactions for last 12 months
function getLastYearDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

export const benchmarkingRouter = router({
  getPropertyBenchmark: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<PropertyBenchmark | null> => {
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
        with: {
          propertyValues: {
            orderBy: (v, { desc }) => [desc(v.valueDate)],
            limit: 1,
          },
        },
      });

      if (!property) return null;

      const lastYear = getLastYearDate();
      const propertyTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.propertyId, input.propertyId),
          gte(transactions.date, lastYear.toISOString().split("T")[0])
        ),
      });

      // Sum by category
      const sumByCategory = (category: string) =>
        propertyTransactions
          .filter((t) => t.category === category)
          .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const insuranceTotal = sumByCategory("insurance");
      const councilRatesTotal = sumByCategory("council_rates");
      const managementFeesTotal = sumByCategory("property_agent_fees");
      const rentalIncomeTotal = sumByCategory("rental_income");

      const propertyValue = property.propertyValues?.[0]?.estimatedValue
        ? parseFloat(property.propertyValues[0].estimatedValue)
        : parseFloat(property.purchasePrice);

      const insurance = calculateInsuranceBenchmark(
        insuranceTotal,
        propertyValue,
        property.state
      );
      const councilRates = calculateCouncilRatesBenchmark(
        councilRatesTotal,
        property.state
      );
      const managementFees = calculateManagementFeesBenchmark(
        managementFeesTotal,
        rentalIncomeTotal
      );

      const totalPotentialSavings =
        (insurance?.potentialSavings || 0) +
        (councilRates?.potentialSavings || 0) +
        (managementFees?.potentialSavings || 0);

      return {
        propertyId: input.propertyId,
        insurance,
        councilRates,
        managementFees,
        totalPotentialSavings,
      };
    }),

  getPortfolioSummary: protectedProcedure.query(
    async ({ ctx }): Promise<PortfolioBenchmarkSummary> => {
      const userProperties = await ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
        with: {
          propertyValues: {
            orderBy: (v, { desc }) => [desc(v.valueDate)],
            limit: 1,
          },
        },
      });

      if (userProperties.length === 0) {
        return {
          totalPotentialSavings: 0,
          insuranceSavings: 0,
          councilRatesSavings: 0,
          managementFeesSavings: 0,
          propertiesWithSavings: 0,
          totalProperties: 0,
        };
      }

      const lastYear = getLastYearDate();
      const propertyIds = userProperties.map((p) => p.id);

      const allTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          inArray(transactions.propertyId, propertyIds),
          gte(transactions.date, lastYear.toISOString().split("T")[0])
        ),
      });

      let insuranceSavings = 0;
      let councilRatesSavings = 0;
      let managementFeesSavings = 0;
      let propertiesWithSavings = 0;

      // Pre-index transactions by propertyId for O(1) lookup instead of O(n) filter
      const txnsByProperty = new Map<string, typeof allTransactions>();
      for (const txn of allTransactions) {
        if (txn.propertyId) {
          const existing = txnsByProperty.get(txn.propertyId) ?? [];
          existing.push(txn);
          txnsByProperty.set(txn.propertyId, existing);
        }
      }

      for (const property of userProperties) {
        const propertyTxns = txnsByProperty.get(property.id) ?? [];

        const sumByCategory = (category: string) =>
          propertyTxns
            .filter((t) => t.category === category)
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

        const insuranceTotal = sumByCategory("insurance");
        const councilRatesTotal = sumByCategory("council_rates");
        const managementFeesTotal = sumByCategory("property_agent_fees");
        const rentalIncomeTotal = sumByCategory("rental_income");

        const propertyValue = property.propertyValues?.[0]?.estimatedValue
          ? parseFloat(property.propertyValues[0].estimatedValue)
          : parseFloat(property.purchasePrice);

        const insurance = calculateInsuranceBenchmark(
          insuranceTotal,
          propertyValue,
          property.state
        );
        const councilRates = calculateCouncilRatesBenchmark(
          councilRatesTotal,
          property.state
        );
        const managementFees = calculateManagementFeesBenchmark(
          managementFeesTotal,
          rentalIncomeTotal
        );

        const propertySavings =
          (insurance?.potentialSavings || 0) +
          (councilRates?.potentialSavings || 0) +
          (managementFees?.potentialSavings || 0);

        if (propertySavings > 0) {
          propertiesWithSavings++;
        }

        insuranceSavings += insurance?.potentialSavings || 0;
        councilRatesSavings += councilRates?.potentialSavings || 0;
        managementFeesSavings += managementFees?.potentialSavings || 0;
      }

      return {
        totalPotentialSavings:
          insuranceSavings + councilRatesSavings + managementFeesSavings,
        insuranceSavings,
        councilRatesSavings,
        managementFeesSavings,
        propertiesWithSavings,
        totalProperties: userProperties.length,
      };
    }
  ),
});
