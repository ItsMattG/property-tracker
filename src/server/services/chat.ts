import { db } from "@/server/db";
import { chatConversations, chatMessages } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function createConversation(userId: string, title?: string) {
  const [conversation] = await db
    .insert(chatConversations)
    .values({ userId, title: title || null })
    .returning();
  return conversation;
}

export async function getConversation(conversationId: string, userId: string) {
  const conversation = await db.query.chatConversations.findFirst({
    where: and(
      eq(chatConversations.id, conversationId),
      eq(chatConversations.userId, userId)
    ),
    with: { messages: { orderBy: [chatMessages.createdAt] } },
  });
  return conversation || null;
}

export async function listConversations(userId: string, limit = 20) {
  return db.query.chatConversations.findMany({
    where: eq(chatConversations.userId, userId),
    orderBy: [desc(chatConversations.updatedAt)],
    limit,
    columns: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
  toolResults?: unknown
) {
  const [message] = await db
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
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, conversationId));

  return message;
}

export async function deleteConversation(conversationId: string, userId: string) {
  await db
    .delete(chatConversations)
    .where(
      and(
        eq(chatConversations.id, conversationId),
        eq(chatConversations.userId, userId)
      )
    );
}

export function generateTitle(firstMessage: string): string {
  let title = firstMessage
    .replace(/\?/g, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+(is|are|do|does|me|I|my)\s+(my\s+)?/i, "")
    .replace(/^(what|how|where|when|why|can|do|does|is|are|show|tell|get|list)\s+/i, "")
    .trim();

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate
  if (title.length > 50) {
    title = title.slice(0, 50) + "...";
  }

  return title;
}
