import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  propertyEmails,
  propertyEmailAttachments,
  propertyEmailInvoiceMatches,
  propertyEmailSenders,
  properties,
  senderPropertyHistory,
} from "../db/schema";
import { eq, and, desc, sql, inArray, isNull } from "drizzle-orm";
import { recordSenderPropertyMatch } from "../services/gmail-sync";
import {
  ensureForwardingAddress,
  regenerateForwardingAddress,
} from "../services/email-forwarding";
import { processEmailBackground } from "../services/email-processing";

export const emailRouter = router({
  // List emails for a property or all properties
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
      const conditions = [eq(propertyEmails.userId, ctx.portfolio.ownerId)];

      if (input.propertyId) {
        conditions.push(eq(propertyEmails.propertyId, input.propertyId));
      }
      if (input.status) {
        conditions.push(eq(propertyEmails.status, input.status));
      }
      if (input.unreadOnly) {
        conditions.push(eq(propertyEmails.isRead, false));
      }
      if (input.cursor) {
        conditions.push(sql`${propertyEmails.id} < ${input.cursor}`);
      }

      const emails = await ctx.db
        .select({
          id: propertyEmails.id,
          propertyId: propertyEmails.propertyId,
          fromAddress: propertyEmails.fromAddress,
          fromName: propertyEmails.fromName,
          subject: propertyEmails.subject,
          status: propertyEmails.status,
          isRead: propertyEmails.isRead,
          threadId: propertyEmails.threadId,
          receivedAt: propertyEmails.receivedAt,
        })
        .from(propertyEmails)
        .where(and(...conditions))
        .orderBy(desc(propertyEmails.receivedAt))
        .limit(input.limit + 1);

      let nextCursor: number | undefined;
      if (emails.length > input.limit) {
        const last = emails.pop();
        nextCursor = last?.id;
      }

      return { emails, nextCursor };
    }),

  // Get single email with attachments and invoice matches
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.id, input.id),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );

      if (!email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      const attachments = await ctx.db
        .select()
        .from(propertyEmailAttachments)
        .where(eq(propertyEmailAttachments.emailId, email.id));

      const invoiceMatches = await ctx.db
        .select()
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.emailId, email.id));

      return { email, attachments, invoiceMatches };
    }),

  // Mark emails as read
  markRead: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ isRead: true })
        .where(
          and(
            inArray(propertyEmails.id, input.ids),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // Mark emails as unread
  markUnread: writeProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ isRead: false })
        .where(
          and(
            inArray(propertyEmails.id, input.ids),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // Get unread count (global or per property)
  getUnreadCount: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(propertyEmails.userId, ctx.portfolio.ownerId),
        eq(propertyEmails.isRead, false),
        eq(propertyEmails.status, "approved"),
      ];

      if (input?.propertyId) {
        conditions.push(eq(propertyEmails.propertyId, input.propertyId));
      }

      const [result] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(propertyEmails)
        .where(and(...conditions));

      return result?.count ?? 0;
    }),

  // Get forwarding address for a property
  getForwardingAddress: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await ensureForwardingAddress(input.propertyId);
      return { address };
    }),

  // Regenerate forwarding address
  regenerateForwardingAddress: writeProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      const address = await regenerateForwardingAddress(input.propertyId);
      return { address };
    }),

  // Approve a quarantined email's sender
  approveSender: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.id, input.emailId),
            eq(propertyEmails.userId, ctx.portfolio.ownerId),
            eq(propertyEmails.status, "quarantined")
          )
        );

      if (!email) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      }

      if (!email.propertyId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot approve email without property assignment" });
      }

      // Add sender to allowlist
      await ctx.db
        .insert(propertyEmailSenders)
        .values({
          propertyId: email.propertyId,
          emailPattern: email.fromAddress,
          label: email.fromName,
        })
        .onConflictDoNothing();

      // Approve the email
      await ctx.db
        .update(propertyEmails)
        .set({ status: "approved" })
        .where(eq(propertyEmails.id, input.emailId));

      // Trigger background processing for the now-approved email
      await processEmailBackground({
        emailId: email.id,
        propertyId: email.propertyId,
        userId: email.userId,
        bodyText: email.bodyText,
        subject: email.subject,
        attachments: [], // Attachments not available after initial webhook
      });
    }),

  // Reject a quarantined email
  rejectEmail: writeProcedure
    .input(z.object({ emailId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(propertyEmails)
        .set({ status: "rejected" })
        .where(
          and(
            eq(propertyEmails.id, input.emailId),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );
    }),

  // List approved senders for a property
  listSenders: protectedProcedure
    .input(z.object({ propertyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      return ctx.db
        .select()
        .from(propertyEmailSenders)
        .where(eq(propertyEmailSenders.propertyId, input.propertyId))
        .orderBy(desc(propertyEmailSenders.createdAt));
    }),

  // Add sender to allowlist
  addSender: writeProcedure
    .input(
      z.object({
        propertyId: z.string().uuid(),
        emailPattern: z.string().min(1),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.db
        .insert(propertyEmailSenders)
        .values({
          propertyId: input.propertyId,
          emailPattern: input.emailPattern.toLowerCase().trim(),
          label: input.label,
        })
        .onConflictDoNothing();
    }),

  // Remove sender from allowlist
  removeSender: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the sender belongs to a property the user owns
      const [sender] = await ctx.db
        .select({
          id: propertyEmailSenders.id,
          propertyId: propertyEmailSenders.propertyId,
        })
        .from(propertyEmailSenders)
        .where(eq(propertyEmailSenders.id, input.id));

      if (!sender) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sender not found" });
      }

      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, sender.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Property not found" });
      }

      await ctx.db
        .delete(propertyEmailSenders)
        .where(eq(propertyEmailSenders.id, input.id));
    }),

  // Accept invoice match
  acceptMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({
          id: propertyEmailInvoiceMatches.id,
          emailId: propertyEmailInvoiceMatches.emailId,
        })
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.id, input.id));

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      // Verify ownership via the email
      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, match.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.db
        .update(propertyEmailInvoiceMatches)
        .set({ status: "accepted" })
        .where(eq(propertyEmailInvoiceMatches.id, input.id));
    }),

  // Reject invoice match
  rejectMatch: writeProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({
          id: propertyEmailInvoiceMatches.id,
          emailId: propertyEmailInvoiceMatches.emailId,
        })
        .from(propertyEmailInvoiceMatches)
        .where(eq(propertyEmailInvoiceMatches.id, input.id));

      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, match.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" });
      }

      await ctx.db
        .update(propertyEmailInvoiceMatches)
        .set({ status: "rejected" })
        .where(eq(propertyEmailInvoiceMatches.id, input.id));
    }),

  // Download attachment (generates signed URL)
  downloadAttachment: protectedProcedure
    .input(z.object({ attachmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const [attachment] = await ctx.db
        .select({
          id: propertyEmailAttachments.id,
          storagePath: propertyEmailAttachments.storagePath,
          filename: propertyEmailAttachments.filename,
          contentType: propertyEmailAttachments.contentType,
          emailId: propertyEmailAttachments.emailId,
        })
        .from(propertyEmailAttachments)
        .where(eq(propertyEmailAttachments.id, input.attachmentId));

      if (!attachment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Attachment not found",
        });
      }

      const [email] = await ctx.db
        .select({ userId: propertyEmails.userId })
        .from(propertyEmails)
        .where(eq(propertyEmails.id, attachment.emailId));

      if (email?.userId !== ctx.portfolio.ownerId) {
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

  // List unassigned emails (no property assigned)
  listUnassigned: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(propertyEmails.userId, ctx.portfolio.ownerId),
        isNull(propertyEmails.propertyId),
      ];

      if (input.cursor) {
        conditions.push(sql`${propertyEmails.id} < ${input.cursor}`);
      }

      const emails = await ctx.db
        .select({
          id: propertyEmails.id,
          fromAddress: propertyEmails.fromAddress,
          fromName: propertyEmails.fromName,
          subject: propertyEmails.subject,
          bodyText: propertyEmails.bodyText,
          isRead: propertyEmails.isRead,
          receivedAt: propertyEmails.receivedAt,
          source: propertyEmails.source,
        })
        .from(propertyEmails)
        .where(and(...conditions))
        .orderBy(desc(propertyEmails.receivedAt))
        .limit(input.limit + 1);

      const hasMore = emails.length > input.limit;
      const items = hasMore ? emails.slice(0, -1) : emails;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items,
        nextCursor,
      };
    }),

  // Assign an email to a property
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
      const [email] = await ctx.db
        .select({
          id: propertyEmails.id,
          fromAddress: propertyEmails.fromAddress,
        })
        .from(propertyEmails)
        .where(
          and(
            eq(propertyEmails.id, input.emailId),
            eq(propertyEmails.userId, ctx.portfolio.ownerId)
          )
        );

      if (!email) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email not found",
        });
      }

      // Verify property belongs to user
      const [property] = await ctx.db
        .select({ id: properties.id })
        .from(properties)
        .where(
          and(
            eq(properties.id, input.propertyId),
            eq(properties.userId, ctx.portfolio.ownerId)
          )
        );

      if (!property) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Property not found",
        });
      }

      // Update the email
      await ctx.db
        .update(propertyEmails)
        .set({ propertyId: input.propertyId })
        .where(eq(propertyEmails.id, input.emailId));

      // Record sender-property association for future matching
      if (input.rememberSender && email.fromAddress) {
        await recordSenderPropertyMatch(
          ctx.portfolio.ownerId,
          email.fromAddress,
          input.propertyId,
          1.0
        );
      }

      return { success: true };
    }),
});
