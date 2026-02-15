import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../trpc";
import { changelogEntries } from "../../db/schema";
import { eq, desc, gt, and } from "drizzle-orm";

export const changelogRouter = router({
  // publicProcedure — no ctx.uow available
  list: publicProcedure
    .input(
      z.object({
        category: z.enum(["feature", "improvement", "fix"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.category) {
        conditions.push(eq(changelogEntries.category, input.category));
      }
      if (input.cursor) {
        conditions.push(gt(changelogEntries.id, input.cursor));
      }

      const entries = await ctx.db
        .select()
        .from(changelogEntries)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(changelogEntries.publishedAt))
        .limit(input.limit + 1);

      let nextCursor: string | undefined;
      if (entries.length > input.limit) {
        const nextItem = entries.pop();
        nextCursor = nextItem?.id;
      }
      return { entries, nextCursor };
    }),

  // publicProcedure — no ctx.uow available
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(changelogEntries)
        .where(eq(changelogEntries.id, input.slug));
      return entry ?? null;
    }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const view = await ctx.uow.changelog.findUserView(ctx.user.id);
    if (!view) {
      return ctx.uow.changelog.countAll();
    }
    return ctx.uow.changelog.countNewerThan(view.lastViewedAt);
  }),

  markAsViewed: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.uow.changelog.upsertUserView(ctx.user.id);
    return { success: true };
  }),
});
