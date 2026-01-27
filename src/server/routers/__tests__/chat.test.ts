import { describe, it, expect } from "vitest";
import { chatRouter } from "../chat";

describe("Chat router", () => {
  it("exports chatRouter", () => {
    expect(chatRouter).toBeDefined();
  });

  it("has listConversations procedure", () => {
    expect(chatRouter.listConversations).toBeDefined();
  });

  it("has getConversation procedure", () => {
    expect(chatRouter.getConversation).toBeDefined();
  });

  it("has deleteConversation procedure", () => {
    expect(chatRouter.deleteConversation).toBeDefined();
  });
});
