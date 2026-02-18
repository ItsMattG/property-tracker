import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { router, protectedProcedure, writeProcedure, proProcedure } from "../../trpc";
import { properties, accountantPackSends, transactions } from "../../db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
import type { AccountantPackConfig } from "@/lib/accountant-pack-pdf";
import { generateAccountantPackExcel } from "@/lib/accountant-pack-excel";
import { accountantPackEmailTemplate } from "@/lib/email/templates/accountant-pack";
import {
  buildMyTaxReport,
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculatePropertyMetrics,
  calculateCategoryTotals,
  calculateEquity,
  calculateLVR,
} from "../../services/transaction";
import {
  calculateTaxPosition,
  calculateCostBase,
  CAPITAL_CATEGORIES,
  type TaxPositionInput,
} from "../../services/tax";
import { categories } from "@/lib/categories";
import { logger } from "@/lib/logger";
import type { DB } from "../../repositories/base";
import type { UnitOfWork } from "../../repositories/unit-of-work";

const log = logger.child({ domain: "accountant-pack" });

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Email service not configured",
    });
  }
  return new Resend(apiKey);
}

const sectionsSchema = z.object({
  incomeExpenses: z.boolean(),
  depreciation: z.boolean(),
  capitalGains: z.boolean(),
  taxPosition: z.boolean(),
  portfolioOverview: z.boolean(),
  loanDetails: z.boolean(),
});

const SECTION_LABELS: Record<string, string> = {
  incomeExpenses: "Income & Expenses",
  depreciation: "Depreciation Schedule",
  capitalGains: "Capital Gains Tax",
  taxPosition: "Tax Position Summary",
  portfolioOverview: "Portfolio Overview",
  loanDetails: "Loan Details",
};

/**
 * Build tax report data from existing services.
 * Replicates the logic from reports.ts taxReport procedure as a reusable helper.
 */
async function buildTaxReportData(userId: string, year: number, db: DB) {
  const { startDate, endDate, label } = getFinancialYearRange(year);

  // Cross-domain: aggregates properties + transactions for report generation
  const userProperties = await db.query.properties.findMany({
    where: eq(properties.userId, userId),
  });

  const txns = await getFinancialYearTransactions(userId, year);

  const byProperty = new Map<string, typeof txns>();
  for (const t of txns) {
    if (t.propertyId) {
      const existing = byProperty.get(t.propertyId) || [];
      existing.push(t);
      byProperty.set(t.propertyId, existing);
    }
  }

  const propertyReports = userProperties.map((property) => {
    const propertyTxns = byProperty.get(property.id) || [];
    const metrics = calculatePropertyMetrics(propertyTxns);
    const categoryTotals = calculateCategoryTotals(propertyTxns);

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
}

/** Sections toggle type inferred from schema */
type Sections = z.infer<typeof sectionsSchema>;

/** Type for the data object passed to the PDF generator */
type PackData = AccountantPackConfig["data"];

/**
 * Convert a loan's repayment amount to a monthly figure based on its frequency.
 */
function toMonthlyRepayment(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return (amount * 52) / 12;
    case "fortnightly":
      return (amount * 26) / 12;
    case "monthly":
    default:
      return amount;
  }
}

/**
 * Build data for all 6 accountant pack sections in parallel.
 * Only fetches data for sections that are enabled.
 */
async function buildAllSectionData(
  userId: string,
  financialYear: number,
  sections: Sections,
  db: DB,
  uow: UnitOfWork,
): Promise<PackData> {
  const data: PackData = {};

  // --- Always-needed: Income & Expenses ---
  const taxReportPromise = buildTaxReportData(userId, financialYear, db);

  // --- Depreciation (conditional) ---
  const myTaxPromise = sections.depreciation
    ? buildMyTaxReport(userId, financialYear)
    : Promise.resolve(undefined);

  // --- Tax Position (conditional) ---
  const taxPositionPromise = sections.taxPosition
    ? buildTaxPositionData(userId, financialYear, db, uow)
    : Promise.resolve(undefined);

  // --- Capital Gains (conditional) ---
  const cgtPromise = sections.capitalGains
    ? buildCgtData(userId, financialYear, uow)
    : Promise.resolve(undefined);

  // --- Portfolio Overview (conditional) ---
  const portfolioPromise = sections.portfolioOverview
    ? buildPortfolioData(userId, uow)
    : Promise.resolve(undefined);

  // --- Loan Details (conditional) ---
  const loanPromise = sections.loanDetails
    ? buildLoanData(userId, uow)
    : Promise.resolve(undefined);

  // Execute all in parallel
  const [taxReport, myTaxReport, taxPosition, cgtData, portfolioSnapshot, loanPackSnapshot] =
    await Promise.all([
      taxReportPromise,
      myTaxPromise,
      taxPositionPromise,
      cgtPromise,
      portfolioPromise,
      loanPromise,
    ]);

  data.taxReport = taxReport;
  if (myTaxReport) data.myTaxReport = myTaxReport;
  if (taxPosition) data.taxPosition = taxPosition;
  if (cgtData) data.cgtData = cgtData;
  if (portfolioSnapshot) data.portfolioSnapshot = portfolioSnapshot;
  if (loanPackSnapshot) data.loanPackSnapshot = loanPackSnapshot;

  return data;
}

/**
 * Build tax position data from saved profile + rental metrics.
 * Returns undefined if the user has no complete tax profile for this year.
 */
async function buildTaxPositionData(
  userId: string,
  financialYear: number,
  db: DB,
  uow: UnitOfWork,
): Promise<PackData["taxPosition"] | undefined> {
  const profile = await uow.tax.findProfileByUserAndYear(userId, financialYear);
  if (!profile?.isComplete) return undefined;

  // Cross-domain: queries transactions for financial year rental metrics
  const { startDate, endDate } = getFinancialYearRange(financialYear);
  const txns = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ),
  });

  const metrics = calculatePropertyMetrics(
    txns.map((t) => ({
      category: t.category,
      amount: t.amount,
      transactionType: t.transactionType,
    })),
  );

  const taxInput: TaxPositionInput = {
    financialYear,
    grossSalary: Number(profile.grossSalary ?? 0),
    paygWithheld: Number(profile.paygWithheld ?? 0),
    rentalNetResult: metrics.netIncome,
    otherDeductions: Number(profile.otherDeductions ?? 0),
    hasHecsDebt: profile.hasHecsDebt,
    hasPrivateHealth: profile.hasPrivateHealth,
    familyStatus: profile.familyStatus,
    dependentChildren: profile.dependentChildren,
    partnerIncome: Number(profile.partnerIncome ?? 0),
  };

  const result = calculateTaxPosition(taxInput);

  return {
    taxableIncome: result.taxableIncome,
    baseTax: result.baseTax,
    medicareLevy: result.medicareLevy,
    medicareLevySurcharge: result.medicareLevySurcharge,
    hecsRepayment: result.hecsRepayment,
    totalTaxLiability: result.totalTaxLiability,
    paygWithheld: result.paygWithheld,
    refundOrOwing: result.refundOrOwing,
    isRefund: result.isRefund,
    marginalRate: result.marginalRate,
    propertySavings: result.propertySavings,
  };
}

