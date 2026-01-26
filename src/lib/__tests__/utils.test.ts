import { describe, it, expect } from "vitest";
import {
  formatCurrency,
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
