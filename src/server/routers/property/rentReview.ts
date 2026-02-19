import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";
import { eq, and, gte, sql } from "drizzle-orm";
import { transactions, properties } from "../../db/schema";
import { getRentIncreaseRule } from "@/lib/rent-increase-rules";

type RentReviewStatus =
  | "below_market_critical"
  | "below_market_warning"
  | "at_market"
  | "above_market"
  | "no_review";

function calculateStatus(gapPercent: number): RentReviewStatus {
  if (gapPercent > 20) return "below_market_critical";
  if (gapPercent > 10) return "below_market_warning";
  if (gapPercent < -10) return "above_market";
  return "at_market";
}

export const rentReviewRouter = router({
  getForProperty: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify property ownership — cross-domain, stays ctx.db
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Get rent review via repository
      const review = await ctx.uow.rentReview.findByPropertyId(
        input.propertyId,
        ctx.portfolio.ownerId
      );

      if (!review) {
        return {
          propertyId: input.propertyId,
          status: "no_review" as RentReviewStatus,
          currentRentWeekly: null,
          marketRentWeekly: null,
          gapPercent: null,
          annualUplift: null,
          review: null,
          noticeRules: getRentIncreaseRule(property.state) ?? null,
        };
      }

      // Calculate actual rent from last 12 months of rental_income transactions
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
      const currentRentWeekly = annualRent / 52;
      const marketRentWeekly = parseFloat(review.marketRentWeekly);

      // Gap: how far below market the current rent is
      // Positive = below market, negative = above market
      const gapPercent =
        currentRentWeekly > 0
          ? Math.round(
              ((marketRentWeekly - currentRentWeekly) / currentRentWeekly) * 100 *
                100
            ) / 100
          : marketRentWeekly > 0
            ? 100
            : 0;

      const annualUplift = (marketRentWeekly - currentRentWeekly) * 52;
      const status = calculateStatus(gapPercent);

      return {
        propertyId: input.propertyId,
        status,
        currentRentWeekly: Math.round(currentRentWeekly * 100) / 100,
        marketRentWeekly,
        gapPercent,
        annualUplift: Math.round(annualUplift * 100) / 100,
        review: {
          id: review.id,
          lastReviewedAt: review.lastReviewedAt,
          nextReviewDate: review.nextReviewDate,
          dataSource: review.dataSource,
          notes: review.notes,
        },
        noticeRules: getRentIncreaseRule(property.state) ?? null,
      };
    }),

  setMarketRent: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        marketRentWeekly: z.number().positive(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify property ownership — cross-domain, stays ctx.db
      const property = await ctx.db.query.properties.findFirst({
        where: and(
          eq(properties.id, input.propertyId),
          eq(properties.userId, ctx.portfolio.ownerId)
        ),
      });

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      const now = new Date();
      const nextReviewDate = new Date(now);
      nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

      const review = await ctx.uow.rentReview.upsert({
        propertyId: input.propertyId,
        userId: ctx.portfolio.ownerId,
        marketRentWeekly: input.marketRentWeekly.toString(),
        dataSource: "manual",
        lastReviewedAt: now,
        nextReviewDate: nextReviewDate.toISOString().split("T")[0],
        notes: input.notes ?? null,
      });

      return review;
    }),

  getPortfolioSummary: protectedProcedure.query(async ({ ctx }) => {
    // Fetch all properties and rent reviews in parallel
    const [userProperties, allReviews] = await Promise.all([
      ctx.db.query.properties.findMany({
        where: eq(properties.userId, ctx.portfolio.ownerId),
      }),
      ctx.uow.rentReview.findAllByUser(ctx.portfolio.ownerId),
    ]);

    if (userProperties.length === 0) {
      return { properties: [], summary: { totalAnnualUplift: 0, reviewedCount: 0, totalCount: 0 } };
    }

    // Index reviews by propertyId for O(1) lookup
    const reviewsByProperty = new Map(
      allReviews.map((r) => [r.propertyId, r])
    );

    // Calculate rent for each property from last 12 months
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoffDate = oneYearAgo.toISOString().split("T")[0];
    const propertyIds = userProperties.map((p) => p.id);

    // Batch fetch rent totals
    const rentTotals = await ctx.db
      .select({
        propertyId: transactions.propertyId,
        total: sql<string>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)`,
      })
      .from(transactions)
      .where(
        and(
          sql`${transactions.propertyId} IN (${sql.join(
            propertyIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          eq(transactions.category, "rental_income"),
          gte(transactions.date, cutoffDate)
        )
      )
      .groupBy(transactions.propertyId);

    const rentByProperty = new Map(
      rentTotals.map((r) => [r.propertyId, parseFloat(r.total)])
    );

    const results = userProperties.map((property) => {
      const review = reviewsByProperty.get(property.id);
      const annualRent = rentByProperty.get(property.id) ?? 0;
      const currentRentWeekly = annualRent / 52;

      if (!review) {
        return {
          propertyId: property.id,
          address: property.address,
          suburb: property.suburb,
          state: property.state,
          status: "no_review" as RentReviewStatus,
          currentRentWeekly: Math.round(currentRentWeekly * 100) / 100,
          marketRentWeekly: null,
          gapPercent: null,
          annualUplift: null,
        };
      }

      const marketRentWeekly = parseFloat(review.marketRentWeekly);
      const gapPercent =
        currentRentWeekly > 0
          ? Math.round(
              ((marketRentWeekly - currentRentWeekly) / currentRentWeekly) * 100 *
                100
            ) / 100
          : marketRentWeekly > 0
            ? 100
            : 0;

      const annualUplift = (marketRentWeekly - currentRentWeekly) * 52;
      const status = calculateStatus(gapPercent);

      return {
        propertyId: property.id,
        address: property.address,
        suburb: property.suburb,
        state: property.state,
        status,
        currentRentWeekly: Math.round(currentRentWeekly * 100) / 100,
        marketRentWeekly,
        gapPercent,
        annualUplift: Math.round(annualUplift * 100) / 100,
      };
    });

    // Sort by gap descending (highest underpriced first), no_review at end
    results.sort((a, b) => {
      if (a.gapPercent === null && b.gapPercent === null) return 0;
      if (a.gapPercent === null) return 1;
      if (b.gapPercent === null) return -1;
      return b.gapPercent - a.gapPercent;
    });

    const reviewed = results.filter((r) => r.status !== "no_review");
    const totalAnnualUplift = reviewed.reduce(
      (sum, r) => sum + (r.annualUplift ?? 0),
      0
    );

    return {
      properties: results,
      summary: {
        totalAnnualUplift: Math.round(totalAnnualUplift * 100) / 100,
        reviewedCount: reviewed.length,
        totalCount: userProperties.length,
      },
    };
  }),
});
