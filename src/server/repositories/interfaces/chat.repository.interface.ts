import type { ChatMessage } from "../../db/schema";
import type { DB } from "../base";

/** Chat conversation summary (without messages) */
export interface ConversationSummary {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Chat conversation with messages */
export interface ConversationWithMessages {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    toolCalls: Record<string, unknown>[] | null;
    toolResults: Record<string, unknown>[] | null;
    createdAt: Date;
  }>;
}

export interface IChatRepository {
  /** List conversations for a user */
  findConversations(userId: string, limit?: number): Promise<ConversationSummary[]>;

  /** Get a conversation with its messages */
  findConversationById(conversationId: string, userId: string): Promise<ConversationWithMessages | null>;

  /** Create a new conversation */
  createConversation(userId: string, title?: string, tx?: DB): Promise<{ id: string; title: string | null; createdAt: Date; updatedAt: Date }>;

  /** Add a message to a conversation */
  addMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    toolCalls?: Record<string, unknown>[] | null,
    toolResults?: Record<string, unknown>[] | null,
    tx?: DB,
  ): Promise<ChatMessage>;

  /** Delete a conversation and its messages */
  deleteConversation(conversationId: string, userId: string, tx?: DB): Promise<void>;
}
