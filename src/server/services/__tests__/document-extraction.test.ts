import { describe, it, expect } from "vitest";
import {
  buildExtractionPrompt,
  parseExtractionResponse,
  ExtractedData,
  EXTRACTION_PROMPT_BASE,
} from "../document-extraction";

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

  describe("parseExtractionResponse", () => {
    it("parses valid JSON response", () => {
      const response = `{
        "documentType": "receipt",
        "confidence": 0.95,
        "vendor": "Bunnings Warehouse",
        "amount": 245.50,
        "date": "2026-01-20",
        "dueDate": null,
        "category": "repairs_and_maintenance",
        "propertyAddress": null,
        "lineItems": null,
        "rawText": "BUNNINGS WAREHOUSE..."
      }`;

      const result = parseExtractionResponse(response);
      expect(result.documentType).toBe("receipt");
      expect(result.vendor).toBe("Bunnings Warehouse");
      expect(result.amount).toBe(245.50);
      expect(result.confidence).toBe(0.95);
    });

    it("extracts JSON from text with surrounding content", () => {
      const response = `Here is the extracted data:
      {"documentType": "invoice", "confidence": 0.8, "vendor": "ABC Plumbing", "amount": 350, "date": "2026-01-15", "dueDate": "2026-02-15", "category": "repairs_and_maintenance", "propertyAddress": null, "lineItems": [{"description": "Labour", "quantity": 2, "amount": 200}], "rawText": "..."}
      That's the result.`;

      const result = parseExtractionResponse(response);
      expect(result.documentType).toBe("invoice");
      expect(result.lineItems).toHaveLength(1);
    });

    it("returns unknown type on parse failure", () => {
      const result = parseExtractionResponse("This is not JSON");
      expect(result.documentType).toBe("unknown");
      expect(result.confidence).toBe(0);
      expect(result.error).toBe("Failed to parse extraction response");
    });

    it("validates required fields", () => {
      const response = `{"documentType": "receipt"}`;
      const result = parseExtractionResponse(response);
      expect(result.amount).toBeNull();
      expect(result.vendor).toBeNull();
    });
  });
});
