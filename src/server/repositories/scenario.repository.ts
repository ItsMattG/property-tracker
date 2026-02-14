import { eq, and, desc } from "drizzle-orm";
import {
  scenarios,
  scenarioFactors,
  scenarioProjections,
} from "../db/schema";
import type {
  Scenario,
  NewScenario,
  ScenarioFactor,
  NewScenarioFactor,
  ScenarioProjection,
} from "../db/schema";
import { BaseRepository, type DB } from "./base";
import type {
  IScenarioRepository,
  ScenarioWithRelations,
} from "./interfaces/scenario.repository.interface";

export class ScenarioRepository
  extends BaseRepository
  implements IScenarioRepository
{
  async findByOwner(userId: string): Promise<ScenarioWithRelations[]> {
    return this.db.query.scenarios.findMany({
      where: eq(scenarios.userId, userId),
      orderBy: [desc(scenarios.updatedAt)],
      with: {
        factors: true,
        projection: true,
      },
    }) as Promise<ScenarioWithRelations[]>;
  }

  async findById(
    id: string,
    userId: string
  ): Promise<ScenarioWithRelations | null> {
    const result = await this.db.query.scenarios.findFirst({
      where: and(eq(scenarios.id, id), eq(scenarios.userId, userId)),
      with: {
        factors: true,
        projection: true,
        snapshot: true,
        parentScenario: true,
      },
    });
    return (result as ScenarioWithRelations) ?? null;
  }

  async create(data: NewScenario, tx?: DB): Promise<Scenario> {
    const client = this.resolve(tx);
    const [scenario] = await client
      .insert(scenarios)
      .values(data)
      .returning();
    return scenario;
  }

  async update(
    id: string,
    data: Record<string, unknown>,
    tx?: DB
  ): Promise<Scenario> {
    const client = this.resolve(tx);
    const [scenario] = await client
      .update(scenarios)
      .set(data)
      .where(eq(scenarios.id, id))
      .returning();
    return scenario;
  }

  async delete(id: string, userId: string, tx?: DB): Promise<Scenario | null> {
    const client = this.resolve(tx);
    const [deleted] = await client
      .delete(scenarios)
      .where(and(eq(scenarios.id, id), eq(scenarios.userId, userId)))
      .returning();
    return deleted ?? null;
  }

  async createFactor(
    data: NewScenarioFactor,
    tx?: DB
  ): Promise<ScenarioFactor> {
    const client = this.resolve(tx);
    const [factor] = await client
      .insert(scenarioFactors)
      .values(data)
      .returning();
    return factor;
  }

  async deleteFactor(id: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .delete(scenarioFactors)
      .where(eq(scenarioFactors.id, id));
  }

  async findFactor(
    id: string
  ): Promise<(ScenarioFactor & { scenario: Scenario }) | null> {
    const result = await this.db.query.scenarioFactors.findFirst({
      where: eq(scenarioFactors.id, id),
      with: { scenario: true },
    });
    return (result as (ScenarioFactor & { scenario: Scenario })) ?? null;
  }

  async upsertProjection(
    scenarioId: string,
    data: Partial<ScenarioProjection>,
    tx?: DB
  ): Promise<void> {
    const client = this.resolve(tx);
    const existing = await this.db.query.scenarioProjections.findFirst({
      where: eq(scenarioProjections.scenarioId, scenarioId),
    });

    if (existing) {
      await client
        .update(scenarioProjections)
        .set(data)
        .where(eq(scenarioProjections.scenarioId, scenarioId));
    } else {
      await client.insert(scenarioProjections).values({
        scenarioId,
        ...data,
      } as typeof scenarioProjections.$inferInsert);
    }
  }

  async markProjectionStale(scenarioId: string, tx?: DB): Promise<void> {
    const client = this.resolve(tx);
    await client
      .update(scenarioProjections)
      .set({ isStale: true })
      .where(eq(scenarioProjections.scenarioId, scenarioId));
  }
}
