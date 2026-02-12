import { router, protectedProcedure } from "../trpc";
import { transactions, properties, loans } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const activityRouter = router({
  getRecent: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    // Fetch recent items from each table in parallel
    const [recentTransactions, recentProperties, recentLoans] = await Promise.all([
      ctx.db.query.transactions.findMany({
        where: eq(transactions.userId, ownerId),
        orderBy: [desc(transactions.createdAt)],
        limit: 5,
        columns: {
          id: true,
          description: true,
          amount: true,
          category: true,
          createdAt: true,
          propertyId: true,
        },
      }),
      ctx.db.query.properties.findMany({
        where: eq(properties.userId, ownerId),
        orderBy: [desc(properties.createdAt)],
        limit: 3,
        columns: {
          id: true,
          address: true,
          createdAt: true,
        },
      }),
      ctx.db.query.loans.findMany({
        where: eq(loans.userId, ownerId),
        orderBy: [desc(loans.updatedAt)],
        limit: 3,
        columns: {
          id: true,
          lender: true,
          currentBalance: true,
          updatedAt: true,
        },
      }),
    ]);

    // Unify into a single activity stream
    const activities: Array<{
      type: "transaction" | "property" | "loan";
      description: string;
      timestamp: Date;
      href: string;
    }> = [];

    for (const t of recentTransactions) {
      const amount = new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 0,
      }).format(Math.abs(Number(t.amount)));

      activities.push({
        type: "transaction",
        description: `${t.description || "Transaction"} — ${amount}`,
        timestamp: new Date(t.createdAt),
        href: `/transactions/${t.id}/edit`,
      });
    }

    for (const p of recentProperties) {
      activities.push({
        type: "property",
        description: `Property added: ${p.address}`,
        timestamp: new Date(p.createdAt),
        href: `/properties/${p.id}`,
      });
    }

    for (const l of recentLoans) {
      activities.push({
        type: "loan",
        description: `Loan updated: ${l.lender}`,
        timestamp: new Date(l.updatedAt),
        href: `/loans/${l.id}/edit`,
      });
    }

    // Sort by timestamp descending and take top 8
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, 8);
  }),
});
