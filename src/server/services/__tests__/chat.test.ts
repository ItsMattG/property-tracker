import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "conv-1", userId: "user-1", title: "Test" }]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    query: {
      chatConversations: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  deleteConversation,
  generateTitle,
} from "../chat";

describe("Chat service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createConversation", () => {
    it("creates and returns a conversation", async () => {
      const result = await createConversation("user-1", "Test title");
      expect(result).toEqual({ id: "conv-1", userId: "user-1", title: "Test" });
    });
  });

  describe("getConversation", () => {
    it("returns null when conversation not found", async () => {
      const result = await getConversation("conv-1", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("listConversations", () => {
    it("returns empty array when no conversations", async () => {
      const result = await listConversations("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("addMessage", () => {
    it("inserts a message and updates conversation timestamp", async () => {
      const result = await addMessage("conv-1", "user", "Hello");
      expect(result).toBeDefined();
    });
  });

  describe("deleteConversation", () => {
    it("deletes a conversation", async () => {
      await expect(deleteConversation("conv-1", "user-1")).resolves.toBeUndefined();
    });
  });

  describe("generateTitle", () => {
    it("generates title from first user message", () => {
      const title = generateTitle("What is my total equity across all properties?");
      expect(title).toBe("Total equity across all properties");
    });

    it("truncates long messages", () => {
      const longMsg = "A".repeat(100);
      const title = generateTitle(longMsg);
      expect(title.length).toBeLessThanOrEqual(53); // 50 + "..."
    });

    it("removes question marks", () => {
      const title = generateTitle("How do I add a property?");
      expect(title).not.toContain("?");
    });
  });
});
