import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { bankAccounts } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const bankingRouter = router({
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.bankAccounts.findMany({
      where: eq(bankAccounts.userId, ctx.user.id),
      with: {
        defaultProperty: true,
      },
    });
  }),

  linkAccountToProperty: protectedProcedure
    .input(
      z.object({
        accountId: z.string().uuid(),
        propertyId: z.string().uuid().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .update(bankAccounts)
        .set({
          defaultPropertyId: input.propertyId,
        })
        .where(
          and(
            eq(bankAccounts.id, input.accountId),
            eq(bankAccounts.userId, ctx.user.id)
          )
        )
        .returning();

      return account;
    }),

  // Placeholder - will be implemented with Basiq integration
  getConnectionUrl: protectedProcedure.query(async () => {
    // TODO: Implement Basiq connection flow
    return {
      url: "https://connect.basiq.io/...",
      message: "Basiq integration coming soon",
    };
  }),
});
