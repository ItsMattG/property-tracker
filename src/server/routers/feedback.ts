import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import {
  featureRequests,
  featureVotes,
  featureComments,
  bugReports,
  users,
} from "../db/schema";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { sendEmailNotification } from "@/server/services/notification";

export const feedbackRouter = router({
  // List all feature requests (public)
  listFeatures: publicProcedure
    .input(
      z.object({
        status: z
          .enum(["open", "planned", "in_progress", "shipped", "rejected"])
          .optional(),
        sortBy: z.enum(["votes", "newest", "oldest"]).default("votes"),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = input.status
        ? eq(featureRequests.status, input.status)
        : undefined;

      const orderBy =
        input.sortBy === "votes"
          ? desc(featureRequests.voteCount)
          : input.sortBy === "newest"
            ? desc(featureRequests.createdAt)
            : asc(featureRequests.createdAt);

      const features = await ctx.db
        .select({
          id: featureRequests.id,
          title: featureRequests.title,
          description: featureRequests.description,
          category: featureRequests.category,
          status: featureRequests.status,
          voteCount: featureRequests.voteCount,
          createdAt: featureRequests.createdAt,
          userName: users.name,
        })
        .from(featureRequests)
        .leftJoin(users, eq(featureRequests.userId, users.id))
        .where(conditions)
        .orderBy(orderBy)
        .limit(input.limit)
        .offset(input.offset);

      return features;
    }),

  // Get single feature with comments
  getFeature: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .select({
          id: featureRequests.id,
          title: featureRequests.title,
          description: featureRequests.description,
          category: featureRequests.category,
          status: featureRequests.status,
          voteCount: featureRequests.voteCount,
          createdAt: featureRequests.createdAt,
          userName: users.name,
        })
        .from(featureRequests)
        .leftJoin(users, eq(featureRequests.userId, users.id))
        .where(eq(featureRequests.id, input.id));

      if (!feature) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feature not found" });
      }

      const comments = await ctx.db
        .select({
          id: featureComments.id,
          content: featureComments.content,
          createdAt: featureComments.createdAt,
          userName: users.name,
        })
        .from(featureComments)
        .leftJoin(users, eq(featureComments.userId, users.id))
        .where(eq(featureComments.featureId, input.id))
        .orderBy(asc(featureComments.createdAt));

      return { ...feature, comments };
    }),

  // Create feature request (authenticated)
  createFeature: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().min(20).max(2000),
        category: z.enum(["feature", "improvement", "integration", "other"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .insert(featureRequests)
        .values({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
        })
        .returning();

      return feature;
    }),

  // Vote on feature (authenticated)
  voteFeature: protectedProcedure
    .input(z.object({ featureId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if already voted
      const [existingVote] = await ctx.db
        .select()
        .from(featureVotes)
        .where(
          and(
            eq(featureVotes.userId, ctx.user.id),
            eq(featureVotes.featureId, input.featureId)
          )
        );

      if (existingVote) {
        // Remove vote
        await ctx.db
          .delete(featureVotes)
          .where(eq(featureVotes.id, existingVote.id));

        await ctx.db
          .update(featureRequests)
          .set({ voteCount: sql`${featureRequests.voteCount} - 1` })
          .where(eq(featureRequests.id, input.featureId));

        return { voted: false };
      }

      // Add vote
      await ctx.db.insert(featureVotes).values({
        userId: ctx.user.id,
        featureId: input.featureId,
      });

      await ctx.db
        .update(featureRequests)
        .set({ voteCount: sql`${featureRequests.voteCount} + 1` })
        .where(eq(featureRequests.id, input.featureId));

      return { voted: true };
    }),

  // Check if user has voted (authenticated)
  getUserVotes: protectedProcedure.query(async ({ ctx }) => {
    const votes = await ctx.db
      .select({ featureId: featureVotes.featureId })
      .from(featureVotes)
      .where(eq(featureVotes.userId, ctx.user.id));

    return votes.map((v) => v.featureId);
  }),

  // Add comment (authenticated)
  addComment: protectedProcedure
    .input(
      z.object({
        featureId: z.string().uuid(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [comment] = await ctx.db
        .insert(featureComments)
        .values({
          featureId: input.featureId,
          userId: ctx.user.id,
          content: input.content,
        })
        .returning();

      return comment;
    }),

  // Submit bug report (authenticated) — sends email instead of DB insert
  submitBug: protectedProcedure
    .input(
      z.object({
        description: z.string().min(10).max(2000),
        stepsToReproduce: z.string().max(2000).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        browserInfo: z.record(z.string(), z.string()).optional(),
        currentPage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const reporterEmail = ctx.user.email;
      const reporterName = ctx.user.name || reporterEmail;

      const browserInfoHtml = input.browserInfo
        ? Object.entries(input.browserInfo)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
            .join("")
        : "<li>Not provided</li>";

      const html = `
        <h2>Bug Report from ${reporterName}</h2>
        <p><strong>Severity:</strong> ${input.severity.toUpperCase()}</p>
        <p><strong>Reporter:</strong> ${reporterEmail}</p>
        <p><strong>Page:</strong> ${input.currentPage || "Unknown"}</p>
        <h3>Description</h3>
        <p>${input.description.replace(/\n/g, "<br>")}</p>
        ${input.stepsToReproduce ? `<h3>Steps to Reproduce</h3><p>${input.stepsToReproduce.replace(/\n/g, "<br>")}</p>` : ""}
        <h3>Browser Info</h3>
        <ul>${browserInfoHtml}</ul>
      `.trim();

      const recipient = process.env.BUG_REPORT_EMAIL || "bugs@bricktrack.com.au";
      const subject = `[Bug Report] [${input.severity.toUpperCase()}] ${input.description.slice(0, 80)}`;

      await sendEmailNotification(recipient, subject, html);

      return { id: "emailed" };
    }),

  // List bug reports (admin only - check env ADMIN_USER_IDS)
  listBugs: protectedProcedure
    .input(
      z.object({
        status: z.enum(["new", "investigating", "fixed", "wont_fix"]).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const conditions = [];
      if (input.status) conditions.push(eq(bugReports.status, input.status));
      if (input.severity) conditions.push(eq(bugReports.severity, input.severity));

      const whereClause =
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(conditions[0], conditions[1]);

      const bugs = await ctx.db
        .select({
          id: bugReports.id,
          description: bugReports.description,
          stepsToReproduce: bugReports.stepsToReproduce,
          severity: bugReports.severity,
          browserInfo: bugReports.browserInfo,
          currentPage: bugReports.currentPage,
          status: bugReports.status,
          adminNotes: bugReports.adminNotes,
          createdAt: bugReports.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(bugReports)
        .leftJoin(users, eq(bugReports.userId, users.id))
        .where(whereClause)
        .orderBy(desc(bugReports.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return bugs;
    }),

  // Update bug report status (admin only)
  updateBugStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["new", "investigating", "fixed", "wont_fix"]),
        adminNotes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const [updated] = await ctx.db
        .update(bugReports)
        .set({
          status: input.status,
          adminNotes: input.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(bugReports.id, input.id))
        .returning();

      return updated;
    }),

  // Update feature status (admin only)
  updateFeatureStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "planned", "in_progress", "shipped", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }

      const [updated] = await ctx.db
        .update(featureRequests)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(eq(featureRequests.id, input.id))
        .returning();

      return updated;
    }),
});
