import { describe, it, expect } from "vitest";
import {
  scenarioStatusEnum,
  factorTypeEnum,
  scenarios,
  scenarioFactors,
  scenarioProjections,
  scenarioSnapshots,
  scenariosRelations,
  scenarioFactorsRelations,
  type Scenario,
  type NewScenario,
  type ScenarioFactor,
  type NewScenarioFactor,
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

describe("Scenario tables", () => {
  it("defines scenarios table with required columns", () => {
    expect(scenarios.id).toBeDefined();
    expect(scenarios.userId).toBeDefined();
    expect(scenarios.name).toBeDefined();
    expect(scenarios.parentScenarioId).toBeDefined();
    expect(scenarios.timeHorizonMonths).toBeDefined();
    expect(scenarios.status).toBeDefined();
  });

  it("defines scenarioFactors table with required columns", () => {
    expect(scenarioFactors.id).toBeDefined();
    expect(scenarioFactors.scenarioId).toBeDefined();
    expect(scenarioFactors.factorType).toBeDefined();
    expect(scenarioFactors.config).toBeDefined();
    expect(scenarioFactors.propertyId).toBeDefined();
    expect(scenarioFactors.startMonth).toBeDefined();
    expect(scenarioFactors.durationMonths).toBeDefined();
  });

  it("defines scenarioProjections table", () => {
    expect(scenarioProjections.id).toBeDefined();
    expect(scenarioProjections.scenarioId).toBeDefined();
    expect(scenarioProjections.monthlyResults).toBeDefined();
    expect(scenarioProjections.summaryMetrics).toBeDefined();
    expect(scenarioProjections.isStale).toBeDefined();
  });

  it("defines scenarioSnapshots table", () => {
    expect(scenarioSnapshots.id).toBeDefined();
    expect(scenarioSnapshots.scenarioId).toBeDefined();
    expect(scenarioSnapshots.snapshotData).toBeDefined();
  });
});

describe("Scenario relations and types", () => {
  it("exports scenariosRelations", () => {
    expect(scenariosRelations).toBeDefined();
  });

  it("exports scenarioFactorsRelations", () => {
    expect(scenarioFactorsRelations).toBeDefined();
  });

  it("exports Scenario types", () => {
    const scenario: Partial<Scenario> = { name: "test" };
    expect(scenario.name).toBe("test");
  });
});
