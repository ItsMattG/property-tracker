import { describe, it, expect } from "vitest";
import {
  MockValuationProvider,
  getValuationProvider,
} from "../valuation";

describe("MockValuationProvider", () => {
  const provider = new MockValuationProvider();

  it("should return provider name", () => {
    expect(provider.getName()).toBe("mock");
  });

  it("should return valuation for Sydney address", async () => {
    const result = await provider.getValuation(
      "123 Test St, Sydney NSW 2000",
      "house"
    );

    expect(result).not.toBeNull();
    expect(result!.estimatedValue).toBeGreaterThan(0);
    expect(result!.confidenceLow).toBeLessThan(result!.estimatedValue);
    expect(result!.confidenceHigh).toBeGreaterThan(result!.estimatedValue);
    expect(result!.source).toBe("mock");
  });

  it("should return higher values for Sydney than regional", async () => {
    const sydneyResult = await provider.getValuation(
      "123 Test St, Sydney NSW 2000",
      "house"
    );
    const regionalResult = await provider.getValuation(
      "456 Rural Rd, Dubbo NSW 2830",
      "house"
    );

    expect(sydneyResult!.estimatedValue).toBeGreaterThan(
      regionalResult!.estimatedValue
    );
  });

  it("should return consistent values for same address (deterministic)", async () => {
    const result1 = await provider.getValuation(
      "789 Same St, Melbourne VIC 3000",
      "house"
    );
    const result2 = await provider.getValuation(
      "789 Same St, Melbourne VIC 3000",
      "house"
    );

    expect(result1!.estimatedValue).toBe(result2!.estimatedValue);
  });

  it("should return null for FAIL address to simulate API failures", async () => {
    const result = await provider.getValuation("FAIL Test Address", "house");
    expect(result).toBeNull();
  });
});

describe("getValuationProvider", () => {
  it("should return MockValuationProvider by default", () => {
    const provider = getValuationProvider();
    expect(provider.getName()).toBe("mock");
  });
});
