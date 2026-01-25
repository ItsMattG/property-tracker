import { describe, it, expect, vi } from "vitest";
import { documentExtractionRouter } from "../documentExtraction";

vi.mock("../../services/document-extraction", () => ({
  extractDocument: vi.fn(),
}));

vi.mock("../../services/property-matcher", () => ({
  matchPropertyByAddress: vi.fn(),
}));

describe("documentExtraction router", () => {
  it("has extract procedure", () => {
    expect(documentExtractionRouter).toBeDefined();
    expect(documentExtractionRouter._def.procedures).toHaveProperty("extract");
  });

  it("has getExtraction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("getExtraction");
  });

  it("has listPendingReviews procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("listPendingReviews");
  });

  it("has confirmTransaction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("confirmTransaction");
  });

  it("has discardExtraction procedure", () => {
    expect(documentExtractionRouter._def.procedures).toHaveProperty("discardExtraction");
  });
});