/**
 * Build capital gains data for properties sold within the financial year.
 */
async function buildCgtData(
  userId: string,
  financialYear: number,
  uow: UnitOfWork,
): Promise<PackData["cgtData"] | undefined> {
  const { startDate, endDate } = getFinancialYearRange(financialYear);

  const [propertiesWithSales, allTxns] = await Promise.all([
    uow.property.findByOwnerWithSales(userId),
    uow.transactions.findAllByOwner(userId),
  ]);

  // Build capital transactions lookup by property
  const capitalTxnsByProperty = new Map<string, { category: string; amount: string }[]>();
  for (const txn of allTxns) {
    if (txn.propertyId && CAPITAL_CATEGORIES.includes(txn.category)) {
      const existing = capitalTxnsByProperty.get(txn.propertyId) ?? [];
      existing.push({ category: txn.category, amount: txn.amount });
      capitalTxnsByProperty.set(txn.propertyId, existing);
    }
  }

  // Filter to properties sold in this FY
  const soldInFY = propertiesWithSales.filter((p) => {
    const sale = p.sales?.[0];
    if (!sale) return false;
    return sale.settlementDate >= startDate && sale.settlementDate <= endDate;
  });

  return soldInFY.map((p) => {
    const sale = p.sales[0];
    const capitalTxns = capitalTxnsByProperty.get(p.id) ?? [];
    const costBase = calculateCostBase(p.purchasePrice, capitalTxns);

    return {
      propertyAddress: `${p.address}, ${p.suburb} ${p.state}`,
      purchaseDate: p.purchaseDate,
      saleDate: sale.settlementDate,
      costBase,
      salePrice: Number(sale.salePrice),
      capitalGain: Number(sale.capitalGain),
      discountedGain: sale.discountedGain ? Number(sale.discountedGain) : Number(sale.capitalGain),
      heldOverTwelveMonths: sale.heldOverTwelveMonths,
    };
  });
}

/**
 * Build portfolio overview snapshot with equity and LVR per property.
 */
