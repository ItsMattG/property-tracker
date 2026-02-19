import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatDate, cn } from "../utils";

describe("formatCurrency", () => {
  it("formats positive amounts in AUD", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-$500");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(1_500_000)).toBe("$1,500,000");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(5.25)).toBe("5.3%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats whole number", () => {
    expect(formatPercent(10)).toBe("10.0%");
  });
});

describe("formatDate", () => {
  it("formats date string", () => {
    const result = formatDate("2026-01-15");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });
});

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("handles undefined values", () => {
    expect(cn("base", undefined, "extra")).toBe("base extra");
  });
});
