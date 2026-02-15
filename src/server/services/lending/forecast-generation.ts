import type { IForecastRepository } from "../../repositories/interfaces/forecast.repository.interface";
import type { IRecurringRepository } from "../../repositories/interfaces/recurring.repository.interface";
import type { ILoanRepository } from "../../repositories/interfaces/loan.repository.interface";
import {
  parseAssumptions,
  calculateMonthlyProjection,
  getForecastMonth,
} from "./forecast";

interface ForecastDeps {
  forecast: IForecastRepository;
  recurring: IRecurringRepository;
  loan: ILoanRepository;
}

/**
 * Regenerate 12-month cash flow forecasts for a scenario.
 * Reads recurring income/expenses and loans, then projects monthly values
 * using the scenario's assumptions.
 */
export async function generateForecastsForScenario(
  deps: ForecastDeps,
  userId: string,
  scenarioId: string
): Promise<void> {
  const scenario = await deps.forecast.findScenarioById(scenarioId, userId);
  if (!scenario) return;

  const assumptions = parseAssumptions(scenario.assumptions);

  const [recurring, userLoans] = await Promise.all([
    deps.recurring.findByOwner(userId, { isActive: true }),
    deps.loan.findByOwner(userId),
  ]);

  const baseIncome = recurring
    .filter((r) => r.transactionType === "income")
    .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

  const baseExpenses = recurring
    .filter((r) => r.transactionType === "expense")
    .reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0);

  const totalLoanBalance = userLoans.reduce(
    (sum, l) => sum + Number(l.currentBalance),
    0
  );
  const weightedRate =
    totalLoanBalance > 0
      ? userLoans.reduce(
          (sum, l) =>
            sum + (Number(l.currentBalance) / totalLoanBalance) * Number(l.interestRate),
          0
        )
      : 0;

  await deps.forecast.clearForecasts(scenarioId);

  const forecastValues = Array.from({ length: 12 }, (_, month) => {
    const projection = calculateMonthlyProjection({
      monthsAhead: month,
      baseIncome,
      baseExpenses,
      loanBalance: totalLoanBalance,
      loanRate: weightedRate,
      assumptions,
    });

    return {
      userId,
      scenarioId,
      propertyId: null,
      forecastMonth: getForecastMonth(month),
      projectedIncome: String(projection.projectedIncome),
      projectedExpenses: String(projection.projectedExpenses),
      projectedNet: String(projection.projectedNet),
      breakdown: JSON.stringify({
        baseIncome,
        baseExpenses,
        loanInterest: projection.projectedExpenses - baseExpenses,
      }),
    };
  });

  await deps.forecast.insertForecasts(forecastValues);
}
