import { describe, it, expect } from "vitest";
import {
  scenarioStatusEnum,
  factorTypeEnum,
} from "../schema";

describe("Scenario enums", () => {
  it("defines scenario status enum", () => {
    expect(scenarioStatusEnum.enumValues).toEqual(["draft", "saved"]);
  });

  it("defines factor type enum", () => {
    expect(factorTypeEnum.enumValues).toContain("interest_rate");
    expect(factorTypeEnum.enumValues).toContain("vacancy");
    expect(factorTypeEnum.enumValues).toContain("sell_property");
    expect(factorTypeEnum.enumValues).toContain("buy_property");
    expect(factorTypeEnum.enumValues).toContain("rent_change");
    expect(factorTypeEnum.enumValues).toContain("expense_change");
  });
});
