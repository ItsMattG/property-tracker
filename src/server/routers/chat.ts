import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";
import {
  listConversations,
  getConversation,
  deleteConversation,
} from "../services/chat";

export const chatRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return listConversations(ctx.user.id, input?.limit);
    }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getConversation(input.conversationId, ctx.user.id);
    }),

  deleteConversation: writeProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await deleteConversation(input.conversationId, ctx.user.id);
      return { success: true };
    }),
});
