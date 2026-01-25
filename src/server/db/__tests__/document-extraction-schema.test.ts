import { describe, it, expect } from "vitest";
import {
  extractionStatusEnum,
  documentTypeEnum,
  documentExtractions,
  transactionStatusEnum,
  transactions,
  documentExtractionsRelations,
  DocumentExtraction,
} from "../schema";

describe("document extraction schema", () => {
  it("has extraction status enum with correct values", () => {
    expect(extractionStatusEnum.enumValues).toEqual([
      "processing",
      "completed",
      "failed",
    ]);
  });

  it("has document type enum with correct values", () => {
    expect(documentTypeEnum.enumValues).toEqual([
      "receipt",
      "rate_notice",
      "insurance",
      "invoice",
      "unknown",
    ]);
  });

  it("has documentExtractions table with required columns", () => {
    const columns = Object.keys(documentExtractions);
    expect(columns).toContain("id");
    expect(columns).toContain("documentId");
    expect(columns).toContain("status");
    expect(columns).toContain("documentType");
    expect(columns).toContain("extractedData");
    expect(columns).toContain("confidence");
    expect(columns).toContain("matchedPropertyId");
    expect(columns).toContain("draftTransactionId");
    expect(columns).toContain("error");
  });

  it("has transaction status enum with correct values", () => {
    expect(transactionStatusEnum.enumValues).toEqual([
      "confirmed",
      "pending_review",
    ]);
  });

  it("has status column on transactions table", () => {
    const columns = Object.keys(transactions);
    expect(columns).toContain("status");
  });

  it("exports DocumentExtraction type", () => {
    const extraction: DocumentExtraction = {
      id: "test",
      documentId: "test",
      status: "processing",
      documentType: "receipt",
      extractedData: null,
      confidence: null,
      matchedPropertyId: null,
      propertyMatchConfidence: null,
      draftTransactionId: null,
      error: null,
      createdAt: new Date(),
      completedAt: null,
    };
    expect(extraction.status).toBe("processing");
  });

  it("has documentExtractions relations defined", () => {
    expect(documentExtractionsRelations).toBeDefined();
  });
});
