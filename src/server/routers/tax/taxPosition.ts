// src/server/routers/taxPosition.ts

import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { transactions, depreciationSchedules } from "../../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import type { DB } from "../../repositories/base";
import {
  calculateTaxPosition,
  estimatePropertySavings,
  type TaxPositionInput,
} from "../../services/tax";
import {
  getCurrentFinancialYear,
  getSupportedFinancialYears,
} from "@/lib/tax-tables";
import {
  getFinancialYearRange,
  calculatePropertyMetrics,
} from "../../services/transaction";

const familyStatusSchema = z.enum(["single", "couple", "family"]);

const taxProfileSchema = z.object({
  financialYear: z.number().int().min(2020).max(2030),
  grossSalary: z.number().min(0).optional(),
  paygWithheld: z.number().min(0).optional(),
  otherDeductions: z.number().min(0).default(0),
  hasHecsDebt: z.boolean().default(false),
  hasPrivateHealth: z.boolean().default(false),
  familyStatus: familyStatusSchema.default("single"),
  dependentChildren: z.number().int().min(0).default(0),
  partnerIncome: z.number().min(0).optional(),
  isComplete: z.boolean().default(false),
});

/**
 * Get total depreciation deductions for a financial year.
 * Cross-domain: queries depreciation tables for financial year total.
 */
async function getDepreciationTotal(
  db: DB,
  userId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const schedules = await db.query.depreciationSchedules.findMany({
    where: and(
      eq(depreciationSchedules.userId, userId),
      gte(depreciationSchedules.effectiveDate, startDate),
      lte(depreciationSchedules.effectiveDate, endDate)
    ),
    with: { assets: true },
  });

  return schedules.reduce((total, schedule) => {
    const scheduleTotal = schedule.assets.reduce(
      (sum, asset) => sum + parseFloat(asset.yearlyDeduction),
      0
    );
    return total + scheduleTotal;
  }, 0);
}

