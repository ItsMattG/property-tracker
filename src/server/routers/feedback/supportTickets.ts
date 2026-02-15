import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../../trpc";
import {
  createTicket,
  getUserTickets,
  getTicketById,
  getAllTickets,
  updateTicketStatus,
  addTicketNote,
  formatTicketNumber,
} from "../../services/notification";

function requireAdmin(userId: string) {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  if (!adminIds.includes(userId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const supportTicketsRouter = router({
  // --- User procedures ---

  create: protectedProcedure
    .input(
      z.object({
        category: z.enum(["bug", "question", "feature_request", "account_issue"]),
        subject: z.string().min(5).max(200),
        description: z.string().min(10).max(5000),
        urgency: z.enum(["low", "medium", "high", "critical"]),
        browserInfo: z.unknown().optional(),
        currentPage: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await createTicket({
        userId: ctx.user.id,
        ...input,
      });
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const tickets = await getUserTickets(ctx.user.id);
      let filtered = tickets;
      if (input?.status) {
        filtered = tickets.filter((t) => t.status === input.status);
      }
      return filtered.map((t) => ({
        ...t,
        displayId: formatTicketNumber(t.ticketNumber),
      }));
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.id, false);
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  addNote: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await getTicketById(input.ticketId, false);
      if (!ticket || ticket.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return addTicketNote({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        content: input.content,
        isInternal: false,
      });
    }),

  // --- Admin procedures ---

  adminList: protectedProcedure
    .input(
      z.object({
        status: z.string().optional(),
        urgency: z.string().optional(),
        category: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      const tickets = await getAllTickets(input ?? undefined);
      return tickets.map((t) => ({
        ...t,
        displayId: formatTicketNumber(t.ticketNumber),
      }));
    }),

  adminGet: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      const ticket = await getTicketById(input.id, true);
      if (!ticket) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        ...ticket,
        displayId: formatTicketNumber(ticket.ticketNumber),
      };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "in_progress", "waiting_on_customer", "resolved", "closed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      return updateTicketStatus(input.id, input.status);
    }),

  addAdminNote: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        content: z.string().min(1).max(5000),
        isInternal: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx.user.id);
      return addTicketNote({
        ticketId: input.ticketId,
        userId: ctx.user.id,
        content: input.content,
        isInternal: input.isInternal,
      });
    }),
});
