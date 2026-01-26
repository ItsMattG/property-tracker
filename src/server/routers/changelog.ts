import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc";
import { changelogEntries, userChangelogViews } from "../db/schema";
import { eq, desc, gt, and } from "drizzle-orm";

export const changelogRouter = router({
  // List entries with optional filtering (public)
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

  // Get single entry by slug (public)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select()
        .from(changelogEntries)
        .where(eq(changelogEntries.id, input.slug));

      return entry ?? null;
    }),

  // Get count of unread entries (protected)
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [view] = await ctx.db
      .select()
      .from(userChangelogViews)
      .where(eq(userChangelogViews.userId, ctx.user.id));

    if (!view) {
      // User has never viewed - count all entries
      const entries = await ctx.db.select().from(changelogEntries);
      return entries.length;
    }

    // Count entries newer than last viewed
    const entries = await ctx.db
      .select()
      .from(changelogEntries)
      .where(gt(changelogEntries.createdAt, view.lastViewedAt));

    return entries.length;
  }),

  // Mark as viewed (protected)
  markAsViewed: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .insert(userChangelogViews)
      .values({
        userId: ctx.user.id,
        lastViewedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userChangelogViews.userId,
        set: { lastViewedAt: new Date() },
      });

    return { success: true };
  }),
});
