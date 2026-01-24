import { router, protectedProcedure } from "../trpc";
import { properties, transactions } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";

export const statsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    // Count properties
    const propertiesResult = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(properties)
      .where(eq(properties.userId, ctx.portfolio.ownerId));

    // Count all transactions
    const transactionsResult = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(eq(transactions.userId, ctx.portfolio.ownerId));

    // Count uncategorized transactions
    const uncategorizedResult = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ctx.portfolio.ownerId),
          eq(transactions.category, "uncategorized")
        )
      );

    return {
      propertyCount: propertiesResult[0]?.count ?? 0,
      transactionCount: transactionsResult[0]?.count ?? 0,
      uncategorizedCount: uncategorizedResult[0]?.count ?? 0,
    };
  }),
});
