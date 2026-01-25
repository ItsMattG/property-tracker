import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  transformForPrivacy,
  type PortfolioSnapshot,
} from "../share";

describe("Share service", () => {
  describe("generateShareToken", () => {
    it("generates a URL-safe token", () => {
      const token = generateShareToken();
      expect(token).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(16);
    });

    it("generates unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateShareToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe("transformForPrivacy", () => {
    const fullSnapshot: PortfolioSnapshot = {
      generatedAt: "2026-01-25T00:00:00Z",
      summary: {
        propertyCount: 3,
        states: ["VIC", "NSW"],
        totalValue: 2500000,
        totalDebt: 1800000,
        totalEquity: 700000,
        portfolioLVR: 72,
        cashFlow: 2500,
        averageYield: 4.2,
      },
      properties: [
        {
          address: "42 Smith St",
          suburb: "Richmond",
          state: "VIC",
          currentValue: 850000,
          totalLoans: 600000,
          equity: 250000,
          lvr: 70.6,
          cashFlow: 800,
          grossYield: 4.5,
          portfolioPercent: 34,
        },
        {
          address: "15 Jones Ave",
          suburb: "Bondi",
          state: "NSW",
          currentValue: 1650000,
          totalLoans: 1200000,
          equity: 450000,
          lvr: 72.7,
          cashFlow: 1700,
          grossYield: 4.0,
          portfolioPercent: 66,
        },
      ],
    };

    it("returns full data for full mode", () => {
      const result = transformForPrivacy(fullSnapshot, "full");
      expect(result).toEqual(fullSnapshot);
    });

    it("removes properties array for summary mode", () => {
      const result = transformForPrivacy(fullSnapshot, "summary");
      expect(result.summary).toEqual(fullSnapshot.summary);
      expect(result.properties).toBeUndefined();
    });

    it("redacts addresses and amounts for redacted mode", () => {
      const result = transformForPrivacy(fullSnapshot, "redacted");

      // Summary should have no dollar amounts
      expect(result.summary.totalValue).toBeUndefined();
      expect(result.summary.totalDebt).toBeUndefined();
      expect(result.summary.totalEquity).toBeUndefined();
      expect(result.summary.cashFlow).toBeUndefined();

      // Percentages should remain
      expect(result.summary.portfolioLVR).toBe(72);
      expect(result.summary.averageYield).toBe(4.2);
      expect(result.summary.propertyCount).toBe(3);

      // Properties should have suburb only, no address
      expect(result.properties![0].address).toBeUndefined();
      expect(result.properties![0].suburb).toBe("Richmond");
      expect(result.properties![0].currentValue).toBeUndefined();
      expect(result.properties![0].lvr).toBe(70.6);
      expect(result.properties![0].portfolioPercent).toBe(34);
    });
  });
});
