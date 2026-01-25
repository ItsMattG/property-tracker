import { describe, it, expect } from "vitest";
import { complianceRouter } from "../compliance";

describe("Compliance router", () => {
  it("exports complianceRouter", () => {
    expect(complianceRouter).toBeDefined();
  });

  it("has getPropertyCompliance procedure", () => {
    expect(complianceRouter.getPropertyCompliance).toBeDefined();
  });

  it("has getPortfolioCompliance procedure", () => {
    expect(complianceRouter.getPortfolioCompliance).toBeDefined();
  });

  it("has recordCompletion procedure", () => {
    expect(complianceRouter.recordCompletion).toBeDefined();
  });

  it("has getHistory procedure", () => {
    expect(complianceRouter.getHistory).toBeDefined();
  });

  it("has updateRecord procedure", () => {
    expect(complianceRouter.updateRecord).toBeDefined();
  });

  it("has deleteRecord procedure", () => {
    expect(complianceRouter.deleteRecord).toBeDefined();
  });
});
