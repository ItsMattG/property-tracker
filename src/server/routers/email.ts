import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  recordSenderPropertyMatch,
  ensureForwardingAddress,
  regenerateForwardingAddress,
  processEmailBackground,
} from "../services/email";

export const emailRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.string().uuid().optional(),
        status: z.enum(["approved", "quarantined", "rejected"]).optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.email.findByOwner(ctx.portfolio.ownerId, {
        propertyId: input.propertyId,
        status: input.status,
        unreadOnly: input.unreadOnly,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.uow.email.findById(input.id, ctx.portfolio.ownerId);

      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      return result;
    }),

  markRead: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.email.markRead(input.ids, ctx.portfolio.ownerId);
    }),

  markUnread: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.email.markUnread(input.ids, ctx.portfolio.ownerId);
    }),

  getUnreadCount: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.uow.email.getUnreadCount(ctx.portfolio.ownerId, input?.propertyId);
    }),

  getForwardingAddress: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await ensureForwardingAddress(input.propertyId);
      return { address };
    }),

  regenerateForwardingAddress: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await regenerateForwardingAddress(input.propertyId);
      return { address };
    }),

  // approveSender needs to read the email body and do sender allowlist + background processing
  approveSender: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.uow.email.findById(input.emailId, ctx.portfolio.ownerId);

      if (!result || result.email.status !== "quarantined") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      const { email } = result;

      if (!email.propertyId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot approve email without property assignment" });
      }

      await ctx.uow.email.createSender({
        propertyId: email.propertyId,
        emailPattern: email.fromAddress,
        label: email.fromName,
      });

      await ctx.uow.email.updateEmail(input.emailId, ctx.portfolio.ownerId, { status: "approved" });

      await processEmailBackground({
        emailId: email.id,
        propertyId: email.propertyId,
        userId: email.userId,
        bodyText: email.bodyText,
        subject: email.subject,
        attachments: [],
      });
    }),

  rejectEmail: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.email.updateEmail(input.emailId, ctx.portfolio.ownerId, { status: "rejected" });
    }),

  listSenders: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.uow.email.findSenders(input.propertyId);
    }),

  addSender: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        emailPattern: z.string().min(1),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.uow.email.createSender({
        propertyId: input.propertyId,
        emailPattern: input.emailPattern.toLowerCase().trim(),
        label: input.label,
      });
    }),

  removeSender: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the sender belongs to a property the user owns
      const sender = await ctx.uow.email.findSenderById(input.id);

      if (!sender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender not found" });
      }

      const property = await ctx.uow.property.findById(sender.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.uow.email.deleteSender(input.id);
    }),

  acceptMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.uow.email.findInvoiceMatchById(input.id);

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      // Verify the match's email belongs to the current user
      const emailResult = await ctx.uow.email.findById(match.emailId, ctx.portfolio.ownerId);

      if (!emailResult) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.uow.email.updateInvoiceMatch(input.id, "accepted");
    }),

  rejectMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.uow.email.findInvoiceMatchById(input.id);

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      // Verify the match's email belongs to the current user
      const emailResult = await ctx.uow.email.findById(match.emailId, ctx.portfolio.ownerId);

      if (!emailResult) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.uow.email.updateInvoiceMatch(input.id, "rejected");
    }),

  downloadAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const attachment = await ctx.uow.email.findAttachment(input.attachmentId);

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      // Verify the attachment's email belongs to the current user
      const emailResult = await ctx.uow.email.findById(attachment.emailId, ctx.portfolio.ownerId);

      if (!emailResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      const { getSupabaseAdmin } = await import("@/lib/supabase/server");
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase.storage
        .from("email-attachments")
        .createSignedUrl(attachment.storagePath, 3600);

      if (error || !data?.signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate download URL",
        });
      }

      return {
        url: data.signedUrl,
        filename: attachment.filename,
        contentType: attachment.contentType,
      };
    }),

  listUnassigned: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.uow.email.findUnassigned(ctx.portfolio.ownerId, {
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  assignToProperty: writeProcedure
    .input(
      z.object({
        emailId: z.number(),
        propertyId: z.string().uuid(),
        rememberSender: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify email belongs to user
      const result = await ctx.uow.email.findById(input.emailId, ctx.portfolio.ownerId);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        });
      }

      const property = await ctx.uow.property.findById(input.propertyId, ctx.portfolio.ownerId);

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      await ctx.uow.email.updateEmail(input.emailId, ctx.portfolio.ownerId, { propertyId: input.propertyId });

      if (input.rememberSender && result.email.fromAddress) {
        await recordSenderPropertyMatch(
          ctx.portfolio.ownerId,
          result.email.fromAddress,
          input.propertyId,
          1.0
        );
      }

      return { success: true };
    }),
});
