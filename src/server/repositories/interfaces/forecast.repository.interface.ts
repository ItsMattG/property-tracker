import type { ForecastScenario, NewForecastScenario, CashFlowForecast, NewCashFlowForecast } from "../../db/schema";
import type { DB } from "../base";

export interface CashFlowForecastWithProperty extends CashFlowForecast {
  property: { id: string; address: string; suburb: string } | null;
}

export interface IForecastRepository {
  listScenarios(userId: string): Promise<ForecastScenario[]>;
  findScenarioById(id: string, userId: string): Promise<ForecastScenario | null>;
  createScenario(data: NewForecastScenario, tx?: DB): Promise<ForecastScenario>;
  updateScenario(id: string, data: Partial<ForecastScenario>, tx?: DB): Promise<ForecastScenario>;
  deleteScenario(id: string, userId: string, tx?: DB): Promise<ForecastScenario | null>;
  clearAllDefaults(userId: string, tx?: DB): Promise<void>;
  setDefault(id: string, userId: string, tx?: DB): Promise<ForecastScenario | null>;
  getForecasts(userId: string, scenarioId: string, propertyId?: string): Promise<CashFlowForecastWithProperty[]>;
  getForecastsRaw(userId: string, scenarioId: string, propertyId?: string): Promise<CashFlowForecast[]>;
  clearForecasts(scenarioId: string, tx?: DB): Promise<void>;
  insertForecasts(values: NewCashFlowForecast[], tx?: DB): Promise<void>;
}
