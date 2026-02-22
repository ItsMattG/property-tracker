import { describe, it, expect } from "vitest";

import { calculateYearlyDeduction } from "../depreciation";

describe("client calculateYearlyDeduction", () => {
  it("calculates prime cost", () => {
    expect(calculateYearlyDeduction(10000, 10, "prime_cost")).toBe(1000);
  });

  it("calculates diminishing value", () => {
    expect(calculateYearlyDeduction(10000, 10, "diminishing_value")).toBe(2000);
  });

  it("returns 0 for invalid inputs", () => {
    expect(calculateYearlyDeduction(0, 10, "prime_cost")).toBe(0);
    expect(calculateYearlyDeduction(10000, 0, "prime_cost")).toBe(0);
  });
});