async function buildPortfolioData(
  userId: string,
  uow: UnitOfWork,
): Promise<PackData["portfolioSnapshot"] | undefined> {
  const userProperties = await uow.portfolio.findProperties(userId);
  if (userProperties.length === 0) return undefined;

  const propertyIds = userProperties.map((p) => p.id);

  const [valuations, loans] = await Promise.all([
    uow.portfolio.getLatestPropertyValues(userId, propertyIds),
    uow.portfolio.findLoansByProperties(userId, propertyIds),
  ]);

  // Group loans by property
  const loansByProperty = new Map<string, number>();
  for (const loan of loans) {
    const existing = loansByProperty.get(loan.propertyId) ?? 0;
    loansByProperty.set(loan.propertyId, existing + Number(loan.currentBalance));
  }

  let totalValue = 0;
  let totalDebt = 0;

  const propertySnapshots = userProperties.map((p) => {
    const currentValue = valuations.get(p.id) ?? Number(p.purchasePrice);
    const debt = loansByProperty.get(p.id) ?? 0;
    const equity = calculateEquity(currentValue, debt);
    // calculateLVR returns percentage (0-100), PDF expects ratio (0-1)
    const lvrPct = calculateLVR(debt, currentValue);

    totalValue += currentValue;
    totalDebt += debt;

    return {
      address: p.address,
      suburb: p.suburb,
      state: p.state,
      purchasePrice: Number(p.purchasePrice),
      currentValue,
      equity,
      lvr: lvrPct != null ? lvrPct / 100 : 0,
    };
  });

  const totalEquity = calculateEquity(totalValue, totalDebt);
  const avgLvrPct = calculateLVR(totalDebt, totalValue);
  const avgLvr = avgLvrPct != null ? avgLvrPct / 100 : 0;

  return {
    properties: propertySnapshots,
    totals: {
      totalValue,
      totalDebt,
      totalEquity,
      avgLvr,
      propertyCount: userProperties.length,
    },
  };
}

/**
 * Build loan details snapshot grouped by property.
 */
async function buildLoanData(
  userId: string,
  uow: UnitOfWork,
): Promise<PackData["loanPackSnapshot"] | undefined> {
  const [loansWithRelations, userProperties] = await Promise.all([
    uow.loan.findByOwner(userId),
    uow.portfolio.findProperties(userId),
  ]);

  if (loansWithRelations.length === 0) return undefined;

  // Build address lookup
  const addressMap = new Map<string, string>();
  for (const p of userProperties) {
    addressMap.set(p.id, `${p.address}, ${p.suburb} ${p.state}`);
  }

  // Group loans by property
  const loansByProperty = new Map<string, typeof loansWithRelations>();
  for (const loan of loansWithRelations) {
    const existing = loansByProperty.get(loan.propertyId) ?? [];
    existing.push(loan);
    loansByProperty.set(loan.propertyId, existing);
  }

  let totalDebt = 0;
  let totalMonthlyRepayments = 0;
  let weightedRateSum = 0;

  const propertyLoans = Array.from(loansByProperty.entries()).map(([propertyId, propLoans]) => {
    const loanDetails = propLoans.map((loan) => {
      const balance = Number(loan.currentBalance);
      const rate = Number(loan.interestRate);
      const repayment = Number(loan.repaymentAmount);
      const monthlyRepayment = toMonthlyRepayment(repayment, loan.repaymentFrequency);

      totalDebt += balance;
      totalMonthlyRepayments += monthlyRepayment;
      weightedRateSum += rate * balance;

      return {
        lender: loan.lender,
        balance,
        rate,
        type: loan.loanType === "principal_and_interest" ? "P&I" : "Interest Only",
        monthlyRepayment,
      };
    });

    return {
      address: addressMap.get(propertyId) ?? "Unknown Property",
      loans: loanDetails,
    };
  });

  const avgRate = totalDebt > 0 ? weightedRateSum / totalDebt : 0;

  return {
    properties: propertyLoans,
    totals: {
      totalDebt,
      avgRate,
      monthlyRepayments: totalMonthlyRepayments,
    },
  };
}

