import { describe, it, expect } from "vitest";
import { loanComparisonRouter } from "../loanComparison";

describe("loanComparison router", () => {
  it("exports the router", () => {
    expect(loanComparisonRouter).toBeDefined();
  });

  it("has calculate procedure", () => {
    expect(loanComparisonRouter.calculate).toBeDefined();
  });

  it("has getMarketRate procedure", () => {
    expect(loanComparisonRouter.getMarketRate).toBeDefined();
  });

  it("has saveComparison procedure", () => {
    expect(loanComparisonRouter.saveComparison).toBeDefined();
  });

  it("has listComparisons procedure", () => {
    expect(loanComparisonRouter.listComparisons).toBeDefined();
  });

  it("has deleteComparison procedure", () => {
    expect(loanComparisonRouter.deleteComparison).toBeDefined();
  });

  it("has getAlertConfig procedure", () => {
    expect(loanComparisonRouter.getAlertConfig).toBeDefined();
  });

  it("has updateAlertConfig procedure", () => {
    expect(loanComparisonRouter.updateAlertConfig).toBeDefined();
  });
});
