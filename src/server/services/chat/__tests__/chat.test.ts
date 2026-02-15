import { describe, it, expect } from "vitest";
import { generateTitle } from "../chat";

describe("Chat service", () => {
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
