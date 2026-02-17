import type { CategorizationRule, NewCategorizationRule } from "../../db/schema";
import type { DB } from "../base";

export interface ICategorizationRuleRepository {
  /** Find all rules for a user, ordered by priority descending */
  findByUser(userId: string): Promise<CategorizationRule[]>;

  /** Find active rules for a user, ordered by priority descending */
  findActiveByUser(userId: string): Promise<CategorizationRule[]>;

  /** Find a single rule by id scoped to user */
  findById(id: string, userId: string): Promise<CategorizationRule | null>;

  /** Count rules for a user (for plan limit checks) */
  countByUser(userId: string): Promise<number>;

  /** Create a new categorization rule */
  create(data: NewCategorizationRule, tx?: DB): Promise<CategorizationRule>;

  /** Update a rule's fields — returns null if no matching rule */
  update(id: string, userId: string, data: Partial<CategorizationRule>, tx?: DB): Promise<CategorizationRule | null>;

  /** Delete a rule scoped to user */
  delete(id: string, userId: string, tx?: DB): Promise<void>;

  /** Increment the match count for a rule */
  incrementMatchCount(id: string, tx?: DB): Promise<void>;
}
