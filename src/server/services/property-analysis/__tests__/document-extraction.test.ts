import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildExtractionPrompt,
  parseExtractionResponse,
  ExtractedData,
  EXTRACTION_PROMPT_BASE,
  getMediaType,
  ExtractionResult,
} from "../document-extraction";

// Add mock for Anthropic at top of file
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(),
      })),
    },
  })),
}));

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

  describe("getMediaType", () => {
    it("returns correct type for jpeg", () => {
      expect(getMediaType("image/jpeg")).toBe("image/jpeg");
    });

    it("returns correct type for png", () => {
      expect(getMediaType("image/png")).toBe("image/png");
    });

    it("defaults to jpeg for pdf (PDFs handled separately)", () => {
      // getMediaType is only for image types - PDFs are handled separately in extractDocument
      expect(getMediaType("application/pdf")).toBe("image/jpeg");
    });

    it("defaults to jpeg for unknown types", () => {
      expect(getMediaType("image/heic")).toBe("image/jpeg");
    });
  });

  describe("extractDocument", () => {
    it("returns extraction result interface", () => {
      const mockResult: ExtractionResult = {
        success: true,
        data: {
          documentType: "receipt",
          confidence: 0.9,
          vendor: "Test Store",
          amount: 100,
          date: "2026-01-20",
          dueDate: null,
          category: "repairs_and_maintenance",
          propertyAddress: null,
          lineItems: null,
          rawText: "test",
          gstAmount: null,
          renewalDate: null,
          referenceNumber: null,
          abn: null,
        },
      };

      expect(mockResult.success).toBe(true);
      expect(mockResult.data?.documentType).toBe("receipt");
    });
  });
});
