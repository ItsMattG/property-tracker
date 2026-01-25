import { describe, it, expect } from "vitest";
import { matchPropertyByAddress, normalizeAddress } from "../property-matcher";

describe("property-matcher service", () => {
  describe("normalizeAddress", () => {
    it("lowercases and trims", () => {
      expect(normalizeAddress("  123 SMITH ST  ")).toBe("123 smith street");
    });

    it("expands common abbreviations", () => {
      expect(normalizeAddress("123 Smith St")).toBe("123 smith street");
      expect(normalizeAddress("45 King Rd")).toBe("45 king road");
      expect(normalizeAddress("7 Queen Ave")).toBe("7 queen avenue");
    });

    it("removes unit/suite prefixes", () => {
      expect(normalizeAddress("Unit 5/123 Main St")).toBe("5/123 main street");
      expect(normalizeAddress("Suite 10, 45 King Rd")).toBe("10 45 king road");
    });
  });

  describe("matchPropertyByAddress", () => {
    const properties = [
      { id: "1", address: "123 Smith Street", suburb: "Melbourne", state: "VIC", postcode: "3000" },
      { id: "2", address: "45 King Road", suburb: "Sydney", state: "NSW", postcode: "2000" },
      { id: "3", address: "7 Queen Avenue", suburb: "Brisbane", state: "QLD", postcode: "4000" },
    ];

    it("returns exact match with high confidence", () => {
      const result = matchPropertyByAddress("123 Smith Street, Melbourne VIC 3000", properties);
      expect(result.propertyId).toBe("1");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("matches with abbreviated street type", () => {
      const result = matchPropertyByAddress("123 Smith St, Melbourne", properties);
      expect(result.propertyId).toBe("1");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("returns null with low confidence when no match", () => {
      const result = matchPropertyByAddress("999 Unknown Place", properties);
      expect(result.propertyId).toBeNull();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("handles partial suburb match", () => {
      const result = matchPropertyByAddress("45 King Rd Sydney", properties);
      expect(result.propertyId).toBe("2");
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });
});
