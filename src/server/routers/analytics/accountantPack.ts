import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Resend } from "resend";
import { router, protectedProcedure, writeProcedure, proProcedure } from "../../trpc";
import { properties, accountantPackSends } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
import { accountantPackEmailTemplate } from "@/lib/email/templates/accountant-pack";
import {
  buildMyTaxReport,
  getFinancialYearRange,
  getFinancialYearTransactions,
  calculatePropertyMetrics,
  calculateCategoryTotals,
} from "../../services/transaction";
import { categories } from "@/lib/categories";
import { logger } from "@/lib/logger";
import type { DB } from "../../repositories/base";

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

export const accountantPackRouter = router({
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

      // Build tax report data (needed for income/expenses section)
      const taxReport = await buildTaxReportData(
        ctx.portfolio.ownerId,
        financialYear,
        ctx.db
      );

      // Build MyTax report (needed for depreciation section)
      const myTaxReport = sections.depreciation
        ? await buildMyTaxReport(ctx.portfolio.ownerId, financialYear)
        : undefined;

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
        data: {
          taxReport,
          myTaxReport: myTaxReport || undefined,
          // CGT, tax position, portfolio, loan data left as undefined for sections not yet wired
        },
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

      // Build report data
      const taxReport = await buildTaxReportData(
        ctx.portfolio.ownerId,
        financialYear,
        ctx.db
      );
      const myTaxReport = sections.depreciation
        ? await buildMyTaxReport(ctx.portfolio.ownerId, financialYear)
        : undefined;

      // Generate PDF
      const pdfBuffer = generateAccountantPackPDF({
        financialYear,
        userName: ctx.user.name || ctx.user.email || "Unknown",
        accountantName,
        sections,
        data: {
          taxReport,
          myTaxReport: myTaxReport || undefined,
        },
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