export const taxPositionRouter = router({
  /**
   * Get supported financial years
   */
  getSupportedYears: protectedProcedure.query(() => {
    return getSupportedFinancialYears().map((year) => ({
      year,
      label: `FY ${year - 1}-${String(year).slice(-2)}`,
      isCurrent: year === getCurrentFinancialYear(),
    }));
  }),

  /**
   * Get current financial year
   */
  getCurrentYear: protectedProcedure.query(() => {
    return getCurrentFinancialYear();
  }),

  /**
   * Get saved tax profile for a financial year
   */
  getProfile: protectedProcedure
    .input(z.object({ financialYear: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.tax.findProfileByUserAndYear(ctx.portfolio.ownerId, input.financialYear);
    }),

  /**
   * Save tax profile
   */
  saveProfile: writeProcedure
    .input(taxProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.uow.tax.findProfileByUserAndYear(ctx.portfolio.ownerId, input.financialYear);

      const profileData = {
        grossSalary: input.grossSalary?.toString(),
        paygWithheld: input.paygWithheld?.toString(),
        otherDeductions: input.otherDeductions.toString(),
        hasHecsDebt: input.hasHecsDebt,
        hasPrivateHealth: input.hasPrivateHealth,
        familyStatus: input.familyStatus,
        dependentChildren: input.dependentChildren,
        partnerIncome: input.partnerIncome?.toString(),
        isComplete: input.isComplete,
      };

      if (existing) {
        return ctx.uow.tax.updateProfile(existing.id, {
          ...profileData,
          updatedAt: new Date(),
        });
      }

      return ctx.uow.tax.createProfile({
        userId: ctx.portfolio.ownerId,
        financialYear: input.financialYear,
        ...profileData,
      });
    }),

  /**
   * Get rental net result for a financial year
   */
  getRentalResult: protectedProcedure
    .input(z.object({ financialYear: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = getFinancialYearRange(input.financialYear);

      // Cross-domain: queries transactions table for financial year rental metrics
      const txns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        ),
      });

      const metrics = calculatePropertyMetrics(
        txns.map((t) => ({
          category: t.category,
          amount: t.amount,
          transactionType: t.transactionType,
        }))
      );

      // Cross-domain: queries depreciation tables for financial year total
      const depreciationTotal = await getDepreciationTotal(ctx.db, ctx.portfolio.ownerId, startDate, endDate);

      return {
        totalIncome: metrics.totalIncome,
        totalExpenses: metrics.totalExpenses,
        netResult: metrics.netIncome, // negative = loss
        transactionCount: txns.length,
        depreciationTotal,
      };
    }),

  /**
   * Calculate tax position (stateless - accepts all inputs)
   */
  calculate: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().int(),
        grossSalary: z.number().min(0),
        paygWithheld: z.number().min(0),
        rentalNetResult: z.number(), // can be negative (loss) or positive (profit)
        otherDeductions: z.number().min(0).default(0),
        depreciationDeductions: z.number().min(0).default(0),
        hasHecsDebt: z.boolean().default(false),
        hasPrivateHealth: z.boolean().default(false),
        familyStatus: familyStatusSchema.default("single"),
        dependentChildren: z.number().int().min(0).default(0),
        partnerIncome: z.number().min(0).default(0),
      })
    )
    .query(({ input }) => {
      const taxInput: TaxPositionInput = {
        financialYear: input.financialYear,
        grossSalary: input.grossSalary,
        paygWithheld: input.paygWithheld,
        rentalNetResult: input.rentalNetResult,
        otherDeductions: input.otherDeductions,
        depreciationDeductions: input.depreciationDeductions,
        hasHecsDebt: input.hasHecsDebt,
        hasPrivateHealth: input.hasPrivateHealth,
        familyStatus: input.familyStatus,
        dependentChildren: input.dependentChildren,
        partnerIncome: input.partnerIncome,
      };

      return calculateTaxPosition(taxInput);
    }),

  /**
   * Get quick summary for dashboard card
   * Returns null if profile not complete
   */
  getSummary: protectedProcedure
    .input(z.object({ financialYear: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const year = input.financialYear ?? getCurrentFinancialYear();

      // Get profile
      const profile = await ctx.uow.tax.findProfileByUserAndYear(ctx.portfolio.ownerId, year);

      // Cross-domain: queries transactions table for financial year rental metrics
      const { startDate, endDate } = getFinancialYearRange(year);
      const txns = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        ),
      });

      const metrics = calculatePropertyMetrics(
        txns.map((t) => ({
          category: t.category,
          amount: t.amount,
          transactionType: t.transactionType,
        }))
      );

      const rentalNetResult = metrics.netIncome;

      // Cross-domain: queries depreciation tables for financial year total
      const depreciationTotal = await getDepreciationTotal(ctx.db, ctx.portfolio.ownerId, startDate, endDate);

      // If no complete profile, return teaser data
      if (!profile?.isComplete) {
        const estimatedSavings = estimatePropertySavings(rentalNetResult, 0.37);
        return {
          isComplete: false,
          financialYear: year,
          rentalNetResult,
          estimatedSavings,
          depreciationTotal,
          refundOrOwing: null,
          propertySavings: null,
        };
      }

      // Calculate full position
      const result = calculateTaxPosition({
        financialYear: year,
        grossSalary: Number(profile.grossSalary ?? 0),
        paygWithheld: Number(profile.paygWithheld ?? 0),
        rentalNetResult,
        otherDeductions: Number(profile.otherDeductions ?? 0),
        depreciationDeductions: depreciationTotal,
        hasHecsDebt: profile.hasHecsDebt,
        hasPrivateHealth: profile.hasPrivateHealth,
        familyStatus: profile.familyStatus,
        dependentChildren: profile.dependentChildren,
        partnerIncome: Number(profile.partnerIncome ?? 0),
      });

      return {
        isComplete: true,
        financialYear: year,
        rentalNetResult,
        estimatedSavings: null,
        depreciationTotal,
        refundOrOwing: result.refundOrOwing,
        propertySavings: result.propertySavings,
        isRefund: result.isRefund,
      };
    }),
});
