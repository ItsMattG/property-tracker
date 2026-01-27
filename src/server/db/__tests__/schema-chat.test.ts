import { describe, it, expect } from "vitest";
import { chatConversations, chatMessages, chatMessageRoleEnum } from "../schema";

describe("Chat schema", () => {
  it("exports chatConversations table", () => {
    expect(chatConversations).toBeDefined();
  });

  it("exports chatMessages table", () => {
    expect(chatMessages).toBeDefined();
  });

  it("exports chatMessageRoleEnum", () => {
    expect(chatMessageRoleEnum).toBeDefined();
  });

  it("chatConversations has expected columns", () => {
    const cols = Object.keys(chatConversations);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("title");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });

  it("chatMessages has expected columns", () => {
    const cols = Object.keys(chatMessages);
    expect(cols).toContain("id");
    expect(cols).toContain("conversationId");
    expect(cols).toContain("role");
    expect(cols).toContain("content");
    expect(cols).toContain("toolCalls");
    expect(cols).toContain("toolResults");
    expect(cols).toContain("createdAt");
  });
});
