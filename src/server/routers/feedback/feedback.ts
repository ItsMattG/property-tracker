import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../../trpc";
import { sendEmailNotification } from "@/server/services/notification";
import { FeedbackRepository } from "../../repositories/feedback.repository";

export const feedbackRouter = router({
  // Public procedures: instantiate repo from ctx.db (no UoW on public context)
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
      const repo = new FeedbackRepository(ctx.db);
      return repo.listFeatures(input);
    }),

  getFeature: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const repo = new FeedbackRepository(ctx.db);
      const feature = await repo.findFeatureById(input.id);
      if (!feature) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feature not found",
        });
      }
      return feature;
    }),

  createFeature: protectedProcedure
    .input(
      z.object({
        title: z.string().min(5).max(200),
        description: z.string().min(20).max(2000),
        category: z.enum(["feature", "improvement", "integration", "other"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.feedback.createFeature(ctx.user.id, input);
    }),

  voteFeature: protectedProcedure
    .input(z.object({ featureId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.feedback.toggleVote(ctx.user.id, input.featureId);
    }),

  getUserVotes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.uow.feedback.getUserVotes(ctx.user.id);
  }),

  addComment: protectedProcedure
    .input(
      z.object({
        featureId: z.string().uuid(),
        content: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.uow.feedback.addComment(
        ctx.user.id,
        input.featureId,
        input.content
      );
    }),

  // submitBug sends email — no DB access, stays in router
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
            .map(
              ([key, value]) =>
                `<li><strong>${key}:</strong> ${value}</li>`
            )
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

      const recipient =
        process.env.BUG_REPORT_EMAIL || "bugs@bricktrack.com.au";
      const subject = `[Bug Report] [${input.severity.toUpperCase()}] ${input.description.slice(0, 80)}`;

      await sendEmailNotification(recipient, subject, html);
      return { id: "emailed" };
    }),

  // Admin-only: authorization check stays in router
  listBugs: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["new", "investigating", "fixed", "wont_fix"])
          .optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }
      return ctx.uow.feedback.listBugs(input);
    }),

  updateBugStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["new", "investigating", "fixed", "wont_fix"]),
        adminNotes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }
      return ctx.uow.feedback.updateBugStatus(input.id, {
        status: input.status,
        adminNotes: input.adminNotes,
        updatedAt: new Date(),
      });
    }),

  updateFeatureStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "open",
          "planned",
          "in_progress",
          "shipped",
          "rejected",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const adminIds = (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .filter(Boolean);
      if (!adminIds.includes(ctx.user.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }
      return ctx.uow.feedback.updateFeatureStatus(input.id, input.status);
    }),
});
