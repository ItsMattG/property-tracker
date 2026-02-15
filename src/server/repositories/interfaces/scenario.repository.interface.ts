import type { Scenario, NewScenario, ScenarioFactor, NewScenarioFactor, ScenarioProjection, ScenarioSnapshot } from "../../db/schema";
import type { DB } from "../base";

/** Scenario with factors and projection */
export type ScenarioWithRelations = Scenario & {
  factors: ScenarioFactor[];
  projection?: ScenarioProjection | null;
  snapshot?: ScenarioSnapshot | null;
  parentScenario?: Scenario | null;
};

export interface IScenarioRepository {
  /** List scenarios for a user with factors and projections */
  findByOwner(userId: string): Promise<ScenarioWithRelations[]>;

  /** Get a single scenario with full relations */
  findById(id: string, userId: string): Promise<ScenarioWithRelations | null>;

  /** Create a scenario */
  create(data: NewScenario, tx?: DB): Promise<Scenario>;

  /** Update a scenario */
  update(id: string, data: Partial<Scenario>, tx?: DB): Promise<Scenario>;

  /** Delete a scenario */
  delete(id: string, userId: string, tx?: DB): Promise<Scenario | null>;

  /** Add a factor to a scenario */
  createFactor(data: NewScenarioFactor, tx?: DB): Promise<ScenarioFactor>;

  /** Remove a factor */
  deleteFactor(id: string, tx?: DB): Promise<void>;

  /** Find a factor with its parent scenario */
  findFactor(id: string): Promise<(ScenarioFactor & { scenario: Scenario }) | null>;

  /** Upsert a projection for a scenario */
  upsertProjection(scenarioId: string, data: Partial<ScenarioProjection>, tx?: DB): Promise<void>;

  /** Mark a scenario's projection as stale */
  markProjectionStale(scenarioId: string, tx?: DB): Promise<void>;
}
