import { describe, it, expect, vi } from "vitest";
import {
  SETTLEMENT_EXTRACTION_PROMPT,
  parseSettlementResponse,
  type SettlementExtractedData,
} from "../settlement-extract";

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => ({ download: vi.fn() })) },
  })),
}));

describe("settlement-extract", () => {
  describe("SETTLEMENT_EXTRACTION_PROMPT", () => {
    it("includes settlement statement context", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("settlement statement");
    });

    it("requests stamp duty extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("stampDuty");
    });

    it("requests legal fees extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("legalFees");
    });

    it("requests purchase price extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("purchasePrice");
    });

    it("requests settlement date extraction", () => {
      expect(SETTLEMENT_EXTRACTION_PROMPT).toContain("settlementDate");
    });
  });

  describe("parseSettlementResponse", () => {
    it("parses a valid settlement JSON response", () => {
      const response = JSON.stringify({
        purchasePrice: 750000,
        settlementDate: "2025-06-15",
        stampDuty: 29490,
        legalFees: 1850,
        titleSearchFees: 150,
        registrationFees: 350,
        adjustments: [
          { description: "Council rates adjustment", amount: -432.5, type: "credit" },
          { description: "Water rates adjustment", amount: -185.2, type: "credit" },
        ],
        propertyAddress: "123 Main St, Richmond VIC 3121",
        buyerName: "John Smith",
        confidence: 0.92,
      });

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(750000);
      expect(result.stampDuty).toBe(29490);
      expect(result.legalFees).toBe(1850);
      expect(result.settlementDate).toBe("2025-06-15");
      expect(result.adjustments).toHaveLength(2);
      expect(result.confidence).toBe(0.92);
    });

    it("handles response with surrounding text", () => {
      const response = `Here is the extracted data:
      {"purchasePrice": 500000, "stampDuty": 17990, "legalFees": 1200, "confidence": 0.85}
      That's the result.`;

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(500000);
      expect(result.stampDuty).toBe(17990);
    });

    it("returns defaults for unparseable response", () => {
      const result = parseSettlementResponse("This is not JSON");
      expect(result.purchasePrice).toBeNull();
      expect(result.stampDuty).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.error).toBeDefined();
    });

    it("handles missing optional fields gracefully", () => {
      const response = JSON.stringify({
        purchasePrice: 600000,
        stampDuty: 21000,
        confidence: 0.7,
      });

      const result = parseSettlementResponse(response);
      expect(result.purchasePrice).toBe(600000);
      expect(result.legalFees).toBeNull();
      expect(result.adjustments).toBeNull();
      expect(result.settlementDate).toBeNull();
    });
  });
});