export const accountantPackRouter = router({
  /**
   * Return raw section data for all 6 sections (for client-side preview / Excel export).
   */
  generatePackData: protectedProcedure
    .input(
      z.object({
        financialYear: z.number().min(2000).max(2100),
        sections: sectionsSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { financialYear, sections } = input;

      const data = await buildAllSectionData(
        ctx.portfolio.ownerId,
        financialYear,
        sections,
        ctx.db,
        ctx.uow,
      );

      return {
        financialYear,
        sections,
        data,
        generatedAt: new Date().toISOString(),
      };
    }),

  /**
   * Generate accountant pack PDF for preview/download.
   * writeProcedure because it does heavy server-side computation on demand.
   */
  generatePack: writeProcedure
    .input(
      z.object({
        financialYear: z.number().min(2000).max(2100),
        sections: sectionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { financialYear, sections } = input;

      // Build all section data in parallel
      const data = await buildAllSectionData(
        ctx.portfolio.ownerId,
        financialYear,
        sections,
        ctx.db,
        ctx.uow,
      );

      // Get connected accountant name for the PDF cover page
      const members = await ctx.uow.team.listMembers(ctx.portfolio.ownerId);
      const accountant = members.find(
        (m) => m.role === "accountant" && m.joinedAt !== null
      );

      const pdfBuffer = generateAccountantPackPDF({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName: accountant?.user?.name || undefined,
        sections,
        data,
      });

      return {
        pdf: Buffer.from(pdfBuffer).toString("base64"),
        filename: `accountant-pack-FY${financialYear}.pdf`,
      };
    }),

  /**
   * Generate and email the accountant pack to the connected accountant.
   * Pro+ plan required — proProcedure auto-throws FORBIDDEN for free plan.
   */
  sendToAccountant: proProcedure
    .input(
      z.object({
        financialYear: z.number().min(2000).max(2100),
        sections: sectionsSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { financialYear, sections } = input;

      // Find connected accountant (joined member) and pending invites in parallel
      const [members, invites] = await Promise.all([
        ctx.uow.team.listMembers(ctx.portfolio.ownerId),
        ctx.uow.team.listPendingInvites(ctx.portfolio.ownerId),
      ]);
      const accountant = members.find(
        (m) => m.role === "accountant" && m.joinedAt !== null
      );
      const accountantInvite = invites.find(
        (inv) => inv.role === "accountant" && inv.status === "pending"
      );

      const accountantEmail = accountant?.user?.email || accountantInvite?.email;
      const accountantName = accountant?.user?.name || undefined;

      if (!accountantEmail) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No accountant connected. Add an accountant in Settings > Advisors first.",
        });
      }

      // Build all section data in parallel
      const data = await buildAllSectionData(
        ctx.portfolio.ownerId,
        financialYear,
        sections,
        ctx.db,
        ctx.uow,
      );

      // Generate PDF
      const pdfBuffer = generateAccountantPackPDF({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName,
        sections,
        data,
      });

      // Generate Excel
      const excelBuffer = await generateAccountantPackExcel({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName,
        sections,
        data,
      });

      // Build enabled sections list for email template
      const enabledSections = Object.entries(sections)
        .filter(([, enabled]) => enabled)
        .map(([key]) => SECTION_LABELS[key] || key);

      // Build email HTML
      const html = accountantPackEmailTemplate({
        userName: ctx.user.name || ctx.user.email || "Unknown",
        userEmail: ctx.user.email || "",
        financialYear,
        sections: enabledSections,
      });

      // Send via Resend with PDF attachment
      const resend = getResendClient();
      try {
        await resend.emails.send({
          from:
            process.env.EMAIL_FROM ||
            "BrickTrack <notifications@bricktrack.au>",
          to: accountantEmail,
          subject: `BrickTrack — FY${financialYear} Property Investment Report from ${ctx.user.name || ctx.user.email}`,
          html,
          attachments: [
            {
              filename: `accountant-pack-FY${financialYear}.pdf`,
              content: Buffer.from(pdfBuffer),
            },
            {
              filename: `accountant-pack-FY${financialYear}.xlsx`,
              content: Buffer.from(excelBuffer),
            },
          ],
        });
      } catch (error) {
        log.error("Failed to send accountant pack email", error as Error, {
          userId: ctx.user.id,
          accountantEmail,
          financialYear,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send email. Please try again.",
        });
      }

      // Log send to database (cross-domain: writes to accountantPackSends from analytics context)
      await ctx.db.insert(accountantPackSends).values({
        userId: ctx.portfolio.ownerId,
        accountantEmail,
        accountantName,
        financialYear,
        sections,
      });

      log.info("Accountant pack sent", {
        userId: ctx.user.id,
        accountantEmail,
        financialYear,
        sections: enabledSections,
      });

      return { success: true as const, sentTo: accountantEmail };
    }),

  /**
   * Get history of sent accountant packs for this portfolio.
   */
  getSendHistory: protectedProcedure.query(async ({ ctx }) => {
    // Cross-domain: reads accountantPackSends table from analytics context
    const sends = await ctx.db.query.accountantPackSends.findMany({
      where: eq(accountantPackSends.userId, ctx.portfolio.ownerId),
      orderBy: [desc(accountantPackSends.sentAt)],
    });

    return sends.map((send) => ({
      id: send.id,
      accountantEmail: send.accountantEmail,
      accountantName: send.accountantName,
      financialYear: send.financialYear,
      sections: send.sections,
      sentAt: send.sentAt.toISOString(),
    }));
  }),
});
