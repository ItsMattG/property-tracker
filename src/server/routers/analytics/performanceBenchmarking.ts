// src/server/routers/performanceBenchmarking.ts

import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import {
  calculatePercentile,
  calculateInvertedPercentile,
  calculatePerformanceScore,
  calculateGrossYield,
  calculateNetYield,
  generateInsights,
  isUnderperforming,
  buildCohortDescription,
  getScoreLabel,
  getPercentileStatus,
} from "../../services/analytics";
import { getMockSuburbBenchmark } from "../../services/property-analysis";
import type {
  PropertyPerformanceResult,
  PercentileResult,
  PortfolioPerformanceSummary,
  PortfolioScorecardSummary,
  PropertyScorecardEntry,
} from "@/types/performance-benchmarking";

function getLastYearDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date;
}

export const performanceBenchmarkingRouter = router({
  getPropertyPerformance: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<PropertyPerformanceResult | null> => {
      const ownerId = ctx.portfolio.ownerId;

      // 1. Get the property
      const property = await ctx.uow.property.findById(input.propertyId, ownerId);
      if (!property) return null;

      // Get latest valuation
      const recentValues = await ctx.uow.propertyValue.findRecent(input.propertyId, 1);
      const latestValue = recentValues[0] ?? null;

      // Property type defaults to "house" if not specified
      const propertyType = "house";

      // 2. Get or create suburb benchmark
      let suburbBenchmark = await ctx.uow.similarProperties.findSuburbBenchmark(
        property.suburb,
        property.state,
        propertyType
      );

      if (!suburbBenchmark) {
        // Create from mock data
        const mockData = getMockSuburbBenchmark(
          property.suburb,
          property.state,
          propertyType
        );
        if (!mockData) return null;

        const today = new Date().toISOString().split("T")[0];
        suburbBenchmark = await ctx.uow.similarProperties.createSuburbBenchmark({
          ...mockData,
          suburb: property.suburb,
          state: property.state,
          postcode: mockData.postcode || "0000",
          propertyType: propertyType,
          periodStart: today,
          periodEnd: today,
        });
      }

      // 3. Get property transactions for last year
      const lastYear = getLastYearDate();
      const propertyTransactions = await ctx.uow.transactions.findAllByOwner(ownerId, {
        propertyId: input.propertyId,
        startDate: lastYear.toISOString().split("T")[0],
      });

      // 4. Calculate user metrics
      const annualRent = propertyTransactions
        .filter((t) => t.category === "rental_income")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const annualExpenses = propertyTransactions
        .filter((t) => t.transactionType === "expense")
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      const currentValue = latestValue?.estimatedValue
        ? parseFloat(latestValue.estimatedValue)
        : parseFloat(property.purchasePrice);

      const userYield = currentValue > 0 ? (annualRent / currentValue) * 100 : null;
      const userExpenseRatio = annualRent > 0 ? (annualExpenses / annualRent) * 100 : null;

      // 5. Get benchmark values
      const medianYield = suburbBenchmark.rentalYield
        ? parseFloat(suburbBenchmark.rentalYield)
        : null;
      const priceGrowth = suburbBenchmark.priceGrowth1yr
        ? parseFloat(suburbBenchmark.priceGrowth1yr)
        : null;
      const vacancyRate = suburbBenchmark.vacancyRate
        ? parseFloat(suburbBenchmark.vacancyRate)
        : null;

      // 6. Calculate percentiles
      let yieldPercentile: number | null = null;
      let yieldResult: PercentileResult | null = null;
      if (userYield !== null && medianYield !== null) {
        yieldPercentile = calculatePercentile(userYield, medianYield);
        yieldResult = {
          value: Math.round(userYield * 10) / 10,
          median: medianYield,
          percentile: yieldPercentile,
          status: getPercentileStatus(yieldPercentile),
        };
      }

      let growthPercentile: number | null = null;
      let growthResult: PercentileResult | null = null;
      if (priceGrowth !== null) {
        growthPercentile = 55; // Default to slightly above median
        growthResult = {
          value: priceGrowth,
          median: priceGrowth,
          percentile: growthPercentile,
          status: getPercentileStatus(growthPercentile),
        };
      }

      let expensePercentile: number | null = null;
      let expenseResult: PercentileResult | null = null;
      if (userExpenseRatio !== null) {
        const medianExpenseRatio = 30;
        expensePercentile = calculateInvertedPercentile(userExpenseRatio, medianExpenseRatio);
        expenseResult = {
          value: Math.round(userExpenseRatio),
          median: medianExpenseRatio,
          percentile: expensePercentile,
          status: getPercentileStatus(expensePercentile),
        };
      }

      let vacancyPercentile: number | null = null;
      let vacancyResult: PercentileResult | null = null;
      if (vacancyRate !== null) {
        vacancyPercentile = 55;
        vacancyResult = {
          value: vacancyRate,
          median: vacancyRate,
          percentile: vacancyPercentile,
          status: getPercentileStatus(vacancyPercentile),
        };
      }

      // 7. Calculate score and insights
      const performanceScore = calculatePerformanceScore(
        yieldPercentile,
        growthPercentile,
        expensePercentile,
        vacancyPercentile
      );

      const insights = generateInsights(
        userYield,
        medianYield,
        userExpenseRatio,
        30,
        null,
        vacancyRate
      );

      const cohortDescription = buildCohortDescription(
        null, // bedrooms - not available on property
        propertyType,
        property.suburb,
        property.state
      );

      // 8. Cache the result
      await ctx.uow.similarProperties.upsertPerformanceBenchmark({
        propertyId: input.propertyId,
        yieldPercentile,
        growthPercentile,
        expensePercentile,
        vacancyPercentile,
        performanceScore,
        cohortSize: suburbBenchmark.sampleSize || 0,
        cohortDescription,
        suburbBenchmarkId: suburbBenchmark.id,
        insights: JSON.stringify(insights),
      });

      return {
        propertyId: input.propertyId,
        performanceScore,
        scoreLabel: getScoreLabel(performanceScore),
        yield: yieldResult,
        growth: growthResult,
        expenses: expenseResult,
        vacancy: vacancyResult,
        cohortDescription,
        cohortSize: suburbBenchmark.sampleSize || 0,
        insights,
        isUnderperforming: isUnderperforming(yieldPercentile, expensePercentile, vacancyPercentile),
        calculatedAt: new Date(),
      };
    }),

  getPortfolioPerformance: protectedProcedure.query(
    async ({ ctx }): Promise<PortfolioPerformanceSummary> => {
      const ownerId = ctx.portfolio.ownerId;
      const userProperties = await ctx.uow.property.findByOwner(ownerId);

      if (userProperties.length === 0) {
        return {
          totalProperties: 0,
          averageScore: 0,
          underperformingCount: 0,
          topPerformer: null,
          worstPerformer: null,
        };
      }

      const propertyIds = userProperties.map((p) => p.id);
      const benchmarks = await ctx.uow.similarProperties.findPerformanceBenchmarksByProperties(propertyIds);

      if (benchmarks.length === 0) {
        return {
          totalProperties: userProperties.length,
          averageScore: 50,
          underperformingCount: 0,
          topPerformer: null,
          worstPerformer: null,
        };
      }

      const scores = benchmarks
        .filter((b) => b.performanceScore !== null)
        .map((b) => ({
          propertyId: b.propertyId,
          score: b.performanceScore!,
          address: userProperties.find((p) => p.id === b.propertyId)?.address || "",
        }));

      const averageScore =
        scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

      const underperformingCount = benchmarks.filter((b) =>
        isUnderperforming(b.yieldPercentile, b.expensePercentile, b.vacancyPercentile)
      ).length;

      const sorted = [...scores].sort((a, b) => b.score - a.score);
      const topPerformer = sorted[0] || null;
      const worstPerformer = sorted[sorted.length - 1] || null;

      return {
        totalProperties: userProperties.length,
        averageScore: Math.round(averageScore),
        underperformingCount,
        topPerformer,
        worstPerformer,
      };
    }
  ),

  getUnderperformers: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;
    const userProperties = await ctx.uow.property.findByOwner(ownerId);

    if (userProperties.length === 0) return [];

    const propertyIds = userProperties.map((p) => p.id);
    const benchmarks = await ctx.uow.similarProperties.findPerformanceBenchmarksByProperties(propertyIds);

    return benchmarks
      .filter((b) =>
        isUnderperforming(b.yieldPercentile, b.expensePercentile, b.vacancyPercentile)
      )
      .map((b) => ({
        ...b,
        property: userProperties.find((p) => p.id === b.propertyId),
        insights: b.insights ? JSON.parse(b.insights) : [],
      }));
  }),

  getPortfolioScorecard: protectedProcedure.query(
    async ({ ctx }): Promise<PortfolioScorecardSummary> => {
      const ownerId = ctx.portfolio.ownerId;
      const userProperties = await ctx.uow.property.findByOwner(ownerId);

      if (userProperties.length === 0) {
        return {
          properties: [],
          averageScore: 0,
          averageGrossYield: 0,
          averageNetYield: 0,
          totalAnnualCashFlow: 0,
          totalAnnualRent: 0,
          totalAnnualExpenses: 0,
          totalCurrentValue: 0,
        };
      }

      const lastYear = getLastYearDate();
      const propertyIds = userProperties.map((p) => p.id);

      // Fetch benchmarks and transactions in parallel
      const [benchmarks, allTransactions] = await Promise.all([
        ctx.uow.similarProperties.findPerformanceBenchmarksByProperties(propertyIds),
        ctx.uow.transactions.findAllByOwner(ownerId, {
          startDate: lastYear.toISOString().split("T")[0],
        }),
      ]);

      const benchmarkMap = new Map(benchmarks.map((b) => [b.propertyId, b]));

      // Build scorecard entries for each property
      const entries: PropertyScorecardEntry[] = await Promise.all(
        userProperties.map(async (property) => {
          const recentValues = await ctx.uow.propertyValue.findRecent(property.id, 1);
          const latestValue = recentValues[0] ?? null;
          const currentValue = latestValue?.estimatedValue
            ? parseFloat(latestValue.estimatedValue)
            : parseFloat(property.purchasePrice);
          const purchasePrice = parseFloat(property.purchasePrice);

          // Filter transactions for this property
          const propTransactions = allTransactions.filter(
            (t) => t.propertyId === property.id
          );
          const annualRent = propTransactions
            .filter((t) => t.category === "rental_income")
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
          const annualExpenses = propTransactions
            .filter((t) => t.transactionType === "expense")
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

          const grossYield = calculateGrossYield(annualRent, currentValue);
          const netYield = calculateNetYield(annualRent, annualExpenses, currentValue);
          const annualCashFlow = annualRent - annualExpenses;

          const benchmark = benchmarkMap.get(property.id);
          const performanceScore = benchmark?.performanceScore ?? 50;

          return {
            propertyId: property.id,
            address: property.address,
            suburb: property.suburb,
            state: property.state,
            purchasePrice,
            currentValue,
            grossYield: Math.round(grossYield * 10) / 10,
            netYield: Math.round(netYield * 10) / 10,
            annualCashFlow: Math.round(annualCashFlow),
            annualRent: Math.round(annualRent),
            annualExpenses: Math.round(annualExpenses),
            performanceScore,
            scoreLabel: getScoreLabel(performanceScore),
            yieldPercentile: benchmark?.yieldPercentile ?? null,
            expensePercentile: benchmark?.expensePercentile ?? null,
            isUnderperforming: benchmark
              ? isUnderperforming(
                  benchmark.yieldPercentile,
                  benchmark.expensePercentile,
                  benchmark.vacancyPercentile
                )
              : false,
          };
        })
      );

      // Sort by performance score descending
      entries.sort((a, b) => b.performanceScore - a.performanceScore);

      const totalAnnualRent = entries.reduce((sum, e) => sum + e.annualRent, 0);
      const totalAnnualExpenses = entries.reduce((sum, e) => sum + e.annualExpenses, 0);
      const totalCurrentValue = entries.reduce((sum, e) => sum + e.currentValue, 0);
      const totalAnnualCashFlow = totalAnnualRent - totalAnnualExpenses;
      const avgScore =
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.performanceScore, 0) / entries.length
          : 0;
      const avgGrossYield =
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.grossYield, 0) / entries.length
          : 0;
      const avgNetYield =
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.netYield, 0) / entries.length
          : 0;

      return {
        properties: entries,
        averageScore: Math.round(avgScore),
        averageGrossYield: Math.round(avgGrossYield * 10) / 10,
        averageNetYield: Math.round(avgNetYield * 10) / 10,
        totalAnnualCashFlow: Math.round(totalAnnualCashFlow),
        totalAnnualRent: Math.round(totalAnnualRent),
        totalAnnualExpenses: Math.round(totalAnnualExpenses),
        totalCurrentValue: Math.round(totalCurrentValue),
      };
    }
  ),
});
