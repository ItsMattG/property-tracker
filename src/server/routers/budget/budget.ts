import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../../trpc";

export const budgetRouter = router({
  // --- Personal Categories ---
  categoryList: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.personalCategories.findByUser(ctx.portfolio.ownerId);
  }),

  categoryCreate: writeProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        group: z.enum(["needs", "wants", "savings"]).nullable(),
        icon: z.string().default("circle"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.personalCategories.create({
        userId: ctx.portfolio.ownerId,
        ...input,
      });
    }),

  // --- Budgets ---
  list: protectedProcedure
    .input(z.object({ month: z.date() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.budgets.findByUser(ctx.portfolio.ownerId, input.month);
    }),

  create: writeProcedure
    .input(
      z.object({
        personalCategoryId: z.string().uuid().nullable(),
        monthlyAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
        effectiveFrom: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.budgets.create({
        userId: ctx.portfolio.ownerId,
        personalCategoryId: input.personalCategoryId,
        monthlyAmount: input.monthlyAmount,
        effectiveFrom: input.effectiveFrom,
      });
    }),

  update: writeProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        monthlyAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const budget = await ctx.uow.budgets.update(
        input.id,
        ctx.portfolio.ownerId,
        {
          monthlyAmount: input.monthlyAmount,
        }
      );
      if (!budget) throw new TRPCError({ code: "NOT_FOUND" });
      return budget;
    }),

  delete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.budgets.delete(input.id, ctx.portfolio.ownerId);
    }),

  setup: writeProcedure
    .input(
      z.object({
        monthlyTarget: z.string().regex(/^\d+(\.\d{1,2})?$/),
        categoryBudgets: z
          .array(
            z.object({
              categoryName: z.string(),
              group: z.enum(["needs", "wants", "savings"]).nullable(),
              monthlyAmount: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.portfolio.ownerId;
      const categories =
        await ctx.uow.personalCategories.seedDefaults(userId);
      const now = new Date();
      const effectiveFrom = new Date(now.getFullYear(), now.getMonth(), 1);

      await ctx.uow.budgets.create({
        userId,
        personalCategoryId: null,
        monthlyAmount: input.monthlyTarget,
        effectiveFrom,
      });

      if (input.categoryBudgets) {
        for (const cb of input.categoryBudgets) {
          const cat = categories.find((c) => c.name === cb.categoryName);
          if (cat) {
            await ctx.uow.budgets.create({
              userId,
              personalCategoryId: cat.id,
              monthlyAmount: cb.monthlyAmount,
              effectiveFrom,
            });
          }
        }
      }

      return { categories };
    }),

  surplus: protectedProcedure.query(async ({ ctx }) => {
    const [avgExpenses, summary] = await Promise.all([
      ctx.uow.budgets.getAverageMonthlyExpenses(ctx.portfolio.ownerId, 3),
      ctx.uow.personalTransactions.getMonthlySummary(
        ctx.portfolio.ownerId,
        3
      ),
    ]);
    const avgIncome =
      summary.reduce((sum, m) => sum + m.income, 0) /
      Math.max(summary.length, 1);
    const monthlySurplus = avgIncome - avgExpenses;

    return {
      avgMonthlyIncome: avgIncome,
      avgMonthlyExpenses: avgExpenses,
      monthlySurplus,
      annualSavingsCapacity: monthlySurplus * 12,
    };
  }),

  // --- Personal Transactions ---
  transactionList: protectedProcedure
    .input(
      z.object({
        categoryId: z.string().uuid().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.findByUser(
        ctx.portfolio.ownerId,
        input
      );
    }),

  transactionCreate: writeProcedure
    .input(
      z.object({
        date: z.date(),
        description: z.string().min(1),
        amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
        personalCategoryId: z.string().uuid().nullable(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.create({
        userId: ctx.portfolio.ownerId,
        ...input,
      });
    }),

  transactionDelete: writeProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.personalTransactions.delete(
        input.id,
        ctx.portfolio.ownerId
      );
    }),

  monthlySummary: protectedProcedure
    .input(z.object({ months: z.number().min(1).max(24).default(6) }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.personalTransactions.getMonthlySummary(
        ctx.portfolio.ownerId,
        input.months
      );
    }),
});
