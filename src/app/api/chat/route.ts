import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  stepCountIs,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { users, properties } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { getChatTools } from "@/server/services/chat-tools";
import {
  createConversation,
  addMessage,
  generateTitle,
} from "@/server/services/chat";
import { buildSystemPrompt } from "@/server/services/chat-system-prompt";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const body = await req.json();
  const {
    messages,
    conversationId,
    currentRoute = "/dashboard",
  } = body as {
    messages: UIMessage[];
    conversationId?: string;
    currentRoute?: string;
  };

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    const firstContent = firstUserMsg?.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";
    const title = firstContent ? generateTitle(firstContent) : null;
    const conversation = await createConversation(user.id, title || undefined);
    convId = conversation.id;
  }

  // Save the latest user message
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const textContent = lastUserMessage.parts
      ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("") || "";
    if (textContent) {
      await addMessage(convId, "user", textContent);
    }
  }

  // Count properties for system prompt
  const propCountResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(properties)
    .where(eq(properties.userId, user.id));
  const propertyCount = propCountResult[0]?.count ?? 0;

  const tools = getChatTools(user.id);

  const savedConvId = convId;

  return createUIMessageStreamResponse({
    headers: { "x-conversation-id": savedConvId },
    stream: streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: buildSystemPrompt(
        user.name || user.email,
        propertyCount,
        currentRoute
      ),
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        if (text) {
          await addMessage(savedConvId, "assistant", text);
        }
      },
    }).toUIMessageStream(),
  });
}
