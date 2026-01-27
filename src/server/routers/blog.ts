import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { blogPosts } from "../db/schema";
import { eq, desc, lte, and, sql } from "drizzle-orm";

export const blogRouter = router({
  // List published posts with optional category/tag filtering
  list: publicProcedure
    .input(
      z.object({
        category: z
          .enum(["fundamentals", "strategy", "finance", "tax", "advanced"])
          .optional(),
        tag: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().optional(), // post id for cursor-based pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date().toISOString().split("T")[0];
      const conditions = [lte(blogPosts.publishedAt, now)];

      if (input.category) {
        conditions.push(eq(blogPosts.category, input.category));
      }

      if (input.tag) {
        conditions.push(sql`${input.tag} = ANY(${blogPosts.tags})`);
      }

      const posts = await ctx.db
        .select({
          id: blogPosts.id,
          slug: blogPosts.slug,
          title: blogPosts.title,
          summary: blogPosts.summary,
          category: blogPosts.category,
          tags: blogPosts.tags,
          author: blogPosts.author,
          publishedAt: blogPosts.publishedAt,
        })
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(desc(blogPosts.publishedAt))
        .limit(input.limit + 1);

      let nextCursor: number | undefined;
      if (posts.length > input.limit) {
        const nextItem = posts.pop();
        nextCursor = nextItem?.id;
      }

      return { posts, nextCursor };
    }),

  // Get single post by slug (only if published)
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date().toISOString().split("T")[0];
      const [post] = await ctx.db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, input.slug), lte(blogPosts.publishedAt, now)));

      return post ?? null;
    }),

  // Get categories with post counts
  categories: publicProcedure.query(async ({ ctx }) => {
    const now = new Date().toISOString().split("T")[0];
    const result = await ctx.db
      .select({
        category: blogPosts.category,
        count: sql<number>`count(*)::int`,
      })
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .groupBy(blogPosts.category);

    return result;
  }),

  // Get all tags with post counts
  tags: publicProcedure.query(async ({ ctx }) => {
    const now = new Date().toISOString().split("T")[0];
    const result = await ctx.db
      .select({
        tag: sql<string>`unnest(${blogPosts.tags})`,
        count: sql<number>`count(*)::int`,
      })
      .from(blogPosts)
      .where(lte(blogPosts.publishedAt, now))
      .groupBy(sql`unnest(${blogPosts.tags})`);

    return result;
  }),
});
