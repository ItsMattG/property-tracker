import { router, protectedProcedure } from "../../trpc";

export const activityRouter = router({
  getRecent: protectedProcedure.query(async ({ ctx }) => {
    const ownerId = ctx.portfolio.ownerId;

    // Fetch recent items from each repo in parallel
    const [recentTransactions, recentProperties, recentLoans] = await Promise.all([
      ctx.uow.transactions.findRecent(ownerId, 5),
      ctx.uow.property.findRecent(ownerId, 3),
      ctx.uow.loan.findRecent(ownerId, 3),
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
