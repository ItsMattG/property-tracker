import { describe, it, expect } from "vitest";
import { buildExtractionPrompt, EXTRACTION_PROMPT_BASE } from "../document-extraction";

describe("document-extraction service", () => {
  describe("buildExtractionPrompt", () => {
    it("includes base extraction instructions", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("You are extracting data from a document");
      expect(prompt).toContain("receipt");
      expect(prompt).toContain("rate_notice");
      expect(prompt).toContain("insurance");
      expect(prompt).toContain("invoice");
    });

    it("specifies JSON output format", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("documentType");
      expect(prompt).toContain("vendor");
      expect(prompt).toContain("amount");
      expect(prompt).toContain("date");
      expect(prompt).toContain("confidence");
    });

    it("includes field extraction rules", () => {
      const prompt = buildExtractionPrompt();
      expect(prompt).toContain("propertyAddress");
      expect(prompt).toContain("lineItems");
      expect(prompt).toContain("dueDate");
    });
  });

  describe("EXTRACTION_PROMPT_BASE", () => {
    it("is a non-empty string", () => {
      expect(typeof EXTRACTION_PROMPT_BASE).toBe("string");
      expect(EXTRACTION_PROMPT_BASE.length).toBeGreaterThan(0);
    });

    it("includes category suggestions for Australian property investors", () => {
      expect(EXTRACTION_PROMPT_BASE).toContain("repairs_and_maintenance");
      expect(EXTRACTION_PROMPT_BASE).toContain("council_rates");
      expect(EXTRACTION_PROMPT_BASE).toContain("water_charges");
      expect(EXTRACTION_PROMPT_BASE).toContain("property_agent_fees");
    });

    it("specifies date format as YYYY-MM-DD", () => {
      expect(EXTRACTION_PROMPT_BASE).toContain("YYYY-MM-DD");
    });

    it("instructs to return only valid JSON", () => {
      expect(EXTRACTION_PROMPT_BASE).toContain("Return ONLY valid JSON");
    });
  });
});
