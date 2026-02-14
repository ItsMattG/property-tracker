import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCurrencyWithCents,
  formatCurrencyCompact,
  formatPercent,
  formatDate,
  formatDateShort,
  formatDateISO,
  formatRelativeDate,
} from "../utils";

describe("formatCurrency", () => {
  it("formats currency in AUD", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
    expect(formatCurrency(1500000)).toBe("$1,500,000");
  });
});

describe("formatCurrencyWithCents", () => {
  it("formats with 2 decimal places", () => {
    expect(formatCurrencyWithCents(1000.5)).toBe("$1,000.50");
    expect(formatCurrencyWithCents(1000)).toBe("$1,000.00");
  });

  it("accepts string input", () => {
    expect(formatCurrencyWithCents("1000.50")).toBe("$1,000.50");
  });

  it("accepts number input", () => {
    expect(formatCurrencyWithCents(1000.5)).toBe("$1,000.50");
  });
});

describe("formatCurrencyCompact", () => {
  it("formats thousands as K", () => {
    expect(formatCurrencyCompact(1500)).toBe("$1.5K");
    expect(formatCurrencyCompact(50000)).toBe("$50K");
  });

  it("formats millions as M", () => {
    expect(formatCurrencyCompact(1500000)).toBe("$1.5M");
  });

  it("formats small amounts normally", () => {
    expect(formatCurrencyCompact(500)).toBe("$500");
  });
});

describe("formatPercent", () => {
  it("formats percentages with 1 decimal", () => {
    expect(formatPercent(5.5)).toBe("5.5%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-3.2)).toBe("-3.2%");
  });
});

describe("formatDate", () => {
  it("formats date correctly", () => {
    const date = new Date("2024-01-15");
    expect(formatDate(date)).toBe("15 Jan 2024");
  });

  it("handles string dates", () => {
    expect(formatDate("2024-01-15")).toBe("15 Jan 2024");
  });
});

describe("formatDateShort", () => {
  it("formats date in short form", () => {
    const date = new Date("2024-01-15");
    expect(formatDateShort(date)).toBe("15/01/24");
  });
});

describe("formatDateISO", () => {
  it("formats date in ISO format", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    expect(formatDateISO(date)).toBe("2024-01-15");
  });
});

describe("formatRelativeDate", () => {
  it("returns Today for current date", () => {
    expect(formatRelativeDate(new Date())).toBe("Today");
  });

  it("returns Yesterday for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe("Yesterday");
  });

  it("returns days ago for recent dates", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe("3 days ago");
  });
});
