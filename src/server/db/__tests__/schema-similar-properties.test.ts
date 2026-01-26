// src/server/db/__tests__/schema-similar-properties.test.ts
import { describe, it, expect } from "vitest";
import { shareLevelEnum, listingSourceTypeEnum, propertyTypeEnum } from "../schema";

describe("Similar Properties Schema", () => {
  describe("shareLevelEnum", () => {
    it("has correct values", () => {
      expect(shareLevelEnum.enumValues).toEqual([
        "none",
        "anonymous",
        "pseudonymous",
        "controlled",
      ]);
    });
  });

  describe("listingSourceTypeEnum", () => {
    it("has correct values", () => {
      expect(listingSourceTypeEnum.enumValues).toEqual([
        "url",
        "text",
        "manual",
      ]);
    });
  });

  describe("propertyTypeEnum", () => {
    it("has correct values", () => {
      expect(propertyTypeEnum.enumValues).toEqual([
        "house",
        "townhouse",
        "unit",
      ]);
    });
  });
});
