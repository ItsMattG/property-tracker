import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure, publicProcedure } from "../../trpc";
import { portfolioShares, properties, propertyValues, loans, transactions } from "../../db/schema";
import { eq, and, desc, gte, lte, inArray, sql } from "drizzle-orm";
import {
  generateShareToken,
  transformForPrivacy,
  type PortfolioSnapshot,
  type PrivacyMode,
  type PropertySnapshot,
  type SummarySnapshot,
} from "../../services/share";
import { getDateRangeForPeriod } from "../../services/transaction";

const privacyModeSchema = z.enum(["full", "summary", "redacted"]);

export const shareRouter = router({
  create: writeProcedure
    .input(
      z.object({
        title: z.string().min(1).max(100),
        privacyMode: privacyModeSchema.default("full"),
        expiresInDays: z.number().int().min(1).max(365).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's properties
      const userProperties = await ctx.db.query.properties.findMany({
        where: and(
          eq(properties.userId, ctx.portfolio.ownerId),
          eq(properties.status, "active")
        ),
      });

      if (userProperties.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No properties found to share",
        });
      }

      const propertyIds = userProperties.map((p) => p.id);

      // Get latest property values
      const allValues = await ctx.db.query.propertyValues.findMany({
        where: and(
          eq(propertyValues.userId, ctx.portfolio.ownerId),
          inArray(propertyValues.propertyId, propertyIds)
        ),
        orderBy: [desc(propertyValues.valueDate)],
      });

      const latestValues = new Map<string, number>();
      for (const v of allValues) {
        if (!latestValues.has(v.propertyId)) {
          latestValues.set(v.propertyId, Number(v.estimatedValue));
        }
      }

      // Get all loans
      const allLoans = await ctx.db.query.loans.findMany({
        where: and(
          eq(loans.userId, ctx.portfolio.ownerId),
          inArray(loans.propertyId, propertyIds)
        ),
      });

      const loansByProperty = new Map<string, number>();
      for (const loan of allLoans) {
        const current = loansByProperty.get(loan.propertyId) || 0;
        loansByProperty.set(loan.propertyId, current + Number(loan.currentBalance));
      }

      // Get transactions for the last 12 months (annual period)
      const { startDate, endDate } = getDateRangeForPeriod("annual");

      const periodTransactions = await ctx.db.query.transactions.findMany({
        where: and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          gte(transactions.date, startDate.toISOString().split("T")[0]),
          lte(transactions.date, endDate.toISOString().split("T")[0])
        ),
      });

      // Group transactions by property
      const transactionsByProperty = new Map<string, typeof periodTransactions>();
      for (const t of periodTransactions) {
        if (t.propertyId && propertyIds.includes(t.propertyId)) {
          const list = transactionsByProperty.get(t.propertyId) || [];
          list.push(t);
          transactionsByProperty.set(t.propertyId, list);
        }
      }

      // Calculate totals
      let totalValue = 0;
      let totalDebt = 0;
      let totalCashFlow = 0;
      let totalIncome = 0;

      const propertySnapshots: PropertySnapshot[] = userProperties.map((property) => {
        const value = latestValues.get(property.id) || Number(property.purchasePrice);
        const propertyLoans = loansByProperty.get(property.id) || 0;
        const propertyTransactions = transactionsByProperty.get(property.id) || [];

        totalValue += value;
        totalDebt += propertyLoans;

        // Calculate cash flow and income
        const income = propertyTransactions
          .filter((t) => t.transactionType === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        const expenses = propertyTransactions
          .filter((t) => t.transactionType === "expense")
          .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        const cashFlow = income - expenses;

        totalCashFlow += cashFlow;
        totalIncome += income;

        const equity = value - propertyLoans;
        const lvr = value > 0 ? (propertyLoans / value) * 100 : undefined;
        const grossYield = value > 0 ? (income / value) * 100 : undefined;

        return {
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          currentValue: value > 0 ? value : undefined,
          totalLoans: propertyLoans > 0 ? propertyLoans : undefined,
          equity: equity > 0 ? equity : undefined,
          lvr,
          cashFlow,
          grossYield,
          portfolioPercent: 0, // Will calculate after we have totalValue
        };
      });

      // Calculate portfolio percentages
      if (totalValue > 0) {
        for (const snapshot of propertySnapshots) {
          if (snapshot.currentValue) {
            snapshot.portfolioPercent = (snapshot.currentValue / totalValue) * 100;
          }
        }
      }

      // Get unique states
      const states = [...new Set(userProperties.map((p) => p.state))];

      // Build summary
      const totalEquity = totalValue - totalDebt;
      const portfolioLVR = totalValue > 0 ? (totalDebt / totalValue) * 100 : undefined;
      const averageYield = totalValue > 0 ? (totalIncome / totalValue) * 100 : undefined;

      const summary: SummarySnapshot = {
        propertyCount: userProperties.length,
        states,
        totalValue: totalValue > 0 ? totalValue : undefined,
        totalDebt: totalDebt > 0 ? totalDebt : undefined,
        totalEquity: totalEquity > 0 ? totalEquity : undefined,
        portfolioLVR,
        cashFlow: totalCashFlow,
        averageYield,
        cashFlowPositive: totalCashFlow >= 0,
      };

      // Build snapshot
      const snapshot: PortfolioSnapshot = {
        generatedAt: new Date().toISOString(),
        summary,
        properties: propertySnapshots,
      };

      // Apply privacy transformation
      const transformedSnapshot = transformForPrivacy(snapshot, input.privacyMode as PrivacyMode);

      // Generate token and calculate expiry
      const token = generateShareToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

      // Save to database
      const [share] = await ctx.db
        .insert(portfolioShares)
        .values({
          userId: ctx.portfolio.ownerId,
          token,
          title: input.title,
          privacyMode: input.privacyMode,
          snapshotData: transformedSnapshot,
          expiresAt,
          viewCount: 0,
        })
        .returning();

      // Build share URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const url = `${baseUrl}/share/${token}`;

      return {
        id: share.id,
        token: share.token,
        url,
        expiresAt: share.expiresAt,
      };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const shares = await ctx.db.query.portfolioShares.findMany({
      where: eq(portfolioShares.userId, ctx.portfolio.ownerId),
      orderBy: [desc(portfolioShares.createdAt)],
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return shares.map((share) => ({
      id: share.id,
      title: share.title,
      privacyMode: share.privacyMode,
      token: share.token,
      url: `${baseUrl}/share/${share.token}`,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount,
      createdAt: share.createdAt,
      lastViewedAt: share.lastViewedAt,
      isExpired: new Date() > share.expiresAt,
    }));
  }),

  revoke: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(portfolioShares)
        .where(
          and(
            eq(portfolioShares.id, input.id),
            eq(portfolioShares.userId, ctx.portfolio.ownerId)
          )
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found",
        });
      }

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const share = await ctx.db.query.portfolioShares.findFirst({
        where: eq(portfolioShares.token, input.token),
      });

      if (!share) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found or has been revoked",
        });
      }

      // Check if expired
      if (new Date() > share.expiresAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has expired",
        });
      }

      // Increment view count atomically and update last viewed
      await ctx.db
        .update(portfolioShares)
        .set({
          viewCount: sql`${portfolioShares.viewCount} + 1`,
          lastViewedAt: new Date(),
        })
        .where(eq(portfolioShares.id, share.id));

      return {
        title: share.title,
        privacyMode: share.privacyMode,
        snapshot: share.snapshotData as PortfolioSnapshot,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      };
    }),
});
