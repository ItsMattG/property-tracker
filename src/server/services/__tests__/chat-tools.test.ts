import { describe, it, expect } from "vitest";
import { getChatTools } from "../chat-tools";

describe("Chat tools", () => {
  it("exports getChatTools function", () => {
    expect(getChatTools).toBeDefined();
    expect(typeof getChatTools).toBe("function");
  });

  it("returns tool definitions with expected names", () => {
    const tools = getChatTools("fake-user-id");
    const toolNames = Object.keys(tools);

    expect(toolNames).toContain("getPortfolioSummary");
    expect(toolNames).toContain("listProperties");
    expect(toolNames).toContain("getPropertyDetails");
    expect(toolNames).toContain("getTransactions");
    expect(toolNames).toContain("getComplianceStatus");
    expect(toolNames).toContain("getTasks");
    expect(toolNames).toContain("getLoans");
  });

  it("each tool has description and parameters", () => {
    const tools = getChatTools("fake-user-id");
    for (const [, toolDef] of Object.entries(tools)) {
      expect(toolDef).toHaveProperty("description");
      expect(toolDef).toHaveProperty("parameters");
      expect(toolDef).toHaveProperty("execute");
      expect(typeof (toolDef as { execute: unknown }).execute).toBe("function");
    }
  });
});
