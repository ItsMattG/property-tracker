import { describe, it, expect, vi } from "vitest";
import { generateForecastsForScenario } from "../forecast-generation";

const mockScenario = {
  id: "scenario-1",
  userId: "user-1",
  name: "Test Scenario",
  assumptions: JSON.stringify({
    incomeGrowthRate: 3,
    expenseGrowthRate: 2,
    interestRateChange: 0,
  }),
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockDeps() {
  return {
    forecast: {
      findScenarioById: vi.fn().mockResolvedValue(mockScenario),
      clearForecasts: vi.fn().mockResolvedValue(undefined),
      insertForecasts: vi.fn().mockResolvedValue([]),
      listScenarios: vi.fn(),
      createScenario: vi.fn(),
      updateScenario: vi.fn(),
      deleteScenario: vi.fn(),
      clearAllDefaults: vi.fn(),
      setDefault: vi.fn(),
      getForecasts: vi.fn(),
      getForecastsRaw: vi.fn(),
    },
    recurring: {
      findByOwner: vi.fn().mockResolvedValue([
        { transactionType: "income", amount: "5000" },
        { transactionType: "expense", amount: "-2000" },
      ]),
      findById: vi.fn(),
      findByProperty: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findExpected: vi.fn(),
      createExpected: vi.fn(),
      findExpectedByOwner: vi.fn(),
      updateExpected: vi.fn(),
      deleteExpected: vi.fn(),
    },
    loan: {
      findByOwner: vi.fn().mockResolvedValue([
        { currentBalance: "400000", interestRate: "5.5" },
      ]),
      findById: vi.fn(),
      findByProperty: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("generateForecastsForScenario", () => {
  it("generates 12 monthly forecasts from recurring and loan data", async () => {
    const deps = createMockDeps();

    await generateForecastsForScenario(deps, "user-1", "scenario-1");

    expect(deps.forecast.findScenarioById).toHaveBeenCalledWith("scenario-1", "user-1");
    expect(deps.recurring.findByOwner).toHaveBeenCalledWith("user-1", { isActive: true });
    expect(deps.loan.findByOwner).toHaveBeenCalledWith("user-1");
    expect(deps.forecast.clearForecasts).toHaveBeenCalledWith("scenario-1");
    expect(deps.forecast.insertForecasts).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "user-1",
          scenarioId: "scenario-1",
        }),
      ])
    );

    const insertedForecasts = deps.forecast.insertForecasts.mock.calls[0][0];
    expect(insertedForecasts).toHaveLength(12);
  });

  it("returns early if scenario not found", async () => {
    const deps = createMockDeps();
    deps.forecast.findScenarioById.mockResolvedValue(null);

    await generateForecastsForScenario(deps, "user-1", "scenario-1");

    expect(deps.recurring.findByOwner).not.toHaveBeenCalled();
    expect(deps.forecast.clearForecasts).not.toHaveBeenCalled();
  });

  it("handles zero loan balance", async () => {
    const deps = createMockDeps();
    deps.loan.findByOwner.mockResolvedValue([]);

    await generateForecastsForScenario(deps, "user-1", "scenario-1");

    expect(deps.forecast.insertForecasts).toHaveBeenCalled();
    const insertedForecasts = deps.forecast.insertForecasts.mock.calls[0][0];
    expect(insertedForecasts).toHaveLength(12);
  });
});
