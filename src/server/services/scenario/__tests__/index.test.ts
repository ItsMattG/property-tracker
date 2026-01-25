import { describe, it, expect } from "vitest";
import {
  runProjection,
  projectMonth,
  parseFactorConfig,
  isValidFactorConfig,
  type PortfolioState,
  type ScenarioFactorInput,
  type ProjectionResult,
  type FactorType,
} from "../index";

describe("Scenario service exports", () => {
  it("exports projection functions", () => {
    expect(runProjection).toBeDefined();
    expect(projectMonth).toBeDefined();
  });

  it("exports type utilities", () => {
    expect(parseFactorConfig).toBeDefined();
    expect(isValidFactorConfig).toBeDefined();
  });
});
