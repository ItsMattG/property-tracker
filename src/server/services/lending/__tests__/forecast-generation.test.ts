import { describe, it, expect, vi, type Mock } from "vitest";
import { generateForecastsForScenario } from "../forecast-generation";

type ForecastDeps = Parameters<typeof generateForecastsForScenario>[0];

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
    },
    recurring: {
      findByOwner: vi.fn().mockResolvedValue([
        { transactionType: "income", amount: "5000" },
        { transactionType: "expense", amount: "-2000" },
      ]),
    },
    loan: {
      findByOwner: vi.fn().mockResolvedValue([
        { currentBalance: "400000", interestRate: "5.5" },
      ]),
    },
  } as unknown as ForecastDeps & {
    forecast: { findScenarioById: Mock; clearForecasts: Mock; insertForecasts: Mock };
    recurring: { findByOwner: Mock };
    loan: { findByOwner: Mock };
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

    const insertedForecasts = (deps.forecast.insertForecasts as Mock).mock.calls[0][0];
    expect(insertedForecasts).toHaveLength(12);
  });

  it("returns early if scenario not found", async () => {
    const deps = createMockDeps();
    (deps.forecast.findScenarioById as Mock).mockResolvedValue(null);

    await generateForecastsForScenario(deps, "user-1", "scenario-1");

    expect(deps.recurring.findByOwner).not.toHaveBeenCalled();
    expect(deps.forecast.clearForecasts).not.toHaveBeenCalled();
  });

  it("handles zero loan balance", async () => {
    const deps = createMockDeps();
    (deps.loan.findByOwner as Mock).mockResolvedValue([]);

    await generateForecastsForScenario(deps, "user-1", "scenario-1");

    expect(deps.forecast.insertForecasts).toHaveBeenCalled();
    const insertedForecasts = (deps.forecast.insertForecasts as Mock).mock.calls[0][0];
    expect(insertedForecasts).toHaveLength(12);
  });
});
