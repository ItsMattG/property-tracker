import { z } from "zod";
import { router, protectedProcedure } from "../../trpc";
import {
  calculateEquity,
  calculateLVR,
  calculateCashFlow,
  calculateGrossYield,
  calculateNetYield,
  getDateRangeForPeriod,
} from "../../services/transaction";
import { categories } from "@/lib/categories";

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

      let propertyList = await ctx.uow.portfolio.findProperties(ctx.portfolio.ownerId);

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

      const [latestValues, allLoans, periodTransactions] = await Promise.all([
        ctx.uow.portfolio.getLatestPropertyValues(ctx.portfolio.ownerId, propertyIds),
        ctx.uow.portfolio.findLoansByProperties(ctx.portfolio.ownerId, propertyIds),
        ctx.uow.portfolio.findTransactionsInRange(
          ctx.portfolio.ownerId,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
      ]);

      // Sum loans per property
      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Filter to only transactions for our properties
      const filteredTransactions = periodTransactions.filter(
        (t) => t.propertyId && propertyIds.includes(t.propertyId)
      );

      // Calculate totals
      const totalValue = propertyList.reduce((sum, p) => sum + (latestValues.get(p.id) || Number(p.purchasePrice)), 0);
      const totalDebt = Array.from(loansByProperty.values()).reduce((a, b) => a + b, 0);
      const totalEquity = calculateEquity(totalValue, totalDebt);
      const portfolioLVR = calculateLVR(totalDebt, totalValue);
      const cashFlow = calculateCashFlow(filteredTransactions);

      const incomeTransactions = filteredTransactions.filter(
        (t) => t.transactionType === "income"
      );
      const periodIncome = incomeTransactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );
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

      let propertyList = await ctx.uow.portfolio.findProperties(ctx.portfolio.ownerId);

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

      const [latestValues, allLoans, periodTransactions] = await Promise.all([
        ctx.uow.portfolio.getLatestPropertyValues(ctx.portfolio.ownerId, propertyIds),
        ctx.uow.portfolio.findLoansByProperties(ctx.portfolio.ownerId, propertyIds),
        ctx.uow.portfolio.findTransactionsInRange(
          ctx.portfolio.ownerId,
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
      ]);

      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Group transactions by property
      const transactionsByProperty = new Map<string, typeof periodTransactions>();
      for (const t of periodTransactions) {
        if (t.propertyId && propertyIds.includes(t.propertyId)) {
          const list = transactionsByProperty.get(t.propertyId) || [];
          list.push(t);
          transactionsByProperty.set(t.propertyId, list);
        }
      }

      const multiplier = input.period === "monthly" ? 12 : input.period === "quarterly" ? 4 : 1;

      const metrics = propertyList.map((property) => {
        const value = latestValues.get(property.id) || Number(property.purchasePrice);
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

  getBorrowingPower: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;
    const propertyList = await ctx.uow.portfolio.findProperties(ownerId);

    if (propertyList.length === 0) {
      return {
        totalPortfolioValue: 0,
        totalDebt: 0,
        portfolioLVR: 0,
        usableEquity: 0,
        annualRentalIncome: 0,
        annualExpenses: 0,
        annualRepayments: 0,
        netSurplus: 0,
        debtServiceRatio: null as number | null,
        estimatedBorrowingPower: 0,
        weightedAvgRate: 0,
        hasLoans: false,
      };
    }

    const propertyIds = propertyList.map((p) => p.id);

    // 1-year lookback for transactions
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const [latestValues, allLoans, transactions] = await Promise.all([
      ctx.uow.portfolio.getLatestPropertyValues(ownerId, propertyIds),
      ctx.uow.portfolio.findLoansByProperties(ownerId, propertyIds),
      ctx.uow.portfolio.findTransactionsInRange(
        ownerId,
        oneYearAgo.toISOString().split("T")[0],
        now.toISOString().split("T")[0]
      ),
    ]);

    // --- Portfolio value & debt ---
    const totalPortfolioValue = propertyList.reduce(
      (sum, p) => sum + (latestValues.get(p.id) || Number(p.purchasePrice)),
      0
    );

    const totalDebt = allLoans.reduce(
      (sum, loan) => sum + Number(loan.currentBalance),
      0
    );

    const portfolioLVR = totalPortfolioValue > 0
      ? (totalDebt / totalPortfolioValue) * 100
      : 0;

    const usableEquity = Math.max(0, totalPortfolioValue * 0.8 - totalDebt);

    // --- Filter transactions to portfolio properties ---
    const propertyIdSet = new Set(propertyIds);
    const filteredTransactions = transactions.filter(
      (t) => t.propertyId && propertyIdSet.has(t.propertyId)
    );

    // --- Capital categories to exclude from expenses ---
    const capitalCategoryValues = new Set(
      categories.filter((c) => c.type === "capital").map((c) => c.value)
    );

    // --- Annual income & expenses ---
    const annualRentalIncome = filteredTransactions
      .filter((t) => t.transactionType === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const annualExpenses = filteredTransactions
      .filter(
        (t) =>
          t.transactionType === "expense" &&
          !capitalCategoryValues.has(t.category)
      )
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    // --- Annualize loan repayments ---
    const frequencyMultiplier: Record<string, number> = {
      weekly: 52,
      fortnightly: 26,
      monthly: 12,
      quarterly: 4,
    };

    const annualRepayments = allLoans.reduce((sum, loan) => {
      const multiplier = frequencyMultiplier[loan.repaymentFrequency] ?? 12;
      return sum + Number(loan.repaymentAmount) * multiplier;
    }, 0);

    // --- Net surplus ---
    const netSurplus = annualRentalIncome - annualExpenses - annualRepayments;

    // --- Debt service ratio (null if no income) ---
    const debtServiceRatio: number | null =
      annualRentalIncome > 0 ? annualRepayments / annualRentalIncome : null;

    // --- Weighted average interest rate ---
    const weightedAvgRate =
      totalDebt > 0
        ? allLoans.reduce(
            (sum, loan) =>
              sum + Number(loan.currentBalance) * Number(loan.interestRate),
            0
          ) / totalDebt
        : 0;

    // --- Estimated borrowing power ---
    const estimatedBorrowingPower = netSurplus > 0 ? usableEquity : 0;

    const hasLoans = allLoans.length > 0;

    return {
      totalPortfolioValue,
      totalDebt,
      portfolioLVR,
      usableEquity,
      annualRentalIncome,
      annualExpenses,
      annualRepayments,
      netSurplus,
      debtServiceRatio,
      estimatedBorrowingPower,
      weightedAvgRate,
      hasLoans,
    };
  }),
});
