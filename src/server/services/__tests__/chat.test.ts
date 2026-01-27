import { describe, it, expect } from "vitest";
import {
  createConversation,
  getConversation,
  listConversations,
  addMessage,
  deleteConversation,
  generateTitle,
} from "../chat";

describe("Chat service", () => {
  it("exports createConversation", () => {
    expect(createConversation).toBeDefined();
    expect(typeof createConversation).toBe("function");
  });

  it("exports getConversation", () => {
    expect(getConversation).toBeDefined();
    expect(typeof getConversation).toBe("function");
  });

  it("exports listConversations", () => {
    expect(listConversations).toBeDefined();
    expect(typeof listConversations).toBe("function");
  });

  it("exports addMessage", () => {
    expect(addMessage).toBeDefined();
    expect(typeof addMessage).toBe("function");
  });

  it("exports deleteConversation", () => {
    expect(deleteConversation).toBeDefined();
    expect(typeof deleteConversation).toBe("function");
  });

  it("exports generateTitle", () => {
    expect(generateTitle).toBeDefined();
    expect(typeof generateTitle).toBe("function");
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
