import { describe, it, expect } from "vitest";
import {
  MockValuationProvider,
  getValuationProvider,
} from "../valuation";

const makeInput = (overrides?: Partial<{ propertyId: string; purchasePrice: number; purchaseDate: string; address: string; propertyType: string }>) => ({
  propertyId: "test-property-1",
  purchasePrice: 800000,
  purchaseDate: "2020-01-15",
  address: "123 Test St, Sydney NSW 2000",
  propertyType: "house",
  ...overrides,
});

describe("MockValuationProvider", () => {
  const provider = new MockValuationProvider();

  it("should return provider name", () => {
    expect(provider.getName()).toBe("mock");
  });

  it("should return valuation for a property", async () => {
    const result = await provider.getValuation(makeInput());

    expect(result).not.toBeNull();
    expect(result!.estimatedValue).toBeGreaterThan(0);
    expect(result!.confidenceLow).toBeLessThan(result!.estimatedValue);
    expect(result!.confidenceHigh).toBeGreaterThan(result!.estimatedValue);
    expect(result!.source).toBe("mock");
  });

  it("should return consistent values for same input (deterministic)", async () => {
    const input = makeInput();
    const result1 = await provider.getValuation(input);
    const result2 = await provider.getValuation(input);

    expect(result1!.estimatedValue).toBe(result2!.estimatedValue);
  });

  it("should return null for zero purchase price", async () => {
    const result = await provider.getValuation(makeInput({ purchasePrice: 0 }));
    expect(result).toBeNull();
  });

  it("should return null for future purchase date", async () => {
    const result = await provider.getValuation(makeInput({ purchaseDate: "2099-01-01" }));
    expect(result).toBeNull();
  });

  it("should grow value over time", async () => {
    const input = makeInput({ purchaseDate: "2015-01-01" });
    const result = await provider.getValuation(input);

    expect(result).not.toBeNull();
    expect(result!.estimatedValue).toBeGreaterThan(input.purchasePrice);
  });

  it("should generate history from purchase date to now", async () => {
    const input = makeInput({ purchaseDate: "2023-01-01" });
    const history = await provider.generateHistory(input);

    expect(history.length).toBeGreaterThan(0);
    expect(history[0].valueDate).toBe("2023-01-01");
    // Each entry should have a valueDate
    for (const entry of history) {
      expect(entry.valueDate).toMatch(/^\d{4}-\d{2}-01$/);
      expect(entry.estimatedValue).toBeGreaterThan(0);
    }
  });
});

describe("getValuationProvider", () => {
  it("should return MockValuationProvider by default", () => {
    const provider = getValuationProvider();
    expect(provider.getName()).toBe("mock");
  });
});
