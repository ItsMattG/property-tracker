import { eq, and, desc, asc } from "drizzle-orm";
import { forecastScenarios, cashFlowForecasts } from "../db/schema";
import type {
  ForecastScenario,
  NewForecastScenario,
  CashFlowForecast,
  NewCashFlowForecast,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IForecastRepository,
  CashFlowForecastWithProperty,
} from "./interfaces/forecast.repository.interface";

export class ForecastRepository
  extends BaseRepository
  implements IForecastRepository
{
  async listScenarios(userId: string): Promise<ForecastScenario[]> {
    return this.db.query.forecastScenarios.findMany({
      where: eq(forecastScenarios.userId, userId),
      orderBy: [desc(forecastScenarios.isDefault), desc(forecastScenarios.createdAt)],
    });
  }

  async findScenarioById(
    id: string,
    userId: string
  ): Promise<ForecastScenario | null> {
    const result = await this.db.query.forecastScenarios.findFirst({
      where: and(
        eq(forecastScenarios.id, id),
        eq(forecastScenarios.userId, userId)
      ),
    });
    return result ?? null;
  }

  async createScenario(
    data: NewForecastScenario,
    tx?: DB
  ): Promise<ForecastScenario> {
    const client = this.resolve(tx);
    const [scenario] = await client
      .insert(forecastScenarios)
      .values(data)
      .returning();
    return scenario;
  }

  async updateScenario(
    id: string,
    data: Partial<ForecastScenario>,
    tx?: DB
  ): Promise<ForecastScenario> {
    const client = this.resolve(tx);
    const [scenario] = await client
      .update(forecastScenarios)
      .set(data)
      .where(eq(forecastScenarios.id, id))
      .returning();
    return scenario;
  }

  async deleteScenario(
    id: string,
    userId: string,
    tx?: DB
  ): Promise<ForecastScenario | null> {
    const client = this.resolve(tx);
    const [deleted] = await client
      .delete(forecastScenarios)
      .where(
        and(
          eq(forecastScenarios.id, id),
          eq(forecastScenarios.userId, userId)
        )
      )
      .returning();
    return deleted ?? null;
  }

  async clearAllDefaults(userId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(forecastScenarios)
      .set({ isDefault: false })
      .where(eq(forecastScenarios.userId, userId));
  }

  async setDefault(
    id: string,
    userId: string,
    tx?: DB
  ): Promise<ForecastScenario | null> {
    const client = this.resolve(tx);
    const [updated] = await client
      .update(forecastScenarios)
      .set({ isDefault: true })
      .where(
        and(
          eq(forecastScenarios.id, id),
          eq(forecastScenarios.userId, userId)
        )
      )
      .returning();
    return updated ?? null;
  }

  async getForecasts(
    userId: string,
    scenarioId: string,
    propertyId?: string
  ): Promise<CashFlowForecastWithProperty[]> {
    const conditions = [
      eq(cashFlowForecasts.userId, userId),
      eq(cashFlowForecasts.scenarioId, scenarioId),
    ];
    if (propertyId) {
      conditions.push(eq(cashFlowForecasts.propertyId, propertyId));
    }

    const results = await this.db.query.cashFlowForecasts.findMany({
      where: and(...conditions),
      orderBy: [asc(cashFlowForecasts.forecastMonth)],
      with: { property: true },
    });

    return results as CashFlowForecastWithProperty[];
  }

  async getForecastsRaw(
    userId: string,
    scenarioId: string,
    propertyId?: string
  ): Promise<CashFlowForecast[]> {
    const conditions = [
      eq(cashFlowForecasts.userId, userId),
      eq(cashFlowForecasts.scenarioId, scenarioId),
    ];
    if (propertyId) {
      conditions.push(eq(cashFlowForecasts.propertyId, propertyId));
    }

    return this.db.query.cashFlowForecasts.findMany({
      where: and(...conditions),
      orderBy: [asc(cashFlowForecasts.forecastMonth)],
    });
  }

  async clearForecasts(scenarioId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(cashFlowForecasts)
      .where(eq(cashFlowForecasts.scenarioId, scenarioId));
  }

  async insertForecasts(
    values: NewCashFlowForecast[],
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    await client.insert(cashFlowForecasts).values(values);
  }
}
