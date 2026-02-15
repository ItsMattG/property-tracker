import { eq, and, desc } from "drizzle-orm";
import { chatConversations, chatMessages } from "../db/schema";
import type { ChatMessage } from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IChatRepository,
  ConversationSummary,
  ConversationWithMessages,
} from "./interfaces/chat.repository.interface";

export class ChatRepository
  extends BaseRepository
  implements IChatRepository
{
  async findConversations(
    userId: string,
    limit = 20
  ): Promise<ConversationSummary[]> {
    return this.db.query.chatConversations.findMany({
      where: eq(chatConversations.userId, userId),
      orderBy: [desc(chatConversations.updatedAt)],
      limit,
      columns: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async findConversationById(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithMessages | null> {
    const conversation = await this.db.query.chatConversations.findFirst({
      where: and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, userId)
      ),
      with: { messages: { orderBy: [chatMessages.createdAt] } },
    });
    return (conversation as ConversationWithMessages) ?? null;
  }

  async createConversation(
    userId: string,
    title?: string,
    tx?: DB
  ): Promise<{ id: string; title: string | null; createdAt: Date; updatedAt: Date }> {
    const client = this.resolve(tx);
    const [conversation] = await client
      .insert(chatConversations)
      .values({ userId, title: title || null })
      .returning();
    return conversation;
  }

  async addMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    toolCalls?: Record<string, unknown>[] | null,
    toolResults?: Record<string, unknown>[] | null,
    tx?: DB
  ): Promise<ChatMessage> {
    const client = this.resolve(tx);
    const [message] = await client
      .insert(chatMessages)
      .values({
        conversationId,
        role,
        content,
        toolCalls: toolCalls || null,
        toolResults: toolResults || null,
      })
      .returning();

    // Update conversation timestamp
    await client
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversationId));

    return message;
  }

  async deleteConversation(
    conversationId: string,
    userId: string,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(chatConversations)
      .where(
        and(
          eq(chatConversations.id, conversationId),
          eq(chatConversations.userId, userId)
        )
      );
  }
}
