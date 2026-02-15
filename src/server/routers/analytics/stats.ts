import { router, protectedProcedure } from "../../trpc";
import { properties, transactions } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";

export const statsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    // Run all count queries in parallel
    const [propertiesResult, transactionsResult, uncategorizedResult] =
      await Promise.all([
        // Count properties
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(properties)
          .where(eq(properties.userId, ctx.portfolio.ownerId)),
        // Count all transactions
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(eq(transactions.userId, ctx.portfolio.ownerId)),
        // Count uncategorized transactions
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transactions)
          .where(
            and(
              eq(transactions.userId, ctx.portfolio.ownerId),
              eq(transactions.category, "uncategorized")
            )
          ),
      ]);

    return {
      propertyCount: propertiesResult[0]?.count ?? 0,
      transactionCount: transactionsResult[0]?.count ?? 0,
      uncategorizedCount: uncategorizedResult[0]?.count ?? 0,
    };
  }),
});
