// src/server/routers/__tests__/similarProperties.test.ts
import { describe, it, expect } from "vitest";
import { similarPropertiesRouter } from "../similarProperties";

describe("Similar Properties router", () => {
  it("exports similarPropertiesRouter", () => {
    expect(similarPropertiesRouter).toBeDefined();
  });

  it("has generateVector procedure", () => {
    expect(similarPropertiesRouter.generateVector).toBeDefined();
  });

  it("has findSimilar procedure", () => {
    expect(similarPropertiesRouter.findSimilar).toBeDefined();
  });

  it("has extractListing procedure", () => {
    expect(similarPropertiesRouter.extractListing).toBeDefined();
  });

  it("has saveExternalListing procedure", () => {
    expect(similarPropertiesRouter.saveExternalListing).toBeDefined();
  });

  it("has listExternalListings procedure", () => {
    expect(similarPropertiesRouter.listExternalListings).toBeDefined();
  });

  it("has getSharingPreferences procedure", () => {
    expect(similarPropertiesRouter.getSharingPreferences).toBeDefined();
  });

  it("has updateSharingPreferences procedure", () => {
    expect(similarPropertiesRouter.updateSharingPreferences).toBeDefined();
  });

  it("has discoverProperties procedure", () => {
    expect(similarPropertiesRouter.discoverProperties).toBeDefined();
  });
});
