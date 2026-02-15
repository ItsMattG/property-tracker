import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt";

describe("buildSystemPrompt", () => {
  it("includes user name and property count", () => {
    const prompt = buildSystemPrompt("Alice", 3, "/dashboard");
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("3 properties");
  });

  it("includes current route", () => {
    const prompt = buildSystemPrompt("Bob", 0, "/properties");
    expect(prompt).toContain("/properties");
  });

  it("includes financial year", () => {
    const prompt = buildSystemPrompt("User", 1, "/dashboard");
    expect(prompt).toContain("FY");
    expect(prompt).toContain("July");
  });

  it("includes capabilities and limitations sections", () => {
    const prompt = buildSystemPrompt("User", 1, "/dashboard");
    expect(prompt).toContain("Capabilities:");
    expect(prompt).toContain("Limitations:");
    expect(prompt).toContain("read-only access");
  });
});
