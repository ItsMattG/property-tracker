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
import { categories } from "@/lib/categories";
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
          bestPerformer: null,
          worstPerformer: null,
        };
      }

      const lastYear = getLastYearDate();
      const propertyIds = userProperties.map((p) => p.id);

      // Pre-compute category sets for filtering
      const deductibleCategoryValues = new Set(
        categories.filter((c) => c.isDeductible).map((c) => c.value)
      );
      const capitalCategoryValues = new Set(
        categories.filter((c) => c.type === "capital").map((c) => c.value)
      );

      // Fetch benchmarks, transactions, loans, and valuations in parallel
      const [benchmarks, allTransactions, allTimeTransactions, allLoans, ...recentValueLists] = await Promise.all([
        ctx.uow.similarProperties.findPerformanceBenchmarksByProperties(propertyIds),
        ctx.uow.transactions.findAllByOwner(ownerId, {
          startDate: lastYear.toISOString().split("T")[0],
        }),
        ctx.uow.transactions.findAllByOwner(ownerId, {}),
        ctx.uow.loan.findByOwner(ownerId),
        ...userProperties.map((p) => ctx.uow.propertyValue.findRecent(p.id, 1)),
      ]);

      const benchmarkMap = new Map(benchmarks.map((b) => [b.propertyId, b]));
      const valuationMap = new Map(
        userProperties.map((p, i) => [p.id, recentValueLists[i]?.[0] ?? null])
      );

      // Build loan balance map per property (summing multiple loans)
      const loanBalanceMap = new Map<string, number>();
      for (const loan of allLoans) {
        const propId = loan.propertyId;
        if (propId) {
          const balance = parseFloat(loan.currentBalance ?? "0");
          loanBalanceMap.set(propId, (loanBalanceMap.get(propId) ?? 0) + balance);
        }
      }

      // Build scorecard entries for each property
      const entries: PropertyScorecardEntry[] = userProperties.map((property) => {
          const latestValue = valuationMap.get(property.id) ?? null;
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
            .filter((t) => t.transactionType === "expense" && !capitalCategoryValues.has(t.category))
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

          const grossYield = calculateGrossYield(annualRent, currentValue);
          const netYield = calculateNetYield(annualRent, annualExpenses, currentValue);
          const annualCashFlow = annualRent - annualExpenses;

          const benchmark = benchmarkMap.get(property.id);
          const performanceScore = benchmark?.performanceScore ?? 50;

          // Operating expenses = all expenses EXCEPT interest_on_loans and capital categories
          const operatingExpenses = propTransactions
            .filter((t) => t.transactionType === "expense" && t.category !== "interest_on_loans" && !capitalCategoryValues.has(t.category))
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

          // Cap rate: (annualRent - operatingExpenses) / currentValue * 100
          const capRate = currentValue > 0
            ? Math.round(((annualRent - operatingExpenses) / currentValue) * 1000) / 10
            : 0;

          // Capital transactions (all-time) for this property
          const propCapitalTransactions = allTimeTransactions.filter(
            (t) => t.propertyId === property.id && capitalCategoryValues.has(t.category)
          );
          const capitalCosts = propCapitalTransactions.reduce(
            (sum, t) => sum + Math.abs(parseFloat(t.amount)), 0
          );

          // Cash-on-cash: annualCashFlow / (purchasePrice + capitalCosts) * 100
          const totalCashInvested = purchasePrice + capitalCosts;
          const cashOnCash = propCapitalTransactions.length > 0 && totalCashInvested > 0
            ? Math.round((annualCashFlow / totalCashInvested) * 1000) / 10
            : null;

          // Annual tax deductions: sum of |amount| for deductible categories (last year)
          const annualTaxDeductions = propTransactions
            .filter((t) => deductibleCategoryValues.has(t.category))
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

          // Capital growth percent: (currentValue - purchasePrice) / purchasePrice * 100
          const capitalGrowthPercent = purchasePrice > 0
            ? Math.round(((currentValue - purchasePrice) / purchasePrice) * 1000) / 10
            : 0;

          // Equity: currentValue - totalLoans
          const totalLoans = loanBalanceMap.get(property.id) ?? 0;
          const equity = Math.round(currentValue - totalLoans);

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
            capRate,
            cashOnCash,
            annualTaxDeductions: Math.round(annualTaxDeductions),
            capitalGrowthPercent,
            equity,
          };
        });

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

      // entries are already sorted by performanceScore descending
      const bestPerformer = entries.length > 0
        ? { propertyId: entries[0].propertyId, address: entries[0].address, score: entries[0].performanceScore }
        : null;
      const worstPerformer = entries.length > 0
        ? { propertyId: entries[entries.length - 1].propertyId, address: entries[entries.length - 1].address, score: entries[entries.length - 1].performanceScore }
        : null;

      return {
        properties: entries,
        averageScore: Math.round(avgScore),
        averageGrossYield: Math.round(avgGrossYield * 10) / 10,
        averageNetYield: Math.round(avgNetYield * 10) / 10,
        totalAnnualCashFlow: Math.round(totalAnnualCashFlow),
        totalAnnualRent: Math.round(totalAnnualRent),
        totalAnnualExpenses: Math.round(totalAnnualExpenses),
        totalCurrentValue: Math.round(totalCurrentValue),
        bestPerformer,
        worstPerformer,
      };
    }
  ),
});
