// src/server/services/__tests__/listing-extraction.test.ts
import { describe, it, expect } from "vitest";
import { detectInputType, buildExtractionPrompt } from "../listing-extraction";

describe("Listing Extraction Service", () => {
  describe("detectInputType", () => {
    it("detects Domain URLs", () => {
      expect(detectInputType("https://www.domain.com.au/123-main-st")).toBe("url");
    });

    it("detects REA URLs", () => {
      expect(detectInputType("https://www.realestate.com.au/property-house")).toBe("url");
    });

    it("detects text content", () => {
      expect(detectInputType("3 bedroom house in Sydney for $800,000")).toBe("text");
    });
  });

  describe("buildExtractionPrompt", () => {
    it("returns non-empty prompt", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt.length).toBeGreaterThan(100);
    });

    it("includes required fields", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("suburb");
      expect(prompt).toContain("state");
      expect(prompt).toContain("postcode");
      expect(prompt).toContain("propertyType");
    });
  });
});
