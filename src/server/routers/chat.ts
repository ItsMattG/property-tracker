import { z } from "zod";
import { router, protectedProcedure, writeProcedure } from "../trpc";

export const chatRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.uow.chat.findConversations(ctx.user.id, input?.limit);
    }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.uow.chat.findConversationById(input.conversationId, ctx.user.id);
    }),

  deleteConversation: writeProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.uow.chat.deleteConversation(input.conversationId, ctx.user.id);
      return { success: true };
    }),
});
